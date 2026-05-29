$ErrorActionPreference = 'Stop'

Write-Host 'Starting PRism development server...' -ForegroundColor Cyan

if (-not (Test-Path -Path 'node_modules')) {
  Write-Host 'Dependencies not found. Installing with npm...' -ForegroundColor Yellow
  npm install
}

Write-Host 'Opening http://localhost:3000' -ForegroundColor Green
Start-Process 'http://localhost:3000'

npm run dev
