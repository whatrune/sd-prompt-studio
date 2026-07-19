import {
  LOGICAL_TIERS,
  REASONING_LEVELS,
  validateDeploymentBinding,
} from '../deployment-binding'
import type { BindingRevisionReference } from '../deployment-binding'
import {
  AVAILABILITY_STATES,
  BINDING_SET_CONTRACT_VERSION,
  DEPLOYMENT_RESOLVER_CONTRACT_VERSION,
  RESOLUTION_FAILURE_CODES,
} from './types'
import type {
  BindingSetIdentity,
  DeepReadonly,
  ResolutionResult,
  ResolutionResultValidationResult,
  ResolverContractValidationCode,
  ResolverContractValidationError,
  ResolverRequest,
  ResolverRequestValidationResult,
} from './types'

type RecordValue = Record<string, unknown>

const BINDING_ID = /^deployment_binding\.[a-z0-9][a-z0-9_-]*$/
const BINDING_SET_ID = /^deployment_binding_set\.[a-z0-9][a-z0-9_-]*$/
const OPAQUE_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/
const VERSIONED_REFERENCE = /^[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)+$/
const CANONICAL_REFERENCE = /^(?:https:\/\/github\.com\/[^\s]+|(?:docs|config|policies|evidence|profiles)\/[^\s]+)$/
const UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/
const SECRET_FIELD = /(?:^|_)(?:api_?key|secret|token|credential|password|cookie|private_?key)(?:_|$)/i
const SECRET_QUERY = /[?&](?:token|secret|api[_-]?key|credential|password)=/i

function isRecord(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasOwn(record: RecordValue, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key)
}

function addError(
  errors: ResolverContractValidationError[],
  code: ResolverContractValidationCode,
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
  errors: ResolverContractValidationError[],
): RecordValue | undefined {
  if (!isRecord(value)) {
    addError(errors, 'INVALID_TYPE', path, 'Expected a closed object.')
    return undefined
  }

  for (const key of required) {
    if (!hasOwn(value, key)) {
      addError(errors, 'MISSING_FIELD', `${path}.${key}`, 'Required field is missing.')
    }
  }
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      const secretBearing = SECRET_FIELD.test(key)
      addError(
        errors,
        secretBearing ? 'SECRET_FIELD' : 'UNKNOWN_FIELD',
        `${path}.${key}`,
        secretBearing ? 'Secret-bearing fields are forbidden.' : 'Unknown field is forbidden.',
      )
    }
  }
  return value
}

function stringAt(
  record: RecordValue | undefined,
  key: string,
  path: string,
  errors: ResolverContractValidationError[],
  predicate: (value: string) => boolean = value => value.trim().length > 0,
  message = 'Expected a non-empty string.',
): string | undefined {
  if (!record || !hasOwn(record, key)) return undefined
  const value = record[key]
  if (typeof value !== 'string' || !predicate(value)) {
    addError(errors, 'INVALID_VALUE', `${path}.${key}`, message)
    return undefined
  }
  return value
}

function integerAt(
  record: RecordValue | undefined,
  key: string,
  path: string,
  errors: ResolverContractValidationError[],
  minimum: number,
): number | undefined {
  if (!record || !hasOwn(record, key)) return undefined
  const value = record[key]
  if (!Number.isInteger(value) || (value as number) < minimum) {
    addError(errors, 'INVALID_VALUE', `${path}.${key}`, `Expected an integer greater than or equal to ${minimum}.`)
    return undefined
  }
  return value as number
}

function enumAt(
  record: RecordValue | undefined,
  key: string,
  path: string,
  values: readonly string[],
  errors: ResolverContractValidationError[],
): string | undefined {
  return stringAt(
    record,
    key,
    path,
    errors,
    value => values.includes(value),
    `Expected one of: ${values.join(', ')}.`,
  )
}

function timestampAt(
  record: RecordValue | undefined,
  key: string,
  path: string,
  errors: ResolverContractValidationError[],
): string | undefined {
  return stringAt(
    record,
    key,
    path,
    errors,
    value => UTC_TIMESTAMP.test(value) && !Number.isNaN(Date.parse(value)),
    'Expected an RFC 3339 UTC timestamp.',
  )
}

function trustedReferenceAt(
  record: RecordValue | undefined,
  key: string,
  path: string,
  errors: ResolverContractValidationError[],
): string | undefined {
  return stringAt(
    record,
    key,
    path,
    errors,
    value => (VERSIONED_REFERENCE.test(value) || CANONICAL_REFERENCE.test(value)) && !SECRET_QUERY.test(value),
    'Expected a trusted versioned or canonical reference without secret-bearing query data.',
  )
}

function stringArrayAt(
  record: RecordValue | undefined,
  key: string,
  path: string,
  errors: ResolverContractValidationError[],
  predicate: (value: string) => boolean = value => value.trim().length > 0,
): string[] | undefined {
  if (!record || !hasOwn(record, key)) return undefined
  const value = record[key]
  if (!Array.isArray(value)) {
    addError(errors, 'INVALID_TYPE', `${path}.${key}`, 'Expected an array.')
    return undefined
  }
  const accepted: string[] = []
  for (const [index, item] of value.entries()) {
    if (typeof item !== 'string' || !predicate(item)) {
      addError(errors, 'INVALID_VALUE', `${path}.${key}[${index}]`, 'Array item is invalid.')
    } else {
      accepted.push(item)
    }
  }
  if (new Set(accepted).size !== accepted.length) {
    addError(errors, 'DUPLICATE_VALUE', `${path}.${key}`, 'Array items must be unique.')
  }
  return accepted
}

function validateBindingIdentity(
  value: unknown,
  path: string,
  errors: ResolverContractValidationError[],
): BindingRevisionReference | undefined {
  const record = objectAt(value, path, ['binding_id', 'binding_revision'], ['binding_id', 'binding_revision'], errors)
  const bindingId = stringAt(record, 'binding_id', path, errors, value => BINDING_ID.test(value), 'Invalid binding_id.')
  const bindingRevision = integerAt(record, 'binding_revision', path, errors, 1)
  return bindingId && bindingRevision ? { binding_id: bindingId, binding_revision: bindingRevision } : undefined
}

function validateBindingSetIdentity(
  value: unknown,
  path: string,
  errors: ResolverContractValidationError[],
): BindingSetIdentity | undefined {
  const fields = ['contract_version', 'binding_set_id', 'binding_set_revision'] as const
  const record = objectAt(value, path, fields, fields, errors)
  const contractVersion = enumAt(record, 'contract_version', path, [BINDING_SET_CONTRACT_VERSION], errors)
  const bindingSetId = stringAt(record, 'binding_set_id', path, errors, value => BINDING_SET_ID.test(value), 'Invalid binding_set_id.')
  const bindingSetRevision = integerAt(record, 'binding_set_revision', path, errors, 1)
  return contractVersion && bindingSetId && bindingSetRevision
    ? { contract_version: BINDING_SET_CONTRACT_VERSION, binding_set_id: bindingSetId, binding_set_revision: bindingSetRevision }
    : undefined
}

function sameBindingSetIdentity(left: BindingSetIdentity, right: BindingSetIdentity): boolean {
  return left.contract_version === right.contract_version
    && left.binding_set_id === right.binding_set_id
    && left.binding_set_revision === right.binding_set_revision
}

function validateBindingSetSnapshot(
  value: unknown,
  path: string,
  errors: ResolverContractValidationError[],
): { identity?: BindingSetIdentity; routingContractVersion?: string; resolutionScopeRef?: string } {
  const fields = [
    'binding_set_identity',
    'routing_contract_version',
    'resolution_scope_ref',
    'included_binding_refs',
    'bindings',
    'approval_record',
    'effective_from',
    'review_due_at',
  ] as const
  const record = objectAt(value, path, fields, fields, errors)
  const identity = validateBindingSetIdentity(record?.binding_set_identity, `${path}.binding_set_identity`, errors)
  const routingContractVersion = stringAt(record, 'routing_contract_version', path, errors, value => OPAQUE_IDENTIFIER.test(value), 'Invalid routing contract version.')
  const resolutionScopeRef = trustedReferenceAt(record, 'resolution_scope_ref', path, errors)
  trustedReferenceAt(record, 'approval_record', path, errors)
  timestampAt(record, 'effective_from', path, errors)
  timestampAt(record, 'review_due_at', path, errors)

  if (record && hasOwn(record, 'included_binding_refs')) {
    const references = record.included_binding_refs
    if (!Array.isArray(references) || references.length === 0) {
      addError(errors, 'INVALID_TYPE', `${path}.included_binding_refs`, 'Expected a non-empty array.')
    } else {
      references.forEach((reference, index) => validateBindingIdentity(reference, `${path}.included_binding_refs[${index}]`, errors))
    }
  }

  if (record && hasOwn(record, 'bindings')) {
    const bindings = record.bindings
    if (!Array.isArray(bindings) || bindings.length === 0) {
      addError(errors, 'INVALID_TYPE', `${path}.bindings`, 'Expected a non-empty array of accepted Deployment Binding values.')
    } else {
      for (const [index, binding] of bindings.entries()) {
        const result = validateDeploymentBinding(binding)
        if (!result.accepted) {
          addError(errors, 'INVALID_VALUE', `${path}.bindings[${index}]`, 'Expected a structurally valid Deployment Binding value.')
        }
      }
    }
  }

  return { identity, routingContractVersion, resolutionScopeRef }
}

function validateBindingSetProof(
  value: unknown,
  path: string,
  errors: ResolverContractValidationError[],
): BindingSetIdentity | undefined {
  const fields = [
    'binding_set_identity',
    'validation_proof_ref',
    'semantic_validation_version',
    'status',
    'validated_at',
    'valid_until',
  ] as const
  const record = objectAt(value, path, fields, fields, errors)
  const identity = validateBindingSetIdentity(record?.binding_set_identity, `${path}.binding_set_identity`, errors)
  trustedReferenceAt(record, 'validation_proof_ref', path, errors)
  stringAt(record, 'semantic_validation_version', path, errors, value => OPAQUE_IDENTIFIER.test(value), 'Invalid semantic validation version.')
  enumAt(record, 'status', path, ['completed'], errors)
  timestampAt(record, 'validated_at', path, errors)
  timestampAt(record, 'valid_until', path, errors)
  return identity
}

function validateExecutionContext(
  value: unknown,
  path: string,
  errors: ResolverContractValidationError[],
): { routingContractVersion?: string; resolutionScopeRef?: string } {
  const fields = [
    'routing_contract_version',
    'resolution_scope_ref',
    'logical_tier',
    'capability_floor_ref',
    'required_reasoning_level',
    'required_input_tokens',
    'required_output_reserve_tokens',
    'context_estimate_ref',
    'execution_adapter_contract_version',
    'runner_profile_ref',
    'sandbox_profile_ref',
    'network_policy_ref',
    'required_tool_profile_refs',
    'required_structured_output_profile_refs',
    'response_profile_ref',
    'cost_policy_ref',
    'availability_policy_ref',
  ] as const
  const record = objectAt(value, path, fields, fields, errors)
  const routingContractVersion = stringAt(record, 'routing_contract_version', path, errors, value => OPAQUE_IDENTIFIER.test(value), 'Invalid routing contract version.')
  const resolutionScopeRef = trustedReferenceAt(record, 'resolution_scope_ref', path, errors)
  enumAt(record, 'logical_tier', path, LOGICAL_TIERS, errors)
  trustedReferenceAt(record, 'capability_floor_ref', path, errors)
  enumAt(record, 'required_reasoning_level', path, REASONING_LEVELS, errors)
  integerAt(record, 'required_input_tokens', path, errors, 0)
  integerAt(record, 'required_output_reserve_tokens', path, errors, 0)
  trustedReferenceAt(record, 'context_estimate_ref', path, errors)
  stringAt(record, 'execution_adapter_contract_version', path, errors, value => OPAQUE_IDENTIFIER.test(value), 'Invalid adapter contract version.')
  for (const field of [
    'runner_profile_ref',
    'sandbox_profile_ref',
    'network_policy_ref',
    'response_profile_ref',
    'cost_policy_ref',
    'availability_policy_ref',
  ] as const) {
    trustedReferenceAt(record, field, path, errors)
  }
  for (const field of ['required_tool_profile_refs', 'required_structured_output_profile_refs'] as const) {
    stringArrayAt(record, field, path, errors, value => VERSIONED_REFERENCE.test(value))
  }
  return { routingContractVersion, resolutionScopeRef }
}

function validateAvailabilitySnapshot(
  value: unknown,
  path: string,
  errors: ResolverContractValidationError[],
): BindingSetIdentity | undefined {
  const fields = [
    'snapshot_id',
    'binding_set_identity',
    'observed_at',
    'valid_until',
    'binding_states',
    'verification_ref',
  ] as const
  const record = objectAt(value, path, fields, fields, errors)
  stringAt(record, 'snapshot_id', path, errors, value => OPAQUE_IDENTIFIER.test(value), 'Invalid availability snapshot identity.')
  const identity = validateBindingSetIdentity(record?.binding_set_identity, `${path}.binding_set_identity`, errors)
  timestampAt(record, 'observed_at', path, errors)
  timestampAt(record, 'valid_until', path, errors)
  trustedReferenceAt(record, 'verification_ref', path, errors)

  if (record && hasOwn(record, 'binding_states')) {
    const bindingStates = record.binding_states
    if (!Array.isArray(bindingStates) || bindingStates.length === 0) {
      addError(errors, 'INVALID_TYPE', `${path}.binding_states`, 'Expected a non-empty array.')
    } else {
      const identities: string[] = []
      for (const [index, stateValue] of bindingStates.entries()) {
        const statePath = `${path}.binding_states[${index}]`
        const stateRecord = objectAt(stateValue, statePath, ['binding_identity', 'state'], ['binding_identity', 'state'], errors)
        const bindingIdentity = validateBindingIdentity(stateRecord?.binding_identity, `${statePath}.binding_identity`, errors)
        enumAt(stateRecord, 'state', statePath, AVAILABILITY_STATES, errors)
        if (bindingIdentity) identities.push(`${bindingIdentity.binding_id}@${bindingIdentity.binding_revision}`)
      }
      if (new Set(identities).size !== identities.length) {
        addError(errors, 'DUPLICATE_VALUE', `${path}.binding_states`, 'Binding state identities must be unique.')
      }
    }
  }
  return identity
}

function validateCompatibility(
  value: unknown,
  path: string,
  errors: ResolverContractValidationError[],
): void {
  const fields = [
    'execution_adapter_contract_version',
    'runner_profile_ref',
    'sandbox_profile_ref',
    'network_policy_ref',
    'tool_profile_refs',
    'structured_output_profile_refs',
    'response_profile_ref',
  ] as const
  const record = objectAt(value, path, fields, fields, errors)
  stringAt(record, 'execution_adapter_contract_version', path, errors, value => OPAQUE_IDENTIFIER.test(value), 'Invalid adapter contract version.')
  for (const field of ['runner_profile_ref', 'sandbox_profile_ref', 'network_policy_ref', 'response_profile_ref'] as const) {
    trustedReferenceAt(record, field, path, errors)
  }
  for (const field of ['tool_profile_refs', 'structured_output_profile_refs'] as const) {
    stringArrayAt(record, field, path, errors, value => VERSIONED_REFERENCE.test(value))
  }
}

function validateDiagnostics(
  value: unknown,
  path: string,
  errors: ResolverContractValidationError[],
): void {
  if (!Array.isArray(value)) {
    addError(errors, 'INVALID_TYPE', path, 'Expected an array.')
    return
  }
  for (const [index, item] of value.entries()) {
    const itemPath = `${path}[${index}]`
    const fields = ['code', 'path', 'diagnostics_ref'] as const
    const record = objectAt(item, itemPath, fields, fields, errors)
    stringAt(record, 'code', itemPath, errors, value => OPAQUE_IDENTIFIER.test(value), 'Invalid diagnostic code.')
    stringAt(record, 'path', itemPath, errors)
    trustedReferenceAt(record, 'diagnostics_ref', itemPath, errors)
  }
}

function cloneAndFreeze<T>(value: T): DeepReadonly<T> {
  const clone = structuredClone(value)
  const freeze = (candidate: unknown): void => {
    if (typeof candidate !== 'object' || candidate === null || Object.isFrozen(candidate)) return
    for (const nested of Object.values(candidate)) freeze(nested)
    Object.freeze(candidate)
  }
  freeze(clone)
  return clone as DeepReadonly<T>
}

export function validateResolverRequest(value: unknown): ResolverRequestValidationResult {
  const errors: ResolverContractValidationError[] = []
  const fields = [
    'resolver_contract_version',
    'task_id',
    'assignment_revision',
    'binding_set_snapshot',
    'binding_set_validation',
    'execution_context',
    'availability_snapshot',
    'evaluation_timestamp',
  ] as const
  const root = objectAt(value, '$', fields, fields, errors)
  enumAt(root, 'resolver_contract_version', '$', [DEPLOYMENT_RESOLVER_CONTRACT_VERSION], errors)
  stringAt(root, 'task_id', '$', errors, candidate => OPAQUE_IDENTIFIER.test(candidate), 'Invalid task_id.')
  trustedReferenceAt(root, 'assignment_revision', '$', errors)
  timestampAt(root, 'evaluation_timestamp', '$', errors)

  const snapshot = validateBindingSetSnapshot(root?.binding_set_snapshot, '$.binding_set_snapshot', errors)
  const validationIdentity = validateBindingSetProof(root?.binding_set_validation, '$.binding_set_validation', errors)
  const executionContext = validateExecutionContext(root?.execution_context, '$.execution_context', errors)
  const availabilityIdentity = validateAvailabilitySnapshot(root?.availability_snapshot, '$.availability_snapshot', errors)

  if (snapshot.identity && validationIdentity && !sameBindingSetIdentity(snapshot.identity, validationIdentity)) {
    addError(errors, 'INCONSISTENT_IDENTITY', '$.binding_set_validation.binding_set_identity', 'Validation proof must reference the exact Binding Set Snapshot identity.')
  }
  if (snapshot.identity && availabilityIdentity && !sameBindingSetIdentity(snapshot.identity, availabilityIdentity)) {
    addError(errors, 'INCONSISTENT_IDENTITY', '$.availability_snapshot.binding_set_identity', 'Availability Snapshot must reference the exact Binding Set Snapshot identity.')
  }
  if (snapshot.routingContractVersion && executionContext.routingContractVersion && snapshot.routingContractVersion !== executionContext.routingContractVersion) {
    addError(errors, 'INCONSISTENT_IDENTITY', '$.execution_context.routing_contract_version', 'Execution Context must reference the Binding Set routing contract.')
  }
  if (snapshot.resolutionScopeRef && executionContext.resolutionScopeRef && snapshot.resolutionScopeRef !== executionContext.resolutionScopeRef) {
    addError(errors, 'INCONSISTENT_IDENTITY', '$.execution_context.resolution_scope_ref', 'Execution Context must reference the Binding Set resolution scope.')
  }

  if (errors.length > 0 || !root) return { accepted: false, errors: Object.freeze(errors) }
  return { accepted: true, request: cloneAndFreeze(root as unknown as ResolverRequest), errors: [] }
}

export function validateResolutionResult(value: unknown): ResolutionResultValidationResult {
  const errors: ResolverContractValidationError[] = []
  const commonFields = [
    'resolver_contract_version',
    'status',
    'task_id',
    'assignment_revision',
    'binding_set_identity',
    'binding_set_validation_ref',
    'availability_snapshot_id',
    'evaluation_timestamp',
    'applied_rules',
  ] as const
  const resolvedFields = [
    ...commonFields,
    'selected_binding_identity',
    'selected_binding',
    'required_reasoning_level',
    'fallback_path',
    'compatibility',
    'diagnostics',
  ] as const
  const failureFields = [...commonFields, 'failure_code', 'reason', 'diagnostics_ref'] as const

  if (!isRecord(value)) {
    addError(errors, 'INVALID_TYPE', '$', 'Expected a closed object.')
    return { accepted: false, errors: Object.freeze(errors) }
  }
  const statusValue = value.status
  const expectedFields = statusValue === 'completed' ? resolvedFields : failureFields
  const root = objectAt(value, '$', expectedFields, expectedFields, errors)

  enumAt(root, 'resolver_contract_version', '$', [DEPLOYMENT_RESOLVER_CONTRACT_VERSION], errors)
  const status = enumAt(root, 'status', '$', ['completed', 'blocked', 'failed'], errors)
  stringAt(root, 'task_id', '$', errors, candidate => OPAQUE_IDENTIFIER.test(candidate), 'Invalid task_id.')
  trustedReferenceAt(root, 'assignment_revision', '$', errors)
  validateBindingSetIdentity(root?.binding_set_identity, '$.binding_set_identity', errors)
  trustedReferenceAt(root, 'binding_set_validation_ref', '$', errors)
  stringAt(root, 'availability_snapshot_id', '$', errors, candidate => OPAQUE_IDENTIFIER.test(candidate), 'Invalid availability snapshot identity.')
  timestampAt(root, 'evaluation_timestamp', '$', errors)
  stringArrayAt(root, 'applied_rules', '$', errors, candidate => VERSIONED_REFERENCE.test(candidate))

  if (status === 'completed') {
    const selectedIdentity = validateBindingIdentity(root?.selected_binding_identity, '$.selected_binding_identity', errors)
    const selectedBindingResult = validateDeploymentBinding(root?.selected_binding)
    if (!selectedBindingResult.accepted) {
      addError(errors, 'INVALID_VALUE', '$.selected_binding', 'Expected a structurally valid Deployment Binding value.')
    } else if (selectedIdentity && (
      selectedBindingResult.binding.binding_id !== selectedIdentity.binding_id
      || selectedBindingResult.binding.binding_revision !== selectedIdentity.binding_revision
    )) {
      addError(errors, 'INCONSISTENT_IDENTITY', '$.selected_binding_identity', 'Selected Binding identity must match the pinned Binding value.')
    }
    enumAt(root, 'required_reasoning_level', '$', REASONING_LEVELS, errors)
    if (root && hasOwn(root, 'fallback_path')) {
      if (!Array.isArray(root.fallback_path)) {
        addError(errors, 'INVALID_TYPE', '$.fallback_path', 'Expected an array.')
      } else {
        root.fallback_path.forEach((item, index) => validateBindingIdentity(item, `$.fallback_path[${index}]`, errors))
      }
    }
    validateCompatibility(root?.compatibility, '$.compatibility', errors)
    validateDiagnostics(root?.diagnostics, '$.diagnostics', errors)
  } else if (status === 'blocked' || status === 'failed') {
    const failureCode = enumAt(root, 'failure_code', '$', RESOLUTION_FAILURE_CODES, errors)
    stringAt(root, 'reason', '$', errors)
    trustedReferenceAt(root, 'diagnostics_ref', '$', errors)
    if (failureCode && status === 'failed' && failureCode !== 'internal_failure') {
      addError(errors, 'INVALID_VALUE', '$.failure_code', 'The failed status is reserved for internal_failure.')
    }
    if (failureCode === 'internal_failure' && status !== 'failed') {
      addError(errors, 'INVALID_VALUE', '$.status', 'internal_failure must use the failed status.')
    }
  }

  if (errors.length > 0 || !root) return { accepted: false, errors: Object.freeze(errors) }
  return { accepted: true, result: cloneAndFreeze(root as unknown as ResolutionResult), errors: [] }
}
