$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Push-Location $projectRoot
try {
    & '.\build\app\mashang_server.exe' --test-api
    exit $LASTEXITCODE
} finally { Pop-Location }