const at = '2026-07-20T10:45:00.000Z'
const later = '2026-07-20T10:46:00.000Z'
const sha = (character) => character.repeat(64)
const policyPlaceholder = `policies/context-health/sha256-${sha('0')}`
const inputPlaceholder = `evidence/context-health-inputs/sha256-${sha('0')}`
const decisionRef = (character) => `evidence/context-health-decisions/sha256-${sha(character)}`
const github = (number) => ({ kind: 'github', url: `https://github.com/whatrune/sd-prompt-studio/issues/${number}` })
const taskSource = github(158)
const dispatchSource = github(159)
const approvalSource = github(160)
const protectedActionSource = github(161)
const optionalCoverageA = github(162)
const optionalCoverageB = github(163)
const optionalValidationResult = github(164)
const optionalValidationEvidence = github(165)
const handoffAttemptSource = github(166)
const atomicEvidenceA = github(167)
const atomicEvidenceB = github(168)

const provenance = (number, verification_state = 'verified') => ({
  provenance_id: `provenance-${number}`,
  source_ref: github(number),
  source_kind: 'github',
  observed_at: at,
  verification_state,
  immutable_revision: { kind: 'github_database_id', github_database_id: number },
})

const bound = (value, number) => ({ state: 'bound', observed_at: at, value, provenance: provenance(number) })
const workflowIdentity = () => ({
  canonical_task_record: taskSource,
  dispatch_record: dispatchSource,
  issue_binding: bound('https://github.com/whatrune/sd-prompt-studio/issues/158', 201),
  pr_binding: bound('https://github.com/whatrune/sd-prompt-studio/pull/159', 202),
  branch_binding: bound('codex/implement-pure-context-health-evaluator', 203),
  worktree_binding: bound('.worktrees/pure-context-health-evaluator', 204),
  head_binding: bound('a'.repeat(40), 205),
  execution_binding: bound('pure-evaluator-execution', 206),
})

const sourceAttempt = (attempt_id, source_ref) => ({
  attempt_id,
  source_ref,
  attempted_at: at,
  method: 'github_api',
  failure_reason: 'not_found',
  safe_diagnostic_code: 'source_not_found',
})

const verifiedCoverage = (coverage_id = 'coverage-task') => ({
  coverage_id,
  coverage_class: 'task_assignment',
  verification_state: 'verified',
  source_provenance: provenance(210),
  claimed_ref: taskSource,
  observed_ref: taskSource,
})

const unavailableCoverage = (coverage_id, coverage_class, source_ref) => ({
  coverage_id,
  coverage_class,
  verification_state: 'unavailable',
  attempt: sourceAttempt(`attempt-${coverage_id}`, source_ref),
})

const atomicRows = [
  ['operator_hard_stop_event', 'authoritative', 'operator_hard_stop', 'hard_stop'],
  ['operator_handoff_event', 'authoritative', 'operator_handoff', 'forced_handoff'],
  ['user_context_limit_event', 'authoritative', 'context_limit', 'forced_handoff'],
  ['compression_event', 'advisory', 'compression_pressure_observed', 'soft'],
  ['role_reconstruction_warning_event', 'advisory', 'role_reconstruction_warning', 'soft'],
  ['security_uncertainty_event', 'authoritative', 'security_boundary_uncertain', 'hard_stop'],
  ['nonmandatory_retrieval_failure_event', 'advisory', 'nonmandatory_retrieval_failure', 'soft'],
]

const hardRule = (rule_ref, source_kind, derived_signal_code) => ({ rule_ref, source_kind, derived_signal_code, signal_class: 'hard_stop', threshold: { kind: 'none' } })
const forcedRule = (rule_ref, derived_signal_code) => ({ rule_ref, source_kind: 'atomic_signal', derived_signal_code, signal_class: 'forced_handoff', threshold: { kind: 'none' } })
const softRule = (rule_ref, source_kind, derived_signal_code, weight, threshold = { kind: 'none' }) => ({ rule_ref, source_kind, derived_signal_code, signal_class: 'soft', threshold, weight })

const rules = {
  checkpoint: 'rules/context-health/checkpoint/pre-review',
  checkpointPostHandoff: 'rules/context-health/checkpoint/post-result-handoff',
  atomicHard: 'rules/context-health/derived-signal/atomic-hard-stop',
  atomicForced: 'rules/context-health/derived-signal/atomic-forced-handoff',
  atomicContextLimit: 'rules/context-health/derived-signal/atomic-context-limit',
  atomicCompression: 'rules/context-health/derived-signal/atomic-compression',
  atomicRole: 'rules/context-health/derived-signal/atomic-role-reconstruction',
  atomicSecurity: 'rules/context-health/derived-signal/atomic-security',
  atomicRetrieval: 'rules/context-health/derived-signal/atomic-retrieval',
  coverageHard: 'rules/context-health/derived-signal/coverage-security',
  coverageSoft: 'rules/context-health/derived-signal/coverage-retrieval',
  counterCompression: 'rules/context-health/derived-signal/counter-compression',
  counterRole: 'rules/context-health/derived-signal/counter-role-reconstruction',
  counterRetrieval: 'rules/context-health/derived-signal/counter-retrieval',
  validationHard: 'rules/context-health/derived-signal/validation-security',
  validationSoft: 'rules/context-health/derived-signal/validation-retrieval',
  handoffHard: 'rules/context-health/derived-signal/handoff-security',
  handoffSoft: 'rules/context-health/derived-signal/handoff-retrieval',
  coverage: 'rules/context-health/coverage/task-assignment',
  escalation: 'rules/context-health/escalation/checkpoint-only',
  override: 'rules/context-health/override/restrictive',
  unknownAuthoritative: 'rules/context-health/unknown-handling/authoritative',
  unknownAdvisory: 'rules/context-health/unknown-handling/advisory',
}

const basePolicy = () => ({
  contract_version: 'context-health-policy-v1',
  context_health_policy_ref: policyPlaceholder,
  policy_revision: 'policy-revision-1',
  lifecycle_status: 'approved',
  evaluator_contract_version: 'context-health-evaluator-v1',
  checkpoint_rules: [
    { rule_ref: rules.checkpoint, checkpoint_type: 'pre_review', blocking_class: 'blocking', required_coverage_classes: ['task_assignment'], protected_action_required: true },
    { rule_ref: rules.checkpointPostHandoff, checkpoint_type: 'post_result_handoff', blocking_class: 'blocking', required_coverage_classes: ['task_assignment'], protected_action_required: true },
  ],
  atomic_signal_rules: atomicRows.map(([atomic_signal_code, authority, derived_signal_code]) => ({
    rule_ref: `rules/context-health/atomic-signal/${atomic_signal_code.replaceAll('_event', '').replaceAll('_', '-')}`,
    atomic_signal_code,
    authority,
    permitted_evidence_kinds: ['github'],
    derived_signal_code,
  })),
  derived_signal_rules: [
    hardRule(rules.atomicHard, 'atomic_signal', 'operator_hard_stop'),
    forcedRule(rules.atomicForced, 'operator_handoff'),
    forcedRule(rules.atomicContextLimit, 'context_limit'),
    softRule(rules.atomicCompression, 'atomic_signal', 'compression_pressure_observed', 2),
    softRule(rules.atomicRole, 'atomic_signal', 'role_reconstruction_warning', 3),
    hardRule(rules.atomicSecurity, 'atomic_signal', 'security_boundary_uncertain'),
    softRule(rules.atomicRetrieval, 'atomic_signal', 'nonmandatory_retrieval_failure', 1),
    hardRule(rules.coverageHard, 'coverage', 'security_boundary_uncertain'),
    softRule(rules.coverageSoft, 'coverage', 'nonmandatory_retrieval_failure', 4, { kind: 'count_at_least', value: 2 }),
    softRule(rules.counterCompression, 'counter', 'compression_pressure_observed', 3, { kind: 'count_at_least', value: 3 }),
    softRule(rules.counterRole, 'counter', 'role_reconstruction_warning', 4, { kind: 'count_at_least', value: 2 }),
    softRule(rules.counterRetrieval, 'counter', 'nonmandatory_retrieval_failure', 5, { kind: 'count_at_least', value: 2 }),
    hardRule(rules.validationHard, 'validation', 'security_boundary_uncertain'),
    softRule(rules.validationSoft, 'validation', 'nonmandatory_retrieval_failure', 6, { kind: 'count_at_least', value: 1 }),
    hardRule(rules.handoffHard, 'handoff', 'security_boundary_uncertain'),
    softRule(rules.handoffSoft, 'handoff', 'nonmandatory_retrieval_failure', 7, { kind: 'count_at_least', value: 1 }),
  ],
  outcome_thresholds: { continue_min: 0, continue_max: 2, checkpoint_only_min: 3, checkpoint_only_max: 5, handoff_required_min: 6 },
  consecutive_checkpoint_escalation: { rule_ref: rules.escalation, state: 'enabled', source_outcome: 'checkpoint_only', consecutive_count_threshold: 2, escalation_outcome: 'handoff_required', reset_outcomes: ['continue', 'handoff_required', 'hard_stop_and_handoff'] },
  unknown_handling_rules: [
    { rule_ref: rules.unknownAuthoritative, evidence_class: 'authoritative_signal', handling: 'block' },
    { rule_ref: rules.unknownAdvisory, evidence_class: 'advisory_signal', handling: 'report_without_score' },
    { rule_ref: 'rules/context-health/unknown-handling/coverage', evidence_class: 'coverage', handling: 'block' },
    { rule_ref: 'rules/context-health/unknown-handling/validation', evidence_class: 'validation', handling: 'block' },
    { rule_ref: 'rules/context-health/unknown-handling/handoff', evidence_class: 'handoff', handling: 'block' },
  ],
  override_rule: { rule_ref: rules.override, allowed_actor_roles: ['product_owner'], allowed_minimum_outcomes: ['checkpoint_only', 'handoff_required', 'hard_stop_and_handoff'], deescalation_allowed: false },
  coverage_rules: [{ rule_ref: rules.coverage, coverage_class: 'task_assignment', applicable_checkpoint_types: ['pre_review', 'post_result_handoff'], required: true }],
  approved_by_roles: ['architect_team'],
  approval_record_ref: approvalSource,
  created_at: at,
})

const zeroCounters = () => ({
  interaction_count: 0,
  operation_count: 0,
  unresolved_item_count: 0,
  active_blocker_count: 0,
  amendment_count: 0,
  settled_fact_correction_count: 0,
  dependency_count: 0,
  repeated_record_fetch_counts: [],
  settled_fact_reexplanation_counts: [],
})

const baseInput = (policy_ref) => ({
  contract_version: 'context-health-evaluation-input-v1',
  context_health_input_ref: inputPlaceholder,
  policy_ref,
  task_id: 'IMPLEMENT-PURE-CONTEXT-HEALTH-EVALUATOR-001',
  assignment_revision: 1,
  role: 'backend_implementer',
  repository: 'whatrune/sd-prompt-studio',
  workflow_phase: 'implementation',
  checkpoint: { checkpoint_instance_id: 'checkpoint-1', checkpoint_type: 'pre_review', blocking_class: 'blocking', protected_action_ref: protectedActionSource },
  workflow_identity: workflowIdentity(),
  constraint_snapshot: { allowed_change_refs: [taskSource], forbidden_change_refs: [taskSource], required_validation_refs: [], security_policy_refs: [approvalSource], approval_gate_refs: [approvalSource] },
  counter_snapshot: zeroCounters(),
  atomic_signal_observations: [],
  canonical_record_coverage: [verifiedCoverage()],
  validation_bindings: [],
  handoff_artifact: { state: 'none', observed_at: at, basis_ref: taskSource },
  prior_checkpoint: { state: 'none', first_checkpoint_basis_ref: taskSource },
  operator_override: { state: 'absent' },
  evaluation_timestamp: at,
})

const observation = (observation_id, atomic_signal_code, authority, presence = 'present', evidence_refs = [atomicEvidenceA]) => ({ observation_id, atomic_signal_code, presence, authority, evidence_refs, observed_at: at })

export {
  approvalSource,
  at,
  atomicEvidenceA,
  atomicEvidenceB,
  baseInput,
  basePolicy,
  decisionRef,
  github,
  handoffAttemptSource,
  later,
  observation,
  optionalCoverageA,
  optionalCoverageB,
  optionalValidationEvidence,
  optionalValidationResult,
  protectedActionSource,
  rules,
  sha,
  sourceAttempt,
  taskSource,
  unavailableCoverage,
}
