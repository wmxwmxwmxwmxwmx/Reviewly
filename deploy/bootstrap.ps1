#Requires -Version 5.1
# 一键安装：自动安装/启动 Docker → 静默部署
param([switch]$Help)

$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
. (Join-Path $PSScriptRoot "utils.ps1")

if ($Help) {
    Write-Host "用法: .\deploy\bootstrap.ps1  或双击 deploy.bat"
    exit 0
}

Write-ReviewlyLog "一键安装中..."

if (-not (Test-DockerReady)) {
    Write-ReviewlyLog "正在准备 Docker 环境（安装 / 启动 / 等待就绪）..."
    $installScript = Join-Path $PSScriptRoot "install-docker.ps1"
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $installScript -Yes
    $installExit = $LASTEXITCODE
    if ($installExit -ne 0) {
        Exit-ReviewlyWithPause $installExit "Docker 环境未就绪，无法继续部署。"
    }
    if (-not (Test-DockerReady)) {
        Exit-ReviewlyWithPause 1 "Docker 检测失败（docker version / docker info 未通过）。"
    }
}

Write-ReviewlyLog "Docker 已就绪，开始部署应用栈..." -Level Success

$deployScript = Join-Path $Root "deploy\deploy.ps1"
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $deployScript -Yes -StubEngine
$deployExit = $LASTEXITCODE

if ($deployExit -ne 0) {
    Exit-ReviewlyWithPause $deployExit "deploy.ps1 执行失败（退出码 $deployExit）。"
}

Write-ReviewlyLog "应用栈部署完成。" -Level Success
exit 0
