using Lecturer.Core.Entities;
using Lecturer.Infrastructure;
namespace Lecturer.Api.Services;
public static class LectureAccess
{
    public static IQueryable<Lecture> Readable(AppDbContext db, Guid uid, bool admin) => db.Lectures.Where(l =>
        admin || l.IsPublished || l.OwnerId == uid || db.GroupAssignments.Any(a => a.LectureId == l.Id &&
            db.GroupMembers.Any(m => m.GroupId == a.GroupId && m.UserId == uid)));
}
