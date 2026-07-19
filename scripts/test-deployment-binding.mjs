import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
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
    change_reason: 'Structural test fixture.',
  },
})

const approvedBinding = () => {
  const binding = validBinding()
  Object.assign(binding.governance, {
    lifecycle_status: 'approved',
    effective_from: '2000-01-01T00:00:00Z',
    approved_at: '2000-01-01T00:00:00Z',
    approval_owner: 'Product Owner',
    approval_record: 'https://github.com/whatrune/sd-prompt-studio/issues/115',
    architecture_review_ref: 'https://github.com/whatrune/sd-prompt-studio/pull/114',
    security_review_ref: 'docs/evidence/security-review.md',
    capability_evidence_refs: ['docs/evidence/capability.md'],
    quality_evaluation_refs: ['docs/evidence/quality.md'],
    cost_evaluation_refs: ['docs/evidence/cost.md'],
    latency_evaluation_refs: ['docs/evidence/latency.md'],
    availability_evidence_refs: ['docs/evidence/availability.md'],
    security_review_refs: ['docs/evidence/security-review.md'],
    compatibility_evidence_refs: ['docs/evidence/compatibility.md'],
  })
  return binding
}

try {
  const {
    validateDeploymentBinding,
    validateDeploymentBindingRevisionCandidate,
  } = await server.ssrLoadModule('/src/deployment-binding/index.ts')

  const schema = JSON.parse(readFileSync(new URL('../src/deployment-binding/deployment-binding.schema.json', import.meta.url), 'utf8'))
  assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema')
  assert.equal(schema.additionalProperties, false, 'Deployment Binding root must be closed')
  assert.deepEqual(schema.$defs.logicalTier.enum, ['efficient', 'general', 'advanced'])
  assert.equal(schema.$defs.governance.additionalProperties, false, 'Governance must be closed')

  {
    const result = validateDeploymentBinding(validBinding())
    assert.equal(result.accepted, true)
    assert(Object.isFrozen(result.binding), 'accepted Binding must be immutable')
    assert(Object.isFrozen(result.binding.deployment), 'accepted nested Binding data must be immutable')
  }

  assert.equal(validateDeploymentBinding(approvedBinding()).accepted, true, 'complete approved lifecycle must be accepted')

  for (const [field, invalidValue] of [
    ['contract_version', 'deployment_binding_v2'],
    ['binding_id', 'deployment_binding.Provider'],
  ]) {
    const binding = validBinding()
    binding[field] = invalidValue
    assert.equal(validateDeploymentBinding(binding).accepted, false, `invalid ${field} must be rejected`)
  }

  for (const field of [
    'contract_version',
    'binding_id',
    'binding_revision',
    'tier_binding',
    'deployment',
    'capabilities',
    'compatibility',
    'operations',
    'resolution',
    'governance',
  ]) {
    const binding = validBinding()
    delete binding[field]
    const result = validateDeploymentBinding(binding)
    assert.equal(result.accepted, false, `missing ${field} must be rejected`)
    assert(result.errors.some(error => error.code === 'MISSING_FIELD' && error.path === `$.${field}`))
  }

  {
    const binding = validBinding()
    binding.tier_binding.logical_tier = 'unknown'
    const result = validateDeploymentBinding(binding)
    assert.equal(result.accepted, false)
    assert(result.errors.some(error => error.path === '$.tier_binding.logical_tier'))
  }

  for (const revision of [0, -1, 1.5]) {
    const binding = validBinding()
    binding.binding_revision = revision
    const result = validateDeploymentBinding(binding)
    assert.equal(result.accepted, false, `invalid revision ${revision} must be rejected`)
  }

  for (const modelVersion of ['latest', 'LATEST', 'version-*', 'version with spaces']) {
    const binding = validBinding()
    binding.deployment.model_version = modelVersion
    const result = validateDeploymentBinding(binding)
    assert.equal(result.accepted, false, `floating model version ${modelVersion} must be rejected`)
  }

  {
    const binding = validBinding()
    binding.deployment.api_key = 'must-not-be-stored'
    const result = validateDeploymentBinding(binding)
    assert.equal(result.accepted, false)
    assert(result.errors.some(error => error.code === 'SECRET_FIELD'))
  }


  {
    const binding = validBinding()
    binding.unknown_policy = 'forbidden'
    const result = validateDeploymentBinding(binding)
    assert.equal(result.accepted, false)
    assert(result.errors.some(error => error.code === 'UNKNOWN_FIELD'))
  }

  {
    const binding = validBinding()
    binding.capabilities.supported_reasoning_levels = ['medium', 'medium']
    const result = validateDeploymentBinding(binding)
    assert.equal(result.accepted, false)
    assert(result.errors.some(error => error.code === 'DUPLICATE_VALUE'))
  }


  {
    const binding = approvedBinding()
    binding.governance.approval_record = 'https://github.com/whatrune/sd-prompt-studio/issues/115?token=secret'
    const result = validateDeploymentBinding(binding)
    assert.equal(result.accepted, false, 'secret-bearing canonical reference must be rejected')
  }

  {
    const binding = validBinding()
    binding.governance.lifecycle_status = 'created'
    const result = validateDeploymentBinding(binding)
    assert.equal(result.accepted, false)
    assert(result.errors.some(error => error.path === '$.governance.lifecycle_status'))
  }

  {
    const binding = validBinding()
    binding.capabilities.usable_input_limit_tokens = 90
    const result = validateDeploymentBinding(binding)
    assert.equal(result.accepted, false, 'context reservation overflow must be rejected')
    assert(result.errors.some(error => error.code === 'INCONSISTENT_VALUE'))
  }

  {
    const binding = validBinding()
    binding.compatibility.tool_profile_refs = ['tool-profile.example/v1']
    const result = validateDeploymentBinding(binding)
    assert.equal(result.accepted, false, 'capability and compatibility profile mismatch must be rejected')
  }

  {
    const binding = validBinding()
    binding.resolution.fallback_binding_refs = [{
      binding_id: binding.binding_id,
      binding_revision: binding.binding_revision,
    }]
    const result = validateDeploymentBinding(binding)
    assert.equal(result.accepted, false, 'direct fallback self-reference must be rejected')
    assert(result.errors.some(error => error.code === 'SELF_REFERENCE'))
  }

  {
    const approved = validateDeploymentBinding(validBinding())
    assert.equal(approved.accepted, true)

    const reused = validateDeploymentBindingRevisionCandidate(validBinding(), [approved.binding])
    assert.equal(reused.accepted, false)
    assert(reused.errors.some(error => error.code === 'REVISION_REUSED'))

    const next = validBinding()
    next.binding_revision = 2
    assert.equal(validateDeploymentBindingRevisionCandidate(next, [approved.binding]).accepted, true)

    const existingRevisionTwo = validateDeploymentBinding(next)
    assert.equal(existingRevisionTwo.accepted, true)
    const staleCandidate = validBinding()
    const staleResult = validateDeploymentBindingRevisionCandidate(staleCandidate, [existingRevisionTwo.binding])
    assert.equal(staleResult.accepted, false)
    assert(staleResult.errors.some(error => error.code === 'REVISION_NOT_INCREASING'))

    const skippedInitial = validBinding()
    skippedInitial.binding_id = 'deployment_binding.new-lineage'
    skippedInitial.binding_revision = 2
    const initialResult = validateDeploymentBindingRevisionCandidate(skippedInitial, [])
    assert.equal(initialResult.accepted, false)
    assert(initialResult.errors.some(error => error.code === 'INITIAL_REVISION_INVALID'))
  }

  {
    const approved = validBinding()
    approved.governance.lifecycle_status = 'approved'
    const result = validateDeploymentBinding(approved)
    assert.equal(result.accepted, false, 'approved lifecycle without approval metadata and evidence must be rejected')
    assert(result.errors.some(error => error.path === '$.governance.approval_record'))
  }

  console.log('Deployment Binding schema tests passed.')
} finally {
  await server.close()
}
