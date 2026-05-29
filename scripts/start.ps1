$ErrorActionPreference = 'Stop'

$ProjectRoot = Split-Path $PSScriptRoot -Parent
$AppUrl = 'http://localhost:3000'
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

Write-Info '正在启动 PRism（Web + API）...'

if (-not (Test-CommandExists 'node')) {
  Write-Err '未检测到 Node.js，请先安装 Node.js 18+ 并加入 PATH。'
  exit 1
}

if (-not (Test-CommandExists 'npm')) {
  Write-Err '未检测到 npm，请确认 Node.js 安装完整。'
  exit 1
}

if (-not (Test-Path -Path 'node_modules')) {
  Write-Warn '未找到 node_modules，正在执行 npm install...'
  npm install
  if ($LASTEXITCODE -ne 0) {
    Write-Err 'npm install 失败，请检查网络或依赖配置。'
    exit $LASTEXITCODE
  }
}

$openBrowserJob = Start-Job -ScriptBlock {
  param($Url, $TimeoutSec, $IntervalMs)

  function Wait-DevServerReady {
    param([string]$Url, [int]$TimeoutSec, [int]$IntervalMs)

    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
      try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
        if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
          return $true
        }
      } catch {}

      Start-Sleep -Milliseconds $IntervalMs
    }

    return $false
  }

  if (Wait-DevServerReady -Url $Url -TimeoutSec $TimeoutSec -IntervalMs $IntervalMs) {
    Start-Process $Url
    return 'opened'
  }

  return 'timeout'
} -ArgumentList $AppUrl, $ReadyTimeoutSec, $PollIntervalMs

Write-Info "Web 就绪后将自动打开 $AppUrl（API: http://localhost:3001）"
Write-Info '按 Ctrl+C 可停止所有开发服务。'
Write-Host ''

try {
  npm run dev
  $exitCode = $LASTEXITCODE
} finally {
  if ($openBrowserJob.State -eq 'Running') {
    Stop-Job $openBrowserJob -ErrorAction SilentlyContinue | Out-Null
  }

  $browserResult = Receive-Job $openBrowserJob -ErrorAction SilentlyContinue
  Remove-Job $openBrowserJob -Force -ErrorAction SilentlyContinue | Out-Null

  if ($browserResult -eq 'timeout') {
    Write-Warn "Web 服务在 ${ReadyTimeoutSec}s 内未就绪，请手动访问 $AppUrl"
  }
}

if ($exitCode -ne 0) {
  exit $exitCode
}
