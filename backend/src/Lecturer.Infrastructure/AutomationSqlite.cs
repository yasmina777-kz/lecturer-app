namespace Lecturer.Infrastructure;
public static class AutomationSqlite
{
    public const string Sql = """
    CREATE TABLE IF NOT EXISTS "Courses" ("Id" TEXT PRIMARY KEY NOT NULL, "OwnerId" TEXT NOT NULL REFERENCES "Users"("Id") ON DELETE CASCADE, "Title" TEXT NOT NULL, "Goal" TEXT NOT NULL, "Language" TEXT NOT NULL, "Level" TEXT NOT NULL, "SourceText" TEXT NOT NULL, "SourceNames" TEXT NOT NULL, "StartAt" TEXT NOT NULL, "EndAt" TEXT NOT NULL, "CreatedAt" TEXT NOT NULL, "IsPublished" INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS "IX_Courses_OwnerId" ON "Courses"("OwnerId");
    CREATE TABLE IF NOT EXISTS "CourseModules" ("Id" TEXT PRIMARY KEY NOT NULL, "CourseId" TEXT NOT NULL REFERENCES "Courses"("Id") ON DELETE CASCADE, "OrderIndex" INTEGER NOT NULL, "Title" TEXT NOT NULL, "Objective" TEXT NOT NULL, "Minutes" INTEGER NOT NULL, "DueAt" TEXT NOT NULL, "LectureId" TEXT NULL REFERENCES "Lectures"("Id") ON DELETE SET NULL, "LeaseId" TEXT NULL, "LeaseUntil" TEXT NULL, "Error" TEXT NOT NULL);
    CREATE UNIQUE INDEX IF NOT EXISTS "IX_CourseModules_CourseId_OrderIndex" ON "CourseModules"("CourseId","OrderIndex");
    CREATE INDEX IF NOT EXISTS "IX_CourseModules_LectureId" ON "CourseModules"("LectureId");
    CREATE TABLE IF NOT EXISTS "Remediations" ("Id" TEXT PRIMARY KEY NOT NULL, "UserId" TEXT NOT NULL REFERENCES "Users"("Id") ON DELETE CASCADE, "LectureId" TEXT NOT NULL REFERENCES "Lectures"("Id") ON DELETE CASCADE, "QuestionIndex" INTEGER NOT NULL, "ContentJson" TEXT NOT NULL, "CreatedAt" TEXT NOT NULL, "ResolvedAt" TEXT NULL, "Attempts" INTEGER NOT NULL);
    CREATE UNIQUE INDEX IF NOT EXISTS "IX_Remediations_UserId_LectureId_QuestionIndex" ON "Remediations"("UserId","LectureId","QuestionIndex");
    CREATE INDEX IF NOT EXISTS "IX_Remediations_LectureId" ON "Remediations"("LectureId");
    CREATE TABLE IF NOT EXISTS "AutomationSettings" ("Id" INTEGER PRIMARY KEY NOT NULL, "MonthlyTokens" INTEGER NOT NULL, "MonthlyRequests" INTEGER NOT NULL, "MonthlySpeechCharacters" INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS "BudgetPeriods" ("Id" TEXT PRIMARY KEY NOT NULL, "Tokens" INTEGER NOT NULL, "Requests" INTEGER NOT NULL, "SpeechCharacters" INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS "SpeechCache" ("Id" TEXT PRIMARY KEY NOT NULL, "UserId" TEXT NOT NULL REFERENCES "Users"("Id") ON DELETE CASCADE, "Audio" BLOB NOT NULL, "CreatedAt" TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS "IX_SpeechCache_UserId" ON "SpeechCache"("UserId");
    CREATE INDEX IF NOT EXISTS "IX_SpeechCache_CreatedAt" ON "SpeechCache"("CreatedAt");
    """;
}
