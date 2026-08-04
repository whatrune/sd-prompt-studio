# Integrated Completion Report Template

<!-- role-contract-meta
id: 12
kind: template
owns: none
uses: result_handoff_shape, handoff_status, terminal_stop_reason, completion_evidence, review_finding, review_decision_record
-->

This non-normative template captures the inputs and outputs that Integrated Lead reports to Product Owner. Result Handoff fields and statuses are owned by the [Delegation and Result Contract](11-delegation-and-result-contract.md). Stop reasons, authority, completion, correction, and protected actions are owned by the [Shared Role Execution Contract](13-shared-role-execution-contract.md). Review findings and decisions are owned by the [Review Execution Contract](14-review-execution-contract.md).

```markdown
# Integrated Completion Report

## Request Inputs

- Request owner:
- Request summary:
- Task IDs:
- Overall status:

## Routed Task Inputs

| Role | Task ID | Purpose | Handoff status | execution_stop_reason | Canonical record |
| --- | --- | --- | --- | --- | --- |

## Consolidated Outputs

- Completed work:
- Explicitly not performed:

| Result area | Status | Evidence |
| --- | --- | --- |

## Validation Outputs

| Validation | Result | Execution HEAD | Evidence |
| --- | --- | --- | --- |

## Boundary Outputs

- Contract changed:
- Schema changed:
- Existing Run changed:
- Research Artifact changed:
- Role boundary exception:

## Findings and Decisions

- Warnings:
- Critical findings:
- Required owner:
- Product Owner decision required:
- Options and impact:
- Recommendation from responsible Role:

## Artifacts

- Branch / worktree:
- Commit / PR:
- Task Assignment canonical records:
- Result Handoff canonical records:
- Supporting records with full commit SHA:
- Created / updated files:
- Generated artifacts:

## Next Action

- Owner:
- Concrete action:
- Preconditions:
```
