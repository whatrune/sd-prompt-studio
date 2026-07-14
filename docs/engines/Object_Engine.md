# Object Engine

## Responsibility

An object is an entity, not an unowned tag. Its type, appearance, state, relation, and position are resolved separately, while the renderer may bundle them into a natural learned phrase.

```text
Object
├ Appearance
├ State
├ Relation
└ Position
```

Example graph:

```yaml
object: umbrella
appearance: transparent
state: closed
relation: holding
position: at_side
```

Possible rendering: `holding a folded transparent umbrella at her side`.

## Resolver contract

1. Create a stable object entity.
2. Bind appearance and state to that entity, not the scene or human globally.
3. Create explicit relation edges to the human/environment.
4. Resolve position and support/contact.
5. Detect context conflicts.
6. Let the renderer choose an evidence-backed composite phrase without discarding component ownership.

## Umbrella case study

The target scene was a person walking through a neon alley after rain, looking back, holding a closed transparent umbrella in one hand.

- `holding a closed transparent umbrella + rainy night city street`: the active-rain cluster won and the umbrella opened.
- `closed umbrella`: closed state improved but transparency disappeared.
- `transparent closed umbrella`: phrase-level binding improved both properties.
- `holding a folded transparent umbrella at her side`: bundling object type, state, relation, and position improved further.
- replacing `rainy` with `after rain` reduced the conflict with a closed umbrella; `wet hair` reinforced the post-rain scene.

The design conclusion is not to flatten all properties into one database field. The graph stays componentized; the final renderer may compose them into a natural phrase.

## Supported interaction examples

- A wall object/environment surface supports `leaning against wall`.
- A chair entity supports `sitting on chair` and contributes seat/back/legs.
- A drink object mediates directed handoff relations.
- A street light is both a scene object/light source and a spatial target in `under a street light`.

## Planned object catalog

Initial held/carried/used candidates: umbrella, cup, phone, book, bag. Worn candidates: glasses, hat, headphones, earrings, necklace. State candidates: open/closed, folded/unfolded, active/inactive. Relation candidates: holding, wearing, carrying, using, placed_on.
