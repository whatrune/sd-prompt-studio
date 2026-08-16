const FULL_HEAD = /^[0-9a-f]{40}$/
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/
const STRICT_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/
const REGISTERED_ID = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/
const SHA256 = /^[0-9a-f]{64}$/
export const REPOSITORY_RELATIVE_PATH_PATTERN_SOURCE_V1 = String.raw`^(?![A-Za-z]:)(?![\\/])(?!.*[\\:\u0000-\u001f\u007f])(?!(?:.*\/)?\.{1,2}(?:\/|$))(?!.*\/\/)[^/]+(?:\/[^/]+)*$`
const REPOSITORY_RELATIVE_PATH = new RegExp(REPOSITORY_RELATIVE_PATH_PATTERN_SOURCE_V1)

export const GADP_IDENTITY_V1 = 'gadp_identity_v1'
export const GADP_REVIEW_V1 = 'gadp_review_v1'
export const GADP_ADMISSION_RESULT_V1 = 'gadp_admission_result_v1'
export const GADP_ROLE_DISPATCH_V1 = 'gadp_role_dispatch_v1'

export const REVIEW_DECISIONS_V1 = Object.freeze(['APPROVE', 'CHANGES_REQUIRED', 'BLOCKED'])
export const ADMISSION_STATES_V1 = Object.freeze([
  'REVIEW_PENDING',
  'REVIEW_BLOCKED',
  'STALE',
  'IMPLEMENTATION_BLOCKED',
  'INDETERMINATE',
  'MERGE_ELIGIBLE',
])
export const FAIL_CLOSED_REASONS_V1 = Object.freeze([
  'review_pending',
  'review_not_approvable',
  'identity_binding_invalid',
  'head_binding_stale',
  'review_current_leaf_missing',
  'review_current_leaf_invalid',
  'checks_not_terminal',
  'checks_not_successful',
  'threads_not_resolved',
  'input_invalid',
  'binding_drifted',
  'merge_gate_satisfied',
])
export const ROLE_PURPOSES_V1 = Object.freeze(['IMPLEMENTATION', 'INDEPENDENT_REVIEW', 'MERGE_DECISION'])

export const isRepositoryRelativePathV1 = (value) =>
  typeof value === 'string' && value.length <= 512 && REPOSITORY_RELATIVE_PATH.test(value)

export class ContractViolationV1 extends Error {
  constructor(reason) {
    super(reason)
    this.name = 'ContractViolationV1'
  }
}

const violation = (reason) => { throw new ContractViolationV1(reason) }
const positiveInteger = (value) => Number.isSafeInteger(value) && value > 0
const nonNegativeInteger = (value) => Number.isSafeInteger(value) && value >= 0
const plainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)

const exactKeys = (value, expected, reason) => {
  if (!plainObject(value)) violation(reason)
  const actual = Object.keys(value).sort()
  const canonical = [...expected].sort()
  if (actual.length !== canonical.length || actual.some((key, index) => key !== canonical[index])) violation(reason)
}

const deepFreezeCopy = (value) => {
  if (Array.isArray(value)) return Object.freeze(value.map(deepFreezeCopy))
  if (plainObject(value)) {
    return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, child]) => [key, deepFreezeCopy(child)])))
  }
  return value
}

const validateRegisteredId = (value, reason) => {
  if (typeof value !== 'string' || value.length > 128 || !REGISTERED_ID.test(value)) violation(reason)
}

const validateOpaqueSourceId = (value) => {
  if (typeof value !== 'string' || value.length === 0 || value.length > 128 || /[\u0000-\u001f\u007f]/.test(value)) {
    violation('review_source_id_invalid')
  }
}

const validateSortedUniqueStrings = (values, validator, reason) => {
  if (!Array.isArray(values)) violation(reason)
  let prior = null
  for (const value of values) {
    validator(value, reason)
    if (prior !== null && value <= prior) violation(reason)
    prior = value
  }
}

export const validateIdentityV1 = (identity) => {
  exactKeys(identity, ['record_type', 'repository', 'task_issue_number', 'pr_number', 'exact_head', 'attempt'], 'identity_contract_invalid')
  if (
    identity.record_type !== GADP_IDENTITY_V1 ||
    typeof identity.repository !== 'string' || !REPOSITORY.test(identity.repository) ||
    !positiveInteger(identity.task_issue_number) || !positiveInteger(identity.pr_number) ||
    typeof identity.exact_head !== 'string' || !FULL_HEAD.test(identity.exact_head) ||
    !positiveInteger(identity.attempt)
  ) violation('identity_contract_invalid')
  return deepFreezeCopy(identity)
}

export const validateReviewV1 = (review) => {
  exactKeys(review, [
    'record_type', 'identity', 'source_id', 'source_order', 'observed_at', 'decision',
    'blocking_finding_count', 'remaining_finding_count', 'unknown_count',
  ], 'review_contract_invalid')
  const identity = validateIdentityV1(review.identity)
  validateOpaqueSourceId(review.source_id)
  if (
    review.record_type !== GADP_REVIEW_V1 ||
    !positiveInteger(review.source_order) ||
    typeof review.observed_at !== 'string' || !STRICT_UTC.test(review.observed_at) ||
    !REVIEW_DECISIONS_V1.includes(review.decision) ||
    !nonNegativeInteger(review.blocking_finding_count) ||
    !nonNegativeInteger(review.remaining_finding_count) ||
    !nonNegativeInteger(review.unknown_count) ||
    review.remaining_finding_count < review.blocking_finding_count ||
    (review.decision === 'APPROVE' && (
      review.blocking_finding_count !== 0 || review.remaining_finding_count !== 0 || review.unknown_count !== 0
    )) ||
    (review.decision === 'CHANGES_REQUIRED' && review.blocking_finding_count === 0)
  ) violation('review_contract_invalid')
  return deepFreezeCopy({ ...review, identity })
}

export const validateAdmissionResultV1 = (result) => {
  exactKeys(result, [
    'record_type', 'identity', 'state', 'allowed', 'reason', 'review_source_id',
    'checks_terminal', 'external_check_success_count', 'blocking_thread_count',
  ], 'admission_contract_invalid')
  const identity = validateIdentityV1(result.identity)
  validateOpaqueSourceId(result.review_source_id)
  if (
    result.record_type !== GADP_ADMISSION_RESULT_V1 ||
    !ADMISSION_STATES_V1.includes(result.state) || typeof result.allowed !== 'boolean' ||
    !FAIL_CLOSED_REASONS_V1.includes(result.reason) || typeof result.checks_terminal !== 'boolean' ||
    !nonNegativeInteger(result.external_check_success_count) || !nonNegativeInteger(result.blocking_thread_count)
  ) violation('admission_contract_invalid')
  const eligible = result.state === 'MERGE_ELIGIBLE'
  if (
    result.allowed !== eligible ||
    (eligible && (result.reason !== 'merge_gate_satisfied' || !result.checks_terminal || result.blocking_thread_count !== 0)) ||
    (!eligible && result.reason === 'merge_gate_satisfied')
  ) violation('admission_contract_invalid')
  return deepFreezeCopy({ ...result, identity })
}

export const validateRoleDispatchEnvelopeV1 = (envelope) => {
  exactKeys(envelope, [
    'record_type', 'identity', 'role_id', 'profile_id', 'purpose', 'source_review_id',
    'authorized_paths', 'capability_ids', 'prompt_sha256',
  ], 'role_dispatch_contract_invalid')
  const identity = validateIdentityV1(envelope.identity)
  validateRegisteredId(envelope.role_id, 'role_dispatch_contract_invalid')
  validateRegisteredId(envelope.profile_id, 'role_dispatch_contract_invalid')
  validateOpaqueSourceId(envelope.source_review_id)
  validateSortedUniqueStrings(envelope.authorized_paths, (value, reason) => {
    if (!isRepositoryRelativePathV1(value)) violation(reason)
  }, 'role_dispatch_contract_invalid')
  validateSortedUniqueStrings(envelope.capability_ids, validateRegisteredId, 'role_dispatch_contract_invalid')
  if (
    envelope.record_type !== GADP_ROLE_DISPATCH_V1 || !ROLE_PURPOSES_V1.includes(envelope.purpose) ||
    typeof envelope.prompt_sha256 !== 'string' || !SHA256.test(envelope.prompt_sha256)
  ) violation('role_dispatch_contract_invalid')
  return deepFreezeCopy({ ...envelope, identity })
}

export const createFailClosedAdmissionResultV1 = ({ identity, state = 'INDETERMINATE', reason, reviewSourceId }) => {
  if (state === 'MERGE_ELIGIBLE') violation('fail_closed_result_invalid')
  return validateAdmissionResultV1({
    record_type: GADP_ADMISSION_RESULT_V1,
    identity,
    state,
    allowed: false,
    reason,
    review_source_id: reviewSourceId,
    checks_terminal: false,
    external_check_success_count: 0,
    blocking_thread_count: 0,
  })
}
