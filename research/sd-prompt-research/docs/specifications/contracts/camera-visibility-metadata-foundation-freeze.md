# Camera Visibility Metadata Foundation Freeze Specification

## Status and authority

- Contract status: Freeze
- Contract version: `0.1.0`
- Normative schema: `schemas/camera-visibility-metadata.schema.json`
- Canonical artifact path: `experiments/<domain>/<run-id>/visibility-metadata.yaml`

This document is the normative source for Camera Visibility Metadata
Foundation v0.1.0. The JSON Schema and structural tests implement this
document. Earlier design notes and chat prompts are non-normative.

## Purpose

Camera Visibility Metadata records the image conditions under which visible
evidence could be inspected. It separates observability conditions from the
Observation that records what was actually seen.

This artifact records:

- framing and observed camera conditions;
- estimated primary-subject occupancy;
- body-region visibility; and
- directly observable occlusion causes.

It does not record or infer:

- pose or morphology;
- support or contact;
- Observation, classification, or morphology confidence;
- Prompt effect or causal influence;
- Research Interpretation, Working Conclusion, or Research Claim; or
- success or failure judgment.

The responsibility boundary is:

```text
Prompt Provenance
  what was specified as a generation prompt

Camera Visibility Metadata
  under what image-result conditions evidence was observable

Observation
  what visible evidence was recorded
```

## Scope

PR82 provides:

- this cumulative Freeze specification;
- a closed Draft 2020-12 JSON Schema;
- structural schema tests;
- a semantic-validation test design and reserved error catalog; and
- documentation references.

PR82 does not provide camera estimation, region detection, occupancy
calculation, occlusion detection, a Semantic Validator, error emission, an
artifact generator, or Camera Visibility Metadata files for existing Runs.

## Artifact location and compatibility

Camera Visibility Metadata is an optional Run-root artifact:

```text
experiments/<domain>/<run-id>/visibility-metadata.yaml
```

It does not replace or modify a raw image. It is not a required manifest
field. Absence of the artifact is valid for every existing Run and means that
visibility metadata has not been recorded.

No existing Run, manifest, Observation Schema, Research Claim contract,
Prompt Provenance contract, Concept Graph, or Resolver is migrated or changed
by this contract.

## Root contract

Every artifact requires:

- `schema_version`: exactly `0.1.0`;
- `run_id`; and
- `visibility_status`.

`visibility_status` is `available` or `unavailable`.

An `available` artifact requires `camera`, `subject_occupancy`, and
`visible_regions`; it forbids `unavailable_reason`. `occlusions` is optional.

An `unavailable` artifact requires a non-empty `unavailable_reason`; it
forbids `camera`, `subject_occupancy`, `visible_regions`, and `occlusions`.
The reason remains free text in v0.1.0 because no normative reason-code enum
has been defined.

```yaml
schema_version: "0.1.0"
run_id: BRG-013-A
visibility_status: available
camera:
  framing: full_body
  angle:
    horizontal: side
    vertical: eye_level
  perspective: unknown
subject_occupancy:
  width_ratio: 0.64
  height_ratio: 0.88
  area_ratio: 0.37
visible_regions:
  hands: partial
  feet: visible
  knees: unclear
occlusions:
  - region: hands
    cause: clothing
```

All artifact and nested objects are closed contracts. Unknown fields are
rejected.

## Run binding

A future Semantic Validator must require exact equality among:

- the Canonical Run directory name;
- `manifest.yaml` `run_id`; and
- Camera Visibility Metadata `run_id`.

Mismatch is `VISIBILITY_METADATA_RUN_MISMATCH`. PR82 documents this rule but
does not implement cross-artifact Run resolution.

## Camera contract

`camera` describes camera conditions observed in the generated image. It is a
closed object requiring `framing`, `angle`, and `perspective`.

### Framing

`framing` is one of:

- `full_body`;
- `upper_body`;
- `portrait`;
- `close_up`; or
- `unknown`.

### Angle

`angle` is a closed object with two required axes.

`horizontal` is one of:

- `front`;
- `side`;
- `three_quarter`; or
- `unknown`.

`vertical` is one of:

- `eye_level`;
- `high_angle`;
- `low_angle`; or
- `unknown`.

### Perspective

`perspective` is one of:

- `normal`;
- `wide`;
- `telephoto`; or
- `unknown`.

When an image does not directly support a camera classification, `unknown`
is used. Prompt wording is not evidence for a Camera Visibility value.

## Subject occupancy contract

`subject_occupancy` is a closed object requiring three estimated ratios in the
inclusive range `0.0` through `1.0`:

- `width_ratio`: estimated width of the primary subject's axis-aligned visible
  extent divided by image width;
- `height_ratio`: estimated height of the primary subject's axis-aligned
  visible extent divided by image height; and
- `area_ratio`: estimated visible subject-silhouette area divided by image
  area.

`area_ratio` is not the product of `width_ratio` and `height_ratio` and is not
the area of their bounding rectangle. Hair and worn clothing belong to the
subject silhouette. Background, independent objects, and support objects do
not. The values are observation-condition estimates, not precise geometric
measurements and not confidence scores.

v0.1.0 represents one primary analysis subject established by the Run. It does
not define multi-subject selection or per-subject occupancy. If a primary
subject cannot be identified sufficiently to record all three ratios, the
artifact cannot be `available` under v0.1.0.

## Visible-region contract

`visible_regions` records the observability of a non-empty subset of these
registered regions:

- `head`;
- `face`;
- `hair`;
- `neck`;
- `shoulders`;
- `arms`;
- `hands`;
- `torso`;
- `hips`;
- `legs`;
- `knees`; and
- `feet`.

Every recorded region is one of:

- `visible`: the region is directly observable for the selected subject;
- `partial`: only a directly identifiable portion or subset is observable;
- `unclear`: image evidence is insufficient to classify visibility reliably;
  or
- `not_visible`: no directly observable portion is present.

For plural regions such as `hands`, `partial` may indicate that only a subset
is observable. `partial` is a positive observation of incomplete visibility;
`unclear` represents classification uncertainty. An omitted registered region
means it was not recorded, not that it was `not_visible`.

Visibility is not an Observation result. For example, `feet: partial` may
coexist with an Observation value such as `foot_contact: unclear`. Fields such
as `foot_contact_confidence` are forbidden from this artifact.

## Occlusion contract

`occlusions` is an optional ordered array of directly observable occlusion
entries. Each entry requires:

- `region`: one registered visible-region name; and
- `cause`: `clothing`, `hair`, `object`, `camera_crop`, `perspective`,
  `lighting`, or `unknown`.

An occlusion records why evidence is unavailable or partial; it does not infer
pose, support, contact, or hidden geometry. A future Semantic Validator must
require every occlusion `region` to be present in `visible_regions` with
`partial`, `unclear`, or `not_visible`. It must reject duplicate region/cause
pairs. PR82 does not implement those cross-field rules.

Canonical occlusion order is lexical `region`, then lexical `cause`. A future
Semantic Validator rejects non-canonical ordering rather than silently sorting
the array.

## Prompt Provenance boundary

A Prompt Provenance camera phrase records what was requested. Camera Visibility
Metadata records what was observed in the resulting image. The two values are
not merged and neither is inferred from the other.

For example, a `side view` prompt phrase does not establish a fixed camera
control or require `camera.angle.horizontal: side`. A difference is reportable
context, not an automatic error and not evidence of Prompt effect.

## Observation boundary

Camera Visibility Metadata may explain why an Observation is `unclear`, but it
does not replace an Observation and does not assign Observation confidence.
It must not be used to fill hidden support, contact, orientation, morphology,
or body structure.

The allowed relationship is non-causal:

```text
Image result -> has_observability_conditions -> Camera Visibility Metadata
Image result -> has_visible_evidence -> Observation
```

## Structural validation implemented in PR82

The JSON Schema validates:

- required root and nested fields;
- available versus unavailable branches;
- primitive and object types;
- camera, visibility, region, and occlusion enums;
- inclusive ratio ranges;
- at least one recorded visible region; and
- unknown-field rejection at every object level.

The Schema cannot detect YAML duplicate keys after a lossy parser has already
collapsed them. A future YAML-loading path must reject duplicate keys before
Schema validation.

## Semantic validation designed but not implemented

A future Semantic Validator and safe YAML loader test:

- successful Structural Schema validation as a precondition, including ratio
  ranges, available/unavailable field constraints, camera enums, and visible
  region enums;
- exact Run-directory, manifest, and artifact Run ID equality;
- duplicate YAML region keys before object construction;
- occlusion-region presence and visibility-state consistency;
- duplicate occlusion region/cause pairs;
- Canonical occlusion ordering; and
- cross-artifact consistency without treating visibility as an Observation or
  research conclusion.

Camera estimation, region detection, occupancy calculation, and occlusion
detection remain producer responsibilities and are not Validator behavior.

## Reserved error catalog

The following codes are reserved contracts. PR82 does not emit them.

| Code | Layer | Severity | Condition | Artifact usability | Retry or remediation |
| --- | --- | --- | --- | --- | --- |
| `VISIBILITY_METADATA_RUN_MISMATCH` | Semantic | error | Run directory, manifest, and artifact Run IDs differ. | Invalid for Run-bound use. | Restore exact Run binding and validate again. |
| `VISIBILITY_RATIO_OUT_OF_RANGE` | Structural diagnostic | error | An occupancy ratio is outside `0.0..1.0`. | Structurally invalid. | Correct the estimate or regenerate the artifact. |
| `VISIBILITY_REGION_DUPLICATE` | Parse/Semantic | error | A YAML region key or Canonical region entry is duplicated. | Invalid because data may have been overwritten during parsing. | Use a duplicate-key-rejecting loader and retain one explicit value. |
| `VISIBILITY_OCCLUSION_INVALID` | Semantic | error | An occlusion references an absent or fully visible region, repeats a pair, or violates Canonical order. | Invalid for occlusion-aware use. | Correct the reference or ordering and validate again. |
| `VISIBILITY_CAMERA_VALUE_INVALID` | Structural diagnostic | error | A camera value is outside the registered enum. | Structurally invalid. | Use a registered value or `unknown`. |

## Structural test contract

PR82 structural tests cover:

- Schema meta-validation;
- a valid available artifact;
- a valid unavailable artifact;
- available/unavailable branch constraints;
- root and nested unknown-field rejection;
- camera object shape and enum rejection;
- ratio type and inclusive range rejection;
- visible-region name and state rejection;
- non-empty visible-region enforcement;
- occlusion object shape and enum rejection; and
- Run ID lexical form.

Semantic rules and reserved Error emission are test designs only.

## Deferred work

The following require later contracts or PRs:

- a safe YAML loader and Semantic Validator;
- reserved Error emission and CLI integration;
- camera and perspective estimation;
- region and occlusion detection;
- occupancy measurement and producer-method provenance;
- multiple-subject identity and per-subject metadata;
- artifact content identity or byte-integrity hashing;
- artifact generator and real-Run adoption; and
- Research Explorer display or image-to-Prompt conversion.
