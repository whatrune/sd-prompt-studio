# CAM-007 Prompt-Blind Research Review

## Final Experiment Classification

**INCONCLUSIVE**

The neutral matched-seed replication did not meet the predeclared assessability prerequisites. Both the no-angle control and the `eye level` treatment showed visible below-subject/upward evidence in 4/6 panels and were unassessable because of ambiguous camera-height evidence in 2/6 panels. Each arm therefore reached only 4/6 assessable panels, below the required 5/6, while angle ambiguity reached 2/6, above the allowed 1/6. The result cannot support stable eye-level replication, no meaningful effect, or a tag-specific stabilization claim.

## Blinding and Provenance

- Panels: 12/12; missing or corrupt: 0.
- Exact model/hash, Euler a, Automatic, 20 steps, CFG 4.5, 1024×1024, and frozen settings: PASS.
- Across runs, the only positive-prompt difference is the terminal `eye level` phrase in CAM-007-B; negative prompts and ordered seeds are equal.
- response.parameters, parsed response.info, structural infotext, and PNG bindings: PASS 12/12.
- Observer input contained only opaque condition IDs, opaque panel IDs, and pixels; requested angle, run mapping, prompt terms, and seeds were unavailable.
- Frozen visual observation SHA-256: 6d048b85af1ec14358c14cde18a01295b210eb2206150c9f8856b5ab0042401b.
- Sealed condition mapping SHA-256: d6084d50c4fdcf73eebf12ba32304e4070ad7a489f72c04b81ce956865efb625.
- Canonical tracked blind-record owner: `research/sd-prompt-research/experiments/camera/CAM-007-A/source/CAM-007-A_metadata.yaml`; its exact UTF-8 freeze and mapping payloads independently rehash to the recorded identities.
- Condition mapping was decoded only after the visual record was frozen; no frozen visual row was changed after decode.

## Per-Arm Metrics

| Run | Condition | Eye-level evidence | Below-subject evidence | Unclear | Angle assessable | Ambiguity/artifact | Full body |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| CAM-007-A | no camera-angle phrase | 0/6 | 4/6 | 2/6 | 4/6 | 2/6 | 6/6 |
| CAM-007-B | `eye level` | 0/6 | 4/6 | 2/6 | 4/6 | 2/6 | 6/6 |

## Matched-Seed Result

No matched seed changed from non-level control evidence to eye-level treatment evidence. Across all six pairs, the decoded result remained the same broad visible class or involved an unassessable side; zero pairs support tag-specific eye-level stabilization and zero reverse pairs can establish a directional counter-effect. Because both arm-level prerequisites fail, the secondary tag-specific effect is also **INCONCLUSIVE**.

## CAM-006 Baseline Comparison

CAM-006 observed requested eye-level evidence in 4/6 panels with assessability 6/6. CAM-007 does not reproduce that stable assessability: its control and `eye level` treatment each show below-subject evidence 4/6 and ambiguous, unassessable evidence 2/6. This bounded replication therefore weakens neither production nor Graph semantics by itself; it establishes that the present neutral matched-seed context cannot resolve whether the phrase stabilizes eye-level framing.

## Threshold Application

The predeclared prerequisites require 12/12 provenance, at least 5/6 assessable panels in each arm, and at most 1/6 ambiguity/artifact in each arm. Provenance passes, but both assessability and ambiguity prerequisites fail in both arms. The mandatory classification is therefore `INCONCLUSIVE`; treatment thresholds and secondary stabilization branches are not admitted. Thresholds were not adjusted after observation.

## Research Boundary

CAM-007 changes no PromptTag, camera-angle slot, Concept Graph, compiler/runtime, production advisory, UI, schema, or platform behavior. Production and Concept Graph decisions remain deferred.
