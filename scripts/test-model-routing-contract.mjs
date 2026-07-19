import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })

const validInput = () => ({
  routing_contract_version: 'model_routing_v1',
  task_id: 'IMPLEMENT-MODEL-ROUTING-CONTRACT-001',
  assignment_revision: 'assignments/model-routing-contract-v1',
  canonical_record: 'https://github.com/whatrune/sd-prompt-studio/issues/127',
  assigned_role: 'Backend Implementer',
  task_type: { value: 'contract_implementation', source_ref: 'policies/task-taxonomy/v1' },
  complexity: { value: 'medium', source_ref: 'policies/complexity/v1' },
  risk_level: { value: 'contract_boundary', source_ref: 'policies/risk/v1' },
  required_output_type: { value: 'code_change', source_ref: 'policies/output-type/v1' },
  structured_output_requirement: { mode: 'required', profile_refs: ['profiles/structured-output/v1'] },
  context_requirement: {
    required_context_refs: ['docs/automation/18-model-routing-response-architecture.md'],
    optional_context_refs: ['docs/automation/12-model-routing-policy.md'],
    forbidden_context_categories: ['secrets', 'unrelated_tasks'],
    source_ref: 'policies/context/model-routing-v1',
  },
  validation_requirement: 'policies/validation/model-routing-v1',
  latency_requirement: { value: 'standard', source_ref: 'policies/latency/v1' },
  security_requirement: {
    policy_refs: ['policies/security/model-routing-v1'],
    source_ref: 'policies/security/requirements-v1',
  },
  routing_policy_ref: 'docs/automation/12-model-routing-policy.md',
  response_policy_ref: 'docs/automation/13-response-policy.md',
  evaluation_timestamp: '2026-07-19T09:00:00Z',
})

const validDecision = () => ({
  routing_contract_version: 'model_routing_v1',
  task_id: 'IMPLEMENT-MODEL-ROUTING-CONTRACT-001',
  assignment_revision: 'assignments/model-routing-contract-v1',
  logical_tier: 'general',
  required_reasoning_level: 'medium',
  capability_floor_ref: 'policies/capability-floor/general-v1',
  response_profile_ref: 'profiles/response/backend-implementer-v1',
  context_policy_ref: 'policies/context/model-routing-v1',
  required_context_refs: ['docs/automation/18-model-routing-response-architecture.md'],
  optional_context_refs: ['docs/automation/12-model-routing-policy.md'],
  forbidden_context_categories: ['secrets'],
  required_structured_output_profile_refs: ['profiles/structured-output/v1'],
  required_tool_profile_refs: [],
  latency_policy_ref: 'policies/latency/standard-v1',
  cost_policy_ref: 'policies/cost/capability-floor-v1',
  security_policy_refs: ['policies/security/model-routing-v1'],
  validation_policy_ref: 'policies/validation/model-routing-v1',
  applied_rule_refs: ['policies/routing/role-floor-v1', 'policies/routing/complexity-floor-v1'],
  decision_rationale: 'Backend Implementer and medium complexity floors require general tier and medium reasoning.',
  evaluation_timestamp: '2026-07-19T09:00:00Z',
})

const validFailure = () => ({
  routing_contract_version: 'model_routing_v1',
  task_id: 'IMPLEMENT-MODEL-ROUTING-CONTRACT-001',
  assignment_revision: 'assignments/model-routing-contract-v1',
  status: 'blocked',
  failure_code: 'unsupported_value',
  failed_stage: 'role_binding',
  path: '$.assigned_role',
  message: 'The assigned Role is not supported by the routing contract.',
  affected_ref: 'https://github.com/whatrune/sd-prompt-studio/issues/127',
  decision_owner: 'Integrated Lead',
  recommended_next_action: 'Route a new Assignment to an exact supported Role.',
  evaluation_timestamp: '2026-07-19T09:00:00Z',
})

try {
  const {
    validateRoutingDecision,
    validateRoutingFailure,
    validateRoutingInput,
  } = await server.ssrLoadModule('/src/model-routing/index.ts')

  {
    const source = validInput()
    const result = validateRoutingInput(source)
    assert.equal(result.accepted, true, 'valid RoutingInput must be accepted')
    assert(Object.isFrozen(result.input), 'accepted RoutingInput must be frozen')
    assert(Object.isFrozen(result.input.context_requirement.required_context_refs), 'nested arrays must be frozen')
    source.context_requirement.required_context_refs[0] = 'docs/changed-after-validation.md'
    assert.equal(result.input.context_requirement.required_context_refs[0], 'docs/automation/18-model-routing-response-architecture.md', 'accepted input must be cloned')
    assert.throws(() => result.input.security_requirement.policy_refs.push('policies/security/other-v1'), TypeError)
  }

  {
    const input = validInput()
    input.assigned_role = 'Backend Architect'
    const result = validateRoutingInput(input)
    assert.equal(result.accepted, false, 'unsupported Role aliases must fail closed')
    assert(result.errors.some(error => error.path === '$.assigned_role'))
  }

  {
    const input = validInput()
    delete input.task_id
    const result = validateRoutingInput(input)
    assert.equal(result.accepted, false, 'missing required fields must fail closed')
    assert(result.errors.some(error => error.code === 'MISSING_FIELD' && error.path === '$.task_id'))
  }

  {
    const input = validInput()
    input.complexity.value = 'extreme'
    assert.equal(validateRoutingInput(input).accepted, false, 'unsupported enum values must fail closed')
  }

  {
    const input = validInput()
    input.credential = 'forbidden'
    const result = validateRoutingInput(input)
    assert.equal(result.accepted, false, 'secret-bearing or unknown fields must fail closed')
    assert(result.errors.some(error => error.code === 'SECRET_FIELD'))
  }

  {
    const input = validInput()
    input.evaluation_timestamp = '2026-02-30T09:00:00Z'
    assert.equal(validateRoutingInput(input).accepted, false, 'impossible calendar timestamps must fail closed')
  }

  {
    const input = validInput()
    input.structured_output_requirement = { mode: 'none', profile_refs: ['profiles/structured-output/v1'] }
    assert.equal(validateRoutingInput(input).accepted, false, 'explicit none must reject profile references')
  }

  {
    const result = validateRoutingDecision(validDecision())
    assert.equal(result.accepted, true, 'valid RoutingDecision must be accepted')
    assert(Object.isFrozen(result.decision), 'accepted RoutingDecision must be frozen')
    assert(Object.isFrozen(result.decision.applied_rule_refs), 'decision collections must be frozen')
  }

  {
    const decision = validDecision()
    decision.logical_tier = 'premium'
    assert.equal(validateRoutingDecision(decision).accepted, false, 'unsupported logical tier must be rejected')
  }

  {
    const decision = validDecision()
    decision.required_context_refs = []
    assert.equal(validateRoutingDecision(decision).accepted, false, 'a Decision without required context must be rejected')
  }

  {
    const decision = validDecision()
    decision.applied_rule_refs.push(decision.applied_rule_refs[0])
    const result = validateRoutingDecision(decision)
    assert.equal(result.accepted, false, 'duplicate rule evidence must be rejected')
    assert(result.errors.some(error => error.code === 'DUPLICATE_VALUE'))
  }

  {
    const result = validateRoutingFailure(validFailure())
    assert.equal(result.accepted, true, 'valid RoutingFailure must be accepted')
    assert(Object.isFrozen(result.failure), 'accepted RoutingFailure must be frozen')
  }

  {
    const failure = validFailure()
    failure.status = 'failed'
    const result = validateRoutingFailure(failure)
    assert.equal(result.accepted, false, 'failed status must be restricted to internal_failure')
    assert(result.errors.some(error => error.path === '$.failure_code'))
  }

  {
    const failure = validFailure()
    failure.provider_id = 'provider.example'
    assert.equal(validateRoutingFailure(failure).accepted, false, 'RoutingFailure must remain a closed contract')
  }

  console.log('Model Routing contract tests passed.')
} finally {
  await server.close()
}
