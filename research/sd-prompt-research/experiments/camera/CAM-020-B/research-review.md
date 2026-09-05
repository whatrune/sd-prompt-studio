# CAM-020 Prompt-Blind Research Review

## Final Experiment Classification

**SPECIFIC_REPLACEMENT_SUGGESTION_SUPPORTED**

All 12 panels are independently provenance-valid and hand visibility is assessable. The `hands behind back` risk reference realizes its requested placement in 6/6 panels and hides both hands through direct body occlusion in 6/6. The exact production candidate `rin-arms-at-sides` (`arms at sides`) realizes its requested placement and shows complete bilateral hands in 6/6 panels. The candidate improves complete bilateral hand visibility over the matched risk reference in 6/6 seeds, with ambiguity/artifact 0/6.

## Blinding and Provenance

- Panels: 12/12; missing or corrupt: 0.
- Exact model/hash, Euler a, Automatic, 20 steps, CFG 4.5, 1024x1024, and frozen settings: PASS.
- Ordered seeds, common prompt bytes, and negative prompts are equal across both runs; only the declared arm-placement phrase differs.
- `response.parameters`, parsed `response.info`, structural infotext, and PNG bindings: PASS 12/12.
- Observer input contained only opaque condition IDs, opaque panel IDs, image hashes, and pixels.
- Canonical observer-input SHA-256: `33c7a86f1a5d576bba6bd9ea7233d2f5a4055da15f7ab942de71b671dd571749`.
- Frozen visual observation SHA-256: `d2bdb721e6740869f901a87b65b97983ead3ab7ff672618c5ff00a0e23ca8f24`.
- Sealed condition mapping SHA-256: `c989a852b5bdb41ea45b74de1dd258ef5cab4e6720541065d58fb697c54b3ee6`.
- Canonical tracked blind-record owner: `research/sd-prompt-research/experiments/camera/CAM-020-A/source/CAM-020-A_metadata.yaml`.
- Mapping was decoded only after the visual record was frozen; no frozen row or evidence note changed after decode.

## Per-Arm Metrics

| Run | Exact PromptTag / phrase | Requested placement realized | Both hands fully visible | Partial hand visibility | Both hands not visible | Direct bilateral body occlusion | Assessable | Ambiguity/artifact |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| CAM-020-A | `pos-hands-behind-back` / `hands behind back` | 6/6 | 0/6 | 0/6 | 6/6 | 6/6 | 6/6 | 0/6 |
| CAM-020-B | `rin-arms-at-sides` / `arms at sides` | 6/6 | 6/6 | 0/6 | 0/6 | 0/6 | 6/6 | 0/6 |

## Matched-Seed Result

| Comparison | B complete bilateral while A does not | B requested placement realized | Result |
| --- | ---: | ---: | --- |
| B `arms at sides` over A `hands behind back` | 6/6 | 6/6 | stable matched visibility improvement |

## Predeclared Admission Criteria

- B requested placement realization at least 5/6: PASS at 6/6.
- B complete bilateral hand visibility at least 5/6: PASS at 6/6.
- Matched complete-bilateral visibility improvement over A at least 5/6: PASS at 6/6.
- B ambiguity/artifact at most 1/6: PASS at 0/6.
- All prerequisites pass; the bounded evidence supports admitting `rin-arms-at-sides` as a specific, non-mutating replacement suggestion for this exact risk and explicit `visibility.hands` context.

## Evidence Boundary

CAM-017 established that hand visibility is context-dependent. CAM-018 and CAM-019 identified and reproduced pose/body overlap risk for hands-behind placement. CAM-020 supports one exact production PromptTag candidate under the tested NovaAnimeXL profile and matched prompt. It does not prove a hard visibility guarantee, universal causality, automatic replacement, or behavior for other poses, framings, models, aliases, or contexts.

## Research Boundary

CAM-020 changes no PromptTag, Concept Graph, compiler/runtime, production advisory, UI, schema, workflow, platform, or production behavior. Any production suggestion admission requires a separate Product decision and Task.
