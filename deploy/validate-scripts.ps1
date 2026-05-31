#Requires -Version 5.1
# 部署前 PowerShell 脚本语法自检
param([switch]$Help)

$ErrorActionPreference = "Stop"

if ($Help) {
    Write-Host "Usage: powershell -NoProfile -File deploy\validate-scripts.ps1"
    exit 0
}

function Test-Utf8Bom {
    param([string]$Path)
    $bytes = [System.IO.File]::ReadAllBytes($Path)
    return ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF)
}

function Test-ContainsNonAscii {
    param([string]$Path)
    $text = [System.IO.File]::ReadAllText($Path, [System.Text.UTF8Encoding]::new($false))
    return $text -match '[^\x00-\x7F]'
}

function Test-ParseWithSystemDefaultEncoding {
    param([string]$Path)
    $content = [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::Default)
    $tokens = $null
    $errors = $null
    [void][System.Management.Automation.Language.Parser]::ParseInput(
        $content,
        [ref]$tokens,
        [ref]$errors
    )
    return $errors
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
        Write-Host "[Reviewly] Missing script: $path" -ForegroundColor Red
        $failed = $true
        continue
    }

    $hasNonAscii = Test-ContainsNonAscii $path
    $hasBom = Test-Utf8Bom $path

    if ($hasNonAscii -and -not $hasBom) {
        Write-Host "[Reviewly] FAIL $path" -ForegroundColor Red
        Write-Host "  Non-ASCII content without UTF-8 BOM (PS 5.1 on Chinese Windows will misread as GBK)." -ForegroundColor Red
        Write-Host "  Run: powershell -NoProfile -File scripts\ensure-ps1-bom.ps1" -ForegroundColor Yellow
        $failed = $true
        continue
    }

    $defaultErrors = Test-ParseWithSystemDefaultEncoding $path
    if ($defaultErrors -and $defaultErrors.Count -gt 0) {
        Write-Host "[Reviewly] FAIL $path (system default encoding parse)" -ForegroundColor Red
        foreach ($err in $defaultErrors) {
            Write-Host "  $($err.ToString())" -ForegroundColor Red
        }
        Write-Host "  Run: powershell -NoProfile -File scripts\ensure-ps1-bom.ps1" -ForegroundColor Yellow
        $failed = $true
        continue
    }

    $tokens = $null
    $errors = $null
    [void][System.Management.Automation.Language.Parser]::ParseFile($path, [ref]$tokens, [ref]$errors)
    if ($errors -and $errors.Count -gt 0) {
        Write-Host "[Reviewly] FAIL $path" -ForegroundColor Red
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
    Write-Host "[Reviewly] Deploy script validation failed. Run: powershell -NoProfile -File scripts\ensure-ps1-bom.ps1" -ForegroundColor Yellow
    exit 1
}

exit 0
