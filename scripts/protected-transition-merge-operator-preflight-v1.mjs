const FULL_SHA = /^[0-9a-f]{40}$/
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/
const PRODUCT_OWNER_LOGIN = 'whatrune'
const REVIEWER_ASSOCIATIONS = new Set(['OWNER', 'MEMBER', 'COLLABORATOR'])
const PAGE_SIZE = 100
const MAX_PAGES = 32

const TASK_RECORD = 'simplified_task_authority_v1'
const REVIEW_RECORD = 'simplified_independent_review_v1'
const MERGE_RECORD = 'simplified_merge_decision_v1'

const TASK_FIELDS = Object.freeze([
  'record_type', 'task_issue', 'repository', 'objective', 'authorized_paths', 'ready_allowed', 'product_owner_login',
])
const REVIEW_FIELDS = Object.freeze([
  'record_type', 'reviewer_role', 'task_issue', 'pull_request', 'reviewed_head', 'decision',
  'blocking', 'remaining', 'unknown',
])
const MERGE_FIELDS = Object.freeze([
  'record_type', 'task_issue', 'pull_request', 'exact_head', 'expected_base',
  'authorized_paths', 'review_kind', 'review_id', 'review_url', 'merge_method', 'operation_count',
])

const CHECK_CATALOG = Object.freeze({
  'build-preview': Object.freeze({ name: 'build-preview', appDatabaseId: '15368' }),
  'Cloudflare Pages': Object.freeze({ name: 'Cloudflare Pages', appDatabaseId: '85455' }),
  validate: Object.freeze({ name: 'validate', appDatabaseId: '15368' }),
})

const CHECKS_QUERY = `
query SimplifiedChecks($owner: String!, $name: String!, $head: GitObjectID!, $after: String) {
  repository(owner: $owner, name: $name) {
    object(oid: $head) {
      ... on Commit {
        oid
        statusCheckRollup {
          contexts(first: 100, after: $after) {
            nodes {
              __typename
              ... on CheckRun {
                id
                name
                status
                conclusion
                detailsUrl
                startedAt
                checkSuite { commit { oid } app { databaseId } }
              }
            }
            pageInfo { hasNextPage endCursor }
          }
        }
      }
    }
  }
}`

const THREADS_QUERY = `
query SimplifiedThreads($owner: String!, $name: String!, $pr: Int!, $after: String) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $pr) {
      number
      state
      isDraft
      merged
      headRefOid
      mergeable
      mergeStateStatus
      reviewThreads(first: 100, after: $after) {
        nodes { id isResolved isOutdated }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
}`

const READY_MUTATION = `
mutation MarkSimplifiedReady($pullRequestId: ID!) {
  markPullRequestReadyForReview(input: { pullRequestId: $pullRequestId }) {
    pullRequest { id number state isDraft merged headRefOid }
  }
}`

const MERGE_MUTATION = `
mutation MergeSimplifiedPullRequest($pullRequestId: ID!, $expectedHeadOid: GitObjectID!) {
  mergePullRequest(input: {
    pullRequestId: $pullRequestId,
    expectedHeadOid: $expectedHeadOid,
    mergeMethod: MERGE
  }) {
    pullRequest { id number state merged headRefOid mergeCommit { oid } }
  }
}`

const exactKeys = (value, expected) => (
  value !== null && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).sort().join('\n') === [...expected].sort().join('\n')
)

const positiveInteger = (value) => Number.isSafeInteger(value) && value > 0

const normalizedPath = (value) => (
  typeof value === 'string' && value.length > 0 && value.length <= 512 &&
  !value.includes('\\') && !value.startsWith('/') && !value.endsWith('/') &&
  !value.split('/').some((part) => part.length === 0 || part === '.' || part === '..')
)

const normalizedPaths = (value, reason) => {
  if (
    !Array.isArray(value) || value.length === 0 || value.length > 3000 ||
    value.some((path) => !normalizedPath(path)) || new Set(value).size !== value.length
  ) throw new Error(reason)
  return Object.freeze([...value].sort())
}

const samePaths = (left, right) => (
  Array.isArray(left) && Array.isArray(right) &&
  [...left].sort().join('\n') === [...right].sort().join('\n')
)

const parseRecordBody = (body, recordType, fields, reason) => {
  if (typeof body !== 'string' || body.length === 0 || body.length > 65_536) throw new Error(reason)
  const blocks = [...body.matchAll(/```json\r?\n([\s\S]*?)\r?\n```/g)]
  if (blocks.length !== 1) throw new Error(reason)
  let value
  try {
    value = JSON.parse(blocks[0][1])
  } catch {
    throw new Error(reason)
  }
  if (!exactKeys(value, fields) || value.record_type !== recordType) throw new Error(reason)
  return value
}

const serializeRecordBody = (heading, value) => `${heading}\n\n\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\`\n`

export const serializeSimplifiedTaskAuthorityV1 = (input) => {
  if (!exactKeys(input, TASK_FIELDS)) throw new Error('task_authority_invalid')
  const value = parseSimplifiedTaskAuthorityV1(serializeRecordBody('# Simplified Lifecycle Task Authority', input))
  return serializeRecordBody('# Simplified Lifecycle Task Authority', value)
}

export const parseSimplifiedTaskAuthorityV1 = (body) => {
  const value = parseRecordBody(body, TASK_RECORD, TASK_FIELDS, 'task_authority_invalid')
  if (
    !positiveInteger(value.task_issue) || !REPOSITORY.test(value.repository ?? '') ||
    typeof value.objective !== 'string' || value.objective.length === 0 ||
    value.objective.length > 512 || typeof value.ready_allowed !== 'boolean' ||
    value.product_owner_login !== PRODUCT_OWNER_LOGIN
  ) throw new Error('task_authority_invalid')
  return Object.freeze({ ...value, authorized_paths: normalizedPaths(value.authorized_paths, 'task_authority_invalid') })
}

export const serializeSimplifiedReviewV1 = (input) => {
  if (!exactKeys(input, REVIEW_FIELDS)) throw new Error('review_invalid')
  const value = parseSimplifiedReviewV1(serializeRecordBody('# Simplified Lifecycle Independent Review', input))
  return serializeRecordBody('# Simplified Lifecycle Independent Review', value)
}

export const parseSimplifiedReviewV1 = (body) => {
  const value = parseRecordBody(body, REVIEW_RECORD, REVIEW_FIELDS, 'review_invalid')
  if (
    !positiveInteger(value.task_issue) || !positiveInteger(value.pull_request) ||
    value.reviewer_role !== 'INDEPENDENT_REVIEWER' ||
    !FULL_SHA.test(value.reviewed_head ?? '') || value.decision !== 'APPROVE' ||
    !Number.isSafeInteger(value.blocking) || value.blocking !== 0 ||
    !Number.isSafeInteger(value.remaining) || value.remaining !== 0 ||
    !Number.isSafeInteger(value.unknown) || value.unknown !== 0
  ) throw new Error('review_invalid')
  return Object.freeze({ ...value })
}

export const serializeSimplifiedMergeDecisionV1 = (input) => {
  if (!exactKeys(input, MERGE_FIELDS)) throw new Error('merge_decision_invalid')
  const value = parseSimplifiedMergeDecisionV1(serializeRecordBody('# Product Owner Simplified Merge Decision', input))
  return serializeRecordBody('# Product Owner Simplified Merge Decision', value)
}

export const parseSimplifiedMergeDecisionV1 = (body) => {
  const value = parseRecordBody(body, MERGE_RECORD, MERGE_FIELDS, 'merge_decision_invalid')
  if (
    !positiveInteger(value.task_issue) || !positiveInteger(value.pull_request) ||
    !FULL_SHA.test(value.exact_head ?? '') || !FULL_SHA.test(value.expected_base ?? '') ||
    !['PULL_REQUEST_REVIEW', 'TASK_ISSUE_COMMENT'].includes(value.review_kind) ||
    !positiveInteger(value.review_id) || typeof value.review_url !== 'string' ||
    value.review_url.length === 0 || value.review_url.length > 1024 ||
    value.merge_method !== 'merge' || value.operation_count !== 1
  ) throw new Error('merge_decision_invalid')
  return Object.freeze({ ...value, authorized_paths: normalizedPaths(value.authorized_paths, 'merge_decision_invalid') })
}

export const requiredCheckCatalogForPathsV1 = (paths) => {
  paths = normalizedPaths(paths, 'changed_path_scope_invalid')
  const names = ['build-preview', 'Cloudflare Pages']
  if (paths.some((path) => path.startsWith('research/sd-prompt-research/'))) names.push('validate')
  return Object.freeze(names.map((name) => CHECK_CATALOG[name]))
}

const repositoryParts = (repository) => {
  if (!REPOSITORY.test(repository ?? '')) throw new Error('repository_invalid')
  return repository.split('/')
}

const acquireFiles = async ({ repository, prNumber, host }) => {
  const paths = []
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const nodes = await host.api(`repos/${repository}/pulls/${prNumber}/files?per_page=${PAGE_SIZE}&page=${page}`)
    if (!Array.isArray(nodes)) throw new Error('changed_path_acquisition_failed')
    for (const node of nodes) {
      if (!normalizedPath(node?.filename)) throw new Error('changed_path_acquisition_failed')
      paths.push(node.filename)
    }
    if (nodes.length < PAGE_SIZE) return normalizedPaths(paths, 'changed_path_acquisition_failed')
  }
  throw new Error('changed_path_pagination_incomplete')
}

const acquireChecks = async ({ repository, exactHead, host }) => {
  const [owner, name] = repositoryParts(repository)
  const checks = []
  let after = null
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const data = await host.graphql(CHECKS_QUERY, { owner, name, head: exactHead, after })
    const commit = data?.repository?.object
    const connection = commit?.statusCheckRollup?.contexts
    if (
      commit?.oid !== exactHead || !connection || !Array.isArray(connection.nodes) ||
      typeof connection.pageInfo?.hasNextPage !== 'boolean'
    ) throw new Error('checks_acquisition_failed')
    checks.push(...connection.nodes.filter((node) => node?.__typename === 'CheckRun'))
    if (!connection.pageInfo.hasNextPage) return Object.freeze(checks)
    if (typeof connection.pageInfo.endCursor !== 'string' || connection.pageInfo.endCursor.length === 0) {
      throw new Error('checks_pagination_incomplete')
    }
    after = connection.pageInfo.endCursor
  }
  throw new Error('checks_pagination_incomplete')
}

const acquireThreads = async ({ repository, prNumber, exactHead, host }) => {
  const [owner, name] = repositoryParts(repository)
  const threads = []
  let after = null
  let pull = null
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const data = await host.graphql(THREADS_QUERY, { owner, name, pr: prNumber, after })
    pull = data?.repository?.pullRequest
    const connection = pull?.reviewThreads
    if (
      pull?.number !== prNumber || pull.headRefOid !== exactHead || !connection ||
      !Array.isArray(connection.nodes) || typeof connection.pageInfo?.hasNextPage !== 'boolean'
    ) throw new Error('review_threads_acquisition_failed')
    for (const thread of connection.nodes) {
      if (
        typeof thread?.id !== 'string' || typeof thread.isResolved !== 'boolean' ||
        typeof thread.isOutdated !== 'boolean'
      ) throw new Error('review_threads_acquisition_failed')
      threads.push(Object.freeze({ id: thread.id, isResolved: thread.isResolved, isOutdated: thread.isOutdated }))
    }
    if (!connection.pageInfo.hasNextPage) return Object.freeze({ pull: Object.freeze({ ...pull, reviewThreads: undefined }), threads: Object.freeze(threads) })
    if (typeof connection.pageInfo.endCursor !== 'string' || connection.pageInfo.endCursor.length === 0) {
      throw new Error('review_threads_pagination_incomplete')
    }
    after = connection.pageInfo.endCursor
  }
  throw new Error('review_threads_pagination_incomplete')
}

export const evaluateRequiredChecksV1 = ({ checks, paths, exactHead }) => {
  if (!Array.isArray(checks) || !FULL_SHA.test(exactHead ?? '')) throw new Error('checks_invalid')
  const required = requiredCheckCatalogForPathsV1(paths)
  const result = []
  for (const expected of required) {
    const candidates = checks.filter((check) => (
      check?.name === expected.name && String(check?.checkSuite?.app?.databaseId ?? '') === expected.appDatabaseId &&
      check?.checkSuite?.commit?.oid === exactHead
    ))
    if (candidates.length === 0) throw new Error(`required_check_missing:${expected.name}`)
    const ranked = candidates.map((check) => ({ check, time: Date.parse(check.startedAt ?? '') }))
    if (ranked.some((item) => !Number.isFinite(item.time))) throw new Error(`required_check_identity_invalid:${expected.name}`)
    const latestTime = Math.max(...ranked.map((item) => item.time))
    const latest = ranked.filter((item) => item.time === latestTime)
    if (latest.length !== 1) throw new Error(`required_check_identity_ambiguous:${expected.name}`)
    const check = latest[0].check
    if (check.status !== 'COMPLETED' || check.conclusion !== 'SUCCESS') {
      throw new Error(`required_check_not_successful:${expected.name}`)
    }
    result.push(Object.freeze({ name: expected.name, id: check.id, details_url: check.detailsUrl }))
  }
  return Object.freeze(result)
}

const acquireLiveSnapshot = async ({
  repository, taskIssue, prNumber, exactHead, expectedBase, authorizedPaths,
  reviewId, reviewUrl = null, expectedDraft, host,
  reviewKind = 'PULL_REQUEST_REVIEW',
}) => {
  if (
    !REPOSITORY.test(repository ?? '') || !positiveInteger(taskIssue) || !positiveInteger(prNumber) ||
    !FULL_SHA.test(exactHead ?? '') || !FULL_SHA.test(expectedBase ?? '') || !positiveInteger(reviewId) ||
    typeof expectedDraft !== 'boolean'
  ) throw new Error('live_snapshot_request_invalid')
  authorizedPaths = normalizedPaths(authorizedPaths, 'authorized_scope_invalid')

  const reviewRoute = reviewKind === 'PULL_REQUEST_REVIEW'
    ? `repos/${repository}/pulls/${prNumber}/reviews/${reviewId}`
    : reviewKind === 'TASK_ISSUE_COMMENT'
      ? `repos/${repository}/issues/comments/${reviewId}`
      : null
  if (reviewRoute === null) throw new Error('review_kind_invalid')

  const [task, pull, review, mainRef, files, checks, threadSnapshot] = await Promise.all([
    host.api(`repos/${repository}/issues/${taskIssue}`),
    host.api(`repos/${repository}/pulls/${prNumber}`),
    host.api(reviewRoute),
    host.api(`repos/${repository}/git/ref/heads/main`),
    acquireFiles({ repository, prNumber, host }),
    acquireChecks({ repository, exactHead, host }),
    acquireThreads({ repository, prNumber, exactHead, host }),
  ])

  const taskAuthority = parseSimplifiedTaskAuthorityV1(task?.body)
  const parsedReview = parseSimplifiedReviewV1(review?.body)
  const reviewExpectedUrl = reviewKind === 'PULL_REQUEST_REVIEW'
    ? `https://github.com/${repository}/pull/${prNumber}#pullrequestreview-${reviewId}`
    : `https://github.com/${repository}/issues/${taskIssue}#issuecomment-${reviewId}`
  const reviewIdentityValid = reviewKind === 'PULL_REQUEST_REVIEW'
    ? review?.id === reviewId && review?.state === 'APPROVED' && review?.commit_id === exactHead &&
      REVIEWER_ASSOCIATIONS.has(review?.author_association) && review?.user?.login !== pull?.user?.login
    : review?.id === reviewId && review?.issue_url === `https://api.github.com/repos/${repository}/issues/${taskIssue}` &&
      REVIEWER_ASSOCIATIONS.has(review?.author_association)
  if (
    task?.number !== taskIssue || taskAuthority.task_issue !== taskIssue ||
    task?.state !== 'open' || task?.pull_request !== undefined ||
    task?.user?.login !== taskAuthority.product_owner_login || taskAuthority.repository !== repository ||
    typeof pull?.node_id !== 'string' || pull.node_id.length === 0 ||
    pull?.number !== prNumber || pull?.state !== 'open' || pull?.merged !== false ||
    pull?.draft !== expectedDraft || pull?.head?.sha !== exactHead || pull?.head?.repo?.full_name !== repository ||
    pull?.base?.ref !== 'main' || pull?.base?.repo?.full_name !== repository ||
    mainRef?.ref !== 'refs/heads/main' || mainRef?.object?.sha !== expectedBase ||
    !reviewIdentityValid || review?.html_url !== reviewExpectedUrl ||
    (reviewUrl !== null && reviewUrl !== reviewExpectedUrl) || parsedReview.task_issue !== taskIssue ||
    parsedReview.pull_request !== prNumber || parsedReview.reviewed_head !== exactHead ||
    !samePaths(taskAuthority.authorized_paths, authorizedPaths) || !samePaths(files, authorizedPaths)
  ) throw new Error('live_binding_invalid')

  const requiredChecks = evaluateRequiredChecksV1({ checks, paths: files, exactHead })
  const livePull = threadSnapshot.pull
  if (
    livePull.state !== 'OPEN' || livePull.isDraft !== expectedDraft || livePull.merged !== false ||
    livePull.headRefOid !== exactHead || livePull.mergeable !== 'MERGEABLE' || livePull.mergeStateStatus !== 'CLEAN'
  ) throw new Error('mergeability_invalid')
  if (threadSnapshot.threads.some((thread) => !thread.isResolved && !thread.isOutdated)) {
    throw new Error('blocking_review_threads_present')
  }

  return Object.freeze({
    repository,
    task_issue: taskIssue,
    pr_number: prNumber,
    pull_id: pull.node_id,
    exact_head: exactHead,
    expected_base: expectedBase,
    authorized_paths: authorizedPaths,
    review_id: reviewId,
    review_kind: reviewKind,
    review_url: reviewExpectedUrl,
    review_actor: review.user.login,
    required_checks: requiredChecks,
    thread_ids: Object.freeze(threadSnapshot.threads.map((thread) => thread.id).sort()),
    mergeable: livePull.mergeable,
    merge_state_status: livePull.mergeStateStatus,
    draft: expectedDraft,
    ready_allowed: taskAuthority.ready_allowed,
  })
}

const stopped = (operation, reason, mutationCount = 0, outcome = 'DEFINITIVE_REJECTION') => Object.freeze({
  operation,
  state: mutationCount === 0 ? 'STOPPED' : 'INDETERMINATE',
  reason,
  outcome,
  mutation_count: mutationCount,
  exit_code: 1,
})

export const executeSimplifiedReadyV1 = async ({ event, host }) => {
  const operation = 'READY'
  try {
    const inputs = event?.inputs
    const repository = event?.repository?.full_name
    const taskIssue = Number(inputs?.task_issue_number)
    const prNumber = Number(inputs?.pr_number)
    const reviewId = Number(inputs?.review_id)
    const exactHead = inputs?.exact_head
    if (
      event?.action !== 'workflow_dispatch' || inputs?.operation !== 'ready' ||
      event?.sender?.login !== PRODUCT_OWNER_LOGIN || !REPOSITORY.test(repository ?? '') ||
      !positiveInteger(taskIssue) || !positiveInteger(prNumber) || !positiveInteger(reviewId) ||
      !FULL_SHA.test(exactHead ?? '')
    ) throw new Error('ready_admission_invalid')

    const task = await host.api(`repos/${repository}/issues/${taskIssue}`)
    const authority = parseSimplifiedTaskAuthorityV1(task?.body)
    const mainRef = await host.api(`repos/${repository}/git/ref/heads/main`)
    const expectedBase = mainRef?.object?.sha
    if (!FULL_SHA.test(expectedBase ?? '') || authority.ready_allowed !== true) throw new Error('ready_not_authorized')

    const initial = await acquireLiveSnapshot({
      repository, taskIssue, prNumber, exactHead, expectedBase,
      authorizedPaths: authority.authorized_paths, reviewId, expectedDraft: true, host,
      reviewKind: inputs?.review_kind,
    })
    const final = await acquireLiveSnapshot({
      repository, taskIssue, prNumber, exactHead, expectedBase,
      authorizedPaths: authority.authorized_paths, reviewId, expectedDraft: true, host,
      reviewKind: inputs?.review_kind,
    })
    if (JSON.stringify(initial) !== JSON.stringify(final)) throw new Error('ready_final_drift')

    const mutationCount = 1
    let mutation
    try {
      mutation = await host.graphql(READY_MUTATION, { pullRequestId: initial.pull_id })
    } catch {
      return stopped(operation, 'ready_outcome_unknown', mutationCount, 'OUTCOME_UNKNOWN')
    }
    const changed = mutation?.markPullRequestReadyForReview?.pullRequest
    if (
      changed?.id !== initial.pull_id || changed?.number !== prNumber || changed?.state !== 'OPEN' ||
      changed?.isDraft !== false || changed?.merged !== false || changed?.headRefOid !== exactHead
    ) return stopped(operation, 'ready_after_state_invalid', mutationCount, 'OUTCOME_UNKNOWN')

    const after = await host.api(`repos/${repository}/pulls/${prNumber}`)
    if (
      after?.state !== 'open' || after?.draft !== false || after?.merged !== false ||
      after?.head?.sha !== exactHead
    ) return stopped(operation, 'ready_after_refetch_invalid', mutationCount, 'OUTCOME_UNKNOWN')

    return Object.freeze({
      operation, state: 'COMPLETED', reason: 'ready_completed', outcome: 'MUTATION_CONFIRMED',
      mutation_count: mutationCount, exit_code: 0, repository, task_issue: taskIssue,
      pr_number: prNumber, exact_head: exactHead,
    })
  } catch (error) {
    return stopped(operation, error instanceof Error ? error.message : 'ready_failed')
  }
}

export const executeSimplifiedMergeV1 = async ({ event, host }) => {
  const operation = 'MERGE'
  try {
    const repository = event?.repository?.full_name
    const taskIssue = event?.issue?.number
    const body = event?.comment?.body
    if (
      event?.action !== 'created' || !REPOSITORY.test(repository ?? '') || !positiveInteger(taskIssue)
    ) throw new Error('merge_admission_invalid')
    if (typeof body !== 'string' || !body.includes(MERGE_RECORD)) {
      return Object.freeze({ operation: 'NONE', state: 'NOT_APPLICABLE', reason: 'comment_not_merge_decision', mutation_count: 0, exit_code: 0 })
    }
    if (event?.issue?.pull_request !== undefined || event?.comment?.user?.login !== PRODUCT_OWNER_LOGIN) {
      throw new Error('merge_admission_invalid')
    }
    const decision = parseSimplifiedMergeDecisionV1(body)
    if (decision.task_issue !== taskIssue) throw new Error('merge_task_binding_invalid')

    const initial = await acquireLiveSnapshot({
      repository,
      taskIssue,
      prNumber: decision.pull_request,
      exactHead: decision.exact_head,
      expectedBase: decision.expected_base,
      authorizedPaths: decision.authorized_paths,
      reviewId: decision.review_id,
      reviewUrl: decision.review_url,
      reviewKind: decision.review_kind,
      expectedDraft: false,
      host,
    })
    const final = await acquireLiveSnapshot({
      repository,
      taskIssue,
      prNumber: decision.pull_request,
      exactHead: decision.exact_head,
      expectedBase: decision.expected_base,
      authorizedPaths: decision.authorized_paths,
      reviewId: decision.review_id,
      reviewUrl: decision.review_url,
      reviewKind: decision.review_kind,
      expectedDraft: false,
      host,
    })
    if (JSON.stringify(initial) !== JSON.stringify(final)) throw new Error('merge_final_drift')

    const mutationCount = 1
    let mutation
    try {
      mutation = await host.graphql(MERGE_MUTATION, {
        pullRequestId: initial.pull_id,
        expectedHeadOid: decision.exact_head,
      })
    } catch {
      return stopped(operation, 'merge_outcome_unknown', mutationCount, 'OUTCOME_UNKNOWN')
    }
    const merged = mutation?.mergePullRequest?.pullRequest
    if (
      merged?.id !== initial.pull_id || merged?.number !== decision.pull_request || merged?.state !== 'MERGED' ||
      merged?.merged !== true || merged?.headRefOid !== decision.exact_head || !FULL_SHA.test(merged?.mergeCommit?.oid ?? '')
    ) return stopped(operation, 'merge_after_state_invalid', mutationCount, 'OUTCOME_UNKNOWN')

    const [afterPull, afterMain, commit] = await Promise.all([
      host.api(`repos/${repository}/pulls/${decision.pull_request}`),
      host.api(`repos/${repository}/git/ref/heads/main`),
      host.api(`repos/${repository}/git/commits/${merged.mergeCommit.oid}`),
    ])
    const parents = Array.isArray(commit?.parents) ? commit.parents.map((parent) => parent?.sha) : []
    if (
      afterPull?.state !== 'closed' || afterPull?.merged !== true || afterPull?.head?.sha !== decision.exact_head ||
      afterPull?.merge_commit_sha !== merged.mergeCommit.oid || afterMain?.object?.sha !== merged.mergeCommit.oid ||
      parents.length !== 2 || !parents.includes(decision.expected_base) || !parents.includes(decision.exact_head)
    ) return stopped(operation, 'merge_after_refetch_invalid', mutationCount, 'OUTCOME_UNKNOWN')

    return Object.freeze({
      operation, state: 'COMPLETED', reason: 'merge_completed', outcome: 'MUTATION_CONFIRMED',
      mutation_count: mutationCount, exit_code: 0, repository, task_issue: taskIssue,
      pr_number: decision.pull_request, exact_head: decision.exact_head,
      previous_main: decision.expected_base, merge_commit: merged.mergeCommit.oid,
      new_main: afterMain.object.sha, merged_paths: initial.authorized_paths,
    })
  } catch (error) {
    return stopped(operation, error instanceof Error ? error.message : 'merge_failed')
  }
}

export const projectMergeOperatorWorkflowResultV1 = ({ plan, expectedHead }) => {
  if (plan?.operation === 'NONE') return Object.freeze({ operation: 'NONE' })
  if (
    plan?.operation !== 'MERGE' || plan?.state !== 'COMPLETED' || plan?.outcome !== 'MUTATION_CONFIRMED' ||
    plan?.mutation_count !== 1 || plan?.exact_head !== expectedHead
  ) throw new Error('merge_operator_plan_invalid')
  return Object.freeze({
    operation: 'MERGE',
    pr_number: plan.pr_number,
    exact_head: plan.exact_head,
    merge_commit: plan.merge_commit,
  })
}
