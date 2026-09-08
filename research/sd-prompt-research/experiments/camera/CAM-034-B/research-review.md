# CAM-034 Three-Term Bundle Replication Research Review

## Review Status

Review Status:
APPROVE

## Review Summary

All 12 prompt-blind visible rows are consistent with the decoded mapping and permitted rubric. Generation provenance, PNG integrity, assessability, and ambiguity prerequisites pass. The fresh control realizes `upper_body` in only 3/6, so the required stable-baseline prerequisite fails. The treatment realizes `upper_body` in 0/6 and matched degradation is 3/6; neither closed classification threshold is met. The result is therefore `INCONCLUSIVE`.

## Frozen design

- A is the exact CAM-024 / CAM-033 upper-body control.
- B differs only by terminal `standing, barefoot, black shorts`.
- Six fresh matched seeds were frozen before generation.
- Requested realization means exact `observed_framing == upper_body`.
- Matched degradation means A realizes `upper_body` and B does not; improvement is the inverse.

## Metrics

| Arm | full_body | cowboy_shot | upper_body | close_up | assessable | ambiguity/artifact |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| CAM-034-A | 0/6 | 0/6 | 3/6 | 3/6 | 6/6 | 0/6 |
| CAM-034-B | 4/6 | 2/6 | 0/6 | 0/6 | 6/6 | 0/6 |

- Matched degradation: 3/6.
- Matched improvement: 0/6.
- Matched unchanged: 3/6.
- A stable-baseline prerequisite (`upper_body >=5/6`): FAIL (3/6).

## Classification

**INCONCLUSIVE**

`THREE_TERM_BUNDLE_INTERFERENCE_SUPPORTED` requires all prerequisites and degradation at least 5/6; degradation is 3/6 and the control prerequisite fails. `NO_MATERIAL_THREE_TERM_BUNDLE_INTERFERENCE` requires all prerequisites, B realization at least 5/6, and degradation at most 1/6; B realization is 0/6. Therefore only `INCONCLUSIVE` is admitted.

## Provenance

- Task #684; base `e3d0f7b040e3d96adb9dc9504f0be6f089cb72c8`; execution `a4848f2b-1ec7-42ea-b07e-787cc91061ba`.
- Endpoint `http://192.168.0.6:7860`; fallback none; generation requests 12; retries 0.
- Checkpoint `novaAnimeXL_ilV190`; SHA-256 `fa486caafc330f133605d3c18b418d183812f14946631c6544bfb28730db6d6f`.
- Observer input SHA-256 `2f442ae0f3b283f9eeaa525c792386c0430cf3e662225a305ad5be6dfad54f3b`.
- Frozen observation SHA-256 `2c726ec0b88e5b670f17290e2fc9d4b77c064121752eefa29cbb5cabb4246139` at `2026-09-08T00:35:21.4574070Z`.
- Sealed mapping SHA-256 `0513c555ac55a66aa9678d5c1ffb9452661447fd2ce1e773f3e3ab1548dcea1b`; decoded at `2026-09-08T00:36:10.6625581Z`.
- Source-to-opaque byte equality: 12/12; response parameter identity: 12/12.

## Research boundary

This is directional evidence from six fresh seeds. No production, Concept Graph, schema, platform, lifecycle, compiler, prompt-data, or universal causal claim is made.
