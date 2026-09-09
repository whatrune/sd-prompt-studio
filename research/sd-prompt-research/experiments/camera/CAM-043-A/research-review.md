# CAM-043 Prompt-Blind Research Review

## Final Experiment Classification

**INCONCLUSIVE**

All 48 panels are provenance-valid and framing-assessable. Both the cowboy-shot control and the standing-split treatment realized cowboy-shot framing in 17/24 panels and tighter upper-body framing in 7/24. Across matched seeds, framing degradation=0, improvement=0, unchanged=24; crop widening=0, tightening=0, same-rank=24, unranked=0. The one-sided exact matched sign p-value is 1.0 because there are no discordant framing-realization pairs.

The pose manipulation prerequisite fails decisively: standing-split geometry is assessable in 0/24 treatment panels and strictly realized in 0/24. Both knees, the support foot, and the raised foot are outside the frame in 24/24 treatment panels. The control cowboy-shot prerequisite also narrowly fails at 17/24 versus the required 18/24. Therefore neither the material-interference rule nor the no-material-interference rule is admissible. The observed equal framing distributions do not establish absence of interference because the requested pose was never visibly assessable.

## Blinding and Provenance

- Panels: 48/48; missing or corrupt: 0.
- Exact checkpoint SHA-256, Euler a, Automatic, 20 steps, CFG 4.5, 1024x1024, and frozen settings: PASS.
- Ordered seeds, common prompt bytes, negative prompt, and settings are equal across both runs; CAM-043-B alone appends the exact terminal production phrase `standing split`.
- Request payload, raw response, `response.parameters`, parsed `response.info`, structural infotext, PNG metadata, PNG bytes, and decoded pixel bindings: PASS 48/48.
- Observer input exposed only opaque condition IDs, opaque panel IDs, image hashes, byte counts, and pixels.
- Canonical observer-input SHA-256: `6c4d5bdbe474e2d4465a423252827b679a39c3bde349f6857b374ae1a48d3232`.
- Frozen visual-observation SHA-256: `42c0396bef85b814bb7c31f9dda9c788cc39bd9a952ecf3dcc5790483a407019`.
- Sealed condition-mapping SHA-256: `b41889d0199909167be1b95898277166e3803d838b41cd95ed7e43040bcc24aa`.
- Canonical tracked blind-record owner: `research/sd-prompt-research/experiments/camera/CAM-043-A/source/CAM-043-A_metadata.yaml`.
- Mapping was decoded only after the 48-row visual record was frozen; no frozen observation changed after decode.

## Per-Arm Metrics

| Run | Exact PromptTag / phrase | Cowboy shot | Upper body | Framing assessable | Pose assessable | Strict standing split | Both knees visible | Both feet visible | Ambiguity / artifact |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| CAM-043-A | `cam-cowboy-shot` / `cowboy shot` | 17/24 | 7/24 | 24/24 | 0/24 | 0/24 | 0/24 | 0/24 | 1/24 |
| CAM-043-B | `v19-motion-y-balance` / `standing split`, with `cam-cowboy-shot` | 17/24 | 7/24 | 24/24 | 0/24 | 0/24 | 0/24 | 0/24 | 1/24 |

## Matched-Seed Analysis

| Endpoint | Degradation | Improvement | Unchanged | Wider | Tighter | Same rank | Unranked | One-sided exact p |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Treatment relative to control | 0 | 0 | 24 | 0 | 0 | 24 | 0 | 1.0 |

Every matched pair retained the same frozen framing category and lower crop boundary. These paired results are descriptive only because treatment pose assessability and strict-realization prerequisites fail.

## Required-Region Visibility

- Head: fully visible 23/24 and partially cropped 1/24 in each arm.
- Torso: fully visible 24/24 in each arm.
- Pelvis: fully visible 23/24 and partially visible 1/24 in each arm.
- Left knee, right knee, support foot, and raised foot: visible 0/24 in each arm.
- Standing-split realization: indeterminate because required regions are hidden, 24/24 in each arm.
- Framing ambiguity/artifact: one composition crop (panel 17) in each arm; no anatomy artifact recorded.

## Evidence Boundary

This result is limited to the exact checkpoint, prompt family, endpoint, settings, seeds, and tested production phrases. It does not establish semantic equivalence, behavior on another model or prompt family, or absence of an interaction when the pose is successfully realized. A differently framed follow-up would be a new Product decision and is not authorized by this Task.

## Research Boundary

CAM-043 changes no PromptTag, Concept Graph, compiler/advisory/UI/runtime, schema, workflow, platform, dependency, or production behavior.
