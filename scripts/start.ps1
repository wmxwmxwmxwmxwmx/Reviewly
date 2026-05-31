$ErrorActionPreference = 'Stop'

$ProjectRoot = Split-Path $PSScriptRoot -Parent
$AppUrl = 'http://localhost:3000'

function Write-Info([string]$Message) {
  Write-Host $Message -ForegroundColor Cyan
}

function Write-Err([string]$Message) {
  Write-Host $Message -ForegroundColor Red
}

function Test-CommandExists([string]$Name) {
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

Set-Location $ProjectRoot

Write-Info '正在通过 Docker 启动 PRism（Web + Gateway + Postgres）...'
Write-Info '提示: 一键安装/部署仅支持 Linux；Windows 请使用 WSL 执行 bash install.sh，或 npm run dev:local。'

if (-not (Test-CommandExists 'node')) {
  Write-Err '未检测到 Node.js，请先安装 Node.js 18+ 并加入 PATH。'
  exit 1
}

if (-not (Test-CommandExists 'npm')) {
  Write-Err '未检测到 npm，请确认 Node.js 安装完整。'
  exit 1
}

if (-not (Test-CommandExists 'docker')) {
  Write-Err '未检测到 Docker。请安装并启动 Docker Desktop 后重试。'
  exit 1
}

npm run dev
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Write-Host ''
Write-Info "打开浏览器: $AppUrl"
Start-Process $AppUrl
Write-Info '停止服务: npm run stop'
Write-Info '查看日志: docker compose -f deploy/docker-compose.yml logs -f'
