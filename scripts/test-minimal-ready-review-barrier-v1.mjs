import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import {
  CODEX_REVIEW_PRODUCER_V1,
  evaluateMinimalReadyReviewBarrierV1,
  reconcileCompletionAfterThreadSnapshotV1,
} from '../src/continuous-orchestration/minimal-ready-review-barrier-v1.ts'
import { evaluateReadyReviewNormalMergeEligibilityV1 } from '../src/continuous-orchestration/ready-review-normal-merge-eligibility-v1.ts'
import {
  POST_TERMINAL_THREAD_SNAPSHOT_V1,
  PRODUCER_TERMINAL_RECEIPT_OBSERVATION_V1,
  READY_REVIEW_TERMINAL_OBSERVATION_ARTIFACT_V1,
  buildReadyReviewTerminalObservationArtifactV1,
  canonicalizeReadyReviewObservationJcsV1,
  digestReadyReviewObservationProjectionV1,
  parseReadyReviewTerminalObservationArtifactV1,
} from '../src/continuous-orchestration/ready-review-terminal-observation-artifact-v1.ts'

const fixturePath = 'scripts/fixtures/minimal-ready-review-barrier-v1.json'
const modulePath = 'src/continuous-orchestration/minimal-ready-review-barrier-v1.ts'
const productionPath = 'src/continuous-orchestration/index.ts'
const eligibilityPath = 'src/continuous-orchestration/ready-review-normal-merge-eligibility-v1.ts'
const collectorPath = 'src/continuous-orchestration/ready-review-terminal-observation-artifact-v1.ts'
const fixture = JSON.parse(await readFile(fixturePath, 'utf8'))
const source = await readFile(modulePath, 'utf8')
const productionSource = await readFile(productionPath, 'utf8')
const eligibilitySource = await readFile(eligibilityPath, 'utf8')
const packageJson = JSON.parse(await readFile('package.json', 'utf8'))
const initialHead = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const exactKeys = (value, keys) => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key))
const deeplyFrozen = (value) => value === null || typeof value !== 'object' ||
  (Object.isFrozen(value) && Object.values(value).every(deeplyFrozen))
let assertions = 0
const check = (condition, message) => { assertions += 1; assert.ok(condition, message) }

const head = '1111111111111111111111111111111111111111'
const repository = 'whatrune/sd-prompt-studio'
const prNumber = 229
const sha = (character) => character.repeat(64)

const buildArtifactJcs = async ({
  artifactRepository = repository,
  artifactPrNumber = prNumber,
  artifactHead = head,
  readyRecordUrl = 'https://github.com/whatrune/sd-prompt-studio/issues/228#issuecomment-5165995549',
  producer = CODEX_REVIEW_PRODUCER_V1,
  readyEventId,
  readyAt,
  reviewId,
  submittedAt,
  observedAt,
  threads,
}) => {
  const sourceProjection = {
    projection_version: 'submitted-review-source-projection-v1',
    kind: 'submitted_review',
    producer_id: producer,
    review_id: reviewId,
    review_url: `https://github.com/whatrune/sd-prompt-studio/pull/${artifactPrNumber}#pullrequestreview-${reviewId.replace(/\D/g, '')}`,
    submitted_at: submittedAt,
    reviewed_head: artifactHead,
    ready_event_id: readyEventId,
    review_state: 'COMMENTED',
    finding_ids: [],
    source_observed_at: submittedAt,
  }
  const receipt = {
    observation_version: PRODUCER_TERMINAL_RECEIPT_OBSERVATION_V1,
    producer_id: producer,
    receipt_id: reviewId,
    receipt_source_url: sourceProjection.review_url,
    receipt_kind: 'submitted_review',
    receipt_created_at: submittedAt,
    reviewed_head: artifactHead,
    ready_event_id: readyEventId,
    source_projection: sourceProjection,
    source_projection_digest: await digestReadyReviewObservationProjectionV1(sourceProjection),
    source_observed_at: submittedAt,
  }
  const pageProjection = {
    page_ordinal: 0,
    start_cursor: null,
    end_cursor: null,
    has_next_page: false,
    nodes: threads.map((thread, index) => ({
      thread_id: thread.thread_id,
      is_resolved: thread.is_resolved,
      is_outdated: thread.is_outdated,
      path: modulePath,
      line: 100 + index,
      start_line: null,
      last_comment_id: `COMMENT-${thread.thread_id}`,
      last_comment_created_at: submittedAt,
    })),
    source_url: `https://api.github.com/repos/whatrune/sd-prompt-studio/pulls/${artifactPrNumber}/threads?page=1`,
    source_observed_at: observedAt,
  }
  const page = { ...pageProjection, page_digest: await digestReadyReviewObservationProjectionV1(pageProjection) }
  const receiptIds = [reviewId]
  const receiptDigest = await digestReadyReviewObservationProjectionV1(receiptIds)
  const snapshotProjection = {
    snapshot_version: POST_TERMINAL_THREAD_SNAPSHOT_V1,
    query_identity: { connection: 'PullRequest.reviewThreads', query_sha256: sha('a') },
    variables_identity: { repository: artifactRepository, pr_number: artifactPrNumber, exact_head: artifactHead, variables_sha256: sha('b') },
    pages: [page],
    terminal_receipt_ids: receiptIds,
    terminal_receipts_digest: receiptDigest,
    last_terminal_receipt_at: submittedAt,
    observed_at: observedAt,
    source_observation_urls: [page.source_url],
  }
  const threadSnapshot = {
    ...snapshotProjection,
    snapshot_digest: await digestReadyReviewObservationProjectionV1(snapshotProjection),
  }
  const artifact = await buildReadyReviewTerminalObservationArtifactV1({
    artifact_version: READY_REVIEW_TERMINAL_OBSERVATION_ARTIFACT_V1,
    repository: artifactRepository,
    pr_number: artifactPrNumber,
    pr_url: `https://github.com/whatrune/sd-prompt-studio/pull/${artifactPrNumber}`,
    exact_head: artifactHead,
    ready_generation_record_url: readyRecordUrl,
    ready_event_id: readyEventId,
    ready_occurred_at: readyAt,
    producer_roster: [producer],
    producer_roster_source_digest: sha('c'),
    producer_receipts: [receipt],
    terminal_receipt_ids: receiptIds,
    terminal_receipts_digest: receiptDigest,
    last_terminal_receipt_at: submittedAt,
    thread_snapshot: threadSnapshot,
  })
  assert.notEqual(artifact, null)
  return canonicalizeReadyReviewObservationJcsV1(artifact)
}

const artifactByCase = new Map()
artifactByCase.set('review_after_ready_clean', await buildArtifactJcs({
  readyEventId: 'READY-228-01', readyAt: '2026-08-03T01:00:00Z', reviewId: 'REVIEW-228-01',
  submittedAt: '2026-08-03T01:10:00Z', observedAt: '2026-08-03T01:11:00Z',
  threads: [{ thread_id: 'THREAD-OLD-01', is_resolved: true, is_outdated: false }],
}))
artifactByCase.set('review_same_second_clean', await buildArtifactJcs({
  readyEventId: 'READY-228-06', readyAt: '2026-08-03T06:00:00Z', reviewId: 'REVIEW-228-06',
  submittedAt: '2026-08-03T06:00:00Z', observedAt: '2026-08-03T06:01:00Z',
  threads: [],
}))
artifactByCase.set('review_after_ready_open_thread', await buildArtifactJcs({
  readyEventId: 'READY-228-07', readyAt: '2026-08-03T07:00:00Z', reviewId: 'REVIEW-228-07',
  submittedAt: '2026-08-03T07:10:00Z', observedAt: '2026-08-03T07:11:00Z',
  threads: [{ thread_id: 'THREAD-OPEN-07', is_resolved: false, is_outdated: false }],
}))
artifactByCase.set('review_after_completion_new_thread', await buildArtifactJcs({
  readyEventId: 'READY-228-08', readyAt: '2026-08-03T08:00:00Z', reviewId: 'REVIEW-228-08',
  submittedAt: '2026-08-03T08:10:00Z', observedAt: '2026-08-03T08:20:00Z',
  threads: [
    { thread_id: 'THREAD-TERMINAL-08', is_resolved: true, is_outdated: false },
    { thread_id: 'THREAD-NEW-08', is_resolved: false, is_outdated: false },
  ],
}))
const unsealed = JSON.parse(artifactByCase.get('review_after_ready_clean'))
unsealed.artifact_digest = sha('0')
artifactByCase.set('unsealed', canonicalizeReadyReviewObservationJcsV1(unsealed))
artifactByCase.set('missing', null)

check(fixture.contract_version === 'minimal-ready-review-barrier-validation-v1', 'fixture version')
check(fixture.eligibility_matrix_version === 'ready-review-normal-merge-eligibility-validation-v1', 'eligibility matrix version')
check(fixture.eligibility_rows.length === 17, 'exact CAA002 eligibility matrix rows')
check(new Set(fixture.eligibility_rows.map((row) => row.row_id)).size === 17, 'eligibility row ids unique')
for (const row of fixture.eligibility_rows) {
  check(exactKeys(row, ['row_id', 'expected_kind', 'expected_reason', 'barrier_calls']), `${row.row_id} exact matrix row`)
}
check(fixture.rows.length === 8, 'exact eight focused rows')
check(new Set(fixture.rows.map((row) => row.row_id)).size === 8, 'row ids unique')
for (const row of fixture.rows) {
  check(exactKeys(row, ['row_id', 'operation', 'artifact_case', 'timeout_reached', 'expected']), `${row.row_id} exact row schema`)
  const artifactJcs = artifactByCase.get(row.artifact_case)
  check(artifactByCase.has(row.artifact_case), `${row.row_id} known artifact case`)
  if (row.operation === 'evaluate_barrier') {
    const input = {
      input_version: 'minimal-ready-review-barrier-v1',
      terminal_observation_artifact_jcs: artifactJcs,
      timeout_reached: row.timeout_reached,
    }
    const result = await evaluateMinimalReadyReviewBarrierV1(input)
    check(result.decision === row.expected.decision, `${row.row_id} barrier decision`)
    check((result.decision === 'blocked' ? result.reason : null) === row.expected.reason, `${row.row_id} reason`)
    check(deeplyFrozen(result), `${row.row_id} immutable result`)
    check(Object.isFrozen(result), `${row.row_id} barrier result sealed`)
  } else {
    check(row.operation === 'reconcile_completion', `${row.row_id} known operation`)
    const completion = {
      repo: repository,
      pr_number: prNumber,
      exact_head: head,
      ready_event_id: 'READY-228-08',
      observed_review_id: 'REVIEW-228-08',
      terminal_snapshot_captured_at: '2026-08-03T08:11:00Z',
      terminal_thread_ids: ['THREAD-TERMINAL-08'],
      completion_id: 'COMPLETION-228-08',
      completed_at: '2026-08-03T08:12:00Z',
    }
    const result = await reconcileCompletionAfterThreadSnapshotV1(completion, artifactJcs)
    check(result.result === row.expected.result, `${row.row_id} result`)
    check(result.reason === row.expected.reason, `${row.row_id} reason`)
    check(JSON.stringify(result.new_thread_ids) === JSON.stringify(row.expected.new_thread_ids), `${row.row_id} new thread ids`)
    check(deeplyFrozen(result), `${row.row_id} immutable result`)
  }
}

const validArtifactJcs = artifactByCase.get('review_after_ready_clean')
check((await parseReadyReviewTerminalObservationArtifactV1(validArtifactJcs)) !== null, 'sealed Collector artifact admitted')
check((await parseReadyReviewTerminalObservationArtifactV1(`${validArtifactJcs}\n`)) === null, 'second artifact byte representation rejected')
check((await evaluateMinimalReadyReviewBarrierV1({
  input_version: 'minimal-ready-review-barrier-v1',
  terminal_observation_artifact_jcs: `${validArtifactJcs}\n`,
  timeout_reached: false,
})).reason === 'review_unknown', 'non-canonical artifact bytes fail closed')
check((await evaluateMinimalReadyReviewBarrierV1({
  input_version: 'minimal-ready-review-barrier-v1',
  terminal_observation_artifact_jcs: validArtifactJcs,
  timeout_reached: true,
})).reason === 'review_timeout', 'timeout precedes observed review')
check((await evaluateMinimalReadyReviewBarrierV1({
  input_version: 'minimal-ready-review-barrier-v1',
  raw_observation: {},
  timeout_reached: false,
  terminal_thread_snapshot: {},
})).reason === 'review_unknown', 'caller-composed observation and snapshot rejected')

const eligibilityInput = async (overrides) => {
  const projection = {
    input_version: 'ready-review-normal-merge-eligibility-input-v1',
    repository,
    pr_number: prNumber,
    exact_head: head,
    ready_event_id: 'READY-228-HOST-01',
    ready_record_url: 'https://github.com/whatrune/sd-prompt-studio/issues/228#issuecomment-5165995549',
    sealed_collector_artifact_jcs: null,
    timeout_reached: false,
    ...overrides,
  }
  return { ...projection, attempt_id: await digestReadyReviewObservationProjectionV1(projection) }
}

const runEligibilityCase = async (caseId, input, expected) => {
  const normative = fixture.eligibility_rows.find((row) => row.row_id === caseId)
  check(normative !== undefined, `${caseId} is in the deterministic matrix`)
  check(normative.expected_kind === expected.kind && normative.expected_reason === expected.reason && normative.barrier_calls === expected.barrierCalls,
    `${caseId} expected result is matrix-bound`)
  const result = await evaluateReadyReviewNormalMergeEligibilityV1(input)
  check(result.kind === expected.kind, `${caseId} kind`)
  check((result.kind === 'normal_merge_commit_eligible' ? null : result.reason) === expected.reason, `${caseId} reason`)
  check(result.barrier_invocation_count === expected.barrierCalls, `${caseId} barrier calls`)
  check(result.protected_execution_performed === false, `${caseId} protected action count 0`)
  check(deeplyFrozen(result), `${caseId} immutable result`)
  if (result.kind === 'normal_merge_commit_eligible') {
    check(result.merge_strategy === 'normal_merge_commit', `${caseId} normal merge only`)
    check(result.barrier_decision === 'merge_allowed', `${caseId} barrier receipt dominates eligibility`)
    check(result.ready_record_url === expected.readyRecordUrl, `${caseId} Ready record copied from artifact`)
  }
  return result
}

const hostArtifact01 = await buildArtifactJcs({
  readyEventId: 'READY-228-HOST-01', readyAt: '2026-08-03T09:00:00Z', reviewId: 'REVIEW-228-HOST-01',
  submittedAt: '2026-08-03T09:01:00Z', observedAt: '2026-08-03T09:02:00Z', threads: [],
})
const hostInput01 = await eligibilityInput({ sealed_collector_artifact_jcs: hostArtifact01 })
await runEligibilityCase('MRRH-01', hostInput01, {
  kind: 'normal_merge_commit_eligible', reason: null, barrierCalls: 1,
  readyRecordUrl: 'https://github.com/whatrune/sd-prompt-studio/issues/228#issuecomment-5165995549',
})

const hostArtifact02 = await buildArtifactJcs({
  readyEventId: 'READY-228-HOST-02', readyAt: '2026-08-03T09:10:00Z', reviewId: 'REVIEW-228-HOST-02',
  submittedAt: '2026-08-03T09:10:00Z', observedAt: '2026-08-03T09:11:00Z', threads: [],
})
await runEligibilityCase('MRRH-02', await eligibilityInput({
  ready_event_id: 'READY-228-HOST-02', sealed_collector_artifact_jcs: hostArtifact02,
}), { kind: 'normal_merge_commit_eligible', reason: null, barrierCalls: 1,
  readyRecordUrl: 'https://github.com/whatrune/sd-prompt-studio/issues/228#issuecomment-5165995549' })

const hostInput03 = await eligibilityInput({ ready_event_id: 'READY-228-HOST-03' })
await runEligibilityCase('MRRH-03', hostInput03, { kind: 'merge_blocked', reason: 'review_not_observed', barrierCalls: 1 })

const hostArtifact04 = await buildArtifactJcs({
  readyEventId: 'READY-228-HOST-04', readyAt: '2026-08-03T09:20:00Z', reviewId: 'REVIEW-228-HOST-04',
  submittedAt: '2026-08-03T09:21:00Z', observedAt: '2026-08-03T09:22:00Z', threads: [],
})
await runEligibilityCase('MRRH-04', await eligibilityInput({
  ready_event_id: 'READY-228-HOST-04', sealed_collector_artifact_jcs: hostArtifact04, timeout_reached: true,
}), { kind: 'merge_blocked', reason: 'review_timeout', barrierCalls: 1 })

const hostArtifact05 = await buildArtifactJcs({
  readyEventId: 'READY-228-HOST-05', readyAt: '2026-08-03T09:30:00Z', reviewId: 'REVIEW-228-HOST-05',
  submittedAt: '2026-08-03T09:31:00Z', observedAt: '2026-08-03T09:32:00Z',
  threads: [{ thread_id: 'THREAD-228-HOST-OPEN', is_resolved: false, is_outdated: false }],
})
await runEligibilityCase('MRRH-05', await eligibilityInput({
  ready_event_id: 'READY-228-HOST-05', sealed_collector_artifact_jcs: hostArtifact05,
}), { kind: 'merge_blocked', reason: 'unresolved_non_outdated_thread', barrierCalls: 1 })

await runEligibilityCase('MRRH-06A', await eligibilityInput({
  ready_event_id: 'READY-228-HOST-06A', sealed_collector_artifact_jcs: '{not-json',
}), { kind: 'merge_blocked', reason: 'review_unknown', barrierCalls: 1 })

const hostArtifact06B = await buildArtifactJcs({
  producer: 'other-reviewer[bot]', readyEventId: 'READY-228-HOST-06B', readyAt: '2026-08-03T09:40:00Z',
  reviewId: 'REVIEW-228-HOST-06B', submittedAt: '2026-08-03T09:41:00Z', observedAt: '2026-08-03T09:42:00Z', threads: [],
})
await runEligibilityCase('MRRH-06B', await eligibilityInput({
  ready_event_id: 'READY-228-HOST-06B', sealed_collector_artifact_jcs: hostArtifact06B,
}), { kind: 'merge_blocked', reason: 'review_not_observed', barrierCalls: 1 })

const incompleteArtifact = JSON.parse(hostArtifact01)
const incompletePage = incompleteArtifact.thread_snapshot.pages[0]
incompletePage.has_next_page = true
const { page_digest: _oldPageDigest, ...incompletePageProjection } = incompletePage
incompletePage.page_digest = await digestReadyReviewObservationProjectionV1(incompletePageProjection)
const { snapshot_digest: _oldSnapshotDigest, ...incompleteSnapshotProjection } = incompleteArtifact.thread_snapshot
incompleteArtifact.thread_snapshot.snapshot_digest = await digestReadyReviewObservationProjectionV1(incompleteSnapshotProjection)
const { artifact_digest: _oldArtifactDigest, ...incompleteArtifactProjection } = incompleteArtifact
incompleteArtifact.artifact_digest = await digestReadyReviewObservationProjectionV1(incompleteArtifactProjection)
await runEligibilityCase('MRRH-06C', await eligibilityInput({
  ready_event_id: 'READY-228-HOST-06C',
  sealed_collector_artifact_jcs: canonicalizeReadyReviewObservationJcsV1(incompleteArtifact),
}), { kind: 'merge_blocked', reason: 'review_unknown', barrierCalls: 1 })

const hostArtifact07A = await buildArtifactJcs({
  artifactHead: '2222222222222222222222222222222222222222', readyEventId: 'READY-228-HOST-07A',
  readyAt: '2026-08-03T10:00:00Z', reviewId: 'REVIEW-228-HOST-07A', submittedAt: '2026-08-03T10:01:00Z',
  observedAt: '2026-08-03T10:02:00Z', threads: [],
})
await runEligibilityCase('MRRH-07A', await eligibilityInput({
  ready_event_id: 'READY-228-HOST-07A', sealed_collector_artifact_jcs: hostArtifact07A,
}), { kind: 'rejected', reason: 'stale_artifact', barrierCalls: 1 })

const alternateReadyRecord = 'https://github.com/whatrune/sd-prompt-studio/issues/228#issuecomment-5166879799'
const hostArtifact07B = await buildArtifactJcs({
  readyRecordUrl: alternateReadyRecord, readyEventId: 'READY-228-HOST-07B', readyAt: '2026-08-03T10:10:00Z',
  reviewId: 'REVIEW-228-HOST-07B', submittedAt: '2026-08-03T10:11:00Z', observedAt: '2026-08-03T10:12:00Z', threads: [],
})
await runEligibilityCase('MRRH-07B', await eligibilityInput({
  ready_event_id: 'READY-228-HOST-07B', sealed_collector_artifact_jcs: hostArtifact07B,
}), { kind: 'rejected', reason: 'binding_mismatch', barrierCalls: 1 })

const hostArtifact07C = await buildArtifactJcs({
  artifactPrNumber: 230, readyEventId: 'READY-228-HOST-07C', readyAt: '2026-08-03T10:20:00Z',
  reviewId: 'REVIEW-228-HOST-07C', submittedAt: '2026-08-03T10:21:00Z', observedAt: '2026-08-03T10:22:00Z', threads: [],
})
await runEligibilityCase('MRRH-07C', await eligibilityInput({
  ready_event_id: 'READY-228-HOST-07C', sealed_collector_artifact_jcs: hostArtifact07C,
}), { kind: 'rejected', reason: 'binding_mismatch', barrierCalls: 1 })

const hostArtifact07D = await buildArtifactJcs({
  readyEventId: 'READY-ARTIFACT-07D', readyAt: '2026-08-03T10:30:00Z', reviewId: 'REVIEW-228-HOST-07D',
  submittedAt: '2026-08-03T10:31:00Z', observedAt: '2026-08-03T10:32:00Z', threads: [],
})
await runEligibilityCase('MRRH-07D', await eligibilityInput({
  ready_event_id: 'READY-INPUT-07D', sealed_collector_artifact_jcs: hostArtifact07D,
}), { kind: 'rejected', reason: 'binding_mismatch', barrierCalls: 1 })

await runEligibilityCase('MRRH-08A', hostInput03, { kind: 'rejected', reason: 'duplicate_invocation', barrierCalls: 0 })
await runEligibilityCase('MRRH-08B', await eligibilityInput({
  sealed_collector_artifact_jcs: hostArtifact01, timeout_reached: true,
}), { kind: 'rejected', reason: 'duplicate_invocation', barrierCalls: 0 })

const bypassInput = { ...(await eligibilityInput({ ready_event_id: 'READY-228-HOST-09A' })), raw_observation: {}, merge_allowed: true }
await runEligibilityCase('MRRH-09A', bypassInput, { kind: 'rejected', reason: 'input_invalid', barrierCalls: 0 })
const alternateArtifactInput = { ...(await eligibilityInput({ ready_event_id: 'READY-228-HOST-09B' })), collector_artifact: hostArtifact01 }
await runEligibilityCase('MRRH-09B', alternateArtifactInput, { kind: 'rejected', reason: 'input_invalid', barrierCalls: 0 })

const staleDigestArtifact = JSON.parse(hostArtifact01)
staleDigestArtifact.artifact_digest = sha('0')
await runEligibilityCase('MRRH-10', await eligibilityInput({
  ready_event_id: 'READY-228-HOST-10',
  sealed_collector_artifact_jcs: canonicalizeReadyReviewObservationJcsV1(staleDigestArtifact),
}), { kind: 'merge_blocked', reason: 'review_unknown', barrierCalls: 1 })

const concurrencyRow = fixture.eligibility_concurrency_rows.find((row) => row.row_id === 'MRRH-11')
check(concurrencyRow !== undefined, 'MRRH-11 is in the deterministic concurrency matrix')
const concurrentReadyEventId = 'READY-228-HOST-11'
const concurrentArtifactA = await buildArtifactJcs({
  readyEventId: concurrentReadyEventId, readyAt: '2026-08-03T11:00:00Z', reviewId: 'REVIEW-228-HOST-11A',
  submittedAt: '2026-08-03T11:01:00Z', observedAt: '2026-08-03T11:02:00Z', threads: [],
})
const concurrentArtifactB = await buildArtifactJcs({
  readyEventId: concurrentReadyEventId, readyAt: '2026-08-03T11:00:00Z', reviewId: 'REVIEW-228-HOST-11B',
  submittedAt: '2026-08-03T11:01:30Z', observedAt: '2026-08-03T11:02:30Z', threads: [],
})
const concurrentInputA = await eligibilityInput({
  ready_event_id: concurrentReadyEventId, sealed_collector_artifact_jcs: concurrentArtifactA,
})
const concurrentInputB = await eligibilityInput({
  ready_event_id: concurrentReadyEventId, sealed_collector_artifact_jcs: concurrentArtifactB,
})
check(concurrentInputA.attempt_id !== concurrentInputB.attempt_id, 'MRRH-11 attempts are distinct')
const concurrentResults = await Promise.all([
  evaluateReadyReviewNormalMergeEligibilityV1(concurrentInputA),
  evaluateReadyReviewNormalMergeEligibilityV1(concurrentInputB),
])
const concurrentWinners = concurrentResults.filter((result) => result.kind === 'normal_merge_commit_eligible')
const concurrentLosers = concurrentResults.filter((result) => result.kind === 'rejected' && result.reason === 'duplicate_invocation')
check(concurrentWinners.length === concurrencyRow.expected_eligible_count, 'MRRH-11 exactly one eligible winner')
check(concurrentLosers.length === concurrencyRow.expected_duplicate_count, 'MRRH-11 exactly one duplicate loser')
check(concurrentResults.every((result) => result.barrier_invocation_count === concurrencyRow.expected_barrier_calls_per_attempt),
  'MRRH-11 both concurrent attempts report actual Barrier invocation')
check(concurrentResults.every((result) => result.protected_execution_performed === false), 'MRRH-11 protected action count 0')
check(concurrentResults.every(deeplyFrozen), 'MRRH-11 immutable results')

check(!/RawGitHubObservationV1|TerminalThreadSnapshotV1|raw_observation|terminal_thread_snapshot/.test(source), 'unsealed review authority removed')
check(/parseReadyReviewTerminalObservationArtifactV1/.test(source), 'sealed Collector parser is the sole review admission')
check(!/evaluateContinuousOrchestrationMergeGateV1/.test(productionSource), 'old raw Barrier wrapper removed')
check(/export const evaluateReadyReviewNormalMergeEligibilityV1/.test(eligibilitySource), 'sole public eligibility entry exported')
check((eligibilitySource.match(/\bexport\b/g) ?? []).length === 1, 'owner, state, receipt, and constructor remain private')
check(/evaluateMinimalReadyReviewBarrierV1/.test(eligibilitySource), 'eligibility host invokes Barrier')
check(!/gh api|mergePullRequest|auto.merge|rebase|squash/i.test(eligibilitySource), 'no protected execution or alternate merge strategy')
check(execFileSync('git', ['diff', '--name-only', '--', collectorPath], { encoding: 'utf8' }).trim() === '', 'Collector artifact module remains read-only')
check(!/producer_roster_source|lifecycle framework|generic authority|other bot/i.test(source), 'scope remains single-producer and minimal')
check(packageJson.scripts['test:minimal-ready-review-barrier'] === 'node --experimental-strip-types scripts/test-minimal-ready-review-barrier-v1.mjs', 'focused package script registered')
check(packageJson.scripts['test:continuous-orchestration'].endsWith('node --experimental-strip-types scripts/test-minimal-ready-review-barrier-v1.mjs'), 'full continuous-orchestration regression includes barrier')
check(execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() === initialHead, 'test does not change HEAD')

console.log(`Minimal Ready Review Barrier V1 repair: ${assertions} assertions passed across ${fixture.rows.length}/8 rows`)
