@echo off
REM AutoSpend AI Backend Launcher
REM Run from the project directory
cd /d "%~dp0"
start "" /B python backend\server.py
exit /b
