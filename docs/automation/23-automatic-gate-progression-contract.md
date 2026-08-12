# Automatic Gate Progression Contract

**Version:** v0.1.0 (design freeze candidate)
**Task:** `ARCH-AUTOMATIC-GATE-PROGRESSION-CONTRACT-001`
**Canonical task assignment:** <https://github.com/whatrune/sd-prompt-studio/issues/175>

## Status and Runtime Boundary

- Operational contract status: design freeze candidate
- Source / test status: evaluator and continuous-orchestration library modules exist at repository-reality supporting commit `65e84d3d787d4db871f34d4ab1ab452494a61605`
- General production controller status: `UNKNOWN`; no incoming edge from the application composition root or the Protected Transition production host to the automatic progression evaluator/controller is confirmed at that commit
- The live Protected Transition / Repair Executor path documented in the [Automation Overview](00-automation-overview.md) is a separate bounded host and does not prove that this general controller is production-reachable

## 1. Purpose and Ownership

This document owns the operational meaning, responsibility boundary, logical inputs, logical outputs, precedence, progression states, and stop conditions for automatic gate progression. The [implementation mapping](24-pure-automatic-gate-progression-evaluator-design.md) owns source files, symbols, commands, and runtime entrypoints and does not redefine these rules.

A conforming controller advances one existing task from admitted canonical Result Handoffs, Review Decisions, Product Owner decisions, and fresh repository state. This operational description does not assert that a production controller host is reachable. The intended behavior removes routine prompt forwarding without granting a new decision right.

## 2. Normative Dependencies

| Concern | Canonical owner |
| --- | --- |
| Task Assignment, Result Handoff shape, and status | [Delegation and Result Contract](../team/11-delegation-and-result-contract.md) |
| Authority, admission, stop reasons, same-task correction, Resume, Gate Status, and protected actions | [Shared Role Execution Contract](../team/13-shared-role-execution-contract.md) |
| Review evidence, decisions, findings, and closure | [Review Execution Contract](../team/14-review-execution-contract.md) |
| Integrated Lead routing and Resume Dispatch delta | [Integrated Lead Charter](../team/08-integrated-lead-charter.md) |
| Context Health prerequisite | [Context Health and Automatic Handoff Gate Design](22-context-health-and-automatic-handoff-gate-design.md) |

This contract consumes those rules without redefining them. Controller-local states and conditions are not Result Handoff statuses, `execution_stop_reason` values, Role authority, Gate Status values, or GitHub labels.

## 3. Responsibility Boundary

The pure evaluator and the automatic progression controller are separate boundaries. The pure evaluator only evaluates its supplied immutable snapshot and returns `recommend_next_role`; it does not dispatch, write a transition record, author Resume Dispatch, publish metadata, or execute an action.

The controller MAY admit evidence, invoke the evaluator, produce the controller result required by the admitted evidence, request an already-authorized metadata projection, request and record an already-authorized same-task dispatch, and stop. The controller revalidates authority before recording a dispatch; the evaluator recommendation is not dispatch authority.

The controller MUST NOT perform specialist work, choose a Product direction, freeze or change a Contract, infer finding closure, change an Existing Run, create replacement task scope, or execute Ready, Approve, Merge, Revert, rebase, squash, force push, or another protected action. A future protected-action executor remains separately authorized under Team document 13.

## 4. Logical Inputs

Every evaluation uses one immutable input snapshot produced from fresh evidence at `evaluated_at`.

Evaluation MUST be deterministic, total, side-effect-free, non-throwing, and isolated from caller mutation. Unknown, malformed, absent, contradictory, duplicate, or unsupported input fails closed; the controller does not repair, default, fetch by implication, or guess.

| Input | Operational requirement |
| --- | --- |
| Identity | contract version, task, repository, active Assignment revision, evaluation time |
| Task Assignment | direct canonical record, assigned Role, allowed and forbidden action, completion and escalation conditions |
| Result Handoff | direct canonical record, authoring Role, status, stop reason, validation, exact execution HEAD, declared next action when present |
| Review Decision | direct canonical record, PR, reviewed full HEAD, decision, findings, closure flags, correction owner when present |
| Product Owner decision | direct canonical record, exact task/PR/action/HEAD/base/state scope, expiry and one-use state |
| Fresh PR state | PR identity, head/base, open/closed, Draft/Ready, checks, non-outdated reviews and findings |
| Gate Status | fresh PR body projection, current HEAD, gate rows, direct citations, blocker, and next gate |
| Context Health and Resume | admitted records required by the Task Assignment |
| Workspace | assigned branch/worktree identity and clean/available evidence |
| Artifact dependency | bound path, version, full commit SHA, digest, manifest ordering, and review-result URL when required |

Repository, task, Role, PR, branch, worktree, full HEAD, and record URLs compare exactly. Chat, memory, short SHA, text similarity, array position, inline thread alone, CI alone, and uncited PR description are not authority.

Set-like inputs use canonical identity ordering: URLs by unsigned UTF-8 byte order, findings by finding ID, checks by name then URL, and Gate Status rows by their fixed field order. Lists with semantic order preserve supplied order. A duplicate in a set-like input is a structural conflict.

Artifact reconstruction uses only the bound commit and declared manifest procedure. Missing, unreadable, mismatched, or unreconstructable artifact evidence stops fail closed.

## 5. Admission and Precedence

The controller MUST evaluate in this order, with the first failure winning:

1. Validate input shape, duplicate identities, task, repository, and Assignment scope.
2. Fresh-fetch and admit every required canonical record.
3. Verify authoring authority and exact Role, PR, branch, worktree, and HEAD binding.
4. Verify required Context Health and Resume evidence.
5. Verify current PR, checks, review evidence, and artifact dependencies.
6. Stop for an Architecture Gap, canonical conflict, external blocker, or blocking finding.
7. Evaluate action-specific Product Owner decision validity.
8. Compare the Gate Status projection.
9. Select one declared same-task dispatch request, protected-action wait, or no transition.

Canonical Issue and PR records control mutable decisions within their authority domain. Result Handoffs, Review Decisions, Product Owner decisions, and fresh PR state validate different concerns; no general “latest record wins” rule crosses authority domains. Conflicting direct records of the same authority stop as `canonical_conflict`.

PR Body Gate Status is a projection. It never supersedes direct canonical evidence and cannot create authority.

## 6. Logical Outputs

Each evaluation produces exactly one controller result:

| Result | Operational meaning |
| --- | --- |
| `recommend_next_role` | one declared same-task Role and action may be dispatched after required revalidation |
| `wait_for_protected_action` | prerequisites are reported; no protected action is authorized or executed |
| `require_gate_status_update` | an authorized metadata Role must publish and verify the current projection before downstream reliance |
| `invalidate_approval` | prior decision evidence is historical, invalid, or not evaluable; fresh gates are required |
| `stop` | progression fails closed with condition, evidence, recovery owner, and recovery requirement |
| `no_transition` | evidence is admissible but no declared transition exists; the named future canonical event is awaited |

Every result preserves task identity, evaluation time, input identity, precedence trace, canonical evidence, and Gate Status requirement. It does not create a Result Handoff, Review Decision, Resume Dispatch, approval, protected-action completion, or mutation authority.

Branch-specific fields are closed: each result includes all fields required by its selected result and excludes fields belonging to other results. A stop includes the mapped existing stop reason, evidence, recovery owner, and required recovery evidence. A recommendation includes the declared Role/action, predecessor, same-task identity, target HEAD, and idempotency identity. A protected-action wait includes the action and exact unmet prerequisites but no execution command. A Gate Status requirement includes projection facts but no writer or mutation payload.

## 7. Progression States

| State | Meaning | Exit evidence |
| --- | --- | --- |
| `awaiting_evidence` | no admissible triggering record | valid canonical event |
| `evaluating` | complete input snapshot is being classified | one result above |
| `awaiting_result` | a specialist dispatch exists | matching terminal Result Handoff |
| `awaiting_review` | a review dispatch exists | matching Review Decision |
| `awaiting_product_owner` | Product Owner decision is required | matching exact decision |
| `awaiting_protected_execution` | all current prerequisites and exact decision exist | separately authorized sole-action completion record |
| `stopped` | a closed stop condition matched | exact recovery evidence |

These are controller-local states only. `awaiting_protected_execution` is not execution permission.

## 8. Same-Task Dispatch Output

A controller dispatch request or record requires an explicit next Role and action in admitted authority. It MUST preserve `task_id`, Assignment, repository, branch, worktree, PR, cumulative scope, predecessor record, exact target HEAD, and idempotency identity. A duplicate identity returns the existing decision and MUST NOT create another dispatch.

Role identity MUST NOT be inferred from a file, label, reviewer, prior chat, or technical capability. Same-task correction and Resume authority remain owned by Team document 13 and the Integrated Lead Charter.

The controller MAY record a Resume Dispatch only as the transport of Integrated Lead's existing authoring authority and record shape, after the applicable same-task closure and authority are admitted. Integrated Lead remains the Resume Dispatch authoring authority. Neither the controller nor the evaluator gains independent Resume authority.

## 9. Closed Stop and Recovery Conditions

The following controller conditions are exhaustive and do not extend the Team document 13 stop-reason vocabulary.

| Priority | Condition | Controller result | Recovery owner and evidence |
| ---: | --- | --- | --- |
| 1 | canonical record missing, unreadable, malformed, or authority unverifiable | `stopped: external_blocker` | record owner; direct readable record |
| 2 | task, repository, Role, PR, branch, worktree, or exact-HEAD records conflict | `stopped: canonical_conflict` | decision owner for the conflicting authority |
| 3 | current Architecture Gap or unresolved Contract conflict | `stopped: architecture_gap` | Architect Team freeze and required review closure |
| 4 | open or reopened blocking finding | `stopped: blocking_finding` | correction Role, then assigned reviewer closure |
| 5 | blocked Result Handoff or terminal external blocker | `stopped: external_blocker` | named external-condition owner |
| 6 | required Product Owner decision absent, stale, mismatched, expired, or consumed | `awaiting_product_owner` | fresh exact decision |
| 7 | reviewed, validated, approved, or protected-action HEAD differs from current HEAD | `stopped: authority_drift` | fresh validation, review, and decision as applicable |
| 8 | PR/base/state/check/finding snapshot differs from decision scope | `stopped: authority_drift` | fresh current evidence and decision |
| 9 | required exact-HEAD check is missing, non-passing, or unavailable | `stopped: external_blocker` | validation owner produces current evidence |
| 10 | worktree is dirty, missing, or misbound | `stopped: external_blocker` | assigned workspace owner resolves safely |
| 11 | next Role/action is absent, unsupported, or multiply owned | `stopped: ambiguous_role_ownership` | Integrated Lead with the applicable decision owner |
| 12 | Gate Status update or verification fails | `stopped: external_blocker` | authorized metadata Role restores verified projection |
| 13 | duplicate, concurrent, cancelled, or stale transition lock | retain existing decision or `stopped: external_blocker` | controller operator resolves from canonical audit evidence |
| 14 | unrepresented condition | `stopped: external_blocker` | Product Owner or Architect Team routes observable facts |

No approval overrides priorities 1 through 4 or missing exact-HEAD evidence.

## 10. Product Owner Decision and Invalidation

A Product Owner decision applies only to its exact task, repository, PR, action, HEAD, base/state snapshot, scope, expiry, and one-use state. A change in those facts, required checks, finding state, or Gate Status makes it historical, invalid, or not evaluable. The controller records the invalidation and returns to the required fresh gate.

The controller-local decision classification remains current, historical at prior head, invalid, or not evaluable. These descriptions are not persisted Result Handoff statuses or new protected-action authority.

Protected-action sequencing and Merge decision versus Merge operation remain entirely owned by Team document 13.

## 11. Gate Status Projection Output

When current admitted evidence requires a projection correction, the controller outputs only the authorized metadata Role, PR/current HEAD, existing required gate fields, direct citations, current blocker, next gate owner, reason, and post-write verification requirement.

The authorized publisher MUST fresh-fetch, write only the admitted projection, preserve unrelated PR body content and independent Ready/Approve/Merge rows, and re-fetch to verify it. Missing authority, concurrent edit, failed write, malformed body, missing citation, or verification mismatch stops before dispatch or protected action.

## 12. Audit, Opt-In, and Rollback

Every attempted transition records one decision identity, input references, exact PR/head/base, selected result or stop condition, target Role when applicable, idempotency identity, Gate Status outcome, and recovery owner. It excludes secrets, raw prompt payloads, credentials, and private local paths.

Equivalent canonically ordered snapshots produce equal logical results. Evaluation uses only the explicit evaluation time, retains no cross-call state, and converts an unexpected internal condition into a safe external-blocker stop without exposing raw source payload, secret, local path, or stack trace.

Automatic progression is opt-in by Task Assignment. Existing manual tasks are not silently retrofitted. Disabling progression stops new transitions, preserves canonical history and running work, and returns routing to Integrated Lead.

## 13. Operational Acceptance Matrix

| ID | Scenario | Required result |
| --- | --- | --- |
| `AGP-01` | completed handoff names one review Role | exactly one same-task review dispatch after required Gate Status verification |
| `AGP-02` | duplicate delivery | same decision identity; no duplicate dispatch or projection |
| `AGP-03` | HEAD changes after review or decision | affected evidence becomes historical; no protected action or Resume |
| `AGP-04` | blocking finding opens or reopens | stop and name correction owner |
| `AGP-05` | stale Gate Status conflicts with direct evidence | stop or require projection correction; never trust stale projection |
| `AGP-06` | exact-HEAD check evidence is missing | fail closed as external blocker |
| `AGP-07` | current normal-merge decision and all gates exist | wait for one separately authorized normal Merge operation only |
| `AGP-08` | decision scope changes | invalidate and await a new exact decision |
| `AGP-09` | projection write fails | no downstream dispatch or action |
| `AGP-10` | workspace is dirty/misbound or Role ownership is ambiguous | stop with named recovery owner |
| `AGP-11` | required Context Health or Resume record is missing | no Resume; preserve stop boundary |
| `AGP-12` | controller is disabled for a legacy task | no automatic action; manual routing remains available |

## 14. Deferred Operational Scope

Event transport, polling or webhooks, credentials, permission model, scheduler, queue, lock storage, protected-action execution, public forks, and cross-repository operation require separate approved contracts. This document does not authorize them.
