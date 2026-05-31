#Requires -Version 5.1
param(
    [switch]$Yes,
    [switch]$StubEngine,
    [switch]$WithEngine,
    [switch]$Help
)

$ErrorActionPreference = "Stop"

if ($Help) {
    @"
用法: .\deploy\deploy.ps1 [-Yes] [-StubEngine] [-WithEngine]

  -Yes          不询问，自动生成 .env 与密钥
  -StubEngine   跳过 C++ 引擎（推荐新机）
  -WithEngine   构建 C++ 引擎
"@
    exit 0
}

$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $Root

$ComposeFile = Join-Path $Root "deploy\docker-compose.yml"
$EnvFile = Join-Path $Root "deploy\.env"
$EnvExample = Join-Path $Root "deploy\.env.example"
$GatewayEnv = Join-Path $Root "services\gateway\.env"

function Write-Step([string]$Message) { Write-Host $Message -ForegroundColor Yellow }
function Write-Ok([string]$Message) { Write-Host $Message -ForegroundColor Green }
function Write-Err([string]$Message) { Write-Host $Message -ForegroundColor Red }

function New-RandomHex([int]$Bytes = 32) {
    $buf = New-Object byte[] $Bytes
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buf)
    ([BitConverter]::ToString($buf) -replace "-", "").ToLower()
}

function Set-EnvKey([string]$Path, [string]$Key, [string]$Value) {
    $lines = @(Get-Content $Path -Encoding UTF8)
    $found = $false
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match "^\s*$([regex]::Escape($Key))\s*=") {
            $lines[$i] = "${Key}=${Value}"
            $found = $true
            break
        }
    }
    if (-not $found) { $lines += "${Key}=${Value}" }
    $lines | Set-Content $Path -Encoding UTF8
}

function Merge-GatewayEnv {
    if (-not (Test-Path $GatewayEnv)) { return }
    $lines = Get-Content $GatewayEnv -Encoding UTF8
    foreach ($line in $lines) {
        $trimmed = $line.Trim()
        if (-not $trimmed -or $trimmed.StartsWith("#")) { continue }
        if ($trimmed -notmatch "=") { continue }
        $key = $trimmed.Split("=", 2)[0].Trim()
        $value = $trimmed.Split("=", 2)[1]
        Set-EnvKey $EnvFile $key $value
    }
}

function Initialize-DeployEnv {
    param([bool]$FirstDeploy)
    if (-not (Test-Path $EnvFile)) {
        Copy-Item $EnvExample $EnvFile
        Merge-GatewayEnv
        Write-Host "  已创建 deploy/.env" -ForegroundColor Yellow
    }
    $content = Get-Content $EnvFile -Raw -Encoding UTF8
    if ($content -match 'JWT_SECRET=<generate>|JWT_SECRET=\s*$') {
        Set-EnvKey $EnvFile "JWT_SECRET" (New-RandomHex 32)
        Write-Host "  已自动生成 JWT_SECRET" -ForegroundColor Yellow
    }
    if ($content -match 'SETTINGS_ENCRYPTION_KEY=<generate>|SETTINGS_ENCRYPTION_KEY=\s*$') {
        Set-EnvKey $EnvFile "SETTINGS_ENCRYPTION_KEY" (New-RandomHex 32)
        Write-Host "  已自动生成 SETTINGS_ENCRYPTION_KEY" -ForegroundColor Yellow
    }
    if ($StubEngine) {
        Set-EnvKey $EnvFile "PRISM_STUB_ENGINE" "1"
    } elseif ($WithEngine) {
        Set-EnvKey $EnvFile "PRISM_STUB_ENGINE" "0"
    } elseif ($FirstDeploy -and -not $WithEngine) {
        Set-EnvKey $EnvFile "PRISM_STUB_ENGINE" "1"
        Write-Host "  首次部署已设 PRISM_STUB_ENGINE=1（跳过 C++ 编译）" -ForegroundColor Yellow
    }
    if (-not $Yes) {
        Write-Host "  可按需编辑 deploy/.env，然后继续" -ForegroundColor Yellow
        Read-Host "按 Enter 继续，Ctrl+C 取消"
    }
}

function Test-Docker {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        Write-Err "未检测到 Docker。请先安装 Docker Desktop 并启动:"
        Write-Host "  https://www.docker.com/products/docker-desktop/"
        Write-Host "  或使用: winget install Docker.DockerDesktop"
        exit 1
    }
    & docker compose version *> $null
    if ($LASTEXITCODE -ne 0) {
        Write-Err "未检测到 docker compose。请更新 Docker Desktop。"
        exit 1
    }
    & docker info *> $null
    if ($LASTEXITCODE -ne 0) {
        Write-Err "Docker 未运行。请打开 Docker Desktop 等待 Ready。"
        exit 1
    }
}

function Invoke-Compose {
    param([string[]]$Args)
    & docker compose -f $ComposeFile --env-file $EnvFile @Args
    if ($LASTEXITCODE -ne 0) { throw "docker compose failed: $($Args -join ' ')" }
}

function Test-PortInUse([int]$Port, [string]$Name) {
    $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if ($conn) {
        Write-Err "端口 $Port ($Name) 已被占用"
        exit 1
    }
}

Write-Step "[1/7] 检查运行环境..."
Test-Docker
try {
    Test-PortInUse -Port 5432 -Name "PostgreSQL"
    Test-PortInUse -Port 3001 -Name "Gateway"
    Test-PortInUse -Port 3000 -Name "Web"
} catch { }

$firstDeploy = -not (Test-Path $EnvFile)
Write-Step "[2/7] 准备 deploy/.env ..."
Initialize-DeployEnv -FirstDeploy:$firstDeploy

$useEngine = -not (Select-String -Path $EnvFile -Pattern '^PRISM_STUB_ENGINE=1' -Quiet)
if (-not $useEngine) {
    Write-Host "  PRISM_STUB_ENGINE=1，将跳过 engine 容器" -ForegroundColor Yellow
}

Write-Step "[3/7] 构建 Docker 镜像（首次较慢）..."
if ($useEngine) { Invoke-Compose @("build") }
else { Invoke-Compose @("build", "postgres", "gateway", "web") }

Write-Step "[4/7] 启动 PostgreSQL..."
Invoke-Compose @("up", "-d", "postgres")

Write-Step "[5/7] 等待 PostgreSQL..."
for ($i = 1; $i -le 30; $i++) {
    & docker compose -f $ComposeFile --env-file $EnvFile exec -T postgres pg_isready -U prism -d prism 2>$null
    if ($LASTEXITCODE -eq 0) { Write-Ok "  PostgreSQL 已就绪"; break }
    Start-Sleep -Seconds 2
}

Write-Step "[6/7] 启动 Gateway$(if ($useEngine) { ' 与 Engine' })..."
if ($useEngine) { Invoke-Compose @("up", "-d", "gateway", "engine") }
else { Invoke-Compose @("up", "-d", "gateway") }

for ($i = 1; $i -le 30; $i++) {
    try {
        $null = Invoke-WebRequest -Uri "http://localhost:3001/health" -UseBasicParsing -TimeoutSec 3
        Write-Ok "  Gateway 已就绪"; break
    } catch { Start-Sleep -Seconds 2 }
}

Write-Step "[7/7] 启动 Web..."
Invoke-Compose @("up", "-d", "web")

for ($i = 1; $i -le 20; $i++) {
    try {
        $null = Invoke-WebRequest -Uri "http://localhost:3000/" -UseBasicParsing -TimeoutSec 3
        Write-Ok "  Web 已就绪"; break
    } catch { Start-Sleep -Seconds 2 }
}

Write-Host ""
Write-Ok "========================================"
Write-Ok "  PRism 已启动"
Write-Ok "  前端:     http://localhost:3000"
Write-Ok "  API:      http://localhost:3001"
Write-Ok "  API 文档: http://localhost:3001/docs"
Write-Ok "========================================"
Write-Host ""
Write-Host "查看日志: docker compose -f deploy/docker-compose.yml logs -f"
Write-Host "停止服务: docker compose -f deploy/docker-compose.yml down"
if (-not $useEngine) {
    Write-Host ""
    Write-Host "当前为 stub 模式。需要 C++ 引擎: deploy/.env 设 PRISM_STUB_ENGINE=0 后重新部署。"
}
