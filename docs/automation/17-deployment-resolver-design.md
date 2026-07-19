# Deployment Resolver Design

Status: Design review candidate

Task: `ARCH-DEPLOYMENT-RESOLVER-DESIGN-001`

Canonical assignment: [GitHub Issue #119](https://github.com/whatrune/sd-prompt-studio/issues/119)

Target logical contract: `deployment_resolver_v1`

## 1. Purpose

This document defines the architecture and decision boundary for resolving one executable Deployment Binding revision from an already validated Binding Set Snapshot and a trusted Execution Context.

The Resolver is the last pure decision layer before a future Execution Adapter receives a pinned Binding revision. It preserves Logical Model Tier and risk decisions, rejects ambiguous or incomplete inputs, produces reproducible decision evidence, and fails closed without selecting a provider or model through unapproved runtime inference.

This task is design only. It does not implement the Resolver, change a Schema, call a provider, operate a Runner, manage credentials, or add fields to existing Execution Request or Result Handoff contracts.

## 2. Normative sources

This design is subordinate to:

- [AI Model Routing Policy](12-model-routing-policy.md)
- [Deployment Binding Policy](14-deployment-binding-policy.md)
- [Deployment Binding Schema Design](15-deployment-binding-schema-design.md)
- [Deployment Binding Record JSON Schema](../../src/deployment-binding/deployment-binding.schema.json)
- [Binding Set Semantic Validation Policy](16-binding-set-semantic-validation-policy.md)
- [Runner Provisioning Architecture Design](10-runner-provisioning-design.md)
- [Delegation and Result Contract](../team/11-delegation-and-result-contract.md)

PR #116 structural validation and the future Binding Set Semantic Validator are mandatory preconditions. Resolver does not repeat or weaken either validation boundary.

If this document conflicts with a normative source, the source remains authoritative and this design returns to Architect review.

## 3. Scope

This design defines:

- Resolver responsibility and non-responsibility;
- trusted input and Execution Context models;
- deterministic filtering and primary selection;
- availability and explicit fallback handling;
- cost and quality-floor behavior;
- logical Resolution Result and pinned Adapter handoff;
- failure, security, audit, and reproducibility boundaries;
- future implementation split and acceptance tests.

## 4. Non-goals

This design does not:

- classify Task, Role, Complexity, or Risk;
- select or change the effective Logical Model Tier;
- create, repair, migrate, validate structurally, or approve a Binding;
- create or repair a Binding Set;
- implement the Binding Set Semantic Validator;
- call a provider, evidence source, monitoring service, or GitHub API;
- operate a Runner or change filesystem, network, sandbox, tool, or permission boundaries;
- obtain or expose secrets, tokens, credentials, or private endpoints;
- implement retry, timeout, usage metering, Provider Adapter, or runtime invocation;
- persist Resolution Results or add an audit Artifact;
- add a dispatch or Result Handoff status;
- add or modify an existing Schema, API, CLI, Workflow, Dispatcher, Execution Adapter, or Runner.

## 5. Responsibility boundary

### 5.1 Resolver responsibilities

Deployment Resolver is responsible for:

- accepting one exact successfully validated Binding Set Snapshot;
- accepting one immutable trusted Execution Context;
- confirming the validation and context identities match the Snapshot;
- filtering candidates by exact routed and execution requirements;
- applying approved deterministic priority;
- evaluating supplied live availability without fetching it;
- traversing only the selected primary's explicit validated fallback path;
- returning one pinned Binding revision or a fail-closed result;
- producing sanitized, reproducible decision evidence.

### 5.2 Responsibilities outside Resolver

Resolver does not:

- infer or change Task classification;
- infer or change Role, Complexity, Risk, scope, or approval;
- raise or lower Logical Model Tier or reasoning requirement;
- generate, edit, or remove Binding Records;
- ignore or repair an invalid Binding Set;
- change provider outside approved Binding selection;
- retry a provider request or test provider health;
- execute Adapter or Runner operations;
- manage credentials, secrets, permission, cost budget, or billing;
- interpret Issue, Prompt, model output, or Worker preference as routing input;
- declare Task execution complete.

### 5.3 Provider selection boundary

Selecting an approved Binding inherently identifies its approved provider and deployment. This is not permission for Resolver to compare arbitrary providers or switch provider dynamically.

Primary provider identity comes only from the highest-priority eligible approved Binding. Automatic fallback across providers remains prohibited in `deployment_binding_set_v1`.

## 6. Resolver architecture

```text
Canonical Task Requirement
  |
  v
Model Routing
  |
  v
Effective Logical Tier and Reasoning Requirement
  |
  +------------------------+
  |                        |
  v                        v
Validated Binding Set   Trusted Execution Context
  |                        |
  +-----------+------------+
              |
              v
       Deployment Resolver
              |
              v
   Pinned Resolution Result
              |
              v
       Execution Adapter
              |
              v
            Runner
```

### Responsibility by boundary

| Boundary | Responsibility |
| --- | --- |
| Model Routing | Select effective provider-neutral tier and reasoning floor |
| Binding Set Semantic Validator | Prove the exact Snapshot is internally coherent and Resolver-eligible |
| Execution Context producer | Provide trusted exact runtime requirements without selecting a Binding |
| Deployment Resolver | Choose one approved Binding revision deterministically or fail closed |
| Execution Adapter | Translate the pinned Binding and approved request into one supported invocation |
| Runner | Enforce execution environment, credential, sandbox, network, tool, timeout, and lifecycle boundaries |

No downstream component can reinterpret an upstream decision.

## 7. Resolver input model

Resolver receives one immutable logical input envelope. This is a design model, not a new persisted Schema.

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `resolver_contract_version` | string constant | yes | Fixed to `deployment_resolver_v1` |
| `task_id` | opaque existing Task identity | yes | Correlation only; never a selection rule |
| `assignment_revision` | immutable approved revision reference | yes | Binds context to the admitted Task Assignment |
| `binding_set_snapshot` | immutable validated Snapshot | yes | Exact Set envelope and accepted member Records |
| `binding_set_validation` | trusted successful validation result reference | yes | Proof that the exact Snapshot passed the approved Semantic Validation version |
| `execution_context` | closed immutable object | yes | Routed and runtime compatibility requirements |
| `availability_snapshot` | closed immutable trusted input | yes | Current availability facts for exact Binding revisions |
| `evaluation_timestamp` | RFC 3339 UTC timestamp | yes | Fixed decision time used for all comparisons |

Issue text, untrusted repository content, environment defaults, model output, or mutable global configuration is not Resolver input.

## 8. Validated Binding Set input

The supplied Set input must identify:

- `contract_version`;
- `binding_set_id`;
- `binding_set_revision`;
- routing contract version;
- resolution scope reference;
- exact canonical membership;
- immutable accepted Record values;
- approval and effective-time boundary.

The validation proof must identify:

- exact Binding Set identity tuple;
- exact canonical membership;
- semantic policy or validator version;
- validation completion and successful result;
- fixed validation time;
- evidence and approval verification boundary;
- the latest time through which the validation remains usable.

Resolver rejects the input when the validation proof:

- is absent, incomplete, failed, stale, or unverifiable;
- references another Set revision or membership;
- uses an unsupported semantic-policy version;
- was produced after the Resolver `evaluation_timestamp`;
- expires at or before the Resolver `evaluation_timestamp`;
- represents only a valid subset rather than the entire Snapshot.

Resolver does not rerun Set semantics and does not accept raw Records in place of a validation proof.

## 9. Execution Context model

`execution_context` describes what the already routed Task requires. It cannot name a provider, model, deployment, Binding ID, priority, or fallback.

### 9.1 Routing requirements

| Field | Type | Required | Rule |
| --- | --- | --- | --- |
| `routing_contract_version` | string | yes | Must equal the validated Set routing contract |
| `resolution_scope_ref` | versioned reference | yes | Must equal the validated Set scope |
| `logical_tier` | enum | yes | Exact effective tier from Model Routing |
| `capability_floor_ref` | versioned reference | yes | Exact approved floor for the effective tier |
| `required_reasoning_level` | enum | yes | Exact effective reasoning requirement |

Resolver cannot raise or lower these values.

### 9.2 Context capacity requirements

| Field | Type | Required | Rule |
| --- | --- | --- | --- |
| `required_input_tokens` | non-negative integer | yes | Preflight requirement produced by an approved context estimator |
| `required_output_reserve_tokens` | non-negative integer | yes | Required response reserve from the approved response profile |
| `context_estimate_ref` | trusted versioned reference | yes | Identifies the estimator and input revision |

Resolver does not estimate tokens, truncate context, summarize input, or change response requirements.

### 9.3 Compatibility requirements

| Field | Type | Required | Rule |
| --- | --- | --- | --- |
| `execution_adapter_contract_version` | exact identifier | yes | One exact required Adapter contract |
| `runner_profile_ref` | exact reference | yes | One approved Runner profile |
| `sandbox_profile_ref` | exact reference | yes | One approved sandbox profile |
| `network_policy_ref` | exact reference | yes | One approved network policy |
| `required_tool_profile_refs` | unique set | yes | Empty means no tools required |
| `required_structured_output_profile_refs` | unique set | yes | Empty means none required |
| `response_profile_ref` | exact reference | yes | Approved Response Policy profile |

Resolver performs exact membership and subset checks. It never widens permission or drops a requirement to make a candidate fit.

### 9.4 Approved operational policy references

| Field | Type | Required | Rule |
| --- | --- | --- | --- |
| `cost_policy_ref` | versioned reference | yes | Approved policy already reflected in Binding priorities and posture |
| `availability_policy_ref` | versioned reference | yes | Approved freshness, retry-disposition, and fallback boundary |

These references do not carry price, credential, provider command, or retry execution authority.

## 10. Availability Snapshot model

Availability is supplied as an immutable trusted Snapshot for the exact Binding Set revision.

The logical input contains:

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `availability_snapshot_id` | opaque identity | yes | Identifies one immutable availability observation |
| `binding_set_id` | exact identity | yes | Must match Resolver Set input |
| `binding_set_revision` | positive integer | yes | Must match Resolver Set input |
| `observed_at` | RFC 3339 UTC timestamp | yes | Observation time |
| `valid_until` | RFC 3339 UTC timestamp | yes | Exclusive freshness boundary |
| `binding_states` | exact map by Binding revision identity | yes | One state for every member used by resolution |
| `verification_ref` | trusted reference | yes | Identifies approved availability-verification producer and revision |

Internal availability input vocabulary:

- `available`: the exact Binding revision may be selected;
- `temporarily_unavailable`: an explicit approved fallback may be evaluated after the external retry disposition permits it;
- `unknown`: fail closed;
- `not_evaluated`: fail closed because no trusted observation was completed.

This vocabulary is internal Resolver input, not a dispatch or Result Handoff status.

Resolver requires:

```text
observed_at <= evaluation_timestamp < valid_until
```

Missing, duplicate, stale, future-dated, Set-mismatched, or unverified availability facts fail closed.

## 11. Deterministic resolution flow

Resolution proceeds in the following fixed stages.

### Stage 1: Input envelope admission

Confirm:

- supported Resolver contract version;
- required fields and immutable input objects;
- fixed evaluation timestamp;
- exact Task and assignment correlation;
- no forbidden provider, model, Binding, Secret, command, or permission override in Execution Context.

Failure stops before candidate inspection.

### Stage 2: Validated Set binding

Confirm:

- successful validation result;
- exact Set identity and membership match;
- supported semantic policy version;
- validation is effective and unexpired at evaluation time.

Failure stops. Resolver does not repair or revalidate the Set.

### Stage 3: Execution Context binding

Confirm the Context routing contract, scope, tier floor, and operational policy references are approved for this Set and assignment.

Failure stops. Resolver does not infer missing context.

### Stage 4: Static candidate filtering

Filter all members in this exact order:

1. exact `logical_tier` match;
2. exact `capability_floor_ref` match;
3. Binding floor is not above the routed requirement and the deployment supports the exact required reasoning level;
4. `required_input_tokens` does not exceed `usable_input_limit_tokens`;
5. `required_output_reserve_tokens` does not exceed `reserved_output_tokens`;
6. required structured-output profiles are supported;
7. required tool profiles are present in both capability and compatibility sets;
8. response profile is present in both capability and compatibility sets;
9. exact Adapter contract compatibility;
10. exact Runner profile compatibility;
11. exact sandbox profile compatibility;
12. exact network policy compatibility;
13. approved operational policy compatibility;
14. lifecycle and effective-time eligibility already proven by the still-valid Set validation.

Live availability is intentionally not applied during static filtering. Otherwise a lower-priority Record could become an implicit fallback without an approved fallback edge.

### Stage 5: Primary priority selection

From statically eligible candidates:

- zero candidates: fail closed;
- one candidate: select it as primary;
- multiple candidates with unique priorities: select the lowest numeric `selection_priority`;
- multiple candidates sharing the winning priority: fail closed as ambiguous.

Multiple candidates before priority evaluation are expected. “Multiple candidates” is an error only when deterministic priority cannot produce one winner.

No secondary tie-breaker is permitted.

### Stage 6: Primary availability decision

Read the exact primary Binding state:

- `available`: return the primary as selected;
- `unknown` or `not_evaluated`: fail closed without fallback;
- `temporarily_unavailable`: evaluate fallback only when the trusted availability-policy input proves the approved retry disposition allows fallback evaluation.

Resolver does not execute retry or wait for availability.

### Stage 7: Explicit fallback traversal

Evaluate only the primary Binding's ordered `fallback_binding_refs` already proven valid by Set Semantic Validation.

For each target in order:

1. confirm exact target identity is still present in the validated Snapshot;
2. reapply the Execution Context compatibility checks to the target;
3. read the exact trusted availability state;
4. if `available`, select and return it with the complete fallback path;
5. if explicitly `temporarily_unavailable` and policy permits continuing, evaluate the next target;
6. if `unknown`, `not_evaluated`, missing, or stale, fail closed rather than skip the uncertainty.

Resolver never searches unrelated candidates after primary selection. A lower-priority candidate is not fallback unless the selected primary explicitly references it.

### Stage 8: Immutable Result construction

Create one immutable Resolution Result containing the exact selected Binding Record reference, decision evidence, and sanitized diagnostic information.

No execution occurs in this stage.

## 12. Candidate comparison rules

### 12.1 Exact tier rule

Primary selection requires exact Logical Model Tier match. Resolver does not promote to a higher tier merely because no exact-tier candidate exists.

Upward tier escalation must originate from the Model Routing or approved override boundary before Resolver input is created. Explicit fallback may target an equal or higher tier only because the validated fallback graph already approved that edge.

### 12.2 Reasoning rule

For a primary candidate:

- the routed `required_reasoning_level` must be present in `supported_reasoning_levels`;
- the routed level must meet or exceed the Binding's declared required floor;
- Resolver passes the routed level forward unchanged;
- provider-specific default reasoning is not a substitute.

### 12.3 Context rule

Both conditions are required:

```text
required_input_tokens <= usable_input_limit_tokens
required_output_reserve_tokens <= reserved_output_tokens
```

Resolver does not use unused output reserve as input capacity or truncate required input.

### 12.4 Profile rule

Required profile references use exact equality or set containment. Similar names, aliases, versions, and provider defaults do not match.

An empty required set means “not required.” An empty candidate support set never means “all supported.”

## 13. Priority policy

`selection_priority` is approved policy encoded in immutable Binding revisions. Lower number has higher priority.

Resolver:

- compares priority only after static eligibility filtering;
- uses priority only inside the exact Set routing contract, resolution scope, and logical tier;
- never changes priority at runtime;
- never calculates a new priority from price, latency, usage, or provider identity;
- never selects by array order, file order, creation time, revision number, model name, or random value.

Binding Set Semantic Validation should have rejected priority collisions. Resolver still fails closed if a collision appears, because it must not trust an impossible state silently.

## 14. Availability and fallback policy

### 14.1 Availability is input, not detection

Resolver does not ping a provider, inspect a queue, read billing, test credentials, or infer health from a prior failure. It consumes only the approved Availability Snapshot.

### 14.2 Temporary unavailability

Temporary unavailability does not mutate the Binding or Set and does not authorize:

- provider change;
- unlisted candidate selection;
- tier or reasoning downgrade;
- cost-only substitution;
- retry execution by Resolver.

If retry remains required by the approved policy, Resolver returns blocked decision evidence to the external runtime owner. It traverses fallback only after an explicit trusted retry disposition permits it.

### 14.3 Unknown availability

Unknown, missing, stale, or not-evaluated availability always fails closed. Resolver must not skip an uncertain earlier fallback to reach a later target.

### 14.4 Fallback outcome

If all explicit targets are confirmed temporarily unavailable, Resolution is blocked. Resolver does not search the wider Set or change provider.

## 15. Cost handling

Resolver uses only:

- approved immutable `selection_priority`;
- approved Binding `cost_class` and `budget_posture` compatibility;
- the trusted `cost_policy_ref` already associated with the Execution Context and resolution scope.

Resolver does not:

- query price or billing;
- calculate cheapest model dynamically;
- alter priority because of current cost;
- downgrade tier or reasoning because of budget, rate, or usage limits;
- accept a Worker, Issue comment, Prompt, or model request to choose a cheaper deployment.

If approved budget or capacity policy cannot be confirmed, Resolution is blocked. Cost pressure returns to the policy owner rather than changing quality requirements.

## 16. Resolution Result model

The Resolver produces one immutable logical Result. This is not a new persisted Schema or Result Handoff field.

### 16.1 Common fields

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `resolver_contract_version` | string constant | yes | `deployment_resolver_v1` |
| `status` | existing status value | yes | `completed`, `blocked`, or `failed` under the mapping below |
| `task_id` | existing Task identity | yes | Input correlation |
| `assignment_revision` | immutable reference | yes | Input correlation |
| `binding_set_id` | exact identity | yes | Evaluated Snapshot |
| `binding_set_revision` | positive integer | yes | Evaluated Snapshot revision |
| `binding_set_validation_ref` | trusted reference | yes | Successful Set validation proof |
| `evaluation_timestamp` | UTC timestamp | yes | Fixed decision time |
| `availability_snapshot_id` | opaque identity | yes | Availability input used |
| `applied_rule_refs` | ordered unique list | yes | Exact Resolver policy rules evaluated |
| `diagnostics` | sanitized ordered list | yes | Decision evidence without secrets or private paths |

### 16.2 Successful selection fields

When `status` is `completed`, require:

- `selected_binding_id`;
- `selected_binding_revision`;
- immutable read-only `selected_binding` value from the validated Set;
- `required_reasoning_level` passed forward unchanged;
- ordered `fallback_path`, empty for the primary;
- exact Adapter, Runner, sandbox, network, tool, structured-output, and response profile references used for compatibility.

The selected Binding value is returned from the validated Snapshot, not reloaded by alias. This prevents the Execution Adapter from resolving a different revision.

`completed` means only that Resolution completed with one selected Binding. It does not mean Task execution, validation, publication, or Result Handoff completed.

### 16.3 Unselected fields

When `status` is `blocked` or `failed`:

- selected Binding fields are absent;
- one or more sanitized diagnostic codes and paths explain the boundary;
- no partial candidate is presented as selected;
- no Adapter or Runner action is authorized.

`blocked` represents invalid, missing, incompatible, ambiguous, unavailable, or review-required decision input under existing workflow handling. `failed` is reserved for Resolver process failure after valid admission, not ordinary no-candidate decisions.

### 16.4 Proposed internal diagnostic candidates

These are design candidates, not new external statuses and not implemented in this task.

| Code | Condition |
| --- | --- |
| `RESOLUTION_INPUT_INVALID` | Resolver envelope or Execution Context invalid |
| `RESOLUTION_SET_NOT_VALIDATED` | Exact Set validation proof missing, failed, mismatched, or stale |
| `RESOLUTION_SCOPE_MISMATCH` | Routing contract or resolution scope mismatch |
| `RESOLUTION_CONTEXT_INSUFFICIENT` | Required context estimate or required field missing |
| `RESOLUTION_NO_CANDIDATE` | No statically compatible exact-tier Binding |
| `RESOLUTION_PRIORITY_AMBIGUOUS` | Winning priority is not unique |
| `RESOLUTION_AVAILABILITY_UNKNOWN` | Required availability fact missing, stale, unknown, or not evaluated |
| `RESOLUTION_PRIMARY_UNAVAILABLE` | Primary unavailable and fallback not yet permitted |
| `RESOLUTION_NO_AVAILABLE_FALLBACK` | No explicit confirmed available fallback |
| `RESOLUTION_COMPATIBILITY_MISMATCH` | Required capability or profile unsupported |
| `RESOLUTION_INTERNAL_FAILURE` | Resolver execution failed after valid admission |

Exact result types, code Freeze, diagnostic ordering, and serialization belong to the implementation Contract.

## 17. Audit and reproducibility

### 17.1 Reproduction inputs

A resolution is reproducible only with:

- Resolver contract and rule versions;
- exact Task and Assignment revision;
- exact Binding Set identity and canonical membership;
- successful validation proof identity;
- immutable Execution Context;
- exact Availability Snapshot;
- fixed evaluation timestamp.

Given identical trusted inputs, Resolver must return byte-equivalent logical decision content after any separately defined canonical serialization, excluding non-normative transport metadata.

This design defines no serialization or hash.

### 17.2 Applied rules

`applied_rule_refs` are versioned controlled identifiers in fixed evaluation order. They are not free-form prose and do not include model-generated reasoning or hidden chain-of-thought.

Diagnostics record observable rule outcomes such as candidate counts and rejected field categories. They must not expose secrets, credentials, private endpoints, personal paths, or unredacted provider data.

### 17.3 Persistence boundary

This design does not persist Resolution Result, add an audit Artifact, or change Result Handoff.

A future integration Contract must decide where sanitized Set identity, selected Binding identity, validation reference, evaluation time, and applied rules are stored. Until then, Resolver implementation remains a pure decision component and its caller owns transient correlation.

## 18. Fail-closed behavior

| Condition | Required behavior | Forbidden behavior |
| --- | --- | --- |
| Binding Set invalid or unvalidated | `blocked`; no candidate inspection | Repair or partially accept Set |
| Candidate count zero after static filtering | `blocked` | Select higher or lower tier automatically |
| Winning candidate count greater than one | `blocked` | Use array, file, time, revision, or random tie-breaker |
| Required context missing or insufficient | `blocked` | Truncate, summarize, or infer capacity |
| Compatibility mismatch | `blocked` | Drop tool, response, sandbox, network, Adapter, or Runner requirement |
| Availability missing, stale, or unknown | `blocked` | Treat as available or skip uncertainty |
| Primary explicitly unavailable | Approved retry disposition, then explicit fallback or `blocked` | Select any lower-priority Set member |
| Budget or cost policy unavailable | `blocked` or existing review path | Tier or reasoning downgrade |
| Resolver process exception | `failed` | Return last candidate as success |

Architect or Product Owner review can create a new approved routing, Binding, Set, or policy revision. It cannot mutate the current Resolution Result into success.

## 19. Security boundary

Resolver is a pure Decision Layer.

It must not receive, retrieve, store, log, or emit:

- API keys, access tokens, passwords, cookies, private keys, or credentials;
- private endpoints or secret provider configuration;
- provider or monitoring API responses beyond approved sanitized availability facts;
- arbitrary shell commands;
- filesystem or network permission grants;
- mutable Runner state;
- untrusted Issue or Prompt text as configuration.

Resolver must not:

- connect to a provider;
- execute repository code;
- install runtime components;
- change permissions;
- invoke Adapter or Runner;
- broaden security profiles;
- return a Binding not present in the exact validated Snapshot.

## 20. Determinism requirements

Future implementation must:

- use explicit ordered stages;
- compare controlled values with exact semantics;
- canonicalize set iteration independently of input array or map order;
- sort diagnostics by stable stage, code, and path order;
- avoid wall-clock reads by accepting `evaluation_timestamp` as input;
- avoid network, filesystem, environment, random, locale, and provider dependencies;
- never use floating aliases or global mutable defaults;
- return immutable Results and selected Binding values.

Runtime availability can change only by supplying a different immutable Availability Snapshot and evaluation input. The same input cannot observe a different answer.

## 21. Resolver test design

### Input and validation proof

- valid exact Set and validation proof;
- missing validation proof;
- failed validation proof;
- Set identity mismatch;
- membership mismatch;
- stale validation proof;
- unsupported semantic policy version;
- future-dated validation proof;
- untrusted or mutable input rejected.

### Static filtering

- exact tier match;
- no exact tier candidate;
- capability-floor mismatch;
- required reasoning supported;
- required reasoning unsupported;
- Binding floor above routed requirement;
- input context exactly at limit;
- input context over limit;
- output reserve exactly at limit;
- output reserve over limit;
- tool, structured-output, response, Adapter, Runner, sandbox, and network match and mismatch cases;
- missing required context fails closed.

### Priority

- one candidate selected;
- multiple compatible candidates with unique priorities select lowest number;
- equal winning priority fails closed;
- lower-priority candidate is not selected when primary is unavailable unless explicitly referenced as fallback;
- shuffled Record and profile order produces the same result.

### Availability and fallback

- primary available;
- primary temporarily unavailable while retry is still required;
- primary temporarily unavailable with permitted valid fallback;
- multiple ordered unavailable fallbacks then one available fallback;
- all explicit fallbacks unavailable;
- primary availability unknown;
- fallback availability unknown stops rather than skips;
- missing or stale Availability Snapshot;
- Snapshot identity mismatch;
- unrelated available candidate never becomes implicit fallback;
- Provider cannot change through fallback.

### Cost and policy

- approved priority remains authoritative;
- budget pressure does not lower tier or reasoning;
- missing cost policy blocks;
- Worker or Issue model override rejected;

### Result and reproducibility

- successful Result contains exact immutable selected Record and identity;
- blocked Result contains no selected fields;
- process failure maps to `failed` without candidate leakage;
- same inputs produce the same Result;
- fixed evaluation time prevents wall-clock drift;
- diagnostics have stable order and contain no secret-like fixture;
- no Adapter, Runner, provider, filesystem, or network call occurs.

## 22. Future implementation split

### PR A: Deployment Resolver Contract and Types

Scope:

- Freeze Resolver input, validation-proof, Availability Snapshot, Result, and diagnostic types;
- decide whether an internal JSON Schema is required;
- define canonical rule identifiers and deterministic diagnostic order;
- preserve existing Execution Request and Result Handoff contracts.

Owner: Backend Architect and Backend Implementer under separate assignments

Review: Architect Team

Merge gate: this design Frozen; no provider or Runner access

### PR B: Implement Deployment Resolver

Scope:

- implement pure input admission, static filtering, priority, availability, fallback traversal, and immutable Result construction;
- use dependency-free deterministic logic;
- add the full Resolver unit-test matrix;
- perform zero network, filesystem, provider, Adapter, Runner, or credential operation.

Owner: Backend Implementer

Review: Backend Architect

Merge gate: PR A merged and all Binding Record and Set validation contracts available

### PR C: Provider Adapter

Scope:

- accept only a successful pinned Resolution Result;
- translate the exact selected Binding into one allowlisted provider invocation;
- keep credentials inside the approved Runner security boundary.

Owner: Backend Implementer

Review: Backend Architect and designated security reviewer

Merge gate: concrete provider evaluation and Product Owner approval

### PR D: Runner Integration

Scope:

- connect Resolver output to the approved Execution Adapter boundary;
- preserve pinned Binding identity and routed reasoning requirement;
- enforce sandbox, network, tool, response, timeout, and credential separation;
- define sanitized operational evidence without changing Result Handoff implicitly.

Owner: Backend Implementer

Review: Backend Architect

Merge gate: Resolver and Provider Adapter available; approved Runner profile; no automatic merge

### PR E: Automation Trigger Integration

Scope:

- invoke routing, Set validation, Resolver, Adapter, and Runner only after existing admission and approval gates;
- preserve idempotency, cancellation, publication, and Result Handoff verification;
- never permit Issue text to override Resolver context.

Owner: Backend Implementer

Review: Backend Architect and Integrated Lead Contract reviewer

Merge gate: all lower layers merged and End-to-End security review complete

## 23. Future implementation acceptance criteria

Future Resolver implementation is acceptable only when:

1. it accepts only one exact successfully validated Binding Set Snapshot;
2. it never repairs or partially accepts invalid input;
3. Execution Context cannot name or override provider, model, Binding, priority, or fallback;
4. exact tier, capability floor, reasoning, context, profile, Adapter, Runner, sandbox, and network requirements are enforced;
5. multiple pre-priority candidates are resolved only by unique approved priority;
6. zero or ambiguous winners fail closed;
7. primary selection is independent of live availability, preventing implicit fallback;
8. only explicit validated fallback edges can be traversed;
9. unknown or stale availability fails closed;
10. cost or usage pressure cannot lower tier, reasoning, or security requirements;
11. selected Binding identity and immutable value are pinned before Adapter use;
12. identical trusted inputs produce identical logical Results;
13. no network, filesystem, provider, Adapter, Runner, credential, or persistence side effect occurs;
14. no existing Contract, Role, dispatch, Execution Request, or Result Handoff structure changes.

## 24. Deferred decisions

The following remain intentionally deferred:

- Resolver input and Result serialization or JSON Schema;
- Binding Set validation-proof implementation and persistence;
- Availability Snapshot producer, storage, freshness duration, and retry-disposition contract;
- context estimator implementation and accuracy policy;
- exact operational policy reference formats;
- diagnostic code Freeze and severity mapping;
- canonical serialization or hash;
- persistent audit and Result Handoff mapping;
- Provider Adapter and concrete deployment;
- credential mechanism;
- Runner and Execution Adapter integration;
- timeout, retry count, budget, rate, and usage policy values.

Each requires a separate Architect decision and Task Assignment.

## 25. Design confirmation

This design confirms:

- Resolver receives only a validated exact Binding Set and trusted immutable Execution Context.
- Resolver does not classify Task, change Role, Risk, Tier, reasoning floor, Binding, Provider policy, or permission.
- Primary selection is deterministic and fail-closed.
- Availability cannot create implicit fallback or Provider switching.
- Resolution Result explains the decision without hidden model reasoning or secret data.
- Existing Contract, Role, dispatch, Execution Request, Result Handoff, Runner, and research semantics remain unchanged.
- No Schema, Validator, Resolver, Provider Adapter, Runner, API, Workflow, Secret, Credential, Runtime, or Audit storage is implemented.
- Only this new Markdown design document is changed.
