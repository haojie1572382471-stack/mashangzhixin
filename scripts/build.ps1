$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$projectRoot = Split-Path $PSScriptRoot -Parent
$vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio/Installer/vswhere.exe'
$vsRoot = & $vswhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath -utf8
if (!$vsRoot) { throw 'Visual Studio C++ build tools were not found.' }
$vcvars = Join-Path $vsRoot 'VC/Auxiliary/Build/vcvars64.bat'
# Import the compiler environment into this process only.
$envLines = & cmd.exe /d /c "chcp 65001 >nul && call `"$vcvars`" >nul && set"
if ($LASTEXITCODE -ne 0) { throw 'Could not initialize the C++ build environment.' }
$imported = @{}
foreach ($line in $envLines) {
    if ($line -match '^([^=]+)=(.*)$') {
        if (!$imported.ContainsKey($Matches[1])) {
            [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2], 'Process')
            $imported[$Matches[1]] = $true
        }
    }
}
$cmake = Join-Path $vsRoot 'Common7/IDE/CommonExtensions/Microsoft/CMake/CMake/bin/cmake.exe'
$buildDir = Join-Path $projectRoot 'build/app'
$ninja = Join-Path $vsRoot 'Common7/IDE/CommonExtensions/Microsoft/CMake/Ninja/ninja.exe'
& $cmake -S $projectRoot -B $buildDir -G 'Ninja' "-DCMAKE_MAKE_PROGRAM=$ninja" '-DCMAKE_BUILD_TYPE=Release'
if ($LASTEXITCODE -ne 0) { throw 'CMake configure failed.' }
& $cmake --build $buildDir --target mashang_server llm_client_tests
if ($LASTEXITCODE -ne 0) { throw 'Build failed.' }
