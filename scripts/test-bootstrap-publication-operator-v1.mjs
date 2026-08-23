import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  executeBootstrapPublicationOperatorV1,
  insertInitialProtectedTransitionTaskStateV1,
} from './run-bootstrap-publication-operator-v1.mjs'
import { extractProtectedTransitionTaskStateV1 } from './run-protected-transition-admission-v1.mjs'

let assertions = 0
const check = (condition, message) => {
  assertions += 1
  if (!condition) throw new Error(`FAIL: ${message}`)
}

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const worktree = path.resolve(scriptDirectory, '..')
const runnerPath = path.join(scriptDirectory, 'run-bootstrap-publication-operator-v1.mjs')
const runnerSource = readFileSync(runnerPath, 'utf8')
const REPOSITORY = 'whatrune/sd-prompt-studio'
const TASK = 359
const PARENT = '8abbb809218683372f43f56d206f1401d1b53824'
const PUSHED = 'b'.repeat(40)
const AUTHORITY_ID = 5_400_000_001
const AUTHORITY_URL = `https://github.com/${REPOSITORY}/issues/359#issuecomment-${AUTHORITY_ID}`
const AUTHORITY_BODY = 'canonical publication authority\n'
const AUTHORITY_SHA = createHash('sha256').update(AUTHORITY_BODY, 'utf8').digest('hex')
const BRANCH = 'codex/bootstrap-publication-operator-v1'
const PR_NUMBER = 360
const PR_URL = `https://github.com/${REPOSITORY}/pull/${PR_NUMBER}`
const PR_NODE_ID = 'PR_kwDOTUu8Qs6bootstrap'
const PATHS = Object.freeze([
  'scripts/run-bootstrap-publication-operator-v1.mjs',
  'scripts/test-bootstrap-publication-operator-v1.mjs',
])

const requestV1 = () => ({
  record_type: 'bootstrap_publication_request_v1',
  version: 1,
  repository: REPOSITORY,
  task_issue_number: TASK,
  authorized_paths: [...PATHS],
  branch: BRANCH,
  reviewed_worktree_path: worktree,
  base_branch: 'main',
  expected_parent_head: PARENT,
  publication_authority_comment_id: AUTHORITY_ID,
  publication_authority_url: AUTHORITY_URL,
  publication_authority_body_sha256: AUTHORITY_SHA,
  operation_count: 1,
})

const copy = (value) => JSON.parse(JSON.stringify(value))

const makeHostV1 = (configuration = {}) => {
  const metrics = {
    authorityRefetch: 0,
    gitCommands: [],
    stage: 0,
    stagedArguments: [],
    commit: 0,
    push: 0,
    lsRemote: 0,
    createPull: 0,
    pullRefetch: 0,
    patch: 0,
    apiCalls: [],
  }
  let currentHead = configuration.currentHead ?? PARENT
  let remoteHead = null
  let stagedPaths = []
  let pullBody = configuration.pullBody ?? `Task #${TASK}`
  const prNumber = configuration.prNumber ?? PR_NUMBER
  const defaultPull = () => ({
    number: prNumber,
    state: 'open',
    draft: true,
    merged: false,
    base: { ref: 'main', repo: { full_name: REPOSITORY } },
    head: { sha: PUSHED, repo: { full_name: REPOSITORY } },
    body: pullBody,
    html_url: configuration.refetchedPrUrl ?? PR_URL,
    node_id: configuration.pullNodeId ?? PR_NODE_ID,
  })
  const host = {
    repository: configuration.hostRepository ?? REPOSITORY,
    worktreePath: configuration.worktreePath ?? worktree,
    metrics,
    git: (args) => {
      metrics.gitCommands.push([...args])
      const command = args.join(' ')
      if (command === 'branch --show-current') return `${configuration.branch ?? BRANCH}\n`
      if (command === 'rev-parse --verify HEAD') return `${currentHead}\n`
      if (command === 'diff --cached --quiet --') {
        if (configuration.dirtyIndex) throw new Error('index dirty')
        return ''
      }
      if (command === 'diff --name-only -z --no-renames HEAD --') {
        return `${(configuration.trackedPaths ?? []).join('\0')}${(configuration.trackedPaths ?? []).length ? '\0' : ''}`
      }
      if (command === 'ls-files --others --exclude-standard -z') {
        const paths = configuration.changedPaths ?? PATHS
        return `${paths.join('\0')}${paths.length ? '\0' : ''}`
      }
      if (args[0] === 'add') {
        metrics.stage += 1
        metrics.stagedArguments = args.slice(2)
        stagedPaths = configuration.stagedPaths ?? args.slice(2)
        return ''
      }
      if (command === 'diff --cached --name-only -z --no-renames HEAD --') {
        return `${stagedPaths.join('\0')}${stagedPaths.length ? '\0' : ''}`
      }
      if (args[0] === 'commit') {
        metrics.commit += 1
        if (configuration.commitReject) throw new Error('commit rejected')
        currentHead = PUSHED
        return '[branch commit]\n'
      }
      if (command === 'rev-parse HEAD') return `${currentHead}\n`
      if (command === 'rev-parse HEAD^') return `${configuration.commitParent ?? PARENT}\n`
      if (args[0] === 'push') {
        metrics.push += 1
        if (configuration.pushReject) throw new Error('push rejected')
        remoteHead = configuration.remoteHead ?? currentHead
        return configuration.pushOutput ?? `*\tHEAD:refs/heads/${BRANCH}\t[new branch]\n`
      }
      if (args[0] === 'ls-remote') {
        metrics.lsRemote += 1
        if (remoteHead === null) return configuration.initialRemoteOutput ?? ''
        return `${remoteHead}\trefs/heads/${BRANCH}\n`
      }
      throw new Error(`unexpected git command: ${command}`)
    },
    api: async (endpoint, options = undefined) => {
      metrics.apiCalls.push({ endpoint, method: options?.method ?? 'GET', body: options?.body })
      if (endpoint.endsWith(`/issues/comments/${AUTHORITY_ID}`)) {
        metrics.authorityRefetch += 1
        if (configuration.authorityReject) throw new Error('authority unavailable')
        return {
          id: configuration.authorityId ?? AUTHORITY_ID,
          html_url: configuration.authorityUrl ?? AUTHORITY_URL,
          body: configuration.authorityBody ?? AUTHORITY_BODY,
        }
      }
      if (endpoint === `repos/${REPOSITORY}/pulls` && options?.method === 'POST') {
        metrics.createPull += 1
        if (configuration.createPullReject) throw new Error('create rejected')
        return {
          number: configuration.createdPrNumber ?? prNumber,
          html_url: configuration.createdPrUrl ?? PR_URL,
        }
      }
      if (endpoint === `repos/${REPOSITORY}/pulls/${prNumber}` && options?.method === 'PATCH') {
        metrics.patch += 1
        if (configuration.patchReject) throw new Error('patch rejected')
        pullBody = options.body.body
        return { number: prNumber, body: pullBody }
      }
      if (endpoint === `repos/${REPOSITORY}/pulls/${prNumber}` && (options?.method ?? 'GET') === 'GET') {
        metrics.pullRefetch += 1
        if (configuration.pullRefetchReject) throw new Error('pull unavailable')
        let pull = defaultPull()
        if (typeof configuration.pullMutator === 'function') pull = configuration.pullMutator(copy(pull))
        if (metrics.pullRefetch > 1 && typeof configuration.finalPullMutator === 'function') {
          pull = configuration.finalPullMutator(copy(pull))
        }
        return pull
      }
      throw new Error(`unexpected api call: ${options?.method ?? 'GET'} ${endpoint}`)
    },
  }
  return host
}

const runV1 = async (configuration = {}, request = requestV1()) => {
  const host = makeHostV1(configuration)
  const result = await executeBootstrapPublicationOperatorV1(request, host)
  return { result, host }
}

const success = await runV1()
check(success.result.status === 'SUCCESS', 'A exact 13-field request is accepted')
check(success.host.metrics.authorityRefetch === 1, 'A accepted request starts with one authority refetch')
check(success.host.metrics.commit === 1 && success.host.metrics.push === 1, 'A accepted request completes one commit and push')
check(AUTHORITY_URL.includes('#issuecomment-') && success.result.status === 'SUCCESS', 'A actual canonical GitHub html_url form is accepted')
check(!runnerSource.includes('request.publication_authority_url !== `https://github.com/'), 'B fabricated authority html_url prediction is absent')

const missingRequest = requestV1()
delete missingRequest.version
const missing = await runV1({}, missingRequest)
check(missing.result.status === 'STOP' && missing.result.reason === 'request_schema_invalid', 'B missing request field fails closed')
check(missing.host.metrics.authorityRefetch === 0, 'B missing request field stops before authority')
const unknown = await runV1({}, { ...requestV1(), extra: true })
check(unknown.result.status === 'STOP' && unknown.result.mutation_count === 0, 'B unknown request field fails closed')
const nullValue = await runV1({}, { ...requestV1(), repository: null })
check(nullValue.result.status === 'STOP' && nullValue.result.reason === 'request_value_invalid', 'B null request field fails closed')
const duplicatePaths = await runV1({}, { ...requestV1(), authorized_paths: [PATHS[0], PATHS[0]] })
check(duplicatePaths.result.status === 'STOP' && duplicatePaths.result.mutation_count === 0, 'B duplicate authorized path fails closed')

const temporaryDirectory = mkdtempSync(path.join(tmpdir(), 'bootstrap-publication-request-'))
try {
  const duplicateFile = path.join(temporaryDirectory, 'duplicate.json')
  const validSource = JSON.stringify(requestV1())
  writeFileSync(duplicateFile, validSource.replace(
    '{"record_type":',
    '{"record_type":"bootstrap_publication_request_v1","record_type":',
  ))
  const duplicateCli = spawnSync(process.execPath, [runnerPath, '--request-file', duplicateFile], {
    cwd: worktree,
    encoding: 'utf8',
  })
  const duplicateResult = JSON.parse(duplicateCli.stdout.trim())
  check(duplicateCli.status === 1, 'B duplicate raw request field returns nonzero')
  check(duplicateResult.reason === 'request_duplicate_field' && duplicateResult.mutation_count === 0, 'B duplicate raw request field is detected before host creation')
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true })
}

for (const [field, value] of [
  ['record_type', 'other_request'],
  ['version', 2],
  ['base_branch', 'develop'],
  ['operation_count', 2],
]) {
  const drift = await runV1({}, { ...requestV1(), [field]: value })
  check(drift.result.status === 'STOP' && drift.result.mutation_count === 0, `C wrong fixed ${field} fails closed`)
}

const authorityIdMismatch = await runV1({ authorityId: AUTHORITY_ID + 1 })
check(authorityIdMismatch.result.reason === 'publication_authority_binding_mismatch', 'D authority ID mismatch stops')
check(authorityIdMismatch.result.mutation_count === 0 && authorityIdMismatch.host.metrics.stage === 0, 'D authority ID mismatch mutates nothing')
const authorityUrlMismatch = await runV1({ authorityUrl: `${AUTHORITY_URL}-drift` })
check(authorityUrlMismatch.result.reason === 'publication_authority_binding_mismatch', 'E authority URL mismatch stops')
check(authorityUrlMismatch.result.mutation_count === 0 && authorityUrlMismatch.host.metrics.gitCommands.length === 0, 'E authority URL mismatch stops before preflight')
const authorityDigestMismatch = await runV1({ authorityBody: `${AUTHORITY_BODY}drift` })
check(authorityDigestMismatch.result.reason === 'publication_authority_binding_mismatch', 'F authority digest mismatch stops')
check(authorityDigestMismatch.result.mutation_count === 0 && authorityDigestMismatch.host.metrics.commit === 0, 'F authority digest mismatch commits nothing')

const wrongRepository = await runV1({ hostRepository: 'other/repository' })
check(wrongRepository.result.reason === 'repository_binding_mismatch' && wrongRepository.result.mutation_count === 0, 'G wrong repository stops before staging')
const wrongWorktree = await runV1({ worktreePath: path.join(worktree, 'other') })
check(wrongWorktree.result.reason === 'worktree_binding_mismatch' && wrongWorktree.host.metrics.stage === 0, 'G wrong worktree stops before staging')
const wrongBranch = await runV1({ branch: 'codex/other' })
check(wrongBranch.result.reason === 'branch_binding_mismatch' && wrongBranch.result.mutation_count === 0, 'G wrong branch stops before staging')
const wrongParent = await runV1({ currentHead: 'c'.repeat(40) })
check(wrongParent.result.reason === 'repair_worktree_head_changed' && wrongParent.result.mutation_count === 0, 'G wrong parent stops before staging')

const dirtyIndex = await runV1({ dirtyIndex: true })
check(dirtyIndex.result.reason === 'repair_index_not_clean', 'H dirty index is rejected by reused helper')
check(dirtyIndex.result.mutation_count === 0 && dirtyIndex.host.metrics.stage === 0, 'H dirty index stops without operator mutation')
const changedPathMismatch = await runV1({ changedPaths: [PATHS[0], 'scripts/outside.mjs'] })
check(changedPathMismatch.result.reason === 'changed_paths_mismatch', 'I changed path set mismatch stops')
check(changedPathMismatch.result.mutation_count === 0 && changedPathMismatch.host.metrics.stage === 0, 'I changed path set mismatch stops before staging')

check(success.host.metrics.lsRemote === 2, 'D absent branch preflight and post-push confirmation each use ls-remote once')
const successRemotePreflightIndex = success.host.metrics.gitCommands.findIndex((args) => args[0] === 'ls-remote')
const successStageIndex = success.host.metrics.gitCommands.findIndex((args) => args[0] === 'add')
check(successRemotePreflightIndex >= 0 && successRemotePreflightIndex < successStageIndex, 'D remote branch absence is confirmed before staging')
const existingRemoteBranch = await runV1({
  initialRemoteOutput: `${PARENT}\trefs/heads/${BRANCH}\n`,
})
check(existingRemoteBranch.result.reason === 'remote_branch_already_exists', 'E existing remote branch stops branch-creation operator')
check(existingRemoteBranch.result.mutation_count === 0 && existingRemoteBranch.result.protected_operation_count === 0, 'E existing remote branch stops with 0/0 counters')
check(existingRemoteBranch.host.metrics.stage === 0 && existingRemoteBranch.host.metrics.commit === 0 && existingRemoteBranch.host.metrics.push === 0, 'E existing remote branch causes no staging, commit, or push')
const ambiguousRemoteBranch = await runV1({
  initialRemoteOutput: `${PARENT}\trefs/heads/${BRANCH}\n${PUSHED}\trefs/heads/${BRANCH}\n`,
})
check(ambiguousRemoteBranch.result.reason === 'remote_branch_state_ambiguous', 'F ambiguous remote ref result stops')
check(ambiguousRemoteBranch.result.mutation_count === 0 && ambiguousRemoteBranch.result.protected_operation_count === 0, 'F ambiguous remote ref result stops with 0/0 counters')
check(ambiguousRemoteBranch.host.metrics.stage === 0 && ambiguousRemoteBranch.host.metrics.commit === 0, 'F ambiguous remote ref result stops before mutation')

check(success.host.metrics.stage === 1, 'J exact staging occurs once')
check(JSON.stringify(success.host.metrics.stagedArguments) === JSON.stringify(PATHS), 'J git add receives only authorized paths')
check(success.host.metrics.gitCommands.some((args) => args.join(' ') === 'diff --cached --name-only -z --no-renames HEAD --'), 'J staged paths are freshly verified')
const stagedMismatch = await runV1({ stagedPaths: [PATHS[0]] })
check(stagedMismatch.result.reason === 'staged_paths_mismatch' && stagedMismatch.result.mutation_count === 0, 'J staged path mismatch stops before commit')

const commitRejected = await runV1({ commitReject: true })
check(commitRejected.result.reason === 'commit_failed', 'K commit rejection stops')
check(commitRejected.result.mutation_count === 1 && commitRejected.result.protected_operation_count === 1, 'K commit attempt accounts 1/1')
check(commitRejected.host.metrics.commit === 1 && commitRejected.host.metrics.push === 0, 'L commit is attempted once with no continuation')
check(success.host.metrics.commit === 1, 'L successful transaction has no second commit')

const pushRejected = await runV1({ pushReject: true })
check(pushRejected.result.reason === 'push_failed', 'M push rejection stops')
check(pushRejected.result.mutation_count === 2 && pushRejected.result.protected_operation_count === 1, 'M push attempt accounts 2/1')
check(pushRejected.host.metrics.push === 1 && pushRejected.host.metrics.createPull === 0, 'M push rejection does not retry or create PR')
const remoteMismatch = await runV1({ remoteHead: 'c'.repeat(40) })
check(remoteMismatch.result.reason === 'remote_head_mismatch', 'N remote HEAD mismatch stops')
check(remoteMismatch.result.mutation_count === 2 && remoteMismatch.host.metrics.createPull === 0, 'N remote mismatch stops before PR creation')
check(remoteMismatch.host.metrics.lsRemote === 2, 'G successful branch-creation push retains post-push remote HEAD confirmation')

const createRejected = await runV1({ createPullReject: true })
check(createRejected.result.reason === 'draft_pr_creation_failed', 'O Draft PR rejection stops')
check(createRejected.result.mutation_count === 3 && createRejected.result.protected_operation_count === 1, 'O PR creation attempt accounts 3/1')
check(createRejected.host.metrics.createPull === 1 && createRejected.host.metrics.pullRefetch === 0, 'O PR creation has no retry')
const createdPullUrlMismatch = await runV1({ createdPrUrl: `${PR_URL}?creation=drift` })
check(createdPullUrlMismatch.result.reason === 'draft_pr_binding_mismatch', 'H first fresh PR refetch must match the creation-result URL and number')
check(createdPullUrlMismatch.result.mutation_count === 3 && createdPullUrlMismatch.host.metrics.patch === 0, 'H creation-result identity mismatch stops before body PATCH')
check(success.host.metrics.pullRefetch === 2, 'I first fresh refetch captures identity used by the final refetch')

const pullDrifts = [
  ['repository', (pull) => { pull.base.repo.full_name = 'other/repository'; return pull }],
  ['HEAD', (pull) => { pull.head.sha = 'c'.repeat(40); return pull }],
  ['base', (pull) => { pull.base.ref = 'develop'; return pull }],
  ['state', (pull) => { pull.state = 'closed'; return pull }],
  ['draft', (pull) => { pull.draft = false; return pull }],
  ['merged', (pull) => { pull.merged = true; return pull }],
]
for (const [name, pullMutator] of pullDrifts) {
  const drift = await runV1({ pullMutator })
  check(drift.result.reason === 'draft_pr_binding_mismatch', `P fresh PR wrong ${name} stops`)
  check(drift.result.mutation_count === 3 && drift.host.metrics.patch === 0, `P fresh PR wrong ${name} stops before body PATCH`)
}

const preexistingMarker = await runV1({
  pullBody: `Existing\n${'<!-- protected-transition-task-state-v1:start -->'}`,
})
check(preexistingMarker.result.reason === 'initial_task_state_cardinality_invalid', 'Q preexisting state marker stops')
check(preexistingMarker.result.mutation_count === 3 && preexistingMarker.host.metrics.patch === 0, 'Q preexisting state marker stops before PATCH')

const helperBody = 'Existing PR prose exactly.'
const helperUpdated = insertInitialProtectedTransitionTaskStateV1(helperBody, {
  task_issue_number: TASK,
  pr_number: 360,
  observed_head: PUSHED,
  authorized_paths: [...PATHS],
})
const helperState = extractProtectedTransitionTaskStateV1(helperUpdated)
check(helperUpdated.startsWith(`${helperBody}\n\n<!-- protected-transition-task-state-v1:start -->`), 'R helper preserves existing body as exact prefix')
check(Object.keys(helperState).length === 10, 'R helper produces exactly ten state fields')
check(helperState.record_type === 'protected_transition_task_state_v1', 'R helper uses existing state record type')
check(helperState.task_issue_number === TASK && helperState.pr_number === 360, 'R helper binds exact Task and allocated PR')
check(helperState.observed_head === PUSHED, 'R helper binds fresh PR head')
check(JSON.stringify(helperState.authorized_paths) === JSON.stringify(PATHS), 'R helper preserves normalized authorized paths')
check(helperState.architecture_status === 'APPROVED' && helperState.implementation_authorized === true, 'R helper sets approved implementation state')
check(helperState.review_status === 'PENDING' && helperState.reviewed_head === null && helperState.review_blocker_count === null, 'R helper sets exact pending Review state')
check(extractProtectedTransitionTaskStateV1(helperUpdated).pr_number === 360, 'S constructed body passes imported extractor')
check(!Object.hasOwn(helperState, 'repository'), 'T repository is not added to Task state')
check(!runnerSource.includes('writeProtectedTransitionTaskStateV1'), 'T insertion does not call the existing update writer')

check(success.host.metrics.patch === 1, 'U PR body is patched exactly once')
check(success.result.mutation_count === 4 && success.result.protected_operation_count === 1, 'U PATCH attempt accounts 4/1')
check(success.host.metrics.apiCalls.map(({ method }) => method).join(',') === 'GET,POST,GET,PATCH,GET', 'U transaction uses exact authority/create/refetch/PATCH/refetch API order')
const finalMismatch = await runV1({
  finalPullMutator: (pull) => ({ ...pull, body: `${pull.body}\nDRIFT` }),
})
check(finalMismatch.result.reason === 'final_pr_binding_mismatch', 'V final refetch mismatch stops')
check(finalMismatch.result.mutation_count === 4 && finalMismatch.result.protected_operation_count === 1, 'V final mismatch preserves 4/1 accounting')
check(finalMismatch.host.metrics.patch === 1 && finalMismatch.host.metrics.pullRefetch === 2, 'V final mismatch has no PATCH retry')
const finalNodeMismatch = await runV1({
  finalPullMutator: (pull) => ({ ...pull, node_id: `${PR_NODE_ID}-different` }),
})
check(finalNodeMismatch.result.reason === 'final_pr_binding_mismatch', 'J final refetch with different immutable PR node identity stops')
check(finalNodeMismatch.result.mutation_count === 4 && finalNodeMismatch.host.metrics.patch === 1, 'J node identity drift is terminal after one PATCH')
check(finalNodeMismatch.host.metrics.pullRefetch === 2, 'J node identity drift causes no refetch retry')

check(success.result.reason === 'bootstrap_publication_complete', 'W success is terminal bootstrap publication result')
check(success.result.mutation_count === 4 && success.result.protected_operation_count === 1, 'W success has exact 4/1 counters')
check(success.result.pr_number === 360 && success.result.pushed_head === PUSHED, 'W success returns actual PR and pushed HEAD')
check(success.result.task_state.pr_number === 360, 'W success returns extractor-verified state')
check(success.result.status === 'SUCCESS' && success.host.metrics.pullRefetch === 2, 'K identical immutable PR node identity preserves normal success')
check(!Object.hasOwn(requestV1(), 'pr_node_id') && !Object.hasOwn(requestV1(), 'node_id'), 'L PR node identity is absent from request schema')
check(!Object.hasOwn(success.result.task_state, 'pr_node_id') && !Object.hasOwn(success.result.task_state, 'node_id'), 'L PR node identity is absent from Task-state schema')
check(success.host.metrics.commit === 1 && success.host.metrics.push === 1 && success.host.metrics.createPull === 1 && success.host.metrics.patch === 1, 'X success performs every mutation once')
check(!runnerSource.includes("['reset'") && !runnerSource.includes("['rebase'") && !runnerSource.includes("['commit', '--amend'"), 'X runner has no reset, rebase, or amend')
check(!runnerSource.includes("'--force'") && !runnerSource.includes("'--force-with-lease'"), 'X runner has no force push')
check(!/setTimeout|retry/i.test(runnerSource), 'X runner has no retry mechanism')
check(runnerSource.includes('extractProtectedTransitionTaskStateV1'), 'Y existing Task-state extractor is imported and reused')
check(!runnerSource.includes('parseProtectedTransitionTaskStateV1') && !runnerSource.includes('parseProtectedTransitionTaskStateJsonV1'), 'Y no second Task-state parser exists')

const status = spawnSync('git', ['status', '--porcelain=v1', '--untracked-files=all'], {
  cwd: worktree,
  encoding: 'utf8',
})
check(status.status === 0, 'Z implementation delta can be inspected')
const deltaPaths = status.stdout.trim().split(/\r?\n/).filter(Boolean).map((line) => line.slice(3)).sort()
check(JSON.stringify(deltaPaths) === JSON.stringify([...PATHS].sort()), 'Z only the two authorized new files exist in implementation delta')

process.stdout.write(`${assertions} assertions passed\n`)
