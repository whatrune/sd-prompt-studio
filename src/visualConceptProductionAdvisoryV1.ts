import type { PromptBlock, SelectedTag } from './store'

const ROOT_KEYS = ['record_type', 'version', 'source_binding', 'coverage', 'mappings', 'constraint_concepts', 'advisory_effects', 'relations']
const SOURCE_KEYS = ['binding_record_type', 'binding_version', 'binding_sha256', 'graph_schema_id', 'graph_schema_version', 'registry_sha256']
const COVERAGE_KEYS = ['active_prompt_tag_count', 'mapped_active_prompt_tag_count', 'unmapped_active_prompt_tag_count']
const MAPPING_KEYS = ['prompt_tag_id', 'concept_id', 'concept_label', 'concept_module', 'concept_type', 'concept_status']
const CONSTRAINT_CONCEPT_KEYS = ['concept_id', 'concept_label', 'concept_module', 'concept_type', 'concept_status']
const ADVISORY_EFFECT_KEYS = ['effect_id', 'target_concept_id', 'advisory_status', 'confidence', 'model_profile']
const SHA256 = /^[0-9a-f]{64}$/
const EXPECTED_MAPPINGS = [
  ['cam-close-up', 'camera.framing.close_up'],
  ['cam-cowboy-shot', 'camera.framing.cowboy_shot'],
  ['cam-full-body', 'camera.framing.full_body'],
  ['cam-upper-body', 'camera.framing.upper_body'],
  ['hai-long-hair', 'hair.long'],
  ['pos-lying', 'body.state.lying'],
  ['pos-lying-on-back', 'body.orientation.face_up'],
  ['rin-pose-arm-support', 'support.arm.rearward'],
  ['rin-pose-reclining', 'body.state.reclined'],
  ['v192-bent-knees', 'configuration.knee.bent'],
] as const
const EXPECTED_CONSTRAINT_CONCEPT_IDS = ['visibility.feet', 'visibility.hands', 'visibility.head'] as const
const EXPECTED_FRAMING_CONCEPT_IDS = ['camera.framing.close_up', 'camera.framing.cowboy_shot', 'camera.framing.full_body', 'camera.framing.upper_body'] as const
const EXPECTED_ADVISORY_EFFECT_ID = 'unmodeled.pose_body_overlap.hand_visibility' as const

type CatalogMapping = {
  prompt_tag_id: string
  concept_id: string
  concept_label: string
  concept_module: string
  concept_type: string
  concept_status: 'provisional' | 'confirmed'
}

type CatalogConstraintConcept = Omit<CatalogMapping, 'prompt_tag_id'>
type CatalogAdvisoryEffect = {
  effect_id: typeof EXPECTED_ADVISORY_EFFECT_ID
  target_concept_id: 'visibility.hands'
  advisory_status: 'ADVISORY_ONLY'
  confidence: 'high'
  model_profile: 'model.novaanimexl_ilv190'
}

export type VisualConceptCompilerConstraintIntentV1 = {
  record_type: 'visual_concept_compiler_constraint_intent_v1'
  version: 1
  required_visible_region_concept_ids: readonly typeof EXPECTED_CONSTRAINT_CONCEPT_IDS[number][]
  minimum_framing_concept_id: typeof EXPECTED_FRAMING_CONCEPT_IDS[number] | null
}

export type VisualConceptCompilerConstraintMetadataV1 = {
  record_type: 'visual_concept_compiler_constraint_metadata_v1'
  version: 1
  requested: VisualConceptCompilerConstraintIntentV1
  observed_generated_visibility: null
  advisory_effects: readonly CatalogAdvisoryEffect[]
}

export type VisualConceptProductionAdvisoryEntryV1 = CatalogMapping & {
  owner_kind: 'PROMPT_BLOCK' | 'SCENE'
  owner_id: string
  prompt_tag_label: string
}

export type VisualConceptProductionAdvisoryUncoveredEntryV1 = {
  owner_kind: 'PROMPT_BLOCK' | 'SCENE'
  owner_id: string
  prompt_tag_id: string
  prompt_tag_label: string
}

export type VisualConceptProductionAdvisoryV1 = {
  record_type: 'visual_concept_production_advisory_v1'
  version: 1
  advisory_status: 'READY' | 'UNAVAILABLE'
  unavailable_reason: 'catalog_contract_invalid' | 'projection_input_invalid' | null
  selected_tag_count: number
  mapped_count: number
  uncovered_selected_tag_count: number
  mapped_entries: readonly VisualConceptProductionAdvisoryEntryV1[]
  uncovered_entries: readonly VisualConceptProductionAdvisoryUncoveredEntryV1[]
  constraint_metadata: VisualConceptCompilerConstraintMetadataV1
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const exactKeys = (value: Record<string, unknown>, expected: string[]) => {
  const actual = Object.keys(value).sort()
  const sortedExpected = [...expected].sort()
  return actual.length === sortedExpected.length && actual.every((key, index) => key === sortedExpected[index])
}
const nonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.length > 0
const nonNegativeInteger = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0
const EMPTY_INTENT: VisualConceptCompilerConstraintIntentV1 = Object.freeze({
  record_type: 'visual_concept_compiler_constraint_intent_v1',
  version: 1,
  required_visible_region_concept_ids: Object.freeze([]),
  minimum_framing_concept_id: null,
})

const constraintMetadata = (
  requested: VisualConceptCompilerConstraintIntentV1,
  advisoryEffects: readonly CatalogAdvisoryEffect[] = [],
): VisualConceptCompilerConstraintMetadataV1 => Object.freeze({
  record_type: 'visual_concept_compiler_constraint_metadata_v1',
  version: 1,
  requested,
  observed_generated_visibility: null,
  advisory_effects: Object.freeze([...advisoryEffects]),
})

function unavailable(reason: 'catalog_contract_invalid' | 'projection_input_invalid'): VisualConceptProductionAdvisoryV1 {
  return Object.freeze({
    record_type: 'visual_concept_production_advisory_v1',
    version: 1,
    advisory_status: 'UNAVAILABLE',
    unavailable_reason: reason,
    selected_tag_count: 0,
    mapped_count: 0,
    uncovered_selected_tag_count: 0,
    mapped_entries: Object.freeze([]),
    uncovered_entries: Object.freeze([]),
    constraint_metadata: constraintMetadata(EMPTY_INTENT),
  })
}

function validateCatalog(value: unknown): { mappings: Map<string, CatalogMapping>; advisoryEffect: CatalogAdvisoryEffect } | null {
  if (!isRecord(value) || !exactKeys(value, ROOT_KEYS)
    || value.record_type !== 'visual_concept_production_advisory_catalog_v1'
    || value.version !== 1
    || !isRecord(value.source_binding) || !exactKeys(value.source_binding, SOURCE_KEYS)
    || value.source_binding.binding_record_type !== 'visual_concept_prompt_tag_bindings_v1'
    || value.source_binding.binding_version !== 1
    || !SHA256.test(String(value.source_binding.binding_sha256))
    || value.source_binding.graph_schema_id !== 'https://local.sd-prompt-studio/visual-concept-graph-v0.2.schema.json'
    || value.source_binding.graph_schema_version !== '0.2.0'
    || !SHA256.test(String(value.source_binding.registry_sha256))
    || !isRecord(value.coverage) || !exactKeys(value.coverage, COVERAGE_KEYS)
    || !nonNegativeInteger(value.coverage.active_prompt_tag_count)
    || !nonNegativeInteger(value.coverage.mapped_active_prompt_tag_count)
    || !nonNegativeInteger(value.coverage.unmapped_active_prompt_tag_count)
    || value.coverage.mapped_active_prompt_tag_count + value.coverage.unmapped_active_prompt_tag_count !== value.coverage.active_prompt_tag_count
    || !Array.isArray(value.mappings) || value.mappings.length !== EXPECTED_MAPPINGS.length
    || value.coverage.mapped_active_prompt_tag_count !== value.mappings.length
    || !Array.isArray(value.constraint_concepts) || value.constraint_concepts.length !== EXPECTED_CONSTRAINT_CONCEPT_IDS.length
    || !Array.isArray(value.advisory_effects) || value.advisory_effects.length !== 1
    || !Array.isArray(value.relations) || value.relations.length !== 0) return null

  const mappings = new Map<string, CatalogMapping>()
  let priorId = ''
  for (const [index, candidate] of value.mappings.entries()) {
    if (!isRecord(candidate) || !exactKeys(candidate, MAPPING_KEYS)
      || !nonEmptyString(candidate.prompt_tag_id)
      || !nonEmptyString(candidate.concept_id)
      || !nonEmptyString(candidate.concept_label)
      || !nonEmptyString(candidate.concept_module)
      || !nonEmptyString(candidate.concept_type)
      || (candidate.concept_status !== 'provisional' && candidate.concept_status !== 'confirmed')
      || candidate.prompt_tag_id !== EXPECTED_MAPPINGS[index][0]
      || candidate.concept_id !== EXPECTED_MAPPINGS[index][1]
      || (priorId && priorId.localeCompare(candidate.prompt_tag_id) >= 0)
      || mappings.has(candidate.prompt_tag_id)) return null
    priorId = candidate.prompt_tag_id
    mappings.set(candidate.prompt_tag_id, candidate as CatalogMapping)
  }
  for (const [index, candidate] of value.constraint_concepts.entries()) {
    if (!isRecord(candidate) || !exactKeys(candidate, CONSTRAINT_CONCEPT_KEYS)
      || candidate.concept_id !== EXPECTED_CONSTRAINT_CONCEPT_IDS[index]
      || !nonEmptyString(candidate.concept_label)
      || candidate.concept_module !== 'physical'
      || candidate.concept_type !== 'visibility'
      || (candidate.concept_status !== 'provisional' && candidate.concept_status !== 'confirmed')) return null
  }
  const effect = value.advisory_effects[0]
  if (!isRecord(effect) || !exactKeys(effect, ADVISORY_EFFECT_KEYS)
    || effect.effect_id !== EXPECTED_ADVISORY_EFFECT_ID
    || effect.target_concept_id !== 'visibility.hands'
    || effect.advisory_status !== 'ADVISORY_ONLY'
    || effect.confidence !== 'high'
    || effect.model_profile !== 'model.novaanimexl_ilv190') return null
  return { mappings, advisoryEffect: effect as CatalogAdvisoryEffect }
}

function validateConstraintIntent(value: unknown): VisualConceptCompilerConstraintIntentV1 | null {
  if (value === undefined) return EMPTY_INTENT
  if (!isRecord(value) || !exactKeys(value, ['record_type', 'version', 'required_visible_region_concept_ids', 'minimum_framing_concept_id'])
    || value.record_type !== 'visual_concept_compiler_constraint_intent_v1'
    || value.version !== 1
    || !Array.isArray(value.required_visible_region_concept_ids)
    || !value.required_visible_region_concept_ids.every(id => typeof id === 'string' && EXPECTED_CONSTRAINT_CONCEPT_IDS.includes(id as typeof EXPECTED_CONSTRAINT_CONCEPT_IDS[number]))
    || new Set(value.required_visible_region_concept_ids).size !== value.required_visible_region_concept_ids.length
    || value.required_visible_region_concept_ids.some((id, index, values) => index > 0 && values[index - 1].localeCompare(id) >= 0)
    || (value.minimum_framing_concept_id !== null
      && (typeof value.minimum_framing_concept_id !== 'string'
        || !EXPECTED_FRAMING_CONCEPT_IDS.includes(value.minimum_framing_concept_id as typeof EXPECTED_FRAMING_CONCEPT_IDS[number])))) return null
  return Object.freeze({
    record_type: value.record_type,
    version: value.version,
    required_visible_region_concept_ids: Object.freeze([...value.required_visible_region_concept_ids]) as readonly typeof EXPECTED_CONSTRAINT_CONCEPT_IDS[number][],
    minimum_framing_concept_id: value.minimum_framing_concept_id as typeof EXPECTED_FRAMING_CONCEPT_IDS[number] | null,
  })
}

const validTag = (tag: unknown): tag is SelectedTag => isRecord(tag)
  && nonEmptyString(tag.id)
  && typeof tag.label === 'string'
  && typeof tag.prompt === 'string'
  && nonEmptyString(tag.category)
  && typeof tag.weight === 'number' && Number.isFinite(tag.weight)

export function projectVisualConceptProductionAdvisoryV1({ catalog, blocks, sceneTags, constraintIntent }: {
  catalog: unknown
  blocks: readonly PromptBlock[]
  sceneTags: readonly SelectedTag[]
  constraintIntent?: VisualConceptCompilerConstraintIntentV1
}): VisualConceptProductionAdvisoryV1 {
  const catalogProjection = validateCatalog(catalog)
  if (!catalogProjection) return unavailable('catalog_contract_invalid')
  const requested = validateConstraintIntent(constraintIntent)
  if (!requested || !Array.isArray(blocks) || !Array.isArray(sceneTags)) return unavailable('projection_input_invalid')
  const { mappings, advisoryEffect } = catalogProjection

  const blockIds = new Set<string>()
  for (const block of blocks) {
    if (!isRecord(block) || !nonEmptyString(block.id) || blockIds.has(block.id) || !Array.isArray(block.tags) || !block.tags.every(validTag)) return unavailable('projection_input_invalid')
    blockIds.add(block.id)
  }
  if (!sceneTags.every(validTag)) return unavailable('projection_input_invalid')

  const mappedEntries: VisualConceptProductionAdvisoryEntryV1[] = []
  const uncoveredEntries: VisualConceptProductionAdvisoryUncoveredEntryV1[] = []
  let selectedTagCount = 0
  const append = (ownerKind: 'PROMPT_BLOCK' | 'SCENE', ownerId: string, tag: SelectedTag) => {
    selectedTagCount += 1
    const mapping = mappings.get(tag.id)
    if (!mapping) {
      uncoveredEntries.push(Object.freeze({
        owner_kind: ownerKind,
        owner_id: ownerId,
        prompt_tag_id: tag.id,
        prompt_tag_label: tag.label,
      }))
      return
    }
    mappedEntries.push(Object.freeze({
      owner_kind: ownerKind,
      owner_id: ownerId,
      prompt_tag_label: tag.label,
      ...mapping,
    }))
  }
  blocks.forEach(block => block.tags.forEach((tag: SelectedTag) => append('PROMPT_BLOCK', block.id, tag)))
  sceneTags.forEach((tag: SelectedTag) => append('SCENE', 'scene', tag))

  return Object.freeze({
    record_type: 'visual_concept_production_advisory_v1',
    version: 1,
    advisory_status: 'READY',
    unavailable_reason: null,
    selected_tag_count: selectedTagCount,
    mapped_count: mappedEntries.length,
    uncovered_selected_tag_count: selectedTagCount - mappedEntries.length,
    mapped_entries: Object.freeze(mappedEntries),
    uncovered_entries: Object.freeze(uncoveredEntries),
    constraint_metadata: constraintMetadata(
      requested,
      requested.required_visible_region_concept_ids.includes('visibility.hands') ? [advisoryEffect] : [],
    ),
  })
}
