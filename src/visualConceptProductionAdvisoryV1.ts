import type { PromptBlock, SelectedTag } from './store'
import {
  admitVisualConceptCompilerConstraintIntentV1,
  EMPTY_VISUAL_CONCEPT_COMPILER_CONSTRAINT_INTENT_V1,
  type VisualConceptCompilerConstraintIntentV1,
} from './visualConceptCompilerConstraintIntentV1'

const ROOT_KEYS = ['record_type', 'version', 'source_binding', 'coverage', 'mappings', 'constraint_concepts', 'advisory_effects', 'relations']
const SOURCE_KEYS = ['binding_record_type', 'binding_version', 'binding_sha256', 'graph_schema_id', 'graph_schema_version', 'registry_sha256']
const COVERAGE_KEYS = ['active_prompt_tag_count', 'mapped_active_prompt_tag_count', 'unmapped_active_prompt_tag_count']
const MAPPING_KEYS = ['prompt_tag_id', 'concept_id', 'concept_label', 'concept_module', 'concept_type', 'concept_status']
const CONSTRAINT_CONCEPT_KEYS = ['concept_id', 'concept_label', 'concept_module', 'concept_type', 'concept_status']
const ADVISORY_EFFECT_KEYS = ['advisory_id', 'effect_id', 'target_concept_id', 'trigger_prompt_tags', 'advisory_status', 'confidence', 'model_profile']
const ADVISORY_TRIGGER_KEYS = ['prompt_tag_id', 'prompt', 'category', 'slot']
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
const EXPECTED_ADVISORY_EFFECT_ID = 'unmodeled.pose_body_overlap.hand_visibility' as const
const EXPECTED_ADVISORY_ID = 'hand_visibility_risk' as const
const EXPECTED_ADVISORY_TRIGGER = Object.freeze({
  prompt_tag_id: 'pos-hands-behind-back',
  prompt: 'hands behind back',
  category: 'pose',
  slot: 'hand_action',
})

type CatalogMapping = {
  prompt_tag_id: string
  concept_id: string
  concept_label: string
  concept_module: string
  concept_type: string
  concept_status: 'provisional' | 'confirmed'
}

type CatalogConstraintConcept = Omit<CatalogMapping, 'prompt_tag_id'>
type CatalogAdvisoryTrigger = typeof EXPECTED_ADVISORY_TRIGGER
type CatalogAdvisoryEffect = {
  advisory_id: typeof EXPECTED_ADVISORY_ID
  effect_id: typeof EXPECTED_ADVISORY_EFFECT_ID
  target_concept_id: 'visibility.hands'
  trigger_prompt_tags: readonly CatalogAdvisoryTrigger[]
  advisory_status: 'ADVISORY_ONLY'
  confidence: 'high'
  model_profile: 'model.novaanimexl_ilv190'
}

export type VisualConceptCompilerConstraintMetadataV1 = {
  record_type: 'visual_concept_compiler_constraint_metadata_v1'
  version: 1
  requested: VisualConceptCompilerConstraintIntentV1
  observed_generated_visibility: null
  advisory_effects: readonly CatalogAdvisoryEffect[]
  advisory_inspection: VisualConceptCompilerAdvisoryInspectionV1
}

export type VisualConceptCompilerAdvisoryInspectionEntryV1 = {
  advisory_type: typeof EXPECTED_ADVISORY_ID
  trigger_context: {
    required_visible_region_concept_ids: readonly ['visibility.hands']
    trigger_prompt_tags: readonly CatalogAdvisoryTrigger[]
  }
  supporting_identity: {
    target_concept_id: 'visibility.hands'
    effect_id: typeof EXPECTED_ADVISORY_EFFECT_ID
    model_profile: 'model.novaanimexl_ilv190'
  }
  evidence: {
    status: 'ADVISORY_ONLY'
    confidence: 'high'
  }
  recommendation: null
}

export type VisualConceptCompilerAdvisoryInspectionV1 = {
  record_type: 'visual_concept_compiler_advisory_inspection_v1'
  version: 1
  entries: readonly VisualConceptCompilerAdvisoryInspectionEntryV1[]
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
const constraintMetadata = (
  requested: VisualConceptCompilerConstraintIntentV1,
  advisoryEffects: readonly CatalogAdvisoryEffect[] = [],
): VisualConceptCompilerConstraintMetadataV1 => Object.freeze({
  record_type: 'visual_concept_compiler_constraint_metadata_v1',
  version: 1,
  requested,
  observed_generated_visibility: null,
  advisory_effects: Object.freeze([...advisoryEffects]),
  advisory_inspection: Object.freeze({
    record_type: 'visual_concept_compiler_advisory_inspection_v1',
    version: 1,
    entries: Object.freeze(advisoryEffects.map(effect => Object.freeze({
      advisory_type: effect.advisory_id,
      trigger_context: Object.freeze({
        required_visible_region_concept_ids: Object.freeze(['visibility.hands'] as const),
        trigger_prompt_tags: Object.freeze(effect.trigger_prompt_tags.map(trigger => Object.freeze({ ...trigger }))),
      }),
      supporting_identity: Object.freeze({
        target_concept_id: effect.target_concept_id,
        effect_id: effect.effect_id,
        model_profile: effect.model_profile,
      }),
      evidence: Object.freeze({
        status: effect.advisory_status,
        confidence: effect.confidence,
      }),
      recommendation: null,
    }))),
  }),
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
    constraint_metadata: constraintMetadata(EMPTY_VISUAL_CONCEPT_COMPILER_CONSTRAINT_INTENT_V1),
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
    || effect.advisory_id !== EXPECTED_ADVISORY_ID
    || effect.effect_id !== EXPECTED_ADVISORY_EFFECT_ID
    || effect.target_concept_id !== 'visibility.hands'
    || !Array.isArray(effect.trigger_prompt_tags)
    || effect.trigger_prompt_tags.length !== 1
    || !effect.trigger_prompt_tags.every(trigger => isRecord(trigger)
      && exactKeys(trigger, ADVISORY_TRIGGER_KEYS)
      && trigger.prompt_tag_id === EXPECTED_ADVISORY_TRIGGER.prompt_tag_id
      && trigger.prompt === EXPECTED_ADVISORY_TRIGGER.prompt
      && trigger.category === EXPECTED_ADVISORY_TRIGGER.category
      && trigger.slot === EXPECTED_ADVISORY_TRIGGER.slot)
    || effect.advisory_status !== 'ADVISORY_ONLY'
    || effect.confidence !== 'high'
    || effect.model_profile !== 'model.novaanimexl_ilv190') return null
  return { mappings, advisoryEffect: effect as CatalogAdvisoryEffect }
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
  const requested = admitVisualConceptCompilerConstraintIntentV1(constraintIntent)
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
  const selectedTags: SelectedTag[] = []
  let selectedTagCount = 0
  const append = (ownerKind: 'PROMPT_BLOCK' | 'SCENE', ownerId: string, tag: SelectedTag) => {
    selectedTagCount += 1
    selectedTags.push(tag)
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
      requested.required_visible_region_concept_ids.includes('visibility.hands')
        && advisoryEffect.trigger_prompt_tags.some(trigger => selectedTags.some(tag => (
          tag.id === trigger.prompt_tag_id
          && tag.prompt === trigger.prompt
          && tag.category === trigger.category
          && tag.slot === trigger.slot
        )))
        ? [advisoryEffect]
        : [],
    ),
  })
}
