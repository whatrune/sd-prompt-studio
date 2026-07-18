# Dispatch MVP Implementation Design

## Status

- Design version: `0.1.0`
- Status: freeze-ready candidate
- Role: Backend Architect
- Canonical Task Assignment: [Issue #92](https://github.com/whatrune/sd-prompt-studio/issues/92)
- Normative Contract: PR #91 merge commit `ebe727270647cc13e5e610d7746e0ef5866928da`
- Implementation status: not implemented

## Purpose

PR #91でFreezeされたIntegrated Dispatch Automation Contractを、Backend ImplementerがContract判断なしでWorker Runner MVPへ実装できるComponent、Data Flow、権限、Failure、Testの境界へ落とす。

本書はImplementation Designであり、Automation Scope、Role権限、Human Gate、Status、Result Handoffの意味を変更しない。

## Normative Boundary

Normative Input:

- [`00-automation-overview.md`](00-automation-overview.md)
- [`01-dispatch-contract.md`](01-dispatch-contract.md)
- [`02-role-runner-mapping.md`](02-role-runner-mapping.md)
- [`03-approval-gate.md`](03-approval-gate.md)
- [`04-security-boundary.md`](04-security-boundary.md)
- [`05-automation-handoff-contract.md`](05-automation-handoff-contract.md)
- [`../team/04-worker-charter.md`](../team/04-worker-charter.md)
- [`../team/05-worktree-and-branch-rules.md`](../team/05-worktree-and-branch-rules.md)
- [`../team/11-delegation-and-result-contract.md`](../team/11-delegation-and-result-contract.md)

Boundary:

- PR #91: 何を自動化してよいかを定義するAutomation Contract
- Draft PR #93（本書）: そのContractを実装可能なComponentへ分割するImplementation Design
- 後続PR: Workflow、Dispatcher、Runner integration、Test、Provisioningの実装

実装上PR #91の変更が必要になった場合、Backend Implementerは補完せずArchitect Teamへ返却する。

## Task Identity Contract

`task_id`はGitHub上の保存先やExecution回数に依存しない業務単位の正本である。Issue番号、PR番号、`execution_id`はそれぞれ異なるLifecycle上の参照または実行識別子であり、`task_id`の代用にしない。

現在の設計Taskは次へBindingする。

| Identity | Value | Responsibility |
| --- | --- | --- |
| Task | `task_id: ARCH-DISPATCH-001` | 業務単位の安定したIdentity |
| Assignment | [GitHub Issue #92](https://github.com/whatrune/sd-prompt-studio/issues/92) | Canonical Task Assignmentの保存先 |
| Result | [Draft PR #93](https://github.com/whatrune/sd-prompt-studio/pull/93) | Design DiffとResult Handoffの保存先 |
| Execution | 将来DispatcherがExecutionごとに生成する`execution_id` | 同一Task内の個別実行、retry、timeout、cancelの識別 |

規則:

- Assignment、Execution、Resultは分離して照合可能にする。
- GitHub Issue番号またはPR番号だけをTask Identityとして扱わない。
- Canonical Locationの移動、PR再作成、再実行によって`task_id`を変更しない。
- 同一Taskを再実行する場合、`task_id`を維持し、新しい`execution_id`を割り当てる。
- Assignment revision digestは承認対象Snapshotを識別するが、`task_id`そのものではない。
- `execution_id`の生成形式と永続Schemaは将来Implementation Decisionであり、本PRでは追加しない。

## MVP Scope

対象Flowは一回のWorker Taskに限定する。

```text
Approved Canonical Task Assignment
        ↓
Dispatcher Admission
        ↓
Execution Lock
        ↓
Worker Runner one-shot execution
        ↓
Change Policy and Validation
        ↓
Normal push and Draft PR
        ↓
Canonical Result Handoff
        ↓
Integrated Lead Verification
```

対象Role:

- Worker Runnerのみ

対象外:

- Architect、Backend、Frontend、Research Runner
- 次Roleの自動Dispatch
- 自動Approve、Merge、Revert
- Contract、Scope、Product、Research判断
- Existing RunまたはResearch Artifactの破壊的変更

## Architecture Boundary

### Integrated Lead

- Canonical Task Assignmentを作成する。
- Worker RoleへRoutingする。
- Result Handoff、Diff、Validationを確認する。
- Product Ownerへ統合報告する。

### Dispatcher

- Assignmentを取得してAdmissionを実行する。
- Execution Lockと`dispatch_state`を管理する。
- Worker Runnerへ一回の起動要求を渡す。
- timeout、cancel、process resultを監視する。
- HandoffをCanonical Locationへ保存して返す。

Dispatcherは実行管理Roleであり、次を行わない。

- Workerまたは他の専門Roleの作業
- Architecture判断
- Contract変更または未定義Contractの補完
- Product判断
- Research判断またはObservation判断
- Assignment Scopeの変更または拡大
- Merge、Approve、Revert判断

### Worker Runner

- [`../team/04-worker-charter.md`](../team/04-worker-charter.md)にBindingされたPrompt Sourceで作業する。
- 専用branch/worktree内でAssignment対象だけを変更する。
- 指定Validation Profileを実行する。
- Structured Execution ResultとResult Handoff素材を返す。

Worker RunnerはAdmission、Role変更、Approval、次Role選択を行わない。

## Component Design

| Component | Responsibility | Must not do |
| --- | --- | --- |
| Trigger Adapter | Issue Label eventを内部Admission Requestへ変換 | Issue本文をShellとして実行 |
| Assignment Loader | Canonical IssueからAssignment全文とrevisionを取得 | 欠落Fieldを推測補完 |
| Admission Validator | repository、Actor、Approval、Role、Field、revisionを検証 | ProductまたはContract判断 |
| Role Resolver | `Worker`とWorker Runner Profileを完全一致でBinding | 未対応Roleへのfallback |
| Lock Manager | repository / task_id / branchの排他とExecution ID管理 | running Taskの自動cancel |
| Workspace Manager | create-only branch/worktree、base revision、cleanupを管理 | shared worktree、force push、auto rebase |
| Worker Launcher | Trusted Promptとvalidated contextで一回実行 | GitHub publish権限の保持 |
| Change Policy Gate | allowed / forbidden pathとDiff境界を確認 | Scope外Diffの自動修正 |
| Validation Runner | version管理されたProfileだけを実行 | Assignment自由記述Commandの実行 |
| Publisher | 検証済み変更のnormal pushとDraft PR作成 | Merge、Approve、Revert |
| Handoff Publisher | Handoff投稿、Canonical URL確定、idempotent再投稿 | 投稿失敗をcompleted扱い |
| State Reporter | Dispatch state transitionと失敗Ownerを記録 | 専門成果物のApprove |
| Audit Logger | sanitized event、時刻、identity、結果を記録 | Secret、個人Path、full credentialの保存 |

Componentは論理境界であり、Process、Job、Module、Serviceの具体分割はTechnology Decision後に確定する。

## Input and Output Boundary

### Trusted Control Input

- fixed repository identity
- Canonical Task Assignment URL
- Assignment revision digest
- `task_id`
- `assigned_role == Worker`
- Approval LabelとRole Label
- Approval Actor identity
- approved base revision
- allowed / forbidden changes
- validation profile identifier
- timeout / retry profile identifier

Issue自由記述はContextとして扱えても、Command、Role、Permission、Validation定義として扱わない。

### Internal Execution Plan

Admission成功後、Dispatcherは一回のExecutionに必要なimmutable planを構築する。

- execution ID
- Assignment revision digest
- repository and base revision
- branch name and logical worktree identity
- Worker Role Contract revision
- allowed path set
- validation profile
- timeout and retry limit

これは内部実装表現であり、本PRでは永続Schemaを追加しない。

### Runner Output

- process exit result
- final structured messageまたはmachine-readable event stream
- changed-file list and patch
- validation results
- unresolved items
- proposed Result Handoff fields

Runner Outputを直接publishせず、Change Policy GateとValidation Runnerを通過させる。

### Published Output

- task branch
- commit SHA
- Draft PR URL
- Canonical Result Handoff URL
- sanitized execution record reference
- terminal dispatch state

## Logical Workflow Design

選択するTechnologyにかかわらず、次の権限分離を維持する。

### Step 1: Trigger

Input:

- Canonical Issue event
- `dispatch:approved`
- `dispatch:worker`

Process:

- repository、event source、Label名をexact matchする。
- event発生ActorとIssueをAdmission Requestへ渡す。

Output:

- untrusted Admission Request

Failure:

- fork、外部Repository、対象外Labelは実行せず終了する。

### Step 2: Admission Check

Input:

- Admission Request
- Canonical Assignment
- version管理済みallowlistとRole Mapping

Process:

- Required Field、Canonical URL、Actor、Approval、Role、revision、baseを検証する。
- Assignment本文のdigestを固定する。

Output:

- immutable Execution Planまたは`blocked` result

Failure:

- Runnerを起動せず、可能ならblocked Handoffを投稿する。

### Step 3: Lock Acquisition

Input:

- repository / task_id / target branch

Process:

- 同じLock Keyのqueued/running/completed revisionを確認する。
- Execution IDとlock ownershipを記録する。

Output:

- owned lockまたはduplicate result

Failure:

- running時は新規実行も既存cancelも行わず`blocked`。
- completed同一revisionは既存Handoffを返す。

### Step 4: Workspace Preparation

Input:

- approved base revision
- task ID and Worker branch naming rule

Process:

- clean checkoutからcreate-only task branchと専用worktreeを用意する。
- branch/worktreeの既存所有を確認する。

Output:

- isolated workspace

Failure:

- dirty、branch existing、worktree collisionは`blocked`。
- approved base revisionと現在baseが不一致の場合は`stale`。

### Step 5: Worker Execution

Input:

- trusted Worker Prompt Source
- sanitized Assignment context
- isolated workspace
- least-privilege Codex credential boundary

Process:

- Worker Runnerを一回起動する。
- timeoutとcancelを監視する。
- GitHub write credentialは渡さない。

Output:

- patch、changed files、structured result

Failure:

- process failureは`failed`、timeoutは`timed_out`。partial resultを保持可能にする。

### Step 6: Change Policy and Validation

Input:

- Runner patch
- allowed / forbidden changes
- validation profile

Process:

- patchをSecretなしの隔離Workspaceへ適用する。
- path、symlink、submodule、forbidden fileを検証する。
- version管理されたValidation Profileを実行する。

Output:

- verified patch and validation report

Failure:

- Scope違反またはValidation failureはpublishせず`failed`。

### Step 7: Publish

Input:

- verified patch
- Gate 2 publish authorization
- task branch

Process:

- allowed filesだけをstageする。
- normal commitとnormal pushを行う。
- Draft PRをcreate-onlyで作る。
- OpenAI/Codex credentialは渡さない。

Output:

- commit SHA and Draft PR URL

Failure:

- push rejectionまたはPR creation failureは`completed`にしない。
- retryは同一branch / commit / idempotency keyで行い、二重PRを作らない。

### Step 8: Handoff and Final State

Input:

- execution result、Diff、Validation、commit、PR URL

Process:

- PR #91のAutomation Handoff fieldsを既存Result Handoffへ追加する。
- GitHub Canonical Locationへ保存しURLを確定する。
- Assignment revisionが変化していないことを再確認する。

Output:

- Canonical Result Handoff and terminal state

Failure:

- Handoff投稿失敗時は実行が成功していても`completed`にしない。

## Git and Worktree Design

### Isolation Invariant

- 1 `task_id`
- 1 primary Role
- 1 task branch
- 1 active worktree per Execution

同一Taskのretryでは`task_id`とtask branchを維持し、新しい`execution_id`とcreate-only worktreeを使う。異なるTaskまたはRoleでbranch/worktreeを共有しない。

### Branch Naming

PR #87の形式を維持する。

```text
codex/worker-<task-id-lower>-<slug>
```

Branch名はDispatcherが自由生成せず、task ID、Role、sanitized slugから決定的に作る。`main`、既存branch、予約prefixへのfallbackを禁止する。

### Worktree Identity

```text
<runner-task-root>/<task-id>/<execution-id>
```

絶対PathはArtifact IdentityやCanonical Research Dataへ保存しない。Handoffにはsanitized logical identityだけを記録する。

### Creation and Cleanup

- AdmissionとLock取得後、Worker実行前にcreate-onlyで作成する。
- Existing branch/worktreeは上書きまたは削除しない。
- Handoff保存とprocess終了確認後にtemporary workspaceをcleanupできる。
- failure、cancel、timeoutでprocess ownership不明の場合、自動cleanupせずblockedとして残す。
- branch、commit、Draft PRはAudit対象のため自動削除しない。

### Concurrency

- Lock Key: repository identity + task ID + target branch
- same key: 最大1 running execution
- global Worker MVP concurrency: Provisioning Decision Required
- `cancel-in-progress`: false相当を要求
- 同一revisionの重複Trigger: no-op and existing Handoff reference

## Security Design

### Credential Separation

1つのExecution ComponentにCodex credentialとGitHub write credentialを同時に渡さない。

- Admission: repository / Issue readだけ
- Worker Execution: Codex credential、GitHub contents read、GitHub writeなし
- Validation: Secretなし
- Publish: GitHub branch / pull request write、Codex credentialなし
- Handoff: Issue / pull request write、Codex credentialなし

### Secret Boundary

- Secret値、名前、発行、rotation、登録先はProvisioning Taskへ延期する。
- SecretをPrompt、CLI argument、job-wide environment、Log、Patch、Handoffへ含めない。
- Credentialを必要とするProcessだけへ短いscopeで渡す。
- Secret access前にApproval Gateを通過させる。

### Token Permission Policy

- default deny / read-onlyを基準とする。
- JobまたはProcess単位で必要なGitHub permissionだけを付与する。
- Write Tokenをuntrusted repository codeやWorker processへ渡さない。
- `main`へのwriteをserver-side protectionでも拒否する。
- GITHUB_TOKENで不足する場合のみGitHub Appを候補とし、PATを暗黙fallbackにしない。

### Command Restriction

- Assignmentにraw shell commandを保存または実行させない。
- `validation`はversion管理されたProfile IDへBindingする。
- repository scriptを実行するJobへCodex credentialやGitHub write credentialを渡さない。
- issue body、title、label、branch文字列をShell sourceとして評価しない。

### Actor and Repository Validation

- Repository full nameをallowlistとexact matchする。
- Issueが同一Repositoryのopen Issueであることを確認する。
- Label event Actorを承認Actor allowlistと照合する。
- Issue authorだけをApproval根拠にしない。
- fork、pull request、repository dispatchをIssue Triggerの代用にしない。
- Approval後のIssue編集は`stale`として再承認を要求する。

## Logging and Audit Design

記録対象:

- task / execution ID
- Assignment URL and revision digest
- role / runner identity
- dispatch state transitions and timestamps
- base / branch / commit / PR URL
- validation profile and summarized results
- retry count、timeout、cancel、failure category
- Handoff URL

記録禁止:

- API key、Token、auth file
- full environment dump
- 個人の絶対Path
- Secretを含むstdout / stderr
- full promptまたはfull transcriptの無条件保存

Raw outputはsanitization前にpublishしない。保持期間とArtifact storeはDecision Requiredとする。

## Failure Handling Design

| Failure | Dispatch result | Required action |
| --- | --- | --- |
| Assignment / canonical record missing | `blocked` | Runnerを起動せずIntegrated Leadへ返す |
| Approval / Actor / Permission invalid | `blocked` | Secretとwrite tokenを渡さない |
| Role mismatch / unsupported Role | `blocked` | Workerへfallbackしない |
| Contract conflict | `blocked` | Architect TeamへEscalate |
| Lock or worktree conflict | `blocked` | Existing stateを変更しない |
| Runner process failure | `failed` | partial resultとlast stepをHandoffへ記録 |
| Timeout | `timed_out` | process停止確認、partial result、retry ownerを記録 |
| Scope violation | `failed` | publishしない |
| Validation failure | `failed` | publishしない、結果をHandoffへ記録 |
| Push permission denial | `blocked` | 権限を拡大せずOwnerへ返す |
| Push remote-state conflict | `stale` | force pushせずbaseとremote branchを再確認する |
| Push API / network failure after bounded retry | `failed` | 同一commitを保持し、retry可否を記録する |
| Draft PR permission denial | `blocked` | 権限を拡大せずOwnerへ返す |
| Draft PR API failure after bounded retry | `failed` | 同一commitでidempotent retry可能にする |
| Handoff publication failure after bounded retry | `failed` | PRを重複作成せずHandoffだけ再投稿する |
| Cancel | `cancelled` | 新規変更停止、processとlockを確認 |

Result Handoffの`status`は既存Vocabularyを使う。`timed_out`はExecution Statusであり、対応するResult Handoffは`failed`とする。必須処理未完了を`completed`としてはならない。

## Technology Decision Candidates

各候補は実装可能性を示すもので、採用をFreezeしない。

### Control Plane

Decision: Trigger、Admission、state、job separationを実行するControl Plane

Candidate: GitHub Actions

Reason: Issue `labeled` event、job-level permissions、concurrency、Environment approval、run auditを利用できる。Repositoryの既存GitHub運用と整合しやすい。

Risk: Workflow変更自体が高権限Supply-chain surfaceになる。Artifact経由のjob分離とAction SHA pinが必要。

Deferred: Workflow構成、Action SHA、Environment、permission exact set、ActionsによるPR作成設定。

Candidate: GitHub App + Webhook / Local Service

Reason: 独自state、installation token、複数step orchestrationを制御しやすい。

Risk: 常駐Service、Webhook検証、Database、監視、patch適用を新規運用する必要がありMVPを拡大する。

Deferred: MVP後。GitHub Actionsで満たせない要件が確認された場合に再評価。

### Execution Runner

Decision: Worker processを隔離して実行するRunner

Candidate: GitHub-hosted runner

Reason: 一時的なclean環境、監査可能なjob、個人PCとOneDriveへの非依存がMVP Security Boundaryに合う。

Risk: Local-only Artifactや既存local worktreeを利用できず、minutes、image更新、network制約へ依存する。

Deferred: OS image、size、cost、parallelism、required tools。

Candidate: isolated self-hosted runner

Reason: Local toolchain、長時間Task、private networkを制御できる。

Risk: Repositoryがpublicであり永続侵害、別Task汚染、個人file access、maintenance負荷が大きい。通常の個人PCをMVP Runnerにしない。

Deferred: 専用User / VM / ephemeral provisioningとsecurity reviewが成立する将来段階。

### Codex Invocation

Decision: Worker RunnerからCodexを非対話実行する公式Interface

Candidate: OpenAI Codex GitHub Action

Reason: GitHub Actions内でCLI install、credential proxy、sandbox、structured outputへ接続できる。OpenAIはGitHub Actionsで直接CLI認証する代わりにActionを推奨している。

Risk: Action version、safety strategy、prompt input、output handlingを固定する必要がある。Windowsでは安全戦略上の制約がある。

Deferred: Action full SHA、Codex version、model / effort、sandbox、output schema。

Candidate: `codex exec`

Reason: 非対話、sandbox、JSONL、final output、structured outputを利用でき、GitHub Actions以外でも実行可能。

Risk: CLI install、version pin、credential process、event parsing、process terminationをDispatcher側で実装する必要がある。

Deferred: exact flags、CLI version、authentication、exit-code mapping。実装時の公式helpとdocsで再確認する。

Candidate: Codex SDK

Reason: Thread、result、programmatic orchestrationをApplication codeから制御できる。

Risk: Service codeとstate managementが増え、one-shot Worker MVPには過大である。

Deferred: multi-role chainingまたは長期thread要件がFreezeされた将来段階。

### GitHub Write Identity

Decision: task branch push、Draft PR、Handoff投稿のGitHub identity

Candidate: job-scoped `GITHUB_TOKEN`

Reason: GitHub Actions採用時に短命で、job-level least privilegeを設定できる。

Risk: Repository設定によってPR作成が制限される。write jobでuntrusted codeを実行してはならない。

Deferred: exact permissions、PR creation setting、branch protection。

Candidate: GitHub App installation token

Reason: 権限とrepository scopeを明確化し、automation identityを分離できる。

Risk: App登録、private key、installation、rotation、additional secret handlingが必要。

Deferred: `GITHUB_TOKEN`でAcceptance Criteriaを満たせない場合にProvisioning Taskで判断。

## Official Capability References

- [GitHub Actions event reference](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#issues)
- [GitHub Actions concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency)
- [GitHub Actions secure use](https://docs.github.com/en/actions/reference/security/secure-use)
- [GitHub Environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments)
- [GitHub token permissions](https://docs.github.com/en/actions/security-for-github-actions/security-guides/automatic-token-authentication)
- [OpenAI Codex GitHub Action](https://learn.chatgpt.com/docs/github-action.md)
- [OpenAI Codex non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode.md)
- [OpenAI Codex SDK](https://learn.chatgpt.com/docs/codex-sdk.md)

Official references establish capability only. Exact versions、flags、permission names、availabilityはImplementation開始時に再検証する。

## Implementation Task Split

後続Implementationは少なくとも次へ分離する。

1. Admission Parser and Validator
   - Canonical Assignment取得、Actor、Label、Role、revision検証
2. State and Lock Manager
   - Execution ID、Lock Key、idempotency、cancel、timeout
3. Workspace and Git Manager
   - create-only branch/worktree、allowed path、normal push preparation
4. Worker Invocation Adapter
   - trusted prompt、Codex interface、structured result、process control
5. Change Policy and Validation Runner
   - patch containment、forbidden path、validation profile
6. Draft PR and Handoff Publisher
   - GitHub write separation、idempotent PR/Handoff publication
7. Workflow / Service Integration
   - selected Control PlaneでComponentを権限分離して接続
8. Provisioning and Operations
   - Runner、Environment、Secret、branch protection、runbook
9. Worker Pilot
   - approved non-destructive docs-only TaskによるEnd-to-End検証

各Taskは別Task AssignmentとReview Ownerを持つ。ProvisioningとSecret登録をCode Implementationへ混在させない。

## Decision Required Before Implementation

- Control Plane: GitHub ActionsまたはGitHub App / Service
- Runner: GitHub-hostedまたはisolated self-hosted
- Codex Interface: Codex Actionまたは`codex exec`
- GitHub write identity: `GITHUB_TOKEN`またはGitHub App
- Approval Actor allowlistとEnvironment reviewer
- validation profileの保存先と初期profile
- timeout、retry、global concurrency値
- output schemaを導入するか、導入する場合のversioning
- Log / artifact retentionとsanitization owner
- ActionsによるDraft PR作成設定とmain protection

これらはBackend Implementerが暗黙決定しない。

## Acceptance Criteria for the Future Implementation

- 未承認、Role不一致、fork、外部ActorではWorker processを起動しない。
- Worker processはGitHub write credentialを受け取らない。
- Publish processはCodex credentialを受け取らない。
- 同一Task revisionを二重実行または二重PR化しない。
- Scope外file、Validation failure、timeoutをcompleted扱いしない。
- `main`を直接変更せずforce pushしない。
- Draft PRとCanonical Handoffを作成し、Integrated Leadが機械的に照合できる。
- failure、cancel、timeoutから安全に再開またはEscalateできる。
- Runner、Workflow、Codex Interfaceを差し替えてもPR #91のContract意味を変更しない。

## Explicit Non-implementation Confirmation

本書では次を作成または変更しない。

- Workflow YAML
- Dispatcher / Runner / Bot / CLI / SDK code
- JSON SchemaまたはDatabase
- Runner、Service、Environment、Secret、Token
- Existing Run、Research Data、Research Artifact
- 自動Approve、Merge、Revert
