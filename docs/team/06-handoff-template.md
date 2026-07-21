# Handoff Template

<!-- role-contract-meta
id: 06
kind: template
owns: none
uses: result_handoff_shape, handoff_status, terminal_stop_reason, canonical_record_admission, completion_evidence
-->

このTemplateは、担当者間の引継ぎ、Review依頼、Blocked Task返却、完了報告に使用する記入形式である。fieldとstatusは[Delegation and Result Contract](11-delegation-and-result-contract.md)、実行と停止の意味は[Shared Role Execution Contract](13-shared-role-execution-contract.md)、Review時は[Review Execution Contract](14-review-execution-contract.md)に従い、本Template自体は規則を定義しない。

```markdown
# Task

- task_id:
- record_type: result_handoff | review_decision | review_amendment | architecture_gap | other Task-defined type
- authoring_role:
- authority_source: authoring Role authorityのdirect GitHub URL
- canonical_record: record全文へ直接到達できるGitHub Issue / PR bodyまたはtop-level comment URL
- prior_record_url: direct GitHub URL | not_applicable
- cumulative_scope / supersede_scope: | not_applicable
- supporting_records: repository-relative path at full 40-character commit SHA | not_applicable
- Current Role:
- Required Next Role:
- Role Change Authorized By:
- Owner:
- Status: proposed | designing | frozen | assigned | in_progress | review | merge_ready | blocked | merged
- Result Handoff status: completed | completed_with_warnings | needs_followup | blocked | failed | not_applicable
- execution_stop_reason: completed | architecture_gap | external_blocker
- Branch:
- Worktree:
- Commit / PR:
- reviewed_full_head: | not_applicable
- finding_closure_flags: | not_applicable

## Purpose

このTaskで誰が何をできるようになるかを1文で記載する。

## Background

現在の状態、問題、依存関係、既に確定している判断を記載する。

## Input Documents

- Normative Contract:
- Schema / API Contract:
- Task Assignment:
- Related PR / commit:

## Scope

- 実施した、または次担当が実施する範囲

## Out of Scope

- 変更していないContract
- 実装していない機能
- 判断していないResearch/Product事項

## Expected Output

- 作成物
- 期待されるBehavior
- Acceptance Criteria

## Current Result

- Files created:
- Files updated:
- Behavior completed:
- Behavior not completed:

## Decisions Made

- Decision:
  - Authority / source:
  - Reason:

## Decisions Not Made

- 未定義事項
- ArchitectまたはProduct Ownerの判断が必要な事項

## Validation

| Command / check | Result / exit | Execution HEAD | Evidence / notes |
| --- | --- | --- | --- |
|  |  |  |  |

- Focused coverage:
- Full regression coverage:
- GitHub checks and checked HEAD:

## Known Failures and Risks

- Failure:
  - Existing or introduced:
  - Impact:
  - Reproduction:

## Existing Data Impact

- Existing Run changed: yes / no
- Research Artifact changed: yes / no
- Schema changed: yes / no
- Contract changed: yes / no

## Next Safe Step

次担当が最初に行う具体的な確認または作業を記載する。

## Completion Report

- Final status:
- execution_stop_reason:
- Checks status:
- Mergeability:
- Remaining work:
```

## Usage

共通のvalidation evidence、record validity、canonical / supporting record、terminal reporting、same-task correctionは上記Contractを参照する。`canonical_record`へrepository-relative pathを書かない。未コミット変更を引き継ぐ場合は理由と正確なfile listを記録し、`Next Safe Step`には再開可能な具体的操作を書く。
