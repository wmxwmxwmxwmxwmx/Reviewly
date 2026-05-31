#Requires -Version 5.1
# Reviewly 部署共享工具（Windows）

function Write-ReviewlyLog {
    param(
        [Parameter(Mandatory = $true)][string]$Message,
        [ValidateSet("Info", "Warn", "Error", "Success")]
        [string]$Level = "Info"
    )
    $prefix = "[Reviewly]"
    switch ($Level) {
        "Warn" { Write-Host "$prefix $Message" -ForegroundColor Yellow }
        "Error" { Write-Host "$prefix $Message" -ForegroundColor Red }
        "Success" { Write-Host "$prefix $Message" -ForegroundColor Green }
        default { Write-Host "$prefix $Message" }
    }
}

function Test-IsAdmin {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Invoke-DockerCommand {
    <#
    .SYNOPSIS
      调用 docker CLI；仅以进程 ExitCode 判断成败，不触发 PowerShell NativeCommandError。
    .OUTPUTS
      PSCustomObject：ExitCode (int)、Output (string)
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Args,

        [switch]$Quiet
    )

    $dockerExe = "docker"
    $cmd = Get-Command docker -ErrorAction SilentlyContinue
    if ($cmd -and $cmd.Source) {
        $dockerExe = $cmd.Source
    }

    $stdoutFile = [System.IO.Path]::GetTempFileName()
    $stderrFile = [System.IO.Path]::GetTempFileName()
    try {
        $proc = Start-Process `
            -FilePath $dockerExe `
            -ArgumentList $Args `
            -NoNewWindow `
            -Wait `
            -PassThru `
            -RedirectStandardOutput $stdoutFile `
            -RedirectStandardError $stderrFile

        $stdout = ""
        $stderr = ""
        if (Test-Path -LiteralPath $stdoutFile) {
            $stdout = [System.IO.File]::ReadAllText($stdoutFile)
        }
        if (Test-Path -LiteralPath $stderrFile) {
            $stderr = [System.IO.File]::ReadAllText($stderrFile)
        }

        if (-not $Quiet) {
            if ($stdout.Length -gt 0) {
                Write-Host $stdout.TrimEnd("`r", "`n")
            }
            if ($stderr.Length -gt 0) {
                Write-Host $stderr.TrimEnd("`r", "`n")
            }
        }

        $combined = $stdout
        if ($stderr.Length -gt 0) {
            if ($combined.Length -gt 0) { $combined += "`n" }
            $combined += $stderr
        }

        return [PSCustomObject]@{
            ExitCode = [int]$proc.ExitCode
            Output   = $combined
        }
    } finally {
        Remove-Item -LiteralPath $stdoutFile, $stderrFile -Force -ErrorAction SilentlyContinue
    }
}

function Test-DockerReady {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        return $false
    }
    if ((Invoke-DockerCommand -Args @("version") -Quiet).ExitCode -ne 0) { return $false }
    if ((Invoke-DockerCommand -Args @("info") -Quiet).ExitCode -ne 0) { return $false }
    if ((Invoke-DockerCommand -Args @("compose", "version") -Quiet).ExitCode -ne 0) { return $false }
    return $true
}

function Wait-DockerReady {
    param(
        [int]$TimeoutSeconds = 120,
        [int]$IntervalSeconds = 3
    )
    Write-ReviewlyLog "正在检测 Docker daemon..."
    $elapsed = 0
    while ($elapsed -lt $TimeoutSeconds) {
        if (Test-DockerReady) {
            Write-ReviewlyLog "Docker daemon 已就绪。" -Level Success
            return $true
        }
        Write-ReviewlyLog "等待 Docker 启动中... 已等待 $elapsed 秒..."
        Start-Sleep -Seconds $IntervalSeconds
        $elapsed += $IntervalSeconds
    }
    Write-ReviewlyLog "Docker 在 $TimeoutSeconds 秒内未就绪，请确认 Docker Desktop 已启动并完成初始化。" -Level Error
    return $false
}

function Get-DockerDesktopPath {
    $candidates = @(
        Join-Path $env:ProgramFiles "Docker\Docker\Docker Desktop.exe"
        Join-Path $env:LOCALAPPDATA "Programs\Docker\Docker\Docker Desktop.exe"
    )
    foreach ($path in $candidates) {
        if (Test-Path $path) { return $path }
    }
    return $null
}

function Start-DockerDesktopApp {
    $exe = Get-DockerDesktopPath
    if (-not $exe) {
        Write-ReviewlyLog "未找到 Docker Desktop 程序。若已安装，请从开始菜单手动启动。" -Level Warn
        return $false
    }
    Write-ReviewlyLog "正在启动 Docker Desktop..."
    Start-Process -FilePath $exe | Out-Null
    return $true
}

function Test-WingetAvailable {
    return [bool](Get-Command winget -ErrorAction SilentlyContinue)
}

function Exit-ReviewlyWithPause {
    param(
        [int]$ExitCode,
        [string]$Message
    )
    Write-ReviewlyLog $Message -Level Error
    if ([Environment]::UserInteractive) {
        Read-Host "按回车退出"
    }
    exit $ExitCode
}
