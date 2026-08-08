import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  evaluateProtectedTransitionAdmissionV1,
  isNormalizedRepositoryPathV1,
  parseProtectedTransitionTaskStateJsonV1,
  parseProtectedTransitionTaskStateV1,
  projectProtectedTransitionApprovedReviewStateV1,
} from '../src/continuous-orchestration/protected-transition-admission-v1.ts'

const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/
const FULL_HEAD = /^[0-9a-f]{40}$/
const STATE_START = '<!-- protected-transition-task-state-v1:start -->'
const STATE_END = '<!-- protected-transition-task-state-v1:end -->'
const MAX_PULL_FILES = 3000
const PAGE_SIZE = 100
const REVIEW_RECORD_TYPE = 'independent_review_decision_v1'
const REVIEW_AUTHORING_ROLE = 'Independent Reviewer'
const REVIEW_ASSOCIATIONS = new Set(['OWNER', 'MEMBER', 'COLLABORATOR'])
const STRICT_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/
const MERGE_CHECKS_QUERY = `
query MergeAllowedChecks($owner: String!, $name: String!, $head: GitObjectID!, $after: String) {
  repository(owner: $owner, name: $name) {
    object(oid: $head) {
      ... on Commit {
        oid
        statusCheckRollup {
          contexts(first: 100, after: $after) {
            totalCount
            nodes {
              __typename
              ... on CheckRun { id name status conclusion }
              ... on StatusContext { id context state }
            }
            pageInfo { hasNextPage endCursor }
          }
        }
      }
    }
  }
}`
const MERGE_THREADS_QUERY = `
query MergeAllowedThreads($owner: String!, $name: String!, $pr: Int!, $after: String) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $pr) {
      number
      state
      isDraft
      mergeable
      mergeStateStatus
      headRefOid
      reviewThreads(first: 100, after: $after) {
        totalCount
        nodes { id isResolved isOutdated }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
}`

const positiveInteger = (value) => Number.isSafeInteger(value) && value > 0
const occurrenceCount = (text, needle) => text.split(needle).length - 1

export const extractProtectedTransitionTaskStateV1 = (body) => {
  if (typeof body !== 'string' || occurrenceCount(body, STATE_START) !== 1 || occurrenceCount(body, STATE_END) !== 1) {
    throw new Error('state_block_cardinality_invalid')
  }
  const start = body.indexOf(STATE_START)
  const end = body.indexOf(STATE_END)
  if (start < 0 || end <= start) throw new Error('state_block_order_invalid')
  const region = body.slice(start + STATE_START.length, end)
  const match = region.match(/^\s*```json\r?\n([\s\S]*?)\r?\n```\s*$/)
  if (!match) throw new Error('state_block_shape_invalid')
  return parseProtectedTransitionTaskStateJsonV1(match[1])
}

const parseReviewScalarV1 = (raw) => {
  const value = raw.trim()
  if (value.startsWith('"')) {
    let parsed
    try {
      parsed = JSON.parse(value)
    } catch {
      throw new Error('review_scalar_invalid')
    }
    if (typeof parsed !== 'string') throw new Error('review_scalar_invalid')
    return parsed
  }
  if (value === 'true') return true
  if (value === 'false') return false
  if (/^(?:0|[1-9]\d*)$/.test(value)) return Number(value)
  if (/^[A-Za-z][A-Za-z0-9_-]*$/.test(value)) return value
  throw new Error('review_scalar_invalid')
}

export const parseIndependentReviewDecisionProjectionV1 = (body, repository, taskIssueNumber) => {
  if (typeof body !== 'string' || !REPOSITORY.test(repository) || !positiveInteger(taskIssueNumber)) {
    throw new Error('review_projection_invalid')
  }
  const blocks = [...body.matchAll(/```yaml\r?\n([\s\S]*?)\r?\n```/g)]
  if (blocks.length !== 1) throw new Error('review_yaml_block_cardinality_invalid')

  const scalars = new Map()
  for (const line of blocks[0][1].split(/\r?\n/)) {
    if (line.trim().length === 0) continue
    const match = line.match(/^([a-z][a-z0-9_]*):[ \t]+(.+)$/)
    if (!match || scalars.has(match[1])) throw new Error('review_yaml_scalar_invalid')
    scalars.set(match[1], parseReviewScalarV1(match[2]))
  }

  const expectedTaskUrl = `https://github.com/${repository}/issues/${taskIssueNumber}`
  const pullPrefix = `https://github.com/${repository}/pull/`
  const pullUrl = scalars.get('pull_request')
  const prNumber = typeof pullUrl === 'string' && pullUrl.startsWith(pullPrefix)
    ? Number(pullUrl.slice(pullPrefix.length))
    : Number.NaN
  const reviewedHead = scalars.get('reviewed_head')
  const decision = scalars.get('decision')
  const blockingCount = scalars.get('blocking_finding_count')
  const remainingCount = scalars.get('remaining_finding_count')
  const unknownCount = scalars.get('unknown_count')

  if (
    scalars.get('record_type') !== REVIEW_RECORD_TYPE ||
    scalars.get('authoring_role') !== REVIEW_AUTHORING_ROLE ||
    scalars.get('task_issue') !== expectedTaskUrl ||
    !positiveInteger(prNumber) ||
    typeof reviewedHead !== 'string' ||
    !FULL_HEAD.test(reviewedHead) ||
    !['APPROVE', 'CHANGES_REQUIRED', 'BLOCKED'].includes(decision) ||
    !Number.isSafeInteger(blockingCount) ||
    blockingCount < 0 ||
    !Number.isSafeInteger(remainingCount) ||
    remainingCount < 0 ||
    !Number.isSafeInteger(unknownCount) ||
    unknownCount < 0 ||
    scalars.get('status') !== 'completed' ||
    scalars.get('execution_stop_reason') !== 'completed'
  ) {
    throw new Error('review_projection_invalid')
  }

  return Object.freeze({
    task_issue_number: taskIssueNumber,
    pr_number: prNumber,
    reviewed_head: reviewedHead,
    decision,
    blocking_finding_count: blockingCount,
    remaining_finding_count: remainingCount,
    unknown_count: unknownCount,
  })
}

export const parseReviewApprovalEventV1 = (event) => {
  const repository = event?.repository?.full_name
  const taskIssueNumber = event?.issue?.number
  if (
    !event ||
    event.action !== 'created' ||
    !REPOSITORY.test(repository ?? '') ||
    !positiveInteger(taskIssueNumber) ||
    event.issue?.state !== 'open' ||
    Object.prototype.hasOwnProperty.call(event.issue ?? {}, 'pull_request') ||
    event.issue?.html_url !== `https://github.com/${repository}/issues/${taskIssueNumber}` ||
    !positiveInteger(event.comment?.id) ||
    typeof event.comment?.created_at !== 'string' ||
    !STRICT_UTC.test(event.comment.created_at) ||
    !REVIEW_ASSOCIATIONS.has(event.comment?.author_association) ||
    typeof event.comment?.body !== 'string'
  ) {
    throw new Error('review_event_invalid')
  }
  const review = parseIndependentReviewDecisionProjectionV1(event.comment.body, repository, taskIssueNumber)
  return Object.freeze({
    repository,
    taskIssueNumber,
    prNumber: review.pr_number,
    exactHead: review.reviewed_head,
    commentId: event.comment.id,
    commentCreatedAt: event.comment.created_at,
    reviewBody: event.comment.body,
    authorAssociation: event.comment.author_association,
    review,
  })
}

const compareReviewDecisionCandidateV1 = (left, right) =>
  left.createdAt.localeCompare(right.createdAt) || left.commentId - right.commentId

const parseReviewDecisionCommentV1 = ({ comment, repository, taskIssueNumber, prNumber, exactHead }) => {
  if (
    !comment ||
    !positiveInteger(comment.id) ||
    typeof comment.created_at !== 'string' ||
    !STRICT_UTC.test(comment.created_at) ||
    !REVIEW_ASSOCIATIONS.has(comment.author_association) ||
    typeof comment.body !== 'string'
  ) {
    throw new Error('review_decision_candidate_invalid')
  }
  let review
  try {
    review = parseIndependentReviewDecisionProjectionV1(comment.body, repository, taskIssueNumber)
  } catch {
    throw new Error('review_decision_candidate_invalid')
  }
  if (review.pr_number !== prNumber || review.reviewed_head !== exactHead) return null
  return Object.freeze({
    commentId: comment.id,
    createdAt: comment.created_at,
    body: comment.body,
    authorAssociation: comment.author_association,
    review,
  })
}

export const resolveEffectiveReviewDecisionV1 = async ({ request, parsedEvent, host }) => {
  const candidates = new Map()
  const addCandidate = (candidate) => {
    if (!candidate) return
    const prior = candidates.get(candidate.commentId)
    if (prior && (
      prior.createdAt !== candidate.createdAt ||
      prior.body !== candidate.body ||
      prior.authorAssociation !== candidate.authorAssociation
    )) {
      throw new Error('review_decision_candidate_identity_conflict')
    }
    candidates.set(candidate.commentId, candidate)
  }

  addCandidate(Object.freeze({
    commentId: parsedEvent.commentId,
    createdAt: parsedEvent.commentCreatedAt,
    body: parsedEvent.reviewBody,
    authorAssociation: parsedEvent.authorAssociation,
    review: parsedEvent.review,
  }))

  const pageFingerprints = new Set()
  let pageNumber = 1
  let terminal = false
  while (!terminal) {
    const endpoint = `repos/${request.repository}/issues/${request.taskIssueNumber}/comments?since=${encodeURIComponent(parsedEvent.commentCreatedAt)}&per_page=${PAGE_SIZE}&page=${pageNumber}`
    const page = await api(host, endpoint)
    if (!Array.isArray(page) || page.length > PAGE_SIZE) throw new Error('review_decision_page_invalid')
    const fingerprint = JSON.stringify(page.map((comment) => [comment?.id, comment?.created_at, comment?.author_association, comment?.body]))
    if (page.length > 0 && pageFingerprints.has(fingerprint)) throw new Error('review_decision_page_repeated')
    pageFingerprints.add(fingerprint)

    for (const comment of page) {
      if (!isReviewDecisionCandidateV1(comment?.body)) continue
      addCandidate(parseReviewDecisionCommentV1({
        comment,
        repository: request.repository,
        taskIssueNumber: request.taskIssueNumber,
        prNumber: request.prNumber,
        exactHead: request.exactHead,
      }))
    }

    terminal = page.length < PAGE_SIZE
    pageNumber += 1
    if (pageNumber > 32) throw new Error('review_decision_terminal_page_missing')
  }

  const ordered = [...candidates.values()].sort(compareReviewDecisionCandidateV1)
  if (ordered.length === 0) throw new Error('review_decision_current_leaf_missing')
  return ordered.at(-1)
}

const api = async (host, endpoint, options = undefined) => {
  if (!host || typeof host.api !== 'function') throw new Error('host_api_unavailable')
  return host.api(endpoint, options)
}

const graphql = async (host, query, variables) => {
  if (!host || typeof host.graphql !== 'function') throw new Error('host_graphql_unavailable')
  return host.graphql(query, variables)
}

const repositoryPartsV1 = (repository) => {
  if (!REPOSITORY.test(repository ?? '')) throw new Error('repository_invalid')
  const [owner, name] = repository.split('/')
  return Object.freeze({ owner, name })
}

const validatePageInfoV1 = (pageInfo, hasNextCursors) => {
  if (!pageInfo || typeof pageInfo.hasNextPage !== 'boolean') throw new Error('graphql_page_info_invalid')
  if (!pageInfo.hasNextPage) return null
  if (typeof pageInfo.endCursor !== 'string' || pageInfo.endCursor.length === 0 || hasNextCursors.has(pageInfo.endCursor)) {
    throw new Error('graphql_page_cursor_invalid')
  }
  hasNextCursors.add(pageInfo.endCursor)
  return pageInfo.endCursor
}

export const acquireMergeCheckRollupV1 = async (request, host) => {
  const { owner, name } = repositoryPartsV1(request.repository)
  const nodes = []
  const nodeIds = new Set()
  const cursors = new Set()
  let expectedTotal = null
  let after = null
  let pageNumber = 1

  while (true) {
    const data = await graphql(host, MERGE_CHECKS_QUERY, { owner, name, head: request.exactHead, after })
    const commit = data?.repository?.object
    const connection = commit?.statusCheckRollup?.contexts
    if (
      commit?.oid !== request.exactHead ||
      !connection ||
      !Number.isSafeInteger(connection.totalCount) ||
      connection.totalCount < 0 ||
      !Array.isArray(connection.nodes) ||
      connection.nodes.length > PAGE_SIZE
    ) {
      throw new Error('check_rollup_page_invalid')
    }
    if (expectedTotal === null) expectedTotal = connection.totalCount
    if (expectedTotal !== connection.totalCount) throw new Error('check_rollup_total_changed')

    for (const node of connection.nodes) {
      if (!node || typeof node.id !== 'string' || node.id.length === 0 || nodeIds.has(node.id)) {
        throw new Error('check_rollup_context_invalid')
      }
      nodeIds.add(node.id)
      if (node.__typename === 'CheckRun') {
        if (
          typeof node.name !== 'string' ||
          node.name.length === 0 ||
          typeof node.status !== 'string' ||
          (node.conclusion !== null && typeof node.conclusion !== 'string')
        ) {
          throw new Error('check_rollup_context_invalid')
        }
        nodes.push(Object.freeze({ type: 'CheckRun', id: node.id, name: node.name, status: node.status, conclusion: node.conclusion }))
      } else if (node.__typename === 'StatusContext') {
        if (typeof node.context !== 'string' || node.context.length === 0 || typeof node.state !== 'string') {
          throw new Error('check_rollup_context_invalid')
        }
        nodes.push(Object.freeze({ type: 'StatusContext', id: node.id, context: node.context, state: node.state }))
      } else {
        throw new Error('check_rollup_context_invalid')
      }
    }

    const next = validatePageInfoV1(connection.pageInfo, cursors)
    if (next === null) break
    after = next
    pageNumber += 1
    if (pageNumber > 32) throw new Error('check_rollup_terminal_page_missing')
  }

  if (nodes.length !== expectedTotal) throw new Error('check_rollup_count_mismatch')
  return Object.freeze(nodes)
}

export const acquireMergeReviewThreadsV1 = async (request, host) => {
  const { owner, name } = repositoryPartsV1(request.repository)
  const nodes = []
  const nodeIds = new Set()
  const cursors = new Set()
  let expectedTotal = null
  let expectedPull = null
  let after = null
  let pageNumber = 1

  while (true) {
    const data = await graphql(host, MERGE_THREADS_QUERY, { owner, name, pr: request.prNumber, after })
    const pull = data?.repository?.pullRequest
    const connection = pull?.reviewThreads
    const pullIdentity = pull && Object.freeze({
      number: pull.number,
      state: pull.state,
      isDraft: pull.isDraft,
      mergeable: pull.mergeable,
      mergeStateStatus: pull.mergeStateStatus,
      headRefOid: pull.headRefOid,
    })
    if (
      !pullIdentity ||
      pullIdentity.number !== request.prNumber ||
      typeof pullIdentity.state !== 'string' ||
      typeof pullIdentity.isDraft !== 'boolean' ||
      typeof pullIdentity.mergeable !== 'string' ||
      typeof pullIdentity.mergeStateStatus !== 'string' ||
      typeof pullIdentity.headRefOid !== 'string' ||
      !FULL_HEAD.test(pullIdentity.headRefOid) ||
      !connection ||
      !Number.isSafeInteger(connection.totalCount) ||
      connection.totalCount < 0 ||
      !Array.isArray(connection.nodes) ||
      connection.nodes.length > PAGE_SIZE
    ) {
      throw new Error('review_threads_page_invalid')
    }
    if (expectedPull === null) expectedPull = pullIdentity
    if (JSON.stringify(expectedPull) !== JSON.stringify(pullIdentity)) throw new Error('review_threads_pull_changed')
    if (expectedTotal === null) expectedTotal = connection.totalCount
    if (expectedTotal !== connection.totalCount) throw new Error('review_threads_total_changed')

    for (const node of connection.nodes) {
      if (
        !node ||
        typeof node.id !== 'string' ||
        node.id.length === 0 ||
        nodeIds.has(node.id) ||
        typeof node.isResolved !== 'boolean' ||
        typeof node.isOutdated !== 'boolean'
      ) {
        throw new Error('review_thread_invalid')
      }
      nodeIds.add(node.id)
      nodes.push(Object.freeze({ id: node.id, isResolved: node.isResolved, isOutdated: node.isOutdated }))
    }

    const next = validatePageInfoV1(connection.pageInfo, cursors)
    if (next === null) break
    after = next
    pageNumber += 1
    if (pageNumber > 32) throw new Error('review_threads_terminal_page_missing')
  }

  if (nodes.length !== expectedTotal) throw new Error('review_threads_count_mismatch')
  return Object.freeze({ pull: expectedPull, threads: Object.freeze(nodes) })
}

export const acquireTaskIdentityV1 = async (request, host) => {
  const raw = await api(host, `repos/${request.repository}/issues/${request.taskIssueNumber}`)
  const expectedRepositoryUrl = `https://api.github.com/repos/${request.repository}`
  const expectedHtmlUrl = `https://github.com/${request.repository}/issues/${request.taskIssueNumber}`
  if (
    !raw ||
    raw.number !== request.taskIssueNumber ||
    raw.repository_url !== expectedRepositoryUrl ||
    raw.html_url !== expectedHtmlUrl ||
    raw.state !== 'open' ||
    Object.prototype.hasOwnProperty.call(raw, 'pull_request')
  ) {
    throw new Error('task_identity_invalid')
  }
  return Object.freeze({
    repository: request.repository,
    number: raw.number,
    state: raw.state,
    is_pull_request: false,
  })
}

const acquirePull = async (request, host) => {
  const raw = await api(host, `repos/${request.repository}/pulls/${request.prNumber}`)
  if (
    !raw ||
    raw.number !== request.prNumber ||
    raw.state !== 'open' ||
    raw.base?.repo?.full_name !== request.repository ||
    typeof raw.body !== 'string' ||
    typeof raw.head?.sha !== 'string' ||
    !FULL_HEAD.test(raw.head.sha) ||
    !Number.isSafeInteger(raw.changed_files) ||
    raw.changed_files < 0
  ) {
    throw new Error('pull_identity_invalid')
  }
  return raw
}

const acquireMergeGatePullV1 = async (request, host) => {
  const raw = await api(host, `repos/${request.repository}/pulls/${request.prNumber}`)
  if (
    !raw ||
    raw.number !== request.prNumber ||
    typeof raw.state !== 'string' ||
    raw.base?.repo?.full_name !== request.repository ||
    typeof raw.draft !== 'boolean' ||
    (raw.mergeable !== null && typeof raw.mergeable !== 'boolean') ||
    typeof raw.mergeable_state !== 'string' ||
    typeof raw.body !== 'string' ||
    typeof raw.head?.sha !== 'string' ||
    !FULL_HEAD.test(raw.head.sha)
  ) {
    throw new Error('merge_gate_pull_invalid')
  }
  return raw
}

export const acquireChangedPathScopeV1 = async (request, pull, host) => {
  if (pull.changed_files > MAX_PULL_FILES) throw new Error('pull_files_enumeration_limit_exceeded')
  const fileNames = new Set()
  const actualPaths = new Set()
  const pageFingerprints = new Set()
  let itemCount = 0
  let pageNumber = 1
  let terminal = false

  while (!terminal) {
    const page = await api(
      host,
      `repos/${request.repository}/pulls/${request.prNumber}/files?per_page=${PAGE_SIZE}&page=${pageNumber}`,
    )
    if (!Array.isArray(page) || page.length > PAGE_SIZE) throw new Error('pull_files_page_invalid')
    const fingerprint = JSON.stringify(page.map((item) => [item?.filename, item?.status, item?.previous_filename ?? null]))
    if (page.length > 0 && pageFingerprints.has(fingerprint)) throw new Error('pull_files_page_repeated')
    pageFingerprints.add(fingerprint)

    for (const item of page) {
      if (!item || !isNormalizedRepositoryPathV1(item.filename) || typeof item.status !== 'string') {
        throw new Error('pull_file_item_invalid')
      }
      if (fileNames.has(item.filename)) throw new Error('pull_file_item_duplicate')
      fileNames.add(item.filename)
      actualPaths.add(item.filename)
      if (item.status === 'renamed') {
        if (!isNormalizedRepositoryPathV1(item.previous_filename)) throw new Error('pull_file_rename_invalid')
        actualPaths.add(item.previous_filename)
      }
      itemCount += 1
      if (itemCount > pull.changed_files) throw new Error('pull_files_count_mismatch')
    }

    terminal = page.length < PAGE_SIZE
    pageNumber += 1
    if (pageNumber > 32) throw new Error('pull_files_terminal_page_missing')
  }

  if (itemCount !== pull.changed_files) throw new Error('pull_files_count_mismatch')
  return Object.freeze({
    complete: true,
    actual_paths: Object.freeze([...actualPaths].sort()),
    failure_reason: null,
  })
}

export const acquireTransitionStateSnapshotV1 = async (request, host) => {
  const pull = await acquirePull(request, host)
  const taskState = extractProtectedTransitionTaskStateV1(pull.body)
  const task = await acquireTaskIdentityV1(request, host)
  const scope = await acquireChangedPathScopeV1(request, pull, host)
  return Object.freeze({
    transition: request.transition,
    repository: request.repository,
    task_issue_number: request.taskIssueNumber,
    pr_number: request.prNumber,
    exact_head: request.exactHead,
    task,
    pull: Object.freeze({
      repository: request.repository,
      number: pull.number,
      state: pull.state,
      head: pull.head.sha,
    }),
    pull_body: pull.body,
    task_state: taskState,
    scope,
  })
}

const stoppedResult = (request, state, reason, exitCode, currentHead = request.exactHead) => Object.freeze({
  transition: request.transition,
  state,
  allowed: false,
  exit_code: exitCode,
  reason,
  task_issue_number: request.taskIssueNumber,
  pr_number: request.prNumber,
  current_head: currentHead,
  out_of_scope_paths: Object.freeze([]),
  state_changed: false,
})

class ReviewAutomationStop extends Error {
  constructor(state, reason, exitCode, currentHead) {
    super(reason)
    this.state = state
    this.exitCode = exitCode
    this.currentHead = currentHead
  }
}

const stoppedAutomationResult = (request, state, reason, exitCode, currentHead = request.exactHead) => Object.freeze({
  ...stoppedResult(request, state, reason, exitCode, currentHead),
  automation_status: 'STOPPED',
  admission_executed: false,
  next_action: 'STOP',
})

const skippedAutomationResult = (request, reason) => Object.freeze({
  ...stoppedResult(request, 'INDETERMINATE', reason, 0, request.exactHead),
  automation_status: 'SKIPPED',
  admission_executed: false,
  next_action: 'NONE',
})

const isReviewDecisionCandidateV1 = (body) => typeof body === 'string' &&
  /(?:^|\r?\n)record_type:[ \t]+(?:"independent_review_decision_v1"|independent_review_decision_v1)(?:\r?$)/m.test(body)

export const projectProtectedTransitionReviewStateV1 = (taskState, review) => {
  const parsed = parseProtectedTransitionTaskStateV1(taskState)
  if (
    !review ||
    review.task_issue_number !== parsed.task_issue_number ||
    review.pr_number !== parsed.pr_number ||
    typeof review.reviewed_head !== 'string' ||
    !FULL_HEAD.test(review.reviewed_head) ||
    !['APPROVE', 'CHANGES_REQUIRED', 'BLOCKED'].includes(review.decision) ||
    !Number.isSafeInteger(review.blocking_finding_count) ||
    review.blocking_finding_count < 0 ||
    !Number.isSafeInteger(review.remaining_finding_count) ||
    review.remaining_finding_count < 0 ||
    !Number.isSafeInteger(review.unknown_count) ||
    review.unknown_count < 0
  ) {
    throw new Error('review_execution_tuple_mismatch')
  }
  if (review.decision === 'APPROVE') {
    return projectProtectedTransitionApprovedReviewStateV1(parsed, review)
  }
  return Object.freeze({
    ...parsed,
    review_status: review.decision,
    reviewed_head: review.reviewed_head,
    review_blocker_count: review.blocking_finding_count,
  })
}

export const replaceProtectedTransitionTaskStateV1 = (body, candidateState) => {
  extractProtectedTransitionTaskStateV1(body)
  const projected = parseProtectedTransitionTaskStateV1(candidateState)
  const start = body.indexOf(STATE_START)
  const end = body.indexOf(STATE_END)
  const newline = body.includes('\r\n') ? '\r\n' : '\n'
  const replacement = `${STATE_START}${newline}\`\`\`json${newline}${JSON.stringify(projected)}${newline}\`\`\`${newline}${STATE_END}`
  return `${body.slice(0, start)}${replacement}${body.slice(end + STATE_END.length)}`
}

export const writeProtectedTransitionTaskStateV1 = async ({ request, host, expectedState, candidateState }) => {
  const freshPull = await acquirePull(request, host)
  if (freshPull.head.sha !== request.exactHead) {
    throw new ReviewAutomationStop('STALE', 'head_changed_before_state_write', 2, freshPull.head.sha)
  }
  const freshState = extractProtectedTransitionTaskStateV1(freshPull.body)
  if (JSON.stringify(freshState) !== JSON.stringify(expectedState)) {
    throw new ReviewAutomationStop('INDETERMINATE', 'state_changed_before_state_write', 1, freshPull.head.sha)
  }
  const candidateBody = replaceProtectedTransitionTaskStateV1(freshPull.body, candidateState)
  if (candidateBody === freshPull.body) {
    return Object.freeze({ pull: freshPull, body: candidateBody, changed: false })
  }
  await api(host, `repos/${request.repository}/pulls/${request.prNumber}`, {
    method: 'PATCH',
    body: Object.freeze({ body: candidateBody }),
  })
  const verified = await acquirePull(request, host)
  if (verified.head.sha !== request.exactHead) {
    throw new ReviewAutomationStop('STALE', 'head_changed_after_state_write', 2, verified.head.sha)
  }
  if (verified.body !== candidateBody) {
    throw new ReviewAutomationStop('INDETERMINATE', 'state_write_verification_failed', 1, verified.head.sha)
  }
  return Object.freeze({ pull: verified, body: candidateBody, changed: true })
}

const ensureOriginalStateCurrentV1 = (initial, request, review) => {
  const original = initial.task_state
  const originalBindingStale = original.observed_head !== initial.pull.head ||
    (original.review_status !== 'PENDING' && original.reviewed_head !== initial.pull.head)
  if (
    initial.pull.head !== request.exactHead ||
    (review.decision !== 'APPROVE' && originalBindingStale)
  ) {
    throw new ReviewAutomationStop('STALE', 'head_binding_stale', 2, initial.pull.head)
  }
}

const mergeGateStoppedResultV1 = (request, state, reason, exitCode, currentHead = request.exactHead) => Object.freeze({
  ...stoppedResult(request, state, reason, exitCode, currentHead),
  automation_status: 'STOPPED',
  admission_executed: true,
  next_action: 'STOP',
})

const classifyMergeGatePullV1 = (request, pull) => {
  if (pull.head.sha !== request.exactHead) {
    return mergeGateStoppedResultV1(request, 'STALE', 'head_changed_during_merge_gate', 2, pull.head.sha)
  }
  if (pull.state !== 'open' || pull.draft) {
    return mergeGateStoppedResultV1(request, 'REVIEW_PENDING', 'pull_not_ready', 2, pull.head.sha)
  }
  if (pull.mergeable === null || pull.mergeable_state === 'unknown') {
    return mergeGateStoppedResultV1(request, 'INDETERMINATE', 'pull_mergeability_indeterminate', 1, pull.head.sha)
  }
  if (!pull.mergeable || pull.mergeable_state !== 'clean') {
    return mergeGateStoppedResultV1(request, 'IMPLEMENTATION_BLOCKED', 'pull_not_mergeable', 2, pull.head.sha)
  }
  return null
}

export const evaluateMergeAllowedAutomationV1 = async ({ request, admitted, host }) => {
  try {
    if (!admitted || admitted.state !== 'MERGE_ELIGIBLE' || admitted.allowed !== true) {
      return mergeGateStoppedResultV1(request, 'INDETERMINATE', 'merge_gate_not_admitted', 1)
    }

    const initialPull = await acquireMergeGatePullV1(request, host)
    const initialPullStop = classifyMergeGatePullV1(request, initialPull)
    if (initialPullStop) return initialPullStop
    const initialState = extractProtectedTransitionTaskStateV1(initialPull.body)
    if (initialState.observed_head !== request.exactHead || initialState.reviewed_head !== request.exactHead) {
      return mergeGateStoppedResultV1(request, 'STALE', 'head_binding_stale', 2, initialPull.head.sha)
    }
    if (initialState.review_status !== 'APPROVE' || initialState.review_blocker_count !== 0) {
      return mergeGateStoppedResultV1(request, 'REVIEW_BLOCKED', 'review_not_approved', 2, initialPull.head.sha)
    }

    const checks = await acquireMergeCheckRollupV1(request, host)
    if (checks.length === 0) {
      return mergeGateStoppedResultV1(request, 'INDETERMINATE', 'checks_missing', 1, initialPull.head.sha)
    }
    if (checks.some((item) => item.type === 'CheckRun' && item.status !== 'COMPLETED')) {
      return mergeGateStoppedResultV1(request, 'INDETERMINATE', 'checks_not_terminal', 1, initialPull.head.sha)
    }
    if (checks.some((item) =>
      (item.type === 'CheckRun' && item.conclusion !== 'SUCCESS') ||
      (item.type === 'StatusContext' && item.state !== 'SUCCESS')
    )) {
      return mergeGateStoppedResultV1(request, 'IMPLEMENTATION_BLOCKED', 'checks_not_successful', 2, initialPull.head.sha)
    }

    const reviewSnapshot = await acquireMergeReviewThreadsV1(request, host)
    if (reviewSnapshot.pull.headRefOid !== request.exactHead) {
      return mergeGateStoppedResultV1(request, 'STALE', 'head_changed_during_merge_gate', 2, reviewSnapshot.pull.headRefOid)
    }
    if (reviewSnapshot.pull.state !== 'OPEN' || reviewSnapshot.pull.isDraft) {
      return mergeGateStoppedResultV1(request, 'REVIEW_PENDING', 'pull_not_ready', 2, reviewSnapshot.pull.headRefOid)
    }
    if (reviewSnapshot.pull.mergeable === 'UNKNOWN' || reviewSnapshot.pull.mergeStateStatus === 'UNKNOWN') {
      return mergeGateStoppedResultV1(request, 'INDETERMINATE', 'pull_mergeability_indeterminate', 1, reviewSnapshot.pull.headRefOid)
    }
    if (reviewSnapshot.pull.mergeable !== 'MERGEABLE' || reviewSnapshot.pull.mergeStateStatus !== 'CLEAN') {
      return mergeGateStoppedResultV1(request, 'IMPLEMENTATION_BLOCKED', 'pull_not_mergeable', 2, reviewSnapshot.pull.headRefOid)
    }
    if (reviewSnapshot.threads.some((thread) => !thread.isResolved && !thread.isOutdated)) {
      return mergeGateStoppedResultV1(request, 'REVIEW_BLOCKED', 'blocking_review_threads_present', 2, reviewSnapshot.pull.headRefOid)
    }

    const finalPull = await acquireMergeGatePullV1(request, host)
    const finalPullStop = classifyMergeGatePullV1(request, finalPull)
    if (finalPullStop) return finalPullStop
    const finalState = extractProtectedTransitionTaskStateV1(finalPull.body)
    if (JSON.stringify(finalState) !== JSON.stringify(initialState)) {
      return mergeGateStoppedResultV1(request, 'INDETERMINATE', 'state_changed_during_merge_gate', 1, finalPull.head.sha)
    }

    return Object.freeze({
      ...admitted,
      reason: 'merge_gate_satisfied',
      automation_status: 'MERGE_ALLOWED',
      admission_executed: true,
      next_action: 'MERGE_OPERATOR',
    })
  } catch (error) {
    return mergeGateStoppedResultV1(
      request,
      'INDETERMINATE',
      error instanceof Error ? error.message : 'merge_gate_acquisition_failed',
      1,
    )
  }
}

const completeApprovedAutomationV1 = async ({ request, host, stateChanged }) => {
  const admitted = await executeProtectedTransitionAdmissionV1({ request, host })
  if (!admitted.allowed) {
    return Object.freeze({
      ...admitted,
      state_changed: stateChanged,
      automation_status: 'UPDATED_AND_STOPPED',
      admission_executed: true,
      next_action: 'STOP',
    })
  }
  const mergeAllowed = await evaluateMergeAllowedAutomationV1({ request, admitted, host })
  return Object.freeze({
    ...mergeAllowed,
    state_changed: stateChanged,
  })
}

export const executeReviewApprovalAutomationV1 = async ({ event, host }) => {
  let parsedEvent
  let request
  try {
    if (!isReviewDecisionCandidateV1(event?.comment?.body)) {
      return skippedAutomationResult(Object.freeze({
        transition: 'merge_decision_admission',
        taskIssueNumber: event?.issue?.number ?? null,
        prNumber: null,
        exactHead: null,
      }), 'review_event_not_applicable')
    }
    parsedEvent = parseReviewApprovalEventV1(event)
    request = Object.freeze({
      transition: 'merge_decision_admission',
      repository: parsedEvent.repository,
      taskIssueNumber: parsedEvent.taskIssueNumber,
      prNumber: parsedEvent.prNumber,
      exactHead: parsedEvent.exactHead,
    })
    const triggeringReview = parsedEvent.review
    if (
      triggeringReview.decision === 'APPROVE' && (
        triggeringReview.blocking_finding_count !== 0 ||
        triggeringReview.remaining_finding_count !== 0 ||
        triggeringReview.unknown_count !== 0
      )
    ) {
      return stoppedAutomationResult(request, 'REVIEW_BLOCKED', 'review_not_approvable', 2)
    }

    const effective = await resolveEffectiveReviewDecisionV1({ request, parsedEvent, host })
    if (effective.commentId !== parsedEvent.commentId) {
      return skippedAutomationResult(request, 'review_event_superseded')
    }
    const review = effective.review

    const initial = await acquireTransitionStateSnapshotV1(request, host)
    ensureOriginalStateCurrentV1(initial, request, review)
    const candidateState = projectProtectedTransitionReviewStateV1(initial.task_state, review)
    const candidateInput = Object.freeze({ ...initial, task_state: candidateState })
    const preflight = evaluateProtectedTransitionAdmissionV1(candidateInput)
    const expectedState = review.decision === 'APPROVE' ? 'MERGE_ELIGIBLE' : 'REVIEW_BLOCKED'
    if (preflight.state !== expectedState || (review.decision === 'APPROVE' && !preflight.allowed)) {
      return Object.freeze({
        ...preflight,
        automation_status: 'STOPPED',
        admission_executed: false,
        next_action: 'STOP',
      })
    }

    const alreadyConverged = JSON.stringify(initial.task_state) === JSON.stringify(candidateState)
    if (alreadyConverged) {
      if (review.decision === 'APPROVE') {
        return completeApprovedAutomationV1({ request, host, stateChanged: false })
      }
      return Object.freeze({
        ...preflight,
        automation_status: 'ALREADY_CONVERGED',
        admission_executed: false,
        next_action: preflight.allowed ? 'MERGE_DECISION' : 'STOP',
      })
    }

    const confirmed = await resolveEffectiveReviewDecisionV1({ request, parsedEvent, host })
    if (confirmed.commentId !== effective.commentId) {
      return skippedAutomationResult(request, 'review_event_superseded_before_write')
    }

    const written = await writeProtectedTransitionTaskStateV1({
      request,
      host,
      expectedState: initial.task_state,
      candidateState,
    })
    if (!written.changed) {
      if (review.decision === 'APPROVE') {
        return completeApprovedAutomationV1({ request, host, stateChanged: false })
      }
      return Object.freeze({
        ...preflight,
        automation_status: 'ALREADY_CONVERGED',
        admission_executed: false,
        next_action: preflight.allowed ? 'MERGE_DECISION' : 'STOP',
      })
    }
    if (review.decision !== 'APPROVE') {
      return Object.freeze({
        ...preflight,
        state_changed: true,
        automation_status: 'UPDATED_AND_STOPPED',
        admission_executed: false,
        next_action: 'STOP',
      })
    }
    return completeApprovedAutomationV1({ request, host, stateChanged: true })
  } catch (error) {
    const fallbackRequest = request ?? Object.freeze({
      transition: 'merge_decision_admission',
      repository: parsedEvent?.repository ?? null,
      taskIssueNumber: parsedEvent?.taskIssueNumber ?? null,
      prNumber: parsedEvent?.prNumber ?? null,
      exactHead: parsedEvent?.exactHead ?? null,
    })
    if (error instanceof ReviewAutomationStop) {
      return stoppedAutomationResult(
        fallbackRequest,
        error.state,
        error.message,
        error.exitCode,
        error.currentHead ?? fallbackRequest.exactHead,
      )
    }
    return stoppedAutomationResult(
      fallbackRequest,
      'INDETERMINATE',
      error instanceof Error ? error.message : 'review_automation_failed',
      1,
    )
  }
}

export const executeProtectedTransitionAdmissionV1 = async ({ request, host }) => {
  try {
    const initial = await acquireTransitionStateSnapshotV1(request, host)
    const evaluated = evaluateProtectedTransitionAdmissionV1(initial)
    if (!evaluated.allowed) return evaluated

    const latePull = await acquirePull(request, host)
    if (latePull.head.sha !== initial.pull.head) {
      return stoppedResult(request, 'STALE', 'head_changed_during_evaluation', 2, latePull.head.sha)
    }
    const lateState = extractProtectedTransitionTaskStateV1(latePull.body)
    if (JSON.stringify(lateState) !== JSON.stringify(initial.task_state)) {
      return stoppedResult(request, 'INDETERMINATE', 'state_changed_during_evaluation', 1, latePull.head.sha)
    }
    return evaluated
  } catch (error) {
    return stoppedResult(
      request,
      'INDETERMINATE',
      error instanceof Error ? error.message : 'acquisition_failed',
      1,
    )
  }
}

const parseManualCli = (argv, environment) => {
  const values = new Map()
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index]
    const value = argv[index + 1]
    if (!key?.startsWith('--') || value === undefined || values.has(key)) throw new Error('cli_arguments_invalid')
    values.set(key, value)
  }
  const expected = ['--transition', '--task-issue-number', '--pr-number', '--exact-head']
  if (values.size !== expected.length || expected.some((key) => !values.has(key))) throw new Error('cli_arguments_invalid')
  const transition = values.get('--transition')
  const taskIssueNumber = Number(values.get('--task-issue-number'))
  const prNumber = Number(values.get('--pr-number'))
  const exactHead = values.get('--exact-head')
  const repository = environment.GITHUB_REPOSITORY
  if (
    (transition !== 'terminal_review_admission' && transition !== 'merge_decision_admission') ||
    !positiveInteger(taskIssueNumber) ||
    !positiveInteger(prNumber) ||
    !FULL_HEAD.test(exactHead ?? '') ||
    !REPOSITORY.test(repository ?? '')
  ) {
    throw new Error('cli_arguments_invalid')
  }
  return Object.freeze({ transition, taskIssueNumber, prNumber, exactHead, repository })
}

const parseInvocation = (argv, environment) => {
  if (argv.length === 2 && argv[0] === '--review-event-file' && typeof argv[1] === 'string' && argv[1].length > 0) {
    return Object.freeze({ mode: 'review_event', eventFile: argv[1] })
  }
  return Object.freeze({ mode: 'manual', request: parseManualCli(argv, environment) })
}

const productionHost = (environment) => {
  const token = environment.GH_TOKEN
  if (!token) throw new Error('github_token_missing')
  return Object.freeze({
    api: async (endpoint, options = undefined) => {
      const response = await fetch(`https://api.github.com/${endpoint}`, {
        method: options?.method ?? 'GET',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'protected-transition-admission-v1',
        },
        ...(options?.body ? { body: JSON.stringify(options.body) } : {}),
      })
      if (!response.ok) throw new Error(`github_api_${response.status}`)
      return response.status === 204 ? null : response.json()
    },
    graphql: async (query, variables) => {
      const response = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'protected-transition-admission-v1',
        },
        body: JSON.stringify({ query, variables }),
      })
      if (!response.ok) throw new Error(`github_graphql_${response.status}`)
      const payload = await response.json()
      if (!payload || !payload.data || (Array.isArray(payload.errors) && payload.errors.length > 0)) {
        throw new Error('github_graphql_invalid')
      }
      return payload.data
    },
  })
}

const main = async () => {
  let invocation
  try {
    invocation = parseInvocation(process.argv.slice(2), process.env)
    const host = productionHost(process.env)
    const result = invocation.mode === 'review_event'
      ? await executeReviewApprovalAutomationV1({
          event: JSON.parse(readFileSync(invocation.eventFile, 'utf8')),
          host,
        })
      : await executeProtectedTransitionAdmissionV1({ request: invocation.request, host })
    process.stdout.write(`${JSON.stringify(result)}\n`)
    process.exitCode = result.exit_code
  } catch (error) {
    const request = invocation?.mode === 'manual' ? invocation.request : null
    const diagnostic = {
      transition: request?.transition ?? null,
      state: 'INDETERMINATE',
      allowed: false,
      exit_code: 1,
      reason: error instanceof Error ? error.message : 'runner_failed',
      task_issue_number: request?.taskIssueNumber ?? null,
      pr_number: request?.prNumber ?? null,
      current_head: request?.exactHead ?? null,
      out_of_scope_paths: [],
      state_changed: false,
    }
    process.stdout.write(`${JSON.stringify(diagnostic)}\n`)
    process.exitCode = 1
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : ''
if (invokedPath === fileURLToPath(import.meta.url)) await main()
