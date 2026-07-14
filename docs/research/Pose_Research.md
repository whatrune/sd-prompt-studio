# Pose Research

## Scope

This document preserves the Pose trials, failures, interpretations, and unresolved hypotheses behind [Pose Engine](../engines/Pose_Engine.md). Results are observations on the tested context/checkpoint, not universal semantics.

## Body-state trials

### `standing`

Clean template produced standing while leaving head direction, arms, shoulders, waist, and camera free. It did not require `standing straight`. Later full-body aesthetic tests showed:

- `full body + standing + masterpiece`: 6/6 standing;
- `full body + standing + masterpiece + best quality`: 6/6 standing.

In upper-body framing, adding standing or `standing + side view` produced almost no visible difference because the baseline already converged on an upright portrait and the legs/feet proving standing were cropped.

### `sitting`

Result: 6/6 sitting, commonly knees forward/held, arms near legs, and forward lean. `sitting + full body + masterpiece` stayed sitting 6/6; aesthetic terms changed the form of sitting. `sitting + upper body + masterpiece` kept seated traces such as knees, lean, and held posture inside the image.

### `kneeling`

Observed knee contact, shins/feet behind, lower waist, occasional hands forward/on floor, and slight forward lean. In upper-body framing it remained highly observable through knees, floor contact, and body compression.

### `squatting`

Observed feet support, deep knee bend, lowered hips, thighs near torso, compressed body, and hands/elbows near face/knees. Treated as distinct from standing, sitting, and kneeling.

### `lying`

Observed horizontal body axis, side-lying/reclined bias, head on arm/pillow/floor, and successful upper-body crops without requiring lower-body visibility. Interpretation: body state plus horizontal orientation and surface support.

### `floating`

- alone: mostly portrait fallback and weak atmosphere;
- `floating + sky`: some full-body unsupported placement but portraits remained;
- `full body + floating`: weightless standing-like pose with reduced foot contact, not flight.

Interpretation: conditional unsupported/suspended support relation, static and weightless. Preferred contexts are sky, space, underwater, and open magical space; preferred framing is full body or wide.

### State conflict

`standing + sitting` yielded sitting 4/6 and standing 2/6. Seated cases retained upright posture or aligned legs. This is model fallback evidence only; compiler output should resolve the same-axis conflict.

## Posture modifier trials

- `leaning forward`: standing remained; torso/shoulders moved forward, head lowered, hips moved back, and hands sometimes reached knees/forward. Compatible observations also exist for sitting/kneeling.
- `leaning back`: standing remained; torso/shoulders moved back, chest opened, head biased upward; less camera leakage than leaning forward.
- `twisted torso`: looking-back/side/rear-three-quarter cluster with shoulder–hip direction differences, head turn, hip/silhouette emphasis, and outfit hem/body-line effects. This was not a pure torso-only modifier.

## Arm and hand trials

- `arms crossed`: stable chest-front crossing, standing retained, defensive/strong/cool bias.
- `hand on cheek` without state: sitting/squatting, knee-hugging, rest/thoughtful pose. With standing: standing and cheek contact retained, head tilted toward hand, low-state leakage reduced.
- `pointing`: standing, arm extension, pointing; body direction followed slightly.
- `hands behind back`: standing, shoulders back, open chest, low state leakage, polite/shy bias.
- `hands on hips`: standing, elbows out, waist emphasis, confident/energetic bias.
- `one hand raised`: static raised-arm configuration near shoulder/face, greeting bias.
- `waving`: raised arm, open fingers, wrist motion, friendly expression. Distinguished from static `one hand raised`.

## Motion trials

- `walking`: legs fore/aft, progression, light arm swing, standing base, full-body demand, side/three-quarter bias.
- `running`: larger stride, forward lean, arm swing, dynamic weight shift, hair flow, camera/composition leakage.
- `jumping`: airborne full body, bent knees, raised arms, hair/clothing motion; temporary loss of support from grounded action.
- `falling`: downward, passive/unstable unsupported motion, broken axis, rotation, spread limbs, unstable framing.

## Supported-pose trials

### `leaning against wall`

Generated a wall plus shoulder/back/arm/waist contact, standing base, torso lean, asymmetric weight, and relaxed/sultry/casual mood. Interpreted as vertical-surface support and object interaction.

### `sitting on chair`

Strongly included chair seat/back/legs, sitting base, forward/relaxed legs, and greater stability than floor sitting. Interpreted as body state plus chair support and `seated_on` relation.

## Leg and foot trials

### `one leg raised`

- with standing: one bent/raised leg, one-foot support, balancing arms;
- on back: lying retained and one leg raised;
- in sitting: one leg could be planted/raised.

Conclusion: state-independent free-leg configuration; support and balance are secondary.

### `standing on one leg`

Produced single-foot support, variable free leg, balancing arms, torso adjustment, and sometimes a leg extended sideways. Primary concept is support/balance, unlike `one leg raised`.

### `tiptoes`

Produced toe support but also squatting, forward lean, sneaking, hands near floor, and light movement. It did not reliably mean only upright tiptoe. Retain as composite balance/foot-support phrase.

### `legs apart`

Standing usually remained, leg spacing increased, state changed little, and wide/grounded stance bias appeared. Atomic spacing modifier.

### `crossed ankles`

Standing remained; crossing localized at ankles while legs stayed comparatively straight. Local ankle configuration.

### `crossed legs`

With standing, standing and leg crossing remained. General configuration with low-to-medium state dependence.

### `legs crossed`

Alone it produced sitting, bent knees, crossed-leg seating, and relaxed seated pose. With standing, the standing and seated clusters conflicted and often escaped to crop rather than a clear standing cross. Native seated composite. It must remain distinct from `crossed legs`.

## Split and flexibility trials

### `front split`

Expected floor front/back split. Observed high raised leg, high kick, or vertical leg extension instead. Status: unreliable/misleading on the tested checkpoint.

### `doing the splits`

Activated an open-leg concept but mixed lateral splits, one-leg extension, front/back and side directions, with floor support. Native parent concept with unresolved direction.

### `split + sitting`

Rendered order was `split, sitting`, but the design interpretation is state-first internal resolution. It produced floor sitting, side/open legs, hands on floor, and open hips, close to the desired seated split. `split` alone lacked direction/state; sitting supplied floor state.

### Completed phrase failure

`seated straddle forward fold` was expected to mean an open-leg forward fold. It produced bent knees, side sitting, forward lean, and insufficient opening. The phrase was judged a weak canonical visual cluster.

### Component assembly success

Initial:

```text
sitting on floor,
legs apart,
leaning forward
```

Observed floor sitting, open legs, forward lean, and hands on floor—closer to the target.

Expanded:

```text
sitting on floor,
legs apart,
leaning forward,
head lowered,
reaching forward,
hands on floor
```

Observed 6/6 with open legs, forward torso, lowered head, and hand support, substantially closer to the intended flat forward fold. This is the central evidence for `expandable_composite / constructed_pose`.

## Bridge / Wheel Pose

### Failed trial

```text
bridge pose,
hands on floor,
feet on floor,
back arched,
hips raised,
high angle,
full body
```

Observed crawling/quadruped, abdomen toward the floor, not a supine bridge. Support alone permitted a face-down solution.

### Current hypothesis, not yet verified

```text
1girl,
silver hair,
bob cut,
plain oversized white t-shirt,
black shorts,
simple background,

lying on back,
face up,
wheel pose,
hands on floor,
feet on floor,
back arched,
hips raised,
chest lifted,
body forming an arch,

full body
```

First test without camera. If the pose resolves, add `high angle` to test the Pose Resolver → Camera Resolver connection.

## Remaining targets

Side/middle/front split alternatives; knees up; knees to chest; cross-legged/lotus; handstand; high kick; cartwheel; representative gymnastics/yoga; bicycle, motorcycle, and horse riding.
