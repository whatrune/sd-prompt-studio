# AI Model Routing and Response Policy Architecture

Status: Design review candidate

Task: `ARCH-MODEL-ROUTING-DESIGN-001`

Canonical assignment: [GitHub Issue #125](https://github.com/whatrune/sd-prompt-studio/issues/125)

Target logical contract: `model_routing_response_architecture_v1`

Relationship to PR #107: separate follow-up; the approved policies from PR #107 remain authoritative and unchanged.

## 1. Purpose

This document defines the upstream architecture that converts a trusted Task Assignment and approved classification inputs into deterministic model capability requirements, response requirements, and context requirements for a future Execution Context producer.

The architecture exists so that automation can answer these questions without choosing a provider, model, deployment, or Binding:

- What is the minimum Logical Model Tier required by the Task?
- What is the minimum reasoning level required by the Task?
- Which approved response profile applies to the assigned Role and output requirement?
- Which context is required, optional, or forbidden?
- Which requirements must be passed unchanged toward Deployment Resolver?
- When must routing stop for missing input, conflicting policy, or an authority boundary?

This task is design only. It does not implement a Model Router, Context Loader, token estimator, Response Renderer, Deployment Resolver, Provider Adapter, Execution Adapter, or Runner.

## 2. Normative sources and precedence

This architecture is subordinate to the following existing contracts and implementations:

1. [AI Model Routing Policy Design](12-model-routing-policy.md)
2. [Automation Response Policy Design](13-response-policy.md)
3. [Deployment Binding Policy](14-deployment-binding-policy.md)
4. [Deployment Binding Schema Design](15-deployment-binding-schema-design.md)
5. [Binding Set Semantic Validation Policy](16-binding-set-semantic-validation-policy.md)
6. [Deployment Resolver Design](17-deployment-resolver-design.md)
7. [Task Assignment Template](../team/07-task-assignment-template.md)
8. [Delegation and Result Contract](../team/11-delegation-and-result-contract.md)
9. [Repository working rules](../../AGENTS.md)
10. Deployment Resolver contract and core under `src/deployment-resolver/`

This document integrates the boundaries above. It does not change their Role names, Status vocabulary, Logical Tier meaning, reasoning vocabulary, Result Handoff fields, approval authority, or Resolver input contract.

If this document conflicts with a normative source, routing stops and returns to Architect review. A future implementation must not resolve such a conflict by silently preferring the newest file or the most permissive interpretation.

## 3. Scope

This design defines:

- Model Routing responsibility and non-responsibility;
- trusted logical inputs and their provenance requirements;
- deterministic Tier and reasoning-floor calculation;
- response-profile and context-policy selection;
- the logical Routing Decision;
- the boundary between Routing Decision and Resolver Execution Context;
- cost, escalation, failure, security, and audit behavior;
- future implementation split and acceptance-test design.

## 4. Non-goals

This design does not:

- select a provider, model family, model version, deployment, Binding, or fallback;
- query model availability, pricing, usage limits, or runtime health;
- add or change a Deployment Binding, Binding Set, Resolver, Adapter, Runner, Workflow, Dispatcher, API, CLI, or Schema;
- read files, fetch URLs, load context, summarize required context, or estimate tokens;
- execute a Task or create a Result Handoff;
- change Task classification, assigned Role, scope, approval, risk, or Product priority;
- interpret arbitrary Issue text as trusted routing metadata;
- generate or store chain-of-thought or private reasoning;
- add a new Result Status, Receipt, audit Artifact, hash contract, or persistent registry;
- change Existing Run, Research Artifact, Observation, Evidence, or Research Claim data.

## 5. End-to-end boundary

```text
Canonical Task Assignment
        |
        v
Admission and Role Binding
        |
        v
Approved Classification Inputs
        |
        v
Model Routing
  - capability floor
  - logical tier
  - reasoning requirement
  - response policy reference
  - context policy reference
        |
        v
Routing Decision
        |
        +-----------------------------+
        |                             |
        v                             v
Context Planner / Estimator     Compatibility Profile Resolver
        |                             |
        +--------------+--------------+
                       v
              Execution Context Assembler
                       |
                       v
            Resolver Execution Context
                       |
                       v
              Deployment Resolver
                       |
                       v
          Pinned Deployment Binding Revision
```

The arrows mean validated data transfer, not authority transfer. No downstream component may reinterpret an upstream Role, scope, risk, Tier, reasoning floor, or approval decision.

## 6. Responsibility model

### 6.1 Admission and Role Binding

The existing Dispatcher and Role contracts establish that the Task Assignment is canonical, approved, current, and assigned to one exact supported Role. Model Routing consumes this result; it does not repeat admission or infer aliases.

### 6.2 Model Routing

Model Routing is a pure deterministic decision boundary. It:

- validates the presence and provenance of routing inputs;
- obtains approved Role, Complexity, and Risk floors;
- computes the effective Logical Tier and reasoning requirement;
- selects approved response and context policy references;
- records applied rule references and sanitized rationale;
- returns one Routing Decision or a fail-closed outcome.

Model Routing does not load context, estimate token counts, resolve compatibility profiles, or select a Binding.

At the subsystem level, Model Routing is accountable for supplying the routing-controlled fields of a complete Resolver Execution Context. The pure Router produces those requirements in `RoutingDecision`; the separately reviewed planner, estimator, profile resolver, and assembler provide the non-routing fields. This decomposition satisfies the Execution Context generation responsibility without moving I/O, capacity estimation, or execution-environment selection into the pure decision core.

### 6.3 Context Planner and Estimator

A future Context Planner interprets the selected context policy against the exact Task references. A future approved estimator produces:

- `required_input_tokens`;
- `required_output_reserve_tokens`;
- `context_estimate_ref`.

It may not omit required context to fit a cheaper deployment. This component is outside this task and requires a separate contract.

### 6.4 Compatibility Profile Resolver

A future trusted component resolves approved exact references for:

- Execution Adapter contract;
- Runner profile;
- sandbox profile;
- network policy;
- required tool profiles;
- required structured-output profiles;
- cost policy;
- availability policy.

It does not select a provider or Binding. This component is outside this task and requires a separate contract.

### 6.5 Execution Context Assembler

The assembler combines a valid Routing Decision with valid context estimates and compatibility references into the exact `ResolverExecutionContext` already defined by Deployment Resolver. It may validate equality and completeness but may not raise, lower, infer, or repair routing requirements.

### 6.6 Deployment Resolver

Deployment Resolver receives the completed trusted Execution Context and an already validated Binding Set. It selects one approved Binding revision or fails closed. It does not classify the Task or change routing requirements.

### 6.7 Response processing

The response profile controls presentation and output compatibility. A future Response Renderer or parser may apply that profile after execution. It may not remove mandatory Result Handoff fields, hide failures, or convert runtime success into Task completion.

## 7. Trusted Routing Input model

The logical input is `RoutingInput`. This is a design model, not a new persistent Schema.

| Field | Required | Source and rule |
| --- | --- | --- |
| `routing_contract_version` | yes | Exact supported version of the approved routing policy |
| `task_id` | yes | Exact Canonical Assignment identifier |
| `assignment_revision` | yes | Immutable Assignment revision reference |
| `canonical_record` | yes | Directly accessible approved Assignment location |
| `assigned_role` | yes | Exact Canonical Role from validated admission output |
| `task_type` | yes | Approved task taxonomy value; no keyword inference |
| `complexity` | yes | Approved `low`, `medium`, or `high` classification and source reference |
| `risk_level` | yes | Approved risk classification and source reference |
| `required_output_type` | yes | Approved output category, not free-form formatting instructions |
| `structured_output_requirement` | yes | Approved profile requirement or explicit none |
| `context_requirement` | yes | Required, optional, and forbidden context categories and source references |
| `validation_requirement` | yes | Exact required validation policy reference |
| `latency_requirement` | yes | Approved logical posture; not a provider-specific timeout |
| `security_requirement` | yes | Exact approved security-policy references |
| `routing_policy_ref` | yes | Immutable reference to the applied routing policy |
| `response_policy_ref` | yes | Immutable reference to the applied response policy |
| `evaluation_timestamp` | yes | Trusted caller-supplied UTC time used for evidence validity |

Every classified value must carry or be traceable to its approved source. The Router must not derive authoritative values from prose, changed-file counts, model self-assessment, a previous conversation, or repository contents not named by the Assignment.

### 7.1 Preconditions

Routing begins only when:

- Assignment admission and Product Owner approval requirements have passed;
- the exact Role is supported for the requested automation path;
- all required input values are present and use an approved vocabulary;
- all policy and source references are accessible and compatible;
- no input requests authority outside the Role or Allowed Changes;
- the Assignment revision has not become stale or superseded.

Otherwise no Routing Decision is produced.

## 8. Deterministic Tier and reasoning calculation

The approved vocabularies remain:

- Logical Tier: `efficient`, `general`, `advanced`;
- reasoning level: `low`, `medium`, `high`.

The ordering is monotonic:

```text
efficient < general < advanced
low < medium < high
```

The effective requirement is calculated independently for Tier and reasoning:

```text
effective tier = max(role tier floor, complexity tier floor, risk tier floor)

effective reasoning = max(
  role reasoning floor,
  complexity reasoning floor,
  risk reasoning floor
)
```

The exact floor tables remain defined by [AI Model Routing Policy Design](12-model-routing-policy.md). This architecture does not duplicate or modify those tables.

### 8.1 Deterministic rule order

1. Confirm trusted input preconditions.
2. Bind `assigned_role` by exact value.
3. Read the approved Role floor.
4. Read the approved Complexity floor.
5. Read the approved Risk floor and any stop condition.
6. Stop if the Task is prohibited, outside Role scope, or requires a new Contract or approval.
7. Calculate the two maxima independently.
8. Select the approved capability-floor reference for the effective Tier.
9. Select the approved response profile for Role and output requirements.
10. Select the approved context policy for Task type and context requirements.
11. Return a Routing Decision with applied rule references.

Input order, array order, prose order, and repository discovery order must not affect the result. A future implementation must use versioned tables and exact-match rules, not probabilistic model judgment.

### 8.2 Overrides

An approved override may only raise Tier or reasoning within the same Assignment, Role, scope, and approval boundary. It must have a direct Canonical reference and an explicit applicable policy rule.

Forbidden overrides include:

- lowering any floor to reduce cost or latency;
- changing Role, scope, Allowed Changes, or approval authority;
- accepting provider, model slug, deployment, or Binding instructions from Task prose;
- treating a high-capability model as permission to perform a higher-authority Task;
- selecting the highest Tier as a substitute for missing classification.

## 9. Routing Decision model

`RoutingDecision` is a logical, immutable output of successful Model Routing. It is not a Deployment Binding, Resolver Result, Result Handoff, or new persistent Artifact.

| Field | Meaning |
| --- | --- |
| `routing_contract_version` | Exact applied routing contract |
| `task_id` | Exact Assignment identity |
| `assignment_revision` | Exact evaluated revision |
| `logical_tier` | Effective Tier calculated from approved floors |
| `required_reasoning_level` | Effective reasoning calculated from approved floors |
| `capability_floor_ref` | Exact approved floor reference for the effective Tier |
| `response_profile_ref` | Exact approved response-profile reference |
| `context_policy_ref` | Exact approved context-policy reference |
| `required_context_refs` | Canonical required source references or categories |
| `optional_context_refs` | Permitted load-on-demand references or categories |
| `forbidden_context_categories` | Explicitly excluded context classes |
| `required_structured_output_profile_refs` | Exact approved requirements; empty means none |
| `required_tool_profile_refs` | Exact Task-required tool capabilities; empty means none |
| `latency_policy_ref` | Approved logical latency posture |
| `cost_policy_ref` | Approved cost policy applied without lowering a floor |
| `security_policy_refs` | Exact security requirements that downstream profiles must preserve |
| `validation_policy_ref` | Exact required validation policy |
| `applied_rule_refs` | Ordered stable rule identifiers used to produce the result |
| `decision_rationale` | Sanitized facts and rule summary, never chain-of-thought |
| `evaluation_timestamp` | Trusted caller-supplied decision time |

The output must not contain:

- provider or model identity;
- deployment or Binding identity;
- Binding priority or fallback path;
- availability result;
- credential, endpoint, token, or Secret;
- shell command or runtime invocation argument;
- inferred Role, Product decision, Research judgment, or hidden reasoning.

### 9.1 Idempotency and reproducibility

The same normalized Routing Input, policy revisions, and evaluation timestamp must produce the same Routing Decision. A future implementation must not read wall-clock time, environment variables, current provider availability, or mutable external state during calculation.

`applied_rule_refs` and `decision_rationale` provide review evidence. They are not an instruction to expose internal reasoning traces.

## 10. Response Policy architecture

Response Policy determines how an execution result must be represented for its Role and output requirement. It does not determine Task success and does not replace the Canonical Result Handoff.

### 10.1 Profile responsibilities

An approved response profile defines:

- presentation intent and expected level of detail;
- structured-output compatibility requirement;
- required summary categories;
- output reserve posture used by the future estimator;
- redaction and prohibited-content requirements;
- references to the mandatory Handoff contract.

### 10.2 Role posture

| Role family | Default response posture |
| --- | --- |
| Worker | concise, structured inventory or deterministic result; no Contract judgment |
| Backend or Frontend Implementer | changed behavior, files, validation, boundaries, blockers |
| Architect Team | decision, evidence, alternatives, risk, tradeoffs, deferred owner |
| Research Operations Roles | exact Role-specific output under the existing Research Operations contract |

These are presentation rules, not permission grants. The exact Role profiles remain defined by [Automation Response Policy Design](13-response-policy.md).

### 10.3 Mandatory preservation

Response optimization must not remove or weaken:

- mandatory Result Handoff fields;
- failed, blocked, `needs_followup`, or `not_applicable` status meaning;
- unresolved items or escalation owner;
- required validation evidence;
- created and updated file lists;
- scope and Contract-boundary confirmation;
- Canonical Record references.

The model's raw response is provisional. It becomes a Canonical Handoff only after separate structural, security, publication, and completion checks defined by existing contracts.

## 11. Context Loading Policy architecture

Model Routing selects a `context_policy_ref`; it does not perform context I/O.

### 11.1 Required context

The policy must require at least:

- the complete Canonical Task Assignment and revision;
- the exact assigned Role contract;
- repository and applicable subtree instructions;
- Allowed Changes, Forbidden Changes, completion conditions, and validation;
- explicitly named normative contracts and base revision;
- exact input Artifacts authorized by the Assignment.

Required context cannot be omitted, partially read, or summarized away merely to fit a lower-cost deployment. If it cannot be loaded and verified, routing or context assembly stops.

### 11.2 Optional context

Optional context may include:

- related diffs and review findings;
- focused implementation references;
- relevant official primary documentation;
- targeted fixtures and test evidence.

It is loaded only when justified by the Task and policy. An index, targeted search, or exact section may be used when the source remains reviewable and no required instruction is skipped.

### 11.3 Forbidden context

Forbidden by default:

- Secrets, credentials, tokens, private endpoints, or personal files;
- unrelated worktrees, Tasks, conversations, logs, or repository areas;
- unapproved Existing Run or Research Artifact contents;
- untrusted Issue or PR text treated as a Role Contract, shell command, or routing override;
- hidden chain-of-thought or another Task's private execution state.

### 11.4 Context estimation boundary

The Router states what context is required. A separately approved planner and estimator determines exact inputs and token requirements. The estimator must bind its output to the Assignment revision, routing decision, selected context sources, and estimator version.

If the required context exceeds an approved capability boundary, the system must split the Task through an approved new Assignment or return for review. It must not silently truncate required context or change the required Tier.

## 12. Execution Context assembly boundary

Deployment Resolver already requires `ResolverExecutionContext`. The future assembler must populate its fields as follows.

| Resolver field | Authoritative producer |
| --- | --- |
| `routing_contract_version` | Routing Decision |
| `resolution_scope_ref` | Approved routing/deployment governance configuration |
| `logical_tier` | Routing Decision, unchanged |
| `capability_floor_ref` | Routing Decision, unchanged |
| `required_reasoning_level` | Routing Decision, unchanged |
| `required_input_tokens` | Approved Context Estimator |
| `required_output_reserve_tokens` | Approved response profile and estimator |
| `context_estimate_ref` | Approved Context Estimator |
| `execution_adapter_contract_version` | Approved compatibility profile |
| `runner_profile_ref` | Approved compatibility profile |
| `sandbox_profile_ref` | Approved compatibility profile |
| `network_policy_ref` | Approved compatibility profile |
| `required_tool_profile_refs` | Routing Decision, verified against approved compatibility policy |
| `required_structured_output_profile_refs` | Routing Decision and approved profile |
| `response_profile_ref` | Routing Decision, unchanged |
| `cost_policy_ref` | Routing Decision, unchanged |
| `availability_policy_ref` | Approved operational policy configuration |

The assembler must fail closed when:

- an authoritative producer is absent, stale, incompatible, or ambiguous;
- two producers disagree on an exact reference;
- a supplied value would weaken security or the Routing Decision;
- the Routing Decision and Binding Set routing contract versions differ.

The assembler does not select a provider, model, deployment, Binding, priority, or fallback.

## 13. Cost and latency policy

Cost optimization occurs only after capability, Role, scope, risk, security, validation, and context requirements are preserved.

Allowed optimization:

- choose the minimum Tier and reasoning level that meet all approved floors;
- use targeted optional context instead of unrelated bulk context;
- avoid rereading identical verified sources within the same execution;
- keep user-facing summaries concise while preserving the full Canonical Handoff;
- select an approved logical latency posture compatible with the Task.

Forbidden optimization:

- downgrade below any floor;
- remove required context, tools, validation, evidence, or output reserve;
- change provider or deployment dynamically;
- weaken sandbox, network, security, or approval requirements;
- use runtime price or usage data to alter a frozen Routing Decision;
- declare success when a compliant execution cannot be obtained.

Pricing lookup, billing APIs, rate-limit handling, retry execution, and concrete budgets are outside this design.

## 14. Failure and escalation

This design uses existing Task and Handoff statuses only. It does not add an internal result to the public status vocabulary.

| Condition | Required behavior | Owner |
| --- | --- | --- |
| Missing or untrusted Assignment input | `blocked`; no Routing Decision | Assigning Role / Integrated Lead |
| Unknown or ambiguous Role, Task type, Complexity, or Risk | `blocked`; no highest-Tier guess | Architect Team |
| Contract or policy conflict | `blocked`; preserve conflicting references | Architect Team |
| Product, priority, scope, or Role decision required | `blocked` or `needs_followup` as applicable | Product Owner |
| Required context unavailable | `blocked`; do not truncate or infer | Input owner |
| Required profile or policy reference unavailable | `blocked`; do not substitute | Architect Team |
| Cost or latency target cannot meet the floor | `needs_followup` or `blocked`; no downgrade | Product Owner / Architect Team |
| Routing implementation processing defect | `failed`; sanitized diagnostic | Backend Implementer |
| Resolver or deployment unavailable after valid routing | preserve Routing Decision; defer to downstream contract | Downstream owner |

An escalation must identify the failed stage, affected reference, decision owner, and safe next action. Escalation cannot be implemented as an implicit Role change or a model-capability upgrade.

## 15. Security boundary

Model Routing operates on trusted normalized metadata only.

Required safeguards for a future implementation:

- exact allowlists for Role, Task type, Complexity, Risk, profiles, and policy versions;
- immutable source references for every authoritative value;
- rejection of provider/model/deployment instructions in untrusted prose;
- no evaluation of arbitrary shell commands;
- no network, filesystem, credential, or Secret access in the pure decision core;
- sanitized diagnostics without raw prompt, Secret, personal path, or unrelated context;
- no use of repository-modified policy unless it passed the required approval boundary;
- deterministic output independent of environment and runtime availability;
- strict separation of routing requirements from execution permissions.

Higher Tier or reasoning does not grant broader tools, network access, filesystem access, Role authority, or approval rights.

## 16. Audit and evidence boundary

A future caller may record routing evidence within an already approved execution or Handoff record. The minimum reviewable evidence is:

- Task ID and Assignment revision;
- routing, response, context, validation, and security policy references;
- exact input classification references;
- selected Tier, reasoning, capability floor, response profile, and context policy;
- stable applied rule references;
- sanitized decision rationale;
- evaluation timestamp and implementation version.

This design does not define a new audit Artifact, Receipt, hash, database, retention policy, or persistence mechanism. The evidence must use an existing approved Canonical Location when implementation is authorized.

## 17. Future implementation split

Implementation must remain separate from this design PR.

1. **Model Routing Contract and types**
   - Freeze structural input/output types and policy-version compatibility.
   - Define closed vocabularies without changing existing Task Assignment or Result Handoff.
2. **Pure Model Router core**
   - Implement exact validation, floor calculation, profile selection, and deterministic diagnostics.
   - No I/O, provider, Resolver, Runner, or credential access.
3. **Context Plan and Estimator contracts**
   - Freeze context source binding, estimator evidence, token requirements, and truncation prohibition.
4. **Compatibility Profile and Execution Context Assembler**
   - Resolve approved compatibility references and produce the existing `ResolverExecutionContext`.
5. **Response Profile contract and parser/renderer**
   - Freeze structured output compatibility and preserve existing Handoff semantics.
6. **Resolver integration**
   - Connect the trusted assembled context to the existing Deployment Resolver without changing Resolver selection rules.
7. **Automation integration and pilot**
   - Integrate with Dispatcher/Adapter/Runner under separate security and rollout review.

Each implementation PR requires its own Task Assignment, tests, independent review, rollback plan, and explicit merge decision.

## 18. Acceptance and test design

A future implementation is acceptable only when tests prove at least:

- exact same normalized inputs and policy versions produce the same Routing Decision;
- input and collection order do not change the decision;
- Role, Complexity, and Risk floors are independently calculated and combined by maximum;
- cost and latency cannot downgrade Tier or reasoning;
- unknown Role, classification, or policy version fails closed;
- missing required context produces no successful context assembly;
- an untrusted model/provider override in prose is ignored as authority and reported;
- selected response profile matches the exact Role and output requirement;
- mandatory Handoff meaning survives response optimization;
- required structured-output profiles reach the Resolver context unchanged;
- Routing Decision contains no provider, model, deployment, Binding, credential, or fallback identity;
- the assembler cannot change routed Tier, reasoning, capability floor, or response profile;
- provider availability and pricing do not affect pure routing output;
- higher Tier never changes Role permission, Allowed Changes, approval, or security profiles;
- diagnostics contain stable rule references and no private reasoning or Secret.

## 19. Rollout and rollback boundary

Proposed rollout order:

1. approve this architecture;
2. Freeze logical routing types and policy tables;
3. implement and test the pure Router offline with fixtures;
4. Freeze and implement Context Estimator and Execution Context Assembler boundaries;
5. integrate with Resolver in shadow mode and compare reproducibility evidence;
6. enable one approved non-destructive Role/task class;
7. expand only after independent review and Product Owner approval.

Rollback means disabling the new routing integration and returning to the last approved routing path. It does not mutate previous Assignments, rewrite Result Handoffs, change Binding revisions, or silently choose another provider/model.

## 20. Explicit non-implementation confirmation

- Model Router implemented: no
- Context Loader or estimator implemented: no
- Response parser or renderer implemented: no
- Deployment Resolver changed: no
- Execution Adapter changed: no
- Dispatcher changed: no
- Runner changed: no
- Workflow changed: no
- Schema changed: no
- Existing Contract changed: no
- Secrets or credentials configured: no
- Existing Run changed: no
- Research Artifact changed: no
- Merge performed: no
