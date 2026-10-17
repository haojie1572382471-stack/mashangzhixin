$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$serverFile = Join-Path $projectRoot 'build/app/mashang_server.exe'
if (!(Test-Path -LiteralPath $serverFile)) { throw 'Run scripts/build.ps1 first.' }
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 8080)
try { $listener.Start() } catch { throw 'Port 8080 is in use. Stop the previous project instance first.' }
finally { $listener.Stop() }
Push-Location $projectRoot
try {
    Write-Host 'Open http://127.0.0.1:8080/#qa in your browser. Press Ctrl+C to stop.'
    & $serverFile
} finally { Pop-Location }