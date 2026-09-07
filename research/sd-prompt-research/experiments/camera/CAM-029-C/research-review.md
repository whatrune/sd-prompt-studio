# CAM-029-C Research Review

## Observed

Post-decode mechanical comparison of the frozen independent visual record. Framing-boundary confidence is subjective.

| Run | Requested category | Realization | Assessable | Ambiguity/artifact |
| --- | --- | ---: | ---: | ---: |
| CAM-029-A | upper_body | 0/6 | 6/6 | 0/6 |
| CAM-029-B | upper_body | 1/6 | 6/6 | 0/6 |
| CAM-029-C | cowboy_shot | 6/6 | 6/6 | 0/6 |
| CAM-029-D | cowboy_shot | 6/6 | 6/6 | 0/6 |

## Interpretation

A and C are the exact CAM-024 upper-body and cowboy-shot controls. B and D add only the terminal term `eye level`. Requested realization means exact observed-category equality. Degradation means control realizes the requested category and treatment does not; improvement is the reverse. Neither-fits and both-fit pairs are unchanged.

| Pair | Degradation | Improvement | Unchanged | Lower edge wider | Tighter | Same |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| AB | 0/6 | 1/6 | 5/6 | 1/6 | 0/6 | 5/6 |
| CD | 0/6 | 0/6 | 6/6 | 0/6 | 0/6 | 6/6 |

Lower-edge ordering (tight to wide): upper_chest, chest, waist, pelvis, proximal_thigh, mid_thigh, distal_thigh, knee, lower_leg, feet, below_feet. This is a crop-boundary comparison, not a substitute for categorical realization or a claim of overall camera-distance change.

### AB matched seeds

| Seed | Control category | Treatment category | Realization change | Control lower edge | Treatment lower edge | Crop change |
| --- | --- | --- | --- | --- | --- | --- |
| 1803716477 | close_up | close_up | unchanged | chest | chest | same |
| 828508774 | close_up | close_up | unchanged | chest | chest | same |
| 1283939529 | close_up | upper_body | improvement | chest | waist | wider |
| 1452035006 | close_up | close_up | unchanged | chest | chest | same |
| 130603300 | close_up | close_up | unchanged | chest | chest | same |
| 500206247 | close_up | close_up | unchanged | chest | chest | same |

### CD matched seeds

| Seed | Control category | Treatment category | Realization change | Control lower edge | Treatment lower edge | Crop change |
| --- | --- | --- | --- | --- | --- | --- |
| 1803716477 | cowboy_shot | cowboy_shot | unchanged | mid_thigh | mid_thigh | same |
| 828508774 | cowboy_shot | cowboy_shot | unchanged | mid_thigh | mid_thigh | same |
| 1283939529 | cowboy_shot | cowboy_shot | unchanged | proximal_thigh | proximal_thigh | same |
| 1452035006 | cowboy_shot | cowboy_shot | unchanged | mid_thigh | mid_thigh | same |
| 130603300 | cowboy_shot | cowboy_shot | unchanged | mid_thigh | mid_thigh | same |
| 500206247 | cowboy_shot | cowboy_shot | unchanged | mid_thigh | mid_thigh | same |

## Working Conclusion

**INCONCLUSIVE**

Provenance and manipulation are independently recheckable for 24/24 panels; every arm has 6/6 assessable boundaries and 0/6 ambiguity/artifact, so the shared prerequisites pass. SINGLE_TERM_FRAMING_INTERFERENCE_SUPPORTED requires degradation >=5/6 in at least one pair; AB and CD both have 0/6, so that branch fails. NO_MATERIAL_SINGLE_TERM_FRAMING_INTERFERENCE requires treatment realization >=5/6 in both B and D and degradation <=1/6 in both pairs. D realizes cowboy_shot in 6/6, but B realizes upper_body in only 1/6, so the no-material branch also fails. The mechanically required classification is therefore INCONCLUSIVE.

The upper-body control A itself realizes upper_body in 0/6 (all six are close_up), while B realizes it in 1/6. Consequently these fresh matched seeds cannot distinguish absence of eye-level interference from baseline instability in the upper-body stratum. The cowboy-shot pair is stable at 6/6 in both C and D with identical lower edges in 6/6. This bounded result neither supports framing interference from `eye level` nor establishes its universal absence. Six fresh matched seeds remain directional evidence with subjective boundary confidence.

## Provenance and Frozen Record

- Independent observation frozen before decode at 2026-09-07T02:24:19.6709250Z.
- Frozen record SHA-256: `5539073977f5afaf1232a537e753ebf6c6efb63225c90d8353fbee7270900520`.
- Mapping SHA-256: `1b2793dec105b583d693cd54dc34db8135b9ec50af19f4068fc1652e10fbfd46`.
- Observer input SHA-256: `918a9ecddacc29f111cebbdc63a950cf51febee15ddb6bcb3adbb5256cb87a6a`.
- All three exact UTF-8 payloads are stored in CAM-029-A metadata; B/C/D reference that exact owner and hashes.
- Rechecks cover all 24 canonical/opaque image hashes and equal RGB pixels, matched seeds, complete request equality against returned parameters, parsed response info, checkpoint identity and structural infotext.
- Observer input used only opaque panel identity, hashes, rubric and pixels. Prompt, seed, requested category, treatment and run mapping were withheld until freeze.
- Fixed endpoint http://192.168.0.6:7860; no fallback, regeneration or retry.

## Concept Dictionary Impact

None; no Graph, PromptTag or dictionary promotion.

## Resolver Impact

None; no production, compiler, runtime, platform or schema changes.

## Next Experiment

Not assigned. No additional generation or new experiment design is included.
