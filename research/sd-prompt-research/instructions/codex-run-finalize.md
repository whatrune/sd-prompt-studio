# Codex Run Finalization Workflow

## Purpose

Finalize Stable Diffusion research experiment runs.

Codex is responsible for:
- File organization
- JSON validation
- Metadata management
- Run status management

Codex is NOT responsible for:
- Visual interpretation
- Pose evaluation
- Concept classification
- Research conclusions

This workflow assumes that `observation.json` already exists. When Codex must inspect images and create `observation.json`, use `instructions/codex-image-analysis-workflow.md` first, then return to this workflow for validation and finalization.


## Input

Target Run:

experiments/{domain}/{run-id}/


Expected files:

source/
- image file
- metadata file
- rubric.yaml

observation.json


## Tasks

1. Verify Run structure.

For grouped condition Runs, preserve the full suffixed Run ID and require the folder name and metadata `run_id` to match, for example:

- `BRG-008-A` / `Condition A`
- `BRG-008-B` / `Condition B`
- `BRG-008-C` / `Condition C`

2. Validate observation.json.

Check:

- schema_version
- panel count
- panel IDs
- axis value format
- morphology values
- artifact values
- contact_load format
- cross_domain_effects format


3. Create or update manifest.yaml.

Required:

- run_id
- domain
- condition
- status
- source files
- observation file


4. Generate computed aggregates.

Generate:

- axis counts
- morphology counts
- artifact counts
- leakage counts
- cross-domain effect counts


5. Create research-review.md template.

Template:

# Research Review

## Observed

## Interpretation

## Working Conclusion

## Concept Dictionary Impact

## Resolver Impact

## Next Experiment


## Restrictions

Do not:

- Judge Prompt success
- Modify Concept Dictionary
- Create research conclusions
- Design next experiments
