# CAM-026 Prompt-Blind Research Review

## Final Experiment Classification

**INCONCLUSIVE**

Exact generation and prompt-manipulation provenance passes 24/24, but the selected single term, `barefoot`, does not satisfy either directional classification. The upper-body comparison has 3/6 matched requested-framing degradations and 2/6 reverse improvements; its treatment also has 4/6 framing-ambiguous panels, exceeding the inherited prerequisite. The cowboy-shot comparison has 0/6 degradations and 0/6 improvements. Therefore neither the ≥5/6 interference criterion nor the no-material criterion is met.

## Exact Prompt-Diff and Selected Term

- CAM-024 common prompt: `1girl, solo, neutral expression, front view, plain fitted sleeveless top, simple studio background` plus the terminal framing phrase.
- Terms shared by every CAM-021, CAM-022, and CAM-023 arm but absent from CAM-024: `standing`, `black shorts`, `barefoot`, `eye level`, `empty seamless studio`, and `plain floor`.
- CAM-025 already found no material single-term interference from `standing`, so it was excluded.
- Exactly one remaining term was selected before generation: `barefoot`, prioritized because it cues a distal body region and is the strongest remaining plausible widening influence.
- A/C reproduce the exact CAM-024 upper-body/cowboy-shot prompts. B/D differ from their controls only by terminal `barefoot`.

## Blinding and Provenance

- Panels: 24/24; missing or corrupt: 0.
- Fixed endpoint: `http://192.168.0.6:7860`; no fallback endpoint was used.
- Exact checkpoint SHA-256 `fa486caafc330f133605d3c18b418d183812f14946631c6544bfb28730db6d6f`, Euler a, Automatic, 20 steps, CFG 4.5, 1024×1024, and exact CAM-024 settings: PASS.
- Across matched pairs, the only positive-prompt difference is terminal `barefoot`; negative prompt and ordered fresh seeds are equal.
- response.parameters, parsed response.info, and structural infotext bindings: PASS 24/24.
- Observer input exposed only opaque condition IDs, opaque panel IDs, image hashes, and pixels; prompts, seeds, requested framing, run mapping, and emitted terms were withheld.
- Observer-input SHA-256: `0b987001f82dabb1508f9f398040b74510d55b1a881df2d7f6ad6b8ab4149e40`.
- Frozen observation SHA-256: `0fe4c5669ad2aa5bcbd18cfbbe7a4f60657f0b606dfd12f09ecd57a9196124c1`.
- Sealed mapping SHA-256: `f4e133f6dd53a0c6c334a050e5449068e7e014b270a569ec8963829fddefd32e`.
- Condition mapping was decoded only after the visible record was frozen and hashed; no frozen visual row changed after decode.

## Per-Arm Metrics and CAM-024 Comparison

| Run | Condition | Requested framing | Requested realization | Boundary assessable | Ambiguity/artifact | CAM-024 baseline |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| CAM-026-A | upper-body control | upper body | 3/6 | 6/6 | 0/6 | 6/6 |
| CAM-026-B | upper body + barefoot | upper body | 2/6 | 2/6 | 4/6 | 6/6 |
| CAM-026-C | cowboy-shot control | cowboy shot | 6/6 | 6/6 | 0/6 | 5/6 |
| CAM-026-D | cowboy shot + barefoot | cowboy shot | 6/6 | 6/6 | 0/6 | 5/6 |

## Matched-Seed Single-Term Effect

| Comparison | Framing degradation | Same requested-alignment state | Framing improvement |
| --- | ---: | ---: | ---: |
| upper body: A → B | 3/6 | 1/6 | 2/6 |
| cowboy shot: C → D | 0/6 | 6/6 | 0/6 |

The repeated foreshortened/seated foot intrusions in B are a real visible response to the treatment context, but four panels lack a stable canonical ordinal crop boundary. That ambiguity prevents attributing a threshold-level framing-realization loss to `barefoot` alone.

## Predeclared Classification Criteria

- `SINGLE_TERM_FRAMING_INTERFERENCE_SUPPORTED`: at least one control → treatment comparison has matched requested-framing degradation in at least 5/6 seeds, with reverse improvements at most 1/6.
- `NO_MATERIAL_SINGLE_TERM_FRAMING_INTERFERENCE`: both treatment arms realize requested framing in at least 5/6 panels and each comparison has degradation at most 1/6.
- `INCONCLUSIVE`: any provenance/manipulation/assessability/ambiguity prerequisite fails, or neither directional criterion is met.

CAM-026 is `INCONCLUSIVE`: B ambiguity is 4/6 and assessability 2/6; A→B degradation is only 3/6 with 2/6 reverse improvements; B requested realization is 2/6. C and D are both stable cowboy shots at 6/6.

## Research Boundary

No PromptTag, camera framing slot, Concept Graph, compiler/runtime, advisory, UI, schema, platform, or production behavior change is authorized or implied.
