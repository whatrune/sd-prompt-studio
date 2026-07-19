import type { LogicalTier, ReasoningLevel } from '../deployment-binding'

export const MODEL_ROUTING_CONTRACT_VERSION = 'model_routing_v1' as const

export const CANONICAL_ROUTING_ROLES = [
  'Worker',
  'Architect Team',
  'Backend Implementer',
  'Frontend Implementer',
  'Research Execution OP',
  'Image Analysis OP',
  'Research Review OP',
  'Maintenance OP',
  'Reporting OP',
] as const

export const CLASSIFICATION_LEVELS = ['low', 'medium', 'high'] as const
export const LATENCY_POSTURES = ['low_latency', 'standard', 'extended'] as const
export const ROUTING_FAILURE_STATUSES = ['blocked', 'failed'] as const
export const ROUTING_FAILURE_CODES = [
  'invalid_input',
  'unsupported_value',
  'policy_conflict',
  'authority_boundary',
  'missing_reference',
  'internal_failure',
] as const
export const ROUTING_FAILURE_STAGES = [
  'admission',
  'role_binding',
  'classification',
  'policy_resolution',
  'contract_validation',
  'internal_processing',
] as const

export type DeepReadonly<T> =
  T extends (...args: never[]) => unknown ? T
    : T extends readonly (infer U)[] ? readonly DeepReadonly<U>[]
      : T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
        : T

export type CanonicalRoutingRole = (typeof CANONICAL_ROUTING_ROLES)[number]
export type ClassificationLevel = (typeof CLASSIFICATION_LEVELS)[number]
export type LatencyPosture = (typeof LATENCY_POSTURES)[number]
export type RoutingFailureStatus = (typeof ROUTING_FAILURE_STATUSES)[number]
export type RoutingFailureCode = (typeof ROUTING_FAILURE_CODES)[number]
export type RoutingFailureStage = (typeof ROUTING_FAILURE_STAGES)[number]

export interface SourcedClassification<T extends string = string> {
  readonly value: T
  readonly source_ref: string
}

export type ComplexityClassification = SourcedClassification<ClassificationLevel>
export type RiskClassification = SourcedClassification

export type StructuredOutputRequirement =
  | { readonly mode: 'none' }
  | {
      readonly mode: 'required'
      readonly profile_refs: readonly string[]
    }

export interface ContextRequirement {
  readonly required_context_refs: readonly string[]
  readonly optional_context_refs: readonly string[]
  readonly forbidden_context_categories: readonly string[]
  readonly source_ref: string
}

export interface SecurityRequirement {
  readonly policy_refs: readonly string[]
  readonly source_ref: string
}

export interface RoutingInput {
  readonly routing_contract_version: typeof MODEL_ROUTING_CONTRACT_VERSION
  readonly task_id: string
  readonly assignment_revision: string
  readonly canonical_record: string
  readonly assigned_role: CanonicalRoutingRole
  readonly task_type: SourcedClassification
  readonly complexity: ComplexityClassification
  readonly risk_level: RiskClassification
  readonly required_output_type: SourcedClassification
  readonly structured_output_requirement: StructuredOutputRequirement
  readonly context_requirement: ContextRequirement
  readonly validation_requirement: string
  readonly latency_requirement: SourcedClassification<LatencyPosture>
  readonly security_requirement: SecurityRequirement
  readonly routing_policy_ref: string
  readonly response_policy_ref: string
  readonly evaluation_timestamp: string
}

export interface RoutingDecision {
  readonly routing_contract_version: typeof MODEL_ROUTING_CONTRACT_VERSION
  readonly task_id: string
  readonly assignment_revision: string
  readonly logical_tier: LogicalTier
  readonly required_reasoning_level: ReasoningLevel
  readonly capability_floor_ref: string
  readonly response_profile_ref: string
  readonly context_policy_ref: string
  readonly required_context_refs: readonly string[]
  readonly optional_context_refs: readonly string[]
  readonly forbidden_context_categories: readonly string[]
  readonly required_structured_output_profile_refs: readonly string[]
  readonly required_tool_profile_refs: readonly string[]
  readonly latency_policy_ref: string
  readonly cost_policy_ref: string
  readonly security_policy_refs: readonly string[]
  readonly validation_policy_ref: string
  readonly applied_rule_refs: readonly string[]
  readonly decision_rationale: string
  readonly evaluation_timestamp: string
}

export interface RoutingFailure {
  readonly routing_contract_version: typeof MODEL_ROUTING_CONTRACT_VERSION
  readonly task_id: string
  readonly assignment_revision: string
  readonly status: RoutingFailureStatus
  readonly failure_code: RoutingFailureCode
  readonly failed_stage: RoutingFailureStage
  readonly path: string
  readonly message: string
  readonly affected_ref: string
  readonly decision_owner: string
  readonly recommended_next_action: string
  readonly evaluation_timestamp: string
}

export type ModelRoutingResult = RoutingDecision | RoutingFailure

export type ModelRoutingContractValidationCode =
  | 'INVALID_TYPE'
  | 'MISSING_FIELD'
  | 'UNKNOWN_FIELD'
  | 'INVALID_VALUE'
  | 'DUPLICATE_VALUE'
  | 'SECRET_FIELD'
  | 'INCONSISTENT_VALUE'

export interface ModelRoutingContractValidationError {
  readonly code: ModelRoutingContractValidationCode
  readonly path: string
  readonly message: string
}

export type ModelRoutingValidationResult<T, K extends string> =
  | {
      readonly accepted: true
      readonly value: DeepReadonly<T>
      readonly errors: readonly []
    } & Readonly<Record<K, DeepReadonly<T>>>
  | {
      readonly accepted: false
      readonly errors: readonly ModelRoutingContractValidationError[]
    }

export type RoutingInputValidationResult = ModelRoutingValidationResult<RoutingInput, 'input'>
export type RoutingDecisionValidationResult = ModelRoutingValidationResult<RoutingDecision, 'decision'>
export type RoutingFailureValidationResult = ModelRoutingValidationResult<RoutingFailure, 'failure'>
