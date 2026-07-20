import { compareContextReferencesUtf8 } from './policy'
import { canonicalizeJcs } from './reference'
import { NO_SUPPORTING_ERRORS, deepFreezeClone, isRecord } from './supporting-contracts'
import type { DeepReadonly } from './types'

export const CONTEXT_CATEGORY_BINDING_CONTRACT_VERSION = 'context_category_binding_v1' as const
export const CONTEXT_CATEGORY_BINDING_REFERENCE_VERSION = 'context_category_binding_reference_v1' as const

const SNAPSHOT_REF = /^evidence\/context-category-bindings\/sha256-[0-9a-f]{64}$/
const PLACEHOLDER_SNAPSHOT_REF = `evidence/context-category-bindings/sha256-${'0'.repeat(64)}`
const VERSIONED_REFERENCE = /^[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9][A-Za-z0-9._#-]*)+$/
const CANONICAL_REFERENCE = /^(?:https:\/\/github\.com\/[^\s]+|(?:docs|config|policies|evidence|profiles|assignments)\/[^\s]+)$/
const CATEGORY = /^[A-Za-z][A-Za-z0-9_-]*$/
const SECRET_FIELD = /(?:^|_)(?:api_?key|secret|token|credential|password|cookie|private_?key)(?:_|$)/i
const SECRET_QUERY = /[?&](?:token|secret|api[_-]?key|credential|password)=/i
const PERSONAL_PATH = /^(?:file:\/\/|[A-Za-z]:[\\/]|\\\\|\/(?:Users|home)\/)/i
const PRIVATE_ENDPOINT = /^(?:https?:\/\/)?(?:localhost|127(?:\.\d{1,3}){3}|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}|\[?::1\]?)(?::|\/|$)/i

export interface ContextCategoryBindingEntryV1 {
  readonly context_ref: string
  readonly categories: readonly string[]
}

export interface ContextCategoryBindingSnapshotV1 {
  readonly category_binding_contract_version: typeof CONTEXT_CATEGORY_BINDING_CONTRACT_VERSION
  readonly category_binding_snapshot_ref: string
  readonly category_catalog_ref: string
  readonly approved_category_values: readonly string[]
  readonly bindings: readonly ContextCategoryBindingEntryV1[]
  readonly source_ref: string
  readonly approval_ref: string
}

export interface ContextCategoryBindingReferenceProjectionV1 {
  readonly category_binding_contract_version: typeof CONTEXT_CATEGORY_BINDING_CONTRACT_VERSION
  readonly category_catalog_ref: string
  readonly approved_category_values: readonly string[]
  readonly bindings: readonly ContextCategoryBindingEntryV1[]
  readonly source_ref: string
  readonly approval_ref: string
}

export type ContextCategoryBindingReferenceInput = Omit<ContextCategoryBindingSnapshotV1, 'category_binding_snapshot_ref'> & {
  readonly category_binding_snapshot_ref?: string
}

export type ContextIdentityValidationCode =
  | 'invalid_type'
  | 'missing_field'
  | 'unknown_field'
  | 'invalid_value'
  | 'invalid_reference'
  | 'duplicate_binding'
  | 'duplicate_category'
  | 'invalid_category'
  | 'inconsistent_identity'
  | 'reference_mismatch'
  | 'context_policy_conflict'

export interface ContextIdentityValidationError {
  readonly code: ContextIdentityValidationCode
  readonly path: string
  readonly message: string
}

export type ContextIdentityValidationResult<T> =
  | { readonly accepted: true; readonly value: DeepReadonly<T>; readonly errors: readonly [] }
  | { readonly accepted: false; readonly errors: readonly DeepReadonly<ContextIdentityValidationError>[] }

export type ContextCategoryBindingSnapshotValidationResult = ContextIdentityValidationResult<ContextCategoryBindingSnapshotV1>
export type ContextCategoryBindingEntryValidationResult = ContextIdentityValidationResult<ContextCategoryBindingEntryV1>

export type ContextCategoryBindingReferenceVerificationResult =
  | {
      readonly accepted: true
      readonly reference: string
      readonly value: DeepReadonly<ContextCategoryBindingSnapshotV1>
      readonly projection: DeepReadonly<ContextCategoryBindingReferenceProjectionV1>
      readonly errors: readonly []
    }
  | { readonly accepted: false; readonly errors: readonly DeepReadonly<ContextIdentityValidationError>[] }

type RecordValue = Record<string, unknown>

function hasOwn(value: RecordValue, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key)
}

function addError(errors: ContextIdentityValidationError[], code: ContextIdentityValidationCode, path: string, message: string): void {
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
  code: ContextIdentityValidationCode = 'invalid_value',
): string | undefined {
  if (!record || !hasOwn(record, key)) return undefined
  const value = record[key]
  if (typeof value !== 'string' || !predicate(value)) {
    addError(errors, code, `${path}.${key}`, 'Expected an allowed non-empty value.')
    return undefined
  }
  return value
}

export function isContextImmutableReference(value: string): boolean {
  return (VERSIONED_REFERENCE.test(value) || CANONICAL_REFERENCE.test(value))
    && !SECRET_QUERY.test(value)
    && !PERSONAL_PATH.test(value)
    && !PRIVATE_ENDPOINT.test(value)
}

function referenceAt(record: RecordValue | undefined, key: string, path: string, errors: ContextIdentityValidationError[]): string | undefined {
  return stringAt(record, key, path, errors, isContextImmutableReference, 'invalid_reference')
}

function categoryArrayAt(
  record: RecordValue | undefined,
  key: string,
  path: string,
  errors: ContextIdentityValidationError[],
  nonEmpty: boolean,
): string[] | undefined {
  if (!record || !hasOwn(record, key)) return undefined
  const value = record[key]
  if (!Array.isArray(value)) {
    addError(errors, 'invalid_type', `${path}.${key}`, 'Expected an array.')
    return undefined
  }
  if (nonEmpty && value.length === 0) addError(errors, 'invalid_value', `${path}.${key}`, 'Expected a non-empty category array.')
  const accepted: string[] = []
  const seen = new Set<string>()
  value.forEach((item, index) => {
    if (typeof item !== 'string' || !CATEGORY.test(item)) {
      addError(errors, 'invalid_category', `${path}.${key}[${index}]`, 'Expected an opaque Context category value.')
      return
    }
    if (seen.has(item)) addError(errors, 'duplicate_category', `${path}.${key}[${index}]`, 'Duplicate categories are forbidden.')
    seen.add(item)
    accepted.push(item)
  })
  return accepted
}

function validateBindingEntry(
  value: unknown,
  path: string,
  approvedCategories: ReadonlySet<string>,
  errors: ContextIdentityValidationError[],
): string | undefined {
  const entry = objectAt(value, path, ['context_ref', 'categories'], ['context_ref', 'categories'], errors)
  const contextRef = referenceAt(entry, 'context_ref', path, errors)
  const categories = categoryArrayAt(entry, 'categories', path, errors, true) ?? []
  categories.forEach((category, categoryIndex) => {
    if (!approvedCategories.has(category)) addError(errors, 'invalid_category', `${path}.categories[${categoryIndex}]`, 'Bound category is not present in approved_category_values by exact equality.')
  })
  return contextRef
}

export function validateContextCategoryBindingEntryV1(
  value: unknown,
  approvedCategoryValues: readonly string[],
): ContextCategoryBindingEntryValidationResult {
  const errors: ContextIdentityValidationError[] = []
  const approvedRecord = { approved_category_values: approvedCategoryValues }
  const approved = categoryArrayAt(approvedRecord, 'approved_category_values', '$', errors, false) ?? []
  validateBindingEntry(value, '$', new Set(approved), errors)
  if (errors.length > 0) return Object.freeze({ accepted: false as const, errors: deepFreezeClone(errors) })
  return Object.freeze({ accepted: true as const, value: deepFreezeClone(value as ContextCategoryBindingEntryV1), errors: NO_SUPPORTING_ERRORS })
}

export function validateContextCategoryBindingSnapshotV1(value: unknown): ContextCategoryBindingSnapshotValidationResult {
  const errors: ContextIdentityValidationError[] = []
  const fields = [
    'category_binding_contract_version',
    'category_binding_snapshot_ref',
    'category_catalog_ref',
    'approved_category_values',
    'bindings',
    'source_ref',
    'approval_ref',
  ] as const
  const record = objectAt(value, '$', fields, fields, errors)
  stringAt(record, 'category_binding_contract_version', '$', errors, item => item === CONTEXT_CATEGORY_BINDING_CONTRACT_VERSION, 'inconsistent_identity')
  stringAt(record, 'category_binding_snapshot_ref', '$', errors, item => SNAPSHOT_REF.test(item), 'invalid_reference')
  referenceAt(record, 'category_catalog_ref', '$', errors)
  const approved = categoryArrayAt(record, 'approved_category_values', '$', errors, false) ?? []
  referenceAt(record, 'source_ref', '$', errors)
  referenceAt(record, 'approval_ref', '$', errors)

  if (record && hasOwn(record, 'bindings')) {
    if (!Array.isArray(record.bindings)) addError(errors, 'invalid_type', '$.bindings', 'Expected an array.')
    else {
      const approvedSet = new Set(approved)
      const seenBindings = new Set<string>()
      record.bindings.forEach((binding, index) => {
        const path = `$.bindings[${index}]`
        const contextRef = validateBindingEntry(binding, path, approvedSet, errors)
        if (contextRef) {
          if (seenBindings.has(contextRef)) addError(errors, 'duplicate_binding', `${path}.context_ref`, 'Duplicate Context reference bindings are forbidden.')
          seenBindings.add(contextRef)
        }
      })
    }
  }

  if (errors.length > 0) return Object.freeze({ accepted: false as const, errors: deepFreezeClone(errors) })
  return Object.freeze({ accepted: true as const, value: deepFreezeClone(value as ContextCategoryBindingSnapshotV1), errors: NO_SUPPORTING_ERRORS })
}

function canonicalCategories(values: readonly string[]): readonly string[] {
  return [...values].sort(compareContextReferencesUtf8)
}

export function createContextCategoryBindingReferenceProjection(
  value: ContextCategoryBindingReferenceInput,
): DeepReadonly<ContextCategoryBindingReferenceProjectionV1> {
  const admitted = validateContextCategoryBindingSnapshotV1({ ...value, category_binding_snapshot_ref: PLACEHOLDER_SNAPSHOT_REF })
  if (!admitted.accepted) throw new TypeError(`Invalid Context Category Binding reference input at ${admitted.errors[0]?.path ?? '$'}.`)
  const snapshot = admitted.value
  return deepFreezeClone({
    category_binding_contract_version: snapshot.category_binding_contract_version,
    category_catalog_ref: snapshot.category_catalog_ref,
    approved_category_values: canonicalCategories(snapshot.approved_category_values),
    bindings: [...snapshot.bindings]
      .sort((left, right) => compareContextReferencesUtf8(left.context_ref, right.context_ref))
      .map(binding => ({ context_ref: binding.context_ref, categories: canonicalCategories(binding.categories) })),
    source_ref: snapshot.source_ref,
    approval_ref: snapshot.approval_ref,
  })
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

export async function generateContextCategoryBindingSnapshotRef(value: ContextCategoryBindingReferenceInput): Promise<string> {
  const projection = createContextCategoryBindingReferenceProjection(value)
  return `evidence/context-category-bindings/sha256-${await sha256Hex(canonicalizeJcs(projection))}`
}

export async function verifyContextCategoryBindingSnapshotRef(
  value: unknown,
): Promise<ContextCategoryBindingReferenceVerificationResult> {
  const admitted = validateContextCategoryBindingSnapshotV1(value)
  if (!admitted.accepted) return admitted
  try {
    const projection = createContextCategoryBindingReferenceProjection(admitted.value)
    const expected = await generateContextCategoryBindingSnapshotRef(admitted.value)
    if (admitted.value.category_binding_snapshot_ref !== expected) {
      return Object.freeze({
        accepted: false as const,
        errors: deepFreezeClone([{ code: 'reference_mismatch' as const, path: '$.category_binding_snapshot_ref', message: 'Category Binding Snapshot reference does not match the canonical normative projection.' }]),
      })
    }
    return Object.freeze({ accepted: true as const, reference: expected, value: admitted.value, projection, errors: NO_SUPPORTING_ERRORS })
  } catch {
    return Object.freeze({
      accepted: false as const,
      errors: deepFreezeClone([{ code: 'invalid_value' as const, path: '$', message: 'Category Binding Snapshot reference projection is structurally invalid.' }]),
    })
  }
}
