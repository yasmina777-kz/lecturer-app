namespace Lecturer.Core.Entities;

public class Lecture
{
    public Guid Id { get; set; }
    public Guid? OwnerId { get; set; }
    public string Language { get; set; } = "ru";
    public string AvatarId { get; set; } = "classic-male";
    public string VoiceGender { get; set; } = "male";
    public string AvatarStyle { get; set; } = "sage";
    public int TargetMinutes { get; set; }
    public string Title { get; set; } = "";
    public string Description { get; set; } = "";
    public string Subject { get; set; } = "Общее";
    public string Level { get; set; } = "Начальный";
    public string Introduction { get; set; } = "";
    public string Summary { get; set; } = "";
    public string ExercisesJson { get; set; } = "[]";
    public string SourceText { get; set; } = "";
    public string SourceName { get; set; } = "Тема";
    public bool IsPublished { get; set; }
    public bool IsDemo { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public List<Slide> Slides { get; set; } = new();
}

public class LearningProgress
{
    public Guid UserId { get; set; }
    public Guid LectureId { get; set; }
    public int SlideIndex { get; set; }
    public int FurthestSlide { get; set; }
    public bool Completed { get; set; }
    public string Notes { get; set; } = "";
    public string TaskAnswersJson { get; set; } = "{}";
    public string AnswersJson { get; set; } = "{}";
    public int? QuizScore { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
