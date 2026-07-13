@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\open-presentation.ps1" %*
exit /b %errorlevel%
