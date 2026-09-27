using System.ComponentModel.DataAnnotations;
using Lecturer.Api.Services;
using Lecturer.Core.Entities;
using Lecturer.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
namespace Lecturer.Api.Controllers;
[ApiController, Route("api/admin/automation"), Authorize(Roles="Admin")]
public class AutomationController(AppDbContext db, UsageBudget budget) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        var settings = await budget.Settings(ct); var month = DateTime.UtcNow.ToString("yyyy-MM");
        var since = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var usage = await db.BudgetPeriods.AsNoTracking().FirstOrDefaultAsync(p => p.Id == month, ct);
        if (usage == null)
        {
            var previous = await db.AiUsage.Where(u => u.CreatedAt >= since).GroupBy(u => 1)
                .Select(g => new { Tokens = g.Sum(u => (long)(u.InputTokens ?? 0) + (u.OutputTokens ?? 0)), Requests = g.Count() }).FirstOrDefaultAsync(ct);
            usage = new BudgetPeriod { Id = month, Tokens = previous?.Tokens ?? 0, Requests = previous?.Requests ?? 0 };
        }
        var errors = await db.AiUsage.Where(u => u.CreatedAt >= since && u.Status != "success" && u.Status != "pending").OrderByDescending(u => u.CreatedAt).Take(20).Select(u => new {u.Id,u.Operation,u.Status,u.CreatedAt}).ToListAsync(ct);
        var costs = await db.AiUsage.Where(u => u.CreatedAt >= since).GroupBy(u => 1).Select(g => new { knownUsd = g.Sum(u => u.EstimatedUsd ?? 0), unpriced = g.Count(u => u.EstimatedUsd == null) }).FirstOrDefaultAsync(ct);
        return Ok(new { settings, usage, errors, costs, resetsAt = since.AddMonths(1), cachedAudio = await db.SpeechCache.CountAsync(ct) });
    }
    [HttpPut]
    public async Task<IActionResult> Save(BudgetSettingsRequest dto, CancellationToken ct)
    {
        await budget.Settings(ct);
        await db.AutomationSettings.Where(s => s.Id == 1).ExecuteUpdateAsync(s => s.SetProperty(s => s.MonthlyTokens, dto.MonthlyTokens).SetProperty(s => s.MonthlyRequests, dto.MonthlyRequests).SetProperty(s => s.MonthlySpeechCharacters, dto.MonthlySpeechCharacters), ct);
        return NoContent();
    }
}
public record BudgetSettingsRequest([Range(0,1000000000)] long MonthlyTokens, [Range(0,1000000)] long MonthlyRequests, [Range(0,1000000000)] long MonthlySpeechCharacters);

[ApiController, Route("api/reports/weekly"), Authorize(Roles="Lecturer,Admin")]
public class WeeklyReportsController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] int weeksAgo = 0, CancellationToken ct = default)
    {
        if (weeksAgo is < 0 or > 52) return BadRequest();
        var uid = SessionService.UserId(User);
        var today = DateTime.UtcNow.Date;
        var start = today.AddDays(-(((int)today.DayOfWeek+6)%7) - weeksAgo*7); var end = start.AddDays(7);
        var groups = await db.StudyGroups.Where(g => g.OwnerId == uid || User.IsInRole("Admin")).ToListAsync(ct);
        var gids = groups.Select(g => g.Id).ToArray();
        var members = await (from m in db.GroupMembers join u in db.Users on m.UserId equals u.Id where gids.Contains(m.GroupId) select new { m.GroupId,m.UserId,m.JoinedAt,u.FullName }).ToListAsync(ct);
        var assignments = await (from a in db.GroupAssignments join l in db.Lectures on a.LectureId equals l.Id where gids.Contains(a.GroupId) select new {a.GroupId,a.LectureId,a.AssignedAt,a.DueAt,l.Title}).ToListAsync(ct);
        var uids = members.Select(m => m.UserId).Distinct().ToArray(); var lids = assignments.Select(a => a.LectureId).Distinct().ToArray();
        var attempts = await db.QuizAttempts.Where(a => uids.Contains(a.UserId) && lids.Contains(a.LectureId) && a.CreatedAt >= start && a.CreatedAt < end).ToListAsync(ct);
        var progress = await db.Progress.Where(p => uids.Contains(p.UserId) && lids.Contains(p.LectureId)).ToListAsync(ct);
        var now = DateTime.UtcNow;
        // Each group filters by both member and assignment, including their effective start times.
        var rows = groups.Select(g => {
            var ms = members.Where(m => m.GroupId == g.Id).ToArray(); var ads = assignments.Where(a => a.GroupId == g.Id).ToArray();
            var scoped = attempts.Where(a => ms.Any(m => m.UserId == a.UserId && a.CreatedAt >= m.JoinedAt) && ads.Any(x => x.LectureId == a.LectureId && a.CreatedAt >= x.AssignedAt)).ToArray();
            var latest = scoped.GroupBy(a => new {a.UserId,a.LectureId}).Select(x => x.OrderByDescending(a => a.CreatedAt).First()).ToArray();
            var topicRows = ads.Select(a => { var scores = latest.Where(x => x.LectureId == a.LectureId).ToArray(); return new { a.LectureId, a.Title, tested = scores.Length, averageScore = scores.Length > 0 ? (double?)Math.Round(scores.Average(x => x.Score),1) : null, needsReview = scores.Count(x => x.Score < 60) }; }).ToArray();
            var studentRows = ms.Select(m => {
                var scores = latest.Where(a => a.UserId == m.UserId).ToArray();
                return new { m.UserId,m.FullName,tested = scores.Length,needsReview = scores.Count(a => a.Score < 60),averageScore = scores.Length > 0 ? (double?)Math.Round(scores.Average(a => a.Score),1) : null,
                    overdueNow = ads.Count(a => a.DueAt < now && !progress.Any(p => p.UserId == m.UserId && p.LectureId == a.LectureId && p.Completed)) };
            }).ToArray();
            return new { g.Id,g.Name,memberCount = ms.Length,attemptCount = scoped.Length,activeStudents = scoped.Select(a => a.UserId).Distinct().Count(),topics = topicRows,students = studentRows };
        }).ToArray();
        return Ok(new { start, end, generatedAt = now, groups = rows, activity = Enumerable.Range(0,7).Select(i => new { day = start.AddDays(i), attempts = attempts.Count(a => a.CreatedAt.Date == start.AddDays(i) && groups.Any(g => members.Any(m => m.GroupId == g.Id && m.UserId == a.UserId && a.CreatedAt >= m.JoinedAt) && assignments.Any(x => x.GroupId == g.Id && x.LectureId == a.LectureId && a.CreatedAt >= x.AssignedAt))) }) });
    }
}
