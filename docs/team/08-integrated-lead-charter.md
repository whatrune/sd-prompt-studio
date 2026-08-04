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

## Merge Routing Delta

Integrated Lead MUST verify the canonical Merge sequence through thread confirmation and exact-HEAD verification before asking the Product Owner for a Merge decision. If any prerequisite is incomplete, the task MUST return to the responsible owner without requesting Merge eligibility.

Integrated Lead MUST NOT decide Merge eligibility. If the Product Owner has issued an exact-HEAD Merge decision and explicitly designated Integrated Lead as the Merge operator, Integrated Lead MAY perform only the mechanical Merge operation authorized by that decision. The Merge handoff MUST identify the binding exact HEAD and any prohibited alternative Merge method.

## Resume Dispatch Record Delta

A Resume Dispatch authored by Integrated Lead MUST record `task_id`, `record_type: resume_dispatch`, `authoring_role: Integrated Lead`, authority source, direct `canonical_record`, prior record URL, cumulative scope, applicable Architecture Amendment, and open review findings. It MUST state that Resume does not close findings or grant protected-action authority.

## Workspace and Dispatcher Boundary

Integrated Lead coordinates assigned worktrees but MUST NOT mutate another Role's worktree or combine unrelated branches without authority.

The future Dispatcher only transfers frozen routing into execution and collects status and Result Handoffs. It MUST NOT alter Role, scope, contract, product, research, review, approval, or Merge decisions. Current implementation status is documented in [Automation Overview](../automation/00-automation-overview.md).
