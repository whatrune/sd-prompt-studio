import type { ContextPlan, ContextPlanningFailureCode, DeepReadonly } from './types'
import {
  validateContextPlanCategorySemantics,
  validateContextPlanStructure,
} from './validation'
import type {
  ContextPlanCategorySemanticCode,
  ContextPlanCategorySemanticError,
  ContextPlanStructureValidationResult,
} from './validation'
import { NO_SUPPORTING_ERRORS, deepFreezeClone, isRecord } from './supporting-contracts'
import type { SupportingContractValidationError } from './supporting-contracts'
import { compareContextReferencesUtf8 } from './policy'
import type { ContextCategoryBindingSnapshotV1 } from './category-binding'
import type { ContextPolicyV2 } from './policy-v2'

const CONTEXT_PLAN_REF = /^evidence\/context-plans\/sha256-[0-9a-f]{64}$/
const PLACEHOLDER_REF = `evidence/context-plans/sha256-${'0'.repeat(64)}`

export interface ContextPlanReferenceProjectionV1 {
  readonly context_plan_contract_version: ContextPlan['context_plan_contract_version']
  readonly task_id: string
  readonly assignment_revision: string
  readonly routing_contract_version: ContextPlan['routing_contract_version']
  readonly routing_decision_ref: string
  readonly context_policy_ref: string
  readonly required_context_refs: readonly string[]
  readonly included_optional_context_refs: readonly string[]
  readonly excluded_optional_context_refs: readonly string[]
  readonly forbidden_context_categories: readonly string[]
  readonly context_order: readonly string[]
  readonly context_rendering_profile_ref: string
  readonly materialization_policy_ref: string
  readonly applied_rule_refs: readonly string[]
  readonly planner_version: string
  readonly evaluation_timestamp: string
}

export type ContextPlanReferenceInput = Omit<ContextPlan, 'context_plan_ref'> & { readonly context_plan_ref?: string }

export type ContextPlanReferenceVerificationResult =
  | { readonly accepted: true; readonly reference: string; readonly projection: DeepReadonly<ContextPlanReferenceProjectionV1>; readonly errors: readonly [] }
  | { readonly accepted: false; readonly errors: readonly DeepReadonly<SupportingContractValidationError>[] }

export const CONTEXT_PLAN_FINAL_REJECTION_RESPONSIBILITIES = Object.freeze([
  'input_or_policy',
  'planner_implementation',
] as const)

export type ContextPlanFinalRejectionResponsibility = (typeof CONTEXT_PLAN_FINAL_REJECTION_RESPONSIBILITIES)[number]

export type AdmittedContextPlanValidationCode =
  | ContextPlanningFailureCode
  | ContextPlanCategorySemanticCode
  | 'context_plan_reference_mismatch'
  | 'internal_validation_failure'

export interface AdmittedContextPlanValidationError {
  readonly code: AdmittedContextPlanValidationCode
  readonly path: string
  readonly message: string
}

export type AdmittedContextPlanValidationResult =
  | {
      readonly accepted: true
      readonly plan: DeepReadonly<ContextPlan>
      readonly value: DeepReadonly<ContextPlan>
      readonly errors: readonly []
    }
  | {
      readonly accepted: false
      readonly responsibility: ContextPlanFinalRejectionResponsibility
      readonly errors: readonly DeepReadonly<AdmittedContextPlanValidationError>[]
    }

function hasLoneSurrogate(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index)
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(index + 1)
      if (next < 0xdc00 || next > 0xdfff) return true
      index += 1
    } else if (unit >= 0xdc00 && unit <= 0xdfff) return true
  }
  return false
}

export function canonicalizeJcs(value: unknown): string {
  if (value === null) return 'null'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'string') {
    if (hasLoneSurrogate(value)) throw new TypeError('JCS input must be valid Unicode.')
    return JSON.stringify(value)
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('JCS numbers must be finite.')
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) return `[${value.map(item => canonicalizeJcs(item)).join(',')}]`
  if (isRecord(value)) {
    const entries = Object.keys(value).sort(compareJcsPropertyNames).map(key => {
      const item = value[key]
      if (item === undefined) throw new TypeError('JCS objects cannot contain undefined values.')
      return `${canonicalizeJcs(key)}:${canonicalizeJcs(item)}`
    })
    return `{${entries.join(',')}}`
  }
  throw new TypeError('Value is outside the RFC 8785 JSON data model.')
}

function compareJcsPropertyNames(left: string, right: string): number {
  const length = Math.min(left.length, right.length)
  for (let index = 0; index < length; index += 1) {
    const difference = left.charCodeAt(index) - right.charCodeAt(index)
    if (difference !== 0) return difference
  }
  return left.length - right.length
}

function bytewiseSorted(values: readonly string[]): readonly string[] {
  return [...values].sort(compareContextReferencesUtf8)
}

export function createContextPlanReferenceProjection(value: ContextPlanReferenceInput): DeepReadonly<ContextPlanReferenceProjectionV1> {
  const admitted = validateContextPlanStructure({ ...value, context_plan_ref: PLACEHOLDER_REF })
  if (!admitted.accepted) throw new TypeError(`Invalid ContextPlan reference input at ${admitted.errors[0]?.path ?? '$'}.`)
  const plan = admitted.plan
  return deepFreezeClone({
    context_plan_contract_version: plan.context_plan_contract_version,
    task_id: plan.task_id,
    assignment_revision: plan.assignment_revision,
    routing_contract_version: plan.routing_contract_version,
    routing_decision_ref: plan.routing_decision_ref,
    context_policy_ref: plan.context_policy_ref,
    required_context_refs: bytewiseSorted(plan.required_context_refs),
    included_optional_context_refs: bytewiseSorted(plan.included_optional_context_refs),
    excluded_optional_context_refs: bytewiseSorted(plan.excluded_optional_context_refs),
    forbidden_context_categories: bytewiseSorted(plan.forbidden_context_categories),
    context_order: [...plan.context_order],
    context_rendering_profile_ref: plan.context_rendering_profile_ref,
    materialization_policy_ref: plan.materialization_policy_ref,
    applied_rule_refs: bytewiseSorted(plan.applied_rule_refs),
    planner_version: plan.planner_version,
    evaluation_timestamp: plan.evaluation_timestamp,
  })
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

export async function generateContextPlanRef(value: ContextPlanReferenceInput): Promise<string> {
  const projection = createContextPlanReferenceProjection(value)
  return `evidence/context-plans/sha256-${await sha256Hex(canonicalizeJcs(projection))}`
}

export async function verifyContextPlanRef(value: ContextPlan): Promise<ContextPlanReferenceVerificationResult> {
  const errors: SupportingContractValidationError[] = []
  if (!CONTEXT_PLAN_REF.test(value.context_plan_ref)) {
    errors.push({ code: 'invalid_reference', path: '$.context_plan_ref', message: 'Expected evidence/context-plans/sha256- followed by 64 lowercase hexadecimal characters.' })
    return Object.freeze({ accepted: false as const, errors: deepFreezeClone(errors) })
  }
  try {
    const projection = createContextPlanReferenceProjection(value)
    const expected = await generateContextPlanRef(value)
    if (value.context_plan_ref !== expected) {
      errors.push({ code: 'reference_mismatch', path: '$.context_plan_ref', message: 'context_plan_ref does not match the canonical normative projection.' })
      return Object.freeze({ accepted: false as const, errors: deepFreezeClone(errors) })
    }
    return Object.freeze({ accepted: true as const, reference: expected, projection, errors: NO_SUPPORTING_ERRORS })
  } catch {
    errors.push({ code: 'invalid_value', path: '$', message: 'ContextPlan reference projection is structurally invalid.' })
    return Object.freeze({ accepted: false as const, errors: deepFreezeClone(errors) })
  }
}

function structuralErrors(
  result: Extract<ContextPlanStructureValidationResult, { readonly accepted: false }>,
): readonly DeepReadonly<AdmittedContextPlanValidationError>[] {
  return deepFreezeClone(result.errors.map(item => ({ code: item.code, path: item.path, message: item.message })))
}

function semanticResponsibility(error: ContextPlanCategorySemanticError | undefined): ContextPlanFinalRejectionResponsibility {
  if (!error || error.code === 'plan_policy_reference_mismatch') return 'planner_implementation'
  return 'input_or_policy'
}

export async function validateAdmittedContextPlan(
  value: unknown,
  categorySnapshot: DeepReadonly<ContextCategoryBindingSnapshotV1>,
  policyV2: DeepReadonly<ContextPolicyV2>,
): Promise<AdmittedContextPlanValidationResult> {
  try {
    const structure = validateContextPlanStructure(value)
    if (!structure.accepted) {
      return Object.freeze({
        accepted: false as const,
        responsibility: 'planner_implementation' as const,
        errors: structuralErrors(structure),
      })
    }

    const semantics = validateContextPlanCategorySemantics(structure.value, categorySnapshot, policyV2)
    if (!semantics.accepted) {
      return Object.freeze({
        accepted: false as const,
        responsibility: semanticResponsibility(semantics.errors[0]),
        errors: deepFreezeClone(semantics.errors),
      })
    }

    const reference = await verifyContextPlanRef(semantics.value)
    if (!reference.accepted) {
      return Object.freeze({
        accepted: false as const,
        responsibility: 'planner_implementation' as const,
        errors: deepFreezeClone(reference.errors.map(item => ({
          code: 'context_plan_reference_mismatch' as const,
          path: item.path,
          message: 'ContextPlan reference generation or verification failed.',
        }))),
      })
    }

    const plan = deepFreezeClone(semantics.value as ContextPlan)
    return Object.freeze({ accepted: true as const, plan, value: plan, errors: NO_SUPPORTING_ERRORS })
  } catch {
    return Object.freeze({
      accepted: false as const,
      responsibility: 'planner_implementation' as const,
      errors: deepFreezeClone([{
        code: 'internal_validation_failure' as const,
        path: '$',
        message: 'An unknown admitted ContextPlan validation origin failed closed.',
      }]),
    })
  }
}

export async function isContextPlanRefValid(value: ContextPlan): Promise<boolean> {
  return (await verifyContextPlanRef(value)).accepted
}
