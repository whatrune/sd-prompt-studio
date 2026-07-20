import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
const observedAt = '2026-07-20T10:45:00.000Z'
const policyRef = `policies/context-health/sha256-${'1'.repeat(64)}`
const inputRef = `evidence/context-health-inputs/sha256-${'2'.repeat(64)}`
const decisionRef = `evidence/context-health-decisions/sha256-${'3'.repeat(64)}`
const manifestRef = `evidence/context-handoffs/sha256-${'4'.repeat(64)}`
const source = { kind: 'github', url: 'https://github.com/whatrune/sd-prompt-studio/issues/156' }

const policy = (overrides = {}) => ({
  contract_version: 'context-health-policy-v1', context_health_policy_ref: policyRef, policy_revision: 'v1', lifecycle_status: 'approved', evaluator_contract_version: 'context-health-evaluator-v1',
  checkpoint_rules: [{ rule_ref: 'rules/context-health/checkpoint/pre-review', checkpoint_type: 'pre_review', blocking_class: 'blocking', required_coverage_classes: [], protected_action_required: true }],
  atomic_signal_rules: [{ rule_ref: 'rules/context-health/atomic-signal/compression', atomic_signal_code: 'compression_event', authority: 'advisory', permitted_evidence_kinds: [], derived_signal_code: 'compression_pressure_observed' }],
  derived_signal_rules: [{ rule_ref: 'rules/context-health/derived-signal/compression', derived_signal_code: 'compression_pressure_observed', signal_class: 'soft', source_kind: 'atomic_signal', threshold: { kind: 'none' }, weight: 3 }],
  outcome_thresholds: { continue_min: 0, continue_max: 2, checkpoint_only_min: 3, checkpoint_only_max: 5, handoff_required_min: 6 },
  consecutive_checkpoint_escalation: { rule_ref: 'rules/context-health/escalation/checkpoint-only', state: 'enabled', source_outcome: 'checkpoint_only', consecutive_count_threshold: 2, escalation_outcome: 'handoff_required', reset_outcomes: ['continue', 'handoff_required', 'hard_stop_and_handoff'] },
  unknown_handling_rules: [{ rule_ref: 'rules/context-health/unknown-handling/advisory', evidence_class: 'advisory_signal', handling: 'report_without_score' }],
  override_rule: { rule_ref: 'rules/context-health/override/default', allowed_actor_roles: ['product_owner'], allowed_minimum_outcomes: ['checkpoint_only', 'handoff_required', 'hard_stop_and_handoff'], deescalation_allowed: false },
  coverage_rules: [{ rule_ref: 'rules/context-health/coverage/task', coverage_class: 'task_assignment', applicable_checkpoint_types: ['pre_review'], required: true }],
  approved_by_roles: ['architect_team'], approval_record_ref: source, created_at: observedAt, ...overrides,
})
const input = (overrides = {}) => ({
  contract_version: 'context-health-evaluation-input-v1', context_health_input_ref: inputRef, task_id: 'IMPLEMENT-CONTEXT-HEALTH-HANDOFF-CONTRACTS-001', assignment_revision: 1, role: 'backend_implementer', repository: 'whatrune/sd-prompt-studio', workflow_phase: 'implementation',
  checkpoint: { checkpoint_instance_id: 'checkpoint-1', checkpoint_type: 'pre_review', blocking_class: 'blocking', protected_action_ref: source },
  workflow_identity: { canonical_task_record: source, dispatch_record: source, issue_binding: { state: 'bound' } },
  constraint_snapshot: { allowed_change_refs: [source], forbidden_change_refs: [source], required_validation_refs: [source], security_policy_refs: [source], approval_gate_refs: [source] },
  counter_snapshot: { interaction_count: 0, operation_count: 0, unresolved_item_count: 0, active_blocker_count: 0, amendment_count: 0, settled_fact_correction_count: 0, dependency_count: 0, repeated_record_fetch_counts: [], settled_fact_reexplanation_counts: [] },
  atomic_signal_observations: [{ observation_id: 'observation-1', atomic_signal_code: 'compression_event', presence: 'absent', authority: 'advisory', evidence_refs: [], observed_at: observedAt }],
  canonical_record_coverage: [], validation_bindings: [], handoff_artifact: { state: 'none' }, prior_checkpoint: { state: 'none' }, operator_override: { state: 'absent' }, evaluation_timestamp: observedAt, ...overrides,
})
const decision = (overrides = {}) => ({
  contract_version: 'context-health-decision-v1', context_health_decision_ref: decisionRef, context_health_input_ref: inputRef, context_health_policy_ref: policyRef, task_id: 'IMPLEMENT-CONTEXT-HEALTH-HANDOFF-CONTRACTS-001', assignment_revision: 1, role: 'backend_implementer', repository: 'whatrune/sd-prompt-studio', workflow_phase: 'implementation', checkpoint_instance_id: 'checkpoint-1', checkpoint_type: 'pre_review', outcome: 'continue', legal_action_class: 'assigned_work_allowed', required_artifact_class: 'decision_record', checkpoint_rule_ref: 'rules/context-health/checkpoint/pre-review', applied_atomic_signal_rule_refs: [], applied_coverage_rule_refs: [], hard_rule_refs: [], forced_handoff_rule_refs: [], soft_contributions: [], applied_unknown_handling_rule_refs: [], checkpoint_escalation_evaluation: { state: 'not_applicable' }, operator_override_evaluation: { state: 'absent' }, unknown_advisory_signal_codes: [], prior_decision_refs: [], soft_score: 0, evaluator_contract_version: 'context-health-evaluator-v1', evaluation_timestamp: observedAt, ...overrides,
})
const manifest = (overrides = {}) => ({
  contract_version: 'context-handoff-manifest-v1', context_handoff_manifest_ref: manifestRef, task_id: 'IMPLEMENT-CONTEXT-HEALTH-HANDOFF-CONTRACTS-001', assignment_revision: 1, role: 'backend_implementer', repository: 'whatrune/sd-prompt-studio', workflow_phase: 'implementation', checkpoint_instance_id: 'checkpoint-1', context_health_decision_ref: decisionRef, canonical_task_record: source, dispatch_record: source, workflow_identity_snapshot: { observed_at: observedAt }, completed_work: [], frozen_decisions: [], unresolved_items: [], blockers_and_risks: [], forbidden_operations: [], validation_snapshot: { component_id: 'validation', component_kind: 'validation_snapshot', sha256: 'a'.repeat(64) }, exact_next_action: { action_id: 'review', owner_role: 'backend_architect', action_summary: 'review contracts', preconditions: [], source_refs: [source] }, component_artifacts: ['compressed_context_handoff','bootstrap_prompt','canonical_record_manifest','repository_state_snapshot','validation_snapshot'].map((component_kind, index) => ({ component_id: `component-${index}`, component_kind, content_type: 'application/json', byte_length: 1, sha256: `${index}`.repeat(64) })), material_facts: [], freshness_evidence: [], redaction_records: [], source_provenance: [], generator_contract_version: 'context-handoff-generator-v1', generated_at: observedAt, ...overrides,
})

try {
  const api = await server.ssrLoadModule('/src/context-health/index.ts')
  const { validateContextHealthEvaluationInputV1, validateContextHealthPolicyV1, validateContextHealthDecisionV1, validateContextHandoffManifestV1, validateContextResumeValidationResultV1, validateContextHealthSemantics, generateContextHealthPolicyRef, verifyContextHealthReference, CONTEXT_HANDOFF_TEMPLATES } = api
  const accepted = validateContextHealthEvaluationInputV1(input(), observedAt)
  assert.equal(accepted.accepted, true); assert(Object.isFrozen(accepted.value)); assert(Object.isFrozen(accepted.value.atomic_signal_observations))
  input().atomic_signal_observations[0].authority = 'authoritative'
  assert.equal(validateContextHealthEvaluationInputV1(input({ atomic_signal_observations: [{ observation_id: 'd', atomic_signal_code: 'interaction_volume_high', presence: 'present', authority: 'advisory', evidence_refs: [], observed_at: observedAt }] }), observedAt).rejection.code, 'derived_signal_supplied')
  assert.equal(validateContextHealthEvaluationInputV1(null, observedAt).rejection.code, 'null_forbidden')
  assert.equal(validateContextHealthEvaluationInputV1({ ...input(), unknown: true }, observedAt).rejection.code, 'unknown_field')
  assert.equal(validateContextHealthEvaluationInputV1(input({ evaluation_timestamp: '2026-07-20T10:45:00Z' }), observedAt).rejection.code, 'invalid_format')
  assert.equal(validateContextHealthPolicyV1(policy(), observedAt).accepted, true)
  assert.equal(validateContextHealthPolicyV1(policy({ checkpoint_rules: [{ ...policy().checkpoint_rules[0] }, { ...policy().checkpoint_rules[0] }] }), observedAt).rejection.code, 'duplicate_identity')
  assert.equal(validateContextHealthDecisionV1(decision(), observedAt).accepted, true)
  assert.equal(validateContextHandoffManifestV1(manifest(), observedAt).accepted, true)
  assert.equal(validateContextHandoffManifestV1(manifest({ component_artifacts: manifest().component_artifacts.slice(0, 4) }), observedAt).rejection.code, 'invalid_format')
  assert.equal(validateContextHealthSemantics(input({ policy_ref: policyRef }), policy()).valid, true)
  assert.equal(validateContextHealthSemantics(input({ policy_ref: `policies/context-health/sha256-${'f'.repeat(64)}` }), policy()).code, 'policy_mismatch')
  const p = policy(); p.context_health_policy_ref = await generateContextHealthPolicyRef(p); assert.equal(await verifyContextHealthReference(p), true)
  const reordered = policy({ checkpoint_rules: [...policy().checkpoint_rules].reverse() }); reordered.context_health_policy_ref = await generateContextHealthPolicyRef(reordered); assert.equal(reordered.context_health_policy_ref, p.context_health_policy_ref)
  assert.equal(validateContextResumeValidationResultV1({ contract_version: 'context-resume-validation-result-v1', result_kind: 'invalid', code: 'invalid_format', path: '$', message: 'field format is invalid', observed_at: observedAt }, observedAt).accepted, true)
  assert.equal(CONTEXT_HANDOFF_TEMPLATES.bootstrap_prompt.instruction_order[0], 'load_manifest')
  console.log('Context Health and Handoff contract tests passed.')
} finally { await server.close() }
