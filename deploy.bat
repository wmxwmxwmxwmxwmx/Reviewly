@echo off
setlocal EnableExtensions
REM Reviewly 一键安装（自动安装/启动 Docker Desktop + 部署）
cd /d "%~dp0"
chcp 65001 >nul 2>&1

set "EXITCODE=1"

if exist "%ProgramFiles%\PowerShell\7\pwsh.exe" (
    set "PS=%ProgramFiles%\PowerShell\7\pwsh.exe"
) else (
    where powershell >nul 2>&1
    if errorlevel 1 (
        echo [Reviewly] 未找到 PowerShell。请安装 Windows PowerShell 5.1+ 或 PowerShell 7。
        goto :finish
    )
    set "PS=powershell.exe"
)

"%PS%" -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy\validate-scripts.ps1"
if errorlevel 1 (
    set "EXITCODE=1"
    goto :finish
)

"%PS%" -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy\bootstrap.ps1"
set "EXITCODE=%ERRORLEVEL%"

:finish
echo.
if "%EXITCODE%"=="0" (
    echo [Reviewly] 部署成功
) else (
    echo [Reviewly] 部署失败，退出代码 %EXITCODE%
    echo 若需安装 Docker，可尝试右键 deploy.bat -^> 以管理员身份运行
    echo 若出现乱码或 missing terminator，请运行: powershell -File scripts\ensure-ps1-bom.ps1
)
echo.
pause
exit /b %EXITCODE%
