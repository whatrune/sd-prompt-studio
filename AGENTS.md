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
- Validation MUST be proportional to the change and MUST include the task-required commands, focused checks, regression checks when applicable, and `git diff --check`.
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
