# Reviewly / PRism 卸载共享函数（仅操作白名单资源）

$script:ReviewlyUtilsPath = Join-Path $PSScriptRoot "utils.ps1"
if (Test-Path -LiteralPath $script:ReviewlyUtilsPath) {
    . $script:ReviewlyUtilsPath
}

$script:ReviewlyContainers = @(
    "prism-postgres", "prism-gateway", "prism-web", "prism-engine",
    "reviewly-postgres", "reviewly-gateway", "reviewly-web", "reviewly-engine"
)

$script:ReviewlyVolumes = @(
    "prism_pgdata", "prism_repo-cache", "prism_pg_data",
    "reviewly_pg_data", "reviewly_repo_cache", "reviewly_logs"
)

$script:ReviewlyNetworks = @(
    "prism_prism-net", "prism-net", "reviewly-network", "reviewly_prism-net"
)

$script:ReviewlyLocalDirs = @(
    "data\repo-cache", "logs", "tmp"
)

function Write-ReviewlyOk([string]$Message) {
    Write-Host "[✓] $Message"
}

function Write-ReviewlyInfo([string]$Message) {
    Write-Host "[INFO] $Message"
}

function Test-ReviewlyDocker {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { return $false }
    docker info 2>$null | Out-Null
    return $LASTEXITCODE -eq 0
}

function Test-ReviewlyContainer([string]$Name) {
    $names = docker ps -a --format "{{.Names}}" 2>$null
    if (-not $names) { return $false }
    return ($names | Where-Object { $_ -eq $Name }).Count -gt 0
}

function Stop-ReviewlyContainer([string]$Name) {
    if (-not (Test-ReviewlyDocker)) { return }
    if (Test-ReviewlyContainer $Name) {
        docker stop $Name 2>$null | Out-Null
    } else {
        Write-ReviewlyInfo "Container not found"
    }
}

function Remove-ReviewlyContainer([string]$Name) {
    if (-not (Test-ReviewlyDocker)) { return }
    if (Test-ReviewlyContainer $Name) {
        docker rm -f $Name 2>$null | Out-Null
    } else {
        Write-ReviewlyInfo "Container not found"
    }
}

function Test-ReviewlyVolume([string]$Name) {
    $names = docker volume ls --format "{{.Name}}" 2>$null
    if (-not $names) { return $false }
    return ($names | Where-Object { $_ -eq $Name }).Count -gt 0
}

function Remove-ReviewlyVolume([string]$Name) {
    if (-not (Test-ReviewlyDocker)) { return }
    if (Test-ReviewlyVolume $Name) {
        docker volume rm $Name 2>$null | Out-Null
    } else {
        Write-ReviewlyInfo "Volume not found"
    }
}

function Test-ReviewlyNetwork([string]$Name) {
    $names = docker network ls --format "{{.Name}}" 2>$null
    if (-not $names) { return $false }
    return ($names | Where-Object { $_ -eq $Name }).Count -gt 0
}

function Remove-ReviewlyNetwork([string]$Name) {
    if (-not (Test-ReviewlyDocker)) { return }
    if (Test-ReviewlyNetwork $Name) {
        docker network rm $Name 2>$null | Out-Null
    } else {
        Write-ReviewlyInfo "Network not found"
    }
}

function Invoke-ReviewlyComposeDown([string]$ComposeFile) {
    if (-not (Test-ReviewlyDocker)) { return }
    if (-not (Test-Path $ComposeFile)) { return }
    if (Get-Command Invoke-DockerCommand -ErrorAction SilentlyContinue) {
        $null = Invoke-DockerCommand -Args @("compose", "-f", $ComposeFile, "down", "--remove-orphans") -Quiet
        return
    }
    docker compose -f $ComposeFile down --remove-orphans 2>$null | Out-Null
}

function Remove-ReviewlyLocalDirs([string]$Root) {
    foreach ($rel in $script:ReviewlyLocalDirs) {
        $target = Join-Path $Root $rel
        if (Test-Path $target) {
            Remove-Item -LiteralPath $target -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
}

function Get-ReviewlyDirSize([string]$Path) {
    if (-not (Test-Path $Path)) { return "0 B" }
    $items = Get-ChildItem -LiteralPath $Path -Recurse -Force -ErrorAction SilentlyContinue
    if (-not $items) { return "0 B" }
    $bytes = ($items | Measure-Object -Property Length -Sum).Sum
    if ($bytes -ge 1GB) { return "{0:N2} GB" -f ($bytes / 1GB) }
    if ($bytes -ge 1MB) { return "{0:N2} MB" -f ($bytes / 1MB) }
    if ($bytes -ge 1KB) { return "{0:N2} KB" -f ($bytes / 1KB) }
    return "$bytes B"
}

function Confirm-ReviewlyPurge {
    @"
================================
即将永久删除：

Reviewly 数据库
Reviewly 缓存
Reviewly 配置

是否继续？

[y/N]
================================
"@ | Write-Host
    $answer = Read-Host ">"
    return $answer -match '^(y|yes)$' -or $answer -eq 'Y' -or $answer -eq 'YES'
}

function Invoke-ReviewlyPurgeFiles([string]$Root) {
    $envTargets = @(
        "deploy\.env", "deploy\.env.production",
        ".env", ".env.production",
        "services\gateway\.env", "services\gateway\.env.production"
    )
    foreach ($rel in $envTargets) {
        $path = Join-Path $Root $rel
        if (Test-Path $path) { Remove-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue }
    }

    $dirTargets = @(
        "apps\web\.next", "apps\web\node_modules", "node_modules",
        "services\gateway\.venv", ".venv", "venv", "deploy\.next"
    )
    foreach ($rel in $dirTargets) {
        $path = Join-Path $Root $rel
        if (Test-Path $path) {
            Remove-Item -LiteralPath $path -Recurse -Force -ErrorAction SilentlyContinue
        }
    }

    $compose = Join-Path $Root "deploy\docker-compose.yml"
    if ((Test-ReviewlyDocker) -and (Test-Path $compose)) {
        $ids = docker compose -f $compose images -q 2>$null
        if ($ids) {
            docker rmi -f $ids 2>$null | Out-Null
        }
    }
}

function Get-ReviewlyDeployStats([string]$Root) {
    $containerCount = 0
    $volumeCount = 0
    if (Test-ReviewlyDocker) {
        foreach ($name in $script:ReviewlyContainers) {
            if (Test-ReviewlyContainer $name) { $containerCount++ }
        }
        foreach ($name in $script:ReviewlyVolumes) {
            if (Test-ReviewlyVolume $name) { $volumeCount++ }
        }
    }
    $repoCache = Join-Path $Root "data\repo-cache"
    $logsDir = Join-Path $Root "logs"
    [PSCustomObject]@{
        ContainerCount = $containerCount
        VolumeCount    = $volumeCount
        RepoCacheSize  = Get-ReviewlyDirSize $repoCache
        LogsSize       = Get-ReviewlyDirSize $logsDir
        CacheSize      = Get-ReviewlyDirSize (Join-Path $Root "tmp")
    }
}
