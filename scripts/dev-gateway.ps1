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
$env:PRISM_STUB_ENGINE = "1"
& $python -m uvicorn app.main:app --host 0.0.0.0 --port 3001 --reload
