# Shared Role Execution Contract

<!-- role-contract-meta
id: 13
kind: contract
owns: shared_admission, canonical_record_admission, protected_actions, terminal_stop_reason, same_task_correction, resume_authority, completion_evidence, finding_closure_authority, context_resistance_matrix
uses: assignment_shape, result_handoff_shape, handoff_status
-->

## Purpose and Ownership

This document is the sole normative owner for shared admission, canonical-record admission, Repository Reality Check, protected actions, terminal stop reasons, same-task correction, Resume authority, completion evidence, finding-closure authority, Merge sequencing, and context-resistance behavior. Role Charters apply these rules and define only Role-specific deltas.

Task Assignment and Result Handoff fields are owned by the [Delegation and Result Contract](11-delegation-and-result-contract.md).

## Shared Admission

Before work begins, the assignee MUST fresh-fetch and verify, as applicable:

- the canonical task and latest cumulative authority record;
- `task_id`, `record_type`, `authoring_role`, and authority source;
- direct canonical URL, prior record URL, and cumulative or superseded scope;
- objective, acceptance criteria, allowed and forbidden changes, and non-goals;
- exact base or reviewed full HEAD, branch, worktree, and repository;
- assigned Role, review Role, and protected-action actor;
- required inputs, outputs, validation, and completion conditions; and
- open findings, closure flags, and Resume conditions.

Each authority-bearing record MUST expose `task_id`, `record_type`, `authoring_role`, `authority_source`, and `canonical_record` when those fields apply.

Missing, conflicting, stale, inaccessible, or Role-incompatible authority MUST fail closed. The assignee MUST NOT infer omitted authority from chat, memory, a PR description, a Gate Status projection, static source presence, or CI success.

## Canonical Record Admission

For a new or migrated live record, `canonical_record` MUST be a direct GitHub Issue or PR body URL, or a direct top-level comment URL, from which the complete record can be fresh-fetched. A repository-relative Markdown path is not a canonical record. It MAY be cited as a `supporting_record` only with a full 40-character commit SHA.

Records within one task are cumulative, not “latest comment wins.” Admission MUST verify task identity, record type, authoring authority, predecessor relation, cumulative scope, superseded fields, exact-HEAD binding when applicable, and internal consistency. A projection, mirror, inline thread, check run, or derived status MUST NOT replace its authority record.

If a canonical source cannot be fetched or validated, execution MUST stop as `external_blocker`. The missing content MUST NOT be reconstructed.

## Repository Reality Check

Architecture MUST begin with a current Repository Reality Check. For every fact required by the proposed contract, the Architect MUST identify and verify the actual:

- owner;
- runtime host;
- public production entrypoint;
- production caller and consumer;
- caller-to-callee path;
- file and symbol; and
- producer, consumer, and state owner.

Static source, a type, a barrel export, a test runner, a fixture, or a proof harness does not establish production reachability. Production reachability requires an incoming production edge from the composition host. A zero-consumer component MUST be classified as intentionally library-only, disconnected, test/proof-only, or `UNKNOWN`; it MUST NOT be described as runtime-connected without evidence.

If any required fact remains `UNKNOWN`, the architecture MUST NOT be marked Implementation Ready. The record MUST state only the additional evidence required to resolve the unknown.

## Architecture Gap and Implementer Discretion

An `architecture_gap` exists only when external contract meaning is missing or conflicting, or when frozen architecture conflicts with fresh Repository Reality. Internal implementation details that preserve the frozen public contract and observable behavior belong to the assigned Implementer. They MUST NOT be elevated to Architecture Gap.

Issue Scope MUST NOT expand while resolving a gap. A gap or correction with the same objective and scope MUST return to the same task, branch, worktree, and PR. A new objective or externally visible contract change requires separate authority; this contract does not create it.

## Role Authority

- Product Owner owns product decisions and exact-HEAD Merge or Revert decisions.
- Architect Team owns architecture meaning and external contract freeze.
- Integrated Lead owns routing and same-task Resume Dispatch after valid closure.
- The assigned Implementer owns internal implementation choices within frozen behavior.
- The assigned reviewing Role owns its review decision and finding closure.
- A protected-action operator owns only the authorized mechanical action, not the decision that authorizes it.

Technical ability, repository write access, or GitHub permission MUST NOT be treated as Role authority.

## Protected Actions

Protected actions include Ready for Review, Approve, Merge, Revert, branch publication, Issue creation or closure, authority or completion-state changes, and any other action marked protected by the task.

A protected action MUST have:

- an explicit action and authorized actor;
- a direct authority record;
- the exact repository, PR, branch, and HEAD when applicable;
- satisfied prerequisite gates;
- a permitted method; and
- a completion record containing before and after state.

Authority for one protected action MUST NOT be reused for another. A recommendation, handoff, review result, approval-equivalent finding, or Gate Status row does not itself authorize the action.

| HEAD change effect | Required treatment |
| --- | --- |
| prior Ready evidence | historical at the prior HEAD; return to Draft if the PR was Ready, then repeat required gates and Ready |
| prior approval | historical at the prior HEAD; obtain fresh review and approval |
| prior Merge completion combined with a later open-PR HEAD | canonical conflict; stop `blocked` and escalate |

## Merge Decision and Merge Operation

Merge decision and Merge operation are separate authorities. The canonical sequence is:

1. Ready for Review completes.
2. The current Ready-triggered review generation becomes terminal.
3. All review threads for that generation are fetched and confirmed.
4. The exact PR HEAD is rechecked after thread confirmation.
5. Product Owner issues a Merge decision bound to that exact HEAD.
6. The explicitly designated Merge operator performs the authorized mechanical Merge operation.

Every step MUST complete in order. `Ready < Merge < review terminal` is a Merge-gate sequencing failure. CI success, an earlier Ready cycle, an earlier reviewed HEAD, or a pre-terminal thread count MUST NOT satisfy the sequence.

The Product Owner's decision MUST NOT be inferred from the operator assignment. The operator MUST NOT decide Merge eligibility, change the approved HEAD, substitute a prohibited Merge method, or continue when the exact HEAD differs.

## Failure and Terminal Stop Reasons

Execution is fail-closed. The terminal stop reason MUST describe the actual boundary:

| Stop reason | Use |
| --- | --- |
| `completed` | the assigned work and required evidence are complete |
| `architecture_gap` | external contract meaning is missing/conflicting or frozen architecture mismatches Repository Reality |
| `external_blocker` | required authority, service, runtime, tool, or source cannot be accessed |

These are the only three `execution_stop_reason` values. Validation failure and insufficient authorized scope MUST use an existing Result Handoff status together with the applicable existing stop reason: `completed + needs_followup` only when the assigned review or investigation and its required validation are complete and the correction is recorded; `architecture_gap + blocked` for missing or conflicting external meaning or a Repository Reality mismatch; or `external_blocker + blocked | failed` when authority, repository state, tooling, runtime, or another external condition prevents safe completion. They MUST NOT introduce another stop reason.

Progress-only reporting is not terminal. The assignee MUST continue through authorized completion while safe in-scope work remains. A Review Task that completes its assigned review and records blocking findings MAY finish as `completed` with handoff status `needs_followup`; this does not complete the reviewed artifact. A verified non-applicable task MAY finish as `completed` with status `not_applicable`.

## Same-Task Correction

Metadata inconsistency, review correction, Architecture Gap closure, validation repair, and other work with the same objective and Issue Scope MUST remain on the same task. The correction MUST preserve cumulative authority and record what changed, what remained unchanged, the new exact HEAD if any, and which prior evidence became historical.

A correction record does not close a finding, authorize Resume, or grant a protected action unless the responsible authority explicitly records that separate result.

## Resume Authority

Architecture closure alone does not resume implementation. After Architect Team records valid same-task closure, Integrated Lead MUST verify the closure and publish a same-task Resume Dispatch. Resume MUST identify the exact closed gap, current cumulative scope, remaining findings, assigned Role, branch, worktree, and applicable HEAD.

Resume MUST NOT expand scope, close review findings, replace validation, or authorize a protected action.

## Review Finding Closure Authority

Only the Role holding the original review authority MAY close that finding. Closure requires a fresh full-HEAD review, finding-specific closure state, and direct canonical Review Decision. A code change, author assertion, Architecture Amendment, CI pass, resolved UI thread, or metadata projection MUST NOT close the finding by itself.

Review execution details are owned by `docs/team/14-review-execution-contract.md`.

## Completion Evidence

Completion MUST be supported by direct evidence for:

- the exact objective and acceptance criteria;
- changed-file scope and forbidden-file preservation;
- required focused and regression validation;
- exact command results and exit status;
- required runtime or Preview evidence bound to the exact HEAD;
- review and finding state;
- protected-action state; and
- unresolved or unperformed items.

Static source presence is not runtime proof. Test success is not protected-action authority. A Gate Status Publisher, PR body, or other projection reports canonical state but MUST NOT create or close it.

## Shared Execution Result Mapping

| execution_stop_reason | Result Handoff status | Meaning |
| --- | --- | --- |
| `completed` | `completed` | assigned work and required evidence are complete |
| `completed` | `completed_with_warnings` | assigned work is complete with explicit non-blocking warnings |
| `completed` | `needs_followup` | assigned review or investigation is complete and the target needs follow-up |
| `completed` | `not_applicable` | evidence proves that the assigned condition does not apply |
| `architecture_gap` | `blocked` | external contract meaning is missing, conflicting, or mismatched with Repository Reality |
| `external_blocker` | `blocked` or `failed` | authority, service, runtime, tool, or source prevents execution |

## Context-Resistance Regression Matrix

| ID | Scenario | Applicable Role | Expected authority decision | execution_stop_reason | Result Handoff status | Allowed action | Forbidden action | Required canonical record | Resume condition |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `CR-01` | A required frozen projection is undefined | Implementer / Worker / Reviewer / Integrated Lead / Architect Team | Only Architect Team freezes the gap | `architecture_gap` | `blocked` | record and route the exact gap | infer a projection or alter fields | gap handoff and cumulative Architecture Amendment | Integrated Lead same-task Resume Dispatch |
| `CR-02` | Builder output conflicts with a closed validator | Backend Implementer / Backend Architect / Reviewer / Integrated Lead | public contract is not weakened for implementation convenience | `architecture_gap` | `blocked` | record production-entry evidence and exact mismatch | cast around or weaken validation | Architecture Gap handoff | exact projection freeze and Integrated Lead Resume |
| `CR-03` | CI is green but an architecture matrix row is unconsumed | Reviewer / Implementer / Integrated Lead | target is not complete or approval-equivalent | `completed` | `needs_followup` | record changes required and the missing row | close from CI alone | Review Amendment | run every row on new HEAD and reviewer closes |
| `CR-04` | HEAD changes after a Review Amendment | Implementer / Reviewer / Integrated Lead | finding remains open | `completed` | `needs_followup` | review the new HEAD | implicit closure from push | new Review Decision with closure flags | reviewer explicitly closes each finding |
| `CR-05` | Architecture Amendment exists but Resume Dispatch does not | Implementer / Architect Team / Integrated Lead | Implementer has no Resume authority | `external_blocker` | `blocked` | report missing Resume record | resume from Amendment alone | Integrated Lead Resume Dispatch | valid same-task Resume Dispatch |
| `CR-06` | stale PR body conflicts with fresh Issue record | All Roles | fresh valid cumulative Issue record controls | `continue` | `not_terminal` | mark stale data unverified | prefer stale self-report | conflict and evidence in final handoff | continue after canonical chain is established |
| `CR-07` | an out-of-Role contract change is technically possible | Implementer / Worker / Reviewer | no authority to change meaning | `architecture_gap` | `blocked` | return exact required change to Architect Team | change schema, contract, or API meaning | gap handoff | Architect freeze and Integrated Lead Resume |
| `CR-08` | progress report is offered as terminal | All Roles | reject as terminal result | `continue` | `in_progress` | continue to terminal condition | convert acknowledgement into Result Handoff | terminal handoff only | terminal condition is met |
| `CR-09` | session memory conflicts with repository canonical state | All Roles | repository canonical state controls | `continue` | `not_terminal` | discard memory and reevaluate | fill authority from chat summary | fresh sources listed in handoff | continue after fresh fetch |
| `CR-10` | canonical URL is known but unavailable | All Roles | authority cannot be verified | `external_blocker` | `blocked` | stop with evidence | infer source content or status | blocker handoff | canonical source becomes fetchable |
| `CR-11` | review completes with a blocking finding | Reviewer / Integrated Lead | review completes; target needs follow-up | `completed` | `needs_followup` | record changes required | misclassify as Architecture Gap or merge-ready | Review Decision | reviewer rechecks corrected new HEAD |
| `CR-12` | repository-relative Markdown is the only canonical record | Assignee / Integrated Lead | canonical admission fails | `external_blocker` | `blocked` | request direct GitHub URL and retain path as supporting record | bind authority to mutable path | direct Task Issue or PR URL | direct URL is canonicalized |

These cases are mandatory shared behavior; Role Charters MUST NOT redefine them.

### Issue #163 Walkthrough

When Issue #163 Amendment 007 exposes a Checkpoint projection conflict, `CR-01` and `CR-02` require `architecture_gap + blocked`. Amendment 002 can freeze architecture meaning, but it does not close a review finding or authorize Resume. Until Integrated Lead records a valid same-task Resume Dispatch, `CR-05` requires `external_blocker + blocked`.

<!-- Legacy validator anchors. Non-normative; the English rules above are canonical.
Task Assignmentに明示的なauthorityがない限り、すべてのRoleで次を禁止する。
Review correctionとArchitecture gap closureは、原則として同じ`task_id`、branch、worktree、PRを維持する。
Integrated LeadだけがResume Dispatchを記録する。
migration後のlive Taskでは、Task Assignment、Architecture Amendment、Resume Dispatch、Review Decision / Amendment、Result Handoffの`canonical_record`
同じreview authorityを持つRoleだけがfindingをcloseする。
-->

## Validation Baseline

Contract and implementation validation MUST cover applicable positive, negative, boundary, malformed, unknown-field, duplicate, missing-member, ordering, cross-reference, identity, mutation-isolation, immutability, and failure-path cases. A test-only or alternate entrypoint MUST NOT substitute for the production path when runtime behavior is claimed.

## Compatibility

Pre-migration tasks retain their pinned canonical sources. Applying this contract to an in-progress task requires an explicit same-task cumulative record by the authorized Role; silent retrofit is prohibited.

## Normative Reference Graph

Normative dependency edges run `consumer -> owner`. `role-contract-meta` is the source of truth for ownership and dependency declarations. Literal Markdown links and normative dependencies are validated separately; neither graph may contain a cycle.
