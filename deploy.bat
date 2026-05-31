@echo off
setlocal EnableExtensions
REM Reviewly 一键安装（自动安装/启动 Docker Desktop + 部署）
cd /d "%~dp0"
chcp 65001 >nul 2>&1

set "EXITCODE=1"

where powershell >nul 2>&1
if errorlevel 1 (
    echo [Reviewly] 未找到 PowerShell。请安装 Windows PowerShell 5.1+ 或 PowerShell 7。
    goto :finish
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy\bootstrap.ps1"
set "EXITCODE=%ERRORLEVEL%"

:finish
echo.
if "%EXITCODE%"=="0" (
    echo [Reviewly] 部署成功
) else (
    echo [Reviewly] 部署失败，退出代码 %EXITCODE%
    echo 若需安装 Docker，可尝试右键 deploy.bat -^> 以管理员身份运行
)
echo.
pause
exit /b %EXITCODE%
