# Integrated Dispatch Contract

## Purpose

DispatcherがCanonical Task Assignmentを受領してから、Result HandoffをIntegrated Leadへ返すまでの決定的な実行管理規則を定義する。DispatcherはAssignmentの意味を補完せず、Closed Instructionとして検証可能なTaskだけを扱う。

## Admission Preconditions

起動要求は最低限、次を満たさなければならない。

- Repositoryが承認済みallowlist内にある。
- Task Assignmentが[`../team/11-delegation-and-result-contract.md`](../team/11-delegation-and-result-contract.md)に準拠する。
- `canonical_record`を直接参照でき、Assignment全文が保存されている。
- `task_id`と`assigned_role`が明示されている。
- `allowed_changes`、`forbidden_changes`、`validation`が明示されている。
- Completion ConditionsとEscalation Conditionsが明示されている。
- Product OwnerまたはContractで許可されたActorの起動承認がある。
- Assignment revisionが承認後に変更されていない。
- 同一Lock Keyで別Executionが動作していない。

不足、矛盾、参照不能、未承認の場合、DispatcherはRunnerを起動せず`blocked`として返す。

## Trigger Contract

将来MVPのTriggerは、GitHub Issue上のCanonical Task AssignmentとLabelの組合せとする。

Labelは役割を分離する。

- Approval Label: `dispatch:approved`
- Role Label候補: `dispatch:worker`、`dispatch:architect`、`dispatch:backend`、`dispatch:frontend`

Role Labelは承認を意味しない。`dispatch:approved`だけではRoleを決定しない。MVPでは`dispatch:worker`だけを実行可能とし、他のRole Labelはmapping定義があっても起動しない。

次の場合は起動しない。

- Draft Assignment
- Approval Labelなし
- Role Labelなし、複数、または`assigned_role`と不一致
- 未承認ActorによるLabel操作
- fork、外部Repository、Pull Request由来のuntrusted Task
- Assignment編集後に再承認されていない

Labelの除去と再付与だけで同じrevisionを再実行しない。再実行には明示されたretry許可と新しいExecution IDが必要である。

## Dispatch State

`dispatch_state`はTeam Operating ModelのWork Item StateおよびResult Handoffの`status`と別の実行管理Vocabularyである。

| State | Entry | Exit |
| --- | --- | --- |
| `draft` | Assignment未承認 | 承認または取消 |
| `approved` | Human Gate通過 | Admission成功またはblocked |
| `queued` | Admission成功、Runner待機 | running、cancelled、blocked |
| `running` | RunnerがExecutionを受領 | completed、failed、blocked、cancelled、timed_out |
| `blocked` | 入力不足、競合、判断待ち | Humanによる修正と再承認 |
| `failed` | 必須処理またはValidation失敗 | 明示retryまたは終了 |
| `completed` | Handoff保存と受領条件を満たす | terminal |
| `cancelled` | 権限あるActorが取消 | terminalまたは新Assignment |
| `timed_out` | 規定時間を超過 | 明示retryまたは終了 |
| `stale` | 承認後にAssignmentまたはbaseが変化 | 再確認と再承認 |

実行されていないTaskを`completed`にしない。Runnerが成功してもResult HandoffのCanonical保存に失敗した場合は`completed`にしない。

## Execution Lifecycle

1. Canonical Assignmentを取得する。
2. Repository、Actor、Approval、revisionを確認する。
3. Required FieldとRole Bindingを確認する。
4. Lockを取得する。
5. 専用branch/worktreeの作成可能性を確認する。
6. 対応Runnerへ一回の起動要求を渡す。
7. timeout、cancel、process resultを監視する。
8. Result HandoffをCanonical Locationへ保存する。
9. Lockを解放し、Integrated Leadへ返す。

DispatcherはAssignment本文から任意Shell Commandを生成しない。Validationは将来実装でversion管理された許可済みprofileへBindingし、自由記述Commandを実行しない。

## Branch and Worktree Boundary

- 1 Task、1 branch、1 worktree、1 Primary Roleを維持する。
- `main`を直接編集またはpushしない。
- 既存branch/worktreeを上書き、削除、または自動再利用しない。
- dirty worktree、branch衝突、base不一致は`blocked`または`stale`とする。
- force push、history rewrite、自動rebase、自動conflict解決を行わない。
- PushとDraft PR作成はAssignmentとApproval Gateが明示的に許可する場合だけ要求できる。

## Concurrency and Idempotency

Lock Keyは最低限、次の組合せから構成する。

- repository identity
- `task_id`
- target branch

同一Lock Keyで`queued`または`running`が存在する場合、新しいExecutionを開始しない。新規Triggerで既存Executionを自動cancelしない。

各Executionは一意な`execution_id`を持つ。同じAssignment revisionと同じ完了Executionに対する重複Triggerは、既存Result Handoffを返して新規実行しない。

## Retry, Cancel, and Timeout

- 自動Retryは、Task内容を再判断せず安全に反復できる一時的なtransportまたはRunner acquisition失敗に限定する。
- Validation failure、Scope違反、dirty worktree、conflict、認証失敗、Contract衝突は自動Retryしない。
- Retry上限とtimeoutはAssignmentまたは承認済み実行profileで事前に固定する。
- Cancel時は新しい変更を停止し、partial resultと未完了範囲をHandoffへ残す。
- timeout後にprocess終了を確認できない場合、Lockを自動解放せず人間へEscalateする。

## Completion Conditions

Dispatcherが`completed`を記録できるのは次を全て満たす場合だけである。

- Runner Executionが終了している。
- Assignmentで要求されたOutputとValidation Resultが報告されている。
- Result Handoffが許可されたCanonical Locationへ保存されている。
- branch、commit、Draft PRの有無が正確に記録されている。
- 未解決事項とScope境界が省略されていない。

Dispatcherは成果物の専門的妥当性をApproveしない。Integrated Leadと指定Reviewerが別途確認する。
