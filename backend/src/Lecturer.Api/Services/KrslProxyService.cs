using System.Net.Http.Headers;

namespace Lecturer.Api.Services;

/// <summary>Server-to-server proxy for the separately hosted KRSL inference service.</summary>
public sealed class KrslProxyService
{
    private readonly HttpClient client;
    private readonly Uri? serviceUri;
    private readonly string? serviceToken;

    public KrslProxyService(HttpClient client, IConfiguration configuration, IWebHostEnvironment environment)
    {
        this.client = client;
        serviceUri = BuildUri(configuration, environment);
        serviceToken = configuration["Krsl:ServiceToken"];
        var hasUrl = !string.IsNullOrWhiteSpace(configuration["Krsl:ServiceUrl"]);
        var hasToken = !string.IsNullOrWhiteSpace(configuration["Krsl:ServiceToken"]);
        if (environment.IsProduction() && hasUrl != hasToken)
            throw new InvalidOperationException("Configure both Krsl:ServiceUrl and Krsl:ServiceToken, or leave both empty.");
        if (hasToken && System.Text.Encoding.UTF8.GetByteCount(configuration["Krsl:ServiceToken"]!) < 32)
            throw new InvalidOperationException("Krsl:ServiceToken must be at least 32 UTF-8 bytes.");
    }

    public bool IsConfigured => serviceUri is not null && !string.IsNullOrWhiteSpace(serviceToken);

    public async Task<HttpResponseMessage?> GetStatusAsync(CancellationToken cancellationToken)
    {
        if (!IsConfigured) return null;
        using var request = CreateRequest(HttpMethod.Get, "api/krsl/status");
        return await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
    }

    public async Task<HttpResponseMessage?> RecognizeAsync(Stream video, string contentType, CancellationToken cancellationToken)
    {
        if (!IsConfigured) return null;
        using var request = CreateRequest(HttpMethod.Post, "api/krsl/recognize");
        request.Content = new StreamContent(video);
        request.Content.Headers.ContentType = MediaTypeHeaderValue.Parse(contentType);
        return await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
    }

    private HttpRequestMessage CreateRequest(HttpMethod method, string path)
    {
        var request = new HttpRequestMessage(method, new Uri(serviceUri!, path));
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", serviceToken);
        request.Headers.Add("X-KRSL-Client", "platform");
        return request;
    }

    private static Uri? BuildUri(IConfiguration configuration, IWebHostEnvironment environment)
    {
        var raw = configuration["Krsl:ServiceUrl"];
        if (string.IsNullOrWhiteSpace(raw)) return null;
        if (!Uri.TryCreate(raw.TrimEnd('/') + "/", UriKind.Absolute, out var uri) ||
            uri.Scheme is not ("http" or "https"))
            throw new InvalidOperationException("Krsl:ServiceUrl must be an absolute HTTP(S) URL.");
        var privateContainerHop = uri.Host is "krsl" or "localhost" || uri.IsLoopback;
        if ((environment.IsProduction() || configuration.GetValue<bool>("Hosting:Vercel")) &&
            uri.Scheme != Uri.UriSchemeHttps && !privateContainerHop)
            throw new InvalidOperationException("Krsl:ServiceUrl must use HTTPS in production.");
        return uri;
    }
}
