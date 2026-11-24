@echo off
title India Disaster and Weather Tracker
cd /d "%~dp0backend"

echo ============================================
echo  India Disaster and Weather Tracker - Setup
echo ============================================

where python >nul 2>nul
if %errorlevel% neq 0 (
    echo Python was not found on this system.
    echo Please install Python 3.9+ from https://www.python.org/downloads/
    echo During install, check "Add python.exe to PATH".
    pause
    exit /b 1
)

if not exist venv (
    echo Creating virtual environment...
    python -m venv venv
)

call venv\Scripts\activate.bat

echo Installing/updating dependencies ^(first run only takes a minute^)...
pip install --quiet --disable-pip-version-check -r requirements.txt

echo.
echo Starting server at http://localhost:8000
echo Press CTRL+C in this window to stop the server.
echo.

start "" http://localhost:8000
uvicorn app:app --host 0.0.0.0 --port 8000

pause
