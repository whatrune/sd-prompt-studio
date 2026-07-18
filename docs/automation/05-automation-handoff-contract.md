# Automation Result Handoff Contract

## Purpose

DispatcherとSpecialist Runnerの実行情報を、PR #88のResult Handoffへ追加してIntegrated Leadが実行事実を検証できるようにする。既存Result HandoffのField、Status、Canonical Locationを置き換えない。

本書は概念Contractであり、新しい保存Schema、Database、Receipt、Bot、Workflowを追加しない。

## Existing Result Contract

Automation Handoffは[`../team/11-delegation-and-result-contract.md`](../team/11-delegation-and-result-contract.md)の全必須Fieldを保持する。

- `task_id`
- `canonical_record`
- `role`
- `status`
- `completed_work`
- `created_files`
- `updated_files`
- `validation_results`
- `contract_boundary_confirmation`
- `unresolved_items`
- `escalation_required`
- `recommended_next_action`

## Automation Execution Fields

将来Automationは最低限、次の実行情報を追加する。

| Field | Meaning |
| --- | --- |
| `execution_id` | 一回の起動試行を識別する一意ID |
| `runner_id` | 使用した論理Runnerまたは監査可能なRunner identity |
| `started_at` | Execution開始時刻 |
| `completed_at` | Execution終了時刻。未終了時は未設定 |
| `execution_status` | Runner実行状態 |
| `retry_count` | 同一Assignment revisionに対するretry回数 |
| `timeout_result` | timeoutの発生とprocess終了確認結果 |
| `branch` | Task branch。未作成ならその旨 |
| `worktree` | 個人情報を含まない論理またはsanitized worktree識別 |
| `commit` | 作成commit。未作成ならその旨 |
| `pr_url` | Draft PR URL。未作成ならその旨 |
| `execution_record` | Workflow run、Service eventなど実装で定義する監査Record参照 |

## Status Separation

`execution_status`はRunner processの状態であり、Result Handoffの`status`と混同しない。

Execution Status候補:

- `queued`
- `running`
- `succeeded`
- `failed`
- `blocked`
- `cancelled`
- `timed_out`

Result Handoff Statusは既存Contractの次を維持する。

- `completed`
- `completed_with_warnings`
- `needs_followup`
- `blocked`
- `failed`
- `not_applicable`

Runnerが`succeeded`でも、必須Validation、Expected Output、Canonical Handoff保存が不足する場合、Result Handoffを`completed`にしない。

## Canonical Location

Automation Handoffの保存先は既存Contractで許可された次に限定する。

1. GitHub IssueまたはPull RequestのBody
2. GitHub IssueまたはPull RequestのTop-level Comment
3. Task branch内のGit管理されたRepository-relative Markdown path

会話、Runner local file、LogだけをCanonical Recordにしない。DispatcherがHandoff投稿に失敗した場合、Taskを`completed`としてIntegrated Leadへ返さない。

## Failure Handoff

失敗、cancel、timeout、partial successでも、可能な限り次を記録する。

- 最後に完了したStep
- 失敗種別と既知の原因
- 作成済みbranch、worktree、commit、PR
- partial filesとpublish有無
- 実行済み / 未実施Validation
- Lockとprocessの終了確認
- retry可能性と承認Owner
- 次の安全な再開点

判断を必要とするfailureを自動的にretryしない。

## Integrated Lead Verification

Integrated LeadはAutomation Handoffを次と照合する。

- Assignmentの`task_id`、Role、revision、Canonical Record
- Execution IDの一意性
- allowed / forbidden changesと実際のDiff
- Runner execution statusとResult Handoff statusの整合
- Validation Result、未実施項目、timeout
- branch、commit、Draft PRの実在
- Contract、Schema、Existing Run、Research Artifact境界
- 次RoleまたはProduct Owner判断の必要性

Dispatcherの投稿を専門Reviewの代わりにしない。証拠不足または不一致ならIntegrated Leadは差し戻す。

## Idempotent Publication

同一`execution_id`のHandoffを二重投稿して別結果として扱わない。再投稿は同一Canonical Recordを更新または明示的に関連付け、二重Draft PRを作成しない。
