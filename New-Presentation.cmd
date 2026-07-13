@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\new-presentation.ps1" -OpenCodespace %*
exit /b %errorlevel%
