using Lecturer.Core.Entities;
using Lecturer.Core.Interfaces;

namespace Lecturer.Core.Services;

// Результат, который сервис отдаёт наружу (в контроллер, дальше на фронт)
public record AskQuestionResult(string AnswerText, string? AnswerAudioUrl);

public class AskQuestionService
{
    private readonly ISpeechToTextService _speechToText;
    private readonly ITextToSpeechService _textToSpeech;
    private readonly IAiClient _aiClient;
    private readonly ILectureRepository _lectureRepository;
    private readonly IQuestionRepository _questionRepository;

    // Все зависимости приходят через конструктор (DI) — это и есть
    // "подключаемость": в Program.cs регистрируем нужные реализации,
    // сюда сервис их не знает и знать не должен.
    public AskQuestionService(
        ISpeechToTextService speechToText,
        ITextToSpeechService textToSpeech,
        IAiClient aiClient,
        ILectureRepository lectureRepository,
        IQuestionRepository questionRepository)
    {
        _speechToText = speechToText;
        _textToSpeech = textToSpeech;
        _aiClient = aiClient;
        _lectureRepository = lectureRepository;
        _questionRepository = questionRepository;
    }

    public async Task<AskQuestionResult> HandleAsync(
        Guid lectureId,
        Guid slideId,
        Stream questionAudio,
        CancellationToken ct = default)
    {
        // 1. Находим слайд — нужен его текст как контекст для AI
        var slide = await _lectureRepository.GetSlideAsync(slideId, ct)
            ?? throw new InvalidOperationException("Слайд не найден");

        // 2. Голос студента → текст
        var questionText = await _speechToText.TranscribeAsync(questionAudio, ct);

        // 3. Текст вопроса + контекст слайда → текст ответа от AI
        var answerText = await _aiClient.AnswerQuestionAsync(slide.NarrationText, questionText, ct);

        // 4. Текст ответа → аудио (озвучка аватара)
        var answerAudioUrl = await _textToSpeech.SynthesizeAsync(answerText, ct);

        // 5. Сохраняем всю пару вопрос-ответ в БД — пригодится для аналитики
        var question = new Question
        {
            Id = Guid.NewGuid(),
            LectureId = lectureId,
            SlideId = slideId,
            QuestionText = questionText,
            AnswerText = answerText,
            AnswerAudioUrl = answerAudioUrl
        };
        await _questionRepository.AddAsync(question, ct);

        return new AskQuestionResult(answerText, answerAudioUrl);
    }
}
