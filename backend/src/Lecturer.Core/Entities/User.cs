namespace Lecturer.Core.Entities;

public enum UserRole
{
    Admin,
    Lecturer,
    Student
}

public class User
{
    public Guid Id { get; set; }
    public string Email { get; set; } = null!;
    public string PasswordHash { get; set; } = null!;
    public string FullName { get; set; } = null!;
    public UserRole Role { get; set; }
    public DateTime CreatedAt { get; set; }
}