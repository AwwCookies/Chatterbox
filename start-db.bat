@echo off
title Chatterbox - Start Database

echo ========================================
echo    Starting PostgreSQL Database
echo ========================================
echo.

:: Stop and remove existing container if running
echo [1/3] Stopping existing container (if any)...
docker-compose -f docker-compose.db.yml down -v 2>nul

:: Remove old volume to reset password
echo [2/3] Cleaning up old data...
docker volume rm chatterbox_pgdata 2>nul

:: Start the database container fresh
echo [3/3] Starting database container...
docker-compose -f docker-compose.db.yml up -d --build

if errorlevel 1 (
    echo [ERROR] Failed to start database. Is Docker running?
    pause
    exit /b 1
)

:: Wait for database to be ready
echo.
echo Waiting for database to be ready...
timeout /t 5 /nobreak >nul

echo.
echo [OK] PostgreSQL is running on port 5432
echo.
echo     Database: twitch_archive
echo     User: twitch
echo     Password: (from .env DB_PASSWORD)
echo.
echo Run dev.bat to start the application.
echo.
pause
