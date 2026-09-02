# CAM-008 Prompt-Blind Research Review

## Final Experiment Classification

**PARTIAL_HORIZONTAL_CAMERA_ANGLE_DISCRIMINATION**

All 18 panels are independently provenance-valid and orientation-assessable. The `front view` arm produced a strict frontal torso in 6/6 panels. The `side view` arm produced a front-oblique three-quarter torso in 6/6 and a strict lateral torso in 0/6, with orientation ambiguity in 3/6. The `from behind` arm showed visible back evidence in 6/6, while strict centered rear torso evidence occurred in 3/6 and rear three-quarter evidence in 3/6. Full three-way canonical target alignment is therefore not established.

## Blinding and Provenance

- Panels: 18/18; missing or corrupt: 0.
- Exact model/hash, Euler a, Automatic, 20 steps, CFG 4.5, 1024×1024, and frozen settings: PASS.
- Across runs, the only positive-prompt difference is the terminal horizontal-view phrase; negative prompts and ordered seeds are equal.
- response.parameters, parsed response.info, structural infotext, and PNG bindings: PASS 18/18.
- Observer input contained only opaque condition IDs, opaque panel IDs, and pixels.
- Frozen visual observation SHA-256: `c451f3878f8ed14a235d9c938726bc6b666df8c88108fc9d8611da28d3bb6ec8`.
- Sealed condition mapping SHA-256: `fe126922719c0ef43fe8da7a2544bcab63263176fdbc3933fe742c89abf2ed05`.
- Canonical tracked blind-record owner: `research/sd-prompt-research/experiments/camera/CAM-008-A/source/CAM-008-A_metadata.yaml`.
- Condition mapping was decoded only after the visual record was frozen; no frozen visual row changed after decode.

## Per-Arm Metrics

| Run | Phrase | Strict requested orientation | Torso evidence | Back visible | Assessable | Ambiguity/artifact | Full body |
| --- | --- | ---: | --- | ---: | ---: | ---: | ---: |
| CAM-008-A | `front view` | 6/6 | frontal 6/6 | 0/6 | 6/6 | 0/6 | 6/6 |
| CAM-008-B | `side view` | 0/6 | three-quarter 6/6, lateral 0/6 | 0/6 | 6/6 | 3/6 | 6/6 |
| CAM-008-C | `from behind` | 3/6 | rear 3/6, rear three-quarter 3/6 | 6/6 | 6/6 | 1/6 | 6/6 |

## Matched-Seed Discrimination

| Comparison | Visibly distinct composite orientation |
| --- | ---: |
| front view vs side view | 6/6 |
| side view vs from behind | 6/6 |
| front view vs from behind | 6/6 |

Composite orientation uses only the already-frozen torso-orientation and back-visibility axes. Although every pair is visibly distinct, `side view` fails the strict lateral target at 0/6 and exceeds the allowed ambiguity bound, while `from behind` splits between centered rear and rear three-quarter presentation. The mandatory classification is therefore `PARTIAL_HORIZONTAL_CAMERA_ANGLE_DISCRIMINATION`, not full discrimination.

## Production Reality Boundary

Production owns `front view` and `side view` in the `subject_orientation` slot, but its rear-facing PromptTag emits `rear view`. This Task tested the explicitly authorized phrase `from behind`; its evidence must not be attached to `rear view` or used for a production decision without a later Architecture review.

## Research Boundary

CAM-008 changes no PromptTag, subject-orientation slot, Concept Graph, compiler/runtime, production advisory, UI, schema, platform, or production behavior.
