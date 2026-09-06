# CAM-027 Prompt-Blind Research Review

## Final Experiment Classification

**INCONCLUSIVE**

Exact generation and prompt-manipulation provenance passes 24/24. The selected single term, `black shorts`, does not satisfy either directional classification. In the upper-body pair, the treatment improves requested-framing realization in 4/6 matched seeds, degrades it in 1/6, and is unchanged in 1/6; treatment realization is 4/6, below the predeclared 5/6 prerequisite for the no-material result. In the cowboy-shot pair, requested-framing realization is unchanged in 6/6 seeds. Therefore neither the ≥5/6 interference criterion nor all no-material prerequisites are met.

## Exact Prompt-Diff and Selected Term

- CAM-024 common prompt: `1girl, solo, neutral expression, front view, plain fitted sleeveless top, simple studio background` plus the terminal framing phrase.
- Terms shared by CAM-021, CAM-022, and CAM-023 but absent from CAM-024: `standing`, `black shorts`, `barefoot`, `eye level`, `empty seamless studio`, and `plain floor`.
- CAM-025 tested `standing`; CAM-026 tested `barefoot`; both were excluded.
- Exactly one remaining term was selected before generation: `black shorts`, prioritized as the strongest remaining composition influence because it explicitly cues a lower-body garment and may encourage its inclusion.
- A/C reproduce the exact CAM-024 upper-body/cowboy-shot prompts. B/D differ from their controls only by terminal `black shorts`.

## Blinding and Provenance

- Panels: 24/24; missing or corrupt: 0.
- Fixed endpoint: `http://192.168.0.6:7860`; fallback used: no.
- Checkpoint: `novaAnimeXL_ilV190`; SHA-256: `fa486caafc330f133605d3c18b418d183812f14946631c6544bfb28730db6d6f`.
- Fresh matched seeds: `1363392246`, `310926094`, `1163881650`, `1059852692`, `532007259`, `600181106`.
- Observer input SHA-256: `9e5a70cfb8b062125a64e0daf20bb48f206e37d6b858f6676110e8a2ae9d9b68`.
- Frozen observation SHA-256: `3d87d38184dcdf5a2e82961583ddb9b74a3267c329d6d61c271c33fef4d7ac48`.
- Sealed mapping SHA-256: `cbad898ede4604d0daf761189462ab595aeb2b960a89ddebfff68a6f47b14ec7`.
- Prompt, seed, requested framing, selected term, run ID, and condition mapping were withheld until the 24-panel record was frozen.
- The tracked CAM-027-A metadata is the single prompt-blind record owner; B/C/D bind its exact owner path and content hashes.

## Per-Arm Metrics

| Run | Condition | Requested framing | Assessable | Ambiguity/artifact | CAM-024 baseline |
|---|---|---:|---:|---:|---:|
| CAM-027-A | upper body baseline | 1/6 | 6/6 | 0/6 | 6/6 |
| CAM-027-B | upper body + black shorts | 4/6 | 6/6 | 1/6 | 6/6 |
| CAM-027-C | cowboy shot baseline | 6/6 | 6/6 | 1/6 | 5/6 |
| CAM-027-D | cowboy shot + black shorts | 6/6 | 6/6 | 1/6 | 5/6 |

## Matched-Seed Results

- A → B requested-framing degradation: **1/6**.
- A → B requested-framing improvement: **4/6**.
- A → B unchanged requested-framing state: **1/6**.
- C → D requested-framing degradation: **0/6**.
- C → D requested-framing improvement: **0/6**.
- C → D unchanged requested-framing state: **6/6**.

## Predeclared Classification Application

- `SINGLE_TERM_FRAMING_INTERFERENCE_SUPPORTED` requires material matched degradation (≥5/6) with the frozen ambiguity prerequisite. Neither pair reaches it.
- `NO_MATERIAL_SINGLE_TERM_FRAMING_INTERFERENCE` requires both treatment arms to realize their requested framing in ≥5/6 panels, matched degradation ≤1/6 for each pair, and ambiguity/artifact ≤1/6 for each arm. CAM-027-B realizes upper-body framing only 4/6, so this classification is not admitted.
- The frozen ambiguity/artifact prerequisite is satisfied (all arms ≤1/6), but no directional result meets every prerequisite.

**Decision: INCONCLUSIVE.**

No production or Concept Graph conclusion is admitted by this Task.
