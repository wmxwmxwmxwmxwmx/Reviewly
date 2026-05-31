#Requires -Version 5.1
# 部署前 PowerShell 脚本语法自检
param([switch]$Help)

$ErrorActionPreference = "Stop"

if ($Help) {
    Write-Host "用法: powershell -NoProfile -File deploy\validate-scripts.ps1"
    exit 0
}

$scriptDir = $PSScriptRoot
$targets = @(
    (Join-Path $scriptDir "bootstrap.ps1"),
    (Join-Path $scriptDir "deploy.ps1"),
    (Join-Path $scriptDir "utils.ps1"),
    (Join-Path $scriptDir "install-docker.ps1")
)

$failed = $false
foreach ($path in $targets) {
    if (-not (Test-Path -LiteralPath $path)) {
        Write-Host "[Reviewly] 缺少脚本: $path" -ForegroundColor Red
        $failed = $true
        continue
    }
    $tokens = $null
    $errors = $null
    [void][System.Management.Automation.Language.Parser]::ParseFile($path, [ref]$tokens, [ref]$errors)
    if ($errors -and $errors.Count -gt 0) {
        Write-Host "[Reviewly] 语法错误: $path" -ForegroundColor Red
        foreach ($err in $errors) {
            Write-Host "  $($err.ToString())" -ForegroundColor Red
        }
        $failed = $true
    } else {
        Write-Host "[Reviewly] OK  $path" -ForegroundColor Green
    }
}

if ($failed) {
    Write-Host ""
    Write-Host "[Reviewly] 部署脚本语法检查未通过。可尝试: git checkout -- deploy/*.ps1" -ForegroundColor Yellow
    exit 1
}

exit 0
