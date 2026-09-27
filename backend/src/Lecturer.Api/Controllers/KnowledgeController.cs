using Lecturer.Api.Services;
using Lecturer.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
namespace Lecturer.Api.Controllers;
[ApiController, Route("api/knowledge"), Authorize]
public class KnowledgeController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        var uid = SessionService.UserId(User);
        var lectures = await LectureAccess.Readable(db, uid, User.IsInRole("Admin"))
            .Where(l => l.OwnerId == uid || db.Progress.Any(p => p.LectureId == l.Id && p.UserId == uid) || db.GroupAssignments.Any(a => a.LectureId == l.Id && db.GroupMembers.Any(m => m.GroupId == a.GroupId && m.UserId == uid)))
            .Select(l => new { l.Id, l.Title, l.Subject }).ToListAsync(ct);
        var ids = lectures.Select(l => l.Id).ToArray();
        var progress = await db.Progress.Where(p => p.UserId == uid && ids.Contains(p.LectureId)).ToDictionaryAsync(p => p.LectureId, ct);
        var topics = lectures.Select(l => new { l.Id, l.Title, l.Subject, started = progress.ContainsKey(l.Id), completed = progress.GetValueOrDefault(l.Id)?.Completed ?? false, score = progress.GetValueOrDefault(l.Id)?.QuizScore }).ToArray();
        var attempts = await (from a in db.QuizAttempts join l in db.Lectures on a.LectureId equals l.Id where a.UserId == uid && ids.Contains(l.Id) orderby a.CreatedAt descending select new { a.Id, a.LectureId, l.Title, a.Score, a.CreatedAt }).Take(12).ToListAsync(ct);
        return Ok(new { topics, history = attempts.AsEnumerable().Reverse(),
            subjects = topics.GroupBy(l => l.Subject).Select(g => new { subject = g.Key, total = g.Count(), tested = g.Count(l => l.score != null), average = g.Where(l => l.score != null).Select(l => (double?)l.score).DefaultIfEmpty().Average() }) });
    }
}
