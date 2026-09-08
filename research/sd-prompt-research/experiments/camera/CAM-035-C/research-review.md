# CAM-035 Baseline Variance Calibration Research Review

## Review Status

Review Status:
APPROVE

## Review Summary

All 24 prompt-blind visible rows are consistent with the decoded mapping and permitted rubric. Exact endpoint/checkpoint identity, CAM-024 generation settings, 24 unique fresh seeds, one-response-per-request provenance, PNG integrity, assessability, and ambiguity prerequisites pass. The four independent pure-control batches realize upper body at CAM-035-A: 5/6, CAM-035-B: 2/6, CAM-035-C: 5/6, CAM-035-D: 5/6. The pooled rate is 17/24 and the observed batch-to-batch range is 2/6 to 5/6, a spread of 3/6.

## Frozen Design

- Four independent pure CAM-024 / CAM-033 upper-body control batches; no treatment terms.
- Six fresh collision-free seeds per batch; 24 panels total.
- Requested realization means exact `observed_framing == upper_body`.
- BASELINE_STABLE requires every batch at least 5/6 after all prerequisites pass.
- BASELINE_VARIABLE requires any batch at most 3/6 after all prerequisites pass.
- Otherwise the decision is INCONCLUSIVE.

## Metrics

| Batch | full_body | cowboy_shot | upper_body | close_up | assessable | ambiguity/artifact |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| CAM-035-A | 0/6 | 0/6 | 5/6 | 1/6 | 6/6 | 0/6 |
| CAM-035-B | 0/6 | 0/6 | 2/6 | 4/6 | 6/6 | 0/6 |
| CAM-035-C | 0/6 | 0/6 | 5/6 | 1/6 | 6/6 | 0/6 |
| CAM-035-D | 0/6 | 0/6 | 5/6 | 1/6 | 6/6 | 0/6 |

- Pooled upper-body realization: 17/24.
- Batch range: 2/6 to 5/6.
- Observed batch-to-batch spread: 3/6.
- Pooled framing distribution: full_body 0/24, cowboy_shot 0/24, upper_body 17/24, close_up 7/24, unknown 0/24.
- Framing boundary assessable: 24/24.
- Ambiguity/artifact: 0/24.

## Classification

**BASELINE_VARIABLE**

All prerequisites pass, and CAM-035-B realizes upper body in 2/6, which is at or below the predeclared variable threshold of 3/6. The stable rule fails because not every batch reaches 5/6. The closed decision is therefore BASELINE_VARIABLE.

## Provenance

- Task #686; base `68387396e8da25ceb0ae6c6327350d20462b8742`; execution `6c8b5047-3cf6-4858-9ce4-339348916b26`.
- Endpoint `http://192.168.0.6:7860`; fallback none; generation requests 24; retries 0.
- Checkpoint `novaAnimeXL_ilV190`; SHA-256 `fa486caafc330f133605d3c18b418d183812f14946631c6544bfb28730db6d6f`.
- Observer input SHA-256 `b68c0488bcb204b989fdfacb6fd17a81fbd713c529b0ceda9286031f0a7f642c`.
- Frozen observation SHA-256 `f3a47cde4156ba50f571fe970addee2d921ab6204187fa246c65a2df5ffc7ff5` at `2026-09-08T01:47:00.2073277Z`.
- Sealed mapping SHA-256 `5cbd7f02815f25408855efcd4f1dd8000317d0e79ca197db6078c354e43783db`; decoded at `2026-09-08T01:49:06.0785693Z`.
- Source-to-opaque byte equality and exact response parameter binding: 24/24.

## Research Boundary

This is bounded run-to-run baseline evidence. No treatment-effect, causal, production, Concept Graph, schema, platform, lifecycle, compiler, PromptTag, or prompt-data claim or change is made.
