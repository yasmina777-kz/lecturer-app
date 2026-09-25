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
    public bool IsDisabled { get; set; }
    public string SecurityStamp { get; set; } = Guid.NewGuid().ToString();
    public string AvatarStyle { get; set; } = "sage";
    public string InterfaceLanguage { get; set; } = "ru";
    public string TeachingLanguage { get; set; } = "ru";
    public string AvatarId { get; set; } = "classic-male";
    public string VoiceGender { get; set; } = "male";
    public double SpeechRate { get; set; } = 1;
    public DateTime CreatedAt { get; set; }
}