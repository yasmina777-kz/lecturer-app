using Microsoft.EntityFrameworkCore;
namespace Lecturer.Infrastructure;
// Additive, idempotent upgrade for existing local databases created with EnsureCreated.
public static class SqliteSchemaUpgrade
{
    public static async Task Apply(AppDbContext db)
    {
        await db.Database.EnsureCreatedAsync();
        var connection = db.Database.GetDbConnection();
        await connection.OpenAsync();
        await using var transaction = await connection.BeginTransactionAsync();
        var columns = new Dictionary<string, Dictionary<string, string>> {
            ["Users"] = new() { ["InterfaceLanguage"] = "ru", ["TeachingLanguage"] = "ru", ["AvatarId"] = "classic-male", ["VoiceGender"] = "male" },
            ["Lectures"] = new() { ["Language"] = "ru", ["AvatarId"] = "classic-male", ["VoiceGender"] = "male", ["AvatarStyle"] = "sage", ["SourceText"] = "" }
        };
        foreach (var (table, fields) in columns)
        {
            var existing = new HashSet<string>();
            await using (var cmd = connection.CreateCommand())
            {
                cmd.Transaction = transaction; cmd.CommandText = $"PRAGMA table_info(\"{table}\")";
                await using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync()) existing.Add(reader.GetString(1));
            }
            foreach (var (field, value) in fields)
            {
                if (existing.Contains(field)) continue;
                await using var cmd = connection.CreateCommand(); cmd.Transaction = transaction;
                // Identifiers and defaults come only from the hard-coded schema above.
                cmd.CommandText = $"ALTER TABLE \"{table}\" ADD COLUMN \"{field}\" TEXT NOT NULL DEFAULT '{value}'";
                await cmd.ExecuteNonQueryAsync();
            }
        }
        await using (var cmd = connection.CreateCommand())
        {
            cmd.Transaction = transaction;
            cmd.CommandText = "PRAGMA table_info(\"Lectures\")";
            var names = new HashSet<string>();
            await using (var reader = await cmd.ExecuteReaderAsync()) while (await reader.ReadAsync()) names.Add(reader.GetString(1));
            if (!names.Contains("TargetMinutes")) { cmd.CommandText = "ALTER TABLE \"Lectures\" ADD COLUMN \"TargetMinutes\" INTEGER NOT NULL DEFAULT 0"; await cmd.ExecuteNonQueryAsync(); }
            cmd.CommandText = @"CREATE TABLE IF NOT EXISTS ""AiUsage"" (
                ""Id"" TEXT NOT NULL PRIMARY KEY, ""UserId"" TEXT NOT NULL, ""LectureId"" TEXT NULL, ""CreatedAt"" TEXT NOT NULL,
                ""Operation"" TEXT NOT NULL, ""Model"" TEXT NOT NULL, ""Status"" TEXT NOT NULL,
                ""InputTokens"" INTEGER NULL, ""CachedTokens"" INTEGER NULL, ""OutputTokens"" INTEGER NULL,
                ""EstimatedUsd"" REAL NULL, ""AudioSeconds"" REAL NULL);
                CREATE INDEX IF NOT EXISTS ""IX_AiUsage_CreatedAt"" ON ""AiUsage"" (""CreatedAt"");
                CREATE INDEX IF NOT EXISTS ""IX_AiUsage_LectureId"" ON ""AiUsage"" (""LectureId"");";
            await cmd.ExecuteNonQueryAsync();
        }
        await using (var cmd = connection.CreateCommand())
        {
            cmd.Transaction = transaction;
            cmd.CommandText = @"
                CREATE TABLE IF NOT EXISTS ""StudyGroups"" (""Id"" TEXT NOT NULL PRIMARY KEY, ""OwnerId"" TEXT NOT NULL REFERENCES ""Users""(""Id"") ON DELETE CASCADE, ""Name"" TEXT NOT NULL, ""JoinCode"" TEXT NOT NULL, ""CreatedAt"" TEXT NOT NULL);
                CREATE UNIQUE INDEX IF NOT EXISTS ""IX_StudyGroups_JoinCode"" ON ""StudyGroups""(""JoinCode"");
                CREATE INDEX IF NOT EXISTS ""IX_StudyGroups_OwnerId"" ON ""StudyGroups""(""OwnerId"");
                CREATE TABLE IF NOT EXISTS ""GroupMembers"" (""GroupId"" TEXT NOT NULL REFERENCES ""StudyGroups""(""Id"") ON DELETE CASCADE, ""UserId"" TEXT NOT NULL REFERENCES ""Users""(""Id"") ON DELETE CASCADE, ""JoinedAt"" TEXT NOT NULL, PRIMARY KEY(""GroupId"", ""UserId""));
                CREATE INDEX IF NOT EXISTS ""IX_GroupMembers_UserId"" ON ""GroupMembers""(""UserId"");
                CREATE TABLE IF NOT EXISTS ""GroupAssignments"" (""GroupId"" TEXT NOT NULL REFERENCES ""StudyGroups""(""Id"") ON DELETE CASCADE, ""LectureId"" TEXT NOT NULL REFERENCES ""Lectures""(""Id"") ON DELETE CASCADE, ""AssignedAt"" TEXT NOT NULL, ""DueAt"" TEXT NULL, PRIMARY KEY(""GroupId"", ""LectureId""));
                CREATE INDEX IF NOT EXISTS ""IX_GroupAssignments_LectureId"" ON ""GroupAssignments""(""LectureId"");
                CREATE TABLE IF NOT EXISTS ""QuizAttempts"" (""Id"" TEXT NOT NULL PRIMARY KEY, ""UserId"" TEXT NOT NULL REFERENCES ""Users""(""Id"") ON DELETE CASCADE, ""LectureId"" TEXT NOT NULL REFERENCES ""Lectures""(""Id"") ON DELETE CASCADE, ""Score"" INTEGER NOT NULL, ""CreatedAt"" TEXT NOT NULL);
                CREATE INDEX IF NOT EXISTS ""IX_QuizAttempts_UserId_CreatedAt"" ON ""QuizAttempts""(""UserId"", ""CreatedAt"");
                CREATE INDEX IF NOT EXISTS ""IX_QuizAttempts_LectureId"" ON ""QuizAttempts""(""LectureId"");";
            await cmd.ExecuteNonQueryAsync();
        }
        await using (var cmd = connection.CreateCommand()) {
            cmd.Transaction = transaction; cmd.CommandText = AutomationSqlite.Sql;
            await cmd.ExecuteNonQueryAsync();
        }
        await transaction.CommitAsync(); await connection.CloseAsync();
    }
}
