# Camera Engine

## Responsibility

Camera resolves visibility, subject scale, spatial budget, viewpoint, crop, and composition after entity, pose, support, and object requirements are known. It is not a single tag category and is not appended after all other decisions.

```text
Camera
├ Framing / Distance
├ Horizontal Angle
├ Vertical Angle
├ Roll
├ Perspective
├ Region / Focus Target
├ Visibility / Crop Constraint
├ Subject Placement
├ Composition
├ Viewer Relation
└ Focus Target
```

Framing, angle, focus, crop, and composition remain separate axes. A phrase may affect multiple axes and is then modeled as a composite or exception.

## Canonical framing map

```text
extreme close-up
↓
close-up
↓
upper body
↓
waist up
↓
cowboy shot
↓
full body / full shot
↓
wide shot
↓
extreme wide shot
```

`extreme long shot` is a supported distant neighbor. Canonical recommendations are `extreme close-up`, `close-up`, `upper body`, `waist up`, `cowboy shot`, `full body`, `full shot`, `wide shot`, `extreme wide shot`, and `extreme long shot`. Region/focus controls include `lower body` and `face focus`; `feet out of frame` is a crop/visibility constraint.

### Framing behavior

| Phrase | Status | Observed interpretation |
|---|---|---|
| `extreme close-up` | medium stability | Close-up endpoint; partial face crop, less shoulder/chest; sometimes falls back to close-up. |
| `close-up` | high | Stable face-led framing with neck/shoulders/upper chest and little pose leakage. |
| `upper body` | high | Safe centered upper-body portrait; standing evidence is usually unobservable. |
| `medium shot` | unreliable | Stayed near face/chest and `upper body`, not a distinct waist band. |
| `waist up` | high | Clear face-to-waist band; canonical waist framing. |
| `cowboy shot` | high | Head to upper/mid thighs, standing-friendly, little pose interference. |
| `knee shot` | exception | Knee visibility drove sitting, bending, and foreground legs (6/6 pose compression); region target plus visibility and pose leakage. |
| `full body` | supported | Clean baseline produced natural standing full body 6/6; it does not itself cause sitting. |
| `full shot` | supported | Full visibility with standing/walking/light motion; near `full body`, possibly more framing-oriented while `full body` is visibility-oriented. |
| `wide shot` | medium-high | Smaller subject and more background; valid without contaminating lighting, but lighting-sensitive. |
| `extreme wide shot` | strong | Very small isolated subject, dominant space/minimal composition, full body retained. |
| `long shot` | unreliable | Produced upper-body/waist framing 6/6, not a distant band. |
| `extreme long shot` | supported | Small full-body subject and increased background; near extreme wide. |
| `medium full shot` | unreliable | Fell back to face/chest/upper body. |

### Region, focus, and crop exceptions

- `lower body`: region target/crop; focuses waist/thighs/legs and cuts the head without increasing distance.
- `from waist down`: unsupported; reversed toward upper body. Use `lower body`.
- `bust shot`: ambiguous exception; chest-up framing plus chest focus and neckline/exposure changes. Not a safe neutral framing.
- `portrait`: composition plus preferred close-up and face visibility; increases front/center portraits rather than neutral chest-up framing.
- `medium close-up`: unreliable close-up neighbor with high face occupancy and sometimes insufficient shoulders.
- `head and shoulders portrait`: portrait composition plus close-up and face visibility, not chest-up framing.
- `face focus`: focus target with strong framing influence and close-up preference, but distance varies between close-up and extreme close-up.
- `panorama`: requires wide canvas and scene context; not normal framing and ineffective in the tested square single-subject simple-background context.
- `feet out of frame`: strong visibility constraint; removed feet 6/6 while allowing standing or pose changes. It does not fix one framing range.

## Horizontal angle

- `front view`: high stability; camera angle plus head and body orientation.
- `three-quarter view`: medium; stronger on head than torso and can return to front.
- `side view`: high; head, torso, and shoulders reliably side-oriented across upper/full body.
- `rear view`: high; back/head/shoulders dominate and face is mostly hidden.

Horizontal-angle phrases are cross-domain because they rotate human head/body orientation as well as camera interpretation.

## Vertical angle

- `from above`: canonical high-stability look-down angle with head-top/upper-face changes and little pose leakage.
- `high angle`: medium, weaker and more portrait-like; neighbor rather than alias. Prefer `from above`.
- `from below`: canonical high-stability low angle with perspective, under-chin/neck/chest/shoulder emphasis.
- `low angle`: medium-high neighbor, slightly more dramatic/oblique. Prefer `from below`.
- `bird eye view`: unsupported in the recorded user test; replace with `from above`.
- `worm eye view`: exception composite; low angle plus face proportion, eye shape/color, and age-impression changes (all six observed eyes shifted red/orange and became larger/rounder). Replace with `from below` for canonical control.

`front view + from above` retained both orientations and upper-body framing, supporting orthogonal horizontal/vertical resolution.

## Roll

`dutch angle` is the supported canonical roll. With simple background it can be mistaken for head/shoulder pose. With windows, architecture, corridors, or city lines, background reference lines rotate with the frame, establishing camera-coordinate roll. Status: supported, high stability in contexts with horizontal/vertical reference lines.

`tilted frame` remained weaker even with reference lines. It is a weak roll/composition modifier and HOLD/DROP candidate; use `dutch angle`.

## Composition

- `centered composition`: unconfirmed because `upper body` already strongly centers the subject.
- `rule of thirds` and left/right-third variants: unsupported/unverified; direction did not flip and weight remained near center.
- `negative space`: context-dependent cooperative effect. Weak alone; with `wide shot`, it used the available spatial budget to shrink the subject further and increase blank space/isolation.
- `diagonal composition`: supported, medium, context-dependent scene visual flow. City streets use roads/buildings/signs/vanishing points; forests use repeated trees/paths/light/depth. It is not camera roll.
- `dynamic composition`: supported effect with medium-low stability and high activation variance. It uses available freedom for camera, placement, staging, motion, hair, and lighting. Strict upper-body/simple-background/visibility constraints suppress it; detailed backgrounds and spatial scene context amplify it.
- `dynamic composition + detailed background`: cooperative behavior beyond simple addition, including smaller subjects, large spaces, cinematic scenes, sky/city/structures, floating/distance, and strong perspective.

## Clean baseline requirement

Camera tests used `1girl, silver hair, bob cut, simple white shirt, simple background` and excluded `studio lighting`, `soft lighting`, `masterpiece`, `best quality`, `very aesthetic`, and similar aesthetic/detail clusters. Those phrases can alter framing, scale, scene, or pose and therefore contaminate camera conclusions.

## Unresolved camera work

Perspective representatives such as foreshortening/wide-angle, telephoto only as needed, additional composition representatives, and sampled cross-products of framing × angle × composition × roll remain open. Exhaustive combination testing is explicitly not required.
