import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })

const requiredRef = 'docs/context/secrets-guide-v1.md'
const includedRef = 'docs/context/optional-v1.md'
const excludedRef = 'docs/context/excluded-v1.md'
const extraRef = 'docs/context/extra-v1.md'
const placeholderSnapshotRef = `evidence/context-category-bindings/sha256-${'0'.repeat(64)}`
const placeholderPolicyRef = `policies/context/sha256-${'0'.repeat(64)}`
const placeholderPlanRef = `evidence/context-plans/sha256-${'0'.repeat(64)}`

const snapshotCandidate = (overrides = {}) => ({
  category_binding_contract_version: 'context_category_binding_v1',
  category_binding_snapshot_ref: placeholderSnapshotRef,
  category_catalog_ref: 'policies/context/categories/catalog-v1',
  approved_category_values: ['public', 'restricted', 'secrets'],
  bindings: [
    { context_ref: requiredRef, categories: ['public'] },
    { context_ref: includedRef, categories: ['public'] },
    { context_ref: extraRef, categories: ['restricted'] },
  ],
  source_ref: 'docs/automation/21-context-planner-entry-admission-and-category-binding-design.md',
  approval_ref: 'evidence/approvals/context-category-bindings-v1',
  ...overrides,
})

const optionalRule = () => ({
  rule_contract_version: 'context_policy_rule_v1',
  rule_id: 'optional-context',
  rule_revision: 'v1',
  rule_ref: 'policies/context/rules/optional-context-v1',
  policy_ref: placeholderPolicyRef,
  match: { optional_context_ref: includedRef },
  action: 'include',
  priority: 100,
  source_ref: 'policies/context/sources/optional-context-v1',
})

const orderingRule = () => ({
  rule_contract_version: 'context_ordering_rule_v1',
  rule_id: 'context-order',
  rule_revision: 'v1',
  rule_ref: 'policies/context/ordering/context-order-v1',
  policy_ref: placeholderPolicyRef,
  strategy: 'explicit_rank',
  rank_entries: [
    { context_ref: requiredRef, rank: 10 },
    { context_ref: includedRef, rank: 20 },
  ],
  source_ref: 'policies/context/sources/context-order-v1',
})

const policyCandidate = (snapshotRef, overrides = {}) => ({
  context_policy_contract_version: 'context_policy_v2',
  context_policy_ref: placeholderPolicyRef,
  policy_revision: 'v2',
  category_binding_snapshot_ref: snapshotRef,
  optional_context_rules: [optionalRule()],
  ordering_rule: orderingRule(),
  source_ref: 'docs/automation/21-context-planner-entry-admission-and-category-binding-design.md',
  approval_ref: 'evidence/approvals/context-policy-v2',
  ...overrides,
})

const planCandidate = (policyRef, overrides = {}) => ({
  context_plan_contract_version: 'context_plan_v1',
  context_plan_ref: placeholderPlanRef,
  task_id: 'ALIGN-CONTEXT-PLAN-VALIDATION-001',
  assignment_revision: 'assignments/context-plan/validation-alignment-v1',
  routing_contract_version: 'model_routing_v1',
  routing_decision_ref: 'evidence/routing-decisions/context-plan-validation-v1',
  context_policy_ref: policyRef,
  required_context_refs: [requiredRef],
  included_optional_context_refs: [includedRef],
  excluded_optional_context_refs: [excludedRef],
  forbidden_context_categories: ['secrets'],
  context_order: [requiredRef, includedRef],
  context_rendering_profile_ref: 'profiles/context-rendering/repository-v1',
  materialization_policy_ref: 'policies/materialization/repository-v1',
  applied_rule_refs: ['policies/context/rules/optional-context-v1', 'policies/context/ordering/context-order-v1'],
  planner_version: 'context-planner-core-v1',
  evaluation_timestamp: '2026-07-20T09:00:00Z',
  ...overrides,
})

const rejectedAt = (result, code, path, message) => {
  assert.equal(result.accepted, false, message)
  assert(result.errors.some(error => error.code === code && error.path === path), `${message}: expected ${code} at ${path}; got ${result.errors.map(error => `${error.code}:${error.path}`).join(', ')}`)
  assert(Object.isFrozen(result))
  assert(Object.isFrozen(result.errors))
}

try {
  const api = await server.ssrLoadModule('/src/context-planning/index.ts')
  const {
    CONTEXT_PLAN_FINAL_REJECTION_RESPONSIBILITIES,
    generateContextCategoryBindingSnapshotRef,
    generateContextPlanRef,
    generateContextPolicyV2Ref,
    validateAdmittedContextPlan,
    validateContextPlan,
    validateContextPlanCategorySemantics,
    validateContextPlanStructure,
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
  const bindPlan = async candidate => ({
    ...candidate,
    context_plan_ref: await generateContextPlanRef(candidate),
  })
  const buildBundle = async ({ snapshotOverrides = {}, planOverrides = {} } = {}) => {
    const snapshot = await bindSnapshot(snapshotCandidate(snapshotOverrides))
    const policy = await bindPolicy(policyCandidate(snapshot.category_binding_snapshot_ref))
    const plan = await bindPlan(planCandidate(policy.context_policy_ref, planOverrides))
    return { snapshot, policy, plan }
  }

  const valid = await buildBundle()

  {
    const legacy = validateContextPlan(valid.plan)
    assert.equal(legacy.accepted, false, 'legacy validateContextPlan path inference must remain behaviorally unchanged')
    assert(legacy.errors.some(error => error.code === 'forbidden_context' && error.path === '$.required_context_refs[0]'))

    const structure = validateContextPlanStructure(valid.plan)
    assert.equal(structure.accepted, true, 'structural-only validator must accept safe Context whose path text contains a forbidden word')
    assert(Object.isFrozen(structure.value))
    assert(Object.isFrozen(structure.value.required_context_refs))
    assert.equal((await verifyContextPlanRef(valid.plan)).accepted, true, 'reference helper must use structural-only validation')
  }

  {
    const missing = structuredClone(valid.plan)
    delete missing.context_plan_ref
    rejectedAt(validateContextPlanStructure(missing), 'missing_field', '$.context_plan_ref', 'structural validator must reject malformed shape')
    rejectedAt(validateContextPlanStructure({ ...valid.plan, context_rendering_profile_ref: 'C:\\private\\profile.json' }), 'invalid_reference', '$.context_rendering_profile_ref', 'structural validator must reject malformed references')
    rejectedAt(validateContextPlanStructure({ ...valid.plan, evaluation_timestamp: '2026-02-30T09:00:00Z' }), 'invalid_value', '$.evaluation_timestamp', 'structural validator must reject malformed timestamps')
    rejectedAt(validateContextPlanStructure({ ...valid.plan, required_context_refs: [requiredRef, requiredRef] }), 'duplicate_reference', '$.required_context_refs[1]', 'structural validator must reject duplicate sets')
    rejectedAt(validateContextPlanStructure({ ...valid.plan, included_optional_context_refs: [requiredRef] }), 'duplicate_reference', '$.included_optional_context_refs[0]', 'structural validator must reject non-disjoint sets')
    rejectedAt(validateContextPlanStructure({ ...valid.plan, context_order: [requiredRef] }), 'invalid_context_order', '$.context_order', 'structural validator must reject incomplete order')
  }

  {
    const semantics = validateContextPlanCategorySemantics(valid.plan, valid.snapshot, valid.policy)
    assert.equal(semantics.accepted, true, 'exact Binding coverage and identity must be accepted')
    assert(Object.isFrozen(semantics.value))
    assert(Object.isFrozen(semantics.value.context_order))

    const missingRequired = await buildBundle({
      snapshotOverrides: { bindings: snapshotCandidate().bindings.filter(binding => binding.context_ref !== requiredRef) },
    })
    rejectedAt(validateContextPlanCategorySemantics(missingRequired.plan, missingRequired.snapshot, missingRequired.policy), 'context_binding_coverage', '$.required_context_refs[0]', 'missing required Binding must be rejected')

    const missingIncluded = await buildBundle({
      snapshotOverrides: { bindings: snapshotCandidate().bindings.filter(binding => binding.context_ref !== includedRef) },
    })
    rejectedAt(validateContextPlanCategorySemantics(missingIncluded.plan, missingIncluded.snapshot, missingIncluded.policy), 'context_binding_coverage', '$.included_optional_context_refs[0]', 'missing included optional Binding must be rejected')

    const caseMismatch = await buildBundle({
      snapshotOverrides: {
        bindings: snapshotCandidate().bindings.map(binding => binding.context_ref === requiredRef
          ? { ...binding, context_ref: 'docs/context/Secrets-guide-v1.md' }
          : binding),
      },
    })
    rejectedAt(validateContextPlanCategorySemantics(caseMismatch.plan, caseMismatch.snapshot, caseMismatch.policy), 'context_binding_coverage', '$.required_context_refs[0]', 'reference case mismatch must not match')

    const extra = await buildBundle({
      snapshotOverrides: { bindings: [...snapshotCandidate().bindings, { context_ref: 'docs/context/unused-v1.md', categories: ['restricted'] }] },
    })
    assert.equal(validateContextPlanCategorySemantics(extra.plan, extra.snapshot, extra.policy).accepted, true, 'extra unused Binding must be ignored for current Plan semantics')
  }

  {
    const requiredForbidden = await buildBundle({
      snapshotOverrides: {
        bindings: snapshotCandidate().bindings.map(binding => binding.context_ref === requiredRef
          ? { ...binding, categories: ['secrets'] }
          : binding),
      },
    })
    rejectedAt(validateContextPlanCategorySemantics(requiredForbidden.plan, requiredForbidden.snapshot, requiredForbidden.policy), 'forbidden_context', '$.required_context_refs[0]', 'required Context exact forbidden intersection must be rejected')

    const includedForbidden = await buildBundle({
      snapshotOverrides: {
        bindings: snapshotCandidate().bindings.map(binding => binding.context_ref === includedRef
          ? { ...binding, categories: ['secrets'] }
          : binding),
      },
    })
    rejectedAt(validateContextPlanCategorySemantics(includedForbidden.plan, includedForbidden.snapshot, includedForbidden.policy), 'forbidden_context', '$.included_optional_context_refs[0]', 'included optional exact forbidden intersection must be rejected')

    const excludedHasNoBinding = structuredClone(valid.snapshot)
    assert.equal(excludedHasNoBinding.bindings.some(binding => binding.context_ref === excludedRef), false)
    const accepted = validateContextPlanCategorySemantics(valid.plan, excludedHasNoBinding, valid.policy)
    assert.equal(accepted.accepted, true, 'excluded optional Context must not require coverage or forbidden screening')
    assert.deepEqual(accepted.value.excluded_optional_context_refs, [excludedRef], 'validation must not include or remove excluded optional Context')

    const snapshotWithUnreadableSource = new Proxy(valid.snapshot, {
      get(target, property, receiver) {
        if (property === 'source_ref') throw new Error('source content must not be inspected')
        return Reflect.get(target, property, receiver)
      },
    })
    assert.equal(
      validateContextPlanCategorySemantics(valid.plan, snapshotWithUnreadableSource, valid.policy).accepted,
      true,
      'Category semantics must use exact Binding data without inspecting source content',
    )
  }

  {
    const mismatchedPlan = await bindPlan(planCandidate(`policies/context/sha256-${'f'.repeat(64)}`))
    rejectedAt(validateContextPlanCategorySemantics(mismatchedPlan, valid.snapshot, valid.policy), 'plan_policy_reference_mismatch', '$.context_policy_ref', 'Plan Policy ref mismatch must be rejected')

    const otherSnapshot = await bindSnapshot(snapshotCandidate({ approval_ref: 'evidence/approvals/context-category-bindings-v2' }))
    rejectedAt(validateContextPlanCategorySemantics(valid.plan, otherSnapshot, valid.policy), 'category_snapshot_reference_mismatch', '$.category_binding_snapshot_ref', 'Policy Category Snapshot ref mismatch must be rejected')
  }

  {
    const accepted = await validateAdmittedContextPlan(valid.plan, valid.snapshot, valid.policy)
    assert.equal(accepted.accepted, true, 'composed admitted validator must require and accept all three validation stages')
    assert(Object.isFrozen(accepted))
    assert(Object.isFrozen(accepted.value))
    assert(Object.isFrozen(accepted.value.required_context_refs))

    const malformed = await validateAdmittedContextPlan({ ...valid.plan, planner_version: '' }, valid.snapshot, valid.policy)
    assert.equal(malformed.accepted, false)
    assert.equal(malformed.responsibility, 'planner_implementation', 'malformed output-owned field must classify as planner implementation')

    const missingBinding = await buildBundle({
      snapshotOverrides: { bindings: snapshotCandidate().bindings.filter(binding => binding.context_ref !== requiredRef) },
    })
    const correctable = await validateAdmittedContextPlan(missingBinding.plan, missingBinding.snapshot, missingBinding.policy)
    assert.equal(correctable.accepted, false)
    assert.equal(correctable.responsibility, 'input_or_policy', 'exact correctable admitted Policy condition must classify as input_or_policy')

    const badReference = await validateAdmittedContextPlan({ ...valid.plan, context_plan_ref: placeholderPlanRef }, valid.snapshot, valid.policy)
    assert.equal(badReference.accepted, false)
    assert.equal(badReference.responsibility, 'planner_implementation', 'reference-generation defect must classify as planner implementation')
    assert(badReference.errors.some(error => error.code === 'context_plan_reference_mismatch'))

    const rawMessage = 'raw-unclassified-origin'
    const explosivePolicy = new Proxy(valid.policy, {
      get(target, property, receiver) {
        if (property === 'context_policy_ref') throw new Error(rawMessage)
        return Reflect.get(target, property, receiver)
      },
    })
    const unknown = await validateAdmittedContextPlan(valid.plan, valid.snapshot, explosivePolicy)
    assert.equal(unknown.accepted, false)
    assert.equal(unknown.responsibility, 'planner_implementation', 'unknown final-rejection origin must fail closed to planner implementation')
    assert(unknown.errors.some(error => error.code === 'internal_validation_failure'))
    assert(!JSON.stringify(unknown).includes(rawMessage), 'raw exception text must not escape')
  }

  {
    assert.deepEqual(CONTEXT_PLAN_FINAL_REJECTION_RESPONSIBILITIES, ['input_or_policy', 'planner_implementation'])
    assert(Object.isFrozen(CONTEXT_PLAN_FINAL_REJECTION_RESPONSIBILITIES))
    assert.equal(await generateContextPlanRef(planCandidate(valid.policy.context_policy_ref)), await generateContextPlanRef(planCandidate(valid.policy.context_policy_ref)), 'context_plan_ref must remain deterministic for the same normative projection')
  }

  console.log('ContextPlan Category Semantics tests passed.')
} finally {
  await server.close()
}
