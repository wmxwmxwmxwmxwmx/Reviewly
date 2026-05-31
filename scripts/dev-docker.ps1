#Requires -Version 5.1
param(
    [switch]$Rebuild,
    [switch]$Help
)

$ErrorActionPreference = "Stop"
if ($PSVersionTable.PSVersion.Major -ge 7) {
    $PSNativeCommandUseErrorActionPreference = $false
}
$Root = Split-Path -Parent $PSScriptRoot

function Test-DockerRunning {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        Write-Host ""
        Write-Host "ERROR: 未安装 Docker。请安装并启动 Docker Desktop 后重试。" -ForegroundColor Red
        Write-Host "  或改用本地模式: npm run dev:local" -ForegroundColor Yellow
        Write-Host ""
        return $false
    }
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        & docker info 2>$null | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Host ""
            Write-Host "ERROR: Docker Desktop 未运行。请先打开 Docker Desktop，等 Ready 后再执行 npm run dev。" -ForegroundColor Red
            Write-Host "  或改用本地模式: npm run dev:local" -ForegroundColor Yellow
            Write-Host ""
            return $false
        }
        return $true
    } finally {
        $ErrorActionPreference = $prevEap
    }
}

if ($Help) {
    @"
用法: npm run dev

  通过 Docker 启动 Web (:3000) + Gateway (:3001) + PostgreSQL。
  会先释放本地占用的 3000/3001 端口。

  npm run dev -- --Rebuild   强制重新构建镜像
  npm run dev:local          本地 Node/Python 开发（旧模式）
"@
    exit 0
}

Write-Host ""
Write-Host "[Reviewly] Docker 容器启动（Web + Gateway + Postgres）..." -ForegroundColor Cyan
Write-Host ""

if (-not (Test-DockerRunning)) {
    exit 1
}

foreach ($port in @(3000, 3001)) {
    $kill = Join-Path $Root "scripts\kill-port.ps1"
    if (Test-Path $kill) {
        & powershell -NoProfile -ExecutionPolicy Bypass -File $kill -Port $port
    }
}

$deployScript = Join-Path $Root "deploy\deploy.ps1"
$deployArgs = @("-Yes", "-StubEngine", "-QuickStart")
if (-not $Rebuild) {
    $deployArgs += "-SkipBuild"
}

& powershell -NoProfile -ExecutionPolicy Bypass -File $deployScript @deployArgs
exit $LASTEXITCODE
