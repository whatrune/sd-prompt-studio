const BINDING_ROOT_KEYS = [
  'record_type',
  'version',
  'graph_source',
  'graph_schema_source',
  'graph_schema_id',
  'graph_schema_version',
  'graph_version',
  'bindings',
]

const GRAPH_ROOT_KEYS = [
  'schema_version',
  'graph_version',
  'generated_at',
  'source_files',
  'concepts',
  'relations',
  'target_patterns',
  'unmodeled_effects',
  'model_profiles',
  'intent_profiles',
  'control_context_profiles',
  'indexes',
]

const EXPECTED_SOURCE_FILES = [
  'concepts/physical-concepts.json',
  'concepts/relations.json',
  'concepts/semantic-concepts.json',
  'concepts/target-patterns.json',
  'concepts/unmodeled-effects.json',
]

const BINDING_CONSTANTS = Object.freeze({
  record_type: 'visual_concept_prompt_tag_bindings_v1',
  version: 1,
  graph_source: 'research/sd-prompt-research/dist/visual-concept-graph.json',
  graph_schema_source: 'research/sd-prompt-research/schemas/visual-concept-graph.schema.json',
  graph_schema_id: 'https://local.sd-prompt-studio/visual-concept-graph-v0.2.schema.json',
  graph_schema_version: '0.2.0',
})

const GRAPH_VERSION = /^0\.[0-9]+\.[0-9]+$/

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasExactKeys(value, expected) {
  const actual = Object.keys(value).sort()
  const canonical = [...expected].sort()
  return actual.length === canonical.length && actual.every((key, index) => key === canonical[index])
}

function rejected(reason) {
  return Object.freeze({
    record_type: 'visual_concept_read_only_projection_v1',
    status: 'REJECTED',
    reason,
    entries: Object.freeze([]),
  })
}

function validateBindingContract(value) {
  if (!isRecord(value) || !hasExactKeys(value, BINDING_ROOT_KEYS)) return 'binding_contract_invalid'
  for (const [key, expected] of Object.entries(BINDING_CONSTANTS)) {
    if (value[key] !== expected) return 'binding_contract_invalid'
  }
  if (typeof value.graph_version !== 'string' || !GRAPH_VERSION.test(value.graph_version)) return 'binding_contract_invalid'
  if (!Array.isArray(value.bindings)) return 'binding_contract_invalid'

  const bindings = []
  for (const candidate of value.bindings) {
    if (!isRecord(candidate) || !hasExactKeys(candidate, ['prompt_tag_id', 'concept_id'])) return 'binding_contract_invalid'
    if (typeof candidate.prompt_tag_id !== 'string' || !candidate.prompt_tag_id || typeof candidate.concept_id !== 'string' || !candidate.concept_id) return 'binding_contract_invalid'
    bindings.push(Object.freeze({ prompt_tag_id: candidate.prompt_tag_id, concept_id: candidate.concept_id }))
  }
  if (bindings.some((binding, index) => index > 0 && bindings[index - 1].prompt_tag_id.localeCompare(binding.prompt_tag_id) >= 0)) return 'binding_identity_conflict'
  return { bindings: Object.freeze(bindings) }
}

function validatePromptTagRegistry(registry) {
  if (!Array.isArray(registry)) return 'binding_identity_conflict'
  const byId = new Map()
  for (const tag of registry) {
    if (!isRecord(tag) || typeof tag.id !== 'string' || !tag.id || byId.has(tag.id)) return 'binding_identity_conflict'
    byId.set(tag.id, tag)
  }
  return byId
}

function validateGraphContract(value, boundConceptIds) {
  if (!isRecord(value)) return 'graph_contract_invalid'
  if (value.schema_version !== BINDING_CONSTANTS.graph_schema_version) return 'graph_contract_unsupported'
  if (!hasExactKeys(value, GRAPH_ROOT_KEYS)) return 'graph_contract_invalid'
  if (typeof value.graph_version !== 'string' || !GRAPH_VERSION.test(value.graph_version)
    || typeof value.generated_at !== 'string'
    || !Array.isArray(value.source_files)
    || !Array.isArray(value.concepts)
    || !Array.isArray(value.relations)
    || !Array.isArray(value.target_patterns)
    || !Array.isArray(value.unmodeled_effects)
    || !Array.isArray(value.model_profiles)
    || !Array.isArray(value.intent_profiles)
    || !Array.isArray(value.control_context_profiles)
    || !isRecord(value.indexes)) return 'graph_contract_invalid'
  if (value.source_files.length !== EXPECTED_SOURCE_FILES.length || value.source_files.some((source, index) => source !== EXPECTED_SOURCE_FILES[index])) return 'graph_contract_invalid'

  const concepts = []
  for (const candidate of value.concepts) {
    if (!isRecord(candidate) || typeof candidate.concept_id !== 'string' || !candidate.concept_id || typeof candidate.status !== 'string') return 'graph_contract_invalid'
    concepts.push({ concept_id: candidate.concept_id, status: candidate.status })
  }
  const conceptCounts = new Map()
  concepts.forEach(concept => conceptCounts.set(concept.concept_id, (conceptCounts.get(concept.concept_id) ?? 0) + 1))
  if ([...boundConceptIds].some(conceptId => (conceptCounts.get(conceptId) ?? 0) > 1)) return 'binding_concept_ambiguous'
  if ([...conceptCounts.values()].some(count => count > 1)) return 'graph_contract_invalid'

  const conceptsById = value.indexes.concepts_by_id
  if (!isRecord(conceptsById) || Object.keys(conceptsById).length !== concepts.length) return 'graph_contract_invalid'
  for (const [conceptId, index] of Object.entries(conceptsById)) {
    if (!Number.isInteger(index) || index < 0 || index >= concepts.length || concepts[index]?.concept_id !== conceptId) return 'graph_contract_invalid'
  }
  return { concepts: Object.freeze(concepts) }
}

function validSelectedTag(value) {
  return isRecord(value)
    && typeof value.id === 'string' && value.id.length > 0
    && typeof value.prompt === 'string'
    && typeof value.label === 'string'
    && typeof value.category === 'string' && value.category.length > 0
    && typeof value.weight === 'number' && Number.isFinite(value.weight)
}

function validateProjectionInput(input) {
  if (!isRecord(input) || !hasExactKeys(input, ['blocks', 'sceneTags']) || !Array.isArray(input.blocks) || !Array.isArray(input.sceneTags)) return false
  const blockIds = new Set()
  for (const block of input.blocks) {
    if (!isRecord(block) || typeof block.id !== 'string' || !block.id || blockIds.has(block.id) || !Array.isArray(block.tags) || !block.tags.every(validSelectedTag)) return false
    blockIds.add(block.id)
  }
  return input.sceneTags.every(validSelectedTag)
}

function registryIdentityMatches(input, registered) {
  return input.id === registered.id && input.prompt === registered.prompt && input.category === registered.category
}

export function createVisualConceptReadOnlyEntryAdapterV1(dependencies) {
  return (input) => {
    const bindingResult = validateBindingContract(dependencies.bindingContract)
    if (typeof bindingResult === 'string') return rejected(bindingResult)

    const registryResult = validatePromptTagRegistry(dependencies.promptTagRegistry)
    if (typeof registryResult === 'string') return rejected(registryResult)
    for (const binding of bindingResult.bindings) {
      if (!registryResult.has(binding.prompt_tag_id)) return rejected('binding_prompt_tag_missing')
    }

    const graphResult = validateGraphContract(dependencies.graphContract, new Set(bindingResult.bindings.map(binding => binding.concept_id)))
    if (typeof graphResult === 'string') return rejected(graphResult)
    const boundConcepts = new Map()
    for (const binding of bindingResult.bindings) {
      const matches = graphResult.concepts.filter(concept => concept.concept_id === binding.concept_id)
      if (matches.length === 0) return rejected('binding_concept_missing')
      if (matches.length !== 1) return rejected('binding_concept_ambiguous')
      if (matches[0].status !== 'provisional' && matches[0].status !== 'confirmed') return rejected('binding_concept_inadmissible')
      boundConcepts.set(binding.prompt_tag_id, matches[0])
    }
    if (!validateProjectionInput(input)) return rejected('projection_input_invalid')

    const entries = []
    const append = (ownerKind, ownerId, tag) => {
      const registered = registryResult.get(tag.id)
      if (registered && !registryIdentityMatches(tag, registered)) throw new Error('projection_input_invalid')
      const concept = registered ? boundConcepts.get(tag.id) : undefined
      entries.push(Object.freeze({
        record_type: 'visual_concept_entry_v1',
        owner_kind: ownerKind,
        owner_id: ownerId,
        prompt_tag_id: tag.id,
        mapping_status: concept ? 'MAPPED' : 'UNMAPPED',
        concept_id: concept?.concept_id ?? null,
        concept_status: concept ? concept.status : null,
        diagnostic: concept ? null : registered ? 'prompt_tag_unmapped' : 'non_registry_tag_unmapped',
      }))
    }

    try {
      input.blocks.forEach(block => block.tags.forEach(tag => append('PROMPT_BLOCK', block.id, tag)))
      input.sceneTags.forEach(tag => append('SCENE', 'scene', tag))
    } catch (error) {
      if (error instanceof Error && error.message === 'projection_input_invalid') return rejected('projection_input_invalid')
      throw error
    }
    return Object.freeze({
      record_type: 'visual_concept_read_only_projection_v1',
      status: 'PROJECTED',
      reason: null,
      entries: Object.freeze(entries),
    })
  }
}
