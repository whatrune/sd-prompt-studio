# POSE-001 Prompt-Blind Research Review

## Final Experiment Classification

**INCONCLUSIVE**

The predeclared prerequisites are not satisfied. Provenance and panel completeness pass at 72/72, and every full-body pose baseline remains assessable and correct at 6/6. After genuine opaque-label re-observation, only three of the twelve cells meet the requested-framing threshold of at least 5/6, and every cell exceeds the ambiguity/artifact ceiling because the frozen phrase `visible floor plane` produced a prominent aircraft or aircraft-like structure in all panels. The decision therefore remains on the predeclared `INCONCLUSIVE` branch; no visibility-effect claim is made.

## Blinding and Freeze Verification

| Predicate | Result |
| --- | --- |
| Observer input identity | Opaque `COND-01` through `COND-12` only |
| Requested pose/framing available during observation | NO |
| Run-to-condition mapping available during observation | NO |
| PromptTag IDs or emitted phrases available during observation | NO |
| Blind observation panel count | 72/72 |
| Frozen observation SHA-256 | `e6a6209adfb63444fc5cd51c6ee088d732534ed167683e57bf309a94a413c8a3` |
| Mapping disclosure | After the blind record was saved and hashed |
| Post-disclosure mutation of frozen visual axes | NONE |

The observer received only the opaque condition identity, panel number, seed identity, and panel pixels. Panel-axis observations were saved as one immutable external record and hashed before `mapping.hidden.json` was read. The mapping was then disclosed solely to project the frozen rows into canonical run artifacts and compute review-derived prompt-support and threshold results.

## Provenance Review

| Predicate | Result |
| --- | --- |
| 12 conditions × 6 panels | PASS — 72/72 |
| Ordered matched seeds | PASS |
| Model `novaAnimeXL_ilV190`, short hash `fa486caafc`, full SHA-256 exact | PASS |
| Euler a / Automatic / 20 steps / CFG 4.5 / 1024×1024 | PASS |
| Batch 1 / n_iter 1 / no hires / no face restore / no tiling | PASS |
| Positive prompt equality except pose and framing | PASS |
| Negative prompt equality | PASS |
| Missing/corrupt panels | 0 |

## Decoded Observation Matrix

| Run | Opaque label | Requested pose | Requested framing | Framing visible | Pose visibly supported | Artifact |
| --- | --- | --- | --- | ---: | ---: | ---: |
| POSE-001-A | COND-01 | standing | full body | 6/6 | 6/6 | 6/6 |
| POSE-001-B | COND-04 | standing | cowboy shot | 3/6 | 3/6 | 6/6 |
| POSE-001-C | COND-08 | standing | upper body | 0/6 | 6/6 | 6/6 |
| POSE-001-D | COND-10 | standing | close-up | 0/6 | 6/6 | 6/6 |
| POSE-001-E | COND-05 | sitting | full body | 6/6 | 6/6 | 6/6 |
| POSE-001-F | COND-07 | sitting | cowboy shot | 4/6 | 6/6 | 6/6 |
| POSE-001-G | COND-11 | sitting | upper body | 0/6 | 6/6 | 6/6 |
| POSE-001-H | COND-09 | sitting | close-up | 0/6 | 6/6 | 6/6 |
| POSE-001-I | COND-12 | kneeling | full body | 0/6 | 6/6 | 6/6 |
| POSE-001-J | COND-03 | kneeling | cowboy shot | 6/6 | 6/6 | 6/6 |
| POSE-001-K | COND-06 | kneeling | upper body | 0/6 | 6/6 | 6/6 |
| POSE-001-L | COND-02 | kneeling | close-up | 0/6 | 6/6 | 6/6 |

`Pose visibly supported` is review-derived after mapping disclosure. It was not present in, and did not feed back into, the frozen prompt-blind visual observations.

## Frozen Prerequisites

| Prerequisite | Threshold | Observed | Result |
| --- | ---: | ---: | --- |
| Provenance/panel completeness | 72/72 | 72/72 | PASS |
| Requested framing visible per cell | ≥5/6 | A=6, B=3, C=0, D=0, E=6, F=4, G=0, H=0, I=0, J=6, K=0, L=0 | FAIL |
| Ambiguity/artifact per cell | ≤1/6 | 6/6 in every cell | FAIL |
| Standing full-body assessable/correct | ≥5/6 | 6/6 | PASS |
| Sitting full-body assessable/correct | ≥5/6 | 6/6 | PASS |
| Kneeling full-body assessable/correct | ≥5/6 | 6/6 | PASS |

## Decision Boundary

- The classification was recomputed from the frozen opaque-label observations and is exactly `INCONCLUSIVE`.
- Thresholds were not adjusted after viewing images.
- The aircraft composition is retained as observed evidence; no image was regenerated.
- No production, compiler, PromptTag, Concept Graph, visibility-requirement, smartTagEngine, or UI change is authorized or implied.
- This Task records research evidence only.
