import type { PromptBlock, SelectedTag } from './store'

const ROOT_KEYS = ['record_type', 'version', 'source_binding', 'coverage', 'mappings', 'relations']
const SOURCE_KEYS = ['binding_record_type', 'binding_version', 'binding_sha256', 'graph_schema_id', 'graph_schema_version', 'registry_sha256']
const COVERAGE_KEYS = ['active_prompt_tag_count', 'mapped_active_prompt_tag_count', 'unmapped_active_prompt_tag_count']
const MAPPING_KEYS = ['prompt_tag_id', 'concept_id', 'concept_label', 'concept_module', 'concept_type', 'concept_status']
const SHA256 = /^[0-9a-f]{64}$/
const EXPECTED_MAPPINGS = [
  ['hai-long-hair', 'hair.long'],
  ['pos-lying', 'body.state.lying'],
  ['pos-lying-on-back', 'body.orientation.face_up'],
  ['rin-pose-arm-support', 'support.arm.rearward'],
  ['rin-pose-reclining', 'body.state.reclined'],
  ['v192-bent-knees', 'configuration.knee.bent'],
] as const

type CatalogMapping = {
  prompt_tag_id: string
  concept_id: string
  concept_label: string
  concept_module: string
  concept_type: string
  concept_status: 'provisional' | 'confirmed'
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
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const exactKeys = (value: Record<string, unknown>, expected: string[]) => {
  const actual = Object.keys(value).sort()
  const sortedExpected = [...expected].sort()
  return actual.length === sortedExpected.length && actual.every((key, index) => key === sortedExpected[index])
}
const nonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.length > 0
const nonNegativeInteger = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0

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
  })
}

function validateCatalog(value: unknown): Map<string, CatalogMapping> | null {
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
  return mappings
}

const validTag = (tag: unknown): tag is SelectedTag => isRecord(tag)
  && nonEmptyString(tag.id)
  && typeof tag.label === 'string'
  && typeof tag.prompt === 'string'
  && nonEmptyString(tag.category)
  && typeof tag.weight === 'number' && Number.isFinite(tag.weight)

export function projectVisualConceptProductionAdvisoryV1({ catalog, blocks, sceneTags }: {
  catalog: unknown
  blocks: readonly PromptBlock[]
  sceneTags: readonly SelectedTag[]
}): VisualConceptProductionAdvisoryV1 {
  const mappings = validateCatalog(catalog)
  if (!mappings) return unavailable('catalog_contract_invalid')
  if (!Array.isArray(blocks) || !Array.isArray(sceneTags)) return unavailable('projection_input_invalid')

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
  })
}
