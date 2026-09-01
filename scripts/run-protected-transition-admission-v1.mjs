import {
  closeSync,
  fsyncSync,
  mkdtempSync,
  openSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeSync,
} from 'node:fs'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseDocument } from 'yaml'
import {
  acquireSimplifiedPreDecisionPreflightV1,
  acquireSimplifiedReviewPublicationPreflightV2,
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
const REVIEW_PUBLICATION_ASSIGNMENT_FIELDS = Object.freeze([
  'task_id', 'record_type', 'authoring_role', 'authority_source', 'canonical_record',
  'prior_record_url', 'cumulative_scope', 'supporting_records', 'requested_by',
  'assigned_role', 'purpose', 'background', 'input_documents', 'allowed_changes',
  'forbidden_changes', 'expected_outputs', 'validation', 'completion_conditions',
  'escalation_conditions',
])
const REVIEW_PUBLICATION_GRANT_FIELDS = Object.freeze([
  'protected_action', 'repository', 'task_issue', 'pull_request', 'exact_head',
  'head_branch', 'expected_base', 'authorized_paths', 'authorized_actor',
  'permitted_surface', 'review', 'operation_count', 'fallback_allowed',
])
const RESOURCE_REVIEW_PUBLICATION_GRANT_FIELDS = Object.freeze([
  ...REVIEW_PUBLICATION_GRANT_FIELDS,
  'predelegation_task_id',
])
const REVIEW_PUBLICATION_PREDELEGATION_GRANT_FIELDS = Object.freeze([
  'protected_action', 'activation', 'materialization_only', 'repository',
  'task_issue', 'head_branch', 'authorized_paths', 'authorized_actor',
  'permitted_surface', 'required_review', 'operation_count', 'fallback_allowed',
])
const REVIEW_PUBLICATION_PREDELEGATION_REVIEW_FIELDS = Object.freeze([
  'record_type', 'reviewer_role', 'decision', 'blocking', 'remaining', 'unknown',
])
const REVIEW_PUBLICATION_FORBIDDEN_CHANGES = Object.freeze([
  'alternate_surface_fallback', 'merge', 'retry',
])
const REVIEW_PUBLICATION_PREDELEGATION_FORBIDDEN_CHANGES = Object.freeze([
  'review_publication_before_fresh_approval', 'alternate_surface_fallback', 'merge', 'retry',
])
const CANONICAL_TASK_BODY_REQUEST_FIELDS = Object.freeze([
  'title', 'repository', 'objective', 'markdown', 'authorized_paths', 'head_branch',
  'authorized_actor', 'permitted_surface', 'ready_allowed', 'product_owner_login',
])
const CANONICAL_TASK_BODY_MODES = Object.freeze(['UNBOUND_CREATE', 'BOUND_FINAL'])
const CANONICAL_TASK_SELF_BINDING_FIELDS = Object.freeze([
  'task_authority.task_issue',
  'review_publication_predelegation.task_id',
  'review_publication_predelegation.authority_source',
  'review_publication_predelegation.canonical_record',
  'review_publication_predelegation.allowed_changes.task_issue',
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

const publicationParserV1 = (kind, taskBindingMode = null) => {
  if (kind === 'task') return parseSimplifiedTaskAuthorityV1
  if (kind === 'canonical_task') {
    return (body) => parseCanonicalTaskIssueBodyV1({ body, mode: taskBindingMode })
  }
  if (kind === 'review') return parseSimplifiedReviewV1
  if (kind === 'merge') return parseSimplifiedMergeDecisionV1
  throw new Error('publication_transport_kind_invalid')
}

export const writeProtectedPublicationBodyFileV1 = ({
  kind,
  body,
  outputFile,
  taskBindingMode = null,
  fileHost = productionPublicationFileHostV1,
}) => {
  const parse = publicationParserV1(kind, taskBindingMode)
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
  createTaskIssue: async ({ repository, title, body }) => {
    if (
      !REPOSITORY.test(repository ?? '') || typeof title !== 'string' || title.length === 0 || title.length > 256 ||
      typeof body !== 'string' || body.length === 0
    ) throw new Error('canonical_task_issue_create_request_invalid')
    const response = await request(
      `${API_ROOT}/repos/${repository}/issues`,
      { method: 'POST', body: JSON.stringify({ title, body }) },
      { diagnosticOperation: 'CANONICAL_TASK_CREATE_MUTATION', fetchImpl, token },
    )
    return response.body
  },
  patchTaskIssueBody: async ({ repository, taskIssue, body }) => {
    if (
      !REPOSITORY.test(repository ?? '') || !Number.isSafeInteger(taskIssue) || taskIssue < 1 ||
      typeof body !== 'string' || body.length === 0
    ) throw new Error('canonical_task_issue_patch_request_invalid')
    const response = await request(
      `${API_ROOT}/repos/${repository}/issues/${taskIssue}`,
      { method: 'PATCH', body: JSON.stringify({ body }) },
      { diagnosticOperation: 'CANONICAL_TASK_PATCH_MUTATION', fetchImpl, token },
    )
    return response.body
  },
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
  publishTaskAssignmentComment: async ({ repository, taskIssue, body }) => {
    if (
      !REPOSITORY.test(repository ?? '') || !Number.isSafeInteger(taskIssue) || taskIssue < 1 ||
      typeof body !== 'string' || body.length === 0
    ) throw new Error('review_assignment_materialization_request_invalid')
    const response = await request(
      `${API_ROOT}/repos/${repository}/issues/${taskIssue}/comments`,
      { method: 'POST', body: JSON.stringify({ body }) },
      { diagnosticOperation: 'REVIEW_ASSIGNMENT_MUTATION', fetchImpl, token },
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

const nonEmptyText = (value) => typeof value === 'string' && value.length > 0

const classifyReviewPublicationTaskAssignmentsV2 = (body) => {
  if (typeof body !== 'string' || body.length === 0 || body.length > 65_536) {
    throw new Error('review_publication_authority_malformed')
  }
  const candidates = [...body.matchAll(/```yaml\r?\n([\s\S]*?)\r?\n```/gu)]
    .filter((block) => block[1].includes('REVIEW_AUTHORITY_PUBLICATION'))
  const predelegations = []
  const exactAssignments = []
  for (const candidate of candidates) {
    const document = parseDocument(candidate[1], { uniqueKeys: true })
    if (document.errors.length !== 0) throw new Error('review_publication_authority_malformed')
    const assignment = document.toJS()
    const grant = assignment?.allowed_changes
    if (
      !exactKeys(assignment, REVIEW_PUBLICATION_ASSIGNMENT_FIELDS) ||
      grant?.protected_action !== 'REVIEW_AUTHORITY_PUBLICATION'
    ) throw new Error('review_publication_authority_malformed')
    if (exactKeys(grant, REVIEW_PUBLICATION_PREDELEGATION_GRANT_FIELDS)) {
      predelegations.push(assignment)
    } else if (
      exactKeys(grant, REVIEW_PUBLICATION_GRANT_FIELDS) ||
      exactKeys(grant, RESOURCE_REVIEW_PUBLICATION_GRANT_FIELDS)
    ) {
      exactAssignments.push(assignment)
    } else {
      throw new Error('review_publication_authority_malformed')
    }
  }
  if (predelegations.length > 1) throw new Error('review_publication_predelegation_duplicate')
  if (exactAssignments.length > 1) throw new Error('review_publication_authority_duplicate')
  return Object.freeze({
    predelegation: predelegations[0] ?? null,
    exact_assignment: exactAssignments[0] ?? null,
  })
}

const canonicalTaskBodyModeV1 = (mode) => {
  if (!CANONICAL_TASK_BODY_MODES.includes(mode)) throw new Error('canonical_task_body_mode_invalid')
  return mode
}

const canonicalTaskBodyRequestV1 = (request) => {
  if (!exactKeys(request, CANONICAL_TASK_BODY_REQUEST_FIELDS)) {
    throw new Error('canonical_task_body_request_invalid')
  }
  let authorizedPaths
  try {
    authorizedPaths = normalizedPaths(request.authorized_paths)
  } catch {
    throw new Error('canonical_task_body_request_invalid')
  }
  if (
    typeof request.title !== 'string' || request.title.length === 0 || request.title.length > 256 ||
    request.title !== request.title.trim() || /[\u0000-\u001f\u007f]/u.test(request.title) ||
    !REPOSITORY.test(request.repository ?? '') ||
    typeof request.objective !== 'string' || request.objective.length === 0 || request.objective.length > 512 ||
    request.objective !== request.objective.trim() || /[\u0000-\u001f\u007f]/u.test(request.objective) ||
    typeof request.markdown !== 'string' || request.markdown.length === 0 || request.markdown.length > 32_768 ||
    request.markdown.endsWith('\n') || /[\r\u0000]/u.test(request.markdown) ||
    /(^|\n)```/u.test(request.markdown) || request.markdown.includes('System.Object[]') ||
    typeof request.head_branch !== 'string' || request.head_branch.length === 0 || request.head_branch.length > 255 ||
    /[\s\\\u0000-\u001f\u007f]/u.test(request.head_branch) || request.head_branch.startsWith('/') ||
    request.head_branch.endsWith('/') || request.head_branch.includes('//') || request.head_branch.includes('..') ||
    request.head_branch.includes('@{') ||
    typeof request.authorized_actor !== 'string' ||
    !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/u.test(request.authorized_actor) ||
    !['PULL_REQUEST_REVIEW', 'TASK_ISSUE_COMMENT'].includes(request.permitted_surface) ||
    request.ready_allowed !== false || request.product_owner_login !== 'whatrune'
  ) throw new Error('canonical_task_body_request_invalid')
  return Object.freeze({ ...request, authorized_paths: authorizedPaths })
}

const canonicalTaskIssueNumberV1 = ({ mode, taskIssue }) => {
  const admittedMode = canonicalTaskBodyModeV1(mode)
  if (admittedMode === 'UNBOUND_CREATE') {
    if (taskIssue !== null && taskIssue !== undefined && taskIssue !== 0) {
      throw new Error('canonical_task_body_binding_invalid')
    }
    return 0
  }
  if (!Number.isSafeInteger(taskIssue) || taskIssue < 1) throw new Error('canonical_task_body_binding_invalid')
  return taskIssue
}

const canonicalReviewPublicationPredelegationV2 = ({ request, taskIssue }) => {
  const taskUrl = `https://github.com/${request.repository}/issues/${taskIssue}`
  return Object.freeze({
    task_id: `TASK-${taskIssue}-REVIEW-PUBLICATION-PREDELEGATION`,
    record_type: 'task_assignment',
    authoring_role: 'Product Owner / Review Publication Predelegator',
    authority_source: taskUrl,
    canonical_record: taskUrl,
    prior_record_url: 'not_applicable',
    cumulative_scope: 'REVIEW_AUTHORITY_PUBLICATION_PREDELEGATION',
    supporting_records: 'not_applicable',
    requested_by: 'Product Owner',
    assigned_role: 'Protected Transition Consumer Host',
    purpose: 'Predelegate deterministic exact Review-publication assignment materialization after Fresh exact-HEAD approval.',
    background: 'The semantic Review result is a wake-up signal and is not publication authority.',
    input_documents: 'Shared Role Execution Contract, Delegation and Result Contract, Review Execution Contract, and Integrated Lead Charter.',
    allowed_changes: Object.freeze({
      protected_action: 'REVIEW_AUTHORITY_PUBLICATION',
      activation: 'FRESH_EXACT_HEAD_REVIEW_APPROVE',
      materialization_only: true,
      repository: request.repository,
      task_issue: taskIssue,
      head_branch: request.head_branch,
      authorized_paths: request.authorized_paths,
      authorized_actor: request.authorized_actor,
      permitted_surface: request.permitted_surface,
      required_review: Object.freeze({
        record_type: 'simplified_independent_review_v1',
        reviewer_role: 'INDEPENDENT_REVIEWER',
        decision: 'APPROVE',
        blocking: 0,
        remaining: 0,
        unknown: 0,
      }),
      operation_count: 1,
      fallback_allowed: false,
    }),
    forbidden_changes: REVIEW_PUBLICATION_PREDELEGATION_FORBIDDEN_CHANGES,
    expected_outputs: 'One admitted logical Review-publication assignment authority and one exact Review publication or zero-mutation reuse.',
    validation: 'Fresh GitHub state, deterministic logical identity, canonical semantic-payload equivalence, resource refetch equality, and fail-closed conflicts.',
    completion_conditions: 'One logical authority is admitted, one exact Review is published or reused, and pre-Decision preflight passes.',
    escalation_conditions: 'Any stale identity, blocker, unknown, conflict, malformed record, ambiguous mutation, or preflight failure.',
  })
}

const serializeFencedYamlJsonV1 = (value) => `\`\`\`yaml\n${JSON.stringify(value, null, 2)}\n\`\`\`\n`

const composeCanonicalTaskIssueBodyV1 = ({ markdown, taskAuthorityBody, predelegation }) => (
  `${markdown}\n\n${taskAuthorityBody}\n${serializeFencedYamlJsonV1(predelegation)}`
)

export const parseCanonicalTaskIssueBodyV1 = ({ body, mode }) => {
  const admittedMode = canonicalTaskBodyModeV1(mode)
  if (
    typeof body !== 'string' || body.length === 0 || body.length > 65_536 ||
    body.startsWith('\uFEFF') || body.includes('\r') || body.includes('\u0000') ||
    body.includes('System.Object[]') || !body.endsWith('\n') || body.endsWith('\n\n')
  ) throw new Error('canonical_task_body_invalid')
  const fenceLines = body.match(/^```(?:json|yaml)?$/gmu) ?? []
  if (fenceLines.join('\n') !== '```json\n```\n```yaml\n```') throw new Error('canonical_task_body_invalid')
  const authorityHeading = '# Simplified Lifecycle Task Authority'
  const headingMarker = `\n\n${authorityHeading}\n\n\`\`\`json\n`
  const headingIndex = body.indexOf(headingMarker)
  if (headingIndex < 1 || body.indexOf(headingMarker, headingIndex + 1) !== -1) {
    throw new Error('canonical_task_body_invalid')
  }
  const markdown = body.slice(0, headingIndex)
  canonicalTaskBodyRequestV1({
    title: 'parser-validation',
    repository: 'owner/repository',
    objective: 'parser-validation',
    markdown,
    authorized_paths: ['parser-validation'],
    head_branch: 'codex/parser-validation',
    authorized_actor: 'parser-validation',
    permitted_surface: 'TASK_ISSUE_COMMENT',
    ready_allowed: false,
    product_owner_login: 'whatrune',
  })
  const taskAuthority = parseSimplifiedTaskAuthorityV1(body, { binding_mode: admittedMode })
  const profiles = classifyReviewPublicationTaskAssignmentsV2(body)
  if (profiles.predelegation === null || profiles.exact_assignment !== null) {
    throw new Error('canonical_task_body_invalid')
  }
  const expected = composeCanonicalTaskIssueBodyV1({
    markdown,
    taskAuthorityBody: serializeSimplifiedTaskAuthorityV1(taskAuthority, { binding_mode: admittedMode }),
    predelegation: profiles.predelegation,
  })
  if (body !== expected) throw new Error('canonical_task_body_invalid')
  return Object.freeze({
    mode: admittedMode,
    markdown,
    task_authority: taskAuthority,
    review_publication_predelegation: profiles.predelegation,
  })
}

export const serializeCanonicalTaskIssueBodyV1 = ({ request, mode, taskIssue = null }) => {
  const admittedRequest = canonicalTaskBodyRequestV1(request)
  const admittedMode = canonicalTaskBodyModeV1(mode)
  const boundTaskIssue = canonicalTaskIssueNumberV1({ mode: admittedMode, taskIssue })
  const taskAuthority = Object.freeze({
    record_type: 'simplified_task_authority_v1',
    task_issue: boundTaskIssue,
    repository: admittedRequest.repository,
    objective: admittedRequest.objective,
    authorized_paths: admittedRequest.authorized_paths,
    ready_allowed: admittedRequest.ready_allowed,
    product_owner_login: admittedRequest.product_owner_login,
  })
  const body = composeCanonicalTaskIssueBodyV1({
    markdown: admittedRequest.markdown,
    taskAuthorityBody: serializeSimplifiedTaskAuthorityV1(taskAuthority, { binding_mode: admittedMode }),
    predelegation: canonicalReviewPublicationPredelegationV2({
      request: admittedRequest,
      taskIssue: boundTaskIssue,
    }),
  })
  parseCanonicalTaskIssueBodyV1({ body, mode: admittedMode })
  return body
}

const canonicalJsonCloneV1 = (value) => JSON.parse(JSON.stringify(value))

export const proveCanonicalTaskIssueSelfBindingDeltaV1 = ({
  request, unboundBody, boundBody, taskIssue,
}) => {
  const admittedRequest = canonicalTaskBodyRequestV1(request)
  if (
    unboundBody !== serializeCanonicalTaskIssueBodyV1({ request: admittedRequest, mode: 'UNBOUND_CREATE' }) ||
    boundBody !== serializeCanonicalTaskIssueBodyV1({
      request: admittedRequest, mode: 'BOUND_FINAL', taskIssue,
    })
  ) throw new Error('canonical_task_self_binding_delta_invalid')
  const unbound = parseCanonicalTaskIssueBodyV1({ body: unboundBody, mode: 'UNBOUND_CREATE' })
  const bound = parseCanonicalTaskIssueBodyV1({ body: boundBody, mode: 'BOUND_FINAL' })
  if (unbound.markdown !== bound.markdown) throw new Error('canonical_task_self_binding_delta_invalid')
  const neutralTask = canonicalJsonCloneV1(bound.task_authority)
  neutralTask.task_issue = 0
  const neutralPredelegation = canonicalJsonCloneV1(bound.review_publication_predelegation)
  neutralPredelegation.task_id = 'TASK-0-REVIEW-PUBLICATION-PREDELEGATION'
  neutralPredelegation.authority_source = `https://github.com/${admittedRequest.repository}/issues/0`
  neutralPredelegation.canonical_record = `https://github.com/${admittedRequest.repository}/issues/0`
  neutralPredelegation.allowed_changes.task_issue = 0
  if (
    JSON.stringify(neutralTask) !== JSON.stringify(unbound.task_authority) ||
    JSON.stringify(neutralPredelegation) !== JSON.stringify(unbound.review_publication_predelegation) ||
    !samePaths(bound.task_authority.authorized_paths, unbound.task_authority.authorized_paths) ||
    !samePaths(
      bound.review_publication_predelegation.allowed_changes.authorized_paths,
      unbound.review_publication_predelegation.allowed_changes.authorized_paths,
    )
  ) throw new Error('canonical_task_self_binding_delta_invalid')
  return Object.freeze({
    state: 'PASS',
    task_issue: taskIssue,
    changed_fields: CANONICAL_TASK_SELF_BINDING_FIELDS,
    unchanged_markdown_sha256: createHash('sha256').update(unbound.markdown, 'utf8').digest('hex'),
    authorized_paths: admittedRequest.authorized_paths,
  })
}

const assertCanonicalTaskIssueResourceV1 = ({ resource, request, taskIssue, body }) => {
  const expectedUrl = `https://github.com/${request.repository}/issues/${taskIssue}`
  if (
    resource === null || typeof resource !== 'object' || Array.isArray(resource) ||
    resource.number !== taskIssue || resource.title !== request.title || resource.body !== body ||
    resource.state !== 'open' || resource.pull_request !== undefined || resource.html_url !== expectedUrl ||
    resource.user === null || typeof resource.user !== 'object' || Array.isArray(resource.user) ||
    resource.user.login !== request.product_owner_login || resource.author_association !== 'OWNER'
  ) throw new Error('canonical_task_issue_resource_mismatch')
  return resource
}

export const publishCanonicalTaskIssueV1 = async ({ request, host }) => {
  const admittedRequest = canonicalTaskBodyRequestV1(request)
  if (
    host === null || typeof host !== 'object' || typeof host.api !== 'function' ||
    typeof host.createTaskIssue !== 'function' || typeof host.patchTaskIssueBody !== 'function'
  ) throw new Error('canonical_task_issue_host_invalid')
  const directory = mkdtempSync(join(tmpdir(), 'canonical-task-publication-'))
  const unboundPath = join(directory, 'unbound-create.md')
  const boundPath = join(directory, 'bound-final.md')
  let createMutationCount = 0
  let patchMutationCount = 0
  try {
    const authenticatedActor = await host.api('user')
    if (
      authenticatedActor === null || typeof authenticatedActor !== 'object' ||
      Array.isArray(authenticatedActor) || authenticatedActor.login !== admittedRequest.product_owner_login
    ) throw new Error('canonical_task_issue_actor_invalid')
    const unboundBody = serializeCanonicalTaskIssueBodyV1({
      request: admittedRequest,
      mode: 'UNBOUND_CREATE',
    })
    writeProtectedPublicationBodyFileV1({
      kind: 'canonical_task',
      body: unboundBody,
      outputFile: unboundPath,
      taskBindingMode: 'UNBOUND_CREATE',
    })
    const unboundBytes = readFileSync(unboundPath)
    const transportedUnboundBody = new TextDecoder('utf-8', { fatal: true }).decode(unboundBytes)
    if (transportedUnboundBody !== unboundBody) throw new Error('canonical_task_issue_transport_mismatch')

    createMutationCount += 1
    const created = await host.createTaskIssue({
      repository: admittedRequest.repository,
      title: admittedRequest.title,
      body: transportedUnboundBody,
    })
    if (!Number.isSafeInteger(created?.number) || created.number < 1) {
      throw new Error('canonical_task_issue_create_response_indeterminate')
    }
    const taskIssue = created.number
    assertCanonicalTaskIssueResourceV1({
      resource: created,
      request: admittedRequest,
      taskIssue,
      body: transportedUnboundBody,
    })
    const createdRefetch = await host.api(`repos/${admittedRequest.repository}/issues/${taskIssue}`)
    assertCanonicalTaskIssueResourceV1({
      resource: createdRefetch,
      request: admittedRequest,
      taskIssue,
      body: transportedUnboundBody,
    })

    const boundBody = serializeCanonicalTaskIssueBodyV1({
      request: admittedRequest,
      mode: 'BOUND_FINAL',
      taskIssue,
    })
    const delta = proveCanonicalTaskIssueSelfBindingDeltaV1({
      request: admittedRequest,
      unboundBody: transportedUnboundBody,
      boundBody,
      taskIssue,
    })
    writeProtectedPublicationBodyFileV1({
      kind: 'canonical_task',
      body: boundBody,
      outputFile: boundPath,
      taskBindingMode: 'BOUND_FINAL',
    })
    const boundBytes = readFileSync(boundPath)
    const transportedBoundBody = new TextDecoder('utf-8', { fatal: true }).decode(boundBytes)
    if (transportedBoundBody !== boundBody) throw new Error('canonical_task_issue_transport_mismatch')

    patchMutationCount += 1
    const patched = await host.patchTaskIssueBody({
      repository: admittedRequest.repository,
      taskIssue,
      body: transportedBoundBody,
    })
    assertCanonicalTaskIssueResourceV1({
      resource: patched,
      request: admittedRequest,
      taskIssue,
      body: transportedBoundBody,
    })
    const patchedRefetch = await host.api(`repos/${admittedRequest.repository}/issues/${taskIssue}`)
    assertCanonicalTaskIssueResourceV1({
      resource: patchedRefetch,
      request: admittedRequest,
      taskIssue,
      body: transportedBoundBody,
    })
    const finalBody = parseCanonicalTaskIssueBodyV1({ body: patchedRefetch.body, mode: 'BOUND_FINAL' })
    if (
      finalBody.task_authority.task_issue !== taskIssue ||
      finalBody.review_publication_predelegation.task_id !== `TASK-${taskIssue}-REVIEW-PUBLICATION-PREDELEGATION` ||
      finalBody.review_publication_predelegation.allowed_changes.task_issue !== taskIssue ||
      !samePaths(finalBody.task_authority.authorized_paths, admittedRequest.authorized_paths) ||
      !samePaths(
        finalBody.review_publication_predelegation.allowed_changes.authorized_paths,
        admittedRequest.authorized_paths,
      )
    ) throw new Error('canonical_task_issue_final_admission_invalid')
    return Object.freeze({
      state: 'COMPLETED',
      task_issue: taskIssue,
      task_url: patchedRefetch.html_url,
      create_mutation_count: createMutationCount,
      patch_mutation_count: patchMutationCount,
      task_authority_count: 1,
      review_publication_predelegation_count: 1,
      authorized_paths: admittedRequest.authorized_paths,
      unbound_body_sha256: createHash('sha256').update(unboundBytes).digest('hex'),
      final_body_sha256: createHash('sha256').update(boundBytes).digest('hex'),
      self_binding_delta: delta,
    })
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

const isReviewPublicationAssignmentCommentCandidateV2 = (body) => (
  typeof body === 'string' && body.length > 0 && body.length <= 65_536 &&
  [...body.matchAll(/```yaml\r?\n([\s\S]*?)\r?\n```/gu)].some((block) => (
    block[1].includes('record_type') && block[1].includes('task_assignment') &&
    block[1].includes('REVIEW_AUTHORITY_PUBLICATION')
  ))
)

const validateReviewPublicationAssignmentCommonV2 = ({ assignment, task, taskUrl }) => {
  if (
    task?.task_author !== 'whatrune' || task?.task_author_association !== 'OWNER' ||
    assignment.record_type !== 'task_assignment' || assignment.authority_source !== taskUrl ||
    assignment.supporting_records !== 'not_applicable' || assignment.requested_by !== 'Product Owner' ||
    assignment.assigned_role !== 'Protected Transition Consumer Host' ||
    !nonEmptyText(assignment.purpose) || !nonEmptyText(assignment.background) ||
    !nonEmptyText(assignment.input_documents) || !nonEmptyText(assignment.expected_outputs) ||
    !nonEmptyText(assignment.validation) || !nonEmptyText(assignment.completion_conditions) ||
    !nonEmptyText(assignment.escalation_conditions) || !Array.isArray(assignment.forbidden_changes)
  ) throw new Error('review_publication_authority_invalid')
}

const parseReviewPublicationPredelegationV2 = ({ profiles, request, task, actor, surface }) => {
  const assignment = profiles.predelegation
  if (assignment === null) throw new Error('review_publication_predelegation_required')
  const grant = assignment.allowed_changes
  if (!exactKeys(grant.required_review, REVIEW_PUBLICATION_PREDELEGATION_REVIEW_FIELDS)) {
    throw new Error('review_publication_authority_malformed')
  }
  const taskUrl = `https://github.com/${request.repository}/issues/${request.task_issue}`
  validateReviewPublicationAssignmentCommonV2({ assignment, task, taskUrl })
  const review = parseSimplifiedReviewV1(request.review_body)
  const required = grant.required_review
  if (
    assignment.task_id !== `TASK-${request.task_issue}-REVIEW-PUBLICATION-PREDELEGATION` ||
    assignment.authoring_role !== 'Product Owner / Review Publication Predelegator' ||
    assignment.canonical_record !== taskUrl || assignment.prior_record_url !== 'not_applicable' ||
    assignment.cumulative_scope !== 'REVIEW_AUTHORITY_PUBLICATION_PREDELEGATION' ||
    assignment.forbidden_changes.join('\n') !== REVIEW_PUBLICATION_PREDELEGATION_FORBIDDEN_CHANGES.join('\n') ||
    grant.activation !== 'FRESH_EXACT_HEAD_REVIEW_APPROVE' || grant.materialization_only !== true ||
    grant.repository !== request.repository || grant.task_issue !== request.task_issue ||
    grant.head_branch !== task.head_branch || !samePaths(grant.authorized_paths, request.authorized_paths) ||
    grant.authorized_actor !== actor.login || grant.permitted_surface !== surface ||
    required.record_type !== review.record_type || required.reviewer_role !== review.reviewer_role ||
    required.decision !== review.decision || required.blocking !== review.blocking ||
    required.remaining !== review.remaining || required.unknown !== review.unknown ||
    grant.operation_count !== 1 || grant.fallback_allowed !== false
  ) throw new Error('review_publication_predelegation_invalid')
  return Object.freeze({ task_id: assignment.task_id, canonical_record: taskUrl })
}

const parseReviewPublicationTaskAssignmentV2 = ({
  assignment, request, task, actor, surface, resource = null,
}) => {
  if (assignment === null) return null
  const grant = assignment.allowed_changes
  const resourceDerived = assignment.canonical_record === 'GITHUB_RESOURCE'
  if (
    resourceDerived !== (resource !== null) ||
    !exactKeys(grant, resourceDerived ? RESOURCE_REVIEW_PUBLICATION_GRANT_FIELDS : REVIEW_PUBLICATION_GRANT_FIELDS)
  ) throw new Error('review_publication_authority_malformed')
  const taskUrl = `https://github.com/${request.repository}/issues/${request.task_issue}`
  validateReviewPublicationAssignmentCommonV2({ assignment, task, taskUrl })
  let reviewBody
  try { reviewBody = serializeSimplifiedReviewV1(grant.review) } catch {
    throw new Error('review_publication_authority_invalid')
  }
  if (
    assignment.task_id !== `TASK-${request.task_issue}-REVIEW-AUTHORITY-PUBLICATION` ||
    assignment.authoring_role !== 'Product Owner / Review Publication Authorizer' ||
    assignment.cumulative_scope !== 'REVIEW_AUTHORITY_PUBLICATION' ||
    assignment.forbidden_changes.join('\n') !== REVIEW_PUBLICATION_FORBIDDEN_CHANGES.join('\n') ||
    grant.repository !== request.repository || grant.task_issue !== request.task_issue ||
    grant.pull_request !== request.pull_request || grant.protected_action !== 'REVIEW_AUTHORITY_PUBLICATION' ||
    grant.authorized_actor !== actor.login || grant.permitted_surface !== surface ||
    grant.operation_count !== 1 || grant.fallback_allowed !== false ||
    (resourceDerived && grant.predelegation_task_id !== `TASK-${request.task_issue}-REVIEW-PUBLICATION-PREDELEGATION`) ||
    (!resourceDerived && (
      assignment.canonical_record !== taskUrl || assignment.prior_record_url !== 'not_applicable'
    )) ||
    (resourceDerived && assignment.prior_record_url !== taskUrl)
  ) throw new Error('review_publication_authority_invalid')
  if (!resourceDerived && (
    grant.exact_head !== request.exact_head || grant.expected_base !== request.expected_base ||
    grant.head_branch !== task.head_branch || !samePaths(grant.authorized_paths, request.authorized_paths) ||
    reviewBody !== request.review_body
  )) throw new Error('review_publication_authority_invalid')
  if (resourceDerived) {
    const expectedUrl = `https://github.com/${request.repository}/issues/${request.task_issue}#issuecomment-${resource?.id}`
    if (
      !Number.isSafeInteger(resource?.id) || resource.id < 1 || resource.html_url !== expectedUrl ||
      resource.issue_url !== `https://api.github.com/repos/${request.repository}/issues/${request.task_issue}` ||
      resource.user?.login !== actor.login || resource.author_association !== 'OWNER'
    ) throw new Error('review_publication_authority_identity_invalid')
  }
  return Object.freeze({
    assignment,
    logical_identity: projectReviewPublicationLogicalAssignmentIdentityV2(grant),
    semantic_payload: projectReviewPublicationLogicalAssignmentSemanticPayloadV2(assignment),
    exact_head: grant.exact_head,
    expected_base: grant.expected_base,
    head_branch: grant.head_branch,
    authorized_paths: Object.freeze([...grant.authorized_paths]),
    review_body: reviewBody,
    canonical_record: resourceDerived ? resource.html_url : taskUrl,
  })
}

export const projectReviewPublicationLogicalAssignmentIdentityV2 = (grant) => Object.freeze({
  repository: grant.repository,
  task_issue: grant.task_issue,
  pull_request: grant.pull_request,
  exact_head: grant.exact_head,
  protected_action: grant.protected_action,
  authorized_actor: grant.authorized_actor,
  permitted_surface: grant.permitted_surface,
  decision: Object.freeze({
    record_type: grant.review?.record_type,
    reviewer_role: grant.review?.reviewer_role,
    decision: grant.review?.decision,
    blocking: grant.review?.blocking,
    remaining: grant.review?.remaining,
    unknown: grant.review?.unknown,
  }),
})

export const projectReviewPublicationLogicalAssignmentSemanticPayloadV2 = (assignment) => Object.freeze({
  ...assignment,
  allowed_changes: Object.freeze({
    ...assignment.allowed_changes,
    authorized_paths: Object.freeze([...assignment.allowed_changes.authorized_paths]),
    review: Object.freeze({ ...assignment.allowed_changes.review }),
  }),
  forbidden_changes: Object.freeze([...assignment.forbidden_changes]),
})

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

const exactReviewPublicationAssignmentV2 = ({ request, task, actor, surface, predelegation }) => {
  const taskUrl = `https://github.com/${request.repository}/issues/${request.task_issue}`
  return Object.freeze({
    task_id: `TASK-${request.task_issue}-REVIEW-AUTHORITY-PUBLICATION`,
    record_type: 'task_assignment',
    authoring_role: 'Product Owner / Review Publication Authorizer',
    authority_source: taskUrl,
    canonical_record: 'GITHUB_RESOURCE',
    prior_record_url: taskUrl,
    cumulative_scope: 'REVIEW_AUTHORITY_PUBLICATION',
    supporting_records: 'not_applicable',
    requested_by: 'Product Owner',
    assigned_role: 'Protected Transition Consumer Host',
    purpose: 'Authorize one exact Review authority publication.',
    background: 'Fresh semantic Review completed for the exact current PR HEAD.',
    input_documents: 'Shared Role Execution Contract, Delegation and Result Contract, and Review Execution Contract.',
    allowed_changes: Object.freeze({
      protected_action: 'REVIEW_AUTHORITY_PUBLICATION',
      repository: request.repository,
      task_issue: request.task_issue,
      pull_request: request.pull_request,
      exact_head: request.exact_head,
      head_branch: task.head_branch,
      expected_base: request.expected_base,
      authorized_paths: request.authorized_paths,
      authorized_actor: actor.login,
      permitted_surface: surface,
      review: request.review_input,
      operation_count: 1,
      fallback_allowed: false,
      predelegation_task_id: predelegation.task_id,
    }),
    forbidden_changes: REVIEW_PUBLICATION_FORBIDDEN_CHANGES,
    expected_outputs: 'One exact Review authority publication and refetched completion record.',
    validation: 'Exact live binding, logical equivalence, resource identity, and refetch equality.',
    completion_conditions: 'One logical Review-publication authority or zero-mutation Review reuse.',
    escalation_conditions: 'Any authority, identity, surface, logical conflict, or publication mismatch.',
  })
}

const serializeReviewPublicationAssignmentCommentV2 = (assignment) => (
  `\`\`\`yaml\n${JSON.stringify(assignment, null, 2)}\n\`\`\`\n`
)

const acquireCurrentReviewPublicationAssignmentsV2 = async ({
  host, request, task, actor, surface, taskProfiles,
}) => {
  const comments = await acquirePagedItems({
    host,
    route: `repos/${request.repository}/issues/${request.task_issue}/comments`,
  })
  const records = []
  const legacy = parseReviewPublicationTaskAssignmentV2({
    assignment: taskProfiles.exact_assignment,
    request,
    task,
    actor,
    surface,
  })
  if (legacy !== null) records.push(legacy)
  for (const listed of comments) {
    if (!isReviewPublicationAssignmentCommentCandidateV2(listed?.body)) continue
    if (!Number.isSafeInteger(listed?.id) || listed.id < 1) {
      throw new Error('review_publication_authority_identity_invalid')
    }
    const resource = await host.api(`repos/${request.repository}/issues/comments/${listed.id}`)
    if (
      resource?.id !== listed.id || resource?.html_url !== listed.html_url || resource?.body !== listed.body ||
      resource?.user?.login !== listed?.user?.login
    ) throw new Error('review_publication_authority_refetch_mismatch')
    const profiles = classifyReviewPublicationTaskAssignmentsV2(resource.body)
    if (profiles.predelegation !== null || profiles.exact_assignment === null) {
      throw new Error('review_publication_authority_malformed')
    }
    records.push(parseReviewPublicationTaskAssignmentV2({
      assignment: profiles.exact_assignment,
      request,
      task,
      actor,
      surface,
      resource,
    }))
  }

  const targetAssignment = exactReviewPublicationAssignmentV2({
    request,
    task,
    actor,
    surface,
    predelegation: { task_id: `TASK-${request.task_issue}-REVIEW-PUBLICATION-PREDELEGATION` },
  })
  const targetIdentity = JSON.stringify(projectReviewPublicationLogicalAssignmentIdentityV2(targetAssignment.allowed_changes))
  const targetFamily = JSON.stringify({
    repository: request.repository,
    task_issue: request.task_issue,
    pull_request: request.pull_request,
    exact_head: request.exact_head,
    protected_action: 'REVIEW_AUTHORITY_PUBLICATION',
  })
  const applicable = []
  for (const record of records) {
    const family = JSON.stringify({
      repository: record.assignment.allowed_changes.repository,
      task_issue: record.assignment.allowed_changes.task_issue,
      pull_request: record.assignment.allowed_changes.pull_request,
      exact_head: record.assignment.allowed_changes.exact_head,
      protected_action: record.assignment.allowed_changes.protected_action,
    })
    if (family !== targetFamily) continue
    if (JSON.stringify(record.logical_identity) !== targetIdentity) {
      throw new Error('review_publication_authority_conflict')
    }
    applicable.push(record)
  }
  if (applicable.length === 0) return Object.freeze([])
  const payloads = new Set(applicable.map((record) => JSON.stringify(record.semantic_payload)))
  if (payloads.size !== 1) throw new Error('review_publication_authority_conflict')
  const first = applicable[0]
  if (
    first.exact_head !== request.exact_head || first.expected_base !== request.expected_base ||
    first.head_branch !== task.head_branch || !samePaths(first.authorized_paths, request.authorized_paths) ||
    first.review_body !== request.review_body
  ) throw new Error('review_publication_authority_conflict')
  const resources = Object.freeze(applicable.map((record) => record.canonical_record).sort())
  return Object.freeze([Object.freeze({
    ...first,
    canonical_record: resources[0],
    equivalent_resource_count: resources.length,
    equivalent_resources: resources,
  })])
}

const reviewAuthorityFromResource = ({ kind, resource, request, pull, expectedBody }) => {
  if (
    typeof resource?.body !== 'string' ||
    ![...resource.body.matchAll(/```json\r?\n([\s\S]*?)\r?\n```/gu)]
      .some((block) => block[1].includes(REVIEW_RECORD_MARKER))
  ) return null
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
    typeof host.publishPullRequestReview !== 'function' || typeof host.publishTaskIssueComment !== 'function' ||
    typeof host.publishTaskAssignmentComment !== 'function'
  ) throw new Error('review_publication_host_invalid')

  const acquireLiveBinding = async () => {
    const [actor, snapshot] = await Promise.all([
      host.api('user'),
      acquireSimplifiedReviewPublicationPreflightV2({
        request: {
          repository: request.repository,
          task_issue: request.task_issue,
          pull_request: request.pull_request,
          exact_head: request.exact_head,
          expected_base: request.expected_base,
          authorized_paths: request.authorized_paths,
        },
        host,
      }),
    ])
    if (typeof actor?.login !== 'string' || actor.login.length === 0) {
      throw new Error('review_publication_live_binding_invalid')
    }
    return Object.freeze({ actor, ...snapshot })
  }
  const reviewPull = (live) => Object.freeze({ user: Object.freeze({ login: live.pull_author }) })
  const routeFor = (live) => (
    live.actor.login === live.pull_author ? 'TASK_ISSUE_COMMENT' : 'PULL_REQUEST_REVIEW'
  )
  const admitPredelegation = (live, surface) => {
    const profiles = classifyReviewPublicationTaskAssignmentsV2(live.task_body)
    const predelegation = parseReviewPublicationPredelegationV2({
      profiles,
      request,
      task: live,
      actor: live.actor,
      surface,
    })
    return Object.freeze({ profiles, predelegation })
  }
  const acquireAssignments = (live, surface, profiles) => acquireCurrentReviewPublicationAssignmentsV2({
    host,
    request,
    task: live,
    actor: live.actor,
    surface,
    taskProfiles: profiles,
  })
  const acquireReviews = (live) => acquireCurrentReviewAuthorities({
    host,
    request,
    pull: reviewPull(live),
    expectedBody: request.review_body,
  })

  let live = await acquireLiveBinding()
  let publicationRoute = routeFor(live)
  const publicationActor = live.actor.login
  let authorities = await acquireReviews(live)
  let assignmentMutationCount = 0
  let publicationMutationCount = 0
  let publicationAuthority = null

  if (authorities.length === 0) {
    let profiles = classifyReviewPublicationTaskAssignmentsV2(live.task_body)
    let assignments = await acquireAssignments(live, publicationRoute, profiles)
    let admitted = null

    if (assignments.length === 0) {
      admitted = admitPredelegation(live, publicationRoute)
      live = await acquireLiveBinding()
      const reboundRoute = routeFor(live)
      if (reboundRoute !== publicationRoute) throw new Error('review_assignment_materialization_final_binding_invalid')
      admitted = admitPredelegation(live, publicationRoute)
      profiles = admitted.profiles
      authorities = await acquireReviews(live)
      assignments = authorities.length === 0
        ? await acquireAssignments(live, publicationRoute, profiles)
        : Object.freeze([])

      if (authorities.length === 0 && assignments.length === 0) {
        const assignment = exactReviewPublicationAssignmentV2({
          request,
          task: live,
          actor: live.actor,
          surface: publicationRoute,
          predelegation: admitted.predelegation,
        })
        const body = serializeReviewPublicationAssignmentCommentV2(assignment)
        assignmentMutationCount = 1
        const resource = await host.publishTaskAssignmentComment({
          repository: request.repository,
          taskIssue: request.task_issue,
          body,
        })
        const expectedUrl = `https://github.com/${request.repository}/issues/${request.task_issue}#issuecomment-${resource?.id}`
        if (
          !Number.isSafeInteger(resource?.id) || resource.id < 1 || resource.html_url !== expectedUrl ||
          resource.body !== body || resource.user?.login !== live.actor.login
        ) throw new Error('review_assignment_materialization_response_invalid')
        const refetched = await host.api(`repos/${request.repository}/issues/comments/${resource.id}`)
        if (
          refetched?.id !== resource.id || refetched?.html_url !== resource.html_url ||
          refetched?.body !== body || refetched?.user?.login !== live.actor.login
        ) throw new Error('review_assignment_materialization_refetch_mismatch')
        const refetchedProfiles = classifyReviewPublicationTaskAssignmentsV2(refetched.body)
        if (refetchedProfiles.predelegation !== null || refetchedProfiles.exact_assignment === null) {
          throw new Error('review_assignment_materialization_refetch_mismatch')
        }
        parseReviewPublicationTaskAssignmentV2({
          assignment: refetchedProfiles.exact_assignment,
          request,
          task: live,
          actor: live.actor,
          surface: publicationRoute,
          resource: refetched,
        })
        assignments = await acquireAssignments(live, publicationRoute, profiles)
        if (assignments.length !== 1 || !assignments[0].equivalent_resources.includes(expectedUrl)) {
          throw new Error('review_assignment_materialization_refetch_mismatch')
        }
      }
    }
    if (authorities.length === 0) {
      if (assignments.length !== 1) throw new Error('review_publication_authority_required')
      publicationAuthority = assignments[0]
    }
  }

  try {
    live = await acquireLiveBinding()
  } catch {
    throw new Error('review_publication_final_binding_invalid')
  }
  if (authorities.length === 0 && live.actor.login !== publicationActor) {
    throw new Error('review_publication_authority_invalid')
  }
  if (authorities.length === 0 && routeFor(live) !== publicationRoute) {
    throw new Error('review_publication_final_binding_invalid')
  }
  authorities = await acquireReviews(live)
  if (authorities.length === 0) {
    const profiles = classifyReviewPublicationTaskAssignmentsV2(live.task_body)
    const assignments = await acquireAssignments(live, publicationRoute, profiles)
    if (assignments.length !== 1) throw new Error('review_publication_authority_required')
    publicationAuthority = assignments[0]
    if (publicationAuthority.assignment.canonical_record === 'GITHUB_RESOURCE') {
      admitPredelegation(live, publicationRoute)
    }

    publicationMutationCount = 1
    const taskSurface = publicationRoute === 'TASK_ISSUE_COMMENT'
    const resource = taskSurface
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
    const route = taskSurface
      ? `repos/${request.repository}/issues/comments/${resource.id}`
      : `repos/${request.repository}/pulls/${request.pull_request}/reviews/${resource.id}`
    const refetched = await host.api(route)
    if (refetched?.user?.login !== live.actor.login) throw new Error('review_publication_refetch_mismatch')
    reviewAuthorityFromResource({
      kind: publicationRoute,
      resource: refetched,
      request,
      pull: reviewPull(live),
      expectedBody: request.review_body,
    })
    authorities = await acquireReviews(live)
    if (authorities.length !== 1 || authorities[0].review_id !== resource.id) {
      throw new Error('review_publication_refetch_mismatch')
    }
  } else {
    publicationRoute = 'REUSED'
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
    assignment_materialization_mutation_count: assignmentMutationCount,
    logical_assignment_resource_count: publicationAuthority?.equivalent_resource_count ?? 0,
    publication_mutation_count: publicationMutationCount,
    review_kind: authority.review_kind,
    review_id: authority.review_id,
    review_url: authority.review_url,
    exact_head: request.exact_head,
    publication_authority_record: publicationAuthority?.canonical_record ?? null,
    preflight,
  })
}

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'))
if (process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const canonicalTaskBodyFile = valueAfter('--serialize-canonical-task-body-file')
  const serializeMode = valueAfter('--serialize-task-authority-file') !== null
    ? ['task', valueAfter('--serialize-task-authority-file')]
    : valueAfter('--serialize-review-file') !== null
      ? ['review', valueAfter('--serialize-review-file')]
      : valueAfter('--serialize-merge-decision-file') !== null
        ? ['merge', valueAfter('--serialize-merge-decision-file')]
        : null

  if (canonicalTaskBodyFile !== null) {
    const mode = valueAfter('--canonical-task-body-mode')
    const taskIssueText = valueAfter('--task-issue')
    const taskIssue = taskIssueText === null ? null : Number(taskIssueText)
    const body = serializeCanonicalTaskIssueBodyV1({
      request: readJson(canonicalTaskBodyFile),
      mode,
      taskIssue,
    })
    const publicationOutputFile = valueAfter('--publication-body-output-file')
    if (publicationOutputFile === null) throw new Error('publication_transport_output_file_required')
    const result = writeProtectedPublicationBodyFileV1({
      kind: 'canonical_task',
      body,
      outputFile: publicationOutputFile,
      taskBindingMode: mode,
    })
    process.stdout.write(`${JSON.stringify(result)}\n`)
  } else if (serializeMode !== null) {
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
    const canonicalTaskPublicationFile = valueAfter('--create-canonical-task-issue-file')
    const reviewAuthorityPreflightFile = valueAfter('--ensure-review-authority-and-run-preflight-file')
    const preDecisionPreflightFile = valueAfter('--pre-decision-preflight-file')
    if (canonicalTaskPublicationFile !== null) {
      const result = await publishCanonicalTaskIssueV1({
        request: readJson(canonicalTaskPublicationFile),
        host: createProductionHostV1(),
      })
      process.stdout.write(`${JSON.stringify(result)}\n`)
      process.exitCode = 0
    } else if (reviewAuthorityPreflightFile !== null) {
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
