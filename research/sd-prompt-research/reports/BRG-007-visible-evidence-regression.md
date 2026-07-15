# BRG-007 Visible Evidence Regression Audit

## Scope

- Regression audit and promotion record for the revised Image Analyst evidence policy.
- The reanalysis candidates were validated and visually reviewed before promotion to the canonical `observation.json` files.
- This report contains image observations only. It does not judge Prompt success, Concept Leakage, or research conclusions.
- The preview composites were reviewed at their available resolution. When a direct boundary, clearance gap, or load path was not visible enough, the candidate outcome is `unclear`.

## Policy-validation result against historical observations

The historical JSON remains Schema v3.0-valid under its original rubric. When its confirmed values and Evidence Notes are checked against the new opt-in visible-evidence policy, the following claims require either stronger direct Evidence Notes or a less certain value:

| Run | Policy findings | Main affected fields |
|---|---:|---|
| BRG-007-A | 22 | hip_elevation, head_surface_contact, shoulder_surface_contact, support_orientation, confidence |
| BRG-007-B | 30 | hip_elevation, head_surface_contact, shoulder_surface_contact, support_orientation, contact_load |
| BRG-007-C | 18 | hip_elevation, head_surface_contact, shoulder_surface_contact, support_orientation |

These counts are validator findings, not failure counts.

## Reanalysis results

### BRG-007-A

- Body State remains lying-centered.
- Historical `hip_elevation: on_surface` cannot be retained from Body State alone. At preview resolution, the pelvis-to-floor boundary is not consistently direct enough across all panels; affected panels become `unclear` unless a panel-level source image exposes the boundary.
- Historical all-panel head and shoulder contact cannot be copied from lying/face-up. Direct hair/shoulder boundaries must be recorded panel by panel; obscured boundaries become `unclear`.
- `support_orientation: supine_support` is not copied from `body_orientation: face_up`. Use `posterior_body_support` only where a visible posterior-body support relation is documented; otherwise use `unclear`.
- No hand or forearm `supporting`/`weight_bearing` value is introduced.

### BRG-007-B

- Body State remains reclined-centered and observed morphology remains `reclined_arm_support`-centered.
- Historical `hip_elevation: low` is not supported by a directly visible pelvis-to-floor clearance gap in the preview panels. The strict candidate is `unclear`, not an inference from the raised torso.
- The visible rear hand/arm support relationship in panels 2-6 is represented by `support_orientation: rear_arm_support`; panel 1 remains `unclear` because the support path is incomplete.
- Head and shoulder `absent` values require notes identifying direct visible separation. Where separation or the boundary is obscured, the value becomes `unclear`.
- Existing `supporting` hand/forearm values are retained only where the visible limb, surface contact, and stabilizing load path are all stated in Evidence Notes; a contact-only note is insufficient.
- Prompt / Concept Leakage remains `not assessed`.

### BRG-007-C

- Body State remains lying-centered.
- Historical all-panel `hip_elevation: on_surface` is not retained without a visible pelvis-to-floor contact boundary; affected panels become `unclear`.
- Arm and forearm floor contact does not create a `supporting` load value. The existing light/unclear pattern remains the upper bound unless a direct load path is visible.
- Historical all-panel head and shoulder contact is reduced to panel-specific direct evidence; obscured hair/clothing boundaries become `unclear`.
- `arms supporting body` is Prompt text and is not evidence for Contact Load or Support Orientation.
- Prompt / Concept Leakage remains `not assessed`.

## Output-separation check

- Visual Artifacts: `none observed` for all three historical Runs.
- Prompt / Concept Leakage: `not assessed` for all three Runs because research comparison was not performed.
- Observed Morphologies include `reclined_arm_support` and `seated_arch` for BRG-007-B without labeling either as failure or leakage.

## Canonical-data handling

The validated reanalysis results were promoted to the canonical BRG-007 observations. The pre-policy JSON and Markdown files remain in each Run folder as `observation.pre-visible-evidence-policy.json` and `observation.pre-visible-evidence-policy.md`. The reanalysis candidates also remain as `observation.reanalysis.json` and `observation.reanalysis.md` for provenance.
