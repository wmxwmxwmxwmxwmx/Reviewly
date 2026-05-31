@echo off
REM Reviewly 一键安装（同 deploy.bat）
cd /d "%~dp0"
call "%~dp0deploy.bat"
exit /b %ERRORLEVEL%
