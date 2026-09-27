using System.ComponentModel.DataAnnotations;
using System.Security.Cryptography;
using Lecturer.Api.Services;
using Lecturer.Core.Entities;
using Lecturer.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
namespace Lecturer.Api.Controllers;
[ApiController, Route("api/groups"), Authorize]
public class GroupsController(AppDbContext db) : ControllerBase
{
    private Guid Uid => SessionService.UserId(User);
    private bool Teacher => User.IsInRole("Lecturer") || User.IsInRole("Admin");
    private bool Manages(StudyGroup g) => User.IsInRole("Admin") || (Teacher && g.OwnerId == Uid);
    private IQueryable<StudyGroup> Visible => db.StudyGroups.Where(g => User.IsInRole("Admin") || (Teacher && g.OwnerId == Uid) || db.GroupMembers.Any(m => m.GroupId == g.Id && m.UserId == Uid));
    private static string Code() => Convert.ToHexString(RandomNumberGenerator.GetBytes(6));
    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        var groups = await Visible.OrderByDescending(g => g.CreatedAt).ToListAsync(ct);
        var ids = groups.Select(g => g.Id).ToArray();
        var members = await db.GroupMembers.Where(m => ids.Contains(m.GroupId)).ToListAsync(ct);
        var assignments = await db.GroupAssignments.Where(a => ids.Contains(a.GroupId)).ToListAsync(ct);
        return Ok(groups.Select(g => new { g.Id, g.Name, canManage = Manages(g), memberCount = members.Count(m => m.GroupId == g.Id), assignmentCount = assignments.Count(a => a.GroupId == g.Id) }));
    }
    [HttpPost, Authorize(Roles = "Lecturer,Admin")]
    public async Task<IActionResult> Create(GroupNameRequest dto, CancellationToken ct)
    {
        if (dto.Name.Trim().Length < 2) return BadRequest(new { message = "Введите название группы." });
        var group = new StudyGroup { Id = Guid.NewGuid(), OwnerId = Uid, Name = dto.Name.Trim(), JoinCode = Code() };
        db.StudyGroups.Add(group); await db.SaveChangesAsync(ct); return Ok(new { group.Id });
    }
    [HttpPost("join"), Authorize(Roles = "Student"), EnableRateLimiting("auth")]
    public async Task<IActionResult> Join(JoinGroupRequest dto, CancellationToken ct)
    {
        var code = dto.Code.Trim().ToUpperInvariant();
        var group = await db.StudyGroups.FirstOrDefaultAsync(g => g.JoinCode == code, ct);
        if (group == null) return NotFound(new { message = "Группа с таким кодом не найдена." });
        if (!await db.GroupMembers.AnyAsync(m => m.GroupId == group.Id && m.UserId == Uid, ct))
        {
            db.GroupMembers.Add(new GroupMember { GroupId = group.Id, UserId = Uid });
            try { await db.SaveChangesAsync(ct); }
            catch (DbUpdateException)
            {
                if (!await db.GroupMembers.AsNoTracking().AnyAsync(m => m.GroupId == group.Id && m.UserId == Uid, ct)) throw;
            }
        }
        return Ok(new { group.Id });
    }
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Detail(Guid id, CancellationToken ct)
    {
        var group = await Visible.FirstOrDefaultAsync(g => g.Id == id, ct); if (group == null) return NotFound();
        var manages = Manages(group);
        var assignments = await (from a in db.GroupAssignments join l in db.Lectures on a.LectureId equals l.Id where a.GroupId == id orderby a.AssignedAt descending select new { a.LectureId, l.Title, l.Subject, a.AssignedAt, a.DueAt }).ToListAsync(ct);
        var members = await (from m in db.GroupMembers join u in db.Users on m.UserId equals u.Id where m.GroupId == id select new { u.Id, u.FullName }).ToListAsync(ct);
        var lids = assignments.Select(a => a.LectureId).ToArray();
        var uids = manages ? members.Select(m => m.Id).ToArray() : new[] { Uid };
        var progress = await db.Progress.Where(p => uids.Contains(p.UserId) && lids.Contains(p.LectureId)).ToListAsync(ct);
        return Ok(new { group.Id, group.Name, canManage = manages, joinCode = manages ? group.JoinCode : null, memberCount = members.Count,
            assignments = assignments.Select(a => new { a.LectureId, a.Title, a.Subject, a.AssignedAt, a.DueAt,
                completedCount = manages ? (int?)progress.Count(p => p.LectureId == a.LectureId && p.Completed) : null,
                testedCount = manages ? (int?)progress.Count(p => p.LectureId == a.LectureId && p.QuizScore != null) : null,
                averageScore = manages ? progress.Where(p => p.LectureId == a.LectureId && p.QuizScore != null).Select(p => (double?)p.QuizScore).DefaultIfEmpty().Average() : null,
                myCompleted = progress.Any(p => p.UserId == Uid && p.LectureId == a.LectureId && p.Completed),
                myScore = progress.FirstOrDefault(p => p.UserId == Uid && p.LectureId == a.LectureId)?.QuizScore }),
            members = manages ? members.Select(m => new { m.Id, m.FullName,
                completed = progress.Count(p => p.UserId == m.Id && p.Completed),
                tested = progress.Count(p => p.UserId == m.Id && p.QuizScore != null),
                averageScore = progress.Where(p => p.UserId == m.Id && p.QuizScore != null).Select(p => (double?)p.QuizScore).DefaultIfEmpty().Average() }) : null
        });
    }
    [HttpPost("{id:guid}/code"), Authorize(Roles = "Lecturer,Admin")]
    public async Task<IActionResult> RotateCode(Guid id, CancellationToken ct)
    {
        var group = await db.StudyGroups.FindAsync(new object[] { id }, ct); if (group == null || !Manages(group)) return NotFound();
        group.JoinCode = Code(); await db.SaveChangesAsync(ct); return Ok(new { group.JoinCode });
    }
    [HttpPost("{id:guid}/assignments"), Authorize(Roles = "Lecturer,Admin")]
    public async Task<IActionResult> Assign(Guid id, AssignLectureRequest dto, CancellationToken ct)
    {
        var group = await db.StudyGroups.FindAsync(new object[] { id }, ct); if (group == null || !Manages(group)) return NotFound();
        // A teacher may share their own private lecture, never another author's private material.
        if (!await db.Lectures.AnyAsync(l => l.Id == dto.LectureId && (l.OwnerId == Uid || l.IsPublished || User.IsInRole("Admin")), ct)) return NotFound();
        var assignment = await db.GroupAssignments.FindAsync(new object[] { id, dto.LectureId }, ct);
        if (assignment == null) { assignment = new GroupAssignment { GroupId = id, LectureId = dto.LectureId }; db.GroupAssignments.Add(assignment); }
        assignment.DueAt = dto.DueAt?.ToUniversalTime(); await db.SaveChangesAsync(ct); return NoContent();
    }
    [HttpDelete("{id:guid}/assignments/{lectureId:guid}"), Authorize(Roles = "Lecturer,Admin")]
    public async Task<IActionResult> Unassign(Guid id, Guid lectureId, CancellationToken ct)
    {
        var group = await db.StudyGroups.FindAsync(new object[] { id }, ct); if (group == null || !Manages(group)) return NotFound();
        await db.GroupAssignments.Where(a => a.GroupId == id && a.LectureId == lectureId).ExecuteDeleteAsync(ct); return NoContent();
    }
    [HttpDelete("{id:guid}/members/{userId:guid}")]
    public async Task<IActionResult> RemoveMember(Guid id, Guid userId, CancellationToken ct)
    {
        var group = await db.StudyGroups.FindAsync(new object[] { id }, ct); if (group == null) return NotFound();
        if (userId != Uid && !Manages(group)) return Forbid();
        await db.GroupMembers.Where(m => m.GroupId == id && m.UserId == userId).ExecuteDeleteAsync(ct); return NoContent();
    }
}
public record GroupNameRequest([Required, StringLength(100, MinimumLength = 2)] string Name);
public record JoinGroupRequest([Required, StringLength(30, MinimumLength = 1)] string Code);
public record AssignLectureRequest(Guid LectureId, DateTime? DueAt);
