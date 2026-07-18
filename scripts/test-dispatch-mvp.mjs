import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
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

try {
  const { Dispatcher, validateAssignment } = await server.ssrLoadModule('/src/dispatch/index.ts')

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
    assert.equal(result.handoff.status, 'blocked', `missing ${field} must produce a blocked handoff`)
    assert.equal(calls, 0, `missing ${field} must not invoke the Worker Runner`)
  }

  {
    let calls = 0
    const dispatcher = new Dispatcher({ run: async () => { calls += 1; return completedExecution() } })
    const result = await dispatcher.dispatch(null)
    assert.deepEqual(result.state_history, ['draft', 'blocked'])
    assert.equal(result.handoff.task_id, null)
    assert.equal(calls, 0, 'a missing assignment must not invoke the Worker Runner')
  }

  {
    let calls = 0
    const dispatcher = new Dispatcher({ run: async () => { calls += 1; return completedExecution() } })
    const result = await dispatcher.dispatch({ ...validAssignment(), assigned_role: 'Backend Implementer' })
    assert.equal(result.state, 'blocked')
    assert(result.handoff.unresolved_items.some(item => item.includes('Worker')))
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
    assert.deepEqual(result.state_history, ['approved', 'running', 'completed'])
    assert.equal(result.handoff.status, 'completed')
    assert.deepEqual(result.handoff.completed_work, ['Created the assigned document.'])
    assert.deepEqual(result.handoff.created_files, ['docs/example.md'])
  }

  {
    const dispatcher = new Dispatcher({ run: async () => { throw new Error('runner failed') } })
    const result = await dispatcher.dispatch(validAssignment())
    assert.deepEqual(result.state_history, ['approved', 'running', 'failed'])
    assert.equal(result.handoff.status, 'failed')
    assert(result.handoff.unresolved_items.includes('Worker Runner execution failed.'))
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
    assert.equal(result.handoff.status, 'failed')
    assert(result.handoff.unresolved_items.includes('One or more required validations failed.'))
  }

  {
    const dispatcher = new Dispatcher({
      run: async () => ({ ...completedExecution(), validation_results: [] }),
    })
    const result = await dispatcher.dispatch(validAssignment())
    assert.equal(result.handoff.status, 'failed', 'completed without validation evidence must fail')
  }

  {
    const dispatcher = new Dispatcher({ run: async () => ({ status: 'completed' }) })
    const result = await dispatcher.dispatch(validAssignment())
    assert.equal(result.handoff.status, 'failed', 'an invalid execution result must fail closed')
  }

  const changedPaths = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' })
    .trimEnd()
    .split(/\r?\n/)
    .filter(Boolean)
    .map(line => line.slice(3).replaceAll('\\', '/'))
  const allowedChange = path => path === 'package.json'
    || path === 'scripts/test-dispatch-mvp.mjs'
    || path.startsWith('src/dispatch/')
  assert(changedPaths.every(allowedChange), `dispatch MVP changed a forbidden path: ${changedPaths.join(', ')}`)

  console.log('Dispatch MVP core tests passed.')
} finally {
  await server.close()
}
