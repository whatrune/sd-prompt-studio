import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  evaluateProtectedTransitionAdmissionV1,
  isNormalizedRepositoryPathV1,
  parseProtectedTransitionTaskStateJsonV1,
} from '../src/continuous-orchestration/protected-transition-admission-v1.ts'

const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/
const FULL_HEAD = /^[0-9a-f]{40}$/
const STATE_START = '<!-- protected-transition-task-state-v1:start -->'
const STATE_END = '<!-- protected-transition-task-state-v1:end -->'
const MAX_PULL_FILES = 3000
const PAGE_SIZE = 100

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

const api = async (host, endpoint) => {
  if (!host || typeof host.api !== 'function') throw new Error('host_api_unavailable')
  return host.api(endpoint)
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

const parseCli = (argv, environment) => {
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

const productionHost = (environment) => {
  const token = environment.GH_TOKEN
  if (!token) throw new Error('github_token_missing')
  return Object.freeze({
    api: async (endpoint) => {
      const response = await fetch(`https://api.github.com/${endpoint}`, {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'protected-transition-admission-v1',
        },
      })
      if (!response.ok) throw new Error(`github_api_${response.status}`)
      return response.json()
    },
  })
}

const main = async () => {
  let request
  try {
    request = parseCli(process.argv.slice(2), process.env)
    const result = await executeProtectedTransitionAdmissionV1({ request, host: productionHost(process.env) })
    process.stdout.write(`${JSON.stringify(result)}\n`)
    process.exitCode = result.exit_code
  } catch (error) {
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
