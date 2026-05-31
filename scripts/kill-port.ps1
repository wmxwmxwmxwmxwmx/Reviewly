param(
    [Parameter(Mandatory = $true)]
    [int]$Port
)

$ErrorActionPreference = "SilentlyContinue"
$maxRounds = 8

function Get-ListenerPids([int]$TargetPort) {
    @(
        Get-NetTCPConnection -LocalPort $TargetPort -State Listen -ErrorAction SilentlyContinue |
            Select-Object -ExpandProperty OwningProcess -Unique
    ) | Where-Object { $_ -and $_ -ne $PID }
}

function Stop-ProcessTree([int]$ProcId) {
    if (-not $ProcId -or $ProcId -eq $PID) { return }
    Stop-Process -Id $ProcId -Force -ErrorAction SilentlyContinue
    taskkill /F /T /PID $ProcId 2>$null | Out-Null
}

function Stop-GatewayLikeProcesses() {
    Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
        Where-Object {
            $_.CommandLine -and (
                $_.CommandLine -match 'uvicorn\s+app\.main:app' -or
                $_.CommandLine -match "--port\s+$Port\b" -or
                $_.CommandLine -match ":\s*$Port\b" -or
                $_.CommandLine -match 'multiprocessing-fork' -or
                $_.CommandLine -match 'Reviewly\\services\\gateway'
            )
        } |
        ForEach-Object {
            Write-Warning "Stopping gateway-like process PID $($_.ProcessId)..."
            Stop-ProcessTree $_.ProcessId
        }
}

for ($round = 1; $round -le $maxRounds; $round++) {
    $pids = Get-ListenerPids $Port
    if (-not $pids -or $pids.Count -eq 0) {
        Write-Host "Port $Port is free."
        exit 0
    }

    foreach ($procId in $pids) {
        Write-Warning "Port $Port in use by PID $procId (attempt $round/$maxRounds); stopping..."
        Stop-ProcessTree $procId
    }

    if ($round -ge 3) {
        Stop-GatewayLikeProcesses
    }

    Start-Sleep -Milliseconds 700
}

$remaining = Get-ListenerPids $Port
if ($remaining) {
    Stop-GatewayLikeProcesses
    Start-Sleep -Milliseconds 500
    $remaining = Get-ListenerPids $Port
}

if ($remaining) {
    Write-Warning "Port $Port still in use by PID(s): $($remaining -join ', ')."
    Write-Warning "Close all terminals running 'npm run dev' / Gateway, then retry: npm run kill:gateway"
    exit 1
}

Write-Host "Port $Port is free."
exit 0
