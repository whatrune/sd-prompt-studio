# CAM-001 Prompt-Blind Research Review

## Final Experiment Classification

**NO_MEANINGFUL_FULL_BODY_VISIBILITY_GAIN**

All predeclared prerequisites pass. Both the neutral camera control and the full body treatment produced complete-body-assessable panels in 6/6 cases. Across the six matched seeds there were 0 gains, 0 reversals, and 6 ties. The absolute complete-count difference is 0 and total discordant pairs are 0, satisfying the predeclared no-meaningful-gain branch. This experiment therefore does not support an automatic visibility claim beyond the existing emitted framing phrase.

## Blinding and Freeze Verification

| Predicate | Result |
| --- | --- |
| Observer-visible identity | Opaque condition and opaque panel identifiers only |
| Prompt, seed, requested framing, run mapping available during observation | NO |
| PromptTag IDs or emitted phrases available during observation | NO |
| Blind observation panel count | 12/12 |
| Frozen observation SHA-256 | 2e3a61c016b4a169af1f7735bb499e6c2c20a9971137dff8488ffe7e4a27f875 |
| Freeze timestamp | 2026-08-31T11:22:44+09:00 |
| Mapping disclosure | After the blind record was saved and hashed |
| Post-disclosure mutation of frozen visual rows | NONE |

The condition mapping was read only after the immutable blind observation record was rehashed successfully. Decoding projected the frozen rows into condition-local artifacts and matched-seed comparisons without changing a visual observation.

## Provenance Review

| Predicate | Result |
| --- | --- |
| Two conditions × six panels | PASS — 12/12 |
| Ordered matched seeds | PASS |
| Model novaAnimeXL_ilV190, short hash fa486caafc, full SHA-256 exact | PASS |
| Euler a / Automatic / 20 steps / CFG 4.5 / 1024×1024 | PASS |
| Batch 1 / n_iter 1 / no hires / no face restore / no tiling | PASS |
| Positive prompt equality except exact insertion full body before front view | PASS |
| Negative prompt equality | PASS |
| Missing/corrupt panels | 0 |
| Source/opaque pixel identity | PASS — 12/12 |

## Decoded Condition Metrics

| Run | Condition | Opaque label | Complete body assessable | Full-body observed framing | Ambiguity/artifact | Support boundary present |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| CAM-001-A | neutral camera control | COND-33fead1abc31 | 6/6 | 6/6 | 0/6 | 6/6 |
| CAM-001-B | full body treatment | COND-f7f4eadeb20d | 6/6 | 6/6 | 0/6 | 5/6 |

Support-boundary visibility is reported separately and is not part of the complete-body definition.

## Matched-Seed Comparison

| Seed | A complete | B complete | Result |
| ---: | --- | --- | --- |
| 2093987865 | yes | yes | same |
| 1573117377 | yes | yes | same |
| 1119182243 | yes | yes | same |
| 1062738181 | yes | yes | same |
| 245258905 | yes | yes | same |
| 1624701473 | yes | yes | same |

- Matched gains: 0/6
- Reversals: 0/6
- Same: 6/6
- Total discordant pairs: 0/6

## Frozen Prerequisites

| Prerequisite | Threshold | Observed | Result |
| --- | ---: | ---: | --- |
| Panel/provenance completeness | 12/12 | 12/12 | PASS |
| Exact prompt delta, seeds, model/settings, integrity | PASS | PASS | PASS |
| Prompt-blind observation frozen before mapping decode | PASS | PASS | PASS |
| Core visual axes codable per condition | >=5/6 | A=6/6; B=6/6 | PASS |
| Ambiguity/artifact per condition | <=1/6 | A=0/6; B=0/6 | PASS |

## Predeclared Decision Branches

- CONFIRMED_FULL_BODY_VISIBILITY_GAIN: B complete >=5/6, A complete <=2/6, matched gains >=4/6, reversals=0.
- NO_MEANINGFUL_FULL_BODY_VISIBILITY_GAIN: absolute complete-count difference <=1 and total discordant matched pairs <=2.
- OPPOSITE_FULL_BODY_VISIBILITY_EFFECT: A complete >=5/6, B complete <=2/6, reversals >=4/6, gains=0.
- UNSTABLE_OR_PARTIAL_FULL_BODY_VISIBILITY_EFFECT: prerequisites pass but none of the preceding branches.
- INCONCLUSIVE: any prerequisite fails.

The observed 0 count difference and 0 discordant pairs select exactly NO_MEANINGFUL_FULL_BODY_VISIBILITY_GAIN.

## Research Boundary

- No production, compiler, PromptTag, advisory, Concept Graph, visibility-metadata, smartTagEngine, UI, schema, or platform change is authorized or implied.
- The existing production PromptTag continues to emit full body; CAM-001 measures visible effect only.
- This Task records research evidence and does not redefine runtime behavior.
