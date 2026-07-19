import {
  LIFECYCLE_STATUSES,
  LOGICAL_TIERS,
  REASONING_LEVELS,
} from './types'
import type {
  BindingRevisionReference,
  DeploymentBinding,
  DeploymentBindingValidationCode,
  DeploymentBindingValidationError,
  DeploymentBindingValidationResult,
} from './types'

type RecordValue = Record<string, unknown>

const BINDING_ID = /^deployment_binding\.[a-z0-9][a-z0-9_-]*$/
const OPAQUE_IDENTIFIER = /^[a-z0-9][a-z0-9._-]*$/
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

function isCanonicalReference(value: string): boolean {
  return CANONICAL_REFERENCE.test(value) && !SECRET_QUERY.test(value)
}

function addError(
  errors: DeploymentBindingValidationError[],
  code: DeploymentBindingValidationCode,
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
  errors: DeploymentBindingValidationError[],
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
      addError(
        errors,
        SECRET_FIELD.test(key) ? 'SECRET_FIELD' : 'UNKNOWN_FIELD',
        `${path}.${key}`,
        SECRET_FIELD.test(key) ? 'Secret-bearing fields are forbidden.' : 'Unknown field is forbidden.',
      )
    }
  }
  return value
}

function stringAt(
  record: RecordValue | undefined,
  key: string,
  path: string,
  errors: DeploymentBindingValidationError[],
  predicate: (value: string) => boolean = value => value.length > 0,
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
  errors: DeploymentBindingValidationError[],
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
  errors: DeploymentBindingValidationError[],
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

function stringArrayAt(
  record: RecordValue | undefined,
  key: string,
  path: string,
  errors: DeploymentBindingValidationError[],
  options: { minimumItems?: number; predicate?: (value: string) => boolean } = {},
): string[] | undefined {
  if (!record || !hasOwn(record, key)) return undefined
  const value = record[key]
  const minimumItems = options.minimumItems ?? 0
  if (!Array.isArray(value) || value.length < minimumItems) {
    addError(errors, 'INVALID_TYPE', `${path}.${key}`, `Expected an array with at least ${minimumItems} item(s).`)
    return undefined
  }

  const result: string[] = []
  for (const [index, item] of value.entries()) {
    if (typeof item !== 'string' || !(options.predicate ?? (candidate => candidate.length > 0))(item)) {
      addError(errors, 'INVALID_VALUE', `${path}.${key}[${index}]`, 'Array item is invalid.')
    } else {
      result.push(item)
    }
  }
  if (new Set(result).size !== result.length) {
    addError(errors, 'DUPLICATE_VALUE', `${path}.${key}`, 'Array items must be unique.')
  }
  return result
}

function validateTimestamp(
  record: RecordValue | undefined,
  key: string,
  path: string,
  errors: DeploymentBindingValidationError[],
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

function validateBindingReference(
  value: unknown,
  path: string,
  errors: DeploymentBindingValidationError[],
): BindingRevisionReference | undefined {
  const record = objectAt(value, path, ['binding_id', 'binding_revision'], ['binding_id', 'binding_revision'], errors)
  const bindingId = stringAt(record, 'binding_id', path, errors, value => BINDING_ID.test(value), 'Invalid binding_id.')
  const revision = integerAt(record, 'binding_revision', path, errors, 1)
  return bindingId && revision ? { binding_id: bindingId, binding_revision: revision } : undefined
}

function validateBindingReferenceArray(
  record: RecordValue | undefined,
  key: string,
  path: string,
  errors: DeploymentBindingValidationError[],
): BindingRevisionReference[] | undefined {
  if (!record || !hasOwn(record, key)) return undefined
  const value = record[key]
  if (!Array.isArray(value)) {
    addError(errors, 'INVALID_TYPE', `${path}.${key}`, 'Expected an array of Binding revision references.')
    return undefined
  }
  const references = value
    .map((item, index) => validateBindingReference(item, `${path}.${key}[${index}]`, errors))
    .filter((item): item is BindingRevisionReference => item !== undefined)
  const identities = references.map(item => `${item.binding_id}@${item.binding_revision}`)
  if (new Set(identities).size !== identities.length) {
    addError(errors, 'DUPLICATE_VALUE', `${path}.${key}`, 'Binding revision references must be unique.')
  }
  return references
}

function sameSet(left: readonly string[] | undefined, right: readonly string[] | undefined): boolean {
  return left !== undefined
    && right !== undefined
    && left.length === right.length
    && left.every(item => right.includes(item))
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value
  Object.freeze(value)
  for (const nested of Object.values(value)) deepFreeze(nested)
  return value
}

function validateGovernance(
  value: unknown,
  errors: DeploymentBindingValidationError[],
): RecordValue | undefined {
  const path = '$.governance'
  const fields = [
    'lifecycle_status', 'created_at', 'effective_from', 'approved_at', 'deprecated_at', 'retired_at',
    'review_due_at', 'approval_owner', 'approval_record', 'architecture_review_ref', 'security_review_ref',
    'capability_evidence_refs', 'quality_evaluation_refs', 'cost_evaluation_refs', 'latency_evaluation_refs',
    'availability_evidence_refs', 'security_review_refs', 'compatibility_evidence_refs', 'supersedes',
    'rollback_target', 'change_reason',
  ] as const
  const record = objectAt(value, path, ['lifecycle_status', 'created_at', 'review_due_at', 'change_reason'], fields, errors)
  const lifecycle = enumAt(record, 'lifecycle_status', path, LIFECYCLE_STATUSES, errors)
  validateTimestamp(record, 'created_at', path, errors)
  validateTimestamp(record, 'review_due_at', path, errors)
  for (const field of ['effective_from', 'approved_at', 'deprecated_at', 'retired_at'] as const) {
    if (record && hasOwn(record, field)) validateTimestamp(record, field, path, errors)
  }
  stringAt(record, 'change_reason', path, errors)

  const approvalMetadata = ['approval_owner', 'approval_record', 'architecture_review_ref', 'security_review_ref'] as const
  const evidenceFields = [
    'capability_evidence_refs', 'quality_evaluation_refs', 'cost_evaluation_refs', 'latency_evaluation_refs',
    'availability_evidence_refs', 'security_review_refs', 'compatibility_evidence_refs',
  ] as const
  if (lifecycle && lifecycle !== 'draft') {
    for (const field of approvalMetadata) {
      if (!record || !hasOwn(record, field)) addError(errors, 'MISSING_FIELD', `${path}.${field}`, 'Approval metadata is required outside draft lifecycle.')
    }
    for (const field of evidenceFields) {
      if (!record || !hasOwn(record, field)) addError(errors, 'MISSING_FIELD', `${path}.${field}`, 'Approval evidence is required outside draft lifecycle.')
    }
  }
  if (lifecycle === 'approved' || lifecycle === 'deprecated') {
    for (const field of ['effective_from', 'approved_at'] as const) {
      if (!record || !hasOwn(record, field)) addError(errors, 'MISSING_FIELD', `${path}.${field}`, `${field} is required for ${lifecycle}.`)
    }
  }
  if (lifecycle === 'deprecated' && (!record || !hasOwn(record, 'deprecated_at'))) {
    addError(errors, 'MISSING_FIELD', `${path}.deprecated_at`, 'deprecated_at is required for deprecated lifecycle.')
  }
  if (lifecycle === 'retired' && (!record || !hasOwn(record, 'retired_at'))) {
    addError(errors, 'MISSING_FIELD', `${path}.retired_at`, 'retired_at is required for retired lifecycle.')
  }
  if (lifecycle === 'draft' && record) {
    for (const field of [...approvalMetadata, ...evidenceFields, 'effective_from', 'approved_at', 'deprecated_at', 'retired_at']) {
      if (hasOwn(record, field)) addError(errors, 'INVALID_VALUE', `${path}.${field}`, 'Draft lifecycle must not contain approval or later-lifecycle metadata.')
    }
  }

  if (record) {
    stringAt(record, 'approval_owner', path, errors)
    for (const field of ['approval_record', 'architecture_review_ref', 'security_review_ref'] as const) {
      if (hasOwn(record, field)) stringAt(record, field, path, errors, isCanonicalReference, 'Invalid canonical reference.')
    }
    for (const field of evidenceFields) {
      if (hasOwn(record, field)) stringArrayAt(record, field, path, errors, { minimumItems: 1, predicate: isCanonicalReference })
    }
    if (hasOwn(record, 'supersedes')) validateBindingReference(record.supersedes, `${path}.supersedes`, errors)
    if (hasOwn(record, 'rollback_target')) validateBindingReference(record.rollback_target, `${path}.rollback_target`, errors)
  }
  return record
}

export function validateDeploymentBinding(value: unknown): DeploymentBindingValidationResult {
  const errors: DeploymentBindingValidationError[] = []
  const rootFields = [
    'contract_version', 'binding_id', 'binding_revision', 'tier_binding', 'deployment', 'capabilities',
    'compatibility', 'operations', 'resolution', 'governance',
  ] as const
  const root = objectAt(value, '$', rootFields, rootFields, errors)
  const contractVersion = stringAt(root, 'contract_version', '$', errors, item => item === 'deployment_binding_v1', 'Unsupported contract_version.')
  const bindingId = stringAt(root, 'binding_id', '$', errors, item => BINDING_ID.test(item), 'binding_id must use deployment_binding.<opaque-name>.')
  const bindingRevision = integerAt(root, 'binding_revision', '$', errors, 1)

  const tierPath = '$.tier_binding'
  const tierFields = ['routing_contract_version', 'logical_tier', 'capability_floor_ref', 'required_reasoning_level'] as const
  const tier = objectAt(root?.tier_binding, tierPath, tierFields, tierFields, errors)
  stringAt(tier, 'routing_contract_version', tierPath, errors, item => OPAQUE_IDENTIFIER.test(item), 'Invalid routing contract version.')
  enumAt(tier, 'logical_tier', tierPath, LOGICAL_TIERS, errors)
  stringAt(tier, 'capability_floor_ref', tierPath, errors, item => VERSIONED_REFERENCE.test(item), 'Invalid capability floor reference.')
  const requiredReasoning = enumAt(tier, 'required_reasoning_level', tierPath, REASONING_LEVELS, errors)

  const deploymentPath = '$.deployment'
  const deploymentRequired = ['provider_id', 'model_family', 'model_version', 'deployment_id'] as const
  const deploymentFields = [...deploymentRequired, 'provider_profile_ref'] as const
  const deployment = objectAt(root?.deployment, deploymentPath, deploymentRequired, deploymentFields, errors)
  for (const field of ['provider_id', 'model_family', 'deployment_id'] as const) {
    stringAt(deployment, field, deploymentPath, errors, item => OPAQUE_IDENTIFIER.test(item), `Invalid ${field}.`)
  }
  stringAt(
    deployment,
    'model_version',
    deploymentPath,
    errors,
    item => /^\S+$/.test(item) && item.toLowerCase() !== 'latest' && !/[?*]/.test(item),
    'model_version must be exact and must not use latest or wildcards.',
  )
  if (deployment && hasOwn(deployment, 'provider_profile_ref')) {
    stringAt(deployment, 'provider_profile_ref', deploymentPath, errors, item => VERSIONED_REFERENCE.test(item), 'Invalid provider profile reference.')
  }

  const capabilitiesPath = '$.capabilities'
  const capabilitiesRequired = [
    'supported_reasoning_levels', 'declared_context_limit_tokens', 'reserved_output_tokens',
    'usable_input_limit_tokens', 'context_evidence_ref', 'tool_profile_refs',
    'structured_output_profile_refs', 'response_profile_refs',
  ] as const
  const capabilitiesFields = [...capabilitiesRequired, 'default_reasoning_level'] as const
  const capabilities = objectAt(root?.capabilities, capabilitiesPath, capabilitiesRequired, capabilitiesFields, errors)
  const supportedReasoning = stringArrayAt(capabilities, 'supported_reasoning_levels', capabilitiesPath, errors, {
    minimumItems: 1,
    predicate: item => REASONING_LEVELS.includes(item as (typeof REASONING_LEVELS)[number]),
  })
  const defaultReasoning = capabilities && hasOwn(capabilities, 'default_reasoning_level')
    ? enumAt(capabilities, 'default_reasoning_level', capabilitiesPath, REASONING_LEVELS, errors)
    : undefined
  const contextLimit = integerAt(capabilities, 'declared_context_limit_tokens', capabilitiesPath, errors, 1)
  const reservedOutput = integerAt(capabilities, 'reserved_output_tokens', capabilitiesPath, errors, 0)
  const usableInput = integerAt(capabilities, 'usable_input_limit_tokens', capabilitiesPath, errors, 1)
  stringAt(capabilities, 'context_evidence_ref', capabilitiesPath, errors, isCanonicalReference, 'Invalid context evidence reference.')
  const capabilityTools = stringArrayAt(capabilities, 'tool_profile_refs', capabilitiesPath, errors, { predicate: item => VERSIONED_REFERENCE.test(item) })
  stringArrayAt(capabilities, 'structured_output_profile_refs', capabilitiesPath, errors, { predicate: item => VERSIONED_REFERENCE.test(item) })
  const capabilityResponses = stringArrayAt(capabilities, 'response_profile_refs', capabilitiesPath, errors, { predicate: item => VERSIONED_REFERENCE.test(item) })

  if (defaultReasoning && supportedReasoning && !supportedReasoning.includes(defaultReasoning)) {
    addError(errors, 'INCONSISTENT_VALUE', `${capabilitiesPath}.default_reasoning_level`, 'Default reasoning level must be supported.')
  }
  if (requiredReasoning && supportedReasoning && !supportedReasoning.includes(requiredReasoning)) {
    addError(errors, 'INCONSISTENT_VALUE', `${tierPath}.required_reasoning_level`, 'Required reasoning level must be supported by this deployment.')
  }
  if (contextLimit !== undefined && reservedOutput !== undefined && usableInput !== undefined && reservedOutput + usableInput > contextLimit) {
    addError(errors, 'INCONSISTENT_VALUE', capabilitiesPath, 'Usable input plus reserved output must not exceed the declared context limit.')
  }

  const compatibilityPath = '$.compatibility'
  const compatibilityFields = [
    'execution_adapter_contract_versions', 'runner_profile_refs', 'sandbox_profile_refs',
    'network_policy_refs', 'tool_profile_refs', 'response_profile_refs',
  ] as const
  const compatibility = objectAt(root?.compatibility, compatibilityPath, compatibilityFields, compatibilityFields, errors)
  stringArrayAt(compatibility, 'execution_adapter_contract_versions', compatibilityPath, errors, {
    minimumItems: 1,
    predicate: item => OPAQUE_IDENTIFIER.test(item),
  })
  for (const field of ['runner_profile_refs', 'sandbox_profile_refs', 'network_policy_refs', 'response_profile_refs'] as const) {
    stringArrayAt(compatibility, field, compatibilityPath, errors, { minimumItems: 1, predicate: item => VERSIONED_REFERENCE.test(item) })
  }
  const compatibilityTools = stringArrayAt(compatibility, 'tool_profile_refs', compatibilityPath, errors, { predicate: item => VERSIONED_REFERENCE.test(item) })
  const compatibilityResponses = compatibility && Array.isArray(compatibility.response_profile_refs)
    ? compatibility.response_profile_refs.filter((item): item is string => typeof item === 'string')
    : undefined
  if (!sameSet(capabilityTools, compatibilityTools)) {
    addError(errors, 'INCONSISTENT_VALUE', `${compatibilityPath}.tool_profile_refs`, 'Capability and compatibility tool profiles must match.')
  }
  if (!sameSet(capabilityResponses, compatibilityResponses)) {
    addError(errors, 'INCONSISTENT_VALUE', `${compatibilityPath}.response_profile_refs`, 'Capability and compatibility response profiles must match.')
  }

  const operationsPath = '$.operations'
  const operationsFields = [
    'cost_class', 'budget_posture', 'cost_evidence_ref', 'latency_class', 'reliability_class',
    'latency_evidence_ref', 'reliability_evidence_ref', 'availability_requirement', 'retry_policy_ref',
    'monitoring_profile_ref', 'capacity_policy_ref',
  ] as const
  const operations = objectAt(root?.operations, operationsPath, operationsFields, operationsFields, errors)
  enumAt(operations, 'cost_class', operationsPath, ['cost_optimized', 'balanced', 'quality_optimized'], errors)
  enumAt(operations, 'budget_posture', operationsPath, ['cost_first', 'balanced', 'quality_first'], errors)
  enumAt(operations, 'latency_class', operationsPath, ['low_latency', 'standard', 'extended'], errors)
  enumAt(operations, 'reliability_class', operationsPath, ['standard', 'high'], errors)
  enumAt(operations, 'availability_requirement', operationsPath, ['standard', 'high'], errors)
  for (const field of ['cost_evidence_ref', 'latency_evidence_ref', 'reliability_evidence_ref'] as const) {
    stringAt(operations, field, operationsPath, errors, isCanonicalReference, 'Invalid canonical evidence reference.')
  }
  for (const field of ['retry_policy_ref', 'monitoring_profile_ref', 'capacity_policy_ref'] as const) {
    stringAt(operations, field, operationsPath, errors, item => VERSIONED_REFERENCE.test(item), 'Invalid versioned policy reference.')
  }

  const resolutionPath = '$.resolution'
  const resolutionFields = ['selection_priority', 'resolution_scope_ref', 'fallback_binding_refs'] as const
  const resolution = objectAt(root?.resolution, resolutionPath, resolutionFields, resolutionFields, errors)
  integerAt(resolution, 'selection_priority', resolutionPath, errors, 1)
  stringAt(resolution, 'resolution_scope_ref', resolutionPath, errors, item => VERSIONED_REFERENCE.test(item), 'Invalid resolution scope reference.')
  const fallbackReferences = validateBindingReferenceArray(resolution, 'fallback_binding_refs', resolutionPath, errors)
  if (bindingId && bindingRevision && fallbackReferences?.some(item => item.binding_id === bindingId && item.binding_revision === bindingRevision)) {
    addError(errors, 'SELF_REFERENCE', `${resolutionPath}.fallback_binding_refs`, 'A Binding cannot fall back to itself.')
  }

  validateGovernance(root?.governance, errors)

  if (errors.length > 0 || !root || !contractVersion || !bindingId || !bindingRevision) {
    return { accepted: false, errors: Object.freeze(errors) }
  }
  const binding = deepFreeze(structuredClone(root) as unknown as DeploymentBinding)
  return { accepted: true, binding, errors: [] }
}

export function validateDeploymentBindingRevisionCandidate(
  value: unknown,
  existingRecords: readonly DeploymentBinding[],
): DeploymentBindingValidationResult {
  const result = validateDeploymentBinding(value)
  if (!result.accepted) return result

  const errors: DeploymentBindingValidationError[] = []
  const lineage = existingRecords.filter(record => record.binding_id === result.binding.binding_id)
  if (lineage.length === 0 && result.binding.binding_revision !== 1) {
    addError(errors, 'INITIAL_REVISION_INVALID', '$.binding_revision', 'A new Binding lineage must begin at revision 1.')
  }
  if (lineage.some(record => record.binding_revision === result.binding.binding_revision)) {
    addError(errors, 'REVISION_REUSED', '$.binding_revision', 'A Binding revision number must never be reused or edited in place.')
  }
  const highestRevision = lineage.reduce((highest, record) => Math.max(highest, record.binding_revision), 0)
  if (highestRevision > 0 && result.binding.binding_revision <= highestRevision && !errors.some(error => error.code === 'REVISION_REUSED')) {
    addError(errors, 'REVISION_NOT_INCREASING', '$.binding_revision', 'A new revision must be greater than every existing revision in the lineage.')
  }
  return errors.length > 0 ? { accepted: false, errors: Object.freeze(errors) } : result
}
