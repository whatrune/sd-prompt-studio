# Handoff Template

<!-- role-contract-meta
id: 06
kind: template
owns: none
uses: result_handoff_shape, handoff_status, terminal_stop_reason, canonical_record_admission, completion_evidence
-->

This non-normative template captures Result Handoff inputs and outputs. Field shape and status vocabulary are owned by the [Delegation and Result Contract](11-delegation-and-result-contract.md). Authority, admission, stop reason, correction, protected-action, and completion meaning are owned by the [Shared Role Execution Contract](13-shared-role-execution-contract.md). Review records are owned by the [Review Execution Contract](14-review-execution-contract.md).

```markdown
# Task Handoff

## Record Metadata

- task_id:
- record_type:
- authoring_role:
- authority_source:
- canonical_record: direct GitHub Issue / PR body or top-level comment URL that exposes the complete record
- prior_record_url:
- cumulative_scope / supersede_scope:
- supporting_records: repository-relative path at full 40-character commit SHA | not_applicable
- Current Role:
- Required Next Role:
- Role Change Authorized By:
- Owner:
- Status:
- Result Handoff status:
- execution_stop_reason:
- Branch:
- Worktree:
- Commit / PR:
- reviewed_full_head:
- finding_closure_flags:

## Purpose and Scope

- Purpose:
- Background:
- In scope:
- Out of scope:

## Inputs

- Normative Contract:
- Schema / API Contract:
- Task Assignment:
- Related PR / commit:

## Outputs

- Files created:
- Files updated:
- Behavior completed:
- Behavior not completed:
- Decisions made and authority:
- Decisions not made:

## Validation

| Command / check | Result / exit | Execution HEAD | Evidence / notes |
| --- | --- | --- | --- |
|  |  |  |  |

- Focused coverage:
- Full regression coverage:
- GitHub checks and checked HEAD:

## Boundary and Impact

- Known failures and risks:
- Existing Run changed:
- Research Artifact changed:
- Schema changed:
- Contract changed:

## Next Action

- Owner:
- Concrete action:
- Preconditions:
- Remaining work:
```
