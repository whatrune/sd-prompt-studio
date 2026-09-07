# CAM-033 Upper-Body Baseline Replication Research Review

## Review Status

Review Status:
APPROVE

## Review Summary

The six frozen prompt-blind rows are consistent with the permitted rubric and decoded source mapping. All predeclared provenance, assessability, ambiguity, and realization prerequisites pass.

## Scope

- Image-to-Observation consistency
- Observation Schema consistency
- Rubric Evidence Policy consistency
- Computed Aggregate consistency
- Single-run provenance and prompt-blind hash binding
- Predeclared stability classification

## Critical Findings

None

## Warnings

None

## Observed Distribution

| Framing category | Count |
| --- | ---: |
| full_body | 0/6 |
| cowboy_shot | 0/6 |
| upper_body | 6/6 |
| close_up | 0/6 |
| unknown | 0/6 |

- Framing boundary assessable: 6/6.
- Ambiguity/artifact: 0/6.
- Knees not visible: 6/6; feet not visible: 6/6.
- Lower crop distribution: waist 2/6, chest 4/6.

## Validation Status

Validation Status:

- Observation Schema: PASS
- Rubric Evidence Policy: PASS
- Computed Aggregate: PASS
- Derived Index: PASS
- Generation provenance and source/opaque pixel equality: PASS 6/6

## Research Interpretation Boundary

Research Interpretation: Performed only for the explicitly authorized, predeclared CAM-033 stability decision. No causal, treatment, Concept Graph, PromptTag, compiler, or production claim is made.

## Working Conclusion

**UPPER_BODY_BASELINE_STABLE**

All prerequisites pass: exact runtime and response provenance 6/6, PNG integrity and 1024x1024 dimensions 6/6, prompt-blind freeze before decode, framing boundary assessable 6/6, and ambiguity/artifact 0/6. Upper-body realization is 6/6, exceeding the frozen stable-enough threshold of at least 5/6. The full framing distribution is full_body 0/6, cowboy_shot 0/6, upper_body 6/6, close_up 0/6, unknown 0/6.

This six-seed result supports using the current upper-body baseline for further bounded interference experiments. It is directional evidence and does not establish universal generation reliability.

## Provenance and Frozen Record

- Task: #680; base: `46aad2f0736d88f66a1692acc50ed1485298b6cc`; execution: `42fe0882-0a2e-4764-8713-0ac35198e350`.
- Fixed endpoint: `http://192.168.0.6:7860`; fallback and retry: none.
- Observer input SHA-256: `85d6ce095a6fe95a571d9324ea8bc7bf3d91dd857838d172ab11bc6c7617eba8`.
- Frozen observation SHA-256: `273ef208e280effcd5db9a5be9da2300a6695491483d31b63671c5a68f2c9632`.
- Sealed mapping SHA-256: `e038eeb1494525aeebc600d66e3c86040c83bc673f763f112474e869139f5aab`.
- Frozen at `2026-09-07T16:24:40.5732004Z`; decoded at `2026-09-07T16:26:08.7300098+00:00`.
- Source/opaque pixel equality and response parameter binding: 6/6.

## Modification Status

Modification Status:

Files Modified:
None by Research Review OP.

## Next Action

- Complete atomic Run Ledger admission and the repository-owned RESEARCH_EXPERIMENT validation profile, then publish through the normal simplified lifecycle.

## Contract Boundary

No production, Concept Graph, schema, platform, workflow, validator, PromptTag, prompt-data, or other Run change is authorized or implied.
