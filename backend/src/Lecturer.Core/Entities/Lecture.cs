namespace Lecturer.Core.Entities;

// Сущность "Лекция". Пока без владельца/организации — это MVP.
public class Lecture
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Навигационное свойство — EF Core подтянет слайды одним Include()
    public List<Slide> Slides { get; set; } = new();
}
