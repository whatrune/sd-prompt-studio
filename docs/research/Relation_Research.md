# Relation Research

## Japanese scene conversion

### Evening classroom

Intent: a slightly lonely silver-haired bob-cut girl in an oversized white T-shirt and black shorts, sitting on a chair by a classroom window at evening and looking outside.

Initial prompt:

```text
1girl,
silver hair,
bob cut,
plain oversized white t-shirt,
black shorts,
classroom,
window,
sitting on chair,
looking out the window,
sad expression,
evening
```

Classroom, window, chair, evening, and subject attributes appeared. Gaze, subtle sadness, and by-window relation were weak.

Compiler version added/clarified `slightly sad / wistful`, `sitting on chair`, `near / by the window`, `looking outside`, `full body`, `three-quarter view`, `classroom interior`, `evening`, and `warm sunset light`. Scene unity, evening lighting, window-side placement, and full-body seated composition improved. Conclusion: scene/object/framing structure is easier to improve than precise gaze or subtle expression.

### Rainy night street and umbrella

`holding transparent umbrella, rainy night, city street, street lights, wet road reflection` reliably produced rain, a transparent umbrella, night scene, reflections, street lights, and cinematic character. Adding `under a street light`, `rainy night city street`, `wet asphalt reflecting lights`, `cinematic night lighting`, `full body`, and `three-quarter view` improved person placement, relation to the street light, full body, reflections, and scene completion. `under a street light` combines lighting with a human–object spatial relation.

### Closed transparent umbrella after rain

The intended scene was walking through a neon alley after rain, looking back, with a closed transparent umbrella in one hand.

- `holding a closed transparent umbrella + rainy night city street`: rain cluster opened the umbrella.
- `closed umbrella`: closed state improved but transparency disappeared.
- `transparent closed umbrella`: phrase-level state/appearance binding improved.
- `holding a folded transparent umbrella at her side`: type + state + relation + position improved further.
- `after rain` aligned better with a closed umbrella than `rainy`; `wet hair` reinforced the scene.

## Multi-subject trials

### Flat `2girls` version

```text
2girls,
silver hair,
bob cut,
black long hair,
walking,
park,
evening,
talking
```

Two people, park, evening, and walking together appeared, but hair ownership was ambiguous and conversation weak.

### Entity-bound version

```text
girl with silver hair and bob cut,
girl with black long hair,
walking together,
side by side,
talking with each other,
park,
evening,
soft sunset light,
full body,
three-quarter view
```

Hair separation improved, walking together was strong, shared outfits were stable, and talking remained weak. This is the evidence for per-entity bundles.

### Outfit, expression, gaze, and holding hands

Silver-haired subject: white hoodie, skirt, shy smile, looking at black-haired subject. Black-haired subject: black jacket, long skirt, calm expression, looking at silver-haired subject. Shared relation: holding hands, walking side by side.

Hair separation was good, outfit separation good-to-medium, holding hands comparatively strong, expression separation weak but sometimes successful, and gaze separation difficult. Larger faces sometimes showed the shy versus calm distinction. Conclusion: expression ownership is possible but strongly depends on face resolution, camera, and attention relation.

### One-sided waving

Assigning waving only to the silver-haired subject and standing/calm to the black-haired subject produced many examples with only the intended arm raised. Physical action assignment had partial success; `waving_to` target remained weak. Physical arm action was stronger than attention target.

## Directed drink handoff

### Flat relation

```text
2girls,
silver hair bob cut,
black long hair,
giving a drink,
park,
evening
```

A drink and two-person social scene appeared, but both subjects often held drinks, sat/drank, or otherwise failed to establish directed handoff. `giving a drink` compressed to Drink + Social Scene.

### Directional compiler phrasing

```text
silver-haired girl handing a drink to the black-haired girl,
black-haired girl receiving the drink,
standing near a park bench,
evening,
warm sunset light,
full body,
three-quarter view
```

Role differences increased, sometimes one stood while the other sat, and the drink moved between them. Direction was not fully fixed.

Adding:

```text
silver-haired girl standing beside the bench,
black-haired girl sitting on the bench,
silver-haired girl handing a drink,
black-haired girl reaching out her hand to receive
```

produced many near-handoff images. Support relations helped, while the bench social-scene cluster competed. The resulting design requires A state, B state, object, A action, B counter-action, spatial relation, and contact stage.

## Relation strength summary

- Strong: physical contact, support, object relation, shared whole-body action.
- Medium: directed physical action.
- Weak: attention, subtle expression relation, precise gaze.

These findings motivate the N:N graph; they do not claim that explicit edges guarantee perfect rendered ownership.
