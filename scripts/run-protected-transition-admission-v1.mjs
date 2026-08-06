import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import { parse as parseYaml } from 'yaml'
import {
  canonicalizeReadyReviewObservationJcsV1,
  parseReadyReviewTerminalObservationArtifactV1,
  sha256ReadyReviewObservationV1,
  validateReadyReviewGenerationRecordV1,
} from '../src/continuous-orchestration/ready-review-terminal-observation-artifact-v1.ts'
import {
  PROTECTED_TRANSITION_ADMISSION_INPUT_V1,
  PROTECTED_TRANSITION_RECEIPT_FILE_V1,
  evaluateProtectedTransitionAdmissionV1,
  validateProtectedTransitionAdmissionReceiptV1,
} from '../src/continuous-orchestration/protected-transition-admission-v1.ts'

const execFileAsync = promisify(execFile)
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/
const FULL_HEAD = /^[0-9a-f]{40}$/
const ISSUE_URL = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)$/
const COMMENT_URL = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)#issuecomment-(\d+)$/
const WORKFLOW_PATH = '.github/workflows/protected-transition-admission-v1.yml'
const COLLECTOR_PATH = 'scripts/run-ready-review-terminal-observation-collector-v1.mjs'
const TRUST_ROOT_ID = 'PTA-V1-PHASE-1-ASSIGNMENT-ISSUER-TRUST-ROOT'
const TRUST_ROOT = Object.freeze({
  recordUrl: 'https://github.com/whatrune/sd-prompt-studio/issues/251#issuecomment-5198987697',
  recordDigest: '9b8f59daae1c4b305791e8932444a53e72ede3e14565c3e776ae70569f32c260',
  recordAuthor: 'whatrune',
  recordCreatedAt: '2026-08-06T00:28:28Z',
  recordUpdatedAt: '2026-08-06T00:28:28Z',
  reviewUrl: 'https://github.com/whatrune/sd-prompt-studio/issues/251#issuecomment-5199026857',
  reviewDigest: 'c17cf283ef02479ccce177c45311f01bd4b82b69aa464c658ab63d50f17267d1',
  reviewAuthor: 'whatrune',
  reviewCreatedAt: '2026-08-06T00:34:02Z',
  reviewUpdatedAt: '2026-08-06T00:34:02Z',
  revision: 1,
  parentIssueUrl: 'https://github.com/whatrune/sd-prompt-studio/issues/251',
})
const AUTHORITY_ANCHORS = Object.freeze({
  terminal_review_actor_assignment_v1: Object.freeze({
    ownerRole: 'Integrated Lead',
    ownerLogin: 'whatrune',
    url: 'https://github.com/whatrune/sd-prompt-studio/issues/251#issuecomment-5198928778',
    bodyDigest: '955b897e2af8b569e3d0e496df5bed76efa7fbf97db94ed3386a1ac89102ca42',
    createdAt: '2026-08-06T00:19:15Z',
    updatedAt: '2026-08-06T00:19:15Z',
    assignedRole: 'Independent PR Reviewer',
    transition: 'terminal_review_admission',
  }),
  merge_decision_actor_assignment_v1: Object.freeze({
    ownerRole: 'Product Owner',
    ownerLogin: 'whatrune',
    url: 'https://github.com/whatrune/sd-prompt-studio/issues/251#issuecomment-5186163757',
    bodyDigest: '385ca7a9701a3e5dc1db8e2f26a89d0d8d29fc3e9ea7609e604d873e0e633bd3',
    createdAt: '2026-08-05T00:36:01Z',
    updatedAt: '2026-08-05T00:36:02Z',
    reviewUrl: 'https://github.com/whatrune/sd-prompt-studio/issues/251#issuecomment-5186264557',
    reviewDigest: 'c347f9f8d43c83f3af55d9c139028b7c4b88560d93401d742a55a3cd19d6b293',
    reviewAuthor: 'whatrune',
    reviewCreatedAt: '2026-08-05T00:52:23Z',
    reviewUpdatedAt: '2026-08-05T00:52:55Z',
    assignedRole: 'Product Owner',
    transition: 'merge_decision_admission',
  }),
})
const ASSIGNMENT_KEYS = [
  'record_type', 'canonical_record', 'record_digest', 'assignment_id', 'revision', 'supersedes_record_url', 'status',
  'authority_owner_role', 'authority_owner_login', 'repository', 'task_record_url', 'task_scope_digest', 'pr_number', 'pr_url',
  'exact_head', 'ready_generation_record_url', 'ready_generation_record_digest', 'ready_event_id', 'ready_occurred_at', 'transition',
  'assigned_login', 'assigned_role', 'issued_at',
]
const TERMINAL_LINEAGE_RECORD_TYPE = 'terminal_review_admission_lineage_v1'
const TERMINAL_LINEAGE_KEYS = [
  'record_type', 'canonical_record', 'record_digest', 'lineage_id', 'revision', 'predecessor_record_url', 'predecessor_record_digest',
  'effect', 'api_author_login', 'task_record_url', 'repository', 'pr_number', 'pr_url', 'exact_head', 'ready_generation_record_url',
  'ready_generation_record_digest', 'ready_event_id', 'ready_occurred_at', 'transition', 'assignment_record_url', 'assignment_record_digest',
  'actor_login', 'actor_role', 'published_at', 'collector_artifact_digest', 'accepted_receipts',
]
const TERMINAL_ACCEPTED_FILES = [
  'protected-transition-admission-v1-receipt.jcs',
  'ready-review-terminal-observation-artifact-v1.jcs',
]

class IdentityRejection extends Error {
  constructor (codes, observation = {}) {
    super('canonical identity rejected')
    this.codes = [...new Set(codes)].sort()
    this.observation = observation
  }
}

const fail = (code, message) => {
  process.stderr.write(`${canonicalizeReadyReviewObservationJcsV1({ result: 'failed', code, state_changed: false, protected_transition_performed: false, safe_message: message })}\n`)
  process.exitCode = 1
}

const exactArgs = (argv) => {
  const allowed = new Set(['--transition', '--pr-number', '--exact-head', '--task-record-url', '--ready-generation-record-url', '--terminal-review-record-url'])
  if (argv.length !== 12) return null
  const admitted = new Map()
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index]
    const value = argv[index + 1]
    if (!allowed.has(key) || admitted.has(key) || typeof value !== 'string') return null
    admitted.set(key, value)
  }
  const transition = admitted.get('--transition')
  const prNumber = Number(admitted.get('--pr-number'))
  const exactHead = admitted.get('--exact-head')
  const taskRecordUrl = admitted.get('--task-record-url')
  const readyRecordUrl = admitted.get('--ready-generation-record-url')
  const terminalReviewRecordUrl = admitted.get('--terminal-review-record-url')
  if (!['terminal_review_admission', 'merge_decision_admission'].includes(transition) || !Number.isSafeInteger(prNumber) || prNumber <= 0 ||
      !FULL_HEAD.test(exactHead) || !(ISSUE_URL.test(taskRecordUrl) || COMMENT_URL.test(taskRecordUrl)) || !COMMENT_URL.test(readyRecordUrl) ||
      (transition === 'terminal_review_admission' ? terminalReviewRecordUrl !== '' : !COMMENT_URL.test(terminalReviewRecordUrl))) return null
  return Object.freeze({ transition, prNumber, exactHead, taskRecordUrl, readyRecordUrl, terminalReviewRecordUrl })
}

const parseRecordBody = (body) => {
  if (typeof body !== 'string') return null
  const fenced = /```(?:yaml|yml|json)\r?\n([\s\S]*?)\r?\n```/i.exec(body)
  const source = fenced ? fenced[1] : body.trim()
  try {
    const parsed = parseYaml(source)
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

const exactObjectKeys = (value, keys) => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length === keys.length && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key))

const bodyDigest = async (body) => await sha256ReadyReviewObservationV1(body)

const ghJson = async (args) => {
  const { stdout } = await execFileAsync('gh', ['api', ...args], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, windowsHide: true })
  return JSON.parse(stdout)
}

const sourceIdentity = (url, repository) => {
  const comment = COMMENT_URL.exec(url)
  const issue = ISSUE_URL.exec(url)
  const match = comment ?? issue
  if (match === null || `${match[1]}/${match[2]}` !== repository) return null
  return comment === null
    ? { endpoint: `repos/${repository}/issues/${match[3]}` }
    : { endpoint: `repos/${repository}/issues/comments/${match[4]}` }
}

const acquireCanonicalRecord = async (url, repository, { requireOwner = true } = {}) => {
  const identity = sourceIdentity(url, repository)
  if (identity === null) throw new Error('canonical source repository mismatch')
  const response = await ghJson([identity.endpoint])
  if (response?.html_url !== url || (requireOwner && response?.author_association !== 'OWNER') ||
      typeof response?.user?.login !== 'string' || typeof response?.body !== 'string') {
    throw new Error('canonical source authority mismatch')
  }
  return Object.freeze({
    url,
    authorLogin: response.user.login,
    authorAssociation: response.author_association,
    createdAt: response.created_at,
    updatedAt: response.updated_at,
    body: response.body,
    bodyDigest: await bodyDigest(response.body),
    record: parseRecordBody(response.body),
  })
}

const paginated = async (endpoint) => {
  const rows = []
  for (let page = 1; page <= 1000; page += 1) {
    const separator = endpoint.includes('?') ? '&' : '?'
    const response = await ghJson([`${endpoint}${separator}per_page=100&page=${page}`])
    if (!Array.isArray(response)) throw new Error('paginated endpoint returned a non-array')
    rows.push(...response)
    if (response.length < 100) return rows
  }
  throw new Error('pagination did not terminate')
}

const paginatedArtifacts = async (repository, runId) => {
  const artifacts = []
  let totalCount = null
  for (let page = 1; page <= 1000; page += 1) {
    const response = await ghJson([`repos/${repository}/actions/runs/${runId}/artifacts?per_page=100&page=${page}`])
    if (!Number.isSafeInteger(response?.total_count) || !Array.isArray(response?.artifacts)) {
      throw new Error('artifact pagination response malformed')
    }
    if (totalCount === null) totalCount = response.total_count
    if (response.total_count !== totalCount) throw new Error('artifact pagination changed during acquisition')
    artifacts.push(...response.artifacts)
    if (response.artifacts.length < 100) {
      if (artifacts.length !== totalCount) throw new Error('artifact pagination incomplete')
      return artifacts
    }
  }
  throw new Error('artifact pagination did not terminate')
}

export const admitArtifactZipExecResultV1 = ({ stdout, stderr }) => {
  if (!Buffer.isBuffer(stdout) || !Buffer.isBuffer(stderr) || stderr.length !== 0) throw new Error('binary GitHub API response malformed')
  return stdout
}

const ghBuffer = async (args) => admitArtifactZipExecResultV1(await execFileAsync('gh', ['api', ...args], {
  encoding: 'buffer',
  maxBuffer: 256 * 1024 * 1024,
  windowsHide: true,
}))

const sha256Buffer = (value) => createHash('sha256').update(value).digest('hex')

const recordTypeClaim = (body, recordType) => typeof body === 'string' &&
  new RegExp(`(?:^|\\n)\\s*record_type\\s*:\\s*["']?${recordType}["']?\\s*(?:\\r?\\n|$)`).test(body)

const expectedAssignment = (transition) => transition === 'terminal_review_admission'
  ? Object.freeze({ recordType: 'terminal_review_actor_assignment_v1', ...AUTHORITY_ANCHORS.terminal_review_actor_assignment_v1 })
  : Object.freeze({ recordType: 'merge_decision_actor_assignment_v1', ...AUTHORITY_ANCHORS.merge_decision_actor_assignment_v1 })

const validatePinnedSource = (source, pin) => source.url === pin.url && source.authorLogin === pin.ownerLogin &&
  source.createdAt === pin.createdAt && source.updatedAt === pin.updatedAt && source.bodyDigest === pin.bodyDigest

const acquireTrustRoot = async (taskSource, repository, assignmentSpec) => {
  if (taskSource.record?.parent_issue !== TRUST_ROOT.parentIssueUrl) throw new IdentityRejection(['task_parent_authority_mismatch'])
  const root = await acquireCanonicalRecord(TRUST_ROOT.recordUrl, repository)
  const review = await acquireCanonicalRecord(TRUST_ROOT.reviewUrl, repository)
  if (root.bodyDigest !== TRUST_ROOT.recordDigest || root.authorLogin !== TRUST_ROOT.recordAuthor || root.createdAt !== TRUST_ROOT.recordCreatedAt ||
      root.updatedAt !== TRUST_ROOT.recordUpdatedAt || root.record?.record_type !== 'phase_1_assignment_issuer_trust_root_architecture_amendment' ||
      root.record?.trust_root_id !== TRUST_ROOT_ID || root.record?.trust_root_revision !== TRUST_ROOT.revision || root.record?.decision !== 'AMENDMENT_COMPLETE' ||
      review.bodyDigest !== TRUST_ROOT.reviewDigest || review.authorLogin !== TRUST_ROOT.reviewAuthor || review.createdAt !== TRUST_ROOT.reviewCreatedAt ||
      review.updatedAt !== TRUST_ROOT.reviewUpdatedAt || review.record?.record_type !== 'independent_architecture_review_decision' ||
      review.record?.reviewed_amendment !== TRUST_ROOT.recordUrl || review.record?.reviewed_amendment_body_sha256 !== TRUST_ROOT.recordDigest ||
      review.record?.decision !== 'APPROVE' || review.record?.blocking_finding_count !== 0 || review.record?.unknown_count !== 0) {
    throw new Error('pinned trust root or Review integrity failed')
  }
  const anchor = await acquireCanonicalRecord(assignmentSpec.url, repository)
  if (!validatePinnedSource(anchor, assignmentSpec)) throw new Error('assignment authority anchor integrity failed')
  let anchorReview = null
  if (assignmentSpec.reviewUrl !== undefined) {
    anchorReview = await acquireCanonicalRecord(assignmentSpec.reviewUrl, repository)
    if (anchorReview.bodyDigest !== assignmentSpec.reviewDigest || anchorReview.authorLogin !== assignmentSpec.reviewAuthor ||
        anchorReview.createdAt !== assignmentSpec.reviewCreatedAt || anchorReview.updatedAt !== assignmentSpec.reviewUpdatedAt) {
      throw new Error('assignment authority anchor Review integrity failed')
    }
  }
  const parentComments = await paginated(`repos/${repository}/issues/251/comments`)
  const exactRoots = parentComments.filter((comment) => comment?.html_url === TRUST_ROOT.recordUrl)
  if (exactRoots.length !== 1) throw new IdentityRejection(['trust_root_cardinality_invalid'])
  for (const comment of parentComments) {
    const parsed = parseRecordBody(comment?.body)
    if (recordTypeClaim(comment?.body, 'phase_1_assignment_issuer_trust_root_revocation_v1') && parsed === null) {
      throw new Error('malformed trust-root revocation record')
    }
    if (parsed?.record_type === 'phase_1_assignment_issuer_trust_root_revocation_v1' && parsed?.trust_root_id === TRUST_ROOT_ID &&
        parsed?.trust_root_revision === TRUST_ROOT.revision && comment?.user?.login === assignmentSpec.ownerLogin) {
      throw new IdentityRejection(['trust_root_revoked'])
    }
    if (parsed?.record_type === 'phase_1_assignment_issuer_trust_root_architecture_amendment' && parsed?.trust_root_id === TRUST_ROOT_ID &&
        parsed?.trust_root_revision === TRUST_ROOT.revision && comment?.html_url !== TRUST_ROOT.recordUrl) {
      throw new IdentityRejection(['trust_root_ambiguous'])
    }
  }
  return Object.freeze({
    record_url: TRUST_ROOT.recordUrl,
    record_digest: TRUST_ROOT.recordDigest,
    review_url: TRUST_ROOT.reviewUrl,
    review_digest: TRUST_ROOT.reviewDigest,
    revision: TRUST_ROOT.revision,
    issuer_anchor_url: anchor.url,
    issuer_anchor_digest: anchor.bodyDigest,
    issuer_login: assignmentSpec.ownerLogin,
    issuer_role: assignmentSpec.ownerRole,
    anchor_review_url: anchorReview?.url ?? null,
    anchor_review_digest: anchorReview?.bodyDigest ?? null,
  })
}

const acquireReadyEvent = async (request, host, readySource) => {
  const pr = await ghJson([`repos/${host.repository}/pulls/${request.prNumber}`])
  if (pr?.html_url !== `https://github.com/${host.repository}/pull/${request.prNumber}` || pr?.head?.sha !== request.exactHead) {
    throw new IdentityRejection(['current_pr_head_mismatch'])
  }
  const endpoint = `repos/${host.repository}/issues/${request.prNumber}/timeline`
  const timeline = await paginated(endpoint)
  const matches = timeline.filter((event) => event?.event === 'ready_for_review' && String(event?.id) === String(readySource.record.ready_event_id) &&
    event?.created_at === readySource.record.ready_occurred_at && event?.commit_id === request.exactHead)
  if (matches.length !== 1) throw new IdentityRejection(['ready_event_cardinality_invalid'])
  const event = matches[0]
  if (typeof event?.actor?.login !== 'string' || event.actor.login.length === 0) throw new Error('matching Ready event actor is malformed')
  return Object.freeze({
    endpoint: `https://api.github.com/repos/${host.repository}/issues/${request.prNumber}/timeline`,
    event_id: String(event.id),
    occurred_at: event.created_at,
    commit_id: event.commit_id,
    actor_login: event.actor.login,
  })
}

const acquireAssignment = async (request, host, taskSource, readySource, readyEvent, trustRoot, spec) => {
  const taskIdentity = ISSUE_URL.exec(request.taskRecordUrl)
  if (taskIdentity === null) throw new IdentityRejection(['task_issue_required_for_assignment_discovery'])
  const comments = await paginated(`repos/${host.repository}/issues/${taskIdentity[3]}/comments`)
  const declared = []
  for (const comment of comments) {
    if (!recordTypeClaim(comment?.body, spec.recordType)) continue
    const parsed = parseRecordBody(comment.body)
    if (parsed === null) throw new Error('malformed declared assignment record')
    declared.push({ listed: comment, parsed })
  }
  if (declared.length === 0) throw new IdentityRejection(['assignment_missing'])
  const records = []
  for (const candidate of declared) {
    const direct = await acquireCanonicalRecord(candidate.listed.html_url, host.repository, { requireOwner: false })
    if (direct.createdAt !== direct.updatedAt) throw new IdentityRejection(['assignment_edited'])
    const record = direct.record
    if (!exactObjectKeys(record, ASSIGNMENT_KEYS)) throw new Error('assignment record contract malformed')
    const projection = Object.fromEntries(Object.entries(record).filter(([key]) => key !== 'record_digest'))
    const projectionDigest = await sha256ReadyReviewObservationV1(canonicalizeReadyReviewObservationJcsV1(projection))
    if (record.record_digest !== projectionDigest) throw new Error('assignment record digest mismatch')
    if (record.canonical_record !== direct.url) throw new IdentityRejection(['assignment_source_url_mismatch'])
    records.push({ source: direct, record })
  }
  if (records.some(({ source, record }) => source.authorLogin !== trustRoot.issuer_login || record.authority_owner_login !== trustRoot.issuer_login ||
      record.authority_owner_role !== trustRoot.issuer_role)) throw new IdentityRejection(['assignment_issuer_not_admitted'])
  const taskScopeDigest = await bodyDigest(taskSource.body)
  const expectedScope = (record) => record.record_type === spec.recordType && record.repository === host.repository && record.task_record_url === request.taskRecordUrl &&
    record.task_scope_digest === taskScopeDigest && record.pr_number === request.prNumber && record.pr_url === `https://github.com/${host.repository}/pull/${request.prNumber}` &&
    record.exact_head === request.exactHead && record.ready_generation_record_url === request.readyRecordUrl &&
    record.ready_generation_record_digest === readySource.record.record_digest && String(record.ready_event_id) === readyEvent.event_id &&
    record.ready_occurred_at === readyEvent.occurred_at && record.transition === spec.transition && record.assigned_role === spec.assignedRole &&
    typeof record.assigned_login === 'string' && record.assigned_login.length > 0 && Number.isSafeInteger(record.revision) && record.revision > 0 &&
    (record.status === 'assigned' || record.status === 'revoked') && typeof record.assignment_id === 'string' && record.assignment_id.length > 0 &&
    (record.supersedes_record_url === null || COMMENT_URL.test(record.supersedes_record_url)) && record.issued_at === records.find((item) => item.record === record)?.source.createdAt
  if (records.some(({ record }) => !expectedScope(record))) throw new IdentityRejection(['assignment_scope_mismatch'])
  const assignmentIds = new Set(records.map(({ record }) => record.assignment_id))
  if (assignmentIds.size !== 1) throw new IdentityRejection(['assignment_chain_ambiguous'])
  const byRevision = new Map()
  for (const item of records) {
    if (byRevision.has(item.record.revision)) throw new IdentityRejection(['assignment_chain_forked'])
    byRevision.set(item.record.revision, item)
  }
  const maximum = Math.max(...byRevision.keys())
  if (byRevision.size !== maximum) throw new IdentityRejection(['assignment_chain_gapped'])
  for (let revision = 1; revision <= maximum; revision += 1) {
    const item = byRevision.get(revision)
    const predecessor = revision === 1 ? null : byRevision.get(revision - 1)?.source.url
    if (item.record.supersedes_record_url !== predecessor) throw new IdentityRejection(['assignment_chain_invalid'])
  }
  const tip = byRevision.get(maximum)
  if (tip.record.status !== 'assigned') throw new IdentityRejection(['assignment_revoked'])
  return Object.freeze({
    record_url: tip.source.url,
    record_digest: tip.source.bodyDigest,
    assignment_id: tip.record.assignment_id,
    revision: tip.record.revision,
    issuer_login: trustRoot.issuer_login,
    issuer_role: trustRoot.issuer_role,
    assigned_login: tip.record.assigned_login,
    assigned_role: tip.record.assigned_role,
    transition: tip.record.transition,
  })
}

export const classifyTerminalLeafAuthorBindingV1 = ({ directApiAuthorLogin, declaredApiAuthorLogin, recordActorLogin, assignedLogin }) => {
  const values = [directApiAuthorLogin, declaredApiAuthorLogin, recordActorLogin, assignedLogin]
  if (!values.every((value) => typeof value === 'string' && value.length > 0)) return 'failed'
  if (directApiAuthorLogin !== declaredApiAuthorLogin) return 'failed'
  if (declaredApiAuthorLogin !== recordActorLogin || recordActorLogin !== assignedLogin) return 'rejected'
  return 'accepted'
}

const terminalTupleMatches = (record, request, host, readySource, readyEvent, assignment) =>
  record.task_record_url === request.taskRecordUrl && record.repository === host.repository && record.pr_number === request.prNumber &&
  record.pr_url === `https://github.com/${host.repository}/pull/${request.prNumber}` && record.exact_head === request.exactHead &&
  record.ready_generation_record_url === request.readyRecordUrl && record.ready_generation_record_digest === readySource.record.record_digest &&
  String(record.ready_event_id) === readyEvent.event_id && record.ready_occurred_at === readyEvent.occurred_at &&
  record.transition === 'terminal_review_admission' && record.assignment_record_url === assignment.record_url &&
  record.assignment_record_digest === assignment.record_digest && record.actor_role === assignment.assigned_role

const acquireCurrentTerminalLeaf = async (request, host, readySource, readyEvent, assignment) => {
  const taskIdentity = ISSUE_URL.exec(request.taskRecordUrl)
  if (taskIdentity === null) throw new IdentityRejection(['terminal_lineage_task_issue_required'])
  const comments = await paginated(`repos/${host.repository}/issues/${taskIdentity[3]}/comments`)
  const declared = comments.filter((comment) => recordTypeClaim(comment?.body, TERMINAL_LINEAGE_RECORD_TYPE))
  if (declared.length === 0) throw new IdentityRejection(['terminal_lineage_missing'])
  const sameTuple = []
  for (const listed of declared) {
    const parsed = parseRecordBody(listed?.body)
    if (parsed === null) throw new Error('malformed declared Terminal lineage record')
    const source = await acquireCanonicalRecord(listed.html_url, host.repository, { requireOwner: false })
    const record = source.record
    if (source.createdAt !== source.updatedAt || !exactObjectKeys(record, TERMINAL_LINEAGE_KEYS)) {
      throw new Error('Terminal lineage record integrity malformed')
    }
    const projection = Object.fromEntries(Object.entries(record).filter(([key]) => key !== 'record_digest'))
    if (record.record_digest !== await sha256ReadyReviewObservationV1(canonicalizeReadyReviewObservationJcsV1(projection)) ||
        record.canonical_record !== source.url || record.published_at !== source.createdAt) {
      throw new Error('Terminal lineage URL, publication, or digest integrity failed')
    }
    if (!terminalTupleMatches(record, request, host, readySource, readyEvent, assignment)) continue
    const authorBinding = classifyTerminalLeafAuthorBindingV1({
      directApiAuthorLogin: source.authorLogin,
      declaredApiAuthorLogin: record.api_author_login,
      recordActorLogin: record.actor_login,
      assignedLogin: assignment.assigned_login,
    })
    if (authorBinding === 'failed') throw new Error('Terminal lineage author evidence unavailable or integrity-invalid')
    if (authorBinding === 'rejected') throw new IdentityRejection(['terminal_leaf_author_assignment_mismatch'])
    if (typeof record.lineage_id !== 'string' || record.lineage_id.length === 0 || !Number.isSafeInteger(record.revision) || record.revision <= 0 ||
        !['APPROVE', 'REVOKED', 'BLOCKED', 'CHANGES_REQUIRED', 'SUPERSEDED'].includes(record.effect) ||
        !(record.predecessor_record_url === null || COMMENT_URL.test(record.predecessor_record_url)) ||
        !(record.predecessor_record_digest === null || /^[0-9a-f]{64}$/.test(record.predecessor_record_digest)) ||
        !/^[0-9a-f]{64}$/.test(record.collector_artifact_digest) || !Array.isArray(record.accepted_receipts)) {
      throw new Error('Terminal lineage tuple contract malformed')
    }
    sameTuple.push({ source, record })
  }
  if (sameTuple.length === 0 || !sameTuple.some(({ source }) => source.url === request.terminalReviewRecordUrl)) {
    throw new IdentityRejection(['terminal_lineage_candidate_absent'])
  }
  if (new Set(sameTuple.map(({ record }) => record.lineage_id)).size !== 1) {
    throw new IdentityRejection(['terminal_lineage_disconnected'])
  }
  const byRevision = new Map()
  for (const item of sameTuple) {
    if (byRevision.has(item.record.revision)) throw new IdentityRejection(['terminal_lineage_forked'])
    byRevision.set(item.record.revision, item)
  }
  const maximum = Math.max(...byRevision.keys())
  if (byRevision.size !== maximum) throw new IdentityRejection(['terminal_lineage_gapped'])
  for (let revision = 1; revision <= maximum; revision += 1) {
    const item = byRevision.get(revision)
    const predecessor = revision === 1 ? null : byRevision.get(revision - 1)
    if ((revision === 1 && (item.record.predecessor_record_url !== null || item.record.predecessor_record_digest !== null)) ||
        (revision > 1 && (item.record.predecessor_record_url !== predecessor.source.url ||
          item.record.predecessor_record_digest !== predecessor.source.bodyDigest ||
          Date.parse(item.record.published_at) <= Date.parse(predecessor.record.published_at)))) {
      throw new IdentityRejection(['terminal_lineage_chain_invalid'])
    }
  }
  const leaf = byRevision.get(maximum)
  if (leaf.source.url !== request.terminalReviewRecordUrl) throw new IdentityRejection(['terminal_lineage_candidate_not_current_leaf'])
  if (leaf.record.effect !== 'APPROVE') throw new IdentityRejection(['terminal_lineage_leaf_not_approve'])
  if (leaf.record.accepted_receipts.length !== 1) throw new IdentityRejection(['terminal_lineage_receipt_cardinality_invalid'])
  return Object.freeze(leaf)
}

const strictUtf8 = (value) => new TextDecoder('utf-8', { fatal: true }).decode(value)

const artifactMember = async (archivePath, member) => {
  const { stdout, stderr } = await execFileAsync('unzip', ['-p', archivePath, member], { maxBuffer: 128 * 1024 * 1024, windowsHide: true })
  if (!Buffer.isBuffer(stdout) || (Buffer.isBuffer(stderr) ? stderr.length !== 0 : stderr !== '')) throw new Error('artifact extraction failed')
  return stdout
}

const acquireTerminalArtifactReceipt = async (request, host, readySource, readyEvent, terminalAssignment, leaf) => {
  const embedded = leaf.record.accepted_receipts[0]
  if (!await validateProtectedTransitionAdmissionReceiptV1(embedded)) throw new Error('embedded Terminal receipt locator malformed')
  const run = await ghJson([`repos/${host.repository}/actions/runs/${embedded.workflow_run_id}`])
  if (typeof run?.actor?.login !== 'string' || typeof run?.triggering_actor?.login !== 'string') {
    throw new Error('Terminal workflow actor provenance unavailable')
  }
  const trustedRunMismatch = run?.id === undefined || String(run.id) !== embedded.workflow_run_id || run?.run_attempt !== embedded.workflow_run_attempt ||
    run?.path !== WORKFLOW_PATH || run?.event !== 'workflow_dispatch' || run?.head_branch !== 'main' || run?.head_sha !== embedded.workflow_sha ||
    run?.status !== 'completed' || run?.conclusion !== 'success' || run?.html_url !== embedded.workflow_run_url ||
    run.actor.login !== embedded.workflow_actor || run.triggering_actor.login !== embedded.workflow_actor ||
    embedded.workflow_ref !== `${host.repository}/${WORKFLOW_PATH}@refs/heads/main`
  if (trustedRunMismatch) throw new IdentityRejection(['terminal_workflow_run_mismatch'])
  const expectedName = `protected-transition-admission-v1-${embedded.workflow_run_id}-${embedded.workflow_run_attempt}`
  const artifacts = await paginatedArtifacts(host.repository, embedded.workflow_run_id)
  const named = artifacts.filter((artifact) => artifact?.name === expectedName)
  if (named.length !== 1 || named[0]?.expired !== false) throw new Error('Terminal workflow artifact is missing, ambiguous, or expired')
  const artifact = named[0]
  if (!Number.isSafeInteger(artifact.id) || artifact.id <= 0 || artifact?.workflow_run?.id !== run.id ||
      typeof artifact.archive_download_url !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(artifact.digest ?? '')) {
    throw new Error('Terminal workflow artifact metadata malformed')
  }
  const archive = await ghBuffer([`repos/${host.repository}/actions/artifacts/${artifact.id}/zip`])
  const archiveSha = sha256Buffer(archive)
  if (`sha256:${archiveSha}` !== artifact.digest) throw new Error('Terminal artifact archive digest mismatch')
  const runnerTemp = process.env.RUNNER_TEMP
  if (typeof runnerTemp !== 'string' || runnerTemp.length === 0) throw new Error('workflow temporary directory unavailable')
  const temporary = await mkdtemp(path.join(path.resolve(runnerTemp), 'pta-terminal-'))
  try {
    const archivePath = path.join(temporary, 'artifact.zip')
    await writeFile(archivePath, archive, { flag: 'wx' })
    const { stdout: namesStdout, stderr: namesStderr } = await execFileAsync('unzip', ['-Z1', archivePath], { encoding: 'utf8', windowsHide: true })
    if (namesStderr !== '') throw new Error('artifact membership acquisition failed')
    const names = namesStdout.split(/\r?\n/).filter((name) => name.length > 0).sort()
    if (names.length !== TERMINAL_ACCEPTED_FILES.length || names.some((name, index) => name !== [...TERMINAL_ACCEPTED_FILES].sort()[index])) {
      throw new Error('Terminal artifact archive membership invalid')
    }
    const receiptText = strictUtf8(await artifactMember(archivePath, PROTECTED_TRANSITION_RECEIPT_FILE_V1))
    const collectorText = strictUtf8(await artifactMember(archivePath, 'ready-review-terminal-observation-artifact-v1.jcs'))
    let receipt
    try {
      receipt = JSON.parse(receiptText)
    } catch {
      throw new Error('Terminal receipt JSON malformed')
    }
    if (canonicalizeReadyReviewObservationJcsV1(receipt) !== receiptText || !await validateProtectedTransitionAdmissionReceiptV1(receipt)) {
      throw new Error('Terminal receipt canonical JCS or admission digest invalid')
    }
    const receiptSha = await sha256ReadyReviewObservationV1(receiptText)
    const collectorArtifact = await parseReadyReviewTerminalObservationArtifactV1(collectorText)
    const collectorSha = await sha256ReadyReviewObservationV1(collectorText)
    if (collectorArtifact === null || collectorSha !== receipt.collector_artifact_jcs_sha256 ||
        collectorArtifact.artifact_digest !== receipt.collector_artifact_digest || receipt.collector_artifact_digest !== leaf.record.collector_artifact_digest) {
      throw new Error('Terminal Collector artifact integrity invalid')
    }
    if (canonicalizeReadyReviewObservationJcsV1(receipt) !== canonicalizeReadyReviewObservationJcsV1(embedded)) {
      throw new IdentityRejection(['terminal_embedded_receipt_mismatch'])
    }
    const trustedReceiptMismatch = receipt.result !== 'accepted' || receipt.transition !== 'terminal_review_admission' ||
      receipt.rejection_codes.length !== 0 || receipt.state_changed !== false || receipt.repository !== host.repository ||
      receipt.task_record_url !== request.taskRecordUrl || receipt.pr_number !== request.prNumber ||
      receipt.pr_url !== `https://github.com/${host.repository}/pull/${request.prNumber}` || receipt.exact_head !== request.exactHead ||
      receipt.ready_generation_record_url !== request.readyRecordUrl || receipt.ready_generation_record_digest !== readySource.record.record_digest ||
      receipt.ready_event_id !== readyEvent.event_id || receipt.ready_occurred_at !== readyEvent.occurred_at ||
      receipt.actor_login !== terminalAssignment.assigned_login || receipt.actor_role !== terminalAssignment.assigned_role ||
      receipt.assignment_record_url !== terminalAssignment.record_url || receipt.assignment_record_digest !== terminalAssignment.record_digest ||
      receipt.workflow_run_id !== embedded.workflow_run_id || receipt.workflow_run_attempt !== embedded.workflow_run_attempt ||
      receipt.workflow_path !== WORKFLOW_PATH || receipt.workflow_ref !== embedded.workflow_ref || receipt.workflow_sha !== embedded.workflow_sha ||
      receipt.workflow_actor !== embedded.workflow_actor || receipt.workflow_run_url !== embedded.workflow_run_url || Date.parse(receipt.expires_at) < Date.now()
    if (trustedReceiptMismatch) throw new IdentityRejection(['terminal_receipt_scope_mismatch'])
    return Object.freeze({
      record_url: leaf.source.url,
      record_digest: leaf.source.bodyDigest,
      lineage_id: leaf.record.lineage_id,
      revision: leaf.record.revision,
      task_record_url: leaf.record.task_record_url,
      repository: leaf.record.repository,
      pr_number: leaf.record.pr_number,
      pr_url: leaf.record.pr_url,
      exact_head: leaf.record.exact_head,
      ready_generation_record_url: leaf.record.ready_generation_record_url,
      ready_event_id: String(leaf.record.ready_event_id),
      decision: 'APPROVE',
      actor_login: leaf.record.actor_login,
      assignment_record_url: leaf.record.assignment_record_url,
      assignment_record_digest: leaf.record.assignment_record_digest,
      published_at: leaf.record.published_at,
      collector_artifact_digest: leaf.record.collector_artifact_digest,
      workflow_artifact_id: String(artifact.id),
      workflow_artifact_name: artifact.name,
      workflow_artifact_archive_sha256: archiveSha,
      receipt_jcs_sha256: receiptSha,
      accepted_receipts: [receipt],
    })
  } finally {
    await rm(temporary, { recursive: true, force: true })
  }
}

const admittedHostIdentity = () => {
  const repository = process.env.GITHUB_REPOSITORY
  const repositoryId = process.env.GITHUB_REPOSITORY_ID
  const invocationRef = process.env.GITHUB_REF
  const workflowSha = process.env.GITHUB_WORKFLOW_SHA
  const workflowRef = process.env.GITHUB_WORKFLOW_REF
  const runId = process.env.GITHUB_RUN_ID
  const runAttempt = Number(process.env.GITHUB_RUN_ATTEMPT)
  const originalActor = process.env.GITHUB_ACTOR
  const triggeringActor = process.env.GITHUB_TRIGGERING_ACTOR
  const serverUrl = process.env.GITHUB_SERVER_URL
  const runUrl = process.env.PTA_RUN_URL
  const defaultBranch = process.env.PTA_DEFAULT_BRANCH
  if (!REPOSITORY.test(repository ?? '') || typeof repositoryId !== 'string' || repositoryId.length === 0 || invocationRef !== 'refs/heads/main' ||
      !FULL_HEAD.test(workflowSha ?? '') || workflowRef !== `${repository}/${WORKFLOW_PATH}@refs/heads/main` || typeof runId !== 'string' || runId.length === 0 ||
      !Number.isSafeInteger(runAttempt) || runAttempt <= 0 || typeof originalActor !== 'string' || originalActor.length === 0 ||
      typeof triggeringActor !== 'string' || triggeringActor.length === 0 || serverUrl !== 'https://github.com' ||
      runUrl !== `${serverUrl}/${repository}/actions/runs/${runId}` || defaultBranch !== 'main') return null
  return Object.freeze({
    repository, repositoryId, invocationRef, workflowSha, workflowRef, runId, runAttempt,
    originalActor, triggeringActor, actor: triggeringActor, serverUrl, runUrl, defaultBranch,
  })
}

const persistFiles = async (result) => {
  if (result.files_to_persist.length === 0) return true
  const runnerTemp = process.env.RUNNER_TEMP
  const configured = process.env.PTA_OUTPUT_DIRECTORY
  if (typeof runnerTemp !== 'string' || runnerTemp.length === 0 || typeof configured !== 'string' || configured.length === 0) return false
  const root = path.resolve(runnerTemp)
  const output = path.resolve(configured)
  if (output === root || !output.startsWith(`${root}${path.sep}`)) return false
  try {
    await mkdir(output, { recursive: false })
    for (const file of result.files_to_persist) {
      if (path.basename(file.file_name) !== file.file_name) throw new Error('invalid output file name')
      const target = path.join(output, file.file_name)
      await writeFile(target, file.utf8_jcs, { encoding: 'utf8', flag: 'wx' })
      const persisted = await readFile(target, 'utf8')
      if (persisted !== file.utf8_jcs || await sha256ReadyReviewObservationV1(persisted) !== file.sha256) throw new Error('persisted bytes mismatch')
    }
    return true
  } catch {
    await rm(output, { recursive: true, force: true }).catch(() => undefined)
    return false
  }
}

const persistIdentityRejection = async (request, host, rejection, observed = {}) => {
  const evaluatedAt = new Date().toISOString()
  const projection = {
    diagnostic_version: 'protected-transition-identity-rejection-v1',
    result: 'rejected',
    transition: request.transition,
    repository: host.repository,
    repository_id: host.repositoryId,
    task_record_url: request.taskRecordUrl,
    pr_number: request.prNumber,
    pr_url: `https://github.com/${host.repository}/pull/${request.prNumber}`,
    exact_head: request.exactHead,
    ready_generation_record_url: request.readyRecordUrl,
    ready_event_id: observed.ready_event_id ?? 'not_acquired',
    ready_occurred_at: observed.ready_occurred_at ?? 'not_acquired',
    ready_actor_login: observed.ready_actor_login ?? 'not_acquired',
    trust_root_record_url: observed.trust_root_record_url ?? 'not_acquired',
    assignment_record_url: observed.assignment_record_url ?? 'not_acquired',
    assignment_record_digest: observed.assignment_record_digest ?? 'not_acquired',
    assigned_login: observed.assigned_login ?? 'not_acquired',
    assigned_role: observed.assigned_role ?? 'not_acquired',
    workflow_original_actor: host.originalActor,
    workflow_triggering_actor: host.triggeringActor,
    workflow_actor: host.actor,
    workflow_sha: host.workflowSha,
    workflow_run_url: host.runUrl,
    collector_artifact: 'not_acquired',
    rejection_codes: rejection.codes,
    evaluated_at: evaluatedAt,
    expires_at: new Date(Date.parse(evaluatedAt) + 30 * 60 * 1000).toISOString(),
    state_changed: false,
    protected_transition_performed: false,
  }
  const receipt = {
    ...projection,
    diagnostic_digest: await sha256ReadyReviewObservationV1(canonicalizeReadyReviewObservationJcsV1(projection)),
  }
  const jcs = canonicalizeReadyReviewObservationJcsV1(receipt)
  const result = {
    files_to_persist: [{ file_name: PROTECTED_TRANSITION_RECEIPT_FILE_V1, utf8_jcs: jcs, sha256: await sha256ReadyReviewObservationV1(jcs) }],
  }
  if (!await persistFiles(result)) {
    fail('persistence_failed', 'identity rejection diagnostic persistence failed closed')
    return
  }
  process.stdout.write(`${canonicalizeReadyReviewObservationJcsV1({
    result: 'rejected',
    transition: request.transition,
    diagnostic_digest: receipt.diagnostic_digest,
    receipt_count: 1,
    admitted_artifact_count: 0,
    state_changed: false,
    protected_transition_performed: false,
  })}\n`)
  process.exitCode = 2
}

const main = async () => {
  const request = exactArgs(process.argv.slice(2))
  const host = admittedHostIdentity()
  if (request === null || host === null) {
    fail('caller_or_host_identity_invalid', 'caller arguments or host-derived identity failed admission')
    return
  }
  const observedAuthority = {}
  try {
    const taskSource = await acquireCanonicalRecord(request.taskRecordUrl, host.repository)
    const readySource = await acquireCanonicalRecord(request.readyRecordUrl, host.repository)
    if (request.transition === 'merge_decision_admission' && request.terminalReviewRecordUrl === '') throw new Error('terminal review record is required')
    if (!await validateReadyReviewGenerationRecordV1(readySource.record) || readySource.record.canonical_record !== request.readyRecordUrl ||
        readySource.record.repository !== host.repository || readySource.record.pr_number !== request.prNumber || readySource.record.exact_head !== request.exactHead) {
      throw new Error('Ready Generation record failed admission')
    }
    const assignmentSpec = expectedAssignment(request.transition)
    const readyEvent = await acquireReadyEvent(request, host, readySource)
    Object.assign(observedAuthority, {
      ready_event_id: readyEvent.event_id,
      ready_occurred_at: readyEvent.occurred_at,
      ready_actor_login: readyEvent.actor_login,
    })
    const trustRoot = await acquireTrustRoot(taskSource, host.repository, assignmentSpec)
    observedAuthority.trust_root_record_url = trustRoot.record_url
    const assignment = await acquireAssignment(request, host, taskSource, readySource, readyEvent, trustRoot, assignmentSpec)
    Object.assign(observedAuthority, {
      assignment_record_url: assignment.record_url,
      assignment_record_digest: assignment.record_digest,
      assigned_login: assignment.assigned_login,
      assigned_role: assignment.assigned_role,
    })

    if (host.triggeringActor !== host.originalActor) throw new IdentityRejection(['workflow_rerun_actor_mismatch'])
    if (host.triggeringActor !== assignment.assigned_login) throw new IdentityRejection(['workflow_actor_assignment_mismatch'])

    let terminalRecord = null
    if (request.transition === 'merge_decision_admission') {
      const terminalRequest = Object.freeze({ ...request, transition: 'terminal_review_admission' })
      const terminalSpec = expectedAssignment('terminal_review_admission')
      const terminalTrustRoot = await acquireTrustRoot(taskSource, host.repository, terminalSpec)
      const terminalAssignment = await acquireAssignment(
        terminalRequest, host, taskSource, readySource, readyEvent, terminalTrustRoot, terminalSpec,
      )
      const terminalLeaf = await acquireCurrentTerminalLeaf(request, host, readySource, readyEvent, terminalAssignment)
      terminalRecord = await acquireTerminalArtifactReceipt(
        request, host, readySource, readyEvent, terminalAssignment, terminalLeaf,
      )
    }

    const collector = await execFileAsync(process.execPath, [
      COLLECTOR_PATH,
      '--repository', host.repository,
      '--pr', String(request.prNumber),
      '--head', request.exactHead,
      '--ready-record', request.readyRecordUrl,
    ], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, windowsHide: true })
    const collectorJcs = collector.stdout
    if (typeof collectorJcs !== 'string' || collectorJcs.length === 0 || collector.stderr !== '') throw new Error('Collector did not return one exact JCS artifact')
    const collectorProjection = JSON.parse(collectorJcs)
    const taskScopeDigest = await sha256ReadyReviewObservationV1(taskSource.body)
    const evaluatedAt = new Date().toISOString()
    const input = {
      input_version: PROTECTED_TRANSITION_ADMISSION_INPUT_V1,
      transition: request.transition,
      repository: host.repository,
      repository_id: host.repositoryId,
      task_record_url: request.taskRecordUrl,
      task_scope_digest: taskScopeDigest,
      pr_number: request.prNumber,
      pr_url: `https://github.com/${host.repository}/pull/${request.prNumber}`,
      exact_head: request.exactHead,
      ready_generation: {
        record_url: request.readyRecordUrl,
        record_digest: readySource.record.record_digest,
        endpoint: readyEvent.endpoint,
        event_id: readyEvent.event_id,
        occurred_at: readyEvent.occurred_at,
        commit_id: readyEvent.commit_id,
        actor_login: readyEvent.actor_login,
      },
      actor: { login: host.actor },
      authority: { trust_root: trustRoot, assignment },
      collector_artifact_jcs: collectorJcs,
      collector_artifact_jcs_sha256: await sha256ReadyReviewObservationV1(collectorJcs),
      terminal_review: terminalRecord,
      workflow_identity: {
        path: WORKFLOW_PATH,
        ref: host.workflowRef,
        sha: host.workflowSha,
        invocation_ref: host.invocationRef,
        run_id: host.runId,
        run_attempt: host.runAttempt,
        actor: host.actor,
        server_url: host.serverUrl,
        run_url: host.runUrl,
        default_branch: host.defaultBranch,
      },
      current_state: {
        repository: host.repository,
        pr_number: request.prNumber,
        exact_head: request.exactHead,
        task_scope_digest: taskScopeDigest,
        ready_generation_record_url: request.readyRecordUrl,
        ready_event_id: readyEvent.event_id,
        ready_occurred_at: readyEvent.occurred_at,
        ready_actor_login: readyEvent.actor_login,
        actor_login: host.actor,
        actor_role: assignment.assigned_role,
        assignment_record_url: assignment.record_url,
        assignment_record_digest: assignment.record_digest,
        trust_root_record_url: trustRoot.record_url,
        trust_root_record_digest: trustRoot.record_digest,
        default_branch: host.defaultBranch,
        workflow_sha: host.workflowSha,
        thread_snapshot_digest: collectorProjection?.thread_snapshot?.snapshot_digest,
        terminal_review_decision: terminalRecord?.decision ?? null,
        latest_protected_event_at: terminalRecord?.published_at ?? readySource.record.ready_occurred_at,
      },
      persistence: {
        owner: 'github_actions_artifact_service',
        available: typeof process.env.ACTIONS_RUNTIME_TOKEN === 'string' && process.env.ACTIONS_RUNTIME_TOKEN.length > 0 &&
          typeof process.env.ACTIONS_RESULTS_URL === 'string' && process.env.ACTIONS_RESULTS_URL.length > 0,
      },
      evaluated_at: evaluatedAt,
    }
    const result = await evaluateProtectedTransitionAdmissionV1(input)
    if (!await persistFiles(result)) {
      fail('persistence_failed', 'admission output persistence failed closed')
    } else if (result.result === 'failed') {
      fail(result.failure.code, result.failure.safe_message)
    } else {
      process.stdout.write(`${canonicalizeReadyReviewObservationJcsV1({
        result: result.result,
        transition: result.transition,
        admission_digest: result.receipt.admission_digest,
        expires_at: result.receipt.expires_at,
        receipt_count: result.receipt_count,
        admitted_artifact_count: result.admitted_artifact_count,
        state_changed: false,
        protected_transition_performed: false,
      })}\n`)
      process.exitCode = result.result === 'accepted' ? 0 : 2
    }
  } catch (error) {
    if (error instanceof IdentityRejection) {
      await persistIdentityRejection(request, host, error, { ...observedAuthority, ...error.observation })
    } else {
      fail('acquisition_or_collector_failed', 'canonical acquisition or Collector execution failed closed')
    }
  }
}

if (typeof process.argv[1] === 'string' && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main()
