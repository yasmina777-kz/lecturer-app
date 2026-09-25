using System.Security;
using System.Text;
using System.Text.RegularExpressions;
namespace Lecturer.Api.Services;
public class SpeechService(HttpClient client, IConfiguration config)
{
    public bool Available => !string.IsNullOrWhiteSpace(config["AZURE_SPEECH_KEY"]) && !string.IsNullOrWhiteSpace(config["AZURE_SPEECH_REGION"]);
    public static string VoiceName(string language, string gender) => (language, gender) switch {
        ("kk", "female") => "kk-KZ-AigulNeural", ("kk", _) => "kk-KZ-DauletNeural",
        ("en", "female") => "en-US-JennyNeural", ("en", _) => "en-US-GuyNeural",
        (_, "female") => "ru-RU-SvetlanaNeural", _ => "ru-RU-DmitryNeural"
    };
    public async Task<byte[]> Speak(string text, string language, string gender, CancellationToken ct)
    {
        if (!Available) throw new ServiceException(503, "Облачный голос не подключён. Добавьте ключ и регион Azure Speech на сервере.");
        var region = config["AZURE_SPEECH_REGION"]!;
        if (!Regex.IsMatch(region, "^[a-z0-9-]+$")) throw new ServiceException(503, "Проверьте регион Azure Speech.");
        var voice = VoiceName(language, gender);
        var locale = language switch { "en" => "en-US", "kk" => "kk-KZ", _ => "ru-RU" };
        using var request = new HttpRequestMessage(HttpMethod.Post, $"https://{region}.tts.speech.microsoft.com/cognitiveservices/v1");
        request.Headers.Add("Ocp-Apim-Subscription-Key", config["AZURE_SPEECH_KEY"]);
        request.Headers.Add("X-Microsoft-OutputFormat", "audio-24khz-48kbitrate-mono-mp3");
        request.Headers.UserAgent.ParseAdd("LecturerApp/1.0");
        request.Content = new StringContent($"<speak version='1.0' xml:lang='{locale}'><voice name='{voice}'>{SecurityElement.Escape(text)}</voice></speak>", Encoding.UTF8, "application/ssml+xml");
        using var response = await client.SendAsync(request, ct);
        if (!response.IsSuccessStatusCode) throw new ServiceException(502, "Голосовой сервис недоступен. Проверьте ключ, регион и лимит Azure Speech.");
        return await response.Content.ReadAsByteArrayAsync(ct);
    }
}
