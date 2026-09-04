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
$runner = Join-Path $repository 'scripts/run-local-full-validation-v1.ps1'
$python = [IO.Path]::GetFullPath((Resolve-Path -LiteralPath $PythonExecutable).Path)
$sourceRequirements = Join-Path $repository 'research/sd-prompt-research/requirements.txt'
$sourceLock = Join-Path $repository 'research/sd-prompt-research/requirements.lock.txt'
$tempRoot = Join-Path ([IO.Path]::GetTempPath()) ('pvc-' + [guid]::NewGuid().ToString('N').Substring(0, 8) + '-' + ('x' * 48))
$seed = Join-Path $tempRoot 'seed'
$worktreeA = Join-Path $tempRoot 'task-a'
$worktreeB = Join-Path $tempRoot 'task-b'

try {
    . $runner
    $runnerSource = Get-Content -Raw -LiteralPath $runner
    Assert-True (([regex]::Matches($runnerSource, 'acquire-python-validation-environment-v1\.ps1')).Count -eq 1) 'runner does not invoke the acquisition helper exactly once'
    Assert-True ($runnerSource -match '&\s+\$Executable\s+@Arguments') 'runner does not use the direct call-operator argument-array boundary'
    Assert-True ($runnerSource -match '@\(''-B'', ''-E'', ''-s'', ''-c'', \$probeCode\)') 'bootstrap runtime probe does not use the exact isolated flags'
    Assert-True ($runnerSource -match '@\(''PYTHONHOME'', ''PYTHONPATH'', ''PYTHONUSERBASE''\)') 'bootstrap runtime probe does not clear the closed Python environment set'
    Assert-True ($runnerSource -notmatch 'Get-Command\s+(?:python|python3|py)(?:\.exe)?\b') 'runner performs forbidden Python command discovery'
    $bootstrapAdmissionOffset = $runnerSource.IndexOf('$bootstrapRuntime = Assert-LocalFullValidationBootstrapRuntimeV1 -PythonExecutable $BasePythonExecutable', [StringComparison]::Ordinal)
    $acquisitionOffset = $runnerSource.IndexOf('$acquisitionHelper = Join-Path $PSScriptRoot ''acquire-python-validation-environment-v1.ps1''', [StringComparison]::Ordinal)
    Assert-True ($bootstrapAdmissionOffset -ge 0 -and $acquisitionOffset -gt $bootstrapAdmissionOffset) 'bootstrap runtime admission does not precede acquisition'
    $acquisitionResultOffset = $runnerSource.IndexOf('$acquisitionResult = Invoke-LocalFullValidationProcessV1', [StringComparison]::Ordinal)
    $acquisitionSlice = $runnerSource.Substring($acquisitionOffset, $acquisitionResultOffset - $acquisitionOffset)
    Assert-True (([regex]::Matches($acquisitionSlice, '''-PythonExecutable'', \$BasePythonExecutable')).Count -eq 1) 'admitted bootstrap executable is not passed unchanged exactly once to acquisition'
    Assert-True ($runnerSource -match '\$validationPython\s*=\s*\[string\]\$acquisition\.python_executable') 'runner does not consume the returned executable directly'
    Assert-True ($runnerSource -match "profile\s*=\s*'FULL_RESEARCH'") 'runner does not own the fixed FULL_RESEARCH profile'
    Assert-True ($runnerSource -match 'Test-LocalFullValidationPythonCacheMatrixV1') 'runner does not classify cache-matrix ownership'
    Assert-True ($runnerSource -match "SKIPPED_OWNERS_UNCHANGED") 'runner does not report an owner-unchanged matrix skip'
    foreach ($forbiddenPattern in @(
        'Invoke-Expression', 'Resolve-Path', 'GetFullPath', 'Get-ChildItem',
        'cache_root', 'environment[\\/]Scripts[\\/]python\.exe',
        'Set-Location', 'Push-Location', 'Pop-Location'
    )) {
        Assert-True ($runnerSource -notmatch $forbiddenPattern) "runner contains forbidden path or execution pattern $forbiddenPattern"
    }

    $suppliedRuntimeProbe = @(& $python -B -E -s -c 'import json, sys; print(json.dumps({"implementation": sys.implementation.name, "version": ".".join(str(part) for part in sys.version_info[:3]), "cache_tag": sys.implementation.cache_tag}, sort_keys=True))' 2>&1 | ForEach-Object { "$_" })
    Assert-True ($LASTEXITCODE -eq 0 -and $suppliedRuntimeProbe.Count -eq 1) 'supplied test runtime identity probe failed'
    $suppliedRuntimeIdentity = $suppliedRuntimeProbe[0] | ConvertFrom-Json
    $suppliedRuntimeVersionMatch = [regex]::Match([string]$suppliedRuntimeIdentity.version, '^3\.12\.(0|[1-9][0-9]*)$')
    [int]$suppliedRuntimePatch = 0
    $suppliedRuntimeIsApproved = (
        [string]$suppliedRuntimeIdentity.implementation -ceq 'cpython' -and
        $suppliedRuntimeVersionMatch.Success -and
        [int]::TryParse($suppliedRuntimeVersionMatch.Groups[1].Value, [ref]$suppliedRuntimePatch) -and
        $suppliedRuntimePatch -ge 13 -and
        [string]$suppliedRuntimeIdentity.cache_tag -ceq 'cpython-312'
    )

    $poison = Join-Path $tempRoot 'poison-path'
    New-Item -ItemType Directory -Path $poison -Force | Out-Null
    $pythonMarker = Join-Path $poison 'python-invoked.txt'
    $pyMarker = Join-Path $poison 'py-invoked.txt'
    if ($env:OS -eq 'Windows_NT') {
        $fakePythonCommand = Join-Path $poison 'python.cmd'
        $fakePyCommand = Join-Path $poison 'py.cmd'
        [IO.File]::WriteAllText($fakePythonCommand, "@echo off`r`necho invoked>$pythonMarker`r`nexit /b 99`r`n", [Text.Encoding]::ASCII)
        [IO.File]::WriteAllText($fakePyCommand, "@echo off`r`necho invoked>$pyMarker`r`nexit /b 99`r`n", [Text.Encoding]::ASCII)
    }
    else {
        $fakePythonCommand = Join-Path $poison 'python'
        $fakePyCommand = Join-Path $poison 'py'
        [IO.File]::WriteAllText($fakePythonCommand, "#!/bin/sh`nprintf invoked > '$pythonMarker'`nexit 99`n", [Text.UTF8Encoding]::new($false))
        [IO.File]::WriteAllText($fakePyCommand, "#!/bin/sh`nprintf invoked > '$pyMarker'`nexit 99`n", [Text.UTF8Encoding]::new($false))
        & chmod '+x' $fakePythonCommand $fakePyCommand
        if ($LASTEXITCODE -ne 0) { throw 'fake_path_command_setup_failed' }
    }
    $savedPath = [Environment]::GetEnvironmentVariable('PATH', 'Process')
    $savedPythonHome = [Environment]::GetEnvironmentVariable('PYTHONHOME', 'Process')
    $savedPythonPathForBootstrap = [Environment]::GetEnvironmentVariable('PYTHONPATH', 'Process')
    $savedPythonUserBase = [Environment]::GetEnvironmentVariable('PYTHONUSERBASE', 'Process')
    try {
        [Environment]::SetEnvironmentVariable('PATH', "$poison;$savedPath", 'Process')
        [Environment]::SetEnvironmentVariable('PYTHONHOME', $poison, 'Process')
        [Environment]::SetEnvironmentVariable('PYTHONPATH', $poison, 'Process')
        [Environment]::SetEnvironmentVariable('PYTHONUSERBASE', $poison, 'Process')
        $bootstrapAdmission = try {
            $identity = Assert-LocalFullValidationBootstrapRuntimeV1 -PythonExecutable $python
            [pscustomobject]@{ Admitted = $true; Identity = $identity; Reason = $null }
        }
        catch {
            [pscustomobject]@{ Admitted = $false; Identity = $null; Reason = $_.Exception.Message }
        }
        if ($suppliedRuntimeIsApproved) {
            Assert-True ($bootstrapAdmission.Admitted) 'approved bootstrap runtime was not admitted'
            Assert-True ([string]$bootstrapAdmission.Identity.python_implementation -ceq 'cpython') 'approved bootstrap implementation changed'
            Assert-True ([string]$bootstrapAdmission.Identity.exact_python_version -ceq [string]$suppliedRuntimeIdentity.version) 'approved bootstrap version changed'
            Assert-True ([string]$bootstrapAdmission.Identity.python_cache_tag -ceq 'cpython-312') 'approved bootstrap cache tag changed'
            Assert-True ([string]$bootstrapAdmission.Identity.python_executable -ceq $python) 'approved bootstrap executable identity changed'
        }
        else {
            Assert-True (-not $bootstrapAdmission.Admitted) 'non-approved supplied runtime was admitted'
            Assert-True ($bootstrapAdmission.Reason -ceq 'local_full_validation_bootstrap_runtime_invalid') 'non-approved supplied runtime rejection reason changed'
        }
        Assert-True (-not (Test-Path -LiteralPath $pythonMarker)) 'fake python from PATH was invoked'
        Assert-True (-not (Test-Path -LiteralPath $pyMarker)) 'fake py from PATH was invoked'
    }
    finally {
        [Environment]::SetEnvironmentVariable('PATH', $savedPath, 'Process')
        [Environment]::SetEnvironmentVariable('PYTHONHOME', $savedPythonHome, 'Process')
        [Environment]::SetEnvironmentVariable('PYTHONPATH', $savedPythonPathForBootstrap, 'Process')
        [Environment]::SetEnvironmentVariable('PYTHONUSERBASE', $savedPythonUserBase, 'Process')
    }

    foreach ($runtimeCase in @(
        [pscustomobject]@{ Version = '3.12.12'; CacheTag = 'cpython-312'; Admitted = $false },
        [pscustomobject]@{ Version = '3.12.13'; CacheTag = 'cpython-312'; Admitted = $true },
        [pscustomobject]@{ Version = '3.12.14'; CacheTag = 'cpython-312'; Admitted = $true },
        [pscustomobject]@{ Version = '3.13.0'; CacheTag = 'cpython-313'; Admitted = $false },
        [pscustomobject]@{ Version = '3.14.0'; CacheTag = 'cpython-314'; Admitted = $false }
    )) {
        $caseName = $runtimeCase.Version.Replace('.', '-')
        $fakeRuntime = Join-Path $tempRoot $(if ($env:OS -eq 'Windows_NT') { "python-$caseName.cmd" } else { "python-$caseName" })
        $fakeRuntimePayload = [ordered]@{
            exact_python_version = $runtimeCase.Version
            python_cache_tag = $runtimeCase.CacheTag
            python_executable = $fakeRuntime
            python_implementation = 'cpython'
        } | ConvertTo-Json -Compress
        if ($env:OS -eq 'Windows_NT') {
            [IO.File]::WriteAllText($fakeRuntime, "@echo off`r`necho $fakeRuntimePayload`r`nexit /b 0`r`n", [Text.Encoding]::ASCII)
        }
        else {
            [IO.File]::WriteAllText($fakeRuntime, "#!/bin/sh`nprintf '%s\\n' '$fakeRuntimePayload'`n", [Text.UTF8Encoding]::new($false))
            & chmod '+x' $fakeRuntime
            if ($LASTEXITCODE -ne 0) { throw 'fake_runtime_setup_failed' }
        }
        $runtimeAdmission = try {
            $identity = Assert-LocalFullValidationBootstrapRuntimeV1 -PythonExecutable $fakeRuntime
            [pscustomobject]@{ Admitted = $true; Identity = $identity; Reason = $null }
        }
        catch {
            [pscustomobject]@{ Admitted = $false; Identity = $null; Reason = $_.Exception.Message }
        }
        Assert-True ($runtimeAdmission.Admitted -eq $runtimeCase.Admitted) "Python $($runtimeCase.Version) admission changed"
        if ($runtimeCase.Admitted) {
            Assert-True ([string]$runtimeAdmission.Identity.exact_python_version -ceq $runtimeCase.Version) "Python $($runtimeCase.Version) exact identity changed"
            Assert-True ([string]$runtimeAdmission.Identity.python_executable -ceq $fakeRuntime) "Python $($runtimeCase.Version) executable identity changed"
        }
        else {
            Assert-True ($runtimeAdmission.Reason -ceq 'local_full_validation_bootstrap_runtime_invalid') "Python $($runtimeCase.Version) rejection reason changed"
        }
    }

    $missingRuntimeReason = try {
        Assert-LocalFullValidationBootstrapRuntimeV1 -PythonExecutable (Join-Path $tempRoot 'missing-python.exe') | Out-Null
        'unexpected_success'
    }
    catch { $_.Exception.Message }
    Assert-True ($missingRuntimeReason -ceq 'local_full_validation_bootstrap_runtime_invalid') 'missing bootstrap runtime was not rejected'

    New-Item -ItemType Directory -Path (Join-Path $seed 'research/sd-prompt-research') -Force | Out-Null
    Copy-Item -LiteralPath $sourceRequirements -Destination (Join-Path $seed 'research/sd-prompt-research/requirements.txt')
    Copy-Item -LiteralPath $sourceLock -Destination (Join-Path $seed 'research/sd-prompt-research/requirements.lock.txt')
    & git init --initial-branch=main $seed | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'git_test_repository_init_failed' }
    Invoke-GitChecked $seed @('config', 'user.email', 'cache-test@example.invalid') | Out-Null
    Invoke-GitChecked $seed @('config', 'user.name', 'Python Cache Contract Test') | Out-Null
    Invoke-GitChecked $seed @('add', 'research/sd-prompt-research/requirements.txt', 'research/sd-prompt-research/requirements.lock.txt') | Out-Null
    Invoke-GitChecked $seed @('commit', '-m', 'test dependency inputs') | Out-Null
    $matrixBaseline = [string](@(Invoke-GitChecked $seed @('rev-parse', 'HEAD'))[0])
    $matrixCatalog = Join-Path $tempRoot 'matrix-catalog.json'
    [IO.File]::WriteAllText(
        $matrixCatalog,
        (([ordered]@{ python_cache_matrix = [ordered]@{ owning_exact = @('research/sd-prompt-research/requirements.txt') } } | ConvertTo-Json -Depth 4) + "`n"),
        [Text.UTF8Encoding]::new($false)
    )
    Assert-True (-not (Test-LocalFullValidationPythonCacheMatrixV1 -Repository $seed -ExactBaselineCommit $matrixBaseline -CatalogPath $matrixCatalog)) 'unchanged cache owner unexpectedly selected the full matrix'
    [IO.File]::AppendAllText((Join-Path $seed 'research/sd-prompt-research/requirements.txt'), "# matrix owner change`n")
    Assert-True (Test-LocalFullValidationPythonCacheMatrixV1 -Repository $seed -ExactBaselineCommit $matrixBaseline -CatalogPath $matrixCatalog) 'changed cache owner did not select the full matrix'
    Copy-Item -LiteralPath $sourceRequirements -Destination (Join-Path $seed 'research/sd-prompt-research/requirements.txt') -Force
    Assert-True (-not (Test-LocalFullValidationPythonCacheMatrixV1 -Repository $seed -ExactBaselineCommit $matrixBaseline -CatalogPath $matrixCatalog)) 'restored cache owner did not return to the skip path'
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
    $parallelFailures = @($jobResults | Where-Object ExitCode -ne 0)
    $parallelFailureText = @($parallelFailures | ForEach-Object { "exit=$($_.ExitCode) output=$($_.Output)" }) -join '; '
    Assert-True ($parallelFailures.Count -eq 0) "parallel acquisition failed ($parallelFailureText)"
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

    $consumerPython = [string]$warm.python_executable
    if ($env:OS -eq 'Windows_NT') {
        Assert-True ($consumerPython.StartsWith('\\?\', [StringComparison]::Ordinal)) 'Windows cached interpreter lost its extended-path identity'
    }
    Assert-True ([string]$warm.cache_root -like "$tempRoot*") 'cache acquisition escaped the disposable test repository'

    $prior = Get-Location
    try {
        Set-Location -LiteralPath $worktreeA
        $probeCode = 'import json, os, sys, jsonschema; from importlib.resources import files; resource = files("jsonschema_specifications").joinpath("schemas/draft202012/vocabularies/format-annotation"); print(json.dumps({"cwd": os.getcwd(), "python_executable": sys.executable, "resource_length": len(str(resource)), "resource_readable": bool(resource.read_bytes())}, sort_keys=True))'
        $probeResult = Invoke-LocalFullValidationProcessV1 -Executable $consumerPython -Arguments @('-B', '-E', '-s', '-c', $probeCode)
        Assert-True ($probeResult.ExitCode -eq 0) 'real runner invocation boundary rejected the exact returned executable'
        Assert-True ($probeResult.Output.Count -eq 1) 'real runner invocation boundary probe output is invalid'
        $probe = ($probeResult.Output[0] | ConvertFrom-Json)
        Assert-True ([string]$probe.python_executable -ceq $consumerPython) 'invoked sys.executable differs from the exact acquisition result'
        Assert-True ([IO.Path]::GetFullPath([string]$probe.cwd).TrimEnd('\', '/') -ceq [IO.Path]::GetFullPath($worktreeA).TrimEnd('\', '/')) 'validation did not execute in assigned worktree'
        Assert-True ([int]$probe.resource_length -gt 260) 'package resource path did not exercise the extended-path boundary'
        Assert-True ($probe.resource_readable -eq $true) 'jsonschema specification resource was not readable'
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

    $sitePackagesResult = Invoke-LocalFullValidationProcessV1 -Executable ([string]$warm.python_executable) -Arguments @('-B', '-E', '-s', '-c', 'import sysconfig; print(sysconfig.get_paths()["purelib"])')
    Assert-True ($sitePackagesResult.ExitCode -eq 0) 'real runner invocation boundary could not resolve disposable site-packages'
    $sitePackages = $sitePackagesResult.Output[0]
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
    $deadOwner = [ordered]@{
        identity = $abandonedIdentity.identity
        process_id = 2147483647
        acquired_at_utc = '2000-01-01T00:00:00.0000000Z'
        nonce = '0123456789abcdef0123456789abcdef'
    }
    [IO.File]::WriteAllText($abandonedLock, (($deadOwner | ConvertTo-Json -Compress) + "`n"), [Text.UTF8Encoding]::new($false))
    $recovered = Invoke-Acquire -Helper $helper -Repository $worktreeA -Python $python
    Assert-True ($recovered.cache_state -eq 'cold') 'abandoned identity lock was not reclaimed'
    $leaseProbe = [IO.FileStream]::new($abandonedLock, [IO.FileMode]::Open, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
    $leaseProbe.Dispose()
    Assert-True (Test-Path -LiteralPath $abandonedLock -PathType Leaf) 'recovered identity lease file is absent'

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
