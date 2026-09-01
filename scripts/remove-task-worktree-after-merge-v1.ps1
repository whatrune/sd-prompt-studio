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
$script:GitRemoveExitCode = $null
$script:GitRemoveStderr = $null

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

function Get-BoundedDiagnosticText {
    param(
        [Parameter(Mandatory = $false)]
        [AllowEmptyString()]
        [string]$Text = ''
    )

    $normalized = $Text.Replace("`r`n", "`n").Replace("`r", "`n")
    if ($normalized.Length -le 512) {
        return $normalized
    }
    return $normalized.Substring(0, 512)
}

function Invoke-GitWorktreeRemove {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Repository,

        [Parameter(Mandatory = $true)]
        [string]$TaskWorktreePath
    )

    $stderrPath = Join-Path ([IO.Path]::GetTempPath()) (
        'worktree-remove-' + [guid]::NewGuid().ToString('N') + '.stderr'
    )
    try {
        $previousErrorActionPreference = $ErrorActionPreference
        try {
            $ErrorActionPreference = 'Continue'
            $output = @(
                & $script:GitExecutable -C $Repository worktree remove -- $TaskWorktreePath 2> $stderrPath |
                    ForEach-Object { "$_" }
            )
            $exitCode = $LASTEXITCODE
        }
        finally {
            $ErrorActionPreference = $previousErrorActionPreference
        }
        $stderr = if (Test-Path -LiteralPath $stderrPath -PathType Leaf) {
            [IO.File]::ReadAllText($stderrPath)
        }
        else {
            ''
        }
        return [pscustomobject]@{
            ExitCode = $exitCode
            Output = $output
            StandardError = $stderr
        }
    }
    finally {
        if (Test-Path -LiteralPath $stderrPath) {
            Remove-Item -LiteralPath $stderrPath -Force -ErrorAction SilentlyContinue
        }
    }
}

function Get-NormalizedPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    return [IO.Path]::GetFullPath($Path).TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
}

function Test-PathWithin {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Candidate,

        [Parameter(Mandatory = $true)]
        [string]$Container
    )

    $candidatePath = Get-NormalizedPath -Path $Candidate
    $containerPath = Get-NormalizedPath -Path $Container
    $prefix = $containerPath + [IO.Path]::DirectorySeparatorChar
    return (
        $candidatePath.Equals($containerPath, [StringComparison]::OrdinalIgnoreCase) -or
        $candidatePath.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)
    )
}

function Test-IsLinkOrReparsePoint {
    param(
        [Parameter(Mandatory = $true)]
        [psobject]$Item
    )

    return (
        ($Item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or
        -not [string]::IsNullOrEmpty([string]$Item.LinkType) -or
        $null -ne $Item.Target
    )
}

function Assert-NoReparseAncestor {
    param(
        [Parameter(Mandatory = $true)]
        [string]$WorktreesRoot,

        [Parameter(Mandatory = $true)]
        [string]$RetiredWorktree
    )

    $relative = [IO.Path]::GetRelativePath($WorktreesRoot, $RetiredWorktree)
    $segments = @($relative.Split(
        [char[]]@([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar),
        [StringSplitOptions]::RemoveEmptyEntries
    ))
    $current = $WorktreesRoot
    $pathsToCheck = @($WorktreesRoot)
    for ($index = 0; $index -lt [Math]::Max(0, $segments.Count - 1); $index += 1) {
        $current = Join-Path $current $segments[$index]
        $pathsToCheck += $current
    }
    foreach ($candidate in $pathsToCheck) {
        $item = Get-Item -LiteralPath $candidate -Force -ErrorAction Stop
        if (Test-IsLinkOrReparsePoint -Item $item) {
            throw 'worktree_cleanup_reparse_ancestor_present'
        }
    }
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
    Assert-NoReparseAncestor -WorktreesRoot $worktreesRoot -RetiredWorktree $RetiredWorktree
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
        $_.StartsWith($retiredPrefix, [StringComparison]::OrdinalIgnoreCase) -or
        (
            -not $_.Equals($repository, [StringComparison]::OrdinalIgnoreCase) -and
            (Test-PathWithin -Candidate $retired -Container $_)
        )
    }).Count -ne 0) {
        throw 'worktree_cleanup_residual_still_registered'
    }

    $targetItem = Get-Item -LiteralPath $retired -Force
    if (-not $targetItem.PSIsContainer -or (Test-IsLinkOrReparsePoint -Item $targetItem)) {
        throw 'worktree_cleanup_residual_root_invalid'
    }
    if (Test-Path -LiteralPath (Join-Path $retired '.git')) {
        throw 'worktree_cleanup_git_marker_present'
    }
    Remove-LiteralDirectoryTree -Path $retired
    if (Test-Path -LiteralPath $retired) {
        throw 'worktree_cleanup_residual_removal_failed'
    }
    return $true
}

function Complete-GitWorktreeRemove {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Repository,

        [Parameter(Mandatory = $true)]
        [string]$RetiredWorktreePath,

        [Parameter(Mandatory = $true)]
        [psobject]$RemoveResult
    )

    if ([string]::IsNullOrWhiteSpace($script:GitExecutable)) {
        $script:GitExecutable = (Get-Command git -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source
    }
    if ($RemoveResult.ExitCode -isnot [int]) {
        throw 'worktree_cleanup_git_remove_result_invalid'
    }
    $script:GitRemoveExitCode = [int]$RemoveResult.ExitCode
    $script:GitRemoveStderr = Get-BoundedDiagnosticText -Text ([string]$RemoveResult.StandardError)

    $registeredPaths = Get-RegisteredWorktreePaths -Repository $Repository
    if (@($registeredPaths | Where-Object {
        $_.Equals($RetiredWorktreePath, [StringComparison]::OrdinalIgnoreCase)
    }).Count -ne 0) {
        throw 'worktree_cleanup_git_remove_failed'
    }

    $residualRemoved = Remove-VerifiedResidualPath `
        -Repository $Repository `
        -RetiredWorktreePath $RetiredWorktreePath `
        -CapturedRetiredWorktreePath $RetiredWorktreePath
    return [pscustomobject]@{
        ResidualRemoved = $residualRemoved
        NonzeroDeregistered = $script:GitRemoveExitCode -ne 0
    }
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
        [Nullable[bool]]$BranchRefsPreserved = $null,

        [Parameter(Mandatory = $false)]
        [Nullable[int]]$GitRemoveExitCode = $script:GitRemoveExitCode,

        [Parameter(Mandatory = $false)]
        [AllowNull()]
        [string]$GitRemoveStderr = $script:GitRemoveStderr
    )

    [ordered]@{
        state = $State
        reason = $Reason
        action = $Action
        repository = $script:Repository
        retired_worktree = $script:RetiredWorktree
        residual_removed = $ResidualRemoved
        branch_refs_preserved = $BranchRefsPreserved
        git_remove_exit_code = $GitRemoveExitCode
        git_remove_stderr = $GitRemoveStderr
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
        $refsBefore = Get-BranchRefDigest -Repository $script:Repository
        $remove = Invoke-GitWorktreeRemove `
            -Repository $script:Repository `
            -TaskWorktreePath $script:RetiredWorktree
        $completion = Complete-GitWorktreeRemove `
            -Repository $script:Repository `
            -RetiredWorktreePath $script:RetiredWorktree `
            -RemoveResult $remove
        $residualRemoved = $completion.ResidualRemoved
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
            -Action $(
                if ($completion.NonzeroDeregistered -and $residualRemoved) {
                    'GIT_REMOVE_NONZERO_DEREGISTERED_PLUS_RESIDUE_REMOVE'
                }
                elseif ($completion.NonzeroDeregistered) {
                    'GIT_REMOVE_NONZERO_DEREGISTERED'
                }
                elseif ($residualRemoved) {
                    'GIT_REMOVE_PLUS_RESIDUE_REMOVE'
                }
                else {
                    'GIT_REMOVE'
                }
            ) `
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
