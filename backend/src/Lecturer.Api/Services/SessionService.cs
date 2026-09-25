using System.Security.Claims;
using System.IdentityModel.Tokens.Jwt;
using System.Text;
using Lecturer.Core.Entities;
using Microsoft.IdentityModel.Tokens;

namespace Lecturer.Api.Services;
public class SessionService(IConfiguration config)
{
    public void SignIn(HttpContext context, User user)
    {
        var token = new JwtSecurityToken(issuer: "lecturer-app", audience: "lecturer-app",
            claims: new[] { new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()), new Claim("stamp", user.SecurityStamp) },
            expires: DateTime.UtcNow.AddDays(7),
            signingCredentials: new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config["Jwt:Key"]!)), SecurityAlgorithms.HmacSha256));
        context.Response.Cookies.Append("lecturer_session", new JwtSecurityTokenHandler().WriteToken(token),
            new CookieOptions { HttpOnly = true, Secure = context.Request.IsHttps, SameSite = SameSiteMode.Strict, Path = "/", MaxAge = TimeSpan.FromDays(7) });
    }
    public static object Profile(User user) => new { user.Id, user.Email, user.FullName, Role = user.Role.ToString(), user.AvatarStyle, AvatarId = TeachingPreferences.VisibleAvatar(user.AvatarId, user.VoiceGender), user.VoiceGender, user.InterfaceLanguage, user.TeachingLanguage, user.SpeechRate, user.CreatedAt };
    public static Guid UserId(ClaimsPrincipal user) => Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
}
