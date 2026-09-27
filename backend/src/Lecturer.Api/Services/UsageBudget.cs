using Lecturer.Core.Entities;
using Lecturer.Infrastructure;
using Microsoft.EntityFrameworkCore;
namespace Lecturer.Api.Services;

// Atomic reservation in the shared database also covers overlapping Vercel instances.
public class UsageBudget(AppDbContext db)
{
    public async Task<AutomationSettings> Settings(CancellationToken ct)
    {
        await db.Database.ExecuteSqlRawAsync("INSERT INTO \"AutomationSettings\" (\"Id\",\"MonthlyTokens\",\"MonthlyRequests\",\"MonthlySpeechCharacters\") VALUES (1,1000000,2000,500000) ON CONFLICT (\"Id\") DO NOTHING", ct);
        return await db.AutomationSettings.AsNoTracking().SingleAsync(s => s.Id == 1, ct);
    }
    public async Task<string> Reserve(long tokens, long speechCharacters, CancellationToken ct)
    {
        var settings = await Settings(ct);
        var month = DateTime.UtcNow.ToString("yyyy-MM");
        var since = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        await db.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO \"BudgetPeriods\" (\"Id\",\"Tokens\",\"Requests\",\"SpeechCharacters\") SELECT {month},COALESCE(SUM(\"InputTokens\"),0)+COALESCE(SUM(\"OutputTokens\"),0),COUNT(*),0 FROM \"AiUsage\" WHERE \"CreatedAt\">={since} ON CONFLICT (\"Id\") DO NOTHING", ct);
        var ok = await db.BudgetPeriods.Where(b => b.Id == month && (tokens == 0 || b.Tokens + tokens <= settings.MonthlyTokens) && b.Requests + 1 <= settings.MonthlyRequests && (speechCharacters == 0 || b.SpeechCharacters + speechCharacters <= settings.MonthlySpeechCharacters))
            .ExecuteUpdateAsync(s => s.SetProperty(b => b.Tokens, b => b.Tokens + tokens).SetProperty(b => b.Requests, b => b.Requests + 1).SetProperty(b => b.SpeechCharacters, b => b.SpeechCharacters + speechCharacters), ct);
        if (ok == 0) throw new ServiceException(429, "Достигнут месячный лимит AI. Администратор может изменить лимиты в разделе автоматизации.");
        return month;
    }
    public Task Settle(string period, long reserved, long? actual) => actual.HasValue
        ? db.BudgetPeriods.Where(b => b.Id == period).ExecuteUpdateAsync(s => s.SetProperty(b => b.Tokens, b => b.Tokens + actual.Value - reserved))
        : Task.CompletedTask;
}
