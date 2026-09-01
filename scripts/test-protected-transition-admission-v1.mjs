import assert from 'node:assert/strict'
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
  createProductionHostV1,
  ensureReviewAuthorityAndRunPreflightV1,
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
  purpose: 'Predelegate one exact Review-publication assignment materialization.',
  background: 'Exact PR, HEAD, and base are derived only after Fresh Review approval.',
  input_documents: 'Shared Role Execution Contract and Review Execution Contract.',
  allowed_changes: {
    protected_action: 'REVIEW_AUTHORITY_PUBLICATION',
    activation: 'FRESH_EXACT_HEAD_REVIEW_APPROVE',
    materialization_only: true,
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
    operation_count: 1,
    fallback_allowed: false,
    ...grantOverrides,
  },
  forbidden_changes: [
    'review_publication_before_fresh_approval', 'alternate_surface_fallback', 'merge', 'retry',
  ],
  expected_outputs: 'One exact assignment followed by Review publication or reuse.',
  validation: 'Fresh binding, cardinality, and refetch equality.',
  completion_conditions: 'One exact assignment or zero-mutation reuse.',
  escalation_conditions: 'Any stale identity, duplicate, conflict, or ambiguous mutation.',
  ...topOverrides,
})

const taskBodyWithReviewPublicationAssignment = (options = {}) => (
  `${serializeSimplifiedTaskAuthorityV1(taskInput)}\n\`\`\`yaml\n${JSON.stringify(reviewPublicationAssignment(options), null, 2)}\n\`\`\`\n`
)

const taskBodyWithReviewPublicationRecords = ({
  includePredelegation = false,
  includeAuthority = false,
  actor = 'whatrune',
  surface = 'TASK_ISSUE_COMMENT',
  predelegationTopOverrides = {},
  predelegationGrantOverrides = {},
  authorityTopOverrides = {},
  authorityGrantOverrides = {},
} = {}) => {
  const blocks = []
  if (includePredelegation) {
    blocks.push(reviewPublicationPredelegation({
      actor, surface, topOverrides: predelegationTopOverrides, grantOverrides: predelegationGrantOverrides,
    }))
  }
  if (includeAuthority) {
    blocks.push(reviewPublicationAssignment({
      actor, surface, topOverrides: authorityTopOverrides, grantOverrides: authorityGrantOverrides,
    }))
  }
  return `${serializeSimplifiedTaskAuthorityV1(taskInput)}${blocks.map((record) => (
    `\n\`\`\`yaml\n${JSON.stringify(record, null, 2)}\n\`\`\`\n`
  )).join('')}`
}

const createReviewRoutingFixture = ({
  actor = 'whatrune',
  pullAuthor = 'whatrune',
  existing = [],
  includeAuthority = true,
  includePredelegation = false,
  authorityTopOverrides = {},
  authorityGrantOverrides = {},
  predelegationTopOverrides = {},
  predelegationGrantOverrides = {},
  authorityBody = null,
  issueAuthorAssociation = 'OWNER',
  finalActor = actor,
  finalHead = HEAD,
  finalBase = BASE,
  finalAuthorityBody = null,
  authorityAppearsBeforeMutation = false,
  publicationError = null,
  assignmentPatchError = null,
  assignmentRefetchMismatch = false,
  refetchMismatch = false,
  refetchActorMismatch = false,
} = {}) => {
  const base = createFixture()
  const expectedBody = serializeSimplifiedReviewV1(reviewInput())
  const state = {
    pullReviewMutations: 0,
    taskCommentMutations: 0,
    pullReviews: [],
    taskComments: [],
    userReads: 0,
    taskReads: 0,
    pullReads: 0,
    mainReads: 0,
    taskCommentListReads: 0,
    assignmentPatchMutations: 0,
    assignmentPatchBodies: [],
    taskBodyWasPatched: false,
    assignmentMismatchDelivered: false,
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
  const taskCommentResource = (id, body = expectedBody) => ({
    id,
    issue_url: `https://api.github.com/repos/${REPOSITORY}/issues/${TASK}`,
    html_url: `https://github.com/${REPOSITORY}/issues/${TASK}#issuecomment-${id}`,
    author_association: 'OWNER',
    user: { login: 'whatrune' },
    body,
  })
  for (const [index, item] of existing.entries()) {
    const id = 9200 + index
    const body = item.body ?? expectedBody
    if (item.kind === 'PULL_REQUEST_REVIEW') state.pullReviews.push(pullReviewResource(id, body))
    else state.taskComments.push(taskCommentResource(id, body))
  }
  const host = {
    async api(route) {
      if (route === 'user') {
        state.userReads += 1
        return { login: state.userReads === 1 ? actor : finalActor }
      }
      if (route === `repos/${REPOSITORY}/issues/${TASK}`) {
        state.taskReads += 1
        const task = await base.host.api(route)
        const surface = actor === pullAuthor ? 'TASK_ISSUE_COMMENT' : 'PULL_REQUEST_REVIEW'
        const initialBody = authorityBody ?? taskBodyWithReviewPublicationRecords({
          includePredelegation,
          includeAuthority,
          actor,
          surface,
          predelegationTopOverrides,
          predelegationGrantOverrides,
          authorityTopOverrides,
          authorityGrantOverrides,
        })
        if (state.taskBody === undefined) state.taskBody = initialBody
        let body = state.taskBody
        if (!state.taskBodyWasPatched && state.taskReads > 1 && finalAuthorityBody !== null) {
          body = finalAuthorityBody
        } else if (
          state.taskBodyWasPatched && assignmentRefetchMismatch && !state.assignmentMismatchDelivered
        ) {
          state.assignmentMismatchDelivered = true
          body = `${state.taskBody}\n`
        }
        return {
          ...task,
          html_url: `https://github.com/${REPOSITORY}/issues/${TASK}`,
          author_association: issueAuthorAssociation,
          body,
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
    async patchTaskIssueBody({ repository, taskIssue, body }) {
      state.assignmentPatchMutations += 1
      state.assignmentPatchBodies.push(body)
      if (assignmentPatchError !== null) throw assignmentPatchError
      if (repository !== REPOSITORY || taskIssue !== TASK || typeof body !== 'string') {
        throw new Error('unexpected_task_body_patch')
      }
      state.taskBody = body
      state.taskBodyWasPatched = true
      return {
        number: TASK,
        state: 'open',
        html_url: `https://github.com/${REPOSITORY}/issues/${TASK}`,
        author_association: 'OWNER',
        user: { login: 'whatrune' },
        body,
      }
    },
    graphql: (...values) => base.host.graphql(...values),
  }
  return { host, state, expectedBody }
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

{
  const directory = mkdtempSync(join(tmpdir(), 'protected-publication-transport-'))
  try {
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

// One predelegation materializes one deterministic exact Task-body assignment before Review publication.
{
  const fixture = createReviewRoutingFixture({ includeAuthority: false, includePredelegation: true })
  const initialBody = taskBodyWithReviewPublicationRecords({ includePredelegation: true })
  const result = await ensureReviewAuthorityAndRunPreflightV1({ request: reviewRoutingInput(), host: fixture.host })
  equal(result.state, 'MERGE_READY')
  equal(result.assignment_materialization_mutation_count, 1)
  equal(result.publication_mutation_count, 1)
  equal(fixture.state.assignmentPatchMutations, 1)
  equal(fixture.state.taskCommentMutations, 1)
  equal(fixture.state.pullReviewMutations, 0)
  equal(fixture.state.assignmentPatchBodies.length, 1)
  equal(fixture.state.assignmentPatchBodies[0].slice(0, initialBody.length), initialBody)
  const yamlBlocks = [...fixture.state.assignmentPatchBodies[0].matchAll(/```yaml\r?\n([\s\S]*?)\r?\n```/gu)]
  equal(yamlBlocks.length, 2)
  const materialized = parseDocument(yamlBlocks[1][1], { uniqueKeys: true }).toJS()
  equal(materialized.record_type, 'task_assignment')
  equal(materialized.authority_source, `https://github.com/${REPOSITORY}/issues/${TASK}`)
  equal(materialized.canonical_record, `https://github.com/${REPOSITORY}/issues/${TASK}`)
  equal(materialized.prior_record_url, `https://github.com/${REPOSITORY}/issues/${TASK}`)
  equal(materialized.allowed_changes.pull_request, PR)
  equal(materialized.allowed_changes.exact_head, HEAD)
  equal(materialized.allowed_changes.expected_base, BASE)
  equal(materialized.allowed_changes.operation_count, 1)
  equal(materialized.allowed_changes.fallback_allowed, false)
  equal(result.publication_authority_record, `https://github.com/${REPOSITORY}/issues/${TASK}`)

  const repeatedFixture = createReviewRoutingFixture({ includeAuthority: false, includePredelegation: true })
  await ensureReviewAuthorityAndRunPreflightV1({ request: reviewRoutingInput(), host: repeatedFixture.host })
  equal(repeatedFixture.state.assignmentPatchBodies[0], fixture.state.assignmentPatchBodies[0])
}

// The structural profiles coexist without substring-based false duplicate detection.
{
  const fixture = createReviewRoutingFixture({ includeAuthority: true, includePredelegation: true })
  const result = await ensureReviewAuthorityAndRunPreflightV1({ request: reviewRoutingInput(), host: fixture.host })
  equal(result.state, 'MERGE_READY')
  equal(result.assignment_materialization_mutation_count, 0)
  equal(result.publication_mutation_count, 1)
  equal(fixture.state.assignmentPatchMutations, 0)
  equal(fixture.state.taskCommentMutations, 1)
}

// Existing exact Review authority bypasses assignment materialization entirely.
{
  const fixture = createReviewRoutingFixture({
    existing: [{ kind: 'TASK_ISSUE_COMMENT' }], includeAuthority: false, includePredelegation: true,
  })
  const result = await ensureReviewAuthorityAndRunPreflightV1({ request: reviewRoutingInput(), host: fixture.host })
  equal(result.publication_route, 'REUSED')
  equal(result.assignment_materialization_mutation_count, 0)
  equal(result.publication_mutation_count, 0)
  equal(fixture.state.assignmentPatchMutations, 0)
  equal(fixture.state.taskCommentMutations, 0)
}

// A concurrently materialized exact assignment is reused with zero Task-body mutation.
{
  const finalBody = taskBodyWithReviewPublicationRecords({ includePredelegation: true, includeAuthority: true })
  const fixture = createReviewRoutingFixture({
    includeAuthority: false, includePredelegation: true, finalAuthorityBody: finalBody,
  })
  const result = await ensureReviewAuthorityAndRunPreflightV1({ request: reviewRoutingInput(), host: fixture.host })
  equal(result.state, 'MERGE_READY')
  equal(result.assignment_materialization_mutation_count, 0)
  equal(fixture.state.assignmentPatchMutations, 0)
  equal(fixture.state.taskCommentMutations, 1)
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

// Predelegation and exact-assignment cardinality are independent and fail closed.
{
  const predelegationBody = taskBodyWithReviewPublicationRecords({ includePredelegation: true })
  const predelegationBlock = predelegationBody.slice(predelegationBody.indexOf('```yaml'))
  const duplicate = createReviewRoutingFixture({
    includeAuthority: false,
    authorityBody: `${predelegationBody}\n${predelegationBlock}`,
  })
  equal((await captureError(() => ensureReviewAuthorityAndRunPreflightV1({
    request: reviewRoutingInput(), host: duplicate.host,
  }))).message, 'review_publication_predelegation_duplicate')
  equal(duplicate.state.assignmentPatchMutations, 0)
  equal(duplicate.state.pullReviewMutations + duplicate.state.taskCommentMutations, 0)

  const invalid = createReviewRoutingFixture({
    includeAuthority: false,
    includePredelegation: true,
    predelegationGrantOverrides: { activation: 'IMMEDIATE' },
  })
  equal((await captureError(() => ensureReviewAuthorityAndRunPreflightV1({
    request: reviewRoutingInput(), host: invalid.host,
  }))).message, 'review_publication_predelegation_invalid')
  equal(invalid.state.assignmentPatchMutations, 0)
  equal(invalid.state.pullReviewMutations + invalid.state.taskCommentMutations, 0)

  const stale = createReviewRoutingFixture({
    includeAuthority: true,
    includePredelegation: true,
    authorityGrantOverrides: { exact_head: BASE },
  })
  equal((await captureError(() => ensureReviewAuthorityAndRunPreflightV1({
    request: reviewRoutingInput(), host: stale.host,
  }))).message, 'review_publication_authority_invalid')
  equal(stale.state.assignmentPatchMutations, 0)
  equal(stale.state.pullReviewMutations + stale.state.taskCommentMutations, 0)
}

// Drift before Task-body PATCH produces zero mutation and never absorbs unrelated body changes.
{
  const headDrift = createReviewRoutingFixture({
    includeAuthority: false, includePredelegation: true, finalHead: '4'.repeat(40),
  })
  equal((await captureError(() => ensureReviewAuthorityAndRunPreflightV1({
    request: reviewRoutingInput(), host: headDrift.host,
  }))).message, 'review_publication_final_binding_invalid')
  equal(headDrift.state.assignmentPatchMutations, 0)
  equal(headDrift.state.pullReviewMutations + headDrift.state.taskCommentMutations, 0)

  const initialBody = taskBodyWithReviewPublicationRecords({ includePredelegation: true })
  const bodyDrift = createReviewRoutingFixture({
    includeAuthority: false,
    includePredelegation: true,
    finalAuthorityBody: `${initialBody}\n`,
  })
  equal((await captureError(() => ensureReviewAuthorityAndRunPreflightV1({
    request: reviewRoutingInput(), host: bodyDrift.host,
  }))).message, 'review_assignment_materialization_final_binding_invalid')
  equal(bodyDrift.state.assignmentPatchMutations, 0)
  equal(bodyDrift.state.pullReviewMutations + bodyDrift.state.taskCommentMutations, 0)
}

// An ambiguous PATCH or post-PATCH mismatch is terminal and receives no Review publication.
{
  const ambiguous = createReviewRoutingFixture({
    includeAuthority: false,
    includePredelegation: true,
    assignmentPatchError: new Error('github_mutation_request_failed'),
  })
  equal((await captureError(() => ensureReviewAuthorityAndRunPreflightV1({
    request: reviewRoutingInput(), host: ambiguous.host,
  }))).message, 'github_mutation_request_failed')
  equal(ambiguous.state.assignmentPatchMutations, 1)
  equal(ambiguous.state.pullReviewMutations + ambiguous.state.taskCommentMutations, 0)

  const mismatch = createReviewRoutingFixture({
    includeAuthority: false, includePredelegation: true, assignmentRefetchMismatch: true,
  })
  equal((await captureError(() => ensureReviewAuthorityAndRunPreflightV1({
    request: reviewRoutingInput(), host: mismatch.host,
  }))).message, 'review_assignment_materialization_refetch_mismatch')
  equal(mismatch.state.assignmentPatchMutations, 1)
  equal(mismatch.state.pullReviewMutations + mismatch.state.taskCommentMutations, 0)
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
  const observed = []
  const host = createProductionHostV1({
    token: 'test-token',
    fetchImpl: async (url, options) => {
      observed.push({ url, options })
      return new Response(JSON.stringify({ id: observed.length }), {
        status: 200,
        headers: { 'x-github-request-id': `REQ:REVIEW:${observed.length}` },
      })
    },
  })
  await host.publishPullRequestReview({
    repository: REPOSITORY, prNumber: PR, exactHead: HEAD, body: reviewBody,
  })
  await host.publishTaskIssueComment({ repository: REPOSITORY, taskIssue: TASK, body: reviewBody })
  await host.patchTaskIssueBody({ repository: REPOSITORY, taskIssue: TASK, body: taskBody })
  equal(observed[0].url, `https://api.github.com/repos/${REPOSITORY}/pulls/${PR}/reviews`)
  equal(observed[0].options.method, 'POST')
  equal(observed[0].options.body, JSON.stringify({ body: reviewBody, event: 'APPROVE', commit_id: HEAD }))
  equal(observed[1].url, `https://api.github.com/repos/${REPOSITORY}/issues/${TASK}/comments`)
  equal(observed[1].options.method, 'POST')
  equal(observed[1].options.body, JSON.stringify({ body: reviewBody }))
  equal(observed[2].url, `https://api.github.com/repos/${REPOSITORY}/issues/${TASK}`)
  equal(observed[2].options.method, 'PATCH')
  equal(observed[2].options.body, JSON.stringify({ body: taskBody }))
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
const workflowPermissions = workflowDocument.toJS().permissions
const preflightSource = readFileSync(new URL('./protected-transition-merge-operator-preflight-v1.mjs', import.meta.url), 'utf8')
const runnerSource = readFileSync(new URL('./run-protected-transition-admission-v1.mjs', import.meta.url), 'utf8')
const agentsSource = readFileSync(new URL('../AGENTS.md', import.meta.url), 'utf8')
const automationSource = readFileSync(new URL('../docs/automation/00-automation-overview.md', import.meta.url), 'utf8')
const assignmentTemplateSource = readFileSync(new URL('../docs/team/07-task-assignment-template.md', import.meta.url), 'utf8')
const integratedLeadSource = readFileSync(new URL('../docs/team/08-integrated-lead-charter.md', import.meta.url), 'utf8')
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
ok(runnerSource.includes("args.includes('--publication-body-output-file')"))
ok(runnerSource.includes('writeProtectedPublicationBodyFileV1'))
ok(runnerSource.includes("method: 'PATCH'"))
ok(runnerSource.includes("diagnosticOperation: 'REVIEW_ASSIGNMENT_MUTATION'"))
ok(runnerSource.includes('review_publication_predelegation_duplicate'))
ok(runnerSource.includes('assignment_materialization_mutation_count'))
equal(runnerSource.includes(".join(' ')"), false)
ok(agentsSource.includes('## Immediate Terminal Continuation'))
ok(agentsSource.includes('wait_threads'))
ok(agentsSource.includes('same owning Worker'))
ok(agentsSource.includes('at most 10 seconds'))
ok(integratedLeadSource.includes('checks PASS dispatches Fresh Review'))
ok(integratedLeadSource.includes('correction checks PASS dispatches replacement Fresh Review'))
ok(integratedLeadSource.includes('read-only pre-Decision preflight'))
ok(integratedLeadSource.includes('materialization-only predelegation'))
ok(automationSource.includes('cardinalities `1` and `0..1`'))
ok(assignmentTemplateSource.includes('FRESH_EXACT_HEAD_REVIEW_APPROVE'))
ok(sharedRoleSource.includes('append exactly one exact assignment'))
ok(sharedRoleSource.includes('Timeout, nonterminal state, stale HEAD, and identity mismatch prohibit stage advance'))
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
