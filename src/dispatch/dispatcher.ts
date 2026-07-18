import { validateAssignment } from './admission'
import { buildBlockedHandoff, buildExecutionHandoff, buildFailedHandoff } from './handoff'
import type { DispatchState, ProvisionalDispatchResult, ResultStatus, WorkerRunner } from './types'

function provisionalStateFor(status: ResultStatus): DispatchState {
  switch (status) {
    case 'blocked':
      return 'blocked'
    case 'failed':
      return 'failed'
    case 'completed':
    case 'completed_with_warnings':
    case 'needs_followup':
    case 'not_applicable':
      return 'running'
  }
}

export class Dispatcher {
  constructor(private readonly runner: WorkerRunner) {}

  async dispatch(assignmentInput: unknown): Promise<ProvisionalDispatchResult> {
    const admission = validateAssignment(assignmentInput)

    if (!admission.accepted) {
      const initialState: DispatchState = assignmentInput === null || assignmentInput === undefined
        ? 'draft'
        : 'approved'
      return {
        state: 'blocked',
        state_history: [initialState, 'blocked'],
        provisional_handoff: buildBlockedHandoff(
          assignmentInput,
          admission.issues.map(issue => issue.message),
        ),
      }
    }

    const stateHistory: DispatchState[] = ['approved', 'running']

    try {
      const executionResult = await this.runner.run({ assignment: admission.assignment })
      const provisionalHandoff = buildExecutionHandoff(admission.assignment, executionResult)
      const state = provisionalStateFor(provisionalHandoff.status)
      if (state !== 'running') stateHistory.push(state)
      return { state, state_history: stateHistory, provisional_handoff: provisionalHandoff }
    } catch {
      stateHistory.push('failed')
      return {
        state: 'failed',
        state_history: stateHistory,
        provisional_handoff: buildFailedHandoff(
          admission.assignment,
          ['Worker Runner execution failed.'],
        ),
      }
    }
  }
}
