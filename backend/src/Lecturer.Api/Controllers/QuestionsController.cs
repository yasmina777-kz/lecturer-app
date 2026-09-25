using System.ComponentModel.DataAnnotations;
using Lecturer.Api.Services;
using Lecturer.Core.Entities;
using Lecturer.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
namespace Lecturer.Api.Controllers;
[ApiController, Route("api/questions"), Authorize, EnableRateLimiting("ai")]
public class QuestionsController(AppDbContext db, AiService ai) : ControllerBase
{
    [HttpPost("ask"), RequestSizeLimit(11_000_000)]
    public async Task<IActionResult> Ask([FromForm] AskQuestionRequest dto, CancellationToken ct)
    {
        var uid = SessionService.UserId(User);
        var lecture = await db.Lectures.Include(l => l.Slides).FirstOrDefaultAsync(l => l.Id == dto.LectureId && (l.IsPublished || l.OwnerId == uid || User.IsInRole("Admin")), ct);
        var slide = lecture?.Slides.FirstOrDefault(s => s.Id == dto.SlideId);
        if (lecture == null || slide == null) return NotFound(new { message = "Слайд недоступен." });
        var question = dto.Text?.Trim();
        if (dto.Audio != null)
        {
            var ext = Path.GetExtension(dto.Audio.FileName).ToLowerInvariant();
            if (dto.Audio.Length == 0 || dto.Audio.Length > 10_000_000 || !new[] { ".webm", ".mp4", ".m4a", ".wav", ".ogg", ".mp3" }.Contains(ext)) return BadRequest(new { message = "Неподдерживаемый аудиофайл или размер больше 10 МБ." });
            await using var stream = dto.Audio.OpenReadStream(); question = await ai.Transcribe(stream, "question" + ext, lecture.Language, uid, lecture.Id, ct);
        }
        if (string.IsNullOrWhiteSpace(question) || question.Length > 2000) return BadRequest(new { message = "Введите вопрос длиной до 2000 символов." });
        var answer = await ai.Answer($"Тема: {lecture.Title}\nКонспект: {lecture.Summary}\nТекущий слайд: {slide.NarrationText}", question, lecture.Language, uid, lecture.Id, ct);
        db.Questions.Add(new Question { Id = Guid.NewGuid(), UserId = uid, LectureId = lecture.Id, SlideId = slide.Id, QuestionText = question, AnswerText = answer });
        await db.SaveChangesAsync(ct); return Ok(new { questionText = question, answerText = answer });
    }
}
public class AskQuestionRequest
{
    public Guid LectureId { get; set; }
    public Guid SlideId { get; set; }
    [MaxLength(2000)] public string? Text { get; set; }
    public IFormFile? Audio { get; set; }
}
