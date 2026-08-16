import assert from 'node:assert/strict'

import {
  evaluateAdmissionV1,
  evaluateTerminalEvidenceV1,
  confirmCurrentReviewLeafV1,
  sameIdentityBindingV1,
  selectCurrentReviewLeafV1,
} from '../src/core/identity-review-admission-v1.mjs'

let assertions = 0
const check = (condition, message) => { assertions += 1; assert.ok(condition, message) }

const identity = (overrides = {}) => ({
  record_type: 'gadp_identity_v1', repository: 'whatrune/sd-prompt-studio', task_issue_number: 251,
  pr_number: 316, exact_head: 'a'.repeat(40), attempt: 1, ...overrides,
})
const review = (overrides = {}) => ({
  record_type: 'gadp_review_v1', identity: identity(), source_id: 'comment-100', source_order: 100, observed_at: '2026-08-16T00:00:02Z',
  decision: 'APPROVE', blocking_finding_count: 0, remaining_finding_count: 0, unknown_count: 0, ...overrides,
})
const valid = (value) => ({ kind: 'VALID', source_id: value.source_id, source_order: value.source_order, observed_at: value.observed_at, review: value })
const malformed = (sourceId, sourceOrder, observedAt) => ({ kind: 'MALFORMED_ORDERABLE', source_id: sourceId, source_order: sourceOrder, observed_at: observedAt, review: null })
const unorderable = () => ({ kind: 'MALFORMED_UNORDERABLE', source_id: null, source_order: null, observed_at: null, review: null })

check(sameIdentityBindingV1(identity(), identity()), 'exact identity binds')
check(!sameIdentityBindingV1(identity(), identity({ exact_head: 'b'.repeat(40) })), 'full HEAD drift rejects')
check(!sameIdentityBindingV1(identity(), identity({ attempt: 2 })), 'attempt drift rejects')

const otherHead = review({ identity: identity({ exact_head: 'b'.repeat(40) }), source_id: 'comment-090', source_order: 90, observed_at: '2026-08-16T00:00:01Z' })
const current = review()
const leaf = selectCurrentReviewLeafV1({
  identity: identity(),
  observations: [malformed('comment-080', 80, '2026-08-16T00:00:00Z'), valid(otherHead), valid(current)],
})
check(leaf.ok && leaf.selected_review.source_id === current.source_id, 'latest valid exact tuple is selected')
check(leaf.historical_malformed_count === 1, 'strictly older malformed residue is bounded and retained')

const laterMalformed = selectCurrentReviewLeafV1({
  identity: identity(), observations: [valid(current), malformed('comment-110', 110, '2026-08-16T00:00:03Z')],
})
check(!laterMalformed.ok && laterMalformed.reason === 'review_current_leaf_invalid', 'later malformed marker fails closed')
const unorderableResult = selectCurrentReviewLeafV1({ identity: identity(), observations: [valid(current), unorderable()] })
check(!unorderableResult.ok && unorderableResult.reason === 'review_current_leaf_invalid', 'unorderable malformed marker fails closed')
const missing = selectCurrentReviewLeafV1({ identity: identity(), observations: [valid(otherHead)] })
check(!missing.ok && missing.reason === 'review_current_leaf_missing', 'absence of exact tuple fails closed')
const identityConflict = selectCurrentReviewLeafV1({
  identity: identity(), observations: [valid(current), valid({ ...current, source_order: 101, decision: 'BLOCKED', blocking_finding_count: 1, remaining_finding_count: 1 })],
})
check(!identityConflict.ok && identityConflict.reason === 'binding_drifted', 'duplicate source identity conflict fails closed')

const confirmed = confirmCurrentReviewLeafV1({ selectedReview: current, freshReview: { ...current } })
const drifted = confirmCurrentReviewLeafV1({ selectedReview: current, freshReview: { ...current, source_order: 101, observed_at: '2026-08-16T00:00:04Z' } })
check(confirmed.ok && confirmed.review.source_id === current.source_id, 'fresh exact Review confirmation succeeds')
check(!drifted.ok && drifted.reason === 'binding_drifted', 'fresh Review drift fails closed')

const oldFailure = { check_id: 'unit-tests', generation_id: 'old', current: false, required: true, status: 'COMPLETED', conclusion: 'FAILURE' }
const currentSuccess = { check_id: 'unit-tests', generation_id: 'current', current: true, required: true, status: 'COMPLETED', conclusion: 'SUCCESS' }
const requiredCheckIds = ['unit-tests']
const terminal = evaluateTerminalEvidenceV1({ checks: [oldFailure, currentSuccess], threads: [{ thread_id: 'thread-1', resolved: true }], requiredCheckIds })
check(terminal.ok && terminal.external_check_success_count === 1, 'historical check generation is not reused or poisoning')
const missingCheck = evaluateTerminalEvidenceV1({ checks: [], threads: [], requiredCheckIds })
check(!missingCheck.ok && missingCheck.reason === 'checks_not_terminal', 'missing required current check fails closed')
const pending = evaluateTerminalEvidenceV1({ checks: [{ ...currentSuccess, status: 'IN_PROGRESS', conclusion: null }], threads: [], requiredCheckIds })
check(!pending.ok && pending.reason === 'checks_not_terminal', 'pending current check is non-terminal')
const failed = evaluateTerminalEvidenceV1({ checks: [{ ...currentSuccess, conclusion: 'FAILURE' }], threads: [], requiredCheckIds })
check(!failed.ok && failed.reason === 'checks_not_successful', 'failed current check blocks')
const threaded = evaluateTerminalEvidenceV1({ checks: [currentSuccess], threads: [{ thread_id: 'thread-1', resolved: false }], requiredCheckIds })
check(!threaded.ok && threaded.reason === 'threads_not_resolved' && threaded.blocking_thread_count === 1, 'unresolved thread blocks')

const approvedObservations = [malformed('comment-080', 80, '2026-08-16T00:00:00Z'), valid(otherHead), valid(current)]
const admissionInput = { identity: identity(), currentIdentity: identity(), reviewObservations: approvedObservations, checks: [oldFailure, currentSuccess], threads: [{ thread_id: 'thread-1', resolved: true }], requiredCheckIds }
const eligible = evaluateAdmissionV1(admissionInput)
check(eligible.allowed && eligible.state === 'MERGE_ELIGIBLE' && eligible.reason === 'merge_gate_satisfied', 'complete current evidence is eligible')
const stale = evaluateAdmissionV1({ ...admissionInput, currentIdentity: identity({ exact_head: 'b'.repeat(40) }) })
check(!stale.allowed && stale.state === 'STALE' && stale.reason === 'head_binding_stale', 'fresh HEAD drift is stale')
const reviewBlockedLeaf = selectCurrentReviewLeafV1({
  identity: identity(),
  observations: [valid(review({ decision: 'CHANGES_REQUIRED', blocking_finding_count: 1, remaining_finding_count: 1 }))],
})
const blockingReview = reviewBlockedLeaf.selected_review
const reviewBlocked = evaluateAdmissionV1({ ...admissionInput, reviewObservations: [valid(blockingReview)] })
check(!reviewBlocked.allowed && reviewBlocked.state === 'REVIEW_BLOCKED', 'non-approvable Review blocks Admission')
const checkBlocked = evaluateAdmissionV1({ ...admissionInput, checks: [{ ...currentSuccess, conclusion: 'FAILURE' }], threads: [] })
check(!checkBlocked.allowed && checkBlocked.state === 'IMPLEMENTATION_BLOCKED', 'failed terminal evidence blocks Admission')
const noReview = evaluateAdmissionV1({ ...admissionInput, reviewObservations: [valid(otherHead)] })
check(!noReview.allowed && noReview.state === 'REVIEW_PENDING', 'missing current Review remains pending')

const sameSecondBlocking = review({
  source_id: 'opaque-source-z', source_order: 101, observed_at: current.observed_at,
  decision: 'CHANGES_REQUIRED', blocking_finding_count: 1, remaining_finding_count: 1,
})
const sameSecondLeaf = selectCurrentReviewLeafV1({ identity: identity(), observations: [valid(current), valid(sameSecondBlocking)] })
check(sameSecondLeaf.ok && sameSecondLeaf.selected_review.decision === 'CHANGES_REQUIRED', 'monotonic source order selects newer same-second blocking Review')
const duplicateOrder = selectCurrentReviewLeafV1({
  identity: identity(), observations: [valid(current), valid({ ...sameSecondBlocking, source_order: current.source_order })],
})
check(!duplicateOrder.ok && duplicateOrder.reason === 'review_current_leaf_invalid', 'duplicate source order fails closed')
const descendingOrder = selectCurrentReviewLeafV1({ identity: identity(), observations: [valid(sameSecondBlocking), valid(current)] })
check(!descendingOrder.ok && descendingOrder.reason === 'review_current_leaf_invalid', 'non-monotonic source order fails closed')

const forgedReducerBypass = evaluateAdmissionV1({
  ...admissionInput,
  reviewObservations: [],
  reviewLeaf: { ok: true, selected_review: current },
  terminalEvidence: { ok: true, checks_terminal: true, external_check_success_count: 99, blocking_thread_count: 0 },
})
check(!forgedReducerBypass.allowed && forgedReducerBypass.state === 'REVIEW_PENDING', 'caller-forged reducer objects cannot grant eligibility')
const forgedThreadBypass = evaluateAdmissionV1({
  ...admissionInput,
  threads: [{ thread_id: 'thread-1', resolved: false }],
  terminalEvidence: { ok: true, checks_terminal: true, external_check_success_count: 99, blocking_thread_count: 0 },
})
check(!forgedThreadBypass.allowed && forgedThreadBypass.reason === 'threads_not_resolved', 'caller cannot bypass Core-owned thread evaluation')
const forgedCheckBypass = evaluateAdmissionV1({
  ...admissionInput,
  checks: [],
  terminalEvidence: { ok: true, checks_terminal: true, external_check_success_count: 99, blocking_thread_count: 0 },
})
check(!forgedCheckBypass.allowed && forgedCheckBypass.reason === 'checks_not_terminal', 'caller cannot bypass Core-owned required-check evaluation')

const source = await import('../src/core/identity-review-admission-v1.mjs').then(() => '')
check(source === '' && !Object.hasOwn(await import('../src/core/identity-review-admission-v1.mjs'), 'executeRepairV1'), 'Slice 3 exports no Repair behavior')
check(!Object.hasOwn(await import('../src/core/identity-review-admission-v1.mjs'), 'executeMergeOperatorV1'), 'Slice 3 exports no Merge Operator behavior')

check(assertions === 29, 'Slice 3 assertion count is stable')
process.stdout.write(`identity-review-admission-v1: ${assertions} assertions passed\n`)
