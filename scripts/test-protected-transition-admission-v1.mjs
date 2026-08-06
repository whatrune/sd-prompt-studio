import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
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
  CANONICAL_FINALIZATION_BINDING_V1,
  CANONICAL_FINALIZATION_BINDING_V1_FIELD_COUNT,
  PROTECTED_TRANSITION_ADMISSION_INPUT_V1,
  PROTECTED_TRANSITION_COLLECTOR_FILE_V1,
  PROTECTED_TRANSITION_RECEIPT_FILE_V1,
  evaluateProtectedTransitionAdmissionV1,
} from '../src/continuous-orchestration/protected-transition-admission-v1.ts'
import {
  admitArtifactZipExecResultV1,
  canonicalFinalizationBindingIdV1,
  classifyTerminalLeafAuthorBindingV1,
  resolveFinalizationBindingV1,
  validateCanonicalFinalizationBindingV1,
  validateGenerationAwareAssignmentLineageV1,
  validateReadyGenerationCollectorBindingV1,
  verifyTerminalArtifactZipProvenanceV1,
} from './run-protected-transition-admission-v1.mjs'

const fixture = JSON.parse(await readFile('scripts/fixtures/protected-transition-admission-v1.json', 'utf8'))
const workflowSource = await readFile('.github/workflows/protected-transition-admission-v1.yml', 'utf8')
const runnerSource = await readFile('scripts/run-protected-transition-admission-v1.mjs', 'utf8')
const evaluatorSource = await readFile('src/continuous-orchestration/protected-transition-admission-v1.ts', 'utf8')
const workflow = parseYaml(workflowSource)
const clone = structuredClone
let assertions = 0
const check = (condition, message) => { assertions += 1; assert.ok(condition, message) }
const frozen = (value) => value === null || typeof value !== 'object' || (Object.isFrozen(value) && Object.values(value).every(frozen))
const crc32 = (bytes) => {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return (crc ^ 0xffffffff) >>> 0
}
const buildStoredZip = (entries) => {
  const locals = []
  const centrals = []
  let offset = 0
  for (const [name, value] of Object.entries(entries)) {
    const nameBytes = Buffer.from(name, 'utf8')
    const data = Buffer.isBuffer(value) ? value : Buffer.from(value, 'utf8')
    const checksum = crc32(data)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt32LE(checksum, 14)
    local.writeUInt32LE(data.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(nameBytes.length, 26)
    locals.push(local, nameBytes, data)
    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt32LE(checksum, 16)
    central.writeUInt32LE(data.length, 20)
    central.writeUInt32LE(data.length, 24)
    central.writeUInt16LE(nameBytes.length, 28)
    central.writeUInt32LE(offset, 42)
    centrals.push(central, nameBytes)
    offset += local.length + nameBytes.length + data.length
  }
  const centralBytes = Buffer.concat(centrals)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(Object.keys(entries).length, 8)
  end.writeUInt16LE(Object.keys(entries).length, 10)
  end.writeUInt32LE(centralBytes.length, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, centralBytes, end])
}
const readStoredZipEntries = (archive) => {
  const endOffset = archive.length - 22
  assert.equal(archive.readUInt32LE(endOffset), 0x06054b50)
  const entryCount = archive.readUInt16LE(endOffset + 10)
  let cursor = archive.readUInt32LE(endOffset + 16)
  const entries = new Map()
  for (let index = 0; index < entryCount; index += 1) {
    assert.equal(archive.readUInt32LE(cursor), 0x02014b50)
    assert.equal(archive.readUInt16LE(cursor + 10), 0)
    const size = archive.readUInt32LE(cursor + 20)
    const nameLength = archive.readUInt16LE(cursor + 28)
    const extraLength = archive.readUInt16LE(cursor + 30)
    const commentLength = archive.readUInt16LE(cursor + 32)
    const localOffset = archive.readUInt32LE(cursor + 42)
    const name = archive.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8')
    assert.equal(archive.readUInt32LE(localOffset), 0x04034b50)
    const localNameLength = archive.readUInt16LE(localOffset + 26)
    const localExtraLength = archive.readUInt16LE(localOffset + 28)
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength
    const data = archive.subarray(dataOffset, dataOffset + size)
    assert.equal(crc32(data), archive.readUInt32LE(cursor + 16))
    entries.set(name, Buffer.from(data))
    cursor += 46 + nameLength + extraLength + commentLength
  }
  return entries
}
const resealTerminal = async (value) => {
  const projection = Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'record_digest'))
  return { ...projection, record_digest: await digestReadyReviewObservationProjectionV1(projection) }
}

const resealRecord = async (value) => {
  const projection = Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'record_digest'))
  return { ...projection, record_digest: await digestReadyReviewObservationProjectionV1(projection) }
}

const assignmentLineageHarness = async (transition) => {
  const terminal = transition === 'terminal_review_admission'
  const recordType = terminal ? 'terminal_review_actor_assignment_v1' : 'merge_decision_actor_assignment_v1'
  const ownerRole = terminal ? 'Integrated Lead' : 'Product Owner'
  const assignedRole = terminal ? 'Independent PR Reviewer' : 'Product Owner'
  const assignmentId = terminal ? 'PTA-259-TERMINAL-REVIEW-ACTOR' : 'PTA-259-MERGE-DECISION-ACTOR'
  const oldHead = '0'.repeat(40)
  const oldReadyUrl = `https://github.com/whatrune/sd-prompt-studio/issues/259#issuecomment-${terminal ? '6000000101' : '6000000201'}`
  const currentReadyUrl = `https://github.com/whatrune/sd-prompt-studio/issues/259#issuecomment-${terminal ? '6000000102' : '6000000202'}`
  const oldAssignmentUrl = `https://github.com/whatrune/sd-prompt-studio/issues/259#issuecomment-${terminal ? '6000000111' : '6000000211'}`
  const currentAssignmentUrl = `https://github.com/whatrune/sd-prompt-studio/issues/259#issuecomment-${terminal ? '6000000112' : '6000000212'}`
  const oldReadyRecord = await resealRecord({
    record_type: 'ready_review_generation_record_v1', canonical_record: oldReadyUrl, repository: fixture.repository,
    pr_number: fixture.pr_number, pr_url: fixture.pr_url, exact_head: oldHead, ready_event_id: terminal ? '29000001001' : '29000002001',
    ready_occurred_at: '2026-08-05T09:00:00Z', task_issue_url: fixture.task_record_url, revision: 1, prior_record_url: null,
    producer_roster_source_url: 'https://github.com/whatrune/sd-prompt-studio/issues/259#issuecomment-6000000301',
    producer_roster_source_digest: '3'.repeat(64),
  })
  const currentReadyRecord = await resealRecord({
    record_type: 'ready_review_generation_record_v1', canonical_record: currentReadyUrl, repository: fixture.repository,
    pr_number: fixture.pr_number, pr_url: fixture.pr_url, exact_head: fixture.exact_head, ready_event_id: terminal ? '29000001002' : '29000002002',
    ready_occurred_at: '2026-08-05T10:00:00Z', task_issue_url: fixture.task_record_url, revision: 2, prior_record_url: oldReadyUrl,
    producer_roster_source_url: 'https://github.com/whatrune/sd-prompt-studio/issues/259#issuecomment-6000000302',
    producer_roster_source_digest: '4'.repeat(64),
  })
  const makeAssignment = async ({ url, revision, supersedes, head, ready, issuedAt }) => await resealRecord({
    record_type: recordType, canonical_record: url, assignment_id: assignmentId, revision, supersedes_record_url: supersedes,
    status: 'assigned', authority_owner_role: ownerRole, authority_owner_login: 'whatrune', repository: fixture.repository,
    task_record_url: fixture.task_record_url, task_scope_digest: fixture.task_scope_digest, pr_number: fixture.pr_number, pr_url: fixture.pr_url,
    exact_head: head, ready_generation_record_url: ready.canonical_record, ready_generation_record_digest: ready.record_digest,
    ready_event_id: ready.ready_event_id, ready_occurred_at: ready.ready_occurred_at, transition, assigned_login: fixture.actor_login,
    assigned_role: assignedRole, issued_at: issuedAt,
  })
  const oldIssuedAt = '2026-08-05T09:01:00Z'
  const currentIssuedAt = '2026-08-05T10:01:00Z'
  const oldAssignment = await makeAssignment({ url: oldAssignmentUrl, revision: 1, supersedes: null, head: oldHead, ready: oldReadyRecord, issuedAt: oldIssuedAt })
  const currentAssignment = await makeAssignment({ url: currentAssignmentUrl, revision: 2, supersedes: oldAssignmentUrl, head: fixture.exact_head, ready: currentReadyRecord, issuedAt: currentIssuedAt })
  const evidence = (sourceUrl, sourceCreatedAt, record, generationRecord, commitId) => ({
    source: { url: sourceUrl, bodyDigest: createHash('sha256').update(`body:${sourceUrl}`).digest('hex'), authorLogin: 'whatrune', createdAt: sourceCreatedAt, updatedAt: sourceCreatedAt },
    record,
    generationSource: { url: generationRecord.canonical_record, record: generationRecord, createdAt: generationRecord.ready_occurred_at, updatedAt: generationRecord.ready_occurred_at },
    generationEvent: { event_id: String(generationRecord.ready_event_id), occurred_at: generationRecord.ready_occurred_at, commit_id: commitId, actor_login: 'whatrune' },
    assignmentBinding: { target_url: sourceUrl },
    generationBinding: { target_url: generationRecord.canonical_record },
  })
  const records = [
    evidence(oldAssignmentUrl, oldIssuedAt, oldAssignment, oldReadyRecord, oldHead),
    evidence(currentAssignmentUrl, currentIssuedAt, currentAssignment, currentReadyRecord, null),
  ]
  return {
    records,
    request: { transition, prNumber: fixture.pr_number, exactHead: fixture.exact_head, taskRecordUrl: fixture.task_record_url, readyRecordUrl: currentReadyUrl },
    host: { repository: fixture.repository },
    taskScopeDigest: fixture.task_scope_digest,
    readySource: { url: currentReadyUrl, record: currentReadyRecord },
    readyEvent: records[1].generationEvent,
    trustRoot: { issuer_login: 'whatrune', issuer_role: ownerRole },
    spec: { recordType, transition, assignedRole },
  }
}

const resealAssignmentEvidence = async (evidence) => {
  evidence.record = await resealRecord(evidence.record)
  evidence.source.bodyDigest = createHash('sha256').update(`body:${evidence.source.url}`).digest('hex')
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
  actor: { login: fixture.actor_login },
  authority: {
    trust_root: {
      ...clone(fixture.trust_root),
      issuer_anchor_url: (transition === 'terminal_review_admission' ? fixture.terminal_authority : fixture.merge_authority).issuer_anchor_url,
      issuer_anchor_digest: (transition === 'terminal_review_admission' ? fixture.terminal_authority : fixture.merge_authority).issuer_anchor_digest,
      issuer_login: (transition === 'terminal_review_admission' ? fixture.terminal_authority : fixture.merge_authority).issuer_login,
      issuer_role: (transition === 'terminal_review_admission' ? fixture.terminal_authority : fixture.merge_authority).issuer_role,
      anchor_review_url: (transition === 'terminal_review_admission' ? fixture.terminal_authority : fixture.merge_authority).anchor_review_url,
      anchor_review_digest: (transition === 'terminal_review_admission' ? fixture.terminal_authority : fixture.merge_authority).anchor_review_digest,
    },
    assignment: {
      record_url: (transition === 'terminal_review_admission' ? fixture.terminal_authority : fixture.merge_authority).assignment_record_url,
      record_digest: (transition === 'terminal_review_admission' ? fixture.terminal_authority : fixture.merge_authority).assignment_record_digest,
      assignment_id: (transition === 'terminal_review_admission' ? fixture.terminal_authority : fixture.merge_authority).assignment_id,
      revision: (transition === 'terminal_review_admission' ? fixture.terminal_authority : fixture.merge_authority).assignment_revision,
      issuer_login: (transition === 'terminal_review_admission' ? fixture.terminal_authority : fixture.merge_authority).issuer_login,
      issuer_role: (transition === 'terminal_review_admission' ? fixture.terminal_authority : fixture.merge_authority).issuer_role,
      assigned_login: fixture.actor_login,
      assigned_role: (transition === 'terminal_review_admission' ? fixture.terminal_authority : fixture.merge_authority).assigned_role,
      transition,
    },
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
    assignment_record_url: (transition === 'terminal_review_admission' ? fixture.terminal_authority : fixture.merge_authority).assignment_record_url,
    assignment_record_digest: (transition === 'terminal_review_admission' ? fixture.terminal_authority : fixture.merge_authority).assignment_record_digest,
    trust_root_record_url: fixture.trust_root.record_url,
    trust_root_record_digest: fixture.trust_root.record_digest,
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
const syntheticArtifactZip = Buffer.from('UEsDBBQAAAAIAMRyBl1Dv6ajBwAAAAIAAAAxAAAAcmVhZHktcmV2aWV3LXRlcm1pbmFsLW9ic2VydmF0aW9uLWFydGlmYWN0LXYxLmpjcwECAP3/e31QSwMEFAAAAAgAxHIGXUO/pqMHAAAAAgAAAC0AAABwcm90ZWN0ZWQtdHJhbnNpdGlvbi1hZG1pc3Npb24tdjEtcmVjZWlwdC5qY3MBAgD9/3t9UEsBAhQAFAAAAAgAxHIGXUO/pqMHAAAAAgAAADEAAAAAAAAAAAAAAAAAAAAAAHJlYWR5LXJldmlldy10ZXJtaW5hbC1vYnNlcnZhdGlvbi1hcnRpZmFjdC12MS5qY3NQSwECFAAUAAAACADEcgZdQ7+mowcAAAACAAAALQAAAAAAAAAAAAAAAABWAAAAcHJvdGVjdGVkLXRyYW5zaXRpb24tYWRtaXNzaW9uLXYxLXJlY2VpcHQuamNzUEsFBgAAAAACAAIAugAAAKgAAAAAAA==', 'base64')
const acquiredSyntheticArtifactZip = admitArtifactZipExecResultV1({ stdout: syntheticArtifactZip, stderr: Buffer.alloc(0) })
check(Buffer.isBuffer(acquiredSyntheticArtifactZip) && acquiredSyntheticArtifactZip.equals(syntheticArtifactZip) &&
  acquiredSyntheticArtifactZip.subarray(0, 4).toString('hex') === '504b0304', 'actual synthetic artifact ZIP bytes survive the production binary acquisition boundary exactly')
check(createHash('sha256').update(acquiredSyntheticArtifactZip).digest('hex') === createHash('sha256').update(syntheticArtifactZip).digest('hex'), 'artifact ZIP provenance SHA-256 is over the exact acquired binary bytes')
let stringDecodedArtifactRejected = false
try {
  admitArtifactZipExecResultV1({ stdout: syntheticArtifactZip.toString('utf8'), stderr: '' })
} catch (error) {
  stringDecodedArtifactRejected = /binary GitHub API response malformed/.test(String(error?.message))
}
check(stringDecodedArtifactRejected, 'string-decoded artifact output is rejected before provenance hashing')
let stringDecodedArtifactStderrRejected = false
try {
  admitArtifactZipExecResultV1({ stdout: syntheticArtifactZip, stderr: '' })
} catch (error) {
  stringDecodedArtifactStderrRejected = /binary GitHub API response malformed/.test(String(error?.message))
}
check(stringDecodedArtifactStderrRejected, 'string-decoded artifact stderr is rejected even when empty')
check(classifyTerminalLeafAuthorBindingV1({ directApiAuthorLogin: fixture.actor_login, declaredApiAuthorLogin: fixture.actor_login, recordActorLogin: fixture.actor_login, assignedLogin: fixture.actor_login }) === 'accepted', 'Terminal leaf author binding admits one assigned reviewer across all four identities')
check(classifyTerminalLeafAuthorBindingV1({ directApiAuthorLogin: '', declaredApiAuthorLogin: fixture.actor_login, recordActorLogin: fixture.actor_login, assignedLogin: fixture.actor_login }) === 'failed', 'missing direct Terminal API author evidence fails closed')
check(classifyTerminalLeafAuthorBindingV1({ directApiAuthorLogin: 'api-author', declaredApiAuthorLogin: 'declared-author', recordActorLogin: fixture.actor_login, assignedLogin: fixture.actor_login }) === 'failed', 'Terminal API and declared author integrity mismatch fails closed')
check(classifyTerminalLeafAuthorBindingV1({ directApiAuthorLogin: 'other-reviewer', declaredApiAuthorLogin: 'other-reviewer', recordActorLogin: 'other-reviewer', assignedLogin: fixture.actor_login }) === 'rejected', 'trustworthy APPROVE leaf authored by a non-assigned reviewer is rejected')
const terminalInput = baseInput('terminal_review_admission', terminalCollector)
const terminalAccepted = await evaluateProtectedTransitionAdmissionV1(terminalInput)
check(terminalAccepted.result === 'accepted', 'Terminal Review Admission accepts exact current bindings')
const nullableReadyCommitInput = clone(terminalInput)
nullableReadyCommitInput.ready_generation.commit_id = null
const nullableReadyCommitAccepted = await evaluateProtectedTransitionAdmissionV1(nullableReadyCommitInput)
check(nullableReadyCommitAccepted.result === 'accepted' && nullableReadyCommitAccepted.receipt.ready_event_commit_id === null,
  'nullable REST Ready commit identity is preserved while exact HEAD remains independently bound')
check(terminalAccepted.result === 'accepted' && terminalAccepted.receipt_count === 1 && terminalAccepted.admitted_artifact_count === 1, 'accepted result has exactly one receipt and one admitted Collector artifact')
check(terminalAccepted.result === 'accepted' && terminalAccepted.files_to_persist.map((file) => file.file_name).join(',') === `${PROTECTED_TRANSITION_COLLECTOR_FILE_V1},${PROTECTED_TRANSITION_RECEIPT_FILE_V1}`, 'accepted result persists the two frozen file names')
check(terminalAccepted.result === 'accepted' && Date.parse(terminalAccepted.receipt.expires_at) - Date.parse(terminalAccepted.receipt.evaluated_at) === 30 * 60 * 1000, 'accepted receipt expires exactly 30 minutes after evaluation')
check(terminalAccepted.result === 'accepted' && terminalAccepted.receipt.actor_login === fixture.actor_login && terminalAccepted.receipt.actor_role === 'Independent PR Reviewer', 'Terminal receipt binds actor and assigned role')
check(terminalAccepted.result === 'accepted' && terminalAccepted.receipt.exact_head === fixture.exact_head && terminalAccepted.receipt.ready_generation_record_url === fixture.ready_generation.record_url, 'Terminal receipt binds exact HEAD and Ready Generation')
check(terminalAccepted.result === 'accepted' && terminalAccepted.receipt.ready_event_endpoint === fixture.ready_generation.endpoint && terminalAccepted.receipt.ready_event_commit_id === fixture.exact_head && terminalAccepted.receipt.ready_actor_login === fixture.ready_generation.actor_login, 'Terminal receipt binds the exact REST Ready event identity and actor')
check(terminalAccepted.result === 'accepted' && terminalAccepted.receipt.assignment_record_url === fixture.terminal_authority.assignment_record_url && terminalAccepted.receipt.assignment_issuer_role === 'Integrated Lead', 'Terminal receipt binds the independently issued canonical assignment')
check(terminalAccepted.result === 'accepted' && terminalAccepted.receipt.trust_root_record_url === fixture.trust_root.record_url && terminalAccepted.receipt.trust_root_review_url === fixture.trust_root.review_url, 'Terminal receipt binds the independently reviewed trust root')
check(frozen(terminalAccepted), 'accepted result is recursively immutable')

assert.equal(terminalAccepted.result, 'accepted')
const terminalReceiptJcs = canonicalizeReadyReviewObservationJcsV1(terminalAccepted.receipt)
const terminalReceiptJcsSha = await sha256ReadyReviewObservationV1(terminalReceiptJcs)
const terminalArtifactZipEntries = {
  [PROTECTED_TRANSITION_COLLECTOR_FILE_V1]: terminalCollector.jcs,
  [PROTECTED_TRANSITION_RECEIPT_FILE_V1]: terminalReceiptJcs,
}
const verifyBehavioralArtifactZip = async (archive, overrides = {}) => {
  const acquired = admitArtifactZipExecResultV1({ stdout: archive, stderr: Buffer.alloc(0) })
  const entries = readStoredZipEntries(acquired)
  return await verifyTerminalArtifactZipProvenanceV1({
    archive: acquired,
    apiDigest: `sha256:${createHash('sha256').update(acquired).digest('hex')}`,
    embeddedReceipt: terminalAccepted.receipt,
    leafCollectorDigest: terminalCollector.artifact.artifact_digest,
    listMembers: async () => [...entries.keys()],
    readMember: async (name) => entries.get(name),
    ...overrides,
  })
}
const terminalArtifactZip = buildStoredZip(terminalArtifactZipEntries)
const verifiedTerminalArtifactZip = await verifyBehavioralArtifactZip(terminalArtifactZip)
check(verifiedTerminalArtifactZip.receipt.admission_digest === terminalAccepted.receipt.admission_digest &&
  verifiedTerminalArtifactZip.receiptSha === terminalReceiptJcsSha &&
  verifiedTerminalArtifactZip.collectorArtifact.artifact_digest === terminalCollector.artifact.artifact_digest,
'actual artifact ZIP executes binary acquisition, exact membership, receipt JCS/digest/seal, and Collector parse/digest/provenance successfully')
const behavioralZipFailure = async (operation, expected) => {
  try {
    await operation()
    return false
  } catch (error) {
    return expected.test(String(error?.message))
  }
}
check(await behavioralZipFailure(
  async () => await verifyBehavioralArtifactZip(terminalArtifactZip, { apiDigest: `sha256:${'0'.repeat(64)}` }),
  /archive digest mismatch/,
), 'actual artifact ZIP integrity mismatch fails before member admission')
const extraMemberZip = buildStoredZip({ ...terminalArtifactZipEntries, 'unexpected.txt': 'unexpected' })
check(await behavioralZipFailure(
  async () => await verifyBehavioralArtifactZip(extraMemberZip),
  /archive membership invalid/,
), 'actual artifact ZIP with unexpected membership fails closed')
const unsealedReceipt = { ...terminalAccepted.receipt, admission_digest: '0'.repeat(64) }
const unsealedReceiptZip = buildStoredZip({
  ...terminalArtifactZipEntries,
  [PROTECTED_TRANSITION_RECEIPT_FILE_V1]: canonicalizeReadyReviewObservationJcsV1(unsealedReceipt),
})
check(await behavioralZipFailure(
  async () => await verifyBehavioralArtifactZip(unsealedReceiptZip),
  /receipt canonical JCS or admission digest invalid/,
), 'actual artifact ZIP with an invalid receipt seal fails closed')
const wrongCollectorZip = buildStoredZip({
  ...terminalArtifactZipEntries,
  [PROTECTED_TRANSITION_COLLECTOR_FILE_V1]: mergeCollector.jcs,
})
check(await behavioralZipFailure(
  async () => await verifyBehavioralArtifactZip(wrongCollectorZip),
  /Collector artifact integrity invalid/,
), 'actual artifact ZIP with mismatched Collector provenance fails closed')
const terminalRecord = await resealTerminal({
  record_url: fixture.terminal_review_record_url,
  lineage_id: fixture.terminal_review_lineage_id,
  revision: 1,
  task_record_url: fixture.task_record_url,
  repository: fixture.repository,
  pr_number: fixture.pr_number,
  pr_url: fixture.pr_url,
  exact_head: fixture.exact_head,
  ready_generation_record_url: fixture.ready_generation.record_url,
  ready_event_id: fixture.ready_generation.event_id,
  decision: 'APPROVE',
  actor_login: fixture.actor_login,
  assignment_record_url: fixture.terminal_authority.assignment_record_url,
  assignment_record_digest: fixture.terminal_authority.assignment_record_digest,
  published_at: fixture.terminal_review_published_at,
  collector_artifact_digest: terminalCollector.artifact.artifact_digest,
  workflow_artifact_id: fixture.terminal_workflow_artifact.id,
  workflow_artifact_name: `protected-transition-admission-v1-${terminalAccepted.receipt.workflow_run_id}-${terminalAccepted.receipt.workflow_run_attempt}`,
  workflow_artifact_archive_sha256: fixture.terminal_workflow_artifact.archive_sha256,
  receipt_jcs_sha256: terminalReceiptJcsSha,
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
check(mergeAccepted.result === 'accepted' && mergeAccepted.receipt.terminal_review_lineage_id === fixture.terminal_review_lineage_id &&
  mergeAccepted.receipt.terminal_workflow_artifact_id === fixture.terminal_workflow_artifact.id &&
  mergeAccepted.receipt.terminal_receipt_jcs_sha256 === terminalReceiptJcsSha, 'Merge receipt seals the current Terminal leaf and actual artifact-byte provenance')

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
await rejectedCase((input) => { input.authority.assignment.assigned_role = 'Product Owner'; input.current_state.actor_role = 'Product Owner' }, 'actor_role_mismatch', 'wrong canonical assignment role is rejected')
await rejectedCase((input) => { input.authority.assignment.issuer_login = 'self-issued'; input.authority.assignment.assigned_login = 'self-issued' }, 'actor_mismatch', 'self-authenticating assignment does not authorize the caller')
await rejectedCase((input) => { input.authority.assignment.issuer_login = 'self-issued' }, 'assignment_issuer_mismatch', 'assignment issuer must equal the independently admitted trust-root login')
await rejectedCase((input) => { input.authority.assignment.issuer_role = 'Product Owner' }, 'assignment_issuer_mismatch', 'cross-role assignment issuer is rejected')
await rejectedCase((input) => { input.authority.assignment.record_url = 'https://github.com/whatrune/sd-prompt-studio/issues/259#issuecomment-6000000099' }, 'authority_binding_mismatch', 'stale or ambiguous assignment record binding is rejected')
await rejectedCase((input) => { input.authority.trust_root.record_digest = '9'.repeat(64) }, 'authority_binding_mismatch', 'wrong independently reviewed trust-root binding is rejected')
await rejectedCase((input) => { input.repository = 'other/repository' }, 'repository_mismatch', 'wrong repository is rejected')
await rejectedCase((input) => { input.pr_number = 261 }, 'pr_mismatch', 'wrong PR is rejected')
await rejectedCase((input) => { input.exact_head = '3'.repeat(40) }, 'head_mismatch', 'wrong exact HEAD is rejected')
await rejectedCase((input) => { input.task_scope_digest = 'f'.repeat(64) }, 'task_scope_mismatch', 'wrong Task scope digest is rejected')
await rejectedCase((input) => { input.ready_generation.event_id = '29000000009' }, 'ready_generation_mismatch', 'wrong Ready Generation is rejected')
await rejectedCase((input) => { input.ready_generation.actor_login = 'ready-event-actor'; }, 'ready_generation_mismatch', 'Ready REST event actor remains independently bound from record publisher or caller')
await rejectedCase((input) => { input.ready_generation.commit_id = '8'.repeat(40) }, 'ready_generation_mismatch', 'Ready REST event commit must equal exact HEAD')
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

const wrongTerminalArtifactName = clone(mergeInput)
wrongTerminalArtifactName.terminal_review.workflow_artifact_name = 'protected-transition-admission-v1-wrong-attempt'
const wrongTerminalArtifactNameResult = await evaluateProtectedTransitionAdmissionV1(wrongTerminalArtifactName)
nonAdmitting.push(wrongTerminalArtifactNameResult)
check(wrongTerminalArtifactNameResult.result === 'rejected' && wrongTerminalArtifactNameResult.rejection_codes.includes('terminal_receipt_provenance_mismatch'), 'Merge rejects a Terminal workflow artifact name not derived from the verified run and attempt')

const wrongTerminalReceiptBytes = clone(mergeInput)
wrongTerminalReceiptBytes.terminal_review.receipt_jcs_sha256 = '7'.repeat(64)
const wrongTerminalReceiptBytesResult = await evaluateProtectedTransitionAdmissionV1(wrongTerminalReceiptBytes)
nonAdmitting.push(wrongTerminalReceiptBytesResult)
check(wrongTerminalReceiptBytesResult.result === 'rejected' && wrongTerminalReceiptBytesResult.rejection_codes.includes('terminal_receipt_provenance_mismatch'), 'Merge rejects a Terminal receipt byte digest mismatch')

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

const taskBindingSource = {
  url: fixture.task_record_url,
  bodyDigest: fixture.task_scope_digest,
}
const bindingIssuerRole = (targetType) => targetType === 'merge_decision_actor_assignment_v1' ? 'Product Owner' : 'Integrated Lead'
const bindingTargetSource = async (record, { edited = true } = {}) => {
  const body = canonicalizeReadyReviewObservationJcsV1(record)
  return {
    url: record.canonical_record,
    body,
    bodyDigest: await sha256ReadyReviewObservationV1(body),
    record,
    authorLogin: 'whatrune',
    createdAt: '2026-08-05T10:00:00Z',
    updatedAt: edited ? '2026-08-05T10:00:01Z' : '2026-08-05T10:00:00Z',
  }
}
const buildFinalizationBindingHarness = async (targetSource, bindingMode = 'contemporaneous') => {
  const targetType = targetSource.record.record_type
  const projection = {
    record_type: CANONICAL_FINALIZATION_BINDING_V1,
    binding_id: '',
    binding_mode: bindingMode,
    target_canonical_url: targetSource.url,
    target_record_type: targetType,
    target_record_digest: targetSource.record.record_digest,
    target_final_body_sha256: targetSource.bodyDigest,
    target_author_login: targetSource.authorLogin,
    repository: fixture.repository,
    task_record_url: fixture.task_record_url,
    task_scope_digest: fixture.task_scope_digest,
    pr_number: fixture.pr_number,
    pr_url: fixture.pr_url,
    target_revision: targetType === 'ready_review_producer_roster_v1' ? null : targetSource.record.revision,
    target_ready_event_id: String(targetSource.record.ready_event_id),
    issuer_login: 'whatrune',
    issuer_role: bindingIssuerRole(targetType),
    issuer_trust_root_record_url: fixture.canonical_finalization_binding.issuer_trust_root_record_url,
    issuer_trust_root_record_digest: fixture.canonical_finalization_binding.issuer_trust_root_record_digest,
  }
  projection.binding_id = await canonicalFinalizationBindingIdV1(projection)
  const record = {
    ...projection,
    binding_record_digest: await digestReadyReviewObservationProjectionV1(projection),
  }
  const body = canonicalizeReadyReviewObservationJcsV1(record)
  const source = {
    url: 'https://github.com/whatrune/sd-prompt-studio/issues/259#issuecomment-6999999999',
    body,
    bodyDigest: await sha256ReadyReviewObservationV1(body),
    authorLogin: 'whatrune',
    createdAt: '2026-08-06T10:30:00Z',
    updatedAt: '2026-08-06T10:30:00Z',
  }
  return { body, source, targetSource, taskSource: taskBindingSource, repository: fixture.repository, prNumber: fixture.pr_number, record }
}
const resealFinalizationBindingHarness = async (harness) => {
  harness.record.binding_id = await canonicalFinalizationBindingIdV1(harness.record)
  const projection = Object.fromEntries(Object.entries(harness.record).filter(([key]) => key !== 'binding_record_digest'))
  harness.record.binding_record_digest = await digestReadyReviewObservationProjectionV1(projection)
  harness.body = canonicalizeReadyReviewObservationJcsV1(harness.record)
  harness.source.body = harness.body
  harness.source.bodyDigest = await sha256ReadyReviewObservationV1(harness.body)
}
const validateBindingHarness = async (harness) => await validateCanonicalFinalizationBindingV1(harness)
const expectBindingFailure = async (harness, message, rejectionCode = null) => {
  let matched = false
  try {
    await validateBindingHarness(harness)
  } catch (error) {
    matched = rejectionCode === null ? !Array.isArray(error?.codes) : error.codes?.includes(rejectionCode)
  }
  check(matched, message)
}

const bindingLineageHarness = await assignmentLineageHarness('terminal_review_admission')
const generationTarget = await bindingTargetSource(bindingLineageHarness.readySource.record)
const validBinding = await buildFinalizationBindingHarness(generationTarget)
const admittedBinding = await validateBindingHarness(validBinding)
check(Object.keys(admittedBinding).length === CANONICAL_FINALIZATION_BINDING_V1_FIELD_COUNT && admittedBinding.binding_id.startsWith('CFB1-'), 'one-shot canonical Finalization Binding admits with exact 20 fields and deterministic ID')
check(generationTarget.createdAt !== generationTarget.updatedAt, 'self-binding target may have a finalization edit while its one-shot Binding remains immutable')
const validBindingContext = {
  declarations: [{ source: validBinding.source, record: admittedBinding }],
  taskSource: taskBindingSource,
  host: { repository: fixture.repository },
  request: { prNumber: fixture.pr_number },
}
const uniqueBinding = await resolveFinalizationBindingV1(validBindingContext, generationTarget, generationTarget.record.record_type)
check(uniqueBinding.binding_record_digest === admittedBinding.binding_record_digest, 'exactly one target-scoped Binding resolves deterministically')
let missingBindingRejected = false
try {
  await resolveFinalizationBindingV1({ ...validBindingContext, declarations: [] }, generationTarget, generationTarget.record.record_type)
} catch (error) {
  missingBindingRejected = error.codes?.includes('finalization_binding_missing')
}
check(missingBindingRejected, 'zero Finalization Bindings reject before authority use')
let ambiguousBindingRejected = false
try {
  await resolveFinalizationBindingV1({ ...validBindingContext, declarations: [...validBindingContext.declarations, ...validBindingContext.declarations] }, generationTarget, generationTarget.record.record_type)
} catch (error) {
  ambiguousBindingRejected = error.codes?.includes('finalization_binding_ambiguous')
}
check(ambiguousBindingRejected, 'two Finalization Bindings reject without chronological winner selection')

const trailingBinding = clone(validBinding)
trailingBinding.body += '\n'
trailingBinding.source.body = trailingBinding.body
await expectBindingFailure(trailingBinding, 'trailing newline makes Binding non-canonical and fails closed')
const duplicateKeyBinding = clone(validBinding)
duplicateKeyBinding.body = duplicateKeyBinding.body.replace('{', '{"record_type":"canonical_finalization_binding_v1",')
duplicateKeyBinding.source.body = duplicateKeyBinding.body
await expectBindingFailure(duplicateKeyBinding, 'duplicate JSON key makes Binding non-canonical and fails closed')
const proseBinding = clone(validBinding)
proseBinding.body = `Finalization Binding\n${proseBinding.body}`
proseBinding.source.body = proseBinding.body
await expectBindingFailure(proseBinding, 'Markdown or prose around Binding JSON fails closed')
const extraFieldBinding = clone(validBinding)
extraFieldBinding.record.extra = true
await resealFinalizationBindingHarness(extraFieldBinding)
await expectBindingFailure(extraFieldBinding, 'unknown Binding field fails exact-field validation')
const missingFieldBinding = clone(validBinding)
delete missingFieldBinding.record.target_revision
await resealFinalizationBindingHarness(missingFieldBinding)
await expectBindingFailure(missingFieldBinding, 'missing Binding field fails exact-field validation')
const editedBinding = clone(validBinding)
editedBinding.source.updatedAt = '2026-08-06T10:30:01Z'
await expectBindingFailure(editedBinding, 'edited Binding fails one-shot createdAt and updatedAt integrity')
const wrongIssuerBinding = clone(validBinding)
wrongIssuerBinding.record.issuer_login = 'untrusted-user'
wrongIssuerBinding.record.binding_id = await canonicalFinalizationBindingIdV1(wrongIssuerBinding.record)
const wrongIssuerProjection = Object.fromEntries(Object.entries(wrongIssuerBinding.record).filter(([key]) => key !== 'binding_record_digest'))
wrongIssuerBinding.record.binding_record_digest = await digestReadyReviewObservationProjectionV1(wrongIssuerProjection)
wrongIssuerBinding.body = canonicalizeReadyReviewObservationJcsV1(wrongIssuerBinding.record)
wrongIssuerBinding.source.body = wrongIssuerBinding.body
wrongIssuerBinding.source.authorLogin = 'untrusted-user'
await expectBindingFailure(wrongIssuerBinding, 'wrong issuer trust mapping rejects', 'finalization_binding_issuer_mismatch')
const wrongRoleBinding = clone(validBinding)
wrongRoleBinding.record.issuer_role = 'Product Owner'
await resealFinalizationBindingHarness(wrongRoleBinding)
await expectBindingFailure(wrongRoleBinding, 'cross-role Ready Binding rejects', 'finalization_binding_issuer_mismatch')
const wrongRootBinding = clone(validBinding)
wrongRootBinding.record.issuer_trust_root_record_digest = '0'.repeat(64)
await resealFinalizationBindingHarness(wrongRootBinding)
await expectBindingFailure(wrongRootBinding, 'wrong Finalization Binding trust root fails closed')
const wrongTaskDigestBinding = clone(validBinding)
wrongTaskDigestBinding.record.task_scope_digest = '0'.repeat(64)
await resealFinalizationBindingHarness(wrongTaskDigestBinding)
await expectBindingFailure(wrongTaskDigestBinding, 'wrong Task body digest fails closed')
const wrongPrBinding = clone(validBinding)
wrongPrBinding.record.pr_number += 1
wrongPrBinding.record.pr_url = 'https://github.com/whatrune/sd-prompt-studio/pull/261'
await resealFinalizationBindingHarness(wrongPrBinding)
await expectBindingFailure(wrongPrBinding, 'wrong PR scope fails closed')
for (const [field, value, message] of [
  ['target_record_digest', '0'.repeat(64), 'target record digest mismatch rejects'],
  ['target_final_body_sha256', '0'.repeat(64), 'target full-body SHA mismatch rejects'],
  ['target_author_login', 'other-author', 'target author mismatch rejects'],
  ['target_revision', 99, 'target revision mismatch rejects'],
  ['target_ready_event_id', '99999999999', 'target Ready event mismatch rejects'],
]) {
  const mismatch = clone(validBinding)
  mismatch.record[field] = value
  await resealFinalizationBindingHarness(mismatch)
  await expectBindingFailure(mismatch, message, 'finalization_binding_target_integrity_mismatch')
}
const targetEditedBinding = clone(validBinding)
targetEditedBinding.targetSource.record = await resealRecord({ ...targetEditedBinding.targetSource.record, exact_head: '9'.repeat(40) })
targetEditedBinding.targetSource.body = canonicalizeReadyReviewObservationJcsV1(targetEditedBinding.targetSource.record)
targetEditedBinding.targetSource.bodyDigest = await sha256ReadyReviewObservationV1(targetEditedBinding.targetSource.body)
await expectBindingFailure(targetEditedBinding, 'target edit and internal reseal cannot redefine the finalized Binding', 'finalization_binding_target_integrity_mismatch')
const unlistedRetroactiveBinding = await buildFinalizationBindingHarness(generationTarget, 'retroactive')
await expectBindingFailure(unlistedRetroactiveBinding, 'retroactive Binding outside the exact five-target allowlist rejects', 'retroactive_finalization_binding_not_eligible')

check(fixture.canonical_finalization_binding.retroactive_targets.length === 5, 'retroactive Finalization Binding fixture is limited to the exact five frozen targets')
for (const frozenTarget of fixture.canonical_finalization_binding.retroactive_targets) {
  const targetSource = {
    url: frozenTarget.record.canonical_record,
    body: 'frozen canonical target body is represented by its direct-refetch SHA-256',
    bodyDigest: frozenTarget.body_sha256,
    record: frozenTarget.record,
    authorLogin: 'whatrune',
    createdAt: '2026-08-06T00:00:00Z',
    updatedAt: '2026-08-06T00:00:01Z',
  }
  const retroactiveBinding = await buildFinalizationBindingHarness(targetSource, 'retroactive')
  const admitted = await validateBindingHarness(retroactiveBinding)
  check(admitted.binding_mode === 'retroactive' && admitted.target_canonical_url === targetSource.url,
    `exact retroactive target ${targetSource.url} admits only at its frozen body and record digests`)
}

for (const transition of ['terminal_review_admission', 'merge_decision_admission']) {
  const targetHarness = await assignmentLineageHarness(transition)
  const assignmentTarget = await bindingTargetSource(targetHarness.records[1].record)
  const assignmentBinding = await buildFinalizationBindingHarness(assignmentTarget)
  const admitted = await validateBindingHarness(assignmentBinding)
  check(admitted.issuer_role === bindingIssuerRole(assignmentTarget.record.record_type), `${transition} uses the identical Binding algorithm with its frozen issuer role`)
}

for (const transition of ['terminal_review_admission', 'merge_decision_admission']) {
  const harness = await assignmentLineageHarness(transition)
  const current = await validateGenerationAwareAssignmentLineageV1(harness)
  check(current.revision === 2 && current.record_url === harness.records[1].source.url && current.transition === transition,
    `${transition} admits only the revision-2 current leaf while revision 1 remains issuance-era evidence`)
}

const expectLineageRejection = async (mutate, code, message) => {
  const harness = await assignmentLineageHarness('terminal_review_admission')
  await mutate(harness)
  let rejected = false
  try {
    await validateGenerationAwareAssignmentLineageV1(harness)
  } catch (error) {
    rejected = Array.isArray(error?.codes) && error.codes.includes(code)
  }
  check(rejected, message)
}

await expectLineageRejection(async ({ records }) => {
  records[1].record.supersedes_record_url = records[1].source.url
  await resealAssignmentEvidence(records[1])
}, 'assignment_chain_invalid', 'assignment lineage cycle is rejected')
await expectLineageRejection(async ({ records }) => {
  records[1].record.revision = 3
  await resealAssignmentEvidence(records[1])
}, 'assignment_chain_gapped', 'assignment revision gap is rejected')
await expectLineageRejection(async ({ records }) => {
  const fork = clone(records[1])
  fork.source.url = 'https://github.com/whatrune/sd-prompt-studio/issues/259#issuecomment-6000000113'
  fork.source.createdAt = '2026-08-05T10:02:00Z'
  fork.source.updatedAt = fork.source.createdAt
  fork.record.canonical_record = fork.source.url
  fork.record.issued_at = fork.source.createdAt
  await resealAssignmentEvidence(fork)
  records.push(fork)
}, 'assignment_chain_forked', 'branching assignment successors and multiple current leaves are rejected')
await expectLineageRejection(async ({ records }) => {
  records[1].record.assignment_id = 'PTA-259-OTHER-ACTOR'
  await resealAssignmentEvidence(records[1])
}, 'assignment_chain_ambiguous', 'multiple assignment identity series are rejected')
await expectLineageRejection(async ({ records }) => {
  records[1].record.supersedes_record_url = 'https://github.com/whatrune/sd-prompt-studio/issues/259#issuecomment-6000000999'
  await resealAssignmentEvidence(records[1])
}, 'assignment_chain_invalid', 'predecessor URL mismatch is rejected after predecessor digest validation')
const predecessorDigestHarness = await assignmentLineageHarness('terminal_review_admission')
predecessorDigestHarness.records[0].record.record_digest = '0'.repeat(64)
let predecessorDigestFailed = false
try {
  await validateGenerationAwareAssignmentLineageV1(predecessorDigestHarness)
} catch (error) {
  predecessorDigestFailed = /assignment record digest mismatch/.test(String(error?.message))
}
check(predecessorDigestFailed, 'historical predecessor self-digest mismatch fails integrity validation')
const editedGenerationHarness = await assignmentLineageHarness('terminal_review_admission')
editedGenerationHarness.records[0].generationSource.updatedAt = '2026-08-05T09:00:01Z'
const editedGenerationAccepted = await validateGenerationAwareAssignmentLineageV1(editedGenerationHarness)
check(editedGenerationAccepted.revision === 2, 'self-binding target timestamp equality is not used as immutability authority after Finalization Binding admission')
await expectLineageRejection(async ({ records }) => {
  records[0].record.ready_generation_record_digest = '0'.repeat(64)
  await resealAssignmentEvidence(records[0])
}, 'assignment_issuance_generation_mismatch', 'historical predecessor Ready Generation digest mismatch is rejected')
await expectLineageRejection(async ({ records }) => {
  records[0].record.exact_head = records[1].record.exact_head
  await resealAssignmentEvidence(records[0])
}, 'assignment_issuance_generation_mismatch', 'historical predecessor cannot substitute current-generation HEAD for its issuance-era binding')
await expectLineageRejection(async ({ records }) => {
  records[0].generationEvent.event_id = '29000009999'
}, 'assignment_issuance_generation_mismatch', 'historical predecessor Ready event mismatch is rejected')
await expectLineageRejection(async ({ records }) => {
  records[1].record.assigned_role = 'Product Owner'
  await resealAssignmentEvidence(records[1])
}, 'assignment_scope_mismatch', 'stable role and transition scope mismatch is rejected')
await expectLineageRejection(async ({ records }) => {
  records[1].source.authorLogin = 'self-reviewer'
  records[1].record.authority_owner_login = 'self-reviewer'
  records[1].record.assigned_login = 'self-reviewer'
  await resealAssignmentEvidence(records[1])
}, 'assignment_issuer_not_admitted', 'self-authenticated assignment issuer is rejected by the independent trust root')

for (const extraField of ['base_sha', 'producer_roster_record_digest']) {
  const harness = await assignmentLineageHarness('terminal_review_admission')
  harness.records[1].record[extraField] = '5'.repeat(64)
  let failed = false
  try {
    await validateGenerationAwareAssignmentLineageV1(harness)
  } catch (error) {
    failed = /assignment record contract malformed/.test(String(error?.message))
  }
  check(failed, `${extraField} remains forbidden by the exact 23-field assignment schema`)
}

const rosterBindingHarness = await assignmentLineageHarness('terminal_review_admission')
const readyGeneration = rosterBindingHarness.readySource.record
const collectorBinding = {
  ready_generation_record_url: readyGeneration.canonical_record,
  repository: readyGeneration.repository,
  pr_number: readyGeneration.pr_number,
  pr_url: readyGeneration.pr_url,
  exact_head: readyGeneration.exact_head,
  ready_event_id: readyGeneration.ready_event_id,
  ready_occurred_at: readyGeneration.ready_occurred_at,
  producer_roster_source_digest: readyGeneration.producer_roster_source_digest,
}
check(validateReadyGenerationCollectorBindingV1({ readyGeneration, collectorArtifact: collectorBinding }),
  'Producer Roster remains a separate Ready Generation to Collector binding')
let rosterMismatchRejected = false
try {
  validateReadyGenerationCollectorBindingV1({ readyGeneration, collectorArtifact: { ...collectorBinding, producer_roster_source_digest: 'f'.repeat(64) } })
} catch (error) {
  rosterMismatchRejected = Array.isArray(error?.codes) && error.codes.includes('ready_generation_collector_binding_mismatch')
}
check(rosterMismatchRejected, 'Ready Generation and Collector Producer Roster digest mismatch is rejected outside assignment schema')

const inputs = workflow.on.workflow_dispatch.inputs
check(Object.keys(workflow.on).join(',') === 'workflow_dispatch', 'workflow has only workflow_dispatch')
check(Object.keys(inputs).join(',') === 'transition,pr_number,exact_head,task_record_url,ready_generation_record_url,terminal_review_record_url', 'workflow exposes exactly the six frozen caller inputs')
check(inputs.transition.type === 'choice' && inputs.transition.options.join(',') === 'terminal_review_admission,merge_decision_admission', 'transition input has only the two protected admission surfaces')
check(Object.keys(workflow.permissions).sort().join(',') === 'actions,contents,issues,pull-requests' && Object.values(workflow.permissions).every((value) => value === 'read'), 'workflow has minimum read permissions including only the approved Actions read delta')
check(Object.keys(workflow.jobs).length === 1 && Object.keys(workflow.jobs)[0] === 'protected_transition_admission_v1', 'workflow has one finite Phase 1 job')
check((workflowSource.match(/actions\/checkout@[0-9a-f]{40}/g) ?? []).length === 1 && (workflowSource.match(/actions\/setup-node@[0-9a-f]{40}/g) ?? []).length === 1 && (workflowSource.match(/actions\/upload-artifact@[0-9a-f]{40}/g) ?? []).length === 1, 'all external Actions are pinned once to full commit SHAs')
check((runnerSource.match(/run-ready-review-terminal-observation-collector-v1\.mjs/g) ?? []).length === 1, 'production composition names the existing Collector CLI exactly once')
check((runnerSource.match(/execFileAsync\(process\.execPath/g) ?? []).length === 1, 'production composition invokes the existing Collector CLI exactly once')
check(runnerSource.includes("event?.event === 'ready_for_review'") && runnerSource.includes('event.commit_id !== null && event.commit_id !== readySource.record.exact_head') && runnerSource.includes('event?.actor?.login'), 'production binds Ready authority to the exact paginated REST ready_for_review event actor while preserving nullable REST commit identity')
check(runnerSource.includes('issues/${prNumber}/timeline') && runnerSource.includes('response.length < 100'), 'production fully paginates each issuance-era Ready REST timeline before authority selection')
check(runnerSource.includes("matches.length !== 1") && runnerSource.includes("ready_event_cardinality_invalid"), 'zero or multiple exact Ready events reject before Collector execution')
check(runnerSource.includes('actor_login: readyEvent.actor_login') && !runnerSource.includes('actor_login: readySource.authorLogin'), 'Ready Generation publisher is never substituted for the REST Ready actor')
check(runnerSource.includes('issues/${taskIdentity[3]}/comments') && runnerSource.includes('acquireCanonicalRecord(candidate.listed.html_url'), 'production paginates Task assignments and directly re-fetches the selected canonical record')
check(runnerSource.includes('source.authorLogin !== trustRoot.issuer_login') && runnerSource.includes('record.authority_owner_login !== trustRoot.issuer_login'), 'assignment issuer is authenticated by the independent trust root instead of self-assertion')
check(runnerSource.includes("declared.length === 0") && runnerSource.includes("assignment_missing"), 'missing canonical assignment rejects before Collector execution')
check(!runnerSource.includes("assignment_edited") && runnerSource.includes('assignmentBinding'), 'self-binding assignment timestamp equality is replaced by Finalization Binding integrity')
check(runnerSource.includes("record.assignment_id !== first.assignment_id") && runnerSource.includes("assignment_chain_ambiguous"), 'multiple assignment chains fail closed')
check(runnerSource.includes("byRevision.has(item.record.revision)") && runnerSource.includes("assignment_chain_forked"), 'assignment revision forks fail closed')
check(runnerSource.includes("byRevision.size !== maximum") && runnerSource.includes("assignment_chain_gapped"), 'assignment revision gaps fail closed')
check(runnerSource.includes("item.record.supersedes_record_url !== predecessor") && runnerSource.includes("assignment_chain_invalid"), 'assignment supersession mismatches fail closed')
check(runnerSource.includes("tip.record.status !== 'assigned'") && runnerSource.includes("assignment_revoked"), 'revoked current assignment fails closed')
check(runnerSource.includes('generationSource.record.exact_head !== record.exact_head') && runnerSource.includes('tip.record.exact_head !== request.exactHead'), 'historical assignments bind issuance-era generation while only current leaf binds current HEAD')
check(runnerSource.includes("pr?.base?.ref !== host.defaultBranch") && runnerSource.includes("pr?.base?.sha !== host.workflowSha"), 'base SHA remains an independent live PR/default-branch observation outside assignment schema')
check(runnerSource.includes('validateReadyGenerationCollectorBindingV1') && runnerSource.includes('producer_roster_source_digest !== readyGeneration.producer_roster_source_digest'), 'Producer Roster remains separately bound through Ready Generation and the one existing Collector')
check(runnerSource.includes('FINALIZATION_BINDING_KEYS') && runnerSource.includes('exact 20-field canonical JCS'), 'Finalization Binding parser enforces the exact 20-field canonical-JCS body')
check(runnerSource.includes('canonicalFinalizationBindingIdV1') && runnerSource.includes("filter(([key]) => key !== 'binding_record_digest')"), 'Binding ID selector and non-circular Binding record digest are deterministic')
check(runnerSource.includes('FINALIZATION_BINDING_TRUST_ROOT') && runnerSource.includes("review.record?.decision !== 'APPROVE'"), 'implementation pins the reviewed Finalization Binding issuer trust root')
check(runnerSource.includes('listed?.body !== direct.body') && runnerSource.includes('listed?.updated_at !== direct.updatedAt'), 'every declared Binding is directly re-fetched and compared to its paginated observation')
check(runnerSource.includes('source?.createdAt !== source?.updatedAt') && runnerSource.includes('Finalization Binding one-shot source integrity failed'), 'createdAt equality remains mandatory only for the non-self-binding Binding record')
check(runnerSource.includes("finalization_binding_missing") && runnerSource.includes("finalization_binding_ambiguous"), 'zero and multiple target Binding cardinalities fail closed')
check((runnerSource.match(/refreshFinalizationSnapshot\(\{/g) ?? []).length === 2 && runnerSource.indexOf('refreshFinalizationSnapshot({') < runnerSource.indexOf('const collector = await execFileAsync(process.execPath'), 'complete target and Binding snapshots run before and after the single Collector')
check(runnerSource.includes("finalization_binding_snapshot_drift") && runnerSource.includes("finalization_binding_head_drift"), 'target, Binding, duplicate-insertion, and exact-HEAD drift are non-admitting')
check(runnerSource.includes('acquireFinalizedGeneration(generationSource') && runnerSource.includes('assignmentBinding'), 'every historical assignment predecessor resolves its own Binding and issuance-era Generation/roster Bindings')
check(runnerSource.includes('RETROACTIVE_FINALIZATION_BINDING_TARGETS') && fixture.canonical_finalization_binding.retroactive_target_urls.every((url) => runnerSource.includes(url)), 'retroactive admission is pinned to exactly the five reviewed canonical target URLs')
check(runnerSource.includes('host.triggeringActor !== assignment.assigned_login') && runnerSource.includes("workflow_actor_assignment_mismatch"), 'physical current-attempt workflow caller must equal the independently assigned login')
check(runnerSource.includes('GITHUB_ACTOR') && runnerSource.includes('GITHUB_TRIGGERING_ACTOR') && runnerSource.includes('host.triggeringActor !== host.originalActor'), 'same-actor reruns are admitted and cross-actor reruns reject from trusted run context')
check(runnerSource.includes('paginatedArtifacts') && runnerSource.includes('/actions/artifacts/${artifact.id}/zip') && runnerSource.includes("unzip', ['-Z1'") && runnerSource.includes('TERMINAL_ACCEPTED_FILES'), 'Terminal authority is reacquired from a fully paginated exact two-file Actions artifact')
check(runnerSource.includes("encoding: 'buffer'") && runnerSource.includes('admitArtifactZipExecResultV1'), 'artifact ZIP acquisition explicitly requests Buffer stdout and stderr')
check(runnerSource.includes('canonicalizeReadyReviewObservationJcsV1(receipt) !== receiptText') && runnerSource.includes('validateProtectedTransitionAdmissionReceiptV1(receipt)'), 'actual Terminal receipt bytes require canonical JCS and a valid admission seal')
check(runnerSource.includes('terminal_lineage_candidate_not_current_leaf') && runnerSource.includes('predecessor_record_digest !== predecessor.source.bodyDigest'), 'Terminal caller locator must be the unique explicitly linked current leaf')
check(runnerSource.includes('directApiAuthorLogin: source.authorLogin') && runnerSource.includes("terminal_leaf_author_assignment_mismatch"), 'current Terminal leaf binds direct API author, declared author, record actor, and canonical assignment login')
check(runnerSource.indexOf('const assignment = await acquireAssignment') < runnerSource.indexOf('const collector = await execFileAsync(process.execPath'), 'authority admission completes before the single Collector invocation')
check(runnerSource.includes("collector_artifact: 'not_acquired'") && runnerSource.includes("diagnostic_version: 'protected-transition-identity-rejection-v1'"), 'pre-Collector semantic rejection persists one explicit non-admitting diagnostic')
check(!runnerSource.includes('taskSource.authorLogin !== host.actor'), 'Task record author is not treated as transition actor authority')
check(!runnerSource.includes("const actorRole = request.transition ==="), 'transition does not synthesize an actor role')
check((evaluatorSource.match(/parseReadyReviewTerminalObservationArtifactV1\(/g) ?? []).length === 1, 'pure evaluator reuses the existing exact-byte parser exactly once')
check((evaluatorSource.match(/export const evaluateProtectedTransitionAdmissionV1\s*=/g) ?? []).length === 1, 'one pure protected-transition evaluator is exported')
check(!/markPullRequestReadyForReview|mergePullRequest|enablePullRequestAutoMerge|\/merge\b|gh\s+pr\s+(ready|merge|review)/.test(`${runnerSource}\n${evaluatorSource}`), 'implementation has no Ready, Review publication, Merge Decision publication, or Merge capability')
check(!/setTimeout|setInterval|daemon|background/.test(`${runnerSource}\n${evaluatorSource}`), 'implementation creates no scheduler, daemon, or background process')
check(runnerSource.includes("process.exitCode = result.result === 'accepted' ? 0 : 2"), 'rejected host execution remains non-zero')

console.log(`Protected Transition Admission V1: ${assertions} assertions passed`)
