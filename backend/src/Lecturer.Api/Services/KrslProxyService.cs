using System.Net.Http.Headers;

namespace Lecturer.Api.Services;

/// <summary>Server-to-server proxy for the separately hosted KRSL inference service.</summary>
public sealed class KrslProxyService
{
    private readonly HttpClient client;
    private readonly Uri? serviceUri;
    private readonly string? serviceToken;
    private readonly bool privateVercelBinding;

    public KrslProxyService(HttpClient client, IConfiguration configuration, IWebHostEnvironment environment)
    {
        this.client = client;
        var bindingUrl = configuration["KRSL_PRIVATE_SERVICE_URL"];
        privateVercelBinding = configuration.GetValue<bool>("Hosting:Vercel") &&
            !string.IsNullOrWhiteSpace(bindingUrl) &&
            string.IsNullOrWhiteSpace(configuration["Krsl:ServiceUrl"]);
        serviceUri = BuildUri(configuration, environment, bindingUrl);
        serviceToken = configuration["Krsl:ServiceToken"];
        var hasToken = !string.IsNullOrWhiteSpace(configuration["Krsl:ServiceToken"]);
        if (environment.IsProduction() && serviceUri is not null && !hasToken && !privateVercelBinding)
            throw new InvalidOperationException("Configure Krsl:ServiceToken for the external KRSL service.");
        if (hasToken && System.Text.Encoding.UTF8.GetByteCount(configuration["Krsl:ServiceToken"]!) < 32)
            throw new InvalidOperationException("Krsl:ServiceToken must be at least 32 UTF-8 bytes.");
    }

    public bool IsConfigured => serviceUri is not null &&
        (!string.IsNullOrWhiteSpace(serviceToken) || privateVercelBinding);

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
        if (!string.IsNullOrWhiteSpace(serviceToken))
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", serviceToken);
        request.Headers.Add("X-KRSL-Client", "platform");
        return request;
    }

    private static Uri? BuildUri(IConfiguration configuration, IWebHostEnvironment environment, string? bindingUrl)
    {
        var raw = configuration["Krsl:ServiceUrl"] ?? bindingUrl;
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
