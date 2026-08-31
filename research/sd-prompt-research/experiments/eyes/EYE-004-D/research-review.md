# EYE-004 Prompt-Blind Research Review

## Final Experiment Classification

**INCONCLUSIVE**

All 36 panels and independently recheckable provenance passed. The locked and medium-close-up references A and E each showed no away-directed gaze in 6/6. The unlocked upper-body reference C showed spontaneous away-directed gaze in 2/6, leaving only 4/6 no-away panels and failing the predeclared >=5/6 reference prerequisite. Therefore the prerequisite-failure branch requires INCONCLUSIVE. The treatment observations remain descriptive: B showed no visible effect in 6/6, D showed away-directed gaze in 3/6, and F showed away-directed gaze in 4/6. These values do not support a stable >=5/6 effect, context-suppression claim, or framing-dependence claim.

## Blinding and Provenance

- Panels: 36/36; missing or corrupt: 0.
- Exact six ordered matched seeds across A-F: PASS.
- Exact model/hash, Euler a, Automatic, 20 steps, CFG 4.5, 1024x1024, batch/n_iter 1, and disabled high-res/face restoration/tiling: PASS 36/36.
- Within A/B, C/D, and E/F, the positive prompt differs only by the terminal `looking away` phrase; negative prompts and all settings are byte/equality matched within each pair.
- Tracked metadata retains returned prompt, returned negative prompt, full response parameters, and structured infotext for independent 36/36 provenance recheck.
- The observer received opaque condition/panel identities and pixels only. The frozen record SHA-256 is `abd1d1e319cece7f711df6472e16510334b87158f929149c3707663361622fbe`; mapping disclosure occurred only afterward and no frozen visual row changed.

## Per-arm Metrics

| Run | Complete | Assessable | Viewer-directed | Away-directed | Frontal | Three-quarter | Requested framing | Ambiguity/artifact |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| EYE-004-A | 6/6 | 6/6 | 6/6 | 0/6 | 5/6 | 1/6 | 6/6 | 0/6 |
| EYE-004-B | 6/6 | 6/6 | 6/6 | 0/6 | 6/6 | 0/6 | 6/6 | 0/6 |
| EYE-004-C | 6/6 | 6/6 | 4/6 | 2/6 | 3/6 | 3/6 | 6/6 | 0/6 |
| EYE-004-D | 6/6 | 6/6 | 3/6 | 3/6 | 3/6 | 3/6 | 6/6 | 0/6 |
| EYE-004-E | 6/6 | 6/6 | 6/6 | 0/6 | 4/6 | 2/6 | 6/6 | 0/6 |
| EYE-004-F | 6/6 | 6/6 | 2/6 | 4/6 | 4/6 | 2/6 | 6/6 | 0/6 |

## Prerequisites

| Predicate | Requirement | Observed | Result |
| --- | ---: | ---: | --- |
| completeness | 36/36 | 36/36 | PASS |
| ordered matched seeds | 6 per arm | 6 per arm | PASS |
| gaze/face orientation assessable | >=5/6 each | 6/6 each | PASS |
| ambiguity/artifact | <=1/6 each | 0/6 each | PASS |
| A reference no-away | >=5/6 | 6/6 | PASS |
| C reference no-away | >=5/6 | 4/6 | **FAIL** |
| E reference no-away | >=5/6 | 6/6 | PASS |
| E/F medium-close-up framing | >=5/6 each | 6/6, 6/6 | PASS |

## Matched-seed Summary

- EYE-004-A/EYE-004-B: eye_direction_only=0/6, head_orientation_only=0/6, combined_eye_and_head=0/6, no_visible_effect=6/6
- EYE-004-C/EYE-004-D: eye_direction_only=2/6, head_orientation_only=0/6, combined_eye_and_head=0/6, no_visible_effect=4/6
- EYE-004-E/EYE-004-F: eye_direction_only=3/6, head_orientation_only=1/6, combined_eye_and_head=1/6, no_visible_effect=1/6

| Pair | Seed | Derived treatment outcome |
| --- | ---: | --- |
| EYE-004-A/EYE-004-B | 1126645754 | no_visible_effect |
| EYE-004-A/EYE-004-B | 1332582485 | no_visible_effect |
| EYE-004-A/EYE-004-B | 1588147170 | no_visible_effect |
| EYE-004-A/EYE-004-B | 1901831359 | no_visible_effect |
| EYE-004-A/EYE-004-B | 1918636949 | no_visible_effect |
| EYE-004-A/EYE-004-B | 2128309031 | no_visible_effect |
| EYE-004-C/EYE-004-D | 1126645754 | eye_direction_only |
| EYE-004-C/EYE-004-D | 1332582485 | eye_direction_only |
| EYE-004-C/EYE-004-D | 1588147170 | no_visible_effect |
| EYE-004-C/EYE-004-D | 1901831359 | no_visible_effect |
| EYE-004-C/EYE-004-D | 1918636949 | no_visible_effect |
| EYE-004-C/EYE-004-D | 2128309031 | no_visible_effect |
| EYE-004-E/EYE-004-F | 1126645754 | no_visible_effect |
| EYE-004-E/EYE-004-F | 1332582485 | head_orientation_only |
| EYE-004-E/EYE-004-F | 1588147170 | eye_direction_only |
| EYE-004-E/EYE-004-F | 1901831359 | eye_direction_only |
| EYE-004-E/EYE-004-F | 1918636949 | eye_direction_only |
| EYE-004-E/EYE-004-F | 2128309031 | combined_eye_and_head |

Pair outcomes were derived only after the opaque observation record was frozen and decoded. Because C fails the reference prerequisite, the observed D/F differences remain descriptive and do not authorize a stable semantic or production conclusion.

## Research Boundary

Production decisions remain deferred. EYE-004 changes no PromptTag, gaze_direction slot, Concept Graph, compiler/runtime behavior, UI, advisory data, schema, or platform behavior.
