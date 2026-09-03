# Repository Working Rules

<!-- role-contract-meta
id: AGENTS
kind: entry_guard
owns: repository_entry_guard, repository_implementation_rules, ui_review_delta
uses: role_taxonomy, precedence, decision_ownership, git_lifecycle, integrated_lead_routing, development_routing, research_routing, assignment_shape, result_handoff_shape, handoff_status, shared_admission, canonical_record_admission, protected_actions, terminal_stop_reason, same_task_correction, resume_authority, completion_evidence, review_admission, review_finding, review_decision_record
-->

This file is the repository entry guard for Codex. The user's latest explicit instruction takes precedence within the user's authority. System safety, permission, secret-protection, and material external-side-effect controls remain binding.

## Canonical Rules

- [Team Operating Model](docs/team/00-operating-model.md): precedence, Roles, and decision ownership.
- [Development Routing Contract](docs/team/09-development-routing-contract.md): development routing.
- [Shared Role Execution Contract](docs/team/13-shared-role-execution-contract.md): admission, Repository Reality Check, canonical records, protected actions, failure behavior, same-task correction, resume authority, completion evidence, and Merge sequencing.
- [Review Execution Contract](docs/team/14-review-execution-contract.md): review admission, findings, closure, and review decisions.
- [Delegation and Result Contract](docs/team/11-delegation-and-result-contract.md): Task Assignment and Result Handoff shapes.

Lower-precedence documents MUST NOT weaken these canonical rules. A conflict that the user's instruction does not resolve MUST be returned as an `architecture_gap`.

## Repository Entry Guard

- Work MUST start from the assigned Role, canonical task record, allowed scope, forbidden actions, branch, worktree, and exact base or HEAD.
- Architecture work MUST satisfy the Shared Role Execution Contract's Repository Reality Check before it becomes Implementation Ready.
- Work with a required `UNKNOWN` fact MUST NOT be marked Implementation Ready.
- Architecture Gap, internal implementation discretion, Issue Scope, same-task correction, protected actions, and Merge sequencing MUST use the Shared Role Execution Contract without local reinterpretation.
- Existing user changes MUST be preserved. Destructive Git operations, unrelated cleanup, and scope expansion MUST NOT be performed without explicit authority.

## Immediate Terminal Continuation

- Integrated Lead is the continuation owner for terminal check and review events. After dispatching an owner or reviewer, it MUST wait through the existing `wait_threads` target and cursor and, when that wait reports a terminal event, fresh-bind the exact Task, PR, HEAD, branch, worktree, and authorized scope before taking exactly one valid next-stage action. The returned terminal cursor MUST differ from the task-local consumed cursor and MUST become the consumed cursor before dispatch; repeated delivery of that cursor performs no additional action.
- A terminal implementation Result Handoff with complete validation MUST be refetched from the exact consumed continuation target/cursor and bound to Task, branch, worktree, base, HEAD, execution identity, and scope before the Canonical Task's normal-execution predelegation may commit the exact validated scope once. Caller-supplied handoff or Review fields are not evidence. The subsequent host-refetched prepublication Independent Review is a task-local unchanged-publication gate, not the authoritative Merge Review. Its approval MUST bind the clean exact commit; publication MUST push that exact commit without amend, rebase, additional commit, or tree change and MUST create one non-Draft PR through the same closed predelegated route.
- Verified non-Draft publication MUST immediately establish the task-local current-HEAD check wait target. The publication result MUST fresh-bind the exact Task, branch, worktree, PR, base, HEAD, and authorized scope before waiting.
- A terminal checks PASS result MUST immediately dispatch Fresh Review. A terminal Fresh Review finding MUST immediately follow up the same owning Worker after revalidating `BOUNDED_EXECUTION_IDENTITY_V1`. A completed same-task correction uses one newly activated exact-scope commit grant for its new execution identity and, after its task-local prepublication approval, one exact remote-head-leased successor push to the existing PR; it MUST NOT create another PR. Correction checks PASS MUST immediately dispatch replacement Fresh Review. Fresh Review APPROVE MUST immediately run the read-only pre-Decision preflight.
- Successful pre-Decision preflight projects transient `MERGE_READY` and stops for the Product Owner Merge Decision. `MERGE_READY` is not a durable record, authority, lifecycle state, or permission to Merge.
- A timeout, nonterminal result, stale HEAD, or execution-identity mismatch MUST NOT advance the stage. There is no fallback to a fuzzy or latest Worker and no automatic retry.
- Once the terminal event and fresh binding make the next action deterministic, Integrated Lead MUST NOT enter an intermediate passive wait. The target event-to-next-action latency is at most 10 seconds, excluding the execution time of the wait, GitHub, check, review, or other external tool itself.
- Before requesting a Product Owner Merge Decision, Integrated Lead MUST pass the shared read-only pre-Decision preflight, including zero active unresolved non-outdated review threads. Publishing a Decision first and relying on the Merge operator to reject it later is prohibited.
- After confirmed Merge and successful post-Merge verification, Integrated Lead MUST invoke `scripts/remove-task-worktree-after-merge-v1.ps1` through the exact host-owned bundled `pwsh` executable. Before cleanup, it MUST probe that opaque executable and require PowerShell Core `7.6.4`; Windows PowerShell 5.1, a PATH-selected `pwsh`, alternate-shell fallback, and retry through another shell are prohibited. The existing helper remains the sole cleanup-semantics owner.
- Independent Canonical Tasks with distinct Task, branch, registered worktree, execution-instance, and PR identities MAY run task-local implementation, review, publication, check observation, and pre-Decision work concurrently. An overlapping authorized path alone is not a shared owner and MUST NOT serialize unrelated Tasks; serialization requires an exact identity collision, a proven shared mutable owner, or the same protected-action resource. Any fresh `origin/main` advancement invalidates a lane's `expected_base` regardless of path overlap. Disjoint advancement may use straightforward fresh rebinding, while semantic overlap remains fail-closed pending compatibility reconciliation; either rebind requires current checks and a fresh exact-HEAD Review before protected progression.

## Git and Change Scope

- `gh auth status` MUST NOT be treated as the sole GitHub-access test; repository API access and the required operation must be verified directly when authentication output conflicts with observed access.
- An HTTPS push that changes `.github/workflows/*` requires the applicable workflow scope. SSH fallback MAY be used only after the HTTPS failure is confirmed and matching SSH authority is verified.
- Only assigned files MUST be changed. A required out-of-scope change MUST be reported before it is made.
- Only intended paths MUST be staged; `git add -A` MUST NOT be used in a mixed worktree.
- Commit, push, PR creation, Ready, Approve, Merge, Revert, Issue creation, and external publication are separate actions. Each MUST have explicit authority.
- Additional corrections for an existing PR MUST use its assigned branch and worktree unless the canonical task says otherwise.
- PR descriptions MUST state purpose, user impact, changes, validation, and unresolved items. Issue references MUST NOT auto-close an Issue unless explicitly authorized.

## Implementation and Validation

- Existing contracts, public behavior, compatibility, data, and research artifacts MUST be preserved unless the task explicitly changes them.
- Internal structure that does not change a frozen public contract or observable behavior MAY be selected by the assigned Implementer.
- Validation MUST use the closed profiles and precedence in the [Shared Role Execution Contract](docs/team/13-shared-role-execution-contract.md#proportional-validation-and-evidence-reuse): `external Contract`, `runtime／integration`, `source-only`, then `documentation-only`. The highest applicable profile controls, with any applicable lower-profile focused check added.
- The assigned Implementer or Worker MUST generate the required command evidence once for the applicable exact HEAD. Review and integration MUST reuse admissible evidence under the Shared Role Execution Contract instead of routinely repeating the same command.
- A local Worker or Implementer performing `FULL_RESEARCH` validation MUST invoke `scripts/run-local-full-validation-v1.ps1` from the assigned worktree and provide the exact Task baseline commit; ad hoc reconstruction or normalization of the acquired Python executable is prohibited.
- The coordinator MUST also supply the exact host-owned bundled Python executable. The runner MUST probe that opaque executable with `-B -E -s`, with `PYTHONHOME`, `PYTHONPATH`, and `PYTHONUSERBASE` cleared, and admit only CPython `3.12.13` / `cpython-312` with exact `sys.executable` equality before acquisition. Missing or mismatched identity fails before cache or dependency work; there is no PATH, launcher, registry, or alternate-runtime fallback.
- Validation MUST remain proportional to the change and MUST include the task-required commands, focused checks, regression checks when applicable, and `git diff --check` required by the selected profile.
- Unperformed validation MUST be reported as unperformed; it MUST NOT be represented as passing.
- Preview evidence MUST use the deployment for the target exact HEAD. A stale display requires the latest deployment URL or an explicit cache-busting query.

## UI Review Delta

This section adds UI-specific checks to the [Review Execution Contract](docs/team/14-review-execution-contract.md); it does not redefine review authority or finding state.

- The reviewer MUST state the user-visible objective before assessing implementation details.
- Acceptance MUST be checked as user actions and expected results, including relevant state transitions, persistence, scrolling, and restoration.
- Existing behavior, data, active state, synchronization, and compatibility MUST be checked for regression.
- Structural causes in data flow, state ownership, DOM, and scroll containers MUST be examined before CSS workarounds.
- When a deployed Preview is required, it MUST correspond to the reviewed exact HEAD. A stale deployment MUST NOT be used as evidence.
- UI approval-equivalent evidence requires the objective, acceptance cases, regression checks, applicable Preview checks, and exact-HEAD binding to pass.
- A failure that prevents the primary objective is blocking. A cosmetic issue that does not prevent the objective is non-blocking unless the task defines otherwise.

## PR Request Authoring Delta

- A PR request MUST lead with the user-visible objective and observable success conditions, not an implementation mechanism.
- Recommended implementation structure MUST include its design intent and MUST NOT become a hard requirement unless the contract requires it.
- UI work MUST describe the expected DOM or state ownership when structure is relevant.
- The request MUST identify allowed scope, normally unchanged scope, forbidden actions with reasons, unacceptable outcomes, user-action validation cases, and required build or Preview checks.
