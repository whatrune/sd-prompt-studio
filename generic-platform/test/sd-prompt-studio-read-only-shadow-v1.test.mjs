import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { digestCanonicalV1 } from '../src/core/role-dispatch-v1.mjs'
import {
  PARITY_REASON_FAMILIES_V1,
  canonicalSerializeSharedEvidenceV1,
  createGenericResultV1,
  createSharedSealedEvidenceV1,
  digestSharedEvidenceV1,
  sharedEvidenceSourceManifestV1,
  validateParityComparisonV1,
  validateSharedSealedEvidenceV1,
} from '../src/core/shared-sealed-evidence-v1.mjs'
import {
  compareProductionAndGenericV1,
  evaluateSharedEvidenceGenericV1,
  evaluateSdpsReadOnlyShadowV1,
  sdpsShadowBoundaryNamesV1,
  sdpsShadowProductionOwnerV1,
} from '../src/shadow/sd-prompt-studio-read-only-shadow-v1.mjs'
import {
  acquireMergeCheckRollupV1,
  acquireMergeReviewThreadsV1,
  acquireTransitionStateSnapshotV1,
  createProductionEvidenceCaptureV1,
  executeProductionWithLiveShadowArtifactsV1,
  projectProductionParityRecordBV1,
  resolveEffectiveReviewDecisionV1,
} from '../../scripts/run-protected-transition-admission-v1.mjs'

const adapterUrl = new URL('../adapters/sd-prompt-studio-read-only-shadow-v1.json', import.meta.url)
const fixtureUrl = new URL('../fixtures/sd-prompt-studio-shadow-parity-v1.json', import.meta.url)
const evaluatorUrl = new URL('../src/shadow/sd-prompt-studio-read-only-shadow-v1.mjs', import.meta.url)
const liveRunnerUrl = new URL('../src/shadow/run-sd-prompt-studio-live-shadow-v1.mjs', import.meta.url)
const adapter = JSON.parse(await readFile(adapterUrl, 'utf8'))
const fixtures = JSON.parse(await readFile(fixtureUrl, 'utf8'))
const evaluatorSource = await readFile(evaluatorUrl, 'utf8')
const liveRunnerSource = await readFile(liveRunnerUrl, 'utf8')
const productionRunnerSource = await readFile(new URL('../../scripts/run-protected-transition-admission-v1.mjs', import.meta.url), 'utf8')
let assertions = 0
const check = (condition, message) => { assertions += 1; assert.ok(condition, message) }
const throws = (operation, message) => { assertions += 1; assert.throws(operation, undefined, message) }
const clone = (value) => structuredClone(value)
const evaluate = (fixture) => evaluateSdpsReadOnlyShadowV1({
  immutableEvidenceBundle: fixture,
  declarativeAdapter: adapter,
})
const source = (fixture, sourceId) => fixture.source_records.find((record) => record.source_id === sourceId)
const resealCase = (fixture) => {
  const { case_sha256: ignored, ...payload } = fixture
  fixture.case_sha256 = digestCanonicalV1(payload)
  return fixture
}
const redigestSource = (record) => { record.sha256 = digestCanonicalV1(record.payload) }
const redigestProduction = (fixture) => { fixture.production_result.sha256 = digestCanonicalV1(fixture.production_result.payload) }
const actionsRunUrl = (runId) => `https://github.com/whatrune/sd-prompt-studio/actions/runs/${runId}`
const completePagination = (fixture, metadataName, sourceId) => {
  const record = source(fixture, sourceId)
  fixture.evidence_completeness[metadataName] = record
    ? { state: 'COMPLETE', page_count: 1, item_count: record.payload.length }
    : { state: 'NOT_APPLICABLE', page_count: 0, item_count: 0 }
}
const decorateCheckProvenance = (fixture, checkRecord) => {
  const identity = source(fixture, 'identity')?.payload
  const selfNames = new Set([
    'protected_transition_admission_v1',
    'protected_transition_repair_executor_v1',
    'protected_transition_role_dispatch_consumer_v1',
    'protected_transition_post_repair_review_v1',
    'protected_transition_merge_operator_v1',
  ])
  for (const checkRun of checkRecord.payload) {
    const isSelf = selfNames.has(checkRun.name)
    const evidenceRunId = isSelf ? fixture.run_id : Number(checkRun.generation_id)
    Object.assign(checkRun, {
      repository: 'whatrune/sd-prompt-studio',
      actions_run_url: actionsRunUrl(evidenceRunId),
      actions_run_id: evidenceRunId,
      source_run_relation: isSelf ? 'SAME_PRODUCTION_RTO_RUN' : 'PR_HEAD_CHECK',
      classification: isSelf ? 'PRODUCTION_RTO_SELF' : 'EXTERNAL_REQUIRED',
      current_generation: true,
    })
    if (!isSelf) {
      Object.assign(checkRun, {
        pr_number: identity.pr_number,
        target_head: identity.target_head,
        current_head: identity.current_head,
        check_suite_head: identity.current_head,
      })
    }
  }
  redigestSource(checkRecord)
}
const completeRecordedShape = (fixtureInput) => {
  const fixture = clone(fixtureInput)
  completePagination(fixture, 'review_history', 'review-comments')
  completePagination(fixture, 'checks', 'checks')
  completePagination(fixture, 'review_threads', 'threads')
  const checkRecord = source(fixture, 'checks')
  if (checkRecord) decorateCheckProvenance(fixture, checkRecord)
  const admission = fixture.production_result.payload.admission
  if (admission === null) {
    fixture.evidence_completeness.raw_production_admission = { state: 'NOT_APPLICABLE' }
    fixture.raw_production_result = { admission: null, progression: null }
  } else {
    fixture.evidence_completeness.raw_production_admission = { state: 'COMPLETE' }
    fixture.raw_production_result = {
      admission: {
        source_path: 'result.admission',
        admission_state: admission.state,
        admission_allowed: admission.allowed,
        admission_reason: admission.reason,
        external_check_success_count: admission.external_check_success_count,
        blocking_thread_count: admission.blocking_thread_count,
      },
      progression: {
        source_path: 'result.progression',
        next_action: admission.next_action,
      },
    }
  }
  fixture.expected_overall = 'MATCH'
  return resealCase(fixture)
}
const expectGlobalNotComparable = (result, reason, message) => {
  check(result.overall === 'NOT_COMPARABLE' && result.proof_pass === false, message)
  if (reason) check(Object.values(result.boundaries).every((boundary) => boundary.reason === reason), `${message}: bounded reason`)
}

check(fixtures.fixture_version === 1 && fixtures.record_type === 'sdps_shadow_parity_fixture_set_v1', 'fixture set is V1')
check(fixtures.cases.length === 4, 'exactly four recorded production fixtures are present')
check(
  fixtures.cases.map((fixture) => fixture.fixture_id).join('\n') === [
    'merge-eligible-31906618294',
    'blocking-review-thread-31891540356',
    'stale-binding-31367429466',
    'current-leaf-selection-31905911731',
  ].join('\n'),
  'fixture identities are the four frozen observed cases',
)
check(JSON.stringify(fixtures.production_owner) === JSON.stringify(sdpsShadowProductionOwnerV1()), 'production RTO ownership is unchanged')
check(
  sdpsShadowBoundaryNamesV1().join('\n') === 'identity\ncurrent_leaf_review\nterminal_evidence\nadmission\nrole_dispatch_binding',
  'the five frozen parity boundaries are exact',
)
check(
  adapter.paths.writable.length === 0 && adapter.commands.invocations.length === 0 &&
    adapter.credentials.required_capability_ids.length === 0 && adapter.protected_operation_ids.length === 0,
  'adapter grants no write, command, credential, or protected-operation capability',
)
check(
  adapter.repair.max_attempts === 0 && adapter.repair.max_files === 0 && adapter.repair.max_diff_bytes === 0 &&
    adapter.roles.merge_operator_profile_id === '',
  'Repair and Merge Operator stay disabled',
)

const fixtureBytesBefore = JSON.stringify(fixtures)
const recordedResults = Object.fromEntries(fixtures.cases.map((fixture) => [fixture.fixture_id, evaluate(fixture)]))
for (const fixture of fixtures.cases) {
  const result = recordedResults[fixture.fixture_id]
  check(fixture.expected_overall === 'NOT_COMPARABLE', `${fixture.fixture_id} records insufficient historical evidence explicitly`)
  check(result.overall === 'NOT_COMPARABLE' && result.proof_pass === false, `${fixture.fixture_id} is not reused as parity proof`)
  check(result.authority === 'NONE' && result.production_owner_unchanged === true, `${fixture.fixture_id} grants zero authority`)
  check(
    result.mutation_count === 0 && result.provider_invocation_count === 0 && result.protected_operation_count === 0,
    `${fixture.fixture_id} performs no mutation, provider invocation, or protected operation`,
  )
  check(result.a_pass === 'NOT_OBSERVED' && result.cutover_ready === false, `${fixture.fixture_id} cannot become A.PASS or cutover proof`)
}
check(JSON.stringify(fixtures) === fixtureBytesBefore, 'evaluation does not mutate immutable evidence')

const completeSuccess = completeRecordedShape(fixtures.cases[0])
const completeBlocked = completeRecordedShape(fixtures.cases[1])
const completeStale = completeRecordedShape(fixtures.cases[2])
const completeCurrentLeaf = completeRecordedShape(fixtures.cases[3])
for (const fixture of [completeSuccess, completeBlocked, completeStale, completeCurrentLeaf]) {
  const result = evaluate(fixture)
  check(result.overall === 'MATCH' && result.proof_pass === true, `${fixture.fixture_id} complete contract shape compares successfully`)
  check(result.authority === 'NONE' && result.a_pass === 'NOT_OBSERVED' && result.cutover_ready === false, `${fixture.fixture_id} MATCH has zero production authority`)
}
check(
  evaluate(completeBlocked).boundaries.terminal_evidence.status === 'MATCH',
  'exactly identified failed production RTO self-check is excluded under the frozen rule',
)
check(evaluate(completeSuccess).overall === 'MATCH', 'exact-bound external checks preserve the recorded expected behavior')

const historicalGeneration = clone(completeSuccess)
const historicalChecks = source(historicalGeneration, 'checks')
const oldBuild = clone(historicalChecks.payload[0])
oldBuild.generation_id = '94657181268'
oldBuild.actions_run_id = 94657181268
oldBuild.actions_run_url = actionsRunUrl(oldBuild.actions_run_id)
oldBuild.started_at = '2026-08-14T02:39:48Z'
oldBuild.current_generation = false
oldBuild.conclusion = 'failure'
historicalChecks.payload.unshift(oldBuild)
historicalGeneration.evidence_completeness.checks.item_count = historicalChecks.payload.length
redigestSource(historicalChecks)
resealCase(historicalGeneration)
check(evaluate(historicalGeneration).overall === 'MATCH', 'historical failed generation is distinguished from the current successful generation')

const identityUnboundSelf = clone(completeBlocked)
const unboundSelfCheck = source(identityUnboundSelf, 'checks').payload.find((entry) => entry.name === 'protected_transition_admission_v1')
unboundSelfCheck.actions_run_id += 1
unboundSelfCheck.actions_run_url = actionsRunUrl(unboundSelfCheck.actions_run_id)
redigestSource(source(identityUnboundSelf, 'checks'))
resealCase(identityUnboundSelf)
expectGlobalNotComparable(evaluate(identityUnboundSelf), 'self_check_identity_unknown', 'identity-unbound failed self-check is not silently excluded')

const mutateExternalCheck = (mutate) => {
  const fixture = clone(completeSuccess)
  const checkRecord = source(fixture, 'checks')
  const externalCheck = checkRecord.payload.find((entry) => entry.name === 'build-preview')
  mutate(externalCheck, checkRecord, fixture)
  redigestSource(checkRecord)
  resealCase(fixture)
  return fixture
}

expectGlobalNotComparable(
  evaluate(mutateExternalCheck((externalCheck) => { externalCheck.pr_number += 1 })),
  'check_provenance_ambiguous',
  'successful external check from a different PR is not comparable',
)
expectGlobalNotComparable(
  evaluate(mutateExternalCheck((externalCheck) => {
    externalCheck.target_head = 'f'.repeat(40)
    externalCheck.current_head = 'f'.repeat(40)
    externalCheck.check_suite_head = 'f'.repeat(40)
  })),
  'check_provenance_ambiguous',
  'successful external check from a different HEAD is not comparable',
)
expectGlobalNotComparable(
  evaluate(mutateExternalCheck((externalCheck) => { delete externalCheck.pr_number })),
  'check_evidence_invalid',
  'external check without PR identity is not comparable',
)
expectGlobalNotComparable(
  evaluate(mutateExternalCheck((externalCheck) => { delete externalCheck.check_suite_head })),
  'check_evidence_invalid',
  'external check without check-suite HEAD is not comparable',
)
expectGlobalNotComparable(
  evaluate(mutateExternalCheck((externalCheck, checkRecord, fixture) => {
    const competing = clone(externalCheck)
    competing.generation_id = String(Number(externalCheck.generation_id) + 1)
    competing.actions_run_id = Number(competing.generation_id)
    competing.actions_run_url = actionsRunUrl(competing.actions_run_id)
    competing.started_at = '2026-08-14T02:39:50Z'
    checkRecord.payload.push(competing)
    fixture.evidence_completeness.checks.item_count = checkRecord.payload.length
  })),
  'check_generation_ambiguous',
  'multiple current external check generations are not comparable',
)

for (const [metadataName, reason] of [
  ['checks', 'checks_pagination_incomplete'],
  ['review_threads', 'review_thread_pagination_incomplete'],
  ['review_history', 'review_history_pagination_incomplete'],
]) {
  const incomplete = clone(completeSuccess)
  incomplete.evidence_completeness[metadataName].state = 'INCOMPLETE'
  incomplete.evidence_completeness[metadataName].page_count = null
  resealCase(incomplete)
  expectGlobalNotComparable(evaluate(incomplete), reason, `${metadataName} pagination incompleteness fails closed`)
}

const missingNestedProjectionField = clone(completeSuccess)
delete missingNestedProjectionField.production_result.payload.admission.reason
redigestProduction(missingNestedProjectionField)
resealCase(missingNestedProjectionField)
expectGlobalNotComparable(evaluate(missingNestedProjectionField), 'production_admission_projection_invalid', 'missing nested Admission projection field fails closed')

const missingRawAdmissionField = clone(completeSuccess)
delete missingRawAdmissionField.raw_production_result.admission.admission_reason
resealCase(missingRawAdmissionField)
expectGlobalNotComparable(evaluate(missingRawAdmissionField), 'raw_production_admission_invalid', 'missing raw nested Admission field fails closed')

const progressionSubstitution = clone(completeSuccess)
progressionSubstitution.raw_production_result.admission.admission_reason = progressionSubstitution.raw_production_result.progression.next_action
resealCase(progressionSubstitution)
expectGlobalNotComparable(evaluate(progressionSubstitution), 'production_admission_projection_binding_invalid', 'top-level progression value cannot substitute for nested Admission evidence')

const malformedAdmissionType = clone(completeSuccess)
malformedAdmissionType.raw_production_result.admission.admission_allowed = 'true'
resealCase(malformedAdmissionType)
expectGlobalNotComparable(evaluate(malformedAdmissionType), 'raw_production_admission_invalid', 'malformed nested Admission type fails closed')

for (const [field, value, message] of [
  ['reason', 'future_unknown_reason', 'future unknown Admission reason'],
  ['state', 'FUTURE_UNKNOWN_STATE', 'future unknown Admission state'],
  ['next_action', 'FUTURE_UNKNOWN_NEXT_ACTION', 'future unknown Admission next action'],
]) {
  const unknownProjectionValue = clone(completeSuccess)
  unknownProjectionValue.production_result.payload.admission[field] = value
  redigestProduction(unknownProjectionValue)
  resealCase(unknownProjectionValue)
  expectGlobalNotComparable(
    evaluate(unknownProjectionValue),
    'production_admission_projection_invalid',
    `${message} is not compared`,
  )
}

const undefinedKnownAdmissionTuple = clone(completeSuccess)
Object.assign(undefinedKnownAdmissionTuple.production_result.payload.admission, {
  state: 'REVIEW_BLOCKED',
  reason: 'merge_gate_satisfied',
  next_action: 'STOP',
})
redigestProduction(undefinedKnownAdmissionTuple)
resealCase(undefinedKnownAdmissionTuple)
expectGlobalNotComparable(
  evaluate(undefinedKnownAdmissionTuple),
  'production_admission_projection_invalid',
  'known Admission values in an undefined tuple are not compared',
)

for (const [field, value] of [
  ['state', 1],
  ['reason', false],
  ['next_action', { future: true }],
]) {
  const malformedProjectionType = clone(completeSuccess)
  malformedProjectionType.production_result.payload.admission[field] = value
  redigestProduction(malformedProjectionType)
  resealCase(malformedProjectionType)
  expectGlobalNotComparable(
    evaluate(malformedProjectionType),
    'production_admission_projection_invalid',
    `malformed Admission ${field} type is not compared`,
  )
}

for (const [state, reason, nextAction] of [
  ['MERGE_ELIGIBLE', 'merge_gate_satisfied', 'MERGE_DECISION'],
  ['REVIEW_BLOCKED', 'blocking_review_threads_present', 'STOP'],
  ['STALE', 'head_binding_stale', 'STOP'],
  ['INDETERMINATE', 'review_decision_candidate_invalid', 'STOP'],
]) {
  const knownTuple = clone(completeSuccess)
  Object.assign(knownTuple.production_result.payload.admission, { state, reason, next_action: nextAction })
  Object.assign(knownTuple.raw_production_result.admission, {
    admission_state: state,
    admission_reason: reason,
  })
  knownTuple.raw_production_result.progression.next_action = nextAction
  redigestProduction(knownTuple)
  knownTuple.expected_overall = state === 'MERGE_ELIGIBLE' ? 'MATCH' : 'MISMATCH'
  resealCase(knownTuple)
  check(
    evaluate(knownTuple).boundaries.admission.status !== 'NOT_COMPARABLE',
    `${state} / ${reason} / ${nextAction} remains comparable`,
  )
}

for (const [field, value] of [
  ['run_url', actionsRunUrl(99999999991)],
  ['run_id', 99999999992],
  ['host_sha', 'f'.repeat(40)],
]) {
  const tampered = clone(completeSuccess)
  tampered[field] = value
  expectGlobalNotComparable(evaluate(tampered), 'fixture_case_digest_invalid', `${field}-only envelope mutation fails the case seal`)
}
const triplyTampered = clone(completeSuccess)
triplyTampered.run_id = 99999999993
triplyTampered.run_url = actionsRunUrl(triplyTampered.run_id)
triplyTampered.host_sha = 'e'.repeat(40)
expectGlobalNotComparable(evaluate(triplyTampered), 'fixture_case_digest_invalid', 'syntactically valid run URL, run ID, and host SHA mutation fails the case seal')

const changedSourceDigest = clone(completeSuccess)
source(changedSourceDigest, 'identity').sha256 = '0'.repeat(64)
resealCase(changedSourceDigest)
expectGlobalNotComparable(evaluate(changedSourceDigest), 'evidence_digest_invalid', 'source digest mismatch fails even under a valid case seal')

const validSubdigestTamperedEnvelope = clone(completeSuccess)
validSubdigestTamperedEnvelope.run_url = actionsRunUrl(99999999994)
check(
  source(validSubdigestTamperedEnvelope, 'identity').sha256 === digestCanonicalV1(source(validSubdigestTamperedEnvelope, 'identity').payload),
  'sub-digests remain individually valid in the envelope-tamper regression',
)
expectGlobalNotComparable(evaluate(validSubdigestTamperedEnvelope), 'fixture_case_digest_invalid', 'valid sub-digests cannot rescue a tampered case envelope')

const deliberateMismatch = clone(completeSuccess)
deliberateMismatch.production_result.payload.identity.binding_state = 'STALE'
redigestProduction(deliberateMismatch)
deliberateMismatch.expected_overall = 'MISMATCH'
resealCase(deliberateMismatch)
const mismatch = evaluate(deliberateMismatch)
check(mismatch.overall === 'MISMATCH' && mismatch.proof_pass === false, 'validly sealed semantic difference is MISMATCH and fails proof')
check(mismatch.authority === 'NONE' && mismatch.mutation_count === 0, 'MISMATCH remains zero-authority and cannot affect production')

const declaredMismatchCalculatedMatch = clone(completeSuccess)
declaredMismatchCalculatedMatch.expected_overall = 'MISMATCH'
resealCase(declaredMismatchCalculatedMatch)
expectGlobalNotComparable(
  evaluate(declaredMismatchCalculatedMatch),
  'fixture_expected_overall_mismatch',
  'declared MISMATCH with calculated MATCH is not comparable',
)

const declaredNotComparableCalculatedMatch = clone(completeSuccess)
declaredNotComparableCalculatedMatch.expected_overall = 'NOT_COMPARABLE'
resealCase(declaredNotComparableCalculatedMatch)
expectGlobalNotComparable(
  evaluate(declaredNotComparableCalculatedMatch),
  'fixture_expected_overall_mismatch',
  'declared NOT_COMPARABLE with calculated MATCH is not comparable',
)

const declaredMatchCalculatedMismatch = clone(deliberateMismatch)
declaredMatchCalculatedMismatch.expected_overall = 'MATCH'
resealCase(declaredMatchCalculatedMismatch)
expectGlobalNotComparable(
  evaluate(declaredMatchCalculatedMismatch),
  'fixture_expected_overall_mismatch',
  'declared MATCH with calculated MISMATCH is not comparable',
)

const calculatedNotComparable = clone(completeSuccess)
calculatedNotComparable.production_result.payload.current_leaf_review = null
redigestProduction(calculatedNotComparable)
resealCase(calculatedNotComparable)
expectGlobalNotComparable(
  evaluate(calculatedNotComparable),
  'fixture_expected_overall_mismatch',
  'declared MATCH with calculated NOT_COMPARABLE is not comparable',
)

const matchingNotComparable = clone(calculatedNotComparable)
matchingNotComparable.expected_overall = 'NOT_COMPARABLE'
resealCase(matchingNotComparable)
const expectedNotComparable = evaluate(matchingNotComparable)
check(
  expectedNotComparable.overall === 'NOT_COMPARABLE' && expectedNotComparable.proof_pass === false,
  'matching NOT_COMPARABLE declaration preserves the calculated result',
)

const missingEvidence = clone(completeSuccess)
missingEvidence.source_records = missingEvidence.source_records.filter((record) => record.source_id !== 'threads')
resealCase(missingEvidence)
expectGlobalNotComparable(evaluate(missingEvidence), 'pagination_completeness_invalid', 'missing evidence fails closed')

const unknownEvidence = clone(completeSuccess)
const unknownChecks = source(unknownEvidence, 'checks')
unknownChecks.payload[0].name = 'unknown-production-check'
redigestSource(unknownChecks)
resealCase(unknownEvidence)
expectGlobalNotComparable(evaluate(unknownEvidence), 'check_name_unknown', 'unknown check evidence fails closed')

const liveBinding = {
  repository: 'whatrune/sd-prompt-studio', task_issue_number: 251, pr_number: 318,
  exact_head: 'a'.repeat(40), run_id: '5311220036', run_attempt: 1, host_sha: 'b'.repeat(40),
  acquisition_generation: 'c'.repeat(64), production_execution_instance: 'd'.repeat(64),
}
const liveReview = {
  record_type: 'gadp_review_v1',
  identity: {
    record_type: 'gadp_identity_v1', repository: liveBinding.repository,
    task_issue_number: liveBinding.task_issue_number, pr_number: liveBinding.pr_number,
    exact_head: liveBinding.exact_head, attempt: liveBinding.run_attempt,
  },
  source_id: 'issue-comment-100', source_order: 1, observed_at: '2026-08-17T00:00:00Z',
  decision: 'APPROVE', blocking_finding_count: 0, remaining_finding_count: 0, unknown_count: 0,
}
const liveInput = {
  binding: liveBinding,
  review_history: {
    completeness: 'COMPLETE', page_count: 1, item_count: 1,
    observations: [{
      kind: 'VALID', source_id: liveReview.source_id, source_order: liveReview.source_order,
      observed_at: liveReview.observed_at, review: liveReview,
    }],
  },
  checks: {
    completeness: 'COMPLETE', page_count: 1, item_count: 2,
    items: [
      ['build-preview', '15368', 'build-preview'],
      ['cloudflare-pages', '85455', 'Cloudflare Pages'],
    ].map(([checkId, appId, name], index) => ({
      check_id: checkId, generation_id: `generation-${index + 1}`, current: true, required: true,
      status: 'COMPLETED', conclusion: 'SUCCESS',
      provenance: {
        repository: liveBinding.repository, pr_number: liveBinding.pr_number,
        target_head: liveBinding.exact_head, current_head: liveBinding.exact_head,
        check_suite_head: liveBinding.exact_head, app_id: appId, name,
        actions_run_id: String(6000 + index),
      },
    })),
  },
  threads: {
    completeness: 'COMPLETE', page_count: 1, item_count: 1,
    items: [{ thread_id: 'thread-1', resolved: true, outdated: false }],
  },
  state: {
    completeness: 'COMPLETE',
    task: { repository: liveBinding.repository, number: liveBinding.task_issue_number, state: 'open', is_pull_request: false },
    pull: { repository: liveBinding.repository, number: liveBinding.pr_number, state: 'open', head: liveBinding.exact_head },
    task_state: {
      record_type: 'protected_transition_task_state_v1', task_issue_number: liveBinding.task_issue_number,
      pr_number: liveBinding.pr_number, observed_head: liveBinding.exact_head,
      authorized_paths: ['generic-platform/src/core/shared-sealed-evidence-v1.mjs'],
      architecture_status: 'APPROVED', implementation_authorized: true,
      review_status: 'APPROVE', reviewed_head: liveBinding.exact_head, review_blocker_count: 0,
    },
  },
  authorized_scope: {
    completeness: 'COMPLETE',
    actual_paths: ['generic-platform/src/core/shared-sealed-evidence-v1.mjs'],
    authorized_paths: ['generic-platform/src/core/shared-sealed-evidence-v1.mjs'],
  },
  admission_inputs: {
    transition: 'merge_decision_admission', required_check_ids: ['build-preview', 'cloudflare-pages'],
    production_rto_owner: {
      workflow: '.github/workflows/protected-transition-admission-v1.yml',
      runner: 'scripts/run-protected-transition-admission-v1.mjs',
    },
  },
  capture_ambiguities: [],
}
const makeRecordA = (mutate = () => {}) => {
  const input = clone(liveInput)
  mutate(input)
  return createSharedSealedEvidenceV1(input)
}
const productionSuccess = {
  state: 'MERGE_ELIGIBLE', allowed: false, reason: 'merge_decision_required', next_action: 'PRODUCT_OWNER_IMPLEMENTATION_LEAD',
  admission_state: 'MERGE_ELIGIBLE', admission_allowed: true, admission_reason: 'merge_gate_satisfied',
  task_issue_number: liveBinding.task_issue_number, pr_number: liveBinding.pr_number,
  current_head: liveBinding.exact_head, external_check_success_count: 2, blocking_thread_count: 0,
}
const recordA = makeRecordA()
const recordARepeat = makeRecordA()
check(recordA.sha256 === recordARepeat.sha256 && canonicalSerializeSharedEvidenceV1(recordA.payload) === canonicalSerializeSharedEvidenceV1(recordARepeat.payload), 'Record A canonical serialization and SHA-256 seal are deterministic')
check(recordA.payload.proof_capable && recordA.payload.authority === 'NONE', 'complete unambiguous Record A is proof-capable but grants no authority')
check(recordA.payload.source_manifest.map((item) => item.source_id).join('\n') === sharedEvidenceSourceManifestV1().join('\n'), 'Record A source manifest is exact and complete')
check(recordA.payload.source_manifest.every((item) => item.sha256 === digestSharedEvidenceV1(recordA.payload[item.source_id])), 'every Record A manifest digest binds its exact source')
throws(() => validateSharedSealedEvidenceV1({ ...recordA, extra: true }), 'Record A outer schema rejects unknown fields')
const corruptedA = clone(recordA)
corruptedA.payload.binding.run_id = '5311220037'
throws(() => validateSharedSealedEvidenceV1(corruptedA), 'Record A payload drift breaks the SHA-256 seal')
const incompleteA = makeRecordA((input) => {
  input.review_history.completeness = 'INCOMPLETE'
  input.review_history.page_count = null
  input.capture_ambiguities = ['SOURCE_INCOMPLETE']
})
check(!incompleteA.payload.proof_capable, 'incomplete capture remains non-proof-capable')

const productionStateBody = `<!-- protected-transition-task-state-v1:start -->\n\`\`\`json\n${JSON.stringify(liveInput.state.task_state)}\n\`\`\`\n<!-- protected-transition-task-state-v1:end -->`
const productionReviewBody = `# Independent Review Decision\n\n\`\`\`yaml\nrecord_type: independent_review_decision_v1\nauthoring_role: "Independent Reviewer"\ntask_issue: "https://github.com/${liveBinding.repository}/issues/${liveBinding.task_issue_number}"\npull_request: "https://github.com/${liveBinding.repository}/pull/${liveBinding.pr_number}"\nreviewed_head: "${liveBinding.exact_head}"\ndecision: APPROVE\nblocking_finding_count: 0\nremaining_finding_count: 0\nunknown_count: 0\nstatus: completed\nexecution_stop_reason: completed\n\`\`\``
const productionRequest = {
  transition: 'merge_decision_admission', repository: liveBinding.repository,
  taskIssueNumber: liveBinding.task_issue_number, prNumber: liveBinding.pr_number,
  exactHead: liveBinding.exact_head, currentWorkflowRunId: liveBinding.run_id,
}
let repositoryGeneration = 1
let acquisitionCallCount = 0
const acquisitionHost = {
  api: async (endpoint) => {
    acquisitionCallCount += 1
    if (endpoint === `repos/${liveBinding.repository}/pulls/${liveBinding.pr_number}`) return {
      number: liveBinding.pr_number, state: 'open', base: { repo: { full_name: liveBinding.repository } },
      body: productionStateBody, head: { sha: liveBinding.exact_head }, changed_files: 1,
    }
    if (endpoint === `repos/${liveBinding.repository}/issues/${liveBinding.task_issue_number}`) return {
      number: liveBinding.task_issue_number, state: 'open',
      repository_url: `https://api.github.com/repos/${liveBinding.repository}`,
      html_url: `https://github.com/${liveBinding.repository}/issues/${liveBinding.task_issue_number}`,
    }
    if (endpoint.startsWith(`repos/${liveBinding.repository}/pulls/${liveBinding.pr_number}/files?`)) return [
      { filename: 'generic-platform/src/core/shared-sealed-evidence-v1.mjs', status: 'modified' },
    ]
    if (endpoint.startsWith(`repos/${liveBinding.repository}/issues/${liveBinding.task_issue_number}/comments?`)) return [
      { id: 100, created_at: liveReview.observed_at, author_association: 'MEMBER', body: productionReviewBody },
    ]
    if (endpoint === `repos/${liveBinding.repository}/issues/comments/100`) return {
      id: 100, issue_url: `https://api.github.com/repos/${liveBinding.repository}/issues/${liveBinding.task_issue_number}`,
      created_at: liveReview.observed_at, author_association: 'MEMBER', body: productionReviewBody,
    }
    throw new Error(`unexpected_api_${endpoint}`)
  },
  graphql: async (query) => {
    acquisitionCallCount += 1
    return query.includes('statusCheckRollup') ? {
    repository: {
      pullRequest: { headRefOid: liveBinding.exact_head },
      object: {
        oid: liveBinding.exact_head,
        statusCheckRollup: {
          contexts: {
            totalCount: 2,
            nodes: [
              { __typename: 'CheckRun', id: `check-${repositoryGeneration}-1`, name: 'build-preview', status: 'COMPLETED', conclusion: 'SUCCESS', detailsUrl: `https://github.com/${liveBinding.repository}/actions/runs/${6000 + repositoryGeneration}/job/1`, startedAt: '2026-08-17T00:00:01Z', checkSuite: { app: { id: '15368' } } },
              { __typename: 'CheckRun', id: `check-${repositoryGeneration}-2`, name: 'Cloudflare Pages', status: 'COMPLETED', conclusion: 'SUCCESS', detailsUrl: `https://github.com/${liveBinding.repository}/actions/runs/${6100 + repositoryGeneration}/job/2`, startedAt: '2026-08-17T00:00:02Z', checkSuite: { app: { id: '85455' } } },
            ],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      },
    },
    } : {
    repository: {
      pullRequest: {
        number: liveBinding.pr_number, state: 'OPEN', isDraft: false, mergeable: 'MERGEABLE',
        mergeStateStatus: 'CLEAN', headRefOid: liveBinding.exact_head,
        reviewThreads: { totalCount: 0, nodes: [], pageInfo: { hasNextPage: false, endCursor: null } },
      },
    },
    }
  },
}
const productionCapture = createProductionEvidenceCaptureV1({
  request: productionRequest, host: acquisitionHost, runId: liveBinding.run_id,
  runAttempt: liveBinding.run_attempt, hostSha: liveBinding.host_sha,
})
await resolveEffectiveReviewDecisionV1({
  request: productionRequest,
  parsedEvent: {
    commentId: 100, commentCreatedAt: liveReview.observed_at, reviewBody: productionReviewBody,
    authorAssociation: 'MEMBER',
  },
  host: productionCapture.host,
})
await acquireTransitionStateSnapshotV1(productionRequest, productionCapture.host)
await acquireMergeCheckRollupV1(productionRequest, productionCapture.host)
await acquireMergeReviewThreadsV1(productionRequest, productionCapture.host)
const callsAtProductionBoundary = acquisitionCallCount
repositoryGeneration = 2
const acquiredA = productionCapture.sealRecordA()
check(acquisitionCallCount === callsAtProductionBoundary, 'Record A sealing performs no second GitHub acquisition after production consumption')
check(acquiredA.payload.proof_capable && acquiredA.payload.source_manifest.length === 7, 'production-consumed snapshots seal a proof-capable exact-manifest Record A')
check(acquiredA.payload.review_history.page_count === 1 && acquiredA.payload.checks.page_count === 1 && acquiredA.payload.threads.page_count === 1, 'production-consumed snapshots retain complete pagination for Review, checks, and threads')
check(acquiredA.payload.checks.items.every((item) => item.generation_id.startsWith('check-1-') && item.provenance.target_head === liveBinding.exact_head && item.provenance.check_suite_head === liveBinding.exact_head), 'Record A remains bound to consumed generation N after repository generation N+1 exists')

const recordB = projectProductionParityRecordBV1({ recordA, productionResult: productionSuccess })
const resultG = evaluateSharedEvidenceGenericV1({ recordA })
const recordC = compareProductionAndGenericV1({ productionRecord: recordB, genericResult: resultG })
check(recordB.payload.record_a_sha256 === recordA.sha256 && recordB.payload.projection_status === 'COMPARABLE', 'Record B binds Record A and uses a closed production projection')
check(resultG.payload.record_a_sha256 === recordA.sha256 && resultG.payload.authority === 'NONE', 'Generic Result G consumes and binds Record A with authority NONE')
check(recordC.payload.parity_binding === 'MATCHED' && recordC.payload.semantic === 'MATCH' && recordC.payload.proof_pass, 'Record C reports MATCH only under matched bindings and comparable semantics')
check(validateParityComparisonV1(recordC).sha256 === recordC.sha256, 'Record C closed schema and digest validate')
throws(() => evaluateSharedEvidenceGenericV1({ recordA, productionResult: productionSuccess }), 'Generic Result G rejects production-result input')

const unknownB = projectProductionParityRecordBV1({
  recordA,
  productionResult: { ...productionSuccess, reason: 'future_reason' },
})
const unknownC = compareProductionAndGenericV1({ productionRecord: unknownB, genericResult: resultG })
check(unknownB.payload.projection_status === 'NOT_COMPARABLE' && unknownC.payload.semantic === 'NOT_COMPARABLE', 'unknown production state/reason/next-action tuple is NOT_COMPARABLE')
const incompleteB = projectProductionParityRecordBV1({ recordA: incompleteA, productionResult: productionSuccess })
const incompleteG = evaluateSharedEvidenceGenericV1({ recordA: incompleteA })
check(incompleteB.payload.projection_reason === 'RECORD_A_NON_PROOF_CAPABLE' && incompleteG.payload.projection_reason === 'RECORD_A_NON_PROOF_CAPABLE', 'B and G cannot upgrade incomplete Record A')

const conflictingA = makeRecordA((input) => { input.binding.run_id = '5311220037' })
const conflictingG = evaluateSharedEvidenceGenericV1({ recordA: conflictingA })
const conflictC = compareProductionAndGenericV1({ productionRecord: recordB, genericResult: conflictingG })
check(conflictC.payload.parity_binding === 'CONFLICT' && conflictC.payload.semantic === 'NOT_COMPARABLE' && !conflictC.payload.proof_pass, 'Record A digest/run binding conflict is explicit and not comparable')
const laterGenerationA = makeRecordA((input) => { input.binding.acquisition_generation = 'e'.repeat(64) })
const laterGenerationG = evaluateSharedEvidenceGenericV1({ recordA: laterGenerationA })
const laterGenerationC = compareProductionAndGenericV1({ productionRecord: recordB, genericResult: laterGenerationG })
check(laterGenerationC.payload.parity_binding === 'CONFLICT' && !laterGenerationC.payload.proof_pass, 'same normalized semantic tuple from a different acquisition generation is rejected')
const invalidB = clone(recordB)
invalidB.sha256 = '0'.repeat(64)
const invalidC = compareProductionAndGenericV1({ productionRecord: invalidB, genericResult: resultG })
check(invalidC.payload.parity_binding === 'INVALID' && invalidC.payload.semantic === 'NOT_COMPARABLE', 'invalid B input produces INVALID and not comparable')
const mismatchG = createGenericResultV1({
  ...resultG.payload,
  semantics: {
    state: 'STALE', allowed: false, reason_family: 'HEAD_BINDING_STALE', next_action: 'STOP',
    external_check_success_count: 0, blocking_thread_count: 0,
  },
})
const mismatchC = compareProductionAndGenericV1({ productionRecord: recordB, genericResult: mismatchG })
check(mismatchC.payload.parity_binding === 'MATCHED' && mismatchC.payload.semantic === 'MISMATCH' && !mismatchC.payload.proof_pass, 'common binding with different semantics produces MISMATCH')
throws(() => compareProductionAndGenericV1({ productionRecord: recordB, genericResult: resultG, networkResult: {} }), 'Record C comparator accepts only B and G')
const staleA = makeRecordA((input) => { input.state.pull.head = 'c'.repeat(40) })
const staleB = projectProductionParityRecordBV1({
  recordA: staleA,
  productionResult: {
    ...productionSuccess, state: 'STALE', allowed: false, reason: 'head_binding_stale', next_action: 'STOP',
    current_head: 'c'.repeat(40), external_check_success_count: 0,
  },
})
const staleG = evaluateSharedEvidenceGenericV1({ recordA: staleA })
const staleC = compareProductionAndGenericV1({ productionRecord: staleB, genericResult: staleG })
check(staleC.payload.semantic === 'MATCH' && staleC.payload.proof_pass, 'stale current HEAD remains exactly bound and comparable to the target HEAD record')
const blockedA = makeRecordA((input) => { input.threads.items[0].resolved = false })
const blockedG = evaluateSharedEvidenceGenericV1({ recordA: blockedA })
const productionBlocked = {
  state: 'REVIEW_BLOCKED', allowed: false, reason: 'blocking_review_threads_present', next_action: 'STOP',
  task_issue_number: liveBinding.task_issue_number, pr_number: liveBinding.pr_number,
  current_head: liveBinding.exact_head, external_check_success_count: 2, blocking_thread_count: 1,
}
const blockedB = projectProductionParityRecordBV1({ recordA: blockedA, productionResult: productionBlocked })
check(blockedB.payload.semantics.external_check_success_count === 2 && blockedB.payload.semantics.blocking_thread_count === 1, 'Record B uses exact production terminal counts instead of reconstructing them from Record A')
check(compareProductionAndGenericV1({ productionRecord: blockedB, genericResult: blockedG }).payload.proof_pass, 'exact production REVIEW_BLOCKED fields compare against the same sealed generation')
const missingProductionCountB = projectProductionParityRecordBV1({
  recordA: blockedA,
  productionResult: Object.fromEntries(Object.entries(productionBlocked).filter(([key]) => key !== 'blocking_thread_count')),
})
check(missingProductionCountB.payload.projection_status === 'NOT_COMPARABLE', 'missing production terminal count is not reconstructed from Record A')
const driftedProductionCountB = projectProductionParityRecordBV1({
  recordA: blockedA, productionResult: { ...productionBlocked, external_check_success_count: 1 },
})
check(compareProductionAndGenericV1({ productionRecord: driftedProductionCountB, genericResult: blockedG }).payload.semantic === 'MISMATCH', 'production terminal count drift remains visible as MISMATCH')
check(PARITY_REASON_FAMILIES_V1.join('\n') === 'ADMISSION_ELIGIBLE\nHEAD_BINDING_STALE\nREVIEW_EVIDENCE_INVALID\nREVIEW_THREADS_BLOCKING', 'reason-family vocabulary is closed and total for frozen mappings')

const historicalMalformedA = makeRecordA((input) => {
  input.review_history.item_count = 2
  input.review_history.observations.unshift({
    kind: 'MALFORMED_ORDERABLE', source_id: 'issue-comment-090', source_order: 1,
    observed_at: '2026-08-16T23:59:59Z', review: null,
  })
  input.review_history.observations[1].source_order = 2
  input.review_history.observations[1].review.source_order = 2
})
check(evaluateSharedEvidenceGenericV1({ recordA: historicalMalformedA }).payload.projection_status === 'COMPARABLE', 'older orderable malformed marker remains harmless historical residue')
const laterMalformedA = makeRecordA((input) => {
  input.review_history.item_count = 2
  input.review_history.observations.push({
    kind: 'MALFORMED_ORDERABLE', source_id: 'issue-comment-110', source_order: 2,
    observed_at: '2026-08-17T00:00:01Z', review: null,
  })
})
const laterMalformedG = evaluateSharedEvidenceGenericV1({ recordA: laterMalformedA })
check(laterMalformedG.payload.semantics?.reason_family === 'REVIEW_EVIDENCE_INVALID', 'malformed marker at or after current leaf fails closed under production-approved semantics')
const unorderableA = makeRecordA((input) => {
  input.review_history.item_count = 2
  input.review_history.observations.push({ kind: 'MALFORMED_UNORDERABLE', source_id: null, source_order: null, observed_at: null, review: null })
  input.capture_ambiguities = ['REVIEW_UNORDERABLE']
})
check(!unorderableA.payload.proof_capable && evaluateSharedEvidenceGenericV1({ recordA: unorderableA }).payload.projection_status === 'NOT_COMPARABLE', 'unorderable malformed marker cannot become proof-capable')
throws(() => makeRecordA((input) => {
  input.review_history.observations[0].review.blocking_finding_count = 1
  input.review_history.observations[0].review.remaining_finding_count = 1
}), 'APPROVE is valid only at 0/0/0')

const productionInvariant = Object.freeze({ ...productionSuccess })
const transportOrder = []
let driftRecordA
let driftRecordB
let driftProductionCallCount
repositoryGeneration = 3
const orderedInvariant = await executeProductionWithLiveShadowArtifactsV1({
  createEvidenceCapture: () => {
    transportOrder.push('capture_created')
    return createProductionEvidenceCaptureV1({
      request: productionRequest, host: acquisitionHost, runId: liveBinding.run_id,
      runAttempt: liveBinding.run_attempt, hostSha: liveBinding.host_sha,
    })
  },
  executeProduction: async (productionHost) => {
    transportOrder.push('production_acquisition')
    await resolveEffectiveReviewDecisionV1({
      request: productionRequest,
      parsedEvent: {
        commentId: 100, commentCreatedAt: liveReview.observed_at, reviewBody: productionReviewBody,
        authorAssociation: 'MEMBER',
      },
      host: productionHost,
    })
    await acquireTransitionStateSnapshotV1(productionRequest, productionHost)
    await acquireMergeCheckRollupV1(productionRequest, productionHost)
    await acquireMergeReviewThreadsV1(productionRequest, productionHost)
    driftProductionCallCount = acquisitionCallCount
    repositoryGeneration = 4
    transportOrder.push('production_decision')
    return productionInvariant
  },
  writeRecordA: async (value) => { driftRecordA = value; transportOrder.push('record_a_seal_transport') },
  writeRecordB: async (value) => { driftRecordB = value; transportOrder.push('record_b_seal_transport') },
})
check(orderedInvariant === productionInvariant && transportOrder.join('\n') === 'capture_created\nproduction_acquisition\nproduction_decision\nrecord_a_seal_transport\nrecord_b_seal_transport', 'transport seals A from production-consumed snapshots and projects B only after the production decision')
check(acquisitionCallCount === driftProductionCallCount && driftRecordA.payload.checks.items.every((item) => item.generation_id.startsWith('check-3-')), 'inter-acquisition drift PoC uses sealed generation N with no post-production refetch')
const driftGeneric = evaluateSharedEvidenceGenericV1({ recordA: driftRecordA })
const driftComparison = compareProductionAndGenericV1({ productionRecord: driftRecordB, genericResult: driftGeneric })
check(driftComparison.payload.parity_binding === 'MATCHED' && driftComparison.payload.proof_pass, 'Record B and Generic Result G remain bound to production generation N after repository generation N+1')
const exceptionInvariant = await executeProductionWithLiveShadowArtifactsV1({
  createEvidenceCapture: async () => { throw new Error('shadow_capture_failed') },
  executeProduction: async () => productionInvariant,
  writeRecordA: async () => { throw new Error('unexpected_write') },
  writeRecordB: async () => { throw new Error('unexpected_write') },
  captureSetupTimeoutMs: 10,
})
check(exceptionInvariant === productionInvariant, 'shadow capture setup exception cannot alter production result identity')
const timeoutInvariant = await executeProductionWithLiveShadowArtifactsV1({
  createEvidenceCapture: () => new Promise(() => {}),
  executeProduction: async () => productionInvariant,
  writeRecordA: async () => {},
  writeRecordB: async () => {},
  captureSetupTimeoutMs: 10,
})
check(timeoutInvariant === productionInvariant, 'shadow capture setup timeout cannot alter production result identity')
const writeFailureInvariant = await executeProductionWithLiveShadowArtifactsV1({
  createEvidenceCapture: async () => ({ host: acquisitionHost, sealRecordA: () => recordA }),
  executeProduction: async () => productionInvariant,
  writeRecordA: async () => { throw new Error('record_a_transport_failed') },
  writeRecordB: async () => { throw new Error('record_b_transport_failed') },
})
check(writeFailureInvariant === productionInvariant, 'A/B transport exceptions cannot alter production result identity')

const liveTemp = mkdtempSync(path.join(tmpdir(), 'gadp-live-shadow-'))
try {
  const transport = path.join(liveTemp, 'gadp-live-shadow-v1')
  const recordAFile = path.join(transport, 'record-a.json')
  const recordBFile = path.join(transport, 'record-b.json')
  const recordCFile = path.join(transport, 'record-c.json')
  await import('node:fs/promises').then(({ mkdir }) => mkdir(transport, { recursive: true }))
  writeFileSync(recordAFile, JSON.stringify(recordA), 'utf8')
  writeFileSync(recordBFile, JSON.stringify(recordB), 'utf8')
  const execution = JSON.parse(execFileSync(process.execPath, [
    fileURLToPath(liveRunnerUrl),
    '--record-a-file', recordAFile,
    '--record-b-file', recordBFile,
    '--record-c-file', recordCFile,
  ], {
    encoding: 'utf8',
    env: { ...process.env, RUNNER_TEMP: liveTemp, GH_TOKEN: 'forbidden', CLOUD_TOKEN: 'forbidden', BROKER_TOKEN: 'forbidden' },
  }))
  const transportedC = validateParityComparisonV1(JSON.parse(readFileSync(recordCFile, 'utf8')))
  check(execution.credential_absent === true && execution.authority === 'NONE', 'actual isolated shadow child receives no repository/cloud/broker credential')
  check(transportedC.payload.semantic === 'MATCH' && transportedC.payload.authority === 'NONE', 'deterministic RUNNER_TEMP transport produces non-authoritative Record C')
} finally {
  rmSync(liveTemp, { recursive: true, force: true })
}
check(!/\bfetch\s*\(|node:https|node:http/.test(liveRunnerSource) && !/\bfetch\s*\(/.test(evaluatorSource), 'shadow and comparator have no network edge')
check(!productionRunnerSource.includes('evaluateSharedEvidenceGenericV1') && !productionRunnerSource.includes('compareProductionAndGenericV1'), 'Record B production projection has no Generic mapper/comparator reuse')
check(!/projectProductionParityRecordBV1|productionResult/.test(evaluatorSource.split('export const evaluateSharedEvidenceGenericV1 =')[1].split('export const compareProductionAndGenericV1 =')[0]), 'Generic Result G path has no production result input or production mapper')

const imports = [...evaluatorSource.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((match) => match[1])
check(
  imports.join('\n') === [
    '../core/contracts-v1.mjs',
    '../core/identity-review-admission-v1.mjs',
    '../core/project-adapter-v1.mjs',
    '../core/role-dispatch-v1.mjs',
    '../host/registered-command-catalog-v1.mjs',
    '../core/shared-sealed-evidence-v1.mjs',
  ].join('\n'),
  'evaluator imports only merged Generic Core and the static command catalog',
)
const prohibitedEdges = [
  /node:fs/, /node:child_process/, /node:http/, /node:https/, /\bfetch\s*\(/,
  /\bprocess\.env\b/, /\bprojectProviderInvocationV1\b/, /\brunProviderSubprocessCredentialBoundaryV1\b/,
  /\bexecuteRepair\b/, /\bexecuteMerge\b/,
  /from\s+['"][^'"]*run-protected-transition-admission-v1/,
]
check(prohibitedEdges.every((pattern) => !pattern.test(evaluatorSource)), 'capability scan finds zero prohibited imports or execution edges')

process.stdout.write(`sd-prompt-studio-read-only-shadow-v1: ${assertions} assertions passed\n`)
