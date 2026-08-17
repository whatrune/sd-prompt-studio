import { createHash } from 'node:crypto'

import { ContractViolationV1, isRepositoryRelativePathV1, validateReviewV1 } from './contracts-v1.mjs'

export const GADP_SHARED_SEALED_EVIDENCE_V1 = 'gadp_shared_sealed_evidence_v1'
export const GADP_PRODUCTION_PARITY_PROJECTION_V1 = 'gadp_production_parity_projection_v1'
export const GADP_GENERIC_RESULT_V1 = 'gadp_generic_result_v1'
export const GADP_PARITY_COMPARISON_V1 = 'gadp_parity_comparison_v1'

const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/
const FULL_HEAD = /^[0-9a-f]{40}$/
const SHA256 = /^[0-9a-f]{64}$/
const RUN_ID = /^[1-9][0-9]*$/
const STRICT_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/
const ID = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/
const RECORD_A_SOURCES = Object.freeze([
  'admission_inputs',
  'authorized_scope',
  'binding',
  'checks',
  'review_history',
  'state',
  'threads',
])
const COMPLETENESS = new Set(['COMPLETE', 'INCOMPLETE', 'AMBIGUOUS'])
const CAPTURE_AMBIGUITIES = new Set([
  'ACQUISITION_FAILED',
  'CHECK_GENERATION_AMBIGUOUS',
  'REVIEW_IDENTITY_CONFLICT',
  'REVIEW_UNORDERABLE',
  'SCOPE_INCOMPLETE',
  'SOURCE_INCOMPLETE',
  'STATE_INCOMPLETE',
])
const REVIEW_KINDS = new Set(['VALID', 'MALFORMED_ORDERABLE', 'MALFORMED_UNORDERABLE'])
const CHECK_STATUSES = new Set(['QUEUED', 'IN_PROGRESS', 'COMPLETED'])
const CHECK_CONCLUSIONS = new Set(['SUCCESS', 'FAILURE', 'CANCELLED', 'TIMED_OUT', 'SKIPPED'])
const PROJECTION_STATUSES = new Set(['COMPARABLE', 'NOT_COMPARABLE'])
const PRODUCTION_PROJECTION_REASONS = new Set([
  'PRODUCTION_TUPLE_MAPPED',
  'PRODUCTION_TUPLE_UNKNOWN',
  'RECORD_A_NON_PROOF_CAPABLE',
])
const GENERIC_PROJECTION_REASONS = new Set([
  'GENERIC_TUPLE_MAPPED',
  'GENERIC_TUPLE_UNKNOWN',
  'GENERIC_EVALUATION_FAILED',
  'RECORD_A_NON_PROOF_CAPABLE',
])
export const PARITY_REASON_FAMILIES_V1 = Object.freeze([
  'ADMISSION_ELIGIBLE',
  'HEAD_BINDING_STALE',
  'REVIEW_EVIDENCE_INVALID',
  'REVIEW_THREADS_BLOCKING',
])
const REASON_FAMILIES = new Set(PARITY_REASON_FAMILIES_V1)
const SEMANTIC_TUPLES = new Set([
  'MERGE_ELIGIBLE\0true\0ADMISSION_ELIGIBLE\0MERGE_DECISION',
  'REVIEW_BLOCKED\0false\0REVIEW_THREADS_BLOCKING\0STOP',
  'STALE\0false\0HEAD_BINDING_STALE\0STOP',
  'INDETERMINATE\0false\0REVIEW_EVIDENCE_INVALID\0STOP',
])

const violation = (reason) => { throw new ContractViolationV1(reason) }
const plainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
const positiveInteger = (value) => Number.isSafeInteger(value) && value > 0
const nonNegativeInteger = (value) => Number.isSafeInteger(value) && value >= 0
const exactKeys = (value, expected, reason) => {
  if (!plainObject(value)) violation(reason)
  const actual = Object.keys(value).sort()
  const canonical = [...expected].sort()
  if (actual.length !== canonical.length || actual.some((key, index) => key !== canonical[index])) violation(reason)
}
const deepFreezeCopy = (value) => {
  if (Array.isArray(value)) return Object.freeze(value.map(deepFreezeCopy))
  if (plainObject(value)) return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, child]) => [key, deepFreezeCopy(child)])))
  return value
}

export const canonicalSerializeSharedEvidenceV1 = (value) => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value)
  if (typeof value === 'number' && Number.isSafeInteger(value)) return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalSerializeSharedEvidenceV1).join(',')}]`
  if (plainObject(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalSerializeSharedEvidenceV1(value[key])}`).join(',')}}`
  }
  violation('canonical_value_invalid')
}

export const digestSharedEvidenceV1 = (value) =>
  createHash('sha256').update(canonicalSerializeSharedEvidenceV1(value), 'utf8').digest('hex')

const validateBinding = (value, reason = 'shared_evidence_binding_invalid') => {
  exactKeys(value, [
    'repository', 'task_issue_number', 'pr_number', 'exact_head', 'run_id', 'run_attempt', 'host_sha',
    'acquisition_generation', 'production_execution_instance',
  ], reason)
  if (
    typeof value.repository !== 'string' || !REPOSITORY.test(value.repository) ||
    !positiveInteger(value.task_issue_number) || !positiveInteger(value.pr_number) ||
    typeof value.exact_head !== 'string' || !FULL_HEAD.test(value.exact_head) ||
    typeof value.run_id !== 'string' || !RUN_ID.test(value.run_id) || !positiveInteger(value.run_attempt) ||
    typeof value.host_sha !== 'string' || !FULL_HEAD.test(value.host_sha) ||
    typeof value.acquisition_generation !== 'string' || !SHA256.test(value.acquisition_generation) ||
    typeof value.production_execution_instance !== 'string' || !SHA256.test(value.production_execution_instance)
  ) violation(reason)
  return deepFreezeCopy(value)
}

const validateTaskState = (value) => {
  exactKeys(value, [
    'record_type', 'task_issue_number', 'pr_number', 'observed_head', 'authorized_paths',
    'architecture_status', 'implementation_authorized', 'review_status', 'reviewed_head', 'review_blocker_count',
  ], 'shared_evidence_state_invalid')
  if (
    value.record_type !== 'protected_transition_task_state_v1' || !positiveInteger(value.task_issue_number) ||
    !positiveInteger(value.pr_number) || !FULL_HEAD.test(value.observed_head ?? '') ||
    !Array.isArray(value.authorized_paths) || value.authorized_paths.length === 0 ||
    value.authorized_paths.some((item) => !isRepositoryRelativePathV1(item)) ||
    new Set(value.authorized_paths).size !== value.authorized_paths.length ||
    !['APPROVED', 'NOT_APPROVED'].includes(value.architecture_status) ||
    typeof value.implementation_authorized !== 'boolean' ||
    !['PENDING', 'APPROVE', 'CHANGES_REQUIRED', 'BLOCKED'].includes(value.review_status)
  ) violation('shared_evidence_state_invalid')
  if (value.review_status === 'PENDING') {
    if (value.reviewed_head !== null || value.review_blocker_count !== null) violation('shared_evidence_state_invalid')
  } else if (!FULL_HEAD.test(value.reviewed_head ?? '') || !nonNegativeInteger(value.review_blocker_count)) {
    violation('shared_evidence_state_invalid')
  }
  return deepFreezeCopy(value)
}

const validateCompletenessEnvelope = (value, itemLength, reason) => {
  if (!COMPLETENESS.has(value.completeness) || !nonNegativeInteger(value.item_count) || value.item_count !== itemLength) violation(reason)
  if (value.completeness === 'COMPLETE') {
    if (!positiveInteger(value.page_count)) violation(reason)
  } else if (value.page_count !== null) violation(reason)
}

const validateReviewHistory = (value, binding) => {
  exactKeys(value, ['completeness', 'page_count', 'item_count', 'observations'], 'shared_evidence_review_invalid')
  if (!Array.isArray(value.observations)) violation('shared_evidence_review_invalid')
  validateCompletenessEnvelope(value, value.observations.length, 'shared_evidence_review_invalid')
  let priorOrder = 0
  for (const observation of value.observations) {
    exactKeys(observation, ['kind', 'source_id', 'source_order', 'observed_at', 'review'], 'shared_evidence_review_invalid')
    if (!REVIEW_KINDS.has(observation.kind)) violation('shared_evidence_review_invalid')
    if (observation.kind === 'MALFORMED_UNORDERABLE') {
      if (observation.source_id !== null || observation.source_order !== null || observation.observed_at !== null || observation.review !== null) {
        violation('shared_evidence_review_invalid')
      }
      continue
    }
    if (
      typeof observation.source_id !== 'string' || observation.source_id.length === 0 ||
      !positiveInteger(observation.source_order) || observation.source_order <= priorOrder ||
      typeof observation.observed_at !== 'string' || !STRICT_UTC.test(observation.observed_at)
    ) violation('shared_evidence_review_invalid')
    priorOrder = observation.source_order
    if (observation.kind === 'MALFORMED_ORDERABLE') {
      if (observation.review !== null) violation('shared_evidence_review_invalid')
      continue
    }
    const review = validateReviewV1(observation.review)
    if (
      review.source_id !== observation.source_id || review.source_order !== observation.source_order ||
      review.observed_at !== observation.observed_at || review.identity.repository !== binding.repository ||
      review.identity.task_issue_number !== binding.task_issue_number || review.identity.attempt !== binding.run_attempt
    ) violation('shared_evidence_review_invalid')
  }
  return deepFreezeCopy(value)
}

const validateChecks = (value, binding) => {
  exactKeys(value, ['completeness', 'page_count', 'item_count', 'items'], 'shared_evidence_checks_invalid')
  if (!Array.isArray(value.items)) violation('shared_evidence_checks_invalid')
  validateCompletenessEnvelope(value, value.items.length, 'shared_evidence_checks_invalid')
  const identities = new Set()
  for (const item of value.items) {
    exactKeys(item, ['check_id', 'generation_id', 'current', 'required', 'status', 'conclusion', 'provenance'], 'shared_evidence_checks_invalid')
    exactKeys(item.provenance, [
      'repository', 'pr_number', 'target_head', 'current_head', 'check_suite_head', 'app_id', 'name', 'actions_run_id',
    ], 'shared_evidence_checks_invalid')
    const identity = `${item.check_id}\0${item.generation_id}`
    if (
      typeof item.check_id !== 'string' || !ID.test(item.check_id) ||
      typeof item.generation_id !== 'string' || item.generation_id.length === 0 || item.generation_id.length > 128 ||
      identities.has(identity) || typeof item.current !== 'boolean' || typeof item.required !== 'boolean' ||
      !CHECK_STATUSES.has(item.status) ||
      (item.status === 'COMPLETED' ? !CHECK_CONCLUSIONS.has(item.conclusion) : item.conclusion !== null) ||
      item.provenance.repository !== binding.repository || item.provenance.pr_number !== binding.pr_number ||
      item.provenance.target_head !== binding.exact_head || !FULL_HEAD.test(item.provenance.current_head ?? '') ||
      item.provenance.check_suite_head !== binding.exact_head ||
      typeof item.provenance.app_id !== 'string' || item.provenance.app_id.length === 0 ||
      typeof item.provenance.name !== 'string' || item.provenance.name.length === 0 ||
      (item.provenance.actions_run_id !== null && (typeof item.provenance.actions_run_id !== 'string' || !RUN_ID.test(item.provenance.actions_run_id)))
    ) violation('shared_evidence_checks_invalid')
    identities.add(identity)
  }
  return deepFreezeCopy(value)
}

const validateThreads = (value) => {
  exactKeys(value, ['completeness', 'page_count', 'item_count', 'items'], 'shared_evidence_threads_invalid')
  if (!Array.isArray(value.items)) violation('shared_evidence_threads_invalid')
  validateCompletenessEnvelope(value, value.items.length, 'shared_evidence_threads_invalid')
  const identities = new Set()
  for (const item of value.items) {
    exactKeys(item, ['thread_id', 'resolved', 'outdated'], 'shared_evidence_threads_invalid')
    if (
      typeof item.thread_id !== 'string' || item.thread_id.length === 0 || item.thread_id.length > 128 ||
      identities.has(item.thread_id) || typeof item.resolved !== 'boolean' || typeof item.outdated !== 'boolean'
    ) violation('shared_evidence_threads_invalid')
    identities.add(item.thread_id)
  }
  return deepFreezeCopy(value)
}

const validateState = (value, binding) => {
  exactKeys(value, ['completeness', 'task', 'pull', 'task_state'], 'shared_evidence_state_invalid')
  if (!COMPLETENESS.has(value.completeness)) violation('shared_evidence_state_invalid')
  exactKeys(value.task, ['repository', 'number', 'state', 'is_pull_request'], 'shared_evidence_state_invalid')
  exactKeys(value.pull, ['repository', 'number', 'state', 'head'], 'shared_evidence_state_invalid')
  if (
    value.task.repository !== binding.repository || value.task.number !== binding.task_issue_number ||
    value.task.state !== 'open' || value.task.is_pull_request !== false ||
    value.pull.repository !== binding.repository || value.pull.number !== binding.pr_number ||
    value.pull.state !== 'open' || !FULL_HEAD.test(value.pull.head ?? '')
  ) violation('shared_evidence_state_invalid')
  const taskState = validateTaskState(value.task_state)
  if (taskState.task_issue_number !== binding.task_issue_number || taskState.pr_number !== binding.pr_number) violation('shared_evidence_state_invalid')
  return deepFreezeCopy({ ...value, task_state: taskState })
}

const validateScope = (value) => {
  exactKeys(value, ['completeness', 'actual_paths', 'authorized_paths'], 'shared_evidence_scope_invalid')
  if (!COMPLETENESS.has(value.completeness) || !Array.isArray(value.actual_paths) || !Array.isArray(value.authorized_paths)) {
    violation('shared_evidence_scope_invalid')
  }
  for (const paths of [value.actual_paths, value.authorized_paths]) {
    if (paths.some((item) => !isRepositoryRelativePathV1(item)) || new Set(paths).size !== paths.length ||
      paths.some((item, index) => index > 0 && item <= paths[index - 1])) violation('shared_evidence_scope_invalid')
  }
  return deepFreezeCopy(value)
}

const validateAdmissionInputs = (value) => {
  exactKeys(value, ['transition', 'required_check_ids', 'production_rto_owner'], 'shared_evidence_admission_inputs_invalid')
  exactKeys(value.production_rto_owner, ['workflow', 'runner'], 'shared_evidence_admission_inputs_invalid')
  if (
    !['terminal_review_admission', 'merge_decision_admission'].includes(value.transition) ||
    !Array.isArray(value.required_check_ids) || value.required_check_ids.some((item) => typeof item !== 'string' || !ID.test(item)) ||
    new Set(value.required_check_ids).size !== value.required_check_ids.length ||
    value.required_check_ids.some((item, index) => index > 0 && item <= value.required_check_ids[index - 1]) ||
    value.production_rto_owner.workflow !== '.github/workflows/protected-transition-admission-v1.yml' ||
    value.production_rto_owner.runner !== 'scripts/run-protected-transition-admission-v1.mjs'
  ) violation('shared_evidence_admission_inputs_invalid')
  return deepFreezeCopy(value)
}

const validateRecordAPayload = (payload) => {
  exactKeys(payload, [
    'binding', 'source_manifest', 'review_history', 'checks', 'threads', 'state', 'authorized_scope',
    'admission_inputs', 'capture_ambiguities', 'proof_capable', 'authority',
  ], 'shared_evidence_schema_invalid')
  const binding = validateBinding(payload.binding)
  const components = {
    admission_inputs: validateAdmissionInputs(payload.admission_inputs),
    authorized_scope: validateScope(payload.authorized_scope),
    binding,
    checks: validateChecks(payload.checks, binding),
    review_history: validateReviewHistory(payload.review_history, binding),
    state: validateState(payload.state, binding),
    threads: validateThreads(payload.threads),
  }
  if (!Array.isArray(payload.source_manifest) || payload.source_manifest.length !== RECORD_A_SOURCES.length) {
    violation('shared_evidence_manifest_invalid')
  }
  payload.source_manifest.forEach((entry, index) => {
    exactKeys(entry, ['source_id', 'sha256'], 'shared_evidence_manifest_invalid')
    const sourceId = RECORD_A_SOURCES[index]
    if (entry.source_id !== sourceId || entry.sha256 !== digestSharedEvidenceV1(components[sourceId])) {
      violation('shared_evidence_manifest_invalid')
    }
  })
  if (
    !Array.isArray(payload.capture_ambiguities) ||
    payload.capture_ambiguities.some((item) => !CAPTURE_AMBIGUITIES.has(item)) ||
    new Set(payload.capture_ambiguities).size !== payload.capture_ambiguities.length ||
    payload.capture_ambiguities.some((item, index) => index > 0 && item <= payload.capture_ambiguities[index - 1]) ||
    typeof payload.proof_capable !== 'boolean' || payload.authority !== 'NONE'
  ) violation('shared_evidence_schema_invalid')
  const complete = [components.review_history, components.checks, components.threads, components.state, components.authorized_scope]
    .every((item) => item.completeness === 'COMPLETE') && payload.capture_ambiguities.length === 0
  if (payload.proof_capable !== complete) violation('shared_evidence_proof_capability_invalid')
  return deepFreezeCopy({ ...payload, ...components })
}

const seal = (recordType, payload) => deepFreezeCopy({
  record_type: recordType,
  payload,
  sha256: digestSharedEvidenceV1(payload),
})

export const createSharedSealedEvidenceV1 = (input) => {
  exactKeys(input, [
    'binding', 'review_history', 'checks', 'threads', 'state', 'authorized_scope', 'admission_inputs', 'capture_ambiguities',
  ], 'shared_evidence_schema_invalid')
  const sourceValues = Object.fromEntries(RECORD_A_SOURCES.map((sourceId) => [sourceId, input[sourceId]]))
  const complete = [input.review_history, input.checks, input.threads, input.state, input.authorized_scope]
    .every((item) => item?.completeness === 'COMPLETE') && input.capture_ambiguities.length === 0
  const payload = {
    ...input,
    source_manifest: RECORD_A_SOURCES.map((sourceId) => ({ source_id: sourceId, sha256: digestSharedEvidenceV1(sourceValues[sourceId]) })),
    proof_capable: complete,
    authority: 'NONE',
  }
  return validateSharedSealedEvidenceV1(seal(GADP_SHARED_SEALED_EVIDENCE_V1, payload))
}

export const validateSharedSealedEvidenceV1 = (record) => {
  exactKeys(record, ['record_type', 'payload', 'sha256'], 'shared_evidence_record_invalid')
  if (record.record_type !== GADP_SHARED_SEALED_EVIDENCE_V1 || !SHA256.test(record.sha256 ?? '') ||
    digestSharedEvidenceV1(record.payload) !== record.sha256) violation('shared_evidence_record_invalid')
  return deepFreezeCopy({ ...record, payload: validateRecordAPayload(record.payload) })
}

export const isSharedHeadBindingStaleV1 = (recordInput) => {
  const record = validateSharedSealedEvidenceV1(recordInput)
  const { binding, state } = record.payload
  return state.pull.head !== binding.exact_head ||
    state.task_state.observed_head !== state.pull.head ||
    (state.task_state.review_status !== 'PENDING' && state.task_state.reviewed_head !== state.pull.head)
}

export const validateParitySemanticV1 = (value) => {
  exactKeys(value, [
    'state', 'allowed', 'reason_family', 'next_action', 'external_check_success_count', 'blocking_thread_count',
  ], 'parity_semantic_invalid')
  const tuple = `${value.state}\0${value.allowed}\0${value.reason_family}\0${value.next_action}`
  if (
    !SEMANTIC_TUPLES.has(tuple) || !REASON_FAMILIES.has(value.reason_family) ||
    !nonNegativeInteger(value.external_check_success_count) || !nonNegativeInteger(value.blocking_thread_count)
  ) violation('parity_semantic_invalid')
  return deepFreezeCopy(value)
}

const validateProjectionPayload = (payload, recordType) => {
  exactKeys(payload, [
    'record_a_sha256', 'binding', 'projection_status', 'projection_reason', 'semantics',
    'proof_capable', 'authority', 'provider_invocation_count', 'protected_operation_count',
  ], 'parity_projection_schema_invalid')
  const binding = validateBinding(payload.binding, 'parity_projection_binding_invalid')
  const reasons = recordType === GADP_PRODUCTION_PARITY_PROJECTION_V1
    ? PRODUCTION_PROJECTION_REASONS
    : GENERIC_PROJECTION_REASONS
  if (
    !SHA256.test(payload.record_a_sha256 ?? '') || !PROJECTION_STATUSES.has(payload.projection_status) ||
    !reasons.has(payload.projection_reason) || typeof payload.proof_capable !== 'boolean' ||
    payload.authority !== 'NONE' || payload.provider_invocation_count !== 0 || payload.protected_operation_count !== 0
  ) violation('parity_projection_schema_invalid')
  if (payload.projection_status === 'COMPARABLE') {
    const expectedReason = recordType === GADP_PRODUCTION_PARITY_PROJECTION_V1 ? 'PRODUCTION_TUPLE_MAPPED' : 'GENERIC_TUPLE_MAPPED'
    if (payload.projection_reason !== expectedReason || !payload.proof_capable || payload.semantics === null) {
      violation('parity_projection_schema_invalid')
    }
    validateParitySemanticV1(payload.semantics)
  } else if (payload.semantics !== null || payload.proof_capable) {
    violation('parity_projection_schema_invalid')
  }
  return deepFreezeCopy({ ...payload, binding })
}

const createProjection = (recordType, payload) => validateParityProjectionRecordV1(seal(recordType, payload), recordType)

export const createProductionParityProjectionV1 = (payload) => createProjection(GADP_PRODUCTION_PARITY_PROJECTION_V1, payload)
export const createGenericResultV1 = (payload) => createProjection(GADP_GENERIC_RESULT_V1, payload)

const validateParityProjectionRecordV1 = (record, recordType) => {
  exactKeys(record, ['record_type', 'payload', 'sha256'], 'parity_projection_record_invalid')
  if (record.record_type !== recordType || !SHA256.test(record.sha256 ?? '') || digestSharedEvidenceV1(record.payload) !== record.sha256) {
    violation('parity_projection_record_invalid')
  }
  return deepFreezeCopy({ ...record, payload: validateProjectionPayload(record.payload, recordType) })
}

export const validateProductionParityProjectionV1 = (record) =>
  validateParityProjectionRecordV1(record, GADP_PRODUCTION_PARITY_PROJECTION_V1)
export const validateGenericResultV1 = (record) => validateParityProjectionRecordV1(record, GADP_GENERIC_RESULT_V1)

const validateComparisonPayload = (payload) => {
  exactKeys(payload, [
    'record_a_sha256', 'production_record_sha256', 'generic_result_sha256', 'binding',
    'parity_binding', 'semantic', 'reason', 'proof_pass', 'authority', 'a_pass', 'cutover_ready',
  ], 'parity_comparison_schema_invalid')
  if (
    (payload.record_a_sha256 !== null && !SHA256.test(payload.record_a_sha256)) ||
    (payload.production_record_sha256 !== null && !SHA256.test(payload.production_record_sha256)) ||
    (payload.generic_result_sha256 !== null && !SHA256.test(payload.generic_result_sha256)) ||
    (payload.binding !== null && !plainObject(payload.binding)) ||
    !['MATCHED', 'CONFLICT', 'INVALID'].includes(payload.parity_binding) ||
    !['MATCH', 'MISMATCH', 'NOT_COMPARABLE'].includes(payload.semantic) ||
    !['SEMANTIC_MATCH', 'SEMANTIC_MISMATCH', 'PROJECTION_NOT_COMPARABLE', 'BINDING_CONFLICT', 'INPUT_INVALID'].includes(payload.reason) ||
    typeof payload.proof_pass !== 'boolean' || payload.authority !== 'NONE' ||
    payload.a_pass !== 'NOT_OBSERVED' || payload.cutover_ready !== false
  ) violation('parity_comparison_schema_invalid')
  if (payload.binding !== null) validateBinding(payload.binding, 'parity_comparison_schema_invalid')
  const expectedReason = payload.parity_binding === 'INVALID'
    ? 'INPUT_INVALID'
    : payload.parity_binding === 'CONFLICT'
      ? 'BINDING_CONFLICT'
      : payload.semantic === 'MATCH'
        ? 'SEMANTIC_MATCH'
        : payload.semantic === 'MISMATCH' ? 'SEMANTIC_MISMATCH' : 'PROJECTION_NOT_COMPARABLE'
  if (payload.reason !== expectedReason) violation('parity_comparison_schema_invalid')
  if (payload.parity_binding === 'MATCHED') {
    if (payload.record_a_sha256 === null || payload.production_record_sha256 === null || payload.generic_result_sha256 === null || payload.binding === null) {
      violation('parity_comparison_schema_invalid')
    }
  } else if (payload.record_a_sha256 !== null || payload.binding !== null ||
    (payload.parity_binding === 'CONFLICT' && (payload.production_record_sha256 === null || payload.generic_result_sha256 === null))) {
    violation('parity_comparison_schema_invalid')
  }
  if (payload.proof_pass !== (payload.parity_binding === 'MATCHED' && payload.semantic === 'MATCH')) {
    violation('parity_comparison_schema_invalid')
  }
  if (payload.parity_binding !== 'MATCHED' && payload.semantic !== 'NOT_COMPARABLE') violation('parity_comparison_schema_invalid')
  return deepFreezeCopy(payload)
}

export const createParityComparisonV1 = (payload) =>
  validateParityComparisonV1(seal(GADP_PARITY_COMPARISON_V1, payload))

export const validateParityComparisonV1 = (record) => {
  exactKeys(record, ['record_type', 'payload', 'sha256'], 'parity_comparison_record_invalid')
  if (record.record_type !== GADP_PARITY_COMPARISON_V1 || !SHA256.test(record.sha256 ?? '') ||
    digestSharedEvidenceV1(record.payload) !== record.sha256) violation('parity_comparison_record_invalid')
  return deepFreezeCopy({ ...record, payload: validateComparisonPayload(record.payload) })
}

export const sharedEvidenceSourceManifestV1 = () => RECORD_A_SOURCES
