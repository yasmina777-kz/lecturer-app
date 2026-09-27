namespace Lecturer.Api.Services;
public static class AiPricing
{
    // Standard OpenAI rates checked 2026-09-25. Unknown models/providers have no inferred price.
    public static double? Cost(string model, long? input, long? cached, long? output, IConfiguration config)
    {
        if (input == null || output == null) return null;
        var rates = Rates(model, config);
        return rates == null ? null : ((input.Value - (cached ?? 0)) * rates.Value.Input + (cached ?? 0) * rates.Value.Cached + output.Value * rates.Value.Output) / 1_000_000;
    }
    public static (double Input, double Cached, double Output)? Rates(string model, IConfiguration config)
    {
        if (double.TryParse(config["AI:InputUsdPerMillion"], System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var i) &&
            double.TryParse(config["AI:OutputUsdPerMillion"], System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var o) && i >= 0 && o >= 0)
            return (i, config.GetValue<double?>("AI:CachedUsdPerMillion") ?? i, o);
        var host = new Uri(config["AI:BaseUrl"] ?? "https://api.openai.com/v1/").Host;
        return host == "api.openai.com" && (model == "gpt-4o-mini" || model == "gpt-4o-mini-2024-07-18") ? (.15, .075, .60) : null;
    }
    public static int SlideCount(int minutes) => (int)Math.Ceiling(minutes / 2d);
    public static int Words(string text) => System.Text.RegularExpressions.Regex.Matches(text, @"\S+").Count;
    public static object Estimate(int minutes, int materialCharacters, string language, string model, IConfiguration config)
    {
        var slides = SlideCount(minutes);
        var calls = 1 + (int)Math.Ceiling(slides / 3d) + (materialCharacters > 0 ? 1 : 0);
        // Planning + repeated extracted source + outline for each batch; script at ~110 words/min.
        var materialTokens = materialCharacters / (language == "en" ? 4d : 2.5d);
        var input = (long)Math.Ceiling(calls * (1400 + materialTokens + slides * 80) + (materialCharacters > 0 ? minutes * 110 * (language == "en" ? 1.5 : 2.5) : 0));
        var output = (long)Math.Ceiling(minutes * 110 * (language == "en" ? 1.5 : 2.5) + slides * 220 + 1500);
        return new { minutes, slides, calls, inputTokensLow = (long)(input * .7), inputTokensHigh = (long)(input * 1.5), outputTokensLow = (long)(output * .8), outputTokensHigh = (long)(output * 1.4), costLow = Cost(model, (long)(input * .7), 0, (long)(output * .8), config), costHigh = Cost(model, (long)(input * 1.5), 0, (long)(output * 1.4), config), model };
    }
}
