#Requires -Version 5.1
param(
    [switch]$Yes,
    [switch]$StubEngine,
    [switch]$WithEngine,
    [switch]$SkipBuild,
    [switch]$Help
)

$ErrorActionPreference = "Stop"
# docker CLI 常向 stderr 输出；PS 7+ 勿将其当作终止错误
if ($PSVersionTable.PSVersion.Major -ge 7) {
    $PSNativeCommandUseErrorActionPreference = $false
}

function Invoke-DockerCli {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$DockerArgs)
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        & docker @DockerArgs 2>$null | Out-Null
        return $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $prevEap
    }
}

if ($Help) {
    @"
用法: .\deploy\deploy.ps1 [-Yes] [-StubEngine] [-WithEngine] [-SkipBuild]

  -Yes          不询问，自动生成 .env 与密钥
  -StubEngine   跳过 C++ 引擎（推荐新机）
  -WithEngine   构建 C++ 引擎
  -SkipBuild    跳过镜像构建（使用已有镜像）
"@
    exit 0
}

$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $Root

$ComposeFile = Join-Path $Root "deploy\docker-compose.yml"
$EnvFile = Join-Path $Root "deploy\.env"
$EnvExample = Join-Path $Root "deploy\.env.example"
$GatewayEnv = Join-Path $Root "services\gateway\.env"

function Write-Step([string]$Message) {
    if ($Yes) { Write-Host $Message }
    else { Write-Host $Message -ForegroundColor Yellow }
}
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

$DeployOnlyKeys = @("DATABASE_URL", "ENGINE_GRPC_ADDR", "API_URL", "PRISM_REPO_CACHE_DIR")

function Merge-GatewayEnv {
    if (-not (Test-Path $GatewayEnv)) { return }
    $lines = Get-Content $GatewayEnv -Encoding UTF8
    foreach ($line in $lines) {
        $trimmed = $line.Trim()
        if (-not $trimmed -or $trimmed.StartsWith("#")) { continue }
        if ($trimmed -notmatch "=") { continue }
        $key = $trimmed.Split("=", 2)[0].Trim()
        if ($DeployOnlyKeys -contains $key) { continue }
        $value = $trimmed.Split("=", 2)[1]
        Set-EnvKey $EnvFile $key $value
    }
}

function Fix-DockerDeployEnv {
    Set-EnvKey $EnvFile "DATABASE_URL" "postgresql+psycopg://prism:prism@postgres:5432/prism"
    Set-EnvKey $EnvFile "ENGINE_GRPC_ADDR" "engine:50051"
    Set-EnvKey $EnvFile "API_URL" "http://gateway:3001"
}

function Clear-PlaceholderEnvKeys {
    $keys = @("GITHUB_OAUTH_CLIENT_ID", "GITHUB_OAUTH_CLIENT_SECRET", "GITHUB_PAT")
    foreach ($key in $keys) {
        $line = Select-String -Path $EnvFile -Pattern "^\s*$([regex]::Escape($key))\s*=" -ErrorAction SilentlyContinue
        if (-not $line) { continue }
        $val = ($line.Line -split "=", 2)[1]
        if ($val -match '<your-|your-client|your-pat|changeme|replace-me') {
            Set-EnvKey $EnvFile $key ""
        }
    }
}

function Test-OAuthConfigured {
    $cid = (Select-String -Path $EnvFile -Pattern '^GITHUB_OAUTH_CLIENT_ID=' -ErrorAction SilentlyContinue | Select-Object -First 1)
    $sec = (Select-String -Path $EnvFile -Pattern '^GITHUB_OAUTH_CLIENT_SECRET=' -ErrorAction SilentlyContinue | Select-Object -First 1)
    $cidVal = if ($cid) { ($cid.Line -split "=", 2)[1].Trim() } else { "" }
    $secVal = if ($sec) { ($sec.Line -split "=", 2)[1].Trim() } else { "" }
    if (-not $cidVal -or -not $secVal) { return $false }
    if ($cidVal -match '<your-|your-client' -or $secVal -match '<your-|your-client') { return $false }
    return $true
}

function Set-PublicUrls([string]$FrontendUrl) {
    $front = if ($FrontendUrl) { $FrontendUrl.TrimEnd("/") } else { "http://localhost:3000" }
    if ($front -match '^(https?)://([^:/]+)') {
        $scheme = $Matches[1]
        $hostName = $Matches[2]
        $callback = "${scheme}://${hostName}:3001/api/auth/github/callback"
    } else {
        $callback = "http://localhost:3001/api/auth/github/callback"
        $front = "http://localhost:3000"
    }
    Set-EnvKey $EnvFile "FRONTEND_URL" $front
    Set-EnvKey $EnvFile "APP_URL" $front
    Set-EnvKey $EnvFile "OAUTH_CALLBACK_URL" $callback
    return $callback
}

function Stop-ExistingStack {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { return }
    if (Test-Path $ComposeFile) {
        docker compose -f $ComposeFile down --remove-orphans 2>$null | Out-Null
    }
    $devCompose = Join-Path $Root "docker-compose.yml"
    if (Test-Path $devCompose) {
        docker compose -f $devCompose down --remove-orphans 2>$null | Out-Null
    }
}

function Ensure-GithubOAuth {
    if (-not (Test-Path $EnvFile)) {
        Copy-Item $EnvExample $EnvFile
    }
    Merge-GatewayEnv
    Fix-DockerDeployEnv
    Clear-PlaceholderEnvKeys

    if (Test-OAuthConfigured) {
        if (-not $Yes) { Write-Host "  GitHub OAuth 已就绪" -ForegroundColor Green }
        return $true
    }

    $envCid = $env:GITHUB_OAUTH_CLIENT_ID
    $envSec = $env:GITHUB_OAUTH_CLIENT_SECRET
    if ($envCid -and $envSec) {
        $null = Set-PublicUrls -FrontendUrl $env:PRISM_PUBLIC_URL
        Set-EnvKey $EnvFile "GITHUB_OAUTH_CLIENT_ID" $envCid.Trim()
        Set-EnvKey $EnvFile "GITHUB_OAUTH_CLIENT_SECRET" $envSec.Trim()
        Set-EnvKey $EnvFile "PRISM_AUTH_BYPASS" "0"
        if (-not $Yes) { Write-Host "  已从环境变量写入 GitHub OAuth" -ForegroundColor Green }
        return $true
    }

    if ($Yes) {
        $null = Set-PublicUrls -FrontendUrl "http://localhost:3000"
        Set-EnvKey $EnvFile "PRISM_AUTH_BYPASS" "1"
        return $true
    }

    Write-Host ""
    Write-Host "── GitHub OAuth 配置（登录必需）──" -ForegroundColor Green
    Write-Host "在 https://github.com/settings/developers 创建 OAuth App"
    $front = Read-Host '浏览器访问前端的地址 [http://localhost:3000]'
    if (-not $front) { $front = "http://localhost:3000" }
    $callback = Set-PublicUrls -FrontendUrl $front
    Write-Host ""
    Write-Host "请在 GitHub OAuth App 中设置 Authorization callback URL 为：" -ForegroundColor Yellow
    Write-Host "  $callback"
    Write-Host ""
    $cid = Read-Host "GitHub OAuth Client ID"
    $sec = Read-Host "GitHub OAuth Client Secret"
    if (-not $cid.Trim() -or -not $sec.Trim()) {
        Write-Host "  Client ID / Secret 不能为空" -ForegroundColor Red
        return $false
    }
    Set-EnvKey $EnvFile "GITHUB_OAUTH_CLIENT_ID" $cid.Trim()
    Set-EnvKey $EnvFile "GITHUB_OAUTH_CLIENT_SECRET" $sec.Trim()
    Set-EnvKey $EnvFile "PRISM_AUTH_BYPASS" "0"
    Write-Host "  GitHub OAuth 已写入 deploy/.env" -ForegroundColor Green
    return $true
}

function Initialize-DeployEnv {
    param([bool]$FirstDeploy)
    if (-not (Test-Path $EnvFile)) {
        Copy-Item $EnvExample $EnvFile
        Merge-GatewayEnv
        Write-Host "  已创建 deploy/.env" -ForegroundColor Yellow
    }
    Clear-PlaceholderEnvKeys
    Fix-DockerDeployEnv
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
        if (-not $Yes) {
            Write-Host "  首次部署已设 PRISM_STUB_ENGINE=1（跳过 C++ 编译）" -ForegroundColor Yellow
        }
    }
    if (-not $Yes) {
        Write-Host "  配置已保存。按 Enter 开始构建镜像，Ctrl+C 取消" -ForegroundColor Yellow
        Read-Host
    }
}

function Require-GithubOAuthOrExit {
    if ($Yes) {
        if (-not (Ensure-GithubOAuth)) {
            $null = Set-PublicUrls -FrontendUrl "http://localhost:3000"
            Set-EnvKey $EnvFile "PRISM_AUTH_BYPASS" "1"
        }
        return
    }
    if (Ensure-GithubOAuth) { return }
    $skip = Read-Host '跳过 GitHub 配置并启用开发模式? [y/N]'
    if ($skip -match '^[yY]') {
        Set-EnvKey $EnvFile "PRISM_AUTH_BYPASS" "1"
        Write-Host "  已启用 PRISM_AUTH_BYPASS=1" -ForegroundColor Yellow
        return
    }
    Write-Err "未配置 GitHub OAuth，部署已取消。"
    exit 1
}

function Test-Docker {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        Write-Err "未检测到 Docker CLI。请先安装 Docker Desktop:"
        Write-Host "  https://www.docker.com/products/docker-desktop/"
        Write-Host "  或: winget install Docker.DockerDesktop"
        Write-Host ""
        Write-Host "无 Docker 时可改用本地开发: npm run dev:local" -ForegroundColor Yellow
        exit 1
    }
    if ((Invoke-DockerCli compose version) -ne 0) {
        Write-Err "未检测到 docker compose。请更新 Docker Desktop。"
        exit 1
    }
    if ((Invoke-DockerCli info) -ne 0) {
        Write-Host ""
        Write-Err "Docker 引擎未运行（无法连接 dockerDesktopLinuxEngine）。"
        Write-Host "  1. 打开 Docker Desktop，等待左下角显示 Engine running / Ready" -ForegroundColor Yellow
        Write-Host "  2. 再执行: npm run dev" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "  无 Docker 时可改用: npm run dev:local" -ForegroundColor Yellow
        exit 1
    }
}

function Invoke-Compose {
    param([string[]]$ComposeArgs)
    & docker compose -f $ComposeFile --env-file $EnvFile @ComposeArgs
    if ($LASTEXITCODE -ne 0) { throw "docker compose failed: $($ComposeArgs -join ' ')" }
}

function Test-PortInUse([int]$Port, [string]$Name) {
    $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if ($conn) {
        Write-Err "端口 $Port ($Name) 已被占用"
        exit 1
    }
}

Write-Step '[1/7] 检查运行环境...'
Test-Docker
Stop-ExistingStack
try {
    Test-PortInUse -Port 5432 -Name "PostgreSQL"
    Test-PortInUse -Port 3001 -Name "Gateway"
    Test-PortInUse -Port 3000 -Name "Web"
} catch { }

$firstDeploy = -not (Test-Path $EnvFile)
Write-Step '[2/7] 准备 deploy/.env ...'
Initialize-DeployEnv -FirstDeploy:$firstDeploy
Require-GithubOAuthOrExit

$useEngine = -not (Select-String -Path $EnvFile -Pattern '^PRISM_STUB_ENGINE=1' -Quiet)
if (-not $useEngine) {
    Write-Host "  PRISM_STUB_ENGINE=1，将跳过 engine 容器" -ForegroundColor Yellow
}

Write-Step '[3/7] 构建 Docker 镜像（首次较慢）...'
function Build-PrismImages {
    if ($useEngine) {
        Invoke-Compose @("build")
    } else {
        Invoke-Compose @("build", "postgres", "gateway", "web")
    }
}

if ($SkipBuild) {
    Write-Host "  跳过镜像构建（使用已有镜像）" -ForegroundColor Yellow
    $gwImg = & docker compose -f $ComposeFile --env-file $EnvFile images -q gateway 2>$null
    $webImg = & docker compose -f $ComposeFile --env-file $EnvFile images -q web 2>$null
    if (-not $gwImg -or -not $webImg) {
        Write-Host "  未找到 gateway/web 镜像，改为构建..." -ForegroundColor Yellow
        Build-PrismImages
    }
} else {
    Build-PrismImages
}

Write-Step '[4/7] 启动 PostgreSQL...'
Invoke-Compose @("up", "-d", "postgres")

Write-Step '[5/7] 等待 PostgreSQL...'
for ($i = 1; $i -le 30; $i++) {
    & docker compose -f $ComposeFile --env-file $EnvFile exec -T postgres pg_isready -U prism -d prism 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Ok "  PostgreSQL 已就绪"
        break
    }
    Start-Sleep -Seconds 2
}

$gatewayStepLabel = '[6/7] 启动 Gateway'
if ($useEngine) {
    $gatewayStepLabel += " 与 Engine"
}
$gatewayStepLabel += "..."
Write-Step $gatewayStepLabel
if ($useEngine) {
    Invoke-Compose @("up", "-d", "gateway", "engine")
} else {
    Invoke-Compose @("up", "-d", "gateway")
}

for ($i = 1; $i -le 30; $i++) {
    try {
        $null = Invoke-WebRequest -Uri "http://localhost:3001/health" -UseBasicParsing -TimeoutSec 3
        Write-Ok "  Gateway 已就绪"; break
    } catch { Start-Sleep -Seconds 2 }
}

Write-Step '[7/7] 启动 Web...'
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
