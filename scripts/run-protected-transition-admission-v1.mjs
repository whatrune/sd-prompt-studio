import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  evaluateProtectedTransitionAdmissionV1,
  isNormalizedRepositoryPathV1,
  parseProtectedTransitionTaskStateJsonV1,
  projectProtectedTransitionApprovedReviewStateV1,
} from '../src/continuous-orchestration/protected-transition-admission-v1.ts'

const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/
const FULL_HEAD = /^[0-9a-f]{40}$/
const STATE_START = '<!-- protected-transition-task-state-v1:start -->'
const STATE_END = '<!-- protected-transition-task-state-v1:end -->'
const MAX_PULL_FILES = 3000
const PAGE_SIZE = 100
const REVIEW_RECORD_TYPE = 'independent_review_decision_v1'
const REVIEW_AUTHORING_ROLE = 'Independent Reviewer'
const REVIEW_ASSOCIATIONS = new Set(['OWNER', 'MEMBER', 'COLLABORATOR'])

const positiveInteger = (value) => Number.isSafeInteger(value) && value > 0
const occurrenceCount = (text, needle) => text.split(needle).length - 1

export const extractProtectedTransitionTaskStateV1 = (body) => {
  if (typeof body !== 'string' || occurrenceCount(body, STATE_START) !== 1 || occurrenceCount(body, STATE_END) !== 1) {
    throw new Error('state_block_cardinality_invalid')
  }
  const start = body.indexOf(STATE_START)
  const end = body.indexOf(STATE_END)
  if (start < 0 || end <= start) throw new Error('state_block_order_invalid')
  const region = body.slice(start + STATE_START.length, end)
  const match = region.match(/^\s*```json\r?\n([\s\S]*?)\r?\n```\s*$/)
  if (!match) throw new Error('state_block_shape_invalid')
  return parseProtectedTransitionTaskStateJsonV1(match[1])
}

const parseReviewScalarV1 = (raw) => {
  const value = raw.trim()
  if (value.startsWith('"')) {
    let parsed
    try {
      parsed = JSON.parse(value)
    } catch {
      throw new Error('review_scalar_invalid')
    }
    if (typeof parsed !== 'string') throw new Error('review_scalar_invalid')
    return parsed
  }
  if (value === 'true') return true
  if (value === 'false') return false
  if (/^(?:0|[1-9]\d*)$/.test(value)) return Number(value)
  if (/^[A-Za-z][A-Za-z0-9_-]*$/.test(value)) return value
  throw new Error('review_scalar_invalid')
}

export const parseIndependentReviewDecisionProjectionV1 = (body, repository, taskIssueNumber) => {
  if (typeof body !== 'string' || !REPOSITORY.test(repository) || !positiveInteger(taskIssueNumber)) {
    throw new Error('review_projection_invalid')
  }
  const blocks = [...body.matchAll(/```yaml\r?\n([\s\S]*?)\r?\n```/g)]
  if (blocks.length !== 1) throw new Error('review_yaml_block_cardinality_invalid')

  const scalars = new Map()
  for (const line of blocks[0][1].split(/\r?\n/)) {
    if (line.trim().length === 0) continue
    const match = line.match(/^([a-z][a-z0-9_]*):[ \t]+(.+)$/)
    if (!match || scalars.has(match[1])) throw new Error('review_yaml_scalar_invalid')
    scalars.set(match[1], parseReviewScalarV1(match[2]))
  }

  const expectedTaskUrl = `https://github.com/${repository}/issues/${taskIssueNumber}`
  const pullPrefix = `https://github.com/${repository}/pull/`
  const pullUrl = scalars.get('pull_request')
  const prNumber = typeof pullUrl === 'string' && pullUrl.startsWith(pullPrefix)
    ? Number(pullUrl.slice(pullPrefix.length))
    : Number.NaN
  const reviewedHead = scalars.get('reviewed_head')
  const decision = scalars.get('decision')
  const blockingCount = scalars.get('blocking_finding_count')
  const remainingCount = scalars.get('remaining_finding_count')
  const unknownCount = scalars.get('unknown_count')

  if (
    scalars.get('record_type') !== REVIEW_RECORD_TYPE ||
    scalars.get('authoring_role') !== REVIEW_AUTHORING_ROLE ||
    scalars.get('task_issue') !== expectedTaskUrl ||
    !positiveInteger(prNumber) ||
    typeof reviewedHead !== 'string' ||
    !FULL_HEAD.test(reviewedHead) ||
    !['APPROVE', 'CHANGES_REQUIRED', 'BLOCKED'].includes(decision) ||
    !Number.isSafeInteger(blockingCount) ||
    blockingCount < 0 ||
    !Number.isSafeInteger(remainingCount) ||
    remainingCount < 0 ||
    !Number.isSafeInteger(unknownCount) ||
    unknownCount < 0 ||
    scalars.get('status') !== 'completed' ||
    scalars.get('execution_stop_reason') !== 'completed'
  ) {
    throw new Error('review_projection_invalid')
  }

  return Object.freeze({
    task_issue_number: taskIssueNumber,
    pr_number: prNumber,
    reviewed_head: reviewedHead,
    decision,
    blocking_finding_count: blockingCount,
    remaining_finding_count: remainingCount,
    unknown_count: unknownCount,
  })
}

export const parseReviewApprovalEventV1 = (event) => {
  const repository = event?.repository?.full_name
  const taskIssueNumber = event?.issue?.number
  if (
    !event ||
    event.action !== 'created' ||
    !REPOSITORY.test(repository ?? '') ||
    !positiveInteger(taskIssueNumber) ||
    event.issue?.state !== 'open' ||
    Object.prototype.hasOwnProperty.call(event.issue ?? {}, 'pull_request') ||
    event.issue?.html_url !== `https://github.com/${repository}/issues/${taskIssueNumber}` ||
    !positiveInteger(event.comment?.id) ||
    !REVIEW_ASSOCIATIONS.has(event.comment?.author_association) ||
    typeof event.comment?.body !== 'string'
  ) {
    throw new Error('review_event_invalid')
  }
  const review = parseIndependentReviewDecisionProjectionV1(event.comment.body, repository, taskIssueNumber)
  return Object.freeze({
    repository,
    taskIssueNumber,
    prNumber: review.pr_number,
    exactHead: review.reviewed_head,
    commentId: event.comment.id,
    review,
  })
}

const api = async (host, endpoint, options = undefined) => {
  if (!host || typeof host.api !== 'function') throw new Error('host_api_unavailable')
  return host.api(endpoint, options)
}

export const acquireTaskIdentityV1 = async (request, host) => {
  const raw = await api(host, `repos/${request.repository}/issues/${request.taskIssueNumber}`)
  const expectedRepositoryUrl = `https://api.github.com/repos/${request.repository}`
  const expectedHtmlUrl = `https://github.com/${request.repository}/issues/${request.taskIssueNumber}`
  if (
    !raw ||
    raw.number !== request.taskIssueNumber ||
    raw.repository_url !== expectedRepositoryUrl ||
    raw.html_url !== expectedHtmlUrl ||
    raw.state !== 'open' ||
    Object.prototype.hasOwnProperty.call(raw, 'pull_request')
  ) {
    throw new Error('task_identity_invalid')
  }
  return Object.freeze({
    repository: request.repository,
    number: raw.number,
    state: raw.state,
    is_pull_request: false,
  })
}

const acquirePull = async (request, host) => {
  const raw = await api(host, `repos/${request.repository}/pulls/${request.prNumber}`)
  if (
    !raw ||
    raw.number !== request.prNumber ||
    raw.state !== 'open' ||
    raw.base?.repo?.full_name !== request.repository ||
    typeof raw.body !== 'string' ||
    typeof raw.head?.sha !== 'string' ||
    !FULL_HEAD.test(raw.head.sha) ||
    !Number.isSafeInteger(raw.changed_files) ||
    raw.changed_files < 0
  ) {
    throw new Error('pull_identity_invalid')
  }
  return raw
}

export const acquireChangedPathScopeV1 = async (request, pull, host) => {
  if (pull.changed_files > MAX_PULL_FILES) throw new Error('pull_files_enumeration_limit_exceeded')
  const fileNames = new Set()
  const actualPaths = new Set()
  const pageFingerprints = new Set()
  let itemCount = 0
  let pageNumber = 1
  let terminal = false

  while (!terminal) {
    const page = await api(
      host,
      `repos/${request.repository}/pulls/${request.prNumber}/files?per_page=${PAGE_SIZE}&page=${pageNumber}`,
    )
    if (!Array.isArray(page) || page.length > PAGE_SIZE) throw new Error('pull_files_page_invalid')
    const fingerprint = JSON.stringify(page.map((item) => [item?.filename, item?.status, item?.previous_filename ?? null]))
    if (page.length > 0 && pageFingerprints.has(fingerprint)) throw new Error('pull_files_page_repeated')
    pageFingerprints.add(fingerprint)

    for (const item of page) {
      if (!item || !isNormalizedRepositoryPathV1(item.filename) || typeof item.status !== 'string') {
        throw new Error('pull_file_item_invalid')
      }
      if (fileNames.has(item.filename)) throw new Error('pull_file_item_duplicate')
      fileNames.add(item.filename)
      actualPaths.add(item.filename)
      if (item.status === 'renamed') {
        if (!isNormalizedRepositoryPathV1(item.previous_filename)) throw new Error('pull_file_rename_invalid')
        actualPaths.add(item.previous_filename)
      }
      itemCount += 1
      if (itemCount > pull.changed_files) throw new Error('pull_files_count_mismatch')
    }

    terminal = page.length < PAGE_SIZE
    pageNumber += 1
    if (pageNumber > 32) throw new Error('pull_files_terminal_page_missing')
  }

  if (itemCount !== pull.changed_files) throw new Error('pull_files_count_mismatch')
  return Object.freeze({
    complete: true,
    actual_paths: Object.freeze([...actualPaths].sort()),
    failure_reason: null,
  })
}

export const acquireTransitionStateSnapshotV1 = async (request, host) => {
  const pull = await acquirePull(request, host)
  const taskState = extractProtectedTransitionTaskStateV1(pull.body)
  const task = await acquireTaskIdentityV1(request, host)
  const scope = await acquireChangedPathScopeV1(request, pull, host)
  return Object.freeze({
    transition: request.transition,
    repository: request.repository,
    task_issue_number: request.taskIssueNumber,
    pr_number: request.prNumber,
    exact_head: request.exactHead,
    task,
    pull: Object.freeze({
      repository: request.repository,
      number: pull.number,
      state: pull.state,
      head: pull.head.sha,
    }),
    pull_body: pull.body,
    task_state: taskState,
    scope,
  })
}

const stoppedResult = (request, state, reason, exitCode, currentHead = request.exactHead) => Object.freeze({
  transition: request.transition,
  state,
  allowed: false,
  exit_code: exitCode,
  reason,
  task_issue_number: request.taskIssueNumber,
  pr_number: request.prNumber,
  current_head: currentHead,
  out_of_scope_paths: Object.freeze([]),
  state_changed: false,
})

class ReviewAutomationStop extends Error {
  constructor(state, reason, exitCode, currentHead) {
    super(reason)
    this.state = state
    this.exitCode = exitCode
    this.currentHead = currentHead
  }
}

const stoppedAutomationResult = (request, state, reason, exitCode, currentHead = request.exactHead) => Object.freeze({
  ...stoppedResult(request, state, reason, exitCode, currentHead),
  automation_status: 'STOPPED',
  admission_executed: false,
  next_action: 'STOP',
})

const skippedAutomationResult = (request, reason) => Object.freeze({
  ...stoppedResult(request, 'INDETERMINATE', reason, 0, request.exactHead),
  automation_status: 'SKIPPED',
  admission_executed: false,
  next_action: 'NONE',
})

const isReviewDecisionCandidateV1 = (body) => typeof body === 'string' &&
  /(?:^|\r?\n)record_type:[ \t]+(?:"independent_review_decision_v1"|independent_review_decision_v1)(?:\r?$)/m.test(body)

export const replaceProtectedTransitionTaskStateV1 = (body, candidateState) => {
  extractProtectedTransitionTaskStateV1(body)
  const projected = projectProtectedTransitionApprovedReviewStateV1(candidateState, {
    task_issue_number: candidateState.task_issue_number,
    pr_number: candidateState.pr_number,
    reviewed_head: candidateState.reviewed_head,
    decision: 'APPROVE',
    blocking_finding_count: 0,
    remaining_finding_count: 0,
    unknown_count: 0,
  })
  const start = body.indexOf(STATE_START)
  const end = body.indexOf(STATE_END)
  const newline = body.includes('\r\n') ? '\r\n' : '\n'
  const replacement = `${STATE_START}${newline}\`\`\`json${newline}${JSON.stringify(projected)}${newline}\`\`\`${newline}${STATE_END}`
  return `${body.slice(0, start)}${replacement}${body.slice(end + STATE_END.length)}`
}

export const writeProtectedTransitionTaskStateV1 = async ({ request, host, currentBody, candidateState }) => {
  const candidateBody = replaceProtectedTransitionTaskStateV1(currentBody, candidateState)
  await api(host, `repos/${request.repository}/pulls/${request.prNumber}`, {
    method: 'PATCH',
    body: Object.freeze({ body: candidateBody }),
  })
  const verified = await acquirePull(request, host)
  if (verified.head.sha !== request.exactHead) {
    throw new ReviewAutomationStop('STALE', 'head_changed_after_state_write', 2, verified.head.sha)
  }
  if (verified.body !== candidateBody) {
    throw new ReviewAutomationStop('INDETERMINATE', 'state_write_verification_failed', 1, verified.head.sha)
  }
  return Object.freeze({ pull: verified, body: candidateBody })
}

export const executeReviewApprovalAutomationV1 = async ({ event, host }) => {
  let parsedEvent
  let request
  try {
    if (!isReviewDecisionCandidateV1(event?.comment?.body)) {
      return skippedAutomationResult(Object.freeze({
        transition: 'merge_decision_admission',
        taskIssueNumber: event?.issue?.number ?? null,
        prNumber: null,
        exactHead: null,
      }), 'review_event_not_applicable')
    }
    parsedEvent = parseReviewApprovalEventV1(event)
    request = Object.freeze({
      transition: 'merge_decision_admission',
      repository: parsedEvent.repository,
      taskIssueNumber: parsedEvent.taskIssueNumber,
      prNumber: parsedEvent.prNumber,
      exactHead: parsedEvent.exactHead,
    })
    const review = parsedEvent.review
    if (review.decision !== 'APPROVE') {
      return skippedAutomationResult(request, 'review_decision_not_approved')
    }
    if (
      review.blocking_finding_count !== 0 ||
      review.remaining_finding_count !== 0 ||
      review.unknown_count !== 0
    ) {
      return stoppedAutomationResult(request, 'REVIEW_BLOCKED', 'review_not_approvable', 2)
    }

    const initial = await acquireTransitionStateSnapshotV1(request, host)
    const candidateState = projectProtectedTransitionApprovedReviewStateV1(initial.task_state, review)
    const candidateInput = Object.freeze({ ...initial, task_state: candidateState })
    const preflight = evaluateProtectedTransitionAdmissionV1(candidateInput)
    if (!preflight.allowed) {
      return Object.freeze({
        ...preflight,
        automation_status: 'STOPPED',
        admission_executed: false,
        next_action: 'STOP',
      })
    }

    const alreadyConverged = JSON.stringify(initial.task_state) === JSON.stringify(candidateState)
    const stablePull = await acquirePull(request, host)
    if (stablePull.head.sha !== initial.pull.head) {
      return stoppedAutomationResult(request, 'STALE', 'head_changed_before_state_write', 2, stablePull.head.sha)
    }
    if (stablePull.body !== initial.pull_body) {
      return stoppedAutomationResult(request, 'INDETERMINATE', 'state_body_changed_before_write', 1, stablePull.head.sha)
    }

    if (alreadyConverged) {
      const stableState = extractProtectedTransitionTaskStateV1(stablePull.body)
      const stable = evaluateProtectedTransitionAdmissionV1(Object.freeze({
        ...initial,
        pull: Object.freeze({ ...initial.pull, head: stablePull.head.sha }),
        task_state: stableState,
      }))
      if (!stable.allowed) {
        return Object.freeze({
          ...stable,
          automation_status: 'STOPPED',
          admission_executed: false,
          next_action: 'STOP',
        })
      }
      return Object.freeze({
        ...stable,
        automation_status: 'ALREADY_CONVERGED',
        admission_executed: false,
        next_action: 'MERGE_DECISION',
      })
    }

    await writeProtectedTransitionTaskStateV1({
      request,
      host,
      currentBody: stablePull.body,
      candidateState,
    })
    const admitted = await executeProtectedTransitionAdmissionV1({ request, host })
    return Object.freeze({
      ...admitted,
      state_changed: true,
      automation_status: admitted.allowed ? 'UPDATED_AND_ADMITTED' : 'UPDATED_AND_STOPPED',
      admission_executed: true,
      next_action: admitted.allowed ? 'MERGE_DECISION' : 'STOP',
    })
  } catch (error) {
    const fallbackRequest = request ?? Object.freeze({
      transition: 'merge_decision_admission',
      repository: parsedEvent?.repository ?? null,
      taskIssueNumber: parsedEvent?.taskIssueNumber ?? null,
      prNumber: parsedEvent?.prNumber ?? null,
      exactHead: parsedEvent?.exactHead ?? null,
    })
    if (error instanceof ReviewAutomationStop) {
      return stoppedAutomationResult(
        fallbackRequest,
        error.state,
        error.message,
        error.exitCode,
        error.currentHead ?? fallbackRequest.exactHead,
      )
    }
    return stoppedAutomationResult(
      fallbackRequest,
      'INDETERMINATE',
      error instanceof Error ? error.message : 'review_automation_failed',
      1,
    )
  }
}

export const executeProtectedTransitionAdmissionV1 = async ({ request, host }) => {
  try {
    const initial = await acquireTransitionStateSnapshotV1(request, host)
    const evaluated = evaluateProtectedTransitionAdmissionV1(initial)
    if (!evaluated.allowed) return evaluated

    const latePull = await acquirePull(request, host)
    if (latePull.head.sha !== initial.pull.head) {
      return stoppedResult(request, 'STALE', 'head_changed_during_evaluation', 2, latePull.head.sha)
    }
    const lateState = extractProtectedTransitionTaskStateV1(latePull.body)
    if (JSON.stringify(lateState) !== JSON.stringify(initial.task_state)) {
      return stoppedResult(request, 'INDETERMINATE', 'state_changed_during_evaluation', 1, latePull.head.sha)
    }
    return evaluated
  } catch (error) {
    return stoppedResult(
      request,
      'INDETERMINATE',
      error instanceof Error ? error.message : 'acquisition_failed',
      1,
    )
  }
}

const parseManualCli = (argv, environment) => {
  const values = new Map()
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index]
    const value = argv[index + 1]
    if (!key?.startsWith('--') || value === undefined || values.has(key)) throw new Error('cli_arguments_invalid')
    values.set(key, value)
  }
  const expected = ['--transition', '--task-issue-number', '--pr-number', '--exact-head']
  if (values.size !== expected.length || expected.some((key) => !values.has(key))) throw new Error('cli_arguments_invalid')
  const transition = values.get('--transition')
  const taskIssueNumber = Number(values.get('--task-issue-number'))
  const prNumber = Number(values.get('--pr-number'))
  const exactHead = values.get('--exact-head')
  const repository = environment.GITHUB_REPOSITORY
  if (
    (transition !== 'terminal_review_admission' && transition !== 'merge_decision_admission') ||
    !positiveInteger(taskIssueNumber) ||
    !positiveInteger(prNumber) ||
    !FULL_HEAD.test(exactHead ?? '') ||
    !REPOSITORY.test(repository ?? '')
  ) {
    throw new Error('cli_arguments_invalid')
  }
  return Object.freeze({ transition, taskIssueNumber, prNumber, exactHead, repository })
}

const parseInvocation = (argv, environment) => {
  if (argv.length === 2 && argv[0] === '--review-event-file' && typeof argv[1] === 'string' && argv[1].length > 0) {
    return Object.freeze({ mode: 'review_event', eventFile: argv[1] })
  }
  return Object.freeze({ mode: 'manual', request: parseManualCli(argv, environment) })
}

const productionHost = (environment) => {
  const token = environment.GH_TOKEN
  if (!token) throw new Error('github_token_missing')
  return Object.freeze({
    api: async (endpoint, options = undefined) => {
      const response = await fetch(`https://api.github.com/${endpoint}`, {
        method: options?.method ?? 'GET',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'protected-transition-admission-v1',
        },
        ...(options?.body ? { body: JSON.stringify(options.body) } : {}),
      })
      if (!response.ok) throw new Error(`github_api_${response.status}`)
      return response.status === 204 ? null : response.json()
    },
  })
}

const main = async () => {
  let invocation
  try {
    invocation = parseInvocation(process.argv.slice(2), process.env)
    const host = productionHost(process.env)
    const result = invocation.mode === 'review_event'
      ? await executeReviewApprovalAutomationV1({
          event: JSON.parse(readFileSync(invocation.eventFile, 'utf8')),
          host,
        })
      : await executeProtectedTransitionAdmissionV1({ request: invocation.request, host })
    process.stdout.write(`${JSON.stringify(result)}\n`)
    process.exitCode = result.exit_code
  } catch (error) {
    const request = invocation?.mode === 'manual' ? invocation.request : null
    const diagnostic = {
      transition: request?.transition ?? null,
      state: 'INDETERMINATE',
      allowed: false,
      exit_code: 1,
      reason: error instanceof Error ? error.message : 'runner_failed',
      task_issue_number: request?.taskIssueNumber ?? null,
      pr_number: request?.prNumber ?? null,
      current_head: request?.exactHead ?? null,
      out_of_scope_paths: [],
      state_changed: false,
    }
    process.stdout.write(`${JSON.stringify(diagnostic)}\n`)
    process.exitCode = 1
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : ''
if (invokedPath === fileURLToPath(import.meta.url)) await main()
