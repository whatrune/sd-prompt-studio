# Development Routing Contract

<!-- role-contract-meta
id: 09
kind: routing_contract
owns: development_routing
uses: assignment_shape, result_handoff_shape, handoff_status, shared_admission, terminal_stop_reason, same_task_correction, resume_authority, completion_evidence, review_admission, review_finding, review_decision_record
-->

## Purpose

This document selects the development Role and routing path. It does not redefine shared execution, assignment fields, handoff fields, or review behavior.

## Standard Flow

1. Integrated Lead classifies the request and preserves the canonical objective and Issue Scope.
2. Architect Team performs the Repository Reality Check and freezes external contracts when architecture meaning is involved.
3. Integrated Lead creates or verifies the canonical Task Assignment and routes it to one Implementer or Worker Role.
4. The assignee works within the frozen scope and publishes a Result Handoff.
5. The assigned independent reviewer applies the Review Execution Contract.
6. Corrections return to the same task until the review and validation gates are terminal.
7. Protected actions follow the Shared Role Execution Contract.

Implementation MUST NOT be routed when the Repository Reality Check is incomplete, a required fact is `UNKNOWN`, no applicable freeze exists, an external contract has multiple meanings, or frozen architecture conflicts with fresh Repository Reality.

## Validation Routing

Each development task MUST select the applicable Validation profile from the [Shared Role Execution Contract](13-shared-role-execution-contract.md#proportional-validation-and-evidence-reuse). Precedence is `external Contract`, `runtime／integration`, `source-only`, then `documentation-only`. When more than one profile applies, the highest profile controls and applicable lower-profile focused checks are added.

- The assigned Implementer or Worker produces the required command evidence once for the implementation full HEAD.
- The assigned reviewer evaluates semantic coverage and findings from admissible evidence and uses only the limited rerun conditions in the Review Execution Contract.
- Integrated Lead verifies identity, authority, completeness, dependency, and state; it does not repeat specialist Validation or semantic review.
- A protected-action operator performs only the fresh mutable-state and exact-HEAD check required immediately before the authorized action; it does not repeat implementation Validation.

An `external Contract` change always requires separate Architecture Review. A `source-only` task MUST be promoted to `runtime／integration` when production consumers or impact are `UNKNOWN`; routing MUST NOT use static source or test-only evidence as runtime proof.

## Routing Matrix

| Work | Primary Role | Independent review |
| --- | --- | --- |
| Architecture, public API boundary, contract meaning, responsibility ownership | Architect Team | separate Architect reviewer |
| Backend implementation, validator, storage, artifact processing | Backend Implementer | Backend Architect or assigned implementation reviewer |
| Frontend implementation, interaction, accessibility, UI state | Frontend Implementer | Design Reviewer; Backend Architect also when backend contracts are affected |
| Mechanical documentation, inventory, metadata-only correction | Worker | assigned reviewer appropriate to the artifact |
| Research observation or claim work | applicable Research Operations Role | applicable Research reviewer |

A Role MUST NOT be selected merely because it can technically edit the target file. Selection follows decision ownership and frozen scope.

## Task Boundaries

- Contract change and implementation are separate assignments.
- Architecture Review and Implementation Review are separate review responsibilities.
- A task MUST identify one primary objective, allowed and forbidden scope, exact base or HEAD, branch and worktree, expected outputs, validation, and review owner.
- Issue Scope MUST NOT expand during correction.
- A same-purpose, same-scope gap or review correction MUST return to the same task, branch, worktree, and PR.
- A genuinely new objective or externally visible contract change requires Architect Team and Product Owner routing; this contract does not authorize creation of that new task.

## Return Routes

| Condition | Route |
| --- | --- |
| Missing or conflicting external contract; Reality mismatch | Architect Team as `architecture_gap` |
| Internal implementation choice within frozen behavior | assigned Implementer |
| Review finding | same task and assignee, then the same review authority for closure |
| Missing authority or unavailable external system | responsible owner as `external_blocker` |
| Product trade-off or Merge decision | Product Owner |

Stop reason, Resume authority, completion evidence, canonical record admission, and protected actions MUST use the [Shared Role Execution Contract](13-shared-role-execution-contract.md). Review MUST use the [Review Execution Contract](14-review-execution-contract.md). Assignment and Result Handoff fields MUST use the [Delegation and Result Contract](11-delegation-and-result-contract.md).
