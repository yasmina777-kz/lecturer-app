using Lecturer.Api.Services;
using Lecturer.Core.Entities;
using System.Text.Json;
static class AutomationChecks
{
    public static Task Run()
    {
        var source = "Практика помогает сохранять знания и применять их в новых ситуациях.";
        var l = new Lecture { TargetMinutes=5, SourceText=source, Summary=string.Join(" ",Enumerable.Repeat("Конспект",40)), ExercisesJson="{\"quiz\":[{\"question\":\"Test?\",\"options\":[\"A\",\"B\",\"C\",\"D\"],\"correctIndex\":0,\"explanation\":\"Because\"}],\"tasks\":[{\"question\":\"Try\",\"answer\":\"Example\"}]}", Slides=new() { new Slide { OrderIndex=0, NarrationText=string.Join(" ",Enumerable.Repeat("Текст",550)), ContentJson=JsonSerializer.Serialize(new { title="Тема", bullets=new[]{"Тезис"}, evidence=source, sourceReview=new{status="contradicted",reason="Утверждение противоречит материалу."}, visual=new {items=new[]{1,2}} }) } } };
        var checks = LectureQuality.Check(l);
        if(checks.Single(c=>c.Code=="source_quotes").Status!="pass" || checks.Single(c=>c.Code=="source_alignment").Status!="warning" || !checks.Single(c=>c.Code=="source_alignment").Detail!.Contains("противоречит")) throw new Exception("Semantic review warnings lost");
        try { LectureQuality.RequirePublishable(l,false); throw new Exception("Review was not required"); } catch(ServiceException e) when(e.Status==409) { }
        l.Slides.Clear();
        try { LectureQuality.RequirePublishable(l,true); throw new Exception("Empty lecture was publishable"); } catch(ServiceException e) when(e.Status==409) { }
        Console.WriteLine("Passed: source quote matching, semantic review warnings and publication gates.");
        return Task.CompletedTask;
    }
}
