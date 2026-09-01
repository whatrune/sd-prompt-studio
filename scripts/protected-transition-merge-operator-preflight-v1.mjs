import { readFileSync } from 'node:fs'

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
const PRE_DECISION_FIELDS = Object.freeze([
  'repository', 'task_issue', 'pull_request', 'exact_head', 'expected_base',
  'authorized_paths', 'review_kind', 'review_id', 'review_url',
])
const REVIEW_PUBLICATION_PREFLIGHT_FIELDS = Object.freeze([
  'repository', 'task_issue', 'pull_request', 'exact_head', 'expected_base',
  'authorized_paths',
])

const CHECK_CATALOG = Object.freeze({
  'build-preview': Object.freeze({ name: 'build-preview', appDatabaseId: '15368' }),
  'Cloudflare Pages': Object.freeze({ name: 'Cloudflare Pages', appDatabaseId: '85455' }),
  validate: Object.freeze({ name: 'validate', appDatabaseId: '15368' }),
})

const VALIDATION_PROFILE_NAMES = Object.freeze([
  'RESEARCH_EXPERIMENT', 'CONCEPT_GRAPH', 'FULL_RESEARCH', 'PRODUCTION_ADVISORY',
  'PROMPT_DATA', 'APPLICATION', 'PLATFORM', 'DOCUMENTATION',
])

const loadValidationCatalogV1 = () => {
  let value
  try {
    value = JSON.parse(readFileSync(new URL('../data/validation-path-ownership-v1.json', import.meta.url), 'utf8'))
  } catch {
    throw new Error('validation_catalog_invalid')
  }
  if (
    !exactKeys(value, ['catalog_id', 'catalog_version', 'full_profile', 'profiles', 'force_full', 'ownership']) ||
    value.catalog_id !== 'validation_path_ownership_v1' || value.catalog_version !== 1 ||
    value.full_profile !== 'FULL_RESEARCH' || !exactKeys(value.profiles, VALIDATION_PROFILE_NAMES) ||
    !exactKeys(value.force_full, ['exact', 'prefixes']) || !Array.isArray(value.ownership)
  ) throw new Error('validation_catalog_invalid')
  const validPathList = (paths, prefixes = false) => (
    Array.isArray(paths) && new Set(paths).size === paths.length && paths.every((path) => (
      normalizedPath(path) || (prefixes && typeof path === 'string' && path.endsWith('/') && normalizedPath(path.slice(0, -1)))
    ))
  )
  if (!validPathList(value.force_full.exact) || !validPathList(value.force_full.prefixes, true)) {
    throw new Error('validation_catalog_invalid')
  }
  for (const profile of VALIDATION_PROFILE_NAMES) {
    if (
      !exactKeys(value.profiles[profile], ['runtime_deployable', 'bundles']) ||
      typeof value.profiles[profile].runtime_deployable !== 'boolean' ||
      !Array.isArray(value.profiles[profile].bundles)
    ) throw new Error('validation_catalog_invalid')
  }
  for (const rule of value.ownership) {
    if (
      !exactKeys(rule, ['profile', 'exact', 'prefixes']) || !VALIDATION_PROFILE_NAMES.includes(rule.profile) ||
      rule.profile === value.full_profile || !validPathList(rule.exact) || !validPathList(rule.prefixes, true)
    ) throw new Error('validation_catalog_invalid')
  }
  return Object.freeze(value)
}

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

const exactKeys = (value, expected) => (
  value !== null && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).sort().join('\n') === [...expected].sort().join('\n')
)

const positiveInteger = (value) => Number.isSafeInteger(value) && value > 0

const normalizedPath = (value) => (
  typeof value === 'string' && value.length > 0 && value.length <= 512 &&
  !value.includes('\\') && !/[\u0000-\u001f\u007f]/.test(value) &&
  !/^[A-Za-z]:/.test(value) && !value.startsWith('/') && !value.endsWith('/') &&
  !value.split('/').some((part) => part.length === 0 || part === '.' || part === '..')
)

const VALIDATION_CATALOG = loadValidationCatalogV1()

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

const taskAuthorityBindingModeV1 = (options) => {
  const mode = options?.binding_mode ?? 'BOUND_FINAL'
  if (!['UNBOUND_CREATE', 'BOUND_FINAL'].includes(mode)) throw new Error('task_authority_invalid')
  return mode
}

export const serializeSimplifiedTaskAuthorityV1 = (input, options = {}) => {
  if (!exactKeys(input, TASK_FIELDS)) throw new Error('task_authority_invalid')
  const value = parseSimplifiedTaskAuthorityV1(
    serializeRecordBody('# Simplified Lifecycle Task Authority', input),
    options,
  )
  return serializeRecordBody('# Simplified Lifecycle Task Authority', value)
}

export const parseSimplifiedTaskAuthorityV1 = (body, options = {}) => {
  const bindingMode = taskAuthorityBindingModeV1(options)
  const value = parseRecordBody(body, TASK_RECORD, TASK_FIELDS, 'task_authority_invalid')
  if (
    (bindingMode === 'UNBOUND_CREATE' ? value.task_issue !== 0 : !positiveInteger(value.task_issue)) ||
    !REPOSITORY.test(value.repository ?? '') ||
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

export const classifyValidationPathsV1 = (paths) => {
  const full = (reason) => Object.freeze({ profile: VALIDATION_CATALOG.full_profile, fallback_reason: reason })
  if (!Array.isArray(paths) || paths.length === 0) return full('empty_changed_path_set')
  if (paths.some((path) => !normalizedPath(path))) return full('malformed_changed_path')
  if (new Set(paths).size !== paths.length) return full('duplicate_changed_path')
  const classes = []
  for (const path of [...paths].sort()) {
    if (
      VALIDATION_CATALOG.force_full.exact.includes(path) ||
      VALIDATION_CATALOG.force_full.prefixes.some((prefix) => path.startsWith(prefix))
    ) return full(`control_plane_path:${path}`)
    const exact = new Set(VALIDATION_CATALOG.ownership.filter((rule) => rule.exact.includes(path)).map((rule) => rule.profile))
    if (exact.size > 1) return full(`ambiguous_exact_owner:${path}`)
    if (exact.size === 1) {
      classes.push([...exact][0])
      continue
    }
    const prefixMatches = VALIDATION_CATALOG.ownership.flatMap((rule) => (
      rule.prefixes.filter((prefix) => path.startsWith(prefix)).map((prefix) => ({ length: prefix.length, profile: rule.profile }))
    ))
    if (prefixMatches.length === 0) return full(`unknown_path:${path}`)
    const longest = Math.max(...prefixMatches.map((match) => match.length))
    const profiles = new Set(prefixMatches.filter((match) => match.length === longest).map((match) => match.profile))
    if (profiles.size !== 1) return full(`ambiguous_prefix_owner:${path}`)
    classes.push([...profiles][0])
  }
  if (new Set(classes).size !== 1) return full('mixed_ownership_classes')
  return Object.freeze({ profile: classes[0], fallback_reason: null })
}

export const requiredCheckCatalogForPathsV1 = (paths) => {
  const selection = classifyValidationPathsV1(paths)
  const names = ['validate']
  if (VALIDATION_CATALOG.profiles[selection.profile].runtime_deployable) {
    names.push('build-preview', 'Cloudflare Pages')
  }
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
      if (node?.status === 'renamed') {
        if (!normalizedPath(node?.previous_filename)) throw new Error('changed_path_acquisition_failed')
        paths.push(node.previous_filename)
      }
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
  reviewId, reviewUrl = null, host,
  reviewKind = 'PULL_REQUEST_REVIEW',
}) => {
  if (
    !REPOSITORY.test(repository ?? '') || !positiveInteger(taskIssue) || !positiveInteger(prNumber) ||
    !FULL_SHA.test(exactHead ?? '') || !FULL_SHA.test(expectedBase ?? '') || !positiveInteger(reviewId)
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
    pull?.draft !== false || pull?.head?.sha !== exactHead || pull?.head?.repo?.full_name !== repository ||
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
    livePull.state !== 'OPEN' || livePull.isDraft !== false || livePull.merged !== false ||
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
    draft: false,
  })
}

export const acquireSimplifiedPreDecisionPreflightV1 = async ({ request, host }) => {
  if (!exactKeys(request, PRE_DECISION_FIELDS) || host === null || typeof host !== 'object') {
    throw new Error('pre_decision_preflight_request_invalid')
  }
  return acquireLiveSnapshot({
    repository: request.repository,
    taskIssue: request.task_issue,
    prNumber: request.pull_request,
    exactHead: request.exact_head,
    expectedBase: request.expected_base,
    authorizedPaths: request.authorized_paths,
    reviewId: request.review_id,
    reviewUrl: request.review_url,
    reviewKind: request.review_kind,
    host,
  })
}

export const acquireSimplifiedReviewPublicationPreflightV2 = async ({ request, host }) => {
  if (
    !exactKeys(request, REVIEW_PUBLICATION_PREFLIGHT_FIELDS) || host === null || typeof host !== 'object' ||
    typeof host.api !== 'function' || typeof host.graphql !== 'function' ||
    !REPOSITORY.test(request?.repository ?? '') || !positiveInteger(request?.task_issue) ||
    !positiveInteger(request?.pull_request) || !FULL_SHA.test(request?.exact_head ?? '') ||
    !FULL_SHA.test(request?.expected_base ?? '')
  ) throw new Error('review_publication_preflight_request_invalid')
  const authorizedPaths = normalizedPaths(request.authorized_paths, 'authorized_scope_invalid')
  const [task, pull, mainRef, files, checks, threadSnapshot] = await Promise.all([
    host.api(`repos/${request.repository}/issues/${request.task_issue}`),
    host.api(`repos/${request.repository}/pulls/${request.pull_request}`),
    host.api(`repos/${request.repository}/git/ref/heads/main`),
    acquireFiles({ repository: request.repository, prNumber: request.pull_request, host }),
    acquireChecks({ repository: request.repository, exactHead: request.exact_head, host }),
    acquireThreads({
      repository: request.repository,
      prNumber: request.pull_request,
      exactHead: request.exact_head,
      host,
    }),
  ])
  let taskAuthority
  try {
    taskAuthority = parseSimplifiedTaskAuthorityV1(task?.body)
  } catch {
    throw new Error('review_publication_live_binding_invalid')
  }
  if (
    task?.number !== request.task_issue || task?.state !== 'open' || task?.pull_request !== undefined ||
    taskAuthority.task_issue !== request.task_issue || taskAuthority.repository !== request.repository ||
    task?.user?.login !== taskAuthority.product_owner_login ||
    typeof pull?.node_id !== 'string' || pull.node_id.length === 0 ||
    pull?.number !== request.pull_request || pull?.state !== 'open' || pull?.draft !== false || pull?.merged !== false ||
    pull?.head?.sha !== request.exact_head || typeof pull?.head?.ref !== 'string' || pull.head.ref.length === 0 ||
    pull?.head?.repo?.full_name !== request.repository || pull?.base?.ref !== 'main' ||
    pull?.base?.sha !== request.expected_base || pull?.base?.repo?.full_name !== request.repository ||
    mainRef?.ref !== 'refs/heads/main' || mainRef?.object?.sha !== request.expected_base ||
    !samePaths(taskAuthority.authorized_paths, authorizedPaths) || !samePaths(files, authorizedPaths)
  ) throw new Error('review_publication_live_binding_invalid')

  const requiredChecks = evaluateRequiredChecksV1({ checks, paths: files, exactHead: request.exact_head })
  const livePull = threadSnapshot.pull
  if (
    livePull.state !== 'OPEN' || livePull.isDraft !== false || livePull.merged !== false ||
    livePull.headRefOid !== request.exact_head || livePull.mergeable !== 'MERGEABLE' ||
    livePull.mergeStateStatus !== 'CLEAN'
  ) throw new Error('mergeability_invalid')
  if (threadSnapshot.threads.some((thread) => !thread.isResolved && !thread.isOutdated)) {
    throw new Error('blocking_review_threads_present')
  }
  return Object.freeze({
    repository: request.repository,
    task_issue: request.task_issue,
    pr_number: request.pull_request,
    pull_id: pull.node_id,
    exact_head: request.exact_head,
    expected_base: request.expected_base,
    head_branch: pull.head.ref,
    pull_author: pull.user?.login ?? null,
    task_body: task.body,
    task_author: task.user.login,
    task_author_association: task.author_association ?? null,
    authorized_paths: authorizedPaths,
    required_checks: requiredChecks,
    thread_ids: Object.freeze(threadSnapshot.threads.map((thread) => thread.id).sort()),
    mergeable: livePull.mergeable,
    merge_state_status: livePull.mergeStateStatus,
    draft: false,
  })
}

const boundedDiagnosticAtom = (value, maximum) => (
  typeof value === 'string' && value.length > 0 && value.length <= maximum && /^[A-Za-z0-9_.:-]+$/u.test(value)
    ? value
    : null
)

const boundedDiagnosticMessage = (value) => String(value ?? 'github_request_failed')
  .replace(/(\bauthorization\s*:\s*(?:bearer|basic)\s+)(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s,;]+)/giu, '$1[REDACTED]')
  .replace(/(\b(?:set-cookie|cookie)\s*:\s*)[^\r\n]*/giu, '$1[REDACTED]')
  .replace(/\b[^\s<>"'@/:]+:[^\s<>"'@/]+@(?:\[[0-9A-Fa-f:.]+\]|[A-Za-z0-9.-]+)(?::\d+)?(?:\/[^\s<>"']*)?/gu, '[REDACTED_URL]')
  .replace(/(?:(?:[A-Za-z][A-Za-z0-9+.-]*:)?\/\/|www\.)[^\s<>"']+/gu, '[REDACTED_URL]')
  .replace(/\[[0-9A-Fa-f:.]+\](?::\d+)?(?:\/[^\s<>"']*)?/gu, '[REDACTED_URL]')
  .replace(/\b(?:[0-9A-Fa-f]{1,4}:){2,}[0-9A-Fa-f:]*\/[^\s<>"']*/gu, '[REDACTED_URL]')
  .replace(/\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?(?:\/[^\s<>"']*)?/gu, '[REDACTED_URL]')
  .replace(/\blocalhost(?::\d+)?(?:\/[^\s<>"']*)?/giu, '[REDACTED_URL]')
  .replace(/\b(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,63}(?::\d+)?\/[^\s<>"']*/gu, '[REDACTED_URL]')
  .replace(/[\r\n\t]+/gu, ' ')
  .slice(0, 512)

const projectMergeMutationDiagnosticV1 = (error) => {
  const value = error?.mutation_diagnostic
  const graphqlErrors = (Array.isArray(value?.graphql_errors) ? value.graphql_errors : []).slice(0, 8)
  const networkException = value?.network_exception
  return Object.freeze({
    phase: boundedDiagnosticAtom(value?.phase, 96) ?? 'MERGE_MUTATION_UNKNOWN',
    request_dispatch_started: typeof value?.request_dispatch_started === 'boolean' ? value.request_dispatch_started : null,
    response_received: typeof value?.response_received === 'boolean' ? value.response_received : null,
    http_status: Number.isInteger(value?.http_status) && value.http_status >= 100 && value.http_status <= 599 ? value.http_status : null,
    github_request_id: boundedDiagnosticAtom(value?.github_request_id, 128),
    response_message: value?.response_message === null || value?.response_message === undefined
      ? null
      : boundedDiagnosticMessage(value.response_message),
    graphql_errors: Object.freeze(graphqlErrors.map((entry) => Object.freeze({
      type: boundedDiagnosticAtom(entry?.type, 64),
      message: boundedDiagnosticMessage(entry?.message),
    }))),
    network_exception: networkException === null || networkException === undefined ? null : Object.freeze({
      name: boundedDiagnosticAtom(networkException?.name, 64),
      code: boundedDiagnosticAtom(networkException?.code, 64),
    }),
  })
}

const stopped = (operation, reason, mutationCount = 0, outcome = 'DEFINITIVE_REJECTION', diagnostic = null) => Object.freeze({
  operation,
  state: outcome === 'OUTCOME_UNKNOWN' ? 'INDETERMINATE' : 'STOPPED',
  reason,
  outcome,
  mutation_count: mutationCount,
  ...(diagnostic === null ? {} : { mutation_diagnostic: diagnostic }),
  exit_code: 1,
})

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
      host,
    })
    if (JSON.stringify(initial) !== JSON.stringify(final)) throw new Error('merge_final_drift')

    const mutationCount = 1
    let mutation
    try {
      mutation = await host.mergePullRequest({
        repository,
        prNumber: decision.pull_request,
        exactHead: decision.exact_head,
      })
    } catch (error) {
      const diagnostic = projectMergeMutationDiagnosticV1(error)
      const explicitRejection = diagnostic.response_received === true &&
        Number.isInteger(diagnostic.http_status) &&
        diagnostic.http_status >= 400 && diagnostic.http_status < 500
      return stopped(
        operation,
        diagnostic.http_status === 409
          ? 'merge_exact_head_rejected'
          : explicitRejection
            ? 'merge_rejected'
            : 'merge_outcome_unknown',
        mutationCount,
        explicitRejection ? 'DEFINITIVE_REJECTION' : 'OUTCOME_UNKNOWN',
        diagnostic,
      )
    }
    if (mutation?.merged !== true || !FULL_SHA.test(mutation?.sha ?? '')) {
      return stopped(operation, 'merge_after_state_invalid', mutationCount, 'OUTCOME_UNKNOWN')
    }
    const mergeCommit = mutation.sha

    const [afterPull, afterMain, commit] = await Promise.all([
      host.api(`repos/${repository}/pulls/${decision.pull_request}`),
      host.api(`repos/${repository}/git/ref/heads/main`),
      host.api(`repos/${repository}/git/commits/${mergeCommit}`),
    ])
    const parents = Array.isArray(commit?.parents) ? commit.parents.map((parent) => parent?.sha) : []
    if (
      afterPull?.state !== 'closed' || afterPull?.merged !== true || afterPull?.head?.sha !== decision.exact_head ||
      afterPull?.merge_commit_sha !== mergeCommit || afterMain?.object?.sha !== mergeCommit ||
      parents.length !== 2 || !parents.includes(decision.expected_base) || !parents.includes(decision.exact_head)
    ) return stopped(operation, 'merge_after_refetch_invalid', mutationCount, 'OUTCOME_UNKNOWN')

    return Object.freeze({
      operation, state: 'COMPLETED', reason: 'merge_completed', outcome: 'MUTATION_CONFIRMED',
      mutation_count: mutationCount, exit_code: 0, repository, task_issue: taskIssue,
      pr_number: decision.pull_request, exact_head: decision.exact_head,
      previous_main: decision.expected_base, merge_commit: mergeCommit,
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
