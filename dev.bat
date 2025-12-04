@echo off
title Chatterbox Development Server

echo ========================================
echo    Chatterbox - Local Development
echo ========================================
echo.

:: Check if .env exists
if not exist ".env" (
    echo [!] .env file not found. Creating from .env.example...
    copy .env.example .env
    echo [!] Please edit .env with your Twitch credentials and run again.
    pause
    exit /b 1
)

:: Install server dependencies
echo [1/4] Installing server dependencies...
cd server
call npm install
if errorlevel 1 (
    echo [ERROR] Failed to install server dependencies
    pause
    exit /b 1
)

:: Install client dependencies
echo [2/4] Installing client dependencies...
cd ..\client
call npm install
if errorlevel 1 (
    echo [ERROR] Failed to install client dependencies
    pause
    exit /b 1
)

cd ..

echo.
echo [3/4] Starting server...
start "Chatterbox Server" cmd /k "cd server && npm run dev"

:: Wait a moment for server to start
timeout /t 3 /nobreak >nul

echo [4/4] Starting client...
start "Chatterbox Client" cmd /k "cd client && npm run dev"

echo.
echo ========================================
echo    Chatterbox is starting up!
echo ========================================
echo.
echo    Server: http://localhost:3000
echo    Client: http://localhost:5173
echo.
echo    Close the terminal windows to stop.
echo ========================================
echo.
pause
