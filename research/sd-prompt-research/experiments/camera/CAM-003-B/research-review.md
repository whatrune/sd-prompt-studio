# CAM-003 Prompt-Blind Research Review

## Final Experiment Classification

**INCONCLUSIVE**

Generation provenance and prompt-blind observation are complete, but the predeclared treatment manipulation prerequisites fail. The close-up treatment produced observed close_up framing in 0/6 panels (threshold >=5/6) and ambiguity/composition artifacts in 5/6 panels (maximum 1/6). The treatment mostly cropped the upper image while retaining hips, knees, feet, and support evidence; it therefore cannot establish the intended detail-preserving body-exclusion effect.

## Blinding and Provenance

- Panels: 12/12; missing or corrupt: 0.
- Exact model/hash, Euler a, Automatic, 20 steps, CFG 4.5, 1024×1024, and frozen settings: PASS.
- Positive prompts differ only by terminal addition of close-up; negative prompts and ordered seeds are equal.
- response.parameters sampler/scheduler, parsed info sampler, and structural infotext Sampler/Schedule type bindings: PASS 12/12.
- Blind observer accessed opaque metadata-stripped PNG pixels only.
- Frozen observation SHA-256: b3935a55158af5adcf3982af2b0312530019811837c6d52a3c260f3ffe6aa43c.
- Mapping disclosure occurred after the observer wrote and hashed the freeze; frozen visual rows were not changed.

## Decoded Metrics

| Metric | Control A | Treatment B | Requirement |
| --- | ---: | ---: | --- |
| observed close_up | 0/6 | 0/6 | B >=5/6; A <=1/6 |
| ambiguity/artifact | 1/6 | 5/6 | <=1/6 per condition |
| standing visibly supported | 5/6 | 6/6 | A >=5/6 |
| joint face visible + head retained + detail assessable | 6/6 | 1/6 | B >=5/6 |
| joint body exclusion | 0/6 | 0/6 | B >=5/6 |
| matched combined transition | — | 0/6 | >=5/6 |

The treatment did not satisfy the framing manipulation or ambiguity threshold. No effect branch may be inferred from the retained lower-body visibility.

## Predeclared Branches

- CONFIRMED_DETAIL_PRESERVING_BODY_EXCLUSION: all prerequisites pass and treatment detail retention, body exclusion, and matched combined transition each meet >=5/6.
- PARTIAL_CLOSE_UP_VISIBILITY_EFFECT: prerequisites pass but only a bounded subset of the confirmed criteria is met.
- NO_MEANINGFUL_VISIBILITY_EFFECT: prerequisites pass and matched differences remain within the predeclared no-effect bounds.
- INCONCLUSIVE: any provenance, manipulation, assessability, or ambiguity prerequisite fails.

The failed manipulation and ambiguity prerequisites select exactly INCONCLUSIVE.

## Research Boundary

No Concept Graph, PromptTag, production advisory, compiler/runtime, body-state rule, UI, schema, or platform change is authorized or implied.
