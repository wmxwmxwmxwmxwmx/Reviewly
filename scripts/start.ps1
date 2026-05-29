$ErrorActionPreference = 'Stop'

$ProjectRoot = Split-Path $PSScriptRoot -Parent
$WebUrl = 'http://localhost:3000'
$GatewayUrl = 'http://localhost:3001/health'
$ReadyTimeoutSec = 60
$PollIntervalMs = 500

function Write-Info([string]$Message) {
  Write-Host $Message -ForegroundColor Cyan
}

function Write-Warn([string]$Message) {
  Write-Host $Message -ForegroundColor Yellow
}

function Write-Err([string]$Message) {
  Write-Host $Message -ForegroundColor Red
}

function Test-CommandExists([string]$Name) {
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

Set-Location $ProjectRoot

Write-Info 'Starting PRism development stack...'

if (-not (Test-CommandExists 'node')) {
  Write-Err 'Node.js was not found. Please install Node.js 18+ and make sure it is in PATH.'
  exit 1
}

if (-not (Test-CommandExists 'npm')) {
  Write-Err 'npm was not found. Please reinstall Node.js or check PATH.'
  exit 1
}

if (-not (Test-CommandExists 'python')) {
  Write-Warn 'Python was not found. The gateway service will not start.'
}

Write-Info "Node: $(node -v)"

if (-not (Test-Path -Path 'package.json')) {
  Write-Err "package.json was not found in $ProjectRoot"
  exit 1
}

if (-not (Test-Path -Path 'node_modules')) {
  Write-Warn 'node_modules was not found. Running npm install...'
  npm install
  if ($LASTEXITCODE -ne 0) {
    Write-Err 'npm install failed. Please check the npm output above.'
    exit $LASTEXITCODE
  }
}

if (-not (Test-Path -Path 'node_modules\.bin\concurrently.cmd')) {
  Write-Warn 'concurrently was not found. Running npm install to restore workspace tools...'
  npm install
  if ($LASTEXITCODE -ne 0) {
    Write-Err 'npm install failed. Please check the npm output above.'
    exit $LASTEXITCODE
  }
}

$openBrowserJob = Start-Job -ScriptBlock {
  param($Url, $TimeoutSec, $IntervalMs)

  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        Start-Process $Url
        return 'opened'
      }
    } catch {
      Start-Sleep -Milliseconds $IntervalMs
    }
  }

  return 'timeout'
} -ArgumentList $WebUrl, $ReadyTimeoutSec, $PollIntervalMs

Write-Info "Web: $WebUrl"
Write-Info "Gateway health: $GatewayUrl"
Write-Info 'Browser will open automatically when the web app is ready.'
Write-Info 'Press Ctrl+C to stop the development stack.'
Write-Host ''

$exitCode = 0

try {
  npm run dev
  $exitCode = $LASTEXITCODE
} finally {
  if ($null -ne $openBrowserJob) {
    if ($openBrowserJob.State -eq 'Running') {
      Stop-Job $openBrowserJob -ErrorAction SilentlyContinue | Out-Null
    }

    $browserResult = Receive-Job $openBrowserJob -ErrorAction SilentlyContinue
    Remove-Job $openBrowserJob -Force -ErrorAction SilentlyContinue | Out-Null

    if ($browserResult -eq 'timeout') {
      Write-Warn "The web app was not ready after ${ReadyTimeoutSec}s. Open $WebUrl manually."
    }
  }
}

if ($exitCode -ne 0) {
  exit $exitCode
}
