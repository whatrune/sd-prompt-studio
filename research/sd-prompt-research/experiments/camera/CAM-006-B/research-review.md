# CAM-006 Prompt-Blind Research Review

## Final Experiment Classification

**PARTIAL_CAMERA_ANGLE_DISCRIMINATION**

The neutral shared prompt removed the CAM-005 aircraft composition artifact and produced assessable evidence in 18/18 panels. Low angle and high angle each expressed their requested direction in 6/6 panels. Eye level expressed the requested level direction in 4/6 panels, with one low-angle-like and one high-angle-like result. All three predeclared matched-seed directional comparisons pass at 5/6 or better, so the clean replication supports stable discrimination for low versus high angle but does not support fully stable eye-level discrimination.

## Blinding and Provenance

- Panels: 18/18; missing or corrupt: 0.
- Exact model/hash, Euler a, Automatic, 20 steps, CFG 4.5, 1024×1024, and frozen settings: PASS.
- Across runs, the only positive-prompt difference is the terminal camera-angle phrase; negative prompts and ordered seeds are equal.
- response.parameters, parsed response.info, structural infotext, and PNG bindings: PASS 18/18.
- Observer input contained only opaque condition IDs, opaque panel IDs, and pixels; requested angle, run mapping, prompt terms, and seeds were unavailable.
- Frozen visual observation SHA-256: 62daabcad6bf3749064c53d6f118e91ccc748925b161288d2b0e0948bb37d624.
- Sealed condition mapping SHA-256: fbc16a124063be9a461d85baab154dfd3b15b680ed9a85cf182ff4474f38e9a5.
- Canonical tracked blind-record owner: `research/sd-prompt-research/experiments/camera/CAM-006-A/source/CAM-006-A_metadata.yaml`; its exact UTF-8 freeze and mapping payloads independently rehash to the recorded identities.
- Condition mapping was decoded only after the visual record was frozen; no frozen visual row was changed after decode.

## Per-Arm Metrics

| Run | Requested angle | Requested direction visible | Angle assessable | Ambiguity/artifact | Full body |
| --- | --- | ---: | ---: | ---: | ---: |
| CAM-006-A | eye level | 4/6 | 6/6 | 0/6 | 6/6 |
| CAM-006-B | low angle | 6/6 | 6/6 | 0/6 | 6/6 |
| CAM-006-C | high angle | 6/6 | 6/6 | 1/6 composition artifact | 5/6 visible, 1/6 partial |

## Matched-Seed Directional Discrimination

| Comparison | Requested directional shift | Same/unclear | Reverse |
| --- | ---: | ---: | ---: |
| eye level → low angle | 5/6 | 1/6 | 0/6 |
| eye level → high angle | 5/6 | 1/6 | 0/6 |
| low angle ↔ high angle opposite evidence | 6/6 | 0/6 | 0/6 |

All prerequisites pass: each arm is assessable 6/6, ambiguity/artifact is at most 1/6, and every matched directional comparison is at least 5/6. The confirmed branch is not met because eye level reaches only 4/6 requested-direction evidence. Thresholds were not adjusted after observation.

## CAM-005 Confound Check

No aircraft, vehicle, prop, furniture, or background-object composition artifact was observed in any of the 18 panels. One high-angle panel was partially cropped and recorded as a composition artifact, within the predeclared 1/6 allowance. The CAM-005 shared-prompt confound is therefore removed in this replication.

## Repository Reality and Research Boundary

At this exact base, low angle and high angle are production PromptTags, while eye level is a canonical camera_vertical_angle slot prompt without a standalone PromptTag entry. CAM-006 changes no PromptTag, slot, Concept Graph, compiler/runtime, production advisory, UI, schema, or platform behavior. Production and Concept Graph decisions remain deferred.
