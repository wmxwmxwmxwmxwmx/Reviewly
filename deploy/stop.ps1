#Requires -Version 5.1
$ErrorActionPreference = "Continue"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $Root

Write-Host "Stopping PRism Docker stack (deploy/docker-compose.yml)..." -ForegroundColor Yellow
if (Test-Path "deploy\docker-compose.yml") {
    docker compose -f deploy\docker-compose.yml down --remove-orphans 2>$null
}

Write-Host "Stopping dev PostgreSQL (docker-compose.yml)..." -ForegroundColor Yellow
if (Test-Path "docker-compose.yml") {
    docker compose -f docker-compose.yml down --remove-orphans 2>$null
}

foreach ($port in @(3000, 3001)) {
    Write-Host "Releasing port $port..." -ForegroundColor Yellow
    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Root "scripts\kill-port.ps1") -Port $port
}

Write-Host "All PRism services stopped." -ForegroundColor Green
