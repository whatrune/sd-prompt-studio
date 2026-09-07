# CAM-028-C Research Review

## Observed

Post-decode mechanical comparison of the frozen independent visual record. Framing-boundary confidence is subjective; original ratings and evidence notes are unchanged.

| Run | Requested category | Realization | Assessable | Ambiguity/artifact |
| --- | --- | ---: | ---: | ---: |
| CAM-028-A | upper_body | 5/6 | 6/6 | 0/6 |
| CAM-028-B | upper_body | 6/6 | 6/6 | 0/6 |
| CAM-028-C | cowboy_shot | 0/6 | 6/6 | 0/6 |
| CAM-028-D | cowboy_shot | 0/6 | 6/6 | 0/6 |

## Interpretation

A and C are the exact upper-body and cowboy-shot controls. B and D add only the terminal term `plain floor`. Requested realization means exact observed-category equality. Degradation means control realizes the requested category and treatment does not; improvement is the reverse. Neither-fits and both-fit pairs are unchanged.

| Pair | Degradation | Improvement | Unchanged | Lower edge wider | Tighter | Same |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| AB | 0/6 | 1/6 | 5/6 | 3/6 | 0/6 | 3/6 |
| CD | 0/6 | 0/6 | 6/6 | 1/6 | 1/6 | 4/6 |

Lower-edge ordering (tight to wide): upper_chest, chest, waist, pelvis, proximal_thigh, mid_thigh, distal_thigh, knee, lower_leg, feet, below_feet. This is a crop-boundary comparison, not a substitute for categorical realization or a claim of overall camera-distance change.

### AB matched seeds

| Seed | Control category | Treatment category | Realization change | Control lower edge | Treatment lower edge | Crop change |
| --- | --- | --- | --- | --- | --- | --- |
| 1389362108 | upper_body | upper_body | unchanged | pelvis | pelvis | same |
| 478894930 | close_up | upper_body | improvement | chest | waist | wider |
| 985206744 | upper_body | upper_body | unchanged | waist | waist | same |
| 407336407 | upper_body | upper_body | unchanged | waist | pelvis | wider |
| 209185824 | upper_body | upper_body | unchanged | waist | waist | same |
| 632588351 | upper_body | upper_body | unchanged | waist | pelvis | wider |

### CD matched seeds

| Seed | Control category | Treatment category | Realization change | Control lower edge | Treatment lower edge | Crop change |
| --- | --- | --- | --- | --- | --- | --- |
| 1389362108 | upper_body | upper_body | unchanged | proximal_thigh | pelvis | tighter |
| 478894930 | upper_body | upper_body | unchanged | proximal_thigh | proximal_thigh | same |
| 985206744 | upper_body | upper_body | unchanged | proximal_thigh | proximal_thigh | same |
| 407336407 | upper_body | upper_body | unchanged | proximal_thigh | proximal_thigh | same |
| 209185824 | upper_body | upper_body | unchanged | proximal_thigh | proximal_thigh | same |
| 632588351 | upper_body | upper_body | unchanged | pelvis | proximal_thigh | wider |

## Working Conclusion

**INCONCLUSIVE**

Provenance/manipulation are exactly recheckable for 24/24 panels; every arm has 6/6 assessable boundaries and 0/6 ambiguity/artifact. Prerequisites therefore pass. SINGLE_TERM_FRAMING_INTERFERENCE_SUPPORTED requires degradation >=5/6 in at least one pair; observed degradation is 0/6 in both. NO_MATERIAL_SINGLE_TERM_FRAMING_INTERFERENCE also requires treatment realization >=5/6 in both B and D and degradation <=1/6 in both pairs; D realizes cowboy_shot in 0/6, so that branch fails. Neither directional classification is admitted.

No evidence of single-term framing interference is admitted under the frozen rule. This is not NO_MATERIAL_SINGLE_TERM_FRAMING_INTERFERENCE. Archived CAM-024 upper-body control realized 6/6 and cowboy-shot control 5/6, versus current controls A 5/6 and C 0/6. This baseline shift limits the experiment, especially the cowboy-shot comparison; its cause is not established here. Six fresh matched seeds provide bounded directional evidence, not universal causal or absence-of-effect claims. Thresholds and visual ratings were not changed after observation.

## Provenance and Frozen Record

- Independent observation frozen before decode at 2026-09-07T00:38:27.6244640Z.
- Frozen record SHA-256: `967b7abf9713280d32dcf4c8e3af58247ed2d9d45e27a7b3510c67bd4ad1a650`.
- Mapping SHA-256: `f970ed3933d45f7b1cf2c1b51ee6e568f4cf7615af686451313b75a0d9475945`.
- Observer input SHA-256: `ec1dd6311382dc01b61096aee4b40a7be09734c340ef49632538ebf029a5e31d`.
- All three exact UTF-8 payloads are stored in CAM-028-A metadata; B/C/D reference that exact owner and hashes.
- Rechecks cover all 24 canonical/opaque image hashes and equal RGB pixels, matched seeds, complete request equality against returned parameters, archived CAM-024 non-treatment fields, parsed response info, checkpoint identity and structural infotext.
- Observer input used opaque condition/panel identity, hashes, rubric and pixels. Prompt, seed, requested category, treatment and run mapping were withheld until freeze.
- Fixed endpoint http://192.168.0.6:7860; no fallback, regeneration or retry.

## Concept Dictionary Impact

None; no Graph, PromptTag or dictionary promotion.

## Resolver Impact

None; no production, compiler, runtime, platform or schema changes.

## Next Experiment

Not assigned. No additional generation or new experiment design is included.
