import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })

const contextA = 'docs/context/alpha-v1.md'
const contextB = 'docs/context/beta-v1.md'
const contextExtra = 'docs/context/secrets-in-filename-v1.md'
const placeholderSnapshotRef = `evidence/context-category-bindings/sha256-${'0'.repeat(64)}`
const placeholderPolicyRef = `policies/context/sha256-${'0'.repeat(64)}`

const snapshotCandidate = (overrides = {}) => ({
  category_binding_contract_version: 'context_category_binding_v1',
  category_binding_snapshot_ref: placeholderSnapshotRef,
  category_catalog_ref: 'policies/context/categories/catalog-v1',
  approved_category_values: ['restricted', 'public', 'Secrets'],
  bindings: [
    { context_ref: contextB, categories: ['restricted', 'public'] },
    { context_ref: contextA, categories: ['public'] },
  ],
  source_ref: 'docs/automation/21-context-planner-entry-admission-and-category-binding-design.md',
  approval_ref: 'evidence/approvals/context-category-bindings-v1',
  ...overrides,
})

const optionalRule = (id, contextRef, action = 'include', overrides = {}) => ({
  rule_contract_version: 'context_policy_rule_v1',
  rule_id: id,
  rule_revision: 'v1',
  rule_ref: `policies/context/rules/${id}-v1`,
  policy_ref: placeholderPolicyRef,
  match: { optional_context_ref: contextRef },
  action,
  priority: 100,
  source_ref: `policies/context/sources/${id}-v1`,
  ...overrides,
})

const orderingRule = (overrides = {}) => ({
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
  ...overrides,
})

const policyCandidate = (categoryBindingSnapshotRef, overrides = {}) => ({
  context_policy_contract_version: 'context_policy_v2',
  context_policy_ref: placeholderPolicyRef,
  policy_revision: 'v2',
  category_binding_snapshot_ref: categoryBindingSnapshotRef,
  optional_context_rules: [
    optionalRule('beta-rule', contextB, 'exclude'),
    optionalRule('alpha-rule', contextA, 'include'),
  ],
  ordering_rule: orderingRule(),
  source_ref: 'docs/automation/21-context-planner-entry-admission-and-category-binding-design.md',
  approval_ref: 'evidence/approvals/context-policy-v2',
  ...overrides,
})

const rejectedAt = (result, path, message) => {
  assert.equal(result.accepted, false, message)
  assert(result.errors.some(error => error.path === path), `${message}: expected ${path}; got ${result.errors.map(error => error.path).join(', ')}`)
}

try {
  const api = await server.ssrLoadModule('/src/context-planning/index.ts')
  const {
    generateContextCategoryBindingSnapshotRef,
    generateContextPolicyV2Ref,
    validateContextCategoryBindingEntryV1,
    validateContextCategoryBindingSnapshotV1,
    validateContextPolicyV1,
    validateContextPolicyV2,
    validateContextPolicyV2CategoryBinding,
    verifyContextCategoryBindingSnapshotRef,
    verifyContextPolicyV2Ref,
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

  const validSnapshot = await bindSnapshot(snapshotCandidate())

  {
    const accepted = validateContextCategoryBindingSnapshotV1(validSnapshot)
    assert.equal(accepted.accepted, true, 'exact valid Snapshot must be accepted')
    assert.equal((await verifyContextCategoryBindingSnapshotRef(validSnapshot)).accepted, true, 'valid Snapshot content reference must verify')
    assert(Object.isFrozen(accepted.value))
    assert(Object.isFrozen(accepted.value.approved_category_values))
    assert(Object.isFrozen(accepted.value.bindings))
    assert(Object.isFrozen(accepted.value.bindings[0]))
    assert(Object.isFrozen(accepted.value.bindings[0].categories))

    const caller = structuredClone(validSnapshot)
    const admitted = validateContextCategoryBindingSnapshotV1(caller)
    caller.approved_category_values[0] = 'mutated'
    caller.bindings[0].categories[0] = 'mutated'
    assert.notEqual(admitted.value.approved_category_values[0], 'mutated', 'accepted Snapshot must not retain caller array aliases')
    assert.notEqual(admitted.value.bindings[0].categories[0], 'mutated', 'accepted binding must be deeply cloned')
  }

  {
    rejectedAt(validateContextCategoryBindingSnapshotV1(null), '$', 'non-object Snapshot must be rejected')
    const missing = structuredClone(validSnapshot)
    delete missing.category_catalog_ref
    rejectedAt(validateContextCategoryBindingSnapshotV1(missing), '$.category_catalog_ref', 'missing field must be rejected')
    rejectedAt(validateContextCategoryBindingSnapshotV1({ ...validSnapshot, extra: true }), '$.extra', 'unknown root field must be rejected')
    rejectedAt(validateContextCategoryBindingSnapshotV1({
      ...validSnapshot,
      bindings: [{ ...validSnapshot.bindings[0], pattern: '*.md' }],
    }), '$.bindings[0].pattern', 'unknown binding field must be rejected')
    rejectedAt(validateContextCategoryBindingSnapshotV1({
      ...validSnapshot,
      category_binding_contract_version: 'context_category_binding_v2',
    }), '$.category_binding_contract_version', 'unsupported Snapshot contract must be rejected')
  }

  {
    assert.equal(validateContextCategoryBindingEntryV1(
      { context_ref: contextA, categories: ['public'] },
      ['public'],
    ).accepted, true, 'exact closed Binding entry must be independently accepted')
    rejectedAt(validateContextCategoryBindingEntryV1(
      { context_ref: contextA, categories: ['public'], pattern: '*.md' },
      ['public'],
    ), '$.pattern', 'standalone Binding entry must reject unknown fields')

    rejectedAt(validateContextCategoryBindingSnapshotV1({
      ...validSnapshot,
      bindings: [validSnapshot.bindings[0], { ...validSnapshot.bindings[0] }],
    }), '$.bindings[1].context_ref', 'duplicate binding must be rejected')
    rejectedAt(validateContextCategoryBindingSnapshotV1({
      ...validSnapshot,
      bindings: [{ context_ref: contextA, categories: ['public', 'public'] }],
    }), '$.bindings[0].categories[1]', 'duplicate category must be rejected')
    rejectedAt(validateContextCategoryBindingSnapshotV1({
      ...validSnapshot,
      approved_category_values: ['public', 'public'],
    }), '$.approved_category_values[1]', 'duplicate approved category values must be rejected')
    rejectedAt(validateContextCategoryBindingSnapshotV1({
      ...validSnapshot,
      bindings: [{ context_ref: contextA, categories: [] }],
    }), '$.bindings[0].categories', 'empty category list must be rejected')
    rejectedAt(validateContextCategoryBindingSnapshotV1({
      ...validSnapshot,
      bindings: [{ context_ref: contextA, categories: ['unapproved'] }],
    }), '$.bindings[0].categories[0]', 'unapproved category must be rejected')
    rejectedAt(validateContextCategoryBindingSnapshotV1({
      ...validSnapshot,
      bindings: [{ context_ref: contextA, categories: ['secrets'] }],
    }), '$.bindings[0].categories[0]', 'category equality must remain case-sensitive')

    const exactCaseDistinct = snapshotCandidate({
      approved_category_values: ['public'],
      bindings: [
        { context_ref: 'docs/context/Case-v1.md', categories: ['public'] },
        { context_ref: 'docs/context/case-v1.md', categories: ['public'] },
      ],
    })
    exactCaseDistinct.category_binding_snapshot_ref = await generateContextCategoryBindingSnapshotRef(exactCaseDistinct)
    assert.equal(validateContextCategoryBindingSnapshotV1(exactCaseDistinct).accepted, true, 'Context references differing only by case must remain distinct exact identities')
  }

  {
    const safePathSnapshot = await bindSnapshot(snapshotCandidate({
      bindings: [...snapshotCandidate().bindings, { context_ref: contextExtra, categories: ['public'] }],
    }))
    assert.equal((await verifyContextCategoryBindingSnapshotRef(safePathSnapshot)).accepted, true, 'a forbidden-looking path token has no semantic effect')

    const withoutExtra = await generateContextCategoryBindingSnapshotRef(snapshotCandidate())
    const withExtra = await generateContextCategoryBindingSnapshotRef(snapshotCandidate({
      bindings: [...snapshotCandidate().bindings, { context_ref: contextExtra, categories: ['public'] }],
    }))
    assert.notEqual(withExtra, withoutExtra, 'extra binding must remain part of Snapshot identity')
  }

  {
    const candidate = snapshotCandidate()
    const reorderedProperties = {
      approval_ref: candidate.approval_ref,
      source_ref: candidate.source_ref,
      bindings: candidate.bindings,
      approved_category_values: candidate.approved_category_values,
      category_catalog_ref: candidate.category_catalog_ref,
      category_binding_snapshot_ref: candidate.category_binding_snapshot_ref,
      category_binding_contract_version: candidate.category_binding_contract_version,
    }
    assert.equal(
      await generateContextCategoryBindingSnapshotRef(reorderedProperties),
      await generateContextCategoryBindingSnapshotRef(candidate),
      'Snapshot property order must not affect JCS identity',
    )

    const reorderedArrays = snapshotCandidate({
      approved_category_values: [...candidate.approved_category_values].reverse(),
      bindings: [...candidate.bindings].reverse().map(binding => ({
        ...binding,
        categories: [...binding.categories].reverse(),
      })),
    })
    assert.equal(
      await generateContextCategoryBindingSnapshotRef(reorderedArrays),
      await generateContextCategoryBindingSnapshotRef(candidate),
      'Snapshot canonical array order must be input-order independent',
    )
    assert.notEqual(
      await generateContextCategoryBindingSnapshotRef(snapshotCandidate({ source_ref: 'docs/automation/21-context-planner-entry-admission-and-category-binding-design.md#changed' })),
      await generateContextCategoryBindingSnapshotRef(candidate),
      'Snapshot semantic content changes must change the reference',
    )
  }

  {
    rejectedAt(validateContextCategoryBindingSnapshotV1({ ...validSnapshot, category_binding_snapshot_ref: 'evidence/context-category-bindings/latest' }), '$.category_binding_snapshot_ref', 'malformed Snapshot reference must be rejected')
    const mismatched = { ...validSnapshot, category_binding_snapshot_ref: placeholderSnapshotRef }
    rejectedAt(await verifyContextCategoryBindingSnapshotRef(mismatched), '$.category_binding_snapshot_ref', 'mismatched Snapshot reference must be rejected')
  }

  const validPolicy = await bindPolicy(policyCandidate(validSnapshot.category_binding_snapshot_ref))

  {
    const accepted = validateContextPolicyV2(validPolicy, validSnapshot.category_binding_snapshot_ref)
    assert.equal(accepted.accepted, true, 'valid Policy v2 must be accepted')
    assert.equal(validateContextPolicyV2CategoryBinding(validPolicy, validSnapshot.category_binding_snapshot_ref).accepted, true, 'semantic identity verifier must accept the exact Category Snapshot binding')
    assert.equal((await verifyContextPolicyV2Ref(validPolicy)).accepted, true, 'valid Policy v2 content reference must verify')
    assert(Object.isFrozen(accepted.value))
    assert(Object.isFrozen(accepted.value.optional_context_rules))
    assert(Object.isFrozen(accepted.value.optional_context_rules[0]))
    assert(Object.isFrozen(accepted.value.ordering_rule.rank_entries))
    assert(accepted.value.optional_context_rules.every(rule => rule.policy_ref === validPolicy.context_policy_ref), 'all child refs must equal the root generated ref')
    assert.equal(accepted.value.ordering_rule.policy_ref, validPolicy.context_policy_ref)

    const caller = structuredClone(validPolicy)
    const admitted = validateContextPolicyV2(caller)
    caller.optional_context_rules[0].action = 'include'
    caller.ordering_rule.rank_entries[0].rank = 999
    assert.notEqual(admitted.value.optional_context_rules[0].action, caller.optional_context_rules[0].action, 'accepted Policy v2 must not retain caller Rule aliases')
    assert.notEqual(admitted.value.ordering_rule.rank_entries[0].rank, 999, 'accepted Policy v2 must deeply clone rank entries')
  }

  {
    const otherSnapshotRef = await generateContextCategoryBindingSnapshotRef(snapshotCandidate({ approval_ref: 'evidence/approvals/context-category-bindings-v2' }))
    rejectedAt(validateContextPolicyV2(validPolicy, otherSnapshotRef), '$.category_binding_snapshot_ref', 'Policy v2 must bind the exact expected Category Snapshot ref')
    rejectedAt(validateContextPolicyV2({ ...validPolicy, context_policy_ref: placeholderPolicyRef }), '$.optional_context_rules[0].policy_ref', 'child Policy refs must equal root')
    rejectedAt(validateContextPolicyV2({
      ...validPolicy,
      optional_context_rules: validPolicy.optional_context_rules.map((rule, index) => index === 0 ? { ...rule, policy_ref: placeholderPolicyRef } : rule),
    }), '$.optional_context_rules[0].policy_ref', 'every optional Rule must contain the root ref')
    rejectedAt(validateContextPolicyV2({
      ...validPolicy,
      ordering_rule: { ...validPolicy.ordering_rule, policy_ref: placeholderPolicyRef },
    }), '$.ordering_rule.policy_ref', 'Ordering Rule must contain the root ref')
  }

  {
    const candidate = policyCandidate(validSnapshot.category_binding_snapshot_ref)
    const alternateSelfRef = `policies/context/sha256-${'f'.repeat(64)}`
    const alternateParents = {
      ...candidate,
      context_policy_ref: alternateSelfRef,
      optional_context_rules: candidate.optional_context_rules.map(rule => ({ ...rule, policy_ref: alternateSelfRef })),
      ordering_rule: { ...candidate.ordering_rule, policy_ref: alternateSelfRef },
    }
    assert.equal(await generateContextPolicyV2Ref(alternateParents), await generateContextPolicyV2Ref(candidate), 'all recursive parent self-references must be excluded from the projection')

    const reorderedRules = policyCandidate(validSnapshot.category_binding_snapshot_ref, {
      optional_context_rules: [...candidate.optional_context_rules].reverse(),
    })
    assert.equal(await generateContextPolicyV2Ref(reorderedRules), await generateContextPolicyV2Ref(candidate), 'Rule input order must not affect Policy v2 reference')

    const changedAction = policyCandidate(validSnapshot.category_binding_snapshot_ref, {
      optional_context_rules: candidate.optional_context_rules.map((rule, index) => index === 0 ? { ...rule, action: 'include' } : rule),
    })
    assert.notEqual(await generateContextPolicyV2Ref(changedAction), await generateContextPolicyV2Ref(candidate), 'Policy semantic content change must change reference')

    const changedSnapshot = policyCandidate(`evidence/context-category-bindings/sha256-${'a'.repeat(64)}`)
    assert.notEqual(await generateContextPolicyV2Ref(changedSnapshot), await generateContextPolicyV2Ref(candidate), 'Category Snapshot reference change must change Policy reference')
  }

  {
    rejectedAt(validateContextPolicyV2({ ...validPolicy, context_policy_ref: 'policies/context/latest' }), '$.context_policy_ref', 'malformed Policy reference must be rejected')
    const mismatch = { ...validPolicy, context_policy_ref: placeholderPolicyRef }
    mismatch.optional_context_rules = mismatch.optional_context_rules.map(rule => ({ ...rule, policy_ref: placeholderPolicyRef }))
    mismatch.ordering_rule = { ...mismatch.ordering_rule, policy_ref: placeholderPolicyRef }
    rejectedAt(await verifyContextPolicyV2Ref(mismatch), '$.context_policy_ref', 'mismatched Policy content reference must be rejected')
    rejectedAt(validateContextPolicyV2({ ...validPolicy, unknown: true }), '$.unknown', 'unknown Policy v2 fields must be rejected')
  }

  {
    const v1PolicyRef = 'policies/context/planner-v1'
    const v1 = {
      context_policy_contract_version: 'context_policy_v1',
      context_policy_ref: v1PolicyRef,
      policy_revision: 'v1',
      optional_context_rules: [optionalRule('v1-rule', contextA, 'include', { policy_ref: v1PolicyRef })],
      ordering_rule: orderingRule({ policy_ref: v1PolicyRef }),
      source_ref: 'docs/automation/20-context-planner-supporting-contracts-design.md',
      approval_ref: 'evidence/approvals/context-policy-v1',
    }
    assert.equal(validateContextPolicyV1(v1).accepted, true, 'ContextPolicyV1 must remain accepted unchanged')
    assert.equal(validateContextPolicyV1(validPolicy).accepted, false, 'ContextPolicyV2 must not be silently admitted as v1')
    assert.equal(validateContextPolicyV2(v1).accepted, false, 'ContextPolicyV1 must not be silently upgraded to v2')
  }

  {
    assert.equal(await generateContextCategoryBindingSnapshotRef(snapshotCandidate()), await generateContextCategoryBindingSnapshotRef(snapshotCandidate()), 'Snapshot identity must not depend on wall clock, random, locale, environment, or runtime state')
    assert.equal(await generateContextPolicyV2Ref(policyCandidate(validSnapshot.category_binding_snapshot_ref)), await generateContextPolicyV2Ref(policyCandidate(validSnapshot.category_binding_snapshot_ref)), 'Policy identity must be deterministic and pure')
  }

  console.log('Context Category Binding and ContextPolicyV2 contract tests passed.')
} finally {
  await server.close()
}
