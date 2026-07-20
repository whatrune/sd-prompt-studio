import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })

const routingDecisionRef = 'evidence/routing-decisions/context-planner-core-v2'
const requiredA = 'docs/context/required-a-v1.md'
const requiredB = 'docs/context/required-b-v1.md'
const optionalA = 'docs/context/optional-a-v1.md'
const optionalB = 'docs/context/optional-b-v1.md'
const unused = 'docs/context/unused-v1.md'
const renderingRef = 'profiles/context-rendering/repository-v1#approved'
const materializationRef = 'policies/materialization/repository-v1#approved'
const placeholderSnapshotRef = `evidence/context-category-bindings/sha256-${'0'.repeat(64)}`
const placeholderPolicyRef = `policies/context/sha256-${'0'.repeat(64)}`

const decision = (policyRef, overrides = {}) => ({
  routing_contract_version: 'model_routing_v1',
  task_id: 'IMPLEMENT-CONTEXT-PLANNER-CORE-001',
  assignment_revision: 'assignments/context-planner/core-v2',
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

const snapshotCandidate = (overrides = {}) => ({
  category_binding_contract_version: 'context_category_binding_v1',
  category_binding_snapshot_ref: placeholderSnapshotRef,
  category_catalog_ref: 'policies/context/categories/catalog-v1',
  approved_category_values: ['public', 'restricted', 'secrets', 'credentials'],
  bindings: [
    { context_ref: requiredA, categories: ['public'] },
    { context_ref: requiredB, categories: ['public'] },
    { context_ref: optionalA, categories: ['public'] },
    { context_ref: optionalB, categories: ['restricted'] },
    { context_ref: unused, categories: ['public'] },
  ],
  source_ref: 'docs/automation/21-context-planner-entry-admission-and-category-binding-design.md',
  approval_ref: 'evidence/approvals/context-category-bindings-core-v1',
  ...overrides,
})

const optionalRule = (id, contextRef, action, priority, overrides = {}) => ({
  rule_contract_version: 'context_policy_rule_v1',
  rule_id: id,
  rule_revision: 'v1',
  rule_ref: `policies/context/rules/${id}-v1`,
  policy_ref: placeholderPolicyRef,
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
  policy_ref: placeholderPolicyRef,
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
  ordering_rule: ordering(),
  source_ref: 'docs/automation/21-context-planner-entry-admission-and-category-binding-design.md',
  approval_ref: 'evidence/approvals/context-planner-core-policy-v2',
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
  const api = await server.ssrLoadModule('/src/context-planning/index.ts')
  const {
    CONTEXT_PLAN_SEMANTIC_PROVENANCE_DISCOVERY_BOUNDARY,
    admitContextPlannerEntry,
    generateContextCategoryBindingSnapshotRef,
    generateContextPlanRef,
    generateContextPolicyV2Ref,
    planContext,
    validateAdmittedContextPlan,
    validateContextPlanCategorySemantics,
    validateContextPlanStructure,
    validateContextPlanningFailureV1,
    verifyContextPlanRef,
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
  const buildAdmission = async ({ snapshotOverrides = {}, policyOverrides = {}, decisionOverrides = {} } = {}) => {
    const snapshot = await bindSnapshot(snapshotCandidate(snapshotOverrides))
    const candidate = policyCandidate(snapshot.category_binding_snapshot_ref, policyOverrides)
    const policy = await bindPolicy(candidate)
    const admission = await admitContextPlannerEntry({
      entry_admission_contract_version: 'context_planner_entry_admission_v1',
      routing_decision: decision(policy.context_policy_ref, decisionOverrides),
      routing_decision_ref: routingDecisionRef,
      context_policy: policy,
      context_category_binding: snapshot,
      context_rendering_profile_ref: renderingRef,
      materialization_policy_ref: materializationRef,
      planner_version: 'context-planner-core-v1',
    })
    assert.equal(admission.accepted, true, `fixture Admission failed: ${admission.errors?.map(error => `${error.code}:${error.path}`).join(', ')}`)
    return { admission, input: admission.core_input, snapshot, policy }
  }

  const baseline = await buildAdmission()

  {
    const rejected = await admitContextPlannerEntry(null)
    assert.equal(rejected.accepted, false, 'arbitrary caller values must stop at Entry Admission')
    assert.equal('task_id' in rejected, false)
    assert.equal('status' in rejected, false)
    assert.equal('context_planning_failure_contract_version' in rejected, false, 'Structural rejection must not fabricate Failure identity')
  }

  {
    assert.deepEqual(Object.keys(baseline.input).sort(), [
      'context_category_binding',
      'context_policy',
      'context_rendering_profile_ref',
      'materialization_policy_ref',
      'planner_version',
      'routing_decision',
      'routing_decision_ref',
    ], 'Core must receive the exact admitted seven-field contract')
    assert(Object.isFrozen(baseline.input))
    assert(Object.isFrozen(baseline.input.context_policy))
    assert(Object.isFrozen(baseline.input.context_category_binding.bindings))

    const result = await planContext(baseline.input)
    assert.equal(result.context_plan_contract_version, 'context_plan_v1')
    assert.equal(validateContextPlanStructure(result).accepted, true)
    assert.equal(validateContextPlanCategorySemantics(result, baseline.snapshot, baseline.policy).accepted, true)
    assert.equal((await verifyContextPlanRef(result)).accepted, true)
    assert.equal((await validateAdmittedContextPlan(result, baseline.snapshot, baseline.policy)).accepted, true)
    assert.deepEqual(result.required_context_refs, [requiredA, requiredB], 'Required Context must be preserved as a canonical set')
    assert.deepEqual(result.included_optional_context_refs, [optionalA])
    assert.deepEqual(result.excluded_optional_context_refs, [optionalB])
    assert.deepEqual(result.context_order, [requiredB, optionalA, requiredA], 'explicit ranks must define the complete order')
    assert.deepEqual(result.applied_rule_refs, [
      'policies/context/ordering/core-v1',
      'policies/context/rules/optional-a-include-v1',
      'policies/context/rules/optional-b-exclude-v1',
    ])
    assert.equal(result.context_policy_ref, baseline.input.routing_decision.context_policy_ref)
    assert.equal(result.context_rendering_profile_ref, renderingRef)
    assert.equal(result.materialization_policy_ref, materializationRef)
    assert.equal(result.evaluation_timestamp, baseline.input.routing_decision.evaluation_timestamp)
    assert(Object.isFrozen(result))
    assert(Object.isFrozen(result.required_context_refs))
    assert(Object.isFrozen(result.context_order))
  }

  {
    const first = await planContext(baseline.input)
    const second = await planContext(baseline.input)
    assert.deepEqual(second, first, 'same admitted input must produce the same immutable result')
  }

  {
    const mismatched = structuredClone(baseline.input)
    mismatched.context_policy.context_policy_ref = `policies/context/sha256-${'f'.repeat(64)}`
    const result = await planContext(mismatched)
    expectFailure(result, 'incompatible_context_policy', 'policy_validation', '$.context_policy.context_policy_ref')
    assert.equal(result.context_policy_ref, baseline.input.routing_decision.context_policy_ref, 'Failure identity must remain the routed Policy ref')
    assert.notEqual(result.context_policy_ref, mismatched.context_policy.context_policy_ref)
    assert.equal(result.task_id, baseline.input.routing_decision.task_id)
    assert.equal(result.assignment_revision, baseline.input.routing_decision.assignment_revision)
    assert.equal(result.evaluation_timestamp, baseline.input.routing_decision.evaluation_timestamp)

    const categoryMismatch = structuredClone(baseline.input)
    categoryMismatch.context_policy.category_binding_snapshot_ref = `evidence/context-category-bindings/sha256-${'e'.repeat(64)}`
    const categoryFailure = await planContext(categoryMismatch)
    expectFailure(categoryFailure, 'incompatible_context_policy', 'policy_validation', '$.context_policy.category_binding_snapshot_ref')
    assert.equal(categoryFailure.context_policy_ref, baseline.input.routing_decision.context_policy_ref)
  }

  {
    const missingRequired = await buildAdmission({
      snapshotOverrides: { bindings: snapshotCandidate().bindings.filter(binding => binding.context_ref !== requiredB) },
    })
    expectFailure(
      await planContext(missingRequired.input),
      'unsupported_context_reference',
      'input_binding',
      '$.routing_decision.required_context_refs[0]',
    )

    const missingIncluded = await buildAdmission({
      snapshotOverrides: { bindings: snapshotCandidate().bindings.filter(binding => binding.context_ref !== optionalA) },
    })
    expectFailure(
      await planContext(missingIncluded.input),
      'unsupported_context_reference',
      'input_binding',
      '$.routing_decision.optional_context_refs[1]',
    )
  }

  {
    const requiredForbidden = await buildAdmission({
      snapshotOverrides: {
        bindings: snapshotCandidate().bindings.map(binding => binding.context_ref === requiredB
          ? { ...binding, categories: ['secrets'] }
          : binding),
      },
    })
    expectFailure(
      await planContext(requiredForbidden.input),
      'forbidden_context',
      'input_binding',
      '$.routing_decision.required_context_refs[0]',
    )

    const includedForbidden = await buildAdmission({
      snapshotOverrides: {
        bindings: snapshotCandidate().bindings.map(binding => binding.context_ref === optionalA
          ? { ...binding, categories: ['credentials'] }
          : binding),
      },
    })
    expectFailure(
      await planContext(includedForbidden.input),
      'forbidden_context',
      'optional_context_resolution',
      '$.included_optional_context_refs[0]',
    )

    const excludedForbidden = await buildAdmission({
      snapshotOverrides: {
        bindings: snapshotCandidate().bindings.map(binding => binding.context_ref === optionalB
          ? { ...binding, categories: ['secrets'] }
          : binding),
      },
    })
    const accepted = await planContext(excludedForbidden.input)
    assert.equal(accepted.context_plan_contract_version, 'context_plan_v1', 'excluded optional Context must not be screened as included')
    assert.deepEqual(accepted.excluded_optional_context_refs, [optionalB])
  }

  {
    const noMatch = await buildAdmission({
      policyOverrides: {
        optional_context_rules: policyCandidate(placeholderSnapshotRef).optional_context_rules
          .filter(rule => rule.match.optional_context_ref !== optionalB),
      },
    })
    expectFailure(
      await planContext(noMatch.input),
      'context_policy_no_match',
      'optional_context_resolution',
      '$.routing_decision.optional_context_refs[0]',
    )

    const conflictRules = [
      ...policyCandidate(placeholderSnapshotRef).optional_context_rules,
      optionalRule('optional-a-tie', optionalA, 'exclude', 100),
    ]
    const conflict = await buildAdmission({ policyOverrides: { optional_context_rules: conflictRules } })
    expectFailure(
      await planContext(conflict.input),
      'context_policy_conflict',
      'optional_context_resolution',
      '$.routing_decision.optional_context_refs[1]',
    )
  }

  {
    const incomplete = await buildAdmission({
      policyOverrides: {
        ordering_rule: ordering({ rank_entries: ordering().rank_entries.filter(entry => entry.context_ref !== optionalA) }),
      },
    })
    expectFailure(await planContext(incomplete.input), 'invalid_context_order', 'order_generation', '$.planned_context_refs[0]')

    const conflicting = structuredClone(baseline.input)
    conflicting.context_policy.ordering_rule.rank_entries[0].rank = 10
    expectFailure(
      await planContext(conflicting),
      'invalid_context_order',
      'order_generation',
      '$.rank_entries[1].rank',
    )
  }

  {
    const validPlan = await planContext(baseline.input)
    const missing = await buildAdmission({
      snapshotOverrides: { bindings: snapshotCandidate().bindings.filter(binding => binding.context_ref !== requiredB) },
    })
    const withoutRef = {
      ...validPlan,
      context_policy_ref: missing.policy.context_policy_ref,
    }
    delete withoutRef.context_plan_ref
    const candidate = { ...withoutRef, context_plan_ref: await generateContextPlanRef(withoutRef) }
    const provenance = {
      admission: missing.admission,
      semantic_rejections: [{
        error_code: 'context_binding_coverage',
        error_path: '$.required_context_refs[1]',
        admitted_source_path: '$.routing_decision.required_context_refs[0]',
        discovery_boundary: CONTEXT_PLAN_SEMANTIC_PROVENANCE_DISCOVERY_BOUNDARY,
      }],
    }
    const proven = await validateAdmittedContextPlan(candidate, missing.snapshot, missing.policy, provenance)
    assert.equal(proven.accepted, false)
    assert.equal(proven.responsibility, 'input_or_policy', 'closed provenance must retain the correctable final-rejection class')

    const malformed = await validateAdmittedContextPlan({ ...validPlan, planner_version: '' }, baseline.snapshot, baseline.policy)
    assert.equal(malformed.accepted, false)
    assert.equal(malformed.responsibility, 'planner_implementation', 'malformed output must remain an implementation defect')
  }

  {
    const source = structuredClone(baseline.input)
    const safeBindings = structuredClone(source.context_category_binding.bindings)
    const forbiddenBindings = safeBindings.map(binding => binding.context_ref === requiredA
      ? { ...binding, categories: ['secrets'] }
      : binding)
    let bindingReads = 0
    Object.defineProperty(source.context_category_binding, 'bindings', {
      enumerable: true,
      get: () => (++bindingReads <= 2 ? safeBindings : forbiddenBindings),
    })
    const result = await planContext(source)
    expectFailure(result, 'internal_failure', 'internal_processing', '$.required_context_refs[0]')
    assert(bindingReads >= 3, 'fault injection must reach the composed final validator after both earlier exact screenings')
    assert.equal(result.context_policy_ref, baseline.input.routing_decision.context_policy_ref)
  }

  {
    const source = structuredClone(baseline.input)
    source.context_policy = new Proxy(source.context_policy, {
      get(target, property, receiver) {
        if (property === 'optional_context_rules') throw new Error('raw injected internal defect')
        return Reflect.get(target, property, receiver)
      },
    })
    const result = await planContext(source)
    expectFailure(result, 'internal_failure', 'internal_processing', '$')
    assert.equal(validateContextPlanningFailureV1(result).accepted, true)
    assert.equal(result.context_policy_ref, baseline.input.routing_decision.context_policy_ref)
    assert(!JSON.stringify(result).includes('raw injected internal defect'))
  }

  {
    const originalDigest = globalThis.crypto.subtle.digest
    globalThis.crypto.subtle.digest = async () => { throw new Error('injected reference-generation defect') }
    try {
      const result = await planContext(baseline.input)
      expectFailure(result, 'internal_failure', 'internal_processing', '$')
      assert.equal(result.context_policy_ref, baseline.input.routing_decision.context_policy_ref)
    } finally {
      globalThis.crypto.subtle.digest = originalDigest
    }
  }

  {
    const coreSource = await readFile(new URL('../src/context-planning/core.ts', import.meta.url), 'utf8')
    assert(!coreSource.includes('unknown-task'), 'Operational Core must not fabricate Task identity')
    assert(!coreSource.includes('1970-01-01'), 'Operational Core must not fabricate timestamps')
    assert(!/\?\?\s*0/.test(coreSource), 'rank lookup must not have a fallback rank')
    assert.match(coreSource, /rank === undefined\) return failure\(context, 'internal_failure'/, 'impossible rank lookup must fail as internal_failure')
    assert.match(coreSource, /admitted\.responsibility === 'input_or_policy'[\s\S]*'result_validation_failed'[\s\S]*'internal_failure'/, 'final responsibility mapping must be closed and fail unknown values as internal_failure')
    assert(!coreSource.includes('finalValidationProvenance'), 'Core must not manufacture final provenance for conditions screened before Plan assembly')
    assert(!/error_code:\s*['"]forbidden_context['"]/.test(coreSource), 'Core must never fabricate forbidden_context provenance')
    assert(!/fetch\(|readFile|https?:\/\//.test(coreSource), 'Operational Core must not access filesystem, Repository, URL, or network data')
    assert(!/Date\.|Math\.random|process\.env|localeCompare/.test(coreSource), 'Operational Core must not use wall clock, random, environment, or locale state')
  }

  console.log('Context Planner Core tests passed.')
} finally {
  await server.close()
}
