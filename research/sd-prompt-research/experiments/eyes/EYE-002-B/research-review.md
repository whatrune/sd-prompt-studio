# EYE-002 Prompt-Blind Research Review

## Final Experiment Classification

**CONFIRMED_COEXISTENCE**

All predeclared prerequisites pass. In the treatment, one_closed eye state is preserved in 6/6 panels, toward_viewer gaze is visibly assessable in 6/6, and both occur jointly in 6/6. This meets the highest-precedence CONFIRMED_COEXISTENCE branch.

The control also showed toward_viewer gaze in 6/6 panels without that phrase. Therefore this result establishes visible coexistence of the two requested concepts under the frozen setup; it does not establish that adding looking at viewer caused a new gaze-direction change.

## Blinding and Provenance

- Panels: 12/12; missing or corrupt: 0.
- Exact six matched seeds per condition: PASS.
- Exact model/hash, Euler a, Automatic, 20 steps, CFG 4.5, 1024x1024, and frozen settings: PASS.
- Positive prompts differ only by insertion of looking at viewer immediately before one eye closed; negative prompts and ordered seeds are equal.
- Request and response.parameters sampler/scheduler, parsed info sampler, and structural infotext Sampler/Schedule type bindings: PASS 12/12.
- Blind observer accessed opaque metadata-stripped PNG pixels only.
- Frozen observation SHA-256: fae913eaf0ee23c0c28a6100ae9b26c90c891fc9d12685e88c7ce6b22c94fa31.
- Mapping disclosure occurred only after the observer wrote and hashed the freeze; frozen visual rows were not changed.
- Gaze classification required visible pupil/eye-direction evidence; face orientation alone was insufficient.

## Prerequisite Metrics

| Metric | Control A | Treatment B | Requirement | Result |
| --- | ---: | ---: | --- | --- |
| panel completeness | 6/6 | 6/6 | 12/12 total | PASS |
| eyes visible = both | 6/6 | 6/6 | >=5/6 per condition | PASS |
| eye state assessable = yes | 6/6 | 6/6 | >=5/6 per condition | PASS |
| control target eye state = one_closed | 6/6 | -- | >=5/6 | PASS |
| ambiguity/artifact non-none | 0/6 | 0/6 | <=1/6 per condition | PASS |

## Classification Metrics

| Metric | Result | Threshold |
| --- | ---: | ---: |
| treatment target eye state = one_closed | 6/6 | >=5/6 |
| treatment assessable toward_viewer gaze | 6/6 | >=5/6 |
| treatment joint one_closed + assessable toward_viewer | 6/6 | >=5/6 |
| matched eye-state stability | 6/6 | reported after decode |
| eye-state suppression pairs | 0/6 | suppression requires >=5/6 |
| treatment gaze non-assessable | 0/6 | contradiction/nonassessability requires >=5/6 |
| matched gaze classification unchanged | 6/6 | lower-precedence no-effect evidence only |

The first classification branch is satisfied, so lower-precedence branches do not override CONFIRMED_COEXISTENCE.

## Research Boundary

This experiment is research evidence only. It does not change Concept Graph status, PromptTag data, production advisory, compiler/runtime conflicts or suppression, smart-tag behavior, UI, schema, or validation platform.
