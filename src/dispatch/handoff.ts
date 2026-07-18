import { RESULT_STATUSES, VALIDATION_STATUSES } from './types'
import type {
  CanonicalFinalizationResult,
  CanonicalHandoffFields,
  CanonicalResultHandoff,
  DispatchState,
  ProvisionalDispatchResult,
  ProvisionalHandoff,
  ResultStatus,
  TaskAssignment,
  ValidationResult,
  WorkerExecutionResult,
} from './types'

const COMPLETION_STATUSES: readonly ResultStatus[] = ['completed', 'completed_with_warnings']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string')
}

function isValidationResult(value: unknown): value is ValidationResult {
  return isRecord(value)
    && typeof value.name === 'string'
    && (VALIDATION_STATUSES as readonly unknown[]).includes(value.status)
    && (value.details === undefined || typeof value.details === 'string')
}

function isWorkerExecutionResult(value: unknown): value is WorkerExecutionResult {
  return isRecord(value)
    && (RESULT_STATUSES as readonly unknown[]).includes(value.status)
    && isStringArray(value.completed_work)
    && isStringArray(value.created_files)
    && isStringArray(value.updated_files)
    && Array.isArray(value.validation_results)
    && value.validation_results.every(isValidationResult)
    && isStringArray(value.unresolved_items)
}

export function buildBlockedHandoff(
  assignment: unknown,
  unresolvedItems: readonly string[],
): ProvisionalHandoff {
  const record = isRecord(assignment) ? assignment : null
  return {
    task_id: typeof record?.task_id === 'string' && record.task_id.length > 0 ? record.task_id : null,
    role: typeof record?.assigned_role === 'string' && record.assigned_role.length > 0
      ? record.assigned_role
      : null,
    status: 'blocked',
    completed_work: [],
    created_files: [],
    updated_files: [],
    validation_results: [],
    unresolved_items: [...unresolvedItems],
  }
}
export function buildFailedHandoff(
  assignment: Readonly<TaskAssignment>,
  unresolvedItems: readonly string[],
): ProvisionalHandoff {
  return {
    task_id: assignment.task_id,
    role: assignment.assigned_role,
    status: 'failed',
    completed_work: [],
    created_files: [],
    updated_files: [],
    validation_results: [],
    unresolved_items: [...unresolvedItems],
  }
}

export function buildExecutionHandoff(
  assignment: Readonly<TaskAssignment>,
  executionResult: unknown,
): ProvisionalHandoff {
  if (!isWorkerExecutionResult(executionResult)) {
    return buildFailedHandoff(assignment, ['Worker Runner returned an invalid execution result.'])
  }

  const validationFailed = executionResult.validation_results.some(result => result.status === 'failed')
  const completionWithoutValidation = COMPLETION_STATUSES.includes(executionResult.status)
    && executionResult.validation_results.length === 0
  const status: ResultStatus = validationFailed || completionWithoutValidation
    ? 'failed'
    : executionResult.status
  const unresolvedItems = [...executionResult.unresolved_items]

  if (validationFailed) {
    unresolvedItems.push('One or more required validations failed.')
  }
  if (completionWithoutValidation) {
    unresolvedItems.push('A completion status requires validation results.')
  }

  return {
    task_id: assignment.task_id,
    role: assignment.assigned_role,
    status,
    completed_work: [...executionResult.completed_work],
    created_files: [...executionResult.created_files],
    updated_files: [...executionResult.updated_files],
    validation_results: executionResult.validation_results.map(result => ({ ...result })),
    unresolved_items: unresolvedItems,
  }
}

function validateCanonicalFields(input: unknown): string[] {
  if (!isRecord(input)) return ['Canonical Handoff fields are required.']

  const issues: string[] = []
  if (input.canonical_saved !== true) {
    issues.push('Canonical Handoff save confirmation is required before finalization.')
  }
  if (typeof input.canonical_record !== 'string' || input.canonical_record.trim().length === 0) {
    issues.push('canonical_record is required before finalization.')
  }
  if (!isStringArray(input.contract_boundary_confirmation)
    || input.contract_boundary_confirmation.length === 0) {
    issues.push('contract_boundary_confirmation is required before finalization.')
  }
  if (typeof input.escalation_required !== 'string' || input.escalation_required.trim().length === 0) {
    issues.push('escalation_required is required before finalization.')
  }
  if (typeof input.recommended_next_action !== 'string'
    || input.recommended_next_action.trim().length === 0) {
    issues.push('recommended_next_action is required before finalization.')
  }
  return issues
}

function stateAfterCanonicalSave(provisional: ProvisionalDispatchResult): DispatchState {
  if (provisional.provisional_handoff.status === 'completed') return 'completed'
  return provisional.state
}

export function finalizeCanonicalHandoff(
  provisional: ProvisionalDispatchResult,
  canonicalFieldsInput: unknown,
): CanonicalFinalizationResult {
  const issues = validateCanonicalFields(canonicalFieldsInput)
  if (issues.length > 0) {
    return {
      finalized: false,
      state: 'blocked',
      state_history: [...provisional.state_history, 'blocked'],
      provisional_handoff: provisional.provisional_handoff,
      issues,
    }
  }

  const fields = canonicalFieldsInput as CanonicalHandoffFields
  const provisionalHandoff = provisional.provisional_handoff
  if (provisionalHandoff.task_id === null || provisionalHandoff.role === null) {
    return {
      finalized: false,
      state: 'blocked',
      state_history: [...provisional.state_history, 'blocked'],
      provisional_handoff: provisionalHandoff,
      issues: ['A Canonical Result Handoff requires task_id and role.'],
    }
  }

  const handoff: CanonicalResultHandoff = {
    ...provisionalHandoff,
    task_id: provisionalHandoff.task_id,
    role: provisionalHandoff.role,
    canonical_record: fields.canonical_record,
    contract_boundary_confirmation: [...fields.contract_boundary_confirmation],
    escalation_required: fields.escalation_required,
    recommended_next_action: fields.recommended_next_action,
  }
  const state = stateAfterCanonicalSave(provisional)
  const stateHistory = state === provisional.state
    ? [...provisional.state_history]
    : [...provisional.state_history, state]

  return { finalized: true, state, state_history: stateHistory, handoff }
}
