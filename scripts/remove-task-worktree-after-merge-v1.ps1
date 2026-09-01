[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string]$RepositoryPath,

    [Parameter(Mandatory = $false)]
    [string]$TaskWorktreePath,

    [Parameter(Mandatory = $false)]
    [string]$ExpectedBranch,

    [Parameter(Mandatory = $false)]
    [string]$ExpectedHead
)

$ErrorActionPreference = 'Stop'
$script:GitExecutable = $null
$script:Repository = $null
$script:RetiredWorktree = $null
$script:CleanupExitCode = 1

function Invoke-NativeGit {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments,

        [Parameter(Mandatory = $false)]
        [string]$Repository = $script:Repository
    )

    $previousErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $output = @(& $script:GitExecutable -C $Repository @Arguments 2>&1 | ForEach-Object { "$_" })
        return [pscustomobject]@{
            ExitCode = $LASTEXITCODE
            Output = $output
        }
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
}

function Require-GitSuccess {
    param(
        [Parameter(Mandatory = $true)]
        [psobject]$Result,

        [Parameter(Mandatory = $true)]
        [string]$Reason
    )

    if ($Result.ExitCode -ne 0) {
        throw $Reason
    }
    return ($Result.Output -join "`n").Trim()
}

function Get-NormalizedPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    return [IO.Path]::GetFullPath($Path).TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
}

function Assert-RetiredPathBoundary {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Repository,

        [Parameter(Mandatory = $true)]
        [string]$RetiredWorktree
    )

    $worktreesRoot = Get-NormalizedPath -Path (Join-Path $Repository '.worktrees')
    $prefix = $worktreesRoot + [IO.Path]::DirectorySeparatorChar
    if (
        $RetiredWorktree -ceq $Repository -or $RetiredWorktree -ceq $worktreesRoot -or
        -not $RetiredWorktree.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)
    ) {
        throw 'worktree_cleanup_target_outside_repository_worktrees'
    }
}

function Get-RegisteredWorktreePaths {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Repository
    )

    $inventory = Invoke-NativeGit -Repository $Repository -Arguments @('worktree', 'list', '--porcelain')
    if ($inventory.ExitCode -ne 0) {
        throw 'worktree_cleanup_inventory_failed'
    }
    return @(
        $inventory.Output |
            Where-Object { $_.StartsWith('worktree ', [StringComparison]::Ordinal) } |
            ForEach-Object { Get-NormalizedPath -Path $_.Substring(9) }
    )
}

function Get-ActivePathOwnerCount {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    try {
        if ($IsWindows) {
            return @(
                Get-CimInstance Win32_Process |
                    Where-Object {
                        $_.ProcessId -ne $PID -and
                        -not [string]::IsNullOrEmpty($_.CommandLine) -and
                        $_.CommandLine.IndexOf($Path, [StringComparison]::OrdinalIgnoreCase) -ge 0
                    }
            ).Count
        }

        if (Test-Path -LiteralPath '/proc' -PathType Container) {
            $count = 0
            foreach ($processDirectory in Get-ChildItem -LiteralPath '/proc' -Directory -ErrorAction Stop) {
                if ($processDirectory.Name -notmatch '^\d+$' -or [int]$processDirectory.Name -eq $PID) {
                    continue
                }
                $commandLinePath = Join-Path $processDirectory.FullName 'cmdline'
                try {
                    $commandLine = [Text.Encoding]::UTF8.GetString([IO.File]::ReadAllBytes($commandLinePath)).Replace("`0", ' ')
                    if ($commandLine.Contains($Path, [StringComparison]::Ordinal)) {
                        $count += 1
                    }
                }
                catch [System.IO.IOException] {
                    continue
                }
                catch [System.UnauthorizedAccessException] {
                    continue
                }
            }
            return $count
        }

        throw 'worktree_cleanup_active_process_check_unavailable'
    }
    catch {
        if ($_.Exception.Message -eq 'worktree_cleanup_active_process_check_unavailable') {
            throw
        }
        throw 'worktree_cleanup_active_process_check_failed'
    }
}

function Get-BranchRefDigest {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Repository
    )

    $refs = Require-GitSuccess -Result (
        Invoke-NativeGit -Repository $Repository -Arguments @(
            'for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads', 'refs/remotes'
        )
    ) -Reason 'worktree_cleanup_ref_inventory_failed'
    $canonical = (@($refs -split "`r?`n") | Sort-Object) -join "`n"
    return [Convert]::ToHexString(
        [Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($canonical))
    ).ToLowerInvariant()
}

function Remove-LiteralDirectoryTree {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    foreach ($item in Get-ChildItem -LiteralPath $Path -Force -ErrorAction Stop) {
        if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
            Remove-Item -LiteralPath $item.FullName -Force -ErrorAction Stop
        }
        elseif ($item.PSIsContainer) {
            Remove-LiteralDirectoryTree -Path $item.FullName
        }
        else {
            Remove-Item -LiteralPath $item.FullName -Force -ErrorAction Stop
        }
    }
    Remove-Item -LiteralPath $Path -Force -ErrorAction Stop
}

function Remove-VerifiedResidualPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Repository,

        [Parameter(Mandatory = $true)]
        [string]$RetiredWorktreePath,

        [Parameter(Mandatory = $true)]
        [string]$CapturedRetiredWorktreePath
    )

    if ([string]::IsNullOrWhiteSpace($script:GitExecutable)) {
        $script:GitExecutable = (Get-Command git -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source
    }
    $repository = Get-NormalizedPath -Path $Repository
    $retired = Get-NormalizedPath -Path $RetiredWorktreePath
    $captured = Get-NormalizedPath -Path $CapturedRetiredWorktreePath
    Assert-RetiredPathBoundary -Repository $repository -RetiredWorktree $retired
    if (-not $retired.Equals($captured, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'worktree_cleanup_retired_path_binding_invalid'
    }
    if (-not (Test-Path -LiteralPath $retired)) {
        return $false
    }

    $registeredPaths = Get-RegisteredWorktreePaths -Repository $repository
    $retiredPrefix = $retired + [IO.Path]::DirectorySeparatorChar
    if (@($registeredPaths | Where-Object {
        $_.Equals($retired, [StringComparison]::OrdinalIgnoreCase) -or
        $_.StartsWith($retiredPrefix, [StringComparison]::OrdinalIgnoreCase)
    }).Count -ne 0) {
        throw 'worktree_cleanup_residual_still_registered'
    }

    $targetItem = Get-Item -LiteralPath $retired -Force
    if (-not $targetItem.PSIsContainer -or ($targetItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw 'worktree_cleanup_residual_root_invalid'
    }
    if (Test-Path -LiteralPath (Join-Path $retired '.git')) {
        throw 'worktree_cleanup_git_marker_present'
    }
    if ((Get-ActivePathOwnerCount -Path $retired) -ne 0) {
        throw 'worktree_cleanup_residual_active_process'
    }

    Remove-LiteralDirectoryTree -Path $retired
    if (Test-Path -LiteralPath $retired) {
        throw 'worktree_cleanup_residual_removal_failed'
    }
    return $true
}

function Write-CleanupResult {
    param(
        [Parameter(Mandatory = $true)]
        [string]$State,

        [Parameter(Mandatory = $true)]
        [string]$Reason,

        [Parameter(Mandatory = $false)]
        [string]$Action = 'NONE',

        [Parameter(Mandatory = $false)]
        [bool]$ResidualRemoved = $false,

        [Parameter(Mandatory = $false)]
        [Nullable[bool]]$BranchRefsPreserved = $null
    )

    [ordered]@{
        state = $State
        reason = $Reason
        action = $Action
        repository = $script:Repository
        retired_worktree = $script:RetiredWorktree
        residual_removed = $ResidualRemoved
        branch_refs_preserved = $BranchRefsPreserved
        merge_outcome_affected = $false
    } | ConvertTo-Json -Depth 3 -Compress | Write-Output
}

function Invoke-TaskWorktreeCleanup {
    param(
        [Parameter(Mandatory = $true)]
        [string]$RepositoryPath,

        [Parameter(Mandatory = $true)]
        [string]$TaskWorktreePath,

        [Parameter(Mandatory = $true)]
        [string]$ExpectedBranch,

        [Parameter(Mandatory = $true)]
        [string]$ExpectedHead
    )

    try {
        $gitCommand = Get-Command git -CommandType Application -ErrorAction Stop | Select-Object -First 1
        $script:GitExecutable = $gitCommand.Source
        $script:Repository = Get-NormalizedPath -Path $RepositoryPath
        $script:RetiredWorktree = Get-NormalizedPath -Path $TaskWorktreePath

        if (-not (Test-Path -LiteralPath (Join-Path $script:Repository '.git') -PathType Container)) {
            throw 'worktree_cleanup_repository_invalid'
        }
        Assert-RetiredPathBoundary -Repository $script:Repository -RetiredWorktree $script:RetiredWorktree

        $registeredPaths = Get-RegisteredWorktreePaths -Repository $script:Repository
        if (@($registeredPaths | Where-Object {
            $_.Equals($script:RetiredWorktree, [StringComparison]::OrdinalIgnoreCase)
        }).Count -ne 1) {
            throw 'worktree_cleanup_target_registration_invalid'
        }
        if (-not (Test-Path -LiteralPath $script:RetiredWorktree -PathType Container)) {
            throw 'worktree_cleanup_target_missing'
        }
        $actualBranch = Require-GitSuccess -Result (
            Invoke-NativeGit -Repository $script:RetiredWorktree -Arguments @('branch', '--show-current')
        ) -Reason 'worktree_cleanup_target_identity_invalid'
        $actualHead = Require-GitSuccess -Result (
            Invoke-NativeGit -Repository $script:RetiredWorktree -Arguments @('rev-parse', 'HEAD')
        ) -Reason 'worktree_cleanup_target_identity_invalid'
        if ($actualBranch -cne $ExpectedBranch -or $actualHead -cne $ExpectedHead) {
            throw 'worktree_cleanup_target_identity_invalid'
        }
        $status = Invoke-NativeGit -Repository $script:RetiredWorktree -Arguments @(
            'status', '--porcelain=v1', '--untracked-files=all'
        )
        if ($status.ExitCode -ne 0) {
            throw 'worktree_cleanup_target_status_failed'
        }
        if ($status.Output.Count -ne 0) {
            throw 'worktree_cleanup_target_dirty'
        }
        if ((Get-ActivePathOwnerCount -Path $script:RetiredWorktree) -ne 0) {
            throw 'worktree_cleanup_target_active_process'
        }

        $refsBefore = Get-BranchRefDigest -Repository $script:Repository
        $remove = Invoke-NativeGit -Repository $script:Repository -Arguments @(
            'worktree', 'remove', '--', $script:RetiredWorktree
        )
        if ($remove.ExitCode -ne 0) {
            throw 'worktree_cleanup_git_remove_failed'
        }

        $residualRemoved = Remove-VerifiedResidualPath `
            -Repository $script:Repository `
            -RetiredWorktreePath $script:RetiredWorktree `
            -CapturedRetiredWorktreePath $script:RetiredWorktree
        $refsAfter = Get-BranchRefDigest -Repository $script:Repository
        if ($refsBefore -cne $refsAfter) {
            throw 'worktree_cleanup_branch_refs_changed'
        }
        if (Test-Path -LiteralPath $script:RetiredWorktree) {
            throw 'worktree_cleanup_final_path_present'
        }

        Write-CleanupResult `
            -State 'PASS' `
            -Reason 'task_worktree_cleanup_completed' `
            -Action $(if ($residualRemoved) { 'GIT_REMOVE_PLUS_RESIDUE_REMOVE' } else { 'GIT_REMOVE' }) `
            -ResidualRemoved $residualRemoved `
            -BranchRefsPreserved $true
        $script:CleanupExitCode = 0
        return
    }
    catch {
        $reason = $_.Exception.Message
        if ($reason -notmatch '^worktree_cleanup_[a-z_]+$') {
            $reason = 'worktree_cleanup_internal_failure'
        }
        Write-CleanupResult -State 'FAILED' -Reason $reason
        $script:CleanupExitCode = 1
        return
    }
}

if ($MyInvocation.InvocationName -ne '.') {
    if (
        [string]::IsNullOrWhiteSpace($RepositoryPath) -or
        [string]::IsNullOrWhiteSpace($TaskWorktreePath) -or
        [string]::IsNullOrWhiteSpace($ExpectedBranch) -or
        $ExpectedHead -notmatch '^[0-9a-f]{40}$'
    ) {
        Write-CleanupResult -State 'FAILED' -Reason 'worktree_cleanup_input_invalid'
        exit 1
    }
    Invoke-TaskWorktreeCleanup `
        -RepositoryPath $RepositoryPath `
        -TaskWorktreePath $TaskWorktreePath `
        -ExpectedBranch $ExpectedBranch `
        -ExpectedHead $ExpectedHead
    exit $script:CleanupExitCode
}
