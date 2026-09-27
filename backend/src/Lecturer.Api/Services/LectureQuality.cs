using System.Text.Json;
using System.Text.RegularExpressions;
using Lecturer.Core.Entities;
namespace Lecturer.Api.Services;
public record QualityCheck(string Code, string Status, int Count = 0, int Total = 0, string? Detail = null);
public static class LectureQuality
{
    public static QualityCheck[] Check(Lecture l)
    {
        var checks = new List<QualityCheck>();
        checks.Add(new("slides", l.Slides.Count > 0 ? "pass" : "error", l.Slides.Count));
        var narrated = l.Slides.Count(s => AiPricing.Words(s.NarrationText) >= 40);
        checks.Add(new("narration", narrated == l.Slides.Count && narrated > 0 ? "pass" : "error", narrated, l.Slides.Count));
        var aligned = 0; var reviewNotes = new List<string>();
        var visual = 0; var evidence = 0; var valid = 0;
        var source = Normalize(l.SourceText);
        foreach (var slide in l.Slides)
        {
            try {
                using var json = JsonDocument.Parse(slide.ContentJson); var c = json.RootElement;
                if (c.TryGetProperty("title", out var title) && !string.IsNullOrWhiteSpace(title.GetString()) && c.TryGetProperty("bullets", out var b) && b.ValueKind == JsonValueKind.Array && b.GetArrayLength() > 0) valid++;
                if (c.TryGetProperty("visual", out var v) && v.ValueKind == JsonValueKind.Object && v.TryGetProperty("items", out var items) && items.ValueKind == JsonValueKind.Array && items.GetArrayLength() >= 2) visual++;
                if (c.TryGetProperty("sourceReview", out var review) && review.ValueKind == JsonValueKind.Object && review.TryGetProperty("status", out var status)) {
                    if (status.GetString() == "supported") aligned++;
                    else if (review.TryGetProperty("reason", out var reason)) reviewNotes.Add($"{slide.OrderIndex+1}: {reason.GetString()}");
                }
                if (c.TryGetProperty("evidence", out var e) && e.ValueKind == JsonValueKind.String) { var quote = Normalize(e.GetString() ?? ""); if (quote.Length >= 40 && source.Contains(quote, StringComparison.Ordinal)) evidence++; }
            } catch (Exception e) when (e is JsonException or InvalidOperationException) { }
        }
        checks.Add(new("structure", valid == l.Slides.Count && valid > 0 ? "pass" : "error", valid, l.Slides.Count));
        checks.Add(new("visuals", visual == l.Slides.Count && visual > 0 ? "pass" : "warning", visual, l.Slides.Count));
        var quiz = 0; var tasks = 0; var quizValid = false; var tasksValid = false;
        try {
            using var json = JsonDocument.Parse(l.ExercisesJson); var root = json.RootElement;
            if (root.TryGetProperty("quiz", out var q) && q.ValueKind == JsonValueKind.Array) { quiz = q.EnumerateArray().Count(ValidQuiz); quizValid = quiz > 0 && quiz == q.GetArrayLength(); }
            if (root.TryGetProperty("tasks", out var t) && t.ValueKind == JsonValueKind.Array) { tasks = t.EnumerateArray().Count(x => Text(x,"question") && Text(x,"answer")); tasksValid = tasks > 0 && tasks == t.GetArrayLength(); }
        } catch (Exception e) when (e is JsonException or InvalidOperationException) { }
        checks.Add(new("quiz", quizValid ? "pass" : "error", quiz));
        checks.Add(new("tasks", tasksValid ? "pass" : "error", tasks));
        checks.Add(new("summary", AiPricing.Words(l.Summary) >= 30 ? "pass" : "warning"));
        var minutes = (AiPricing.Words(l.Introduction) + l.Slides.Sum(s => AiPricing.Words(s.NarrationText))) / 110d;
        checks.Add(new("duration", l.TargetMinutes > 0 && Math.Abs(minutes - l.TargetMinutes) <= l.TargetMinutes * .3 ? "pass" : "warning", (int)Math.Round(minutes), l.TargetMinutes));
        checks.Add(new(source.Length == 0 ? "source_missing" : "source_quotes", source.Length > 0 && evidence == l.Slides.Count && evidence > 0 ? "pass" : "warning", evidence, l.Slides.Count));
        if (source.Length > 0) checks.Add(new("source_alignment", aligned == l.Slides.Count && aligned > 0 ? "pass" : "warning", aligned, l.Slides.Count, string.Join("\n", reviewNotes)));
        return checks.ToArray();
    }
    private static bool Text(JsonElement e, string key) => e.ValueKind == JsonValueKind.Object && e.TryGetProperty(key, out var v) && v.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(v.GetString());
    private static bool ValidQuiz(JsonElement q) => Text(q,"question") && Text(q,"explanation") && q.TryGetProperty("options", out var o) && o.ValueKind == JsonValueKind.Array && o.GetArrayLength() == 4 && o.EnumerateArray().All(v => v.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(v.GetString())) && q.TryGetProperty("correctIndex", out var i) && i.ValueKind == JsonValueKind.Number && i.TryGetInt32(out var n) && n >= 0 && n < 4;
    private static string Normalize(string s) => Regex.Replace(s, @"\s+", " ").Trim();
    public static void RequirePublishable(Lecture l, bool reviewed)
    {
        if (Check(l).Any(c => c.Status == "error")) throw new ServiceException(409, "Проверка качества обнаружила неполную лекцию. Откройте отчёт качества.");
        if (!reviewed) throw new ServiceException(409, "Проверьте содержание лекции и подтвердите проверку перед публикацией.");
    }
}
