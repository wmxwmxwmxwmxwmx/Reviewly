#Requires -Version 5.1
<#
.SYNOPSIS
  Windows：安装 / 启动 Docker Desktop 并等待 daemon 就绪。
#>
param(
    [switch]$Yes,
    [switch]$Elevated
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "utils.ps1")

function Invoke-ElevatedInstallDocker {
    $installScript = Join-Path $PSScriptRoot "install-docker.ps1"
    $argList = @(
        "-NoProfile",
        "-ExecutionPolicy", "Bypass",
        "-File", "`"$installScript`"",
        "-Elevated"
    )
    if ($Yes) { $argList += "-Yes" }
    Write-ReviewlyLog "需要管理员权限安装 Docker Desktop，请在 UAC 提示中选择「是」..."
    try {
        $proc = Start-Process -FilePath "powershell.exe" -ArgumentList $argList -Verb RunAs -Wait -PassThru
        return $proc.ExitCode
    } catch {
        Write-ReviewlyLog "无法提升权限：$($_.Exception.Message)" -Level Error
        return 1
    }
}

function Install-DockerDesktopWithWinget {
    if (-not (Test-WingetAvailable)) {
        Write-ReviewlyLog "未找到 winget（App Installer）。请手动安装 Docker Desktop：" -Level Error
        Write-Host "  https://www.docker.com/products/docker-desktop/"
        Write-Host "  或安装 winget: https://aka.ms/getwinget"
        return $false
    }

    Write-ReviewlyLog "正在通过 winget 安装 Docker Desktop（首次可能需数分钟）..."
    & winget install -e --id Docker.DockerDesktop `
        --accept-package-agreements `
        --accept-source-agreements

    $code = $LASTEXITCODE
    if ($code -eq 0) {
        Write-ReviewlyLog "winget 安装完成。" -Level Success
        return $true
    }

    if (Get-Command docker -ErrorAction SilentlyContinue) {
        Write-ReviewlyLog "winget 返回 $code，但已检测到 docker 命令，继续。" -Level Warn
        return $true
    }

    Write-ReviewlyLog "winget 安装失败（退出码 $code）。" -Level Error
    Write-Host "  可尝试以管理员身份运行 deploy.bat，或手动安装："
    Write-Host "  https://www.docker.com/products/docker-desktop/"
    return $false
}

function Ensure-DockerEnvironment {
    if (Test-DockerReady) {
        Write-ReviewlyLog "Docker 已就绪，跳过安装。"
        return 0
    }

    $hasDockerCli = [bool](Get-Command docker -ErrorAction SilentlyContinue)

    if (-not $hasDockerCli) {
        if (-not (Test-IsAdmin) -and -not $Elevated) {
            $elevatedCode = Invoke-ElevatedInstallDocker
            if ($elevatedCode -ne 0) {
                return $elevatedCode
            }
            Start-DockerDesktopApp | Out-Null
            if (Wait-DockerReady -TimeoutSeconds 120) { return 0 }
            return 1
        }

        if (-not (Install-DockerDesktopWithWinget)) {
            return 1
        }
    } else {
        Write-ReviewlyLog "已检测到 Docker CLI，等待 daemon 就绪..."
    }

    if (-not (Test-DockerReady)) {
        Start-DockerDesktopApp | Out-Null
    }

    if (Wait-DockerReady -TimeoutSeconds 120) {
        return 0
    }
    return 1
}

try {
    $exitCode = Ensure-DockerEnvironment
    exit $exitCode
} catch {
    Write-ReviewlyLog "install-docker 异常：$($_.Exception.Message)" -Level Error
    exit 1
}
