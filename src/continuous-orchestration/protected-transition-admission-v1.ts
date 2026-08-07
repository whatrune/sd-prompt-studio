export const PROTECTED_TRANSITION_TASK_STATE_V1 = 'protected_transition_task_state_v1' as const

export type ProtectedTransitionV1 = 'terminal_review_admission' | 'merge_decision_admission'
export type ProtectedTransitionStateV1 =
  | 'INDETERMINATE'
  | 'STALE'
  | 'ARCHITECTURE_BLOCKED'
  | 'IMPLEMENTATION_BLOCKED'
  | 'REVIEW_PENDING'
  | 'REVIEW_BLOCKED'
  | 'MERGE_ELIGIBLE'

export type ProtectedTransitionTaskStateV1 = Readonly<{
  record_type: typeof PROTECTED_TRANSITION_TASK_STATE_V1
  task_issue_number: number
  pr_number: number
  observed_head: string
  authorized_paths: readonly string[]
  architecture_status: 'APPROVED' | 'NOT_APPROVED'
  implementation_authorized: boolean
  review_status: 'PENDING' | 'APPROVE' | 'CHANGES_REQUIRED' | 'BLOCKED'
  reviewed_head: string | null
  review_blocker_count: number | null
}>

export type ProtectedTransitionTaskIdentityV1 = Readonly<{
  repository: string
  number: number
  state: string
  is_pull_request: boolean
}>

export type ProtectedTransitionPullIdentityV1 = Readonly<{
  repository: string
  number: number
  state: string
  head: string
}>

export type ProtectedTransitionScopeSnapshotV1 = Readonly<{
  complete: boolean
  actual_paths: readonly string[]
  failure_reason: string | null
}>

export type ProtectedTransitionAdmissionInputV1 = Readonly<{
  transition: ProtectedTransitionV1
  repository: string
  task_issue_number: number
  pr_number: number
  exact_head: string
  task: ProtectedTransitionTaskIdentityV1
  pull: ProtectedTransitionPullIdentityV1
  task_state: unknown
  scope: ProtectedTransitionScopeSnapshotV1
}>

export type ProtectedTransitionAdmissionResultV1 = Readonly<{
  transition: ProtectedTransitionV1
  state: ProtectedTransitionStateV1
  allowed: boolean
  exit_code: 0 | 1 | 2
  reason: string
  task_issue_number: number
  pr_number: number
  current_head: string
  out_of_scope_paths: readonly string[]
  state_changed: false
}>

export type ProtectedTransitionReviewDecisionV1 = Readonly<{
  task_issue_number: number
  pr_number: number
  reviewed_head: string
  decision: 'APPROVE' | 'CHANGES_REQUIRED' | 'BLOCKED'
  blocking_finding_count: number
  remaining_finding_count: number
  unknown_count: number
}>

type JsonObject = Record<string, unknown>

const STATE_FIELDS = [
  'record_type',
  'task_issue_number',
  'pr_number',
  'observed_head',
  'authorized_paths',
  'architecture_status',
  'implementation_authorized',
  'review_status',
  'reviewed_head',
  'review_blocker_count',
] as const

const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/
const FULL_HEAD = /^[0-9a-f]{40}$/

const isObject = (value: unknown): value is JsonObject => value !== null && typeof value === 'object' && !Array.isArray(value)
const isPositiveSafeInteger = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0
const isNonNegativeSafeInteger = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0

export const isNormalizedRepositoryPathV1 = (value: unknown): value is string => {
  if (typeof value !== 'string' || value.length === 0 || value.includes('\0') || value.includes('\\')) return false
  if (value.startsWith('/') || value.endsWith('/')) return false
  const segments = value.split('/')
  return segments.every((segment) => segment.length > 0 && segment !== '.' && segment !== '..')
}

const deepFreezeState = (state: ProtectedTransitionTaskStateV1): ProtectedTransitionTaskStateV1 => {
  Object.freeze(state.authorized_paths)
  return Object.freeze(state)
}

export const parseProtectedTransitionTaskStateV1 = (raw: unknown): ProtectedTransitionTaskStateV1 => {
  if (!isObject(raw) || Object.keys(raw).sort().join('\0') !== [...STATE_FIELDS].sort().join('\0')) {
    throw new Error('state_schema_invalid')
  }

  const authorizedPaths = raw.authorized_paths
  if (!Array.isArray(authorizedPaths) || authorizedPaths.length === 0 || !authorizedPaths.every(isNormalizedRepositoryPathV1)) {
    throw new Error('authorized_paths_invalid')
  }
  if (new Set(authorizedPaths).size !== authorizedPaths.length) throw new Error('authorized_paths_duplicate')

  if (
    raw.record_type !== PROTECTED_TRANSITION_TASK_STATE_V1 ||
    !isPositiveSafeInteger(raw.task_issue_number) ||
    !isPositiveSafeInteger(raw.pr_number) ||
    typeof raw.observed_head !== 'string' ||
    !FULL_HEAD.test(raw.observed_head) ||
    (raw.architecture_status !== 'APPROVED' && raw.architecture_status !== 'NOT_APPROVED') ||
    typeof raw.implementation_authorized !== 'boolean' ||
    !['PENDING', 'APPROVE', 'CHANGES_REQUIRED', 'BLOCKED'].includes(String(raw.review_status))
  ) {
    throw new Error('state_schema_invalid')
  }

  if (raw.review_status === 'PENDING') {
    if (raw.reviewed_head !== null || raw.review_blocker_count !== null) throw new Error('pending_review_fields_invalid')
  } else if (
    typeof raw.reviewed_head !== 'string' ||
    !FULL_HEAD.test(raw.reviewed_head) ||
    !isNonNegativeSafeInteger(raw.review_blocker_count)
  ) {
    throw new Error('terminal_review_fields_invalid')
  }

  return deepFreezeState({
    record_type: PROTECTED_TRANSITION_TASK_STATE_V1,
    task_issue_number: raw.task_issue_number,
    pr_number: raw.pr_number,
    observed_head: raw.observed_head,
    authorized_paths: [...authorizedPaths],
    architecture_status: raw.architecture_status,
    implementation_authorized: raw.implementation_authorized,
    review_status: raw.review_status as ProtectedTransitionTaskStateV1['review_status'],
    reviewed_head: raw.reviewed_head as string | null,
    review_blocker_count: raw.review_blocker_count as number | null,
  })
}

const scanUniqueJsonKeys = (text: string): void => {
  let index = 0
  const whitespace = () => {
    while (/\s/.test(text[index] ?? '')) index += 1
  }
  const string = (): string => {
    if (text[index] !== '"') throw new Error('json_string_expected')
    const start = index
    index += 1
    while (index < text.length) {
      if (text[index] === '\\') {
        index += 2
        continue
      }
      if (text[index] === '"') {
        index += 1
        return JSON.parse(text.slice(start, index)) as string
      }
      index += 1
    }
    throw new Error('json_string_unterminated')
  }
  const value = (): void => {
    whitespace()
    if (text[index] === '{') {
      object()
      return
    }
    if (text[index] === '[') {
      array()
      return
    }
    if (text[index] === '"') {
      string()
      return
    }
    const match = text.slice(index).match(/^(?:-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)/)
    if (!match) throw new Error('json_value_invalid')
    index += match[0].length
  }
  const object = (): void => {
    const keys = new Set<string>()
    index += 1
    whitespace()
    if (text[index] === '}') {
      index += 1
      return
    }
    while (true) {
      whitespace()
      const key = string()
      if (keys.has(key)) throw new Error('json_duplicate_key')
      keys.add(key)
      whitespace()
      if (text[index] !== ':') throw new Error('json_colon_expected')
      index += 1
      value()
      whitespace()
      if (text[index] === '}') {
        index += 1
        return
      }
      if (text[index] !== ',') throw new Error('json_comma_expected')
      index += 1
    }
  }
  const array = (): void => {
    index += 1
    whitespace()
    if (text[index] === ']') {
      index += 1
      return
    }
    while (true) {
      value()
      whitespace()
      if (text[index] === ']') {
        index += 1
        return
      }
      if (text[index] !== ',') throw new Error('json_comma_expected')
      index += 1
    }
  }
  value()
  whitespace()
  if (index !== text.length) throw new Error('json_trailing_content')
}

export const parseProtectedTransitionTaskStateJsonV1 = (text: string): ProtectedTransitionTaskStateV1 => {
  if (typeof text !== 'string') throw new Error('state_json_invalid')
  scanUniqueJsonKeys(text)
  return parseProtectedTransitionTaskStateV1(JSON.parse(text) as unknown)
}

export const projectProtectedTransitionApprovedReviewStateV1 = (
  rawState: unknown,
  review: ProtectedTransitionReviewDecisionV1,
): ProtectedTransitionTaskStateV1 => {
  const state = parseProtectedTransitionTaskStateV1(rawState)
  if (
    !isObject(review) ||
    !isPositiveSafeInteger(review.task_issue_number) ||
    !isPositiveSafeInteger(review.pr_number) ||
    typeof review.reviewed_head !== 'string' ||
    !FULL_HEAD.test(review.reviewed_head) ||
    !isNonNegativeSafeInteger(review.blocking_finding_count) ||
    !isNonNegativeSafeInteger(review.remaining_finding_count) ||
    !isNonNegativeSafeInteger(review.unknown_count)
  ) {
    throw new Error('review_projection_invalid')
  }
  if (review.task_issue_number !== state.task_issue_number || review.pr_number !== state.pr_number) {
    throw new Error('review_execution_tuple_mismatch')
  }
  if (
    review.decision !== 'APPROVE' ||
    review.blocking_finding_count !== 0 ||
    review.remaining_finding_count !== 0 ||
    review.unknown_count !== 0
  ) {
    throw new Error('review_not_approvable')
  }

  return deepFreezeState({
    record_type: state.record_type,
    task_issue_number: state.task_issue_number,
    pr_number: state.pr_number,
    observed_head: review.reviewed_head,
    authorized_paths: [...state.authorized_paths],
    architecture_status: state.architecture_status,
    implementation_authorized: state.implementation_authorized,
    review_status: 'APPROVE',
    reviewed_head: review.reviewed_head,
    review_blocker_count: 0,
  })
}

type Classification = Readonly<{
  state: ProtectedTransitionStateV1
  reason: string
  parsed: ProtectedTransitionTaskStateV1 | null
  outOfScopePaths: readonly string[]
}>

export const classifyProtectedTransitionStateV1 = (input: ProtectedTransitionAdmissionInputV1): Classification => {
  let parsed: ProtectedTransitionTaskStateV1
  try {
    parsed = parseProtectedTransitionTaskStateV1(input.task_state)
  } catch (error) {
    return {
      state: 'INDETERMINATE',
      reason: error instanceof Error ? error.message : 'state_schema_invalid',
      parsed: null,
      outOfScopePaths: [],
    }
  }

  if (
    !REPOSITORY.test(input.repository) ||
    input.task.repository !== input.repository ||
    input.task.number !== input.task_issue_number ||
    input.task_issue_number !== parsed.task_issue_number ||
    input.task.state !== 'open' ||
    input.task.is_pull_request ||
    input.pull.repository !== input.repository ||
    input.pull.number !== input.pr_number ||
    input.pr_number !== parsed.pr_number ||
    input.pull.state !== 'open'
  ) {
    return { state: 'INDETERMINATE', reason: 'execution_tuple_mismatch', parsed, outOfScopePaths: [] }
  }

  if (!input.scope.complete || input.scope.failure_reason !== null) {
    return { state: 'INDETERMINATE', reason: input.scope.failure_reason ?? 'scope_acquisition_incomplete', parsed, outOfScopePaths: [] }
  }
  if (!Array.isArray(input.scope.actual_paths) || !input.scope.actual_paths.every(isNormalizedRepositoryPathV1)) {
    return { state: 'INDETERMINATE', reason: 'actual_changed_paths_invalid', parsed, outOfScopePaths: [] }
  }
  if (new Set(input.scope.actual_paths).size !== input.scope.actual_paths.length) {
    return { state: 'INDETERMINATE', reason: 'actual_changed_paths_duplicate', parsed, outOfScopePaths: [] }
  }

  if (
    input.exact_head !== input.pull.head ||
    parsed.observed_head !== input.pull.head ||
    (parsed.review_status !== 'PENDING' && parsed.reviewed_head !== input.pull.head)
  ) {
    return { state: 'STALE', reason: 'head_binding_stale', parsed, outOfScopePaths: [] }
  }

  if (parsed.architecture_status !== 'APPROVED') {
    return { state: 'ARCHITECTURE_BLOCKED', reason: 'architecture_not_approved', parsed, outOfScopePaths: [] }
  }

  const allowed = new Set(parsed.authorized_paths)
  const outOfScopePaths = [...new Set(input.scope.actual_paths.filter((path) => !allowed.has(path)))].sort()
  if (!parsed.implementation_authorized) {
    return { state: 'IMPLEMENTATION_BLOCKED', reason: 'implementation_not_authorized', parsed, outOfScopePaths }
  }
  if (outOfScopePaths.length > 0) {
    return { state: 'IMPLEMENTATION_BLOCKED', reason: 'scope_outside_authorized_paths', parsed, outOfScopePaths }
  }

  if (parsed.review_status === 'PENDING') {
    return { state: 'REVIEW_PENDING', reason: 'review_pending', parsed, outOfScopePaths: [] }
  }
  if (parsed.review_status !== 'APPROVE' || parsed.review_blocker_count !== 0) {
    return { state: 'REVIEW_BLOCKED', reason: 'review_not_approved_or_blocked', parsed, outOfScopePaths: [] }
  }
  return { state: 'MERGE_ELIGIBLE', reason: 'exact_head_review_approved', parsed, outOfScopePaths: [] }
}

export const evaluateProtectedTransitionAdmissionV1 = (
  input: ProtectedTransitionAdmissionInputV1,
): ProtectedTransitionAdmissionResultV1 => {
  const classification = classifyProtectedTransitionStateV1(input)
  const allowed =
    (classification.state === 'REVIEW_PENDING' && input.transition === 'terminal_review_admission') ||
    (classification.state === 'MERGE_ELIGIBLE' && input.transition === 'merge_decision_admission')
  const exitCode: 0 | 1 | 2 = allowed ? 0 : classification.state === 'INDETERMINATE' ? 1 : 2

  return Object.freeze({
    transition: input.transition,
    state: classification.state,
    allowed,
    exit_code: exitCode,
    reason: allowed ? 'transition_admitted' : classification.reason,
    task_issue_number: input.task_issue_number,
    pr_number: input.pr_number,
    current_head: input.pull.head,
    out_of_scope_paths: Object.freeze([...classification.outOfScopePaths]),
    state_changed: false,
  })
}
