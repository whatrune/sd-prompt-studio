# Observation-to-Claim Draft Pipeline Freeze Specification

Status: **Freeze specification; implementation not started**

Specification contract: `observation_to_claim_draft_v1`

Pre-schema draft format: `0.1.0`
Generation Report format: `0.1.0`
Human Resolution format: `0.1.0`
Receipt format: `0.1.0`

## 1. Purpose and scope

The Observation-to-Claim Draft Pipeline converts validated, directly observed
research data into reviewable material from which a human may construct a
Research Claim candidate. It is a deterministic structuring pipeline, not a
research-judgment agent.

Its responsibility ends at safe staging, validation, and explicit finalization
of a human-resolved candidate. It must not:

- determine causality, effectiveness, improvement, or superiority;
- decide that a phrase produced an observed effect;
- confirm a Concept or invent a Concept ID;
- create a Claim Review, Promotion Approval, or Application Receipt;
- choose a Promotion action other than the schema-required staging default;
- update the Visual Concept Graph; or
- modify Observation data, aggregates, manifests, or existing canonical
  research records.

The responsibility layers remain distinct:

```text
Observed measurement
        ↓ deterministic extraction
Pre-schema descriptive draft
        ↓ human subject and binding decisions
Schema-valid Claim candidate
        ↓ validation and explicit finalization
Canonical Research Claim knowledge
        ↓ separate Review and Promotion workflow
Visual Concept Graph
```

An Experiment Research Review may contain hypotheses and next-experiment ideas,
but it is not a Pipeline input and is not a Claim Review Record.

### Normative roots

- Git Repository Root: repository containing `research/`.
- Research Project Root: `research/sd-prompt-research/`.
- Canonical Claim Knowledge: `research/sd-prompt-research/knowledge/`.
- Draft inbox: `research/sd-prompt-research/inbox/claim-drafts/`.

## 2. Workflow lifecycle

```text
Experiment
  ↓
Observation
  ↓
Observation Validation
  ↓
Deterministic Evidence Extraction
  ↓
Pre-schema Draft + Generation Report + Generation Receipt
  ↓
Human Resolution
  ↓
Claim Candidate
  ↓
Candidate Schema Validation
  ↓
Canonical Integration Validation
  ↓
Explicit Finalize Transaction
  ↓
Canonical Knowledge
```

### 2.1 Observation-only mode

`observation.json` is required. `manifest.yaml` is optional and, when present,
may supply only Run identity, provenance, and source information. Prompt text,
seed, and model metadata must not be used as evidence of causality.

This mode may generate descriptive material such as:

> BRG-007-B showed `reclined_arm_support` morphology in 5 of 6 panels.

It must not generate:

> The arm support phrase caused `reclined_arm_support` morphology.

### 2.2 Experiment-group mode

Experiment-group comparison requires observations, manifests, and explicit
Experiment Group metadata for all compared conditions. Version 1 permits a
comparison statement only when all applicable compatibility checks succeed:

- metric and Axis definition;
- Observation Schema and Rubric;
- model profile and Experiment Group;
- denominator meaning and panel universe;
- visibility conditions; and
- presence and compatibility of the involved Optional Modules.

Version 1 also requires equal panel counts. `higher` and `lower` describe only
mechanical observed-value comparisons; they do not imply statistical
significance, effect, improvement, or superiority.

Insufficient comparison context rejects only the comparison candidate. Valid
per-Run Observation-only drafts may still be produced.

## 3. Observation Module Registry

The Observation Module Registry is a future implementation artifact governed
by this Freeze specification.

- Research Project Root-relative path:
  `knowledge/registries/observation-modules.yaml`
- Repository path:
  `research/sd-prompt-research/knowledge/registries/observation-modules.yaml`
- Format: UTF-8 YAML, without BOM.
- Duplicate YAML keys and unknown fields are invalid.
- Absolute, drive-relative, UNC, traversal, and symlink escapes outside the
  Research Project Root are invalid.

This documentation-only change does not add the Registry or its JSON Schema.
The implementation PR must create them at the paths fixed here.

### 3.1 Registry instance structure

The following YAML is an explanatory partial example of the Registry shape. It
does not enumerate or limit the complete normative initial Module set.

```yaml
schema_version: "0.1.0"
registry_version: "1.0.0"
registry_id: observation-modules
modules:
  - slug: pose
    status: active
    aliases: []
    semantic_contract_version: "1.0.0"
    evidence_id_contract: evidence_id_v1
    semantic_contract:
      definition: Visible-state observations for body pose and support geometry.
      scope: [body_state, body_orientation, support_relation, contact, visibility]
      metric_namespaces: [pose]
  - slug: face
    status: active
    aliases: [face_observation]
    semantic_contract_version: "1.0.0"
    evidence_id_contract: evidence_id_v1
    semantic_contract:
      definition: Visible-state observations for face geometry, orientation, state, and visibility.
      scope: [face_geometry, face_orientation, gaze, visibility]
      metric_namespaces: [face]
```

The normative initial canonical Module slugs are:

- `pose`
- `face`
- `hair`
- `clothing`
- `camera`
- `object`
- `other`

An implementation must create entries for all seven slugs. The number of
entries shown in an explanatory YAML example never constrains the normative
Registry contents. All entries require `slug`, `status`, `aliases`,
`semantic_contract_version`, `evidence_id_contract`, and `semantic_contract`.
The only status values are `active` and `deprecated`.

In version 1, `semantic_contract` is a closed normative object rather than an
extension point. It requires exactly these fields:

```yaml
semantic_contract:
  definition: Visible-state observations for body pose and support geometry.
  scope:
    - body_state
    - body_orientation
    - support_relation
    - contact
    - visibility
  metric_namespaces:
    - pose
```

`definition` is a required non-empty string. `scope` and
`metric_namespaces` are required arrays of non-empty ASCII lowercase snake-case
strings matching `^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$`. Unknown fields inside
`semantic_contract` are invalid. The arrays may not contain duplicate values;
their stored order is preserved, while their projection order is normalized as
described below.

Canonical slugs and aliases use ASCII lowercase snake case matching
`^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$`. Slugs, aliases, and cross-entry combinations
must be unique. Aliases resolve to a canonical slug before ID generation and
never appear in an Evidence ID. A canonical slug that has appeared in an
Evidence ID cannot be renamed or removed; it may only be deprecated. Deprecated
slugs remain readable for historical evidence but cannot generate new evidence.

### 3.2 Registry Schema and versions

The following are independent:

- YAML root `schema_version`: Registry instance data-format version.
- Registry JSON Schema contract version: validation-document version.
- YAML root `registry_version`: Registry knowledge-content version.
- Module `semantic_contract_version`: module meaning-contract version.
- `evidence_id_contract_version`: Evidence ID generation contract.

The implementation Schema path is fixed as
`schemas/observation-module-registry.schema.json`. Its future `$id` must encode
the contract version, its `x-contract-version` must be `0.1.0`, and its
`schema_version` property must be `const: "0.1.0"`. JSON Schema `$schema`
remains the meta-schema URI and is not a project version.

The loader selects a supported Schema contract from the root
`schema_version`. A missing implementation produces
`REGISTRY_SCHEMA_UNSUPPORTED`; disagreement between the instance and selected
contract produces `REGISTRY_SCHEMA_VERSION_MISMATCH`. The Registry is never
best-effort parsed under an unknown contract.

All content versions use Semantic Versioning 2.0.0. Schema structure changes
bump `schema_version`; knowledge-content changes bump `registry_version`.

### 3.3 Registry content identity

`observation_module_registry_content_v1` contains `schema_version`,
`registry_version`, `registry_id`, and all Module fields. During projection
only, Modules are sorted by slug and aliases, scope, and metric namespaces are
sorted lexically. The stored YAML order is not rewritten. Duplicate validation
occurs before projection and is never hidden by sorting.

The stored order of `modules`, `aliases`, `scope`, and `metric_namespaces` is a
human-facing presentation order. In the semantic hash projection, those four
arrays are treated as sets and sorted lexically only in the temporary
projection. Reordering them in stored YAML does not change the semantic hash.
The Pipeline and Registry tooling must not rewrite the stored YAML merely to
match projection order.

The projection is RFC 8785 JCS encoded and SHA-256 hashed to lowercase hex.
Comments, YAML formatting, quote style, key order, physical path, timestamps,
and stored array order are excluded through semantic projection.

### 3.4 Module semantic version consistency

`module_semantic_content_v1` contains exactly the canonical `slug` and the
closed structured `semantic_contract`. It excludes status, aliases,
`evidence_id_contract`, every version field, Registry and file paths, and YAML
formatting. `scope` and `metric_namespaces` are sorted only while constructing
the projection. The result is RFC 8785 JCS encoded and SHA-256 hashed to
lowercase hexadecimal.

Baseline and candidate Registry versions are compared per canonical slug:

- semantic content changed without a greater SemVer:
  `MODULE_SEMANTIC_VERSION_NOT_INCREMENTED`;
- SemVer changed without semantic-content change:
  `MODULE_SEMANTIC_VERSION_CHANGED_WITHOUT_CONTENT_CHANGE` warning;
- content changed and SemVer increased: structurally valid, with the declared
  MAJOR/MINOR/PATCH level subject to human Registry review.

Module-wide breaking changes bump MAJOR. Backward-compatible capability
additions bump MINOR. Meaning-preserving corrections bump PATCH. Aliases,
display order, formatting, comments, and physical paths do not change the
semantic version. A validator cannot detect an unrecorded meaning change that
is absent from the structured semantic contract; preventing that is a Registry
review responsibility.

## 4. Registry and metric compatibility

Draft identity and later lifecycle compatibility are separate. A generated
Draft retains its generation-time Registry hashes and is never rewritten after
a Registry change. Re-generation uses current inputs and may produce a new
Draft identity.

### 4.1 Module compatibility

`module_hard_compatibility_v1` includes canonical slug, the MAJOR component of
`semantic_contract_version`, and `evidence_id_contract`. A hash difference is
incompatible. `module_change_fingerprint_v1` includes canonical slug, full
semantic version, semantic-content hash, ID contract, and status. A hard hash
match with a fingerprint difference is `compatible_changed`, unless the current
status is deprecated, which is incompatible for new Candidate or Finalize work.

Both projections are RFC 8785 JCS encoded and SHA-256 hashed to lowercase
hexadecimal. The hard projection excludes status, aliases, physical paths, and
the Registry-wide version. The change fingerprint excludes aliases and paths
but deliberately includes status and the full semantic version.

The hard-compatibility result is declaration-based. It proves that the
canonical slug, declared semantic MAJOR version, and Evidence ID contract agree;
it does not independently prove that two Module meanings are compatible. Human
Registry Review is responsible for verifying that every semantic-contract
change uses the correct SemVer increment. A meaning-breaking change hidden
behind an unchanged or insufficiently incremented version is a Registry review
failure, not evidence that the hard-compatibility algorithm established
compatibility.

The immutable Draft stores the generation-time values normatively, and the
sorted list is part of `draft_input_identity_v1`:

```yaml
used_module_compatibility:
  - canonical_module_slug: face
    semantic_contract_version: "1.0.0"
    evidence_id_contract: evidence_id_v1
    module_hard_compatibility_hash: "<lowercase-sha256>"
    module_change_fingerprint_hash: "<lowercase-sha256>"
    status_at_generation: active
  - canonical_module_slug: pose
    semantic_contract_version: "1.0.0"
    evidence_id_contract: evidence_id_v1
    module_hard_compatibility_hash: "<lowercase-sha256>"
    module_change_fingerprint_hash: "<lowercase-sha256>"
    status_at_generation: active
```

Entries are sorted by `canonical_module_slug`. Duplicate slugs are invalid.
These values make the compatibility decision reproducible; they do not replace
the complete generation-time Registry content hash retained in Draft identity.

Results are `unchanged`, `compatible_changed`, or `incompatible`. Whole-Registry
hash differences alone do not make an existing Draft incompatible.

### 4.2 Metric compatibility

`metric_compatibility_v1` is generated for each metric actually used by a
Draft. It contains Registry role, canonical Module slug, metric name, metric
path contract, definition, allowed values, denominator contract, and visibility
contract. The typed object value `{"status":"not_defined"}` may be used only
when that exact state is explicitly declared by the Registry or Metric Contract.
Likewise, `{"status":"not_applicable"}` may be used only when explicitly
declared by the Registry or Metric Contract. These states are distinct and
neither may be represented by null, an empty string, or an empty object.

The Pipeline must not derive either state from an absent field, a parse failure,
or generator judgment. An absent declaration, unreadable declaration, or any
other case in which the state cannot be established produces
`METRIC_COMPATIBILITY_UNAVAILABLE`; it is never repaired by synthesizing a typed
state.

For example:

```yaml
denominator_contract:
  status: not_defined
visibility_contract:
  status: not_applicable
```

Allowed values are sorted for projection. The projection is JCS/SHA-256 hashed.
The immutable Draft stores:

```yaml
used_metric_compatibility:
  - module: face
    registry_role: face_axis_registry
    metric: gaze_direction
    compatibility_projection_version: metric_compatibility_v1
    compatibility_hash: "<lowercase-sha256>"
```

Entries are sorted by Module, Registry role, and metric; duplicate compound
keys produce `DUPLICATE_METRIC_COMPATIBILITY_ENTRY`. Only metrics used in an
Observation statement or Evidence Fact are included. A changed hash for a used
metric produces `DRAFT_METRIC_INCOMPATIBLE`; unrelated metric changes do not
warn or invalidate.

### 4.3 Registry-role impact

The Draft records hashes only for logical Registry and Rubric roles it used.
Changes to unused Modules, aliases, Registry roles, or metrics do not produce
`REGISTRY_CHANGED_SINCE_DRAFT_GENERATION`. A changed used-role hash with intact
Module, metric, and Evidence ID compatibility produces that warning and a
`compatible_changed` result, not automatic incompatibility.

Compatibility results are runtime history and belong in a new Receipt, never
in the deterministic Generation Report.

## 5. Evidence ID contract

The contract version is `evidence_id_v1` and is an explicit input to
`draft_input_identity_v1`. Every used Module entry must reference the same
contract in version 1; disagreement produces `EVIDENCE_ID_CONTRACT_MISMATCH`.

The format is:

```text
evidence.<normalized_run_id>.<canonical_module_slug>.<metric_slug>.<source_hash_prefix>
```

### 5.1 Normalization

Run IDs are ASCII-lowercased; each non-ASCII-alphanumeric run is replaced by
one underscore; repeated underscores are collapsed and edge underscores are
removed. The result must be non-empty, ASCII-only, and at most 64 characters.
For example, `BRG-007-B` becomes `brg_007_b`.

The Module segment is the active canonical Registry slug. An unregistered slug
produces `MODULE_SLUG_NOT_REGISTERED`; a deprecated slug produces
`MODULE_SLUG_DEPRECATED`; a Registry slug unsupported by the current Research
Claim Schema produces `MODULE_NOT_SUPPORTED_BY_CLAIM_SCHEMA`.

Metric paths must pass `dotted_object_path_v1`; arrays and Unicode are invalid.
The slug lowercases the path, replaces dots with underscores, collapses
underscores, removes edge underscores, and must remain non-empty and no longer
than 96 characters. It is never truncated.

The source prefix is the first 16 lowercase hexadecimal characters of the
full Observation content SHA-256 after RFC 8785 JCS. Prefix extension, suffixes,
and sequence numbers are forbidden. Full hashes remain available for collision
and provenance checks.

### 5.2 Slug and ID collisions

Metric slug collisions are checked before ID construction within the compound
context of normalized Run ID, canonical Module slug, source prefix, and metric
slug. Distinct metric paths in one context produce `METRIC_SLUG_COLLISION`.
Repeated extraction of the same path is coalesced.

Evidence IDs are globally unique across all canonical assertion files. Multiple
definitions of one ID produce `DUPLICATE_EVIDENCE_ID` even when their content
matches. A Candidate ID matching exactly one existing Evidence Fact may reuse
it when `evidence_content_v1` matches; a content mismatch produces
`EVIDENCE_ID_COLLISION`. Automatic remediation is forbidden.

### 5.3 Evidence ID projection

`evidence_id_projection_v1` contains normalized Run ID, canonical Module slug,
metric slug, and source prefix. It is JCS/SHA-256 hashed. The projection, its
hash, full Observation content hash, resulting Evidence ID, and contract version
are stored normatively with each staged Evidence Fact and mirrored in Receipts.

At Candidate or Finalize time, a projection mismatch produces
`DRAFT_EVIDENCE_ID_INCOMPATIBLE`; an internally inconsistent stored hash
produces `EVIDENCE_ID_PROJECTION_HASH_MISMATCH`. Existing artifacts remain
historical records and are not rewritten.

## 6. Evidence lifecycle and content identity

Only mechanically verifiable values become staged Evidence: metric, count,
total, denominator, source Module and file, and directly available panel IDs.
Panel IDs are omitted when unavailable and are never reverse-engineered from an
aggregate. `unclear`, `not_visible`, `not_assessed`, zero count, and missing
value remain distinct.

Staged-only metadata may include Run ID, full source hash, denominator kind,
panel IDs, and confidence. It must not be emitted as unknown fields in the
current canonical Evidence Fact Schema.

Candidate creation assigns the final canonical Evidence ID and converts new
staged facts to schema-valid Evidence Fact objects. Finalize changes state and
storage location, never the ID.

### 6.1 Canonical reference responsibilities

- Root `evidence_refs` contains Evidence Fact object definitions owned by that
  assertion file, not a list of IDs.
- `observed_metrics[].evidence_ref_ids` contains every Evidence ID used for the
  observed metric.
- `evidence_bindings[].evidence_ref_id` contains human-decided Claim bindings.

Existing canonical Evidence is referenced but not copied. A file containing
only reused Evidence keeps the schema-required root field as `evidence_refs: []`.
New and reused IDs may be mixed in observed metrics and bindings, while only new
Fact objects appear in the root. All referenced IDs resolve against the global
Canonical Knowledge index.

### 6.2 Evidence content identity

`evidence_content_v1` contains observation Module, resolved full Observation
content hash, metric, denominator path, count, total, and measurement coverage.
It excludes Evidence ID, storage path and mode, notes, timestamps, panel IDs,
and confidence. The projection is RFC 8785 JCS and SHA-256 lowercase hex.

## 7. Aggregate and Optional Module handling

The Pipeline does not calculate or repair aggregates. It uses only an existing
`computed_aggregate` that has passed Observation Schema and panel/aggregate
consistency validation. A missing or inconsistent aggregate in a required
Module is a generation failure. In an Optional Module it rejects that Module's
candidate, records the reason, and permits otherwise valid core material.

Pose, Face, and future Modules retain independent source files, metric paths,
denominator kinds, and panel universes. Totals are never compared automatically
across Modules.

## 8. Draft identity

`draft_input_identity_v1` is independent of Assertion, Promotion, Application,
Graph, and other audit hashes. Its canonical projection contains:

- JCS/SHA-256 hashes of all source Observation and Optional Module JSON files;
- normalized-text SHA-256 hashes of manifests, or typed `not_provided` values;
- JCS or normalized-text hashes of Experiment Group metadata according to its
  source format;
- Observation Validator and validation-profile versions;
- aggregate-consistency and metric-extraction profile versions;
- generator and template versions;
- Registry instance Schema version, knowledge version, and content hash;
- used Module hard-compatibility hashes and ID-contract references;
- used Rubric and Axis Registry role hashes;
- sorted `used_metric_compatibility` entries;
- `evidence_id_contract_version`; and
- the pre-schema Draft format version.

Source collections are sorted by semantic role, Module, and Run ID. Registry
collections are sorted by logical role. Source JSON arrays are not reordered.
Physical source paths are provenance, not identity.

JSON uses RFC 8785 JCS plus SHA-256. YAML text inputs use
`normalized_text_file_sha256_v1`: UTF-8, BOM removed, CRLF and CR normalized to
LF, with no other whitespace, Unicode, comment, or key-order normalization.
Missing optional inputs use a typed `{"status":"not_provided"}` value.

Runtime timestamps and environment data are excluded. An identical projection
produces the same Draft ID. A whole-Registry semantic change may produce a new
identity on re-generation even when it does not invalidate an existing Draft.

## 9. Pre-schema Draft and storage

The normal directory is:

```text
inbox/claim-drafts/<draft-id>/
├─ pre-schema-draft.yaml
├─ generation-report.json
├─ generation-receipts/
│  └─ <receipt-id>.json
├─ human-resolution.yaml       # added after human resolution
└─ claim-candidate.yaml        # added after candidate generation
```

Generated files are immutable. Human decisions are written only to
`human-resolution.yaml`; direct edits to the Draft, Report, or Candidate are
tampering errors. A changed Human Resolution invalidates the existing Candidate
and requires regeneration.

The pre-schema Draft uses `draft_schema_version: "0.1.0"`,
`draft_type: descriptive_observation`, and
`generator_contract: observation_to_claim_draft_v1`. It may leave `subject`
unresolved. Its structured Observation statement is normative; a localized
display sentence is derived presentation.

An identical ID and identity with intact generated artifacts is idempotent
success. An existing human-resolution or Candidate artifact is never
overwritten. One ID with a different identity produces `DRAFT_ID_COLLISION`;
missing generated artifacts produce `DRAFT_CORRUPT`, and altered immutable
generated artifacts produce `DRAFT_TAMPERED`.

`DRAFT_CORRUPT` is limited to a required artifact being absent, an artifact that
cannot be parsed under its fixed contract, a missing required field, or an
internally inconsistent artifact reference. `DRAFT_TAMPERED` is limited to an
immutable artifact hash mismatch, disagreement between stored content and its
recorded hash, or detected human modification of a generated immutable artifact.
The codes are mutually exclusive for one diagnosed condition; a hash mismatch
is tampering even when the modified content also fails parsing.

### 9.1 Failure artifacts

If valid identity cannot be constructed, diagnostics use:

```text
inbox/claim-draft-failures/<attempt-id>/
├─ generation-report.json
└─ generation-receipts/
   └─ <receipt-id>.json
```

Attempt and Receipt IDs are independent UUIDv7 values in RFC 9562 lowercase
hyphenated form. Invalid Observation JSON, missing required aggregates, missing
required versions, and identity-construction failure are generation failures.

## 10. Generation Report and Receipt

### 10.1 Shared Generation Report envelope

The Generation Report is a closed, deterministic JSON artifact used for both
success and failure. Its required root fields are exactly:

- `generation_report_schema_version`: string, const `"0.1.0"`;
- `report_type`: enum `generation` or `generation_failure`;
- `subject_id_kind`: enum `draft_id` or `attempt_id`;
- `subject_id`: non-empty string;
- `generator`: `generator_contract_v1` object;
- `sources`: `source_collection_v1` object;
- `identity`: one of the closed identity objects below;
- `observation_validation`: `observation_validation_v1` object;
- `aggregate_validation`: `aggregate_validation_v1` object;
- `metric_extraction`: `metric_extraction_v1` object;
- `unresolved_fields`: array of `unresolved_field_v1`;
- `human_decision_required`: array of `human_decision_required_v1`; and
- `diagnostics`: array of `diagnostic_v1`.

Every root field is required and unknown root or nested fields are invalid.
Null, empty strings, empty objects, or field omission must not stand for an
unreached or unavailable state.

On success, `report_type` is `generation`, `subject_id_kind` is `draft_id`, and
`subject_id` equals `identity.draft_id`. The identity object requires exactly:

```yaml
status: succeeded
draft_id: <non-empty string>
draft_input_identity_hash: <64-character lowercase SHA-256>
```

On failure, `report_type` is `generation_failure`, `subject_id_kind` is
`attempt_id`, and `subject_id` is the failure-attempt UUIDv7. The identity object
requires exactly:

```yaml
status: failed
error_code: <non-empty error code string>
```

A failure identity has no Draft identity. It is invalid to add `draft_id` or
`draft_input_identity_hash`, invent either value, use the attempt ID as a Draft
ID, or substitute null or an empty string.

### 10.2 Generation Report nested contracts

`generator_contract_v1` requires exactly three non-empty strings:
`generator_contract`, `generator_version`, and `template_version`.

`source_collection_v1` requires exactly one field, `source_files`, an array of
closed `source_file_v1` objects. Each source object requires:

- `source_role`: enum `observation`, `optional_module_observation`, `manifest`,
  `experiment_group_metadata`, `module_registry`, `axis_registry`, or `rubric`;
- `logical_path`: non-empty POSIX-style provenance path;
- `hash_contract`: enum `jcs_sha256_v1` or
  `normalized_text_file_sha256_v1`;
- `content_hash`: 64-character lowercase SHA-256;
- `module`: canonical Module slug or the literal `not_applicable`; and
- `run_id`: non-empty string or the literal `not_applicable`.

Unknown source fields are invalid. Entries sort by `source_role`, `module`,
`run_id`, then `logical_path`. Duplicate compound keys are invalid.

`step_status_v1` is the shared enum `not_started`, `succeeded`, `failed`,
`inconclusive`, or `not_applicable`. Every step object contains a required
`step_status`; no other value, null, empty string, empty object, or omitted step
field expresses execution state.

`observation_validation_v1` requires exactly `step_status`,
`validator_version` as a non-empty string, and `result_code` as a non-empty
string. `aggregate_validation_v1` requires exactly `step_status` and
`consistency_result`, whose enum is `consistent`, `inconsistent`, or
`unavailable`.

`metric_extraction_v1` requires exactly `step_status` and `metrics`. `metrics`
is an array of closed `extracted_metric_v1` objects requiring:

- `module`: canonical Module slug;
- `metric_path`: dotted metric path;
- `observed_value`: non-empty string;
- `count`: integer greater than or equal to zero;
- `total`: integer greater than or equal to one; and
- `evidence_candidate_id`: stable non-empty Evidence candidate ID.

Unknown metric fields are invalid. Metrics sort by `module`, `metric_path`,
`observed_value`, then `evidence_candidate_id`. Duplicate compound keys are
invalid.

`unresolved_field_v1` requires exactly `field_path` and `reason_code`, both
non-empty strings. `human_decision_required_v1` requires exactly
`decision_key`, `reason_code`, and `candidate_ids`; the first two are non-empty
strings and `candidate_ids` is a unique array of non-empty strings. Unresolved
entries sort by `field_path` and `reason_code`. Decision entries sort by
`decision_key` and `reason_code`, and their candidate IDs sort lexically.
`subject_unresolved` is an unresolved field, not a rejected metric.

`diagnostic_v1` requires exactly `severity`, `code`, `path`, and `message`.
Severity is `error` or `warning`; the remaining values are non-empty strings.
Diagnostics sort by severity, code, path, then message.

`generation_report_content_v1` contains the complete closed Report object. Map
keys use RFC 8785 JCS order and arrays use the sort rules above. Source JSON
arrays whose original order is evidentiary are represented only through source
hashes and are not reordered. The JCS projection is SHA-256 hashed to lowercase
hexadecimal. Every Report field is in this projection.

Generation Reports contain no execution timestamp. Source timestamps remain
inside source hashes and provenance. The Report never contains runtime Registry
comparison, Candidate integration, Finalize, or environment results.

### 10.3 Receipt envelope

Receipts are immutable append-only lifecycle history under the historically
named `generation-receipts/` directory. Every Receipt has
`receipt_schema_version: "0.1.0"`, a UUIDv7 `receipt_id`, and one type:
`generation`, `candidate_generation`, `registry_compatibility_check`,
`finalize_attempt`, or `rollback`. Existing Receipts are never edited, deleted,
or migrated in place.

The Receipt is a closed JSON envelope. Its exact required root fields are:

- `receipt_schema_version`: string, const `"0.1.0"`;
- `receipt_id`: UUIDv7 string;
- `receipt_type`: the closed enum below;
- `recorded_at`: RFC 3339 UTC timestamp string with a `Z` suffix;
- `result`: the closed result enum below;
- `related_artifact_ids`: closed object;
- `related_artifact_hashes`: closed object; and
- `payload`: the closed object selected by `receipt_type`.

Unknown root fields are invalid. `receipt_id` is UUIDv7.
`recorded_at` is an RFC 3339 UTC timestamp with a `Z` suffix and is deliberately
runtime history rather than deterministic identity. `result` is one of
`succeeded`, `failed`, `inconclusive`, or `not_applicable`.

`related_artifact_ids` is a closed object whose only allowed role keys are
`pre_schema_draft`, `generation_report`, `human_resolution`, `claim_candidate`,
`canonical_assertion`, and `validation_result`. Each present value is a
non-empty stable artifact ID. `related_artifact_hashes` permits exactly the same
role keys. Each present hash value is a closed object requiring exactly
`algorithm`, a non-empty string naming the applicable hash contract, and
`value`, a 64-character lowercase SHA-256. Unknown role keys are invalid. A role
is omitted from both maps when that artifact does not exist; null, an empty
string, or an empty object is invalid.

The root contract distinguishes structure version from lifecycle event:

```json
{
  "receipt_schema_version": "0.1.0",
  "receipt_type": "registry_compatibility_check"
}
```

`receipt_schema_version` versions the Receipt JSON structure.
`receipt_type` is an enum identifying the lifecycle event. The `0.1.0` enum is
frozen: adding any Receipt type is a Receipt Contract change and requires a new
`receipt_schema_version`. A type must never be smuggled in as an unknown string
under the existing `0.1.0` contract.
Both fields are required at the Receipt root. The complete version 0.1.0
`receipt_type` enum is `generation`, `candidate_generation`,
`registry_compatibility_check`, `finalize_attempt`, and `rollback`.

### 10.4 Receipt payload contracts

Every payload is closed. All fields listed for its type are required, unknown
fields are invalid, and every step field is a closed `receipt_step_v1` object
requiring exactly `step_status` and `result_code`. `step_status` uses
`step_status_v1`; `result_code` is a non-empty string. For `not_started` it must
be `NOT_STARTED`; for `not_applicable` it must be `NOT_APPLICABLE`. Failed and
inconclusive steps use their applicable fixed diagnostic code, and a succeeded
step uses `SUCCEEDED`. Null, empty strings, empty objects, and field omission
cannot express an unreached step.

The `generation` payload requires:

- `source_validation`: `receipt_step_v1`;
- `identity_construction`: `receipt_step_v1`;
- `report_persistence`: `receipt_step_v1`; and
- `diagnostics`: array of `diagnostic_v1`.

The `candidate_generation` payload requires:

- `draft_validation`: `receipt_step_v1`;
- `human_resolution_validation`: `receipt_step_v1`;
- `candidate_construction`: `receipt_step_v1`;
- `schema_validation`: `receipt_step_v1`;
- `integration_validation`: `receipt_step_v1`; and
- `diagnostics`: array of `diagnostic_v1`.

The `registry_compatibility_check` payload requires:

- `registry_load`: `receipt_step_v1`;
- `compatibility_evaluation`: `receipt_step_v1`;
- `classification`: enum `unchanged`, `compatible_changed`, `incompatible`, or
  `not_available`;
- `module_results`: array of closed objects requiring `canonical_module_slug`,
  `generation_hash`, `current_hash`, and `result`;
- `metric_results`: array of closed objects requiring `module`, `metric`,
  `generation_hash`, `current_hash`, and `result`;
- `evidence_id_results`: array of closed objects requiring `evidence_id`,
  `generation_projection_hash`, `current_projection_hash`, and `result`; and
- `diagnostics`: array of `diagnostic_v1`.

`not_available` is permitted only when Registry loading or compatibility
evaluation did not succeed. Every compatibility hash is a 64-character
lowercase SHA-256 and every item result uses `unchanged`, `compatible_changed`,
or `incompatible`. Module results sort
by canonical slug, metric results by Module then metric, and Evidence results by
Evidence ID. Unknown result-object fields and duplicate sort keys are invalid.

The `finalize_attempt` payload requires:

- `lock_acquisition`, `snapshot_validation`, `integration_validation`,
  `install`, and `postcondition_validation`, each `receipt_step_v1`;
- `destination_path`: non-empty canonical logical path; and
- `diagnostics`: array of `diagnostic_v1`.

The `rollback` payload requires:

- `related_finalize_receipt_id`: UUIDv7;
- `rollback_execution`: `receipt_step_v1`;
- `cause_code`: non-empty error code;
- `staged_paths`: unique array of non-empty logical paths;
- `created_paths`: unique array of non-empty logical paths;
- `pre_snapshot`: `snapshot_result_v1`;
- `post_snapshot`: `snapshot_result_v1`; and
- `diagnostics`: array of `diagnostic_v1`.

`snapshot_result_v1` is a closed object requiring exactly `step_status`,
`result_code`, and `content_hash`. The first two follow `receipt_step_v1`.
`content_hash` is either a 64-character lowercase SHA-256 or the literal
`not_available`; that literal is permitted only when `step_status` is
`failed`, `inconclusive`, `not_started`, or `not_applicable`.

Path arrays sort lexically. Diagnostic arrays use `diagnostic_v1` ordering. All
other payload arrays use their explicit ordering above. The complete Receipt,
including its payload, is the `receipt_content_v1` JCS projection when an
external audit record hashes it. A Receipt never stores or includes its own hash
inside that projection.

Receipt Schema versions are managed independently from Research Claim Schema
versions and Observation Module Registry Schema versions. No one of these
version values may be inferred from or substituted for another.

If mechanically encoded later, the Receipt Schema path is
`schemas/observation-to-claim-receipt.schema.json`; its `$id`,
`x-contract-version`, and root const must consistently identify the already
fixed `0.1.0` contract in this document and may not add contract decisions.
Unsupported and mismatched versions produce `RECEIPT_SCHEMA_UNSUPPORTED` and
`RECEIPT_SCHEMA_VERSION_MISMATCH`.

Compatibility Receipts store generation-time and current Registry versions and
hashes, per-used-Module hard and change results, used Registry-role and metric
results, Evidence ID projection results, final compatibility classification,
warnings, and errors. Unused Registry material is not copied.

Artifact hashes use JSON JCS/SHA-256 or YAML normalized-text SHA-256 as declared
by each map entry. Map ordering is governed by JCS. Receipt timestamps and
UUIDs are lifecycle data and are not claimed to be deterministic across repeated
executions.

## 11. Human Resolution

`human-resolution.yaml` is a closed human-authored artifact with
`human_resolution_schema_version: "0.1.0"`. Its exact root fields are:

- `human_resolution_schema_version`;
- `resolution_id`;
- `source_draft_id`;
- `source_draft_identity_hash`;
- `selected_assertion_id`;
- `selected_subject`;
- `selected_claim_statement`;
- `selected_evidence_bindings`;
- `selected_claim_family`;
- `selected_scope`;
- `selected_generalization_status`;
- `interpretation_candidates`;
- `causal_hypotheses`;
- `depends_on`;
- `supersedes`;
- `rejected_candidates`;
- `decided_by`;
- `decided_at`.

All root fields are required and unknown root or nested fields are invalid.
`human_resolution_schema_version` is a string const `"0.1.0"`;
`resolution_id` is a UUIDv7 string; `source_draft_id` is a non-empty string;
`source_draft_identity_hash` is a 64-character lowercase SHA-256; `decided_by`
is a non-empty string; and `decided_at` is an RFC 3339 UTC timestamp string with
a `Z` suffix. `selected_claim_family` is an ASCII lowercase snake-case string.
Empty decisions use the field's valid empty array; they are not represented by
a missing field. The Generator must not infer Claim family from Observation.

Only Human Resolution decides `selected_assertion_id`, `selected_subject`,
`selected_claim_statement`, `selected_evidence_bindings`, `selected_scope`,
`selected_generalization_status`, `interpretation_candidates`,
`causal_hypotheses`, `depends_on`, and `supersedes`. It also decides the Claim
family and rejected candidates needed by the current Candidate contract. The
Generator never selects `selected_assertion_id` or any other research-semantic
value. The selected Assertion ID must satisfy the current Research Claim Schema
and pass the global collision check before Candidate generation.

### 11.1 Normative nested Research Claim references

The following fields use the exact closed definitions from Research Claim
Assertion Schema version `0.1.0`, `$id`
`https://local.sd-prompt-studio/research-claim-assertion-v0.1.schema.json`:

- `selected_assertion_id`: `#/$defs/assertionId`;
- `selected_subject`: `#/$defs/subject`;
- `selected_claim_statement`: `#/$defs/claim`;
- each `selected_evidence_bindings` item: `#/$defs/evidenceBinding`;
- `selected_claim_family`: `#/$defs/snakeName`;
- `selected_scope`: `#/$defs/scope`;
- `selected_generalization_status`: `#/$defs/generalizationStatus`;
- each `interpretation_candidates` item: `#/$defs/interpretationCandidate`;
- each `causal_hypotheses` item: `#/$defs/causalHypothesis`; and
- each `depends_on` and `supersedes` item: `#/$defs/assertionId`.

These are version-pinned normative references, not delegation to a future
Schema. All referenced objects retain their required fields, enums, and
`additionalProperties: false` rules. In particular,
`selected_generalization_status` is the referenced closed object, not a scalar
string. Evidence bindings sort by `evidence_ref_id`, `evidence_role`, then
`applies_to`; interpretation and causal entries sort by their stable IDs;
`depends_on` and `supersedes` are unique and sort lexically. These arrays and
objects are included in `human_resolution_content_v1`.

`rejected_candidates` has no Research Claim Schema equivalent and is therefore
defined here as an array of closed objects requiring exactly:

- `candidate_kind`: enum `subject`, `claim_statement`, `evidence_binding`,
  `interpretation_candidate`, or `causal_hypothesis`;
- `candidate_id`: non-empty stable candidate identifier; and
- `reason_code`: non-empty string.

Rejected candidates sort by `candidate_kind`, `candidate_id`, then
`reason_code`; duplicate compound keys are invalid. All three fields are in the
Human Resolution content projection.

`human_resolution_content_v1` contains the source Draft ID and identity hash,
selected Assertion ID, all selected research-semantic fields, adopted relation
lists, and rejected candidates. It excludes `resolution_id`, `decided_by`,
`decided_at`, YAML formatting, comments, and presentation
order. Evidence bindings sort by Evidence ID and role. Scope, dependency, and
supersession lists sort by stable ID or canonical value. Rejected,
interpretation, and causal candidates sort by their stable IDs. Duplicate set
members are invalid before projection.

The projection is RFC 8785 JCS encoded and SHA-256 hashed to lowercase
hexadecimal. The resulting `human_resolution_hash` is stored by the Candidate;
the Candidate is invalid if it no longer matches. Human timestamps are retained
for audit history but do not alter the semantic decision hash.

## 12. Claim Candidate and validation

`claim-candidate.yaml` is generated only after every current Research Claim
Schema-required decision is resolved. Its Assertion status is `draft`; Promotion
uses the schema-valid `no_promotion` / `not_nominated` form with empty approval
and application arrays. It does not invent Review, Approval, or Application
records.

Every required Assertion field has an explicit source:

- `assertion_id` is a human-approved stable candidate ID after global collision
  checking;
- `status` is fixed to `draft`;
- `subject`, the adopted `claim.statement`, `evidence_bindings`, `scope`, and
  `generalization_status` come from Human Resolution;
- `observed_metrics` comes from validated staged Evidence and must reproduce
  the exact Evidence count and total rules of the current Validator;
- `interpretation_candidates` and `causal_hypotheses` contain only explicitly
  adopted human candidates and may otherwise be empty;
- `depends_on` and `supersedes` require an explicit human decision and may be
  empty; the Pipeline never infers either relation;
- `reproduction` uses only mechanically resolved Run, condition, independent
  Experiment Group, model, and context metadata; unresolved required values
  block Candidate generation;
- `created_by` records the Pipeline identity and version plus candidate creation
  time, without entering the research interpretation; and
- `promotion` is fixed to `action: no_promotion`, `status: not_nominated`, and
  empty `approval_ids` and `applications`.

The Candidate does not use invented placeholders to satisfy the Schema. Any
unresolved required value stays in `human_decision_required` and prevents
Candidate generation.

Candidate validation has two distinct layers:

1. Candidate Schema validation checks required fields, types, enums, and
   structure. It is necessary but insufficient.
2. Canonical integration validation checks the exact staged canonical assertion
   file together with all current canonical Assertions, Evidence, Graph
   Concepts, Registry references, and other Validator inputs.

The exact bytes that will be installed, including generated root metadata, are
the integration-validation target—not merely the source Candidate.

## 13. Finalize transaction

Finalize requires completed Human Resolution, an up-to-date Candidate, successful
schema and integration validation, no ID collision, and an explicit human
Finalize action.

It holds one exclusive lock over all Research Claim Canonical Knowledge for the
entire transaction. Lock acquisition times out after 30 seconds and failure
performs no canonical write. The implementation mechanism may vary but must
provide equivalent Windows and Ubuntu exclusion; stale locks are never removed
without ownership and liveness checks.

Within the lock:

1. calculate `canonical_knowledge_snapshot_v1`;
2. generate complete final bytes in a temporary file on the destination file
   system;
3. validate that staged file with current Canonical Knowledge;
4. recalculate and compare the snapshot immediately before install;
5. revalidate if the snapshot changed;
6. perform a create-only atomic rename without overwriting a destination;
7. run postcondition validation; and
8. release the lock only after success or completed rollback.

Failure to acquire the lock within the fixed timeout produces
`FINALIZE_LOCK_TIMEOUT`. If a changed snapshot cannot be reconciled by the
required revalidation before install, Finalize stops with
`CANONICAL_SNAPSHOT_CHANGED`. A create-only install that encounters an existing
destination produces `CANONICAL_DESTINATION_EXISTS`; it never overwrites that
file. Postcondition validation failure produces `POST_VALIDATION_FAILED` and
requires rollback of the file created by that attempt. Failure to complete that
rollback produces the critical `ROLLBACK_FAILED` error.

The snapshot is a sorted JCS/SHA-256 projection of normalized logical paths and
content hashes for every input read by integration validation, including Claim
Assertions and Reviews, Concept Graph reference sources, and used Registries.

Post-validation failure rolls back only the file created by this attempt. It
never changes an existing canonical file. Rollback failure is a critical error;
the rollback Receipt records staged and created paths, pre/post snapshots,
validation results, and rollback outcome.

## 14. Canonical Assertion File

Finalize creates one new file per Assertion and never edits an existing
Assertion file. Given `assertion.brg007.arm_support.001`, lowercase conversion,
dot/underscore-to-hyphen replacement, hyphen collapse, and edge trimming yield:

```text
assertion_file_id: assertion-brg007-arm-support-001
filename: assertion-brg007-arm-support-001.yaml
```

Normalization collisions are errors. The root contains the current Research
Claim Schema-required `schema_version`, `assertion_file_id`, `claim_family`,
`path_base`, `metric_path_syntax`, `axis_registry_refs`, `evidence_refs`, and a
one-item `assertions` array. Fixed values follow the current Schema; human
decisions supply claim family and semantic Assertion fields.

Axis Registry paths remain Research Project Root-relative. Evidence
`observation_path` values remain Git Repository Root-relative, consistent with
the existing [Research Claim path contract](../../research-claim-path-contract.md).

## 15. Error phases and catalog

Errors are gated per Evidence Candidate; independent Candidates may report
independent errors. A failed earlier phase does not produce speculative later
errors.

1. Individual input validation:
   `INVALID_METRIC_PATH`, `MODULE_SLUG_NOT_REGISTERED`,
   `MODULE_SLUG_DEPRECATED`, `MODULE_NOT_SUPPORTED_BY_CLAIM_SCHEMA`.
2. Batch slug normalization: `METRIC_SLUG_COLLISION`.
3. Global canonical index construction: `DUPLICATE_EVIDENCE_ID`.
4. Candidate-to-index comparison: `EVIDENCE_ID_COLLISION`.

Additional fixed codes are:

- `REGISTRY_SCHEMA_UNSUPPORTED`
- `REGISTRY_SCHEMA_VERSION_MISMATCH`
- `MODULE_SEMANTIC_VERSION_NOT_INCREMENTED`
- `MODULE_SEMANTIC_VERSION_CHANGED_WITHOUT_CONTENT_CHANGE`
- `EVIDENCE_ID_CONTRACT_MISMATCH`
- `DRAFT_REGISTRY_INCOMPATIBLE`
- `DRAFT_METRIC_INCOMPATIBLE`
- `DRAFT_EVIDENCE_ID_INCOMPATIBLE`
- `EVIDENCE_ID_PROJECTION_HASH_MISMATCH`
- `METRIC_COMPATIBILITY_UNAVAILABLE`
- `DUPLICATE_METRIC_COMPATIBILITY_ENTRY`
- `DRAFT_ID_COLLISION`
- `RECEIPT_SCHEMA_UNSUPPORTED`
- `RECEIPT_SCHEMA_VERSION_MISMATCH`

The fixed Registry change warning is
`REGISTRY_CHANGED_SINCE_DRAFT_GENERATION`; it is emitted only for an affected
used Module, Registry role, or metric.

The following lifecycle error contracts are also fixed. "Canonical timing"
describes the point at which the error is detected; it does not authorize any
additional write.

Receipt type follows the detection phase. Generation emits `generation`,
Candidate generation emits `candidate_generation`, Finalize emits
`finalize_attempt`, and Rollback emits `rollback`. This phase mapping also
applies to `DRAFT_CORRUPT` and `DRAFT_TAMPERED`; neither code creates a new
Receipt type.

| Code | Phase | Retry | Canonical timing | Receipt | Rollback |
| --- | --- | --- | --- | --- | --- |
| `REQUIRED_HUMAN_DECISION_MISSING` | Human Resolution / Candidate generation | Yes, after a human supplies the missing decision | Before any canonical change | `candidate_generation` | No |
| `DRAFT_TAMPERED` | Draft load, Candidate generation, or Finalize | No; restore or regenerate the immutable Draft first | Before any canonical change | Detection-phase Receipt type | No |
| `DRAFT_CORRUPT` | Draft load, Candidate generation, or Finalize | No; restore or regenerate the incomplete Draft first | Before any canonical change | Detection-phase Receipt type | No |
| `FINALIZE_LOCK_TIMEOUT` | Finalize lock acquisition | Yes | Before any canonical change | `finalize_attempt` | No |
| `CANONICAL_SNAPSHOT_CHANGED` | Finalize integration validation | Yes, from a fresh snapshot | Before install | `finalize_attempt` | No |
| `CANONICAL_DESTINATION_EXISTS` | Finalize create-only install | Only after resolving the ID or destination collision | No file from this attempt is installed | `finalize_attempt` | No |
| `POST_VALIDATION_FAILED` | Finalize postcondition validation | Yes, only after successful rollback and a new validation attempt | After this attempt created its file | `finalize_attempt` and `rollback` | Required |
| `ROLLBACK_FAILED` | Finalize rollback | No automatic retry; operator remediation is required | After this attempt created its file | `rollback` | Attempted but incomplete |

These names are canonical. Implementations must not emit a second alias code
for the same condition. Existing structural, Registry, Evidence, and Receipt
codes retain their existing phases and are not duplicated by this lifecycle
table.

## 16. Finalize rules and invariants

The following are invariant:

- no Pipeline stage makes a research conclusion;
- no generated artifact is silently repaired or overwritten;
- no Candidate is canonical merely because it is schema-valid;
- no Evidence or Assertion ID changes during Finalize;
- no existing canonical Evidence Fact is copied into a new file;
- no Finalize occurs without current integrated validation and an exclusive
  lock;
- no post-validation failure leaves the newly created canonical file behind;
  and
- Registry changes never rewrite a historical Draft identity.

## 17. Planner boundary

Future Experiment Planner integration may consume only gaps such as missing
Evidence, unresolved fields, incompatible comparison context, and required
controls. It must not receive a generated confirmed conclusion or causal
relation, and this Pipeline does not automatically choose a next experiment.

## 18. Non-goals and implementation boundary

This documentation PR does not add or change:

- Generator, Finalizer, UI, Agent, or CLI code;
- tests or Validators;
- Research Claim or Observation Schema;
- Observation Module Registry or Receipt Schema files;
- Concept source or distribution files;
- Review, Approval, Application, Claim, Observation, or Run data; or
- Visual Concept Graph behavior.

Implementation may choose concrete cross-platform lock and UUIDv7 libraries,
temporary-file APIs, and command names only when they preserve every normative
contract above. Those are implementation choices, not unresolved data or
lifecycle semantics.

### 18.1 Specification completeness

This document is the cumulative, standalone contract for the Pipeline. It
normatively covers the independent Observation Module Registry version, Module
semantic contract, Evidence ID contract, Module and metric compatibility, Draft
identity, Evidence lifecycle, Human Resolution, Candidate Schema validation,
Canonical integration validation, Finalize transaction, and Receipt contract.
An implementation must not require earlier prompts or chat history to interpret
these contracts.

No Pipeline artifact contract is left implicit at this Freeze boundary. The
Pre-schema Draft, Generation Report, Human Resolution, and Receipt contracts are
fixed at `0.1.0` in this document. Claim Candidate and Canonical Assertion
structure use the current Research Claim Schema rather than defining a parallel
schema here. Any later physical Schema encoding for the new `0.1.0` artifacts is
mechanical only and must not add contract decisions.

**All Artifact Envelope and Nested Contract definitions in this specification
are normative and implementation-ready.** Generation failure never requires an
invented Draft ID, Human Resolution supplies Claim family, every nested field
has either a complete local contract or a version-pinned current-Schema pointer,
and every Receipt type has a closed payload. No contract meaning is delegated to
a later Schema or to implementation judgment.
