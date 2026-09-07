# CAM-032 Bundle-Bisection Research Review

## Observed

Post-decode mechanical comparison of the frozen independent visual record. Framing-boundary confidence is subjective.

| Run | Requested category | Realization | Assessable | Ambiguity/artifact |
| --- | --- | ---: | ---: | ---: |
| CAM-032-A | upper_body | 2/6 | 6/6 | 0/6 |
| CAM-032-B | upper_body | 1/6 | 6/6 | 0/6 |
| CAM-032-C | upper_body | 3/6 | 6/6 | 0/6 |
| CAM-032-D | upper_body | 0/6 | 6/6 | 0/6 |

## Interpretation

A is the exact CAM-024 upper-body control. B adds only `standing, barefoot, black shorts`; C adds only `eye level, empty seamless studio, plain floor`; D adds all six terms. Requested realization means exact observed-category equality to `upper_body`. Degradation means A realizes `upper_body` and the matched treatment does not; improvement is the inverse. Neither-fits and both-fit pairs are unchanged.

| Pair | Degradation | Improvement | Unchanged | Lower edge wider | Tighter | Same | Unassessable |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| AB | 2/6 | 1/6 | 3/6 | 6/6 | 0/6 | 0/6 | 0/6 |
| AC | 0/6 | 1/6 | 5/6 | 1/6 | 0/6 | 5/6 | 0/6 |
| AD | 2/6 | 0/6 | 4/6 | 6/6 | 0/6 | 0/6 | 0/6 |

Lower-edge ordering (wide to tight): below_feet, feet, lower_leg, knee, distal_thigh, mid_thigh, proximal_thigh, pelvis, waist, chest, upper_chest. Crop widening/tightening is reported separately and is not substituted for categorical realization.

### AB matched seeds

| Seed | Control category | Treatment category | Realization change | Control lower edge | Treatment lower edge | Crop change |
| --- | --- | --- | --- | --- | --- | --- |
| 561318373 | close_up | full_body | unchanged | chest | below_feet | wider |
| 1016498430 | upper_body | full_body | degradation | waist | below_feet | wider |
| 985722191 | close_up | cowboy_shot | unchanged | chest | mid_thigh | wider |
| 1766071579 | upper_body | full_body | degradation | waist | lower_leg | wider |
| 799659922 | close_up | upper_body | improvement | chest | proximal_thigh | wider |
| 118588234 | close_up | full_body | unchanged | chest | below_feet | wider |

### AC matched seeds

| Seed | Control category | Treatment category | Realization change | Control lower edge | Treatment lower edge | Crop change |
| --- | --- | --- | --- | --- | --- | --- |
| 561318373 | close_up | close_up | unchanged | chest | chest | same |
| 1016498430 | upper_body | upper_body | unchanged | waist | waist | same |
| 985722191 | close_up | upper_body | improvement | chest | waist | wider |
| 1766071579 | upper_body | upper_body | unchanged | waist | waist | same |
| 799659922 | close_up | close_up | unchanged | chest | chest | same |
| 118588234 | close_up | close_up | unchanged | chest | chest | same |

### AD matched seeds

| Seed | Control category | Treatment category | Realization change | Control lower edge | Treatment lower edge | Crop change |
| --- | --- | --- | --- | --- | --- | --- |
| 561318373 | close_up | full_body | unchanged | chest | below_feet | wider |
| 1016498430 | upper_body | full_body | degradation | waist | below_feet | wider |
| 985722191 | close_up | full_body | unchanged | chest | lower_leg | wider |
| 1766071579 | upper_body | full_body | degradation | waist | lower_leg | wider |
| 799659922 | close_up | full_body | unchanged | chest | feet | wider |
| 118588234 | close_up | full_body | unchanged | chest | below_feet | wider |

## Working Conclusion

**INCONCLUSIVE**

Provenance and manipulation are independently recheckable for 24/24 panels; assessability is A 6/6, B 6/6, C 6/6, D 6/6; ambiguity/artifact is A 0/6, B 0/6, C 0/6, D 0/6. Matched degradation is AB 2/6, AC 0/6, AD 2/6; treatment realization is B 1/6, C 3/6, D 0/6. The mechanically frozen thresholds therefore require INCONCLUSIVE.

Support requires all prerequisites plus matched requested-framing degradation >=5/6 in at least one treatment comparison. No-material requires all prerequisites, realization >=5/6 in B, C, and D, and degradation <=1/6 in all three comparisons. Otherwise the classification is INCONCLUSIVE. These six matched seeds are bounded directional evidence; the bisection does not establish universal, individual-term, or interaction causality.

CAM-024-C realized `upper_body` in 6/6 under its different frozen seeds. CAM-031's upper-body control realized 3/6 and its full-bundle arm 0/6. These historical values are context only and are not substituted for CAM-032's matched comparisons.

## Provenance and Frozen Record

- Independent observation SHA-256: `8c1d20fc0d3d5284094b6e8dcac53816a2a951219a3ef1f202b62e57b477c16e`.
- Observer input SHA-256: `9eabe24a3bca952590ffb4a513edbbc95d0a68020773eb7290a75e8c9af193d6`.
- Sealed mapping SHA-256: `80b6e4b49867c9b18a60bd22df5f607716ab761de05af653e21ae9e597c9b88c`.
- Frozen at `2026-09-07T14:20:19.963Z` before decode at `2026-09-07T14:20:19.972Z`.
- All exact UTF-8 payloads are stored in CAM-032-A metadata; B/C/D reference that owner and all three hashes.
- Rechecks cover all 24 canonical/opaque hashes and equal pixels, matched seeds, returned parameters, parsed response info, checkpoint identity, and scheduler infotext.
- Fixed endpoint `http://192.168.0.6:7860`; no fallback, regeneration, or retry.

## Concept Dictionary Impact

None; no Graph, PromptTag, dictionary, compiler, runtime, schema, UI, or platform change.
