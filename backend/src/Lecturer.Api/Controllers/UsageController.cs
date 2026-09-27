using Lecturer.Api.Services;
using Lecturer.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
namespace Lecturer.Api.Controllers;
[ApiController, Route("api/admin/usage"), Authorize(Roles = "Admin")]
public class UsageController(AppDbContext db, AiService ai, IConfiguration config) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] int days = 30, [FromQuery] string? operation = null, [FromQuery] int page = 1, CancellationToken ct = default)
    {
        if (days is < 1 or > 365 || page < 1 || operation != null && !new[] { "lecture_plan", "lecture_slides", "question", "transcription", "course_plan", "remediation", "speech", "quality_review" }.Contains(operation)) return BadRequest();
        var since = DateTime.UtcNow.AddDays(-days);
        var query = db.AiUsage.AsNoTracking().Where(u => u.CreatedAt >= since);
        if (operation != null) query = query.Where(u => u.Operation == operation);
        var total = await query.CountAsync(ct);
        var summary = await query.GroupBy(u => u.Operation).Select(g => new { operation = g.Key, requests = g.Count(), inputTokens = g.Sum(x => x.InputTokens ?? 0), cachedTokens = g.Sum(x => x.CachedTokens ?? 0), outputTokens = g.Sum(x => x.OutputTokens ?? 0), knownEstimatedUsd = g.Sum(x => x.EstimatedUsd ?? 0), unpriced = g.Count(x => x.EstimatedUsd == null), unknownTokens = g.Count(x => x.InputTokens == null || x.OutputTokens == null), failed = g.Count(x => x.Status != "success" && x.Status != "pending"), audioSeconds = g.Sum(x => x.AudioSeconds ?? 0) }).ToListAsync(ct);
        var rows = await query.OrderByDescending(u => u.CreatedAt).Skip((page - 1) * 25).Take(25).ToListAsync(ct);
        var userIds = rows.Select(u => u.UserId).ToArray(); var lectureIds = rows.Select(u => u.LectureId).ToArray();
        var users = await db.Users.Where(u => userIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.FullName, ct);
        var lectures = await db.Lectures.Where(l => lectureIds.Contains(l.Id)).ToDictionaryAsync(l => l.Id, l => l.Title, ct);
        return Ok(new { total, page, pageSize = 25, summary, rows = rows.Select(u => new { u.Id, u.CreatedAt, u.Operation, u.Model, u.Status, u.UserId, userName = users.GetValueOrDefault(u.UserId), u.LectureId, lectureTitle = u.LectureId.HasValue ? lectures.GetValueOrDefault(u.LectureId.Value) : null, u.InputTokens, u.CachedTokens, u.OutputTokens, u.EstimatedUsd, u.AudioSeconds }), estimates = new[] { 5, 10, 15, 20, 30 }.Select(m => AiPricing.Estimate(m, 0, "ru", ai.Model, config)), pricingDate = "2026-09-25", pricingUrl = "https://developers.openai.com/api/docs/models/gpt-4o-mini" });
    }
}
[ApiController, Route("api/lectures/estimate"), Authorize]
public class EstimateController(AiService ai, IConfiguration config) : ControllerBase
{
    [HttpGet]
    public IActionResult Get(int minutes = 10, int materialCharacters = 0, string language = "ru")
    {
        if (!new[] { 5, 10, 15, 20, 30 }.Contains(minutes) || materialCharacters is < 0 or > 60000 || !TeachingPreferences.LanguageValid(language)) return BadRequest();
        return Ok(AiPricing.Estimate(minutes, materialCharacters, language, ai.Model, config));
    }
}
