# HAIR-002-C Research Review

## Pair Decision

**INCONCLUSIVE** for **twintails + long hair**.

Twin tied tails remain distinct in all six treatment panels, but below-shoulder extent appears in only four panels, below the frozen 5/6 coexistence threshold.

This is research eligibility evidence only. It creates no production binding, compiler behavior, conflict rule, suppression, expansion, or weighting.

## Inputs Reviewed

- Official input: `HAIR-002-task-463-20260830-195045.zip`
- Archive SHA-256: `c343d2c599f2220f9894ee4439bb99f4836ee4e762ccc6912e4085c96025d0db`
- Control: `HAIR-002-C`
- Treatment: `HAIR-002-D`
- Ordered matched seeds: `110731`, `240517`, `381029`, `527413`, `684221`, `902117`

## Provenance Review

| Predicate | Result |
| --- | --- |
| 6 control + 6 treatment panels | PASS |
| Model `novaAnimeXL_ilV190`, hash `fa486caafc` | PASS |
| Sampler `Euler a`, scheduler `Automatic` | PASS |
| Steps 20, CFG 4.5, size 1024×1024 | PASS |
| Same ordered six seeds | PASS |
| Positive prompts differ only by appended `long hair` | PASS |
| Negative prompts equal | PASS |
| Missing or corrupt panel count | 0 |

## Matched-Seed Comparison

| Seed | Treatment visibly longer than control |
| ---: | :---: |
| 110731 | unclear |
| 240517 | yes |
| 381029 | yes |
| 527413 | yes |
| 684221 | yes |
| 902117 | yes |

## Frozen Criteria

| Criterion | Threshold | Observed | Result |
| --- | ---: | ---: | --- |
| Control main hairstyle distinct and assessable | ≥5/6 | 6/6 | PASS |
| Treatment assessable | ≥5/6 | 6/6 | PASS |
| Treatment main structure retained | ≥5/6 | 6/6 | PASS |
| Treatment below-shoulder extent for coexistence | ≥5/6 | 4/6 | FAIL |
| Treatment visibly longer for coexistence | ≥4/6 | 5/6 | PASS |
| Treatment ambiguity/artifact | ≤1/6 | 0/6 | PASS |
| Coexistence candidate | all coexistence thresholds | — | FAIL |
| Main-suppression candidate | main absent/ambiguous ≥5/6 | 0/6 | FAIL |
| Long-suppression candidate | main retained and long extent absent ≥5/6 | 2/6 absent | FAIL |

## Interpretation Boundary

- `INCONCLUSIVE` describes this checkpoint/settings/seed sample only.
- No checkpoint-independent behavior is claimed.
- No production or compiler change is performed in Task #463.
- A later Task must independently decide whether any conflict or composition rule is justified.
