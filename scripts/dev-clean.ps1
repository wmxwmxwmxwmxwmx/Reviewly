$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

Write-Host "Cleaning dev ports (3000 web, 3001 gateway)..."
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Root "scripts\kill-port.ps1") -Port 3000
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Root "scripts\kill-port.ps1") -Port 3001

Write-Host "Ensuring Docker Postgres (dev:db)..."
Set-Location $Root
npm run dev:db
if ($LASTEXITCODE -ne 0) {
    Write-Host "WARN: dev:db failed; dev:local may fall back to SQLite." -ForegroundColor Yellow
}

Write-Host "Starting local dev (web + gateway hot reload)..."
npm run dev:local
