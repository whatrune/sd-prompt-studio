import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })

const contextA = 'docs/context/alpha-v1.md'
const contextB = 'docs/context/beta-v1.md'
const placeholderSnapshotRef = `evidence/context-category-bindings/sha256-${'0'.repeat(64)}`
const placeholderPolicyRef = `policies/context/sha256-${'0'.repeat(64)}`

const snapshotCandidate = (overrides = {}) => ({
  category_binding_contract_version: 'context_category_binding_v1',
  category_binding_snapshot_ref: placeholderSnapshotRef,
  category_catalog_ref: 'policies/context/categories/catalog-v1',
  approved_category_values: ['public', 'restricted'],
  bindings: [
    { context_ref: contextA, categories: ['public'] },
    { context_ref: contextB, categories: ['restricted'] },
  ],
  source_ref: 'docs/automation/21-context-planner-entry-admission-and-category-binding-design.md',
  approval_ref: 'evidence/approvals/context-category-bindings-v1',
  ...overrides,
})

const optionalRule = (id, contextRef, action) => ({
  rule_contract_version: 'context_policy_rule_v1',
  rule_id: id,
  rule_revision: 'v1',
  rule_ref: `policies/context/rules/${id}-v1`,
  policy_ref: placeholderPolicyRef,
  match: { optional_context_ref: contextRef },
  action,
  priority: 100,
  source_ref: `policies/context/sources/${id}-v1`,
})

const orderingRule = () => ({
  rule_contract_version: 'context_ordering_rule_v1',
  rule_id: 'context-order',
  rule_revision: 'v1',
  rule_ref: 'policies/context/ordering/context-order-v1',
  policy_ref: placeholderPolicyRef,
  strategy: 'explicit_rank',
  rank_entries: [
    { context_ref: contextA, rank: 10 },
    { context_ref: contextB, rank: 20 },
  ],
  source_ref: 'policies/context/sources/context-order-v1',
})

const policyCandidate = (snapshotRef, overrides = {}) => ({
  context_policy_contract_version: 'context_policy_v2',
  context_policy_ref: placeholderPolicyRef,
  policy_revision: 'v2',
  category_binding_snapshot_ref: snapshotRef,
  optional_context_rules: [optionalRule('beta-rule', contextB, 'exclude')],
  ordering_rule: orderingRule(),
  source_ref: 'docs/automation/21-context-planner-entry-admission-and-category-binding-design.md',
  approval_ref: 'evidence/approvals/context-policy-v2',
  ...overrides,
})

const routingDecision = (contextPolicyRef, overrides = {}) => ({
  routing_contract_version: 'model_routing_v1',
  task_id: 'IMPLEMENT-CONTEXT-PLANNER-ENTRY-ADMISSION-001',
  assignment_revision: 'assignments/context-planner/entry-admission-v1',
  logical_tier: 'general',
  required_reasoning_level: 'medium',
  capability_floor_ref: 'policies/routing/capability-floor-v1',
  response_profile_ref: 'profiles/response/backend-v1',
  context_policy_ref: contextPolicyRef,
  required_context_refs: [contextA],
  optional_context_refs: [contextB],
  forbidden_context_categories: ['restricted'],
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

const expectRejected = (result, code, path, message) => {
  assert.equal(result.accepted, false, message)
  assert.deepEqual(Object.keys(result).sort(), ['accepted', 'errors'], `${message}: rejection shape must remain closed`)
  assert(result.errors.length > 0, `${message}: rejection errors must be non-empty`)
  const matched = result.errors.find(error => error.code === code && error.path === path)
  assert(matched, `${message}: expected ${code} at ${path}; got ${result.errors.map(error => `${error.code}:${error.path}`).join(', ')}`)
  assert.deepEqual(Object.keys(matched).sort(), ['code', 'message', 'path'], `${message}: structural error shape must remain closed`)
  assert(Object.isFrozen(result))
  assert(Object.isFrozen(result.errors))
  assert(Object.isFrozen(matched))
  assert.equal('status' in result, false)
  assert.equal('failure_code' in result, false)
  assert.equal('context_planning_failure_contract_version' in result, false)
}

try {
  const api = await server.ssrLoadModule('/src/context-planning/index.ts')
  const {
    PLANNER_ENTRY_STRUCTURAL_ERROR_CODES,
    admitContextPlannerEntry,
    generateContextCategoryBindingSnapshotRef,
    generateContextPolicyV2Ref,
  } = api

  assert.deepEqual(PLANNER_ENTRY_STRUCTURAL_ERROR_CODES, [
    'invalid_type',
    'missing_field',
    'unknown_field',
    'invalid_value',
    'invalid_reference',
    'invalid_timestamp',
    'unsupported_contract',
    'duplicate_binding',
    'invalid_category',
    'reference_mismatch',
    'admission_internal_failure',
  ], 'Structural error vocabulary must remain closed')
  assert(Object.isFrozen(PLANNER_ENTRY_STRUCTURAL_ERROR_CODES))

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

  const snapshot = await bindSnapshot(snapshotCandidate())
  const policy = await bindPolicy(policyCandidate(snapshot.category_binding_snapshot_ref))
  const validInput = (overrides = {}) => ({
    entry_admission_contract_version: 'context_planner_entry_admission_v1',
    routing_decision: routingDecision(policy.context_policy_ref),
    routing_decision_ref: 'evidence/routing-decisions/context-planner-entry-v1',
    context_policy: structuredClone(policy),
    context_category_binding: structuredClone(snapshot),
    context_rendering_profile_ref: 'profiles/context-rendering/repository-v1',
    materialization_policy_ref: 'policies/materialization/repository-v1',
    planner_version: 'context-planner-core-v1',
    ...overrides,
  })

  {
    expectRejected(await admitContextPlannerEntry(null), 'invalid_type', '$', 'non-object input must be rejected without FailureV1')
    expectRejected(await admitContextPlannerEntry([]), 'invalid_type', '$', 'array input must be rejected without FailureV1')
  }

  {
    const fields = [
      'routing_decision',
      'routing_decision_ref',
      'context_policy',
      'context_category_binding',
      'context_rendering_profile_ref',
      'materialization_policy_ref',
      'planner_version',
    ]
    for (const field of fields) {
      const candidate = validInput()
      delete candidate[field]
      expectRejected(await admitContextPlannerEntry(candidate), 'missing_field', `$.${field}`, `missing ${field} must be rejected`)
    }
    const missingVersionGate = validInput()
    delete missingVersionGate.entry_admission_contract_version
    expectRejected(await admitContextPlannerEntry(missingVersionGate), 'missing_field', '$.entry_admission_contract_version', 'missing Admission contract version must be rejected')
  }

  {
    expectRejected(await admitContextPlannerEntry({ ...validInput(), extra: true }), 'unknown_field', '$.extra', 'unknown root field must be rejected')
    expectRejected(await admitContextPlannerEntry(validInput({
      routing_decision: { ...routingDecision(policy.context_policy_ref), extra: true },
    })), 'unknown_field', '$.routing_decision.extra', 'unknown Routing Decision field must be rejected')
    expectRejected(await admitContextPlannerEntry(validInput({
      context_policy: { ...policy, extra: true },
    })), 'unknown_field', '$.context_policy.extra', 'unknown Policy field must be rejected')
    expectRejected(await admitContextPlannerEntry(validInput({
      context_category_binding: { ...snapshot, extra: true },
    })), 'unknown_field', '$.context_category_binding.extra', 'unknown Category Snapshot field must be rejected')
  }

  {
    expectRejected(await admitContextPlannerEntry(validInput({
      entry_admission_contract_version: 'context_planner_entry_admission_v2',
    })), 'unsupported_contract', '$.entry_admission_contract_version', 'unsupported Admission contract must be rejected')
    expectRejected(await admitContextPlannerEntry(validInput({ planner_version: 'context-planner-v2' })), 'invalid_value', '$.planner_version', 'unsupported Planner version must be rejected')
  }

  {
    const malformedTimestamp = validInput({
      routing_decision: routingDecision(policy.context_policy_ref, { evaluation_timestamp: '2026-02-30T00:00:00Z' }),
    })
    await assert.doesNotReject(() => admitContextPlannerEntry(malformedTimestamp), 'malformed timestamp must resolve to Structural Rejection')
    expectRejected(await admitContextPlannerEntry(malformedTimestamp), 'invalid_timestamp', '$.routing_decision.evaluation_timestamp', 'strict malformed timestamp must be rejected')
    expectRejected(await admitContextPlannerEntry(validInput({
      routing_decision: routingDecision(policy.context_policy_ref, { routing_contract_version: 'model_routing_v2' }),
    })), 'unsupported_contract', '$.routing_decision.routing_contract_version', 'malformed Routing Decision must be rejected')
  }

  {
    for (const [field, invalid] of [
      ['routing_decision_ref', 'mutable-reference'],
      ['context_rendering_profile_ref', 'C:\\private\\rendering.json'],
      ['materialization_policy_ref', 'https://localhost/policy'],
    ]) {
      expectRejected(await admitContextPlannerEntry(validInput({ [field]: invalid })), 'invalid_reference', `$.${field}`, `malformed ${field} must be rejected`)
    }
  }

  {
    expectRejected(await admitContextPlannerEntry(validInput({
      context_policy: { ...policy, context_policy_contract_version: 'context_policy_v1' },
    })), 'unsupported_contract', '$.context_policy.context_policy_contract_version', 'v1 Policy must not be silently upgraded')

    const mismatchedPolicy = {
      ...policy,
      context_policy_ref: placeholderPolicyRef,
      optional_context_rules: policy.optional_context_rules.map(rule => ({ ...rule, policy_ref: placeholderPolicyRef })),
      ordering_rule: { ...policy.ordering_rule, policy_ref: placeholderPolicyRef },
    }
    expectRejected(await admitContextPlannerEntry(validInput({ context_policy: mismatchedPolicy })), 'reference_mismatch', '$.context_policy.context_policy_ref', 'mismatched Policy v2 content reference must be rejected')

    expectRejected(await admitContextPlannerEntry(validInput({
      context_category_binding: { ...snapshot, category_binding_contract_version: 'context_category_binding_v2' },
    })), 'unsupported_contract', '$.context_category_binding.category_binding_contract_version', 'malformed Category Snapshot must be rejected')
    expectRejected(await admitContextPlannerEntry(validInput({
      context_category_binding: { ...snapshot, category_binding_snapshot_ref: placeholderSnapshotRef },
    })), 'reference_mismatch', '$.context_category_binding.category_binding_snapshot_ref', 'mismatched Category Snapshot content reference must be rejected')
  }

  {
    const otherSnapshot = await bindSnapshot(snapshotCandidate({ approval_ref: 'evidence/approvals/context-category-bindings-v2' }))
    expectRejected(await admitContextPlannerEntry(validInput({ context_category_binding: otherSnapshot })), 'reference_mismatch', '$.context_policy.category_binding_snapshot_ref', 'Policy-to-Category Snapshot mismatch must be rejected')

    expectRejected(await admitContextPlannerEntry(validInput({
      context_category_binding: {
        ...snapshot,
        bindings: [snapshot.bindings[0], { ...snapshot.bindings[0] }],
      },
    })), 'duplicate_binding', '$.context_category_binding.bindings[1].context_ref', 'duplicate Binding must surface as Structural Rejection')

    expectRejected(await admitContextPlannerEntry(validInput({
      context_category_binding: {
        ...snapshot,
        bindings: [{ context_ref: contextA, categories: ['unapproved'] }],
      },
    })), 'invalid_category', '$.context_category_binding.bindings[0].categories[0]', 'invalid Category must surface as Structural Rejection')
  }

  {
    const caller = validInput()
    const accepted = await admitContextPlannerEntry(caller)
    assert.equal(accepted.accepted, true, 'valid exact Entry input must be accepted')
    assert.deepEqual(Object.keys(accepted).sort(), ['accepted', 'core_input', 'errors'])
    assert.deepEqual(Object.keys(accepted.core_input).sort(), [
      'context_category_binding',
      'context_policy',
      'context_rendering_profile_ref',
      'materialization_policy_ref',
      'planner_version',
      'routing_decision',
      'routing_decision_ref',
    ], 'accepted Core Input must contain exactly seven fields')
    assert(Object.isFrozen(accepted))
    assert(Object.isFrozen(accepted.errors))
    assert(Object.isFrozen(accepted.core_input))
    assert(Object.isFrozen(accepted.core_input.routing_decision))
    assert(Object.isFrozen(accepted.core_input.routing_decision.required_context_refs))
    assert(Object.isFrozen(accepted.core_input.context_policy))
    assert(Object.isFrozen(accepted.core_input.context_policy.optional_context_rules))
    assert(Object.isFrozen(accepted.core_input.context_category_binding))
    assert(Object.isFrozen(accepted.core_input.context_category_binding.bindings))
    assert(Object.isFrozen(accepted.core_input.context_category_binding.bindings[0].categories))

    caller.routing_decision.required_context_refs[0] = 'docs/context/mutated-routing-v1.md'
    caller.context_policy.optional_context_rules[0].action = 'include'
    caller.context_category_binding.bindings[0].categories[0] = 'restricted'
    assert.equal(accepted.core_input.routing_decision.required_context_refs[0], contextA, 'Routing Decision caller aliases must be isolated')
    assert.equal(accepted.core_input.context_policy.optional_context_rules[0].action, 'exclude', 'Policy caller aliases must be isolated')
    assert.equal(accepted.core_input.context_category_binding.bindings[0].categories[0], 'public', 'Category Snapshot caller aliases must be isolated')
    assert.equal('entry_admission_contract_version' in accepted.core_input, false)
    assert.equal('context_plan_ref' in accepted.core_input, false)
    assert.equal('status' in accepted.core_input, false)
  }

  {
    const decisionTaskId = 'DO-NOT-LEAK-TASK-ID'
    const malformed = validInput({
      routing_decision: routingDecision(policy.context_policy_ref, {
        task_id: decisionTaskId,
        evaluation_timestamp: 'not-a-timestamp',
      }),
    })
    const result = await admitContextPlannerEntry(malformed)
    const serialized = JSON.stringify(result)
    assert.equal(result.accepted, false)
    assert(!serialized.includes(decisionTaskId), 'Structural Rejection must not contain Task identity values')
    assert(!serialized.includes('1970-01-01T00:00:00Z'), 'Structural Rejection must not contain epoch/default timestamps')
    assert(!serialized.includes(policy.context_policy_ref), 'Structural Rejection must not contain Policy identity values')
  }

  {
    const rawMessage = 'raw-secret-exception-message'
    const explosive = new Proxy(validInput(), {
      ownKeys() {
        throw new Error(rawMessage)
      },
    })
    const result = await admitContextPlannerEntry(explosive)
    expectRejected(result, 'admission_internal_failure', '$', 'unexpected Admission exception must be sanitized')
    assert(!JSON.stringify(result).includes(rawMessage), 'raw exception text must not escape')
  }

  {
    const first = await admitContextPlannerEntry(validInput())
    const second = await admitContextPlannerEntry(validInput())
    assert.deepEqual(second, first, 'Admission must not depend on filesystem, Repository, URL, network, wall clock, random, locale, environment, or runtime state')
  }

  console.log('Context Planner Entry Admission tests passed.')
} finally {
  await server.close()
}
