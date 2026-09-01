[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string]$PythonExecutable,

    [Parameter(Mandatory = $false)]
    [string]$BaselineCommit
)

$ErrorActionPreference = 'Stop'

function Invoke-LocalFullValidationProcessV1 {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Executable,

        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    $previousErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $output = @(& $Executable @Arguments 2>&1 | ForEach-Object { "$_" })
        $exitCode = $LASTEXITCODE
        return [pscustomobject]@{
            ExitCode = $exitCode
            Output = $output
        }
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
}

function Complete-LocalFullValidationStepV1 {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name,

        [Parameter(Mandatory = $true)]
        [psobject]$Result
    )

    foreach ($line in $Result.Output) { Write-Output $line }
    if ($Result.ExitCode -ne 0) {
        throw "local_full_validation_step_failed:$Name`:exit_$($Result.ExitCode)"
    }
}

function Invoke-LocalFullValidationV1 {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$BasePythonExecutable,

        [Parameter(Mandatory = $true)]
        [string]$ExactBaselineCommit
    )

    if ($ExactBaselineCommit -notmatch '^[0-9a-f]{40}$') {
        throw 'local_full_validation_baseline_invalid'
    }

    $repository = Split-Path -Parent $PSScriptRoot
    $gitExecutable = (Get-Command git -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source
    $nodeExecutable = (Get-Command node -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source
    $pnpmExecutable = (Get-Command pnpm.cmd -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source
    $shellExecutable = (Get-Process -Id $PID).Path

    $rootResult = Invoke-LocalFullValidationProcessV1 -Executable $gitExecutable -Arguments @('rev-parse', '--show-toplevel')
    Complete-LocalFullValidationStepV1 -Name 'repository_root' -Result $rootResult
    $actualRoot = ([string]$rootResult.Output[0]).Replace('/', '\').TrimEnd('\')
    $expectedRoot = ([string]$repository).Replace('/', '\').TrimEnd('\')
    if (-not $actualRoot.Equals($expectedRoot, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'local_full_validation_assigned_worktree_required'
    }

    $baselineResult = Invoke-LocalFullValidationProcessV1 -Executable $gitExecutable -Arguments @('cat-file', '-e', "$ExactBaselineCommit`^{commit}")
    Complete-LocalFullValidationStepV1 -Name 'baseline_commit' -Result $baselineResult

    $acquisitionHelper = Join-Path $PSScriptRoot 'acquire-python-validation-environment-v1.ps1'
    $acquisitionArguments = @(
        '-NoLogo', '-NoProfile', '-File', $acquisitionHelper,
        '-RepositoryPath', $repository,
        '-PythonExecutable', $BasePythonExecutable
    )
    $acquisitionResult = Invoke-LocalFullValidationProcessV1 -Executable $shellExecutable -Arguments $acquisitionArguments
    if ($acquisitionResult.ExitCode -ne 0) {
        throw "local_full_validation_acquisition_failed:$($acquisitionResult.Output -join ' ')"
    }
    try {
        $acquisition = ($acquisitionResult.Output -join "`n") | ConvertFrom-Json
    }
    catch {
        throw 'local_full_validation_acquisition_output_invalid'
    }

    $validationPython = [string]$acquisition.python_executable
    if ([string]::IsNullOrEmpty($validationPython)) {
        throw 'local_full_validation_python_identity_missing'
    }

    $identityProbeCode = @'
import json
import sys
import jsonschema
from importlib.resources import files
resource = files("jsonschema_specifications").joinpath("schemas/draft202012/vocabularies/format-annotation")
payload = {
    "python_executable": sys.executable,
    "resource_length": len(str(resource)),
    "resource_readable": bool(resource.read_bytes()),
}
print(json.dumps(payload, sort_keys=True))
'@
    $identityProbe = Invoke-LocalFullValidationProcessV1 -Executable $validationPython -Arguments @('-B', '-E', '-s', '-c', $identityProbeCode)
    Complete-LocalFullValidationStepV1 -Name 'opaque_python_identity' -Result $identityProbe
    try {
        $identity = ($identityProbe.Output -join "`n") | ConvertFrom-Json
    }
    catch {
        throw 'local_full_validation_python_identity_output_invalid'
    }
    if ([string]$identity.python_executable -cne $validationPython) {
        throw 'local_full_validation_python_identity_changed'
    }
    if ($identity.resource_readable -ne $true) {
        throw 'local_full_validation_python_resource_unreadable'
    }
    if ($env:OS -eq 'Windows_NT') {
        if (-not $validationPython.StartsWith('\\?\', [StringComparison]::Ordinal)) {
            throw 'local_full_validation_extended_path_identity_missing'
        }
    }

    $pythonSteps = @(
        [pscustomobject]@{ Name = 'full_research'; Arguments = @('-B', '-E', '-s', '-m', 'unittest', 'discover', '-s', 'research/sd-prompt-research/tests', '-v') },
        [pscustomobject]@{ Name = 'concept_graph'; Arguments = @('-B', '-E', '-s', 'research/sd-prompt-research/scripts/build_concept_graph.py', '--check') },
        [pscustomobject]@{ Name = 'research_explorer'; Arguments = @('-B', '-E', '-s', 'research/sd-prompt-research/scripts/research_explorer.py', 'index', '--check') },
        [pscustomobject]@{ Name = 'research_claims'; Arguments = @('-B', '-E', '-s', 'research/sd-prompt-research/scripts/validate_research_claims.py', '--baseline-ref', $ExactBaselineCommit, '--validation-context', 'current_state', '--format', 'json') }
    )
    foreach ($step in $pythonSteps) {
        $result = Invoke-LocalFullValidationProcessV1 -Executable $validationPython -Arguments $step.Arguments
        Complete-LocalFullValidationStepV1 -Name $step.Name -Result $result
    }

    $nodeSteps = @(
        [pscustomobject]@{ Name = 'production_advisory'; Arguments = @('scripts/test-visual-concept-production-advisory-v1.mjs') },
        [pscustomobject]@{ Name = 'read_only_advisory'; Arguments = @('scripts/test-visual-concept-read-only-advisory-v1.mjs') },
        [pscustomobject]@{ Name = 'read_only_entry'; Arguments = @('scripts/test-visual-concept-read-only-entry-adapter-v1.mjs') },
        [pscustomobject]@{ Name = 'read_only_inspection'; Arguments = @('scripts/test-visual-concept-read-only-inspection-v1.mjs') },
        [pscustomobject]@{ Name = 'production_advisory_check'; Arguments = @('scripts/promote-visual-concept-production-advisory-v1.mjs', '--check') },
        [pscustomobject]@{ Name = 'prompt_data'; Arguments = @('scripts/validate-dictionaries.mjs') },
        [pscustomobject]@{ Name = 'reclassification'; Arguments = @('scripts/test-reclassification.mjs') },
        [pscustomobject]@{ Name = 'prompt_analyzer'; Arguments = @('scripts/test-prompt-analyzer.mjs') },
        [pscustomobject]@{ Name = 'role_execution_contracts'; Arguments = @('scripts/test-role-execution-contracts.mjs') },
        [pscustomobject]@{ Name = 'protected_transition_admission'; Arguments = @('scripts/test-protected-transition-admission-v1.mjs') },
        [pscustomobject]@{ Name = 'task_execution_context'; Arguments = @('scripts/test-task-execution-context-v1.mjs') }
    )
    foreach ($step in $nodeSteps) {
        $result = Invoke-LocalFullValidationProcessV1 -Executable $nodeExecutable -Arguments $step.Arguments
        Complete-LocalFullValidationStepV1 -Name $step.Name -Result $result
    }

    foreach ($arguments in @(@('test'), @('run', 'build'))) {
        $result = Invoke-LocalFullValidationProcessV1 -Executable $pnpmExecutable -Arguments $arguments
        Complete-LocalFullValidationStepV1 -Name "pnpm_$($arguments -join '_')" -Result $result
    }

    $cacheTestArguments = @(
        '-NoLogo', '-NoProfile', '-File', (Join-Path $PSScriptRoot 'test-python-validation-environment-v1.ps1'),
        '-PythonExecutable', $BasePythonExecutable
    )
    $cacheTest = Invoke-LocalFullValidationProcessV1 -Executable $shellExecutable -Arguments $cacheTestArguments
    Complete-LocalFullValidationStepV1 -Name 'python_validation_environment' -Result $cacheTest

    [pscustomobject]@{
        runner = 'LOCAL_FULL_VALIDATION_V1'
        profile = 'FULL_RESEARCH'
        result = 'PASS'
        baseline_commit = $ExactBaselineCommit
        python_executable = $validationPython
        cache_state = [string]$acquisition.cache_state
    } | ConvertTo-Json -Compress | Write-Output
}

if ($MyInvocation.InvocationName -cne '.') {
    if ([string]::IsNullOrEmpty($PythonExecutable) -or [string]::IsNullOrEmpty($BaselineCommit)) {
        throw 'local_full_validation_required_argument_missing'
    }
    Invoke-LocalFullValidationV1 -BasePythonExecutable $PythonExecutable -ExactBaselineCommit $BaselineCommit
}
