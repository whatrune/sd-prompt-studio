import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })

const validInput = ({
  role = 'Backend Implementer',
  complexity = 'medium',
  risk = 'none',
} = {}) => ({
  routing_contract_version: 'model_routing_v1',
  task_id: 'IMPLEMENT-MODEL-ROUTER-CORE-001',
  assignment_revision: 'assignments/model-router-core-v1',
  canonical_record: 'https://github.com/whatrune/sd-prompt-studio/issues/129',
  assigned_role: role,
  task_type: { value: 'implementation', source_ref: 'policies/task-taxonomy/v1' },
  complexity: { value: complexity, source_ref: 'policies/complexity/v1' },
  risk_level: { value: risk, source_ref: 'policies/risk/v1' },
  required_output_type: { value: 'code_change', source_ref: 'policies/output-type/v1' },
  structured_output_requirement: {
    mode: 'required',
    profile_refs: ['profiles/structured-output/result-v1', 'profiles/structured-output/validation-v1'],
  },
  context_requirement: {
    required_context_refs: [
      'docs/automation/18-model-routing-response-architecture.md',
      'docs/automation/12-model-routing-policy.md',
    ],
    optional_context_refs: [
      'docs/automation/13-response-policy.md',
      'docs/team/11-delegation-and-result-contract.md',
    ],
    forbidden_context_categories: ['unrelated_tasks', 'secrets'],
    source_ref: 'policies/context/model-routing-v1',
  },
  validation_requirement: 'policies/validation/model-routing-v1',
  latency_requirement: { value: 'standard', source_ref: 'policies/latency/v1' },
  security_requirement: {
    policy_refs: ['policies/security/repository-v1', 'policies/security/model-routing-v1'],
    source_ref: 'policies/security/requirements-v1',
  },
  routing_policy_ref: 'docs/automation/12-model-routing-policy.md',
  response_policy_ref: 'docs/automation/13-response-policy.md',
  evaluation_timestamp: '2026-07-19T09:30:00Z',
})

try {
  const { routeModel, validateRoutingDecision, validateRoutingFailure } = await server.ssrLoadModule('/src/model-routing/index.ts')

  {
    const result = routeModel(validInput({ role: 'Worker', complexity: 'low', risk: 'none' }))
    assert.equal(result.logical_tier, 'efficient', 'Role floor alone must select efficient')
    assert.equal(result.required_reasoning_level, 'low')
  }

  {
    const result = routeModel(validInput({ role: 'Worker', complexity: 'high', risk: 'none' }))
    assert.equal(result.logical_tier, 'advanced', 'Complexity floor must raise Tier')
    assert.equal(result.required_reasoning_level, 'high', 'Complexity floor must raise reasoning')
  }

  {
    const result = routeModel(validInput({ role: 'Worker', complexity: 'low', risk: 'security_boundary' }))
    assert.equal(result.logical_tier, 'advanced', 'Risk floor must raise Tier')
    assert.equal(result.required_reasoning_level, 'high', 'Risk floor must raise reasoning')
  }

  {
    const result = routeModel(validInput({ role: 'Backend Implementer', complexity: 'low', risk: 'none' }))
    assert.equal(result.logical_tier, 'general', 'maximum Role floor must be preserved')
    assert.equal(result.required_reasoning_level, 'medium')
  }

  {
    const result = routeModel(validInput({ role: 'Architect Team', complexity: 'low', risk: 'medium' }))
    assert.equal(result.logical_tier, 'advanced')
    assert.equal(result.required_reasoning_level, 'high', 'maximum reasoning floor must be preserved')
  }

  {
    const result = routeModel(validInput())
    assert.equal(result.response_profile_ref, 'docs/automation/13-response-policy.md#backend-implementer-profile')
    assert.equal(result.context_policy_ref, 'policies/context/model-routing-v1')
    assert.equal(result.capability_floor_ref, 'docs/automation/12-model-routing-policy.md#deterministic-route-resolution')
    assert.equal(result.latency_policy_ref, 'policies/latency/v1')
    assert.equal(result.cost_policy_ref, 'docs/automation/12-model-routing-policy.md#cost-optimization-policy')
    assert.deepEqual(result.required_tool_profile_refs, [])
    assert.equal(validateRoutingDecision(result).accepted, true, 'Router output must satisfy the frozen Decision Contract')
  }

  {
    const input = validInput()
    input.routing_policy_ref = 'policies/routing/unsupported-v1'
    const result = routeModel(input)
    assert.equal(result.status, 'blocked')
    assert.equal(result.failure_code, 'policy_conflict')
    assert.equal(result.path, '$.routing_policy_ref')
  }

  {
    const input = validInput()
    input.response_policy_ref = 'not a reference'
    const result = routeModel(input)
    assert.equal(result.status, 'blocked')
    assert.equal(result.failure_code, 'invalid_input', 'malformed policy references must fail at admission')
  }

  {
    const input = validInput()
    delete input.task_id
    const result = routeModel(input)
    assert.equal(result.status, 'blocked', 'missing input must fail closed')
    assert.equal(result.failure_code, 'invalid_input')
    assert.equal(validateRoutingFailure(result).accepted, true)
  }

  {
    const input = validInput()
    input.assigned_role = 'Backend Architect'
    const result = routeModel(input)
    assert.equal(result.status, 'blocked', 'unsupported Role must fail closed')
    assert.equal(result.path, '$.assigned_role')
  }

  {
    const input = validInput()
    input.complexity.value = 'extreme'
    const result = routeModel(input)
    assert.equal(result.status, 'blocked', 'invalid floor classification must fail closed')
    assert.equal(result.path, '$.complexity.value')
  }

  {
    const result = routeModel(validInput({ risk: 'unclassified' }))
    assert.equal(result.status, 'blocked', 'unsupported risk classification must fail closed')
    assert.equal(result.failure_code, 'unsupported_value')
    assert.equal(result.path, '$.risk_level.value')
  }

  {
    const result = routeModel(validInput({ risk: 'existing_run_or_research_artifact_impact' }))
    assert.equal(result.status, 'blocked', 'Existing Run impact must not be implicitly authorized')
    assert.equal(result.failure_code, 'authority_boundary')
  }

  {
    const explosive = new Proxy({}, { ownKeys: () => { throw new Error('synthetic internal failure') } })
    const result = routeModel(explosive)
    assert.equal(result.status, 'failed', 'unexpected processing defects must return failed')
    assert.equal(result.failure_code, 'internal_failure')
    assert.equal(validateRoutingFailure(result).accepted, true)
  }

  {
    const input = validInput()
    const first = routeModel(input)
    const second = routeModel(structuredClone(input))
    assert.deepEqual(first, second, 'identical RoutingInput must produce identical RoutingDecision')
  }

  {
    const inputA = validInput()
    const inputB = structuredClone(inputA)
    inputB.structured_output_requirement.profile_refs.reverse()
    inputB.context_requirement.required_context_refs.reverse()
    inputB.context_requirement.optional_context_refs.reverse()
    inputB.context_requirement.forbidden_context_categories.reverse()
    inputB.security_requirement.policy_refs.reverse()
    assert.deepEqual(routeModel(inputA), routeModel(inputB), 'input collection order must not affect the Decision')
  }

  {
    const input = validInput()
    input.provider_id = 'provider.example'
    const result = routeModel(input)
    assert.equal(result.status, 'blocked', 'unnecessary or downstream fields must be rejected')
    assert.equal(result.failure_code, 'invalid_input')
  }

  {
    const decision = routeModel(validInput())
    assert(Object.isFrozen(decision), 'RoutingDecision must be frozen')
    assert(Object.isFrozen(decision.required_context_refs), 'Decision nested collections must be frozen')
    assert(Object.isFrozen(decision.applied_rule_refs), 'applied rules must be frozen')
    assert.throws(() => decision.required_context_refs.push('docs/forbidden.md'), TypeError)
  }

  {
    const failure = routeModel(validInput({ risk: 'unclassified' }))
    assert(Object.isFrozen(failure), 'RoutingFailure must be frozen')
    assert.throws(() => { failure.message = 'changed' }, TypeError)
  }

  console.log('Model Router core tests passed.')
} finally {
  await server.close()
}
