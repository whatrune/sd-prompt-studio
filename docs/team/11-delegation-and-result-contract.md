# Delegation and Result Contract

## Purpose

このContractは、Integrated Leadから専門RoleへのTask Assignmentと、専門RoleからIntegrated LeadへのResult Handoffの最低要件を定義する。自動通信、Bot、Workflow、CLI、永続Artifact Schemaを定義するものではない。

## Task Assignment Contract

Task Assignmentは作業開始前に次を含む。

| Field | Required meaning |
| --- | --- |
| `task_id` | 作業単位を一意に識別する運用ID |
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

Assignmentは[`07-task-assignment-template.md`](07-task-assignment-template.md)を使用できる。会話内の補足がContract判断を含む場合、Assignmentへ転記する。

## Assignment Acceptance

担当者は作業開始前に次を確認する。

- `assigned_role`が現在のRoleと一致する
- Normative Inputが参照可能で矛盾しない
- Allowed / Forbidden Changesが一意
- Completion ConditionとValidationが実行可能
- 別Roleの判断を要求していない

責務外の場合は作業を開始せず、次を返す。

```text
Current Role:
Requested Work:
Why It Is Outside the Current Role:
Required Role:
Architect or Product Owner Decision Required:
```

## Result Handoff Contract

Result Handoffは次を含む。

| Field | Required meaning |
| --- | --- |
| `task_id` | Assignmentと一致するID |
| `role` | 実行したPrimary Role |
| `status` | 定義済みStatus |
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

## Integrated Lead Verification

Integrated LeadはHandoffを次と照合する。

1. Task IDとAssigned Role
2. Completion ConditionとExpected Output
3. Git Diff、作成物、報告file list
4. Validation Resultと未実施項目
5. Allowed / Forbidden Changes
6. Contract Boundary confirmation
7. 他TaskのHandoffとの矛盾
8. Product OwnerまたはArchitect判断の必要性

HandoffのStatusと証拠が一致しなければ差し戻す。

## Return Rules

次は差戻し対象である。

- 必須成果物、file list、Validation Resultの不足
- Scope外変更またはRole Boundary違反
- Contract違反またはFreeze変更
- 報告とGit Diffの不一致
- ErrorをWarningとして扱う
- Existing Warningと新規Regressionを混同する
- Research ObservationとReview結果が矛盾する

差戻しは元のCompletion Conditionを満たすために行う。新しい仕様が必要ならArchitect Teamへ別TaskとしてRoutingする。

## Canonical Record

正本はGit上のContract、Task Assignment、Result Handoff、PR Diff、Validation Resultである。ChatGPT Project内のRole別会話が自動共有または相互通信されることを前提にしない。

この文書はResult Handoff用のRepository ArtifactまたはSchema追加を要求しない。保存方法はTask Assignmentで指定された既存方式に従う。
