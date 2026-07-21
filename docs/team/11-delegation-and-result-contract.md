# Delegation and Result Contract

## Purpose

このContractは、Integrated Leadから専門RoleへのTask Assignmentと、専門RoleからIntegrated LeadへのResult Handoffのrecord shapeおよびResult Handoff statusを定義する。実行、fresh fetch、terminal stop、testing、completion evidenceの意味を再定義せず、自動通信、Bot、Workflow、CLI、永続Artifact Schemaも定義しない。

## Task Assignment Contract

Task Assignmentは作業開始前に次を含む。

| Field | Required meaning |
| --- | --- |
| `task_id` | 作業単位を一意に識別する運用ID |
| `canonical_record` | Task Assignment全文を保存したGitHub URLまたはRepository-relative Markdown path |
| `requested_by` | 依頼元RoleまたはProduct Owner |
| `assigned_role` | 作業のPrimary Role |
| `purpose` | 達成する結果 |
| `background` | 現在状態と依存関係 |
| `input_documents` | Normative Contract、Schema、関連PR |
| `allowed_changes` | 許可されたfileとbehavior |
| `forbidden_changes` | 禁止されたfileとbehavior |
| `expected_outputs` | 必須成果物 |
| `validation` | 実行するcheckと期待結果 |
| `completion_conditions` | 完了を宣言できる条件 |
| `escalation_conditions` | 停止して戻す条件 |

AssignmentにはRepositoryのTask Assignment Templateを使用できる。新しいAssignmentはcommit-pinnedなshared execution baselineと、該当するreview baselineを`input_documents`へ含める。会話内の補足がContract判断を含む場合、Assignmentへ転記する。

## Result Handoff Contract

Result Handoffは次を含む。

| Field | Required meaning |
| --- | --- |
| `task_id` | Assignmentと一致するID |
| `canonical_record` | Result Handoff全文を保存したGitHub URLまたはRepository-relative Markdown path |
| `role` | 実行したPrimary Role |
| `status` | 定義済みStatus |
| `execution_stop_reason` | `completed | architecture_gap | external_blocker`のclosed terminal reason。`status`とは別field |
| `completed_work` | 実際に完了した範囲 |
| `created_files` | 作成ファイル一覧 |
| `updated_files` | 更新ファイル一覧 |
| `validation_results` | command/checkごとの結果 |
| `contract_boundary_confirmation` | Scope、Contract、Existing Data境界 |
| `unresolved_items` | 未解決・未確認・既知の失敗 |
| `escalation_required` | 判断が必要かとOwner |
| `recommended_next_action` | 次の安全な具体的行動 |

## Status Vocabulary

| Status | Meaning |
| --- | --- |
| `completed` | Completion Conditionを全て満たす |
| `completed_with_warnings` | 完了したが非Blocker Warningが残る |
| `needs_followup` | 一部完了だが追加作業または再確認が必要 |
| `blocked` | 必要判断または外部条件待ちで進行不能 |
| `failed` | 必須処理またはValidationが失敗 |
| `not_applicable` | Assignmentの対象条件が成立しない |

`completed_with_warnings`はError、未実施必須Validation、Critical Findingを隠す用途に使用しない。

## Integrated Status Aggregation

- 全てのRouted Taskが`not_applicable`の場合、Overall Statusは`not_applicable`とする。
- `completed`と`not_applicable`が混在する場合、Applicable Taskだけを基準にOverall Statusを決定する。
- `not_applicable`のTaskもRouted RolesとResultsへ明示する。
- `not_applicable`によって`failed`、`blocked`、`needs_followup`を隠さない。
- Applicable Taskが一つもない場合に`completed`を使用しない。

この契約は新しいJSON Schema、Database、Bot、Workflow、CLIを要求しない。
