# Camera Visibility Metadata Foundation Freeze Specification

## Status and authority

- Contract status: Freeze
- Contract version: `0.1.0`
- Normative schema: `schemas/camera-visibility-metadata.schema.json`
- Canonical artifact path: `experiments/<domain>/<run-id>/visibility-metadata.yaml`

This cumulative document is the normative source for Camera Visibility
Metadata Foundation v0.1.0. The JSON Schema and Structural Tests implement
this document. Earlier design notes and prompts are non-normative.

## Purpose and responsibility boundary

Camera Visibility Metadata records the image-result conditions under which
visible evidence could be inspected. It is Observability Metadata, not a
Research Observation.

It records only:

- per-Panel camera conditions;
- primary-subject occupancy estimates;
- per-region visibility states; and
- directly observable occlusion causes.

It does not generate, alter, or infer:

- Pose, Support, Contact, Morphology, or hidden geometry;
- Observation Confidence;
- Research Interpretation, Working Conclusion, or Research Claim;
- Prompt effect or causal influence; or
- Research success or failure.

```text
Prompt Provenance
  derived structure describing what the generation prompt specified

Camera Visibility Metadata
  conditions under which evidence was observable in each image Panel

Observation
  visible evidence recorded under the Observation contract
```

Prompt Provenance is not the raw Prompt source of truth. Camera Visibility
Metadata is not a source for automatically filling or correcting Observation
values.

## PR82 implementation boundary

PR82 provides:

- this cumulative Freeze specification;
- a closed Draft 2020-12 JSON Schema;
- Structural Schema Tests;
- a future Semantic Validation design; and
- a reserved Error Catalog.

PR82 does not provide:

- a Semantic Validator or Error emission;
- camera, occupancy, visibility, or occlusion estimation;
- image binding or image hashing;
- a Camera Visibility Metadata generator;
- Receipts, Validation Records, or Audit Artifacts;
- External References; or
- artifacts for existing Runs.

No existing Run, manifest, Observation Schema, Research Claim contract,
Prompt Provenance contract, Concept Graph, Derived Index, or Research Data is
changed.

## Artifact location and optionality

The optional Run-root artifact is:

```text
experiments/<domain>/<run-id>/visibility-metadata.yaml
```

It is not a required manifest field. Its absence means only that Camera
Visibility Metadata has not been recorded.

## Root contract

Every artifact requires:

- `schema_version`: exactly `0.1.0`;
- `run_id`; and
- `visibility_status`: `available` or `unavailable`.

An `available` Root requires `panels` and forbids `unavailable_reason` and
`unavailable_reason_detail`.

An `unavailable` Root requires `unavailable_reason` and forbids `panels`.
Root reasons are:

- `source_artifact_missing`: the Run-level image set or base artifact cannot
  be identified, so the Panel list cannot be constructed;
- `invalid_run`; or
- `other`.

`other` requires a nonblank `unavailable_reason_detail`. Other reasons forbid
the detail. Root reasons and Panel reasons are separate enums.

```yaml
schema_version: "0.1.0"
run_id: BRG-013-A
visibility_status: available
panels:
  # Exactly six Panel objects.
```

All Root and nested objects are closed contracts. Unknown fields are rejected.

## Panel collection contract

An available artifact has exactly six Panel entries. A Panel that cannot be
analyzed is retained as an `unavailable` Panel; it is never omitted.

Each Panel always requires:

- `panel_id`: integer `1` through `6`;
- `visibility_status`: `available` or `unavailable`; and
- `source_image`: expected or actual Run-directory-relative image path.

Canonical Panel order is ascending `panel_id`. Panel ID uniqueness, ordering,
and equality with an existing Observation Panel set are future Semantic
Validation rules. If no Observation exists, Panel-set comparison has the
Semantic Validation outcome `NOT_EVALUATED`. `NOT_EVALUATED` is not an
Artifact field and PR82 creates no result Artifact for it.

### Available Panel

An available Panel requires:

- `camera`;
- `subject_occupancy`;
- `visibility_coverage`; and
- `visible_regions`.

`occlusions` is optional. `unavailable_reason` and
`unavailable_reason_detail` are forbidden.

### Unavailable Panel

An unavailable Panel requires a Panel reason and forbids `camera`,
`subject_occupancy`, `visibility_coverage`, `visible_regions`, and
`occlusions`.

Panel reasons are:

- `image_missing`: the Panel list and expected `source_image` are known, but
  the individual Panel image is absent;
- `subject_not_identifiable`: the subject itself cannot be recognized;
- `primary_subject_ambiguous`: multiple subjects are present and one Primary
  Subject cannot be selected unambiguously;
- `insufficient_visibility`; or
- `other`.

`other` requires a nonblank detail. Other reasons forbid it. Validators must
not re-analyze an image to decide whether a human-selected reason is factually
correct.

v0.1.0 supports one Primary Subject only. It does not add a multi-subject
Schema.

## Source image path contract

`source_image` is required for both Panel states. For `image_missing`, it is
the expected path.

The standard naming convention is:

```text
panels/<run_id>_<panel_id:02d>.png
```

Example:

```yaml
source_image: panels/BRG-013-A_01.png
```

Structural Validation rejects URI and URL schemes in addition to absolute
paths, Windows Drive paths, UNC paths, backslashes, and `..` traversal. File
existence, Research Project containment, resolved symlink containment, and
cross-field naming equality are future Semantic Validation rules.

## Camera contract

`camera` is a closed object. The nested `angle` structure is normative.

```yaml
camera:
  framing: full_body
  angle:
    horizontal: rear
    vertical: eye_level
  perspective: normal
```

It requires:

- `framing`: `full_body`, `upper_body`, `portrait`, `close_up`, or `unknown`;
- `angle.horizontal`: `front`, `side`, `three_quarter`, `rear`,
  `rear_three_quarter`, or `unknown`;
- `angle.vertical`: `eye_level`, `high_angle`, `low_angle`, or `unknown`; and
- `perspective`: `normal`, `wide`, `telephoto`, or `unknown`.

Framing definitions are mutually exclusive:

- `full_body`: head through feet are observable in the same frame;
- `upper_body`: head through approximately the waist are primary, without
  feet as a principal part of the frame;
- `portrait`: head and shoulders or chest are primary, without the waist as a
  principal part;
- `close_up`: face or a local body region is primary and does not include the
  shoulder/chest range of a portrait; and
- `unknown`: crop boundary or classification cannot be resolved.

The definitions, not evaluation order, determine the value. When boundary
conditions overlap, retain the wider observable body range; a useful checking
order is full body, upper body, portrait, then close-up. Prompt wording is not
evidence for a Camera Visibility value.

## Subject occupancy contract

`subject_occupancy` requires:

- `width_ratio`: visible Primary Subject width divided by image width;
- `height_ratio`: visible Primary Subject height divided by image height;
- `area_ratio`: visible Primary Subject silhouette area divided by image area;
  and
- `measurement_method`.

Numeric ratios are in the inclusive range `0.0..1.0`. `area_ratio` is not
`width_ratio * height_ratio` and is not bounding-box area. Hair and worn
clothing are part of the silhouette; background, independent objects, and
support objects are not.

`area_ratio` is a required closed state object:

```yaml
area_ratio:
  status: available
  value: 0.37
```

or:

```yaml
area_ratio:
  status: unavailable
```

`available` requires `value`; `unavailable` forbids it; `null` is invalid.

One `measurement_method` applies to all ratios in v0.1.0:

- `manual_estimate`: width and height are allowed; area is available only when
  the visible silhouette can be estimated;
- `segmentation`: width, height, and mask-derived silhouette area are allowed;
  or
- `bounding_box`: width and height are allowed, but `area_ratio.status` must
  be `unavailable` and `value` is forbidden.

Ratio-specific methods cannot be mixed. A future Schema version is required
to represent mixed methods.

The Schema guarantees field presence, state branches, enum/type constraints,
ratio ranges, and the bounding-box prohibition on storing area values. It does
not verify the producer's actual algorithm or silhouette accuracy.

## Visibility coverage and region contract

`visibility_coverage.status` is `complete` or `partial`.

- `complete` requires all 12 registered region keys;
- `partial` requires between 1 and 11 registered region keys; and
- zero regions are not an available Panel.

The registered regions are:

`head`, `face`, `hair`, `neck`, `shoulders`, `arms`, `hands`, `torso`, `hips`,
`legs`, `knees`, and `feet`.

Each recorded value is:

- `visible`;
- `partial`;
- `unclear`; or
- `not_visible`.

These are Observability states, not Research Observation values.

## Occlusion contract

`occlusions` is an optional ordered array. Each closed entry requires a
registered `region` and one cause:

- `clothing`;
- `hair`;
- `object`;
- `camera_crop`;
- `perspective`;
- `lighting`;
- `self_occlusion`; or
- `unknown`.

Structural Validation rejects only an exactly duplicated region/cause object.
The same cause may affect multiple regions, and one region may have multiple
causes.

A future Semantic Validator requires an occlusion region to exist in the same
Panel's `visible_regions` with state `partial`, `unclear`, or `not_visible`.
An occlusion on `visible` is invalid. Canonical order is lexical region then
lexical cause.

Occlusion is only a reason for reduced observability. It never creates or
changes Pose, Support, Contact, Morphology, or Observation Confidence.

## Run and Observation boundaries

A future Semantic Validator requires exact equality among the Canonical Run
directory name, manifest `run_id`, and artifact `run_id`. It may compare Panel
sets only when an Observation exists. It does not compare or rewrite
Observation values.

Camera Visibility Metadata does not determine Observation Confidence and does
not make a Research Conclusion.

## Structural Validation implemented

The Draft 2020-12 Schema validates:

- Root and Panel status branches;
- exactly six Panel objects and lexical Panel ID bounds;
- Root and Panel reason enums and `other` detail rules;
- nested Camera structure and enums;
- occupancy required fields, ratio ranges, area state, and bounding-box rule;
- complete/partial region counts and Visibility State enums;
- exact duplicate occlusion objects;
- lexical source path safety; and
- closed-object unknown-field rejection.

## Semantic Validation designed but not implemented

Future work may validate:

- Run directory, manifest, and artifact Run ID equality;
- Panel ID uniqueness and canonical order;
- Observation Panel-set equality, or `NOT_EVALUATED` when absent;
- source file existence, resolved containment, symlink containment, and exact
  naming convention;
- occlusion region/state consistency and canonical order;
- actual measurement-method declaration and segmentation-mask existence; and
- area value agreement with image content.

It must not re-analyze images to judge Primary Subject reasons, generate
Observation values, or emit Research conclusions.

## Reserved Error Catalog

These codes are reserved only. PR82 does not emit them.

| Code | Layer | Severity | Condition | Artifact usability | Remediation |
| --- | --- | --- | --- | --- | --- |
| `VISIBILITY_METADATA_RUN_MISMATCH` | Semantic | error | Run directory, manifest, and artifact IDs differ. | Invalid for Run-bound use. | Restore exact binding. |
| `VISIBILITY_PANEL_MISMATCH` | Semantic | error | Panel IDs are duplicate, noncanonical, or differ from an available Observation set. | Invalid for Panel-bound use. | Correct the Panel set/order. |
| `VISIBILITY_SOURCE_IMAGE_INVALID` | Structural/Semantic | error | Path syntax is unsafe, or the file is missing/outside the Run through resolution or symlink. | Invalid for image-bound use. | Correct the safe path or source file. |
| `VISIBILITY_RATIO_OUT_OF_RANGE` | Structural diagnostic | error | A ratio is outside `0.0..1.0`. | Structurally invalid. | Correct the estimate. |
| `VISIBILITY_REGION_DUPLICATE` | Parse/Semantic | error | A YAML region key is duplicated. | Invalid because a parser may have overwritten data. | Use a duplicate-key-rejecting loader. |
| `VISIBILITY_OCCLUSION_INVALID` | Semantic | error | Occlusion region/state or order is inconsistent. | Invalid for occlusion-aware use. | Correct the same-Panel reference/order. |
| `VISIBILITY_CAMERA_VALUE_INVALID` | Structural diagnostic | error | A Camera value is outside the enum. | Structurally invalid. | Use a registered value or `unknown`. |
| `VISIBILITY_COVERAGE_INVALID` | Structural diagnostic | error | Coverage status and region count disagree. | Structurally invalid. | Correct coverage or region set. |

## Structural Test contract

Tests cover Schema meta-validation, Root/Panel branches, exactly six Panels,
reason separation and details, nested Camera enums, occupancy and area state
branches, bounding-box constraints, coverage counts, Visibility States,
occlusion uniqueness, unsafe source paths, and closed objects.

Structural tests intentionally demonstrate that semantic-only cases such as
Panel ordering and `visible` plus occlusion remain structurally valid.

## Deferred work

Deferred items include a safe YAML loader, Semantic Validator, reserved Error
emission, estimation/generation tools, image binding, real-Run adoption,
multi-subject metadata, and Research Explorer display.
