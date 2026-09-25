using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using Lecturer.Api.Services;
using Lecturer.Core.Entities;
using Lecturer.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace Lecturer.Api.Controllers;
[ApiController, Route("api/lectures"), Authorize]
public class LecturesController(AppDbContext db, AiService ai) : ControllerBase
{
    private Guid Uid => SessionService.UserId(User);
    private IQueryable<Lecture> Accessible => db.Lectures.Where(l => l.IsPublished || l.OwnerId == Uid || User.IsInRole("Admin"));
    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        var progress = await db.Progress.Where(p => p.UserId == Uid).ToDictionaryAsync(p => p.LectureId, ct);
        var lectures = await Accessible.Include(l => l.Slides).OrderByDescending(l => l.CreatedAt).ToListAsync(ct);
        return Ok(lectures.Select(l => new { l.Id, l.Language, AvatarId = TeachingPreferences.VisibleAvatar(l.AvatarId, l.VoiceGender), l.VoiceGender, l.AvatarStyle, l.Title, l.Description, l.Subject, l.Level, l.IsDemo, l.IsPublished, l.CreatedAt, l.OwnerId, slideCount = l.Slides.Count, l.TargetMinutes, duration = Math.Max(1, (int)Math.Ceiling((AiPricing.Words(l.Introduction) + l.Slides.Sum(s => AiPricing.Words(s.NarrationText))) / 110d)), progress = progress.GetValueOrDefault(l.Id) }));
    }
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
    {
        var l = await Accessible.Include(l => l.Slides.OrderBy(s => s.OrderIndex)).FirstOrDefaultAsync(l => l.Id == id, ct);
        if (l == null) return NotFound(new { message = "Лекция не найдена или недоступна." });
        if (l.Slides.Count == 0) return Conflict(new { message = "В этой лекции пока нет слайдов. Создайте новую лекцию из темы или материала." });
        return Ok(new
        {
            l.Id,
            l.Language, AvatarId = TeachingPreferences.VisibleAvatar(l.AvatarId, l.VoiceGender), l.VoiceGender, l.AvatarStyle,
            l.Title,
            l.Description,
            l.Subject,
            l.Level,
            l.TargetMinutes,
            estimatedMinutes = Math.Round((AiPricing.Words(l.Introduction) + l.Slides.Sum(s => AiPricing.Words(s.NarrationText))) / 110d, 1),
            l.Introduction,
            l.Summary,
            l.ExercisesJson,
            l.IsPublished,
            l.IsDemo,
            l.OwnerId,
            l.SourceName,
            l.CreatedAt,
            l.Slides,
            progress = await db.Progress.FindAsync(new object[] { Uid, id }, ct),
            questions = await db.Questions.Where(q => q.LectureId == id && q.UserId == Uid).OrderBy(q => q.CreatedAt).Select(q => new { q.Id, q.QuestionText, q.AnswerText, q.CreatedAt }).ToListAsync(ct)
        });
    }
    [HttpPost, RequestSizeLimit(11_000_000), EnableRateLimiting("ai")]
    public async Task<IActionResult> Create([FromForm] CreateLectureRequest dto, CancellationToken ct)
    {
        if (dto.File == null && string.IsNullOrWhiteSpace(dto.Topic)) return BadRequest(new { message = "Укажите тему или загрузите материал." });
        if (!new[] { "Начальный", "Средний", "Продвинутый" }.Contains(dto.Level)) return BadRequest(new { message = "Неизвестный уровень." });
        if (!new[] { 5, 10, 15, 20, 30 }.Contains(dto.DurationMinutes)) return BadRequest(new { message = "Выберите длительность: 5, 10, 15, 20 или 30 минут." });
        var material = dto.File == null ? "" : await MaterialReader.Read(dto.File, ct);
        var owner = (await db.Users.FindAsync(new object[] { Uid }, ct))!;
        var language = dto.Language ?? owner.TeachingLanguage;
        if (!TeachingPreferences.LanguageValid(language)) return BadRequest(new { message = "Выберите русский, английский или казахский язык." });
        var lecture = await ai.Generate(dto.Topic?.Trim() ?? "Объясни материал", material, dto.Level, dto.DurationMinutes, language, Uid, Guid.NewGuid(), ct);
        lecture.Language = language; lecture.AvatarId = TeachingPreferences.VisibleAvatar(owner.AvatarId, owner.VoiceGender); lecture.VoiceGender = owner.VoiceGender; lecture.AvatarStyle = owner.AvatarStyle;
        lecture.OwnerId = Uid; lecture.SourceName = dto.File == null ? "Тема" : Path.GetFileName(dto.File.FileName);
        db.Lectures.Add(lecture); await db.SaveChangesAsync(ct);
        return Created($"/api/lectures/{lecture.Id}", new { lecture.Id });
    }
    [HttpPut("{id:guid}/progress")]
    public async Task<IActionResult> Progress(Guid id, ProgressRequest dto, CancellationToken ct)
    {
        var lecture = await Accessible.Include(l => l.Slides).FirstOrDefaultAsync(l => l.Id == id, ct);
        if (lecture == null) return NotFound();
        if (dto.SlideIndex < 0 || dto.SlideIndex >= lecture.Slides.Count) return BadRequest();
        var progress = await db.Progress.FindAsync(new object[] { Uid, id }, ct);
        if (progress == null) { progress = new LearningProgress { UserId = Uid, LectureId = id }; db.Progress.Add(progress); }
        progress.SlideIndex = dto.SlideIndex; progress.FurthestSlide = Math.Max(progress.FurthestSlide, dto.SlideIndex);
        progress.Completed |= dto.Completed && dto.SlideIndex == lecture.Slides.Count - 1;
        if (dto.Notes != null) progress.Notes = dto.Notes;
        progress.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct); return Ok(progress);
    }
    [HttpPost("{id:guid}/quiz")]
    public async Task<IActionResult> Quiz(Guid id, QuizRequest dto, CancellationToken ct)
    {
        var lecture = await Accessible.FirstOrDefaultAsync(l => l.Id == id, ct); if (lecture == null) return NotFound();
        using var exercises = JsonDocument.Parse(lecture.ExercisesJson);
        var quiz = exercises.RootElement.GetProperty("quiz");
        if (quiz.GetArrayLength() == 0 || dto.Answers == null || dto.Answers.Length != quiz.GetArrayLength() || dto.Answers.Any(a => a < 0 || a > 3)) return BadRequest(new { message = "Ответьте на все вопросы." });
        var results = quiz.EnumerateArray().Select((q, i) => new { correct = dto.Answers[i] == q.GetProperty("correctIndex").GetInt32(), correctIndex = q.GetProperty("correctIndex").GetInt32(), explanation = q.GetProperty("explanation").GetString() }).ToArray();
        var score = (int)Math.Round(100d * results.Count(r => r.correct) / results.Length);
        var progress = await db.Progress.FindAsync(new object[] { Uid, id }, ct);
        if (progress == null) { progress = new LearningProgress { UserId = Uid, LectureId = id }; db.Progress.Add(progress); }
        progress.QuizScore = score; progress.AnswersJson = JsonSerializer.Serialize(dto.Answers); progress.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct); return Ok(new { score, results });
    }
    [HttpPut("{id:guid}/tasks")]
    public async Task<IActionResult> SaveTasks(Guid id, TaskAnswersRequest dto, CancellationToken ct)
    {
        var lecture = await Accessible.FirstOrDefaultAsync(l => l.Id == id, ct);
        if (lecture == null) return NotFound();
        using var exercises = JsonDocument.Parse(lecture.ExercisesJson);
        var count = exercises.RootElement.GetProperty("tasks").GetArrayLength();
        if (dto.Answers == null || dto.Answers.Any(a => a.Key < 0 || a.Key >= count || a.Value == null || a.Value.Length > 10000))
            return BadRequest(new { message = "Ответы должны содержать до 10 000 символов на задание." });
        var progress = await db.Progress.FindAsync(new object[] { Uid, id }, ct);
        if (progress == null) { progress = new LearningProgress { UserId = Uid, LectureId = id }; db.Progress.Add(progress); }
        progress.TaskAnswersJson = JsonSerializer.Serialize(dto.Answers); progress.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct); return NoContent();
    }
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var lecture = await db.Lectures.FirstOrDefaultAsync(l => l.Id == id && (l.OwnerId == Uid || User.IsInRole("Admin")), ct);
        if (lecture == null) return NotFound();
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        await db.Questions.Where(q => q.LectureId == id).ExecuteDeleteAsync(ct);
        db.Lectures.Remove(lecture); await db.SaveChangesAsync(ct); await transaction.CommitAsync(ct); return NoContent();
    }
    [HttpPatch("{id:guid}")]
    public async Task<IActionResult> Edit(Guid id, EditLectureRequest dto, CancellationToken ct)
    {
        var lecture = await db.Lectures.FirstOrDefaultAsync(l => l.Id == id && (l.OwnerId == Uid || User.IsInRole("Admin")), ct);
        if (lecture == null) return NotFound();
        if (dto.IsPublished != lecture.IsPublished && !User.IsInRole("Admin") && !User.IsInRole("Lecturer")) return Forbid();
        if (dto.Title.Trim().Length < 3) return BadRequest();
        lecture.Title = dto.Title.Trim(); lecture.IsPublished = dto.IsPublished; await db.SaveChangesAsync(ct); return NoContent();
    }
}
public class CreateLectureRequest
{
    [MaxLength(300)] public string? Topic { get; set; }
    public IFormFile? File { get; set; }
    public string? Language { get; set; }
    [Required] public string Level { get; set; } = "Начальный";
    public int DurationMinutes { get; set; } = 5;
}
public record ProgressRequest(int SlideIndex, bool Completed, [MaxLength(20000)] string? Notes);
public record QuizRequest(int[] Answers);
public record EditLectureRequest([Required, StringLength(200, MinimumLength = 3)] string Title, bool IsPublished);

public record TaskAnswersRequest(Dictionary<int, string> Answers);
