# CAM-031-B Research Review

## Observed

Post-decode mechanical comparison of the frozen independent visual record. Framing-boundary confidence is subjective.

| Run | Requested category | Realization | Assessable | Ambiguity/artifact |
| --- | --- | ---: | ---: | ---: |
| CAM-031-A | upper_body | 3/6 | 6/6 | 0/6 |
| CAM-031-B | upper_body | 0/6 | 6/6 | 0/6 |
| CAM-031-C | cowboy_shot | 2/6 | 6/6 | 0/6 |
| CAM-031-D | cowboy_shot | 3/6 | 6/6 | 0/6 |

## Interpretation

A and C are exact CAM-024 upper-body and cowboy-shot controls. B and D add only the fixed six-term bundle `standing, barefoot, black shorts, eye level, empty seamless studio, plain floor`. Requested realization means exact observed-category equality. Degradation means control realizes the requested category and treatment does not; improvement is the reverse. Neither-fits and both-fit pairs are unchanged.

| Pair | Degradation | Improvement | Unchanged | Lower edge wider | Tighter | Same |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| AB | 3/6 | 0/6 | 3/6 | 6/6 | 0/6 | 0/6 |
| CD | 1/6 | 2/6 | 3/6 | 5/6 | 0/6 | 1/6 |

Lower-edge ordering (tight to wide): upper_chest, chest, waist, pelvis, proximal_thigh, mid_thigh, distal_thigh, knee, lower_leg, feet, below_feet. Crop widening/tightening is reported separately and is not substituted for categorical realization.

### AB matched seeds

| Seed | Control category | Treatment category | Realization change | Control lower edge | Treatment lower edge | Crop change |
| --- | --- | --- | --- | --- | --- | --- |
| 1549407732 | upper_body | full_body | degradation | waist | below_feet | wider |
| 1169741762 | close_up | full_body | unchanged | chest | below_feet | wider |
| 905559969 | close_up | full_body | unchanged | chest | feet | wider |
| 1315347238 | upper_body | full_body | degradation | waist | below_feet | wider |
| 2040747387 | close_up | full_body | unchanged | chest | below_feet | wider |
| 1316851485 | upper_body | full_body | degradation | waist | below_feet | wider |

### CD matched seeds

| Seed | Control category | Treatment category | Realization change | Control lower edge | Treatment lower edge | Crop change |
| --- | --- | --- | --- | --- | --- | --- |
| 1549407732 | upper_body | cowboy_shot | improvement | proximal_thigh | knee | wider |
| 1169741762 | upper_body | cowboy_shot | improvement | pelvis | mid_thigh | wider |
| 905559969 | cowboy_shot | cowboy_shot | unchanged | mid_thigh | mid_thigh | same |
| 1315347238 | upper_body | full_body | unchanged | proximal_thigh | lower_leg | wider |
| 2040747387 | cowboy_shot | full_body | degradation | mid_thigh | feet | wider |
| 1316851485 | upper_body | full_body | unchanged | proximal_thigh | below_feet | wider |

## Working Conclusion

**INCONCLUSIVE**

Provenance and manipulation are independently recheckable for 24/24 panels; every arm has 6/6 assessable boundaries and 0/6 ambiguity/artifact, so the prerequisites pass. CUMULATIVE_FRAMING_INTERFERENCE_SUPPORTED requires degradation >=5/6 in at least one pair; AB has 3/6 and CD has 1/6. NO_MATERIAL_CUMULATIVE_FRAMING_INTERFERENCE requires treatment realization >=5/6 in both B and D and degradation <=1/6 in each pair. B realizes upper_body in 0/6 and D realizes cowboy_shot in 3/6. The mechanically required classification is therefore INCONCLUSIVE.

The upper-body control realizes upper_body in 3/6, while its bundle treatment realizes it in 0/6 and widens the lower edge in 6/6 matched seeds. The cowboy-shot control realizes cowboy_shot in 2/6, while its bundle treatment realizes it in 3/6; degradation is 1/6 and improvement is 2/6. Neither predeclared terminal threshold is met. This bounded result does not establish material cumulative interference and also cannot establish its absence.

## Provenance and Frozen Record

- Independent observation SHA-256: `1ab47d3b14f58656128693cb32f7116585b0242807a0c58551b1e8a864c36812`.
- Observer input SHA-256: `f018e714626830d79b6441431ec8a9b167ca25379642b3dfb7b4984308af0ab0`.
- Sealed mapping SHA-256: `6274675559956ed22742d903de4ef3a570cf36c4fe36df7e07772a4bafd5488e`.
- Frozen at `2026-09-07T12:20:19.833Z` before decode at `2026-09-07T12:26:10.982Z`.
- All exact UTF-8 payloads are stored in CAM-031-A metadata; B/C/D reference that owner and all three hashes.
- Rechecks cover all 24 canonical/opaque hashes and equal pixels, matched seeds, returned parameters, parsed response info, checkpoint identity, and scheduler infotext.
- Fixed endpoint `http://192.168.0.6:7860`; no fallback, regeneration, or retry.

## Concept Dictionary Impact

None; no Graph, PromptTag, dictionary, compiler, runtime, schema, UI, or platform change.
