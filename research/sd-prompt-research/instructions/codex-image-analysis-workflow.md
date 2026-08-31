# Codex Image Analysis Workflow

## Purpose

Create the canonical image-observation dataset for an existing research Run and then finalize the Run.

This workflow combines image observation and Run finalization while keeping research judgment out of scope.

## Input

Target Run:

`experiments/{domain}/{run-id}/`

Required files:

- `manifest.yaml`
- `source/rubric.yaml`
- Six panel images listed in `manifest.yaml`
- `templates/image-analyst-system-prompt.md`
- `templates/observation-schema.json`

## Tasks

1. Verify the Run structure and all required files.

2. Read `templates/image-analyst-system-prompt.md`, the Run rubric, manifest, and observation schema.

3. Inspect the six panel images in panel ID order.

4. Record only visible evidence using values allowed by the rubric.

- Use the exact `run_id` from `source/rubric.yaml`, including a suffix such as `BRG-008-A`.
- Use the exact `blind_condition_label` from `source/rubric.yaml`.
- Use `unclear`, `not_visible`, or `not_applicable` instead of guessing.
- Do not derive Contact, Contact Load, Hip Elevation, or Support Orientation from Body State, Morphology, or Prompt text.
- Confirm `hip_elevation` only from a visible pelvis-to-surface boundary or clearance gap.
- Confirm head or shoulder contact only from a visible body-part-to-surface boundary.
- Record Surface Contact and Contact Load independently; contact alone does not imply supporting load.
- Treat `support_orientation` as the direction and relationship of visible load support, not body-facing direction.
- Evidence Notes must name the directly visible boundary, gap, or load path used for confirmed values.

5. Write UTF-8 JSON directly to the canonical path:

`experiments/{domain}/{run-id}/observation.json`

Do not create a downloadable JSON file or a Run-prefixed duplicate when Codex is operating in the local repository.

6. Follow `instructions/codex-run-finalize.md` to validate the JSON, generate computed aggregates, update `manifest.yaml`, and finalize the Run.

7. Run PRE_LEDGER registration validation without changing
   `ledgers/run-index.yaml`:

   `python scripts/register_research_run.py --run-dir experiments/{domain}/{run-id} --check`

   A finalized Run need not be present in the Ledger at this stage. Generation,
   observation, PRE_LEDGER validation, focused validation, authoring, and
   task-local Research Review remain parallel. Do not reserve a Ledger entry or
   serialize this task-local work.

8. Regenerate `observation.md` from the finalized canonical JSON:

`python scripts/render_observation_md.py --run-dir experiments/{domain}/{run-id}`

9. Generate a research packet PDF with `scripts/build_research_packet.py`.

- For grouped condition Runs, pass the shared base ID and create one combined PDF, for example:

  `python scripts/build_research_packet.py --domain bridge --run-id BRG-007`

  This combines `BRG-007-A`, `BRG-007-B`, and `BRG-007-C` when those folders exist.

- For a single Run, pass its exact Run ID and create a one-Run PDF.
- Include `manifest.yaml`, `observation.json`, and `observation.md` for every Run.
- Save the packet as `reports/{base-run-id}_research-packet.pdf`.
- Use the compact packet layout by default:
  - cover, shared generation settings, and condition list
  - each Run's compressed `preview/{run-id}_preview.jpg`, positive prompt, and computed aggregate
  - grouped Runs only: cross-condition mechanical count table with no interpretation
  - one consolidated section with separate Uncertain, Visual Artifacts, Prompt / Concept Leakage, and Observed Morphologies columns
- Do not duplicate `observation.md`, raw ingested metadata, per-panel Markdown, empty fields, or repeated prompt metadata in the default packet.
- Omit the full `observation.json` from the default packet. Add `--include-json-appendix` only when a full audit appendix is explicitly needed.
- Render the generated PDF to images and inspect every page for clipped, overlapping, missing, or unreadable text.

10. Report the full saved Run folder path and research packet PDF path in the completion response.

## Final publication boundary

Immediately before publication, acquire fresh main and the exact current
`ledgers/run-index.yaml` bytes. Reconcile every Run owned by the publication in
one invocation with repeated `--run-dir`, `--finalize-ledger`, and the fresh
`--expected-ledger-sha256`. Then require POST_LEDGER validation with
`--check --require-registered`, produce the exact final PR HEAD, obtain Fresh
Review, and Merge.

Only fresh Ledger acquisition, reconciliation, POST_LEDGER validation, final
HEAD Review, and Merge are serialized. Do not introduce a queue, reservation,
daemon, second Ledger, or authority type, and do not regenerate valid Run-local
artifacts solely because another publication advanced the Ledger.

## Optional Face Module

The Face Module is opt-in and does not change Observation Schema v3.0.

Enable it only when the Run manifest declares `outputs.face_observation_json`. When a task explicitly requests face observation for an unconfigured Run, first add `outputs.face_observation_json: face-observation.json` to the manifest.

- Read `templates/face-observation-rubric.yaml` and `templates/face-observation-schema.json`.
- Inspect the existing panel images without using Prompt text as visual evidence.
- Write the separate canonical file `face-observation.json`; do not add face fields to `observation.json`.
- Record visible geometry and state only. Do not assign emotion meaning, Prompt causality, or a source Concept.
- Keep `cross_domain_effects` empty during image observation. Selecting which visible states are effects belongs to the Research Interpretation Layer.
- Validate and aggregate it with:

  `python scripts/finalize_face_observation.py --run-dir experiments/{domain}/{run-id}`

- Research Packet generation includes the optional Face Module only when the manifest declares `outputs.face_observation_json` and that file exists.

## Optional Hair V1 Module

The Hair V1 Module is opt-in and does not change pose Observation Schema v3.0
or the optional Face Module.

Enable it only when the Run manifest declares
`outputs.hair_observation_json: hair-observation.json`.

- Read `templates/hair-observation-rubric.yaml` and
  `templates/hair-observation-schema.json`.
- Inspect panel images without using Prompt text to identify or disambiguate
  hair.
- Write `hair-observation.json`; do not add Hair fields to `observation.json`
  or `face-observation.json`.
- Record exactly the four registered Hair V1 axes for every panel. Do not add
  hand-near-head, effect, interpretation, or source-Concept fields.
- Use `unclear`, `not_visible`, or an approved identity-ambiguity value rather
  than resolving uncertain pixels from Prompt text.
- Validate and aggregate it with:

  `python scripts/finalize_hair_observation.py --run-dir experiments/{domain}/{run-id}`

The finalizer requires panel IDs `1..6`, manifest/run identity, the exact closed
axis/value catalog, all aggregate cells including zeros, and exact aggregate
recomputation.

## Restrictions

Do not:

- Judge Prompt success or failure
- Infer Prompt differences during blind analysis
- Create research conclusions
- Modify the Concept Dictionary
- Perform final Concept classification
- Design next experiments
- Populate research-review interpretation or conclusion sections

Image observation and rubric-constrained ontology value selection are allowed. Research interpretation is not.

Prompt / Concept Leakage remains `not assessed` during image-only observation. An empty `leakage` array must not be rendered as `none observed`.

## Failure Handling

- If a required image, rubric, manifest, or schema is missing, stop and report the missing file.
- If the observation cannot be represented with allowed values, record uncertainty according to the image analyst prompt; do not invent ontology values.
- If validation fails, report the validation errors and do not mark the Run `OBSERVED`.
