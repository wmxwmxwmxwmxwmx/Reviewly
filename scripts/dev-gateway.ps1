$ErrorActionPreference = "Stop"
# PS 7+: avoid treating native stderr (e.g. Python info logs) as terminating errors.
$PSNativeCommandUseErrorActionPreference = $false
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

$resolveScript = Join-Path $Gateway "scripts\resolve_dev_database.py"
Write-Host "Resolving database (Postgres / SQLite auto)..."
# Python 将说明写到 stderr；PowerShell 默认会把 stderr 当成错误并中断（即使 exit 0）
$prevErrorAction = $ErrorActionPreference
$ErrorActionPreference = "Continue"
try {
    $resolveOutput = & $python $resolveScript 2>&1
    $resolveExitCode = $LASTEXITCODE
} finally {
    $ErrorActionPreference = $prevErrorAction
}
foreach ($line in $resolveOutput) {
    if ($line -is [System.Management.Automation.ErrorRecord]) {
        Write-Host $line.Exception.Message
    }
}
$dbUrl = (
    $resolveOutput |
    Where-Object { $_ -is [string] -and $_ -match '^(sqlite|postgresql)' } |
    Select-Object -First 1
)
if ($null -eq $dbUrl) {
    $dbUrl = ($resolveOutput | Where-Object { $_ -is [string] } | Select-Object -First 1)
}
$dbUrl = ($dbUrl | Out-String).Trim()
if ($resolveExitCode -ne 0 -or -not $dbUrl) {
    Write-Error "Failed to resolve DATABASE_URL (exit=$resolveExitCode)."
    exit 1
}
[System.Environment]::SetEnvironmentVariable("DATABASE_URL", $dbUrl, "Process")

Write-Host "Running database migrations..."
$prevEap = $ErrorActionPreference
$ErrorActionPreference = "Continue"
try {
    & $python -m alembic upgrade head
    $alembicExitCode = $LASTEXITCODE
} finally {
    $ErrorActionPreference = $prevEap
}
if ($alembicExitCode -ne 0) {
    Write-Host ""
    Write-Host "ERROR: Alembic migration failed; Gateway will not start." -ForegroundColor Red
    Write-Host "  PostgreSQL: npm run dev:db  (Docker Postgres prism/prism@localhost:5432)"
    Write-Host "  Force SQLite: set PRISM_DATABASE_MODE=sqlite in services/gateway/.env"
    Write-Host "  Force Postgres only: PRISM_DATABASE_MODE=postgres"
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
$prevEap = $ErrorActionPreference
$ErrorActionPreference = "Continue"
try {
    & $python -m uvicorn app.main:app --host 127.0.0.1 --port 3001 --reload `
      --reload-dir app `
      --reload-delay 2 `
      --reload-exclude "data/*" `
      --workers 1
} finally {
    $ErrorActionPreference = $prevEap
}
