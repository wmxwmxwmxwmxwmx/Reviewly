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

$dbUrl = [System.Environment]::GetEnvironmentVariable("DATABASE_URL", "Process")
if ($dbUrl -match "postgres") {
    Write-Host "Checking PostgreSQL on localhost:5432..."
    $pgCheck = Test-NetConnection -ComputerName localhost -Port 5432 -WarningAction SilentlyContinue -ErrorAction SilentlyContinue
    if (-not $pgCheck.TcpTestSucceeded) {
        Write-Host ""
        Write-Host "ERROR: PostgreSQL is not reachable on localhost:5432." -ForegroundColor Red
        Write-Host "  Start Postgres from repo root:  docker compose up -d"
        Write-Host "  Then retry:  npm run dev:gateway"
        Write-Host ""
        Write-Host "  Or use SQLite in services/gateway/.env (no Docker):"
        Write-Host "    DATABASE_URL=sqlite:///./prism.db"
        Write-Host ""
        exit 1
    }
}

Write-Host "Running database migrations..."
& $python -m alembic upgrade head
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERROR: Alembic migration failed; Gateway will not start." -ForegroundColor Red
    Write-Host "  PostgreSQL: run 'docker compose up -d' from repo root, then retry."
    Write-Host "  Or use SQLite in services/gateway/.env:"
    Write-Host "    DATABASE_URL=sqlite:///./prism.db"
    Write-Host ""
    exit 1
}

$env:PRISM_STUB_ENGINE = "1"
if (-not $env:DEBUG) {
    $env:DEBUG = "1"
}
if (-not $env:GITHUB_PAT -and -not $env:GITHUB_APP_ID) {
    Write-Warning "GITHUB_PAT not set; set it in services/gateway/.env for higher GitHub API limits."
}
function Stop-ListenersOnPort([int]$Port) {
    $killScript = Join-Path $Root "scripts\kill-port.ps1"
    if (Test-Path $killScript) {
        & powershell -NoProfile -ExecutionPolicy Bypass -File $killScript -Port $Port
    }
}

Stop-ListenersOnPort 3001

$listeners = @(
    Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique
) | Where-Object { $_ }
if ($listeners.Count -gt 0) {
    Write-Warning "Port 3001 still has $($listeners.Count) listener(s): $($listeners -join ', ')"
    Write-Warning "Run 'npm run kill:gateway' or close other dev terminals, then retry."
    exit 1
}

Write-Host "Starting gateway at http://127.0.0.1:3001"
# Single process + watchfiles reload avoids orphaned multiprocessing workers on Windows.
& $python -m uvicorn app.main:app --host 127.0.0.1 --port 3001 --reload `
  --reload-dir app `
  --reload-delay 2 `
  --reload-exclude "data/*" `
  --workers 1
