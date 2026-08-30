[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$PythonExecutable
)

$ErrorActionPreference = 'Stop'
$script:Assertions = 0

function Assert-True {
    param([Parameter(Mandatory = $true)][bool]$Condition, [Parameter(Mandatory = $true)][string]$Message)
    if (-not $Condition) { throw "assertion_failed:$Message" }
    $script:Assertions++
}

function Invoke-GitChecked {
    param([Parameter(Mandatory = $true)][string]$Repository, [Parameter(Mandatory = $true)][string[]]$Arguments)
    $output = @(& git -C $Repository @Arguments 2>&1 | ForEach-Object { "$_" })
    if ($LASTEXITCODE -ne 0) { throw "git_test_setup_failed:$($output -join ' ')" }
    return $output
}

function Invoke-Acquire {
    param(
        [Parameter(Mandatory = $true)][string]$Helper,
        [Parameter(Mandatory = $true)][string]$Repository,
        [Parameter(Mandatory = $true)][string]$Python,
        [Parameter(Mandatory = $false)][switch]$IdentityOnly
    )
    $arguments = @{ RepositoryPath = $Repository; PythonExecutable = $Python }
    if ($IdentityOnly) { $arguments.IdentityOnly = $true }
    $output = @(& $Helper @arguments 2>&1 | ForEach-Object { "$_" })
    if ($LASTEXITCODE -ne 0) { throw "cache_acquisition_failed:$($output -join ' ')" }
    try { return (($output -join "`n") | ConvertFrom-Json) }
    catch { throw "cache_acquisition_output_malformed:$($output -join ' ')" }
}

function Invoke-AcquireExpectFailure {
    param(
        [Parameter(Mandatory = $true)][string]$Helper,
        [Parameter(Mandatory = $true)][string]$Repository,
        [Parameter(Mandatory = $true)][string]$Python
    )
    $shell = (Get-Process -Id $PID).Path
    $output = @(& $shell -NoLogo -NoProfile -File $Helper -RepositoryPath $Repository -PythonExecutable $Python 2>&1 | ForEach-Object { "$_" })
    return [pscustomobject]@{ ExitCode = $LASTEXITCODE; Output = ($output -join ' ') }
}

$repository = [IO.Path]::GetFullPath((Resolve-Path (Join-Path $PSScriptRoot '..')).Path)
$helper = Join-Path $repository 'scripts/acquire-python-validation-environment-v1.ps1'
$python = [IO.Path]::GetFullPath((Resolve-Path -LiteralPath $PythonExecutable).Path)
$sourceRequirements = Join-Path $repository 'research/sd-prompt-research/requirements.txt'
$sourceLock = Join-Path $repository 'research/sd-prompt-research/requirements.lock.txt'
$tempRoot = Join-Path ([IO.Path]::GetTempPath()) ('pvc-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
$seed = Join-Path $tempRoot 'seed'
$worktreeA = Join-Path $tempRoot 'task-a'
$worktreeB = Join-Path $tempRoot 'task-b'

try {
    New-Item -ItemType Directory -Path (Join-Path $seed 'research/sd-prompt-research') -Force | Out-Null
    Copy-Item -LiteralPath $sourceRequirements -Destination (Join-Path $seed 'research/sd-prompt-research/requirements.txt')
    Copy-Item -LiteralPath $sourceLock -Destination (Join-Path $seed 'research/sd-prompt-research/requirements.lock.txt')
    & git init --initial-branch=main $seed | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'git_test_repository_init_failed' }
    Invoke-GitChecked $seed @('config', 'user.email', 'cache-test@example.invalid') | Out-Null
    Invoke-GitChecked $seed @('config', 'user.name', 'Python Cache Contract Test') | Out-Null
    Invoke-GitChecked $seed @('add', 'research/sd-prompt-research/requirements.txt', 'research/sd-prompt-research/requirements.lock.txt') | Out-Null
    Invoke-GitChecked $seed @('commit', '-m', 'test dependency inputs') | Out-Null
    Invoke-GitChecked $seed @('worktree', 'add', '-b', 'task-a', $worktreeA, 'HEAD') | Out-Null
    Invoke-GitChecked $seed @('worktree', 'add', '-b', 'task-b', $worktreeB, 'HEAD') | Out-Null

    $identityA = Invoke-Acquire -Helper $helper -Repository $worktreeA -Python $python -IdentityOnly
    $identityB = Invoke-Acquire -Helper $helper -Repository $worktreeB -Python $python -IdentityOnly
    Assert-True ($identityA.identity -ceq $identityB.identity) 'same dependency runtime identity differs across worktrees'
    $expectedIdentityKeys = @(
        'cache_contract_version', 'python_implementation', 'exact_python_version', 'python_cache_tag',
        'python_platform_tag', 'machine_architecture', 'requirements_txt_sha256', 'requirements_lock_sha256'
    ) | Sort-Object
    $actualIdentityKeys = @($identityA.identity_document.psobject.Properties.Name | Sort-Object)
    Assert-True (($expectedIdentityKeys -join "`n") -ceq ($actualIdentityKeys -join "`n")) 'identity document field set is not exact'
    foreach ($forbidden in @('task', 'branch', 'pr', 'head', 'worktree', 'timestamp', 'execution_instance_id', 'repository')) {
        Assert-True ($actualIdentityKeys -cnotcontains $forbidden) "identity includes forbidden field $forbidden"
    }

    $shell = (Get-Process -Id $PID).Path
    $jobScript = {
        param($Shell, $Helper, $Repository, $Python)
        $output = @(& $Shell -NoLogo -NoProfile -File $Helper -RepositoryPath $Repository -PythonExecutable $Python 2>&1 | ForEach-Object { "$_" })
        [pscustomobject]@{ ExitCode = $LASTEXITCODE; Output = ($output -join "`n") }
    }
    $jobs = @(
        Start-Job -ScriptBlock $jobScript -ArgumentList $shell, $helper, $worktreeA, $python
        Start-Job -ScriptBlock $jobScript -ArgumentList $shell, $helper, $worktreeB, $python
    )
    $jobResults = @($jobs | Wait-Job | Receive-Job)
    $jobs | Remove-Job -Force
    Assert-True ($jobResults.Count -eq 2) 'parallel acquisition result count mismatch'
    Assert-True (@($jobResults | Where-Object ExitCode -ne 0).Count -eq 0) 'parallel acquisition failed'
    $parallel = @($jobResults | ForEach-Object { $_.Output | ConvertFrom-Json })
    $parallelStates = @($parallel | ForEach-Object cache_state) -join ','
    Assert-True (@($parallel | Where-Object cache_state -eq 'cold').Count -eq 1) "simultaneous cache miss did not produce exactly one builder (states=$parallelStates)"
    Assert-True (@($parallel | Where-Object cache_state -match '^warm').Count -eq 1) "simultaneous cache miss loser did not reuse winner (states=$parallelStates)"
    Assert-True (($parallel | Select-Object -ExpandProperty identity -Unique).Count -eq 1) 'parallel worktrees did not share dependency identity'

    $watch = [Diagnostics.Stopwatch]::StartNew()
    $warm = Invoke-Acquire -Helper $helper -Repository $worktreeA -Python $python
    $watch.Stop()
    Assert-True ($warm.cache_state -eq 'warm') 'second acquisition did not take warm path'
    Assert-True ($watch.ElapsedMilliseconds -le 2000) "warm acquisition exceeded 2 seconds ($($watch.ElapsedMilliseconds) ms)"
    Assert-True (Test-Path -LiteralPath $warm.python_executable -PathType Leaf) 'cached interpreter is absent'

    $prior = Get-Location
    try {
        Set-Location -LiteralPath $worktreeA
        $cwd = @(& $warm.python_executable -B -E -s -c 'import os; print(os.getcwd())')
        Assert-True ($LASTEXITCODE -eq 0) 'cached interpreter execution failed'
        Assert-True ([IO.Path]::GetFullPath($cwd[0]).TrimEnd('\', '/') -ceq [IO.Path]::GetFullPath($worktreeA).TrimEnd('\', '/')) 'validation did not execute in assigned worktree'
    }
    finally { Set-Location -LiteralPath $prior }

    $beforeSourceIdentity = (Invoke-Acquire -Helper $helper -Repository $worktreeA -Python $python -IdentityOnly).identity
    [IO.File]::WriteAllText((Join-Path $worktreeA 'source-only-change.txt'), 'source only')
    $afterSourceIdentity = (Invoke-Acquire -Helper $helper -Repository $worktreeA -Python $python -IdentityOnly).identity
    Assert-True ($beforeSourceIdentity -ceq $afterSourceIdentity) 'repository source change invalidated dependency identity'
    $status = @(Invoke-GitChecked $worktreeB @('status', '--porcelain=v1', '--untracked-files=all'))
    Assert-True (@($status | Where-Object { $_ -match 'codex-cache|\.venv' }).Count -eq 0) 'shared cache contaminated worktree Git status'

    $requirementsA = Join-Path $worktreeA 'research/sd-prompt-research/requirements.txt'
    [IO.File]::AppendAllText($requirementsA, "# identity change`n")
    $changedIdentity = (Invoke-Acquire -Helper $helper -Repository $worktreeA -Python $python -IdentityOnly).identity
    Assert-True ($changedIdentity -cne $beforeSourceIdentity) 'requirements change did not create a new identity'
    [IO.File]::WriteAllText($requirementsA, "Pillow>=13`n", [Text.UTF8Encoding]::new($false))
    $unsatisfiedIdentity = Invoke-Acquire -Helper $helper -Repository $worktreeA -Python $python -IdentityOnly
    $unsatisfied = Invoke-AcquireExpectFailure -Helper $helper -Repository $worktreeA -Python $python
    Assert-True ($unsatisfied.ExitCode -ne 0) 'lock incompatible with direct requirements unexpectedly passed'
    Assert-True ($unsatisfied.Output -match 'python_validation_direct_requirements_unsatisfied') 'direct requirement mismatch reason was not precise'
    $unsatisfiedFinal = Join-Path (Join-Path $unsatisfiedIdentity.cache_root 'environments') $unsatisfiedIdentity.identity
    Assert-True (-not (Test-Path -LiteralPath $unsatisfiedFinal)) 'direct requirement mismatch left a finalized environment'
    Copy-Item -LiteralPath $sourceRequirements -Destination $requirementsA -Force

    $finalPath = Join-Path (Join-Path $warm.cache_root 'environments') $warm.identity
    $manifestPath = Join-Path $finalPath 'completion-manifest.json'
    $savedPythonPath = [Environment]::GetEnvironmentVariable('PYTHONPATH', 'Process')
    try {
        [Environment]::SetEnvironmentVariable('PYTHONPATH', $worktreeB, 'Process')
        $isolatedWarm = Invoke-Acquire -Helper $helper -Repository $worktreeB -Python $python
        Assert-True ($isolatedWarm.cache_state -eq 'warm') 'ambient PYTHONPATH affected cache acquisition'
    }
    finally { [Environment]::SetEnvironmentVariable('PYTHONPATH', $savedPythonPath, 'Process') }

    $sitePackages = @(& $warm.python_executable -B -E -s -c 'import sysconfig; print(sysconfig.get_paths()["purelib"])')[0]
    [IO.File]::WriteAllText((Join-Path $sitePackages 'repository-injection.pth'), ($worktreeB + "`n"), [Text.UTF8Encoding]::new($false))
    $rebuiltPth = Invoke-Acquire -Helper $helper -Repository $worktreeB -Python $python
    Assert-True ($rebuiltPth.cache_state -eq 'cold') 'repository-bearing pth entry was reused'
    Assert-True (-not (Test-Path -LiteralPath (Join-Path $sitePackages 'repository-injection.pth'))) 'rejected pth entry survived rebuild'

    $manifest = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json
    $manifest.identity_document.exact_python_version = '0.0.0-test'
    [IO.File]::WriteAllText($manifestPath, (($manifest | ConvertTo-Json -Depth 8) + "`n"), [Text.UTF8Encoding]::new($false))
    $rebuiltRuntime = Invoke-Acquire -Helper $helper -Repository $worktreeB -Python $python
    Assert-True ($rebuiltRuntime.cache_state -eq 'cold') 'wrong runtime manifest was reused'

    Remove-Item -LiteralPath $manifestPath -Force
    $rebuiltIncomplete = Invoke-Acquire -Helper $helper -Repository $worktreeB -Python $python
    Assert-True ($rebuiltIncomplete.cache_state -eq 'cold') 'incomplete finalized cache was reused'
    Assert-True (Test-Path -LiteralPath $manifestPath -PathType Leaf) 'incomplete cache was not rebuilt'

    $lockPath = Join-Path $worktreeA 'research/sd-prompt-research/requirements.lock.txt'
    [IO.File]::AppendAllText($lockPath, "# abandoned lock identity`n")
    $abandonedIdentity = Invoke-Acquire -Helper $helper -Repository $worktreeA -Python $python -IdentityOnly
    $abandonedLock = Join-Path (Join-Path $abandonedIdentity.cache_root 'locks') ($abandonedIdentity.identity + '.lock')
    New-Item -ItemType Directory -Path $abandonedLock -Force | Out-Null
    $deadOwner = [ordered]@{
        identity = $abandonedIdentity.identity
        process_id = 2147483647
        process_start_ticks = 1
        nonce = '0123456789abcdef0123456789abcdef'
    }
    [IO.File]::WriteAllText((Join-Path $abandonedLock 'owner.json'), (($deadOwner | ConvertTo-Json -Compress) + "`n"), [Text.UTF8Encoding]::new($false))
    $recovered = Invoke-Acquire -Helper $helper -Repository $worktreeA -Python $python
    Assert-True ($recovered.cache_state -eq 'cold') 'abandoned identity lock was not reclaimed'
    Assert-True (-not (Test-Path -LiteralPath $abandonedLock)) 'abandoned identity lock survived successful acquisition'

    $badRoot = Join-Path $tempRoot 'bad'
    New-Item -ItemType Directory -Path (Join-Path $badRoot 'research/sd-prompt-research') -Force | Out-Null
    Copy-Item -LiteralPath $sourceRequirements -Destination (Join-Path $badRoot 'research/sd-prompt-research/requirements.txt')
    $badLock = @'
definitely-not-a-real-validation-package==1.0.0 \
    --hash=sha256:0000000000000000000000000000000000000000000000000000000000000000
'@
    [IO.File]::WriteAllText((Join-Path $badRoot 'research/sd-prompt-research/requirements.lock.txt'), $badLock, [Text.UTF8Encoding]::new($false))
    & git init --initial-branch=main $badRoot | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'bad_install_repository_init_failed' }
    $failed = Invoke-AcquireExpectFailure -Helper $helper -Repository $badRoot -Python $python
    Assert-True ($failed.ExitCode -ne 0) 'failed locked install unexpectedly passed'
    Assert-True ($failed.Output -match 'python_validation_locked_install_failed') 'failed install reason was not precise'
    $badIdentity = Invoke-Acquire -Helper $helper -Repository $badRoot -Python $python -IdentityOnly
    $badFinal = Join-Path (Join-Path $badIdentity.cache_root 'environments') $badIdentity.identity
    Assert-True (-not (Test-Path -LiteralPath $badFinal)) 'failed install left a finalized environment'

    Write-Output "test-python-validation-environment-v1 passed ($script:Assertions assertions)"
}
finally {
    if (Test-Path -LiteralPath $tempRoot) { Remove-Item -LiteralPath $tempRoot -Recurse -Force }
}
