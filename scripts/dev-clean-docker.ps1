$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

Write-Host "Cleaning dev ports (3000 web, 3001 gateway)..."
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Root "scripts\kill-port.ps1") -Port 3000
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Root "scripts\kill-port.ps1") -Port 3001

Write-Host "Starting Docker full stack (npm run dev)..."
Set-Location $Root
npm run dev
