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

function result<T>(value: unknown, errors: SupportingContractValidationError[]): SupportingContractValidationResult<T> {
  if (errors.length > 0) return Object.freeze({ accepted: false as const, errors: deepFreezeClone(errors) })
  return Object.freeze({ accepted: true as const, value: deepFreezeClone(value as T), errors: NO_SUPPORTING_ERRORS })
}

function validateOptionalRule(value: unknown, path: string, errors: SupportingContractValidationError[]): void {
  const fields = ['rule_contract_version', 'rule_id', 'rule_revision', 'rule_ref', 'policy_ref', 'match', 'action', 'priority', 'source_ref'] as const
  const record = objectAt(value, path, fields, fields, errors)
  stringAt(record, 'rule_contract_version', path, errors, item => item === CONTEXT_POLICY_RULE_CONTRACT_VERSION, 'inconsistent_identity')
  stringAt(record, 'rule_id', path, errors, item => OPAQUE_IDENTIFIER.test(item))
  stringAt(record, 'rule_revision', path, errors, item => OPAQUE_IDENTIFIER.test(item))
  referenceAt(record, 'rule_ref', path, errors)
  referenceAt(record, 'policy_ref', path, errors)
  const match = record && hasOwn(record, 'match') ? objectAt(record.match, `${path}.match`, ['optional_context_ref'], ['optional_context_ref'], errors) : undefined
  referenceAt(match, 'optional_context_ref', `${path}.match`, errors)
  stringAt(record, 'action', path, errors, item => item === 'include' || item === 'exclude')
  if (record && hasOwn(record, 'priority') && (!Number.isInteger(record.priority) || (record.priority as number) < 0 || (record.priority as number) > 1000)) {
    addError(errors, 'invalid_value', `${path}.priority`, 'Expected an integer priority from 0 through 1000.')
  }
  referenceAt(record, 'source_ref', path, errors)
}

function validateOrderingRule(value: unknown, path: string, errors: SupportingContractValidationError[]): void {
  const fields = ['rule_contract_version', 'rule_id', 'rule_revision', 'rule_ref', 'policy_ref', 'strategy', 'rank_entries', 'source_ref'] as const
  const record = objectAt(value, path, fields, fields, errors)
  stringAt(record, 'rule_contract_version', path, errors, item => item === CONTEXT_ORDERING_RULE_CONTRACT_VERSION, 'inconsistent_identity')
  stringAt(record, 'rule_id', path, errors, item => OPAQUE_IDENTIFIER.test(item))
  stringAt(record, 'rule_revision', path, errors, item => OPAQUE_IDENTIFIER.test(item))
  referenceAt(record, 'rule_ref', path, errors)
  referenceAt(record, 'policy_ref', path, errors)
  stringAt(record, 'strategy', path, errors, item => item === 'explicit_rank')
  referenceAt(record, 'source_ref', path, errors)
  if (!record || !hasOwn(record, 'rank_entries')) return
  if (!Array.isArray(record.rank_entries)) {
    addError(errors, 'invalid_value', `${path}.rank_entries`, 'Expected an array.')
    return
  }
  const refs = new Set<string>()
  const ranks = new Set<number>()
  record.rank_entries.forEach((entry, index) => {
    const entryPath = `${path}.rank_entries[${index}]`
    const rankEntry = objectAt(entry, entryPath, ['context_ref', 'rank'], ['context_ref', 'rank'], errors)
    const contextRef = referenceAt(rankEntry, 'context_ref', entryPath, errors)
    if (contextRef) {
      if (refs.has(contextRef)) addError(errors, 'invalid_context_order', `${entryPath}.context_ref`, 'Each Context reference must have exactly one rank entry.')
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

function validatePolicySnapshot(value: unknown, expectedContextPolicyRef: string | undefined): ContextPolicyV1ValidationResult {
  const errors: SupportingContractValidationError[] = []
  const fields = ['context_policy_contract_version', 'context_policy_ref', 'policy_revision', 'optional_context_rules', 'ordering_rule', 'source_ref', 'approval_ref'] as const
  const record = objectAt(value, '$', fields, fields, errors)
  stringAt(record, 'context_policy_contract_version', '$', errors, item => item === CONTEXT_POLICY_CONTRACT_VERSION, 'inconsistent_identity')
  const policyRef = referenceAt(record, 'context_policy_ref', '$', errors)
  stringAt(record, 'policy_revision', '$', errors, item => OPAQUE_IDENTIFIER.test(item))
  referenceAt(record, 'source_ref', '$', errors)
  referenceAt(record, 'approval_ref', '$', errors)

  if (expectedContextPolicyRef !== undefined) {
    if (!referenceAllowed(expectedContextPolicyRef)) addError(errors, 'invalid_reference', '$.expected_context_policy_ref', 'Expected an allowed immutable Policy reference.')
    else if (policyRef !== expectedContextPolicyRef) addError(errors, 'inconsistent_identity', '$.context_policy_ref', 'Context Policy reference does not match the expected routed reference.')
  }

  const optionalRules = record?.optional_context_rules
  if (!Array.isArray(optionalRules)) {
    if (record && hasOwn(record, 'optional_context_rules')) addError(errors, 'invalid_value', '$.optional_context_rules', 'Expected an array.')
  } else optionalRules.forEach((rule, index) => validateOptionalRule(rule, `$.optional_context_rules[${index}]`, errors))

  const orderingRule = record && hasOwn(record, 'ordering_rule') ? record.ordering_rule : undefined
  if (orderingRule !== undefined) validateOrderingRule(orderingRule, '$.ordering_rule', errors)

  if (policyRef && Array.isArray(optionalRules)) {
    optionalRules.forEach((rule, index) => {
      if (isRecord(rule) && rule.policy_ref !== policyRef) addError(errors, 'inconsistent_identity', `$.optional_context_rules[${index}].policy_ref`, 'Child Policy reference must equal the parent Context Policy reference.')
    })
    if (isRecord(orderingRule) && orderingRule.policy_ref !== policyRef) addError(errors, 'inconsistent_identity', '$.ordering_rule.policy_ref', 'Ordering Policy reference must equal the parent Context Policy reference.')
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
        if (ids.has(rule.rule_id)) addError(errors, 'context_policy_conflict', `${path}.rule_id`, 'Rule identifiers must be unique across the whole Policy Snapshot.')
        ids.add(rule.rule_id)
      }
      if (typeof rule.rule_id === 'string' && typeof rule.rule_revision === 'string') {
        const identity = `${rule.rule_id}\u0000${rule.rule_revision}`
        if (revisions.has(identity)) addError(errors, 'context_policy_conflict', `${path}.rule_revision`, 'Rule identity and revision pairs must be unique.')
        revisions.add(identity)
      }
      if (typeof rule.rule_ref === 'string') {
        if (refs.has(rule.rule_ref)) addError(errors, 'context_policy_conflict', `${path}.rule_ref`, 'Rule references must be unique across the whole Policy Snapshot.')
        refs.add(rule.rule_ref)
      }
    })
  }
  return result<ContextPolicyV1>(value, errors)
}

export function compareContextReferencesUtf8(left: string, right: string): number {
  const encoder = new TextEncoder()
  const leftBytes = encoder.encode(left)
  const rightBytes = encoder.encode(right)
  const length = Math.min(leftBytes.length, rightBytes.length)
  for (let index = 0; index < length; index += 1) {
    if (leftBytes[index] !== rightBytes[index]) return leftBytes[index] - rightBytes[index]
  }
  return leftBytes.length - rightBytes.length
}

export function validateContextPolicyRuleV1(value: unknown): ContextPolicyRuleV1ValidationResult {
  const errors: SupportingContractValidationError[] = []
  validateOptionalRule(value, '$', errors)
  return result<ContextPolicyRuleV1>(value, errors)
}

export function validateContextOrderingRuleV1(value: unknown): ContextOrderingRuleV1ValidationResult {
  const errors: SupportingContractValidationError[] = []
  validateOrderingRule(value, '$', errors)
  return result<ContextOrderingRuleV1>(value, errors)
}

export function validateContextPolicyV1(value: unknown, expectedContextPolicyRef?: string): ContextPolicyV1ValidationResult {
  return validatePolicySnapshot(value, expectedContextPolicyRef)
}

export function validateContextPolicySnapshot(value: unknown, expectedContextPolicyRef: string): ContextPolicyV1ValidationResult {
  return validatePolicySnapshot(value, expectedContextPolicyRef)
}

export function validateContextPolicySemantics(value: unknown, expectedContextPolicyRef: string, optionalContextRefs: readonly string[]): ContextPolicyV1ValidationResult {
  const snapshot = validatePolicySnapshot(value, expectedContextPolicyRef)
  if (!snapshot.accepted) return snapshot
  const errors: SupportingContractValidationError[] = []
  const seen = new Set<string>()
  const candidates = [...optionalContextRefs].sort(compareContextReferencesUtf8)
  candidates.forEach((candidate, index) => {
    if (!referenceAllowed(candidate)) addError(errors, 'invalid_reference', `$.optional_context_refs[${index}]`, 'Expected an allowed immutable reference.')
    if (seen.has(candidate)) addError(errors, 'duplicate_reference', `$.optional_context_refs[${index}]`, 'Duplicate optional Context references are forbidden.')
    seen.add(candidate)
    const matches = snapshot.value.optional_context_rules.filter(rule => rule.match.optional_context_ref === candidate)
    if (matches.length === 0) {
      addError(errors, 'context_policy_no_match', `$.optional_context_refs[${index}]`, 'No exact Context Policy rule matches this optional Context reference.')
      return
    }
    const highest = Math.max(...matches.map(rule => rule.priority))
    if (matches.filter(rule => rule.priority === highest).length !== 1) {
      addError(errors, 'context_policy_conflict', `$.optional_context_refs[${index}]`, 'More than one exact rule has the highest priority.')
    }
  })
  return result<ContextPolicyV1>(snapshot.value, errors)
}

export function validateContextOrderingSemantics(value: unknown, plannedContextRefs: readonly string[]): ContextOrderingRuleV1ValidationResult {
  const structural = validateContextOrderingRuleV1(value)
  if (!structural.accepted) return structural
  const errors: SupportingContractValidationError[] = []
  const entries = new Map(structural.value.rank_entries.map(entry => [entry.context_ref, entry.rank]))
  const plannedRanks = new Map<number, string>()
  const seen = new Set<string>()
  ;[...plannedContextRefs].sort(compareContextReferencesUtf8).forEach((reference, index) => {
    if (!referenceAllowed(reference)) addError(errors, 'invalid_reference', `$.planned_context_refs[${index}]`, 'Expected an allowed immutable reference.')
    if (seen.has(reference)) addError(errors, 'duplicate_reference', `$.planned_context_refs[${index}]`, 'Duplicate planned Context references are forbidden.')
    seen.add(reference)
    const rank = entries.get(reference)
    if (rank === undefined) addError(errors, 'invalid_context_order', `$.planned_context_refs[${index}]`, 'Every planned Context reference requires an explicit rank.')
    else {
      if (plannedRanks.has(rank) && plannedRanks.get(rank) !== reference) addError(errors, 'invalid_context_order', `$.planned_context_refs[${index}]`, 'Planned Context references must have unique ranks.')
      plannedRanks.set(rank, reference)
    }
  })
  return result<ContextOrderingRuleV1>(structural.value, errors)
}
