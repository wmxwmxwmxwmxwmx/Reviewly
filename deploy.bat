@echo off
REM Reviewly 一键安装（仅需 Docker Desktop）
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy\bootstrap.ps1"
exit /b %ERRORLEVEL%
