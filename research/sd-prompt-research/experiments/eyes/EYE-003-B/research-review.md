# EYE-003 Prompt-Blind Research Review

## Final Experiment Classification

**INCONCLUSIVE**

The looking-at-viewer control A passed its predeclared directional prerequisite at 6/6. The looking-away control B failed its prerequisite: away-directed gaze was 0/6 and viewer-directed gaze was 6/6. Because a valid away reference is required before the joint condition can distinguish coexistence, suppression, or contradiction, the prerequisite-failure branch fixes the result at INCONCLUSIVE. The treatment C produced viewer_only in 6/6 panels, but that observation cannot establish suppression of looking away when B did not visibly express away gaze.

## Blinding and Provenance

- Panels: 18/18; missing or corrupt: 0.
- Exact six ordered matched seeds across A/B/C: PASS.
- Exact model/hash, Euler a, Automatic, 20 steps, CFG 4.5, 1024x1024, batch/n_iter 1, and disabled high-res/face restoration/tiling: PASS 18/18.
- Positive prompts share one byte-identical common prefix and differ only in the approved directional phrase suffix; negative prompts and settings are equal.
- Request and response.parameters sampler/scheduler, parsed info sampler, structural infotext Sampler/Schedule type, seed, prompt, negative prompt, model, hash, and dimensions: PASS 18/18.
- The independent observer received opaque condition/panel identities and pixels only; prompt, seed, mapping, requested labels, Task identity, and generation metadata were unavailable.
- Frozen observation SHA-256: `427c30abe78ea31e7c1529fefbfea8d35da5911bdaa3afbb7f2ee82e636a530d`.
- Mapping disclosure occurred only after the freeze; the 18 frozen rows were not changed.

## Per-condition Metrics

| Metric | A: viewer | B: away | C: joint |
| --- | ---: | ---: | ---: |
| panel completeness | 6/6 | 6/6 | 6/6 |
| eyes visible = both | 6/6 | 6/6 | 6/6 |
| gaze assessable = yes | 6/6 | 6/6 | 6/6 |
| both eyes toward_viewer | 6/6 | 6/6 | 6/6 |
| both eyes away | 0/6 | 0/6 | 0/6 |
| binocular coordination = aligned | 6/6 | 6/6 | 6/6 |
| ambiguity/artifact non-none | 0/6 | 0/6 | 0/6 |

## Prerequisites

| Predicate | Requirement | Observed | Result |
| --- | ---: | ---: | --- |
| completeness | 18/18 | 18/18 | PASS |
| ordered matched seeds | 6 | 6 | PASS |
| gaze assessable | >=5/6 each | 6/6 each | PASS |
| A toward_viewer | >=5/6 | 6/6 | PASS |
| B away | >=5/6 | 0/6 | **FAIL** |
| ambiguity/artifact | <=1/6 each | 0/6 each | PASS |

## Matched-seed Summary

All six seed triads decoded identically: A = viewer-directed, B = viewer-directed, and C = viewer_only. Thus C matched A in 6/6 and matched the visible (but not requested) B direction in 6/6. No coherent_joint, away_only, directional_conflict, unclear, or artifact treatment outcome occurred.

## Research Boundary

Production decisions remain deferred. EYE-003 changes no PromptTag, gaze_direction slot, Concept Graph, compiler/runtime behavior, UI, advisory data, schema, or platform behavior.
