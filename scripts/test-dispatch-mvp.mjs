import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })

const validAssignment = () => ({
  task_id: 'IMPLEMENT-DISPATCH-MVP-TEST',
  canonical_record: 'https://github.com/whatrune/sd-prompt-studio/issues/94',
  assigned_role: 'Worker',
  allowed_changes: ['docs/example.md'],
  forbidden_changes: ['docs/automation/**'],
  validation: ['docs-only'],
  completion_conditions: ['Result Handoff produced'],
})

const completedExecution = () => ({
  status: 'completed',
  completed_work: ['Created the assigned document.'],
  created_files: ['docs/example.md'],
  updated_files: [],
  validation_results: [{ name: 'docs-only', status: 'passed' }],
  unresolved_items: [],
})

const git = args => execFileSync('git', args, { encoding: 'utf8' })
const DISPATCH_BOUNDARY_PATHS = [
  'package.json',
  'scripts/test-dispatch-mvp.mjs',
  'src/dispatch',
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
    return git(['diff', '--name-only', 'origin/main...HEAD', '--', ...DISPATCH_BOUNDARY_PATHS])
  }

  const eventPath = process.env.GITHUB_EVENT_PATH
  assert.equal(process.env.GITHUB_ACTIONS, 'true', 'origin/main is required outside GitHub Actions')
  assert(eventPath, 'GITHUB_EVENT_PATH is required for a shallow GitHub Actions checkout')
  const event = JSON.parse(readFileSync(eventPath, 'utf8'))
  const baseSha = event?.pull_request?.base?.sha
  assert.match(baseSha, /^[0-9a-f]{40}$/, 'pull_request.base.sha must be a full commit SHA')

  if (!commitExists(baseSha)) {
    execFileSync('git', ['fetch', '--no-tags', '--depth=1', 'origin', baseSha], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  }
  assert(commitExists(baseSha), 'the pull request base commit must be available for boundary validation')
  return git(['diff', '--name-only', baseSha, 'HEAD', '--', ...DISPATCH_BOUNDARY_PATHS])
}

const isDispatchBoundaryPath = path => path === 'package.json'
  || path === 'scripts/test-dispatch-mvp.mjs'
  || path.startsWith('src/dispatch/')

const dispatchBoundaryPaths = paths => paths
  .map(path => path.replaceAll('\\', '/'))
  .filter(isDispatchBoundaryPath)

try {
  const { Dispatcher, finalizeCanonicalHandoff, validateAssignment } = await server.ssrLoadModule('/src/dispatch/index.ts')

  const admission = validateAssignment(validAssignment())
  assert.equal(admission.accepted, true, 'a complete Worker assignment must pass admission')
  assert(Object.isFrozen(admission.assignment), 'the admitted assignment must be immutable')
  assert(Object.isFrozen(admission.assignment.allowed_changes), 'assignment boundaries must be immutable')

  for (const field of [
    'task_id',
    'canonical_record',
    'assigned_role',
    'allowed_changes',
    'forbidden_changes',
    'validation',
    'completion_conditions',
  ]) {
    const assignment = validAssignment()
    delete assignment[field]
    let calls = 0
    const dispatcher = new Dispatcher({ run: async () => { calls += 1; return completedExecution() } })
    const result = await dispatcher.dispatch(assignment)
    assert.equal(result.state, 'blocked', `missing ${field} must block dispatch`)
    assert.equal(result.provisional_handoff.status, 'blocked', `missing ${field} must produce a blocked result`)
    assert.equal(calls, 0, `missing ${field} must not invoke the Worker Runner`)
  }

  {
    let calls = 0
    const dispatcher = new Dispatcher({ run: async () => { calls += 1; return completedExecution() } })
    const result = await dispatcher.dispatch(null)
    assert.deepEqual(result.state_history, ['draft', 'blocked'])
    assert.equal(result.provisional_handoff.task_id, null)
    assert.equal(calls, 0, 'a missing assignment must not invoke the Worker Runner')
  }

  {
    let calls = 0
    const dispatcher = new Dispatcher({ run: async () => { calls += 1; return completedExecution() } })
    const result = await dispatcher.dispatch({ ...validAssignment(), assigned_role: 'Backend Implementer' })
    assert.equal(result.state, 'blocked')
    assert(result.provisional_handoff.unresolved_items.some(item => item.includes('Worker')))
    assert.equal(calls, 0, 'an unsupported role must not fall back to Worker')
  }

  {
    let receivedAssignment
    const dispatcher = new Dispatcher({
      run: async context => {
        receivedAssignment = context.assignment
        return completedExecution()
      },
    })
    const result = await dispatcher.dispatch(validAssignment())
    assert.equal(receivedAssignment.task_id, 'IMPLEMENT-DISPATCH-MVP-TEST')
    assert.deepEqual(result.state_history, ['approved', 'running'])
    assert.equal(result.state, 'running', 'canonical save is required before completed state')
    assert.equal(result.provisional_handoff.status, 'completed')
    assert.deepEqual(result.provisional_handoff.completed_work, ['Created the assigned document.'])
    assert.deepEqual(result.provisional_handoff.created_files, ['docs/example.md'])

    const missingCanonical = finalizeCanonicalHandoff(result, {
      canonical_saved: true,
      canonical_record: '',
      contract_boundary_confirmation: ['Contract changed: no'],
      escalation_required: 'no',
      recommended_next_action: 'Review',
    })
    assert.equal(missingCanonical.finalized, false)
    assert.equal(missingCanonical.state, 'blocked')

    const unsavedCanonical = finalizeCanonicalHandoff(result, {
      canonical_saved: false,
      canonical_record: 'https://github.com/whatrune/sd-prompt-studio/pull/95',
      contract_boundary_confirmation: ['Contract changed: no'],
      escalation_required: 'no',
      recommended_next_action: 'Review',
    })
    assert.equal(unsavedCanonical.finalized, false)
    assert.equal(unsavedCanonical.state, 'blocked')

    const missingBoundary = finalizeCanonicalHandoff(result, {
      canonical_saved: true,
      canonical_record: 'https://github.com/whatrune/sd-prompt-studio/pull/95',
      contract_boundary_confirmation: [],
      escalation_required: 'no',
      recommended_next_action: 'Review',
    })
    assert.equal(missingBoundary.finalized, false)

    const canonical = finalizeCanonicalHandoff(result, {
      canonical_saved: true,
      canonical_record: 'https://github.com/whatrune/sd-prompt-studio/pull/95',
      contract_boundary_confirmation: ['Contract changed: no'],
      escalation_required: 'no',
      recommended_next_action: 'Backend Architect review',
    })
    assert.equal(canonical.finalized, true)
    assert.equal(canonical.state, 'completed')
    assert.equal(canonical.handoff.status, 'completed')
    assert.equal(canonical.handoff.canonical_record, 'https://github.com/whatrune/sd-prompt-studio/pull/95')
    assert.deepEqual(canonical.handoff.contract_boundary_confirmation, ['Contract changed: no'])
    assert.equal(canonical.handoff.escalation_required, 'no')
    assert.equal(canonical.handoff.recommended_next_action, 'Backend Architect review')
  }

  {
    const dispatcher = new Dispatcher({ run: async () => { throw new Error('runner failed') } })
    const result = await dispatcher.dispatch(validAssignment())
    assert.deepEqual(result.state_history, ['approved', 'running', 'failed'])
    assert.equal(result.provisional_handoff.status, 'failed')
    assert(result.provisional_handoff.unresolved_items.includes('Worker Runner execution failed.'))
  }

  {
    const dispatcher = new Dispatcher({
      run: async () => ({
        ...completedExecution(),
        validation_results: [{ name: 'docs-only', status: 'failed', details: 'unexpected file' }],
      }),
    })
    const result = await dispatcher.dispatch(validAssignment())
    assert.equal(result.state, 'failed')
    assert.equal(result.provisional_handoff.status, 'failed')
    assert(result.provisional_handoff.unresolved_items.includes('One or more required validations failed.'))
  }

  {
    const dispatcher = new Dispatcher({
      run: async () => ({ ...completedExecution(), validation_results: [] }),
    })
    const result = await dispatcher.dispatch(validAssignment())
    assert.equal(result.provisional_handoff.status, 'failed', 'completed without validation evidence must fail')
  }

  {
    const dispatcher = new Dispatcher({ run: async () => ({ status: 'completed' }) })
    const result = await dispatcher.dispatch(validAssignment())
    assert.equal(result.provisional_handoff.status, 'failed', 'an invalid execution result must fail closed')
  }

  for (const status of ['needs_followup', 'completed_with_warnings', 'not_applicable']) {
    const dispatcher = new Dispatcher({ run: async () => ({ ...completedExecution(), status }) })
    const result = await dispatcher.dispatch(validAssignment())
    assert.equal(result.provisional_handoff.status, status, `${status} must be preserved`)
    assert.notEqual(result.state, 'completed', `${status} must not promote dispatch to completed`)
    const canonical = finalizeCanonicalHandoff(result, {
      canonical_saved: true,
      canonical_record: 'https://github.com/whatrune/sd-prompt-studio/pull/95',
      contract_boundary_confirmation: ['Contract changed: no'],
      escalation_required: 'no',
      recommended_next_action: 'Backend Architect review',
    })
    assert.equal(canonical.finalized, true)
    assert.equal(canonical.handoff.status, status, `Canonical Handoff must preserve ${status}`)
    assert.notEqual(canonical.state, 'completed', `${status} must not promote canonical state to completed`)
  }

  {
    const dispatcher = new Dispatcher({
      run: async () => ({
        ...completedExecution(),
        status: 'blocked',
        unresolved_items: ['Contract decision required: Backend Architect'],
      }),
    })
    const result = await dispatcher.dispatch(validAssignment())
    assert.equal(result.state, 'blocked')
    assert.equal(result.provisional_handoff.status, 'blocked')
  }

  const changedPaths = boundaryChangedPaths()
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map(path => path.replaceAll('\\', '/'))
  assert(
    changedPaths.every(isDispatchBoundaryPath),
    `Dispatch path filtering returned an out-of-scope path: ${changedPaths.join(', ')}`,
  )

  assert.deepEqual(
    dispatchBoundaryPaths([
      'src/execution-adapter/executionAdapter.ts',
      'scripts/test-execution-adapter.mjs',
      'docs/automation/10-runner-provisioning-design.md',
      'src/runner/runner.ts',
      '.github/workflows/runner.yml',
      'research/runs/example/manifest.json',
    ]),
    [],
    'later Automation, Execution Adapter, runner, and research changes must be outside the Dispatch boundary',
  )
  assert.deepEqual(
    dispatchBoundaryPaths([
      'src/dispatch/dispatcher.ts',
      'scripts/test-dispatch-mvp.mjs',
      'package.json',
    ]),
    [
      'src/dispatch/dispatcher.ts',
      'scripts/test-dispatch-mvp.mjs',
      'package.json',
    ],
    'the Dispatch Core implementation, its test, and package configuration must remain in scope',
  )

  console.log('Dispatch MVP core tests passed.')
} finally {
  await server.close()
}
