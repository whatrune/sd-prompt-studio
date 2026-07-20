import {
  CONTEXT_PLAN_CONTRACT_VERSION,
} from './types'
import type {
  ContextPlan,
  DeepReadonly,
} from './types'
import {
  CONTEXT_PLANNING_FAILURE_CONTRACT_VERSION,
  CONTEXT_PLANNING_FAILURE_V1_MAPPINGS,
} from './supporting-contracts'
import type {
  ContextPlanningFailureV1,
  ContextPlanningFailureV1Code,
  ContextPlanningFailureV1Mapping,
} from './supporting-contracts'
import {
  compareContextReferencesUtf8,
  validateContextOrderingSemantics,
} from './policy'
import {
  CONTEXT_PLAN_SEMANTIC_PROVENANCE_DISCOVERY_BOUNDARY,
  generateContextPlanRef,
  validateAdmittedContextPlan,
  verifyContextPlanRef,
} from './reference'
import type {
  AdmittedContextPlanSemanticProvenanceEvidence,
  AdmittedContextPlanValidationProvenance,
} from './reference'
import {
  validateContextPlanCategorySemantics,
  validateContextPlanStructure,
  validateContextPlanningFailureV1,
} from './validation'
import { isContextImmutableReference } from './category-binding'
import type { ContextPlannerCoreInput } from './entry-admission'

export type ContextPlannerCoreResult = DeepReadonly<ContextPlan | ContextPlanningFailureV1>

interface FailureContext {
  readonly task_id: string
  readonly assignment_revision: string
  readonly routing_contract_version: 'model_routing_v1'
  readonly routing_decision_ref: string
  readonly context_policy_ref: string
  readonly planner_version: string
  readonly evaluation_timestamp: string
}

function sorted(values: readonly string[]): string[] {
  return [...values].sort(compareContextReferencesUtf8)
}

function mappingFor(
  failureCode: ContextPlanningFailureV1Code,
  stage?: ContextPlanningFailureV1Mapping['failed_stage'],
): ContextPlanningFailureV1Mapping {
  const mapping = CONTEXT_PLANNING_FAILURE_V1_MAPPINGS.find(item =>
    item.failure_code === failureCode && (stage === undefined || item.failed_stage === stage))
  if (!mapping) throw new Error(`Closed Context Planning failure mapping is missing: ${failureCode}.`)
  return mapping
}

function failure(
  context: FailureContext,
  code: ContextPlanningFailureV1Code,
  path: string,
  affectedRef?: string,
  stage?: ContextPlanningFailureV1Mapping['failed_stage'],
): DeepReadonly<ContextPlanningFailureV1> {
  const mapping = mappingFor(code, stage)
  const candidate: ContextPlanningFailureV1 = {
    context_planning_failure_contract_version: CONTEXT_PLANNING_FAILURE_CONTRACT_VERSION,
    ...context,
    ...mapping,
    path,
    ...(affectedRef && isContextImmutableReference(affectedRef) ? { affected_ref: affectedRef } : {}),
  }
  const admitted = validateContextPlanningFailureV1(candidate)
  if (!admitted.accepted) throw new Error('Context Planner constructed an invalid closed-catalog failure.')
  return admitted.value
}

function failureContext(input: DeepReadonly<ContextPlannerCoreInput>): FailureContext {
  return {
    task_id: input.routing_decision.task_id,
    assignment_revision: input.routing_decision.assignment_revision,
    routing_contract_version: input.routing_decision.routing_contract_version,
    routing_decision_ref: input.routing_decision_ref,
    context_policy_ref: input.routing_decision.context_policy_ref,
    planner_version: input.planner_version,
    evaluation_timestamp: input.routing_decision.evaluation_timestamp,
  }
}

function sourceIndex(values: readonly string[], reference: string): number {
  return values.indexOf(reference)
}

function intersects(left: readonly string[], right: ReadonlySet<string>): boolean {
  return left.some(value => right.has(value))
}

function finalValidationProvenance(
  input: DeepReadonly<ContextPlannerCoreInput>,
  plan: DeepReadonly<ContextPlan>,
): DeepReadonly<AdmittedContextPlanValidationProvenance> {
  const evidence: AdmittedContextPlanSemanticProvenanceEvidence[] = []
  plan.required_context_refs.forEach((reference, index) => {
    const admittedIndex = sourceIndex(input.routing_decision.required_context_refs, reference)
    if (admittedIndex < 0) return
    for (const errorCode of ['context_binding_coverage', 'forbidden_context'] as const) {
      evidence.push({
        error_code: errorCode,
        error_path: `$.required_context_refs[${index}]`,
        admitted_source_path: `$.routing_decision.required_context_refs[${admittedIndex}]`,
        discovery_boundary: CONTEXT_PLAN_SEMANTIC_PROVENANCE_DISCOVERY_BOUNDARY,
      })
    }
  })
  plan.included_optional_context_refs.forEach((reference, index) => {
    const admittedIndex = sourceIndex(input.routing_decision.optional_context_refs, reference)
    if (admittedIndex < 0) return
    for (const errorCode of ['context_binding_coverage', 'forbidden_context'] as const) {
      evidence.push({
        error_code: errorCode,
        error_path: `$.included_optional_context_refs[${index}]`,
        admitted_source_path: `$.routing_decision.optional_context_refs[${admittedIndex}]`,
        discovery_boundary: CONTEXT_PLAN_SEMANTIC_PROVENANCE_DISCOVERY_BOUNDARY,
      })
    }
  })
  return Object.freeze({
    admission: Object.freeze({ accepted: true as const, core_input: input, errors: Object.freeze([]) }),
    semantic_rejections: Object.freeze(evidence.map(item => Object.freeze(item))),
  })
}

export async function planContext(
  input: DeepReadonly<ContextPlannerCoreInput>,
): Promise<ContextPlannerCoreResult> {
  const context = failureContext(input)
  try {
    const decision = input.routing_decision
    const policy = input.context_policy
    const categorySnapshot = input.context_category_binding

    if (decision.context_policy_ref !== policy.context_policy_ref) {
      return failure(context, 'incompatible_context_policy', '$.context_policy.context_policy_ref', policy.context_policy_ref)
    }
    if (policy.category_binding_snapshot_ref !== categorySnapshot.category_binding_snapshot_ref) {
      return failure(context, 'incompatible_context_policy', '$.context_policy.category_binding_snapshot_ref', policy.category_binding_snapshot_ref)
    }

    const required = sorted(decision.required_context_refs)
    const optional = sorted(decision.optional_context_refs)
    const included: string[] = []
    const excluded: string[] = []
    const winningRuleRefs: string[] = []

    for (const reference of optional) {
      const matches = policy.optional_context_rules.filter(rule => rule.match.optional_context_ref === reference)
      if (matches.length === 0) {
        const index = sourceIndex(decision.optional_context_refs, reference)
        return failure(context, 'context_policy_no_match', `$.routing_decision.optional_context_refs[${index}]`, reference)
      }
      const highestPriority = Math.max(...matches.map(rule => rule.priority))
      const winners = matches.filter(rule => rule.priority === highestPriority)
      if (winners.length !== 1) {
        const index = sourceIndex(decision.optional_context_refs, reference)
        return failure(context, 'context_policy_conflict', `$.routing_decision.optional_context_refs[${index}]`, reference)
      }
      const winner = winners[0]
      winningRuleRefs.push(winner.rule_ref)
      if (winner.action === 'include') included.push(reference)
      else excluded.push(reference)
    }

    const bindings = new Map(categorySnapshot.bindings.map(binding => [binding.context_ref, binding] as const))
    const forbidden = new Set(decision.forbidden_context_categories)
    for (const reference of required) {
      const binding = bindings.get(reference)
      const index = sourceIndex(decision.required_context_refs, reference)
      if (!binding) {
        return failure(context, 'unsupported_context_reference', `$.routing_decision.required_context_refs[${index}]`, reference)
      }
      if (intersects(binding.categories, forbidden)) {
        return failure(context, 'forbidden_context', `$.routing_decision.required_context_refs[${index}]`, reference, 'input_binding')
      }
    }
    for (const [index, reference] of included.entries()) {
      const binding = bindings.get(reference)
      if (!binding) {
        const admittedIndex = sourceIndex(decision.optional_context_refs, reference)
        return failure(context, 'unsupported_context_reference', `$.routing_decision.optional_context_refs[${admittedIndex}]`, reference)
      }
      if (intersects(binding.categories, forbidden)) {
        return failure(context, 'forbidden_context', `$.included_optional_context_refs[${index}]`, reference, 'optional_context_resolution')
      }
    }

    const planned = [...required, ...included]
    const ordering = validateContextOrderingSemantics(policy.ordering_rule, planned)
    if (!ordering.accepted) {
      return failure(context, 'invalid_context_order', ordering.errors[0]?.path ?? '$.context_policy.ordering_rule')
    }
    const ranks = new Map(ordering.value.rank_entries.map(entry => [entry.context_ref, entry.rank] as const))
    const ranked: { readonly reference: string; readonly rank: number }[] = []
    for (const reference of planned) {
      const rank = ranks.get(reference)
      if (rank === undefined) return failure(context, 'internal_failure', '$.context_policy.ordering_rule.rank_entries')
      ranked.push({ reference, rank })
    }
    ranked.sort((left, right) => left.rank - right.rank)
    const contextOrder = ranked.map(item => item.reference)
    const appliedRuleRefs = sorted([...new Set([...winningRuleRefs, ordering.value.rule_ref])])

    const referenceInput = {
      context_plan_contract_version: CONTEXT_PLAN_CONTRACT_VERSION,
      task_id: decision.task_id,
      assignment_revision: decision.assignment_revision,
      routing_contract_version: decision.routing_contract_version,
      routing_decision_ref: input.routing_decision_ref,
      context_policy_ref: policy.context_policy_ref,
      required_context_refs: required,
      included_optional_context_refs: included,
      excluded_optional_context_refs: excluded,
      forbidden_context_categories: sorted(decision.forbidden_context_categories),
      context_order: contextOrder,
      context_rendering_profile_ref: input.context_rendering_profile_ref,
      materialization_policy_ref: input.materialization_policy_ref,
      applied_rule_refs: appliedRuleRefs,
      planner_version: input.planner_version,
      evaluation_timestamp: decision.evaluation_timestamp,
    } as const
    const placeholderPlan = {
      ...referenceInput,
      context_plan_ref: `evidence/context-plans/sha256-${'0'.repeat(64)}`,
    }
    const structure = validateContextPlanStructure(placeholderPlan)
    if (!structure.accepted) return failure(context, 'internal_failure', structure.errors[0]?.path ?? '$')
    const semantics = validateContextPlanCategorySemantics(structure.value, categorySnapshot, policy)
    if (!semantics.accepted) return failure(context, 'internal_failure', semantics.errors[0]?.path ?? '$')

    const plan: ContextPlan = { ...referenceInput, context_plan_ref: await generateContextPlanRef(referenceInput) }
    const verified = await verifyContextPlanRef(plan)
    if (!verified.accepted) return failure(context, 'internal_failure', verified.errors[0]?.path ?? '$.context_plan_ref')
    const admitted = await validateAdmittedContextPlan(
      plan,
      categorySnapshot,
      policy,
      finalValidationProvenance(input, plan),
    )
    if (!admitted.accepted) {
      return admitted.responsibility === 'input_or_policy'
        ? failure(context, 'result_validation_failed', admitted.errors[0]?.path ?? '$')
        : failure(context, 'internal_failure', admitted.errors[0]?.path ?? '$')
    }
    return admitted.value
  } catch {
    return failure(context, 'internal_failure', '$')
  }
}
