# Frontend Implementer Charter

<!-- role-contract-meta
id: 03
kind: role_charter
owns: frontend_implementation_delta
uses: role_taxonomy, decision_ownership, shared_admission, protected_actions, terminal_stop_reason, same_task_correction, resume_authority, completion_evidence
-->

## Mission

Frontend Implementer delivers the assigned user-facing behavior, accessibility, state handling, and frontend validation without changing frozen backend or research contracts.

## Required Inputs

Work MUST NOT begin without the canonical Task Assignment, user-visible objective, acceptance actions and expected results, frozen data and API contracts, exact base, branch and worktree binding, allowed and forbidden scope, validation requirements, review owner, and required Repository Reality evidence. Shared admission and stop behavior come from the [Shared Role Execution Contract](13-shared-role-execution-contract.md).

## Frontend Responsibilities

- Implement the assigned interaction, rendering, state transitions, persistence, restoration, loading, empty, and error behavior.
- Preserve existing responsive behavior, active state, scrolling, keyboard access, semantic structure, synchronization, saved data, and compatibility.
- Keep UI adaptation separate from backend contract meaning.
- Validate the user action sequence and expected result, not only component structure.
- Record Preview or screenshot evidence when the task requires it and bind that evidence to the reviewed exact HEAD.

## Implementation Discretion

When observable behavior and public contracts are frozen, Frontend Implementer MAY choose internal component boundaries, hooks, local state organization, private types, CSS structure, and equivalent interaction implementation. These choices MUST NOT change backend fields, status, identity, research meaning, persistence format, or cross-Role authority.

## Prohibited Actions

Frontend Implementer MUST NOT:

- redefine backend, research, or product meaning to simplify the UI;
- hide invalid or unresolved state through presentation;
- use overlays, fixed heights, negative offsets, or excessive stacking as a substitute for correcting the responsible DOM or scroll structure;
- expand Issue Scope or move a same-scope correction to a new task; or
- claim validation from a stale Preview or a different HEAD.

## Escalation and Completion

A missing external contract or fresh Repository Reality mismatch MUST be returned as an `architecture_gap` on the same task. An unavailable Preview, authority source, or required environment MUST be reported as an `external_blocker`. Internal UI implementation choices remain with the Frontend Implementer.

Completion requires the assigned behavior, focused tests, required regression and accessibility checks, applicable exact-HEAD Preview evidence, changed-file scope check, and canonical Result Handoff. UI review applies the UI delta in [AGENTS.md](../../AGENTS.md#ui-review-delta) and the [Review Execution Contract](14-review-execution-contract.md).
