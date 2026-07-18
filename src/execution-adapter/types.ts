import type {
  ResultStatus,
  ValidationResult,
  WorkerExecutionResult,
  WorkerRunContext,
  WorkerRunner,
} from '../dispatch'

export interface ExecutionRequest {
  task_id: string
  canonical_record: string
  assigned_role: string
  allowed_changes: readonly string[]
  forbidden_changes: readonly string[]
  validation: readonly string[]
  completion_conditions: readonly string[]
}

export type ExternalExecutionResult =
  | { kind: 'result'; result: unknown }
  | { kind: 'failed' }
  | { kind: 'contract_required' }
  | { kind: 'unsupported' }

export interface ExternalRunner {
  execute(
    request: Readonly<ExecutionRequest>,
    signal: AbortSignal,
  ): Promise<ExternalExecutionResult>
  cancel(request: Readonly<ExecutionRequest>): Promise<void>
}

export interface ExecutionAdapterOptions {
  timeout_ms: number
}

export interface ExecutionRequestResult {
  accepted: boolean
  request?: Readonly<ExecutionRequest>
  reason?: string
}

export type {
  ResultStatus,
  ValidationResult,
  WorkerExecutionResult,
  WorkerRunContext,
  WorkerRunner,
}
