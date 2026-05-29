# Reviewly 一键启动 — 开发服务器
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

function Write-Info($msg)  { Write-Host $msg -ForegroundColor Cyan }
function Write-Warn($msg)  { Write-Host $msg -ForegroundColor Yellow }
function Write-Err($msg)   { Write-Host $msg -ForegroundColor Red }

Write-Info "========================================"
Write-Info "  Reviewly — AI PR Review Assistant"
Write-Info "========================================"
Write-Host ""

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Err "未检测到 Node.js，请先安装: https://nodejs.org/"
    Read-Host "按 Enter 退出"
    exit 1
}

$nodeVersion = node -v
Write-Info "Node.js $nodeVersion"

if (-not (Test-Path "node_modules")) {
    Write-Warn "首次运行，正在安装依赖 (npm install)..."
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Err "依赖安装失败"
        Read-Host "按 Enter 退出"
        exit $LASTEXITCODE
    }
    Write-Host ""
}

# 后台等待服务就绪后打开浏览器
$null = Start-Job -ScriptBlock {
    for ($i = 0; $i -lt 90; $i++) {
        try {
            $client = New-Object System.Net.Sockets.TcpClient
            $client.Connect("127.0.0.1", 3000)
            $client.Close()
            Start-Process "http://localhost:3000"
            return
        } catch {
            Start-Sleep -Seconds 1
        }
    }
}

Write-Info "启动开发服务器 → http://localhost:3000"
Write-Host "按 Ctrl+C 停止服务`n" -ForegroundColor DarkGray

npm run dev
