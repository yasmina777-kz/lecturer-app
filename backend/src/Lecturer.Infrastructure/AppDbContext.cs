using Lecturer.Core.Entities;
using Microsoft.EntityFrameworkCore;

namespace Lecturer.Infrastructure;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Lecture> Lectures => Set<Lecture>();
    public DbSet<Slide> Slides => Set<Slide>();
    public DbSet<Question> Questions => Set<Question>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Lecture 1 --- N Slide
        modelBuilder.Entity<Lecture>()
            .HasMany(l => l.Slides)
            .WithOne()
            .HasForeignKey(s => s.LectureId)
            .OnDelete(DeleteBehavior.Cascade);

        // Слайды упорядочены по OrderIndex — пригодится при выдаче лекции целиком
        modelBuilder.Entity<Slide>()
            .HasIndex(s => new { s.LectureId, s.OrderIndex });

        modelBuilder.Entity<Question>()
            .HasIndex(q => q.LectureId);
    }
}
