import { execFile } from 'node:child_process'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { parse as parseYaml } from 'yaml'
import {
  canonicalizeReadyReviewObservationJcsV1,
  sha256ReadyReviewObservationV1,
  validateReadyReviewGenerationRecordV1,
} from '../src/continuous-orchestration/ready-review-terminal-observation-artifact-v1.ts'
import {
  PROTECTED_TRANSITION_ADMISSION_INPUT_V1,
  evaluateProtectedTransitionAdmissionV1,
} from '../src/continuous-orchestration/protected-transition-admission-v1.ts'

const execFileAsync = promisify(execFile)
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/
const FULL_HEAD = /^[0-9a-f]{40}$/
const ISSUE_URL = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)$/
const COMMENT_URL = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)#issuecomment-(\d+)$/
const WORKFLOW_PATH = '.github/workflows/protected-transition-admission-v1.yml'
const COLLECTOR_PATH = 'scripts/run-ready-review-terminal-observation-collector-v1.mjs'

const fail = (code, message) => {
  process.stderr.write(`${canonicalizeReadyReviewObservationJcsV1({ result: 'failed', code, state_changed: false, protected_transition_performed: false, safe_message: message })}\n`)
  process.exitCode = 1
}

const exactArgs = (argv) => {
  const allowed = new Set(['--transition', '--pr-number', '--exact-head', '--task-record-url', '--ready-generation-record-url', '--terminal-review-record-url'])
  if (argv.length !== 12) return null
  const admitted = new Map()
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index]
    const value = argv[index + 1]
    if (!allowed.has(key) || admitted.has(key) || typeof value !== 'string') return null
    admitted.set(key, value)
  }
  const transition = admitted.get('--transition')
  const prNumber = Number(admitted.get('--pr-number'))
  const exactHead = admitted.get('--exact-head')
  const taskRecordUrl = admitted.get('--task-record-url')
  const readyRecordUrl = admitted.get('--ready-generation-record-url')
  const terminalReviewRecordUrl = admitted.get('--terminal-review-record-url')
  if (!['terminal_review_admission', 'merge_decision_admission'].includes(transition) || !Number.isSafeInteger(prNumber) || prNumber <= 0 ||
      !FULL_HEAD.test(exactHead) || !(ISSUE_URL.test(taskRecordUrl) || COMMENT_URL.test(taskRecordUrl)) || !COMMENT_URL.test(readyRecordUrl) ||
      (transition === 'terminal_review_admission' ? terminalReviewRecordUrl !== '' : !COMMENT_URL.test(terminalReviewRecordUrl))) return null
  return Object.freeze({ transition, prNumber, exactHead, taskRecordUrl, readyRecordUrl, terminalReviewRecordUrl })
}

const parseRecordBody = (body) => {
  if (typeof body !== 'string') return null
  const fenced = /```(?:yaml|yml|json)\r?\n([\s\S]*?)\r?\n```/i.exec(body)
  const source = fenced ? fenced[1] : body.trim()
  try {
    const parsed = parseYaml(source)
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

const ghJson = async (args) => {
  const { stdout } = await execFileAsync('gh', ['api', ...args], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, windowsHide: true })
  return JSON.parse(stdout)
}

const sourceIdentity = (url, repository) => {
  const comment = COMMENT_URL.exec(url)
  const issue = ISSUE_URL.exec(url)
  const match = comment ?? issue
  if (match === null || `${match[1]}/${match[2]}` !== repository) return null
  return comment === null
    ? { endpoint: `repos/${repository}/issues/${match[3]}` }
    : { endpoint: `repos/${repository}/issues/comments/${match[4]}` }
}

const acquireCanonicalRecord = async (url, repository) => {
  const identity = sourceIdentity(url, repository)
  if (identity === null) throw new Error('canonical source repository mismatch')
  const response = await ghJson([identity.endpoint])
  if (response?.html_url !== url || response?.author_association !== 'OWNER' || typeof response?.user?.login !== 'string' || typeof response?.body !== 'string') {
    throw new Error('canonical source authority mismatch')
  }
  return Object.freeze({ url, authorLogin: response.user.login, body: response.body, record: parseRecordBody(response.body) })
}

const admittedHostIdentity = () => {
  const repository = process.env.GITHUB_REPOSITORY
  const repositoryId = process.env.GITHUB_REPOSITORY_ID
  const invocationRef = process.env.GITHUB_REF
  const workflowSha = process.env.GITHUB_WORKFLOW_SHA
  const workflowRef = process.env.GITHUB_WORKFLOW_REF
  const runId = process.env.GITHUB_RUN_ID
  const runAttempt = Number(process.env.GITHUB_RUN_ATTEMPT)
  const actor = process.env.GITHUB_ACTOR
  const serverUrl = process.env.GITHUB_SERVER_URL
  const runUrl = process.env.PTA_RUN_URL
  const defaultBranch = process.env.PTA_DEFAULT_BRANCH
  if (!REPOSITORY.test(repository ?? '') || typeof repositoryId !== 'string' || repositoryId.length === 0 || invocationRef !== 'refs/heads/main' ||
      !FULL_HEAD.test(workflowSha ?? '') || workflowRef !== `${repository}/${WORKFLOW_PATH}@refs/heads/main` || typeof runId !== 'string' || runId.length === 0 ||
      !Number.isSafeInteger(runAttempt) || runAttempt <= 0 || typeof actor !== 'string' || actor.length === 0 || serverUrl !== 'https://github.com' ||
      runUrl !== `${serverUrl}/${repository}/actions/runs/${runId}` || defaultBranch !== 'main') return null
  return Object.freeze({ repository, repositoryId, invocationRef, workflowSha, workflowRef, runId, runAttempt, actor, serverUrl, runUrl, defaultBranch })
}

const persistFiles = async (result) => {
  if (result.files_to_persist.length === 0) return true
  const runnerTemp = process.env.RUNNER_TEMP
  const configured = process.env.PTA_OUTPUT_DIRECTORY
  if (typeof runnerTemp !== 'string' || runnerTemp.length === 0 || typeof configured !== 'string' || configured.length === 0) return false
  const root = path.resolve(runnerTemp)
  const output = path.resolve(configured)
  if (output === root || !output.startsWith(`${root}${path.sep}`)) return false
  try {
    await mkdir(output, { recursive: false })
    for (const file of result.files_to_persist) {
      if (path.basename(file.file_name) !== file.file_name) throw new Error('invalid output file name')
      const target = path.join(output, file.file_name)
      await writeFile(target, file.utf8_jcs, { encoding: 'utf8', flag: 'wx' })
      const persisted = await readFile(target, 'utf8')
      if (persisted !== file.utf8_jcs || await sha256ReadyReviewObservationV1(persisted) !== file.sha256) throw new Error('persisted bytes mismatch')
    }
    return true
  } catch {
    await rm(output, { recursive: true, force: true }).catch(() => undefined)
    return false
  }
}

const request = exactArgs(process.argv.slice(2))
const host = admittedHostIdentity()
if (request === null || host === null) {
  fail('caller_or_host_identity_invalid', 'caller arguments or host-derived identity failed admission')
} else {
  try {
    const taskSource = await acquireCanonicalRecord(request.taskRecordUrl, host.repository)
    const readySource = await acquireCanonicalRecord(request.readyRecordUrl, host.repository)
    if (request.transition === 'merge_decision_admission' && request.terminalReviewRecordUrl === '') throw new Error('terminal review record is required')
    const terminalSource = request.transition === 'merge_decision_admission'
      ? await acquireCanonicalRecord(request.terminalReviewRecordUrl, host.repository)
      : null
    if (!await validateReadyReviewGenerationRecordV1(readySource.record) || readySource.record.canonical_record !== request.readyRecordUrl ||
        readySource.record.repository !== host.repository || readySource.record.pr_number !== request.prNumber || readySource.record.exact_head !== request.exactHead) {
      throw new Error('Ready Generation record failed admission')
    }
    if (taskSource.authorLogin !== host.actor) throw new Error('workflow actor is not the canonical Task authority actor')

    const collector = await execFileAsync(process.execPath, [
      COLLECTOR_PATH,
      '--repository', host.repository,
      '--pr', String(request.prNumber),
      '--head', request.exactHead,
      '--ready-record', request.readyRecordUrl,
    ], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, windowsHide: true })
    const collectorJcs = collector.stdout
    if (typeof collectorJcs !== 'string' || collectorJcs.length === 0 || collector.stderr !== '') throw new Error('Collector did not return one exact JCS artifact')
    const collectorProjection = JSON.parse(collectorJcs)
    const actorRole = request.transition === 'terminal_review_admission' ? 'Independent PR Reviewer' : 'Product Owner'
    const taskScopeDigest = await sha256ReadyReviewObservationV1(taskSource.body)
    const terminalRecord = terminalSource?.record ?? null
    const evaluatedAt = new Date().toISOString()
    const input = {
      input_version: PROTECTED_TRANSITION_ADMISSION_INPUT_V1,
      transition: request.transition,
      repository: host.repository,
      repository_id: host.repositoryId,
      task_record_url: request.taskRecordUrl,
      task_scope_digest: taskScopeDigest,
      pr_number: request.prNumber,
      pr_url: `https://github.com/${host.repository}/pull/${request.prNumber}`,
      exact_head: request.exactHead,
      ready_generation: {
        record_url: request.readyRecordUrl,
        record_digest: readySource.record.record_digest,
        event_id: readySource.record.ready_event_id,
        occurred_at: readySource.record.ready_occurred_at,
        actor_login: readySource.authorLogin,
      },
      actor: { login: host.actor, role: actorRole, authorized_login: taskSource.authorLogin },
      collector_artifact_jcs: collectorJcs,
      collector_artifact_jcs_sha256: await sha256ReadyReviewObservationV1(collectorJcs),
      terminal_review: terminalRecord,
      workflow_identity: {
        path: WORKFLOW_PATH,
        ref: host.workflowRef,
        sha: host.workflowSha,
        invocation_ref: host.invocationRef,
        run_id: host.runId,
        run_attempt: host.runAttempt,
        actor: host.actor,
        server_url: host.serverUrl,
        run_url: host.runUrl,
        default_branch: host.defaultBranch,
      },
      current_state: {
        repository: host.repository,
        pr_number: request.prNumber,
        exact_head: request.exactHead,
        task_scope_digest: taskScopeDigest,
        ready_generation_record_url: request.readyRecordUrl,
        ready_event_id: readySource.record.ready_event_id,
        ready_occurred_at: readySource.record.ready_occurred_at,
        ready_actor_login: readySource.authorLogin,
        actor_login: host.actor,
        actor_role: actorRole,
        default_branch: host.defaultBranch,
        workflow_sha: host.workflowSha,
        thread_snapshot_digest: collectorProjection?.thread_snapshot?.snapshot_digest,
        terminal_review_decision: terminalRecord?.decision ?? null,
        latest_protected_event_at: terminalRecord?.published_at ?? readySource.record.ready_occurred_at,
      },
      persistence: {
        owner: 'github_actions_artifact_service',
        available: typeof process.env.ACTIONS_RUNTIME_TOKEN === 'string' && process.env.ACTIONS_RUNTIME_TOKEN.length > 0 &&
          typeof process.env.ACTIONS_RESULTS_URL === 'string' && process.env.ACTIONS_RESULTS_URL.length > 0,
      },
      evaluated_at: evaluatedAt,
    }
    const result = await evaluateProtectedTransitionAdmissionV1(input)
    if (!await persistFiles(result)) {
      fail('persistence_failed', 'admission output persistence failed closed')
    } else if (result.result === 'failed') {
      fail(result.failure.code, result.failure.safe_message)
    } else {
      process.stdout.write(`${canonicalizeReadyReviewObservationJcsV1({
        result: result.result,
        transition: result.transition,
        admission_digest: result.receipt.admission_digest,
        expires_at: result.receipt.expires_at,
        receipt_count: result.receipt_count,
        admitted_artifact_count: result.admitted_artifact_count,
        state_changed: false,
        protected_transition_performed: false,
      })}\n`)
      process.exitCode = result.result === 'accepted' ? 0 : 2
    }
  } catch {
    fail('acquisition_or_collector_failed', 'canonical acquisition or Collector execution failed closed')
  }
}
