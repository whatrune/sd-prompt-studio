# Review Execution Contract

<!-- role-contract-meta
id: 14
kind: contract
owns: review_admission, review_finding, review_decision_record
uses: assignment_shape, result_handoff_shape, handoff_status, shared_admission, canonical_record_admission, protected_actions, terminal_stop_reason, same_task_correction, resume_authority, completion_evidence, finding_closure_authority
-->

## Purpose and Dependencies

This document is the sole normative owner for review admission, review findings, and Review Decision records. Shared authority, Repository Reality, protected actions, failure behavior, correction, Resume, completion, finding-closure authority, and Merge sequencing come from the [Shared Role Execution Contract](13-shared-role-execution-contract.md). Assignment and Result Handoff shapes come from the [Delegation and Result Contract](11-delegation-and-result-contract.md).

For Non-Draft Merge-only Lifecycle V1, one authenticated GitHub Pull Request Review is the preferred authoritative Review surface. It MUST be authored by an `OWNER`, `MEMBER`, or `COLLABORATOR` other than the implementation PR author, be tied to the exact current commit OID, have state `APPROVED`, and carry the closed decision `blocking / remaining / unknown = 0 / 0 / 0`. The bounded Task Issue comment compatibility surface below applies only when Pull Request Review publication is unavailable. A HEAD change makes either surface stale and requires a fresh Review. Task-state, Result Handoff, Gate Status, historical Ready records, and terminal-observation records are status only and do not block or authorize Review or Merge.

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

## Single-Pass Finding Coverage

For one admitted full HEAD, the reviewer MUST inspect the complete assigned scope and applicable acceptance matrix before publishing the terminal decision, and MUST enumerate every finding discoverable from that evidence in the same decision. The reviewer MUST NOT intentionally stop after the first blocker, reserve already-discoverable findings for a later cycle, or split one review into incremental hardening rounds.

A later decision MAY introduce a new finding only when the correction created the defect, material evidence was unavailable during the prior review, or the reviewer explicitly records a prior omission against an existing contract or acceptance condition. A preference, optional hardening, or newly proposed requirement is not a blocking finding for the current task. Required correction MUST be the minimum sufficient change for the admitted finding and MUST NOT expand Issue Scope.

## Evidence Standard

- Evidence MUST identify source, command or observation, result, timestamp when relevant, and exact HEAD.
- Runtime claims require runtime-path evidence; static declarations, barrel exports, fixtures, and test-only calls are insufficient.
- Failure-path evidence MUST show the expected stop behavior and absence of forbidden downstream effects.
- Unperformed checks MUST remain unperformed.
- An unconsumed architecture matrix row is a blocking finding.

## Validation Evidence Review and Focused Rerun

The reviewer independently fresh-fetches and assesses evidence under the proportional Validation and reuse rules owned by the [Shared Role Execution Contract](13-shared-role-execution-contract.md#proportional-validation-and-evidence-reuse). Independent review means an independent semantic coverage and finding decision; it does not mean routinely repeating the Implementer's command.

The reviewer MUST NOT require the same command to be rerun when its evidence is admissible and covers the reviewed acceptance condition. A reviewer rerun is limited to:

- evidence不足: a required command, case, result, exit state, binding, or unperformed item is missing;
- contradiction: direct evidence conflicts with another admitted record or observed state;
- stale: HEAD, Scope, Contract, validator, fixture, workflow, lockfile, toolchain, or applicable mutable state invalidated the evidence; or
- reviewer-specific focused proof: a focused observation is necessary to decide semantic coverage or a finding and is not supplied by the implementation evidence.

The reviewer MUST record the applicable condition and scope of any rerun. A rerun for one condition MUST NOT cause unrelated specialist Validation to be repeated. The final decision remains bound to the fresh reviewed full HEAD.

## Gate Status Overlay

Before relying on Gate Status, the reviewer MUST fresh-fetch the PR body and every cited canonical record. The reviewer MUST verify current HEAD, applicable Final Regression and Operational Validation results, non-Draft or explicit manual-Draft publication state, Approve and Merge fields, current blocker, and next gate.

A stale, missing, or conflicting Gate Status entry is a review finding. The reviewer MUST require same-task metadata-only correction. The dependent read-only gate MUST be rerun unless the Shared Role Execution Contract's projection-only reuse admission conditions are all satisfied. The reviewer MUST NOT silently repair metadata or treat CI success as completion.

The dependent read-only gate MAY reuse verified post-write evidence only under the Gate Status projection-only conditions in the Shared Role Execution Contract. Any HEAD or cumulative-authority change, non-projection edit, missing digest, failed post-write re-fetch, concurrent edit, or mismatch requires rerun and fail-closed handling.

After a HEAD change, prior approval is historical and a fresh exact-HEAD Review is required. GitHub's publication state remains unchanged; no publication-generation replay is required.

## Review Decision Record

A Simplified V1 Review Decision MUST be a GitHub Pull Request Review bound to the exact commit OID. Its body is produced by the repository's Node-owned serializer and parsed by the same closed parser. The closed machine fields are Task Issue number, PR number, reviewed HEAD, decision, and `blocking`, `remaining`, and `unknown` counts. GitHub owns the Review ID, URL, authenticated actor, association, timestamp, and commit binding; these are fresh-fetched rather than copied into a self-bound body.

The legacy authority-metadata vocabulary `task_id`, `record_type`, `authoring_role`, and `authority_source` remains applicable to legacy Issue records. In Simplified V1, `record_type` and `reviewer_role` are body fields while GitHub resource identity plus the bound Task Issue supply the other identity context without self-referential metadata.

When GitHub Pull Request Review publication is unavailable, the exact same serialized Review body may be published once as a top-level Task Issue comment and selected explicitly as the authoritative compatibility surface. It MUST NOT coexist with or override a Pull Request Review decision for the same lifecycle attempt. Legacy Issue-comment Review metadata and Result Handoff fields are status only under Simplified V1.

## Findings and Closure

- Each finding MUST identify the violated contract or acceptance condition, evidence, affected HEAD, severity, and required correction.
- Findings remain cumulative until the original review authority closes them in a fresh full-HEAD Review Decision.
- A code change, author response, resolved UI thread, Architecture Amendment, CI pass, or Gate Status update MUST NOT close a finding by itself.
- An Architecture Gap finding MUST identify only the missing external meaning or Reality mismatch and return it to Architect Team.
- Architect closure requires Integrated Lead's valid same-task Resume Dispatch before implementation resumes.

## Capability Boundary

The reviewer MAY inspect and report within assigned review authority. The reviewer MUST NOT modify implementation, metadata, protected-action state, or authority records unless separately assigned that action. When GitHub `APPROVE` is forbidden, the reviewer records only the approval-equivalent decision and evidence.

Role-specific review vocabulary and authority remain with the applicable reviewing Role.

## Live Review Observation

Review terminal generations, Collector artifacts, producer rosters, and receipts are not part of Simplified V1 admission. The reviewer decides the exact current HEAD once. The Merge operator independently fetches all live thread pages, requires zero active unresolved non-outdated threads, and rechecks the exact HEAD immediately before mutation. This live observation supplements rather than replaces the reviewer's semantic decision.

## Terminal Review Result

The reviewer MUST publish one canonical terminal result:

- approval-equivalent when all required review conditions pass and no blocking finding remains;
- changes required when review completed and blocking correction is assigned; or
- blocked when review cannot complete because required authority or evidence is unavailable.

This result completes only the Review Task. Approve, Merge, finding closure, metadata correction, and artifact completion remain separate authorities and records.
