$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$serverFile = Join-Path $projectRoot 'build/app/mashang_server.exe'
if (!(Test-Path -LiteralPath $serverFile)) { throw 'Run scripts/build.ps1 first.' }
foreach ($port in @(8080,8081)) {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $port)
    try { $listener.Start() } catch { throw "Port $port is in use. Stop the previous project instance first." }
    finally { $listener.Stop() }
}
$pythonPath = (Get-Command python -ErrorAction Stop).Source
$gateway = $null
Push-Location $projectRoot
try {
    $gateway = Start-Process -FilePath $pythonPath -ArgumentList '-u backend/model_gateway.py' -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru
    Start-Sleep -Milliseconds 500
    if ($gateway.HasExited) { throw 'The model gateway could not start.' }
    Write-Host 'Open http://127.0.0.1:8080/#qa in your browser. Press Ctrl+C to stop.'
    & $serverFile
} finally {
    if ($gateway -and !$gateway.HasExited) { Stop-Process -Id $gateway.Id }
    Pop-Location
}
