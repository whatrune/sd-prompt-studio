# Research Claim Staging Layer v3.9.31 Freeze

## Purpose and boundary

The Research Claim Staging Layer stores reviewable research assertions between raw observations and the Visual Concept Graph. It does not replace `concepts/*.json`, and a Claim YAML entry is not a Graph Concept.

```text
Run observation evidence
        ↓ reference
Research Claim Staging Layer
        ↓ explicit review and promotion approval
Application Receipt
        ↓
Visual Concept Graph source
```

The responsibility layers remain separate:

- Observation: directly recorded metrics from an Observation module.
- Interpretation candidate: a possible explanation of those metrics.
- Causal hypothesis: an unverified causal relation candidate.
- Promotion: an independently reviewed action against the Concept Graph.

No Claim status automatically edits the Concept Graph.

## Storage

```text
knowledge/
├─ assertions/
│  └─ phrase-behaviors.yaml
└─ reviews/
   ├─ claim-review.yaml
   └─ promotion-approval.yaml
```

- `knowledge/assertions/*.yaml`: mutable Assertion and Evidence Fact sources.
- `knowledge/reviews/claim-review.yaml`: append-only Review and Review Withdrawal records.
- `knowledge/reviews/promotion-approval.yaml`: append-only Promotion Approval and Approval Withdrawal records.
- `promotion.applications`: append-only Application Receipts embedded with the owning Assertion.

Append-only comparison is Record-ID based. Moving an unchanged record between files is allowed. Editing or deleting an existing Review, Withdrawal, Approval, or Application is an error.

## Subject references

An existing Graph Concept uses `concept_ref`:

```yaml
subject:
  kind: concept_ref
  concept_id: support.arm.rearward
  source_phrase: arm support
```

An unregistered phrase remains a surface phrase and must not invent a Graph ID:

```yaml
subject:
  kind: phrase_surface
  phrase: head tilted back
  locale: en
  normalized_phrase: head tilted back
```

Modules and axes are not Concept IDs. Use `target_module` and `target_axis`; `target_concept_id` is reserved for an existing Graph object.

## Evidence model

Evidence Fact stores immutable measurements. Evidence Binding stores how an Assertion uses a fact. The same Evidence Fact may support one Assertion and contradict another.

Local Evidence paths are repository-root relative and use `/`. Metric paths use object-only dotted paths. Array indexes and JSON Pointer are not accepted as metric paths. The Validator resolves `metric`, `denominator_path`, `count`, and `total` against the referenced Observation JSON.

Reproduction counts distinguish panels, conditions, runs, independent experiment groups, models, and contexts. BRG-007-A/B/C are one independent experiment group rather than three independent experiments.

## Hash scopes

All semantic and audit hashes use RFC 8785 JCS, UTF-8, SHA-256, and lowercase hexadecimal.

### `assertion_content_v1`

Includes:

- subject
- claim
- evidence bindings
- resolved Evidence Fact content, excluding storage location
- reproduction
- scope
- generalization status
- dependencies

Excludes IDs, workflow status, Promotion state, supersession, notes, creator metadata, registry file hashes, and Review data.

### `promotion_content_v1`

Create actions hash exactly:

```json
{"action":"create_concept","proposed_id":"concept.example","assertion_hash":"..."}
```

Attach actions hash exactly:

```json
{"action":"attach_evidence","target_id":"concept.example","assertion_hash":"..."}
```

The inapplicable `target_id` or `proposed_id` is absent, never `null`.

### `graph_content_v1`

Create applications hash the created Graph object. Attach applications hash only the fragment resolved by the Content Locator.

### `audit_record_v1`

Append-only enforcement hashes every stored field of each audit record, including notes and timestamps.

## Fixed JCS vectors

Vector A:

```text
Input:     {"b":1,"a":"é"}
Canonical: {"a":"é","b":1}
SHA-256:   aa58fba8483623bed37c1b02edfccbdd9a53123837c20bfa4cb4049993a2872e
```

Vector B:

```text
Input:     {"evidence_ref_id":"evidence.example.metric.001","count":5,"total":6}
Canonical: {"count":5,"evidence_ref_id":"evidence.example.metric.001","total":6}
SHA-256:   ed157d50d4cb6a422a84930c1fc4714f8db1fd0dabf1f62fa5046a2be76c1089
```

## Review and Approval time evaluation

`effective_status` is derived and never stored. Possible derived states are `active`, `superseded`, `withdrawn`, and `historical_hash`; all matching reasons are retained.

Review validity is evaluated at the Approval decision time using the Approval hash:

```text
review_effective_status_at(
  review_id,
  approval.approved_at,
  approval.approved_assertion_hash
)
```

Approval validity is evaluated at Application time:

```text
approval_effective_status_at(
  approval_id,
  application.applied_at,
  application.applied_assertion_hash,
  application.applied_promotion_hash
)
```

A later Review Withdrawal does not implicitly invalidate an existing Approval. Invalidating an Approval requires an explicit Approval Withdrawal.

Withdrawal `withdrawn_at` equals `recorded_at`. New audit records may not predate the maximum `recorded_at` for the same Assertion in the immutable baseline.

## Promotion and Application

Promotion actions are:

- Attach: `add_alias`, `attach_model_behavior`, `attach_evidence`
- Create: `create_relation`, `create_concept`, `create_target_pattern`
- Non-promotion: `retain_unmodeled`, `no_promotion`

Application Receipt Hash chains are:

```text
plan.assertion_hash
== application.applied_assertion_hash
== approval.approved_assertion_hash

hash(plan)
== application.applied_promotion_hash
== approval.approved_promotion_hash

set(application.claim_review_ids)
== set(approval.claim_review_ids)
```

Create IDs satisfy:

```text
created_id == proposed_id == created Graph object ID
```

Attach IDs satisfy:

```text
applied_target_id == plan.target_id == content_locator.target_id
```

Content Locator fields are:

- `collection`: top-level Graph collection used to locate the owning object.
- `target_id`: stable owning-object ID.
- `field_path`: RFC 6901 JSON Pointer relative to that object; array indexes are forbidden.
- `item_key`: alias text, `evidence_ref_id`, or Model Behavior JCS hash depending on action.

Attach actions in v0.1 are limited to Concept objects. A newly created object cannot also be an Attach target in the same baseline comparison because the intermediate Create state cannot be reconstructed.

One unsuperseded Application is allowed per Assertion. Superseded Applications remain immutable evidence that an application occurred.

## Application validation contexts

| Context | Evaluation | Graph content comparison |
|---|---|---|
| `current_state` | current or `--evaluated-at` | Baseline and Candidate Graph |
| `promotion_approve` | selected Approval | none |
| `application_create` | selected Application `applied_at` | new receipt against Candidate Graph |
| `application_recheck` | historical Application `applied_at` | never compare with current Graph |
| `write_finalize` | current state | validate, then atomically replace dist |

`application_recheck` validates the immutable Receipt, Promotion Plan hash, Assertion/Approval hash chains, Review set, IDs, formats, and time-scoped authorization. v0.1 does not reconstruct historical Graph content; that requires a stored snapshot, retrievable Source Tree, or historical Candidate Graph.

## Candidate Graph and versions

Concept Source is validated and built into an in-memory Candidate Graph before Application content is resolved. Existing dist is not the hash source. Check mode never writes dist; `write_finalize --write-dist` replaces it atomically only after every validation succeeds.

`graph_content_identity_v1` includes only:

- concepts
- relations
- target patterns
- unmodeled effects
- model profiles

It excludes schema version, graph version, generation time, source paths, indexes, and derived caches.

Baseline and Current Concept Sources are built with the same logic. Their identity projections are JCS-hashed. If content changes, Candidate `graph_version` must be greater under SemVer 2.0.0. If content is unchanged, the versions must be equal.

Application `applied_graph_version == Candidate Graph.graph_version` is checked only during `application_create`. Historical receipts retain their applied version and are not compared with the current Graph version.

## YAML and validation behavior

The loader is a PyYAML SafeLoader derivative that rejects duplicate keys, disables automatic timestamps, accepts only `true` and `false` as booleans, and uses JSON-compatible numbers. Arbitrary Python object construction is unavailable.

Warnings do not fail normal checks. `--strict` makes warnings fail. JSON output separates validation errors from infrastructure errors. Infrastructure failures use exit code 2 and `valid: null`; validation failures use exit code 1.

```powershell
.venv\Scripts\python.exe scripts\validate_research_claims.py --format json
```

Promotion Approval validation:

```powershell
.venv\Scripts\python.exe scripts\validate_research_claims.py `
  --validation-context promotion_approve `
  --assertion-id assertion.example.topic.001 `
  --approval-id promotion_approval.assertion.example.topic.001.001
```

Application creation validation:

```powershell
.venv\Scripts\python.exe scripts\validate_research_claims.py `
  --validation-context application_create `
  --assertion-id assertion.example.topic.001 `
  --application-id application.assertion.example.topic.001.001
```

Formal dist update:

```powershell
.venv\Scripts\python.exe scripts\validate_research_claims.py `
  --validation-context write_finalize `
  --write-dist
```

CI supplies an immutable PR Base SHA through `--baseline-ref` or `CLAIM_VALIDATION_BASELINE_SHA`. `origin/main` is only a local convenience default.

## Deliberately not implemented in v0.1

- automatic Claim promotion
- automatic Concept or Relation creation
- historical Graph snapshot storage and replay
- parallel Application lineages
- Relation or Target Pattern attach operations
- Resolver or Prompt Renderer integration
- Observation Schema changes
- migration of existing Run data
