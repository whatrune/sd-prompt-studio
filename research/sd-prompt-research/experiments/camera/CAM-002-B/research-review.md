# CAM-002 Matched-Seed Research Review — CAM-002-B

## Final Experiment Classification

**INCONCLUSIVE**

All frozen prerequisites pass: provenance/panel completeness is 12/12, both conditions are assessable 6/6, all six pairs are assessable, and boundary ambiguity/artifact is 0/6 per condition. After mapping disclosure, the predeclared matched-seed lower-boundary comparison is B tighter in 3/6 pairs, the same in 3/6, and looser in 0/6. This does not meet the stable threshold (tighter ≥5/6 plus one exact boundary signature ≥4/6), the directional threshold (tighter ≥4/6), or the no-meaningful-shift threshold (same ≥5/6 with tighter/looser ≤1/6). The result therefore follows the closed `INCONCLUSIVE` branch.

## Blinding and Freeze Verification

| Predicate | Result |
| --- | --- |
| Opaque condition for this run | `COND-556BEAD9` |
| Requested framing available during observation | NO |
| Run/prompt/PromptTag mapping available during observation | NO |
| Seed mapping available during observation | NO |
| Frozen observation SHA-256 | `d9796946ebdef8a6dcfd4a32577478e07f9113f32042ef6d5929388c78833cad` |
| Mapping disclosure | After the blind record was saved and hashed |
| Post-disclosure mutation of frozen visual rows | NONE |

## Provenance Review

| Predicate | Result |
| --- | --- |
| 2 conditions × 6 panels | PASS — 12/12 |
| Ordered matched seeds | PASS |
| Model `novaAnimeXL_ilV190`, short hash `fa486caafc`, full SHA-256 exact | PASS |
| Euler a / Automatic / 20 steps / CFG 4.5 / 1024×1024 | PASS |
| Batch 1 / n_iter 1 / no hires / no face restore / no tiling | PASS |
| Positive prompt equality except insertion of `cowboy shot, ` before `front view` | PASS |
| Negative prompt equality | PASS |
| Missing/corrupt panels | 0 |

## Decoded Matched-Seed Lower Boundary

| Seed | A lower boundary | B lower boundary | B relative to A |
| ---: | --- | --- | --- |
| 1085743552 | `mid_thigh` | `mid_thigh` | **same** |
| 1498980057 | `mid_thigh` | `mid_thigh` | **same** |
| 582359355 | `knee_region` | `proximal_thigh` | **tighter** |
| 1712699272 | `distal_thigh` | `proximal_thigh` | **tighter** |
| 738358221 | `mid_thigh` | `mid_thigh` | **same** |
| 194153683 | `knee_region` | `mid_thigh` | **tighter** |

The matched comparison above was computed only after disclosure. It did not feed back into the frozen condition-local observations.

## Frozen Prerequisites and Thresholds

| Predicate | Threshold | Observed | Result |
| --- | ---: | ---: | --- |
| Provenance/panel completeness | 12/12 | 12/12 | PASS |
| Assessable per condition | ≥5/6 | A=6/6, B=6/6 | PASS |
| Assessable matched pairs | ≥5/6 | 6/6 | PASS |
| Boundary ambiguity/artifact per condition | ≤1/6 | A=0/6, B=0/6 | PASS |
| Stable distinct visibility boundary | tighter ≥5/6 and exact signature ≥4/6 | tighter=3/6 | NOT MET |
| Directional but variable shift | tighter ≥4/6 | tighter=3/6 | NOT MET |
| No meaningful visibility shift | same ≥5/6; tighter, looser ≤1/6 | same=3/6 | NOT MET |

## Decision Boundary

- The final classification is exactly `INCONCLUSIVE`.
- Thresholds were not adjusted after viewing images.
- No anatomical evidence was inferred from prompt text.
- No production, compiler, PromptTag, conflict, ordering, Concept Graph, advisory, smartTagEngine, or UI change is authorized or implied.
- This Task records research evidence only.
