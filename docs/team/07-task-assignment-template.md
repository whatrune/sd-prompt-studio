# Task Assignment Template

<!-- role-contract-meta
id: 07
kind: template
owns: none
uses: assignment_shape, canonical_record_admission, shared_admission, review_admission
-->

このTemplateは、Task Assignmentを記録するためのnon-normativeな記入形式である。Assignmentのrecord shapeは[Delegation and Result Contract](11-delegation-and-result-contract.md)、共通実行規則は[Shared Role Execution Contract](13-shared-role-execution-contract.md)、Review時は[Review Execution Contract](14-review-execution-contract.md)が所有する。本TemplateではTask固有情報だけを反復する。

````markdown
# Task Assignment

## Assignment Metadata

- task_id:
- record_type: task_assignment
- authoring_role:
- authority_source: authoring Role authorityのdirect GitHub URL
- canonical_record: Assignment全文へ直接到達できるGitHub Issue bodyまたはtop-level comment URL
- prior_record_url: direct GitHub URL | not_applicable
- cumulative_scope / supersede_scope: | not_applicable
- supporting_records: repository-relative path at full 40-character commit SHA | not_applicable
- Role: Architect Team | Backend Implementer | Frontend Implementer | Worker
- Previous Role, if changed:
- Role Change Authorized By:
- Owner:
- Review Owner:
- Priority:
- Depends on:
- Target branch naming:
- Execution baseline: `docs/team/13-shared-role-execution-contract.md` at full commit SHA
- Review baseline: `docs/team/14-review-execution-contract.md` at full commit SHA | not_applicable

## Objective

担当者が達成する結果を1文で記載する。

## Background

現在の問題、Product上の理由、前提となる決定を記載する。

## Input Documents

### Normative

- Freeze Contract and version:
- API / Schema Contract:
- Architecture document:
- Current Cumulative Amendments / Resume Dispatch / Review Decisions:

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

- Task固有の禁止file / behavior / data boundary
- Task固有protected action

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

- Task固有のarchitecture gap
- Task固有のexternal blocker
- Task固有の禁止fallback

共通terminal reasonとsame-task correction手順はExecution baselineを再掲せず参照する。

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

## Task-Specific Result Additions

- 共通Result Handoffに追加するTask固有artifact / evidence:
- Task固有のunverified item:
- Next owner:

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
- [ ] `canonical_record`がTask Assignment全文へ直接到達できるGitHub URLである。
- [ ] `record_type`、`authoring_role`、`authority_source`、prior / cumulative metadataが該当範囲で記録されている。
- [ ] repository-relative pathを使用する場合、`supporting_records`へfull 40-character commit SHAと組にしている。
- [ ] Execution baselineと、該当するReview baselineがfull commit SHAで固定されている。
- [ ] dependency PR / merge commit、Task固有matrix、branch / worktree / target PRが明記されている。

Gateを満たさないAssignmentは`draft`として扱い、実装を開始しない。
