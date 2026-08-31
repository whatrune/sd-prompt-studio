# POSE-001-E Research Review

## Final Experiment Classification

**INCONCLUSIVE**

The frozen prerequisites are not satisfied. Provenance and panel completeness pass at 72/72, and every full-body pose baseline is assessable and correct at 6/6. However, six of the twelve cells fail the requested-framing threshold of at least 5/6, and every cell exceeds the ambiguity/artifact ceiling because the exact frozen phrase `visible floor plane` produced a prominent aircraft or aircraft-like support structure in all panels. The result therefore stops at the predeclared `INCONCLUSIVE` branch; no visibility-effect claim is made.

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

## Prompt-Blind Observation Matrix

| Run | Pose | Requested framing | Framing visible | Pose visibly supported | Artifact |
| --- | --- | --- | ---: | ---: | ---: |
| POSE-001-A | standing | full body | 6/6 | 6/6 | 6/6 |
| POSE-001-B | standing | cowboy shot | 3/6 | 3/6 | 6/6 |
| POSE-001-C | standing | upper body | 0/6 | 6/6 | 6/6 |
| POSE-001-D | standing | close-up | 0/6 | 6/6 | 6/6 |
| POSE-001-E | sitting | full body | 6/6 | 6/6 | 6/6 |
| POSE-001-F | sitting | cowboy shot | 6/6 | 6/6 | 6/6 |
| POSE-001-G | sitting | upper body | 0/6 | 6/6 | 6/6 |
| POSE-001-H | sitting | close-up | 0/6 | 6/6 | 6/6 |
| POSE-001-I | kneeling | full body | 6/6 | 6/6 | 6/6 |
| POSE-001-J | kneeling | cowboy shot | 6/6 | 6/6 | 6/6 |
| POSE-001-K | kneeling | upper body | 0/6 | 6/6 | 6/6 |
| POSE-001-L | kneeling | close-up | 0/6 | 6/6 | 6/6 |

## Frozen Prerequisites

| Prerequisite | Threshold | Observed | Result |
| --- | ---: | ---: | --- |
| Provenance/panel completeness | 72/72 | 72/72 | PASS |
| Requested framing visible per cell | ≥5/6 | A=6, B=3, C=0, D=0, E=6, F=6, G=0, H=0, I=6, J=6, K=0, L=0 | FAIL |
| Ambiguity/artifact per cell | ≤1/6 | 6/6 in every cell | FAIL |
| Standing full-body assessable/correct | ≥5/6 | 6/6 | PASS |
| Sitting full-body assessable/correct | ≥5/6 | 6/6 | PASS |
| Kneeling full-body assessable/correct | ≥5/6 | 6/6 | PASS |

## Decision Boundary

- The classification is exactly `INCONCLUSIVE`; thresholds were not adjusted after viewing images.
- The aircraft composition is reported as observed evidence, not removed or regenerated.
- No production, compiler, PromptTag, Concept Graph, visibility-requirement, smartTagEngine, or UI change is authorized or implied.
- This Task records research evidence only.
