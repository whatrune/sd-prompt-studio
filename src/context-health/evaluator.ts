/** Pure Step 3 evaluator. It consumes only admitted Step 2 values. */
import {
  deepFreezeClone,
  generateContextHealthDecisionRef,
  validateContextHealthDecisionSemantics,
  validateContextHealthDecisionV1,
  validateContextHealthEvaluationInputV1,
  validateContextHealthPolicyV1,
  verifyContextHealthReference,
  type CanonicalSourceRefV1,
  type ContextHealthDecisionV1,
  type ContextHealthEvaluationInputV1,
  type ContextHealthPolicyV1,
  type DeepReadonly,
  type DerivedSignalRuleV1,
  type OutcomeV1,
  type RuleRefV1,
} from './index'

export type EvaluatorFailureReasonV1 =
  | 'policy_mismatch'
  | 'unsupported_derived_rule_tuple'
  | 'duplicate_derived_rule_tuple'
  | 'invalid_threshold_kind_for_source'
  | 'invalid_threshold_value'
  | 'invalid_weight_for_signal_class'
  | 'missing_atomic_mapping'
  | 'atomic_mapping_mismatch'
  | 'atomic_authority_mismatch'
  | 'evidence_kind_not_permitted'
  | 'missing_checkpoint_rule'
  | 'duplicate_checkpoint_rule'
  | 'unknown_handling_mismatch'
  | 'missing_required_coverage_binding'
  | 'duplicate_required_coverage_binding'
  | 'required_validation_binding_ambiguous'
  | 'missing_security_rule'
  | 'rule_reference_unresolved'

export type ContextHealthEvaluationResultV1 =
  | { readonly ok: true; readonly decision: DeepReadonly<ContextHealthDecisionV1> }
  | { readonly ok: false; readonly reason: EvaluatorFailureReasonV1 }

type SignalClass = DerivedSignalRuleV1['signal_class']
type AtomicRow = {
  readonly code: ContextHealthEvaluationInputV1['atomic_signal_observations'][number]['atomic_signal_code']
  readonly derived: DerivedSignalRuleV1['derived_signal_code']
  readonly signalClass: SignalClass
  readonly authority: 'authoritative' | 'advisory'
}
type MutableContribution = {
  rule_ref: RuleRefV1
  derived_signal_code: string
  weight: number
  evidence_refs: CanonicalSourceRefV1[]
}

const severity: Record<OutcomeV1, number> = {
  continue: 0,
  checkpoint_only: 1,
  handoff_required: 2,
  hard_stop_and_handoff: 3,
}

const permittedTuples = new Set([
  'atomic_signal|operator_hard_stop|hard_stop|none',
  'atomic_signal|operator_handoff|forced_handoff|none',
  'atomic_signal|context_limit|forced_handoff|none',
  'atomic_signal|compression_pressure_observed|soft|none',
  'atomic_signal|role_reconstruction_warning|soft|none',
  'atomic_signal|security_boundary_uncertain|hard_stop|none',
  'atomic_signal|nonmandatory_retrieval_failure|soft|none',
  'coverage|security_boundary_uncertain|hard_stop|none',
  'coverage|nonmandatory_retrieval_failure|soft|count_at_least',
  'counter|compression_pressure_observed|soft|count_at_least',
  'counter|role_reconstruction_warning|soft|count_at_least',
  'counter|nonmandatory_retrieval_failure|soft|count_at_least',
  'validation|security_boundary_uncertain|hard_stop|none',
  'validation|nonmandatory_retrieval_failure|soft|count_at_least',
  'handoff|security_boundary_uncertain|hard_stop|none',
  'handoff|nonmandatory_retrieval_failure|soft|count_at_least',
])

const atomicRows: readonly AtomicRow[] = [
  { code: 'operator_hard_stop_event', derived: 'operator_hard_stop', signalClass: 'hard_stop', authority: 'authoritative' },
  { code: 'operator_handoff_event', derived: 'operator_handoff', signalClass: 'forced_handoff', authority: 'authoritative' },
  { code: 'user_context_limit_event', derived: 'context_limit', signalClass: 'forced_handoff', authority: 'authoritative' },
  { code: 'compression_event', derived: 'compression_pressure_observed', signalClass: 'soft', authority: 'advisory' },
  { code: 'role_reconstruction_warning_event', derived: 'role_reconstruction_warning', signalClass: 'soft', authority: 'advisory' },
  { code: 'security_uncertainty_event', derived: 'security_boundary_uncertain', signalClass: 'hard_stop', authority: 'authoritative' },
  { code: 'nonmandatory_retrieval_failure_event', derived: 'nonmandatory_retrieval_failure', signalClass: 'soft', authority: 'advisory' },
]

const requiredSecurityTuples = [
  'atomic_signal|security_boundary_uncertain|hard_stop|none',
  'coverage|security_boundary_uncertain|hard_stop|none',
  'validation|security_boundary_uncertain|hard_stop|none',
  'handoff|security_boundary_uncertain|hard_stop|none',
] as const

const requiredUnknownHandling = new Map([
  ['authoritative_signal', 'block'],
  ['advisory_signal', 'report_without_score'],
  ['coverage', 'block'],
  ['validation', 'block'],
  ['handoff', 'block'],
])

const tupleKey = (rule: DerivedSignalRuleV1): string =>
  `${rule.source_kind}|${rule.derived_signal_code}|${rule.signal_class}|${rule.threshold.kind}`

const compareCodeUnits = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0

const sourceRefKey = (ref: CanonicalSourceRefV1): string => {
  if (ref.kind === 'github') return `github|${ref.url}`
  if (ref.kind === 'repository') return `repository|${ref.repository}|${ref.commit_sha}|${ref.path}`
  return `content_addressed|${ref.content_ref}`
}

const canonicalRefs = (refs: readonly CanonicalSourceRefV1[]): CanonicalSourceRefV1[] => {
  const unique = new Map<string, CanonicalSourceRefV1>()
  for (const ref of refs) unique.set(sourceRefKey(ref), ref)
  return [...unique.entries()].sort(([left], [right]) => compareCodeUnits(left, right)).map(([, ref]) => ref)
}

const sameRef = (left: CanonicalSourceRefV1, right: CanonicalSourceRefV1): boolean =>
  sourceRefKey(left) === sourceRefKey(right)

const maxOutcome = (left: OutcomeV1, right: OutcomeV1): OutcomeV1 =>
  severity[left] >= severity[right] ? left : right

const derivedRule = (
  policy: ContextHealthPolicyV1,
  sourceKind: DerivedSignalRuleV1['source_kind'],
  derivedCode: DerivedSignalRuleV1['derived_signal_code'],
  signalClass: SignalClass,
): DerivedSignalRuleV1 | undefined =>
  policy.derived_signal_rules.find(
    (rule) => rule.source_kind === sourceKind && rule.derived_signal_code === derivedCode && rule.signal_class === signalClass,
  )

function policyFailure(policy: ContextHealthPolicyV1): EvaluatorFailureReasonV1 | undefined {
  if (policy.lifecycle_status !== 'approved' || policy.evaluator_contract_version !== 'context-health-evaluator-v1') return 'policy_mismatch'

  const tuples = new Set<string>()
  for (const rule of policy.derived_signal_rules) {
    const key = tupleKey(rule)
    if (!permittedTuples.has(key)) return 'unsupported_derived_rule_tuple'
    if (tuples.has(key)) return 'duplicate_derived_rule_tuple'
    tuples.add(key)
    if (rule.threshold.kind === 'count_at_least' && (!Number.isInteger(rule.threshold.value) || rule.threshold.value < 1)) return 'invalid_threshold_value'
    if (rule.source_kind === 'handoff' && rule.derived_signal_code === 'nonmandatory_retrieval_failure' && rule.threshold.kind === 'count_at_least' && rule.threshold.value !== 1) return 'invalid_threshold_value'
    if (rule.signal_class === 'soft' && (!Number.isInteger(rule.weight) || rule.weight < 1)) return 'invalid_weight_for_signal_class'
    if (rule.signal_class !== 'soft' && 'weight' in rule) return 'invalid_weight_for_signal_class'
  }
  for (const required of requiredSecurityTuples) if (!tuples.has(required)) return 'missing_security_rule'

  const atomicCodes = new Set<string>()
  for (const rule of policy.atomic_signal_rules) {
    if (atomicCodes.has(rule.atomic_signal_code)) return 'atomic_mapping_mismatch'
    atomicCodes.add(rule.atomic_signal_code)
    const row = atomicRows.find((candidate) => candidate.code === rule.atomic_signal_code)
    if (!row || row.derived !== rule.derived_signal_code || row.authority !== rule.authority) return 'atomic_mapping_mismatch'
    if (!derivedRule(policy, 'atomic_signal', row.derived, row.signalClass)) return 'missing_atomic_mapping'
  }

  for (const [evidenceClass, handling] of requiredUnknownHandling) {
    const matches = policy.unknown_handling_rules.filter((rule) => rule.evidence_class === evidenceClass)
    if (matches.length !== 1 || matches[0].handling !== handling) return 'unknown_handling_mismatch'
  }

  const threshold = policy.outcome_thresholds
  if (![threshold.continue_min, threshold.continue_max, threshold.checkpoint_only_min, threshold.checkpoint_only_max, threshold.handoff_required_min].every((value) => Number.isInteger(value) && value >= 0)) return 'policy_mismatch'
  if (threshold.continue_min !== 0 || threshold.continue_max + 1 !== threshold.checkpoint_only_min || threshold.checkpoint_only_max + 1 !== threshold.handoff_required_min) return 'policy_mismatch'
  return undefined
}

function scoreOutcome(score: number, policy: ContextHealthPolicyV1): OutcomeV1 | undefined {
  const threshold = policy.outcome_thresholds
  if (score >= threshold.continue_min && score <= threshold.continue_max) return 'continue'
  if (score >= threshold.checkpoint_only_min && score <= threshold.checkpoint_only_max) return 'checkpoint_only'
  if (score >= threshold.handoff_required_min) return 'handoff_required'
  return undefined
}

export async function evaluateContextHealthV1(inputCandidate: unknown, policyCandidate: unknown): Promise<ContextHealthEvaluationResultV1> {
  const observedAt = typeof (inputCandidate as { evaluation_timestamp?: unknown })?.evaluation_timestamp === 'string'
    ? (inputCandidate as { evaluation_timestamp: string }).evaluation_timestamp
    : ''
  if (!observedAt) return { ok: false, reason: 'policy_mismatch' }

  const inputAdmission = validateContextHealthEvaluationInputV1(inputCandidate, observedAt)
  const policyAdmission = validateContextHealthPolicyV1(policyCandidate, observedAt)
  if (!inputAdmission.accepted || !policyAdmission.accepted) return { ok: false, reason: 'policy_mismatch' }

  const input = inputAdmission.value as ContextHealthEvaluationInputV1
  const policy = policyAdmission.value as ContextHealthPolicyV1
  if (input.policy_ref !== policy.context_health_policy_ref) return { ok: false, reason: 'policy_mismatch' }
  if (!(await verifyContextHealthReference(input)) || !(await verifyContextHealthReference(policy))) return { ok: false, reason: 'policy_mismatch' }
  const incompatibility = policyFailure(policy)
  if (incompatibility) return { ok: false, reason: incompatibility }

  const checkpointRules = policy.checkpoint_rules.filter((rule) => rule.checkpoint_type === input.checkpoint.checkpoint_type)
  if (checkpointRules.length === 0) return { ok: false, reason: 'missing_checkpoint_rule' }
  if (checkpointRules.length !== 1) return { ok: false, reason: 'duplicate_checkpoint_rule' }
  const checkpointRule = checkpointRules[0]

  const hardRuleRefs: string[] = []
  const forcedRuleRefs: string[] = []
  const softContributions: MutableContribution[] = []
  const hardAtomicRefs: string[] = []
  const forcedAtomicRefs: string[] = []
  const softAtomicRefs: string[] = []
  const unknownAtomicRefs: string[] = []
  const unknownRuleRefs: string[] = []
  const unknownAdvisoryCodes: string[] = []

  const addSignal = (rule: DerivedSignalRuleV1, evidenceRefs: readonly CanonicalSourceRefV1[]): void => {
    if (rule.signal_class === 'hard_stop') hardRuleRefs.push(rule.rule_ref)
    else if (rule.signal_class === 'forced_handoff') forcedRuleRefs.push(rule.rule_ref)
    else softContributions.push({
      rule_ref: rule.rule_ref,
      derived_signal_code: rule.derived_signal_code,
      weight: rule.weight!,
      evidence_refs: canonicalRefs(evidenceRefs),
    })
  }

  for (const row of atomicRows) {
    const observations = input.atomic_signal_observations.filter((observation) => observation.atomic_signal_code === row.code)
    if (observations.length === 0) continue
    const mappings = policy.atomic_signal_rules.filter((rule) => rule.atomic_signal_code === row.code)
    if (mappings.length !== 1) return { ok: false, reason: 'missing_atomic_mapping' }
    const mapping = mappings[0]
    if (mapping.authority !== row.authority || mapping.derived_signal_code !== row.derived) return { ok: false, reason: 'atomic_mapping_mismatch' }
    if (observations.some((observation) => observation.authority !== row.authority)) return { ok: false, reason: 'atomic_authority_mismatch' }
    if (observations.some((observation) => observation.evidence_refs.some((ref) => !mapping.permitted_evidence_kinds.includes(ref.kind)))) return { ok: false, reason: 'evidence_kind_not_permitted' }
    const mappedRule = derivedRule(policy, 'atomic_signal', row.derived, row.signalClass)
    if (!mappedRule) return { ok: false, reason: 'missing_atomic_mapping' }

    const present = observations.filter((observation) => observation.presence === 'present')
    if (present.some((observation) => observation.evidence_refs.length === 0)) return { ok: false, reason: 'evidence_kind_not_permitted' }
    if (present.length > 0) {
      addSignal(mappedRule, present.flatMap((observation) => observation.evidence_refs))
      if (mappedRule.signal_class === 'hard_stop') hardAtomicRefs.push(mapping.rule_ref)
      else if (mappedRule.signal_class === 'forced_handoff') forcedAtomicRefs.push(mapping.rule_ref)
      else softAtomicRefs.push(mapping.rule_ref)
    }

    const unknown = observations.filter((observation) => observation.presence === 'unknown')
    if (unknown.length === 0) continue
    if (row.authority === 'authoritative') {
      if (unknown.some((observation) => observation.evidence_refs.length === 0)) return { ok: false, reason: 'evidence_kind_not_permitted' }
      const securityRule = derivedRule(policy, 'atomic_signal', 'security_boundary_uncertain', 'hard_stop')
      if (!securityRule) return { ok: false, reason: 'missing_security_rule' }
      addSignal(securityRule, unknown.flatMap((observation) => observation.evidence_refs))
      hardAtomicRefs.push(mapping.rule_ref)
      unknownAtomicRefs.push(mapping.rule_ref)
      unknownRuleRefs.push(policy.unknown_handling_rules.find((rule) => rule.evidence_class === 'authoritative_signal')!.rule_ref)
    } else {
      unknownAtomicRefs.push(mapping.rule_ref)
      unknownRuleRefs.push(policy.unknown_handling_rules.find((rule) => rule.evidence_class === 'advisory_signal')!.rule_ref)
      unknownAdvisoryCodes.push(row.derived)
    }
  }

  const applicableCoverageRules = policy.coverage_rules.filter((rule) => rule.applicable_checkpoint_types.includes(input.checkpoint.checkpoint_type))
  const coverageClasses = new Set<string>()
  for (const rule of applicableCoverageRules) {
    if (coverageClasses.has(rule.coverage_class)) return { ok: false, reason: 'duplicate_required_coverage_binding' }
    coverageClasses.add(rule.coverage_class)
  }
  const requiredCoverageClasses = new Set([
    ...checkpointRule.required_coverage_classes,
    ...applicableCoverageRules.filter((rule) => rule.required).map((rule) => rule.coverage_class),
  ])
  const coverage = input.canonical_record_coverage
  const coverageEvidence = (records: typeof coverage): CanonicalSourceRefV1[] => canonicalRefs(records.flatMap((record) => {
    if (record.verification_state === 'verified') return [record.source_provenance!.source_ref]
    if (record.verification_state === 'contradicted') return [record.claimed_ref!, record.observed_ref!]
    return [record.attempt!.source_ref]
  }))
  const workflowEvidence: CanonicalSourceRefV1[] = []
  let workflowInvalid = false
  for (const binding of Object.values(input.workflow_identity).filter((value): value is Exclude<ContextHealthEvaluationInputV1['workflow_identity'][keyof ContextHealthEvaluationInputV1['workflow_identity']], CanonicalSourceRefV1> => typeof value === 'object' && value !== null && 'state' in value)) {
    if (binding.state === 'unavailable') {
      workflowInvalid = true
      workflowEvidence.push(binding.attempt.source_ref)
    } else if (binding.state === 'bound' && binding.provenance.verification_state === 'contradicted') {
      workflowInvalid = true
      workflowEvidence.push(binding.provenance.source_ref)
    }
  }
  let requiredCoverageInvalid = false
  let missingRequiredCoverage = false
  let duplicateRequiredCoverage = false
  for (const coverageClass of requiredCoverageClasses) {
    const matches = coverage.filter((record) => record.coverage_class === coverageClass)
    if (matches.length === 0) missingRequiredCoverage = true
    if (matches.length > 1) duplicateRequiredCoverage = true
    if (matches.length !== 1 || matches[0].verification_state !== 'verified') requiredCoverageInvalid = true
  }
  const coverageHard = workflowInvalid || requiredCoverageInvalid || coverage.some((record) => record.verification_state === 'contradicted')
  if (coverageHard) {
    const rule = derivedRule(policy, 'coverage', 'security_boundary_uncertain', 'hard_stop')!
    addSignal(rule, [
      ...workflowEvidence,
      ...coverageEvidence(coverage),
      ...(missingRequiredCoverage || duplicateRequiredCoverage ? [input.checkpoint.protected_action_ref, policy.approval_record_ref] : []),
    ])
  }
  const optionalUnavailableCoverage = coverage.filter((record) => !requiredCoverageClasses.has(record.coverage_class) && record.verification_state === 'unavailable')
  const optionalCoverageRule = derivedRule(policy, 'coverage', 'nonmandatory_retrieval_failure', 'soft')
  if (optionalCoverageRule?.threshold.kind === 'count_at_least' && optionalUnavailableCoverage.length >= optionalCoverageRule.threshold.value) addSignal(optionalCoverageRule, coverageEvidence(optionalUnavailableCoverage))

  for (const rule of policy.derived_signal_rules.filter((candidate) => candidate.source_kind === 'counter')) {
    const threshold = rule.threshold
    if (threshold.kind !== 'count_at_least') return { ok: false, reason: 'invalid_threshold_kind_for_source' }
    let scalars: readonly number[] = []
    let records: readonly { readonly record_ref: CanonicalSourceRefV1; readonly count: number }[] = []
    if (rule.derived_signal_code === 'compression_pressure_observed') {
      scalars = [input.counter_snapshot.interaction_count, input.counter_snapshot.operation_count, input.counter_snapshot.dependency_count]
    } else if (rule.derived_signal_code === 'role_reconstruction_warning') {
      scalars = [input.counter_snapshot.unresolved_item_count, input.counter_snapshot.active_blocker_count, input.counter_snapshot.amendment_count, input.counter_snapshot.settled_fact_correction_count]
      records = input.counter_snapshot.settled_fact_reexplanation_counts
    } else {
      records = input.counter_snapshot.repeated_record_fetch_counts
    }
    const matchedRecords = records.filter((record) => record.count >= threshold.value)
    if (scalars.some((value) => value >= threshold.value) || matchedRecords.length > 0) addSignal(rule, matchedRecords.map((record) => record.record_ref))
  }

  const requiredValidationRefs = input.constraint_snapshot.required_validation_refs
  const validationMatches = (reference: CanonicalSourceRefV1, binding: ContextHealthEvaluationInputV1['validation_bindings'][number]): boolean => {
    if (binding.state === 'not_started' || binding.state === 'running') return sameRef(binding.validation_profile_ref, reference)
    if (binding.state === 'passed' || binding.state === 'failed') return sameRef(binding.result_ref, reference) || binding.evidence_refs.some((candidate) => sameRef(candidate, reference))
    if (binding.state === 'not_applicable') return sameRef(binding.basis_ref, reference)
    if (binding.state === 'unavailable') return sameRef(binding.attempt.source_ref, reference)
    return false
  }
  let requiredValidationInvalid = false
  for (const requiredRef of requiredValidationRefs) {
    const matches = input.validation_bindings.filter((binding) => validationMatches(requiredRef, binding))
    if (matches.length !== 1) requiredValidationInvalid = true
    else if (['not_started', 'running', 'failed', 'unavailable'].includes(matches[0].state)) requiredValidationInvalid = true
  }
  if (input.checkpoint.blocking_class === 'blocking' && requiredValidationInvalid) {
    addSignal(derivedRule(policy, 'validation', 'security_boundary_uncertain', 'hard_stop')!, [...requiredValidationRefs, input.checkpoint.protected_action_ref])
  }
  const optionalValidationBindings = input.validation_bindings.filter((binding) =>
    !requiredValidationRefs.some((reference) => validationMatches(reference, binding)) && (binding.state === 'failed' || binding.state === 'unavailable'))
  const optionalValidationRule = derivedRule(policy, 'validation', 'nonmandatory_retrieval_failure', 'soft')
  if (optionalValidationRule?.threshold.kind === 'count_at_least' && optionalValidationBindings.length >= optionalValidationRule.threshold.value) {
    addSignal(optionalValidationRule, optionalValidationBindings.flatMap((binding) => binding.state === 'failed' ? [binding.result_ref, ...binding.evidence_refs] : binding.state === 'unavailable' ? [binding.attempt.source_ref] : []))
  }

  const handoff = input.handoff_artifact
  const handoffEvidence: CanonicalSourceRefV1[] = handoff.state === 'none' ? [handoff.basis_ref]
    : handoff.state === 'draft' ? [handoff.draft_location_ref]
      : handoff.state === 'complete' ? [{ kind: 'content_addressed', content_ref: handoff.manifest_ref }, handoff.publication_record_ref, handoff.validation_ref]
        : handoff.state === 'invalid' ? [handoff.candidate_location_ref, handoff.attempt.source_ref]
          : [handoff.attempt.source_ref]
  if (handoff.state === 'invalid' || (input.checkpoint.checkpoint_type === 'post_result_handoff' && handoff.state !== 'complete')) addSignal(derivedRule(policy, 'handoff', 'security_boundary_uncertain', 'hard_stop')!, handoffEvidence)
  const optionalHandoffRule = derivedRule(policy, 'handoff', 'nonmandatory_retrieval_failure', 'soft')
  if (input.checkpoint.checkpoint_type !== 'post_result_handoff' && handoff.state === 'unavailable' && optionalHandoffRule?.threshold.kind === 'count_at_least' && optionalHandoffRule.threshold.value === 1) addSignal(optionalHandoffRule, handoffEvidence)

  let outcome: OutcomeV1
  let selectedAtomicRefs: string[]
  let selectedForcedRefs: string[] = []
  let selectedContributions: MutableContribution[] = []
  let softScore = 0
  if (hardRuleRefs.length > 0) {
    outcome = 'hard_stop_and_handoff'
    selectedAtomicRefs = hardAtomicRefs
  } else if (forcedRuleRefs.length > 0) {
    outcome = 'handoff_required'
    selectedAtomicRefs = forcedAtomicRefs
    selectedForcedRefs = [...new Set(forcedRuleRefs)].sort()
  } else {
    selectedContributions = [...new Map(softContributions.map((contribution) => [`${contribution.rule_ref}|${contribution.derived_signal_code}`, contribution])).values()]
      .sort((left, right) => compareCodeUnits(left.rule_ref, right.rule_ref) || compareCodeUnits(left.derived_signal_code, right.derived_signal_code))
    softScore = selectedContributions.reduce((total, contribution) => total + contribution.weight, 0)
    const scoredOutcome = scoreOutcome(softScore, policy)
    if (!scoredOutcome) return { ok: false, reason: 'policy_mismatch' }
    outcome = scoredOutcome
    selectedAtomicRefs = softAtomicRefs
  }
  selectedAtomicRefs = [...new Set([...selectedAtomicRefs, ...unknownAtomicRefs])].sort()

  const preEscalationOutcome = outcome
  const escalation = policy.consecutive_checkpoint_escalation
  let escalationEvaluation: ContextHealthDecisionV1['checkpoint_escalation_evaluation'] = {
    state: 'not_applicable',
    rule_ref: escalation.rule_ref,
    reason_code: 'pre_escalation_outcome_not_checkpoint_only',
    pre_escalation_outcome: outcome,
  }
  if (outcome === 'checkpoint_only') {
    if (escalation.state === 'disabled' || input.prior_checkpoint.state === 'unavailable') {
      escalationEvaluation = { state: 'not_applicable', rule_ref: escalation.rule_ref, reason_code: 'policy_not_evaluable', pre_escalation_outcome: outcome }
    } else {
      const priorDecisionRefs = input.prior_checkpoint.state === 'available' ? input.prior_checkpoint.prior_decision_refs : []
      const observedCount = input.prior_checkpoint.state === 'available' ? input.prior_checkpoint.consecutive_checkpoint_only : 0
      if (escalation.state === 'enabled' && observedCount >= escalation.consecutive_count_threshold) {
        outcome = escalation.escalation_outcome
        escalationEvaluation = {
          state: 'applied',
          rule_ref: escalation.rule_ref,
          pre_escalation_outcome: 'checkpoint_only',
          prior_decision_refs: priorDecisionRefs,
          observed_consecutive_count: escalation.consecutive_count_threshold,
          effective_outcome: 'handoff_required',
        }
      } else {
        escalationEvaluation = {
          state: 'not_applied',
          rule_ref: escalation.rule_ref,
          pre_escalation_outcome: 'checkpoint_only',
          prior_decision_refs: priorDecisionRefs,
          observed_consecutive_count: observedCount,
          effective_outcome: 'checkpoint_only',
        }
      }
    }
  }

  let overrideEvaluation: ContextHealthDecisionV1['operator_override_evaluation'] = { state: 'absent' }
  if (input.operator_override.state === 'bound') {
    const override = input.operator_override
    if (!policy.override_rule.allowed_actor_roles.includes(override.actor_role) || !policy.override_rule.allowed_minimum_outcomes.includes(override.minimum_outcome) || policy.override_rule.deescalation_allowed) return { ok: false, reason: 'policy_mismatch' }
    const effectiveOutcome = maxOutcome(outcome, override.minimum_outcome)
    overrideEvaluation = {
      state: effectiveOutcome === outcome ? 'not_applied' : 'applied',
      override_ref: override.override_ref,
      actor_role: override.actor_role,
      authority_result: 'authorized',
      requested_minimum_outcome: override.minimum_outcome,
      pre_override_outcome: outcome,
      effective_outcome: effectiveOutcome,
      override_rule_ref: policy.override_rule.rule_ref,
      reason_code: effectiveOutcome === outcome ? 'already_at_or_above_minimum' : override.reason_code,
    }
    outcome = effectiveOutcome
  }

  const decisionCandidate: ContextHealthDecisionV1 = {
    contract_version: 'context-health-decision-v1',
    context_health_decision_ref: `evidence/context-health-decisions/sha256-${'0'.repeat(64)}`,
    context_health_input_ref: input.context_health_input_ref,
    context_health_policy_ref: policy.context_health_policy_ref,
    task_id: input.task_id,
    assignment_revision: input.assignment_revision,
    role: input.role,
    repository: input.repository,
    workflow_phase: input.workflow_phase,
    checkpoint_instance_id: input.checkpoint.checkpoint_instance_id,
    checkpoint_type: input.checkpoint.checkpoint_type,
    outcome,
    legal_action_class: outcome === 'continue' || outcome === 'checkpoint_only' ? 'assigned_work_allowed' : outcome === 'handoff_required' ? 'handoff_required' : 'hard_stop',
    required_artifact_class: outcome === 'continue' ? 'decision_record' : 'context_handoff_manifest',
    checkpoint_rule_ref: checkpointRule.rule_ref,
    applied_atomic_signal_rule_refs: selectedAtomicRefs,
    applied_coverage_rule_refs: applicableCoverageRules.map((rule) => rule.rule_ref).sort(),
    hard_rule_refs: hardRuleRefs.length > 0 ? [...new Set(hardRuleRefs)].sort() : [],
    forced_handoff_rule_refs: hardRuleRefs.length > 0 ? [] : selectedForcedRefs,
    soft_contributions: hardRuleRefs.length > 0 || forcedRuleRefs.length > 0 ? [] : selectedContributions,
    applied_unknown_handling_rule_refs: [...new Set(unknownRuleRefs)].sort(),
    checkpoint_escalation_evaluation: escalationEvaluation,
    operator_override_evaluation: overrideEvaluation,
    unknown_advisory_signal_codes: [...new Set(unknownAdvisoryCodes)].sort() as ContextHealthDecisionV1['unknown_advisory_signal_codes'],
    prior_decision_refs: input.prior_checkpoint.state === 'available' ? input.prior_checkpoint.prior_decision_refs : [],
    soft_score: hardRuleRefs.length > 0 || forcedRuleRefs.length > 0 ? 0 : softScore,
    evaluator_contract_version: 'context-health-evaluator-v1',
    evaluation_timestamp: input.evaluation_timestamp,
  }
  const decision: ContextHealthDecisionV1 = { ...decisionCandidate, context_health_decision_ref: await generateContextHealthDecisionRef(decisionCandidate) }
  if (!validateContextHealthDecisionV1(decision, observedAt).accepted) return { ok: false, reason: 'policy_mismatch' }
  if (!validateContextHealthDecisionSemantics(decision, policy).valid) return { ok: false, reason: 'rule_reference_unresolved' }
  if (!(await verifyContextHealthReference(decision))) return { ok: false, reason: 'policy_mismatch' }
  if (preEscalationOutcome === 'hard_stop_and_handoff' && outcome !== 'hard_stop_and_handoff') return { ok: false, reason: 'policy_mismatch' }
  return { ok: true, decision: deepFreezeClone(decision) }
}
