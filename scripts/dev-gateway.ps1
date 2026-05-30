$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Gateway = Join-Path $Root "services\gateway"

Set-Location $Gateway

$venv = Join-Path $Gateway ".venv"
if (-not (Test-Path $venv)) {
    python -m venv .venv
}

$pip = Join-Path $venv "Scripts\pip.exe"
$python = Join-Path $venv "Scripts\python.exe"

& $pip install -q -r requirements.txt

$envFile = Join-Path $Gateway ".env"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim().Trim('"')
            [System.Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
}

Write-Host "Running database migrations..."
& $python -m alembic upgrade head
if ($LASTEXITCODE -ne 0) {
    Write-Warning "Alembic migration failed."
    Write-Warning "  PostgreSQL: run 'docker compose up -d' from repo root, then retry."
    Write-Warning "  Or use SQLite in services/gateway/.env:"
    Write-Warning "    DATABASE_URL=sqlite:///./prism.db"
    exit 1
}

$env:PRISM_STUB_ENGINE = "1"
if (-not $env:GITHUB_PAT -and -not $env:GITHUB_APP_ID) {
    Write-Warning "GITHUB_PAT not set; set it in services/gateway/.env for higher GitHub API limits."
}
Write-Host "Starting gateway at http://localhost:3001"
& $python -m uvicorn app.main:app --host 0.0.0.0 --port 3001 --reload `
  --reload-dir app `
  --reload-exclude "data/*"
