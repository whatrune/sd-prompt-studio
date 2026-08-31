# Research Run Ingestion Foundation

## Purpose

This workflow connects an existing, formally observed Research Run to the
Research Explorer read model:

```text
generated image
  -> existing image ingestion
  -> Observation JSON
  -> existing Observation finalization
  -> PRE_LEDGER validation and task-local Research Review
  -> final Run Ledger reconciliation at publication
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

Ordinary ingestion and PRE_LEDGER validation do not update
`ledgers/run-index.yaml`. Multiple finalized Runs may therefore be generated,
observed, validated, and reviewed independently in parallel.

At final publication only, first acquire the fresh main branch and exact current
Run Ledger bytes. Compute their SHA-256 and atomically reconcile every Run owned
by the publication:

```powershell
.venv\Scripts\python.exe scripts\register_research_run.py `
  --run-dir experiments\bridge\BRG-010-A `
  --run-dir experiments\bridge\BRG-010-B `
  --finalize-ledger `
  --expected-ledger-sha256 <fresh-lowercase-sha256> `
  --index-output tmp\research-explorer-index.json
```

The finalizer:

1. validates every supplied Run bundle before reading or writing the Ledger;
2. strictly validates the fresh Ledger and its expected SHA-256;
3. reconciles the supplied Run summaries in lexical Run-ID order in memory;
4. preserves every unrelated entry and its existing order;
5. replaces `run-index.yaml` once, only when the exact bytes change;
6. validates every resulting registration and Research Explorer relationship;
7. restores the exact prior Ledger bytes if post-write validation fails;
8. returns the Artifact IDs and `index_snapshot_id` as JSON.

After final reconciliation, validate the exact registrations without writing:

```powershell
.venv\Scripts\python.exe scripts\register_research_run.py `
  --run-dir experiments\bridge\BRG-010-A `
  --run-dir experiments\bridge\BRG-010-B `
  --check `
  --require-registered
```

The publication sequence is serialized only across the fresh main/Run Ledger
acquisition, atomic reconciliation, POST_LEDGER validation, exact final PR HEAD,
Fresh Review, and Merge. Generation, ingestion, observation, PRE_LEDGER
validation, focused validation, authoring, and task-local Research Review stay
parallel. There is no second ledger, queue, reservation, daemon, or new
authority type.

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
