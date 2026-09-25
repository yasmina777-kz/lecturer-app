using Lecturer.Core.DTOs;
using Lecturer.Core.Entities;
using Lecturer.Infrastructure;
using Lecturer.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;
using System.Text;

namespace Lecturer.Api.Controllers;
[ApiController, Route("api/auth")]
public class AuthController(AppDbContext db, SessionService sessions) : ControllerBase
{
    [HttpPost("register"), EnableRateLimiting("auth")]
    public async Task<IActionResult> Register(RegisterDto dto)
    {
        if (!TeachingPreferences.LanguageValid(dto.InterfaceLanguage) || !TeachingPreferences.LanguageValid(dto.TeachingLanguage) || !TeachingPreferences.AvatarValid(dto.AvatarId) || !TeachingPreferences.GenderValid(dto.VoiceGender))
            return BadRequest(new { message = "Проверьте роль, язык, аватар и голос." });
        var email = dto.Email.Trim().ToLowerInvariant();
        if (dto.FullName.Trim().Length < 2 || Encoding.UTF8.GetByteCount(dto.Password) > 72)
            return BadRequest(new { message = "Проверьте имя и длину пароля (до 72 байт UTF-8)." });
        if (await db.Users.AnyAsync(u => u.Email.ToLower() == email)) return Conflict(new { message = "Этот email уже зарегистрирован." });
        var user = new User { Id = Guid.NewGuid(), Email = email, FullName = dto.FullName.Trim(), PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password), Role = UserRole.Student, InterfaceLanguage = dto.InterfaceLanguage, TeachingLanguage = dto.TeachingLanguage, AvatarId = dto.AvatarId, VoiceGender = dto.VoiceGender, CreatedAt = DateTime.UtcNow };
        db.Users.Add(user);
        try { await db.SaveChangesAsync(); } catch (DbUpdateException) { return Conflict(new { message = "Этот email уже зарегистрирован." }); }
        sessions.SignIn(HttpContext, user);
        return Ok(SessionService.Profile(user));
    }
    [HttpPost("login"), EnableRateLimiting("auth")]
    public async Task<IActionResult> Login(LoginDto dto)
    {
        var email = dto.Email.Trim().ToLowerInvariant();
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == email);
        // A dummy hash keeps a nonexistent account on the same password-verification path.
        var hash = user?.PasswordHash ?? "$2a$11$5DQ3FS4.p8kWu.WqwbgHeOYKOwxn96nqtOq/nz38SfDPKclOhOEym";
        if (!BCrypt.Net.BCrypt.Verify(dto.Password, hash) || user == null || user.IsDisabled)
            return Unauthorized(new { message = "Неверный email или пароль, либо доступ приостановлен." });
        sessions.SignIn(HttpContext, user);
        return Ok(SessionService.Profile(user));
    }
    [HttpPost("logout")]
    public IActionResult Logout() { Response.Cookies.Delete("lecturer_session", new CookieOptions { Path = "/" }); return NoContent(); }
    [HttpGet("me"), Authorize]
    public async Task<IActionResult> Me() => Ok(SessionService.Profile((await db.Users.FindAsync(SessionService.UserId(User)))!));
    [HttpPatch("me"), Authorize]
    public async Task<IActionResult> Update(ProfileRequest dto)
    {
        if (dto.FullName.Trim().Length < 2 || !new[] { "sage", "violet", "ocean" }.Contains(dto.AvatarStyle)) return BadRequest(new { message = "Проверьте имя и аватар." });
        if ((dto.InterfaceLanguage != null && !TeachingPreferences.LanguageValid(dto.InterfaceLanguage)) || (dto.TeachingLanguage != null && !TeachingPreferences.LanguageValid(dto.TeachingLanguage)) || (dto.AvatarId != null && !TeachingPreferences.AvatarValid(dto.AvatarId)) || (dto.VoiceGender != null && !TeachingPreferences.GenderValid(dto.VoiceGender)))
            return BadRequest(new { message = "Проверьте роль, язык, аватар и голос." });
        var user = (await db.Users.FindAsync(SessionService.UserId(User)))!;
        if (dto.InterfaceLanguage != null) user.InterfaceLanguage = dto.InterfaceLanguage;
        if (dto.TeachingLanguage != null) user.TeachingLanguage = dto.TeachingLanguage;
        if (dto.AvatarId != null) user.AvatarId = dto.AvatarId;
        if (dto.VoiceGender != null) user.VoiceGender = dto.VoiceGender;
        user.FullName = dto.FullName.Trim(); user.AvatarStyle = dto.AvatarStyle; user.SpeechRate = dto.SpeechRate;
        await db.SaveChangesAsync(); return Ok(SessionService.Profile(user));
    }
    [HttpPatch("language"), Authorize]
    public async Task<IActionResult> Language(LanguageRequest dto)
    {
        if (!TeachingPreferences.LanguageValid(dto.Language)) return BadRequest(new { message = "Выберите русский, английский или казахский язык." });
        var user = (await db.Users.FindAsync(SessionService.UserId(User)))!;
        user.InterfaceLanguage = dto.Language; await db.SaveChangesAsync(); return Ok(SessionService.Profile(user));
    }
    [HttpPost("password"), Authorize, EnableRateLimiting("auth")]
    public async Task<IActionResult> Password(PasswordRequest dto)
    {
        var user = (await db.Users.FindAsync(SessionService.UserId(User)))!;
        if (!BCrypt.Net.BCrypt.Verify(dto.CurrentPassword, user.PasswordHash)) return BadRequest(new { message = "Текущий пароль неверен." });
        if (Encoding.UTF8.GetByteCount(dto.NewPassword) > 72) return BadRequest(new { message = "Пароль превышает 72 байта UTF-8." });
        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.NewPassword); user.SecurityStamp = Guid.NewGuid().ToString();
        await db.SaveChangesAsync(); sessions.SignIn(HttpContext, user); return NoContent();
    }
}
public record ProfileRequest([Required, StringLength(80, MinimumLength = 2)] string FullName, [Required] string AvatarStyle, [Range(0.7, 1.5)] double SpeechRate, string? InterfaceLanguage = null, string? TeachingLanguage = null, string? AvatarId = null, string? VoiceGender = null);
public record PasswordRequest([Required, MaxLength(64)] string CurrentPassword, [Required, StringLength(64, MinimumLength = 8)] string NewPassword);

public record LanguageRequest(string Language);
