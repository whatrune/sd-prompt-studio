# Prompt Provenance Foundation Freeze Specification

## Status and authority

- Contract status: Freeze
- Contract version: `0.1.0`
- Normative schema: `schemas/prompt-provenance.schema.json`
- Canonical artifact path: `experiments/<domain>/<run-id>/prompt-provenance.yaml`

This document is the normative source for Prompt Provenance Foundation v0.1.0.
The JSON Schema and structural tests implement this document. Earlier design
notes and chat prompts are non-normative.

## Purpose

Prompt Provenance represents a Stable Diffusion prompt as ordered, traceable
phrase occurrences without replacing the raw prompt. It supports later prompt
order comparison, Run-condition association, and research indexing.

Prompt Provenance is a derived annotation artifact. It does not establish:

- phrase effects or causal influence;
- success or failure;
- a Research Claim or Working Conclusion;
- a Concept Graph mapping or update;
- a Resolver recommendation; or
- an Experiment Control value.

Observation, Research Interpretation, Research Claims, Concept Graph knowledge,
and Resolver behavior remain separate responsibility layers.

## Scope

PR81 provides:

- this cumulative Freeze specification;
- a closed Draft 2020-12 JSON Schema;
- structural schema tests;
- a semantic-validation rule and error catalog; and
- documentation references.

PR81 does not provide a prompt parser, semantic validator, hash helper,
artifact generator, external reference data, versioned artifact storage, or
Prompt Provenance files for existing Runs.

## Artifact location and compatibility

Prompt Provenance is an optional Run-root artifact:

```text
experiments/<domain>/<run-id>/prompt-provenance.yaml
```

It is not stored under `source/`, and it is not a required manifest field. Raw
prompts remain in the existing manifest and PNG generation metadata. Absence of
`prompt-provenance.yaml` means that provenance has not been created; it is valid
for all existing Runs.

No existing Run, Observation Schema, Research Claim contract, Concept Graph,
Resolver, or manifest field is migrated or changed by this contract.

## Root contract

Every artifact requires:

- `schema_version`: exactly `0.1.0`;
- `run_id`;
- `status`;
- `content_identity`; and
- `provenance_generation`.

An `available` artifact requires `prompts` and forbids
`unavailable_reason`. An `unavailable` artifact requires
`unavailable_reason` and forbids `prompts`.

```yaml
schema_version: "0.1.0"
run_id: BRG-013-A
status: available
content_identity:
  contract: prompt_provenance_content_v1
  # Structural-format example only; this is not a computed Projection hash.
  sha256: "0000000000000000000000000000000000000000000000000000000000000000"
provenance_generation:
  created_at: "2026-07-17T12:00:00Z"
  generator:
    kind: manual
prompts:
  - prompt_channel: positive
    prompt_stage: embedded_generation_metadata
    effective_input_status: unconfirmed
    source:
      source_artifact: manifest.yaml
      source_pointer: /ingested_metadata/generation/positive_prompt
      source_kind: embedded_png_metadata
      # Structural-format example only; this is not a computed source hash.
      source_prompt_hash: "0000000000000000000000000000000000000000000000000000000000000000"
      hash_contract_version: prompt_text_sha256_v1
    span_offset_unit: unicode_code_point
    extraction_coverage:
      status: complete
    phrases: []
```

All artifact and nested objects are closed contracts. Unknown fields are
rejected.

## Status contract

`status` is one of:

- `available`: at least one prompt source was bound and structurally annotated;
- `unavailable`: generation was attempted, but the source was missing,
  unresolvable, not a string, or could not be hash-verified.

`unavailable_reason` is one of:

- `source_missing`;
- `source_unresolvable`;
- `source_not_string`;
- `hash_verification_unavailable`; or
- `other`.

An absent artifact and an `unavailable` artifact are not equivalent. `stale` is
not a persisted status. A later semantic validator reports stale source binding
as `PROMPT_PROVENANCE_STALE`.

## Run binding

Semantic validation must require exact equality among:

- the Canonical Run directory name;
- `manifest.yaml` `run_id`; and
- Prompt Provenance `run_id`.

Mismatch is `PROMPT_PROVENANCE_RUN_MISMATCH`. An artifact must not be copied to
another Run and treated as valid provenance.

## Prompt entries and channel ordering

One artifact contains one or both prompt channels. `prompt_channel` is
`positive` or `negative`; a channel may appear at most once.

Canonical Prompt Entry order is:

1. `positive`;
2. `negative`.

An empty, successfully resolved prompt string is distinct from a missing
source. It is represented by an empty `phrases` array and complete extraction
coverage.

Each Prompt Entry requires:

- `prompt_channel`;
- `prompt_stage`;
- `effective_input_status`;
- `source`;
- `span_offset_unit`;
- `extraction_coverage`; and
- `phrases`.

## Prompt stage and effective-input status

`prompt_stage` records the lifecycle location from which the string was
obtained:

- `authored`;
- `submitted`;
- `embedded_generation_metadata`; or
- `manual_reconstruction`.

`effective_input_status` separately records whether that string is known to be
the actual model input:

- `confirmed`;
- `unconfirmed`; or
- `unknown`.

Source location must not be used to infer effective-input certainty. For
example, embedded metadata may be recorded with `unconfirmed`.

## Raw prompt source binding

Each Prompt Entry binds to one selected raw string using:

- `source_artifact`: Canonical Run-directory-relative path;
- `source_pointer`: RFC 6901 JSON Pointer evaluated against the parsed source;
- `source_kind`;
- `source_prompt_hash`; and
- `hash_contract_version`.

`source_kind` is one of:

- `embedded_png_metadata`;
- `manifest_prompt`;
- `sidecar`; or
- `manual_reconstruction`.

`source_artifact` identifies the immediate artifact used for binding.
`source_kind` records the prompt string's origin. A manifest field populated
from PNG metadata may therefore use `source_artifact: manifest.yaml` with
`source_kind: embedded_png_metadata`.

YAML sources are parsed with a safe duplicate-key-rejecting loader. JSON
Pointer is evaluated against the parsed object. Source resolution rejects
absolute paths, Windows drive paths, drive-relative paths, UNC paths, `..`, Run
root escape, and symlink escape.

### Source priority

When multiple sources are available, selection order is:

1. channel-specific prompt extracted from embedded PNG metadata;
2. an explicit sidecar;
3. `manifest.prompt.positive` or `manifest.prompt.negative`;
4. manual reconstruction.

Conflicting sources are not merged. One source is selected for binding and the
difference is a diagnostic candidate. A composite parameters block containing
positive prompt, negative prompt, and generation settings is not directly used
as the phrase source when a channel-specific value is available.

## `prompt_text_sha256_v1`

The source prompt binding hash contract is:

- input: the Unicode string returned by source-pointer resolution;
- normalization: none;
- encoding: UTF-8;
- algorithm: SHA-256;
- output: lowercase 64-character hexadecimal.

Whitespace, line endings, and Unicode representation are preserved. Text-file
newline normalization and JCS are not used. A changed source string produces a
stale Prompt Provenance binding.

PR81 defines this contract but does not implement its computation or
verification helper.

## Phrase boundary contract

Simple comma splitting is not a Canonical phrase-boundary algorithm. Boundary
analysis must account for parentheses, prompt weights, quoted text, line
breaks, repeated phrases, and prompt directives.

PR81 does not implement a parser. Every extracted phrase retains its exact raw
source slice. Syntax inside a semantic phrase, such as parentheses or a prompt
weight in `(body bridge:1.2)`, is not removed.

In v0.1.0 the following are not represented as ordinary phrases:

- `BREAK`;
- `AND`;
- LoRA directives; and
- embedding directives.

They are always recorded in `unparsed_spans`, and the Prompt Entry is
`partial`. Prompt Syntax Nodes are deferred to a later schema version.

## Phrase occurrence identity

`phrase_occurrence_id` identifies one occurrence within one artifact. Its
format is:

```text
phrase.<prompt-channel>.<three-digit-position>
```

Examples are `phrase.positive.001` and `phrase.negative.004`.

The ID is unique only within the artifact, includes the channel, corresponds to
`position`, is not a Concept ID, and is not stable across re-segmentation. An
identical phrase appearing twice receives two occurrence IDs. v0.1.0 does not
contain `concept_ref` and does not create Concepts from phrases.

## Position and spans

`position` is one-based, contiguous, unique within a channel, and equal to the
phrase's array position. Phrases are stored in ascending position and are never
sorted by another key.

Each Prompt Entry fixes:

```yaml
span_offset_unit: unicode_code_point
```

All `source_span` and `unparsed_span` offsets are zero-based, half-open
`[start, end)` Unicode code-point ranges. Phrase spans exclude comma delimiters
and outer whitespace. `phrase.text` equals the exact source string slice. Spans
must be within the source, non-empty, monotonically ordered, and non-overlapping.

## Extraction coverage

Complete coverage is represented as:

```yaml
extraction_coverage:
  status: complete
```

`unparsed_spans` is forbidden for complete coverage.

Partial coverage requires a non-empty `unparsed_spans` array:

```yaml
extraction_coverage:
  status: partial
  unparsed_spans:
    - start: 10
      end: 15
      reason: control_directive
```

Reasons are `unsupported_syntax`, `ambiguous_boundary`, `control_directive`,
`unresolved_embedding`, or `other`.

Complete means every semantic phrase required by this contract was extracted
and no unresolved prompt syntax remains. It does not mean every code point is
inside a span. Phrase delimiters, outer whitespace, and formatting line breaks
are outside coverage. Unparsed spans contain unresolved ranges only.

Canonical `unparsed_spans` order is ascending `start`, then `end`, then lexical
`reason`.

## Extraction and category-assignment provenance

`extraction_method` and `category_assignment_source` are separate objects. Each
uses one of:

- `manual`: `contract_version` is forbidden;
- `deterministic_rule`: SemVer `contract_version` is required;
- `parser`: SemVer `contract_version` is required.

`imported` is not supported for either object in v0.1.0 because its source
contract is not defined.

## Prompt annotation categories

Categories are Prompt Annotation labels, not Concept IDs or Visual Concept
Graph modules. They are assigned from prompt text and are never inferred from
generated images or Observations.

| Category | Definition and scope | Representative examples |
| --- | --- | --- |
| `character` | Generic subject or character-presence description not captured by a narrower identity label. | `1girl`, `solo` |
| `entity_identity` | Species, named identity, or intrinsic entity class. | `elf`, `mermaid` |
| `hair` | Hair color, length, style, or state. | `silver hair`, `bob cut` |
| `face` | Visible facial geometry, expression, gaze, eyes, or mouth. | `smile`, `looking up` |
| `body_feature` | Physical morphology or body feature that is not a pose relation. | `slender`, `muscular` |
| `clothing` | Garments and wearable appearance. | `white t-shirt`, `black shorts` |
| `pose` | Body state, orientation, or configuration. | `bridge pose`, `knees bent` |
| `support` | Contact, load, or support instruction. | `arm support`, `weight on hands` |
| `camera` | Prompt-side camera, view, framing, or composition instruction. | `side view`, `full body` |
| `background` | Immediate backdrop description. | `simple background`, `white backdrop` |
| `environment` | Broader scene or location. | `forest`, `hospital room` |
| `object` | Non-subject object or prop. | `stethoscope`, `sword` |
| `lighting` | Illumination direction, quality, or color. | `rim lighting`, `soft light` |
| `style` | Rendering, medium, genre, or aesthetic instruction. | `anime style`, `watercolor` |
| `effect` | Visual or generative effect not classified above. | `motion blur`, `sparkles` |
| `semantic_role` | Occupation, rank, narrative, situational, or activity role. | `doctor`, `queen`, `patient` |
| `unknown` | Explicitly unresolved annotation category. | an ambiguous surface phrase |

An unregistered category is a Schema error and is not silently converted to
`unknown`.

Each phrase has a `primary_category`, `category_confidence`, zero or more
`category_candidates`, and `category_assignment_source`. Confidence is `high`,
`medium`, `low`, or `unclear`. Candidate categories are unique and must not
repeat the primary category.

Canonical candidate order is confidence (`high`, `medium`, `low`, `unclear`),
then lexical category order. This ordering is for deterministic storage and is
not a causal or Concept mapping.

## Camera and generation controls

A camera phrase records prompt text only. It does not imply an Experiment
Control such as `camera.fixed: true`. PR81 stores no Experiment Control value.
A future control contract may refer from the Control to a phrase occurrence.

Prompt Provenance does not contain seed, seed mode, batch behavior, checkpoint,
sampler, scheduler, steps, CFG, or resolution. Those remain Generation or
Experiment Controls.

## Observation and influence boundary

The only initial non-causal relationship is:

```text
Phrase Occurrence -> included_in -> Run / Condition
Run / Condition -> has_observation -> Observed Metric
```

It does not assert that the phrase caused the Observation. Phrase effects,
causal influence, Working Conclusions, Claims, and Resolver recommendations
belong to later research layers.

## Provenance generation

`provenance_generation` records the generator of the current artifact and its
creation time. `created_at` is RFC 3339 date-time and is not an edit history.

Generator kinds are:

- `manual`: `version` is forbidden;
- `parser`: Generator Implementation Contract SemVer is required;
- `imported`: Importer Implementation Contract SemVer is required;
- `migration`: Migration Tool Contract SemVer is required.

The version does not describe the imported source artifact, its schema, or the
prompt source. Git history may show file changes, but it is not a Prompt
Provenance Revision Store.

## Content identity

Every artifact stores:

```yaml
content_identity:
  contract: prompt_provenance_content_v1
  sha256: <lowercase 64-character SHA-256>
```

`prompt_provenance_content_v1` projects:

- `schema_version`;
- `run_id`;
- `status`;
- `prompts` when available;
- `unavailable_reason` when unavailable;
- `provenance_generation.generator.kind`; and
- `provenance_generation.generator.version` when present.

It excludes:

- `content_identity` itself;
- `provenance_generation.created_at`;
- YAML formatting;
- comments; and
- byte-only representation differences.

The projection is serialized with RFC 8785 JCS, hashed with SHA-256, and encoded
as lowercase hexadecimal. Excluding `content_identity` prevents self-reference.

This hash identifies a Prompt Provenance Normative Snapshot and detects changes
to Normative Projection Content. It is not an artifact-bytes integrity hash and
does not guarantee byte equality or detect changes to excluded fields. It must
not be used for prompt semantic equality, phrase semantic equality, phrase
effects, or Research Claim decisions.

PR81 defines the projection and Schema shape only. It does not implement JCS,
hash computation, recomputation, or stored-hash verification. Structural test
hashes are format-only fixtures and are not computed projection values.

## Canonical array ordering

JCS preserves array order. Canonical storage therefore uses:

- `prompts`: positive, then negative;
- `phrases`: ascending position, without any alternate sort;
- `unparsed_spans`: ascending start, end, then lexical reason;
- `category_candidates`: confidence order, then lexical category.

The semantic validator must reject non-canonical ordering; it must not silently
rewrite arrays before hashing.

## Lifecycle and external references

`prompt-provenance.yaml` is a regenerable derived artifact. Re-segmentation may
change phrase boundaries, positions, occurrence IDs, categories, and content
identity. An occurrence ID alone never identifies a historical occurrence.

The future external-reference tuple is:

- `run_id`;
- `content_identity.contract`;
- `content_identity.sha256`; and
- `phrase_occurrence_id`.

PR81 defines this tuple so a future semantic validator can compare it with the
current Canonical artifact. PR81 does not generate, persist, or resolve an
external reference. Until Versioned Artifact Storage or a Revision Contract
exists, no persistent external reference requiring an old Snapshot is created.

A current-artifact hash mismatch is
`PROMPT_PROVENANCE_REFERENCE_STALE`. This error does not recover the old
Snapshot. Historical resolution, automatic reference migration, and versioned
storage are explicitly deferred.

## Validation boundary

### Structural validation implemented in PR81

The JSON Schema validates:

- required fields and status branches;
- types, enums, patterns, and closed objects;
- hash and ID lexical form;
- nested object shape;
- prompt channel entry shape;
- complete versus partial extraction structure;
- conditional generator and annotation-method versions; and
- empty phrase arrays.

### Semantic validation designed but not implemented

A future validator checks:

- Run-directory, manifest, and artifact Run ID equality;
- safe source path containment and symlink containment;
- duplicate-key-safe source parsing and JSON Pointer resolution;
- prompt source string type and `prompt_text_sha256_v1` binding;
- Prompt Channel uniqueness and Canonical order;
- position continuity, occurrence ID correspondence, and phrase array order;
- span bounds, text/source-slice equality, overlap, and ordering;
- extraction coverage and Prompt Syntax partial status;
- category uniqueness, primary-category exclusion, and candidate order;
- `prompt_provenance_content_v1` calculation and stored-hash equality; and
- current external reference tuple equality.

PR81 implements no semantic error emission, CLI integration, or validator
helper.

## Semantic error catalog

All entries below are reserved semantic-validation contracts. PR81 defines but
does not emit them. Unless stated otherwise, severity is `error`, the artifact
is unusable for provenance analysis until corrected, and retry follows source
or annotation correction.

| Code | Condition | Correction |
| --- | --- | --- |
| `PROMPT_PROVENANCE_RUN_MISMATCH` | Directory, manifest, and artifact Run IDs differ. | Bind the artifact to the correct Run. |
| `PROMPT_SOURCE_ARTIFACT_INVALID` | The source path is absolute, traversing, or escapes the Run root. | Use a safe Run-relative source path. |
| `PROMPT_SOURCE_NOT_FOUND` | The selected source artifact does not exist. | Restore or select an existing source. |
| `PROMPT_SOURCE_POINTER_INVALID` | The pointer is not valid RFC 6901 syntax. | Correct the pointer syntax. |
| `PROMPT_SOURCE_POINTER_UNRESOLVED` | The pointer does not resolve in the parsed source. | Correct the source or pointer. |
| `PROMPT_SOURCE_NOT_STRING` | The resolved value is not a string. | Point to a channel-specific string. |
| `PROMPT_HASH_CONTRACT_UNSUPPORTED` | The declared prompt hash contract is unsupported. | Use `prompt_text_sha256_v1`. |
| `PROMPT_PROVENANCE_STALE` | The current source prompt hash differs from the binding hash. | Regenerate provenance from the current source. |
| `PROMPT_CHANNEL_DUPLICATE` | A prompt channel appears more than once. | Retain one selected source per channel. |
| `PHRASE_OCCURRENCE_ID_DUPLICATE` | An occurrence ID repeats. | Regenerate local occurrence IDs. |
| `PHRASE_POSITION_INVALID` | Position is non-contiguous or disagrees with array order or ID. | Restore one-based channel order. |
| `PHRASE_SPAN_INVALID` | A span is empty, reversed, outside the source, or non-monotonic. | Correct the source range. |
| `PHRASE_SPAN_OVERLAP` | Phrase spans overlap. | Correct phrase boundaries. |
| `PHRASE_SPAN_UNPARSED_OVERLAP` | Parsed and unparsed spans, or unparsed spans, overlap. | Correct coverage ranges. |
| `PHRASE_TEXT_MISMATCH` | Phrase text differs from its source slice. | Preserve the exact source slice. |
| `EXTRACTION_COVERAGE_INVALID` | Complete/partial status disagrees with unresolved ranges. | Correct coverage status or spans. |
| `CATEGORY_CANDIDATE_DUPLICATE` | Candidate categories repeat. | Deduplicate candidates. |
| `PRIMARY_CATEGORY_DUPLICATED` | Primary category also appears as a candidate. | Remove the primary category from candidates. |
| `PROMPT_ARRAY_ORDER_INVALID` | Prompt entries are not positive then negative. | Restore Canonical order. |
| `PHRASE_ARRAY_ORDER_INVALID` | Phrases are not in position order. | Restore Prompt order. |
| `UNPARSED_SPAN_ORDER_INVALID` | Unparsed ranges are not Canonically ordered. | Sort by start, end, and reason. |
| `CATEGORY_CANDIDATE_ORDER_INVALID` | Candidates are not in Canonical confidence/category order. | Restore Canonical candidate order. |
| `PROMPT_SYNTAX_REQUIRES_PARTIAL_COVERAGE` | Deferred syntax is present in a complete entry. | Record the syntax range and mark partial. |
| `PROMPT_PROVENANCE_CONTENT_HASH_MISMATCH` | Stored and recomputed Normative Projection hashes differ. | Rebuild the current Snapshot identity. |
| `PROMPT_PROVENANCE_REFERENCE_STALE` | A future tuple hash differs from the current Canonical artifact. | Do not auto-migrate; review the current Snapshot. |

## Structural test contract

PR81 structural tests cover:

- Schema meta-validation;
- valid available positive/negative structures;
- valid unavailable structure;
- status branch rejection;
- root and nested unknown-field rejection;
- content identity contract and lexical SHA-256 format;
- generator kind/version conditionals;
- extraction/category assignment method conditionals;
- hash, ID, category, source pointer, and source path lexical forms;
- complete/partial extraction object shape; and
- empty phrase arrays.

The tests do not claim that format-only fixture hashes are correct Projection
hashes. Semantic validation cases above are test designs only.

## Deferred work

The following require later contracts or PRs:

- semantic validator and error emission;
- `prompt_text_sha256_v1` and `prompt_provenance_content_v1` helpers;
- Prompt Provenance artifact generator;
- parser and Prompt Syntax Nodes;
- artifact revision/versioned storage;
- persistent external references;
- Concept mapping and Influence Graph integration;
- Experiment Control binding; and
- schema-derived runtime type generation.
