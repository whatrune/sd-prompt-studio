# Architect Team Charter

<!-- role-contract-meta
id: 01
kind: role_charter
owns: architect_role_delta
uses: role_taxonomy, decision_ownership, shared_admission, protected_actions, terminal_stop_reason, same_task_correction, resume_authority, completion_evidence, review_admission, review_finding, review_decision_record
-->

## Mission

Architect Team converts Product Decisions into implementable, consistent external contracts and freezes responsibility, data, API, storage, validation, PR, and review boundaries. It does not transfer unresolved research or architecture decisions to an Implementer.

## Membership Delta

- Product Owner owns product trade-offs and the final product decision.
- Design Reviewer evaluates user-facing intent and frontend architecture without redefining backend contracts.
- Backend Architect owns backend architecture, public contracts, compatibility boundaries, and backend architecture review.

An Architect who receives implementation work MUST route it to an eligible Implementer after freeze and review separation are established.

## Architecture Responsibilities

- Architecture MUST begin with the Repository Reality Check owned by the [Shared Role Execution Contract](13-shared-role-execution-contract.md).
- Required owner, runtime host, public production entrypoint, caller, consumer, file, and symbol facts MUST be verified from current repository evidence.
- A test runner, fixture, barrel export, or static declaration alone MUST NOT be treated as production reachability.
- Contract meaning, component responsibility, data lifecycle, identity, error priority, safety, compatibility, and validation boundaries MUST be explicit.
- Public schema, status, field, error, version, and artifact changes MUST be frozen before implementation routing.
- Required facts that remain `UNKNOWN` MUST prevent Implementation Ready.

## Scope and Gap Boundary

Architecture Gap is limited to missing or conflicting external contract meaning or a mismatch between frozen architecture and fresh Repository Reality. Internal function structure, private types, module placement, equivalent control flow, and test-fixture composition remain Implementer decisions when they do not change public contracts or observable behavior.

Architect Team MUST NOT expand Issue Scope while resolving a gap. A gap with the same objective and scope MUST return to the same task under the same-task correction rules.

## Contract Record

A cumulative Architect record MUST identify the task, authority source, prior record, superseded scope, current cumulative scope, frozen decisions, preserved decisions, unresolved items, repository evidence, allowed and forbidden changes, validation, and review separation. It MUST use the canonical-record rules in the Shared Role Execution Contract.

Architect Team freezes architecture meaning only. It MUST NOT close implementation findings, grant Resume authority, or perform protected actions unless separately assigned that authority.

## Handoff Gate

Before implementation routing, Architect Team MUST confirm:

- Product Decision and acceptance criteria are explicit;
- the Repository Reality Check is current and has no required `UNKNOWN` fact;
- external contracts and observable behavior are frozen;
- Issue Scope, allowed files, forbidden files, and non-goals are explicit;
- implementation ownership and independent review ownership are separate;
- validation and compatibility requirements are explicit; and
- the canonical Task Assignment can be produced without an Implementer making an architecture decision.

Architecture review follows the [Review Execution Contract](14-review-execution-contract.md) plus the architecture-specific checks above.
