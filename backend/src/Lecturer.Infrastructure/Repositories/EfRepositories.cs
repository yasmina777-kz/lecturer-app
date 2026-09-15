using Lecturer.Core.Entities;
using Lecturer.Core.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Lecturer.Infrastructure.Repositories;

public class LectureRepository : ILectureRepository
{
    private readonly AppDbContext _db;
    public LectureRepository(AppDbContext db) => _db = db;

    public async Task<Lecture?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        // Include подтягивает слайды сразу, одним запросом, отсортированные для показа
        return await _db.Lectures
            .Include(l => l.Slides.OrderBy(s => s.OrderIndex))
            .FirstOrDefaultAsync(l => l.Id == id, ct);
    }

    public async Task<Slide?> GetSlideAsync(Guid slideId, CancellationToken ct = default)
    {
        return await _db.Slides.FirstOrDefaultAsync(s => s.Id == slideId, ct);
    }
}

public class QuestionRepository : IQuestionRepository
{
    private readonly AppDbContext _db;
    public QuestionRepository(AppDbContext db) => _db = db;

    public async Task AddAsync(Question question, CancellationToken ct = default)
    {
        _db.Questions.Add(question);
        await _db.SaveChangesAsync(ct);
    }
}
