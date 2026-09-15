using Lecturer.Core.Interfaces;
using Lecturer.Core.Services;
using Lecturer.Infrastructure;
using Lecturer.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// --- База данных: PostgreSQL через EF Core ---
// Строка подключения берётся из appsettings.json (ConnectionStrings:Default)
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Default")));

// --- Репозитории ---
builder.Services.AddScoped<ILectureRepository, LectureRepository>();
builder.Services.AddScoped<IQuestionRepository, QuestionRepository>();

// --- Внешние сервисы: STT, TTS, AI ---
builder.Services.AddHttpClient<ISpeechToTextService, SpeechToTextClient>();
builder.Services.AddHttpClient<ITextToSpeechService, TextToSpeechClient>();
builder.Services.AddHttpClient<IAiClient, AiClient>();

// --- Бизнес-логика ---
builder.Services.AddScoped<AskQuestionService>();

// --- Веб-слой ---
builder.Services.AddControllers();

// --- Swagger / OpenAPI — интерактивная документация API ---
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// CORS — фронт на другом порту, без этого браузер заблокирует запросы
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins(builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? Array.Empty<string>())
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

var app = builder.Build();

// Swagger UI — открывается на /swagger
app.UseSwagger();
app.UseSwaggerUI();

app.UseCors();
app.UseAuthorization();
app.MapControllers();

app.Run();