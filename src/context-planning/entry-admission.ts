import { validateRoutingDecision } from '../model-routing'
import type {
  ModelRoutingContractValidationError,
  RoutingDecision,
} from '../model-routing'
import {
  isContextImmutableReference,
  verifyContextCategoryBindingSnapshotRef,
} from './category-binding'
import type {
  ContextCategoryBindingSnapshotV1,
  ContextIdentityValidationError,
} from './category-binding'
import {
  validateContextPolicyV2,
  verifyContextPolicyV2Ref,
} from './policy-v2'
import type { ContextPolicyV2 } from './policy-v2'
import { deepFreezeClone, isRecord } from './supporting-contracts'
import type { DeepReadonly } from './types'

export const CONTEXT_PLANNER_ENTRY_ADMISSION_CONTRACT_VERSION = 'context_planner_entry_admission_v1' as const
export const SUPPORTED_CONTEXT_PLANNER_VERSIONS = Object.freeze(['context-planner-core-v1'] as const)

export const PLANNER_ENTRY_STRUCTURAL_ERROR_CODES = Object.freeze([
  'invalid_type',
  'missing_field',
  'unknown_field',
  'invalid_value',
  'invalid_reference',
  'invalid_timestamp',
  'unsupported_contract',
  'duplicate_binding',
  'invalid_category',
  'reference_mismatch',
  'admission_internal_failure',
] as const)

export type PlannerEntryStructuralErrorCode = (typeof PLANNER_ENTRY_STRUCTURAL_ERROR_CODES)[number]

export interface PlannerEntryStructuralError {
  readonly code: PlannerEntryStructuralErrorCode
  readonly path: string
  readonly message: string
}

export interface ContextPlannerEntryStructuralInput {
  readonly entry_admission_contract_version: typeof CONTEXT_PLANNER_ENTRY_ADMISSION_CONTRACT_VERSION
  readonly routing_decision: RoutingDecision
  readonly routing_decision_ref: string
  readonly context_policy: ContextPolicyV2
  readonly context_category_binding: ContextCategoryBindingSnapshotV1
  readonly context_rendering_profile_ref: string
  readonly materialization_policy_ref: string
  readonly planner_version: (typeof SUPPORTED_CONTEXT_PLANNER_VERSIONS)[number]
}

export interface ContextPlannerCoreInput {
  readonly routing_decision: RoutingDecision
  readonly routing_decision_ref: string
  readonly context_policy: ContextPolicyV2
  readonly context_category_binding: ContextCategoryBindingSnapshotV1
  readonly context_rendering_profile_ref: string
  readonly materialization_policy_ref: string
  readonly planner_version: (typeof SUPPORTED_CONTEXT_PLANNER_VERSIONS)[number]
}

export interface AdmissionAccepted {
  readonly accepted: true
  readonly core_input: DeepReadonly<ContextPlannerCoreInput>
  readonly errors: readonly []
}

export type NonEmptyReadonlyArray<T> = readonly [T, ...T[]]

export interface PlannerEntryStructuralRejection {
  readonly accepted: false
  readonly errors: NonEmptyReadonlyArray<DeepReadonly<PlannerEntryStructuralError>>
}

export type ContextPlannerEntryAdmissionResult = AdmissionAccepted | PlannerEntryStructuralRejection

type RecordValue = Record<string, unknown>

const INPUT_FIELDS = [
  'entry_admission_contract_version',
  'routing_decision',
  'routing_decision_ref',
  'context_policy',
  'context_category_binding',
  'context_rendering_profile_ref',
  'materialization_policy_ref',
  'planner_version',
] as const

const REFERENCE_FIELDS = [
  'routing_decision_ref',
  'context_rendering_profile_ref',
  'materialization_policy_ref',
] as const

const NO_ERRORS = Object.freeze([]) as readonly []

function hasOwn(value: RecordValue, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key)
}

function error(code: PlannerEntryStructuralErrorCode, path: string, message: string): PlannerEntryStructuralError {
  return { code, path, message }
}

function reject(errors: readonly PlannerEntryStructuralError[]): PlannerEntryStructuralRejection {
  const admittedErrors = errors.length > 0
    ? errors
    : [error('admission_internal_failure', '$', 'An unexpected Planner Entry admission defect prevented structural validation.')]
  return Object.freeze({
    accepted: false as const,
    errors: deepFreezeClone(admittedErrors) as NonEmptyReadonlyArray<DeepReadonly<PlannerEntryStructuralError>>,
  })
}

function prefixedPath(prefix: string, path: string): string {
  return path === '$' ? prefix : `${prefix}${path.slice(1)}`
}

function routingReferencePath(path: string): boolean {
  return /\.(?:assignment_revision|capability_floor_ref|response_profile_ref|context_policy_ref|required_context_refs|optional_context_refs|required_structured_output_profile_refs|required_tool_profile_refs|latency_policy_ref|cost_policy_ref|security_policy_refs|validation_policy_ref|applied_rule_refs)(?:\[|$)/.test(path)
}

function mapRoutingError(value: ModelRoutingContractValidationError): PlannerEntryStructuralError {
  const path = prefixedPath('$.routing_decision', value.path)
  if (value.path === '$.evaluation_timestamp') {
    return error('invalid_timestamp', path, 'Routing Decision evaluation_timestamp must be a strict RFC 3339 UTC timestamp.')
  }
  if (value.path === '$.routing_contract_version') {
    return error('unsupported_contract', path, 'Routing Decision contract version is unsupported.')
  }
  if (value.code === 'INVALID_TYPE') return error('invalid_type', path, 'Routing Decision field has an invalid type.')
  if (value.code === 'MISSING_FIELD') return error('missing_field', path, 'Required Routing Decision field is missing.')
  if (value.code === 'UNKNOWN_FIELD' || value.code === 'SECRET_FIELD') return error('unknown_field', path, 'Unknown Routing Decision field is forbidden.')
  if (value.code === 'INVALID_VALUE' && routingReferencePath(value.path)) return error('invalid_reference', path, 'Routing Decision contains an invalid immutable reference.')
  return error('invalid_value', path, 'Routing Decision value is invalid.')
}

function mapNestedError(
  value: ContextIdentityValidationError,
  prefix: '$.context_policy' | '$.context_category_binding',
): PlannerEntryStructuralError {
  const path = prefixedPath(prefix, value.path)
  if (value.path.endsWith('_contract_version')) return error('unsupported_contract', path, 'Nested contract version is unsupported.')
  if (value.code === 'invalid_type') return error('invalid_type', path, 'Nested contract field has an invalid type.')
  if (value.code === 'missing_field') return error('missing_field', path, 'Required nested contract field is missing.')
  if (value.code === 'unknown_field') return error('unknown_field', path, 'Unknown nested contract field is forbidden.')
  if (value.code === 'invalid_reference') return error('invalid_reference', path, 'Nested contract contains an invalid immutable reference.')
  if (value.code === 'duplicate_binding') return error('duplicate_binding', path, 'Duplicate Context reference bindings are forbidden.')
  if (value.code === 'invalid_category' || value.code === 'duplicate_category') return error('invalid_category', path, 'Context category membership is invalid.')
  if (value.code === 'reference_mismatch') return error('reference_mismatch', path, 'Stored content reference does not match the canonical normative projection.')
  return error('invalid_value', path, 'Nested contract value is invalid.')
}

export async function admitContextPlannerEntry(value: unknown): Promise<ContextPlannerEntryAdmissionResult> {
  try {
    if (!isRecord(value)) return reject([error('invalid_type', '$', 'Expected a closed Planner Entry object.')])

    const rootErrors: PlannerEntryStructuralError[] = []
    for (const field of INPUT_FIELDS) {
      if (!hasOwn(value, field)) rootErrors.push(error('missing_field', `$.${field}`, 'Required Planner Entry field is missing.'))
    }
    for (const field of Object.keys(value)) {
      if (!INPUT_FIELDS.includes(field as (typeof INPUT_FIELDS)[number])) rootErrors.push(error('unknown_field', `$.${field}`, 'Unknown Planner Entry field is forbidden.'))
    }
    if (rootErrors.length > 0) return reject(rootErrors)

    if (value.entry_admission_contract_version !== CONTEXT_PLANNER_ENTRY_ADMISSION_CONTRACT_VERSION) {
      rootErrors.push(error('unsupported_contract', '$.entry_admission_contract_version', 'Planner Entry admission contract version is unsupported.'))
    }

    for (const field of REFERENCE_FIELDS) {
      const candidate = value[field]
      if (typeof candidate !== 'string' || !isContextImmutableReference(candidate)) {
        rootErrors.push(error('invalid_reference', `$.${field}`, 'Expected an exact immutable reference without private, local, or secret-bearing data.'))
      }
    }

    if (typeof value.planner_version !== 'string' || !SUPPORTED_CONTEXT_PLANNER_VERSIONS.includes(value.planner_version as (typeof SUPPORTED_CONTEXT_PLANNER_VERSIONS)[number])) {
      rootErrors.push(error('invalid_value', '$.planner_version', 'Planner version is unsupported.'))
    }

    const routing = validateRoutingDecision(value.routing_decision)
    if (!routing.accepted) rootErrors.push(...routing.errors.map(mapRoutingError))

    const policy = validateContextPolicyV2(value.context_policy)
    if (!policy.accepted) rootErrors.push(...policy.errors.map(item => mapNestedError(item, '$.context_policy')))

    const category = await verifyContextCategoryBindingSnapshotRef(value.context_category_binding)
    if (!category.accepted) rootErrors.push(...category.errors.map(item => mapNestedError(item, '$.context_category_binding')))

    if (policy.accepted) {
      const verifiedPolicy = await verifyContextPolicyV2Ref(policy.value)
      if (!verifiedPolicy.accepted) rootErrors.push(...verifiedPolicy.errors.map(item => mapNestedError(item, '$.context_policy')))
    }

    if (policy.accepted && category.accepted
      && policy.value.category_binding_snapshot_ref !== category.value.category_binding_snapshot_ref) {
      rootErrors.push(error(
        'reference_mismatch',
        '$.context_policy.category_binding_snapshot_ref',
        'Context Policy v2 does not bind the supplied Category Binding Snapshot reference.',
      ))
    }

    if (rootErrors.length > 0 || !routing.accepted || !policy.accepted || !category.accepted) return reject(rootErrors)

    const coreInput: ContextPlannerCoreInput = {
      routing_decision: routing.value,
      routing_decision_ref: value.routing_decision_ref as string,
      context_policy: policy.value,
      context_category_binding: category.value,
      context_rendering_profile_ref: value.context_rendering_profile_ref as string,
      materialization_policy_ref: value.materialization_policy_ref as string,
      planner_version: value.planner_version as ContextPlannerCoreInput['planner_version'],
    }
    return Object.freeze({ accepted: true as const, core_input: deepFreezeClone(coreInput), errors: NO_ERRORS })
  } catch {
    return reject([error(
      'admission_internal_failure',
      '$',
      'An unexpected Planner Entry admission defect prevented structural validation.',
    )])
  }
}
