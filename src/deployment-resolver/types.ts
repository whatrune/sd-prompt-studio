import type {
  BindingRevisionReference,
  DeploymentBinding,
  LogicalTier,
  ReasoningLevel,
} from '../deployment-binding'

export const DEPLOYMENT_RESOLVER_CONTRACT_VERSION = 'deployment_resolver_v1' as const
export const BINDING_SET_CONTRACT_VERSION = 'deployment_binding_set_v1' as const

export const AVAILABILITY_STATES = [
  'available',
  'temporarily_unavailable',
  'unknown',
  'not_evaluated',
] as const

export const RESOLUTION_FAILURE_CODES = [
  'invalid_input',
  'validation_missing',
  'no_candidate',
  'ambiguous_candidate',
  'unavailable',
  'incompatible_context',
  'internal_failure',
] as const

export type DeepReadonly<T> =
  T extends (...args: never[]) => unknown ? T
    : T extends readonly (infer U)[] ? readonly DeepReadonly<U>[]
      : T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
        : T

export type AvailabilityState = (typeof AVAILABILITY_STATES)[number]
export type ResolutionFailureCode = (typeof RESOLUTION_FAILURE_CODES)[number]

export interface BindingSetIdentity {
  readonly contract_version: typeof BINDING_SET_CONTRACT_VERSION
  readonly binding_set_id: string
  readonly binding_set_revision: number
}

export interface BindingSetSnapshot {
  readonly binding_set_identity: BindingSetIdentity
  readonly routing_contract_version: string
  readonly resolution_scope_ref: string
  readonly included_binding_refs: readonly DeepReadonly<BindingRevisionReference>[]
  readonly bindings: readonly DeepReadonly<DeploymentBinding>[]
  readonly approval_record: string
  readonly effective_from: string
  readonly review_due_at: string
}

export interface BindingSetValidationProof {
  readonly binding_set_identity: BindingSetIdentity
  readonly validation_proof_ref: string
  readonly semantic_validation_version: string
  readonly status: 'completed'
  readonly validated_at: string
  readonly valid_until: string
}

export interface ResolverExecutionContext {
  readonly routing_contract_version: string
  readonly resolution_scope_ref: string
  readonly logical_tier: LogicalTier
  readonly capability_floor_ref: string
  readonly required_reasoning_level: ReasoningLevel
  readonly required_input_tokens: number
  readonly required_output_reserve_tokens: number
  readonly context_estimate_ref: string
  readonly execution_adapter_contract_version: string
  readonly runner_profile_ref: string
  readonly sandbox_profile_ref: string
  readonly network_policy_ref: string
  readonly required_tool_profile_refs: readonly string[]
  readonly required_structured_output_profile_refs: readonly string[]
  readonly response_profile_ref: string
  readonly cost_policy_ref: string
  readonly availability_policy_ref: string
}

export interface BindingAvailabilityState {
  readonly binding_identity: DeepReadonly<BindingRevisionReference>
  readonly state: AvailabilityState
}

export interface AvailabilitySnapshot {
  readonly snapshot_id: string
  readonly binding_set_identity: BindingSetIdentity
  readonly observed_at: string
  readonly valid_until: string
  readonly binding_states: readonly BindingAvailabilityState[]
  readonly verification_ref: string
}

export interface ResolverRequest {
  readonly resolver_contract_version: typeof DEPLOYMENT_RESOLVER_CONTRACT_VERSION
  readonly task_id: string
  readonly assignment_revision: string
  readonly binding_set_snapshot: BindingSetSnapshot
  readonly binding_set_validation: BindingSetValidationProof
  readonly execution_context: ResolverExecutionContext
  readonly availability_snapshot: AvailabilitySnapshot
  readonly evaluation_timestamp: string
}

export interface ResolvedCompatibilityReferences {
  readonly execution_adapter_contract_version: string
  readonly runner_profile_ref: string
  readonly sandbox_profile_ref: string
  readonly network_policy_ref: string
  readonly tool_profile_refs: readonly string[]
  readonly structured_output_profile_refs: readonly string[]
  readonly response_profile_ref: string
}

export interface ResolutionDiagnostic {
  readonly code: string
  readonly path: string
  readonly diagnostics_ref: string
}

interface ResolutionResultCommon {
  readonly resolver_contract_version: typeof DEPLOYMENT_RESOLVER_CONTRACT_VERSION
  readonly task_id: string
  readonly assignment_revision: string
  readonly binding_set_identity: BindingSetIdentity
  readonly binding_set_validation_ref: string
  readonly availability_snapshot_id: string
  readonly evaluation_timestamp: string
  readonly applied_rules: readonly string[]
}

export interface ResolvedResult extends ResolutionResultCommon {
  readonly status: 'completed'
  readonly selected_binding_identity: DeepReadonly<BindingRevisionReference>
  readonly selected_binding: DeepReadonly<DeploymentBinding>
  readonly required_reasoning_level: ReasoningLevel
  readonly fallback_path: readonly DeepReadonly<BindingRevisionReference>[]
  readonly compatibility: ResolvedCompatibilityReferences
  readonly diagnostics: readonly ResolutionDiagnostic[]
}

export interface ResolutionFailureResult extends ResolutionResultCommon {
  readonly status: 'blocked' | 'failed'
  readonly failure_code: ResolutionFailureCode
  readonly reason: string
  readonly diagnostics_ref: string
}

export type ResolutionResult = ResolvedResult | ResolutionFailureResult

export type ResolverContractValidationCode =
  | 'INVALID_TYPE'
  | 'MISSING_FIELD'
  | 'UNKNOWN_FIELD'
  | 'INVALID_VALUE'
  | 'DUPLICATE_VALUE'
  | 'SECRET_FIELD'
  | 'INCONSISTENT_IDENTITY'

export interface ResolverContractValidationError {
  readonly code: ResolverContractValidationCode
  readonly path: string
  readonly message: string
}

export type ResolverRequestValidationResult =
  | {
      readonly accepted: true
      readonly request: DeepReadonly<ResolverRequest>
      readonly errors: readonly []
    }
  | {
      readonly accepted: false
      readonly errors: readonly ResolverContractValidationError[]
    }

export type ResolutionResultValidationResult =
  | {
      readonly accepted: true
      readonly result: DeepReadonly<ResolutionResult>
      readonly errors: readonly []
    }
  | {
      readonly accepted: false
      readonly errors: readonly ResolverContractValidationError[]
    }
