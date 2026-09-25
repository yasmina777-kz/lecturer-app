namespace Lecturer.Api.Services;
public static class TeachingPreferences
{
    public static bool LanguageValid(string? value) => value is "ru" or "en" or "kk";
    public static bool AvatarValid(string? value) => value is "classic-male" or "classic-female";
    public static string VisibleAvatar(string value, string gender) => value == "ueavatar" ? (gender == "female" ? "classic-female" : "classic-male") : value;
    public static bool GenderValid(string? value) => value is "male" or "female";
    public static string LanguageName(string language) => language switch { "en" => "English", "kk" => "Kazakh (қазақ тілі)", _ => "Russian" };
}
