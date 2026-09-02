# CAM-012 Prompt-Blind Research Review

## Final Experiment Classification

**NO_MEANINGFUL_SUBJECT_ELEVATION_EFFECT**

All 18 panels are independently provenance-valid. The predeclared visibility, assessability, and ambiguity prerequisites PASS. Every frozen visual row places the complete subject in the center vertical band, so no requested directional elevation distinction is supported.

## Blinding and Provenance

- Panels: 18/18; missing or corrupt: 0.
- Exact model/hash, Euler a, Automatic, 20 steps, CFG 4.5, 1024x1024, and frozen settings: PASS.
- Across runs, the only positive-prompt difference is the terminal subject-placement phrase; negative prompts and ordered seeds are equal.
- response.parameters, parsed response.info, structural infotext, and PNG bindings: PASS 18/18.
- Observer input contained only opaque condition IDs, opaque panel IDs, and pixels.
- Canonical observer-input SHA-256: `3fdf03cc21400b65513a3ff32b09c9e7d4170ceb6d6cb1a701dff65b22d2a040`.
- Frozen visual observation SHA-256: `1655d25c6796ca403e48fd7680545744f78f9670ad58cc3ef63f2f030b96549a`.
- Sealed condition mapping SHA-256: `0c7a2d7c6279f8294473560335bb31cc65b6f19711e87a73b86c571d6bf616e3`.
- Canonical tracked blind-record owner: `research/sd-prompt-research/experiments/camera/CAM-012-A/source/CAM-012-A_metadata.yaml`.
- Condition mapping was decoded only after the visual record was frozen; no frozen visual row changed after decode.

## Per-Arm Metrics

| Run | Phrase | Requested band | Requested band observed | Assessable / whole visible | Ambiguity/artifact | Observed vertical bands | Unintended high angle |
| --- | --- | --- | ---: | ---: | ---: | --- | ---: |
| CAM-012-A | `subject low in frame` | low | 0/6 | 6/6 / 6/6 | 0/6 | center 6/6 | 2/6 |
| CAM-012-B | `subject centered vertically in frame` | center | 6/6 | 6/6 / 6/6 | 0/6 | center 6/6 | 2/6 |
| CAM-012-C | `subject high in frame` | high | 0/6 | 6/6 / 6/6 | 0/6 | center 6/6 | 2/6 |

## Matched-Seed Directional Discrimination

| Comparison | Requested upward shift visible |
| --- | ---: |
| low to center | 0/6 |
| center to high | 0/6 |
| low to high | 0/6 |

The directional comparison was derived only after decode from the frozen subject vertical-band labels. The common elevated-view shift in panels 5 and 6 appears across all three arms and does not create a vertical-placement distinction.

## Research Boundary

CAM-012 changes no PromptTag, camera slot, Concept Graph, compiler/runtime, production advisory, UI, schema, platform, or production behavior. Product and Graph decisions remain deferred.
