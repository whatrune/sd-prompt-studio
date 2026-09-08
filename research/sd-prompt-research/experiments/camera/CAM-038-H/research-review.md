# CAM-038 Three-Factor Framing Interaction Research Review

## Review Status

Review Status:
APPROVE

## Review Summary

All 192 prompt-blind visible rows satisfy the decoded mapping and permitted rubric. Runtime, seed, one-response-per-request, PNG/hash, assessability, ambiguity, and freeze-before-decode prerequisites pass. The bounded classification is `FACTORIAL_FRAMING_EFFECTS_IDENTIFIED`. Holm-controlled effects supported by the predeclared factorial family are: S=-0.28125 (Holm p=0.000782012939453125), B=-0.21875 (Holm p=0.00970458984375), K=0.260416667 (Holm p=0.00537109375), SxB=-0.40625 (Holm p=0.0000133514404296875), BxK=-0.322916667 (Holm p=0.0000457763671875).

## Frozen Statistical Rule

- Complete matched-seed 2^3 blocks estimate standard effect-coded main effects S/B/K, two-way interactions SxB/SxK/BxK, and the three-way interaction SxBxK on binary upper-body realization.
- Each factorial hypothesis uses a two-sided exact within-seed sign-flip randomization test; Holm controls family-wise alpha 0.05 across all seven hypotheses.
- Each B-H condition also has a predeclared one-sided exact McNemar/sign comparison with A; a separate Holm family controls those seven degradation comparisons.
- Non-rejection is not equivalence and no post-hoc threshold is used.
- Frozen design SHA-256: `5f2fd967c23421fa36aaf2ffb97a7d6e400c52621f68cbe0b960a4e651679af5`.

## Arm Metrics

| Arm | Exact terms | full_body | cowboy_shot | upper_body | close_up | assessable | ambiguity/artifact |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| CAM-038-A | pure upper-body control | 0/24 | 0/24 | 5/24 | 19/24 | 24/24 | 0/24 |
| CAM-038-B | standing | 0/24 | 0/24 | 11/24 | 13/24 | 24/24 | 0/24 |
| CAM-038-C | barefoot | 0/24 | 2/24 | 18/24 | 4/24 | 24/24 | 0/24 |
| CAM-038-D | black shorts | 0/24 | 0/24 | 22/24 | 2/24 | 24/24 | 0/24 |
| CAM-038-E | standing + barefoot | 9/24 | 10/24 | 3/24 | 2/24 | 24/24 | 0/24 |
| CAM-038-F | standing + black shorts | 0/24 | 1/24 | 22/24 | 1/24 | 24/24 | 0/24 |
| CAM-038-G | barefoot + black shorts | 5/24 | 1/24 | 18/24 | 0/24 | 24/24 | 0/24 |
| CAM-038-H | standing + barefoot + black shorts | 13/24 | 11/24 | 0/24 | 0/24 | 24/24 | 0/24 |

## Factorial Effects

| Effect | estimate | raw two-sided p | Holm adjusted p | Holm reject |
| --- | ---: | ---: | ---: | --- |
| S | -0.28125 | 0.000156402587890625 | 0.000782012939453125 | yes |
| B | -0.21875 | 0.00323486328125 | 0.00970458984375 | yes |
| K | 0.260416667 | 0.0013427734375 | 0.00537109375 | yes |
| SxB | -0.40625 | 0.0000019073486328125 | 0.0000133514404296875 | yes |
| SxK | -0.09375 | 0.03125 | 0.0625 | no |
| BxK | -0.322916667 | 0.00000762939453125 | 0.0000457763671875 | yes |
| SxBxK | 0.03125 | 0.70703125 | 0.70703125 | no |

The SxK effect and three-way SxBxK interaction do not reject after Holm correction. Their non-rejection is not evidence of equivalence or absence.

## Control Comparisons

| Comparison | degradation | improvement | raw one-sided p | Holm adjusted p | Holm reject | wider | tighter | unchanged |
| --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| B vs A | 0/24 | 6/24 | 1 | 1 | no | 6/24 | 0/24 | 18/24 |
| C vs A | 0/24 | 13/24 | 1 | 1 | no | 15/24 | 0/24 | 9/24 |
| D vs A | 0/24 | 17/24 | 1 | 1 | no | 17/24 | 0/24 | 7/24 |
| E vs A | 5/24 | 3/24 | 0.36328125 | 1 | no | 22/24 | 0/24 | 2/24 |
| F vs A | 1/24 | 18/24 | 0.9999980926513672 | 1 | no | 19/24 | 0/24 | 5/24 |
| G vs A | 2/24 | 15/24 | 0.9998626708984375 | 1 | no | 21/24 | 0/24 | 3/24 |
| H vs A | 5/24 | 0/24 | 0.03125 | 0.21875 | no | 24/24 | 0/24 | 0/24 |

## Classification

**FACTORIAL_FRAMING_EFFECTS_IDENTIFIED**

The supported effects are bounded to this exact checkpoint, prompt family, runtime, seeds, and the tested terms. In particular, the predeclared three-way interaction was not supported; this result does not establish universal or model-general causal effects.

## Provenance

- Task #694; base `41a69323033feffcc1f1852f9ae592007a31019f`; execution `be35fe03-5450-4d9e-a392-315d56734781`.
- Endpoint `http://192.168.0.6:7860`; fallback none; generation requests 192; retries 0.
- Checkpoint `novaAnimeXL_ilV190`; SHA-256 `fa486caafc330f133605d3c18b418d183812f14946631c6544bfb28730db6d6f`.
- Twenty-four unique collision-free seeds shared exactly across A-H.
- Observer input SHA-256 `3e55edb797e4d9e908b0d5a246911332ddcec1fdfd69d9f340026786ab59f1f4`.
- Frozen observation SHA-256 `356999a76bb3c5f7f7a2c8d7d577f2fc3250de4be9bc12dd46fad5dbbcddc483` at `2026-09-08T09:03:28.4669432Z`.
- Sealed mapping SHA-256 `c097c231cd3e51a48f74247d787712b751b1699ab074205156378dbf63eb700d`; decoded at `2026-09-08T09:18:58.513Z`.
- Source-to-opaque byte equality and response parameter identity: 192/192.

## Research Boundary

Research evidence only. No production, Concept Graph, schema, platform, PromptTag, compiler, or universal-causality claim or change is made.
