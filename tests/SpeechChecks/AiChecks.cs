using System.Net;
using Lecturer.Api.Services;
using Lecturer.Infrastructure;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

internal static class AiChecks
{
    public static async Task Run()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(connection).Options);
        await db.Database.EnsureCreatedAsync();
        var handler = new ReplyHandler();
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
            { ["AI:ApiKey"] = "test-only", ["AI:Model"] = "test-model" }).Build();
        var client = new HttpClient(handler) { BaseAddress = new Uri("https://fixture.invalid/v1/") };
        var service = new AiService(client, config, db, new UsageBudget(db));
        foreach (var reply in new[] { "{}", "{\"choices\":[]}", "{\"choices\":{}}",
            "{\"choices\":[{\"message\":{\"content\":null}}]}",
            "{\"choices\":[{\"finish_reason\":\"length\",\"message\":{\"content\":\"partial\"}}]}" })
        {
            handler.Body = reply;
            try
            {
                await service.Answer("lesson", "question", "ru", Guid.NewGuid(), Guid.NewGuid(), CancellationToken.None);
                throw new Exception("Incomplete AI reply was accepted");
            }
            catch (ServiceException error) when (error.Status == 502) { }
        }
        if (await db.AiUsage.CountAsync(row => row.Status == "invalid_response") != 5)
            throw new Exception("Malformed AI replies must be recorded as invalid_response");
        handler.Body = "{\"choices\":[{\"finish_reason\":\"stop\",\"message\":{\"content\":\"Объяснение\"}}]}";
        var answer = await service.Answer("lesson", "question", "ru", Guid.NewGuid(), Guid.NewGuid(), CancellationToken.None);
        if (answer != "Объяснение" || await db.AiUsage.CountAsync(row => row.Status == "success") != 1)
            throw new Exception("Valid AI reply failed");
        Console.WriteLine("Passed: incomplete/empty AI responses return 502, usage status persists, valid completion succeeds (mock transport).");
    }

    private sealed class ReplyHandler : HttpMessageHandler
    {
        public string Body = "{}";
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
            => Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(Body) });
    }
}
