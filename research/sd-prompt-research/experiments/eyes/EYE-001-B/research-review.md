# EYE-001 Prompt-Blind Research Review

## Final Experiment Classification

**CONFIRMED_CONTRADICTION_OR_NONASSESSABILITY**

All predeclared prerequisites pass. The treatment preserves the target closed-eye state in 6/6 panels, while gaze is `not_assessable` in 6/6 treatment panels because no pupil-direction evidence is visible. Decision precedence therefore selects branch 3, specifically the nonassessability outcome. This is not evidence that the treatment suppressed the closed-eye state, and it does not establish an assessable gaze contradiction.

## Blinding and Freeze Verification

| Predicate | Result |
| --- | --- |
| Observer-visible identity | Opaque condition and opaque matched-pair identifiers only |
| Prompt, seed, run/A-B mapping, Task identity, generation metadata available during observation | NO |
| Blind observation panel count | 12/12 |
| Observer manifest SHA-256 | `d072b0ac6358d7cac20daca54ca0a61a34936ba0324c5be9c079a4effde9a80a` |
| Frozen observation byte count | 6,283 |
| Frozen observation SHA-256 | `cf035923db8e5c3d430e8c6d8261e304f89ffd022bb5d0874647fae17547e0ba` |
| Manifest/file/decoded-pixel hashes | PASS — 12/12 |
| Mapping disclosure | After freeze bytes and SHA-256 were independently reverified |
| Post-disclosure mutation of frozen visual rows | NONE |

Decoding projected the frozen rows into condition-local artifacts and matched-seed comparisons without changing any visual observation.

## Provenance Review

| Predicate | Result |
| --- | --- |
| Two conditions × six panels | PASS — 12/12 |
| Exact ordered matched seeds | PASS — 6/6 |
| Model `novaAnimeXL_ilV190`, short hash `fa486caafc`, full SHA-256 exact | PASS |
| Euler a / Automatic / 20 steps / CFG 4.5 / 1024×1024 | PASS |
| Batch 1 / n_iter 1 / no hires / no face restore / no tiling | PASS |
| Common positive equality; only treatment insertion is `looking at viewer` | PASS |
| Common negative equality | PASS |
| Request sampler/scheduler, response parameters, info sampler, structured infotext Sampler and Schedule type | PASS — 12/12 |
| Missing/corrupt panels | 0 |
| Source/opaque decoded-pixel identity | PASS — 12/12 |

## Decoded Condition Metrics

| Run | Condition | Opaque label | Both eyes visible | Closed | Eye state assessable | Gaze toward viewer | Gaze not assessable | Gaze assessable | Ambiguity/artifact |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| EYE-001-A | closed eyes control | `COND-154a612330b8` | 6/6 | 6/6 | 6/6 | 0/6 | 6/6 | 0/6 | 0/6 |
| EYE-001-B | looking at viewer + closed eyes treatment | `COND-c9f43750ab22` | 6/6 | 6/6 | 6/6 | 0/6 | 6/6 | 0/6 | 0/6 |

`toward_viewer=0/6` is a count of frozen classifications, not an assessable negative-gaze finding: all gaze rows are `not_assessable`.

## Matched-Seed Comparison

| Seed | Opaque pair | A eye state / gaze | B eye state / gaze | Result |
| ---: | --- | --- | --- | --- |
| 1126645754 | `PAIR-6b592e7d0493` | closed / not_assessable | closed / not_assessable | target preserved; gaze nonassessable |
| 1332582485 | `PAIR-d89b0ee34ba4` | closed / not_assessable | closed / not_assessable | target preserved; gaze nonassessable |
| 1588147170 | `PAIR-6e13e511fbce` | closed / not_assessable | closed / not_assessable | target preserved; gaze nonassessable |
| 1901831359 | `PAIR-3db2c419da39` | closed / not_assessable | closed / not_assessable | target preserved; gaze nonassessable |
| 1918636949 | `PAIR-ab5a8f4cd194` | closed / not_assessable | closed / not_assessable | target preserved; gaze nonassessable |
| 2128309031 | `PAIR-5089ea234de1` | closed / not_assessable | closed / not_assessable | target preserved; gaze nonassessable |

- Eye state stable: 6/6 pairs.
- Treatment target preserved: 6/6 panels.
- Treatment gaze not assessable: 6/6 panels.
- Joint treatment target-preserved plus gaze-not-assessable: 6/6 panels.

## Frozen Prerequisites

| Prerequisite | Threshold | Observed | Result |
| --- | ---: | ---: | --- |
| Panel/provenance completeness | 12/12 | 12/12 | PASS |
| Exact matched seed pairs | 6/6 | 6/6 | PASS |
| Both eyes visible per condition | >=5/6 | A=6/6; B=6/6 | PASS |
| Eye state assessable per condition | >=5/6 | A=6/6; B=6/6 | PASS |
| Control target closed state | >=5/6 | A=6/6 | PASS |
| Non-none ambiguity per condition | <=1/6 | A=0/6; B=0/6 | PASS |

## Predeclared Decision Precedence

1. `CONFIRMED_COEXISTENCE`: not selected; treatment has assessable `toward_viewer` gaze in 0/6 and joint closed plus assessable `toward_viewer` in 0/6.
2. `CONFIRMED_SUPPRESSION`: not selected; the closed target is preserved in 6/6 treatment panels, and absence of viewer gaze is not assessable because gaze is `not_assessable` in 6/6.
3. `CONFIRMED_CONTRADICTION_OR_NONASSESSABILITY`: selected; treatment target is preserved in 6/6 and treatment gaze is `not_assessable` in 6/6.
4. `NO_MEANINGFUL_EFFECT`: not reached; its gaze-assessable prerequisite is 0/6 rather than >=5/6.
5. `INCONCLUSIVE`: not reached; all prerequisites pass and branch 3 is satisfied.

## Research Boundary

- Gaze requires visible pupil or eye-direction evidence; frontal face orientation alone is insufficient.
- Closed eyes with `not_assessable` gaze are not treated as automatic gaze failures.
- No production, compiler, PromptTag, advisory, Concept Graph, UI, schema, platform, or runtime change is authorized or implied.
- EYE-001 records bounded research evidence only and does not redefine production behavior.
