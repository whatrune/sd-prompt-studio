# CAM-005 Prompt-Blind Research Review

## Final Experiment Classification

**INCONCLUSIVE**

The three requested vertical camera-angle directions are visually separated in 6/6 panels per arm and every matched-seed directional comparison passes 6/6. However, all 18 panels contain a conspicuous aircraft composition artifact. The predeclared prerequisite permits ambiguity/artifact in at most 1/6 panels per arm, so the confirmed or partial discrimination branches are not admissible despite the strong directional signal.

## Blinding and Provenance

- Panels: 18/18; missing or corrupt: 0.
- Exact model/hash, Euler a, Automatic, 20 steps, CFG 4.5, 1024×1024, and frozen settings: PASS.
- Across runs, the only positive-prompt difference is the terminal camera-angle phrase; negative prompts and ordered seeds are equal.
- response.parameters, parsed response.info, structural infotext, and PNG dimension bindings: PASS 18/18.
- Observer input contained only opaque condition IDs, opaque panel IDs, and pixels; requested angle, run mapping, prompt terms, and seeds were unavailable.
- Frozen visual observation SHA-256: eb664c09bf2f130228878eb5891988aa615cc720c670abeed3137b808afc06e8.
- Sealed condition mapping SHA-256: c0d785c72788988e088fcfd74a01d7fa15625fedf872c7194778d0d6ea978813.
- Canonical tracked blind-record owner: `research/sd-prompt-research/experiments/camera/CAM-005-A/source/CAM-005-A_metadata.yaml`; its exact UTF-8 freeze and mapping payloads independently rehash to the two recorded SHA-256 identities.
- Condition mapping was decoded only after the visual record was frozen; no visual row was changed after decode.

## Per-Arm Metrics

| Run | Requested angle | Requested direction visible | Angle assessable | Ambiguity/artifact |
| --- | --- | ---: | ---: | ---: |
| CAM-005-A | eye level | 6/6 | 6/6 | 6/6 composition artifact |
| CAM-005-B | low angle | 6/6 | 6/6 | 6/6 composition artifact |
| CAM-005-C | high angle | 6/6 | 6/6 | 6/6 composition artifact |

## Matched-Seed Directional Discrimination

| Comparison | Requested directional shift | Same/unclear | Reverse |
| --- | ---: | ---: | ---: |
| eye level → low angle | 6/6 | 0/6 | 0/6 |
| eye level → high angle | 6/6 | 0/6 | 0/6 |
| low angle ↔ high angle opposite evidence | 6/6 | 0/6 | 0/6 |

The directional evidence is strong, but the artifact prerequisite fails in every arm. Thresholds were not adjusted after observation, and no production or Concept Graph conclusion is admitted from this run.

## Repository Reality and Research Boundary

At this exact base, low angle and high angle are production PromptTags, while eye level is a canonical camera_vertical_angle slot prompt without a standalone PromptTag entry. No PromptTag, slot, Concept Graph, compiler/runtime, production advisory, UI, schema, or platform change is authorized or implied. Any repeat with a corrected common prompt requires a separate Research decision.
