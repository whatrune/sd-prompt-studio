# Runner Provisioning Architecture Design

## Status

- Design version: `0.1.0`
- Status: Design review candidate
- Task Assignment: [Issue #100](https://github.com/whatrune/sd-prompt-studio/issues/100)
- Primary role: Backend Architect
- PR #99 input commit: `5370f6a1c70de4cd1e1c492985a40a5e6fddad33`
- Implementation status: not implemented
- Runner technology adoption: deferred

本書は、PR #99で実装されたExecution Adapter Coreを、将来のExternal Runnerと実際のAI実行環境へ安全に接続するためのProvisioning Architecture Designである。Runner、Workflow、Container、Secret、Codex CLI / SDK / Actionを実装または採用決定する文書ではない。

## Purpose

承認済みWorker Taskを、Task専用branch / worktree、限定されたcredential、sandbox、timeout、resource policyを持つexecution environmentで一回実行し、PR #99の`ExternalExecutionResult`へ戻せる境界を定義する。

## Normative and Input Boundaries

### Existing contracts

本設計は次を変更しない。

1. [`00-automation-overview.md`](00-automation-overview.md)
2. [`01-dispatch-contract.md`](01-dispatch-contract.md)
3. [`02-role-runner-mapping.md`](02-role-runner-mapping.md)
4. [`03-approval-gate.md`](03-approval-gate.md)
5. [`04-security-boundary.md`](04-security-boundary.md)
6. [`05-automation-handoff-contract.md`](05-automation-handoff-contract.md)
7. [`06-dispatch-mvp-implementation-design.md`](06-dispatch-mvp-implementation-design.md)
8. [`07-dispatch-mvp-test-design.md`](07-dispatch-mvp-test-design.md)
9. [`08-dispatch-execution-integration-design.md`](08-dispatch-execution-integration-design.md)
10. [`09-runner-security-design.md`](09-runner-security-design.md)

### PR #99 implementation input

[PR #99](https://github.com/whatrune/sd-prompt-studio/pull/99)はMerge済みであり、本設計が確認した`main` commitは`5370f6a1c70de4cd1e1c492985a40a5e6fddad33`である。

既存interface:

```text
ExecutionAdapter implements WorkerRunner
  run(WorkerRunContext) -> WorkerExecutionResult

ExternalRunner
  execute(Readonly<ExecutionRequest>, AbortSignal)
    -> Promise<ExternalExecutionResult>
  cancel(Readonly<ExecutionRequest>)
    -> Promise<void>
```

`ExternalExecutionResult.kind`は次の既存値だけを使う。

- `result`
- `failed`
- `contract_required`
- `unsupported`

本設計はField、kind、Result Status、Dispatch Stateを追加しない。

## Scope

定義対象:

- Runner layerの分離
- provisioning lifecycle
- execution host候補とdesign recommendation
- Codex runtime候補とinterface適合性
- branch / worktree ownership
- credential separation
- sandbox、network、command、process、resource policy
- timeout、cancel、cleanup、failure handling
- observabilityとCanonical Recordの関係
- implementation splitとtest design

対象外:

- Workflow YAML
- GitHub Actions job
- self-hosted runner登録
- Local ServiceまたはWindows Service
- Container imageまたはVM image
- Codex CLI / SDK / GitHub Action wrapper
- Secret、Token、GitHub Environment設定
- Code、Schema、Research Data、Existing Run、Research Artifact
- Product、Contract、Research判断
- Merge

## Runner Terminology

“Runner”を一つの責務として扱わない。

| Layer | Meaning | Example | Owner |
| --- | --- | --- | --- |
| Control Plane Scheduler | Taskをexecution hostへ割り当てる | GitHub Actions scheduler、local dispatcher service | Trigger / provisioning integration |
| Execution Host | OS、filesystem、network、resourceを提供する | GitHub-hosted VM、ephemeral self-hosted VM、container host | Runner Provisioner |
| Task Workspace | task branch / worktreeを隔離する | contained Git worktree、ephemeral checkout | Workspace Manager |
| Agent Runtime | AI processを実行する | `codex exec`、Codex SDK、Codex Action | PR #99 `ExternalRunner` implementation |
| Publisher | validated changeをGitHubへ保存する | Git Publisher / Handoff Publisher | credential-separated publisher |

GitHub-hosted RunnerとPR #99の`ExternalRunner`は同じものではない。前者はExecution Host、後者はAgent Runtimeを呼び出すTypeScript Portである。

## Architecture Boundary

```text
Control Plane Scheduler
        |
        | trusted execution plan
        v
Runner Provisioner
        |
        | isolated Execution Host
        v
Workspace Manager
        |
        | task branch / worktree
        v
ExecutionAdapter
        |
        | ExecutionRequest + AbortSignal
        v
ExternalRunner implementation
        |
        | Codex CLI / SDK / workflow-native runtime
        v
ExternalExecutionResult
        |
        v
ExecutionAdapter -> WorkerExecutionResult
        |
        v
Validation and credential-separated Publisher
```

### Dispatcher Core

担当:

- Assignment Validation
- Dispatch State管理
- `WorkerRunner.run()`呼出し
- Provisional Result受領

禁止:

- Runner provisioning
- Shell実行
- Credential取得
- Sandbox管理
- GitHub Runner選択

### Execution Adapter

担当:

- validated Assignmentからimmutable `ExecutionRequest`生成
- `ExternalRunner.execute()`の一回呼出し
- configured timeout
- AbortSignal通知と`cancel()`要求
- `ExternalExecutionResult`から`WorkerExecutionResult`への既存mapping

禁止:

- Execution Host選択
- Runner registration
- Credential保存
- GitHub permission管理
- branch / worktree lifecycle判断
- Canonical Handoff finalization

### Runner Provisioner

Runner Provisionerはlogical capabilityであり、本PRでAPIを追加しない。

担当:

- approved runner profileの解決
- Execution Hostの取得またはprovision
- host identityとhealthの確認
- workspace root、sandbox、resource、network policyの適用
- Agent Runtimeに必要なshort-lived credentialの限定注入
- host release、quarantine、destruction判定

禁止:

- Assignment scope変更
- Worker結果の改変
- Product / Contract判断
- unavailable hostからpersonal PCへの暗黙fallback

### External Runner

担当:

- 現在Host上でAgent Runtimeを一回起動
- `ExecutionRequest`をversion-managed promptへbinding
- AbortSignalをprocess / SDK cancellationへ伝達
- `cancel(request)`でterminationを要求し、完了時だけresolve
- structured `ExternalExecutionResult`を返す

禁止:

- Provisioning technologyの選択
- GitHub write credential保持
- `main`編集、force push、merge
- Contract / Product / Research判断

## Current Interface Constraints

### No execution identity in `ExternalRunner`

`execute()`と`cancel()`は`ExecutionRequest`を受けるが、`execution_id`やrunner handleを受けない。このためv0.1.0 integrationは次を前提にする。

- 同一`task_id + canonical_record`にactive executionは一つだけ。
- External Runner implementationはrequest identityからactive process handleを内部管理する。
- `cancel()`はidempotentであり、別Task processを停止しない。
- process handleを一意に特定できない場合、termination未確認として`failed`を返す。

process restartをまたぐcancel、remote job recovery、同一Taskの並列attemptにexecution identityが必要な場合はArchitect Teamへ返却する。PR #99 interfaceをBackend Implementerが独自拡張してはならない。

### Provisioning context is not in `ExecutionRequest`

`ExecutionRequest`はTask boundaryを運ぶが、runner profile、OS、base SHA、worktree path、credential profileを含まない。これらはIssue free textから推測せず、Control Planeがapproved version-managed policyから解決し、External Runner constructorまたは別trusted contextへ渡す。

### Limited external diagnostics

`ExternalExecutionResult`は詳細なrunner referenceやexit codeを保持しない。v0.1.0ではCanonical Worker resultとoperational diagnosticを分離する。runner ID、host reference、start / end、exit categoryはsanitized operational evidenceとしてPublisherへ渡すが、PR #99 Result型へ無断追加しない。永続bindingが必要なら別Architect Contractとする。

## Design Recommendation

本書は採用をFreezeしないが、MVP review baselineとして次を推奨する。

```text
GitHub Actions Control Plane
        |
        v
GitHub-hosted Ubuntu VM per job
        |
        v
Dedicated task workspace
        |
        v
Process-isolated ExternalRunner candidate
        |
        v
Codex runtime
        |
        v
Patch / structured result artifact
        |
        v
Separate GitHub write job
```

理由:

- Repositoryはpublicであり、personal PC上のpersistent self-hosted runnerをuntrusted repository eventから隔離する設計負荷が大きい。
- GitHub-hosted runnerは通常jobごとに新しいVMを提供し、local OneDriveやpersonal credentialへ接続しない。
- OpenAIのautomation guidanceはCodex credentialを持つjobとGitHub write jobの分離を示している。
- PR #99のprocess-oriented `ExternalRunner.execute()`とAbortSignalは、一回のAgent processを制御する実装に適合しやすい。

推奨はProduct Owner承認前の採用決定ではない。Windows固有toolchainまたはprivate networkが必要と判明した場合は、専用VM上のephemeral self-hosted runnerを次候補とする。

## Runner Technology Comparison

### Candidate: GitHub-hosted Runner

Advantages:

- 通常jobごとに新しいmanaged VM
- public repositoryでstandard runnerを利用可能
- GitHub-native queue、job log、status、timeout
- personal PC、OneDrive、local credentialから隔離
- provisioning / patching負荷が低い

Risks:

- imageとpreinstalled toolが変動し得る
- local-only files / serviceへ接続できない
- Linux / macOS VMはpasswordless sudo、Windows VMはadministratorであり、Agent privilegeを別途縮小する必要
- job / storage / concurrency limit

Security Concerns:

- Codex credentialをrepository-controlled build / dependency scriptと同じjob environmentへ広く置かない。
- checkout credentialをpersistしない。
- Codex jobはread-only GitHub permission、writeは別job。

Operational Cost:

- host maintenanceは低い。
- workflow、artifact、credential、image pinの運用は必要。

Decision:

- MVP design recommendation。
- 採用未決定。

Deferred:

- exact OS image、runner size、timeout、artifact retention、cost budget。

### Candidate: Ephemeral self-hosted Runner

Advantages:

- custom OS / toolchain / network
- 専用VMまたはcontainer imageを管理可能
- one-job runnerによりcross-task residueを抑制可能

Risks:

- image build、registration、patch、update、log forwarding、destructionを運用側が担当
- public repository eventを誤routeするとhost compromise risk
- offline時はjobがqueueし、matching runnerがない状態が継続する

Security Concerns:

- dedicated user / VM、repository-scoped group、ephemeral registration、one-job destructionが最低条件。
- personal interactive accountとOneDrive rootを使用しない。
- persistent self-hostedへ暗黙fallbackしない。

Operational Cost:

- 中から高。
- Kubernetes環境がある場合はARC候補だが、本projectのMVP規模では過剰な可能性。

Decision:

- Windows固有要件またはprivate network要件がある場合のsecond candidate。
- 採用未決定。

Deferred:

- host platform、image pipeline、runner group、update cadence、log backend。

### Candidate: Persistent self-hosted Runner

Advantages:

- warm cache
- local toolchain再利用
- long-running serviceとの接続

Risks:

- cross-task contamination
- credential / process / file residue
- offline、patch、service account、quarantine負荷
- public repositoryからの危険なcode実行risk

Security Concerns:

- personal PCまたはinteractive userでの利用はMVP非推奨。
- dedicated host、task sandbox、egress control、cleanup verificationが必要。

Operational Cost:

- 継続的に高い。

Decision:

- MVP recommendationから除外。

Deferred:

- 専用hostが用意され、Security Reviewを通過した場合のみ再評価。

### Candidate: Local Runner / Local Service

Advantages:

- 既存local toolchainとworktreeを利用可能
- GitHub Actionsに依存しない

Risks:

- GitHub self-hosted runnerとは別implementationになる
- service availability、session、reboot、credential、audit、updateを独自管理
- personal files、OneDrive、他repositoryへのaccess risk

Security Concerns:

- current user sessionでの常駐は禁止候補。
- 専用OS user / VM / filesystem rootが必要。

Operational Cost:

- 中から高。

Decision:

- MVP recommendationから除外。

Deferred:

- offline-first operationがProduct Requirementになった場合のみ再評価。

### Candidate: Container Runner

ContainerはExecution Hostの追加sandbox layerであり、schedulerそのものとは限らない。

Advantages:

- pinned image
- filesystem / process / resource isolation
- disposable environment

Risks:

- host kernel共有
- bind mount、Docker socket、sibling container networkによるescape / lateral access
- Windows containerとLinux containerの差

Security Concerns:

- Docker socket mount、privileged mode、host home mountを禁止候補とする。
- workspaceだけを限定mountし、read / writeを明示する。

Operational Cost:

- image build / scan / updateが必要。

Decision:

- GitHub-hostedまたはephemeral self-hosted上の追加sandbox候補。
- 単独で完全なsecurity boundaryとはみなさない。

Deferred:

- runtime、base image、rootless、seccomp、resource options。

### Candidate: Other Sandbox Runtime

候補例はephemeral VM、microVM、remote agent sandboxである。

Decision:

- 現時点では具体productをNormative化しない。

Deferred:

- isolation requirementがcontainerを超える場合に別Architecture Taskで比較する。

## Execution Runtime Comparison

### Codex GitHub Action

Interface fit:

- GitHub Actions workflow-nativeであり、CLI installation、API proxy、`codex exec` invocationを統合する。
- しかしPR #99のin-process `ExternalRunner.execute()`から別workflow stepを同期呼出しする自然なPortではない。
- 利用する場合はWorkflow全体をExternal Runner boundaryとして構成し、PR #99 Coreとのdata handoffを別途設計する必要がある。

Result:

- final message、output file、`--output-schema`経由のstructured output候補。

Timeout / Cancel:

- Workflow job timeout / cancellationとAction process terminationに依存する。
- PR #99 `cancel(request)`とのconfirmation bridgeが必要。

Credential:

- ActionがAPI proxyとsafety strategyを提供する。
- OpenAIはGitHub Actionsでは直接CLI authよりActionを推奨している。

Decision:

- Security fitは高いが、PR #99 interface fitの追加検証が必要。

### Codex CLI (`codex exec`)

Interface fit:

- child processとして`execute()` Promiseへmappingしやすい。
- AbortSignalでprocess tree terminationを開始できる。
- stderr progress、stdout final message、JSONL、output schemaを利用可能。

Result:

- machine-readable outputをExternalExecutionResultへparse可能。
- human logとfinal structured resultを分離する。

Timeout / Cancel:

- process handleをExternal Runnerが保持し、cancelはchild process tree終了確認後にresolveする。

Credential:

- non-GitHub automationでは`CODEX_API_KEY`をsingle invocationだけへ渡す候補。
- GitHub Actionsで直接CLIを使う場合は、Codex Actionよりcredential exposure責任が増える。

Decision:

- PR #99 Portへの最良fit候補。
- GitHub Actions採用時のsecurity exception reviewが必要で、採用未決定。

### Codex SDK

Interface fit:

- TypeScript server-side integrationはPromise-based `execute()`へ適合可能。
- multi-turn、thread resume、programmatic orchestrationに強い。

Result:

- application内でstructured responseを扱いやすい。

Timeout / Cancel:

- 採用versionの公式cancellation capabilityをImplementation開始時に再確認する。
- 未確認のcancel APIをContractへ固定しない。

Credential:

- SDK processとrepository codeのcredential boundaryを設計する必要。

Decision:

- v0.1.0 one-shot executionにはscopeが広く、deferred candidate。

### GitHub Actions Job

GitHub Actions JobはAgent RuntimeではなくControl Plane / Execution Host envelopeである。Codex Action、CLI、SDKのいずれかを内包する。`ExternalRunner`と同義にしない。

### Other Agent Runtime

PR #99が期待するstructured result、timeout、cancel、credential isolationを満たし、Role Contractを変更しないものだけを将来候補とする。具体Runtimeは本書で予約しない。

## Runner Lifecycle Design

### Step 1: Provision

Input:

- admitted task identity
- approved runner profile
- repository、base SHA、role
- resource and security policy

Process:

- schedulerがmatching hostを要求する。
- Provisionerがhost identity、image version、health、capacityを確認する。
- one active execution lockを取得する。

Output:

- isolated host lease
- logical runner ID
- lifecycle state `provisioned`

Failure:

- unavailable / offline / profile mismatchは`blocked`。
- personal PCや別profileへfallbackしない。

### Step 2: Prepare Workspace

Input:

- host lease
- exact repository and base SHA
- deterministic task branch / workspace identity

Process:

- checkout credentialをwrite-disabledかつnon-persistentにする。
- exact base SHAを取得する。
- dedicated task workspaceをcreate-onlyで準備する。
- containment、symlink、junction、nested repository、dirty stateを検査する。

Output:

- clean task workspace
- workspace evidence

Failure:

- dirty、collision、containment failure、base mismatchは`blocked`。
- reset、delete、overwriteしない。

### Step 3: Execute

Input:

- immutable `ExecutionRequest`
- task workspace
- version-managed Role prompt
- Agent Runtime configuration
- execution-only credential

Process:

- `ExternalRunner.execute(request, signal)`を一回実行する。
- command、network、filesystem、resource policyを適用する。
- process handleをrequest identityへbindingする。

Output:

- raw structured Agent result
- sanitized operational diagnostic

Failure:

- runtime errorは`failed`。
- unsupported requestは`unsupported`。
- Contract判断が必要なら`contract_required`。

### Step 4: Collect Result

Input:

- runtime output
- process exit / termination evidence

Process:

- human logとstructured resultを分離する。
- output size、encoding、schema、secret redactionを確認する。
- PR #99の`ExternalExecutionResult`へmappingする。

Output:

- `ExternalExecutionResult`

Failure:

- malformed、truncated、secret-contaminated outputは`failed`。

### Step 5: Validate

Input:

- workspace diff
- Assignment boundaries
- approved validation profile

Process:

- credential-free validation zoneでallowed / forbidden pathとcommandsを検査する。
- required validationを実行する。
- Execution Adapterとは別にpublication eligibilityを判定する。

Output:

- validation evidence
- publishable patchまたはfailed result

Failure:

- scope / validation failureは`failed`、GitHub write credentialを渡さない。

### Step 6: Cleanup

Input:

- process termination state
- host / workspace ownership
- result / diff / log preservation state
- retention policy

Process:

- process tree終了を確認する。
- credentialをexpire / revokeする。
- temporary files、session、cacheをpolicyに従い除去する。
- ephemeral hostをrelease / destroyする。

Output:

- cleanup result
- releasedまたはquarantined host

Failure:

- termination / cleanup未確認はhostをquarantineし、次Taskへ割り当てない。
- evidenceを失う強制削除を行わない。

## Workspace and Git Boundary

### Owners

| Item | Creation owner | Mutation owner | Cleanup owner |
| --- | --- | --- | --- |
| task branch | Workspace Manager | task execution then Publisher after validation | Git retention policy owner |
| task workspace / worktree | Workspace Manager | External Runner within allowed paths | Runner Provisioner / Operations |
| base SHA binding | Admission / Workspace Manager | immutable | none |
| commit | Git Publisher | immutable after push | none |
| Draft PR | Git Publisher | Handoff Publisher for body/comment only | Product Owner decision |

### Rules

- `main`直接編集禁止。
- force push禁止。
- shared mutable workspace禁止。
- 他Task workspace利用禁止。
- exact base SHA固定。
- branch / workspaceの同時ownerは一execution。
- conflict、remote advance、dirty stateを自動rebase / resetで解消しない。

GitHub-hosted jobのsingle checkoutをTask Workspaceとして使う構成と、明示`git worktree`を作る構成のどちらも候補である。既存Contractの一Task一workspace isolation、deterministic identity、main非編集を満たす必要がある。具体Git commandはPR101で決定する。

## Credential Boundary

### Credential classes

| Credential | Holder | Purpose | Must not coexist with |
| --- | --- | --- | --- |
| execution credential | Agent Runtime process only | Codex execution | GitHub write credential |
| repository read credential | checkout / fetch step only | exact base取得 | untrusted Agent process where avoidable |
| GitHub write credential | Publisher only | task branch push、Draft PR、Handoff | execution credential、repository scripts |
| runner registration credential | Provisioning plane only | ephemeral runner registration | Task workspace / Agent Runtime |

### Rules

- Runnerに不要なpermissionを渡さない。
- Git Publisherだけがwrite可能。
- SecretをPrompt、argument、job-wide environment、log、artifact、PR、Handoffへ出力しない。
- token値、secret registration方式、exact permission設定値は本書で決定しない。
- credential取得失敗は`blocked`。権限を拡大してretryしない。
- public repositoryではChatGPT-managed `auth.json` persistenceをMVP候補にしない。

## Sandbox and Resource Policy

詳細Threat Modelは[`11-runner-security-model.md`](11-runner-security-model.md)に定義する。

### File access

- writeはtask workspaceだけ。
- repository外readはdeny by default。
- home、OneDrive root、credential store、他worktree、system configを非公開。
- symlink / junction escapeを拒否。

### Network

- deny by default。
- Agent Runtime API endpoint、GitHub read/write、package registryはprocess / phaseごとにallowlist候補。
- publisher networkとexecution networkを分離。
- local daemon、metadata service、private subnetへのaccessを禁止候補。

### Command

- Issue本文をShell化しない。
- version-managed Role promptとvalidation profileを使う。
- process APIへargument arrayで渡す。
- arbitrary `sudo`、privileged container、Docker socket、shell profile loadingを禁止候補。

### Process

- one execution process tree per request identity。
- timeout / cancelでtree terminationを確認。
- background process残留でhost quarantine。

### Resource

- wall-clock timeout
- maximum output / artifact size
- CPU、memory、disk quota候補
- process count候補
- network transfer budget候補

具体値はRunner typeとMVP workload計測後に決定する。本書で数値をFreezeしない。

## Timeout and Cancellation

PR #99の`ExecutionAdapterOptions.timeout_ms`がAgent execution timeoutを提供する。Provisioning、workspace、validation、publicationは別timeoutを持つ。

Timeout sequence:

1. AdapterがAbortSignalを発火。
2. External Runnerがgraceful terminationを開始。
3. `cancel(request)`がexact active handleへtermination要求。
4. process tree終了確認後に`cancel()` resolve。
5. 確認できなければtermination未確認として`failed`。
6. Hostをquarantineし、次Taskへ再利用しない。

Cancellationを`completed`へ変換しない。`timed_out`または`cancelled`を新Result Statusとして追加せず、既存Contractに従い`failed`とsanitized reasonを使う。

## Failure Handling

| Failure | Existing result mapping | Host action | Owner |
| --- | --- | --- | --- |
| Provision failure | `blocked` | release incomplete lease | Operations / Provisioner |
| Runner unavailable / offline | `blocked` | no fallback | Operations |
| Workspace collision / dirty | `blocked` | preserve and stop | Workspace owner |
| Credential missing / denied | `blocked` | do not broaden permission | Credential owner |
| Unsupported runtime/profile | `unsupported` -> `blocked` | no execution | Backend Architect |
| Contract decision required | `contract_required` -> `blocked` | no execution | Architect Team |
| Agent runtime failure | `failed` | preserve sanitized evidence | Backend Implementer / Operations |
| Timeout | `failed` | terminate or quarantine | Operations |
| Cancel failure | `failed` | quarantine | Operations |
| Security violation | `blocked` | revoke, quarantine, escalate | Security / Product Owner |
| Invalid structured result | `failed` | preserve safe diagnostic | Backend Implementer |
| Validation failure | `failed` | no publish | Implementer |
| Cleanup failure | `needs_followup` or `failed` per existing workflow context | quarantine | Operations |

新しいCanonical Statusは追加しない。

## Observability

### Required operational fields

- execution ID or Control Plane run reference
- task ID
- Assignment canonical record
- assignment revision if available
- logical runner ID / runner profile
- sanitized host image version
- start / end time
- lifecycle step
- result reference
- failure category
- cancel / timeout / cleanup result
- retry count

### Canonical relationship

Databaseは本PRで実装しない。Operational evidenceはGitHub workflow run、restricted runner log、artifact referenceの候補であり、Canonical Result Handoffにはdirect referenceとsanitized summaryだけを保存する。

local absolute path、username、host name、credential identifier、raw environmentをCanonical Recordへ保存しない。

PR #99のResult型にobservability fieldを追加しない。永続的なexecution bindingが必要な場合は別Contract Reviewを行う。

## Implementation Split

依頼内の`PR101`から`PR104`はplanning例であり、GitHub PR番号を予約または保証しない。実際のPR #101は本Design PRへ割り当てられたため、後続実装は次のstable planning aliasで管理し、実PR番号は作成時に確定する。

### Follow-up A: Runner Provisioning Interface Implementation

Scope candidate:

- approved runner profile resolver
- host lease / lifecycle abstraction
- workspace ownership and quarantine result
- no real credential registration

Gate:

- Product OwnerによるRunner recommendation承認
- Architect Review

### Follow-up B: GitHub Runner Adapter

Scope candidate:

- selected GitHub-hosted or ephemeral self-hosted host integration
- exact base / workspace preparation
- lifecycle and negative tests

Gate:

- Control Plane / OS / runner profile決定

### Follow-up C: Credential Integration

Scope candidate:

- execution credential provider
- GitHub write credential separation
- redaction and zero-secret tests

Gate:

- Secret owner、storage、rotation、permission承認

### Follow-up D: Trigger Automation

Scope candidate:

- approved Issue trigger to Runner provisioning
- actor / revision / idempotency / cancellation integration

Gate:

- Follow-up AからFollow-up CのSecurity Gate成功

各PRは別Task Assignment、branch、worktree、reviewerを持つ。本PRでは実装しない。

## Test Design

### Provision tests

- approved profileでhost lease成功
- unavailable / offline runnerでblocked
- profile mismatchでfallbackなし
- provision timeoutでincomplete hostを再利用しない
- duplicate requestでone active lease

### Workspace tests

- exact base SHAとdedicated workspace
- dirty / foreign workspaceを保全してblocked
- path traversal、symlink、junction、nested repositoryを拒否
- main direct edit、shared workspace、other-task workspaceを拒否

### Execution tests

- one `execute()` call produces one result
- structured success / failed / contract_required / unsupported mapping
- AbortSignal propagation
- timeout calls`cancel()` once
- cancel confirms exact process termination
- malformed / oversized / secret-contaminated output fails closed

### Credential tests

- Agent processにGitHub write credentialなし
- Publisherにexecution credentialなし
- validationに両credentialなし
- unavailable credentialでblocked and zero execution
- logs / artifacts / Handoffにfixture secretなし

### Security tests

- unauthorized actor、fork、unapproved Issueでhost provision count zero
- task branch policy変更がcurrent base policyを上書きしない
- forbidden network / filesystem / command accessを拒否
- dependency scriptがpublisher credentialへaccessできない

### Cleanup tests

- normal completionでprocess、credential、workspace lifecycle完了
- failed executionでもevidence保持
- termination未確認でrunner quarantine
- cleanup ownership mismatchでdeleteなし
- retryで別Task residueなし

本PRではtestを実装しない。

## Deferred Decisions

- GitHub-hosted / ephemeral self-hosted / other host採用
- exact OS、image、CPU、memory、disk
- Codex Action / `codex exec` / SDK採用
- PR #99 interfaceにexecution identityを追加する必要性
- transport / operational evidence persistence
- execution credential typeとstorage
- GitHub write identityとpermission
- network allowlist
- sandbox / container / VM technology
- timeout、retry、retentionの具体値
- runner quarantine / incident response runbook

## Official Capability References

2026-07-19時点で次の公式資料を候補比較に使用した。Implementation開始時に再確認する。

### GitHub

- [GitHub-hosted runners reference](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)
- [Self-hosted runners reference](https://docs.github.com/en/actions/reference/runners/self-hosted-runners)
- [Adding self-hosted runners](https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners/add-runners)
- [Running jobs in a container](https://docs.github.com/en/actions/how-tos/write-workflows/choose-where-workflows-run/run-jobs-in-a-container)
- [Actions limits](https://docs.github.com/en/actions/reference/limits)
- [Secure use reference](https://docs.github.com/en/actions/reference/security/secure-use)

### OpenAI

- [Codex GitHub Action](https://learn.chatgpt.com/docs/github-action.md)
- [Codex non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode.md)
- [Codex SDK](https://learn.chatgpt.com/docs/codex-sdk.md)

## Acceptance Criteria for Future Implementation

- PR #99の`ExternalRunner` interfaceを無断変更しない。
- Execution HostとAgent RuntimeのRunner概念を混同しない。
- approved Worker Taskだけがone task / one host lease / one workspace / one active executionを持つ。
- main、shared workspace、他Task workspaceを変更しない。
- execution credentialとGitHub write credentialを分離する。
- timeout / cancelでexact process terminationを確認する。
- unapproved、fork、external actor、security violationでHostまたはSecretを起動しない。
- malformed result、scope violation、validation failure、cleanup failureをcompleted扱いしない。
- Runner lifecycleとCanonical Result Handoffをsanitized referenceで追跡できる。
- auto-merge、force push、Product / Contract / Research判断を実装しない。

## Explicit Non-implementation Confirmation

本設計では次を実施していない。

- Runner作成、登録、起動
- Workflow YAMLまたはGitHub Actions job作成
- Container / VM image作成
- Codex CLI / SDK / Action integration
- Credential、Secret、Token登録
- Dispatcher、Execution Adapter、External Runner code変更
- Schema変更
- Existing Contract変更
- Research Data、Existing Run、Research Artifact変更
- Merge
