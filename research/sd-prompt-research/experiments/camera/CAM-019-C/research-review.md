# CAM-019 Prompt-Blind Research Review

## Final Experiment Classification

**PARTIAL_ARM_PLACEMENT_VISIBILITY_EFFECT**

All 18 panels are independently provenance-valid and hand visibility is assessable. The relaxed-at-sides reference shows complete bilateral hand visibility 6/6. The hands-behind-body arm realizes a behind-torso placement in 5/6 panels; those same five panels hide both hands with direct body occlusion, producing a matched complete-bilateral visibility loss in 5/6 seeds relative to the reference. The hands-in-front-of-torso arm retains complete bilateral visibility 6/6 but does not realize hands in front of the torso in any panel, so it cannot support a conclusion about that requested placement.

## Blinding and Provenance

- Panels: 18/18; missing or corrupt: 0.
- Exact model/hash, Euler a, Automatic, 20 steps, CFG 4.5, 1024x1024, and frozen settings: PASS.
- Ordered seeds, common prompt bytes, and negative prompts are equal across all runs; only the declared arm-placement phrase differs.
- `response.parameters`, parsed `response.info`, structural infotext, and PNG bindings: PASS 18/18.
- Observer input contained only opaque condition IDs, opaque panel IDs, image hashes, and pixels.
- Canonical observer-input SHA-256: `1c637fe58191e811ec4847c2f8ff0c0a0587f3f8504e207d9673a3924e502384`.
- Frozen visual observation SHA-256: `238c746828d0af5d37076eea299d822b542b20fc7fea8cefbd1654106162763e`.
- Sealed condition mapping SHA-256: `36f2bf9df6171f3f1844b18baa0958df9108a942f095e940ee86279bee3b5c26`.
- Canonical tracked blind-record owner: `research/sd-prompt-research/experiments/camera/CAM-019-A/source/CAM-019-A_metadata.yaml`.
- Mapping was decoded only after the visual record was frozen; no frozen row or evidence note changed after decode.

## Per-Arm Metrics

| Run | Requested arm placement | Realized requested placement | Both hands fully visible | Both hands not visible | Assessable | Ambiguity/artifact | Direct body occlusion |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| CAM-019-A | arms relaxed at sides | 6/6 | 6/6 | 0/6 | 6/6 | 0/6 | 0/6 |
| CAM-019-B | hands in front of torso | 0/6 | 6/6 | 0/6 | 6/6 | 0/6 | 0/6 |
| CAM-019-C | hands behind body | 5/6 | 1/6 | 5/6 | 6/6 | 0/6 | 5/6 |

## Matched-Seed Results

| Comparison | Reference complete bilateral visibility and treatment does not | Requested treatment realized | Result |
| --- | ---: | ---: | --- |
| A to B, hands in front of torso | 0/6 | 0/6 | treatment prerequisite failed; no front-placement effect claimed |
| A to C, hands behind body | 5/6 | 5/6 | stable matched visibility loss with direct body occlusion |
| B to C | 5/6 | B 0/6; C 5/6 | descriptive only because B did not realize its requested placement |

## Threshold Application

- Provenance/panel completeness 18/18: PASS.
- Hand assessability at least 5/6 and ambiguity/artifact at most 1/6: PASS for all arms.
- Relaxed reference complete bilateral visibility at least 5/6: PASS at 6/6.
- A treatment is interpretable only when its requested arm placement is visibly realized in at least 5/6 panels.
- A stable visibility effect requires matched complete-bilateral visibility loss in at least 5/6 seeds and direct visible attribution in at least 5/6 treatment panels.
- CAM-019-C passes realization, matched-loss, and direct-body-occlusion thresholds at 5/6.
- CAM-019-B fails its realization prerequisite at 0/6, so neither a positive nor negative hands-in-front effect is claimed.
- Because one treatment is supported while the other is non-assessable as a requested placement, the bounded result is `PARTIAL_ARM_PLACEMENT_VISIBILITY_EFFECT`.

## Immediate Evidence Baseline

CAM-017 found hand visibility weaker and context-dependent than head or feet visibility. CAM-018 identified pose/body overlap as the dominant realized limiter, with its arms-behind treatment losing complete bilateral visibility in 5/6 matched seeds. CAM-019 independently reproduces that 5/6 matched loss for a hands-behind-body request while isolating arm-placement wording; it does not establish a hands-in-front effect because that arm was not realized.

## Research Boundary

CAM-019 changes no PromptTag, camera/pose/clothing slot, Concept Graph, compiler/runtime, production advisory, UI, schema, workflow, platform, or production behavior. Product and Graph decisions remain deferred.
