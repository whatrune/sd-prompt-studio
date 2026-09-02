# CAM-009 Research Review

## Final classification

**NO_MEANINGFUL_DUTCH_ANGLE_EFFECT**

Both arms satisfied every predeclared observation prerequisite, but the requested treatment produced no visible frame-roll effect. The neutral control was level in 6/6 panels and the `dutch angle` treatment was also level in 6/6 panels. No matched seed changed from a level control to a visibly tilted treatment. Under the frozen criteria, this is `NO_MEANINGFUL_DUTCH_ANGLE_EFFECT`; it is not evidence that the production tag is contradictory or that it should be removed.

## Prompt-blind integrity

- The observer received only opaque condition IDs, opaque panel IDs, and pixels.
- Requested roll condition, run mapping, prompt terms, and seeds were withheld.
- Blind observations were frozen before decode at SHA-256 `b975fd7e3e32eaa1018397733517e0e4cf96be43e5cc97a0daaedb02b5db04f9`.
- The sealed mapping rehashes to `28fa3a5edb590bf8ec4416f2ac94a38803ab6c901a5631e113846b46e9b1810d`.
- Canonical tracked owner: `research/sd-prompt-research/experiments/camera/CAM-009-A/source/CAM-009-A_metadata.yaml`.
- Mapping decode changed no frozen visual row.

## Per-arm metrics

| Run | Condition | Level | Tilted | Assessable | Clear reference | Full body | Ambiguity/artifact |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| CAM-009-A | no roll phrase | 6/6 | 0/6 | 6/6 | 6/6 | 6/6 | 0/6 |
| CAM-009-B | dutch angle | 6/6 | 0/6 | 6/6 | 6/6 | 6/6 | 0/6 |

## Matched-seed result

- Level control to visibly tilted treatment: 0/6.
- Level in both arms: 6/6.
- Directional consistency is not applicable because no treatment panel showed visible clockwise or counterclockwise roll.

## Threshold application

Panel/provenance completeness is 12/12. Each arm has assessability 6/6, clear environmental references 6/6, full-body visibility 6/6, and ambiguity/artifact 0/6, so prerequisites pass. The treatment has visible tilt 0/6 and matched level-to-tilt differences 0/6, both within the predeclared no-effect ceiling of 1/6. Thresholds were not changed after observation.

## Boundary

This is bounded evidence for `novaAnimeXL_ilV190` under the frozen neutral prompt and settings. It does not justify a production, PromptTag, Concept Graph, compiler, advisory, UI, schema, or platform change in Task #556.
