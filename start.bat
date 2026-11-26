@echo off
cd /d "%~dp0"
if not exist .env if exist .env.example copy .env.example .env >nul
python scripts\launch.py
pause
