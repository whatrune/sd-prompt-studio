import { LOGICAL_TIERS, REASONING_LEVELS } from '../deployment-binding'
import {
  CANONICAL_ROUTING_ROLES,
  CLASSIFICATION_LEVELS,
  LATENCY_POSTURES,
  MODEL_ROUTING_CONTRACT_VERSION,
  ROUTING_FAILURE_CODES,
  ROUTING_FAILURE_STAGES,
  ROUTING_FAILURE_STATUSES,
} from './types'
import type {
  DeepReadonly,
  ModelRoutingContractValidationError,
  RoutingDecision,
  RoutingDecisionValidationResult,
  RoutingFailure,
  RoutingFailureValidationResult,
  RoutingInput,
  RoutingInputValidationResult,
} from './types'

type RecordValue = Record<string, unknown>

const OPAQUE_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/
const VERSIONED_REFERENCE = /^[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)+$/
const CANONICAL_REFERENCE = /^(?:https:\/\/github\.com\/[^\s]+|(?:docs|config|policies|evidence|profiles)\/[^\s]+)$/
const JSON_PATH = /^\$(?:\.[A-Za-z_][A-Za-z0-9_]*|\[\d+\])*$/
const UTC_TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?Z$/
const SECRET_FIELD = /(?:^|_)(?:api_?key|secret|token|credential|password|cookie|private_?key)(?:_|$)/i
const SECRET_QUERY = /[?&](?:token|secret|api[_-]?key|credential|password)=/i
const SECRET_TEXT = /(?:api[_ -]?key|secret|credential|password|private[_ -]?key)\s*[:=]/i

function isRecord(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasOwn(record: RecordValue, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key)
}

function addError(
  errors: ModelRoutingContractValidationError[],
  code: ModelRoutingContractValidationError['code'],
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
  errors: ModelRoutingContractValidationError[],
): RecordValue | undefined {
  if (!isRecord(value)) {
    addError(errors, 'INVALID_TYPE', path, 'Expected a closed object.')
    return undefined
  }
  for (const key of required) {
    if (!hasOwn(value, key)) addError(errors, 'MISSING_FIELD', `${path}.${key}`, 'Required field is missing.')
  }
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      const secret = SECRET_FIELD.test(key)
      addError(errors, secret ? 'SECRET_FIELD' : 'UNKNOWN_FIELD', `${path}.${key}`, secret ? 'Secret-bearing fields are forbidden.' : 'Unknown field is forbidden.')
    }
  }
  return value
}

function stringAt(
  record: RecordValue | undefined,
  key: string,
  path: string,
  errors: ModelRoutingContractValidationError[],
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

function enumAt(
  record: RecordValue | undefined,
  key: string,
  path: string,
  values: readonly string[],
  errors: ModelRoutingContractValidationError[],
): string | undefined {
  return stringAt(record, key, path, errors, value => values.includes(value), `Expected one of: ${values.join(', ')}.`)
}

function isUtcTimestamp(value: string): boolean {
  const match = UTC_TIMESTAMP.exec(value)
  if (!match) return false
  const [, yearText, monthText, dayText, hourText, minuteText, secondText] = match
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const hour = Number(hourText)
  const minute = Number(minuteText)
  const second = Number(secondText)
  if (month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) return false
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return day >= 1 && day <= daysInMonth
}

function timestampAt(record: RecordValue | undefined, key: string, path: string, errors: ModelRoutingContractValidationError[]): string | undefined {
  return stringAt(record, key, path, errors, isUtcTimestamp, 'Expected a valid RFC 3339 UTC timestamp.')
}

function trustedReference(value: string): boolean {
  return (VERSIONED_REFERENCE.test(value) || CANONICAL_REFERENCE.test(value)) && !SECRET_QUERY.test(value)
}

function referenceAt(record: RecordValue | undefined, key: string, path: string, errors: ModelRoutingContractValidationError[]): string | undefined {
  return stringAt(record, key, path, errors, trustedReference, 'Expected a trusted versioned or canonical reference without secret-bearing query data.')
}

function stringArrayAt(
  record: RecordValue | undefined,
  key: string,
  path: string,
  errors: ModelRoutingContractValidationError[],
  options: { readonly nonEmpty?: boolean; readonly references?: boolean } = {},
): string[] | undefined {
  if (!record || !hasOwn(record, key)) return undefined
  const value = record[key]
  if (!Array.isArray(value)) {
    addError(errors, 'INVALID_TYPE', `${path}.${key}`, 'Expected an array.')
    return undefined
  }
  if (options.nonEmpty && value.length === 0) addError(errors, 'INVALID_VALUE', `${path}.${key}`, 'Expected a non-empty array.')
  const accepted: string[] = []
  const seen = new Set<string>()
  for (const [index, item] of value.entries()) {
    const valid = typeof item === 'string' && item.trim().length > 0 && (!options.references || trustedReference(item))
    if (!valid) {
      addError(errors, 'INVALID_VALUE', `${path}.${key}[${index}]`, options.references ? 'Expected a trusted reference.' : 'Expected a non-empty string.')
      continue
    }
    if (seen.has(item)) addError(errors, 'DUPLICATE_VALUE', `${path}.${key}[${index}]`, 'Duplicate values are forbidden.')
    seen.add(item)
    accepted.push(item)
  }
  return accepted
}

function sourcedClassification(
  value: unknown,
  path: string,
  errors: ModelRoutingContractValidationError[],
  allowedValues?: readonly string[],
): void {
  const record = objectAt(value, path, ['value', 'source_ref'], ['value', 'source_ref'], errors)
  if (allowedValues) enumAt(record, 'value', path, allowedValues, errors)
  else stringAt(record, 'value', path, errors, item => OPAQUE_IDENTIFIER.test(item), 'Expected an approved taxonomy identifier.')
  referenceAt(record, 'source_ref', path, errors)
}

function structuredOutputRequirement(value: unknown, path: string, errors: ModelRoutingContractValidationError[]): void {
  const record = objectAt(value, path, ['mode'], ['mode', 'profile_refs'], errors)
  const mode = enumAt(record, 'mode', path, ['none', 'required'], errors)
  if (!record) return
  if (mode === 'required') {
    if (!hasOwn(record, 'profile_refs')) addError(errors, 'MISSING_FIELD', `${path}.profile_refs`, 'Required field is missing.')
    else stringArrayAt(record, 'profile_refs', path, errors, { nonEmpty: true, references: true })
  } else if (mode === 'none' && hasOwn(record, 'profile_refs')) {
    addError(errors, 'INCONSISTENT_VALUE', `${path}.profile_refs`, 'profile_refs is forbidden when mode is none.')
  }
}

function contextRequirement(value: unknown, path: string, errors: ModelRoutingContractValidationError[]): void {
  const fields = ['required_context_refs', 'optional_context_refs', 'forbidden_context_categories', 'source_ref'] as const
  const record = objectAt(value, path, fields, fields, errors)
  stringArrayAt(record, 'required_context_refs', path, errors, { nonEmpty: true, references: true })
  stringArrayAt(record, 'optional_context_refs', path, errors, { references: true })
  stringArrayAt(record, 'forbidden_context_categories', path, errors)
  referenceAt(record, 'source_ref', path, errors)
}

function securityRequirement(value: unknown, path: string, errors: ModelRoutingContractValidationError[]): void {
  const fields = ['policy_refs', 'source_ref'] as const
  const record = objectAt(value, path, fields, fields, errors)
  stringArrayAt(record, 'policy_refs', path, errors, { nonEmpty: true, references: true })
  referenceAt(record, 'source_ref', path, errors)
}

function commonIdentity(record: RecordValue | undefined, path: string, errors: ModelRoutingContractValidationError[]): void {
  enumAt(record, 'routing_contract_version', path, [MODEL_ROUTING_CONTRACT_VERSION], errors)
  stringAt(record, 'task_id', path, errors, value => OPAQUE_IDENTIFIER.test(value), 'Expected an opaque Task identifier.')
  referenceAt(record, 'assignment_revision', path, errors)
}

function deepFreezeClone<T>(value: T): DeepReadonly<T> {
  if (Array.isArray(value)) {
    return Object.freeze(value.map(item => deepFreezeClone(item))) as DeepReadonly<T>
  }
  if (isRecord(value)) {
    const clone: RecordValue = {}
    for (const [key, item] of Object.entries(value)) clone[key] = deepFreezeClone(item)
    return Object.freeze(clone) as DeepReadonly<T>
  }
  return value as DeepReadonly<T>
}

function rejected(errors: ModelRoutingContractValidationError[]) {
  return Object.freeze({ accepted: false as const, errors: deepFreezeClone(errors) })
}

const NO_ERRORS = Object.freeze([]) as readonly []

export function validateRoutingInput(value: unknown): RoutingInputValidationResult {
  const errors: ModelRoutingContractValidationError[] = []
  const fields = [
    'routing_contract_version', 'task_id', 'assignment_revision', 'canonical_record', 'assigned_role', 'task_type',
    'complexity', 'risk_level', 'required_output_type', 'structured_output_requirement', 'context_requirement',
    'validation_requirement', 'latency_requirement', 'security_requirement', 'routing_policy_ref', 'response_policy_ref',
    'evaluation_timestamp',
  ] as const
  const record = objectAt(value, '$', fields, fields, errors)
  commonIdentity(record, '$', errors)
  referenceAt(record, 'canonical_record', '$', errors)
  enumAt(record, 'assigned_role', '$', CANONICAL_ROUTING_ROLES, errors)
  if (record) {
    sourcedClassification(record.task_type, '$.task_type', errors)
    sourcedClassification(record.complexity, '$.complexity', errors, CLASSIFICATION_LEVELS)
    sourcedClassification(record.risk_level, '$.risk_level', errors)
    sourcedClassification(record.required_output_type, '$.required_output_type', errors)
    structuredOutputRequirement(record.structured_output_requirement, '$.structured_output_requirement', errors)
    contextRequirement(record.context_requirement, '$.context_requirement', errors)
    sourcedClassification(record.latency_requirement, '$.latency_requirement', errors, LATENCY_POSTURES)
    securityRequirement(record.security_requirement, '$.security_requirement', errors)
  }
  referenceAt(record, 'validation_requirement', '$', errors)
  referenceAt(record, 'routing_policy_ref', '$', errors)
  referenceAt(record, 'response_policy_ref', '$', errors)
  timestampAt(record, 'evaluation_timestamp', '$', errors)
  if (errors.length > 0) return rejected(errors)
  const input = deepFreezeClone(value as RoutingInput)
  return Object.freeze({ accepted: true, input, value: input, errors: NO_ERRORS })
}

export function validateRoutingDecision(value: unknown): RoutingDecisionValidationResult {
  const errors: ModelRoutingContractValidationError[] = []
  const fields = [
    'routing_contract_version', 'task_id', 'assignment_revision', 'logical_tier', 'required_reasoning_level',
    'capability_floor_ref', 'response_profile_ref', 'context_policy_ref', 'required_context_refs',
    'optional_context_refs', 'forbidden_context_categories', 'required_structured_output_profile_refs',
    'required_tool_profile_refs', 'latency_policy_ref', 'cost_policy_ref', 'security_policy_refs',
    'validation_policy_ref', 'applied_rule_refs', 'decision_rationale', 'evaluation_timestamp',
  ] as const
  const record = objectAt(value, '$', fields, fields, errors)
  commonIdentity(record, '$', errors)
  enumAt(record, 'logical_tier', '$', LOGICAL_TIERS, errors)
  enumAt(record, 'required_reasoning_level', '$', REASONING_LEVELS, errors)
  for (const key of ['capability_floor_ref', 'response_profile_ref', 'context_policy_ref', 'latency_policy_ref', 'cost_policy_ref', 'validation_policy_ref'] as const) {
    referenceAt(record, key, '$', errors)
  }
  stringArrayAt(record, 'required_context_refs', '$', errors, { nonEmpty: true, references: true })
  stringArrayAt(record, 'optional_context_refs', '$', errors, { references: true })
  stringArrayAt(record, 'forbidden_context_categories', '$', errors)
  stringArrayAt(record, 'required_structured_output_profile_refs', '$', errors, { references: true })
  stringArrayAt(record, 'required_tool_profile_refs', '$', errors, { references: true })
  stringArrayAt(record, 'security_policy_refs', '$', errors, { nonEmpty: true, references: true })
  stringArrayAt(record, 'applied_rule_refs', '$', errors, { nonEmpty: true, references: true })
  stringAt(record, 'decision_rationale', '$', errors, text => text.trim().length > 0 && !SECRET_TEXT.test(text), 'Expected a non-empty sanitized rationale.')
  timestampAt(record, 'evaluation_timestamp', '$', errors)
  if (errors.length > 0) return rejected(errors)
  const decision = deepFreezeClone(value as RoutingDecision)
  return Object.freeze({ accepted: true, decision, value: decision, errors: NO_ERRORS })
}

export function validateRoutingFailure(value: unknown): RoutingFailureValidationResult {
  const errors: ModelRoutingContractValidationError[] = []
  const fields = [
    'routing_contract_version', 'task_id', 'assignment_revision', 'status', 'failure_code', 'failed_stage', 'path',
    'message', 'affected_ref', 'decision_owner', 'recommended_next_action', 'evaluation_timestamp',
  ] as const
  const record = objectAt(value, '$', fields, fields, errors)
  commonIdentity(record, '$', errors)
  const status = enumAt(record, 'status', '$', ROUTING_FAILURE_STATUSES, errors)
  const code = enumAt(record, 'failure_code', '$', ROUTING_FAILURE_CODES, errors)
  enumAt(record, 'failed_stage', '$', ROUTING_FAILURE_STAGES, errors)
  stringAt(record, 'path', '$', errors, item => JSON_PATH.test(item), 'Expected a JSON-style contract path.')
  stringAt(record, 'message', '$', errors, item => item.trim().length > 0 && !SECRET_TEXT.test(item), 'Expected a non-empty sanitized message.')
  referenceAt(record, 'affected_ref', '$', errors)
  stringAt(record, 'decision_owner', '$', errors)
  stringAt(record, 'recommended_next_action', '$', errors)
  timestampAt(record, 'evaluation_timestamp', '$', errors)
  if (status === 'failed' && code !== undefined && code !== 'internal_failure') {
    addError(errors, 'INCONSISTENT_VALUE', '$.failure_code', 'failed status is reserved for internal_failure.')
  }
  if (status === 'blocked' && code === 'internal_failure') {
    addError(errors, 'INCONSISTENT_VALUE', '$.failure_code', 'internal_failure requires failed status.')
  }
  if (errors.length > 0) return rejected(errors)
  const failure = deepFreezeClone(value as RoutingFailure)
  return Object.freeze({ accepted: true, failure, value: failure, errors: NO_ERRORS })
}
