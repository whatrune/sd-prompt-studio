# CAM-023 Prompt-Blind Research Review

## Final Experiment Classification

**INCONCLUSIVE**

All 24 panels are independently provenance-valid, assessable, and show complete bilateral hand visibility with the arms alongside the torso. However, both predeclared control-manipulation prerequisites fail: CAM-023-A realizes the required upper-body crop boundary in 0/6 panels, and CAM-023-C realizes the required cowboy-shot crop boundary in 0/6 panels. Because either control failure forces INCONCLUSIVE, the experiment does not admit a positive or negative claim that `rin-arms-at-sides` materially reduces requested framing realization.

## Blinding and Provenance

- Panels: 24/24; missing or corrupt: 0.
- Exact model/hash, Euler a, Automatic, 20 steps, CFG 4.5, 1024x1024, and frozen settings: PASS.
- Ordered seeds, non-factor prompt bytes, and negative prompts are equal; only the declared framing and arm-placement factors differ.
- response.parameters, parsed response.info, structural infotext, and PNG bindings: PASS 24/24.
- Observer input contained only opaque condition IDs, opaque panel IDs, image hashes/paths, and pixels.
- Canonical observer-input SHA-256: `ad3e875431d9be0b69e5c554fc68038d6ff6968f98585badc07348b09e1f750d`.
- Frozen visual observation SHA-256: `b4c13c6bbfee2205fb36e25bf8911edcfd3d9e6419578af62e1e3fe32e348aec`.
- Sealed condition mapping SHA-256: `0ab80da4c37d2f64cc0482cdd44b64fe30c38d4a0bad2da66ee43416815bda80`.
- Canonical tracked blind-record owner: `research/sd-prompt-research/experiments/camera/CAM-023-A/source/CAM-023-A_metadata.yaml`.
- Mapping was decoded only after the visual record was frozen; no frozen axis value, evidence note, or confidence changed after decode.

## Per-Arm Metrics

| Run | Condition | Requested framing realized | Arms alongside torso | Both hands fully visible | Assessable | Ambiguity/artifact |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| CAM-023-A | upper body | 0/6 | 6/6 | 6/6 | 6/6 | 0/6 |
| CAM-023-B | upper body + arms at sides | 0/6 | 6/6 | 6/6 | 6/6 | 0/6 |
| CAM-023-C | cowboy shot | 0/6 | 6/6 | 6/6 | 6/6 | 0/6 |
| CAM-023-D | cowboy shot + arms at sides | 0/6 | 6/6 | 6/6 | 6/6 | 0/6 |

## Matched-Seed Interaction Result

| Family | Treatment is strictly wider | Control-realized to treatment-not-realized loss | Result |
| --- | ---: | ---: | --- |
| upper body: B over A | 1/6 | 0/6 | insufficient; control manipulation invalid |
| cowboy shot: D over C | 1/6 | 0/6 | insufficient; control manipulation invalid |

The no-arm-intent controls also happened to place the arms alongside the torso in 6/6 panels. That visible coincidence is retained as context, but it does not replace the failed requested-framing prerequisite or justify a no-effect claim.

## Predeclared Criteria

- Provenance 6/6 per arm: PASS.
- Assessability at least 5/6 per arm: PASS at 6/6.
- Ambiguity/artifact at most 1/6 per arm: PASS at 0/6.
- B/D arms-at-sides realization at least 5/6: PASS at 6/6 each.
- A/C requested-framing realization at least 5/6: FAIL at 0/6 each.
- Material widening requires at least 5/6 strictly wider pairs and at least 5/6 control-realized to treatment-not-realized losses: FAIL at 1/6 and 0/6 for upper body; 1/6 and 0/6 for cowboy shot.
- Any prerequisite failure requires INCONCLUSIVE.

## Evidence Boundary

Within the realized images, adding `rin-arms-at-sides` produced only 1/6 and 1/6 strictly wider matched pairs, while bilateral hand visibility remained 6/6 in every arm. The framing controls did not reliably realize the requested tighter boundaries, so CAM-023 cannot answer the primary causal question under its frozen admission rule. No production Compiler or framing behavior change is justified.

## Research Boundary

CAM-023 changes no PromptTag, Concept Graph, compiler/runtime, production advisory, UI, schema, workflow, platform, or production behavior.
