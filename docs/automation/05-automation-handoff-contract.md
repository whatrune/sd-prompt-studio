# Automation Result Handoff Contract

## Purpose

DispatcherとSpecialist Runnerの実行情報を、PR #88のResult Handoffへ追加してIntegrated Leadが実行事実を検証できるようにする。既存Result HandoffのField、Status、Canonical Locationを置き換えない。

本書は概念Contractであり、新しい保存Schema、Database、Receipt、Bot、Workflowを追加しない。

## Existing Result Contract

Automation Handoffs use all required fields and Result Handoff statuses owned by [`../team/11-delegation-and-result-contract.md`](../team/11-delegation-and-result-contract.md) unchanged. This document does not enumerate, add, remove, or redefine them; it adds only the Automation-specific execution information in the next section.

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

Team document 11 is the sole normative owner of the closed Result Handoff status vocabulary and its meaning.

Runnerが`succeeded`でも、必須Validation、Expected Output、Canonical Handoff保存が不足する場合、Result Handoffを`completed`にしない。

## Canonical Location

Automation Handoffの`canonical_record`は、完全なRecordをfresh-fetchできるdirect GitHub recordに限定する。

1. GitHub IssueまたはPull Requestのdirect Body URL
2. GitHub IssueまたはPull Requestのdirect Top-level Comment URL

Repository-relative Markdown pathはCanonical Recordではない。supporting recordとして参照する場合は、repository、path、およびfull 40-character commit SHAを同時に束縛する。mutable branch名、short SHA、path単独ではauthorityまたはcurrent runtime stateを証明しない。

本alignmentのCanonical Task recordはdirect GitHub recordである[Issue #240](https://github.com/whatrune/sd-prompt-studio/issues/240)と[Resume Dispatch](https://github.com/whatrune/sd-prompt-studio/issues/240#issuecomment-5176584167)である。本書が参照するTeam Contractとrepository sourceは、full commit SHA `ba5fc2a4395d2ac474ce95af3cd9b0e56cdb603a`に束縛されたsupporting recordとしてのみ扱う。

会話、Runner local file、Log、repository-relative pathだけをCanonical Recordにしない。DispatcherがHandoff投稿に失敗した場合、Taskを`completed`としてIntegrated Leadへ返さない。

## Task 3 Contract Boundary

Evidence reuse、evidence invalidation、Collector V1 applicability、およびGate Status projection-only reuseの意味は[`../team/13-shared-role-execution-contract.md`](../team/13-shared-role-execution-contract.md)が所有する。本書はその意味を変更または拡張しない。このrepository-relative referenceのsupporting-record bindingはfull commit SHA `ba5fc2a4395d2ac474ce95af3cd9b0e56cdb603a`である。

Automation Handoffにevidence referenceが存在しても、それだけでは再利用admission、finding closure、Role authority、protected-action authority、またはproduction reachabilityを成立させない。Collector V1 artifactはobservation evidenceであり、production physical operator、scheduler／automatic trigger owner、Cloudflare設定、repository外Automation実行経路を証明しない。これらは`UNKNOWN`のまま扱う。

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
