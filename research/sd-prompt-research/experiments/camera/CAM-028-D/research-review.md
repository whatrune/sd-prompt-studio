# CAM-028-D Research Review

## Observed

Post-decode mechanical comparison of the frozen independent visual record. Framing-boundary confidence is subjective. The independent prompt-blind re-review corrected ten category labels under the archived rubric convention; all other visual values, evidence notes and confidence are unchanged.

| Run | Requested category | Realization | Assessable | Ambiguity/artifact |
| --- | --- | ---: | ---: | ---: |
| CAM-028-A | upper_body | 5/6 | 6/6 | 0/6 |
| CAM-028-B | upper_body | 6/6 | 6/6 | 0/6 |
| CAM-028-C | cowboy_shot | 5/6 | 6/6 | 0/6 |
| CAM-028-D | cowboy_shot | 5/6 | 6/6 | 0/6 |

## Interpretation

A and C are the exact upper-body and cowboy-shot controls. B and D add only the terminal term `plain floor`. Requested realization means exact observed-category equality. Degradation means control realizes the requested category and treatment does not; improvement is the reverse. Neither-fits and both-fit pairs are unchanged.

| Pair | Degradation | Improvement | Unchanged | Lower edge wider | Tighter | Same |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| AB | 0/6 | 1/6 | 5/6 | 3/6 | 0/6 | 3/6 |
| CD | 1/6 | 1/6 | 4/6 | 1/6 | 1/6 | 4/6 |

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
| 1389362108 | cowboy_shot | upper_body | degradation | proximal_thigh | pelvis | tighter |
| 478894930 | cowboy_shot | cowboy_shot | unchanged | proximal_thigh | proximal_thigh | same |
| 985206744 | cowboy_shot | cowboy_shot | unchanged | proximal_thigh | proximal_thigh | same |
| 407336407 | cowboy_shot | cowboy_shot | unchanged | proximal_thigh | proximal_thigh | same |
| 209185824 | cowboy_shot | cowboy_shot | unchanged | proximal_thigh | proximal_thigh | same |
| 632588351 | upper_body | cowboy_shot | improvement | pelvis | proximal_thigh | wider |

## Working Conclusion

**NO_MATERIAL_SINGLE_TERM_FRAMING_INTERFERENCE**

Provenance/manipulation are exactly recheckable for 24/24 panels; every arm has 6/6 assessable boundaries and 0/6 ambiguity/artifact. Prerequisites therefore pass. SINGLE_TERM_FRAMING_INTERFERENCE_SUPPORTED requires degradation >=5/6 in at least one pair; AB has 0/6 and CD has 1/6, so that branch fails. NO_MATERIAL_SINGLE_TERM_FRAMING_INTERFERENCE requires treatment realization >=5/6 in both B and D and degradation <=1/6 in both pairs. B realizes upper_body in 6/6 and D realizes cowboy_shot in 5/6; both degradation limits pass. The predeclared no-material branch is admitted without changing thresholds.

This bounded result does not establish universal absence of an effect. Lower-edge widening remains present in AB 3/6 and CD 1/6; CD also tightens in 1/6. Widening alone is not lost requested-category realization. Archived CAM-024 controls realized upper_body 6/6 and cowboy_shot 5/6, compared with current A 5/6 and C 5/6. Six fresh matched seeds remain directional evidence with subjective boundary confidence.

## Same-Task Blind Category Correction

One correction from PR HEAD 835bcfffe213296773d5ef04d72bcede1b677185 addresses discussion_r3945881410. A fresh independent prompt-blind observer rechecked all 24 opaque PNGs using the existing archived rubric convention and corrected only ten observed_framing values from upper_body to cowboy_shot: CAM-028-C panels 1-5 and CAM-028-D panels 2-6, each retaining lower_crop_boundary proximal_thigh. No prompts, seeds, run mapping or decoded result were provided to that observer.

All other frozen fields, evidence notes, artifacts and confidence are unchanged. Generated images, prompts, settings, seeds, runtime identity, observer input, sealed mapping and frozen design thresholds are unchanged; no regeneration occurred. Original freeze SHA-256 967b7abf9713280d32dcf4c8e3af58247ed2d9d45e27a7b3510c67bd4ad1a650 remains unchanged in scratch and the prior commit preserves its historical canonical owner. The corrected freeze is the sole current canonical blind owner; no additional provenance schema or record type is introduced.

The prior INCONCLUSIVE result and C/D 0/6 categorical realization are superseded by this independently corrected category dataset. This is a rubric-category correction, not evidence of a changed generation outcome. Correction-notes SHA-256: 8b59ed66aebd156a1028c31a13e5c111ce1b8f5b5d733fb0e831c98d5c9f1b6b.

## Provenance and Frozen Record

- Independent observation frozen before decode at 2026-09-07T01:11:55.7191223Z.
- Frozen record SHA-256: `5cf78db4f61c5d03890013d41ca937eb8129d021d9e45dfa2ee5bceecde6b312`.
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
