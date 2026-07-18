import { validateAssignment } from './admission'
import { buildBlockedHandoff, buildExecutionHandoff, buildFailedHandoff } from './handoff'
import type { DispatchResult, DispatchState, ResultStatus, WorkerRunner } from './types'

function terminalStateFor(status: ResultStatus): DispatchState {
  if (status === 'blocked') return 'blocked'
  if (status === 'failed') return 'failed'
  return 'completed'
}

export class Dispatcher {
  constructor(private readonly runner: WorkerRunner) {}

  async dispatch(assignmentInput: unknown): Promise<DispatchResult> {
    const admission = validateAssignment(assignmentInput)

    if (!admission.accepted) {
      const initialState: DispatchState = assignmentInput === null || assignmentInput === undefined
        ? 'draft'
        : 'approved'
      return {
        state: 'blocked',
        state_history: [initialState, 'blocked'],
        handoff: buildBlockedHandoff(
          assignmentInput,
          admission.issues.map(issue => issue.message),
        ),
      }
    }

    const stateHistory: DispatchState[] = ['approved', 'running']

    try {
      const executionResult = await this.runner.run({ assignment: admission.assignment })
      const handoff = buildExecutionHandoff(admission.assignment, executionResult)
      const state = terminalStateFor(handoff.status)
      stateHistory.push(state)
      return { state, state_history: stateHistory, handoff }
    } catch {
      stateHistory.push('failed')
      return {
        state: 'failed',
        state_history: stateHistory,
        handoff: buildFailedHandoff(admission.assignment, ['Worker Runner execution failed.']),
      }
    }
  }
}
