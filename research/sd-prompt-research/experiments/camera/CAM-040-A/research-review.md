# CAM-040 Prompt-Blind Research Review

## Final Experiment Classification

**NO_DIRECTIONAL_STRICT_LATERAL_ADVANTAGE_ESTABLISHED**

All 48 panels are provenance-valid, orientation-assessable, and full-body visible. Strict whole-body lateral orientation was observed in 6/24 `side view` panels and 7/24 `profile view` panels. Across matched seeds, profile gains=3, side gains=2, ties=19, and the more favorable one-sided exact sign p-value is 0.5. Neither arm reaches the predeclared 18/24 minimum and neither directional rule passes.

## Blinding and Provenance

- Panels: 48/48; missing or corrupt: 0.
- Exact checkpoint SHA-256, Euler a, Automatic, 20 steps, CFG 4.5, 1024x1024, and frozen settings: PASS.
- Ordered seeds, common prompt bytes, negative prompt, and settings are equal across both runs; only the declared terminal viewpoint phrase differs.
- `response.parameters`, parsed `response.info`, structural sampler/scheduler identity, and PNG bindings: PASS 48/48.
- Observer input exposed only opaque condition IDs, opaque panel IDs, image hashes, and pixels.
- Canonical observer-input SHA-256: `c1cf07e1f8dd9f778a776506c2e4ed9d69390aaf8d3f5d3ccae6197194451971`.
- Frozen visual-observation SHA-256: `37413863a673587b074bce8fb97b8c8ae5c386cb394c024c54ea82cc1ecf04ec`.
- Sealed condition-mapping SHA-256: `1fdef0593583ff89112f90c360a2d7f8d0096879f3558dabe7770aa473a09db1`.
- Canonical tracked blind-record owner: `research/sd-prompt-research/experiments/camera/CAM-040-A/source/CAM-040-A_metadata.yaml`.
- Mapping was decoded only after the 48-row visual record was frozen; no frozen observation changed after decode.

## Per-Arm Metrics

| Run | Exact PromptTag / phrase | Strict whole-body lateral | Assessable | Full body visible | Ambiguity/artifact |
| --- | --- | ---: | ---: | ---: | ---: |
| CAM-040-A | `cam-side-view` / `side view` | 6/24 | 24/24 | 24/24 | 0/24 |
| CAM-040-B | `cam-v5-profile-view` / `profile view` | 7/24 | 24/24 | 24/24 | 0/24 |

## Matched-Seed Analysis

| Endpoint | Profile gains | Side gains | Ties | More favorable one-sided exact p |
| --- | ---: | ---: | ---: | ---: |
| Strict whole-body lateral realization | 3 | 2 | 19 | 0.5 |

The predeclared prerequisites all pass, but neither candidate realizes the strict composite in at least 18/24 panels and the paired directional evidence is not significant. The bounded result therefore establishes no directional strict-lateral advantage. It does not establish equivalence between the two PromptTags.

## Orientation Distribution

`side view`: frontal torso=6/24, three-quarter=12/24, lateral=6/24, rear=0/24.

`profile view`: frontal torso=8/24, three-quarter=6/24, lateral=7/24, rear=3/24.

## Evidence Boundary

This result is limited to the exact checkpoint, prompt family, endpoint, generation settings, and tested production phrases. It does not establish interchangeability, behavior on another model, or a general rule for lateral orientation.

## Research Boundary

CAM-040 changes no PromptTag, Concept Graph, compiler/advisory/UI/runtime, schema, workflow, platform, or production behavior.
