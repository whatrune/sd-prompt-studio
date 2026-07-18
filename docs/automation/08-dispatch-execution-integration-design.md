# Dispatch Execution Integration Design

## Status

- Design version: `0.1.0`
- Status: Design review candidate
- Task Assignment: [Issue #96](https://github.com/whatrune/sd-prompt-studio/issues/96)
- Primary role: Backend Architect
- Implementation status: not implemented
- Technology selection: deferred

本書は、PR #95で実装されたDispatch MVP Coreと、将来のControl Plane、Execution Adapter、External Runner、Git Publisherを接続するためのIntegration Designである。GitHub Actions、Runner、Codex CLI / SDK、Dispatcher Service、Secret、Workflowを実装または採用決定する文書ではない。

## Purpose

Dispatch MVP Coreのpure orchestration boundaryを維持したまま、承認済みTask Assignmentを一回の外部実行へ渡し、検証済みの成果をDraft PRとCanonical Result Handoffへ安全に接続できる実装境界を定義する。

ユーザー価値は、Product Ownerが担当チャットへPromptを手動転送せず、Integrated LeadがGitHub上のCanonical Recordだけを使って専門Roleへ依頼し、その実行結果を監査可能な形で受領できることである。

## Normative and Input Boundaries

### Normative sources

本設計は次のFreeze済みContractを変更しない。

1. [`00-automation-overview.md`](00-automation-overview.md)
2. [`01-dispatch-contract.md`](01-dispatch-contract.md)
3. [`02-role-runner-mapping.md`](02-role-runner-mapping.md)
4. [`03-approval-gate.md`](03-approval-gate.md)
5. [`04-security-boundary.md`](04-security-boundary.md)
6. [`05-automation-handoff-contract.md`](05-automation-handoff-contract.md)
7. [`06-dispatch-mvp-implementation-design.md`](06-dispatch-mvp-implementation-design.md)
8. [`07-dispatch-mvp-test-design.md`](07-dispatch-mvp-test-design.md)
9. [`../team/08-integrated-lead-charter.md`](../team/08-integrated-lead-charter.md)
10. [`../team/11-delegation-and-result-contract.md`](../team/11-delegation-and-result-contract.md)

### PR #95 input status

本書作成時点で、[PR #95](https://github.com/whatrune/sd-prompt-studio/pull/95)はDraftかつ未Mergeであり、確認したreviewed HEADは`82af7831680d5a4d92112a4e9500afa73c731c9c`である。

本設計が参照するPR #95の公開境界は次のとおりである。

- `Dispatcher`は`WorkerRunner`をconstructor injectionで受け取る。
- `WorkerRunner.run()`はread-only `TaskAssignment`を受け、`WorkerExecutionResult`を返す。
- `Dispatcher.dispatch()`は`ProvisionalDispatchResult`を返す。
- `ProvisionalHandoff`と`CanonicalResultHandoff`は異なる型である。
- `finalizeCanonicalHandoff()`はCanonical保存確認と必須Canonical fieldsなしではfinalizeしない。
- Dispatcher CoreはShell、Git、GitHub API、Runner provisioning、Codex invocationを実装しない。

後続実装は、PR #95がMerge済みであることと、Merge commit上の公開interfaceが上記reviewed HEADと一致することを開始Gateで確認しなければならない。差分がある場合は実装を開始せず、Backend Architectへ返却する。

## Scope

本設計が定義するもの:

- Dispatcher Coreと外部Executionの接続境界
- TriggerからCanonical Result Handoffまでのdata flow
- Execution Adapterの責務と禁止事項
- branch / worktree lifecycleのownerと安全停止条件
- Credential分離とGitHub writeの分離
- retry、timeout、cancel、idempotencyのintegration rule
- technology candidatesの比較
- implementation task splitとtest design

本設計が定義しないもの:

- Workflow YAML
- GitHub Actions job
- Runner登録またはprovisioning
- Secret登録またはcredential取得
- Codex CLI / SDK wrapper
- Bot、Webhook、常駐Service
- JSON Schemaまたは永続Artifact Schema
- PR #91、PR #93、PR #95のContract変更
- Worker以外のRole対応
- 自動Approve、Merge、Revert、次Role Dispatch

## Architecture Boundary

```text
Canonical GitHub Task Assignment
        |
        v
Trigger Adapter
        |
        v
Admission and Dispatcher Core
        |
        | WorkerRunContext
        v
Execution Adapter (implements WorkerRunner)
        |
        | immutable execution request
        v
External Runner / Codex Execution
        |
        | raw process result
        v
Execution Adapter
        |
        | WorkerExecutionResult
        v
Dispatcher Core
        |
        | ProvisionalDispatchResult
        v
Change Policy / Validation / Git Publisher
        |
        | persisted canonical record proof
        v
Canonical Handoff Finalizer
        |
        v
Canonical Result Handoff
        |
        v
Integrated Lead
```

### Dispatcher Core

Dispatcher CoreはPR #95のpure orchestration boundaryである。

担当:

- Assignmentの既存Admission Validation
- Worker Role bindingの既存確認
- `WorkerRunner.run()`の一回呼出し
- `WorkerExecutionResult`から`ProvisionalHandoff`への変換
- Result StatusとDispatch Stateの既存整合
- Canonical保存確認後のfinalization

禁止:

- Shell process起動
- Git command実行
- branch / worktree作成
- GitHub API呼出し
- Codex認証または起動
- Secret取得
- Workflow eventの信頼判定
- Validation commandの任意生成
- Worker専門作業

### Execution Adapter

Execution AdapterはPR #95の`WorkerRunner`を実装するanti-corruption layerである。具体TechnologyをDispatcher Coreへ漏らしてはならない。

担当:

- `WorkerRunContext`をimmutable execution requestへ変換
- approved role profileとversion-managed prompt sourceのbinding
- External Runner processまたはjobの一回起動
- timeout、cancel、exit、stdout / stderrの制御
- structured outputのparseとvalidation
- sanitized `WorkerExecutionResult`の返却

禁止:

- Assignmentの承認状態を上書き
- Role変更またはfallback
- allowed / forbidden changesの拡張
- arbitrary Issue textのShell化
- GitHub write credentialの保持
- Result HandoffのCanonical保存成功を自己宣言
- `completed`の捏造

### External Runner

External Runnerは選択されたexecution technologyを実行する隔離境界である。

担当:

- 指定working directoryでの一回実行
- pinされたRole instructionとTask Assignmentの利用
- process-level timeout / cancelへの応答
- structured resultと限定されたdiagnosticの返却

禁止:

- main直接編集
- force pushまたはmerge
- Repository外Pathの探索
- Issue、PR、fork由来の任意命令をcontrol instructionとして採用
- Product、Contract、Research判断
- 別Task workspaceの利用

### Workspace and Git Manager

Workspace and Git ManagerはExecution Adapterとは別のcapability boundaryである。同一processに実装する場合もcredentialと責務を論理的に分離する。

担当:

- exact base SHA確認
- create-only branch / worktree作成
- clean state、containment、collision確認
- changed-file policyの収集
- validation後のcommit準備
- cleanup eligibilityの判定

### Git Publisher and Handoff Publisher

Git Publisherはnormal pushとDraft PR作成だけを担当する。Handoff PublisherはCanonical Record保存と更新だけを担当する。Codex credentialを持たない。

## End-to-End Data Flow

### Step 1: Trigger capture

Input:

- same-repository GitHub Issue event
- exact dispatch label event
- actor、repository、Issue identity、event delivery identity

Process:

- Trigger Adapterがevent payloadをtrusted control fieldsとuntrusted contentへ分離する。
- repository、Issue state、actor allowlist、approval label、role labelを再取得して検証する。
- Issue bodyのrevision digestを計算し、event時点のAssignmentとbindingする。

Output:

- sanitized Admission Request

Failure:

- unauthorized actor、fork、PR event、closed Issue、approval不足、role不一致はRunnerを起動せず`blocked`またはrejected evidenceを残す。

### Step 2: Admission and idempotency

Input:

- sanitized Admission Request
- Canonical Task Assignment
- existing execution records

Process:

- PR #95のAssignment Validationを行う。
- lock keyを`repository + task_id + assignment_revision`から決定する。
- 同一revisionのrunningまたはcompleted executionを確認する。

Output:

- admitted immutable execution plan、またはblocked provisional result

Failure:

- duplicate、stale revision、unsupported role、missing canonical recordではExternal Runnerを起動しない。

### Step 3: Workspace preparation

Input:

- admitted execution plan
- exact base branch and SHA

Process:

- branchとworktreeの不存在または既存所有権を確認する。
- repository root containmentとsymlink boundaryを確認する。
- clean baseからcreate-onlyでworkspaceを準備する。

Output:

- task-owned workspace identity

Failure:

- dirty、collision、unexpected owner、base mismatch、containment failureでは既存workspaceを変更せず`blocked`。

### Step 4: Worker execution

Input:

- read-only Task Assignment
- version-managed Worker role prompt
- task-owned working directory
- bounded execution policy

Process:

- Execution AdapterがExternal Runnerを一回起動する。
- stdout / stderrをseparate streamsとしてcaptureし、Secretをredactする。
- timeoutまたはcancel時はchild process treeの終了を確認する。
- outputをstructured `WorkerExecutionResult`へ変換する。

Output:

- `WorkerExecutionResult`

Failure:

- auth、usage limit、invalid output、process crash、timeoutは`failed`素材を返し、完了を表明しない。

### Step 5: Provisional handoff

Input:

- `WorkerExecutionResult`

Process:

- Dispatcher Coreが`buildExecutionHandoff()`相当の既存処理を適用する。
- validation failureまたはcompletion status without validationは既存PR #95ルールで`failed`へ正規化する。

Output:

- `ProvisionalDispatchResult`
- `ProvisionalHandoff`

Failure:

- malformed resultは`failed` provisional handoffであり、Canonical completionではない。

### Step 6: Change policy and validation

Input:

- task workspace diff
- Assignmentのallowed / forbidden changes
- Assignmentのvalidation list

Process:

- path containment、forbidden file、unexpected untracked fileを検査する。
- validation commandはversion-managed allowlist/profileからのみ解決する。
- Assignment本文をShell commandへ展開しない。

Output:

- validated change set、またはfailed provisional result

Failure:

- scope violation、validation failure、command resolution failureではpushしない。

### Step 7: Publish change

Input:

- validated change set
- task branch identity
- Git publisher credential

Process:

- explicit filesのみstageする。
- normal commitとnormal pushを行う。
- 既存Draft PRをtask identityで検索し、存在しなければ一つだけ作成する。

Output:

- commit SHA
- Draft PR URL、またはno-change result

Failure:

- push rejection、PR API failure、remote collisionではforce pushせず停止する。

### Step 8: Canonical Handoff publication

Input:

- `ProvisionalDispatchResult`
- branch、commit、Draft PR、validation、execution diagnostics
- known Canonical Location

Process:

1. Handoff Publisherが同一task / execution用のCanonical Locationをcreate-or-updateする。
2. Publisherは保存成功、直接参照可能なURL、保存対象identityを返す。
3. 保存成功の証拠がある場合だけ`canonical_saved: true`とCanonical fieldsを`finalizeCanonicalHandoff()`へ渡す。
4. finalization resultを同じCanonical Locationへ反映し、read-after-writeで内容を確認する。
5. 最終反映またはread-after-writeが失敗した場合、Taskを`completed`扱いしない。

Output:

- `CanonicalResultHandoff`
- directly addressable Canonical Record
- terminalまたはnon-terminal Dispatch State

二段階更新が必要なTechnologyでは、同一record identityを維持する。別commentや別PRをretryごとに増殖させてはならない。

### Step 9: Integrated Lead receipt

Integrated LeadはCanonical Record、Task Assignment revision、PR diff、validation evidenceを照合する。実行されていないTask、Canonical保存未確認Task、scope違反Taskをcompletedとして受領しない。

## Result Type Mapping

```text
External process output
        |
        v
Execution Adapter parse and sanitize
        |
        v
WorkerExecutionResult
        |
        v
Dispatcher.dispatch()
        |
        v
ProvisionalDispatchResult
        |
        +-- ProvisionalHandoff
        |
        v
Change / Validation / Publication evidence
        |
        v
Canonical save proof
        |
        v
finalizeCanonicalHandoff()
        |
        v
CanonicalResultHandoff
```

`WorkerExecutionResult`は外部実行のstructured resultであり、Canonical Recordではない。`ProvisionalHandoff`はintegration途中の値であり、Integrated Leadの正式受領対象ではない。`CanonicalResultHandoff`だけが既存Contractに従う正式なResult Handoff候補である。

## Status Vocabulary Boundary

PR #95のCanonical vocabularyは次に限定される。

- Dispatch State: `draft`、`approved`、`running`、`completed`、`blocked`、`failed`
- Result Status: `completed`、`completed_with_warnings`、`needs_followup`、`blocked`、`failed`、`not_applicable`

本設計内の`queued`、`stale`、`rejected`、`timed_out`、`cancelled`はControl Planeまたはexecution diagnostic上の状態説明であり、PR #95のDispatch StateまたはResult Statusへ追加するField値ではない。Adapterは既存Contractに従って、たとえばstale / rejectedを`blocked`、timeoutを`failed`へmappingし、詳細理由を`unresolved_items`またはsanitized diagnosticへ記録する。新しいstatusをBackend Implementerが独自追加してはならない。

## Trigger Integration Candidates

### Decision

Canonical GitHub Task AssignmentからAdmission Requestを生成するControl Planeを選択する。

### Candidates

| Candidate | Fit | Strength | Risk |
| --- | --- | --- | --- |
| GitHub Actions | high for event-driven MVP | Issue `labeled` event、job permission、environment gate、run auditをGitHub内で管理可能 | Workflow credential、event injection、runner trustを慎重に分離する必要 |
| GitHub App | high for long-term service | fine-grained installation permission、webhook verification、dedicated identity | App lifecycle、webhook endpoint、key rotation、service運用が増える |
| External Webhook Service | medium | GitHub以外のqueue / schedulerと統合しやすい | public ingress、signature validation、availability、secret管理が増える |
| Local Service | low for unattended MVP | local worktreeとtoolchainを直接利用可能 | personal PC常駐、availability、local data exposure、audit gap |

### Reason

GitHub Actionsは既存GitHub Issueをcontrol sourceにでき、MVPのevent、permission、auditを一箇所へ寄せやすい。GitHub AppはGitHub Token以上の長期権限分離が必要になった場合の強い候補である。

### Risk

いずれの候補もIssue本文をtrusted programとして扱ってはならない。Trigger Technologyの採用だけでRunner Securityは解決しない。

### Deferred

Control Planeは本設計で採用決定しない。GitHub Actions prototypeとGitHub App operational costをimplementation planning時に比較する。

## Runner Candidates

### Decision

External Runnerのexecution isolation、repository access、credential boundaryを満たすruntimeを選択する。

### Candidates

| Candidate | Fit | Strength | Risk |
| --- | --- | --- | --- |
| GitHub-hosted runner | high for isolated MVP | jobごとに新規environment、GitHub native audit、local personal filesへ非接続 | local worktree再利用不可、OS / tool制約、usage cost |
| Ephemeral self-hosted runner | medium to high | controlled image、custom toolchain、one-job lifecycle | provisioning、patch、network、credential、image hygieneをoperatorが管理 |
| Persistent self-hosted runner | low | warm cache、local environment再利用 | persistent contamination、cross-task leakage、offline、maintenance |
| Dispatcher-managed local process | low for unattended use | existing Windows toolchainとworktreeを利用可能 | GitHub Runnerではない。personal data、availability、service identity、auditの追加設計が必要 |

### Reason

GitHub-hosted runnerはMVPのclean executionとpersonal PC isolationに最も自然である。Windows固有環境が不可欠な場合は、専用UserまたはVM上のephemeral self-hosted runnerを次候補とする。

### Risk

public repositoryでuntrusted fork / PR codeをself-hosted runnerへ送る構成は禁止する。persistent personal PC runnerはMVP既定候補にしない。

### Deferred

OS、runner group、labels、GitHub Environment、network egress、image update、retentionはProvisioning Designで決定する。

## Codex Invocation Candidates

### Decision

version-managed promptとbounded tool policyを使い、External Runnerから一回の非対話実行を行う公式Interfaceを選択する。

### Candidates

| Candidate | Fit | Strength | Risk |
| --- | --- | --- | --- |
| Codex GitHub Action | high when Control Plane is Actions | official ActionがCLI install、`codex exec`、prompt / output / sandbox optionsを統合 | GitHub Actions coupling、Windows safety caveat、credential placement |
| `codex exec` | high for process adapter | noninteractive、stdout / stderr分離、JSONL、output schema、sandbox指定 | CLI lifecycle、process tree、credential scope、version pinをAdapterが管理 |
| Codex SDK | medium for richer orchestration | structured programmatic integration、thread control、application-level handling | orchestration scopeが広がり、MVP Coreとの責務重複リスク |

### Reason

GitHub Actions採用時はCodex GitHub Actionが最小統合候補である。Control Plane非依存のExecution Adapterでは`codex exec`が最小process boundary候補である。SDKは複数turnまたは深いapplication orchestrationが必要になるまで延期する。

### Risk

実在しないCLI optionや未確認のauthentication flowをContractへ固定しない。採用時に公式documentationとpin対象versionを再確認する。

### Deferred

Invocation Technology、model、reasoning effort、sandbox、network、output schema、timeout値、usage limit policyは未決定である。

## Transport Candidates

### Decision

Dispatcher CoreとExternal Runnerの間で、Task identityとstructured resultを欠落なく運ぶtransportを選択する。

### Candidates

- in-process `WorkerRunner` implementation
- child process stdin / stdout with versioned JSON envelope
- workflow job output plus immutable artifact
- authenticated local or remote service API

### Reason

in-process adapterは最小だがcredential / process isolationが弱い。processまたはjob境界は隔離しやすいが、schema/version、size limit、partial output、artifact bindingが必要になる。

### Risk

stdout human logをstructured resultとしてparseしてはならない。transport recordはtask ID、assignment revision、execution ID、producer versionとbindingする必要がある。

### Deferred

永続JSON Schema、artifact hash、queue、databaseは本設計では追加しない。後続実装で既存Type boundaryを破らずに最小transportを決定する。

## Git Branch and Worktree Lifecycle

### Identity

- branch: existing Contractで定めるdeterministic task branch
- worktree: task IDとroleに一意なcontained path
- lock: repository + task ID + assignment revision
- base: Admission時に記録したexact origin base SHA

絶対local pathをCanonical Result Handoffへ保存しない。必要な場合はrunner内diagnosticだけに留め、公開Handoffではlogical workspace identityへ置換する。

### Creation

1. lock取得
2. repository rootとremote identity確認
3. exact base SHA fetch / availability確認
4. branch / worktree collision確認
5. create-only branch
6. create-only worktree
7. clean status確認
8. External Runnerへworking directoryを渡す

既存branchがある場合はtask ownership、base、remote stateを照合する。既存worktreeがdirtyまたはowner不明の場合は再利用せず`blocked`。

### Publish

- explicit allowed filesだけをstageする。
- force pushを禁止する。
- remote rejection時にhistoryを書き換えない。
- rebaseまたはmergeが必要な場合は自動判断せず`stale`または`blocked`として返す。
- Draft PRはtask IDでidempotentに検索し、一Task一PRを維持する。

### Cleanup

cleanup可能条件:

- External Runner process treeが終了済み
- lock ownerが現在executionと一致
- commit / diff / validation evidenceが失われない
- Canonical Result Handoffが保存済み
- retention policyを満たす

failed、blocked、timeout、publication failure時のworktreeは即時削除しない。保持期間とmanual cleanup ownerはProvisioning / Operations Contractで決定する。

## Credential Separation

| Boundary | Allowed credential | Forbidden credential |
| --- | --- | --- |
| Trigger / Admission | GitHub metadata read | Codex credential、repository contents write |
| External Worker execution | short-lived Codex credential | GitHub write、environment administration |
| Change / Validation | none by default | Codex、GitHub write |
| Git Publisher | task branch contents / pull request write | Codex credential、merge/admin |
| Handoff Publisher | Issue / pull request write | Codex credential、merge/admin |
| Finalizer | persisted-record proof input | GitHub admin、Codex credential |

SecretをPrompt、CLI argument、job-wide environment、stdout、stderr、patch、PR body、Handoffへ含めない。Repository codeが実行されるprocessへGitHub write credentialとCodex credentialを同時に渡さない。

GitHub-hosted workflowを選ぶ場合、job-level `permissions`は必要最小限にする。書込JobはCodex実行Jobから分離し、untrusted repository codeを実行しない。GitHub EnvironmentをApproval GateまたはSecret boundaryに利用するかは後続決定とする。

## Concurrency, Retry, Timeout, and Cancellation

### Concurrency

- 同一task ID / revisionは最大一実行。
- 同一branchへの同時writeは禁止。
- 一worktree一active execution。
- runnerが一台の場合はqueueし、別Taskのworkspaceを再利用しない。
- repository全体最大並列数はRunner Technology決定後に設定する。

### Retry

- Admission failure: automatic retryなし。
- Runner offline / transient API: bounded retry候補。新execution IDを付け、同一task revisionへbindingする。
- Worker execution failure / timeout:自動再実行しない。retry approvalを必要とする。
- push / PR / Handoff publication:同じcommit、PR identity、record identityでbounded retry可能。
- Handoff publicationだけのfailureではWorkerを再実行しない。

### Timeout

timeoutはExternal Runner、validation、GitHub APIごとに分離する。External Runner timeout時はchild process treeの終了確認、partial logのsanitization、lock ownershipの記録を行う。Result Handoff statusは既存Contractに従い`failed`であり、`timed_out`を新しいResult Statusとして追加しない。

### Cancellation

cancel requestはactor authorizationとtask identityを再検証する。新しいcommand、validation、publishを停止し、process terminationとlock releaseを確認する。既存commit、PR、Canonical Recordを削除しない。

## Failure Handling

| Failure | Safe result | Required action |
| --- | --- | --- |
| unauthorized trigger | blocked / rejected | RunnerとSecretを起動しない |
| assignment revision mismatch | stale / blocked | 再承認を要求 |
| Runner offline | queued then bounded failure | 別ownerのworkspaceへfallbackしない |
| Codex authentication failure | failed | credentialをlogせずcredential ownerへ返す |
| usage limit | failed / needs followup | blind retryしない |
| invalid structured output | failed | raw outputをCanonical Handoffとして採用しない |
| process timeout / crash | failed | process tree、partial result、lockを確認 |
| dirty or colliding worktree | blocked | reset、delete、overwriteしない |
| scope violation | failed | stage / pushを行わない |
| validation failure | failed | publishを行わない |
| push rejection | blocked / stale | force pushしない |
| Draft PR creation failure | failed | same commitでidempotent retry |
| Handoff publication failure | failed | completed禁止、Worker再実行なしで再投稿可能 |
| read-after-write mismatch | failed | Canonical finalization禁止 |
| duplicate trigger | no-op or existing result | 二重Runner / PR / Handoff禁止 |

## Security Boundary

詳細なThreat Modelとnegative testは[`09-runner-security-design.md`](09-runner-security-design.md)に定義する。

最低条件:

- actor、repository、Issue、approval labelをGitHub APIから再検証する。
- fork、pull request code、external repository dispatchからtrusted executionを開始しない。
- Issue textをShell、CLI options、path、role contractとして直接採用しない。
- version-managed role contractとallowlisted validation profileへbindingする。
- repository root containment、symlink、submodule、path traversalを検査する。
- Codex credentialとGitHub write credentialを同一untrusted processへ渡さない。
- logs、artifacts、PR、HandoffでSecretとpersonal absolute pathをredactする。
- workflow fileまたはAGENTS.mdのtask branch変更をcurrent executionの権限拡張へ反映しない。

## Test Design

後続実装は[`07-dispatch-mvp-test-design.md`](07-dispatch-mvp-test-design.md)を維持し、integration-specific testを追加する。

### Adapter contract tests

- admitted immutable assignmentだけがExternal Runnerへ渡る。
- `WorkerRunner.run()`一回につきExternal Runner一回だけ起動する。
- invalid output、exit failure、timeoutを`WorkerExecutionResult`の成功へ変換しない。
- human logとstructured resultを分離する。
- secret-like fixtureがresult、log、Handoffへ流出しない。

### Workspace tests

- exact baseからcreate-only branch / worktreeを作る。
- existing dirty worktree、foreign owner、branch collisionでblocked。
- path traversal、symlink escape、repository mismatchを拒否。
- failed executionで既存workspaceをdelete / resetしない。

### Publication tests

- normal pushのみ。
- duplicate triggerで二重commit、PR、commentを作らない。
- scope / validation failure時はpushしない。
- Handoff投稿失敗時はcompletedにしない。
- Canonical save proofなしで`finalizeCanonicalHandoff()`成功を得ない。
- saved recordとfinalized Handoffのtask ID、role、status、canonical recordが一致する。

### Credential tests

- Worker processにGitHub write credentialがない。
- Publisher processにCodex credentialがない。
- unapproved triggerでcredential access countがzero。
- logsとartifactsにfixture secretがない。

### End-to-End test candidates

1. approved Worker docs-only Task
2. unapproved or unauthorized Issue
3. forbidden file change
4. dirty worktree collision
5. Worker timeout
6. Handoff-only retry
7. duplicate label delivery
8. fork or external actor event

本PRではtestを実装しない。

## Implementation Task Split

後続Implementationは一つの巨大PRへまとめない。

1. **Execution Adapter Contract Implementation**
   - `WorkerRunner` adapter、structured result parser、timeout / cancel
   - Owner: Backend Implementer
   - Gate: PR #95 merged interface SHA verification
2. **Workspace and Git Manager**
   - create-only branch / worktree、containment、diff policy
   - Owner: Backend Implementer
3. **Trigger and Admission Adapter**
   - selected Control Plane event、actor / repository / revision validation
   - Owner: Backend Implementer
4. **Validation and Change Policy Integration**
   - version-managed validation profiles、allowed / forbidden change check
   - Owner: Backend Implementer
5. **Git and Handoff Publisher**
   - credential-separated normal push、Draft PR、Canonical Handoff、idempotent retry
   - Owner: Backend Implementer
6. **Runner Provisioning**
   - runner、environment、credential、network、operations runbook
   - Owner: Product Owner-approved Operations owner
7. **Worker Pilot**
   - approved non-destructive docs-only Task
   - Owner: Integrated Lead routing; separate Task Assignment

各Taskは独立したCanonical Assignment、branch、worktree、reviewer、completion reportを持つ。

## Deferred Decisions

- Control Planeの採用
- Runner type、OS、hosting、ephemeral policy
- Codex GitHub Action / `codex exec` / SDKの採用
- authentication方式とcredential store
- model、reasoning effort、sandbox、network policy
- transport envelopeと永続Schemaの要否
- exact timeout、retry回数、retention期間
- GitHub Environment、Runner Group、GitHub Appの採用
- logs / artifactsの保存先と保持期間
- multi-role dispatchとnext-role chaining

これらは本設計のReview後、Product Ownerまたは適切なArchitect Taskで決定する。未決定値をBackend Implementerが推測して実装してはならない。

## Implementation Acceptance Criteria

- PR #95 merged interfaceを変更せずExecution Adapterが`WorkerRunner`を実装できる。
- Dispatcher CoreがShell、Git、GitHub API、Codex credentialを持たない。
- approved Worker AssignmentだけがExternal Runnerを一回起動する。
- dedicated branch / worktreeをcreate-onlyで使用し、mainを直接変更しない。
- Worker processとGitHub Publisherでcredentialが分離される。
- allowed / forbidden changesとvalidationを通過しない変更をpushしない。
- normal pushとDraft PRだけを許可し、force push、merge、revertを行わない。
- `WorkerExecutionResult`、`ProvisionalHandoff`、`CanonicalResultHandoff`を混同しない。
- Canonical保存確認とread-after-write成功前にcompletedにしない。
- duplicate、timeout、cancel、publication retryがidempotentである。
- unapproved、fork、external actor、prompt injectionでRunnerまたはSecretが起動しない。

## Official Capability References

Technology candidatesの実装可能性は、2026-07-19時点で次の公式一次資料を確認した。

### GitHub

- [Triggering a workflow](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)
- [GitHub-hosted runners](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)
- [Self-hosted runners reference](https://docs.github.com/en/actions/reference/runners/self-hosted-runners)
- [Self-hosted runners concepts](https://docs.github.com/en/actions/concepts/runners/self-hosted-runners)
- [Manage access to self-hosted runners](https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners/manage-access)
- [Use GITHUB_TOKEN for authentication](https://docs.github.com/en/actions/tutorials/authenticate-with-github_token)
- [Deployments and environments](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments)
- [Secure use reference](https://docs.github.com/en/actions/reference/security/secure-use)

### OpenAI

- [Codex GitHub Action](https://learn.chatgpt.com/docs/github-action.md)
- [Codex non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode.md)
- [Codex SDK](https://learn.chatgpt.com/docs/codex-sdk.md)

Capabilityは変動し得るため、後続Implementation開始時に再確認する。

## Explicit Non-implementation Confirmation

本設計では次を実施していない。

- Workflow YAML作成
- GitHub Actions実装
- Runner登録、Provisioning、Service化
- Codex CLI / SDK / Action integration
- SecretまたはToken登録
- Dispatcher、Adapter、Publisher code変更
- JSON Schema変更
- Existing Run、Research Data、Research Artifact変更
- PR #91、PR #93、PR #95 Contract変更
- Merge
