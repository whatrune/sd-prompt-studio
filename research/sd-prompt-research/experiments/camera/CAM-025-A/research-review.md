# CAM-025 Prompt-Blind Research Review

## Final Experiment Classification

**NO_MATERIAL_SINGLE_TERM_FRAMING_INTERFERENCE**

All provenance and manipulation prerequisites pass. The selected single shared term, `standing`, did not reduce requested framing realization in either matched comparison. Upper-body framing showed 0/6 matched degradations and 5/6 improvements after adding the term; cowboy-shot framing showed 0/6 degradations and 2/6 improvements. The predeclared no-material-interference criterion is met because both treatment arms realize their requested framing in at least 5/6 panels and each matched degradation count is at most 1/6.

## Exact Prompt-Diff and Selected Term

- CAM-024 common prompt: `1girl, solo, neutral expression, front view, plain fitted sleeveless top, simple studio background` plus the terminal framing phrase.
- Terms shared by every CAM-021, CAM-022, and CAM-023 arm but absent from CAM-024: `standing`, `black shorts`, `barefoot`, `eye level`, `empty seamless studio`, and `plain floor`.
- Exactly one term was selected before generation: `standing`, prioritized as the most direct whole-subject composition instruction.
- A/C reproduce the exact CAM-024 upper-body/cowboy-shot prompts. B/D differ from their controls only by terminal `standing`. No visibility constraint or arms-at-sides term was added.

## Blinding and Provenance

- Panels: 24/24; missing or corrupt: 0.
- Fixed endpoint: `http://192.168.0.6:7860`; no fallback endpoint was used.
- Exact checkpoint SHA-256 `fa486caafc330f133605d3c18b418d183812f14946631c6544bfb28730db6d6f`, Euler a, Automatic, 20 steps, CFG 4.5, 1024×1024, and exact CAM-024 settings: PASS.
- Across matched pairs, the only positive-prompt difference is terminal `standing`; negative prompt and ordered fresh seeds are equal.
- response.parameters, parsed response.info, and structural infotext bindings: PASS 24/24.
- Observer input contained only opaque condition IDs, opaque panel IDs, image hashes/bytes, and pixels; prompt terms, requested framing, run mapping, and seeds were unavailable.
- Observer-input SHA-256: `045430538d7f0036318974b444997dc160d7d7a4ac1cd9ae8e6b4300479f3298`.
- Frozen observation SHA-256: `a1068cf1042f6f225d24f40eb92c30d5aa30d97d726f75d2936a2760ec3a5c2d`.
- Sealed mapping SHA-256: `00a1465a3edbddd600570a7c4a195d0ecd3f5f173f212a9cfbf72c5a96ced9a8`.
- Condition mapping was decoded only after the visual record was frozen; no frozen visual row changed after decode.

## Per-Arm Metrics and CAM-024 Comparison

| Run | Condition | Requested framing | Requested realization | Boundary assessable | Ambiguity/artifact | CAM-024 baseline |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| CAM-025-A | upper-body control | upper body | 1/6 | 6/6 | 0/6 | 6/6 |
| CAM-025-B | upper body + standing | upper body | 6/6 | 6/6 | 0/6 | 6/6 |
| CAM-025-C | cowboy-shot control | cowboy shot | 3/6 | 6/6 | 0/6 | 5/6 |
| CAM-025-D | cowboy shot + standing | cowboy shot | 5/6 | 6/6 | 0/6 | 5/6 |

## Matched-Seed Single-Term Effect

| Comparison | Framing degradation | Same requested-alignment state | Framing improvement |
| --- | ---: | ---: | ---: |
| upper body: A → B | 0/6 | 1/6 | 5/6 |
| cowboy shot: C → D | 0/6 | 4/6 | 2/6 |

The fresh A/C control realizations are weaker than CAM-024's archived 6/6 and 5/6 results, respectively. That variation does not support single-term interference: within the frozen matched-seed experiment, adding `standing` never caused a requested-framing loss and instead restored requested realization in the affected matches.

## Predeclared Classification Criteria

- `SINGLE_TERM_FRAMING_INTERFERENCE_SUPPORTED`: at least one control → treatment comparison has matched requested-framing degradation in at least 5/6 seeds, with reverse improvements at most 1/6.
- `NO_MATERIAL_SINGLE_TERM_FRAMING_INTERFERENCE`: both treatment arms realize requested framing in at least 5/6 panels and each comparison has degradation at most 1/6.
- `INCONCLUSIVE`: any provenance/manipulation/assessability/ambiguity prerequisite fails, or neither directional criterion is met.

CAM-025 satisfies the no-material criterion: B=6/6, D=5/6, degradation=0/6 for both comparisons, all four arms assessable=6/6, and ambiguity/artifact=0/6.

## Research Boundary

No PromptTag, camera framing slot, Concept Graph, compiler/runtime, advisory, UI, schema, platform, or production behavior change is authorized or implied.
