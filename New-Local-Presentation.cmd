@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\new-local-presentation.ps1" %*
exit /b %errorlevel%
