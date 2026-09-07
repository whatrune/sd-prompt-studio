import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  parseCanonicalTaskIssueBodyV1,
} from './run-protected-transition-admission-v1.mjs'
import {
  assertBoundedExecutionContextV1,
  bindExpectedPullRequestV1,
  createBoundedExecutionIdentityV1,
  observeLocalWorktreeV1,
} from './task-execution-context-v1.mjs'

const NORMAL_REQUEST_FIELDS_V1 = Object.freeze([
  'record_type', 'version', 'operation', 'repository', 'task_issue_number', 'objective',
  'authorized_paths', 'changed_paths', 'correction_context', 'branch', 'worktree_path', 'git_common_dir', 'expected_base',
  'expected_head', 'expected_pr', 'expected_remote_head', 'execution_instance_id',
  'validation_results', 'operation_count',
])
const NORMAL_OPERATIONS_V1 = Object.freeze(['COMMIT_VALIDATED_TREE', 'PUBLISH_VALIDATED_COMMIT'])
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/
const FULL_HEAD = /^[0-9a-f]{40}$/
const BRANCH = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/

const positiveInteger = (value) => Number.isSafeInteger(value) && value > 0
const sameFields = (value, fields) => (
  value !== null && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).sort().join('\0') === [...fields].sort().join('\0')
)
const isNormalizedRepositoryPathV1 = (value) => {
  if (typeof value !== 'string' || value.length === 0 || value.includes('\0') || value.includes('\\')) return false
  if (value.startsWith('/') || value.endsWith('/')) return false
  return value.split('/').every((segment) => segment.length > 0 && segment !== '.' && segment !== '..')
}
const isValidBranchV1 = (value) => (
  typeof value === 'string' && BRANCH.test(value) && !value.includes('..') &&
  !value.includes('//') && !value.includes('@{') && !value.endsWith('.') &&
  !value.endsWith('/') && !value.endsWith('.lock')
)
const normalizedPathSetV1 = (values) => [...values].sort().join('\0')
const pathsAreSubsetV1 = (subset, superset) => {
  const allowed = new Set(superset)
  return subset.every((value) => allowed.has(value))
}
const splitNullSeparatedV1 = (value) => value.split('\0').filter((item) => item.length > 0)
const normalizedFileSystemPathV1 = (value) => {
  const resolved = path.resolve(value).replaceAll('\\', '/').replace(/\/+$/, '')
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved
}

export const repairWorkingTreePathsV1 = (expectedHead, executeGit) => {
  if (!FULL_HEAD.test(expectedHead ?? '') || typeof executeGit !== 'function') {
    throw new Error('repair_worktree_head_invalid')
  }
  const currentHead = executeGit(['rev-parse', '--verify', 'HEAD'], { encoding: 'utf8' }).trim()
  if (currentHead !== expectedHead) throw new Error('repair_worktree_head_changed')
  try { executeGit(['diff', '--cached', '--quiet', '--']) } catch { throw new Error('repair_index_not_clean') }
  const tracked = splitNullSeparatedV1(executeGit(
    ['diff', '--name-only', '-z', '--no-renames', 'HEAD', '--'], { encoding: 'utf8' },
  ))
  const untracked = splitNullSeparatedV1(executeGit(
    ['ls-files', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' },
  ))
  return Object.freeze([...new Set([...tracked, ...untracked])].sort())
}

const originRepositoryV1 = (output) => {
  if (typeof output !== 'string') throw new Error('origin_repository_ambiguous')
  const urls = output.trim().split(/\r?\n/).filter(Boolean)
  if (urls.length !== 1) throw new Error('origin_repository_ambiguous')
  const value = urls[0]
  const match = value.match(/^(?:https:\/\/(?:[^/@]+@)?github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?$/i)
  if (!match) throw new Error('origin_repository_unsupported')
  return `${match[1]}/${match[2]}`.toLowerCase()
}

const resultV1 = (status, reason, counters, extra = {}) => Object.freeze({
  status,
  reason,
  mutation_count: counters.mutation_count,
  protected_operation_count: counters.protected_operation_count,
  ...extra,
})

const parseNormalTaskExecutionRequestV1 = (request) => {
  if (!sameFields(request, NORMAL_REQUEST_FIELDS_V1)) throw new Error('normal_task_execution_request_schema_invalid')
  if (
    request.record_type !== 'normal_task_execution_request_v1' || request.version !== 1 ||
    !NORMAL_OPERATIONS_V1.includes(request.operation) || !REPOSITORY.test(request.repository ?? '') ||
    !positiveInteger(request.task_issue_number) || typeof request.objective !== 'string' ||
    request.objective.trim().length === 0 || request.objective !== request.objective.trim() ||
    !Array.isArray(request.authorized_paths) || request.authorized_paths.length === 0 ||
    !request.authorized_paths.every(isNormalizedRepositoryPathV1) ||
    new Set(request.authorized_paths).size !== request.authorized_paths.length ||
    !Array.isArray(request.changed_paths) || request.changed_paths.length === 0 ||
    !request.changed_paths.every(isNormalizedRepositoryPathV1) ||
    new Set(request.changed_paths).size !== request.changed_paths.length ||
    !isValidBranchV1(request.branch) || typeof request.worktree_path !== 'string' ||
    !path.isAbsolute(request.worktree_path) || request.worktree_path.includes('\0') ||
    typeof request.git_common_dir !== 'string' || !path.isAbsolute(request.git_common_dir) ||
    !FULL_HEAD.test(request.expected_base ?? '') || !FULL_HEAD.test(request.expected_head ?? '') ||
    !(request.expected_pr === null || positiveInteger(request.expected_pr)) ||
    !(request.expected_remote_head === null || FULL_HEAD.test(request.expected_remote_head ?? '')) ||
    typeof request.execution_instance_id !== 'string' || request.execution_instance_id.length === 0 ||
    !assertPassingValidationResultsV1(request.validation_results, request.expected_head) ||
    request.operation_count !== 1
  ) throw new Error('normal_task_execution_request_value_invalid')
  if (
    (request.expected_pr === null) !== (request.expected_remote_head === null)
  ) throw new Error('normal_task_execution_request_value_invalid')
  const authorizedPaths = [...request.authorized_paths].sort()
  const changedPaths = [...request.changed_paths].sort()
  if (!pathsAreSubsetV1(changedPaths, authorizedPaths)) throw new Error('changed_paths_outside_authority')
  if (request.expected_pr === null && !samePathsV1(changedPaths, authorizedPaths)) {
    throw new Error('initial_changed_paths_mismatch')
  }
  const correctionContext = normalizeCorrectionContextV1(request.correction_context)
  if ((request.expected_pr === null) !== (correctionContext === null)) {
    throw new Error('correction_context_invalid')
  }
  return Object.freeze({
    ...request,
    authorized_paths: Object.freeze(authorizedPaths),
    changed_paths: Object.freeze(changedPaths),
    correction_context: correctionContext,
  })
}

const normalizeCorrectionContextV1 = (value) => {
  if (value === null) return null
  const fields = Object.hasOwn(value ?? {}, 'finding_cursor') ? ['finding_cursor', 'finding_head', 'active_thread_ids'] : ['finding_head', 'active_thread_ids']
  if (
    !sameFields(value, fields) || (value.finding_cursor != null && (typeof value.finding_cursor !== 'string' || value.finding_cursor.length === 0)) ||
    !FULL_HEAD.test(value.finding_head ?? '') || !Array.isArray(value.active_thread_ids) ||
    value.active_thread_ids.length === 0 ||
    !value.active_thread_ids.every((item) => typeof item === 'string' && item.length > 0) ||
    new Set(value.active_thread_ids).size !== value.active_thread_ids.length
  ) throw new Error('correction_context_invalid')
  return Object.freeze({
    finding_cursor: value.finding_cursor ?? null,
    finding_head: value.finding_head,
    active_thread_ids: Object.freeze([...value.active_thread_ids].sort()),
  })
}

const assertNormalTaskExecutionAuthorityV1 = ({ request, task, actor }) => {
  if (
    task === null || typeof task !== 'object' || task.number !== request.task_issue_number ||
    task.state !== 'open' || task.pull_request !== undefined || task.user?.login !== 'whatrune' ||
    task.author_association !== 'OWNER' || actor?.login !== 'whatrune' || typeof task.body !== 'string'
  ) throw new Error('normal_task_execution_authority_invalid')
  let parsed
  try {
    parsed = parseCanonicalTaskIssueBodyV1({ body: task.body, mode: 'BOUND_FINAL' })
  } catch {
    throw new Error('normal_task_execution_authority_invalid')
  }
  const authority = parsed.task_authority
  const predelegation = parsed.normal_execution_predelegation
  const grant = predelegation.allowed_changes
  if (
    authority.task_issue !== request.task_issue_number || authority.repository !== request.repository ||
    authority.objective !== request.objective || !samePathsV1(authority.authorized_paths, request.authorized_paths) ||
    predelegation.task_id !== `TASK-${request.task_issue_number}-NORMAL-EXECUTION-PREDELEGATION` ||
    grant.repository !== request.repository || grant.task_issue !== request.task_issue_number ||
    grant.head_branch !== request.branch ||
    normalizedFileSystemPathV1(grant.worktree_path) !== normalizedFileSystemPathV1(request.worktree_path) ||
    !FULL_HEAD.test(grant.expected_base ?? '') || !samePathsV1(grant.authorized_paths, request.authorized_paths) ||
    grant.authorized_actor !== actor.login || grant.execution_identity_contract !== 'BOUNDED_EXECUTION_IDENTITY_V1' ||
    grant.fallback_allowed !== false
  ) throw new Error('normal_task_execution_authority_invalid')
  return Object.freeze({ authority, predelegation })
}

const samePathsV1 = (left, right) => (
  Array.isArray(left) && Array.isArray(right) && normalizedPathSetV1(left) === normalizedPathSetV1(right)
)

const admitNormalExecutionIdentityV1 = async ({ request, host }) => {
  const identity = createBoundedExecutionIdentityV1({
    repository: request.repository.toLowerCase(),
    canonical_task_id: request.task_issue_number,
    objective: request.objective,
    branch: request.branch,
    worktree_path: request.worktree_path,
    git_common_dir: request.git_common_dir,
    authorized_paths: request.authorized_paths,
    expected_base: request.expected_base,
    expected_pr: request.expected_pr,
    expected_head: request.expected_head,
    expected_remote_head: request.expected_remote_head,
    execution_instance_id: request.execution_instance_id,
  })
  const observed = await host.observeExecution(identity)
  assertBoundedExecutionContextV1(identity, observed)
  return identity
}

const assertFreshBaseRebindV1 = ({ initialBase, request, host }) => {
  if (initialBase === request.expected_base) return
  try {
    host.git(['merge-base', '--is-ancestor', initialBase, request.expected_base])
  } catch {
    throw new Error('fresh_base_not_descendant')
  }
  let advancedPaths
  try {
    advancedPaths = splitNullSeparatedV1(host.git(
      ['diff', '--name-only', '-z', '--no-renames', initialBase, request.expected_base, '--'],
      { encoding: 'utf8' },
    ))
  } catch {
    throw new Error('fresh_base_diff_unavailable')
  }
  if (advancedPaths.some((value) => request.authorized_paths.includes(value))) {
    throw new Error('fresh_base_compatibility_required')
  }
}

const assertPassingValidationResultsV1 = (values, expectedHead) => (
  Array.isArray(values) && values.length > 0 && values.every((value) => (
    value !== null && typeof value === 'object' && !Array.isArray(value) &&
    typeof value.command === 'string' && value.command.length > 0 && value.result === 'PASS' &&
    value.exact_head === expectedHead
  ))
)

const assertExistingNormalTaskPullV1 = ({ pull, request, expectedHead }) => {
  if (
    pull === null || typeof pull !== 'object' || pull.number !== request.expected_pr ||
    pull.state !== 'open' || pull.draft !== false || pull.merged !== false ||
    pull.base?.ref !== 'main' || pull.base?.sha !== request.expected_base ||
    pull.base?.repo?.full_name !== request.repository || pull.head?.ref !== request.branch ||
    pull.head?.sha !== expectedHead || pull.head?.repo?.full_name !== request.repository
  ) throw new Error('existing_pull_request_binding_mismatch')
  return pull
}

const normalPullBodyV1 = (request) => `## Purpose

Implement Task #${request.task_issue_number} from its exact authorized scope.

## User impact

Delivers the validated Task result without changing the validated commit.

## Changes

${request.authorized_paths.map((value) => `- \`${value}\``).join('\n')}

## Validation

Exact-scope validation completed; current-HEAD checks and Fresh Review remain required after publication.

## Unresolved items

None.`

const validNormalPullV1 = ({ pull, request }) => (
  pull !== null && typeof pull === 'object' && positiveInteger(pull.number) &&
  typeof pull.html_url === 'string' && pull.state === 'open' && pull.draft === false &&
  pull.merged === false && pull.base?.ref === 'main' && pull.base?.sha === request.expected_base &&
  pull.base?.repo?.full_name === request.repository && pull.head?.ref === request.branch &&
  pull.head?.sha === request.expected_head && pull.head?.repo?.full_name === request.repository &&
  pull.body === normalPullBodyV1(request)
)

export const executeNormalTaskExecutionOperatorV1 = async (rawRequest, host) => {
  const counters = { mutation_count: 0, protected_operation_count: 0 }
  const stop = (reason, extra = {}) => resultV1('STOP', reason, counters, extra)
  let request
  try { request = parseNormalTaskExecutionRequestV1(rawRequest) } catch (error) {
    return stop(error.message)
  }
  if (
    host === null || typeof host !== 'object' || typeof host.api !== 'function' ||
    typeof host.git !== 'function' || typeof host.observeExecution !== 'function' ||
    host.repository !== request.repository ||
    normalizedFileSystemPathV1(host.worktreePath ?? '') !== normalizedFileSystemPathV1(request.worktree_path)
  ) return stop('normal_task_execution_host_invalid')

  let admittedAuthority
  try {
    const [actor, task] = await Promise.all([
      host.api('user'),
      host.api(`repos/${request.repository}/issues/${request.task_issue_number}`),
    ])
    admittedAuthority = assertNormalTaskExecutionAuthorityV1({ request, task, actor })
    const commitGrant = admittedAuthority.predelegation.allowed_changes.allowed_operations.validated_tree_commit
    if (
      request.expected_pr !== null && !samePathsV1(request.changed_paths, request.authorized_paths) &&
      commitGrant.correction_delta_subset_allowed !== true
    ) throw new Error('correction_delta_subset_not_authorized')
    assertFreshBaseRebindV1({
      initialBase: admittedAuthority.predelegation.allowed_changes.expected_base,
      request,
      host,
    })
    await admitNormalExecutionIdentityV1({ request, host })
    if (request.expected_pr !== null) {
      assertExistingNormalTaskPullV1({
        pull: await host.api(`repos/${request.repository}/pulls/${request.expected_pr}`),
        request,
        expectedHead: request.expected_remote_head,
      })
    }
  } catch (error) {
    return stop(error?.code === 'execution_identity_mismatch' ? error.code : error?.message ?? 'normal_task_execution_admission_failed')
  }

  if (request.operation === 'COMMIT_VALIDATED_TREE') {
    let changedPaths
    try {
      changedPaths = repairWorkingTreePathsV1(
        request.expected_head,
        (args, options = undefined) => host.git(args, options),
      )
      if (!samePathsV1(changedPaths, request.changed_paths)) throw new Error('changed_paths_mismatch')
      host.git(['add', '--', ...request.changed_paths])
      const staged = splitNullSeparatedV1(host.git(
        ['diff', '--cached', '--name-only', '-z', '--no-renames', 'HEAD', '--'],
        { encoding: 'utf8' },
      ))
      if (!samePathsV1(staged, request.changed_paths)) throw new Error('staged_paths_mismatch')
    } catch (error) {
      return stop(error?.message ?? 'validated_tree_preflight_failed')
    }
    counters.mutation_count = 1
    counters.protected_operation_count = 1
    try { host.git(['commit', '-m', `Implement Task #${request.task_issue_number}`]) } catch {
      return stop('commit_failed')
    }
    try {
      const committedHead = host.git(['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
      const parent = host.git(['rev-parse', 'HEAD^'], { encoding: 'utf8' }).trim()
      const committedPaths = splitNullSeparatedV1(host.git(
        ['diff', '--name-only', '-z', '--no-renames', request.expected_head, committedHead, '--'],
        { encoding: 'utf8' },
      ))
      const status = host.git(['status', '--porcelain=v1', '-z'], { encoding: 'utf8' })
      if (
        !FULL_HEAD.test(committedHead) || committedHead === request.expected_head || parent !== request.expected_head ||
        !samePathsV1(committedPaths, request.changed_paths) || status !== ''
      ) return stop('commit_result_invalid', { committed_head: committedHead })
      return resultV1('SUCCESS', 'validated_tree_committed', counters, {
        task_issue_number: request.task_issue_number,
        branch: request.branch,
        committed_head: committedHead,
        parent_head: parent,
        execution_instance_id: request.execution_instance_id,
        changed_paths: request.changed_paths,
        correction_context: request.correction_context,
      })
    } catch {
      return stop('commit_result_invalid')
    }
  }

  try {
    const status = host.git(['status', '--porcelain=v1', '-z'], { encoding: 'utf8' })
    const head = host.git(['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
    if (status !== '' || head !== request.expected_head) throw new Error('validated_tree_binding_mismatch')
    const previousHead = request.expected_remote_head ?? request.expected_base
    const parent = host.git(['rev-parse', 'HEAD^'], { encoding: 'utf8' }).trim()
    const reviewedPaths = splitNullSeparatedV1(host.git(
      ['diff', '--name-only', '-z', '--no-renames', previousHead, request.expected_head, '--'],
      { encoding: 'utf8' },
    ))
    if (parent !== previousHead || !samePathsV1(reviewedPaths, request.changed_paths)) {
      throw new Error('validated_delta_binding_mismatch')
    }
    if (request.expected_pr !== null) {
      try {
        host.git(['merge-base', '--is-ancestor', request.expected_remote_head, request.expected_head])
      } catch {
        throw new Error('successor_head_not_descendant')
      }
    }
    const remote = remoteBranchStateV1(host.git(
      ['ls-remote', '--heads', 'origin', `refs/heads/${request.branch}`], { encoding: 'utf8' },
    ), request.branch)
    if (request.expected_pr === null) {
      if (remote.kind === 'PRESENT') throw new Error('remote_branch_already_exists')
      if (remote.kind !== 'ABSENT') throw new Error('remote_branch_state_ambiguous')
    } else if (remote.kind !== 'PRESENT' || remote.head !== request.expected_remote_head) {
      throw new Error('remote_head_mismatch')
    }
  } catch (error) {
    return stop(error?.message ?? 'publication_preflight_failed')
  }
  counters.mutation_count = 1
  counters.protected_operation_count = 1
  try {
    const output = host.git([
      'push', '--porcelain',
      `--force-with-lease=refs/heads/${request.branch}:${request.expected_remote_head ?? ''}`,
      'origin', `HEAD:refs/heads/${request.branch}`,
    ], { encoding: 'utf8' })
    if (
      typeof output !== 'string' ||
      (request.expected_pr === null ? !output.includes('[new branch]') : !output.includes(request.branch))
    ) throw new Error('push_unconfirmed')
  } catch {
    return stop('push_failed')
  }
  try {
    const remote = remoteBranchStateV1(host.git(
      ['ls-remote', '--heads', 'origin', `refs/heads/${request.branch}`], { encoding: 'utf8' },
    ), request.branch)
    if (remote.kind !== 'PRESENT' || remote.head !== request.expected_head) throw new Error('remote_head_mismatch')
  } catch (error) {
    return stop(error.message)
  }
  if (request.expected_pr !== null) {
    let correctedPull
    try { correctedPull = await host.api(`repos/${request.repository}/pulls/${request.expected_pr}`) } catch {
      return stop('pull_request_refetch_failed', { pr_number: request.expected_pr })
    }
    try {
      assertExistingNormalTaskPullV1({ pull: correctedPull, request, expectedHead: request.expected_head })
    } catch (error) {
      return stop(error.message, { pr_number: request.expected_pr })
    }
    return resultV1('SUCCESS', 'validated_correction_published', counters, {
      task_issue_number: request.task_issue_number,
      branch: request.branch,
      pushed_head: request.expected_head,
      pr_number: correctedPull.number,
      pr_url: correctedPull.html_url,
      execution_instance_id: request.execution_instance_id,
      changed_paths: request.changed_paths,
      correction_context: request.correction_context,
    })
  }
  counters.mutation_count = 2
  let created
  try {
    created = await host.api(`repos/${request.repository}/pulls`, {
      method: 'POST',
      body: {
        title: `Task #${request.task_issue_number}: ${request.objective}`,
        head: request.branch,
        base: 'main',
        body: normalPullBodyV1(request),
        draft: false,
      },
    })
  } catch {
    return stop('pull_request_creation_failed')
  }
  if (!positiveInteger(created?.number)) return stop('pull_request_identity_invalid')
  let freshPull
  try { freshPull = await host.api(`repos/${request.repository}/pulls/${created.number}`) } catch {
    return stop('pull_request_refetch_failed', { pr_number: created.number })
  }
  if (!validNormalPullV1({ pull: freshPull, request }) || freshPull.html_url !== created.html_url) {
    return stop('pull_request_binding_mismatch', { pr_number: created.number })
  }
  return resultV1('SUCCESS', 'validated_commit_published', counters, {
    task_issue_number: request.task_issue_number,
    branch: request.branch,
    pushed_head: request.expected_head,
    pr_number: freshPull.number,
    pr_url: freshPull.html_url,
    execution_instance_id: request.execution_instance_id,
    changed_paths: request.changed_paths,
    correction_context: request.correction_context,
  })
}

const assertNoDuplicateTopLevelKeysV1 = (source) => {
  let objectDepth = 0
  let arrayDepth = 0
  let inString = false
  let escaped = false
  let stringStart = -1
  const keys = new Set()
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    if (inString) {
      if (escaped) {
        escaped = false
      } else if (character === '\\') {
        escaped = true
      } else if (character === '"') {
        inString = false
        if (objectDepth === 1 && arrayDepth === 0) {
          let next = index + 1
          while (/\s/.test(source[next] ?? '')) next += 1
          if (source[next] === ':') {
            const key = JSON.parse(source.slice(stringStart, index + 1))
            if (keys.has(key)) throw new Error('request_duplicate_field')
            keys.add(key)
          }
        }
      }
      continue
    }
    if (character === '"') {
      inString = true
      stringStart = index
    } else if (character === '{') {
      objectDepth += 1
    } else if (character === '}') {
      objectDepth -= 1
    } else if (character === '[') {
      arrayDepth += 1
    } else if (character === ']') {
      arrayDepth -= 1
    }
  }
}

const readRequestFileV1 = (file) => {
  if (typeof file !== 'string' || !path.isAbsolute(file)) throw new Error('request_file_invalid')
  const source = readFileSync(file, 'utf8')
  let request
  try {
    request = JSON.parse(source)
    assertNoDuplicateTopLevelKeysV1(source)
  } catch (error) {
    if (error?.message === 'request_duplicate_field') throw error
    throw new Error('request_json_invalid')
  }
  return request
}

const remoteBranchStateV1 = (output, branch) => {
  if (typeof output !== 'string') return Object.freeze({ kind: 'INVALID' })
  const lines = output.trim().split(/\r?\n/).filter(Boolean)
  if (lines.length === 0) return Object.freeze({ kind: 'ABSENT' })
  if (lines.length !== 1) return Object.freeze({ kind: 'INVALID' })
  const match = lines[0].match(/^([0-9a-f]{40})\s+(refs\/heads\/[A-Za-z0-9._/-]+)$/)
  if (!match || match[2] !== `refs/heads/${branch}`) return Object.freeze({ kind: 'INVALID' })
  return Object.freeze({ kind: 'PRESENT', head: match[1] })
}

export const productionHostV1 = (environment, dependencies = {}) => {
  const token = environment.GH_TOKEN
  const repository = environment.GITHUB_REPOSITORY
  if (!token || !REPOSITORY.test(repository ?? '')) throw new Error('production_environment_invalid')
  const fetchImplementation = dependencies.fetch ?? fetch
  const executeGit = dependencies.execFileSync ?? execFileSync
  const worktreePath = dependencies.cwd ?? process.cwd()
  const observeLocalWorktree = dependencies.observeLocalWorktree ?? observeLocalWorktreeV1
  const api = async (endpoint, options = undefined) => {
    const response = await fetchImplementation(`https://api.github.com/${endpoint}`, {
      method: options?.method ?? 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'bootstrap-publication-operator-v1',
      },
      ...(options?.body ? { body: JSON.stringify(options.body) } : {}),
    })
    if (!response.ok) throw new Error(`github_api_${response.status}`)
    return response.status === 204 ? null : response.json()
  }
  const observeExecution = async (identity) => {
    const local = observeLocalWorktree(identity)
    const pull = identity.expected_pr === null
      ? null
      : await api(`repos/${identity.repository}/pulls/${identity.expected_pr}`)
    return bindExpectedPullRequestV1(identity, local, () => pull)
  }
  return Object.freeze({
    repository,
    worktreePath,
    api,
    observeExecution,
    git: (args, options = undefined) => executeGit('git', args, {
      cwd: worktreePath,
      ...options,
    }),
  })
}

const isMainV1 = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMainV1) {
  const counters = { mutation_count: 0, protected_operation_count: 0 }
  try {
    if (process.argv.length !== 4 || process.argv[2] !== '--request-file') throw new Error('cli_arguments_invalid')
    const rawRequest = readRequestFileV1(process.argv[3])
    const result = await executeNormalTaskExecutionOperatorV1(rawRequest, productionHostV1(process.env))
    process.stdout.write(`${JSON.stringify(result)}\n`)
    if (result.status !== 'SUCCESS') process.exitCode = 1
  } catch (error) {
    process.stdout.write(`${JSON.stringify(resultV1('STOP', error?.message ?? 'operator_failed', counters))}\n`)
    process.exitCode = 1
  }
}
