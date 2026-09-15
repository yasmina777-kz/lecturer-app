using Lecturer.Core.Interfaces;

namespace Lecturer.Infrastructure;

// ВАЖНО: это заглушки-каркасы. Внутри — место, куда вставляется вызов
// реального провайдера (например, через HttpClient к его API).
// Пока провайдер не выбран, эти классы позволяют всей системе работать
// end-to-end на заглушечных данных.

public class SpeechToTextClient : ISpeechToTextService
{
    private readonly HttpClient _httpClient;
    public SpeechToTextClient(HttpClient httpClient) => _httpClient = httpClient;

    public async Task<string> TranscribeAsync(Stream audioStream, CancellationToken ct = default)
    {
        // TODO: отправить audioStream в STT-провайдера, вернуть распознанный текст.
        // Пример структуры вызова (раскомментировать и адаптировать под провайдера):
        //
        // using var content = new MultipartFormDataContent();
        // content.Add(new StreamContent(audioStream), "file", "question.wav");
        // var response = await _httpClient.PostAsync("https://stt-provider/transcribe", content, ct);
        // var result = await response.Content.ReadFromJsonAsync<SttResponse>(cancellationToken: ct);
        // return result!.Text;

        await Task.Delay(1, ct); // placeholder, чтобы метод оставался async
        throw new NotImplementedException("Подключите STT-провайдера здесь.");
    }
}

public class TextToSpeechClient : ITextToSpeechService
{
    private readonly HttpClient _httpClient;
    public TextToSpeechClient(HttpClient httpClient) => _httpClient = httpClient;

    public async Task<string> SynthesizeAsync(string text, CancellationToken ct = default)
    {
        // TODO: отправить текст в TTS-провайдера, сохранить полученное аудио
        // (например, в S3-совместимое хранилище) и вернуть публичный URL.
        await Task.Delay(1, ct);
        throw new NotImplementedException("Подключите TTS-провайдера здесь.");
    }
}

public class AiClient : IAiClient
{
    private readonly HttpClient _httpClient;
    public AiClient(HttpClient httpClient) => _httpClient = httpClient;

    public async Task<string> AnswerQuestionAsync(string contextText, string questionText, CancellationToken ct = default)
    {
        // TODO: вызов вашего AI. contextText — текст слайда (что уже рассказано),
        // questionText — вопрос студента. Собираете промпт и отправляете.
        await Task.Delay(1, ct);
        throw new NotImplementedException("Подключите вызов вашего AI здесь.");
    }
}
