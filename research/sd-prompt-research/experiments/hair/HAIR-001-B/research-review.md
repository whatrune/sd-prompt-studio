# HAIR-001-B Research Review

## Decision

**PROMOTION_ELIGIBLE** for a later, separately authorized promotion of the existing `hair.long` concept from draft to provisional.

This Task records eligibility only. It does not change the Concept Graph, the `hair.long` status, production mappings, the advisory catalog, or the Prompt Compiler.

## Inputs Reviewed

- Official input: `HAIR-001-v3.zip`
- Archive SHA-256: `2f9bdc9a82dc9b989234eee8412b0f09033e611abc9474575bea228a7490792c`
- Condition A: six `bob cut` panels
- Condition B: six `long hair` panels
- Ordered matched seeds: `110731`, `240517`, `381029`, `527413`, `684221`, `902117`
- Pilot inputs v1 and v2: excluded from canonical evidence

## Provenance Review

| Predicate | Result |
| --- | --- |
| 6 A panels and 6 B panels | PASS |
| Model `novaAnimeXL_ilV190` | PASS |
| Model hash `fa486caafc` | PASS |
| Sampler `Euler a`, scheduler `Automatic` | PASS |
| Steps 20, CFG 4.5, size 1024×1024 | PASS |
| Same ordered six seeds | PASS |
| Positive prompts equal except `bob cut` / `long hair` | PASS |
| Negative prompts equal | PASS |
| Missing or corrupt panel count | 0 |

## Condition B Hair Observation

- `below_shoulder`: 6/6
- `waist_or_longer`: 0/6
- Assessable hair length: 6/6
- `unclear` + `not_visible`: 0/6
- Neck hair overlap present: 6/6
- Shoulder hair overlap present: 6/6
- Hair identity distinct: 6/6
- Ambiguity or artifact: 0/6

## Matched-Seed Comparison

| Seed | B visibly longer than A |
| ---: | :---: |
| 110731 | yes |
| 240517 | yes |
| 381029 | yes |
| 527413 | yes |
| 684221 | yes |
| 902117 | yes |

Result: 6/6 matched pairs show B visibly longer than A.

## Frozen Promotion Criteria

| Criterion | Threshold | Observed | Result |
| --- | ---: | ---: | --- |
| B `below_shoulder` or `waist_or_longer` | ≥5/6 | 6/6 | PASS |
| A `below_shoulder` or `waist_or_longer` | ≤1/6 | 0/6 | PASS |
| Matched pairs with B visibly longer | ≥4/6 | 6/6 | PASS |
| Assessable hair length per condition | ≥5/6 | A 6/6; B 6/6 | PASS |
| `unclear` + `not_visible` per condition | ≤1/6 | A 0/6; B 0/6 | PASS |
| B ambiguity or artifact | ≤1/6 | 0/6 | PASS |
| Frozen provenance and one-phrase A/B delta | exact | exact | PASS |
| Hair schema, panel identity, and zero-inclusive aggregates | valid | valid | PASS |

## Interpretation Boundaries

- The direct visible length response supports promotion eligibility for the existing `hair.long` concept only.
- Neck/shoulder overlap observations are experiment evidence, not promoted effects; any visibility-effect interpretation remains draft and unconfirmed.
- No generative effects are claimed.
- Six matched pairs are sufficient for the frozen HAIR-001 gate but do not establish checkpoint-independent behavior.

## Required Next Step

A separate Product Owner-authorized promotion Task may evaluate the exact research evidence and, if approved, change only `hair.long` from draft to provisional. No promotion is performed here.
