import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'

const git = args => execFileSync('git', args, { encoding: 'utf8' })
const EXECUTION_ADAPTER_BOUNDARY_PATHS = [
  'package.json',
  'scripts/test-execution-adapter.mjs',
  'src/execution-adapter',
]

const commitExists = ref => {
  try {
    execFileSync('git', ['cat-file', '-e', `${ref}^{commit}`], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

const boundaryChangedPaths = () => {
  if (commitExists('origin/main')) {
    return git(['diff', '--name-only', 'origin/main...HEAD', '--', ...EXECUTION_ADAPTER_BOUNDARY_PATHS])
  }

  const eventPath = process.env.GITHUB_EVENT_PATH
  assert.equal(process.env.GITHUB_ACTIONS, 'true', 'origin/main is required outside GitHub Actions')
  assert(eventPath, 'GITHUB_EVENT_PATH is required when origin/main is unavailable')

  const event = JSON.parse(readFileSync(eventPath, 'utf8'))
  const baseSha = event?.pull_request?.base?.sha
  assert.match(baseSha, /^[0-9a-f]{40}$/, 'pull request base SHA is required for boundary validation')

  if (!commitExists(baseSha)) {
    execFileSync('git', ['fetch', '--no-tags', '--depth=1', 'origin', baseSha], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  }
  assert(commitExists(baseSha), 'pull request base commit must be available after fetch')
  return git(['diff', '--name-only', baseSha, 'HEAD', '--', ...EXECUTION_ADAPTER_BOUNDARY_PATHS])
}

const isExecutionAdapterBoundaryPath = path => path === 'package.json'
  || path === 'scripts/test-execution-adapter.mjs'
  || path.startsWith('src/execution-adapter/')

const executionAdapterBoundaryPaths = paths => paths
  .map(path => path.replaceAll('\\', '/'))
  .filter(isExecutionAdapterBoundaryPath)

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })

const assignment = () => ({
  task_id: 'IMPLEMENT-EXECUTION-ADAPTER-TEST',
  canonical_record: 'https://github.com/whatrune/sd-prompt-studio/issues/98',
  assigned_role: 'Worker',
  allowed_changes: ['docs/example.md'],
  forbidden_changes: ['docs/automation/**'],
  validation: ['docs-only'],
  completion_conditions: ['Structured result returned'],
})

const workerResult = status => ({
  status,
  completed_work: ['Executed assigned work.'],
  created_files: ['docs/example.md'],
  updated_files: [],
  validation_results: [{ name: 'docs-only', status: 'passed' }],
  unresolved_items: [],
})

try {
  const { createExecutionRequest, ExecutionAdapter } = await server.ssrLoadModule('/src/execution-adapter/index.ts')

  {
    const result = createExecutionRequest({ assignment: assignment() })
    assert.equal(result.accepted, true)
    assert.equal(result.request.task_id, 'IMPLEMENT-EXECUTION-ADAPTER-TEST')
    assert(Object.isFrozen(result.request), 'Execution Request must be immutable')
    assert(Object.isFrozen(result.request.allowed_changes), 'Execution boundaries must be immutable')
  }

  for (const field of [
    'task_id',
    'canonical_record',
    'assigned_role',
    'allowed_changes',
    'forbidden_changes',
    'validation',
    'completion_conditions',
  ]) {
    const invalidAssignment = assignment()
    delete invalidAssignment[field]
    let calls = 0
    const adapter = new ExecutionAdapter({
      execute: async () => { calls += 1; return { kind: 'result', result: workerResult('completed') } },
      cancel: async () => {},
    }, { timeout_ms: 100 })
    const result = await adapter.run({ assignment: invalidAssignment })
    assert.equal(result.status, 'blocked', `missing ${field} must block execution`)
    assert.equal(calls, 0, `missing ${field} must not invoke the External Runner`)
  }

  {
    let calls = 0
    let received
    const adapter = new ExecutionAdapter({
      execute: async (request, signal) => {
        calls += 1
        received = { request, signal }
        return { kind: 'result', result: workerResult('completed_with_warnings') }
      },
      cancel: async () => {},
    }, { timeout_ms: 100 })
    const result = await adapter.run({ assignment: assignment() })
    assert.equal(calls, 1, 'one WorkerRunner run must invoke the External Runner once')
    assert.equal(received.request.task_id, 'IMPLEMENT-EXECUTION-ADAPTER-TEST')
    assert.equal(received.signal.aborted, false)
    assert.equal(result.status, 'completed_with_warnings', 'Adapter must preserve structured result status')
    assert.deepEqual(result.completed_work, ['Executed assigned work.'])
    assert.equal('canonical_saved' in result, false, 'Adapter must not finalize a Canonical Handoff')
  }

  for (const [kind, status] of [
    ['failed', 'failed'],
    ['contract_required', 'blocked'],
    ['unsupported', 'blocked'],
  ]) {
    const adapter = new ExecutionAdapter({
      execute: async () => ({ kind }),
      cancel: async () => {},
    }, { timeout_ms: 100 })
    const result = await adapter.run({ assignment: assignment() })
    assert.equal(result.status, status, `${kind} must map to ${status}`)
  }

  {
    const adapter = new ExecutionAdapter({
      execute: async () => ({ kind: 'result', result: { status: 'completed' } }),
      cancel: async () => {},
    }, { timeout_ms: 100 })
    const result = await adapter.run({ assignment: assignment() })
    assert.equal(result.status, 'failed', 'invalid structured output must fail closed')
  }

  {
    let signal
    let cancelCalls = 0
    const adapter = new ExecutionAdapter({
      execute: async (_request, receivedSignal) => {
        signal = receivedSignal
        return new Promise(() => {})
      },
      cancel: async () => { cancelCalls += 1 },
    }, { timeout_ms: 5 })
    const result = await adapter.run({ assignment: assignment() })
    assert.equal(result.status, 'failed')
    assert(result.unresolved_items.some(item => item.includes('timed out')))
    assert.equal(signal.aborted, true, 'timeout must abort the External Runner request')
    assert.equal(cancelCalls, 1, 'timeout must request External Runner cancellation once')
  }

  const changedPaths = boundaryChangedPaths()
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map(path => path.replaceAll('\\', '/'))
  assert(
    changedPaths.every(isExecutionAdapterBoundaryPath),
    `Execution Adapter path filtering returned an out-of-scope path: ${changedPaths.join(', ')}`,
  )

  assert.deepEqual(
    executionAdapterBoundaryPaths([
      'src/dispatch/dispatcher.ts',
      'scripts/test-dispatch-mvp.mjs',
      'docs/automation/12-model-routing-policy.md',
      'src/runner/runner.ts',
      '.github/workflows/runner.yml',
      'research/runs/example/manifest.json',
    ]),
    [],
    'Dispatch, Automation Design, runner, and research changes must be outside the Execution Adapter boundary',
  )
  assert.deepEqual(
    executionAdapterBoundaryPaths([
      'src/execution-adapter/executionAdapter.ts',
      'scripts/test-execution-adapter.mjs',
      'package.json',
    ]),
    [
      'src/execution-adapter/executionAdapter.ts',
      'scripts/test-execution-adapter.mjs',
      'package.json',
    ],
    'the Execution Adapter implementation, its test, and package configuration must remain in scope',
  )

  console.log('Execution Adapter core tests passed.')
} finally {
  await server.close()
}
