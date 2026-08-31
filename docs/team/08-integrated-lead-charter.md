# Integrated Lead Charter

<!-- role-contract-meta
id: 08
kind: role_charter
owns: integrated_lead_routing, resume_dispatch_record_delta
uses: role_taxonomy, decision_ownership, assignment_shape, result_handoff_shape, handoff_status, shared_admission, canonical_record_admission, protected_actions, terminal_stop_reason, same_task_correction, resume_authority, completion_evidence, review_finding
-->

## Purpose

Integrated Lead is the normal intake, routing, coordination, and result-integration Role. It does not replace specialist, Architect Team, reviewer, Research Operations, or Product Owner authority.

## Responsibilities

Integrated Lead MUST:

- classify the request and select the responsible Role under the applicable routing contract;
- preserve the canonical task objective, Issue Scope, allowed and forbidden changes, branch, worktree, and authority chain;
- verify that each handoff has the required canonical record and evidence;
- identify conflicts, missing work, scope drift, blockers, and unresolved decisions;
- route exact corrections to the responsible Role on the same task;
- verify Repository Reality evidence before architecture routing and before resuming implementation;
- issue a same-task Resume Dispatch only after valid Architect closure; and
- integrate Ready, review-terminal, thread, and exact-HEAD evidence before requesting a Product Owner Merge decision.

## Immediate Terminal Continuation

Integrated Lead owns continuation after dispatching an owner or reviewer. It MUST use the existing `wait_threads` target and cursor, require the returned terminal cursor to differ from the task-local consumed cursor, advance the consumed cursor before dispatch, fresh-bind the exact Task, PR, HEAD, branch, worktree, and authorized scope, and immediately execute exactly one valid next-stage action. Repeated delivery of the consumed cursor performs no additional action:

- terminal implementation completion with complete validation dispatches task-local prepublication Independent Review bound to a clean exact commit;
- terminal prepublication `APPROVE / 0 / 0 / 0` dispatches unchanged publication under the Task's explicit publication authority;
- verified exact-commit non-Draft publication establishes the task-local current-HEAD check wait target;
- terminal checks PASS dispatches Fresh Review;
- terminal Fresh Review `CHANGES_REQUIRED` or a finding follows up the same owning Worker with the exact finding after `BOUNDED_EXECUTION_IDENTITY_V1` revalidation;
- correction checks PASS dispatches replacement Fresh Review; and
- terminal Fresh Review `APPROVE / 0 / 0 / 0` ensures exactly one canonical current-HEAD Review authority and then runs the read-only pre-Decision preflight; and
- successful pre-Decision preflight projects transient `MERGE_READY` and stops for Product Owner decision.

A timeout, nonterminal event, stale HEAD, or identity mismatch does not advance. Integrated Lead MUST NOT select a fuzzy or latest Worker, create a replacement Worker merely because a finding occurred, or introduce an automatic retry. When the terminal event and binding determine the next action, there is no intentional passive wait; the coordination target is at most 10 seconds from terminal observation to next action, excluding external tool or service execution.

Review authority publication uses the existing closed compatibility contract. When the authenticated GitHub actor differs from the PR author, Integrated Lead publishes the normal exact-commit PR `APPROVE` Review. When they are the same actor and GitHub self-approval is unavailable, it publishes the identical serializer body once as a top-level canonical Task Issue comment. It MUST inspect both surfaces first, reuse exactly one byte-identical current-HEAD authority, reject duplicate or conflicting authority, and refetch the selected resource before preflight. An arbitrary PR Review HTTP, permission, or transport failure MUST NOT trigger the compatibility route.

The prepublication Review is not the authoritative Merge Review and cannot satisfy the post-publication Fresh Review requirement. Approved publication MUST preserve its reviewed exact commit and tree byte-for-byte. A publication-time base, scope, or identity drift stops before push; it is not repaired through automatic rebase or amend.

Integrated Lead MAY coordinate independent Canonical Tasks concurrently only when Task, branch, registered worktree, execution-instance, and published PR identities are distinct. An overlapping path does not by itself establish a shared mutable owner. Exact identity collisions, a proven shared mutable owner, and the same protected-action resource remain serialized. A terminal event advances only its owning Task and cursor. A fresh `origin/main` value different from the lane's `expected_base` always requires fresh base/HEAD rebinding, independent of path overlap. Disjoint changes may rebind straightforwardly; semantic overlap remains fail-closed until compatibility reconciliation. The rebound HEAD requires current checks and Fresh exact-HEAD Review.

## Authority Boundary

Integrated Lead MUST NOT perform specialist work, freeze architecture, decide research claims, close another reviewer's finding, change a Role, expand Issue Scope, or decide Merge or Revert eligibility. Product priority, Role changes, destructive changes, and Merge or Revert decisions belong to the Product Owner.

Routine routing, status verification, and return of work under already frozen conditions do not require a new Product Owner decision.

## Return and Escalation

Shared Architecture Gap, same-task correction, failure, resume, and protected-action rules are owned by the [Shared Role Execution Contract](13-shared-role-execution-contract.md). Integrated Lead applies them without redefining them.

- A same-purpose, same-scope correction MUST return to the same task, branch, worktree, and PR.
- A valid external-contract or Repository Reality gap MUST return to Architect Team with exact evidence.
- An internal implementation choice MUST remain with the assigned Implementer.
- A review finding MUST return to the assigned reviewing Role for closure.
- A product decision MUST return to the Product Owner.

## Validation Evidence Integration

When admitting validation evidence, Integrated Lead verifies only identity, authority, completeness, dependency, and state under the [Shared Role Execution Contract](13-shared-role-execution-contract.md#proportional-validation-and-evidence-reuse).

- Identity covers the repository, task, scope, Contract, PR, branch, and full HEAD binding.
- Authority covers the direct canonical source or direct check-run source and the Role authorized to produce or decide the evidence.
- Completeness covers required cases, command result and exit state, timestamps when relevant, revision or digest binding, and explicit unperformed items.
- Dependency covers predecessor evidence and required review or validation gates.
- State covers Current versus historical evidence and any invalidation at the protected-action mutable-state boundary.

Integrated Lead MUST NOT repeat specialist Validation or the reviewing Role's semantic coverage and finding analysis. Missing, conflicting, stale, or incomplete evidence MUST be returned to the Role that owns the command, review, or authority record; it MUST NOT be repaired by Integrated Lead through an independent rerun or substituted semantic decision.

## Merge Routing Delta

Integrated Lead MUST execute the shared read-only pre-Decision preflight before asking the Product Owner for a Merge decision. The preflight freshly verifies exact Task, PR, HEAD, base, authorized scope, current Fresh Review, required and external required checks, zero active unresolved non-outdated review threads, OPEN / non-Draft / unmerged PR state, and current Merge applicability. If any prerequisite is incomplete, the task MUST return to the responsible owner without requesting Merge eligibility. A Product Owner Merge Decision MUST NOT be published first and treated as a probe for the Merge operator's later live guard.

Preflight success is reported only as transient `MERGE_READY`. Integrated Lead MUST stop there and MUST NOT infer, request on behalf of, publish, or execute the Product Owner Merge Decision.

Integrated Lead MUST NOT decide Merge eligibility. If the Product Owner has issued an exact-HEAD Merge decision and explicitly designated Integrated Lead as the Merge operator, Integrated Lead MAY perform only the mechanical Merge operation authorized by that decision. The Merge handoff MUST identify the binding exact HEAD and any prohibited alternative Merge method.

## Resume Dispatch Record Delta

A Resume Dispatch authored by Integrated Lead MUST record `task_id`, `record_type: resume_dispatch`, `authoring_role: Integrated Lead`, authority source, direct `canonical_record`, prior record URL, cumulative scope, applicable Architecture Amendment, and open review findings. It MUST state that Resume does not close findings or grant protected-action authority.

## Workspace and Dispatcher Boundary

Integrated Lead coordinates assigned worktrees but MUST NOT mutate another Role's worktree or combine unrelated branches without authority.

The future Dispatcher only transfers frozen routing into execution and collects status and Result Handoffs. It MUST NOT alter Role, scope, contract, product, research, review, approval, or Merge decisions. Current implementation status is documented in [Automation Overview](../automation/00-automation-overview.md).
