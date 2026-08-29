import assert from 'node:assert/strict'
import { mkdtempSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
  EXECUTION_IDENTITY_MISMATCH_V1,
  admitParallelExecutionsV1,
  assertBoundedExecutionContextV1,
  assertSharedDependencyAccessV1,
  bindExpectedPullRequestV1,
  createBoundedExecutionIdentityV1,
  inspectHistoricalCommitV1,
} from './task-execution-context-v1.mjs'

let assertions = 0
function equal(actual, expected, message) {
  assert.equal(actual, expected, message)
  assertions += 1
}

function deepEqual(actual, expected, message) {
  assert.deepEqual(actual, expected, message)
  assertions += 1
}
function mismatch(fn, predicate) {
  assert.throws(fn, (error) => {
    equal(error.code, EXECUTION_IDENTITY_MISMATCH_V1)
    equal(error.predicate, predicate)
    return true
  })
  assertions += 1
}

const root = realpathSync.native(mkdtempSync(path.join(tmpdir(), 'execution-context-v1-')))
const common = path.join(root, '.git-common')
const worktree455 = path.join(root, 'task-455')
const worktreeOther = path.join(root, 'task-999')
const base = '3aa2c7817011293f5efe4c0010d26711365f8afb'
const head455 = '49fa6f25f93320b49f19c71ff048fadead5c0b9b'
const historical411 = 'fcf799a66ab16863b086700c0c561f3fc3332580'
const paths455 = [
  'data/visual-concept-prompt-tag-bindings-v1.json',
  'src/data/visual-concept-production-advisory-v1.json',
]

function identity(overrides = {}) {
  return createBoundedExecutionIdentityV1({
    repository: 'whatrune/sd-prompt-studio',
    canonical_task_id: '#455',
    objective: ' Bind hair.long production advisory. ',
    branch: 'codex/hair-long-production-advisory-binding-phase-1',
    worktree_path: worktree455,
    git_common_dir: common,
    authorized_paths: paths455,
    expected_base: base,
    expected_pr: 456,
    expected_head: head455,
    execution_instance_id: '11111111-1111-4111-8111-111111111111',
    ...overrides,
  })
}

function observed(id = identity(), overrides = {}) {
  return {
    repository: id.repository,
    canonical_task_id: id.canonical_task_id,
    objective_digest: id.objective_digest,
    branch: id.branch,
    worktree_path: id.worktree_path,
    registered_worktree_path: id.worktree_path,
    git_common_dir: id.git_common_dir,
    authorized_paths: id.authorized_paths,
    remote_main_sha: id.expected_base,
    local_main_sha: historical411,
    head: id.expected_head,
    pr_lookup_attempted: true,
    requested_pr_number: id.expected_pr,
    pr: id.expected_pr === null ? null : {
      number: id.expected_pr,
      repository: id.repository,
      state: 'OPEN',
      merged: false,
      head: id.expected_head,
      base: id.expected_base,
    },
    ...overrides,
  }
}

// Post-publication acquisition calls only the exact expected PR tuple.
{
  const id = identity()
  let fetched = null
  const local = observed(id, { pr_lookup_attempted: false, requested_pr_number: undefined, pr: null })
  const bound = bindExpectedPullRequestV1(id, local, (repository, pullRequest) => {
    fetched = { repository, pullRequest }
    return {
      number: pullRequest,
      state: 'open',
      merged: false,
      head: { sha: id.expected_head },
      base: { sha: id.expected_base, repo: { full_name: id.repository } },
    }
  })
  deepEqual(fetched, { repository: id.repository, pullRequest: id.expected_pr })
  equal(assertBoundedExecutionContextV1(id, bound).admitted, true)

  const prepublication = identity({ expected_pr: null })
  let prepublicationFetchCount = 0
  const prepublicationBound = bindExpectedPullRequestV1(
    prepublication,
    observed(prepublication, { pr_lookup_attempted: false, requested_pr_number: undefined, pr: null }),
    () => { prepublicationFetchCount += 1 },
  )
  equal(prepublicationFetchCount, 0)
  equal(assertBoundedExecutionContextV1(prepublication, prepublicationBound).admitted, true)
}

{
  const id = identity()
  equal(id.objective, 'Bind hair.long production advisory.')
  deepEqual(id.authorized_paths, [...paths455].sort())
  equal(assertBoundedExecutionContextV1(id, observed(id)).admitted, true)
}

// 1-2. Reproduce the #455/#411 same-path contamination and keep history non-current.
{
  const id = identity()
  mismatch(() => assertBoundedExecutionContextV1(id, observed(id, {
    requested_pr_number: 411,
    pr: { number: 411, repository: id.repository, state: 'MERGED', merged: true, head: historical411, base },
  })), 'expected_pr_request')
  const historical = inspectHistoricalCommitV1({ commit: historical411, label: 'historical_diagnostic' })
  equal(historical.current_execution_target, false)
  equal(historical.commit, historical411)
  mismatch(() => inspectHistoricalCommitV1({ commit: historical411, label: 'current' }), 'historical_label')
}

// 3-8. Exact tuple mismatches fail closed at one named predicate.
{
  const id = identity()
  mismatch(() => assertBoundedExecutionContextV1(id, observed(id, { worktree_path: worktreeOther })), 'worktree_path')
  mismatch(() => assertBoundedExecutionContextV1(id, observed(id, { branch: 'codex/other' })), 'branch')
  mismatch(() => assertBoundedExecutionContextV1(id, observed(id, { canonical_task_id: '#411' })), 'canonical_task_id')
  mismatch(() => assertBoundedExecutionContextV1(id, observed(id, { objective_digest: '0'.repeat(64) })), 'objective_digest')
  mismatch(() => assertBoundedExecutionContextV1(id, observed(id, { git_common_dir: path.join(root, 'other-common') })), 'git_common_dir')
  mismatch(() => assertBoundedExecutionContextV1(id, observed(id, { authorized_paths: ['docs/other.md'] })), 'authorized_paths')
  mismatch(() => assertBoundedExecutionContextV1(id, observed(id, { requested_pr_number: 411 })), 'expected_pr_request')
  mismatch(() => assertBoundedExecutionContextV1(id, observed(id, { head: historical411 })), 'expected_head')
  mismatch(() => assertBoundedExecutionContextV1(id, observed(id, { remote_main_sha: historical411 })), 'expected_base_remote_main')
  mismatch(() => assertBoundedExecutionContextV1(id, observed(id, {
    pr: { ...observed(id).pr, state: 'CLOSED' },
  })), 'pr_state')
  mismatch(() => assertBoundedExecutionContextV1(id, observed(id, {
    pr: { ...observed(id).pr, state: 'MERGED', merged: true },
  })), 'pr_state')
}

// Before publication, even a correct-looking PR discovery is prohibited.
{
  const id = identity({ expected_pr: null })
  equal(assertBoundedExecutionContextV1(id, observed(id, {
    pr_lookup_attempted: false,
    requested_pr_number: undefined,
    pr: null,
  })).admitted, true)
  mismatch(() => assertBoundedExecutionContextV1(id, observed(id, {
    pr_lookup_attempted: true,
    requested_pr_number: 456,
    pr: { number: 456 },
  })), 'prepublication_pr_discovery')
}

// 9-10. Disjoint identities run concurrently; overlap needs ordering/reconciliation.
{
  const left = identity()
  const right = identity({
    canonical_task_id: '#999',
    branch: 'codex/other-task',
    worktree_path: worktreeOther,
    authorized_paths: ['docs/other.md'],
    expected_pr: 1000,
    expected_head: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    execution_instance_id: '22222222-2222-4222-8222-222222222222',
  })
  equal(admitParallelExecutionsV1(left, right).admission, 'CONCURRENT')
  const overlap = createBoundedExecutionIdentityV1({
    ...right,
    authorized_paths: [paths455[0]],
  })
  equal(admitParallelExecutionsV1(left, overlap).admission, 'SERIALIZATION_REQUIRED')
  equal(admitParallelExecutionsV1(left, overlap, { dependency_ordered: true }).admission, 'ORDERED')
}

// 11. Local branch "main" is not evidence of remote-main identity.
{
  const id = identity()
  const localMainOnly = observed(id, { local_main_sha: id.expected_base, remote_main_sha: historical411 })
  mismatch(() => assertBoundedExecutionContextV1(id, localMainOnly), 'expected_base_remote_main')
}

// 12. Historical lookup is possible only with an explicit historical label.
{
  equal(inspectHistoricalCommitV1({ commit: historical411, label: 'historical_diagnostic' }).label, 'historical_diagnostic')
}

// Shared dependency reuse is read-only and manifest-exact.
{
  const manifest = 'b'.repeat(40)
  equal(assertSharedDependencyAccessV1({ left_manifest_digest: manifest, right_manifest_digest: manifest, operation: 'read' }).admitted, true)
  mismatch(() => assertSharedDependencyAccessV1({ left_manifest_digest: manifest, right_manifest_digest: manifest, operation: 'install' }), 'shared_dependency_mutation_prohibited')
  mismatch(() => assertSharedDependencyAccessV1({ left_manifest_digest: manifest, right_manifest_digest: 'c'.repeat(40), operation: 'read' }), 'shared_dependency_manifest_identity')
}

process.stdout.write(`task-execution-context-v1: ${assertions} assertions passed\n`)
