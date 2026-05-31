#Requires -Version 5.1
# Windows 新机引导：检查 Docker Desktop → 部署 PRism
param([switch]$Help)

$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

if ($Help) {
    Write-Host "用法: .\deploy\bootstrap.ps1"
    Write-Host "  检查 Docker Desktop，然后以 stub 模式一键部署（无需 Node/Python）"
    exit 0
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "  PRism 新机引导部署 (Windows)" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "未检测到 Docker。" -ForegroundColor Red
    Write-Host ""
    Write-Host "请先安装 Docker Desktop 并启动:"
    Write-Host "  https://www.docker.com/products/docker-desktop/"
    Write-Host "  或 PowerShell: winget install Docker.DockerDesktop"
    Write-Host ""
    Write-Host "安装完成后双击 deploy.bat 或执行:"
    Write-Host "  .\deploy\deploy.ps1 -Yes -StubEngine"
    exit 1
}

& docker info *> $null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Docker Desktop 未运行。请打开并等待 Ready 后重试。" -ForegroundColor Red
    exit 1
}

& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Root "deploy\deploy.ps1") -Yes -StubEngine
