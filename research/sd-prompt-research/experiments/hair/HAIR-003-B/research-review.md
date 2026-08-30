# HAIR-003-B Research Review

## Pair Decision

**CONFIRMED_SUPPRESSION** for **bob cut + long hair** at the verified checkpoint and settings.

Across six fresh matched seeds, both conditions preserve a distinct bob silhouette, while the treatment produces no below-shoulder hair extent and is visibly longer in no matched pair. Combined with HAIR-002, the same bounded result holds in 12/12 matched pairs.

This is research evidence only. It creates no production binding, compiler behavior, conflict rule, suppression rule, automatic expansion, or weighting.

## Inputs Reviewed

- Official input: `HAIR-003-task-467-20260830-210626.zip`
- Archive SHA-256: `9c49514ba9597e17792ea9c8f3667faaa7afc735137e80afc12456343b96a0fd`
- Control: `HAIR-003-A`
- Treatment: `HAIR-003-B`
- Ordered matched seeds: `677787952`, `1577455770`, `147154807`, `153275517`, `772828733`, `895886237`

## Provenance Review

| Predicate | Result |
| --- | --- |
| 6 control + 6 treatment panels | PASS |
| Model `novaAnimeXL_ilV190`, hash `fa486caafc` | PASS |
| Full checkpoint SHA-256 exact | PASS |
| Sampler `Euler a`, scheduler `Automatic` | PASS |
| Steps 20, CFG 4.5, size 1024×1024 | PASS |
| Same ordered six fresh seeds | PASS |
| Positive prompts differ only by appended `, long hair` | PASS |
| Negative prompts equal | PASS |
| Missing or corrupt panel count | 0 |

## Matched-Seed Comparison

| Seed | A bob retained | B bob retained | B long extent | B visibly longer | Suppression success |
| ---: | :---: | :---: | :---: | :---: | :---: |
| 677787952 | yes | yes | no | no | yes |
| 1577455770 | yes | yes | no | no | yes |
| 147154807 | yes | yes | no | no | yes |
| 153275517 | yes | yes | no | no | yes |
| 772828733 | yes | yes | no | no | yes |
| 895886237 | yes | yes | no | no | yes |

## Frozen Criteria

| Criterion | Threshold | Observed | Result |
| --- | ---: | ---: | --- |
| Control assessable hair length | ≥5/6 | 6/6 | PASS |
| Treatment assessable hair length | ≥5/6 | 6/6 | PASS |
| Control bob identity retained | ≥5/6 | 6/6 | PASS |
| Treatment bob identity retained | ≥5/6 | 6/6 | PASS |
| Treatment long extent | ≤1/6 | 0/6 | PASS |
| Treatment visibly longer | ≤1/6 | 0/6 | PASS |
| Fresh matched suppression success | ≥5/6 | 6/6 | PASS |
| Ambiguity/artifact per condition | ≤1/6 | 0/6 each | PASS |
| Combined HAIR-002 + HAIR-003 suppression success | ≥11/12 | 12/12 | PASS |

## Interpretation Boundary

- `CONFIRMED_SUPPRESSION` is bounded to this checkpoint, prompt bytes, settings, camera policy, and the two independently frozen six-seed samples.
- It does not establish a compiler conflict or prove checkpoint-independent behavior.
- No Concept Graph, production, advisory, compiler, conflict, suppression, weighting, expansion, or UI change is performed in Task #467.
