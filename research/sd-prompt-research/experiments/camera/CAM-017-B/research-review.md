# CAM-017 Prompt-Blind Research Review

## Final Experiment Classification

**INCONCLUSIVE**

All 18 panels are independently provenance-valid and region visibility is directly assessable. The head-visible arm shows the complete head 6/6, and the feet-visible arm shows both complete feet 6/6. The hands-visible arm shows both hands fully visible only 3/6 and both hands at least partially visible only 4/6; ambiguity/artifact is 2/6, above the predeclared maximum of 1/6. Because the hands-treatment prerequisite fails, the experiment cannot claim stable three-way discrimination, partial intended discrimination, or no meaningful effect.

## Blinding and Provenance

- Panels: 18/18; missing or corrupt: 0.
- Exact model/hash, Euler a, Automatic, 20 steps, CFG 4.5, 1024x1024, and frozen settings: PASS.
- Across runs, the only positive-prompt difference is the terminal requested-region instruction; negative prompts and ordered seeds are equal.
- `response.parameters`, parsed `response.info`, structural infotext, and PNG bindings: PASS 18/18.
- Observer input contained only opaque condition IDs, opaque panel IDs, image hashes, and pixels.
- Canonical observer-input SHA-256: `2e9f6968e21a7a1a06482cd72c8a5d75baaf988c2e33f042222396fd5ef98cc4`.
- Frozen visual observation SHA-256: `6d92d2432c0f0ffd82f36f74a371654464ca714464268919d0ebd8cc9945f687`.
- Sealed condition mapping SHA-256: `2ab63e78298b051daa5c20c2b9bdcf2c85c57289d5fb624d924bf2f90a15cb56`.
- Canonical tracked blind-record owner: `research/sd-prompt-research/experiments/camera/CAM-017-A/source/CAM-017-A_metadata.yaml`.
- Mapping was decoded only after the visual record was frozen; no frozen visual row changed after decode.

## Per-Arm Metrics

| Run | Requested region | Full requested-region visibility | At least partial requested-region visibility | Assessable | Ambiguity/artifact |
| --- | --- | ---: | ---: | ---: | ---: |
| CAM-017-A | head | 6/6 | 6/6 | 6/6 | 0/6 |
| CAM-017-B | both hands | 3/6 | 4/6 | 6/6 | 2/6 |
| CAM-017-C | both feet | 6/6 | 6/6 | 6/6 | 2/6 |

## Matched-Seed Region Discrimination

| Comparison | Different five-region visibility signature |
| --- | ---: |
| head-visible to hands-visible | 2/6 |
| hands-visible to feet-visible | 2/6 |
| head-visible to feet-visible | 2/6 |

The matched arms are dominated by the same fully contained composition. Visible hand changes occur principally through arm placement and overlap rather than a stable condition-specific body-region boundary.

## Threshold Application

- Provenance/panel completeness 18/18: PASS.
- Region assessability at least 5/6: PASS for all arms.
- Ambiguity/artifact at most 1/6: PASS for CAM-017-A; FAIL for CAM-017-B and CAM-017-C at 2/6.
- Stable requested-region support at least 5/6: PASS for head and feet; FAIL for both hands at 3/6 fully visible and 4/6 at least partially visible.
- Intended matched-seed discrimination at least 5/6: FAIL; every pair differs in only 2/6 seeds.
- The failed hands-treatment prerequisite requires `INCONCLUSIVE`; suppression, stable discrimination, partial intended discrimination, and no-meaningful-effect conclusions are not claimed.

## Research Boundary

CAM-017 changes no PromptTag, camera slot, Concept Graph, compiler/runtime, production advisory, UI, schema, workflow, platform, or production behavior. Product and Graph decisions remain deferred.
