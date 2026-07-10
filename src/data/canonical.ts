import type { PromptTag } from './tags'

export function resolveCanonicalTag(id: string, dictionary: PromptTag[]): PromptTag | undefined {
  const byId = new Map(dictionary.map(tag => [tag.id, tag]))
  const visited = new Set<string>()
  let current = byId.get(id)

  while (current?.deprecated && current.redirectTo) {
    if (visited.has(current.id)) throw new Error(`canonical redirect cycle: ${current.id}`)
    visited.add(current.id)
    current = byId.get(current.redirectTo)
  }
  return current
}

export function canonicalVisibleTags(dictionary: PromptTag[]): PromptTag[] {
  return dictionary.filter(tag => !tag.deprecated)
}

export function canonicalId(id: string, dictionary: PromptTag[]): string {
  return resolveCanonicalTag(id, dictionary)?.id ?? id
}

export function mergeCanonicalSources(canonical: PromptTag, incoming: PromptTag): PromptTag {
  return {
    ...canonical,
    sources: [...new Set([...(canonical.sources ?? ['existing']), ...(incoming.sources ?? [])])],
    aliases: [...new Set([...(canonical.aliases ?? []), ...(incoming.aliases ?? [])])],
    related: [...new Set([...(canonical.related ?? []), ...(incoming.related ?? [])])],
  }
}

export function mergeCanonicalTag(canonical: PromptTag, incoming: PromptTag, options?: { ambiguousPrompts?: string[] }): PromptTag {
  const merged = mergeCanonicalSources(canonical, incoming)
  const ambiguous = new Set((options?.ambiguousPrompts ?? ['v']).map(value => value.trim().toLowerCase()))
  const rinPreferred = incoming.sources?.includes('RIN') && !ambiguous.has(incoming.prompt.trim().toLowerCase())
  if (!rinPreferred || incoming.prompt === canonical.prompt) return merged
  return {
    ...merged,
    prompt: incoming.prompt,
    aliases: [...new Set([...(merged.aliases ?? []), canonical.prompt])],
  }
}
