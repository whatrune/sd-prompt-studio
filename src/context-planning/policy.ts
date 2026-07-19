import {
  CONTEXT_ORDERING_RULE_CONTRACT_VERSION,
  CONTEXT_POLICY_CONTRACT_VERSION,
  CONTEXT_POLICY_RULE_CONTRACT_VERSION,
  NO_SUPPORTING_ERRORS,
  deepFreezeClone,
  isRecord,
} from './supporting-contracts'
import type {
  ContextOrderingRuleV1,
  ContextOrderingRuleV1ValidationResult,
  ContextPolicyRuleV1,
  ContextPolicyRuleV1ValidationResult,
  ContextPolicyV1,
  ContextPolicyV1ValidationResult,
  SupportingContractValidationError,
  SupportingContractValidationResult,
} from './supporting-contracts'

type RecordValue = Record<string, unknown>

const OPAQUE_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/
const VERSIONED_REFERENCE = /^[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9][A-Za-z0-9._#-]*)+$/
const CANONICAL_REFERENCE = /^(?:https:\/\/github\.com\/[^\s]+|(?:docs|config|policies|evidence|profiles|assignments)\/[^\s]+)$/
const UTC_TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?Z$/
const SECRET_FIELD = /(?:^|_)(?:api_?key|secret|token|credential|password|cookie|private_?key)(?:_|$)/i
const SECRET_QUERY = /[?&](?:token|secret|api[_-]?key|credential|password)=/i
const PERSONAL_PATH = /^(?:file:\/\/|[A-Za-z]:[\\/]|\\\\|\/(?:Users|home)\/)/i
const PRIVATE_ENDPOINT = /^(?:https?:\/\/)?(?:localhost|127(?:\.\d{1,3}){3}|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}|\[?::1\]?)(?::|\/|$)/i

function hasOwn(record: RecordValue, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key)
}

function addError(errors: SupportingContractValidationError[], code: SupportingContractValidationError['code'], path: string, message: string): void {
  errors.push({ code, path, message })
}

function objectAt(value: unknown, path: string, required: readonly string[], allowed: readonly string[], errors: SupportingContractValidationError[]): RecordValue | undefined {
  if (!isRecord(value)) {
    addError(errors, 'invalid_value', path, 'Expected a closed object.')
    return undefined
  }
  for (const key of required) if (!hasOwn(value, key)) addError(errors, 'missing_field', `${path}.${key}`, 'Required field is missing.')
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) addError(errors, 'unknown_field', `${path}.${key}`, SECRET_FIELD.test(key) ? 'Secret-bearing fields are forbidden.' : 'Unknown field is forbidden.')
  }
  return value
}

function stringAt(record: RecordValue | undefined, key: string, path: string, errors: SupportingContractValidationError[], predicate: (value: string) => boolean = value => value.trim().length > 0, code: SupportingContractValidationError['code'] = 'invalid_value'): string | undefined {
  if (!record || !hasOwn(record, key)) return undefined
  const value = record[key]
  if (typeof value !== 'string' || !predicate(value)) {
    addError(errors, code, `${path}.${key}`, 'Expected an allowed non-empty string.')
    return undefined
  }
  return value
}

function referenceAllowed(value: string): boolean {
  return (VERSIONED_REFERENCE.test(value) || CANONICAL_REFERENCE.test(value))
    && !SECRET_QUERY.test(value) && !PERSONAL_PATH.test(value) && !PRIVATE_ENDPOINT.test(value)
}

function referenceAt(record: RecordValue | undefined, key: string, path: string, errors: SupportingContractValidationError[]): string | undefined {
  return stringAt(record, key, path, errors, referenceAllowed, 'invalid_reference')
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
  return month >= 1 && month <= 12 && day >= 1 && day <= new Date(Date.UTC(year, month, 0)).getUTCDate()
    && hour <= 23 && minute <= 59 && second <= 59
}

function referenceArrayAt(record: RecordValue | undefined, key: string, path: string, errors: SupportingContractValidationError[], nonEmpty = false): string[] | undefined {
  if (!record || !hasOwn(record, key)) return undefined
  const value = record[key]
  if (!Array.isArray(value)) {
    addError(errors, 'invalid_value', `${path}.${key}`, 'Expected an array.')
    return undefined
  }
  if (nonEmpty && value.length === 0) addError(errors, 'invalid_value', `${path}.${key}`, 'Expected a non-empty array.')
  const result: string[] = []
  const seen = new Set<string>()
  value.forEach((item, index) => {
    if (typeof item !== 'string' || !referenceAllowed(item)) addError(errors, 'invalid_reference', `${path}.${key}[${index}]`, 'Expected an allowed immutable reference.')
    else {
      if (seen.has(item)) addError(errors, 'duplicate_reference', `${path}.${key}[${index}]`, 'Duplicate references are forbidden.')
      seen.add(item)
      result.push(item)
    }
  })
  return result
}

function result<T>(value: unknown, errors: SupportingContractValidationError[]): SupportingContractValidationResult<T> {
  if (errors.length > 0) return Object.freeze({ accepted: false as const, errors: deepFreezeClone(errors) })
  return Object.freeze({ accepted: true as const, value: deepFreezeClone(value as T), errors: NO_SUPPORTING_ERRORS })
}

function validateRule(value: unknown, path: string, errors: SupportingContractValidationError[]): void {
  const fields = ['rule_contract_version', 'rule_id', 'rule_version', 'match', 'action', 'context_refs', 'priority', 'source_ref'] as const
  const record = objectAt(value, path, fields, fields, errors)
  stringAt(record, 'rule_contract_version', path, errors, item => item === CONTEXT_POLICY_RULE_CONTRACT_VERSION, 'inconsistent_identity')
  stringAt(record, 'rule_id', path, errors, item => OPAQUE_IDENTIFIER.test(item))
  stringAt(record, 'rule_version', path, errors, item => OPAQUE_IDENTIFIER.test(item))
  const match = record && hasOwn(record, 'match') ? objectAt(record.match, `${path}.match`, ['optional_context_ref'], ['optional_context_ref'], errors) : undefined
  const matchedRef = referenceAt(match, 'optional_context_ref', `${path}.match`, errors)
  stringAt(record, 'action', path, errors, item => item === 'include' || item === 'exclude')
  const contextRefs = referenceArrayAt(record, 'context_refs', path, errors, true) ?? []
  if (matchedRef && (contextRefs.length !== 1 || contextRefs[0] !== matchedRef)) {
    addError(errors, 'inconsistent_identity', `${path}.context_refs`, 'context_refs must contain exactly the matched Context reference.')
  }
  if (record && hasOwn(record, 'priority') && (!Number.isInteger(record.priority) || (record.priority as number) < 0 || (record.priority as number) > 1000)) {
    addError(errors, 'invalid_value', `${path}.priority`, 'Expected an integer priority from 0 through 1000.')
  }
  referenceAt(record, 'source_ref', path, errors)
}

export function validateContextPolicyRuleV1(value: unknown): ContextPolicyRuleV1ValidationResult {
  const errors: SupportingContractValidationError[] = []
  validateRule(value, '$', errors)
  return result<ContextPolicyRuleV1>(value, errors)
}

export function validateContextPolicyV1(value: unknown): ContextPolicyV1ValidationResult {
  const errors: SupportingContractValidationError[] = []
  const fields = ['context_policy_contract_version', 'context_policy_ref', 'policy_version', 'rules', 'ordering_rule_ref', 'evaluation_scope', 'created_from', 'evaluation_timestamp'] as const
  const record = objectAt(value, '$', fields, fields, errors)
  stringAt(record, 'context_policy_contract_version', '$', errors, item => item === CONTEXT_POLICY_CONTRACT_VERSION, 'inconsistent_identity')
  referenceAt(record, 'context_policy_ref', '$', errors)
  stringAt(record, 'policy_version', '$', errors, item => OPAQUE_IDENTIFIER.test(item))
  if (record && hasOwn(record, 'rules')) {
    if (!Array.isArray(record.rules)) addError(errors, 'invalid_value', '$.rules', 'Expected an array.')
    else record.rules.forEach((rule, index) => validateRule(rule, `$.rules[${index}]`, errors))
  }
  referenceAt(record, 'ordering_rule_ref', '$', errors)
  referenceArrayAt(record, 'evaluation_scope', '$', errors)
  referenceAt(record, 'created_from', '$', errors)
  stringAt(record, 'evaluation_timestamp', '$', errors, isUtcTimestamp)

  if (record && Array.isArray(record.rules)) {
    const ids = new Set<string>()
    const revisions = new Set<string>()
    record.rules.forEach((rule, index) => {
      if (!isRecord(rule)) return
      if (typeof rule.rule_id === 'string') {
        if (ids.has(rule.rule_id)) addError(errors, 'context_policy_conflict', `$.rules[${index}].rule_id`, 'Rule identifiers must be unique within a Policy.')
        ids.add(rule.rule_id)
      }
      if (typeof rule.rule_id === 'string' && typeof rule.rule_version === 'string') {
        const identity = `${rule.rule_id}\u0000${rule.rule_version}`
        if (revisions.has(identity)) addError(errors, 'context_policy_conflict', `$.rules[${index}].rule_version`, 'Rule identity and version pairs must be unique.')
        revisions.add(identity)
      }
    })
  }
  return result<ContextPolicyV1>(value, errors)
}

export function validateContextPolicySemantics(value: unknown, optionalContextRefs: readonly string[]): ContextPolicyV1ValidationResult {
  const structural = validateContextPolicyV1(value)
  if (!structural.accepted) return structural
  const errors: SupportingContractValidationError[] = []
  const candidates = [...optionalContextRefs].sort((left, right) => left < right ? -1 : left > right ? 1 : 0)
  const seen = new Set<string>()
  candidates.forEach((candidate, index) => {
    if (!referenceAllowed(candidate)) addError(errors, 'invalid_reference', `$.optional_context_refs[${index}]`, 'Expected an allowed immutable reference.')
    if (seen.has(candidate)) addError(errors, 'duplicate_reference', `$.optional_context_refs[${index}]`, 'Duplicate optional Context references are forbidden.')
    seen.add(candidate)
    const matches = structural.value.rules.filter(rule => rule.match.optional_context_ref === candidate)
    if (matches.length === 0) {
      addError(errors, 'context_policy_no_match', `$.optional_context_refs[${index}]`, 'No exact Context Policy rule matches this optional Context reference.')
      return
    }
    const highest = Math.max(...matches.map(rule => rule.priority))
    if (matches.filter(rule => rule.priority === highest).length !== 1) {
      addError(errors, 'context_policy_conflict', `$.optional_context_refs[${index}]`, 'More than one exact rule has the highest priority.')
    }
  })
  return result<ContextPolicyV1>(structural.value, errors)
}

function validateOrdering(value: unknown, path: string, errors: SupportingContractValidationError[]): void {
  const fields = ['ordering_rule_contract_version', 'ordering_rule_ref', 'ordering_version', 'rank_assignments', 'default_behavior'] as const
  const record = objectAt(value, path, fields, fields, errors)
  stringAt(record, 'ordering_rule_contract_version', path, errors, item => item === CONTEXT_ORDERING_RULE_CONTRACT_VERSION, 'inconsistent_identity')
  referenceAt(record, 'ordering_rule_ref', path, errors)
  stringAt(record, 'ordering_version', path, errors, item => OPAQUE_IDENTIFIER.test(item))
  stringAt(record, 'default_behavior', path, errors, item => item === 'require_explicit_rank')
  if (!record || !hasOwn(record, 'rank_assignments')) return
  if (!Array.isArray(record.rank_assignments)) {
    addError(errors, 'invalid_value', `${path}.rank_assignments`, 'Expected an array.')
    return
  }
  const refs = new Set<string>()
  const ranks = new Set<number>()
  record.rank_assignments.forEach((entry, index) => {
    const entryPath = `${path}.rank_assignments[${index}]`
    const rankEntry = objectAt(entry, entryPath, ['context_ref', 'rank'], ['context_ref', 'rank'], errors)
    const contextRef = referenceAt(rankEntry, 'context_ref', entryPath, errors)
    if (contextRef) {
      if (refs.has(contextRef)) addError(errors, 'invalid_context_order', `${entryPath}.context_ref`, 'Each Context reference must have exactly one rank.')
      refs.add(contextRef)
    }
    if (rankEntry && hasOwn(rankEntry, 'rank')) {
      const rank = rankEntry.rank
      if (!Number.isInteger(rank) || (rank as number) < 0) addError(errors, 'invalid_value', `${entryPath}.rank`, 'Expected a non-negative integer rank.')
      else {
        if (ranks.has(rank as number)) addError(errors, 'invalid_context_order', `${entryPath}.rank`, 'Duplicate ranks are forbidden.')
        ranks.add(rank as number)
      }
    }
  })
}

export function validateContextOrderingRuleV1(value: unknown): ContextOrderingRuleV1ValidationResult {
  const errors: SupportingContractValidationError[] = []
  validateOrdering(value, '$', errors)
  return result<ContextOrderingRuleV1>(value, errors)
}

export function validateContextOrderingSemantics(value: unknown, plannedContextRefs: readonly string[]): ContextOrderingRuleV1ValidationResult {
  const structural = validateContextOrderingRuleV1(value)
  if (!structural.accepted) return structural
  const errors: SupportingContractValidationError[] = []
  const entries = new Map(structural.value.rank_assignments.map(entry => [entry.context_ref, entry.rank]))
  const seen = new Set<string>()
  ;[...plannedContextRefs].sort((left, right) => left < right ? -1 : left > right ? 1 : 0).forEach((reference, index) => {
    if (!referenceAllowed(reference)) addError(errors, 'invalid_reference', `$.planned_context_refs[${index}]`, 'Expected an allowed immutable reference.')
    if (seen.has(reference)) addError(errors, 'duplicate_reference', `$.planned_context_refs[${index}]`, 'Duplicate planned Context references are forbidden.')
    seen.add(reference)
    if (!entries.has(reference)) addError(errors, 'invalid_context_order', `$.planned_context_refs[${index}]`, 'Every planned Context reference requires an explicit rank.')
  })
  return result<ContextOrderingRuleV1>(structural.value, errors)
}
