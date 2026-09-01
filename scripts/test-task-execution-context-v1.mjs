import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
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
      head: id.expected_remote_head,
      base: id.expected_base,
    },
    ...overrides,
  }
}

// A fresh-base rebind may have a new local validation HEAD while the exact existing PR remains at its leased remote HEAD.
{
  const freshBase = '4'.repeat(40)
  const reboundHead = '5'.repeat(40)
  const id = identity({ expected_base: freshBase, expected_head: reboundHead, expected_remote_head: head455 })
  equal(assertBoundedExecutionContextV1(id, observed(id)).admitted, true)
  mismatch(() => assertBoundedExecutionContextV1(id, observed(id, {
    pr: { ...observed(id).pr, head: reboundHead },
  })), 'pr_head')
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
    ['TASK_ADMITTED', 'CREATE_ASSIGNED_WORKTREE_AND_DISPATCH_IMPLEMENTATION'],
    ['IMPLEMENTATION_COMPLETE', 'COMMIT_VALIDATED_TREE_AND_DISPATCH_PREPUBLICATION_REVIEW'],
    ['PREPUBLICATION_REVIEW_APPROVE', 'PUBLISH_REVIEWED_COMMIT_NON_DRAFT'],
    ['PUBLICATION_COMPLETE', 'WAIT_CURRENT_HEAD_CHECKS'],
    ['CHECKS_PASS', 'DISPATCH_FRESH_REVIEW'],
    ['CORRECTION_IMPLEMENTATION_COMPLETE', 'COMMIT_VALIDATED_CORRECTION_AND_DISPATCH_PREPUBLICATION_REVIEW'],
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
  equal(implementation.actions[0].type, 'COMMIT_VALIDATED_TREE_AND_DISPATCH_PREPUBLICATION_REVIEW')
  equal(implementation.consumed_cursor, 'cursor-implementation')
  equal(project('IMPLEMENTATION_COMPLETE', 'cursor-implementation', implementation.consumed_cursor).actions.length, 0)

  const publication = project('PREPUBLICATION_REVIEW_APPROVE', 'cursor-publication', implementation.consumed_cursor)
  equal(publication.actions.length, 1)
  equal(publication.actions[0].type, 'PUBLISH_REVIEWED_COMMIT_NON_DRAFT')
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

// Post-Merge local main synchronization is FF-only, deterministic, and cleanup-independent.
{
  const powershell = process.platform === 'win32' ? 'pwsh.exe' : 'pwsh'
  const syncScript = path.resolve('scripts/sync-local-main-after-merge-v1.ps1')
  const syncSource = readFileSync(syncScript, 'utf8')
  equal(
    /if \(\$localMain -ceq \$script:OriginMain\) \{[\s\S]*?Get-VerifiedSynchronizedState[\s\S]*?ALREADY_EQUAL/u.test(syncSource),
    true,
    'the no-op path rechecks current refs and root cleanliness before PASS',
  )
  equal(
    /function Get-VerifiedSynchronizedState \{[\s\S]*?refs\/heads\/main[\s\S]*?refs\/remotes\/origin\/main[\s\S]*?status[\s\S]*?local_main_sync_final_verification_failed/u.test(syncSource),
    true,
    'final verification rereads both refs and fails closed on dirty or unequal state',
  )
  const fixtureRoots = []
  const git = (cwd, args, expectedStatus = 0) => {
    const result = spawnSync('git', args, { cwd, encoding: 'utf8' })
    equal(result.status, expectedStatus, `${args.join(' ')}\n${result.stdout}\n${result.stderr}`)
    return result.stdout.trim()
  }
  const createFixture = (label) => {
    const fixtureRoot = realpathSync.native(mkdtempSync(path.join(tmpdir(), `local-main-sync-${label}-`)))
    fixtureRoots.push(fixtureRoot)
    const remote = path.join(fixtureRoot, 'remote.git')
    const seed = path.join(fixtureRoot, 'seed')
    const local = path.join(fixtureRoot, 'local')
    mkdirSync(seed)
    git(fixtureRoot, ['init', '--bare', remote])
    git(seed, ['init', '-b', 'main'])
    git(seed, ['config', 'user.email', 'tests@example.invalid'])
    git(seed, ['config', 'user.name', 'Test Author'])
    writeFileSync(path.join(seed, 'state.txt'), 'initial\n', 'utf8')
    git(seed, ['add', 'state.txt'])
    git(seed, ['commit', '-m', 'initial'])
    git(seed, ['remote', 'add', 'origin', remote])
    git(seed, ['push', '-u', 'origin', 'main'])
    git(fixtureRoot, ['clone', '--branch', 'main', remote, local])
    git(local, ['config', 'user.email', 'tests@example.invalid'])
    git(local, ['config', 'user.name', 'Test Author'])
    return { fixtureRoot, remote, seed, local }
  }
  const commit = (repository, content, message) => {
    writeFileSync(path.join(repository, 'state.txt'), `${content}\n`, 'utf8')
    git(repository, ['add', 'state.txt'])
    git(repository, ['commit', '-m', message])
    return git(repository, ['rev-parse', 'HEAD'])
  }
  const advanceRemote = (fixture, content) => {
    const head = commit(fixture.seed, content, `remote ${content}`)
    git(fixture.seed, ['push', 'origin', 'main'])
    return head
  }
  const invokeSync = (repository) => {
    const result = spawnSync(powershell, [
      '-NoLogo', '-NoProfile', '-NonInteractive', '-File', syncScript,
      '-RepositoryPath', repository,
    ], { cwd: process.cwd(), encoding: 'utf8' })
    const lines = result.stdout.trim().split(/\r?\n/u).filter(Boolean)
    const payload = JSON.parse(lines.at(-1))
    return { result, payload }
  }

  try {
    const behind = createFixture('behind')
    const expectedRemote = advanceRemote(behind, 'advanced')
    const behindResult = invokeSync(behind.local)
    equal(behindResult.result.status, 0)
    equal(behindResult.payload.state, 'PASS')
    equal(behindResult.payload.action, 'FAST_FORWARD')
    equal(behindResult.payload.local_main_after, expectedRemote)
    equal(behindResult.payload.local_main_after, behindResult.payload.origin_main)
    equal(behindResult.payload.merge_outcome_affected, false)
    equal(behindResult.payload.worktree_cleanup_may_continue, true)

    const equalResult = invokeSync(behind.local)
    equal(equalResult.result.status, 0)
    equal(equalResult.payload.state, 'PASS')
    equal(equalResult.payload.action, 'ALREADY_EQUAL')
    equal(equalResult.payload.local_main_before, equalResult.payload.local_main_after)

    const dirty = createFixture('dirty')
    const dirtyHead = git(dirty.local, ['rev-parse', 'HEAD'])
    writeFileSync(path.join(dirty.local, 'untracked.txt'), 'dirty\n', 'utf8')
    const dirtyResult = invokeSync(dirty.local)
    equal(dirtyResult.result.status, 1)
    equal(dirtyResult.payload.reason, 'local_main_sync_root_dirty')
    equal(git(dirty.local, ['rev-parse', 'HEAD']), dirtyHead)
    equal(dirtyResult.payload.worktree_cleanup_may_continue, true)

    const localOnly = createFixture('local-only')
    const localOnlyHead = commit(localOnly.local, 'local-only', 'local only')
    const localOnlyResult = invokeSync(localOnly.local)
    equal(localOnlyResult.result.status, 1)
    equal(localOnlyResult.payload.reason, 'local_main_sync_local_only_commits')
    equal(git(localOnly.local, ['rev-parse', 'HEAD']), localOnlyHead)

    const diverged = createFixture('diverged')
    const divergedHead = commit(diverged.local, 'local-diverged', 'local diverged')
    advanceRemote(diverged, 'remote-diverged')
    const divergedResult = invokeSync(diverged.local)
    equal(divergedResult.result.status, 1)
    equal(divergedResult.payload.reason, 'local_main_sync_diverged')
    equal(git(diverged.local, ['rev-parse', 'HEAD']), divergedHead)

    const fetchFailure = createFixture('fetch-failure')
    const fetchFailureHead = git(fetchFailure.local, ['rev-parse', 'HEAD'])
    git(fetchFailure.local, ['remote', 'set-url', 'origin', path.join(fetchFailure.fixtureRoot, 'missing.git')])
    const fetchFailureResult = invokeSync(fetchFailure.local)
    equal(fetchFailureResult.result.status, 1)
    equal(fetchFailureResult.payload.reason, 'local_main_sync_fetch_failed')
    equal(git(fetchFailure.local, ['rev-parse', 'HEAD']), fetchFailureHead)
  } finally {
    for (const fixtureRoot of fixtureRoots) rmSync(fixtureRoot, { recursive: true, force: true })
  }
}

// Post-Merge worktree cleanup removes only a verified exact-path residue.
{
  const powershell = process.platform === 'win32' ? 'pwsh.exe' : 'pwsh'
  const cleanupScript = path.resolve('scripts/remove-task-worktree-after-merge-v1.ps1')
  const fixtureRoots = []
  const psLiteral = (value) => `'${String(value).replaceAll("'", "''")}'`
  const git = (cwd, args, expectedStatus = 0) => {
    const result = spawnSync('git', args, { cwd, encoding: 'utf8' })
    equal(result.status, expectedStatus, `${args.join(' ')}\n${result.stdout}\n${result.stderr}`)
    return result.stdout.trim()
  }
  const createFixture = (label) => {
    const fixtureRoot = realpathSync.native(mkdtempSync(path.join(tmpdir(), `worktree-cleanup-${label}-`)))
    fixtureRoots.push(fixtureRoot)
    const repository = path.join(fixtureRoot, 'repository')
    mkdirSync(repository)
    git(repository, ['init', '-b', 'main'])
    git(repository, ['config', 'user.email', 'tests@example.invalid'])
    git(repository, ['config', 'user.name', 'Test Author'])
    writeFileSync(path.join(repository, 'state.txt'), 'initial\n', 'utf8')
    git(repository, ['add', 'state.txt'])
    git(repository, ['commit', '-m', 'initial'])
    mkdirSync(path.join(repository, '.worktrees'))
    return { fixtureRoot, repository }
  }
  const addWorktree = (fixture, label) => {
    const target = path.join(fixture.repository, '.worktrees', label)
    const branch = `codex/${label}`
    git(fixture.repository, ['worktree', 'add', '-b', branch, target, 'HEAD'])
    return { target, branch, head: git(target, ['rev-parse', 'HEAD']) }
  }
  const refsDigest = (repository) => git(repository, [
    'for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads', 'refs/remotes',
  ]).split(/\r?\n/u).sort().join('\n')
  const invokeCleanup = (fixture, worktree) => {
    const result = spawnSync(powershell, [
      '-NoLogo', '-NoProfile', '-NonInteractive', '-File', cleanupScript,
      '-RepositoryPath', fixture.repository,
      '-TaskWorktreePath', worktree.target,
      '-ExpectedBranch', worktree.branch,
      '-ExpectedHead', worktree.head,
    ], { cwd: process.cwd(), encoding: 'utf8' })
    const lines = result.stdout.trim().split(/\r?\n/u).filter(Boolean)
    assert.ok(lines.length > 0, `${result.status}\n${result.error?.stack ?? ''}\n${result.stdout}\n${result.stderr}`)
    return { result, payload: JSON.parse(lines.at(-1)) }
  }
  const invokeResidual = (repository, retired, captured) => {
    const command = [
      `. ${psLiteral(cleanupScript)}`,
      'try {',
      `  $removed=Remove-VerifiedResidualPath -Repository ${psLiteral(repository)} -RetiredWorktreePath ${psLiteral(retired)} -CapturedRetiredWorktreePath ${psLiteral(captured)}`,
      "  [pscustomobject]@{state='PASS';removed=$removed} | ConvertTo-Json -Compress",
      '  exit 0',
      '} catch {',
      "  [pscustomobject]@{state='FAILED';reason=$_.Exception.Message} | ConvertTo-Json -Compress",
      '  exit 1',
      '}',
    ].join('; ')
    const result = spawnSync(powershell, [
      '-NoLogo', '-NoProfile', '-NonInteractive', '-Command', command,
    ], { cwd: process.cwd(), encoding: 'utf8' })
    const lines = result.stdout.trim().split(/\r?\n/u).filter(Boolean)
    assert.ok(lines.length > 0, `${result.status}\n${result.error?.stack ?? ''}\n${result.stdout}\n${result.stderr}`)
    return { result, payload: JSON.parse(lines.at(-1)) }
  }
  const invokeRemoveCompletion = (repository, retired, exitCode, stderr) => {
    const command = [
      `. ${psLiteral(cleanupScript)}`,
      'try {',
      `  $completion=Complete-GitWorktreeRemove -Repository ${psLiteral(repository)} -RetiredWorktreePath ${psLiteral(retired)} -RemoveResult ([pscustomobject]@{ExitCode=${exitCode};StandardError=${psLiteral(stderr)}})`,
      "  [pscustomobject]@{state='PASS';residual_removed=$completion.ResidualRemoved;nonzero_deregistered=$completion.NonzeroDeregistered;git_remove_exit_code=$script:GitRemoveExitCode;git_remove_stderr=$script:GitRemoveStderr} | ConvertTo-Json -Compress",
      '  exit 0',
      '} catch {',
      "  [pscustomobject]@{state='FAILED';reason=$_.Exception.Message;git_remove_exit_code=$script:GitRemoveExitCode;git_remove_stderr=$script:GitRemoveStderr} | ConvertTo-Json -Compress",
      '  exit 1',
      '}',
    ].join('; ')
    const result = spawnSync(powershell, [
      '-NoLogo', '-NoProfile', '-NonInteractive', '-Command', command,
    ], { cwd: process.cwd(), encoding: 'utf8' })
    const lines = result.stdout.trim().split(/\r?\n/u).filter(Boolean)
    assert.ok(lines.length > 0, `${result.status}\n${result.error?.stack ?? ''}\n${result.stdout}\n${result.stderr}`)
    return { result, payload: JSON.parse(lines.at(-1)) }
  }

  try {
    const cleanupSource = readFileSync(cleanupScript, 'utf8')
    for (const prohibitedDiscovery of ['Get-CimInstance', 'Win32_Process', 'CreateFileW', '/proc', 'Get-ActivePathOwnerCount']) {
      equal(cleanupSource.includes(prohibitedDiscovery), false, prohibitedDiscovery)
    }

    const ordinary = createFixture('ordinary')
    const ordinaryWorktree = addWorktree(ordinary, 'ordinary-task')
    const ordinaryRefs = refsDigest(ordinary.repository)
    const ordinaryResult = invokeCleanup(ordinary, ordinaryWorktree)
    equal(ordinaryResult.result.status, 0, JSON.stringify({ payload: ordinaryResult.payload, stderr: ordinaryResult.result.stderr }))
    equal(ordinaryResult.payload.state, 'PASS')
    equal(ordinaryResult.payload.action, 'GIT_REMOVE')
    equal(ordinaryResult.payload.residual_removed, false)
    equal(ordinaryResult.payload.branch_refs_preserved, true)
    equal(ordinaryResult.payload.git_remove_exit_code, 0)
    equal(ordinaryResult.payload.git_remove_stderr, '')
    equal(ordinaryResult.payload.merge_outcome_affected, false)
    equal(refsDigest(ordinary.repository), ordinaryRefs)
    equal(
      git(ordinary.repository, ['worktree', 'list', '--porcelain']).replaceAll('\\', '/').includes(ordinaryWorktree.target.replaceAll('\\', '/')),
      false,
    )
    equal(rmSync(ordinaryWorktree.target, { recursive: true, force: true }), undefined)

    const dirty = createFixture('dirty')
    const dirtyWorktree = addWorktree(dirty, 'dirty-task')
    writeFileSync(path.join(dirtyWorktree.target, 'untracked.txt'), 'dirty\n', 'utf8')
    const dirtyRefs = refsDigest(dirty.repository)
    const dirtyResult = invokeCleanup(dirty, dirtyWorktree)
    equal(dirtyResult.result.status, 1)
    equal(dirtyResult.payload.reason, 'worktree_cleanup_target_dirty')
    equal(dirtyResult.payload.merge_outcome_affected, false)
    equal(refsDigest(dirty.repository), dirtyRefs)
    equal(
      git(dirty.repository, ['worktree', 'list', '--porcelain']).replaceAll('\\', '/').includes(dirtyWorktree.target.replaceAll('\\', '/')),
      true,
    )

    const residue = createFixture('residue')
    const residueWorktree = addWorktree(residue, 'residue-task')
    git(residue.repository, ['worktree', 'remove', '--', residueWorktree.target])
    mkdirSync(path.join(residueWorktree.target, 'node_modules'), { recursive: true })
    writeFileSync(path.join(residueWorktree.target, 'node_modules', 'residue.txt'), 'residue\n', 'utf8')
    const residueRefs = refsDigest(residue.repository)
    const residueResult = invokeResidual(residue.repository, residueWorktree.target, residueWorktree.target)
    equal(residueResult.result.status, 0)
    equal(residueResult.payload.state, 'PASS')
    equal(residueResult.payload.removed, true)
    equal(refsDigest(residue.repository), residueRefs)
    equal(rmSync(residueWorktree.target, { recursive: true, force: true }), undefined)

    const partial = createFixture('partial-success')
    const partialWorktree = addWorktree(partial, 'partial-success-task')
    git(partial.repository, ['worktree', 'remove', '--', partialWorktree.target])
    mkdirSync(path.join(partialWorktree.target, 'node_modules'), { recursive: true })
    writeFileSync(path.join(partialWorktree.target, 'node_modules', 'residue.txt'), 'residue\n', 'utf8')
    const partialRefs = refsDigest(partial.repository)
    const partialStderr = `fatal: simulated partial filesystem cleanup\n${'x'.repeat(600)}`
    const partialResult = invokeRemoveCompletion(
      partial.repository,
      partialWorktree.target,
      23,
      partialStderr,
    )
    equal(partialResult.result.status, 0)
    equal(partialResult.payload.state, 'PASS')
    equal(partialResult.payload.residual_removed, true)
    equal(partialResult.payload.nonzero_deregistered, true)
    equal(partialResult.payload.git_remove_exit_code, 23)
    equal(partialResult.payload.git_remove_stderr, partialStderr.slice(0, 512))
    equal(existsSync(partialWorktree.target), false)
    equal(refsDigest(partial.repository), partialRefs)

    const partialRegistered = createFixture('partial-still-registered')
    const partialRegisteredWorktree = addWorktree(partialRegistered, 'partial-still-registered-task')
    const partialRegisteredResult = invokeRemoveCompletion(
      partialRegistered.repository,
      partialRegisteredWorktree.target,
      17,
      'fatal: registration remains',
    )
    equal(partialRegisteredResult.result.status, 1)
    equal(partialRegisteredResult.payload.state, 'FAILED')
    equal(partialRegisteredResult.payload.reason, 'worktree_cleanup_git_remove_failed')
    equal(partialRegisteredResult.payload.git_remove_exit_code, 17)
    equal(partialRegisteredResult.payload.git_remove_stderr, 'fatal: registration remains')
    equal(
      git(partialRegistered.repository, ['worktree', 'list', '--porcelain']).replaceAll('\\', '/').includes(partialRegisteredWorktree.target.replaceAll('\\', '/')),
      true,
    )

    const registered = createFixture('registered')
    const registeredWorktree = addWorktree(registered, 'registered-task')
    const registeredResult = invokeResidual(registered.repository, registeredWorktree.target, registeredWorktree.target)
    equal(registeredResult.result.status, 1)
    equal(registeredResult.payload.reason, 'worktree_cleanup_residual_still_registered')
    equal(readFileSync(path.join(registeredWorktree.target, 'state.txt'), 'utf8').replaceAll('\r\n', '\n'), 'initial\n')

    const marker = createFixture('marker')
    const markerPath = path.join(marker.repository, '.worktrees', 'marker-task')
    mkdirSync(markerPath)
    writeFileSync(path.join(markerPath, '.git'), 'historical marker\n', 'utf8')
    const markerResult = invokeResidual(marker.repository, markerPath, markerPath)
    equal(markerResult.result.status, 1)
    equal(markerResult.payload.reason, 'worktree_cleanup_git_marker_present')
    equal(readFileSync(path.join(markerPath, '.git'), 'utf8'), 'historical marker\n')

    const registeredAncestor = createFixture('registered-ancestor')
    const registeredAncestorWorktree = addWorktree(registeredAncestor, 'registered-ancestor-task')
    const nestedRetiredPath = path.join(registeredAncestorWorktree.target, 'nested-residue')
    mkdirSync(nestedRetiredPath)
    writeFileSync(path.join(nestedRetiredPath, 'owned.txt'), 'owned\n', 'utf8')
    const registeredAncestorResult = invokeResidual(
      registeredAncestor.repository,
      nestedRetiredPath,
      nestedRetiredPath,
    )
    equal(registeredAncestorResult.result.status, 1)
    equal(registeredAncestorResult.payload.reason, 'worktree_cleanup_residual_still_registered')
    equal(readFileSync(path.join(nestedRetiredPath, 'owned.txt'), 'utf8'), 'owned\n')

    const reparseAncestor = createFixture('reparse-ancestor')
    const redirectedRoot = path.join(reparseAncestor.fixtureRoot, 'redirected-root')
    const reparsePath = path.join(reparseAncestor.repository, '.worktrees', 'redirected')
    mkdirSync(redirectedRoot)
    symlinkSync(redirectedRoot, reparsePath, process.platform === 'win32' ? 'junction' : 'dir')
    const redirectedRetiredPath = path.join(reparsePath, 'residue-task')
    mkdirSync(redirectedRetiredPath)
    writeFileSync(path.join(redirectedRetiredPath, 'owned.txt'), 'owned\n', 'utf8')
    const reparseAncestorResult = invokeResidual(
      reparseAncestor.repository,
      redirectedRetiredPath,
      redirectedRetiredPath,
    )
    equal(reparseAncestorResult.result.status, 1)
    equal(reparseAncestorResult.payload.reason, 'worktree_cleanup_reparse_ancestor_present')
    equal(readFileSync(path.join(redirectedRetiredPath, 'owned.txt'), 'utf8'), 'owned\n')

    const reparseRoot = createFixture('reparse-root')
    const redirectedTaskRoot = path.join(reparseRoot.fixtureRoot, 'redirected-task-root')
    const linkedRetiredPath = path.join(reparseRoot.repository, '.worktrees', 'linked-task')
    mkdirSync(redirectedTaskRoot)
    writeFileSync(path.join(redirectedTaskRoot, 'owned.txt'), 'owned\n', 'utf8')
    symlinkSync(redirectedTaskRoot, linkedRetiredPath, process.platform === 'win32' ? 'junction' : 'dir')
    const reparseRootResult = invokeResidual(reparseRoot.repository, linkedRetiredPath, linkedRetiredPath)
    equal(reparseRootResult.result.status, 1)
    equal(reparseRootResult.payload.reason, 'worktree_cleanup_residual_root_invalid')
    equal(readFileSync(path.join(redirectedTaskRoot, 'owned.txt'), 'utf8'), 'owned\n')

    const bounded = createFixture('bounded')
    const outsidePath = path.join(bounded.fixtureRoot, 'outside-task')
    mkdirSync(outsidePath)
    const outsideResult = invokeResidual(bounded.repository, outsidePath, outsidePath)
    equal(outsideResult.result.status, 1)
    equal(outsideResult.payload.reason, 'worktree_cleanup_target_outside_repository_worktrees')
    equal(realpathSync.native(outsidePath), outsidePath)

    const binding = createFixture('binding')
    const bindingPath = path.join(binding.repository, '.worktrees', 'binding-task')
    const otherPath = path.join(binding.repository, '.worktrees', 'other-task')
    mkdirSync(bindingPath)
    mkdirSync(otherPath)
    const bindingResult = invokeResidual(binding.repository, bindingPath, otherPath)
    equal(bindingResult.result.status, 1)
    equal(bindingResult.payload.reason, 'worktree_cleanup_retired_path_binding_invalid')
    equal(realpathSync.native(bindingPath), bindingPath)
  } finally {
    for (const fixtureRoot of fixtureRoots) rmSync(fixtureRoot, { recursive: true, force: true })
  }
}

process.stdout.write(`task-execution-context-v1: ${assertions} assertions passed\n`)
