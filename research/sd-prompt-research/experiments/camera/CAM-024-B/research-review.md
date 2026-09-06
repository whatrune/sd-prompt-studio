# CAM-024 Prompt-Blind Research Review

## Final Experiment Classification

**FRAMING_BASELINE_REPLICATED**

All provenance and manipulation prerequisites pass. The original CAM-004 ordered framing effect reproduces: every adjacent framing step is tighter in 6/6 fresh matched seeds with zero reversals, all 24 framing boundaries are assessable, and ambiguity/artifact is 0/24. Cowboy-shot categorical realization is 5/6 rather than CAM-004's 6/6, but the one tighter realization remains ordinally between its full-body and upper-body matches and does not break the predeclared replication criterion.

## Blinding and Provenance

- Panels: 24/24; missing or corrupt: 0.
- Fixed endpoint: `http://192.168.0.6:7860`; no fallback endpoint was used.
- Exact checkpoint SHA-256 `fa486caafc330f133605d3c18b418d183812f14946631c6544bfb28730db6d6f`, Euler a, Automatic, 20 steps, CFG 4.5, 1024×1024, and archived CAM-004 settings: PASS.
- Across runs, the only positive-prompt difference is the terminal archived CAM-004 framing phrase; negative prompts and ordered fresh seeds are equal.
- response.parameters, parsed response.info, and structural infotext bindings: PASS 24/24.
- Observer input contained only opaque condition IDs, opaque panel IDs, and pixels; requested framing, run mapping, prompt terms, and seeds were unavailable.
- Observer-input SHA-256: `369c60903bf11391d1cf166278388715b39a7cccb7ad1a7b75699d63e2bd30c4`.
- Frozen observation SHA-256: `8cfc84aa030c1ff0a6563ac6509b4770b0308df0a11a7300708972bd2c19a03a`.
- Sealed mapping SHA-256: `e6448fd594356b564cb1f91170ee88d20984a2b184de0c8293eea875103df6f3`.
- Condition mapping was decoded only after the visual record was frozen; no frozen visual row changed after decode.

## Per-Arm Metrics and CAM-004 Comparison

| Run | Requested framing | CAM-024 requested framing | Boundary assessable | Ambiguity/artifact | CAM-004 requested framing |
| --- | --- | ---: | ---: | ---: | ---: |
| CAM-024-A | full body | 6/6 | 6/6 | 0/6 | 6/6 |
| CAM-024-B | cowboy shot | 5/6 | 6/6 | 0/6 | 6/6 |
| CAM-024-C | upper body | 6/6 | 6/6 | 0/6 | 6/6 |
| CAM-024-D | close-up | 6/6 | 6/6 | 0/6 | 6/6 |

## Adjacent Matched-Seed Discrimination

| Adjacent comparison | CAM-024 tighter | Same | Reverse | CAM-004 tighter |
| --- | ---: | ---: | ---: | ---: |
| full body → cowboy shot | 6/6 | 0/6 | 0/6 | 6/6 |
| cowboy shot → upper body | 6/6 | 0/6 | 0/6 | 6/6 |
| upper body → close-up | 6/6 | 0/6 | 0/6 | 6/6 |

The frozen replicated branch requires every adjacent step to be tighter in at least 5/6 matched seeds with zero reversals and all provenance/manipulation prerequisites to pass. CAM-024 meets that criterion without threshold adjustment and matches CAM-004's 6/6 result on every adjacent comparison.

## Research Boundary

No PromptTag, camera_framing slot, Concept Graph, compiler/runtime, production advisory, UI, schema, or platform change is authorized or implied. Production and Graph decisions remain deferred.
