/**
 * Step 2 Context Health / Handoff contracts.
 *
 * This module deliberately contains only closed data admission, pure semantic
 * consistency checks, content identity helpers, and non-judgmental templates.
 * It does not evaluate health, calculate scores or outcomes, construct
 * artifacts, collect data, publish, dispatch, or resume work.
 */

export type DeepReadonly<T> = T extends readonly (infer U)[] ? readonly DeepReadonly<U>[]
  : T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } : T

export const CONTEXT_HEALTH_INPUT_VERSION = 'context-health-evaluation-input-v1' as const
export const CONTEXT_HEALTH_POLICY_VERSION = 'context-health-policy-v1' as const
export const CONTEXT_HEALTH_DECISION_VERSION = 'context-health-decision-v1' as const
export const CONTEXT_HANDOFF_MANIFEST_VERSION = 'context-handoff-manifest-v1' as const
export const CONTEXT_RESUME_RESULT_VERSION = 'context-resume-validation-result-v1' as const
export const CONTEXT_COMPONENT_VALIDATION_INPUT_VERSION = 'context-handoff-component-validation-input-v1' as const
export const CONTEXT_COMPONENT_VALIDATION_RESULT_VERSION = 'context-handoff-component-validation-result-v1' as const

export const CONTEXT_HEALTH_STRUCTURAL_CODES = [
  'not_object', 'missing_field', 'unknown_field', 'wrong_type', 'null_forbidden', 'invalid_enum',
  'invalid_format', 'invalid_timestamp', 'invalid_reference', 'duplicate_identity',
  'invalid_conditional_fields', 'unsupported_contract_version', 'content_reference_mismatch',
  'derived_signal_supplied', 'policy_rule_reference_mismatch',
] as const
export type ContextHealthStructuralCodeV1 = (typeof CONTEXT_HEALTH_STRUCTURAL_CODES)[number]

const STRUCTURAL_MESSAGES: Record<ContextHealthStructuralCodeV1, string> = {
  not_object: 'payload must be an object', missing_field: 'required field is missing', unknown_field: 'unknown field is forbidden',
  wrong_type: 'field has the wrong type', null_forbidden: 'null is forbidden', invalid_enum: 'field is not an allowed enum value',
  invalid_format: 'field format is invalid', invalid_timestamp: 'timestamp is not strict UTC RFC3339 milliseconds',
  invalid_reference: 'reference format is invalid', duplicate_identity: 'collection identity is duplicated',
  invalid_conditional_fields: 'conditional field matrix is violated', unsupported_contract_version: 'contract version is unsupported',
  content_reference_mismatch: 'stored content reference does not match the normative projection',
  derived_signal_supplied: 'evaluator-derived signal must not be supplied by the caller',
  policy_rule_reference_mismatch: 'policy rule reference does not resolve exactly',
}

export interface ContextHealthStructuralRejectionV1 {
  readonly contract_version: 'context-health-structural-rejection-v1'
  readonly code: ContextHealthStructuralCodeV1
  readonly path: string
  readonly message: string
  readonly observed_at: string
}
export interface ContextHealthOperationalFailureV1 {
  readonly contract_version: 'context-health-operational-failure-v1'
  readonly task_id: string
  readonly assignment_revision: number
  readonly role: RoleV1
  readonly checkpoint_instance_id: string
  readonly context_health_input_ref: string
  readonly context_health_policy_ref: string
  readonly status: 'blocked' | 'failed'
  readonly failure_code: 'policy_mismatch' | 'policy_incompatible' | 'operator_override_conflict' | 'evaluator_internal_failure' | 'artifact_generation_failure' | 'handoff_publication_failed'
  readonly path: string
  readonly message: string
  readonly affected_ref?: CanonicalSourceRefV1
  readonly decision_owner: RoleV1
  readonly recommended_next_action: string
  readonly retry_policy: RetryPolicyV1
  readonly evaluation_timestamp: string
}

export type RoleV1 = typeof ROLE_VALUES[number]
export type RetryPolicyV1 = typeof RETRY_VALUES[number]
export type CanonicalSourceRefV1 =
  | { readonly kind: 'github'; readonly url: string }
  | { readonly kind: 'repository'; readonly repository: 'whatrune/sd-prompt-studio'; readonly commit_sha: string; readonly path: string }
  | { readonly kind: 'content_addressed'; readonly content_ref: string }
export interface ContextHealthEvaluationInputV1 { readonly contract_version: typeof CONTEXT_HEALTH_INPUT_VERSION; readonly context_health_input_ref: string; readonly [key: string]: unknown }
export interface ContextHealthPolicyV1 { readonly contract_version: typeof CONTEXT_HEALTH_POLICY_VERSION; readonly context_health_policy_ref: string; readonly [key: string]: unknown }
export interface ContextHealthDecisionV1 { readonly contract_version: typeof CONTEXT_HEALTH_DECISION_VERSION; readonly context_health_decision_ref: string; readonly [key: string]: unknown }
export interface ContextHandoffManifestV1 { readonly contract_version: typeof CONTEXT_HANDOFF_MANIFEST_VERSION; readonly context_handoff_manifest_ref: string; readonly [key: string]: unknown }
export interface ContextResumeValidationResultV1 { readonly contract_version: typeof CONTEXT_RESUME_RESULT_VERSION; readonly result_kind: 'success' | 'blocked' | 'stale' | 'invalid' | 'internal_failure'; readonly [key: string]: unknown }

export const ROLE_VALUES = [
  'product_owner', 'integrated_lead', 'architect_team', 'backend_architect', 'backend_implementer', 'frontend_implementer', 'worker',
  'research_execution_op', 'image_analysis_op', 'research_review_op', 'maintenance_op', 'reporting_op',
] as const
export const RETRY_VALUES = ['after_input_correction', 'after_architect_decision', 'after_product_owner_decision', 'after_implementation_fix', 'after_transport_recovery', 'not_retryable'] as const
const OUTCOMES = ['continue', 'checkpoint_only', 'handoff_required', 'hard_stop_and_handoff'] as const
const DERIVED_SIGNALS = new Set(['required_identity_unavailable', 'canonical_state_contradiction', 'forbidden_constraints_unavailable', 'required_fresh_state_unavailable', 'security_boundary_uncertain', 'operator_hard_stop_requested', 'resume_artifact_stale_or_invalid', 'operator_handoff_requested', 'user_declared_context_limit', 'interaction_volume_high', 'operation_volume_high', 'unresolved_state_growth', 'active_blocker_growth', 'amendment_churn', 'settled_fact_recorrected', 'record_refetched_repeatedly', 'settled_fact_reexplained', 'compression_pressure_observed', 'high_dependency_phase_transition', 'nonmandatory_retrieval_failure'])
const ATOMIC_AUTHORITY: Record<string, 'authoritative' | 'advisory'> = { operator_hard_stop_event: 'authoritative', operator_handoff_event: 'authoritative', user_context_limit_event: 'authoritative', compression_event: 'advisory', role_reconstruction_warning_event: 'advisory', security_uncertainty_event: 'authoritative', nonmandatory_retrieval_failure_event: 'advisory' }

const INPUT_FIELDS = ['contract_version','context_health_input_ref','task_id','assignment_revision','role','repository','workflow_phase','checkpoint','workflow_identity','constraint_snapshot','counter_snapshot','atomic_signal_observations','canonical_record_coverage','validation_bindings','handoff_artifact','prior_checkpoint','operator_override','evaluation_timestamp'] as const
const POLICY_FIELDS = ['contract_version','context_health_policy_ref','policy_revision','lifecycle_status','evaluator_contract_version','checkpoint_rules','atomic_signal_rules','derived_signal_rules','outcome_thresholds','consecutive_checkpoint_escalation','unknown_handling_rules','override_rule','coverage_rules','approved_by_roles','approval_record_ref','created_at'] as const
const DECISION_FIELDS = ['contract_version','context_health_decision_ref','context_health_input_ref','context_health_policy_ref','task_id','assignment_revision','role','repository','workflow_phase','checkpoint_instance_id','checkpoint_type','outcome','legal_action_class','required_artifact_class','checkpoint_rule_ref','applied_atomic_signal_rule_refs','applied_coverage_rule_refs','hard_rule_refs','forced_handoff_rule_refs','soft_contributions','applied_unknown_handling_rule_refs','checkpoint_escalation_evaluation','operator_override_evaluation','unknown_advisory_signal_codes','prior_decision_refs','soft_score','evaluator_contract_version','evaluation_timestamp'] as const
const MANIFEST_FIELDS = ['contract_version','context_handoff_manifest_ref','task_id','assignment_revision','role','repository','workflow_phase','checkpoint_instance_id','context_health_decision_ref','canonical_task_record','dispatch_record','workflow_identity_snapshot','completed_work','frozen_decisions','unresolved_items','blockers_and_risks','forbidden_operations','validation_snapshot','exact_next_action','component_artifacts','material_facts','freshness_evidence','redaction_records','source_provenance','generator_contract_version','generated_at'] as const

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) }
export function deepFreezeClone<T>(value: T): DeepReadonly<T> { if (Array.isArray(value)) return Object.freeze(value.map(item => deepFreezeClone(item))) as DeepReadonly<T>; if (isRecord(value)) { const clone: Record<string, unknown> = {}; for (const [k, v] of Object.entries(value)) clone[k] = deepFreezeClone(v); return Object.freeze(clone) as DeepReadonly<T> } return value as DeepReadonly<T> }
function utc(value: unknown): value is string { if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false; const time = Date.parse(value); return Number.isFinite(time) && new Date(time).toISOString() === value }
function stable(value: unknown): value is string { return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(value) }
function contentRef(value: unknown): value is string { return typeof value === 'string' && /^(policies\/context-health|evidence\/context-health-inputs|evidence\/context-health-decisions|evidence\/context-handoffs)\/sha256-[0-9a-f]{64}$/.test(value) }
function reject(code: ContextHealthStructuralCodeV1, path: string, observedAt: string): ContextHealthStructuralRejectionV1 { return deepFreezeClone({ contract_version: 'context-health-structural-rejection-v1', code, path, message: STRUCTURAL_MESSAGES[code], observed_at: observedAt }) }
function root(value: unknown, fields: readonly string[], version: string, observedAt: string): DeepReadonly<Record<string, unknown>> | ContextHealthStructuralRejectionV1 {
  if (!utc(observedAt)) throw new TypeError('observedAt must be supplied as StrictUtcTimestampV1.')
  if (value === null) return reject('null_forbidden', '$', observedAt)
  if (!isRecord(value)) return reject('not_object', '$', observedAt)
  for (const field of fields) if (!(field in value)) return reject('missing_field', `$.${field}`, observedAt)
  for (const field of Object.keys(value)) if (!fields.includes(field)) return reject('unknown_field', `$.${field}`, observedAt)
  if (value.contract_version !== version) return reject('unsupported_contract_version', '$.contract_version', observedAt)
  for (const [key, item] of Object.entries(value)) if (item === null) return reject('null_forbidden', `$.${key}`, observedAt)
  return deepFreezeClone(value)
}
function isStructural(value: DeepReadonly<Record<string, unknown>> | ContextHealthStructuralRejectionV1): value is ContextHealthStructuralRejectionV1 { return (value as ContextHealthStructuralRejectionV1).contract_version === 'context-health-structural-rejection-v1' }
function validation<T>(value: DeepReadonly<Record<string, unknown>> | ContextHealthStructuralRejectionV1): AdmissionResult<T> { return isStructural(value) ? { accepted: false, rejection: value } : { accepted: true, value: value as DeepReadonly<T> } }
export type AdmissionResult<T> = { readonly accepted: true; readonly value: DeepReadonly<T> } | { readonly accepted: false; readonly rejection: DeepReadonly<ContextHealthStructuralRejectionV1> }

export function validateCanonicalSourceRefV1(value: unknown): boolean { if (!isRecord(value) || typeof value.kind !== 'string') return false; if (value.kind === 'github') return typeof value.url === 'string' && /^https:\/\/github\.com\/whatrune\/sd-prompt-studio\/(issues|pull)\/\d+(#(issuecomment|discussion_r|pullrequestreview)-\d+)?$/.test(value.url); if (value.kind === 'repository') return value.repository === 'whatrune/sd-prompt-studio' && typeof value.commit_sha === 'string' && /^[0-9a-f]{40}$/.test(value.commit_sha) && typeof value.path === 'string' && /^(?!\/)(?!.*(?:^|\/)\.\.?\/)(?!.*[\\\r\n\0])[^:]+$/.test(value.path); return value.kind === 'content_addressed' && contentRef(value.content_ref) }

export function validateContextHealthEvaluationInputV1(value: unknown, observedAt: string): AdmissionResult<ContextHealthEvaluationInputV1> {
  const admitted = root(value, INPUT_FIELDS, CONTEXT_HEALTH_INPUT_VERSION, observedAt); if ('code' in admitted) return validation(admitted)
  if (!contentRef(admitted.context_health_input_ref) || !stable(admitted.task_id) || !Number.isInteger(admitted.assignment_revision) || (admitted.assignment_revision as number) < 1 || !ROLE_VALUES.includes(admitted.role as RoleV1) || admitted.repository !== 'whatrune/sd-prompt-studio' || !utc(admitted.evaluation_timestamp)) return validation(reject('invalid_format', '$', observedAt))
  const signals = admitted.atomic_signal_observations
  if (!Array.isArray(signals)) return validation(reject('wrong_type', '$.atomic_signal_observations', observedAt))
  const seen = new Set<string>()
  for (let index = 0; index < signals.length; index += 1) { const signal = signals[index]; if (!isRecord(signal) || !stable(signal.observation_id) || typeof signal.atomic_signal_code !== 'string' || DERIVED_SIGNALS.has(signal.atomic_signal_code)) return validation(reject(DERIVED_SIGNALS.has((signal as Record<string, unknown>)?.atomic_signal_code as string) ? 'derived_signal_supplied' : 'invalid_format', `$.atomic_signal_observations[${index}]`, observedAt)); if (seen.has(signal.observation_id)) return validation(reject('duplicate_identity', `$.atomic_signal_observations[${index}].observation_id`, observedAt)); seen.add(signal.observation_id); if (ATOMIC_AUTHORITY[signal.atomic_signal_code] !== signal.authority) return validation(reject('invalid_enum', `$.atomic_signal_observations[${index}].authority`, observedAt)); if (signal.presence === 'unknown' && signal.authority !== 'advisory') return validation(reject('invalid_conditional_fields', `$.atomic_signal_observations[${index}]`, observedAt)) }
  return validation(admitted)
}

export function validateContextHealthPolicyV1(value: unknown, observedAt: string): AdmissionResult<ContextHealthPolicyV1> {
  const admitted = root(value, POLICY_FIELDS, CONTEXT_HEALTH_POLICY_VERSION, observedAt); if ('code' in admitted) return validation(admitted)
  if (!contentRef(admitted.context_health_policy_ref) || admitted.lifecycle_status !== 'approved' && admitted.lifecycle_status !== 'deprecated' && admitted.lifecycle_status !== 'retired') return validation(reject('invalid_format', '$', observedAt))
  const rules = ['checkpoint_rules','atomic_signal_rules','derived_signal_rules','unknown_handling_rules','coverage_rules'].flatMap(key => Array.isArray(admitted[key]) ? admitted[key] : [])
  const refs = new Set<string>(); for (const rule of rules) { if (!isRecord(rule) || typeof rule.rule_ref !== 'string' || !/^rules\/context-health\/(checkpoint|atomic-signal|derived-signal|unknown-handling|coverage)\/[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(rule.rule_ref) || refs.has(rule.rule_ref)) return validation(reject(refs.has((rule as Record<string, unknown>)?.rule_ref as string) ? 'duplicate_identity' : 'invalid_format', '$.rule_ref', observedAt)); refs.add(rule.rule_ref) }
  const escalation = admitted.consecutive_checkpoint_escalation
  if (!isRecord(escalation) || !['enabled','disabled'].includes(escalation.state as string)) return validation(reject('invalid_conditional_fields', '$.consecutive_checkpoint_escalation', observedAt))
  if (admitted.lifecycle_status === 'approved' && escalation.state !== 'enabled') return validation(reject('invalid_conditional_fields', '$.consecutive_checkpoint_escalation.state', observedAt))
  return validation(admitted)
}

export function validateContextHealthDecisionV1(value: unknown, observedAt: string): AdmissionResult<ContextHealthDecisionV1> {
  const admitted = root(value, DECISION_FIELDS, CONTEXT_HEALTH_DECISION_VERSION, observedAt); if ('code' in admitted) return validation(admitted)
  if (!contentRef(admitted.context_health_decision_ref) || !contentRef(admitted.context_health_input_ref) || !contentRef(admitted.context_health_policy_ref) || !OUTCOMES.includes(admitted.outcome as typeof OUTCOMES[number]) || !utc(admitted.evaluation_timestamp) || !Number.isInteger(admitted.soft_score) || (admitted.soft_score as number) < 0) return validation(reject('invalid_format', '$', observedAt))
  return validation(admitted)
}

export function validateContextHandoffManifestV1(value: unknown, observedAt: string): AdmissionResult<ContextHandoffManifestV1> {
  const admitted = root(value, MANIFEST_FIELDS, CONTEXT_HANDOFF_MANIFEST_VERSION, observedAt); if ('code' in admitted) return validation(admitted)
  if (!contentRef(admitted.context_handoff_manifest_ref) || admitted.generator_contract_version !== 'context-handoff-generator-v1' || !utc(admitted.generated_at) || !Array.isArray(admitted.component_artifacts) || admitted.component_artifacts.length !== 5) return validation(reject('invalid_format', '$', observedAt))
  const kinds = new Set<string>(); for (const component of admitted.component_artifacts) { if (!isRecord(component) || typeof component.component_kind !== 'string' || kinds.has(component.component_kind) || component.content_type !== 'application/json' || typeof component.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(component.sha256)) return validation(reject(kinds.has((component as Record<string, unknown>)?.component_kind as string) ? 'duplicate_identity' : 'invalid_format', '$.component_artifacts', observedAt)); kinds.add(component.component_kind) }
  return validation(admitted)
}

export function validateContextResumeValidationResultV1(value: unknown, observedAt: string): AdmissionResult<ContextResumeValidationResultV1> {
  if (!utc(observedAt)) throw new TypeError('observedAt must be supplied as StrictUtcTimestampV1.')
  if (!isRecord(value)) return validation(reject(value === null ? 'null_forbidden' : 'not_object', '$', observedAt))
  if (value.contract_version !== CONTEXT_RESUME_RESULT_VERSION || !['success','blocked','stale','invalid','internal_failure'].includes(value.result_kind as string)) return validation(reject('unsupported_contract_version', '$.contract_version', observedAt))
  if (value.result_kind === 'invalid') { const fields = ['contract_version','result_kind','code','path','message','observed_at']; const bad = Object.keys(value).find(key => !fields.includes(key)); if (bad) return validation(reject('unknown_field', `$.${bad}`, observedAt)); return { accepted: true as const, value: deepFreezeClone(value) as DeepReadonly<ContextResumeValidationResultV1> } }
  const fields = ['contract_version','result_kind','context_handoff_manifest_ref','workflow_identity_snapshot','task_id','assignment_revision','role','repository','resume_attempt_id','source_verification_records','drift_records','unresolved_item_ids','diagnostics','gate_decision','legal_next_action','observed_at']; for (const field of fields) if (!(field in value)) return validation(reject('missing_field', `$.${field}`, observedAt)); return validation(deepFreezeClone(value) as DeepReadonly<Record<string, unknown>>)
}

export type ContextHealthSemanticResult = { readonly valid: true } | { readonly valid: false; readonly code: 'policy_mismatch' | 'policy_rule_reference_mismatch'; readonly path: string }
export function validateContextHealthSemantics(input: ContextHealthEvaluationInputV1, policy: ContextHealthPolicyV1): DeepReadonly<ContextHealthSemanticResult> { if (input.policy_ref !== policy.context_health_policy_ref) return deepFreezeClone({ valid: false, code: 'policy_mismatch', path: '$.policy_ref' }); return deepFreezeClone({ valid: true }) }

function jcs(value: unknown): string { if (value === null) return 'null'; if (typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number') return JSON.stringify(value); if (Array.isArray(value)) return `[${value.map(jcs).join(',')}]`; if (isRecord(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${jcs(value[key])}`).join(',')}}`; throw new TypeError('Value is outside RFC 8785 JSON.') }
function compareUtf8(left: string, right: string): number { const a = new TextEncoder().encode(left); const b = new TextEncoder().encode(right); for (let index = 0; index < Math.min(a.length, b.length); index += 1) { const difference = a[index] - b[index]; if (difference !== 0) return difference } return a.length - b.length }
function sortSets(value: unknown, key?: string): unknown { if (Array.isArray(value)) { const normalized = value.map(item => sortSets(item)); return key && (key.endsWith('_refs') || key.includes('rules') || key.includes('observations') || key.includes('artifacts') || key.includes('facts') || key.includes('records')) ? normalized.sort((a, b) => compareUtf8(jcs(a), jcs(b))) : normalized } if (isRecord(value)) { const copy: Record<string, unknown> = {}; for (const [k, v] of Object.entries(value)) copy[k] = sortSets(v, k); return copy } return value }
async function hash(text: string): Promise<string> { const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)); return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('') }
async function reference(value: Record<string, unknown>, field: string, prefix: string): Promise<string> { const candidate = { ...value }; delete candidate[field]; return `${prefix}${await hash(jcs(sortSets(candidate)))}` }
export const generateContextHealthPolicyRef = (value: ContextHealthPolicyV1): Promise<string> => reference(value as Record<string, unknown>, 'context_health_policy_ref', 'policies/context-health/sha256-')
export const generateContextHealthInputRef = (value: ContextHealthEvaluationInputV1): Promise<string> => reference(value as Record<string, unknown>, 'context_health_input_ref', 'evidence/context-health-inputs/sha256-')
export const generateContextHealthDecisionRef = (value: ContextHealthDecisionV1): Promise<string> => reference(value as Record<string, unknown>, 'context_health_decision_ref', 'evidence/context-health-decisions/sha256-')
export const generateContextHandoffManifestRef = (value: ContextHandoffManifestV1): Promise<string> => reference(value as Record<string, unknown>, 'context_handoff_manifest_ref', 'evidence/context-handoffs/sha256-')
export async function verifyContextHealthReference(value: ContextHealthPolicyV1 | ContextHealthEvaluationInputV1 | ContextHealthDecisionV1 | ContextHandoffManifestV1): Promise<boolean> { const map: Record<string, [string, (item: never) => Promise<string>]> = { [CONTEXT_HEALTH_POLICY_VERSION]: ['context_health_policy_ref', generateContextHealthPolicyRef as never], [CONTEXT_HEALTH_INPUT_VERSION]: ['context_health_input_ref', generateContextHealthInputRef as never], [CONTEXT_HEALTH_DECISION_VERSION]: ['context_health_decision_ref', generateContextHealthDecisionRef as never], [CONTEXT_HANDOFF_MANIFEST_VERSION]: ['context_handoff_manifest_ref', generateContextHandoffManifestRef as never] }; const entry = map[value.contract_version]; return !!entry && value[entry[0] as keyof typeof value] === await entry[1](value as never) }

export const CONTEXT_HANDOFF_TEMPLATES = deepFreezeClone({
  manifest: { template_version: 'context-handoff-template-v1', required_contract: CONTEXT_HANDOFF_MANIFEST_VERSION, purpose: 'non_judgmental_shape_only' },
  compressed_handoff: { template_version: 'compressed-context-handoff-template-v1', section_order: ['workflow_identity','completed_work','frozen_decisions','unresolved_items','blockers_and_risks','forbidden_operations','validation','exact_next_action','freshness_redaction'] },
  bootstrap_prompt: { template_version: 'context-bootstrap-prompt-template-v1', instruction_order: ['load_manifest','validate_bundle','fresh_fetch_mutable_state','classify_drift','preserve_unresolved_items','reevaluate_context_health','identify_legal_next_action','stop_on_non_success'] },
})
