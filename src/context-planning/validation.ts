import {
  CONTEXT_PLAN_CONTRACT_VERSION,
  CONTEXT_PLANNING_FAILURE_CODES,
  CONTEXT_PLANNING_FAILURE_STAGES,
} from './types'
import type {
  ContextPlan,
  ContextPlanningFailure,
  ContextPlanningFailureCode,
  ContextPlanningFailureStage,
  ContextPlanningFailureValidationResult,
  ContextPlanValidationError,
  ContextPlanValidationResult,
  DeepReadonly,
} from './types'
import {
  CONTEXT_PLANNING_DECISION_OWNERS,
  CONTEXT_PLANNING_FAILURE_CONTRACT_VERSION,
  CONTEXT_PLANNING_FAILURE_V1_MAPPINGS,
  CONTEXT_PLANNING_FAILURE_V1_CODES,
  CONTEXT_PLANNING_FAILURE_V1_STAGES,
  CONTEXT_PLANNING_NEXT_ACTIONS,
  CONTEXT_PLANNING_RETRY_POLICIES,
  NO_SUPPORTING_ERRORS,
} from './supporting-contracts'
import type {
  ContextPlanningFailureV1,
  ContextPlanningFailureV1ValidationResult,
  SupportingContractValidationError,
} from './supporting-contracts'

type RecordValue = Record<string, unknown>

const ROUTING_CONTRACT_VERSION = 'model_routing_v1'
const OPAQUE_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/
const VERSIONED_REFERENCE = /^[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9][A-Za-z0-9._#-]*)+$/
const CANONICAL_REFERENCE = /^(?:https:\/\/github\.com\/[^\s]+|(?:docs|config|policies|evidence|profiles|assignments)\/[^\s]+)$/
const CATEGORY = /^[a-z][a-z0-9_-]*$/
const JSON_PATH = /^\$(?:\.[A-Za-z_][A-Za-z0-9_]*|\[\d+\])*$/
const UTC_TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?Z$/
const SECRET_FIELD = /(?:^|_)(?:api_?key|secret|token|credential|password|cookie|private_?key)(?:_|$)/i
const SECRET_QUERY = /[?&](?:token|secret|api[_-]?key|credential|password)=/i
const SECRET_TEXT = /(?:api[_ -]?key|secret|credential|password|private[_ -]?key)\s*[:=]/i
const PERSONAL_PATH = /^(?:file:\/\/|[A-Za-z]:[\\/]|\\\\|\/(?:Users|home)\/)/i
const PRIVATE_ENDPOINT = /^(?:https?:\/\/)?(?:localhost|127(?:\.\d{1,3}){3}|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}|\[?::1\]?)(?::|\/|$)/i

function isRecord(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasOwn(record: RecordValue, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key)
}

function addError(
  errors: ContextPlanValidationError[],
  code: ContextPlanningFailureCode,
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
  errors: ContextPlanValidationError[],
): RecordValue | undefined {
  if (!isRecord(value)) {
    addError(errors, 'invalid_value', path, 'Expected a closed object.')
    return undefined
  }
  for (const key of required) {
    if (!hasOwn(value, key)) addError(errors, 'missing_field', `${path}.${key}`, 'Required field is missing.')
  }
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      addError(
        errors,
        'unknown_field',
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
  errors: ContextPlanValidationError[],
  predicate: (value: string) => boolean = value => value.trim().length > 0,
  code: ContextPlanningFailureCode = 'invalid_value',
  message = 'Expected a non-empty string.',
): string | undefined {
  if (!record || !hasOwn(record, key)) return undefined
  const value = record[key]
  if (typeof value !== 'string' || !predicate(value)) {
    addError(errors, code, `${path}.${key}`, message)
    return undefined
  }
  return value
}

function enumAt(
  record: RecordValue | undefined,
  key: string,
  path: string,
  values: readonly string[],
  errors: ContextPlanValidationError[],
  code: ContextPlanningFailureCode = 'invalid_value',
): string | undefined {
  return stringAt(record, key, path, errors, value => values.includes(value), code, `Expected one of: ${values.join(', ')}.`)
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
  return day >= 1 && day <= new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function referenceAllowed(value: string): boolean {
  return (VERSIONED_REFERENCE.test(value) || CANONICAL_REFERENCE.test(value))
    && !SECRET_QUERY.test(value)
    && !PERSONAL_PATH.test(value)
    && !PRIVATE_ENDPOINT.test(value)
}

function referenceAt(record: RecordValue | undefined, key: string, path: string, errors: ContextPlanValidationError[]): string | undefined {
  return stringAt(record, key, path, errors, referenceAllowed, 'invalid_reference', 'Expected an allowed immutable reference without Secret, private endpoint, or personal path data.')
}

function timestampAt(record: RecordValue | undefined, key: string, path: string, errors: ContextPlanValidationError[]): string | undefined {
  return stringAt(record, key, path, errors, isUtcTimestamp, 'invalid_value', 'Expected a valid RFC 3339 UTC timestamp.')
}

function stringArrayAt(
  record: RecordValue | undefined,
  key: string,
  path: string,
  errors: ContextPlanValidationError[],
  options: { readonly references?: boolean; readonly nonEmpty?: boolean; readonly categories?: boolean } = {},
): string[] | undefined {
  if (!record || !hasOwn(record, key)) return undefined
  const value = record[key]
  if (!Array.isArray(value)) {
    addError(errors, 'invalid_value', `${path}.${key}`, 'Expected an array.')
    return undefined
  }
  if (options.nonEmpty && value.length === 0) addError(errors, 'invalid_value', `${path}.${key}`, 'Expected a non-empty array.')
  const accepted: string[] = []
  const seen = new Set<string>()
  for (const [index, item] of value.entries()) {
    const valid = typeof item === 'string'
      && item.trim().length > 0
      && (!options.references || referenceAllowed(item))
      && (!options.categories || CATEGORY.test(item))
    if (!valid) {
      addError(errors, options.references ? 'invalid_reference' : 'invalid_value', `${path}.${key}[${index}]`, options.references ? 'Expected an allowed immutable reference.' : 'Expected an allowed non-empty value.')
      continue
    }
    if (seen.has(item)) addError(errors, 'duplicate_reference', `${path}.${key}[${index}]`, 'Duplicate values are forbidden.')
    seen.add(item)
    accepted.push(item)
  }
  return accepted
}

function addCrossSetError(
  values: readonly string[],
  other: ReadonlySet<string>,
  path: string,
  errors: ContextPlanValidationError[],
  code: ContextPlanningFailureCode,
  message: string,
): void {
  values.forEach((value, index) => {
    if (other.has(value)) addError(errors, code, `${path}[${index}]`, message)
  })
}

function normalizedCategoryValue(value: string): string {
  return `_${value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')}_`
}

function matchesForbiddenCategory(reference: string, category: string): boolean {
  return normalizedCategoryValue(reference).includes(`_${category}_`)
}

function deepFreezeClone<T>(value: T): DeepReadonly<T> {
  if (Array.isArray(value)) return Object.freeze(value.map(item => deepFreezeClone(item))) as DeepReadonly<T>
  if (isRecord(value)) {
    const clone: RecordValue = {}
    for (const [key, item] of Object.entries(value)) clone[key] = deepFreezeClone(item)
    return Object.freeze(clone) as DeepReadonly<T>
  }
  return value as DeepReadonly<T>
}

const NO_ERRORS = Object.freeze([]) as readonly []

function safeString(value: unknown, key: string, predicate: (item: string) => boolean): string | undefined {
  try {
    if (!isRecord(value)) return undefined
    const item = value[key]
    return typeof item === 'string' && predicate(item) ? item : undefined
  } catch {
    return undefined
  }
}

function stageFor(code: ContextPlanningFailureCode): ContextPlanningFailureStage {
  if (code === 'inconsistent_identity') return 'identity_validation'
  if (code === 'invalid_reference') return 'reference_validation'
  if (code === 'invalid_context_order') return 'order_validation'
  if (code === 'forbidden_context') return 'security_validation'
  return 'set_validation'
}

function failureFromErrors(value: unknown, errors: readonly ContextPlanValidationError[]): DeepReadonly<ContextPlanningFailure> {
  const first = errors[0] ?? { code: 'invalid_value' as const, path: '$', message: 'ContextPlan validation failed.' }
  const routingDecisionRef = safeString(value, 'routing_decision_ref', referenceAllowed) ?? 'policies/model-routing/unknown-decision-v1'
  const failure: ContextPlanningFailure = {
    context_plan_contract_version: CONTEXT_PLAN_CONTRACT_VERSION,
    task_id: safeString(value, 'task_id', item => OPAQUE_IDENTIFIER.test(item)) ?? 'unknown-task',
    assignment_revision: safeString(value, 'assignment_revision', referenceAllowed) ?? 'assignments/context-plan/unknown-v1',
    routing_contract_version: ROUTING_CONTRACT_VERSION,
    routing_decision_ref: routingDecisionRef,
    status: 'blocked',
    failure_code: first.code,
    failed_stage: stageFor(first.code),
    path: first.path,
    message: first.message,
    affected_ref: routingDecisionRef,
    decision_owner: first.code === 'forbidden_context' ? 'Security / Context Policy owner' : 'Context Planning input owner',
    recommended_next_action: 'Correct the ContextPlan without defaulting or silent repair and validate it again.',
    evaluation_timestamp: safeString(value, 'evaluation_timestamp', isUtcTimestamp) ?? '1970-01-01T00:00:00Z',
  }
  const validation = validateContextPlanningFailure(failure)
  if (!validation.accepted) throw new Error('Context Plan validator constructed an invalid failure.')
  return validation.failure
}

export function validateContextPlan(value: unknown): ContextPlanValidationResult {
  const errors: ContextPlanValidationError[] = []
  const fields = [
    'context_plan_contract_version', 'context_plan_ref', 'task_id', 'assignment_revision', 'routing_contract_version',
    'routing_decision_ref', 'context_policy_ref', 'required_context_refs', 'included_optional_context_refs',
    'excluded_optional_context_refs', 'forbidden_context_categories', 'context_order', 'context_rendering_profile_ref',
    'materialization_policy_ref', 'applied_rule_refs', 'planner_version', 'evaluation_timestamp',
  ] as const
  const record = objectAt(value, '$', fields, fields, errors)
  enumAt(record, 'context_plan_contract_version', '$', [CONTEXT_PLAN_CONTRACT_VERSION], errors, 'inconsistent_identity')
  referenceAt(record, 'context_plan_ref', '$', errors)
  stringAt(record, 'task_id', '$', errors, item => OPAQUE_IDENTIFIER.test(item), 'inconsistent_identity', 'Expected an opaque Task identifier.')
  referenceAt(record, 'assignment_revision', '$', errors)
  enumAt(record, 'routing_contract_version', '$', [ROUTING_CONTRACT_VERSION], errors, 'inconsistent_identity')
  referenceAt(record, 'routing_decision_ref', '$', errors)
  referenceAt(record, 'context_policy_ref', '$', errors)
  const required = stringArrayAt(record, 'required_context_refs', '$', errors, { references: true, nonEmpty: true }) ?? []
  const included = stringArrayAt(record, 'included_optional_context_refs', '$', errors, { references: true }) ?? []
  const excluded = stringArrayAt(record, 'excluded_optional_context_refs', '$', errors, { references: true }) ?? []
  const forbidden = stringArrayAt(record, 'forbidden_context_categories', '$', errors, { categories: true }) ?? []
  const order = stringArrayAt(record, 'context_order', '$', errors, { references: true, nonEmpty: true }) ?? []
  referenceAt(record, 'context_rendering_profile_ref', '$', errors)
  referenceAt(record, 'materialization_policy_ref', '$', errors)
  stringArrayAt(record, 'applied_rule_refs', '$', errors, { references: true, nonEmpty: true })
  stringAt(record, 'planner_version', '$', errors, item => OPAQUE_IDENTIFIER.test(item), 'invalid_value', 'Expected an opaque planner version.')
  timestampAt(record, 'evaluation_timestamp', '$', errors)

  const requiredSet = new Set(required)
  const includedSet = new Set(included)
  const excludedSet = new Set(excluded)
  addCrossSetError(included, requiredSet, '$.included_optional_context_refs', errors, 'duplicate_reference', 'Required and included optional Context must be disjoint.')
  addCrossSetError(excluded, requiredSet, '$.excluded_optional_context_refs', errors, 'invalid_context_order', 'Required and excluded optional Context must be disjoint.')
  addCrossSetError(excluded, includedSet, '$.excluded_optional_context_refs', errors, 'invalid_context_order', 'Included and excluded optional Context must be disjoint.')

  const planned = new Set([...required, ...included])
  const orderSet = new Set(order)
  for (const [index, reference] of order.entries()) {
    if (!planned.has(reference)) {
      const excludedReference = excludedSet.has(reference)
      addError(errors, 'invalid_context_order', `$.context_order[${index}]`, excludedReference ? 'Excluded optional Context is forbidden in context_order.' : 'Unplanned Context is forbidden in context_order.')
    }
  }
  for (const reference of planned) {
    if (!orderSet.has(reference)) addError(errors, 'invalid_context_order', '$.context_order', `Missing planned Context reference: ${reference}.`)
  }
  if (orderSet.size !== planned.size) addError(errors, 'invalid_context_order', '$.context_order', 'context_order must be a complete permutation of required and included optional Context.')

  for (const [collection, basePath] of [[required, '$.required_context_refs'], [included, '$.included_optional_context_refs']] as const) {
    collection.forEach((reference, index) => {
      const category = forbidden.find(item => matchesForbiddenCategory(reference, item))
      if (category) addError(errors, 'forbidden_context', `${basePath}[${index}]`, `Planned Context matches forbidden category: ${category}.`)
    })
  }

  if (errors.length > 0) {
    return Object.freeze({
      accepted: false as const,
      failure: failureFromErrors(value, errors),
      errors: deepFreezeClone(errors),
    })
  }
  const plan = deepFreezeClone(value as ContextPlan)
  return Object.freeze({ accepted: true, plan, value: plan, errors: NO_ERRORS })
}

export function validateContextPlanningFailure(value: unknown): ContextPlanningFailureValidationResult {
  const errors: ContextPlanValidationError[] = []
  const fields = [
    'context_plan_contract_version', 'task_id', 'assignment_revision', 'routing_contract_version', 'routing_decision_ref',
    'status', 'failure_code', 'failed_stage', 'path', 'message', 'affected_ref', 'decision_owner',
    'recommended_next_action', 'evaluation_timestamp',
  ] as const
  const record = objectAt(value, '$', fields, fields, errors)
  enumAt(record, 'context_plan_contract_version', '$', [CONTEXT_PLAN_CONTRACT_VERSION], errors, 'inconsistent_identity')
  stringAt(record, 'task_id', '$', errors, item => OPAQUE_IDENTIFIER.test(item), 'inconsistent_identity', 'Expected an opaque Task identifier.')
  referenceAt(record, 'assignment_revision', '$', errors)
  enumAt(record, 'routing_contract_version', '$', [ROUTING_CONTRACT_VERSION], errors, 'inconsistent_identity')
  referenceAt(record, 'routing_decision_ref', '$', errors)
  enumAt(record, 'status', '$', ['blocked'], errors)
  enumAt(record, 'failure_code', '$', CONTEXT_PLANNING_FAILURE_CODES, errors)
  enumAt(record, 'failed_stage', '$', CONTEXT_PLANNING_FAILURE_STAGES, errors)
  stringAt(record, 'path', '$', errors, item => JSON_PATH.test(item), 'invalid_value', 'Expected a JSON-style contract path.')
  stringAt(record, 'message', '$', errors, item => item.trim().length > 0 && !SECRET_TEXT.test(item), 'invalid_value', 'Expected a sanitized non-empty message.')
  referenceAt(record, 'affected_ref', '$', errors)
  stringAt(record, 'decision_owner', '$', errors)
  stringAt(record, 'recommended_next_action', '$', errors)
  timestampAt(record, 'evaluation_timestamp', '$', errors)
  if (errors.length > 0) return Object.freeze({ accepted: false as const, errors: deepFreezeClone(errors) })
  const failure = deepFreezeClone(value as ContextPlanningFailure)
  return Object.freeze({ accepted: true, failure, value: failure, errors: NO_ERRORS })
}

export function validateContextPlanningFailureV1(value: unknown): ContextPlanningFailureV1ValidationResult {
  const errors: SupportingContractValidationError[] = []
  const required = [
    'context_planning_failure_contract_version', 'task_id', 'assignment_revision', 'routing_contract_version',
    'routing_decision_ref', 'context_policy_ref', 'status', 'failure_code', 'failed_stage', 'path', 'message',
    'decision_owner', 'recommended_next_action', 'retry_policy', 'planner_version', 'evaluation_timestamp',
  ] as const
  const allowed = [...required, 'affected_ref'] as const
  if (!isRecord(value)) {
    errors.push({ code: 'invalid_value', path: '$', message: 'Expected a closed object.' })
  } else {
    for (const key of required) {
      if (!hasOwn(value, key)) errors.push({ code: 'missing_field', path: `$.${key}`, message: 'Required field is missing.' })
    }
    for (const key of Object.keys(value)) {
      if (!allowed.includes(key as (typeof allowed)[number])) {
        errors.push({ code: 'unknown_field', path: `$.${key}`, message: SECRET_FIELD.test(key) ? 'Secret-bearing fields are forbidden.' : 'Unknown field is forbidden.' })
      }
    }

    const requireString = (key: string, predicate: (item: string) => boolean, code: SupportingContractValidationError['code'] = 'invalid_value'): string | undefined => {
      if (!hasOwn(value, key)) return undefined
      const item = value[key]
      if (typeof item !== 'string' || !predicate(item)) {
        errors.push({ code, path: `$.${key}`, message: 'Expected an allowed non-empty value.' })
        return undefined
      }
      return item
    }
    requireString('context_planning_failure_contract_version', item => item === CONTEXT_PLANNING_FAILURE_CONTRACT_VERSION, 'inconsistent_identity')
    requireString('task_id', item => OPAQUE_IDENTIFIER.test(item), 'inconsistent_identity')
    requireString('assignment_revision', referenceAllowed, 'invalid_reference')
    requireString('routing_contract_version', item => item === ROUTING_CONTRACT_VERSION, 'inconsistent_identity')
    requireString('routing_decision_ref', referenceAllowed, 'invalid_reference')
    requireString('context_policy_ref', referenceAllowed, 'invalid_reference')
    requireString('status', item => item === 'blocked' || item === 'failed')
    const failureCode = requireString('failure_code', item => CONTEXT_PLANNING_FAILURE_V1_CODES.includes(item as ContextPlanningFailureV1['failure_code']))
    requireString('failed_stage', item => CONTEXT_PLANNING_FAILURE_V1_STAGES.includes(item as ContextPlanningFailureV1['failed_stage']))
    requireString('path', item => JSON_PATH.test(item))
    requireString('message', item => item.trim().length > 0 && !SECRET_TEXT.test(item) && !PERSONAL_PATH.test(item) && !PRIVATE_ENDPOINT.test(item))
    if (hasOwn(value, 'affected_ref')) requireString('affected_ref', referenceAllowed, 'invalid_reference')
    requireString('decision_owner', item => CONTEXT_PLANNING_DECISION_OWNERS.includes(item as ContextPlanningFailureV1['decision_owner']))
    requireString('recommended_next_action', item => CONTEXT_PLANNING_NEXT_ACTIONS.includes(item as ContextPlanningFailureV1['recommended_next_action']))
    requireString('retry_policy', item => CONTEXT_PLANNING_RETRY_POLICIES.includes(item as ContextPlanningFailureV1['retry_policy']))
    requireString('planner_version', item => OPAQUE_IDENTIFIER.test(item))
    requireString('evaluation_timestamp', isUtcTimestamp)

    if (failureCode) {
      const fields = ['status', 'failed_stage', 'decision_owner', 'recommended_next_action', 'retry_policy', 'message'] as const
      const candidates = CONTEXT_PLANNING_FAILURE_V1_MAPPINGS.filter(mapping => mapping.failure_code === failureCode)
      const closest = candidates.reduce((best, candidate) => {
        const matches = fields.filter(field => value[field] === candidate[field]).length
        return !best || matches > best.matches ? { mapping: candidate, matches } : best
      }, undefined as { readonly mapping: (typeof candidates)[number]; readonly matches: number } | undefined)?.mapping
      if (closest && !fields.every(field => value[field] === closest[field])) {
        fields.forEach(field => {
          if (value[field] !== closest[field]) errors.push({ code: 'inconsistent_identity', path: `$.${field}`, message: `Expected the closed ${failureCode} catalog value.` })
        })
      }
    }
  }
  if (errors.length > 0) return Object.freeze({ accepted: false as const, errors: deepFreezeClone(errors) })
  return Object.freeze({ accepted: true as const, value: deepFreezeClone(value as ContextPlanningFailureV1), errors: NO_SUPPORTING_ERRORS })
}
