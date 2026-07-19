import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })

const validBinding = () => ({
  contract_version: 'deployment_binding_v1',
  binding_id: 'deployment_binding.example',
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
    model_version: 'exact-version-example',
    deployment_id: 'deployment-example',
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
    selection_priority: 100,
    resolution_scope_ref: 'resolution-scope.example/v1',
    fallback_binding_refs: [],
  },
  governance: {
    lifecycle_status: 'draft',
    created_at: '2000-01-01T00:00:00Z',
    review_due_at: '2000-01-02T00:00:00Z',
    change_reason: 'Resolver contract fixture.',
  },
})

const bindingSetIdentity = () => ({
  contract_version: 'deployment_binding_set_v1',
  binding_set_id: 'deployment_binding_set.example',
  binding_set_revision: 1,
})

const bindingReference = binding => ({
  binding_id: binding.binding_id,
  binding_revision: binding.binding_revision,
})

const secondBinding = () => {
  const binding = validBinding()
  binding.binding_id = 'deployment_binding.secondary'
  binding.deployment.deployment_id = 'deployment-secondary'
  return binding
}

const validRequest = () => ({
  resolver_contract_version: 'deployment_resolver_v1',
  task_id: 'IMPLEMENT-DEPLOYMENT-RESOLVER-CONTRACT-001',
  assignment_revision: 'task-assignment.example/v1',
  binding_set_snapshot: {
    binding_set_identity: bindingSetIdentity(),
    routing_contract_version: 'model_routing_v1',
    resolution_scope_ref: 'resolution-scope.example/v1',
    included_binding_refs: [{ binding_id: 'deployment_binding.example', binding_revision: 1 }],
    bindings: [validBinding()],
    approval_record: 'https://github.com/whatrune/sd-prompt-studio/issues/121',
    effective_from: '2000-01-01T00:00:00Z',
    review_due_at: '2000-01-02T00:00:00Z',
  },
  binding_set_validation: {
    binding_set_identity: bindingSetIdentity(),
    validation_proof_ref: 'docs/evidence/binding-set-validation.md',
    semantic_validation_version: 'binding_set_semantic_validation_v1',
    validated_binding_refs: [{ binding_id: 'deployment_binding.example', binding_revision: 1 }],
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
    binding_states: [{
      binding_identity: { binding_id: 'deployment_binding.example', binding_revision: 1 },
      state: 'available',
    }],
    verification_ref: 'docs/evidence/availability.md',
  },
  evaluation_timestamp: '2000-01-01T12:00:00Z',
})

const validTwoMemberRequest = () => {
  const request = validRequest()
  const secondary = secondBinding()
  const secondaryReference = bindingReference(secondary)
  request.binding_set_snapshot.included_binding_refs.push(secondaryReference)
  request.binding_set_snapshot.bindings.push(secondary)
  request.binding_set_validation.validated_binding_refs.push({ ...secondaryReference })
  request.availability_snapshot.binding_states.push({
    binding_identity: { ...secondaryReference },
    state: 'available',
  })
  return request
}

const commonResult = () => ({
  resolver_contract_version: 'deployment_resolver_v1',
  task_id: 'IMPLEMENT-DEPLOYMENT-RESOLVER-CONTRACT-001',
  assignment_revision: 'task-assignment.example/v1',
  binding_set_identity: bindingSetIdentity(),
  binding_set_validation_ref: 'docs/evidence/binding-set-validation.md',
  availability_snapshot_id: 'availability.snapshot-001',
  evaluation_timestamp: '2000-01-01T12:00:00Z',
  applied_rules: ['deployment-resolver.example/input-admission-v1'],
})

const resolvedResult = () => ({
  ...commonResult(),
  status: 'completed',
  selected_binding_identity: { binding_id: 'deployment_binding.example', binding_revision: 1 },
  selected_binding: validBinding(),
  required_reasoning_level: 'medium',
  fallback_path: [],
  compatibility: {
    execution_adapter_contract_version: 'execution-adapter-example-v1',
    runner_profile_ref: 'runner-profile.example/v1',
    sandbox_profile_ref: 'sandbox-profile.example/v1',
    network_policy_ref: 'network-policy.example/v1',
    tool_profile_refs: [],
    structured_output_profile_refs: [],
    response_profile_ref: 'response-profile.example/v1',
  },
  diagnostics: [],
})

const failureResult = () => ({
  ...commonResult(),
  status: 'blocked',
  failure_code: 'no_candidate',
  reason: 'No statically compatible Binding was available.',
  diagnostics_ref: 'docs/evidence/resolution-diagnostics.md',
})

try {
  const {
    validateResolutionResult,
    validateResolverRequest,
  } = await server.ssrLoadModule('/src/deployment-resolver/index.ts')

  {
    const result = validateResolverRequest(validRequest())
    assert.equal(result.accepted, true, 'valid ResolverRequest must be accepted')
    assert(Object.isFrozen(result.request), 'accepted request must be immutable')
    assert(Object.isFrozen(result.request.binding_set_snapshot), 'accepted nested request data must be immutable')
    assert(Object.isFrozen(result.request.binding_set_validation.validated_binding_refs), 'validated Binding references must be immutable')
    assert(Object.isFrozen(result.request.binding_set_snapshot.included_binding_refs), 'included Binding references must be immutable')
    assert(Object.isFrozen(result.request.binding_set_snapshot.bindings), 'Binding collection must be immutable')
    assert(Object.isFrozen(result.request.availability_snapshot.binding_states), 'availability Binding states must be immutable')
    assert(Object.isFrozen(result.request.binding_set_snapshot.bindings[0].deployment), 'accepted Binding data must be deeply immutable')
    assert.throws(() => {
      result.request.execution_context.logical_tier = 'advanced'
    }, TypeError, 'accepted request mutation must be prevented')
  }

  for (const field of [
    'resolver_contract_version',
    'task_id',
    'assignment_revision',
    'binding_set_snapshot',
    'binding_set_validation',
    'execution_context',
    'availability_snapshot',
    'evaluation_timestamp',
  ]) {
    const request = validRequest()
    delete request[field]
    const result = validateResolverRequest(request)
    assert.equal(result.accepted, false, `missing ${field} must be rejected`)
    assert(result.errors.some(error => error.code === 'MISSING_FIELD' && error.path === `$.${field}`))
  }

  {
    const request = validRequest()
    request.binding_set_snapshot.binding_set_identity.binding_set_id = 'invalid identity'
    const result = validateResolverRequest(request)
    assert.equal(result.accepted, false, 'invalid Binding Set identity must be rejected')
    assert(result.errors.some(error => error.path === '$.binding_set_snapshot.binding_set_identity.binding_set_id'))
  }

  {
    const request = validRequest()
    request.availability_snapshot.binding_set_identity.binding_set_revision = 2
    const result = validateResolverRequest(request)
    assert.equal(result.accepted, false, 'mismatched availability identity must be rejected')
    assert(result.errors.some(error => error.code === 'INCONSISTENT_IDENTITY'))
  }

  {
    const request = validRequest()
    delete request.binding_set_validation.validated_binding_refs
    const result = validateResolverRequest(request)
    assert.equal(result.accepted, false, 'missing validated_binding_refs must be rejected')
    assert(result.errors.some(error => error.path === '$.binding_set_validation.validated_binding_refs'))
  }

  {
    const request = validRequest()
    request.binding_set_validation.validated_binding_refs.push({ binding_id: 'deployment_binding.extra', binding_revision: 1 })
    const result = validateResolverRequest(request)
    assert.equal(result.accepted, false, 'extra validation proof reference must be rejected')
    assert(result.errors.some(error => error.code === 'INCONSISTENT_MEMBERSHIP' && error.path.includes('validated_binding_refs[1]')))
  }

  {
    const request = validTwoMemberRequest()
    request.binding_set_validation.validated_binding_refs.pop()
    const result = validateResolverRequest(request)
    assert.equal(result.accepted, false, 'missing validation proof reference must be rejected')
    assert(result.errors.some(error => error.code === 'INCONSISTENT_MEMBERSHIP' && error.path === '$.binding_set_validation.validated_binding_refs'))
  }

  {
    const request = validRequest()
    request.binding_set_validation.validated_binding_refs.push({ ...request.binding_set_validation.validated_binding_refs[0] })
    const result = validateResolverRequest(request)
    assert.equal(result.accepted, false, 'duplicate validation proof reference must be rejected')
    assert(result.errors.some(error => error.code === 'DUPLICATE_VALUE' && error.path.includes('validated_binding_refs[1]')))
  }

  {
    const request = validTwoMemberRequest()
    request.binding_set_validation.validated_binding_refs.reverse()
    const result = validateResolverRequest(request)
    assert.equal(result.accepted, true, 'validation proof membership order must not affect acceptance')
  }

  {
    const request = validTwoMemberRequest()
    request.binding_set_snapshot.bindings.pop()
    const result = validateResolverRequest(request)
    assert.equal(result.accepted, false, 'missing Binding Record must be rejected')
    assert(result.errors.some(error => error.code === 'INCONSISTENT_MEMBERSHIP' && error.path === '$.binding_set_snapshot.bindings'))
  }

  {
    const request = validRequest()
    request.binding_set_snapshot.bindings.push(secondBinding())
    const result = validateResolverRequest(request)
    assert.equal(result.accepted, false, 'extra Binding Record must be rejected')
    assert(result.errors.some(error => error.code === 'INCONSISTENT_MEMBERSHIP' && error.path.includes('bindings[1]')))
  }

  {
    const request = validRequest()
    request.binding_set_snapshot.included_binding_refs.push({ ...request.binding_set_snapshot.included_binding_refs[0] })
    const result = validateResolverRequest(request)
    assert.equal(result.accepted, false, 'duplicate included reference must be rejected')
    assert(result.errors.some(error => error.code === 'DUPLICATE_VALUE' && error.path.includes('included_binding_refs[1]')))
  }

  {
    const request = validRequest()
    request.binding_set_snapshot.bindings.push(validBinding())
    const result = validateResolverRequest(request)
    assert.equal(result.accepted, false, 'duplicate Binding Record identity must be rejected')
    assert(result.errors.some(error => error.code === 'DUPLICATE_VALUE' && error.path.includes('bindings[1]')))
  }

  {
    const request = validRequest()
    request.binding_set_snapshot.included_binding_refs[0].binding_revision = 2
    const result = validateResolverRequest(request)
    assert.equal(result.accepted, false, 'Binding identity revision mismatch must be rejected')
    assert(result.errors.some(error => error.code === 'INCONSISTENT_MEMBERSHIP'))
  }

  {
    const request = validTwoMemberRequest()
    request.availability_snapshot.binding_states.pop()
    const result = validateResolverRequest(request)
    assert.equal(result.accepted, false, 'missing availability state must be rejected')
    assert(result.errors.some(error => error.code === 'INCONSISTENT_MEMBERSHIP' && error.path === '$.availability_snapshot.binding_states'))
  }

  {
    const request = validRequest()
    request.availability_snapshot.binding_states.push({
      binding_identity: bindingReference(secondBinding()),
      state: 'available',
    })
    const result = validateResolverRequest(request)
    assert.equal(result.accepted, false, 'extra availability state must be rejected')
    assert(result.errors.some(error => error.code === 'INCONSISTENT_MEMBERSHIP' && error.path.includes('binding_states[1]')))
  }

  {
    const request = validRequest()
    request.availability_snapshot.binding_states.push(structuredClone(request.availability_snapshot.binding_states[0]))
    const result = validateResolverRequest(request)
    assert.equal(result.accepted, false, 'duplicate availability state identity must be rejected')
    assert(result.errors.some(error => error.code === 'DUPLICATE_VALUE' && error.path.includes('binding_states[1]')))
  }

  for (const [name, mutate, expectedPath] of [
    ['future validation proof', request => { request.binding_set_validation.validated_at = '2000-01-01T13:00:00Z' }, '$.binding_set_validation.validated_at'],
    ['expired validation proof', request => { request.binding_set_validation.valid_until = request.evaluation_timestamp }, '$.binding_set_validation.valid_until'],
    ['future availability observation', request => { request.availability_snapshot.observed_at = '2000-01-01T13:00:00Z' }, '$.availability_snapshot.observed_at'],
    ['expired availability snapshot', request => { request.availability_snapshot.valid_until = request.evaluation_timestamp }, '$.availability_snapshot.valid_until'],
    ['snapshot before effective_from', request => { request.binding_set_snapshot.effective_from = '2000-01-01T13:00:00Z' }, '$.binding_set_snapshot.effective_from'],
    ['snapshot at review_due_at', request => { request.binding_set_snapshot.review_due_at = request.evaluation_timestamp }, '$.binding_set_snapshot.review_due_at'],
    ['reversed snapshot window', request => {
      request.binding_set_snapshot.effective_from = '2000-01-01T14:00:00Z'
      request.binding_set_snapshot.review_due_at = '2000-01-01T13:00:00Z'
    }, '$.binding_set_snapshot.review_due_at'],
  ]) {
    const request = validRequest()
    mutate(request)
    const result = validateResolverRequest(request)
    assert.equal(result.accepted, false, `${name} must be rejected`)
    assert(result.errors.some(error => error.code === 'INVALID_TIME_WINDOW' && error.path === expectedPath))
  }

  {
    const result = validateResolutionResult(resolvedResult())
    assert.equal(result.accepted, true, 'resolved Result shape must be accepted')
    assert(Object.isFrozen(result.result), 'accepted resolved Result must be immutable')
    assert(Object.isFrozen(result.result.selected_binding), 'selected Binding must be immutable')
    assert(Object.isFrozen(result.result.compatibility.tool_profile_refs), 'completed Result compatibility arrays must be immutable')
    assert(Object.isFrozen(result.result.compatibility.structured_output_profile_refs), 'completed Result structured output profiles must be immutable')
  }

  for (const [name, mutate, expectedPath] of [
    ['unsupported Adapter contract', result => { result.compatibility.execution_adapter_contract_version = 'execution-adapter-unsupported-v1' }, '$.compatibility.execution_adapter_contract_version'],
    ['unsupported Runner profile', result => { result.compatibility.runner_profile_ref = 'runner-profile.unsupported/v1' }, '$.compatibility.runner_profile_ref'],
    ['unsupported Sandbox profile', result => { result.compatibility.sandbox_profile_ref = 'sandbox-profile.unsupported/v1' }, '$.compatibility.sandbox_profile_ref'],
    ['unsupported Network policy', result => { result.compatibility.network_policy_ref = 'network-policy.unsupported/v1' }, '$.compatibility.network_policy_ref'],
    ['unsupported Tool profile', result => { result.compatibility.tool_profile_refs = ['tool-profile.unsupported/v1'] }, '$.compatibility.tool_profile_refs[0]'],
    ['Tool profile declared by capability only', result => {
      result.selected_binding.capabilities.tool_profile_refs = ['tool-profile.example/v1']
      result.compatibility.tool_profile_refs = ['tool-profile.example/v1']
    }, '$.compatibility.tool_profile_refs[0]'],
    ['Tool profile declared by compatibility only', result => {
      result.selected_binding.compatibility.tool_profile_refs = ['tool-profile.example/v1']
      result.compatibility.tool_profile_refs = ['tool-profile.example/v1']
    }, '$.compatibility.tool_profile_refs[0]'],
    ['unsupported Structured Output profile', result => { result.compatibility.structured_output_profile_refs = ['structured-output.unsupported/v1'] }, '$.compatibility.structured_output_profile_refs[0]'],
    ['unsupported Response profile', result => { result.compatibility.response_profile_ref = 'response-profile.unsupported/v1' }, '$.compatibility.response_profile_ref'],
    ['unsupported required_reasoning_level', result => { result.required_reasoning_level = 'high' }, '$.required_reasoning_level'],
    ['required_reasoning_level below Binding floor', result => {
      result.selected_binding.capabilities.supported_reasoning_levels = ['low', 'medium']
      result.required_reasoning_level = 'low'
    }, '$.required_reasoning_level'],
  ]) {
    const result = resolvedResult()
    mutate(result)
    const validation = validateResolutionResult(result)
    assert.equal(validation.accepted, false, `${name} must be rejected`)
    assert(validation.errors.some(error => error.code === 'INCONSISTENT_VALUE' && error.path === expectedPath))
  }

  {
    const result = resolvedResult()
    result.selected_binding_identity.binding_revision = 2
    const validation = validateResolutionResult(result)
    assert.equal(validation.accepted, false, 'selected Binding identity mismatch must be rejected')
    assert(validation.errors.some(error => error.code === 'INCONSISTENT_IDENTITY'))
  }

  {
    const result = validateResolutionResult(failureResult())
    assert.equal(result.accepted, true, 'failure Result shape must be accepted')
    assert(Object.isFrozen(result.result), 'accepted failure Result must be immutable')
  }

  {
    const result = failureResult()
    result.failure_code = 'internal_failure'
    const validation = validateResolutionResult(result)
    assert.equal(validation.accepted, false, 'internal failure must use failed status')
  }

  console.log('Deployment Resolver contract tests passed.')
} finally {
  await server.close()
}
