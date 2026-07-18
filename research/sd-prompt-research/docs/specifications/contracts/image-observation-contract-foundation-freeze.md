# Image Observation Contract Foundation Freeze Specification

## Status and authority

- Contract status: Freeze
- Contract version: `0.1.0`
- Normative schema: `schemas/image-observation-evidence-rule.schema.json`
- Canonical Rule Mapping Artifact: none in v0.1.0

This cumulative document is the normative source for Image Observation
Contract Foundation v0.1.0. The JSON Schema and Structural Tests implement
this document. Earlier prompts and design notes are non-normative.

## Purpose and responsibility boundary

This contract defines necessary visibility prerequisites used to check that an
existing Pose Observation does not exceed its visible-evidence boundary. It is
not a transformation from Camera Visibility Metadata to an Observation.

```text
Image
  -> Camera Visibility Metadata records observability conditions
  -> an existing Observation Workflow records visible evidence

Evidence Rule + Camera Visibility Metadata
  -> future prerequisite evaluation

Evidence Rule + prerequisite status + Observation value + Rubric
  -> future overclaim evaluation
```

The arrows do not authorize automatic conversion. Camera Visibility Metadata
does not generate, select, correct, or approve Observation values.

PR84 defines:

- a closed Evidence Rule Set structure;
- visibility-prerequisite and Rubric-reference structures;
- documentation-only future evaluation vocabularies;
- a Structural Schema and Structural Tests;
- a future Semantic Validation Test Design; and
- a reserved Error Catalog.

PR84 does not provide:

- a Canonical Evidence Rule Mapping or mapping for any real axis;
- a Semantic Validator or Error emission;
- Evaluation Status generation or persistence;
- Observation generation, correction, or fallback insertion;
- image, Pose, Support, Contact, or Morphology inference;
- Research Interpretation, Research Claim, or Prompt-effect evaluation; or
- changes to existing Runs, Observation artifacts, Rubrics, Camera Visibility
  Metadata, Concept Graph content, or Derived Index data.

## Target contract binding

v0.1.0 is limited to Pose Observation Schema 3.0 and Camera Visibility
Metadata Schema 0.1.0.

```yaml
target_contracts:
  observation_module: pose
  observation_schema_version: "3.0"
  camera_visibility_metadata_schema_version: "0.1.0"
```

All three values are constants. Face Observation, module-crossing Rule Sets,
and module-specific version selection are deferred to a separately frozen
contract version.

## Evidence Rule Set root contract

The Root is a closed object requiring:

- `schema_version`: exactly `0.1.0`;
- `rule_set_id`;
- `target_contracts`; and
- nonempty `rules`.

`rule_set_id` matches:

```text
^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$
```

`rules` uses `uniqueItems: true`. This rejects only exact duplicate Rule
objects. Reuse of one `rule_id` with different content is a future Semantic
Validation error.

The Schema defines Rule Set structure but PR84 creates no Canonical Rule Set
Artifact. A fixture is a non-normative Structural example and must not be used
by an Observation Workflow.

## Rule object contract

Every Rule is closed and requires:

- `rule_id`;
- `axis_ref`;
- `rubric_ref`;
- `visibility_prerequisite`;
- `observation_values_requiring_prerequisite`; and
- `insufficient_visibility_policy`.

`rule_id` matches:

```text
^evidence_rule\.[a-z][a-z0-9]*(?:\.[a-z0-9_]+)*$
```

Rule ID uniqueness and Rule conflicts are Semantic Validation responsibilities.

### Axis reference

`axis_ref` is closed and requires:

- `observation_module`: exactly `pose`; and
- `axis_name`: lowercase ASCII snake_case.

The Schema does not prove that the axis exists in a Rubric.

### Rubric reference

`rubric_ref` is closed and requires:

- `rubric_path`;
- `rubric_hash_contract`: exactly `normalized_text_file_sha256_v1`; and
- `rubric_sha256`: 64 lowercase hexadecimal characters.

The path is relative to the Research Project Root:

```text
research/sd-prompt-research/
```

Structural Validation rejects:

- empty paths;
- Unix absolute paths;
- Windows Drive absolute and Drive-relative paths;
- UNC paths;
- URI or URL schemes;
- backslashes;
- `..` traversal components; and
- CR or LF.

File existence, resolved-path and symlink containment, hash recalculation,
hash equality, axis/value membership, and Evidence Policy binding are future
Semantic Validation responsibilities. PR84 does not implement the existing
text-hash helper again or change its contract.

## Visibility prerequisite contract

`visibility_prerequisite` is a closed, exclusive union. It contains exactly
one of:

- nonempty `all_of`; or
- nonempty `any_of`.

Both present and both absent are invalid. Each array uses `uniqueItems: true`.
Every Condition is closed and requires:

- `region`; and
- nonempty, unique `allowed_states`.

Regions are exactly the Camera Visibility Metadata v0.1.0 regions:

- `head`, `face`, `hair`, `neck`, `shoulders`, `arms`;
- `hands`, `torso`, `hips`, `legs`, `knees`, `feet`.

Visibility states are exactly:

- `visible`;
- `partial`;
- `unclear`; and
- `not_visible`.

`uniqueItems` rejects exact duplicate Conditions. Conflicting Conditions for
one region remain a future Semantic Validation responsibility.

## Observation-value prerequisite contract

`observation_values_requiring_prerequisite` is a nonempty, unique array of
lowercase ASCII snake_case values. Recording one of these values requires the
Rule's visibility prerequisite to be satisfied.

Prerequisite satisfaction does not prove that the value is correct, authorize
automatic insertion, or approve the Observation.

## Insufficient-visibility policy

`insufficient_visibility_policy` is closed and requires nonempty, unique
`allowed_fallback_values`. These values are options that a human or an existing
Observation Workflow may use when visibility is insufficient. The contract
does not insert or select them.

A value must not occur in both
`observation_values_requiring_prerequisite` and `allowed_fallback_values`.
That cross-array rule, and membership of both arrays in the referenced Rubric
axis's `allowed_values`, are future Semantic Validation responsibilities.

## Non-normative Structural fixture

The zero hash below checks format only. It is not a computed Rubric hash and
the example is not Canonical Mapping data.

```yaml
schema_version: "0.1.0"
rule_set_id: evidence-rule-fixture
target_contracts:
  observation_module: pose
  observation_schema_version: "3.0"
  camera_visibility_metadata_schema_version: "0.1.0"
rules:
  - rule_id: evidence_rule.fixture.left_hand_surface_contact
    axis_ref:
      observation_module: pose
      axis_name: left_hand_surface_contact
    rubric_ref:
      rubric_path: templates/rubric-template.yaml
      rubric_hash_contract: normalized_text_file_sha256_v1
      rubric_sha256: "0000000000000000000000000000000000000000000000000000000000000000"
    visibility_prerequisite:
      all_of:
        - region: hands
          allowed_states:
            - visible
            - partial
    observation_values_requiring_prerequisite:
      - floor
      - wall
      - object
    insufficient_visibility_policy:
      allowed_fallback_values:
        - unclear
        - not_visible
```

## Evaluation scope

The following are conceptual keys for a future Semantic Validator. PR84 does
not store keys or results.

`visibility_prerequisite_status` is Rule- and Panel-scoped:

- `rule_set_id`;
- `rule_id`;
- `run_id`; and
- `panel_id`.

`overclaim_evaluation_status` is Rule-, Panel-, and Observation-value-scoped:

- `rule_set_id`;
- `rule_id`;
- `run_id`;
- `panel_id`;
- `observation_module`;
- `axis_name`; and
- `observed_value`.

A Panel may have different results for different Rules. No Run-wide or
Panel-wide status, cross-Rule reuse, implicit aggregation, priority selection,
or Rule-conflict resolution is defined.

## Documentation-only evaluation vocabulary

Neither status below is an Artifact field, Receipt, Validation Record,
Derived Index field, or Research Claim Evidence field.

### Visibility prerequisite status

`visibility_prerequisite_status` is one of:

- `satisfied`: the prerequisite was evaluated and holds;
- `unsatisfied`: it was evaluated and does not hold; or
- `not_evaluated`: it could not be evaluated because metadata was absent,
  Root or Panel data was unavailable, or Run/Panel binding failed.

Unsatisfied visibility is an evaluation outcome, not an unconditional Error.

### Overclaim evaluation status

`overclaim_evaluation_status` is one of:

- `violation`;
- `no_violation`; or
- `not_evaluated`.

Its required inputs are:

- the Evidence Rule;
- `visibility_prerequisite_status`;
- the target Panel's Observation value;
- the bound Rubric axis and its `allowed_values`; and
- a machine-evaluable Rubric Evidence Policy.

If visibility is `not_evaluated`, overclaim is `not_evaluated` because a
required input is absent. The reverse does not propagate: a Rubric failure may
make overclaim `not_evaluated` while preserving an already evaluated
visibility status.

`no_violation` requires all necessary inputs to be evaluable and either:

1. visibility is satisfied, the observed value is in the Rubric axis's
   `allowed_values`, binding succeeds, the policy is machine-evaluable, and no
   Evidence Requirement violation exists; or
2. visibility is unsatisfied, the observed value is in both
   `allowed_fallback_values` and the Rubric axis's `allowed_values`, binding
   succeeds, and the policy is machine-evaluable.

`violation` requires all of:

- completed visibility evaluation with status `unsatisfied`;
- an observed value in the Rubric axis's `allowed_values`;
- that value in `observation_values_requiring_prerequisite` and not in
  `allowed_fallback_values`;
- successful Rubric binding and a machine-evaluable policy; and
- a confirmed Rubric Evidence Requirement violation.

Overclaim is `not_evaluated` when the Observation value is absent or invalid,
visibility cannot be evaluated, the Rubric cannot be read or hash-verified,
axis binding fails, or the Evidence Policy cannot be evaluated. Invalid values
use the existing Rubric/Observation validation path; PR84 creates no value
validator.

`no_violation` means only that this Rule did not detect an overclaim. It does
not establish Observation correctness, whole-Observation validity, absence of
other Rule violations, Research Claim usability, Human Review, or Approval.

## Reserved Error Catalog

PR84 reserves the following definitions but emits none of them.

### `EVIDENCE_RULE_INVALID`

- Layer: Semantic Rule Validation
- Severity: error
- Scope: Rule Set / Rule
- Conditions: duplicate `rule_id` with different content, cross-array overlap,
  Rule conflict, or another semantic contradiction in a Rule
- Artifact usability: the Rule Set cannot be used for Semantic Evaluation
- Retry: correct the Rule definition, then reevaluate

### `EVIDENCE_RUBRIC_MAPPING_INVALID`

- Layer: Semantic Rubric Binding
- Severity: error
- Scope: Rule / Rubric axis
- Conditions: unreadable Rubric, hash mismatch, absent axis, Rule or fallback
  value outside `allowed_values`, or Evidence Policy binding failure
- Artifact usability: the affected Rule cannot be evaluated
- Retry: correct the reference or mapping, then reevaluate

### `EVIDENCE_VISIBILITY_INSUFFICIENT`

- Layer: Semantic Visibility Evaluation
- Severity: warning
- Scope: Rule / Panel / Observation value
- Future conditions: visibility is `unsatisfied`, an observed value exists,
  that value requires the prerequisite, and it is not an allowed fallback
- No emission for status alone, absent Observation values, allowed fallback
  use, or `not_evaluated`
- Artifact usability: retain the Canonical Artifact; use of the affected Rule
  as evidence requires attention
- Retry: do not change an Observation automatically; a human checks the
  Observation, visibility, and Rule before reevaluation

### `EVIDENCE_OBSERVATION_OVERCLAIM`

- Layer: Semantic Overclaim Evaluation
- Severity: error
- Scope: Rule / Panel / axis / Observation value
- Future condition: `overclaim_evaluation_status == violation`
- Artifact usability: retain the Canonical Artifact but block evidence-bound
  downstream use of the affected Observation value
- Retry: a human checks the Observation or Evidence Rule before reevaluation

Reserved Errors do not authorize deletion, status downgrade, or mutation of
an existing Observation.

## Structural Validation

The Draft 2020-12 Schema validates required fields, types, constants, enums,
patterns, closed objects, exact duplicate array items, lexical paths, hash
format, and the exclusive `all_of`/`any_of` union.

It does not validate file existence, resolved containment, symlinks, Rubric
hash equality, Rubric membership, duplicate IDs with different content,
cross-array overlap, Rule conflict, or any Evaluation Status.

## Semantic Validation Test Design

The future Semantic Validator must cover at least:

| Case | Visibility status | Overclaim status | Reserved Error |
| --- | --- | --- | --- |
| satisfied prerequisite and valid assertive value | `satisfied` | `no_violation` if policy finds no violation | none |
| unsatisfied prerequisite and allowed fallback | `unsatisfied` | `no_violation` | none |
| unsatisfied prerequisite and prerequisite-required value | `unsatisfied` | `violation` after confirmed policy violation | visibility warning and overclaim error |
| Observation value absent | evaluated independently | `not_evaluated` | no overclaim Error |
| Visibility Artifact or binding unavailable | `not_evaluated` | `not_evaluated` | no visibility/overclaim Error |
| observed value outside Rubric `allowed_values` | evaluated independently | `not_evaluated` | mapping error |
| Rubric absent or hash mismatch | evaluated independently | `not_evaluated` | mapping error |
| axis binding or policy unavailable | evaluated independently | `not_evaluated` | mapping error |
| cross-array overlap or conflicting Rule | not evaluated | `not_evaluated` | Rule error |

The design also requires per-Rule evaluation for multiple Rules on one Panel,
no implicit aggregation, safe-path real/symlink containment, Rule ID
uniqueness, and Rule-conflict detection. PR84 implements none of these checks.

## Deferred scope

Deferred work includes Canonical Rule Mapping data, actual Pose-axis mappings,
Semantic Validator and Error emission, Evaluation Result contracts, aggregation
and priority rules, Face or multi-module support, and downstream Evidence
Binding. These require a separately reviewed contract and are not implied by
this Foundation.
