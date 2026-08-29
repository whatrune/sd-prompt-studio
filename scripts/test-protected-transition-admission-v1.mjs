import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  evaluateRequiredChecksV1,
  executeSimplifiedMergeV1,
  executeSimplifiedReadyV1,
  parseSimplifiedMergeDecisionV1,
  parseSimplifiedReviewV1,
  parseSimplifiedTaskAuthorityV1,
  serializeSimplifiedMergeDecisionV1,
  serializeSimplifiedReviewV1,
  serializeSimplifiedTaskAuthorityV1,
} from './protected-transition-merge-operator-preflight-v1.mjs'
import { createProductionHostV1, takeReadyMutationTokenV1 } from './run-protected-transition-admission-v1.mjs'

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

const createFixture = ({ draft = false, reviewHead = HEAD, paths = PATHS, threads = [], checks, main = BASE, readyError = null } = {}) => {
  const state = {
    draft,
    merged: false,
    head: HEAD,
    main,
    mergeCommit: null,
    readyMutations: 0,
    mergeMutations: 0,
  }
  const checkNodes = checks ?? [check('build-preview', 15368), check('Cloudflare Pages', 85455)]
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
    head: { sha: state.head, repo: { full_name: REPOSITORY } },
    base: { ref: 'main', repo: { full_name: REPOSITORY } },
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
      if (route === `repos/${REPOSITORY}/git/commits/${MERGE}`) return { sha: MERGE, parents: [{ sha: BASE }, { sha: HEAD }] }
      throw new Error(`unexpected_api:${route}`)
    },
    async graphql(query) {
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
          mergeable: 'MERGEABLE',
          mergeStateStatus: 'CLEAN',
          reviewThreads: { nodes: threads, pageInfo: { hasNextPage: false, endCursor: null } },
        } } }
      }
      if (query.includes('mutation MarkSimplifiedReady')) {
        if (readyError !== null) throw readyError
        state.readyMutations += 1
        state.draft = false
        return { markPullRequestReadyForReview: { pullRequest: { id: 'PR_node_430', number: PR, state: 'OPEN', isDraft: false, merged: false, headRefOid: HEAD } } }
      }
      if (query.includes('mutation MergeSimplifiedPullRequest')) {
        state.mergeMutations += 1
        state.merged = true
        state.mergeCommit = MERGE
        state.main = MERGE
        return { mergePullRequest: { pullRequest: { id: 'PR_node_430', number: PR, state: 'MERGED', merged: true, headRefOid: HEAD, mergeCommit: { oid: MERGE } } } }
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

const readyEvent = () => ({
  action: 'workflow_dispatch',
  repository: { full_name: REPOSITORY },
  sender: { login: 'whatrune' },
  inputs: { operation: 'ready', task_issue_number: String(TASK), pr_number: String(PR), exact_head: HEAD, review_id: String(REVIEW), review_kind: 'PULL_REQUEST_REVIEW' },
})

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
const reviewBody = serializeSimplifiedReviewV1(reviewInput())
equal(parseSimplifiedReviewV1(reviewBody).reviewed_head, HEAD)
equal(serializeSimplifiedReviewV1(parseSimplifiedReviewV1(reviewBody)), reviewBody)
const decisionBody = serializeSimplifiedMergeDecisionV1(decisionInput())
equal(parseSimplifiedMergeDecisionV1(decisionBody).exact_head, HEAD)
equal(serializeSimplifiedMergeDecisionV1(parseSimplifiedMergeDecisionV1(decisionBody)), decisionBody)
throws(() => parseSimplifiedTaskAuthorityV1('# placeholder'), /task_authority_invalid/)
throws(() => parseSimplifiedReviewV1(reviewBody.replace('"decision": "APPROVE"', '"decision": "CHANGES_REQUIRED"')), /review_invalid/)
throws(() => parseSimplifiedMergeDecisionV1(`${decisionBody}\n\`\`\`json\n{}\n\`\`\``), /merge_decision_invalid/)

equal(evaluateRequiredChecksV1({ checks: [check('build-preview', 15368), check('Cloudflare Pages', 85455)], paths: PATHS, exactHead: HEAD }).length, 2)
throws(() => evaluateRequiredChecksV1({ checks: [check('build-preview', 15368)], paths: PATHS, exactHead: HEAD }), /required_check_missing:Cloudflare Pages/)
throws(() => evaluateRequiredChecksV1({ checks: [check('build-preview', 15368, { conclusion: 'FAILURE' }), check('Cloudflare Pages', 85455)], paths: PATHS, exactHead: HEAD }), /required_check_not_successful:build-preview/)
const researchPaths = ['research/sd-prompt-research/example.json']
equal(evaluateRequiredChecksV1({ checks: [check('build-preview', 15368), check('Cloudflare Pages', 85455), check('validate', 15368)], paths: researchPaths, exactHead: HEAD }).length, 3)

{
  const fixture = createFixture()
  const result = await executeSimplifiedMergeV1({ event: mergeEvent(), host: fixture.host })
  equal(result.state, 'COMPLETED')
  equal(result.reason, 'merge_completed')
  equal(result.mutation_count, 1)
  equal(fixture.state.mergeMutations, 1)
  equal(result.merge_commit, MERGE)
}
{
  const fixture = createFixture({ reviewHead: BASE })
  const result = await executeSimplifiedMergeV1({ event: mergeEvent(), host: fixture.host })
  equal(result.reason, 'live_binding_invalid')
  equal(fixture.state.mergeMutations, 0)
}
{
  const fixture = createFixture({ checks: [check('build-preview', 15368), check('Cloudflare Pages', 85455, { status: 'IN_PROGRESS', conclusion: null })] })
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
  const result = await executeSimplifiedReadyV1({ event: readyEvent(), host: fixture.host })
  equal(result.state, 'COMPLETED')
  equal(result.mutation_count, 1)
  equal(fixture.state.readyMutations, 1)
  equal(fixture.state.draft, false)
  equal(result.mutation_diagnostic, undefined)
}
{
  const host = createProductionHostV1({
    token: 'test-token',
    readyMutationToken: 'ready-test-token',
    fetchImpl: async () => new Response(JSON.stringify({
      errors: [{ type: 'FORBIDDEN', message: 'Denied by https://api.github.com/graphql?token=secret-value' }],
    }), { status: 200, headers: { 'x-github-request-id': 'REQ:PERMISSION' } }),
  })
  const error = await captureError(() => host.graphql(
    'mutation MarkSimplifiedReady { viewer { login } }',
    {},
    { diagnostic_operation: 'READY_MUTATION' },
  ))
  const diagnostic = error.mutation_diagnostic
  equal(diagnostic.phase, 'READY_MUTATION_GRAPHQL_RESPONSE')
  equal(diagnostic.request_dispatch_started, true)
  equal(diagnostic.response_received, true)
  equal(diagnostic.http_status, 200)
  equal(diagnostic.github_request_id, 'REQ:PERMISSION')
  equal(diagnostic.graphql_errors.length, 1)
  equal(diagnostic.graphql_errors[0].type, 'FORBIDDEN')
  equal(diagnostic.graphql_errors[0].message, 'Denied by [REDACTED_URL]')
  equal(Object.keys(diagnostic).join(','), 'phase,request_dispatch_started,response_received,http_status,github_request_id,graphql_errors,network_exception')
  equal(JSON.stringify(diagnostic).includes('secret-value'), false)
  equal(JSON.stringify(diagnostic).includes('api.github.com'), false)
  equal(JSON.stringify(diagnostic).includes('test-token'), false)
  equal(JSON.stringify(diagnostic).includes('Authorization'), false)

  const fixture = createFixture({ draft: true, readyError: error })
  const result = await executeSimplifiedReadyV1({ event: readyEvent(), host: fixture.host })
  equal(result.state, 'INDETERMINATE')
  equal(result.reason, 'ready_outcome_unknown')
  equal(result.outcome, 'OUTCOME_UNKNOWN')
  equal(result.mutation_count, 1)
  equal(result.mutation_diagnostic.phase, 'READY_MUTATION_GRAPHQL_RESPONSE')
  equal(fixture.state.readyMutations, 0)
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
  const host = createProductionHostV1({
    token: 'test-token',
    readyMutationToken: 'ready-test-token',
    fetchImpl: async () => new Response(JSON.stringify({
      errors: secretMessages.map(([message]) => ({ type: 'FORBIDDEN', message })),
    }), { status: 200, headers: { 'x-github-request-id': 'REQ:CREDENTIALS' } }),
  })
  const error = await captureError(() => host.graphql(
    'mutation MarkSimplifiedReady { viewer { login } }',
    {},
    { diagnostic_operation: 'READY_MUTATION' },
  ))
  const diagnostic = error.mutation_diagnostic
  equal(
    JSON.stringify(diagnostic.graphql_errors.map(({ message }) => message)),
    JSON.stringify(secretMessages.map(([, expected]) => expected)),
  )
  for (const secret of [
    'bearer-secret',
    'basic-secret',
    'cookie-secret',
    'set-cookie-secret',
    'mixed-secret',
    'whitespace-secret',
    'embedded-secret',
  ]) {
    equal(JSON.stringify(diagnostic).includes(secret), false)
  }
}
{
  const host = createProductionHostV1({
    token: 'test-token',
    readyMutationToken: 'ready-test-token',
    fetchImpl: async () => new Response(JSON.stringify({
      errors: [
        { type: 'FORBIDDEN', message: 'Denied by https://api.github.com/graphql?token=url-secret' },
        { type: 'INTERNAL', message: 'ordinary non-secret diagnostic text' },
      ],
    }), { status: 200, headers: { 'x-github-request-id': 'REQ:TEXT' } }),
  })
  const error = await captureError(() => host.graphql(
    'mutation MarkSimplifiedReady { viewer { login } }',
    {},
    { diagnostic_operation: 'READY_MUTATION' },
  ))
  const diagnostic = error.mutation_diagnostic
  equal(diagnostic.graphql_errors[0].message, 'Denied by [REDACTED_URL]')
  equal(diagnostic.graphql_errors[1].message, 'ordinary non-secret diagnostic text')
  equal(JSON.stringify(diagnostic).includes('url-secret'), false)
}
{
  const host = createProductionHostV1({
    token: 'test-token',
    readyMutationToken: 'ready-test-token',
    fetchImpl: async () => new Response(JSON.stringify({ message: 'Resource not accessible by integration' }), {
      status: 403,
      headers: { 'x-github-request-id': 'REQ:HTTP' },
    }),
  })
  const error = await captureError(() => host.graphql('mutation Ready', {}, { diagnostic_operation: 'READY_MUTATION' }))
  equal(error.mutation_diagnostic.phase, 'READY_MUTATION_HTTP_RESPONSE')
  equal(error.mutation_diagnostic.request_dispatch_started, true)
  equal(error.mutation_diagnostic.response_received, true)
  equal(error.mutation_diagnostic.http_status, 403)
  equal(error.mutation_diagnostic.github_request_id, 'REQ:HTTP')
  equal(error.mutation_diagnostic.graphql_errors.length, 0)
}
{
  const host = createProductionHostV1({
    token: 'test-token',
    readyMutationToken: 'ready-test-token',
    fetchImpl: async () => {
      const error = new TypeError('connection reset after dispatch; Authorization: Bearer transport-secret')
      error.code = 'ECONNRESET'
      throw error
    },
  })
  const error = await captureError(() => host.graphql('mutation Ready', {}, { diagnostic_operation: 'READY_MUTATION' }))
  equal(error.mutation_diagnostic.phase, 'READY_MUTATION_TRANSPORT')
  equal(error.mutation_diagnostic.request_dispatch_started, true)
  equal(error.mutation_diagnostic.response_received, false)
  equal(error.mutation_diagnostic.http_status, null)
  equal(error.mutation_diagnostic.network_exception.name, 'TypeError')
  equal(error.mutation_diagnostic.network_exception.code, 'ECONNRESET')
  equal(JSON.stringify(error.mutation_diagnostic).includes('connection reset'), false)
  equal(JSON.stringify(error.mutation_diagnostic).includes('transport-secret'), false)
}
{
  const host = createProductionHostV1({
    token: 'test-token',
    readyMutationToken: 'ready-test-token',
    fetchImpl: async () => new Response('{invalid-json', {
      status: 200,
      headers: { 'x-github-request-id': 'REQ:MALFORMED' },
    }),
  })
  const error = await captureError(() => host.graphql('mutation Ready', {}, { diagnostic_operation: 'READY_MUTATION' }))
  equal(error.mutation_diagnostic.phase, 'READY_MUTATION_RESPONSE_PARSE')
  equal(error.mutation_diagnostic.request_dispatch_started, true)
  equal(error.mutation_diagnostic.response_received, true)
  equal(error.mutation_diagnostic.http_status, 200)
  equal(error.mutation_diagnostic.github_request_id, 'REQ:MALFORMED')
  equal(error.mutation_diagnostic.graphql_errors.length, 0)
  equal(error.mutation_diagnostic.network_exception, null)
}
{
  let fetchCalls = 0
  const host = createProductionHostV1({
    token: 'github-read-token',
    fetchImpl: async () => {
      fetchCalls += 1
      throw new Error('fetch_must_not_run_without_ready_bot_token')
    },
  })
  const error = await captureError(() => host.graphql('mutation Ready', {}, { diagnostic_operation: 'READY_MUTATION' }))
  equal(error.mutation_diagnostic.phase, 'READY_MUTATION_REQUEST_PREPARE')
  equal(error.mutation_diagnostic.request_dispatch_started, false)
  equal(error.mutation_diagnostic.response_received, false)
  equal(fetchCalls, 0)
}
{
  const authorizations = []
  const host = createProductionHostV1({
    token: 'github-read-token',
    readyMutationToken: 'ready-bot-secret',
    fetchImpl: async (url, options) => {
      authorizations.push([url, options.headers.Authorization])
      if (url.endsWith('/graphql')) {
        return new Response(JSON.stringify({ data: { markPullRequestReadyForReview: { pullRequest: { isDraft: false } } } }), { status: 200 })
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    },
  })
  await host.api('repos/whatrune/sd-prompt-studio/pulls/434')
  await host.graphql('mutation Ready', {}, { diagnostic_operation: 'READY_MUTATION' })
  await host.api('repos/whatrune/sd-prompt-studio/pulls/434')
  await host.graphql('mutation Merge', {}, { diagnostic_operation: 'MERGE_MUTATION' })
  equal(authorizations[0][1], 'Bearer github-read-token')
  equal(authorizations[1][1], 'Bearer ready-bot-secret')
  equal(authorizations[2][1], 'Bearer github-read-token')
  equal(authorizations[3][1], 'Bearer github-read-token')
  equal(JSON.stringify(authorizations).includes('ready-bot-secret'), true)
}
{
  const environment = { READY_BOT_TOKEN: 'ready-bot-secret', GH_TOKEN: 'github-read-token' }
  equal(takeReadyMutationTokenV1(environment), 'ready-bot-secret')
  equal(Object.hasOwn(environment, 'READY_BOT_TOKEN'), false)
  equal(environment.GH_TOKEN, 'github-read-token')
  equal(takeReadyMutationTokenV1(environment), null)
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
  const fixture = createFixture({ draft: false })
  const result = await executeSimplifiedReadyV1({ event: readyEvent(), host: fixture.host })
  equal(result.reason, 'live_binding_invalid')
  equal(fixture.state.readyMutations, 0)
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
ok(workflow.includes('simplified_protected_transition_v1:'))
ok(workflow.includes('persist-credentials: false'))
ok(workflow.includes('github.workflow_sha'))
ok(workflow.includes("READY_BOT_TOKEN: ${{ github.event_name == 'workflow_dispatch' && secrets.READY_BOT_TOKEN || '' }}"))
equal((workflow.match(/READY_BOT_TOKEN:/g) ?? []).length, 1)
equal((workflow.match(/GH_TOKEN: \$\{\{ github\.token \}\}/g) ?? []).length, 1)
equal((workflow.match(/^    runs-on:/gm) ?? []).length, 1)
for (const retired of ['ready_transition_required_resume', 'minimal_governance', 'terminal_observation', 'protected_transition_task_state']) {
  equal(workflow.includes(retired), false)
}

process.stdout.write(`simplified protected-transition checks passed (${assertions} assertions)\n`)
