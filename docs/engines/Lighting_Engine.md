# Lighting Engine

## Responsibility

Lighting is resolved after core state/support/visibility constraints and camera spatial requirements, but before rendering. It is not assumed to be a decorative suffix: a lighting phrase may alter subject scale, portrait bias, scene structure, pose, visible light sources, outfit, or face.

Concept records should expose at least:

- `lightingEffect`;
- `portraitBias`;
- `subjectScaleBias`;
- `sceneBias`;
- `cameraInterference`;
- visible light-source/equipment expansion;
- cross-domain evidence and model dependence.

## `soft lighting`

Observed behavior:

- alone: face/upper-body near view, larger subject, simplified background, soft-portrait cluster;
- with `wide shot`: mixed near/distant behavior and large glowing backgrounds;
- `soft lighting, wide shot`: remained mostly near portrait even with wide shot later;
- `full body + soft lighting`: six of six retained full body but compressed pose into sitting, bent knees, or cross-legged forms.

Current interpretation: `soft lighting` does not directly request upper-body framing. It has strong portrait and large-subject bias. When full-body visibility competes with a large subject, pose compression can fit the whole body while keeping the subject large. Reversing phrase order did not remove the effect, suggesting semantic interaction stronger than simple order.

## `studio lighting`

With `wide shot`, studio lighting retained distant framing and expanded the available scene into spotlights, visible fixtures, a dark stage/background, or shooting studio. It is therefore a cross-domain scene structure, not evidence that all lighting collapses a wide shot.

## Aesthetic/quality interaction

The historical quality block `masterpiece, best quality, 4k, very aesthetic, high resolution, ultra-detailed` is not pure quality.

- `4k + high resolution + ultra-detailed`: six of six remained standing in the recorded full-body comparison; currently the safer detail/resolution cluster.
- `very aesthetic`: five of six standing, one floor pose; possible weak aesthetic bias.
- `masterpiece + best quality`: five of six floor poses with larger subjects.
- `masterpiece` alone: four of six floor poses at the front and three of six at the end; primary cause of aesthetic composition/pose bias.
- `best quality` alone: four of six standing, two floor poses; weaker amplifier.
- moving `masterpiece + best quality` to the end reduced but did not remove floor poses.

The dictionary should split `quality.detail` from `quality.aesthetic`. Aesthetic effects are resolved below hard state constraints: `standing + full body + masterpiece` and the variant with `best quality` both remained standing six of six.

## Open work

Representative tests remain for dramatic lighting, rim light, backlight, cinematic lighting, volumetric lighting, and colored lighting. For each, record framing, subject scale, scene generation, visible source, pose, outfit, and face leakage.
