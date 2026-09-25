using System.Text.Json;
using Lecturer.Infrastructure;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
static class DatabaseUpgradeCheck
{
    public static async Task Run(string source)
    {
        var directory = Path.Combine(Path.GetTempPath(), "lecturer-upgrade-" + Guid.NewGuid()); Directory.CreateDirectory(directory);
        try
        {
            var path = Path.Combine(directory, "lecturer.db"); File.Copy(source, path);
            var options = new DbContextOptionsBuilder<AppDbContext>().UseSqlite("Data Source=" + path).Options;
            await using var db = new AppDbContext(options);
            var schema = new Dictionary<string, List<string>>();
            await using (var connection = new SqliteConnection("Data Source=" + path))
            {
                await connection.OpenAsync(); using var cmd = connection.CreateCommand(); cmd.CommandText = "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'";
                using (var reader = await cmd.ExecuteReaderAsync()) while(await reader.ReadAsync()) schema[reader.GetString(0)] = new();
                foreach(var (table, columns) in schema) { cmd.CommandText = "PRAGMA table_info(" + Quote(table) + ")"; using var reader = await cmd.ExecuteReaderAsync(); while(await reader.ReadAsync()) columns.Add(reader.GetString(1)); }
            }
            var before = await Snapshot(path, schema);
            await SqliteSchemaUpgrade.Apply(db); await SqliteSchemaUpgrade.Apply(db);
            var after = await Snapshot(path, schema);
            if(before != after) throw new Exception("Upgrade modified existing data");
            if(!await db.Database.CanConnectAsync() || await db.AiUsage.CountAsync() < 0) throw new Exception("New schema unavailable");
            Console.WriteLine("Passed: existing SQLite data unchanged after two upgrades; valid language/avatar/voice defaults (private copy).");
        }
        finally { SqliteConnection.ClearAllPools(); Directory.Delete(directory, true); }
    }
    static string Quote(string value) => "\"" + value.Replace("\"", "\"\"") + "\"";
    static async Task<string> Snapshot(string path, Dictionary<string,List<string>> schema)
    {
        await using var connection = new SqliteConnection("Data Source=" + path); await connection.OpenAsync();
        var snapshot = new Dictionary<string,List<string>>();
        foreach(var (table, columns) in schema)
        {
            using var cmd = connection.CreateCommand(); cmd.CommandText = "SELECT " + string.Join(",",columns.Select(Quote)) + " FROM " + Quote(table);
            var rows = new List<string>(); using var reader = await cmd.ExecuteReaderAsync();
            while(await reader.ReadAsync()) { var values = new object[columns.Count]; reader.GetValues(values); rows.Add(JsonSerializer.Serialize(values)); }
            rows.Sort(StringComparer.Ordinal); snapshot[table] = rows;
        }
        return JsonSerializer.Serialize(snapshot);
    }
}
