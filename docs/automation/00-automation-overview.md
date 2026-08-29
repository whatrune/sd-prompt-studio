# Non-Draft Merge-only Lifecycle V1

## Current production contract

The default-branch workflow `.github/workflows/protected-transition-admission-v1.yml` is the bounded production host for Merge. It checks out its exact default-branch workflow SHA with credentials disabled and invokes `scripts/run-protected-transition-admission-v1.mjs`. The runner uses the pure live-state owner in `scripts/protected-transition-merge-operator-preflight-v1.mjs`.

Only three durable decisions are authoritative:

1. Task Authority in the Task Issue body;
2. one authenticated GitHub Pull Request Review tied to the exact current commit and carrying `APPROVE / 0 / 0 / 0`, or the bounded Task Issue comment compatibility form described below;
3. one Product Owner Merge Decision bound to the exact Task, PR, HEAD, base, scope, Review, merge method, and operation count.

Task-state, Result Handoff, Gate Status, publication generations, historical Ready records, terminal observations, producer rosters, receipts, Minimal Governance, and Bootstrap records are not admission inputs. They may remain historical or diagnostic data only.

## Publication state

Normal autonomous publication creates a non-Draft pull request. Draft is supported only when the Product Owner explicitly requests a manual working state. A Draft pull request is not Merge-eligible, and the autonomous lifecycle does not own Draft-to-Ready conversion.

A HEAD change preserves the GitHub publication state. It invalidates the prior Review and requires current checks plus a fresh exact-HEAD Review only.

## Merge

A final, parser-valid Merge Decision must be present in the initial `issue_comment.created` body on the canonical Task Issue. The workflow treats that event as the operation trigger and identity. It fresh-fetches:

- Task and Task Authority;
- PR state, exact HEAD, and current `main`;
- every changed-file page and exact authorized scope;
- the exact GitHub Pull Request Review;
- the path-aware required-check rollup;
- every review-thread page; and
- mergeability.

The same binding is evaluated again immediately before mutation. The operator then performs one expected-SHA merge through GitHub's closed REST `PUT /repos/{repository}/pulls/{pull_number}/merge` operation with `sha` fixed to the reviewed HEAD and `merge_method` fixed to `merge`. The default-branch job grants `contents: write` only because that endpoint requires it; checks, Issues, Pull Requests, and statuses remain read-only, and all unspecified permissions remain unavailable. The operator has no generic REST write surface and no automatic retry. An explicit `409` or other `4xx` response fails closed, while transport loss, `5xx`, malformed responses, and failed post-Merge verification remain `OUTCOME_UNKNOWN`. After success it re-fetches the PR, `main`, and merge commit and verifies that the exact reviewed HEAD and previous main are the two merge parents.

## Required checks

The closed catalog is:

| Changed paths | Required exact-HEAD checks |
| --- | --- |
| all changes | `build-preview`, `Cloudflare Pages` |
| any `research/sd-prompt-research/**` path | the two checks above plus `validate` |

Missing, pending, cancelled, ambiguous, or unsuccessful required checks stop before a protected mutation. The operator does not create or consume a check-evidence record.

`validate` keeps one canonical check name while `.github/workflows/research-claims.yml` selects a closed validation profile from the complete exact base-to-HEAD NUL-delimited changed-path set. Experiment content, Concept Graph content, and the closed production adapter surface use fixed focused profiles. Validator/framework changes, Schema/Template/shared-contract changes, Workflow/Selector changes, unknown paths, malformed input, default-branch regression, and periodic regression use `FULL_RESEARCH`. A scope change always recomputes the profile from the complete diff. The selected paths, profile, fixed commands, fallback reason, and elapsed stage times are diagnostic log/summary output only; they are not lifecycle evidence.

## Serialization and transport

Task Authority, Review body, and Merge Decision use one Node-owned UTF-8 serializer/parser pair per record. A body must be complete at creation time, contain exactly one fenced JSON block, and round-trip byte-for-byte. When GitHub Pull Request Review publication is unavailable, the exact same Review body may be published once as a top-level comment on the canonical Task Issue and selected explicitly as `TASK_ISSUE_COMMENT`; it is one compatibility surface, not a second semantic decision. Placeholder-then-PATCH publication, PowerShell Markdown interpolation, self-referential URLs, and digest/seal layers are not part of V1.

## Historical automation components

Older Repair, Draft Return, publication replay, Result Handoff, Ready-generation, terminal-observation, Collector, Minimal Governance, and Bootstrap implementations or records are historical. Their presence does not establish current production authority and they must not be used to block or authorize Simplified V1 transitions.

General dispatch, specialist execution, and Result Handoff conventions remain documented by the Team contracts for work coordination. They are separate from the live Review/Merge admission defined here.
