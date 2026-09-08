# CAM-037 Two-Term Subbundle Interference Research Review

## Review Status

Review Status:
APPROVE

## Review Summary

All 96 prompt-blind visible rows satisfy the decoded mapping and permitted rubric. Runtime, seed, one-response-per-request, PNG/hash, assessability, ambiguity, and freeze-before-decode prerequisites pass. The pure control realizes `upper_body` in 7/24. None of the exact two-term arms passes the predeclared Holm-controlled directional paired test, so the bounded result is `INCONCLUSIVE`.

## Frozen Statistical Rule

- Each B/C/D treatment is compared with A using a one-sided exact McNemar/sign test conditional on discordant matched pairs.
- Degradation is A=`upper_body` and treatment not `upper_body`; improvement is the inverse.
- Holm step-down controls family-wise alpha 0.05 across the three raw p-values.
- A treatment is supported only if prerequisites pass, its realization is lower than A, degradation exceeds improvement, and its Holm hypothesis is rejected.
- The overall result supports interference if at least one exact two-term treatment is supported; it declares no material interference only if all three treatments have degradation no greater than improvement and realization at least A; otherwise it is `INCONCLUSIVE`.
- Frozen design SHA-256: `6842d232e60787752b4893925f3b563e283df4d68d3562a25703065f24e07b0f`.

## Metrics

| Arm | Exact terms | full_body | cowboy_shot | upper_body | close_up | assessable | ambiguity/artifact |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| CAM-037-A | none | 0/24 | 0/24 | 7/24 | 17/24 | 24/24 | 0/24 |
| CAM-037-B | standing + barefoot | 8/24 | 7/24 | 9/24 | 0/24 | 24/24 | 0/24 |
| CAM-037-C | standing + black shorts | 0/24 | 21/24 | 3/24 | 0/24 | 24/24 | 0/24 |
| CAM-037-D | barefoot + black shorts | 8/24 | 8/24 | 8/24 | 0/24 | 24/24 | 0/24 |

| Comparison | degradation | improvement | raw one-sided p | Holm adjusted p | Holm reject | wider | tighter | unchanged |
| --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| B vs A | 3/24 | 5/24 | 0.85546875 | 1 | no | 20/24 | 0/24 | 4/24 |
| C vs A | 5/24 | 1/24 | 0.109375 | 0.328125 | no | 22/24 | 0/24 | 2/24 |
| D vs A | 5/24 | 6/24 | 0.7255859375 | 1 | no | 22/24 | 0/24 | 2/24 |

## Classification

**INCONCLUSIVE**

No exact two-term bundle met the multiplicity-controlled interference rule. The standing + black shorts arm showed a directional 5-to-1 degradation count but its raw p=0.109375 and Holm-adjusted p=0.328125 do not establish the predeclared effect. The result is bounded to these terms, model, prompt family, seeds, and runtime and does not negate the supported exact three-term CAM-036 bundle.

## Provenance

- Task #692; base `6b2428780b44951ac7139639d4cf1985f48bfa5e`; execution `e0975f4a-1421-4428-bb9b-07d57b48e742`.
- Endpoint `http://192.168.0.6:7860`; fallback none; generation requests 96; retries 0.
- Checkpoint `novaAnimeXL_ilV190`; SHA-256 `fa486caafc330f133605d3c18b418d183812f14946631c6544bfb28730db6d6f`.
- Twenty-four unique collision-free seeds shared exactly across A/B/C/D.
- Observer input SHA-256 `4549560fbd87a5146329e9806d501e2988fddf39448186ec6a9b6291264b0944`.
- Frozen observation SHA-256 `156e30cfffa27976daba0c1a3991591a721a99ce3db9d31f113d26a1660c9875` at `2026-09-08T05:52:36.658Z`.
- Sealed mapping SHA-256 `a24db588bff4ff0528b61e73c435238bdcd131fb57cb81e74b670d1da01ca131`; decoded at `2026-09-08T05:59:36.495Z`.
- Source-to-opaque byte equality and response parameter identity: 96/96.

## Research Boundary

Research evidence only. No production, Concept Graph, schema, platform, PromptTag, compiler, or universal-causality claim or change is made.
