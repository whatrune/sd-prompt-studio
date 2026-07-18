# BRG Pose Evidence Inventory

## Scope and Source Boundary

This document inventories recorded Pose observations for BRG-011, BRG-012,
and BRG-013. It does not adopt Research Review conclusions, compare prompt
conditions, judge target success, or create an Evidence Rule.

Reviewed Run material:

- `research/sd-prompt-research/experiments/bridge/BRG-011-{A,B,C}/`
- `research/sd-prompt-research/experiments/bridge/BRG-012-{A,B,C}/`
- `research/sd-prompt-research/experiments/bridge/BRG-013-{A,B,C}/`
- each Run's `manifest.yaml`, `source/rubric.yaml`, `observation.json`,
  `observation.md`, and `research-review.md`

The observations for all nine Runs state that prompt differences and target
alignment were not assessed. Their `cross_condition_comparison.status` is
`not_performed`. Each manifest has status `OBSERVED`. Each reviewed
`research-review.md` remains an unfilled review template, so it provides no
completed Observed section, Working Conclusion, Confidence, or Visibility
Requirement to inventory.

## Run

### BRG-011

Pose:

- BRG-011-A records kneeling and prone-quadruped configurations.
- BRG-011-B records five kneeling backbend configurations and one
  hand-and-foot configuration.
- BRG-011-C records kneeling or prone-quadruped configurations and inverted
  hand-and-foot backbends.

Evidence Related Observations:

- Across 18 panels, `support_evidence_visibility` is recorded as `clear` in
  17 panels and `partial` in 1 panel.
- `hip_elevation` is recorded as `high` in 7 panels, `extreme` in 3, and
  `unclear` in 8.
- Hand, forearm, foot, knee, head, and shoulder surface-contact assignments
  are accompanied by `evidence_notes` describing visible contact boundaries,
  visible separation, or visible load paths.
- The `uncertain` entries record obscured pelvis-to-floor boundaries in 8
  panels and obscured head-to-floor boundaries in 4 panels.
- Three `support_orientation` entries and one `support_structure` entry are
  uncertain because the recorded visible relation did not map precisely, or
  mapped ambiguously, to the available Rubric values.

Necessary Visibility Conditions Recorded by the Materials:

- pelvis and support-surface boundary or clearance gap;
- head and support-surface boundary;
- hands, forearms, knees, and feet at their contact surfaces;
- the visible limb-to-surface load path; and
- enough side separation to distinguish a body region from the surface.

Uncertain Points:

- Folded legs, hair, facial overlap, and camera angle are recorded causes of
  uncertainty.
- The Existing Runs contain no Camera Visibility Metadata artifact, so no
  registered-region state can be paired with these panel observations.
- Whether an available `support_orientation` value should represent the
  recorded kneeling lower-body support remains an Architect/Rubric question;
  this inventory does not select a value.

### BRG-012

Pose:

- BRG-012-A records hand-and-foot backbends, seated, kneeling, and supported
  configurations, including platform contact.
- BRG-012-B records one hand-and-foot backbend with a block and kneeling or
  squatting configurations.
- BRG-012-C records kneeling hand support, a squat, seated rear-arm support,
  and standing or hand-and-foot configurations.

Evidence Related Observations:

- Across 18 panels, `support_evidence_visibility` is recorded as `clear` in
  16 panels and `partial` in 2 panels.
- `hip_elevation` is recorded as `extreme` in 4 panels, `high` in 3, `low` in
  3, `on_surface` in 3, and `unclear` in 5.
- All left/right foot surface-contact entries are recorded as `floor`; hand
  contacts include `floor`, `platform`, and `unknown_surface`.
- `evidence_notes` record contact boundaries and load paths involving floor,
  blocks, or platforms, and record visible separation for head and shoulders.
- The `uncertain` entries record 4 obscured pelvis-to-floor boundaries, 2
  unclear hand-load contributions, and 1 `support_orientation` vocabulary
  mismatch.

Necessary Visibility Conditions Recorded by the Materials:

- pelvis-to-floor or pelvis-to-platform boundary or clearance gap;
- hand or forearm contact with floor, block, platform, or another visible
  surface;
- hand and forearm load contribution, separately from contact alone;
- feet and knees at the support surface; and
- head and shoulder separation from the support surface.

Uncertain Points:

- Folded legs obscure the pelvis boundary in multiple panels.
- Visible hand-to-foot or fingertip contact did not always expose individual
  hand load contribution.
- The Existing Runs contain no Camera Visibility Metadata artifact, so the
  recorded `clear`/`partial` Pose value is not a Camera region-state record.
- The relation between `unknown_surface` and any future evidence prerequisite
  is not decided here.

### BRG-013

Pose:

- BRG-013-A records kneeling, four-point, seated-arch, and standing supported
  configurations, with raised furniture or platforms in five panels.
- BRG-013-B records kneeling, standing, prone four-point, and seated supported
  configurations, with raised posts or platforms in three panels.
- BRG-013-C records hand-and-foot, hand-and-knee, reverse four-point, and
  raised-block supported configurations.

Evidence Related Observations:

- Across 18 panels, `support_evidence_visibility` is recorded as `clear` in
  13 panels and `partial` in 5 panels.
- `hip_elevation` is recorded as `high` in 12 panels, `extreme` in 1,
  `on_surface` in 2, and `unclear` in 3.
- Hand surface-contact entries include `floor`, `platform`, `object`,
  `absent`, and `unclear`; foot entries include `floor`, `platform`,
  `not_visible`, and `unclear`.
- `evidence_notes` record visible load paths across floor, rails, posts,
  platforms, and a block.
- The `uncertain` entries record obscured pelvis, head, knee, and foot
  boundaries, side-view left/right ambiguity, an unclear hand load, and one
  `support_orientation` vocabulary mismatch.

Necessary Visibility Conditions Recorded by the Materials:

- the subject region and the specific floor, rail, post, platform, furniture,
  or object surface involved;
- pelvis-to-support boundary or clearance gap;
- separate visibility of hands, forearms, feet, and knees;
- left/right assignability where the Pose axis is side-specific; and
- continuous enough limb-to-surface visibility to record a load path.

Uncertain Points:

- Side-view overlap, framing, folded legs, hair, and rail/post occlusion are
  recorded causes of uncertainty.
- Existing `uncertain[].field` entries sometimes use grouping names rather
  than catalog axes, including `foot_surface_contact`,
  `lower_limb_surface_contact`, and `hand_and_foot_surface_contact`.
- The Existing Runs contain no Camera Visibility Metadata artifact, so no
  `hands`, `feet`, `knees`, `hips`, or other registered region state is
  available for direct comparison.

## Cross-Run Inventory Notes

- All nine Runs use Pose Observation Schema 3.0 and matching 28-axis Rubric
  catalogs. The same 21 axes are active in every Run.
- Pose `support_evidence_visibility` has values `clear`, `partial`, `occluded`,
  `out_of_frame`, and `unclear`. Camera Visibility Metadata uses separate
  region states `visible`, `partial`, `unclear`, and `not_visible`. No reviewed
  Contract defines equivalence between these value sets.
- Camera Visibility Metadata registers `head`, `face`, `hair`, `neck`,
  `shoulders`, `arms`, `hands`, `torso`, `hips`, `legs`, `knees`, and `feet`.
  This inventory lists those names only as available Architect inputs and does
  not prescribe a mapping.
- Research Review files were inspected as existing material, but their
  sections are unfilled templates; there is no recorded review conclusion to
  reproduce or promote.
