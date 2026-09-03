# CAM-015 Prompt-Blind Research Review

## Final Experiment Classification

**INCONCLUSIVE**

All 18 panels are independently provenance-valid and visually assessable. The low-headroom arm reaches its requested minimal upper-margin band 6/6, but the neutral arm reaches the requested moderate band 0/6 and the high arm reaches the requested ample band 0/6. Because two reference prerequisites fail, the experiment cannot promote stable three-way discrimination or a no-effect conclusion.

## Blinding and Provenance

- Panels: 18/18; missing or corrupt: 0.
- Exact model/hash, Euler a, Automatic, 20 steps, CFG 4.5, 1024x1024, and frozen settings: PASS.
- Across runs, the only positive-prompt difference is the terminal headroom phrase; negative prompts and ordered seeds are equal.
- `response.parameters`, parsed `response.info`, structural infotext, and PNG bindings: PASS 18/18.
- Observer input contained only opaque condition IDs, opaque panel IDs, image hashes, and pixels.
- Canonical observer-input SHA-256: `e9e34c00274df77ac487b1b0cb395bbfd161b3df09efce53a86d0fd7d6860c18`.
- Frozen visual observation SHA-256: `55b86980f0f09343ef37c96f4d58757a93eecced4f461eb12319e35614bba5c1`.
- Sealed condition mapping SHA-256: `fd632cb21920430eca6e103b4204a4f934007a8a5930f9898e66037a3c8deafa`.
- Canonical tracked blind-record owner: `research/sd-prompt-research/experiments/camera/CAM-015-A/source/CAM-015-A_metadata.yaml`.
- Mapping was decoded only after the visual record was frozen; no frozen visual row changed after decode.

## Per-Arm Metrics

| Run | Phrase | Requested upper-margin band | Requested band observed | Assessable / whole visible | Ambiguity/artifact | Observed bands |
| --- | --- | --- | ---: | ---: | ---: | --- |
| CAM-015-A | `low headroom` | minimal | 6/6 | 6/6 / 6/6 | 0/6 | minimal 6/6 |
| CAM-015-B | `neutral headroom` | moderate | 0/6 | 6/6 / 6/6 | 0/6 | minimal 6/6 |
| CAM-015-C | `high headroom` | ample | 0/6 | 6/6 / 6/6 | 0/6 | minimal 5/6, moderate 1/6 |

## Matched-Seed Headroom Discrimination

| Comparison | Expected ordered separation visible |
| --- | ---: |
| low to neutral | 0/6 |
| neutral to high | 1/6 |
| low to high | 1/6 |

The only separation is CAM-015-C panel 5, where a visibly smaller subject produces a moderate upper margin; the other matched rows remain in the same minimal band.

## Threshold Application

- Assessability at least 5/6 and ambiguity/artifact at most 1/6: PASS for all arms.
- Stable requested-band support at least 5/6: PASS only for CAM-015-A; CAM-015-B and CAM-015-C fail at 0/6.
- Adjacent matched-seed discrimination at least 5/6: both comparisons fail at 0/6 and 1/6.
- Failed neutral/high reference prerequisites require `INCONCLUSIVE`; suppression, stable discrimination, and no-meaningful-effect conclusions are not claimed.

## Research Boundary

CAM-015 changes no PromptTag, slot, Concept Graph, compiler/runtime, production advisory, UI, schema, workflow, platform, or production behavior. Product and Graph decisions remain deferred.
