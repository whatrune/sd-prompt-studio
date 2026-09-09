# CAM-041 Prompt-Blind Research Review

## Final Experiment Classification

**NO_DIRECTIONAL_STRONG_VIEWPOINT_ADVANTAGE_ESTABLISHED**

All 48 panels are provenance-valid and vertical-viewpoint-assessable. Strong downward-viewpoint realization was observed in 24/24 `from above` panels and 24/24 `high angle` panels. Across matched seeds, from-above gains=0, high-angle gains=0, and ties=24. With no discordant pairs, the predeclared one-sided exact sign p-value is 1.0. Both phrases realized the strong endpoint reliably in this prompt family, but the stronger production phrase did not produce a reliably different realized viewpoint from its neighboring phrase.

## Blinding and Provenance

- Panels: 48/48; missing or corrupt: 0.
- Exact checkpoint SHA-256, Euler a, Automatic, 20 steps, CFG 4.5, 1024x1024, and frozen settings: PASS.
- Ordered seeds, common prompt bytes, negative prompt, and settings are equal across both runs; only the declared terminal viewpoint phrase differs.
- `response.parameters`, parsed `response.info`, structural infotext, and PNG bindings: PASS 48/48.
- Observer input exposed only opaque condition IDs, opaque panel IDs, image hashes, and pixels.
- Canonical observer-input SHA-256: `959813ab8fe5afd1a4f9ef9abfb2c828bd31d3b9138b55771020bc3bc630224d`.
- Frozen visual-observation SHA-256: `2487795d600bbe52adc3f95129e425b846457f9bd317a061002ac46e89c36de8`.
- Sealed condition-mapping SHA-256: `fe7976c889b941c735d9256eaa95f86a2deafb9de7e34d3b010ceb029268b172`.
- Canonical tracked blind-record owner: `research/sd-prompt-research/experiments/camera/CAM-041-A/source/CAM-041-A_metadata.yaml`.
- Mapping was decoded only after the 48-row visual record was frozen; no frozen observation changed after decode.

## Per-Arm Metrics

| Run | Exact PromptTag / phrase | Strong downward viewpoint | Assessable | Full body visible | Ambiguity/artifact |
| --- | --- | ---: | ---: | ---: | ---: |
| CAM-041-A | `cam-from-above` / `from above` | 24/24 | 24/24 | 20/24 | 0/24 |
| CAM-041-B | `cam-v5-high-angle` / `high angle` | 24/24 | 24/24 | 20/24 | 0/24 |

## Matched-Seed Analysis

| Endpoint | From-above gains | High-angle gains | Ties | One-sided exact p |
| --- | ---: | ---: | ---: | ---: |
| Strong downward-viewpoint realization | 0 | 0 | 24 | 1.0 |

The predeclared prerequisites all pass: exact runtime/provenance PASS, assessability 24/24 and 24/24, full-body visibility 20/24 and 20/24, and ambiguity/artifact 0/24 and 0/24. Neither directional rule passes because there are no discordant pairs. This establishes no directional advantage; it does not establish semantic or general-runtime equivalence between the PromptTags.

## Rubric Distributions

Both arms: vertical camera relation `above_subject`=24/24; downward-perspective strength `strong`=24/24; viewpoint assessable=24/24; floor `dominant`=20/24 and `substantial`=4/24; subject foreshortening `moderate`=24/24; full body visible=20/24 and partial=4/24; ambiguity/artifact=0/24.

## Evidence Boundary

This result is limited to the exact checkpoint, prompt family, endpoint, generation settings, and tested production phrases. It does not establish interchangeability, behavior on another model or prompt family, or that the phrases have identical secondary composition effects.

## Research Boundary

CAM-041 changes no PromptTag, Concept Graph, compiler/advisory/UI/runtime, schema, workflow, platform, dependency, or production behavior.
