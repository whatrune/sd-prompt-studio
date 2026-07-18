# Runner Provisioning Security Model

## Status

- Design version: `0.1.0`
- Status: Security review candidate
- Parent design: [`10-runner-provisioning-design.md`](10-runner-provisioning-design.md)
- Task Assignment: [Issue #100](https://github.com/whatrune/sd-prompt-studio/issues/100)
- Implementation status: not implemented
- Security technology adoption: deferred

本書はRunner Provisioning、Execution Host、Task Workspace、Agent RuntimeのSecurity Boundaryを定義する。既存[`09-runner-security-design.md`](09-runner-security-design.md)を置換または変更せず、PR #99以降のProvisioning層に必要な詳細を追加する。

## Security Goals

1. 未承認TaskからExecution Host、Agent Runtime、Secretを起動しない。
2. 一Taskのcode、process、credential、workspaceを別Taskまたはhostへ漏らさない。
3. Agent RuntimeにGitHub write credentialを渡さない。
4. PublisherにAgent execution credentialを渡さない。
5. filesystem、network、command、process、resource accessをdeny by defaultにする。
6. timeout、cancel、cleanup未確認hostを再利用しない。
7. security failure時に権限拡大、local fallback、証拠破壊を行わない。

## Trust Boundaries

| Boundary | Trust | Allowed input | Forbidden assumption |
| --- | --- | --- | --- |
| GitHub event | untrusted until revalidated | event identity | actor / label / Issue textをそのまま信頼 |
| Canonical Assignment | conditionally trusted | approved structured fields | free textをShell / path / credential instruction化 |
| Provisioning policy | trusted at approved base SHA | runner / sandbox / resource profile | task branch版でcurrent runを上書き |
| Execution Host | isolated but potentially compromised after task | immutable execution plan | previous task cleanlinessを無検証で仮定 |
| Task Workspace | untrusted code zone | exact repository / base / task files | repository外access |
| Agent Runtime | credential-bearing constrained process | Role prompt、ExecutionRequest | GitHub write / admin permission |
| Validation | credential-free untrusted-code execution | diff、approved validation profile | publication permission |
| Publisher | trusted write zone | validated patch、Handoff fields | repository scripts / Agent credential |

## Public Repository Constraint

Repository `whatrune/sd-prompt-studio`は本書作成時点でpublicである。

- forkまたはpull request由来のuntrusted codeをself-hosted runnerへrouteしない。
- Workflow event typeだけで安全性を推測しない。
- same-repository Issue、approved actor、approval revision、exact roleをrevalidateする。
- public repositoryからChatGPT-managed user authenticationをpersistent runnerへseedする構成をMVP候補にしない。
- personal PCまたはpersonal OneDriveをpersistent Execution Hostとして既定採用しない。

## Host Security Profiles

### Profile GH-HOSTED-EPHEMERAL candidate

Host:

- GitHub-hosted Ubuntu VM

Required controls:

- `permissions: contents: read`相当のCodex execution zone
- checkout credential non-persistent
- repository write job separation
- Codex privilege reduction / sandbox
- job-scoped workspace and artifact
- no secret in setup / validation process

Security posture:

- MVP recommendation candidate。
- adoption未決定。

### Profile SELF-HOSTED-EPHEMERAL candidate

Host:

- dedicated VMまたはisolated container host
- one job then de-register and destroy

Required controls:

- dedicated non-interactive identity
- repository-scoped runner group
- ephemeral registration
- external runner log forwarding
- image patch / update ownership
- no personal home / OneDrive mount
- teardown verification and quarantine

Security posture:

- special OS / network requirement時のcandidate。
- adoption未決定。

### Profile PERSISTENT / LOCAL

Security posture:

- MVP defaultから除外。
- dedicated host、filesystem / network sandbox、cross-task cleanup、credential isolation、incident responseを個別に承認するまで利用しない。

## File Access Boundary

### Allowed

- task-owned workspace root
- approved tool/runtime paths read-only
- task-specific temporary directory
- explicitly provided output / artifact directory

### Denied by default

- repository parent directory
- other worktrees
- user home
- OneDrive root
- browser profile、SSH、Git credential、Codex auth store
- system configuration
- Docker socketまたはcontainer runtime control socket
- network share

### Path controls

- canonical / resolved pathでcontainment確認
- Windows junction / reparse point、symlink、mountを検査
- `..`、absolute untrusted path、UNC、drive-relative pathを拒否
- nested git repository、unexpected submodule、alternate object directoryを拒否
- cleanup / delete前にownershipとresolved targetを再検証

## Network Policy

### Default

- Agent command networkはoff。
- phase-specific allowlistだけを開く。

### Candidate allowlist by phase

| Phase | Network candidate | Credential |
| --- | --- | --- |
| checkout | GitHub read endpoints | repository read only |
| setup | approved package registry if required | no Codex / GitHub write |
| Agent execution | OpenAI/Codex endpoint only if required | execution only |
| validation | off by default | none |
| publication | GitHub API / git remote | GitHub write only |

### Denied targets

- cloud metadata service
- localhost services not explicitly provisioned
- private subnet / personal LAN
- arbitrary URL from Issue / repository content
- credential exfiltration endpoint

Allowlistの具体domainとproxyはPR103またはProvisioning Operations Reviewで決定する。

## Command Policy

- Issue / comment / commit messageをcommand stringへ連結しない。
- validationはversion-managed profile IDから固定command / argument arrayへ解決する。
- `shell: true`相当をdefault禁止候補とする。
- command substitution、redirection、profile loading、arbitrary interpreter flagをuntrusted fieldから受けない。
- `sudo`、administrator elevation、privileged container、host mount、Docker socket accessをdefault禁止候補とする。
- Agentが要求したpermission escalationを自動承認しない。

## Process Isolation

- task identityごとにone process tree。
- Agent Runtime process group / job object / container identityを保持する。
- AbortSignalはgraceful stopを開始する。
- `cancel(request)`はexact active handleだけを対象にする。
- grace終了後のforced termination policyはhost technology決定時に定義する。
- child / grandchild / detached process残留を検査する。
- termination未確認はrunner quarantine。

PR #99 interfaceにexecution IDがないため、same task identityのparallel executionは禁止する。remote recoveryにexecution IDが必要ならArchitect Teamへ返却する。

## Resource Limits

後続implementationは少なくとも次を個別制御可能にする。

- wall-clock execution timeout
- provisioning timeout
- cancellation grace period
- validation timeout
- CPU quota
- memory limit
- disk quota
- process count
- output / log size
- artifact size
- network transfer budget

具体値は本PRでFreezeしない。limit超過はsilent truncationせず、`failed`とsanitized reasonを返す。truncated structured resultをsuccess扱いしない。

## Credential Threat Model

### Execution credential

Threat:

- repository script、dependency hook、Agent commandがcredentialを読む。

Controls:

- shortest possible lifetime
- Agent invocationだけへ限定
- job-wide environmentを避ける
- command line、Prompt、logへ出さない
- GitHub write permissionと分離
- setup / validationをcredential注入前または別zoneで実行

### GitHub write credential

Threat:

- Agentまたはmalicious patchがbranch、Workflow、Issueを変更する。

Controls:

- Publisher専用zone
- no repository scripts
- task branch / Draft PR / Handoffに必要なminimum permission
- no merge / admin / secret / environment permission
- branch / commit / task binding read-after-write

### Runner registration credential

Threat:

- attackerがunauthorized runnerを登録または他repositoryへrouteする。

Controls:

- Provisioning planeのみ保持
- Task workspaceへ渡さない
- short-lived registration
- repository / group scope exact match
- registration and de-registration audit

### Auth files

- `auth.json`やCLI credential cacheをrepository、artifact、Issue、PRへ保存しない。
- public repository automationではpersistent user-account authをMVP候補にしない。
- credential refreshが必要なpersistent designは別Security Review対象。

## Supply-chain Boundary

Threats:

- checkout action、third-party action、package manager、postinstall、native binary、container image、runner image。

Controls:

- Action / image / runtime version pin policy
- lockfile enforcement
- dependency installとcredential-bearing processの分離
- third-party Action permission review
- container image provenance / scan候補
- generated artifactをPublisher前にvalidate
- task branchのWorkflow変更をcurrent executionへ適用しない

## Container Security

Containerを使う場合:

- privileged mode禁止候補
- host PID / network namespace禁止候補
- Docker socket mount禁止
- host home / repository parent mount禁止
- workspaceだけを明示mount
- rootlessまたはunprivileged user候補
- CPU / memory / process / disk limit
- read-only root filesystem候補
- network allowlist
- image digest pin候補

GitHub Actions job containerではstepsがworkspaceを共有し、container actionがsibling network / volumeを使う可能性がある。job containerだけでcredential separationが完了したと判断しない。

## Secret and Log Handling

### Never log

- token / key value
- authorization header
- complete environment
- command line containing credential
- auth file contents
- personal absolute path
- raw untrusted output when it may contain Secret

### Public Handoff fields

Allowed:

- task ID
- sanitized runner profile / logical runner ID
- workflow / execution reference
- start / end time
- result and validation references
- failure category
- timeout / cancel / cleanup outcome

Forbidden:

- host name、username、local path
- credential ID / secret store path
- raw stderr / environment
- unrelated repository or personal file data

### Redaction

- known Secret maskingだけに依存しない。
- output allowlist、length limit、pattern scan、structured serializationを組み合わせる。
- leakage suspicion時はpublicationを停止し、credential revocation / host quarantineへ進む。

## Cleanup and Quarantine

### Reusable state requirements

- all process trees terminated
- execution credential expired / removed
- Git credential removed
- task temp / workspace policy completed
- no unexpected network listener
- no modified global config
- no residue outside task root
- cleanup evidence recorded

### Quarantine conditions

- cancel / termination unconfirmed
- cleanup command failure
- unexpected process / file / mount
- secret leakage suspicion
- filesystem containment violation
- runner image / version out of policy
- security test failure

Quarantined hostを自動でreadyへ戻さない。Operations ownerの確認を必要とする。

## Failure Matrix

| Threat / failure | Prevent execution | Credential response | Host response | Canonical result |
| --- | --- | --- | --- | --- |
| unauthorized actor / fork | yes | do not issue | none | blocked evidence if safe |
| policy revision mismatch | yes | do not issue | none | blocked |
| runner profile mismatch | yes | do not issue | release | blocked |
| filesystem escape | stop | revoke if issued | quarantine | blocked |
| network violation | stop | revoke | quarantine | blocked |
| command injection attempt | stop | do not issue / revoke | inspect | blocked |
| credential exposure suspicion | stop | revoke immediately | quarantine | failed / security escalation |
| timeout | stop | expire | terminate or quarantine | failed |
| cancel target ambiguous | stop | expire | quarantine | failed |
| malformed / truncated result | stop publication | expire | cleanup | failed |
| cleanup failure | no next task | none | quarantine | needs followup / failed |

Result mappingは既存Contract vocabularyを使い、新しいStatusを追加しない。

## Security Test Matrix

### Admission and provisioning

| ID | Case | Expected |
| --- | --- | --- |
| RSEC-001 | approved same-repository Worker Task | approved profile resolution may proceed |
| RSEC-002 | unauthorized actor | provision count zero、Secret access zero |
| RSEC-003 | fork / PR event | no host allocation |
| RSEC-004 | stale Assignment revision | blocked、no fallback |
| RSEC-005 | unsupported runner profile | blocked / contract_required |

### Filesystem

| ID | Case | Expected |
| --- | --- | --- |
| RSEC-010 | traversal path | blocked |
| RSEC-011 | symlink / junction escape | blocked |
| RSEC-012 | other Task worktree | access denied |
| RSEC-013 | personal home / OneDrive path | access denied |
| RSEC-014 | cleanup ownership mismatch | no delete、quarantine |

### Network and command

| ID | Case | Expected |
| --- | --- | --- |
| RSEC-020 | arbitrary Issue URL | no egress |
| RSEC-021 | cloud metadata address | denied |
| RSEC-022 | Shell metacharacter in task field | parser rejection / literal argument |
| RSEC-023 | request for elevation | no automatic approval |
| RSEC-024 | dependency script reads credential | credential unavailable |

### Credential

| ID | Case | Expected |
| --- | --- | --- |
| RSEC-030 | Agent environment | no GitHub write token |
| RSEC-031 | Publisher environment | no execution credential |
| RSEC-032 | Validation environment | neither credential |
| RSEC-033 | fixture Secret in output | no public log / Handoff occurrence |
| RSEC-034 | registration token check | unavailable to Task workspace |

### Process and resource

| ID | Case | Expected |
| --- | --- | --- |
| RSEC-040 | timeout | AbortSignal、one cancel、termination evidence |
| RSEC-041 | detached child remains | runner quarantine |
| RSEC-042 | cancel target ambiguous | no unrelated process kill、failed |
| RSEC-043 | output limit exceeded | failed、not silent success |
| RSEC-044 | disk / memory limit exceeded | failed and cleanup |

### Cleanup and reuse

| ID | Case | Expected |
| --- | --- | --- |
| RSEC-050 | normal ephemeral run | host destroyed / released |
| RSEC-051 | failed execution | evidence preserved then cleanup |
| RSEC-052 | secret leakage suspicion | revoke and quarantine |
| RSEC-053 | cleanup failure | next Task not scheduled |
| RSEC-054 | duplicate Task | one active host / process only |

本PRではtestを実装しない。

## Security Review Gates

PR101開始前:

- Runner profile recommendationのProduct Owner承認
- PR #99 interface再確認
- execution identity limitationの受容または別Contract判断
- exact workspace ownership model

PR102開始前:

- Host type、OS、image、runner group / labels決定
- network / filesystem / resource baseline
- quarantine owner

PR103開始前:

- execution / GitHub write / registration credential owner
- storage、rotation、revoke、audit方針
- zero-secret negative tests

Pilot開始前:

- unauthorized / fork tests
- filesystem and network isolation tests
- process termination and quarantine tests
- credential separation evidence
- cleanup / no-cross-task residue evidence
- Product Ownerによるpilot Task明示承認

## Deferred Security Decisions

- exact Runner technology and host
- dedicated User / VM / container runtime
- credential provider、token type、Secret store
- network egress domains / proxy
- filesystem sandbox implementation
- resource limit values
- log and artifact retention
- runner image update / provenance
- quarantine and incident response runbook
- remote execution identity / recovery Contract

## Explicit Non-implementation Confirmation

本設計では次を実施していない。

- Runner、VM、Container、Service作成
- WorkflowまたはGitHub Actions変更
- Secret、Token、Credential設定
- Codex CLI / SDK / Action実装
- CodeまたはSchema変更
- Existing Contract変更
- Research Data、Existing Run、Research Artifact変更
- Merge
