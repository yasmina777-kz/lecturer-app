using Lecturer.Core.Entities;
using Microsoft.EntityFrameworkCore;

namespace Lecturer.Infrastructure;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Course> Courses => Set<Course>();
    public DbSet<CourseModule> CourseModules => Set<CourseModule>();
    public DbSet<Remediation> Remediations => Set<Remediation>();
    public DbSet<AutomationSettings> AutomationSettings => Set<AutomationSettings>();
    public DbSet<BudgetPeriod> BudgetPeriods => Set<BudgetPeriod>();
    public DbSet<SpeechCache> SpeechCache => Set<SpeechCache>();
    public DbSet<StudyGroup> StudyGroups => Set<StudyGroup>();
    public DbSet<GroupMember> GroupMembers => Set<GroupMember>();
    public DbSet<GroupAssignment> GroupAssignments => Set<GroupAssignment>();
    public DbSet<QuizAttempt> QuizAttempts => Set<QuizAttempt>();
    public DbSet<AiUsage> AiUsage => Set<AiUsage>();
    public DbSet<Lecture> Lectures => Set<Lecture>();
    public DbSet<Slide> Slides => Set<Slide>();
    public DbSet<Question> Questions => Set<Question>();
    public DbSet<User> Users => Set<User>();

    public DbSet<LearningProgress> Progress => Set<LearningProgress>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Course>().HasOne<User>().WithMany().HasForeignKey(c => c.OwnerId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<Course>().HasMany(c => c.Modules).WithOne().HasForeignKey(m => m.CourseId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<CourseModule>().HasOne<Lecture>().WithMany().HasForeignKey(m => m.LectureId).OnDelete(DeleteBehavior.SetNull);
        modelBuilder.Entity<CourseModule>().HasIndex(m => new { m.CourseId, m.OrderIndex }).IsUnique();
        modelBuilder.Entity<Remediation>().HasOne<User>().WithMany().HasForeignKey(r => r.UserId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<Remediation>().HasOne<Lecture>().WithMany().HasForeignKey(r => r.LectureId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<Remediation>().HasIndex(r => new { r.UserId, r.LectureId, r.QuestionIndex }).IsUnique();
        modelBuilder.Entity<SpeechCache>().HasOne<User>().WithMany().HasForeignKey(r => r.UserId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<SpeechCache>().HasIndex(r => r.CreatedAt);
        modelBuilder.Entity<StudyGroup>().HasIndex(g => g.JoinCode).IsUnique();
        modelBuilder.Entity<StudyGroup>().Property(g => g.Name).HasMaxLength(100);
        modelBuilder.Entity<StudyGroup>().HasOne<User>().WithMany().HasForeignKey(g => g.OwnerId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<GroupMember>().HasKey(m => new { m.GroupId, m.UserId });
        modelBuilder.Entity<GroupMember>().HasOne<StudyGroup>().WithMany().HasForeignKey(m => m.GroupId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<GroupMember>().HasOne<User>().WithMany().HasForeignKey(m => m.UserId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<GroupAssignment>().HasKey(a => new { a.GroupId, a.LectureId });
        modelBuilder.Entity<GroupAssignment>().HasOne<StudyGroup>().WithMany().HasForeignKey(a => a.GroupId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<GroupAssignment>().HasOne<Lecture>().WithMany().HasForeignKey(a => a.LectureId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<QuizAttempt>().HasIndex(a => new { a.UserId, a.CreatedAt });
        modelBuilder.Entity<QuizAttempt>().HasOne<User>().WithMany().HasForeignKey(a => a.UserId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<QuizAttempt>().HasOne<Lecture>().WithMany().HasForeignKey(a => a.LectureId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<AiUsage>().HasIndex(u => u.CreatedAt);
        modelBuilder.Entity<AiUsage>().HasIndex(u => u.LectureId);
        modelBuilder.Entity<LearningProgress>().HasKey(p => new { p.UserId, p.LectureId });
        modelBuilder.Entity<LearningProgress>().HasOne<User>().WithMany().HasForeignKey(p => p.UserId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<LearningProgress>().HasOne<Lecture>().WithMany().HasForeignKey(p => p.LectureId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<Lecture>()
            .HasMany(l => l.Slides)
            .WithOne()
            .HasForeignKey(s => s.LectureId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Slide>()
            .HasIndex(s => new { s.LectureId, s.OrderIndex });

        modelBuilder.Entity<Question>()
            .HasIndex(q => q.LectureId);

        modelBuilder.Entity<User>()
            .HasIndex(u => u.Email)
            .IsUnique();
    }
}