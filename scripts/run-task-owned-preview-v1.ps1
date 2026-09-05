[CmdletBinding(DefaultParameterSetName = 'Run')]
param(
    [Parameter(Mandatory = $true, ParameterSetName = 'Run')]
    [string]$RepositoryPath,

    [Parameter(Mandatory = $true, ParameterSetName = 'Run')]
    [string]$WorktreePath,

    [Parameter(Mandatory = $true, ParameterSetName = 'Run')]
    [string]$NodeExecutable,

    [Parameter(Mandatory = $true, ParameterSetName = 'Run')]
    [ValidateRange(1, 65535)]
    [int]$Port,

    [Parameter(Mandatory = $true, ParameterSetName = 'Run')]
    [string]$ExecutionInstanceId,

    [Parameter(Mandatory = $false, ParameterSetName = 'Run')]
    [string]$HostAddress = '127.0.0.1',

    [Parameter(Mandatory = $true, ParameterSetName = 'SelfTest')]
    [switch]$SelfTest
)

$ErrorActionPreference = 'Stop'

function Get-NormalizedExistingPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,

        [Parameter(Mandatory = $true)]
        [ValidateSet('Container', 'Leaf')]
        [string]$PathType
    )

    if (-not (Test-Path -LiteralPath $Path -PathType $PathType)) {
        throw 'preview_execution_identity_invalid'
    }
    return [IO.Path]::GetFullPath((Resolve-Path -LiteralPath $Path).Path).TrimEnd('\', '/')
}

function Get-ProcessIdentity {
    param(
        [Parameter(Mandatory = $true)]
        [Diagnostics.Process]$Process
    )

    return [pscustomobject]@{
        ProcessId = $Process.Id
        StartTimeUtc = $Process.StartTime.ToUniversalTime().Ticks
    }
}

function Test-ProcessIdentityPresent {
    param(
        [Parameter(Mandatory = $true)]
        [psobject]$Identity
    )

    $candidate = Get-Process -Id $Identity.ProcessId -ErrorAction SilentlyContinue
    if ($null -eq $candidate) {
        return $false
    }
    try {
        return $candidate.StartTime.ToUniversalTime().Ticks -eq $Identity.StartTimeUtc
    }
    catch {
        throw 'preview_process_tree_absence_unproven'
    }
    finally {
        $candidate.Dispose()
    }
}

function Get-OwnedProcessTreeIdentity {
    param(
        [Parameter(Mandatory = $true)]
        [Diagnostics.Process]$RootProcess
    )

    $rootIdentity = Get-ProcessIdentity -Process $RootProcess
    $identities = [Collections.Generic.List[object]]::new()
    $identities.Add($rootIdentity)
    $frontier = [Collections.Generic.HashSet[int]]::new()
    [void]$frontier.Add($rootIdentity.ProcessId)

    while ($frontier.Count -ne 0) {
        $next = [Collections.Generic.HashSet[int]]::new()
        foreach ($candidate in Get-Process -ErrorAction Stop) {
            try {
                $parentId = $candidate.Parent.Id
                if ($frontier.Contains($parentId) -and
                    -not @($identities | Where-Object { $_.ProcessId -eq $candidate.Id }).Count) {
                    $identity = Get-ProcessIdentity -Process $candidate
                    $identities.Add($identity)
                    [void]$next.Add($candidate.Id)
                }
            }
            catch {
                # Inaccessible unrelated processes are outside the exact owned tree.
            }
            finally {
                $candidate.Dispose()
            }
        }
        $frontier = $next
    }
    return @($identities)
}

function Stop-OwnedProcessTree {
    param(
        [Parameter(Mandatory = $true)]
        [Diagnostics.Process]$RootProcess,

        [Parameter(Mandatory = $true)]
        [Int64]$ExpectedStartTimeUtc
    )

    $rootIdentity = Get-ProcessIdentity -Process $RootProcess
    if ($rootIdentity.StartTimeUtc -ne $ExpectedStartTimeUtc) {
        throw 'preview_process_tree_identity_mismatch'
    }

    $tree = Get-OwnedProcessTreeIdentity -RootProcess $RootProcess
    if (-not $RootProcess.HasExited) {
        $RootProcess.Kill($true)
    }
    if (-not $RootProcess.WaitForExit(10000)) {
        throw 'preview_process_tree_termination_failed'
    }
    foreach ($identity in $tree) {
        if (Test-ProcessIdentityPresent -Identity $identity) {
            throw 'preview_process_tree_absence_unproven'
        }
    }
    return @($tree)
}

function Invoke-SelfTest {
    $currentPwsh = [IO.Path]::GetFullPath((Get-Process -Id $PID).Path)
    $childCommand = '$child = Start-Process -FilePath $PSHOME/pwsh -ArgumentList @(''-NoProfile'',''-Command'',''Start-Sleep -Seconds 300'') -PassThru; [Console]::Out.WriteLine($child.Id); [Console]::Out.Flush(); Start-Sleep -Seconds 300'
    $startInfo = [Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = $currentPwsh
    $startInfo.ArgumentList.Add('-NoProfile')
    $startInfo.ArgumentList.Add('-Command')
    $startInfo.ArgumentList.Add($childCommand)
    $startInfo.UseShellExecute = $false
    $startInfo.RedirectStandardOutput = $true
    $rootProcess = [Diagnostics.Process]::Start($startInfo)
    if ($null -eq $rootProcess) {
        throw 'preview_process_start_failed'
    }
    $rootStart = $rootProcess.StartTime.ToUniversalTime().Ticks
    $childLine = $rootProcess.StandardOutput.ReadLine()
    $childPid = 0
    if (-not [int]::TryParse($childLine, [ref]$childPid)) {
        throw 'preview_process_tree_identity_unproven'
    }

    $identityMismatchRejected = $false
    try {
        Stop-OwnedProcessTree -RootProcess $rootProcess -ExpectedStartTimeUtc ($rootStart + 1)
    }
    catch {
        if ($_.Exception.Message -cne 'preview_process_tree_identity_mismatch') {
            throw
        }
        $identityMismatchRejected = $true
    }
    if (-not $identityMismatchRejected -or $rootProcess.HasExited) {
        throw 'preview_process_tree_identity_unproven'
    }

    $tree = Stop-OwnedProcessTree -RootProcess $rootProcess -ExpectedStartTimeUtc $rootStart
    if (@($tree | Where-Object { $_.ProcessId -eq $childPid }).Count -ne 1) {
        throw 'preview_process_tree_identity_unproven'
    }
    return [pscustomobject]@{
        state = 'PASS'
        exact_tree_size = $tree.Count
        identity_mismatch_rejected = $true
        process_tree_absent = $true
    }
}

if ($SelfTest) {
    Invoke-SelfTest | ConvertTo-Json -Compress
    exit 0
}

$repository = Get-NormalizedExistingPath -Path $RepositoryPath -PathType Container
$worktree = Get-NormalizedExistingPath -Path $WorktreePath -PathType Container
$node = Get-NormalizedExistingPath -Path $NodeExecutable -PathType Leaf
$worktreesRoot = [IO.Path]::GetFullPath((Join-Path $repository '.worktrees')).TrimEnd('\', '/')
if (-not $worktree.StartsWith($worktreesRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'preview_execution_identity_invalid'
}
if ((Get-Item -LiteralPath $worktree -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) {
    throw 'preview_execution_identity_invalid'
}
$executionGuid = [guid]::Empty
if (-not [guid]::TryParse($ExecutionInstanceId, [ref]$executionGuid) -or $executionGuid -eq [guid]::Empty) {
    throw 'preview_execution_identity_invalid'
}

$viteScript = Get-NormalizedExistingPath -Path (Join-Path $worktree 'node_modules/vite/bin/vite.js') -PathType Leaf
$startInfo = [Diagnostics.ProcessStartInfo]::new()
$startInfo.FileName = $node
$startInfo.WorkingDirectory = $worktree
$startInfo.UseShellExecute = $false
$startInfo.RedirectStandardInput = $true
$startInfo.ArgumentList.Add($viteScript)
$startInfo.ArgumentList.Add('preview')
$startInfo.ArgumentList.Add('--host')
$startInfo.ArgumentList.Add($HostAddress)
$startInfo.ArgumentList.Add('--port')
$startInfo.ArgumentList.Add([string]$Port)

$preview = $null
$previewExitCode = $null
$terminationMode = $null
$tree = @()
try {
    $preview = [Diagnostics.Process]::Start($startInfo)
    if ($null -eq $preview) {
        throw 'preview_process_start_failed'
    }
    $rootStart = $preview.StartTime.ToUniversalTime().Ticks
    $exitTask = $preview.WaitForExitAsync()
    $controlTask = [Console]::In.ReadLineAsync()
    $completedTask = [Threading.Tasks.Task]::WhenAny($exitTask, $controlTask).GetAwaiter().GetResult()
    if ([object]::ReferenceEquals($completedTask, $exitTask)) {
        $previewExitCode = $preview.ExitCode
        $terminationMode = 'NATURAL_EXIT'
    }
    else {
        $control = $controlTask.GetAwaiter().GetResult()
        if ($control -cne 'STOP') {
            throw 'preview_control_command_invalid'
        }
        $terminationMode = 'OWNER_STOP'
    }
}
finally {
    if ($null -ne $preview) {
        $tree = Stop-OwnedProcessTree -RootProcess $preview -ExpectedStartTimeUtc $rootStart
        $preview.Dispose()
    }
}

if ($terminationMode -eq 'NATURAL_EXIT' -and $previewExitCode -ne 0) {
    throw 'preview_process_failed'
}
[pscustomobject]@{
    state = 'COMPLETED'
    execution_instance_id = $executionGuid.ToString()
    worktree_path = $worktree
    root_process_id = $tree[0].ProcessId
    exact_tree_size = $tree.Count
    termination_mode = $terminationMode
    process_tree_absent = $true
} | ConvertTo-Json -Compress
