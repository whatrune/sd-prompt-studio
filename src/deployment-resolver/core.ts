import { REASONING_LEVELS } from '../deployment-binding'
import type { BindingRevisionReference, DeploymentBinding } from '../deployment-binding'
import type {
  AvailabilityState,
  DeepReadonly,
  ResolutionFailureCode,
  ResolutionResult,
  ResolverExecutionContext,
  ResolverRequest,
} from './types'
import {
  validateResolutionResult,
  validateResolverRequest,
} from './validation'

const RULES = {
  inputAdmission: 'deployment-resolver.rules/input-admission-v1',
  staticFiltering: 'deployment-resolver.rules/static-filtering-v1',
  prioritySelection: 'deployment-resolver.rules/priority-selection-v1',
  availability: 'deployment-resolver.rules/availability-v1',
  explicitFallback: 'deployment-resolver.rules/explicit-fallback-v1',
  resultConstruction: 'deployment-resolver.rules/result-construction-v1',
} as const

const DIAGNOSTICS_REF = 'docs/automation/17-deployment-resolver-design.md'

type TrustedResolverRequest = DeepReadonly<ResolverRequest>
type TrustedBinding = DeepReadonly<DeploymentBinding>

function bindingKey(reference: DeepReadonly<BindingRevisionReference>): string {
  return `${reference.binding_id}@${reference.binding_revision}`
}

function includesAll(supported: readonly string[], required: readonly string[]): boolean {
  return required.every(value => supported.includes(value))
}

function reasoningRank(level: ResolverExecutionContext['required_reasoning_level']): number {
  return REASONING_LEVELS.indexOf(level)
}

function satisfiesRuntimeRequirements(
  binding: TrustedBinding,
  context: DeepReadonly<ResolverExecutionContext>,
): boolean {
  if (!binding.capabilities.supported_reasoning_levels.includes(context.required_reasoning_level)) return false
  if (reasoningRank(context.required_reasoning_level) < reasoningRank(binding.tier_binding.required_reasoning_level)) return false
  if (context.required_input_tokens > binding.capabilities.usable_input_limit_tokens) return false
  if (context.required_output_reserve_tokens > binding.capabilities.reserved_output_tokens) return false
  if (!includesAll(binding.capabilities.structured_output_profile_refs, context.required_structured_output_profile_refs)) return false
  if (!includesAll(binding.capabilities.tool_profile_refs, context.required_tool_profile_refs)) return false
  if (!includesAll(binding.compatibility.tool_profile_refs, context.required_tool_profile_refs)) return false
  if (!binding.capabilities.response_profile_refs.includes(context.response_profile_ref)) return false
  if (!binding.compatibility.response_profile_refs.includes(context.response_profile_ref)) return false
  if (!binding.compatibility.execution_adapter_contract_versions.includes(context.execution_adapter_contract_version)) return false
  if (!binding.compatibility.runner_profile_refs.includes(context.runner_profile_ref)) return false
  if (!binding.compatibility.sandbox_profile_refs.includes(context.sandbox_profile_ref)) return false
  if (!binding.compatibility.network_policy_refs.includes(context.network_policy_ref)) return false
  return true
}

function isPrimaryEligible(binding: TrustedBinding, request: TrustedResolverRequest): boolean {
  return binding.tier_binding.logical_tier === request.execution_context.logical_tier
    && binding.tier_binding.capability_floor_ref === request.execution_context.capability_floor_ref
    && satisfiesRuntimeRequirements(binding, request.execution_context)
}

function isFallbackEligible(
  binding: TrustedBinding,
  primary: TrustedBinding,
  request: TrustedResolverRequest,
): boolean {
  const tierOrder = ['efficient', 'general', 'advanced'] as const
  return tierOrder.indexOf(binding.tier_binding.logical_tier) >= tierOrder.indexOf(request.execution_context.logical_tier)
    && binding.deployment.provider_id === primary.deployment.provider_id
    && satisfiesRuntimeRequirements(binding, request.execution_context)
}

function commonResult(request: TrustedResolverRequest, appliedRules: readonly string[]) {
  return {
    resolver_contract_version: request.resolver_contract_version,
    task_id: request.task_id,
    assignment_revision: request.assignment_revision,
    binding_set_identity: request.binding_set_snapshot.binding_set_identity,
    binding_set_validation_ref: request.binding_set_validation.validation_proof_ref,
    availability_snapshot_id: request.availability_snapshot.snapshot_id,
    evaluation_timestamp: request.evaluation_timestamp,
    applied_rules: [...appliedRules],
  }
}

function finalize(result: ResolutionResult): DeepReadonly<ResolutionResult> {
  const validation = validateResolutionResult(result)
  if (!validation.accepted) {
    throw new Error('Deployment Resolver constructed a Result outside the frozen Contract.')
  }
  return validation.result
}

function blockedResult(
  request: TrustedResolverRequest,
  failureCode: Exclude<ResolutionFailureCode, 'internal_failure'>,
  reason: string,
  appliedRules: readonly string[],
): DeepReadonly<ResolutionResult> {
  return finalize({
    ...commonResult(request, [...appliedRules, RULES.resultConstruction]),
    status: 'blocked',
    failure_code: failureCode,
    reason,
    diagnostics_ref: DIAGNOSTICS_REF,
  })
}

function failedResult(request: TrustedResolverRequest): DeepReadonly<ResolutionResult> {
  return finalize({
    ...commonResult(request, [RULES.inputAdmission, RULES.resultConstruction]),
    status: 'failed',
    failure_code: 'internal_failure',
    reason: 'Deployment Resolver failed after input admission.',
    diagnostics_ref: DIAGNOSTICS_REF,
  })
}

function completedResult(
  request: TrustedResolverRequest,
  binding: TrustedBinding,
  fallbackPath: readonly DeepReadonly<BindingRevisionReference>[],
  appliedRules: readonly string[],
): DeepReadonly<ResolutionResult> {
  return finalize({
    ...commonResult(request, [...appliedRules, RULES.resultConstruction]),
    status: 'completed',
    selected_binding_identity: {
      binding_id: binding.binding_id,
      binding_revision: binding.binding_revision,
    },
    selected_binding: binding,
    required_reasoning_level: request.execution_context.required_reasoning_level,
    fallback_path: fallbackPath.map(reference => ({ ...reference })),
    compatibility: {
      execution_adapter_contract_version: request.execution_context.execution_adapter_contract_version,
      runner_profile_ref: request.execution_context.runner_profile_ref,
      sandbox_profile_ref: request.execution_context.sandbox_profile_ref,
      network_policy_ref: request.execution_context.network_policy_ref,
      tool_profile_refs: [...request.execution_context.required_tool_profile_refs],
      structured_output_profile_refs: [...request.execution_context.required_structured_output_profile_refs],
      response_profile_ref: request.execution_context.response_profile_ref,
    },
    diagnostics: [],
  })
}

function availabilityByBinding(request: TrustedResolverRequest): ReadonlyMap<string, AvailabilityState> {
  return new Map(
    request.availability_snapshot.binding_states.map(entry => [bindingKey(entry.binding_identity), entry.state]),
  )
}

function bindingByIdentity(request: TrustedResolverRequest): ReadonlyMap<string, TrustedBinding> {
  return new Map(
    request.binding_set_snapshot.bindings.map(binding => [bindingKey(binding), binding]),
  )
}

function resolveAdmittedRequest(request: TrustedResolverRequest): DeepReadonly<ResolutionResult> {
  const admissionRules = [RULES.inputAdmission, RULES.staticFiltering] as const
  const eligible = request.binding_set_snapshot.bindings.filter(binding => isPrimaryEligible(binding, request))
  if (eligible.length === 0) {
    return blockedResult(request, 'no_candidate', 'No statically compatible exact-tier Binding was found.', admissionRules)
  }

  const winningPriority = Math.min(...eligible.map(binding => binding.resolution.selection_priority))
  const winners = eligible.filter(binding => binding.resolution.selection_priority === winningPriority)
  const selectionRules = [...admissionRules, RULES.prioritySelection] as const
  if (winners.length !== 1) {
    return blockedResult(request, 'ambiguous_candidate', 'The winning selection priority is not unique.', selectionRules)
  }

  const primary = winners[0]
  const availability = availabilityByBinding(request)
  const primaryState = availability.get(bindingKey(primary))
  const availabilityRules = [...selectionRules, RULES.availability] as const
  if (primaryState === 'available') {
    return completedResult(request, primary, [], availabilityRules)
  }
  if (primaryState === 'unknown' || primaryState === 'not_evaluated' || primaryState === undefined) {
    return blockedResult(request, 'unavailable', 'Primary Binding availability is unknown or not evaluated.', availabilityRules)
  }

  const bindings = bindingByIdentity(request)
  const fallbackPath: DeepReadonly<BindingRevisionReference>[] = []
  const fallbackRules = [...availabilityRules, RULES.explicitFallback] as const
  for (const reference of primary.resolution.fallback_binding_refs) {
    fallbackPath.push(reference)
    const fallback = bindings.get(bindingKey(reference))
    if (!fallback || !isFallbackEligible(fallback, primary, request)) {
      return blockedResult(request, 'incompatible_context', 'Explicit fallback is missing or incompatible with the trusted Execution Context.', fallbackRules)
    }
    const fallbackState = availability.get(bindingKey(reference))
    if (fallbackState === 'available') {
      return completedResult(request, fallback, fallbackPath, fallbackRules)
    }
    if (fallbackState === 'unknown' || fallbackState === 'not_evaluated' || fallbackState === undefined) {
      return blockedResult(request, 'unavailable', 'Explicit fallback availability is unknown or not evaluated.', fallbackRules)
    }
  }

  return blockedResult(request, 'unavailable', 'Primary Binding and every explicit fallback are temporarily unavailable.', fallbackRules)
}

export function resolveDeployment(request: ResolverRequest): DeepReadonly<ResolutionResult> {
  const admission = validateResolverRequest(request)
  if (!admission.accepted) {
    return blockedResult(
      request as TrustedResolverRequest,
      'invalid_input',
      'Resolver Request failed the frozen Contract validation boundary.',
      [RULES.inputAdmission],
    )
  }

  try {
    return resolveAdmittedRequest(admission.request)
  } catch {
    return failedResult(admission.request)
  }
}
