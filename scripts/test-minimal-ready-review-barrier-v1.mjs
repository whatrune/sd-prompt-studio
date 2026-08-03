import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import {
  CODEX_REVIEW_PRODUCER_V1,
  classifyCodexReviewV1,
  evaluateMinimalReadyReviewBarrierV1,
  reconcileCompletionAfterThreadSnapshotV1,
  validateRawGitHubObservationV1,
  validateTerminalThreadSnapshotShapeV1,
} from '../src/continuous-orchestration/minimal-ready-review-barrier-v1.ts'

const fixturePath = 'scripts/fixtures/minimal-ready-review-barrier-v1.json'
const modulePath = 'src/continuous-orchestration/minimal-ready-review-barrier-v1.ts'
const fixture = JSON.parse(await readFile(fixturePath, 'utf8'))
const source = await readFile(modulePath, 'utf8')
const packageJson = JSON.parse(await readFile('package.json', 'utf8'))
const initialHead = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const clone = structuredClone
const exactKeys = (value, keys) => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key))
const deeplyFrozen = (value) => value === null || typeof value !== 'object' ||
  (Object.isFrozen(value) && Object.values(value).every(deeplyFrozen))
let assertions = 0
const check = (condition, message) => { assertions += 1; assert.ok(condition, message) }

check(fixture.contract_version === 'minimal-ready-review-barrier-validation-v1', 'fixture version')
check(fixture.rows.length === 8, 'exact eight literal rows')
check(new Set(fixture.rows.map((row) => row.row_id)).size === 8, 'row ids unique')
for (const row of fixture.rows) {
  check(exactKeys(row, ['row_id', 'operation', 'input', 'expected']), `${row.row_id} exact row schema`)
  check(typeof row.input === 'object' && row.input !== null, `${row.row_id} literal input`)
  let githubReadCount = 0
  if (row.operation === 'evaluate_barrier') {
    const result = evaluateMinimalReadyReviewBarrierV1(clone(row.input))
    check(result.decision === row.expected.decision, `${row.row_id} decision`)
    check((result.decision === 'blocked' ? result.reason : null) === row.expected.reason, `${row.row_id} reason`)
    check(deeplyFrozen(result), `${row.row_id} immutable result`)
  } else {
    check(row.operation === 'reconcile_completion', `${row.row_id} known operation`)
    const result = reconcileCompletionAfterThreadSnapshotV1(clone(row.input.completion_binding), clone(row.input.new_snapshot))
    check(result.result === row.expected.result, `${row.row_id} result`)
    check(result.reason === row.expected.reason, `${row.row_id} reason`)
    check(JSON.stringify(result.new_thread_ids) === JSON.stringify(row.expected.new_thread_ids), `${row.row_id} new thread ids`)
    check(deeplyFrozen(result), `${row.row_id} immutable result`)
  }
  check(githubReadCount === row.expected.github_read_count, `${row.row_id} pure evaluator GitHub read count`)
}

const positive = clone(fixture.rows[0].input)
check(CODEX_REVIEW_PRODUCER_V1 === 'chatgpt-codex-connector[bot]', 'single producer literal')
check(validateRawGitHubObservationV1(positive.raw_observation), 'positive raw observation admitted')
check(validateTerminalThreadSnapshotShapeV1(positive.terminal_thread_snapshot), 'all-page terminal snapshot admitted')
check(classifyCodexReviewV1(positive.raw_observation).status === 'observed', 'exact-head Codex review observed')
const unrelatedReview = clone(positive)
unrelatedReview.raw_observation.review_submissions.unshift({
  review_id: 'REVIEW-OTHER-01', bot_login: 'other-reviewer[bot]',
  commit_id: unrelatedReview.raw_observation.exact_head, submitted_at: '2026-08-03T01:09:00Z',
})
check(evaluateMinimalReadyReviewBarrierV1(unrelatedReview).reason === 'review_unknown', 'non-Codex producer is rejected by the closed raw observation')

const incompleteQuery = clone(positive)
incompleteQuery.raw_observation.review_listing_state = 'incomplete'
check(evaluateMinimalReadyReviewBarrierV1(incompleteQuery).reason === 'review_unknown', 'incomplete review query blocks as unknown')
const queryError = clone(positive)
queryError.raw_observation.review_listing_state = 'error'
check(evaluateMinimalReadyReviewBarrierV1(queryError).reason === 'review_unknown', 'review query error blocks as unknown')
const duplicateReview = clone(positive)
duplicateReview.raw_observation.review_submissions.push(clone(duplicateReview.raw_observation.review_submissions[0]))
duplicateReview.raw_observation.review_submissions[1].review_id = 'REVIEW-228-DUPLICATE'
check(evaluateMinimalReadyReviewBarrierV1(duplicateReview).reason === 'review_unknown', 'multiple exact-head reviews block as unknown')

const bindingMismatch = clone(positive)
bindingMismatch.terminal_thread_snapshot.exact_head = '2222222222222222222222222222222222222222'
check(evaluateMinimalReadyReviewBarrierV1(bindingMismatch).reason === 'candidate_binding_mismatch', 'snapshot exact-head mismatch blocks')
const staleSnapshot = clone(positive)
staleSnapshot.terminal_thread_snapshot.captured_at = '2026-08-03T01:09:59Z'
check(evaluateMinimalReadyReviewBarrierV1(staleSnapshot).reason === 'snapshot_incomplete', 'pre-review snapshot fails closed as incomplete')
const equalTimestampSnapshot = clone(positive)
equalTimestampSnapshot.terminal_thread_snapshot.captured_at = equalTimestampSnapshot.terminal_thread_snapshot.observed_review_submitted_at
check(evaluateMinimalReadyReviewBarrierV1(equalTimestampSnapshot).decision === 'merge_allowed', 'snapshot captured at review submission is admitted')
const duplicateThread = clone(positive)
duplicateThread.terminal_thread_snapshot.pages[0].threads.push(clone(duplicateThread.terminal_thread_snapshot.pages[0].threads[0]))
check(evaluateMinimalReadyReviewBarrierV1(duplicateThread).reason === 'snapshot_incomplete', 'duplicate thread identity blocks')
const unknownField = clone(positive)
unknownField.raw_observation.producer_inventory = []
check(evaluateMinimalReadyReviewBarrierV1(unknownField).reason === 'review_unknown', 'expanded observation schema blocks')

const completionRow = clone(fixture.rows[7].input)
completionRow.new_snapshot.pages[0].threads = [completionRow.new_snapshot.pages[0].threads[0]]
check(reconcileCompletionAfterThreadSnapshotV1(completionRow.completion_binding, completionRow.new_snapshot).result === 'completion_retained', 'no late thread retains Completion')
const wrongCompletionHead = clone(completionRow)
wrongCompletionHead.new_snapshot.exact_head = '2222222222222222222222222222222222222222'
assert.throws(() => reconcileCompletionAfterThreadSnapshotV1(wrongCompletionHead.completion_binding, wrongCompletionHead.new_snapshot), /authority is invalid/)
assertions += 1
const preReviewCompletionSnapshot = clone(completionRow)
preReviewCompletionSnapshot.new_snapshot.observed_review_submitted_at = '2026-08-03T08:21:00Z'
assert.throws(() => reconcileCompletionAfterThreadSnapshotV1(preReviewCompletionSnapshot.completion_binding, preReviewCompletionSnapshot.new_snapshot), /authority is invalid/)
assertions += 1

check(!/producer_roster|producer_inventory|lifecycle|digest|sha256|framework/i.test(source), 'no generalized producer, lifecycle, or digest framework')
check(!/github approve|merge commit|issue candidate/i.test(source), 'no protected action or issue routing')
check(packageJson.scripts['test:minimal-ready-review-barrier'] === 'node --experimental-strip-types scripts/test-minimal-ready-review-barrier-v1.mjs', 'focused package script registered')
check(packageJson.scripts['test:continuous-orchestration'].endsWith('node --experimental-strip-types scripts/test-minimal-ready-review-barrier-v1.mjs'), 'full continuous-orchestration regression includes barrier')
check(execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() === initialHead, 'test does not change HEAD')

console.log(`Minimal Ready Review Barrier V1: ${assertions} assertions passed across ${fixture.rows.length}/8 rows`)
