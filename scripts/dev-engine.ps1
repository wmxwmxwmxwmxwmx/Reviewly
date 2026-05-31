$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Engine = Join-Path $Root "services\engine"
$Build = Join-Path $Engine "build"

Set-Location $Engine

if (-not (Test-Path $Build)) {
    cmake -B build
    cmake --build build
}

$exe = Join-Path $Build "Debug\prism_engine.exe"
if (-not (Test-Path $exe)) {
    $exe = Join-Path $Build "prism_engine.exe"
}
if (-not (Test-Path $exe)) {
    $exe = Join-Path $Build "prism_engine"
}

& $exe
