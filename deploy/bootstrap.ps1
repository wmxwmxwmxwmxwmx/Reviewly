#Requires -Version 5.1
# 一键安装：检查 Docker Desktop → 静默部署（无交互）
param([switch]$Help)

$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

if ($Help) {
    Write-Host "用法: .\deploy\bootstrap.ps1  或双击 deploy.bat / install.bat"
    exit 0
}

Write-Host "[Reviewly] 一键安装中..."

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "未检测到 Docker。请先安装并启动 Docker Desktop:" -ForegroundColor Red
    Write-Host "  https://www.docker.com/products/docker-desktop/"
    exit 1
}

& docker info *> $null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Docker Desktop 未运行。请打开并等待 Ready 后重试。" -ForegroundColor Red
    exit 1
}

& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Root "deploy\deploy.ps1") -Yes -StubEngine
exit $LASTEXITCODE
