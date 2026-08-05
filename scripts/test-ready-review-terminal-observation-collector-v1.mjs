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
  selectCurrentReadyReviewProducerSourcesV1,
  validateReadyReviewGenerationRecordV1,
  validateReadyReviewProducerRosterV1,
} from '../src/continuous-orchestration/ready-review-terminal-observation-artifact-v1.ts'

const fixture = JSON.parse(await readFile('scripts/fixtures/ready-review-terminal-observation-collector-v1.json', 'utf8'))
const productionSource = await readFile('scripts/run-ready-review-terminal-observation-collector-v1.mjs', 'utf8')
const moduleSource = await readFile('src/continuous-orchestration/ready-review-terminal-observation-artifact-v1.ts', 'utf8')
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

const selectCurrent = (
  observations = fixture.receipt_sources,
  producerIds = roster.producer_ids,
  readyEventId = readyRecord.ready_event_id,
  exactHead = readyRecord.exact_head,
  readyOccurredAt = readyRecord.ready_occurred_at,
  receiptsObservedAt = '2026-08-01T00:30:00Z',
) => selectCurrentReadyReviewProducerSourcesV1(
  observations,
  producerIds,
  readyEventId,
  exactHead,
  readyOccurredAt,
  receiptsObservedAt,
)

const baselineSelectorInput = clone(fixture.receipt_sources).reverse()
const baselineSelectorSnapshot = clone(baselineSelectorInput)
const baselineSelection = selectCurrent(baselineSelectorInput)
check(baselineSelection?.map((source) => source.producer_id).join(',') === roster.producer_ids.join(','), 'selector returns exact-one multi-producer sources in frozen roster order')
check(frozen(baselineSelection), 'selector output is recursively immutable')
check(JSON.stringify(baselineSelectorInput) === JSON.stringify(baselineSelectorSnapshot), 'selector leaves input unchanged')
assert.throws(() => { baselineSelection[0].producer_id = 'mutated' }, TypeError)
check(baselineSelection[0].producer_id === roster.producer_ids[0], 'selector output rejects mutation attempts')

const currentReactionOne = {
  ...clone(fixture.receipt_sources[1]),
  producer_id: 'reviewer-one',
  reaction_id: '7000000003',
  reaction_actor: 'reviewer-one',
  reaction_created_at: '2026-08-01T00:12:00Z',
}
const oldSameHeadReview = {
  ...clone(fixture.receipt_sources[0]),
  submitted_at: '2026-07-31T23:59:59Z',
}
const historicalPlusCurrentSelection = selectCurrent([oldSameHeadReview, currentReactionOne, fixture.receipt_sources[1]])
check(historicalPlusCurrentSelection?.[0].kind === 'no_findings_correlation' && historicalPlusCurrentSelection[0].reaction_id === currentReactionOne.reaction_id, 'old same-HEAD review excluded while current post-Ready reaction selected')
const historicalPlusCurrentCore = await evaluateReadyReviewTerminalObservationCoreV1(await buildCoreInput({ producerSources: historicalPlusCurrentSelection }))
check(historicalPlusCurrentCore.branch === 'artifact_produced', 'selected current reactions continue through the existing Core and thread path')

const wrongHead = { ...clone(fixture.receipt_sources[0]), reviewed_head: '2'.repeat(40) }
check(selectCurrent([wrongHead, fixture.receipt_sources[1]]) === null, 'wrong-HEAD source excluded and zero-current producer fails closed')
const wrongReady = { ...clone(fixture.receipt_sources[0]), ready_event_id: 'READY-OLD' }
check(selectCurrent([wrongReady, fixture.receipt_sources[1]]) === null, 'Ready-ID mismatch excluded and fails closed')
const stale = { ...clone(fixture.receipt_sources[0]), submitted_at: '2026-07-31T23:59:59Z' }
check(selectCurrent([stale, fixture.receipt_sources[1]]) === null, 'stale pre-Ready source excluded and fails closed')
const future = { ...clone(fixture.receipt_sources[0]), submitted_at: '2026-08-01T00:30:01Z' }
check(selectCurrent([future, fixture.receipt_sources[1]]) === null, 'future source excluded and fails closed')
check(selectCurrent([fixture.receipt_sources[0]]) === null, 'missing roster producer fails closed')
check(selectCurrent([], roster.producer_ids) === null, 'zero current sources fail closed')
check(selectCurrent(fixture.receipt_sources, ['reviewer-one', 'reviewer-one']) === null, 'duplicate roster producer fails closed')
check(selectCurrent(fixture.receipt_sources, ['reviewer-one', 7]) === null, 'malformed roster producer scalar fails closed')
check(selectCurrent([...fixture.receipt_sources, currentReactionOne]) === null, 'two current source kinds for one producer fail closed without precedence')
const duplicateCurrentReview = { ...clone(fixture.receipt_sources[0]), review_id: '7000000004' }
check(selectCurrent([...fixture.receipt_sources, duplicateCurrentReview]) === null, 'two same-kind current sources fail closed without latest-wins or deduplication')
const extraProducer = { ...clone(fixture.receipt_sources[0]), producer_id: 'reviewer-three', review_id: '7000000005' }
check(selectCurrent([...fixture.receipt_sources, extraProducer]) === null, 'extra non-roster producer fails closed')
const malformedProjection = clone(fixture.receipt_sources)
malformedProjection[0].unknown = true
check(selectCurrent(malformedProjection) === null, 'malformed projection fails closed')
check(selectCurrent(fixture.receipt_sources, roster.producer_ids, '', readyRecord.exact_head) === null, 'malformed Ready-event scalar fails closed')
check(selectCurrent(fixture.receipt_sources, roster.producer_ids, readyRecord.ready_event_id, 'short') === null, 'malformed exact-HEAD scalar fails closed')
check(selectCurrent(fixture.receipt_sources, roster.producer_ids, readyRecord.ready_event_id, readyRecord.exact_head, 'not-time') === null, 'malformed Ready timestamp fails closed')
check(selectCurrent(fixture.receipt_sources, roster.producer_ids, readyRecord.ready_event_id, readyRecord.exact_head, readyRecord.ready_occurred_at, 'not-time') === null, 'malformed observation timestamp fails closed')
check(selectCurrent(fixture.receipt_sources, roster.producer_ids, readyRecord.ready_event_id, readyRecord.exact_head, '2026-08-01T00:30:01Z', '2026-08-01T00:30:00Z') === null, 'reversed selection interval fails closed')
const inclusiveStart = { ...clone(fixture.receipt_sources[0]), submitted_at: readyRecord.ready_occurred_at }
const inclusiveEnd = { ...clone(fixture.receipt_sources[1]), reaction_created_at: '2026-08-01T00:30:00Z' }
check(selectCurrent([inclusiveStart, inclusiveEnd])?.length === 2, 'native receipt interval is inclusive at Ready and observation bounds')

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

const badCli = spawnSync(process.execPath, ['scripts/run-ready-review-terminal-observation-collector-v1.mjs', '--repository', 'whatrune/sd-prompt-studio', '--pr', '220', '--head', '1'.repeat(40), '--fixture', 'x'], { encoding: 'utf8' })
check(badCli.status !== 0 && badCli.stdout === '', 'caller fixture option rejected with no artifact')
check(!/--import|preload|COLLECTOR_V1_SCENARIO|process\.env|globalThis\[[^\]]+\]/.test(productionSource), 'production transport has no preload, global, or environment scenario hook')
check(!/ownerPorts|owner_ports|callback|transportOption|fixturePath|testMode/.test(productionSource), 'production transport has no caller-supplied owner seam')
check(!/export\s+(?:class|function|const)\s+OwnerOnlyReadyReviewObservationTransportAdapterV1/.test(productionSource), 'owner adapter construction is module-private')
check((productionSource.match(/new OwnerOnlyReadyReviewObservationTransportAdapterV1\(/g) ?? []).length === 1, 'one production CLI constructs the owner adapter exactly once')
check(productionSource.includes('evaluateReadyReviewTerminalObservationCoreV1(coreInput)'), 'production CLI adapter necessarily invokes pure Core')
check((moduleSource.match(/export const selectCurrentReadyReviewProducerSourcesV1\s*=/g) ?? []).length === 1, 'one pure generation-aware selection helper is defined')
check((productionSource.match(/selectCurrentReadyReviewProducerSourcesV1\(/g) ?? []).length === 1, 'owner adapter invokes generation-aware selection exactly once')
check(productionSource.includes('const producerIds = Array.isArray(roster?.producer_ids) ? roster.producer_ids : []'), 'owner adapter forwards literal roster scalars to fail-closed selection')
check(productionSource.indexOf('selectCurrentReadyReviewProducerSourcesV1(') < productionSource.indexOf('const hasOneSourcePerProducer'), 'selection occurs before existing per-producer admission and thread acquisition')
check(productionSource.includes('currentProducerSourceObservations.filter((source) => source.producer_id === producerId)') && productionSource.includes('producer_source_observations: currentProducerSourceObservations'), 'only selected current sources reach per-producer check and Core input')
check((moduleSource.match(/export const parseReadyReviewTerminalObservationArtifactV1\s*=/g) ?? []).length === 1, 'one existing artifact parser remains')
check(!productionSource.includes('scripts/fixtures/'), 'production graph has no fixture reachability')
check(!/node:child_process|process\.|Date\.now\(|new Date\(|fetch\(|XMLHttpRequest/.test(moduleSource), 'pure Core module has no transport, environment, or clock read')
check(!/Completion|GateStatus|merge_allowed|stop_reason|violation_classification/.test(moduleSource), 'Core module excludes evaluator responsibilities')
check(packageJson.scripts['test:ready-review-terminal-observation-collector'] === 'node scripts/test-ready-review-terminal-observation-collector-v1.mjs', 'focused package script registered')
check(execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() === initialHead, 'focused test does not change HEAD')

console.log(`Ready Review Terminal Observation Collector V1: ${assertions} assertions passed`)
