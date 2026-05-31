@echo off
REM PRism 新机一键部署（仅需 Docker Desktop，无需 Node/Python）
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy\bootstrap.ps1"
if errorlevel 1 pause
