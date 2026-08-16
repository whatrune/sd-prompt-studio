import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import { digestCanonicalV1 } from '../src/core/role-dispatch-v1.mjs'
import {
  evaluateSdpsReadOnlyShadowV1,
  sdpsShadowBoundaryNamesV1,
  sdpsShadowProductionOwnerV1,
} from '../src/shadow/sd-prompt-studio-read-only-shadow-v1.mjs'

const adapterUrl = new URL('../adapters/sd-prompt-studio-read-only-shadow-v1.json', import.meta.url)
const fixtureUrl = new URL('../fixtures/sd-prompt-studio-shadow-parity-v1.json', import.meta.url)
const evaluatorUrl = new URL('../src/shadow/sd-prompt-studio-read-only-shadow-v1.mjs', import.meta.url)
const adapter = JSON.parse(await readFile(adapterUrl, 'utf8'))
const fixtures = JSON.parse(await readFile(fixtureUrl, 'utf8'))
const evaluatorSource = await readFile(evaluatorUrl, 'utf8')
let assertions = 0
const check = (condition, message) => { assertions += 1; assert.ok(condition, message) }
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

const imports = [...evaluatorSource.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((match) => match[1])
check(
  imports.join('\n') === [
    '../core/contracts-v1.mjs',
    '../core/identity-review-admission-v1.mjs',
    '../core/project-adapter-v1.mjs',
    '../core/role-dispatch-v1.mjs',
    '../host/registered-command-catalog-v1.mjs',
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
