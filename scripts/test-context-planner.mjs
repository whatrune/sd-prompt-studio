import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })

const policyRef = 'policies/context/planner-core-v1'
const routingDecisionRef = 'evidence/routing-decisions/context-planner-core-v1'
const requiredA = 'docs/context/required-a-v1.md'
const requiredB = 'docs/context/required-b-v1.md'
const optionalA = 'docs/context/optional-a-v1.md'
const optionalB = 'docs/context/optional-b-v1.md'
const unused = 'docs/context/unused-v1.md'
const renderingRef = 'profiles/context-rendering/repository-v1#approved'
const materializationRef = 'policies/materialization/repository-v1#approved'

const decision = (overrides = {}) => ({
  routing_contract_version: 'model_routing_v1',
  task_id: 'IMPLEMENT-CONTEXT-PLANNER-CORE-001',
  assignment_revision: 'assignments/context-planner/core-v1',
  logical_tier: 'general',
  required_reasoning_level: 'medium',
  capability_floor_ref: 'policies/routing/capability-floor-v1',
  response_profile_ref: 'profiles/response/backend-v1',
  context_policy_ref: policyRef,
  required_context_refs: [requiredB, requiredA],
  optional_context_refs: [optionalB, optionalA],
  forbidden_context_categories: ['secrets', 'credentials'],
  required_structured_output_profile_refs: [],
  required_tool_profile_refs: [],
  latency_policy_ref: 'policies/latency/standard-v1',
  cost_policy_ref: 'policies/cost/standard-v1',
  security_policy_refs: ['policies/security/repository-v1'],
  validation_policy_ref: 'policies/validation/context-plan-v1',
  applied_rule_refs: ['policies/routing/rules/context-planner-v1'],
  decision_rationale: 'The admitted route requires deterministic Context Planning.',
  evaluation_timestamp: '2026-07-20T09:00:00Z',
  ...overrides,
})

const optionalRule = (id, contextRef, action, priority, overrides = {}) => ({
  rule_contract_version: 'context_policy_rule_v1',
  rule_id: id,
  rule_revision: 'v1',
  rule_ref: `policies/context/rules/${id}-v1`,
  policy_ref: policyRef,
  match: { optional_context_ref: contextRef },
  action,
  priority,
  source_ref: `policies/context/sources/${id}-v1`,
  ...overrides,
})

const ordering = (overrides = {}) => ({
  rule_contract_version: 'context_ordering_rule_v1',
  rule_id: 'core-order',
  rule_revision: 'v1',
  rule_ref: 'policies/context/ordering/core-v1',
  policy_ref: policyRef,
  strategy: 'explicit_rank',
  rank_entries: [
    { context_ref: requiredA, rank: 30 },
    { context_ref: requiredB, rank: 10 },
    { context_ref: optionalA, rank: 20 },
    { context_ref: unused, rank: 40 },
  ],
  source_ref: 'policies/context/sources/core-order-v1',
  ...overrides,
})

const policy = (overrides = {}) => ({
  context_policy_contract_version: 'context_policy_v1',
  context_policy_ref: policyRef,
  policy_revision: 'v1',
  optional_context_rules: [
    optionalRule('optional-a-include', optionalA, 'include', 100),
    optionalRule('optional-a-lower', optionalA, 'exclude', 50),
    optionalRule('optional-b-exclude', optionalB, 'exclude', 100),
    optionalRule('unused', unused, 'include', 100),
  ],
  ordering_rule: ordering(),
  source_ref: 'docs/automation/20-context-planner-supporting-contracts-design.md',
  approval_ref: 'evidence/approvals/context-planner-core-policy-v1',
  ...overrides,
})

const input = (overrides = {}) => ({
  routing_decision: decision(),
  routing_decision_ref: routingDecisionRef,
  context_policy: policy(),
  context_rendering_profile_ref: renderingRef,
  materialization_policy_ref: materializationRef,
  planner_version: 'context-planner-core-v1',
  ...overrides,
})

const expectFailure = (result, code, stage, path) => {
  assert.equal(result.failure_code, code, `expected ${code}; got ${result.failure_code ?? 'ContextPlan'}`)
  assert.equal(result.status, code === 'internal_failure' ? 'failed' : 'blocked')
  assert.equal(result.failed_stage, stage)
  assert.equal(result.path, path)
  assert(Object.isFrozen(result), 'Failure must be deeply immutable')
}

try {
  const {
    planContext,
    validateContextPlan,
    validateContextPlanningFailureV1,
    verifyContextPlanRef,
  } = await server.ssrLoadModule('/src/context-planning/index.ts')

  {
    const source = input()
    const result = await planContext(source)
    assert.equal(result.context_plan_contract_version, 'context_plan_v1')
    assert.equal(validateContextPlan(result).accepted, true, 'Core output must satisfy the frozen ContextPlan contract')
    assert.equal((await verifyContextPlanRef(result)).accepted, true, 'Core output reference must verify')
    assert.deepEqual(result.required_context_refs, [requiredA, requiredB], 'Required Context must be preserved as a canonical set')
    assert.deepEqual(result.included_optional_context_refs, [optionalA])
    assert.deepEqual(result.excluded_optional_context_refs, [optionalB])
    assert.deepEqual(result.context_order, [requiredB, optionalA, requiredA], 'explicit ranks must define the complete order')
    assert.deepEqual(result.applied_rule_refs, [
      'policies/context/ordering/core-v1',
      'policies/context/rules/optional-a-include-v1',
      'policies/context/rules/optional-b-exclude-v1',
    ], 'only winning Optional rules and the Ordering rule must be retained as provenance')
    assert.equal(result.context_rendering_profile_ref, renderingRef, 'approved rendering ref must be copied byte-for-byte')
    assert.equal(result.materialization_policy_ref, materializationRef, 'approved materialization ref must be copied byte-for-byte')
    assert.equal(result.evaluation_timestamp, source.routing_decision.evaluation_timestamp)
    assert(Object.isFrozen(result))
    assert(Object.isFrozen(result.required_context_refs))
    assert(Object.isFrozen(result.context_order))
    source.routing_decision.required_context_refs[0] = 'docs/context/mutated-v1.md'
    source.context_policy.ordering_rule.rank_entries[0].rank = 999
    assert.deepEqual(result.required_context_refs, [requiredA, requiredB], 'accepted output must not retain caller aliases')
    assert.deepEqual(result.context_order, [requiredB, optionalA, requiredA])
  }

  {
    const first = await planContext(input())
    const permutedPolicy = policy({
      optional_context_rules: [...policy().optional_context_rules].reverse(),
      ordering_rule: ordering({ rank_entries: [...ordering().rank_entries].reverse() }),
    })
    const second = await planContext(input({
      routing_decision: decision({
        required_context_refs: [requiredA, requiredB],
        optional_context_refs: [optionalA, optionalB],
        forbidden_context_categories: ['credentials', 'secrets'],
      }),
      context_policy: permutedPolicy,
    }))
    assert.deepEqual(second, first, 'equivalent input array permutations must produce the same ContextPlan and ref')
  }

  {
    const utf8A = 'docs/context/é-v1.md'
    const utf8Z = 'docs/context/z-v1.md'
    const utf8Policy = policy({
      ordering_rule: ordering({
        rank_entries: [
          { context_ref: utf8A, rank: 20 },
          { context_ref: utf8Z, rank: 10 },
        ],
      }),
    })
    const result = await planContext(input({
      routing_decision: decision({ required_context_refs: [utf8A, utf8Z], optional_context_refs: [] }),
      context_policy: utf8Policy,
    }))
    assert.deepEqual(result.required_context_refs, [utf8Z, utf8A], 'canonical sets must use UTF-8 bytewise ordering')
    assert.deepEqual(result.context_order, [utf8Z, utf8A], 'rank order must remain independent from canonical set ordering')
  }

  {
    const missing = input()
    delete missing.context_rendering_profile_ref
    expectFailure(await planContext(missing), 'unsupported_context_reference', 'input_binding', '$.context_rendering_profile_ref')
    expectFailure(await planContext(input({ context_rendering_profile_ref: 'rendering-default' })), 'unsupported_context_reference', 'input_binding', '$.context_rendering_profile_ref')
    const missingMaterialization = input()
    delete missingMaterialization.materialization_policy_ref
    expectFailure(await planContext(missingMaterialization), 'unsupported_context_reference', 'input_binding', '$.materialization_policy_ref')
    expectFailure(await planContext(input({ materialization_policy_ref: 'C:\\private\\policy.json' })), 'unsupported_context_reference', 'input_binding', '$.materialization_policy_ref')
    expectFailure(await planContext(input({ routing_decision_ref: 'mutable-ref' })), 'unsupported_context_reference', 'input_binding', '$.routing_decision_ref')
  }

  {
    const missing = input()
    delete missing.context_policy
    expectFailure(await planContext(missing), 'missing_context_policy', 'policy_validation', '$.context_policy')
    expectFailure(
      await planContext(input({ context_policy: policy({ context_policy_ref: 'policies/context/other-v1' }) })),
      'incompatible_context_policy',
      'policy_validation',
      '$.context_policy_ref',
    )
    const noMatch = policy({ optional_context_rules: policy().optional_context_rules.filter(rule => rule.match.optional_context_ref !== optionalB) })
    expectFailure(await planContext(input({ context_policy: noMatch })), 'context_policy_no_match', 'optional_context_resolution', '$.optional_context_refs[1]')
    const conflict = policy({
      optional_context_rules: [
        ...policy().optional_context_rules,
        optionalRule('optional-a-tie', optionalA, 'exclude', 100),
      ],
    })
    expectFailure(await planContext(input({ context_policy: conflict })), 'context_policy_conflict', 'optional_context_resolution', '$.optional_context_refs[0]')
  }

  {
    const secretRequired = 'docs/context/secrets-required-v1.md'
    const secretRequiredPolicy = policy({
      ordering_rule: ordering({ rank_entries: [...ordering().rank_entries, { context_ref: secretRequired, rank: 50 }] }),
    })
    expectFailure(
      await planContext(input({ routing_decision: decision({ required_context_refs: [requiredA, secretRequired] }), context_policy: secretRequiredPolicy })),
      'forbidden_context',
      'input_binding',
      '$.routing_decision.required_context_refs[1]',
    )

    const secretOptional = 'docs/context/secrets-optional-v1.md'
    const secretOptionalPolicy = policy({
      optional_context_rules: [optionalRule('secret-include', secretOptional, 'include', 100)],
      ordering_rule: ordering({ rank_entries: [...ordering().rank_entries, { context_ref: secretOptional, rank: 50 }] }),
    })
    expectFailure(
      await planContext(input({ routing_decision: decision({ optional_context_refs: [secretOptional] }), context_policy: secretOptionalPolicy })),
      'forbidden_context',
      'optional_context_resolution',
      '$.included_optional_context_refs[0]',
    )
  }

  {
    const incompleteOrder = ordering({ rank_entries: ordering().rank_entries.filter(entry => entry.context_ref !== optionalA) })
    expectFailure(
      await planContext(input({ context_policy: policy({ ordering_rule: incompleteOrder }) })),
      'invalid_context_order',
      'order_generation',
      '$.planned_context_refs[0]',
    )
  }

  {
    let reads = 0
    const dynamic = input()
    Object.defineProperty(dynamic, 'context_rendering_profile_ref', {
      enumerable: true,
      get: () => (++reads === 1 ? renderingRef : 'invalid'),
    })
    expectFailure(await planContext(dynamic), 'result_validation_failed', 'result_validation', '$.context_rendering_profile_ref')
  }

  {
    const source = input()
    source.context_policy = new Proxy(source.context_policy, {
      get(target, property, receiver) {
        if (property === 'optional_context_rules') throw new Error('injected internal defect')
        return Reflect.get(target, property, receiver)
      },
    })
    const result = await planContext(source)
    expectFailure(result, 'internal_failure', 'internal_processing', '$')
    assert.equal(validateContextPlanningFailureV1(result).accepted, true, 'unexpected defects must use the closed failed/internal_failure mapping')
  }

  {
    const unknown = input({ extra_input: 'forbidden' })
    expectFailure(await planContext(unknown), 'inconsistent_identity', 'input_binding', '$.extra_input')
    const malformed = input({ routing_decision: decision({ routing_contract_version: 'model_routing_v2' }) })
    const result = await planContext(malformed)
    assert.equal(result.failure_code, 'inconsistent_identity')
    assert.equal(result.status, 'blocked')
  }

  console.log('Context Planner Core tests passed.')
} finally {
  await server.close()
}
