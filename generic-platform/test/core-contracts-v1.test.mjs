import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import {
  ContractViolationV1,
  createFailClosedAdmissionResultV1,
  isRepositoryRelativePathV1,
  validateAdmissionResultV1,
  validateIdentityV1,
  validateReviewV1,
  validateRoleDispatchEnvelopeV1,
} from '../src/core/contracts-v1.mjs'

const fixtureUrl = new URL('../fixtures/core-contracts-v1.json', import.meta.url)
const fixtures = JSON.parse(await readFile(fixtureUrl, 'utf8'))
let assertions = 0
const check = (condition, message) => {
  assertions += 1
  assert.ok(condition, message)
}
const rejectsContract = (operation, reason) => {
  assertions += 1
  assert.throws(operation, (error) => error instanceof ContractViolationV1 && error.message === reason)
}

const identity = validateIdentityV1(fixtures.identity)
const review = validateReviewV1(fixtures.review)
const admission = validateAdmissionResultV1(fixtures.admission)
const dispatch = validateRoleDispatchEnvelopeV1(fixtures.dispatch)

check(Object.isFrozen(identity) && identity.exact_head === 'a'.repeat(40), 'identity is immutable and full-HEAD bound')
check(Object.isFrozen(review) && Object.isFrozen(review.identity) && review.decision === 'APPROVE', 'review is immutable and complete')
check(admission.allowed === true && admission.state === 'MERGE_ELIGIBLE', 'eligible Admission contract is internally consistent')
check(Object.isFrozen(dispatch.authorized_paths) && Object.isFrozen(dispatch.capability_ids), 'dispatch collections are immutable')
check(JSON.stringify(fixtures) === JSON.stringify(JSON.parse(await readFile(fixtureUrl, 'utf8'))), 'fixture bytes project deterministic JSON values')

rejectsContract(() => validateIdentityV1({ ...fixtures.identity, exact_head: 'abc' }), 'identity_contract_invalid')
rejectsContract(() => validateIdentityV1({ ...fixtures.identity, extra: true }), 'identity_contract_invalid')
rejectsContract(() => validateReviewV1({ ...fixtures.review, unknown_count: 1 }), 'review_contract_invalid')
rejectsContract(() => validateReviewV1({ ...fixtures.review, decision: 'CHANGES_REQUIRED' }), 'review_contract_invalid')
rejectsContract(() => validateAdmissionResultV1({ ...fixtures.admission, allowed: false }), 'admission_contract_invalid')
rejectsContract(() => validateAdmissionResultV1({ ...fixtures.admission, reason: 'checks_not_terminal' }), 'admission_contract_invalid')
rejectsContract(() => validateRoleDispatchEnvelopeV1({ ...fixtures.dispatch, authorized_paths: ['../escape'] }), 'role_dispatch_contract_invalid')
for (const invalidPath of ['C:/escape', '\\\\server\\share', '/absolute', '\\absolute', 'safe/../escape', 'safe/./file', `safe/${String.fromCharCode(0)}file`, `safe/${String.fromCharCode(31)}file`, `safe/${String.fromCharCode(127)}file`]) {
  rejectsContract(() => validateRoleDispatchEnvelopeV1({ ...fixtures.dispatch, authorized_paths: [invalidPath] }), 'role_dispatch_contract_invalid')
}
check(isRepositoryRelativePathV1('generic-platform/src/core/contracts-v1.mjs'), 'canonical repository-relative path is accepted')
rejectsContract(() => validateRoleDispatchEnvelopeV1({ ...fixtures.dispatch, capability_ids: ['z-capability', 'a-capability'] }), 'role_dispatch_contract_invalid')
rejectsContract(() => validateRoleDispatchEnvelopeV1({ ...fixtures.dispatch, shell: true }), 'role_dispatch_contract_invalid')

const failClosed = createFailClosedAdmissionResultV1({
  identity: fixtures.identity,
  state: 'INDETERMINATE',
  reason: 'input_invalid',
  reviewSourceId: fixtures.review.source_id,
})
check(failClosed.allowed === false && failClosed.checks_terminal === false, 'fail-closed result cannot grant authority')
rejectsContract(() => createFailClosedAdmissionResultV1({
  identity: fixtures.identity,
  state: 'MERGE_ELIGIBLE',
  reason: 'merge_gate_satisfied',
  reviewSourceId: fixtures.review.source_id,
}), 'fail_closed_result_invalid')

check(assertions === 26, 'Slice 1 assertion count is stable')
process.stdout.write(`core-contracts-v1: ${assertions} assertions passed\n`)
