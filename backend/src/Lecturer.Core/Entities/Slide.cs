namespace Lecturer.Core.Entities;

// Один слайд презентации.
public class Slide
{
    public Guid Id { get; set; }
    public Guid LectureId { get; set; }
    public int OrderIndex { get; set; }

    // Текст, который озвучивает аватар/TTS во время этого слайда.
    // Он же передаётся в AI как контекст, когда студент задаёт вопрос.
    public string NarrationText { get; set; } = string.Empty;

    // Содержимое самого слайда (заголовок, буллеты, картинки) —
    // храним как JSON-строку, чтобы не проектировать жёсткую схему на старте.
    public string ContentJson { get; set; } = "{}";
}
