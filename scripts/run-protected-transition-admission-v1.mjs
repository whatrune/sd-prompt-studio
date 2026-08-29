import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import {
  executeSimplifiedMergeV1,
  serializeSimplifiedMergeDecisionV1,
  serializeSimplifiedReviewV1,
  serializeSimplifiedTaskAuthorityV1,
} from './protected-transition-merge-operator-preflight-v1.mjs'

const API_ROOT = 'https://api.github.com'
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

const boundedMessage = (value) => redactCredentialBearingText(value)
  .replace(/(?:[A-Za-z][A-Za-z0-9+.-]*:\/\/|www\.)[^\s<>"']+/gu, '[REDACTED_URL]')
  .replace(/[\r\n\t]+/gu, ' ')
  .slice(0, 512)

const boundedAtom = (value, pattern, maximum) => {
  if (typeof value !== 'string' || value.length === 0 || value.length > maximum || !pattern.test(value)) return null
  return value
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
  graphqlErrors = [],
  networkException = null,
}) => Object.freeze({
  phase,
  request_dispatch_started: requestDispatchStarted,
  response_received: responseReceived,
  http_status: Number.isInteger(httpStatus) && httpStatus >= 100 && httpStatus <= 599 ? httpStatus : null,
  github_request_id: boundedAtom(githubRequestId, /^[A-Za-z0-9:-]+$/u, 128),
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
        graphqlErrors: body?.errors,
      }))
    }
    throw new Error(`github_http_${response.status}:${boundedMessage(body?.message)}`)
  }
  return diagnosticOperation === null ? body : Object.freeze({ body, responseDiagnostic: Object.freeze(responseDiagnostic) })
}

export const createProductionHostV1 = ({ fetchImpl = globalThis.fetch, token = process.env.GH_TOKEN } = {}) => Object.freeze({
  api: (route) => request(`${API_ROOT}/${route}`, {}, { fetchImpl, token }),
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
    process.stdout.write(body)
  } else {
    const issueEventFile = valueAfter('--simplified-issue-comment-event-file')
    if (issueEventFile === null) throw new Error('issue_comment_event_file_required')
    const event = readJson(issueEventFile)
    const plan = await executeSimplifiedMergeV1({ event, host: createProductionHostV1() })
    process.stdout.write(`${JSON.stringify(plan)}\n`)
    process.exitCode = plan.exit_code
  }
}
