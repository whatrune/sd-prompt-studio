import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  executeNormalTaskExecutionOperatorV1,
  productionHostV1,
} from './run-bootstrap-publication-operator-v1.mjs'
import {
  serializeCanonicalTaskIssueBodyV1,
} from './run-protected-transition-admission-v1.mjs'

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
const FRESH_BASE = 'c'.repeat(40)
const PUSHED = 'b'.repeat(40)
const AUTHORITY_ID = 5_400_000_001
const AUTHORITY_URL = `https://github.com/${REPOSITORY}/issues/359#issuecomment-${AUTHORITY_ID}`
const BRANCH = 'codex/bootstrap-publication-operator-v1'
const PATHS = Object.freeze([
  'scripts/run-bootstrap-publication-operator-v1.mjs',
  'scripts/test-bootstrap-publication-operator-v1.mjs',
])
const PR_NUMBER = 360
const PR_URL = 'https://github.com/' + REPOSITORY + '/pull/' + PR_NUMBER
const NORMAL_OBJECTIVE = 'BOUNDED_NORMAL_TASK_EXECUTION_PREDELEGATION_AND_CONTINUATION_WIRING_V1'
const NORMAL_INSTANCE = '706ca1fb-4c8d-43df-9bc3-e1371e038383'
const NORMAL_TARGET = 'codex-thread-normal-task-538'
const NORMAL_COMMON_DIR = path.join(worktree, '.git-common')
const NORMAL_CORRECTION_CONTEXT = Object.freeze({
  finding_cursor: 'review-finding-cursor',
  finding_head: PARENT,
  active_thread_ids: Object.freeze(['thread-1']),
})
const NORMAL_TASK_BODY = serializeCanonicalTaskIssueBodyV1({
  request: {
    title: NORMAL_OBJECTIVE,
    repository: REPOSITORY,
    objective: NORMAL_OBJECTIVE,
    markdown: `# ${NORMAL_OBJECTIVE}\n\nNormal exact-scope execution.`,
    authorized_paths: [...PATHS],
    head_branch: BRANCH,
    worktree_path: worktree,
    expected_base: PARENT,
    authorized_actor: 'whatrune',
    permitted_surface: 'TASK_ISSUE_COMMENT',
    ready_allowed: false,
    product_owner_login: 'whatrune',
  },
  mode: 'BOUND_FINAL',
  taskIssue: TASK,
})
const LEGACY_NORMAL_TASK_BODY = NORMAL_TASK_BODY.replace(
  /([ \t]*)"initial_exact_scope_required": true,\n\1"correction_delta_subset_allowed": true,/u,
  '$1"exact_scope_required": true,',
)
check(!LEGACY_NORMAL_TASK_BODY.includes('correction_delta_subset_allowed'), 'N legacy normal-task fixture removes the explicit correction-subset capability')
const normalRequestV1 = (operation, expectedHead, overrides = {}) => {
  const request = {
    record_type: 'normal_task_execution_request_v1',
    version: 1,
    operation,
    repository: REPOSITORY,
    task_issue_number: TASK,
    objective: NORMAL_OBJECTIVE,
    authorized_paths: [...PATHS],
    changed_paths: [...PATHS],
    correction_context: null,
    branch: BRANCH,
    worktree_path: worktree,
    git_common_dir: NORMAL_COMMON_DIR,
    expected_base: PARENT,
    expected_head: expectedHead,
    expected_pr: null,
    expected_remote_head: null,
    execution_instance_id: NORMAL_INSTANCE,
    operation_count: 1,
    ...overrides,
  }
  if (!Object.hasOwn(overrides, 'validation_results')) {
    const validationHead = operation === 'COMMIT_VALIDATED_TREE'
      ? request.expected_head
      : (request.expected_remote_head ?? request.expected_base)
    request.validation_results = [{ command: 'focused validation', result: 'PASS', exact_head: validationHead }]
  }
  if (request.expected_pr !== null && request.correction_context === null) {
    request.correction_context = NORMAL_CORRECTION_CONTEXT
  }
  return request
}
const makeNormalHostV1 = ({
  initialHead = PARENT,
  parentHead = PARENT,
  currentBase = PARENT,
  remoteInitially = null,
  actor = 'whatrune',
  taskBody = NORMAL_TASK_BODY,
  advancedPaths = [],
  baseIsDescendant = true,
  successorIsDescendant = true,
  existingPr = false,
  changedPaths = PATHS,
  correctionContext = (existingPr || (remoteInitially !== null && remoteInitially !== PUSHED))
    ? NORMAL_CORRECTION_CONTEXT
    : null,
  terminalEventTransform = (value) => value,
} = {}) => {
  const metrics = { commit: 0, push: 0, createPull: 0, acquireContinuation: 0, apiCalls: [], createdPull: null }
  let currentHead = initialHead
  let remoteHead = remoteInitially
  let staged = []
  let pullBody = null
  const host = {
    repository: REPOSITORY,
    worktreePath: worktree,
    metrics,
    observeExecution: (identity) => ({
      repository: identity.repository,
      canonical_task_id: identity.canonical_task_id,
      objective_digest: identity.objective_digest,
      branch: BRANCH,
      worktree_path: worktree,
      registered_worktree_path: worktree,
      git_common_dir: NORMAL_COMMON_DIR,
      authorized_paths: identity.authorized_paths,
      remote_main_sha: currentBase,
      head: currentHead,
      pr_lookup_attempted: identity.expected_pr !== null,
      requested_pr_number: identity.expected_pr ?? undefined,
      pr: identity.expected_pr === null ? null : {
        number: PR_NUMBER,
        repository: REPOSITORY,
        state: 'OPEN',
        merged: false,
        head: remoteHead,
        base: currentBase,
        branch: BRANCH,
      },
    }),
    git: (args) => {
      const command = args.join(' ')
      if (command === 'rev-parse --verify HEAD') return `${currentHead}\n`
      if (command === 'diff --cached --quiet --') return ''
      if (command === 'diff --name-only -z --no-renames HEAD --') return ''
      if (command === 'ls-files --others --exclude-standard -z') return `${changedPaths.join('\0')}\0`
      if (args[0] === 'add') { staged = args.slice(2); return '' }
      if (command === 'diff --cached --name-only -z --no-renames HEAD --') return `${staged.join('\0')}\0`
      if (args[0] === 'commit') { metrics.commit += 1; currentHead = PUSHED; return '[commit]\n' }
      if (command === 'rev-parse HEAD') return `${currentHead}\n`
      if (command === 'rev-parse HEAD^') return `${parentHead}\n`
      if (command === `diff --name-only -z --no-renames ${parentHead} ${PUSHED} --`) return `${changedPaths.join('\0')}\0`
      if (command === 'status --porcelain=v1 -z') return ''
      if (command === `merge-base --is-ancestor ${PARENT} ${currentBase}`) {
        if (!baseIsDescendant) throw new Error('not ancestor')
        return ''
      }
      if (command === `diff --name-only -z --no-renames ${PARENT} ${currentBase} --`) {
        return advancedPaths.length === 0 ? '' : `${advancedPaths.join('\0')}\0`
      }
      if (command === `merge-base --is-ancestor ${PARENT} ${PUSHED}`) {
        if (!successorIsDescendant) throw new Error('not ancestor')
        return ''
      }
      if (args[0] === 'ls-remote') return remoteHead === null ? '' : `${remoteHead}\trefs/heads/${BRANCH}\n`
      if (args[0] === 'push') { metrics.push += 1; remoteHead = currentHead; return `*\tHEAD:refs/heads/${BRANCH}\t[new branch]\n` }
      throw new Error(`unexpected normal git command: ${command}`)
    },
    api: async (endpoint, options = undefined) => {
      metrics.apiCalls.push({ endpoint, method: options?.method ?? 'GET' })
      if (endpoint === 'user') return { login: actor }
      if (endpoint === `repos/${REPOSITORY}/issues/${TASK}`) return {
        number: TASK,
        state: 'open',
        body: taskBody,
        user: { login: 'whatrune' },
        author_association: 'OWNER',
      }
      if (endpoint === `repos/${REPOSITORY}/pulls` && options?.method === 'POST') {
        metrics.createPull += 1
        pullBody = options.body.body
        metrics.createdPull = options.body
        return { number: PR_NUMBER, html_url: PR_URL }
      }
      if (endpoint === `repos/${REPOSITORY}/pulls/${PR_NUMBER}`) return {
        number: PR_NUMBER,
        html_url: PR_URL,
        state: 'open',
        draft: false,
        merged: false,
        base: { ref: 'main', sha: currentBase, repo: { full_name: REPOSITORY } },
        head: { ref: BRANCH, sha: remoteHead ?? currentHead, repo: { full_name: REPOSITORY } },
        body: pullBody,
      }
      throw new Error(`unexpected normal api call: ${endpoint}`)
    },
  }
  return host
}

{
  const host = makeNormalHostV1()
  const result = await executeNormalTaskExecutionOperatorV1(
    normalRequestV1('COMMIT_VALIDATED_TREE', PARENT), host,
  )
  check(result.status === 'SUCCESS' && result.reason === 'validated_tree_committed', 'N normal route commits the exact validated tree')
  check(result.mutation_count === 1 && result.protected_operation_count === 1 && host.metrics.commit === 1, 'N validated-tree commit is one bounded protected mutation')
  check(result.committed_head === PUSHED && result.parent_head === PARENT, 'N committed tree remains exact-parent bound')
  const duplicate = await executeNormalTaskExecutionOperatorV1(
    normalRequestV1('COMMIT_VALIDATED_TREE', PARENT), host,
  )
  check(duplicate.status === 'STOP' && duplicate.reason === 'execution_identity_mismatch', 'N repeated consumed execution identity cannot create another commit')
  check(host.metrics.commit === 1, 'N duplicate invocation performs zero additional commit mutations')
}

{
  const host = makeNormalHostV1()
  const result = await executeNormalTaskExecutionOperatorV1({
    ...normalRequestV1('PUBLISH_VALIDATED_COMMIT', PUSHED),
    prepublication_review: { decision: 'APPROVE', blocking: 0, remaining: 0, unknown: 0, reviewed_head: PUSHED },
  }, host)
  check(result.reason === 'normal_task_execution_request_schema_invalid' && result.mutation_count === 0, 'N caller-supplied Review data is not an admitted request field')
  check(host.metrics.apiCalls.length === 0 && host.metrics.acquireContinuation === 0, 'N synthetic Review data stops before authority or terminal-event access')
}

{
  const host = makeNormalHostV1({
    initialHead: PARENT,
    currentBase: FRESH_BASE,
    remoteInitially: PARENT,
    existingPr: true,
    advancedPaths: ['docs/unrelated-main-change.md'],
  })
  const result = await executeNormalTaskExecutionOperatorV1(
    normalRequestV1('COMMIT_VALIDATED_TREE', PARENT, {
      expected_base: FRESH_BASE,
      expected_pr: PR_NUMBER,
      expected_remote_head: PARENT,
    }),
    host,
  )
  check(result.status === 'SUCCESS' && result.parent_head === PARENT, 'N disjoint fresh-main advancement preserves the existing PR lineage for the validated successor commit')
  check(host.metrics.commit === 1 && host.metrics.acquireContinuation === 0, 'N rebound commit still consumes one fetched terminal handoff and one commit')
}

{
  const correctionDelta = [PATHS[0]]
  const host = makeNormalHostV1({
    initialHead: PARENT,
    remoteInitially: PARENT,
    existingPr: true,
    changedPaths: correctionDelta,
  })
  const result = await executeNormalTaskExecutionOperatorV1(
    normalRequestV1('COMMIT_VALIDATED_TREE', PARENT, {
      expected_pr: PR_NUMBER,
      expected_remote_head: PARENT,
      changed_paths: correctionDelta,
    }),
    host,
  )
  check(result.status === 'SUCCESS' && result.reason === 'validated_tree_committed', 'N same-task correction admits an exact non-empty delta within cumulative authority')
  check(result.changed_paths.join(',') === correctionDelta.join(','), 'N committed correction reports the exact validated delta')
}

{
  const correctionDelta = [PATHS[0]]
  const host = makeNormalHostV1({ initialHead: PARENT, remoteInitially: PARENT, existingPr: true, changedPaths: correctionDelta })
  const result = await executeNormalTaskExecutionOperatorV1(
    normalRequestV1('COMMIT_VALIDATED_TREE', PARENT, {
      expected_pr: PR_NUMBER,
      expected_remote_head: PARENT,
      changed_paths: correctionDelta,
      correction_context: { finding_head: PARENT, active_thread_ids: [] },
    }),
    host,
  )
  check(result.status === 'SUCCESS', 'N a semantic Review finding needs no synthetic thread or cursor identity')
}

{
  const correctionDelta = [PATHS[0]]
  const host = makeNormalHostV1({
    initialHead: PARENT,
    remoteInitially: PARENT,
    existingPr: true,
    changedPaths: correctionDelta,
    taskBody: LEGACY_NORMAL_TASK_BODY,
  })
  const result = await executeNormalTaskExecutionOperatorV1(
    normalRequestV1('COMMIT_VALIDATED_TREE', PARENT, {
      expected_pr: PR_NUMBER,
      expected_remote_head: PARENT,
      changed_paths: correctionDelta,
    }),
    host,
  )
  check(result.reason === 'correction_delta_subset_not_authorized' && result.mutation_count === 0, 'N legacy predelegation cannot silently acquire correction-delta subset authority')
  check(host.metrics.acquireContinuation === 0 && host.metrics.commit === 0, 'N rejected legacy subset stops before terminal evidence or mutation')
}

{
  const host = makeNormalHostV1({
    initialHead: PARENT,
    remoteInitially: PARENT,
    existingPr: true,
    taskBody: LEGACY_NORMAL_TASK_BODY,
  })
  const result = await executeNormalTaskExecutionOperatorV1(
    normalRequestV1('COMMIT_VALIDATED_TREE', PARENT, {
      expected_pr: PR_NUMBER,
      expected_remote_head: PARENT,
    }),
    host,
  )
  check(result.status === 'SUCCESS' && result.reason === 'validated_tree_committed', 'N legacy predelegation retains compatible full-scope same-task correction')
  check(host.metrics.acquireContinuation === 0 && host.metrics.commit === 1, 'N admitted legacy full-scope correction consumes one event and creates one commit')
}

{
  const host = makeNormalHostV1({ existingPr: true, remoteInitially: PARENT })
  const outside = await executeNormalTaskExecutionOperatorV1(
    normalRequestV1('COMMIT_VALIDATED_TREE', PARENT, {
      expected_pr: PR_NUMBER,
      expected_remote_head: PARENT,
      changed_paths: ['docs/outside-authority.md'],
    }),
    host,
  )
  check(outside.reason === 'changed_paths_outside_authority' && outside.mutation_count === 0, 'N correction delta outside cumulative authority fails before mutation')
  check(host.metrics.acquireContinuation === 0 && host.metrics.commit === 0, 'N out-of-authority delta consumes no event and creates no commit')
}

{
  const host = makeNormalHostV1({
    existingPr: true,
    remoteInitially: PARENT,
    changedPaths: [PATHS[0]],
  })
  const mismatch = await executeNormalTaskExecutionOperatorV1(
    normalRequestV1('COMMIT_VALIDATED_TREE', PARENT, {
      expected_pr: PR_NUMBER,
      expected_remote_head: PARENT,
      changed_paths: [PATHS[1]],
    }),
    host,
  )
  check(mismatch.reason === 'changed_paths_mismatch' && mismatch.mutation_count === 0, 'N claimed correction delta must equal fetched validated handoff paths')
}

{
  const host = makeNormalHostV1({
    initialHead: PARENT,
    currentBase: FRESH_BASE,
    remoteInitially: PARENT,
    existingPr: true,
    advancedPaths: [PATHS[0]],
  })
  const result = await executeNormalTaskExecutionOperatorV1(
    normalRequestV1('COMMIT_VALIDATED_TREE', PARENT, {
      expected_base: FRESH_BASE,
      expected_pr: PR_NUMBER,
      expected_remote_head: PARENT,
    }),
    host,
  )
  check(result.reason === 'fresh_base_compatibility_required' && result.mutation_count === 0, 'N fresh-base overlap remains fail-closed for compatibility reconciliation')
  check(host.metrics.acquireContinuation === 0 && host.metrics.commit === 0, 'N overlapping fresh base stops before terminal evidence or mutation')
}

{
  const host = makeNormalHostV1({
    initialHead: PARENT,
    currentBase: FRESH_BASE,
    remoteInitially: PARENT,
    existingPr: true,
    baseIsDescendant: false,
  })
  const result = await executeNormalTaskExecutionOperatorV1(
    normalRequestV1('COMMIT_VALIDATED_TREE', PARENT, {
      expected_base: FRESH_BASE,
      expected_pr: PR_NUMBER,
      expected_remote_head: PARENT,
    }),
    host,
  )
  check(result.reason === 'fresh_base_not_descendant' && result.mutation_count === 0, 'N divergent fresh base is rejected without mutation')
}

{
  const host = makeNormalHostV1({ initialHead: PUSHED })
  const result = await executeNormalTaskExecutionOperatorV1(
    normalRequestV1('PUBLISH_VALIDATED_COMMIT', PUSHED), host,
  )
  check(result.status === 'SUCCESS' && result.reason === 'validated_commit_published', 'P approved reviewed commit publishes normally')
  check(result.mutation_count === 2 && result.protected_operation_count === 1, 'P publication is one push and one PR create under one protected operation')
  check(host.metrics.push === 1 && host.metrics.createPull === 1, 'P unchanged publication performs each mutation once')
  check(host.metrics.createdPull.draft === false, 'P normal Task publication creates a non-Draft PR')
  check(!host.metrics.apiCalls.some(({ method }) => method === 'PATCH'), 'P normal publication does not insert legacy Task-state or PATCH the PR')
}

{
  const host = makeNormalHostV1({ initialHead: PUSHED })
  const result = await executeNormalTaskExecutionOperatorV1(
    normalRequestV1('PUBLISH_VALIDATED_COMMIT', PUSHED, {
      validation_results: [{ command: 'focused validation', result: 'PASS', exact_head: PARENT }],
    }), host,
  )
  check(result.status === 'SUCCESS', 'P publication reuses admitted validation evidence bound to the pre-commit HEAD')
  const relabeled = await executeNormalTaskExecutionOperatorV1(
    normalRequestV1('PUBLISH_VALIDATED_COMMIT', PUSHED, {
      validation_results: [{ command: 'focused validation', result: 'PASS', exact_head: PUSHED }],
    }), makeNormalHostV1({ initialHead: PUSHED }),
  )
  check(relabeled.reason === 'normal_task_execution_request_value_invalid', 'P publication rejects validation evidence relabeled to the resulting commit HEAD')
}

{
  const host = makeNormalHostV1({ initialHead: PUSHED, remoteInitially: PARENT })
  const result = await executeNormalTaskExecutionOperatorV1(
    normalRequestV1('PUBLISH_VALIDATED_COMMIT', PUSHED, {
      expected_pr: PR_NUMBER,
      expected_remote_head: PARENT,
    }),
    host,
  )
  check(result.status === 'SUCCESS' && result.reason === 'validated_correction_published', 'P same-task correction pushes the newly reviewed exact commit to the existing PR')
  check(result.mutation_count === 1 && host.metrics.push === 1 && host.metrics.createPull === 0, 'P correction publication updates only the branch and never creates a duplicate PR')
  check(result.pr_number === PR_NUMBER && result.pushed_head === PUSHED, 'P corrected PR is directly refetched at the successor HEAD')
}

{
  const correctionDelta = [PATHS[0]]
  const host = makeNormalHostV1({ initialHead: PUSHED, remoteInitially: PARENT, changedPaths: correctionDelta })
  const result = await executeNormalTaskExecutionOperatorV1(
    normalRequestV1('PUBLISH_VALIDATED_COMMIT', PUSHED, {
      expected_pr: PR_NUMBER,
      expected_remote_head: PARENT,
      changed_paths: correctionDelta,
    }),
    host,
  )
  check(result.status === 'SUCCESS' && result.reason === 'validated_correction_published', 'P exact reviewed correction subset publishes to the existing PR')
  check(result.changed_paths.join(',') === correctionDelta.join(','), 'P publication preserves exact correction delta distinct from cumulative scope')
}

{
  const host = makeNormalHostV1({
    initialHead: PUSHED,
    currentBase: FRESH_BASE,
    remoteInitially: PARENT,
    existingPr: true,
    advancedPaths: ['docs/unrelated-main-change.md'],
  })
  const result = await executeNormalTaskExecutionOperatorV1(
    normalRequestV1('PUBLISH_VALIDATED_COMMIT', PUSHED, {
      expected_base: FRESH_BASE,
      expected_pr: PR_NUMBER,
      expected_remote_head: PARENT,
    }),
    host,
  )
  check(result.status === 'SUCCESS' && result.reason === 'validated_correction_published', 'P disjoint fresh-main advancement preserves reachable successor publication')
  check(host.metrics.push === 1 && result.pushed_head === PUSHED, 'P fresh-base successor publishes once from the existing PR lineage')
}

{
  const host = makeNormalHostV1({
    initialHead: PUSHED,
    remoteInitially: PARENT,
    successorIsDescendant: false,
  })
  const result = await executeNormalTaskExecutionOperatorV1(
    normalRequestV1('PUBLISH_VALIDATED_COMMIT', PUSHED, {
      expected_pr: PR_NUMBER,
      expected_remote_head: PARENT,
    }),
    host,
  )
  check(result.reason === 'successor_head_not_descendant' && result.mutation_count === 0, 'P a leased but non-descendant correction stops before publication mutation')
  check(host.metrics.push === 0 && host.metrics.createPull === 0, 'P non-descendant correction performs no push or PR mutation')
}

{
  const host = makeNormalHostV1({ initialHead: PUSHED, remoteInitially: PUSHED })
  const duplicate = await executeNormalTaskExecutionOperatorV1(
    normalRequestV1('PUBLISH_VALIDATED_COMMIT', PUSHED), host,
  )
  check(duplicate.reason === 'remote_branch_already_exists' && duplicate.mutation_count === 0, 'P a pre-existing remote branch fails closed instead of republishing')
  check(host.metrics.push === 0 && host.metrics.createPull === 0, 'P remote identity collision performs no mutation')
}

for (const result of ["FAIL", "PENDING"]) {
 const host = makeNormalHostV1(); const request = normalRequestV1("COMMIT_VALIDATED_TREE", PARENT, {validation_results:[{command:"test", result, exact_head:PARENT}]});
 const rejected = await executeNormalTaskExecutionOperatorV1(request,host); check(rejected.status === "STOP" && host.metrics.commit === 0, "failed validation prevents commit");
}
check(!runnerSource.includes("refetchContinuationEvent"), "event-file authority removed");
check(!runnerSource.includes("executeBootstrapPublicationOperatorV1"), "legacy bootstrap removed");
process.stdout.write(assertions + " assertions passed\n");
