import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { parseDocument } from 'yaml'
import {
  acquireSimplifiedPreDecisionPreflightV1,
  acquireSimplifiedReviewPublicationPreflightV2,
  classifyValidationPathsV1,
  evaluateRequiredChecksV1,
  executeSimplifiedMergeV1,
  parseSimplifiedMergeDecisionV1,
  parseSimplifiedReviewV1,
  parseSimplifiedTaskAuthorityV1,
  serializeSimplifiedMergeDecisionV1,
  serializeSimplifiedReviewV1,
  serializeSimplifiedTaskAuthorityV1,
} from './protected-transition-merge-operator-preflight-v1.mjs'
import {
  closeCanonicalTaskIssueAfterTerminalCleanupV1,
  createProductionHostV1,
  ensureReviewAuthorityAndRunPreflightV1,
  parseCanonicalTaskIssueBodyV1,
  projectReviewPublicationLogicalAssignmentIdentityV2,
  projectReviewPublicationLogicalAssignmentSemanticPayloadV2,
  proveCanonicalTaskIssueSelfBindingDeltaV1,
  publishCanonicalTaskIssueV1,
  serializeCanonicalTaskIssueBodyV1,
  writeProtectedPublicationBodyFileV1,
} from './run-protected-transition-admission-v1.mjs'
import {
  discoverPromptTagDictionaryFilesV1,
  parsePromptTagDictionaryV1,
  validatePromptTagDictionaryRootV1,
} from './validate-dictionaries.mjs'
import { projectAutomatedReviewToMergeReadyContinuationV1 } from './task-execution-context-v1.mjs'

const REPOSITORY = 'whatrune/sd-prompt-studio'
const HEAD = '1'.repeat(40)
const BASE = '2'.repeat(40)
const MERGE = '3'.repeat(40)
const PATHS = Object.freeze([
  '.github/workflows/protected-transition-admission-v1.yml',
  'scripts/protected-transition-merge-operator-preflight-v1.mjs',
])
const TASK = 429
const PR = 430
const BRANCH = 'codex/review-publication-test'
const REVIEW = 9001
const REVIEW_URL = `https://github.com/${REPOSITORY}/pull/${PR}#pullrequestreview-${REVIEW}`
const CANONICAL_TASK_PATHS = Object.freeze([
  'docs/automation/00-automation-overview.md',
  'scripts/protected-transition-merge-operator-preflight-v1.mjs',
  'scripts/run-protected-transition-admission-v1.mjs',
])

const canonicalTaskBodyRequest = (overrides = {}) => Object.freeze({
  title: 'CANONICAL_TASK_BODY_SERIALIZATION_V1',
  repository: REPOSITORY,
  objective: 'CANONICAL_TASK_BODY_SERIALIZATION_V1',
  markdown: '# Canonical Task 日本語\n\nBlank lines, Unicode ✓, and embedded # remain content.',
  authorized_paths: [...CANONICAL_TASK_PATHS].reverse(),
  head_branch: 'codex/canonical-task-body-serialization-v1',
  worktree_path: process.platform === 'win32'
    ? join('C:\\', 'workspace', '.worktrees', 'canonical-task-body-serialization-v1')
    : join('/workspace', '.worktrees', 'canonical-task-body-serialization-v1'),
  expected_base: BASE,
  authorized_actor: 'whatrune',
  permitted_surface: 'TASK_ISSUE_COMMENT',
  ready_allowed: false,
  product_owner_login: 'whatrune',
  ...overrides,
})

const taskInput = Object.freeze({
  record_type: 'simplified_task_authority_v1',
  task_issue: TASK,
  repository: REPOSITORY,
  objective: 'SIMPLIFIED_AUTONOMOUS_LIFECYCLE_V1',
  authorized_paths: PATHS,
  ready_allowed: true,
  product_owner_login: 'whatrune',
})
const reviewInput = (head = HEAD) => Object.freeze({
  record_type: 'simplified_independent_review_v1',
  reviewer_role: 'INDEPENDENT_REVIEWER',
  task_issue: TASK,
  pull_request: PR,
  reviewed_head: head,
  decision: 'APPROVE',
  blocking: 0,
  remaining: 0,
  unknown: 0,
})
const decisionInput = (overrides = {}) => Object.freeze({
  record_type: 'simplified_merge_decision_v1',
  task_issue: TASK,
  pull_request: PR,
  exact_head: HEAD,
  expected_base: BASE,
  authorized_paths: PATHS,
  review_kind: 'PULL_REQUEST_REVIEW',
  review_id: REVIEW,
  review_url: REVIEW_URL,
  merge_method: 'merge',
  operation_count: 1,
  ...overrides,
})
const preDecisionInput = (overrides = {}) => Object.freeze({
  repository: REPOSITORY,
  task_issue: TASK,
  pull_request: PR,
  exact_head: HEAD,
  expected_base: BASE,
  authorized_paths: PATHS,
  review_kind: 'PULL_REQUEST_REVIEW',
  review_id: REVIEW,
  review_url: REVIEW_URL,
  ...overrides,
})

const check = (name, appDatabaseId, overrides = {}) => ({
  __typename: 'CheckRun',
  id: `check-${name}`,
  name,
  status: 'COMPLETED',
  conclusion: 'SUCCESS',
  detailsUrl: `https://checks.invalid/${encodeURIComponent(name)}`,
  startedAt: '2026-08-28T00:00:00Z',
  checkSuite: { commit: { oid: HEAD }, app: { databaseId: appDatabaseId } },
  ...overrides,
})

const createFixture = ({
  draft = false,
  head = HEAD,
  reviewHead = HEAD,
  paths = PATHS,
  threads = [],
  checks,
  main = BASE,
  mergeable = 'MERGEABLE',
  mergeStateStatus = 'CLEAN',
  mergeError = null,
  mergeResponse = { sha: MERGE, merged: true, message: 'Pull Request successfully merged' },
  afterMergeParents = [{ sha: BASE }, { sha: HEAD }],
} = {}) => {
  const state = {
    draft,
    merged: false,
    head,
    main,
    mergeCommit: null,
    mergeMutations: 0,
    mergeExpectedHead: null,
  }
  const checkNodes = checks ?? [check('validate', 15368), check('build-preview', 15368), check('Cloudflare Pages', 85455)]
  const taskBody = serializeSimplifiedTaskAuthorityV1(taskInput)
  const reviewBody = serializeSimplifiedReviewV1(reviewInput(reviewHead))
  const pullRest = () => ({
    id: 77,
    node_id: 'PR_node_430',
    number: PR,
    state: state.merged ? 'closed' : 'open',
    merged: state.merged,
    draft: state.draft,
    user: { login: 'implementation-author' },
    head: { ref: BRANCH, sha: state.head, repo: { full_name: REPOSITORY } },
    base: { ref: 'main', sha: state.main, repo: { full_name: REPOSITORY } },
    merge_commit_sha: state.mergeCommit,
  })
  const host = {
    async api(route) {
      if (route === `repos/${REPOSITORY}/issues/${TASK}`) {
        return { number: TASK, state: 'open', user: { login: 'whatrune' }, body: taskBody }
      }
      if (route === `repos/${REPOSITORY}/pulls/${PR}`) return pullRest()
      if (route === `repos/${REPOSITORY}/pulls/${PR}/reviews/${REVIEW}`) {
        return { id: REVIEW, state: 'APPROVED', commit_id: reviewHead, html_url: REVIEW_URL, author_association: 'COLLABORATOR', user: { login: 'reviewer' }, body: reviewBody }
      }
      if (route === `repos/${REPOSITORY}/issues/comments/${REVIEW}`) {
        return { id: REVIEW, issue_url: `https://api.github.com/repos/${REPOSITORY}/issues/${TASK}`, html_url: `https://github.com/${REPOSITORY}/issues/${TASK}#issuecomment-${REVIEW}`, author_association: 'OWNER', user: { login: 'whatrune' }, body: reviewBody }
      }
      if (route === `repos/${REPOSITORY}/git/ref/heads/main`) return { ref: 'refs/heads/main', object: { sha: state.main } }
      if (route === `repos/${REPOSITORY}/pulls/${PR}/files?per_page=100&page=1`) return paths.map((filename) => ({ filename }))
      if (route === `repos/${REPOSITORY}/git/commits/${MERGE}`) return { sha: MERGE, parents: afterMergeParents }
      throw new Error(`unexpected_api:${route}`)
    },
    async mergePullRequest({ repository, prNumber, exactHead }) {
      state.mergeMutations += 1
      state.mergeExpectedHead = exactHead
      if (repository !== REPOSITORY || prNumber !== PR) throw new Error('unexpected_merge_request')
      if (mergeError !== null) throw mergeError
      if (mergeResponse?.merged === true && mergeResponse.sha === MERGE) {
        state.merged = true
        state.mergeCommit = MERGE
        state.main = MERGE
      }
      return mergeResponse
    },
    async graphql(query, variables) {
      if (query.includes('query SimplifiedChecks')) {
        return { repository: { object: { oid: HEAD, statusCheckRollup: { contexts: { nodes: checkNodes, pageInfo: { hasNextPage: false, endCursor: null } } } } } }
      }
      if (query.includes('query SimplifiedThreads')) {
        return { repository: { pullRequest: {
          number: PR,
          state: state.merged ? 'MERGED' : 'OPEN',
          isDraft: state.draft,
          merged: state.merged,
          headRefOid: state.head,
          mergeable,
          mergeStateStatus,
          reviewThreads: { nodes: threads, pageInfo: { hasNextPage: false, endCursor: null } },
        } } }
      }
      throw new Error('unexpected_graphql')
    },
  }
  return { host, state }
}

const mergeEvent = (decision = decisionInput()) => ({
  action: 'created',
  repository: { full_name: REPOSITORY },
  issue: { number: TASK },
  comment: { user: { login: 'whatrune' }, body: serializeSimplifiedMergeDecisionV1(decision) },
})

const reviewRoutingInput = (overrides = {}) => Object.freeze({
  repository: REPOSITORY,
  task_issue: TASK,
  pull_request: PR,
  exact_head: HEAD,
  expected_base: BASE,
  authorized_paths: PATHS,
  review_input: reviewInput(),
  ...overrides,
})

const reviewPublicationAssignment = ({
  actor = 'whatrune',
  surface = 'TASK_ISSUE_COMMENT',
  topOverrides = {},
  grantOverrides = {},
} = {}) => ({
  task_id: `TASK-${TASK}-REVIEW-AUTHORITY-PUBLICATION`,
  record_type: 'task_assignment',
  authoring_role: 'Product Owner / Review Publication Authorizer',
  authority_source: `https://github.com/${REPOSITORY}/issues/${TASK}`,
  canonical_record: `https://github.com/${REPOSITORY}/issues/${TASK}`,
  prior_record_url: 'not_applicable',
  cumulative_scope: 'REVIEW_AUTHORITY_PUBLICATION',
  supporting_records: 'not_applicable',
  requested_by: 'Product Owner',
  assigned_role: 'Protected Transition Consumer Host',
  purpose: 'Authorize one exact Review authority publication.',
  background: 'Fresh semantic Review completed for the exact current PR HEAD.',
  input_documents: 'Shared Role Execution Contract and Review Execution Contract.',
  allowed_changes: {
    protected_action: 'REVIEW_AUTHORITY_PUBLICATION',
    repository: REPOSITORY,
    task_issue: TASK,
    pull_request: PR,
    exact_head: HEAD,
    head_branch: BRANCH,
    expected_base: BASE,
    authorized_paths: PATHS,
    authorized_actor: actor,
    permitted_surface: surface,
    review: reviewInput(),
    operation_count: 1,
    fallback_allowed: false,
    ...grantOverrides,
  },
  forbidden_changes: ['alternate_surface_fallback', 'merge', 'retry'],
  expected_outputs: 'One exact Review authority publication and refetched completion record.',
  validation: 'Exact live binding and refetch equality.',
  completion_conditions: 'One valid Review authority or zero-mutation reuse.',
  escalation_conditions: 'Any authority, identity, surface, or publication mismatch.',
  ...topOverrides,
})

const reviewPublicationPredelegation = ({
  actor = 'whatrune',
  surface = 'TASK_ISSUE_COMMENT',
  topOverrides = {},
  grantOverrides = {},
} = {}) => ({
  task_id: `TASK-${TASK}-REVIEW-PUBLICATION-PREDELEGATION`,
  record_type: 'task_assignment',
  authoring_role: 'Product Owner / Review Publication Predelegator',
  authority_source: `https://github.com/${REPOSITORY}/issues/${TASK}`,
  canonical_record: `https://github.com/${REPOSITORY}/issues/${TASK}`,
  prior_record_url: 'not_applicable',
  cumulative_scope: 'REVIEW_AUTHORITY_PUBLICATION_PREDELEGATION',
  supporting_records: 'not_applicable',
  requested_by: 'Product Owner',
  assigned_role: 'Protected Transition Consumer Host',
  purpose: 'Predelegate deterministic assignment materialization after Fresh exact-HEAD approval.',
  background: 'The coordinator cursor wakes this flow but supplies no publication authority.',
  input_documents: 'Shared Role Execution Contract, Delegation and Result Contract, and Review Execution Contract.',
  allowed_changes: {
    protected_action: 'REVIEW_AUTHORITY_PUBLICATION',
    activation: 'FRESH_EXACT_HEAD_REVIEW_APPROVE',
    materialization_only: false,
    repository: REPOSITORY,
    task_issue: TASK,
    head_branch: BRANCH,
    authorized_paths: PATHS,
    authorized_actor: actor,
    permitted_surface: surface,
    required_review: {
      record_type: 'simplified_independent_review_v1',
      reviewer_role: 'INDEPENDENT_REVIEWER',
      decision: 'APPROVE',
      blocking: 0,
      remaining: 0,
      unknown: 0,
    },
    allowed_operations: {
      logical_assignment_comment: {
        operation_count: 1,
        direct_refetch_required: true,
      },
      canonical_review_publication: {
        operation_count: 1,
        direct_refetch_required: true,
        permitted_surface: surface,
      },
    },
    fallback_allowed: false,
    ...grantOverrides,
  },
  forbidden_changes: [
    'review_publication_before_fresh_approval', 'alternate_surface_fallback', 'merge', 'retry',
  ],
  expected_outputs: 'One admitted logical assignment and Review publication.',
  validation: 'Fresh state, logical equivalence, and resource equality.',
  completion_conditions: 'Review authority and preflight complete.',
  escalation_conditions: 'Any stale identity, conflict, or mutation ambiguity.',
  ...topOverrides,
})

const resourceReviewPublicationAssignment = ({
  actor = 'whatrune',
  surface = 'TASK_ISSUE_COMMENT',
  topOverrides = {},
  grantOverrides = {},
} = {}) => {
  const legacy = reviewPublicationAssignment({ actor, surface })
  return {
    ...legacy,
    canonical_record: 'GITHUB_RESOURCE',
    prior_record_url: `https://github.com/${REPOSITORY}/issues/${TASK}`,
    input_documents: 'Shared Role Execution Contract, Delegation and Result Contract, and Review Execution Contract.',
    allowed_changes: {
      ...legacy.allowed_changes,
      predelegation_task_id: `TASK-${TASK}-REVIEW-PUBLICATION-PREDELEGATION`,
      ...grantOverrides,
    },
    validation: 'Exact live binding, logical equivalence, resource identity, and refetch equality.',
    completion_conditions: 'One logical Review-publication authority or zero-mutation Review reuse.',
    escalation_conditions: 'Any authority, identity, surface, logical conflict, or publication mismatch.',
    ...topOverrides,
  }
}

const yamlBlock = (value) => `\`\`\`yaml\n${JSON.stringify(value, null, 2)}\n\`\`\`\n`

const taskBodyWithReviewPublicationPredelegation = (options = {}) => (
  `${serializeSimplifiedTaskAuthorityV1(taskInput)}\n${yamlBlock(reviewPublicationPredelegation(options))}`
)

const taskBodyWithLegacyReviewPublicationPredelegation = (options = {}) => {
  const assignment = reviewPublicationPredelegation(options)
  const { allowed_operations: omittedOperations, ...grant } = assignment.allowed_changes
  return `${serializeSimplifiedTaskAuthorityV1(taskInput)}\n${yamlBlock({
    ...assignment,
    allowed_changes: {
      ...grant,
      materialization_only: true,
      operation_count: 1,
    },
  })}`
}

const taskBodyWithReviewPublicationAssignment = (options = {}) => (
  `${serializeSimplifiedTaskAuthorityV1(taskInput)}\n\`\`\`yaml\n${JSON.stringify(reviewPublicationAssignment(options), null, 2)}\n\`\`\`\n`
)

const createReviewRoutingFixture = ({
  actor = 'whatrune',
  pullAuthor = 'whatrune',
  existing = [],
  includeAuthority = true,
  includePredelegation = false,
  predelegationTopOverrides = {},
  predelegationGrantOverrides = {},
  authorityTopOverrides = {},
  authorityGrantOverrides = {},
  authorityBody = null,
  issueAuthorAssociation = 'OWNER',
  finalActor = actor,
  finalHead = HEAD,
  finalBase = BASE,
  finalAuthorityBody = null,
  authorityAppearsBeforeMutation = false,
  assignmentAppearsBeforeCreate = false,
  assignmentError = null,
  assignmentResponseMismatch = false,
  assignmentRefetchMismatch = false,
  concurrentEquivalentAssignmentOnCreate = false,
  publicationError = null,
  refetchMismatch = false,
  refetchActorMismatch = false,
  threads = [],
  findingEvent = null,
} = {}) => {
  const base = createFixture({ threads })
  const expectedBody = serializeSimplifiedReviewV1(reviewInput())
  const state = {
    pullReviewMutations: 0,
    taskCommentMutations: 0,
    assignmentCommentMutations: 0,
    pullReviews: [],
    taskComments: [],
    userReads: 0,
    taskReads: 0,
    pullReads: 0,
    mainReads: 0,
    taskCommentListReads: 0,
    threadResolutionMutations: 0,
    findingEventReads: 0,
  }
  const pullReviewResource = (id, body = expectedBody) => ({
    id,
    state: 'APPROVED',
    commit_id: HEAD,
    html_url: `https://github.com/${REPOSITORY}/pull/${PR}#pullrequestreview-${id}`,
    author_association: 'COLLABORATOR',
    user: { login: 'independent-reviewer' },
    body,
  })
  const taskCommentResource = (id, body = expectedBody, login = 'whatrune') => ({
    id,
    issue_url: `https://api.github.com/repos/${REPOSITORY}/issues/${TASK}`,
    html_url: `https://github.com/${REPOSITORY}/issues/${TASK}#issuecomment-${id}`,
    author_association: 'OWNER',
    user: { login },
    body,
  })
  for (const [index, item] of existing.entries()) {
    const id = 9200 + index
    const body = item.body ?? expectedBody
    if (item.kind === 'PULL_REQUEST_REVIEW') state.pullReviews.push(pullReviewResource(id, body))
    else if (item.kind === 'TASK_ASSIGNMENT') {
      state.taskComments.push(taskCommentResource(id, item.body ?? yamlBlock(resourceReviewPublicationAssignment({
        actor,
        surface: actor === pullAuthor ? 'TASK_ISSUE_COMMENT' : 'PULL_REQUEST_REVIEW',
        topOverrides: item.topOverrides,
        grantOverrides: item.grantOverrides,
      })), actor))
    } else state.taskComments.push(taskCommentResource(id, body))
  }
  const host = {
    async refetchContinuationEvent({ cursor }) {
      state.findingEventReads += 1
      if (findingEvent === null || findingEvent.continuation_cursor !== cursor) {
        throw new Error('continuation_event_transport_invalid')
      }
      return findingEvent
    },
    async api(route) {
      if (route === 'user') {
        state.userReads += 1
        return { login: state.userReads === 1 ? actor : finalActor }
      }
      if (route === `repos/${REPOSITORY}/issues/${TASK}`) {
        state.taskReads += 1
        const task = await base.host.api(route)
        const surface = actor === pullAuthor ? 'TASK_ISSUE_COMMENT' : 'PULL_REQUEST_REVIEW'
        const initialBody = authorityBody ?? (includeAuthority
          ? taskBodyWithReviewPublicationAssignment({
              actor, surface, topOverrides: authorityTopOverrides, grantOverrides: authorityGrantOverrides,
            })
          : includePredelegation
            ? taskBodyWithReviewPublicationPredelegation({
                actor,
                surface,
                topOverrides: predelegationTopOverrides,
                grantOverrides: predelegationGrantOverrides,
              })
            : task.body)
        return {
          ...task,
          author_association: issueAuthorAssociation,
          body: state.taskReads === 1 || finalAuthorityBody === null ? initialBody : finalAuthorityBody,
        }
      }
      if (route === `repos/${REPOSITORY}/pulls/${PR}`) {
        state.pullReads += 1
        const pull = await base.host.api(route)
        return {
          ...pull,
          user: { login: pullAuthor },
          head: { ...pull.head, sha: state.pullReads === 1 ? HEAD : finalHead },
          base: { ...pull.base, sha: state.pullReads === 1 ? BASE : finalBase },
        }
      }
      if (route === `repos/${REPOSITORY}/git/ref/heads/main`) {
        state.mainReads += 1
        return { ref: 'refs/heads/main', object: { sha: state.mainReads === 1 ? BASE : finalBase } }
      }
      if (route === `repos/${REPOSITORY}/pulls/${PR}/reviews?per_page=100&page=1`) return [...state.pullReviews]
      if (route === `repos/${REPOSITORY}/issues/${TASK}/comments?per_page=100&page=1`) {
        state.taskCommentListReads += 1
        if (authorityAppearsBeforeMutation && state.taskCommentListReads === 2 && state.taskComments.length === 0) {
          state.taskComments.push(taskCommentResource(9299))
        }
        if (assignmentAppearsBeforeCreate && state.taskCommentListReads === 2 && state.taskComments.length === 0) {
          state.taskComments.push(taskCommentResource(9410, yamlBlock(resourceReviewPublicationAssignment({
            actor,
            surface: actor === pullAuthor ? 'TASK_ISSUE_COMMENT' : 'PULL_REQUEST_REVIEW',
          }))))
        }
        return [...state.taskComments]
      }
      const reviewMatch = route.match(new RegExp(`^repos/${REPOSITORY}/pulls/${PR}/reviews/(\\d+)$`))
      if (reviewMatch) {
        const resource = state.pullReviews.find((item) => item.id === Number(reviewMatch[1]))
        if (resource === undefined) throw new Error(`unexpected_api:${route}`)
        if (refetchMismatch) return { ...resource, body: `${resource.body}\n` }
        return refetchActorMismatch ? { ...resource, user: { login: 'wrong-actor' } } : resource
      }
      const commentMatch = route.match(new RegExp(`^repos/${REPOSITORY}/issues/comments/(\\d+)$`))
      if (commentMatch) {
        const resource = state.taskComments.find((item) => item.id === Number(commentMatch[1]))
        if (resource === undefined) throw new Error(`unexpected_api:${route}`)
        if (assignmentRefetchMismatch && resource.body.includes('REVIEW-AUTHORITY-PUBLICATION')) {
          return { ...resource, body: `${resource.body}\n` }
        }
        if (refetchMismatch) return { ...resource, body: `${resource.body}\n` }
        return refetchActorMismatch ? { ...resource, user: { login: 'wrong-actor' } } : resource
      }
      return base.host.api(route)
    },
    async publishPullRequestReview({ repository, prNumber, exactHead, body }) {
      state.pullReviewMutations += 1
      if (publicationError !== null) throw publicationError
      if (repository !== REPOSITORY || prNumber !== PR || exactHead !== HEAD || body !== expectedBody) {
        throw new Error('unexpected_pull_review_publication')
      }
      const resource = pullReviewResource(9301, body)
      state.pullReviews.push(resource)
      return resource
    },
    async publishTaskIssueComment({ repository, taskIssue, body }) {
      state.taskCommentMutations += 1
      if (publicationError !== null) throw publicationError
      if (repository !== REPOSITORY || taskIssue !== TASK || body !== expectedBody) {
        throw new Error('unexpected_task_comment_publication')
      }
      const resource = taskCommentResource(9302, body)
      state.taskComments.push(resource)
      return resource
    },
    async publishTaskAssignmentComment({ repository, taskIssue, body }) {
      state.assignmentCommentMutations += 1
      if (assignmentError !== null) throw assignmentError
      const expectedAssignmentBody = yamlBlock(resourceReviewPublicationAssignment({
        actor,
        surface: actor === pullAuthor ? 'TASK_ISSUE_COMMENT' : 'PULL_REQUEST_REVIEW',
      }))
      if (repository !== REPOSITORY || taskIssue !== TASK || body !== expectedAssignmentBody) {
        throw new Error('unexpected_task_assignment_publication')
      }
      const resource = taskCommentResource(9401, body, actor)
      state.taskComments.push(resource)
      if (concurrentEquivalentAssignmentOnCreate) state.taskComments.push(taskCommentResource(9402, body))
      return assignmentResponseMismatch ? { ...resource, html_url: 'https://invalid.example/comment' } : resource
    },
    async resolveReviewThread({ threadId }) {
      state.threadResolutionMutations += 1
      const thread = threads.find((item) => item.id === threadId)
      if (thread === undefined) throw new Error('unexpected_review_thread_resolution')
      thread.isResolved = true
      return { ...thread }
    },
    graphql: (...values) => base.host.graphql(...values),
  }
  return { host, state, expectedBody }
}

const canonicalReviewCorrectionTaskBody = () => serializeCanonicalTaskIssueBodyV1({
  request: canonicalTaskBodyRequest({
    title: 'SAME_TASK_CORRECTION_CONTINUATION_COMPLETION_V1',
    objective: taskInput.objective,
    markdown: '# Same-Task Correction Continuation\n\nBounded correction continuation.',
    authorized_paths: PATHS,
    head_branch: BRANCH,
    worktree_path: process.platform === 'win32'
      ? join('C:\\', 'workspace', '.worktrees', 'same-task-correction')
      : join('/workspace', '.worktrees', 'same-task-correction'),
  }),
  mode: 'BOUND_FINAL',
  taskIssue: TASK,
})

const legacyReviewCorrectionTaskBody = () => {
  const body = canonicalReviewCorrectionTaskBody()
  const parsed = parseCanonicalTaskIssueBodyV1({ body, mode: 'BOUND_FINAL' })
  const assignment = structuredClone(parsed.normal_execution_predelegation)
  delete assignment.allowed_changes.allowed_operations.corrected_thread_resolution
  return body.replace(
    yamlBlock(parsed.normal_execution_predelegation),
    yamlBlock(assignment),
  )
}

const reviewFindingEvent = ({ activeThreadIds, exactHead = '4'.repeat(40) }) => {
  const active_thread_ids = [...activeThreadIds].sort()
  const cursorInput = JSON.stringify({
    repository: REPOSITORY,
    task_issue: TASK,
    pull_request: PR,
    exact_head: exactHead,
    active_thread_ids,
  })
  return Object.freeze({
    state: 'CORRECTION_REQUIRED',
    reason: 'blocking_review_threads_present',
    continuation_kind: 'REVIEW_FINDING',
    continuation_cursor: `review-finding-${createHash('sha256').update(cursorInput, 'utf8').digest('hex')}`,
    repository: REPOSITORY,
    task_issue: TASK,
    pull_request: PR,
    exact_head: exactHead,
    expected_base: BASE,
    head_branch: BRANCH,
    authorized_paths: [...PATHS],
    active_thread_ids,
    assignment_materialization_mutation_count: 0,
    publication_mutation_count: 0,
    thread_resolution_mutation_count: 0,
  })
}

let assertions = 0
const equal = (actual, expected) => { assert.equal(actual, expected); assertions += 1 }
const ok = (actual) => { assert.ok(actual); assertions += 1 }
const throws = (fn, expected) => { assert.throws(fn, expected); assertions += 1 }
const captureError = async (fn) => {
  try {
    await fn()
  } catch (error) {
    return error
  }
  throw new Error('expected_error_not_thrown')
}

const taskBody = serializeSimplifiedTaskAuthorityV1(taskInput)
equal(parseSimplifiedTaskAuthorityV1(taskBody).objective, taskInput.objective)
equal(serializeSimplifiedTaskAuthorityV1(parseSimplifiedTaskAuthorityV1(taskBody)), taskBody)
equal(parseSimplifiedTaskAuthorityV1(taskBody).ready_allowed, true)
const taskBodyWithoutReadyPermission = serializeSimplifiedTaskAuthorityV1({ ...taskInput, ready_allowed: false })
equal(parseSimplifiedTaskAuthorityV1(taskBodyWithoutReadyPermission).ready_allowed, false)
const reviewBody = serializeSimplifiedReviewV1(reviewInput())
equal(parseSimplifiedReviewV1(reviewBody).reviewed_head, HEAD)
equal(serializeSimplifiedReviewV1(parseSimplifiedReviewV1(reviewBody)), reviewBody)
const decisionBody = serializeSimplifiedMergeDecisionV1(decisionInput())
equal(parseSimplifiedMergeDecisionV1(decisionBody).exact_head, HEAD)
equal(serializeSimplifiedMergeDecisionV1(parseSimplifiedMergeDecisionV1(decisionBody)), decisionBody)
throws(() => parseSimplifiedTaskAuthorityV1('# placeholder'), /task_authority_invalid/)
throws(() => parseSimplifiedReviewV1(reviewBody.replace('"decision": "APPROVE"', '"decision": "CHANGES_REQUIRED"')), /review_invalid/)
throws(() => parseSimplifiedMergeDecisionV1(`${decisionBody}\n\`\`\`json\n{}\n\`\`\``), /merge_decision_invalid/)

const canonicalTaskUnboundBody = serializeCanonicalTaskIssueBodyV1({
  request: canonicalTaskBodyRequest(),
  mode: 'UNBOUND_CREATE',
})
const canonicalTaskBoundBody = serializeCanonicalTaskIssueBodyV1({
  request: canonicalTaskBodyRequest(),
  mode: 'BOUND_FINAL',
  taskIssue: 526,
})
const parsedCanonicalTaskUnbound = parseCanonicalTaskIssueBodyV1({
  body: canonicalTaskUnboundBody,
  mode: 'UNBOUND_CREATE',
})
const parsedCanonicalTaskBound = parseCanonicalTaskIssueBodyV1({
  body: canonicalTaskBoundBody,
  mode: 'BOUND_FINAL',
})
equal(parsedCanonicalTaskUnbound.task_authority.task_issue, 0)
equal(parsedCanonicalTaskBound.task_authority.task_issue, 526)
equal(parsedCanonicalTaskBound.normal_execution_predelegation.allowed_changes.task_issue, 526)
equal(parsedCanonicalTaskBound.normal_execution_predelegation.task_id, 'TASK-526-NORMAL-EXECUTION-PREDELEGATION')
equal(parsedCanonicalTaskBound.normal_execution_predelegation.allowed_changes.expected_base, BASE)
equal(
  parsedCanonicalTaskBound.normal_execution_predelegation.allowed_changes.allowed_operations
    .task_issue_closure.policy,
  'AUTO_CLOSE_COMPLETED',
)
equal(parsedCanonicalTaskBound.review_publication_predelegation.allowed_changes.task_issue, 526)
equal(parsedCanonicalTaskBound.review_publication_predelegation.task_id, 'TASK-526-REVIEW-PUBLICATION-PREDELEGATION')
equal(parsedCanonicalTaskBound.review_publication_predelegation.allowed_changes.materialization_only, false)
equal(
  parsedCanonicalTaskBound.review_publication_predelegation.allowed_changes.allowed_operations
    .logical_assignment_comment.operation_count,
  1,
)
equal(
  parsedCanonicalTaskBound.review_publication_predelegation.allowed_changes.allowed_operations
    .logical_assignment_comment.direct_refetch_required,
  true,
)
equal(
  parsedCanonicalTaskBound.review_publication_predelegation.allowed_changes.allowed_operations
    .canonical_review_publication.operation_count,
  1,
)
equal(
  parsedCanonicalTaskBound.review_publication_predelegation.allowed_changes.allowed_operations
    .canonical_review_publication.direct_refetch_required,
  true,
)
equal(
  parsedCanonicalTaskBound.review_publication_predelegation.allowed_changes.allowed_operations
    .canonical_review_publication.permitted_surface,
  'TASK_ISSUE_COMMENT',
)
equal(parsedCanonicalTaskBound.task_authority.authorized_paths.join('\n'), [...CANONICAL_TASK_PATHS].sort().join('\n'))
equal(parsedCanonicalTaskBound.normal_execution_predelegation.allowed_changes.authorized_paths.join('\n'), [...CANONICAL_TASK_PATHS].sort().join('\n'))
equal(parsedCanonicalTaskBound.review_publication_predelegation.allowed_changes.authorized_paths.join('\n'), [...CANONICAL_TASK_PATHS].sort().join('\n'))
equal((canonicalTaskBoundBody.match(/^```json$/gmu) ?? []).length, 1)
equal((canonicalTaskBoundBody.match(/^```yaml$/gmu) ?? []).length, 2)
equal(canonicalTaskBoundBody.includes('\r'), false)
equal(canonicalTaskBoundBody.endsWith('\n') && !canonicalTaskBoundBody.endsWith('\n\n'), true)
ok(canonicalTaskBoundBody.includes('日本語'))
ok(canonicalTaskBoundBody.includes('Unicode ✓'))
ok(canonicalTaskBoundBody.includes('embedded # remain content'))
equal(canonicalTaskBoundBody.includes('System.Object[]'), false)
const keepOpenCanonicalTaskBody = serializeCanonicalTaskIssueBodyV1({
  request: canonicalTaskBodyRequest({ task_issue_closure_policy: 'KEEP_OPEN' }),
  mode: 'BOUND_FINAL',
  taskIssue: 526,
})
const parsedKeepOpenCanonicalTaskBody = parseCanonicalTaskIssueBodyV1({
  body: keepOpenCanonicalTaskBody,
  mode: 'BOUND_FINAL',
})
equal(
  parsedKeepOpenCanonicalTaskBody.normal_execution_predelegation.allowed_changes.allowed_operations
    .task_issue_closure.policy,
  'KEEP_OPEN',
)
ok(parsedKeepOpenCanonicalTaskBody.normal_execution_predelegation.forbidden_changes.includes('issue_closure'))
throws(() => serializeCanonicalTaskIssueBodyV1({
  request: canonicalTaskBodyRequest({ task_issue_closure_policy: 'INVALID' }),
  mode: 'UNBOUND_CREATE',
}), /canonical_task_body_request_invalid/)
const legacyCanonicalTaskBody = canonicalTaskBoundBody.replace(
  yamlBlock(parsedCanonicalTaskBound.normal_execution_predelegation),
  '',
)
const parsedLegacyCanonicalTaskBody = parseCanonicalTaskIssueBodyV1({
  body: legacyCanonicalTaskBody,
  mode: 'BOUND_FINAL',
})
equal(parsedLegacyCanonicalTaskBody.normal_execution_predelegation, null)
equal(parsedLegacyCanonicalTaskBody.review_publication_predelegation.allowed_changes.task_issue, 526)
const canonicalTaskDelta = proveCanonicalTaskIssueSelfBindingDeltaV1({
  request: canonicalTaskBodyRequest(),
  unboundBody: canonicalTaskUnboundBody,
  boundBody: canonicalTaskBoundBody,
  taskIssue: 526,
})
equal(canonicalTaskDelta.state, 'PASS')
equal(canonicalTaskDelta.changed_fields.join('\n'), [
  'task_authority.task_issue',
  'review_publication_predelegation.task_id',
  'review_publication_predelegation.authority_source',
  'review_publication_predelegation.canonical_record',
  'review_publication_predelegation.allowed_changes.task_issue',
  'normal_execution_predelegation.task_id',
  'normal_execution_predelegation.authority_source',
  'normal_execution_predelegation.canonical_record',
  'normal_execution_predelegation.allowed_changes.task_issue',
].join('\n'))
equal(canonicalTaskDelta.authorized_paths.join('\n'), [...CANONICAL_TASK_PATHS].sort().join('\n'))
throws(() => parseSimplifiedTaskAuthorityV1(
  serializeSimplifiedTaskAuthorityV1({ ...taskInput, task_issue: 0 }, { binding_mode: 'UNBOUND_CREATE' }),
), /task_authority_invalid/)
equal(parseSimplifiedTaskAuthorityV1(
  serializeSimplifiedTaskAuthorityV1({ ...taskInput, task_issue: 0 }, { binding_mode: 'UNBOUND_CREATE' }),
  { binding_mode: 'UNBOUND_CREATE' },
).task_issue, 0)
throws(() => serializeCanonicalTaskIssueBodyV1({
  request: canonicalTaskBodyRequest({ markdown: '# Invalid\n\nSystem.Object[]' }),
  mode: 'UNBOUND_CREATE',
}), /canonical_task_body_request_invalid/)
throws(() => serializeCanonicalTaskIssueBodyV1({
  request: canonicalTaskBodyRequest({ markdown: '# Invalid\n\n```json\n{}\n```' }),
  mode: 'UNBOUND_CREATE',
}), /canonical_task_body_request_invalid/)
throws(() => serializeCanonicalTaskIssueBodyV1({
  request: canonicalTaskBodyRequest({ authorized_paths: [CANONICAL_TASK_PATHS[0], CANONICAL_TASK_PATHS[0]] }),
  mode: 'UNBOUND_CREATE',
}), /canonical_task_body_request_invalid/)
throws(() => serializeCanonicalTaskIssueBodyV1({
  request: canonicalTaskBodyRequest(),
  mode: 'BOUND_FINAL',
  taskIssue: 0,
}), /canonical_task_body_binding_invalid/)
throws(() => proveCanonicalTaskIssueSelfBindingDeltaV1({
  request: canonicalTaskBodyRequest(),
  unboundBody: canonicalTaskUnboundBody,
  boundBody: canonicalTaskBoundBody.replace('Unicode ✓', 'Unicode changed'),
  taskIssue: 526,
}), /canonical_task_self_binding_delta_invalid|canonical_task_body_invalid/)

// Task #526 regression: a six-path array is rendered as six strings, never as PowerShell's System.Object[].
const task526Paths = Object.freeze([
  'research/sd-prompt-research/concepts/physical-concepts.json',
  'research/sd-prompt-research/concepts/semantic-concepts.json',
  'research/sd-prompt-research/concepts/relations.json',
  'research/sd-prompt-research/concepts/target-patterns.json',
  'research/sd-prompt-research/concepts/unmodeled-effects.json',
  'research/sd-prompt-research/dist/visual-concept-graph.json',
])
const task526Body = serializeCanonicalTaskIssueBodyV1({
  request: canonicalTaskBodyRequest({
    title: 'CAM_004_CONCEPT_GRAPH_EVIDENCE_ADMISSION_V1_SUCCESSOR',
    objective: 'CAM_004_CONCEPT_GRAPH_EVIDENCE_ADMISSION_V1_SUCCESSOR',
    markdown: '# CAM-004 Graph successor\n\nExact approved scope follows from structured input.',
    authorized_paths: [...task526Paths].reverse(),
    head_branch: 'codex/cam-004-concept-graph-evidence-admission-v1-successor',
  }),
  mode: 'BOUND_FINAL',
  taskIssue: 526,
})
const parsedTask526Body = parseCanonicalTaskIssueBodyV1({ body: task526Body, mode: 'BOUND_FINAL' })
equal(parsedTask526Body.task_authority.authorized_paths.join('\n'), [...task526Paths].sort().join('\n'))
equal(task526Body.includes('System.Object[]'), false)
equal((task526Body.match(/^```json$/gmu) ?? []).length, 1)
equal((task526Body.match(/^```yaml$/gmu) ?? []).length, 2)

{
  const directory = mkdtempSync(join(tmpdir(), 'protected-publication-transport-'))
  try {
    const taskAuthorityFile = join(directory, 'task-authority.md')
    const taskAuthorityResult = writeProtectedPublicationBodyFileV1({
      kind: 'task',
      body: taskBody,
      outputFile: taskAuthorityFile,
    })
    equal(taskAuthorityResult.state, 'COMPLETED')
    equal(Buffer.compare(readFileSync(taskAuthorityFile), Buffer.from(taskBody, 'utf8')), 0)

    const canonicalTaskUnboundFile = join(directory, 'canonical-task-unbound.md')
    const canonicalTaskUnboundResult = writeProtectedPublicationBodyFileV1({
      kind: 'canonical_task',
      body: canonicalTaskUnboundBody,
      outputFile: canonicalTaskUnboundFile,
      taskBindingMode: 'UNBOUND_CREATE',
    })
    equal(canonicalTaskUnboundResult.state, 'COMPLETED')
    equal(Buffer.compare(readFileSync(canonicalTaskUnboundFile), Buffer.from(canonicalTaskUnboundBody, 'utf8')), 0)

    const canonicalTaskBoundFile = join(directory, 'canonical-task-bound.md')
    const canonicalTaskBoundResult = writeProtectedPublicationBodyFileV1({
      kind: 'canonical_task',
      body: canonicalTaskBoundBody,
      outputFile: canonicalTaskBoundFile,
      taskBindingMode: 'BOUND_FINAL',
    })
    equal(canonicalTaskBoundResult.state, 'COMPLETED')
    equal(Buffer.compare(readFileSync(canonicalTaskBoundFile), Buffer.from(canonicalTaskBoundBody, 'utf8')), 0)

    const reviewFile = join(directory, 'review.md')
    const reviewPublicationBody = `# 独立レビュー #477\n\n可視 evidence の確認。\n\n${reviewBody}\n追記: # は本文です。\n`
    const reviewResult = writeProtectedPublicationBodyFileV1({
      kind: 'review',
      body: reviewPublicationBody,
      outputFile: reviewFile,
    })
    equal(reviewResult.state, 'COMPLETED')
    equal(Buffer.compare(readFileSync(reviewFile), Buffer.from(reviewPublicationBody, 'utf8')), 0)
    equal(parseSimplifiedReviewV1(readFileSync(reviewFile, 'utf8')).reviewed_head, HEAD)
    ok(readFileSync(reviewFile, 'utf8').includes('\n\n'))
    ok(readFileSync(reviewFile, 'utf8').includes('追記: # は本文です。'))

    const decisionFile = join(directory, 'decision.md')
    const decisionPublicationBody = `# マージ判断\r\n\r\n${decisionBody.replaceAll('\n', '\r\n')}\r\n決定 #482\r\n`
    const decisionResult = writeProtectedPublicationBodyFileV1({
      kind: 'merge',
      body: decisionPublicationBody,
      outputFile: decisionFile,
    })
    equal(decisionResult.state, 'COMPLETED')
    equal(Buffer.compare(readFileSync(decisionFile), Buffer.from(decisionPublicationBody, 'utf8')), 0)
    equal(parseSimplifiedMergeDecisionV1(readFileSync(decisionFile, 'utf8')).exact_head, HEAD)
    ok(readFileSync(decisionFile, 'utf8').includes('\r\n\r\n'))

    const cliReviewInput = join(directory, 'review-input.json')
    const cliReviewOutput = join(directory, 'review-output.md')
    writeFileSync(cliReviewInput, JSON.stringify(reviewInput()), 'utf8')
    const cliReview = spawnSync(process.execPath, [
      fileURLToPath(new URL('./run-protected-transition-admission-v1.mjs', import.meta.url)),
      '--serialize-review-file', cliReviewInput,
      '--publication-body-output-file', cliReviewOutput,
    ], { encoding: 'utf8' })
    equal(cliReview.status, 0)
    equal(JSON.parse(cliReview.stdout).state, 'COMPLETED')
    equal(Buffer.compare(readFileSync(cliReviewOutput), Buffer.from(reviewBody, 'utf8')), 0)
    equal(parseSimplifiedReviewV1(readFileSync(cliReviewOutput, 'utf8')).reviewed_head, HEAD)

    const cliDecisionInput = join(directory, 'decision-input.json')
    const cliDecisionOutput = join(directory, 'decision-output.md')
    writeFileSync(cliDecisionInput, JSON.stringify(decisionInput()), 'utf8')
    const cliDecision = spawnSync(process.execPath, [
      fileURLToPath(new URL('./run-protected-transition-admission-v1.mjs', import.meta.url)),
      '--serialize-merge-decision-file', cliDecisionInput,
      '--publication-body-output-file', cliDecisionOutput,
    ], { encoding: 'utf8' })
    equal(cliDecision.status, 0)
    equal(JSON.parse(cliDecision.stdout).publication_kind, 'merge')
    equal(Buffer.compare(readFileSync(cliDecisionOutput), Buffer.from(decisionBody, 'utf8')), 0)
    equal(parseSimplifiedMergeDecisionV1(readFileSync(cliDecisionOutput, 'utf8')).exact_head, HEAD)

    const cliCanonicalTaskInput = join(directory, 'canonical-task-input.json')
    const cliCanonicalTaskOutput = join(directory, 'canonical-task-output.md')
    writeFileSync(cliCanonicalTaskInput, JSON.stringify(canonicalTaskBodyRequest()), 'utf8')
    const cliCanonicalTask = spawnSync(process.execPath, [
      fileURLToPath(new URL('./run-protected-transition-admission-v1.mjs', import.meta.url)),
      '--serialize-canonical-task-body-file', cliCanonicalTaskInput,
      '--canonical-task-body-mode', 'BOUND_FINAL',
      '--task-issue', '526',
      '--publication-body-output-file', cliCanonicalTaskOutput,
    ], { encoding: 'utf8' })
    equal(cliCanonicalTask.status, 0)
    equal(JSON.parse(cliCanonicalTask.stdout).publication_kind, 'canonical_task')
    equal(Buffer.compare(readFileSync(cliCanonicalTaskOutput), Buffer.from(canonicalTaskBoundBody, 'utf8')), 0)

    const legacyStdout = spawnSync(process.execPath, [
      fileURLToPath(new URL('./run-protected-transition-admission-v1.mjs', import.meta.url)),
      '--serialize-review-file', cliReviewInput,
    ], { encoding: 'utf8' })
    equal(legacyStdout.status, 0)
    equal(legacyStdout.stdout, reviewBody)

    throws(() => writeProtectedPublicationBodyFileV1({
      kind: 'review', body: '', outputFile: join(directory, 'empty.md'),
    }), /publication_transport_body_invalid/)
    throws(() => writeProtectedPublicationBodyFileV1({
      kind: 'review', body: '# malformed', outputFile: join(directory, 'malformed.md'),
    }), /review_invalid/)
    throws(() => writeProtectedPublicationBodyFileV1({
      kind: 'review', body: reviewBody, outputFile: reviewFile,
    }), /publication_transport_invalid/)

    let partialRemoved = false
    throws(() => writeProtectedPublicationBodyFileV1({
      kind: 'review',
      body: reviewBody,
      outputFile: 'partial.md',
      fileHost: {
        openSync: () => 7,
        writeSync: (_descriptor, bytes) => bytes.length - 1,
        fsyncSync: () => {},
        closeSync: () => {},
        readFileSync: () => Buffer.from(reviewBody, 'utf8'),
        unlinkSync: () => { partialRemoved = true },
      },
    }), /publication_transport_invalid/)
    equal(partialRemoved, true)

    let mismatchRemoved = false
    throws(() => writeProtectedPublicationBodyFileV1({
      kind: 'merge',
      body: decisionBody,
      outputFile: 'mismatch.md',
      fileHost: {
        openSync: () => 8,
        writeSync: (_descriptor, bytes) => bytes.length,
        fsyncSync: () => {},
        closeSync: () => {},
        readFileSync: () => Buffer.from(`${decisionBody}corrupt`, 'utf8'),
        unlinkSync: () => { mismatchRemoved = true },
      },
    }), /publication_transport_invalid/)
    equal(mismatchRemoved, true)

    throws(() => writeProtectedPublicationBodyFileV1({
      kind: 'merge',
      body: decisionBody,
      outputFile: 'uncreatable.md',
      fileHost: {
        openSync: () => { throw new Error('permission denied') },
        writeSync: () => 0,
        fsyncSync: () => {},
        closeSync: () => {},
        readFileSync: () => Buffer.alloc(0),
        unlinkSync: () => {},
      },
    }), /publication_transport_invalid/)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

const createCanonicalTaskPublicationHost = ({
  taskIssue = 526,
  authenticatedActor = 'whatrune',
  resourceAuthor = 'whatrune',
  resourceAuthorAssociation = 'OWNER',
  createError = null,
  createBodyMismatch = false,
  patchError = null,
  patchRefetchMismatch = false,
} = {}) => {
  const state = {
    actorApiCalls: 0, issueApiCalls: 0, createCalls: 0, patchCalls: 0,
    title: null, body: null, patched: false,
  }
  const resource = (body = state.body) => ({
    number: taskIssue,
    title: state.title,
    body,
    state: 'open',
    html_url: `https://github.com/${REPOSITORY}/issues/${taskIssue}`,
    user: { login: resourceAuthor },
    author_association: resourceAuthorAssociation,
  })
  return {
    state,
    host: {
      api: async (route) => {
        if (route === 'user') {
          state.actorApiCalls += 1
          return { login: authenticatedActor }
        }
        state.issueApiCalls += 1
        equal(route, `repos/${REPOSITORY}/issues/${taskIssue}`)
        return resource(state.patched && patchRefetchMismatch ? `${state.body}corrupt` : state.body)
      },
      createTaskIssue: async ({ repository, title, body }) => {
        state.createCalls += 1
        equal(repository, REPOSITORY)
        state.title = title
        state.body = body
        if (createError !== null) throw createError
        return resource(createBodyMismatch ? `${body}corrupt` : body)
      },
      patchTaskIssueBody: async ({ repository, taskIssue: patchedTaskIssue, body }) => {
        state.patchCalls += 1
        equal(repository, REPOSITORY)
        equal(patchedTaskIssue, taskIssue)
        if (patchError !== null) throw patchError
        state.body = body
        state.patched = true
        return resource()
      },
    },
  }
}

{
  const fixture = createCanonicalTaskPublicationHost()
  const result = await publishCanonicalTaskIssueV1({
    request: canonicalTaskBodyRequest(),
    host: fixture.host,
  })
  equal(result.state, 'COMPLETED')
  equal(result.task_issue, 526)
  equal(result.create_mutation_count, 1)
  equal(result.patch_mutation_count, 1)
  equal(result.task_authority_count, 1)
  equal(result.normal_execution_predelegation_count, 1)
  equal(result.review_publication_predelegation_count, 1)
  equal(result.self_binding_delta.state, 'PASS')
  equal(result.self_binding_delta.changed_fields.join('\n'), canonicalTaskDelta.changed_fields.join('\n'))
  equal(fixture.state.createCalls, 1)
  equal(fixture.state.patchCalls, 1)
  equal(fixture.state.actorApiCalls, 1)
  equal(fixture.state.issueApiCalls, 2)
  const final = parseCanonicalTaskIssueBodyV1({ body: fixture.state.body, mode: 'BOUND_FINAL' })
  equal(final.task_authority.task_issue, 526)
  equal(final.normal_execution_predelegation.allowed_changes.task_issue, 526)
  equal(final.review_publication_predelegation.allowed_changes.task_issue, 526)
}

{
  const fixture = createCanonicalTaskPublicationHost({ createError: new Error('transport lost') })
  const error = await captureError(() => publishCanonicalTaskIssueV1({
    request: canonicalTaskBodyRequest(),
    host: fixture.host,
  }))
  equal(error.message, 'transport lost')
  equal(fixture.state.actorApiCalls, 1)
  equal(fixture.state.createCalls, 1)
  equal(fixture.state.patchCalls, 0)
  equal(fixture.state.issueApiCalls, 0)
}

{
  const fixture = createCanonicalTaskPublicationHost({ createBodyMismatch: true })
  const error = await captureError(() => publishCanonicalTaskIssueV1({
    request: canonicalTaskBodyRequest(),
    host: fixture.host,
  }))
  equal(error.message, 'canonical_task_issue_resource_mismatch')
  equal(fixture.state.actorApiCalls, 1)
  equal(fixture.state.createCalls, 1)
  equal(fixture.state.patchCalls, 0)
  equal(fixture.state.issueApiCalls, 0)
}

{
  const fixture = createCanonicalTaskPublicationHost({ patchError: new Error('patch transport lost') })
  const error = await captureError(() => publishCanonicalTaskIssueV1({
    request: canonicalTaskBodyRequest(),
    host: fixture.host,
  }))
  equal(error.message, 'patch transport lost')
  equal(fixture.state.actorApiCalls, 1)
  equal(fixture.state.createCalls, 1)
  equal(fixture.state.patchCalls, 1)
  equal(fixture.state.issueApiCalls, 1)
}

{
  const fixture = createCanonicalTaskPublicationHost({ patchRefetchMismatch: true })
  const error = await captureError(() => publishCanonicalTaskIssueV1({
    request: canonicalTaskBodyRequest(),
    host: fixture.host,
  }))
  equal(error.message, 'canonical_task_issue_resource_mismatch')
  equal(fixture.state.actorApiCalls, 1)
  equal(fixture.state.createCalls, 1)
  equal(fixture.state.patchCalls, 1)
  equal(fixture.state.issueApiCalls, 2)
}

{
  const fixture = createCanonicalTaskPublicationHost({ authenticatedActor: 'collaborator' })
  const error = await captureError(() => publishCanonicalTaskIssueV1({
    request: canonicalTaskBodyRequest(),
    host: fixture.host,
  }))
  equal(error.message, 'canonical_task_issue_actor_invalid')
  equal(fixture.state.actorApiCalls, 1)
  equal(fixture.state.createCalls, 0)
  equal(fixture.state.patchCalls, 0)
  equal(fixture.state.issueApiCalls, 0)
}

{
  const fixture = createCanonicalTaskPublicationHost({ resourceAuthor: 'collaborator' })
  const error = await captureError(() => publishCanonicalTaskIssueV1({
    request: canonicalTaskBodyRequest(),
    host: fixture.host,
  }))
  equal(error.message, 'canonical_task_issue_resource_mismatch')
  equal(fixture.state.actorApiCalls, 1)
  equal(fixture.state.createCalls, 1)
  equal(fixture.state.patchCalls, 0)
  equal(fixture.state.issueApiCalls, 0)
}

{
  const fixture = createCanonicalTaskPublicationHost({ resourceAuthorAssociation: 'COLLABORATOR' })
  const error = await captureError(() => publishCanonicalTaskIssueV1({
    request: canonicalTaskBodyRequest(),
    host: fixture.host,
  }))
  equal(error.message, 'canonical_task_issue_resource_mismatch')
  equal(fixture.state.actorApiCalls, 1)
  equal(fixture.state.createCalls, 1)
  equal(fixture.state.patchCalls, 0)
  equal(fixture.state.issueApiCalls, 0)
}

const terminalRepositoryPath = process.platform === 'win32'
  ? join('C:\\', 'workspace')
  : join('/workspace')
const terminalWorktreePath = join(terminalRepositoryPath, '.worktrees', 'task-429')
const terminalSyncResult = (overrides = {}) => ({
  state: 'PASS',
  reason: 'local_main_fast_forwarded',
  action: 'FAST_FORWARD',
  repository: terminalRepositoryPath,
  local_main_before: BASE,
  origin_main: MERGE,
  local_main_after: MERGE,
  local_only_commits: 0,
  merge_outcome_affected: false,
  worktree_cleanup_may_continue: true,
  ...overrides,
})
const terminalCleanupResult = (overrides = {}) => ({
  state: 'PASS',
  reason: 'task_worktree_cleanup_completed',
  action: 'GIT_REMOVE',
  repository: terminalRepositoryPath,
  retired_worktree: terminalWorktreePath,
  residual_removed: false,
  branch_refs_preserved: true,
  git_remove_exit_code: 0,
  git_remove_stderr: '',
  git_common_directory: join(terminalRepositoryPath, '.git'),
  worktree_administration_directory: join(terminalRepositoryPath, '.git', 'worktrees', 'task-429'),
  git_common_directory_capability: 'PROVEN',
  merge_outcome_affected: false,
  ...overrides,
})
const terminalCloseRequest = (overrides = {}) => ({
  repository: REPOSITORY,
  task_issue: TASK,
  pull_request: PR,
  exact_head: HEAD,
  head_branch: BRANCH,
  worktree_path: terminalWorktreePath,
  local_main_sync_result: terminalSyncResult(),
  worktree_cleanup_result: terminalCleanupResult(),
  ...overrides,
})
const createTerminalCloseFixture = ({
  policy = 'AUTO_CLOSE_COMPLETED',
  legacy = false,
  issueState = 'open',
  issueStateReason = null,
  pullHead = HEAD,
  comparisonStatus = 'identical',
  closeError = null,
  closeResponseMismatch = false,
  closeRefetchMismatch = false,
  beforeMutationPolicy = null,
  beforeMutationIssueState = null,
  beforeMutationIssueStateReason = null,
} = {}) => {
  const bodyForPolicy = (closurePolicy) => serializeCanonicalTaskIssueBodyV1({
    request: canonicalTaskBodyRequest({
      title: 'POST_MERGE_TASK_AUTO_CLOSE_V1',
      objective: taskInput.objective,
      markdown: '# Post-Merge Task Auto Close',
      authorized_paths: PATHS,
      head_branch: BRANCH,
      worktree_path: terminalWorktreePath,
      task_issue_closure_policy: closurePolicy,
    }),
    mode: 'BOUND_FINAL',
    taskIssue: TASK,
  })
  const canonicalBody = bodyForPolicy(policy)
  let body = canonicalBody
  if (legacy) {
    const parsed = parseCanonicalTaskIssueBodyV1({ body, mode: 'BOUND_FINAL' })
    const assignment = structuredClone(parsed.normal_execution_predelegation)
    delete assignment.allowed_changes.allowed_operations.task_issue_closure
    assignment.forbidden_changes = [...assignment.forbidden_changes, 'issue_closure']
    body = body.replace(yamlBlock(parsed.normal_execution_predelegation), yamlBlock(assignment))
    parseCanonicalTaskIssueBodyV1({ body, mode: 'BOUND_FINAL' })
  }
  const state = {
    issueState,
    issueStateReason,
    issueBody: body,
    issueReads: 0,
    closeMutations: 0,
  }
  const issueResource = () => ({
    number: TASK,
    state: state.issueState,
    state_reason: state.issueStateReason,
    html_url: `https://github.com/${REPOSITORY}/issues/${TASK}`,
    user: { login: 'whatrune' },
    author_association: 'OWNER',
    body: closeRefetchMismatch && state.issueReads > 2 ? `${state.issueBody}\n` : state.issueBody,
  })
  const host = {
    async api(route) {
      if (route === 'user') return { login: 'whatrune' }
      if (route === `repos/${REPOSITORY}/issues/${TASK}`) {
        state.issueReads += 1
        if (state.issueReads === 2) {
          if (beforeMutationPolicy !== null) state.issueBody = bodyForPolicy(beforeMutationPolicy)
          if (beforeMutationIssueState !== null) state.issueState = beforeMutationIssueState
          if (beforeMutationIssueStateReason !== null) {
            state.issueStateReason = beforeMutationIssueStateReason
          }
        }
        return issueResource()
      }
      if (route === `repos/${REPOSITORY}/pulls/${PR}`) return {
        number: PR,
        state: 'closed',
        merged: true,
        head: { sha: pullHead, ref: BRANCH, repo: { full_name: REPOSITORY } },
        base: { ref: 'main', repo: { full_name: REPOSITORY } },
        merge_commit_sha: MERGE,
      }
      if (route === `repos/${REPOSITORY}/git/ref/heads/main`) {
        return { ref: 'refs/heads/main', object: { sha: MERGE } }
      }
      if (route === `repos/${REPOSITORY}/compare/${MERGE}...${MERGE}`) {
        return { status: comparisonStatus }
      }
      throw new Error(`unexpected_api:${route}`)
    },
    async closeTaskIssue({ repository, taskIssue }) {
      state.closeMutations += 1
      equal(repository, REPOSITORY)
      equal(taskIssue, TASK)
      if (closeError !== null) throw closeError
      state.issueState = 'closed'
      state.issueStateReason = 'completed'
      const resource = issueResource()
      return closeResponseMismatch ? { ...resource, body: `${resource.body}\n` } : resource
    },
  }
  return { host, state, body }
}

{
  const fixture = createTerminalCloseFixture()
  const result = await closeCanonicalTaskIssueAfterTerminalCleanupV1({
    request: terminalCloseRequest(),
    host: fixture.host,
  })
  equal(result.state, 'PASS')
  equal(result.reason, 'task_issue_closed_completed')
  equal(result.closure_policy, 'AUTO_CLOSE_COMPLETED')
  equal(result.mutation_count, 1)
  equal(result.issue_state, 'closed')
  equal(result.issue_state_reason, 'completed')
  equal(result.body_preserved, true)
  equal(result.merge_outcome_affected, false)
  equal(result.cleanup_outcome_affected, false)
  equal(fixture.state.closeMutations, 1)
  equal(fixture.state.issueReads, 3)
  equal(fixture.state.issueBody, fixture.body)
}

{
  const fixture = createTerminalCloseFixture({ issueState: 'closed', issueStateReason: 'not_planned' })
  const result = await closeCanonicalTaskIssueAfterTerminalCleanupV1({
    request: terminalCloseRequest(), host: fixture.host,
  })
  equal(result.reason, 'task_issue_already_closed')
  equal(result.issue_state_reason, 'not_planned')
  equal(result.mutation_count, 0)
  equal(fixture.state.closeMutations, 0)
  equal(fixture.state.issueReads, 2)
}

for (const options of [{ policy: 'KEEP_OPEN' }, { legacy: true }]) {
  const fixture = createTerminalCloseFixture(options)
  const result = await closeCanonicalTaskIssueAfterTerminalCleanupV1({
    request: terminalCloseRequest(), host: fixture.host,
  })
  equal(result.reason, 'task_issue_keep_open')
  equal(result.closure_policy, 'KEEP_OPEN')
  equal(result.mutation_count, 0)
  equal(fixture.state.closeMutations, 0)
  equal(fixture.state.issueReads, 2)
}

{
  const fixture = createTerminalCloseFixture({ beforeMutationPolicy: 'KEEP_OPEN' })
  const result = await closeCanonicalTaskIssueAfterTerminalCleanupV1({
    request: terminalCloseRequest(), host: fixture.host,
  })
  equal(result.reason, 'task_issue_keep_open')
  equal(result.closure_policy, 'KEEP_OPEN')
  equal(result.mutation_count, 0)
  equal(fixture.state.closeMutations, 0)
  equal(fixture.state.issueReads, 2)
}

{
  const fixture = createTerminalCloseFixture({
    beforeMutationIssueState: 'closed',
    beforeMutationIssueStateReason: 'completed',
  })
  const result = await closeCanonicalTaskIssueAfterTerminalCleanupV1({
    request: terminalCloseRequest(), host: fixture.host,
  })
  equal(result.reason, 'task_issue_already_closed')
  equal(result.mutation_count, 0)
  equal(fixture.state.closeMutations, 0)
  equal(fixture.state.issueReads, 2)
}

{
  const fixture = createTerminalCloseFixture()
  const error = await captureError(() => closeCanonicalTaskIssueAfterTerminalCleanupV1({
    request: terminalCloseRequest({
      local_main_sync_result: terminalSyncResult({ state: 'FAILED' }),
    }),
    host: fixture.host,
  }))
  equal(error.message, 'post_merge_task_close_terminal_gate_invalid')
  equal(fixture.state.closeMutations, 0)
  equal(fixture.state.issueReads, 0)
}

{
  const fixture = createTerminalCloseFixture({ pullHead: '9'.repeat(40) })
  const error = await captureError(() => closeCanonicalTaskIssueAfterTerminalCleanupV1({
    request: terminalCloseRequest(), host: fixture.host,
  }))
  equal(error.message, 'task_issue_close_merge_binding_invalid')
  equal(fixture.state.closeMutations, 0)
}

{
  const fixture = createTerminalCloseFixture({ closeError: new Error('transport outcome unknown') })
  const error = await captureError(() => closeCanonicalTaskIssueAfterTerminalCleanupV1({
    request: terminalCloseRequest(), host: fixture.host,
  }))
  equal(error.message, 'transport outcome unknown')
  equal(fixture.state.closeMutations, 1)
  equal(fixture.state.issueReads, 2)
}

{
  const fixture = createTerminalCloseFixture({ closeResponseMismatch: true })
  const error = await captureError(() => closeCanonicalTaskIssueAfterTerminalCleanupV1({
    request: terminalCloseRequest(), host: fixture.host,
  }))
  equal(error.message, 'task_issue_close_response_invalid')
  equal(fixture.state.closeMutations, 1)
  equal(fixture.state.issueReads, 2)
}

{
  const fixture = createTerminalCloseFixture({ closeRefetchMismatch: true })
  const error = await captureError(() => closeCanonicalTaskIssueAfterTerminalCleanupV1({
    request: terminalCloseRequest(), host: fixture.host,
  }))
  equal(error.message, 'task_issue_close_resource_mismatch')
  equal(fixture.state.closeMutations, 1)
  equal(fixture.state.issueReads, 3)
}

const allChecks = [check('validate', 15368), check('build-preview', 15368), check('Cloudflare Pages', 85455)]
equal(classifyValidationPathsV1(['research/sd-prompt-research/experiments/hair/HAIR-001-A/observation.json']).profile, 'RESEARCH_EXPERIMENT')
equal(classifyValidationPathsV1(['research/sd-prompt-research/concepts/physical-concepts.json']).profile, 'CONCEPT_GRAPH')
equal(classifyValidationPathsV1(['data/visual-concept-prompt-tag-bindings-v1.json', 'src/visualConceptProductionAdvisoryV1.ts']).profile, 'PRODUCTION_ADVISORY')
equal(classifyValidationPathsV1(['data/prompt-tags.json']).profile, 'PROMPT_DATA')
equal(classifyValidationPathsV1(['src/main.tsx']).profile, 'APPLICATION')
equal(classifyValidationPathsV1(['scripts/ordinary-platform-check.mjs']).profile, 'PLATFORM')
equal(classifyValidationPathsV1(['docs/product/guide.md']).profile, 'DOCUMENTATION')
equal(classifyValidationPathsV1(['unknown/new.bin']).profile, 'FULL_RESEARCH')
equal(classifyValidationPathsV1(['docs/product/guide.md', 'src/main.tsx']).fallback_reason, 'mixed_ownership_classes')
equal(classifyValidationPathsV1([]).fallback_reason, 'empty_changed_path_set')
equal(classifyValidationPathsV1(['docs/a.md', 'docs/a.md']).fallback_reason, 'duplicate_changed_path')
equal(classifyValidationPathsV1(['a//b']).fallback_reason, 'malformed_changed_path')
equal(classifyValidationPathsV1(['docs/x\ny.md']).fallback_reason, 'malformed_changed_path')
equal(classifyValidationPathsV1(['docs/x\u007fy.md']).fallback_reason, 'malformed_changed_path')
equal(classifyValidationPathsV1(['C:/docs/a.md']).fallback_reason, 'malformed_changed_path')
equal(classifyValidationPathsV1(['data/validation-path-ownership-v1.json']).profile, 'FULL_RESEARCH')
equal(classifyValidationPathsV1(['research/sd-prompt-research/requirements.lock.txt']).profile, 'FULL_RESEARCH')
equal(classifyValidationPathsV1(['scripts/acquire-python-validation-environment-v1.ps1']).profile, 'FULL_RESEARCH')
equal(classifyValidationPathsV1(['scripts/test-python-validation-environment-v1.ps1']).profile, 'FULL_RESEARCH')
equal(classifyValidationPathsV1(['scripts/validate-dictionaries.mjs']).profile, 'FULL_RESEARCH')

const validationWorkflow = readFileSync(new URL('../.github/workflows/research-claims.yml', import.meta.url), 'utf8')
const pythonCacheHelper = readFileSync(new URL('./acquire-python-validation-environment-v1.ps1', import.meta.url), 'utf8')
const pythonLock = readFileSync(new URL('../research/sd-prompt-research/requirements.lock.txt', import.meta.url), 'utf8')
ok(validationWorkflow.includes('actions/cache@v4'))
ok(validationWorkflow.includes('acquire-python-validation-environment-v1.ps1'))
ok(validationWorkflow.includes('test-python-validation-environment-v1.ps1'))
ok(validationWorkflow.includes("steps.profile.outputs.run_python_cache_matrix == 'true'"))
ok(validationWorkflow.includes('"$VALIDATION_PYTHON" -B -E -s'))
equal(validationWorkflow.includes('python -m pip install -r research/sd-prompt-research/requirements.txt'), false)
ok(pythonCacheHelper.includes("Join-Path $gitCommonDirectory 'codex-cache/python-validation-v1'"))
ok(pythonCacheHelper.includes("'--require-hashes'"))
ok(pythonCacheHelper.includes("$script:RequiredImports = @('yaml', 'jsonschema', 'rfc8785', 'PIL', 'reportlab', 'pypdf')"))
equal((pythonLock.match(/^[-A-Za-z0-9_.]+==/gm) ?? []).length, 12)
ok((pythonLock.match(/--hash=sha256:[0-9a-f]{64}/g) ?? []).length >= 12)

const discoveredDictionaryFiles = discoverPromptTagDictionaryFilesV1([
  'hair.json',
  'validation-path-ownership-v1.json',
  'visual-concept-advisory-relation-allowlist-v1.json',
  'visual-concept-prompt-tag-bindings-v1.json',
  'slots.json',
  'unexpected-data-contract.json',
  'notes.md',
])
equal(discoveredDictionaryFiles.join(','), 'hair.json,unexpected-data-contract.json')
equal(parsePromptTagDictionaryV1('hair.json', '[{"id":"hai-long-hair","prompt":"long hair","category":"hair"}]').length, 1)
throws(() => validatePromptTagDictionaryRootV1('hair.json', [{ id: 'broken', prompt: '', category: 'hair' }]), /invalid row/)
throws(() => validatePromptTagDictionaryRootV1('unexpected-data-contract.json', { catalog: true }), /dictionary root must be an array/)
throws(() => parsePromptTagDictionaryV1('foreign-malformed.json', '{'), SyntaxError)
equal(evaluateRequiredChecksV1({ checks: allChecks, paths: PATHS, exactHead: HEAD }).length, 3)
equal(evaluateRequiredChecksV1({ checks: allChecks, paths: ['data/visual-concept-prompt-tag-bindings-v1.json', 'scripts/test-visual-concept-read-only-inspection-v1.mjs'], exactHead: HEAD }).length, 3)
equal(evaluateRequiredChecksV1({ checks: allChecks, paths: ['unknown/new.bin'], exactHead: HEAD }).length, 3)
equal(evaluateRequiredChecksV1({ checks: [check('validate', 15368)], paths: ['docs/product/guide.md'], exactHead: HEAD }).length, 1)
equal(evaluateRequiredChecksV1({ checks: [check('validate', 15368)], paths: ['research/sd-prompt-research/experiments/hair/HAIR-001-A/observation.json'], exactHead: HEAD }).length, 1)
equal(evaluateRequiredChecksV1({ checks: allChecks, paths: ['research/sd-prompt-research/experiments/hair/HAIR-001-A/observation.json'], exactHead: HEAD }).length, 1)
equal(evaluateRequiredChecksV1({ checks: [check('validate', 15368)], paths: ['research/sd-prompt-research/concepts/physical-concepts.json', 'research/sd-prompt-research/dist/visual-concept-graph.json'], exactHead: HEAD }).length, 1)
equal(evaluateRequiredChecksV1({ checks: allChecks, paths: ['research/sd-prompt-research/concepts/physical-concepts.json', 'research/sd-prompt-research/dist/visual-concept-graph.json'], exactHead: HEAD }).length, 1)
equal(evaluateRequiredChecksV1({ checks: allChecks, paths: ['research/sd-prompt-research/concepts/physical-concepts.json', 'src/data/visual-concept-production-advisory-v1.json'], exactHead: HEAD }).length, 3)
equal(evaluateRequiredChecksV1({ checks: allChecks, paths: ['data/validation-path-ownership-v1.json'], exactHead: HEAD }).length, 3)
throws(() => evaluateRequiredChecksV1({ checks: [check('build-preview', 15368), check('Cloudflare Pages', 85455)], paths: PATHS, exactHead: HEAD }), /required_check_missing:validate/)
throws(() => evaluateRequiredChecksV1({ checks: [check('validate', 15368), check('Cloudflare Pages', 85455)], paths: PATHS, exactHead: HEAD }), /required_check_missing:build-preview/)
throws(() => evaluateRequiredChecksV1({ checks: [check('validate', 15368), check('build-preview', 15368, { conclusion: 'FAILURE' }), check('Cloudflare Pages', 85455)], paths: PATHS, exactHead: HEAD }), /required_check_not_successful:build-preview/)

{
  const fixture = createFixture()
  const snapshot = await acquireSimplifiedPreDecisionPreflightV1({ request: preDecisionInput(), host: fixture.host })
  equal(snapshot.task_issue, TASK)
  equal(snapshot.pr_number, PR)
  equal(snapshot.exact_head, HEAD)
  equal(snapshot.expected_base, BASE)
  equal(snapshot.authorized_paths.join(','), PATHS.slice().sort().join(','))
  equal(snapshot.required_checks.length, 3)
  equal(snapshot.thread_ids.length, 0)
  equal(snapshot.mergeable, 'MERGEABLE')
  equal(fixture.state.mergeMutations, 0)
}
{
  const fixture = createFixture({ threads: [{ id: 'thread-1', isResolved: false, isOutdated: false }] })
  const error = await captureError(() => acquireSimplifiedPreDecisionPreflightV1({ request: preDecisionInput(), host: fixture.host }))
  equal(error.message, 'blocking_review_threads_present')
  equal(fixture.state.mergeMutations, 0)
}
{
  const fixture = createFixture({ checks: [check('validate', 15368), check('build-preview', 15368), check('Cloudflare Pages', 85455, { status: 'IN_PROGRESS', conclusion: null })] })
  const error = await captureError(() => acquireSimplifiedPreDecisionPreflightV1({ request: preDecisionInput(), host: fixture.host }))
  equal(error.message, 'required_check_not_successful:Cloudflare Pages')
  equal(fixture.state.mergeMutations, 0)
}
{
  const fixture = createFixture({ main: '4'.repeat(40) })
  const error = await captureError(() => acquireSimplifiedPreDecisionPreflightV1({ request: preDecisionInput(), host: fixture.host }))
  equal(error.message, 'live_binding_invalid')
  equal(fixture.state.mergeMutations, 0)
}
{
  const fixture = createFixture({ draft: true })
  const error = await captureError(() => acquireSimplifiedPreDecisionPreflightV1({ request: preDecisionInput(), host: fixture.host }))
  equal(error.message, 'live_binding_invalid')
  equal(fixture.state.mergeMutations, 0)
}
{
  const fixture = createFixture({ head: '4'.repeat(40) })
  const error = await captureError(() => acquireSimplifiedPreDecisionPreflightV1({ request: preDecisionInput(), host: fixture.host }))
  equal(error.message, 'review_threads_acquisition_failed')
  equal(fixture.state.mergeMutations, 0)
}
{
  const fixture = createFixture({ reviewHead: BASE })
  const error = await captureError(() => acquireSimplifiedPreDecisionPreflightV1({ request: preDecisionInput(), host: fixture.host }))
  equal(error.message, 'live_binding_invalid')
  equal(fixture.state.mergeMutations, 0)
}
{
  const fixture = createFixture({ paths: ['AGENTS.md'] })
  const error = await captureError(() => acquireSimplifiedPreDecisionPreflightV1({ request: preDecisionInput(), host: fixture.host }))
  equal(error.message, 'live_binding_invalid')
  equal(fixture.state.mergeMutations, 0)
}
{
  const fixture = createFixture({ mergeable: 'CONFLICTING', mergeStateStatus: 'DIRTY' })
  const error = await captureError(() => acquireSimplifiedPreDecisionPreflightV1({ request: preDecisionInput(), host: fixture.host }))
  equal(error.message, 'mergeability_invalid')
  equal(fixture.state.mergeMutations, 0)
}
{
  const fixture = createFixture()
  const error = await captureError(() => acquireSimplifiedPreDecisionPreflightV1({
    request: { ...preDecisionInput(), unknown_field: true },
    host: fixture.host,
  }))
  equal(error.message, 'pre_decision_preflight_request_invalid')
  equal(fixture.state.mergeMutations, 0)
}

// Semantic approval alone never grants the separate protected publication action.
{
  const fixture = createReviewRoutingFixture({ includeAuthority: false })
  equal((await captureError(() => ensureReviewAuthorityAndRunPreflightV1({
    request: reviewRoutingInput(), host: fixture.host,
  }))).message, 'review_publication_predelegation_required')
  equal(fixture.state.taskCommentMutations + fixture.state.pullReviewMutations, 0)
}

// An exact Product Owner Task Assignment admits the self-authored compatibility surface.
{
  const fixture = createReviewRoutingFixture()
  const result = await ensureReviewAuthorityAndRunPreflightV1({ request: reviewRoutingInput(), host: fixture.host })
  equal(result.state, 'MERGE_READY')
  equal(result.publication_route, 'TASK_ISSUE_COMMENT')
  equal(result.publication_mutation_count, 1)
  equal(result.review_kind, 'TASK_ISSUE_COMMENT')
  equal(result.exact_head, HEAD)
  equal(fixture.state.taskCommentMutations, 1)
  equal(fixture.state.pullReviewMutations, 0)
  equal(result.preflight.review_actor, 'whatrune')
  equal(result.publication_authority_record, `https://github.com/${REPOSITORY}/issues/${TASK}`)
}

// A separately actor-bound Task Assignment preserves the normal PR APPROVE route.
{
  const fixture = createReviewRoutingFixture({ actor: 'independent-reviewer' })
  const result = await ensureReviewAuthorityAndRunPreflightV1({ request: reviewRoutingInput(), host: fixture.host })
  equal(result.state, 'MERGE_READY')
  equal(result.publication_route, 'PULL_REQUEST_REVIEW')
  equal(result.publication_mutation_count, 1)
  equal(result.review_kind, 'PULL_REQUEST_REVIEW')
  equal(fixture.state.pullReviewMutations, 1)
  equal(fixture.state.taskCommentMutations, 0)
  equal(result.preflight.review_actor, 'independent-reviewer')
}

// Exactly one byte-identical current-HEAD authority is reused without publication.
{
  const fixture = createReviewRoutingFixture({
    existing: [{ kind: 'TASK_ISSUE_COMMENT' }], includeAuthority: false,
  })
  const result = await ensureReviewAuthorityAndRunPreflightV1({ request: reviewRoutingInput(), host: fixture.host })
  equal(result.state, 'MERGE_READY')
  equal(result.publication_route, 'REUSED')
  equal(result.publication_mutation_count, 0)
  equal(result.review_kind, 'TASK_ISSUE_COMMENT')
  equal(fixture.state.pullReviewMutations + fixture.state.taskCommentMutations, 0)
  equal(result.publication_authority_record, null)
}

// A concurrently published exact authority is reused during the final mutation-boundary recheck.
{
  const fixture = createReviewRoutingFixture({ authorityAppearsBeforeMutation: true })
  const result = await ensureReviewAuthorityAndRunPreflightV1({ request: reviewRoutingInput(), host: fixture.host })
  equal(result.publication_route, 'REUSED')
  equal(result.publication_mutation_count, 0)
  equal(result.review_id, 9299)
  equal(fixture.state.pullReviewMutations + fixture.state.taskCommentMutations, 0)
}

// V2 derives assignment authority from stable predelegation plus a complete fresh-state guard.
{
  const fixture = createReviewRoutingFixture({ includeAuthority: false, includePredelegation: true })
  const result = await ensureReviewAuthorityAndRunPreflightV1({ request: reviewRoutingInput(), host: fixture.host })
  equal(result.state, 'MERGE_READY')
  equal(result.assignment_materialization_mutation_count, 1)
  equal(result.logical_assignment_resource_count, 1)
  equal(result.publication_mutation_count, 1)
  equal(result.publication_authority_record, `https://github.com/${REPOSITORY}/issues/${TASK}#issuecomment-9401`)
  equal(fixture.state.assignmentCommentMutations, 1)
  equal(fixture.state.taskCommentMutations, 1)
  equal(fixture.state.pullReviewMutations, 0)
}

// The second operation is bound to the selected surface and preserves the distinct-actor PR Review route.
{
  const fixture = createReviewRoutingFixture({
    actor: 'independent-reviewer', includeAuthority: false, includePredelegation: true,
  })
  const result = await ensureReviewAuthorityAndRunPreflightV1({
    request: reviewRoutingInput(), host: fixture.host,
  })
  equal(result.state, 'MERGE_READY')
  equal(result.assignment_materialization_mutation_count, 1)
  equal(result.publication_route, 'PULL_REQUEST_REVIEW')
  equal(result.publication_mutation_count, 1)
  equal(fixture.state.assignmentCommentMutations, 1)
  equal(fixture.state.taskCommentMutations, 0)
  equal(fixture.state.pullReviewMutations, 1)
}

// Existing in-flight Tasks retain their already-declared two-resource outcome without a body mutation.
{
  const fixture = createReviewRoutingFixture({
    includeAuthority: false,
    authorityBody: taskBodyWithLegacyReviewPublicationPredelegation(),
  })
  const result = await ensureReviewAuthorityAndRunPreflightV1({
    request: reviewRoutingInput(), host: fixture.host,
  })
  equal(result.state, 'MERGE_READY')
  equal(result.assignment_materialization_mutation_count, 1)
  equal(result.publication_mutation_count, 1)
  equal(fixture.state.assignmentCommentMutations, 1)
  equal(fixture.state.taskCommentMutations, 1)
}

// Both predelegated mutations are explicit, exactly-once, and direct-refetch-bound.
for (const allowed_operations of [
  {
    logical_assignment_comment: { operation_count: 2, direct_refetch_required: true },
    canonical_review_publication: {
      operation_count: 1, direct_refetch_required: true, permitted_surface: 'TASK_ISSUE_COMMENT',
    },
  },
  {
    logical_assignment_comment: { operation_count: 1, direct_refetch_required: true },
    canonical_review_publication: {
      operation_count: 0, direct_refetch_required: true, permitted_surface: 'TASK_ISSUE_COMMENT',
    },
  },
  {
    logical_assignment_comment: { operation_count: 1, direct_refetch_required: false },
    canonical_review_publication: {
      operation_count: 1, direct_refetch_required: true, permitted_surface: 'TASK_ISSUE_COMMENT',
    },
  },
  {
    logical_assignment_comment: { operation_count: 1, direct_refetch_required: true },
  },
  {
    logical_assignment_comment: { operation_count: 1, direct_refetch_required: true },
    canonical_review_publication: {
      operation_count: 1, direct_refetch_required: true, permitted_surface: 'PULL_REQUEST_REVIEW',
    },
  },
]) {
  const fixture = createReviewRoutingFixture({
    includeAuthority: false,
    includePredelegation: true,
    predelegationGrantOverrides: { allowed_operations },
  })
  equal((await captureError(() => ensureReviewAuthorityAndRunPreflightV1({
    request: reviewRoutingInput(), host: fixture.host,
  }))).message, 'review_publication_predelegation_invalid')
  equal(
    fixture.state.assignmentCommentMutations + fixture.state.taskCommentMutations + fixture.state.pullReviewMutations,
    0,
  )
}

// A closed Fresh Review is semantic publication input; continuation identities are optional diagnostics.
{
  const fixture = createReviewRoutingFixture({ includeAuthority: false, includePredelegation: true })
  const { refetchContinuationEvent: unusedDiagnostic, ...hostWithoutContinuationDiagnostics } = fixture.host
  equal(typeof unusedDiagnostic, 'function')
  const result = await ensureReviewAuthorityAndRunPreflightV1({
    request: reviewRoutingInput(), host: hostWithoutContinuationDiagnostics,
  })
  equal(result.state, 'MERGE_READY')
  equal(result.exact_head, HEAD)
  equal(result.assignment_materialization_mutation_count, 1)
  equal(result.publication_mutation_count, 1)
  equal(fixture.state.findingEventReads, 0)
}

// Optional diagnostics do not weaken exact semantic-input binding or zero-count admission.
for (const review_input of [
  undefined,
  { ...reviewInput(), reviewed_head: BASE },
  { ...reviewInput(), blocking: 1 },
  { ...reviewInput(), remaining: 1 },
  { ...reviewInput(), unknown: 1 },
]) {
  const fixture = createReviewRoutingFixture({ includeAuthority: false, includePredelegation: true })
  const error = await captureError(() => ensureReviewAuthorityAndRunPreflightV1({
    request: reviewRoutingInput({ review_input }), host: fixture.host,
  }))
  ok(['review_invalid', 'review_publication_binding_invalid'].includes(error.message))
  equal(fixture.state.assignmentCommentMutations + fixture.state.taskCommentMutations + fixture.state.pullReviewMutations, 0)
}

// Replacement Fresh Review resolves only the exact consumed finding threads before canonical Review publication.
{
  const thread = { id: 'PRRT_corrected_thread', isResolved: false, isOutdated: false }
  const findingEvent = reviewFindingEvent({ activeThreadIds: [thread.id] })
  const fixture = createReviewRoutingFixture({
    includeAuthority: false,
    authorityBody: canonicalReviewCorrectionTaskBody(),
    threads: [thread],
    findingEvent,
  })
  const result = await ensureReviewAuthorityAndRunPreflightV1({
    request: reviewRoutingInput({
      correction_context: {
        finding_cursor: findingEvent.continuation_cursor,
        finding_head: '4'.repeat(40),
        active_thread_ids: [thread.id],
      },
    }),
    host: fixture.host,
  })
  equal(result.state, 'MERGE_READY')
  equal(result.thread_resolution_mutation_count, 1)
  equal(fixture.state.threadResolutionMutations, 1)
  equal(thread.isResolved, true)
  equal(result.publication_mutation_count, 1)
  equal(fixture.state.findingEventReads, 1)
}

{
  const newThread = { id: 'PRRT_new_live_finding', isResolved: false, isOutdated: false }
  const findingEvent = reviewFindingEvent({ activeThreadIds: ['PRRT_prior_finding'] })
  const fixture = createReviewRoutingFixture({
    includeAuthority: false,
    authorityBody: canonicalReviewCorrectionTaskBody(),
    threads: [newThread],
    findingEvent,
  })
  const result = await ensureReviewAuthorityAndRunPreflightV1({
    request: reviewRoutingInput({
      correction_context: {
        finding_cursor: findingEvent.continuation_cursor,
        finding_head: '4'.repeat(40),
        active_thread_ids: ['PRRT_prior_finding'],
      },
    }),
    host: fixture.host,
  })
  equal(result.state, 'CORRECTION_REQUIRED')
  equal(result.active_thread_ids.join(','), newThread.id)
  equal(result.thread_resolution_mutation_count, 0)
  equal(fixture.state.threadResolutionMutations, 0)
  equal(fixture.state.taskCommentMutations, 0)
}

{
  const resolved = { id: 'PRRT_already_resolved', isResolved: true, isOutdated: false }
  const findingEvent = reviewFindingEvent({ activeThreadIds: [resolved.id] })
  const fixture = createReviewRoutingFixture({
    includeAuthority: false,
    authorityBody: legacyReviewCorrectionTaskBody(),
    threads: [resolved],
    findingEvent,
  })
  const result = await ensureReviewAuthorityAndRunPreflightV1({
    request: reviewRoutingInput({
      correction_context: {
        finding_cursor: findingEvent.continuation_cursor,
        finding_head: '4'.repeat(40),
        active_thread_ids: [resolved.id],
      },
    }),
    host: fixture.host,
  })
  equal(result.state, 'MERGE_READY')
  equal(result.thread_resolution_mutation_count, 0)
  equal(fixture.state.threadResolutionMutations, 0)
  equal(fixture.state.findingEventReads, 1)
}

{
  const thread = { id: 'PRRT_legacy_requires_mutation', isResolved: false, isOutdated: false }
  const findingEvent = reviewFindingEvent({ activeThreadIds: [thread.id] })
  const fixture = createReviewRoutingFixture({
    includeAuthority: false,
    authorityBody: legacyReviewCorrectionTaskBody(),
    threads: [thread],
    findingEvent,
  })
  const error = await captureError(() => ensureReviewAuthorityAndRunPreflightV1({
    request: reviewRoutingInput({
      correction_context: {
        finding_cursor: findingEvent.continuation_cursor,
        finding_head: '4'.repeat(40),
        active_thread_ids: [thread.id],
      },
    }),
    host: fixture.host,
  }))
  equal(error.message, 'review_thread_resolution_authority_invalid')
  equal(fixture.state.threadResolutionMutations, 0)
  equal(fixture.state.taskCommentMutations, 0)
}

{
  const thread = { id: 'PRRT_refetched_finding', isResolved: false, isOutdated: false }
  const findingEvent = reviewFindingEvent({ activeThreadIds: [thread.id] })
  const fixture = createReviewRoutingFixture({
    includeAuthority: false,
    authorityBody: canonicalReviewCorrectionTaskBody(),
    threads: [thread],
    findingEvent,
  })
  const error = await captureError(() => ensureReviewAuthorityAndRunPreflightV1({
    request: reviewRoutingInput({
      correction_context: {
        finding_cursor: findingEvent.continuation_cursor,
        finding_head: '4'.repeat(40),
        active_thread_ids: ['PRRT_caller_substitute'],
      },
    }),
    host: fixture.host,
  }))
  equal(error.message, 'review_correction_binding_invalid')
  equal(fixture.state.threadResolutionMutations, 0)
  equal(fixture.state.taskCommentMutations, 0)
}

// The logical key excludes physical resource identity and base, while the semantic payload retains both binding data.
{
  const exact = resourceReviewPublicationAssignment()
  const staleBase = resourceReviewPublicationAssignment({ grantOverrides: { expected_base: '4'.repeat(40) } })
  equal(
    JSON.stringify(projectReviewPublicationLogicalAssignmentIdentityV2(exact.allowed_changes)),
    JSON.stringify(projectReviewPublicationLogicalAssignmentIdentityV2(staleBase.allowed_changes)),
  )
  equal(
    JSON.stringify(projectReviewPublicationLogicalAssignmentSemanticPayloadV2(exact)) ===
      JSON.stringify(projectReviewPublicationLogicalAssignmentSemanticPayloadV2(staleBase)),
    false,
  )
}

// Physically duplicated but byte-identical assignment records collapse into one logical authority.
{
  const fixture = createReviewRoutingFixture({
    includeAuthority: false,
    includePredelegation: true,
    existing: [{ kind: 'TASK_ASSIGNMENT' }, { kind: 'TASK_ASSIGNMENT' }],
  })
  const result = await ensureReviewAuthorityAndRunPreflightV1({ request: reviewRoutingInput(), host: fixture.host })
  equal(result.state, 'MERGE_READY')
  equal(result.assignment_materialization_mutation_count, 0)
  equal(result.logical_assignment_resource_count, 2)
  equal(result.publication_authority_record, `https://github.com/${REPOSITORY}/issues/${TASK}#issuecomment-9200`)
  equal(fixture.state.assignmentCommentMutations, 0)
  equal(fixture.state.taskCommentMutations, 1)
}

// An equivalent concurrent CREATE is collapsed after direct refetch and re-enumeration.
{
  const fixture = createReviewRoutingFixture({
    includeAuthority: false,
    includePredelegation: true,
    concurrentEquivalentAssignmentOnCreate: true,
  })
  const result = await ensureReviewAuthorityAndRunPreflightV1({ request: reviewRoutingInput(), host: fixture.host })
  equal(result.state, 'MERGE_READY')
  equal(result.assignment_materialization_mutation_count, 1)
  equal(result.logical_assignment_resource_count, 2)
  equal(fixture.state.assignmentCommentMutations, 1)
  equal(fixture.state.taskCommentMutations, 1)
}

// Stable predelegation and a uniquely valid legacy Task-body exact assignment coexist structurally.
{
  const body = `${taskBodyWithReviewPublicationPredelegation()}\n${yamlBlock(reviewPublicationAssignment())}`
  const fixture = createReviewRoutingFixture({ authorityBody: body })
  const result = await ensureReviewAuthorityAndRunPreflightV1({ request: reviewRoutingInput(), host: fixture.host })
  equal(result.state, 'MERGE_READY')
  equal(result.assignment_materialization_mutation_count, 0)
  equal(result.publication_authority_record, `https://github.com/${REPOSITORY}/issues/${TASK}`)
  equal(fixture.state.assignmentCommentMutations, 0)
}

// An equivalent assignment that appears at the final pre-CREATE enumeration is reused with zero CREATE.
{
  const fixture = createReviewRoutingFixture({
    includeAuthority: false,
    includePredelegation: true,
    assignmentAppearsBeforeCreate: true,
  })
  const result = await ensureReviewAuthorityAndRunPreflightV1({ request: reviewRoutingInput(), host: fixture.host })
  equal(result.state, 'MERGE_READY')
  equal(result.assignment_materialization_mutation_count, 0)
  equal(fixture.state.assignmentCommentMutations, 0)
  equal(result.publication_authority_record, `https://github.com/${REPOSITORY}/issues/${TASK}#issuecomment-9410`)
}

// A same-logical-identity payload conflict remains fail-closed; an old HEAD/base record is historical and non-applicable.
{
  const conflict = createReviewRoutingFixture({
    includeAuthority: false,
    includePredelegation: true,
    existing: [
      { kind: 'TASK_ASSIGNMENT' },
      { kind: 'TASK_ASSIGNMENT', grantOverrides: { expected_base: '4'.repeat(40) } },
    ],
  })
  equal((await captureError(() => ensureReviewAuthorityAndRunPreflightV1({
    request: reviewRoutingInput(), host: conflict.host,
  }))).message, 'review_publication_authority_conflict')
  equal(conflict.state.assignmentCommentMutations + conflict.state.taskCommentMutations, 0)

  const historical = createReviewRoutingFixture({
    includeAuthority: false,
    includePredelegation: true,
    existing: [{
      kind: 'TASK_ASSIGNMENT',
      grantOverrides: { exact_head: '4'.repeat(40), expected_base: '5'.repeat(40), review: reviewInput('4'.repeat(40)) },
    }],
  })
  const result = await ensureReviewAuthorityAndRunPreflightV1({ request: reviewRoutingInput(), host: historical.host })
  equal(result.state, 'MERGE_READY')
  equal(result.assignment_materialization_mutation_count, 1)
  equal(result.logical_assignment_resource_count, 1)
}

// Malformed and wrong-actor bookkeeping records are not silently ignored.
{
  const malformed = createReviewRoutingFixture({
    includeAuthority: false,
    includePredelegation: true,
    existing: [{
      kind: 'TASK_ASSIGNMENT',
      body: '```yaml\nrecord_type: task_assignment\nallowed_changes:\n  protected_action: REVIEW_AUTHORITY_PUBLICATION\n```\n',
    }],
  })
  equal((await captureError(() => ensureReviewAuthorityAndRunPreflightV1({
    request: reviewRoutingInput(), host: malformed.host,
  }))).message, 'review_publication_authority_malformed')
  const wrongActor = createReviewRoutingFixture({
    includeAuthority: false,
    includePredelegation: true,
    existing: [{ kind: 'TASK_ASSIGNMENT', grantOverrides: { authorized_actor: 'other-actor' } }],
  })
  equal((await captureError(() => ensureReviewAuthorityAndRunPreflightV1({
    request: reviewRoutingInput(), host: wrongActor.host,
  }))).message, 'review_publication_authority_invalid')
}

// Assignment CREATE is single-attempt, refetched exactly, and never retried after ambiguity.
{
  const ambiguous = createReviewRoutingFixture({
    includeAuthority: false,
    includePredelegation: true,
    assignmentError: new Error('github_mutation_outcome_ambiguous'),
  })
  equal((await captureError(() => ensureReviewAuthorityAndRunPreflightV1({
    request: reviewRoutingInput(), host: ambiguous.host,
  }))).message, 'github_mutation_outcome_ambiguous')
  equal(ambiguous.state.assignmentCommentMutations, 1)
  equal(ambiguous.state.taskCommentMutations + ambiguous.state.pullReviewMutations, 0)

  const mismatch = createReviewRoutingFixture({
    includeAuthority: false,
    includePredelegation: true,
    assignmentRefetchMismatch: true,
  })
  equal((await captureError(() => ensureReviewAuthorityAndRunPreflightV1({
    request: reviewRoutingInput(), host: mismatch.host,
  }))).message, 'review_assignment_materialization_refetch_mismatch')
  equal(mismatch.state.assignmentCommentMutations, 1)
  equal(mismatch.state.taskCommentMutations, 0)
}

// Checks, active threads, and mergeability fail before assignment or Review mutation.
{
  const failedCheck = createReviewRoutingFixture({ includeAuthority: false, includePredelegation: true })
  failedCheck.host.graphql = async (query, variables) => {
    if (query.includes('query SimplifiedChecks')) {
      return { repository: { object: { oid: HEAD, statusCheckRollup: { contexts: {
        nodes: [check('validate', 15368, { conclusion: 'FAILURE' }), check('build-preview', 15368), check('Cloudflare Pages', 85455)],
        pageInfo: { hasNextPage: false, endCursor: null },
      } } } } }
    }
    return createFixture().host.graphql(query, variables)
  }
  equal((await captureError(() => ensureReviewAuthorityAndRunPreflightV1({
    request: reviewRoutingInput(), host: failedCheck.host,
  }))).message, 'required_check_not_successful:validate')
  equal(failedCheck.state.assignmentCommentMutations + failedCheck.state.taskCommentMutations, 0)

  const blocked = createReviewRoutingFixture({ includeAuthority: false, includePredelegation: true })
  blocked.host.graphql = async (query, variables) => {
    if (query.includes('query SimplifiedThreads')) {
      return { repository: { pullRequest: {
        number: PR, state: 'OPEN', isDraft: false, merged: false, headRefOid: HEAD,
        mergeable: 'MERGEABLE', mergeStateStatus: 'CLEAN',
        reviewThreads: { nodes: [{ id: 'active-thread', isResolved: false, isOutdated: false }], pageInfo: { hasNextPage: false, endCursor: null } },
      } } }
    }
    return createFixture().host.graphql(query, variables)
  }
  const correction = await ensureReviewAuthorityAndRunPreflightV1({
    request: reviewRoutingInput(), host: blocked.host,
  })
  equal(correction.state, 'CORRECTION_REQUIRED')
  equal(correction.reason, 'blocking_review_threads_present')
  equal(correction.continuation_kind, 'REVIEW_FINDING')
  equal(correction.repository, REPOSITORY)
  equal(correction.task_issue, TASK)
  equal(correction.pull_request, PR)
  equal(correction.exact_head, HEAD)
  equal(correction.expected_base, BASE)
  equal(correction.active_thread_ids.join(','), 'active-thread')
  equal(correction.assignment_materialization_mutation_count, 0)
  equal(correction.publication_mutation_count, 0)
  ok(/^review-finding-[0-9a-f]{64}$/.test(correction.continuation_cursor))
  equal(blocked.state.assignmentCommentMutations + blocked.state.taskCommentMutations, 0)

  const blockedDuringAssignmentMaterialization = createReviewRoutingFixture({
    includeAuthority: false,
    includePredelegation: true,
  })
  let threadReads = 0
  blockedDuringAssignmentMaterialization.host.graphql = async (query, variables) => {
    if (query.includes('query SimplifiedThreads')) {
      threadReads += 1
      if (threadReads === 2) {
        return { repository: { pullRequest: {
          number: PR, state: 'OPEN', isDraft: false, merged: false, headRefOid: HEAD,
          mergeable: 'MERGEABLE', mergeStateStatus: 'CLEAN',
          reviewThreads: { nodes: [{ id: 'assignment-race-thread', isResolved: false, isOutdated: false }], pageInfo: { hasNextPage: false, endCursor: null } },
        } } }
      }
    }
    return createFixture().host.graphql(query, variables)
  }
  const assignmentRace = await ensureReviewAuthorityAndRunPreflightV1({
    request: reviewRoutingInput(), host: blockedDuringAssignmentMaterialization.host,
  })
  equal(assignmentRace.state, 'CORRECTION_REQUIRED')
  equal(assignmentRace.active_thread_ids.join(','), 'assignment-race-thread')
  equal(assignmentRace.assignment_materialization_mutation_count, 0)
  equal(assignmentRace.publication_mutation_count, 0)
  equal(blockedDuringAssignmentMaterialization.state.assignmentCommentMutations, 0)
  equal(blockedDuringAssignmentMaterialization.state.taskCommentMutations, 0)
}

// The shared publication guard exposes only current mechanical evidence and performs no mutation.
{
  const fixture = createFixture()
  const snapshot = await acquireSimplifiedReviewPublicationPreflightV2({
    request: {
      repository: REPOSITORY,
      task_issue: TASK,
      pull_request: PR,
      exact_head: HEAD,
      expected_base: BASE,
      authorized_paths: PATHS,
    },
    host: fixture.host,
  })
  equal(snapshot.exact_head, HEAD)
  equal(snapshot.head_branch, BRANCH)
  equal(snapshot.required_checks.length, 3)
  equal(snapshot.thread_ids.length, 0)
  equal(fixture.state.mergeMutations, 0)
}

// Duplicate, conflicting, and malformed authority fail closed before a mutation.
{
  const duplicate = createReviewRoutingFixture({
    existing: [{ kind: 'PULL_REQUEST_REVIEW' }, { kind: 'TASK_ISSUE_COMMENT' }], includeAuthority: false,
  })
  equal((await captureError(() => ensureReviewAuthorityAndRunPreflightV1({
    request: reviewRoutingInput(), host: duplicate.host,
  }))).message, 'review_authority_duplicate')
  equal(duplicate.state.pullReviewMutations + duplicate.state.taskCommentMutations, 0)

  const conflict = createReviewRoutingFixture({
    existing: [{ kind: 'TASK_ISSUE_COMMENT', body: `${serializeSimplifiedReviewV1(reviewInput())}\n` }],
    includeAuthority: false,
  })
  equal((await captureError(() => ensureReviewAuthorityAndRunPreflightV1({
    request: reviewRoutingInput(), host: conflict.host,
  }))).message, 'review_authority_conflict')
  equal(conflict.state.pullReviewMutations + conflict.state.taskCommentMutations, 0)

  const malformed = createReviewRoutingFixture({
    existing: [{ kind: 'TASK_ISSUE_COMMENT', body: '# Review\n\n```json\n{"record_type": "simplified_independent_review_v1"}\n```\n' }],
    includeAuthority: false,
  })
  equal((await captureError(() => ensureReviewAuthorityAndRunPreflightV1({
    request: reviewRoutingInput(), host: malformed.host,
  }))).message, 'review_authority_malformed')
  equal(malformed.state.pullReviewMutations + malformed.state.taskCommentMutations, 0)
}

// Every action binding is exact; mismatches stop before publication.
{
  const invalidGrants = [
    { repository: 'other/repository' },
    { task_issue: TASK + 1 },
    { pull_request: PR + 1 },
    { exact_head: BASE },
    { head_branch: 'codex/wrong-branch' },
    { expected_base: HEAD },
    { authorized_paths: ['AGENTS.md'] },
    { authorized_actor: 'other-actor' },
    { permitted_surface: 'PULL_REQUEST_REVIEW' },
    { review: { ...reviewInput(), unknown: 1 } },
    { operation_count: 2 },
    { fallback_allowed: true },
  ]
  for (const grantOverrides of invalidGrants) {
    const fixture = createReviewRoutingFixture({ authorityGrantOverrides: grantOverrides })
    equal((await captureError(() => ensureReviewAuthorityAndRunPreflightV1({
      request: reviewRoutingInput(), host: fixture.host,
    }))).message, 'review_publication_authority_invalid')
    equal(fixture.state.pullReviewMutations + fixture.state.taskCommentMutations, 0)
  }
  const wrongOwner = createReviewRoutingFixture({ issueAuthorAssociation: 'NONE' })
  equal((await captureError(() => ensureReviewAuthorityAndRunPreflightV1({
    request: reviewRoutingInput(), host: wrongOwner.host,
  }))).message, 'review_publication_authority_invalid')
  equal(wrongOwner.state.pullReviewMutations + wrongOwner.state.taskCommentMutations, 0)

  const wrongDistinctSurface = createReviewRoutingFixture({
    actor: 'independent-reviewer', authorityGrantOverrides: { permitted_surface: 'TASK_ISSUE_COMMENT' },
  })
  equal((await captureError(() => ensureReviewAuthorityAndRunPreflightV1({
    request: reviewRoutingInput(), host: wrongDistinctSurface.host,
  }))).message, 'review_publication_authority_invalid')
  equal(wrongDistinctSurface.state.pullReviewMutations + wrongDistinctSurface.state.taskCommentMutations, 0)

  for (const topOverrides of [
    { authoring_role: 'Independent Reviewer' },
    { authority_source: 'https://github.com/whatrune/sd-prompt-studio/issues/1' },
    { record_type: 'result_handoff' },
  ]) {
    const fixture = createReviewRoutingFixture({ authorityTopOverrides: topOverrides })
    equal((await captureError(() => ensureReviewAuthorityAndRunPreflightV1({
      request: reviewRoutingInput(), host: fixture.host,
    }))).message, 'review_publication_authority_invalid')
    equal(fixture.state.pullReviewMutations + fixture.state.taskCommentMutations, 0)
  }
}

// Duplicate or malformed publication assignments do not grant mutation authority.
{
  const assignment = taskBodyWithReviewPublicationAssignment()
  const yamlBlock = assignment.slice(assignment.indexOf('```yaml'))
  const duplicate = createReviewRoutingFixture({ authorityBody: `${assignment}\n${yamlBlock}` })
  equal((await captureError(() => ensureReviewAuthorityAndRunPreflightV1({
    request: reviewRoutingInput(), host: duplicate.host,
  }))).message, 'review_publication_authority_duplicate')
  equal(duplicate.state.pullReviewMutations + duplicate.state.taskCommentMutations, 0)

  const malformed = createReviewRoutingFixture({
    authorityBody: `${serializeSimplifiedTaskAuthorityV1(taskInput)}\n\`\`\`yaml\nauthority_kind: REVIEW_AUTHORITY_PUBLICATION\n  malformed\n\`\`\`\n`,
  })
  equal((await captureError(() => ensureReviewAuthorityAndRunPreflightV1({
    request: reviewRoutingInput(), host: malformed.host,
  }))).message, 'review_publication_authority_malformed')
  equal(malformed.state.pullReviewMutations + malformed.state.taskCommentMutations, 0)
}

// HEAD/base/actor are read again immediately before the publication mutation.
{
  const headDrift = createReviewRoutingFixture({ finalHead: '4'.repeat(40) })
  equal((await captureError(() => ensureReviewAuthorityAndRunPreflightV1({
    request: reviewRoutingInput(), host: headDrift.host,
  }))).message, 'review_publication_final_binding_invalid')
  equal(headDrift.state.pullReviewMutations + headDrift.state.taskCommentMutations, 0)

  const baseDrift = createReviewRoutingFixture({ finalBase: '5'.repeat(40) })
  equal((await captureError(() => ensureReviewAuthorityAndRunPreflightV1({
    request: reviewRoutingInput(), host: baseDrift.host,
  }))).message, 'review_publication_final_binding_invalid')
  equal(baseDrift.state.pullReviewMutations + baseDrift.state.taskCommentMutations, 0)

  const actorDrift = createReviewRoutingFixture({ finalActor: 'other-actor' })
  equal((await captureError(() => ensureReviewAuthorityAndRunPreflightV1({
    request: reviewRoutingInput(), host: actorDrift.host,
  }))).message, 'review_publication_authority_invalid')
  equal(actorDrift.state.pullReviewMutations + actorDrift.state.taskCommentMutations, 0)

  const authorityRemoved = createReviewRoutingFixture({
    finalAuthorityBody: serializeSimplifiedTaskAuthorityV1(taskInput),
  })
  equal((await captureError(() => ensureReviewAuthorityAndRunPreflightV1({
    request: reviewRoutingInput(), host: authorityRemoved.host,
  }))).message, 'review_publication_authority_required')
  equal(authorityRemoved.state.pullReviewMutations + authorityRemoved.state.taskCommentMutations, 0)
}

// A distinct-actor PR publication failure never falls back to the Task comment route.
{
  const fixture = createReviewRoutingFixture({
    actor: 'independent-reviewer',
    publicationError: new Error('github_http_403:forbidden'),
  })
  equal((await captureError(() => ensureReviewAuthorityAndRunPreflightV1({
    request: reviewRoutingInput(), host: fixture.host,
  }))).message, 'github_http_403:forbidden')
  equal(fixture.state.pullReviewMutations, 1)
  equal(fixture.state.taskCommentMutations, 0)
}

// Publication is not admitted unless the exact created resource refetches byte-identically.
{
  const fixture = createReviewRoutingFixture({ refetchMismatch: true })
  equal((await captureError(() => ensureReviewAuthorityAndRunPreflightV1({
    request: reviewRoutingInput(), host: fixture.host,
  }))).message, 'review_authority_conflict')
  equal(fixture.state.taskCommentMutations, 1)
  equal(fixture.state.pullReviewMutations, 0)
}
{
  const fixture = createReviewRoutingFixture({ refetchActorMismatch: true })
  equal((await captureError(() => ensureReviewAuthorityAndRunPreflightV1({
    request: reviewRoutingInput(), host: fixture.host,
  }))).message, 'review_publication_refetch_mismatch')
  equal(fixture.state.taskCommentMutations, 1)
  equal(fixture.state.pullReviewMutations, 0)
}

// Blockers/UNKNOWN and exact Task/PR/HEAD binding remain closed serializer/preflight predicates.
{
  const fixture = createReviewRoutingFixture()
  equal((await captureError(() => ensureReviewAuthorityAndRunPreflightV1({
    request: reviewRoutingInput({ review_input: { ...reviewInput(), unknown: 1 } }),
    host: fixture.host,
  }))).message, 'review_invalid')
  equal(fixture.state.pullReviewMutations + fixture.state.taskCommentMutations, 0)
  equal((await captureError(() => ensureReviewAuthorityAndRunPreflightV1({
    request: reviewRoutingInput({ exact_head: BASE }),
    host: fixture.host,
  }))).message, 'review_publication_binding_invalid')
  equal(fixture.state.pullReviewMutations + fixture.state.taskCommentMutations, 0)
}

{
  const historicalFindingTerminal = Date.parse('2026-08-28T12:40:20Z')
  const historicalWorkerStart = Date.parse('2026-08-28T13:17:44Z')
  equal(historicalWorkerStart - historicalFindingTerminal, 37 * 60 * 1000 + 24 * 1000)
  const continuation = projectAutomatedReviewToMergeReadyContinuationV1({
    waitTerminal: true,
    terminalKind: 'REVIEW_FINDING',
    identityMatches: true,
    owningWorker: 'task-468-worker',
    observedAt: historicalFindingTerminal,
    terminalCursor: 'task-468-finding-terminal',
    consumedCursor: null,
  })
  equal(continuation.actions.length, 1)
  equal(continuation.actions[0].type, 'FOLLOW_UP_OWNING_WORKER')
  equal(continuation.actions[0].worker, 'task-468-worker')
  equal(continuation.action_at - historicalFindingTerminal <= 10_000, true)
}
{
  const checks = projectAutomatedReviewToMergeReadyContinuationV1({
    waitTerminal: true, terminalKind: 'CHECKS_PASS', identityMatches: true,
    owningWorker: 'worker', observedAt: 100, terminalCursor: 'checks-pass', consumedCursor: null,
  })
  const approval = projectAutomatedReviewToMergeReadyContinuationV1({
    waitTerminal: true, terminalKind: 'REVIEW_APPROVE', identityMatches: true,
    owningWorker: 'worker', observedAt: 100, terminalCursor: 'review-approve', consumedCursor: null,
  })
  const nonterminal = projectAutomatedReviewToMergeReadyContinuationV1({
    waitTerminal: false, terminalKind: 'CHECKS_PASS', identityMatches: true,
    owningWorker: 'worker', observedAt: 100, terminalCursor: 'checks-nonterminal', consumedCursor: null,
  })
  const mismatch = projectAutomatedReviewToMergeReadyContinuationV1({
    waitTerminal: true, terminalKind: 'REVIEW_FINDING', identityMatches: false,
    owningWorker: 'worker', observedAt: 100, terminalCursor: 'finding-mismatch', consumedCursor: null,
  })
  equal(checks.actions.length, 1)
  equal(checks.actions[0].type, 'DISPATCH_FRESH_REVIEW')
  equal(approval.actions.length, 1)
  equal(approval.actions[0].type, 'ENSURE_REVIEW_AUTHORITY_AND_RUN_PREFLIGHT')
  equal(nonterminal.actions.length, 0)
  equal(mismatch.actions.length, 0)
  equal(projectAutomatedReviewToMergeReadyContinuationV1({
    waitTerminal: true, terminalKind: 'CHECKS_PASS', identityMatches: true,
    owningWorker: 'worker', observedAt: 100,
    terminalCursor: 'checks-pass', consumedCursor: checks.consumed_cursor,
  }).actions.length, 0)
}

{
  const fixture = createFixture()
  const result = await executeSimplifiedMergeV1({ event: mergeEvent(), host: fixture.host })
  equal(result.state, 'COMPLETED')
  equal(result.reason, 'merge_completed')
  equal(result.mutation_count, 1)
  equal(fixture.state.mergeMutations, 1)
  equal(fixture.state.mergeExpectedHead, HEAD)
  equal(result.merge_commit, MERGE)
}
{
  const fixture = createFixture({ reviewHead: BASE })
  const result = await executeSimplifiedMergeV1({ event: mergeEvent(), host: fixture.host })
  equal(result.reason, 'live_binding_invalid')
  equal(fixture.state.mergeMutations, 0)
}
{
  const fixture = createFixture({ checks: [check('validate', 15368), check('build-preview', 15368), check('Cloudflare Pages', 85455, { status: 'IN_PROGRESS', conclusion: null })] })
  const result = await executeSimplifiedMergeV1({ event: mergeEvent(), host: fixture.host })
  equal(result.reason, 'required_check_not_successful:Cloudflare Pages')
  equal(fixture.state.mergeMutations, 0)
}
{
  const fixture = createFixture({ threads: [{ id: 'thread-1', isResolved: false, isOutdated: false }] })
  const result = await executeSimplifiedMergeV1({ event: mergeEvent(), host: fixture.host })
  equal(result.reason, 'blocking_review_threads_present')
  equal(fixture.state.mergeMutations, 0)
}
{
  const fixture = createFixture()
  const result = await executeSimplifiedMergeV1({ event: mergeEvent(decisionInput({ expected_base: '4'.repeat(40) })), host: fixture.host })
  equal(result.reason, 'live_binding_invalid')
  equal(fixture.state.mergeMutations, 0)
}
{
  const fixture = createFixture({ draft: true })
  const result = await executeSimplifiedMergeV1({ event: mergeEvent(), host: fixture.host })
  equal(result.reason, 'live_binding_invalid')
  equal(fixture.state.mergeMutations, 0)
}
{
  const ghCalls = []
  const issueCommentResource = (id, body) => ({
    id,
    body,
    html_url: `https://github.com/${REPOSITORY}/issues/${TASK}#issuecomment-${id}`,
    user: { login: 'whatrune' },
  })
  const host = createProductionHostV1({
    token: 'test-token',
    environment: {
      GH_TOKEN: 'caller-gh-token-must-not-flow',
      GITHUB_TOKEN: 'caller-github-token-must-not-flow',
      GH_HOST: 'enterprise.example.test',
      GH_ENTERPRISE_TOKEN: 'caller-enterprise-token-must-not-flow',
      GITHUB_ENTERPRISE_TOKEN: 'caller-github-enterprise-token-must-not-flow',
      SAFE_ENVIRONMENT_VALUE: 'preserved',
    },
    ghExecutable: 'exact-gh',
    spawnSync: (executable, args, options) => {
      ghCalls.push({ executable, args, options })
      const payload = JSON.parse(options.input)
      return {
        status: 0,
        signal: null,
        stdout: JSON.stringify(issueCommentResource(9500 + ghCalls.length, payload.body)),
        stderr: '',
      }
    },
    fetchImpl: async (url, options) => {
      return new Response(JSON.stringify({ id: 1 }), {
        status: 200,
        headers: { 'x-github-request-id': 'REQ:NON-REVIEW' },
      })
    },
  })
  const assignmentBody = 'canonical V2 logical assignment'
  await host.publishTaskAssignmentComment({ repository: REPOSITORY, taskIssue: TASK, body: assignmentBody })
  await host.publishTaskIssueComment({ repository: REPOSITORY, taskIssue: TASK, body: reviewBody })
  equal(ghCalls.length, 2)
  for (const call of ghCalls) {
    equal(call.executable, 'exact-gh')
    equal(call.args.join(' '), `api --hostname github.com repos/${REPOSITORY}/issues/${TASK}/comments --method POST --input -`)
    equal(call.options.encoding, 'utf8')
    equal(call.options.windowsHide, true)
    equal(call.options.env.GH_TOKEN, 'test-token')
    equal(Object.hasOwn(call.options.env, 'GITHUB_TOKEN'), false)
    equal(Object.hasOwn(call.options.env, 'GH_HOST'), false)
    equal(Object.hasOwn(call.options.env, 'GH_ENTERPRISE_TOKEN'), false)
    equal(Object.hasOwn(call.options.env, 'GITHUB_ENTERPRISE_TOKEN'), false)
    equal(call.options.env.SAFE_ENVIRONMENT_VALUE, 'preserved')
    equal(JSON.stringify(call.options).includes('caller-gh-token-must-not-flow'), false)
    equal(JSON.stringify(call.options).includes('caller-github-token-must-not-flow'), false)
    equal(JSON.stringify(call.options).includes('caller-enterprise-token-must-not-flow'), false)
    equal(JSON.stringify(call.options).includes('caller-github-enterprise-token-must-not-flow'), false)
  }
  equal(ghCalls[0].options.input, JSON.stringify({ body: assignmentBody }))
  equal(ghCalls[1].options.input, JSON.stringify({ body: reviewBody }))
}
{
  const calls = []
  const host = createProductionHostV1({
    token: 'test-token',
    environment: {},
    spawnSync: (executable, args, options) => {
      calls.push({ executable, args, options })
      return { status: 0, signal: null, stdout: JSON.stringify({ id: 9601 }), stderr: '' }
    },
  })
  await host.publishPullRequestReview({
    repository: REPOSITORY, prNumber: PR, exactHead: HEAD, body: reviewBody,
  })
  equal(calls.length, 1)
  equal(calls[0].args.join(' '), `api --hostname github.com repos/${REPOSITORY}/pulls/${PR}/reviews --method POST --input -`)
  equal(calls[0].options.input, JSON.stringify({ body: reviewBody, event: 'APPROVE', commit_id: HEAD }))
}
for (const response of [
  { status: 1, signal: null, stdout: '', stderr: 'Authorization: Bearer must-not-leak' },
  { status: null, signal: 'SIGTERM', stdout: '', stderr: '' },
  { status: 0, signal: null, stdout: '{invalid-json', stderr: '' },
]) {
  let mutationAttempts = 0
  let fetchAttempts = 0
  const host = createProductionHostV1({
    token: 'direct-transport-secret',
    environment: {},
    spawnSync: () => {
      mutationAttempts += 1
      return response
    },
    fetchImpl: async () => {
      fetchAttempts += 1
      throw new Error('alternate_fetch_transport_used')
    },
  })
  const error = await captureError(() => host.publishTaskAssignmentComment({
    repository: REPOSITORY, taskIssue: TASK, body: 'assignment',
  }))
  equal(
    ['review_publication_direct_gh_outcome_unknown', 'review_publication_direct_gh_response_invalid']
      .includes(error.message),
    true,
  )
  equal(mutationAttempts, 1)
  equal(fetchAttempts, 0)
  equal(error.message.includes('direct-transport-secret'), false)
  equal(error.message.includes('must-not-leak'), false)
}
{
  const originalGhToken = process.env.GH_TOKEN
  const originalGithubToken = process.env.GITHUB_TOKEN
  const authorizationFor = async (host) => {
    const result = await host.api('user')
    return result.authorization
  }
  const fetchWithAuthorizationReceipt = async (_url, options) => new Response(JSON.stringify({
    authorization: options.headers.Authorization,
  }), { status: 200 })

  equal(await authorizationFor(createProductionHostV1({
    environment: { GH_TOKEN: 'gh-only-secret', GITHUB_TOKEN: '' },
    fetchImpl: fetchWithAuthorizationReceipt,
  })), 'Bearer gh-only-secret')
  equal(await authorizationFor(createProductionHostV1({
    environment: { GH_TOKEN: '', GITHUB_TOKEN: 'github-only-secret' },
    fetchImpl: fetchWithAuthorizationReceipt,
  })), 'Bearer github-only-secret')

  throws(() => createProductionHostV1({ environment: {} }), /github_token_missing/)
  throws(() => createProductionHostV1({
    environment: { GH_TOKEN: '', GITHUB_TOKEN: '' },
  }), /github_token_missing/)
  throws(() => createProductionHostV1({
    environment: { GH_TOKEN: 'gh-secret', GITHUB_TOKEN: 'github-secret' },
  }), /github_token_ambiguous/)
  throws(() => createProductionHostV1({
    environment: { GH_TOKEN: 'same-secret', GITHUB_TOKEN: 'same-secret' },
  }), /github_token_ambiguous/)

  const reads = { GH_TOKEN: 0, GITHUB_TOKEN: 0 }
  const boundOnceHost = createProductionHostV1({
    environment: {
      get GH_TOKEN() {
        reads.GH_TOKEN += 1
        return 'bound-once-secret'
      },
      get GITHUB_TOKEN() {
        reads.GITHUB_TOKEN += 1
        return ''
      },
    },
    fetchImpl: fetchWithAuthorizationReceipt,
  })
  equal(reads.GH_TOKEN, 1)
  equal(reads.GITHUB_TOKEN, 1)
  equal(await authorizationFor(boundOnceHost), 'Bearer bound-once-secret')
  equal(await authorizationFor(boundOnceHost), 'Bearer bound-once-secret')
  equal(reads.GH_TOKEN, 1)
  equal(reads.GITHUB_TOKEN, 1)

  const explicitHost = createProductionHostV1({
    token: 'explicit-secret',
    environment: {
      get GH_TOKEN() { throw new Error('environment_must_not_be_read') },
      get GITHUB_TOKEN() { throw new Error('environment_must_not_be_read') },
    },
    fetchImpl: fetchWithAuthorizationReceipt,
  })
  equal(await authorizationFor(explicitHost), 'Bearer explicit-secret')
  throws(() => createProductionHostV1({ token: '' }), /github_token_missing/)

  let failedRequestCount = 0
  const failureHost = createProductionHostV1({
    environment: { GH_TOKEN: 'failure-secret', GITHUB_TOKEN: '' },
    fetchImpl: async () => {
      failedRequestCount += 1
      return new Response(JSON.stringify({ message: 'denied' }), { status: 403 })
    },
  })
  const failure = await captureError(() => failureHost.api('user'))
  equal(failedRequestCount, 1)
  equal(failure.message, 'github_http_403:denied')
  equal(failure.message.includes('failure-secret'), false)
  equal(process.env.GH_TOKEN, originalGhToken)
  equal(process.env.GITHUB_TOKEN, originalGithubToken)
}
{
  let observedAuthorization = null
  const host = createProductionHostV1({
    token: 'test-token',
    fetchImpl: async (_url, options) => {
      observedAuthorization = options.headers.Authorization
      return new Response(JSON.stringify({
        sha: MERGE,
        merged: true,
        message: 'Pull Request successfully merged',
      }), { status: 200, headers: { 'x-github-request-id': 'REQ:SUCCESS' } })
    },
  })
  const result = await host.mergePullRequest({ repository: REPOSITORY, prNumber: PR, exactHead: HEAD })
  equal(result.sha, MERGE)
  equal(result.merged, true)
  equal(observedAuthorization, 'Bearer test-token')
}
{
  let observedRequest = null
  const host = createProductionHostV1({
    token: 'test-token',
    fetchImpl: async (url, options) => {
      observedRequest = { url, options }
      return new Response(JSON.stringify({
        message: 'Denied by https://api.github.com/private?token=secret-value',
      }), { status: 403, headers: { 'x-github-request-id': 'REQ:PERMISSION' } })
    },
  })
  const error = await captureError(() => host.mergePullRequest({ repository: REPOSITORY, prNumber: PR, exactHead: HEAD }))
  const diagnostic = error.mutation_diagnostic
  equal(observedRequest.url, `https://api.github.com/repos/whatrune/sd-prompt-studio/pulls/${PR}/merge`)
  equal(observedRequest.options.method, 'PUT')
  equal(observedRequest.options.body, JSON.stringify({ sha: HEAD, merge_method: 'merge' }))
  equal(diagnostic.phase, 'MERGE_MUTATION_HTTP_RESPONSE')
  equal(diagnostic.request_dispatch_started, true)
  equal(diagnostic.response_received, true)
  equal(diagnostic.http_status, 403)
  equal(diagnostic.github_request_id, 'REQ:PERMISSION')
  equal(diagnostic.response_message, 'Denied by [REDACTED_URL]')
  equal(diagnostic.graphql_errors.length, 0)
  equal(Object.keys(diagnostic).join(','), 'phase,request_dispatch_started,response_received,http_status,github_request_id,response_message,graphql_errors,network_exception')
  equal(JSON.stringify(diagnostic).includes('secret-value'), false)
  equal(JSON.stringify(diagnostic).includes('api.github.com'), false)
  equal(JSON.stringify(diagnostic).includes('test-token'), false)
  equal(JSON.stringify(diagnostic).includes('Authorization'), false)

  const fixture = createFixture({ mergeError: error })
  const result = await executeSimplifiedMergeV1({ event: mergeEvent(), host: fixture.host })
  equal(result.state, 'STOPPED')
  equal(result.reason, 'merge_rejected')
  equal(result.outcome, 'DEFINITIVE_REJECTION')
  equal(result.mutation_count, 1)
  equal(result.mutation_diagnostic.phase, 'MERGE_MUTATION_HTTP_RESPONSE')
  equal(fixture.state.mergeMutations, 1)
}
{
  const secretMessages = [
    ['Authorization: Bearer bearer-secret', 'Authorization: Bearer [REDACTED]'],
    ['Authorization: Basic basic-secret', 'Authorization: Basic [REDACTED]'],
    ['Cookie: session=cookie-secret', 'Cookie: [REDACTED]'],
    ['Set-Cookie: session=set-cookie-secret; Secure', 'Set-Cookie: [REDACTED]'],
    ['aUtHoRiZaTiOn: bEaReR mixed-secret', 'aUtHoRiZaTiOn: bEaReR [REDACTED]'],
    ['Authorization   :   Basic    whitespace-secret', 'Authorization   :   Basic    [REDACTED]'],
    ['Mutation failed: Authorization: Bearer embedded-secret while processing', 'Mutation failed: Authorization: Bearer [REDACTED] while processing'],
  ]
  for (const [message, expected] of secretMessages) {
    const host = createProductionHostV1({
      token: 'test-token',
      fetchImpl: async () => new Response(JSON.stringify({ message }), {
        status: 403,
        headers: { 'x-github-request-id': 'REQ:CREDENTIALS' },
      }),
    })
    const error = await captureError(() => host.mergePullRequest({ repository: REPOSITORY, prNumber: PR, exactHead: HEAD }))
    equal(error.mutation_diagnostic.response_message, expected)
    equal(error.mutation_diagnostic.response_message.includes('[REDACTED]'), true)
    equal(error.mutation_diagnostic.response_message === message, false)
  }
}
{
  const host = createProductionHostV1({
    token: 'test-token',
    fetchImpl: async () => new Response(JSON.stringify({ message: 'Head branch was modified' }), {
      status: 409,
      headers: { 'x-github-request-id': 'REQ:HEAD-MISMATCH' },
    }),
  })
  const error = await captureError(() => host.mergePullRequest({ repository: REPOSITORY, prNumber: PR, exactHead: HEAD }))
  const fixture = createFixture({ mergeError: error })
  const result = await executeSimplifiedMergeV1({ event: mergeEvent(), host: fixture.host })
  equal(result.state, 'STOPPED')
  equal(result.reason, 'merge_exact_head_rejected')
  equal(result.outcome, 'DEFINITIVE_REJECTION')
  equal(result.mutation_count, 1)
  equal(result.mutation_diagnostic.http_status, 409)
  equal(result.mutation_diagnostic.response_message, 'Head branch was modified')
  equal(fixture.state.mergeMutations, 1)
}
{
  const host = createProductionHostV1({
    token: 'test-token',
    fetchImpl: async () => new Response(JSON.stringify({ message: 'Service unavailable' }), {
      status: 503,
      headers: { 'x-github-request-id': 'REQ:SERVER' },
    }),
  })
  const error = await captureError(() => host.mergePullRequest({ repository: REPOSITORY, prNumber: PR, exactHead: HEAD }))
  const fixture = createFixture({ mergeError: error })
  const result = await executeSimplifiedMergeV1({ event: mergeEvent(), host: fixture.host })
  equal(result.state, 'INDETERMINATE')
  equal(result.reason, 'merge_outcome_unknown')
  equal(result.outcome, 'OUTCOME_UNKNOWN')
  equal(result.mutation_count, 1)
  equal(result.mutation_diagnostic.http_status, 503)
  equal(fixture.state.mergeMutations, 1)
}
{
  const host = createProductionHostV1({
    token: 'test-token',
    fetchImpl: async () => new Response(JSON.stringify({
      message: 'Denied by https://api.github.com/merge?token=url-secret',
    }), { status: 403, headers: { 'x-github-request-id': 'REQ:TEXT' } }),
  })
  const error = await captureError(() => host.mergePullRequest({ repository: REPOSITORY, prNumber: PR, exactHead: HEAD }))
  const diagnostic = error.mutation_diagnostic
  equal(diagnostic.response_message, 'Denied by [REDACTED_URL]')
  equal(JSON.stringify(diagnostic).includes('url-secret'), false)

  const ordinaryHost = createProductionHostV1({
    token: 'test-token',
    fetchImpl: async () => new Response(JSON.stringify({ message: 'ordinary non-secret diagnostic text' }), {
      status: 403,
      headers: { 'x-github-request-id': 'REQ:ORDINARY' },
    }),
  })
  const ordinaryError = await captureError(() => ordinaryHost.mergePullRequest({ repository: REPOSITORY, prNumber: PR, exactHead: HEAD }))
  equal(ordinaryError.mutation_diagnostic.response_message, 'ordinary non-secret diagnostic text')
}
{
  const urlLikeMessages = [
    'Denied by //example.test/private?token=protocol-relative-secret',
    'Denied by 192.0.2.10/private?token=ipv4-secret',
    'Denied by [2001:db8::1]/private?token=ipv6-secret',
    'Denied by 2001:db8::1/private?token=bare-ipv6-secret',
    'Denied by localhost/private?secret=localhost-secret',
    'Denied by example.test/private?secret=host-path-secret',
    'Denied by user:password@example.test/private?secret=userinfo-secret',
    'Denied by user:password@[2001:db8::1]/private?secret=ipv6-userinfo-secret',
  ]
  for (const message of urlLikeMessages) {
    const host = createProductionHostV1({
      token: 'test-token',
      fetchImpl: async () => new Response(JSON.stringify({ message }), {
        status: 403,
        headers: { 'x-github-request-id': 'REQ:URL-FORMS' },
      }),
    })
    const error = await captureError(() => host.mergePullRequest({ repository: REPOSITORY, prNumber: PR, exactHead: HEAD }))
    equal(error.mutation_diagnostic.response_message, 'Denied by [REDACTED_URL]')
  }

  const projectionError = new Error('raw_projection_failure')
  Object.defineProperty(projectionError, 'mutation_diagnostic', { value: {
    phase: 'MERGE_MUTATION_HTTP_RESPONSE',
    request_dispatch_started: true,
    response_received: true,
    http_status: 403,
    github_request_id: 'REQ:RAW-PROJECTION',
    response_message: 'Projection saw //example.test/private?token=projection-secret; Authorization: Bearer projection-bearer-secret',
    graphql_errors: [],
    network_exception: null,
  } })
  const fixture = createFixture({ mergeError: projectionError })
  const result = await executeSimplifiedMergeV1({ event: mergeEvent(), host: fixture.host })
  equal(result.mutation_diagnostic.response_message, 'Projection saw [REDACTED_URL] Authorization: Bearer [REDACTED]')
  equal(JSON.stringify(result.mutation_diagnostic).includes('projection-secret'), false)
  equal(JSON.stringify(result.mutation_diagnostic).includes('projection-bearer-secret'), false)
}
{
  const host = createProductionHostV1({
    token: 'test-token',
    fetchImpl: async () => new Response(JSON.stringify({ message: 'Resource not accessible by integration' }), {
      status: 403,
      headers: { 'x-github-request-id': 'REQ:HTTP' },
    }),
  })
  const error = await captureError(() => host.mergePullRequest({ repository: REPOSITORY, prNumber: PR, exactHead: HEAD }))
  equal(error.mutation_diagnostic.phase, 'MERGE_MUTATION_HTTP_RESPONSE')
  equal(error.mutation_diagnostic.request_dispatch_started, true)
  equal(error.mutation_diagnostic.response_received, true)
  equal(error.mutation_diagnostic.http_status, 403)
  equal(error.mutation_diagnostic.github_request_id, 'REQ:HTTP')
  equal(error.mutation_diagnostic.response_message, 'Resource not accessible by integration')
  equal(error.mutation_diagnostic.graphql_errors.length, 0)
}
{
  const host = createProductionHostV1({
    token: 'test-token',
    fetchImpl: async () => {
      const error = new TypeError('connection reset after dispatch; Authorization: Bearer transport-secret')
      error.code = 'ECONNRESET'
      throw error
    },
  })
  const error = await captureError(() => host.mergePullRequest({ repository: REPOSITORY, prNumber: PR, exactHead: HEAD }))
  equal(error.mutation_diagnostic.phase, 'MERGE_MUTATION_TRANSPORT')
  equal(error.mutation_diagnostic.request_dispatch_started, true)
  equal(error.mutation_diagnostic.response_received, false)
  equal(error.mutation_diagnostic.http_status, null)
  equal(error.mutation_diagnostic.network_exception.name, 'TypeError')
  equal(error.mutation_diagnostic.network_exception.code, 'ECONNRESET')
  equal(JSON.stringify(error.mutation_diagnostic).includes('connection reset'), false)
  equal(JSON.stringify(error.mutation_diagnostic).includes('transport-secret'), false)
  const fixture = createFixture({ mergeError: error })
  const result = await executeSimplifiedMergeV1({ event: mergeEvent(), host: fixture.host })
  equal(result.state, 'INDETERMINATE')
  equal(result.outcome, 'OUTCOME_UNKNOWN')
  equal(fixture.state.mergeMutations, 1)
}
{
  const host = createProductionHostV1({
    token: 'test-token',
    fetchImpl: async () => new Response('{invalid-json', {
      status: 200,
      headers: { 'x-github-request-id': 'REQ:MALFORMED' },
    }),
  })
  const error = await captureError(() => host.mergePullRequest({ repository: REPOSITORY, prNumber: PR, exactHead: HEAD }))
  equal(error.mutation_diagnostic.phase, 'MERGE_MUTATION_RESPONSE_PARSE')
  equal(error.mutation_diagnostic.request_dispatch_started, true)
  equal(error.mutation_diagnostic.response_received, true)
  equal(error.mutation_diagnostic.http_status, 200)
  equal(error.mutation_diagnostic.github_request_id, 'REQ:MALFORMED')
  equal(error.mutation_diagnostic.response_message, null)
  equal(error.mutation_diagnostic.graphql_errors.length, 0)
  equal(error.mutation_diagnostic.network_exception, null)
  const fixture = createFixture({ mergeError: error })
  const result = await executeSimplifiedMergeV1({ event: mergeEvent(), host: fixture.host })
  equal(result.state, 'INDETERMINATE')
  equal(result.outcome, 'OUTCOME_UNKNOWN')
  equal(fixture.state.mergeMutations, 1)
}
{
  const fixture = createFixture({ mergeResponse: { message: 'indeterminate response' } })
  const result = await executeSimplifiedMergeV1({ event: mergeEvent(), host: fixture.host })
  equal(result.state, 'INDETERMINATE')
  equal(result.reason, 'merge_after_state_invalid')
  equal(result.outcome, 'OUTCOME_UNKNOWN')
  equal(result.mutation_count, 1)
  equal(fixture.state.mergeMutations, 1)
}
{
  const fixture = createFixture({ afterMergeParents: [{ sha: BASE }, { sha: '4'.repeat(40) }] })
  const result = await executeSimplifiedMergeV1({ event: mergeEvent(), host: fixture.host })
  equal(result.state, 'INDETERMINATE')
  equal(result.reason, 'merge_after_refetch_invalid')
  equal(result.outcome, 'OUTCOME_UNKNOWN')
  equal(result.mutation_count, 1)
  equal(fixture.state.mergeMutations, 1)
}
{
  const fixture = createFixture()
  const decision = decisionInput({
    review_kind: 'TASK_ISSUE_COMMENT',
    review_url: `https://github.com/${REPOSITORY}/issues/${TASK}#issuecomment-${REVIEW}`,
  })
  const result = await executeSimplifiedMergeV1({ event: mergeEvent(decision), host: fixture.host })
  equal(result.state, 'COMPLETED')
  equal(fixture.state.mergeMutations, 1)
}
{
  const fixture = createFixture()
  const result = await executeSimplifiedMergeV1({ event: {
    action: 'created', repository: { full_name: REPOSITORY },
    issue: { number: PR, pull_request: { url: 'https://api.invalid/pull' } },
    comment: { user: { login: 'someone' }, body: 'ordinary review reply' },
  }, host: fixture.host })
  equal(result.state, 'NOT_APPLICABLE')
  equal(fixture.state.mergeMutations, 0)
}

const workflow = readFileSync(new URL('../.github/workflows/protected-transition-admission-v1.yml', import.meta.url), 'utf8')
const workflowDocument = parseDocument(workflow)
equal(workflowDocument.errors.length, 0)
const workflowValue = workflowDocument.toJS()
const workflowPermissions = workflowValue.permissions
const protectedTransitionJob = workflowValue.jobs.simplified_protected_transition_v1
const protectedTransitionSteps = protectedTransitionJob.steps
const protectedTransitionStepNames = protectedTransitionSteps.map((step) => step.name)
const expectedProtectedTransitionStepNames = [
  'Require the immutable default-branch host',
  'Checkout exact workflow host',
  'Use Node.js 24',
  'Enable Corepack',
  'Install locked Node dependencies',
  'Smoke import the protected-transition entrypoint',
  'Evaluate the live protected operation',
]
equal(JSON.stringify(protectedTransitionStepNames), JSON.stringify(expectedProtectedTransitionStepNames))
const corepackStep = protectedTransitionSteps[3]
const installStep = protectedTransitionSteps[4]
const importSmokeStep = protectedTransitionSteps[5]
const liveOperationStep = protectedTransitionSteps[6]
equal(corepackStep.run.trim(), 'set -euo pipefail\ncorepack enable')
equal(installStep.run.trim(), 'set -euo pipefail\npnpm install --frozen-lockfile')
equal(
  importSmokeStep.run.trim(),
  'set -euo pipefail\nnode --input-type=module -e "await import(\'./scripts/run-protected-transition-admission-v1.mjs\')"',
)
equal(corepackStep.env, undefined)
equal(installStep.env, undefined)
equal(importSmokeStep.env, undefined)
for (const prerequisiteStep of [corepackStep, installStep, importSmokeStep]) {
  equal(prerequisiteStep.if, undefined)
  equal(prerequisiteStep['continue-on-error'], undefined)
}
equal(Object.keys(liveOperationStep.env).join(','), 'GH_TOKEN')
equal(liveOperationStep.env.GH_TOKEN, '${{ github.token }}')
equal(liveOperationStep.if, undefined)
equal(liveOperationStep['continue-on-error'], undefined)
equal(protectedTransitionJob.env, undefined)
equal(workflowValue.env, undefined)
const credentialBearingSteps = protectedTransitionSteps
  .filter((step) => Object.keys(step.env ?? {}).some((name) => name === 'GH_TOKEN' || name === 'GITHUB_TOKEN'))
  .map((step) => step.name)
equal(JSON.stringify(credentialBearingSteps), JSON.stringify(['Evaluate the live protected operation']))
equal(workflow.includes('GITHUB_TOKEN'), false)
const pnpmInstallLines = workflow.split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => /^pnpm install(?:\s|$)/.test(line))
equal(JSON.stringify(pnpmInstallLines), JSON.stringify(['pnpm install --frozen-lockfile']))
equal(workflow.split(/\r?\n/).some((line) => /^\s*npm install(?:\s|$)/.test(line)), false)
const preflightSource = readFileSync(new URL('./protected-transition-merge-operator-preflight-v1.mjs', import.meta.url), 'utf8')
const runnerSource = readFileSync(new URL('./run-protected-transition-admission-v1.mjs', import.meta.url), 'utf8')
const agentsSource = readFileSync(new URL('../AGENTS.md', import.meta.url), 'utf8')
const automationOverviewSource = readFileSync(new URL('../docs/automation/00-automation-overview.md', import.meta.url), 'utf8')
const taskAssignmentTemplateSource = readFileSync(new URL('../docs/team/07-task-assignment-template.md', import.meta.url), 'utf8')
const integratedLeadSource = readFileSync(new URL('../docs/team/08-integrated-lead-charter.md', import.meta.url), 'utf8')
const delegationSource = readFileSync(new URL('../docs/team/11-delegation-and-result-contract.md', import.meta.url), 'utf8')
const sharedRoleSource = readFileSync(new URL('../docs/team/13-shared-role-execution-contract.md', import.meta.url), 'utf8')
ok(workflow.includes('simplified_protected_transition_v1:'))
ok(workflow.includes('persist-credentials: false'))
ok(workflow.includes('github.workflow_sha'))
ok(workflow.includes('issue_comment:'))
equal(Object.keys(workflowPermissions).sort().join(','), 'checks,contents,issues,pull-requests,statuses')
equal(workflowPermissions.contents, 'write')
equal(workflowPermissions.checks, 'read')
equal(workflowPermissions.issues, 'read')
equal(workflowPermissions['pull-requests'], 'read')
equal(workflowPermissions.statuses, 'read')
equal(workflow.includes('workflow_dispatch:'), false)
equal(workflow.includes('READY_BOT_TOKEN'), false)
equal(preflightSource.includes('executeSimplifiedReadyV1'), false)
equal(preflightSource.includes('markPullRequestReadyForReview'), false)
equal(preflightSource.includes('READY_MUTATION'), false)
equal(preflightSource.includes('mutation MergeSimplifiedPullRequest'), false)
equal(preflightSource.includes('mergePullRequest(input:'), false)
ok(preflightSource.includes('host.mergePullRequest'))
ok(runnerSource.includes("valueAfter('--pre-decision-preflight-file')"))
ok(runnerSource.includes('acquireSimplifiedPreDecisionPreflightV1'))
ok(runnerSource.includes('acquireSimplifiedReviewPublicationPreflightV2'))
ok(runnerSource.includes('projectReviewPublicationLogicalAssignmentIdentityV2'))
ok(runnerSource.includes('publishTaskAssignmentComment'))
ok(runnerSource.includes("canonical_record: 'GITHUB_RESOURCE'"))
equal(runnerSource.includes('fresh_review_terminal_cursor'), false)
ok(runnerSource.includes('serializeCanonicalTaskIssueBodyV1'))
ok(runnerSource.includes('publishCanonicalTaskIssueV1'))
ok(runnerSource.includes('createTaskIssue'))
ok(runnerSource.includes('patchTaskIssueBody'))
equal((runnerSource.match(/method: 'PATCH'/g) ?? []).length, 2)
ok(runnerSource.includes("diagnosticOperation: 'CANONICAL_TASK_CREATE_MUTATION'"))
ok(runnerSource.includes("diagnosticOperation: 'CANONICAL_TASK_PATCH_MUTATION'"))
ok(runnerSource.includes("diagnosticOperation: 'TASK_ISSUE_CLOSE_MUTATION'"))
ok(runnerSource.includes("authenticatedActor.login !== admittedRequest.product_owner_login"))
ok(runnerSource.includes("resource.author_association !== 'OWNER'"))
ok(runnerSource.includes("throw new Error('github_token_ambiguous')"))
equal(runnerSource.includes('context.token ?? process.env.GH_TOKEN'), false)
equal(runnerSource.includes('token = process.env.GH_TOKEN'), false)
ok(runnerSource.includes("valueAfter('--create-canonical-task-issue-file')"))
ok(runnerSource.includes("valueAfter('--close-canonical-task-after-cleanup-file')"))
ok(runnerSource.includes("valueAfter('--serialize-canonical-task-body-file')"))
ok(runnerSource.includes("args.includes('--publication-body-output-file')"))
ok(runnerSource.includes('writeProtectedPublicationBodyFileV1'))
equal(runnerSource.includes(".join(' ')"), false)
ok(agentsSource.includes('## Immediate Terminal Continuation'))
ok(agentsSource.includes('wait_threads'))
ok(agentsSource.includes('same owning Worker'))
ok(agentsSource.includes('at most 10 seconds'))
ok(integratedLeadSource.includes('checks PASS dispatches Fresh Review'))
ok(integratedLeadSource.includes('correction checks PASS dispatches replacement Fresh Review'))
ok(integratedLeadSource.includes('read-only pre-Decision preflight'))
ok(integratedLeadSource.includes('wake-up cursor; it is not publication authority'))
ok(integratedLeadSource.includes('canonical semantic payloads are byte-identical'))
ok(automationOverviewSource.includes('supplies no publication authority'))
ok(automationOverviewSource.includes('Multiple physical comments with that identity'))
ok(taskAssignmentTemplateSource.includes('Do not record a `wait_threads` cursor'))
ok(delegationSource.includes('### Logical Review-publication Assignment V2'))
ok(sharedRoleSource.includes('Fresh Review `CHANGES_REQUIRED` prohibit stage advance'))
ok(sharedRoleSource.includes('one deterministic `REVIEW_FINDING` cursor'))
ok(sharedRoleSource.includes('terminal cursor is a wake-up signal only'))
ok(sharedRoleSource.includes('zero active unresolved non-outdated threads'))
equal((preflightSource.match(/const initial = await acquireLiveSnapshot/g) ?? []).length, 1)
equal((preflightSource.match(/const final = await acquireLiveSnapshot/g) ?? []).length, 1)
ok(runnerSource.includes("method: 'PUT'"))
ok(runnerSource.includes("body: JSON.stringify({ sha: exactHead, merge_method: 'merge' })"))
equal(runnerSource.includes('simplified-workflow-dispatch-event-file'), false)
equal((workflow.match(/^    runs-on:/gm) ?? []).length, 1)
for (const retired of ['ready_transition_required_resume', 'minimal_governance', 'terminal_observation', 'protected_transition_task_state']) {
  equal(workflow.includes(retired), false)
}

process.stdout.write(`simplified protected-transition checks passed (${assertions} assertions)\n`)
