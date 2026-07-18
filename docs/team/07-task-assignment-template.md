# Task Assignment Template

このTemplateは、Architect TeamがBackend Implementer、Frontend Implementer、Workerへ作業を割り当てる際に使用する。Assignmentは実装者がContract判断を行わずに着手できるClosed Instructionでなければならない。

````markdown
# Task Assignment

## Assignment Metadata

- Task ID:
- Role: Backend Implementer | Frontend Implementer | Worker
- Previous Role, if changed:
- Role Change Authorized By:
- Owner:
- Review Owner:
- Priority:
- Depends on:
- Target branch naming:
- canonical_record: Task Assignment全文を保存したGitHub URLまたはRepository-relative Markdown path

## Objective

担当者が達成する結果を1文で記載する。

## Background

現在の問題、Product上の理由、前提となる決定を記載する。

## Input Documents

### Normative

- Freeze Contract and version:
- API / Schema Contract:
- Architecture document:

### Informative

- Related issue / PR:
- Existing implementation:
- Fixture / example:

NormativeとExampleを混同しない。

## Preconditions

- 実装開始前に成立していなければならない条件
- Required dependency PR / commit
- Required Schema validation or generated input

## Allowed Changes

- 変更可能なfile / directory
- 追加可能なTest
- 実装してよいbehavior

## Forbidden Changes

- Freeze Contract
- Schema
- Existing Run / Research Artifact
- Product behavior
- Scope外API / CLI / Storage

各禁止事項には理由を記載する。

## Responsibility Boundary

### This task performs

-

### This task does not perform

-

## Required Behavior

1.
2.

## Failure and Stop Conditions

- Architectへ返却する未定義条件
- 処理を停止すべきError
- 自動fallback禁止条件

## Expected Output

- Files / artifacts
- Public behavior
- Test cases
- Documentation update

## Acceptance Criteria

- 操作または入力:
  - Expected result:
- Invalid input:
  - Expected failure:

## Validation

```text
required command 1
required command 2
git diff --check
```

既知の長時間Test、environment-dependent check、Preview確認を分離して記載する。

## Report Format

- Role / Task ID
- Branch / worktree / commit / PR
- Files created and updated
- Implemented behavior
- Explicitly unimplemented scope
- Validation commands and results
- Existing Data impact
- Remaining questions

## Merge Gate

- Required reviewers:
- Required checks:
- Product Owner approval required: yes
````

## Assignment Quality Gate

Architect Teamは割当前に次を確認する。

- [ ] Objectiveが実装手段ではなく結果を表している。
- [ ] Normative SourceとVersionが一意である。
- [ ] Allowed / Forbidden Changesがfileとbehaviorの両方で明確である。
- [ ] Required BehaviorとFailureが決定的である。
- [ ] Acceptance Criteriaが観測可能である。
- [ ] Validation commandと期待結果がある。
- [ ] 未定義仕様を実装者へ委譲していない。
- [ ] Existing Run / Research Artifact境界が明記されている。
- [ ] `canonical_record`を直接参照でき、Task Assignment全文が保存されている。

Gateを満たさないAssignmentは`draft`として扱い、実装を開始しない。
