import { validateRoutingDecision } from '../model-routing'
import type { RoutingDecision } from '../model-routing'
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
  ContextPolicyV1,
} from './supporting-contracts'
import {
  compareContextReferencesUtf8,
  validateContextOrderingSemantics,
  validateContextPolicySemantics,
  validateContextPolicySnapshot,
} from './policy'
import {
  generateContextPlanRef,
  verifyContextPlanRef,
} from './reference'
import {
  validateContextPlan,
  validateContextPlanningFailureV1,
} from './validation'

const INPUT_FIELDS = [
  'routing_decision',
  'routing_decision_ref',
  'context_policy',
  'context_rendering_profile_ref',
  'materialization_policy_ref',
  'planner_version',
] as const

const OPAQUE_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/
const VERSIONED_REFERENCE = /^[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9][A-Za-z0-9._#-]*)+$/
const CANONICAL_REFERENCE = /^(?:https:\/\/github\.com\/[^\s]+|(?:docs|config|policies|evidence|profiles|assignments)\/[^\s]+)$/
const SECRET_QUERY = /[?&](?:token|secret|api[_-]?key|credential|password)=/i
const PERSONAL_PATH = /^(?:file:\/\/|[A-Za-z]:[\\/]|\\\\|\/(?:Users|home)\/)/i
const PRIVATE_ENDPOINT = /^(?:https?:\/\/)?(?:localhost|127(?:\.\d{1,3}){3}|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}|\[?::1\]?)(?::|\/|$)/i

export interface ContextPlannerCoreInput {
  readonly routing_decision: RoutingDecision
  readonly routing_decision_ref: string
  readonly context_policy: ContextPolicyV1
  readonly context_rendering_profile_ref: string
  readonly materialization_policy_ref: string
  readonly planner_version: string
}

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key)
}

function referenceAllowed(value: unknown): value is string {
  return typeof value === 'string'
    && (VERSIONED_REFERENCE.test(value) || CANONICAL_REFERENCE.test(value))
    && !SECRET_QUERY.test(value)
    && !PERSONAL_PATH.test(value)
    && !PRIVATE_ENDPOINT.test(value)
}

function sorted(values: readonly string[]): string[] {
  return [...values].sort(compareContextReferencesUtf8)
}

function normalizedCategoryValue(value: string): string {
  return `_${value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')}_`
}

function matchesForbiddenCategory(reference: string, category: string): boolean {
  return normalizedCategoryValue(reference).includes(`_${category}_`)
}

function firstForbidden(reference: string, categories: readonly string[]): string | undefined {
  return categories.find(category => matchesForbiddenCategory(reference, category))
}

function fallbackFailureContext(value: unknown): FailureContext {
  const record = isRecord(value) ? value : {}
  const decision = isRecord(record.routing_decision) ? record.routing_decision : {}
  const text = (candidate: unknown, fallback: string, predicate: (item: string) => boolean): string =>
    typeof candidate === 'string' && predicate(candidate) ? candidate : fallback
  return {
    task_id: text(decision.task_id, 'unknown-task', item => OPAQUE_IDENTIFIER.test(item)),
    assignment_revision: text(decision.assignment_revision, 'assignments/context-planner/unknown-v1', referenceAllowed),
    routing_contract_version: 'model_routing_v1',
    routing_decision_ref: text(record.routing_decision_ref, 'evidence/routing-decisions/unknown-v1', referenceAllowed),
    context_policy_ref: text(decision.context_policy_ref, 'policies/context/unknown-v1', referenceAllowed),
    planner_version: text(record.planner_version, 'context-planner-unknown-v1', item => OPAQUE_IDENTIFIER.test(item)),
    evaluation_timestamp: text(decision.evaluation_timestamp, '1970-01-01T00:00:00Z', item => !Number.isNaN(Date.parse(item))),
  }
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
    ...(affectedRef && referenceAllowed(affectedRef) ? { affected_ref: affectedRef } : {}),
  }
  const admitted = validateContextPlanningFailureV1(candidate)
  if (!admitted.accepted) throw new Error('Context Planner constructed an invalid closed-catalog failure.')
  return admitted.value
}

function failureForPolicyErrors(
  context: FailureContext,
  errors: readonly { readonly code: string; readonly path: string }[],
): DeepReadonly<ContextPlanningFailureV1> {
  const first = errors[0] ?? { code: 'invalid_value', path: '$.context_policy' }
  if (first.code === 'context_policy_no_match') return failure(context, 'context_policy_no_match', first.path)
  if (first.code === 'context_policy_conflict') return failure(context, 'context_policy_conflict', first.path)
  return failure(context, 'incompatible_context_policy', first.path)
}

function admittedFailureContext(
  decision: DeepReadonly<RoutingDecision>,
  routingDecisionRef: string,
  plannerVersion: string,
): FailureContext {
  return {
    task_id: decision.task_id,
    assignment_revision: decision.assignment_revision,
    routing_contract_version: decision.routing_contract_version,
    routing_decision_ref: routingDecisionRef,
    context_policy_ref: decision.context_policy_ref,
    planner_version: plannerVersion,
    evaluation_timestamp: decision.evaluation_timestamp,
  }
}

export async function planContext(value: unknown): Promise<ContextPlannerCoreResult> {
  let failureContext: FailureContext = {
    task_id: 'unknown-task',
    assignment_revision: 'assignments/context-planner/unknown-v1',
    routing_contract_version: 'model_routing_v1',
    routing_decision_ref: 'evidence/routing-decisions/unknown-v1',
    context_policy_ref: 'policies/context/unknown-v1',
    planner_version: 'context-planner-unknown-v1',
    evaluation_timestamp: '1970-01-01T00:00:00Z',
  }
  try {
    failureContext = fallbackFailureContext(value)
    if (!isRecord(value)) return failure(failureContext, 'inconsistent_identity', '$')

    for (const field of INPUT_FIELDS) {
      if (!hasOwn(value, field)) {
        const code = field === 'context_policy' ? 'missing_context_policy'
          : field === 'context_rendering_profile_ref' || field === 'materialization_policy_ref' || field === 'routing_decision_ref'
            ? 'unsupported_context_reference'
            : 'inconsistent_identity'
        return failure(failureContext, code, `$.${field}`)
      }
    }
    const unknown = Object.keys(value).find(field => !INPUT_FIELDS.includes(field as (typeof INPUT_FIELDS)[number]))
    if (unknown) return failure(failureContext, 'inconsistent_identity', `$.${unknown}`)

    const routed = validateRoutingDecision(value.routing_decision)
    if (!routed.accepted) {
      const first = routed.errors[0]
      const contextReferencePath = first?.path !== undefined
        && /\.(?:context_policy_ref|required_context_refs|optional_context_refs)(?:\[|$)/.test(first.path)
      const code = first?.code === 'INVALID_VALUE' && contextReferencePath ? 'unsupported_context_reference' : 'inconsistent_identity'
      return failure(failureContext, code, `$.routing_decision${first?.path.slice(1) ?? ''}`)
    }

    const plannerVersion = value.planner_version
    const routingDecisionRef = value.routing_decision_ref
    if (typeof plannerVersion !== 'string' || !OPAQUE_IDENTIFIER.test(plannerVersion)) {
      return failure(failureContext, 'inconsistent_identity', '$.planner_version')
    }
    failureContext = admittedFailureContext(routed.value, referenceAllowed(routingDecisionRef) ? routingDecisionRef : failureContext.routing_decision_ref, plannerVersion)
    if (!referenceAllowed(routingDecisionRef)) return failure(failureContext, 'unsupported_context_reference', '$.routing_decision_ref')
    if (!referenceAllowed(value.context_rendering_profile_ref)) {
      return failure(failureContext, 'unsupported_context_reference', '$.context_rendering_profile_ref')
    }
    if (!referenceAllowed(value.materialization_policy_ref)) {
      return failure(failureContext, 'unsupported_context_reference', '$.materialization_policy_ref')
    }

    const snapshot = validateContextPolicySnapshot(value.context_policy, routed.value.context_policy_ref)
    if (!snapshot.accepted) return failureForPolicyErrors(failureContext, snapshot.errors)
    const semantics = validateContextPolicySemantics(snapshot.value, routed.value.context_policy_ref, routed.value.optional_context_refs)
    if (!semantics.accepted) return failureForPolicyErrors(failureContext, semantics.errors)

    const required = sorted(routed.value.required_context_refs)
    const optional = sorted(routed.value.optional_context_refs)
    for (const [index, reference] of required.entries()) {
      if (firstForbidden(reference, routed.value.forbidden_context_categories)) {
        return failure(failureContext, 'forbidden_context', `$.routing_decision.required_context_refs[${index}]`, reference, 'input_binding')
      }
    }

    const included: string[] = []
    const excluded: string[] = []
    const winningRuleRefs: string[] = []
    for (const reference of optional) {
      const matches = semantics.value.optional_context_rules.filter(rule => rule.match.optional_context_ref === reference)
      const highestPriority = Math.max(...matches.map(rule => rule.priority))
      const winner = matches.find(rule => rule.priority === highestPriority)
      if (!winner) return failure(failureContext, 'context_policy_no_match', '$.routing_decision.optional_context_refs', reference)
      winningRuleRefs.push(winner.rule_ref)
      if (winner.action === 'include') included.push(reference)
      else excluded.push(reference)
    }

    for (const [index, reference] of included.entries()) {
      if (firstForbidden(reference, routed.value.forbidden_context_categories)) {
        return failure(failureContext, 'forbidden_context', `$.included_optional_context_refs[${index}]`, reference, 'optional_context_resolution')
      }
    }

    const planned = [...required, ...included]
    const ordering = validateContextOrderingSemantics(semantics.value.ordering_rule, planned)
    if (!ordering.accepted) return failure(failureContext, 'invalid_context_order', ordering.errors[0]?.path ?? '$.context_policy.ordering_rule')
    const ranks = new Map(ordering.value.rank_entries.map(entry => [entry.context_ref, entry.rank]))
    const contextOrder = [...planned].sort((left, right) => (ranks.get(left) ?? 0) - (ranks.get(right) ?? 0))
    const appliedRuleRefs = sorted([...new Set([...winningRuleRefs, ordering.value.rule_ref])])

    const referenceInput = {
      context_plan_contract_version: CONTEXT_PLAN_CONTRACT_VERSION,
      task_id: routed.value.task_id,
      assignment_revision: routed.value.assignment_revision,
      routing_contract_version: routed.value.routing_contract_version,
      routing_decision_ref: routingDecisionRef,
      context_policy_ref: routed.value.context_policy_ref,
      required_context_refs: required,
      included_optional_context_refs: included,
      excluded_optional_context_refs: excluded,
      forbidden_context_categories: sorted(routed.value.forbidden_context_categories),
      context_order: contextOrder,
      context_rendering_profile_ref: value.context_rendering_profile_ref,
      materialization_policy_ref: value.materialization_policy_ref,
      applied_rule_refs: appliedRuleRefs,
      planner_version: plannerVersion,
      evaluation_timestamp: routed.value.evaluation_timestamp,
    } as const
    const preflight = validateContextPlan({
      ...referenceInput,
      context_plan_ref: `evidence/context-plans/sha256-${'0'.repeat(64)}`,
    })
    if (!preflight.accepted) return failure(failureContext, 'result_validation_failed', preflight.errors[0]?.path ?? '$')
    const plan: ContextPlan = { ...referenceInput, context_plan_ref: await generateContextPlanRef(referenceInput) }
    const verified = await verifyContextPlanRef(plan)
    if (!verified.accepted) return failure(failureContext, 'result_validation_failed', verified.errors[0]?.path ?? '$.context_plan_ref')
    const admitted = validateContextPlan(plan)
    if (!admitted.accepted) return failure(failureContext, 'result_validation_failed', admitted.errors[0]?.path ?? '$')
    return admitted.value
  } catch {
    return failure(failureContext, 'internal_failure', '$')
  }
}
