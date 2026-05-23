@echo off
cd /d "%~dp0.."
title WebRainmeter Launcher

:: Check if port 5000 is already active
netstat -ano | findstr :5000 >nul
if %errorlevel% equ 0 (
    echo Server is already active. Opening player in default browser...
    start http://127.0.0.1:5000
    exit /b
)

echo Starting WebRainmeter Flask server...
start "WebRainmeter Server" cmd /c "python backend\server.py"

:: Wait briefly for server startup (2 seconds)
timeout /t 2 /nobreak >nul

echo Opening player in default browser...
start http://127.0.0.1:5000
exit /b
