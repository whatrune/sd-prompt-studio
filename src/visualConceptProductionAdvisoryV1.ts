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
const HAND_ADVISORY_EFFECT_KEYS = ['advisory_id', 'effect_id', 'target_concept_id', 'trigger_prompt_tags', 'advisory_status', 'confidence', 'model_profile', 'explanation']
const FRAMING_ADVISORY_EFFECT_KEYS = ['advisory_id', 'effect_id', 'target_concept_id', 'required_prompt_tag', 'factor_prompt_tags', 'risky_prompt_tag_combinations', 'advisory_status', 'confidence', 'model_profile', 'explanation']
const ADVISORY_TRIGGER_KEYS = ['prompt_tag_id', 'prompt', 'category', 'slot']
const DERIVED_ADVISORY_TRIGGER_KEYS = [...ADVISORY_TRIGGER_KEYS, 'base_prompt_tag_id', 'color_modifier']
const ADVISORY_EXPLANATION_KEYS = ['summary', 'source_run_ids']
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
const EXPECTED_HAND_ADVISORY_EFFECT_ID = 'unmodeled.pose_body_overlap.hand_visibility' as const
const EXPECTED_HAND_ADVISORY_ID = 'hand_visibility_risk' as const
const EXPECTED_HAND_ADVISORY_TRIGGER = Object.freeze({
  prompt_tag_id: 'pos-hands-behind-back',
  prompt: 'hands behind back',
  category: 'pose',
  slot: 'hand_action',
})
const EXPECTED_HAND_ADVISORY_SOURCE_RUN_IDS = [
  'CAM-018-A', 'CAM-018-B', 'CAM-018-C', 'CAM-018-D',
  'CAM-019-A', 'CAM-019-B', 'CAM-019-C',
] as const
const EXPECTED_FRAMING_ADVISORY_EFFECT_ID = 'unmodeled.prompt_interaction.upper_body_framing_cam038' as const
const EXPECTED_FRAMING_ADVISORY_ID = 'upper_body_framing_widening_risk' as const
const EXPECTED_FRAMING_REQUIRED_PROMPT_TAG = Object.freeze({
  prompt_tag_id: 'cam-upper-body',
  prompt: 'upper body',
  category: 'camera',
  slot: 'camera_framing',
})
const EXPECTED_FRAMING_FACTOR_PROMPT_TAGS = Object.freeze([
  Object.freeze({ prompt_tag_id: 'pos-standing', prompt: 'standing', category: 'pose', slot: 'body_posture' }),
  Object.freeze({ prompt_tag_id: 'clo-barefoot', prompt: 'barefoot', category: 'clothes', slot: 'footwear' }),
  Object.freeze({
    prompt_tag_id: 'derived-color-clo-shorts-black',
    prompt: 'black shorts',
    category: 'clothes',
    slot: 'bottoms',
    base_prompt_tag_id: 'clo-shorts',
    color_modifier: 'black',
  }),
] as const)
const EXPECTED_FRAMING_RISKY_COMBINATIONS = Object.freeze([
  Object.freeze(['pos-standing', 'clo-barefoot']),
  Object.freeze(['clo-barefoot', 'derived-color-clo-shorts-black']),
] as const)
const EXPECTED_FRAMING_ADVISORY_SOURCE_RUN_IDS = [
  'CAM-038-A', 'CAM-038-B', 'CAM-038-C', 'CAM-038-D',
  'CAM-038-E', 'CAM-038-F', 'CAM-038-G', 'CAM-038-H',
] as const

type CatalogMapping = {
  prompt_tag_id: string
  concept_id: string
  concept_label: string
  concept_module: string
  concept_type: string
  concept_status: 'provisional' | 'confirmed'
}

type CatalogConstraintConcept = Omit<CatalogMapping, 'prompt_tag_id'>
type CatalogAdvisoryTrigger = {
  readonly prompt_tag_id: string
  readonly prompt: string
  readonly category: string
  readonly slot: string
}
type CatalogDerivedAdvisoryTrigger = CatalogAdvisoryTrigger & {
  readonly base_prompt_tag_id: string
  readonly color_modifier: string
}
type CatalogHandAdvisoryEffect = {
  advisory_id: typeof EXPECTED_HAND_ADVISORY_ID
  effect_id: typeof EXPECTED_HAND_ADVISORY_EFFECT_ID
  target_concept_id: 'visibility.hands'
  trigger_prompt_tags: readonly CatalogAdvisoryTrigger[]
  advisory_status: 'ADVISORY_ONLY'
  confidence: 'high'
  model_profile: 'model.novaanimexl_ilv190'
  explanation: {
    summary: string
    source_run_ids: readonly string[]
  }
}
type CatalogFramingAdvisoryEffect = {
  advisory_id: typeof EXPECTED_FRAMING_ADVISORY_ID
  effect_id: typeof EXPECTED_FRAMING_ADVISORY_EFFECT_ID
  target_concept_id: 'camera.framing.upper_body'
  required_prompt_tag: CatalogAdvisoryTrigger
  factor_prompt_tags: readonly (CatalogAdvisoryTrigger | CatalogDerivedAdvisoryTrigger)[]
  risky_prompt_tag_combinations: readonly (readonly string[])[]
  advisory_status: 'ADVISORY_ONLY'
  confidence: 'high'
  model_profile: 'model.novaanimexl_ilv190'
  explanation: {
    summary: string
    source_run_ids: readonly string[]
  }
}
type CatalogAdvisoryEffect = CatalogHandAdvisoryEffect | CatalogFramingAdvisoryEffect
type MatchedAdvisoryEffect = {
  effect: CatalogAdvisoryEffect
  triggerPromptTags: readonly (CatalogAdvisoryTrigger | CatalogDerivedAdvisoryTrigger)[]
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
  advisory_type: typeof EXPECTED_HAND_ADVISORY_ID | typeof EXPECTED_FRAMING_ADVISORY_ID
  trigger_context: {
    required_visible_region_concept_ids: VisualConceptCompilerConstraintIntentV1['required_visible_region_concept_ids']
    required_prompt_tags: readonly CatalogAdvisoryTrigger[]
    trigger_prompt_tags: readonly (CatalogAdvisoryTrigger | CatalogDerivedAdvisoryTrigger)[]
  }
  supporting_identity: {
    target_concept_id: 'visibility.hands' | 'camera.framing.upper_body'
    effect_id: typeof EXPECTED_HAND_ADVISORY_EFFECT_ID | typeof EXPECTED_FRAMING_ADVISORY_EFFECT_ID
    model_profile: 'model.novaanimexl_ilv190'
  }
  evidence: {
    status: 'ADVISORY_ONLY'
    confidence: 'high'
    source_run_ids: readonly string[]
  }
  explanation: { summary: string }
  presentation: {
    warning: string
    recommendation: string
  }
  recommendation: {
    suggestion_type: 'review_current_pose' | 'review_current_framing'
    message: string
    replacement_prompt_tag_id: null
    automatic_action: false
  }
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
  advisoryMatches: readonly MatchedAdvisoryEffect[] = [],
): VisualConceptCompilerConstraintMetadataV1 => Object.freeze({
  record_type: 'visual_concept_compiler_constraint_metadata_v1',
  version: 1,
  requested,
  observed_generated_visibility: null,
  advisory_effects: Object.freeze(advisoryMatches.map(match => match.effect)),
  advisory_inspection: Object.freeze({
    record_type: 'visual_concept_compiler_advisory_inspection_v1',
    version: 1,
    entries: Object.freeze(advisoryMatches.map(({ effect, triggerPromptTags }) => Object.freeze({
      advisory_type: effect.advisory_id,
      trigger_context: Object.freeze({
        required_visible_region_concept_ids: Object.freeze(
          effect.advisory_id === EXPECTED_HAND_ADVISORY_ID ? ['visibility.hands'] as const : [],
        ),
        required_prompt_tags: Object.freeze(
          effect.advisory_id === EXPECTED_FRAMING_ADVISORY_ID
            ? [Object.freeze({ ...effect.required_prompt_tag })]
            : [],
        ),
        trigger_prompt_tags: Object.freeze(triggerPromptTags.map(trigger => Object.freeze({ ...trigger }))),
      }),
      supporting_identity: Object.freeze({
        target_concept_id: effect.target_concept_id,
        effect_id: effect.effect_id,
        model_profile: effect.model_profile,
      }),
      evidence: Object.freeze({
        status: effect.advisory_status,
        confidence: effect.confidence,
        source_run_ids: Object.freeze([...effect.explanation.source_run_ids]),
      }),
      explanation: Object.freeze({ summary: effect.explanation.summary }),
      presentation: Object.freeze(effect.advisory_id === EXPECTED_HAND_ADVISORY_ID
        ? {
            warning: '“Hands behind back” may hide one or both hands behind the body, reducing complete hand visibility.',
            recommendation: 'Review current pose or arm placement.',
          }
        : {
            warning: 'Upper-body framing may widen with the current term combination.',
            recommendation: 'Review the current framing and selected terms.',
          }),
      recommendation: Object.freeze({
        suggestion_type: effect.advisory_id === EXPECTED_HAND_ADVISORY_ID
          ? 'review_current_pose' as const
          : 'review_current_framing' as const,
        message: effect.advisory_id === EXPECTED_HAND_ADVISORY_ID
          ? 'Review the current pose or arm placement when complete hand visibility is required; no replacement is selected automatically.'
          : 'Review the current upper-body framing and selected term combination; no framing or PromptTag change is selected automatically.',
        replacement_prompt_tag_id: null,
        automatic_action: false as const,
      }),
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

function validateCatalog(value: unknown): { mappings: Map<string, CatalogMapping>; handAdvisoryEffect: CatalogHandAdvisoryEffect; framingAdvisoryEffect: CatalogFramingAdvisoryEffect } | null {
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
    || !Array.isArray(value.advisory_effects) || value.advisory_effects.length !== 2
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
  const handEffect = value.advisory_effects[0]
  if (!isRecord(handEffect) || !exactKeys(handEffect, HAND_ADVISORY_EFFECT_KEYS)
    || handEffect.advisory_id !== EXPECTED_HAND_ADVISORY_ID
    || handEffect.effect_id !== EXPECTED_HAND_ADVISORY_EFFECT_ID
    || handEffect.target_concept_id !== 'visibility.hands'
    || !Array.isArray(handEffect.trigger_prompt_tags)
    || handEffect.trigger_prompt_tags.length !== 1
    || !handEffect.trigger_prompt_tags.every(trigger => isRecord(trigger)
      && exactKeys(trigger, ADVISORY_TRIGGER_KEYS)
      && trigger.prompt_tag_id === EXPECTED_HAND_ADVISORY_TRIGGER.prompt_tag_id
      && trigger.prompt === EXPECTED_HAND_ADVISORY_TRIGGER.prompt
      && trigger.category === EXPECTED_HAND_ADVISORY_TRIGGER.category
      && trigger.slot === EXPECTED_HAND_ADVISORY_TRIGGER.slot)
    || handEffect.advisory_status !== 'ADVISORY_ONLY'
    || handEffect.confidence !== 'high'
    || handEffect.model_profile !== 'model.novaanimexl_ilv190'
    || !isRecord(handEffect.explanation) || !exactKeys(handEffect.explanation, ADVISORY_EXPLANATION_KEYS)
    || !nonEmptyString(handEffect.explanation.summary)
    || !Array.isArray(handEffect.explanation.source_run_ids)
    || handEffect.explanation.source_run_ids.length !== EXPECTED_HAND_ADVISORY_SOURCE_RUN_IDS.length
    || handEffect.explanation.source_run_ids.some((runId, index) => runId !== EXPECTED_HAND_ADVISORY_SOURCE_RUN_IDS[index])) return null

  const framingEffect = value.advisory_effects[1]
  if (!isRecord(framingEffect) || !exactKeys(framingEffect, FRAMING_ADVISORY_EFFECT_KEYS)
    || framingEffect.advisory_id !== EXPECTED_FRAMING_ADVISORY_ID
    || framingEffect.effect_id !== EXPECTED_FRAMING_ADVISORY_EFFECT_ID
    || framingEffect.target_concept_id !== 'camera.framing.upper_body'
    || !isRecord(framingEffect.required_prompt_tag)
    || !exactKeys(framingEffect.required_prompt_tag, ADVISORY_TRIGGER_KEYS)
    || Object.entries(EXPECTED_FRAMING_REQUIRED_PROMPT_TAG).some(([key, expected]) => (framingEffect.required_prompt_tag as Record<string, unknown>)[key] !== expected)
    || !Array.isArray(framingEffect.factor_prompt_tags)
    || framingEffect.factor_prompt_tags.length !== EXPECTED_FRAMING_FACTOR_PROMPT_TAGS.length
    || framingEffect.factor_prompt_tags.some((trigger, index) => {
      const expected = EXPECTED_FRAMING_FACTOR_PROMPT_TAGS[index]
      return !isRecord(trigger)
        || !exactKeys(trigger, index === 2 ? DERIVED_ADVISORY_TRIGGER_KEYS : ADVISORY_TRIGGER_KEYS)
        || Object.entries(expected).some(([key, expectedValue]) => trigger[key] !== expectedValue)
    })
    || !Array.isArray(framingEffect.risky_prompt_tag_combinations)
    || framingEffect.risky_prompt_tag_combinations.length !== EXPECTED_FRAMING_RISKY_COMBINATIONS.length
    || framingEffect.risky_prompt_tag_combinations.some((combination, index) => !Array.isArray(combination)
      || combination.length !== EXPECTED_FRAMING_RISKY_COMBINATIONS[index].length
      || combination.some((promptTagId, termIndex) => promptTagId !== EXPECTED_FRAMING_RISKY_COMBINATIONS[index][termIndex]))
    || framingEffect.advisory_status !== 'ADVISORY_ONLY'
    || framingEffect.confidence !== 'high'
    || framingEffect.model_profile !== 'model.novaanimexl_ilv190'
    || !isRecord(framingEffect.explanation) || !exactKeys(framingEffect.explanation, ADVISORY_EXPLANATION_KEYS)
    || !nonEmptyString(framingEffect.explanation.summary)
    || !Array.isArray(framingEffect.explanation.source_run_ids)
    || framingEffect.explanation.source_run_ids.length !== EXPECTED_FRAMING_ADVISORY_SOURCE_RUN_IDS.length
    || framingEffect.explanation.source_run_ids.some((runId, index) => runId !== EXPECTED_FRAMING_ADVISORY_SOURCE_RUN_IDS[index])) return null
  return {
    mappings,
    handAdvisoryEffect: handEffect as CatalogHandAdvisoryEffect,
    framingAdvisoryEffect: framingEffect as CatalogFramingAdvisoryEffect,
  }
}

const validTag = (tag: unknown): tag is SelectedTag => isRecord(tag)
  && nonEmptyString(tag.id)
  && typeof tag.label === 'string'
  && typeof tag.prompt === 'string'
  && nonEmptyString(tag.category)
  && typeof tag.weight === 'number' && Number.isFinite(tag.weight)

const matchesAdvisoryTrigger = (
  tag: SelectedTag,
  trigger: CatalogAdvisoryTrigger | CatalogDerivedAdvisoryTrigger,
) => tag.id === trigger.prompt_tag_id
  && tag.prompt === trigger.prompt
  && tag.category === trigger.category
  && tag.slot === trigger.slot
  && (!('base_prompt_tag_id' in trigger) || (
    tag.baseTagId === trigger.base_prompt_tag_id
    && isRecord(tag.modifiers)
    && exactKeys(tag.modifiers, ['color'])
    && tag.modifiers.color === trigger.color_modifier
  ))

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
  const { mappings, handAdvisoryEffect, framingAdvisoryEffect } = catalogProjection

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

  const advisoryMatches: MatchedAdvisoryEffect[] = []
  if (requested.required_visible_region_concept_ids.includes('visibility.hands')
    && handAdvisoryEffect.trigger_prompt_tags.some(trigger => selectedTags.some(tag => matchesAdvisoryTrigger(tag, trigger)))) {
    advisoryMatches.push(Object.freeze({
      effect: handAdvisoryEffect,
      triggerPromptTags: handAdvisoryEffect.trigger_prompt_tags,
    }))
  }
  const hasRequiredUpperBodyIntent = selectedTags.some(tag => matchesAdvisoryTrigger(tag, framingAdvisoryEffect.required_prompt_tag))
  const selectedFramingFactorIds = new Set(framingAdvisoryEffect.factor_prompt_tags
    .filter(trigger => selectedTags.some(tag => matchesAdvisoryTrigger(tag, trigger)))
    .map(trigger => trigger.prompt_tag_id))
  const matchedFramingCombination = framingAdvisoryEffect.risky_prompt_tag_combinations.find(combination => (
    selectedFramingFactorIds.size === combination.length
    && combination.every(promptTagId => selectedFramingFactorIds.has(promptTagId))
  ))
  if (hasRequiredUpperBodyIntent && matchedFramingCombination) {
    advisoryMatches.push(Object.freeze({
      effect: framingAdvisoryEffect,
      triggerPromptTags: Object.freeze(matchedFramingCombination.map(promptTagId => (
        framingAdvisoryEffect.factor_prompt_tags.find(trigger => trigger.prompt_tag_id === promptTagId)!
      ))),
    }))
  }

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
    constraint_metadata: constraintMetadata(requested, advisoryMatches),
  })
}
