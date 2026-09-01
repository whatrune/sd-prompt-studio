import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, realpathSync } from 'node:fs'
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
  projectAutomatedReviewToMergeReadyContinuationV1,
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

function runInputValidation(authorizedPaths) {
  const args = [
    'scripts/task-execution-context-v1.mjs',
    '--repository', 'whatrune/sd-prompt-studio',
    '--canonical-task-id', '#455',
    '--objective', 'Bind hair.long production advisory.',
    '--branch', 'codex/hair-long-production-advisory-binding-phase-1',
    '--worktree', worktree455,
    '--git-common-dir', root,
    '--expected-base', base,
    '--expected-head', base,
    '--expected-pr', 'null',
    '--execution-instance-id', '33333333-3333-4333-8333-333333333333',
    '--validate-input-only', 'true',
  ]
  for (const authorizedPath of authorizedPaths) args.push('--authorized-path', authorizedPath)
  return spawnSync(process.execPath, args, { cwd: process.cwd(), encoding: 'utf8' })
}

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

// Identity input validation is complete before any worktree mutation.
{
  const valid = runInputValidation(paths455)
  equal(valid.status, 0)
  const result = JSON.parse(valid.stdout)
  equal(result.phase, 'INPUT_VALIDATED')
  for (const invalidPaths of [['../outside'], [paths455[0], paths455[0]], [' docs/other.md']]) {
    const invalid = runInputValidation(invalidPaths)
    equal(invalid.status, 1)
    equal(invalid.stderr.trim(), EXECUTION_IDENTITY_MISMATCH_V1)
  }

  const worktreeCreator = readFileSync('scripts/create-task-worktree.ps1', 'utf8')
  assert.ok(worktreeCreator.indexOf('$identityInputResult =') < worktreeCreator.indexOf("'worktree', 'add', '-b'"))
  assertions += 1
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

// 9-10. Distinct identities run concurrently; base freshness is independent of path overlap.
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
  const currentMain = left.expected_base
  const advancedMain = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
  const concurrent = admitParallelExecutionsV1(left, right, { fresh_origin_main: currentMain })
  equal(concurrent.admission, 'CONCURRENT')
  equal(concurrent.fresh_base_rebind_required, false)
  const overlap = createBoundedExecutionIdentityV1({
    ...right,
    authorized_paths: [paths455[0]],
  })
  const disjointAfterAdvance = admitParallelExecutionsV1(left, right, { fresh_origin_main: advancedMain })
  equal(disjointAfterAdvance.admission, 'CONCURRENT')
  equal(disjointAfterAdvance.overlapping_paths.length, 0)
  equal(disjointAfterAdvance.fresh_base_rebind_required, true)

  const overlappingAfterAdvance = admitParallelExecutionsV1(left, overlap, {
    fresh_origin_main: advancedMain,
    shared_owner_conflict: true,
  })
  equal(overlappingAfterAdvance.admission, 'SERIALIZATION_REQUIRED')
  equal(overlappingAfterAdvance.overlapping_paths.length, 1)
  equal(overlappingAfterAdvance.fresh_base_rebind_required, true)
  const reconciledOverlap = admitParallelExecutionsV1(left, overlap, {
    fresh_origin_main: advancedMain,
    compatibility_reconciled: true,
  })
  equal(reconciledOverlap.admission, 'ORDERED')
  equal(reconciledOverlap.fresh_base_rebind_required, true)

  const unchangedOverlap = admitParallelExecutionsV1(left, overlap, { fresh_origin_main: currentMain })
  equal(unchangedOverlap.admission, 'CONCURRENT')
  equal(unchangedOverlap.fresh_base_rebind_required, false)
  equal(admitParallelExecutionsV1(left, overlap, {
    fresh_origin_main: currentMain,
    dependency_ordered: true,
  }).admission, 'ORDERED')
  equal(admitParallelExecutionsV1(left, right, {
    fresh_origin_main: currentMain,
    protected_transition_conflict: true,
  }).admission, 'SERIALIZATION_REQUIRED')
}

// The full bounded coordinator chain advances exactly once and stops before Product Owner authority.
{
  const actionFor = (terminalKind, overrides = {}) => projectAutomatedReviewToMergeReadyContinuationV1({
    waitTerminal: true,
    terminalKind,
    identityMatches: true,
    owningWorker: 'task-497-worker',
    observedAt: 100,
    terminalCursor: `cursor-${terminalKind}`,
    consumedCursor: null,
    ...overrides,
  })
  const expected = [
    ['IMPLEMENTATION_COMPLETE', 'DISPATCH_PREPUBLICATION_REVIEW'],
    ['PREPUBLICATION_REVIEW_APPROVE', 'DISPATCH_UNCHANGED_PUBLICATION'],
    ['PUBLICATION_COMPLETE', 'WAIT_CURRENT_HEAD_CHECKS'],
    ['CHECKS_PASS', 'DISPATCH_FRESH_REVIEW'],
    ['CORRECTION_CHECKS_PASS', 'DISPATCH_REPLACEMENT_FRESH_REVIEW'],
    ['REVIEW_FINDING', 'FOLLOW_UP_OWNING_WORKER'],
    ['REVIEW_APPROVE', 'ENSURE_REVIEW_AUTHORITY_AND_RUN_PREFLIGHT'],
  ]
  for (const [terminalKind, actionType] of expected) {
    const result = actionFor(terminalKind)
    equal(result.outcome, 'CONTINUE')
    equal(result.actions.length, 1)
    equal(result.actions[0].type, actionType)
  }
  equal(actionFor('REVIEW_FINDING').actions[0].worker, 'task-497-worker')
  const mergeReady = actionFor('PRE_DECISION_PASS')
  equal(mergeReady.outcome, 'MERGE_READY')
  equal(mergeReady.actions.length, 0)
  equal(actionFor('CHECKS_FAILED').outcome, 'NO_ADVANCE')
  equal(actionFor('CHECKS_PASS', { waitTerminal: false }).actions.length, 0)
  equal(actionFor('REVIEW_APPROVE', { identityMatches: false }).actions.length, 0)
  equal(actionFor('REVIEW_FINDING', { owningWorker: null }).actions.length, 0)
  equal(actionFor('CHECKS_PASS', { observedAt: -1 }).actions.length, 0)
  equal(actionFor('CHECKS_PASS', { terminalCursor: null }).actions.length, 0)
}

// Existing wait cursor identity makes terminal continuation exactly-once without durable state.
{
  const project = (terminalKind, terminalCursor, consumedCursor) => projectAutomatedReviewToMergeReadyContinuationV1({
    waitTerminal: true,
    terminalKind,
    identityMatches: true,
    owningWorker: 'task-497-worker',
    observedAt: 200,
    terminalCursor,
    consumedCursor,
  })
  const implementation = project('IMPLEMENTATION_COMPLETE', 'cursor-implementation', null)
  equal(implementation.actions.length, 1)
  equal(implementation.actions[0].type, 'DISPATCH_PREPUBLICATION_REVIEW')
  equal(implementation.consumed_cursor, 'cursor-implementation')
  equal(project('IMPLEMENTATION_COMPLETE', 'cursor-implementation', implementation.consumed_cursor).actions.length, 0)

  const publication = project('PREPUBLICATION_REVIEW_APPROVE', 'cursor-publication', implementation.consumed_cursor)
  equal(publication.actions.length, 1)
  equal(publication.actions[0].type, 'DISPATCH_UNCHANGED_PUBLICATION')
  equal(publication.consumed_cursor, 'cursor-publication')
  equal(project('PREPUBLICATION_REVIEW_APPROVE', 'cursor-publication', publication.consumed_cursor).actions.length, 0)

  const finding = project('REVIEW_FINDING', 'cursor-finding', publication.consumed_cursor)
  equal(finding.actions.length, 1)
  equal(finding.actions[0].type, 'FOLLOW_UP_OWNING_WORKER')
  equal(finding.consumed_cursor, 'cursor-finding')
  equal(project('REVIEW_FINDING', 'cursor-finding', finding.consumed_cursor).actions.length, 0)

  const approval = project('REVIEW_APPROVE', 'cursor-review-approve', finding.consumed_cursor)
  equal(approval.actions.length, 1)
  equal(approval.actions[0].type, 'ENSURE_REVIEW_AUTHORITY_AND_RUN_PREFLIGHT')
  equal(approval.consumed_cursor, 'cursor-review-approve')
  equal(project('REVIEW_APPROVE', 'cursor-review-approve', approval.consumed_cursor).actions.length, 0)

  const nextApproval = project('REVIEW_APPROVE', 'cursor-review-approve-next', approval.consumed_cursor)
  equal(nextApproval.actions.length, 1)
  equal(nextApproval.actions[0].type, 'ENSURE_REVIEW_AUTHORITY_AND_RUN_PREFLIGHT')
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
