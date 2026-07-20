import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })

const requiredA = 'docs/context/required-a-v1.md'
const requiredB = 'docs/context/required-b-v1.md'
const optionalA = 'docs/context/optional-a-v1.md'
const optionalB = 'docs/context/optional-b-v1.md'
const safeForbiddenWord = 'docs/context/secrets-handling-public-v1.md'
const unused = 'docs/context/unused-v1.md'
const routingDecisionRef = 'evidence/routing-decisions/context-planner-regression-v1'
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
    { context_ref: safeForbiddenWord, categories: ['public'] },
    { context_ref: unused, categories: ['public'] },
  ],
  source_ref: 'docs/automation/21-context-planner-entry-admission-and-category-binding-design.md',
  approval_ref: 'evidence/approvals/context-planner-regression-bindings-v1',
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
  rule_id: 'integration-order',
  rule_revision: 'v1',
  rule_ref: 'policies/context/ordering/integration-v1',
  policy_ref: placeholderPolicyRef,
  strategy: 'explicit_rank',
  rank_entries: [
    { context_ref: requiredA, rank: 30 },
    { context_ref: requiredB, rank: 10 },
    { context_ref: optionalA, rank: 20 },
    { context_ref: optionalB, rank: 40 },
    { context_ref: safeForbiddenWord, rank: 50 },
    { context_ref: unused, rank: 60 },
  ],
  source_ref: 'policies/context/sources/integration-order-v1',
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
    optionalRule('safe-word-include', safeForbiddenWord, 'include', 100),
    optionalRule('unused-include', unused, 'include', 100),
  ],
  ordering_rule: orderingRule(),
  source_ref: 'docs/automation/21-context-planner-entry-admission-and-category-binding-design.md',
  approval_ref: 'evidence/approvals/context-planner-regression-policy-v2',
  ...overrides,
})

const routingDecision = (policyRef, overrides = {}) => ({
  routing_contract_version: 'model_routing_v1',
  task_id: 'EXPAND-CONTEXT-PLANNER-INTEGRATION-REGRESSION-001',
  assignment_revision: 'assignments/context-planner/integration-regression-v1',
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
  applied_rule_refs: ['policies/routing/rules/context-planner-regression-v1'],
  decision_rationale: 'The public facade regression requires deterministic Context Planning.',
  evaluation_timestamp: '2026-07-20T09:00:00Z',
  ...overrides,
})

const isDeepFrozen = value => {
  if (value === null || typeof value !== 'object') return true
  if (!Object.isFrozen(value)) return false
  return Reflect.ownKeys(value).every(key => isDeepFrozen(value[key]))
}

const classify = result => {
  const classes = [
    ['structural', result?.accepted === false && Array.isArray(result?.errors)],
    ['plan', result?.context_plan_contract_version === 'context_plan_v1' && 'context_plan_ref' in result],
    ['failure', result?.context_planning_failure_contract_version === 'context_planning_failure_v1'],
  ].filter(([, matches]) => matches).map(([name]) => name)
  assert.equal(classes.length, 1, `expected exactly one closed result class; got ${classes.join(', ') || 'none'}`)
  return classes[0]
}

const expectStructural = (result, code, path) => {
  assert.equal(classify(result), 'structural')
  assert(result.errors.some(error => error.code === code && error.path === path), `${code} at ${path} not found`)
  assert.deepEqual(Object.keys(result).sort(), ['accepted', 'errors'])
  assert.equal(isDeepFrozen(result), true)
}

const expectFailure = (result, code, stage, status = 'blocked') => {
  assert.equal(classify(result), 'failure')
  assert.equal(result.failure_code, code)
  assert.equal(result.failed_stage, stage)
  assert.equal(result.status, status)
  assert.equal(isDeepFrozen(result), true)
}

const exactIdentity = (result, caller) => {
  assert.equal(result.task_id, caller.routing_decision.task_id)
  assert.equal(result.assignment_revision, caller.routing_decision.assignment_revision)
  assert.equal(result.routing_contract_version, caller.routing_decision.routing_contract_version)
  assert.equal(result.routing_decision_ref, caller.routing_decision_ref)
  assert.equal(result.context_policy_ref, caller.routing_decision.context_policy_ref)
  assert.equal(result.planner_version, caller.planner_version)
  assert.equal(result.evaluation_timestamp, caller.routing_decision.evaluation_timestamp)
}

try {
  const api = await server.ssrLoadModule('/src/context-planning/index.ts')
  const {
    generateContextCategoryBindingSnapshotRef,
    generateContextPolicyV2Ref,
    planContextEntry,
    validateAdmittedContextPlan,
    validateContextPlan,
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

  const baseline = await buildCaller()

  // Structural Rejection: arbitrary caller values are rejected without fabricated identity.
  expectStructural(await planContextEntry(null), 'invalid_type', '$')
  for (const [mutate, code, path] of [
    [caller => { delete caller.planner_version }, 'missing_field', '$.planner_version'],
    [caller => { caller.unknown_root = true }, 'unknown_field', '$.unknown_root'],
    [caller => { caller.routing_decision.logical_tier = 'unknown' }, 'invalid_value', '$.routing_decision.logical_tier'],
    [caller => { caller.routing_decision.evaluation_timestamp = '2026-07-20 09:00:00Z' }, 'invalid_timestamp', '$.routing_decision.evaluation_timestamp'],
    [caller => { caller.routing_decision_ref = 'C:/private/local.json' }, 'invalid_reference', '$.routing_decision_ref'],
    [caller => { caller.context_policy.optional_context_rules = 'invalid' }, 'invalid_type', '$.context_policy.optional_context_rules'],
    [caller => { caller.context_category_binding.bindings = 'invalid' }, 'invalid_type', '$.context_category_binding.bindings'],
    [caller => { caller.context_policy.category_binding_snapshot_ref = placeholderSnapshotRef }, 'reference_mismatch', '$.context_policy.category_binding_snapshot_ref'],
    [caller => { caller.entry_admission_contract_version = 'context_planner_entry_admission_v2' }, 'unsupported_contract', '$.entry_admission_contract_version'],
  ]) {
    const caller = structuredClone(baseline.caller)
    mutate(caller)
    expectStructural(await planContextEntry(caller), code, path)
  }
  {
    const raw = 'raw-pre-admission-regression-defect'
    const result = await planContextEntry(new Proxy({}, { ownKeys: () => { throw new Error(raw) } }))
    expectStructural(result, 'admission_internal_failure', '$')
    for (const field of ['task_id', 'assignment_revision', 'context_policy_ref', 'planner_version', 'routing_decision_ref', 'evaluation_timestamp']) {
      assert.equal(field in result, false, `Structural Rejection must not fabricate ${field}`)
    }
    assert(!JSON.stringify(result).includes(raw))
  }

  // Successful Planning: public facade through admitted final validation.
  const plan = await planContextEntry(baseline.caller)
  assert.equal(classify(plan), 'plan')
  assert.equal(validateContextPlanStructure(plan).accepted, true)
  assert.equal(validateContextPlanCategorySemantics(plan, baseline.snapshot, baseline.policy).accepted, true)
  assert.equal((await verifyContextPlanRef(plan)).accepted, true)
  assert.equal((await validateAdmittedContextPlan(plan, baseline.snapshot, baseline.policy)).accepted, true)
  assert.equal(isDeepFrozen(plan), true)
  assert.deepEqual(plan.required_context_refs, [requiredA, requiredB])
  assert.deepEqual(plan.included_optional_context_refs, [optionalA])
  assert.deepEqual(plan.excluded_optional_context_refs, [optionalB])
  assert.deepEqual(plan.context_order, [requiredB, optionalA, requiredA])
  assert(!plan.context_order.includes(optionalB), 'excluded optional Context must remain excluded and unscreened as included')
  assert(!plan.context_order.includes(unused), 'extra unused Binding must not alter current Plan semantics')

  {
    const requiredOnly = await buildCaller({ decisionOverrides: { optional_context_refs: [] } })
    const result = await planContextEntry(requiredOnly.caller)
    assert.equal(classify(result), 'plan')
    assert.deepEqual(result.included_optional_context_refs, [])
    assert.deepEqual(result.excluded_optional_context_refs, [])
    assert.deepEqual(result.context_order, [requiredB, requiredA])
  }
  {
    const safePath = await buildCaller({
      decisionOverrides: { optional_context_refs: [safeForbiddenWord] },
    })
    const result = await planContextEntry(safePath.caller)
    assert.equal(classify(result), 'plan', 'path words must not substitute for exact Category Binding membership')
    assert.deepEqual(result.included_optional_context_refs, [safeForbiddenWord])
  }

  // Operational blocked failures preserve exact routed identity.
  {
    const mismatch = await buildCaller({ decisionOverrides: { context_policy_ref: `policies/context/sha256-${'f'.repeat(64)}` } })
    const result = await planContextEntry(mismatch.caller)
    expectFailure(result, 'incompatible_context_policy', 'policy_validation')
    exactIdentity(result, mismatch.caller)
  }
  {
    const originalFreeze = Object.freeze
    Object.freeze = value => {
      if (value?.accepted === true && value?.core_input && Array.isArray(value?.errors)) {
        const coreInput = structuredClone(value.core_input)
        coreInput.context_policy.category_binding_snapshot_ref = placeholderSnapshotRef
        return originalFreeze({ ...value, core_input: coreInput })
      }
      return originalFreeze(value)
    }
    try {
      const result = await planContextEntry(baseline.caller)
      expectFailure(result, 'incompatible_context_policy', 'policy_validation')
      assert.equal(result.path, '$.context_policy.category_binding_snapshot_ref')
      exactIdentity(result, baseline.caller)
    } finally {
      Object.freeze = originalFreeze
    }
  }
  {
    const noMatch = await buildCaller({
      policyOverrides: {
        optional_context_rules: policyCandidate(placeholderSnapshotRef).optional_context_rules
          .filter(rule => rule.match.optional_context_ref !== optionalB),
      },
    })
    expectFailure(await planContextEntry(noMatch.caller), 'context_policy_no_match', 'optional_context_resolution')
  }
  {
    const conflict = await buildCaller({
      policyOverrides: {
        optional_context_rules: [
          ...policyCandidate(placeholderSnapshotRef).optional_context_rules,
          optionalRule('optional-a-tie', optionalA, 'exclude', 100),
        ],
      },
    })
    expectFailure(await planContextEntry(conflict.caller), 'context_policy_conflict', 'optional_context_resolution')
  }
  for (const [reference, optional, path] of [
    [requiredB, false, '$.routing_decision.required_context_refs[0]'],
    [optionalA, true, '$.routing_decision.optional_context_refs[1]'],
  ]) {
    const missing = await buildCaller({
      snapshotOverrides: { bindings: snapshotCandidate().bindings.filter(binding => binding.context_ref !== reference) },
    })
    const result = await planContextEntry(missing.caller)
    expectFailure(result, 'unsupported_context_reference', 'input_binding')
    assert.equal(result.path, path)
    assert.equal(optional, reference === optionalA)
  }
  for (const [reference, expectedStage] of [[requiredB, 'input_binding'], [optionalA, 'optional_context_resolution']]) {
    const forbidden = await buildCaller({
      snapshotOverrides: {
        bindings: snapshotCandidate().bindings.map(binding => binding.context_ref === reference
          ? { ...binding, categories: ['secrets'] }
          : binding),
      },
    })
    expectFailure(await planContextEntry(forbidden.caller), 'forbidden_context', expectedStage)
  }
  {
    const excludedForbidden = await buildCaller({
      snapshotOverrides: {
        bindings: snapshotCandidate().bindings.map(binding => binding.context_ref === optionalB
          ? { ...binding, categories: ['secrets'] }
          : binding),
      },
    })
    const result = await planContextEntry(excludedForbidden.caller)
    assert.equal(classify(result), 'plan')
    assert.deepEqual(result.excluded_optional_context_refs, [optionalB])
  }
  {
    const missingRank = await buildCaller({
      policyOverrides: { ordering_rule: orderingRule({ rank_entries: orderingRule().rank_entries.filter(entry => entry.context_ref !== optionalA) }) },
    })
    expectFailure(await planContextEntry(missingRank.caller), 'invalid_context_order', 'order_generation')

    const NativeMap = globalThis.Map
    globalThis.Map = class extends NativeMap {
      constructor(iterable) {
        super(iterable)
        this.plannedRankMap = !iterable
      }
      has(key) {
        if (this.plannedRankMap && typeof key === 'number') return true
        return super.has(key)
      }
      get(key) {
        if (this.plannedRankMap && typeof key === 'number') return 'docs/context/conflicting-rank-v1.md'
        return super.get(key)
      }
    }
    try {
      expectFailure(await planContextEntry(baseline.caller), 'invalid_context_order', 'order_generation')
    } finally {
      globalThis.Map = NativeMap
    }
  }

  // Operational failed failures use closed test-only primitive interception after Admission.
  {
    const NativeMap = globalThis.Map
    let numericMapCount = 0
    globalThis.Map = class extends NativeMap {
      constructor(iterable) {
        super(iterable)
        const entries = iterable ? [...iterable] : []
        this.sabotageRankLookup = entries.length > 0 && entries.every(entry => Array.isArray(entry) && typeof entry[1] === 'number') && ++numericMapCount === 2
      }
      get(key) {
        if (this.sabotageRankLookup) return undefined
        return super.get(key)
      }
    }
    try {
      const result = await planContextEntry(baseline.caller)
      expectFailure(result, 'internal_failure', 'internal_processing', 'failed')
      assert.equal(result.path, '$.context_policy.ordering_rule.rank_entries')
      exactIdentity(result, baseline.caller)
    } finally {
      globalThis.Map = NativeMap
    }
  }
  {
    const nativeMap = Array.prototype.map
    Array.prototype.map = function (...args) {
      if (this.length > 0 && this.every(item => item && typeof item === 'object' && Object.keys(item).sort().join(',') === 'rank,reference')) return []
      return nativeMap.apply(this, args)
    }
    try {
      const result = await planContextEntry(baseline.caller)
      expectFailure(result, 'internal_failure', 'internal_processing', 'failed')
      assert.equal(result.path, '$.context_order')
    } finally {
      Array.prototype.map = nativeMap
    }
  }
  {
    const originalDigest = globalThis.crypto.subtle.digest
    let digestCalls = 0
    globalThis.crypto.subtle.digest = async function (...args) {
      digestCalls += 1
      if (digestCalls === 3) throw new Error('raw-reference-generation-defect')
      return originalDigest.apply(this, args)
    }
    try {
      const result = await planContextEntry(baseline.caller)
      expectFailure(result, 'internal_failure', 'internal_processing', 'failed')
      exactIdentity(result, baseline.caller)
      assert(!JSON.stringify(result).includes('raw-reference-generation-defect'))
    } finally {
      globalThis.crypto.subtle.digest = originalDigest
    }
  }
  {
    const originalDigest = globalThis.crypto.subtle.digest
    let digestCalls = 0
    globalThis.crypto.subtle.digest = async function (...args) {
      digestCalls += 1
      const digest = await originalDigest.apply(this, args)
      if (digestCalls === 4) {
        const changed = new Uint8Array(digest.slice(0))
        changed[0] ^= 0xff
        return changed.buffer
      }
      return digest
    }
    try {
      const result = await planContextEntry(baseline.caller)
      expectFailure(result, 'internal_failure', 'internal_processing', 'failed')
      assert.equal(result.path, '$.context_plan_ref')
    } finally {
      globalThis.crypto.subtle.digest = originalDigest
    }
  }
  {
    const NativeMap = globalThis.Map
    let bindingMapCount = 0
    globalThis.Map = class extends NativeMap {
      constructor(iterable) {
        super(iterable)
      }
      set(key, value) {
        const binding = value?.context_ref ? value : Array.isArray(value) && value[0]?.context_ref ? value[0] : undefined
        if (binding && !this.bindingMapCounted) {
          this.bindingMapCounted = true
          bindingMapCount += 1
        }
        if (bindingMapCount === 3 && key === requiredA && Array.isArray(value)) {
          return super.set(key, [{ ...binding, categories: ['secrets'] }])
        }
        return super.set(key, value)
      }
    }
    try {
      const result = await planContextEntry(baseline.caller)
      expectFailure(result, 'internal_failure', 'internal_processing', 'failed')
      assert.equal(result.path, '$.required_context_refs[0]')
      assert(bindingMapCount >= 3, 'fault must occur only in the admitted final semantic validator')
    } finally {
      globalThis.Map = NativeMap
    }
  }
  for (const [responsibility, expectedCode, expectedStatus] of [
    ['input_or_policy', 'result_validation_failed', 'blocked'],
    ['unknown_final_responsibility', 'internal_failure', 'failed'],
  ]) {
    const NativeMap = globalThis.Map
    const originalFreeze = Object.freeze
    let bindingMapCount = 0
    globalThis.Map = class extends NativeMap {
      constructor(iterable) {
        super(iterable)
      }
      set(key, value) {
        const binding = value?.context_ref ? value : Array.isArray(value) && value[0]?.context_ref ? value[0] : undefined
        if (binding && !this.bindingMapCounted) {
          this.bindingMapCounted = true
          bindingMapCount += 1
        }
        if (bindingMapCount === 3 && key === requiredA && Array.isArray(value)) {
          return super.set(key, [{ ...binding, categories: ['secrets'] }])
        }
        return super.set(key, value)
      }
    }
    Object.freeze = value => {
      if (value?.accepted === false
        && value?.responsibility === 'planner_implementation'
        && value?.errors?.some(error => error.code === 'forbidden_context')) {
        return originalFreeze({ ...value, responsibility })
      }
      return originalFreeze(value)
    }
    try {
      const result = await planContextEntry(baseline.caller)
      expectFailure(result, expectedCode, expectedCode === 'result_validation_failed' ? 'result_validation' : 'internal_processing', expectedStatus)
      assert.equal(result.path, '$.required_context_refs[0]')
      exactIdentity(result, baseline.caller)
    } finally {
      Object.freeze = originalFreeze
      globalThis.Map = NativeMap
    }
  }
  {
    const originalDigest = globalThis.crypto.subtle.digest
    let digestCalls = 0
    globalThis.crypto.subtle.digest = async function (...args) {
      digestCalls += 1
      const digest = await originalDigest.apply(this, args)
      if (digestCalls === 5) throw new Error('raw-post-admission-operational-defect')
      return digest
    }
    try {
      const result = await planContextEntry(baseline.caller)
      expectFailure(result, 'internal_failure', 'internal_processing', 'failed')
      exactIdentity(result, baseline.caller)
      assert.equal(validateContextPlanningFailureV1(result).accepted, true)
      assert(!JSON.stringify(result).includes('raw-post-admission-operational-defect'))
    } finally {
      globalThis.crypto.subtle.digest = originalDigest
    }
  }

  // Determinism, mutation isolation, and set-semantic collection ordering.
  assert.deepEqual(await planContextEntry(baseline.caller), plan)
  {
    const caller = structuredClone(baseline.caller)
    const pending = planContextEntry(caller)
    caller.routing_decision.required_context_refs[0] = 'docs/context/mutated-v1.md'
    caller.context_policy.ordering_rule.rank_entries[0].rank = 999
    caller.context_category_binding.bindings[0].categories[0] = 'secrets'
    assert.deepEqual(await pending, plan)
  }
  {
    const reordered = await buildCaller({
      snapshotOverrides: {
        approved_category_values: [...snapshotCandidate().approved_category_values].reverse(),
        bindings: [...snapshotCandidate().bindings].reverse(),
      },
      decisionOverrides: {
        required_context_refs: [requiredA, requiredB],
        optional_context_refs: [optionalA, optionalB],
      },
    })
    assert.deepEqual(await planContextEntry(reordered.caller), plan)
  }

  // Public API and dependency boundary regression.
  assert.equal(typeof api.planContextEntry, 'function')
  assert.equal('createPlanContextEntryFacade' in api, false)
  const legacyCandidate = structuredClone(plan)
  legacyCandidate.context_plan_ref = 'evidence/context-plans/manual-validation-v1'
  assert.equal(validateContextPlan(legacyCandidate).accepted, true, 'legacy validateContextPlan remains a structural compatibility validator')
  const entrySource = await readFile(new URL('../src/context-planning/entry.ts', import.meta.url), 'utf8')
  const coreSource = await readFile(new URL('../src/context-planning/core.ts', import.meta.url), 'utf8')
  for (const source of [entrySource, coreSource]) {
    assert(!/Date\.|Math\.random|process\.env|localeCompare|fetch\(|readFile|https?:\/\//.test(source), 'planning boundary must not depend on runtime state or external I/O')
    assert(!/unknown-task|1970-01-01/.test(source), 'planning boundary must not fabricate identity or timestamps')
  }
  assert.match(entrySource, /if \(!admission\.accepted\) return admission[\s\S]*operationalDelegate\(admission\.core_input\)/, 'rejected Admission must never invoke Operational Core')
  assert(!/\?\?\s*0/.test(coreSource), 'Core must not introduce a fallback rank')
  assert.match(coreSource, /rank === undefined\) return failure\(context, 'internal_failure'/)
  assert.match(coreSource, /admitted\.responsibility === 'input_or_policy'[\s\S]*'result_validation_failed'[\s\S]*'internal_failure'/)

  console.log('Context Planner public-facade integration regression tests passed.')
} finally {
  await server.close()
}
