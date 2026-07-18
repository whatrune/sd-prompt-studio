import { RESULT_STATUSES, VALIDATION_STATUSES } from '../dispatch'
import type {
  ExecutionAdapterOptions,
  ExecutionRequest,
  ExecutionRequestResult,
  ExternalExecutionResult,
  ExternalRunner,
  ResultStatus,
  ValidationResult,
  WorkerExecutionResult,
  WorkerRunContext,
  WorkerRunner,
} from './types'

const WORKER_ROLE = 'Worker'
const TIMEOUT = Symbol('execution-timeout')

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string')
}

function isValidationResult(value: unknown): value is ValidationResult {
  return isRecord(value)
    && isNonEmptyString(value.name)
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

function fixedResult(status: ResultStatus, reason: string): WorkerExecutionResult {
  return {
    status,
    completed_work: [],
    created_files: [],
    updated_files: [],
    validation_results: [],
    unresolved_items: [reason],
  }
}

function copyWorkerResult(result: WorkerExecutionResult): WorkerExecutionResult {
  return {
    status: result.status,
    completed_work: [...result.completed_work],
    created_files: [...result.created_files],
    updated_files: [...result.updated_files],
    validation_results: result.validation_results.map(item => ({ ...item })),
    unresolved_items: [...result.unresolved_items],
  }
}

export function createExecutionRequest(context: unknown): ExecutionRequestResult {
  if (!isRecord(context) || !isRecord(context.assignment)) {
    return { accepted: false, reason: 'WorkerRunContext with an assignment is required.' }
  }

  const assignment = context.assignment
  for (const field of ['task_id', 'canonical_record', 'assigned_role'] as const) {
    if (!isNonEmptyString(assignment[field])) {
      return { accepted: false, reason: `${field} is required for execution.` }
    }
  }
  for (const field of [
    'allowed_changes',
    'forbidden_changes',
    'validation',
    'completion_conditions',
  ] as const) {
    if (!isStringArray(assignment[field])) {
      return { accepted: false, reason: `${field} is required for execution.` }
    }
  }
  if (assignment.assigned_role !== WORKER_ROLE) {
    return { accepted: false, reason: 'Only the Worker role is supported.' }
  }

  const taskId = assignment.task_id as string
  const canonicalRecord = assignment.canonical_record as string
  const assignedRole = assignment.assigned_role as string
  const allowedChanges = assignment.allowed_changes as string[]
  const forbiddenChanges = assignment.forbidden_changes as string[]
  const validation = assignment.validation as string[]
  const completionConditions = assignment.completion_conditions as string[]
  const request: Readonly<ExecutionRequest> = Object.freeze({
    task_id: taskId,
    canonical_record: canonicalRecord,
    assigned_role: assignedRole,
    allowed_changes: Object.freeze([...allowedChanges]),
    forbidden_changes: Object.freeze([...forbiddenChanges]),
    validation: Object.freeze([...validation]),
    completion_conditions: Object.freeze([...completionConditions]),
  })
  return { accepted: true, request }
}

function mapExternalResult(result: unknown): WorkerExecutionResult {
  if (!isRecord(result) || typeof result.kind !== 'string') {
    return fixedResult('failed', 'External Runner returned an invalid structured result.')
  }

  switch (result.kind) {
    case 'result':
      return isWorkerExecutionResult(result.result)
        ? copyWorkerResult(result.result)
        : fixedResult('failed', 'External Runner returned an invalid WorkerExecutionResult.')
    case 'failed':
      return fixedResult('failed', 'External Runner execution failed.')
    case 'contract_required':
      return fixedResult('blocked', 'Execution requires a Backend Architect contract decision.')
    case 'unsupported':
      return fixedResult('blocked', 'The requested execution is not supported.')
    default:
      return fixedResult('failed', 'External Runner returned an unsupported result kind.')
  }
}

export class ExecutionAdapter implements WorkerRunner {
  constructor(
    private readonly externalRunner: ExternalRunner,
    private readonly options: ExecutionAdapterOptions,
  ) {}

  async run(context: WorkerRunContext): Promise<WorkerExecutionResult> {
    const requestResult = createExecutionRequest(context)
    if (!requestResult.accepted || !requestResult.request) {
      return fixedResult('blocked', requestResult.reason ?? 'Execution Request is invalid.')
    }
    if (!Number.isFinite(this.options.timeout_ms) || this.options.timeout_ms <= 0) {
      return fixedResult('blocked', 'Execution timeout configuration is not supported.')
    }

    const request = requestResult.request
    const controller = new AbortController()
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<typeof TIMEOUT>(resolve => {
      timeoutId = setTimeout(() => resolve(TIMEOUT), this.options.timeout_ms)
    })

    try {
      const outcome = await Promise.race([
        this.externalRunner.execute(request, controller.signal),
        timeout,
      ])
      if (outcome === TIMEOUT) {
        controller.abort()
        try {
          await this.externalRunner.cancel(request)
          return fixedResult('failed', 'External Runner execution timed out.')
        } catch {
          return fixedResult('failed', 'External Runner timed out and termination was not confirmed.')
        }
      }
      return mapExternalResult(outcome as ExternalExecutionResult)
    } catch {
      return fixedResult('failed', 'External Runner execution failed.')
    } finally {
      if (timeoutId !== undefined) clearTimeout(timeoutId)
    }
  }
}
