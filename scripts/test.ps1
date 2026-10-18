$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$exe = Join-Path $root 'build/app/mashang_server.exe'
$unit = Join-Path $root 'build/app/llm_client_tests.exe'
& $unit
if ($LASTEXITCODE -ne 0) { throw 'Native client tests failed.' }
$work = Join-Path $root ('build/integration-' + [Guid]::NewGuid().ToString('N'))
$utf8 = [Text.UTF8Encoding]::new($false)
$portCheck = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 8080)
try { $portCheck.Start() } catch { throw 'Port 8080 is occupied. Stop the running backend before testing.' }
finally { $portCheck.Stop() }
$child = $null
$provider = $null
$prior = @{}
foreach ($name in @('LLM_API_KEY','DEEPSEEK_API_KEY','LLM_API_URL','LLM_MODEL','DEEPSEEK_MODEL','LLM_TIMEOUT_SECONDS','LLM_THINKING')) {
    $prior[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
    [Environment]::SetEnvironmentVariable($name, $null, 'Process')
}
function Start-TestServer {
    $process = Start-Process -FilePath $exe -WorkingDirectory $work -WindowStyle Hidden -RedirectStandardOutput (Join-Path $work 'stdout.log') -RedirectStandardError (Join-Path $work 'stderr.log') -PassThru
    for ($attempt=0; $attempt -lt 40; $attempt++) {
        if ($process.HasExited) { throw 'Test server exited; ensure port 8080 is free.' }
        try {
            $null = Invoke-RestMethod 'http://127.0.0.1:8080/api/health' -TimeoutSec 1
            return $process
        } catch { Start-Sleep -Milliseconds 100 }
    }
    Stop-Process -Id $process.Id
    throw 'Test server did not start.'
}
function Api($path, $payload, $method='POST') {
    $body = $payload | ConvertTo-Json -Depth 8 -Compress
    Invoke-RestMethod -Uri ('http://127.0.0.1:8080' + $path) -Method $method -ContentType 'application/json; charset=utf-8' -Body ($utf8.GetBytes($body)) -TimeoutSec 5
}
function Assert($condition, $name) {
    if (!$condition) { throw ('FAIL: ' + $name) }
    Write-Output ('PASS: ' + $name)
}
try {
    New-Item -ItemType Directory -Path $work | Out-Null
    Copy-Item -LiteralPath (Join-Path $root 'knowledge_base') -Destination $work -Recurse
    New-Item -ItemType Directory -Path (Join-Path $work 'frontend') | Out-Null
    [IO.File]::WriteAllText((Join-Path $work 'frontend/index.html'), 'integration frontend', $utf8)
    [IO.File]::WriteAllText((Join-Path $work '.env'), "LLM_API_KEY=`n", $utf8)
    $child = Start-TestServer
    $answer = Api '/api/ask' @{course_id='cpp'; question='指针和引用有什么区别？'}
    Assert ($answer.mode -eq 'retrieval' -and $answer.sources.Count -gt 0) 'Missing key returns retrieval with sources'
    $unknown = Api '/api/ask' @{course_id='cpp'; question='今天天气怎么样？'}
    Assert ($unknown.mode -eq 'no_evidence' -and $unknown.sources.Count -eq 0) 'No evidence skips generation'
    $saved = Api '/api/wrong-questions' @{course_id='cpp';question='指针和引用有什么区别？';answer=$answer.answer;knowledge_point='指针与引用'}
    $items = Invoke-RestMethod 'http://127.0.0.1:8080/api/wrong-questions'
    $id = $items.items[0].id
    $null = Api ('/api/wrong-questions/' + $id + '/status') @{status='已掌握'} 'PUT'
    $recommendations = Invoke-RestMethod 'http://127.0.0.1:8080/api/recommendations?course_id=cpp'
    Assert ($recommendations.count -gt 0) 'Exercise recommendations preserved'
    $grade = Api '/api/exercises/submit' @{exercise_id=101;answer='B'}
    Assert $grade.correct 'Exercise grading preserved'
    Stop-Process -Id $child.Id
    $child.WaitForExit()
    $child = $null
    [IO.File]::WriteAllText((Join-Path $work '.env'), "LLM_API_KEY=integration-test-only`nLLM_API_URL=http://127.0.0.1:1/chat/completions`nLLM_TIMEOUT_SECONDS=1`n", $utf8)
    $child = Start-TestServer
    $answer = Api '/api/ask' @{course_id='cpp';question='指针和引用有什么区别？'}
    Assert ($answer.mode -eq 'retrieval' -and $answer.sources.Count -gt 0) 'Provider failure retains retrieval answer and sources'
    $items = Invoke-RestMethod 'http://127.0.0.1:8080/api/wrong-questions'
    Assert ($items.items.Count -eq 1 -and $items.items[0].status -eq '已掌握') 'Wrong question and mastery persist after restart'
    $page = Invoke-WebRequest 'http://127.0.0.1:8080/' -UseBasicParsing
    Assert ($page.Content -eq 'integration frontend') 'Frontend is served by C++'
    try { $null=Invoke-WebRequest 'http://127.0.0.1:8080/.env' -UseBasicParsing; throw 'Secret file was exposed' }
    catch { Assert ([int]$_.Exception.Response.StatusCode -eq 404) 'Environment file cannot be served' }
    Stop-Process -Id $child.Id
    $child.WaitForExit()
    $child = $null
    $portLog = Join-Path $work 'provider-port.log'
    $provider = Start-Process -FilePath $unit -ArgumentList '--mock-provider' -WorkingDirectory $work -WindowStyle Hidden -RedirectStandardOutput $portLog -RedirectStandardError (Join-Path $work 'provider-error.log') -PassThru
    $providerPort = 0
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        if ($provider.HasExited) { throw 'Mock provider exited.' }
        if (Test-Path $portLog) {
            $portText = Get-Content $portLog -First 1
            if ([int]::TryParse([string]$portText, [ref]$providerPort) -and $providerPort -gt 0) { break }
        }
        Start-Sleep -Milliseconds 100
    }
    if ($providerPort -le 0) { throw 'Mock provider did not start.' }
    [IO.File]::WriteAllText((Join-Path $work '.env'), "LLM_API_KEY=integration-test-only`nLLM_API_URL=http://127.0.0.1:$providerPort/chat/completions`nLLM_TIMEOUT_SECONDS=3`n", $utf8)
    $child = Start-TestServer
    for ($requestIndex = 0; $requestIndex -lt 8; $requestIndex++) {
        $answer = Api '/api/ask' @{course_id='cpp';question='指针和引用有什么区别？'}
        Assert ($answer.mode -eq 'generated' -and $answer.answer -eq 'Mock course explanation') ('Repeated model request ' + ($requestIndex + 1) + ' succeeds')
    }
} finally {
    if ($child -and !$child.HasExited) { Stop-Process -Id $child.Id; $child.WaitForExit() }
    if ($provider -and !$provider.HasExited) { Stop-Process -Id $provider.Id; $provider.WaitForExit() }
    foreach ($name in $prior.Keys) { [Environment]::SetEnvironmentVariable($name, $prior[$name], 'Process') }
    if (Test-Path -LiteralPath $work) {
        $resolved=(Resolve-Path -LiteralPath $work).Path
        $expectedPrefix=[IO.Path]::GetFullPath((Join-Path $root 'build/integration-'))
        if (!$resolved.StartsWith($expectedPrefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'Unexpected cleanup path' }
        Remove-Item -LiteralPath $resolved -Recurse -Force
    }
}