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

Independent Canonical Tasks use independent wait targets and cursors and may progress concurrently. Shared file names do not create a global lock. Serialization is limited to exact execution-identity collisions, proven shared mutable owners, or the same protected-action resource. Any fresh `origin/main` advancement invalidates every stale lane `expected_base`, whether authorized paths overlap or not. Disjoint advancement may rebind straightforwardly; semantic overlap stays fail-closed until compatibility reconciliation. Either path requires current checks and Fresh exact-HEAD Review after the resulting HEAD rebind, never silent publication of reviewed bytes against a changed binding.

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

After verified Merge, the local terminal owner runs canonical local-main synchronization and terminal Task-worktree cleanup. Only when post-Merge verification, synchronization, and cleanup all PASS does `--close-canonical-task-after-cleanup-file` evaluate the exact Task's normal-execution predelegation. Ordinary newly serialized Tasks default to `AUTO_CLOSE_COMPLETED`; an explicit `KEEP_OPEN`, a legacy Task with no closure field, or an already-closed Task returns zero-mutation PASS. The automatic policy closes only the exact canonical Task Issue as `completed` through `createProductionHostV1`'s single closed Issue transport, preserves the Issue body byte-for-byte, and directly refetches the resource. There is no alternate publication surface or retry after an ambiguous close. Closure failure is terminal-housekeeping failure only and does not invalidate Merge, synchronization, or cleanup.

## Required checks

`data/validation-path-ownership-v1.json` is the single closed path-ownership catalog consumed by both validation selection and Merge required-check projection. The catalog defines eight profiles: `RESEARCH_EXPERIMENT`, `CONCEPT_GRAPH`, `FULL_RESEARCH`, `PRODUCTION_ADVISORY`, `PROMPT_DATA`, `APPLICATION`, `PLATFORM`, and `DOCUMENTATION`.

| Classified change | Required exact-HEAD checks |
| --- | --- |
| every known class | `validate` |
| runtime/deployable class | `validate`, `build-preview`, `Cloudflare Pages` |
| mixed, unknown, malformed, duplicate, empty, or control-plane input | all three checks; `validate` executes `FULL_RESEARCH` |

Artifact-only `RESEARCH_EXPERIMENT` and pure `CONCEPT_GRAPH` changes are non-runtime classes and require only `validate`. The production Compiler does not consume the generated prototype Concept Graph; its production-facing advisory is a separately owned checked-in artifact. If a Graph change also changes that advisory, the mixed scope fails closed to `FULL_RESEARCH` and requires all three checks. Missing, pending, cancelled, ambiguous, or unsuccessful required checks stop before a protected mutation. A check emitted by an external GitHub integration for a non-required profile does not enter the canonical preflight evidence. The operator does not create or consume a check-evidence record.

`.github/workflows/research-claims.yml` produces one universal `validate` check for every pull request. It selects the profile from the complete exact base-to-HEAD NUL-delimited path set using `git diff --name-only -z --no-renames`; a rename is therefore classified as deletion plus addition. Exact ownership is required. Multiple ownership classes do not form an optimistic union and instead fall back to `FULL_RESEARCH`. Catalog, classifier, workflow-control, validator, schema, template, malformed, duplicate, empty, and unmatched inputs also fail closed to `FULL_RESEARCH`.

Bounded profiles run only catalog-owned fixed command bundles. Artifact-only `RESEARCH_EXPERIMENT` runs the focused suites that inspect observation/provenance/run-registration content or current Concept Graph, Research Claims, and Research Explorer state, plus all three current-state validators. Broad schema/evidence unit suites that use only synthetic fixtures remain covered by `FULL_RESEARCH` and are not repeated for artifact-only changes. Any validator, test, schema, template, workflow, selector, or other validation-owner change still fails closed to `FULL_RESEARCH`. `FULL_RESEARCH` is the strict safe superset and includes the full Research suite, Research validators, production advisory checks, PromptTag data checks, application test/build, and platform contract checks. On pull requests, the required `build-preview` check is the single owner of the application `pnpm test` and `pnpm build` execution for every runtime-deployable profile; the required `validate` check consumes the same fail-closed profile classification but does not repeat those two application commands. Default-branch, scheduled, and explicit manual validation continue to run the application bundle through `validate` as part of the forced full cross-boundary regression. Cloudflare Pages remains the exact-HEAD deployment-evidence owner. These full runs detect regressions but are not durable Merge evidence. Selected paths, profile, fixed commands, fallback reason, and GitHub Actions step timings are diagnostic output only; there are no validation records or generations.

Python-backed local profiles begin with a coordinator-supplied host-owned bundled Python executable; the runner never discovers or substitutes a runtime. Before acquisition it invokes that exact opaque path with `-B -E -s`, after clearing `PYTHONHOME`, `PYTHONPATH`, and `PYTHONUSERBASE`, and admits only CPython `3.12.x` with a minimum patch version of `3.12.13`, cache tag `cpython-312`, and byte-identical `sys.executable`. The exact admitted patch version remains part of the immutable cache identity. A missing, malformed, older, or mismatched runtime fails before cache or dependency work. The same admitted path is then passed unchanged to `scripts/acquire-python-validation-environment-v1.ps1`. The helper resolves one immutable environment under `<git-common-dir>/codex-cache/python-validation-v1/` from an identity containing only the exact Python runtime/platform fields and SHA-256 digests of both `requirements.txt` and the fully resolved `requirements.lock.txt`. The lock pins direct and transitive distributions with wheel hashes, and cold installation uses `pip --require-hashes` in a same-volume build directory before atomic finalization. A finalized environment is validation-only: it is checked for its completion manifest, locked distribution set, metadata digest, `pip check`, required imports, and repository injection before reuse, and it is never an installation target.

The workflow restores only identity-addressed finalized environments and invokes research commands with the returned absolute interpreter plus `-B -E -s`. Profile selection remains unchanged and does not require third-party packages. A dependency/runtime change selects a different environment; repository source, Task, branch, PR, HEAD, worktree, timestamp, and execution-instance changes do not affect the dependency identity. Invalid or incomplete entries are rejected and rebuilt under the identity lock. Cache acquisition is diagnostic preparation, not lifecycle evidence or execution identity.

The full cache failure/concurrency matrix is a conditional validation owned by the exact cache implementation, requirements, lock, classifier, local FULL runner, and Research Claims workflow paths listed in `data/validation-path-ownership-v1.json`. A pull request runs that matrix only when one of those exact owners changes. Default-branch, scheduled, and explicit manual FULL validation also run it. Other profiles and unrelated fail-closed `FULL_RESEARCH` selections still acquire and validate the immutable environment—including completion manifest, runtime/platform identity, locked distributions, metadata digest, `pip check`, repository isolation, and required import smoke—but skip the expensive builder/failure/concurrency matrix. The GitHub workflow and canonical local FULL runner both consume the catalog-owned condition; neither owns a second path taxonomy.

## Serialization and transport

Task Authority, Review body, and Merge Decision use Node-owned UTF-8 serializer/parser pairs. Review and Merge Decision bodies remain complete at creation time, contain exactly one fenced JSON block, and round-trip byte-for-byte. Canonical Task Issue publication additionally uses `serializeCanonicalTaskIssueBodyV1`, which owns the complete human-readable Markdown, exactly one fenced JSON Task Authority, one fenced YAML normal-execution predelegation, and one fenced YAML Review-publication predelegation. It emits UTF-8 without BOM, LF-only deterministic two-space JSON, sorted unique path arrays, and one trailing newline; callers supply structured input and never construct fences or interpolate the body through PowerShell. Its immutable request accepts the exact Task-closure policy; omission for an ordinary new Task defaults to `AUTO_CLOSE_COMPLETED`, while `KEEP_OPEN` is the explicit umbrella/tracking hold-open policy. Previously created Task bodies lacking that field remain valid legacy records and evaluate to `KEEP_OPEN`.

GitHub assigns an Issue number only after CREATE, so Canonical Task publication has one closed two-phase exception. Before mutation, the runner requires the authenticated actor to equal the Product Owner. `UNBOUND_CREATE` uses the reserved non-authoritative Task number `0`; after the successful CREATE response and direct refetch match those exact bytes and both bind the creator as repository `OWNER`, `BOUND_FINAL` derives every server-assigned binding from that one returned number. A structural guard permits changes only to Task Authority `task_issue` and each predelegation's `task_id`, `authority_source`, `canonical_record`, and `allowed_changes.task_issue`; prose, scope, all other authority semantics, and canonical formatting remain unchanged. The same serializer writes both bodies through the verified UTF-8 file transport. CREATE, PATCH, and both refetches require the same Product Owner/OWNER resource identity. CREATE and PATCH are each single-attempt, each is directly refetched, an ambiguous result is never retried, and the final body must parse as exactly one self-bound Task Authority plus the two exact self-bound predelegations. Arbitrary placeholder publication, recovery PATCHes, PowerShell Markdown interpolation, fence reconstruction, self-referential Review or Merge records, and digest/seal layers are not part of V1.

When GitHub Pull Request Review publication is unavailable, the exact same Review body may be published once as a top-level comment on the canonical Task Issue and selected explicitly as `TASK_ISSUE_COMMENT`; it is one compatibility surface, not a second semantic decision.

The closed Review publication route fetches the authenticated actor and PR author and enumerates both canonical surfaces for the exact Task, PR, and HEAD before considering mutation. Exactly one byte-identical Review authority is reused with zero mutation. If none exists, the semantic Review result is not publication authority: a stable Product Owner predelegation in the Canonical Task body must bind repository, Task, branch, cumulative scope, actor, one surface, closed required `APPROVE / 0 / 0 / 0`, activation, `operation_count = 1`, and no fallback. The runner freshly proves the exact PR, HEAD, base, branch, full scope, required checks, zero active threads, Merge applicability, actor, and surface before it publishes at most one canonical Review through the admitted direct gh api surface. No assignment comment is created.

## Historical automation components

Older Repair, Draft Return, publication replay, Result Handoff, Ready-generation, terminal-observation, Collector, Minimal Governance, and Bootstrap implementations or records are historical. Their presence does not establish current production authority and they must not be used to block or authorize Simplified V1 transitions.

General dispatch, specialist execution, and Result Handoff conventions remain documented by the Team contracts for work coordination. They are separate from the live Review/Merge admission defined here.

Normal Task execution follows the [Shared Role Execution Contract](../team/13-shared-role-execution-contract.md#normal-task-lifecycle). Task start authorizes the bounded normal path; Fresh Review and exact live checks gate direct Review publication. MERGE_READY stops for the Product Owner Merge Decision. No separate assignment publication or prepublication Review is required.
