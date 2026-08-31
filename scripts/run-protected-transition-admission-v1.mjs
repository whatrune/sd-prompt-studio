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
    const preDecisionPreflightFile = valueAfter('--pre-decision-preflight-file')
    if (preDecisionPreflightFile !== null) {
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
