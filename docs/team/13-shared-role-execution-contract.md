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

## Non-Draft Merge-only Lifecycle V1

For Review and Merge, this section supersedes historical publication-generation and evidence-chain requirements elsewhere in this document. Exactly three durable decisions are authoritative: the Task Authority, one fresh exact-HEAD Independent Review, and the Product Owner's exact-HEAD Merge Decision. Task-state, Result Handoff, Gate Status, Ready history, Collector output, terminal-observation artifacts, rosters, receipts, and publication-generation records may remain useful status or diagnostic projections, but they neither authorize nor block Review or Merge.

A HEAD change invalidates the prior Review and requires current checks plus a fresh exact-HEAD Review. It does not require returning a non-Draft PR to Draft, replaying publication, or rebuilding Ready evidence. Live GitHub state is authoritative at the protected-action boundary.

### Terminal Event Continuation

The Integrated Lead remains the continuation owner after dispatching a Worker or reviewing Role. It MUST wait through the existing `wait_threads` target and cursor. A terminal response is applicable only when its cursor differs from the task-local consumed cursor; the coordinator advances the consumed cursor before dispatching the one action, and repeated delivery of that cursor performs no additional action. An applicable terminal event in the same coordination turn MUST fresh-bind the exact execution identity and perform exactly one deterministic next-stage action: implementation completion to task-local prepublication Independent Review; prepublication APPROVE to unchanged non-Draft publication; verified publication to current-HEAD check wait; checks PASS to Fresh Review; Review finding to the same owning Worker; correction checks PASS to replacement Fresh Review; Fresh Review APPROVE to read-only pre-Decision preflight; or successful preflight to transient `MERGE_READY` and STOP. The finding continuation MUST preserve the exact Task, branch, worktree, HEAD generation, and authorized scope and MUST revalidate `BOUNDED_EXECUTION_IDENTITY_V1` before follow-up.

Timeout, nonterminal state, stale HEAD, and identity mismatch prohibit stage advance. A terminal event MUST NOT create Worker self-resumption, fuzzy Worker selection, automatic retry, a new lifecycle state, or an intermediate passive wait. The event-to-next-action coordination target is at most 10 seconds, excluding external tool or service execution.

For Review publication, the terminal cursor is a wake-up signal only and is never protected-action authority. Authority is the stable Product Owner predelegation plus freshly admitted GitHub state. The exact assignment logical identity is repository + Task + PR + HEAD + protected action + actor + surface + decision. Physical assignment comments with one logical identity and byte-identical canonical semantic payload are equivalent and collapse to one authority; conflicting payloads fail closed. Exact assignment and Review publication remain separate single-attempt mutations with direct refetch, no PATCH, no ambiguous-result retry, and no alternate-surface fallback. Every protected effect requires fresh Task, PR, exact HEAD/base/branch, cumulative scope, Fresh Review, required checks, zero active non-outdated threads, Merge applicability, actor, and surface admission.

The prepublication Independent Review is a task-local unchanged-publication gate bound to one clean exact commit. It is not the authoritative Simplified V1 Review and cannot authorize Merge. Publication requires separate explicit authority and MUST push exactly that reviewed commit without amend, rebase, additional commit, or tree change before creating one non-Draft PR. Current-main, identity, scope, or byte drift stops before publication. The post-publication Fresh exact-HEAD Review remains the only authoritative Merge Review.

`MERGE_READY` is a process-local coordinator outcome proving only that the existing read-only pre-Decision preflight passed. It is not a durable decision, canonical record, lifecycle state, Merge Decision, or protected-action authority. The coordinator stops for the Product Owner after producing it.

Simplified V1 records use the closed fields implemented by the Node serializer/parser: Task Authority binds Task Issue number, repository, objective, authorized paths, the legacy `ready_allowed` compatibility field, and Product Owner; Review binds Task, PR, exact HEAD, decision, and the three finding counts; Merge Decision binds Task, PR, exact HEAD, expected base, authorized paths, Review identity, merge method, and operation count. The parser continues to accept Boolean `ready_allowed` values in existing Task bodies, but the field has no operational effect. GitHub's fresh-fetched Issue, Pull Request Review, and comment identities own actor and resource identity. Generic self-referential `canonical_record`, predecessor, digest, seal, and generation metadata elsewhere in this document do not apply to these three records.

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

### Bounded Execution Admission V1

The process-local identity shape is owned by the [Delegation and Result Contract](11-delegation-and-result-contract.md#bounded-execution-identity-v1). Admission freshly binds every field to the exact registered worktree and current repository state. Any repository, Task, objective digest, branch, worktree, Git common-directory, authorized-path digest, expected base, expected PR, or expected HEAD mismatch stops as `execution_identity_mismatch`; there is no fallback lookup.

The worktree is resolved only from the identity's exact canonical registered path. CWD, fuzzy branch matching, latest related commits, latest PRs, and same-path history are not current identity. Before publication, PR discovery is prohibited. After publication, the consumer requests only `expected_pr`, requires it to be open and unmerged, and verifies its repository, base, and head. A closed or merged PR is historical and cannot become the current target.

Fresh remote `origin/main`, not a local branch named `main`, establishes `expected_base`. Historical commits outside `expected_base..expected_head` may be inspected only when explicitly labelled `historical_diagnostic`; that inspection is never admitted as current execution context.

Disjoint identities may execute concurrently only with unique Task, branch, worktree, execution-instance, and published PR identities. Overlapping authorized paths alone do not establish a shared owner and do not serialize task-local implementation, validation, review, publication, check observation, or pre-Decision work. Serialization requires an exact identity collision, a proven shared mutable owner, or the same protected-action resource. When fresh `origin/main` differs from a lane's `expected_base`, that lane MUST fresh-bind current main regardless of path overlap. A disjoint advance may use straightforward rebinding; semantic overlap MUST remain fail-closed until compatibility reconciliation. Either rebind changes the current exact-HEAD authority and therefore requires current checks plus a Fresh exact-HEAD Review before further protected action. Shared dependencies are read-only and require exact manifest identity; package-manager mutation through a shared dependency junction is prohibited.

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

## Role Progress Transport

`IN_PROGRESS` is an internal same-Role transport signal, not a canonical Result Handoff or a terminal Role result. The assigned Role MUST continue working within the current execution whenever it can still make progress and MUST NOT return `IN_PROGRESS` merely to report ongoing work. It MUST return exactly `IN_PROGRESS` only when the current execution genuinely cannot complete the assigned Role and another execution of the same Role is required.

## Result Handoff Continuation Ownership

A terminal Result Handoff completes the assigned Role; it does not require that Role to perform or authorize the next lifecycle action. After consuming an admissible terminal Result Handoff, the protected-transition consumer host owns continuation under the existing routing and authority rules. The Role MUST return only the requested canonical record body and MUST NOT replace it with status narration or independently invoke a downstream Role.

## Non-Draft Publication Boundary

Normal autonomous publication creates a non-Draft pull request. Draft is available only when the Product Owner explicitly requests a manual working state. Draft pull requests are not Merge-eligible, and the autonomous lifecycle does not own Draft-to-Ready conversion. A HEAD update preserves publication state and requires applicable current checks plus a fresh exact-HEAD Review.

## Protected Actions

Protected actions include Ready for Review, Approve, Merge, Revert, branch publication, Issue creation or closure, authority or completion-state changes, and any other action marked protected by the task. Ready remains protected when a human explicitly performs it for an exceptional manual-Draft PR, but the autonomous lifecycle has no Ready owner or production route.

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
| PR publication state | unchanged; do not return a non-Draft PR to Draft |
| prior approval | historical at the prior HEAD; obtain fresh review and approval |
| prior Merge completion combined with a later open-PR HEAD | canonical conflict; stop `blocked` and escalate |

## Merge Decision and Merge Operation

Before the Product Owner is asked for a Merge Decision, Integrated Lead MUST run the shared read-only pre-Decision preflight. It fresh-fetches and requires the exact Task, open non-Draft unmerged PR, exact HEAD and current main base, every changed-file page and exact authorized scope, the current exact-HEAD Fresh Review, the path-aware required-check rollup, every review-thread page with zero active unresolved non-outdated threads, and current Merge applicability. Failure stops before a Decision request and performs no publication or mutation.

Merge decision and Merge operation are separate authorities. Immediately before Merge, the operator fresh-fetches the open, non-Draft, unmerged PR; exact HEAD and current main; every changed-file page and exact authorized scope; the path-aware required-check rollup; every review-thread page; the exact-HEAD approved Review; and mergeability. It then repeats that live binding once immediately before one expected-SHA Merge mutation. Missing, pending, cancelled, or failing required checks, an active unresolved non-outdated thread, stale Review, HEAD/base/scope drift, or invalid mergeability stops before mutation.

The Merge Decision binds only the Task, PR, exact HEAD, expected base, authorized scope, exact Review identity, merge method, and `operation_count = 1`. Historical Ready generations, publication generations, terminal artifacts, Result Handoffs, and sealed evidence are not Merge inputs.

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

## Proportional Validation and Evidence Reuse

This section is the normative owner for Validation profile selection, authoritative evidence reuse, evidence invalidation, Collector V1 applicability, and Gate Status projection-only reuse. It does not create a Role, Status, Schema, Evaluator, Host, authority, protected action, stop reason, or finding state.

### Profile Selection and Precedence

Every change MUST use exactly one controlling profile. Precedence is:

1. `external Contract`;
2. `runtime／integration`;
3. `source-only`; and
4. `documentation-only`.

When a change matches more than one profile, the highest applicable profile controls. Applicable focused checks from a lower profile MUST still be included. An entry condition that cannot be established MUST use the highest plausible profile, including `external Contract` when Contract meaning may change; it MUST NOT be inferred from a filename or test presence.

#### documentation-only

This profile applies only when every changed path is documentation and the change does not alter an external Contract. Minimum Validation is:

- exact changed-file allowlist;
- `git diff --check`;
- applicable Markdown link and structure validation; and
- confirmation that JSON, YAML, source, workflow, script, test, package, lockfile, fixture, or other non-documentation paths did not change.

Application full test and build are not required by this profile alone. Normative documentation that changes external Contract meaning uses the external Contract profile.

#### source-only

This profile applies only to a pure or library source change with no incoming edge from the production composition host and with a directly verified, closed consumer and impact set. Minimum Validation is:

- exact changed-file allowlist;
- direct focused tests;
- focused regression for every known consumer;
- TypeScript or equivalent static check when applicable; and
- `git diff --check`.

If a production consumer, incoming production edge, or impact remains `UNKNOWN`, the change MUST use `runtime／integration`. Static source, an export, a fixture, or a test-only caller MUST NOT establish runtime non-impact.

#### runtime／integration

This profile applies when production behavior, a production entrypoint or incoming edge, integration behavior, state, persistence, or runtime compatibility changes or may be affected. Minimum Validation is:

- direct focused positive, negative, and failure-path Validation;
- one full regression run;
- one build;
- runtime or Preview evidence bound to the exact full HEAD; and
- applicable state, persistence, compatibility, and `git diff --check` evidence.

Runtime evidence MUST use the public production entrypoint. Static or test-only evidence MUST NOT substitute for it.

#### external Contract

This profile applies to normative Role, authority, routing, API, Schema, Freeze, ownership, or other external Contract meaning. Minimum Validation is:

- `node scripts/test-role-execution-contracts.mjs`;
- every applicable contract-specific fixture or validator;
- exact scope, literal-link, structure, and diff validation;
- `git diff --check`; and
- separate Architecture Review at the exact full HEAD.

If runtime mapping or a production consumer also changes, `runtime／integration` Validation MUST be added.

### Evidence Production and Role Boundaries

- The assigned Implementer or Worker MUST generate required command evidence once for the applicable implementation full HEAD and publish it in the Result Handoff.
- The reviewer MUST independently fresh-fetch the evidence and decide semantic coverage and findings. The reviewer MUST NOT routinely require the same command to be rerun.
- A reviewer rerun is permitted only for missing evidence, contradiction, stale evidence, or reviewer-specific focused proof.
- Integrated Lead verifies only identity, authority, completeness, dependency, and state. Integrated Lead MUST NOT repeat specialist Validation or semantic review.
- A protected-action operator performs only the fresh mutable-state and exact-HEAD check required immediately before the authorized action, followed by that action. The operator MUST NOT repeat implementation or review Validation unless a separate applicable task requires it.

Evidence reuse never transfers Role authority. Command evidence does not make the Implementer a reviewer, semantic review does not grant Integrated Lead finding authority, and admitted evidence does not authorize a protected action.

### Authoritative Evidence Reuse Admission

Evidence MAY be reused across Roles only when every condition below is satisfied:

- the evidence has a direct canonical URL or direct check-run URL;
- its authoring or reviewing authority is valid;
- it is bound to the exact repository, task, scope, Contract, PR, branch, and full HEAD;
- it records the command or observation, result, exit state, and timestamp when relevant;
- it is bound to the applicable validator, fixture, artifact, and workflow revision or digest;
- every required case is present and every unperformed item is explicit;
- no newer cumulative authority conflicts with it; and
- it remains applicable to the same acceptance condition.

Failure of any admission condition requires fresh evidence or fail-closed routing. A summary, PR description, Gate Status projection, static source presence, or CI success without these bindings is not reusable authoritative evidence.

### Evidence Invalidation and HEAD Change

Evidence is invalidated by:

- a HEAD change;
- missing, conflicting, inaccessible, or stale evidence;
- Scope or Contract change;
- validator, fixture, workflow, lockfile, or required toolchain change; or
- the protected-action mutable-state boundary for evidence whose state can change.

After a HEAD change, prior evidence is historical and MUST NOT be promoted to PASS for the new HEAD. A changed-path impact review MUST identify affected Validation. When an unaffected command is not rerun, that decision MUST be recorded as new-HEAD non-applicability evidence with the new full HEAD, changed paths, affected acceptance condition, and rationale. The prior command result remains bound only to its prior HEAD.

At a protected-action boundary, immutable admitted command evidence MAY remain reusable only if every admission condition still holds. Mutable PR state, authority state, review-thread state, and exact HEAD MUST be fresh-fetched immediately before the action.

### Historical Collector Boundary

Collector V1, producer rosters, terminal receipts, Ready generations, and terminal-observation artifacts are not authoritative inputs to Simplified Autonomous Lifecycle V1. They may be retained only as historical or diagnostic information. The Merge operator instead fetches all current review-thread pages and the exact current HEAD directly at preflight and final rebind.

### Gate Status Projection-only Reuse

After an authorized metadata Role changes only an admitted Gate Status projection, a dependent read-only gate MAY consume the publisher's verified post-write evidence without repeating the same read only when:

- HEAD is unchanged;
- cumulative authority is unchanged;
- only the admitted projection changed;
- a before/after digest is present;
- post-write re-fetch succeeded; and
- no concurrent edit or mismatch exists.

If any condition fails, the dependent read-only gate MUST rerun and fail closed. Projection-only reuse does not close findings, change completion authority, replace semantic review, or remove a required Collector V1 or protected-action fresh check.

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
