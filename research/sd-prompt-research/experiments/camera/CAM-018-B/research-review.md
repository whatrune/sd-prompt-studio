# CAM-018 Prompt-Blind Research Review

## Final Experiment Classification

**POSE_BODY_OCCLUSION_DOMINANT**

All 30 panels are independently provenance-valid and hand visibility is assessable. The low-occlusion reference shows both hands completely visible 5/6 and at least partially visible 6/6. The arms-behind condition hides both hands behind the body 6/6, producing a predeclared strong matched loss in 5/6 seeds relative to the reference. Neither the framing arm nor the long-sleeve arm loses complete bilateral hand visibility; both instead show complete hands 6/6. The CAM-017 calibration arm shows complete bilateral visibility 5/6, with its sole partial case coinciding with both arms moving behind the torso.

## Blinding and Provenance

- Panels: 30/30; missing or corrupt: 0.
- Exact model/hash, Euler a, Automatic, 20 steps, CFG 4.5, 1024x1024, and frozen settings: PASS.
- Ordered seeds and negative prompts are equal across all runs; A/B, A/C, and A/D each change only the declared factor terms.
- `response.parameters`, parsed `response.info`, structural infotext, and PNG bindings: PASS 30/30.
- Observer input contained only opaque condition IDs, opaque panel IDs, image hashes, and pixels.
- Canonical observer-input SHA-256: `7632aff4ef25e8b5242bfaad25f8ddc294b146874afe401afcc553202ebf789c`.
- Frozen visual observation SHA-256: `68a8b9d930f84e0171761eaace03d633fcc1395496bf70c318d22a0fb5ed77e6`.
- Sealed condition mapping SHA-256: `8ec7745d2e79eac28cffa06bfb7209abd8362aa665243c861cc2cfcc7456b7c0`.
- Canonical tracked blind-record owner: `research/sd-prompt-research/experiments/camera/CAM-018-A/source/CAM-018-A_metadata.yaml`.
- Mapping was decoded only after the visual record was frozen; no frozen row or evidence note changed after decode.

## Per-Arm Metrics

| Run | Factor | Both hands fully visible | Both at least partially visible | Assessable | Ambiguity/artifact | Direct occlusion evidence |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| CAM-018-A | low-occlusion reference | 5/6 | 6/6 | 6/6 | 0/6 | one bilateral frame crop |
| CAM-018-B | framing | 6/6 | 6/6 | 6/6 | 0/6 | no hand-frame contact |
| CAM-018-C | pose/body occlusion | 0/6 | 0/6 | 6/6 | 0/6 | body occlusion 6/6 |
| CAM-018-D | clothing occlusion | 6/6 | 6/6 | 6/6 | 0/6 | garment hand cover 0/6 |
| CAM-018-E | CAM-017 calibration | 5/6 | 6/6 | 6/6 | 1/6 | body occlusion 1/6 |

## Matched-Seed Attribution

| Comparison | Reference has complete bilateral visibility and limited arm does not | Result |
| --- | ---: | --- |
| A to B, framing | 0/6 | no supported framing limitation in realized panels |
| A to C, pose/body occlusion | 5/6 | strong support |
| A to D, clothing occlusion | 0/6 | no supported clothing limitation in realized panels |

CAM-018-E differs from the immediate CAM-017 result (historical complete bilateral visibility 3/6) by reaching 5/6 on fresh seeds. Its only partial case remains directly associated with arms moving behind the body, supporting seed-dependent arm placement as the immediate failure route rather than nominal framing.

## Threshold Application

- Provenance/panel completeness 30/30: PASS.
- Hand assessability at least 5/6 and ambiguity/artifact at most 1/6: PASS for all arms.
- Reference complete bilateral visibility at least 5/6: PASS at 5/6.
- Strong boundary support requires at least 5/6 matched reference-to-limited loss: pose/body occlusion PASS at 5/6; framing and clothing FAIL at 0/6.
- Exactly one boundary satisfies the predeclared strong criterion, so `POSE_BODY_OCCLUSION_DOMINANT` is admitted.
- The clothing prompt did not visibly cover either hand in any panel; the 0/6 result does not establish that garments can never occlude hands, only that clothing was not the limiting owner in these realized panels.

## Research Boundary

CAM-018 changes no PromptTag, camera/pose/clothing slot, Concept Graph, compiler/runtime, production advisory, UI, schema, workflow, platform, or production behavior. Product and Graph decisions remain deferred.
