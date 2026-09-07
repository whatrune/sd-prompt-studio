# CAM-030-C Research Review

## Observed

Post-decode mechanical comparison of the frozen independent visual record. Framing-boundary confidence is subjective.

| Run | Requested category | Realization | Assessable | Ambiguity/artifact |
| --- | --- | ---: | ---: | ---: |
| CAM-030-A | upper_body | 1/6 | 6/6 | 0/6 |
| CAM-030-B | upper_body | 0/6 | 6/6 | 0/6 |
| CAM-030-C | cowboy_shot | 5/6 | 6/6 | 0/6 |
| CAM-030-D | cowboy_shot | 5/6 | 6/6 | 0/6 |

## Interpretation

A and C are exact CAM-024 upper-body and cowboy-shot controls. B and D add only the terminal term `empty seamless studio`. Requested realization means exact observed-category equality. Degradation means control realizes the requested category and treatment does not; improvement is the reverse. Neither-fits and both-fit pairs are unchanged.

| Pair | Degradation | Improvement | Unchanged | Lower edge wider | Tighter | Same |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| AB | 1/6 | 0/6 | 5/6 | 0/6 | 1/6 | 5/6 |
| CD | 0/6 | 0/6 | 6/6 | 2/6 | 0/6 | 4/6 |

Lower-edge ordering (tight to wide): upper_chest, chest, waist, pelvis, proximal_thigh, mid_thigh, distal_thigh, knee, lower_leg, feet, below_feet. Crop widening/tightening is reported separately and is not substituted for categorical realization.

### AB matched seeds

| Seed | Control category | Treatment category | Realization change | Control lower edge | Treatment lower edge | Crop change |
| --- | --- | --- | --- | --- | --- | --- |
| 455880450 | close_up | close_up | unchanged | chest | chest | same |
| 871407871 | upper_body | close_up | degradation | waist | chest | tighter |
| 1136385443 | close_up | close_up | unchanged | chest | chest | same |
| 2108457294 | close_up | close_up | unchanged | chest | chest | same |
| 1011778023 | close_up | close_up | unchanged | chest | chest | same |
| 1158171032 | close_up | close_up | unchanged | chest | chest | same |

### CD matched seeds

| Seed | Control category | Treatment category | Realization change | Control lower edge | Treatment lower edge | Crop change |
| --- | --- | --- | --- | --- | --- | --- |
| 455880450 | cowboy_shot | cowboy_shot | unchanged | proximal_thigh | proximal_thigh | same |
| 871407871 | upper_body | upper_body | unchanged | pelvis | pelvis | same |
| 1136385443 | cowboy_shot | cowboy_shot | unchanged | proximal_thigh | mid_thigh | wider |
| 2108457294 | cowboy_shot | cowboy_shot | unchanged | mid_thigh | mid_thigh | same |
| 1011778023 | cowboy_shot | cowboy_shot | unchanged | mid_thigh | mid_thigh | same |
| 1158171032 | cowboy_shot | cowboy_shot | unchanged | proximal_thigh | mid_thigh | wider |

## Working Conclusion

**INCONCLUSIVE**

Provenance and manipulation are independently recheckable for 24/24 panels; every arm has 6/6 assessable boundaries and 0/6 ambiguity/artifact, so the prerequisites pass. SINGLE_TERM_FRAMING_INTERFERENCE_SUPPORTED requires degradation >=5/6 in at least one pair; AB has 1/6 and CD has 0/6. NO_MATERIAL_SINGLE_TERM_FRAMING_INTERFERENCE requires treatment realization >=5/6 in both B and D and degradation <=1/6 in each pair. D realizes cowboy_shot in 5/6 and both degradation ceilings pass, but B realizes upper_body in 0/6. The mechanically required classification is therefore INCONCLUSIVE.

The upper-body control realizes upper_body in only 1/6, so these seeds cannot distinguish a material treatment effect from baseline instability in that stratum. The cowboy-shot pair realizes cowboy_shot in 5/6 in both arms with zero degradation; treatment lower edges are wider in 2/6 and otherwise equal. This bounded result neither supports framing interference from `empty seamless studio` nor establishes its universal absence.

## Provenance and Frozen Record

- Independent observation SHA-256: `64d965b3d683de056deeab742db8f506ed27660db6555ff6fa0ee4af73456d14`.
- Observer input SHA-256: `303a5ec01057125943d10e3e960dfd95e2f8653630c1aee07c9bd0d8279bee20`.
- Sealed mapping SHA-256: `a7dbcc03f765e9c07d047c979c9caf36ea7ebc2cd6562029bc700d9f5da4a9ae`.
- Frozen at `2026-09-07T06:38:50.9830061Z` before decode at `2026-09-07T06:41:30.9904428Z`.
- All exact UTF-8 payloads are stored in CAM-030-A metadata; B/C/D reference that owner and all three hashes.
- Rechecks cover all 24 canonical/opaque hashes and equal pixels, matched seeds, returned parameters, parsed response info, checkpoint identity, and scheduler infotext.
- Fixed endpoint `http://192.168.0.6:7860`; no fallback, regeneration, or retry.

## Concept Dictionary Impact

None; no Graph, PromptTag, dictionary, compiler, runtime, schema, UI, or platform change.
