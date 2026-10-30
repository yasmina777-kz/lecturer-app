namespace Lecturer.Core.Entities;

public class KnowledgeObservation
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid LectureId { get; set; }
    public Guid AttemptId { get; set; }
    public string ItemKey { get; set; } = "";
    public string SkillKey { get; set; } = "";
    public string SkillName { get; set; } = "";
    public string Subject { get; set; } = "";
    public int Position { get; set; }
    public bool Correct { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class KnowledgeModel
{
    public int Id { get; set; } = 1;
    public string ArtifactJson { get; set; } = "";
    public DateTime ActivatedAt { get; set; } = DateTime.UtcNow;
}
