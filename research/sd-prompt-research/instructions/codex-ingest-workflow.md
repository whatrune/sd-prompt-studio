# Codex Ingest Workflow

## Purpose

Convert images placed in inbox into research Runs.

## Input

User places generated images into:

inbox/

Image filenames are not important.

Examples:

- image.png
- image (1).png
- image (2).png


## Tasks

When requested to ingest images:

1. Run ingest_inbox.py.

Example:

python scripts/ingest_inbox.py --domain bridge --layout 3x2


2. Confirm created Run IDs.

- A single image uses the next numeric Run ID, for example `BRG-008`.
- Multiple images in one inbox batch share the next numeric Run ID and use condition suffixes, for example `BRG-008-A`, `BRG-008-B`, and `BRG-008-C`.
- The suffix and condition label must correspond: `-A` is `Condition A`, `-B` is `Condition B`, and so on.

3. Verify generated files:

experiments/{domain}/{run-id}/

Expected:

source/
- source image
- metadata
- rubric.yaml

panels/
preview/
manifest.yaml

4. Report the saved Run folder path in the completion response.

- Show the full folder path for each created Run.
- When multiple Runs are created, list every Run ID with its corresponding folder path.


## Rules

- Do not modify original images.
- Do not analyze image content.
- Do not assign research conclusions.
- Only perform file organization.

## Registering an observed Run for Research Explorer

Image ingestion alone creates an `INGESTED` Run and an Observation template. Do
not register that placeholder as an observed Artifact. After the existing Image
Analyst/finalization workflow has produced a schema-valid `observation.json`, a
matching `computed_aggregate`, and `manifest.status: OBSERVED`, run:

```powershell
python scripts/register_research_run.py `
  --run-dir experiments/bridge/BRG-010-A `
  --index-output tmp/research-explorer-index.json
```

This command mechanically validates the Run bundle, updates
`ledgers/run-index.yaml`, regenerates the Derived Index, and confirms the
`observation_of` relationship. It does not generate Claims or research
interpretation. Restart the Local Companion Service to load the new in-memory
Index; PR75 intentionally provides no mutation or refresh endpoint.
