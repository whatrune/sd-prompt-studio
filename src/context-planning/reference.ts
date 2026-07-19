import type { ContextPlan, DeepReadonly } from './types'
import { validateContextPlan } from './validation'
import { NO_SUPPORTING_ERRORS, deepFreezeClone, isRecord } from './supporting-contracts'
import type { SupportingContractValidationError } from './supporting-contracts'

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
}

export type ContextPlanReferenceInput = Omit<ContextPlan, 'context_plan_ref'> & { readonly context_plan_ref?: string }

export type ContextPlanReferenceVerificationResult =
  | { readonly accepted: true; readonly reference: string; readonly projection: DeepReadonly<ContextPlanReferenceProjectionV1>; readonly errors: readonly [] }
  | { readonly accepted: false; readonly errors: readonly DeepReadonly<SupportingContractValidationError>[] }

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
    const entries = Object.keys(value).sort().map(key => {
      const item = value[key]
      if (item === undefined) throw new TypeError('JCS objects cannot contain undefined values.')
      return `${canonicalizeJcs(key)}:${canonicalizeJcs(item)}`
    })
    return `{${entries.join(',')}}`
  }
  throw new TypeError('Value is outside the RFC 8785 JSON data model.')
}

function bytewiseSorted(values: readonly string[]): readonly string[] {
  return [...values].sort((left, right) => left < right ? -1 : left > right ? 1 : 0)
}

export function createContextPlanReferenceProjection(value: ContextPlanReferenceInput): DeepReadonly<ContextPlanReferenceProjectionV1> {
  const admitted = validateContextPlan({ ...value, context_plan_ref: PLACEHOLDER_REF })
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

export async function isContextPlanRefValid(value: ContextPlan): Promise<boolean> {
  return (await verifyContextPlanRef(value)).accepted
}
