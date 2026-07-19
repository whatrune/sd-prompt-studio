# Binding Set Semantic Validation Policy

Status: Design review candidate

Task: `ARCH-BINDING-SET-SEMANTIC-VALIDATION-001`

Canonical assignment: [GitHub Issue #117](https://github.com/whatrune/sd-prompt-studio/issues/117)

Target logical contract: `deployment_binding_set_v1`

## 1. Purpose

This document defines semantic validation for a set of structurally valid Deployment Binding Records before that set can be used by a future Deployment Resolver.

The policy prevents ambiguous selection, duplicate lineage, invalid fallback graphs, capability downgrade, unreproducible snapshots, and unapproved or stale Binding use without changing existing Model Routing, Deployment Binding Record, dispatch, Role, Execution Request, Result Handoff, Runner, or research contracts.

This task is design only. It does not implement a Binding Set Schema, Semantic Validator, Resolver, provider connection, Runner integration, registry, database, or hash.

## 2. Normative sources

This policy is subordinate to:

- [AI Model Routing Policy](12-model-routing-policy.md)
- [Deployment Binding Policy](14-deployment-binding-policy.md)
- [Deployment Binding Schema Design](15-deployment-binding-schema-design.md)
- [Deployment Binding Record JSON Schema](../../src/deployment-binding/deployment-binding.schema.json)
- [Runner Provisioning Architecture Design](10-runner-provisioning-design.md)
- [Delegation and Result Contract](../team/11-delegation-and-result-contract.md)

PR #116 implements structural validation for one Deployment Binding Record. Its accepted `DeploymentBinding` value is a precondition for this policy, not a substitute for set-level validation.

If this document conflicts with a normative source, the source remains authoritative and this design returns to Architect review.

## 3. Scope

This policy defines:

- the logical Binding Set and Snapshot boundary;
- validation preconditions and evaluation order;
- membership, duplicate, and lineage rules;
- Resolver scope and priority uniqueness;
- tier, reasoning, capability, and compatibility rules;
- fallback graph validity;
- lifecycle, approval, evidence, and effective-time rules;
- fail-closed behavior and future diagnostics;
- implementation acceptance criteria and test design.

## 4. Non-goals

This policy does not:

- change or reimplement single-record structural validation;
- add a JSON Schema or modify the Deployment Binding Record Schema;
- persist a Binding Set or validation result;
- fetch GitHub, evidence, provider, model, monitoring, or availability data;
- implement a Resolver, provider adapter, Runner, API, CLI, workflow, or dispatcher;
- select a concrete provider, model, deployment, or credential mechanism;
- add a dispatch or Result Handoff status;
- authorize fallback across provider or security boundaries;
- calculate a content hash or Artifact hash.

## 5. Responsibility boundary

### 5.1 Single Record Validation

PR #116 remains responsible for one Deployment Binding Record:

- required and unknown fields;
- primitive type, format, enum, timestamp, and reference shape;
- exact-version and secret-bearing field restrictions;
- lifecycle-dependent field presence;
- within-record reasoning, context, tool, and response consistency;
- duplicate values inside one array;
- exact direct self-fallback;
- revision-candidate checks against explicitly supplied lineage history;
- returning an accepted deeply frozen Record.

Set validation must not accept an unvalidated raw object and attempt to repair it.

### 5.2 Binding Set Semantic Validation

This policy is responsible for relationships that require multiple accepted Records or trusted external verification results:

- exact Snapshot membership;
- duplicate lineage and deployment identity;
- shared routing and resolution scope;
- priority uniqueness;
- capability-floor consistency;
- fallback existence, cycle, downgrade, and boundary checks;
- approval, evidence, effective-time, and lifecycle eligibility;
- Resolver candidate determinism.

### 5.3 Deployment Resolver

The future Resolver consumes only a successfully validated Binding Set Snapshot plus trusted runtime inputs. Resolver does not repair, reinterpret, or partially accept an invalid set.

This policy does not implement Resolver selection.

## 6. Binding Set definition

A Binding Set is an immutable, approved Snapshot of exact Deployment Binding Record revisions that can be evaluated within one Resolver context.

The proposed logical Set envelope contains:

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `contract_version` | string constant | yes | Fixed to `deployment_binding_set_v1` |
| `binding_set_id` | opaque identifier | yes | Stable identity for one routing and resolution-scope lineage |
| `binding_set_revision` | positive integer | yes | Immutable Snapshot revision |
| `routing_contract_version` | string | yes | Exact Model Routing Contract version shared by all members |
| `resolution_scope_ref` | versioned reference | yes | Exact Resolver scope shared by all members |
| `included_binding_refs` | non-empty unique list | yes | Exact `(binding_id, binding_revision)` membership |
| `created_at` | RFC 3339 UTC timestamp | yes | Snapshot creation time |
| `effective_from` | RFC 3339 UTC timestamp | yes | Earliest time the approved Snapshot can be evaluated |
| `review_due_at` | RFC 3339 UTC timestamp | yes | Evidence and approval review boundary |
| `approval_owner` | existing authority identifier | yes | Existing Product Owner or Architect authority |
| `approval_record` | canonical reference | yes | Approval of the exact Set revision and membership |
| `supersedes` | exact Set revision reference | no | Prior Snapshot replaced by this Snapshot |
| `change_reason` | non-empty string | yes | Reason for this Snapshot revision |

This is a logical design, not a JSON Schema or persistent Artifact implementation.

### 6.1 Set lineage

`binding_set_id` identifies one stable combination of:

- Model Routing Contract lineage;
- Resolver scope;
- security and deployment-governance boundary.

Changing any of those creates a new `binding_set_id`. Changing membership, member revision, priority through a member revision, approval, evidence boundary, or effective period creates a new `binding_set_revision`.

An approved Set revision is immutable. Revision numbers are positive, strictly increasing, never reused, and never selected through a floating `latest` alias.

### 6.2 Included Binding references

Each member reference contains exactly:

```text
binding_id
binding_revision
```

Membership is exact. Every reference must resolve to one accepted Record, and every Record supplied for validation must be referenced exactly once. Unreferenced extra Records are rejected rather than ignored.

List order has no selection meaning. A future serialized representation must use canonical ordering by `binding_id`, then numeric `binding_revision`, so equivalent membership does not depend on input order.

## 7. Validation inputs and preconditions

Semantic validation requires:

- one logically valid Binding Set envelope;
- the exact Record collection referenced by the Snapshot;
- a successful PR #116 structural-validation result for every Record;
- a fixed UTC `evaluation_time`;
- evidence-verification results supplied by an approved external boundary;
- approval-verification results supplied by an approved external boundary;
- when runtime eligibility is requested, an identified live-availability Snapshot supplied by an approved external boundary.

Evidence, approval, and availability verification inputs are read-only facts. This policy neither fetches nor creates them.

If any precondition is missing, ambiguous, untrusted, or structurally invalid, semantic validation does not partially continue. The set is not Resolver-eligible.

## 8. Validation order

The future validator must evaluate in this order:

1. validate the Set envelope structurally under its future Schema;
2. resolve exact membership and reject missing or extra Records;
3. confirm every Record passed PR #116 structural validation;
4. validate Set identity, revision, approval, and effective-time boundary;
5. validate duplicate, lineage, and deployment-identity rules;
6. validate shared routing and resolution scope;
7. validate lifecycle, approval, and evidence eligibility;
8. validate tier and capability-floor consistency;
9. validate priority uniqueness;
10. validate the complete fallback graph;
11. produce one atomic valid or invalid result.

Later stages do not run after an earlier prerequisite fails. Diagnostic collection within the same completed stage may continue when doing so cannot reinterpret invalid input.

## 9. Duplicate and lineage rules

### 9.1 Exact reference duplication

The same `(binding_id, binding_revision)` appearing more than once in `included_binding_refs` is invalid.

The same Record supplied more than once under duplicate object or path inputs is also invalid even if the Set list itself is unique.

### 9.2 Binding lineage duplication

One Binding Set Snapshot may contain at most one revision for each `binding_id`.

The following is invalid:

```text
deployment_binding.alpha @ revision 2
deployment_binding.alpha @ revision 3
```

A Snapshot represents current Resolver candidates, not lineage history. Historical revisions remain outside current membership.

The same numeric `binding_revision` used by different `binding_id` values is valid because revision numbers are lineage-local. For example, revision `1` can exist in every new Binding lineage.

### 9.3 Deployment identity collision

Within one logical tier and resolution scope, two different `binding_id` values must not identify the same tuple:

```text
provider_id
model_family
model_version
deployment_id
```

Such duplication creates two policy identities for one concrete candidate and is invalid.

The same concrete deployment can be represented for different logical tiers only through separate Binding lineages whose tier-specific evidence, reasoning floor, priority, and approval are explicit. Resolver never infers cross-tier equivalence from deployment identity.

## 10. Shared scope rules

Every included Record must satisfy:

- `tier_binding.routing_contract_version` equals the Set `routing_contract_version`;
- `resolution.resolution_scope_ref` equals the Set `resolution_scope_ref`;
- the Record contract version is supported by the future validator;
- the Record belongs to the security and governance boundary approved for the Set.

A Binding Set can contain multiple logical tiers, but it cannot mix different routing-contract versions or resolution scopes.

Changing scope by fallback or Resolver inference is prohibited.

## 11. Tier and capability-floor rules

### 11.1 Ordered floors

Semantic comparison uses these existing orders only:

```text
efficient < general < advanced
low < medium < high
standard < high
```

The final order applies only to fields whose approved vocabulary is `standard` and `high`, such as reliability or availability requirement. Cost and latency classes are not capability orders.

### 11.2 Floor consistency

Within the same `routing_contract_version` and `logical_tier`, every member must use the same `capability_floor_ref`.

Different floor references for the same tier make the Set invalid because Resolver cannot determine which tier definition is authoritative.

Each member must also satisfy the within-record rule that its `required_reasoning_level` is supported by its declared capability set. PR #116 enforces the local relationship; set validation relies on the accepted Record and compares it across fallback edges.

### 11.3 No downgrade

No semantic rule may treat a lower tier or lower reasoning level as an equivalent candidate.

In particular:

- an `advanced` source cannot fall back to `general` or `efficient`;
- a `general` source cannot fall back to `efficient`;
- `high` reasoning cannot fall back to `medium` or `low`;
- cost, latency, usage, or temporary availability cannot lower a floor;
- Resolver cannot use a higher priority number to justify a capability downgrade.

## 12. Priority ambiguity rules

### 12.1 Resolution domain

Priority uniqueness is evaluated within this domain:

```text
routing_contract_version
resolution_scope_ref
logical_tier
```

### 12.2 Uniqueness rule

Every Resolver-eligible Record in the same resolution domain must have a unique `selection_priority`.

Two approved candidates with priority `100` in the same domain are invalid even if their Runner, adapter, response, tool, sandbox, network, cost, or latency profiles differ.

This conservative rule prevents runtime conditions from accidentally becoming the tie-breaker. A future Contract version may define disjoint candidate partitions, but v1 does not.

### 12.3 Priority meaning

Lower numeric value has higher priority. Priority is compared only after all capability, compatibility, governance, evidence, and live-availability filters succeed.

Priority does not:

- change tier or reasoning floor;
- authorize fallback;
- override lifecycle or approval;
- resolve duplicate identity;
- use file, array, creation-time, or revision order as a secondary tie-breaker.

Any equal highest-priority result fails closed. The validator must detect the static collision before Resolver use.

## 13. Fallback graph rules

Treat every included Binding revision as a graph node and each ordered `fallback_binding_refs` entry as a directed edge.

### 13.1 Reference validity

Every fallback target must:

- be an exact member of the same Binding Set Snapshot;
- resolve to exactly one structurally valid Record;
- not be the source node;
- not repeat another target in the same ordered list;
- be lifecycle- and evidence-eligible under this policy.

Unknown, missing, extra, floating, or historical-only references are invalid.

### 13.2 Cycle prohibition

The complete graph must be acyclic.

Invalid examples include:

```text
A -> B -> A
```

```text
A -> B -> C -> A
```

Cycle detection is global. Direct self-reference detection in PR #116 does not replace set-level graph validation.

### 13.3 Provider and scope boundary

For `deployment_binding_set_v1`, source and fallback target must have:

- the same `provider_id`;
- the same `routing_contract_version`;
- the same `resolution_scope_ref`;
- compatible security, sandbox, network, Runner, adapter, tool, and response boundaries.

Cross-provider fallback is invalid even when another provider declares equal or higher capability. Provider migration requires a separately approved Binding and human-controlled re-resolution.

### 13.4 Capability monotonicity

For each fallback edge, target must meet or exceed source:

- logical tier rank;
- required reasoning rank;
- source required reasoning support;
- `usable_input_limit_tokens`;
- reliability class;
- availability requirement.

Target compatibility and capability sets must contain every exact profile needed by the source execution boundary:

- execution adapter contract versions;
- Runner profiles;
- sandbox profiles;
- network policies;
- tool profiles;
- structured-output profiles;
- response profiles.

Cost and latency may be higher. They cannot justify a lower capability or security boundary.

### 13.5 Ordered fallback

Fallback list order is significant only after the graph is valid. The future Resolver evaluates targets in the approved order and still applies live availability and compatibility checks.

Semantic validation does not execute fallback, retry, or Provider API calls.

## 14. Snapshot reproducibility

### 14.1 Snapshot identity

The logical Snapshot identity is:

```text
(contract_version, binding_set_id, binding_set_revision)
```

Reproducibility additionally requires the exact canonically ordered `included_binding_refs`, Set approval record, effective-time boundary, and each immutable member Record identity.

Set identity alone is not a content-integrity proof. This policy defines no hash.

### 14.2 Revision relation

A new Set revision is required when any of these change:

- membership or member revision;
- routing contract or resolution scope;
- Set approval or evidence boundary;
- effective or review date;
- supersession relation;
- any selected Record priority or fallback graph through a member revision.

The new revision must be greater than every prior revision in the same Set lineage and must not reuse a prior number. An approved Snapshot is never edited in place.

### 14.3 Resolver audit boundary

A future Resolver execution must pin:

- Binding Set identity tuple;
- exact selected Binding identity tuple;
- fixed `evaluation_time`;
- identified live-availability Snapshot or equivalent trusted input revision.

This policy does not add those fields to Result Handoff or implement their storage. A separate Contract is required before persistent audit mapping.

## 15. Lifecycle and availability rules

### 15.1 Lifecycle eligibility

An ordinary Resolver-eligible Binding Set contains only Records whose `governance.lifecycle_status` is `approved`.

The following are invalid for ordinary selection:

- `draft`;
- `deprecated`;
- `retired`;
- approved Record whose effective period has not started;
- approved Record whose `review_due_at` has been reached or passed;
- approved Record with unverified approval or evidence.

Deprecated rollback or transition use requires a separately approved mode and is not enabled by v1 ordinary Set validation.

### 15.2 Timestamp consistency

For each approved Record and the Set Snapshot:

```text
created_at <= approved_at <= effective_from < review_due_at
```

Where the Set envelope does not separately carry `approved_at`, the approval-verification result must establish approval no later than `effective_from`.

The fixed `evaluation_time` must satisfy:

```text
effective_from <= evaluation_time < review_due_at
```

Invalid or incomparable time relationships fail closed.

### 15.3 Live availability separation

Temporary provider health is not stored in the immutable Binding Record or Set Snapshot.

Set semantic validity and runtime availability are distinct:

- a valid Set may have no currently available candidate;
- temporary unavailability does not mutate or invalidate historical Snapshot identity;
- Resolver must still stop or use only an approved valid fallback;
- missing or unknown live-availability input cannot be treated as available.

The Semantic Validator may validate the identity and trust boundary of supplied availability facts, but it does not fetch or calculate them.

## 16. Evidence and governance rules

### 16.1 Structural presence versus semantic verification

PR #116 verifies required approval and evidence fields are structurally present for approved Records. Set validation verifies that external approval and evidence verification results bind to the exact identities and remain current.

Presence of a URL or repository path alone is not proof that evidence exists, matches, or remains valid.

### 16.2 Required identity binding

Verification results must bind to:

- exact Binding Set identity and membership for Set approval;
- exact Binding Record identity;
- provider, model family, model version, and deployment identity;
- capability, compatibility, cost, latency, reliability, availability, and security claims they support;
- evaluation date and review boundary.

Mismatch, missing verification, stale review, ambiguous reference, or unresolvable identity fails closed.

### 16.3 No evidence retrieval

The future Semantic Validator must receive evidence and approval verification outcomes through a separate trusted input contract. It must not:

- fetch arbitrary URLs from a Binding Record;
- execute repository content referenced as evidence;
- interpret natural-language evidence as a capability mapping;
- query a provider or monitoring API;
- approve its own input.

The format and producer of verification outcomes remain deferred. This policy defines their required meaning only.

## 17. Atomic result and diagnostics

### 17.1 Atomic validity

Set validation is atomic:

- all required rules pass: the exact Snapshot is eligible for Resolver input;
- any required rule fails: no Record from the Snapshot is eligible through this validation result.

The validator must not return a “valid subset” or remove invalid candidates automatically.

### 17.2 Proposed internal diagnostics

The following codes are design candidates for a future validator. They are not dispatch or Result Handoff statuses and are not emitted in this task.

| Code | Condition |
| --- | --- |
| `BINDING_SET_SNAPSHOT_INVALID` | Set identity, revision, membership, approval, or effective-time boundary invalid |
| `BINDING_SET_MEMBER_MISSING` | Included reference does not resolve exactly once |
| `BINDING_SET_MEMBER_EXTRA` | Unreferenced Record supplied to validation |
| `BINDING_SET_DUPLICATE_REFERENCE` | Exact member reference repeated |
| `BINDING_SET_DUPLICATE_LINEAGE` | Multiple revisions of one `binding_id` included |
| `BINDING_SET_DEPLOYMENT_COLLISION` | Duplicate concrete deployment identity in one tier and scope |
| `BINDING_SET_SCOPE_MISMATCH` | Routing contract or resolution scope differs |
| `BINDING_SET_TIER_FLOOR_MISMATCH` | Same tier has conflicting capability-floor reference |
| `BINDING_SET_PRIORITY_AMBIGUOUS` | Same domain has duplicate priority |
| `BINDING_SET_FALLBACK_UNKNOWN` | Fallback target is not an exact member |
| `BINDING_SET_FALLBACK_CYCLE` | Fallback graph contains a cycle |
| `BINDING_SET_FALLBACK_DOWNGRADE` | Fallback lowers tier, reasoning, context, reliability, or availability floor |
| `BINDING_SET_FALLBACK_BOUNDARY_VIOLATION` | Fallback crosses provider, scope, security, or compatibility boundary |
| `BINDING_SET_LIFECYCLE_INELIGIBLE` | Member is draft, deprecated, retired, not effective, or review-expired |
| `BINDING_SET_APPROVAL_UNVERIFIED` | Set or Record approval cannot be verified |
| `BINDING_SET_EVIDENCE_UNVERIFIED` | Required evidence is missing, stale, mismatched, or unresolved |

Exact result types, code names, ordering, and serialization require the future Semantic Validator Contract and implementation review.

### 17.3 Existing workflow status mapping

Semantic validation failure uses existing workflow handling:

- configuration or eligibility failure: `blocked`;
- missing review or owner action: `needs_followup` where allowed by the existing workflow;
- validator execution failure: `failed`.

No new external status is introduced. Detailed diagnostic information belongs in existing unresolved or validation reporting boundaries until a separately approved result contract exists.

## 18. Failure behavior

| Failure | Required behavior | Forbidden behavior |
| --- | --- | --- |
| Structural precondition fails | Stop before set semantics | Repair or coerce raw Record |
| Snapshot member missing or extra | Invalidate entire Snapshot | Ignore extra input or skip missing member |
| Duplicate lineage | Invalidate entire Snapshot | Select highest revision |
| Priority ambiguity | Invalidate entire Snapshot | Use file order, creation time, or latest revision |
| Unknown fallback | Invalidate entire Snapshot | Drop the edge |
| Fallback cycle | Invalidate entire Snapshot | Truncate the graph |
| Capability downgrade | Invalidate entire Snapshot | Continue for cost or availability |
| Deprecated or retired member | Invalidate ordinary Resolver Set | Silently omit the member |
| Approval or evidence unverified | Fail closed | Treat reference presence as proof |
| Live availability unknown | Resolver stops or escalates | Treat as available |

Architect review changes the approved configuration through a new Record or Set revision. It does not override an invalid Snapshot in place.

## 19. Security boundary

This policy does not add or handle:

- secrets, API keys, tokens, credentials, or private endpoints;
- provider, evidence, GitHub, or monitoring API access;
- filesystem or network permissions;
- arbitrary shell commands;
- Runner, Resolver, Adapter, Dispatcher, Workflow, or API implementation;
- untrusted Issue text as configuration;
- automatic provider switching.

Future validation must operate on already admitted, structurally valid, immutable inputs. Evidence references are identifiers, not permission to fetch or execute content.

Diagnostics must not expose secret values, private endpoints, credentials, local absolute paths, or unredacted provider responses.

## 20. Semantic test design

The future implementation must include at least these cases.

### Membership and identity

- valid exact membership;
- duplicate exact reference;
- duplicate `binding_id` with different revisions;
- same numeric revision across different Binding IDs is valid;
- referenced Record missing;
- unreferenced extra Record supplied;
- duplicate concrete deployment identity in one tier and scope;
- same deployment identity across different tiers with explicit separate approval is evaluated under the documented rule.

### Scope and tier

- all members share routing contract and resolution scope;
- routing contract mismatch;
- resolution scope mismatch;
- consistent capability floor for each tier;
- conflicting capability-floor references;
- reasoning-floor compatibility;

### Priority

- unique priorities in each tier domain;
- same priority in different tiers is valid;
- same priority in the same tier and scope is invalid;
- same priority remains invalid even when compatibility profiles are disjoint;
- array order does not change the result.

### Fallback graph

- empty fallback list;
- valid ordered same-provider fallback;
- unknown target;
- direct self-reference;
- two-node cycle;
- multi-node cycle;
- duplicate target;
- lower-tier fallback;
- lower-reasoning fallback;
- insufficient context fallback;
- cross-provider fallback;
- resolution-scope mismatch;
- missing required adapter, Runner, sandbox, network, tool, structured-output, or response compatibility;
- valid higher-capability fallback.

### Lifecycle, approval, and evidence

- all approved and effective with verified evidence;
- draft member;
- deprecated member;
- retired member;
- future effective date;
- expired review date;
- invalid timestamp order;
- missing Set approval verification;
- evidence mismatch or stale evidence;
- temporary unavailability keeps Snapshot identity valid but prevents runtime selection when no fallback is available.

### Reproducibility

- same Set revision and canonically equivalent member order produce the same result;
- membership change requires a new Set revision;
- revision reuse rejected;
- exact Set and selected Binding identities can be pinned;
- unknown live-availability input never becomes available by default.

## 21. Future implementation split

### PR A: Binding Set Schema and Semantic Validator Contract

Scope:

- implement or Freeze the Binding Set envelope Schema;
- define validator input and result types;
- Freeze diagnostic codes and deterministic diagnostic ordering;
- define trusted evidence, approval, and availability verification input boundaries.

Owner: Backend Architect and Backend Implementer under separate assignments

Review: Architect Team

Merge gate: this policy Frozen; no Resolver selection or provider access

### PR B: Implement Binding Set Semantic Validator

Scope:

- implement ordered validation stages;
- implement membership, duplicate, scope, tier, priority, fallback graph, lifecycle, and verification-result checks;
- add the full semantic test matrix;
- return an immutable validation result without persistence.

Owner: Backend Implementer

Review: Backend Architect

Merge gate: PR A merged; all single-record and semantic tests pass

### PR C: Implement Deployment Resolver

Scope:

- accept only an exact successfully validated Snapshot;
- apply trusted runtime requirements and live availability;
- select and pin exactly one Binding revision or fail closed;
- avoid provider access and side effects in pure selection logic.

Owner: Backend Implementer

Review: Backend Architect

Merge gate: PR B merged; deterministic Resolver contract approved

### PR D: Provider Adapter

Scope:

- connect one explicitly approved provider and deployment;
- translate only allowlisted Binding fields;
- preserve credential separation and Runner security.

Owner: Backend Implementer

Review: Backend Architect and designated security reviewer

Merge gate: concrete provider evaluation and Product Owner approval

### PR E: Runner Integration

Scope:

- pass the pinned Set and Binding identities through the approved execution boundary;
- validate sandbox, network, tool, response, timeout, and sanitized audit behavior;
- preserve existing dispatch and Result Handoff semantics.

Owner: Backend Implementer

Review: Backend Architect

Merge gate: Resolver, Provider Adapter, and approved Runner profile available; no automatic merge

## 22. Implementation acceptance criteria

Future Semantic Validator implementation is acceptable only when:

1. every Record passed PR #116 structural validation before set semantics;
2. exact membership is one-to-one with supplied Records;
3. one Snapshot contains at most one revision per Binding lineage;
4. same numeric revision across different lineages remains valid;
5. routing contract and resolution scope are uniform;
6. priority is unique within each tier domain;
7. no file or array order affects validation;
8. fallback graph references only exact members and is acyclic;
9. every fallback preserves provider, scope, capability, reasoning, context, reliability, availability, and compatibility floors;
10. draft, deprecated, retired, not-effective, review-expired, unapproved, or unverified members fail closed;
11. any semantic failure invalidates the entire Snapshot rather than returning a repaired subset;
12. no evidence or provider network call occurs;
13. no new dispatch or Result Handoff status is added;
14. no Resolver, provider adapter, Runner integration, Secret, Credential, or persistence is introduced.

## 23. Deferred decisions

The following remain intentionally deferred:

- Binding Set storage path, JSON Schema ID, and serialization profile;
- Snapshot content hash or Artifact hash;
- exact Binding Set approval Artifact format;
- evidence, approval, and live-availability verification result contracts;
- semantic validator API, types, and diagnostic serialization;
- diagnostic code Freeze and severity ordering;
- rollback or transition mode for deprecated Records;
- numeric validity windows, retention, retry, and availability thresholds;
- Resolver API and live-availability source;
- provider, model, deployment, and credential selection;
- persistent audit and Result Handoff field mapping.

These require separate Architect decisions and Task Assignments.

## 24. Design confirmation

This design confirms:

- Single Record Structural Validation remains PR #116 responsibility.
- Binding Set Semantic Validation is atomic and fail-closed.
- Snapshot membership and identity are exact and reproducible without defining a hash.
- Duplicate lineage, priority ambiguity, invalid fallback, downgrade, lifecycle, and evidence failures are detected before Resolver use.
- Logical Tier and reasoning floors are not reduced.
- Existing Contract, Role, dispatch, Execution Request, Result Handoff, Runner, and research semantics remain unchanged.
- No Schema, Validator, Resolver, Provider Adapter, Runner, API, Workflow, Secret, Credential, or Registry is implemented.
- Only this new Markdown policy document is changed.
