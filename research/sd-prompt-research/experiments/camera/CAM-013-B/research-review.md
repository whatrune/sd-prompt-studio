# CAM-013 Prompt-Blind Research Review

## Final Experiment Classification

**NO_MEANINGFUL_SUBJECT_POSITION_EFFECT**

All 18 panels are independently provenance-valid. The predeclared visibility, assessability, and ambiguity prerequisites PASS. Every frozen visual row places the complete subject in the center horizontal band. Neither requested lateral placement produced its intended band, and no matched-seed directional separation is supported.

## Blinding and Provenance

- Panels: 18/18; missing or corrupt: 0.
- Exact model/hash, Euler a, Automatic, 20 steps, CFG 4.5, 1024x1024, and frozen settings: PASS.
- Across runs, the only positive-prompt difference is the terminal subject-placement phrase; negative prompts and ordered seeds are equal.
- response.parameters, parsed response.info, structural infotext, and PNG bindings: PASS 18/18.
- Observer input contained only opaque condition IDs, opaque panel IDs, image hashes, and pixels.
- Canonical observer-input SHA-256: `efd7524626e7321ed0f307408e19abd867ae62cba6dd081b0c56b20733b83369`.
- Frozen visual observation SHA-256: `cbd9304827a11445d0fc4ab737549c4accfa9f6dc88c8be4f27fd7217f678d50`.
- Sealed condition mapping SHA-256: `dcd8dc29fd64bab59da20667ebee1ffe939ba8284abb5ad46096d446b1aca7bf`.
- Canonical tracked blind-record owner: `research/sd-prompt-research/experiments/camera/CAM-013-A/source/CAM-013-A_metadata.yaml`.
- Condition mapping was decoded only after the visual record was frozen; no frozen visual row changed after decode.

## Per-Arm Metrics

| Run | Phrase | Requested band | Requested band observed | Assessable / whole visible | Ambiguity/artifact | Observed bands |
| --- | --- | --- | ---: | ---: | ---: | --- |
| CAM-013-A | `subject on the left side of the frame` | left | 0/6 | 6/6 / 6/6 | 0/6 | center 6/6 |
| CAM-013-B | `subject centered in the frame` | center | 6/6 | 6/6 / 6/6 | 0/6 | center 6/6 |
| CAM-013-C | `subject on the right side of the frame` | right | 0/6 | 6/6 / 6/6 | 0/6 | center 6/6 |

## Matched-Seed Directional Discrimination

| Comparison | Requested horizontal separation visible |
| --- | ---: |
| left to center | 0/6 |
| center to right | 0/6 |
| left to right | 0/6 |

The matched comparison was derived only after decode from the frozen horizontal-band labels. All three arms remain centered for every matched seed.

## Threshold Application

- Prerequisites: each arm assessable at least 5/6 and ambiguity/artifact at most 1/6: PASS.
- Stable arm support: requested band at least 5/6: center only; left and right fail at 0/6.
- Adjacent and endpoint matched-seed discrimination at least 5/6: all fail at 0/6.
- Therefore the predeclared no-meaningful-effect classification applies; no production conclusion is promoted.

## Research Boundary

CAM-013 changes no PromptTag, camera slot, Concept Graph, compiler/runtime, production advisory, UI, schema, platform, or production behavior. Product and Graph decisions remain deferred.
