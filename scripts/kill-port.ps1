param(
    [Parameter(Mandatory = $true)]
    [int]$Port
)

$ErrorActionPreference = "SilentlyContinue"
$maxRounds = 5

for ($round = 1; $round -le $maxRounds; $round++) {
    $pids = @(
        Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
            Select-Object -ExpandProperty OwningProcess -Unique
    ) | Where-Object { $_ -and $_ -ne $PID }

    if (-not $pids -or $pids.Count -eq 0) {
        Write-Host "Port $Port is free."
        exit 0
    }

    foreach ($procId in $pids) {
        Write-Warning "Port $Port in use by PID $procId (attempt $round/$maxRounds); stopping..."
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
        taskkill /F /T /PID $procId 2>$null | Out-Null
    }
    Start-Sleep -Milliseconds 600
}

$remaining = @(
    Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique
)
if ($remaining) {
    Write-Warning "Port $Port still in use by PID(s): $($remaining -join ', '). Close other terminals or run as Administrator."
    exit 1
}

Write-Host "Port $Port is free."
exit 0
