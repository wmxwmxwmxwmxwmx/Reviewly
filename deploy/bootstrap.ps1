#Requires -Version 5.1
# 一键安装：自动安装/启动 Docker → 静默部署
param([switch]$Help)

$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
. (Join-Path $PSScriptRoot "utils.ps1")

function Ensure-DockerForDeploy {
    if (Test-DockerReady) {
        return 0
    }
    Write-ReviewlyLog "正在准备 Docker 环境（安装 / 启动 / 等待就绪）..."
    $installScript = Join-Path $PSScriptRoot "install-docker.ps1"
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $installScript -Yes
    if ($LASTEXITCODE -ne 0) {
        return $LASTEXITCODE
    }
    if (-not (Test-DockerReady)) {
        return 1
    }
    return 0
}

if ($Help) {
    Write-Host "用法: .\deploy\bootstrap.ps1  或双击 deploy.bat"
    exit 0
}

Write-ReviewlyLog "一键安装中..."

$dockerExit = Ensure-DockerForDeploy
if ($dockerExit -ne 0) {
    Exit-ReviewlyWithPause $dockerExit "Docker 环境未就绪，无法继续部署。"
}

Write-ReviewlyLog "Docker 已就绪，开始部署应用栈..." -Level Success

$deployScript = Join-Path $Root "deploy\deploy.ps1"
$deployArgs = @("-Yes", "-StubEngine")
if (Test-DeployEnvReady -Root $Root) {
    $deployArgs += @("-QuickStart", "-SkipBuild")
}

& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $deployScript @deployArgs
$deployExit = $LASTEXITCODE

if ($deployExit -ne 0) {
    Exit-ReviewlyWithPause $deployExit "deploy.ps1 执行失败（退出码 $deployExit）。"
}

Write-ReviewlyLog "应用栈部署完成。" -Level Success
exit 0
