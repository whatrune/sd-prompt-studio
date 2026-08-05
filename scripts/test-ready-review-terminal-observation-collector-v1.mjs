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
  selectCurrentReadyReviewAuthorityObservationsV1,
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

const restReadyEventId = '28990179212'
const roster = await seal({ ...fixture.roster_record, ready_event_id: restReadyEventId }, 'record_digest')
const readyRecord = await seal({ ...fixture.ready_record, ready_event_id: restReadyEventId, producer_roster_source_digest: roster.record_digest }, 'record_digest')
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
  postSnapshotHeadRecheck,
  recheckObservedAt = '2026-08-01T00:33:00Z',
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
  producer_source_observations: clone(producerSources).map((source) => ({ ...source, ready_event_id: readyRecord.ready_event_id })),
  thread_pages: await Promise.all(pageSources.map((page) => seal(page, 'page_digest'))),
  receipts_observed_at: receiptsObservedAt,
  thread_snapshot_observed_at: snapshotObservedAt,
  post_snapshot_head_recheck: postSnapshotHeadRecheck === undefined ? {
    ...clone(fixture.post_snapshot_head_recheck),
    repository: readyRecord.repository,
    pr_number: readyRecord.pr_number,
    pr_url: readyRecord.pr_url,
    ready_generation_record_url: readyRecords.at(-1).canonical_record,
    ready_event_id: readyRecord.ready_event_id,
    expected_head: readyRecord.exact_head,
    observed_head: readyRecord.exact_head,
    snapshot_observed_at: snapshotObservedAt,
    observed_at: recheckObservedAt,
    source_url: readyRecord.pr_url,
  } : clone(postSnapshotHeadRecheck),
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
  readyEventId = fixture.ready_record.ready_event_id,
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

const readyEvent = { event_id: readyRecord.ready_event_id, event: 'ready_for_review', created_at: readyRecord.ready_occurred_at }
const authorityRequest = (record = readyRecord, overrides = {}) => ({
  repository: record.repository,
  pr_number: record.pr_number,
  pr_url: record.pr_url,
  exact_head: record.exact_head,
  ready_record_url: record.canonical_record,
  ...overrides,
})
const selectAuthority = (records, events = [readyEvent], request = authorityRequest(records.at(-1))) =>
  selectCurrentReadyReviewAuthorityObservationsV1(records.map(ownerObservation), events, request)

const priorHeadRecord = await resealRecord({
  ...clone(readyRecord),
  canonical_record: 'https://github.com/whatrune/sd-prompt-studio/issues/226#issuecomment-5999999991',
  exact_head: '2'.repeat(40),
  ready_event_id: '28990170001',
  ready_occurred_at: '2026-07-31T22:00:00Z',
})
const historicalSameHeadRecord = await resealRecord({
  ...clone(readyRecord),
  canonical_record: 'https://github.com/whatrune/sd-prompt-studio/issues/226#issuecomment-5999999992',
  ready_event_id: '28990170002',
  ready_occurred_at: '2026-07-31T23:00:00Z',
})
const authorityInput = [ownerObservation(priorHeadRecord), ownerObservation(historicalSameHeadRecord), ownerObservation(readyRecord)]
const authorityInputSnapshot = clone(authorityInput)
const selectedAuthority = await selectCurrentReadyReviewAuthorityObservationsV1(authorityInput, [readyEvent], authorityRequest())
check(selectedAuthority?.length === 1 && selectedAuthority[0].record.canonical_record === readyRecord.canonical_record, 'prior-HEAD and same-HEAD prior-Ready generations are excluded in favor of exact current REST authority')
check(JSON.stringify(authorityInput) === JSON.stringify(authorityInputSnapshot), 'Ready authority selector leaves input unchanged')
check(frozen(selectedAuthority), 'Ready authority selector returns recursively immutable observations')
assert.throws(() => { selectedAuthority[0].record.ready_event_id = 'mutated' }, TypeError)

const repeatedSameHeadReadyEvent = { event_id: '28990179213', event: 'ready_for_review', created_at: '2026-08-01T00:05:00Z' }
const repeatedSameHeadReadyRecord = await resealRecord({
  ...clone(readyRecord),
  canonical_record: 'https://github.com/whatrune/sd-prompt-studio/issues/226#issuecomment-5999999993',
  ready_event_id: repeatedSameHeadReadyEvent.event_id,
  ready_occurred_at: repeatedSameHeadReadyEvent.created_at,
})
const repeatedSameHeadRecords = [readyRecord, repeatedSameHeadReadyRecord]
const repeatedSameHeadEvents = [readyEvent, repeatedSameHeadReadyEvent]
check(await selectAuthority(repeatedSameHeadRecords, repeatedSameHeadEvents, authorityRequest(readyRecord)) === null, 'same-HEAD stale Ready generation is rejected after a later Ready event')
const selectedRepeatedSameHeadAuthority = await selectAuthority(repeatedSameHeadRecords, repeatedSameHeadEvents, authorityRequest(repeatedSameHeadReadyRecord))
check(selectedRepeatedSameHeadAuthority?.length === 1 && selectedRepeatedSameHeadAuthority[0].record.canonical_record === repeatedSameHeadReadyRecord.canonical_record, 'same-HEAD current Ready generation is selected after repeated Ready')

const revisionTwo = await resealRecord({
  ...clone(readyRecord),
  canonical_record: 'https://github.com/whatrune/sd-prompt-studio/issues/226#issuecomment-6000000002',
  revision: 2,
  prior_record_url: readyRecord.canonical_record,
})
const revisionTwoRequest = authorityRequest(revisionTwo)
const selectedRevisionChain = await selectAuthority([readyRecord, revisionTwo], [readyEvent], revisionTwoRequest)
check(selectedRevisionChain?.map(({ record }) => record.revision).join(',') === '1,2' && frozen(selectedRevisionChain), 'current revision lineage is returned frozen in contiguous revision order')
const revisionChainCore = await buildCoreInput({ readyRecords: [priorHeadRecord, readyRecord, revisionTwo] })
revisionChainCore.request_identity = revisionTwoRequest
check((await evaluateReadyReviewTerminalObservationCoreV1(revisionChainCore)).branch === 'artifact_produced', 'selected multi-revision authority is independently revalidated by the existing Core')

check(await selectAuthority([priorHeadRecord], [readyEvent], authorityRequest()) === null, 'historical-only authority is never promoted')
const graphQlOnly = await resealRecord({ ...clone(readyRecord), ready_event_id: 'RFRE_lADOTUu8Qs8AAAABLfyJJc8AAAAGv_MHjA' })
check(await selectAuthority([graphQlOnly], [readyEvent], authorityRequest(graphQlOnly)) === null, 'GraphQL-only Ready event identity fails closed without conversion')
const zeroReadyEvent = await resealRecord({ ...clone(readyRecord), ready_event_id: '0' })
check(await selectAuthority([zeroReadyEvent], [{ ...readyEvent, event_id: '0' }], authorityRequest(zeroReadyEvent)) === null, 'zero REST Ready event identity fails closed')
const leadingZeroReadyEvent = await resealRecord({ ...clone(readyRecord), ready_event_id: '028990179212' })
check(await selectAuthority([leadingZeroReadyEvent], [{ ...readyEvent, event_id: '028990179212' }], authorityRequest(leadingZeroReadyEvent)) === null, 'non-canonical leading-zero REST Ready event identity fails closed')
check(await selectAuthority([readyRecord], [], authorityRequest()) === null, 'zero matching REST Ready event fails closed')
check(await selectAuthority([readyRecord], [readyEvent, clone(readyEvent)], authorityRequest()) === null, 'multiple matching REST Ready events fail closed')
check(await selectAuthority([readyRecord], [{ ...readyEvent, created_at: '2026-08-01T00:00:01Z' }], authorityRequest()) === null, 'Ready event timestamp mismatch fails closed')
check(await selectAuthority([readyRecord], [readyEvent], authorityRequest(readyRecord, { exact_head: '2'.repeat(40) })) === null, 'request exact-HEAD mismatch fails closed')
check(await selectAuthority([readyRecord], [readyEvent], authorityRequest(readyRecord, { repository: 'other/repository' })) === null, 'request repository mismatch fails closed')
check(await selectAuthority([readyRecord], [readyEvent], authorityRequest(readyRecord, { pr_number: 221 })) === null, 'request PR mismatch fails closed')
check(await selectAuthority([readyRecord], [readyEvent], authorityRequest(readyRecord, { pr_url: 'https://github.com/whatrune/sd-prompt-studio/pull/221' })) === null, 'request PR URL mismatch fails closed')
check(await selectCurrentReadyReviewAuthorityObservationsV1([ownerObservation(readyRecord), ownerObservation(readyRecord)], [readyEvent], authorityRequest()) === null, 'duplicate requested anchor fails closed')

const competingRevisionOne = await resealRecord({ ...clone(readyRecord), canonical_record: 'https://github.com/whatrune/sd-prompt-studio/issues/226#issuecomment-6000000010' })
check(await selectAuthority([readyRecord, competingRevisionOne], [readyEvent], authorityRequest()) === null, 'second current lineage and duplicate revision fail closed')
const competingRevisionTwo = await resealRecord({ ...clone(revisionTwo), canonical_record: 'https://github.com/whatrune/sd-prompt-studio/issues/226#issuecomment-6000000011' })
check(await selectAuthority([readyRecord, revisionTwo, competingRevisionTwo], [readyEvent], revisionTwoRequest) === null, 'competing current leaf fails closed')
const missingRevision = await resealRecord({ ...clone(revisionTwo), revision: 3 })
check(await selectAuthority([readyRecord, missingRevision], [readyEvent], authorityRequest(missingRevision)) === null, 'missing revision fails closed')
const brokenPredecessor = await resealRecord({ ...clone(revisionTwo), prior_record_url: 'https://github.com/whatrune/sd-prompt-studio/issues/226#issuecomment-6999999999' })
check(await selectAuthority([readyRecord, brokenPredecessor], [readyEvent], authorityRequest(brokenPredecessor)) === null, 'broken predecessor and orphan fail closed')
const cycleMember = await resealRecord({ ...clone(revisionTwo), canonical_record: 'https://github.com/whatrune/sd-prompt-studio/issues/226#issuecomment-6000000012', revision: 3, prior_record_url: revisionTwo.canonical_record })
const cyclicAnchor = await resealRecord({ ...clone(revisionTwo), prior_record_url: cycleMember.canonical_record })
check(await selectAuthority([readyRecord, cyclicAnchor, cycleMember], [readyEvent], authorityRequest(cyclicAnchor)) === null, 'cyclic current lineage fails closed')

const invalidDigestObservation = ownerObservation(readyRecord)
invalidDigestObservation.record.record_digest = '0'.repeat(64)
check(await selectCurrentReadyReviewAuthorityObservationsV1([invalidDigestObservation], [readyEvent], authorityRequest()) === null, 'invalid current record digest fails closed')
const unauthorizedObservation = ownerObservation(readyRecord)
unauthorizedObservation.author_login = 'not-owner'
check(await selectCurrentReadyReviewAuthorityObservationsV1([unauthorizedObservation], [readyEvent], authorityRequest()) === null, 'unauthorized current author fails closed')
const wrongAssociationObservation = ownerObservation(readyRecord)
wrongAssociationObservation.author_association = 'CONTRIBUTOR'
check(await selectCurrentReadyReviewAuthorityObservationsV1([wrongAssociationObservation], [readyEvent], authorityRequest()) === null, 'wrong current author association fails closed')
const sourceMismatchObservation = ownerObservation(readyRecord)
sourceMismatchObservation.source_url = 'https://github.com/whatrune/sd-prompt-studio/issues/226#issuecomment-6000000099'
check(await selectCurrentReadyReviewAuthorityObservationsV1([sourceMismatchObservation], [readyEvent], authorityRequest()) === null, 'current source and canonical URL mismatch fails closed')
const malformedCurrentObservation = ownerObservation(readyRecord)
malformedCurrentObservation.record.unknown = true
check(await selectCurrentReadyReviewAuthorityObservationsV1([malformedCurrentObservation], [readyEvent], authorityRequest()) === null, 'unknown current record field fails closed')

const validInput = await buildCoreInput()
const validInputSnapshot = clone(validInput)
check(Object.keys(validInput).join(',') === 'input_version,request_identity,ready_record_observations,ready_event_observations,roster_record_observation,producer_source_observations,thread_pages,receipts_observed_at,thread_snapshot_observed_at,post_snapshot_head_recheck', 'Core Input has exact ordered ten fields')
const validResult = await evaluateReadyReviewTerminalObservationCoreV1(validInput)
check(validResult.branch === 'artifact_produced', 'valid literal Core Input produces artifact')
check(JSON.stringify(validInput) === JSON.stringify(validInputSnapshot), 'Core leaves literal input including post-snapshot recheck unmodified')
const artifact = validResult.artifact
check(Object.keys(artifact).length === 16, 'artifact has exact 16 top-level fields')
check(frozen(validResult), 'Core Result and artifact are recursively immutable')
check(Object.keys(artifact.thread_snapshot.post_snapshot_head_recheck).join(',') === 'observation_version,repository,pr_number,pr_url,ready_generation_record_url,ready_event_id,expected_head,observed_head,snapshot_observed_at,observed_at,source_url', 'sealed thread snapshot contains exact closed post-snapshot recheck projection')
check(artifact.thread_snapshot.post_snapshot_head_recheck.observed_head === artifact.exact_head, 'sealed post-snapshot recheck binds unchanged exact HEAD')
check(artifact.thread_snapshot.pages[1].end_cursor === 'cursor-terminal', 'non-null terminal end cursor admitted')
check(artifact.thread_snapshot.pages[0].nodes[0].is_resolved === false && artifact.thread_snapshot.pages[0].nodes[0].is_outdated === false, 'unresolved non-outdated thread preserved without policy judgment')
const artifactJcs = canonicalizeReadyReviewObservationJcsV1(artifact)
const parsed = await parseReadyReviewTerminalObservationArtifactV1(artifactJcs)
check(parsed?.artifact_digest === artifact.artifact_digest && frozen(parsed), 'artifact parser admits exact JCS bytes')
check(await parseReadyReviewTerminalObservationArtifactV1(`${artifactJcs}\n`) === null, 'second artifact byte representation rejected')
const nestedMutation = clone(artifact)
nestedMutation.thread_snapshot.post_snapshot_head_recheck.observed_at = '2026-08-01T00:34:00Z'
const nestedMutationProjection = Object.fromEntries(Object.entries(nestedMutation).filter(([key]) => key !== 'artifact_digest'))
nestedMutation.artifact_digest = await digestReadyReviewObservationProjectionV1(nestedMutationProjection)
check(await parseReadyReviewTerminalObservationArtifactV1(canonicalizeReadyReviewObservationJcsV1(nestedMutation)) === null, 'nested recheck mutation remains rejected after outer artifact reseal because snapshot digest is stale')

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
const missingRecheckTop = await buildCoreInput()
delete missingRecheckTop.post_snapshot_head_recheck
await assertRejected(missingRecheckTop, 'input_shape_invalid', 'input', 'Core Input missing post-snapshot recheck rejected')
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
await assertRejected(staleLeaf, 'ready_authority_invalid', 'ready_authority', 'stale requested non-leaf Ready revision rejected during current authority selection')
const competing = await resealRecord({ ...clone(readyRecord), canonical_record: 'https://github.com/whatrune/sd-prompt-studio/issues/226#issuecomment-6000000002' })
await assertRejected(await buildCoreInput({ readyRecords: [readyRecord, competing] }), 'ready_authority_invalid', 'ready_authority', 'competing Ready leaf rejected during current authority selection')
const broken = await resealRecord({ ...clone(successor), prior_record_url: 'https://github.com/whatrune/sd-prompt-studio/issues/226#issuecomment-6999999999' })
await assertRejected(await buildCoreInput({ readyRecords: [readyRecord, broken] }), 'ready_authority_invalid', 'ready_authority', 'broken Ready chain rejected during current authority selection')
const missingEvent = await buildCoreInput({ readyEvents: [{ event_id: 'OTHER', event: 'ready_for_review', created_at: readyRecord.ready_occurred_at }] })
await assertRejected(missingEvent, 'ready_authority_invalid', 'ready_authority', 'missing bound Ready event rejected during current authority selection')
const eventUnknown = await buildCoreInput()
eventUnknown.ready_event_observations[0].unknown = true
await assertRejected(eventUnknown, 'ready_authority_invalid', 'ready_authority', 'malformed matching Ready event rejected during current authority selection')
const unrelatedEventUnknown = await buildCoreInput()
unrelatedEventUnknown.ready_event_observations.push({ event_id: 'OTHER', event: 'ready_for_review', created_at: readyRecord.ready_occurred_at, unknown: true })
await assertRejected(unrelatedEventUnknown, 'ready_event_invalid', 'ready_event', 'existing Core still rejects malformed unrelated Ready event after current authority selection')

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

const recheckUnknown = await buildCoreInput()
recheckUnknown.post_snapshot_head_recheck.unknown = true
await assertRejected(recheckUnknown, 'thread_snapshot_invalid', 'threads', 'post-snapshot recheck unknown field rejected')
const recheckMissing = await buildCoreInput()
delete recheckMissing.post_snapshot_head_recheck.repository
await assertRejected(recheckMissing, 'thread_snapshot_invalid', 'threads', 'post-snapshot recheck missing field rejected')
const malformedRecheckCases = [
  ['observation_version', 'wrong-version'],
  ['repository', 'not-a-repository'],
  ['pr_number', 0],
  ['pr_url', 'not-a-pr-url'],
  ['ready_generation_record_url', 'not-a-comment-url'],
  ['ready_event_id', ''],
  ['expected_head', 'short'],
  ['observed_head', 'short'],
  ['snapshot_observed_at', 'not-time'],
  ['observed_at', 'not-time'],
  ['source_url', 'not-a-pr-url'],
]
for (const [field, value] of malformedRecheckCases) {
  const malformedRecheck = await buildCoreInput()
  malformedRecheck.post_snapshot_head_recheck[field] = value
  await assertRejected(malformedRecheck, 'thread_snapshot_invalid', 'threads', `post-snapshot recheck malformed ${field} rejected`)
}
const mixedRecheckBindings = [
  ['repository', 'other/repository'],
  ['pr_number', 221],
  ['pr_url', 'https://github.com/whatrune/sd-prompt-studio/pull/221'],
  ['ready_generation_record_url', 'https://github.com/whatrune/sd-prompt-studio/issues/226#issuecomment-6000000099'],
  ['ready_event_id', '28990179999'],
]
for (const [field, value] of mixedRecheckBindings) {
  const mixedRecheck = await buildCoreInput()
  mixedRecheck.post_snapshot_head_recheck[field] = value
  if (field === 'pr_url') mixedRecheck.post_snapshot_head_recheck.source_url = value
  await assertRejected(mixedRecheck, 'thread_snapshot_invalid', 'threads', `post-snapshot recheck mixed ${field} binding rejected`)
}
const wrongRecheckSource = await buildCoreInput()
wrongRecheckSource.post_snapshot_head_recheck.source_url = 'https://github.com/whatrune/sd-prompt-studio/pull/221'
await assertRejected(wrongRecheckSource, 'thread_snapshot_invalid', 'threads', 'post-snapshot recheck wrong source URL rejected')
const changedRecheckHead = await buildCoreInput()
changedRecheckHead.post_snapshot_head_recheck.observed_head = '2'.repeat(40)
await assertRejected(changedRecheckHead, 'thread_snapshot_invalid', 'threads', 'post-snapshot changed HEAD rejected')
const mixedRecheckHead = await buildCoreInput()
mixedRecheckHead.post_snapshot_head_recheck.expected_head = '2'.repeat(40)
mixedRecheckHead.post_snapshot_head_recheck.observed_head = '2'.repeat(40)
await assertRejected(mixedRecheckHead, 'thread_snapshot_invalid', 'threads', 'post-snapshot mixed expected HEAD binding rejected')
const staleRecheckSnapshot = await buildCoreInput()
staleRecheckSnapshot.post_snapshot_head_recheck.snapshot_observed_at = '2026-08-01T00:31:59Z'
await assertRejected(staleRecheckSnapshot, 'thread_snapshot_invalid', 'threads', 'post-snapshot recheck stale snapshot binding rejected')
const equalRecheckTime = await buildCoreInput({ recheckObservedAt: '2026-08-01T00:32:00Z' })
await assertRejected(equalRecheckTime, 'temporal_binding_invalid', 'threads', 'post-snapshot recheck equal to snapshot time rejected')
const earlierRecheckTime = await buildCoreInput({ recheckObservedAt: '2026-08-01T00:31:59Z' })
await assertRejected(earlierRecheckTime, 'temporal_binding_invalid', 'threads', 'post-snapshot recheck earlier than snapshot rejected')

const earlyZeroThreadPage = {
  ...clone(fixture.thread_pages[0]),
  page_ordinal: 0,
  end_cursor: 'cursor-early-zero-terminal',
  has_next_page: false,
  nodes: [],
  source_observed_at: '2026-08-01T00:15:00Z',
}
await assertRejected(await buildCoreInput({
  producerSources: [fixture.receipt_sources[0]],
  pageSources: [earlyZeroThreadPage],
  snapshotObservedAt: '2026-08-01T00:16:00Z',
  recheckObservedAt: '2026-08-01T00:17:00Z',
}), 'producer_receipt_incomplete', 'receipts', 'early zero-thread snapshot before delayed producer remains blocked')
await assertRejected(await buildCoreInput({
  pageSources: [earlyZeroThreadPage],
  snapshotObservedAt: '2026-08-01T00:16:00Z',
  recheckObservedAt: '2026-08-01T00:17:00Z',
}), 'temporal_binding_invalid', 'threads', 'later delayed-producer receipt cannot reuse earlier zero-thread snapshot')
const laterZeroThreadPage = { ...earlyZeroThreadPage, end_cursor: 'cursor-zero-terminal', source_observed_at: '2026-08-01T00:31:00Z' }
const laterZeroThreadResult = await evaluateReadyReviewTerminalObservationCoreV1(await buildCoreInput({ pageSources: [laterZeroThreadPage] }))
check(laterZeroThreadResult.branch === 'artifact_produced' && laterZeroThreadResult.artifact.thread_snapshot.pages[0].nodes.length === 0, 'zero-thread terminal snapshot admitted only after all receipts and stable later recheck')
const incompletePaginationPage = { ...clone(fixture.thread_pages[0]), page_ordinal: 0, end_cursor: 'cursor-more', has_next_page: true }
await assertRejected(await buildCoreInput({ pageSources: [incompletePaginationPage] }), 'thread_snapshot_invalid', 'threads', 'incomplete terminal pagination rejected')
const pageAfterSnapshot = clone(fixture.thread_pages)
pageAfterSnapshot[1].source_observed_at = '2026-08-01T00:32:01Z'
await assertRejected(await buildCoreInput({ pageSources: pageAfterSnapshot, snapshotObservedAt: '2026-08-01T00:32:00Z', recheckObservedAt: '2026-08-01T00:33:00Z' }), 'temporal_binding_invalid', 'threads', 'snapshot before final page rejected')
const recheckBeforeFinalPage = clone(fixture.thread_pages)
recheckBeforeFinalPage[1].source_observed_at = '2026-08-01T00:34:00Z'
await assertRejected(await buildCoreInput({ pageSources: recheckBeforeFinalPage, snapshotObservedAt: '2026-08-01T00:33:00Z', recheckObservedAt: '2026-08-01T00:33:30Z' }), 'temporal_binding_invalid', 'threads', 'post-snapshot recheck before final page rejected')

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
check((moduleSource.match(/export const selectCurrentReadyReviewAuthorityObservationsV1\s*=/g) ?? []).length === 1, 'one pure current Ready authority selector is defined')
check((moduleSource.match(/await selectCurrentReadyReviewAuthorityObservationsV1\(/g) ?? []).length === 1, 'Core invokes current Ready authority selector exactly once')
check(moduleSource.indexOf('await selectCurrentReadyReviewAuthorityObservationsV1(') < moduleSource.indexOf('const admittedReadyRecords:'), 'current Ready authority selection occurs before the existing admitted Ready record loop')
check(moduleSource.includes("!/^[1-9]\\d*$/.test(anchor.ready_event_id)"), 'current authority selector requires a positive-decimal REST Ready event ID')
check(!/graphql.*rest|rest.*graphql|node.?id.*event.?id/i.test(moduleSource), 'Core contains no GraphQL-to-REST Ready identity conversion path')
check(productionSource.includes('const producerIds = Array.isArray(roster?.producer_ids) ? roster.producer_ids : []'), 'owner adapter forwards literal roster scalars to fail-closed selection')
check(productionSource.indexOf('selectCurrentReadyReviewProducerSourcesV1(') < productionSource.indexOf('const hasOneSourcePerProducer'), 'selection occurs before existing per-producer admission and thread acquisition')
check(productionSource.includes('currentProducerSourceObservations.filter((source) => source.producer_id === producerId)') && productionSource.includes('producer_source_observations: currentProducerSourceObservations'), 'only selected current sources reach per-producer check and Core input')
check(productionSource.indexOf('await this.#collectThreadPages(') < productionSource.indexOf('const threadSnapshotObservedAt = new Date().toISOString()') && productionSource.indexOf('const threadSnapshotObservedAt = new Date().toISOString()') < productionSource.indexOf('await this.#collectPostSnapshotHeadRecheck(') && productionSource.indexOf('await this.#collectPostSnapshotHeadRecheck(') < productionSource.indexOf('const coreInput = {'), 'private adapter acquires complete pages, snapshot time, one post-snapshot HEAD recheck, then constructs Core input')
check((productionSource.match(/#collectPostSnapshotHeadRecheck\(/g) ?? []).length === 2, 'one private post-snapshot HEAD recheck helper has one call site')
check((productionSource.match(/head_changed_during_collection/g) ?? []).length === 3, 'initial, page-level, and post-snapshot HEAD changes share existing transport failure vocabulary')
check(productionSource.includes('post_snapshot_head_recheck: postSnapshotHeadRecheck'), 'private adapter passes acquired recheck into the single Core input')
check(!/export\s+(?:class|function|const|type)\s+PostSnapshotHeadRecheck/.test(moduleSource), 'post-snapshot projection remains module-local')
check((moduleSource.match(/export const parseReadyReviewTerminalObservationArtifactV1\s*=/g) ?? []).length === 1, 'one existing artifact parser remains')
check(!productionSource.includes('scripts/fixtures/'), 'production graph has no fixture reachability')
check(!/node:child_process|process\.|Date\.now\(|new Date\(|fetch\(|XMLHttpRequest/.test(moduleSource), 'pure Core module has no transport, environment, or clock read')
check(!/Completion|GateStatus|merge_allowed|stop_reason|violation_classification/.test(moduleSource), 'Core module excludes evaluator responsibilities')
check(packageJson.scripts['test:ready-review-terminal-observation-collector'] === 'node scripts/test-ready-review-terminal-observation-collector-v1.mjs', 'focused package script registered')
check(execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() === initialHead, 'focused test does not change HEAD')

console.log(`Ready Review Terminal Observation Collector V1: ${assertions} assertions passed`)
