# Deployment Binding Schema Design

Status: Design review candidate

Task: `ARCH-DEPLOYMENT-BINDING-SCHEMA-001`

Canonical assignment: [GitHub Issue #113](https://github.com/whatrune/sd-prompt-studio/issues/113)

Target logical contract: `deployment_binding_v1`

## 1. Purpose

This document defines the logical data model for a Deployment Binding Record governed by the [Deployment Binding Policy](14-deployment-binding-policy.md).

The model gives a future Deployment Resolver enough trusted, versioned information to select exactly one approved deployment without changing Logical Model Tier semantics or embedding provider choice into dispatch, Role, Task Assignment, Result Handoff, Execution Adapter, or Runner contracts.

This is a Schema design only. It does not create a JSON Schema, persistent registry, Resolver, provider integration, runtime configuration, credential store, or concrete Deployment Binding Record.

## 2. Normative sources

This design is subordinate to:

- [AI Model Routing Policy](12-model-routing-policy.md)
- [Deployment Binding Policy](14-deployment-binding-policy.md)
- [Runner Provisioning Architecture Design](10-runner-provisioning-design.md)
- [Dispatch Execution Integration Design](08-dispatch-execution-integration-design.md)
- [Delegation and Result Contract](../team/11-delegation-and-result-contract.md)

If this design conflicts with a normative source, the source remains authoritative and this design must return to Architect review.

## 3. Scope

This design defines:

- the root structure of a Deployment Binding Record;
- identity, revision, and immutability rules;
- Logical Model Tier binding;
- provider-neutral deployment identity;
- capability and compatibility declarations;
- operational policy metadata;
- governance, approval, evidence, and lifecycle metadata;
- deterministic Resolver filtering and priority inputs;
- failure and security boundaries;
- the split for later Schema and Resolver implementation.

## 4. Non-goals

This design does not:

- implement a JSON Schema or validation code;
- define a repository location, registry file, API, database, or content hash;
- approve a provider, model family, model version, deployment, price, or endpoint;
- implement a Resolver, provider adapter, Runner integration, retry, fallback, or monitoring system;
- add fields or statuses to existing dispatch, Execution Request, Result Handoff, or research contracts;
- store a credential, secret, token, private endpoint, access grant, or permission;
- change the meanings of `efficient`, `general`, or `advanced`;
- authorize automatic provider switching.

## 5. Design principles

### 5.1 Closed and explicit record

The future persisted representation should be a closed object: every normative field must be specified by the approved Schema and unknown fields must be rejected.

Provider-specific free-form parameter maps are prohibited. A required provider option must first receive an allowlisted field or versioned profile contract.

### 5.2 Immutable approved revision

An approved Deployment Binding Record is immutable. Any change to normative content creates a new revision or a new Binding lineage under the rules in this document.

Draft authoring can be edited before approval, but a draft is not eligible for resolution. Approval creates the immutable revision used by Resolver and audit logic.

### 5.3 No duplicated live state

The Record stores approved policy and evidence. It does not store mutable live health, remaining quota, current queue depth, or current incident state.

Live availability is a separate trusted Resolver input. This avoids rewriting the approved Record whenever an external service becomes temporarily unavailable.

### 5.4 No semantic inference from identifiers

`binding_id`, provider IDs, profile references, and evidence references are opaque identifiers. Resolver must not infer tier, priority, provider equivalence, capability, or fallback from their spelling.

## 6. Logical root model

The following table is the proposed logical root. Types and constraints are design requirements for a future Schema, not a Schema implementation in this PR.

| Field | Type | Required | Mutability after approval | Purpose |
| --- | --- | --- | --- | --- |
| `contract_version` | string constant | yes | immutable | Identifies `deployment_binding_v1` |
| `binding_id` | opaque identifier | yes | immutable across the lineage | Stable Binding lineage identity |
| `binding_revision` | positive integer | yes | immutable | Identifies one approved revision |
| `tier_binding` | closed object | yes | immutable | Binds the Record to one logical tier contract and capability floor |
| `deployment` | closed object | yes | immutable | Identifies the concrete provider deployment without credentials |
| `capabilities` | closed object | yes | immutable | Declares evaluated model and execution capabilities |
| `compatibility` | closed object | yes | immutable | Declares approved adapter, Runner, response, tool, sandbox, and network compatibility |
| `operations` | closed object | yes | immutable | Declares approved cost, latency, reliability, availability, retry, and monitoring posture |
| `resolution` | closed object | yes | immutable | Supplies deterministic selection priority and explicit fallback references |
| `governance` | closed object | yes | immutable | Records lifecycle, approval, evidence, review, supersession, and rollback information |

No normative field is mutable after approval. Current service health, usage, and observations live outside the Record and do not become mutable exceptions.

### 6.1 Binding Set Snapshot boundary

One Record Schema is not sufficient to reproduce why Resolver selected one candidate over another. A future Resolver input must therefore identify an immutable, approved Binding Set Snapshot containing:

- `binding_set_id`: stable opaque set identity;
- `binding_set_revision`: immutable positive revision;
- the unique identity tuple of every included Binding Record;
- approval record and effective period for the set.

The Snapshot list order has no selection meaning. Resolver uses explicit filtering and `selection_priority` only.

This design does not choose the Snapshot storage path, serialization, JSON Schema ID, or content hash. Those are required decisions for the future Schema Implementation task. Until the exact Snapshot can be identified, a Resolver result cannot be considered reproducible or production-eligible.

## 7. Identity model

### 7.1 Contract identity

`contract_version` is fixed to:

```text
deployment_binding_v1
```

A future incompatible field or semantic change requires a new contract version. Adding a field to a closed object is a compatibility decision and must not be treated as an incidental implementation detail.

### 7.2 Binding identity

`binding_id` identifies one Binding lineage. The proposed identifier contract is:

- lowercase ASCII;
- prefix `deployment_binding.`;
- a stable opaque suffix using lowercase letters, digits, `_`, or `-`;
- no provider, model, tier, priority, or lifecycle meaning is inferred from the suffix.

Conceptual format:

```text
deployment_binding.<opaque-name>
```

This format is a design target. Its exact regular expression belongs to the future Schema implementation review.

### 7.3 Revision identity

The canonical logical identity of one Record is the tuple:

```text
(contract_version, binding_id, binding_revision)
```

Rules:

- a new `binding_id` begins at revision `1`;
- revisions are positive integers and strictly increase within a lineage;
- a revision number is never reused;
- a higher revision does not become active merely because its number is higher;
- revision gaps are allowed so that failed or withdrawn drafts do not require number reuse;
- Resolver uses an explicitly approved revision, never an inferred `latest` revision.

This design adds no hash or byte-integrity contract. Identity tuple equality is not Artifact integrity proof.

### 7.4 Binding lineage boundary

Create a new `binding_id` when any of these change:

- provider identity;
- model family;
- Logical Model Tier;
- security or data-boundary class that would make automatic equivalence unsafe.

Create a new revision in the same lineage when the lineage remains stable but any approved property changes, including:

- exact model or deployment version;
- capability declaration;
- adapter, Runner, response, tool, sandbox, or network compatibility;
- operational policy;
- selection priority or fallback order;
- evidence, approval condition, review date, supersession, or rollback target.

A material change may choose a new Binding lineage even when a revision would be technically possible. It must never edit an approved revision in place.

## 8. Tier binding model

`tier_binding` connects the Record to the existing Model Routing Contract without redefining the tier.

| Field | Type | Required | Rule |
| --- | --- | --- | --- |
| `routing_contract_version` | string | yes | Exact supported Model Routing Contract version |
| `logical_tier` | enum | yes | Exactly one of `efficient`, `general`, `advanced` |
| `capability_floor_ref` | versioned reference | yes | References the approved capability-floor definition; it does not inline or rewrite tier meaning |
| `required_reasoning_level` | enum | yes | The effective reasoning floor selected by the Model Routing Policy |

The following are forbidden:

- mapping one Record to multiple logical tiers;
- treating a deployment name as a tier;
- letting Resolver lower the required tier or reasoning floor;
- copying an editable tier definition into each Record;
- using Worker or Issue free text as a capability-floor reference.

The initial reasoning vocabulary remains the provider-neutral values already defined by the Model Routing Policy. This design does not add a provider-specific reasoning mode.

## 9. Deployment identity model

`deployment` identifies what will be invoked while keeping authentication and endpoint secrets outside the Record.

| Field | Type | Required | Rule |
| --- | --- | --- | --- |
| `provider_id` | opaque identifier | yes | Approved provider identity; changing it creates a new Binding lineage |
| `model_family` | opaque stable string | yes | Approved model family; no family alias resolution |
| `model_version` | exact stable string | yes | Must identify a fixed provider version; floating `latest` is forbidden |
| `deployment_id` | opaque stable string | yes | Exact non-secret deployment identifier used by the future adapter |
| `provider_profile_ref` | versioned non-secret reference | conditional | References allowlisted provider configuration; never a credential or endpoint secret |

`deployment_id` must not be:

- an API key, token, password, cookie, or private key;
- a URL containing credentials or secret query parameters;
- a private endpoint whose disclosure violates the Runner security boundary;
- a mutable alias that can silently point to another model;
- arbitrary Issue or Task Assignment text.

The future Schema must distinguish an absent optional profile reference from an empty or unknown value. Empty strings and `null` placeholders must not mean “use provider default.”

## 10. Capability model

`capabilities` declares evaluated capabilities of the exact deployment revision. A declaration makes a deployment filterable; it does not prove correctness without governance evidence.

### 10.1 Reasoning capability

| Field | Type | Required | Rule |
| --- | --- | --- | --- |
| `supported_reasoning_levels` | non-empty unique set | yes | Provider-neutral reasoning values supported by this deployment |
| `default_reasoning_level` | enum | no | If present, must be in the supported set; Resolver still uses routed requirements rather than this default |

Provider defaults must not override the effective routing result. Unsupported reasoning requirements make the Record ineligible.

### 10.2 Context capability

| Field | Type | Required | Rule |
| --- | --- | --- | --- |
| `declared_context_limit_tokens` | positive integer | yes | Evaluated provider limit for the exact deployment version |
| `reserved_output_tokens` | non-negative integer | yes | Capacity reserved by the approved response profile |
| `usable_input_limit_tokens` | positive integer | yes | Approved effective input ceiling for routing and preflight checks |
| `context_evidence_ref` | canonical reference | yes | Evidence for all context values |

The future implementation must validate the arithmetic and profile relationship. It must not infer usable input capacity solely from a provider marketing limit.

### 10.3 Tool capability

| Field | Type | Required | Rule |
| --- | --- | --- | --- |
| `tool_profile_refs` | unique set of versioned references | yes | Empty means no tool use is supported |
| `structured_output_profile_refs` | unique set of versioned references | yes | Empty means no structured-output profile is supported |
| `response_profile_refs` | unique set of versioned references | yes | Must reference approved Response Policy profiles |

These references describe compatibility only. They do not grant tool, filesystem, network, or execution permission.

### 10.4 Capability evidence

Capability claims are valid for selection only when the corresponding governance evidence is present, current, and bound to the same provider, model, deployment, and revision.

Resolver must not accept a free-form capability label such as `advanced`, `supports_tools`, or `large_context` without the explicit fields and evidence required by the future Schema.

## 11. Compatibility model

`compatibility` defines which trusted execution surfaces can use the Binding.

| Field | Type | Required | Rule |
| --- | --- | --- | --- |
| `execution_adapter_contract_versions` | non-empty unique set | yes | Exact supported adapter contract versions |
| `runner_profile_refs` | non-empty unique set | yes | Exact approved Runner profiles |
| `sandbox_profile_refs` | non-empty unique set | yes | Exact approved sandbox policies |
| `network_policy_refs` | non-empty unique set | yes | Exact approved network policies, including a no-network profile where applicable |
| `tool_profile_refs` | unique set | yes | Must be consistent with capability declarations |
| `response_profile_refs` | non-empty unique set | yes | Must be consistent with capability declarations |

Compatibility uses exact reference matching. Resolver must not:

- infer compatibility from operating-system names or file paths;
- discard an unsupported requested profile;
- widen network, sandbox, or tool permission;
- treat an empty list as “all supported”;
- choose a different Runner or adapter merely to make a Binding eligible.

Duplicate capability and compatibility references are intentional only where one states support and the other states approved execution use. A future Schema implementation must validate their cross-field consistency rather than silently merge them.

## 12. Operational model

`operations` stores reviewed policy classes and evidence references, not current volatile service state.

### 12.1 Cost and budget posture

| Field | Type | Required | Proposed vocabulary |
| --- | --- | --- | --- |
| `cost_class` | enum | yes | `cost_optimized`, `balanced`, `quality_optimized` |
| `budget_posture` | enum | yes | `cost_first`, `balanced`, `quality_first` |
| `cost_evidence_ref` | canonical reference | yes | Dated evaluation bound to the deployment revision |

The class is comparative policy metadata, not a price guarantee. Resolver cannot select a lower tier or capability floor because a cheaper class exists.

### 12.2 Latency and reliability posture

| Field | Type | Required | Proposed vocabulary |
| --- | --- | --- | --- |
| `latency_class` | enum | yes | `low_latency`, `standard`, `extended` |
| `reliability_class` | enum | yes | `standard`, `high` |
| `latency_evidence_ref` | canonical reference | yes | Dated measurement or approved service evidence |
| `reliability_evidence_ref` | canonical reference | yes | Dated availability and capacity evidence |

Class thresholds remain a future evaluation-contract decision. This design freezes the need for controlled classes, not numeric targets.

### 12.3 Availability policy

| Field | Type | Required | Rule |
| --- | --- | --- | --- |
| `availability_requirement` | enum | yes | `standard` or `high`; a required service posture, not live state |
| `retry_policy_ref` | versioned reference | yes | Approved bounded pre-execution retry policy |
| `monitoring_profile_ref` | versioned reference | yes | Approved monitoring and evidence policy |
| `capacity_policy_ref` | versioned reference | yes | Approved usage and capacity boundary |

The live availability input supplied to Resolver uses an operational vocabulary such as `available`, `temporarily_unavailable`, or `unknown`. It is not stored in the immutable Binding Record.

`deprecated` and `retired` are governance lifecycle states, not availability values. `active` is derived eligibility: an approved effective revision with current evidence, compatible execution context, and live availability that permits use. The future Schema must not duplicate these meanings across fields.

## 13. Resolution model

`resolution` contains only approved deterministic selection inputs.

| Field | Type | Required | Rule |
| --- | --- | --- | --- |
| `selection_priority` | positive integer | yes | Lower number has higher priority within the same eligible tier and resolution scope |
| `resolution_scope_ref` | versioned reference | yes | Defines the trusted environment or policy scope in which priority is compared |
| `fallback_binding_refs` | ordered unique list of Binding revision references | yes | Empty means no automatic fallback is permitted |

Each fallback reference contains exactly:

```text
binding_id
binding_revision
```

Rules:

- fallback references are exact and never use `latest`;
- a Record cannot reference itself;
- duplicate fallback references are forbidden;
- cycles are forbidden across the approved Binding set;
- every fallback must satisfy the same or a higher capability floor;
- `deployment_binding_v1` automatic fallback cannot cross provider;
- fallback order is explicit and significant;
- an equal `selection_priority` among otherwise eligible Records is ambiguous and fails closed.

Cross-record uniqueness, cycle detection, provider equality, and capability-floor comparison require future semantic validation. They cannot be guaranteed by validating one Record in isolation.

## 14. Governance model

`governance` records how a revision becomes and remains eligible.

### 14.1 Lifecycle

| Field | Type | Required | Rule |
| --- | --- | --- | --- |
| `lifecycle_status` | enum | yes | `draft`, `approved`, `deprecated`, or `retired` |
| `created_at` | RFC 3339 UTC timestamp | yes | Creation of this revision |
| `effective_from` | RFC 3339 UTC timestamp | conditional | Required for approved or deprecated revisions |
| `approved_at` | RFC 3339 UTC timestamp | conditional | Required for approved or deprecated revisions |
| `deprecated_at` | RFC 3339 UTC timestamp | conditional | Required when deprecated |
| `retired_at` | RFC 3339 UTC timestamp | conditional | Required when retired |
| `review_due_at` | RFC 3339 UTC timestamp | yes | Date after which eligibility requires renewed evidence review |

`created` is an event represented by `created_at`, not a fifth lifecycle status. This preserves the lifecycle vocabulary established by the Deployment Binding Policy.

Only `approved` revisions whose effective period and review evidence are valid can be selected for ordinary new execution. Deprecated revisions are usable only under explicitly approved transition or rollback conditions. Retired revisions are never eligible for new execution.

### 14.2 Approval

| Field | Type | Required | Rule |
| --- | --- | --- | --- |
| `approval_owner` | existing Role or Product Owner identifier | conditional | Required for approved, deprecated, and retired revisions |
| `approval_record` | canonical reference | conditional | GitHub URL or repository-relative Markdown path containing the approval |
| `architecture_review_ref` | canonical reference | conditional | Required before approval |
| `security_review_ref` | canonical reference | conditional | Required before approval |

This design creates no new Role or approval authority. Approval identifiers must resolve to authorities already established by team contracts.

### 14.3 Evidence

| Field | Type | Required for approval | Purpose |
| --- | --- | --- | --- |
| `capability_evidence_refs` | non-empty unique set | yes | Official and verified capability evidence |
| `quality_evaluation_refs` | non-empty unique set | yes | Task-class quality evaluation |
| `cost_evaluation_refs` | non-empty unique set | yes | Dated cost evaluation |
| `latency_evaluation_refs` | non-empty unique set | yes | Dated latency evaluation |
| `availability_evidence_refs` | non-empty unique set | yes | Availability and capacity evidence |
| `security_review_refs` | non-empty unique set | yes | Security review evidence |
| `compatibility_evidence_refs` | non-empty unique set | yes | Adapter, Runner, response, tool, sandbox, and network evidence |

A canonical reference is either an approved GitHub URL or repository-relative Git-managed path. Chat-only, local-only, private-secret, and unresolvable references are forbidden.

### 14.4 History and rollback

| Field | Type | Required | Rule |
| --- | --- | --- | --- |
| `supersedes` | exact Binding revision reference | no | Identifies the revision replaced by this revision |
| `rollback_target` | exact Binding revision reference | no | Pre-approved target for human-controlled rollback |
| `change_reason` | non-empty string | yes | Explains why this revision exists without authorizing runtime behavior |

`supersedes` and `rollback_target` must resolve to immutable existing revisions. A rollback target must remain approved for rollback, compatible, and security-valid at rollback time. The field does not trigger automatic rollback.

## 15. Immutable and mutable data boundary

### Immutable within an approved Record

All root and nested normative fields defined in Sections 6 through 14 are immutable after approval.

In particular, the following are never updated in place:

- identity and revision;
- tier binding;
- provider, model, and deployment identity;
- capability and compatibility declarations;
- cost, latency, reliability, availability requirement, retry, and monitoring policy;
- priority and fallback order;
- lifecycle, approval, evidence, supersession, and rollback metadata.

### Mutable data kept outside the Record

The following are intentionally external:

- current provider health;
- current quota, usage, or queue depth;
- incident state;
- measured telemetry accumulated after approval;
- Resolver lock or current task state;
- credential rotation and access grants;
- dispatch and Result Handoff state.

External mutable data can make a Record temporarily ineligible, but it cannot rewrite the Record or authorize another provider.

## 16. Resolver compatibility

### 16.1 Required filtering fields

A future Resolver must be able to filter by:

- exact approved Binding Set Snapshot identity;
- supported `contract_version`;
- exact Model Routing Contract version;
- exact `logical_tier`;
- lifecycle approval and effective period;
- evidence review validity;
- reasoning and context requirements;
- tool and structured-output requirements;
- response profile;
- adapter and Runner compatibility;
- sandbox and network policy;
- live availability input;
- resolution scope.

### 16.2 Required compatibility checks

Resolver must compare explicit values, not names or array order:

- requested reasoning level is in `supported_reasoning_levels`;
- required input and reserved output fit approved context limits;
- required tool and response profiles exist in both capability and compatibility sets;
- requested adapter, Runner, sandbox, and network profiles match exact approved references;
- the Record meets the routed capability floor;
- governance evidence is present and current;
- the live operational input permits execution.

### 16.3 Deterministic priority

After filtering, Resolver compares `selection_priority` only within the same `resolution_scope_ref` and effective logical tier.

- exactly one highest-priority eligible Record: select and pin its identity tuple;
- no eligible Record: return existing blocked or follow-up handling;
- multiple equal highest-priority Records: fail closed as ambiguous;
- unavailable primary: apply only the explicit ordered fallback list under the Deployment Binding Policy;
- unsupported field or contract version: fail closed.

The Resolver does not choose by file order, creation time, revision number, model name, provider default, or estimated cost outside approved policy fields.

## 17. Structural and semantic validation design

### 17.1 Future structural validation

A future JSON Schema can validate within one Record:

- required fields and closed objects;
- primitive types, enums, identifier formats, and timestamps;
- positive revision and priority values;
- unique arrays;
- lifecycle-dependent required and forbidden timestamp or approval fields;
- exact reference object shape;
- absence of secret-bearing fields and arbitrary provider parameter maps;
- no self-reference in directly visible fallback entries.

### 17.2 Future semantic validation

Cross-record or external checks require a separate validator:

- unique identity tuple across the Binding set;
- monotonically increasing, non-reused revisions;
- lineage boundary consistency;
- exact evidence and approval reference resolution;
- evidence binding to the declared deployment revision;
- evidence freshness;
- priority ambiguity within one resolution scope;
- fallback existence, order, cycle, provider, and capability-floor checks;
- rollback target eligibility;
- adapter, Runner, response, tool, sandbox, and network profile existence;
- context arithmetic and response reservation compatibility.

Neither validator is implemented in this task.

## 18. Failure handling

Schema or semantic validation failure must prevent resolution. Existing workflow statuses remain authoritative.

| Failure | Existing handling boundary | Required action |
| --- | --- | --- |
| Missing required field or unknown field | `blocked` or `needs_followup` | Stop before Resolver selection and return to Architect or assignment owner |
| Unsupported contract version | `blocked` | Require compatible design or migration review |
| Invalid or duplicate identity | `blocked` | Do not select by file order or latest timestamp |
| Missing, stale, or mismatched evidence | `blocked` or `needs_followup` | Renew evidence and approval; do not continue for availability |
| No eligible Binding | `blocked` | Architect review; no default deployment |
| Equal highest priority | `blocked` | Resolve the configuration ambiguity through review |
| Incompatible adapter, Runner, tool, sandbox, network, or response profile | `blocked` | Do not discard the incompatible requirement |
| Deployment temporarily unavailable | existing retry/failure handling | Apply approved bounded retry and fallback only; otherwise stop |
| Provider change required | `needs_followup` or `blocked` | Create and approve a new Binding lineage; no automatic switch |

This design adds no new dispatch or Result Handoff status.

## 19. Security boundary

The future Schema must reject or omit fields that contain:

- API keys, access tokens, passwords, cookies, private keys, or credentials;
- credential locations or retrieval commands;
- private endpoints or secret query parameters;
- filesystem access grants;
- network permissions;
- GitHub, provider, or Runner permission assignments;
- arbitrary shell commands or provider parameters;
- Prompt or Issue text used as deployment configuration.

Allowed references identify versioned, non-secret policy or configuration records only. The Runner Security boundary supplies credentials and permissions independently.

The canonical public Result Handoff may report only sanitized Binding identity and revision if a later Contract adds that mapping. This design does not add those Result Handoff fields.

## 20. Non-normative logical example

The following shows object shape only. Placeholder values are not approved providers, models, profiles, evidence, or bindings.

```yaml
contract_version: deployment_binding_v1
binding_id: deployment_binding.example
binding_revision: 1
tier_binding:
  routing_contract_version: model_routing_v1
  logical_tier: general
  capability_floor_ref: policy.example/general
  required_reasoning_level: medium
deployment:
  provider_id: provider.example
  model_family: model-family-example
  model_version: exact-version-example
  deployment_id: deployment-example
capabilities:
  supported_reasoning_levels:
    - medium
  declared_context_limit_tokens: 1
  reserved_output_tokens: 0
  usable_input_limit_tokens: 1
  context_evidence_ref: docs/evidence/example.md
  tool_profile_refs: []
  structured_output_profile_refs: []
  response_profile_refs:
    - response-profile.example/v1
compatibility:
  execution_adapter_contract_versions:
    - execution-adapter-example-v1
  runner_profile_refs:
    - runner-profile.example/v1
  sandbox_profile_refs:
    - sandbox-profile.example/v1
  network_policy_refs:
    - network-policy.example/v1
  tool_profile_refs: []
  response_profile_refs:
    - response-profile.example/v1
operations:
  cost_class: balanced
  budget_posture: balanced
  cost_evidence_ref: docs/evidence/example.md
  latency_class: standard
  reliability_class: standard
  latency_evidence_ref: docs/evidence/example.md
  reliability_evidence_ref: docs/evidence/example.md
  availability_requirement: standard
  retry_policy_ref: retry-policy.example/v1
  monitoring_profile_ref: monitoring-profile.example/v1
  capacity_policy_ref: capacity-policy.example/v1
resolution:
  selection_priority: 100
  resolution_scope_ref: resolution-scope.example/v1
  fallback_binding_refs: []
governance:
  lifecycle_status: draft
  created_at: "2000-01-01T00:00:00Z"
  review_due_at: "2000-01-02T00:00:00Z"
  change_reason: structural example only
```

The example is intentionally `draft`, uses non-production placeholders, omits approval-only fields, and is not a canonical Binding Artifact or valid capability evaluation.

## 21. Future implementation split

### PR A: Deployment Binding Schema Implementation

Scope:

- select the canonical storage location and serialization format;
- implement a closed JSON Schema for one Record;
- add structural fixtures and meta-validation;
- document compatibility and migration rules.

Owner: Backend Implementer

Review: Backend Architect

Merge gate: this design is reviewed and Frozen; no concrete deployment data is added

### PR B: Binding Set Semantic Validator

Scope:

- implement cross-record identity, revision, priority, fallback, cycle, evidence-reference, and compatibility checks;
- define deterministic diagnostics using existing workflow status boundaries;
- add a comprehensive test matrix.

Owner: Backend Implementer

Review: Backend Architect

Merge gate: PR A merged and semantic validation contract approved

### PR C: Deployment Resolver

Scope:

- implement pure deterministic filtering and unique selection;
- accept only structurally and semantically valid Binding sets;
- pin the selected identity tuple;
- fail closed on missing, ambiguous, unavailable, or incompatible input.

Owner: Backend Implementer

Review: Backend Architect

Merge gate: PR B merged; no provider adapter or credential integration

### PR D: Provider Adapter

Scope:

- implement one explicitly approved provider integration;
- translate only allowlisted fields supported by the adapter contract;
- obtain credentials only through the approved Runner security boundary.

Owner: Backend Implementer

Review: Backend Architect and designated security reviewer

Merge gate: concrete provider and model evaluation plus Product Owner approval

### PR E: Runner Integration

Scope:

- pass the pinned Binding identity and allowlisted execution configuration across the existing Execution Adapter boundary;
- validate sandbox, network, tool, response, timeout, and sanitized audit behavior;
- preserve existing dispatch and Result Handoff semantics.

Owner: Backend Implementer

Review: Backend Architect

Merge gate: Resolver, Provider Adapter, and approved Runner profile available; no automatic merge

## 22. Future implementation acceptance criteria

Future implementation must demonstrate:

1. the same valid Binding set and trusted Resolver inputs select the same identity tuple;
2. the exact approved Binding Set Snapshot used for resolution is identifiable;
3. an approved revision cannot be changed in place;
4. provider, model family, or tier lineage changes create a new `binding_id`;
5. exact model-version changes create a new revision and never use `latest`;
6. no secret, credential, private endpoint, access permission, or arbitrary provider parameter is accepted;
7. structural failure prevents semantic validation and resolution;
8. semantic ambiguity prevents resolution;
9. live availability does not mutate the Binding Record;
10. cost pressure cannot lower the tier or capability floor;
11. fallback references are exact, acyclic, same-provider in v1, and capability-compatible;
12. unsupported adapter, Runner, response, tool, sandbox, or network profiles fail closed;
13. existing Contract, Role, dispatch, Execution Request, and Result Handoff structures remain unchanged.

## 23. Deferred decisions

The following remain intentionally undecided:

- canonical storage path and file format;
- Binding Set Snapshot storage and Schema identity;
- JSON Schema file name and Schema ID;
- content identity or Artifact hash;
- concrete Model Routing Contract version identifier;
- provider, model, deployment, and profile identifiers;
- numeric cost, latency, reliability, context, retry, and availability thresholds;
- evidence Artifact formats and retention;
- live availability input contract;
- Resolver API and implementation language;
- credential mechanism and provider authentication;
- public audit and Result Handoff field mapping.

Each requires a separate Task Assignment and the approval authority defined by existing team contracts.

## 24. Design confirmation

This design confirms:

- Logical Model Tier remains separate from concrete deployment identity.
- Binding revisions are immutable and explicit.
- Resolver has deterministic filtering, compatibility, and priority inputs.
- Lifecycle and live availability are not duplicated or confused.
- Existing dispatch and Result Handoff statuses remain unchanged.
- No concrete provider or model is adopted.
- No JSON Schema, Resolver, provider adapter, Runner integration, Code, Workflow, Dispatcher, Secret, or credential is implemented.
- Only this new Markdown design document is changed.
