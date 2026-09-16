using Lecturer.Core.Entities;

namespace Lecturer.Core.DTOs;

public record RegisterDto(string Email, string Password, string FullName, UserRole Role);
public record LoginDto(string Email, string Password);