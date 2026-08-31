# CLOTHING-001 Prompt-Blind Research Review

## Final Experiment Classification

**RELATION_SUPPORTED**

All 12 panels and independently recheckable provenance passed. The fitted reference showed a clear pelvis-to-surface boundary in 6/6 panels. The oversized treatment showed partial visibility with the upper garment as the primary obscuring source in 6/6 matched panels. All six pairs therefore classify as `OVERSIZED_REDUCED_VISIBILITY`, meeting the predeclared at-least-5/6 stable-treatment threshold. No pair met the lower-garment-confounded or not-assessable criteria.

## Blinding and Provenance

- Panels: 12/12; missing or corrupt: 0.
- Exact six ordered matched seeds across A/B: PASS.
- Exact model/hash, Euler a, Automatic, 20 steps, CFG 4.5, 1024x1024, batch/n_iter 1, and disabled high-res/face restoration/tiling: PASS 12/12.
- The positive prompt differs only by `plain fitted white t-shirt` versus `plain oversized white t-shirt`; negative prompt and all generation settings are equal.
- Tracked metadata retains returned prompts, returned negative prompts, full response parameters, response info, infotext, image hashes, and byte counts for independent 12/12 provenance recheck.
- The observer received opaque condition/panel identities and pixels only. The frozen observation SHA-256 is `60555888ae3dc36de693036c3c236ef6e56a5efc0616ac313bf8aae95964a92d`; mapping disclosure occurred only afterward and no frozen visual row changed.

## Per-arm Metrics

| Run | Complete | Full-body | Supine | Boundary clear | Boundary partial | Upper-garment obscuring | Lower-garment obscuring | Major artifact |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| CLOTHING-001-A | 6/6 | 6/6 | 6/6 | 6/6 | 0/6 | 0/6 | 0/6 | 0/6 |
| CLOTHING-001-B | 6/6 | 6/6 | 6/6 | 0/6 | 6/6 | 6/6 | 0/6 | 0/6 |

## Matched-pair Classification

| Pair | Seed | Classification |
| ---: | ---: | --- |
| 1 | 1126645754 | OVERSIZED_REDUCED_VISIBILITY |
| 2 | 1332582485 | OVERSIZED_REDUCED_VISIBILITY |
| 3 | 1588147170 | OVERSIZED_REDUCED_VISIBILITY |
| 4 | 1901831359 | OVERSIZED_REDUCED_VISIBILITY |
| 5 | 1918636949 | OVERSIZED_REDUCED_VISIBILITY |
| 6 | 2128309031 | OVERSIZED_REDUCED_VISIBILITY |

Summary: `OVERSIZED_REDUCED_VISIBILITY=6/6`, `NO_REDUCTION=0/6`, `LOWER_GARMENT_CONFOUNDED=0/6`, `NOT_ASSESSABLE=0/6`.

## Prerequisites

| Predicate | Requirement | Observed | Result |
| --- | ---: | ---: | --- |
| completeness | 12/12 | 12/12 | PASS |
| ordered matched seeds | 6 per arm | 6 per arm | PASS |
| boundary assessable | >=5/6 each | 6/6 each | PASS |
| full-body framing | >=5/6 each | 6/6 each | PASS |
| visible supine orientation | >=5/6 each | 6/6 each | PASS |
| major artifact | <=1/6 each | 0/6 each | PASS |
| stable treatment outcome | >=5/6 | 6/6 | PASS |

## Research Boundary

This is a Research evidence conclusion only: under the frozen model, prompts, and seeds, the oversized T-shirt itself reduced direct pelvis-boundary visibility. No PromptTag, Concept Graph, production advisory, compiler/runtime behavior, UI, schema, or platform behavior is changed.
