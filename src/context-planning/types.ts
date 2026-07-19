export const CONTEXT_PLAN_CONTRACT_VERSION = 'context_plan_v1' as const

export const CONTEXT_PLANNING_FAILURE_CODES = [
  'missing_field',
  'unknown_field',
  'invalid_reference',
  'duplicate_reference',
  'invalid_context_order',
  'forbidden_context',
  'inconsistent_identity',
  'invalid_value',
] as const

export const CONTEXT_PLANNING_FAILURE_STAGES = [
  'identity_validation',
  'reference_validation',
  'set_validation',
  'order_validation',
  'security_validation',
] as const

export type DeepReadonly<T> =
  T extends (...args: never[]) => unknown ? T
    : T extends readonly (infer U)[] ? readonly DeepReadonly<U>[]
      : T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
        : T

export type ContextPlanningFailureCode = (typeof CONTEXT_PLANNING_FAILURE_CODES)[number]
export type ContextPlanningFailureStage = (typeof CONTEXT_PLANNING_FAILURE_STAGES)[number]

export interface ContextPlan {
  readonly context_plan_contract_version: typeof CONTEXT_PLAN_CONTRACT_VERSION
  readonly context_plan_ref: string
  readonly task_id: string
  readonly assignment_revision: string
  readonly routing_contract_version: 'model_routing_v1'
  readonly routing_decision_ref: string
  readonly context_policy_ref: string
  readonly required_context_refs: readonly string[]
  readonly included_optional_context_refs: readonly string[]
  readonly excluded_optional_context_refs: readonly string[]
  readonly forbidden_context_categories: readonly string[]
  readonly context_order: readonly string[]
  readonly context_rendering_profile_ref: string
  readonly materialization_policy_ref: string
  readonly applied_rule_refs: readonly string[]
  readonly planner_version: string
  readonly evaluation_timestamp: string
}

export interface ContextPlanningFailure {
  readonly context_plan_contract_version: typeof CONTEXT_PLAN_CONTRACT_VERSION
  readonly task_id: string
  readonly assignment_revision: string
  readonly routing_contract_version: 'model_routing_v1'
  readonly routing_decision_ref: string
  readonly status: 'blocked'
  readonly failure_code: ContextPlanningFailureCode
  readonly failed_stage: ContextPlanningFailureStage
  readonly path: string
  readonly message: string
  readonly affected_ref: string
  readonly decision_owner: string
  readonly recommended_next_action: string
  readonly evaluation_timestamp: string
}

export interface ContextPlanValidationError {
  readonly code: ContextPlanningFailureCode
  readonly path: string
  readonly message: string
}

export type ContextPlanValidationResult =
  | {
      readonly accepted: true
      readonly plan: DeepReadonly<ContextPlan>
      readonly value: DeepReadonly<ContextPlan>
      readonly errors: readonly []
    }
  | {
      readonly accepted: false
      readonly failure: DeepReadonly<ContextPlanningFailure>
      readonly errors: readonly ContextPlanValidationError[]
    }

export type ContextPlanningFailureValidationResult =
  | {
      readonly accepted: true
      readonly failure: DeepReadonly<ContextPlanningFailure>
      readonly value: DeepReadonly<ContextPlanningFailure>
      readonly errors: readonly []
    }
  | {
      readonly accepted: false
      readonly errors: readonly ContextPlanValidationError[]
    }
