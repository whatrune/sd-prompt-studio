import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })

const validPlan = () => ({
  context_plan_contract_version: 'context_plan_v1',
  context_plan_ref: 'evidence/context-plans/task-001-v1',
  task_id: 'IMPLEMENT-CONTEXT-PLAN-CONTRACT-001',
  assignment_revision: 'assignments/context-plan-contract-v1',
  routing_contract_version: 'model_routing_v1',
  routing_decision_ref: 'evidence/routing-decisions/task-001-v1',
  context_policy_ref: 'policies/context/model-routing-v1',
  required_context_refs: [
    'docs/automation/19-context-planning-execution-context-assembly-architecture.md',
    'docs/team/11-delegation-and-result-contract.md',
  ],
  included_optional_context_refs: ['docs/automation/18-model-routing-response-architecture.md'],
  excluded_optional_context_refs: ['docs/automation/13-response-policy.md'],
  forbidden_context_categories: ['secrets', 'private_endpoint', 'personal_files'],
  context_order: [
    'docs/automation/19-context-planning-execution-context-assembly-architecture.md',
    'docs/automation/18-model-routing-response-architecture.md',
    'docs/team/11-delegation-and-result-contract.md',
  ],
  context_rendering_profile_ref: 'profiles/context-rendering/repository-v1',
  materialization_policy_ref: 'policies/materialization/repository-contained-v1',
  applied_rule_refs: ['policies/context/required-v1', 'policies/context/optional-v1', 'policies/context/order-v1'],
  planner_version: 'context-planner-v1',
  evaluation_timestamp: '2026-07-19T11:30:00Z',
})

const expectRejectedAt = (validate, plan, path, message) => {
  const result = validate(plan)
  assert.equal(result.accepted, false, message)
  assert(result.errors.some(error => error.path === path), `${message}: expected ${path}`)
  assert.equal(result.failure.status, 'blocked')
  assert(Object.isFrozen(result.failure), 'rejected validation must produce an immutable Failure')
  return result
}

try {
  const {
    validateContextPlan,
    validateContextPlanningFailure,
  } = await server.ssrLoadModule('/src/context-planning/index.ts')

  {
    const source = validPlan()
    const result = validateContextPlan(source)
    assert.equal(result.accepted, true, 'valid ContextPlan must be accepted')
    assert(Object.isFrozen(result.plan), 'accepted ContextPlan must be frozen')
    assert(Object.isFrozen(result.plan.required_context_refs), 'required Context array must be frozen')
    assert(Object.isFrozen(result.plan.context_order), 'context_order must be frozen')
    source.required_context_refs[0] = 'docs/changed-after-validation.md'
    assert.equal(result.plan.required_context_refs[0], 'docs/automation/19-context-planning-execution-context-assembly-architecture.md', 'accepted values must be cloned')
    assert.throws(() => result.plan.context_order.push('docs/forbidden.md'), TypeError)
  }

  {
    const plan = validPlan()
    delete plan.context_plan_ref
    const result = expectRejectedAt(validateContextPlan, plan, '$.context_plan_ref', 'missing required field must fail closed')
    assert.equal(result.failure.failure_code, 'missing_field')
  }

  {
    const plan = validPlan()
    plan.unexpected = true
    const result = expectRejectedAt(validateContextPlan, plan, '$.unexpected', 'unknown field must fail closed')
    assert.equal(result.failure.failure_code, 'unknown_field')
  }

  {
    const plan = validPlan()
    plan.required_context_refs.push(plan.required_context_refs[0])
    expectRejectedAt(validateContextPlan, plan, '$.required_context_refs[2]', 'duplicate required reference must fail closed')
  }

  {
    const plan = validPlan()
    plan.included_optional_context_refs.push(plan.required_context_refs[0])
    expectRejectedAt(validateContextPlan, plan, '$.included_optional_context_refs[1]', 'required and included Context must be disjoint')
  }

  {
    const plan = validPlan()
    plan.required_context_refs[0] = 'docs/security/secrets.md'
    plan.context_order[0] = 'docs/security/secrets.md'
    const result = expectRejectedAt(validateContextPlan, plan, '$.required_context_refs[0]', 'forbidden required Context must fail closed')
    assert.equal(result.failure.failure_code, 'forbidden_context')
    assert.equal(result.failure.failed_stage, 'security_validation')
  }

  {
    const plan = validPlan()
    plan.context_order.pop()
    expectRejectedAt(validateContextPlan, plan, '$.context_order', 'incomplete context_order must fail closed')
  }

  {
    const plan = validPlan()
    plan.context_order[0] = plan.excluded_optional_context_refs[0]
    expectRejectedAt(validateContextPlan, plan, '$.context_order[0]', 'excluded optional Context must not appear in context_order')
  }

  {
    const plan = validPlan()
    plan.context_order.push('docs/unplanned/context.md')
    expectRejectedAt(validateContextPlan, plan, '$.context_order[3]', 'unplanned Context must not appear in context_order')
  }

  {
    const plan = validPlan()
    plan.context_order.reverse()
    assert.equal(validateContextPlan(plan).accepted, true, 'any duplicate-free complete permutation must be accepted structurally')
  }

  {
    const planA = validPlan()
    const planB = structuredClone(planA)
    planB.required_context_refs.reverse()
    planB.forbidden_context_categories.reverse()
    assert.equal(validateContextPlan(planA).accepted, true)
    assert.equal(validateContextPlan(planB).accepted, true, 'set validation must not depend on input-array order')
    assert.deepEqual(validateContextPlan(planA), validateContextPlan(structuredClone(planA)), 'the same input must produce the same Validation Result')
  }

  {
    const plan = validPlan()
    plan.context_rendering_profile_ref = 'C:\\Users\\example\\private-profile.json'
    const result = expectRejectedAt(validateContextPlan, plan, '$.context_rendering_profile_ref', 'personal file references must fail closed')
    assert.equal(result.failure.failure_code, 'invalid_reference')
  }

  {
    const plan = validPlan()
    plan.routing_contract_version = 'model_routing_v2'
    const result = expectRejectedAt(validateContextPlan, plan, '$.routing_contract_version', 'routing identity mismatch must fail closed')
    assert.equal(result.failure.failure_code, 'inconsistent_identity')
  }

  {
    const plan = validPlan()
    plan.evaluation_timestamp = '2026-02-30T11:30:00Z'
    expectRejectedAt(validateContextPlan, plan, '$.evaluation_timestamp', 'impossible UTC timestamp must fail closed')
  }

  {
    const rejected = validateContextPlan({})
    assert.equal(rejected.accepted, false)
    assert.equal(validateContextPlanningFailure(rejected.failure).accepted, true, 'generated Failure must satisfy its closed Contract')
  }

  {
    const rejected = validateContextPlan({ credential: 'forbidden' })
    assert.equal(rejected.accepted, false, 'Secret-shaped fields must fail closed')
    assert(rejected.errors.some(error => error.path === '$.credential'))
  }

  console.log('Context Plan contract tests passed.')
} finally {
  await server.close()
}
