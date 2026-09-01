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
- canonical_record: direct GitHub Issue body or top-level comment URL that exposes the complete Assignment; `GITHUB_RESOURCE` only for the closed logical Review-publication assignment route whose successful CREATE response is immediately direct-refetched
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

For a logical Review-publication exact assignment, also record the stable predelegation identity and the closed exact grant. Do not record a `wait_threads` cursor: it is wake-up state, not authority. The consumer derives the logical identity from repository + Task + PR + HEAD + protected action + actor + surface + decision and treats only byte-identical canonical semantic payloads as equivalent.

For a normal-execution predelegation, use the same `task_assignment` record and bind the exact repository, Task, initial fresh base, branch, canonical worktree path, sorted authorized paths, actor, and `BOUNDED_EXECUTION_IDENTITY_V1`. List the three closed operations separately: exact worktree creation once; exact validated-tree commit once per admitted execution identity; and unchanged reviewed-commit push plus one non-Draft PR creation. State explicitly that the cursor is activation only, the protected host must refetch its consumed terminal Result Handoff or Independent Review before mutation, and caller-supplied result data is not admitted. The initial base is the authority anchor; a freshly observed descendant `origin/main` may rebind only when its changed paths are disjoint from the Task scope, while overlap or divergence requires compatibility authority. Scope change, rebase, amend, Ready, Merge, retry, and Issue closure remain forbidden.

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
