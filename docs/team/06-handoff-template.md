# Handoff Template

このTemplateは、担当者間の引継ぎ、Review依頼、Blocked Task返却、完了報告に使用する。未確認事項と未完了事項を省略しない。

```markdown
# Task

- Task ID:
- Current Role:
- Required Next Role:
- Role Change Authorized By:
- Owner:
- Status: proposed | designing | frozen | assigned | in_progress | review | merge_ready | blocked | merged
- Branch:
- Worktree:
- Commit / PR:
- canonical_record: Result Handoff全文を保存したGitHub URLまたはRepository-relative Markdown path

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

| Command / check | Result | Evidence / notes |
| --- | --- | --- |
| `git diff --check` |  |  |

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
- Checks status:
- Mergeability:
- Remaining work:
```

## Usage Rules

- 実行していないValidationを`passed`と記載しない。
- timeout、環境制約、既知の失敗を成功結果と分離する。
- 会話にしか存在しない判断は`Input Documents`または`Decisions Made`へ転記する。
- Result Handoffは、正式受領前に`canonical_record`へ全文を保存する。会話またはローカルファイルだけを保存先にしない。
- 未コミット変更を引継ぐ場合は、理由と正確なfile listを記載する。標準はcommit済み状態で引き継ぐ。
- `Next Safe Step`は「続ける」ではなく、再開可能な具体的操作にする。
