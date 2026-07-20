import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
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

export { basePolicy, baseInput, observation, at, taskSource, protectedActionSource }

try {
  const contract = await server.ssrLoadModule('/src/context-health/index.ts')
  const evaluator = await server.ssrLoadModule('/src/context-health/evaluator.ts')
  const {
    generateContextHealthPolicyRef,
    generateContextHealthInputRef,
    generateContextHealthDecisionRef,
    validateContextHealthPolicyV1,
    validateContextHealthEvaluationInputV1,
    validateContextHealthDecisionV1,
    validateContextHealthDecisionSemantics,
    verifyContextHealthReference,
  } = contract
  const evaluate = evaluator.evaluateContextHealthV1

  const makePolicy = async (mutate = () => {}) => {
    const candidate = basePolicy()
    mutate(candidate)
    candidate.context_health_policy_ref = await generateContextHealthPolicyRef(candidate)
    return candidate
  }
  const makeInput = async (policy, mutate = () => {}) => {
    const candidate = baseInput(policy.context_health_policy_ref)
    mutate(candidate)
    candidate.context_health_input_ref = await generateContextHealthInputRef(candidate)
    return candidate
  }
  const run = async (inputMutation = () => {}, policyMutation = () => {}) => {
    const policy = await makePolicy(policyMutation)
    const input = await makeInput(policy, inputMutation)
    assert.equal(validateContextHealthPolicyV1(policy, at).accepted, true, 'fixture Policy must be structurally admitted')
    assert.equal(validateContextHealthEvaluationInputV1(input, at).accepted, true, 'fixture Input must be structurally admitted')
    return { policy, input, result: await evaluate(input, policy) }
  }
  const expectDecision = async (inputMutation, expectedOutcome, policyMutation = () => {}) => {
    const execution = await run(inputMutation, policyMutation)
    assert.equal(execution.result.ok, true, `expected admitted ${expectedOutcome} Decision`)
    assert.equal(execution.result.decision.outcome, expectedOutcome)
    assert.equal(validateContextHealthDecisionV1(execution.result.decision, at).accepted, true)
    assert.equal(validateContextHealthDecisionSemantics(execution.result.decision, execution.policy).valid, true)
    assert.equal(await verifyContextHealthReference(execution.result.decision), true)
    return { ...execution, decision: execution.result.decision }
  }

  assert.equal((await evaluate({}, {})).ok, false, 'malformed admission fails closed')
  assert.equal((await evaluate({ evaluation_timestamp: at }, {})).ok, false, 'partial input fails closed')

  const healthy = await expectDecision(() => {}, 'continue')
  assert.equal(healthy.decision.soft_score, 0)
  assert.equal(healthy.decision.legal_action_class, 'assigned_work_allowed')
  assert.equal(healthy.decision.required_artifact_class, 'decision_record')
  assert.equal(healthy.decision.checkpoint_rule_ref, rules.checkpoint)
  assert.deepEqual(healthy.decision.applied_coverage_rule_refs, [rules.coverage])

  const atomicSoft = await expectDecision((input) => { input.atomic_signal_observations = [observation('atomic-soft', 'compression_event', 'advisory', 'present', [atomicEvidenceB, atomicEvidenceA])] }, 'continue')
  assert.equal(atomicSoft.decision.soft_score, 2)
  assert.deepEqual(atomicSoft.decision.soft_contributions, [{ rule_ref: rules.atomicCompression, derived_signal_code: 'compression_pressure_observed', weight: 2, evidence_refs: [atomicEvidenceA, atomicEvidenceB] }])
  const atomicRoleSoft = await expectDecision((input) => { input.atomic_signal_observations = [observation('atomic-role-soft', 'role_reconstruction_warning_event', 'advisory')] }, 'checkpoint_only')
  assert.deepEqual(atomicRoleSoft.decision.soft_contributions.map((contribution) => [contribution.rule_ref, contribution.weight]), [[rules.atomicRole, 3]])
  const atomicRetrievalSoft = await expectDecision((input) => { input.atomic_signal_observations = [observation('atomic-retrieval-soft', 'nonmandatory_retrieval_failure_event', 'advisory')] }, 'continue')
  assert.deepEqual(atomicRetrievalSoft.decision.soft_contributions.map((contribution) => [contribution.rule_ref, contribution.weight]), [[rules.atomicRetrieval, 1]])

  const atomicForced = await expectDecision((input) => { input.atomic_signal_observations = [observation('atomic-forced', 'operator_handoff_event', 'authoritative')] }, 'handoff_required')
  assert.deepEqual(atomicForced.decision.forced_handoff_rule_refs, [rules.atomicForced])
  assert.equal(atomicForced.decision.legal_action_class, 'handoff_required')
  assert.equal(atomicForced.decision.required_artifact_class, 'context_handoff_manifest')
  const atomicContextLimit = await expectDecision((input) => { input.atomic_signal_observations = [observation('atomic-context-limit', 'user_context_limit_event', 'authoritative')] }, 'handoff_required')
  assert.deepEqual(atomicContextLimit.decision.forced_handoff_rule_refs, [rules.atomicContextLimit])

  const atomicHard = await expectDecision((input) => { input.atomic_signal_observations = [observation('atomic-hard', 'operator_hard_stop_event', 'authoritative')] }, 'hard_stop_and_handoff')
  assert.deepEqual(atomicHard.decision.hard_rule_refs, [rules.atomicHard])
  assert.equal(atomicHard.decision.legal_action_class, 'hard_stop')
  const atomicSecurity = await expectDecision((input) => { input.atomic_signal_observations = [observation('atomic-security', 'security_uncertainty_event', 'authoritative')] }, 'hard_stop_and_handoff')
  assert.deepEqual(atomicSecurity.decision.hard_rule_refs, [rules.atomicSecurity])

  const coverageSoft = await expectDecision((input) => {
    input.canonical_record_coverage.push(unavailableCoverage('optional-a', 'approval_record', optionalCoverageB), unavailableCoverage('optional-b', 'validation_record', optionalCoverageA))
  }, 'checkpoint_only')
  assert.deepEqual(coverageSoft.decision.soft_contributions, [{ rule_ref: rules.coverageSoft, derived_signal_code: 'nonmandatory_retrieval_failure', weight: 4, evidence_refs: [optionalCoverageA, optionalCoverageB] }])

  const coverageHard = await expectDecision((input) => { input.canonical_record_coverage = [] }, 'hard_stop_and_handoff')
  assert.deepEqual(coverageHard.decision.hard_rule_refs, [rules.coverageHard])

  const counterSoft = await expectDecision((input) => { input.counter_snapshot.operation_count = 3 }, 'checkpoint_only')
  assert.deepEqual(counterSoft.decision.soft_contributions, [{ rule_ref: rules.counterCompression, derived_signal_code: 'compression_pressure_observed', weight: 3, evidence_refs: [] }])
  const counterRoleEvidence = github(174)
  const counterRoleSoft = await expectDecision((input) => {
    input.counter_snapshot.unresolved_item_count = 2
    input.counter_snapshot.settled_fact_reexplanation_counts = [{ record_ref: counterRoleEvidence, count: 3 }]
  }, 'checkpoint_only')
  assert.deepEqual(counterRoleSoft.decision.soft_contributions, [{ rule_ref: rules.counterRole, derived_signal_code: 'role_reconstruction_warning', weight: 4, evidence_refs: [counterRoleEvidence] }], 'multiple matching units contribute one exact weight')
  const counterRetrievalEvidence = github(175)
  const counterRetrievalSoft = await expectDecision((input) => { input.counter_snapshot.repeated_record_fetch_counts = [{ record_ref: counterRetrievalEvidence, count: 2 }] }, 'checkpoint_only')
  assert.deepEqual(counterRetrievalSoft.decision.soft_contributions, [{ rule_ref: rules.counterRetrieval, derived_signal_code: 'nonmandatory_retrieval_failure', weight: 5, evidence_refs: [counterRetrievalEvidence] }])

  const validationSoft = await expectDecision((input) => {
    input.validation_bindings = [{ validation_id: 'validation-optional', state: 'failed', observed_at: at, result_ref: optionalValidationResult, completed_at: at, evidence_refs: [optionalValidationEvidence] }]
  }, 'handoff_required')
  assert.deepEqual(validationSoft.decision.soft_contributions[0].evidence_refs, [optionalValidationResult, optionalValidationEvidence])
  assert.equal(validationSoft.decision.soft_contributions[0].rule_ref, rules.validationSoft)

  const requiredValidationRef = github(169)
  const validationHard = await expectDecision((input) => {
    input.constraint_snapshot.required_validation_refs = [requiredValidationRef]
    input.validation_bindings = [{ validation_id: 'validation-required', state: 'failed', observed_at: at, result_ref: requiredValidationRef, completed_at: at, evidence_refs: [] }]
  }, 'hard_stop_and_handoff')
  assert.deepEqual(validationHard.decision.hard_rule_refs, [rules.validationHard])

  const handoffSoft = await expectDecision((input) => { input.handoff_artifact = { state: 'unavailable', observed_at: at, attempt: sourceAttempt('handoff-unavailable', handoffAttemptSource) } }, 'handoff_required')
  assert.deepEqual(handoffSoft.decision.soft_contributions, [{ rule_ref: rules.handoffSoft, derived_signal_code: 'nonmandatory_retrieval_failure', weight: 7, evidence_refs: [handoffAttemptSource] }])

  const handoffHard = await expectDecision((input) => { input.handoff_artifact = { state: 'invalid', observed_at: at, candidate_location_ref: github(170), attempt: sourceAttempt('handoff-invalid', handoffAttemptSource) } }, 'hard_stop_and_handoff')
  assert.deepEqual(handoffHard.decision.hard_rule_refs, [rules.handoffHard])
  const postHandoffDraft = await expectDecision((input) => {
    input.checkpoint = { ...input.checkpoint, checkpoint_type: 'post_result_handoff' }
    input.handoff_artifact = { state: 'draft', observed_at: at, draft_location_ref: github(178) }
  }, 'hard_stop_and_handoff')
  assert.deepEqual(postHandoffDraft.decision.hard_rule_refs, [rules.handoffHard])
  const postHandoffComplete = await expectDecision((input) => {
    input.checkpoint = { ...input.checkpoint, checkpoint_type: 'post_result_handoff' }
    input.handoff_artifact = { state: 'complete', observed_at: at, manifest_ref: `evidence/context-handoffs/sha256-${sha('a')}`, publication_record_ref: github(179), validation_ref: github(180) }
  }, 'continue')
  assert.deepEqual(postHandoffComplete.decision.hard_rule_refs, [])

  const precedence = await expectDecision((input) => {
    input.atomic_signal_observations = [
      observation('hard', 'operator_hard_stop_event', 'authoritative'),
      observation('forced', 'operator_handoff_event', 'authoritative'),
      observation('soft', 'compression_event', 'advisory'),
    ]
    input.counter_snapshot.operation_count = 3
  }, 'hard_stop_and_handoff')
  assert.deepEqual(precedence.decision.forced_handoff_rule_refs, [])
  assert.deepEqual(precedence.decision.soft_contributions, [])
  assert.equal(precedence.decision.soft_score, 0)

  const forcedPrecedence = await expectDecision((input) => {
    input.atomic_signal_observations = [observation('forced', 'operator_handoff_event', 'authoritative'), observation('soft', 'compression_event', 'advisory')]
  }, 'handoff_required')
  assert.deepEqual(forcedPrecedence.decision.soft_contributions, [])
  assert.equal(forcedPrecedence.decision.soft_score, 0)

  const authoritativeUnknown = await expectDecision((input) => { input.atomic_signal_observations = [observation('unknown-authoritative', 'security_uncertainty_event', 'authoritative', 'unknown')] }, 'hard_stop_and_handoff')
  assert.deepEqual(authoritativeUnknown.decision.hard_rule_refs, [rules.atomicSecurity])
  assert.deepEqual(authoritativeUnknown.decision.applied_unknown_handling_rule_refs, [rules.unknownAuthoritative])

  const advisoryUnknown = await expectDecision((input) => { input.atomic_signal_observations = [observation('unknown-advisory', 'compression_event', 'advisory', 'unknown')] }, 'continue')
  assert.deepEqual(advisoryUnknown.decision.unknown_advisory_signal_codes, ['compression_pressure_observed'])
  assert.deepEqual(advisoryUnknown.decision.applied_unknown_handling_rule_refs, [rules.unknownAdvisory])
  assert.equal(advisoryUnknown.decision.soft_score, 0)

  const belowEscalation = await expectDecision((input) => {
    input.counter_snapshot.operation_count = 3
    input.prior_checkpoint = { state: 'available', prior_decision_refs: [decisionRef('1')], prior_source_refs: [taskSource], consecutive_checkpoint_only: 1 }
  }, 'checkpoint_only')
  assert.equal(belowEscalation.decision.checkpoint_escalation_evaluation.state, 'not_applied')
  assert.equal(belowEscalation.decision.checkpoint_escalation_evaluation.observed_consecutive_count, 1)

  const exactEscalation = await expectDecision((input) => {
    input.counter_snapshot.operation_count = 3
    input.prior_checkpoint = { state: 'available', prior_decision_refs: [decisionRef('1'), decisionRef('2')], prior_source_refs: [taskSource], consecutive_checkpoint_only: 2 }
  }, 'handoff_required')
  assert.equal(exactEscalation.decision.checkpoint_escalation_evaluation.state, 'applied')
  assert.deepEqual(exactEscalation.decision.prior_decision_refs, [decisionRef('1'), decisionRef('2')])

  const resetOutcome = await expectDecision((input) => { input.prior_checkpoint = { state: 'available', prior_decision_refs: [decisionRef('1'), decisionRef('2')], prior_source_refs: [taskSource], consecutive_checkpoint_only: 2 } }, 'continue')
  assert.equal(resetOutcome.decision.checkpoint_escalation_evaluation.state, 'not_applicable')
  const unavailableHistory = await expectDecision((input) => {
    input.counter_snapshot.operation_count = 3
    input.prior_checkpoint = { state: 'unavailable', attempt: sourceAttempt('prior-unavailable', github(176)) }
  }, 'checkpoint_only')
  assert.equal(unavailableHistory.decision.checkpoint_escalation_evaluation.state, 'not_applicable')
  assert.equal(unavailableHistory.decision.checkpoint_escalation_evaluation.reason_code, 'policy_not_evaluable')
  assert.deepEqual(unavailableHistory.decision.prior_decision_refs, [])

  const disabledEscalation = await expectDecision((input) => {
    input.counter_snapshot.operation_count = 3
    input.prior_checkpoint = { state: 'available', prior_decision_refs: [decisionRef('1'), decisionRef('2')], prior_source_refs: [taskSource], consecutive_checkpoint_only: 2 }
  }, 'checkpoint_only', (policy) => { policy.consecutive_checkpoint_escalation = { rule_ref: rules.escalation, state: 'disabled', disabled_reason_code: 'architect_disabled', disabled_approval_ref: approvalSource } })
  assert.equal(disabledEscalation.decision.checkpoint_escalation_evaluation.state, 'not_applicable')

  const restrictiveOverride = await expectDecision((input) => { input.operator_override = { state: 'bound', override_ref: github(171), actor_role: 'product_owner', minimum_outcome: 'handoff_required', reason_code: 'operator_requested_handoff', issued_at: at } }, 'handoff_required')
  assert.equal(restrictiveOverride.decision.operator_override_evaluation.state, 'applied')
  assert.equal(restrictiveOverride.decision.operator_override_evaluation.pre_override_outcome, 'continue')

  const equalOverride = await expectDecision((input) => {
    input.atomic_signal_observations = [observation('equal-override', 'operator_handoff_event', 'authoritative')]
    input.operator_override = { state: 'bound', override_ref: github(177), actor_role: 'product_owner', minimum_outcome: 'handoff_required', reason_code: 'operator_requested_handoff', issued_at: at }
  }, 'handoff_required')
  assert.equal(equalOverride.decision.operator_override_evaluation.state, 'not_applied')
  assert.equal(equalOverride.decision.operator_override_evaluation.effective_outcome, 'handoff_required')

  const noDowngrade = await expectDecision((input) => {
    input.atomic_signal_observations = [observation('hard-no-downgrade', 'operator_hard_stop_event', 'authoritative')]
    input.operator_override = { state: 'bound', override_ref: github(172), actor_role: 'product_owner', minimum_outcome: 'checkpoint_only', reason_code: 'operator_requested_checkpoint', issued_at: at }
  }, 'hard_stop_and_handoff')
  assert.equal(noDowngrade.decision.operator_override_evaluation.state, 'not_applied')
  assert.equal(noDowngrade.decision.operator_override_evaluation.effective_outcome, 'hard_stop_and_handoff')

  const equivalentA = await expectDecision((input) => { input.atomic_signal_observations = [observation('deterministic', 'compression_event', 'advisory', 'present', [atomicEvidenceA, atomicEvidenceB])] }, 'continue')
  const equivalentB = await expectDecision((input) => { input.atomic_signal_observations = [observation('deterministic', 'compression_event', 'advisory', 'present', [atomicEvidenceB, atomicEvidenceA])] }, 'continue')
  assert.deepEqual(equivalentA.decision, equivalentB.decision, 'set ordering must not change semantic Decision')
  assert.equal(equivalentA.decision.context_health_decision_ref, equivalentB.decision.context_health_decision_ref)
  const alternateSelf = { ...structuredClone(equivalentA.decision), context_health_decision_ref: decisionRef('f') }
  assert.equal(await generateContextHealthDecisionRef(alternateSelf), equivalentA.decision.context_health_decision_ref, 'Decision self-reference is excluded only by the frozen projection')

  const changedTimestamp = await expectDecision((input) => { input.evaluation_timestamp = later }, 'continue')
  assert.notEqual(changedTimestamp.decision.context_health_decision_ref, healthy.decision.context_health_decision_ref)
  const reversedHistory = await expectDecision((input) => { input.prior_checkpoint = { state: 'available', prior_decision_refs: [decisionRef('2'), decisionRef('1')], prior_source_refs: [taskSource], consecutive_checkpoint_only: 0 } }, 'continue')
  const forwardHistory = await expectDecision((input) => { input.prior_checkpoint = { state: 'available', prior_decision_refs: [decisionRef('1'), decisionRef('2')], prior_source_refs: [taskSource], consecutive_checkpoint_only: 0 } }, 'continue')
  assert.notEqual(reversedHistory.decision.context_health_decision_ref, forwardHistory.decision.context_health_decision_ref, 'chronological prior Decision refs remain order-significant')

  const mutablePolicy = await makePolicy()
  const mutableInput = await makeInput(mutablePolicy, (input) => { input.atomic_signal_observations = [observation('immutable', 'compression_event', 'advisory')] })
  const immutableResult = await evaluate(mutableInput, mutablePolicy)
  assert.equal(immutableResult.ok, true)
  mutableInput.atomic_signal_observations[0].evidence_refs.push(github(999))
  mutablePolicy.derived_signal_rules.find((rule) => rule.rule_ref === rules.atomicCompression).weight = 99
  assert.equal(immutableResult.decision.soft_score, 2, 'caller aliases cannot mutate the returned Decision')
  assert(Object.isFrozen(immutableResult.decision))
  assert(Object.isFrozen(immutableResult.decision.soft_contributions))
  assert(Object.isFrozen(immutableResult.decision.soft_contributions[0].evidence_refs))

  const mismatchPolicy = await makePolicy((policy) => { policy.policy_revision = 'policy-revision-2' })
  assert.deepEqual(await evaluate(healthy.input, mismatchPolicy), { ok: false, reason: 'policy_mismatch' })

  const incompletePolicy = await makePolicy((policy) => { policy.derived_signal_rules = policy.derived_signal_rules.filter((rule) => rule.rule_ref !== rules.coverageHard) })
  const incompleteInput = await makeInput(incompletePolicy)
  assert.deepEqual(await evaluate(incompleteInput, incompletePolicy), { ok: false, reason: 'missing_security_rule' })

  const duplicateTuplePolicy = await makePolicy((policy) => { policy.derived_signal_rules.push({ ...policy.derived_signal_rules.find((rule) => rule.rule_ref === rules.counterCompression), rule_ref: 'rules/context-health/derived-signal/counter-compression-duplicate' }) })
  const duplicateTupleInput = await makeInput(duplicateTuplePolicy)
  assert.deepEqual(await evaluate(duplicateTupleInput, duplicateTuplePolicy), { ok: false, reason: 'duplicate_derived_rule_tuple' })

  const unsupportedPolicy = await makePolicy((policy) => {
    const rule = policy.derived_signal_rules.find((candidate) => candidate.rule_ref === rules.counterCompression)
    delete rule.weight
    rule.signal_class = 'hard_stop'
    rule.threshold = { kind: 'none' }
  })
  const unsupportedInput = await makeInput(unsupportedPolicy)
  assert.deepEqual(await evaluate(unsupportedInput, unsupportedPolicy), { ok: false, reason: 'unsupported_derived_rule_tuple' })

  const incompatibleVersionPolicy = await makePolicy((policy) => { policy.evaluator_contract_version = 'context-health-evaluator-v2' })
  const incompatibleVersionInput = await makeInput(incompatibleVersionPolicy)
  assert.deepEqual(await evaluate(incompatibleVersionInput, incompatibleVersionPolicy), { ok: false, reason: 'policy_mismatch' })

  const suppliedDerivedPolicy = await makePolicy()
  const suppliedDerivedInput = await makeInput(suppliedDerivedPolicy, (input) => { input.derived_signal_codes = ['forbidden'] })
  assert.equal((await evaluate(suppliedDerivedInput, suppliedDerivedPolicy)).ok, false, 'caller-supplied derived signal is rejected structurally')

  const duplicateObservationPolicy = await makePolicy()
  const duplicateObservationInput = await makeInput(duplicateObservationPolicy, (input) => {
    input.atomic_signal_observations = [observation('duplicate', 'compression_event', 'advisory'), observation('duplicate', 'compression_event', 'advisory')]
  })
  assert.equal((await evaluate(duplicateObservationInput, duplicateObservationPolicy)).ok, false, 'duplicate observation identity is rejected')

  const unauthorizedOverride = await run((input) => {
    input.operator_override = { state: 'bound', override_ref: github(173), actor_role: 'product_owner', minimum_outcome: 'handoff_required', reason_code: 'operator_requested_handoff', issued_at: at }
  }, (policy) => { policy.override_rule.allowed_actor_roles = ['architect_team'] })
  assert.deepEqual(unauthorizedOverride.result, { ok: false, reason: 'policy_mismatch' })

  console.log('Pure Context Health evaluator normative suite passed: five source kinds, precedence, thresholds, unknowns, escalation, override, Decision/reference, immutability, and policy rejection.')
} finally {
  await server.close()
}
