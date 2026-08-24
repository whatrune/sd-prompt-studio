import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseDocument } from 'yaml'
import {
  acquirePrePrBootstrapPublicationDecisionV1,
  assertMinimalGovernanceProductOwnerV1,
  extractProtectedTransitionTaskStateV1,
  isPrePrBootstrapPublicationDecisionCandidateV1,
  repairWorkingTreePathsV1,
} from './run-protected-transition-admission-v1.mjs'

const REQUEST_FIELDS_V1 = Object.freeze([
  'record_type',
  'version',
  'repository',
  'task_issue_number',
  'authorized_paths',
  'branch',
  'reviewed_worktree_path',
  'base_branch',
  'expected_parent_head',
  'publication_authority_comment_id',
  'publication_authority_url',
  'publication_authority_body_sha256',
  'operation_count',
])
const INITIAL_STATE_BINDING_FIELDS_V1 = Object.freeze([
  'task_issue_number', 'pr_number', 'observed_head', 'authorized_paths',
])
const STATE_START = '<!-- protected-transition-task-state-v1:start -->'
const STATE_END = '<!-- protected-transition-task-state-v1:end -->'
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/
const FULL_HEAD = /^[0-9a-f]{40}$/
const SHA256 = /^[0-9a-f]{64}$/
const BRANCH = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/

const positiveInteger = (value) => Number.isSafeInteger(value) && value > 0
const occurrenceCount = (text, needle) => text.split(needle).length - 1
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
const splitNullSeparatedV1 = (value) => value.split('\0').filter((item) => item.length > 0)
const sha256V1 = (value) => createHash('sha256').update(value, 'utf8').digest('hex')
const normalizedFileSystemPathV1 = (value) => {
  const resolved = path.resolve(value).replaceAll('\\', '/').replace(/\/+$/, '')
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved
}

const projectBootstrapPublicationOwnerV1 = async (comment, request, host) => {
  assertMinimalGovernanceProductOwnerV1(comment, { requireAssociation: true })
  if (isPrePrBootstrapPublicationDecisionCandidateV1(comment?.body)) {
    const chain = await acquirePrePrBootstrapPublicationDecisionV1({
      decisionComment: comment,
      repository: request.repository,
      taskIssueNumber: request.task_issue_number,
      host,
    })
    const decision = chain.decision
    if (
      comment.id !== request.publication_authority_comment_id ||
      comment.html_url !== request.publication_authority_url ||
      chain.decision_body_sha256 !== request.publication_authority_body_sha256 ||
      decision.repository !== request.repository || decision.task_issue_number !== request.task_issue_number ||
      decision.exact_baseline !== request.expected_parent_head || decision.branch !== request.branch ||
      normalizedFileSystemPathV1(decision.worktree) !== normalizedFileSystemPathV1(request.reviewed_worktree_path) ||
      !sameFields(request, REQUEST_FIELDS_V1) ||
      normalizedPathSetV1(decision.authorized_paths) !== normalizedPathSetV1(request.authorized_paths) ||
      decision.publication_allowed !== true || decision.operation_count !== request.operation_count
    ) throw new Error('bootstrap_publication_owner_invalid')
    return Object.freeze({
      kind: 'PRE_PR_BOOTSTRAP_PUBLICATION_DECISION',
      comment_id: comment.id,
      source_url: comment.html_url,
      body_sha256: chain.decision_body_sha256,
      authorized_paths: Object.freeze([...decision.authorized_paths]),
      validation_results: chain.validation_results,
      result_url: chain.result_url,
      unresolved_items: chain.result.unperformed_items.length,
    })
  }
  const blocks = typeof comment?.body === 'string'
    ? [...comment.body.matchAll(/```yaml\r?\n([\s\S]*?)\r?\n```/g)]
    : []
  if (blocks.length !== 1) throw new Error('bootstrap_publication_owner_invalid')
  const document = parseDocument(blocks[0][1], { uniqueKeys: true })
  if (document.errors.length !== 0) throw new Error('bootstrap_publication_owner_invalid')
  const owner = document.toJS()
  const taskUrl = `https://github.com/${request.repository}/issues/${request.task_issue_number}`
  const taskApiUrl = `https://api.github.com/repos/${request.repository}/issues/${request.task_issue_number}`
  const paths = owner?.authorized_paths
  if (
    owner === null || typeof owner !== 'object' || Array.isArray(owner) ||
    comment.id !== request.publication_authority_comment_id ||
    comment.html_url !== request.publication_authority_url || comment.issue_url !== taskApiUrl ||
    owner.task_id !== `TASK-${request.task_issue_number}-BOOTSTRAP-PUBLICATION-OPERATOR-V1` ||
    owner.record_type !== 'task_assignment' ||
    owner.authoring_role !== 'Product Owner / Publication Authorizer' ||
    owner.authority_source !== taskUrl || owner.canonical_record !== comment.html_url ||
    owner.repository !== request.repository || owner.task_issue !== taskUrl ||
    owner.requested_by !== 'Product Owner' || owner.assigned_role !== 'Publication Operator' ||
    owner.authority_kind !== 'BOOTSTRAP_PUBLICATION' ||
    owner.exact_parent !== request.expected_parent_head || owner.target_base_ref !== request.base_branch ||
    owner.branch !== request.branch ||
    typeof owner.worktree !== 'string' || owner.worktree.length === 0 ||
    normalizedFileSystemPathV1(owner.worktree ?? '') !== normalizedFileSystemPathV1(request.reviewed_worktree_path) ||
    owner.publication_allowed !== true || owner.bootstrap_publication_count !== request.operation_count ||
    owner.commit_count !== 1 || owner.push_count !== 1 ||
    owner.pr_creation_allowed !== true || owner.pr_creation_count !== 1 ||
    owner.status !== 'authorized_for_bootstrap_publication_only' ||
    owner.review_decision !== 'APPROVE' || owner.blocking_finding_count !== 0 ||
    owner.remaining_finding_count !== 0 || owner.unknown_count !== 0 ||
    !positiveInteger(owner.focused_bootstrap_operator_assertions) ||
    !['PASS', 'PASS_REUSED'].includes(owner.focused_bootstrap_operator_result) ||
    !['PASS', 'PASS_REUSED'].includes(owner.git_diff_check) ||
    owner.broad_validation_rerun_allowed !== false ||
    !Array.isArray(paths) || paths.length === 0 || !paths.every(isNormalizedRepositoryPathV1) ||
    new Set(paths).size !== paths.length ||
    normalizedPathSetV1(paths) !== normalizedPathSetV1(request.authorized_paths)
  ) throw new Error('bootstrap_publication_owner_invalid')
  return Object.freeze({
    kind: 'LEGACY_TASK_ASSIGNMENT',
    comment_id: comment.id,
    source_url: comment.html_url,
    body_sha256: sha256V1(comment.body),
    authorized_paths: Object.freeze([...paths]),
    focused_assertions: owner.focused_bootstrap_operator_assertions,
    focused_result: owner.focused_bootstrap_operator_result,
    git_diff_check: owner.git_diff_check,
    unresolved_items: 0,
  })
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

const bootstrapValidationBodyV1 = (owner) => owner.kind === 'PRE_PR_BOOTSTRAP_PUBLICATION_DECISION'
  ? `- Authority-bound pre-PR validations: ${owner.validation_results.length}/${owner.validation_results.length} PASS_REUSED
- Result Handoff: ${owner.result_url}
- Broad validation: not rerun`
  : `- Focused bootstrap-publication operator: ${owner.focused_assertions} assertions ${owner.focused_result}
- git diff --check: ${owner.git_diff_check}
- Broad validation: not rerun`

const bootstrapPullBodyV1 = (request, owner) => `## Purpose

Bootstrap-publication operator implementation for Task #${request.task_issue_number}.

## User impact

Publishes the admitted bootstrap operator implementation through one commit, one create-only branch push, and one Draft PR.

## Changes

${request.authorized_paths.map((value) => `- \`${value}\``).join('\n')}

## Validation

${bootstrapValidationBodyV1(owner)}

## Unresolved items

None.`

const resultV1 = (status, reason, counters, extra = {}) => Object.freeze({
  status,
  reason,
  mutation_count: counters.mutation_count,
  protected_operation_count: counters.protected_operation_count,
  ...extra,
})

const parseBootstrapPublicationRequestV1 = (request) => {
  if (!sameFields(request, REQUEST_FIELDS_V1)) throw new Error('request_schema_invalid')
  if (
    request.record_type !== 'bootstrap_publication_request_v1' ||
    request.version !== 1 ||
    !REPOSITORY.test(request.repository ?? '') ||
    !positiveInteger(request.task_issue_number) ||
    !Array.isArray(request.authorized_paths) || request.authorized_paths.length === 0 ||
    !request.authorized_paths.every(isNormalizedRepositoryPathV1) ||
    new Set(request.authorized_paths).size !== request.authorized_paths.length ||
    !isValidBranchV1(request.branch) ||
    typeof request.reviewed_worktree_path !== 'string' ||
    request.reviewed_worktree_path.includes('\0') || !path.isAbsolute(request.reviewed_worktree_path) ||
    request.base_branch !== 'main' ||
    !FULL_HEAD.test(request.expected_parent_head ?? '') ||
    !positiveInteger(request.publication_authority_comment_id) ||
    typeof request.publication_authority_url !== 'string' || request.publication_authority_url.length === 0 ||
    !SHA256.test(request.publication_authority_body_sha256 ?? '') ||
    request.operation_count !== 1
  ) throw new Error('request_value_invalid')
  return Object.freeze({
    ...request,
    authorized_paths: Object.freeze([...request.authorized_paths]),
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

const parseRequestFileV1 = (file) => {
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
  return parseBootstrapPublicationRequestV1(request)
}

const initialStateV1 = (binding) => Object.freeze({
  record_type: 'protected_transition_task_state_v1',
  task_issue_number: binding.task_issue_number,
  pr_number: binding.pr_number,
  observed_head: binding.observed_head,
  authorized_paths: [...binding.authorized_paths],
  architecture_status: 'APPROVED',
  implementation_authorized: true,
  review_status: 'PENDING',
  reviewed_head: null,
  review_blocker_count: null,
})

export const insertInitialProtectedTransitionTaskStateV1 = (body, binding) => {
  if (
    typeof body !== 'string' || occurrenceCount(body, STATE_START) !== 0 ||
    occurrenceCount(body, STATE_END) !== 0 || !sameFields(binding, INITIAL_STATE_BINDING_FIELDS_V1) ||
    !positiveInteger(binding.task_issue_number) || !positiveInteger(binding.pr_number) ||
    !FULL_HEAD.test(binding.observed_head ?? '') ||
    !Array.isArray(binding.authorized_paths) || binding.authorized_paths.length === 0 ||
    !binding.authorized_paths.every(isNormalizedRepositoryPathV1) ||
    new Set(binding.authorized_paths).size !== binding.authorized_paths.length
  ) throw new Error('initial_task_state_binding_invalid')
  const state = initialStateV1(binding)
  const block = `${STATE_START}\n\`\`\`json\n${JSON.stringify(state)}\n\`\`\`\n${STATE_END}`
  const updated = body.length === 0 ? block : `${body}\n\n${block}`
  extractProtectedTransitionTaskStateV1(updated)
  return updated
}

const validPullV1 = ({ pull, request, createdPullIdentity, pushedHead, nodeId = undefined }) => (
  pull !== null && typeof pull === 'object' &&
  pull.number === createdPullIdentity.number && pull.html_url === createdPullIdentity.url &&
  typeof pull.node_id === 'string' && pull.node_id.length > 0 &&
  (nodeId === undefined || pull.node_id === nodeId) &&
  pull.state === 'open' && pull.draft === true && pull.merged === false &&
  pull.base?.ref === 'main' && pull.base?.repo?.full_name === request.repository &&
  pull.head?.repo?.full_name === request.repository && pull.head?.sha === pushedHead &&
  typeof pull.body === 'string'
)

const pullEndpointV1 = (repository, prNumber) => `repos/${repository}/pulls/${prNumber}`
const remoteBranchStateV1 = (output, branch) => {
  if (typeof output !== 'string') return Object.freeze({ kind: 'INVALID' })
  const lines = output.trim().split(/\r?\n/).filter(Boolean)
  if (lines.length === 0) return Object.freeze({ kind: 'ABSENT' })
  if (lines.length !== 1) return Object.freeze({ kind: 'INVALID' })
  const match = lines[0].match(/^([0-9a-f]{40})\s+(refs\/heads\/[A-Za-z0-9._/-]+)$/)
  if (!match || match[2] !== `refs/heads/${branch}`) return Object.freeze({ kind: 'INVALID' })
  return Object.freeze({ kind: 'PRESENT', head: match[1] })
}

export const executeBootstrapPublicationOperatorV1 = async (rawRequest, host) => {
  const counters = { mutation_count: 0, protected_operation_count: 0 }
  let request
  try {
    request = parseBootstrapPublicationRequestV1(rawRequest)
  } catch (error) {
    return resultV1('STOP', error.message, counters)
  }
  const stop = (reason, extra = {}) => resultV1('STOP', reason, counters, extra)
  if (
    host === null || typeof host !== 'object' || typeof host.api !== 'function' ||
    typeof host.git !== 'function' || typeof host.repository !== 'string' ||
    typeof host.worktreePath !== 'string'
  ) return stop('host_invalid')

  let authority
  let publicationOwner
  try {
    authority = await host.api(
      `repos/${request.repository}/issues/comments/${request.publication_authority_comment_id}`,
    )
  } catch {
    return stop('publication_authority_refetch_failed')
  }
  if (
    authority?.id !== request.publication_authority_comment_id ||
    authority?.html_url !== request.publication_authority_url ||
    typeof authority?.body !== 'string' ||
    sha256V1(authority.body) !== request.publication_authority_body_sha256
  ) return stop('publication_authority_binding_mismatch')
  try {
    publicationOwner = await projectBootstrapPublicationOwnerV1(authority, request, host)
  } catch {
    return stop('bootstrap_publication_owner_invalid')
  }

  let changedPaths
  try {
    if (host.repository !== request.repository) throw new Error('repository_binding_mismatch')
    if (
      normalizedFileSystemPathV1(host.worktreePath) !==
      normalizedFileSystemPathV1(request.reviewed_worktree_path)
    ) throw new Error('worktree_binding_mismatch')
    const branch = host.git(['branch', '--show-current'], { encoding: 'utf8' }).trim()
    if (branch !== request.branch) throw new Error('branch_binding_mismatch')
    const originRepository = originRepositoryV1(host.git(
      ['remote', 'get-url', '--push', '--all', 'origin'],
      { encoding: 'utf8' },
    ))
    if (originRepository !== request.repository.toLowerCase()) throw new Error('origin_repository_mismatch')
    changedPaths = repairWorkingTreePathsV1(
      request.expected_parent_head,
      (args, options = undefined) => host.git(args, options),
    )
    if (normalizedPathSetV1(changedPaths) !== normalizedPathSetV1(request.authorized_paths)) {
      throw new Error('changed_paths_mismatch')
    }
  } catch (error) {
    return stop(error?.message ?? 'preflight_failed')
  }

  let initialRemoteBranch
  try {
    initialRemoteBranch = remoteBranchStateV1(host.git(
      ['ls-remote', '--heads', 'origin', `refs/heads/${request.branch}`],
      { encoding: 'utf8' },
    ), request.branch)
  } catch {
    return stop('remote_branch_preflight_failed')
  }
  if (initialRemoteBranch.kind === 'PRESENT') return stop('remote_branch_already_exists')
  if (initialRemoteBranch.kind !== 'ABSENT') return stop('remote_branch_state_ambiguous')

  try {
    host.git(['add', '--', ...request.authorized_paths])
    const stagedPaths = splitNullSeparatedV1(host.git(
      ['diff', '--cached', '--name-only', '-z', '--no-renames', 'HEAD', '--'],
      { encoding: 'utf8' },
    ))
    if (normalizedPathSetV1(stagedPaths) !== normalizedPathSetV1(request.authorized_paths)) {
      return stop('staged_paths_mismatch')
    }
  } catch {
    return stop('staging_failed')
  }

  counters.mutation_count = 1
  counters.protected_operation_count = 1
  try {
    host.git(['commit', '-m', `Implement Task #${request.task_issue_number}`])
  } catch {
    return stop('commit_failed')
  }

  let pushedHead
  try {
    pushedHead = host.git(['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
    const parentHead = host.git(['rev-parse', 'HEAD^'], { encoding: 'utf8' }).trim()
    if (!FULL_HEAD.test(pushedHead) || pushedHead === request.expected_parent_head || parentHead !== request.expected_parent_head) {
      return stop('commit_result_invalid')
    }
  } catch {
    return stop('commit_result_invalid')
  }

  counters.mutation_count = 2
  let pushOutput
  try {
    pushOutput = host.git(
      [
        'push',
        '--porcelain',
        `--force-with-lease=refs/heads/${request.branch}:`,
        'origin',
        `HEAD:refs/heads/${request.branch}`,
      ],
      { encoding: 'utf8' },
    )
  } catch {
    return stop('push_failed', { pushed_head: pushedHead })
  }
  if (typeof pushOutput !== 'string' || !pushOutput.includes('[new branch]')) {
    return stop('remote_branch_creation_unconfirmed', { pushed_head: pushedHead })
  }

  let remoteBranch
  try {
    remoteBranch = remoteBranchStateV1(host.git(
      ['ls-remote', '--heads', 'origin', `refs/heads/${request.branch}`],
      { encoding: 'utf8' },
    ), request.branch)
  } catch {
    return stop('remote_head_refetch_failed', { pushed_head: pushedHead })
  }
  if (remoteBranch.kind !== 'PRESENT' || remoteBranch.head !== pushedHead) {
    return stop('remote_head_mismatch', { pushed_head: pushedHead })
  }

  counters.mutation_count = 3
  let createdPull
  try {
    createdPull = await host.api(`repos/${request.repository}/pulls`, {
      method: 'POST',
      body: {
        title: `Task #${request.task_issue_number} bootstrap publication`,
        head: request.branch,
        base: 'main',
        body: bootstrapPullBodyV1(request, publicationOwner),
        draft: true,
      },
    })
  } catch {
    return stop('draft_pr_creation_failed', { pushed_head: pushedHead })
  }
  const createdPullIdentity = Object.freeze({
    number: createdPull?.number,
    url: createdPull?.html_url,
  })
  const prNumber = createdPullIdentity.number
  if (!positiveInteger(prNumber) || typeof createdPullIdentity.url !== 'string' || createdPullIdentity.url.length === 0) {
    return stop('draft_pr_identity_invalid', { pushed_head: pushedHead })
  }

  let freshPull
  try {
    freshPull = await host.api(pullEndpointV1(request.repository, prNumber))
  } catch {
    return stop('draft_pr_refetch_failed', { pushed_head: pushedHead, pr_number: prNumber })
  }
  if (!validPullV1({ pull: freshPull, request, createdPullIdentity, pushedHead })) {
    return stop('draft_pr_binding_mismatch', { pushed_head: pushedHead, pr_number: prNumber })
  }
  const pullNodeId = freshPull.node_id
  if (occurrenceCount(freshPull.body, STATE_START) !== 0 || occurrenceCount(freshPull.body, STATE_END) !== 0) {
    return stop('initial_task_state_cardinality_invalid', { pushed_head: pushedHead, pr_number: prNumber })
  }

  const stateBinding = Object.freeze({
    task_issue_number: request.task_issue_number,
    pr_number: prNumber,
    observed_head: freshPull.head.sha,
    authorized_paths: request.authorized_paths,
  })
  let updatedBody
  let expectedState
  try {
    updatedBody = insertInitialProtectedTransitionTaskStateV1(freshPull.body, stateBinding)
    expectedState = extractProtectedTransitionTaskStateV1(updatedBody)
  } catch {
    return stop('initial_task_state_construction_failed', { pushed_head: pushedHead, pr_number: prNumber })
  }

  counters.mutation_count = 4
  try {
    await host.api(pullEndpointV1(request.repository, prNumber), {
      method: 'PATCH',
      body: { body: updatedBody },
    })
  } catch {
    return stop('pr_body_update_failed', { pushed_head: pushedHead, pr_number: prNumber })
  }

  let finalPull
  try {
    finalPull = await host.api(pullEndpointV1(request.repository, prNumber))
  } catch {
    return stop('final_pr_refetch_failed', { pushed_head: pushedHead, pr_number: prNumber })
  }
  if (
    !validPullV1({
      pull: finalPull,
      request,
      createdPullIdentity,
      pushedHead,
      nodeId: pullNodeId,
    }) || finalPull.body !== updatedBody
  ) {
    return stop('final_pr_binding_mismatch', { pushed_head: pushedHead, pr_number: prNumber })
  }
  let finalState
  try {
    finalState = extractProtectedTransitionTaskStateV1(finalPull.body)
  } catch {
    return stop('final_task_state_invalid', { pushed_head: pushedHead, pr_number: prNumber })
  }
  if (JSON.stringify(finalState) !== JSON.stringify(expectedState)) {
    return stop('final_task_state_mismatch', { pushed_head: pushedHead, pr_number: prNumber })
  }
  return resultV1('SUCCESS', 'bootstrap_publication_complete', counters, {
    repository: request.repository,
    task_issue_number: request.task_issue_number,
    branch: request.branch,
    pushed_head: pushedHead,
    pr_number: prNumber,
    pr_url: finalPull.html_url,
    task_state: finalState,
  })
}

const productionHostV1 = (environment) => {
  const token = environment.GH_TOKEN
  const repository = environment.GITHUB_REPOSITORY
  if (!token || !REPOSITORY.test(repository ?? '')) throw new Error('production_environment_invalid')
  const api = async (endpoint, options = undefined) => {
    const response = await fetch(`https://api.github.com/${endpoint}`, {
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
  return Object.freeze({
    repository,
    worktreePath: process.cwd(),
    api,
    git: (args, options = undefined) => execFileSync('git', args, {
      cwd: process.cwd(),
      ...options,
    }),
  })
}

const isMainV1 = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMainV1) {
  const counters = { mutation_count: 0, protected_operation_count: 0 }
  try {
    if (process.argv.length !== 4 || process.argv[2] !== '--request-file') throw new Error('cli_arguments_invalid')
    const request = parseRequestFileV1(process.argv[3])
    const result = await executeBootstrapPublicationOperatorV1(request, productionHostV1(process.env))
    process.stdout.write(`${JSON.stringify(result)}\n`)
    if (result.status !== 'SUCCESS') process.exitCode = 1
  } catch (error) {
    process.stdout.write(`${JSON.stringify(resultV1('STOP', error?.message ?? 'operator_failed', counters))}\n`)
    process.exitCode = 1
  }
}
