import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })

const bindingSetIdentity = () => ({
  contract_version: 'deployment_binding_set_v1',
  binding_set_id: 'deployment_binding_set.example',
  binding_set_revision: 1,
})

const bindingReference = binding => ({
  binding_id: binding.binding_id,
  binding_revision: binding.binding_revision,
})

const binding = ({ id = 'primary', priority = 100 } = {}) => ({
  contract_version: 'deployment_binding_v1',
  binding_id: `deployment_binding.${id}`,
  binding_revision: 1,
  tier_binding: {
    routing_contract_version: 'model_routing_v1',
    logical_tier: 'general',
    capability_floor_ref: 'policy.example/general',
    required_reasoning_level: 'medium',
  },
  deployment: {
    provider_id: 'provider.example',
    model_family: 'model-family-example',
    model_version: `exact-version-${id}`,
    deployment_id: `deployment-${id}`,
  },
  capabilities: {
    supported_reasoning_levels: ['medium'],
    declared_context_limit_tokens: 100,
    reserved_output_tokens: 20,
    usable_input_limit_tokens: 80,
    context_evidence_ref: 'docs/evidence/context.md',
    tool_profile_refs: [],
    structured_output_profile_refs: [],
    response_profile_refs: ['response-profile.example/v1'],
  },
  compatibility: {
    execution_adapter_contract_versions: ['execution-adapter-example-v1'],
    runner_profile_refs: ['runner-profile.example/v1'],
    sandbox_profile_refs: ['sandbox-profile.example/v1'],
    network_policy_refs: ['network-policy.example/v1'],
    tool_profile_refs: [],
    response_profile_refs: ['response-profile.example/v1'],
  },
  operations: {
    cost_class: 'balanced',
    budget_posture: 'balanced',
    cost_evidence_ref: 'docs/evidence/cost.md',
    latency_class: 'standard',
    reliability_class: 'standard',
    latency_evidence_ref: 'docs/evidence/latency.md',
    reliability_evidence_ref: 'docs/evidence/reliability.md',
    availability_requirement: 'standard',
    retry_policy_ref: 'retry-policy.example/v1',
    monitoring_profile_ref: 'monitoring-profile.example/v1',
    capacity_policy_ref: 'capacity-policy.example/v1',
  },
  resolution: {
    selection_priority: priority,
    resolution_scope_ref: 'resolution-scope.example/v1',
    fallback_binding_refs: [],
  },
  governance: {
    lifecycle_status: 'draft',
    created_at: '2000-01-01T00:00:00Z',
    review_due_at: '2000-01-02T00:00:00Z',
    change_reason: 'Deployment Resolver core fixture.',
  },
})

const validRequest = () => {
  const primary = binding()
  const primaryReference = bindingReference(primary)
  return {
    resolver_contract_version: 'deployment_resolver_v1',
    task_id: 'IMPLEMENT-DEPLOYMENT-RESOLVER-001',
    assignment_revision: 'task-assignment.example/v1',
    binding_set_snapshot: {
      binding_set_identity: bindingSetIdentity(),
      routing_contract_version: 'model_routing_v1',
      resolution_scope_ref: 'resolution-scope.example/v1',
      included_binding_refs: [primaryReference],
      bindings: [primary],
      approval_record: 'https://github.com/whatrune/sd-prompt-studio/issues/123',
      effective_from: '2000-01-01T00:00:00Z',
      review_due_at: '2000-01-02T00:00:00Z',
    },
    binding_set_validation: {
      binding_set_identity: bindingSetIdentity(),
      validation_proof_ref: 'docs/evidence/binding-set-validation.md',
      semantic_validation_version: 'binding_set_semantic_validation_v1',
      validated_binding_refs: [{ ...primaryReference }],
      status: 'completed',
      validated_at: '2000-01-01T00:00:00Z',
      valid_until: '2000-01-02T00:00:00Z',
    },
    execution_context: {
      routing_contract_version: 'model_routing_v1',
      resolution_scope_ref: 'resolution-scope.example/v1',
      logical_tier: 'general',
      capability_floor_ref: 'policy.example/general',
      required_reasoning_level: 'medium',
      required_input_tokens: 50,
      required_output_reserve_tokens: 20,
      context_estimate_ref: 'context-estimator.example/v1',
      execution_adapter_contract_version: 'execution-adapter-example-v1',
      runner_profile_ref: 'runner-profile.example/v1',
      sandbox_profile_ref: 'sandbox-profile.example/v1',
      network_policy_ref: 'network-policy.example/v1',
      required_tool_profile_refs: [],
      required_structured_output_profile_refs: [],
      response_profile_ref: 'response-profile.example/v1',
      cost_policy_ref: 'cost-policy.example/v1',
      availability_policy_ref: 'availability-policy.example/v1',
    },
    availability_snapshot: {
      snapshot_id: 'availability.snapshot-001',
      binding_set_identity: bindingSetIdentity(),
      observed_at: '2000-01-01T00:00:00Z',
      valid_until: '2000-01-02T00:00:00Z',
      binding_states: [{ binding_identity: { ...primaryReference }, state: 'available' }],
      verification_ref: 'docs/evidence/availability.md',
    },
    evaluation_timestamp: '2000-01-01T12:00:00Z',
  }
}

const addBinding = (request, candidate, state = 'available') => {
  const reference = bindingReference(candidate)
  request.binding_set_snapshot.included_binding_refs.push(reference)
  request.binding_set_snapshot.bindings.push(candidate)
  request.binding_set_validation.validated_binding_refs.push({ ...reference })
  request.availability_snapshot.binding_states.push({ binding_identity: { ...reference }, state })
  return candidate
}

try {
  const {
    resolveDeployment,
    validateResolutionResult,
  } = await server.ssrLoadModule('/src/deployment-resolver/index.ts')

  {
    const result = resolveDeployment(validRequest())
    assert.equal(result.status, 'completed', 'one eligible available Binding must resolve')
    assert.equal(result.selected_binding_identity.binding_id, 'deployment_binding.primary')
    assert.deepEqual(result.fallback_path, [])
    assert(Object.isFrozen(result), 'Resolution Result must be immutable')
    assert(Object.isFrozen(result.selected_binding), 'selected Binding must be immutable')
    assert.equal(validateResolutionResult(result).accepted, true, 'Resolver output must satisfy the frozen Result Contract')
  }

  {
    const request = validRequest()
    request.execution_context.logical_tier = 'advanced'
    const result = resolveDeployment(request)
    assert.equal(result.status, 'blocked')
    assert.equal(result.failure_code, 'no_candidate')
  }

  {
    const request = validRequest()
    addBinding(request, binding({ id: 'preferred', priority: 50 }))
    const result = resolveDeployment(request)
    assert.equal(result.status, 'completed')
    assert.equal(result.selected_binding_identity.binding_id, 'deployment_binding.preferred', 'lowest numeric priority must win')
  }

  {
    const request = validRequest()
    addBinding(request, binding({ id: 'ambiguous', priority: 100 }))
    const result = resolveDeployment(request)
    assert.equal(result.status, 'blocked')
    assert.equal(result.failure_code, 'ambiguous_candidate')
  }

  {
    const request = validRequest()
    request.availability_snapshot.binding_states[0].state = 'temporarily_unavailable'
    addBinding(request, binding({ id: 'unrelated', priority: 200 }), 'available')
    const result = resolveDeployment(request)
    assert.equal(result.status, 'blocked', 'an unrelated available candidate must not become implicit fallback')
    assert.equal(result.failure_code, 'unavailable')
  }

  {
    const request = validRequest()
    const fallback = addBinding(request, binding({ id: 'fallback', priority: 200 }), 'available')
    request.binding_set_snapshot.bindings[0].resolution.fallback_binding_refs.push(bindingReference(fallback))
    request.availability_snapshot.binding_states[0].state = 'temporarily_unavailable'
    const result = resolveDeployment(request)
    assert.equal(result.status, 'completed')
    assert.equal(result.selected_binding_identity.binding_id, fallback.binding_id)
    assert.deepEqual(result.fallback_path, [bindingReference(fallback)])
  }

  {
    const request = validRequest()
    const fallback = addBinding(request, binding({ id: 'fallback', priority: 200 }), 'temporarily_unavailable')
    request.binding_set_snapshot.bindings[0].resolution.fallback_binding_refs.push(bindingReference(fallback))
    request.availability_snapshot.binding_states[0].state = 'temporarily_unavailable'
    const result = resolveDeployment(request)
    assert.equal(result.status, 'blocked')
    assert.equal(result.failure_code, 'unavailable')
  }

  {
    const request = validRequest()
    const fallback = addBinding(request, binding({ id: 'fallback', priority: 200 }), 'available')
    request.binding_set_snapshot.bindings[0].resolution.fallback_binding_refs.push(bindingReference(fallback))
    request.availability_snapshot.binding_states[0].state = 'unknown'
    const result = resolveDeployment(request)
    assert.equal(result.status, 'blocked', 'unknown primary availability must stop before fallback')
    assert.equal(result.failure_code, 'unavailable')
  }

  {
    const request = validRequest()
    request.execution_context.required_reasoning_level = 'high'
    const result = resolveDeployment(request)
    assert.equal(result.status, 'blocked')
    assert.equal(result.failure_code, 'no_candidate')
  }

  {
    const request = validRequest()
    request.execution_context.required_input_tokens = 81
    const result = resolveDeployment(request)
    assert.equal(result.status, 'blocked')
    assert.equal(result.failure_code, 'no_candidate')
  }

  {
    const request = validRequest()
    request.execution_context.runner_profile_ref = 'runner-profile.unsupported/v1'
    const result = resolveDeployment(request)
    assert.equal(result.status, 'blocked')
    assert.equal(result.failure_code, 'no_candidate')
  }

  {
    const request = validRequest()
    request.execution_context.routing_contract_version = 'model_routing_v2'
    const result = resolveDeployment(request)
    assert.equal(result.status, 'blocked', 'Contract-invalid input must fail closed')
    assert.equal(result.failure_code, 'invalid_input')
  }

  {
    const requestA = validRequest()
    addBinding(requestA, binding({ id: 'preferred', priority: 50 }))
    const requestB = structuredClone(requestA)
    requestB.binding_set_snapshot.included_binding_refs.reverse()
    requestB.binding_set_snapshot.bindings.reverse()
    requestB.binding_set_validation.validated_binding_refs.reverse()
    requestB.availability_snapshot.binding_states.reverse()
    assert.deepEqual(
      resolveDeployment(requestA),
      resolveDeployment(requestB),
      'equivalent membership ordering must produce the same logical Result',
    )
  }

  console.log('Deployment Resolver core tests passed.')
} finally {
  await server.close()
}
