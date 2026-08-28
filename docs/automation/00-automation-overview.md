# Simplified Autonomous Lifecycle V1

## Current production contract

The default-branch workflow `.github/workflows/protected-transition-admission-v1.yml` is the bounded production host for Ready and Merge. It checks out its exact default-branch workflow SHA with credentials disabled and invokes `scripts/run-protected-transition-admission-v1.mjs`. The runner uses the pure live-state owner in `scripts/protected-transition-merge-operator-preflight-v1.mjs`.

Only three durable decisions are authoritative:

1. Task Authority in the Task Issue body;
2. one authenticated GitHub Pull Request Review tied to the exact current commit and carrying `APPROVE / 0 / 0 / 0`, or the bounded Task Issue comment compatibility form described below;
3. one Product Owner Merge Decision bound to the exact Task, PR, HEAD, base, scope, Review, merge method, and operation count.

Task-state, Result Handoff, Gate Status, publication generations, Ready generations, terminal observations, producer rosters, receipts, Minimal Governance, and Bootstrap records are not admission inputs. They may remain historical or diagnostic data only.

## Ready

Ready is a bounded action only for a PR that is currently Draft. A Product Owner `workflow_dispatch` request supplies the Task, PR, exact HEAD, and exact Review ID. The host fresh-fetches Task Authority, current main, PR, changed paths, exact Review, required checks, all thread pages, and mergeability; repeats the binding before mutation; then performs exactly one real `markPullRequestReadyForReview` mutation and verifies the resulting live state.

A non-Draft PR does not require another Ready operation after a HEAD change. The HEAD change invalidates the prior Review and requires current checks plus a fresh Review only.

## Merge

A final, parser-valid Merge Decision must be present in the initial `issue_comment.created` body on the canonical Task Issue. The workflow treats that event as the operation trigger and identity. It fresh-fetches:

- Task and Task Authority;
- PR state, exact HEAD, and current `main`;
- every changed-file page and exact authorized scope;
- the exact GitHub Pull Request Review;
- the path-aware required-check rollup;
- every review-thread page; and
- mergeability.

The same binding is evaluated again immediately before mutation. The operator then performs one expected-SHA merge with no automatic retry. After success it re-fetches the PR, `main`, and merge commit and verifies that the exact reviewed HEAD and previous main are the two merge parents.

## Required checks

The closed catalog is:

| Changed paths | Required exact-HEAD checks |
| --- | --- |
| all changes | `build-preview`, `Cloudflare Pages` |
| any `research/sd-prompt-research/**` path | the two checks above plus `validate` |

Missing, pending, cancelled, ambiguous, or unsuccessful required checks stop before a protected mutation. The operator does not create or consume a check-evidence record.

## Serialization and transport

Task Authority, Review body, and Merge Decision use one Node-owned UTF-8 serializer/parser pair per record. A body must be complete at creation time, contain exactly one fenced JSON block, and round-trip byte-for-byte. When GitHub Pull Request Review publication is unavailable, the exact same Review body may be published once as a top-level comment on the canonical Task Issue and selected explicitly as `TASK_ISSUE_COMMENT`; it is one compatibility surface, not a second semantic decision. Placeholder-then-PATCH publication, PowerShell Markdown interpolation, self-referential URLs, and digest/seal layers are not part of V1.

## Self-hosting exception

When a platform PR introduces the owner needed to finish itself and the current default branch cannot execute that owner, the Product Owner may make one explicit operational bootstrap decision bound to the exact Task, PR, HEAD, base, scope, fresh Review, live checks, threads, and mergeability. A trusted external operator may perform only the otherwise-unreachable exact-HEAD protected operation. This is not a reusable authority schema, workflow, evidence chain, or Bootstrap Kernel.

## Historical automation components

Older Repair, Draft Return, publication replay, Result Handoff, Ready-generation, terminal-observation, Collector, Minimal Governance, and Bootstrap implementations or records are historical. Their presence does not establish current production authority and they must not be used to block or authorize Simplified V1 transitions.

General dispatch, specialist execution, and Result Handoff conventions remain documented by the Team contracts for work coordination. They are separate from the live Review/Ready/Merge admission defined here.
