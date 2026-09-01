# CAM-004 Prompt-Blind Research Review

## Final Experiment Classification

**CONFIRMED_ORDERED_FRAMING_SLOT_DISCRIMINATION**

All provenance and manipulation prerequisites pass. Each requested framing is visibly represented in 6/6 panels, every adjacent framing step is tighter in 6/6 matched seeds, and no adjacent reversal or framing ambiguity/artifact was observed.

## Blinding and Provenance

- Panels: 24/24; missing or corrupt: 0.
- Exact model/hash, Euler a, Automatic, 20 steps, CFG 4.5, 1024×1024, and frozen settings: PASS.
- Across runs, the only positive-prompt difference is the terminal framing phrase; negative prompts and ordered seeds are equal.
- response.parameters, parsed response.info, and structural infotext bindings: PASS 24/24.
- Observer input contained only opaque condition IDs, opaque panel IDs, and pixels; requested framing, run mapping, prompt terms, and seeds were unavailable.
- Frozen observation SHA-256: 4474d955e559885a04a24a283da6feda7275eff985a098294c968f6112804f2f (8709 bytes).
- Condition mapping was decoded only after the visual record was frozen; no visual row was changed after decode.

## Per-Arm Metrics

| Run | Requested framing | Observed requested framing | Boundary assessable | Ambiguity/artifact |
| --- | --- | ---: | ---: | ---: |
| CAM-004-A | full body | 6/6 | 6/6 | 0/6 |
| CAM-004-B | cowboy shot | 6/6 | 6/6 | 0/6 |
| CAM-004-C | upper body | 6/6 | 6/6 | 0/6 |
| CAM-004-D | close-up | 6/6 | 6/6 | 0/6 |

## Adjacent Matched-Seed Discrimination

| Adjacent comparison | Tighter | Same | Reverse |
| --- | ---: | ---: | ---: |
| full body → cowboy shot | 6/6 | 0/6 | 0/6 |
| cowboy shot → upper body | 6/6 | 0/6 | 0/6 |
| upper body → close-up | 6/6 | 0/6 | 0/6 |

The predeclared confirmed branch requires every adjacent step to be tighter in at least 5/6 matched seeds with zero reversals. All three adjacent steps are tighter in 6/6 with zero reversals, so the classification is selected without threshold adjustment.

## Research Boundary

No PromptTag, camera_framing slot, Concept Graph, compiler/runtime, production advisory, UI, schema, or platform change is authorized or implied. Production and Graph decisions remain deferred.
