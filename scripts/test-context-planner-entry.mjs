import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })

const requiredA = 'docs/context/required-a-v1.md'
const requiredB = 'docs/context/required-b-v1.md'
const optionalA = 'docs/context/optional-a-v1.md'
const optionalB = 'docs/context/optional-b-v1.md'
const unused = 'docs/context/unused-v1.md'
const routingDecisionRef = 'evidence/routing-decisions/context-planner-entry-v1'
const renderingRef = 'profiles/context-rendering/repository-v1'
const materializationRef = 'policies/materialization/repository-v1'
const placeholderSnapshotRef = `evidence/context-category-bindings/sha256-${'0'.repeat(64)}`
const placeholderPolicyRef = `policies/context/sha256-${'0'.repeat(64)}`

const snapshotCandidate = (overrides = {}) => ({
  category_binding_contract_version: 'context_category_binding_v1',
  category_binding_snapshot_ref: placeholderSnapshotRef,
  category_catalog_ref: 'policies/context/categories/catalog-v1',
  approved_category_values: ['public', 'restricted', 'secrets'],
  bindings: [
    { context_ref: requiredA, categories: ['public'] },
    { context_ref: requiredB, categories: ['public'] },
    { context_ref: optionalA, categories: ['public'] },
    { context_ref: optionalB, categories: ['restricted'] },
    { context_ref: unused, categories: ['public'] },
  ],
  source_ref: 'docs/automation/21-context-planner-entry-admission-and-category-binding-design.md',
  approval_ref: 'evidence/approvals/context-planner-entry-bindings-v1',
  ...overrides,
})

const optionalRule = (id, contextRef, action, priority) => ({
  rule_contract_version: 'context_policy_rule_v1',
  rule_id: id,
  rule_revision: 'v1',
  rule_ref: `policies/context/rules/${id}-v1`,
  policy_ref: placeholderPolicyRef,
  match: { optional_context_ref: contextRef },
  action,
  priority,
  source_ref: `policies/context/sources/${id}-v1`,
})

const orderingRule = (overrides = {}) => ({
  rule_contract_version: 'context_ordering_rule_v1',
  rule_id: 'entry-order',
  rule_revision: 'v1',
  rule_ref: 'policies/context/ordering/entry-v1',
  policy_ref: placeholderPolicyRef,
  strategy: 'explicit_rank',
  rank_entries: [
    { context_ref: requiredA, rank: 30 },
    { context_ref: requiredB, rank: 10 },
    { context_ref: optionalA, rank: 20 },
    { context_ref: unused, rank: 40 },
  ],
  source_ref: 'policies/context/sources/entry-order-v1',
  ...overrides,
})

const policyCandidate = (snapshotRef, overrides = {}) => ({
  context_policy_contract_version: 'context_policy_v2',
  context_policy_ref: placeholderPolicyRef,
  policy_revision: 'v2',
  category_binding_snapshot_ref: snapshotRef,
  optional_context_rules: [
    optionalRule('optional-a-include', optionalA, 'include', 100),
    optionalRule('optional-a-lower', optionalA, 'exclude', 50),
    optionalRule('optional-b-exclude', optionalB, 'exclude', 100),
    optionalRule('unused', unused, 'include', 100),
  ],
  ordering_rule: orderingRule(),
  source_ref: 'docs/automation/21-context-planner-entry-admission-and-category-binding-design.md',
  approval_ref: 'evidence/approvals/context-planner-entry-policy-v2',
  ...overrides,
})

const routingDecision = (policyRef, overrides = {}) => ({
  routing_contract_version: 'model_routing_v1',
  task_id: 'INTEGRATE-CONTEXT-PLANNER-ENTRY-001',
  assignment_revision: 'assignments/context-planner/entry-integration-v1',
  logical_tier: 'general',
  required_reasoning_level: 'medium',
  capability_floor_ref: 'policies/routing/capability-floor-v1',
  response_profile_ref: 'profiles/response/backend-v1',
  context_policy_ref: policyRef,
  required_context_refs: [requiredB, requiredA],
  optional_context_refs: [optionalB, optionalA],
  forbidden_context_categories: ['secrets'],
  required_structured_output_profile_refs: [],
  required_tool_profile_refs: [],
  latency_policy_ref: 'policies/latency/standard-v1',
  cost_policy_ref: 'policies/cost/standard-v1',
  security_policy_refs: ['policies/security/repository-v1'],
  validation_policy_ref: 'policies/validation/context-plan-v1',
  applied_rule_refs: ['policies/routing/rules/context-planner-entry-v1'],
  decision_rationale: 'The admitted route requires deterministic Context Planning.',
  evaluation_timestamp: '2026-07-20T09:00:00Z',
  ...overrides,
})

const expectStructural = (result, code, path) => {
  assert.equal(result.accepted, false)
  assert(result.errors.some(error => error.code === code && error.path === path), `${code} at ${path} not found`)
  assert.deepEqual(Object.keys(result).sort(), ['accepted', 'errors'])
  assert.equal('status' in result, false)
  assert.equal('failure_code' in result, false)
  assert.equal('context_planning_failure_contract_version' in result, false)
  assert(Object.isFrozen(result))
  assert(Object.isFrozen(result.errors))
}

const expectOperational = (result, code, stage) => {
  assert.equal(result.context_planning_failure_contract_version, 'context_planning_failure_v1')
  assert.equal(result.failure_code, code)
  assert.equal(result.failed_stage, stage)
  assert(Object.isFrozen(result))
}

try {
  const api = await server.ssrLoadModule('/src/context-planning/index.ts')
  const { createPlanContextEntryFacade } = await server.ssrLoadModule('/src/context-planning/entry.ts')
  const {
    admitContextPlannerEntry,
    generateContextCategoryBindingSnapshotRef,
    generateContextPolicyV2Ref,
    planContext,
    planContextEntry,
    validateContextPlanStructure,
    validateContextPlanningFailureV1,
  } = api

  const bindSnapshot = async candidate => ({
    ...candidate,
    category_binding_snapshot_ref: await generateContextCategoryBindingSnapshotRef(candidate),
  })
  const bindPolicy = async candidate => {
    const contextPolicyRef = await generateContextPolicyV2Ref(candidate)
    return {
      ...candidate,
      context_policy_ref: contextPolicyRef,
      optional_context_rules: candidate.optional_context_rules.map(rule => ({ ...rule, policy_ref: contextPolicyRef })),
      ordering_rule: { ...candidate.ordering_rule, policy_ref: contextPolicyRef },
    }
  }
  const buildCaller = async ({ snapshotOverrides = {}, policyOverrides = {}, decisionOverrides = {}, inputOverrides = {} } = {}) => {
    const snapshot = await bindSnapshot(snapshotCandidate(snapshotOverrides))
    const policy = await bindPolicy(policyCandidate(snapshot.category_binding_snapshot_ref, policyOverrides))
    return {
      caller: {
        entry_admission_contract_version: 'context_planner_entry_admission_v1',
        routing_decision: routingDecision(policy.context_policy_ref, decisionOverrides),
        routing_decision_ref: routingDecisionRef,
        context_policy: policy,
        context_category_binding: snapshot,
        context_rendering_profile_ref: renderingRef,
        materialization_policy_ref: materializationRef,
        planner_version: 'context-planner-core-v1',
        ...inputOverrides,
      },
      snapshot,
      policy,
    }
  }

  {
    expectStructural(await planContextEntry(null), 'invalid_type', '$')
    const malformed = (await buildCaller()).caller
    malformed.routing_decision.routing_contract_version = 'model_routing_v2'
    const admissionResult = await admitContextPlannerEntry(malformed)
    const facadeResult = await planContextEntry(malformed)
    expectStructural(facadeResult, 'unsupported_contract', '$.routing_decision.routing_contract_version')
    assert.deepEqual(facadeResult, admissionResult, 'facade must not duplicate, reinterpret, or alter Admission diagnostics')
  }

  const baseline = await buildCaller()
  const baselineAdmission = await admitContextPlannerEntry(baseline.caller)
  assert.equal(baselineAdmission.accepted, true)

  {
    const expected = await planContext(baselineAdmission.core_input)
    const result = await planContextEntry(baseline.caller)
    assert.equal(result.context_plan_contract_version, 'context_plan_v1')
    assert.equal(validateContextPlanStructure(result).accepted, true)
    assert.deepEqual(result, expected, 'facade must return the exact immutable Operational value without remapping')
    assert(Object.isFrozen(result))
    assert(Object.isFrozen(result.required_context_refs))
  }

  {
    const noMatch = await buildCaller({
      policyOverrides: {
        optional_context_rules: policyCandidate(placeholderSnapshotRef).optional_context_rules
          .filter(rule => rule.match.optional_context_ref !== optionalB),
      },
    })
    const result = await planContextEntry(noMatch.caller)
    expectOperational(result, 'context_policy_no_match', 'optional_context_resolution')
    assert.equal(result.context_policy_ref, noMatch.caller.routing_decision.context_policy_ref)
    assert.equal(validateContextPlanningFailureV1(result).accepted, true)
  }

  {
    const forbidden = await buildCaller({
      snapshotOverrides: {
        bindings: snapshotCandidate().bindings.map(binding => binding.context_ref === requiredB
          ? { ...binding, categories: ['secrets'] }
          : binding),
      },
    })
    const result = await planContextEntry(forbidden.caller)
    expectOperational(result, 'forbidden_context', 'input_binding')
    assert.equal(result.context_policy_ref, forbidden.caller.routing_decision.context_policy_ref)
  }

  {
    const invalidOrder = await buildCaller({
      policyOverrides: {
        ordering_rule: orderingRule({
          rank_entries: orderingRule().rank_entries.filter(entry => entry.context_ref !== optionalA),
        }),
      },
    })
    expectOperational(await planContextEntry(invalidOrder.caller), 'invalid_context_order', 'order_generation')
  }

  {
    const caller = structuredClone(baseline.caller)
    const promise = planContextEntry(caller)
    caller.routing_decision.required_context_refs[0] = 'docs/context/mutated-v1.md'
    caller.context_policy.ordering_rule.rank_entries[0].rank = 999
    caller.context_category_binding.bindings[0].categories[0] = 'secrets'
    const result = await promise
    assert.equal(result.context_plan_contract_version, 'context_plan_v1')
    assert.deepEqual(result.required_context_refs, [requiredA, requiredB], 'caller mutation after invocation must not affect admitted output')
    assert.deepEqual(result.context_order, [requiredB, optionalA, requiredA])
  }

  {
    const rawMessage = 'raw-pre-admission-defect'
    const explosive = new Proxy({}, {
      ownKeys() {
        throw new Error(rawMessage)
      },
    })
    const result = await planContextEntry(explosive)
    expectStructural(result, 'admission_internal_failure', '$')
    assert(!JSON.stringify(result).includes(rawMessage))
  }

  {
    const rawMessage = 'raw-delegation-defect-reaching-facade'
    let operationalCalls = 0
    const faultInjectedFacade = createPlanContextEntryFacade(async coreInput => {
      operationalCalls += 1
      assert.deepEqual(coreInput, baselineAdmission.core_input, 'Admission must succeed and supply its exact frozen Core input before delegation')
      assert(Object.isFrozen(coreInput))
      throw new Error(rawMessage)
    })
    const result = await faultInjectedFacade(baseline.caller)
    assert.equal(operationalCalls, 1, 'fault-injected delegation must throw exactly once without recovery recursion')
    expectOperational(result, 'internal_failure', 'internal_processing')
    assert.equal(result.status, 'failed')
    assert.equal(result.task_id, baselineAdmission.core_input.routing_decision.task_id)
    assert.equal(result.assignment_revision, baselineAdmission.core_input.routing_decision.assignment_revision)
    assert.equal(result.routing_contract_version, baselineAdmission.core_input.routing_decision.routing_contract_version)
    assert.equal(result.routing_decision_ref, baselineAdmission.core_input.routing_decision_ref)
    assert.equal(result.context_policy_ref, baselineAdmission.core_input.routing_decision.context_policy_ref)
    assert.equal(result.planner_version, baselineAdmission.core_input.planner_version)
    assert.equal(result.evaluation_timestamp, baselineAdmission.core_input.routing_decision.evaluation_timestamp)
    assert.equal(validateContextPlanningFailureV1(result).accepted, true)
    assert.equal('accepted' in result, false, 'post-Admission recovery must not return Structural Rejection')
    assert(!JSON.stringify(result).includes(rawMessage))
    assert(!JSON.stringify(result).includes('unknown-task'))
    assert(!JSON.stringify(result).includes('1970-01-01'))
  }

  {
    const entrySource = await readFile(new URL('../src/context-planning/entry.ts', import.meta.url), 'utf8')
    assert.match(entrySource, /if \(!admission\.accepted\) return admission[\s\S]*operationalDelegate\(admission\.core_input\)/, 'Core must only run after accepted Admission')
    assert(!/validateContext|validateRouting|generateContextPlan/.test(entrySource), 'facade must not duplicate structural or planning logic')
    assert(!/Date\.|Math\.random|process\.env|localeCompare|fetch\(|readFile|https?:\/\//.test(entrySource), 'facade must have no external or runtime-state dependency')
    assert.equal('createPlanContextEntryFacade' in api, false, 'the closed fault-injection seam must not expand the public barrel API')
  }

  console.log('Context Planner Entry facade tests passed.')
} finally {
  await server.close()
}
