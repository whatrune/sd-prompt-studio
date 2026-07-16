# Observation-to-Claim Draft Pipeline Operations

This guide describes the implemented command-line workflow for the frozen
Observation-to-Claim Draft Pipeline contract. The normative contract remains
[`specifications/pipelines/observation-to-claim-draft-pipeline-freeze.md`](specifications/pipelines/observation-to-claim-draft-pipeline-freeze.md).

## Responsibility boundary

The Generator performs mechanical validation and extraction only. It validates
stored Observation and Aggregate data, stages Evidence candidates, and writes
immutable Draft, Report, and Receipt artifacts. It does not choose a subject,
write a research claim, infer causality, approve a Claim, promote knowledge, or
change the Concept Graph.

Only a Human Resolution may select the Assertion ID, claim family, subject,
claim statement, Evidence Bindings, scope, generalization status,
interpretation candidates, causal hypotheses, dependencies, and superseded
Assertions.

## Artifact locations

By default, successful Drafts are stored under:

```text
inbox/claim-drafts/<draft_id>/
  pre-schema-draft.yaml
  generation-report.json
  human-resolution.yaml       # supplied by a human; never generated
  generation-receipts/*.json
  claim-candidates/
    <candidate_id>/
      claim-candidate.yaml
      generation-receipts/*.json
```

Failed generation attempts are recorded under
`inbox/claim-draft-failures/<attempt_id>/`. These attempt artifacts never
invent a `draft_id`.

## Generate a Draft

From `research/sd-prompt-research`:

```powershell
python scripts/observation_to_claim.py generate `
  --observation experiments/bridge/BRG-009-A/observation.json
```

An optional observation module may be supplied independently:

```powershell
python scripts/observation_to_claim.py generate `
  --observation experiments/bridge/BRG-008-A/observation.json `
  --optional-observation face=experiments/bridge/BRG-008-A/face-observation.json
```

The current implementation accepts the required `pose` module and the optional
`face` module. The Module Registry reserves the frozen initial slugs for future
modules, but unsupported Observation validators fail explicitly rather than
guessing a structure.

## Record Registry compatibility

```powershell
python scripts/observation_to_claim.py registry-check `
  --draft-dir inbox/claim-drafts/<draft_id>
```

This appends a `registry_compatibility_check` Receipt. It does not modify or
retroactively invalidate the Draft. Module compatibility is evaluated from the
saved compatibility projections. Metric and Evidence-ID projections are
checked independently.

## Generate a Candidate Wrapper

After a human creates and signs off `human-resolution.yaml`:

```powershell
python scripts/observation_to_claim.py candidate `
  --draft-dir inbox/claim-drafts/<draft_id>
```

The command validates the Human Resolution, produces a closed Candidate
Wrapper, validates its nested canonical Assertion separately, and performs
Canonical Knowledge integration validation. Wrapper metadata never enters the
canonical Assertion. The command returns `candidate_id`, `candidate_dir`, and
`candidate_path`. Candidate directories are immutable: changing the Human
Resolution or Generator version creates a different Candidate ID and never
overwrites an earlier Candidate.

## Finalize

Finalize is create-only and requires an explicit human action:

```powershell
python scripts/observation_to_claim.py finalize `
  --draft-dir inbox/claim-drafts/<draft_id> `
  --candidate-id candidate.<projection_hash> `
  --explicit-finalize
```

`--candidate-path <.../claim-candidate.yaml>` may be used instead of
`--candidate-id`. Exactly one selector is required; Finalize never infers a
latest Candidate from the Draft directory.

Finalize holds the canonical lock, checks the canonical snapshot, validates the
exact staged Assertion, installs one new Assertion file without overwriting,
and runs postcondition validation. A postcondition failure removes only the
file created by that attempt and records both Finalize and Rollback Receipts.
Before installation, Finalize revalidates the Wrapper and nested Assertion,
the Draft and Human Resolution bindings, the Candidate ID projection, Registry
compatibility, and the successful Candidate Generation Receipt. The Receipt
binds three distinct hashes: the normalized Candidate Wrapper bytes, the fixed
Canonical Assertion YAML bytes, and the existing JCS-based
`assertion_content_v1` semantic hash. The exact validated Canonical YAML bytes
are installed without reserialization.

Candidate selection, Wrapper validation, Candidate Generation Receipt binding,
and identity recomputation are audited preflight steps. Failure before the
canonical transaction still writes a failed `finalize_attempt` Receipt with
`failed_step`, `error_code`, and diagnostics; an untrusted Candidate uses a
`not_available` identity and `destination_path: not_available` rather than
invented hashes or paths. Rollback Receipts repeat
the same Wrapper Artifact, Canonical YAML Artifact, and
`assertion_content_v1` semantic Hash bindings as the related Finalize attempt.

## Validation

```powershell
python -m unittest discover -s tests -v
python scripts/build_concept_graph.py --check
python scripts/validate_research_claims.py --format json
```

The Module Registry lives at
`knowledge/registries/observation-modules.yaml` and is validated independently
from Research Claim YAML. Generated Draft artifacts are not Canonical Knowledge
until the explicit Finalize transaction succeeds.
