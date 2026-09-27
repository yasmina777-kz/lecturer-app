using System.Security;
using System.Text;
using System.Text.RegularExpressions;
using System.Security.Cryptography;
using Lecturer.Core.Entities;
using Lecturer.Infrastructure;
using Microsoft.EntityFrameworkCore;
namespace Lecturer.Api.Services;
public class SpeechService(HttpClient client, IConfiguration config, AppDbContext db, UsageBudget budget)
{
    public bool Available => !string.IsNullOrWhiteSpace(config["AZURE_SPEECH_KEY"]) && !string.IsNullOrWhiteSpace(config["AZURE_SPEECH_REGION"]);
    public static string VoiceName(string language, string gender) => (language, gender) switch {
        ("kk", "female") => "kk-KZ-AigulNeural", ("kk", _) => "kk-KZ-DauletNeural",
        ("en", "female") => "en-US-JennyNeural", ("en", _) => "en-US-GuyNeural",
        (_, "female") => "ru-RU-SvetlanaNeural", _ => "ru-RU-DmitryNeural"
    };
    public async Task<byte[]> Speak(string text, string language, string gender, Guid uid, CancellationToken ct)
    {
        if (!Available) throw new ServiceException(503, "Облачный голос не подключён. Добавьте ключ и регион Azure Speech на сервере.");
        var region = config["AZURE_SPEECH_REGION"]!;
        if (!Regex.IsMatch(region, "^[a-z0-9-]+$")) throw new ServiceException(503, "Проверьте регион Azure Speech.");
        var voice = VoiceName(language, gender);
        var cacheId = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes($"{uid}|{region}|{voice}|audio-24khz-48kbitrate-mono-mp3|{text}")));
        var cutoff = DateTime.UtcNow.AddDays(-30);
        var cached = await db.SpeechCache.AsNoTracking().FirstOrDefaultAsync(c => c.Id == cacheId && c.CreatedAt >= cutoff, ct);
        if (cached != null) return cached.Audio;
        await budget.Reserve(0, text.Length, ct);
        var usage = new AiUsage { UserId = uid, Operation = "speech", Model = voice };
        db.AiUsage.Add(usage); await db.SaveChangesAsync(ct);
        try {
        var locale = language switch { "en" => "en-US", "kk" => "kk-KZ", _ => "ru-RU" };
        using var request = new HttpRequestMessage(HttpMethod.Post, $"https://{region}.tts.speech.microsoft.com/cognitiveservices/v1");
        request.Headers.Add("Ocp-Apim-Subscription-Key", config["AZURE_SPEECH_KEY"]);
        request.Headers.Add("X-Microsoft-OutputFormat", "audio-24khz-48kbitrate-mono-mp3");
        request.Headers.UserAgent.ParseAdd("LecturerApp/1.0");
        request.Content = new StringContent($"<speak version='1.0' xml:lang='{locale}'><voice name='{voice}'>{SecurityElement.Escape(text)}</voice></speak>", Encoding.UTF8, "application/ssml+xml");
        using var response = await client.SendAsync(request, ct);
        if (!response.IsSuccessStatusCode) throw new ServiceException(502, "Голосовой сервис недоступен. Проверьте ключ, регион и лимит Azure Speech.");
        var audio = await response.Content.ReadAsByteArrayAsync(ct);
        usage.Status = "success"; await db.SaveChangesAsync(ct);
        // Cache failures must not discard audio that has already been paid for.
        if (audio.Length <= 1_000_000) {
            try {
                await db.SpeechCache.Where(c => c.CreatedAt < cutoff).ExecuteDeleteAsync(ct);
                await db.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO \"SpeechCache\" (\"Id\",\"UserId\",\"Audio\",\"CreatedAt\") VALUES ({cacheId},{uid},{audio},{DateTime.UtcNow}) ON CONFLICT (\"Id\") DO NOTHING", ct);
                var oldIds = await db.SpeechCache.Where(c => c.UserId == uid).OrderByDescending(c => c.CreatedAt).Skip(50).Select(c => c.Id).ToListAsync(ct);
                await db.SpeechCache.Where(c => oldIds.Contains(c.Id)).ExecuteDeleteAsync(ct);
            } catch (Exception e) when (e is not OperationCanceledException) { /* Next request can synthesize again. */ }
        }
        return audio;
        } catch { usage.Status = "provider_error"; throw; }
        finally { await db.SaveChangesAsync(CancellationToken.None); }
    }
}
