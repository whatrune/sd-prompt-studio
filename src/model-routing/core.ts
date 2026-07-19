import { LOGICAL_TIERS, REASONING_LEVELS } from '../deployment-binding'
import type { LogicalTier, ReasoningLevel } from '../deployment-binding'
import {
  MODEL_ROUTING_CONTRACT_VERSION,
} from './types'
import type {
  CanonicalRoutingRole,
  DeepReadonly,
  ModelRoutingResult,
  RoutingDecision,
  RoutingFailure,
  RoutingFailureCode,
  RoutingFailureStage,
  RoutingInput,
} from './types'
import {
  validateRoutingDecision,
  validateRoutingFailure,
  validateRoutingInput,
} from './validation'

const ROUTING_POLICY_REF = 'docs/automation/12-model-routing-policy.md'
const RESPONSE_POLICY_REF = 'docs/automation/13-response-policy.md'
const ARCHITECTURE_REF = 'docs/automation/18-model-routing-response-architecture.md'
const UNKNOWN_ASSIGNMENT_REF = 'policies/model-routing/unknown-assignment-v1'
const UNKNOWN_TIMESTAMP = '1970-01-01T00:00:00Z'
const VERSIONED_REFERENCE = /^[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)+$/
const CANONICAL_REFERENCE = /^(?:https:\/\/github\.com\/[^\s]+|(?:docs|config|policies|evidence|profiles)\/[^\s]+)$/
const UTC_TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?Z$/

interface Floor {
  readonly tier: LogicalTier
  readonly reasoning: ReasoningLevel
}

const ROLE_FLOORS: Readonly<Record<CanonicalRoutingRole, Floor>> = {
  Worker: { tier: 'efficient', reasoning: 'low' },
  'Architect Team': { tier: 'advanced', reasoning: 'high' },
  'Backend Implementer': { tier: 'general', reasoning: 'medium' },
  'Frontend Implementer': { tier: 'general', reasoning: 'medium' },
  'Research Execution OP': { tier: 'efficient', reasoning: 'low' },
  'Image Analysis OP': { tier: 'advanced', reasoning: 'high' },
  'Research Review OP': { tier: 'advanced', reasoning: 'high' },
  'Maintenance OP': { tier: 'general', reasoning: 'medium' },
  'Reporting OP': { tier: 'general', reasoning: 'medium' },
}

const COMPLEXITY_FLOORS: Readonly<Record<RoutingInput['complexity']['value'], Floor>> = {
  low: { tier: 'efficient', reasoning: 'low' },
  medium: { tier: 'general', reasoning: 'medium' },
  high: { tier: 'advanced', reasoning: 'high' },
}

const RISK_FLOORS: Readonly<Record<string, Floor>> = {
  none: { tier: 'efficient', reasoning: 'low' },
  low: { tier: 'efficient', reasoning: 'low' },
  medium: { tier: 'general', reasoning: 'medium' },
  general: { tier: 'general', reasoning: 'medium' },
  high: { tier: 'advanced', reasoning: 'high' },
  security_boundary: { tier: 'advanced', reasoning: 'high' },
  contract_boundary: { tier: 'advanced', reasoning: 'high' },
  contract_or_architecture_change: { tier: 'advanced', reasoning: 'high' },
  data_migration_compatibility_or_rollback: { tier: 'advanced', reasoning: 'high' },
  production_impact: { tier: 'advanced', reasoning: 'high' },
}

const PROHIBITED_RISKS = new Set(['existing_run_or_research_artifact_impact'])

const RESPONSE_PROFILE_ANCHORS: Readonly<Record<CanonicalRoutingRole, string>> = {
  Worker: 'worker-profile',
  'Architect Team': 'architect-team-profile',
  'Backend Implementer': 'backend-implementer-profile',
  'Frontend Implementer': 'frontend-implementer-profile',
  'Research Execution OP': 'research-execution-op',
  'Image Analysis OP': 'image-analysis-op',
  'Research Review OP': 'research-review-op',
  'Maintenance OP': 'maintenance-op',
  'Reporting OP': 'reporting-op',
}

const TIER_RANK = new Map(LOGICAL_TIERS.map((value, index) => [value, index]))
const REASONING_RANK = new Map(REASONING_LEVELS.map((value, index) => [value, index]))

function maxTier(floors: readonly Floor[]): LogicalTier {
  return floors.reduce((current, floor) =>
    (TIER_RANK.get(floor.tier) ?? -1) > (TIER_RANK.get(current) ?? -1) ? floor.tier : current,
  'efficient' as LogicalTier)
}

function maxReasoning(floors: readonly Floor[]): ReasoningLevel {
  return floors.reduce((current, floor) =>
    (REASONING_RANK.get(floor.reasoning) ?? -1) > (REASONING_RANK.get(current) ?? -1) ? floor.reasoning : current,
  'low' as ReasoningLevel)
}

function sorted(values: readonly string[]): string[] {
  return [...values].sort((left, right) => left < right ? -1 : left > right ? 1 : 0)
}

function trustedReference(value: string): boolean {
  return VERSIONED_REFERENCE.test(value) || CANONICAL_REFERENCE.test(value)
}

function utcTimestamp(value: string): boolean {
  const match = UTC_TIMESTAMP.exec(value)
  if (!match) return false
  const [, yearText, monthText, dayText, hourText, minuteText, secondText] = match
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const hour = Number(hourText)
  const minute = Number(minuteText)
  const second = Number(secondText)
  if (month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) return false
  return day >= 1 && day <= new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function safeString(value: unknown, key: string, predicate: (item: string) => boolean): string | undefined {
  try {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
    const item = (value as Record<string, unknown>)[key]
    return typeof item === 'string' && predicate(item) ? item : undefined
  } catch {
    return undefined
  }
}

function failureMetadata(value: unknown) {
  return {
    task_id: safeString(value, 'task_id', item => /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(item)) ?? 'unknown-task',
    assignment_revision: safeString(value, 'assignment_revision', trustedReference) ?? UNKNOWN_ASSIGNMENT_REF,
    evaluation_timestamp: safeString(value, 'evaluation_timestamp', utcTimestamp) ?? UNKNOWN_TIMESTAMP,
    canonical_record: safeString(value, 'canonical_record', trustedReference) ?? ARCHITECTURE_REF,
  }
}

function finalizeFailure(failure: RoutingFailure): DeepReadonly<RoutingFailure> {
  const validation = validateRoutingFailure(failure)
  if (!validation.accepted) throw new Error('Model Router constructed an invalid RoutingFailure.')
  return validation.failure
}

function routingFailure(
  value: unknown,
  status: RoutingFailure['status'],
  failureCode: RoutingFailureCode,
  failedStage: RoutingFailureStage,
  path: string,
  message: string,
  affectedRef: string,
  decisionOwner: string,
  nextAction: string,
): DeepReadonly<RoutingFailure> {
  const metadata = failureMetadata(value)
  return finalizeFailure({
    routing_contract_version: MODEL_ROUTING_CONTRACT_VERSION,
    task_id: metadata.task_id,
    assignment_revision: metadata.assignment_revision,
    status,
    failure_code: failureCode,
    failed_stage: failedStage,
    path,
    message,
    affected_ref: affectedRef,
    decision_owner: decisionOwner,
    recommended_next_action: nextAction,
    evaluation_timestamp: metadata.evaluation_timestamp,
  })
}

function invalidInputFailure(value: unknown, path: string): DeepReadonly<RoutingFailure> {
  const metadata = failureMetadata(value)
  return routingFailure(
    value,
    'blocked',
    'invalid_input',
    'admission',
    path,
    'RoutingInput failed the frozen Contract validation boundary.',
    metadata.canonical_record,
    'Assigning Role / Integrated Lead',
    'Correct the canonical RoutingInput and submit it again.',
  )
}

function policyConflict(input: DeepReadonly<RoutingInput>, path: string, affectedRef: string): DeepReadonly<RoutingFailure> {
  return routingFailure(
    input,
    'blocked',
    'policy_conflict',
    'policy_resolution',
    path,
    'The supplied policy reference is not the frozen policy supported by this Router version.',
    affectedRef,
    'Architect Team',
    'Align the Assignment with the frozen routing and response policies.',
  )
}

function unsupportedRisk(input: DeepReadonly<RoutingInput>): DeepReadonly<RoutingFailure> {
  return routingFailure(
    input,
    'blocked',
    'unsupported_value',
    'classification',
    '$.risk_level.value',
    'The risk classification has no approved floor in the frozen routing policy.',
    input.risk_level.source_ref,
    'Architect Team',
    'Provide an approved risk classification or update the policy through Architect review.',
  )
}

function authorityBoundary(input: DeepReadonly<RoutingInput>): DeepReadonly<RoutingFailure> {
  return routingFailure(
    input,
    'blocked',
    'authority_boundary',
    'classification',
    '$.risk_level.value',
    'Existing Run or Research Artifact impact requires explicit authorization and cannot be routed implicitly.',
    input.risk_level.source_ref,
    'Product Owner / Research Workflow owner',
    'Create an explicitly authorized Assignment through the existing Research Workflow.',
  )
}

function finalizeDecision(decision: RoutingDecision): DeepReadonly<RoutingDecision> {
  const validation = validateRoutingDecision(decision)
  if (!validation.accepted) throw new Error('Model Router constructed an invalid RoutingDecision.')
  return validation.decision
}

function routeValidated(input: DeepReadonly<RoutingInput>): DeepReadonly<ModelRoutingResult> {
  if (input.routing_policy_ref !== ROUTING_POLICY_REF) {
    return policyConflict(input, '$.routing_policy_ref', input.routing_policy_ref)
  }
  if (input.response_policy_ref !== RESPONSE_POLICY_REF) {
    return policyConflict(input, '$.response_policy_ref', input.response_policy_ref)
  }
  if (PROHIBITED_RISKS.has(input.risk_level.value)) return authorityBoundary(input)
  const riskFloor = RISK_FLOORS[input.risk_level.value]
  if (!riskFloor) return unsupportedRisk(input)

  const floors = [ROLE_FLOORS[input.assigned_role], COMPLEXITY_FLOORS[input.complexity.value], riskFloor] as const
  const logicalTier = maxTier(floors)
  const requiredReasoningLevel = maxReasoning(floors)
  const structuredProfiles = input.structured_output_requirement.mode === 'required'
    ? sorted(input.structured_output_requirement.profile_refs)
    : []

  return finalizeDecision({
    routing_contract_version: MODEL_ROUTING_CONTRACT_VERSION,
    task_id: input.task_id,
    assignment_revision: input.assignment_revision,
    logical_tier: logicalTier,
    required_reasoning_level: requiredReasoningLevel,
    capability_floor_ref: `${ROUTING_POLICY_REF}#deterministic-route-resolution`,
    response_profile_ref: `${RESPONSE_POLICY_REF}#${RESPONSE_PROFILE_ANCHORS[input.assigned_role]}`,
    context_policy_ref: input.context_requirement.source_ref,
    required_context_refs: sorted(input.context_requirement.required_context_refs),
    optional_context_refs: sorted(input.context_requirement.optional_context_refs),
    forbidden_context_categories: sorted(input.context_requirement.forbidden_context_categories),
    required_structured_output_profile_refs: structuredProfiles,
    required_tool_profile_refs: [],
    latency_policy_ref: input.latency_requirement.source_ref,
    cost_policy_ref: `${ROUTING_POLICY_REF}#cost-optimization-policy`,
    security_policy_refs: sorted(input.security_requirement.policy_refs),
    validation_policy_ref: input.validation_requirement,
    applied_rule_refs: [...new Set([
      `${ROUTING_POLICY_REF}#role-floors`,
      `${ROUTING_POLICY_REF}#task-complexity-routing`,
      `${ROUTING_POLICY_REF}#risk-based-override`,
      `${RESPONSE_POLICY_REF}#${RESPONSE_PROFILE_ANCHORS[input.assigned_role]}`,
      input.task_type.source_ref,
      input.complexity.source_ref,
      input.risk_level.source_ref,
      input.required_output_type.source_ref,
      input.context_requirement.source_ref,
      input.latency_requirement.source_ref,
      input.security_requirement.source_ref,
    ])],
    decision_rationale: `Approved Role, complexity, and risk floors resolve to ${logicalTier} tier and ${requiredReasoningLevel} reasoning.`,
    evaluation_timestamp: input.evaluation_timestamp,
  })
}

export function routeModel(value: unknown): DeepReadonly<ModelRoutingResult> {
  try {
    const validation = validateRoutingInput(value)
    if (!validation.accepted) return invalidInputFailure(value, validation.errors[0]?.path ?? '$')
    return routeValidated(validation.input)
  } catch {
    return routingFailure(
      value,
      'failed',
      'internal_failure',
      'internal_processing',
      '$',
      'Model Router encountered an unexpected internal processing error.',
      ARCHITECTURE_REF,
      'Backend Implementer',
      'Inspect the sanitized diagnostics and correct the Router implementation.',
    )
  }
}
