import {
  closeSync,
  fsyncSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeSync,
} from 'node:fs'
import { pathToFileURL } from 'node:url'
import {
  acquireSimplifiedPreDecisionPreflightV1,
  executeSimplifiedMergeV1,
  parseSimplifiedMergeDecisionV1,
  parseSimplifiedReviewV1,
  parseSimplifiedTaskAuthorityV1,
  serializeSimplifiedMergeDecisionV1,
  serializeSimplifiedReviewV1,
  serializeSimplifiedTaskAuthorityV1,
} from './protected-transition-merge-operator-preflight-v1.mjs'

const API_ROOT = 'https://api.github.com'
const REVIEW_RECORD_MARKER = '"record_type": "simplified_independent_review_v1"'
const REVIEWER_ASSOCIATIONS = new Set(['OWNER', 'MEMBER', 'COLLABORATOR'])
const REVIEW_ROUTING_REQUEST_FIELDS = Object.freeze([
  'repository', 'task_issue', 'pull_request', 'exact_head', 'expected_base',
  'authorized_paths', 'review_input',
])
const FULL_SHA = /^[0-9a-f]{40}$/u
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u
const args = process.argv.slice(2)
const valueAfter = (flag) => {
  const index = args.indexOf(flag)
  return index < 0 || index + 1 >= args.length ? null : args[index + 1]
}

const redactCredentialBearingText = (value) => String(value ?? 'github_request_failed')
  .replace(
    /(\bauthorization\s*:\s*(?:bearer|basic)\s+)(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s,;]+)/giu,
    '$1[REDACTED]',
  )
  .replace(/(\b(?:set-cookie|cookie)\s*:\s*)[^\r\n]*/giu, '$1[REDACTED]')

const redactUrlLikeTokens = (value) => String(value)
  .replace(/\b[^\s<>"'@/:]+:[^\s<>"'@/]+@(?:\[[0-9A-Fa-f:.]+\]|[A-Za-z0-9.-]+)(?::\d+)?(?:\/[^\s<>"']*)?/gu, '[REDACTED_URL]')
  .replace(/(?:(?:[A-Za-z][A-Za-z0-9+.-]*:)?\/\/|www\.)[^\s<>"']+/gu, '[REDACTED_URL]')
  .replace(/\[[0-9A-Fa-f:.]+\](?::\d+)?(?:\/[^\s<>"']*)?/gu, '[REDACTED_URL]')
  .replace(/\b(?:[0-9A-Fa-f]{1,4}:){2,}[0-9A-Fa-f:]*\/[^\s<>"']*/gu, '[REDACTED_URL]')
  .replace(/\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?(?:\/[^\s<>"']*)?/gu, '[REDACTED_URL]')
  .replace(/\blocalhost(?::\d+)?(?:\/[^\s<>"']*)?/giu, '[REDACTED_URL]')
  .replace(/\b(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,63}(?::\d+)?\/[^\s<>"']*/gu, '[REDACTED_URL]')

const boundedMessage = (value) => redactUrlLikeTokens(redactCredentialBearingText(value))
  .replace(/[\r\n\t]+/gu, ' ')
  .slice(0, 512)

const boundedAtom = (value, pattern, maximum) => {
  if (typeof value !== 'string' || value.length === 0 || value.length > maximum || !pattern.test(value)) return null
  return value
}

const productionPublicationFileHostV1 = Object.freeze({
  closeSync,
  fsyncSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeSync,
})

const publicationParserV1 = (kind) => {
  if (kind === 'review') return parseSimplifiedReviewV1
  if (kind === 'merge') return parseSimplifiedMergeDecisionV1
  throw new Error('publication_transport_kind_invalid')
}

export const writeProtectedPublicationBodyFileV1 = ({
  kind,
  body,
  outputFile,
  fileHost = productionPublicationFileHostV1,
}) => {
  const parse = publicationParserV1(kind)
  if (typeof body !== 'string' || body.length === 0) throw new Error('publication_transport_body_invalid')
  if (typeof outputFile !== 'string' || outputFile.length === 0) throw new Error('publication_transport_output_file_invalid')
  parse(body)
  const expected = Buffer.from(body, 'utf8')
  if (expected.length === 0 || new TextDecoder('utf-8', { fatal: true }).decode(expected) !== body) {
    throw new Error('publication_transport_encoding_invalid')
  }

  let descriptor = null
  let created = false
  try {
    descriptor = fileHost.openSync(outputFile, 'wx', 0o600)
    created = true
    const written = fileHost.writeSync(descriptor, expected, 0, expected.length, 0)
    if (written !== expected.length) throw new Error('publication_transport_partial_write')
    fileHost.fsyncSync(descriptor)
    fileHost.closeSync(descriptor)
    descriptor = null

    const observed = fileHost.readFileSync(outputFile)
    const observedBytes = Buffer.isBuffer(observed) ? observed : Buffer.from(observed)
    if (!observedBytes.equals(expected)) throw new Error('publication_transport_readback_mismatch')
    const observedBody = new TextDecoder('utf-8', { fatal: true }).decode(observedBytes)
    if (observedBody !== body) throw new Error('publication_transport_encoding_mismatch')
    parse(observedBody)
    return Object.freeze({
      state: 'COMPLETED',
      publication_kind: kind,
      byte_length: expected.length,
    })
  } catch (cause) {
    if (descriptor !== null) {
      try { fileHost.closeSync(descriptor) } catch {}
    }
    if (created) {
      try { fileHost.unlinkSync(outputFile) } catch {}
    }
    throw new Error('publication_transport_invalid', { cause })
  }
}

const boundedGraphqlErrors = (value) => Object.freeze(
  (Array.isArray(value) ? value : []).slice(0, 8).map((error) => Object.freeze({
    type: boundedAtom(error?.type, /^[A-Za-z0-9_.:-]+$/u, 64),
    message: boundedMessage(error?.message),
  })),
)

const mutationDiagnostic = ({
  phase,
  requestDispatchStarted,
  responseReceived,
  httpStatus = null,
  githubRequestId = null,
  responseMessage = null,
  graphqlErrors = [],
  networkException = null,
}) => Object.freeze({
  phase,
  request_dispatch_started: requestDispatchStarted,
  response_received: responseReceived,
  http_status: Number.isInteger(httpStatus) && httpStatus >= 100 && httpStatus <= 599 ? httpStatus : null,
  github_request_id: boundedAtom(githubRequestId, /^[A-Za-z0-9:-]+$/u, 128),
  response_message: responseMessage === null ? null : boundedMessage(responseMessage),
  graphql_errors: boundedGraphqlErrors(graphqlErrors),
  network_exception: networkException === null ? null : Object.freeze({
    name: boundedAtom(networkException?.name, /^[A-Za-z0-9_.:-]+$/u, 64),
    code: boundedAtom(networkException?.code, /^[A-Za-z0-9_.:-]+$/u, 64),
  }),
})

const mutationDiagnosticError = (diagnostic) => {
  const error = new Error('github_mutation_request_failed')
  Object.defineProperty(error, 'mutation_diagnostic', { value: diagnostic })
  return error
}

const request = async (url, options = {}, context = {}) => {
  const token = context.token ?? process.env.GH_TOKEN
  const fetchImpl = context.fetchImpl ?? globalThis.fetch
  const diagnosticOperation = context.diagnosticOperation ?? null
  if (typeof token !== 'string' || token.length === 0) {
    if (diagnosticOperation !== null) {
      throw mutationDiagnosticError(mutationDiagnostic({
        phase: `${diagnosticOperation}_REQUEST_PREPARE`,
        requestDispatchStarted: false,
        responseReceived: false,
      }))
    }
    throw new Error('github_token_missing')
  }
  let response
  try {
    response = await fetchImpl(url, {
      ...options,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...options.headers,
      },
    })
  } catch (error) {
    if (diagnosticOperation !== null) {
      throw mutationDiagnosticError(mutationDiagnostic({
        phase: `${diagnosticOperation}_TRANSPORT`,
        requestDispatchStarted: true,
        responseReceived: false,
        networkException: {
          name: error instanceof Error ? error.name : null,
          code: error?.code ?? error?.cause?.code ?? null,
        },
      }))
    }
    throw error
  }
  const responseDiagnostic = diagnosticOperation === null ? null : {
    requestDispatchStarted: true,
    responseReceived: true,
    httpStatus: response.status,
    githubRequestId: response.headers?.get?.('x-github-request-id') ?? null,
  }
  let body
  try {
    body = await response.json()
  } catch {
    if (diagnosticOperation !== null) {
      throw mutationDiagnosticError(mutationDiagnostic({
        phase: `${diagnosticOperation}_RESPONSE_PARSE`,
        ...responseDiagnostic,
      }))
    }
    throw new Error(`github_response_invalid:${response.status}`)
  }
  if (!response.ok) {
    if (diagnosticOperation !== null) {
      throw mutationDiagnosticError(mutationDiagnostic({
        phase: `${diagnosticOperation}_HTTP_RESPONSE`,
        ...responseDiagnostic,
        responseMessage: body?.message,
        graphqlErrors: body?.errors,
      }))
    }
    throw new Error(`github_http_${response.status}:${boundedMessage(body?.message)}`)
  }
  return diagnosticOperation === null ? body : Object.freeze({ body, responseDiagnostic: Object.freeze(responseDiagnostic) })
}

export const createProductionHostV1 = ({ fetchImpl = globalThis.fetch, token = process.env.GH_TOKEN } = {}) => Object.freeze({
  api: (route) => request(`${API_ROOT}/${route}`, {}, { fetchImpl, token }),
  publishPullRequestReview: async ({ repository, prNumber, exactHead, body }) => {
    if (
      !REPOSITORY.test(repository ?? '') || !Number.isSafeInteger(prNumber) || prNumber < 1 ||
      !FULL_SHA.test(exactHead ?? '') || typeof body !== 'string' || body.length === 0
    ) throw new Error('review_publication_request_invalid')
    const response = await request(
      `${API_ROOT}/repos/${repository}/pulls/${prNumber}/reviews`,
      {
        method: 'POST',
        body: JSON.stringify({ body, event: 'APPROVE', commit_id: exactHead }),
      },
      { diagnosticOperation: 'REVIEW_AUTHORITY_MUTATION', fetchImpl, token },
    )
    return response.body
  },
  publishTaskIssueComment: async ({ repository, taskIssue, body }) => {
    if (
      !REPOSITORY.test(repository ?? '') || !Number.isSafeInteger(taskIssue) || taskIssue < 1 ||
      typeof body !== 'string' || body.length === 0
    ) throw new Error('review_publication_request_invalid')
    const response = await request(
      `${API_ROOT}/repos/${repository}/issues/${taskIssue}/comments`,
      { method: 'POST', body: JSON.stringify({ body }) },
      { diagnosticOperation: 'REVIEW_AUTHORITY_MUTATION', fetchImpl, token },
    )
    return response.body
  },
  mergePullRequest: async ({ repository, prNumber, exactHead }) => {
    if (
      typeof repository !== 'string' || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(repository) ||
      !Number.isSafeInteger(prNumber) || prNumber < 1 ||
      typeof exactHead !== 'string' || !/^[0-9a-f]{40}$/u.test(exactHead)
    ) throw new Error('merge_rest_request_invalid')
    const [owner, name] = repository.split('/')
    const response = await request(
      `${API_ROOT}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/pulls/${prNumber}/merge`,
      {
        method: 'PUT',
        body: JSON.stringify({ sha: exactHead, merge_method: 'merge' }),
      },
      { diagnosticOperation: 'MERGE_MUTATION', fetchImpl, token },
    )
    return response.body
  },
  graphql: async (query, variables, options = {}) => {
    const diagnosticOperation = options?.diagnostic_operation ?? null
    const response = await request(`${API_ROOT}/graphql`, {
      method: 'POST',
      body: JSON.stringify({ query, variables }),
    }, { diagnosticOperation, fetchImpl, token })
    const body = diagnosticOperation === null ? response : response.body
    if (Array.isArray(body?.errors) && body.errors.length > 0) {
      if (diagnosticOperation !== null) {
        throw mutationDiagnosticError(mutationDiagnostic({
          phase: `${diagnosticOperation}_GRAPHQL_RESPONSE`,
          ...response.responseDiagnostic,
          graphqlErrors: body.errors,
        }))
      }
      throw new Error(`github_graphql_error:${boundedMessage(body.errors[0]?.message)}`)
    }
    if (body?.data === undefined) {
      if (diagnosticOperation !== null) {
        throw mutationDiagnosticError(mutationDiagnostic({
          phase: `${diagnosticOperation}_RESPONSE_PARSE`,
          ...response.responseDiagnostic,
        }))
      }
      throw new Error('github_graphql_response_invalid')
    }
    return body.data
  },
})

const exactKeys = (value, fields) => (
  value !== null && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).sort().join('\n') === [...fields].sort().join('\n')
)

const normalizedPaths = (paths) => {
  if (
    !Array.isArray(paths) || paths.length === 0 || new Set(paths).size !== paths.length ||
    paths.some((value) => (
      typeof value !== 'string' || value.length === 0 || value !== value.trim() ||
      value.startsWith('/') || value.includes('\\') || value.includes('\0') ||
      value.split('/').some((segment) => !segment || segment === '.' || segment === '..')
    ))
  ) throw new Error('review_publication_request_invalid')
  return Object.freeze([...paths].sort())
}

const samePaths = (left, right) => (
  Array.isArray(left) && Array.isArray(right) &&
  [...left].sort().join('\n') === [...right].sort().join('\n')
)

const acquirePagedItems = async ({ host, route }) => {
  const items = []
  for (let page = 1; page <= 32; page += 1) {
    const separator = route.includes('?') ? '&' : '?'
    const pageItems = await host.api(`${route}${separator}per_page=100&page=${page}`)
    if (!Array.isArray(pageItems)) throw new Error('review_authority_acquisition_failed')
    items.push(...pageItems)
    if (pageItems.length < 100) return Object.freeze(items)
  }
  throw new Error('review_authority_pagination_incomplete')
}

const acquireChangedPaths = async ({ host, repository, pullRequest }) => {
  const items = await acquirePagedItems({ host, route: `repos/${repository}/pulls/${pullRequest}/files` })
  const paths = []
  for (const item of items) {
    if (typeof item?.filename !== 'string') throw new Error('review_publication_scope_invalid')
    if (item.status === 'renamed') {
      if (typeof item.previous_filename !== 'string') throw new Error('review_publication_scope_invalid')
      paths.push(item.previous_filename)
    }
    paths.push(item.filename)
  }
  return normalizedPaths(paths)
}

const reviewAuthorityFromResource = ({ kind, resource, request, pull, expectedBody }) => {
  if (typeof resource?.body !== 'string' || !resource.body.includes(REVIEW_RECORD_MARKER)) return null
  let parsed
  try {
    parsed = parseSimplifiedReviewV1(resource.body)
  } catch {
    throw new Error('review_authority_malformed')
  }
  if (
    parsed.task_issue !== request.task_issue || parsed.pull_request !== request.pull_request ||
    parsed.reviewed_head !== request.exact_head
  ) return null
  if (resource.body !== expectedBody) throw new Error('review_authority_conflict')

  const expectedUrl = kind === 'PULL_REQUEST_REVIEW'
    ? `https://github.com/${request.repository}/pull/${request.pull_request}#pullrequestreview-${resource.id}`
    : `https://github.com/${request.repository}/issues/${request.task_issue}#issuecomment-${resource.id}`
  const identityValid = kind === 'PULL_REQUEST_REVIEW'
    ? Number.isSafeInteger(resource.id) && resource.id > 0 && resource.state === 'APPROVED' &&
      resource.commit_id === request.exact_head && REVIEWER_ASSOCIATIONS.has(resource.author_association) &&
      resource.user?.login !== pull.user?.login
    : Number.isSafeInteger(resource.id) && resource.id > 0 &&
      resource.issue_url === `https://api.github.com/repos/${request.repository}/issues/${request.task_issue}` &&
      REVIEWER_ASSOCIATIONS.has(resource.author_association)
  if (!identityValid || resource.html_url !== expectedUrl) throw new Error('review_authority_identity_invalid')
  return Object.freeze({
    review_kind: kind,
    review_id: resource.id,
    review_url: expectedUrl,
    review_actor: resource.user.login,
    body: resource.body,
  })
}

const acquireCurrentReviewAuthorities = async ({ host, request, pull, expectedBody }) => {
  const [reviews, comments] = await Promise.all([
    acquirePagedItems({ host, route: `repos/${request.repository}/pulls/${request.pull_request}/reviews` }),
    acquirePagedItems({ host, route: `repos/${request.repository}/issues/${request.task_issue}/comments` }),
  ])
  const authorities = []
  for (const review of reviews) {
    const authority = reviewAuthorityFromResource({
      kind: 'PULL_REQUEST_REVIEW', resource: review, request, pull, expectedBody,
    })
    if (authority !== null) authorities.push(authority)
  }
  for (const comment of comments) {
    const authority = reviewAuthorityFromResource({
      kind: 'TASK_ISSUE_COMMENT', resource: comment, request, pull, expectedBody,
    })
    if (authority !== null) authorities.push(authority)
  }
  if (authorities.length > 1) throw new Error('review_authority_duplicate')
  return Object.freeze(authorities)
}

const validateReviewRoutingRequest = (request) => {
  if (
    !exactKeys(request, REVIEW_ROUTING_REQUEST_FIELDS) || !REPOSITORY.test(request.repository ?? '') ||
    !Number.isSafeInteger(request.task_issue) || request.task_issue < 1 ||
    !Number.isSafeInteger(request.pull_request) || request.pull_request < 1 ||
    !FULL_SHA.test(request.exact_head ?? '') || !FULL_SHA.test(request.expected_base ?? '')
  ) throw new Error('review_publication_request_invalid')
  const authorizedPaths = normalizedPaths(request.authorized_paths)
  const reviewBody = serializeSimplifiedReviewV1(request.review_input)
  const review = parseSimplifiedReviewV1(reviewBody)
  if (
    review.task_issue !== request.task_issue || review.pull_request !== request.pull_request ||
    review.reviewed_head !== request.exact_head
  ) throw new Error('review_publication_binding_invalid')
  return Object.freeze({ ...request, authorized_paths: authorizedPaths, review_body: reviewBody })
}

export const ensureReviewAuthorityAndRunPreflightV1 = async ({ request, host }) => {
  request = validateReviewRoutingRequest(request)
  if (
    host === null || typeof host !== 'object' || typeof host.api !== 'function' ||
    typeof host.publishPullRequestReview !== 'function' || typeof host.publishTaskIssueComment !== 'function'
  ) throw new Error('review_publication_host_invalid')

  const [actor, task, pull, mainRef, changedPaths] = await Promise.all([
    host.api('user'),
    host.api(`repos/${request.repository}/issues/${request.task_issue}`),
    host.api(`repos/${request.repository}/pulls/${request.pull_request}`),
    host.api(`repos/${request.repository}/git/ref/heads/main`),
    acquireChangedPaths({ host, repository: request.repository, pullRequest: request.pull_request }),
  ])
  let taskAuthority
  try {
    taskAuthority = parseSimplifiedTaskAuthorityV1(task?.body)
  } catch {
    throw new Error('review_publication_live_binding_invalid')
  }
  if (
    typeof actor?.login !== 'string' || actor.login.length === 0 ||
    task?.number !== request.task_issue || task?.state !== 'open' || task?.pull_request !== undefined ||
    taskAuthority.task_issue !== request.task_issue || taskAuthority.repository !== request.repository ||
    task?.user?.login !== taskAuthority.product_owner_login ||
    pull?.number !== request.pull_request || pull?.state !== 'open' || pull?.draft !== false || pull?.merged !== false ||
    pull?.head?.sha !== request.exact_head || pull?.head?.repo?.full_name !== request.repository ||
    pull?.base?.ref !== 'main' || pull?.base?.sha !== request.expected_base ||
    pull?.base?.repo?.full_name !== request.repository ||
    mainRef?.ref !== 'refs/heads/main' || mainRef?.object?.sha !== request.expected_base ||
    !samePaths(taskAuthority.authorized_paths, request.authorized_paths) ||
    !samePaths(changedPaths, request.authorized_paths)
  ) throw new Error('review_publication_live_binding_invalid')

  let authorities = await acquireCurrentReviewAuthorities({ host, request, pull, expectedBody: request.review_body })
  let mutationCount = 0
  let publicationRoute = 'REUSED'
  if (authorities.length === 0) {
    mutationCount = 1
    const selfAuthored = actor.login === pull.user?.login
    publicationRoute = selfAuthored ? 'TASK_ISSUE_COMMENT' : 'PULL_REQUEST_REVIEW'
    const resource = selfAuthored
      ? await host.publishTaskIssueComment({
          repository: request.repository,
          taskIssue: request.task_issue,
          body: request.review_body,
        })
      : await host.publishPullRequestReview({
          repository: request.repository,
          prNumber: request.pull_request,
          exactHead: request.exact_head,
          body: request.review_body,
        })
    if (!Number.isSafeInteger(resource?.id) || resource.id < 1) throw new Error('review_publication_response_invalid')
    const route = selfAuthored
      ? `repos/${request.repository}/issues/comments/${resource.id}`
      : `repos/${request.repository}/pulls/${request.pull_request}/reviews/${resource.id}`
    const refetched = await host.api(route)
    if (refetched?.user?.login !== actor.login) throw new Error('review_publication_refetch_mismatch')
    reviewAuthorityFromResource({ kind: publicationRoute, resource: refetched, request, pull, expectedBody: request.review_body })
    authorities = await acquireCurrentReviewAuthorities({ host, request, pull, expectedBody: request.review_body })
    if (authorities.length !== 1 || authorities[0].review_id !== resource.id) {
      throw new Error('review_publication_refetch_mismatch')
    }
  }

  const authority = authorities[0]
  const preflight = await acquireSimplifiedPreDecisionPreflightV1({
    request: {
      repository: request.repository,
      task_issue: request.task_issue,
      pull_request: request.pull_request,
      exact_head: request.exact_head,
      expected_base: request.expected_base,
      authorized_paths: request.authorized_paths,
      review_kind: authority.review_kind,
      review_id: authority.review_id,
      review_url: authority.review_url,
    },
    host,
  })
  return Object.freeze({
    state: 'MERGE_READY',
    publication_route: publicationRoute,
    publication_mutation_count: mutationCount,
    review_kind: authority.review_kind,
    review_id: authority.review_id,
    review_url: authority.review_url,
    exact_head: request.exact_head,
    preflight,
  })
}

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'))
if (process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const serializeMode = valueAfter('--serialize-task-authority-file') !== null
    ? ['task', valueAfter('--serialize-task-authority-file')]
    : valueAfter('--serialize-review-file') !== null
      ? ['review', valueAfter('--serialize-review-file')]
      : valueAfter('--serialize-merge-decision-file') !== null
        ? ['merge', valueAfter('--serialize-merge-decision-file')]
        : null

  if (serializeMode !== null) {
    const [kind, file] = serializeMode
    const input = readJson(file)
    const body = kind === 'task'
      ? serializeSimplifiedTaskAuthorityV1(input)
      : kind === 'review'
        ? serializeSimplifiedReviewV1(input)
        : serializeSimplifiedMergeDecisionV1(input)
    const publicationOutputRequested = args.includes('--publication-body-output-file')
    const publicationOutputFile = valueAfter('--publication-body-output-file')
    if (publicationOutputRequested) {
      if (publicationOutputFile === null) throw new Error('publication_transport_output_file_required')
      const result = writeProtectedPublicationBodyFileV1({ kind, body, outputFile: publicationOutputFile })
      process.stdout.write(`${JSON.stringify(result)}\n`)
    } else {
      process.stdout.write(body)
    }
  } else {
    const reviewAuthorityPreflightFile = valueAfter('--ensure-review-authority-and-run-preflight-file')
    const preDecisionPreflightFile = valueAfter('--pre-decision-preflight-file')
    if (reviewAuthorityPreflightFile !== null) {
      const result = await ensureReviewAuthorityAndRunPreflightV1({
        request: readJson(reviewAuthorityPreflightFile),
        host: createProductionHostV1(),
      })
      process.stdout.write(`${JSON.stringify(result)}\n`)
      process.exitCode = 0
    } else if (preDecisionPreflightFile !== null) {
      const snapshot = await acquireSimplifiedPreDecisionPreflightV1({
        request: readJson(preDecisionPreflightFile),
        host: createProductionHostV1(),
      })
      process.stdout.write(`${JSON.stringify(snapshot)}\n`)
      process.exitCode = 0
    } else {
      const issueEventFile = valueAfter('--simplified-issue-comment-event-file')
      if (issueEventFile === null) throw new Error('issue_comment_event_file_required')
      const event = readJson(issueEventFile)
      const plan = await executeSimplifiedMergeV1({ event, host: createProductionHostV1() })
      process.stdout.write(`${JSON.stringify(plan)}\n`)
      process.exitCode = plan.exit_code
    }
  }
}
