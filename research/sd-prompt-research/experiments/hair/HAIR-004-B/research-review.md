# HAIR-004-B Research Review

## Pair Decision

**CONFIRMED_COEXISTENCE** for **twintails + long hair** under this exact checkpoint and generation contract.

The treatment retains distinct twintails in 6/6 panels, shows below-shoulder total hair extent in 6/6, and is visibly longer than its matched control in 4/6 pairs. No non-tail hair reaches below the shoulders: the observed long extent is expressed through the tied tails themselves. The control already produces below-shoulder tied tails in 3/6 panels, so raw treatment length alone is not credited; the matched-pair extension threshold is independently satisfied.

This is research evidence only. It creates no compiler behavior, conflict, suppression, weighting, expansion, Concept Graph, binding, advisory, or UI change.

## Inputs Reviewed

- Official input: `HAIR-004-task-465-20260830-210742.zip`
- Archive SHA-256: `fb4563ff7fa28e563869e17d1b9983828d126c77db796855d8d403dd549ffead`
- Control: `HAIR-004-A`
- Treatment: `HAIR-004-B`
- Ordered matched seeds: `677787952`, `1577455770`, `147154807`, `153275517`, `772828733`, `895886237`

## Provenance Review

| Predicate | Result |
| --- | --- |
| 6 control + 6 treatment panels | PASS |
| Model `novaAnimeXL_ilV190`, hash `fa486caafc` | PASS |
| Full model SHA-256 exact | PASS |
| Sampler `Euler a`, scheduler request `Automatic` | PASS |
| Steps 20, CFG 4.5, size 1024×1024 | PASS |
| Same ordered six fresh seeds | PASS |
| Positive prompts differ only by appended `long hair` | PASS |
| Negative prompts equal | PASS |
| Returned generation metadata retained in 12 sidecars | PASS |
| Missing or corrupt panel count | 0 |

## Matched-Seed Comparison

| Seed | A tied-tail extent | B tied-tail extent | B visibly longer | B non-tail long extent |
| ---: | :---: | :---: | :---: | :---: |
| 677787952 | below_shoulder | below_shoulder | unclear | absent |
| 1577455770 | neck_to_shoulder | below_shoulder | yes | absent |
| 147154807 | neck_to_shoulder | below_shoulder | yes | absent |
| 153275517 | below_shoulder | below_shoulder | unclear | absent |
| 772828733 | neck_to_shoulder | below_shoulder | yes | absent |
| 895886237 | below_shoulder | below_shoulder | yes | absent |

## Frozen Criteria

| Criterion | Threshold | Observed | Result |
| --- | ---: | ---: | --- |
| Control twintail identity distinct and assessable | ≥5/6 | 6/6 | PASS |
| Treatment assessable | ≥5/6 | 6/6 | PASS |
| Treatment twintail identity retained | ≥5/6 | 6/6 | PASS |
| Treatment below-shoulder total extent | ≥5/6 | 6/6 | PASS |
| Matched treatment extension | ≥4/6 | 4/6 | PASS |
| Treatment ambiguity/artifact | ≤1/6 | 0/6 | PASS |
| Treatment non-tail below-shoulder extent | descriptive only | 0/6 | RECORDED |
| Coexistence | all coexistence thresholds | — | PASS |
| Twintail suppression | treatment absent/ambiguous ≥5/6 | 0/6 | FAIL |
| Long suppression | treatment long extent absent ≥5/6 | 0/6 | FAIL |
| No effect | matched extension ≤1/6 | 4/6 | FAIL |

## Replication Context

HAIR-002 C/D used the identical prompt, negative prompt, model, and settings with six different seeds. Across both independent samples, treatment below-shoulder extent is 10/12, treatment visibly longer is 9/12, twintail identity retained is 12/12, and ambiguity/artifact is 0/12. HAIR-002 remains historical context and does not substitute for any HAIR-004 panel.

## Interpretation Boundary

- `CONFIRMED_COEXISTENCE` is bounded to this exact model, settings, camera, pose, and seed sample.
- It establishes visible twintails plus long tied-tail extent, not separate loose/non-tail long hair.
- It does not itself justify a compiler coexistence rule.
- Canonical Run-ledger mutation is intentionally deferred from this parallel phase.
