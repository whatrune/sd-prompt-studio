# CAM-036 High-Sample Three-Term Bundle Effect Research Review

## Review Status

Review Status:
APPROVE

## Review Summary

All 48 prompt-blind visible rows are consistent with the decoded mapping and permitted rubric. Exact endpoint/checkpoint identity, CAM-024 settings, 24 unique fresh matched seeds, one-response-per-request provenance, PNG integrity, assessability, ambiguity, and freeze-before-decode prerequisites pass. The pure control realizes `upper_body` in 10/24 and the three-term treatment in 1/24. Across exact matched pairs there are 9 degradation discordances and 0 improvements; the predeclared one-sided exact McNemar/sign-test p-value is 0.001953125. The treatment is wider in 23/24 pairs, tighter in 0/24, and unchanged in 1/24.

## Frozen Design and Decision Rule

- A is the exact pure CAM-024 upper-body baseline.
- B differs only by terminal `standing, barefoot, black shorts`.
- Twenty-four repository-fresh seeds are shared exactly across A/B; 48 panels total.
- Degradation means A realizes `upper_body` and matched B does not; improvement is the inverse.
- The exact one-sided paired test conditions on discordant pairs under the null that degradation and improvement are equiprobable.
- `THREE_TERM_BUNDLE_INTERFERENCE_SUPPORTED` requires every prerequisite, lower B realization, degradation greater than improvement, and exact one-sided p <= 0.05.
- `NO_MATERIAL_THREE_TERM_BUNDLE_INTERFERENCE` requires every prerequisite, degradation no greater than improvement, and B realization at least A realization.
- Otherwise the result is `INCONCLUSIVE`.
- Frozen design contract SHA-256: `4d66de770a78bea9e18778c84a73b68bbeaae14b1bc569f6837ae5cee68fb6b0`.

## Metrics

| Arm | full_body | cowboy_shot | upper_body | close_up | assessable | ambiguity/artifact |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| CAM-036-A | 0/24 | 0/24 | 10/24 | 14/24 | 24/24 | 0/24 |
| CAM-036-B | 12/24 | 11/24 | 1/24 | 0/24 | 24/24 | 0/24 |

- Matched requested-framing degradation: 9/24.
- Matched improvement: 0/24.
- Paired net effect: 9/24 more degradation than improvement.
- Discordant pairs: 9/24; exact one-sided p = 0.001953125.
- Ordinal crop widening: 23/24.
- Ordinal crop tightening: 0/24.
- Ordinal crop unchanged: 1/24.

## Classification

**THREE_TERM_BUNDLE_INTERFERENCE_SUPPORTED**

All predeclared prerequisites pass. Treatment realization is lower than control, degradation exceeds improvement 9 to 0, and the exact one-sided paired p-value is below 0.05. The bounded high-sample evidence therefore supports interference by this exact three-term bundle; it does not identify which term or interaction is causal.

## Provenance

- Task #688; base `be1eb5e472eff85a6f331cc5a1929f379f21e13f`; execution `dd7704b2-d6d7-443b-b6e4-d52a9c3301ab`.
- Endpoint `http://192.168.0.6:7860`; fallback none; generation requests 48; retries 0.
- Checkpoint `novaAnimeXL_ilV190`; SHA-256 `fa486caafc330f133605d3c18b418d183812f14946631c6544bfb28730db6d6f`.
- Twenty-four unique collision-free seeds shared exactly across A/B.
- Observer input SHA-256 `9b6d81f104e433f369c30d3540c33f6e1b710b3b5fb091e10e94b8ecf36bd267`.
- Frozen observation SHA-256 `368a282a37a95ec42287a34c28fcb1b19b0eb298a7b28f6611816dc020d85ddc` at `2026-09-08T02:59:50.1200379Z`.
- Sealed mapping SHA-256 `a41bdc62496bd0d65e7fb6e2bdfcd6047d9ae6005b0b08f93d9e5e40765ea363`; decoded at `2026-09-08T03:01:22.3807721Z`.
- Source-to-opaque byte equality and response parameter identity: 48/48.

## Research Boundary

This is bounded evidence for the exact three-term bundle under the frozen runtime. No single-term attribution, universal causality, production, Concept Graph, schema, platform, lifecycle, compiler, PromptTag, or prompt-data claim or change is made.
