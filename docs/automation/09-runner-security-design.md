# Dispatch Runner Security Design

## Status

- Design version: `0.1.0`
- Status: Security review candidate
- Parent design: [`08-dispatch-execution-integration-design.md`](08-dispatch-execution-integration-design.md)
- Task Assignment: [Issue #96](https://github.com/whatrune/sd-prompt-studio/issues/96)
- Implementation status: not implemented
- Security technology selection: deferred

本書はDispatch Execution IntegrationのThreat Model、trust boundary、credential separation、negative testを定義する。Runner、Workflow、Secret、Service、security productを実装または採用決定しない。

本書内の`stale`、`rejected`、`queued`、`timed_out`、`cancelled`はoperational diagnosticであり、PR #95のCanonical Dispatch StateまたはResult Statusへ追加する値ではない。Canonical mappingは[`08-dispatch-execution-integration-design.md`](08-dispatch-execution-integration-design.md)のStatus Vocabulary Boundaryに従う。

## Security Objectives

1. 未承認Task、外部Actor、fork、PR由来の入力でtrusted Runnerを起動しない。
2. Issue本文やrepository contentをcontrol instruction、Shell command、credential requestとして無条件に信頼しない。
3. Codex executionとGitHub writeを別credential boundaryへ分離する。
4. Taskごとのbranch、worktree、lock、process、resultを隔離する。
5. Canonical保存が確認できない結果をcompletedとして扱わない。
6. Secret、Token、personal path、別Task dataをlog、artifact、patch、PR、Handoffへ流出させない。
7. security failure時は権限拡大、fallback execution、force push、cleanupによる証拠破壊を行わない。

## Assets

- GitHub repository contents and history
- `main` and protected branches
- Canonical Task Assignment and Result Handoff
- GitHub write credential
- Codex credential
- Runner host and image
- task branch and worktree
- validation evidence and execution logs
- Product Owner approval state
- Role contracts and version-managed prompts
- local files outside the repository
- Existing Run、Research Data、Research Artifact

## Trust Zones

| Zone | Trust level | Examples |
| --- | --- | --- |
| External input | untrusted | Issue body free text、comments、PR content、fork content、dependency output |
| GitHub control metadata | conditionally trusted | repository identity、actor identity、labels、Issue state、event delivery |
| Version-managed policy | trusted only at approved base SHA | Role contract、validation profile、Dispatcher configuration |
| Dispatcher Core | trusted pure logic | Admission、status mapping、provisional handoff、finalization guard |
| Execution Adapter | privileged but write-isolated | prompt binding、process control、structured output parse |
| External Runner workspace | untrusted execution zone | checked-out repository、Codex process、dependency scripts |
| Validation zone | read / execute with no publish credential | change policy、tests、build |
| Publisher zone | GitHub write zone | normal push、Draft PR、Handoff create/update |
| Canonical GitHub record | audit source | Issue、Draft PR、top-level comment |

Zone間のdataは明示interfaceを通し、ambient environment、shared temp directory、global git config、clipboard、personal home directoryをtransportとして使用しない。

## Threat Model

### Issue and prompt injection

Threat:

- Issue本文がsystem / role instructionの上書き、scope拡大、secret取得、任意command実行を要求する。
- Markdown、code fence、URL、attachmentに命令を埋め込む。

Control:

- control fieldsはversioned parserで抽出し、free textと分離する。
- assigned roleはexact allowlistで解決し、Issue本文からRole promptを生成しない。
- Role promptとContractはapproved base SHAのrepository sourceへbindingする。
- allowed changes、forbidden changes、validationは構造化入力として扱い、Shellへ直接渡さない。
- ambiguity、unknown field、conflicting instructionはblocked。

### Shell and argument injection

Threat:

- task ID、slug、path、validation text、Issue fieldがShell metacharacterを通じてcommandを変更する。

Control:

- process APIへargument arrayで渡し、shell stringを組み立てない。
- task ID、branch、worktree pathはstrict parserとdeterministic encoderを使う。
- validationはapproved profile IDからfixed commandへ解決する。
- arbitrary command、redirection、command substitution、PowerShell expressionをAssignmentから受け付けない。

### Unauthorized trigger and label abuse

Threat:

- external actor、fork author、compromised automation、label権限の広いactorがdispatchを開始する。

Control:

- event payloadだけでなくGitHub APIからrepository、Issue、labels、actor permissionを再検証する。
- task approval actorとdispatch actorのpolicyを明示する。
- same-repository open Issueだけを許可する。
- pull request event、fork event、repository dispatch、comment commandをMVP Triggerへfallbackしない。
- label再付与は新revisionまたはauthorized retry recordなしではno-op。

### Workflow or policy substitution

Threat:

- task branchのWorkflow、AGENTS.md、role prompt、validation profile変更がcurrent executionの権限を拡張する。

Control:

- control planeとrole policyはapproved base SHAから読み、task branch版をcurrent runへ反映しない。
- Workflow変更を含むTaskはcurrent runのWorkflowを変更しない。
- policy versionとbase SHAをaudit recordへ保存する。

### GitHub token over-privilege

Threat:

- External Runnerまたはdependency scriptがGitHub write tokenを取得し、repositoryを変更する。

Control:

- job / process単位でleast privilegeを設定する。
- Worker executionとvalidationにはGitHub write credentialを渡さない。
- Publisherだけにtask branch push、PR、Handoffに必要なpermissionを限定する。
- merge、administration、actions workflow write、secrets writeを許可しない。

### Codex credential exposure

Threat:

- Codex API credentialがrepository code、log、process listing、artifact、PRへ流出する。

Control:

- credentialを必要processだけへ短時間渡す。
- command-line argument、prompt、job-wide environmentへ埋め込まない。
- stdout / stderrとstructured resultにsecret scannerを適用する。
- Publisher processへCodex credentialを引き継がない。

### Self-hosted runner host exposure

Threat:

- untrusted repository codeがrunner hostのpersonal files、OneDrive、credential cache、別repository、service accountへアクセスする。

Control:

- public fork / PR由来のjobをself-hosted runnerへ送らない。
- personal interactive accountをMVP runner identityにしない。
- self-hosted採用時は専用UserまたはVM、repository-scoped runner group、ephemeral job lifecycleを優先する。
- filesystem allowlist、network egress、credential store、home directoryを隔離する。
- OneDrive配下の個人領域全体をmountまたはworking rootにしない。

### Persistent contamination

Threat:

- previous Taskのfile、process、environment、cache、Git credential、malicious toolが次Taskへ残る。

Control:

- GitHub-hostedまたはephemeral self-hostedを優先候補とする。
- persistent runnerではtask-specific OS sandbox、workspace、temp、credential contextを分離する。
- cleanup前後にprocess、mount、workspace、git config、credential residueを検査する。
- cleanup failure時はrunnerをquarantineし、次Taskへ割り当てない。

### Worktree and repository escape

Threat:

- path traversal、symlink、junction、submodule、alternate git dirがrepository外または別Task dataへ到達する。

Control:

- resolved absolute pathがapproved workspace root内であることを確認する。
- branch / worktree作成前後にgit common dir、worktree git dir、repository remoteを照合する。
- symlink / junction crossing、unexpected submodule、nested repositoryをpolicyで拒否する。
- deletion、move、cleanup前にresolved target containmentを再検証する。

### Dependency and supply-chain execution

Threat:

- install、test、build scriptがnetwork、postinstall、native binaryを通じてhostまたはcredentialへアクセスする。

Control:

- validation profileごとにnetwork、install、cache、credential policyを定義する。
- lockfileとapproved package managerを使用する。
- credential-bearing Publisher zoneでrepository scriptsを実行しない。
- dependency update Taskは通常Taskと分離し、追加review gateを設ける。

### Log and artifact leakage

Threat:

- Secret、token、absolute path、username、local host detail、research artifact contentがlog / artifactへ混入する。

Control:

- structured allowlist loggingを使用する。
- raw environment、full command line、credential headerを記録しない。
- known secret maskingだけに依存せず、output allowlistとredactionを組み合わせる。
- public PR / Issueへ載せるdiagnosticとrestricted operational logを分離する。
- retention期間終了後の削除ownerを定義する。

### Handoff spoofing or replay

Threat:

- 別Task、旧revision、別executionのresultをCanonical Handoffとして投稿する。
- publication retryが二重PRまたは二重commentを作る。

Control:

- resultをrepository、task ID、assignment revision、execution ID、branch、commitへbindingする。
- Canonical Locationをtask identityでidempotentに検索する。
- read-after-writeでtask ID、role、status、record identityを確認する。
- stale resultはfinalizeせずblocked。

## Credential Matrix

| Operation | GitHub read | GitHub write | Codex | Repository code execution |
| --- | --- | --- | --- | --- |
| Trigger validation | yes | no | no | no |
| Admission / lock | yes | state record only if separated | no | no |
| Workspace prepare | fetch only | no | no | trusted git operations only |
| Worker execution | no by default | no | yes | yes, sandboxed |
| Validation | no by default | no | no | yes, sandboxed |
| Commit preparation | no | no | no | trusted git operations only |
| Push / Draft PR | metadata as needed | limited yes | no | no repository scripts |
| Handoff publication | metadata as needed | limited yes | no | no repository scripts |

同じprocessまたはjobがCodex credentialとGitHub write credentialを同時に保持する設計はSecurity Reviewなしで採用しない。

## Trigger Security Contract

MVP Trigger候補がIssue `labeled` eventの場合、実装は次を満たす。

- repository full nameのexact match
- IssueでありPull Requestではない
- Issue stateがopen
- exact approval labelとexact Worker dispatch label
- actorがapproved allowlistまたは必要permissionを満たす
- Canonical AssignmentがIssue bodyまたは許可されたtop-level recordに存在
- Assignment revision digestがapproval対象と一致
- `assigned_role`がexact `Worker`
- task IDが既存active lockまたはterminal recordと矛盾しない

不足時はRunner、Codex credential、GitHub write credentialを起動しない。blocked recordを投稿する場合も、untrusted本文を引用しすぎずsanitized reasonだけを使う。

## Runner Security Candidates

### GitHub-hosted runner

Strength:

- jobごとのmanaged environment
- personal PCとlocal OneDriveから隔離
- GitHub-native job audit

Risk:

- runner image変動
- usage cost
- local-only dependency非互換
- workflow permission / artifact boundaryの誤設定

Required review:

- image / OS pin strategy
- network and cache policy
- Codex ActionまたはCLI credential handoff
- write job separation

### Ephemeral self-hosted runner

Strength:

- controlled imageとcustom toolchain
- one-job lifecycleを実現可能

Risk:

- provisioning plane compromise
- stale image、patch、runner update
- host / network / credential exposure

Required review:

- dedicated user or VM
- ephemeral registration
- runner group and repository scope
- teardown verification and quarantine

### Persistent self-hosted runner

Security posture:

- MVP defaultとして採用しない。
- 採用にはpersistent contamination、dedicated account、filesystem / network isolation、patching、offline behavior、quarantineの個別承認が必要。

### Dispatcher-managed local process

Security posture:

- GitHub self-hosted runnerと同一概念ではない。
- personal PC常駐、session availability、local credential、OneDrive data、audit、service restartを別途設計する必要がある。
- MVP defaultとして採用しない。

## Git and Worktree Security

### Preflight

- repository remote identity exact match
- main / base branch clean and not directly edited
- base SHA available and approved
- task branch name deterministic and safe-character only
- worktree target does not exist, or exact task ownership matches
- resolved path inside dedicated dispatch root
- no dirty or untracked foreign files
- no unexpected symlink、junction、submodule、nested repository

### During execution

- working directoryを固定し、`cd`をIssue inputから受けない。
- repository root外へのrecursive read / writeを禁止する。
- shared global tempへTask contentを残さない。
- git config / credential helperをTaskが変更できないようにする。
- main、他Task branch、他worktreeを変更しない。

### Publication

- allowed change policy pass後だけexplicit stage。
- commit author identityはautomation identityとして明示する。
- normal pushのみ。
- remote branch state mismatchでblocked。
- Draft PR base / headのexact matchをread-after-write確認する。

### Cleanup

- resolved target pathとtask ownershipを再検証する。
- process tree終了前にremoveしない。
- failed evidenceやunpublished commitを失うcleanupをしない。
- cleanup failureでrunnerを次Taskへ再利用しない。

## Handoff Security

Canonical Result Handoffは次とbindingする。

- repository
- task ID
- Canonical Task Assignment URL
- assignment revision
- role
- execution ID
- branch
- commit SHAまたはno-change evidence
- Draft PR URLまたはnot applicable reason
- validation results
- workflow / runner execution reference

公開Recordにlocal absolute worktree path、username、host name、credential identifierを保存しない。必要なoperational diagnosticはsanitized runner labelとlogical workspace identityへ限定する。

Canonical save protocol:

1. task identityでexisting recordを検索する。
2. create-or-updateする。
3. API successだけでなくread-after-writeする。
4. content identityとtask bindingを確認する。
5. その後だけ`canonical_saved: true`をCoreへ渡す。
6. final Handoff反映後に再度read-after-writeする。

途中失敗では`completed`禁止。retryは同じrecordを更新し、別recordを増殖させない。

## Logging and Retention

### Public audit record

Allowed:

- task ID、role、state、sanitized timestamps
- branch、commit、Draft PR、workflow run URL
- validation command profile nameとexit result
- sanitized failure category
- retry count、timeout / cancel result

Forbidden:

- raw credential、authorization header
- complete environment dump
- user home path、personal OneDrive path
- unrestricted stdout / stderr
- research artifact本文の不要な複製
- Promptに含まれるsecret-like value

### Operational log

必要最小限のrestricted logだけを保持する。保持期間、access owner、deletion mechanismはRunner Provisioning Contractで決定する。本設計では日数をFreezeしない。

## Failure and Recovery Matrix

| Failure | Credential action | Workspace action | Record action | Retry |
| --- | --- | --- | --- | --- |
| unauthorized trigger | issue none | none | sanitized blocked if permitted | no |
| Runner offline | no execution credential | none | queued / blocked evidence | bounded control-plane retry |
| Codex auth failure | revoke / expire scope | preserve evidence | failed | manual after credential fix |
| usage limit | expire credential | preserve | failed / needs followup | policy approval |
| timeout | expire credential | preserve | failed with timeout diagnostic | manual |
| process crash | expire credential | quarantine if residue | failed | manual |
| dirty worktree | none | do not reset/delete | blocked | after owner resolution |
| scope violation | no publisher credential | preserve diff | failed | new assignment or correction |
| validation failure | no publisher credential | preserve diff | failed | manual correction |
| push rejection | expire publisher token | preserve commit | blocked / stale | after remote review |
| PR API failure | expire publisher token | preserve commit | failed | same commit, bounded |
| Handoff failure | expire publisher token | preserve | failed | same record, bounded |
| secret leakage suspicion | revoke all affected | quarantine | security escalation | no automatic retry |
| cleanup failure | none | quarantine runner / workspace | needs followup | manual cleanup |

## Security Test Matrix

### Trigger and actor tests

| ID | Scenario | Expected | Negative evidence |
| --- | --- | --- | --- |
| SEC-INT-001 | approved same-repository Worker Issue | Admission may continue | no write credential before Admission |
| SEC-INT-002 | unauthorized actor applies label | blocked | Runner invocation count zero |
| SEC-INT-003 | fork or PR event | rejected | Secret access count zero |
| SEC-INT-004 | approval label without matching revision | stale / blocked | no workspace creation |
| SEC-INT-005 | label remove / reapply same revision | no-op or authorized retry only | no duplicate execution |

### Injection tests

| ID | Scenario | Expected |
| --- | --- | --- |
| SEC-INT-010 | shell metacharacters in task ID / slug | Assignment rejected |
| SEC-INT-011 | command embedded in validation text | fixed profile resolution only; arbitrary command not run |
| SEC-INT-012 | Issue asks to reveal Secret or edit main | instruction ignored / blocked by policy |
| SEC-INT-013 | task branch modifies AGENTS.md or role prompt | current execution policy remains approved base version |
| SEC-INT-014 | malicious output imitates Handoff | structured validation rejects or sanitizes |

### Credential tests

| ID | Scenario | Expected |
| --- | --- | --- |
| SEC-INT-020 | Worker execution environment inspection | no GitHub write credential |
| SEC-INT-021 | Publisher environment inspection | no Codex credential |
| SEC-INT-022 | validation script runs | no publish or Codex credential |
| SEC-INT-023 | fixture secret in stdout / stderr | public log、artifact、Handoffに不存在 |
| SEC-INT-024 | unapproved Task | credential provider invocation count zero |

### Filesystem tests

| ID | Scenario | Expected |
| --- | --- | --- |
| SEC-INT-030 | worktree path traversal | blocked |
| SEC-INT-031 | symlink / junction escapes root | blocked |
| SEC-INT-032 | unexpected submodule or nested repository | blocked |
| SEC-INT-033 | dirty foreign worktree | preserved and blocked |
| SEC-INT-034 | cleanup target ownership mismatch | no deletion; quarantine |

### Result and publication tests

| ID | Scenario | Expected |
| --- | --- | --- |
| SEC-INT-040 | invalid structured Worker result | failed provisional handoff |
| SEC-INT-041 | Canonical save proof missing | finalization blocked |
| SEC-INT-042 | read-after-write mismatch | completed forbidden |
| SEC-INT-043 | Handoff API retry | same record updated; no duplicate |
| SEC-INT-044 | push rejection | no force push |
| SEC-INT-045 | duplicate event delivery | one active execution and one PR maximum |

### Runner isolation tests

| ID | Scenario | Expected |
| --- | --- | --- |
| SEC-INT-050 | previous Task leaves file / process | next Task does not start; runner quarantine |
| SEC-INT-051 | Runner offline | queue / bounded failure; no local fallback |
| SEC-INT-052 | cancel during child process | process tree terminates; no publish |
| SEC-INT-053 | timeout with partial output | sanitized failed result; lock ownership retained until cleanup decision |
| SEC-INT-054 | dependency script attempts network / home access | sandbox / policy denies or test fails safely |

本PRではsecurity testを実装しない。

## Security Review Gates

Implementation開始前:

- PR #95 merged interface確認
- Control Plane候補決定
- Runner type、OS、hosting owner決定
- credential providerとscope決定
- write job separation設計Review
- prompt / validation profile source決定
- logs / artifacts retention owner決定

Pilot開始前:

- all negative trigger tests pass
- Worker / Publisher credential separation evidence
- branch / worktree isolation tests pass
- secret leak fixture tests pass
- timeout / cancel / duplicate / Handoff retry tests pass
- auto-merge、force push、main direct editが不可能であることを確認
- Product Ownerによるpilot Task明示承認

## Deferred Security Decisions

- GitHub-hostedまたはself-hosted runnerの採用
- GitHub App、GITHUB_TOKEN、fine-grained credentialの選択
- GitHub Environment / required reviewerの利用
- Codex credential storageとrotation owner
- exact network egress policy
- sandbox implementation
- log / artifact retention期間
- runner image pinとupdate cadence
- persistent lock / audit storage
- incident responseとcredential revocation runbook

Backend Implementerはこれらを推測して実装しない。

## Explicit Non-implementation Confirmation

本設計では次を実施していない。

- Workflow、GitHub Actions、Bot、Webhook、Service実装
- Runner登録、User / VM / Service作成
- Credential、Secret、Token登録
- Codex CLI / SDK / Action実装
- Dispatcher、Adapter、Publisher code変更
- Schema変更
- Existing Run、Research Data、Research Artifact変更
- PR #91、PR #93、PR #95 Contract変更
- Merge
