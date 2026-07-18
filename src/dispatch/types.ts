export const DISPATCH_STATES = [
  'draft',
  'approved',
  'running',
  'completed',
  'blocked',
  'failed',
] as const

export type DispatchState = (typeof DISPATCH_STATES)[number]

export const RESULT_STATUSES = [
  'completed',
  'completed_with_warnings',
  'needs_followup',
  'blocked',
  'failed',
  'not_applicable',
] as const

export type ResultStatus = (typeof RESULT_STATUSES)[number]

export const VALIDATION_STATUSES = ['passed', 'failed'] as const

export type ValidationStatus = (typeof VALIDATION_STATUSES)[number]

export interface TaskAssignment {
  task_id: string
  canonical_record: string
  assigned_role: string
  allowed_changes: readonly string[]
  forbidden_changes: readonly string[]
  validation: readonly string[]
  completion_conditions: readonly string[]
}

export interface ValidationResult {
  name: string
  status: ValidationStatus
  details?: string
}

export interface WorkerExecutionResult {
  status: ResultStatus
  completed_work: readonly string[]
  created_files: readonly string[]
  updated_files: readonly string[]
  validation_results: readonly ValidationResult[]
  unresolved_items: readonly string[]
}

export interface WorkerRunContext {
  assignment: Readonly<TaskAssignment>
}

export interface WorkerRunner {
  run(context: WorkerRunContext): Promise<WorkerExecutionResult>
}

export interface ProvisionalHandoff {
  task_id: string | null
  role: string | null
  status: ResultStatus
  completed_work: string[]
  created_files: string[]
  updated_files: string[]
  validation_results: ValidationResult[]
  unresolved_items: string[]
}

export interface CanonicalResultHandoff extends ProvisionalHandoff {
  task_id: string
  role: string
  canonical_record: string
  contract_boundary_confirmation: string[]
  escalation_required: string
  recommended_next_action: string
}

export interface ProvisionalDispatchResult {
  state: DispatchState
  state_history: DispatchState[]
  provisional_handoff: ProvisionalHandoff
}

export interface CanonicalHandoffFields {
  canonical_saved: true
  canonical_record: string
  contract_boundary_confirmation: readonly string[]
  escalation_required: string
  recommended_next_action: string
}

export type CanonicalFinalizationResult =
  | {
      finalized: true
      state: DispatchState
      state_history: DispatchState[]
      handoff: CanonicalResultHandoff
    }
  | {
      finalized: false
      state: 'blocked'
      state_history: DispatchState[]
      provisional_handoff: ProvisionalHandoff
      issues: string[]
    }
