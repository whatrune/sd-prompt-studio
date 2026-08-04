# Review Execution Contract

<!-- role-contract-meta
id: 14
kind: contract
owns: review_admission, review_finding, review_decision_record
uses: assignment_shape, result_handoff_shape, handoff_status, shared_admission, canonical_record_admission, protected_actions, terminal_stop_reason, same_task_correction, resume_authority, completion_evidence, finding_closure_authority
-->

## Purpose and Dependencies

This document is the sole normative owner for review admission, review findings, and Review Decision records. Shared authority, Repository Reality, protected actions, failure behavior, correction, Resume, completion, finding-closure authority, and Merge sequencing come from the [Shared Role Execution Contract](13-shared-role-execution-contract.md). Assignment and Result Handoff shapes come from the [Delegation and Result Contract](11-delegation-and-result-contract.md).

## Review Admission

At review start and immediately before recording the decision, the reviewer MUST fresh-fetch:

- the canonical Task Assignment and cumulative authority records;
- the reviewed PR, branch, and full 40-character HEAD;
- the frozen contract and Repository Reality evidence applicable to the task;
- changed files, commits, checks, validation records, and Result Handoff;
- prior Review Decisions, findings, closure flags, and current review threads; and
- protected-action evidence relevant to the requested decision.

The reviewer MUST stop when authority is missing, stale, conflicting, inaccessible, or bound to another HEAD. Chat, memory, PR description, source presence, CI success, and Gate Status projection MUST NOT substitute for direct evidence.

## Review Order

1. Verify the task objective and observable acceptance criteria.
2. Verify frozen contracts, Issue Scope, allowed changes, and forbidden changes.
3. Verify production behavior and failure paths through the public production entrypoint when runtime behavior is claimed.
4. Verify focused positive, negative, boundary, malformed, and task-required matrix cases.
5. Verify regression and GitHub checks against the same reviewed full HEAD.
6. Verify preserved behavior, data, state, identity, safety, and compatibility.
7. Record every finding and the final decision in the direct canonical Review Decision.

Architecture Review MUST also verify the Repository Reality Check. A required `UNKNOWN` fact prevents Implementation Ready or approval-equivalent status.

If the objective, acceptance criteria, or required matrix is incomplete, the reviewed artifact MUST NOT be marked complete, approval-equivalent, or merge-ready. A reviewer that completed the assigned review and recorded blocking findings MAY complete the Review Task as `completed + needs_followup`.

## Evidence Standard

- Evidence MUST identify source, command or observation, result, timestamp when relevant, and exact HEAD.
- Runtime claims require runtime-path evidence; static declarations, barrel exports, fixtures, and test-only calls are insufficient.
- Failure-path evidence MUST show the expected stop behavior and absence of forbidden downstream effects.
- Unperformed checks MUST remain unperformed.
- An unconsumed architecture matrix row is a blocking finding.

## Gate Status Overlay

Before relying on Gate Status, the reviewer MUST fresh-fetch the PR body and every cited canonical record. The reviewer MUST verify current HEAD, applicable Final Regression and Operational Validation results, Draft or Ready state, independent Ready, Approve, and Merge fields, current blocker, and next gate.

A stale, missing, or conflicting Gate Status entry is a review finding. The reviewer MUST require same-task metadata-only correction and the dependent read-only gate MUST be rerun. The reviewer MUST NOT silently repair metadata or treat CI success as completion.

After a HEAD change, prior Ready and approval evidence become historical at the prior HEAD. If the PR was Ready, a recorded return to Draft and fresh applicable gates, review, and Ready are required. A completed Merge combined with a later open-PR HEAD is a blocking canonical conflict.

## Review Decision Record

A Review Decision or Amendment MUST be a top-level Task Issue record with a direct `canonical_record` URL. PR review UI and inline threads are evidence mirrors, not the canonical record.

Its authority metadata includes `task_id`, `record_type`, `authoring_role`, `authority_source`, and `canonical_record`.

The record MUST include:

- `task_id`, record type, authoring and reviewing Role, authority source, and prior record;
- repository, PR, branch, reviewed full HEAD, and review scope;
- objective and acceptance result;
- evidence and validation results;
- cumulative findings with stable IDs, severity, required correction, and closure state;
- decision: approval-equivalent, changes required, or blocked;
- execution stop reason and Result Handoff status;
- protected-action state and next owner; and
- unresolved and unperformed items.

A repository-relative document MAY be attached only as a supporting record with its full commit SHA.

## Findings and Closure

- Each finding MUST identify the violated contract or acceptance condition, evidence, affected HEAD, severity, and required correction.
- Findings remain cumulative until the original review authority closes them in a fresh full-HEAD Review Decision.
- A code change, author response, resolved UI thread, Architecture Amendment, CI pass, or Gate Status update MUST NOT close a finding by itself.
- An Architecture Gap finding MUST identify only the missing external meaning or Reality mismatch and return it to Architect Team.
- Architect closure requires Integrated Lead's valid same-task Resume Dispatch before implementation resumes.

## Capability Boundary

The reviewer MAY inspect and report within assigned review authority. The reviewer MUST NOT modify implementation, metadata, protected-action state, or authority records unless separately assigned that action. When GitHub `APPROVE` is forbidden, the reviewer records only the approval-equivalent decision and evidence.

Role-specific review vocabulary and authority remain with the applicable reviewing Role.

## Ready-Triggered Review Observation

For an exact repository, PR number, Ready-triggered generation, and expected head SHA, the owner-only Ready Review Terminal Observation Collector V1 is the production observation boundary for submitted reviews and no-findings correlation.

Its adapter MUST fetch one GraphQL snapshot containing PR identity, current head, review generation, review terminal state, reviews, and review threads. The pure core validates and projects that supplied snapshot; it MUST NOT perform ambient GitHub access, read environment-selected scenarios, or accept caller-supplied transport as production evidence.

Transport or GitHub command failure is adapter-private and MUST NOT be reported as a core observation rejection. Core rejection and adapter failure MUST remain distinct. Collector V1 records observation; it does not classify findings, close threads, authorize Ready or Merge, complete a task, or publish Gate Status authority.

For Merge-gate review, the current Ready-triggered generation MUST be terminal before its thread snapshot is complete. The reviewer then MUST inspect every returned thread and recheck the exact PR HEAD. An earlier Ready generation, pre-terminal thread count, or earlier reviewed HEAD is insufficient.

If Merge occurred before the current generation became terminal, the reviewer MUST record the exact Ready, Merge, terminal, and thread timestamps as a blocking sequencing finding. A later technical finding MUST NOT be reclassified as post-Merge-only when this ordering failure exists.

Automated evaluation of review-terminal rules and Completion or Gate Status authority binding by a pure Evaluator V2 is a future candidate. Evaluator V2 is not a prerequisite for the current human-led Merge sequence. Any future evaluator MUST consume the exact sealed Collector V1 artifact and MUST NOT replace production observation with a fixture, test runner, barrel export, ambient lookup, mutable global, preload, or alternate production entrypoint.

## Terminal Review Result

The reviewer MUST publish one canonical terminal result:

- approval-equivalent when all required review conditions pass and no blocking finding remains;
- changes required when review completed and blocking correction is assigned; or
- blocked when review cannot complete because required authority or evidence is unavailable.

This result completes only the Review Task. Ready, Approve, Merge, finding closure, metadata correction, and artifact completion remain separate authorities and records.
