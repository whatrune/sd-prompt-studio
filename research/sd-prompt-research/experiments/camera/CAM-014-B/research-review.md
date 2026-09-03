# CAM-014 Prompt-Blind Research Review

## Final Experiment Classification

**NO_MEANINGFUL_SUBJECT_SCALE_EFFECT**

All 18 panels are independently provenance-valid. The predeclared assessability and ambiguity prerequisites PASS. The three frozen arms have the same frame-height band for every matched seed, so none of the ordered matched comparisons shows scale separation.

## Blinding and Provenance

- Panels: 18/18; missing or corrupt: 0.
- Exact model/hash, Euler a, Automatic, 20 steps, CFG 4.5, 1024x1024, and frozen settings: PASS.
- Across runs, the only positive-prompt difference is the terminal subject-scale phrase; negative prompts and ordered seeds are equal.
- response.parameters, parsed response.info, structural infotext, and PNG bindings: PASS 18/18.
- Observer input contained only opaque condition IDs, opaque panel IDs, image hashes, and pixels.
- Canonical observer-input SHA-256: `b28a18fb701ed9e5f3636b89fdb69f47067af9af3c5be6e7e9d278cc886d4f0a`.
- Frozen visual observation SHA-256: `075231e5879a5eabff626211d04e38faf0ef735175db5c3f5732c206c6e65b39`.
- Sealed condition mapping SHA-256: `d2c4197ad75b97838b59cb5e4f13827f5fc677583477b7aa26e857c751e1b844`.
- Canonical tracked blind-record owner: `research/sd-prompt-research/experiments/camera/CAM-014-A/source/CAM-014-A_metadata.yaml`.
- Condition mapping was decoded only after the visual record was frozen; no frozen visual row changed after decode.

## Per-Arm Metrics

| Run | Phrase | Requested band | Requested band observed | Assessable / whole visible | Ambiguity/artifact | Observed bands |
| --- | --- | --- | ---: | ---: | ---: | --- |
| CAM-014-A | `small subject in frame` | small or very small | 0/6 | 6/6 / 4/6 | 0/6 | very large 2/6, large 2/6, medium 2/6 |
| CAM-014-B | `medium-sized subject in frame` | medium | 2/6 | 6/6 / 4/6 | 0/6 | very large 2/6, large 2/6, medium 2/6 |
| CAM-014-C | `large subject in frame` | large or very large | 4/6 | 6/6 / 4/6 | 0/6 | very large 2/6, large 2/6, medium 2/6 |

## Matched-Seed Scale Discrimination

| Comparison | Requested ordered scale separation visible |
| --- | ---: |
| small to medium | 0/6 |
| medium to large | 0/6 |
| small to large | 0/6 |

Every matched seed receives the same frozen frame-height band in all three arms.

## Threshold Application

- Prerequisites: each arm assessable at least 5/6 and ambiguity/artifact at most 1/6: PASS.
- Stable arm support: requested band at least 5/6: all arms fail (0/6, 2/6, 4/6).
- Adjacent and endpoint matched-seed discrimination at least 5/6: all fail at 0/6.
- Therefore the predeclared no-meaningful-effect classification applies; no production conclusion is promoted.

## Research Boundary

CAM-014 changes no PromptTag, camera slot, Concept Graph, compiler/runtime, production advisory, UI, schema, platform, or production behavior. Product and Graph decisions remain deferred.
