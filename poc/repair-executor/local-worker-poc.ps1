param(
  [string]$Repository = 'https://github.com/whatrune/sd-prompt-studio.git',
  [string]$Ref = 'main'
)

$ErrorActionPreference = 'Stop'
if ($PSVersionTable.PSVersion.Major -ne 7) { throw 'POC_PWSH_MAJOR_INVALID' }

function Invoke-Native {
  param([string]$Command,[string[]]$Arguments)
  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) { throw "POC_NATIVE_FAILED:$Command:$LASTEXITCODE" }
}

$git = (Get-Command git.exe -ErrorAction Stop).Source
$codex = (Get-Command codex.cmd -ErrorAction Stop).Source
Write-Host "POC user: $([Environment]::UserDomainName)\$([Environment]::UserName)"
Write-Host "POC pwsh: $($PSVersionTable.PSVersion)"
Invoke-Native $codex @('--version')
Invoke-Native $codex @('login','status')

$root = Join-Path ([IO.Path]::GetTempPath()) ("sdps-local-worker-poc-" + [Guid]::NewGuid().ToString('N'))
$remoteBranch = "poc/local-worker-roundtrip-" + [Guid]::NewGuid().ToString('N')
$remoteCreated = $false
try {
  Invoke-Native $git @('clone','--quiet','--depth=1','--branch',$Ref,$Repository,$root)
  Push-Location $root
  try {
    $head = (& $git rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0 -or $head -notmatch '^[0-9a-f]{40}$') { throw 'POC_HEAD_INVALID' }
    Write-Host "POC checkout: $head"

    $prompt = 'Do not modify files. Inspect the repository and respond with exactly LOCAL_WORKER_POC_OK.'
    $output = & $codex exec $prompt 2>&1
    $exit = $LASTEXITCODE
    $output | ForEach-Object { Write-Host $_ }
    if ($exit -ne 0) { throw "POC_CODEX_EXEC_FAILED:$exit" }

    $status = (& $git status --porcelain=v1 --untracked-files=all) -join "`n"
    if ($LASTEXITCODE -ne 0) { throw 'POC_STATUS_FAILED' }
    if (-not [string]::IsNullOrWhiteSpace($status)) { throw 'POC_CODEX_MODIFIED_WORKTREE' }

    Invoke-Native $git @('checkout','-b',$remoteBranch)
    [IO.File]::WriteAllText((Join-Path $root '.local-worker-poc'), "temporary proof`n", [Text.UTF8Encoding]::new($false))
    Invoke-Native $git @('add','--','.local-worker-poc')
    Invoke-Native $git @('-c','user.name=sd-prompt-studio-poc','-c','user.email=poc@local.invalid','commit','-m','poc: local worker push roundtrip')
    Invoke-Native $git @('push','origin',"HEAD:refs/heads/$remoteBranch")
    $remoteCreated = $true
    Invoke-Native $git @('ls-remote','--exit-code','--heads','origin',"refs/heads/$remoteBranch")
    Invoke-Native $git @('push','origin','--delete',$remoteBranch)
    $remoteCreated = $false

    Write-Host 'LOCAL_WORKER_POC_PASS'
  } finally {
    if ($remoteCreated) {
      & $git push origin --delete $remoteBranch 2>$null | Out-Null
    }
    Pop-Location
  }
} finally {
  Remove-Item -LiteralPath $root -Recurse -Force -ErrorAction SilentlyContinue
}
