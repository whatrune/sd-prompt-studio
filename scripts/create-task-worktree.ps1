[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$RepositoryPath,

    [Parameter(Mandatory = $true)]
    [string]$BaseCommit,

    [Parameter(Mandatory = $true)]
    [string]$Branch,

    [Parameter(Mandatory = $true)]
    [string]$WorktreePath,

    [Parameter(Mandatory = $true)]
    [string]$RepositorySlug,

    [Parameter(Mandatory = $true)]
    [ValidateRange(1, [int]::MaxValue)]
    [int]$CanonicalTaskId,

    [Parameter(Mandatory = $true)]
    [string]$Objective,

    [Parameter(Mandatory = $true)]
    [string[]]$AuthorizedPaths,

    [Parameter(Mandatory = $true)]
    [string]$ExpectedHead,

    [Parameter(Mandatory = $false)]
    [Nullable[int]]$ExpectedPullRequest,

    [Parameter(Mandatory = $false)]
    [string]$ExecutionInstanceId = ([guid]::NewGuid().ToString()),

    [Parameter(Mandatory = $false)]
    [string]$DependencyProviderWorktree
)

$ErrorActionPreference = 'Stop'
$script:GitExecutable = $null
$script:CanonicalSnapshot = $null
$script:CanonicalPath = $null
$script:FailureMessage = $null
$script:DependencyRoute = $null
$script:ResolvedTargetPath = $null
$script:ProviderResolvedPath = $null
$script:ProviderHead = $null
$script:ManifestBlobBinding = $null
$script:ExecutionIdentityProjection = $null

function Invoke-NativeCommand {
    param(
        [Parameter(Mandatory = $true)]
        [string]$FilePath,

        [Parameter(Mandatory = $true)]
        [string[]]$Arguments,

        [Parameter(Mandatory = $false)]
        [string]$WorkingDirectory
    )

    $previousLocation = $null
    $previousErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        if ($WorkingDirectory) {
            $previousLocation = Get-Location
            Set-Location -LiteralPath $WorkingDirectory
        }

        $output = @(& $FilePath @Arguments 2>&1 | ForEach-Object { "$_" })
        $exitCode = $LASTEXITCODE
        return [pscustomobject]@{
            ExitCode = $exitCode
            Output = $output
        }
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
        if ($null -ne $previousLocation) {
            Set-Location -LiteralPath $previousLocation
        }
    }
}

function Invoke-Git {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Repository,

        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    return Invoke-NativeCommand -FilePath $script:GitExecutable -Arguments (@('-C', $Repository) + $Arguments)
}

function Assert-GitSuccess {
    param(
        [Parameter(Mandatory = $true)]
        [psobject]$Result,

        [Parameter(Mandatory = $true)]
        [string]$Operation
    )

    if ($Result.ExitCode -ne 0) {
        throw "$Operation failed (git exit $($Result.ExitCode))."
    }
}

function Get-NormalizedExistingDirectory {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,

        [Parameter(Mandatory = $true)]
        [string]$Name
    )

    if (-not (Test-Path -LiteralPath $Path -PathType Container)) {
        throw "$Name does not identify an existing directory."
    }

    return [IO.Path]::GetFullPath((Resolve-Path -LiteralPath $Path).Path).TrimEnd('\', '/')
}

function Get-ResolvedInputPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,

        [Parameter(Mandatory = $true)]
        [string]$RelativeTo
    )

    if ([IO.Path]::IsPathRooted($Path)) {
        return [IO.Path]::GetFullPath($Path).TrimEnd('\', '/')
    }

    return [IO.Path]::GetFullPath((Join-Path $RelativeTo $Path)).TrimEnd('\', '/')
}

function Assert-ContainedTargetPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Repository,

        [Parameter(Mandatory = $true)]
        [string]$Target
    )

    $separator = [IO.Path]::DirectorySeparatorChar
    $repositoryPrefix = $Repository.TrimEnd('\', '/') + $separator
    if (-not $Target.StartsWith($repositoryPrefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'WorktreePath escapes RepositoryPath containment.'
    }

    if (Test-Path -LiteralPath $Target) {
        throw 'WorktreePath already exists.'
    }

    $cursor = Split-Path -Parent $Target
    while ($cursor -and -not $cursor.Equals($Repository, [StringComparison]::OrdinalIgnoreCase)) {
        if (Test-Path -LiteralPath $cursor) {
            $item = Get-Item -Force -LiteralPath $cursor
            if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
                throw 'WorktreePath containment crosses a reparse point.'
            }
        }
        $next = Split-Path -Parent $cursor
        if ($next -eq $cursor) {
            break
        }
        $cursor = $next
    }

    if (-not $cursor.Equals($Repository, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'WorktreePath containment could not be proven.'
    }

    $parent = Split-Path -Parent $Target
    if (-not (Test-Path -LiteralPath $parent -PathType Container)) {
        throw 'WorktreePath parent directory does not exist.'
    }
}

function Get-FileDigest {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        return '<missing>'
    }

    return (Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash.ToLowerInvariant()
}

function Get-TextDigest {
    param(
        [Parameter(Mandatory = $true)]
        [AllowEmptyString()]
        [string]$Text
    )

    $bytes = [Text.Encoding]::UTF8.GetBytes($Text)
    $sha = [Security.Cryptography.SHA256]::Create()
    try {
        return ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-', '').ToLowerInvariant()
    }
    finally {
        $sha.Dispose()
    }
}

function Get-OptionalGitConfig {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Repository,

        [Parameter(Mandatory = $true)]
        [string]$Key
    )

    $result = Invoke-Git -Repository $Repository -Arguments @('config', '--get', $Key)
    if ($result.ExitCode -eq 1) {
        return '<unset>'
    }
    Assert-GitSuccess -Result $result -Operation "read $Key"
    return ($result.Output -join "`n")
}

function Get-RepositoryFileDigest {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Repository
    )

    $filesResult = Invoke-Git -Repository $Repository -Arguments @(
        '-c', 'core.quotepath=false', 'ls-files', '--cached', '--others', '--exclude-standard'
    )
    Assert-GitSuccess -Result $filesResult -Operation 'enumerate tracked and untracked files'

    $rows = foreach ($relativePath in @($filesResult.Output | Sort-Object)) {
        if ([string]::IsNullOrWhiteSpace($relativePath)) {
            continue
        }
        $fullPath = Join-Path $Repository $relativePath
        "$relativePath=$(Get-FileDigest -Path $fullPath)"
    }

    $bytes = [Text.Encoding]::UTF8.GetBytes(($rows -join "`n"))
    $sha = [Security.Cryptography.SHA256]::Create()
    try {
        return ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-', '').ToLowerInvariant()
    }
    finally {
        $sha.Dispose()
    }
}

function Get-CanonicalSnapshot {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Repository
    )

    $branchResult = Invoke-Git -Repository $Repository -Arguments @('branch', '--show-current')
    Assert-GitSuccess -Result $branchResult -Operation 'read canonical branch'
    $headResult = Invoke-Git -Repository $Repository -Arguments @('rev-parse', 'HEAD')
    Assert-GitSuccess -Result $headResult -Operation 'read canonical HEAD'
    $statusResult = Invoke-Git -Repository $Repository -Arguments @('status', '--porcelain=v1', '--untracked-files=all')
    Assert-GitSuccess -Result $statusResult -Operation 'read canonical status'
    $indexResult = Invoke-Git -Repository $Repository -Arguments @('rev-parse', '--git-path', 'index')
    Assert-GitSuccess -Result $indexResult -Operation 'resolve canonical index'

    $indexPath = $indexResult.Output[0]
    if (-not [IO.Path]::IsPathRooted($indexPath)) {
        $indexPath = Join-Path $Repository $indexPath
    }
    $indexPath = [IO.Path]::GetFullPath($indexPath)

    return [pscustomobject]@{
        Branch = ($branchResult.Output -join "`n")
        Head = ($headResult.Output -join "`n")
        IndexDigest = Get-FileDigest -Path $indexPath
        Status = @($statusResult.Output)
        FileDigest = Get-RepositoryFileDigest -Repository $Repository
        AutoCrlf = Get-OptionalGitConfig -Repository $Repository -Key 'core.autocrlf'
        Eol = Get-OptionalGitConfig -Repository $Repository -Key 'core.eol'
    }
}

function Test-SnapshotEqual {
    param(
        [Parameter(Mandatory = $true)]
        [psobject]$Before,

        [Parameter(Mandatory = $true)]
        [psobject]$After
    )

    return (($Before | ConvertTo-Json -Depth 5 -Compress) -ceq ($After | ConvertTo-Json -Depth 5 -Compress))
}

function Get-GitCommonDirectory {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Worktree
    )

    $result = Invoke-Git -Repository $Worktree -Arguments @('rev-parse', '--path-format=absolute', '--git-common-dir')
    Assert-GitSuccess -Result $result -Operation 'resolve Git common directory'
    return [IO.Path]::GetFullPath($result.Output[0]).TrimEnd('\', '/')
}

function Get-DependencyManifestNames {
    return @('package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'pnpm-workspace.yml')
}

function Get-RequiredDependencyManifestNames {
    return @('package.json', 'pnpm-lock.yaml')
}

function Get-ManifestSnapshot {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Worktree
    )

    $snapshot = [ordered]@{}
    foreach ($name in Get-DependencyManifestNames) {
        $path = Join-Path $Worktree $name
        $snapshot[$name] = Get-FileDigest -Path $path
    }
    return $snapshot
}

function Get-TrackedManifestProof {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Worktree,

        [Parameter(Mandatory = $true)]
        [string]$Owner
    )

    $headResult = Invoke-Git -Repository $Worktree -Arguments @('rev-parse', '--verify', 'HEAD^{commit}')
    Assert-GitSuccess -Result $headResult -Operation "resolve $Owner HEAD"
    $head = ($headResult.Output -join '')
    if ($head -notmatch '^[0-9a-f]{40}$') {
        throw "$Owner HEAD is not a full commit SHA."
    }

    $paths = @()
    $blobs = [ordered]@{}
    foreach ($name in Get-DependencyManifestNames) {
        $treeResult = Invoke-Git -Repository $Worktree -Arguments @('ls-tree', $head, '--', $name)
        Assert-GitSuccess -Result $treeResult -Operation "resolve $Owner manifest tree entry"
        if ($treeResult.Output.Count -eq 0) {
            continue
        }
        if ($treeResult.Output.Count -ne 1) {
            throw "$Owner manifest tree entry is ambiguous ($name)."
        }

        $entry = $treeResult.Output[0]
        if ($entry -notmatch '^([0-9]{6}) ([^ ]+) ([0-9a-f]+)\t(.+)$') {
            throw "$Owner manifest tree entry is invalid ($name)."
        }
        if ($Matches[4] -cne $name) {
            throw "$Owner manifest tree path is invalid ($name)."
        }
        if ($Matches[2] -cne 'blob') {
            throw "$Owner manifest is not a Git blob ($name)."
        }

        $paths += $name
        $blobs[$name] = $Matches[3]
    }

    foreach ($name in Get-RequiredDependencyManifestNames) {
        if ($paths -cnotcontains $name) {
            throw "$Owner HEAD is missing required manifest $name."
        }
    }

    $candidateNames = @(Get-DependencyManifestNames)
    $stagedResult = Invoke-Git -Repository $Worktree -Arguments (@('diff', '--cached', '--name-only', '--') + $candidateNames)
    Assert-GitSuccess -Result $stagedResult -Operation "check $Owner staged manifests"
    $unstagedResult = Invoke-Git -Repository $Worktree -Arguments (@('diff', '--name-only', '--') + $candidateNames)
    Assert-GitSuccess -Result $unstagedResult -Operation "check $Owner unstaged manifests"
    $untrackedResult = Invoke-Git -Repository $Worktree -Arguments (@('ls-files', '--others', '--') + $candidateNames)
    Assert-GitSuccess -Result $untrackedResult -Operation "check $Owner untracked manifests"

    $staged = @($stagedResult.Output)
    $unstaged = @($unstagedResult.Output)
    $untracked = @($untrackedResult.Output)
    if ($staged.Count -gt 0 -or $unstaged.Count -gt 0 -or $untracked.Count -gt 0) {
        $dirtyKinds = @()
        if ($staged.Count -gt 0) { $dirtyKinds += 'staged' }
        if ($unstaged.Count -gt 0) { $dirtyKinds += 'unstaged' }
        if ($untracked.Count -gt 0) { $dirtyKinds += 'untracked' }
        throw "$Owner manifest state is dirty ($($dirtyKinds -join ','))."
    }

    return [pscustomobject]@{
        Head = $head
        Paths = @($paths)
        Blobs = $blobs
        Staged = $staged
        Unstaged = $unstaged
        Untracked = $untracked
        Clean = $true
    }
}

function Assert-ManifestProofsCompatible {
    param(
        [Parameter(Mandatory = $true)]
        [psobject]$Target,

        [Parameter(Mandatory = $true)]
        [psobject]$Provider
    )

    if (($Target.Paths -join "`n") -cne ($Provider.Paths -join "`n")) {
        throw 'Dependency provider manifest target set is incompatible.'
    }

    foreach ($name in $Target.Paths) {
        if ($Target.Blobs[$name] -cne $Provider.Blobs[$name]) {
            throw "Dependency provider manifest blob is incompatible ($name)."
        }
    }
}

function Get-NodeModulesSnapshot {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        return [pscustomobject]@{ Exists = $false }
    }

    $item = Get-Item -Force -LiteralPath $Path
    return [pscustomobject]@{
        Exists = $true
        FullName = $item.FullName
        Attributes = [string]$item.Attributes
        LinkType = [string]$item.LinkType
        Target = [string]($item.Target -join '|')
    }
}

function Get-DependencyTreeRows {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Root,

        [Parameter(Mandatory = $true)]
        [string]$Current,

        [Parameter(Mandatory = $true)]
        [ValidateSet('Payload', 'Links')]
        [string]$Mode
    )

    $rootPrefix = $Root.TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar
    foreach ($item in @(Get-ChildItem -Force -LiteralPath $Current | Sort-Object -Property FullName)) {
        $relativePath = $item.FullName.Substring($rootPrefix.Length).Replace('\', '/')
        $isReparsePoint = (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0)

        if ($isReparsePoint) {
            if ($Mode -ceq 'Links') {
                "$relativePath|$([string]$item.LinkType)|$([string]($item.Target -join '|'))"
            }
            continue
        }

        if ($item.PSIsContainer) {
            Get-DependencyTreeRows -Root $Root -Current $item.FullName -Mode $Mode
            continue
        }

        if ($Mode -ceq 'Payload') {
            "$relativePath=$(Get-FileDigest -Path $item.FullName)"
        }
    }
}

function Get-InstalledDependencySnapshot {
    param(
        [Parameter(Mandatory = $true)]
        [string]$NodeModulesPath
    )

    if (-not (Test-Path -LiteralPath $NodeModulesPath -PathType Container)) {
        throw 'Dependency provider node_modules does not exist.'
    }

    $virtualStore = Join-Path $NodeModulesPath '.pnpm'
    if (-not (Test-Path -LiteralPath $virtualStore -PathType Container)) {
        throw 'Dependency provider pnpm virtual store does not exist.'
    }

    $instanceKeys = @(
        Get-ChildItem -Force -LiteralPath $virtualStore -Directory |
            Where-Object { $_.Name -cne 'node_modules' } |
            ForEach-Object { $_.Name } |
            Sort-Object
    )
    if ($instanceKeys.Count -eq 0) {
        throw 'Dependency provider pnpm package instance set is empty.'
    }

    $virtualStorePayloadRows = foreach ($instanceKey in $instanceKeys) {
        $payloadRoot = Join-Path (Join-Path $virtualStore $instanceKey) 'node_modules'
        if (Test-Path -LiteralPath $payloadRoot -PathType Container) {
            Get-DependencyTreeRows -Root $payloadRoot -Current $payloadRoot -Mode 'Payload' |
                ForEach-Object { "$instanceKey/$_" }
        }
    }
    $linkedPayloadRows = foreach ($item in @(Get-ChildItem -Force -LiteralPath $NodeModulesPath | Sort-Object -Property Name)) {
        $isReparsePoint = (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0)
        if (-not $item.PSIsContainer -or -not $isReparsePoint -or $item.Name -ceq '.bin') {
            continue
        }

        $linkedTarget = [string]($item.Target -join '')
        if (-not [IO.Path]::IsPathRooted($linkedTarget)) {
            $linkedTarget = Join-Path $NodeModulesPath $linkedTarget
        }
        $linkedTarget = [IO.Path]::GetFullPath($linkedTarget)
        if (-not (Test-Path -LiteralPath $linkedTarget -PathType Container)) {
            throw "Dependency provider package link target is unavailable ($($item.Name))."
        }
        Get-DependencyTreeRows -Root $linkedTarget -Current $linkedTarget -Mode 'Payload' |
            ForEach-Object { "$($item.Name)/$_" }
    }
    $payloadRows = @(@($virtualStorePayloadRows) + @($linkedPayloadRows) | Sort-Object)
    if ($payloadRows.Count -eq 0) {
        throw 'Dependency provider installed package payload is empty.'
    }
    $linkRows = @(Get-DependencyTreeRows -Root $NodeModulesPath -Current $NodeModulesPath -Mode 'Links' | Sort-Object)

    return [pscustomobject]@{
        PackageInstanceCount = $instanceKeys.Count
        PackageInstanceSetDigest = Get-TextDigest -Text ($instanceKeys -join "`n")
        InstalledPayloadFileCount = $payloadRows.Count
        InstalledPackageContentDigest = Get-TextDigest -Text ($payloadRows -join "`n")
        DependencyLinkCount = $linkRows.Count
        DependencyLinkTargetMapDigest = Get-TextDigest -Text ($linkRows -join "`n")
    }
}

function Get-ProviderSnapshot {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Provider
    )

    $headResult = Invoke-Git -Repository $Provider -Arguments @('rev-parse', 'HEAD')
    Assert-GitSuccess -Result $headResult -Operation 'read provider HEAD'
    $statusResult = Invoke-Git -Repository $Provider -Arguments @('status', '--porcelain=v1', '--untracked-files=all')
    Assert-GitSuccess -Result $statusResult -Operation 'read provider status'
    $indexResult = Invoke-Git -Repository $Provider -Arguments @('rev-parse', '--git-path', 'index')
    Assert-GitSuccess -Result $indexResult -Operation 'resolve provider index'

    $indexPath = $indexResult.Output[0]
    if (-not [IO.Path]::IsPathRooted($indexPath)) {
        $indexPath = Join-Path $Provider $indexPath
    }
    $indexPath = [IO.Path]::GetFullPath($indexPath)
    $nodeModulesPath = Join-Path $Provider 'node_modules'

    return [pscustomobject]@{
        Head = ($headResult.Output -join "`n")
        IndexDigest = Get-FileDigest -Path $indexPath
        Status = @($statusResult.Output)
        ManifestBytes = Get-ManifestSnapshot -Worktree $Provider
        ManifestProof = Get-TrackedManifestProof -Worktree $Provider -Owner 'Dependency provider'
        NodeModules = Get-NodeModulesSnapshot -Path $nodeModulesPath
        InstalledDependencies = Get-InstalledDependencySnapshot -NodeModulesPath $nodeModulesPath
    }
}

function Remove-AttemptNodeModules {
    param(
        [Parameter(Mandatory = $true)]
        [string]$TargetWorktree
    )

    $targetNodeModules = [IO.Path]::GetFullPath((Join-Path $TargetWorktree 'node_modules'))
    $targetPrefix = $TargetWorktree.TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar
    if (-not $targetNodeModules.StartsWith($targetPrefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'Attempt output containment could not be proven.'
    }

    if (-not (Test-Path -LiteralPath $targetNodeModules)) {
        return
    }

    $item = Get-Item -Force -LiteralPath $targetNodeModules
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        Remove-Item -Force -LiteralPath $targetNodeModules
    }
    else {
        Remove-Item -Recurse -Force -LiteralPath $targetNodeModules
    }

    if (Test-Path -LiteralPath $targetNodeModules) {
        throw 'Attempt-generated node_modules could not be removed safely.'
    }
}

try {
    $gitCommand = Get-Command git -CommandType Application -ErrorAction Stop | Select-Object -First 1
    $script:GitExecutable = $gitCommand.Source

    $script:CanonicalPath = Get-NormalizedExistingDirectory -Path $RepositoryPath -Name 'RepositoryPath'
    $topLevelResult = Invoke-Git -Repository $script:CanonicalPath -Arguments @('rev-parse', '--show-toplevel')
    Assert-GitSuccess -Result $topLevelResult -Operation 'resolve repository root'
    $topLevel = [IO.Path]::GetFullPath($topLevelResult.Output[0]).TrimEnd('\', '/')
    if (-not $topLevel.Equals($script:CanonicalPath, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'RepositoryPath must identify the canonical worktree root.'
    }

    $script:CanonicalSnapshot = Get-CanonicalSnapshot -Repository $script:CanonicalPath
    if ($script:CanonicalSnapshot.Branch -cne 'main') {
        throw 'RepositoryPath must identify the canonical main worktree.'
    }

    if ($BaseCommit -notmatch '^[0-9a-f]{40}$') {
        throw 'BaseCommit must be a canonical lower-case full 40-character SHA.'
    }
    if ($ExpectedHead -cne $BaseCommit) {
        throw 'ExpectedHead must equal BaseCommit for a newly created worktree.'
    }
    if ($RepositorySlug -notmatch '^[a-z0-9_.-]+/[a-z0-9_.-]+$') {
        throw 'RepositorySlug must be a canonical lower-case owner/repository identity.'
    }
    if ([string]::IsNullOrWhiteSpace($Objective)) {
        throw 'Objective must be non-empty.'
    }
    if ($AuthorizedPaths.Count -eq 0) {
        throw 'AuthorizedPaths must be non-empty.'
    }
    if ($null -ne $ExpectedPullRequest) {
        throw 'New worktree creation requires expected_pr = null; PR discovery before publication is prohibited.'
    }
    if ($ExecutionInstanceId -notmatch '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$') {
        throw 'ExecutionInstanceId must be a canonical UUID.'
    }

    $originResult = Invoke-Git -Repository $script:CanonicalPath -Arguments @('remote', 'get-url', 'origin')
    Assert-GitSuccess -Result $originResult -Operation 'resolve origin repository'
    $origin = ($originResult.Output -join '')
    $escapedRepository = [regex]::Escape($RepositorySlug)
    if ($origin -notmatch "(?i)(github\.com[:/])$escapedRepository(?:\.git)?$") {
        throw 'RepositorySlug does not match the exact origin repository.'
    }

    $remoteMainResult = Invoke-Git -Repository $script:CanonicalPath -Arguments @('ls-remote', '--exit-code', 'origin', 'refs/heads/main')
    Assert-GitSuccess -Result $remoteMainResult -Operation 'resolve fresh remote main'
    if ($remoteMainResult.Output.Count -ne 1 -or $remoteMainResult.Output[0] -notmatch '^([0-9a-f]{40})\s+refs/heads/main$') {
        throw 'Fresh remote main response is invalid.'
    }
    $remoteMain = $Matches[1]
    if ($remoteMain -cne $BaseCommit) {
        throw 'BaseCommit does not match fresh remote main.'
    }
    $baseTypeResult = Invoke-Git -Repository $script:CanonicalPath -Arguments @('cat-file', '-t', $BaseCommit)
    if ($baseTypeResult.ExitCode -ne 0 -or ($baseTypeResult.Output -join '') -cne 'commit') {
        throw 'BaseCommit is not an existing local commit object.'
    }

    $branchFormatResult = Invoke-Git -Repository $script:CanonicalPath -Arguments @('check-ref-format', '--branch', $Branch)
    if ($branchFormatResult.ExitCode -ne 0) {
        throw 'Branch is not a valid branch name.'
    }
    $branchExistsResult = Invoke-Git -Repository $script:CanonicalPath -Arguments @('show-ref', '--verify', '--quiet', "refs/heads/$Branch")
    if ($branchExistsResult.ExitCode -eq 0) {
        throw 'Branch already exists.'
    }
    if ($branchExistsResult.ExitCode -ne 1) {
        throw 'Branch collision check failed.'
    }

    $script:ResolvedTargetPath = Get-ResolvedInputPath -Path $WorktreePath -RelativeTo $script:CanonicalPath
    Assert-ContainedTargetPath -Repository $script:CanonicalPath -Target $script:ResolvedTargetPath

    $worktreeListResult = Invoke-Git -Repository $script:CanonicalPath -Arguments @('worktree', 'list', '--porcelain')
    Assert-GitSuccess -Result $worktreeListResult -Operation 'enumerate registered worktrees'
    foreach ($line in $worktreeListResult.Output) {
        if ($line.StartsWith('worktree ')) {
            $registeredPath = [IO.Path]::GetFullPath($line.Substring(9)).TrimEnd('\', '/')
            if ($registeredPath.Equals($script:ResolvedTargetPath, [StringComparison]::OrdinalIgnoreCase)) {
                throw 'WorktreePath is already registered.'
            }
        }
    }

    $pnpmCommand = Get-Command pnpm.cmd -CommandType Application -ErrorAction Stop | Select-Object -First 1

    $addResult = Invoke-NativeCommand -FilePath $script:GitExecutable -Arguments @(
        '-c', 'core.autocrlf=false', '-c', 'core.eol=lf', '-C', $script:CanonicalPath,
        'worktree', 'add', '-b', $Branch, $script:ResolvedTargetPath, $BaseCommit
    )
    Assert-GitSuccess -Result $addResult -Operation 'create exact-base worktree'

    $worktreeConfigResult = Invoke-Git -Repository $script:CanonicalPath -Arguments @('config', 'extensions.worktreeConfig', 'true')
    Assert-GitSuccess -Result $worktreeConfigResult -Operation 'enable worktree-specific configuration'
    $autoCrlfResult = Invoke-Git -Repository $script:ResolvedTargetPath -Arguments @('config', '--worktree', 'core.autocrlf', 'false')
    Assert-GitSuccess -Result $autoCrlfResult -Operation 'set target core.autocrlf'
    $eolResult = Invoke-Git -Repository $script:ResolvedTargetPath -Arguments @('config', '--worktree', 'core.eol', 'lf')
    Assert-GitSuccess -Result $eolResult -Operation 'set target core.eol'

    $targetHeadResult = Invoke-Git -Repository $script:ResolvedTargetPath -Arguments @('rev-parse', 'HEAD')
    Assert-GitSuccess -Result $targetHeadResult -Operation 'verify target HEAD'
    if (($targetHeadResult.Output -join '') -cne $BaseCommit) {
        throw 'Created worktree HEAD does not match BaseCommit.'
    }
    $targetBranchResult = Invoke-Git -Repository $script:ResolvedTargetPath -Arguments @('branch', '--show-current')
    Assert-GitSuccess -Result $targetBranchResult -Operation 'verify target branch'
    if (($targetBranchResult.Output -join '') -cne $Branch) {
        throw 'Created worktree branch does not match Branch.'
    }
    if ((Get-OptionalGitConfig -Repository $script:ResolvedTargetPath -Key 'core.autocrlf') -cne 'false' -or
        (Get-OptionalGitConfig -Repository $script:ResolvedTargetPath -Key 'core.eol') -cne 'lf') {
        throw 'Target LF configuration verification failed.'
    }

    $nodeCommand = Get-Command node -CommandType Application -ErrorAction Stop | Select-Object -First 1
    $identityScript = Join-Path $script:ResolvedTargetPath 'scripts/task-execution-context-v1.mjs'
    if (-not (Test-Path -LiteralPath $identityScript -PathType Leaf)) {
        throw 'Bounded execution identity validator is unavailable.'
    }
    $identityArguments = @(
        $identityScript,
        '--repository', $RepositorySlug,
        '--canonical-task-id', "#$CanonicalTaskId",
        '--objective', $Objective,
        '--branch', $Branch,
        '--worktree', $script:ResolvedTargetPath,
        '--expected-base', $BaseCommit,
        '--remote-main-sha', $remoteMain,
        '--expected-head', $ExpectedHead,
        '--expected-pr', 'null',
        '--execution-instance-id', $ExecutionInstanceId
    )
    foreach ($authorizedPath in $AuthorizedPaths) {
        $identityArguments += @('--authorized-path', $authorizedPath)
    }
    $identityResult = Invoke-NativeCommand -FilePath $nodeCommand.Source -Arguments $identityArguments -WorkingDirectory $script:CanonicalPath
    if ($identityResult.ExitCode -ne 0 -or $identityResult.Output.Count -ne 1) {
        throw 'execution_identity_mismatch'
    }
    try {
        $script:ExecutionIdentityProjection = $identityResult.Output[0] | ConvertFrom-Json
    }
    catch {
        throw 'execution_identity_mismatch'
    }
    if ($script:ExecutionIdentityProjection.admitted -ne $true) {
        throw 'execution_identity_mismatch'
    }

    $targetManifestBefore = Get-ManifestSnapshot -Worktree $script:ResolvedTargetPath
    $targetManifestProof = Get-TrackedManifestProof -Worktree $script:ResolvedTargetPath -Owner 'Target worktree'
    $targetNodeModules = Join-Path $script:ResolvedTargetPath 'node_modules'
    if (Test-Path -LiteralPath $targetNodeModules) {
        throw 'New target worktree unexpectedly contains node_modules before bootstrap.'
    }

    $offlineResult = Invoke-NativeCommand -FilePath $pnpmCommand.Source -Arguments @(
        'install', '--offline', '--frozen-lockfile'
    ) -WorkingDirectory $script:ResolvedTargetPath

    $targetManifestProofAfter = Get-TrackedManifestProof -Worktree $script:ResolvedTargetPath -Owner 'Target worktree'
    $targetManifestAfter = Get-ManifestSnapshot -Worktree $script:ResolvedTargetPath
    if (-not (Test-SnapshotEqual -Before $targetManifestBefore -After $targetManifestAfter)) {
        throw 'Offline install changed a dependency manifest.'
    }
    if (-not (Test-SnapshotEqual -Before $targetManifestProof -After $targetManifestProofAfter)) {
        throw 'Offline install changed the target manifest proof.'
    }

    if ($offlineResult.ExitCode -eq 0) {
        if (Test-Path -LiteralPath $targetNodeModules) {
            $nodeModulesItem = Get-Item -Force -LiteralPath $targetNodeModules
            if (($nodeModulesItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
                throw 'Offline install unexpectedly produced a node_modules reparse point.'
            }
        }
        $script:DependencyRoute = 'offline_frozen'
    }
    else {
        if ([string]::IsNullOrWhiteSpace($DependencyProviderWorktree)) {
            throw "Offline frozen install failed (pnpm exit $($offlineResult.ExitCode)); no explicit provider was supplied."
        }
        if ($env:OS -ne 'Windows_NT') {
            throw 'Explicit provider fallback requires Windows junction support.'
        }

        $providerInputPath = Get-ResolvedInputPath -Path $DependencyProviderWorktree -RelativeTo $script:CanonicalPath
        $providerPath = Get-NormalizedExistingDirectory -Path $providerInputPath -Name 'DependencyProviderWorktree'
        if ($providerPath.Equals($script:ResolvedTargetPath, [StringComparison]::OrdinalIgnoreCase)) {
            throw 'Dependency provider cannot be the target worktree.'
        }

        $providerTopLevelResult = Invoke-Git -Repository $providerPath -Arguments @('rev-parse', '--show-toplevel')
        Assert-GitSuccess -Result $providerTopLevelResult -Operation 'resolve provider worktree root'
        $providerTopLevel = [IO.Path]::GetFullPath($providerTopLevelResult.Output[0]).TrimEnd('\', '/')
        if (-not $providerTopLevel.Equals($providerPath, [StringComparison]::OrdinalIgnoreCase)) {
            throw 'DependencyProviderWorktree must identify a worktree root.'
        }

        $targetCommon = Get-GitCommonDirectory -Worktree $script:ResolvedTargetPath
        $providerCommon = Get-GitCommonDirectory -Worktree $providerPath
        if (-not $targetCommon.Equals($providerCommon, [StringComparison]::OrdinalIgnoreCase)) {
            throw 'Dependency provider belongs to a different Git common directory.'
        }

        $providerSnapshot = Get-ProviderSnapshot -Provider $providerPath
        $providerManifestProof = $providerSnapshot.ManifestProof
        Assert-ManifestProofsCompatible -Target $targetManifestProofAfter -Provider $providerManifestProof

        $providerNodeModules = Join-Path $providerPath 'node_modules'
        if (-not (Test-Path -LiteralPath $providerNodeModules -PathType Container)) {
            throw 'Dependency provider node_modules does not exist.'
        }

        Remove-AttemptNodeModules -TargetWorktree $script:ResolvedTargetPath
        New-Item -ItemType Junction -Path $targetNodeModules -Target $providerNodeModules | Out-Null

        $junction = Get-Item -Force -LiteralPath $targetNodeModules
        if ($junction.LinkType -cne 'Junction') {
            throw 'Target node_modules is not a Windows junction.'
        }
        $junctionTarget = [IO.Path]::GetFullPath([string]($junction.Target -join ''))
        $expectedJunctionTarget = [IO.Path]::GetFullPath($providerNodeModules)
        if (-not $junctionTarget.Equals($expectedJunctionTarget, [StringComparison]::OrdinalIgnoreCase)) {
            throw 'Target node_modules junction does not point to the explicit provider.'
        }

        $providerAfter = Get-ProviderSnapshot -Provider $providerPath
        if (-not (Test-SnapshotEqual -Before $providerSnapshot -After $providerAfter)) {
            throw 'Dependency provider invariant changed during fallback.'
        }

        $script:DependencyRoute = 'explicit_provider_junction'
        $script:ProviderResolvedPath = $providerPath
        $script:ProviderHead = $providerManifestProof.Head
        $script:ManifestBlobBinding = @(
            foreach ($name in $providerManifestProof.Paths) {
                "${name}:$($providerManifestProof.Blobs[$name])"
            }
        ) -join ','
    }
}
catch {
    $script:FailureMessage = $_.Exception.Message
}
finally {
    if ($null -ne $script:CanonicalSnapshot -and $null -ne $script:CanonicalPath) {
        try {
            $canonicalAfter = Get-CanonicalSnapshot -Repository $script:CanonicalPath
            if (-not (Test-SnapshotEqual -Before $script:CanonicalSnapshot -After $canonicalAfter)) {
                $script:FailureMessage = 'Canonical main invariant changed during execution.'
            }
        }
        catch {
            $script:FailureMessage = "Canonical main invariant verification failed: $($_.Exception.Message)"
        }
    }
}

if ($script:FailureMessage) {
    Write-Error "create-task-worktree failed: $($script:FailureMessage)"
    exit 1
}

Write-Output 'create-task-worktree succeeded'
Write-Output "exact_base=$BaseCommit"
Write-Output "branch=$Branch"
Write-Output "worktree=$($script:ResolvedTargetPath)"
Write-Output "dependency_route=$($script:DependencyRoute)"
Write-Output "canonical_task_id=#$CanonicalTaskId"
Write-Output "objective_digest=$($script:ExecutionIdentityProjection.objective_digest)"
Write-Output "authorized_paths_digest=$($script:ExecutionIdentityProjection.authorized_paths_digest)"
Write-Output "execution_instance_id=$($script:ExecutionIdentityProjection.execution_instance_id)"
if ($script:DependencyRoute -ceq 'explicit_provider_junction') {
    Write-Output 'dependency_route: explicit_provider_junction'
    Write-Output 'dependency_storage: shared read-only dependency payload'
    Write-Output "provider_resolved_path: $($script:ProviderResolvedPath)"
    Write-Output "provider_head: $($script:ProviderHead)"
    Write-Output "manifest_blob_binding: $($script:ManifestBlobBinding)"
    Write-Output 'target_pnpm_process_environment: PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false'
    Write-Output 'provider_invariant: Git state, manifest blob binding, installed package content, and resolved dependency graph must remain unchanged; package-manager mutation through the shared junction is prohibited.'
}
exit 0
