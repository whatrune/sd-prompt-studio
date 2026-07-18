# Evidence Evaluation Foundation Freeze Specification

## Status and authority

- Contract status: Freeze
- Contract version: `0.1.0`
- Evaluated structure: Image Observation Evidence Rule Set v0.1.0
- Saved Evaluation Result contract: none in v0.1.0

This cumulative document is the normative source for Evidence Evaluation
Foundation v0.1.0. Earlier prompts and design notes are non-normative.

PR85 is documentation-only. It defines deterministic evaluation semantics and
a future Semantic Validation Test Design. It adds no JSON Schema, executable
Validator, Error emission, CLI behavior, or saved Evaluation Result.

## Purpose and responsibility boundary

PR84 defines the Evidence Rule structure. PR85 defines how a future evaluator
interprets that structure.

```text
PR84
  Evidence Rule structure
  Visibility prerequisite expression
  Rubric reference

PR85
  Input binding
  Condition evaluation
  all_of / any_of aggregation
  Overclaim status calculation
  Diagnostic boundary
```

The evaluation contract checks a recorded Observation after the fact. It does
not authorize generation, selection, correction, approval, downgrade, or
deletion of an Observation. Camera Visibility Metadata remains Observability
Metadata and never determines an Observation value.

PR85 does not create:

- a Canonical Pose Rule Mapping or a real Observation-axis mapping;
- a Semantic Validator or Diagnostic emitter;
- a Condition Result or Evaluation Result Artifact;
- automatic `unclear` or `not_visible` insertion;
- a Rubric Evidence Policy language or evaluator;
- Research Interpretation, Research Claim, or Human Review automation; or
- changes to existing Observation, Rubric, Camera Visibility Metadata, Run,
  Claim, Concept Graph, or Derived Index data.

## Target contract binding

v0.1.0 evaluates only:

- Image Observation Contract Foundation v0.1.0;
- Image Observation Evidence Rule Set Schema v0.1.0;
- Pose Observation Schema 3.0; and
- Camera Visibility Metadata Schema 0.1.0.

Other versions are not evaluated implicitly. Compatibility with a future
version requires a separately frozen Evaluation Contract version.

## Evaluation scope

Visibility prerequisite evaluation is Rule- and Panel-scoped. Its conceptual
key is:

- `rule_set_id`;
- `rule_id`;
- `run_id`; and
- `panel_id`.

Overclaim evaluation is Rule-, Panel-, Axis-, and Observation-value-scoped.
Its conceptual key is:

- `rule_set_id`;
- `rule_id`;
- `run_id`;
- `panel_id`;
- `observation_module`;
- `axis_name`; and
- `observed_value`.

One Panel may have different results for different Rules. No Run-wide or
Panel-wide status, cross-Rule reuse, implicit aggregation, Rule priority, or
Rule-conflict resolution is defined. PR85 does not persist either key.

## Evaluation prerequisites and processing order

PR84 Structural Validation is a mandatory precondition of the PR86 entry
point. `evaluate_evidence_rule()` does not perform JSON Schema validation.
Input Rule Set MUST have passed PR84 Schema Validation. That upstream
validation establishes:

- a valid Root Schema;
- valid Rule Object Schemas;
- presence of every required field;
- absence of unknown fields; and
- valid field types and formats.

PR86 is responsible only for Rule Semantic Validation, Visibility Evaluation,
and Overclaim Evaluation. It does not replace or repeat PR84 Structural
Validation.

A future evaluator processes inputs in this order:

1. validate the Evidence Rule Set structurally;
2. validate the Rule semantically;
3. bind Camera Visibility Metadata and one Panel;
4. evaluate every Condition and aggregate the prerequisite status;
5. bind and verify the Rubric;
6. validate membership of the observed value; and
7. calculate the overclaim status and derive Diagnostics.

An invalid Rule prevents Condition evaluation. For documentation purposes,
both aggregate statuses are `not_evaluated`. A later Rubric or Observation
value failure does not erase an already calculated visibility status; it makes
only overclaim evaluation `not_evaluated`.

## Run and Panel binding

Binding uses exact equality:

- `metadata.run_id == evaluation_key.run_id`; and
- `panel.panel_id == evaluation_key.panel_id`.

Exactly one matching Panel is a successful binding. Zero matches is missing;
multiple matches is ambiguous. Both failures produce `not_evaluated` for all
Conditions and both aggregate statuses.

The evaluator must not select by array order, take the first match, derive an
ID from `source_image`, or infer a match from a Run-ID suffix.

## Condition contract

Every `all_of` or `any_of` entry is evaluated before aggregation. A Condition
contains `region` and `allowed_states` and is evaluated against the bound
available Panel.

Condition status is one of:

- `satisfied`;
- `unsatisfied`; or
- `not_evaluated`.

### Satisfied

All of the following hold:

- Camera Visibility Metadata and Panel binding succeeded;
- Root and Panel are `available`;
- `condition.region` exists in `visible_regions`; and
- its explicit Region State belongs to `condition.allowed_states`.

### Unsatisfied

Binding succeeded, Root and Panel are available, the Region entry exists, and
its explicit State does not belong to `allowed_states`.

All four explicit States are evaluable: `visible`, `partial`, `unclear`, and
`not_visible`. An explicit `not_visible` value is not missing Metadata.

### Not evaluated

The Condition is `not_evaluated` when the Metadata Artifact is absent, Root or
Panel is unavailable, Run/Panel binding is missing or ambiguous, or the
required Region entry is absent. An absent Region entry must never be converted
to `not_visible`.

## Duplicate Region rule

Within one `visibility_prerequisite`, each Region may occur at most once. This
applies independently to `all_of` and `any_of`.

PR84 Structural Validation already rejects exact duplicate Condition objects.
Two Conditions with the same `region` but different `allowed_states` are a
Semantic Rule error with reserved code `EVIDENCE_RULE_INVALID`.

v0.1.0 does not intersect repeated `all_of` State sets or union repeated
`any_of` State sets. This prevents evaluator-specific interpretations.

## Aggregate truth tables

Empty Condition arrays are structurally invalid under PR84 and therefore have
no evaluation result.

### `all_of`

| Condition statuses | Aggregate visibility status |
| --- | --- |
| every Condition is `satisfied` | `satisfied` |
| one or more Conditions are `unsatisfied` | `unsatisfied` |
| no `unsatisfied`, and one or more `not_evaluated` | `not_evaluated` |

### `any_of`

| Condition statuses | Aggregate visibility status |
| --- | --- |
| one or more Conditions are `satisfied` | `satisfied` |
| every Condition was evaluated and all are `unsatisfied` | `unsatisfied` |
| no `satisfied`, and one or more `not_evaluated` | `not_evaluated` |

The aggregate result may be logically known before the last Condition, but a
future evaluator evaluates every safely evaluable Condition for deterministic
diagnostics. Array order and short-circuit position must not change aggregate
or diagnostic content. PR85 defines no saved Condition Result.

## Visibility prerequisite status

`visibility_prerequisite_status` uses the aggregate values `satisfied`,
`unsatisfied`, and `not_evaluated`.

Satisfied visibility does not prove Observation correctness, Rubric Evidence
Policy compliance, Research Claim usability, or approval. Unsatisfied
visibility is not by itself an Observation failure. It warns that an assertive
value may lack its declared prerequisite.

## Rubric binding boundary

Before overclaim evaluation, a future evaluator verifies:

- safe `rubric_path` resolution and containment;
- the declared Rubric text hash;
- existence of the referenced Axis;
- membership of Rule values and the observed value in that Axis's
  `allowed_values`; and
- availability of a machine-evaluable Evidence Policy.

Membership proves only that a value is declared by the Rubric. It does not
prove that the value matches the image or that a research judgment is correct.

An absent, natural-language-only, structurally undefined, unsupported-version,
or incomplete Evidence Policy is not machine-evaluable. A future evaluator
must not infer its meaning. Overclaim status is then `not_evaluated`.

PR85 does not define the Evidence Policy language. Until a separate Policy
Contract exists, axes without an already machine-evaluable policy cannot
complete overclaim evaluation.

## Observation value validation priority

If the observed value is absent or not a member of the bound Rubric Axis's
`allowed_values`, overclaim status is `not_evaluated`. Existing Rubric and
Observation value validation takes priority. Invalid values must not become
`no_violation` or be classified as `violation` from visibility alone.

## Overclaim evaluation dependency

Overclaim evaluation requires:

- a valid Evidence Rule;
- `visibility_prerequisite_status`;
- an observed value;
- a successfully bound Rubric Axis and `allowed_values`; and
- a machine-evaluable Rubric Evidence Policy.

If visibility is `not_evaluated`, overclaim is `not_evaluated`. The reverse is
not true: a Rubric failure may leave an already calculated visibility status
unchanged while overclaim becomes `not_evaluated`.

## Overclaim status contract

`overclaim_evaluation_status` is `no_violation`, `violation`, or
`not_evaluated`.

### No violation

All required inputs are evaluable and either:

1. visibility is `satisfied`, the observed value belongs to the Rubric Axis,
   binding succeeds, the Policy is machine-evaluable, and it finds no Evidence
   Requirement violation; or
2. visibility is `unsatisfied`, the observed value belongs to both
   `allowed_fallback_values` and the Rubric Axis, binding succeeds, and the
   Policy is machine-evaluable.

The second case is a conservative fallback, not an automatically selected
value. `no_violation` means only that this Rule found no overclaim. It does not
prove Observation correctness, whole-Observation validity, absence of other
Rule violations, Claim usability, Human Review, or Approval.

### Violation

Every item below is required:

- Rule and visibility evaluation completed;
- visibility is `unsatisfied`;
- the observed value exists and belongs to the Rubric Axis;
- it belongs to `observation_values_requiring_prerequisite`;
- it does not belong to `allowed_fallback_values`;
- Rubric binding succeeds;
- the Policy is machine-evaluable; and
- an Evidence Requirement violation is confirmed.

### Not evaluated

Overclaim is `not_evaluated` for an absent or invalid observed value,
unevaluated visibility, unreadable Rubric, hash mismatch, failed Axis binding,
or unavailable/non-machine-evaluable Evidence Policy. Missing information must
not be converted into `no_violation` or `violation`.

## Diagnostic boundary and severity

Future processing order is status calculation, Diagnostic derivation, then
severity classification. PR85 fixes these existing PR84 severities:

| Code | Severity | Meaning |
| --- | --- | --- |
| `EVIDENCE_RULE_INVALID` | error | the Rule cannot be evaluated safely |
| `EVIDENCE_RUBRIC_MAPPING_INVALID` | error | Rubric or Axis binding is invalid |
| `EVIDENCE_OBSERVATION_OVERCLAIM` | error | a confirmed assertive value exceeds its evidence boundary |
| `EVIDENCE_VISIBILITY_INSUFFICIENT` | warning | visibility is insufficient for the declared assertive prerequisite |

Diagnostic priority and stable primary ordering are the table order. An
invalid Rule prevents evaluation. Later higher-priority Diagnostics do not
erase an independently and validly calculated visibility status.

When visibility is `unsatisfied` and overclaim is `violation`, a future
evaluator retains both Diagnostics:

- primary: `EVIDENCE_OBSERVATION_OVERCLAIM` (`error`);
- supporting: `EVIDENCE_VISIBILITY_INSUFFICIENT` (`warning`).

The implementation must not keep only the warning, combine the codes, promote
the warning, or omit either result. PR85 emits neither Diagnostic.

Warning/Error severity is fixed here. CLI exit-code behavior and whether a
strict mode treats warnings as failure belong to a future CLI/Validator
Contract.

## Semantic Validation Test Design

A future implementation must cover at least:

### Condition and aggregation

- explicit State inside/outside `allowed_states`;
- explicit `not_visible` inside/outside the allowed set;
- absent Region entry versus explicit `not_visible`;
- all three `all_of` aggregate cases;
- all three `any_of` aggregate cases; and
- stable Condition diagnostics independent of array order and short-circuit.

### Rule and binding

- repeated Region in `all_of` and `any_of` produces `EVIDENCE_RULE_INVALID`;
- exact Run and unique Panel binding succeeds;
- Run mismatch, missing Panel, and duplicate Panel produce `not_evaluated`;
- invalid Rule prevents Condition evaluation; and
- a Rubric or observed-value failure preserves an already evaluated visibility
  status and makes overclaim `not_evaluated`.

### Overclaim and Diagnostics

- unsatisfied plus allowed fallback produces `no_violation`;
- unsatisfied plus a prerequisite-required assertive value produces
  `violation` only after machine-evaluable Policy confirmation;
- violation retains both the primary Error and supporting Warning; and
- invalid value, absent Policy, natural-language-only Policy, and unsupported
  Policy version produce `not_evaluated`.

## Deferred scope

Deferred work includes the executable Semantic Validator, Canonical Pose Rule
Mapping, machine-readable Rubric Evidence Policy Contract, Evaluation Result
and Condition Result Artifacts, identity/hash binding for persisted results,
Diagnostic emission and sort implementation, CLI exit behavior, strict mode,
and cross-Rule aggregation.

If results are persisted later, reproducibility will require explicit binding
to Evidence Rule Set, Rubric, Camera Visibility Metadata, and Observation
identities, likely including Contract versions and content or Artifact hashes.
PR85 adds none of those fields or hash contracts.
