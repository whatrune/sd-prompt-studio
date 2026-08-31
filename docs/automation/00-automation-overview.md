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

## Coordinator continuation to Merge-ready

Integrated Lead uses the existing task-local `wait_threads` target and cursor; there is no repository scheduler, daemon, queue, database, or polling service. The returned terminal cursor advances the task-local consumed cursor before its one projected action. Repeated delivery of the same consumed cursor is a no-op, while a distinct terminal cursor may project its next action normally. A complete implementation first receives a task-local prepublication Independent Review bound to one clean exact commit. That result is only an unchanged-publication gate. Under explicit publication authority, the publisher pushes the exact reviewed commit without amend, rebase, additional commit, or tree change and creates one non-Draft PR.

After direct PR refetch binds the exact Task, branch, registered worktree, PR, base, HEAD, and authorized scope, the coordinator waits for current-HEAD checks. Checks PASS dispatches the authoritative Fresh exact-HEAD Review. Review findings stop Merge-ready progression and return only through the existing same-Worker correction route. Fresh Review `APPROVE / 0 / 0 / 0` runs the existing read-only pre-Decision preflight. A successful preflight projects transient `MERGE_READY` and stops for the Product Owner Merge Decision; it does not publish a record or authorize Merge.

Independent Canonical Tasks use independent wait targets and cursors and may progress concurrently. Shared file names do not create a global lock. Serialization is limited to exact execution-identity collisions, proven shared mutable owners, or the same protected-action resource. Current-main advancement is handled by each affected Task's fresh base and HEAD rebind, never by silently publishing reviewed bytes against a changed binding.

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

`data/validation-path-ownership-v1.json` is the single closed path-ownership catalog consumed by both validation selection and Merge required-check projection. The catalog defines eight profiles: `RESEARCH_EXPERIMENT`, `CONCEPT_GRAPH`, `FULL_RESEARCH`, `PRODUCTION_ADVISORY`, `PROMPT_DATA`, `APPLICATION`, `PLATFORM`, and `DOCUMENTATION`.

| Classified change | Required exact-HEAD checks |
| --- | --- |
| every known class | `validate` |
| runtime/deployable class | `validate`, `build-preview`, `Cloudflare Pages` |
| mixed, unknown, malformed, duplicate, empty, or control-plane input | all three checks; `validate` executes `FULL_RESEARCH` |

Missing, pending, cancelled, ambiguous, or unsuccessful required checks stop before a protected mutation. The operator does not create or consume a check-evidence record.

`.github/workflows/research-claims.yml` produces one universal `validate` check for every pull request. It selects the profile from the complete exact base-to-HEAD NUL-delimited path set using `git diff --name-only -z --no-renames`; a rename is therefore classified as deletion plus addition. Exact ownership is required. Multiple ownership classes do not form an optimistic union and instead fall back to `FULL_RESEARCH`. Catalog, classifier, workflow-control, validator, schema, template, malformed, duplicate, empty, and unmatched inputs also fail closed to `FULL_RESEARCH`.

Bounded profiles run only catalog-owned fixed command bundles. `FULL_RESEARCH` is the strict safe superset and includes the full Research suite, Research validators, production advisory checks, PromptTag data checks, application test/build, and platform contract checks. Default-branch, scheduled, and explicit manual validation always force that full cross-boundary regression. These full runs detect regressions but are not durable Merge evidence. Selected paths, profile, fixed commands, fallback reason, and GitHub Actions step timings are diagnostic output only; there are no validation records or generations.

Python-backed profiles acquire their interpreter through `scripts/acquire-python-validation-environment-v1.ps1`. The helper resolves one immutable environment under `<git-common-dir>/codex-cache/python-validation-v1/` from an identity containing only the exact Python runtime/platform fields and SHA-256 digests of both `requirements.txt` and the fully resolved `requirements.lock.txt`. The lock pins direct and transitive distributions with wheel hashes, and cold installation uses `pip --require-hashes` in a same-volume build directory before atomic finalization. A finalized environment is validation-only: it is checked for its completion manifest, locked distribution set, metadata digest, `pip check`, required imports, and repository injection before reuse, and it is never an installation target.

The workflow restores only identity-addressed finalized environments and invokes research commands with the returned absolute interpreter plus `-B -E -s`. Profile selection remains unchanged and does not require third-party packages. A dependency/runtime change selects a different environment; repository source, Task, branch, PR, HEAD, worktree, timestamp, and execution-instance changes do not affect the dependency identity. Invalid or incomplete entries are rejected and rebuilt under the identity lock. Cache acquisition is diagnostic preparation, not lifecycle evidence or execution identity.

## Serialization and transport

Task Authority, Review body, and Merge Decision use one Node-owned UTF-8 serializer/parser pair per record. A body must be complete at creation time, contain exactly one fenced JSON block, and round-trip byte-for-byte. When GitHub Pull Request Review publication is unavailable, the exact same Review body may be published once as a top-level comment on the canonical Task Issue and selected explicitly as `TASK_ISSUE_COMMENT`; it is one compatibility surface, not a second semantic decision. Placeholder-then-PATCH publication, PowerShell Markdown interpolation, self-referential URLs, and digest/seal layers are not part of V1.

## Historical automation components

Older Repair, Draft Return, publication replay, Result Handoff, Ready-generation, terminal-observation, Collector, Minimal Governance, and Bootstrap implementations or records are historical. Their presence does not establish current production authority and they must not be used to block or authorize Simplified V1 transitions.

General dispatch, specialist execution, and Result Handoff conventions remain documented by the Team contracts for work coordination. They are separate from the live Review/Merge admission defined here.
