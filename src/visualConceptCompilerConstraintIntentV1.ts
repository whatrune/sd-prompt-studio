const REQUIRED_VISIBLE_REGION_CONCEPT_IDS = ['visibility.feet', 'visibility.hands', 'visibility.head'] as const
const MINIMUM_FRAMING_CONCEPT_IDS = ['camera.framing.close_up', 'camera.framing.cowboy_shot', 'camera.framing.full_body', 'camera.framing.upper_body'] as const

export type VisualConceptCompilerConstraintIntentV1 = {
  record_type: 'visual_concept_compiler_constraint_intent_v1'
  version: 1
  required_visible_region_concept_ids: readonly typeof REQUIRED_VISIBLE_REGION_CONCEPT_IDS[number][]
  minimum_framing_concept_id: typeof MINIMUM_FRAMING_CONCEPT_IDS[number] | null
}

export const EMPTY_VISUAL_CONCEPT_COMPILER_CONSTRAINT_INTENT_V1: VisualConceptCompilerConstraintIntentV1 = Object.freeze({
  record_type: 'visual_concept_compiler_constraint_intent_v1',
  version: 1,
  required_visible_region_concept_ids: Object.freeze([]),
  minimum_framing_concept_id: null,
})

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const exactKeys = (value: Record<string, unknown>, expected: string[]) => {
  const actual = Object.keys(value).sort()
  const sortedExpected = [...expected].sort()
  return actual.length === sortedExpected.length && actual.every((key, index) => key === sortedExpected[index])
}

export function admitVisualConceptCompilerConstraintIntentV1(value: unknown): VisualConceptCompilerConstraintIntentV1 | null {
  if (value === undefined) return EMPTY_VISUAL_CONCEPT_COMPILER_CONSTRAINT_INTENT_V1
  if (!isRecord(value) || !exactKeys(value, ['record_type', 'version', 'required_visible_region_concept_ids', 'minimum_framing_concept_id'])
    || value.record_type !== 'visual_concept_compiler_constraint_intent_v1'
    || value.version !== 1
    || !Array.isArray(value.required_visible_region_concept_ids)
    || !value.required_visible_region_concept_ids.every(id => typeof id === 'string' && REQUIRED_VISIBLE_REGION_CONCEPT_IDS.includes(id as typeof REQUIRED_VISIBLE_REGION_CONCEPT_IDS[number]))
    || new Set(value.required_visible_region_concept_ids).size !== value.required_visible_region_concept_ids.length
    || value.required_visible_region_concept_ids.some((id, index, values) => index > 0 && values[index - 1].localeCompare(id) >= 0)
    || (value.minimum_framing_concept_id !== null
      && (typeof value.minimum_framing_concept_id !== 'string'
        || !MINIMUM_FRAMING_CONCEPT_IDS.includes(value.minimum_framing_concept_id as typeof MINIMUM_FRAMING_CONCEPT_IDS[number])))) return null
  return Object.freeze({
    record_type: value.record_type,
    version: value.version,
    required_visible_region_concept_ids: Object.freeze([...value.required_visible_region_concept_ids]) as readonly typeof REQUIRED_VISIBLE_REGION_CONCEPT_IDS[number][],
    minimum_framing_concept_id: value.minimum_framing_concept_id as typeof MINIMUM_FRAMING_CONCEPT_IDS[number] | null,
  })
}
