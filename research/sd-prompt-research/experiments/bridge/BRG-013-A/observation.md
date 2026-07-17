# Observation Report

## Run Summary

- Run ID: BRG-013-A
- Condition: Condition A
- Panel Count: 6
- Image Layout: 3x2
- Overall Visible Pattern:
  - The panels contain kneeling, four-point, seated-arch, and standing supported configurations.
  - Raised furniture or platform structures are directly visible in five panels.
- Analysis Notes:
  - Prompt differences and target alignment were not assessed.
  - Side-view overlap or generated structures obscure several left-right contact assignments.

## Panel-by-Panel Observations

### Panel 1

- Body State: kneeling
- Body Orientation: face_down
- Head Orientation: extended_backward
- Torso Arch: medium
- Hip Elevation: high
- Support Structure: hand_and_knee
- Support Orientation: kneeling_hand_support
- Left Hand Surface Contact: floor
- Right Hand Surface Contact: floor
- Left Forearm Surface Contact: absent
- Right Forearm Surface Contact: absent
- Left Foot Surface Contact: unclear
- Right Foot Surface Contact: unclear
- Foot Contact Mode: unclear
- Head Surface Contact: absent
- Shoulder Surface Contact: absent
- Knee Surface Contact: both
- Elbow State: straight
- Knee State: deeply_bent
- Leg Spacing: narrow
- Support Evidence Visibility: clear
- Primary Pose Morphology: kneeling_hand_support
- Secondary Pose Morphologies: kneeling_pose
- Evidence Notes:
  - A directly visible pelvis-to-floor gap is present while both knees and both straight-arm hands form the directly visible hand-and-knee load path that supports the body.
  - Both hand-to-floor boundaries and both knee-to-floor boundaries are directly visible; the overlapping feet prevent reliable left-right foot contact assignment.
  - The head and shoulders are visibly separated from the floor.
- Cross-domain Effects:
  - none_observed
- Visual Artifacts: none observed
- Confidence: high

### Panel 2

- Body State: quadruped
- Body Orientation: face_down
- Head Orientation: extended_backward
- Torso Arch: medium
- Hip Elevation: high
- Support Structure: hand_and_foot
- Support Orientation: prone_quadruped
- Left Hand Surface Contact: platform
- Right Hand Surface Contact: platform
- Left Forearm Surface Contact: absent
- Right Forearm Surface Contact: absent
- Left Foot Surface Contact: platform
- Right Foot Surface Contact: platform
- Foot Contact Mode: forefoot
- Head Surface Contact: absent
- Shoulder Surface Contact: absent
- Knee Surface Contact: absent
- Elbow State: straight
- Knee State: bent
- Leg Spacing: narrow
- Support Evidence Visibility: clear
- Primary Pose Morphology: prone_quadruped
- Secondary Pose Morphologies: squatting_pose
- Evidence Notes:
  - Both hands and both forefeet visibly meet the platform through straight arms and bent legs.
  - A large visible gap separates the pelvis from the platform; head, shoulders, forearms, and knees remain visibly elevated.
  - The hand-and-foot load path is visible on the same raised platform.
- Cross-domain Effects:
  - Domain: object_generation
    - Strength: strong
    - Effect Type: artifact
    - Observation: A large raised platform occupies the support area.
- Visual Artifacts: unintended_support_surface
- Confidence: high

### Panel 3

- Body State: sitting
- Body Orientation: face_up
- Head Orientation: extended_backward
- Torso Arch: strong
- Hip Elevation: unclear
- Support Structure: mixed
- Support Orientation: unclear
- Left Hand Surface Contact: absent
- Right Hand Surface Contact: absent
- Left Forearm Surface Contact: absent
- Right Forearm Surface Contact: absent
- Left Foot Surface Contact: floor
- Right Foot Surface Contact: floor
- Foot Contact Mode: mixed
- Head Surface Contact: unclear
- Shoulder Surface Contact: absent
- Knee Surface Contact: absent
- Elbow State: asymmetric
- Knee State: asymmetric
- Leg Spacing: wide
- Support Evidence Visibility: partial
- Primary Pose Morphology: seated_arch
- Secondary Pose Morphologies: reclined_pose
- Evidence Notes:
  - One extended foot and one forefoot visibly meet the floor while the bent legs and vertical furniture form a mixed resting structure.
  - Hair and the furniture edge obscure the direct head-to-surface boundary; the pelvis-to-floor clearance is also obscured by the folded legs and post.
  - Both visible hands are separated from the floor and do not establish a visible hand support path; both shoulders are directly visibly separated from the floor and furniture.
- Cross-domain Effects:
  - Domain: object_generation
    - Strength: strong
    - Effect Type: artifact
    - Observation: A table-like post and top surface are directly visible behind the body.
- Visual Artifacts: unintended_support_surface
- Confidence: medium

### Panel 4

- Body State: quadruped
- Body Orientation: face_down
- Head Orientation: extended_backward
- Torso Arch: medium
- Hip Elevation: on_surface
- Support Structure: mixed
- Support Orientation: mixed_support
- Left Hand Surface Contact: platform
- Right Hand Surface Contact: platform
- Left Forearm Surface Contact: absent
- Right Forearm Surface Contact: absent
- Left Foot Surface Contact: unclear
- Right Foot Surface Contact: unclear
- Foot Contact Mode: unclear
- Head Surface Contact: absent
- Shoulder Surface Contact: absent
- Knee Surface Contact: unclear
- Elbow State: straight
- Knee State: slightly_bent
- Leg Spacing: narrow
- Support Evidence Visibility: partial
- Primary Pose Morphology: quadruped_pose
- Secondary Pose Morphologies: prone_quadruped
- Evidence Notes:
  - Both hands directly contact the lower rail while the pelvis directly rests across the upper rail.
  - The red frame obscures the lower-limb contact boundaries and prevents reliable knee and foot contact assignment.
  - Both hands and the pelvis form a directly visible mixed load path that supports the body through the lower and upper rails.
  - Directly visible separation remains between the head, both shoulders, the frame, and the floor.
- Cross-domain Effects:
  - Domain: object_generation
    - Strength: strong
    - Effect Type: artifact
    - Observation: A large rail frame surrounds and supports the body.
- Visual Artifacts: unintended_support_surface
- Confidence: medium

### Panel 5

- Body State: standing
- Body Orientation: face_down
- Head Orientation: flexed_forward
- Torso Arch: strong
- Hip Elevation: high
- Support Structure: hand_and_foot
- Support Orientation: mixed_support
- Left Hand Surface Contact: platform
- Right Hand Surface Contact: platform
- Left Forearm Surface Contact: absent
- Right Forearm Surface Contact: absent
- Left Foot Surface Contact: platform
- Right Foot Surface Contact: platform
- Foot Contact Mode: sole
- Head Surface Contact: absent
- Shoulder Surface Contact: absent
- Knee Surface Contact: absent
- Elbow State: straight
- Knee State: straight
- Leg Spacing: narrow
- Support Evidence Visibility: clear
- Primary Pose Morphology: standing_pose
- Secondary Pose Morphologies: prone_quadruped
- Evidence Notes:
  - Both hands and both feet directly meet the platform while a directly visible pelvis-to-platform gap remains high above it.
  - Both hands, both feet, and the straight limbs form a directly visible mixed load path that bears weight around the forward-curved torso.
  - The head and both shoulders are directly visibly separated from the platform; forearms and knees are also elevated.
- Cross-domain Effects:
  - Domain: object_generation
    - Strength: strong
    - Effect Type: artifact
    - Observation: A floor platform and upright block are directly visible.
- Visual Artifacts: unintended_support_surface
- Confidence: high

### Panel 6

- Body State: standing
- Body Orientation: oblique
- Head Orientation: extended_backward
- Torso Arch: medium
- Hip Elevation: high
- Support Structure: hand_and_foot
- Support Orientation: mixed_support
- Left Hand Surface Contact: platform
- Right Hand Surface Contact: platform
- Left Forearm Surface Contact: absent
- Right Forearm Surface Contact: absent
- Left Foot Surface Contact: not_visible
- Right Foot Surface Contact: floor
- Foot Contact Mode: unclear
- Head Surface Contact: absent
- Shoulder Surface Contact: absent
- Knee Surface Contact: absent
- Elbow State: straight
- Knee State: straight
- Leg Spacing: wide
- Support Evidence Visibility: partial
- Primary Pose Morphology: standing_pose
- Secondary Pose Morphologies: not_applicable
- Evidence Notes:
  - Both hands visibly press on the raised platform and one extended foot visibly meets the floor at the right edge.
  - The opposite foot is hidden by side-view overlap and framing; a directly visible pelvis-to-floor gap remains high above the floor.
  - Both hands and the visible extended foot form a directly visible mixed load path that supports the body through straight arms and the extended leg.
  - The head and both shoulders are directly visibly separated from the platform and floor.
- Cross-domain Effects:
  - Domain: object_generation
    - Strength: strong
    - Effect Type: artifact
    - Observation: A raised block forms the hand support surface.
- Visual Artifacts: unintended_support_surface
- Confidence: medium

## Computed Aggregate

- Body State: kneeling=1/6, quadruped=2/6, sitting=1/6, standing=2/6
- Body Orientation: face_down=4/6, face_up=1/6, oblique=1/6
- Head Orientation: extended_backward=5/6, flexed_forward=1/6
- Torso Arch: medium=4/6, strong=2/6
- Hip Elevation: high=4/6, on_surface=1/6, unclear=1/6
- Support Structure: hand_and_foot=3/6, hand_and_knee=1/6, mixed=2/6
- Support Orientation: kneeling_hand_support=1/6, mixed_support=3/6, prone_quadruped=1/6, unclear=1/6
- Left Hand Surface Contact: absent=1/6, floor=1/6, platform=4/6
- Right Hand Surface Contact: absent=1/6, floor=1/6, platform=4/6
- Left Forearm Surface Contact: absent=6/6
- Right Forearm Surface Contact: absent=6/6
- Left Foot Surface Contact: floor=1/6, not_visible=1/6, platform=2/6, unclear=2/6
- Right Foot Surface Contact: floor=2/6, platform=2/6, unclear=2/6
- Foot Contact Mode: forefoot=1/6, mixed=1/6, sole=1/6, unclear=3/6
- Head Surface Contact: absent=5/6, unclear=1/6
- Shoulder Surface Contact: absent=6/6
- Knee Surface Contact: absent=4/6, both=1/6, unclear=1/6
- Elbow State: asymmetric=1/6, straight=5/6
- Knee State: asymmetric=1/6, bent=1/6, deeply_bent=1/6, slightly_bent=1/6, straight=2/6
- Leg Spacing: narrow=4/6, wide=2/6
- Support Evidence Visibility: clear=3/6, partial=3/6

## Visual Artifacts

- unintended_support_surface

## Prompt / Concept Leakage

- not assessed

## Observed Morphologies

- kneeling_hand_support
- kneeling_pose
- prone_quadruped
- squatting_pose
- seated_arch
- reclined_pose
- quadruped_pose
- standing_pose
- not_applicable

## Uncertain

- Panel 1 / foot_surface_contact: The feet overlap in side view, hiding individual contact boundaries.
- Panel 3 / hip_elevation: Folded legs and the vertical post obscure the pelvis-to-floor boundary.
- Panel 3 / head_surface_contact: Hair obscures the direct boundary at the furniture edge.
- Panel 4 / lower_limb_surface_contact: The rail frame obscures the knee and foot contact boundaries.
- Panel 6 / left_foot_surface_contact: The opposite foot is not visible in the side-view overlap.

## Ontology Extension Candidates

- none

## Cross-condition Comparison

- Status: not_performed
- Reason: Blind image observation was completed without cross-condition interpretation.
