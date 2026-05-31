@echo off
REM PRism 一键部署（双击运行，需已安装并启动 Docker Desktop）
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy\deploy.ps1"
if errorlevel 1 pause
