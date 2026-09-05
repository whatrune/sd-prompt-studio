# CAM-021 Prompt-Blind Research Review

## Final Experiment Classification

**INCONCLUSIVE**

All 18 panels are independently provenance-valid, assessable, and show complete bilateral hand visibility. However, the predeclared manipulation prerequisites fail: CAM-021-A realizes the required upper-body crop boundary in 0/6 panels, and CAM-021-B realizes the required cowboy-shot crop boundary in 2/6 panels. CAM-021-C realizes full-body framing in 6/6. Because a framing prerequisite failure forces INCONCLUSIVE, no minimumFraming value is admitted.

## Blinding and Provenance

- Panels: 18/18; missing or corrupt: 0.
- Exact model/hash, Euler a, Automatic, 20 steps, CFG 4.5, 1024x1024, and frozen settings: PASS.
- Ordered seeds, common prompt bytes, and negative prompts are equal across all runs; only the declared camera-framing phrase differs.
- response.parameters, parsed response.info, structural infotext, and PNG bindings: PASS 18/18.
- Observer input contained only opaque condition IDs, opaque panel IDs, image hashes, and pixels.
- Canonical observer-input SHA-256: `79be9b104755c5ab0e5319779d2bf4f9981a321b1abec2b39a759533f5836d92`.
- Frozen visual observation SHA-256: `f83040eccb5666a82bc0b2e3e176ff3aa4a33cb9636bde6b8fa073abb8934730`.
- Sealed condition mapping SHA-256: `5591c2617f687208964da686521870f825858cf3d1d3c71c42d48e0f1058d386`.
- Canonical tracked blind-record owner: `research/sd-prompt-research/experiments/camera/CAM-021-A/source/CAM-021-A_metadata.yaml`.
- Mapping was decoded only after the visual record was frozen; no frozen row or evidence note changed after decode.

## Per-Arm Metrics

| Run | Exact PromptTag / phrase | Requested framing realized | Both hands fully visible | Both hands fully inside | Arms alongside torso | Assessable | Ambiguity/artifact |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| CAM-021-A | `cam-upper-body` / `upper body` | 0/6 | 6/6 | 6/6 | 6/6 | 6/6 | 1/6 |
| CAM-021-B | `cam-cowboy-shot` / `cowboy shot` | 2/6 | 6/6 | 6/6 | 6/6 | 6/6 | 0/6 |
| CAM-021-C | `cam-full-body` / `full body` | 6/6 | 6/6 | 6/6 | 6/6 | 6/6 | 0/6 |

The CAM-021-B observer used `cowboy_shot` as a coarse visible label in 4/6 panels, but the frozen admission contract is stricter: only proximal-, mid-, or distal-thigh lower boundaries count. Two of those four panels terminate at the knee, so exact requested-framing realization is 2/6.

## Matched-Seed Result

| Adjacent comparison | Wider arm improves complete bilateral visibility | Tighter-arm reversal | Result |
| --- | ---: | ---: | --- |
| B cowboy shot over A upper body | 0/6 | 0/6 | no visibility discrimination; A manipulation invalid |
| C full body over B cowboy shot | 0/6 | 0/6 | no visibility discrimination; B manipulation invalid |

## Predeclared Criteria

- Provenance 6/6 per arm: PASS.
- Assessability at least 5/6 per arm: PASS at 6/6.
- Requested framing realization at least 5/6: FAIL for A at 0/6 and B at 2/6; PASS for C at 6/6.
- Arms alongside torso at least 5/6: PASS at 6/6.
- Ambiguity/artifact at most 1/6: PASS (A 1/6, B 0/6, C 0/6).
- Any prerequisite failure requires INCONCLUSIVE. No minimum framing claim is admitted.

## Evidence Boundary

CAM-017 established context-dependent hand visibility; CAM-018 and CAM-019 identified pose/body-overlap risk; CAM-020 validated arms-at-sides as a bounded visibility-supporting placement. CAM-021 shows complete bilateral hand visibility in every realized image but does not isolate the requested upper-body or cowboy-shot framings reliably enough to establish a minimum framing. It does not prove a hard visibility guarantee, automatic framing selection, model generalization, or behavior outside this prompt and model profile.

## Research Boundary

CAM-021 changes no PromptTag, Concept Graph, compiler/runtime, production advisory, UI, schema, workflow, platform, or production behavior. A future experiment must first use a context in which the narrower framing manipulations meet their preregistered realization thresholds.
