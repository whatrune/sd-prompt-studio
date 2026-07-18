import type { TaskAssignment } from './types'

export const WORKER_ROLE = 'Worker'

const REQUIRED_FIELDS = [
  'task_id',
  'canonical_record',
  'assigned_role',
  'allowed_changes',
  'forbidden_changes',
  'validation',
  'completion_conditions',
] as const

type RequiredField = (typeof REQUIRED_FIELDS)[number]

export interface AdmissionIssue {
  code: 'missing_assignment' | 'missing_field' | 'invalid_field' | 'invalid_role'
  field: RequiredField | 'assignment'
  message: string
}

export type AdmissionResult =
  | { accepted: true; assignment: Readonly<TaskAssignment> }
  | { accepted: false; issues: AdmissionIssue[] }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string')
}

export function validateAssignment(input: unknown): AdmissionResult {
  if (!isRecord(input)) {
    return {
      accepted: false,
      issues: [{
        code: 'missing_assignment',
        field: 'assignment',
        message: 'Task Assignment is required.',
      }],
    }
  }

  const issues: AdmissionIssue[] = []

  for (const field of REQUIRED_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(input, field)) {
      issues.push({ code: 'missing_field', field, message: `${field} is required.` })
    }
  }

  for (const field of ['task_id', 'canonical_record', 'assigned_role'] as const) {
    if (Object.prototype.hasOwnProperty.call(input, field) && !isNonEmptyString(input[field])) {
      issues.push({ code: 'invalid_field', field, message: `${field} must be a non-empty string.` })
    }
  }

  for (const field of ['allowed_changes', 'forbidden_changes', 'validation', 'completion_conditions'] as const) {
    if (Object.prototype.hasOwnProperty.call(input, field) && !isStringArray(input[field])) {
      issues.push({ code: 'invalid_field', field, message: `${field} must be an array of strings.` })
    }
  }

  if (isNonEmptyString(input.assigned_role) && input.assigned_role !== WORKER_ROLE) {
    issues.push({
      code: 'invalid_role',
      field: 'assigned_role',
      message: `assigned_role must exactly match ${WORKER_ROLE}.`,
    })
  }

  if (issues.length > 0) {
    return { accepted: false, issues }
  }

  const assignment: Readonly<TaskAssignment> = Object.freeze({
    task_id: input.task_id as string,
    canonical_record: input.canonical_record as string,
    assigned_role: input.assigned_role as string,
    allowed_changes: Object.freeze([...(input.allowed_changes as string[])]),
    forbidden_changes: Object.freeze([...(input.forbidden_changes as string[])]),
    validation: Object.freeze([...(input.validation as string[])]),
    completion_conditions: Object.freeze([...(input.completion_conditions as string[])]),
  })

  return { accepted: true, assignment }
}
