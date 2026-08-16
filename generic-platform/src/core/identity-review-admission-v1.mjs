import {
  ContractViolationV1,
  GADP_ADMISSION_RESULT_V1,
  validateAdmissionResultV1,
  validateIdentityV1,
  validateReviewV1,
} from './contracts-v1.mjs'

const STRICT_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/
const CHECK_ID = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/
const REVIEW_OBSERVATION_KINDS = new Set(['VALID', 'MALFORMED_ORDERABLE', 'MALFORMED_UNORDERABLE'])
const CHECK_STATUSES = new Set(['QUEUED', 'IN_PROGRESS', 'COMPLETED'])
const CHECK_CONCLUSIONS = new Set(['SUCCESS', 'FAILURE', 'CANCELLED', 'TIMED_OUT', 'SKIPPED'])

const violation = (reason) => { throw new ContractViolationV1(reason) }
const plainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
const exactKeys = (value, expected, reason) => {
  if (!plainObject(value)) violation(reason)
  const actual = Object.keys(value).sort()
  const canonical = [...expected].sort()
  if (actual.length !== canonical.length || actual.some((key, index) => key !== canonical[index])) violation(reason)
}
const positiveInteger = (value) => Number.isSafeInteger(value) && value > 0
const nonNegativeInteger = (value) => Number.isSafeInteger(value) && value >= 0
const sourceId = (value, reason) => {
  if (typeof value !== 'string' || value.length === 0 || value.length > 128 || /[\u0000-\u001f\u007f]/.test(value)) violation(reason)
}
const freeze = (value) => Object.freeze(value)

export const sameIdentityBindingV1 = (leftInput, rightInput) => {
  const left = validateIdentityV1(leftInput)
  const right = validateIdentityV1(rightInput)
  return left.repository === right.repository && left.task_issue_number === right.task_issue_number &&
    left.pr_number === right.pr_number && left.exact_head === right.exact_head && left.attempt === right.attempt
}

const compareReviewOrder = (left, right) => left.source_order - right.source_order

const validateObservation = (observation) => {
  exactKeys(observation, ['kind', 'source_id', 'source_order', 'observed_at', 'review'], 'review_observation_invalid')
  if (!REVIEW_OBSERVATION_KINDS.has(observation.kind)) violation('review_observation_invalid')
  if (observation.kind === 'MALFORMED_UNORDERABLE') {
    if (observation.source_id !== null || observation.source_order !== null || observation.observed_at !== null || observation.review !== null) {
      violation('review_observation_invalid')
    }
    return freeze({ ...observation })
  }
  sourceId(observation.source_id, 'review_observation_invalid')
  if (!positiveInteger(observation.source_order) || typeof observation.observed_at !== 'string' || !STRICT_UTC.test(observation.observed_at)) {
    violation('review_observation_invalid')
  }
  if (observation.kind === 'MALFORMED_ORDERABLE') {
    if (observation.review !== null) violation('review_observation_invalid')
    return freeze({ ...observation })
  }
  const review = validateReviewV1(observation.review)
  if (review.source_id !== observation.source_id || review.source_order !== observation.source_order || review.observed_at !== observation.observed_at) {
    violation('review_observation_invalid')
  }
  return freeze({ ...observation, review })
}

const reviewIdentityFingerprint = (observation) => JSON.stringify([
  observation.kind,
  observation.source_id,
  observation.source_order,
  observation.observed_at,
  observation.review,
])

export const selectCurrentReviewLeafV1 = ({ identity: identityInput, observations }) => {
  const identity = validateIdentityV1(identityInput)
  if (!Array.isArray(observations)) violation('review_observation_invalid')
  const normalized = observations.map(validateObservation)
  if (normalized.some((observation) => observation.kind === 'MALFORMED_UNORDERABLE')) {
    return freeze({ ok: false, reason: 'review_current_leaf_invalid', selected_review: null, historical_malformed_count: 0 })
  }
  let priorSourceOrder = 0
  for (const observation of normalized) {
    if (observation.source_order <= priorSourceOrder) {
      return freeze({ ok: false, reason: 'review_current_leaf_invalid', selected_review: null, historical_malformed_count: 0 })
    }
    priorSourceOrder = observation.source_order
  }
  const sourceFingerprints = new Map()
  for (const observation of normalized) {
    if (observation.source_id === null) continue
    const fingerprint = reviewIdentityFingerprint(observation)
    const prior = sourceFingerprints.get(observation.source_id)
    if (prior !== undefined && prior !== fingerprint) {
      return freeze({ ok: false, reason: 'binding_drifted', selected_review: null, historical_malformed_count: 0 })
    }
    sourceFingerprints.set(observation.source_id, fingerprint)
  }
  const candidates = normalized.filter((observation) => observation.kind === 'VALID' &&
    sameIdentityBindingV1(identity, observation.review.identity)).sort(compareReviewOrder)
  const selected = candidates.at(-1)
  if (!selected) return freeze({ ok: false, reason: 'review_current_leaf_missing', selected_review: null, historical_malformed_count: 0 })
  const malformed = normalized.filter((observation) => observation.kind === 'MALFORMED_ORDERABLE')
  if (malformed.some((observation) => compareReviewOrder(observation, selected) >= 0)) {
    return freeze({ ok: false, reason: 'review_current_leaf_invalid', selected_review: null, historical_malformed_count: 0 })
  }
  return freeze({
    ok: true,
    reason: 'current_review_selected',
    selected_review: selected.review,
    historical_malformed_count: malformed.length,
  })
}

export const confirmCurrentReviewLeafV1 = ({ selectedReview: selectedInput, freshReview: freshInput }) => {
  const selected = validateReviewV1(selectedInput)
  const fresh = validateReviewV1(freshInput)
  if (JSON.stringify(selected) !== JSON.stringify(fresh)) {
    return freeze({ ok: false, reason: 'binding_drifted', review: null })
  }
  return freeze({ ok: true, reason: 'current_review_confirmed', review: fresh })
}

const validateCheck = (check) => {
  exactKeys(check, ['check_id', 'generation_id', 'current', 'required', 'status', 'conclusion'], 'check_observation_invalid')
  if (
    typeof check.check_id !== 'string' || !CHECK_ID.test(check.check_id) ||
    typeof check.generation_id !== 'string' || check.generation_id.length === 0 || check.generation_id.length > 128 ||
    typeof check.current !== 'boolean' || typeof check.required !== 'boolean' || !CHECK_STATUSES.has(check.status) ||
    (check.status === 'COMPLETED' ? !CHECK_CONCLUSIONS.has(check.conclusion) : check.conclusion !== null)
  ) violation('check_observation_invalid')
  return freeze({ ...check })
}

const validateThread = (thread) => {
  exactKeys(thread, ['thread_id', 'resolved'], 'thread_observation_invalid')
  if (typeof thread.thread_id !== 'string' || thread.thread_id.length === 0 || thread.thread_id.length > 128 ||
    typeof thread.resolved !== 'boolean') violation('thread_observation_invalid')
  return freeze({ ...thread })
}

export const evaluateTerminalEvidenceV1 = ({ checks, threads, requiredCheckIds }) => {
  if (!Array.isArray(checks) || !Array.isArray(threads) || !Array.isArray(requiredCheckIds)) violation('terminal_evidence_invalid')
  let priorRequiredId = null
  for (const id of requiredCheckIds) {
    if (typeof id !== 'string' || !CHECK_ID.test(id) || (priorRequiredId !== null && id <= priorRequiredId)) violation('terminal_evidence_invalid')
    priorRequiredId = id
  }
  const normalizedChecks = checks.map(validateCheck)
  const normalizedThreads = threads.map(validateThread)
  if (new Set(normalizedChecks.map((check) => `${check.check_id}\0${check.generation_id}`)).size !== normalizedChecks.length ||
    new Set(normalizedThreads.map((thread) => thread.thread_id)).size !== normalizedThreads.length) violation('terminal_evidence_invalid')
  const currentRequired = normalizedChecks.filter((check) => check.current && check.required)
  if (new Set(currentRequired.map((check) => check.check_id)).size !== currentRequired.length) violation('terminal_evidence_invalid')
  if (currentRequired.length !== requiredCheckIds.length ||
    requiredCheckIds.some((id) => !currentRequired.some((check) => check.check_id === id)) ||
    currentRequired.some((check) => !requiredCheckIds.includes(check.check_id))) {
    return freeze({ ok: false, reason: 'checks_not_terminal', checks_terminal: false, external_check_success_count: 0, blocking_thread_count: 0 })
  }
  if (currentRequired.some((check) => check.status !== 'COMPLETED')) {
    return freeze({ ok: false, reason: 'checks_not_terminal', checks_terminal: false, external_check_success_count: 0, blocking_thread_count: 0 })
  }
  if (currentRequired.some((check) => check.conclusion !== 'SUCCESS')) {
    return freeze({ ok: false, reason: 'checks_not_successful', checks_terminal: true, external_check_success_count: currentRequired.filter((check) => check.conclusion === 'SUCCESS').length, blocking_thread_count: 0 })
  }
  const blockingThreads = normalizedThreads.filter((thread) => !thread.resolved).length
  if (blockingThreads > 0) {
    return freeze({ ok: false, reason: 'threads_not_resolved', checks_terminal: true, external_check_success_count: currentRequired.length, blocking_thread_count: blockingThreads })
  }
  return freeze({ ok: true, reason: 'terminal_evidence_satisfied', checks_terminal: true, external_check_success_count: currentRequired.length, blocking_thread_count: 0 })
}

const admission = ({ identity, state, allowed, reason, reviewSourceId, terminal }) => validateAdmissionResultV1({
  record_type: GADP_ADMISSION_RESULT_V1,
  identity,
  state,
  allowed,
  reason,
  review_source_id: reviewSourceId,
  checks_terminal: terminal?.checks_terminal ?? false,
  external_check_success_count: terminal?.external_check_success_count ?? 0,
  blocking_thread_count: terminal?.blocking_thread_count ?? 0,
})

export const evaluateAdmissionV1 = ({
  identity: identityInput,
  currentIdentity: currentIdentityInput,
  reviewObservations,
  checks,
  threads,
  requiredCheckIds,
}) => {
  const identity = validateIdentityV1(identityInput)
  const currentIdentity = validateIdentityV1(currentIdentityInput)
  if (!sameIdentityBindingV1(identity, currentIdentity)) {
    const headChanged = identity.repository === currentIdentity.repository &&
      identity.task_issue_number === currentIdentity.task_issue_number && identity.pr_number === currentIdentity.pr_number &&
      identity.exact_head !== currentIdentity.exact_head
    return admission({ identity, state: headChanged ? 'STALE' : 'INDETERMINATE', allowed: false, reason: headChanged ? 'head_binding_stale' : 'binding_drifted', reviewSourceId: 'none' })
  }
  const reviewLeaf = selectCurrentReviewLeafV1({ identity, observations: reviewObservations })
  if (!reviewLeaf.ok) {
    const state = reviewLeaf.reason === 'review_current_leaf_missing' ? 'REVIEW_PENDING' : 'INDETERMINATE'
    return admission({ identity, state, allowed: false, reason: reviewLeaf.reason, reviewSourceId: 'none' })
  }
  const review = validateReviewV1(reviewLeaf.selected_review)
  if (!sameIdentityBindingV1(identity, review.identity)) {
    return admission({ identity, state: 'INDETERMINATE', allowed: false, reason: 'binding_drifted', reviewSourceId: review.source_id })
  }
  if (review.decision !== 'APPROVE') {
    return admission({ identity, state: 'REVIEW_BLOCKED', allowed: false, reason: 'review_not_approvable', reviewSourceId: review.source_id })
  }
  const terminalEvidence = evaluateTerminalEvidenceV1({ checks, threads, requiredCheckIds })
  if (!terminalEvidence.ok) {
    const state = terminalEvidence.reason === 'checks_not_terminal' ? 'INDETERMINATE' : 'IMPLEMENTATION_BLOCKED'
    return admission({ identity, state, allowed: false, reason: terminalEvidence.reason, reviewSourceId: review.source_id, terminal: terminalEvidence })
  }
  return admission({ identity, state: 'MERGE_ELIGIBLE', allowed: true, reason: 'merge_gate_satisfied', reviewSourceId: review.source_id, terminal: terminalEvidence })
}
