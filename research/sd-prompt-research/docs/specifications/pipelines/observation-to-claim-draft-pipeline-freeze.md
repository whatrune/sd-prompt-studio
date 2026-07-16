# Observation-to-Claim Draft Pipeline Freeze Specification

Status: **Freeze specification; implementation not started**

Specification contract: `observation_to_claim_draft_v1`

Pre-schema draft format: `0.1.0`
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

The initial canonical slugs are `pose`, `face`, `hair`, `clothing`, `camera`,
`object`, and `other`. All entries require `slug`, `status`, `aliases`,
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
`metric_namespaces` are required arrays containing strings only. Unknown fields
inside `semantic_contract` are invalid. The arrays may not contain duplicate
values; their stored order is preserved, while their projection order is
normalized as described below.

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
contract. A contract field with insufficient definition uses the typed object
value `{"status":"not_defined"}`. A field that does not apply to that metric
uses `{"status":"not_applicable"}`. These states are distinct and neither may
be represented by null, an empty string, or an empty object. A source from which
the Pipeline cannot determine whether the field is undefined or inapplicable
produces `METRIC_COMPATIBILITY_UNAVAILABLE` rather than guessing either state.

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
missing or altered generated artifacts produce a corrupt-draft error.

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

The Generation Report is deterministic. It contains the generator and template
versions, source hashes, identity hash, generation-time Observation validation
and aggregate-consistency results, extracted and rejected metrics, unresolved
fields, missing Evidence, provisional Concept candidates, and required human
decisions. `subject_unresolved` is an unresolved field, not a rejected metric.

The Report never contains runtime Registry comparison, Candidate integration,
Finalize, environment, or timestamp results.

Receipts are immutable append-only lifecycle history under the historically
named `generation-receipts/` directory. Every Receipt has
`receipt_schema_version: "0.1.0"`, a UUIDv7 `receipt_id`, and one type:
`generation`, `candidate_generation`, `registry_compatibility_check`,
`finalize_attempt`, or `rollback`. Existing Receipts are never edited, deleted,
or migrated in place.

The Receipt root contract distinguishes structure version from lifecycle event:

```json
{
  "receipt_schema_version": "0.1.0",
  "receipt_type": "registry_compatibility_check"
}
```

`receipt_schema_version` versions the Receipt JSON structure.
`receipt_type` is an enum identifying the lifecycle event. Adding a Receipt
type requires an explicit enum extension and the corresponding contract review;
a breaking structural change requires a new Receipt Schema version. A type must
never be smuggled in as an unknown string under the existing `0.1.0` contract.

The future Receipt Schema path is
`schemas/observation-to-claim-receipt.schema.json`; its `$id`,
`x-contract-version`, and root const must consistently identify `0.1.0`.
Unsupported and mismatched versions produce `RECEIPT_SCHEMA_UNSUPPORTED` and
`RECEIPT_SCHEMA_VERSION_MISMATCH`.

Compatibility Receipts store generation-time and current Registry versions and
hashes, per-used-Module hard and change results, used Registry-role and metric
results, Evidence ID projection results, final compatibility classification,
warnings, and errors. Unused Registry material is not copied.

Artifact hashes include only artifacts present at receipt creation. JSON uses
JCS/SHA-256 and YAML uses normalized text SHA-256. Missing artifacts are omitted,
not null. A Receipt never hashes itself.

## 11. Human Resolution

`human-resolution.yaml` records human decisions needed to construct the current
Research Claim Schema: selected subject, Claim adoption, Evidence bindings,
claim family, scope, generalization status, interpretation candidates, causal
hypotheses, and rejected candidates. The Pipeline never selects these values.

`human_resolution_hash` is the JCS/SHA-256 hash of decision fields only. It
excludes comments, timestamps, and UI metadata. Bindings sort by Evidence ID and
role; rejected, interpretation, and causal candidates sort by their stable IDs.
The Candidate stores this hash and is invalid if it no longer matches.

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
