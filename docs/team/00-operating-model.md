# SD Prompt Studio Team Operating Model

<!-- role-contract-meta
id: 00
kind: operating_model
owns: role_taxonomy, precedence, decision_ownership, team_topology
uses: shared_admission, protected_actions, terminal_stop_reason, review_admission, review_finding, review_decision_record, assignment_shape, result_handoff_shape, handoff_status
-->

## Purpose

This document defines Role taxonomy, source precedence, decision ownership, and team topology. Shared execution behavior belongs to the [Shared Role Execution Contract](13-shared-role-execution-contract.md); review behavior belongs to the [Review Execution Contract](14-review-execution-contract.md).

## Protected Baseline

The prompt provenance, camera visibility, image observation, and evidence evaluation contracts established by PR81 through PR86 remain outside this operating model. A task that changes their schema, status, error, hash, artifact, observation, or evidence meaning requires an explicit Product Owner decision and a separate Architect Team contract review.

## Precedence

Within each source's authority, the order is:

1. the latest explicit Product Owner decision;
2. the latest cumulative Architect Team contract record;
3. this operating model and shared team contracts;
4. the applicable Role Charter;
5. the canonical Task Assignment;
6. implementation notes, PR descriptions, and chat.

A lower source MUST NOT weaken a higher source. A conflict MUST be handled through the Shared Role Execution Contract rather than resolved locally.

## Normative Ownership

| Concern | Canonical owner |
| --- | --- |
| Role taxonomy, precedence, decision ownership, team topology | this document |
| Role-specific authority delta | applicable Role Charter |
| Development routing | [Development Routing Contract](09-development-routing-contract.md) |
| Shared admission, protected actions, failure behavior, correction, resume, completion, Merge sequencing | [Shared Role Execution Contract](13-shared-role-execution-contract.md) |
| Review admission, findings, and decisions | [Review Execution Contract](14-review-execution-contract.md) |
| Assignment and handoff fields | [Delegation and Result Contract](11-delegation-and-result-contract.md) |
| Git lifecycle | repository entry guard and the canonical Task Assignment |

Normative dependency edges run from consumer to owner. Navigation links and examples are non-normative. Every `AGENTS.md` and `docs/team/00` through `14` document MUST contain exactly one `role-contract-meta` block with a unique `id`, declared `kind`, `owns`, and `uses`.

## Roles and Decision Owners

| Role | Owned decisions and work |
| --- | --- |
| Product Owner | product priority, product trade-offs, Role changes, final Merge or Revert decision |
| Integrated Lead | intake, classification, routing, state coordination, evidence integration, same-task Resume Dispatch |
| Architect Team | architecture meaning, external contracts, responsibility boundaries, contract freeze, architecture review |
| Backend Implementer | backend implementation and backend validation within frozen contracts |
| Frontend Implementer | frontend implementation, UI behavior, accessibility, and frontend validation within frozen contracts |
| Worker | mechanical research, inventory, metadata, documentation, and other explicitly assigned non-authoritative work |
| Reviewing Role | the review decision and finding closure assigned by the review contract |
| Research Operations Roles | observation, research review, reporting, and other research-specific work under their contracts |

The future Dispatcher is an execution adapter, not a decision owner. Its status remains as documented in [Automation Overview](../automation/00-automation-overview.md).

## Decision Boundary

- Product Owner product decisions MUST NOT silently redefine technical contracts.
- Architect Team MUST NOT delegate unresolved architecture meaning to an Implementer.
- Implementers MUST NOT change frozen external contracts through implementation choices.
- Integrated Lead MUST NOT replace specialist, reviewer, Architect Team, or Product Owner authority.
- A Merge operator MAY execute a Merge only under the exact-HEAD decision and operator binding defined by the Shared Role Execution Contract.

## Delivery Model

The standard lifecycle is product direction, architecture and contract freeze, Task Assignment, implementation, independent review, validation, protected-action sequencing, and completion. Routing details are in the [Development Routing Contract](09-development-routing-contract.md). Admission, correction, resume, and Merge rules are not repeated here.

## Work Item States

| State | Meaning |
| --- | --- |
| `proposed` | objective exists; contract is not frozen |
| `frozen` | contract is implementable and required Repository Reality facts are known |
| `assigned` | Role, scope, inputs, outputs, branch, and worktree are bound |
| `in_progress` | assigned work is executing |
| `review` | Role and contract conformance is under review |
| `merge_ready` | the Merge prerequisites are complete and Product Owner decision is pending |
| `merged` | the exact approved HEAD is merged |
| `blocked` | a canonical blocker prevents progress |

These states do not grant protected-action authority.
