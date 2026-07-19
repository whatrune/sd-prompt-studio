export const LOGICAL_TIERS = ['efficient', 'general', 'advanced'] as const
export const REASONING_LEVELS = ['low', 'medium', 'high'] as const
export const LIFECYCLE_STATUSES = ['draft', 'approved', 'deprecated', 'retired'] as const

export type LogicalTier = (typeof LOGICAL_TIERS)[number]
export type ReasoningLevel = (typeof REASONING_LEVELS)[number]
export type LifecycleStatus = (typeof LIFECYCLE_STATUSES)[number]

export interface BindingRevisionReference {
  binding_id: string
  binding_revision: number
}

export interface TierBinding {
  routing_contract_version: string
  logical_tier: LogicalTier
  capability_floor_ref: string
  required_reasoning_level: ReasoningLevel
}

export interface DeploymentIdentity {
  provider_id: string
  model_family: string
  model_version: string
  deployment_id: string
  provider_profile_ref?: string
}

export interface DeploymentCapabilities {
  supported_reasoning_levels: ReasoningLevel[]
  default_reasoning_level?: ReasoningLevel
  declared_context_limit_tokens: number
  reserved_output_tokens: number
  usable_input_limit_tokens: number
  context_evidence_ref: string
  tool_profile_refs: string[]
  structured_output_profile_refs: string[]
  response_profile_refs: string[]
}

export interface DeploymentCompatibility {
  execution_adapter_contract_versions: string[]
  runner_profile_refs: string[]
  sandbox_profile_refs: string[]
  network_policy_refs: string[]
  tool_profile_refs: string[]
  response_profile_refs: string[]
}

export interface DeploymentOperations {
  cost_class: 'cost_optimized' | 'balanced' | 'quality_optimized'
  budget_posture: 'cost_first' | 'balanced' | 'quality_first'
  cost_evidence_ref: string
  latency_class: 'low_latency' | 'standard' | 'extended'
  reliability_class: 'standard' | 'high'
  latency_evidence_ref: string
  reliability_evidence_ref: string
  availability_requirement: 'standard' | 'high'
  retry_policy_ref: string
  monitoring_profile_ref: string
  capacity_policy_ref: string
}

export interface DeploymentResolution {
  selection_priority: number
  resolution_scope_ref: string
  fallback_binding_refs: BindingRevisionReference[]
}

export interface DeploymentGovernance {
  lifecycle_status: LifecycleStatus
  created_at: string
  effective_from?: string
  approved_at?: string
  deprecated_at?: string
  retired_at?: string
  review_due_at: string
  approval_owner?: string
  approval_record?: string
  architecture_review_ref?: string
  security_review_ref?: string
  capability_evidence_refs?: string[]
  quality_evaluation_refs?: string[]
  cost_evaluation_refs?: string[]
  latency_evaluation_refs?: string[]
  availability_evidence_refs?: string[]
  security_review_refs?: string[]
  compatibility_evidence_refs?: string[]
  supersedes?: BindingRevisionReference
  rollback_target?: BindingRevisionReference
  change_reason: string
}

export interface DeploymentBinding {
  contract_version: 'deployment_binding_v1'
  binding_id: string
  binding_revision: number
  tier_binding: TierBinding
  deployment: DeploymentIdentity
  capabilities: DeploymentCapabilities
  compatibility: DeploymentCompatibility
  operations: DeploymentOperations
  resolution: DeploymentResolution
  governance: DeploymentGovernance
}

export type DeploymentBindingValidationCode =
  | 'INVALID_TYPE'
  | 'MISSING_FIELD'
  | 'UNKNOWN_FIELD'
  | 'INVALID_VALUE'
  | 'DUPLICATE_VALUE'
  | 'SECRET_FIELD'
  | 'INCONSISTENT_VALUE'
  | 'SELF_REFERENCE'
  | 'REVISION_REUSED'
  | 'REVISION_NOT_INCREASING'
  | 'INITIAL_REVISION_INVALID'

export interface DeploymentBindingValidationError {
  code: DeploymentBindingValidationCode
  path: string
  message: string
}

export type DeploymentBindingValidationResult =
  | { accepted: true; binding: Readonly<DeploymentBinding>; errors: readonly [] }
  | { accepted: false; errors: readonly DeploymentBindingValidationError[] }
