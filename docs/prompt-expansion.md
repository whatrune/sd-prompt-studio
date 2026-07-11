# Prompt Expansion Layer

Prompt Expansion separates dictionary selections from model-specific output. `buildPrompt` remains the compatibility entry point, but delegates to the expansion layer before producing text.

## Entities and Scene

- A character keeps `id`, `name`, `position`, and its selected tags. Position is `left`, `center`, or `right`.
- Scene metadata exposes `subject_count`, interaction tags, composition tags, and the deduplicated shared Scene tags.
- Scene tags are emitted once regardless of character count.

Saved data version 10 adds optional character position metadata. Migration assigns `center` to a single character and `left`, `right`, then `center` to existing multi-character data. Tag IDs, weights, selection order, favorites, and user dictionaries are unchanged.

## Output strategies

The initial `illustrious` strategy labels multiple entities with `Left side:`, `Right side:`, or `Center:`. Single-character output deliberately omits position labels and remains byte-for-byte compatible with the prior prompt builder. Other model presets currently retain the neutral entity layout and can gain dedicated strategies later.

Entity and Scene separators are explicit expansion options. The compatibility API uses `BREAK`; callers that need workflow-specific separators can use `buildPromptWithStrategy` and provide another subject separator.
