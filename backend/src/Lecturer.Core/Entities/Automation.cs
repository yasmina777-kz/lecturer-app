namespace Lecturer.Core.Entities;

public class Course
{
    public Guid Id { get; set; }
    public Guid OwnerId { get; set; }
    public string Title { get; set; } = "";
    public string Goal { get; set; } = "";
    public string Language { get; set; } = "ru";
    public string Level { get; set; } = "Начальный";
    public string SourceText { get; set; } = "";
    public string SourceNames { get; set; } = "";
    public DateTime StartAt { get; set; }
    public DateTime EndAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool IsPublished { get; set; }
    public List<CourseModule> Modules { get; set; } = new();
}
public class CourseModule
{
    public Guid Id { get; set; }
    public Guid CourseId { get; set; }
    public int OrderIndex { get; set; }
    public string Title { get; set; } = "";
    public string Objective { get; set; } = "";
    public int Minutes { get; set; }
    public DateTime DueAt { get; set; }
    public Guid? LectureId { get; set; }
    public Guid? LeaseId { get; set; }
    public DateTime? LeaseUntil { get; set; }
    public string Error { get; set; } = "";
}
public class Remediation
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid LectureId { get; set; }
    public int QuestionIndex { get; set; }
    public string ContentJson { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ResolvedAt { get; set; }
    public int Attempts { get; set; }
}
public class AutomationSettings
{
    public int Id { get; set; } = 1;
    public long MonthlyTokens { get; set; } = 1_000_000;
    public long MonthlyRequests { get; set; } = 2000;
    public long MonthlySpeechCharacters { get; set; } = 500_000;
}
public class BudgetPeriod
{
    public string Id { get; set; } = "";
    public long Tokens { get; set; }
    public long Requests { get; set; }
    public long SpeechCharacters { get; set; }
}
public class SpeechCache
{
    public string Id { get; set; } = "";
    public Guid UserId { get; set; }
    public byte[] Audio { get; set; } = Array.Empty<byte>();
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
