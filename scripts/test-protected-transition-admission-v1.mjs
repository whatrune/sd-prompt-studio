import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { parse as parseYaml } from 'yaml'
import {
  READY_REVIEW_TERMINAL_OBSERVATION_ARTIFACT_V1,
  buildReadyReviewTerminalObservationArtifactV1,
  canonicalizeReadyReviewObservationJcsV1,
  digestReadyReviewObservationProjectionV1,
  sha256ReadyReviewObservationV1,
} from '../src/continuous-orchestration/ready-review-terminal-observation-artifact-v1.ts'
import {
  CANONICAL_FINALIZATION_BINDING_V1,
  CANONICAL_FINALIZATION_BINDING_V1_FIELD_COUNT,
  PROTECTED_TRANSITION_ADMISSION_INPUT_V1,
  PROTECTED_TRANSITION_COLLECTOR_FILE_V1,
  PROTECTED_TRANSITION_RECEIPT_FILE_V1,
  evaluateProtectedTransitionAdmissionV1,
} from '../src/continuous-orchestration/protected-transition-admission-v1.ts'
import {
  admitArtifactZipExecResultV1,
  canonicalFinalizationBindingIdV1,
  classifyTerminalLeafAuthorBindingV1,
  executeProtectedTransitionAdmissionV1,
  resolveFinalizationBindingV1,
  validateCanonicalFinalizationBindingV1,
  validateGenerationAwareAssignmentLineageV1,
  validateReadyGenerationCollectorBindingV1,
  verifyTerminalArtifactZipProvenanceV1,
} from './run-protected-transition-admission-v1.mjs'

const PINNED_COMMENT_BODIES = Object.freeze(
{
  "https://github.com/whatrune/sd-prompt-studio/issues/251#issuecomment-5198987697": "# Cumulative Architecture Amendment — Phase 1 Assignment Issuer Trust Root\n\n```yaml\nrecord_type: phase_1_assignment_issuer_trust_root_architecture_amendment\nauthoring_role: Architect Team\nauthority_issue: https://github.com/whatrune/sd-prompt-studio/issues/251\ncorrection_dispatch: https://github.com/whatrune/sd-prompt-studio/issues/251#issuecomment-5198928778\nprior_actor_authority_amendment: https://github.com/whatrune/sd-prompt-studio/issues/251#issuecomment-5198862469\nprior_architecture_review: https://github.com/whatrune/sd-prompt-studio/issues/251#issuecomment-5198916587\naffected_task: https://github.com/whatrune/sd-prompt-studio/issues/259\npull_request: https://github.com/whatrune/sd-prompt-studio/pull/260\nreviewed_head: eacec3f5e3a0e038500953cf5a5c49f464c83886\nreviewed_parent: 413cd0ba0d858e1497bbc5e6ea8a88231fb55c67\nreviewed_tree: e1e552828b3fa5e47f5cdca128e6eec5126ad251\ntrust_root_id: PTA-V1-PHASE-1-ASSIGNMENT-ISSUER-TRUST-ROOT\ntrust_root_revision: 1\ndecision: AMENDMENT_COMPLETE\nclosed_finding_id: B-251-ASSIGNMENT-ISSUER-AUTHORITY-001\nblocking_finding_count: 0\nunknown_count: 0\nfive_file_sufficiency: true\nsix_workflow_input_sufficiency: true\nadditional_path_required: false\nseventh_input_required: false\narchitecture_ready_for_independent_review: true\ncorrection_ready: false\ncorrection_allowed: false\nimplementation_allowed: false\nready_allowed: false\nworkflow_dispatch_allowed: false\nmerge_allowed: false\nstatus: completed\nexecution_stop_reason: completed\n```\n\n## Cumulative decision\n\nThis Amendment changes only assignment-issuer authority. The prior Amendment's current Ready REST event source, separate Terminal Review and Merge Decision assignment records, ordered caller/Ready/assignment admission, one existing Collector invocation, one existing parser, accepted/rejected/failed union, persistence topology, and one-time Issue #259 bootstrap boundary remain cumulative and unchanged.\n\nAn assignment record can no longer name or select its own authority owner. The authority-owner mapping is frozen outside all candidate assignment comments by the exact trust root below. A fresh Independent Architecture Review of this Amendment is required. No correction or implementation is authorized by this record.\n\n## 1. Non-self-authenticating canonical trust root\n\nThe trust root is `phase_1_assignment_issuer_trust_root_v1`, revision `1`, scoped only to:\n\n- repository `whatrune/sd-prompt-studio`;\n- parent Architecture authority `https://github.com/whatrune/sd-prompt-studio/issues/251`;\n- contract `Protected Transition Admission V1 Phase 1`;\n- issuance of `terminal_review_actor_assignment_v1` and `merge_decision_actor_assignment_v1`;\n- Task records whose strict `parent_issue` binding equals Issue #251.\n\nIt is not a workflow input and is not selected by an assignment, transition, Task author, Ready record, caller, Issue assignee, comment chronology, or claimed role.\n\n### Frozen authority-owner entries\n\n| Assignment type | Required owner role | Independently frozen owner login | Exact authority anchor |\n|---|---|---|---|\n| `terminal_review_actor_assignment_v1` | `Integrated Lead` | `whatrune` | Integrated Lead correction dispatch https://github.com/whatrune/sd-prompt-studio/issues/251#issuecomment-5198928778 |\n| `merge_decision_actor_assignment_v1` | `Product Owner` | `whatrune` | Product Owner topology decision https://github.com/whatrune/sd-prompt-studio/issues/251#issuecomment-5186163757, reviewed by https://github.com/whatrune/sd-prompt-studio/issues/251#issuecomment-5186264557 |\n\nThe two entries happen to resolve to the same GitHub login in current repository authority, but they remain separate role-and-record-type capabilities. Equality of the login does not permit cross-role substitution or transition-derived role generation.\n\nFresh direct GitHub API retrieval froze these exact final-byte identities:\n\n```yaml\nintegrated_lead_anchor:\n  url: https://github.com/whatrune/sd-prompt-studio/issues/251#issuecomment-5198928778\n  api_author_login: whatrune\n  created_at: 2026-08-06T00:19:15Z\n  updated_at: 2026-08-06T00:19:15Z\n  body_sha256: 955b897e2af8b569e3d0e496df5bed76efa7fbf97db94ed3386a1ac89102ca42\n  admitted_scope: terminal_review_actor_assignment_v1 issuer only\nproduct_owner_anchor:\n  url: https://github.com/whatrune/sd-prompt-studio/issues/251#issuecomment-5186163757\n  api_author_login: whatrune\n  created_at: 2026-08-05T00:36:01Z\n  updated_at: 2026-08-05T00:36:02Z\n  body_sha256: 385ca7a9701a3e5dc1db8e2f26a89d0d8d29fc3e9ea7609e604d873e0e633bd3\n  admitted_scope: merge_decision_actor_assignment_v1 issuer only\nproduct_owner_anchor_review:\n  url: https://github.com/whatrune/sd-prompt-studio/issues/251#issuecomment-5186264557\n  api_author_login: whatrune\n  created_at: 2026-08-05T00:52:23Z\n  updated_at: 2026-08-05T00:52:55Z\n  body_sha256: c347f9f8d43c83f3af55d9c139028b7c4b88560d93401d742a55a3cd19d6b293\n  decision: BLOCKED\n  reviewed_record: https://github.com/whatrune/sd-prompt-studio/issues/251#issuecomment-5186163757\n```\n\nThe Product Owner review's `BLOCKED` decision concerned the then-unresolved Phase 1 bootstrap order, not Product Owner record identity. It is used only as independent evidence that the exact Product Owner anchor was the reviewed controlling Product Owner input; it does not project an Architecture approval onto this Amendment. The anchor and review were already in their frozen final-byte state before this trust-root revision. Their historical `updated_at` difference is therefore not treated as an append-only assignment record; any future byte or metadata mismatch from these pinned values is an integrity failure.\n\nThe effective trust-root record for runtime is this exact strict record type and revision as independently approved by the later Review of this Amendment. Implementation must pin the canonical URL and SHA-256 of this published Amendment after publication and the exact fresh Independent Architecture Review URL/decision. Candidate assignment comments cannot alter either pin.\n\n## 2. Root discovery, currentness, supersession, revocation, and precedence\n\nThe runner obtains the parent Issue URL only from the strict, directly re-fetched Task record's `parent_issue` field. It must equal Issue #251. It then directly re-fetches the pinned trust-root Amendment and its pinned Independent Architecture Review comment; full Issue-comment enumeration may establish absence of conflicting valid successors, but chronology never selects authority.\n\nRevision `1` is current only when all of the following hold:\n\n1. exact root ID, revision, repository, parent Issue, contract, role scopes, source URLs, source API authors, source timestamps, and source body digests match the frozen pins;\n2. the root Amendment's direct API author/body/URL/digest match the implementation pin;\n3. the direct Independent Architecture Review binds that exact Amendment and returns `APPROVE`, blocker `0`, UNKNOWN `0`;\n4. no valid current revocation or approved successor exists.\n\nA successor is valid only when it is a new cumulative Architect Team Amendment on Issue #251 with the same root ID, revision exactly prior + 1, an exact `supersedes_root_url` and prior-root digest, unchanged repository/contract scope, and a fresh direct Independent Architecture Review `APPROVE` with blocker `0`. It is not effective in the production host until a separately authorized implementation updates the pinned root URL/digest/revision on main. Until that update, the compiled current root remains revision 1 unless revoked.\n\nA revocation is valid only when a strict `phase_1_assignment_issuer_trust_root_revocation_v1` record is published on Issue #251 by the currently admitted Product Owner login, binds the current root URL/digest/revision and exact contract scope, and is independently Architecture-reviewed. A valid revocation immediately denies all new assignment admission. It cannot install a replacement mapping. Replacement requires the successor process above.\n\nZero current roots, multiple valid current roots, multiple valid successors, forks, gaps, cycles, cross-scope links, conflicting mappings, or a valid revoked root reject. Missing/inaccessible API evidence, incomplete pagination, malformed declared trust records, direct-URL/API-author/body/digest mismatch, or malformed Review evidence fail. Unpinned ordinary comments and self-claimed root records have no authority; if they collide with a strict root identity they cause ambiguity rejection, never acceptance.\n\nAuthority precedence is:\n\n1. implementation-pinned, independently APPROVE-reviewed current trust-root revision;\n2. the exact role-specific entry inside that root;\n3. the selected current assignment record issued by that admitted owner;\n4. the assigned login in that record;\n5. physical workflow caller comparison.\n\nAssignment body claims, Task author, Issue assignee, Ready publisher, Ready event actor, transition, workflow caller, and comment order have no authority to replace steps 1-4.\n\n## 3. Assignment admission order\n\nAfter the prior Amendment's host, caller, current PR/HEAD/Ready Generation, and exact GitHub REST `ready_for_review` event acquisition, assignment issuer admission is frozen in this order:\n\n1. Acquire and integrity-validate the pinned current trust-root Amendment, its Review, and the role-specific authority anchors.\n2. Map the requested assignment record type to exactly one frozen required owner role.\n3. Select the independently admitted owner login from that root entry; do not read it from the assignment.\n4. Discover and directly re-fetch the candidate assignment record from the bound Task Issue.\n5. Require both the assignment API comment author and its `authority_owner_login` to equal the independently admitted owner login, and require its `authority_owner_role` to equal the frozen owner role.\n6. Only then validate assignment ID/revision/supersession/revocation/currentness, complete repository/parent/Task-scope/PR/exact-HEAD/Ready-Generation/Ready-event/transition scope, assigned login, and assigned role.\n7. Compare `github.actor` to the admitted assigned login. Role comes only from the admitted assignment record and must equal its frozen assignment type.\n8. Only after all identity checks admit may the one existing Collector be invoked and the cumulative evaluator/persistence contract run.\n\nThe Ready actor remains exactly `actor.login` from the unique current REST `ready_for_review` event matching repository, PR, exact HEAD, Ready event ID, and Ready timestamp. It is not an assignment issuer and is never replaced by the Ready Generation publisher.\n\n## 4. Rejected and failed boundaries\n\n`rejected` covers trustworthy semantic denial: no current root; valid root revocation; ambiguous valid roots/successors; stale/superseded root; wrong role scope; wrong admitted owner; self-issued assignment whose author is not the independently admitted owner; cross-role substitution; zero/multiple/currentness-invalid assignments; caller differs from assigned login; and any complete-scope mismatch. It persists exactly one non-admitting diagnostic receipt, zero admitted artifacts, `state_changed: false`, and no protected transition.\n\n`failed` covers inability to establish trustworthy evidence: root/anchor/Review/assignment endpoint access or pagination failure; malformed declared canonical record; direct URL, API author, timestamp, immutable body, or digest integrity mismatch; parser failure; Collector/evaluator failure; or diagnostic/admission persistence failure. It produces no admission receipt, no admitted artifact, `state_changed: false`, and no protected transition.\n\nA candidate assignment that repeats the admitted owner login in its own body is not sufficient. It admits only after the independently pinned trust-root entry establishes the same login.\n\n## 5. Repository Reality Check — five files and six inputs\n\nFresh immutable inspection of `eacec3f5e3a0e038500953cf5a5c49f464c83886` confirmed one parent `413cd0ba0d858e1497bbc5e6ea8a88231fb55c67`, tree `e1e552828b3fa5e47f5cdca128e6eec5126ad251`, and exactly these five paths:\n\n1. `.github/workflows/protected-transition-admission-v1.yml`\n2. `scripts/fixtures/protected-transition-admission-v1.json`\n3. `scripts/run-protected-transition-admission-v1.mjs`\n4. `scripts/test-protected-transition-admission-v1.mjs`\n5. `src/continuous-orchestration/protected-transition-admission-v1.ts`\n\nThe runner already parses GitHub Issue/comment URLs, owns authenticated REST acquisition, and receives `task_record_url`; the Task record already binds `parent_issue: https://github.com/whatrune/sd-prompt-studio/issues/251`. Therefore parent/root/Review/anchor discovery and exact direct re-fetch close inside the existing runner. Root/assignment evidence and result shapes close in the existing evaluator, fixture, tests, and workflow. No Collector/Core/parser, package, lockfile, Team document, second workflow/store, or sixth path is needed.\n\nThe workflow still has exactly these six inputs:\n\n1. `transition`\n2. `pr_number`\n3. `exact_head`\n4. `task_record_url`\n5. `ready_generation_record_url`\n6. `terminal_review_record_url`\n\nTrust-root URLs, authority-owner logins, repository/workflow/caller identity, Ready event actor, and assignment URLs are authority data discovered or implementation-pinned; none may be caller-selectable. A seventh input would weaken provenance and is forbidden.\n\n## 6. Frozen focused validation additions\n\nRequired positive coverage:\n\n- Terminal assignment issued by the independently admitted Integrated Lead login, assigning the exact Independent PR Reviewer, with all scopes identical;\n- Merge assignment issued by the independently admitted Product Owner login, assigning the exact Product Owner, with all scopes identical;\n- Ready publisher may differ from the exact REST Ready event actor without changing Ready actor authority;\n- current root, exact Review APPROVE, exact owner entry, assignment author, assigned login, workflow caller, and complete scope all admit in the frozen order.\n\nRequired rejection coverage:\n\n- wrong owner; self-issued owner not equal to the pinned owner; cross-role owner; Task author/Issue assignee/Ready publisher/Ready actor/caller substituted as issuer;\n- zero or multiple roots; stale, superseded, revoked, forked, gapped, cyclic, ambiguous, or conflicting root/successor;\n- zero/multiple/stale/revoked/ambiguous assignments;\n- wrong root ID/revision/scope/role/login/source URL, wrong assignment issuer/role/login/scope, caller mismatch, and every existing complete-tuple mismatch.\n\nRequired failure coverage:\n\n- missing/inaccessible root, Review, anchor, assignment, or pagination page;\n- malformed declared root/revocation/successor/assignment;\n- root/Review/anchor/assignment API-author, timestamp, body, URL, or digest integrity mismatch;\n- existing Collector/parser/evaluator/persistence failures.\n\nEvery case asserts exactly five changed/staged paths, exactly six workflow inputs, Collector count zero before identity admission and exactly one after admission, zero mutation, `state_changed: false` on every non-admitting result, and no Ready, Terminal Review publication, Merge Decision publication, or Merge capability.\n\n## Hold\n\nThis Amendment records zero Architecture blockers and zero UNKNOWN, but it does not authorize correction. A fresh Independent Architecture Review must bind the published canonical URL and digest. Even `APPROVE` requires a later separate Integrated Lead same-task correction Dispatch.\n\nNo repository file, Commit, Push, PR body/state, Ready, workflow dispatch, Terminal Review, Merge Decision, Merge, PR #249, or Issue #248 action was performed. PR #260 remains Draft at `eacec3f5e3a0e038500953cf5a5c49f464c83886`.",
  "https://github.com/whatrune/sd-prompt-studio/issues/251#issuecomment-5199026857": "# Independent Architecture Review Decision — Phase 1 Assignment Issuer Trust Root\n\n```yaml\nrecord_type: independent_architecture_review_decision\nauthoring_role: Independent Architecture Reviewer\nauthority_issue: https://github.com/whatrune/sd-prompt-studio/issues/251\nreview_dispatch: https://github.com/whatrune/sd-prompt-studio/issues/251#issuecomment-5199001460\nreviewed_amendment: https://github.com/whatrune/sd-prompt-studio/issues/251#issuecomment-5198987697\nreviewed_amendment_body_sha256: 9b8f59daae1c4b305791e8932444a53e72ede3e14565c3e776ae70569f32c260\nprior_review: https://github.com/whatrune/sd-prompt-studio/issues/251#issuecomment-5198916587\nimplementation_review_findings: https://github.com/whatrune/sd-prompt-studio/issues/259#issuecomment-5198780807\naffected_task: https://github.com/whatrune/sd-prompt-studio/issues/259\npull_request: https://github.com/whatrune/sd-prompt-studio/pull/260\nreviewed_head: eacec3f5e3a0e038500953cf5a5c49f464c83886\nreviewed_parent: 413cd0ba0d858e1497bbc5e6ea8a88231fb55c67\nreviewed_tree: e1e552828b3fa5e47f5cdca128e6eec5126ad251\ndecision: APPROVE\nblocking_finding_count: 0\nblocking_finding_ids: []\nunknown_count: 0\nready_event_actor_finding_closed: true\nassigned_actor_authority_finding_closed: true\nassignment_issuer_authority_finding_closed: true\nfive_file_sufficiency: true\nsix_workflow_input_sufficiency: true\nadditional_path_required: false\nseventh_input_required: false\ncorrection_ready: false\ncorrection_allowed: false\nimplementation_allowed: false\nready_allowed: false\nworkflow_dispatch_allowed: false\nmerge_allowed: false\nstatus: completed\nexecution_stop_reason: completed\n```\n\n## Fresh authority and immutable binding\n\nFresh canonical retrieval verified the review Dispatch, the corrected cumulative Amendment, the prior `CHANGES_REQUIRED` Decision, Issue #259's Independent Implementation Review, Issue #259, and PR #260. The corrected Amendment body hashes exactly to `9b8f59daae1c4b305791e8932444a53e72ede3e14565c3e776ae70569f32c260`.\n\nPR #260 remains open and Draft. Its exact HEAD is `eacec3f5e3a0e038500953cf5a5c49f464c83886`, its base SHA and only parent are `413cd0ba0d858e1497bbc5e6ea8a88231fb55c67`, and its tree is `e1e552828b3fa5e47f5cdca128e6eec5126ad251`. Fresh remote ref inspection returned the same branch HEAD and the same `main` SHA.\n\n## Independent criterion verification\n\n1. **Non-self-authenticating issuer trust root — PASS.** Candidate assignment comments cannot choose their issuer, issuer role, trust-root URL, trust-root revision, or admitted owner login. The effective authority is the implementation-pinned `phase_1_assignment_issuer_trust_root_v1` revision plus the fresh independent `APPROVE` Review of its exact URL and digest. The root is external to every candidate assignment and freezes separate, role-scoped login entries for `terminal_review_actor_assignment_v1` and `merge_decision_actor_assignment_v1`. The cited historical anchors provide immutable identity provenance; neither an assignment-body claim nor anchor chronology can override the independently reviewed root.\n\n2. **Exact anchors and currentness — PASS.** The Amendment pins source URLs, API authors, timestamps, body digests, repository, parent Architecture Issue, contract, assignment types, role scopes, root ID, and revision. It freezes exact successor revision, supersession link/digest, independent-review, implementation-pin, revocation, fork/gap/cycle/ambiguity, and precedence rules. A successor does not silently become effective before a separately authorized implementation updates the default-branch pins. A valid revocation denies and cannot install a replacement mapping.\n\n3. **Assignment issuer and assigned actor admission — PASS.** Each transition maps to one frozen owner role and independently admitted owner login before assignment discovery. Both the assignment API comment author and its `authority_owner_login` must equal that admitted login, and the declared owner role must equal the root's role-specific capability. Only then are assignment revision/currentness, complete scope, assigned login, and assigned role evaluated. Terminal Review and Merge Decision remain separate canonical assignment record types; equality of their current login does not permit cross-role substitution. No role is generated from the transition.\n\n4. **Ready actor authority — PASS.** The cumulative Contract keeps the authenticated, fully paginated GitHub REST PR Issue Timeline as the source. It selects exactly one `ready_for_review` event matching repository, PR, exact HEAD/`commit_id`, current Ready event ID, and timestamp, and binds only that event's `actor.login` as Ready actor. The Ready Generation record publisher is provenance-only. Zero/multiple semantic matches reject; acquisition, pagination, or malformed identity evidence fails.\n\n5. **Admission order — PASS.** The frozen order is host/repository/six-input identity, physical `github.actor`, current Ready Generation and exact REST Ready event, independently admitted trust-root owner, unique current role-specific assignment, complete tuple comparison, then exactly one existing Collector invocation and one existing parser. The workflow caller must equal the canonical assigned login. Ready-event actor and assigned actor are independently sourced and cannot grant each other's authority.\n\n6. **Rejected/failed boundary — PASS.** Trustworthy semantic denial—including no/revoked/ambiguous/stale authority, wrong role or owner, self-issued substitution, zero/multiple assignments, cross-role substitution, caller mismatch, and complete-scope mismatch—is `rejected` with one non-admitting diagnostic receipt, zero admitted artifacts, and no state change. Evidence acquisition/pagination, malformed declared canonical evidence, URL/author/timestamp/body/digest integrity, parser/Collector/evaluator, or persistence inability is `failed`, produces no admission receipt/artifact, and grants no transition.\n\n7. **Validation matrix — PASS.** Positive cases cover both role-specific owners, exact assigned actors, Ready publisher differing from Ready-event actor, and the full ordered admission. Rejection cases include wrong/self-issued/cross-role owner, zero/multiple/stale/revoked/forked/gapped/cyclic roots and assignments, wrong scope/login/source, caller mismatch, and every tuple mismatch. Failure cases include unavailable/incomplete/malformed/integrity-failed root, Review, anchor, event, and assignment evidence. Collector cardinality, five paths, six inputs, zero mutation, and no protected-transition capability are asserted.\n\n## Repository Reality Check\n\nFresh immutable Git inspection confirmed exactly these five cumulative changed paths:\n\n1. `.github/workflows/protected-transition-admission-v1.yml`\n2. `scripts/fixtures/protected-transition-admission-v1.json`\n3. `scripts/run-protected-transition-admission-v1.mjs`\n4. `scripts/test-protected-transition-admission-v1.mjs`\n5. `src/continuous-orchestration/protected-transition-admission-v1.ts`\n\nThe workflow contains exactly six inputs: `transition`, `pr_number`, `exact_head`, `task_record_url`, `ready_generation_record_url`, and `terminal_review_record_url`. The existing runner already owns authenticated GitHub REST comment acquisition and parses `task_record_url`; the Task binds parent Issue #251. Timeline/comment pagination, trust-root/Review/anchor direct retrieval, assignment discovery, evaluator shapes, fixtures, and focused regressions close inside the existing runner/evaluator/fixture/test/workflow paths. No Collector/Core/parser, package, lockfile, document, second workflow/store, sixth path, or seventh caller-selectable input is required.\n\n## Decision\n\n**APPROVE** — zero blocking findings and zero UNKNOWN.\n\nThis Decision closes `B-251-ASSIGNMENT-ISSUER-AUTHORITY-001` at Architecture level and leaves the two Issue #259 implementation findings architecturally specified. It does not approve the existing implementation HEAD and does not authorize correction or implementation. A separate Integrated Lead correction Dispatch is required before any file change. PR #260 must remain Draft at the reviewed HEAD.\n\nNo repository file, Commit, Push, PR body/state, Ready, workflow dispatch, Terminal Review, Merge Decision, Merge, PR #249, or Issue #248 operation was performed.",
  "https://github.com/whatrune/sd-prompt-studio/issues/251#issuecomment-5198928778": "## Integrated Lead Re-Dispatch — Assignment Issuer Authority Correction\n\n```yaml\nrecord_type: architecture_correction_dispatch\nassigned_role: Architect Team\nauthority_issue: https://github.com/whatrune/sd-prompt-studio/issues/251\nreviewed_amendment: https://github.com/whatrune/sd-prompt-studio/issues/251#issuecomment-5198862469\nreview_decision: https://github.com/whatrune/sd-prompt-studio/issues/251#issuecomment-5198916587\ndecision: CHANGES_REQUIRED\nblocking_finding_count: 1\nblocking_finding_id: B-251-ASSIGNMENT-ISSUER-AUTHORITY-001\nreviewed_head: eacec3f5e3a0e038500953cf5a5c49f464c83886\nimplementation_allowed: false\ncorrection_allowed: false\n```\n\nThe prior Amendment correctly closes Ready-event actor provenance. Preserve it unchanged.\n\n### Required correction\n\nFreeze a non-self-authenticating canonical trust source that independently maps:\n\n- the exact assignment-issuer login authorized as `Integrated Lead` for `terminal_review_actor_assignment_v1`; and\n- the exact assignment-issuer login authorized as `Product Owner` for `merge_decision_actor_assignment_v1`.\n\nThe assignment record's own `authority_owner_login`, claimed role, authoring-role string, comment chronology, Task author, Issue assignee, transition, or caller identity cannot establish that mapping.\n\nThe minimum cumulative Amendment must define:\n\n1. Exact trust-source record type, canonical URL/discovery, authority root, immutable identity/digest, required fields, repository/parent Architecture scope, revision/currentness, supersession/revocation, and precedence.\n2. How the trust source is independently admitted without relying on the candidate assignment record it authorizes. Avoid circular self-signing or infinite role-attestation regress.\n3. The exact admitted login for each authority-owner role, or the exact fail-closed selection rule producing one login from the trust source.\n4. Assignment admission order:\n   - admit canonical trust mapping;\n   - select exact transition's required owner role and admitted owner login;\n   - require assignment comment API author and assignment `authority_owner_login` to equal that independently admitted login;\n   - only then validate assignment chain/currentness and assigned actor.\n5. Zero/multiple, missing, inaccessible, malformed, edited, stale, superseded, revoked, forked, conflicting, wrong-repository/scope/role/login/digest/source URL, self-issued owner, and cross-role substitution boundaries.\n6. Exact `rejected` versus `failed` mapping consistent with the reviewed cumulative union.\n7. Positive, wrong-owner, self-issued-owner, stale/revoked-owner, ambiguous-owner, cross-role, and trust-source integrity/acquisition cases.\n8. Fresh Repository Reality Check confirming the repair still fits the existing five-file allowlist and six workflow inputs. Trust-source discovery must not become a seventh caller-selectable input. If an additional path/input or external Product Owner decision is required, do not infer or expand: record it as a blocker and stop.\n\nDo not alter the Ready REST event source, assignment record types, actor/role scope, identity admission order, Collector topology, bootstrap boundary, PR #260, or repository files beyond the minimum cumulative issuer-trust correction.\n\nAfter publication, a fresh Independent Architecture Review is required. Even APPROVE does not authorize implementation correction.\n\nNo file, Commit, Push, PR body, Ready, workflow dispatch, Terminal Review, Merge Decision, Merge, PR #249, or Issue #248 action.\n",
  "https://github.com/whatrune/sd-prompt-studio/issues/251#issuecomment-5186163757": "# Product Owner Topology Decision — Protected Transition Admission V1 Phase 1\n\nThis Decision authorizes one minimal production admission host and narrows Phase 1 to Terminal Review Admission and Merge Decision Admission. Ready is observation input only. This record grants Architecture authority to freeze the topology; it does not authorize implementation, Issue #250 work, or any protected action.\n\n```yaml\ntask_id: PROTECTED-TRANSITION-ADMISSION-V1-ARCHITECTURE-CANDIDATE-001\nrecord_type: product_owner_topology_decision\nauthoring_role: Product Owner\nauthority_source: user_directed_product_owner_decision\ncanonical_record: https://github.com/whatrune/sd-prompt-studio/issues/251#issuecomment-5186163757\nparent_issue: https://github.com/whatrune/sd-prompt-studio/issues/251\nprior_candidate: https://github.com/whatrune/sd-prompt-studio/issues/251#issuecomment-5186024515\nprior_amendment: https://github.com/whatrune/sd-prompt-studio/issues/251#issuecomment-5186078512\nprior_review: https://github.com/whatrune/sd-prompt-studio/issues/251#issuecomment-5186124818\nreviewed_current_main: f5f55d68ab81a203151339bf481d0a484c7dbe41\nphase: 1\nscope:\n  - Terminal Review Admission\n  - Merge Decision Admission\nready_transition_scope: observation_only\nproduction_host_count: 1\nproduction_entrypoint_count: 1\nimplementation_ready: false\nimplementation_allowed: false\nissue_250_role: first_mandatory_consumer\nissue_250_implementation_allowed: false\nissue_248_correction_allowed: false\nissue_249_merge_allowed: false\n```\n\n## Topology choice\n\n### Single production host\n\nThe only Phase 1 production admission host is one dedicated GitHub Actions workflow on the existing GitHub Actions runtime:\n\n```text\n.github/workflows/protected-transition-admission-v1.yml\n```\n\nThe only public production entrypoint is that workflow's default-branch `workflow_dispatch` event. Dispatch on a non-default ref, a reusable-workflow call, `schedule`, `workflow_run`, PR event, Issue event, local CLI execution, or another host is not an admitted production invocation.\n\nThe workflow is a finite on-demand run. No scheduler, daemon, service, polling loop, callback host, webhook host, alternate workflow, Cloudflare worker, local background process, or second entrypoint is allowed.\n\n### Internal composition\n\nThe host may invoke exactly one internal composition command:\n\n```text\nscripts/run-protected-transition-admission-v1.mjs\n```\n\nIts pure admission symbol is:\n\n```text\nevaluateProtectedTransitionAdmissionV1\n```\n\nThe command and pure symbol are internal to the single workflow host. Direct local invocation may be used only for deterministic Validation and produces no admissible production receipt.\n\nThe host reuses, and does not duplicate or replace:\n\n- `scripts/run-ready-review-terminal-observation-collector-v1.mjs`;\n- `OwnerOnlyReadyReviewObservationTransportAdapterV1.collect`;\n- `evaluateReadyReviewTerminalObservationCoreV1`; and\n- `parseReadyReviewTerminalObservationArtifactV1`.\n\nCollector V1 remains the only review-terminal observation producer. Protected Transition Admission V1 is its mandatory consumer, not another Collector and not a review or Merge authority owner.\n\n## Single-entrypoint inputs and caller binding\n\nThe closed `workflow_dispatch` input set is:\n\n- `transition`: exactly `terminal_review_admission` or `merge_decision_admission`;\n- `pr_number`: exact positive PR number;\n- `exact_head`: exact 40-lowercase-hex PR HEAD;\n- `task_record_url`: direct canonical Task Issue record;\n- `ready_generation_record_url`: direct canonical current Ready Generation Record;\n- `terminal_review_record_url`: absent for Terminal Review Admission and required for Merge Decision Admission.\n\nRepository identity is fixed by the workflow repository and is not caller-selectable. Workflow ref must be exactly the default branch. The host binds its own full workflow revision, run ID, run attempt, actor, repository, PR, Ready generation, transition, and exact HEAD.\n\nCaller admission is existing authority, not a new Role:\n\n- Terminal Review Admission caller: the assigned Reviewing Role named by the canonical review assignment.\n- Merge Decision Admission caller: Product Owner.\n- Ready caller: out of scope. The host only observes the canonical Ready Generation Record and exact Ready event; it never invokes or reverses Ready.\n\nActor, Role, Task, PR, Ready generation, or HEAD mismatch fails before Collector invocation.\n\n## Sealed Collector artifact and persistence\n\nFor every accepted run, the single host invokes the existing Collector V1 exactly once after caller/input admission.\n\n- Terminal Review Admission requires one newly produced sealed Collector artifact for the current Ready generation and exact HEAD.\n- Merge Decision Admission requires the canonical exact-HEAD Terminal Review record plus a distinct newly produced sealed Collector artifact acquired after that record.\n- The host MUST consume the exact Collector JCS bytes through `parseReadyReviewTerminalObservationArtifactV1`.\n- Direct GitHub thread, receipt, roster, or HEAD refetch MUST NOT substitute for the sealed artifact. GitHub reads are allowed only inside the existing Collector transport or for direct authority/identity binding required by the host.\n- No admission receipt is produced when Collector transport, Core, parser, identity, temporal, completeness, seal, or post-snapshot HEAD checks fail.\n\nThe existing GitHub Actions artifact service is the persistence owner. One successful run uploads exactly one non-overwritable artifact containing:\n\n```text\nready-review-terminal-observation-artifact-v1.jcs\nprotected-transition-admission-v1-receipt.jcs\n```\n\nThe upload MUST fail when either file is absent. The canonical evidence binding includes the workflow run URL, artifact ID, artifact URL, artifact archive SHA-256 digest, Collector artifact SHA-256 digest, admission receipt SHA-256 digest, host workflow revision, and expiration timestamp. Deletion, expiry, inaccessible bytes, overwrite/replacement, run deletion, digest mismatch, or missing direct URL invalidates admission and requires a new run.\n\n## Phase 1 admission semantics\n\n### Terminal Review Admission\n\nThe host returns an accepted sealed receipt only when:\n\n- the caller is the assigned Reviewing Role;\n- the Task, PR, Ready generation, exact HEAD, roster, terminal receipts, complete thread snapshot, and post-snapshot HEAD recheck are current and mutually bound;\n- exact persisted Collector bytes parse successfully;\n- every condition frozen by Issue #250 is satisfied; and\n- the terminal result has not yet been published for this admission identity.\n\nThe Reviewing Role remains the semantic owner and must inspect every returned thread. The canonical Terminal Review result MUST bind the host run URL, artifact URL/ID/digests, exact HEAD, and admission receipt digest. The host does not choose `approval-equivalent`, `changes required`, or `blocked`.\n\n### Merge Decision Admission\n\nThe host returns an accepted sealed receipt only when:\n\n- the caller is Product Owner;\n- the canonical Terminal Review result is bound to the same Task, PR, Ready generation, and exact HEAD;\n- the Terminal Review result binds a valid Terminal Review Admission receipt;\n- a second Collector artifact is newly produced after the Terminal Review record;\n- the second exact persisted artifact parses successfully and proves the same unchanged HEAD with complete later evidence; and\n- no authority, finding, thread, receipt, Ready generation, PR state, or HEAD conflict exists.\n\nProduct Owner remains the Merge Decision owner. The canonical Merge Decision MUST bind the later host run and receipt. The host does not invoke GitHub Merge, select a Merge method, mark Ready, Approve, update Gate Status, publish Completion, Commit, or publish a branch.\n\n## First mandatory consumer\n\nIssue #250 is the first and only Phase 1 mandatory consumer frozen by this Decision.\n\nWhen Issue #250 is separately authorized and later reaches its Terminal Review and Merge Decision gates:\n\n1. its Terminal Review cannot be canonical without an accepted Terminal Review Admission V1 receipt;\n2. its Merge Decision cannot be canonical without a distinct later accepted Merge Decision Admission V1 receipt; and\n3. neither receipt may be substituted by direct GitHub refetch, point-in-time thread count, stdout prose, copied JSON, or a prior artifact.\n\nThis Decision does not start, modify, bootstrap, or implement Issue #250.\n\n## Fail-closed and non-authority boundary\n\nThe host has no mutation permission for pull requests, Issues, contents, refs, deployments, or Merge. It receives only the minimum read permissions needed for canonical records, PR identity, workflow contents, and Collector acquisition, plus the runtime capability required to upload its own artifact.\n\nMissing, malformed, inaccessible, stale, conflicting, duplicate, mixed-generation, prior-HEAD, incomplete, unsealed, noncanonical, expired, deleted, actor-mismatched, ref-mismatched, or revision-mismatched input fails the run. Failure emits no accepted receipt and grants no authority.\n\nAn accepted receipt is prerequisite evidence only. It does not transfer Reviewing Role authority, Product Owner authority, protected-action authority, finding authority, Gate Status authority, Completion authority, or Merge-operation authority.\n\n## Explicit exclusions\n\nPhase 1 excludes:\n\n- Ready mutation, exclusive Ready caller, and Ready rollback;\n- Merge execution or Merge-method selection;\n- Completion, Commit, Publication, Architecture, Resume, and other Gate admission;\n- scheduler/background service;\n- alternate host or entrypoint;\n- direct GitHub refetch as a sealed Collector artifact substitute;\n- Issue #250 implementation;\n- Issue #248 correction; and\n- PR #249 operation or Merge.\n\n```yaml\ntopology_decision_recorded: true\nsingle_host: .github/workflows/protected-transition-admission-v1.yml\nsingle_entrypoint: workflow_dispatch_on_default_branch\nphase_1_transition_count: 2\nready_observation_only: true\nissue_250_first_mandatory_consumer: true\nimplementation_ready: false\nimplementation_allowed: false\narchitecture_amendment_required: true\nindependent_architecture_review_required: true\n```",
  "https://github.com/whatrune/sd-prompt-studio/issues/251#issuecomment-5186264557": "# Fresh Independent Architecture Review Decision — Protected Transition Admission V1 Phase 1 Topology\n\nThis Decision independently reviews the Product Owner Topology Decision and exact same-Candidate Amendment against current repository and GitHub Actions reality. It does not authorize implementation or select a bootstrap exception.\n\n```yaml\ntask_id: PROTECTED-TRANSITION-ADMISSION-V1-ARCHITECTURE-CANDIDATE-001\nrecord_type: independent_architecture_review_decision\nauthoring_role: Independent Architecture Reviewer\nauthority_source: https://github.com/whatrune/sd-prompt-studio/issues/251\ncanonical_record: https://github.com/whatrune/sd-prompt-studio/issues/251#issuecomment-5186264557\nreviewed_topology_decision: https://github.com/whatrune/sd-prompt-studio/issues/251#issuecomment-5186163757\nreviewed_amendment: https://github.com/whatrune/sd-prompt-studio/issues/251#issuecomment-5186233723\nreviewed_current_main: f5f55d68ab81a203151339bf481d0a484c7dbe41\ndecision: BLOCKED\nfinding_ids:\n  - B-PTA-BOOTSTRAP-001\nfinding_count: 1\nblocking_finding_count: 1\nunknown_count: 0\nimplementation_ready: false\nimplementation_allowed: false\nrequired_next_owner: Product Owner\nrequired_next_decision: bootstrap_order_or_one_time_applicability_boundary\nissue_250_implementation_allowed: false\nissue_248_correction_allowed: false\nissue_249_operation_allowed: false\nissue_249_merge_allowed: false\nstatus: completed\nexecution_stop_reason: architecture_gap\n```\n\n## Fresh Repository Reality\n\nImmediately before this Decision:\n\n- remote `main` was exactly `f5f55d68ab81a203151339bf481d0a484c7dbe41`;\n- active workflows were only `.github/workflows/deploy.yml`, `.github/workflows/preview.yml`, and `.github/workflows/research-claims.yml`;\n- `.github/workflows/protected-transition-admission-v1.yml` and the other four conditional host-slice paths did not exist;\n- current main contained no `post_snapshot_head_recheck`;\n- active rulesets were `0` and `main` protection was absent;\n- Issue #250 remained open, `approved_held`, unimplemented, and `implementation_allowed: false`; its implementation branch did not exist;\n- PR #249 remained open, Draft, and unmerged at `3cb93b4be038edd5f32404c40105e8027a59295e`.\n\nThe existing Collector topology remains one private `OwnerOnlyReadyReviewObservationTransportAdapterV1.collect`, one Collector CLI, one invocation of `evaluateReadyReviewTerminalObservationCoreV1`, stdout-only exact JCS output, and the existing `parseReadyReviewTerminalObservationArtifactV1`. The parser has no current non-test admission consumer. Current exact-main artifacts retain 16 top-level fields but do not contain the nested post-snapshot HEAD recheck required by Issue #250.\n\nGitHub's current `workflow_dispatch` contract states that the workflow file must exist on the default branch before the event can be triggered: https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow#defining-inputs-for-manually-triggered-workflows\n\n## Topology review\n\nThe following Phase 1 boundaries are internally closed and consistent:\n\n- exactly one GitHub Actions workflow host and one default-branch `workflow_dispatch` public entrypoint;\n- exactly Terminal Review Admission and Merge Decision Admission; Ready is observation-only;\n- existing Collector CLI, private adapter, pure Core, and exact-byte parser are reused without a second Collector or transport;\n- the runner invokes the existing Collector CLI once, preserves its stdout bytes, and passes those same bytes to the parser;\n- direct thread, receipt, roster, or HEAD refetch cannot substitute for the sealed artifact;\n- assigned Reviewing Role remains Terminal Review semantic/finding owner, Product Owner remains Merge Decision owner, and the designated operator remains the separate Merge actor;\n- the host has read-only repository permissions plus artifact upload capability and has no Ready, Issue/PR write, ref, status, deployment, or Merge capability;\n- the six workflow inputs, host-derived identity, closed pure input/result, accepted receipt, distinct later Merge artifact, persistence binding, invalidation rules, conditional five-path allowlist, and positive/negative/composition/topology/persistence/mandatory-consumer matrix are sufficiently closed;\n- Issue #250 is explicitly the first mandatory consumer, while its seven-path Collector repair remains separate and unchanged.\n\nNo additional Architecture `UNKNOWN` remains.\n\n## Confirmed blocking finding\n\n### B-PTA-BOOTSTRAP-001 — default-branch host and first mandatory consumer form an unsatisfied deployment cycle\n\nThe finding is confirmed:\n\n1. **Host first cannot satisfy the consumer.** Merging only the five-path host slice would place the workflow on the default branch, but its default-branch Collector/parser revision would still lack Issue #250's mandatory `post_snapshot_head_recheck`. It therefore cannot produce an admissible Terminal Review or Merge Decision receipt for Issue #250.\n2. **Issue #250 first cannot pass its own gates.** Issue #250 cannot reach a canonical Terminal Review or Merge Decision without the mandatory receipts, while the default branch does not yet contain the only admitted host.\n3. **A combined PR does not close the cycle.** The workflow file must first exist on the default branch, and the frozen entrypoint rejects non-default-ref dispatch. The combined candidate changes are therefore unavailable to an admissible production run before Merge.\n4. **The frozen alternatives are prohibited.** A non-default dispatch, alternate workflow/host, target-branch code, direct-refetch substitute, or silent exemption for Issue #250 would contradict the exact Topology Decision rather than resolve it.\n\nThis is a known dependency conflict, not missing evidence. Architect Team cannot close it by implementation detail because resolution changes Product Owner topology/applicability meaning.\n\n## Decision boundary\n\nDecision is `BLOCKED`, with one blocking finding and `unknown_count: 0`. The Amendment is correct to retain `implementation_ready: false` and `implementation_allowed: false`.\n\nA separate Product Owner Decision must explicitly freeze bootstrap ordering or a one-time applicability boundary. This review does not choose that decision, create an alternate host, exempt Issue #250, or authorize any repository, workflow, settings, Issue #250, Issue #248, or PR #249 change.\n\nNo implementation, repository edit, workflow/settings mutation, Issue body or PR state change, Ready, GitHub Approve, Merge, or Issue close was performed.",
  "https://github.com/whatrune/sd-prompt-studio/issues/251#issuecomment-5203226004": "# Cumulative Architecture Amendment — Canonical Finalization Binding V1\n\n```yaml\nrecord_type: phase_1_canonical_finalization_binding_architecture_amendment_v1\nrecorded_at: current_time_not_backdated\nauthoring_role: Architecture Owner\nauthority_issue: https://github.com/whatrune/sd-prompt-studio/issues/251\nprior_amendment: https://github.com/whatrune/sd-prompt-studio/issues/251#issuecomment-5203031761\nprior_amendment_body_sha256: 89ab46758fc25dcd18fa642de52779c2abae8bd285ae5dc52b7f18986df3579f\nsource_review: https://github.com/whatrune/sd-prompt-studio/issues/251#issuecomment-5203080532\nsource_review_body_sha256: 2cbb57fe3d0ffd42a1c3b6094390d76006ef649f6dc4851cfd9ca7baf775184a\nclosed_finding_ids:\n  - B-251-FINALIZATION-BINDING-RESOLUTION-002\n  - B-251-ASSIGNMENT-PREDECESSOR-DIGEST-003\nblocked_task: https://github.com/whatrune/sd-prompt-studio/issues/259\npull_request: https://github.com/whatrune/sd-prompt-studio/pull/260\nreviewed_head: 164a6ec65155d7498f111ef66721acb16e22a189\nreviewed_base: 413cd0ba0d858e1497bbc5e6ea8a88231fb55c67\ndecision: AMENDMENT_COMPLETE\ncanonical_finalization_binding_record_type: canonical_finalization_binding_v1\ncanonical_finalization_binding_field_count: 20\nblocking_finding_count: 0\nunknown_count: 0\nfive_file_allowlist_sufficient: true\nsix_workflow_inputs_sufficient: true\nsecond_collector_required: false\nsecond_host_required: false\nnew_permission_required: false\nassignment_schema_changed: false\nimplementation_ready: false\nimplementation_allowed: false\nassignment_revision_2_allowed: false\nready_generation_revision_4_allowed: false\ncollector_allowed: false\nworkflow_dispatch_allowed: false\nterminal_review_allowed: false\nmerge_decision_allowed: false\nmerge_allowed: false\nindependent_architecture_review_required: true\nstatus: completed\nexecution_stop_reason: cumulative_amendment_recorded\n```\n\nThis Amendment is cumulative with the approved Phase 1 bootstrap-order, actor-authority, issuer-trust-root, Terminal provenance/currentness, generation-aware assignment-lineage, and canonical self-binding edit-semantics Architecture. It closes only `B-251-FINALIZATION-BINDING-RESOLUTION-002` and `B-251-ASSIGNMENT-PREDECESSOR-DIGEST-003` by adding a non-self-binding finalization authority record. It grants no implementation or protected-action authority.\n\n## 1. Fresh authority and Repository Reality\n\nFresh direct canonical retrieval established:\n\n- Review `https://github.com/whatrune/sd-prompt-studio/issues/251#issuecomment-5203080532` is `CHANGES_REQUIRED`, blocker `2`, UNKNOWN `1`, body SHA-256 `2cbb57fe3d0ffd42a1c3b6094390d76006ef649f6dc4851cfd9ca7baf775184a`.\n- `B-251-FINALIZATION-BINDING-RESOLUTION-002` requires one deterministic source, identity tuple, cardinality rule, acquisition order, and failure boundary for the digest that finalized a target.\n- `B-251-ASSIGNMENT-PREDECESSOR-DIGEST-003` requires every historical assignment predecessor's finalized expected body digest to remain uniquely discoverable without changing the 23-field assignment schema.\n- PR #260 remains Ready/open at HEAD `164a6ec65155d7498f111ef66721acb16e22a189`, base `413cd0ba0d858e1497bbc5e6ea8a88231fb55c67`, cumulative five-file scope.\n- The current runner already owns authenticated Task-Issue pagination, direct comment re-fetch, strict record parsing, RFC 8785 JCS hashing, Ready/event acquisition, generation-aware assignment traversal, single Collector invocation, and accepted/rejected/failed persistence.\n- Exact current symbols are `parseRecordBody`, `exactObjectKeys`, `bodyDigest`, `acquireCanonicalRecord`, `paginated`, `acquireReadyEventEvidence`, `validateGenerationAwareAssignmentLineageV1`, `acquireAssignment`, `validateReadyGenerationCollectorBindingV1`, and `main` in `scripts/run-protected-transition-admission-v1.mjs` at Git blob `c7bb984cc6b1dc4d78e7948818a4bb9c97b8da17`.\n- The Task Issue already supplies the search root; existing `issues: read` is sufficient. No workflow input, write permission, store, host, entrypoint, or Collector is needed.\n\nThe repair closes within the frozen five paths and six workflow inputs. No sixth path, seventh input, second Collector, second host, schema/artifact version, parser replacement, or broader permission is authorized.\n\n## 2. New non-self-binding authority record\n\nThe exact record type is `canonical_finalization_binding_v1`. Its comment body MUST be exactly one RFC 8785 canonical JSON object and nothing else: no Markdown fence, heading, prose, leading/trailing whitespace, or trailing newline. It is posted once as a completed body. It contains no field for its own GitHub comment URL and therefore requires no reservation or finalization edit.\n\nThe exact field set is these 20 fields, with no aliases and no additional keys:\n\n1. `record_type`\n2. `binding_id`\n3. `binding_record_digest`\n4. `binding_mode`\n5. `target_canonical_url`\n6. `target_record_type`\n7. `target_record_digest`\n8. `target_final_body_sha256`\n9. `target_author_login`\n10. `repository`\n11. `task_record_url`\n12. `task_scope_digest`\n13. `pr_number`\n14. `pr_url`\n15. `target_revision`\n16. `target_ready_event_id`\n17. `issuer_login`\n18. `issuer_role`\n19. `issuer_trust_root_record_url`\n20. `issuer_trust_root_record_digest`\n\n### Exact value contract\n\n- `record_type`: exactly `canonical_finalization_binding_v1`.\n- `binding_id`: `CFB1-` plus lower-case SHA-256 of RFC 8785 JCS for the exact selector object `{repository,task_record_url,pr_number,target_canonical_url,target_record_type}`. This is stable for one target canonical URL and cannot vary with comment order.\n- `binding_record_digest`: lower-case SHA-256 of RFC 8785 JCS for the exact 20-field record with only `binding_record_digest` omitted.\n- `binding_mode`: exactly `contemporaneous` or `retroactive`.\n- `target_canonical_url`: one direct Issue-comment URL on the exact `task_record_url` Issue in `repository`.\n- `target_record_type`: exactly one of `ready_review_generation_record_v1`, `ready_review_producer_roster_v1`, `terminal_review_actor_assignment_v1`, or `merge_decision_actor_assignment_v1`.\n- `target_record_digest`: the lower-case SHA-256 carried by the target's strict `record_digest` field and verified against the target record projection.\n- `target_final_body_sha256`: lower-case SHA-256 of the complete UTF-8 body bytes returned by direct GitHub API re-fetch for `target_canonical_url`, including any Markdown/prose bytes.\n- `target_author_login`: the direct target-comment API author login. It must equal the independently admitted issuer login for the target record type.\n- `repository`: exactly `whatrune/sd-prompt-studio`.\n- `task_record_url`: exactly the controlling Task Issue URL; for this bootstrap Task, `https://github.com/whatrune/sd-prompt-studio/issues/259`.\n- `task_scope_digest`: SHA-256 of the direct-refetched current Task Issue body used by the consumer.\n- `pr_number` / `pr_url`: exact positive PR number and canonical URL; for this Task, `260` and `https://github.com/whatrune/sd-prompt-studio/pull/260`.\n- `target_revision`: positive integer for Ready Generation or either assignment record; `null` for Producer Roster.\n- `target_ready_event_id`: the exact non-empty decimal-string Ready REST event ID carried or transitively bound by the target. It is `ready_event_id` for Generation/Roster/assignment records.\n- `issuer_login` / `issuer_role`: the independently admitted Finalization Binding issuer, never inferred from the target body, workflow caller, Ready actor, Task author, Issue assignee, or comment order.\n- `issuer_trust_root_record_url` / `issuer_trust_root_record_digest`: the implementation-pinned canonical URL and full UTF-8 body SHA-256 of this Amendment after it receives a fresh Independent Architecture Review `APPROVE`, blocker `0`, UNKNOWN `0`.\n\nNumbers remain JSON numbers, `target_revision` is JSON `null` where required, and all strings are exact case-sensitive values. The strict parser rejects duplicate JSON keys, non-canonical JSON bytes, numeric coercion, unknown keys, wrong nullability, and alternative encodings.\n\n## 3. Finalization Binding issuer trust root\n\nThis independently reviewed Amendment is the root `PTA-V1-PHASE-1-CANONICAL-FINALIZATION-BINDING-ISSUER-ROOT`, revision `1`. Future implementation must pin this Amendment's canonical URL/full-body SHA-256 and the fresh Independent Architecture Review URL/full-body SHA-256/decision. The binding record cannot select or replace that root.\n\nExact target-type capability mapping:\n\n| Target record type | Required issuer role | Frozen issuer login | Existing authority anchor |\n|---|---|---|---|\n| `ready_review_generation_record_v1` | Integrated Lead | `whatrune` | https://github.com/whatrune/sd-prompt-studio/issues/251#issuecomment-5198928778 |\n| `ready_review_producer_roster_v1` | Integrated Lead | `whatrune` | https://github.com/whatrune/sd-prompt-studio/issues/251#issuecomment-5198928778 |\n| `terminal_review_actor_assignment_v1` | Integrated Lead | `whatrune` | https://github.com/whatrune/sd-prompt-studio/issues/251#issuecomment-5198928778 |\n| `merge_decision_actor_assignment_v1` | Product Owner | `whatrune` | https://github.com/whatrune/sd-prompt-studio/issues/251#issuecomment-5186163757 |\n\nThe same current login does not merge role capabilities. Direct API comment author, `issuer_login`, `issuer_role`, target type capability, root pin, root Review, and target author must all match. A self-asserted issuer, mismatched target author, cross-role binding, target-body role claim, or workflow caller cannot establish authority.\n\nThe Binding comment itself MUST satisfy:\n\n- it is posted on the exact Task Issue selected by `task_record_url`;\n- complete body is posted in one create operation;\n- direct API `created_at == updated_at`;\n- direct API author login equals `issuer_login` and the target-type root mapping;\n- body bytes are already exact canonical JCS;\n- exact 20 fields and types pass;\n- recomputed `binding_id` and `binding_record_digest` match;\n- the root URL/digest fields equal implementation pins;\n- direct target and Task/PR scope checks pass.\n\nAny Binding edit is invalid. A replacement or duplicate cannot win by chronology because cardinality becomes non-admitting.\n\n## 4. Target finalization state machine\n\n### Contemporaneous publication\n\n1. Create the self-binding target comment only to obtain its canonical URL. The reservation is non-authoritative.\n2. Finalize the target body with canonical URL and its valid in-record JCS `record_digest`.\n3. Directly re-fetch the target; validate strict parser, exact field set, canonical URL, API author, record projection digest, repository/Task/PR/type/revision/generation scope, and compute the complete final-body SHA-256.\n4. Construct the complete non-self-binding `canonical_finalization_binding_v1` from those observed bytes and the pinned root.\n5. Post that exact canonical JCS body once to the same Task Issue.\n6. Directly re-fetch the Binding and validate its one-shot timestamp equality, author, exact fields/JCS/digests/root/scope.\n7. Only after complete Task-comment pagination resolves exactly that one Binding may the target become authority. Before step 7 it is unfinalized and unusable.\n\n### Post-finalization mutation\n\nEvery later consumer re-fetches the target and the unique Binding. The current complete target body SHA-256 and current in-record `record_digest` must equal the Binding's `target_final_body_sha256` and `target_record_digest`. Target canonical URL, record type, target author, Task/PR/revision/generation tuple, and strict record projection must also match. Recomputing the target's internal digest after an edit does not restore authority. Any post-finalization target body, record digest, URL, author, or scope change is fail closed.\n\nTarget GitHub `created_at`/`updated_at` remain chronology observations only; equality is neither required nor sufficient. Binding-comment timestamp equality remains mandatory because the Binding is non-self-referential and must be published once.\n\n## 5. Deterministic lookup, acquisition order, and cardinality\n\nFor every in-scope target, the consumer MUST:\n\n1. derive the Task Issue only from the strict `task_record_url` authority and require the target URL to be a comment on that exact Issue;\n2. fully paginate all Task Issue comments, 100 per page, through the first page with fewer than 100 results; comment order and timestamps never select a winner;\n3. treat every strict `canonical_finalization_binding_v1` type claim as declared authority: malformed JSON, duplicate keys, non-canonical JCS, unexpected keys, or invalid digest is `failed`;\n4. direct-refetch each declared Binding by its listed URL and require listed/direct URL, API author, timestamps, exact body bytes/JCS, self-digest, root, and scope to match;\n5. select only valid Bindings whose `target_canonical_url` exactly equals the direct target URL and whose deterministic `binding_id` matches the target selector;\n6. require exactly one selected Binding; zero is `rejected: finalization_binding_missing`, two or more is `rejected: finalization_binding_ambiguous`;\n7. direct-refetch the target and compare its current full-body SHA-256, record digest, type, URL, author, Task/PR/revision/generation scope with that Binding;\n8. acquire every assignment predecessor's own issuance-era Generation/event evidence and its own unique Finalization Binding before lineage selection;\n9. run the existing generation-aware chain rules and return only the unique current leaf after every historical member is integrity-valid;\n10. immediately before Collector invocation, re-fetch the current Ready Generation, its bound Producer Roster, all assignment-chain targets, and their Bindings; require the same URL/body/record/binding digests;\n11. invoke the existing Collector exactly once;\n12. compare Collector output to the same Generation-selected Roster URL/record digest and Ready tuple;\n13. after Collector completion and before evaluator acceptance/persistence, repeat complete Binding pagination and direct target/Binding re-fetch; require the same selected comment URLs, Binding digests, target body digests, record digests, and exact HEAD; any drift is non-admitting.\n\nThe pre/post complete snapshots close duplicate-insertion and target-edit races. A second valid or malformed Binding appearing during execution cannot be ignored. No caller supplies a Binding URL or digest; discovery is canonical and Task-scoped.\n\n### Failed versus rejected\n\n- `failed`: endpoint/pagination/direct-refetch failure; malformed strict claim; non-canonical Binding body; Binding edit; invalid exact fields/JCS/self-digest/root evidence; target parser/JCS failure; inability to establish target author/body bytes; or pre/post snapshot incompleteness.\n- `rejected`: trustworthy complete evidence of zero or multiple valid Bindings; trusted issuer/role/type mismatch; target URL/body SHA/record digest/author/scope mismatch; stale/retroactive target mismatch; generation/event mismatch; chain gap/fork/cycle/multiple-current-leaf; or pre/post trustworthy drift.\n\nBoth states remain fail closed, `state_changed: false`, no admitted artifact, and no protected transition. Existing diagnostic/persistence semantics remain cumulative.\n\n## 6. Historical assignment predecessor closure\n\nThe 23-field assignment schema remains unchanged. It does not gain predecessor body/digest or Binding fields.\n\nFor every `terminal_review_actor_assignment_v1` and `merge_decision_actor_assignment_v1` comment discovered by `acquireAssignment`, the runner resolves the exact unique `canonical_finalization_binding_v1` from that assignment's own canonical URL. That Binding supplies the previously finalized full-body SHA-256 and target record digest. The runner validates each historical predecessor against:\n\n- its unique Binding and current direct body bytes;\n- its own assignment `record_digest` and exact 23 fields;\n- its immutable predecessor URL link and contiguous revision;\n- its own issuance-era Ready Generation, which must itself resolve one unique Finalization Binding;\n- its own Ready event ID/timestamp and historical exact-HEAD/generation tuple;\n- the same assignment ID, repository, Task, PR, transition, role, and issuer root.\n\nOnly the unique current assignment leaf is compared to the current PR HEAD/current Ready Generation/current Ready event. It also requires its own unique Binding. A newly posted assignment revision 2 is unusable between target finalization and successful Binding publication. Historical predecessors authenticate lineage but never become current authority.\n\nBecause every predecessor target has a stable unique Binding on the Task Issue, its expected finalized full-body digest is discoverable on every run without adding an assignment field, workflow input, receipt field, or caller locator. A later target edit mismatches its Binding; a second/replacement Binding leaves zero/multiple or integrity failure and cannot silently redefine history. This closes `B-251-ASSIGNMENT-PREDECESSOR-DIGEST-003`.\n\n## 7. Retroactive Finalization Binding\n\n`binding_mode: retroactive` is permitted only for existing self-binding records that predate this Amendment and have never been changed after the fresh observations frozen here. It establishes their current exact bytes as the baseline for future consumers; it does not backdate authority, validate a historical protected action, or make old Ready/Collector evidence current.\n\nBefore a retroactive Binding may be issued, all of these must pass:\n\n- direct target API URL/body/author and current body SHA equal the exact frozen observation below;\n- strict target parser, exact field set, canonical URL, and in-record JCS digest pass;\n- target author matches the new Finalization Binding issuer root;\n- Task body digest and repository/PR scope match;\n- Ready event ID/timestamp exists uniquely in the PR timeline;\n- Generation/Roster/assignment links and digests are internally consistent;\n- no existing Binding claim for the target exists after complete pagination;\n- the Binding is one-shot canonical JCS and directly re-fetched after creation.\n\nExact eligible bootstrap targets:\n\n| Target | Type | Revision | Ready event | Current body SHA-256 | Record digest |\n|---|---|---:|---|---|---|\n| https://github.com/whatrune/sd-prompt-studio/issues/259#issuecomment-5199802089 | `ready_review_producer_roster_v1` | null | `29044304312` | `c4417de50a29f08461a7bf7964b1afa2e1a25631c8a68a0fb64b34bb9e53947b` | `dbd7689ef71669d4deb9c589e104cd9ccbf382dd50740b78d8203b8a99c55125` |\n| https://github.com/whatrune/sd-prompt-studio/issues/259#issuecomment-5199802201 | `ready_review_generation_record_v1` | 1 | `29044304312` | `7aae7e2735ec6e1a1d6db65b14b501fe905d59b43da705e95231b25affb9d475` | `df86b68a470f2763f2793bfbee5f63e2b877aa3e5fefc031824f042ead34de4c` |\n| https://github.com/whatrune/sd-prompt-studio/issues/259#issuecomment-5200119580 | `terminal_review_actor_assignment_v1` | 1 | `29044304312` | `6055cfc70790f1d8b8cabdb3663ea2a56baae7656d9c8a1d3a5f289f0c25724d` | `074a60efa79b036202a61965160202c125229ab8a01c5c6acabe1cce0e3c21db` |\n| https://github.com/whatrune/sd-prompt-studio/issues/259#issuecomment-5202785625 | `ready_review_producer_roster_v1` | null | `29059119053` | `97669b895b81e5da59c31cfd3a7b29dc8e0b7098f71ab3b86bdbd2982bb4c121` | `661301f12c1aa00dfdad28784cb5990eec5a7807727c69339b5bc62d39d49c28` |\n| https://github.com/whatrune/sd-prompt-studio/issues/259#issuecomment-5202790162 | `ready_review_generation_record_v1` | 3 | `29059119053` | `c79d3d2d4e74067b6062f829720109f62ea3faf57481d70e0ac286d28211442f` | `b970c2e71a1ca9d61ae76ce1c62569a121d8e76705e83d3b6eae06d3fb569add` |\n\nNo other historical record is implicitly eligible. A new eligibility decision requires a later reviewed cumulative Amendment. Existing target comments are never edited.\n\n## 8. Exact record-type scope\n\nFinalization Binding V1 applies only to these self-binding Issue-comment record types:\n\n- `ready_review_generation_record_v1`;\n- `ready_review_producer_roster_v1`;\n- `terminal_review_actor_assignment_v1`;\n- `merge_decision_actor_assignment_v1`.\n\nIt does not automatically apply to Architecture Amendments, Reviews, trust roots, authority anchors, Task records, Result Handoffs, workflow-run artifacts, Collector artifacts, admission receipts, or other non-self-binding records. Collector artifacts remain exact JCS/seal/digest/exact-HEAD evidence, not GitHub self-binding comments. Existing Terminal lineage provenance/currentness rules remain cumulative and are not broadened by this two-finding repair.\n\n## 9. Implementation and Validation boundary\n\nFuture implementation may modify only the existing frozen five paths:\n\n1. `.github/workflows/protected-transition-admission-v1.yml`\n2. `scripts/fixtures/protected-transition-admission-v1.json`\n3. `scripts/run-protected-transition-admission-v1.mjs`\n4. `scripts/test-protected-transition-admission-v1.mjs`\n5. `src/continuous-orchestration/protected-transition-admission-v1.ts`\n\nThe workflow remains one default-branch `workflow_dispatch` host with exactly six inputs: `transition`, `pr_number`, `exact_head`, `task_record_url`, `ready_generation_record_url`, and `terminal_review_record_url`. Permissions remain `actions: read`, `contents: read`, `issues: read`, and `pull-requests: read`. It creates no Binding; human-role publication occurs before workflow admission. The runner uses one entrypoint and one existing Collector invocation.\n\nRequired focused positive coverage:\n\n- one-shot Binding canonical JCS/exact 20 fields/self-digest/root/author admission;\n- contemporaneous target reservation/finalization then Binding, with target unusable before Binding and admitted after Binding;\n- exact retroactive bindings for the five frozen targets above;\n- historical assignment revision 1 at its own Generation plus current revision 2 at the current Generation, each with a unique Binding;\n- current Generation and its Roster each with a unique Binding;\n- pre/post full pagination and target/Binding re-fetch remain identical;\n- Terminal Review and Merge Decision assignments use the identical binding algorithm with separate issuer roles.\n\nRequired negative/failure coverage:\n\n- zero/two Bindings, duplicate deterministic ID, malformed strict claim, wrong issue, target URL/type/body SHA/record digest/author/revision/event, wrong Task digest/PR scope, wrong issuer/root/role, cross-role binding;\n- edited Binding, non-canonical JSON, Markdown/prose/trailing newline, unknown/missing field, duplicate JSON key, invalid JCS/self-digest;\n- target edited and internally re-sealed after Binding; Binding deleted/absent; replacement/duplicate Binding; target or Binding changes between pre/post snapshots;\n- historical predecessor missing/wrong Binding, assignment gap/fork/cycle/multiple current leaf, historical substitution, current tuple mismatch;\n- retroactive target not in the exact allowlist, frozen body/digest/author/event mismatch, or evidence inaccessible;\n- no Collector before all bindings admit, exactly one Collector afterward, zero mutation, no bypass, exact five-file diff, exact six inputs, read-only permissions, full test/build/diff/allowlist.\n\nNo receipt schema, 23-field assignment schema, workflow input, Collector schema/artifact version, host, or permission expansion is authorized.\n\n## 10. Blocker disposition and hold\n\n- `B-251-FINALIZATION-BINDING-RESOLUTION-002`: CLOSED architecturally by the exact non-self-binding 20-field record, pinned issuer root, full Task pagination, strict lookup/cardinality, and pre/post digest rechecks.\n- `B-251-ASSIGNMENT-PREDECESSOR-DIGEST-003`: CLOSED architecturally by resolving one persistent Binding from every assignment canonical URL, including historical predecessors, without changing the 23-field schema.\n- remaining Architecture blockers: `0`.\n- remaining UNKNOWN: `0`.\n\nA fresh Independent Architecture Review must bind this Amendment's canonical URL and full-body SHA-256 and decide `APPROVE | CHANGES_REQUIRED | BLOCKED`. Until `APPROVE` with blocker `0` and UNKNOWN `0`, `implementation_ready: false` and `implementation_allowed: false`.\n\nNo existing canonical comment edit, assignment revision 2, Ready Generation revision 4, repository file change, Commit, Push, PR state/body change, Collector execution, workflow dispatch, Terminal Review, GitHub Approve, Merge Decision, or Merge is authorized or performed by this Amendment.",
  "https://github.com/whatrune/sd-prompt-studio/issues/251#issuecomment-5203281050": "# Independent Architecture Review Decision — Canonical Finalization Binding V1\n\n```yaml\nrecord_type: independent_architecture_review_decision\nrecorded_at: current_time_not_backdated\nreviewing_role: Independent Architecture Reviewer\nauthority_issue: https://github.com/whatrune/sd-prompt-studio/issues/251\nreview_dispatch: https://github.com/whatrune/sd-prompt-studio/issues/251#issuecomment-5203236411\nreview_dispatch_body_sha256: 491bb0344e8eb4d0742174a6622e45e4b3a420b8bbdcbab26533d373b7adb674\nreviewed_amendment: https://github.com/whatrune/sd-prompt-studio/issues/251#issuecomment-5203226004\nreviewed_amendment_body_sha256: 6b5a2b8e5066532bf62930ce83a38daa4bedfc5490afcd9416d14b245f0f6d79\nsource_review: https://github.com/whatrune/sd-prompt-studio/issues/251#issuecomment-5203080532\nsource_review_body_sha256: 2cbb57fe3d0ffd42a1c3b6094390d76006ef649f6dc4851cfd9ca7baf775184a\nreviewed_head: 164a6ec65155d7498f111ef66721acb16e22a189\nreviewed_base: 413cd0ba0d858e1497bbc5e6ea8a88231fb55c67\nrunner_path: scripts/run-protected-transition-admission-v1.mjs\nrunner_blob: c7bb984cc6b1dc4d78e7948818a4bb9c97b8da17\ndecision: APPROVE\nblocking_finding_count: 0\nunknown_count: 0\nclosed_finding_ids:\n  - B-251-FINALIZATION-BINDING-RESOLUTION-002\n  - B-251-ASSIGNMENT-PREDECESSOR-DIGEST-003\nimplementation_ready: true\nimplementation_allowed: false\nassignment_revision_2_allowed: false\nready_generation_revision_4_allowed: false\ncollector_allowed: false\nworkflow_dispatch_allowed: false\nterminal_review_allowed: false\nmerge_decision_allowed: false\nmerge_allowed: false\nstatus: completed\nexecution_stop_reason: architecture_review_approved_without_implementation_authority\n```\n\n## Independent evidence\n\nFresh direct refetch verified the reviewed Amendment and Dispatch at the exact body digests above. The exact implementation HEAD exists and the runner blob is `c7bb984cc6b1dc4d78e7948818a4bb9c97b8da17`.\n\nThe five retroactive targets were independently direct-refetched. Their current full-body SHA-256, in-record JCS digest, direct API author `whatrune`, record type/revision, and Ready-event binding exactly match the frozen table:\n\n- revision-1 Producer Roster: `c4417de50a29f08461a7bf7964b1afa2e1a25631c8a68a0fb64b34bb9e53947b` / `dbd7689ef71669d4deb9c589e104cd9ccbf382dd50740b78d8203b8a99c55125`;\n- Ready Generation revision 1: `7aae7e2735ec6e1a1d6db65b14b501fe905d59b43da705e95231b25affb9d475` / `df86b68a470f2763f2793bfbee5f63e2b877aa3e5fefc031824f042ead34de4c`;\n- Terminal Review assignment revision 1: `6055cfc70790f1d8b8cabdb3663ea2a56baae7656d9c8a1d3a5f289f0c25724d` / `074a60efa79b036202a61965160202c125229ab8a01c5c6acabe1cce0e3c21db`;\n- revision-3 Producer Roster: `97669b895b81e5da59c31cfd3a7b29dc8e0b7098f71ab3b86bdbd2982bb4c121` / `661301f12c1aa00dfdad28784cb5990eec5a7807727c69339b5bc62d39d49c28`;\n- Ready Generation revision 3: `c79d3d2d4e74067b6062f829720109f62ea3faf57481d70e0ac286d28211442f` / `b970c2e71a1ca9d61ae76ce1c62569a121d8e76705e83d3b6eae06d3fb569add`.\n\nReady REST events `29044304312` and `29059119053` each resolve exactly once with the frozen timestamp and actor. Task body SHA-256 remains `2c0452ca98f1837f66a9d1216d77bad3e58cda4ab15bcc467ebd0497e6d8d347`.\n\n## Ten-point review\n\n1. **20-field schema/JCS: PASS.** The non-self-binding record has exactly 20 typed fields, no self-comment URL, deterministic selector-derived `binding_id`, and a non-circular `binding_record_digest` over RFC 8785 JCS with that digest field omitted. Nullability and target-type constraints are explicit.\n2. **One-shot publication and issuer root: PASS.** Complete canonical JCS is posted once, then direct-refetched. `created_at == updated_at` applies only to this non-self-binding record. Root URL/body digest, APPROVE review, direct API author, target-type role mapping, and cross-role rejection are pinned independently.\n3. **Lookup/cardinality/failure union: PASS.** The Task Issue is the sole search root; every page is acquired to termination; every strict claim is parsed and directly refetched; zero, one, and two-or-more outcomes and malformed evidence have deterministic rejected/failed boundaries. Chronology cannot select a winner.\n4. **Target integrity and drift: PASS.** Current full-body SHA and in-record digest must both match the unique Binding. Complete pre-Collector and post-Collector pagination/refetch closes target edits, Binding duplication, and exact-HEAD drift before evaluator acceptance or persistence.\n5. **Assignment lineage: PASS.** Every historical predecessor and current leaf resolves its own unique Binding. Historical records are checked against their issuance-era Generation/event; only the unique current leaf is checked against the current tuple. The 23-field assignment schema remains unchanged.\n6. **Retroactive boundary: PASS.** Eligibility is limited to the exact five verified URLs/body hashes/record digests/authors/events. It establishes present bytes only, does not backdate authority or revive prior protected-action evidence, and requires zero existing Binding claims.\n7. **Producer Roster and Collector: PASS.** Generation-selected Roster URL/digest is verified before and after the existing single Collector invocation and against its output. No second Collector is introduced.\n8. **Record-type scope: PASS.** Relaxation applies only to the four named self-binding record types. Non-self-binding Architecture, Review, trust-root, artifact, receipt, and other records retain their existing immutability rules.\n9. **Repository feasibility: PASS.** The current runner already provides strict body parsing, JCS hashing, direct record acquisition, complete pagination, generation-aware assignment traversal, accepted/rejected/failed persistence, and exactly one Collector call. The repair fits the existing five-file allowlist, six workflow inputs, one host/entrypoint, and read-only permissions without receipt, assignment, Collector artifact, or workflow-input schema expansion.\n10. **Finding closure: PASS.** The unique persistent Binding supplies the canonical finalization digest resolution missing from `B-251-FINALIZATION-BINDING-RESOLUTION-002` and supplies every historical assignment predecessor's independently discoverable finalized body/digest required by `B-251-ASSIGNMENT-PREDECESSOR-DIGEST-003`.\n\n## Decision boundary\n\nArchitecture is implementation-ready, but this Review grants no implementation or protected-action authority. Repository changes, assignment revision 2, Ready Generation revision 4, Collector execution, workflow dispatch, Terminal Review, GitHub Approve, Merge Decision, and Merge remain prohibited until separately dispatched."
}
)

const SYNTHETIC_TASK_BODY = "# Protected Transition Admission V1 Phase 1 — First Mandatory Consumer\n\n```yaml\ntask_id: PTA-V1-PHASE-1-FIRST-MANDATORY-CONSUMER-001\nrecord_type: implementation_task_assignment\nauthoring_role: Integrated Lead\nparent_issue: https://github.com/whatrune/sd-prompt-studio/issues/251\narchitecture_amendment: https://github.com/whatrune/sd-prompt-studio/issues/251#issuecomment-5192482799\narchitecture_review: https://github.com/whatrune/sd-prompt-studio/issues/251#issuecomment-5192544858\narchitecture_decision: APPROVE\narchitecture_blocking_finding_count: 0\narchitecture_unknown_count: 0\nexact_base: 413cd0ba0d858e1497bbc5e6ea8a88231fb55c67\nbase_branch: main\nbranch: codex/protected-transition-admission-v1-phase-1\nworktree: .worktrees/protected-transition-admission-v1-phase-1\nbootstrap: scripts/create-task-worktree.ps1\nassigned_role: Backend Implementer\nfirst_mandatory_consumer: true\nimplementation_ready: true\nimplementation_allowed: true\ncommit_allowed: false\npush_allowed: false\npr_allowed: false\nready_allowed: false\nworkflow_dispatch_allowed: false\nmerge_allowed: false\nissue_248_operation_allowed: false\npr_249_operation_allowed: false\n```\n\n## Purpose\n\nImplement only the APPROVE-reviewed Protected Transition Admission V1 Phase 1 host slice. This Task itself is the first mandatory consumer frozen by the Architecture Amendment:\n\n1. its future canonical Terminal Review requires an accepted Terminal Review Admission receipt;\n2. its later Product Owner Merge Decision requires a distinct accepted Merge Decision Admission receipt obtained from separately acquired sealed Collector evidence after Terminal Review; and\n3. neither transition may use point-in-time GitHub refetch, stdout prose, copied JSON, a prior artifact, or an expired/invalidated receipt as a substitute.\n\nThis Assignment authorizes implementation and synthetic Validation only. It does not authorize workflow dispatch, Ready, Terminal Review publication, Merge Decision publication, or Merge.\n\n## Exact host, entrypoint, composition, and symbols\n\n- Production host: exactly the existing `.github/workflows/protected-transition-admission-v1.yml`.\n- Public production entrypoint: exactly default-branch `workflow_dispatch`.\n- Internal composition command: exactly `scripts/run-protected-transition-admission-v1.mjs`.\n- Pure evaluator: exactly exported `evaluateProtectedTransitionAdmissionV1` in `src/continuous-orchestration/protected-transition-admission-v1.ts`.\n- Existing Collector CLI reused exactly once after caller/identity admission: `scripts/run-ready-review-terminal-observation-collector-v1.mjs`.\n- Existing Collector/private transport/Core/parser are dependencies, not modification targets:\n  - `OwnerOnlyReadyReviewObservationTransportAdapterV1.collect`;\n  - `evaluateReadyReviewTerminalObservationCoreV1`;\n  - `parseReadyReviewTerminalObservationArtifactV1`.\n- Do not create another workflow, host, entrypoint, Collector, transport, parser, scheduler, daemon, callback, service, or background process.\n\nThe workflow declares only these six caller inputs:\n\n1. `transition`: `terminal_review_admission | merge_decision_admission`;\n2. `pr_number`;\n3. `exact_head`;\n4. `task_record_url`;\n5. `ready_generation_record_url`;\n6. `terminal_review_record_url`, empty for Terminal Review Admission and required for Merge Decision Admission.\n\nRepository, default branch, workflow path/ref/SHA, run ID/attempt, actor, server URL, repository ID, and run URL are host-derived and are not caller-selectable.\n\n## Exact changed-path allowlist\n\nOnly these five paths may change:\n\n```text\n.github/workflows/protected-transition-admission-v1.yml\nscripts/run-protected-transition-admission-v1.mjs\nsrc/continuous-orchestration/protected-transition-admission-v1.ts\nscripts/test-protected-transition-admission-v1.mjs\nscripts/fixtures/protected-transition-admission-v1.json\n```\n\nNo package/lockfile, existing Collector/Core/parser/CLI/test/fixture, Team Contract, barrel, UI source, other workflow, repository setting, or other path may change. Any need for a sixth path is an Architecture stop.\n\n## Frozen admission Contract\n\nThe only protected-transition surfaces are:\n\n- Terminal Review Admission, caller/physical operator: assigned Independent PR Reviewer;\n- Merge Decision Admission, caller/physical operator: Product Owner.\n\nReady is observation input only. The host never marks Ready, chooses a Review Decision, publishes a Merge Decision, selects a Merge method, or invokes Merge.\n\nThe exact result semantics are cumulative current authority:\n\n- `accepted`: exactly one accepted receipt and one persisted accepted artifact;\n- `rejected`: exactly one rejected diagnostic receipt persisted for audit, never granting admission;\n- `failed`: no admission receipt and no admitted artifact.\n\nZero or multiple receipts never grant admission. Rejection, Validation failure, Collector/parser failure, persistence failure, digest failure, expiry, or invalidation never causes a protected transition. Every result has `state_changed: false`.\n\nEvery accepted or rejected receipt binds contract/result/transition, repository, Task/Issue scope digest, PR, exact HEAD, current Ready Generation and REST Ready event identity/time/actor, assigned actor role, Collector artifact/JCS/digests, terminal decision references, workflow path/ref/SHA/run/attempt, `evaluated_at`, `expires_at`, admission digest, and rejection codes.\n\nFor Merge Decision Admission:\n\n- the canonical Terminal Review record and its accepted Terminal Review Admission receipt must bind the same Task, PR, Ready Generation, and exact HEAD;\n- a distinct sealed Collector artifact must be acquired after Terminal Review;\n- the later receipt must link the Terminal Review accepted-receipt digest;\n- reuse of the Terminal artifact or any earlier/stale artifact fails closed.\n\n## Persistence, expiry, and invalidation\n\nGitHub Actions artifact service is the persistence owner.\n\nAn accepted run persists exactly:\n\n```text\nready-review-terminal-observation-artifact-v1.jcs\nprotected-transition-admission-v1-receipt.jcs\n```\n\nThe downstream Result Handoff binds workflow run URL, artifact ID/direct URL, archive SHA-256, each file SHA-256, admission digest, workflow SHA, exact HEAD, and expiration.\n\nAccepted and rejected receipts expire 30 minutes after evaluation. HEAD, Ready Generation, actor, role, review decision, thread snapshot, default-branch main, workflow SHA, protected-event order, artifact accessibility, archive/file digest, or expiry change invalidates admission and requires fresh evidence.\n\nThe host has no mutation or Merge capability. Use minimum read permissions plus only the Actions runtime capability required for its own artifact persistence. External Actions, if any are frozen by the Architecture, must be pinned to full commit SHA.\n\n## Focused synthetic Validation\n\nRequired coverage:\n\n- Terminal Review accepted with exact current bindings;\n- Merge Decision accepted only with the distinct later artifact and admitted Terminal receipt;\n- rejected and failed shapes;\n- zero/multiple receipts;\n- wrong actor/role/repository/ref/workflow SHA/Task/scope/PR/HEAD/Ready event;\n- missing/extra/malformed fields;\n- Terminal Review URL in the wrong transition;\n- artifact reuse, non-later/stale/expired evidence;\n- Collector/parser/digest/persistence rejection;\n- no duplicate Collector/transport/parser/host/entrypoint;\n- no protected transition and no state change on every non-admitting result;\n- exact five-path changed/staged allowlist.\n\nRun and record exact exits for:\n\n- `node scripts/test-protected-transition-admission-v1.mjs`;\n- `node scripts/test-ready-review-terminal-observation-collector-v1.mjs`;\n- `node scripts/test-role-execution-contracts.mjs`;\n- `pnpm test`;\n- `pnpm build`;\n- `git diff --check`;\n- exact-base, branch, worktree, changed-path, and staged-path checks.\n\nDo not dispatch the workflow or perform live protected-transition admission during implementation Validation.\n\n## Result Handoff and stop\n\nAfter implementation and Validation, post one top-level Backend Implementer Result Handoff on this Issue with status, execution stop reason, exact base and execution HEAD, branch/worktree/bootstrap route, exact changed/staged paths, implementation summary, every command/result/exit, accepted/rejected/failed and no-bypass evidence, findings, UNKNOWN, and explicit unperformed actions.\n\nStop with changes uncommitted and unstaged unless a later separate Commit-only Dispatch grants authority.\n\n## Forbidden\n\n- changes outside the five-path allowlist;\n- modification or duplication of the existing Collector/Core/parser/CLI/test/fixture;\n- PR #249 or Issue #248 operation;\n- main modification;\n- workflow dispatch or live admission;\n- branch/ref deletion;\n- Ready, Review Decision publication, Merge Decision publication, GitHub Approve, Merge, or Issue close;\n- Commit, Push, or PR without later separate authority.\n"

const fixture = JSON.parse(await readFile('scripts/fixtures/protected-transition-admission-v1.json', 'utf8'))
const workflowSource = await readFile('.github/workflows/protected-transition-admission-v1.yml', 'utf8')
const runnerSource = await readFile('scripts/run-protected-transition-admission-v1.mjs', 'utf8')
const evaluatorSource = await readFile('src/continuous-orchestration/protected-transition-admission-v1.ts', 'utf8')
const workflow = parseYaml(workflowSource)
const clone = structuredClone
let assertions = 0
const check = (condition, message) => { assertions += 1; assert.ok(condition, message) }
const frozen = (value) => value === null || typeof value !== 'object' || (Object.isFrozen(value) && Object.values(value).every(frozen))
const crc32 = (bytes) => {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return (crc ^ 0xffffffff) >>> 0
}
const buildStoredZip = (entries) => {
  const locals = []
  const centrals = []
  let offset = 0
  for (const [name, value] of Object.entries(entries)) {
    const nameBytes = Buffer.from(name, 'utf8')
    const data = Buffer.isBuffer(value) ? value : Buffer.from(value, 'utf8')
    const checksum = crc32(data)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt32LE(checksum, 14)
    local.writeUInt32LE(data.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(nameBytes.length, 26)
    locals.push(local, nameBytes, data)
    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt32LE(checksum, 16)
    central.writeUInt32LE(data.length, 20)
    central.writeUInt32LE(data.length, 24)
    central.writeUInt16LE(nameBytes.length, 28)
    central.writeUInt32LE(offset, 42)
    centrals.push(central, nameBytes)
    offset += local.length + nameBytes.length + data.length
  }
  const centralBytes = Buffer.concat(centrals)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(Object.keys(entries).length, 8)
  end.writeUInt16LE(Object.keys(entries).length, 10)
  end.writeUInt32LE(centralBytes.length, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, centralBytes, end])
}
const readStoredZipEntries = (archive) => {
  const endOffset = archive.length - 22
  assert.equal(archive.readUInt32LE(endOffset), 0x06054b50)
  const entryCount = archive.readUInt16LE(endOffset + 10)
  let cursor = archive.readUInt32LE(endOffset + 16)
  const entries = new Map()
  for (let index = 0; index < entryCount; index += 1) {
    assert.equal(archive.readUInt32LE(cursor), 0x02014b50)
    assert.equal(archive.readUInt16LE(cursor + 10), 0)
    const size = archive.readUInt32LE(cursor + 20)
    const nameLength = archive.readUInt16LE(cursor + 28)
    const extraLength = archive.readUInt16LE(cursor + 30)
    const commentLength = archive.readUInt16LE(cursor + 32)
    const localOffset = archive.readUInt32LE(cursor + 42)
    const name = archive.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8')
    assert.equal(archive.readUInt32LE(localOffset), 0x04034b50)
    const localNameLength = archive.readUInt16LE(localOffset + 26)
    const localExtraLength = archive.readUInt16LE(localOffset + 28)
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength
    const data = archive.subarray(dataOffset, dataOffset + size)
    assert.equal(crc32(data), archive.readUInt32LE(cursor + 16))
    entries.set(name, Buffer.from(data))
    cursor += 46 + nameLength + extraLength + commentLength
  }
  return entries
}
const resealTerminal = async (value) => {
  const projection = Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'record_digest'))
  return { ...projection, record_digest: await digestReadyReviewObservationProjectionV1(projection) }
}

const resealRecord = async (value) => {
  const projection = Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'record_digest'))
  return { ...projection, record_digest: await digestReadyReviewObservationProjectionV1(projection) }
}

const assignmentLineageHarness = async (transition) => {
  const terminal = transition === 'terminal_review_admission'
  const recordType = terminal ? 'terminal_review_actor_assignment_v1' : 'merge_decision_actor_assignment_v1'
  const ownerRole = terminal ? 'Integrated Lead' : 'Product Owner'
  const assignedRole = terminal ? 'Independent PR Reviewer' : 'Product Owner'
  const assignmentId = terminal ? 'PTA-259-TERMINAL-REVIEW-ACTOR' : 'PTA-259-MERGE-DECISION-ACTOR'
  const oldHead = '0'.repeat(40)
  const oldReadyUrl = `https://github.com/whatrune/sd-prompt-studio/issues/259#issuecomment-${terminal ? '6000000101' : '6000000201'}`
  const currentReadyUrl = `https://github.com/whatrune/sd-prompt-studio/issues/259#issuecomment-${terminal ? '6000000102' : '6000000202'}`
  const oldAssignmentUrl = `https://github.com/whatrune/sd-prompt-studio/issues/259#issuecomment-${terminal ? '6000000111' : '6000000211'}`
  const currentAssignmentUrl = `https://github.com/whatrune/sd-prompt-studio/issues/259#issuecomment-${terminal ? '6000000112' : '6000000212'}`
  const oldReadyRecord = await resealRecord({
    record_type: 'ready_review_generation_record_v1', canonical_record: oldReadyUrl, repository: fixture.repository,
    pr_number: fixture.pr_number, pr_url: fixture.pr_url, exact_head: oldHead, ready_event_id: terminal ? '29000001001' : '29000002001',
    ready_occurred_at: '2026-08-05T09:00:00Z', task_issue_url: fixture.task_record_url, revision: 1, prior_record_url: null,
    producer_roster_source_url: 'https://github.com/whatrune/sd-prompt-studio/issues/259#issuecomment-6000000301',
    producer_roster_source_digest: '3'.repeat(64),
  })
  const currentReadyRecord = await resealRecord({
    record_type: 'ready_review_generation_record_v1', canonical_record: currentReadyUrl, repository: fixture.repository,
    pr_number: fixture.pr_number, pr_url: fixture.pr_url, exact_head: fixture.exact_head, ready_event_id: terminal ? '29000001002' : '29000002002',
    ready_occurred_at: '2026-08-05T10:00:00Z', task_issue_url: fixture.task_record_url, revision: 2, prior_record_url: oldReadyUrl,
    producer_roster_source_url: 'https://github.com/whatrune/sd-prompt-studio/issues/259#issuecomment-6000000302',
    producer_roster_source_digest: '4'.repeat(64),
  })
  const makeAssignment = async ({ url, revision, supersedes, head, ready, issuedAt }) => await resealRecord({
    record_type: recordType, canonical_record: url, assignment_id: assignmentId, revision, supersedes_record_url: supersedes,
    status: 'assigned', authority_owner_role: ownerRole, authority_owner_login: 'whatrune', repository: fixture.repository,
    task_record_url: fixture.task_record_url, task_scope_digest: fixture.task_scope_digest, pr_number: fixture.pr_number, pr_url: fixture.pr_url,
    exact_head: head, ready_generation_record_url: ready.canonical_record, ready_generation_record_digest: ready.record_digest,
    ready_event_id: ready.ready_event_id, ready_occurred_at: ready.ready_occurred_at, transition, assigned_login: fixture.actor_login,
    assigned_role: assignedRole, issued_at: issuedAt,
  })
  const oldIssuedAt = '2026-08-05T09:01:00Z'
  const currentIssuedAt = '2026-08-05T10:01:00Z'
  const oldAssignment = await makeAssignment({ url: oldAssignmentUrl, revision: 1, supersedes: null, head: oldHead, ready: oldReadyRecord, issuedAt: oldIssuedAt })
  const currentAssignment = await makeAssignment({ url: currentAssignmentUrl, revision: 2, supersedes: oldAssignmentUrl, head: fixture.exact_head, ready: currentReadyRecord, issuedAt: currentIssuedAt })
  const evidence = (sourceUrl, sourceCreatedAt, record, generationRecord, commitId) => ({
    source: { url: sourceUrl, bodyDigest: createHash('sha256').update(`body:${sourceUrl}`).digest('hex'), authorLogin: 'whatrune', createdAt: sourceCreatedAt, updatedAt: sourceCreatedAt },
    record,
    generationSource: { url: generationRecord.canonical_record, record: generationRecord, createdAt: generationRecord.ready_occurred_at, updatedAt: generationRecord.ready_occurred_at },
    generationEvent: { event_id: String(generationRecord.ready_event_id), occurred_at: generationRecord.ready_occurred_at, commit_id: commitId, actor_login: 'whatrune' },
    assignmentBinding: { target_url: sourceUrl },
    generationBinding: { target_url: generationRecord.canonical_record },
  })
  const records = [
    evidence(oldAssignmentUrl, oldIssuedAt, oldAssignment, oldReadyRecord, oldHead),
    evidence(currentAssignmentUrl, currentIssuedAt, currentAssignment, currentReadyRecord, null),
  ]
  return {
    records,
    request: { transition, prNumber: fixture.pr_number, exactHead: fixture.exact_head, taskRecordUrl: fixture.task_record_url, readyRecordUrl: currentReadyUrl },
    host: { repository: fixture.repository },
    taskScopeDigest: fixture.task_scope_digest,
    readySource: { url: currentReadyUrl, record: currentReadyRecord },
    readyEvent: records[1].generationEvent,
    trustRoot: { issuer_login: 'whatrune', issuer_role: ownerRole },
    spec: { recordType, transition, assignedRole },
  }
}

const resealAssignmentEvidence = async (evidence) => {
  evidence.record = await resealRecord(evidence.record)
  evidence.source.bodyDigest = createHash('sha256').update(`body:${evidence.source.url}`).digest('hex')
}

const buildCollector = async (timing) => {
  const producerId = 'chatgpt-codex-connector[bot]'
  const sourceObservedAt = timing.snapshot_observed_at
  const sourceProjection = {
    projection_version: 'submitted-review-source-projection-v1',
    kind: 'submitted_review',
    producer_id: producerId,
    review_id: timing.receipt_id,
    review_url: `${fixture.pr_url}#pullrequestreview-${timing.receipt_id}`,
    submitted_at: timing.receipt_created_at,
    reviewed_head: fixture.exact_head,
    ready_event_id: fixture.ready_generation.event_id,
    review_state: 'COMMENTED',
    finding_ids: [],
    source_observed_at: sourceObservedAt,
  }
  const receipt = {
    observation_version: 'producer-terminal-receipt-observation-v1',
    producer_id: producerId,
    receipt_id: timing.receipt_id,
    receipt_source_url: sourceProjection.review_url,
    receipt_kind: 'submitted_review',
    receipt_created_at: timing.receipt_created_at,
    reviewed_head: fixture.exact_head,
    ready_event_id: fixture.ready_generation.event_id,
    source_projection: sourceProjection,
    source_projection_digest: await digestReadyReviewObservationProjectionV1(sourceProjection),
    source_observed_at: sourceObservedAt,
  }
  const pageProjection = {
    page_ordinal: 0,
    start_cursor: null,
    end_cursor: null,
    has_next_page: false,
    nodes: [{
      thread_id: `PRRT_${timing.receipt_id}`,
      is_resolved: true,
      is_outdated: false,
      path: 'src/example.ts',
      line: 1,
      start_line: 1,
      last_comment_id: `PRRC_${timing.receipt_id}`,
      last_comment_created_at: timing.receipt_created_at,
    }],
    source_url: 'https://api.github.com/graphql#PullRequest.reviewThreads-page-0',
    source_observed_at: timing.snapshot_observed_at,
  }
  const page = { ...pageProjection, page_digest: await digestReadyReviewObservationProjectionV1(pageProjection) }
  const receiptIds = [timing.receipt_id]
  const receiptDigest = await digestReadyReviewObservationProjectionV1(receiptIds)
  const postSnapshotHeadRecheck = {
    observation_version: 'post-snapshot-head-recheck-v1',
    repository: fixture.repository,
    pr_number: fixture.pr_number,
    pr_url: fixture.pr_url,
    ready_generation_record_url: fixture.ready_generation.record_url,
    ready_event_id: fixture.ready_generation.event_id,
    expected_head: fixture.exact_head,
    observed_head: fixture.exact_head,
    snapshot_observed_at: timing.snapshot_observed_at,
    observed_at: timing.post_snapshot_observed_at,
    source_url: fixture.pr_url,
  }
  const snapshotProjection = {
    snapshot_version: 'post-terminal-thread-snapshot-v1',
    query_identity: { connection: 'PullRequest.reviewThreads', query_sha256: 'c'.repeat(64) },
    variables_identity: { repository: fixture.repository, pr_number: fixture.pr_number, exact_head: fixture.exact_head, variables_sha256: 'd'.repeat(64) },
    pages: [page],
    terminal_receipt_ids: receiptIds,
    terminal_receipts_digest: receiptDigest,
    last_terminal_receipt_at: timing.receipt_created_at,
    observed_at: timing.snapshot_observed_at,
    source_observation_urls: [page.source_url],
    post_snapshot_head_recheck: postSnapshotHeadRecheck,
  }
  const threadSnapshot = { ...snapshotProjection, snapshot_digest: await digestReadyReviewObservationProjectionV1(snapshotProjection) }
  const artifact = await buildReadyReviewTerminalObservationArtifactV1({
    artifact_version: READY_REVIEW_TERMINAL_OBSERVATION_ARTIFACT_V1,
    repository: fixture.repository,
    pr_number: fixture.pr_number,
    pr_url: fixture.pr_url,
    exact_head: fixture.exact_head,
    ready_generation_record_url: fixture.ready_generation.record_url,
    ready_event_id: fixture.ready_generation.event_id,
    ready_occurred_at: fixture.ready_generation.occurred_at,
    producer_roster: [producerId],
    producer_roster_source_digest: 'e'.repeat(64),
    producer_receipts: [receipt],
    terminal_receipt_ids: receiptIds,
    terminal_receipts_digest: receiptDigest,
    last_terminal_receipt_at: timing.receipt_created_at,
    thread_snapshot: threadSnapshot,
  })
  assert.ok(artifact)
  const jcs = canonicalizeReadyReviewObservationJcsV1(artifact)
  return { artifact, jcs, sha256: await sha256ReadyReviewObservationV1(jcs) }
}

const terminalCollector = await buildCollector(fixture.terminal_artifact)
const mergeCollector = await buildCollector(fixture.merge_artifact)

const baseInput = (transition, collector) => ({
  input_version: PROTECTED_TRANSITION_ADMISSION_INPUT_V1,
  transition,
  repository: fixture.repository,
  repository_id: fixture.repository_id,
  task_record_url: fixture.task_record_url,
  task_scope_digest: fixture.task_scope_digest,
  pr_number: fixture.pr_number,
  pr_url: fixture.pr_url,
  exact_head: fixture.exact_head,
  ready_generation: clone(fixture.ready_generation),
  actor: { login: fixture.actor_login },
  authority: {
    trust_root: {
      ...clone(fixture.trust_root),
      issuer_anchor_url: (transition === 'terminal_review_admission' ? fixture.terminal_authority : fixture.merge_authority).issuer_anchor_url,
      issuer_anchor_digest: (transition === 'terminal_review_admission' ? fixture.terminal_authority : fixture.merge_authority).issuer_anchor_digest,
      issuer_login: (transition === 'terminal_review_admission' ? fixture.terminal_authority : fixture.merge_authority).issuer_login,
      issuer_role: (transition === 'terminal_review_admission' ? fixture.terminal_authority : fixture.merge_authority).issuer_role,
      anchor_review_url: (transition === 'terminal_review_admission' ? fixture.terminal_authority : fixture.merge_authority).anchor_review_url,
      anchor_review_digest: (transition === 'terminal_review_admission' ? fixture.terminal_authority : fixture.merge_authority).anchor_review_digest,
    },
    assignment: {
      record_url: (transition === 'terminal_review_admission' ? fixture.terminal_authority : fixture.merge_authority).assignment_record_url,
      record_digest: (transition === 'terminal_review_admission' ? fixture.terminal_authority : fixture.merge_authority).assignment_record_digest,
      assignment_id: (transition === 'terminal_review_admission' ? fixture.terminal_authority : fixture.merge_authority).assignment_id,
      revision: (transition === 'terminal_review_admission' ? fixture.terminal_authority : fixture.merge_authority).assignment_revision,
      issuer_login: (transition === 'terminal_review_admission' ? fixture.terminal_authority : fixture.merge_authority).issuer_login,
      issuer_role: (transition === 'terminal_review_admission' ? fixture.terminal_authority : fixture.merge_authority).issuer_role,
      assigned_login: fixture.actor_login,
      assigned_role: (transition === 'terminal_review_admission' ? fixture.terminal_authority : fixture.merge_authority).assigned_role,
      transition,
    },
  },
  collector_artifact_jcs: collector.jcs,
  collector_artifact_jcs_sha256: collector.sha256,
  terminal_review: null,
  workflow_identity: { ...clone(fixture.workflow), actor: fixture.actor_login },
  current_state: {
    repository: fixture.repository,
    pr_number: fixture.pr_number,
    exact_head: fixture.exact_head,
    task_scope_digest: fixture.task_scope_digest,
    ready_generation_record_url: fixture.ready_generation.record_url,
    ready_event_id: fixture.ready_generation.event_id,
    ready_occurred_at: fixture.ready_generation.occurred_at,
    ready_actor_login: fixture.ready_generation.actor_login,
    actor_login: fixture.actor_login,
    actor_role: transition === 'terminal_review_admission' ? 'Independent PR Reviewer' : 'Product Owner',
    assignment_record_url: (transition === 'terminal_review_admission' ? fixture.terminal_authority : fixture.merge_authority).assignment_record_url,
    assignment_record_digest: (transition === 'terminal_review_admission' ? fixture.terminal_authority : fixture.merge_authority).assignment_record_digest,
    trust_root_record_url: fixture.trust_root.record_url,
    trust_root_record_digest: fixture.trust_root.record_digest,
    default_branch: 'main',
    workflow_sha: fixture.workflow.sha,
    thread_snapshot_digest: collector.artifact.thread_snapshot.snapshot_digest,
    terminal_review_decision: null,
    latest_protected_event_at: fixture.ready_generation.occurred_at,
  },
  persistence: { owner: 'github_actions_artifact_service', available: true },
  evaluated_at: transition === 'terminal_review_admission' ? fixture.terminal_evaluated_at : fixture.merge_evaluated_at,
})

check(fixture.contract_version === 'protected-transition-admission-validation-v1', 'fixture contract version')
const syntheticArtifactZip = Buffer.from('UEsDBBQAAAAIAMRyBl1Dv6ajBwAAAAIAAAAxAAAAcmVhZHktcmV2aWV3LXRlcm1pbmFsLW9ic2VydmF0aW9uLWFydGlmYWN0LXYxLmpjcwECAP3/e31QSwMEFAAAAAgAxHIGXUO/pqMHAAAAAgAAAC0AAABwcm90ZWN0ZWQtdHJhbnNpdGlvbi1hZG1pc3Npb24tdjEtcmVjZWlwdC5qY3MBAgD9/3t9UEsBAhQAFAAAAAgAxHIGXUO/pqMHAAAAAgAAADEAAAAAAAAAAAAAAAAAAAAAAHJlYWR5LXJldmlldy10ZXJtaW5hbC1vYnNlcnZhdGlvbi1hcnRpZmFjdC12MS5qY3NQSwECFAAUAAAACADEcgZdQ7+mowcAAAACAAAALQAAAAAAAAAAAAAAAABWAAAAcHJvdGVjdGVkLXRyYW5zaXRpb24tYWRtaXNzaW9uLXYxLXJlY2VpcHQuamNzUEsFBgAAAAACAAIAugAAAKgAAAAAAA==', 'base64')
const acquiredSyntheticArtifactZip = admitArtifactZipExecResultV1({ stdout: syntheticArtifactZip, stderr: Buffer.alloc(0) })
check(Buffer.isBuffer(acquiredSyntheticArtifactZip) && acquiredSyntheticArtifactZip.equals(syntheticArtifactZip) &&
  acquiredSyntheticArtifactZip.subarray(0, 4).toString('hex') === '504b0304', 'actual synthetic artifact ZIP bytes survive the production binary acquisition boundary exactly')
check(createHash('sha256').update(acquiredSyntheticArtifactZip).digest('hex') === createHash('sha256').update(syntheticArtifactZip).digest('hex'), 'artifact ZIP provenance SHA-256 is over the exact acquired binary bytes')
let stringDecodedArtifactRejected = false
try {
  admitArtifactZipExecResultV1({ stdout: syntheticArtifactZip.toString('utf8'), stderr: '' })
} catch (error) {
  stringDecodedArtifactRejected = /binary GitHub API response malformed/.test(String(error?.message))
}
check(stringDecodedArtifactRejected, 'string-decoded artifact output is rejected before provenance hashing')
let stringDecodedArtifactStderrRejected = false
try {
  admitArtifactZipExecResultV1({ stdout: syntheticArtifactZip, stderr: '' })
} catch (error) {
  stringDecodedArtifactStderrRejected = /binary GitHub API response malformed/.test(String(error?.message))
}
check(stringDecodedArtifactStderrRejected, 'string-decoded artifact stderr is rejected even when empty')
check(classifyTerminalLeafAuthorBindingV1({ directApiAuthorLogin: fixture.actor_login, declaredApiAuthorLogin: fixture.actor_login, recordActorLogin: fixture.actor_login, assignedLogin: fixture.actor_login }) === 'accepted', 'Terminal leaf author binding admits one assigned reviewer across all four identities')
check(classifyTerminalLeafAuthorBindingV1({ directApiAuthorLogin: '', declaredApiAuthorLogin: fixture.actor_login, recordActorLogin: fixture.actor_login, assignedLogin: fixture.actor_login }) === 'failed', 'missing direct Terminal API author evidence fails closed')
check(classifyTerminalLeafAuthorBindingV1({ directApiAuthorLogin: 'api-author', declaredApiAuthorLogin: 'declared-author', recordActorLogin: fixture.actor_login, assignedLogin: fixture.actor_login }) === 'failed', 'Terminal API and declared author integrity mismatch fails closed')
check(classifyTerminalLeafAuthorBindingV1({ directApiAuthorLogin: 'other-reviewer', declaredApiAuthorLogin: 'other-reviewer', recordActorLogin: 'other-reviewer', assignedLogin: fixture.actor_login }) === 'rejected', 'trustworthy APPROVE leaf authored by a non-assigned reviewer is rejected')
const terminalInput = baseInput('terminal_review_admission', terminalCollector)
const terminalAccepted = await evaluateProtectedTransitionAdmissionV1(terminalInput)
check(terminalAccepted.result === 'accepted', 'Terminal Review Admission accepts exact current bindings')
const nullableReadyCommitInput = clone(terminalInput)
nullableReadyCommitInput.ready_generation.commit_id = null
const nullableReadyCommitAccepted = await evaluateProtectedTransitionAdmissionV1(nullableReadyCommitInput)
check(nullableReadyCommitAccepted.result === 'accepted' && nullableReadyCommitAccepted.receipt.ready_event_commit_id === null,
  'nullable REST Ready commit identity is preserved while exact HEAD remains independently bound')
check(terminalAccepted.result === 'accepted' && terminalAccepted.receipt_count === 1 && terminalAccepted.admitted_artifact_count === 1, 'accepted result has exactly one receipt and one admitted Collector artifact')
check(terminalAccepted.result === 'accepted' && terminalAccepted.files_to_persist.map((file) => file.file_name).join(',') === `${PROTECTED_TRANSITION_COLLECTOR_FILE_V1},${PROTECTED_TRANSITION_RECEIPT_FILE_V1}`, 'accepted result persists the two frozen file names')
check(terminalAccepted.result === 'accepted' && Date.parse(terminalAccepted.receipt.expires_at) - Date.parse(terminalAccepted.receipt.evaluated_at) === 30 * 60 * 1000, 'accepted receipt expires exactly 30 minutes after evaluation')
check(terminalAccepted.result === 'accepted' && terminalAccepted.receipt.actor_login === fixture.actor_login && terminalAccepted.receipt.actor_role === 'Independent PR Reviewer', 'Terminal receipt binds actor and assigned role')
check(terminalAccepted.result === 'accepted' && terminalAccepted.receipt.exact_head === fixture.exact_head && terminalAccepted.receipt.ready_generation_record_url === fixture.ready_generation.record_url, 'Terminal receipt binds exact HEAD and Ready Generation')
check(terminalAccepted.result === 'accepted' && terminalAccepted.receipt.ready_event_endpoint === fixture.ready_generation.endpoint && terminalAccepted.receipt.ready_event_commit_id === fixture.exact_head && terminalAccepted.receipt.ready_actor_login === fixture.ready_generation.actor_login, 'Terminal receipt binds the exact REST Ready event identity and actor')
check(terminalAccepted.result === 'accepted' && terminalAccepted.receipt.assignment_record_url === fixture.terminal_authority.assignment_record_url && terminalAccepted.receipt.assignment_issuer_role === 'Integrated Lead', 'Terminal receipt binds the independently issued canonical assignment')
check(terminalAccepted.result === 'accepted' && terminalAccepted.receipt.trust_root_record_url === fixture.trust_root.record_url && terminalAccepted.receipt.trust_root_review_url === fixture.trust_root.review_url, 'Terminal receipt binds the independently reviewed trust root')
check(frozen(terminalAccepted), 'accepted result is recursively immutable')

assert.equal(terminalAccepted.result, 'accepted')
const terminalReceiptJcs = canonicalizeReadyReviewObservationJcsV1(terminalAccepted.receipt)
const terminalReceiptJcsSha = await sha256ReadyReviewObservationV1(terminalReceiptJcs)
const terminalArtifactZipEntries = {
  [PROTECTED_TRANSITION_COLLECTOR_FILE_V1]: terminalCollector.jcs,
  [PROTECTED_TRANSITION_RECEIPT_FILE_V1]: terminalReceiptJcs,
}
const verifyBehavioralArtifactZip = async (archive, overrides = {}) => {
  const acquired = admitArtifactZipExecResultV1({ stdout: archive, stderr: Buffer.alloc(0) })
  const entries = readStoredZipEntries(acquired)
  return await verifyTerminalArtifactZipProvenanceV1({
    archive: acquired,
    apiDigest: `sha256:${createHash('sha256').update(acquired).digest('hex')}`,
    embeddedReceipt: terminalAccepted.receipt,
    leafCollectorDigest: terminalCollector.artifact.artifact_digest,
    listMembers: async () => [...entries.keys()],
    readMember: async (name) => entries.get(name),
    ...overrides,
  })
}
const terminalArtifactZip = buildStoredZip(terminalArtifactZipEntries)
const verifiedTerminalArtifactZip = await verifyBehavioralArtifactZip(terminalArtifactZip)
check(verifiedTerminalArtifactZip.receipt.admission_digest === terminalAccepted.receipt.admission_digest &&
  verifiedTerminalArtifactZip.receiptSha === terminalReceiptJcsSha &&
  verifiedTerminalArtifactZip.collectorArtifact.artifact_digest === terminalCollector.artifact.artifact_digest,
'actual artifact ZIP executes binary acquisition, exact membership, receipt JCS/digest/seal, and Collector parse/digest/provenance successfully')
const behavioralZipFailure = async (operation, expected) => {
  try {
    await operation()
    return false
  } catch (error) {
    return expected.test(String(error?.message))
  }
}
check(await behavioralZipFailure(
  async () => await verifyBehavioralArtifactZip(terminalArtifactZip, { apiDigest: `sha256:${'0'.repeat(64)}` }),
  /archive digest mismatch/,
), 'actual artifact ZIP integrity mismatch fails before member admission')
const extraMemberZip = buildStoredZip({ ...terminalArtifactZipEntries, 'unexpected.txt': 'unexpected' })
check(await behavioralZipFailure(
  async () => await verifyBehavioralArtifactZip(extraMemberZip),
  /archive membership invalid/,
), 'actual artifact ZIP with unexpected membership fails closed')
const unsealedReceipt = { ...terminalAccepted.receipt, admission_digest: '0'.repeat(64) }
const unsealedReceiptZip = buildStoredZip({
  ...terminalArtifactZipEntries,
  [PROTECTED_TRANSITION_RECEIPT_FILE_V1]: canonicalizeReadyReviewObservationJcsV1(unsealedReceipt),
})
check(await behavioralZipFailure(
  async () => await verifyBehavioralArtifactZip(unsealedReceiptZip),
  /receipt canonical JCS or admission digest invalid/,
), 'actual artifact ZIP with an invalid receipt seal fails closed')
const wrongCollectorZip = buildStoredZip({
  ...terminalArtifactZipEntries,
  [PROTECTED_TRANSITION_COLLECTOR_FILE_V1]: mergeCollector.jcs,
})
check(await behavioralZipFailure(
  async () => await verifyBehavioralArtifactZip(wrongCollectorZip),
  /Collector artifact integrity invalid/,
), 'actual artifact ZIP with mismatched Collector provenance fails closed')
const terminalRecord = await resealTerminal({
  record_url: fixture.terminal_review_record_url,
  lineage_id: fixture.terminal_review_lineage_id,
  revision: 1,
  task_record_url: fixture.task_record_url,
  repository: fixture.repository,
  pr_number: fixture.pr_number,
  pr_url: fixture.pr_url,
  exact_head: fixture.exact_head,
  ready_generation_record_url: fixture.ready_generation.record_url,
  ready_event_id: fixture.ready_generation.event_id,
  decision: 'APPROVE',
  actor_login: fixture.actor_login,
  assignment_record_url: fixture.terminal_authority.assignment_record_url,
  assignment_record_digest: fixture.terminal_authority.assignment_record_digest,
  published_at: fixture.terminal_review_published_at,
  collector_artifact_digest: terminalCollector.artifact.artifact_digest,
  workflow_artifact_id: fixture.terminal_workflow_artifact.id,
  workflow_artifact_name: `protected-transition-admission-v1-${terminalAccepted.receipt.workflow_run_id}-${terminalAccepted.receipt.workflow_run_attempt}`,
  workflow_artifact_archive_sha256: fixture.terminal_workflow_artifact.archive_sha256,
  receipt_jcs_sha256: terminalReceiptJcsSha,
  accepted_receipts: [terminalAccepted.receipt],
})
const mergeInput = baseInput('merge_decision_admission', mergeCollector)
mergeInput.terminal_review = terminalRecord
mergeInput.current_state.terminal_review_decision = 'APPROVE'
mergeInput.current_state.latest_protected_event_at = terminalRecord.published_at
const mergeAccepted = await evaluateProtectedTransitionAdmissionV1(mergeInput)
check(mergeAccepted.result === 'accepted', 'Merge Decision Admission accepts distinct post-Terminal Collector evidence')
check(mergeAccepted.result === 'accepted' && mergeAccepted.receipt.terminal_review_accepted_receipt_digest === terminalAccepted.receipt.admission_digest, 'Merge receipt links the Terminal accepted-receipt digest')
check(mergeAccepted.result === 'accepted' && mergeAccepted.receipt.collector_artifact_digest !== terminalAccepted.receipt.collector_artifact_digest, 'Merge receipt binds a distinct Collector artifact')
check(mergeAccepted.result === 'accepted' && mergeAccepted.receipt.actor_role === 'Product Owner', 'Merge receipt binds Product Owner role')
check(mergeAccepted.result === 'accepted' && mergeAccepted.receipt.terminal_review_lineage_id === fixture.terminal_review_lineage_id &&
  mergeAccepted.receipt.terminal_workflow_artifact_id === fixture.terminal_workflow_artifact.id &&
  mergeAccepted.receipt.terminal_receipt_jcs_sha256 === terminalReceiptJcsSha, 'Merge receipt seals the current Terminal leaf and actual artifact-byte provenance')

const nonAdmitting = []
const rejectedCase = async (mutate, expectedCode, label, source = terminalInput) => {
  const input = clone(source)
  await mutate(input)
  const result = await evaluateProtectedTransitionAdmissionV1(input)
  nonAdmitting.push(result)
  check(result.result === 'rejected' && result.rejection_codes.includes(expectedCode), label)
  return result
}
const failedCase = async (mutate, expectedCode, label, source = terminalInput) => {
  const input = clone(source)
  await mutate(input)
  const result = await evaluateProtectedTransitionAdmissionV1(input)
  nonAdmitting.push(result)
  check(result.result === 'failed' && result.failure.code === expectedCode, label)
  return result
}

const actorRejected = await rejectedCase((input) => { input.actor.login = 'wrong-actor'; input.workflow_identity.actor = 'wrong-actor' }, 'actor_mismatch', 'wrong actor is rejected')
check(actorRejected.result === 'rejected' && actorRejected.receipt_count === 1 && actorRejected.admitted_artifact_count === 0 && actorRejected.files_to_persist.length === 1, 'rejected result persists exactly one diagnostic receipt and no admitted artifact')
await rejectedCase((input) => { input.authority.assignment.assigned_role = 'Product Owner'; input.current_state.actor_role = 'Product Owner' }, 'actor_role_mismatch', 'wrong canonical assignment role is rejected')
await rejectedCase((input) => { input.authority.assignment.issuer_login = 'self-issued'; input.authority.assignment.assigned_login = 'self-issued' }, 'actor_mismatch', 'self-authenticating assignment does not authorize the caller')
await rejectedCase((input) => { input.authority.assignment.issuer_login = 'self-issued' }, 'assignment_issuer_mismatch', 'assignment issuer must equal the independently admitted trust-root login')
await rejectedCase((input) => { input.authority.assignment.issuer_role = 'Product Owner' }, 'assignment_issuer_mismatch', 'cross-role assignment issuer is rejected')
await rejectedCase((input) => { input.authority.assignment.record_url = 'https://github.com/whatrune/sd-prompt-studio/issues/259#issuecomment-6000000099' }, 'authority_binding_mismatch', 'stale or ambiguous assignment record binding is rejected')
await rejectedCase((input) => { input.authority.trust_root.record_digest = '9'.repeat(64) }, 'authority_binding_mismatch', 'wrong independently reviewed trust-root binding is rejected')
await rejectedCase((input) => { input.repository = 'other/repository' }, 'repository_mismatch', 'wrong repository is rejected')
await rejectedCase((input) => { input.pr_number = 261 }, 'pr_mismatch', 'wrong PR is rejected')
await rejectedCase((input) => { input.exact_head = '3'.repeat(40) }, 'head_mismatch', 'wrong exact HEAD is rejected')
await rejectedCase((input) => { input.task_scope_digest = 'f'.repeat(64) }, 'task_scope_mismatch', 'wrong Task scope digest is rejected')
await rejectedCase((input) => { input.ready_generation.event_id = '29000000009' }, 'ready_generation_mismatch', 'wrong Ready Generation is rejected')
await rejectedCase((input) => { input.ready_generation.actor_login = 'ready-event-actor'; }, 'ready_generation_mismatch', 'Ready REST event actor remains independently bound from record publisher or caller')
await rejectedCase((input) => { input.ready_generation.commit_id = '8'.repeat(40) }, 'ready_generation_mismatch', 'Ready REST event commit must equal exact HEAD')
await rejectedCase((input) => { input.workflow_identity.invocation_ref = 'refs/heads/feature' }, 'workflow_identity_mismatch', 'non-default ref is rejected')
await rejectedCase((input) => { input.workflow_identity.sha = '4'.repeat(40) }, 'workflow_identity_mismatch', 'wrong workflow SHA is rejected')
await rejectedCase((input) => { input.current_state.thread_snapshot_digest = '5'.repeat(64) }, 'thread_snapshot_mismatch', 'changed thread snapshot is rejected')
await rejectedCase((input) => { input.current_state.latest_protected_event_at = '2026-08-05T10:01:00Z' }, 'protected_event_order_invalid', 'newer protected event invalidates Terminal admission')
await rejectedCase((input) => { input.terminal_review = clone(terminalRecord) }, 'terminal_review_record_forbidden', 'Terminal Review URL is rejected in the wrong transition')
await rejectedCase((input) => { input.evaluated_at = '2026-08-05T10:40:00Z' }, 'collector_artifact_expired', 'Collector evidence older than 30 minutes is rejected')

const mergeReuse = clone(mergeInput)
mergeReuse.collector_artifact_jcs = terminalCollector.jcs
mergeReuse.collector_artifact_jcs_sha256 = terminalCollector.sha256
mergeReuse.current_state.thread_snapshot_digest = terminalCollector.artifact.thread_snapshot.snapshot_digest
const reuseResult = await evaluateProtectedTransitionAdmissionV1(mergeReuse)
nonAdmitting.push(reuseResult)
check(reuseResult.result === 'rejected' && reuseResult.rejection_codes.includes('distinct_post_terminal_artifact_required'), 'Merge rejects reuse of the Terminal Collector artifact')

const nonLaterTiming = { ...fixture.merge_artifact, receipt_id: '4900000003', receipt_created_at: '2026-08-05T10:10:30Z', snapshot_observed_at: '2026-08-05T10:11:00Z', post_snapshot_observed_at: '2026-08-05T10:11:01Z' }
const nonLaterCollector = await buildCollector(nonLaterTiming)
const nonLaterInput = clone(mergeInput)
nonLaterInput.collector_artifact_jcs = nonLaterCollector.jcs
nonLaterInput.collector_artifact_jcs_sha256 = nonLaterCollector.sha256
nonLaterInput.current_state.thread_snapshot_digest = nonLaterCollector.artifact.thread_snapshot.snapshot_digest
const nonLaterResult = await evaluateProtectedTransitionAdmissionV1(nonLaterInput)
nonAdmitting.push(nonLaterResult)
check(nonLaterResult.result === 'rejected' && nonLaterResult.rejection_codes.includes('distinct_post_terminal_artifact_required'), 'Merge rejects distinct but non-later Collector evidence')

const staleTerminalInput = clone(mergeInput)
staleTerminalInput.evaluated_at = '2026-08-05T10:45:00Z'
const staleTerminalResult = await evaluateProtectedTransitionAdmissionV1(staleTerminalInput)
nonAdmitting.push(staleTerminalResult)
check(staleTerminalResult.result === 'rejected' && staleTerminalResult.rejection_codes.includes('terminal_receipt_expired'), 'Merge rejects an expired Terminal accepted receipt')

const wrongTerminalArtifactName = clone(mergeInput)
wrongTerminalArtifactName.terminal_review.workflow_artifact_name = 'protected-transition-admission-v1-wrong-attempt'
const wrongTerminalArtifactNameResult = await evaluateProtectedTransitionAdmissionV1(wrongTerminalArtifactName)
nonAdmitting.push(wrongTerminalArtifactNameResult)
check(wrongTerminalArtifactNameResult.result === 'rejected' && wrongTerminalArtifactNameResult.rejection_codes.includes('terminal_receipt_provenance_mismatch'), 'Merge rejects a Terminal workflow artifact name not derived from the verified run and attempt')

const wrongTerminalReceiptBytes = clone(mergeInput)
wrongTerminalReceiptBytes.terminal_review.receipt_jcs_sha256 = '7'.repeat(64)
const wrongTerminalReceiptBytesResult = await evaluateProtectedTransitionAdmissionV1(wrongTerminalReceiptBytes)
nonAdmitting.push(wrongTerminalReceiptBytesResult)
check(wrongTerminalReceiptBytesResult.result === 'rejected' && wrongTerminalReceiptBytesResult.rejection_codes.includes('terminal_receipt_provenance_mismatch'), 'Merge rejects a Terminal receipt byte digest mismatch')

for (const count of [0, 2]) {
  const cardinalityInput = clone(mergeInput)
  cardinalityInput.terminal_review.accepted_receipts = count === 0 ? [] : [clone(terminalAccepted.receipt), clone(terminalAccepted.receipt)]
  cardinalityInput.terminal_review = await resealTerminal(cardinalityInput.terminal_review)
  const result = await evaluateProtectedTransitionAdmissionV1(cardinalityInput)
  nonAdmitting.push(result)
  check(result.result === 'rejected' && result.rejection_codes.includes('terminal_receipt_cardinality_invalid'), `${count} Terminal admission receipts fail closed`)
}

await failedCase((input) => { input.collector_artifact_jcs_sha256 = '0'.repeat(64) }, 'collector_artifact_digest_invalid', 'Collector JCS digest failure returns failed')
const persistenceFailed = await failedCase((input) => { input.persistence.available = false }, 'persistence_unavailable', 'persistence failure returns failed')
check(persistenceFailed.result === 'failed' && persistenceFailed.receipt_count === 0 && persistenceFailed.admitted_artifact_count === 0 && persistenceFailed.files_to_persist.length === 0, 'failed result has zero receipts and zero admitted artifacts')
await failedCase((input) => { input.extra = true }, 'input_contract_invalid', 'extra input field fails closed')
await failedCase((input) => { delete input.ready_generation.record_url }, 'input_contract_invalid', 'missing input field fails closed')
await failedCase((input) => { input.evaluated_at = 'not-time' }, 'input_contract_invalid', 'malformed input field fails closed')

check(nonAdmitting.every((result) => result.state_changed === false && result.protected_transition_performed === false && result.result !== 'accepted'), 'every non-admitting result performs no state change and no protected transition')
check(nonAdmitting.filter((result) => result.result === 'rejected').every((result) => result.receipt_count === 1 && result.admitted_artifact_count === 0), 'every rejected result has exactly one non-admitting receipt')
check(nonAdmitting.filter((result) => result.result === 'failed').every((result) => result.receipt_count === 0 && result.admitted_artifact_count === 0), 'every failed result has no receipt or admitted artifact')

const taskBindingSource = {
  url: fixture.task_record_url,
  bodyDigest: fixture.task_scope_digest,
}
const bindingIssuerRole = (targetType) => targetType === 'merge_decision_actor_assignment_v1' ? 'Product Owner' : 'Integrated Lead'
const bindingTargetSource = async (record, { edited = true } = {}) => {
  const body = canonicalizeReadyReviewObservationJcsV1(record)
  return {
    url: record.canonical_record,
    body,
    bodyDigest: await sha256ReadyReviewObservationV1(body),
    record,
    authorLogin: 'whatrune',
    createdAt: '2026-08-05T10:00:00Z',
    updatedAt: edited ? '2026-08-05T10:00:01Z' : '2026-08-05T10:00:00Z',
  }
}
const buildFinalizationBindingHarness = async (targetSource, bindingMode = 'contemporaneous') => {
  const targetType = targetSource.record.record_type
  const projection = {
    record_type: CANONICAL_FINALIZATION_BINDING_V1,
    binding_id: '',
    binding_mode: bindingMode,
    target_canonical_url: targetSource.url,
    target_record_type: targetType,
    target_record_digest: targetSource.record.record_digest,
    target_final_body_sha256: targetSource.bodyDigest,
    target_author_login: targetSource.authorLogin,
    repository: fixture.repository,
    task_record_url: fixture.task_record_url,
    task_scope_digest: fixture.task_scope_digest,
    pr_number: fixture.pr_number,
    pr_url: fixture.pr_url,
    target_revision: targetType === 'ready_review_producer_roster_v1' ? null : targetSource.record.revision,
    target_ready_event_id: String(targetSource.record.ready_event_id),
    issuer_login: 'whatrune',
    issuer_role: bindingIssuerRole(targetType),
    issuer_trust_root_record_url: fixture.canonical_finalization_binding.issuer_trust_root_record_url,
    issuer_trust_root_record_digest: fixture.canonical_finalization_binding.issuer_trust_root_record_digest,
  }
  projection.binding_id = await canonicalFinalizationBindingIdV1(projection)
  const record = {
    ...projection,
    binding_record_digest: await digestReadyReviewObservationProjectionV1(projection),
  }
  const body = canonicalizeReadyReviewObservationJcsV1(record)
  const source = {
    url: 'https://github.com/whatrune/sd-prompt-studio/issues/259#issuecomment-6999999999',
    body,
    bodyDigest: await sha256ReadyReviewObservationV1(body),
    authorLogin: 'whatrune',
    createdAt: '2026-08-06T10:30:00Z',
    updatedAt: '2026-08-06T10:30:00Z',
  }
  return { body, source, targetSource, taskSource: taskBindingSource, repository: fixture.repository, prNumber: fixture.pr_number, record }
}
const resealFinalizationBindingHarness = async (harness) => {
  harness.record.binding_id = await canonicalFinalizationBindingIdV1(harness.record)
  const projection = Object.fromEntries(Object.entries(harness.record).filter(([key]) => key !== 'binding_record_digest'))
  harness.record.binding_record_digest = await digestReadyReviewObservationProjectionV1(projection)
  harness.body = canonicalizeReadyReviewObservationJcsV1(harness.record)
  harness.source.body = harness.body
  harness.source.bodyDigest = await sha256ReadyReviewObservationV1(harness.body)
}
const validateBindingHarness = async (harness) => await validateCanonicalFinalizationBindingV1(harness)
const expectBindingFailure = async (harness, message, rejectionCode = null) => {
  let matched = false
  try {
    await validateBindingHarness(harness)
  } catch (error) {
    matched = rejectionCode === null ? !Array.isArray(error?.codes) : error.codes?.includes(rejectionCode)
  }
  check(matched, message)
}

const bindingLineageHarness = await assignmentLineageHarness('terminal_review_admission')
const generationTarget = await bindingTargetSource(bindingLineageHarness.readySource.record)
const validBinding = await buildFinalizationBindingHarness(generationTarget)
const admittedBinding = await validateBindingHarness(validBinding)
check(Object.keys(admittedBinding).length === CANONICAL_FINALIZATION_BINDING_V1_FIELD_COUNT && admittedBinding.binding_id.startsWith('CFB1-'), 'one-shot canonical Finalization Binding admits with exact 20 fields and deterministic ID')
check(generationTarget.createdAt !== generationTarget.updatedAt, 'self-binding target may have a finalization edit while its one-shot Binding remains immutable')
const validBindingContext = {
  declarations: [{ source: validBinding.source, record: admittedBinding }],
  taskSource: taskBindingSource,
  host: { repository: fixture.repository },
  request: { prNumber: fixture.pr_number },
}
const uniqueBinding = await resolveFinalizationBindingV1(validBindingContext, generationTarget, generationTarget.record.record_type)
check(uniqueBinding.binding_record_digest === admittedBinding.binding_record_digest, 'exactly one target-scoped Binding resolves deterministically')
let missingBindingRejected = false
try {
  await resolveFinalizationBindingV1({ ...validBindingContext, declarations: [] }, generationTarget, generationTarget.record.record_type)
} catch (error) {
  missingBindingRejected = error.codes?.includes('finalization_binding_missing')
}
check(missingBindingRejected, 'zero Finalization Bindings reject before authority use')
let ambiguousBindingRejected = false
try {
  await resolveFinalizationBindingV1({ ...validBindingContext, declarations: [...validBindingContext.declarations, ...validBindingContext.declarations] }, generationTarget, generationTarget.record.record_type)
} catch (error) {
  ambiguousBindingRejected = error.codes?.includes('finalization_binding_ambiguous')
}
check(ambiguousBindingRejected, 'two Finalization Bindings reject without chronological winner selection')

const trailingBinding = clone(validBinding)
trailingBinding.body += '\n'
trailingBinding.source.body = trailingBinding.body
await expectBindingFailure(trailingBinding, 'trailing newline makes Binding non-canonical and fails closed')
const duplicateKeyBinding = clone(validBinding)
duplicateKeyBinding.body = duplicateKeyBinding.body.replace('{', '{"record_type":"canonical_finalization_binding_v1",')
duplicateKeyBinding.source.body = duplicateKeyBinding.body
await expectBindingFailure(duplicateKeyBinding, 'duplicate JSON key makes Binding non-canonical and fails closed')
const proseBinding = clone(validBinding)
proseBinding.body = `Finalization Binding\n${proseBinding.body}`
proseBinding.source.body = proseBinding.body
await expectBindingFailure(proseBinding, 'Markdown or prose around Binding JSON fails closed')
const extraFieldBinding = clone(validBinding)
extraFieldBinding.record.extra = true
await resealFinalizationBindingHarness(extraFieldBinding)
await expectBindingFailure(extraFieldBinding, 'unknown Binding field fails exact-field validation')
const missingFieldBinding = clone(validBinding)
delete missingFieldBinding.record.target_revision
await resealFinalizationBindingHarness(missingFieldBinding)
await expectBindingFailure(missingFieldBinding, 'missing Binding field fails exact-field validation')
const editedBinding = clone(validBinding)
editedBinding.source.updatedAt = '2026-08-06T10:30:01Z'
await expectBindingFailure(editedBinding, 'edited Binding fails one-shot createdAt and updatedAt integrity')
const wrongIssuerBinding = clone(validBinding)
wrongIssuerBinding.record.issuer_login = 'untrusted-user'
wrongIssuerBinding.record.binding_id = await canonicalFinalizationBindingIdV1(wrongIssuerBinding.record)
const wrongIssuerProjection = Object.fromEntries(Object.entries(wrongIssuerBinding.record).filter(([key]) => key !== 'binding_record_digest'))
wrongIssuerBinding.record.binding_record_digest = await digestReadyReviewObservationProjectionV1(wrongIssuerProjection)
wrongIssuerBinding.body = canonicalizeReadyReviewObservationJcsV1(wrongIssuerBinding.record)
wrongIssuerBinding.source.body = wrongIssuerBinding.body
wrongIssuerBinding.source.authorLogin = 'untrusted-user'
await expectBindingFailure(wrongIssuerBinding, 'wrong issuer trust mapping rejects', 'finalization_binding_issuer_mismatch')
const wrongRoleBinding = clone(validBinding)
wrongRoleBinding.record.issuer_role = 'Product Owner'
await resealFinalizationBindingHarness(wrongRoleBinding)
await expectBindingFailure(wrongRoleBinding, 'cross-role Ready Binding rejects', 'finalization_binding_issuer_mismatch')
const wrongRootBinding = clone(validBinding)
wrongRootBinding.record.issuer_trust_root_record_digest = '0'.repeat(64)
await resealFinalizationBindingHarness(wrongRootBinding)
await expectBindingFailure(wrongRootBinding, 'wrong Finalization Binding trust root fails closed')
const wrongTaskDigestBinding = clone(validBinding)
wrongTaskDigestBinding.record.task_scope_digest = '0'.repeat(64)
await resealFinalizationBindingHarness(wrongTaskDigestBinding)
await expectBindingFailure(wrongTaskDigestBinding, 'wrong Task body digest fails closed')
const wrongPrBinding = clone(validBinding)
wrongPrBinding.record.pr_number += 1
wrongPrBinding.record.pr_url = 'https://github.com/whatrune/sd-prompt-studio/pull/261'
await resealFinalizationBindingHarness(wrongPrBinding)
await expectBindingFailure(wrongPrBinding, 'wrong PR scope fails closed')
for (const [field, value, message] of [
  ['target_record_digest', '0'.repeat(64), 'target record digest mismatch rejects'],
  ['target_final_body_sha256', '0'.repeat(64), 'target full-body SHA mismatch rejects'],
  ['target_author_login', 'other-author', 'target author mismatch rejects'],
  ['target_revision', 99, 'target revision mismatch rejects'],
  ['target_ready_event_id', '99999999999', 'target Ready event mismatch rejects'],
]) {
  const mismatch = clone(validBinding)
  mismatch.record[field] = value
  await resealFinalizationBindingHarness(mismatch)
  await expectBindingFailure(mismatch, message, 'finalization_binding_target_integrity_mismatch')
}
const targetEditedBinding = clone(validBinding)
targetEditedBinding.targetSource.record = await resealRecord({ ...targetEditedBinding.targetSource.record, exact_head: '9'.repeat(40) })
targetEditedBinding.targetSource.body = canonicalizeReadyReviewObservationJcsV1(targetEditedBinding.targetSource.record)
targetEditedBinding.targetSource.bodyDigest = await sha256ReadyReviewObservationV1(targetEditedBinding.targetSource.body)
await expectBindingFailure(targetEditedBinding, 'target edit and internal reseal cannot redefine the finalized Binding', 'finalization_binding_target_integrity_mismatch')
const unlistedRetroactiveBinding = await buildFinalizationBindingHarness(generationTarget, 'retroactive')
await expectBindingFailure(unlistedRetroactiveBinding, 'retroactive Binding outside the exact five-target allowlist rejects', 'retroactive_finalization_binding_not_eligible')

check(fixture.canonical_finalization_binding.retroactive_targets.length === 5, 'retroactive Finalization Binding fixture is limited to the exact five frozen targets')
for (const frozenTarget of fixture.canonical_finalization_binding.retroactive_targets) {
  const targetSource = {
    url: frozenTarget.record.canonical_record,
    body: 'frozen canonical target body is represented by its direct-refetch SHA-256',
    bodyDigest: frozenTarget.body_sha256,
    record: frozenTarget.record,
    authorLogin: 'whatrune',
    createdAt: '2026-08-06T00:00:00Z',
    updatedAt: '2026-08-06T00:00:01Z',
  }
  const retroactiveBinding = await buildFinalizationBindingHarness(targetSource, 'retroactive')
  const admitted = await validateBindingHarness(retroactiveBinding)
  check(admitted.binding_mode === 'retroactive' && admitted.target_canonical_url === targetSource.url,
    `exact retroactive target ${targetSource.url} admits only at its frozen body and record digests`)
}

for (const transition of ['terminal_review_admission', 'merge_decision_admission']) {
  const targetHarness = await assignmentLineageHarness(transition)
  const assignmentTarget = await bindingTargetSource(targetHarness.records[1].record)
  const assignmentBinding = await buildFinalizationBindingHarness(assignmentTarget)
  const admitted = await validateBindingHarness(assignmentBinding)
  check(admitted.issuer_role === bindingIssuerRole(assignmentTarget.record.record_type), `${transition} uses the identical Binding algorithm with its frozen issuer role`)
}

for (const transition of ['terminal_review_admission', 'merge_decision_admission']) {
  const harness = await assignmentLineageHarness(transition)
  const current = await validateGenerationAwareAssignmentLineageV1(harness)
  check(current.revision === 2 && current.record_url === harness.records[1].source.url && current.transition === transition,
    `${transition} admits only the revision-2 current leaf while revision 1 remains issuance-era evidence`)
}

const expectLineageRejection = async (mutate, code, message) => {
  const harness = await assignmentLineageHarness('terminal_review_admission')
  await mutate(harness)
  let rejected = false
  try {
    await validateGenerationAwareAssignmentLineageV1(harness)
  } catch (error) {
    rejected = Array.isArray(error?.codes) && error.codes.includes(code)
  }
  check(rejected, message)
}

await expectLineageRejection(async ({ records }) => {
  records[1].record.supersedes_record_url = records[1].source.url
  await resealAssignmentEvidence(records[1])
}, 'assignment_chain_invalid', 'assignment lineage cycle is rejected')
await expectLineageRejection(async ({ records }) => {
  records[1].record.revision = 3
  await resealAssignmentEvidence(records[1])
}, 'assignment_chain_gapped', 'assignment revision gap is rejected')
await expectLineageRejection(async ({ records }) => {
  const fork = clone(records[1])
  fork.source.url = 'https://github.com/whatrune/sd-prompt-studio/issues/259#issuecomment-6000000113'
  fork.source.createdAt = '2026-08-05T10:02:00Z'
  fork.source.updatedAt = fork.source.createdAt
  fork.record.canonical_record = fork.source.url
  fork.record.issued_at = fork.source.createdAt
  await resealAssignmentEvidence(fork)
  records.push(fork)
}, 'assignment_chain_forked', 'branching assignment successors and multiple current leaves are rejected')
await expectLineageRejection(async ({ records }) => {
  records[1].record.assignment_id = 'PTA-259-OTHER-ACTOR'
  await resealAssignmentEvidence(records[1])
}, 'assignment_chain_ambiguous', 'multiple assignment identity series are rejected')
await expectLineageRejection(async ({ records }) => {
  records[1].record.supersedes_record_url = 'https://github.com/whatrune/sd-prompt-studio/issues/259#issuecomment-6000000999'
  await resealAssignmentEvidence(records[1])
}, 'assignment_chain_invalid', 'predecessor URL mismatch is rejected after predecessor digest validation')
const predecessorDigestHarness = await assignmentLineageHarness('terminal_review_admission')
predecessorDigestHarness.records[0].record.record_digest = '0'.repeat(64)
let predecessorDigestFailed = false
try {
  await validateGenerationAwareAssignmentLineageV1(predecessorDigestHarness)
} catch (error) {
  predecessorDigestFailed = /assignment record digest mismatch/.test(String(error?.message))
}
check(predecessorDigestFailed, 'historical predecessor self-digest mismatch fails integrity validation')
const editedGenerationHarness = await assignmentLineageHarness('terminal_review_admission')
editedGenerationHarness.records[0].generationSource.updatedAt = '2026-08-05T09:00:01Z'
const editedGenerationAccepted = await validateGenerationAwareAssignmentLineageV1(editedGenerationHarness)
check(editedGenerationAccepted.revision === 2, 'self-binding target timestamp equality is not used as immutability authority after Finalization Binding admission')
await expectLineageRejection(async ({ records }) => {
  records[0].record.ready_generation_record_digest = '0'.repeat(64)
  await resealAssignmentEvidence(records[0])
}, 'assignment_issuance_generation_mismatch', 'historical predecessor Ready Generation digest mismatch is rejected')
await expectLineageRejection(async ({ records }) => {
  records[0].record.exact_head = records[1].record.exact_head
  await resealAssignmentEvidence(records[0])
}, 'assignment_issuance_generation_mismatch', 'historical predecessor cannot substitute current-generation HEAD for its issuance-era binding')
await expectLineageRejection(async ({ records }) => {
  records[0].generationEvent.event_id = '29000009999'
}, 'assignment_issuance_generation_mismatch', 'historical predecessor Ready event mismatch is rejected')
await expectLineageRejection(async ({ records }) => {
  records[1].record.assigned_role = 'Product Owner'
  await resealAssignmentEvidence(records[1])
}, 'assignment_scope_mismatch', 'stable role and transition scope mismatch is rejected')
await expectLineageRejection(async ({ records }) => {
  records[1].source.authorLogin = 'self-reviewer'
  records[1].record.authority_owner_login = 'self-reviewer'
  records[1].record.assigned_login = 'self-reviewer'
  await resealAssignmentEvidence(records[1])
}, 'assignment_issuer_not_admitted', 'self-authenticated assignment issuer is rejected by the independent trust root')

for (const extraField of ['base_sha', 'producer_roster_record_digest']) {
  const harness = await assignmentLineageHarness('terminal_review_admission')
  harness.records[1].record[extraField] = '5'.repeat(64)
  let failed = false
  try {
    await validateGenerationAwareAssignmentLineageV1(harness)
  } catch (error) {
    failed = /assignment record contract malformed/.test(String(error?.message))
  }
  check(failed, `${extraField} remains forbidden by the exact 23-field assignment schema`)
}

const rosterBindingHarness = await assignmentLineageHarness('terminal_review_admission')
const readyGeneration = rosterBindingHarness.readySource.record
const collectorBinding = {
  ready_generation_record_url: readyGeneration.canonical_record,
  repository: readyGeneration.repository,
  pr_number: readyGeneration.pr_number,
  pr_url: readyGeneration.pr_url,
  exact_head: readyGeneration.exact_head,
  ready_event_id: readyGeneration.ready_event_id,
  ready_occurred_at: readyGeneration.ready_occurred_at,
  producer_roster_source_digest: readyGeneration.producer_roster_source_digest,
}
check(validateReadyGenerationCollectorBindingV1({ readyGeneration, collectorArtifact: collectorBinding }),
  'Producer Roster remains a separate Ready Generation to Collector binding')
let rosterMismatchRejected = false
try {
  validateReadyGenerationCollectorBindingV1({ readyGeneration, collectorArtifact: { ...collectorBinding, producer_roster_source_digest: 'f'.repeat(64) } })
} catch (error) {
  rosterMismatchRejected = Array.isArray(error?.codes) && error.codes.includes('ready_generation_collector_binding_mismatch')
}
check(rosterMismatchRejected, 'Ready Generation and Collector Producer Roster digest mismatch is rejected outside assignment schema')

const inputs = workflow.on.workflow_dispatch.inputs
check(Object.keys(workflow.on).join(',') === 'workflow_dispatch', 'workflow has only workflow_dispatch')
check(Object.keys(inputs).join(',') === 'transition,pr_number,exact_head,task_record_url,ready_generation_record_url,terminal_review_record_url', 'workflow exposes exactly the six frozen caller inputs')
check(inputs.transition.type === 'choice' && inputs.transition.options.join(',') === 'terminal_review_admission,merge_decision_admission', 'transition input has only the two protected admission surfaces')
check(Object.keys(workflow.permissions).sort().join(',') === 'actions,contents,issues,pull-requests' && Object.values(workflow.permissions).every((value) => value === 'read'), 'workflow has minimum read permissions including only the approved Actions read delta')
check(Object.keys(workflow.jobs).length === 1 && Object.keys(workflow.jobs)[0] === 'protected_transition_admission_v1', 'workflow has one finite Phase 1 job')
check((workflowSource.match(/actions\/checkout@[0-9a-f]{40}/g) ?? []).length === 1 && (workflowSource.match(/actions\/setup-node@[0-9a-f]{40}/g) ?? []).length === 1 && (workflowSource.match(/actions\/upload-artifact@[0-9a-f]{40}/g) ?? []).length === 1, 'all external Actions are pinned once to full commit SHAs')
check((runnerSource.match(/run-ready-review-terminal-observation-collector-v1\.mjs/g) ?? []).length === 1, 'production composition names the existing Collector CLI exactly once')
check((runnerSource.match(/admitted\.collector\.runOnce\(/g) ?? []).length === 1, 'production orchestration invokes the injected existing Collector capability exactly once')
check(runnerSource.includes("event?.event === 'ready_for_review'") && runnerSource.includes('event.commit_id !== null && event.commit_id !== readySource.record.exact_head') && runnerSource.includes('event?.actor?.login'), 'production binds Ready authority to the exact paginated REST ready_for_review event actor while preserving nullable REST commit identity')
check(runnerSource.includes('issues/${prNumber}/timeline') && runnerSource.includes('response.length < 100'), 'production fully paginates each issuance-era Ready REST timeline before authority selection')
check(runnerSource.includes("matches.length !== 1") && runnerSource.includes("ready_event_cardinality_invalid"), 'zero or multiple exact Ready events reject before Collector execution')
check(runnerSource.includes('actor_login: after.readyEvent.actor_login') && !runnerSource.includes('actor_login: readySource.authorLogin'), 'Ready Generation publisher is never substituted for the REST Ready actor')
check(runnerSource.includes('issues/${taskIdentity[3]}/comments') && runnerSource.includes('acquireCanonicalRecord(candidate.listed.html_url'), 'production paginates Task assignments and directly re-fetches the selected canonical record')
check(runnerSource.includes('source.authorLogin !== trustRoot.issuer_login') && runnerSource.includes('record.authority_owner_login !== trustRoot.issuer_login'), 'assignment issuer is authenticated by the independent trust root instead of self-assertion')
const taskAuthoritySetSource = /const TASK_AUTHORITY_RECORD_TYPES = Object\.freeze\(new Set\(\[([\s\S]*?)\]\)\)/.exec(runnerSource)?.[1] ?? ''
check(runnerSource.includes("const TRUST_ROOT_REVOCATION_RECORD_TYPES = Object.freeze(new Set([\n  'phase_1_assignment_issuer_trust_root_revocation_v1',\n]))") &&
  !taskAuthoritySetSource.includes('phase_1_assignment_issuer_trust_root_revocation_v1'), 'revocation uses a dedicated singleton without expanding Task authority record types')
check(!runnerSource.includes('recordTypeClaim') &&
  (runnerSource.match(/inspectTaskAuthorityBody\(comment\?\.body, TRUST_ROOT_REVOCATION_RECORD_TYPES\)/g) ?? []).length === 1,
  'acquireTrustRoot uses the total inspector exactly once per comment with no fallback revocation selector')
check(runnerSource.includes("declared.length === 0") && runnerSource.includes("assignment_missing"), 'missing canonical assignment rejects before Collector execution')
check(!runnerSource.includes("assignment_edited") && runnerSource.includes('assignmentBinding'), 'self-binding assignment timestamp equality is replaced by Finalization Binding integrity')
check(runnerSource.includes("record.assignment_id !== first.assignment_id") && runnerSource.includes("assignment_chain_ambiguous"), 'multiple assignment chains fail closed')
check(runnerSource.includes("byRevision.has(item.record.revision)") && runnerSource.includes("assignment_chain_forked"), 'assignment revision forks fail closed')
check(runnerSource.includes("byRevision.size !== maximum") && runnerSource.includes("assignment_chain_gapped"), 'assignment revision gaps fail closed')
check(runnerSource.includes("item.record.supersedes_record_url !== predecessor") && runnerSource.includes("assignment_chain_invalid"), 'assignment supersession mismatches fail closed')
check(runnerSource.includes("tip.record.status !== 'assigned'") && runnerSource.includes("assignment_revoked"), 'revoked current assignment fails closed')
check(runnerSource.includes('generationSource.record.exact_head !== record.exact_head') && runnerSource.includes('tip.record.exact_head !== request.exactHead'), 'historical assignments bind issuance-era generation while only current leaf binds current HEAD')
check(runnerSource.includes("pr?.base?.ref !== host.defaultBranch") && runnerSource.includes("pr?.base?.sha !== host.workflowSha"), 'base SHA remains an independent live PR/default-branch observation outside assignment schema')
check(runnerSource.includes('validateReadyGenerationCollectorBindingV1') && runnerSource.includes('producer_roster_source_digest !== readyGeneration.producer_roster_source_digest'), 'Producer Roster remains separately bound through Ready Generation and the one existing Collector')
check(runnerSource.includes('FINALIZATION_BINDING_KEYS') && runnerSource.includes('exact 20-field canonical JCS'), 'Finalization Binding parser enforces the exact 20-field canonical-JCS body')
check(runnerSource.includes('canonicalFinalizationBindingIdV1') && runnerSource.includes("filter(([key]) => key !== 'binding_record_digest')"), 'Binding ID selector and non-circular Binding record digest are deterministic')
check(runnerSource.includes('FINALIZATION_BINDING_TRUST_ROOT') && runnerSource.includes("review.record?.decision !== 'APPROVE'"), 'implementation pins the reviewed Finalization Binding issuer trust root')
check(runnerSource.includes('listed?.body !== direct.body') && runnerSource.includes('listed?.updated_at !== direct.updatedAt'), 'every declared Binding is directly re-fetched and compared to its paginated observation')
check(runnerSource.includes('source?.createdAt !== source?.updatedAt') && runnerSource.includes('Finalization Binding one-shot source integrity failed'), 'createdAt equality remains mandatory only for the non-self-binding Binding record')
check(runnerSource.includes("finalization_binding_missing") && runnerSource.includes("finalization_binding_ambiguous"), 'zero and multiple target Binding cardinalities fail closed')
check((runnerSource.match(/acquireAuthoritySnapshot\(request, host/g) ?? []).length === 2 && runnerSource.indexOf('acquireAuthoritySnapshot(request, host') < runnerSource.indexOf('admitted.collector.runOnce'), 'complete mutable-authority snapshots run before and after the single Collector')
check(runnerSource.includes("finalization_binding_snapshot_drift") && runnerSource.includes("finalization_binding_head_drift"), 'target, Binding, duplicate-insertion, and exact-HEAD drift are non-admitting')
check(runnerSource.includes('acquireFinalizedGeneration(generationSource') && runnerSource.includes('assignmentBinding'), 'every historical assignment predecessor resolves its own Binding and issuance-era Generation/roster Bindings')
check(runnerSource.includes('RETROACTIVE_FINALIZATION_BINDING_TARGETS') && fixture.canonical_finalization_binding.retroactive_target_urls.every((url) => runnerSource.includes(url)), 'retroactive admission is pinned to exactly the five reviewed canonical target URLs')
check(runnerSource.includes('host.triggeringActor !== before.assignment.assigned_login') && runnerSource.includes("workflow_actor_assignment_mismatch"), 'physical current-attempt workflow caller must equal the independently assigned login')
check(runnerSource.includes('GITHUB_ACTOR') && runnerSource.includes('GITHUB_TRIGGERING_ACTOR') && runnerSource.includes('host.triggeringActor !== host.originalActor'), 'same-actor reruns are admitted and cross-actor reruns reject from trusted run context')
check(runnerSource.includes('paginatedArtifacts') && runnerSource.includes('/actions/artifacts/${artifact.id}/zip') && runnerSource.includes("unzip', ['-Z1'") && runnerSource.includes('TERMINAL_ACCEPTED_FILES'), 'Terminal authority is reacquired from a fully paginated exact two-file Actions artifact')
check(runnerSource.includes("encoding: 'buffer'") && runnerSource.includes('admitArtifactZipExecResultV1'), 'artifact ZIP acquisition explicitly requests Buffer stdout and stderr')
check(runnerSource.includes('canonicalizeReadyReviewObservationJcsV1(receipt) !== receiptText') && runnerSource.includes('validateProtectedTransitionAdmissionReceiptV1(receipt)'), 'actual Terminal receipt bytes require canonical JCS and a valid admission seal')
check(runnerSource.includes('terminal_lineage_candidate_not_current_leaf') && runnerSource.includes('predecessor_record_digest !== predecessor.source.bodyDigest'), 'Terminal caller locator must be the unique explicitly linked current leaf')
check(runnerSource.includes('directApiAuthorLogin: source.authorLogin') && runnerSource.includes("terminal_leaf_author_assignment_mismatch"), 'current Terminal leaf binds direct API author, declared author, record actor, and canonical assignment login')
check(runnerSource.indexOf('const assignment = await acquireAssignment') < runnerSource.indexOf('admitted.collector.runOnce'), 'authority admission completes before the single Collector invocation')
check(runnerSource.includes("collector_artifact: 'not_acquired'") && runnerSource.includes("diagnostic_version: 'protected-transition-identity-rejection-v1'"), 'pre-Collector semantic rejection persists one explicit non-admitting diagnostic')
check(!runnerSource.includes('taskSource.authorLogin !== host.actor'), 'Task record author is not treated as transition actor authority')
check(!runnerSource.includes("const actorRole = request.transition ==="), 'transition does not synthesize an actor role')
check((evaluatorSource.match(/parseReadyReviewTerminalObservationArtifactV1\(/g) ?? []).length === 1, 'pure evaluator reuses the existing exact-byte parser exactly once')
check((evaluatorSource.match(/export const evaluateProtectedTransitionAdmissionV1\s*=/g) ?? []).length === 1, 'one pure protected-transition evaluator is exported')
check(!/markPullRequestReadyForReview|mergePullRequest|enablePullRequestAutoMerge|\/merge\b|gh\s+pr\s+(ready|merge|review)/.test(`${runnerSource}\n${evaluatorSource}`), 'implementation has no Ready, Review publication, Merge Decision publication, or Merge capability')
check(!/setTimeout|setInterval|daemon|background/.test(`${runnerSource}\n${evaluatorSource}`), 'implementation creates no scheduler, daemon, or background process')
check(runnerSource.includes("process.exitCode = result.result === 'accepted' ? 0 : 2"), 'rejected host execution remains non-zero')

const PINNED_METADATA = Object.freeze({
  '5198987697': ['2026-08-06T00:28:28Z', '2026-08-06T00:28:28Z'], '5199026857': ['2026-08-06T00:34:02Z', '2026-08-06T00:34:02Z'],
  '5198928778': ['2026-08-06T00:19:15Z', '2026-08-06T00:19:15Z'], '5186163757': ['2026-08-05T00:36:01Z', '2026-08-05T00:36:02Z'],
  '5186264557': ['2026-08-05T00:52:23Z', '2026-08-05T00:52:55Z'], '5203226004': ['2026-08-06T10:00:00Z', '2026-08-06T10:00:00Z'],
  '5203281050': ['2026-08-06T10:01:00Z', '2026-08-06T10:01:00Z'],
})
const commentId = (url) => /issuecomment-(\d+)$/.exec(url)?.[1]
const sourceBody = (record, representation = 'json') => representation === 'yaml' ? `\`\`\`yaml\n${JSON.stringify(record, null, 2)}\n\`\`\`` : canonicalizeReadyReviewObservationJcsV1(record)
const apiSource = (url, body, { createdAt = '2026-08-06T12:00:00Z', updatedAt = createdAt, author = 'whatrune' } = {}) => ({
  html_url: url, author_association: 'OWNER', user: { login: author }, body, created_at: createdAt, updated_at: updatedAt,
})
const listedSource = (source) => ({ html_url: source.html_url, user: { login: source.user.login }, body: source.body, created_at: source.created_at, updated_at: source.updated_at })
const makeSyntheticBinding = async (target, taskDigest, serial, issuerRole) => {
  const record = {
    record_type: CANONICAL_FINALIZATION_BINDING_V1, binding_id: '', binding_mode: 'contemporaneous', target_canonical_url: target.url,
    target_record_type: target.record.record_type, target_record_digest: target.record.record_digest, target_final_body_sha256: target.bodyDigest,
    target_author_login: 'whatrune', repository: fixture.repository, task_record_url: fixture.task_record_url, task_scope_digest: taskDigest,
    pr_number: fixture.pr_number, pr_url: fixture.pr_url, target_revision: target.record.record_type === 'ready_review_producer_roster_v1' ? null : target.record.revision,
    target_ready_event_id: String(target.record.ready_event_id), issuer_login: 'whatrune', issuer_role: issuerRole,
    issuer_trust_root_record_url: fixture.canonical_finalization_binding.issuer_trust_root_record_url,
    issuer_trust_root_record_digest: fixture.canonical_finalization_binding.issuer_trust_root_record_digest,
  }
  record.binding_id = await canonicalFinalizationBindingIdV1(record)
  record.binding_record_digest = await digestReadyReviewObservationProjectionV1({ ...record })
  const body = canonicalizeReadyReviewObservationJcsV1(record)
  const url = `https://github.com/whatrune/sd-prompt-studio/issues/259#issuecomment-${7000000000 + serial}`
  return { url, record, body, bodyDigest: await sha256ReadyReviewObservationV1(body), source: apiSource(url, body) }
}
const buildSyntheticCollector = async (rosterDigest, timing = fixture.terminal_artifact) => {
  const projection = clone((await buildCollector(timing)).artifact)
  delete projection.artifact_digest
  projection.producer_roster_source_digest = rosterDigest
  const artifact = await buildReadyReviewTerminalObservationArtifactV1(projection)
  assert.ok(artifact)
  const jcs = canonicalizeReadyReviewObservationJcsV1(artifact)
  return { artifact, jcs, sha256: await sha256ReadyReviewObservationV1(jcs) }
}
const buildSyntheticHarness = async ({ transition = 'terminal_review_admission', assignmentRepresentation = 'yaml', assignmentStatus = 'assigned', terminalFixture = null, mutate = () => {} } = {}) => {
  const taskDigest = await sha256ReadyReviewObservationV1(SYNTHETIC_TASK_BODY)
  const rosterUrl = 'https://github.com/whatrune/sd-prompt-studio/issues/259#issuecomment-6000000302'
  const roster = await resealRecord({ record_type: 'ready_review_producer_roster_v1', canonical_record: rosterUrl, repository: fixture.repository,
    pr_number: fixture.pr_number, exact_head: fixture.exact_head, ready_event_id: fixture.ready_generation.event_id,
    producer_ids: ['chatgpt-codex-connector[bot]'], effective_from: '2026-08-05T09:59:00Z', effective_until: null })
  const ready = await resealRecord({ record_type: 'ready_review_generation_record_v1', canonical_record: fixture.ready_generation.record_url,
    repository: fixture.repository, pr_number: fixture.pr_number, pr_url: fixture.pr_url, exact_head: fixture.exact_head,
    ready_event_id: fixture.ready_generation.event_id, ready_occurred_at: fixture.ready_generation.occurred_at, task_issue_url: fixture.task_record_url,
    revision: 1, prior_record_url: null, producer_roster_source_url: rosterUrl, producer_roster_source_digest: roster.record_digest })
  const terminal = transition === 'terminal_review_admission'
  const assignmentUrl = terminal ? fixture.terminal_authority.assignment_record_url : fixture.merge_authority.assignment_record_url
  const ownerRole = terminal ? 'Integrated Lead' : 'Product Owner'
  const assignedRole = terminal ? 'Independent PR Reviewer' : 'Product Owner'
  const assignment = await resealRecord({ record_type: terminal ? 'terminal_review_actor_assignment_v1' : 'merge_decision_actor_assignment_v1',
    canonical_record: assignmentUrl, assignment_id: terminal ? 'PTA-259-TERMINAL-REVIEW-ACTOR' : 'PTA-259-MERGE-DECISION-ACTOR', revision: 1,
    supersedes_record_url: null, status: assignmentStatus, authority_owner_role: ownerRole, authority_owner_login: 'whatrune', repository: fixture.repository,
    task_record_url: fixture.task_record_url, task_scope_digest: taskDigest, pr_number: fixture.pr_number, pr_url: fixture.pr_url, exact_head: fixture.exact_head,
    ready_generation_record_url: fixture.ready_generation.record_url, ready_generation_record_digest: ready.record_digest,
    ready_event_id: fixture.ready_generation.event_id, ready_occurred_at: fixture.ready_generation.occurred_at, transition,
    assigned_login: fixture.actor_login, assigned_role: assignedRole, issued_at: '2026-08-06T12:01:00Z' })
  const targets = []
  for (const [record, representation, createdAt] of [[roster, 'json', '2026-08-06T12:00:00Z'], [ready, 'json', '2026-08-06T12:00:30Z'], [assignment, assignmentRepresentation, assignment.issued_at]]) {
    const body = sourceBody(record, representation)
    targets.push({ url: record.canonical_record, record, body, bodyDigest: await sha256ReadyReviewObservationV1(body), source: apiSource(record.canonical_record, body, { createdAt }) })
  }
  const bindings = [await makeSyntheticBinding(targets[0], taskDigest, 1, 'Integrated Lead'), await makeSyntheticBinding(targets[1], taskDigest, 2, 'Integrated Lead'), await makeSyntheticBinding(targets[2], taskDigest, 3, ownerRole)]
  let terminalLineage = null; let artifactArchive = null; let artifactEntries = null
  if (!terminal) {
    if (terminalFixture === null) throw new Error('merge synthetic fixture requires Terminal admission')
    const terminalTarget = terminalFixture.harness.state.targets[2]
    targets.push(terminalTarget)
    bindings.push(await makeSyntheticBinding(terminalTarget, taskDigest, 4, 'Integrated Lead'))
    const receipt = terminalFixture.result.receipt
    const url = fixture.terminal_review_record_url
    const record = await resealRecord({ record_type: 'terminal_review_admission_lineage_v1', canonical_record: url,
      lineage_id: fixture.terminal_review_lineage_id, revision: 1, predecessor_record_url: null, predecessor_record_digest: null, effect: 'APPROVE',
      api_author_login: fixture.actor_login, task_record_url: fixture.task_record_url, repository: fixture.repository, pr_number: fixture.pr_number,
      pr_url: fixture.pr_url, exact_head: fixture.exact_head, ready_generation_record_url: fixture.ready_generation.record_url,
      ready_generation_record_digest: ready.record_digest, ready_event_id: fixture.ready_generation.event_id,
      ready_occurred_at: fixture.ready_generation.occurred_at, transition: 'terminal_review_admission',
      assignment_record_url: receipt.assignment_record_url, assignment_record_digest: receipt.assignment_record_digest,
      actor_login: fixture.actor_login, actor_role: 'Independent PR Reviewer', published_at: fixture.terminal_review_published_at,
      collector_artifact_digest: receipt.collector_artifact_digest, accepted_receipts: [receipt] })
    const body = sourceBody(record, 'json'); const source = apiSource(url, body, { createdAt: record.published_at })
    terminalLineage = { url, record, body, source }
    artifactArchive = buildStoredZip({ [PROTECTED_TRANSITION_RECEIPT_FILE_V1]: canonicalizeReadyReviewObservationJcsV1(receipt), [PROTECTED_TRANSITION_COLLECTOR_FILE_V1]: terminalFixture.harness.state.collector.jcs })
    artifactEntries = readStoredZipEntries(artifactArchive)
  }
  const trustRootUrl = 'https://github.com/whatrune/sd-prompt-studio/issues/251#issuecomment-5198987697'
  const [trustRootCreatedAt, trustRootUpdatedAt] = PINNED_METADATA[commentId(trustRootUrl)]
  const trustRootSource = apiSource(trustRootUrl, PINNED_COMMENT_BODIES[trustRootUrl], { createdAt: trustRootCreatedAt, updatedAt: trustRootUpdatedAt })
  const state = { transition, taskDigest, roster, ready, assignment, targets, bindings,
    collector: await buildSyntheticCollector(roster.record_digest, terminal ? fixture.terminal_artifact : fixture.merge_artifact), terminalLineage, artifactArchive, artifactEntries,
    authorityComments: [listedSource(trustRootSource)],
    taskCommentsPre: [...targets.map(({ source }) => listedSource(source)), ...bindings.map(({ source }) => listedSource(source))], taskCommentsPost: null,
    prPre: { html_url: fixture.pr_url, state: 'open', draft: false, head: { sha: fixture.exact_head }, base: { ref: 'main', sha: fixture.workflow.sha } },
    prPost: null, taskBodyPost: SYNTHETIC_TASK_BODY, extraDirect: [], directPost: new Map(), postCommentsFailure: false,
    workflowRunHeadSha: fixture.workflow.sha, trace: [], collectorCount: 0, retainedFileCount: 0, mutationCount: 0, persistFailure: false }
  if (terminalLineage !== null) state.taskCommentsPre.push(listedSource(terminalLineage.source))
  state.taskCommentsPost = clone(state.taskCommentsPre); state.prPost = clone(state.prPre); await mutate(state)
  const direct = new Map([[`repos/${fixture.repository}/issues/${fixture.pr_number - 1}`, apiSource(fixture.task_record_url, SYNTHETIC_TASK_BODY)]])
  for (const [url, body] of Object.entries(PINNED_COMMENT_BODIES)) { const id = commentId(url); const [createdAt, updatedAt] = PINNED_METADATA[id]; direct.set(`repos/${fixture.repository}/issues/comments/${id}`, apiSource(url, body, { createdAt, updatedAt })) }
  for (const item of [...targets, ...bindings, ...(terminalLineage === null ? [] : [terminalLineage]), ...state.extraDirect]) direct.set(`repos/${fixture.repository}/issues/comments/${commentId(item.url)}`, item.source)
  const pageCalls = [0, 0]; const seen = [new Set(), new Set()]
  const push = (phase, token) => { if (!seen[phase].has(token)) { seen[phase].add(token); state.trace.push(token) } }
  const request = { transition, prNumber: fixture.pr_number, exactHead: fixture.exact_head, taskRecordUrl: fixture.task_record_url, readyRecordUrl: fixture.ready_generation.record_url, terminalReviewRecordUrl: terminal ? '' : fixture.terminal_review_record_url }
  const host = { repository: fixture.repository, repositoryId: fixture.repository_id, invocationRef: fixture.workflow.invocation_ref, workflowSha: fixture.workflow.sha,
    workflowRef: fixture.workflow.ref, runId: fixture.workflow.run_id, runAttempt: fixture.workflow.run_attempt, originalActor: fixture.actor_login,
    triggeringActor: fixture.actor_login, actor: fixture.actor_login, serverUrl: fixture.workflow.server_url, runUrl: fixture.workflow.run_url,
    defaultBranch: fixture.workflow.default_branch, persistenceAvailable: true }
  const adapters = { github: {
    readJson: async (endpoint) => {
      const phase = state.collectorCount === 0 ? 0 : 1; const suffix = String(phase)
      if (endpoint === `repos/${fixture.repository}/pulls/${fixture.pr_number}`) { push(phase, `JP${suffix}`); return clone(phase === 0 ? state.prPre : state.prPost) }
      if (endpoint === `repos/${fixture.repository}/issues/${fixture.pr_number - 1}`) { push(phase, `JT${suffix}`); return phase === 0 ? clone(direct.get(endpoint)) : apiSource(fixture.task_record_url, state.taskBodyPost) }
      if (endpoint.startsWith(`repos/${fixture.repository}/issues/251/comments?`)) { push(phase, `JA${suffix}`); return clone(state.authorityComments) }
      if (endpoint.startsWith(`repos/${fixture.repository}/issues/${fixture.pr_number - 1}/comments?`)) { pageCalls[phase] += 1; if (pageCalls[phase] === 1) push(phase, `JC${suffix}`); if (phase === 1 && state.postCommentsFailure) throw new Error('synthetic pagination unavailable'); if (pageCalls[phase] === (terminal ? 3 : 4)) push(phase, `JL${suffix}`); return clone(phase === 0 ? state.taskCommentsPre : state.taskCommentsPost) }
      if (endpoint.startsWith(`repos/${fixture.repository}/issues/${fixture.pr_number}/timeline?`)) { push(phase, `JR${suffix}`); return [{ event: 'ready_for_review', id: fixture.ready_generation.event_id, created_at: fixture.ready_generation.occurred_at, commit_id: fixture.exact_head, actor: { login: fixture.actor_login } }] }
      if (endpoint === `repos/${fixture.repository}/issues/comments/${commentId(assignmentUrl)}`) push(phase, `JS${suffix}`)
      if (!terminal && endpoint === `repos/${fixture.repository}/actions/runs/${terminalFixture.result.receipt.workflow_run_id}`) { push(phase, `JW${suffix}`); return { id: Number(terminalFixture.result.receipt.workflow_run_id), run_attempt: terminalFixture.result.receipt.workflow_run_attempt,
        path: fixture.workflow.path, event: 'workflow_dispatch', head_branch: 'main', head_sha: state.workflowRunHeadSha, status: 'completed', conclusion: 'success',
        html_url: terminalFixture.result.receipt.workflow_run_url, actor: { login: fixture.actor_login }, triggering_actor: { login: fixture.actor_login } } }
      if (!terminal && endpoint.startsWith(`repos/${fixture.repository}/actions/runs/${terminalFixture.result.receipt.workflow_run_id}/artifacts?`)) return { total_count: 1, artifacts: [{
        id: Number(fixture.terminal_workflow_artifact.id), name: `protected-transition-admission-v1-${terminalFixture.result.receipt.workflow_run_id}-${terminalFixture.result.receipt.workflow_run_attempt}`,
        expired: false, workflow_run: { id: Number(terminalFixture.result.receipt.workflow_run_id) }, archive_download_url: 'https://api.github.com/synthetic.zip',
        digest: `sha256:${createHash('sha256').update(state.artifactArchive).digest('hex')}` }] }
      if (phase === 1 && state.directPost.has(endpoint)) return clone(state.directPost.get(endpoint))
      if (direct.has(endpoint)) return clone(direct.get(endpoint))
      throw new Error(`unexpected synthetic GitHub endpoint: ${endpoint}`)
    }, readBuffer: async () => Buffer.from(state.artifactArchive) },
    clock: { nowIso: () => { state.trace.push('K'); return terminal ? fixture.terminal_evaluated_at : fixture.merge_evaluated_at } },
    collector: { runOnce: async () => { state.collectorCount += 1; state.trace.push('C'); return { exitCode: 0, stdout: state.collector.jcs, stderr: '' } } },
    artifact: { listMembers: async () => [...state.artifactEntries.keys()], readMember: async (_archive, name) => Buffer.from(state.artifactEntries.get(name)) },
    persistence: { persistExact: async (files) => { state.trace.push('P'); state.retainedFileCount = state.persistFailure ? 0 : files.length; return { ok: !state.persistFailure, retainedFileCount: state.retainedFileCount } } } }
  return { request, host, adapters, state }
}
const fixedObservation = (result, state) => ({ result: result.result,
  code: result.failure?.code ?? result.rejection_codes?.[0] ?? result.receipt?.rejection_codes?.[0] ?? null,
  collector: state.collectorCount, persistence: state.retainedFileCount, receipts: result.receipt_count, artifacts: result.admitted_artifact_count,
  mutations: state.mutationCount, trace: state.trace.join('>') })
const assertFixedUnit = (id, actual, expected) => {
  check(actual.result === expected.result, `${id} exact result`); check(actual.code === expected.code, `${id} exact stable code`)
  check(actual.collector === expected.collector, `${id} exact Collector count`); check(actual.persistence === expected.persistence, `${id} exact retained persistence count`)
  check(actual.receipts === expected.receipts, `${id} exact receipt count`); check(actual.artifacts === expected.artifacts, `${id} exact admitted artifact count`)
  check(actual.mutations === expected.mutations, `${id} exact mutation count`); check(actual.trace === expected.trace, `${id} exact ordered adapter trace: ${actual.trace}`)
}
const AT = 'JP0>JT0>JA0>JC0>JR0>JS0>JL0>C>JP1>JT1>JA1>JC1>JR1>JS1>JL1>K>P'
const runSyntheticUnit = async (id, options, expected) => {
  const harness = await buildSyntheticHarness(options)
  const result = await executeProtectedTransitionAdmissionV1(harness)
  const observed = fixedObservation(result, harness.state)
  assertFixedUnit(id, observed, expected)
  return { harness, result }
}
const acceptedTerminal = { result: 'accepted', code: null, collector: 1, persistence: 2, receipts: 1, artifacts: 1, mutations: 0, trace: AT }
const addRawTaskComment = (state, body, serial = 90) => {
  const url = `https://github.com/whatrune/sd-prompt-studio/issues/259#issuecomment-${7000000000 + serial}`
  const source = apiSource(url, body)
  state.taskCommentsPre.push(listedSource(source)); state.taskCommentsPost.push(listedSource(source)); state.extraDirect.push({ url, source })
}
const addRawAuthorityComment = (state, body, serial, author = 'whatrune') => {
  const url = `https://github.com/whatrune/sd-prompt-studio/issues/251#issuecomment-${7400000000 + serial}`
  const source = apiSource(url, body, { author })
  state.authorityComments.push(listedSource(source)); state.extraDirect.push({ url, source })
}
const TRUST_ROOT_REVOCATION_TYPE = 'phase_1_assignment_issuer_trust_root_revocation_v1'
const TRUST_ROOT_REVOCATION_ID = 'PTA-V1-PHASE-1-ASSIGNMENT-ISSUER-TRUST-ROOT'
const revocationBody = ({ representation, rootId = TRUST_ROOT_REVOCATION_ID, revision = 1 }) => {
  if (representation === 'json') return JSON.stringify({ record_type: TRUST_ROOT_REVOCATION_TYPE, trust_root_id: rootId, trust_root_revision: revision })
  if (representation === 'quoted_yaml') return `\`\`\`yaml\n"record_type": "${TRUST_ROOT_REVOCATION_TYPE}"\n"trust_root_id": "${rootId}"\n"trust_root_revision": ${revision}\n\`\`\``
  return `\`\`\`yaml\nrecord_type: ${TRUST_ROOT_REVOCATION_TYPE}\ntrust_root_id: ${rootId}\ntrust_root_revision: ${revision}\n\`\`\``
}
const addTerminalLeaf = async (state, effect, representation = 'json') => {
  const url = `https://github.com/whatrune/sd-prompt-studio/issues/259#issuecomment-${7100000000 + ['APPROVE', 'CHANGES_REQUIRED', 'BLOCKED', 'REVOKED', 'SUPERSEDED'].indexOf(effect)}`
  const record = await resealRecord({ record_type: 'terminal_review_admission_lineage_v1', canonical_record: url,
    lineage_id: 'synthetic-terminal-lineage-v1', revision: 1, predecessor_record_url: null, predecessor_record_digest: null, effect,
    api_author_login: fixture.actor_login, task_record_url: fixture.task_record_url, repository: fixture.repository, pr_number: fixture.pr_number,
    pr_url: fixture.pr_url, exact_head: fixture.exact_head, ready_generation_record_url: fixture.ready_generation.record_url,
    ready_generation_record_digest: state.ready.record_digest, ready_event_id: fixture.ready_generation.event_id,
    ready_occurred_at: fixture.ready_generation.occurred_at, transition: 'terminal_review_admission',
    assignment_record_url: state.assignment.canonical_record, assignment_record_digest: state.targets[2].bodyDigest,
    actor_login: fixture.actor_login, actor_role: 'Independent PR Reviewer', published_at: '2026-08-06T12:02:00Z',
    collector_artifact_digest: 'a'.repeat(64), accepted_receipts: [] })
  const body = sourceBody(record, representation)
  const source = apiSource(url, body, { createdAt: record.published_at })
  state.taskCommentsPre.push(listedSource(source)); state.taskCommentsPost.push(listedSource(source)); state.extraDirect.push({ url, record, source })
}
const p01Harness = await buildSyntheticHarness()
const p01Result = await executeProtectedTransitionAdmissionV1(p01Harness)
assertFixedUnit('P01', fixedObservation(p01Result, p01Harness.state), acceptedTerminal)
const terminalFixture = { harness: p01Harness, result: p01Result }
const AM = 'JP0>JT0>JA0>JC0>JR0>JS0>JL0>JW0>C>JP1>JT1>JA1>JC1>JR1>JS1>JL1>JW1>K>P'
await runSyntheticUnit('P02', { transition: 'merge_decision_admission', terminalFixture }, {
  result: 'accepted', code: null, collector: 1, persistence: 2, receipts: 1, artifacts: 1, mutations: 0, trace: AM,
})
await runSyntheticUnit('P03', { assignmentRepresentation: 'json' }, acceptedTerminal)
await runSyntheticUnit('P04', { assignmentRepresentation: 'yaml' }, acceptedTerminal)
await runSyntheticUnit('P05', { mutate: async (state) => addRawTaskComment(state, 'unrelated prose without authority', 91) }, acceptedTerminal)

const revokedBeforeCollector = {
  result: 'rejected', code: 'trust_root_revoked', collector: 0, persistence: 1, receipts: 1, artifacts: 0, mutations: 0,
  trace: 'JP0>JT0>JA0>P',
}
const malformedRevocationBeforeCollector = {
  result: 'failed', code: 'acquisition_or_collector_failed', collector: 0, persistence: 0, receipts: 0, artifacts: 0, mutations: 0,
  trace: 'JP0>JT0>JA0',
}
await runSyntheticUnit('R01', { mutate: async (state) => addRawAuthorityComment(state, revocationBody({ representation: 'unquoted_yaml' }), 1) }, revokedBeforeCollector)
await runSyntheticUnit('R02', { mutate: async (state) => addRawAuthorityComment(state, revocationBody({ representation: 'quoted_yaml' }), 2) }, revokedBeforeCollector)
await runSyntheticUnit('R03', { mutate: async (state) => addRawAuthorityComment(state, revocationBody({ representation: 'json' }), 3) }, revokedBeforeCollector)
await runSyntheticUnit('R04', { mutate: async (state) => addRawAuthorityComment(state,
  `\`\`\`yaml\nrecord_type: ${TRUST_ROOT_REVOCATION_TYPE}\ntrust_root_id: [\n\`\`\``, 4) }, malformedRevocationBeforeCollector)
await runSyntheticUnit('R05', { mutate: async (state) => addRawAuthorityComment(state,
  `\`\`\`yaml\n"record_type": "${TRUST_ROOT_REVOCATION_TYPE}"\n"trust_root_id": [\n\`\`\``, 5) }, malformedRevocationBeforeCollector)
await runSyntheticUnit('R06', { mutate: async (state) => addRawAuthorityComment(state,
  `{"record_type":"${TRUST_ROOT_REVOCATION_TYPE}",`, 6) }, malformedRevocationBeforeCollector)
await runSyntheticUnit('R07', { mutate: async (state) => addRawAuthorityComment(state,
  `\`\`\`yaml\nrecord_type: ${TRUST_ROOT_REVOCATION_TYPE}\nrecord_type: ${TRUST_ROOT_REVOCATION_TYPE}\ntrust_root_id: ${TRUST_ROOT_REVOCATION_ID}\ntrust_root_revision: 1\n\`\`\``, 7) }, malformedRevocationBeforeCollector)
await runSyntheticUnit('R08', { mutate: async (state) => addRawAuthorityComment(state,
  `${revocationBody({ representation: 'unquoted_yaml' })}\n\n\`\`\`yaml\nrecord_type: ordinary_record_v1\n\`\`\``, 8) }, malformedRevocationBeforeCollector)
await runSyntheticUnit('R09', { mutate: async (state) => addRawAuthorityComment(state,
  `record_type: ${TRUST_ROOT_REVOCATION_TYPE}\n\n\`\`\`yaml\nrecord_type: ordinary_record_v1\n\`\`\``, 9) }, malformedRevocationBeforeCollector)
await runSyntheticUnit('R10', { mutate: async (state) => addRawAuthorityComment(state, revocationBody({ representation: 'json' }), 10, 'untrusted-reviewer') }, acceptedTerminal)
await runSyntheticUnit('R11', { mutate: async (state) => addRawAuthorityComment(state,
  revocationBody({ representation: 'unquoted_yaml', rootId: 'WRONG-TRUST-ROOT' }), 11) }, acceptedTerminal)
await runSyntheticUnit('R12', { mutate: async (state) => addRawAuthorityComment(state,
  revocationBody({ representation: 'json', revision: 2 }), 12) }, acceptedTerminal)
await runSyntheticUnit('R13', { mutate: async (state) => addRawTaskComment(state, JSON.stringify({
  record_type: TRUST_ROOT_REVOCATION_TYPE, trust_root_id: TRUST_ROOT_REVOCATION_ID, trust_root_revision: 1,
  repository: 'other/repository', parent_issue: 'https://github.com/whatrune/sd-prompt-studio/issues/250',
  contract: 'other-contract', assignment_record_types: ['other_assignment_v1'],
}), 93) }, acceptedTerminal)
await runSyntheticUnit('R14', { mutate: async (state) => {
  addRawAuthorityComment(state, '{"record_type":"ordinary_record_v1"}', 14)
  addRawAuthorityComment(state, '\`\`\`yaml\n"record_type": "ordinary_record_v1"\n\`\`\`', 15)
} }, acceptedTerminal)

for (const [id, effect] of [['T01', 'APPROVE'], ['T02', 'CHANGES_REQUIRED'], ['T03', 'BLOCKED'], ['T04', 'REVOKED'], ['T05', 'SUPERSEDED']]) {
  await runSyntheticUnit(id, { mutate: async (state) => await addTerminalLeaf(state, effect) }, {
    result: 'rejected', code: 'protected_event_order_invalid', collector: 0, persistence: 1, receipts: 1, artifacts: 0, mutations: 0,
    trace: 'JP0>JT0>JA0>JC0>JR0>JS0>JL0>P',
  })
}
await runSyntheticUnit('T15', { mutate: async (state) => addRawTaskComment(state, '```yaml\nrecord_type: terminal_review_admission_lineage_v1\nrevision: [\n```', 92) }, {
  result: 'failed', code: 'acquisition_or_collector_failed', collector: 0, persistence: 0, receipts: 0, artifacts: 0, mutations: 0,
  trace: 'JP0>JT0>JA0>JC0',
})
const replaceTerminalLineage = async (state, changes) => {
  const priorUrl = state.terminalLineage.url
  const projection = { ...state.terminalLineage.record, ...changes }; delete projection.record_digest
  const record = await resealRecord(projection); const body = sourceBody(record, 'json')
  const source = apiSource(record.canonical_record, body, { createdAt: record.published_at })
  Object.assign(state.terminalLineage, { url: record.canonical_record, record, body, source })
  for (const key of ['taskCommentsPre', 'taskCommentsPost']) state[key] = state[key].map((row) => row.html_url === priorUrl ? listedSource(source) : row)
}
const addLineageSuccessor = async (state, { serial, revision = 2, lineageId = fixture.terminal_review_lineage_id, predecessor = state.terminalLineage.url, predecessorDigest = null, effect = 'APPROVE' }) => {
  const url = `https://github.com/whatrune/sd-prompt-studio/issues/259#issuecomment-${7200000000 + serial}`
  const base = state.terminalLineage.record
  const record = await resealRecord({ ...base, canonical_record: url, lineage_id: lineageId, revision,
    predecessor_record_url: predecessor, predecessor_record_digest: predecessor === null ? null : (predecessorDigest ?? await sha256ReadyReviewObservationV1(state.terminalLineage.body)),
    effect, published_at: new Date(Date.parse(base.published_at) + serial * 1000).toISOString() })
  const body = sourceBody(record, 'json'); const source = apiSource(url, body, { createdAt: record.published_at })
  state.taskCommentsPre.push(listedSource(source)); state.taskCommentsPost.push(listedSource(source)); state.extraDirect.push({ url, record, source })
}
const mergeReject = (code) => ({ result: 'rejected', code, collector: 0, persistence: 1, receipts: 1, artifacts: 0, mutations: 0,
  trace: 'JP0>JT0>JA0>JC0>JR0>JS0>JL0>P' })
await runSyntheticUnit('T06', { transition: 'merge_decision_admission', terminalFixture, mutate: async (state) => await addLineageSuccessor(state, { serial: 1 }) }, mergeReject('terminal_lineage_candidate_not_current_leaf'))
await runSyntheticUnit('T07', { transition: 'merge_decision_admission', terminalFixture, mutate: async (state) => await replaceTerminalLineage(state, { effect: 'CHANGES_REQUIRED' }) }, mergeReject('terminal_lineage_leaf_not_approve'))
await runSyntheticUnit('T08', { transition: 'merge_decision_admission', terminalFixture, mutate: async (state) => await addLineageSuccessor(state, { serial: 3, revision: 3 }) }, mergeReject('terminal_lineage_gapped'))
await runSyntheticUnit('T09', { transition: 'merge_decision_admission', terminalFixture, mutate: async (state) => { await addLineageSuccessor(state, { serial: 4 }); await addLineageSuccessor(state, { serial: 5 }) } }, mergeReject('terminal_lineage_forked'))
await runSyntheticUnit('T10', { transition: 'merge_decision_admission', terminalFixture, mutate: async (state) => await replaceTerminalLineage(state, { predecessor_record_url: state.terminalLineage.url, predecessor_record_digest: await sha256ReadyReviewObservationV1(state.terminalLineage.body) }) }, mergeReject('terminal_lineage_chain_invalid'))
await runSyntheticUnit('T11', { transition: 'merge_decision_admission', terminalFixture, mutate: async (state) => await addLineageSuccessor(state, { serial: 6, lineageId: 'disconnected-lineage' }) }, mergeReject('terminal_lineage_disconnected'))
await runSyntheticUnit('T12', { transition: 'merge_decision_admission', terminalFixture, mutate: async (state) => { await addLineageSuccessor(state, { serial: 7 }); await addLineageSuccessor(state, { serial: 8 }) } }, mergeReject('terminal_lineage_forked'))
await runSyntheticUnit('T13', { transition: 'merge_decision_admission', terminalFixture, mutate: async (state) => { state.taskCommentsPre.push(listedSource(state.terminalLineage.source)); state.taskCommentsPost.push(listedSource(state.terminalLineage.source)) } }, mergeReject('terminal_lineage_duplicate_url'))
await runSyntheticUnit('T14', { transition: 'merge_decision_admission', terminalFixture, mutate: async (state) => await addLineageSuccessor(state, { serial: 9, predecessor: null }) }, mergeReject('terminal_lineage_multiple_leaf'))

await runSyntheticUnit('L01', { mutate: async (state) => { state.prPre.state = 'closed' } }, {
  result: 'rejected', code: 'current_pr_not_open', collector: 0, persistence: 1, receipts: 1, artifacts: 0, mutations: 0, trace: 'JP0>P',
})
await runSyntheticUnit('L02', { mutate: async (state) => { state.prPre.draft = true } }, {
  result: 'rejected', code: 'current_pr_is_draft', collector: 0, persistence: 1, receipts: 1, artifacts: 0, mutations: 0, trace: 'JP0>P',
})
await runSyntheticUnit('L03', { mutate: async (state) => { state.prPost.state = 'closed' } }, {
  result: 'rejected', code: 'current_pr_lifecycle_drift', collector: 1, persistence: 1, receipts: 1, artifacts: 0, mutations: 0,
  trace: 'JP0>JT0>JA0>JC0>JR0>JS0>JL0>C>JP1>P',
})
await runSyntheticUnit('L04', { mutate: async (state) => { state.prPost.base.sha = '3'.repeat(40) } }, {
  result: 'rejected', code: 'mutable_authority_snapshot_drift', collector: 1, persistence: 1, receipts: 1, artifacts: 0, mutations: 0,
  trace: 'JP0>JT0>JA0>JC0>JR0>JS0>JL0>C>JP1>P',
})
await runSyntheticUnit('L05', { mutate: async (state) => { delete state.prPre.draft } }, {
  result: 'failed', code: 'acquisition_or_collector_failed', collector: 0, persistence: 0, receipts: 0, artifacts: 0, mutations: 0, trace: 'JP0',
})

await runSyntheticUnit('D01', { mutate: async (state) => await addTerminalLeaf(state, 'REVOKED', 'json') }, {
  result: 'rejected', code: 'protected_event_order_invalid', collector: 0, persistence: 1, receipts: 1, artifacts: 0, mutations: 0,
  trace: 'JP0>JT0>JA0>JC0>JR0>JS0>JL0>P',
})
await runSyntheticUnit('D02', { mutate: async (state) => await addTerminalLeaf(state, 'SUPERSEDED', 'yaml') }, {
  result: 'rejected', code: 'protected_event_order_invalid', collector: 0, persistence: 1, receipts: 1, artifacts: 0, mutations: 0,
  trace: 'JP0>JT0>JA0>JC0>JR0>JS0>JL0>P',
})
await runSyntheticUnit('D03', { assignmentStatus: 'revoked', assignmentRepresentation: 'json' }, {
  result: 'rejected', code: 'assignment_revoked', collector: 0, persistence: 1, receipts: 1, artifacts: 0, mutations: 0,
  trace: 'JP0>JT0>JA0>JC0>JR0>JS0>P',
})
const discoveryFailures = [
  ['D04', '```yaml\nrecord_type: terminal_review_actor_assignment_v1\nrevision: [\n```'],
  ['D05', '```yaml\nrecord_type: terminal_review_actor_assignment_v1\nrecord_type: terminal_review_actor_assignment_v1\n```'],
  ['D06', '```yaml\nrecord_type: terminal_review_actor_assignment_v1\n```\n```json\n{"record_type":"out_of_scope"}\n```'],
  ['D07', '```json\n{"record_type":"out_of_scope"}\n```\n```yaml\nrecord_type: terminal_review_actor_assignment_v1\n```'],
  ['D08', '```yaml\nrecord_type: terminal_review_actor_assignment_v1\n```\n```json\n{"record_type":"terminal_review_actor_assignment_v1"}\n```'],
  ['D09', '{"record_\\u0074ype":"terminal_review_admission_lineage_v1","note":"\\nrecord_type: terminal_review_actor_assignment_v1\\n"}'],
  ['D10', '{"record_\\u0074ype":"terminal_review_actor_assignment_v1"}'],
]
for (const [id, body] of discoveryFailures) await runSyntheticUnit(id, { mutate: async (state) => addRawTaskComment(state, body, 100 + Number(id.slice(1))) }, {
  result: 'failed', code: 'acquisition_or_collector_failed', collector: 0, persistence: 0, receipts: 0, artifacts: 0, mutations: 0,
  trace: 'JP0>JT0>JA0>JC0',
})

const mergePre = 'JP0>JT0>JA0>JC0>JR0>JS0>JL0>JW0'
await runSyntheticUnit('W01', { transition: 'merge_decision_admission', terminalFixture }, { result: 'accepted', code: null, collector: 1, persistence: 2, receipts: 1, artifacts: 1, mutations: 0, trace: AM })
await runSyntheticUnit('W02', { transition: 'merge_decision_admission', terminalFixture, mutate: async (state) => { state.workflowRunHeadSha = '3'.repeat(40) } }, {
  result: 'rejected', code: 'terminal_workflow_revision_mismatch', collector: 0, persistence: 1, receipts: 1, artifacts: 0, mutations: 0, trace: `${mergePre}>P`,
})
const resealAdmissionReceipt = async (receipt) => {
  const projection = { ...receipt }; delete projection.admission_digest
  return { ...projection, admission_digest: await digestReadyReviewObservationProjectionV1(projection) }
}
const staleTerminalFixture = { harness: terminalFixture.harness, result: clone(terminalFixture.result) }
staleTerminalFixture.result.receipt = await resealAdmissionReceipt({ ...staleTerminalFixture.result.receipt, workflow_sha: '3'.repeat(40) })
await runSyntheticUnit('W03', { transition: 'merge_decision_admission', terminalFixture: staleTerminalFixture }, {
  result: 'rejected', code: 'terminal_workflow_revision_mismatch', collector: 0, persistence: 1, receipts: 1, artifacts: 0, mutations: 0, trace: `${mergePre}>P`,
})
const w04Input = clone(mergeInput)
w04Input.terminal_review.accepted_receipts[0] = await resealAdmissionReceipt({ ...w04Input.terminal_review.accepted_receipts[0], workflow_sha: '3'.repeat(40) })
w04Input.terminal_review.receipt_jcs_sha256 = await sha256ReadyReviewObservationV1(canonicalizeReadyReviewObservationJcsV1(w04Input.terminal_review.accepted_receipts[0]))
w04Input.terminal_review = await resealTerminal(w04Input.terminal_review)
const w04Result = await evaluateProtectedTransitionAdmissionV1(w04Input)
assertFixedUnit('W04', { ...fixedObservation(w04Result, { collectorCount: 0, retainedFileCount: 0, mutationCount: 0, trace: [] }), trace: '' }, {
  result: 'rejected', code: 'terminal_workflow_revision_mismatch', collector: 0, persistence: 0, receipts: 1, artifacts: 0, mutations: 0, trace: '',
})
await runSyntheticUnit('W05', { transition: 'merge_decision_admission', terminalFixture, mutate: async (state) => {
  const malformed = { ...terminalFixture.result.receipt, workflow_sha: 'malformed' }
  state.artifactArchive = buildStoredZip({ [PROTECTED_TRANSITION_RECEIPT_FILE_V1]: canonicalizeReadyReviewObservationJcsV1(malformed), [PROTECTED_TRANSITION_COLLECTOR_FILE_V1]: terminalFixture.harness.state.collector.jcs })
  state.artifactEntries = readStoredZipEntries(state.artifactArchive)
} }, { result: 'failed', code: 'acquisition_or_collector_failed', collector: 0, persistence: 0, receipts: 0, artifacts: 0, mutations: 0, trace: mergePre })

const replacePostRow = (state, url, source) => { state.taskCommentsPost = state.taskCommentsPost.map((row) => row.html_url === url ? listedSource(source) : row) }
const updatePostTarget = async (state, index, { recordChanges = {}, representation = null } = {}) => {
  const original = state.targets[index]
  const projection = { ...original.record, ...recordChanges }; delete projection.record_digest
  const record = await resealRecord(projection)
  const body = sourceBody(record, representation ?? (original.body.startsWith('```') ? 'yaml' : 'json'))
  const createdAt = record.issued_at ?? original.source.created_at
  const source = apiSource(original.url, body, { createdAt, updatedAt: createdAt })
  const target = { ...original, record, body, bodyDigest: await sha256ReadyReviewObservationV1(body), source }
  const binding = await makeSyntheticBinding(target, state.taskDigest, index + 1, index === 2 && state.transition === 'merge_decision_admission' ? 'Product Owner' : 'Integrated Lead')
  replacePostRow(state, original.url, source); replacePostRow(state, state.bindings[index].url, binding.source)
  state.directPost.set(`repos/${fixture.repository}/issues/comments/${commentId(original.url)}`, source)
  state.directPost.set(`repos/${fixture.repository}/issues/comments/${commentId(binding.url)}`, binding.source)
}
const postTerminalChange = async (state, changes) => {
  const projection = { ...state.terminalLineage.record, ...changes }; delete projection.record_digest
  const record = await resealRecord(projection); const body = sourceBody(record, 'json'); const source = apiSource(record.canonical_record, body, { createdAt: record.published_at })
  replacePostRow(state, state.terminalLineage.url, source)
  state.directPost.set(`repos/${fixture.repository}/issues/comments/${commentId(state.terminalLineage.url)}`, source)
}
const driftAt = (trace) => ({ result: 'rejected', code: 'mutable_authority_snapshot_drift', collector: 1, persistence: 1, receipts: 1, artifacts: 0, mutations: 0, trace })
const PRE_C = 'JP0>JT0>JA0>JC0>JR0>JS0>JL0>C'
await runSyntheticUnit('M01', { mutate: async (state) => await updatePostTarget(state, 2, { recordChanges: { issued_at: '2026-08-06T12:01:01Z' } }) }, driftAt(`${PRE_C}>JP1>JT1>JA1>JC1>JR1>JS1>P`))
await runSyntheticUnit('M02', { mutate: async (state) => await updatePostTarget(state, 2, { recordChanges: { issued_at: '2026-08-06T12:01:02Z' } }) }, driftAt(`${PRE_C}>JP1>JT1>JA1>JC1>JR1>JS1>P`))
await runSyntheticUnit('M03', { transition: 'merge_decision_admission', terminalFixture, mutate: async (state) => await postTerminalChange(state, { effect: 'REVOKED' }) },
  driftAt(`${mergePre}>C>JP1>JT1>JA1>JC1>JR1>JS1>JL1>P`))
await runSyntheticUnit('M04', { transition: 'merge_decision_admission', terminalFixture, mutate: async (state) => {
  const base = state.terminalLineage.record; const url = 'https://github.com/whatrune/sd-prompt-studio/issues/259#issuecomment-7300000004'
  const record = await resealRecord({ ...base, canonical_record: url, revision: 2, predecessor_record_url: state.terminalLineage.url,
    predecessor_record_digest: await sha256ReadyReviewObservationV1(state.terminalLineage.body), published_at: '2026-08-05T10:12:01Z' })
  const body = sourceBody(record, 'json'); const source = apiSource(url, body, { createdAt: record.published_at })
  state.taskCommentsPost.push(listedSource(source)); state.extraDirect.push({ url, record, source })
} }, driftAt(`${mergePre}>C>JP1>JT1>JA1>JC1>JR1>JS1>JL1>P`))
await runSyntheticUnit('M05', { mutate: async (state) => await updatePostTarget(state, 1, { representation: 'yaml' }) },
  driftAt(`${PRE_C}>JP1>JT1>JA1>JC1>JR1>P`))
await runSyntheticUnit('M06', { mutate: async (state) => {
  const duplicate = await makeSyntheticBinding(state.targets[1], state.taskDigest, 22, 'Integrated Lead')
  state.taskCommentsPost.push(listedSource(duplicate.source)); state.extraDirect.push(duplicate)
} }, driftAt(`${PRE_C}>JP1>JT1>JA1>JC1>P`))
await runSyntheticUnit('M07', { mutate: async (state) => { state.taskCommentsPost = state.taskCommentsPost.filter((row) => row.html_url !== state.bindings[1].url) } },
  driftAt(`${PRE_C}>JP1>JT1>JA1>JC1>P`))
await runSyntheticUnit('M08', { mutate: async (state) => await updatePostTarget(state, 1, { representation: 'yaml' }) },
  driftAt(`${PRE_C}>JP1>JT1>JA1>JC1>JR1>P`))
await runSyntheticUnit('M09', { mutate: async (state) => {
  const url = 'https://github.com/whatrune/sd-prompt-studio/issues/259#issuecomment-7300000009'; const source = apiSource(url, '```yaml\nrecord_type: canonical_finalization_binding_v1\nbinding_id: [\n```')
  state.taskCommentsPost.push(listedSource(source)); state.extraDirect.push({ url, source })
} }, { result: 'failed', code: 'acquisition_or_collector_failed', collector: 1, persistence: 0, receipts: 0, artifacts: 0, mutations: 0,
  trace: `${PRE_C}>JP1>JT1>JA1>JC1` })
await runSyntheticUnit('M10', { mutate: async (state) => { state.taskBodyPost = `${SYNTHETIC_TASK_BODY}\n` } }, driftAt(`${PRE_C}>JP1>JT1>P`))
await runSyntheticUnit('M11', { mutate: async (state) => { state.postCommentsFailure = true } }, {
  result: 'failed', code: 'acquisition_or_collector_failed', collector: 1, persistence: 0, receipts: 0, artifacts: 0, mutations: 0,
  trace: `${PRE_C}>JP1>JT1>JA1>JC1`,
})

await runSyntheticUnit('X01', { mutate: async (state) => { state.persistFailure = true } }, {
  result: 'failed', code: 'persistence_failed', collector: 1, persistence: 0, receipts: 0, artifacts: 0, mutations: 0, trace: AT,
})
await runSyntheticUnit('X02', { mutate: async (state) => { state.prPre.state = 'closed'; state.persistFailure = true } }, {
  result: 'failed', code: 'persistence_failed', collector: 0, persistence: 0, receipts: 0, artifacts: 0, mutations: 0, trace: 'JP0>P',
})
await runSyntheticUnit('X03', { mutate: async (state) => { state.prPost.base.sha = '3'.repeat(40); state.persistFailure = true } }, {
  result: 'failed', code: 'persistence_failed', collector: 1, persistence: 0, receipts: 0, artifacts: 0, mutations: 0,
  trace: 'JP0>JT0>JA0>JC0>JR0>JS0>JL0>C>JP1>P',
})

console.log(`Protected Transition Admission V1: ${assertions} assertions passed`)
