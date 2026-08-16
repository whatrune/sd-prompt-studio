import { ContractViolationV1 } from '../core/contracts-v1.mjs'
import {
  evaluateAdmissionV1,
  evaluateTerminalEvidenceV1,
  selectCurrentReviewLeafV1,
} from '../core/identity-review-admission-v1.mjs'
import { validateProjectAdapterV1 } from '../core/project-adapter-v1.mjs'
import { digestCanonicalV1, sealRoleDispatchV1 } from '../core/role-dispatch-v1.mjs'
import { registeredCatalogSnapshotV1 } from '../host/registered-command-catalog-v1.mjs'

export const SDPS_SHADOW_RESULT_V1 = 'sdps_shadow_parity_result_v1'

const BOUNDARIES = Object.freeze([
  'identity',
  'current_leaf_review',
  'terminal_evidence',
  'admission',
  'role_dispatch_binding',
])
const FULL_HEAD = /^[0-9a-f]{40}$/
const SHA256 = /^[0-9a-f]{64}$/
const STRICT_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/
const PRODUCTION_REPOSITORY = 'whatrune/sd-prompt-studio'
const PRODUCTION_OWNER = Object.freeze({
  workflow: '.github/workflows/protected-transition-admission-v1.yml',
  runner: 'scripts/run-protected-transition-admission-v1.mjs',
})
const REQUIRED_CHECK_NAMES = Object.freeze(new Map([
  ['build-preview', Object.freeze({ check_id: 'build-preview', app_id: '15368' })],
  ['Cloudflare Pages', Object.freeze({ check_id: 'cloudflare-pages', app_id: '85455' })],
]))
const SELF_CHECK_NAMES = Object.freeze(new Map([
  ['protected_transition_admission_v1', Object.freeze({ check_id: 'rto-admission', app_id: '15368' })],
  ['protected_transition_repair_executor_v1', Object.freeze({ check_id: 'rto-repair', app_id: '15368' })],
  ['protected_transition_role_dispatch_consumer_v1', Object.freeze({ check_id: 'rto-role-dispatch', app_id: '15368' })],
  ['protected_transition_post_repair_review_v1', Object.freeze({ check_id: 'rto-post-repair-review', app_id: '15368' })],
  ['protected_transition_merge_operator_v1', Object.freeze({ check_id: 'rto-merge-operator', app_id: '15368' })],
]))
const COMPLETENESS_STATES = new Set(['COMPLETE', 'INCOMPLETE', 'NOT_APPLICABLE'])
const PRODUCTION_ADMISSION_STATES = new Set(['MERGE_ELIGIBLE', 'REVIEW_BLOCKED', 'STALE', 'INDETERMINATE'])
const PRODUCTION_ADMISSION_REASONS = new Set([
  'merge_gate_satisfied',
  'blocking_review_threads_present',
  'head_binding_stale',
  'review_decision_candidate_invalid',
])
const PRODUCTION_ADMISSION_NEXT_ACTIONS = new Set(['MERGE_DECISION', 'STOP'])
const PRODUCTION_ADMISSION_TUPLES = new Set([
  'MERGE_ELIGIBLE\0merge_gate_satisfied\0MERGE_DECISION',
  'REVIEW_BLOCKED\0blocking_review_threads_present\0STOP',
  'STALE\0head_binding_stale\0STOP',
  'INDETERMINATE\0review_decision_candidate_invalid\0STOP',
])
const REVIEW_KINDS = new Set([
  'VALID_TARGET_TUPLE',
  'VALID_OTHER_HEAD_OR_PR',
  'MALFORMED_ORDERABLE_MARKER',
  'MALFORMED_UNORDERABLE_MARKER',
])

class ShadowNotComparableV1 extends Error {
  constructor(reason) {
    super(reason)
    this.name = 'ShadowNotComparableV1'
  }
}

const notComparable = (reason) => { throw new ShadowNotComparableV1(reason) }
const plainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
const exactKeys = (value, expected, reason) => {
  if (!plainObject(value)) notComparable(reason)
  const actual = Object.keys(value).sort()
  const canonical = [...expected].sort()
  if (actual.length !== canonical.length || actual.some((key, index) => key !== canonical[index])) notComparable(reason)
}
const positiveInteger = (value) => Number.isSafeInteger(value) && value > 0
const nonNegativeInteger = (value) => Number.isSafeInteger(value) && value >= 0
const deepFreeze = (value) => {
  if (Array.isArray(value)) return Object.freeze(value.map(deepFreeze))
  if (plainObject(value)) return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, child]) => [key, deepFreeze(child)])))
  return value
}

const validateAdapterBoundary = (adapterInput) => {
  const adapter = validateProjectAdapterV1(adapterInput, registeredCatalogSnapshotV1())
  if (
    adapter.project_id !== 'sd-prompt-studio' || adapter.repository.name !== PRODUCTION_REPOSITORY ||
    adapter.paths.writable.length !== 0 || adapter.commands.invocations.length !== 0 ||
    adapter.credentials.required_capability_ids.length !== 0 || adapter.protected_operation_ids.length !== 0 ||
    adapter.repair.max_attempts !== 0 || adapter.repair.max_files !== 0 || adapter.repair.max_diff_bytes !== 0 ||
    adapter.repair.allowed_validation_ids.length !== 0 || adapter.roles.merge_operator_profile_id !== ''
  ) notComparable('shadow_adapter_capability_invalid')
  return adapter
}

const validateIdentitySource = (value) => {
  exactKeys(value, [
    'repository', 'task_issue_number', 'pr_number', 'target_head', 'current_head', 'attempt',
  ], 'identity_evidence_invalid')
  if (
    value.repository !== PRODUCTION_REPOSITORY || !positiveInteger(value.task_issue_number) ||
    !positiveInteger(value.pr_number) || !FULL_HEAD.test(value.target_head ?? '') ||
    !FULL_HEAD.test(value.current_head ?? '') || !positiveInteger(value.attempt)
  ) notComparable('identity_evidence_invalid')
  return deepFreeze({ ...value })
}

const identityContract = (source, head) => Object.freeze({
  record_type: 'gadp_identity_v1',
  repository: source.repository,
  task_issue_number: source.task_issue_number,
  pr_number: source.pr_number,
  exact_head: head,
  attempt: source.attempt,
})

const identityProjection = (source) => Object.freeze({
  repository: source.repository,
  task_issue_number: source.task_issue_number,
  pr_number: source.pr_number,
  target_head: source.target_head,
  current_head: source.current_head,
  attempt: source.attempt,
  binding_state: source.target_head === source.current_head ? 'BOUND' : 'STALE',
})

const expectedActionsRunUrl = (repository, runId) => `https://github.com/${repository}/actions/runs/${runId}`

const validateCaseSeal = (caseInput) => {
  if (!plainObject(caseInput) || !SHA256.test(caseInput.case_sha256 ?? '')) notComparable('fixture_case_invalid')
  const { case_sha256: sealedDigest, ...sealedPayload } = caseInput
  if (digestCanonicalV1(sealedPayload) !== sealedDigest) notComparable('fixture_case_digest_invalid')
}

const validatePaginationCompleteness = ({ value, sourcePayload, reason }) => {
  exactKeys(value, ['state', 'page_count', 'item_count'], 'pagination_completeness_invalid')
  if (!COMPLETENESS_STATES.has(value.state) || !nonNegativeInteger(value.item_count)) {
    notComparable('pagination_completeness_invalid')
  }
  if (value.state === 'COMPLETE') {
    if (!positiveInteger(value.page_count) || !Array.isArray(sourcePayload) || value.item_count !== sourcePayload.length) {
      notComparable('pagination_completeness_invalid')
    }
    return
  }
  if (value.state === 'NOT_APPLICABLE') {
    if (value.page_count !== 0 || value.item_count !== 0 || sourcePayload !== undefined) {
      notComparable('pagination_completeness_invalid')
    }
    return
  }
  if (value.page_count !== null || !Array.isArray(sourcePayload) || value.item_count !== sourcePayload.length) {
    notComparable('pagination_completeness_invalid')
  }
  notComparable(reason)
}

const validateProductionAdmissionProjection = (value) => {
  if (value === null) return null
  exactKeys(value, [
    'state', 'allowed', 'reason', 'next_action', 'external_check_success_count', 'blocking_thread_count',
  ], 'production_admission_projection_invalid')
  if (
    typeof value.state !== 'string' || value.state.length === 0 || typeof value.allowed !== 'boolean' ||
    typeof value.reason !== 'string' || value.reason.length === 0 ||
    typeof value.next_action !== 'string' || value.next_action.length === 0 ||
    !nonNegativeInteger(value.external_check_success_count) || !nonNegativeInteger(value.blocking_thread_count)
  ) notComparable('production_admission_projection_invalid')
  const tuple = `${value.state}\0${value.reason}\0${value.next_action}`
  if (
    !PRODUCTION_ADMISSION_STATES.has(value.state) || !PRODUCTION_ADMISSION_REASONS.has(value.reason) ||
    !PRODUCTION_ADMISSION_NEXT_ACTIONS.has(value.next_action) || !PRODUCTION_ADMISSION_TUPLES.has(tuple)
  ) notComparable('production_admission_projection_invalid')
  return deepFreeze({ ...value })
}

const projectRawProductionAdmission = ({ rawProductionResult, completeness, normalizedProjection }) => {
  exactKeys(rawProductionResult, ['admission', 'progression'], 'raw_production_result_invalid')
  exactKeys(completeness, ['state'], 'raw_production_admission_completeness_invalid')
  if (!COMPLETENESS_STATES.has(completeness.state)) notComparable('raw_production_admission_completeness_invalid')
  if (normalizedProjection === null) {
    if (completeness.state !== 'NOT_APPLICABLE' || rawProductionResult.admission !== null || rawProductionResult.progression !== null) {
      notComparable('raw_production_admission_completeness_invalid')
    }
    return null
  }
  if (completeness.state !== 'COMPLETE') notComparable('production_admission_source_incomplete')
  exactKeys(rawProductionResult.admission, [
    'source_path', 'admission_state', 'admission_allowed', 'admission_reason',
    'external_check_success_count', 'blocking_thread_count',
  ], 'raw_production_admission_invalid')
  exactKeys(rawProductionResult.progression, ['source_path', 'next_action'], 'raw_production_admission_invalid')
  const admission = rawProductionResult.admission
  const progression = rawProductionResult.progression
  if (
    admission.source_path !== 'result.admission' || progression.source_path !== 'result.progression' ||
    typeof admission.admission_state !== 'string' || admission.admission_state.length === 0 ||
    typeof admission.admission_allowed !== 'boolean' ||
    typeof admission.admission_reason !== 'string' || admission.admission_reason.length === 0 ||
    !nonNegativeInteger(admission.external_check_success_count) || !nonNegativeInteger(admission.blocking_thread_count) ||
    typeof progression.next_action !== 'string' || progression.next_action.length === 0
  ) notComparable('raw_production_admission_invalid')
  const projected = Object.freeze({
    state: admission.admission_state,
    allowed: admission.admission_allowed,
    reason: admission.admission_reason,
    next_action: progression.next_action,
    external_check_success_count: admission.external_check_success_count,
    blocking_thread_count: admission.blocking_thread_count,
  })
  if (digestCanonicalV1(projected) !== digestCanonicalV1(normalizedProjection)) {
    notComparable('production_admission_projection_binding_invalid')
  }
  return projected
}

const validateReviewPayload = (value) => {
  exactKeys(value, [
    'pr_number', 'reviewed_head', 'decision', 'blocking_finding_count', 'remaining_finding_count', 'unknown_count',
  ], 'review_evidence_invalid')
  if (
    !positiveInteger(value.pr_number) || !FULL_HEAD.test(value.reviewed_head ?? '') ||
    !['APPROVE', 'CHANGES_REQUIRED', 'BLOCKED'].includes(value.decision) ||
    !nonNegativeInteger(value.blocking_finding_count) || !nonNegativeInteger(value.remaining_finding_count) ||
    !nonNegativeInteger(value.unknown_count)
  ) notComparable('review_evidence_invalid')
  return value
}

const projectReviewObservations = (commentsInput, identitySource) => {
  if (!Array.isArray(commentsInput)) notComparable('review_evidence_missing')
  const comments = commentsInput.map((comment) => {
    exactKeys(comment, ['kind', 'comment_id', 'created_at', 'review'], 'review_evidence_invalid')
    if (!REVIEW_KINDS.has(comment.kind)) notComparable('review_evidence_invalid')
    if (comment.kind === 'MALFORMED_UNORDERABLE_MARKER') {
      if (comment.comment_id !== null || comment.created_at !== null || comment.review !== null) notComparable('review_evidence_invalid')
      return { ...comment }
    }
    if (!positiveInteger(comment.comment_id) || typeof comment.created_at !== 'string' || !STRICT_UTC.test(comment.created_at)) {
      notComparable('review_evidence_invalid')
    }
    if (comment.kind === 'MALFORMED_ORDERABLE_MARKER') {
      if (comment.review !== null) notComparable('review_evidence_invalid')
      return { ...comment }
    }
    return { ...comment, review: validateReviewPayload(comment.review) }
  })
  if (comments.some((comment) => comment.kind === 'MALFORMED_UNORDERABLE_MARKER')) {
    return Object.freeze([
      Object.freeze({ kind: 'MALFORMED_UNORDERABLE', source_id: null, source_order: null, observed_at: null, review: null }),
    ])
  }
  comments.sort((left, right) => left.created_at.localeCompare(right.created_at) || left.comment_id - right.comment_id)
  return Object.freeze(comments.map((comment, index) => {
    const sourceId = `issue-comment-${comment.comment_id}`
    const sourceOrder = index + 1
    if (comment.kind === 'MALFORMED_ORDERABLE_MARKER') {
      return Object.freeze({
        kind: 'MALFORMED_ORDERABLE', source_id: sourceId, source_order: sourceOrder,
        observed_at: comment.created_at, review: null,
      })
    }
    const reviewIdentity = Object.freeze({
      ...identityContract(identitySource, comment.review.reviewed_head),
      pr_number: comment.review.pr_number,
    })
    return Object.freeze({
      kind: 'VALID',
      source_id: sourceId,
      source_order: sourceOrder,
      observed_at: comment.created_at,
      review: Object.freeze({
        record_type: 'gadp_review_v1',
        identity: reviewIdentity,
        source_id: sourceId,
        source_order: sourceOrder,
        observed_at: comment.created_at,
        decision: comment.review.decision,
        blocking_finding_count: comment.review.blocking_finding_count,
        remaining_finding_count: comment.review.remaining_finding_count,
        unknown_count: comment.review.unknown_count,
      }),
    })
  }))
}

const reviewProjection = (leaf) => {
  if (!leaf.ok) return Object.freeze({ selected: false, reason: leaf.reason })
  const review = leaf.selected_review
  return Object.freeze({
    selected: true,
    source_id: review.source_id,
    reviewed_head: review.identity.exact_head,
    decision: review.decision,
    blocking_finding_count: review.blocking_finding_count,
    remaining_finding_count: review.remaining_finding_count,
    unknown_count: review.unknown_count,
  })
}

const projectChecks = (checksInput, adapter, caseInput) => {
  if (!Array.isArray(checksInput)) notComparable('terminal_evidence_missing')
  const candidates = checksInput.map((check) => {
    exactKeys(check, [
      'type', 'repository', 'actions_run_url', 'actions_run_id', 'source_run_relation', 'classification',
      'name', 'app_id', 'generation_id', 'current_generation', 'started_at', 'status', 'conclusion',
    ], 'check_evidence_invalid')
    if (
      check.type !== 'CheckRun' || check.repository !== PRODUCTION_REPOSITORY ||
      !positiveInteger(check.actions_run_id) ||
      check.actions_run_url !== expectedActionsRunUrl(check.repository, check.actions_run_id) ||
      typeof check.source_run_relation !== 'string' || typeof check.classification !== 'string' ||
      typeof check.name !== 'string' || check.name.length === 0 ||
      typeof check.app_id !== 'string' || check.app_id.length === 0 ||
      typeof check.generation_id !== 'string' || check.generation_id.length === 0 || check.generation_id.length > 128 ||
      typeof check.current_generation !== 'boolean' ||
      typeof check.started_at !== 'string' || !STRICT_UTC.test(check.started_at) ||
      !['queued', 'in_progress', 'completed'].includes(check.status) ||
      (check.status === 'completed'
        ? !['success', 'failure', 'cancelled', 'timed_out', 'skipped'].includes(check.conclusion)
        : check.conclusion !== null)
    ) notComparable('check_evidence_invalid')
    const requiredPolicy = REQUIRED_CHECK_NAMES.get(check.name)
    const selfPolicy = SELF_CHECK_NAMES.get(check.name)
    if (selfPolicy) {
      if (
        check.classification !== 'PRODUCTION_RTO_SELF' || check.app_id !== selfPolicy.app_id ||
        check.source_run_relation !== 'SAME_PRODUCTION_RTO_RUN' || check.actions_run_id !== caseInput.run_id ||
        check.actions_run_url !== caseInput.run_url
      ) notComparable('self_check_identity_unknown')
      return { ...check, check_id: selfPolicy.check_id, required: false }
    }
    if (!requiredPolicy) {
      if (check.classification === 'PRODUCTION_RTO_SELF') notComparable('self_check_identity_unknown')
      notComparable('check_name_unknown')
    }
    if (
      check.classification !== 'EXTERNAL_REQUIRED' || check.app_id !== requiredPolicy.app_id ||
      check.source_run_relation !== 'PR_HEAD_CHECK'
    ) notComparable('check_provenance_ambiguous')
    return { ...check, check_id: requiredPolicy.check_id, required: true }
  })
  const groups = new Map()
  for (const candidate of candidates) {
    const key = `${candidate.app_id}\0${candidate.name}`
    const group = groups.get(key) ?? []
    group.push(candidate)
    groups.set(key, group)
  }
  for (const group of groups.values()) {
    const greatest = Math.max(...group.map((candidate) => Date.parse(candidate.started_at)))
    const selected = group.filter((candidate) => Date.parse(candidate.started_at) === greatest)
    if (
      selected.length !== 1 || !selected[0].current_generation ||
      group.some((candidate) => candidate !== selected[0] && candidate.current_generation)
    ) notComparable('check_generation_ambiguous')
  }
  const projected = candidates.map((candidate) => Object.freeze({
    check_id: candidate.check_id,
    generation_id: candidate.generation_id,
    current: candidate.current_generation,
    required: candidate.required,
    status: candidate.status.toUpperCase(),
    conclusion: candidate.conclusion === null ? null : candidate.conclusion.toUpperCase(),
  }))
  const configured = adapter.validation.required_checks
  const requiredIds = [...REQUIRED_CHECK_NAMES.values()].map((policy) => policy.check_id)
  if (configured.length !== REQUIRED_CHECK_NAMES.size || configured.some((id) => !requiredIds.includes(id))) {
    notComparable('required_check_policy_changed')
  }
  return Object.freeze(projected)
}

const projectThreads = (threadsInput) => {
  if (!Array.isArray(threadsInput)) notComparable('terminal_evidence_missing')
  const seen = new Set()
  return Object.freeze(threadsInput.flatMap((thread) => {
    exactKeys(thread, ['thread_id', 'is_resolved', 'is_outdated'], 'thread_evidence_invalid')
    if (
      typeof thread.thread_id !== 'string' || thread.thread_id.length === 0 || thread.thread_id.length > 128 ||
      typeof thread.is_resolved !== 'boolean' || typeof thread.is_outdated !== 'boolean' || seen.has(thread.thread_id)
    ) notComparable('thread_evidence_invalid')
    seen.add(thread.thread_id)
    return thread.is_outdated ? [] : [Object.freeze({ thread_id: thread.thread_id, resolved: thread.is_resolved })]
  }))
}

const normalizeTerminal = (terminal) => {
  const reason = terminal.reason === 'threads_not_resolved' ? 'blocking_review_threads_present' : terminal.reason
  return Object.freeze({
    checks_terminal: terminal.checks_terminal,
    external_check_success_count: terminal.external_check_success_count,
    blocking_thread_count: terminal.blocking_thread_count,
    reason,
  })
}

const normalizeAdmission = (admission) => {
  const key = `${admission.state}\0${admission.reason}`
  const projection = new Map([
    ['MERGE_ELIGIBLE\0merge_gate_satisfied', ['MERGE_ELIGIBLE', 'merge_gate_satisfied', 'MERGE_DECISION']],
    ['IMPLEMENTATION_BLOCKED\0threads_not_resolved', ['REVIEW_BLOCKED', 'blocking_review_threads_present', 'STOP']],
    ['STALE\0head_binding_stale', ['STALE', 'head_binding_stale', 'STOP']],
    ['INDETERMINATE\0review_current_leaf_invalid', ['INDETERMINATE', 'review_decision_candidate_invalid', 'STOP']],
  ]).get(key)
  if (!projection) notComparable('admission_reason_unknown')
  return Object.freeze({
    state: projection[0],
    allowed: admission.allowed,
    reason: projection[1],
    next_action: projection[2],
    external_check_success_count: admission.external_check_success_count,
    blocking_thread_count: admission.blocking_thread_count,
  })
}

const projectRoleDispatch = ({ admission, reviewLeaf, identity, authorizedPaths, adapter, fixtureId }) => {
  if (!admission.allowed) return Object.freeze({ present: false })
  if (!reviewLeaf.ok) notComparable('role_dispatch_review_missing')
  const envelope = sealRoleDispatchV1({
    identity,
    review: reviewLeaf.selected_review,
    roleId: 'product-owner',
    profileId: adapter.roles.decision_authority_id,
    purpose: 'MERGE_DECISION',
    authorizedPaths,
    capabilityIds: [],
    promptSha256: digestCanonicalV1({ fixture_id: fixtureId, purpose: 'MERGE_DECISION' }),
  })
  return Object.freeze({
    present: true,
    identity: envelope.identity,
    role_id: envelope.role_id,
    profile_id: envelope.profile_id,
    purpose: envelope.purpose,
    source_review_id: envelope.source_review_id,
    authorized_paths: envelope.authorized_paths,
    capability_ids: envelope.capability_ids,
    credential_free: true,
    repository_access: false,
    protected_operation_authorized: false,
  })
}

const validateDigestRecord = (record, reason) => {
  exactKeys(record, ['source_id', 'payload', 'sha256'], reason)
  if (typeof record.source_id !== 'string' || record.source_id.length === 0 || !SHA256.test(record.sha256 ?? '')) notComparable(reason)
  if (digestCanonicalV1(record.payload) !== record.sha256) notComparable('evidence_digest_invalid')
  return record
}

const projectSources = (caseInput) => {
  if (!Array.isArray(caseInput.source_records)) notComparable('source_record_invalid')
  const records = new Map()
  for (const candidate of caseInput.source_records) {
    const record = validateDigestRecord(candidate, 'source_record_invalid')
    if (records.has(record.source_id)) notComparable('source_record_invalid')
    records.set(record.source_id, record.payload)
  }
  return records
}

const validateEvidenceCompleteness = (caseInput, sources) => {
  exactKeys(caseInput.evidence_completeness, [
    'review_history', 'checks', 'review_threads', 'raw_production_admission',
  ], 'evidence_completeness_invalid')
  validatePaginationCompleteness({
    value: caseInput.evidence_completeness.review_history,
    sourcePayload: sources.get('review-comments'),
    reason: 'review_history_pagination_incomplete',
  })
  validatePaginationCompleteness({
    value: caseInput.evidence_completeness.checks,
    sourcePayload: sources.get('checks'),
    reason: 'checks_pagination_incomplete',
  })
  validatePaginationCompleteness({
    value: caseInput.evidence_completeness.review_threads,
    sourcePayload: sources.get('threads'),
    reason: 'review_thread_pagination_incomplete',
  })
}

const comparison = (production, generic, unavailableReason = 'production_boundary_unavailable') => {
  if (production === null) return Object.freeze({ status: 'NOT_COMPARABLE', reason: unavailableReason, production_sha256: null, generic_sha256: null })
  const productionSha = digestCanonicalV1(production)
  const genericSha = digestCanonicalV1(generic)
  return Object.freeze({
    status: productionSha === genericSha ? 'MATCH' : 'MISMATCH',
    reason: productionSha === genericSha ? 'projection_equal' : 'projection_different',
    production_sha256: productionSha,
    generic_sha256: genericSha,
  })
}

const globalNotComparable = (fixtureId, reason) => deepFreeze({
  record_type: SDPS_SHADOW_RESULT_V1,
  fixture_id: fixtureId,
  authority: 'NONE',
  production_owner_unchanged: true,
  mutation_count: 0,
  provider_invocation_count: 0,
  protected_operation_count: 0,
  boundaries: Object.fromEntries(BOUNDARIES.map((boundary) => [boundary, {
    status: 'NOT_COMPARABLE', reason, production_sha256: null, generic_sha256: null,
  }])),
  overall: 'NOT_COMPARABLE',
  proof_pass: false,
  a_pass: 'NOT_OBSERVED',
  cutover_ready: false,
})

export const evaluateSdpsReadOnlyShadowV1 = ({ immutableEvidenceBundle: caseInput, declarativeAdapter: adapterInput }) => {
  const fixtureId = typeof caseInput?.fixture_id === 'string' ? caseInput.fixture_id : 'unknown-fixture'
  try {
    validateCaseSeal(caseInput)
    const adapter = validateAdapterBoundary(adapterInput)
    exactKeys(caseInput, [
      'fixture_id', 'run_url', 'run_id', 'run_attempt', 'host_sha', 'source_records',
      'evidence_completeness', 'raw_production_result', 'production_result',
      'required_boundaries', 'expected_overall', 'case_sha256',
    ], 'fixture_case_invalid')
    if (
      typeof caseInput.fixture_id !== 'string' || caseInput.fixture_id.length === 0 ||
      caseInput.run_url !== expectedActionsRunUrl(PRODUCTION_REPOSITORY, caseInput.run_id) ||
      !positiveInteger(caseInput.run_id) || !positiveInteger(caseInput.run_attempt) ||
      !FULL_HEAD.test(caseInput.host_sha ?? '') || !Array.isArray(caseInput.required_boundaries) ||
      caseInput.required_boundaries.some((boundary) => !BOUNDARIES.includes(boundary)) ||
      new Set(caseInput.required_boundaries).size !== caseInput.required_boundaries.length ||
      !['MATCH', 'MISMATCH', 'NOT_COMPARABLE'].includes(caseInput.expected_overall)
    ) notComparable('fixture_case_invalid')
    const sources = projectSources(caseInput)
    const productionRecord = validateDigestRecord({ source_id: 'production-result', ...caseInput.production_result }, 'production_result_invalid')
    exactKeys(productionRecord.payload, BOUNDARIES, 'production_result_invalid')
    const normalizedProductionAdmission = validateProductionAdmissionProjection(productionRecord.payload.admission)
    const rawProductionAdmission = projectRawProductionAdmission({
      rawProductionResult: caseInput.raw_production_result,
      completeness: caseInput.evidence_completeness.raw_production_admission,
      normalizedProjection: normalizedProductionAdmission,
    })
    validateEvidenceCompleteness(caseInput, sources)
    const productionProjection = Object.freeze({
      ...productionRecord.payload,
      admission: rawProductionAdmission,
    })
    const identitySource = validateIdentitySource(sources.get('identity'))
    if (identitySource.attempt !== caseInput.run_attempt) notComparable('identity_evidence_invalid')
    const identity = identityContract(identitySource, identitySource.target_head)
    const currentIdentity = identityContract(identitySource, identitySource.current_head)

    let observations = null
    let reviewLeaf = null
    if (sources.has('review-comments')) {
      observations = projectReviewObservations(sources.get('review-comments'), identitySource)
      reviewLeaf = selectCurrentReviewLeafV1({ identity, observations })
    }

    let checks = null
    let threads = null
    let terminal = null
    if (sources.has('checks') && sources.has('threads')) {
      checks = projectChecks(sources.get('checks'), adapter, caseInput)
      threads = projectThreads(sources.get('threads'))
      terminal = evaluateTerminalEvidenceV1({ checks, threads, requiredCheckIds: adapter.validation.required_checks })
    }

    let admission = null
    let normalizedAdmission = null
    if (productionProjection.admission !== null) {
      admission = evaluateAdmissionV1({
        identity,
        currentIdentity,
        reviewObservations: observations ?? [],
        checks: checks ?? [],
        threads: threads ?? [],
        requiredCheckIds: adapter.validation.required_checks,
      })
      normalizedAdmission = normalizeAdmission(admission)
    }

    let roleDispatch = null
    if (productionProjection.role_dispatch_binding !== null) {
      roleDispatch = projectRoleDispatch({
        admission,
        reviewLeaf: reviewLeaf ?? Object.freeze({ ok: false }),
        identity,
        authorizedPaths: sources.get('authorized-paths') ?? [],
        adapter,
        fixtureId: caseInput.fixture_id,
      })
    }

    const genericProjection = Object.freeze({
      identity: identityProjection(identitySource),
      current_leaf_review: reviewLeaf === null ? null : reviewProjection(reviewLeaf),
      terminal_evidence: terminal === null ? null : normalizeTerminal(terminal),
      admission: normalizedAdmission,
      role_dispatch_binding: roleDispatch,
    })
    const boundaries = Object.freeze(Object.fromEntries(BOUNDARIES.map((boundary) => [
      boundary,
      comparison(productionProjection[boundary], genericProjection[boundary]),
    ])))
    const anyMismatch = BOUNDARIES.some((boundary) => boundaries[boundary].status === 'MISMATCH')
    const requiredNotComparable = caseInput.required_boundaries.some((boundary) => boundaries[boundary].status === 'NOT_COMPARABLE')
    const overall = anyMismatch ? 'MISMATCH' : requiredNotComparable ? 'NOT_COMPARABLE' : 'MATCH'
    return deepFreeze({
      record_type: SDPS_SHADOW_RESULT_V1,
      fixture_id: caseInput.fixture_id,
      authority: 'NONE',
      production_owner_unchanged: true,
      mutation_count: 0,
      provider_invocation_count: 0,
      protected_operation_count: 0,
      boundaries,
      overall,
      proof_pass: overall === 'MATCH',
      a_pass: 'NOT_OBSERVED',
      cutover_ready: false,
    })
  } catch (error) {
    const reason = error instanceof ShadowNotComparableV1 || error instanceof ContractViolationV1
      ? error.message
      : 'shadow_evaluation_invalid'
    return globalNotComparable(fixtureId, reason)
  }
}

export const sdpsShadowProductionOwnerV1 = () => PRODUCTION_OWNER
export const sdpsShadowBoundaryNamesV1 = () => BOUNDARIES
