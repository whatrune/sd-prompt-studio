import { RESULT_STATUSES, VALIDATION_STATUSES } from './types'
import type {
  ResultHandoff,
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
): ResultHandoff {
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
): ResultHandoff {
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
): ResultHandoff {
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
