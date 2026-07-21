# Delegation and Result Contract

<!-- role-contract-meta
id: 11
kind: contract
owns: assignment_shape, result_handoff_shape, handoff_status
uses: none
-->

## Purpose

このContractは、Task AssignmentとResult Handoffのrecord shape、およびResult Handoff status vocabularyの唯一のnormative ownerである。fresh fetch、authority判定、terminal stop、testing、completion evidenceの意味はShared Role Execution Contractが所有し、本書は再定義しない。

このContractは自動通信、Bot、Workflow、CLI、永続Artifact Schemaを定義しない。

## Record Identity and Location Fields

migration後のlive Taskでは、Task AssignmentとResult Handoffに次の共通fieldを含める。

| Field | Required meaning |
| --- | --- |
| `task_id` | 対象Taskを一意に識別する運用ID |
| `record_type` | `task_assignment`または`result_handoff` |
| `authoring_role` | recordを記録した正式Role |
| `authority_source` | authoring Roleがこのrecordを作成できる根拠のdirect GitHub URL |
| `canonical_record` | record全文をfresh fetchできるIssue / PR bodyまたはtop-level commentのdirect GitHub URL |
| `prior_record_url` | 累積chainの直前recordのdirect GitHub URL。先行recordがなければ`not_applicable` |
| `cumulative_scope` | prior recordから累積またはsupersedeする範囲。該当しなければ`not_applicable` |
| `supporting_records` | 任意。repository-relative Markdown pathとfull 40-character commit SHAの組。mutable authority chainを代替しない |

repository-relative Markdown path、local path、branch名、commit SHAだけを`canonical_record`にしてはならない。これらはimmutableな`supporting_records`としてだけ使用できる。

PR #167より前に成立したlegacy Taskは、当時のpinned canonical sourceとProduct Owner acceptanceを維持する。migration後fieldを暗黙retrofitしてinvalid化しない。

## Task Assignment Contract

Task Assignmentは作業開始前に、共通identity fieldと次を含む。

| Field | Required meaning |
| --- | --- |
| `requested_by` | 依頼元RoleまたはProduct Owner |
| `assigned_role` | 作業のPrimary Role |
| `purpose` | 達成する結果 |
| `background` | 現在状態と依存関係 |
| `input_documents` | commit-pinned normative Contract、Schema、関連PR |
| `allowed_changes` | 許可されたfileとbehavior |
| `forbidden_changes` | 禁止されたfileとbehavior |
| `expected_outputs` | 必須成果物 |
| `validation` | 実行するcheckと期待結果 |
| `completion_conditions` | Task実行を完了したと宣言できる条件 |
| `escalation_conditions` | 停止して戻すTask固有条件 |

AssignmentにはRepositoryのTask Assignment Templateを使用できる。会話内の補足がauthority、Contract、scope判断を含む場合、direct canonical recordへ累積する。

## Result Handoff Contract

Result Handoffは共通identity fieldと次を含む。

| Field | Required meaning |
| --- | --- |
| `role` | 実行したPrimary Role |
| `status` | 本書で定義するResult Handoff status |
| `execution_stop_reason` | Shared Role Execution Contractが定義するclosed terminal reason。`status`とは別field |
| `completed_work` | 実際に完了したTask実行範囲 |
| `created_files` | 作成ファイル一覧 |
| `updated_files` | 更新ファイル一覧 |
| `validation_results` | command/check、exit result、実行full HEAD |
| `contract_boundary_confirmation` | Scope、Contract、Existing Data境界 |
| `unresolved_items` | 未解決・未確認・既知の失敗 |
| `escalation_required` | 判断が必要かとOwner |
| `recommended_next_action` | 次の安全な具体的行動とOwner |

Review Result Handoffは、該当する場合に`reviewed_full_head`とfinding closure flagsも含める。Review固有の意味とclosure authorityはReview Execution Contractが所有する。

## Status Vocabulary

| Status | Meaning |
| --- | --- |
| `completed` | Task自身のCompletion Conditionを全て満たし、downstream correctionを要求しない |
| `completed_with_warnings` | Task自身は完了し、non-blocking warningだけが残る |
| `needs_followup` | Task自身のCompletion Conditionとcanonical handoffは完了したが、review対象など次のOwnerによる修正または再確認が必要 |
| `blocked` | 必要authorityまたは外部条件待ちでTask実行を安全に完了できない |
| `failed` | 必須処理またはValidationの実行失敗が確定した |
| `not_applicable` | Assignmentの対象条件が成立しないことを検証し、canonical handoffまで完了した |

`needs_followup`は、Task自身の未実施Validation、未記録Decision、未完了作業を隠すために使わない。`completed_with_warnings`はError、未実施必須Validation、Critical Findingを隠すために使わない。

## Integrated Status Aggregation

- 全てのRouted Taskが`not_applicable`の場合、Overall Statusは`not_applicable`とする。
- `completed`と`not_applicable`が混在する場合、Applicable Taskだけを基準にOverall Statusを決定する。
- `not_applicable`のTaskもRouted RolesとResultsへ明示する。
- `not_applicable`によって`failed`、`blocked`、`needs_followup`を隠さない。
- Applicable Taskが一つもない場合に`completed`を使用しない。

この契約は新しいJSON Schema、Database、Bot、Workflow、CLIを要求しない。
