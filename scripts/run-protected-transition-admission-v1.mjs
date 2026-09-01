import {
  closeSync,
  fsyncSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeSync,
} from 'node:fs'
import { pathToFileURL } from 'node:url'
import { parseDocument } from 'yaml'
import { projectAutomatedReviewToMergeReadyContinuationV1 } from './task-execution-context-v1.mjs'
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
  'head_branch', 'authorized_paths', 'review_thread_id', 'review_host_id',
  'review_input', 'fresh_review_terminal',
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
  'predelegation_task_id', 'fresh_review_terminal_cursor',
])
const REVIEW_PUBLICATION_PREDELEGATION_GRANT_FIELDS = Object.freeze([
  'protected_action', 'activation', 'materialization_only', 'repository',
  'task_issue', 'head_branch', 'authorized_paths', 'authorized_actor',
  'permitted_surface', 'required_review', 'operation_count', 'fallback_allowed',
])
const REVIEW_PUBLICATION_PREDELEGATION_REVIEW_FIELDS = Object.freeze([
  'record_type', 'reviewer_role', 'decision', 'blocking', 'remaining', 'unknown',
])
const FRESH_REVIEW_TERMINAL_FIELDS = Object.freeze([
  'wait_terminal', 'terminal_kind', 'observed_at', 'terminal_cursor',
  'prior_consumed_cursor', 'consumed_cursor', 'repository', 'task_issue',
  'pull_request', 'exact_head', 'expected_base', 'head_branch',
  'authorized_paths', 'review_input', 'thread_id', 'host_id',
])
const REVIEW_PUBLICATION_FORBIDDEN_CHANGES = Object.freeze([
  'alternate_surface_fallback', 'merge', 'retry',
])
const REVIEW_PUBLICATION_PREDELEGATION_FORBIDDEN_CHANGES = Object.freeze([
  'review_publication_before_fresh_approval', 'alternate_surface_fallback', 'merge', 'retry',
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
  publishTaskAssignmentComment: async ({ repository, taskIssue, body }) => {
    if (
      !REPOSITORY.test(repository ?? '') || !Number.isSafeInteger(taskIssue) || taskIssue < 1 ||
      typeof body !== 'string' || body.length === 0 || body.length > 65_536
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

const classifyReviewPublicationTaskAssignmentsV1 = (body) => {
  if (typeof body !== 'string' || body.length === 0 || body.length > 65_536) {
    throw new Error('review_publication_authority_required')
  }
  const blocks = [...body.matchAll(/```yaml\r?\n([\s\S]*?)\r?\n```/gu)]
  const candidates = blocks.filter((block) => block[1].includes('REVIEW_AUTHORITY_PUBLICATION'))
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

const isReviewPublicationAssignmentCommentCandidateV1 = (body) => {
  if (typeof body !== 'string' || body.length === 0 || body.length > 65_536) return false
  const blocks = [...body.matchAll(/```yaml\r?\n([\s\S]*?)\r?\n```/gu)]
  return blocks.some((block) => (
    /^\s*["']?record_type["']?\s*:\s*["']?task_assignment["']?/mu.test(block[1]) &&
    /^\s*["']?protected_action["']?\s*:\s*["']?REVIEW_AUTHORITY_PUBLICATION["']?/mu.test(block[1])
  ))
}

const validateReviewPublicationAssignmentCommonV1 = ({ assignment, task, taskUrl }) => {
  const priorRecordValid = assignment.prior_record_url === 'not_applicable' ||
    /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/issues\/[1-9][0-9]*$/u.test(
      assignment.prior_record_url ?? '',
    )
  if (
    task?.user?.login !== 'whatrune' || task?.author_association !== 'OWNER' ||
    assignment.record_type !== 'task_assignment' || assignment.authority_source !== taskUrl ||
    !priorRecordValid || assignment.supporting_records !== 'not_applicable' ||
    assignment.requested_by !== 'Product Owner' ||
    assignment.assigned_role !== 'Protected Transition Consumer Host' ||
    !nonEmptyText(assignment.purpose) || !nonEmptyText(assignment.background) ||
    !nonEmptyText(assignment.input_documents) || !nonEmptyText(assignment.expected_outputs) ||
    !nonEmptyText(assignment.validation) || !nonEmptyText(assignment.completion_conditions) ||
    !nonEmptyText(assignment.escalation_conditions) || !Array.isArray(assignment.forbidden_changes)
  ) throw new Error('review_publication_authority_invalid')
}

const parseReviewPublicationPredelegationV1 = ({ profiles, request, task, pull, actor, surface }) => {
  const assignment = profiles.predelegation
  if (assignment === null) throw new Error('review_publication_predelegation_required')
  const grant = assignment.allowed_changes
  if (!exactKeys(grant.required_review, REVIEW_PUBLICATION_PREDELEGATION_REVIEW_FIELDS)) {
    throw new Error('review_publication_authority_malformed')
  }
  const taskUrl = `https://github.com/${request.repository}/issues/${request.task_issue}`
  validateReviewPublicationAssignmentCommonV1({ assignment, task, taskUrl })
  const expectedReview = parseSimplifiedReviewV1(request.review_body)
  const requiredReview = grant.required_review
  if (
    assignment.task_id !== `TASK-${request.task_issue}-REVIEW-PUBLICATION-PREDELEGATION` ||
    assignment.authoring_role !== 'Product Owner / Review Publication Predelegator' ||
    assignment.canonical_record !== taskUrl ||
    assignment.cumulative_scope !== 'REVIEW_AUTHORITY_PUBLICATION_PREDELEGATION' ||
    assignment.forbidden_changes.join('\n') !== REVIEW_PUBLICATION_PREDELEGATION_FORBIDDEN_CHANGES.join('\n') ||
    grant.activation !== 'FRESH_EXACT_HEAD_REVIEW_APPROVE' || grant.materialization_only !== true ||
    grant.repository !== request.repository || grant.task_issue !== request.task_issue ||
    grant.head_branch !== pull?.head?.ref || !samePaths(grant.authorized_paths, request.authorized_paths) ||
    grant.authorized_actor !== actor?.login || grant.permitted_surface !== surface ||
    requiredReview.record_type !== expectedReview.record_type ||
    requiredReview.reviewer_role !== expectedReview.reviewer_role ||
    requiredReview.decision !== expectedReview.decision || requiredReview.blocking !== expectedReview.blocking ||
    requiredReview.remaining !== expectedReview.remaining || requiredReview.unknown !== expectedReview.unknown ||
    grant.operation_count !== 1 || grant.fallback_allowed !== false
  ) throw new Error('review_publication_predelegation_invalid')
  return Object.freeze({
    task_id: assignment.task_id,
    canonical_record: taskUrl,
    authorized_actor: grant.authorized_actor,
    permitted_surface: grant.permitted_surface,
  })
}

const parseReviewPublicationTaskAssignmentV1 = ({
  assignment, request, task, pull, actor, surface, resource = null,
}) => {
  if (assignment === null) return null
  const grant = assignment.allowed_changes
  const resourceDerived = assignment.canonical_record === 'GITHUB_RESOURCE'
  if (
    resourceDerived !== (resource !== null) ||
    !exactKeys(grant, resourceDerived ? RESOURCE_REVIEW_PUBLICATION_GRANT_FIELDS : REVIEW_PUBLICATION_GRANT_FIELDS)
  ) throw new Error('review_publication_authority_malformed')

  const taskUrl = `https://github.com/${request.repository}/issues/${request.task_issue}`
  validateReviewPublicationAssignmentCommonV1({ assignment, task, taskUrl })
  let serializedReview
  try {
    serializedReview = serializeSimplifiedReviewV1(grant.review)
  } catch {
    throw new Error('review_publication_authority_invalid')
  }
  if (
    assignment.task_id !== `TASK-${request.task_issue}-REVIEW-AUTHORITY-PUBLICATION` ||
    assignment.authoring_role !== 'Product Owner / Review Publication Authorizer' ||
    (!resourceDerived && assignment.canonical_record !== taskUrl) ||
    assignment.cumulative_scope !== 'REVIEW_AUTHORITY_PUBLICATION' ||
    assignment.forbidden_changes.join('\n') !== REVIEW_PUBLICATION_FORBIDDEN_CHANGES.join('\n') ||
    grant.protected_action !== 'REVIEW_AUTHORITY_PUBLICATION' || grant.operation_count !== 1 ||
    grant.fallback_allowed !== false ||
    (resourceDerived && (
      grant.predelegation_task_id !== `TASK-${request.task_issue}-REVIEW-PUBLICATION-PREDELEGATION` ||
      !nonEmptyText(grant.fresh_review_terminal_cursor)
    ))
  ) throw new Error('review_publication_authority_invalid')

  if (resourceDerived) {
    const expectedUrl = `https://github.com/${request.repository}/issues/${request.task_issue}#issuecomment-${resource?.id}`
    if (
      !Number.isSafeInteger(resource?.id) || resource.id < 1 || resource.html_url !== expectedUrl ||
      resource.issue_url !== `https://api.github.com/repos/${request.repository}/issues/${request.task_issue}` ||
      resource.body !== `\`\`\`yaml\n${JSON.stringify(assignment, null, 2)}\n\`\`\`\n` ||
      resource.user?.login !== actor?.login || !REVIEWER_ASSOCIATIONS.has(resource.author_association)
    ) throw new Error('review_assignment_materialization_refetch_mismatch')
  }

  if (
    grant.repository !== request.repository || grant.task_issue !== request.task_issue ||
    grant.pull_request !== request.pull_request || grant.head_branch !== pull?.head?.ref ||
    !samePaths(grant.authorized_paths, request.authorized_paths) ||
    grant.authorized_actor !== actor?.login || grant.permitted_surface !== surface
  ) throw new Error('review_publication_authority_invalid')

  const applicable = (
    grant.exact_head === request.exact_head && grant.expected_base === request.expected_base &&
    serializedReview === request.review_body &&
    (!resourceDerived || grant.fresh_review_terminal_cursor === request.fresh_review_terminal.terminal_cursor)
  )
  if (!applicable) return null

  return Object.freeze({
    canonical_record: resourceDerived ? resource.html_url : taskUrl,
    authorized_actor: grant.authorized_actor,
    permitted_surface: grant.permitted_surface,
    resource_id: resourceDerived ? resource.id : null,
  })
}

const exactReviewPublicationAssignmentV1 = ({ request, pull, actor, surface, predelegation }) => {
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
      head_branch: pull.head.ref,
      expected_base: request.expected_base,
      authorized_paths: request.authorized_paths,
      authorized_actor: actor.login,
      permitted_surface: surface,
      review: request.review_input,
      operation_count: 1,
      fallback_allowed: false,
      predelegation_task_id: predelegation.task_id,
      fresh_review_terminal_cursor: request.fresh_review_terminal.terminal_cursor,
    }),
    forbidden_changes: REVIEW_PUBLICATION_FORBIDDEN_CHANGES,
    expected_outputs: 'One exact Review authority publication and refetched completion record.',
    validation: 'Exact live binding, resource-derived identity, and refetch equality.',
    completion_conditions: 'One valid Review authority or zero-mutation reuse.',
    escalation_conditions: 'Any authority, identity, surface, cursor, or publication mismatch.',
  })
}

const serializeReviewPublicationAssignmentCommentV1 = (assignment) => (
  `\`\`\`yaml\n${JSON.stringify(assignment, null, 2)}\n\`\`\`\n`
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
  if (
    typeof resource?.body !== 'string' || !resource.body.includes(REVIEW_RECORD_MARKER) ||
    resource.body.includes('"record_type": "task_assignment"')
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

const acquireCurrentReviewPublicationAssignmentsV1 = async ({
  host, request, task, pull, actor, surface, taskProfiles,
}) => {
  const assignments = []
  const legacy = parseReviewPublicationTaskAssignmentV1({
    assignment: taskProfiles.exact_assignment,
    request,
    task,
    pull,
    actor,
    surface,
  })
  if (legacy !== null) assignments.push(legacy)

  const comments = await acquirePagedItems({
    host,
    route: `repos/${request.repository}/issues/${request.task_issue}/comments`,
  })
  for (const comment of comments) {
    if (!isReviewPublicationAssignmentCommentCandidateV1(comment?.body)) continue
    const profiles = classifyReviewPublicationTaskAssignmentsV1(comment.body)
    if (profiles.predelegation !== null || profiles.exact_assignment === null) {
      throw new Error('review_publication_authority_malformed')
    }
    if (profiles.exact_assignment.canonical_record !== 'GITHUB_RESOURCE') {
      throw new Error('review_publication_authority_malformed')
    }
    const parsed = parseReviewPublicationTaskAssignmentV1({
      assignment: profiles.exact_assignment,
      request,
      task,
      pull,
      actor,
      surface,
      resource: comment,
    })
    if (parsed !== null) assignments.push(parsed)
  }
  if (assignments.length > 1) throw new Error('review_publication_authority_duplicate')
  return Object.freeze(assignments)
}

const validateReviewRoutingRequest = (request) => {
  const terminal = request?.fresh_review_terminal
  if (
    !exactKeys(request, REVIEW_ROUTING_REQUEST_FIELDS) || !REPOSITORY.test(request.repository ?? '') ||
    !Number.isSafeInteger(request.task_issue) || request.task_issue < 1 ||
    !Number.isSafeInteger(request.pull_request) || request.pull_request < 1 ||
    !FULL_SHA.test(request.exact_head ?? '') || !FULL_SHA.test(request.expected_base ?? '') ||
    !nonEmptyText(request.head_branch) || request.head_branch !== request.head_branch.trim() ||
    !nonEmptyText(request.review_thread_id) || !nonEmptyText(request.review_host_id) ||
    !exactKeys(terminal, FRESH_REVIEW_TERMINAL_FIELDS) || terminal.wait_terminal !== true ||
    terminal.terminal_kind !== 'REVIEW_APPROVE' ||
    !Number.isSafeInteger(terminal.observed_at) || terminal.observed_at < 0 ||
    !nonEmptyText(terminal.terminal_cursor) ||
    !(terminal.prior_consumed_cursor === null || nonEmptyText(terminal.prior_consumed_cursor)) ||
    terminal.consumed_cursor !== terminal.terminal_cursor
  ) throw new Error('review_publication_request_invalid')
  const authorizedPaths = normalizedPaths(request.authorized_paths)
  const reviewBody = serializeSimplifiedReviewV1(request.review_input)
  const review = parseSimplifiedReviewV1(reviewBody)
  if (
    review.task_issue !== request.task_issue || review.pull_request !== request.pull_request ||
    review.reviewed_head !== request.exact_head
  ) throw new Error('review_publication_binding_invalid')
  let terminalReviewBody = null
  try {
    terminalReviewBody = serializeSimplifiedReviewV1(terminal.review_input)
  } catch {
    terminalReviewBody = null
  }
  const identityMatches = (
    terminal.repository === request.repository && terminal.task_issue === request.task_issue &&
    terminal.pull_request === request.pull_request && terminal.exact_head === request.exact_head &&
    terminal.expected_base === request.expected_base && terminal.head_branch === request.head_branch &&
    samePaths(terminal.authorized_paths, authorizedPaths) && terminalReviewBody === reviewBody &&
    terminal.thread_id === request.review_thread_id && terminal.host_id === request.review_host_id
  )
  const continuation = projectAutomatedReviewToMergeReadyContinuationV1({
    waitTerminal: terminal.wait_terminal,
    terminalKind: terminal.terminal_kind,
    identityMatches,
    observedAt: terminal.observed_at,
    terminalCursor: terminal.terminal_cursor,
    consumedCursor: terminal.prior_consumed_cursor,
  })
  if (continuation.outcome === 'NO_ADVANCE') {
    return Object.freeze({
      ...request,
      authorized_paths: authorizedPaths,
      review_body: reviewBody,
      continuation,
    })
  }
  if (
    continuation.outcome !== 'CONTINUE' || continuation.actions.length !== 1 ||
    continuation.actions[0]?.type !== 'ENSURE_REVIEW_AUTHORITY_AND_RUN_PREFLIGHT' ||
    continuation.consumed_cursor !== terminal.consumed_cursor
  ) throw new Error('fresh_review_terminal_cursor_invalid')
  return Object.freeze({
    ...request,
    authorized_paths: authorizedPaths,
    review_body: reviewBody,
    continuation,
  })
}

export const ensureReviewAuthorityAndRunPreflightV1 = async ({ request, host }) => {
  request = validateReviewRoutingRequest(request)
  if (request.continuation.outcome === 'NO_ADVANCE') {
    return Object.freeze({
      state: 'NO_ADVANCE',
      assignment_materialization_mutation_count: 0,
      publication_mutation_count: 0,
      exact_head: request.exact_head,
      consumed_cursor: request.continuation.consumed_cursor,
    })
  }
  if (
    host === null || typeof host !== 'object' || typeof host.api !== 'function' ||
    typeof host.publishPullRequestReview !== 'function' || typeof host.publishTaskIssueComment !== 'function' ||
    typeof host.publishTaskAssignmentComment !== 'function'
  ) throw new Error('review_publication_host_invalid')

  const acquireLiveBinding = async () => {
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
      pull?.head?.sha !== request.exact_head || pull?.head?.ref !== request.head_branch ||
      pull?.head?.repo?.full_name !== request.repository ||
      pull?.base?.ref !== 'main' || pull?.base?.sha !== request.expected_base ||
      pull?.base?.repo?.full_name !== request.repository ||
      mainRef?.ref !== 'refs/heads/main' || mainRef?.object?.sha !== request.expected_base ||
      !samePaths(taskAuthority.authorized_paths, request.authorized_paths) ||
      !samePaths(changedPaths, request.authorized_paths)
    ) throw new Error('review_publication_live_binding_invalid')
    return Object.freeze({ actor, task, pull })
  }

  const routeFor = (live) => (
    live.actor.login === live.pull.user?.login ? 'TASK_ISSUE_COMMENT' : 'PULL_REQUEST_REVIEW'
  )
  const admitPredelegation = (live, surface) => {
    const profiles = classifyReviewPublicationTaskAssignmentsV1(live.task.body)
    const predelegation = parseReviewPublicationPredelegationV1({
      profiles, request, task: live.task, pull: live.pull, actor: live.actor, surface,
    })
    return Object.freeze({ profiles, predelegation })
  }
  const acquireAssignments = async (live, surface, profiles) => (
    acquireCurrentReviewPublicationAssignmentsV1({
      host, request, task: live.task, pull: live.pull, actor: live.actor, surface, taskProfiles: profiles,
    })
  )

  let live = await acquireLiveBinding()
  let publicationRoute = routeFor(live)
  let authorities = await acquireCurrentReviewAuthorities({
    host, request, pull: live.pull, expectedBody: request.review_body,
  })
  let admitted = authorities.length === 0 ? admitPredelegation(live, publicationRoute) : null
  let assignments = authorities.length === 0
    ? await acquireAssignments(live, publicationRoute, admitted.profiles)
    : Object.freeze([])
  let assignmentMutationCount = 0
  let mutationCount = 0
  let publicationAuthority = assignments[0] ?? null

  if (authorities.length === 0 && assignments.length === 0) {
    try {
      live = await acquireLiveBinding()
    } catch {
      throw new Error('review_assignment_materialization_final_binding_invalid')
    }
    const reboundRoute = routeFor(live)
    if (reboundRoute !== publicationRoute) throw new Error('review_assignment_materialization_final_binding_invalid')
    admitted = admitPredelegation(live, publicationRoute)
    authorities = await acquireCurrentReviewAuthorities({
      host, request, pull: live.pull, expectedBody: request.review_body,
    })
    assignments = authorities.length === 0
      ? await acquireAssignments(live, publicationRoute, admitted.profiles)
      : Object.freeze([])

    if (authorities.length === 0 && assignments.length === 0) {
      const assignment = exactReviewPublicationAssignmentV1({
        request,
        pull: live.pull,
        actor: live.actor,
        surface: publicationRoute,
        predelegation: admitted.predelegation,
      })
      const body = serializeReviewPublicationAssignmentCommentV1(assignment)
      assignmentMutationCount = 1
      const resource = await host.publishTaskAssignmentComment({
        repository: request.repository,
        taskIssue: request.task_issue,
        body,
      })
      const expectedUrl = `https://github.com/${request.repository}/issues/${request.task_issue}#issuecomment-${resource?.id}`
      if (
        !Number.isSafeInteger(resource?.id) || resource.id < 1 || resource.html_url !== expectedUrl ||
        resource.issue_url !== `https://api.github.com/repos/${request.repository}/issues/${request.task_issue}` ||
        resource.body !== body || resource.user?.login !== live.actor.login ||
        !REVIEWER_ASSOCIATIONS.has(resource.author_association)
      ) throw new Error('review_assignment_materialization_response_invalid')
      const refetched = await host.api(`repos/${request.repository}/issues/comments/${resource.id}`)
      const resourceProfiles = classifyReviewPublicationTaskAssignmentsV1(refetched?.body)
      if (resourceProfiles.predelegation !== null || resourceProfiles.exact_assignment === null) {
        throw new Error('review_assignment_materialization_refetch_mismatch')
      }
      publicationAuthority = parseReviewPublicationTaskAssignmentV1({
        assignment: resourceProfiles.exact_assignment,
        request,
        task: live.task,
        pull: live.pull,
        actor: live.actor,
        surface: publicationRoute,
        resource: refetched,
      })
      if (publicationAuthority === null || publicationAuthority.resource_id !== resource.id) {
        throw new Error('review_assignment_materialization_refetch_mismatch')
      }

      try {
        live = await acquireLiveBinding()
      } catch {
        throw new Error('review_publication_final_binding_invalid')
      }
      if (routeFor(live) !== publicationRoute) throw new Error('review_publication_final_binding_invalid')
      admitted = admitPredelegation(live, publicationRoute)
      authorities = await acquireCurrentReviewAuthorities({
        host, request, pull: live.pull, expectedBody: request.review_body,
      })
      assignments = authorities.length === 0
        ? await acquireAssignments(live, publicationRoute, admitted.profiles)
        : Object.freeze([])
      if (
        authorities.length === 0 &&
        (assignments.length !== 1 || assignments[0].resource_id !== resource.id)
      ) throw new Error('review_assignment_materialization_refetch_mismatch')
      publicationAuthority = assignments[0] ?? publicationAuthority
    }
  }

  if (authorities.length === 0) {
    if (assignments.length !== 1) throw new Error('review_publication_authority_required')
    publicationAuthority = assignments[0]
    try {
      live = await acquireLiveBinding()
    } catch {
      throw new Error('review_publication_final_binding_invalid')
    }
    if (routeFor(live) !== publicationRoute) throw new Error('review_publication_final_binding_invalid')
    admitted = admitPredelegation(live, publicationRoute)
    assignments = await acquireAssignments(live, publicationRoute, admitted.profiles)
    if (assignments.length !== 1) throw new Error('review_publication_authority_required')
    publicationAuthority = assignments[0]
    authorities = await acquireCurrentReviewAuthorities({
      host, request, pull: live.pull, expectedBody: request.review_body,
    })
  }

  if (authorities.length === 0) {
    try {
      live = await acquireLiveBinding()
    } catch {
      throw new Error('review_publication_final_binding_invalid')
    }
    if (routeFor(live) !== publicationRoute) throw new Error('review_publication_final_binding_invalid')
    admitted = admitPredelegation(live, publicationRoute)
    authorities = await acquireCurrentReviewAuthorities({
      host, request, pull: live.pull, expectedBody: request.review_body,
    })
    assignments = authorities.length === 0
      ? await acquireAssignments(live, publicationRoute, admitted.profiles)
      : Object.freeze([])
    if (authorities.length === 0) {
      if (assignments.length !== 1) throw new Error('review_publication_authority_required')
      publicationAuthority = assignments[0]
      mutationCount = 1
      const selfAuthored = publicationRoute === 'TASK_ISSUE_COMMENT'
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
      if (refetched?.user?.login !== live.actor.login) throw new Error('review_publication_refetch_mismatch')
      reviewAuthorityFromResource({
        kind: publicationRoute, resource: refetched, request, pull: live.pull, expectedBody: request.review_body,
      })
      authorities = await acquireCurrentReviewAuthorities({
        host, request, pull: live.pull, expectedBody: request.review_body,
      })
      if (authorities.length !== 1 || authorities[0].review_id !== resource.id) {
        throw new Error('review_publication_refetch_mismatch')
      }
    } else {
      publicationRoute = 'REUSED'
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
    publication_mutation_count: mutationCount,
    review_kind: authority.review_kind,
    review_id: authority.review_id,
    review_url: authority.review_url,
    exact_head: request.exact_head,
    publication_authority_record: publicationAuthority?.canonical_record ?? null,
    consumed_cursor: request.continuation.consumed_cursor,
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
