using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Threading.RateLimiting;
using Lecturer.Api.Services;
using Lecturer.Core.Entities;
using Lecturer.Infrastructure;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);
var dataDir = Path.GetFullPath(builder.Configuration["DataDirectory"] ?? Path.Combine(builder.Environment.ContentRootPath, "App_Data"));
Directory.CreateDirectory(dataDir);
var signingKey = builder.Configuration["Jwt:Key"];
if (string.IsNullOrWhiteSpace(signingKey))
{
    var keyFile = Path.Combine(dataDir, "session.key");
    if (!File.Exists(keyFile))
    {
        File.WriteAllText(keyFile, Convert.ToBase64String(RandomNumberGenerator.GetBytes(64)));
        if (!OperatingSystem.IsWindows()) File.SetUnixFileMode(keyFile, UnixFileMode.UserRead | UnixFileMode.UserWrite);
    }
    signingKey = File.ReadAllText(keyFile).Trim(); builder.Configuration["Jwt:Key"] = signingKey;
}
if (Encoding.UTF8.GetByteCount(signingKey) < 32) throw new InvalidOperationException("Jwt:Key must contain at least 32 bytes.");
builder.Services.AddDbContext<AppDbContext>(o =>
{
    if (builder.Configuration["Database:Provider"] == "Postgres") o.UseNpgsql(builder.Configuration.GetConnectionString("Default"));
    else o.UseSqlite($"Data Source={Path.Combine(dataDir, "lecturer.db")}");
});
builder.Services.AddScoped<SessionService>();
builder.Services.AddHttpClient<SpeechService>(c => c.Timeout = TimeSpan.FromSeconds(40));
builder.Services.AddHttpClient<AiService>(c => { c.BaseAddress = new Uri((builder.Configuration["AI:BaseUrl"] ?? "https://api.openai.com/v1/").TrimEnd('/') + "/"); c.Timeout = TimeSpan.FromSeconds(150); });
builder.Services.AddControllers();
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(o =>
{
    o.TokenValidationParameters = new TokenValidationParameters { ValidateIssuer = true, ValidIssuer = "lecturer-app", ValidateAudience = true, ValidAudience = "lecturer-app", ValidateLifetime = true, ValidateIssuerSigningKey = true, IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKey)), ClockSkew = TimeSpan.FromSeconds(30) };
    o.Events = new JwtBearerEvents
    {
        OnMessageReceived = ctx => { ctx.Token = ctx.Request.Cookies["lecturer_session"]; return Task.CompletedTask; },
        OnTokenValidated = async ctx =>
        {
            var db = ctx.HttpContext.RequestServices.GetRequiredService<AppDbContext>();
            if (!Guid.TryParse(ctx.Principal?.FindFirstValue(ClaimTypes.NameIdentifier), out var id)) { ctx.Fail("Invalid session"); return; }
            var user = await db.Users.FindAsync(id);
            if (user == null || user.IsDisabled || user.SecurityStamp != ctx.Principal?.FindFirstValue("stamp")) { ctx.Fail("Session revoked"); return; }
            ((ClaimsIdentity)ctx.Principal!.Identity!).AddClaim(new Claim(ClaimTypes.Role, user.Role.ToString()));
        }
    };
});
builder.Services.AddAuthorization();
var origins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? new[] { "http://localhost:5173" };
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p.WithOrigins(origins).AllowAnyHeader().AllowAnyMethod().AllowCredentials()));
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = 429;
    o.OnRejected = async (ctx, ct) => await ctx.HttpContext.Response.WriteAsJsonAsync(new { message = "Слишком много запросов. Подождите минуту и попробуйте снова." }, ct);
    o.AddPolicy("auth", ctx => RateLimitPartition.GetFixedWindowLimiter(ctx.Connection.RemoteIpAddress?.ToString() ?? "local", _ => new FixedWindowRateLimiterOptions { PermitLimit = builder.Environment.IsEnvironment("Testing") ? 200 : 20, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
    o.AddPolicy("speech", ctx => RateLimitPartition.GetFixedWindowLimiter(ctx.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "guest", _ => new FixedWindowRateLimiterOptions { PermitLimit = 90, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
    o.AddPolicy("ai", ctx => RateLimitPartition.GetFixedWindowLimiter(ctx.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "guest", _ => new FixedWindowRateLimiterOptions { PermitLimit = 12, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
});
builder.Services.AddEndpointsApiExplorer(); builder.Services.AddSwaggerGen();
var app = builder.Build();
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    if (db.Database.IsNpgsql()) await db.Database.MigrateAsync(); else await SqliteSchemaUpgrade.Apply(db);
    if (!File.Exists(Path.Combine(dataDir, "demo-seeded")))
    {
        await DemoData.Seed(db);
        File.WriteAllText(Path.Combine(dataDir, "demo-seeded"), "1");
    }
    if (!File.Exists(Path.Combine(dataDir, "demo-languages-v1")))
    {
        await LocalizedDemoData.Seed(db);
        File.WriteAllText(Path.Combine(dataDir, "demo-languages-v1"), "1");
    }
    if (args.Contains("--create-admin") || args.Contains("--reset-password"))
    {
        var reset = args.Contains("--reset-password");
        Console.Write(reset ? "Email пользователя: " : "Email администратора: "); var email = Console.ReadLine()?.Trim().ToLowerInvariant();
        string? name = "Пользователь";
        if (!reset) { Console.Write("Имя: "); name = Console.ReadLine()?.Trim(); }
        Console.Write("Пароль (ввод скрыт): ");
        string password;
        if (Console.IsInputRedirected) password = Console.ReadLine() ?? "";
        else { var chars = new StringBuilder(); ConsoleKeyInfo key; while ((key = Console.ReadKey(true)).Key != ConsoleKey.Enter) { if (key.Key == ConsoleKey.Backspace && chars.Length > 0) chars.Length--; else if (!char.IsControl(key.KeyChar)) chars.Append(key.KeyChar); } password = chars.ToString(); Console.WriteLine(); }
        if (string.IsNullOrWhiteSpace(email) || !new System.ComponentModel.DataAnnotations.EmailAddressAttribute().IsValid(email) || string.IsNullOrWhiteSpace(name) || name.Length > 80 || password.Length < 8 || password.Length > 64 || Encoding.UTF8.GetByteCount(password) > 72) throw new InvalidOperationException("Проверьте email, имя и пароль (8–64 символа, до 72 байт UTF-8).");
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == email);
        if (reset)
        {
            if (user == null) throw new InvalidOperationException("Пользователь не найден.");
            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(password); user.SecurityStamp = Guid.NewGuid().ToString();
            await db.SaveChangesAsync(); Console.WriteLine("Пароль изменён, прежние сессии завершены."); return;
        }
        if (user != null) throw new InvalidOperationException("Email уже занят. Назначьте роль через существующего администратора или используйте новый email.");
        db.Users.Add(new User { Id = Guid.NewGuid(), Email = email, FullName = name, PasswordHash = BCrypt.Net.BCrypt.HashPassword(password), Role = UserRole.Admin, CreatedAt = DateTime.UtcNow });
        await db.SaveChangesAsync(); Console.WriteLine("Администратор создан."); return;
    }
}
app.Use(async (ctx, next) =>
{
    ctx.Response.Headers["X-Content-Type-Options"] = "nosniff";
    ctx.Response.Headers["Referrer-Policy"] = "same-origin";
    if (ctx.Request.Path.StartsWithSegments("/api")) ctx.Response.Headers.CacheControl = "no-store";
    if (ctx.Request.Path.StartsWithSegments("/api") && ctx.Request.Method is not ("GET" or "HEAD" or "OPTIONS"))
    {
        var origin = ctx.Request.Headers.Origin.ToString();
        var same = $"{ctx.Request.Scheme}://{ctx.Request.Host}";
        if ((!string.IsNullOrEmpty(origin) && origin != same && !origins.Contains(origin)) || ctx.Request.Headers["Sec-Fetch-Site"] == "cross-site")
        { ctx.Response.StatusCode = 403; await ctx.Response.WriteAsJsonAsync(new { message = "Недопустимый источник запроса." }); return; }
    }
    try { await next(); }
    catch (HttpRequestException) { ctx.Response.StatusCode = 502; await ctx.Response.WriteAsJsonAsync(new { message = "Нет связи с AI-провайдером. Попробуйте позже." }); }
    catch (ServiceException e) { ctx.Response.StatusCode = e.Status; await ctx.Response.WriteAsJsonAsync(new { message = e.Message }); }
    catch (OperationCanceledException) when (!ctx.RequestAborted.IsCancellationRequested) { ctx.Response.StatusCode = 504; await ctx.Response.WriteAsJsonAsync(new { message = "Сервис отвечает слишком долго. Попробуйте ещё раз." }); }
    catch (Exception e) when (e is not OperationCanceledException) { app.Logger.LogError(e, "Request failed"); ctx.Response.StatusCode = 500; await ctx.Response.WriteAsJsonAsync(new { message = "Не удалось выполнить запрос. Попробуйте ещё раз." }); }
});
if (app.Environment.IsDevelopment()) { app.UseSwagger(); app.UseSwaggerUI(); }
app.UseCors(); app.UseAuthentication(); app.UseRateLimiter(); app.UseAuthorization();
app.MapGet("/api/health", () => Results.Ok(new { status = "ok" }));
app.MapGet("/api/capabilities", (AiService ai, SpeechService speech) => Results.Ok(new { aiConfigured = ai.Available, speech = speech.Available ? "azure" : "browser", uploadFormats = new[] { "pdf", "docx", "pptx", "txt", "md" } })).RequireAuthorization();
app.MapControllers();
app.Run();
