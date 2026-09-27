using System.Net;
using System.Xml.Linq;
using Lecturer.Infrastructure;
using Lecturer.Core.Entities;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Lecturer.Api.Services;
using Microsoft.Extensions.Configuration;
if (args.Length == 1) await DatabaseUpgradeCheck.Run(args[0]);
if (TeachingPreferences.AvatarValid("ueavatar") || TeachingPreferences.VisibleAvatar("ueavatar", "female") != "classic-female" || TeachingPreferences.VisibleAvatar("ueavatar", "male") != "classic-male") throw new Exception("Vector avatar compatibility failed");
var expected = new Dictionary<(string, string), string> {
 [("ru","male")]="ru-RU-DmitryNeural", [("ru","female")]="ru-RU-SvetlanaNeural",
 [("en","male")]="en-US-GuyNeural", [("en","female")]="en-US-JennyNeural",
 [("kk","male")]="kk-KZ-DauletNeural", [("kk","female")]="kk-KZ-AigulNeural"
};
var handler = new CaptureHandler();
var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string,string?>{["AZURE_SPEECH_KEY"]="test-only-key",["AZURE_SPEECH_REGION"]="westeurope"}).Build();
await using var connection = new SqliteConnection("Data Source=:memory:"); await connection.OpenAsync();
await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(connection).Options);
await db.Database.EnsureCreatedAsync();
var uid = Guid.NewGuid(); db.Users.Add(new User { Id=uid, FullName="Test", Email="speech@example.test", PasswordHash="test-only" }); await db.SaveChangesAsync();
var budget = new UsageBudget(db);
var service = new SpeechService(new HttpClient(handler), config, db, budget);
foreach(var ((language,gender),voice) in expected) {
 const string text = "<voice> & Қазақша \"test\"";
 var result = await service.Speak(text, language, gender, uid, CancellationToken.None);
 var ssml = XDocument.Parse(handler.Body!);
 if(ssml.Root!.Element("voice")?.Attribute("name")?.Value != voice || ssml.Root.Element("voice")?.Value != text || result.Length != 3) throw new Exception("Voice mapping or SSML escaping failed");
}
var requestCount = handler.Calls;
await service.Speak("<voice> & Қазақша \"test\"", "en", "female", uid, CancellationToken.None);
if (handler.Calls != requestCount || await db.SpeechCache.CountAsync() != 6) throw new Exception("Speech cache missed");
var usageBefore = (await db.BudgetPeriods.AsNoTracking().SingleAsync()).Requests;
await db.AutomationSettings.ExecuteUpdateAsync(s=>s.SetProperty(x=>x.MonthlySpeechCharacters,0));
try { await service.Speak("Uncached speech", "en", "female", uid, CancellationToken.None); throw new Exception("Speech budget bypassed"); } catch(ServiceException e) when(e.Status==429) { }
if (handler.Calls != requestCount || (await db.BudgetPeriods.AsNoTracking().SingleAsync()).Requests != usageBefore) throw new Exception("Blocked speech reached provider");
await db.AutomationSettings.ExecuteUpdateAsync(s=>s.SetProperty(x=>x.MonthlySpeechCharacters,500000));
handler.Status = HttpStatusCode.Unauthorized;
try { await service.Speak("test","en","female",uid,CancellationToken.None); throw new Exception("Provider failure was not surfaced"); } catch(ServiceException e) when(e.Status == 502) { }
await AutomationChecks.Run();
Console.WriteLine("Passed: six cloud voices, SSML escaping, endpoint/headers, MP3 response, durable cache reuse, speech limits and provider error handling (mock transport).");
class CaptureHandler : HttpMessageHandler {
 public int Calls; public string? Body; public HttpStatusCode Status = HttpStatusCode.OK;
 protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request,CancellationToken ct) {
  if(request.RequestUri?.ToString()!="https://westeurope.tts.speech.microsoft.com/cognitiveservices/v1" || request.Headers.GetValues("Ocp-Apim-Subscription-Key").Single()!="test-only-key" || request.Headers.GetValues("X-Microsoft-OutputFormat").Single()!="audio-24khz-48kbitrate-mono-mp3") throw new Exception("Invalid request");
  Calls++; Body = await request.Content!.ReadAsStringAsync(ct);
  return new HttpResponseMessage(Status){Content=new ByteArrayContent(new byte[]{1,2,3})};
 }
}
