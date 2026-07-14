# Camera Research

## Baseline and contamination control

Camera trials used:

```text
1girl,
silver hair, bob cut,
simple white shirt,
simple background
```

Lighting and aesthetic phrases were excluded because they changed subject scale, framing, scene, and pose. Most tabulated observations in the source are six-image sets; exact generation metadata was not retained in the supplied handoff.

## Framing trials

| Phrase | Recorded result | Research judgment |
|---|---|---|
| `extreme close-up` | Closer than close-up, partial face crop, less shoulder/chest, occasional close-up fallback. | Main-series close endpoint; medium stability, high face-crop bias. |
| `close-up` | Face-led, neck/shoulder/upper chest, little background, little pose leakage, no fixed face direction. | Stable pure-ish framing, high. |
| `upper body` | Stable upper-body portrait; adding standing made little visible difference. | Safe canonical upper body, high. |
| `medium shot` | Face/chest, near upper body, did not reach waist. | Unreliable as independent band. |
| `waist up` | Face/chest/waist consistently visible. | Canonical waist framing, high. |
| `cowboy shot` | Head to upper/mid thigh, standing retained, little pose interference. | Practical intermediate, high. |
| `knee shot` | Sitting/bent knees/foreground legs, unstable crop; 6/6 pose compression. | Exception composite: knee target + visibility + leg/state leakage. |
| `full body` | Clean 6/6 natural standing and head-to-foot visibility. | Visibility/framing; old sitting hypothesis withdrawn. |
| `full shot` | 6/6 full body, standing/walking/light motion, less background than wide. | Near full body; possible framing vs visibility nuance. |
| `wide shot` | Full/distant, smaller subject, more background when clean. | Valid medium-high but lighting-sensitive. |
| `extreme wide shot` | Tiny subject, dominant space, isolation/minimal composition, full body. | Strong distant endpoint. |
| `long shot` | 6/6 upper-body to waist-up; did not become distant. | Unreliable/nonrecommended. |
| `extreme long shot` | Full body, smaller subject, more background. | Valid distant neighbor. |
| `medium full shot` | Face/chest; upper-body fallback. | Unreliable/nonrecommended. |

## Region, focus, crop, and portrait trials

- `lower body`: waist/thigh/leg focus, head cropped, no background expansion. Region target/crop, not distance.
- `from waist down`: paradoxically upper-body/waist-up; legs/knees/feet mostly absent. Unsupported; use lower body.
- `bust shot`: chest-up framing but chest central/foreground, neckline opened and exposure increased, reconstructing the shirt. Ambiguous cross-domain exception.
- `portrait`: face/shoulders, more front/center; not a neutral chest-up substitute.
- `medium close-up`: absorbed into close-up, sometimes lacking shoulders. Unreliable as safe chest-up framing.
- `head and shoulders portrait`: head/neck/shoulders, high face occupancy, center/front bias; portrait composition plus close-up.
- `face focus`: face became subject but distance ranged close-up to extreme close-up. Focus target with high framing influence, medium stability.
- `panorama`: square single-person/simple background remained ordinary portrait and did not widen. Requires wide canvas/scene context.
- `feet out of frame`: feet absent 6/6; could retain standing or change pose to remove feet. Visibility constraint rather than one framing band.

## Horizontal-angle trials

The base used upper-body clean framing.

- `front view`: 6/6 nearly front; face/shoulders/torso front, framing retained, little pose leak. High.
- `three-quarter view`: diagonal face more than torso; some front fallback. Medium.
- `side view`: face/torso/shoulders reliably side in both upper/full body. High.
- `rear view`: back of head/back/rear shoulders dominate; face nearly invisible, framing retained, little pose leak. High.

Conclusion: these phrases affect human head/body orientation as well as camera angle.

## Vertical-angle trials

- `from above`: clear look-down, more crown/fringe/upper face, upward gaze bias, upper body retained, little pose leakage. High and relatively camera-pure.
- `front view + from above`: front head/shoulder/torso, look-down, and upper body all remained. Supports orthogonal composition.
- `high angle`: look-down but weaker, more oblique/portrait-like. Medium neighbor; canonical is `from above`.
- `from below`: clear low angle, under-chin/neck/chest/shoulder emphasis, perspective exaggeration, upper body retained. High, with stronger secondary effects.
- `low angle`: close to from below, slightly more dramatic/oblique. Medium-high neighbor.
- `bird eye view`: user test reported nonfunctional. Unsupported; replace with from above.
- `worm eye view`: low-angle behavior plus all six eyes changing red/orange, larger/rounder eyes, younger face impression. Exception composite; replace with from below for pure control.

## Composition trials

### `centered composition`

Initially appeared to center, but upper-body baseline already centers strongly. Effect remains unconfirmed.

### Rule of thirds

`upper body + rule of thirds`, `subject placed on the left third`, and right-third counterpart did not reliably move the center of mass or reverse placement. Unsupported/unverified for usable placement control.

### `negative space`

Alone: ordinary upper-body portrait and weak space activation. With wide shot: smaller subject than wide alone, more blank background, stronger minimal/isolation. Hypothesis: wide supplies spatial budget and negative space allocates it as emptiness.

### `diagonal composition`

Simple upper body/background was weak. City streets used roads/buildings/signs/pavement/vanishing point as diagonals. Forest used repeated trees, paths, light gaps, and depth more softly. `dynamic composition + detailed background + forest` produced open/dramatic scene staging. Supported, medium, context-dependent visual flow—not camera roll.

### `dynamic composition`

Alone: high variation in camera, placement, background, light, and hair motion; sometimes dramatic, sometimes minor portrait change. Upper-body/indoors/strict framing suppressed it to face/hair/light changes. Full body exposed staging/depth/light motion bias but still not on every run. Detailed background alone increased density without necessarily changing composition. Together they produced much larger scenes, smaller figures, cinematic space, structures/sky/city, floating/distant perspective, and more-than-additive cooperation.

## Roll trials

### `dutch angle`

On simple background it looked like body/head/shoulder tilt and was hard to distinguish from pose. With window frames, architecture, streets, and corridors, windows/columns/ceiling/walls tilted with the image coordinates. Supported high-stability camera roll when reference lines exist.

### `tilted frame`

Weaker than dutch angle even with reference lines. Weak roll/composition modifier and HOLD/DROP candidate; not canonical.

## Historical camera corrections

- `full body` did not itself cause sitting.
- `studio lighting` did not destroy wide shot.
- `negative space` was combination-dependent.
- centered composition remained unconfirmed.
- rule-of-thirds variants were not usable placement handles.
- `standing` was unobservable in upper-body framing, not necessarily absent.

## Remaining research

Sample `foreshortening` and `wide-angle perspective`; add telephoto only if needed. Sample dynamic/diagonal/symmetrical composition and negative-space-on-wide. Test representative combinations of framing × horizontal, framing × vertical, horizontal × vertical, framing × composition, and angle × roll; do not exhaust all pairs.
