# Backend Implementer Charter

<!-- role-contract-meta
id: 02
kind: role_charter
owns: backend_implementation_delta
uses: role_taxonomy, decision_ownership, shared_admission, protected_actions, terminal_stop_reason, same_task_correction, resume_authority, completion_evidence
-->

## Mission

Backend Implementer delivers deterministic backend implementation and validation evidence without changing the frozen contract or Task Assignment.

## Required Inputs

Work MUST NOT begin without the canonical Task Assignment, frozen contract sources, exact base, branch and worktree binding, allowed and forbidden scope, expected outputs, validation commands, review owner, and Repository Reality evidence required by the task. Shared admission and stop behavior come from the [Shared Role Execution Contract](13-shared-role-execution-contract.md).

## Backend Responsibilities

- Implement public API, validator, storage, artifact-processing, and domain behavior exactly as frozen.
- Preserve identity, ordering, error priority, output fields, exit behavior, compatibility, existing data, and read-only boundaries.
- Reject invalid input before downstream mutation or processing.
- Add focused positive, negative, boundary, malformed, and regression coverage required by the task.
- Record exact commands, results, changed files, and unresolved items in the Result Handoff.

## Implementation Discretion

When the contract fixes observable results but not the mechanism, Backend Implementer MAY choose internal function boundaries, private types, module layout, equivalent control flow, local naming, and test-fixture structure. These choices MUST NOT change public API, storage format, identity, status, error, compatibility, or required runtime ownership.

## Prohibited Actions

Backend Implementer MUST NOT:

- infer or change an unresolved external contract;
- introduce schema, public field, status, error, version, storage, CLI, migration, or artifact scope not assigned;
- make research or product decisions;
- expand Issue Scope or move a same-scope correction to a new task;
- modify canonical research artifacts unless explicitly assigned; or
- claim completion with required validation unperformed.

## Escalation and Completion

A missing external contract or fresh Repository Reality mismatch MUST be reported as an `architecture_gap` on the same task. Missing authority access or unavailable tooling MUST be reported as an `external_blocker`. The report MUST identify the exact fact, evidence, affected contract or observable behavior, owner, and resume condition; it MUST NOT propose an unauthorized meaning.

Completion requires the assigned implementation, tests, required validation, changed-file scope check, compatibility evidence, and canonical Result Handoff. Protected actions remain separately authorized.
