# CAM-016 Prompt-Blind Research Review

## Final Experiment Classification

**INCONCLUSIVE**

All 18 panels are independently provenance-valid and their physical frame intersections are assessable. The full-contained arm reaches its requested boundary signature 6/6. The lower-body-crop arm reaches its requested lower-edge body intersection 0/6 and instead produces an upper-edge body intersection 6/6. The upper-body-crop arm reaches its requested upper-edge body intersection 0/6 and instead remains fully contained 6/6. Because both crop-treatment prerequisites fail, the experiment cannot claim stable three-way discrimination, partial intended discrimination, or no meaningful effect.

## Blinding and Provenance

- Panels: 18/18; missing or corrupt: 0.
- Exact model/hash, Euler a, Automatic, 20 steps, CFG 4.5, 1024x1024, and frozen settings: PASS.
- Across runs, the only positive-prompt difference is the terminal crop-boundary instruction; negative prompts and ordered seeds are equal.
- `response.parameters`, parsed `response.info`, structural infotext, and PNG bindings: PASS 18/18.
- Observer input contained only opaque condition IDs, opaque panel IDs, image hashes, and pixels.
- Canonical observer-input SHA-256: `eb3875a53c478e221fb35c5657ef1fcef46869864fb60d70d057512da31431a1`.
- Frozen visual observation SHA-256: `d6d8f5c28cee0ca2fe0e5dcc8de0641bf92904700e54202dc583c85dd5647417`.
- Sealed condition mapping SHA-256: `8ac55f8d647e589098934d15e514c28e61610cdc1b0a2c1e828cebb30c025856`.
- Canonical tracked blind-record owner: `research/sd-prompt-research/experiments/camera/CAM-016-A/source/CAM-016-A_metadata.yaml`.
- Mapping was decoded only after the visual record was frozen; no frozen visual row changed after decode.

## Per-Arm Metrics

| Run | Requested boundary | Requested signature observed | Assessable | Ambiguity/artifact | Actual dominant signature |
| --- | --- | ---: | ---: | ---: | --- |
| CAM-016-A | full subject contained | 6/6 | 6/6 | 0/6 | above head + below feet 6/6 |
| CAM-016-B | lower edge intersects body | 0/6 | 6/6 | 0/6 | upper edge intersects body + below feet 6/6 |
| CAM-016-C | upper edge intersects body | 0/6 | 6/6 | 0/6 | above head + below feet 6/6 |

## Matched-Seed Boundary Discrimination

| Comparison | Different observed boundary signature |
| --- | ---: |
| full-contained to lower-body-crop instruction | 6/6, but the crop direction is opposite the request |
| lower-body-crop to upper-body-crop instruction | 6/6, but neither treatment reaches its requested signature |
| full-contained to upper-body-crop instruction | 0/6 |

Camera-angle variation was visible in A=1/6, B=3/6, and C=2/6 panels. It does not make the frame intersections unassessable, but it reinforces that the failed treatment arms cannot support a clean intended-effect claim.

## Threshold Application

- Provenance/panel completeness 18/18: PASS.
- Boundary assessability at least 5/6 and ambiguity/artifact at most 1/6: PASS for all arms.
- Stable requested-boundary support at least 5/6: PASS only for CAM-016-A; CAM-016-B and CAM-016-C fail at 0/6.
- Intended three-way matched-seed discrimination at least 5/6: FAIL because A and C have the same signature 6/6 and both treatment prerequisites fail.
- Failed crop-treatment prerequisites require `INCONCLUSIVE`; suppression, stable discrimination, partial intended discrimination, and no-meaningful-effect conclusions are not claimed.

## Research Boundary

CAM-016 changes no PromptTag, camera slot, Concept Graph, compiler/runtime, production advisory, UI, schema, workflow, platform, or production behavior. Product and Graph decisions remain deferred.
