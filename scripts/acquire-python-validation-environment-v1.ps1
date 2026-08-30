[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$RepositoryPath,

    [Parameter(Mandatory = $true)]
    [string]$PythonExecutable,

    [Parameter(Mandatory = $false)]
    [switch]$IdentityOnly,

    [Parameter(Mandatory = $false)]
    [ValidateRange(5, 1800)]
    [int]$LockTimeoutSeconds = 300
)

$ErrorActionPreference = 'Stop'
$script:CacheContractVersion = 1
$script:RequiredImports = @('yaml', 'jsonschema', 'rfc8785', 'PIL', 'reportlab', 'pypdf')
$script:EnvironmentNames = @('PYTHONHOME', 'PYTHONPATH', 'PYTHONUSERBASE')

function Get-Sha256Text {
    param([Parameter(Mandatory = $true)][AllowEmptyString()][string]$Text)
    $sha = [Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [Text.UTF8Encoding]::new($false).GetBytes($Text)
        return ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-', '').ToLowerInvariant()
    }
    finally {
        $sha.Dispose()
    }
}

function Get-Sha256File {
    param([Parameter(Mandatory = $true)][string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "python_validation_dependency_input_missing:$Path"
    }
    return (Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash.ToLowerInvariant()
}

function Get-FileSystemPath {
    param([Parameter(Mandatory = $true)][string]$Path)
    $full = [IO.Path]::GetFullPath($Path)
    if ($IsWindows -and -not $full.StartsWith('\\?\')) { return '\\?\' + $full }
    return $full
}

function Invoke-IsolatedPython {
    param(
        [Parameter(Mandatory = $true)][string]$Executable,
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [Parameter(Mandatory = $false)][string]$WorkingDirectory
    )
    $saved = @{}
    foreach ($name in $script:EnvironmentNames) {
        $saved[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
        [Environment]::SetEnvironmentVariable($name, $null, 'Process')
    }
    $prior = $null
    try {
        if ($WorkingDirectory) {
            $prior = Get-Location
            Set-Location -LiteralPath $WorkingDirectory
        }
        $output = @(& $Executable @Arguments 2>&1 | ForEach-Object { "$_" })
        return [pscustomobject]@{ ExitCode = $LASTEXITCODE; Output = $output }
    }
    finally {
        if ($null -ne $prior) { Set-Location -LiteralPath $prior }
        foreach ($name in $script:EnvironmentNames) {
            [Environment]::SetEnvironmentVariable($name, $saved[$name], 'Process')
        }
    }
}

function Assert-PythonSuccess {
    param(
        [Parameter(Mandatory = $true)][psobject]$Result,
        [Parameter(Mandatory = $true)][string]$Reason
    )
    if ($Result.ExitCode -ne 0) {
        $diagnostic = (($Result.Output | Select-Object -Last 8) -join ' ').Trim()
        if ($diagnostic.Length -gt 512) { $diagnostic = $diagnostic.Substring(0, 512) }
        throw "$Reason (exit=$($Result.ExitCode), diagnostic=$diagnostic)"
    }
}

function Get-RuntimeIdentity {
    param([Parameter(Mandatory = $true)][string]$Executable)
    $code = @'
import json, platform, sys, sysconfig
print(json.dumps({
    "python_implementation": sys.implementation.name,
    "exact_python_version": platform.python_version(),
    "python_cache_tag": sys.implementation.cache_tag,
    "python_platform_tag": sysconfig.get_platform(),
    "machine_architecture": platform.machine(),
}, sort_keys=True, separators=(",", ":")))
'@
    $result = Invoke-IsolatedPython -Executable $Executable -Arguments @('-B', '-E', '-s', '-c', $code)
    Assert-PythonSuccess -Result $result -Reason 'python_validation_runtime_probe_failed'
    try { return (($result.Output -join "`n") | ConvertFrom-Json) }
    catch { throw 'python_validation_runtime_probe_malformed' }
}

function Get-GitCommonDirectory {
    param([Parameter(Mandatory = $true)][string]$Repository)
    $value = @(& git -C $Repository rev-parse --path-format=absolute --git-common-dir 2>&1)
    if ($LASTEXITCODE -ne 0 -or $value.Count -ne 1) { throw 'python_validation_git_common_dir_invalid' }
    return [IO.Path]::GetFullPath("$($value[0])").TrimEnd('\', '/')
}

function Get-CanonicalPackageName {
    param([Parameter(Mandatory = $true)][string]$Name)
    return ([regex]::Replace($Name.ToLowerInvariant(), '[-_.]+', '-'))
}

function Get-LockedDistributions {
    param([Parameter(Mandatory = $true)][string]$LockPath)
    $logical = @()
    $buffer = ''
    foreach ($raw in Get-Content -LiteralPath $LockPath) {
        $line = $raw.Trim()
        if (-not $line -or $line.StartsWith('#')) { continue }
        $continues = $line.EndsWith('\')
        if ($continues) { $line = $line.Substring(0, $line.Length - 1).TrimEnd() }
        $buffer = if ($buffer) { "$buffer $line" } else { $line }
        if (-not $continues) { $logical += $buffer; $buffer = '' }
    }
    if ($buffer) { throw 'python_validation_lock_malformed' }
    $rows = foreach ($line in $logical) {
        if ($line -notmatch '^([A-Za-z0-9_.-]+)==([^ ]+)( .+)?$') {
            throw 'python_validation_lock_malformed'
        }
        $packageName = $Matches[1]
        $packageVersion = $Matches[2]
        if ($line -notmatch '--hash=sha256:[0-9a-f]{64}') {
            throw 'python_validation_lock_malformed'
        }
        [pscustomobject]@{ name = Get-CanonicalPackageName $packageName; version = $packageVersion }
    }
    if ($rows.Count -eq 0) { throw 'python_validation_lock_empty' }
    $duplicates = @($rows | Group-Object name | Where-Object Count -ne 1)
    if ($duplicates.Count -gt 0) { throw 'python_validation_lock_duplicate_distribution' }
    return @($rows | Sort-Object name)
}

function Get-IdentityProjection {
    param(
        [Parameter(Mandatory = $true)][psobject]$Runtime,
        [Parameter(Mandatory = $true)][string]$RequirementsDigest,
        [Parameter(Mandatory = $true)][string]$LockDigest
    )
    $document = [ordered]@{
        cache_contract_version = $script:CacheContractVersion
        python_implementation = [string]$Runtime.python_implementation
        exact_python_version = [string]$Runtime.exact_python_version
        python_cache_tag = [string]$Runtime.python_cache_tag
        python_platform_tag = [string]$Runtime.python_platform_tag
        machine_architecture = [string]$Runtime.machine_architecture
        requirements_txt_sha256 = $RequirementsDigest
        requirements_lock_sha256 = $LockDigest
    }
    $json = $document | ConvertTo-Json -Compress
    return [pscustomobject]@{ Document = $document; Json = $json; Identity = Get-Sha256Text $json }
}

function Get-VenvPythonPath {
    param([Parameter(Mandatory = $true)][string]$EnvironmentPath)
    $windows = Join-Path $EnvironmentPath 'Scripts\python.exe'
    if (Test-Path -LiteralPath $windows -PathType Leaf) { return Get-FileSystemPath $windows }
    $posix = Join-Path $EnvironmentPath 'bin/python'
    if (Test-Path -LiteralPath $posix -PathType Leaf) { return Get-FileSystemPath $posix }
    throw 'python_validation_cached_interpreter_missing'
}

function Get-SitePackagesPath {
    param([Parameter(Mandatory = $true)][string]$Executable)
    $code = 'import sysconfig; print(sysconfig.get_paths()["purelib"])'
    $result = Invoke-IsolatedPython -Executable $Executable -Arguments @('-B', '-E', '-s', '-c', $code)
    Assert-PythonSuccess -Result $result -Reason 'python_validation_site_packages_probe_failed'
    if ($result.Output.Count -ne 1) { throw 'python_validation_site_packages_probe_malformed' }
    return Get-FileSystemPath $result.Output[0]
}

function Get-InstalledDistributions {
    param([Parameter(Mandatory = $true)][string]$Executable)
    $code = @'
import importlib.metadata, json, re
canon = lambda value: re.sub(r"[-_.]+", "-", value).lower()
rows = sorted((canon(d.metadata["Name"]), d.version) for d in importlib.metadata.distributions())
print(json.dumps([{"name": name, "version": version} for name, version in rows], separators=(",", ":")))
'@
    $result = Invoke-IsolatedPython -Executable $Executable -Arguments @('-B', '-E', '-s', '-c', $code)
    Assert-PythonSuccess -Result $result -Reason 'python_validation_distribution_probe_failed'
    try { return @(($result.Output -join "`n") | ConvertFrom-Json) }
    catch { throw 'python_validation_distribution_probe_malformed' }
}

function Get-EnvironmentMetadataDigest {
    param(
        [Parameter(Mandatory = $true)][string]$EnvironmentPath,
        [Parameter(Mandatory = $true)][string]$Executable
    )
    $environmentRoot = Get-FileSystemPath $EnvironmentPath
    $files = @((Join-Path $environmentRoot 'pyvenv.cfg'))
    $sitePackages = Get-SitePackagesPath -Executable $Executable
    foreach ($directory in @(Get-ChildItem -LiteralPath $sitePackages -Directory -Filter '*.dist-info' | Sort-Object Name)) {
        foreach ($name in @('METADATA', 'RECORD', 'WHEEL', 'direct_url.json')) {
            $candidate = Join-Path $directory.FullName $name
            if (Test-Path -LiteralPath $candidate -PathType Leaf) { $files += $candidate }
        }
    }
    $rows = foreach ($file in ($files | Sort-Object)) {
        $relative = [IO.Path]::GetRelativePath($environmentRoot, (Get-FileSystemPath $file)).Replace('\', '/')
        "$relative=$(Get-Sha256File $file)"
    }
    return Get-Sha256Text ($rows -join "`n")
}

function Assert-NoRepositoryInjection {
    param(
        [Parameter(Mandatory = $true)][string]$Repository,
        [Parameter(Mandatory = $true)][string]$EnvironmentPath,
        [Parameter(Mandatory = $true)][psobject]$IdentityProjection
    )
    $null = $Repository
    $sitePackages = if ($IsWindows) {
        Join-Path (Get-FileSystemPath $EnvironmentPath) 'Lib/site-packages'
    }
    else {
        $parts = ([string]$IdentityProjection.Document.exact_python_version).Split('.')
        Join-Path (Get-FileSystemPath $EnvironmentPath) "lib/python$($parts[0]).$($parts[1])/site-packages"
    }
    if (-not (Test-Path -LiteralPath $sitePackages -PathType Container)) {
        throw 'python_validation_site_packages_missing'
    }
    foreach ($path in @(Get-ChildItem -LiteralPath $sitePackages -File -Filter '*.pth')) {
        foreach ($raw in Get-Content -LiteralPath $path.FullName) {
            $line = $raw.Trim()
            if (-not $line -or $line.StartsWith('#')) { continue }
            throw 'python_validation_pth_entry_rejected'
        }
    }
    foreach ($path in @(Get-ChildItem -LiteralPath $sitePackages -File -Recurse -Filter 'direct_url.json')) {
        try { $value = Get-Content -Raw -LiteralPath $path.FullName | ConvertFrom-Json }
        catch { throw 'python_validation_direct_url_malformed' }
        if ($value.dir_info.editable -eq $true) { throw 'python_validation_editable_install_rejected' }
        if ([string]$value.url -match '^file:') { throw 'python_validation_local_install_rejected' }
    }
}

function Assert-EnvironmentPayload {
    param(
        [Parameter(Mandatory = $true)][string]$Repository,
        [Parameter(Mandatory = $true)][string]$EnvironmentPath,
        [Parameter(Mandatory = $true)][psobject]$IdentityProjection,
        [Parameter(Mandatory = $true)][object[]]$LockedDistributions
    )
    Assert-NoRepositoryInjection -Repository $Repository -EnvironmentPath $EnvironmentPath -IdentityProjection $IdentityProjection
    $python = Get-VenvPythonPath -EnvironmentPath $EnvironmentPath
    $runtime = Get-RuntimeIdentity -Executable $python
    foreach ($key in @('python_implementation', 'exact_python_version', 'python_cache_tag', 'python_platform_tag', 'machine_architecture')) {
        if ([string]$runtime.$key -cne [string]$IdentityProjection.Document[$key]) {
            throw "python_validation_cached_runtime_mismatch:$key"
        }
    }
    $installed = @(Get-InstalledDistributions -Executable $python | Where-Object name -ne 'pip' | Sort-Object name)
    if (($installed | ConvertTo-Json -Compress) -cne ($LockedDistributions | ConvertTo-Json -Compress)) {
        throw 'python_validation_locked_distribution_set_mismatch'
    }
    $check = Invoke-IsolatedPython -Executable $python -Arguments @('-B', '-E', '-s', '-m', 'pip', 'check')
    Assert-PythonSuccess -Result $check -Reason 'python_validation_pip_consistency_failed'
    $imports = ($script:RequiredImports | ForEach-Object { "import $_" }) -join '; '
    $smoke = Invoke-IsolatedPython -Executable $python -Arguments @('-B', '-E', '-s', '-c', $imports)
    Assert-PythonSuccess -Result $smoke -Reason 'python_validation_import_smoke_failed'
    return [pscustomobject]@{
        Python = $python
        MetadataDigest = Get-EnvironmentMetadataDigest -EnvironmentPath $EnvironmentPath -Executable $python
    }
}

function Test-FinalEnvironment {
    param(
        [Parameter(Mandatory = $true)][string]$Repository,
        [Parameter(Mandatory = $true)][string]$FinalPath,
        [Parameter(Mandatory = $true)][psobject]$IdentityProjection,
        [Parameter(Mandatory = $true)][object[]]$LockedDistributions
    )
    try {
        $manifestPath = Join-Path $FinalPath 'completion-manifest.json'
        if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) { throw 'completion_manifest_missing' }
        $manifest = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json
        $expectedKeys = @('cache_contract_version', 'identity', 'identity_document', 'interpreter_relative_path', 'locked_distributions', 'metadata_digest') | Sort-Object
        $actualKeys = @($manifest.psobject.Properties.Name | Sort-Object)
        if (($expectedKeys -join "`n") -cne ($actualKeys -join "`n")) { throw 'completion_manifest_schema_invalid' }
        if ([int]$manifest.cache_contract_version -ne $script:CacheContractVersion -or [string]$manifest.identity -cne $IdentityProjection.Identity) {
            throw 'completion_manifest_identity_invalid'
        }
        if (($manifest.identity_document | ConvertTo-Json -Compress) -cne ($IdentityProjection.Document | ConvertTo-Json -Compress)) {
            throw 'completion_manifest_runtime_identity_invalid'
        }
        if (($manifest.locked_distributions | ConvertTo-Json -Compress) -cne ($LockedDistributions | ConvertTo-Json -Compress)) {
            throw 'completion_manifest_distribution_identity_invalid'
        }
        $environmentPath = Join-Path $FinalPath 'environment'
        $payload = Assert-EnvironmentPayload -Repository $Repository -EnvironmentPath $environmentPath -IdentityProjection $IdentityProjection -LockedDistributions $LockedDistributions
        if ([string]$manifest.metadata_digest -cne $payload.MetadataDigest) { throw 'completion_manifest_metadata_digest_invalid' }
        $relative = [IO.Path]::GetRelativePath((Get-FileSystemPath $FinalPath), (Get-FileSystemPath $payload.Python)).Replace('\', '/')
        if ([string]$manifest.interpreter_relative_path -cne $relative) { throw 'completion_manifest_interpreter_invalid' }
        return [pscustomobject]@{ Valid = $true; Python = $payload.Python; Reason = '' }
    }
    catch {
        return [pscustomobject]@{ Valid = $false; Python = ''; Reason = $_.Exception.Message }
    }
}

function New-CompletionManifest {
    param(
        [Parameter(Mandatory = $true)][string]$BuildPath,
        [Parameter(Mandatory = $true)][psobject]$IdentityProjection,
        [Parameter(Mandatory = $true)][object[]]$LockedDistributions,
        [Parameter(Mandatory = $true)][psobject]$Payload
    )
    $relative = [IO.Path]::GetRelativePath((Get-FileSystemPath $BuildPath), (Get-FileSystemPath $Payload.Python)).Replace('\', '/')
    $manifest = [ordered]@{
        cache_contract_version = $script:CacheContractVersion
        identity = $IdentityProjection.Identity
        identity_document = $IdentityProjection.Document
        interpreter_relative_path = $relative
        locked_distributions = $LockedDistributions
        metadata_digest = $Payload.MetadataDigest
    }
    $path = Join-Path $BuildPath 'completion-manifest.json'
    [IO.File]::WriteAllText($path, (($manifest | ConvertTo-Json -Depth 8) + "`n"), [Text.UTF8Encoding]::new($false))
}

function New-CachedEnvironment {
    param(
        [Parameter(Mandatory = $true)][string]$Repository,
        [Parameter(Mandatory = $true)][string]$BasePython,
        [Parameter(Mandatory = $true)][string]$LockPath,
        [Parameter(Mandatory = $true)][string]$BuildPath,
        [Parameter(Mandatory = $true)][psobject]$IdentityProjection,
        [Parameter(Mandatory = $true)][object[]]$LockedDistributions
    )
    New-Item -ItemType Directory -Path $BuildPath | Out-Null
    $environmentPath = Join-Path $BuildPath 'environment'
    $venv = Invoke-IsolatedPython -Executable $BasePython -Arguments @('-B', '-E', '-s', '-m', 'venv', $environmentPath)
    Assert-PythonSuccess -Result $venv -Reason 'python_validation_venv_creation_failed'
    $python = Get-VenvPythonPath -EnvironmentPath $environmentPath
    $install = Invoke-IsolatedPython -Executable $python -Arguments @(
        '-B', '-E', '-s', '-m', 'pip', 'install', '--disable-pip-version-check', '--no-input', '--require-hashes', '-r', $LockPath
    )
    Assert-PythonSuccess -Result $install -Reason 'python_validation_locked_install_failed'
    $payload = Assert-EnvironmentPayload -Repository $Repository -EnvironmentPath $environmentPath -IdentityProjection $IdentityProjection -LockedDistributions $LockedDistributions
    New-CompletionManifest -BuildPath $BuildPath -IdentityProjection $IdentityProjection -LockedDistributions $LockedDistributions -Payload $payload
}

function Get-AcquisitionResult {
    param(
        [Parameter(Mandatory = $true)][string]$CacheState,
        [Parameter(Mandatory = $true)][string]$CacheRoot,
        [Parameter(Mandatory = $true)][psobject]$IdentityProjection,
        [Parameter(Mandatory = $false)][string]$Python
    )
    return [ordered]@{
        cache_contract_version = $script:CacheContractVersion
        cache_state = $CacheState
        identity = $IdentityProjection.Identity
        identity_document = $IdentityProjection.Document
        cache_root = $CacheRoot
        python_executable = $Python
    }
}

$repository = [IO.Path]::GetFullPath((Resolve-Path -LiteralPath $RepositoryPath).Path).TrimEnd('\', '/')
$basePython = [IO.Path]::GetFullPath((Resolve-Path -LiteralPath $PythonExecutable).Path)
$requirementsPath = Join-Path $repository 'research/sd-prompt-research/requirements.txt'
$lockPath = Join-Path $repository 'research/sd-prompt-research/requirements.lock.txt'
$lockedDistributions = @(Get-LockedDistributions -LockPath $lockPath)
$runtime = Get-RuntimeIdentity -Executable $basePython
$identityProjection = Get-IdentityProjection -Runtime $runtime -RequirementsDigest (Get-Sha256File $requirementsPath) -LockDigest (Get-Sha256File $lockPath)
$gitCommonDirectory = Get-GitCommonDirectory -Repository $repository
$cacheRoot = Join-Path $gitCommonDirectory 'codex-cache/python-validation-v1'

if ($IdentityOnly) {
    Get-AcquisitionResult -CacheState 'identity_only' -CacheRoot $cacheRoot -IdentityProjection $identityProjection | ConvertTo-Json -Depth 8 -Compress
    exit 0
}

$locksRoot = Join-Path $cacheRoot 'locks'
$buildsRoot = Join-Path $cacheRoot 'builds'
$environmentsRoot = Join-Path $cacheRoot 'environments'
New-Item -ItemType Directory -Force -Path $locksRoot, $buildsRoot, $environmentsRoot | Out-Null
$finalPath = Join-Path $environmentsRoot $identityProjection.Identity
$existing = Test-FinalEnvironment -Repository $repository -FinalPath $finalPath -IdentityProjection $identityProjection -LockedDistributions $lockedDistributions
if ($existing.Valid) {
    Get-AcquisitionResult -CacheState 'warm' -CacheRoot $cacheRoot -IdentityProjection $identityProjection -Python $existing.Python | ConvertTo-Json -Depth 8 -Compress
    exit 0
}

$lockDirectory = Join-Path $locksRoot ($identityProjection.Identity + '.lock')
$deadline = [DateTime]::UtcNow.AddSeconds($LockTimeoutSeconds)
$ownsLock = $false
while (-not $ownsLock) {
    try {
        New-Item -ItemType Directory -Path $lockDirectory -ErrorAction Stop | Out-Null
        $ownsLock = $true
    }
    catch {
        $winner = Test-FinalEnvironment -Repository $repository -FinalPath $finalPath -IdentityProjection $identityProjection -LockedDistributions $lockedDistributions
        if ($winner.Valid) {
            Get-AcquisitionResult -CacheState 'warm_after_wait' -CacheRoot $cacheRoot -IdentityProjection $identityProjection -Python $winner.Python | ConvertTo-Json -Depth 8 -Compress
            exit 0
        }
        if ([DateTime]::UtcNow -ge $deadline) { throw 'python_validation_environment_lock_timeout' }
        Start-Sleep -Milliseconds 200
    }
}

$buildPath = Join-Path $buildsRoot ($identityProjection.Identity.Substring(0, 12) + '.' + [guid]::NewGuid().ToString('N').Substring(0, 8))
try {
    $winner = Test-FinalEnvironment -Repository $repository -FinalPath $finalPath -IdentityProjection $identityProjection -LockedDistributions $lockedDistributions
    if ($winner.Valid) {
        Get-AcquisitionResult -CacheState 'warm_after_lock' -CacheRoot $cacheRoot -IdentityProjection $identityProjection -Python $winner.Python | ConvertTo-Json -Depth 8 -Compress
        exit 0
    }
    if (Test-Path -LiteralPath $finalPath) { Remove-Item -LiteralPath $finalPath -Recurse -Force }
    New-CachedEnvironment -Repository $repository -BasePython $basePython -LockPath $lockPath -BuildPath $buildPath -IdentityProjection $identityProjection -LockedDistributions $lockedDistributions
    Move-Item -LiteralPath $buildPath -Destination $finalPath
    $final = Test-FinalEnvironment -Repository $repository -FinalPath $finalPath -IdentityProjection $identityProjection -LockedDistributions $lockedDistributions
    if (-not $final.Valid) { throw "python_validation_environment_finalization_failed:$($final.Reason)" }
    Get-AcquisitionResult -CacheState 'cold' -CacheRoot $cacheRoot -IdentityProjection $identityProjection -Python $final.Python | ConvertTo-Json -Depth 8 -Compress
}
finally {
    if (Test-Path -LiteralPath $buildPath) { Remove-Item -LiteralPath $buildPath -Recurse -Force }
    if (Test-Path -LiteralPath $lockDirectory) { Remove-Item -LiteralPath $lockDirectory -Recurse -Force }
}
