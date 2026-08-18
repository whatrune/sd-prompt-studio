export const DEPRECATION_REMOVAL_ABSENCE_V1_VERSION = 'deprecation_removal_absence_v1' as const

export const RETIRED_CONTINUOUS_ORCHESTRATION_RUNTIME_PATHS_V1 = Object.freeze([
  'src/automatic-gate-progression/index.ts',
  'src/gate-status-publisher/index.ts',
  'src/continuous-orchestration/completion-candidate-projection-cutover-v1.ts',
  'src/continuous-orchestration/evaluator-reducer-consolidation-v1.ts',
] as const)

export const RETIRED_CONTINUOUS_ORCHESTRATION_API_NAMES_V1 = Object.freeze([
  'deriveProgressionDecisionPortShadowV1',
  'evaluateCompletionCandidateProjectionCutoverV1',
  'evaluateEvaluatorReducerConsolidationV1',
] as const)

export interface DeprecationRemovalAbsenceRecordV1 {
  readonly contract_version: typeof DEPRECATION_REMOVAL_ABSENCE_V1_VERSION
  readonly retired_runtime_paths: readonly string[]
  readonly retired_api_names: readonly string[]
  readonly runtime_reference_count: 0
  readonly restored_module_count: 0
  readonly protected_action_count: 0
  readonly production_behavior_delta: 0
}

export type DeprecationRemovalAbsenceAdmissionV1 =
  | Readonly<{ kind: 'accepted'; value: DeprecationRemovalAbsenceRecordV1 }>
  | Readonly<{ kind: 'rejected'; reason: 'invalid_shape' | 'retired_path_set_mismatch' | 'retired_api_set_mismatch' | 'nonzero_effect' }>

const sameOrdered = (left: readonly unknown[], right: readonly unknown[]) =>
  left.length === right.length && left.every((value, index) => value === right[index])

export const validateDeprecationRemovalAbsenceV1 = (value: unknown): DeprecationRemovalAbsenceAdmissionV1 => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return Object.freeze({ kind: 'rejected', reason: 'invalid_shape' })
  const candidate = value as Record<string, unknown>
  const keys = [
    'contract_version',
    'retired_runtime_paths',
    'retired_api_names',
    'runtime_reference_count',
    'restored_module_count',
    'protected_action_count',
    'production_behavior_delta',
  ]
  if (Object.keys(candidate).length !== keys.length || keys.some(key => !Object.prototype.hasOwnProperty.call(candidate, key)) || candidate.contract_version !== DEPRECATION_REMOVAL_ABSENCE_V1_VERSION || !Array.isArray(candidate.retired_runtime_paths) || !Array.isArray(candidate.retired_api_names)) {
    return Object.freeze({ kind: 'rejected', reason: 'invalid_shape' })
  }
  if (!sameOrdered(candidate.retired_runtime_paths, RETIRED_CONTINUOUS_ORCHESTRATION_RUNTIME_PATHS_V1)) return Object.freeze({ kind: 'rejected', reason: 'retired_path_set_mismatch' })
  if (!sameOrdered(candidate.retired_api_names, RETIRED_CONTINUOUS_ORCHESTRATION_API_NAMES_V1)) return Object.freeze({ kind: 'rejected', reason: 'retired_api_set_mismatch' })
  if (candidate.runtime_reference_count !== 0 || candidate.restored_module_count !== 0 || candidate.protected_action_count !== 0 || candidate.production_behavior_delta !== 0) return Object.freeze({ kind: 'rejected', reason: 'nonzero_effect' })
  return Object.freeze({ kind: 'accepted', value: Object.freeze(structuredClone(candidate)) as unknown as DeprecationRemovalAbsenceRecordV1 })
}
