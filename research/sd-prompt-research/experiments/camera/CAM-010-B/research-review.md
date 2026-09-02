# CAM-010 Prompt-Blind Research Review

## Final Experiment Classification

**PARTIAL_SUBJECT_ORIENTATION_DISCRIMINATION**

All 18 panels are independently provenance-valid, orientation-assessable, full-body visible, and free of recorded ambiguity/artifact. `facing viewer` produced the strict frontal composite in 6/6 panels. `profile` produced a profile face in 6/6, but the strict lateral-torso plus profile-face composite in only 1/6. `facing away` produced the strict rear composite in 6/6. The experiment therefore supports stable front/rear separation while the middle `profile` arm does not establish stable whole-subject lateral orientation.

## Blinding and Provenance

- Panels: 18/18; missing or corrupt: 0.
- Exact model/hash, Euler a, Automatic, 20 steps, CFG 4.5, 1024x1024, and frozen settings: PASS.
- Across runs, the only positive-prompt difference is the terminal subject-orientation phrase; negative prompts and ordered seeds are equal.
- response.parameters, parsed response.info, structural infotext, and PNG bindings: PASS 18/18.
- Observer input contained only opaque condition IDs, opaque panel IDs, and pixels.
- Canonical observer-input SHA-256: `c4daff15d8b0c0cd319b660d5a4b0741050583f125b496e19c6982fe71729e88`.
- Frozen visual observation SHA-256: `a951214a8f0dc7802325bec5d3cabcbee094e73aaa912a7f846cc1950c3f2245`.
- Sealed condition mapping SHA-256: `fae39f1c21fcb36ff3368a853ebfbb72886ce00256493e4ce3a2db14c8415557`.
- Canonical tracked blind-record owner: `research/sd-prompt-research/experiments/camera/CAM-010-A/source/CAM-010-A_metadata.yaml`.
- Condition mapping was decoded only after the visual record was frozen; no frozen visual row changed after decode.

## Per-Arm Metrics

| Run | Phrase | Strict requested composite | Torso evidence | Face evidence | Back visible | Assessable | Ambiguity/artifact | Full body |
| --- | --- | ---: | --- | --- | ---: | ---: | ---: | ---: |
| CAM-010-A | `facing viewer` | 6/6 | {'frontal': 6} | {'frontal': 6} | 0/6 | 6/6 | 0/6 | 6/6 |
| CAM-010-B | `profile` | 1/6 | {'frontal': 3, 'lateral': 1, 'three_quarter': 2} | {'profile': 6} | 0/6 | 6/6 | 0/6 | 6/6 |
| CAM-010-C | `facing away` | 6/6 | {'rear': 6} | {'rear_or_hidden': 6} | 6/6 | 6/6 | 0/6 | 6/6 |

## Matched-Seed Discrimination

| Comparison | Visibly distinct composite orientation |
| --- | ---: |
| facing viewer vs profile | 6/6 |
| profile vs facing away | 6/6 |
| facing viewer vs facing away | 6/6 |

The positive partial branch is admitted because all prerequisites pass, `facing viewer` and `facing away` each meet the strict 5/6 stability threshold, and their matched distinction is at least 5/6. The `profile` arm is not promoted as stable whole-subject lateral orientation: its face is profile in 6/6, but its torso is lateral in only 1/6.

## Production Reality Boundary

This Task tested the exact research phrases `facing viewer`, `profile`, and `facing away`. Production owns `front view` and `side view` in the `subject_orientation` slot, emits `rear view` for its rear-facing tag, and separately contains a `profile` camera tag. CAM-010 evidence must not be attached to different production phrases or used for a production decision without a later Architecture review.

## Research Boundary

CAM-010 changes no PromptTag, `subject_orientation` slot, Concept Graph, compiler/runtime, production advisory, UI, schema, platform, or production behavior.
