using System.ComponentModel.DataAnnotations;
namespace Lecturer.Core.DTOs;
public record RegisterDto(
    [Required, EmailAddress, MaxLength(254)] string Email,
    [Required, StringLength(64, MinimumLength = 8)] string Password,
    [Required, StringLength(80, MinimumLength = 2)] string FullName,
    string AccountType = "Student", string InterfaceLanguage = "ru", string TeachingLanguage = "ru",
    string AvatarId = "classic-male", string VoiceGender = "male");
public record LoginDto([Required, EmailAddress, MaxLength(254)] string Email, [Required, MaxLength(64)] string Password);
