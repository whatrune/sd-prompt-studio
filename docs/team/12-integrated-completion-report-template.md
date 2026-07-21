# Integrated Completion Report Template

このTemplateはIntegrated Leadが複数RoleのHandoffを統合し、Product Ownerへ状態と必要判断を返すために使用する記入形式である。statusは[Delegation and Result Contract](11-delegation-and-result-contract.md)、`execution_stop_reason`とcompletion evidenceは[Shared Role Execution Contract](13-shared-role-execution-contract.md)を参照し、本Template自体は規則を定義しない。

```markdown
# Integrated Completion Report

## Request

- Request owner:
- Request summary:
- Task IDs:
- Overall status: completed | completed_with_warnings | needs_followup | blocked | failed | not_applicable

## Routed Roles

| Role | Task ID | Purpose | Handoff status | execution_stop_reason |
| --- | --- | --- | --- | --- |

## Work Performed

- Completed work:
- Explicitly not performed:

## Results

| Result area | Status | Evidence |
| --- | --- | --- |

## Validation Status

| Validation | Result | Notes |
| --- | --- | --- |

## Contract Boundary

- Contract changed: yes / no
- Schema changed: yes / no
- Existing Run changed: yes / no
- Research Artifact changed: yes / no
- Role boundary exception: yes / no

## Warnings

- Warning:
  - Existing or introduced:
  - Impact:

## Critical Findings

- Finding:
  - Blocking area:
  - Required owner:

## Product Owner Decision Required

- Decision:
  - Options:
  - Impact:
  - Recommendation from responsible Role:

## Artifacts

- Branch / worktree:
- Commit / PR:
- Task Assignment canonical records:
- Result Handoff canonical records:
- Created files:
- Updated files:
- Generated artifacts:

## Next Action

- Owner:
- Concrete action:
- Preconditions:
```

## Overall Status Aggregation Rules

- 全Routed Taskが`not_applicable`ならOverall Statusも`not_applicable`とする。
- `completed`と`not_applicable`が混在する場合、Applicable TaskだけでOverall Statusを決定する。
- `not_applicable`のTaskもRouted RolesとResultsへ明示する。
- `failed`、`blocked`、`needs_followup`を`not_applicable`で隠さない。
- Applicable Taskがない場合に`completed`を使用しない。

## Non-normative Development Example

```markdown
# Integrated Completion Report

## Request

- Request owner: Product Owner
- Request summary: Freeze済みBackend仕様をマージ可能な状態まで進める
- Task IDs: DEV-101, REVIEW-101
- Overall status: needs_followup

## Routed Roles

| Role | Task ID | Purpose | Handoff status |
| --- | --- | --- | --- |
| Backend Implementer | DEV-101 | 実装とTest | completed |
| Backend Architect | REVIEW-101 | Contract Review | needs_followup |

## Results

| Result area | Status | Evidence |
| --- | --- | --- |
| Implementation | PASS | commit recorded |
| Required tests | PASS | command results recorded |
| Architect review | FAIL | Critical Finding 1件 |

## Product Owner Decision Required

なし。Critical Finding修正後に再Reviewする。

## Next Action

- Owner: Backend Implementer
- Concrete action: REVIEW-101の指摘を同じPRへ修正する
- Preconditions: Freeze Contract変更なし
```

## Non-normative Research Example

```markdown
# Integrated Completion Report

## Request

- Request owner: Product Owner
- Request summary: 最新Runを解析・正式化してPDF化。研究判断なし。
- Task IDs: RES-201, IMG-201, MAINT-201, REPORT-201
- Overall status: needs_followup

## Results

| Result area | Status | Evidence |
| --- | --- | --- |
| Observation Schema | PASS | validation result |
| Rubric Evidence Policy | FAIL | axis mismatch |
| Derived Index | PASS | index validation |
| PDF | NOT RUN | Rubric failureのため後続停止 |

## Contract Boundary

- Research Interpretation performed: no
- Working Conclusion or Claim created: no
- Existing Run overwritten: no

## Product Owner Decision Required

なし。Image Analysis OPへRubric不整合を差し戻す。

## Next Action

- Owner: Image Analysis OP
- Concrete action: 指摘PanelのObservation値をVisible EvidenceとRubricに照らして再確認する
- Preconditions: 研究判断を追加しない
```

例は形式説明用であり、実Run、実Review Status、Canonical Resultを表さない。
