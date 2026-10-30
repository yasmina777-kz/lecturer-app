namespace Lecturer.Core.Entities;

public class LessonFeedback
{
    public Guid UserId { get; set; }
    public Guid SlideId { get; set; }
    public Guid LectureId { get; set; }
    public string Status { get; set; } = "understood";
    public string Question { get; set; } = "";
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
