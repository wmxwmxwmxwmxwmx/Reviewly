#Requires -Version 5.1
<#
.SYNOPSIS
  Ensure all deploy/ and scripts/ .ps1 files use UTF-8 with BOM (required for PS 5.1 on Chinese Windows).
#>
param(
    [switch]$Help
)

$ErrorActionPreference = "Stop"

if ($Help) {
    Write-Host "Usage: powershell -NoProfile -File scripts\ensure-ps1-bom.ps1"
    exit 0
}

$Root = Split-Path -Parent $PSScriptRoot
$dirs = @(
    (Join-Path $Root "deploy"),
    (Join-Path $Root "scripts")
)

function Test-Utf8Bom {
    param([string]$Path)
    $bytes = [System.IO.File]::ReadAllBytes($Path)
    return ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF)
}

$fixed = @()
$skipped = @()

foreach ($dir in $dirs) {
    if (-not (Test-Path -LiteralPath $dir)) { continue }
    Get-ChildItem -LiteralPath $dir -Filter "*.ps1" -File | ForEach-Object {
        $path = $_.FullName
        if (Test-Utf8Bom $path) {
            $skipped += $path
            return
        }
        $utf8 = [System.Text.UTF8Encoding]::new($true)
        $content = [System.IO.File]::ReadAllText($path, [System.Text.UTF8Encoding]::new($false))
        [System.IO.File]::WriteAllText($path, $content, $utf8)
        $fixed += $path
    }
}

Write-Host "[Reviewly] ensure-ps1-bom complete." -ForegroundColor Green
if ($fixed.Count -gt 0) {
    Write-Host "Fixed ($($fixed.Count)):" -ForegroundColor Yellow
    foreach ($p in $fixed) {
        Write-Host "  + $p"
    }
} else {
    Write-Host "All .ps1 files already have UTF-8 BOM." -ForegroundColor Green
}

if ($skipped.Count -gt 0) {
    Write-Host "Already OK ($($skipped.Count))." -ForegroundColor DarkGray
}

exit 0
