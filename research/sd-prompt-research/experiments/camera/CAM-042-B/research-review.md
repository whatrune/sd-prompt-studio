# CAM-042 Prompt-Blind Research Review

## Final Experiment Classification

**NO_RELIABLE_INTENDED_ORIENTATION_DIFFERENCE_ESTABLISHED**

All 48 panels are provenance-valid, face-and-torso-visible, and orientation-assessable. `front view` realized strict frontal orientation in 22/24 panels. `three-quarter view` realized three-quarter orientation in 10/24 panels, strict frontal orientation in 13/24, and profile/lateral drift in 1/24. Across matched seeds, intended-direction pairs=9, reversed-direction pairs=1, other pairs=14, and the one-sided exact sign p-value over the 10 directionally informative pairs is 0.01074219. The directional imbalance is statistically non-random within the informative subset, but the frozen reliability threshold fails because intended-direction pairs are below 18/24. This does not establish equivalence.

## Blinding and Provenance

- Panels: 48/48; missing or corrupt: 0.
- Exact checkpoint SHA-256, Euler a, Automatic, 20 steps, CFG 4.5, 1024x1024, and frozen settings: PASS.
- Ordered seeds, common prompt bytes, negative prompt, and settings are equal across both runs; only the declared terminal subject-orientation phrase differs.
- Request payload, raw response, `response.parameters`, parsed `response.info`, structural infotext, PNG metadata, PNG bytes, and decoded pixel bindings: PASS 48/48.
- Observer input exposed only opaque condition IDs, opaque panel IDs, image hashes, byte counts, and pixels.
- Canonical observer-input SHA-256: `b95e16eb9fe89f0ae8c6657941978586928adfcb808a1eee9f56ec6856250eb0`.
- Frozen visual-observation SHA-256: `c4d107bbfa866c24d5660b6e0978d90287758624a3109015045cc651f47d0971`.
- Sealed condition-mapping SHA-256: `55d15ac5f43466e122f3881c193c7580ed1a12de2b7cd251ed7a8ea628ea3e29`.
- Canonical tracked blind-record owner: `research/sd-prompt-research/experiments/camera/CAM-042-A/source/CAM-042-A_metadata.yaml`.
- Mapping was decoded only after the 48-row visual record was frozen; no frozen observation changed after decode.

## Per-Arm Metrics

| Run | Exact PromptTag / phrase | Strict frontal | Three-quarter | Profile/lateral | Ambiguous | Assessable | Face + torso visible | Artifact |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| CAM-042-A | `cam-front-view` / `front view` | 22/24 | 2/24 | 0/24 | 0/24 | 24/24 | 24/24 | 0/24 |
| CAM-042-B | `cam-three-quarter-view` / `three-quarter view` | 13/24 | 10/24 | 1/24 | 0/24 | 24/24 | 24/24 | 0/24 |

## Matched-Seed Analysis

| Endpoint | Intended pairs | Reversed pairs | Other pairs | One-sided exact p |
| --- | ---: | ---: | ---: | ---: |
| A strict frontal + B three-quarter | 9 | 1 | 14 | 0.01074219 |

Intended-direction panel IDs: 3, 6, 7, 8, 13, 15, 22, 23, 24. Reversed-direction panel IDs: 21. The predeclared prerequisites all pass, but neither support rule passes because neither direction reaches 18/24 matched pairs.

## Rubric Distributions

- CAM-042-A: character/face/torso orientation strict frontal=22/24 and three-quarter=2/24; assessable and face-plus-torso visible=24/24; ambiguity/artifact=0/24.
- CAM-042-B: character/face/torso orientation strict frontal=13/24, three-quarter=10/24, and profile/lateral=1/24; assessable and face-plus-torso visible=24/24; ambiguity/artifact=0/24.

## Evidence Boundary

This result is limited to the exact checkpoint, prompt family, endpoint, settings, seeds, and tested production phrases. It does not establish semantic equivalence, behavior on another model or prompt family, or absence of secondary composition effects.

## Research Boundary

CAM-042 changes no PromptTag, Concept Graph, compiler/advisory/UI/runtime, schema, workflow, platform, dependency, or production behavior.
