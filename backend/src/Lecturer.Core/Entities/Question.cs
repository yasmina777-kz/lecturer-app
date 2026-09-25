namespace Lecturer.Core.Entities;

// Вопрос студента и ответ аватара. Заодно это лог для будущей аналитики
// (на каких слайдах чаще всего спрашивают).
public class Question
{
    public Guid Id { get; set; }
    public Guid? UserId { get; set; }
    public Guid LectureId { get; set; }
    public Guid SlideId { get; set; }

    public string? QuestionAudioUrl { get; set; }
    public string QuestionText { get; set; } = string.Empty;

    public string AnswerText { get; set; } = string.Empty;
    public string? AnswerAudioUrl { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
