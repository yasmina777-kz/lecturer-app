namespace Lecturer.Core.Entities;
// No foreign keys: billing history must survive deletion of a lecture.
public class AiUsage
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public Guid? LectureId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string Operation { get; set; } = "";
    public string Model { get; set; } = "";
    public string Status { get; set; } = "pending";
    public long? InputTokens { get; set; }
    public long? CachedTokens { get; set; }
    public long? OutputTokens { get; set; }
    public double? EstimatedUsd { get; set; }
    public double? AudioSeconds { get; set; }
}
