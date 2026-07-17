# Research Run Ingestion Foundation

## Purpose

This workflow connects an existing, formally observed Research Run to the
Research Explorer read model:

```text
generated image
  -> existing image ingestion
  -> Observation JSON
  -> existing Observation finalization
  -> Run registration
  -> Derived Index regeneration
  -> Research Explorer display
```

It is a mechanical data-registration boundary. It does not create a Claim,
edit Evidence, perform Human Resolution, finalize a Candidate, classify a
Concept, or invoke the Prompt Compiler.

## Inputs

The Run must already be located at:

```text
experiments/<domain>/<run-id>/
```

Required Artifacts:

```text
manifest.yaml
observation.json
source/rubric.yaml
```

Registration requires:

- the directory, Manifest, Observation, and Rubric Run IDs to agree;
- `manifest.status: OBSERVED`;
- `manifest.outputs.observation_json` and `canonical_observation` to identify
  `observation.json`;
- Observation Schema v3.0 validation through the existing Schema;
- existing visible-evidence Rubric policy validation;
- stored `computed_aggregate` equality with the mechanically recomputed
  Aggregate.

No input Artifact is rewritten.

## Commands

Validate without writing the Ledger or an Index output:

```powershell
.venv\Scripts\python.exe scripts\register_research_run.py `
  --run-dir experiments\bridge\BRG-010-A `
  --check
```

Register the Run and optionally save a disposable Index for inspection:

```powershell
.venv\Scripts\python.exe scripts\register_research_run.py `
  --run-dir experiments\bridge\BRG-010-A `
  --index-output tmp\research-explorer-index.json
```

The command:

1. validates the existing Run bundle;
2. updates or adds exactly one Run entry in `ledgers/run-index.yaml`;
3. regenerates and validates the existing Research Explorer Derived Index;
4. confirms discovery of the Run and Observation Artifacts;
5. confirms the mechanical `observation_of` relationship;
6. returns the Artifact IDs and `index_snapshot_id` as JSON.

Registration is idempotent for the same Run ID. If Index regeneration or
relationship verification fails after the Ledger update, the previous Ledger
bytes are restored.

## Relationship

The Observation Artifact has the outgoing relationship:

```json
{
  "relation": "observation_of",
  "target_entity_id": "BRG-010-A",
  "target_artifact_id": "artifact.run.<path-hash>"
}
```

The Inspector derives the corresponding incoming relationship for the Run.
This binding uses the canonical directory and exact `run_id`; it does not infer
an Experiment or interpret any observed metric.

## Explorer visibility

The PR75 Companion Service keeps its Derived Index in memory and remains
read-only. After registering a Run, restart the Local Companion Service to load
the new snapshot. No mutation or refresh endpoint is added by this workflow.

The existing `/api/research/index` and opaque Artifact API then expose the new
Run and Observation under the same session, snapshot, containment, freshness,
and public-boundary rules as every other Research Artifact.

## Scope boundary

This foundation does not change:

- PR69 Freeze Contract;
- PR71 Pipeline Contract;
- PR73 Research Explorer Architecture;
- PR75 API Contract;
- PR77 UI Contract;
- Research Claim or Observation Schema;
- Canonical Claim data.
