# Task Assignment Template

<!-- role-contract-meta
id: 07
kind: template
owns: none
uses: assignment_shape, canonical_record_admission, shared_admission, review_admission
-->

This non-normative template captures task-specific assignment inputs and expected outputs. Assignment fields are owned by the [Delegation and Result Contract](11-delegation-and-result-contract.md). Shared admission and execution rules are owned by the [Shared Role Execution Contract](13-shared-role-execution-contract.md). Review rules are owned by the [Review Execution Contract](14-review-execution-contract.md).

````markdown
# Task Assignment

## Assignment Metadata

- task_id:
- record_type: task_assignment
- authoring_role:
- authority_source:
- canonical_record: direct GitHub Issue body or top-level comment URL that exposes the complete Assignment
- prior_record_url:
- cumulative_scope / supersede_scope:
- supporting_records: repository-relative path at full 40-character commit SHA | not_applicable
- Role: Architect Team | Backend Implementer | Frontend Implementer | Worker
- Previous Role, if changed:
- Role Change Authorized By:
- Owner:
- Review Owner:
- Priority:
- Depends on:
- Target branch naming:
- Execution baseline:
- Review baseline:

## Objective and Background

- Objective:
- Background:

## Inputs

- Freeze Contract and version:
- API / Schema Contract:
- Architecture document:
- Current Cumulative Amendments / Resume Dispatch / Review Decisions:
- Related Issue / PR:
- Existing implementation:
- Fixture / example:
- Preconditions:
- Completion conditions:
- Escalation conditions:

## Scope

- Allowed files / directories:
- Allowed behavior:
- Allowed tests:
- Forbidden files / behavior / data:
- Task-specific forbidden fallback:
- This task performs:
- This task does not perform:

## Expected Outputs

- Files / artifacts:
- Public behavior:
- Test cases:
- Documentation:
- Task-specific Result Handoff additions:

## Acceptance Criteria

- Action or input:
  - Expected result:
- Invalid input:
  - Expected failure:

## Validation

```text
required command 1
required command 2
git diff --check
```

## Review and Delivery Inputs

- Required reviewers:
- Required checks:
- Product Owner approval required:
- Next owner:
````

## Review-publication predelegation profile

When the Product Owner predelegates later exact Review-publication assignment materialization, the complete Canonical Task body contains exactly one additional `task_assignment` profile. Its `allowed_changes` binds `protected_action: REVIEW_AUTHORITY_PUBLICATION`, `activation: FRESH_EXACT_HEAD_REVIEW_APPROVE`, `materialization_only: true`, repository, Task, branch, cumulative authorized paths, authenticated actor, exactly one permitted surface, the required `APPROVE / 0 / 0 / 0` result, `operation_count: 1`, and `fallback_allowed: false`. It contains no PR, HEAD, or base and cannot itself authorize Review publication.

After the activation cursor is consumed, the consumer derives the exact PR, HEAD, base, branch, scope, actor, surface, and Review from fresh state. It reuses one uniquely valid exact assignment or creates exactly one top-level Canonical Task Issue comment. The comment body is complete before CREATE and uses `canonical_record: GITHUB_RESOURCE`; the returned and directly refetched GitHub comment resource supplies the admitted canonical ID and URL. The comment is never PATCHed, and the Canonical Task body is never rewritten to materialize the exact assignment. Duplicate or conflicting applicable records, drift, or an ambiguous CREATE stop without retry.
