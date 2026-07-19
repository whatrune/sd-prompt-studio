import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })

const optionalA = 'docs/context/optional-a-v1.md'
const optionalB = 'docs/context/optional-b-v1.md'
const requiredA = 'docs/context/required-a-v1.md'

const rule = (overrides = {}) => ({
  rule_contract_version: 'context_policy_rule_v1',
  rule_id: 'optional-a',
  rule_version: 'v1',
  match: { optional_context_ref: optionalA },
  action: 'include',
  context_refs: [optionalA],
  priority: 100,
  source_ref: 'policies/context/rules/optional-a-v1',
  ...overrides,
})

const policy = (overrides = {}) => ({
  context_policy_contract_version: 'context_policy_v1',
  context_policy_ref: 'policies/context/planner-v1',
  policy_version: 'v1',
  rules: [rule()],
  ordering_rule_ref: 'policies/context/ordering/planner-v1',
  evaluation_scope: ['assignments/context-planning/scope-v1'],
  created_from: 'docs/automation/20-context-planner-supporting-contracts-design.md',
  evaluation_timestamp: '2026-07-20T00:00:00Z',
  ...overrides,
})

const ordering = (overrides = {}) => ({
  ordering_rule_contract_version: 'context_ordering_rule_v1',
  ordering_rule_ref: 'policies/context/ordering/planner-v1',
  ordering_version: 'v1',
  rank_assignments: [
    { context_ref: requiredA, rank: 10 },
    { context_ref: optionalA, rank: 20 },
  ],
  default_behavior: 'require_explicit_rank',
  ...overrides,
})

const failure = (overrides = {}) => ({
  context_planning_failure_contract_version: 'context_planning_failure_v1',
  task_id: 'IMPLEMENT-CONTEXT-PLANNER-SUPPORTING-CONTRACTS-001',
  assignment_revision: 'assignments/context-planner/supporting-contracts-v1',
  routing_contract_version: 'model_routing_v1',
  routing_decision_ref: 'evidence/routing-decisions/context-planner-v1',
  context_policy_ref: 'policies/context/planner-v1',
  status: 'blocked',
  failure_code: 'context_policy_no_match',
  failed_stage: 'optional_context_resolution',
  path: '$.optional_context_refs[0]',
  message: 'No exact Context Policy rule matches the optional Context reference.',
  affected_ref: optionalA,
  decision_owner: 'context_policy_owner',
  recommended_next_action: 'correct_context_policy',
  retry_policy: 'after_policy_revision',
  planner_version: 'context-planner-v1',
  evaluation_timestamp: '2026-07-20T00:00:00Z',
  ...overrides,
})

const plan = (overrides = {}) => ({
  context_plan_contract_version: 'context_plan_v1',
  context_plan_ref: `evidence/context-plans/sha256-${'0'.repeat(64)}`,
  task_id: 'IMPLEMENT-CONTEXT-PLANNER-SUPPORTING-CONTRACTS-001',
  assignment_revision: 'assignments/context-planner/supporting-contracts-v1',
  routing_contract_version: 'model_routing_v1',
  routing_decision_ref: 'evidence/routing-decisions/context-planner-v1',
  context_policy_ref: 'policies/context/planner-v1',
  required_context_refs: [requiredA],
  included_optional_context_refs: [optionalA],
  excluded_optional_context_refs: [optionalB],
  forbidden_context_categories: ['credentials', 'secrets'],
  context_order: [requiredA, optionalA],
  context_rendering_profile_ref: 'profiles/context-rendering/repository-v1',
  materialization_policy_ref: 'policies/materialization/repository-v1',
  applied_rule_refs: ['policies/context/ordering/planner-v1', 'policies/context/rules/optional-a-v1'],
  planner_version: 'context-planner-v1',
  evaluation_timestamp: '2026-07-20T00:00:00Z',
  ...overrides,
})

const rejectedAt = (result, path, message) => {
  assert.equal(result.accepted, false, message)
  assert(result.errors.some(error => error.path === path), `${message}: expected ${path}`)
}

try {
  const api = await server.ssrLoadModule('/src/context-planning/index.ts')
  const {
    canonicalizeJcs,
    generateContextPlanRef,
    validateContextOrderingRuleV1,
    validateContextOrderingSemantics,
    validateContextPlanningFailureV1,
    validateContextPolicyRuleV1,
    validateContextPolicySemantics,
    validateContextPolicyV1,
    verifyContextPlanRef,
  } = api

  {
    const source = failure()
    const accepted = validateContextPlanningFailureV1(source)
    assert.equal(accepted.accepted, true, 'blocked Failure must be accepted')
    assert(Object.isFrozen(accepted.value), 'accepted Failure must be frozen')
    source.message = 'changed'
    assert.notEqual(accepted.value.message, source.message, 'accepted Failure must be cloned')

    assert.equal(validateContextPlanningFailureV1(failure({
      status: 'failed',
      failure_code: 'internal_failure',
      failed_stage: 'internal_processing',
      decision_owner: 'backend_implementer',
      recommended_next_action: 'implementation_review',
      retry_policy: 'after_implementation_fix',
    })).accepted, true, 'failed/internal_failure must be accepted')

    rejectedAt(validateContextPlanningFailureV1(failure({ status: 'failed' })), '$.status', 'input failure must not use failed')
    rejectedAt(validateContextPlanningFailureV1(failure({
      status: 'blocked', failure_code: 'internal_failure', failed_stage: 'internal_processing',
    })), '$.status', 'internal failure must not use blocked')
    rejectedAt(validateContextPlanningFailureV1(failure({ status: 'pending' })), '$.status', 'unknown status must fail closed')
  }

  {
    const source = policy()
    const accepted = validateContextPolicyV1(source)
    assert.equal(accepted.accepted, true, 'valid Policy must be accepted')
    assert(Object.isFrozen(accepted.value), 'accepted Policy must be frozen')
    assert(Object.isFrozen(accepted.value.rules), 'Policy rules must be frozen')
    assert(Object.isFrozen(accepted.value.rules[0].context_refs), 'nested rule arrays must be frozen')
    source.rules[0].context_refs[0] = optionalB
    assert.equal(accepted.value.rules[0].context_refs[0], optionalA, 'accepted Policy must not retain caller aliases')
    assert.equal(validateContextPolicyRuleV1(rule()).accepted, true, 'valid exact-match rule must be accepted')
    assert.equal(validateContextPolicySemantics(policy(), [optionalA]).accepted, true, 'one exact match must be accepted')
    rejectedAt(validateContextPolicySemantics(policy(), [optionalB]), '$.optional_context_refs[0]', 'no exact match must block')
    rejectedAt(validateContextPolicySemantics(policy(), [optionalA.toUpperCase()]), '$.optional_context_refs[0]', 'exact matching must remain case-sensitive')

    const tied = policy({ rules: [rule(), rule({ rule_id: 'optional-a-copy', source_ref: 'policies/context/rules/optional-a-copy-v1' })] })
    rejectedAt(validateContextPolicySemantics(tied, [optionalA]), '$.optional_context_refs[0]', 'duplicate highest priority must block even when actions agree')
    const conflicting = policy({ rules: [rule(), rule({ rule_id: 'optional-a-exclude', action: 'exclude', source_ref: 'policies/context/rules/optional-a-exclude-v1' })] })
    rejectedAt(validateContextPolicySemantics(conflicting, [optionalA]), '$.optional_context_refs[0]', 'conflicting highest-priority actions must block')
    rejectedAt(validateContextPolicyRuleV1(rule({ priority: 1001 })), '$.priority', 'out-of-range priority must fail closed')
    rejectedAt(validateContextPolicyRuleV1(rule({ context_refs: [optionalA, optionalB] })), '$.context_refs', 'a rule must not add an unmatched Context reference')
    rejectedAt(validateContextPolicyRuleV1({ ...rule(), command: 'open source' }), '$.command', 'unknown executable field must fail closed')
  }

  {
    const accepted = validateContextOrderingRuleV1(ordering())
    assert.equal(accepted.accepted, true, 'explicit unique ranks must be accepted')
    assert(Object.isFrozen(accepted.value.rank_assignments), 'rank assignments must be frozen')
    assert.equal(validateContextOrderingSemantics(ordering(), [optionalA, requiredA]).accepted, true, 'planned input order must not affect rank validation')
    assert.deepEqual(
      validateContextOrderingSemantics(ordering(), [requiredA, optionalA]),
      validateContextOrderingSemantics(ordering(), [optionalA, requiredA]),
      'ordering validation result must be input-order independent',
    )
    rejectedAt(validateContextOrderingSemantics(ordering(), [requiredA, optionalB]), '$.planned_context_refs[0]', 'missing explicit rank must block')
    const duplicateRank = ordering({ rank_assignments: [{ context_ref: requiredA, rank: 10 }, { context_ref: optionalA, rank: 10 }] })
    rejectedAt(validateContextOrderingRuleV1(duplicateRank), '$.rank_assignments[1].rank', 'duplicate rank must fail closed')
  }

  {
    assert.equal(canonicalizeJcs({ b: 2, a: 1 }), '{"a":1,"b":2}', 'JCS must sort object properties')
    assert.equal(canonicalizeJcs({ a: 1, b: 2 }), canonicalizeJcs({ b: 2, a: 1 }), 'property order must not affect JCS')

    const first = plan()
    const firstRef = await generateContextPlanRef(first)
    assert.match(firstRef, /^evidence\/context-plans\/sha256-[0-9a-f]{64}$/)
    assert.equal(await generateContextPlanRef(structuredClone(first)), firstRef, 'same projection must produce the same reference')
    assert.equal(await generateContextPlanRef(plan({
      required_context_refs: [requiredA],
      forbidden_context_categories: ['secrets', 'credentials'],
      applied_rule_refs: ['policies/context/rules/optional-a-v1', 'policies/context/ordering/planner-v1'],
    })), firstRef, 'set-valued array order must not affect the reference')
    assert.notEqual(await generateContextPlanRef(plan({ context_rendering_profile_ref: 'profiles/context-rendering/repository-v2' })), firstRef, 'projected field changes must change the reference')
    assert.equal(await generateContextPlanRef(plan({ evaluation_timestamp: '2026-07-21T00:00:00Z' })), firstRef, 'runtime timestamp must not enter the projection')
    assert.equal(await generateContextPlanRef(plan({ planner_version: 'context-planner-v2' })), firstRef, 'implementation metadata must not enter the projection')

    first.context_plan_ref = firstRef
    const verified = await verifyContextPlanRef(first)
    assert.equal(verified.accepted, true, 'matching canonical reference must verify')
    assert(Object.isFrozen(verified.projection), 'accepted projection must be frozen')
    assert(Object.isFrozen(verified.projection.required_context_refs), 'projection arrays must be frozen')
    rejectedAt(await verifyContextPlanRef(plan({ context_plan_ref: 'evidence/context-plans/not-a-digest' })), '$.context_plan_ref', 'invalid reference format must fail closed')
    const wrongDigest = plan({ context_plan_ref: `evidence/context-plans/sha256-${'1'.repeat(64)}` })
    rejectedAt(await verifyContextPlanRef(wrongDigest), '$.context_plan_ref', 'semantic digest mismatch must fail closed')
  }

  console.log('Context Planner supporting contract tests passed.')
} finally {
  await server.close()
}
