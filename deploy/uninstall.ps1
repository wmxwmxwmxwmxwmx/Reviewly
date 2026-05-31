#Requires -Version 7.0
<#
.SYNOPSIS
  Reviewly (PRism) 安全卸载：仅移除本项目创建的资源。

.PARAMETER Purge
  额外删除配置、node_modules、.next、Python venv 等（需确认）。

.EXAMPLE
  .\deploy\uninstall.ps1

.EXAMPLE
  .\deploy\uninstall.ps1 -Purge
#>
param(
    [switch]$Purge,
    [switch]$Help
)

$ErrorActionPreference = "Continue"

if ($Help) {
    @"
用法: .\deploy\uninstall.ps1 [-Purge] [-Help]

  默认保留 deploy\.env 等配置；仅清理 Reviewly 容器、卷、网络与本地缓存。

  -Purge  彻底删除配置与构建产物（执行前需确认）

禁止：docker system prune / docker volume prune
"@
    exit 0
}

$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $Root

. (Join-Path $PSScriptRoot "cleanup.ps1")

if ($Purge) {
    if (-not (Confirm-ReviewlyPurge)) {
        Write-Host "已取消。"
        exit 0
    }
}

Write-Host "Reviewly Uninstaller"
Write-Host ""

if (Test-ReviewlyDocker) {
    Invoke-ReviewlyComposeDown (Join-Path $Root "deploy\docker-compose.yml")
    Invoke-ReviewlyComposeDown (Join-Path $Root "docker-compose.yml")

    foreach ($name in $script:ReviewlyContainers) {
        Stop-ReviewlyContainer $name
    }
    foreach ($name in $script:ReviewlyContainers) {
        Remove-ReviewlyContainer $name
    }
    foreach ($net in $script:ReviewlyNetworks) {
        Remove-ReviewlyNetwork $net
    }
    foreach ($vol in $script:ReviewlyVolumes) {
        Remove-ReviewlyVolume $vol
    }
} else {
    Write-ReviewlyInfo "Docker 不可用，跳过容器/卷/网络清理"
}

Remove-ReviewlyLocalDirs $Root

if ($Purge) {
    Invoke-ReviewlyPurgeFiles $Root
}

Write-ReviewlyOk "Stopped Containers"
Write-ReviewlyOk "Removed Containers"
Write-ReviewlyOk "Removed Volumes"
Write-ReviewlyOk "Removed Cache"
Write-ReviewlyOk "Removed Logs"
Write-ReviewlyOk "Completed"

Write-Host ""
if ($Purge) {
    Write-Host "Reviewly 运行资源与本地配置/构建产物已清理（Purge）。"
} else {
    Write-Host "Reviewly 运行资源已清理。配置仍保留。"
    Write-Host "彻底删除: .\deploy\uninstall.ps1 -Purge"
}
