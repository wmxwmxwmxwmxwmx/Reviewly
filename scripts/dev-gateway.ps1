$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $PSScriptRoot
$Gateway = Join-Path $Root 'services\gateway'
$Venv = Join-Path $Gateway '.venv'
$Python = Join-Path $Venv 'Scripts\python.exe'

function Write-Info([string]$Message) {
  Write-Host $Message -ForegroundColor Green
}

function Write-Warn([string]$Message) {
  Write-Host $Message -ForegroundColor Yellow
}

function New-GatewayVenv {
  if (Test-Path $Venv) {
    Remove-Item -Recurse -Force $Venv
  }

  Write-Info 'Creating Python virtual environment for gateway...'
  python -m venv $Venv

  if ($LASTEXITCODE -ne 0 -or -not (Test-Path $Python)) {
    throw 'Failed to create gateway virtual environment. Please install Python 3.11+ and make sure python is in PATH.'
  }
}

Set-Location $Gateway

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
  throw 'Python was not found. Please install Python 3.11+ and make sure python is in PATH.'
}

if (-not (Test-Path $Python)) {
  New-GatewayVenv
}

if (-not (Test-Path $Python)) {
  New-GatewayVenv
}

Write-Info 'Installing gateway Python dependencies...'
& $Python -m pip install -q -r requirements.txt
if ($LASTEXITCODE -ne 0) {
  Write-Warn 'pip install failed. Recreating virtual environment and retrying once...'
  New-GatewayVenv
  & $Python -m pip install -q -r requirements.txt
  if ($LASTEXITCODE -ne 0) {
    throw 'pip install failed. Please check services/gateway/requirements.txt and network access.'
  }
}

$envFile = Join-Path $Gateway '.env'
if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
      $name = $matches[1].Trim()
      $value = $matches[2].Trim().Trim('"')
      [System.Environment]::SetEnvironmentVariable($name, $value, 'Process')
    }
  }
}

Write-Info 'Running database migrations...'
& $Python -m alembic upgrade head
if ($LASTEXITCODE -ne 0) {
  Write-Warn 'Alembic migration failed.'
  Write-Warn 'PostgreSQL option: run docker compose up -d from repo root, then retry.'
  Write-Warn 'SQLite option: set DATABASE_URL=sqlite:///./prism.db in services/gateway/.env'
  exit 1
}

$env:PRISM_STUB_ENGINE = '1'
Write-Info 'Starting gateway on http://localhost:3001 (PRISM_STUB_ENGINE=1)'
& $Python -m uvicorn app.main:app --host 0.0.0.0 --port 3001 --reload
