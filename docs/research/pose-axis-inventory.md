# Pose Axis Inventory

## Scope

This inventory transcribes Pose Observation axis names and allowed values. It
does not define axis meaning, allowed or forbidden evidence values, or a
Canonical Evidence Rule.

## Axis List

| Module | Axis Name | Allowed Values | Source |
|---|---|---|---|
| pose | `body_state` | `standing`, `sitting`, `kneeling`, `quadruped`, `squatting`, `lying`, `reclined`, `suspended`, `airborne`, `unclear` | `research/sd-prompt-research/templates/rubric-template.yaml` (`axis_catalog.body_state`) |
| pose | `body_orientation` | `face_up`, `face_down`, `side_left`, `side_right`, `vertical`, `horizontal`, `inverted_vertical`, `oblique`, `unclear` | `research/sd-prompt-research/templates/rubric-template.yaml` (`axis_catalog.body_orientation`) |
| pose | `head_orientation` | `neutral`, `flexed_forward`, `extended_backward`, `rotated_left`, `rotated_right`, `tilted_left`, `tilted_right`, `visually_inverted`, `unclear`, `not_visible` | `research/sd-prompt-research/templates/rubric-template.yaml` (`axis_catalog.head_orientation`) |
| pose | `torso_arch` | `none`, `weak`, `medium`, `strong`, `extreme`, `unclear`, `not_visible` | `research/sd-prompt-research/templates/rubric-template.yaml` (`axis_catalog.torso_arch`) |
| pose | `torso_lean` | `none`, `forward`, `backward`, `lateral_left`, `lateral_right`, `unclear`, `not_visible` | `research/sd-prompt-research/templates/rubric-template.yaml` (`axis_catalog.torso_lean`) |
| pose | `torso_rotation` | `none`, `slight`, `strong`, `unclear`, `not_visible` | `research/sd-prompt-research/templates/rubric-template.yaml` (`axis_catalog.torso_rotation`) |
| pose | `hip_elevation` | `on_surface`, `low`, `medium`, `high`, `extreme`, `unclear`, `not_visible` | `research/sd-prompt-research/templates/rubric-template.yaml` (`axis_catalog.hip_elevation`) |
| pose | `pelvis_orientation` | `neutral`, `anterior_tilt`, `posterior_tilt`, `rotated_left`, `rotated_right`, `unclear`, `not_visible` | `research/sd-prompt-research/templates/rubric-template.yaml` (`axis_catalog.pelvis_orientation`) |
| pose | `support_structure` | `bipedal`, `single_foot`, `hand_and_foot`, `hand_and_knee`, `forearm_and_foot`, `head_shoulder_and_foot`, `back_and_foot`, `seated_surface`, `reclined_arm_support`, `unsupported`, `mixed`, `unclear` | `research/sd-prompt-research/templates/rubric-template.yaml` (`axis_catalog.support_structure`) |
| pose | `support_orientation` | `prone_quadruped`, `reverse_quadruped`, `lateral_support`, `supine_support`, `kneeling_hand_support`, `posterior_body_support`, `rear_arm_support`, `inferior_foot_support`, `mixed_support`, `not_applicable`, `unclear` | `research/sd-prompt-research/templates/rubric-template.yaml` (`axis_catalog.support_orientation`) |
| pose | `left_hand_surface_contact` | `floor`, `wall`, `chair`, `platform`, `object`, `unknown_surface`, `absent`, `unclear`, `not_visible`, `not_applicable` | `research/sd-prompt-research/templates/rubric-template.yaml` (`axis_catalog.left_hand_surface_contact`) |
| pose | `right_hand_surface_contact` | `floor`, `wall`, `chair`, `platform`, `object`, `unknown_surface`, `absent`, `unclear`, `not_visible`, `not_applicable` | `research/sd-prompt-research/templates/rubric-template.yaml` (`axis_catalog.right_hand_surface_contact`) |
| pose | `left_forearm_surface_contact` | `floor`, `wall`, `chair`, `platform`, `object`, `unknown_surface`, `absent`, `unclear`, `not_visible`, `not_applicable` | `research/sd-prompt-research/templates/rubric-template.yaml` (`axis_catalog.left_forearm_surface_contact`) |
| pose | `right_forearm_surface_contact` | `floor`, `wall`, `chair`, `platform`, `object`, `unknown_surface`, `absent`, `unclear`, `not_visible`, `not_applicable` | `research/sd-prompt-research/templates/rubric-template.yaml` (`axis_catalog.right_forearm_surface_contact`) |
| pose | `left_foot_surface_contact` | `floor`, `wall`, `chair`, `platform`, `object`, `unknown_surface`, `absent`, `unclear`, `not_visible`, `not_applicable` | `research/sd-prompt-research/templates/rubric-template.yaml` (`axis_catalog.left_foot_surface_contact`) |
| pose | `right_foot_surface_contact` | `floor`, `wall`, `chair`, `platform`, `object`, `unknown_surface`, `absent`, `unclear`, `not_visible`, `not_applicable` | `research/sd-prompt-research/templates/rubric-template.yaml` (`axis_catalog.right_foot_surface_contact`) |
| pose | `foot_contact_mode` | `sole`, `heel`, `forefoot`, `toes`, `side`, `mixed`, `asymmetric`, `absent`, `unclear`, `not_visible`, `not_applicable` | `research/sd-prompt-research/templates/rubric-template.yaml` (`axis_catalog.foot_contact_mode`) |
| pose | `head_surface_contact` | `floor`, `wall`, `chair`, `platform`, `object`, `unknown_surface`, `absent`, `unclear`, `not_visible`, `not_applicable` | `research/sd-prompt-research/templates/rubric-template.yaml` (`axis_catalog.head_surface_contact`) |
| pose | `shoulder_surface_contact` | `both`, `left_only`, `right_only`, `absent`, `unclear`, `not_visible`, `not_applicable` | `research/sd-prompt-research/templates/rubric-template.yaml` (`axis_catalog.shoulder_surface_contact`) |
| pose | `back_surface_contact` | `upper_back`, `mid_back`, `lower_back`, `multiple_regions`, `absent`, `unclear`, `not_visible`, `not_applicable` | `research/sd-prompt-research/templates/rubric-template.yaml` (`axis_catalog.back_surface_contact`) |
| pose | `hip_surface_contact` | `both`, `left_only`, `right_only`, `absent`, `unclear`, `not_visible`, `not_applicable` | `research/sd-prompt-research/templates/rubric-template.yaml` (`axis_catalog.hip_surface_contact`) |
| pose | `knee_surface_contact` | `both`, `left_only`, `right_only`, `absent`, `unclear`, `not_visible`, `not_applicable` | `research/sd-prompt-research/templates/rubric-template.yaml` (`axis_catalog.knee_surface_contact`) |
| pose | `elbow_state` | `straight`, `slightly_bent`, `bent`, `deeply_bent`, `asymmetric`, `unclear`, `not_visible` | `research/sd-prompt-research/templates/rubric-template.yaml` (`axis_catalog.elbow_state`) |
| pose | `knee_state` | `straight`, `slightly_bent`, `bent`, `deeply_bent`, `asymmetric`, `unclear`, `not_visible` | `research/sd-prompt-research/templates/rubric-template.yaml` (`axis_catalog.knee_state`) |
| pose | `leg_spacing` | `together`, `narrow`, `medium`, `wide`, `extreme`, `asymmetric`, `unclear`, `not_visible` | `research/sd-prompt-research/templates/rubric-template.yaml` (`axis_catalog.leg_spacing`) |
| pose | `hands_visibility` | `both_clear`, `left_only`, `right_only`, `partial`, `occluded`, `out_of_frame`, `unclear` | `research/sd-prompt-research/templates/rubric-template.yaml` (`axis_catalog.hands_visibility`) |
| pose | `feet_visibility` | `both_clear`, `left_only`, `right_only`, `partial`, `occluded`, `out_of_frame`, `unclear` | `research/sd-prompt-research/templates/rubric-template.yaml` (`axis_catalog.feet_visibility`) |
| pose | `support_evidence_visibility` | `clear`, `partial`, `occluded`, `out_of_frame`, `unclear` | `research/sd-prompt-research/templates/rubric-template.yaml` (`axis_catalog.support_evidence_visibility`) |

## Schema and Rubric Relationship

- Pose Observation Schema 3.0 is
  `research/sd-prompt-research/templates/observation-schema.json` and declares
  `schema_version: 3.0`.
- The Schema stores axis names in `active_axis_order` and panel values in the
  positionally corresponding `axis_values`. The Schema requires strings but
  does not enumerate the axis catalog or per-axis allowed values.
- The Rubric template supplies the 28 axis names and their `allowed_values`.
- The source Rubrics for BRG-011-A through BRG-013-C contain the same 28 axis
  catalogs and the same allowed values as the template.
- All nine BRG-011/012/013 source Rubrics activate the same 21 axes:
  `body_state`, `body_orientation`, `head_orientation`, `torso_arch`,
  `hip_elevation`, `support_structure`, `support_orientation`,
  `left_hand_surface_contact`, `right_hand_surface_contact`,
  `left_forearm_surface_contact`, `right_forearm_surface_contact`,
  `left_foot_surface_contact`, `right_foot_surface_contact`,
  `foot_contact_mode`, `head_surface_contact`,
  `shoulder_surface_contact`, `knee_surface_contact`, `elbow_state`,
  `knee_state`, `leg_spacing`, and `support_evidence_visibility`.

## Related Non-Axis Values

These fields are part of Pose Observation Schema 3.0 but are not entries in
the Rubric `axis_catalog`.

| Field | Allowed Values | Source |
|---|---|---|
| `panels[].contact_load.left_hand` | `none`, `light`, `supporting`, `weight_bearing`, `unclear` | `research/sd-prompt-research/templates/observation-schema.json` (`$defs.loadState`) |
| `panels[].contact_load.right_hand` | `none`, `light`, `supporting`, `weight_bearing`, `unclear` | same as above |
| `panels[].contact_load.left_forearm` | `none`, `light`, `supporting`, `weight_bearing`, `unclear` | same as above |
| `panels[].contact_load.right_forearm` | `none`, `light`, `supporting`, `weight_bearing`, `unclear` | same as above |
| `panels[].confidence` | `high`, `medium`, `low` | `research/sd-prompt-research/templates/observation-schema.json` (`$defs.panel.properties.confidence`) |
| `panels[].cross_domain_effects[].strength` | `weak`, `medium`, `strong`, `unclear` | `research/sd-prompt-research/templates/observation-schema.json` (`$defs.crossDomainEffect.properties.strength`) |
| `panels[].cross_domain_effects[].effect_type` | `natural_response`, `secondary_effect`, `interaction`, `leakage`, `artifact`, `unclear` | `research/sd-prompt-research/templates/observation-schema.json` (`$defs.crossDomainEffect.properties.effect_type`) |

The Rubric also defines special values `unclear`, `not_visible`, and
`not_applicable`. Their availability still depends on each axis's transcribed
allowed-value list above.

## Notes

- The Schema/Rubric split means an `axis_name` cannot be obtained from the
  JSON Schema alone; exact Rubric binding is needed to identify the catalog
  and allowed values.
- `torso_lean`, `torso_rotation`, `pelvis_orientation`,
  `back_surface_contact`, `hip_surface_contact`, `hands_visibility`, and
  `feet_visibility` are in the shared catalog but are not active in
  BRG-011-A through BRG-013-C.
- `contact_load` is enabled by the Rubrics and required by the Schema, but it
  is not an `axis_catalog` entry. Whether a future Evidence Mapping can target
  it is not defined by the reviewed Contract.
- The BRG Observation `uncertain[].field` strings are not schema-bound to
  `axis_catalog`. Existing examples include `foot_surface_contact`,
  `lower_limb_surface_contact`, and `hand_and_foot_surface_contact`, which are
  not catalog axis names.
- No axis meaning, allowed/forbidden value set, fallback value, or Canonical
  Rule is decided in this inventory.
