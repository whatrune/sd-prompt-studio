import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })

const policyRef = 'policies/context/planner-v1'
const optionalA = 'docs/context/optional-a-v1.md'
const optionalB = 'docs/context/optional-b-v1.md'
const requiredA = 'docs/context/required-a-v1.md'
const unused = 'docs/context/unused-v1.md'

const rule = (overrides = {}) => ({
  rule_contract_version: 'context_policy_rule_v1',
  rule_id: 'optional-a',
  rule_revision: 'v1',
  rule_ref: 'policies/context/rules/optional-a-v1',
  policy_ref: policyRef,
  match: { optional_context_ref: optionalA },
  action: 'include',
  priority: 100,
  source_ref: 'policies/context/sources/optional-a-v1',
  ...overrides,
})

const ordering = (overrides = {}) => ({
  rule_contract_version: 'context_ordering_rule_v1',
  rule_id: 'canonical-order',
  rule_revision: 'v1',
  rule_ref: 'policies/context/ordering/planner-v1',
  policy_ref: policyRef,
  strategy: 'explicit_rank',
  rank_entries: [
    { context_ref: requiredA, rank: 10 },
    { context_ref: optionalA, rank: 20 },
    { context_ref: unused, rank: 30 },
  ],
  source_ref: 'policies/context/sources/ordering-v1',
  ...overrides,
})

const policy = (overrides = {}) => ({
  context_policy_contract_version: 'context_policy_v1',
  context_policy_ref: policyRef,
  policy_revision: 'v1',
  optional_context_rules: [rule()],
  ordering_rule: ordering(),
  source_ref: 'docs/automation/20-context-planner-supporting-contracts-design.md',
  approval_ref: 'evidence/approvals/context-policy-v1',
  ...overrides,
})

const failure = (mapping, overrides = {}) => ({
  context_planning_failure_contract_version: 'context_planning_failure_v1',
  task_id: 'IMPLEMENT-CONTEXT-PLANNER-SUPPORTING-CONTRACTS-001',
  assignment_revision: 'assignments/context-planner/supporting-contracts-v1',
  routing_contract_version: 'model_routing_v1',
  routing_decision_ref: 'evidence/routing-decisions/context-planner-v1',
  context_policy_ref: policyRef,
  ...mapping,
  path: '$.optional_context_refs[0]',
  affected_ref: optionalA,
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
  context_policy_ref: policyRef,
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
  assert(result.errors.some(error => error.path === path), `${message}: expected ${path}; got ${result.errors.map(error => error.path).join(', ')}`)
}

try {
  const api = await server.ssrLoadModule('/src/context-planning/index.ts')
  const {
    CONTEXT_PLANNING_FAILURE_V1_MAPPINGS,
    canonicalizeJcs,
    compareContextReferencesUtf8,
    generateContextPlanRef,
    validateContextOrderingRuleV1,
    validateContextOrderingSemantics,
    validateContextPlanningFailureV1,
    validateContextPolicyRuleV1,
    validateContextPolicySemantics,
    validateContextPolicySnapshot,
    validateContextPolicyV1,
    verifyContextPlanRef,
  } = api

  {
    for (const mapping of CONTEXT_PLANNING_FAILURE_V1_MAPPINGS) {
      const accepted = validateContextPlanningFailureV1(failure(mapping))
      assert.equal(accepted.accepted, true, `${mapping.failure_code} normative mapping must be accepted`)
      assert(Object.isFrozen(accepted.value), 'accepted Failure must be frozen')
      assert.equal(accepted.value.message, mapping.message, 'exact catalog message must be retained')
      assert(Object.isFrozen(mapping), 'closed Failure catalog entries must be frozen')

      const wrongStatus = mapping.status === 'blocked' ? 'failed' : 'blocked'
      const wrongStage = mapping.failed_stage === 'input_binding' ? 'policy_validation' : 'input_binding'
      const wrongOwner = mapping.decision_owner === 'routing_input_owner' ? 'context_policy_owner' : 'routing_input_owner'
      const wrongAction = mapping.recommended_next_action === 'correct_routing_input' ? 'architect_review' : 'correct_routing_input'
      const wrongRetry = mapping.retry_policy === 'after_input_revision' ? 'no_automatic_retry' : 'after_input_revision'
      rejectedAt(validateContextPlanningFailureV1(failure(mapping, { status: wrongStatus })), '$.status', `${mapping.failure_code} wrong status must fail closed`)
      rejectedAt(validateContextPlanningFailureV1(failure(mapping, { failed_stage: wrongStage })), '$.failed_stage', `${mapping.failure_code} wrong stage must fail closed`)
      rejectedAt(validateContextPlanningFailureV1(failure(mapping, { decision_owner: wrongOwner })), '$.decision_owner', `${mapping.failure_code} wrong owner must fail closed`)
      rejectedAt(validateContextPlanningFailureV1(failure(mapping, { recommended_next_action: wrongAction })), '$.recommended_next_action', `${mapping.failure_code} wrong action must fail closed`)
      rejectedAt(validateContextPlanningFailureV1(failure(mapping, { retry_policy: wrongRetry })), '$.retry_policy', `${mapping.failure_code} wrong retry must fail closed`)
      rejectedAt(validateContextPlanningFailureV1(failure(mapping, { message: 'Arbitrary failure text.' })), '$.message', `${mapping.failure_code} arbitrary message must fail closed`)
    }
    const internal = CONTEXT_PLANNING_FAILURE_V1_MAPPINGS.find(mapping => mapping.failure_code === 'internal_failure')
    const nonInternal = CONTEXT_PLANNING_FAILURE_V1_MAPPINGS.find(mapping => mapping.failure_code === 'context_policy_no_match')
    rejectedAt(validateContextPlanningFailureV1(failure(internal, { status: 'blocked' })), '$.status', 'internal_failure must not be blocked')
    rejectedAt(validateContextPlanningFailureV1(failure(nonInternal, { status: 'failed' })), '$.status', 'non-internal failure must not use failed')
  }

  {
    const source = policy()
    const accepted = validateContextPolicyV1(source)
    assert.equal(accepted.accepted, true, 'PR #137 ContextPolicyV1 shape must be accepted')
    assert(Object.isFrozen(accepted.value), 'accepted Policy must be frozen')
    assert(Object.isFrozen(accepted.value.optional_context_rules), 'optional rules must be frozen')
    assert(Object.isFrozen(accepted.value.ordering_rule), 'nested Ordering Rule must be frozen')
    assert(Object.isFrozen(accepted.value.ordering_rule.rank_entries), 'rank entries must be frozen')
    assert(Object.isFrozen(accepted.value.ordering_rule.rank_entries[0]), 'nested rank entry must be frozen')
    source.ordering_rule.rank_entries[0].rank = 999
    assert.equal(accepted.value.ordering_rule.rank_entries[0].rank, 10, 'accepted Policy must not retain caller aliases')

    const oldShape = {
      context_policy_contract_version: 'context_policy_v1', context_policy_ref: policyRef, policy_version: 'v1', rules: [],
      ordering_rule_ref: 'policies/context/ordering/planner-v1', evaluation_scope: [], created_from: 'docs/source-v1', evaluation_timestamp: '2026-07-20T00:00:00Z',
    }
    rejectedAt(validateContextPolicyV1(oldShape), '$.policy_revision', 'obsolete simplified Policy shape must be rejected')
    const missingApproval = policy()
    delete missingApproval.approval_ref
    rejectedAt(validateContextPolicyV1(missingApproval), '$.approval_ref', 'missing approval_ref must be rejected')
    rejectedAt(validateContextPolicySnapshot(policy({ context_policy_ref: 'policies/context/other-v1' }), policyRef), '$.context_policy_ref', 'expected parent Policy reference mismatch must be rejected')
    rejectedAt(validateContextPolicyV1(policy({ optional_context_rules: [rule({ policy_ref: 'policies/context/other-v1' })] })), '$.optional_context_rules[0].policy_ref', 'child Policy reference mismatch must be rejected')
    rejectedAt(validateContextPolicyV1(policy({ ordering_rule: ordering({ policy_ref: 'policies/context/other-v1' }) })), '$.ordering_rule.policy_ref', 'ordering Policy reference mismatch must be rejected')
    rejectedAt(validateContextPolicyV1(policy({ optional_context_rules: [rule(), rule({ rule_id: 'optional-b', rule_ref: 'policies/context/rules/optional-a-v1', match: { optional_context_ref: optionalB } })] })), '$.optional_context_rules[1].rule_ref', 'duplicate rule_ref must be rejected')
    rejectedAt(validateContextPolicyV1(policy({ ordering_rule: ordering({ rule_id: 'optional-a' }) })), '$.ordering_rule.rule_id', 'rule_id must be unique across optional and ordering rules')
    rejectedAt(validateContextPolicyV1(policy({ context_policy_contract_version: 'context_policy_v2' })), '$.context_policy_contract_version', 'unsupported Policy Contract version must be rejected')
    rejectedAt(validateContextPolicyRuleV1({ ...rule(), command: 'read source' }), '$.command', 'executable-shaped fields must be rejected')
    rejectedAt(validateContextPolicyV1({ ...policy(), credential: 'forbidden' }), '$.credential', 'Secret or Credential fields must be rejected')

    const invalidBeforeCandidates = policy()
    delete invalidBeforeCandidates.approval_ref
    const invalidResult = validateContextPolicySemantics(invalidBeforeCandidates, policyRef, [optionalB])
    rejectedAt(invalidResult, '$.approval_ref', 'invalid whole Snapshot must fail before candidate evaluation')
    assert(!invalidResult.errors.some(error => error.code === 'context_policy_no_match'), 'invalid Snapshot must not be partially evaluated')

    const reusable = policy({
      optional_context_rules: [rule(), rule({ rule_id: 'unused', rule_revision: 'v2', rule_ref: 'policies/context/rules/unused-v2', match: { optional_context_ref: unused }, source_ref: 'policies/context/sources/unused-v2' })],
    })
    assert.equal(validateContextPolicySemantics(reusable, policyRef, [optionalA]).accepted, true, 'unused Optional Rule must be allowed')
    assert.equal(validateContextOrderingSemantics(reusable.ordering_rule, [requiredA, optionalA]).accepted, true, 'unused extra rank must be allowed')
    assert.equal(validateContextPolicyRuleV1(rule()).accepted, true, 'frozen optional Rule shape must be accepted')
    assert.equal(validateContextOrderingRuleV1(ordering()).accepted, true, 'frozen Ordering Rule shape must be accepted')
  }

  {
    assert.equal(validateContextPolicySemantics(policy(), policyRef, [optionalA]).accepted, true, 'one exact match must be accepted')
    rejectedAt(validateContextPolicySemantics(policy(), policyRef, [optionalA.toUpperCase()]), '$.optional_context_refs[0]', 'case-different reference must not match')
    rejectedAt(validateContextPolicySemantics(policy(), policyRef, [optionalB]), '$.optional_context_refs[0]', 'no exact match must be rejected')

    const prioritized = policy({ optional_context_rules: [
      rule({ rule_id: 'low', rule_ref: 'policies/context/rules/low-v1', priority: 10 }),
      rule({ rule_id: 'high', rule_ref: 'policies/context/rules/high-v1', priority: 20, action: 'exclude' }),
    ] })
    assert.equal(validateContextPolicySemantics(prioritized, policyRef, [optionalA]).accepted, true, 'unique highest priority must be accepted')
    const reversed = policy({ optional_context_rules: [...prioritized.optional_context_rules].reverse() })
    assert.equal(validateContextPolicySemantics(reversed, policyRef, [optionalA]).accepted, true, 'Policy array order must not affect validation')

    const tiedSame = policy({ optional_context_rules: [rule(), rule({ rule_id: 'same', rule_ref: 'policies/context/rules/same-v1' })] })
    rejectedAt(validateContextPolicySemantics(tiedSame, policyRef, [optionalA]), '$.optional_context_refs[0]', 'equal highest priority with same action must be rejected')
    const tiedDifferent = policy({ optional_context_rules: [rule(), rule({ rule_id: 'different', rule_ref: 'policies/context/rules/different-v1', action: 'exclude' })] })
    rejectedAt(validateContextPolicySemantics(tiedDifferent, policyRef, [optionalA]), '$.optional_context_refs[0]', 'equal highest priority with different action must be rejected')
  }

  {
    assert.equal(validateContextOrderingSemantics(ordering(), [requiredA, optionalA]).accepted, true, 'exact planned rank coverage must be accepted')
    assert.deepEqual(
      validateContextOrderingSemantics(ordering(), [requiredA, optionalA]),
      validateContextOrderingSemantics(ordering(), [optionalA, requiredA]),
      'planned Context input order must not affect validation',
    )
    rejectedAt(validateContextOrderingSemantics(ordering(), [requiredA, optionalB]), '$.planned_context_refs[0]', 'missing planned rank must be rejected')
    const duplicateRank = ordering({ rank_entries: [{ context_ref: requiredA, rank: 10 }, { context_ref: optionalA, rank: 10 }] })
    rejectedAt(validateContextOrderingRuleV1(duplicateRank), '$.rank_entries[1].rank', 'duplicate rank must be rejected')
    const duplicateRef = ordering({ rank_entries: [{ context_ref: requiredA, rank: 10 }, { context_ref: requiredA, rank: 20 }] })
    rejectedAt(validateContextOrderingRuleV1(duplicateRef), '$.rank_entries[1].context_ref', 'duplicate rank-entry Context reference must be rejected')
  }

  {
    const bmp = 'docs/context/\uE000-v1'
    const astral = 'docs/context/\u{10000}-v1'
    assert.deepEqual([bmp, astral].sort(), [astral, bmp], 'JavaScript UTF-16 ordering must differ for the regression pair')
    assert.deepEqual([astral, bmp].sort(compareContextReferencesUtf8), [bmp, astral], 'UTF-8 byte ordering must place U+E000 first')

    assert.equal(canonicalizeJcs({ b: 2, a: 1 }), '{"a":1,"b":2}', 'JCS must sort object properties by RFC 8785 rules')
    assert.equal(canonicalizeJcs({ a: 1, b: 2 }), canonicalizeJcs({ b: 2, a: 1 }), 'object property order must not affect JCS')
    const first = plan()
    const firstRef = await generateContextPlanRef(first)
    assert.match(firstRef, /^evidence\/context-plans\/sha256-[0-9a-f]{64}$/)
    assert.equal(await generateContextPlanRef(structuredClone(first)), firstRef, 'same complete projection must produce the same reference')
    assert.equal(await generateContextPlanRef(plan({ forbidden_context_categories: ['secrets', 'credentials'], applied_rule_refs: [...first.applied_rule_refs].reverse() })), firstRef, 'set-valued array order must not affect the reference')
    assert.notEqual(await generateContextPlanRef(plan({ context_order: [optionalA, requiredA] })), firstRef, 'context_order change must change the reference')
    assert.notEqual(await generateContextPlanRef(plan({ planner_version: 'context-planner-v2' })), firstRef, 'planner_version change must change the reference')
    assert.notEqual(await generateContextPlanRef(plan({ evaluation_timestamp: '2026-07-21T00:00:00Z' })), firstRef, 'evaluation_timestamp change must change the reference')
    assert.equal(await generateContextPlanRef(plan({ context_plan_ref: `evidence/context-plans/sha256-${'1'.repeat(64)}` })), firstRef, 'context_plan_ref itself must not enter the projection')

    first.context_plan_ref = firstRef
    const verified = await verifyContextPlanRef(first)
    assert.equal(verified.accepted, true, 'matching canonical reference must verify')
    assert(Object.isFrozen(verified.projection), 'accepted projection must be frozen')
    assert(Object.isFrozen(verified.projection.required_context_refs), 'projection arrays must be frozen')
    assert.equal(verified.projection.planner_version, first.planner_version)
    assert.equal(verified.projection.evaluation_timestamp, first.evaluation_timestamp)
    rejectedAt(await verifyContextPlanRef(plan({ context_plan_ref: 'evidence/context-plans/not-a-digest' })), '$.context_plan_ref', 'invalid reference format must be rejected')
    rejectedAt(await verifyContextPlanRef(plan({ context_plan_ref: `evidence/context-plans/sha256-${'1'.repeat(64)}` })), '$.context_plan_ref', 'semantic digest mismatch must be rejected')
  }

  console.log('Context Planner supporting contract tests passed.')
} finally {
  await server.close()
}
