import { createHash, randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { realpathSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

export const EXECUTION_IDENTITY_MISMATCH_V1 = 'execution_identity_mismatch'

const SHA_PATTERN = /^[0-9a-f]{40}$/
const REPOSITORY_PATTERN = /^[a-z0-9_.-]+\/[a-z0-9_.-]+$/
const TASK_PATTERN = /^#[1-9][0-9]*$/
const INSTANCE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

export class ExecutionIdentityMismatchV1 extends Error {
  constructor(predicate) {
    super(EXECUTION_IDENTITY_MISMATCH_V1)
    this.name = 'ExecutionIdentityMismatchV1'
    this.code = EXECUTION_IDENTITY_MISMATCH_V1
    this.predicate = predicate
  }
}

function mismatch(predicate) {
  throw new ExecutionIdentityMismatchV1(predicate)
}

function sha256(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

export function normalizeObjectiveV1(value) {
  if (typeof value !== 'string') mismatch('objective_type')
  const normalized = value.normalize('NFC').replace(/\r\n?/g, '\n').trim().replace(/\s+/gu, ' ')
  if (!normalized || normalized.length > 4096) mismatch('objective_bounds')
  return normalized
}

export function normalizeAuthorizedPathsV1(values) {
  if (!Array.isArray(values) || values.length === 0) mismatch('authorized_paths_missing')
  const normalized = values.map((value) => {
    if (typeof value !== 'string' || value.length === 0 || value !== value.trim()) {
      mismatch('authorized_path_format')
    }
    if (value.includes('\\') || value.startsWith('/') || value.includes('\0')) {
      mismatch('authorized_path_format')
    }
    const segments = value.split('/')
    if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
      mismatch('authorized_path_format')
    }
    return value
  })
  const sorted = [...normalized].sort((left, right) => left.localeCompare(right, 'en'))
  if (new Set(sorted).size !== sorted.length) mismatch('authorized_paths_duplicate')
  return Object.freeze(sorted)
}

function normalizeAbsolutePathV1(value, predicate) {
  if (typeof value !== 'string' || !path.isAbsolute(value)) mismatch(predicate)
  return path.normalize(value).replace(/[\\/]$/, '')
}

function normalizeRepositoryV1(value) {
  if (typeof value !== 'string') mismatch('repository')
  const normalized = value.toLowerCase()
  if (!REPOSITORY_PATTERN.test(normalized) || value !== normalized) mismatch('repository')
  return normalized
}

function normalizeTaskV1(value) {
  const normalized = typeof value === 'number' ? `#${value}` : value
  if (typeof normalized !== 'string' || !TASK_PATTERN.test(normalized)) mismatch('canonical_task_id')
  return normalized
}

function normalizeShaV1(value, predicate) {
  if (typeof value !== 'string' || !SHA_PATTERN.test(value)) mismatch(predicate)
  return value
}

function normalizePrV1(value) {
  if (value === null) return null
  if (!Number.isSafeInteger(value) || value <= 0) mismatch('expected_pr')
  return value
}

function normalizeBranchV1(value) {
  if (typeof value !== 'string' || !value || value !== value.trim()) mismatch('branch')
  if (/\s|\.\.|@\{|\\|^\/|\/$|\.lock$/.test(value)) mismatch('branch')
  return value
}

export function digestAuthorizedPathsV1(paths) {
  return sha256(normalizeAuthorizedPathsV1(paths).map((value) => `${value}\0`).join(''))
}

export function createBoundedExecutionIdentityV1(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) mismatch('identity_input')
  const objective = normalizeObjectiveV1(input.objective)
  const authorizedPaths = normalizeAuthorizedPathsV1(input.authorized_paths)
  const executionInstanceId = input.execution_instance_id ?? randomUUID()
  if (typeof executionInstanceId !== 'string' || !INSTANCE_PATTERN.test(executionInstanceId)) {
    mismatch('execution_instance_id')
  }

  const expectedPr = normalizePrV1(input.expected_pr)
  const expectedHead = normalizeShaV1(input.expected_head, 'expected_head')
  const expectedRemoteHead = expectedPr === null
    ? null
    : normalizeShaV1(input.expected_remote_head ?? expectedHead, 'expected_remote_head')
  return Object.freeze({
    repository: normalizeRepositoryV1(input.repository),
    canonical_task_id: normalizeTaskV1(input.canonical_task_id),
    objective,
    objective_digest: sha256(objective),
    branch: normalizeBranchV1(input.branch),
    worktree_path: normalizeAbsolutePathV1(input.worktree_path, 'worktree_path'),
    git_common_dir: normalizeAbsolutePathV1(input.git_common_dir, 'git_common_dir'),
    authorized_paths: authorizedPaths,
    authorized_paths_digest: digestAuthorizedPathsV1(authorizedPaths),
    expected_base: normalizeShaV1(input.expected_base, 'expected_base'),
    expected_pr: expectedPr,
    expected_head: expectedHead,
    expected_remote_head: expectedRemoteHead,
    execution_instance_id: executionInstanceId,
  })
}

function exactPathEqual(left, right) {
  return process.platform === 'win32'
    ? left.toLowerCase() === right.toLowerCase()
    : left === right
}

function exactArrayEqual(left, right) {
  return Array.isArray(left) && left.length === right.length && left.every((value, index) => value === right[index])
}

export function assertBoundedExecutionContextV1(identity, observed) {
  if (!identity || !observed) mismatch('context_missing')
  if (observed.repository !== identity.repository) mismatch('repository')
  if (normalizeTaskV1(observed.canonical_task_id) !== identity.canonical_task_id) mismatch('canonical_task_id')
  if (observed.objective_digest !== identity.objective_digest) mismatch('objective_digest')
  if (observed.branch !== identity.branch) mismatch('branch')
  const observedWorktree = normalizeAbsolutePathV1(observed.worktree_path, 'worktree_path')
  if (!exactPathEqual(observedWorktree, identity.worktree_path)) mismatch('worktree_path')
  const registered = normalizeAbsolutePathV1(observed.registered_worktree_path, 'registered_worktree_path')
  if (!exactPathEqual(registered, identity.worktree_path)) mismatch('registered_worktree_path')
  const commonDir = normalizeAbsolutePathV1(observed.git_common_dir, 'git_common_dir')
  if (!exactPathEqual(commonDir, identity.git_common_dir)) mismatch('git_common_dir')
  const observedPaths = normalizeAuthorizedPathsV1(observed.authorized_paths)
  if (!exactArrayEqual(observedPaths, identity.authorized_paths)) mismatch('authorized_paths')
  if (digestAuthorizedPathsV1(observedPaths) !== identity.authorized_paths_digest) mismatch('authorized_paths_digest')
  if (observed.remote_main_sha !== identity.expected_base) mismatch('expected_base_remote_main')
  if (observed.head !== identity.expected_head) mismatch('expected_head')

  if (identity.expected_pr === null) {
    if (observed.pr_lookup_attempted !== false || observed.pr !== null) mismatch('prepublication_pr_discovery')
  } else {
    if (observed.requested_pr_number !== identity.expected_pr) mismatch('expected_pr_request')
    const pr = observed.pr
    if (!pr || pr.number !== identity.expected_pr) mismatch('expected_pr')
    if (pr.repository !== identity.repository) mismatch('pr_repository')
    if (pr.state !== 'OPEN' || pr.merged === true) mismatch('pr_state')
    if (pr.head !== identity.expected_remote_head) mismatch('pr_head')
    if (pr.base !== identity.expected_base) mismatch('pr_base')
  }
  return Object.freeze({ admitted: true, execution_instance_id: identity.execution_instance_id })
}

export function inspectHistoricalCommitV1({ commit, label }) {
  const historicalCommit = normalizeShaV1(commit, 'historical_commit')
  if (label !== 'historical_diagnostic') mismatch('historical_label')
  return Object.freeze({
    commit: historicalCommit,
    label,
    current_execution_target: false,
  })
}

export function admitParallelExecutionsV1(left, right, options = {}) {
  for (const field of ['canonical_task_id', 'branch', 'worktree_path', 'execution_instance_id']) {
    if (left[field] === right[field]) mismatch(`parallel_${field}`)
  }
  if (left.expected_pr !== null && left.expected_pr === right.expected_pr) mismatch('parallel_expected_pr')
  if (left.git_common_dir !== right.git_common_dir || left.repository !== right.repository) {
    mismatch('parallel_repository_identity')
  }
  const rightPaths = new Set(right.authorized_paths)
  const overlappingPaths = left.authorized_paths.filter((value) => rightPaths.has(value))
  const freshOriginMain = normalizeShaV1(options.fresh_origin_main, 'fresh_origin_main')
  const freshBaseRebindRequired = freshOriginMain !== left.expected_base
  if (options.shared_owner_conflict === true || options.protected_transition_conflict === true) {
    return Object.freeze({
      admission: 'SERIALIZATION_REQUIRED',
      overlapping_paths: Object.freeze(overlappingPaths),
      fresh_base_rebind_required: freshBaseRebindRequired,
    })
  }
  if (options.dependency_ordered === true || options.compatibility_reconciled === true) {
    return Object.freeze({
      admission: 'ORDERED',
      overlapping_paths: Object.freeze(overlappingPaths),
      fresh_base_rebind_required: freshBaseRebindRequired,
    })
  }
  return Object.freeze({
    admission: 'CONCURRENT',
    overlapping_paths: Object.freeze(overlappingPaths),
    fresh_base_rebind_required: freshBaseRebindRequired,
  })
}

const immediateContinuationActionV1 = (terminalKind, owningWorker) => {
  if (terminalKind === 'TASK_ADMITTED') {
    return Object.freeze({ type: 'CREATE_ASSIGNED_WORKTREE_AND_DISPATCH_IMPLEMENTATION' })
  }
  if (terminalKind === 'IMPLEMENTATION_COMPLETE') {
    return Object.freeze({ type: 'COMMIT_VALIDATED_TREE_AND_DISPATCH_PREPUBLICATION_REVIEW' })
  }
  if (terminalKind === 'PREPUBLICATION_REVIEW_APPROVE') {
    return Object.freeze({ type: 'PUBLISH_REVIEWED_COMMIT_NON_DRAFT' })
  }
  if (terminalKind === 'PUBLICATION_COMPLETE') return Object.freeze({ type: 'WAIT_CURRENT_HEAD_CHECKS' })
  if (terminalKind === 'CHECKS_PASS') return Object.freeze({ type: 'DISPATCH_FRESH_REVIEW' })
  if (terminalKind === 'CORRECTION_IMPLEMENTATION_COMPLETE') {
    return Object.freeze({ type: 'COMMIT_VALIDATED_CORRECTION_AND_DISPATCH_PREPUBLICATION_REVIEW' })
  }
  if (terminalKind === 'CORRECTION_CHECKS_PASS') return Object.freeze({ type: 'DISPATCH_REPLACEMENT_FRESH_REVIEW' })
  if (terminalKind === 'REVIEW_FINDING') {
    return typeof owningWorker === 'string' && owningWorker.length > 0
      ? Object.freeze({ type: 'FOLLOW_UP_OWNING_WORKER', worker: owningWorker })
      : null
  }
  if (terminalKind === 'REVIEW_APPROVE') return Object.freeze({ type: 'ENSURE_REVIEW_AUTHORITY_AND_RUN_PREFLIGHT' })
  return null
}

export function projectAutomatedReviewToMergeReadyContinuationV1({
  waitTerminal,
  terminalKind,
  identityMatches,
  owningWorker = null,
  observedAt,
  terminalCursor,
  consumedCursor = null,
}) {
  const cursorValid = typeof terminalCursor === 'string' && terminalCursor.length > 0
    && (consumedCursor === null || (typeof consumedCursor === 'string' && consumedCursor.length > 0))
  const noAdvance = () => Object.freeze({
    outcome: 'NO_ADVANCE',
    actions: Object.freeze([]),
    action_at: null,
    consumed_cursor: consumedCursor,
  })
  if (waitTerminal !== true || identityMatches !== true || !Number.isSafeInteger(observedAt) || observedAt < 0
    || !cursorValid || terminalCursor === consumedCursor) {
    return noAdvance()
  }
  if (terminalKind === 'PRE_DECISION_PASS') {
    return Object.freeze({
      outcome: 'MERGE_READY',
      actions: Object.freeze([]),
      action_at: observedAt,
      consumed_cursor: terminalCursor,
    })
  }
  const action = immediateContinuationActionV1(terminalKind, owningWorker)
  return Object.freeze({
    outcome: action === null ? 'NO_ADVANCE' : 'CONTINUE',
    actions: Object.freeze(action === null ? [] : [action]),
    action_at: action === null ? null : observedAt,
    consumed_cursor: action === null ? consumedCursor : terminalCursor,
  })
}

export function projectPreDecisionReviewFindingContinuationV1({
  correction,
  identity,
  observed,
  owningWorker,
  observedAt,
  consumedCursor = null,
}) {
  const fields = [
    'state', 'reason', 'continuation_kind', 'continuation_cursor', 'repository',
    'task_issue', 'pull_request', 'exact_head', 'expected_base', 'head_branch',
    'authorized_paths', 'active_thread_ids', 'assignment_materialization_mutation_count',
    'publication_mutation_count',
  ]
  if (
    correction === null || typeof correction !== 'object' || Array.isArray(correction) ||
    Object.keys(correction).sort().join('\0') !== [...fields].sort().join('\0') ||
    correction.state !== 'CORRECTION_REQUIRED' || correction.reason !== 'blocking_review_threads_present' ||
    correction.continuation_kind !== 'REVIEW_FINDING' || identity === null || typeof identity !== 'object' ||
    correction.repository !== identity.repository || correction.task_issue !== Number(identity.canonical_task_id.slice(1)) ||
    correction.pull_request !== identity.expected_pr || correction.exact_head !== identity.expected_head ||
    correction.expected_base !== identity.expected_base || correction.head_branch !== identity.branch ||
    !exactArrayEqual(correction.authorized_paths, identity.authorized_paths) ||
    !Array.isArray(correction.active_thread_ids) || correction.active_thread_ids.length === 0 ||
    !correction.active_thread_ids.every((value) => typeof value === 'string' && value.length > 0) ||
    new Set(correction.active_thread_ids).size !== correction.active_thread_ids.length ||
    correction.active_thread_ids.join('\0') !== [...correction.active_thread_ids].sort().join('\0') ||
    !Number.isSafeInteger(correction.assignment_materialization_mutation_count) ||
    correction.assignment_materialization_mutation_count < 0 ||
    !Number.isSafeInteger(correction.publication_mutation_count) || correction.publication_mutation_count < 0
  ) mismatch('review_correction_binding')
  const cursorInput = JSON.stringify({
    repository: correction.repository,
    task_issue: correction.task_issue,
    pull_request: correction.pull_request,
    exact_head: correction.exact_head,
    active_thread_ids: correction.active_thread_ids,
  })
  if (correction.continuation_cursor !== `review-finding-${sha256(cursorInput)}`) {
    mismatch('review_correction_cursor')
  }
  assertBoundedExecutionContextV1(identity, observed)
  const projected = projectAutomatedReviewToMergeReadyContinuationV1({
    waitTerminal: true,
    terminalKind: 'REVIEW_FINDING',
    identityMatches: true,
    owningWorker,
    observedAt,
    terminalCursor: correction.continuation_cursor,
    consumedCursor,
  })
  if (projected.actions.length === 0) return projected
  return Object.freeze({
    ...projected,
    actions: Object.freeze([Object.freeze({
      ...projected.actions[0],
      task_issue: correction.task_issue,
      pull_request: correction.pull_request,
      exact_head: correction.exact_head,
      active_thread_ids: Object.freeze([...correction.active_thread_ids]),
    })]),
  })
}

export function assertSharedDependencyAccessV1({ left_manifest_digest, right_manifest_digest, operation }) {
  if (!SHA_PATTERN.test(left_manifest_digest ?? '') || left_manifest_digest !== right_manifest_digest) {
    mismatch('shared_dependency_manifest_identity')
  }
  if (operation !== 'read') mismatch('shared_dependency_mutation_prohibited')
  return Object.freeze({ admitted: true, operation: 'read' })
}

function runGit(worktree, args) {
  return execFileSync('git', ['-C', worktree, ...args], { encoding: 'utf8' }).trim()
}

function canonicalExistingPath(value) {
  return path.normalize(realpathSync.native(value)).replace(/[\\/]$/, '')
}

function originMatchesRepositoryV1(origin, repository) {
  const escaped = repository.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`github\\.com[:/]${escaped}(?:\\.git)?$`, 'i').test(origin)
}

function resolveRemoteMainV1(worktree) {
  const output = runGit(worktree, ['ls-remote', '--exit-code', 'origin', 'refs/heads/main'])
  const match = output.match(/^([0-9a-f]{40})\s+refs\/heads\/main$/)
  if (!match) mismatch('expected_base_remote_main')
  return match[1]
}

export function observeLocalWorktreeV1(identity) {
  const worktree = canonicalExistingPath(identity.worktree_path)
  const topLevel = canonicalExistingPath(runGit(worktree, ['rev-parse', '--show-toplevel']))
  if (!exactPathEqual(worktree, topLevel)) mismatch('worktree_path')
  const origin = runGit(worktree, ['remote', 'get-url', 'origin'])
  if (!originMatchesRepositoryV1(origin, identity.repository)) mismatch('repository_origin')
  const commonDir = canonicalExistingPath(runGit(worktree, ['rev-parse', '--path-format=absolute', '--git-common-dir']))
  const rows = runGit(worktree, ['worktree', 'list', '--porcelain']).split(/\r?\n/)
  const registeredPaths = rows.filter((row) => row.startsWith('worktree ')).map((row) => canonicalExistingPath(row.slice(9)))
  const exactRegistrations = registeredPaths.filter((value) => exactPathEqual(value, worktree))
  if (exactRegistrations.length !== 1) mismatch('registered_worktree_path')
  return Object.freeze({
    repository: identity.repository,
    canonical_task_id: identity.canonical_task_id,
    objective_digest: identity.objective_digest,
    branch: runGit(worktree, ['branch', '--show-current']),
    worktree_path: worktree,
    registered_worktree_path: exactRegistrations[0],
    git_common_dir: commonDir,
    authorized_paths: identity.authorized_paths,
    remote_main_sha: resolveRemoteMainV1(worktree),
    head: runGit(worktree, ['rev-parse', 'HEAD']),
    pr_lookup_attempted: false,
    pr: null,
  })
}

export function bindExpectedPullRequestV1(identity, localObservation, fetchPullRequest) {
  if (identity.expected_pr === null) {
    return Object.freeze({ ...localObservation, pr_lookup_attempted: false, pr: null })
  }
  if (typeof fetchPullRequest !== 'function') mismatch('expected_pr_fetcher')
  const requestedPrNumber = identity.expected_pr
  const value = fetchPullRequest(identity.repository, requestedPrNumber)
  if (!value || typeof value !== 'object' || Array.isArray(value)) mismatch('expected_pr_response')
  return Object.freeze({
    ...localObservation,
    pr_lookup_attempted: true,
    requested_pr_number: requestedPrNumber,
    pr: Object.freeze({
      number: value.number,
      repository: value.base?.repo?.full_name?.toLowerCase?.() ?? null,
      state: value.state?.toUpperCase?.() ?? null,
      merged: value.merged,
      head: value.head?.sha,
      base: value.base?.sha,
    }),
  })
}

function fetchExpectedPullRequestWithGh(repository, pullRequest) {
  const route = `repos/${repository}/pulls/${pullRequest}`
  const output = execFileSync('gh', ['api', route], { encoding: 'utf8' })
  try {
    return JSON.parse(output)
  } catch {
    mismatch('expected_pr_response')
  }
}

function parseCliArgs(argv) {
  const allowed = new Set([
    'repository',
    'canonical-task-id',
    'objective',
    'branch',
    'worktree',
    'expected-base',
    'expected-head',
    'expected-pr',
    'execution-instance-id',
    'authorized-path',
    'validate-input-only',
    'git-common-dir',
  ])
  const result = new Map()
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index]
    const value = argv[index + 1]
    if (!name?.startsWith('--') || value === undefined) mismatch('cli_arguments')
    const key = name.slice(2)
    if (!allowed.has(key)) mismatch('cli_unknown_argument')
    if (result.has(key) && key !== 'authorized-path') mismatch('cli_duplicate_argument')
    if (key === 'authorized-path') result.set(key, [...(result.get(key) ?? []), value])
    else result.set(key, value)
  }
  return result
}

function runCli() {
  const args = parseCliArgs(process.argv.slice(2))
  const validateInputOnly = args.get('validate-input-only') === 'true'
  if (args.has('validate-input-only') && !validateInputOnly) mismatch('cli_arguments')
  const worktree = validateInputOnly
    ? normalizeAbsolutePathV1(args.get('worktree'), 'worktree_path')
    : canonicalExistingPath(args.get('worktree'))
  const commonDir = validateInputOnly
    ? canonicalExistingPath(args.get('git-common-dir'))
    : canonicalExistingPath(runGit(worktree, ['rev-parse', '--path-format=absolute', '--git-common-dir']))
  const expectedPrText = args.get('expected-pr') ?? 'null'
  const identity = createBoundedExecutionIdentityV1({
    repository: args.get('repository'),
    canonical_task_id: args.get('canonical-task-id'),
    objective: args.get('objective'),
    branch: args.get('branch'),
    worktree_path: worktree,
    git_common_dir: commonDir,
    authorized_paths: args.get('authorized-path'),
    expected_base: args.get('expected-base'),
    expected_pr: expectedPrText === 'null' ? null : Number(expectedPrText),
    expected_head: args.get('expected-head'),
    execution_instance_id: args.get('execution-instance-id'),
  })
  if (validateInputOnly) {
    if (identity.expected_pr !== null) mismatch('prepublication_pr_discovery')
    process.stdout.write(`${JSON.stringify({
      admitted: true,
      phase: 'INPUT_VALIDATED',
      canonical_task_id: identity.canonical_task_id,
      objective_digest: identity.objective_digest,
      authorized_paths_digest: identity.authorized_paths_digest,
      execution_instance_id: identity.execution_instance_id,
    })}\n`)
    return
  }
  if (args.has('git-common-dir')) mismatch('cli_arguments')
  const localObservation = observeLocalWorktreeV1(identity)
  const observed = bindExpectedPullRequestV1(identity, localObservation, fetchExpectedPullRequestWithGh)
  assertBoundedExecutionContextV1(identity, observed)
  process.stdout.write(`${JSON.stringify({
    admitted: true,
    canonical_task_id: identity.canonical_task_id,
    objective_digest: identity.objective_digest,
    authorized_paths_digest: identity.authorized_paths_digest,
    execution_instance_id: identity.execution_instance_id,
  })}\n`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    runCli()
  } catch (error) {
    process.stderr.write(`${error?.code === EXECUTION_IDENTITY_MISMATCH_V1 ? EXECUTION_IDENTITY_MISMATCH_V1 : 'execution_identity_error'}\n`)
    process.exitCode = 1
  }
}
