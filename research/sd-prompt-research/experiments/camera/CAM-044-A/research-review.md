# CAM-044 Prompt-Blind Research Review

## Final Experiment Classification

**NO_RELIABLE_STANDING_SPLIT_REALIZATION_ESTABLISHED**

All 48 panels are provenance-valid, framing-assessable, and pose-assessable. Full-body framing and direct visibility of the pelvis, both knees, support foot, and raised foot are present in 24/24 panels in each arm. The treatment strictly realizes standing-split geometry in only 1/24 panels. Across matched seeds, pose gain=1, regression=0, unchanged=23. These results satisfy every prerequisite but meet the predeclared no-reliable-realization branch: treatment strict realization and matched pose gain are both at most 4/24.

## Blinding and Provenance

- Panels: 48/48; missing or corrupt: 0.
- Exact checkpoint SHA-256, Euler a, Automatic, 20 steps, CFG 4.5, 1024x1024, and frozen settings: PASS.
- Ordered seeds, common prompt bytes, negative prompt, and settings are equal across both runs; CAM-044-B alone appends the exact terminal production phrase `standing split`.
- Request payload, raw response, `response.parameters`, parsed `response.info`, structural infotext, PNG metadata, PNG bytes, and decoded pixel bindings: PASS 48/48.
- Observer input exposed only opaque condition IDs, opaque panel IDs, image hashes, byte counts, and pixels.
- Canonical observer-input SHA-256: `f00fc9db713bb8fff7f486d58bab8e204f9ce4df8abff0a81be8571768efe9af`.
- Frozen visual-observation SHA-256: `2f07be58088d221eefcbdb3d3cd06278eecddd26ab5513c6547f96708b22b828`.
- Sealed condition-mapping SHA-256: `dbe0b46e005015627dd6565624d5df207990650f7d2c684647c5dda2bdd90abb`.
- Canonical tracked blind-record owner: `research/sd-prompt-research/experiments/camera/CAM-044-A/source/CAM-044-A_metadata.yaml`.
- Mapping was decoded only after the 48-row visual record was serialized and frozen; no frozen observation changed after decode.

## Per-Arm Metrics

| Run | Exact PromptTag / phrase | Full body | Framing assessable | Pose assessable | Strict standing split | Pelvis visible | Both knees visible | Both feet visible | Ambiguity / artifact |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| CAM-044-A | `cam-full-body` / `full body` | 24/24 | 24/24 | 24/24 | 0/24 | 24/24 | 24/24 | 24/24 | 0/24 |
| CAM-044-B | `v19-motion-y-balance` / `standing split`, with `cam-full-body` | 24/24 | 24/24 | 24/24 | 1/24 | 24/24 | 24/24 | 24/24 | 0/24 |

## Matched-Seed Analysis

| Endpoint | Degradation / regression | Improvement / gain | Unchanged | Wider | Tighter | Same rank | Unranked |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Strict standing-split realization | 0 | 1 | 23 | not applicable | not applicable | not applicable | not applicable |
| Full-body framing | 0 | 0 | 24 | 0 | 0 | 24 | 0 |

Only matched seed 2 changes from no strict split in the control to strict standing-split geometry in the treatment. The remaining 23 matched pairs do not strictly realize the pose in either arm. Every pair retains full-body framing and the same frozen framing rank.

## Required-Region Visibility

- Head, torso, pelvis, both knees, and both feet: directly visible 24/24 in each arm.
- Treatment standing-split realization: strict 1/24; not realized 23/24.
- Pose and framing assessability: 24/24 in each arm.
- Ambiguity/artifact: 0/24 in each arm.

## Evidence Boundary

This result is limited to the exact checkpoint, prompt family, endpoint, settings, seeds, and tested production phrases. It does not establish behavior on another model, prompt family, resolution, or sampling configuration. It establishes that adding the exact production `standing split` phrase to this full-body prompt does not reliably realize the strict pose on the frozen runtime.

## Research Boundary

CAM-044 changes no PromptTag, Concept Graph, compiler/advisory/UI/runtime, schema, workflow, platform, dependency, CAM-040, CAM-043, or production behavior.
