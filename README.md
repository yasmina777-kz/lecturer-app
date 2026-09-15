# AI-лектор — MVP

## Запуск локально (без Docker)

### Backend
```
cd backend/src/Lecturer.Api
dotnet restore
dotnet ef database update   # применить миграции к Postgres (нужен установленный dotnet-ef)
dotnet run
```
Backend поднимется на `http://localhost:5000`.

### Frontend
```
cd frontend
npm install
npm run dev
```
Frontend поднимется на `http://localhost:5173`.

## Что нужно доделать перед первым запуском

1. Поднять PostgreSQL локально (или через `docker-compose up postgres`) и проверить строку подключения в `backend/src/Lecturer.Api/appsettings.json`.
2. Создать миграцию EF Core: `dotnet ef migrations add InitialCreate` в папке `Lecturer.Api`.
3. Реализовать вызовы реальных провайдеров в `backend/src/Lecturer.Infrastructure/ExternalServices.cs` (STT, TTS, AI) — сейчас там заглушки с `NotImplementedException`.
4. Добавить в БД тестовую лекцию со слайдами (id `00000000-0000-0000-0000-000000000001`, захардкожен в `frontend/src/App.tsx`) — либо вручную через SQL, либо написать сид-скрипт.
