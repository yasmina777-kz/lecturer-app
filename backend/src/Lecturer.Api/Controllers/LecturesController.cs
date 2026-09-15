using Lecturer.Core.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace Lecturer.Api.Controllers;

[ApiController]
[Route("api/lectures")]
public class LecturesController : ControllerBase
{
    private readonly ILectureRepository _lectureRepository;

    public LecturesController(ILectureRepository lectureRepository)
    {
        _lectureRepository = lectureRepository;
    }

    // GET /api/lectures/{id} — фронт вызывает это при открытии LecturePlayerPage,
    // получает лекцию со всеми слайдами и рендерит SlideViewer
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var lecture = await _lectureRepository.GetByIdAsync(id, ct);
        if (lecture is null)
            return NotFound();

        return Ok(new
        {
            lecture.Id,
            lecture.Title,
            Slides = lecture.Slides.Select(s => new
            {
                s.Id,
                s.OrderIndex,
                s.NarrationText,
                s.ContentJson
            })
        });
    }
}
