[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$RepositoryPath
)

$ErrorActionPreference = 'Stop'
$script:GitExecutable = $null
$script:Repository = $null
$script:LocalMainBefore = $null
$script:OriginMain = $null

function Invoke-NativeGit {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    $previousErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $output = @(& $script:GitExecutable -C $script:Repository @Arguments 2>&1 | ForEach-Object { "$_" })
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

function Write-Result {
    param(
        [Parameter(Mandatory = $true)]
        [string]$State,

        [Parameter(Mandatory = $true)]
        [string]$Reason,

        [Parameter(Mandatory = $false)]
        [string]$Action = 'NONE',

        [Parameter(Mandatory = $false)]
        [string]$LocalMainAfter = $null,

        [Parameter(Mandatory = $false)]
        [Nullable[int]]$LocalOnlyCommits = $null
    )

    [ordered]@{
        state = $State
        reason = $Reason
        action = $Action
        repository = $script:Repository
        local_main_before = $script:LocalMainBefore
        origin_main = $script:OriginMain
        local_main_after = $LocalMainAfter
        local_only_commits = $LocalOnlyCommits
        merge_outcome_affected = $false
        worktree_cleanup_may_continue = $true
    } | ConvertTo-Json -Depth 3 -Compress | Write-Output
}

try {
    $gitCommand = Get-Command git -CommandType Application -ErrorAction Stop | Select-Object -First 1
    $script:GitExecutable = $gitCommand.Source

    if (-not (Test-Path -LiteralPath $RepositoryPath -PathType Container)) {
        throw 'local_main_sync_repository_invalid'
    }
    $script:Repository = [IO.Path]::GetFullPath((Resolve-Path -LiteralPath $RepositoryPath).Path).TrimEnd('\', '/')
    if (-not (Test-Path -LiteralPath (Join-Path $script:Repository '.git') -PathType Container)) {
        throw 'local_main_sync_root_worktree_required'
    }

    $topLevel = Require-GitSuccess -Result (Invoke-NativeGit -Arguments @('rev-parse', '--show-toplevel')) -Reason 'local_main_sync_repository_invalid'
    $normalizedTopLevel = [IO.Path]::GetFullPath($topLevel).TrimEnd('\', '/')
    if (-not $normalizedTopLevel.Equals($script:Repository, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'local_main_sync_root_worktree_required'
    }

    $branch = Require-GitSuccess -Result (Invoke-NativeGit -Arguments @('branch', '--show-current')) -Reason 'local_main_sync_branch_invalid'
    if ($branch -cne 'main') {
        throw 'local_main_sync_branch_invalid'
    }
    $script:LocalMainBefore = Require-GitSuccess -Result (Invoke-NativeGit -Arguments @('rev-parse', 'refs/heads/main')) -Reason 'local_main_sync_branch_invalid'

    $fetch = Invoke-NativeGit -Arguments @('fetch', '--no-tags', 'origin', 'refs/heads/main:refs/remotes/origin/main')
    if ($fetch.ExitCode -ne 0) {
        throw 'local_main_sync_fetch_failed'
    }

    $status = Invoke-NativeGit -Arguments @('status', '--porcelain=v1', '--untracked-files=all')
    if ($status.ExitCode -ne 0) {
        throw 'local_main_sync_status_failed'
    }
    if ($status.Output.Count -ne 0) {
        throw 'local_main_sync_root_dirty'
    }

    $localMain = Require-GitSuccess -Result (Invoke-NativeGit -Arguments @('rev-parse', 'refs/heads/main')) -Reason 'local_main_sync_branch_invalid'
    $script:OriginMain = Require-GitSuccess -Result (Invoke-NativeGit -Arguments @('rev-parse', 'refs/remotes/origin/main')) -Reason 'local_main_sync_origin_main_invalid'
    $localOnlyText = Require-GitSuccess -Result (Invoke-NativeGit -Arguments @('rev-list', '--count', 'refs/remotes/origin/main..refs/heads/main')) -Reason 'local_main_sync_ancestry_failed'
    $localOnlyCommits = 0
    if (-not [int]::TryParse($localOnlyText, [ref]$localOnlyCommits) -or $localOnlyCommits -lt 0) {
        throw 'local_main_sync_ancestry_failed'
    }

    $mainAncestor = Invoke-NativeGit -Arguments @('merge-base', '--is-ancestor', 'refs/heads/main', 'refs/remotes/origin/main')
    if ($mainAncestor.ExitCode -notin @(0, 1)) {
        throw 'local_main_sync_ancestry_failed'
    }
    $originAncestor = Invoke-NativeGit -Arguments @('merge-base', '--is-ancestor', 'refs/remotes/origin/main', 'refs/heads/main')
    if ($originAncestor.ExitCode -notin @(0, 1)) {
        throw 'local_main_sync_ancestry_failed'
    }

    if ($localOnlyCommits -gt 0) {
        if ($originAncestor.ExitCode -eq 0) {
            throw 'local_main_sync_local_only_commits'
        }
        throw 'local_main_sync_diverged'
    }
    if ($mainAncestor.ExitCode -ne 0) {
        throw 'local_main_sync_diverged'
    }

    if ($localMain -ceq $script:OriginMain) {
        Write-Result -State 'PASS' -Reason 'local_main_already_equal' -Action 'ALREADY_EQUAL' -LocalMainAfter $localMain -LocalOnlyCommits $localOnlyCommits
        exit 0
    }

    $beforeMutationStatus = Invoke-NativeGit -Arguments @('status', '--porcelain=v1', '--untracked-files=all')
    if ($beforeMutationStatus.ExitCode -ne 0 -or $beforeMutationStatus.Output.Count -ne 0) {
        throw 'local_main_sync_root_dirty'
    }
    $fastForward = Invoke-NativeGit -Arguments @('merge', '--ff-only', 'origin/main')
    if ($fastForward.ExitCode -ne 0) {
        throw 'local_main_sync_fast_forward_failed'
    }

    $localMainAfter = Require-GitSuccess -Result (Invoke-NativeGit -Arguments @('rev-parse', 'refs/heads/main')) -Reason 'local_main_sync_final_verification_failed'
    $originMainAfter = Require-GitSuccess -Result (Invoke-NativeGit -Arguments @('rev-parse', 'refs/remotes/origin/main')) -Reason 'local_main_sync_final_verification_failed'
    $finalStatus = Invoke-NativeGit -Arguments @('status', '--porcelain=v1', '--untracked-files=all')
    if ($localMainAfter -cne $originMainAfter -or $finalStatus.ExitCode -ne 0 -or $finalStatus.Output.Count -ne 0) {
        throw 'local_main_sync_final_verification_failed'
    }

    $script:OriginMain = $originMainAfter
    Write-Result -State 'PASS' -Reason 'local_main_fast_forwarded' -Action 'FAST_FORWARD' -LocalMainAfter $localMainAfter -LocalOnlyCommits $localOnlyCommits
    exit 0
}
catch {
    $reason = $_.Exception.Message
    if ($reason -notmatch '^local_main_sync_[a-z_]+$') {
        $reason = 'local_main_sync_internal_failure'
    }
    $localMainAfter = $null
    if ($script:GitExecutable -and $script:Repository) {
        $after = Invoke-NativeGit -Arguments @('rev-parse', '--verify', 'refs/heads/main')
        if ($after.ExitCode -eq 0) {
            $localMainAfter = ($after.Output -join "`n").Trim()
        }
    }
    Write-Result -State 'FAILED' -Reason $reason -LocalMainAfter $localMainAfter
    exit 1
}
