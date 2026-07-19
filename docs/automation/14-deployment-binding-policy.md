# Deployment Binding Policy

Status: Design review candidate

Contract version: `deployment_binding_v1`

Task: `ARCH-DEPLOYMENT-BINDING-001`

Canonical assignment: [GitHub Issue #111](https://github.com/whatrune/sd-prompt-studio/issues/111)

## 1. Purpose

This document defines the architecture for binding the logical model tiers selected by the Model Routing Policy to approved execution deployments.

The policy keeps capability selection independent from provider and model deployment selection so that a deployment can be reviewed, replaced, or rolled back without changing task classification, role routing, dispatch state, Result Handoff, or the Model Routing Contract.

This document is a design and freeze candidate only. It does not approve a concrete provider or model, create runtime configuration, or implement resolution.

## 2. Normative sources

This policy is subordinate to and must be read with:

- [Integrated Dispatch Automation Contract](01-dispatch-contract.md)
- [Dispatch MVP Implementation Design](06-dispatch-mvp-implementation-design.md)
- [Dispatch Execution Integration Design](08-dispatch-execution-integration-design.md)
- [Runner Security Design](09-runner-security-design.md)
- [Runner Provisioning Architecture Design](10-runner-provisioning-design.md)
- [Runner Security Model](11-runner-security-model.md)
- [AI Model Routing Policy](12-model-routing-policy.md)
- [Response Policy](13-response-policy.md)
- [Delegation and Result Contract](../team/11-delegation-and-result-contract.md)

Current OpenAI product capability must be verified from official documentation when a concrete binding is proposed. Relevant capability surfaces include model and reasoning configuration, non-interactive execution, and GitHub Action configuration. This document does not freeze any current model name, command-line option, context limit, price, or availability claim.

## 3. Scope

This policy defines:

- the boundary between Logical Model Tier and Deployment Binding;
- the responsibilities of the Deployment Resolver;
- the information an approved binding must describe;
- deterministic selection, fallback, availability, cost, and rollback rules;
- evaluation evidence and approval requirements;
- security and audit boundaries;
- future implementation decomposition and acceptance criteria.

## 4. Non-goals

This policy does not:

- select or approve a concrete provider, model family, model version, or hosted deployment;
- add a JSON Schema, API, CLI, workflow, dispatcher, resolver, provider adapter, runner, or runtime implementation;
- install or configure credentials, API keys, repository secrets, environments, or network access;
- change the logical tiers or routing algorithm defined by the Model Routing Policy;
- change Role, Task Assignment, dispatch state, Result Handoff, or response contracts;
- permit Workers or Implementers to change a tier or binding;
- implement automatic provider switching;
- evaluate model quality, cost, latency, or security in this task.

## 5. Responsibility separation

### 5.1 Logical Model Tier

A Logical Model Tier expresses the capability level required by a task. It is provider-neutral and model-neutral.

The tier is selected before deployment resolution by the approved Model Routing Policy. A tier name never means a specific provider, model, price, context limit, or reasoning setting.

### 5.2 Deployment Binding

A Deployment Binding is an approved, versioned configuration record that states how one Logical Model Tier can be executed in a defined environment.

It describes model identity, declared capabilities, runtime compatibility, operational posture, evidence, and governance. It contains no secret value.

### 5.3 Deployment Resolver

The Deployment Resolver receives a previously selected tier and trusted execution context, then returns exactly one approved binding revision or a fail-closed result.

The resolver does not classify tasks, lower risk, select a different Role, interpret Issue free text, or invent a default deployment.

### 5.4 Execution Adapter and Runner

The Execution Adapter translates the resolved binding into a future supported invocation. The Runner provides the approved execution environment and credentials through its own security boundary.

Neither component may reinterpret the logical tier or silently substitute another binding.

## 6. Binding architecture

```text
Task
  |
  v
Model Routing
  |
  v
Effective Logical Tier
  |
  v
Deployment Resolver
  |
  v
Approved Deployment Binding Revision
  |
  v
Execution Adapter
  |
  v
Runner
```

The transition from routing to resolution is one-way for an execution attempt. Deployment availability or cost must not cause the resolver to rewrite task complexity, risk, Role, or the effective logical tier.

Before execution starts, the selected binding revision must be pinned in trusted execution context. An in-flight execution continues to identify the pinned revision even if the active binding changes later.

## 7. Logical tier mapping

The following mapping adds deployment expectations without changing the meanings frozen by the Model Routing Policy.

| Tier | Quality expectation | Cost posture | Latency expectation | Availability requirement | Allowed usage |
| --- | --- | --- | --- | --- | --- |
| `efficient` | Meets the task-specific quality floor for deterministic, repeatable work | Cost-first after the quality and security floor is met | Prefer lower latency | Approved deployment or approved equivalent must be available; otherwise stop | Low-risk extraction, formatting, inventory, and other repeatable tasks allowed by Role routing |
| `general` | Reliable multi-step implementation and review quality | Balance quality, cost, and latency | Normal interactive or automation latency | Stable approved deployment with an explicit availability posture | Normal implementation, multi-file change, tests, and routine technical review |
| `advanced` | Highest approved reasoning and review quality for the task class | Quality-first; higher cost is acceptable within approved budget | Higher latency is acceptable | No fallback below the advanced capability floor; unavailable service stops or escalates | Architecture, security, Contract work, high-risk review, and research review allowed by Role routing |

These are expectations, not provider claims. A deployment is not eligible merely because it is marketed with a similar label.

## 8. Deployment Binding model

The following is a documentation-level logical model. It is not a storage Schema and does not authorize a new persistent Artifact.

### 8.1 Identity and lifecycle

An approved binding must identify:

- `contract`: fixed to `deployment_binding_v1`;
- `binding_id`: stable logical identifier;
- `binding_revision`: immutable positive revision identifier;
- `logical_tier`: one of `efficient`, `general`, or `advanced`;
- lifecycle state: design-time binding state such as draft, approved, deprecated, or retired;
- effective date or activation record;
- superseded revision, when applicable;
- approved rollback target, when applicable.

Binding lifecycle vocabulary is internal to Deployment Binding governance. It does not add or alter dispatch or Result Handoff status values.

### 8.2 Model identity

An approved binding must describe:

- provider identity;
- model family;
- exact model version or exact provider deployment identifier;
- declared capability profile;
- provider-specific deployment profile reference, if required.

Floating values such as `latest`, unbounded wildcards, or a family name without an exact resolvable version are not valid for an approved production binding.

Provider profile references must not contain credentials, private tokens, or secret endpoint parameters.

### 8.3 Runtime compatibility

An approved binding must describe:

- supported reasoning settings required by the routed tier;
- declared context capacity and the evidence source for that capacity;
- tool-use compatibility;
- structured-output or response-profile compatibility;
- sandbox and network-policy compatibility;
- Execution Adapter compatibility;
- Runner profile compatibility.

The binding describes compatibility. It does not grant filesystem, network, tool, or credential permission. Those permissions remain controlled by the approved Execution Request, adapter, and Runner security contracts.

### 8.4 Operational posture

An approved binding must describe or reference:

- availability classification;
- latency evaluation class;
- cost evaluation class;
- monitoring profile;
- capacity or usage constraints relevant to safe execution;
- approved retry policy reference;
- explicit approved fallback references, if any.

Cost and latency classes are reviewed policy inputs. They are not hard-coded price claims or guarantees.

### 8.5 Governance

An approved binding must identify:

- approval owner and approval record;
- architecture and security review evidence;
- capability, quality, cost, latency, and availability evidence references;
- change rationale;
- rollback plan;
- review or expiry date where operational evidence can become stale.

The existing Product Owner and Architect Team retain their current authorities. This policy creates no new approval Role.

## 9. Resolver contract

### 9.1 Trusted inputs

The future resolver may use only trusted, validated inputs:

- effective Logical Model Tier from the Model Routing Policy;
- required reasoning and execution capabilities;
- approved Runner and Execution Adapter compatibility context;
- the approved binding set and revision metadata;
- approved availability state and policy inputs.

Issue body free text, model output, Worker preference, or unapproved repository content must not directly choose a provider, model, reasoning setting, or fallback.

### 9.2 Deterministic resolution

Resolution must:

1. filter to bindings whose lifecycle is approved and active;
2. require exact Logical Model Tier compatibility;
3. require the routed reasoning, response, adapter, tool, sandbox, network, and Runner compatibility;
4. require an allowed availability state;
5. apply an approved, deterministic priority order;
6. return exactly one immutable binding revision.

If zero or more than one eligible binding remains at the same priority, resolution fails closed. The task is blocked or returned for Architect review; no default is inferred.

### 9.3 Execution pinning

The selected `binding_id` and `binding_revision` must be fixed before invocation and made available to future sanitized diagnostics and Result Handoff mapping.

Changing the active binding after resolution does not mutate an in-flight Execution Request. A retry that changes binding revision is a new resolution decision and must be auditable.

## 10. Cost policy

Cost optimization is subordinate to required quality, risk, security, and Contract compatibility.

- `efficient` prefers the lowest-cost approved binding that meets its quality floor.
- `general` balances quality, cost, latency, and availability using approved evaluation evidence.
- `advanced` prioritizes the approved quality and capability floor over cost.

The following are forbidden:

- lowering the effective tier only because budget, rate, or usage capacity is constrained;
- selecting a binding that does not meet the routed reasoning or security requirements;
- allowing a Worker, Implementer, model, or Runner to alter the tier;
- treating a cheaper unapproved deployment as equivalent;
- embedding mutable provider pricing as a normative constant in this Contract.

When no approved binding meets both the capability floor and the active cost policy, execution stops and returns to the designated human owner. It does not silently degrade.

## 11. Fallback policy

Fallback is allowed only when all of the following are true:

- the fallback binding revision is explicitly listed in the approved binding set;
- it is approved and active;
- it meets the same or a higher logical capability floor;
- it is compatible with the same Runner, adapter, response, sandbox, network, and tool boundaries;
- the failure occurred before an irreversible or non-idempotent side effect;
- the fallback decision is captured in the future audit trail.

For `deployment_binding_v1`, automatic cross-provider fallback is prohibited. A provider change requires a separately reviewed binding decision and human-controlled re-resolution.

The following are forbidden:

- changing to an unapproved model;
- interpreting a provider family alias as an approved equivalent;
- changing provider implicitly;
- lowering quality because of cost alone;
- crossing a security or data-residency boundary;
- retrying indefinitely;
- using fallback to hide a deprecated or retired primary binding.

If no eligible fallback exists, the resolver returns a fail-closed outcome for dispatch to represent as blocked or requiring Architect review under existing status contracts.

## 12. Availability policy

Availability information is an operational input, not authority to select a new deployment.

The future binding lifecycle and operational assessment must distinguish at least these meanings:

- approved and available for new execution;
- temporarily unavailable;
- deprecated with an approved transition plan;
- retired and forbidden for new execution;
- unknown or unverifiable.

Behavior:

- available: normal deterministic resolution is allowed;
- temporarily unavailable: apply only an approved bounded retry policy, then an approved eligible fallback, otherwise stop;
- deprecated: do not extend use beyond the approved transition conditions; replacement requires review and evaluation;
- retired: never select for new execution;
- unknown: fail closed.

Model version retirement, provider capability change, material latency or cost change, and security finding all trigger binding review. They do not authorize automatic migration.

## 13. Evaluation evidence

A concrete deployment must not become approved without reviewable evidence for:

- capability: official provider documentation and verified compatibility with the required invocation surface;
- quality: task-class evaluation against representative fixtures and acceptance criteria;
- cost: measured or provider-published cost evidence with date and assumptions;
- latency: measured distribution or service evidence for the intended environment;
- availability: operational availability and capacity evidence;
- security: credential, data flow, network, logging, retention, and supply-chain review;
- compatibility: Execution Adapter, response profile, tool, sandbox, network, and Runner validation.

Evidence references must identify the evaluated model or deployment revision, evaluation environment, date, and evaluator. A model's self-description is not sufficient approval evidence.

This task performs none of these evaluations and adopts no deployment.

## 14. Version management and change control

### 14.1 Contract and revision

`deployment_binding_v1` identifies this logical binding Contract. Each approved binding has an immutable `binding_revision`.

This document does not define a content hash, Artifact hash, storage Schema, or repository registry. Those require a separate Contract and Schema review.

### 14.2 Revision-required changes

An approved binding must not be edited in place. A new revision and review are required when changing:

- provider, model family, exact model version, or deployment identity;
- declared capability or context capacity;
- reasoning, response, tool, sandbox, network, adapter, or Runner compatibility;
- cost, latency, availability, retry, or fallback policy;
- evidence or security posture that changes eligibility;
- approval conditions or rollback target.

### 14.3 Approval and rollback

A new revision requires architecture review, the existing Product Owner approval where product or cost policy is affected, and the security review required by the Runner boundary.

Rollback is permitted only to a previously approved revision that is still available, compatible, and security-valid. Rollback affects future resolution only. It does not rewrite past Result Handoffs or mutate an in-flight execution.

Automatic rollback after a partial side effect is prohibited. Recovery follows the existing dispatch and execution failure contracts.

## 15. Security boundary

Deployment Binding is configuration design, not secret or runtime management.

It must not contain or implement:

- API keys, access tokens, credentials, cookies, or private keys;
- secret values or instructions for retrieving them;
- credential registration or rotation;
- provider API connection code;
- unrestricted endpoint or command injection;
- runtime installation;
- automatic provider switching;
- new filesystem, network, sandbox, or tool permissions.

Security requirements:

- provider and model selection comes only from reviewed, version-controlled trusted configuration;
- Task Assignment and Issue free text cannot override a binding;
- Runner credentials remain isolated under the Runner Security Model;
- public logs and Result Handoffs contain only sanitized binding identity and revision, never secret configuration;
- repository changes to binding policy require normal review and cannot take effect merely because an untrusted pull request modifies a file;
- the adapter must reject unsupported binding fields rather than forward arbitrary provider parameters.

## 16. Audit and monitoring boundary

A future execution audit should be able to correlate:

- task and workflow run identity;
- effective Logical Model Tier;
- resolved binding ID and revision;
- fallback or retry decision, if any;
- adapter and Runner compatibility profile;
- sanitized start, end, status, and usage evidence;
- approval and evaluation references.

This policy adds no Result Handoff field and no persistent evaluation Artifact. Any storage change requires a separate Contract and backward-compatibility review.

Monitoring can identify availability, latency, cost, or quality drift. Monitoring evidence can trigger review but cannot directly approve a deployment, change the tier, or switch provider.

## 17. Failure behavior

| Condition | Required behavior | Forbidden behavior |
| --- | --- | --- |
| No approved binding | Stop and request Architect review | Use a default or family alias |
| Multiple equal-priority bindings | Stop as ambiguous | Pick by array order or latest timestamp |
| Binding incompatible with Runner or adapter | Stop before invocation | Drop unsupported settings |
| Temporary unavailability | Approved bounded retry, then eligible approved fallback or stop | Unlimited retry or tier downgrade |
| Deprecated or retired version | Follow approved transition or stop | Silent migration |
| Cost or usage limit | Stop or escalate under existing workflow | Quality-floor downgrade |
| Security evidence invalid or stale | Fail closed and review | Continue for availability |
| Fallback would cross provider | Require a separately approved human decision | Automatic provider switch |
| Change occurs after execution was pinned | Keep the pinned identity for that attempt | Mutate the in-flight request |

Existing dispatch and Result Handoff statuses remain authoritative. This policy does not introduce a new external status vocabulary.

## 18. Acceptance criteria for future implementation

A future resolver implementation is acceptable only when it demonstrates:

1. the same trusted inputs always produce the same binding revision;
2. Issue free text and model output cannot select or override a binding;
3. zero or multiple eligible bindings fail closed;
4. the effective tier is never lowered by resolver, cost, or availability logic;
5. only approved and active revisions can be selected;
6. the selected revision is pinned before execution;
7. an unavailable binding uses only an explicit approved fallback and never automatically changes provider in v1;
8. Runner and adapter incompatibility stops before invocation;
9. no credential or secret enters the binding record, log, or Result Handoff;
10. rollback applies only to future resolution and is fully auditable;
11. existing dispatch, Role, Task Assignment, response, and Result Handoff Contracts remain unchanged;
12. tests cover ambiguity, missing binding, deprecation, retirement, compatibility mismatch, cost pressure, fallback, and stale evidence.

## 19. Future implementation split

### PR A: Deployment Binding Schema Design

Scope:

- decide whether a stored binding Artifact and JSON Schema are necessary;
- define versioning, required fields, closed-object behavior, lifecycle validation, and compatibility rules;
- define migration and backward-compatibility policy.

Owner: Backend Architect

Review: Architect Team and Security reviewer

Merge gate: Product Owner approval of the Contract; no concrete provider adoption implied

### PR B: Deployment Resolver Implementation

Scope:

- implement pure deterministic filtering and unique selection;
- implement validation of approved lifecycle and compatibility inputs;
- implement fail-closed resolution results and unit tests.

Owner: Backend Implementer

Review: Backend Architect

Merge gate: PR A Freeze and complete resolver test matrix

### PR C: Provider Adapter

Scope:

- implement one explicitly approved provider integration;
- translate only allowlisted binding settings;
- keep credential retrieval inside the approved Runner security boundary.

Owner: Backend Implementer

Review: Backend Architect and Security reviewer

Merge gate: concrete deployment evaluation and Product Owner approval

### PR D: Runner Integration

Scope:

- inject the resolved, pinned binding into the existing Execution Adapter boundary;
- verify sandbox, network, tool, response, timeout, and sanitized observability behavior;
- preserve existing dispatch and Result Handoff semantics.

Owner: Backend Implementer

Review: Backend Architect

Merge gate: PR B and PR C, provisioned Runner acceptance, no automatic merge

### PR E: Evaluation and Operations

Scope:

- create approved quality, cost, latency, availability, and security evaluation procedures;
- define monitoring review cadence and deprecation runbook;
- exercise rollback without changing historical execution identity.

Owner: Architect Team and designated operations reviewers

Review: Product Owner

Merge gate: evidence review and explicit operational approval

## 20. Deferred decisions

The following remain intentionally undecided:

- provider and concrete model selection;
- exact deployment identifiers and regional placement;
- exact reasoning settings supported by each deployment;
- exact context limits, tool capabilities, price, latency, and availability targets;
- binding storage location and Schema;
- binding identity hash or Artifact hash;
- resolver API and implementation language;
- provider adapter and authentication mechanism;
- retry counts, timeout values, and monitoring retention;
- whether cross-provider fallback is introduced in a future Contract version.

These decisions require current official capability evidence, evaluation, security review, and the appropriate Product Owner approval.

## 21. Freeze confirmation

This design preserves the following boundaries:

- Logical Model Tier remains provider-neutral and model-neutral.
- The Model Routing Policy remains unchanged.
- Existing Role, Task Assignment, dispatch, response, and Result Handoff Contracts remain unchanged.
- No concrete deployment is adopted.
- No Code, Schema, Workflow, Runner, Dispatcher, API, Secret, credential, or runtime behavior is added.
- No automatic provider switch or quality-floor downgrade is authorized.
- Future implementation must begin with a separately reviewed Contract and Task Assignment.
