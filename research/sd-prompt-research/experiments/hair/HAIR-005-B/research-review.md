# HAIR-005-B Research Review

## Pair Decision

**CONFIRMED_COEXISTENCE** for **ponytail + long hair**.

The fresh six-pair replication shows a distinct single tied tail and independently visible below-shoulder hair extent in all six treatment panels. Every matched treatment is visibly longer than its control, with no ambiguous or artifacted treatment panel.

This is research evidence only. It creates no production binding, compiler behavior, conflict rule, suppression rule, expansion, or weighting.

## Inputs Reviewed

- Official input: `HAIR-005-task-466-20260830-210735.zip`
- Archive SHA-256: `2a497c250efac65235967989afc6633351403e09ba99540854f664056a7e08f6`
- Control: `HAIR-005-A`
- Treatment: `HAIR-005-B`
- Ordered matched seeds: `677787952`, `1577455770`, `147154807`, `153275517`, `772828733`, `895886237`

## Provenance Review

| Predicate | Result |
| --- | --- |
| 6 control + 6 treatment panels | PASS |
| Model `novaAnimeXL_ilV190`, hash `fa486caafc` | PASS |
| Full model SHA-256 exact | PASS |
| Sampler `Euler a`, scheduler `Automatic` | PASS |
| Steps 20, CFG 4.5, size 1024×1024 | PASS |
| Same ordered six fresh seeds | PASS |
| Positive prompts differ only by appended `, long hair` | PASS |
| Negative prompts equal | PASS |
| Missing or corrupt panel count | 0 |

## Matched-Seed Comparison

| Seed | Ponytail retained in B | Long extent visible in B | B visibly longer than A |
| ---: | :---: | :---: | :---: |
| 677787952 | yes | yes | yes |
| 1577455770 | yes | yes | yes |
| 147154807 | yes | yes | yes |
| 153275517 | yes | yes | yes |
| 772828733 | yes | yes | yes |
| 895886237 | yes | yes | yes |

## Frozen Criteria

| Criterion | Threshold | Observed | Result |
| --- | ---: | ---: | --- |
| Assessable control panels | ≥5/6 | 6/6 | PASS |
| Assessable treatment panels | ≥5/6 | 6/6 | PASS |
| Treatment ponytail identity retained | ≥5/6 | 6/6 | PASS |
| Treatment below-shoulder extent | ≥5/6 | 6/6 | PASS |
| Both concepts independently observable | ≥5/6 | 6/6 | PASS |
| Treatment visibly longer than control | ≥4/6 | 6/6 | PASS |
| Treatment ambiguity/artifact | ≤1/6 | 0/6 | PASS |
| Confirmed coexistence | all coexistence thresholds | — | PASS |

## Interpretation Boundary

- `CONFIRMED_COEXISTENCE` is bound to this checkpoint, settings, prompt contract, and fresh seed sample.
- HAIR-002 E/F is prior directional evidence; it does not substitute for any HAIR-005 panel.
- No checkpoint-independent compiler or production behavior is claimed.
- No Concept Graph, production binding, advisory, conflict, suppression, expansion, weighting, compiler, or UI change is performed in Task #466.
