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


builder.Services.AddScoped<AskQuestionService>();


builder.Services.AddControllers();


builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();


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


app.UseSwagger();
app.UseSwaggerUI();

app.UseCors();
app.UseAuthorization();
app.MapControllers();

app.Run();