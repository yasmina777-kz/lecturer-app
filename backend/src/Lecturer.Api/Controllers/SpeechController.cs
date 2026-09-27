using System.ComponentModel.DataAnnotations;
using Lecturer.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
namespace Lecturer.Api.Controllers;
[ApiController, Route("api/speech"), Authorize]
public class SpeechController(SpeechService speech) : ControllerBase
{
    [HttpPost, EnableRateLimiting("speech")]
    public async Task<IActionResult> Speak(SpeechRequest dto, CancellationToken ct)
    {
        if (!TeachingPreferences.LanguageValid(dto.Language) || !TeachingPreferences.GenderValid(dto.Gender) || string.IsNullOrWhiteSpace(dto.Text)) return BadRequest(new { message = "Выберите язык и голос." });
        return File(await speech.Speak(dto.Text, dto.Language, dto.Gender, SessionService.UserId(User), ct), "audio/mpeg");
    }
}
public record SpeechRequest([Required, StringLength(4000, MinimumLength = 1)] string Text, string Language, string Gender);
