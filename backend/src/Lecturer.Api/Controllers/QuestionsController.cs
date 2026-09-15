using Lecturer.Core.Services;
using Microsoft.AspNetCore.Mvc;

namespace Lecturer.Api.Controllers;

// Модель для формы с файлом. Swagger умеет генерировать документацию
// для форм только если все поля собраны в один класс, а не переданы
// отдельными параметрами метода.
public class AskQuestionRequest
{
    public Guid LectureId { get; set; }
    public Guid SlideId { get; set; }
    public IFormFile Audio { get; set; } = null!;
}

[ApiController]
[Route("api/questions")]
public class QuestionsController : ControllerBase
{
    private readonly AskQuestionService _askQuestionService;

    public QuestionsController(AskQuestionService askQuestionService)
    {
        _askQuestionService = askQuestionService;
    }

    // POST /api/questions/ask
    [HttpPost("ask")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(20_000_000)]
    public async Task<IActionResult> Ask([FromForm] AskQuestionRequest request, CancellationToken ct)
    {
        if (request.Audio.Length == 0)
            return BadRequest("Пустой аудиофайл.");

        await using var stream = request.Audio.OpenReadStream();

        var result = await _askQuestionService.HandleAsync(request.LectureId, request.SlideId, stream, ct);

        return Ok(new
        {
            answerText = result.AnswerText,
            answerAudioUrl = result.AnswerAudioUrl
        });
    }
}