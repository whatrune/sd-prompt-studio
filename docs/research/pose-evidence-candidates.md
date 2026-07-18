# Pose Evidence Candidates

## Scope

These are candidate inputs for future Architect design. They are not
Canonical Rules, do not select allowed or forbidden Observation values, and
do not define `all_of`, `any_of`, allowed Camera states, or fallbacks.

Related Visibility Region names are transcribed from Camera Visibility
Metadata Foundation v0.1.0. Each proposed association remains subject to
Architect review.

## Candidate

Axis: `hip_elevation`

Required Observation:

- A recorded pelvis-to-support-surface contact boundary or clearance gap.

Related Visibility Region:

- `hips`

Potential Evidence Concern:

- Folded legs, clothing, another body part, shadow, crop, or camera angle can
  hide the boundary; BRG-011/012/013 contain `unclear` examples.

Source:

- `research/sd-prompt-research/templates/rubric-template.yaml`
  (`axis_catalog.hip_elevation.evidence_policy`)
- BRG-011/012/013 `observation.json` evidence and uncertainty entries

## Candidate

Axis: `support_structure`

Required Observation:

- Recorded body regions that form the support path and their visible surface
  relations.

Related Visibility Region:

- Candidate regions: `head`, `shoulders`, `arms`, `hands`, `torso`, `hips`,
  `legs`, `knees`, `feet`

Potential Evidence Concern:

- A visible contact does not by itself record load contribution; one
  BRG-011-C panel records the support structure as uncertain because an
  additional support path is ambiguous.

Source:

- `research/sd-prompt-research/templates/rubric-template.yaml`
  (`axis_catalog.support_structure`)
- `research/sd-prompt-research/experiments/bridge/BRG-011-C/observation.json`

## Candidate

Axis: `support_orientation`

Required Observation:

- Direction and relationship of the recorded visible support path.

Related Visibility Region:

- Candidate regions: `head`, `shoulders`, `arms`, `hands`, `torso`, `hips`,
  `legs`, `knees`, `feet`

Potential Evidence Concern:

- BRG-011/012/013 uncertainty entries record visible support relations for
  which the available Rubric values did not provide a precise match. This is
  a Rubric/Architect question, not a value decision in this inventory.

Source:

- `research/sd-prompt-research/templates/rubric-template.yaml`
  (`axis_catalog.support_orientation.definition`)
- BRG-011/012/013 `observation.json` uncertainty entries

## Candidate

Axis: `left_hand_surface_contact`, `right_hand_surface_contact`

Required Observation:

- Each side's hand and the recorded contact surface or visible separation.

Related Visibility Region:

- `hands`

Potential Evidence Concern:

- Side-view overlap can prevent left/right assignment; contact and load
  contribution are recorded separately in the Existing Runs.

Source:

- `research/sd-prompt-research/templates/rubric-template.yaml`
- `research/sd-prompt-research/experiments/bridge/BRG-013-B/observation.json`

## Candidate

Axis: `left_forearm_surface_contact`, `right_forearm_surface_contact`

Required Observation:

- Each forearm and the recorded contact surface or visible separation.

Related Visibility Region:

- `arms`

Potential Evidence Concern:

- Hand contact and forearm contact coexist as separate axes; occlusion near a
  shared surface can leave only one boundary observable.

Source:

- `research/sd-prompt-research/templates/rubric-template.yaml`
- BRG-011/012/013 `observation.json` evidence notes

## Candidate

Axis: `left_foot_surface_contact`, `right_foot_surface_contact`

Required Observation:

- Each side's foot and the recorded contact surface or visible separation.

Related Visibility Region:

- `feet`

Potential Evidence Concern:

- Overlap, framing, and rail/post occlusion prevented side-specific assignment
  in BRG-013 panels.

Source:

- `research/sd-prompt-research/templates/rubric-template.yaml`
- BRG-013 `observation.json` uncertainty entries

## Candidate

Axis: `foot_contact_mode`

Required Observation:

- The visible portion of the foot or feet meeting the support surface.

Related Visibility Region:

- `feet`

Potential Evidence Concern:

- A foot may be visible while the exact contact boundary or left/right mode is
  obscured.

Source:

- `research/sd-prompt-research/templates/rubric-template.yaml`
- BRG-013 `observation.json` evidence and uncertainty entries

## Candidate

Axis: `head_surface_contact`

Required Observation:

- A direct head-to-surface contact boundary or direct visible separation.

Related Visibility Region:

- Candidate regions: `head`, `hair`

Potential Evidence Concern:

- Hair, shadow, crop, overlap, or camera angle can hide the boundary;
  BRG-011 and BRG-013 contain hair/overlap uncertainty entries.

Source:

- `research/sd-prompt-research/templates/rubric-template.yaml`
  (`axis_catalog.head_surface_contact.evidence_policy`)
- BRG-011/013 `observation.json` uncertainty entries

## Candidate

Axis: `shoulder_surface_contact`

Required Observation:

- A direct shoulder-to-surface contact boundary or direct visible separation,
  including side assignment when used.

Related Visibility Region:

- Candidate regions: `shoulders`, `hair`

Potential Evidence Concern:

- Clothing, hair, shadow, crop, overlap, or camera angle can hide the boundary.

Source:

- `research/sd-prompt-research/templates/rubric-template.yaml`
  (`axis_catalog.shoulder_surface_contact.evidence_policy`)

## Candidate

Axis: `knee_surface_contact`

Required Observation:

- Knee-to-surface contact or visible separation, including side assignment
  when used.

Related Visibility Region:

- `knees`

Potential Evidence Concern:

- A rail frame obscured knee and foot contact boundaries in BRG-013-A.

Source:

- `research/sd-prompt-research/templates/rubric-template.yaml`
- `research/sd-prompt-research/experiments/bridge/BRG-013-A/observation.json`

## Candidate

Axis: `back_surface_contact`, `hip_surface_contact`

Required Observation:

- The named back or hip region and its surface boundary.

Related Visibility Region:

- Candidate regions: `torso`, `hips`

Potential Evidence Concern:

- These axes exist in the shared 28-axis catalog but are not active in
  BRG-011/012/013, so the reviewed Runs provide no active-axis examples.

Source:

- `research/sd-prompt-research/templates/rubric-template.yaml`
  (`axis_catalog.back_surface_contact`, `axis_catalog.hip_surface_contact`)

## Candidate

Axis: `head_orientation`, `torso_arch`, `torso_lean`, `torso_rotation`,
`pelvis_orientation`, `elbow_state`, `knee_state`, `leg_spacing`

Required Observation:

- The named body region and the visible configuration recorded by the Rubric
  axis.

Related Visibility Region:

- Candidate associations: `head`; `torso`; `hips`; `arms`; `knees`; `legs`
  and `feet`

Potential Evidence Concern:

- The Rubric provides allowed values but no machine-evaluable Evidence Policy
  for these axes. Three of them (`torso_lean`, `torso_rotation`, and
  `pelvis_orientation`) are not active in BRG-011/012/013.

Source:

- `research/sd-prompt-research/templates/rubric-template.yaml`
- `research/sd-prompt-research/docs/specifications/contracts/evidence-evaluation-foundation-freeze.md`

## Candidate

Axis: `body_state`, `body_orientation`

Required Observation:

- The visible whole-body configuration recorded by the Rubric axis.

Related Visibility Region:

- No single registered region is selected by the reviewed materials.

Potential Evidence Concern:

- A future mapping would need Architect-owned treatment of multi-region or
  incomplete-body visibility. The reviewed Rubric has no machine-evaluable
  Evidence Policy for these axes.

Source:

- `research/sd-prompt-research/templates/rubric-template.yaml`
- `research/sd-prompt-research/docs/specifications/contracts/evidence-evaluation-foundation-freeze.md`

## Candidate

Axis: `hands_visibility`, `feet_visibility`, `support_evidence_visibility`

Required Observation:

- The Pose Rubric's own visibility classification for hands, feet, or support
  evidence.

Related Visibility Region:

- Candidate regions: `hands`, `feet`; no single Camera region is selected for
  `support_evidence_visibility`.

Potential Evidence Concern:

- Pose values (`both_clear`, `clear`, `partial`, `occluded`, `out_of_frame`,
  and related values) are not the Camera Visibility Metadata region-state
  vocabulary (`visible`, `partial`, `unclear`, `not_visible`). No equivalence
  or precedence is defined. `hands_visibility` and `feet_visibility` are not
  active in BRG-011/012/013.

Source:

- `research/sd-prompt-research/templates/rubric-template.yaml`
- `research/sd-prompt-research/docs/specifications/contracts/camera-visibility-metadata-foundation-freeze.md`
- BRG-011/012/013 `observation.json`

## Non-Axis Input Requiring Architect Direction

Field: `panels[].contact_load.{left_hand,right_hand,left_forearm,right_forearm}`

Recorded Observation:

- Schema values are `none`, `light`, `supporting`, `weight_bearing`, and
  `unclear`; BRG-011/012/013 use these fields and separate load from surface
  contact.

Related Visibility Region:

- Candidate regions: `hands`, `arms`

Potential Evidence Concern:

- Image Observation Evidence Rules bind `axis_name` to a Rubric axis.
  `contact_load` is required by Pose Observation Schema 3.0 but is not an
  `axis_catalog` entry. This inventory does not decide whether or how it can
  participate in a future mapping.

Source:

- `research/sd-prompt-research/templates/observation-schema.json`
- `research/sd-prompt-research/templates/rubric-template.yaml`
- `research/sd-prompt-research/docs/specifications/contracts/image-observation-contract-foundation-freeze.md`
- `research/sd-prompt-research/docs/specifications/contracts/evidence-evaluation-foundation-freeze.md`

## Architect Questions Returned

- Which candidate axes enter the Canonical Pose Evidence Mapping?
- Which Camera region or regions are associated with each selected axis?
- Which explicit Camera states are prerequisites, and whether association uses
  `all_of` or `any_of`?
- Which Observation values require a prerequisite and which, if any, are
  allowed fallbacks?
- How are multi-region axes and left/right identity handled when Camera
  Metadata has non-lateral region keys?
- Is a machine-readable Rubric Evidence Policy required or introduced for
  axes that currently have natural-language-only or no policy?
- Is Pose `support_evidence_visibility` an input to, independent from, or out
  of scope for Camera-based Evidence Evaluation?
- Is `contact_load` excluded because it is not a Rubric axis, or does a future
  Contract extend the target model?
