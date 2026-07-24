# Pure Automatic Gate Progression Evaluator: Contract-to-Code Design

**Version:** v0.1.0 (design freeze candidate)
**Task:** ARCH-AUTOMATIC-GATE-PROGRESSION-PHASE1-PURE-EVALUATOR-001
**Canonical task assignment:** <https://github.com/whatrune/sd-prompt-studio/issues/177>
**Authority main:** fabfbd5d58fa3eb50859e553c5681d52b4d51ff5

## 1. Purpose and boundary

This document freezes the contract-to-code boundary for a future pure evaluator,
evaluateAutomaticGateProgressionV1(input). It consumes immutable plain-data
snapshots already collected by an authorized caller and deterministically returns
one recommendation. It performs no GitHub, Git, filesystem, clock, network,
environment, PR Body, Dispatch, Runner, or protected-action I/O.

The evaluator does not create a Result Handoff, Review Decision, Resume Dispatch,
approval, Gate Status mutation, or action authority. A result is data for a
future caller; that caller must separately re-check all existing authority before
any mutation or execution.

## 2. Normative sources and non-ownership

This design consumes, but does not amend:

- [Automatic Gate Progression Contract](23-automatic-gate-progression-contract.md)
- [Context Health and Automatic Handoff Gate Design](22-context-health-and-automatic-handoff-gate-design.md)
- [Delegation and Result Contract](../team/11-delegation-and-result-contract.md)
- [Shared Role Execution Contract](../team/13-shared-role-execution-contract.md)
- [Review Execution Contract](../team/14-review-execution-contract.md)

It owns no Role, Result Handoff status, execution stop reason, Context Health
outcome, Gate Status value, protected-action meaning, or Resume authority.
Existing owners remain normative. Evaluator-local discriminants are not persisted
status values.

## 3. Public logical surface

The future implementation has one pure entry point:

    evaluateAutomaticGateProgressionV1(
      input: AutomaticGateProgressionEvaluationInputV1
    ): AutomaticGateProgressionEvaluationResultV1

It MUST be deterministic, total, side-effect-free, non-throwing, and mutation
isolated. Unknown, malformed, absent, contradictory, or unsupported input becomes
a closed stop result. It never repairs, defaults, fetches, or guesses.

## 4. Input projection

AutomaticGateProgressionEvaluationInputV1 is a deeply immutable snapshot with
only plain data. Every reference is a direct canonical URL where the consumed
contract requires one; local paths, chat text, short SHAs, and implicit ordering
are invalid authority.

| Projection | Required fields | Optional fields | Admission consequence |
| --- | --- | --- | --- |
| identity | contract version, task ID, repository, assignment revision, evaluated at | none | missing or malformed: stop architecture gap |
| task assignment | direct record URL, assigned role, allowed/forbidden actions, completion/escalation conditions | explicit next role/action declaration | unreadable/identity mismatch: external blocker or canonical conflict |
| result handoff | direct record URL, authoring role, status, execution stop reason, exact execution HEAD | recommended next action, branch/worktree/PR identity | absent when required or conflicting: stop |
| review decision | direct record URL, reviewed PR, full reviewed HEAD, decision, blocking findings and closure flags | correction role/action | absent when required or contradictory: stop |
| Product Owner approval | direct record URL, action, task, PR, full approved HEAD, base/state snapshot, scope, expiry/one-use state | none | absent is evaluable as protected-action wait; malformed/conflicting is stop |
| PR snapshot | PR URL, full current head/base, open/closed, Draft/Ready, non-outdated blocking findings | current review state | absent/malformed: external blocker |
| check snapshots | canonical ordered list of name, URL, conclusion, checked full HEAD | none | missing required exact-HEAD evidence: external blocker |
| review thread snapshots | canonical ordered list of thread URL, non-outdated state, blocking classification | none | pointer only; never closes a finding |
| Gate Status projection | PR Body snapshot, projected full HEAD, gate rows, direct citations, current blocker/next gate | none | missing/conflicting when downstream reliance requires it: stop |
| Context Health/Resume | required-by-assignment flag and admitted canonical outcome/reference | none | required but unavailable/non-admitted: stop; healthy alone grants no action |
| workspace snapshot | branch/worktree binding and clean/dirty/available evidence | none | dirty/mismatched/missing: external blocker |

All sets sort by canonical identity: URLs by unsigned UTF-8 byte order; findings
by finding ID; checks by name then URL; gate rows by their existing fixed field
order. Lists whose order has meaning retain supplied order. Duplicates in any set
are structural conflict and stop.

## 5. Closed result union and exact field matrix

AutomaticGateProgressionEvaluationResultV1 has exactly one branch. Every branch
requires result version, kind, task ID, evaluated at, input fingerprint,
precedence trace, and gate status requirement. Input fingerprint is a
deterministic projection identity; this design does not prescribe hashing.

| Kind | Required branch fields | Forbidden branch fields | Meaning |
| --- | --- | --- | --- |
| recommend next role | target role, next action, predecessor canonical URL, exact target HEAD, same-task identity, idempotency key | approval validity, protected action | recommendation only; Integrated Lead may later create a dispatch after revalidation |
| wait for protected action | protected action, wait reason, required approval fields, exact HEAD/base/PR prerequisites | target role, execution command | waits for valid approval or separately authorized executor; never authorizes execution |
| require Gate Status update | authorized metadata role, current full HEAD, required gate fields, direct citation set, projection mismatch/reason | transport instruction, mutation payload, protected-action execution | data requirement only |
| invalidate approval | approval record URL, invalidation reason, historical evidence refs, required fresh gates | protected-action authority, target role | approval is historical/invalid/not-evaluable; no action follows |
| stop | stop condition, mapped existing execution stop reason, canonical evidence refs, recovery owner, required recovery evidence | target role, action authority, mutation request | fail closed; mapping is architecture gap or external blocker only |
| no transition | wait reason, required future canonical event | target role, protected action, mutation request | admissible snapshot has no declared transition; not completion |

Gate status requirement is either not required or a complete require Gate Status
update projection. It does not change the outer branch: a next-role
recommendation can carry an update prerequisite, but a future caller MUST publish
and verify it before acting.

## 6. Deterministic precedence and evaluation order

The evaluator implements Contract 23 precedence exactly:

1. Validate input shape, duplicate sets, task/repository identity, and Task
   Assignment scope.
2. Validate direct Result Handoff and Review Decision authority.
3. Validate Context Health/Resume prerequisite when required.
4. Validate fresh PR state, review-thread evidence pointers, and exact-HEAD
   checks.
5. Detect Architecture gap, canonical conflict, external blocker, or open/reopened
   blocking finding.
6. Evaluate approval validity only after steps 1 through 5 pass.
7. Compare and require the Gate Status projection.
8. Select declared same-task next role/action, protected-action wait, or no
   transition.

A review thread is evidence pointer only. Green CI is evidence only. A PR Body is
a projection only. Product Owner approval is action-scoped only and cannot
override any earlier stop. Same-authority direct-record disagreement is canonical
conflict; no recency rule chooses a winner.

## 7. Stop, invalidation, and transition table

| First matching condition | Result branch | Existing stop mapping / next state |
| --- | --- | --- |
| structural unknown field, duplicate identity, unsupported contract version, or Contract meaning absent | stop | architecture gap |
| required canonical record, PR/check/workspace evidence unavailable or malformed | stop | external blocker |
| task/Role/PR/branch/worktree/HEAD direct records disagree | stop | architecture gap for Contract meaning conflict; otherwise external blocker |
| Architecture gap current | stop | architecture gap |
| Result Handoff blocked or required Context Health/Resume evidence invalid | stop | external blocker |
| open/reopened blocking finding or unresolved non-outdated blocking thread | stop | external blocker; correction remains a human/Integrated Lead decision |
| exact HEAD/base/PR state/check/worktree drift | invalidate approval when approval exists, otherwise stop | historical evidence; fresh records required |
| approval missing, expired, consumed, malformed, or scope mismatch after prior gates pass | wait for protected action or invalidate approval | no protected execution |
| Gate Status missing/stale/conflicting at downstream reliance | require Gate Status update | no dispatch/action until future publisher verifies |
| completed handoff or closed review names exactly one permitted next role/action | recommend next role | same-task recommendation only |
| all evidence admissible but no explicit permitted next action exists | no transition | await named canonical event/owner |

For a stop, recovery owner and required recovery evidence are mandatory. The
evaluator never maps a local condition into a new Result Handoff status.

## 8. Approval invalidation

Approval validity is a closed local enum: current, historical at prior head,
invalid, or not evaluable.

An approval is current only when its direct record, exact task/PR/action, full
HEAD, base/state snapshot, expiry/one-use condition, required current checks,
required review, and no-blocker state all match the input snapshot.

A HEAD/base/PR-state/check/finding/Gate-Status change makes an approval
historical at prior head or invalid; missing authority evidence is not evaluable.
Each produces invalidate approval before any protected-action wait or
recommendation. The evaluator never turns current approval into execution
permission.

## 9. Gate Status update requirement

When current evidence requires a projection correction, the evaluator returns
only data:

| Field | Required meaning |
| --- | --- |
| authorized metadata role | Role already authorized by Task Assignment; never a transport |
| PR URL and current full HEAD | exact target projection identity |
| required gate fields | existing Gate Status field names and allowed existing values |
| citation URLs | sorted direct canonical evidence URLs |
| current blocker and next gate owner | facts from admitted records only |
| reason | stale, missing, conflicting, or historical-at-prior-head projection |
| must verify after write | always true |

No writer, payload formatter, API command, or transport identity is part of this
Phase. A future publisher remains the authorized Role's transport and must
re-admit the result before mutation.

## 10. Determinism, no-throw, and isolation

Equivalent snapshots yield equal logical results after canonical ordering.
Evaluation does not inspect time beyond explicit evaluated at; it does not mutate
input or retain cross-call state. Any internal unexpected condition returns stop
with external blocker, a safe diagnostic category, and no raw source payload,
secret, local path, or stack trace.

The idempotency key for a recommendation is task ID, Assignment revision,
predecessor canonical URL, target role/action, and exact target HEAD in that
order. The evaluator detects duplicate equivalent evidence but does not store
locks or suppress delivery.

## 11. Normative test matrix and future acceptance criteria

| ID | Fixture | Expected branch |
| --- | --- | --- |
| PPE-01 | completed handoff with one declared review role and current evidence | recommend next role |
| PPE-02 | duplicate/reordered equivalent sets | equal deterministic result |
| PPE-03 | direct canonical conflict | stop architecture gap |
| PPE-04 | missing/unreadable canonical record or exact-HEAD check | stop external blocker |
| PPE-05 | Architecture gap, dirty/mismatched worktree, or required invalid Resume evidence | closed stop with named recovery |
| PPE-06 | new/reopened blocker or unresolved non-outdated blocking thread | closed stop; no next role |
| PPE-07 | approval HEAD/base/state/check drift | invalidate approval |
| PPE-08 | valid evidence but absent/expired/mismatched action approval | wait for protected action |
| PPE-09 | stale/missing/conflicting Gate Status projection | require Gate Status update |
| PPE-10 | CI green alone, review thread alone, or PR Body alone | no authority; no action recommendation |
| PPE-11 | malformed/unknown input and unexpected internal failure | non-throwing closed stop |
| PPE-12 | protected action approval is current | wait only; no executor command or mutation |

A future Backend Implementer must implement a pure module with these branches,
readonly/deeply immutable input and result behavior, table-driven fixtures, no
I/O imports, no GitHub client, no clock, no global mutable cache, and no action
executor. Any need to add a branch, source category, status, or authority is an
architecture gap returned to Architect Team.

## 12. Phase split and non-implementation confirmation

1. Phase 1 implementation: pure input validator and evaluator only.
2. Later collector: authorized GitHub/record snapshot acquisition.
3. Later publisher: PR Body update transport under the authorized Role.
4. Later dispatcher: Integrated Lead same-task dispatch transport.
5. Later protected executor: separately approved hardened Draft/Ready/merge
   executor.

This task implements none of those phases. It does not modify PR Body content,
dispatch work, mark Ready, approve, merge, or perform GitHub I/O at runtime.

