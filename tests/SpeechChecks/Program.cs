using System.Net;
using System.Xml.Linq;
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
var service = new SpeechService(new HttpClient(handler), config);
foreach(var ((language,gender),voice) in expected) {
 const string text = "<voice> & Қазақша \"test\"";
 var result = await service.Speak(text, language, gender, CancellationToken.None);
 var ssml = XDocument.Parse(handler.Body!);
 if(ssml.Root!.Element("voice")?.Attribute("name")?.Value != voice || ssml.Root.Element("voice")?.Value != text || result.Length != 3) throw new Exception("Voice mapping or SSML escaping failed");
}
handler.Status = HttpStatusCode.Unauthorized;
try { await service.Speak("test","en","female",CancellationToken.None); throw new Exception("Provider failure was not surfaced"); } catch(ServiceException e) when(e.Status == 502) { }
Console.WriteLine("Passed: six cloud voices, SSML escaping, endpoint/headers, MP3 response and provider error handling (mock transport).");
class CaptureHandler : HttpMessageHandler {
 public string? Body; public HttpStatusCode Status = HttpStatusCode.OK;
 protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request,CancellationToken ct) {
  if(request.RequestUri?.ToString()!="https://westeurope.tts.speech.microsoft.com/cognitiveservices/v1" || request.Headers.GetValues("Ocp-Apim-Subscription-Key").Single()!="test-only-key" || request.Headers.GetValues("X-Microsoft-OutputFormat").Single()!="audio-24khz-48kbitrate-mono-mp3") throw new Exception("Invalid request");
  Body = await request.Content!.ReadAsStringAsync(ct);
  return new HttpResponseMessage(Status){Content=new ByteArrayContent(new byte[]{1,2,3})};
 }
}
