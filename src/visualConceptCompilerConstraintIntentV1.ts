export const VISUAL_CONCEPT_COMPILER_VISIBLE_REGION_CONCEPT_IDS_V1 = Object.freeze(['visibility.feet', 'visibility.hands', 'visibility.head'] as const)
const MINIMUM_FRAMING_CONCEPT_IDS = ['camera.framing.close_up', 'camera.framing.cowboy_shot', 'camera.framing.full_body', 'camera.framing.upper_body'] as const

export type VisualConceptCompilerVisibleRegionConceptIdV1 = typeof VISUAL_CONCEPT_COMPILER_VISIBLE_REGION_CONCEPT_IDS_V1[number]

export type VisualConceptCompilerConstraintIntentV1 = {
  record_type: 'visual_concept_compiler_constraint_intent_v1'
  version: 1
  required_visible_region_concept_ids: readonly VisualConceptCompilerVisibleRegionConceptIdV1[]
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
    || (value.minimum_framing_concept_id !== null
      && (typeof value.minimum_framing_concept_id !== 'string'
        || !MINIMUM_FRAMING_CONCEPT_IDS.includes(value.minimum_framing_concept_id as typeof MINIMUM_FRAMING_CONCEPT_IDS[number])))) return null
  const requiredVisibleRegionConceptIds = [...value.required_visible_region_concept_ids]
  if (!requiredVisibleRegionConceptIds.every(id => typeof id === 'string' && VISUAL_CONCEPT_COMPILER_VISIBLE_REGION_CONCEPT_IDS_V1.includes(id as VisualConceptCompilerVisibleRegionConceptIdV1))
    || new Set(requiredVisibleRegionConceptIds).size !== requiredVisibleRegionConceptIds.length
    || requiredVisibleRegionConceptIds.some((id, index, values) => index > 0 && values[index - 1].localeCompare(id) >= 0)) return null
  return Object.freeze({
    record_type: value.record_type,
    version: value.version,
    required_visible_region_concept_ids: Object.freeze(requiredVisibleRegionConceptIds) as readonly VisualConceptCompilerVisibleRegionConceptIdV1[],
    minimum_framing_concept_id: value.minimum_framing_concept_id as typeof MINIMUM_FRAMING_CONCEPT_IDS[number] | null,
  })
}

export function setVisualConceptCompilerVisibleRegionRequirementV1(
  intent: unknown,
  conceptId: VisualConceptCompilerVisibleRegionConceptIdV1,
  required: boolean,
): VisualConceptCompilerConstraintIntentV1 | null {
  const admitted = admitVisualConceptCompilerConstraintIntentV1(intent)
  if (!admitted || !VISUAL_CONCEPT_COMPILER_VISIBLE_REGION_CONCEPT_IDS_V1.includes(conceptId) || typeof required !== 'boolean') return null
  const requiredVisibleRegionConceptIds = new Set(admitted.required_visible_region_concept_ids)
  if (required) requiredVisibleRegionConceptIds.add(conceptId)
  else requiredVisibleRegionConceptIds.delete(conceptId)
  return admitVisualConceptCompilerConstraintIntentV1({
    ...admitted,
    required_visible_region_concept_ids: [...requiredVisibleRegionConceptIds].sort(),
  })
}
