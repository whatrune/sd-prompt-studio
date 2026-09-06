# CAM-022 Prompt-Blind Research Review

## Final Experiment Classification

**INCONCLUSIVE**

All 24 panels are independently provenance-valid, assessable, and show complete bilateral hand visibility with arms alongside the torso. However, both predeclared control-manipulation prerequisites fail: CAM-022-A realizes the required upper-body crop boundary in 0/6 panels, and CAM-022-C realizes the required cowboy-shot crop boundary in 3/6 panels. Because either control failure forces INCONCLUSIVE, the experiment does not admit a positive or negative claim that `hands visible` materially reduces requested framing realization.

## Blinding and Provenance

- Panels: 24/24; missing or corrupt: 0.
- Exact model/hash, Euler a, Automatic, 20 steps, CFG 4.5, 1024x1024, and frozen settings: PASS.
- Ordered seeds, non-factor prompt bytes, and negative prompts are equal; only the declared framing and `hands visible` factors differ.
- response.parameters, parsed response.info, structural infotext, and PNG bindings: PASS 24/24.
- Observer input contained only opaque condition IDs, opaque panel IDs, image hashes/bytes/paths, and pixels.
- Canonical observer-input SHA-256: `367271d93947100c42bf00efc960afc8432c06fb7c4a0e7d6dafaaed65931e7a`.
- Frozen visual observation SHA-256: `7660d0a287a97cdbf65bc41706d5a9d883d50942dde81058a7e09f97d800e1cd`.
- Sealed condition mapping SHA-256: `092382dd24b314b8b3f1194adf0cf159b88f0e7462e2fa877dcb459e3f514678`.
- Canonical tracked blind-record owner: `research/sd-prompt-research/experiments/camera/CAM-022-A/source/CAM-022-A_metadata.yaml`.
- Mapping was decoded only after the visual record was frozen; no frozen axis value, evidence note, or confidence changed after decode.

## Per-Arm Metrics

| Run | Condition | Requested framing realized | Both hands fully visible | Both hands fully inside | Arms alongside torso | Assessable | Ambiguity/artifact |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| CAM-022-A | upper body | 0/6 | 6/6 | 6/6 | 6/6 | 6/6 | 0/6 |
| CAM-022-B | upper body + hands visible | 0/6 | 6/6 | 6/6 | 6/6 | 6/6 | 0/6 |
| CAM-022-C | cowboy shot | 3/6 | 6/6 | 6/6 | 6/6 | 6/6 | 0/6 |
| CAM-022-D | cowboy shot + hands visible | 4/6 | 6/6 | 6/6 | 6/6 | 6/6 | 0/6 |

## Matched-Seed Interaction Result

| Family | Treatment is strictly wider | Control-realized to treatment-not-realized loss | Result |
| --- | ---: | ---: | --- |
| upper body: B over A | 0/6 | 0/6 | no observed widening; control manipulation invalid |
| cowboy shot: D over C | 0/6 | 0/6 | no observed widening; control manipulation invalid |

CAM-022-D is equal to or tighter than CAM-022-C in every matched pair under the frozen lower-boundary ordering; two pairs are visibly tighter. This directional observation does not overcome the failed control prerequisite and therefore is not promoted to a no-effect claim.

## Predeclared Criteria

- Provenance 6/6 per arm: PASS.
- Assessability at least 5/6 per arm: PASS at 6/6.
- Arms alongside torso at least 5/6 per arm: PASS at 6/6.
- Ambiguity/artifact at most 1/6 per arm: PASS at 0/6.
- Control requested-framing realization at least 5/6: FAIL for A at 0/6 and C at 3/6.
- Material widening requires at least 5/6 strictly wider pairs and at least 5/6 control-realized to treatment-not-realized losses: FAIL at 0/6 and 0/6 for both families.
- Any control prerequisite failure requires INCONCLUSIVE.

## Evidence Boundary

Within the realized images, adding `hands visible` did not widen either framing family and did not change bilateral hand visibility, which remained 6/6 in all arms. But the no-intent controls did not reliably realize the requested upper-body or cowboy-shot crops, so CAM-022 cannot answer the primary causal question under its frozen admission rule. No production Compiler, framing, or visibility behavior change is justified.

## Research Boundary

CAM-022 changes no PromptTag, Concept Graph, compiler/runtime, production advisory, UI, schema, workflow, platform, or production behavior. Any future follow-up must first establish reliable tighter-framing controls under a neutral matched context.
