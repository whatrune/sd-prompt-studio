import { execFileSync } from 'node:child_process'
import { lstatSync, readFileSync, realpathSync } from 'node:fs'
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
const READY_CHECK_WAIT_ATTEMPTS = 3
const READY_CHECK_WAIT_MS = 10_000
const WORKFLOW_RUN_ID = /^[1-9]\d*$/
const REVIEW_RECORD_TYPE = 'independent_review_decision_v1'
const REVIEW_AUTHORING_ROLE = 'Independent Reviewer'
const REVIEW_ASSOCIATIONS = new Set(['OWNER', 'MEMBER', 'COLLABORATOR'])
const STRICT_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/
const REPAIR_EXECUTOR_INSTRUCTION = 'Generate and apply the minimum repair for current blocking findings only within current authorized_paths; stop on an Architecture gap.'
const REPAIR_COMMIT_MESSAGE = 'fix current protected transition blockers'
const REPAIR_PROVIDER_PROMPT_MAX_BYTES_V2 = 16_384
const CODEX_CLI_VERSION_V3 = 'codex-cli 0.147.0'
const CODEX_CHATGPT_LOGIN_STATUS_V3 = 'Logged in using ChatGPT'
const REPAIR_PROVIDER_CONSTRAINTS_V3 = 'Use only the Executor-supplied authorized-file snapshots. Do not run repository discovery, git, pwsh, gh, validation, test, build, stage, commit, push, mutate PR/state, or redesign Architecture; generate and apply only the minimum authorized patch, leave a non-empty unstaged diff, and stop on an Architecture gap.'
const PROTECTED_TRANSITION_REPAIR_PATHS_V1 = Object.freeze([
  '.github/workflows/protected-transition-admission-v1.yml',
  'scripts/run-protected-transition-admission-v1.mjs',
  'scripts/test-protected-transition-admission-v1.mjs',
  'src/continuous-orchestration/protected-transition-admission-v1.ts',
])
const REPAIR_VALIDATION_COMMANDS_V1 = Object.freeze({
  docs_only: Object.freeze([
    'node scripts/test-role-execution-contracts.mjs',
    'git diff --check',
  ]),
  protected_transition: Object.freeze([
    'node scripts/test-protected-transition-admission-v1.mjs',
    'node scripts/test-role-execution-contracts.mjs',
    'pnpm run validate:dictionary',
    'pnpm test',
    'pnpm run build',
    'git diff --check',
  ]),
})
const MERGE_CHECKS_QUERY = `
query MergeAllowedChecks($owner: String!, $name: String!, $pr: Int!, $head: GitObjectID!, $after: String) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $pr) { headRefOid }
    object(oid: $head) {
      ... on Commit {
        oid
        statusCheckRollup {
          contexts(first: 100, after: $after) {
            totalCount
            nodes {
              __typename
              ... on CheckRun { id name status conclusion detailsUrl startedAt checkSuite { app { id } } }
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

const acquireMergeCheckRollupSnapshotV1 = async (request, host, { stopOnPullHeadDrift = false } = {}) => {
  const { owner, name } = repositoryPartsV1(request.repository)
  const nodes = []
  const nodeIds = new Set()
  const cursors = new Set()
  let expectedTotal = null
  let expectedPullHead = null
  let after = null
  let pageNumber = 1

  while (true) {
    const data = await graphql(host, MERGE_CHECKS_QUERY, { owner, name, pr: request.prNumber, head: request.exactHead, after })
    const pullHead = data?.repository?.pullRequest?.headRefOid
    const commit = data?.repository?.object
    const connection = commit?.statusCheckRollup?.contexts
    if (
      typeof pullHead !== 'string' ||
      !FULL_HEAD.test(pullHead) ||
      commit?.oid !== request.exactHead ||
      !connection ||
      !Number.isSafeInteger(connection.totalCount) ||
      connection.totalCount < 0 ||
      !Array.isArray(connection.nodes) ||
      connection.nodes.length > PAGE_SIZE
    ) {
      throw new Error('check_rollup_page_invalid')
    }
    if (expectedPullHead === null) expectedPullHead = pullHead
    if (expectedPullHead !== pullHead) {
      if (stopOnPullHeadDrift) {
        throw new ReviewAutomationStop('STALE', 'head_changed_during_merge_gate', 2, pullHead)
      }
      throw new Error('check_rollup_pull_head_changed')
    }
    if (expectedTotal === null) expectedTotal = connection.totalCount
    if (expectedTotal !== connection.totalCount) throw new Error('check_rollup_total_changed')

    for (const node of connection.nodes) {
      if (!node || typeof node.id !== 'string' || node.id.length === 0 || nodeIds.has(node.id)) {
        throw new Error('check_rollup_context_invalid')
      }
      nodeIds.add(node.id)
      if (node.__typename === 'CheckRun') {
        const detailsUrl = node.detailsUrl ?? null
        if (
          typeof node.name !== 'string' ||
          node.name.length === 0 ||
          typeof node.status !== 'string' ||
          (node.conclusion !== null && typeof node.conclusion !== 'string') ||
          (detailsUrl !== null && typeof detailsUrl !== 'string')
        ) {
          throw new Error('check_rollup_context_invalid')
        }
        nodes.push(Object.freeze({
          type: 'CheckRun',
          id: node.id,
          name: node.name,
          status: node.status,
          conclusion: node.conclusion,
          details_url: detailsUrl,
          app_id: node.checkSuite?.app?.id ?? null,
          started_at: node.startedAt ?? null,
        }))
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
  return Object.freeze({ headRefOid: expectedPullHead, checks: Object.freeze(nodes) })
}

export const acquireMergeCheckRollupV1 = async (request, host) =>
  (await acquireMergeCheckRollupSnapshotV1(request, host)).checks

const partitionReadyRunChecksV1 = (request, checks) => {
  const runId = request.currentWorkflowRunId
  if (!WORKFLOW_RUN_ID.test(runId ?? '')) throw new Error('ready_workflow_run_id_invalid')
  const prefix = `https://github.com/${request.repository}/actions/runs/${runId}/`
  const current = checks.filter((item) => item.type === 'CheckRun' && item.details_url?.startsWith(prefix))
  if (current.length > 1) throw new Error('ready_current_check_cardinality_invalid')
  const currentIds = new Set(current.map((item) => item.id))
  return Object.freeze({
    current: Object.freeze(current),
    remaining: Object.freeze(checks.filter((item) => !currentIds.has(item.id))),
  })
}

const readyCheckIsPendingV1 = (item) =>
  (item.type === 'CheckRun' && item.status !== 'COMPLETED') ||
  (item.type === 'StatusContext' && ['PENDING', 'EXPECTED'].includes(item.state))

const readyCheckHasFailedV1 = (item) =>
  (item.type === 'CheckRun' && item.status === 'COMPLETED' && item.conclusion !== 'SUCCESS') ||
  (item.type === 'StatusContext' && !['SUCCESS', 'PENDING', 'EXPECTED'].includes(item.state))

const waitForReadyTerminalChecksV1 = async (request, host) => {
  for (let attempt = 1; attempt <= READY_CHECK_WAIT_ATTEMPTS; attempt += 1) {
    const pull = await acquirePull(request, host)
    if (pull.head.sha !== request.exactHead) {
      throw new ReviewAutomationStop('STALE', 'head_changed_while_waiting_for_checks', 2, pull.head.sha)
    }

    const rollup = await acquireMergeCheckRollupV1(request, host)
    let checks = null
    try {
      checks = reduceSelfAwareCurrentChecksV1(request, rollup)
    } catch (error) {
      if (error?.message !== 'ready_current_check_missing') throw error
    }
    if (checks !== null && checks.length > 0) {
      if (checks.some(readyCheckHasFailedV1)) {
        throw new ReviewAutomationStop('IMPLEMENTATION_BLOCKED', 'checks_not_successful', 2, pull.head.sha)
      }
      if (!checks.some(readyCheckIsPendingV1)) return
    }

    if (attempt === READY_CHECK_WAIT_ATTEMPTS) {
      const reason = checks === null ? 'ready_current_check_missing' : checks.length === 0 ? 'checks_missing' : 'checks_not_terminal'
      throw new ReviewAutomationStop('INDETERMINATE', reason, 1, pull.head.sha)
    }
    if (typeof host.wait === 'function') await host.wait(READY_CHECK_WAIT_MS)
    else await new Promise((resolve) => setTimeout(resolve, READY_CHECK_WAIT_MS))
  }
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

const progressionBlockedResultV1 = (currentResult, reason) => Object.freeze({
  ...currentResult,
  allowed: false,
  exit_code: currentResult?.state === 'INDETERMINATE' ? 1 : 2,
  reason,
  automation_status: 'BLOCKED',
  next_action: 'STOP',
})

export const projectRepairExecutorDispatchV1 = (currentContext) => {
  const request = currentContext?.request
  const review = currentContext?.review
  const commentId = currentContext?.review_comment_id
  const scope = currentContext?.scope
  let taskState
  try {
    taskState = parseProtectedTransitionTaskStateV1(currentContext?.task_state)
  } catch {
    throw new Error('repair_task_state_invalid')
  }

  if (
    !request ||
    !REPOSITORY.test(request.repository ?? '') ||
    !positiveInteger(request.taskIssueNumber) ||
    !positiveInteger(request.prNumber) ||
    !FULL_HEAD.test(request.exactHead ?? '') ||
    currentContext?.effective_review_current !== true ||
    !positiveInteger(commentId) ||
    typeof currentContext?.review_body !== 'string' ||
    currentContext.review_body.length === 0
  ) {
    throw new Error('repair_current_tuple_invalid')
  }
  if (
    taskState.task_issue_number !== request.taskIssueNumber ||
    taskState.pr_number !== request.prNumber ||
    taskState.observed_head !== request.exactHead ||
    taskState.reviewed_head !== request.exactHead
  ) {
    throw new Error('repair_head_binding_stale')
  }
  if (taskState.architecture_status !== 'APPROVED') throw new Error('repair_architecture_not_approved')
  if (taskState.implementation_authorized !== true) throw new Error('repair_implementation_not_authorized')
  if (
    !review ||
    review.task_issue_number !== request.taskIssueNumber ||
    review.pr_number !== request.prNumber ||
    review.reviewed_head !== request.exactHead
  ) {
    throw new Error('repair_review_tuple_mismatch')
  }
  if (review.decision !== 'CHANGES_REQUIRED') throw new Error('repair_decision_not_changes_required')
  if (!positiveInteger(review.blocking_finding_count)) throw new Error('repair_blocker_count_invalid')
  if (review.remaining_finding_count !== review.blocking_finding_count) throw new Error('repair_remaining_count_mismatch')
  if (review.unknown_count !== 0) throw new Error('repair_review_unknown')
  if (
    scope?.complete !== true ||
    !Array.isArray(scope.actual_paths) ||
    scope.actual_paths.some((value) => !isNormalizedRepositoryPathV1(value)) ||
    new Set(scope.actual_paths).size !== scope.actual_paths.length
  ) {
    throw new Error('repair_scope_incomplete')
  }
  const authorizedPaths = new Set(taskState.authorized_paths)
  if (scope.actual_paths.some((value) => !authorizedPaths.has(value))) {
    throw new Error('repair_scope_outside_authorized_paths')
  }

  return Object.freeze({
    repository: request.repository,
    task_issue_number: request.taskIssueNumber,
    pr_number: request.prNumber,
    exact_head: request.exactHead,
    review_decision_url: `https://github.com/${request.repository}/issues/${request.taskIssueNumber}#issuecomment-${commentId}`,
    review_body: currentContext.review_body,
    authorized_paths: Object.freeze([...taskState.authorized_paths]),
    next_action: 'REPAIR_EXECUTOR',
    instruction: REPAIR_EXECUTOR_INSTRUCTION,
  })
}

const isRepairProfileControlV1 = (character) => {
  const codePoint = character.codePointAt(0)
  return codePoint <= 0x1F || codePoint === 0x7F
}

export const isRepairProfilePathV1 = (value) =>
  isNormalizedRepositoryPathV1(value) &&
  !Array.from(value).some(isRepairProfileControlV1)

const repairArchitectureGapV1 = (detail) => Object.freeze({
  state: 'INDETERMINATE',
  allowed: false,
  exit_code: 1,
  reason: 'repair_validation_profile_architecture_gap',
  detail,
  automation_status: 'BLOCKED',
  next_action: 'STOP',
})

const repairPathSetV1 = (value, label) => {
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => !isRepairProfilePathV1(item))) {
    throw new Error(`${label}_invalid`)
  }
  if (new Set(value).size !== value.length) throw new Error(`${label}_duplicate`)
  return Object.freeze([...value].sort())
}

export const selectRepairValidationProfileV1 = ({ authorizedPaths, currentPaths, repairPaths = currentPaths }) => {
  try {
    const authorized = repairPathSetV1(authorizedPaths, 'authorized_paths')
    const current = repairPathSetV1(currentPaths, 'current_paths')
    const repair = repairPathSetV1(repairPaths, 'repair_paths')
    const authorizedSet = new Set(authorized)
    if (current.some((item) => !authorizedSet.has(item)) || repair.some((item) => !authorizedSet.has(item))) {
      throw new Error('repair_scope_outside_authorized_paths')
    }
    const allPaths = [...authorized, ...current, ...repair]
    const docsOnly = allPaths.every((item) => item.startsWith('docs/') && item.endsWith('.md'))
    const protectedPaths = new Set(PROTECTED_TRANSITION_REPAIR_PATHS_V1)
    const protectedTransition = allPaths.every((item) => protectedPaths.has(item))
    const profiles = [
      ...(docsOnly ? ['docs_only'] : []),
      ...(protectedTransition ? ['protected_transition'] : []),
    ]
    if (profiles.length !== 1) throw new Error('profile_cardinality_invalid')
    const name = profiles[0]
    return Object.freeze({
      name,
      commands: REPAIR_VALIDATION_COMMANDS_V1[name],
      authorized_paths: authorized,
      current_paths: current,
      repair_paths: repair,
    })
  } catch (error) {
    return repairArchitectureGapV1(error instanceof Error ? error.message : 'profile_selection_failed')
  }
}

const validateRepairDispatchV1 = (dispatch) => {
  if (
    !dispatch ||
    !REPOSITORY.test(dispatch.repository ?? '') ||
    !positiveInteger(dispatch.task_issue_number) ||
    !positiveInteger(dispatch.pr_number) ||
    !FULL_HEAD.test(dispatch.exact_head ?? '') ||
    typeof dispatch.review_decision_url !== 'string' ||
    typeof dispatch.review_body !== 'string' ||
    dispatch.review_body.length === 0 ||
    dispatch.next_action !== 'REPAIR_EXECUTOR' ||
    dispatch.instruction !== REPAIR_EXECUTOR_INSTRUCTION
  ) {
    throw new Error('repair_dispatch_invalid')
  }
  repairPathSetV1(dispatch.authorized_paths, 'authorized_paths')
  return dispatch
}

const validateRepairPullV1 = (dispatch, pull, expectedHead = dispatch.exact_head) => {
  if (
    pull?.number !== dispatch.pr_number ||
    pull.state !== 'open' ||
    pull.base?.repo?.full_name !== dispatch.repository ||
    pull.head?.repo?.full_name !== dispatch.repository ||
    pull.head?.sha !== expectedHead ||
    typeof pull.head?.ref !== 'string' ||
    pull.head.ref.length === 0 ||
    !Number.isSafeInteger(pull.changed_files) ||
    pull.changed_files < 0
  ) {
    throw new Error('repair_pull_binding_invalid')
  }
  return pull
}

const repairRequestV1 = (dispatch, exactHead = dispatch.exact_head) => Object.freeze({
  transition: 'merge_decision_admission',
  repository: dispatch.repository,
  taskIssueNumber: dispatch.task_issue_number,
  prNumber: dispatch.pr_number,
  exactHead,
})

const repairAuthorizedFileSnapshotsV1 = (authorizedPaths, snapshots) => {
  if (!Array.isArray(snapshots) || snapshots.length !== authorizedPaths.length) {
    throw new Error('repair_authorized_snapshots_invalid')
  }
  const normalized = snapshots.map((snapshot, index) => {
    if (
      !snapshot ||
      snapshot.path !== authorizedPaths[index] ||
      typeof snapshot.content !== 'string'
    ) {
      throw new Error('repair_authorized_snapshots_invalid')
    }
    return Object.freeze({ path: snapshot.path, content: snapshot.content })
  })
  return Object.freeze(normalized)
}

export const materializeRepairAuthorizedFileSnapshotsV1 = ({
  authorizedPaths,
  workspacePath,
  resolvePath = (root, repositoryPath) => path.resolve(root, ...repositoryPath.split('/')),
  realPath = (resolvedPath) => realpathSync(resolvedPath),
  statPath = (resolvedPath) => lstatSync(resolvedPath),
  readBytes = (resolvedPath) => readFileSync(resolvedPath),
}) => {
  const normalizedPaths = repairPathSetV1(authorizedPaths, 'authorized_paths')
  if (
    typeof workspacePath !== 'string' ||
    workspacePath.length === 0 ||
    /[\u0000-\u001f\u007f]/u.test(workspacePath) ||
    !path.isAbsolute(workspacePath)
  ) {
    throw new Error('repair_snapshot_workspace_invalid')
  }
  const workspaceRoot = path.resolve(workspacePath)
  let physicalWorkspaceRoot
  try {
    physicalWorkspaceRoot = realPath(workspaceRoot)
  } catch {
    throw new Error('repair_snapshot_workspace_invalid')
  }
  const snapshots = normalizedPaths.map((repositoryPath) => {
    let resolvedPath
    try {
      resolvedPath = resolvePath(workspaceRoot, repositoryPath)
    } catch {
      throw new Error('repair_snapshot_path_escape')
    }
    if (typeof resolvedPath !== 'string' || resolvedPath.length === 0) {
      throw new Error('repair_snapshot_path_escape')
    }
    const relativePath = path.relative(workspaceRoot, path.resolve(resolvedPath))
    if (relativePath === '' || relativePath === '..' || relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath)) {
      throw new Error('repair_snapshot_path_escape')
    }
    let status
    try {
      status = statPath(resolvedPath, repositoryPath)
    } catch {
      throw new Error('repair_snapshot_file_missing')
    }
    if (!status || typeof status.isFile !== 'function' || !status.isFile()) {
      throw new Error('repair_snapshot_file_not_regular')
    }
    let physicalResolvedPath
    try {
      physicalResolvedPath = realPath(resolvedPath, repositoryPath)
    } catch {
      throw new Error('repair_snapshot_file_unreadable')
    }
    const physicalRelativePath = path.relative(physicalWorkspaceRoot, path.resolve(physicalResolvedPath))
    if (physicalRelativePath === '' || physicalRelativePath === '..' || physicalRelativePath.startsWith(`..${path.sep}`) || path.isAbsolute(physicalRelativePath)) {
      throw new Error('repair_snapshot_path_escape')
    }
    let value
    try {
      value = readBytes(resolvedPath, repositoryPath)
    } catch {
      throw new Error('repair_snapshot_file_unreadable')
    }
    if (!Buffer.isBuffer(value) && !(value instanceof Uint8Array)) {
      throw new Error('repair_snapshot_file_unreadable')
    }
    const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value)
    let content
    try {
      content = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes)
    } catch {
      throw new Error('repair_snapshot_utf8_invalid')
    }
    if (!Buffer.from(content, 'utf8').equals(bytes)) {
      throw new Error('repair_snapshot_utf8_invalid')
    }
    return Object.freeze({ path: repositoryPath, content })
  })
  return repairAuthorizedFileSnapshotsV1(normalizedPaths, snapshots)
}

const repairProviderPromptV2 = (dispatch, authorizedPaths, authorizedFileSnapshots = undefined) => {
  const snapshotSection = authorizedFileSnapshots === undefined
    ? ''
    : `\n\nCurrent authorized-file snapshots (strict UTF-8 JSON):\n${JSON.stringify(repairAuthorizedFileSnapshotsV1(authorizedPaths, authorizedFileSnapshots))}`
  const prompt = `${dispatch.instruction}\n${REPAIR_PROVIDER_CONSTRAINTS_V3}\n\nCurrent repair tuple:\nRepository: ${dispatch.repository}\nTask: #${dispatch.task_issue_number}\nPR: #${dispatch.pr_number}\nExact HEAD: ${dispatch.exact_head}\n\nCurrent authorized_paths:\n${JSON.stringify(authorizedPaths)}\n\nCurrent review decision:\n${dispatch.review_body}${snapshotSection}`
  if (Buffer.byteLength(prompt, 'utf8') > REPAIR_PROVIDER_PROMPT_MAX_BYTES_V2) {
    throw new Error('repair_provider_prompt_too_large')
  }
  return prompt
}

export const projectSelfHostedWindowsRepairProviderV3 = ({
  providerBranch,
  prompt,
  cliVersion,
  loginStatus,
  runAttempt,
  workspacePath,
}) => {
  if (
    typeof providerBranch !== 'string' ||
    providerBranch.length === 0 ||
    /[\u0000-\u001f\u007f]/u.test(providerBranch) ||
    typeof prompt !== 'string' ||
    prompt.length === 0 ||
    Buffer.byteLength(prompt, 'utf8') > REPAIR_PROVIDER_PROMPT_MAX_BYTES_V2 ||
    typeof workspacePath !== 'string' ||
    workspacePath.length === 0 ||
    /[\u0000-\u001f\u007f]/u.test(workspacePath)
  ) {
    throw new Error('repair_provider_projection_invalid')
  }
  if (cliVersion !== CODEX_CLI_VERSION_V3) throw new Error('repair_provider_cli_version_invalid')
  if (loginStatus !== CODEX_CHATGPT_LOGIN_STATUS_V3) throw new Error('repair_provider_chatgpt_login_required')
  if (runAttempt !== 1) throw new Error('repair_provider_rerun_forbidden')
  return Object.freeze({
    provider: 'self_hosted_windows_chatgpt_codex_cli_v3',
    runner_labels: Object.freeze(['self-hosted', 'Windows', 'X64']),
    cli_version: CODEX_CLI_VERSION_V3,
    login_status: CODEX_CHATGPT_LOGIN_STATUS_V3,
    provider_branch: providerBranch,
    prompt_bytes: Buffer.byteLength(prompt, 'utf8'),
    invocation_count: 1,
    exec_argv: Object.freeze(['exec', '-c', 'features.shell_tool=false', '-c', 'sandbox_workspace_write.network_access=false', '-c', 'sandbox_workspace_write.writable_roots=[]', '--sandbox', 'workspace-write', '--ephemeral', '--json', '--cd', workspacePath, '-']),
  })
}

export const executeRepairProviderBindingV3 = async ({
  boundary,
  dispatch,
  host,
  localPaths,
  providerBranch = undefined,
  cliVersion = undefined,
  loginStatus = undefined,
  runAttempt,
  workspacePath = undefined,
  readAuthorizedSnapshots = undefined,
}) => {
  try {
    validateRepairDispatchV1(dispatch)
    if (boundary !== 'pre_exec' && boundary !== 'post_exec') throw new Error('repair_provider_boundary_invalid')
    const request = repairRequestV1(dispatch)
    const pull = validateRepairPullV1(dispatch, await acquirePull(request, host))
    const canonicalBranch = pull.head.ref
    if (boundary === 'post_exec' && providerBranch !== canonicalBranch) {
      throw new Error('repair_provider_branch_changed')
    }
    if (await host.branchHead(dispatch.repository, canonicalBranch) !== dispatch.exact_head) {
      throw new Error('repair_remote_head_changed')
    }
    if (!Array.isArray(localPaths)) throw new Error('repair_provider_worktree_invalid')
    if (boundary === 'pre_exec' && localPaths.length !== 0) throw new Error('repair_provider_worktree_not_clean')
    if (boundary === 'post_exec' && localPaths.length === 0) throw new Error('repair_provider_diff_missing')
    const authorizedPaths = repairPathSetV1(dispatch.authorized_paths, 'authorized_paths')
    let authorizedFileSnapshots
    if (boundary === 'pre_exec') {
      if (typeof readAuthorizedSnapshots !== 'function') throw new Error('repair_snapshot_reader_invalid')
      authorizedFileSnapshots = await readAuthorizedSnapshots({
        authorizedPaths,
        exactHead: dispatch.exact_head,
        workspacePath,
      })
    }
    const prompt = repairProviderPromptV2(dispatch, authorizedPaths, authorizedFileSnapshots)
    const projection = boundary === 'pre_exec'
      ? projectSelfHostedWindowsRepairProviderV3({
          providerBranch: canonicalBranch,
          prompt,
          cliVersion,
          loginStatus,
          runAttempt,
          workspacePath,
        })
      : undefined
    return Object.freeze({
      state: 'REVIEW_BLOCKED',
      allowed: false,
      exit_code: 0,
      reason: boundary === 'pre_exec' ? 'repair_provider_exec_binding_satisfied' : 'repair_provider_post_exec_binding_satisfied',
      automation_status: boundary === 'pre_exec' ? 'PROVIDER_EXEC_READY' : 'PROVIDER_DIFF_READY',
      next_action: boundary === 'pre_exec' ? 'EXECUTE_REPAIR_AGENT' : 'PROJECT_PROVIDER_COMPLETION',
      exact_head: dispatch.exact_head,
      provider_branch: canonicalBranch,
      prompt,
      ...(projection ? { provider_projection: projection } : {}),
    })
  } catch (error) {
    return Object.freeze({
      state: 'INDETERMINATE',
      allowed: false,
      exit_code: 1,
      reason: error instanceof Error ? error.message : 'repair_provider_binding_failed',
      automation_status: 'BLOCKED',
      next_action: 'STOP',
    })
  }
}

export const executeRepairExecutorV1 = async ({ phase, dispatch, host, providerResult, repairPaths, validationProfile, validationSucceeded, newHead, headRef }) => {
  try {
    validateRepairDispatchV1(dispatch)
    const request = repairRequestV1(dispatch)
    if (phase === 'preflight') {
      const pull = validateRepairPullV1(dispatch, await acquirePull(request, host))
      const scope = await acquireChangedPathScopeV1(request, pull, host)
      const profile = selectRepairValidationProfileV1({
        authorizedPaths: dispatch.authorized_paths,
        currentPaths: scope.actual_paths,
      })
      if (profile.next_action === 'STOP') return profile
      return Object.freeze({
        state: 'REVIEW_BLOCKED',
        allowed: false,
        exit_code: 0,
        reason: 'repair_preflight_satisfied',
        automation_status: 'REPAIR_READY',
        next_action: 'REPAIR_AGENT',
        repository: dispatch.repository,
        task_issue_number: dispatch.task_issue_number,
        pr_number: dispatch.pr_number,
        exact_head: dispatch.exact_head,
        head_ref: pull.head.ref,
        authorized_paths: profile.authorized_paths,
        current_paths: profile.current_paths,
        validation_profile: profile.name,
        validation_commands: profile.commands,
        prompt: repairProviderPromptV2(dispatch, profile.authorized_paths),
      })
    }

    if (phase === 'post_agent') {
      if (
        !providerResult ||
        providerResult.status !== 'completed' ||
        typeof providerResult.summary !== 'string' ||
        providerResult.summary.length === 0
      ) {
        throw new Error('repair_provider_result_invalid')
      }
      const pull = validateRepairPullV1(dispatch, await acquirePull(request, host))
      const scope = await acquireChangedPathScopeV1(request, pull, host)
      const profile = selectRepairValidationProfileV1({
        authorizedPaths: dispatch.authorized_paths,
        currentPaths: scope.actual_paths,
        repairPaths,
      })
      if (profile.next_action === 'STOP') return profile
      return Object.freeze({
        state: 'REVIEW_BLOCKED',
        allowed: false,
        exit_code: 0,
        reason: 'repair_post_agent_satisfied',
        automation_status: 'VALIDATION_REQUIRED',
        next_action: 'VALIDATE_REPAIR',
        exact_head: dispatch.exact_head,
        head_ref: pull.head.ref,
        repair_paths: profile.repair_paths,
        validation_profile: profile.name,
        validation_commands: profile.commands,
      })
    }

    if (phase === 'commit_plan') {
      if (validationSucceeded !== true) throw new Error('repair_validation_failed')
      const pull = validateRepairPullV1(dispatch, await acquirePull(request, host))
      const scope = await acquireChangedPathScopeV1(request, pull, host)
      const remoteHead = await host.branchHead(dispatch.repository, pull.head.ref)
      if (remoteHead !== dispatch.exact_head) throw new Error('repair_remote_head_changed')
      const profile = selectRepairValidationProfileV1({
        authorizedPaths: dispatch.authorized_paths,
        currentPaths: scope.actual_paths,
        repairPaths,
      })
      if (profile.next_action === 'STOP') return profile
      return Object.freeze({
        state: 'REVIEW_BLOCKED',
        allowed: false,
        exit_code: 0,
        reason: 'repair_commit_plan_satisfied',
        automation_status: 'COMMIT_READY',
        next_action: 'COMMIT_AND_PUSH',
        exact_head: dispatch.exact_head,
        head_ref: pull.head.ref,
        message: REPAIR_COMMIT_MESSAGE,
        commit_count: 1,
        force: false,
        paths: profile.repair_paths,
      })
    }

    if (phase === 'complete') {
      if (
        !FULL_HEAD.test(newHead ?? '') ||
        newHead === dispatch.exact_head ||
        typeof headRef !== 'string' ||
        headRef.length === 0
      ) {
        throw new Error('repair_new_head_invalid')
      }
      const nextRequest = repairRequestV1(dispatch, newHead)
      const pull = validateRepairPullV1(dispatch, await acquirePull(nextRequest, host), newHead)
      if (pull.head.ref !== headRef) throw new Error('repair_branch_binding_changed')
      if (await host.branchHead(dispatch.repository, pull.head.ref) !== newHead) throw new Error('repair_remote_head_changed')
      const scope = await acquireChangedPathScopeV1(nextRequest, pull, host)
      const profile = selectRepairValidationProfileV1({
        authorizedPaths: dispatch.authorized_paths,
        currentPaths: scope.actual_paths,
        repairPaths,
      })
      if (profile.next_action === 'STOP') return profile
      if (profile.name !== validationProfile) throw new Error('repair_validation_profile_changed')
      const previousState = extractProtectedTransitionTaskStateV1(pull.body)
      const alreadyRebound =
        previousState.observed_head === newHead &&
        previousState.review_status === 'PENDING' &&
        previousState.reviewed_head === null &&
        previousState.review_blocker_count === null
      if (!alreadyRebound && (
        previousState.observed_head !== dispatch.exact_head ||
        previousState.review_status !== 'CHANGES_REQUIRED' ||
        previousState.reviewed_head !== dispatch.exact_head
      )) {
        throw new Error('repair_previous_state_invalid')
      }
      const candidateState = alreadyRebound
        ? previousState
        : parseProtectedTransitionTaskStateV1({
            ...previousState,
            observed_head: newHead,
            review_status: 'PENDING',
            reviewed_head: null,
            review_blocker_count: null,
          })
      const written = await writeProtectedTransitionTaskStateV1({
        request: nextRequest,
        host,
        expectedState: previousState,
        candidateState,
      })
      const currentResult = Object.freeze({
        transition: 'merge_decision_admission',
        state: 'REVIEW_PENDING',
        allowed: false,
        exit_code: 0,
        reason: 'fresh_review_required',
        task_issue_number: dispatch.task_issue_number,
        pr_number: dispatch.pr_number,
        current_head: newHead,
        out_of_scope_paths: Object.freeze([]),
        state_changed: written.changed,
        admission_executed: false,
        next_action: 'REVIEW',
      })
      return executeProgressionControllerV1({
        currentResult,
        currentContext: Object.freeze({ request: nextRequest, task_state: candidateState }),
        host,
      }).then((result) => Object.freeze({
        ...result,
        repair_paths: profile.repair_paths,
        validation_profile: profile.name,
      }))
    }
    throw new Error('repair_phase_invalid')
  } catch (error) {
    return Object.freeze({
      state: 'INDETERMINATE',
      allowed: false,
      exit_code: 1,
      reason: error instanceof Error ? error.message : 'repair_executor_failed',
      automation_status: 'BLOCKED',
      next_action: 'STOP',
    })
  }
}

export const evaluateProgressionControllerV1 = (currentResult, currentContext = undefined) => {
  if (!currentResult || typeof currentResult !== 'object') {
    return progressionBlockedResultV1({}, 'progression_result_invalid')
  }
  if (currentResult.next_action === 'NONE') {
    return Object.freeze({
      ...currentResult,
      exit_code: 0,
      automation_status: 'COMPLETED_NOOP',
      next_action: 'NONE',
    })
  }
  if (currentResult.next_action === 'REVIEW') {
    if (
      currentResult.state !== 'REVIEW_PENDING' ||
      currentResult.allowed !== false ||
      !FULL_HEAD.test(currentResult.current_head ?? '')
    ) {
      return progressionBlockedResultV1(currentResult, 'review_handoff_not_pending')
    }
    return Object.freeze({
      ...currentResult,
      exit_code: 0,
      reason: 'fresh_review_required',
      automation_status: 'HANDOFF_READY',
      next_action: 'REVIEW',
    })
  }
  if (currentResult.state === 'REVIEW_PENDING' && currentResult.next_action !== 'MERGE_DECISION') {
    return Object.freeze({
      ...currentResult,
      exit_code: 0,
      automation_status: 'WAITING',
      next_action: 'NONE',
    })
  }
  if (currentResult.next_action === 'MERGE_DECISION') {
    if (currentResult.state !== 'MERGE_ELIGIBLE' || currentResult.allowed !== true) {
      return progressionBlockedResultV1(currentResult, 'merge_decision_not_eligible')
    }
    return Object.freeze({
      ...currentResult,
      exit_code: 0,
      automation_status: 'MERGE_DECISION_PENDING',
      next_action: 'MERGE_DECISION',
    })
  }
  if (currentResult.next_action === 'MERGE_OPERATOR') {
    if (currentResult.state !== 'MERGE_ELIGIBLE' || currentResult.allowed !== true) {
      return progressionBlockedResultV1(currentResult, 'merge_operator_not_eligible')
    }
    return Object.freeze({
      ...currentResult,
      exit_code: 0,
      automation_status: 'HANDOFF_READY',
      next_action: 'MERGE_OPERATOR',
    })
  }
  if (currentContext?.review?.decision === 'CHANGES_REQUIRED') {
    try {
      if (currentResult.state !== 'REVIEW_BLOCKED') throw new Error('repair_state_not_review_blocked')
      const repairDispatch = projectRepairExecutorDispatchV1(currentContext)
      return Object.freeze({
        ...currentResult,
        exit_code: 0,
        automation_status: 'DISPATCH_READY',
        next_action: 'REPAIR_EXECUTOR',
        repair_dispatch: repairDispatch,
      })
    } catch (error) {
      return progressionBlockedResultV1(
        currentResult,
        error instanceof Error ? error.message : 'repair_dispatch_invalid',
      )
    }
  }
  return progressionBlockedResultV1(currentResult, currentResult.reason ?? 'progression_not_safe')
}

export const executeProgressionControllerV1 = async ({ currentResult, currentContext, host }) => {
  const projected = evaluateProgressionControllerV1(currentResult, currentContext)
  if (projected.next_action === 'REVIEW') {
    try {
      const request = currentContext?.request
      const expectedState = parseProtectedTransitionTaskStateV1(currentContext?.task_state)
      const pull = await acquirePull(request, host)
      const actualState = extractProtectedTransitionTaskStateV1(pull.body)
      if (
        pull.head.sha !== request.exactHead ||
        expectedState.observed_head !== request.exactHead ||
        expectedState.review_status !== 'PENDING' ||
        JSON.stringify(actualState) !== JSON.stringify(expectedState)
      ) {
        return progressionBlockedResultV1(projected, 'review_handoff_binding_changed')
      }
      return projected
    } catch (error) {
      return progressionBlockedResultV1(
        projected,
        error instanceof Error ? error.message : 'review_handoff_acquisition_failed',
      )
    }
  }
  if (projected.next_action !== 'MERGE_DECISION') return projected
  const gated = await evaluateMergeAllowedAutomationV1({
    request: currentContext.request,
    admitted: currentResult,
    host,
  })
  return evaluateProgressionControllerV1(gated, currentContext)
}

export const executeManualProgressionControllerV1 = async ({ request, host }) => {
  const admitted = await executeProtectedTransitionAdmissionV1({ request, host })
  const currentResult = Object.freeze({
    ...admitted,
    automation_status: 'ADMISSION_EVALUATED',
    admission_executed: true,
    next_action: admitted.allowed && admitted.state === 'MERGE_ELIGIBLE' ? 'MERGE_DECISION' : 'STOP',
  })
  return executeProgressionControllerV1({
    currentResult,
    currentContext: Object.freeze({ request }),
    host,
  })
}

export const executeReadyForReviewProgressionV1 = async ({ event, host, runId }) => {
  let request = Object.freeze({
    transition: 'merge_decision_admission',
    repository: event?.repository?.full_name ?? null,
    taskIssueNumber: null,
    prNumber: event?.pull_request?.number ?? null,
    exactHead: event?.pull_request?.head?.sha ?? null,
    currentWorkflowRunId: runId ?? null,
  })
  try {
    const pull = event?.pull_request
    if (
      event?.action !== 'ready_for_review' ||
      !REPOSITORY.test(request.repository ?? '') ||
      !positiveInteger(request.prNumber) ||
      !FULL_HEAD.test(request.exactHead ?? '') ||
      !WORKFLOW_RUN_ID.test(request.currentWorkflowRunId ?? '') ||
      !pull ||
      pull.state !== 'open' ||
      typeof pull.draft !== 'boolean' ||
      typeof pull.body !== 'string'
    ) {
      throw new Error('ready_event_invalid')
    }

    const taskState = extractProtectedTransitionTaskStateV1(pull.body)
    request = Object.freeze({
      ...request,
      taskIssueNumber: taskState.task_issue_number,
    })
    if (taskState.pr_number !== request.prNumber) throw new Error('ready_event_pr_binding_mismatch')
    if (taskState.observed_head !== request.exactHead) {
      return evaluateProgressionControllerV1(stoppedAutomationResult(
        request,
        'STALE',
        'head_binding_stale',
        2,
        request.exactHead,
      ))
    }
    if (pull.draft) {
      return evaluateProgressionControllerV1(stoppedAutomationResult(
        request,
        'REVIEW_PENDING',
        'pull_not_ready',
        2,
        request.exactHead,
      ))
    }
    const admitted = await executeProtectedTransitionAdmissionV1({ request, host })
    const currentResult = Object.freeze({
      ...admitted,
      automation_status: 'ADMISSION_EVALUATED',
      admission_executed: true,
      next_action: admitted.allowed && admitted.state === 'MERGE_ELIGIBLE' ? 'MERGE_DECISION' : 'STOP',
    })
    if (currentResult.next_action === 'MERGE_DECISION') await waitForReadyTerminalChecksV1(request, host)
    return executeProgressionControllerV1({
      currentResult,
      currentContext: Object.freeze({ request }),
      host,
    })
  } catch (error) {
    if (error instanceof ReviewAutomationStop) {
      return evaluateProgressionControllerV1(stoppedAutomationResult(
        request,
        error.state,
        error.message,
        error.exitCode,
        error.currentHead ?? request.exactHead,
      ))
    }
    return evaluateProgressionControllerV1(stoppedAutomationResult(
      request,
      'INDETERMINATE',
      error instanceof Error ? error.message : 'ready_event_invalid',
      1,
      request.exactHead,
    ))
  }
}

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

const mergeGateFreshAdmissionStoppedResultV1 = (result) => Object.freeze({
  ...result,
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
  const selfAwareUnstable = WORKFLOW_RUN_ID.test(request.currentWorkflowRunId ?? '') && pull.mergeable_state === 'unstable'
  if (!pull.mergeable || (pull.mergeable_state !== 'clean' && !selfAwareUnstable)) {
    return mergeGateStoppedResultV1(request, 'IMPLEMENTATION_BLOCKED', 'pull_not_mergeable', 2, pull.head.sha)
  }
  return null
}

const selectCurrentCheckGenerationsV1 = (rollup) => {
  const groups = new Map()
  for (const item of rollup) {
    if (item.type !== 'CheckRun') continue
    const startedAt = Date.parse(item.started_at ?? '')
    if (
      typeof item.app_id !== 'string' ||
      item.app_id.trim().length === 0 ||
      typeof item.name !== 'string' ||
      item.name.length === 0 ||
      typeof item.started_at !== 'string' ||
      item.started_at.length === 0 ||
      !Number.isFinite(startedAt)
    ) {
      throw new Error('check_generation_identity_invalid')
    }
    const identity = JSON.stringify([item.app_id, item.name])
    const group = groups.get(identity) ?? []
    group.push(Object.freeze({ item, startedAt }))
    groups.set(identity, group)
  }

  const selectedIds = new Set()
  for (const group of groups.values()) {
    const greatest = Math.max(...group.map((candidate) => candidate.startedAt))
    const selected = group.filter((candidate) => candidate.startedAt === greatest)
    if (selected.length !== 1) throw new Error('check_generation_ambiguous')
    selectedIds.add(selected[0].item.id)
  }

  return Object.freeze(rollup.filter((item) => item.type === 'StatusContext' || selectedIds.has(item.id)))
}

const parseRepositoryActionsRunIdV1 = (request, check) => {
  if (check.type !== 'CheckRun' || typeof check.details_url !== 'string') return null
  const prefix = `https://github.com/${request.repository}/actions/runs/`
  if (!check.details_url.startsWith(prefix)) return null
  return /^([1-9][0-9]*)\/job\/[^/?#]+$/.exec(check.details_url.slice(prefix.length))?.[1] ?? null
}

const reduceSelfAwareCurrentChecksV1 = (request, rollup) => {
  const selectedGenerations = selectCurrentCheckGenerationsV1(rollup)
  if (request.currentWorkflowRunId === undefined || request.currentWorkflowRunId === null) return selectedGenerations

  const admissionName = 'protected_transition_admission_v1'
  const repairName = 'protected_transition_repair_executor_v1'
  const currentRunPrefix = `https://github.com/${request.repository}/actions/runs/${request.currentWorkflowRunId}/`
  if (rollup.some((item) => item.type === 'CheckRun' && item.name === repairName && item.details_url?.startsWith(currentRunPrefix))) {
    throw new Error('ready_current_repair_check_present')
  }
  const rawPartition = partitionReadyRunChecksV1(request, rollup)
  if (rawPartition.current.length === 0) throw new Error('ready_current_check_missing')
  if (rawPartition.current.length !== 1) throw new Error('ready_current_check_cardinality_invalid')
  if (rawPartition.current[0].name !== admissionName) throw new Error('ready_current_check_name_invalid')
  if (parseRepositoryActionsRunIdV1(request, rawPartition.current[0]) !== request.currentWorkflowRunId) {
    throw new Error('ready_current_check_identity_invalid')
  }

  const selectedPartition = partitionReadyRunChecksV1(request, selectedGenerations)
  if (selectedPartition.current.length !== 1 || selectedPartition.current[0].id !== rawPartition.current[0].id) {
    throw new Error('ready_current_check_not_selected_generation')
  }

  return Object.freeze(selectedPartition.remaining.filter((item) => {
    if (item.type !== 'CheckRun' || item.app_id !== rawPartition.current[0].app_id || item.name !== repairName) return true
    const siblingRunId = parseRepositoryActionsRunIdV1(request, item)
    if (siblingRunId === null) throw new Error('ready_self_sibling_identity_invalid')
    if (siblingRunId === request.currentWorkflowRunId) throw new Error('ready_current_repair_check_present')
    return false
  }))
}

const mergeGateChecksStopV1 = (request, rollup, currentHead) => {
  const checks = reduceSelfAwareCurrentChecksV1(request, rollup)
  if (checks.length === 0) {
    return mergeGateStoppedResultV1(request, 'INDETERMINATE', 'checks_missing', 1, currentHead)
  }
  if (checks.some(readyCheckIsPendingV1)) {
    return mergeGateStoppedResultV1(request, 'INDETERMINATE', 'checks_not_terminal', 1, currentHead)
  }
  if (checks.some(readyCheckHasFailedV1)) {
    return mergeGateStoppedResultV1(request, 'IMPLEMENTATION_BLOCKED', 'checks_not_successful', 2, currentHead)
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
    const freshAdmissionSnapshot = await acquireTransitionStateSnapshotV1(request, host)
    const freshAdmission = evaluateProtectedTransitionAdmissionV1(freshAdmissionSnapshot)
    if (freshAdmission.state !== 'MERGE_ELIGIBLE' || freshAdmission.allowed !== true) {
      return mergeGateFreshAdmissionStoppedResultV1(freshAdmission)
    }
    if (JSON.stringify(initialState) !== JSON.stringify(freshAdmissionSnapshot.task_state)) {
      return mergeGateStoppedResultV1(request, 'INDETERMINATE', 'state_changed_after_fresh_admission', 1, initialPull.head.sha)
    }
    if (initialState.observed_head !== request.exactHead || initialState.reviewed_head !== request.exactHead) {
      return mergeGateStoppedResultV1(request, 'STALE', 'head_binding_stale', 2, initialPull.head.sha)
    }
    if (initialState.review_status !== 'APPROVE' || initialState.review_blocker_count !== 0) {
      return mergeGateStoppedResultV1(request, 'REVIEW_BLOCKED', 'review_not_approved', 2, initialPull.head.sha)
    }

    const initialCheckSnapshot = await acquireMergeCheckRollupSnapshotV1(request, host, { stopOnPullHeadDrift: true })
    if (initialCheckSnapshot.headRefOid !== request.exactHead) {
      return mergeGateStoppedResultV1(request, 'STALE', 'head_changed_during_merge_gate', 2, initialCheckSnapshot.headRefOid)
    }
    const initialChecksStop = mergeGateChecksStopV1(request, initialCheckSnapshot.checks, initialPull.head.sha)
    if (initialChecksStop) return initialChecksStop

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
    const selfAwareUnstable = WORKFLOW_RUN_ID.test(request.currentWorkflowRunId ?? '') && reviewSnapshot.pull.mergeStateStatus === 'UNSTABLE'
    if (reviewSnapshot.pull.mergeable !== 'MERGEABLE' || (reviewSnapshot.pull.mergeStateStatus !== 'CLEAN' && !selfAwareUnstable)) {
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

    const finalCheckSnapshot = await acquireMergeCheckRollupSnapshotV1(request, host, { stopOnPullHeadDrift: true })
    if (finalCheckSnapshot.headRefOid !== request.exactHead) {
      return mergeGateStoppedResultV1(request, 'STALE', 'head_changed_during_merge_gate', 2, finalCheckSnapshot.headRefOid)
    }
    const finalChecksStop = mergeGateChecksStopV1(request, finalCheckSnapshot.checks, finalCheckSnapshot.headRefOid)
    if (finalChecksStop) return finalChecksStop

    return Object.freeze({
      ...admitted,
      reason: 'merge_gate_satisfied',
      automation_status: 'MERGE_ALLOWED',
      admission_executed: true,
      next_action: 'MERGE_OPERATOR',
    })
  } catch (error) {
    if (error instanceof ReviewAutomationStop) {
      return mergeGateStoppedResultV1(
        request,
        error.state,
        error.message,
        error.exitCode,
        error.currentHead ?? request.exactHead,
      )
    }
    return mergeGateStoppedResultV1(
      request,
      'INDETERMINATE',
      error instanceof Error ? error.message : 'merge_gate_acquisition_failed',
      1,
    )
  }
}

const completeApprovedAutomationV1 = async ({ request, host, stateChanged, currentContext }) => {
  const admitted = await executeProtectedTransitionAdmissionV1({ request, host })
  if (!admitted.allowed) {
    return executeProgressionControllerV1({ currentContext, host, currentResult: Object.freeze({
      ...admitted,
      state_changed: stateChanged,
      automation_status: 'UPDATED_AND_STOPPED',
      admission_executed: true,
      next_action: 'STOP',
    }) })
  }
  return executeProgressionControllerV1({ currentContext, host, currentResult: Object.freeze({
    ...admitted,
    state_changed: stateChanged,
    automation_status: 'ADMISSION_ACCEPTED',
    admission_executed: true,
    next_action: 'MERGE_DECISION',
  }) })
}

export const executeReviewApprovalAutomationV1 = async ({ event, host }) => {
  let parsedEvent
  let request
  let progressionContext
  try {
    if (!isReviewDecisionCandidateV1(event?.comment?.body)) {
      return evaluateProgressionControllerV1(skippedAutomationResult(Object.freeze({
        transition: 'merge_decision_admission',
        taskIssueNumber: event?.issue?.number ?? null,
        prNumber: null,
        exactHead: null,
      }), 'review_event_not_applicable'))
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
      return evaluateProgressionControllerV1(stoppedAutomationResult(request, 'REVIEW_BLOCKED', 'review_not_approvable', 2))
    }

    const effective = await resolveEffectiveReviewDecisionV1({ request, parsedEvent, host })
    if (effective.commentId !== parsedEvent.commentId) {
      return evaluateProgressionControllerV1(skippedAutomationResult(request, 'review_event_superseded'))
    }
    const review = effective.review

    const initial = await acquireTransitionStateSnapshotV1(request, host)
    ensureOriginalStateCurrentV1(initial, request, review)
    const candidateState = projectProtectedTransitionReviewStateV1(initial.task_state, review)
    progressionContext = Object.freeze({
      request,
      task_state: candidateState,
      scope: initial.scope,
      review,
      review_comment_id: effective.commentId,
      review_body: effective.body,
      effective_review_current: true,
    })
    const candidateInput = Object.freeze({ ...initial, task_state: candidateState })
    const preflight = evaluateProtectedTransitionAdmissionV1(candidateInput)
    const expectedState = review.decision === 'APPROVE' ? 'MERGE_ELIGIBLE' : 'REVIEW_BLOCKED'
    if (preflight.state !== expectedState || (review.decision === 'APPROVE' && !preflight.allowed)) {
      return evaluateProgressionControllerV1(Object.freeze({
        ...preflight,
        automation_status: 'STOPPED',
        admission_executed: false,
        next_action: 'STOP',
      }), progressionContext)
    }

    const alreadyConverged = JSON.stringify(initial.task_state) === JSON.stringify(candidateState)
    if (alreadyConverged) {
      if (review.decision === 'APPROVE') {
        return completeApprovedAutomationV1({ request, host, stateChanged: false, currentContext: progressionContext })
      }
      return evaluateProgressionControllerV1(Object.freeze({
        ...preflight,
        automation_status: 'ALREADY_CONVERGED',
        admission_executed: false,
        next_action: preflight.allowed ? 'MERGE_DECISION' : 'STOP',
      }), progressionContext)
    }

    const confirmed = await resolveEffectiveReviewDecisionV1({ request, parsedEvent, host })
    if (confirmed.commentId !== effective.commentId) {
      return evaluateProgressionControllerV1(skippedAutomationResult(request, 'review_event_superseded_before_write'))
    }

    const written = await writeProtectedTransitionTaskStateV1({
      request,
      host,
      expectedState: initial.task_state,
      candidateState,
    })
    if (!written.changed) {
      if (review.decision === 'APPROVE') {
        return completeApprovedAutomationV1({ request, host, stateChanged: false, currentContext: progressionContext })
      }
      return evaluateProgressionControllerV1(Object.freeze({
        ...preflight,
        automation_status: 'ALREADY_CONVERGED',
        admission_executed: false,
        next_action: preflight.allowed ? 'MERGE_DECISION' : 'STOP',
      }), progressionContext)
    }
    if (review.decision !== 'APPROVE') {
      return evaluateProgressionControllerV1(Object.freeze({
        ...preflight,
        state_changed: true,
        automation_status: 'UPDATED_AND_STOPPED',
        admission_executed: false,
        next_action: 'STOP',
      }), progressionContext)
    }
    return completeApprovedAutomationV1({ request, host, stateChanged: true, currentContext: progressionContext })
  } catch (error) {
    const fallbackRequest = request ?? Object.freeze({
      transition: 'merge_decision_admission',
      repository: parsedEvent?.repository ?? null,
      taskIssueNumber: parsedEvent?.taskIssueNumber ?? null,
      prNumber: parsedEvent?.prNumber ?? null,
      exactHead: parsedEvent?.exactHead ?? null,
    })
    if (error instanceof ReviewAutomationStop) {
      return evaluateProgressionControllerV1(stoppedAutomationResult(
        fallbackRequest,
        error.state,
        error.message,
        error.exitCode,
        error.currentHead ?? fallbackRequest.exactHead,
      ), progressionContext)
    }
    return evaluateProgressionControllerV1(stoppedAutomationResult(
      fallbackRequest,
      'INDETERMINATE',
      error instanceof Error ? error.message : 'review_automation_failed',
      1,
    ), progressionContext)
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
  if (argv.length === 2 && argv[0] === '--ready-event-file' && typeof argv[1] === 'string' && argv[1].length > 0) {
    return Object.freeze({ mode: 'ready_event', eventFile: argv[1] })
  }
  if (argv.length === 2 && argv[0] === '--repair-preflight-file' && typeof argv[1] === 'string' && argv[1].length > 0) {
    return Object.freeze({ mode: 'repair_preflight', dispatchFile: argv[1] })
  }
  if (argv.length === 2 && argv[0] === '--repair-provider-exec-bind-file' && typeof argv[1] === 'string' && argv[1].length > 0) {
    return Object.freeze({ mode: 'repair_provider_exec_bind', dispatchFile: argv[1] })
  }
  if (
    argv.length === 4 &&
    argv[0] === '--repair-provider-post-exec-bind-file' &&
    typeof argv[1] === 'string' &&
    argv[1].length > 0 &&
    argv[2] === '--provider-binding-file' &&
    typeof argv[3] === 'string' &&
    argv[3].length > 0
  ) {
    return Object.freeze({ mode: 'repair_provider_post_exec_bind', dispatchFile: argv[1], providerBindingFile: argv[3] })
  }
  if (
    argv.length === 4 &&
    argv[0] === '--repair-post-agent-file' &&
    typeof argv[1] === 'string' &&
    argv[1].length > 0 &&
    argv[2] === '--provider-result-file' &&
    typeof argv[3] === 'string' &&
    argv[3].length > 0
  ) {
    return Object.freeze({ mode: 'repair_post_agent', dispatchFile: argv[1], providerResultFile: argv[3] })
  }
  if (argv.length === 2 && argv[0] === '--repair-commit-plan-file' && typeof argv[1] === 'string' && argv[1].length > 0) {
    return Object.freeze({ mode: 'repair_commit_plan', dispatchFile: argv[1] })
  }
  if (
    argv.length === 6 &&
    argv[0] === '--repair-result-file' &&
    typeof argv[1] === 'string' &&
    argv[1].length > 0 &&
    argv[2] === '--repair-evidence-file' &&
    typeof argv[3] === 'string' &&
    argv[3].length > 0 &&
    argv[4] === '--new-head' &&
    FULL_HEAD.test(argv[5] ?? '')
  ) {
    return Object.freeze({ mode: 'repair_complete', dispatchFile: argv[1], evidenceFile: argv[3], newHead: argv[5] })
  }
  return Object.freeze({ mode: 'manual', request: parseManualCli(argv, environment) })
}

const readJsonFileV1 = (file) => JSON.parse(readFileSync(file, 'utf8'))

export const repairWorkingTreePathsV1 = (
  expectedHead,
  executeGit = (args, options = undefined) => execFileSync('git', args, options),
) => {
  if (!FULL_HEAD.test(expectedHead ?? '')) throw new Error('repair_worktree_head_invalid')
  const currentHead = executeGit(['rev-parse', '--verify', 'HEAD'], { encoding: 'utf8' }).trim()
  if (currentHead !== expectedHead) throw new Error('repair_worktree_head_changed')
  try {
    executeGit(['diff', '--cached', '--quiet', '--'])
  } catch {
    throw new Error('repair_index_not_clean')
  }
  const split = (value) => value.split('\0').filter((item) => item.length > 0)
  const tracked = split(executeGit(['diff', '--name-only', '-z', '--no-renames', 'HEAD', '--'], { encoding: 'utf8' }))
  const untracked = split(executeGit(['ls-files', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' }))
  return Object.freeze([...new Set([...tracked, ...untracked])].sort())
}

const productionHost = (environment) => {
  const token = environment.GH_TOKEN
  if (!token) throw new Error('github_token_missing')
  const apiCall = async (endpoint, options = undefined) => {
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
  }
  return Object.freeze({
    api: apiCall,
    branchHead: async (repository, branch) => {
      const ref = await apiCall(`repos/${repository}/git/ref/heads/${branch.split('/').map(encodeURIComponent).join('/')}`)
      if (!FULL_HEAD.test(ref?.object?.sha ?? '')) throw new Error('repair_remote_ref_invalid')
      return ref.object.sha
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
      : invocation.mode === 'ready_event'
        ? await executeReadyForReviewProgressionV1({
            event: JSON.parse(readFileSync(invocation.eventFile, 'utf8')),
            host,
            runId: process.env.GITHUB_RUN_ID,
          })
        : invocation.mode === 'repair_preflight'
          ? await executeRepairExecutorV1({
              phase: 'preflight',
              dispatch: readJsonFileV1(invocation.dispatchFile),
              host,
            })
          : invocation.mode === 'repair_provider_exec_bind'
            ? await executeRepairProviderBindingV3({
                boundary: 'pre_exec',
                dispatch: readJsonFileV1(invocation.dispatchFile),
                host,
                localPaths: repairWorkingTreePathsV1(readJsonFileV1(invocation.dispatchFile).exact_head),
                cliVersion: process.env.REPAIR_PROVIDER_CLI_VERSION,
                loginStatus: process.env.REPAIR_PROVIDER_LOGIN_STATUS,
                runAttempt: Number(process.env.GITHUB_RUN_ATTEMPT),
                workspacePath: process.env.GITHUB_WORKSPACE,
                readAuthorizedSnapshots: ({ authorizedPaths, workspacePath }) => materializeRepairAuthorizedFileSnapshotsV1({
                  authorizedPaths,
                  workspacePath,
                }),
              })
            : invocation.mode === 'repair_provider_post_exec_bind'
              ? await (() => {
                  const dispatch = readJsonFileV1(invocation.dispatchFile)
                  const providerBinding = readJsonFileV1(invocation.providerBindingFile)
                  return executeRepairProviderBindingV3({
                    boundary: 'post_exec',
                    dispatch,
                    host,
                    localPaths: repairWorkingTreePathsV1(dispatch.exact_head),
                    providerBranch: providerBinding.provider_branch,
                  })
                })()
          : invocation.mode === 'repair_post_agent'
            ? await executeRepairExecutorV1({
                phase: 'post_agent',
                dispatch: readJsonFileV1(invocation.dispatchFile),
                providerResult: readJsonFileV1(invocation.providerResultFile),
                repairPaths: repairWorkingTreePathsV1(readJsonFileV1(invocation.dispatchFile).exact_head),
                host,
              })
            : invocation.mode === 'repair_commit_plan'
              ? await executeRepairExecutorV1({
                  phase: 'commit_plan',
                  dispatch: readJsonFileV1(invocation.dispatchFile),
                  repairPaths: repairWorkingTreePathsV1(readJsonFileV1(invocation.dispatchFile).exact_head),
                  validationSucceeded: process.env.REPAIR_VALIDATION_SUCCEEDED === 'true',
                  host,
                })
              : invocation.mode === 'repair_complete'
                ? await (() => {
                    const evidence = readJsonFileV1(invocation.evidenceFile)
                    return executeRepairExecutorV1({
                      phase: 'complete',
                      dispatch: readJsonFileV1(invocation.dispatchFile),
                      newHead: invocation.newHead,
                      repairPaths: evidence.repair_paths,
                      validationProfile: evidence.validation_profile,
                      headRef: evidence.head_ref,
                      host,
                    })
                  })()
                : await executeManualProgressionControllerV1({ request: invocation.request, host })
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
