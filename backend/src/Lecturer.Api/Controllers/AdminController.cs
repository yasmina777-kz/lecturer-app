using Lecturer.Api.Services;
using Lecturer.Core.Entities;
using Lecturer.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
namespace Lecturer.Api.Controllers;
[ApiController, Route("api/admin"), Authorize(Roles = "Admin")]
public class AdminController(AppDbContext db, AiService ai, SpeechService speech) : ControllerBase
{
    [HttpGet("overview")]
    public async Task<IActionResult> Overview(CancellationToken ct) => Ok(new
    {
        users = await db.Users.CountAsync(ct),
        lectures = await db.Lectures.CountAsync(ct),
        questions = await db.Questions.CountAsync(ct),
        completed = await db.Progress.CountAsync(p => p.Completed, ct),
        aiConfigured = ai.Available,
        aiModel = ai.Model,
        speech = speech.Available ? "azure" : "browser",
        database = db.Database.ProviderName,
        recentQuestions = await db.Questions.OrderByDescending(q => q.CreatedAt).Take(8).Join(db.Lectures, q => q.LectureId, l => l.Id, (q, l) => new { q.Id, q.QuestionText, q.CreatedAt, lectureTitle = l.Title }).ToListAsync(ct)
    });
    [HttpGet("users")]
    public async Task<IActionResult> Users(CancellationToken ct) => Ok(await db.Users.OrderByDescending(u => u.CreatedAt).Select(u => new { u.Id, u.FullName, u.Email, role = u.Role.ToString(), u.IsDisabled, u.CreatedAt }).ToListAsync(ct));
    [HttpPatch("users/{id:guid}")]
    public async Task<IActionResult> Update(Guid id, AdminUserRequest dto, CancellationToken ct)
    {
        if (!Enum.TryParse<UserRole>(dto.Role, out var role) || !Enum.IsDefined(role)) return BadRequest(new { message = "Неизвестная роль." });
        if (id == SessionService.UserId(User)) return BadRequest(new { message = "Нельзя изменить собственную роль или заблокировать себя." });
        var user = await db.Users.FindAsync(new object[] { id }, ct); if (user == null) return NotFound();
        user.Role = role; user.IsDisabled = dto.IsDisabled; user.SecurityStamp = Guid.NewGuid().ToString();
        await db.SaveChangesAsync(ct); return NoContent();
    }
}
public record AdminUserRequest(string Role, bool IsDisabled);
