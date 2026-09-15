using Lecturer.Core.Entities;

namespace Lecturer.Core.Interfaces;

// Распознавание речи: аудио вопроса студента → текст
public interface ISpeechToTextService
{
    Task<string> TranscribeAsync(Stream audioStream, CancellationToken ct = default);
}

// Озвучка ответа: текст → аудиофайл (возвращаем URL, где он сохранён)
public interface ITextToSpeechService
{
    Task<string> SynthesizeAsync(string text, CancellationToken ct = default);
}

// Обёртка над вашим существующим AI.
// contextText — то, что уже было рассказано на этом слайде (NarrationText),
// это даёт AI понимание, о чём именно спрашивает студент.
public interface IAiClient
{
    Task<string> AnswerQuestionAsync(string contextText, string questionText, CancellationToken ct = default);
}

public interface ILectureRepository
{
    Task<Lecture?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<Slide?> GetSlideAsync(Guid slideId, CancellationToken ct = default);
}

public interface IQuestionRepository
{
    Task AddAsync(Question question, CancellationToken ct = default);
}
