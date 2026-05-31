#Requires -Version 5.1
$ErrorActionPreference = "Stop"

$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $Root

$ComposeFile = Join-Path $Root "deploy\docker-compose.yml"
$EnvFile = Join-Path $Root "deploy\.env"
$EnvExample = Join-Path $Root "deploy\.env.example"
$GatewayEnv = Join-Path $Root "services\gateway\.env"

function Write-Step([string]$Message, [string]$Color = "Yellow") {
    Write-Host $Message -ForegroundColor $Color
}

function Test-PortInUse([int]$Port, [string]$Name) {
    $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if ($conn) {
        Write-Host "Port $Port ($Name) is already in use. Stop the conflicting process or change port mapping." -ForegroundColor Red
        exit 1
    }
}

function Merge-GatewayEnv {
    param([string]$DeployEnvPath, [string]$GatewayEnvPath)
    if (-not (Test-Path $GatewayEnvPath)) { return }
    $lines = Get-Content $GatewayEnvPath -Encoding UTF8
    $deployLines = @(Get-Content $DeployEnvPath -Encoding UTF8)
    foreach ($line in $lines) {
        $trimmed = $line.Trim()
        if (-not $trimmed -or $trimmed.StartsWith("#")) { continue }
        if ($trimmed -notmatch "=") { continue }
        $key = $trimmed.Split("=", 2)[0].Trim()
        $value = $trimmed.Split("=", 2)[1]
        $found = $false
        for ($i = 0; $i -lt $deployLines.Count; $i++) {
            if ($deployLines[$i] -match "^\s*$([regex]::Escape($key))\s*=") {
                $deployLines[$i] = "${key}=${value}"
                $found = $true
                break
            }
        }
        if (-not $found) {
            $deployLines += "${key}=${value}"
        }
    }
    $deployLines | Set-Content $DeployEnvPath -Encoding UTF8
}

function Invoke-Compose {
    param([string[]]$Args)
    & docker compose -f $ComposeFile --env-file $EnvFile @Args
    if ($LASTEXITCODE -ne 0) { throw "docker compose failed: $($Args -join ' ')" }
}

Write-Step "[1/7] Checking prerequisites..."
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "docker not found" -ForegroundColor Red
    exit 1
}
& docker compose version *> $null
if ($LASTEXITCODE -ne 0) {
    Write-Host "docker compose not found" -ForegroundColor Red
    exit 1
}

try {
    Test-PortInUse -Port 5432 -Name "PostgreSQL"
    Test-PortInUse -Port 3001 -Name "Gateway"
    Test-PortInUse -Port 3000 -Name "Web"
} catch {
    # Get-NetTCPConnection may be unavailable on some SKUs; skip port check
    Write-Host "  (Port check skipped: $($_.Exception.Message))" -ForegroundColor DarkYellow
}

Write-Step "[2/7] Setting up environment..."
if (-not (Test-Path $EnvFile)) {
    Copy-Item $EnvExample $EnvFile
    Merge-GatewayEnv -DeployEnvPath $EnvFile -GatewayEnvPath $GatewayEnv
    Write-Host "  deploy/.env created. Review JWT_SECRET / OAuth / encryption keys if needed." -ForegroundColor Yellow
    Read-Host "Press Enter to continue or Ctrl+C to abort"
}

Write-Step "[3/7] Building Docker images..."
Invoke-Compose @("build")

Write-Step "[4/7] Starting PostgreSQL..."
Invoke-Compose @("up", "-d", "postgres")

Write-Step "[5/7] Waiting for PostgreSQL..."
$pgReady = $false
for ($i = 1; $i -le 30; $i++) {
    & docker compose -f $ComposeFile --env-file $EnvFile exec -T postgres pg_isready -U prism -d prism 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  PostgreSQL is ready." -ForegroundColor Green
        $pgReady = $true
        break
    }
    Start-Sleep -Seconds 2
}
if (-not $pgReady) {
    Write-Host "  PostgreSQL did not become ready in time." -ForegroundColor Red
}

Write-Step "[6/7] Starting Gateway & Engine..."
Invoke-Compose @("up", "-d", "gateway", "engine")

$gatewayOk = $false
for ($i = 1; $i -le 30; $i++) {
    try {
        $null = Invoke-WebRequest -Uri "http://localhost:3001/health" -UseBasicParsing -TimeoutSec 3
        Write-Host "  Gateway is healthy." -ForegroundColor Green
        $gatewayOk = $true
        break
    } catch {
        Start-Sleep -Seconds 2
    }
}
if (-not $gatewayOk) {
    Write-Host "  Gateway health check timed out; see logs." -ForegroundColor Yellow
}

Write-Step "[7/7] Starting Web..."
Invoke-Compose @("up", "-d", "web")

$webOk = $false
for ($i = 1; $i -le 20; $i++) {
    try {
        $null = Invoke-WebRequest -Uri "http://localhost:3000/" -UseBasicParsing -TimeoutSec 3
        Write-Host "  Web is healthy." -ForegroundColor Green
        $webOk = $true
        break
    } catch {
        Start-Sleep -Seconds 2
    }
}
if (-not $webOk) {
    Write-Host "  Web health check timed out; see logs." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  PRism is now running!" -ForegroundColor Green
Write-Host "  Frontend:  http://localhost:3000" -ForegroundColor Green
Write-Host "  API:       http://localhost:3001" -ForegroundColor Green
Write-Host "  API Docs:  http://localhost:3001/docs" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "To view logs:  docker compose -f deploy/docker-compose.yml logs -f"
Write-Host "To stop:       docker compose -f deploy/docker-compose.yml down"
