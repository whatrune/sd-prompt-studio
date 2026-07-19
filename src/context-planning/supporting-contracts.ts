import type { DeepReadonly } from './types'

export const CONTEXT_PLANNING_FAILURE_CONTRACT_VERSION = 'context_planning_failure_v1' as const
export const CONTEXT_POLICY_CONTRACT_VERSION = 'context_policy_v1' as const
export const CONTEXT_POLICY_RULE_CONTRACT_VERSION = 'context_policy_rule_v1' as const
export const CONTEXT_ORDERING_RULE_CONTRACT_VERSION = 'context_ordering_rule_v1' as const
export const CONTEXT_PLAN_REFERENCE_VERSION = 'context_plan_reference_v1' as const

export const CONTEXT_PLANNING_FAILURE_V1_CODES = [
  'inconsistent_identity',
  'missing_context_policy',
  'incompatible_context_policy',
  'unsupported_context_reference',
  'context_policy_no_match',
  'context_policy_conflict',
  'forbidden_context',
  'invalid_context_order',
  'result_validation_failed',
  'internal_failure',
] as const

export const CONTEXT_PLANNING_FAILURE_V1_STAGES = [
  'input_binding',
  'policy_validation',
  'optional_context_resolution',
  'order_generation',
  'reference_generation',
  'result_validation',
  'internal_processing',
] as const

export const CONTEXT_PLANNING_DECISION_OWNERS = [
  'routing_input_owner',
  'context_policy_owner',
  'backend_implementer',
  'architect_team',
] as const

export const CONTEXT_PLANNING_NEXT_ACTIONS = [
  'correct_routing_input',
  'provide_compatible_policy_snapshot',
  'correct_context_policy',
  'architect_review',
  'implementation_review',
] as const

export const CONTEXT_PLANNING_RETRY_POLICIES = [
  'after_input_revision',
  'after_policy_revision',
  'after_architect_decision',
  'after_implementation_fix',
  'no_automatic_retry',
] as const

export type ContextPlanningFailureV1Code = (typeof CONTEXT_PLANNING_FAILURE_V1_CODES)[number]
export type ContextPlanningFailureV1Stage = (typeof CONTEXT_PLANNING_FAILURE_V1_STAGES)[number]
export type ContextPlanningDecisionOwner = (typeof CONTEXT_PLANNING_DECISION_OWNERS)[number]
export type ContextPlanningNextAction = (typeof CONTEXT_PLANNING_NEXT_ACTIONS)[number]
export type ContextPlanningRetryPolicy = (typeof CONTEXT_PLANNING_RETRY_POLICIES)[number]

export interface ContextPlanningFailureV1 {
  readonly context_planning_failure_contract_version: typeof CONTEXT_PLANNING_FAILURE_CONTRACT_VERSION
  readonly task_id: string
  readonly assignment_revision: string
  readonly routing_contract_version: 'model_routing_v1'
  readonly routing_decision_ref: string
  readonly context_policy_ref: string
  readonly status: 'blocked' | 'failed'
  readonly failure_code: ContextPlanningFailureV1Code
  readonly failed_stage: ContextPlanningFailureV1Stage
  readonly path: string
  readonly message: string
  readonly affected_ref?: string
  readonly decision_owner: ContextPlanningDecisionOwner
  readonly recommended_next_action: ContextPlanningNextAction
  readonly retry_policy: ContextPlanningRetryPolicy
  readonly planner_version: string
  readonly evaluation_timestamp: string
}

export interface ContextPolicyRuleMatchV1 {
  readonly optional_context_ref: string
}

export interface ContextPolicyRuleV1 {
  readonly rule_contract_version: typeof CONTEXT_POLICY_RULE_CONTRACT_VERSION
  readonly rule_id: string
  readonly rule_revision: string
  readonly rule_ref: string
  readonly policy_ref: string
  readonly match: ContextPolicyRuleMatchV1
  readonly action: 'include' | 'exclude'
  readonly priority: number
  readonly source_ref: string
}

export interface ContextRankAssignmentV1 {
  readonly context_ref: string
  readonly rank: number
}

export interface ContextOrderingRuleV1 {
  readonly rule_contract_version: typeof CONTEXT_ORDERING_RULE_CONTRACT_VERSION
  readonly rule_id: string
  readonly rule_revision: string
  readonly rule_ref: string
  readonly policy_ref: string
  readonly strategy: 'explicit_rank'
  readonly rank_entries: readonly ContextRankAssignmentV1[]
  readonly source_ref: string
}

export interface ContextPolicyV1 {
  readonly context_policy_contract_version: typeof CONTEXT_POLICY_CONTRACT_VERSION
  readonly context_policy_ref: string
  readonly policy_revision: string
  readonly optional_context_rules: readonly ContextPolicyRuleV1[]
  readonly ordering_rule: ContextOrderingRuleV1
  readonly source_ref: string
  readonly approval_ref: string
}

export interface ContextPlanningFailureV1Mapping {
  readonly failure_code: ContextPlanningFailureV1Code
  readonly status: ContextPlanningFailureV1['status']
  readonly failed_stage: ContextPlanningFailureV1Stage
  readonly decision_owner: ContextPlanningDecisionOwner
  readonly recommended_next_action: ContextPlanningNextAction
  readonly retry_policy: ContextPlanningRetryPolicy
  readonly message: string
}

export const CONTEXT_PLANNING_FAILURE_V1_MAPPINGS = deepFreezeClone<readonly ContextPlanningFailureV1Mapping[]>([
  { failure_code: 'inconsistent_identity', status: 'blocked', failed_stage: 'input_binding', decision_owner: 'routing_input_owner', recommended_next_action: 'correct_routing_input', retry_policy: 'after_input_revision', message: 'Context Planning input identities do not match.' },
  { failure_code: 'missing_context_policy', status: 'blocked', failed_stage: 'policy_validation', decision_owner: 'context_policy_owner', recommended_next_action: 'provide_compatible_policy_snapshot', retry_policy: 'after_policy_revision', message: 'The exact routed Context Policy Snapshot is missing.' },
  { failure_code: 'incompatible_context_policy', status: 'blocked', failed_stage: 'policy_validation', decision_owner: 'context_policy_owner', recommended_next_action: 'provide_compatible_policy_snapshot', retry_policy: 'after_policy_revision', message: 'The supplied Context Policy Snapshot is incompatible with the routed requirement.' },
  { failure_code: 'unsupported_context_reference', status: 'blocked', failed_stage: 'input_binding', decision_owner: 'routing_input_owner', recommended_next_action: 'correct_routing_input', retry_policy: 'after_input_revision', message: 'A routed Context reference is outside the supported immutable-reference boundary.' },
  { failure_code: 'context_policy_no_match', status: 'blocked', failed_stage: 'optional_context_resolution', decision_owner: 'context_policy_owner', recommended_next_action: 'correct_context_policy', retry_policy: 'after_policy_revision', message: 'No exact Context Policy rule matches the optional Context reference.' },
  { failure_code: 'context_policy_conflict', status: 'blocked', failed_stage: 'optional_context_resolution', decision_owner: 'context_policy_owner', recommended_next_action: 'correct_context_policy', retry_policy: 'after_policy_revision', message: 'More than one exact Context Policy rule is authoritative at the highest priority.' },
  { failure_code: 'forbidden_context', status: 'blocked', failed_stage: 'input_binding', decision_owner: 'routing_input_owner', recommended_next_action: 'correct_routing_input', retry_policy: 'after_input_revision', message: 'Required Context violates a routed forbidden category.' },
  { failure_code: 'forbidden_context', status: 'blocked', failed_stage: 'optional_context_resolution', decision_owner: 'context_policy_owner', recommended_next_action: 'correct_context_policy', retry_policy: 'after_policy_revision', message: 'Included optional Context violates a routed forbidden category.' },
  { failure_code: 'invalid_context_order', status: 'blocked', failed_stage: 'order_generation', decision_owner: 'context_policy_owner', recommended_next_action: 'correct_context_policy', retry_policy: 'after_policy_revision', message: 'The approved ordering rule cannot produce one complete unique rank order.' },
  { failure_code: 'result_validation_failed', status: 'blocked', failed_stage: 'result_validation', decision_owner: 'architect_team', recommended_next_action: 'architect_review', retry_policy: 'after_architect_decision', message: 'The constructed Context Plan was rejected by the frozen Context Plan contract.' },
  { failure_code: 'internal_failure', status: 'failed', failed_stage: 'internal_processing', decision_owner: 'backend_implementer', recommended_next_action: 'implementation_review', retry_policy: 'after_implementation_fix', message: 'An unexpected Context Planner implementation defect prevented completion.' },
])

export type SupportingContractValidationCode =
  | 'missing_field'
  | 'unknown_field'
  | 'invalid_value'
  | 'invalid_reference'
  | 'duplicate_reference'
  | 'inconsistent_identity'
  | 'context_policy_no_match'
  | 'context_policy_conflict'
  | 'invalid_context_order'
  | 'reference_mismatch'

export interface SupportingContractValidationError {
  readonly code: SupportingContractValidationCode
  readonly path: string
  readonly message: string
}

export type SupportingContractValidationResult<T> =
  | {
      readonly accepted: true
      readonly value: DeepReadonly<T>
      readonly errors: readonly []
    }
  | {
      readonly accepted: false
      readonly errors: readonly DeepReadonly<SupportingContractValidationError>[]
    }

export type ContextPlanningFailureV1ValidationResult = SupportingContractValidationResult<ContextPlanningFailureV1>
export type ContextPolicyV1ValidationResult = SupportingContractValidationResult<ContextPolicyV1>
export type ContextPolicyRuleV1ValidationResult = SupportingContractValidationResult<ContextPolicyRuleV1>
export type ContextOrderingRuleV1ValidationResult = SupportingContractValidationResult<ContextOrderingRuleV1>

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function deepFreezeClone<T>(value: T): DeepReadonly<T> {
  if (Array.isArray(value)) return Object.freeze(value.map(item => deepFreezeClone(item))) as DeepReadonly<T>
  if (isRecord(value)) {
    const clone: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value)) clone[key] = deepFreezeClone(item)
    return Object.freeze(clone) as DeepReadonly<T>
  }
  return value as DeepReadonly<T>
}

export const NO_SUPPORTING_ERRORS = Object.freeze([]) as readonly []
