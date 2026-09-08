# CAM-039 Prompt-Blind Research Review

## Final Experiment Classification

**BEHIND_BODY_HAND_VISIBILITY_REDUCTION_REPLICATED**

All 48 panels are provenance-valid and hand visibility is assessable. The low-occlusion reference `rin-arms-at-sides` (`arms at sides`) realizes the requested placement and complete bilateral hand visibility in 24/24 panels. The behind-body treatment `pos-hands-behind-back` (`hands behind back`) realizes the requested placement in 24/24 panels, but complete bilateral hand visibility falls to 0/24; both hands are hidden by direct body occlusion in 24/24. Across the 24 matched seeds, degradation is 24, improvement is 0, and the predeclared one-sided exact McNemar/sign p-value is 0.000000059604644775390625.

## Blinding and Provenance

- Panels: 48/48; missing or corrupt: 0.
- Exact checkpoint SHA-256, Euler a, Automatic, 20 steps, CFG 4.5, 1024x1024, and frozen settings: PASS.
- Ordered seeds, common prompt bytes, negative prompt, and settings are equal across both runs; only the declared arm-placement phrase differs.
- `response.parameters`, parsed `response.info`, structural infotext, and PNG bindings: PASS 48/48.
- Observer input exposed only opaque condition IDs, opaque panel IDs, image hashes, and pixels.
- Canonical observer-input SHA-256: `39a44abfc2dcc5bf8daf1c5142b4d37dbee4a32fcaae37df68a963da6d9eb470`.
- Frozen visual-observation SHA-256: `2b4ae59016596cef0c84a9c54e2fbd2ec6d4fa4c01d1f49f5f2a47641d802bad`.
- Sealed condition-mapping SHA-256: `0201c2ca8c70eb0aa36a5ac13cd3820556b5bbc4a77879c3ad61ed8169fc8f17`.
- Canonical tracked blind-record owner: `research/sd-prompt-research/experiments/camera/CAM-039-A/source/CAM-039-A_metadata.yaml`.
- Mapping was decoded only after the 48-row visual record was frozen; no frozen observation changed after decode.

## Per-Arm Metrics

| Run | Exact PromptTag / phrase | Requested placement realized | Both hands fully visible | Partial hand visibility | Both hands not visible | Direct bilateral body occlusion | Assessable | Ambiguity/artifact |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| CAM-039-A | `rin-arms-at-sides` / `arms at sides` | 24/24 | 24/24 | 0/24 | 0/24 | 0/24 | 24/24 | 0/24 |
| CAM-039-B | `pos-hands-behind-back` / `hands behind back` | 24/24 | 0/24 | 0/24 | 24/24 | 24/24 | 24/24 | 0/24 |

## Matched-Seed Analysis

| Endpoint | Degradation A complete / B not | Improvement B complete / A not | Ties | One-sided exact p |
| --- | ---: | ---: | ---: | ---: |
| Complete bilateral hand visibility | 24 | 0 | 0 | 0.000000059604644775390625 |

The predeclared prerequisites all pass: exact runtime/provenance PASS, assessability 24/24 per arm, ambiguity/artifact 0/24 per arm, and requested placement realization 24/24 per arm. B is strictly lower than A, degradation exceeds improvement, and the one-sided exact paired test is below 0.05. The bounded result therefore supports material behind-body hand-visibility reduction under this exact prompt family, checkpoint, and runtime.

## Evidence Boundary

This high-sample replication reinforces the CAM-018/CAM-019 observation that the tested hands-behind-body pose is a strong bilateral hand-visibility risk through direct body overlap. It does not establish universal causality, behavior for another model or prompt family, a hard visibility guarantee, or a generalized rule for other behind-body poses.

## Recommended Next Step

The evidence is strong enough to recommend a separate bounded Concept Graph reinforcement Task for the existing hand-visibility and pose/body-overlap evidence owners. This Task itself changes no Concept Graph or production state.

## Research Boundary

CAM-039 changes no PromptTag, Concept Graph, compiler/advisory/UI/runtime, schema, workflow, platform, or production behavior.
