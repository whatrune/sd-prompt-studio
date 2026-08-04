import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import {
  READY_REVIEW_TERMINAL_OBSERVATION_CORE_INPUT_V1,
  canonicalizeReadyReviewObservationJcsV1,
  deriveLastTerminalReceiptAtV1,
  digestReadyReviewObservationProjectionV1,
  evaluateReadyReviewTerminalObservationCoreV1,
  parseReadyReviewTerminalObservationArtifactV1,
  validateReadyReviewGenerationRecordV1,
  validateReadyReviewProducerRosterV1,
} from '../src/continuous-orchestration/ready-review-terminal-observation-artifact-v1.ts'
import {
  HOST_LEVEL_READY_REVIEW_BARRIER_INPUT_V1,
  evaluateHostLevelReadyReviewBarrierV1,
} from '../src/continuous-orchestration/minimal-ready-review-barrier-v1.ts'

const fixture = JSON.parse(await readFile('scripts/fixtures/ready-review-terminal-observation-collector-v1.json', 'utf8'))
const productionSource = await readFile('scripts/run-ready-review-terminal-observation-collector-v1.mjs', 'utf8')
const moduleSource = await readFile('src/continuous-orchestration/ready-review-terminal-observation-artifact-v1.ts', 'utf8')
const barrierSource = await readFile('src/continuous-orchestration/minimal-ready-review-barrier-v1.ts', 'utf8')
const packageJson = JSON.parse(await readFile('package.json', 'utf8'))
const initialHead = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
let assertions = 0
const check = (condition, message) => { assertions += 1; assert.ok(condition, message) }
const clone = structuredClone
const frozen = (value) => value === null || typeof value !== 'object' || (Object.isFrozen(value) && Object.values(value).every(frozen))
const seal = async (value, digestField) => ({ ...clone(value), [digestField]: await digestReadyReviewObservationProjectionV1(value) })
const resealPage = async (page) => seal(Object.fromEntries(Object.entries(page).filter(([key]) => key !== 'page_digest')), 'page_digest')
const resealRecord = async (record) => seal(Object.fromEntries(Object.entries(record).filter(([key]) => key !== 'record_digest')), 'record_digest')

const roster = await seal(fixture.roster_record, 'record_digest')
const readyRecord = await seal({ ...fixture.ready_record, producer_roster_source_digest: roster.record_digest }, 'record_digest')
const ownerObservation = (record) => ({
  source_url: record.canonical_record,
  author_login: 'whatrune',
  author_association: 'OWNER',
  record: clone(record),
})

const buildCoreInput = async ({
  readyRecords = [readyRecord],
  readyEvents = [{ event_id: readyRecord.ready_event_id, event: 'ready_for_review', created_at: readyRecord.ready_occurred_at }],
  rosterRecord = roster,
  producerSources = fixture.receipt_sources,
  pageSources = fixture.thread_pages,
  receiptsObservedAt = '2026-08-01T00:30:00Z',
  snapshotObservedAt = '2026-08-01T00:32:00Z',
} = {}) => ({
  input_version: READY_REVIEW_TERMINAL_OBSERVATION_CORE_INPUT_V1,
  request_identity: {
    repository: readyRecord.repository,
    pr_number: readyRecord.pr_number,
    pr_url: readyRecord.pr_url,
    exact_head: readyRecord.exact_head,
    ready_record_url: readyRecords.at(-1).canonical_record,
  },
  ready_record_observations: readyRecords.map(ownerObservation),
  ready_event_observations: clone(readyEvents),
  roster_record_observation: ownerObservation(rosterRecord),
  producer_source_observations: clone(producerSources),
  thread_pages: await Promise.all(pageSources.map((page) => seal(page, 'page_digest'))),
  receipts_observed_at: receiptsObservedAt,
  thread_snapshot_observed_at: snapshotObservedAt,
})

const assertRejected = async (input, failureCode, stage, label) => {
  const result = await evaluateReadyReviewTerminalObservationCoreV1(input)
  check(result.branch === 'observation_rejected' && result.failure.failure_code === failureCode && result.failure.stage === stage && frozen(result), label)
}

check(fixture.contract_version === 'ready-review-terminal-observation-collector-validation-v1', 'fixture contract version')
check(await validateReadyReviewProducerRosterV1(roster), 'valid roster record')
check(await validateReadyReviewGenerationRecordV1(readyRecord), 'valid Ready generation record')

const validInput = await buildCoreInput()
check(Object.keys(validInput).join(',') === 'input_version,request_identity,ready_record_observations,ready_event_observations,roster_record_observation,producer_source_observations,thread_pages,receipts_observed_at,thread_snapshot_observed_at', 'Core Input has exact ordered nine fields')
const validResult = await evaluateReadyReviewTerminalObservationCoreV1(validInput)
check(validResult.branch === 'artifact_produced', 'valid literal Core Input produces artifact')
const artifact = validResult.artifact
check(Object.keys(artifact).length === 16, 'artifact has exact 16 top-level fields')
check(frozen(validResult), 'Core Result and artifact are recursively immutable')
check(artifact.thread_snapshot.pages[1].end_cursor === 'cursor-terminal', 'non-null terminal end cursor admitted')
check(artifact.thread_snapshot.pages[0].nodes[0].is_resolved === false && artifact.thread_snapshot.pages[0].nodes[0].is_outdated === false, 'unresolved non-outdated thread preserved without policy judgment')
const artifactJcs = canonicalizeReadyReviewObservationJcsV1(artifact)
const parsed = await parseReadyReviewTerminalObservationArtifactV1(artifactJcs)
check(parsed?.artifact_digest === artifact.artifact_digest && frozen(parsed), 'artifact parser admits exact JCS bytes')
check(await parseReadyReviewTerminalObservationArtifactV1(`${artifactJcs}\n`) === null, 'second artifact byte representation rejected')

const forbiddenFields = ['merge_allowed', 'stop_reason', 'violation', 'precedence', 'completion', 'gsp', 'policy']
const allKeys = []
const visit = (value) => { if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) { allKeys.push(key.toLowerCase()); visit(child) } }
visit(validResult)
check(forbiddenFields.every((field) => !allKeys.includes(field)), 'Core Result excludes evaluator and policy fields')

const unknownTop = await buildCoreInput()
unknownTop.unknown = true
await assertRejected(unknownTop, 'input_shape_invalid', 'input', 'Core Input unknown top-level field rejected')
const missingTop = await buildCoreInput()
delete missingTop.receipts_observed_at
await assertRejected(missingTop, 'input_shape_invalid', 'input', 'Core Input missing top-level field rejected')
const requestUnknown = await buildCoreInput()
requestUnknown.request_identity.unknown = true
await assertRejected(requestUnknown, 'input_shape_invalid', 'input', 'request identity unknown field rejected')
const unauthorized = await buildCoreInput()
unauthorized.ready_record_observations[0].author_login = 'untrusted-reviewer'
unauthorized.ready_record_observations[0].author_association = 'CONTRIBUTOR'
await assertRejected(unauthorized, 'ready_authority_invalid', 'ready_authority', 'unauthorized Ready issuer rejected from literal Core Input')
const readyUnknown = await buildCoreInput()
readyUnknown.ready_record_observations[0].unknown = true
await assertRejected(readyUnknown, 'ready_authority_invalid', 'ready_authority', 'Ready observation unknown field rejected')
const badReadyDigest = await buildCoreInput()
badReadyDigest.ready_record_observations[0].record.record_digest = '0'.repeat(64)
await assertRejected(badReadyDigest, 'ready_authority_invalid', 'ready_authority', 'Ready record digest mismatch rejected')

const successor = await resealRecord({ ...clone(readyRecord), canonical_record: 'https://github.com/whatrune/sd-prompt-studio/issues/226#issuecomment-6000000002', revision: 2, prior_record_url: readyRecord.canonical_record })
const staleLeaf = await buildCoreInput({ readyRecords: [readyRecord, successor] })
staleLeaf.request_identity.ready_record_url = readyRecord.canonical_record
await assertRejected(staleLeaf, 'ready_chain_invalid', 'ready_chain', 'stale non-leaf Ready revision rejected')
const competing = await resealRecord({ ...clone(readyRecord), canonical_record: 'https://github.com/whatrune/sd-prompt-studio/issues/226#issuecomment-6000000002' })
await assertRejected(await buildCoreInput({ readyRecords: [readyRecord, competing] }), 'ready_chain_invalid', 'ready_chain', 'competing Ready leaf rejected')
const broken = await resealRecord({ ...clone(successor), prior_record_url: 'https://github.com/whatrune/sd-prompt-studio/issues/226#issuecomment-6999999999' })
await assertRejected(await buildCoreInput({ readyRecords: [readyRecord, broken] }), 'ready_chain_invalid', 'ready_chain', 'broken Ready chain rejected')
const missingEvent = await buildCoreInput({ readyEvents: [{ event_id: 'OTHER', event: 'ready_for_review', created_at: readyRecord.ready_occurred_at }] })
await assertRejected(missingEvent, 'ready_event_invalid', 'ready_event', 'missing bound Ready event rejected')
const eventUnknown = await buildCoreInput()
eventUnknown.ready_event_observations[0].unknown = true
await assertRejected(eventUnknown, 'ready_event_invalid', 'ready_event', 'Ready event unknown field rejected')

const rosterUnknown = await buildCoreInput()
rosterUnknown.roster_record_observation.unknown = true
await assertRejected(rosterUnknown, 'roster_authority_invalid', 'roster', 'roster observation unknown field rejected')
const rosterMismatch = await buildCoreInput()
rosterMismatch.roster_record_observation.record.record_digest = '0'.repeat(64)
await assertRejected(rosterMismatch, 'roster_authority_invalid', 'roster', 'roster source digest mismatch rejected')
const unsortedRoster = await seal({ ...fixture.roster_record, producer_ids: ['reviewer-two', 'reviewer-one'] }, 'record_digest')
await assertRejected(await buildCoreInput({ rosterRecord: unsortedRoster }), 'roster_authority_invalid', 'roster', 'unsorted roster rejected')

const missingReceipt = await buildCoreInput({ producerSources: [fixture.receipt_sources[0]] })
await assertRejected(missingReceipt, 'producer_receipt_incomplete', 'receipts', 'missing producer receipt rejected')
const duplicateReceipt = await buildCoreInput({ producerSources: [fixture.receipt_sources[0], fixture.receipt_sources[0], fixture.receipt_sources[1]] })
await assertRejected(duplicateReceipt, 'producer_receipt_incomplete', 'receipts', 'duplicate producer receipt rejected')
const staleHead = await buildCoreInput()
staleHead.producer_source_observations[0].reviewed_head = '2'.repeat(40)
await assertRejected(staleHead, 'producer_receipt_invalid', 'receipts', 'stale receipt HEAD rejected')
const staleReady = await buildCoreInput()
staleReady.producer_source_observations[0].ready_event_id = 'STALE'
await assertRejected(staleReady, 'producer_receipt_invalid', 'receipts', 'stale receipt Ready identity rejected')
const mixedReceipt = await buildCoreInput()
mixedReceipt.producer_source_observations[0].reaction_id = 'mixed'
await assertRejected(mixedReceipt, 'producer_receipt_invalid', 'receipts', 'mixed receipt union rejected')
const receiptUnknown = await buildCoreInput()
receiptUnknown.producer_source_observations[0].unknown = true
await assertRejected(receiptUnknown, 'producer_receipt_invalid', 'receipts', 'receipt source unknown field rejected')
const receiptMissingField = await buildCoreInput()
delete receiptMissingField.producer_source_observations[0].review_state
await assertRejected(receiptMissingField, 'producer_receipt_invalid', 'receipts', 'receipt source missing field rejected')
const receiptObservedMismatch = await buildCoreInput()
receiptObservedMismatch.receipts_observed_at = '2026-08-01T00:30:01Z'
await assertRejected(receiptObservedMismatch, 'producer_receipt_invalid', 'receipts', 'receipt observation time binding mismatch rejected')

const pageUnknown = await buildCoreInput()
pageUnknown.thread_pages[0].unknown = true
await assertRejected(pageUnknown, 'thread_snapshot_invalid', 'threads', 'thread page unknown field rejected')
const nodeUnknown = await buildCoreInput()
nodeUnknown.thread_pages[0].nodes[0].unknown = true
await assertRejected(nodeUnknown, 'thread_snapshot_invalid', 'threads', 'thread node unknown field rejected')
const pageMissing = await buildCoreInput()
delete pageMissing.thread_pages[0].page_ordinal
await assertRejected(pageMissing, 'thread_snapshot_invalid', 'threads', 'thread page missing field rejected')
const nodeMissing = await buildCoreInput()
delete nodeMissing.thread_pages[0].nodes[0].path
await assertRejected(nodeMissing, 'thread_snapshot_invalid', 'threads', 'thread node missing field rejected')
const pageReordered = await buildCoreInput()
pageReordered.thread_pages.reverse()
await assertRejected(pageReordered, 'thread_snapshot_invalid', 'threads', 'thread page order rejected')
const cursorBroken = await buildCoreInput()
cursorBroken.thread_pages[1].start_cursor = 'broken'
cursorBroken.thread_pages[1] = await resealPage(cursorBroken.thread_pages[1])
await assertRejected(cursorBroken, 'thread_snapshot_invalid', 'threads', 'thread cursor binding mismatch rejected')
const duplicateThread = await buildCoreInput()
duplicateThread.thread_pages[1].nodes[0].thread_id = duplicateThread.thread_pages[0].nodes[0].thread_id
duplicateThread.thread_pages[1] = await resealPage(duplicateThread.thread_pages[1])
await assertRejected(duplicateThread, 'thread_snapshot_invalid', 'threads', 'duplicate thread identity rejected')
const pageDigestMismatch = await buildCoreInput()
pageDigestMismatch.thread_pages[0].page_digest = '0'.repeat(64)
await assertRejected(pageDigestMismatch, 'thread_snapshot_invalid', 'threads', 'thread page digest mismatch rejected')

const mixedSources = clone(fixture.receipt_sources)
mixedSources[0].submitted_at = '2026-08-01T00:20:00.500Z'
mixedSources[1].reaction_created_at = '2026-08-01T00:20:00Z'
check(deriveLastTerminalReceiptAtV1(['2026-08-01T00:20:00.500Z', '2026-08-01T00:20:00Z']) === '2026-08-01T00:20:00.500Z', 'parsed-time maximum preserves exact mixed-precision literal')
const mixedPositive = await evaluateReadyReviewTerminalObservationCoreV1(await buildCoreInput({ producerSources: mixedSources }))
check(mixedPositive.branch === 'artifact_produced' && mixedPositive.artifact.last_terminal_receipt_at === '2026-08-01T00:20:00.500Z', 'mixed-precision temporal maximum admitted by Core')
await assertRejected(await buildCoreInput({ producerSources: mixedSources, snapshotObservedAt: '2026-08-01T00:20:00.300Z' }), 'temporal_binding_invalid', 'threads', 'snapshot between lexical and temporal maxima rejected')
const betweenPages = clone(fixture.thread_pages)
betweenPages[0].source_observed_at = '2026-08-01T00:20:00.300Z'
await assertRejected(await buildCoreInput({ producerSources: mixedSources, pageSources: betweenPages, snapshotObservedAt: '2026-08-01T00:20:00.700Z' }), 'temporal_binding_invalid', 'threads', 'page between lexical and temporal maxima rejected')

const executeLiteralHostRow = (row) => {
  const transport = row.input.transport
  const request = row.input.cli_args
  const calls = { timeline_api: 0, pr_api: 0, reviews_api: 0, thread_graphql: 0, host_evaluator: 0, reactions_api: 0, legacy_core: 0 }
  let selectedReviewId = null
  const finish = (input) => {
    calls.host_evaluator += 1
    return { result: evaluateHostLevelReadyReviewBarrierV1(input), selectedReviewId, calls }
  }
  const failure = (stage, code) => finish({
    input_version: HOST_LEVEL_READY_REVIEW_BARRIER_INPUT_V1,
    observation: 'observation_failed', failure_stage: stage, failure_code: code,
  })

  calls.timeline_api += 1
  if (transport.timeline.result !== 'ok') return failure('timeline', 'github_read_failed')
  const timeline = transport.timeline.pages.flat()
  const ready = timeline.find((event) => String(event.id) === request.ready_event_id && event.event === 'ready_for_review')
  if (!ready) return failure('timeline', 'ready_event_missing_or_invalid')

  calls.pr_api += 1
  if (transport.pr.result !== 'ok') return failure('pr', 'github_read_failed')
  const pull = transport.pr.value
  if (pull.state !== 'open') return failure('pr', 'not_open')
  if (pull.draft !== false) return failure('pr', 'draft')
  if (pull.head_sha !== request.head) return failure('pr', 'head_mismatch')

  calls.reviews_api += 1
  if (transport.reviews.result !== 'ok') return failure('reviews', 'github_read_failed')
  const reviews = transport.reviews.pages.flat()
  const codex = reviews.filter((review) => review?.user?.login === 'chatgpt-codex-connector[bot]')
  const headBound = codex.filter((review) => review.commit_id === request.head)
  const qualified = headBound.filter((review) => Date.parse(review.submitted_at) >= Date.parse(ready.created_at))
  if (qualified.length === 0) {
    if (codex.some((review) => review.commit_id !== request.head)) return failure('reviews', 'review_head_mismatch')
    if (headBound.some((review) => Date.parse(review.submitted_at) < Date.parse(ready.created_at))) return failure('reviews', 'review_before_ready')
    return failure('reviews', 'review_not_observed')
  }
  qualified.sort((left, right) => Date.parse(left.submitted_at) - Date.parse(right.submitted_at) || Number(left.id) - Number(right.id))
  const latest = qualified.at(-1)
  selectedReviewId = String(latest.id)

  calls.thread_graphql += 1
  if (transport.threads.result === 'malformed') return failure('threads', 'page_malformed')
  if (transport.threads.result !== 'ok') return failure('threads', 'github_read_failed')
  calls.thread_graphql = transport.threads.pages.length
  const pages = clone(transport.threads.pages)
  const observedAt = pages.reduce((maximum, page) => Date.parse(page.source_observed_at) > Date.parse(maximum) ? page.source_observed_at : maximum, pages[0].source_observed_at)
  return finish({
    input_version: HOST_LEVEL_READY_REVIEW_BARRIER_INPUT_V1,
    observation: 'observation_complete',
    request: { repository: request.repository, pr_number: request.pr, pr_url: pull.html_url, exact_head: request.head },
    ready_event: { event_id: request.ready_event_id, event_type: 'ready_for_review', occurred_at: ready.created_at, source_observed_at: transport.timeline.source_observed_at },
    pull_request: { state: pull.state, draft: pull.draft, head_sha: pull.head_sha, source_observed_at: pull.source_observed_at },
    review_observation: {
      acquisition_completed_at: transport.reviews.source_observed_at,
      latest: {
        producer: latest.user.login, review_id: String(latest.id), review_url: latest.html_url,
        reviewed_head: latest.commit_id, submitted_at: latest.submitted_at, source_observed_at: transport.reviews.source_observed_at,
      },
    },
    thread_snapshot: { observed_at: observedAt, pages },
  })
}

check(fixture.host_level_contract_version === 'host-level-ready-review-barrier-validation-v1', 'host-level contract version')
check(fixture.host_level_rows.length === 18, '18 literal host rows present')
check(fixture.host_level_rows.map((row) => row.row_id).join(',') === Array.from({ length: 18 }, (_, index) => `SFRG-${String(index + 1).padStart(3, '0')}`).join(','), 'host rows ordered and contiguous')
for (const row of fixture.host_level_rows) {
  const execution = executeLiteralHostRow(row)
  check(JSON.stringify(execution.result) === JSON.stringify(row.expected.result), `${row.row_id} exact result`)
  check(execution.selectedReviewId === row.expected.selected_review_id, `${row.row_id} selected review`)
  check(JSON.stringify(execution.calls) === JSON.stringify(row.calls), `${row.row_id} exact call counts`)
  check(frozen(execution.result), `${row.row_id} immutable result`)
  check(Object.hasOwn(row.input, 'cli_args') && Object.hasOwn(row.input, 'transport'), `${row.row_id} standalone input`)
}

const badCli = spawnSync(process.execPath, ['scripts/run-ready-review-terminal-observation-collector-v1.mjs', '--repository', 'whatrune/sd-prompt-studio', '--pr', '220', '--head', '1'.repeat(40), '--fixture', 'x'], { encoding: 'utf8' })
check(badCli.status !== 0 && badCli.stdout === '', 'caller fixture option rejected with no artifact')
const legacyCli = spawnSync(process.execPath, ['scripts/run-ready-review-terminal-observation-collector-v1.mjs', '--repository', 'whatrune/sd-prompt-studio', '--pr', '229', '--head', '1'.repeat(40), '--ready-record', 'https://github.com/whatrune/sd-prompt-studio/issues/228#issuecomment-1'], { encoding: 'utf8' })
check(legacyCli.status !== 0 && legacyCli.stdout === '', 'legacy --ready-record rejected with no second mode')
check(/--ready-event-id/.test(productionSource) && !/allowed = new Set\([^\n]*--ready-record/.test(productionSource), 'replacement CLI argument surface')
check(/ghPaginated\(`repos\/\$\{request\.repository\}\/issues\/\$\{request\.prNumber\}\/timeline/.test(productionSource), 'existing timeline read retained')
check(/reviewThreads\(first:100,after:\$cursor\)/.test(productionSource), 'GraphQL all-page thread path retained')
check(/evaluateHostLevelReadyReviewBarrierV1/.test(productionSource), 'CLI necessarily invokes host-level pure evaluator')
check(!/evaluateReadyReviewTerminalObservationCoreV1|canonicalizeReadyReviewObservationJcsV1|parseYaml|reactions\?per_page|producer_roster_source/.test(productionSource), 'legacy artifact Core roster Ready-record reaction authority unreachable')
check(!/--import|preload|COLLECTOR_V1_SCENARIO|process\.env|globalThis\[[^\]]+\]/.test(productionSource), 'production transport has no preload, global, or environment scenario hook')
check(!/ownerPorts|owner_ports|callback|transportOption|fixturePath|testMode/.test(productionSource), 'production transport has no caller-supplied owner seam')
check(!/OwnerOnlyReadyReviewObservationTransportAdapterV1/.test(productionSource), 'historical adapter is unreachable from replacement CLI')
check(productionSource.includes('JSON.stringify(await runHost(request))'), 'one production CLI invokes the replacement host exactly once')
check(!productionSource.includes('evaluateReadyReviewTerminalObservationCoreV1'), 'replacement CLI does not invoke historical artifact Core')
check(!productionSource.includes('scripts/fixtures/'), 'production graph has no fixture reachability')
check(!/node:child_process|process\.|Date\.now\(|new Date\(|fetch\(|XMLHttpRequest/.test(moduleSource), 'pure Core module has no transport, environment, or clock read')
check(!/node:child_process|process\.|Date\.now\(|new Date\(|fetch\(|XMLHttpRequest|ghJson|ghPaginated/.test(barrierSource), 'host-level evaluator module has no transport, environment, or clock read')
check(!/Completion|GateStatus|merge_allowed|stop_reason|violation_classification/.test(moduleSource), 'Core module excludes evaluator responsibilities')
check(packageJson.scripts['test:ready-review-terminal-observation-collector'] === 'node scripts/test-ready-review-terminal-observation-collector-v1.mjs', 'focused package script registered')
check(execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() === initialHead, 'focused test does not change HEAD')

console.log(`Ready Review Terminal Observation Collector V1: ${assertions} assertions passed`)
