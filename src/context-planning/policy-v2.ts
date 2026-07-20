import {
  NO_SUPPORTING_ERRORS,
  deepFreezeClone,
  isRecord,
} from './supporting-contracts'
import type {
  ContextOrderingRuleV1,
  ContextPolicyRuleV1,
  SupportingContractValidationError,
} from './supporting-contracts'
import {
  compareContextReferencesUtf8,
  validateContextOrderingRuleV1,
  validateContextPolicyRuleV1,
} from './policy'
import { canonicalizeJcs } from './reference'
import {
  isContextImmutableReference,
} from './category-binding'
import type {
  ContextIdentityValidationError,
  ContextIdentityValidationResult,
} from './category-binding'
import type { DeepReadonly } from './types'

export const CONTEXT_POLICY_V2_CONTRACT_VERSION = 'context_policy_v2' as const
export const CONTEXT_POLICY_V2_REFERENCE_VERSION = 'context_policy_reference_v2' as const

const POLICY_REF = /^policies\/context\/sha256-[0-9a-f]{64}$/
const CATEGORY_BINDING_REF = /^evidence\/context-category-bindings\/sha256-[0-9a-f]{64}$/
const PLACEHOLDER_POLICY_REF = `policies/context/sha256-${'0'.repeat(64)}`
const OPAQUE_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/
const SECRET_FIELD = /(?:^|_)(?:api_?key|secret|token|credential|password|cookie|private_?key)(?:_|$)/i

export interface ContextPolicyV2 {
  readonly context_policy_contract_version: typeof CONTEXT_POLICY_V2_CONTRACT_VERSION
  readonly context_policy_ref: string
  readonly policy_revision: string
  readonly category_binding_snapshot_ref: string
  readonly optional_context_rules: readonly ContextPolicyRuleV1[]
  readonly ordering_rule: ContextOrderingRuleV1
  readonly source_ref: string
  readonly approval_ref: string
}

export type ContextPolicyRuleV2ReferenceProjection = Omit<ContextPolicyRuleV1, 'policy_ref'>
export type ContextOrderingRuleV2ReferenceProjection = Omit<ContextOrderingRuleV1, 'policy_ref'>

export interface ContextPolicyV2ReferenceProjection {
  readonly context_policy_contract_version: typeof CONTEXT_POLICY_V2_CONTRACT_VERSION
  readonly policy_revision: string
  readonly category_binding_snapshot_ref: string
  readonly optional_context_rules: readonly ContextPolicyRuleV2ReferenceProjection[]
  readonly ordering_rule: ContextOrderingRuleV2ReferenceProjection
  readonly source_ref: string
  readonly approval_ref: string
}

export type ContextPolicyV2ReferenceInput = Omit<ContextPolicyV2, 'context_policy_ref'> & {
  readonly context_policy_ref?: string
}

export type ContextPolicyV2ValidationResult = ContextIdentityValidationResult<ContextPolicyV2>

export type ContextPolicyV2ReferenceVerificationResult =
  | {
      readonly accepted: true
      readonly reference: string
      readonly value: DeepReadonly<ContextPolicyV2>
      readonly projection: DeepReadonly<ContextPolicyV2ReferenceProjection>
      readonly errors: readonly []
    }
  | { readonly accepted: false; readonly errors: readonly DeepReadonly<ContextIdentityValidationError>[] }

type RecordValue = Record<string, unknown>

function hasOwn(value: RecordValue, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key)
}

function addError(
  errors: ContextIdentityValidationError[],
  code: ContextIdentityValidationError['code'],
  path: string,
  message: string,
): void {
  errors.push({ code, path, message })
}

function objectAt(
  value: unknown,
  path: string,
  required: readonly string[],
  allowed: readonly string[],
  errors: ContextIdentityValidationError[],
): RecordValue | undefined {
  if (!isRecord(value)) {
    addError(errors, 'invalid_type', path, 'Expected a closed object.')
    return undefined
  }
  for (const key of required) if (!hasOwn(value, key)) addError(errors, 'missing_field', `${path}.${key}`, 'Required field is missing.')
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) addError(errors, 'unknown_field', `${path}.${key}`, SECRET_FIELD.test(key) ? 'Secret-bearing fields are forbidden.' : 'Unknown field is forbidden.')
  }
  return value
}

function stringAt(
  record: RecordValue | undefined,
  key: string,
  path: string,
  errors: ContextIdentityValidationError[],
  predicate: (value: string) => boolean,
  code: ContextIdentityValidationError['code'] = 'invalid_value',
): string | undefined {
  if (!record || !hasOwn(record, key)) return undefined
  const value = record[key]
  if (typeof value !== 'string' || !predicate(value)) {
    addError(errors, code, `${path}.${key}`, 'Expected an allowed non-empty value.')
    return undefined
  }
  return value
}

function mappedCode(error: SupportingContractValidationError): ContextIdentityValidationError['code'] {
  if (error.code === 'missing_field') return 'missing_field'
  if (error.code === 'unknown_field') return 'unknown_field'
  if (error.code === 'invalid_reference') return 'invalid_reference'
  if (error.code === 'inconsistent_identity') return 'inconsistent_identity'
  if (error.code === 'context_policy_conflict' || error.code === 'duplicate_reference') return 'context_policy_conflict'
  return 'invalid_value'
}

function absorbSupportingErrors(
  target: ContextIdentityValidationError[],
  source: readonly SupportingContractValidationError[],
  prefix: string,
): void {
  source.forEach(error => addError(target, mappedCode(error), `${prefix}${error.path.slice(1)}`, error.message))
}

export function validateContextPolicyV2(
  value: unknown,
  expectedCategoryBindingSnapshotRef?: string,
): ContextPolicyV2ValidationResult {
  const errors: ContextIdentityValidationError[] = []
  const fields = [
    'context_policy_contract_version',
    'context_policy_ref',
    'policy_revision',
    'category_binding_snapshot_ref',
    'optional_context_rules',
    'ordering_rule',
    'source_ref',
    'approval_ref',
  ] as const
  const record = objectAt(value, '$', fields, fields, errors)
  stringAt(record, 'context_policy_contract_version', '$', errors, item => item === CONTEXT_POLICY_V2_CONTRACT_VERSION, 'inconsistent_identity')
  const policyRef = stringAt(record, 'context_policy_ref', '$', errors, item => POLICY_REF.test(item), 'invalid_reference')
  stringAt(record, 'policy_revision', '$', errors, item => OPAQUE_IDENTIFIER.test(item))
  const categoryBindingRef = stringAt(record, 'category_binding_snapshot_ref', '$', errors, item => CATEGORY_BINDING_REF.test(item), 'invalid_reference')
  stringAt(record, 'source_ref', '$', errors, isContextImmutableReference, 'invalid_reference')
  stringAt(record, 'approval_ref', '$', errors, isContextImmutableReference, 'invalid_reference')

  if (expectedCategoryBindingSnapshotRef !== undefined) {
    if (!CATEGORY_BINDING_REF.test(expectedCategoryBindingSnapshotRef)) {
      addError(errors, 'invalid_reference', '$.expected_category_binding_snapshot_ref', 'Expected a canonical Category Binding Snapshot reference.')
    } else if (categoryBindingRef !== expectedCategoryBindingSnapshotRef) {
      addError(errors, 'inconsistent_identity', '$.category_binding_snapshot_ref', 'Context Policy v2 does not bind the expected Category Binding Snapshot reference.')
    }
  }

  const optionalRules = record?.optional_context_rules
  if (!Array.isArray(optionalRules)) {
    if (record && hasOwn(record, 'optional_context_rules')) addError(errors, 'invalid_type', '$.optional_context_rules', 'Expected an array.')
  } else {
    optionalRules.forEach((rule, index) => {
      const validation = validateContextPolicyRuleV1(rule)
      if (!validation.accepted) absorbSupportingErrors(errors, validation.errors, `$.optional_context_rules[${index}]`)
      if (isRecord(rule) && policyRef && rule.policy_ref !== policyRef) {
        addError(errors, 'inconsistent_identity', `$.optional_context_rules[${index}].policy_ref`, 'Child Policy reference must equal the parent Context Policy v2 reference.')
      }
    })
  }

  const orderingRule = record && hasOwn(record, 'ordering_rule') ? record.ordering_rule : undefined
  if (orderingRule !== undefined) {
    const validation = validateContextOrderingRuleV1(orderingRule)
    if (!validation.accepted) absorbSupportingErrors(errors, validation.errors, '$.ordering_rule')
    if (isRecord(orderingRule) && policyRef && orderingRule.policy_ref !== policyRef) {
      addError(errors, 'inconsistent_identity', '$.ordering_rule.policy_ref', 'Ordering Policy reference must equal the parent Context Policy v2 reference.')
    }
  }

  if (Array.isArray(optionalRules) && isRecord(orderingRule)) {
    const rules = [...optionalRules, orderingRule]
    const ids = new Set<string>()
    const revisions = new Set<string>()
    const refs = new Set<string>()
    rules.forEach((rule, index) => {
      if (!isRecord(rule)) return
      const path = index < optionalRules.length ? `$.optional_context_rules[${index}]` : '$.ordering_rule'
      if (typeof rule.rule_id === 'string') {
        if (ids.has(rule.rule_id)) addError(errors, 'context_policy_conflict', `${path}.rule_id`, 'Rule identifiers must be unique across the whole Policy v2 Snapshot.')
        ids.add(rule.rule_id)
      }
      if (typeof rule.rule_id === 'string' && typeof rule.rule_revision === 'string') {
        const identity = `${rule.rule_id}\u0000${rule.rule_revision}`
        if (revisions.has(identity)) addError(errors, 'context_policy_conflict', `${path}.rule_revision`, 'Rule identity and revision pairs must be unique.')
        revisions.add(identity)
      }
      if (typeof rule.rule_ref === 'string') {
        if (refs.has(rule.rule_ref)) addError(errors, 'context_policy_conflict', `${path}.rule_ref`, 'Rule references must be unique across the whole Policy v2 Snapshot.')
        refs.add(rule.rule_ref)
      }
    })
  }

  if (errors.length > 0) return Object.freeze({ accepted: false as const, errors: deepFreezeClone(errors) })
  return Object.freeze({ accepted: true as const, value: deepFreezeClone(value as ContextPolicyV2), errors: NO_SUPPORTING_ERRORS })
}

export function validateContextPolicyV2CategoryBinding(
  value: unknown,
  expectedCategoryBindingSnapshotRef: string,
): ContextPolicyV2ValidationResult {
  return validateContextPolicyV2(value, expectedCategoryBindingSnapshotRef)
}

export function createContextPolicyV2ReferenceProjection(
  value: ContextPolicyV2ReferenceInput,
): DeepReadonly<ContextPolicyV2ReferenceProjection> {
  const normalized = {
    ...value,
    context_policy_ref: PLACEHOLDER_POLICY_REF,
    optional_context_rules: value.optional_context_rules.map(rule => ({ ...rule, policy_ref: PLACEHOLDER_POLICY_REF })),
    ordering_rule: { ...value.ordering_rule, policy_ref: PLACEHOLDER_POLICY_REF },
  }
  const admitted = validateContextPolicyV2(normalized)
  if (!admitted.accepted) throw new TypeError(`Invalid Context Policy v2 reference input at ${admitted.errors[0]?.path ?? '$'}.`)
  const policy = admitted.value
  return deepFreezeClone({
    context_policy_contract_version: policy.context_policy_contract_version,
    policy_revision: policy.policy_revision,
    category_binding_snapshot_ref: policy.category_binding_snapshot_ref,
    optional_context_rules: [...policy.optional_context_rules]
      .sort((left, right) => compareContextReferencesUtf8(left.rule_ref, right.rule_ref))
      .map(({ policy_ref: _policyRef, ...rule }) => rule),
    ordering_rule: (({ policy_ref: _policyRef, ...rule }) => rule)(policy.ordering_rule),
    source_ref: policy.source_ref,
    approval_ref: policy.approval_ref,
  })
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

export async function generateContextPolicyV2Ref(value: ContextPolicyV2ReferenceInput): Promise<string> {
  const projection = createContextPolicyV2ReferenceProjection(value)
  return `policies/context/sha256-${await sha256Hex(canonicalizeJcs(projection))}`
}

export async function verifyContextPolicyV2Ref(value: unknown): Promise<ContextPolicyV2ReferenceVerificationResult> {
  const admitted = validateContextPolicyV2(value)
  if (!admitted.accepted) return admitted
  try {
    const projection = createContextPolicyV2ReferenceProjection(admitted.value)
    const expected = await generateContextPolicyV2Ref(admitted.value)
    if (admitted.value.context_policy_ref !== expected) {
      return Object.freeze({
        accepted: false as const,
        errors: deepFreezeClone([{ code: 'reference_mismatch' as const, path: '$.context_policy_ref', message: 'Context Policy v2 reference does not match the canonical normative projection.' }]),
      })
    }
    return Object.freeze({ accepted: true as const, reference: expected, value: admitted.value, projection, errors: NO_SUPPORTING_ERRORS })
  } catch {
    return Object.freeze({
      accepted: false as const,
      errors: deepFreezeClone([{ code: 'invalid_value' as const, path: '$', message: 'Context Policy v2 reference projection is structurally invalid.' }]),
    })
  }
}
