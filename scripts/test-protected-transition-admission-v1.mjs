import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { parse as parseYaml } from 'yaml'
import {
  READY_REVIEW_TERMINAL_OBSERVATION_ARTIFACT_V1,
  buildReadyReviewTerminalObservationArtifactV1,
  canonicalizeReadyReviewObservationJcsV1,
  digestReadyReviewObservationProjectionV1,
  sha256ReadyReviewObservationV1,
} from '../src/continuous-orchestration/ready-review-terminal-observation-artifact-v1.ts'
import {
  PROTECTED_TRANSITION_ADMISSION_INPUT_V1,
  PROTECTED_TRANSITION_COLLECTOR_FILE_V1,
  PROTECTED_TRANSITION_RECEIPT_FILE_V1,
  evaluateProtectedTransitionAdmissionV1,
} from '../src/continuous-orchestration/protected-transition-admission-v1.ts'

const fixture = JSON.parse(await readFile('scripts/fixtures/protected-transition-admission-v1.json', 'utf8'))
const workflowSource = await readFile('.github/workflows/protected-transition-admission-v1.yml', 'utf8')
const runnerSource = await readFile('scripts/run-protected-transition-admission-v1.mjs', 'utf8')
const evaluatorSource = await readFile('src/continuous-orchestration/protected-transition-admission-v1.ts', 'utf8')
const workflow = parseYaml(workflowSource)
const clone = structuredClone
let assertions = 0
const check = (condition, message) => { assertions += 1; assert.ok(condition, message) }
const frozen = (value) => value === null || typeof value !== 'object' || (Object.isFrozen(value) && Object.values(value).every(frozen))
const resealTerminal = async (value) => {
  const projection = Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'record_digest'))
  return { ...projection, record_digest: await digestReadyReviewObservationProjectionV1(projection) }
}

const buildCollector = async (timing) => {
  const producerId = 'chatgpt-codex-connector[bot]'
  const sourceObservedAt = timing.snapshot_observed_at
  const sourceProjection = {
    projection_version: 'submitted-review-source-projection-v1',
    kind: 'submitted_review',
    producer_id: producerId,
    review_id: timing.receipt_id,
    review_url: `${fixture.pr_url}#pullrequestreview-${timing.receipt_id}`,
    submitted_at: timing.receipt_created_at,
    reviewed_head: fixture.exact_head,
    ready_event_id: fixture.ready_generation.event_id,
    review_state: 'COMMENTED',
    finding_ids: [],
    source_observed_at: sourceObservedAt,
  }
  const receipt = {
    observation_version: 'producer-terminal-receipt-observation-v1',
    producer_id: producerId,
    receipt_id: timing.receipt_id,
    receipt_source_url: sourceProjection.review_url,
    receipt_kind: 'submitted_review',
    receipt_created_at: timing.receipt_created_at,
    reviewed_head: fixture.exact_head,
    ready_event_id: fixture.ready_generation.event_id,
    source_projection: sourceProjection,
    source_projection_digest: await digestReadyReviewObservationProjectionV1(sourceProjection),
    source_observed_at: sourceObservedAt,
  }
  const pageProjection = {
    page_ordinal: 0,
    start_cursor: null,
    end_cursor: null,
    has_next_page: false,
    nodes: [{
      thread_id: `PRRT_${timing.receipt_id}`,
      is_resolved: true,
      is_outdated: false,
      path: 'src/example.ts',
      line: 1,
      start_line: 1,
      last_comment_id: `PRRC_${timing.receipt_id}`,
      last_comment_created_at: timing.receipt_created_at,
    }],
    source_url: 'https://api.github.com/graphql#PullRequest.reviewThreads-page-0',
    source_observed_at: timing.snapshot_observed_at,
  }
  const page = { ...pageProjection, page_digest: await digestReadyReviewObservationProjectionV1(pageProjection) }
  const receiptIds = [timing.receipt_id]
  const receiptDigest = await digestReadyReviewObservationProjectionV1(receiptIds)
  const postSnapshotHeadRecheck = {
    observation_version: 'post-snapshot-head-recheck-v1',
    repository: fixture.repository,
    pr_number: fixture.pr_number,
    pr_url: fixture.pr_url,
    ready_generation_record_url: fixture.ready_generation.record_url,
    ready_event_id: fixture.ready_generation.event_id,
    expected_head: fixture.exact_head,
    observed_head: fixture.exact_head,
    snapshot_observed_at: timing.snapshot_observed_at,
    observed_at: timing.post_snapshot_observed_at,
    source_url: fixture.pr_url,
  }
  const snapshotProjection = {
    snapshot_version: 'post-terminal-thread-snapshot-v1',
    query_identity: { connection: 'PullRequest.reviewThreads', query_sha256: 'c'.repeat(64) },
    variables_identity: { repository: fixture.repository, pr_number: fixture.pr_number, exact_head: fixture.exact_head, variables_sha256: 'd'.repeat(64) },
    pages: [page],
    terminal_receipt_ids: receiptIds,
    terminal_receipts_digest: receiptDigest,
    last_terminal_receipt_at: timing.receipt_created_at,
    observed_at: timing.snapshot_observed_at,
    source_observation_urls: [page.source_url],
    post_snapshot_head_recheck: postSnapshotHeadRecheck,
  }
  const threadSnapshot = { ...snapshotProjection, snapshot_digest: await digestReadyReviewObservationProjectionV1(snapshotProjection) }
  const artifact = await buildReadyReviewTerminalObservationArtifactV1({
    artifact_version: READY_REVIEW_TERMINAL_OBSERVATION_ARTIFACT_V1,
    repository: fixture.repository,
    pr_number: fixture.pr_number,
    pr_url: fixture.pr_url,
    exact_head: fixture.exact_head,
    ready_generation_record_url: fixture.ready_generation.record_url,
    ready_event_id: fixture.ready_generation.event_id,
    ready_occurred_at: fixture.ready_generation.occurred_at,
    producer_roster: [producerId],
    producer_roster_source_digest: 'e'.repeat(64),
    producer_receipts: [receipt],
    terminal_receipt_ids: receiptIds,
    terminal_receipts_digest: receiptDigest,
    last_terminal_receipt_at: timing.receipt_created_at,
    thread_snapshot: threadSnapshot,
  })
  assert.ok(artifact)
  const jcs = canonicalizeReadyReviewObservationJcsV1(artifact)
  return { artifact, jcs, sha256: await sha256ReadyReviewObservationV1(jcs) }
}

const terminalCollector = await buildCollector(fixture.terminal_artifact)
const mergeCollector = await buildCollector(fixture.merge_artifact)

const baseInput = (transition, collector) => ({
  input_version: PROTECTED_TRANSITION_ADMISSION_INPUT_V1,
  transition,
  repository: fixture.repository,
  repository_id: fixture.repository_id,
  task_record_url: fixture.task_record_url,
  task_scope_digest: fixture.task_scope_digest,
  pr_number: fixture.pr_number,
  pr_url: fixture.pr_url,
  exact_head: fixture.exact_head,
  ready_generation: clone(fixture.ready_generation),
  actor: {
    login: fixture.actor_login,
    role: transition === 'terminal_review_admission' ? 'Independent PR Reviewer' : 'Product Owner',
    authorized_login: fixture.actor_login,
  },
  collector_artifact_jcs: collector.jcs,
  collector_artifact_jcs_sha256: collector.sha256,
  terminal_review: null,
  workflow_identity: { ...clone(fixture.workflow), actor: fixture.actor_login },
  current_state: {
    repository: fixture.repository,
    pr_number: fixture.pr_number,
    exact_head: fixture.exact_head,
    task_scope_digest: fixture.task_scope_digest,
    ready_generation_record_url: fixture.ready_generation.record_url,
    ready_event_id: fixture.ready_generation.event_id,
    ready_occurred_at: fixture.ready_generation.occurred_at,
    ready_actor_login: fixture.ready_generation.actor_login,
    actor_login: fixture.actor_login,
    actor_role: transition === 'terminal_review_admission' ? 'Independent PR Reviewer' : 'Product Owner',
    default_branch: 'main',
    workflow_sha: fixture.workflow.sha,
    thread_snapshot_digest: collector.artifact.thread_snapshot.snapshot_digest,
    terminal_review_decision: null,
    latest_protected_event_at: fixture.ready_generation.occurred_at,
  },
  persistence: { owner: 'github_actions_artifact_service', available: true },
  evaluated_at: transition === 'terminal_review_admission' ? fixture.terminal_evaluated_at : fixture.merge_evaluated_at,
})

check(fixture.contract_version === 'protected-transition-admission-validation-v1', 'fixture contract version')
const terminalInput = baseInput('terminal_review_admission', terminalCollector)
const terminalAccepted = await evaluateProtectedTransitionAdmissionV1(terminalInput)
check(terminalAccepted.result === 'accepted', 'Terminal Review Admission accepts exact current bindings')
check(terminalAccepted.result === 'accepted' && terminalAccepted.receipt_count === 1 && terminalAccepted.admitted_artifact_count === 1, 'accepted result has exactly one receipt and one admitted Collector artifact')
check(terminalAccepted.result === 'accepted' && terminalAccepted.files_to_persist.map((file) => file.file_name).join(',') === `${PROTECTED_TRANSITION_COLLECTOR_FILE_V1},${PROTECTED_TRANSITION_RECEIPT_FILE_V1}`, 'accepted result persists the two frozen file names')
check(terminalAccepted.result === 'accepted' && Date.parse(terminalAccepted.receipt.expires_at) - Date.parse(terminalAccepted.receipt.evaluated_at) === 30 * 60 * 1000, 'accepted receipt expires exactly 30 minutes after evaluation')
check(terminalAccepted.result === 'accepted' && terminalAccepted.receipt.actor_login === fixture.actor_login && terminalAccepted.receipt.actor_role === 'Independent PR Reviewer', 'Terminal receipt binds actor and assigned role')
check(terminalAccepted.result === 'accepted' && terminalAccepted.receipt.exact_head === fixture.exact_head && terminalAccepted.receipt.ready_generation_record_url === fixture.ready_generation.record_url, 'Terminal receipt binds exact HEAD and Ready Generation')
check(frozen(terminalAccepted), 'accepted result is recursively immutable')

assert.equal(terminalAccepted.result, 'accepted')
const terminalRecord = await resealTerminal({
  record_url: fixture.terminal_review_record_url,
  task_record_url: fixture.task_record_url,
  repository: fixture.repository,
  pr_number: fixture.pr_number,
  pr_url: fixture.pr_url,
  exact_head: fixture.exact_head,
  ready_generation_record_url: fixture.ready_generation.record_url,
  ready_event_id: fixture.ready_generation.event_id,
  decision: 'APPROVE',
  actor_login: fixture.actor_login,
  published_at: fixture.terminal_review_published_at,
  collector_artifact_digest: terminalCollector.artifact.artifact_digest,
  accepted_receipts: [terminalAccepted.receipt],
})
const mergeInput = baseInput('merge_decision_admission', mergeCollector)
mergeInput.terminal_review = terminalRecord
mergeInput.current_state.terminal_review_decision = 'APPROVE'
mergeInput.current_state.latest_protected_event_at = terminalRecord.published_at
const mergeAccepted = await evaluateProtectedTransitionAdmissionV1(mergeInput)
check(mergeAccepted.result === 'accepted', 'Merge Decision Admission accepts distinct post-Terminal Collector evidence')
check(mergeAccepted.result === 'accepted' && mergeAccepted.receipt.terminal_review_accepted_receipt_digest === terminalAccepted.receipt.admission_digest, 'Merge receipt links the Terminal accepted-receipt digest')
check(mergeAccepted.result === 'accepted' && mergeAccepted.receipt.collector_artifact_digest !== terminalAccepted.receipt.collector_artifact_digest, 'Merge receipt binds a distinct Collector artifact')
check(mergeAccepted.result === 'accepted' && mergeAccepted.receipt.actor_role === 'Product Owner', 'Merge receipt binds Product Owner role')

const nonAdmitting = []
const rejectedCase = async (mutate, expectedCode, label, source = terminalInput) => {
  const input = clone(source)
  await mutate(input)
  const result = await evaluateProtectedTransitionAdmissionV1(input)
  nonAdmitting.push(result)
  check(result.result === 'rejected' && result.rejection_codes.includes(expectedCode), label)
  return result
}
const failedCase = async (mutate, expectedCode, label, source = terminalInput) => {
  const input = clone(source)
  await mutate(input)
  const result = await evaluateProtectedTransitionAdmissionV1(input)
  nonAdmitting.push(result)
  check(result.result === 'failed' && result.failure.code === expectedCode, label)
  return result
}

const actorRejected = await rejectedCase((input) => { input.actor.login = 'wrong-actor'; input.workflow_identity.actor = 'wrong-actor' }, 'actor_mismatch', 'wrong actor is rejected')
check(actorRejected.result === 'rejected' && actorRejected.receipt_count === 1 && actorRejected.admitted_artifact_count === 0 && actorRejected.files_to_persist.length === 1, 'rejected result persists exactly one diagnostic receipt and no admitted artifact')
await rejectedCase((input) => { input.actor.role = 'Product Owner'; input.current_state.actor_role = 'Product Owner' }, 'actor_role_mismatch', 'wrong transition actor role is rejected')
await rejectedCase((input) => { input.repository = 'other/repository' }, 'repository_mismatch', 'wrong repository is rejected')
await rejectedCase((input) => { input.pr_number = 261 }, 'pr_mismatch', 'wrong PR is rejected')
await rejectedCase((input) => { input.exact_head = '3'.repeat(40) }, 'head_mismatch', 'wrong exact HEAD is rejected')
await rejectedCase((input) => { input.task_scope_digest = 'f'.repeat(64) }, 'task_scope_mismatch', 'wrong Task scope digest is rejected')
await rejectedCase((input) => { input.ready_generation.event_id = '29000000009' }, 'ready_generation_mismatch', 'wrong Ready Generation is rejected')
await rejectedCase((input) => { input.workflow_identity.invocation_ref = 'refs/heads/feature' }, 'workflow_identity_mismatch', 'non-default ref is rejected')
await rejectedCase((input) => { input.workflow_identity.sha = '4'.repeat(40) }, 'workflow_identity_mismatch', 'wrong workflow SHA is rejected')
await rejectedCase((input) => { input.current_state.thread_snapshot_digest = '5'.repeat(64) }, 'thread_snapshot_mismatch', 'changed thread snapshot is rejected')
await rejectedCase((input) => { input.current_state.latest_protected_event_at = '2026-08-05T10:01:00Z' }, 'protected_event_order_invalid', 'newer protected event invalidates Terminal admission')
await rejectedCase((input) => { input.terminal_review = clone(terminalRecord) }, 'terminal_review_record_forbidden', 'Terminal Review URL is rejected in the wrong transition')
await rejectedCase((input) => { input.evaluated_at = '2026-08-05T10:40:00Z' }, 'collector_artifact_expired', 'Collector evidence older than 30 minutes is rejected')

const mergeReuse = clone(mergeInput)
mergeReuse.collector_artifact_jcs = terminalCollector.jcs
mergeReuse.collector_artifact_jcs_sha256 = terminalCollector.sha256
mergeReuse.current_state.thread_snapshot_digest = terminalCollector.artifact.thread_snapshot.snapshot_digest
const reuseResult = await evaluateProtectedTransitionAdmissionV1(mergeReuse)
nonAdmitting.push(reuseResult)
check(reuseResult.result === 'rejected' && reuseResult.rejection_codes.includes('distinct_post_terminal_artifact_required'), 'Merge rejects reuse of the Terminal Collector artifact')

const nonLaterTiming = { ...fixture.merge_artifact, receipt_id: '4900000003', receipt_created_at: '2026-08-05T10:10:30Z', snapshot_observed_at: '2026-08-05T10:11:00Z', post_snapshot_observed_at: '2026-08-05T10:11:01Z' }
const nonLaterCollector = await buildCollector(nonLaterTiming)
const nonLaterInput = clone(mergeInput)
nonLaterInput.collector_artifact_jcs = nonLaterCollector.jcs
nonLaterInput.collector_artifact_jcs_sha256 = nonLaterCollector.sha256
nonLaterInput.current_state.thread_snapshot_digest = nonLaterCollector.artifact.thread_snapshot.snapshot_digest
const nonLaterResult = await evaluateProtectedTransitionAdmissionV1(nonLaterInput)
nonAdmitting.push(nonLaterResult)
check(nonLaterResult.result === 'rejected' && nonLaterResult.rejection_codes.includes('distinct_post_terminal_artifact_required'), 'Merge rejects distinct but non-later Collector evidence')

const staleTerminalInput = clone(mergeInput)
staleTerminalInput.evaluated_at = '2026-08-05T10:45:00Z'
const staleTerminalResult = await evaluateProtectedTransitionAdmissionV1(staleTerminalInput)
nonAdmitting.push(staleTerminalResult)
check(staleTerminalResult.result === 'rejected' && staleTerminalResult.rejection_codes.includes('terminal_receipt_expired'), 'Merge rejects an expired Terminal accepted receipt')

for (const count of [0, 2]) {
  const cardinalityInput = clone(mergeInput)
  cardinalityInput.terminal_review.accepted_receipts = count === 0 ? [] : [clone(terminalAccepted.receipt), clone(terminalAccepted.receipt)]
  cardinalityInput.terminal_review = await resealTerminal(cardinalityInput.terminal_review)
  const result = await evaluateProtectedTransitionAdmissionV1(cardinalityInput)
  nonAdmitting.push(result)
  check(result.result === 'rejected' && result.rejection_codes.includes('terminal_receipt_cardinality_invalid'), `${count} Terminal admission receipts fail closed`)
}

await failedCase((input) => { input.collector_artifact_jcs_sha256 = '0'.repeat(64) }, 'collector_artifact_digest_invalid', 'Collector JCS digest failure returns failed')
const persistenceFailed = await failedCase((input) => { input.persistence.available = false }, 'persistence_unavailable', 'persistence failure returns failed')
check(persistenceFailed.result === 'failed' && persistenceFailed.receipt_count === 0 && persistenceFailed.admitted_artifact_count === 0 && persistenceFailed.files_to_persist.length === 0, 'failed result has zero receipts and zero admitted artifacts')
await failedCase((input) => { input.extra = true }, 'input_contract_invalid', 'extra input field fails closed')
await failedCase((input) => { delete input.ready_generation.record_url }, 'input_contract_invalid', 'missing input field fails closed')
await failedCase((input) => { input.evaluated_at = 'not-time' }, 'input_contract_invalid', 'malformed input field fails closed')

check(nonAdmitting.every((result) => result.state_changed === false && result.protected_transition_performed === false && result.result !== 'accepted'), 'every non-admitting result performs no state change and no protected transition')
check(nonAdmitting.filter((result) => result.result === 'rejected').every((result) => result.receipt_count === 1 && result.admitted_artifact_count === 0), 'every rejected result has exactly one non-admitting receipt')
check(nonAdmitting.filter((result) => result.result === 'failed').every((result) => result.receipt_count === 0 && result.admitted_artifact_count === 0), 'every failed result has no receipt or admitted artifact')

const inputs = workflow.on.workflow_dispatch.inputs
check(Object.keys(workflow.on).join(',') === 'workflow_dispatch', 'workflow has only workflow_dispatch')
check(Object.keys(inputs).join(',') === 'transition,pr_number,exact_head,task_record_url,ready_generation_record_url,terminal_review_record_url', 'workflow exposes exactly the six frozen caller inputs')
check(inputs.transition.type === 'choice' && inputs.transition.options.join(',') === 'terminal_review_admission,merge_decision_admission', 'transition input has only the two protected admission surfaces')
check(Object.keys(workflow.permissions).sort().join(',') === 'contents,issues,pull-requests' && Object.values(workflow.permissions).every((value) => value === 'read'), 'workflow has minimum read permissions only')
check(Object.keys(workflow.jobs).length === 1 && Object.keys(workflow.jobs)[0] === 'protected_transition_admission_v1', 'workflow has one finite Phase 1 job')
check((workflowSource.match(/actions\/checkout@[0-9a-f]{40}/g) ?? []).length === 1 && (workflowSource.match(/actions\/setup-node@[0-9a-f]{40}/g) ?? []).length === 1 && (workflowSource.match(/actions\/upload-artifact@[0-9a-f]{40}/g) ?? []).length === 1, 'all external Actions are pinned once to full commit SHAs')
check((runnerSource.match(/run-ready-review-terminal-observation-collector-v1\.mjs/g) ?? []).length === 1, 'production composition names the existing Collector CLI exactly once')
check((runnerSource.match(/execFileAsync\(process\.execPath/g) ?? []).length === 1, 'production composition invokes the existing Collector CLI exactly once')
check((evaluatorSource.match(/parseReadyReviewTerminalObservationArtifactV1\(/g) ?? []).length === 1, 'pure evaluator reuses the existing exact-byte parser exactly once')
check((evaluatorSource.match(/export const evaluateProtectedTransitionAdmissionV1\s*=/g) ?? []).length === 1, 'one pure protected-transition evaluator is exported')
check(!/markPullRequestReadyForReview|mergePullRequest|enablePullRequestAutoMerge|\/merge\b|gh\s+pr\s+(ready|merge|review)/.test(`${runnerSource}\n${evaluatorSource}`), 'implementation has no Ready, Review publication, Merge Decision publication, or Merge capability')
check(!/setTimeout|setInterval|daemon|background/.test(`${runnerSource}\n${evaluatorSource}`), 'implementation creates no scheduler, daemon, or background process')
check(runnerSource.includes("process.exitCode = result.result === 'accepted' ? 0 : 2"), 'rejected host execution remains non-zero')

console.log(`Protected Transition Admission V1: ${assertions} assertions passed`)
