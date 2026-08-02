import {
  canonicalizeContinuousOrchestrationJsonV1 as jcs,
  digestContinuousOrchestrationJsonV1 as digest,
  reduceContinuousOrchestrationV1,
  validateContinuousOrchestrationEventV1,
  validateContinuousOrchestrationStateV1,
  validateGenericProgressRunnerProfilesV1,
  validateProgressionEvaluatorResultV1,
  type CanonicalRecordUrl,
  type ClosedAdmissionResultV1,
  type ContinuousOrchestrationEventV1,
  type ContinuousOrchestrationReductionV1,
  type ContinuousOrchestrationStateV1,
  type FullGitSha,
  type GenericProgressRunnerProfilesV1,
  type ProgressionEvaluatorResultV1,
  type PrUrl,
  type RouteBindingV1,
  type Sha256,
} from './index'
import {
  ACTION_GUARD_PROOF_V1_VERSION,
  deriveDispatchIntentShadowV1,
  deriveRepairAttemptLedgerShadowV1,
  validateActionGuardProofV1,
  validateAdmittedAuthorityBundleV1,
  validateDispatchIntentV1,
  validateRepairAttemptLedgerV1,
  validateRepairBudgetProfileV1,
  validateRouteBindingV1,
  type ActionGuardProofV1,
  type AdmittedAuthorityBundleV1,
  type DispatchIntentV1,
  type RepairAttemptClassV1,
  type RepairAttemptLedgerEntryV1,
  type RepairAttemptLedgerV1,
  type RepairBudgetProfileV1,
  type RepairFindingDomainV1,
} from './shared-proof-interfaces-v1'

export const AUTHORITY_ROUTING_BUDGET_CUTOVER_INPUT_V1_VERSION = 'authority_routing_budget_cutover_input_v1' as const
export const AUTHORITY_ROUTING_BUDGET_CUTOVER_PROFILE_V1_VERSION = 'authority_routing_budget_cutover_profile_v1' as const
export const AUTHORITY_ROUTING_BUDGET_CUTOVER_RESULT_V1_VERSION = 'authority_routing_budget_cutover_result_v1' as const
export const REPAIR_ATTEMPT_EVIDENCE_V1_VERSION = 'repair_attempt_evidence_v1' as const
export const REPAIR_LEDGER_CAS_OPERAND_V1_VERSION = 'repair_ledger_cas_operand_v1' as const
export const M3_COMBINED_TASK_ASSIGNMENT_AUTHORITY_PROJECTION_V1_VERSION = 'm3_combined_task_assignment_authority_projection_v1' as const
export const M3_PREPARED_ROUTE_AUTHORITY_BINDING_V1_VERSION = 'm3_prepared_route_authority_binding_v1' as const
export const M3_CAS_OUTCOME_PROOF_V1_VERSION = 'm3_cas_outcome_proof_v1' as const
export const M3_ROUTE_BOUND_ACTION_GUARD_V1_VERSION = 'm3_route_bound_action_guard_v1' as const
export const M3_TRANSPORT_CONSUMPTION_RECEIPT_V1_VERSION = 'm3_transport_consumption_receipt_v1' as const
export const M3_DELIVERY_FINALIZATION_INPUT_V1_VERSION = 'm3_delivery_finalization_input_v1' as const
export const M3_DELIVERY_FINALIZATION_RESULT_V1_VERSION = 'm3_delivery_finalization_result_v1' as const
export const M3_EXPECTED_M2_MANIFEST_DIGEST = '76440e14b1bdd87290a82795653f0d7d9d4a38993edecfc51b8c16ebf4992eae' as const

type JsonObject = Record<string, unknown>
type RejectionCode =
  | 'unknown_field'
  | 'missing_required_field'
  | 'invalid_type_or_format'
  | 'invalid_enum'
  | 'duplicate_set_member'
  | 'noncanonical_set_order'
  | 'invalid_conditional_matrix'
  | 'invalid_cross_input_binding'
type Problem = Readonly<{ code: RejectionCode; path: string }>

export interface AuthorityRoutingBudgetCutoverProfileV1 {
  readonly profile_version: typeof AUTHORITY_ROUTING_BUDGET_CUTOVER_PROFILE_V1_VERSION
  readonly feature_id: 'authority_routing_budget'
  readonly mode: 'm3_cutover_v1' | 'legacy_adapter_v1'
  readonly task_id: string
  readonly repository: string
  readonly assignment_revision: number
  readonly allowed_scope_digest: Sha256
  readonly profile_authority_record_url: CanonicalRecordUrl
  readonly expected_m2_manifest_digest: typeof M3_EXPECTED_M2_MANIFEST_DIGEST
  readonly expected_prior_state_digest: Sha256
  readonly expected_prior_ledger_digest: Sha256
  readonly profile_digest: Sha256
}

export type M3RouteSelectionV1 =
  | Readonly<{
      kind: 'route'
      binding: RouteBindingV1
      predecessor_canonical_url: CanonicalRecordUrl
      branch: string
      worktree_identity: string
      pr_url_or_null: PrUrl | null
      head_sha_or_null: FullGitSha | null
      selection_digest: Sha256
    }>
  | Readonly<{
      kind: 'no_route'
      authority_record_url: CanonicalRecordUrl
      reason: 'no_declared_transition'
      selection_digest: Sha256
    }>

export interface RepairAttemptEvidenceV1 {
  readonly evidence_version: typeof REPAIR_ATTEMPT_EVIDENCE_V1_VERSION
  readonly evidence_record_url: CanonicalRecordUrl
  readonly task_id: string
  readonly repository: string
  readonly assignment_revision: number
  readonly semantic_epoch_id: Sha256
  readonly stable_finding_id: string
  readonly finding_domain: RepairFindingDomainV1
  readonly attempt_class: RepairAttemptClassV1
  readonly scope_digest: Sha256
  readonly source_counter: number
  readonly predecessor_record_url: CanonicalRecordUrl
  readonly idempotency_key: Sha256
  readonly evidence_digest: Sha256
}

export interface RepairLedgerCasOperandV1 {
  readonly operand_version: typeof REPAIR_LEDGER_CAS_OPERAND_V1_VERSION
  readonly task_id: string
  readonly repository: string
  readonly assignment_revision: number
  readonly semantic_epoch_id: Sha256
  readonly expected_prior_ledger_digest: Sha256
  readonly next_ledger_digest: Sha256
  readonly attempt_idempotency_key: Sha256
  readonly expected_state_digest: Sha256
  readonly route_digest: Sha256
  readonly authority_bundle_digest: Sha256
  readonly operand_digest: Sha256
}

export interface M3CombinedTaskAssignmentAuthorityProjectionV1 {
  readonly schema_version: typeof M3_COMBINED_TASK_ASSIGNMENT_AUTHORITY_PROJECTION_V1_VERSION
  readonly task_id: string
  readonly repository_full_name: string
  readonly assignment_revision: number
  readonly canonical_assignment_url: CanonicalRecordUrl
  readonly source_record_digest: Sha256
  readonly source_occurrence_count: 1
  readonly assigned_role: 'Backend Implementer'
  readonly recommended_next_action: 'run_m3_authority_routing_budget_cutover_v1' | 'run_m3_legacy_adapter_v1'
  readonly selected_route_bundle_id: string
  readonly selected_route_action_id: string
  readonly branch_name: string
  readonly worktree_binding_digest: Sha256
  readonly pr_number: number | null
  readonly pr_url: PrUrl | null
  readonly pr_head_sha: FullGitSha
  readonly predecessor_digest: Sha256
  readonly scope_digest: Sha256
  readonly fresh_snapshot_digest: Sha256
  readonly active_profile_id: 'authority_routing_budget'
  readonly active_profile_authority_url: CanonicalRecordUrl
  readonly active_profile_mode: 'm3_cutover_v1' | 'legacy_adapter_v1'
  readonly combined_task_assignment_authority_digest: Sha256
}

export interface M3PreparedRouteAuthorityBindingV1 {
  readonly schema_version: typeof M3_PREPARED_ROUTE_AUTHORITY_BINDING_V1_VERSION
  readonly task_id: string
  readonly repository_full_name: string
  readonly assignment_revision: number
  readonly combined_task_assignment_authority_digest: Sha256
  readonly combined_task_assignment_source_url: CanonicalRecordUrl
  readonly selected_route_bundle_id: string
  readonly route_identity_digest: Sha256
  readonly route_selection_digest: Sha256
  readonly branch_name: string
  readonly worktree_binding_digest: Sha256
  readonly pr_number: number | null
  readonly pr_url: PrUrl | null
  readonly pr_head_sha: FullGitSha
  readonly predecessor_digest: Sha256
  readonly scope_digest: Sha256
  readonly fresh_snapshot_digest: Sha256
  readonly active_profile_id: 'authority_routing_budget'
  readonly active_profile_authority_url: CanonicalRecordUrl
  readonly active_profile_mode: 'm3_cutover_v1' | 'legacy_adapter_v1'
  readonly profile_mode_binding_digest: Sha256
  readonly prepared_evaluation_digest: Sha256
  readonly cas_operand_digest: Sha256
  readonly expected_state_digest: Sha256
  readonly successor_state_digest: Sha256
  readonly action_id: string
  readonly delivery_eligible: false
  readonly delivery_intent: null
  readonly finalization_state: 'awaiting_cas_outcome'
  readonly prepared_route_authority_binding_digest: Sha256
}

export interface M3CasOutcomeProofV1 {
  readonly schema_version: typeof M3_CAS_OUTCOME_PROOF_V1_VERSION
  readonly prepared_route_authority_binding_digest: Sha256
  readonly combined_task_assignment_authority_digest: Sha256
  readonly route_identity_digest: Sha256
  readonly profile_mode_binding_digest: Sha256
  readonly action_id: string
  readonly cas_operand_digest: Sha256
  readonly expected_state_digest: Sha256
  readonly observed_state_digest: Sha256
  readonly successor_state_digest: Sha256
  readonly outcome: 'winner' | 'loser'
  readonly compare_matched: boolean
  readonly write_applied: boolean
  readonly loser_reason: 'compare_mismatch' | 'already_consumed' | null
  readonly receipt_id: string
  readonly receipt_issuer_authority_url: CanonicalRecordUrl
  readonly receipt_issuer_authority_digest: Sha256
  readonly receipt_digest: Sha256
  readonly cas_outcome_proof_digest: Sha256
}

export interface M3RouteBoundActionGuardV1 {
  readonly schema_version: typeof M3_ROUTE_BOUND_ACTION_GUARD_V1_VERSION
  readonly predecessor_guard_proof: ActionGuardProofV1
  readonly predecessor_guard_proof_digest: Sha256
  readonly prepared_route_authority_binding_digest: Sha256
  readonly combined_task_assignment_authority_digest: Sha256
  readonly route_identity_digest: Sha256
  readonly route_selection_digest: Sha256
  readonly branch_name: string
  readonly worktree_binding_digest: Sha256
  readonly pr_number: number | null
  readonly pr_url: PrUrl | null
  readonly pr_head_sha: FullGitSha
  readonly fresh_snapshot_digest: Sha256
  readonly action_id: string
  readonly guard_binding_digest: Sha256
}

export interface M3TransportConsumptionReceiptV1 {
  readonly schema_version: typeof M3_TRANSPORT_CONSUMPTION_RECEIPT_V1_VERSION
  readonly transport_idempotency_key: Sha256
  readonly prepared_route_authority_binding_digest: Sha256
  readonly cas_outcome_proof_digest: Sha256
  readonly action_id: string
  readonly owner_authority_url: CanonicalRecordUrl
  readonly owner_authority_digest: Sha256
  readonly consumption_outcome: 'acquired' | 'owner_in_progress' | 'already_consumed'
  readonly owner_state: 'reserved_not_executed' | 'executed'
  readonly first_receipt_digest: Sha256
  readonly transport_execution_count_for_key: 0 | 1
  readonly new_delivery_eligibility_authorized: boolean
  readonly retry_disposition: 'replay_wait' | null
  readonly receipt_id: string
  readonly receipt_digest: Sha256
}

export interface AuthorityRoutingBudgetCutoverInputV1 {
  readonly input_version: typeof AUTHORITY_ROUTING_BUDGET_CUTOVER_INPUT_V1_VERSION
  readonly state: ContinuousOrchestrationStateV1
  readonly event: ContinuousOrchestrationEventV1
  readonly profiles: GenericProgressRunnerProfilesV1
  readonly evaluation: ProgressionEvaluatorResultV1
  readonly decision_url: CanonicalRecordUrl
  readonly evaluated_at: string
  readonly recovery_role_id_or_null: string | null
  readonly authority_bundle: AdmittedAuthorityBundleV1
  readonly combined_task_assignment_authority: M3CombinedTaskAssignmentAuthorityProjectionV1
  readonly cutover_profile: AuthorityRoutingBudgetCutoverProfileV1
  readonly route_selection: M3RouteSelectionV1
  readonly repair_budget_profile: RepairBudgetProfileV1
  readonly repair_attempt_ledger: RepairAttemptLedgerV1
  readonly repair_attempt_evidence_or_null: RepairAttemptEvidenceV1 | null
  readonly action_guard_proof_or_null: ActionGuardProofV1 | null
  readonly expected_prior_state_digest: Sha256
  readonly expected_prior_ledger_digest: Sha256
  readonly input_digest: Sha256
}

type CommonResult = Readonly<{
  result_version: typeof AUTHORITY_ROUTING_BUDGET_CUTOVER_RESULT_V1_VERSION
  authority_bundle_digest: Sha256
  profile_digest: Sha256
  route_selection_digest: Sha256
  next_repair_ledger: RepairAttemptLedgerV1
  ledger_cas_operand_or_null: RepairLedgerCasOperandV1 | null
  action_guard_status: 'not_required' | 'admitted' | 'required' | 'protected_wait'
  checkpoint_required: boolean
  reduction_invocation_count: 0 | 1
  cutover_evidence_digest: Sha256
  transport_invoked: false
  write_invoked: false
  protected_action_invoked: false
  prepared_route_authority_binding_or_null: M3PreparedRouteAuthorityBindingV1 | null
  delivery_eligible: false
  delivery_intent: null
  finalization_state: 'awaiting_cas_outcome' | 'not_applicable'
}>

export type AuthorityRoutingBudgetCutoverResultV1 =
  | (CommonResult & Readonly<{
      kind: 'cutover_accepted'
      reduction: ContinuousOrchestrationReductionV1
      dispatch_intent_or_null: DispatchIntentV1 | null
    }>)
  | (CommonResult & Readonly<{
      kind: 'legacy_profile_accepted'
      reduction: ContinuousOrchestrationReductionV1
      dispatch_intent_or_null: DispatchIntentV1 | null
      rollback_preservation_proof: Readonly<{
        profile_mode: 'legacy_adapter_v1'
        prior_ledger_digest: Sha256
        next_ledger_digest: Sha256
        semantic_epoch_id: Sha256
        authority_bundle_digest: Sha256
        route_selection_digest: Sha256
        no_counter_reset: true
        no_authority_rewrite: true
        proof_digest: Sha256
      }>
    }>)
  | (CommonResult & Readonly<{
      kind: 'stopped'
      stop_class: 'authority_conflict' | 'ambiguous_route' | 'freshness_required' | 'protected_action_wait' | 'budget_exhausted' | 'stale_cas' | 'cycle_checkpoint' | 'cycle_exhausted'
      stop_reason: 'architecture_gap' | 'external_blocker'
      reduction_or_null: ContinuousOrchestrationReductionV1 | null
      dispatch_intent_or_null: null
    }>)
  | Readonly<{
      result_version: typeof AUTHORITY_ROUTING_BUDGET_CUTOVER_RESULT_V1_VERSION
      kind: 'rejected'
      rejection: Readonly<{ code: RejectionCode; path: string; message: string }>
      state_changed: false
      reduction_invocation_count: 0
      transport_invoked: false
      write_invoked: false
      protected_action_invoked: false
      cutover_evidence_digest: Sha256
    }>

export interface M3DeliveryFinalizationInputV1 {
  readonly input_version: typeof M3_DELIVERY_FINALIZATION_INPUT_V1_VERSION
  readonly prepared_route_authority_binding: M3PreparedRouteAuthorityBindingV1
  readonly cas_outcome_proof: M3CasOutcomeProofV1
  readonly route_bound_action_guard: M3RouteBoundActionGuardV1
  readonly combined_task_assignment_authority: M3CombinedTaskAssignmentAuthorityProjectionV1
  readonly transport_consumption_receipt_or_null: M3TransportConsumptionReceiptV1 | null
  readonly input_digest: Sha256
}

type M3FinalizationCommonV1 = Readonly<{
  result_version: typeof M3_DELIVERY_FINALIZATION_RESULT_V1_VERSION
  delivery_eligible: boolean
  new_delivery_eligibility: boolean
  transport_execution_performed: false
  receipt_port_invocation_count: 0 | 1
  transport_execution_count_for_key: 0 | 1
  unique_admitted_delivery_idempotency_key_count: 0 | 1
  distinct_delivery_eligibility_token_count: 0 | 1
  result_digest: Sha256
}>

export type M3DeliveryFinalizationResultV1 =
  | (M3FinalizationCommonV1 & Readonly<{ branch:'eligible_token'; code:'m3_delivery_eligibility_token_admitted'; path:null; delivery_eligible:true; new_delivery_eligibility:true; receipt_port_invocation_count:1; unique_admitted_delivery_idempotency_key_count:1; distinct_delivery_eligibility_token_count:1; delivery_eligibility_token:Readonly<{transport_idempotency_key:Sha256;final_route_delivery_binding_digest:Sha256;first_receipt_digest:Sha256;token_digest:Sha256}>; delivery_intent:null; final_route_delivery_binding_digest:Sha256 }>)
  | (M3FinalizationCommonV1 & Readonly<{ branch:'owner_in_progress_rejected'; code:'transport_owner_in_progress'; path:'/m3_delivery_finalize/transport_consumption_receipt/consumption_outcome'; delivery_eligible:false; new_delivery_eligibility:false; receipt_port_invocation_count:1; unique_admitted_delivery_idempotency_key_count:1; distinct_delivery_eligibility_token_count:0; retry_disposition:'replay_wait'; delivery_eligibility_token:null; delivery_intent:null; final_route_delivery_binding_digest:Sha256 }>)
  | (M3FinalizationCommonV1 & Readonly<{ branch:'already_consumed_rejected'; code:'transport_idempotency_already_consumed'; path:'/m3_delivery_finalize/transport_consumption_receipt/consumption_outcome'; delivery_eligible:false; new_delivery_eligibility:false; receipt_port_invocation_count:1; unique_admitted_delivery_idempotency_key_count:1; distinct_delivery_eligibility_token_count:0; delivery_eligibility_token:null; delivery_intent:null; final_route_delivery_binding_digest:Sha256 }>)
  | (M3FinalizationCommonV1 & Readonly<{ branch:'cas_loser_rejected'; code:'cas_loser_not_delivery_eligible'; path:'/m3_delivery_finalize/cas_outcome/outcome'; delivery_eligible:false; new_delivery_eligibility:false; receipt_port_invocation_count:0; transport_execution_count_for_key:0; unique_admitted_delivery_idempotency_key_count:0; distinct_delivery_eligibility_token_count:0; receipt_binding_kind:'no_receipt_cas_loser'; transport_idempotency_key:null; consumption_receipt_digest:null; no_receipt_reason:'cas_outcome_loser'; delivery_eligibility_token:null; delivery_intent:null; final_route_delivery_binding_digest:Sha256 }>)
  | (M3FinalizationCommonV1 & Readonly<{ branch:'invalid_finalization_authority'; code:'invalid_finalization_authority'; path:string; delivery_eligible:false; new_delivery_eligibility:false; receipt_port_invocation_count:0; transport_execution_count_for_key:0; unique_admitted_delivery_idempotency_key_count:0; distinct_delivery_eligibility_token_count:0; delivery_eligibility_token:null; delivery_intent:null; final_route_delivery_binding_digest:null }>)

const inputKeys = [
  'input_version','state','event','profiles','evaluation','decision_url','evaluated_at','recovery_role_id_or_null',
  'authority_bundle','combined_task_assignment_authority','cutover_profile','route_selection','repair_budget_profile','repair_attempt_ledger',
  'repair_attempt_evidence_or_null','action_guard_proof_or_null','expected_prior_state_digest','expected_prior_ledger_digest','input_digest',
] as const
const profileKeys = ['profile_version','feature_id','mode','task_id','repository','assignment_revision','allowed_scope_digest','profile_authority_record_url','expected_m2_manifest_digest','expected_prior_state_digest','expected_prior_ledger_digest','profile_digest'] as const
const evidenceKeys = ['evidence_version','evidence_record_url','task_id','repository','assignment_revision','semantic_epoch_id','stable_finding_id','finding_domain','attempt_class','scope_digest','source_counter','predecessor_record_url','idempotency_key','evidence_digest'] as const
const routeKeys = ['kind','binding','predecessor_canonical_url','branch','worktree_identity','pr_url_or_null','head_sha_or_null','selection_digest'] as const
const noRouteKeys = ['kind','authority_record_url','reason','selection_digest'] as const
const combinedAuthorityKeys = ['schema_version','task_id','repository_full_name','assignment_revision','canonical_assignment_url','source_record_digest','source_occurrence_count','assigned_role','recommended_next_action','selected_route_bundle_id','selected_route_action_id','branch_name','worktree_binding_digest','pr_number','pr_url','pr_head_sha','predecessor_digest','scope_digest','fresh_snapshot_digest','active_profile_id','active_profile_authority_url','active_profile_mode','combined_task_assignment_authority_digest'] as const
const preparedKeys = ['schema_version','task_id','repository_full_name','assignment_revision','combined_task_assignment_authority_digest','combined_task_assignment_source_url','selected_route_bundle_id','route_identity_digest','route_selection_digest','branch_name','worktree_binding_digest','pr_number','pr_url','pr_head_sha','predecessor_digest','scope_digest','fresh_snapshot_digest','active_profile_id','active_profile_authority_url','active_profile_mode','profile_mode_binding_digest','prepared_evaluation_digest','cas_operand_digest','expected_state_digest','successor_state_digest','action_id','delivery_eligible','delivery_intent','finalization_state','prepared_route_authority_binding_digest'] as const
const casOutcomeKeys = ['schema_version','prepared_route_authority_binding_digest','combined_task_assignment_authority_digest','route_identity_digest','profile_mode_binding_digest','action_id','cas_operand_digest','expected_state_digest','observed_state_digest','successor_state_digest','outcome','compare_matched','write_applied','loser_reason','receipt_id','receipt_issuer_authority_url','receipt_issuer_authority_digest','receipt_digest','cas_outcome_proof_digest'] as const
const routeGuardKeys = ['schema_version','predecessor_guard_proof','predecessor_guard_proof_digest','prepared_route_authority_binding_digest','combined_task_assignment_authority_digest','route_identity_digest','route_selection_digest','branch_name','worktree_binding_digest','pr_number','pr_url','pr_head_sha','fresh_snapshot_digest','action_id','guard_binding_digest'] as const
const transportReceiptKeys = ['schema_version','transport_idempotency_key','prepared_route_authority_binding_digest','cas_outcome_proof_digest','action_id','owner_authority_url','owner_authority_digest','consumption_outcome','owner_state','first_receipt_digest','transport_execution_count_for_key','new_delivery_eligibility_authorized','retry_disposition','receipt_id','receipt_digest'] as const
const finalizationInputKeys = ['input_version','prepared_route_authority_binding','cas_outcome_proof','route_bound_action_guard','combined_task_assignment_authority','transport_consumption_receipt_or_null','input_digest'] as const

const object = (value: unknown): value is JsonObject => typeof value === 'object' && value !== null && !Array.isArray(value)
const clone = <T>(value: T): T => structuredClone(value)
const freeze = <T>(value: T): T => {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value as JsonObject)) freeze(child)
  }
  return value
}
const exact = (value: unknown, keys: readonly string[], path: string): Problem | undefined => {
  if (!object(value)) return { code: 'invalid_type_or_format', path }
  for (const key of keys) if (!Object.prototype.hasOwnProperty.call(value, key)) return { code: 'missing_required_field', path: `${path}/${key}` }
  const unknown = Object.keys(value).find((key) => !keys.includes(key))
  return unknown === undefined ? undefined : { code: 'unknown_field', path: `${path}/${unknown}` }
}
const nonEmpty = (value: unknown): value is string => typeof value === 'string' && value.length > 0
const uint = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0
const sha = (value: unknown): value is Sha256 => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value)
const gitSha = (value: unknown): value is FullGitSha => typeof value === 'string' && /^[0-9a-f]{40}$/.test(value)
const utc = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value) && Number.isFinite(Date.parse(value))
const canonical = (value: unknown): value is CanonicalRecordUrl => typeof value === 'string' && /^https:\/\/github\.com\/[^/]+\/[^/]+\/(?:issues|pull)\/[1-9]\d*(?:#issuecomment-[1-9]\d*)?$/.test(value)
const pr = (value: unknown): value is PrUrl => typeof value === 'string' && /^https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/[1-9]\d*$/.test(value)
const same = (left: unknown, right: unknown) => jcs(left) === jcs(right)
const without = (value: JsonObject, ...keys: string[]) => Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)))
const digestOk = (value: JsonObject, key: string) => sha(value[key]) && value[key] === digest(without(value, key))
const accepted = <T>(value: T): ClosedAdmissionResultV1<T> => freeze({ contract_version: 'closed-admission-result-v1', kind: 'accepted', value: freeze(clone(value)) })
const rejectedAdmission = <T>(problem: Problem): ClosedAdmissionResultV1<T> => freeze({ contract_version: 'closed-admission-result-v1', kind: 'rejected', rejection: { code: problem.code, path: problem.path, message: `rejected: ${problem.code}` } })
const failedAdmission = <T>(stage: string): ClosedAdmissionResultV1<T> => freeze({ contract_version: 'closed-admission-result-v1', kind: 'failed', failure: { code: 'validator_internal_failure', diagnostic_id: digest({ stage }), safe_message: 'validator failed internally' } })
const runAdmission = <T>(stage: string, value: unknown, check: (value: JsonObject) => Problem | undefined): ClosedAdmissionResultV1<T> => {
  try {
    if (!object(value)) return rejectedAdmission({ code: 'invalid_type_or_format', path: '/' })
    const problem = check(value)
    return problem ? rejectedAdmission(problem) : accepted(value as T)
  } catch {
    return failedAdmission(stage)
  }
}

const modeAction = (mode: unknown) => mode === 'm3_cutover_v1' ? 'run_m3_authority_routing_budget_cutover_v1' : mode === 'legacy_adapter_v1' ? 'run_m3_legacy_adapter_v1' : null
const prNumber = (value: PrUrl | null): number | null => value === null ? null : Number(value.slice(value.lastIndexOf('/') + 1))
const worktreeBindingDigest = (worktreeIdentity: string) => digest({ worktree_identity: worktreeIdentity })
const predecessorDigest = (predecessor: CanonicalRecordUrl) => digest({ predecessor_canonical_url: predecessor })
const routeIdentityDigest = (authority: M3CombinedTaskAssignmentAuthorityProjectionV1, selection: Extract<M3RouteSelectionV1,{kind:'route'}>) => digest({ combined_task_assignment_authority_digest: authority.combined_task_assignment_authority_digest, source_url: authority.canonical_assignment_url, selected_route_bundle_id: authority.selected_route_bundle_id, route_binding: selection.binding, route_selection_digest: selection.selection_digest })
const profileModeBindingDigest = (authority: M3CombinedTaskAssignmentAuthorityProjectionV1) => digest({ active_profile_id: authority.active_profile_id, active_profile_authority_url: authority.active_profile_authority_url, active_profile_mode: authority.active_profile_mode, recommended_next_action: authority.recommended_next_action, combined_task_assignment_authority_digest: authority.combined_task_assignment_authority_digest, source_url: authority.canonical_assignment_url })

const combinedAuthorityProblem = (value: unknown, path = '/combined_task_assignment_authority'): Problem | undefined => {
  const problem = exact(value, combinedAuthorityKeys, path)
  if (problem) return problem
  const authority = value as JsonObject
  if (authority.schema_version !== M3_COMBINED_TASK_ASSIGNMENT_AUTHORITY_PROJECTION_V1_VERSION || !nonEmpty(authority.task_id) || !nonEmpty(authority.repository_full_name) || !uint(authority.assignment_revision) || !canonical(authority.canonical_assignment_url) || !sha(authority.source_record_digest) || authority.source_occurrence_count !== 1 || authority.assigned_role !== 'Backend Implementer' || !['run_m3_authority_routing_budget_cutover_v1','run_m3_legacy_adapter_v1'].includes(String(authority.recommended_next_action)) || !nonEmpty(authority.selected_route_bundle_id) || !nonEmpty(authority.selected_route_action_id) || !nonEmpty(authority.branch_name) || !sha(authority.worktree_binding_digest) || !(authority.pr_number === null || (Number.isSafeInteger(authority.pr_number) && Number(authority.pr_number) > 0)) || !(authority.pr_url === null || pr(authority.pr_url)) || !gitSha(authority.pr_head_sha) || !sha(authority.predecessor_digest) || !sha(authority.scope_digest) || !sha(authority.fresh_snapshot_digest) || authority.active_profile_id !== 'authority_routing_budget' || !canonical(authority.active_profile_authority_url) || !['m3_cutover_v1','legacy_adapter_v1'].includes(String(authority.active_profile_mode))) return { code: 'invalid_type_or_format', path }
  if ((authority.pr_url === null) !== (authority.pr_number === null) || (authority.pr_url !== null && prNumber(authority.pr_url as PrUrl) !== authority.pr_number) || modeAction(authority.active_profile_mode) !== authority.recommended_next_action) return { code: 'invalid_conditional_matrix', path }
  return digestOk(authority, 'combined_task_assignment_authority_digest') ? undefined : { code: 'invalid_cross_input_binding', path: `${path}/combined_task_assignment_authority_digest` }
}

export const validateM3CombinedTaskAssignmentAuthorityProjectionV1 = (value: unknown): ClosedAdmissionResultV1<M3CombinedTaskAssignmentAuthorityProjectionV1> => runAdmission('m3_combined_task_assignment_authority', value, (input) => combinedAuthorityProblem(input))
export const sealM3CombinedTaskAssignmentAuthorityProjectionV1 = (value: Omit<M3CombinedTaskAssignmentAuthorityProjectionV1,'combined_task_assignment_authority_digest'>): M3CombinedTaskAssignmentAuthorityProjectionV1 => freeze({ ...clone(value), combined_task_assignment_authority_digest: digest(value) })

const preparedProblem = (value: unknown, path = '/prepared_route_authority_binding'): Problem | undefined => {
  const problem = exact(value, preparedKeys, path)
  if (problem) return problem
  const prepared = value as JsonObject
  if (prepared.schema_version !== M3_PREPARED_ROUTE_AUTHORITY_BINDING_V1_VERSION || !nonEmpty(prepared.task_id) || !nonEmpty(prepared.repository_full_name) || !uint(prepared.assignment_revision) || !sha(prepared.combined_task_assignment_authority_digest) || !canonical(prepared.combined_task_assignment_source_url) || !nonEmpty(prepared.selected_route_bundle_id) || !sha(prepared.route_identity_digest) || !sha(prepared.route_selection_digest) || !nonEmpty(prepared.branch_name) || !sha(prepared.worktree_binding_digest) || !(prepared.pr_number === null || (Number.isSafeInteger(prepared.pr_number) && Number(prepared.pr_number) > 0)) || !(prepared.pr_url === null || pr(prepared.pr_url)) || !gitSha(prepared.pr_head_sha) || !sha(prepared.predecessor_digest) || !sha(prepared.scope_digest) || !sha(prepared.fresh_snapshot_digest) || prepared.active_profile_id !== 'authority_routing_budget' || !canonical(prepared.active_profile_authority_url) || !['m3_cutover_v1','legacy_adapter_v1'].includes(String(prepared.active_profile_mode)) || !sha(prepared.profile_mode_binding_digest) || !sha(prepared.prepared_evaluation_digest) || !sha(prepared.cas_operand_digest) || !sha(prepared.expected_state_digest) || !sha(prepared.successor_state_digest) || !nonEmpty(prepared.action_id) || prepared.delivery_eligible !== false || prepared.delivery_intent !== null || prepared.finalization_state !== 'awaiting_cas_outcome') return { code: 'invalid_type_or_format', path }
  if ((prepared.pr_url === null) !== (prepared.pr_number === null) || (prepared.pr_url !== null && prNumber(prepared.pr_url as PrUrl) !== prepared.pr_number)) return { code: 'invalid_conditional_matrix', path }
  return digestOk(prepared, 'prepared_route_authority_binding_digest') ? undefined : { code: 'invalid_cross_input_binding', path: `${path}/prepared_route_authority_binding_digest` }
}

const casOutcomeProblem = (value: unknown, path = '/cas_outcome_proof'): Problem | undefined => {
  const problem = exact(value, casOutcomeKeys, path)
  if (problem) return problem
  const proof = value as JsonObject
  if (proof.schema_version !== M3_CAS_OUTCOME_PROOF_V1_VERSION || ![proof.prepared_route_authority_binding_digest,proof.combined_task_assignment_authority_digest,proof.route_identity_digest,proof.profile_mode_binding_digest,proof.cas_operand_digest,proof.expected_state_digest,proof.observed_state_digest,proof.successor_state_digest,proof.receipt_issuer_authority_digest,proof.receipt_digest].every(sha) || !nonEmpty(proof.action_id) || !['winner','loser'].includes(String(proof.outcome)) || typeof proof.compare_matched !== 'boolean' || typeof proof.write_applied !== 'boolean' || !(proof.loser_reason === null || ['compare_mismatch','already_consumed'].includes(String(proof.loser_reason))) || !nonEmpty(proof.receipt_id) || !canonical(proof.receipt_issuer_authority_url)) return { code: 'invalid_type_or_format', path }
  if (proof.outcome === 'winner' ? (proof.compare_matched !== true || proof.write_applied !== true || proof.loser_reason !== null || proof.observed_state_digest !== proof.expected_state_digest) : (proof.write_applied !== false || proof.loser_reason === null || (proof.compare_matched === true && proof.loser_reason !== 'already_consumed'))) return { code: 'invalid_conditional_matrix', path }
  return digestOk(proof, 'cas_outcome_proof_digest') ? undefined : { code: 'invalid_cross_input_binding', path: `${path}/cas_outcome_proof_digest` }
}

const routeGuardProblem = (value: unknown, path = '/route_bound_action_guard'): Problem | undefined => {
  const problem = exact(value, routeGuardKeys, path)
  if (problem) return problem
  const guard = value as JsonObject
  const predecessor = validateActionGuardProofV1(guard.predecessor_guard_proof)
  if (guard.schema_version !== M3_ROUTE_BOUND_ACTION_GUARD_V1_VERSION || predecessor.kind !== 'accepted' || !sha(guard.predecessor_guard_proof_digest) || guard.predecessor_guard_proof_digest !== (predecessor.kind === 'accepted' ? predecessor.value.proof_digest : null) || ![guard.prepared_route_authority_binding_digest,guard.combined_task_assignment_authority_digest,guard.route_identity_digest,guard.route_selection_digest,guard.worktree_binding_digest,guard.fresh_snapshot_digest].every(sha) || !nonEmpty(guard.branch_name) || !(guard.pr_number === null || (Number.isSafeInteger(guard.pr_number) && Number(guard.pr_number) > 0)) || !(guard.pr_url === null || pr(guard.pr_url)) || !gitSha(guard.pr_head_sha) || !nonEmpty(guard.action_id)) return { code: 'invalid_type_or_format', path }
  if ((guard.pr_url === null) !== (guard.pr_number === null) || (guard.pr_url !== null && prNumber(guard.pr_url as PrUrl) !== guard.pr_number)) return { code: 'invalid_conditional_matrix', path }
  return digestOk(guard, 'guard_binding_digest') ? undefined : { code: 'invalid_cross_input_binding', path: `${path}/guard_binding_digest` }
}

export const deriveM3FirstReceiptDigestV1 = (value: Pick<M3TransportConsumptionReceiptV1,'transport_idempotency_key'|'prepared_route_authority_binding_digest'|'cas_outcome_proof_digest'|'action_id'|'owner_authority_url'|'owner_authority_digest'>): Sha256 => digest({ schema_version: M3_TRANSPORT_CONSUMPTION_RECEIPT_V1_VERSION, transport_idempotency_key: value.transport_idempotency_key, prepared_route_authority_binding_digest: value.prepared_route_authority_binding_digest, cas_outcome_proof_digest: value.cas_outcome_proof_digest, action_id: value.action_id, owner_authority_url: value.owner_authority_url, owner_authority_digest: value.owner_authority_digest })

const transportReceiptProblem = (value: unknown, path = '/transport_consumption_receipt_or_null'): Problem | undefined => {
  const problem = exact(value, transportReceiptKeys, path)
  if (problem) return problem
  const receipt = value as JsonObject
  if (receipt.schema_version !== M3_TRANSPORT_CONSUMPTION_RECEIPT_V1_VERSION || ![receipt.transport_idempotency_key,receipt.prepared_route_authority_binding_digest,receipt.cas_outcome_proof_digest,receipt.owner_authority_digest,receipt.first_receipt_digest].every(sha) || !nonEmpty(receipt.action_id) || !canonical(receipt.owner_authority_url) || !['acquired','owner_in_progress','already_consumed'].includes(String(receipt.consumption_outcome)) || !['reserved_not_executed','executed'].includes(String(receipt.owner_state)) || ![0,1].includes(Number(receipt.transport_execution_count_for_key)) || typeof receipt.new_delivery_eligibility_authorized !== 'boolean' || !(receipt.retry_disposition === null || receipt.retry_disposition === 'replay_wait') || !nonEmpty(receipt.receipt_id)) return { code: 'invalid_type_or_format', path }
  const first = deriveM3FirstReceiptDigestV1(receipt as unknown as M3TransportConsumptionReceiptV1)
  if (receipt.first_receipt_digest !== first) return { code: 'invalid_cross_input_binding', path: `${path}/first_receipt_digest` }
  if (receipt.consumption_outcome === 'acquired' ? (receipt.owner_state !== 'reserved_not_executed' || receipt.transport_execution_count_for_key !== 0 || receipt.new_delivery_eligibility_authorized !== true || receipt.retry_disposition !== null) : receipt.consumption_outcome === 'owner_in_progress' ? (receipt.owner_state !== 'reserved_not_executed' || receipt.transport_execution_count_for_key !== 0 || receipt.new_delivery_eligibility_authorized !== false || receipt.retry_disposition !== 'replay_wait') : (receipt.owner_state !== 'executed' || receipt.transport_execution_count_for_key !== 1 || receipt.new_delivery_eligibility_authorized !== false || receipt.retry_disposition !== null)) return { code: 'invalid_conditional_matrix', path }
  return digestOk(receipt, 'receipt_digest') ? undefined : { code: 'invalid_cross_input_binding', path: `${path}/receipt_digest` }
}

export const validateM3PreparedRouteAuthorityBindingV1 = (value: unknown): ClosedAdmissionResultV1<M3PreparedRouteAuthorityBindingV1> => runAdmission('m3_prepared_route_authority_binding', value, (input) => preparedProblem(input))
export const validateM3CasOutcomeProofV1 = (value: unknown): ClosedAdmissionResultV1<M3CasOutcomeProofV1> => runAdmission('m3_cas_outcome_proof', value, (input) => casOutcomeProblem(input))
export const validateM3RouteBoundActionGuardV1 = (value: unknown): ClosedAdmissionResultV1<M3RouteBoundActionGuardV1> => runAdmission('m3_route_bound_action_guard', value, (input) => routeGuardProblem(input))
export const validateM3TransportConsumptionReceiptV1 = (value: unknown): ClosedAdmissionResultV1<M3TransportConsumptionReceiptV1> => runAdmission('m3_transport_consumption_receipt', value, (input) => transportReceiptProblem(input))
export const sealM3CasOutcomeProofV1 = (value: Omit<M3CasOutcomeProofV1,'cas_outcome_proof_digest'>): M3CasOutcomeProofV1 => freeze({ ...clone(value), cas_outcome_proof_digest: digest(value) })
export const sealM3RouteBoundActionGuardV1 = (value: Omit<M3RouteBoundActionGuardV1,'guard_binding_digest'>): M3RouteBoundActionGuardV1 => freeze({ ...clone(value), guard_binding_digest: digest(value) })
export const sealM3TransportConsumptionReceiptV1 = (value: Omit<M3TransportConsumptionReceiptV1,'first_receipt_digest'|'receipt_digest'>): M3TransportConsumptionReceiptV1 => {
  const first_receipt_digest = deriveM3FirstReceiptDigestV1(value as unknown as M3TransportConsumptionReceiptV1)
  const base = { ...clone(value), first_receipt_digest }
  return freeze({ ...base, receipt_digest: digest(base) })
}

const finalizationInputProblem = (value: unknown, path = '/m3_delivery_finalize'): Problem | undefined => {
  const problem = exact(value, finalizationInputKeys, path)
  if (problem) return problem
  const input = value as unknown as M3DeliveryFinalizationInputV1
  if (input.input_version !== M3_DELIVERY_FINALIZATION_INPUT_V1_VERSION) return { code:'invalid_type_or_format', path:`${path}/input_version` }
  const preparedFailure = preparedProblem(input.prepared_route_authority_binding, `${path}/prepared_route_authority_binding`)
  if (preparedFailure) return preparedFailure
  const casFailure = casOutcomeProblem(input.cas_outcome_proof, `${path}/cas_outcome_proof`)
  if (casFailure) return casFailure
  const guardFailure = routeGuardProblem(input.route_bound_action_guard, `${path}/route_bound_action_guard`)
  if (guardFailure) return guardFailure
  const authorityFailure = combinedAuthorityProblem(input.combined_task_assignment_authority, `${path}/combined_task_assignment_authority`)
  if (authorityFailure) return authorityFailure
  if (input.transport_consumption_receipt_or_null !== null) {
    const receiptFailure = transportReceiptProblem(input.transport_consumption_receipt_or_null, `${path}/transport_consumption_receipt_or_null`)
    if (receiptFailure) return receiptFailure
  }

  const prepared = input.prepared_route_authority_binding
  const cas = input.cas_outcome_proof
  const guard = input.route_bound_action_guard
  const authority = input.combined_task_assignment_authority
  const predecessor = guard.predecessor_guard_proof
  const bound =
    prepared.combined_task_assignment_authority_digest === authority.combined_task_assignment_authority_digest &&
    prepared.combined_task_assignment_source_url === authority.canonical_assignment_url &&
    prepared.task_id === authority.task_id &&
    prepared.repository_full_name === authority.repository_full_name &&
    prepared.assignment_revision === authority.assignment_revision &&
    prepared.selected_route_bundle_id === authority.selected_route_bundle_id &&
    prepared.branch_name === authority.branch_name &&
    prepared.worktree_binding_digest === authority.worktree_binding_digest &&
    prepared.pr_number === authority.pr_number && prepared.pr_url === authority.pr_url &&
    prepared.pr_head_sha === authority.pr_head_sha && prepared.predecessor_digest === authority.predecessor_digest &&
    prepared.scope_digest === authority.scope_digest && prepared.fresh_snapshot_digest === authority.fresh_snapshot_digest &&
    prepared.active_profile_id === authority.active_profile_id && prepared.active_profile_authority_url === authority.active_profile_authority_url &&
    prepared.active_profile_mode === authority.active_profile_mode && prepared.profile_mode_binding_digest === profileModeBindingDigest(authority) &&
    prepared.action_id === authority.selected_route_action_id &&
    cas.prepared_route_authority_binding_digest === prepared.prepared_route_authority_binding_digest &&
    cas.combined_task_assignment_authority_digest === authority.combined_task_assignment_authority_digest &&
    cas.route_identity_digest === prepared.route_identity_digest && cas.profile_mode_binding_digest === prepared.profile_mode_binding_digest &&
    cas.action_id === prepared.action_id && cas.cas_operand_digest === prepared.cas_operand_digest &&
    cas.expected_state_digest === prepared.expected_state_digest && cas.successor_state_digest === prepared.successor_state_digest &&
    guard.prepared_route_authority_binding_digest === prepared.prepared_route_authority_binding_digest &&
    guard.combined_task_assignment_authority_digest === authority.combined_task_assignment_authority_digest &&
    guard.route_identity_digest === prepared.route_identity_digest && guard.route_selection_digest === prepared.route_selection_digest &&
    guard.branch_name === prepared.branch_name && guard.worktree_binding_digest === prepared.worktree_binding_digest &&
    guard.pr_number === prepared.pr_number && guard.pr_url === prepared.pr_url && guard.pr_head_sha === prepared.pr_head_sha &&
    guard.fresh_snapshot_digest === prepared.fresh_snapshot_digest && guard.action_id === prepared.action_id &&
    predecessor.task_id === prepared.task_id && predecessor.repository === prepared.repository_full_name &&
    predecessor.assignment_revision === prepared.assignment_revision && predecessor.action_id === prepared.action_id &&
    predecessor.guard_scope === 'non_protected_transport' && predecessor.evaluation_snapshot_digest === prepared.fresh_snapshot_digest &&
    (prepared.pr_url === null
      ? predecessor.action_snapshot.pr_url_or_null === null && predecessor.action_snapshot.pr_head_sha_or_null === null && predecessor.action_snapshot.main_sha_or_null === prepared.pr_head_sha
      : predecessor.action_snapshot.pr_url_or_null === prepared.pr_url && predecessor.action_snapshot.pr_head_sha_or_null === prepared.pr_head_sha) &&
    predecessor.action_snapshot.workspace_state === 'clean_bound'
  if (!bound) return { code:'invalid_cross_input_binding', path:`${path}/prepared_route_authority_binding` }

  if (cas.outcome === 'loser') {
    if (input.transport_consumption_receipt_or_null !== null) return { code:'invalid_conditional_matrix', path:`${path}/transport_consumption_receipt_or_null` }
  } else {
    const receipt = input.transport_consumption_receipt_or_null
    if (receipt === null) return { code:'missing_required_field', path:`${path}/transport_consumption_receipt_or_null` }
    if (receipt.prepared_route_authority_binding_digest !== prepared.prepared_route_authority_binding_digest || receipt.cas_outcome_proof_digest !== cas.cas_outcome_proof_digest || receipt.action_id !== prepared.action_id) return { code:'invalid_cross_input_binding', path:`${path}/transport_consumption_receipt_or_null` }
  }
  return digestOk(input as unknown as JsonObject, 'input_digest') ? undefined : { code:'invalid_cross_input_binding', path:`${path}/input_digest` }
}

export const validateM3DeliveryFinalizationInputV1 = (value: unknown): ClosedAdmissionResultV1<M3DeliveryFinalizationInputV1> => runAdmission('m3_delivery_finalization_input', value, (input) => finalizationInputProblem(input))
export const sealM3DeliveryFinalizationInputV1 = (value: Omit<M3DeliveryFinalizationInputV1,'input_digest'>): M3DeliveryFinalizationInputV1 => freeze({ ...clone(value), input_digest:digest(value) })

const transportIdempotencyKey = (prepared:M3PreparedRouteAuthorityBindingV1, cas:M3CasOutcomeProofV1): Sha256 => digest({
  task_id:prepared.task_id, repository_full_name:prepared.repository_full_name, assignment_revision:prepared.assignment_revision,
  action_id:prepared.action_id, prepared_route_authority_binding_digest:prepared.prepared_route_authority_binding_digest,
  cas_outcome_proof_digest:cas.cas_outcome_proof_digest, route_identity_digest:prepared.route_identity_digest,
  profile_mode_binding_digest:prepared.profile_mode_binding_digest, pr_head_sha:prepared.pr_head_sha,
})

type M3FinalRouteDeliveryBranchV1 = 'eligible_token' | 'owner_in_progress_rejected' | 'already_consumed_rejected' | 'cas_loser_rejected'

const finalBinding = (input:M3DeliveryFinalizationInputV1, delivery_result_branch:M3FinalRouteDeliveryBranchV1, receipt:M3TransportConsumptionReceiptV1|null):Sha256 => {
  const common = {
    schema_version:'m3_final_route_delivery_binding_v1' as const,
    prepared_route_authority_binding_digest:input.prepared_route_authority_binding.prepared_route_authority_binding_digest,
    cas_outcome_proof_digest:input.cas_outcome_proof.cas_outcome_proof_digest,
    predecessor_guard_proof_digest:input.route_bound_action_guard.predecessor_guard_proof_digest,
    combined_task_assignment_authority_digest:input.combined_task_assignment_authority.combined_task_assignment_authority_digest,
    route_identity_digest:input.prepared_route_authority_binding.route_identity_digest,
    profile_mode_binding_digest:input.prepared_route_authority_binding.profile_mode_binding_digest,
    delivery_result_branch,
  }
  return receipt === null
    ? digest({ ...common, receipt_binding_kind:'no_receipt_cas_loser', transport_idempotency_key:null, consumption_receipt_digest:null, transport_port_invocation_count:0, no_receipt_reason:'cas_outcome_loser' })
    : digest({ ...common, receipt_binding_kind:'transport_consumption_receipt', transport_idempotency_key:receipt.transport_idempotency_key, consumption_receipt_digest:receipt.receipt_digest, transport_port_invocation_count:1 })
}

const finalizeInvalid = (path:string):M3DeliveryFinalizationResultV1 => {
  const base = { result_version:M3_DELIVERY_FINALIZATION_RESULT_V1_VERSION, branch:'invalid_finalization_authority' as const, code:'invalid_finalization_authority' as const, path, delivery_eligible:false as const, new_delivery_eligibility:false as const, transport_execution_performed:false as const, receipt_port_invocation_count:0 as const, transport_execution_count_for_key:0 as const, unique_admitted_delivery_idempotency_key_count:0 as const, distinct_delivery_eligibility_token_count:0 as const, delivery_eligibility_token:null, delivery_intent:null, final_route_delivery_binding_digest:null }
  return freeze({ ...base, result_digest:digest(base) })
}

export const finalizeAuthorityRoutingBudgetDeliveryV1 = (value:unknown):M3DeliveryFinalizationResultV1 => {
  const admitted = validateM3DeliveryFinalizationInputV1(value)
  if (admitted.kind !== 'accepted') return finalizeInvalid(admitted.kind === 'rejected' ? admitted.rejection.path : '/m3_delivery_finalize')
  const input = admitted.value
  const cas = input.cas_outcome_proof
  if (cas.outcome === 'loser') {
    const final_route_delivery_binding_digest = finalBinding(input,'cas_loser_rejected',null)
    const base = { result_version:M3_DELIVERY_FINALIZATION_RESULT_V1_VERSION, branch:'cas_loser_rejected' as const, code:'cas_loser_not_delivery_eligible' as const, path:'/m3_delivery_finalize/cas_outcome/outcome' as const, delivery_eligible:false as const, new_delivery_eligibility:false as const, transport_execution_performed:false as const, receipt_port_invocation_count:0 as const, transport_execution_count_for_key:0 as const, unique_admitted_delivery_idempotency_key_count:0 as const, distinct_delivery_eligibility_token_count:0 as const, receipt_binding_kind:'no_receipt_cas_loser' as const, transport_idempotency_key:null, consumption_receipt_digest:null, no_receipt_reason:'cas_outcome_loser' as const, delivery_eligibility_token:null, delivery_intent:null, final_route_delivery_binding_digest }
    return freeze({ ...base, result_digest:digest(base) })
  }
  const receipt = input.transport_consumption_receipt_or_null!
  const expectedKey = transportIdempotencyKey(input.prepared_route_authority_binding,cas)
  if (receipt.transport_idempotency_key !== expectedKey) return finalizeInvalid('/m3_delivery_finalize/transport_consumption_receipt_or_null/transport_idempotency_key')
  const branch = receipt.consumption_outcome === 'acquired' ? 'eligible_token' as const : receipt.consumption_outcome === 'owner_in_progress' ? 'owner_in_progress_rejected' as const : 'already_consumed_rejected' as const
  const final_route_delivery_binding_digest = finalBinding(input,branch,receipt)
  const common = { result_version:M3_DELIVERY_FINALIZATION_RESULT_V1_VERSION, transport_execution_performed:false as const, receipt_port_invocation_count:1 as const, transport_execution_count_for_key:receipt.transport_execution_count_for_key, unique_admitted_delivery_idempotency_key_count:1 as const, delivery_intent:null, final_route_delivery_binding_digest }
  if (branch === 'eligible_token') {
    const tokenBase = { transport_idempotency_key:receipt.transport_idempotency_key, final_route_delivery_binding_digest, first_receipt_digest:receipt.first_receipt_digest }
    const delivery_eligibility_token = freeze({ ...tokenBase, token_digest:digest(tokenBase) })
    const base = { ...common, branch:'eligible_token' as const, code:'m3_delivery_eligibility_token_admitted' as const, path:null, delivery_eligible:true as const, new_delivery_eligibility:true as const, distinct_delivery_eligibility_token_count:1 as const, delivery_eligibility_token }
    return freeze({ ...base, result_digest:digest(base) })
  }
  if (branch === 'owner_in_progress_rejected') {
    const base = { ...common, branch:'owner_in_progress_rejected' as const, code:'transport_owner_in_progress' as const, path:'/m3_delivery_finalize/transport_consumption_receipt/consumption_outcome' as const, delivery_eligible:false as const, new_delivery_eligibility:false as const, distinct_delivery_eligibility_token_count:0 as const, retry_disposition:'replay_wait' as const, delivery_eligibility_token:null }
    return freeze({ ...base, result_digest:digest(base) })
  }
  const base = { ...common, branch:'already_consumed_rejected' as const, code:'transport_idempotency_already_consumed' as const, path:'/m3_delivery_finalize/transport_consumption_receipt/consumption_outcome' as const, delivery_eligible:false as const, new_delivery_eligibility:false as const, distinct_delivery_eligibility_token_count:0 as const, delivery_eligibility_token:null }
  return freeze({ ...base, result_digest:digest(base) })
}

const finalizationResultProblem = (value:JsonObject):Problem|undefined => {
  if (value.result_version !== M3_DELIVERY_FINALIZATION_RESULT_V1_VERSION || !nonEmpty(value.branch) || !sha(value.result_digest) || value.transport_execution_performed !== false || value.delivery_intent !== null || ![0,1].includes(Number(value.receipt_port_invocation_count)) || ![0,1].includes(Number(value.transport_execution_count_for_key)) || ![0,1].includes(Number(value.unique_admitted_delivery_idempotency_key_count)) || ![0,1].includes(Number(value.distinct_delivery_eligibility_token_count))) return { code:'invalid_type_or_format', path:'/m3_delivery_finalization_result' }
  const branchKeys:Record<string,readonly string[]> = {
    eligible_token:['result_version','branch','code','path','delivery_eligible','new_delivery_eligibility','transport_execution_performed','receipt_port_invocation_count','transport_execution_count_for_key','unique_admitted_delivery_idempotency_key_count','distinct_delivery_eligibility_token_count','delivery_eligibility_token','delivery_intent','final_route_delivery_binding_digest','result_digest'],
    owner_in_progress_rejected:['result_version','branch','code','path','delivery_eligible','new_delivery_eligibility','transport_execution_performed','receipt_port_invocation_count','transport_execution_count_for_key','unique_admitted_delivery_idempotency_key_count','distinct_delivery_eligibility_token_count','retry_disposition','delivery_eligibility_token','delivery_intent','final_route_delivery_binding_digest','result_digest'],
    already_consumed_rejected:['result_version','branch','code','path','delivery_eligible','new_delivery_eligibility','transport_execution_performed','receipt_port_invocation_count','transport_execution_count_for_key','unique_admitted_delivery_idempotency_key_count','distinct_delivery_eligibility_token_count','delivery_eligibility_token','delivery_intent','final_route_delivery_binding_digest','result_digest'],
    cas_loser_rejected:['result_version','branch','code','path','delivery_eligible','new_delivery_eligibility','transport_execution_performed','receipt_port_invocation_count','transport_execution_count_for_key','unique_admitted_delivery_idempotency_key_count','distinct_delivery_eligibility_token_count','receipt_binding_kind','transport_idempotency_key','consumption_receipt_digest','no_receipt_reason','delivery_eligibility_token','delivery_intent','final_route_delivery_binding_digest','result_digest'],
    invalid_finalization_authority:['result_version','branch','code','path','delivery_eligible','new_delivery_eligibility','transport_execution_performed','receipt_port_invocation_count','transport_execution_count_for_key','unique_admitted_delivery_idempotency_key_count','distinct_delivery_eligibility_token_count','delivery_eligibility_token','delivery_intent','final_route_delivery_binding_digest','result_digest'],
  }
  const keys = branchKeys[String(value.branch)]
  if (!keys) return { code:'invalid_enum', path:'/m3_delivery_finalization_result/branch' }
  const exactFailure = exact(value,keys,'/m3_delivery_finalization_result')
  if (exactFailure) return exactFailure
  if (value.branch === 'eligible_token') {
    const token = value.delivery_eligibility_token
    if (value.code !== 'm3_delivery_eligibility_token_admitted' || value.path !== null || value.delivery_eligible !== true || value.new_delivery_eligibility !== true || value.receipt_port_invocation_count !== 1 || value.transport_execution_count_for_key !== 0 || value.unique_admitted_delivery_idempotency_key_count !== 1 || value.distinct_delivery_eligibility_token_count !== 1 || !sha(value.final_route_delivery_binding_digest) || !object(token) || exact(token,['transport_idempotency_key','final_route_delivery_binding_digest','first_receipt_digest','token_digest'],'/m3_delivery_finalization_result/delivery_eligibility_token') || ![token.transport_idempotency_key,token.final_route_delivery_binding_digest,token.first_receipt_digest].every(sha) || token.final_route_delivery_binding_digest !== value.final_route_delivery_binding_digest || !digestOk(token,'token_digest')) return { code:'invalid_conditional_matrix', path:'/m3_delivery_finalization_result' }
  } else if (value.branch === 'owner_in_progress_rejected') {
    if (value.code !== 'transport_owner_in_progress' || value.path !== '/m3_delivery_finalize/transport_consumption_receipt/consumption_outcome' || value.delivery_eligible !== false || value.new_delivery_eligibility !== false || value.receipt_port_invocation_count !== 1 || value.transport_execution_count_for_key !== 0 || value.unique_admitted_delivery_idempotency_key_count !== 1 || value.distinct_delivery_eligibility_token_count !== 0 || value.retry_disposition !== 'replay_wait' || value.delivery_eligibility_token !== null || !sha(value.final_route_delivery_binding_digest)) return { code:'invalid_conditional_matrix', path:'/m3_delivery_finalization_result' }
  } else if (value.branch === 'already_consumed_rejected') {
    if (value.code !== 'transport_idempotency_already_consumed' || value.path !== '/m3_delivery_finalize/transport_consumption_receipt/consumption_outcome' || value.delivery_eligible !== false || value.new_delivery_eligibility !== false || value.receipt_port_invocation_count !== 1 || value.transport_execution_count_for_key !== 1 || value.unique_admitted_delivery_idempotency_key_count !== 1 || value.distinct_delivery_eligibility_token_count !== 0 || value.delivery_eligibility_token !== null || !sha(value.final_route_delivery_binding_digest)) return { code:'invalid_conditional_matrix', path:'/m3_delivery_finalization_result' }
  } else if (value.branch === 'cas_loser_rejected') {
    if (value.code !== 'cas_loser_not_delivery_eligible' || value.path !== '/m3_delivery_finalize/cas_outcome/outcome' || value.delivery_eligible !== false || value.new_delivery_eligibility !== false || value.receipt_port_invocation_count !== 0 || value.transport_execution_count_for_key !== 0 || value.unique_admitted_delivery_idempotency_key_count !== 0 || value.distinct_delivery_eligibility_token_count !== 0 || value.receipt_binding_kind !== 'no_receipt_cas_loser' || value.transport_idempotency_key !== null || value.consumption_receipt_digest !== null || value.no_receipt_reason !== 'cas_outcome_loser' || value.delivery_eligibility_token !== null || !sha(value.final_route_delivery_binding_digest)) return { code:'invalid_conditional_matrix', path:'/m3_delivery_finalization_result' }
  } else if (value.code !== 'invalid_finalization_authority' || !nonEmpty(value.path) || value.delivery_eligible !== false || value.new_delivery_eligibility !== false || value.receipt_port_invocation_count !== 0 || value.transport_execution_count_for_key !== 0 || value.unique_admitted_delivery_idempotency_key_count !== 0 || value.distinct_delivery_eligibility_token_count !== 0 || value.delivery_eligibility_token !== null || value.final_route_delivery_binding_digest !== null) return { code:'invalid_conditional_matrix', path:'/m3_delivery_finalization_result' }
  return digestOk(value,'result_digest') ? undefined : { code:'invalid_cross_input_binding', path:'/m3_delivery_finalization_result/result_digest' }
}

export const validateM3DeliveryFinalizationResultV1 = (value:unknown):ClosedAdmissionResultV1<M3DeliveryFinalizationResultV1> => runAdmission('m3_delivery_finalization_result',value,(input)=>finalizationResultProblem(input))

const profileProblem = (value: unknown, path = '/cutover_profile'): Problem | undefined => {
  const problem = exact(value, profileKeys, path)
  if (problem) return problem
  const profile = value as JsonObject
  if (
    profile.profile_version !== AUTHORITY_ROUTING_BUDGET_CUTOVER_PROFILE_V1_VERSION ||
    profile.feature_id !== 'authority_routing_budget' ||
    !['m3_cutover_v1','legacy_adapter_v1'].includes(String(profile.mode)) ||
    !nonEmpty(profile.task_id) || !nonEmpty(profile.repository) || !uint(profile.assignment_revision) ||
    !sha(profile.allowed_scope_digest) || !canonical(profile.profile_authority_record_url) ||
    profile.expected_m2_manifest_digest !== M3_EXPECTED_M2_MANIFEST_DIGEST ||
    !sha(profile.expected_prior_state_digest) || !sha(profile.expected_prior_ledger_digest)
  ) return { code: 'invalid_type_or_format', path }
  return digestOk(profile, 'profile_digest') ? undefined : { code: 'invalid_cross_input_binding', path: `${path}/profile_digest` }
}

const routeSelectionProblem = (value: unknown): Problem | undefined => {
  if (!object(value)) return { code: 'invalid_type_or_format', path: '/route_selection' }
  if (value.kind === 'route') {
    const problem = exact(value, routeKeys, '/route_selection')
    if (problem) return problem
    if (validateRouteBindingV1(value.binding).kind !== 'accepted' || !canonical(value.predecessor_canonical_url) || !nonEmpty(value.branch) || !nonEmpty(value.worktree_identity) || !(value.pr_url_or_null === null || pr(value.pr_url_or_null)) || !(value.head_sha_or_null === null || gitSha(value.head_sha_or_null))) return { code: 'invalid_type_or_format', path: '/route_selection' }
  } else if (value.kind === 'no_route') {
    const problem = exact(value, noRouteKeys, '/route_selection')
    if (problem) return problem
    if (!canonical(value.authority_record_url) || value.reason !== 'no_declared_transition') return { code: 'invalid_type_or_format', path: '/route_selection' }
  } else return { code: 'invalid_enum', path: '/route_selection/kind' }
  return digestOk(value, 'selection_digest') ? undefined : { code: 'invalid_cross_input_binding', path: '/route_selection/selection_digest' }
}

const evidenceProblem = (value: unknown): Problem | undefined => {
  const problem = exact(value, evidenceKeys, '/repair_attempt_evidence_or_null')
  if (problem) return problem
  const evidence = value as JsonObject
  if (
    evidence.evidence_version !== REPAIR_ATTEMPT_EVIDENCE_V1_VERSION || !canonical(evidence.evidence_record_url) ||
    !nonEmpty(evidence.task_id) || !nonEmpty(evidence.repository) || !uint(evidence.assignment_revision) ||
    !sha(evidence.semantic_epoch_id) || !nonEmpty(evidence.stable_finding_id) ||
    !['architecture','implementation','metadata','validation','publication'].includes(String(evidence.finding_domain)) ||
    !['technical','architecture','metadata','delivery'].includes(String(evidence.attempt_class)) || !sha(evidence.scope_digest) ||
    !uint(evidence.source_counter) || !canonical(evidence.predecessor_record_url) || !sha(evidence.idempotency_key)
  ) return { code: 'invalid_type_or_format', path: '/repair_attempt_evidence_or_null' }
  const expectedClass = evidence.finding_domain === 'architecture' ? 'architecture' : evidence.finding_domain === 'metadata' ? 'metadata' : evidence.finding_domain === 'publication' && evidence.attempt_class === 'delivery' ? 'delivery' : 'technical'
  if (evidence.attempt_class !== expectedClass) return { code: 'invalid_cross_input_binding', path: '/repair_attempt_evidence_or_null/attempt_class' }
  const expectedKey = digest({ task_id: evidence.task_id, repository: evidence.repository, assignment_revision: evidence.assignment_revision, semantic_epoch_id: evidence.semantic_epoch_id, stable_finding_id: evidence.stable_finding_id, finding_domain: evidence.finding_domain, attempt_class: evidence.attempt_class, scope_digest: evidence.scope_digest, source_counter: evidence.source_counter, predecessor_record_url: evidence.predecessor_record_url })
  if (evidence.idempotency_key !== expectedKey || !digestOk(evidence, 'evidence_digest')) return { code: 'invalid_cross_input_binding', path: '/repair_attempt_evidence_or_null/idempotency_key' }
  return undefined
}

const routeRequired = (evaluation: ProgressionEvaluatorResultV1) => evaluation.kind === 'recommend_next_role'
const routeForbidden = (evaluation: ProgressionEvaluatorResultV1) => ['no_transition','require_gate_status_update','invalidate_approval','stop','complete_task_candidate','wait_for_protected_action'].includes(evaluation.kind)

const inputProblem = (value: JsonObject): Problem | undefined => {
  let problem = exact(value, inputKeys, '/input')
  if (problem) return problem
  if (value.input_version !== AUTHORITY_ROUTING_BUDGET_CUTOVER_INPUT_V1_VERSION || !canonical(value.decision_url) || !utc(value.evaluated_at) || !(value.recovery_role_id_or_null === null || nonEmpty(value.recovery_role_id_or_null)) || !sha(value.expected_prior_state_digest) || !sha(value.expected_prior_ledger_digest)) return { code: 'invalid_type_or_format', path: '/input' }
  const profile = validateGenericProgressRunnerProfilesV1(value.profiles)
  const state = profile.kind === 'accepted' ? validateContinuousOrchestrationStateV1(value.state, profile.value) : profile
  const event = validateContinuousOrchestrationEventV1(value.event)
  const evaluation = validateProgressionEvaluatorResultV1(value.evaluation)
  const bundle = validateAdmittedAuthorityBundleV1(value.authority_bundle)
  const combined = validateM3CombinedTaskAssignmentAuthorityProjectionV1(value.combined_task_assignment_authority)
  const budget = validateRepairBudgetProfileV1(value.repair_budget_profile)
  const ledger = validateRepairAttemptLedgerV1(value.repair_attempt_ledger)
  problem = profileProblem(value.cutover_profile) ?? routeSelectionProblem(value.route_selection)
  if (problem) return problem
  if (profile.kind !== 'accepted' || state.kind !== 'accepted' || event.kind !== 'accepted' || evaluation.kind !== 'accepted' || bundle.kind !== 'accepted' || combined.kind !== 'accepted' || budget.kind !== 'accepted' || ledger.kind !== 'accepted') return { code: 'invalid_cross_input_binding', path: '/input/admitted_authority' }
  if (value.repair_attempt_evidence_or_null !== null && (problem = evidenceProblem(value.repair_attempt_evidence_or_null))) return problem
  const input = value as unknown as AuthorityRoutingBudgetCutoverInputV1
  const s = state.value as ContinuousOrchestrationStateV1
  const e = event.value as ContinuousOrchestrationEventV1
  const b = bundle.value as AdmittedAuthorityBundleV1
  const p = input.cutover_profile
  const ca = combined.value as M3CombinedTaskAssignmentAuthorityProjectionV1
  const rb = budget.value as RepairBudgetProfileV1
  const rl = ledger.value as RepairAttemptLedgerV1
  const stateDigest = digest(s)
  const taskAssignmentSources = b.sources.filter((source) => source.source_type === 'task_assignment')
  const taskAssignmentSource = taskAssignmentSources[0]
  const taskAssignmentUrl = taskAssignmentSource && object(taskAssignmentSource.source_ref) && taskAssignmentSource.source_ref.kind === 'canonical_record' ? taskAssignmentSource.source_ref.url : null
  const taskAssignmentOwner = input.profiles.authority_projection_profile.source_type_bindings.find((binding) => binding.source_type === 'task_assignment')?.authority_owner_contract_url
  if (
    input.expected_prior_state_digest !== stateDigest || input.expected_prior_ledger_digest !== rl.ledger_digest ||
    p.expected_prior_state_digest !== stateDigest || p.expected_prior_ledger_digest !== rl.ledger_digest ||
    b.task_id !== s.task_id || b.repository !== s.repository || b.assignment_revision !== s.assignment_revision ||
    p.task_id !== s.task_id || p.repository !== s.repository || p.assignment_revision !== s.assignment_revision ||
    rb.task_id !== s.task_id || rb.repository !== s.repository || rb.assignment_revision !== s.assignment_revision ||
    rl.task_id !== s.task_id || rl.repository !== s.repository || rl.assignment_revision !== s.assignment_revision ||
    rb.semantic_epoch_id !== s.semantic_counter_epoch.epoch_id || rl.semantic_epoch_id !== rb.semantic_epoch_id ||
    rl.profile_digest !== rb.profile_digest || b.scope_digest !== rb.allowed_scope_digest || p.allowed_scope_digest !== rb.allowed_scope_digest ||
    e.task_id !== s.task_id || e.assignment_revision !== s.assignment_revision || e.authority_snapshot_digest !== s.authority_snapshot.snapshot_digest ||
    b.fresh_snapshot.repository !== s.authority_snapshot.repository || b.fresh_snapshot.main_sha_or_null !== s.authority_snapshot.main_sha_or_null ||
    b.fresh_snapshot.pr_url_or_null !== s.authority_snapshot.pr_url_or_null || b.fresh_snapshot.pr_head_sha_or_null !== s.authority_snapshot.pr_head_sha_or_null ||
    b.fresh_snapshot.pr_base_sha_or_null !== s.authority_snapshot.pr_base_sha_or_null || b.fresh_snapshot.pr_state !== s.authority_snapshot.pr_state ||
    b.fresh_snapshot.check_set_digest_or_null !== s.authority_snapshot.check_set_digest_or_null || b.fresh_snapshot.finding_set_digest !== s.authority_snapshot.finding_set_digest ||
    b.fresh_snapshot.thread_set_digest !== s.authority_snapshot.thread_set_digest || b.fresh_snapshot.workspace_state !== s.authority_snapshot.workspace_state ||
    b.fresh_snapshot.gsp_generation_or_null !== s.authority_snapshot.gsp_generation_or_null || b.fresh_snapshot.gsp_body_digest_or_null !== s.authority_snapshot.gsp_body_digest_or_null ||
    b.fresh_snapshot.approval_consumption_digest_or_null !== s.authority_snapshot.approval_consumption_digest_or_null || b.fresh_snapshot.observed_at !== s.authority_snapshot.observed_at ||
    !same(b.fresh_snapshot.collected_from, s.authority_snapshot.collected_from)
  ) return { code: 'invalid_cross_input_binding', path: '/input/authority_binding' }
  if (taskAssignmentSources.length !== 1 || taskAssignmentUrl !== ca.canonical_assignment_url || taskAssignmentSource.content_projection_digest !== ca.source_record_digest || taskAssignmentSource.owner_contract_url !== taskAssignmentOwner || taskAssignmentSource.authority_scope_digest !== ca.scope_digest || ca.task_id !== s.task_id || ca.repository_full_name !== s.repository || ca.assignment_revision !== s.assignment_revision || ca.scope_digest !== rb.allowed_scope_digest || ca.fresh_snapshot_digest !== b.fresh_snapshot.snapshot_digest || ca.active_profile_id !== p.feature_id || ca.active_profile_authority_url !== p.profile_authority_record_url || ca.active_profile_mode !== p.mode || ca.recommended_next_action !== modeAction(p.mode) || ca.selected_route_bundle_id !== input.profiles.route_binding_table.profile_id) return { code: 'invalid_cross_input_binding', path: '/combined_task_assignment_authority' }
  if (input.route_selection.kind === 'route') {
    const route = input.route_selection.binding
    if (route.allowed_scope_digest !== p.allowed_scope_digest || !input.profiles.route_binding_table.bindings.some((candidate) => same(candidate, route))) return { code: 'invalid_cross_input_binding', path: '/route_selection/binding' }
    if (routeRequired(input.evaluation) && (input.evaluation.target_role_id !== route.role_id || input.evaluation.next_action_id !== route.action_id || input.evaluation.predecessor_canonical_url !== input.route_selection.predecessor_canonical_url)) return { code: 'invalid_cross_input_binding', path: '/route_selection/binding' }
    const routeHeadBound = input.route_selection.pr_url_or_null === null
      ? b.fresh_snapshot.pr_url_or_null === null && b.fresh_snapshot.pr_head_sha_or_null === null && ca.pr_head_sha === b.fresh_snapshot.main_sha_or_null
      : b.fresh_snapshot.pr_url_or_null === input.route_selection.pr_url_or_null && ca.pr_head_sha === b.fresh_snapshot.pr_head_sha_or_null
    if (ca.selected_route_action_id !== route.action_id || ca.branch_name !== input.route_selection.branch || ca.worktree_binding_digest !== worktreeBindingDigest(input.route_selection.worktree_identity) || ca.pr_url !== input.route_selection.pr_url_or_null || ca.pr_number !== prNumber(input.route_selection.pr_url_or_null) || ca.pr_head_sha !== input.route_selection.head_sha_or_null || !routeHeadBound || ca.predecessor_digest !== predecessorDigest(input.route_selection.predecessor_canonical_url)) return { code: 'invalid_cross_input_binding', path: '/route_selection/authority_binding' }
    if (routeForbidden(input.evaluation)) return { code: 'invalid_conditional_matrix', path: '/route_selection/kind' }
  } else if (routeRequired(input.evaluation)) return { code: 'invalid_conditional_matrix', path: '/route_selection/kind' }
  if (input.repair_attempt_evidence_or_null) {
    const attempt = input.repair_attempt_evidence_or_null
    if (attempt.task_id !== s.task_id || attempt.repository !== s.repository || attempt.assignment_revision !== s.assignment_revision || attempt.semantic_epoch_id !== rb.semantic_epoch_id || attempt.scope_digest !== rb.allowed_scope_digest) return { code: 'invalid_cross_input_binding', path: '/repair_attempt_evidence_or_null' }
    const counterKey = repairCounterKey(attempt)
    const current = rl.entries.find((entry) => entry.counter_key === counterKey)
    const identicalReplay = current?.evidence_urls.includes(attempt.evidence_record_url) === true
    if (identicalReplay ? current.attempt_count !== attempt.source_counter + 1 : (current?.attempt_count ?? 0) !== attempt.source_counter) return { code: 'invalid_cross_input_binding', path: '/repair_attempt_evidence_or_null/source_counter' }
    if (current && (current.stable_finding_id !== attempt.stable_finding_id || current.finding_domain !== attempt.finding_domain || current.attempt_class !== attempt.attempt_class || current.scope_digest !== attempt.scope_digest)) return { code: 'invalid_cross_input_binding', path: '/repair_attempt_evidence_or_null/counter_binding' }
  }
  if (input.action_guard_proof_or_null !== null) {
    const guard = validateActionGuardProofV1(input.action_guard_proof_or_null, b.fresh_snapshot)
    if (guard.kind !== 'accepted') return { code: 'invalid_cross_input_binding', path: '/action_guard_proof_or_null' }
    if (input.route_selection.kind !== 'route' || guard.value.task_id !== s.task_id || guard.value.repository !== s.repository || guard.value.assignment_revision !== s.assignment_revision || guard.value.action_id !== input.route_selection.binding.action_id) return { code: 'invalid_cross_input_binding', path: '/action_guard_proof_or_null/action_id' }
  }
  return digestOk(value, 'input_digest') ? undefined : { code: 'invalid_cross_input_binding', path: '/input/input_digest' }
}

export const validateAuthorityRoutingBudgetCutoverProfileV1 = (value: unknown): ClosedAdmissionResultV1<AuthorityRoutingBudgetCutoverProfileV1> => runAdmission('m3_profile', value, (input) => profileProblem(input))
export const validateRepairAttemptEvidenceV1 = (value: unknown): ClosedAdmissionResultV1<RepairAttemptEvidenceV1> => runAdmission('m3_attempt_evidence', value, (input) => evidenceProblem(input))
export const validateAuthorityRoutingBudgetCutoverInputV1 = (value: unknown): ClosedAdmissionResultV1<AuthorityRoutingBudgetCutoverInputV1> => runAdmission('m3_input', value, inputProblem)

const resultRejected = (problem: Problem): AuthorityRoutingBudgetCutoverResultV1 => {
  const base = { result_version: AUTHORITY_ROUTING_BUDGET_CUTOVER_RESULT_V1_VERSION, kind: 'rejected' as const, rejection: { code: problem.code, path: problem.path, message: `rejected: ${problem.code}` }, state_changed: false as const, reduction_invocation_count: 0 as const, transport_invoked: false as const, write_invoked: false as const, protected_action_invoked: false as const }
  return freeze({ ...base, cutover_evidence_digest: digest(base) })
}

const attemptLimit = (profile: RepairBudgetProfileV1, attemptClass: RepairAttemptClassV1) => profile.attempt_limits[attemptClass]
const ledgerKey = (entry: RepairAttemptLedgerEntryV1) => `${entry.entry_kind}\0${entry.counter_key}`
const repairCounterKey = (evidence: Pick<RepairAttemptEvidenceV1,'task_id'|'semantic_epoch_id'|'stable_finding_id'|'finding_domain'|'attempt_class'|'scope_digest'>) => digest({ task_id: evidence.task_id, semantic_epoch_id: evidence.semantic_epoch_id, stable_finding_id: evidence.stable_finding_id, finding_domain: evidence.finding_domain, attempt_class: evidence.attempt_class, scope_digest: evidence.scope_digest })
const ledgerEntryFromEvidence = (evidence: RepairAttemptEvidenceV1, count: number, prior: RepairAttemptLedgerEntryV1|undefined): RepairAttemptLedgerEntryV1 => {
  const state = count >= 3 ? 'exhausted' : 'open'
  const counterKey = repairCounterKey(evidence)
  const evidenceUrls = [...new Set([...(prior?.evidence_urls ?? []), evidence.evidence_record_url])].sort(BufferlessCompare)
  if (evidence.attempt_class === 'delivery') return {
    entry_kind: 'delivery', stable_finding_id: evidence.stable_finding_id, finding_domain: evidence.finding_domain, attempt_class: 'delivery', scope_digest: evidence.scope_digest,
    counter_key: counterKey, attempt_count: count, max_attempts: 3, state: count >= 3 ? 'exhausted' : 'pending', evidence_urls: evidenceUrls,
    source_counter: { idempotency_key: evidence.stable_finding_id, delivery_count: count, last_completion_url_or_null: null, state: count >= 3 ? 'exhausted' : 'pending' },
  }
  if (evidence.attempt_class === 'metadata') return {
    entry_kind: 'metadata', stable_finding_id: evidence.stable_finding_id, finding_domain: 'metadata', attempt_class: 'metadata', scope_digest: evidence.scope_digest,
    counter_key: counterKey, attempt_count: count, max_attempts: 3, state, evidence_urls: evidenceUrls,
    source_counter: { counter_key: counterKey, pr_url: 'https://github.com/whatrune/sd-prompt-studio/pull/1', head_sha: '0'.repeat(40), projection_field_ids: [], semantic_defect_digest: evidence.stable_finding_id, originating_review_url: evidence.predecessor_record_url, subsequent_review_urls: [], write_attempt_count: count, state },
  }
  return {
    entry_kind: 'finding', stable_finding_id: evidence.stable_finding_id, finding_domain: evidence.finding_domain, attempt_class: evidence.attempt_class, scope_digest: evidence.scope_digest,
    counter_key: counterKey, attempt_count: count, max_attempts: 3, state, evidence_urls: evidenceUrls,
    source_counter: { finding_id: evidence.stable_finding_id, finding_domain: evidence.finding_domain, semantic_requirement_digest: evidence.scope_digest, allowed_scope_digest: evidence.scope_digest, counter_key: counterKey, state, correction_role_id: 'domain_repair_role', closure_role_id: 'independent_reviewer', opening_decision_url: evidence.predecessor_record_url, latest_decision_url: evidence.evidence_record_url, attempt_count: count, closed_at_attempt_or_null: null },
  }
}

type LedgerPreparation = Readonly<{ ledger: RepairAttemptLedgerV1; operand: RepairLedgerCasOperandV1 | null; replay: boolean; budgetExceeded: boolean }>
const prepareLedger = (input: AuthorityRoutingBudgetCutoverInputV1): LedgerPreparation => {
  const evidence = input.repair_attempt_evidence_or_null
  if (!evidence) return { ledger: input.repair_attempt_ledger, operand: null, replay: false, budgetExceeded: false }
  const prior = input.repair_attempt_ledger
  const counterKey = repairCounterKey(evidence)
  const matching = prior.entries.find((entry) => entry.counter_key === counterKey)
  if (matching?.evidence_urls.includes(evidence.evidence_record_url)) return { ledger: prior, operand: null, replay: true, budgetExceeded: false }
  const current = matching?.attempt_count ?? evidence.source_counter
  const limit = attemptLimit(input.repair_budget_profile, evidence.attempt_class)
  if (current >= limit) return { ledger: prior, operand: null, replay: false, budgetExceeded: true }
  const nextEntry = ledgerEntryFromEvidence(evidence, current + 1, matching)
  const entries = prior.entries.filter((entry) => entry.counter_key !== counterKey).map(clone)
  entries.push(nextEntry)
  entries.sort((left, right) => BufferlessCompare(ledgerKey(left), ledgerKey(right)))
  const { ledger_digest: _priorLedgerDigest, ...priorWithoutDigest } = prior
  const nextAdmission = deriveRepairAttemptLedgerShadowV1({ ...priorWithoutDigest, entries })
  if (nextAdmission.kind !== 'accepted') throw new TypeError('generated repair ledger rejected')
  const next = nextAdmission.value
  const routeDigest = input.route_selection.selection_digest
  const operandBase = { operand_version: REPAIR_LEDGER_CAS_OPERAND_V1_VERSION, task_id: input.state.task_id, repository: input.state.repository, assignment_revision: input.state.assignment_revision, semantic_epoch_id: prior.semantic_epoch_id, expected_prior_ledger_digest: prior.ledger_digest, next_ledger_digest: next.ledger_digest, attempt_idempotency_key: evidence.idempotency_key, expected_state_digest: input.expected_prior_state_digest, route_digest: routeDigest, authority_bundle_digest: input.authority_bundle.bundle_digest }
  const operand = freeze({ ...operandBase, operand_digest: digest(operandBase) })
  return { ledger: next, operand, replay: false, budgetExceeded: false }
}

const BufferlessCompare = (left: string, right: string) => {
  const a = new TextEncoder().encode(left), b = new TextEncoder().encode(right)
  for (let index = 0; index < Math.min(a.length, b.length); index += 1) if (a[index] !== b[index]) return a[index] - b[index]
  return a.length - b.length
}

const stopped = (input: AuthorityRoutingBudgetCutoverInputV1, preparation: LedgerPreparation, stopClass: Extract<AuthorityRoutingBudgetCutoverResultV1,{kind:'stopped'}>['stop_class'], stopReason: 'architecture_gap'|'external_blocker', actionGuardStatus: CommonResult['action_guard_status'], reduction: ContinuousOrchestrationReductionV1|null = null): AuthorityRoutingBudgetCutoverResultV1 => {
  const semantic = { result_version: AUTHORITY_ROUTING_BUDGET_CUTOVER_RESULT_V1_VERSION, kind: 'stopped' as const, stop_class: stopClass, stop_reason: stopReason, reduction_or_null: reduction, dispatch_intent_or_null: null, authority_bundle_digest: input.authority_bundle.bundle_digest, profile_digest: input.cutover_profile.profile_digest, route_selection_digest: input.route_selection.selection_digest, next_repair_ledger: preparation.ledger, ledger_cas_operand_or_null: preparation.operand, action_guard_status: actionGuardStatus, checkpoint_required: input.repair_attempt_ledger.cycle_ledger.decision_count_without_progress >= 32, reduction_invocation_count: (reduction ? 1 : 0) as 0|1, transport_invoked: false as const, write_invoked: false as const, protected_action_invoked: false as const, prepared_route_authority_binding_or_null: null, delivery_eligible: false as const, delivery_intent: null, finalization_state: 'not_applicable' as const }
  return freeze({ ...semantic, cutover_evidence_digest: digest(semantic) })
}

const dispatchFrom = (input: AuthorityRoutingBudgetCutoverInputV1, reduction: ContinuousOrchestrationReductionV1): DispatchIntentV1 | null => {
  if (input.route_selection.kind !== 'route' || !reduction.decision || !('route_binding' in reduction.decision)) return null
  if (!same(reduction.decision.route_binding, input.route_selection.binding)) throw new TypeError('reducer route divergence')
  const admission = deriveDispatchIntentShadowV1({
    dispatch_intent_version: 'dispatch_intent_v1',
    intent_kind: input.route_selection.binding.independent_from_role_id_or_null === null ? 'role_dispatch' : 'independent_review_dispatch',
    task_id: input.state.task_id,
    repository: input.state.repository,
    assignment_revision: input.state.assignment_revision,
    decision_url: input.decision_url,
    predecessor_canonical_url: input.route_selection.predecessor_canonical_url,
    route_binding: input.route_selection.binding,
    branch: input.route_selection.branch,
    worktree_identity: input.route_selection.worktree_identity,
    pr_url_or_null: input.route_selection.pr_url_or_null,
    head_sha_or_null: input.route_selection.head_sha_or_null,
    scope_digest: input.route_selection.binding.allowed_scope_digest,
    transport_authority: false,
    protected_action_authority: false,
  })
  if (admission.kind !== 'accepted') throw new TypeError('generated dispatch intent rejected')
  return admission.value
}

const prepareRouteAuthorityBinding = (input: AuthorityRoutingBudgetCutoverInputV1, reduction: ContinuousOrchestrationReductionV1, intent: DispatchIntentV1): M3PreparedRouteAuthorityBindingV1 => {
  if (input.route_selection.kind !== 'route') throw new TypeError('route required for prepared binding')
  const authority = input.combined_task_assignment_authority
  const routeIdentity = routeIdentityDigest(authority, input.route_selection)
  const profileBinding = profileModeBindingDigest(authority)
  const preparedEvaluation = digest({ reduction, provisional_dispatch_intent: intent })
  const successorState = digest(reduction.state)
  const casOperand = digest({ schema_version: 'm3_delivery_cas_operand_v1', expected_state_digest: input.expected_prior_state_digest, successor_state_digest: successorState, expected_ledger_digest: input.expected_prior_ledger_digest, next_ledger_digest: input.repair_attempt_ledger.ledger_digest, route_identity_digest: routeIdentity, profile_mode_binding_digest: profileBinding, action_id: input.route_selection.binding.action_id })
  const base = { schema_version: M3_PREPARED_ROUTE_AUTHORITY_BINDING_V1_VERSION, task_id: input.state.task_id, repository_full_name: input.state.repository, assignment_revision: input.state.assignment_revision, combined_task_assignment_authority_digest: authority.combined_task_assignment_authority_digest, combined_task_assignment_source_url: authority.canonical_assignment_url, selected_route_bundle_id: authority.selected_route_bundle_id, route_identity_digest: routeIdentity, route_selection_digest: input.route_selection.selection_digest, branch_name: authority.branch_name, worktree_binding_digest: authority.worktree_binding_digest, pr_number: authority.pr_number, pr_url: authority.pr_url, pr_head_sha: authority.pr_head_sha, predecessor_digest: authority.predecessor_digest, scope_digest: authority.scope_digest, fresh_snapshot_digest: authority.fresh_snapshot_digest, active_profile_id: authority.active_profile_id, active_profile_authority_url: authority.active_profile_authority_url, active_profile_mode: authority.active_profile_mode, profile_mode_binding_digest: profileBinding, prepared_evaluation_digest: preparedEvaluation, cas_operand_digest: casOperand, expected_state_digest: input.expected_prior_state_digest, successor_state_digest: successorState, action_id: input.route_selection.binding.action_id, delivery_eligible: false as const, delivery_intent: null, finalization_state: 'awaiting_cas_outcome' as const }
  return freeze({ ...base, prepared_route_authority_binding_digest: digest(base) })
}

export function runAuthorityRoutingBudgetCutoverV1(value: unknown): AuthorityRoutingBudgetCutoverResultV1 {
  const admission = validateAuthorityRoutingBudgetCutoverInputV1(value)
  if (admission.kind === 'rejected') return resultRejected({ code: admission.rejection.code as RejectionCode, path: admission.rejection.path })
  if (admission.kind === 'failed') return resultRejected({ code: 'invalid_type_or_format', path: '/input' })
  const input = admission.value
  try {
    const preparation = prepareLedger(input)
    if (preparation.budgetExceeded) return stopped(input, preparation, 'budget_exhausted', 'external_blocker', 'not_required')
    if (input.repair_attempt_ledger.cycle_ledger.decision_count_without_progress >= 64) return stopped(input, preparation, 'cycle_exhausted', 'external_blocker', 'not_required')
    if (input.evaluation.kind === 'wait_for_protected_action' || (input.route_selection.kind === 'route' && input.route_selection.binding.transition_class === 'protected_executor_wait')) return stopped(input, preparation, 'protected_action_wait', 'external_blocker', 'protected_wait')
    const reduction = reduceContinuousOrchestrationV1(input.state, input.event, input.profiles, input.evaluation, input.decision_url, input.evaluated_at, input.recovery_role_id_or_null)
    const intent = dispatchFrom(input, reduction)
    const actionGuardStatus: CommonResult['action_guard_status'] = intent ? 'required' : 'not_required'
    const prepared = intent ? prepareRouteAuthorityBinding(input, reduction, intent) : null
    const common = { result_version: AUTHORITY_ROUTING_BUDGET_CUTOVER_RESULT_V1_VERSION, authority_bundle_digest: input.authority_bundle.bundle_digest, profile_digest: input.cutover_profile.profile_digest, route_selection_digest: input.route_selection.selection_digest, next_repair_ledger: preparation.ledger, ledger_cas_operand_or_null: preparation.operand, action_guard_status: actionGuardStatus, checkpoint_required: input.repair_attempt_ledger.cycle_ledger.decision_count_without_progress >= 32, reduction_invocation_count: 1 as const, transport_invoked: false as const, write_invoked: false as const, protected_action_invoked: false as const, prepared_route_authority_binding_or_null: prepared, delivery_eligible: false as const, delivery_intent: null, finalization_state: prepared ? 'awaiting_cas_outcome' as const : 'not_applicable' as const }
    if (input.cutover_profile.mode === 'legacy_adapter_v1') {
      const proofBase = { profile_mode: 'legacy_adapter_v1' as const, prior_ledger_digest: input.repair_attempt_ledger.ledger_digest, next_ledger_digest: preparation.ledger.ledger_digest, semantic_epoch_id: preparation.ledger.semantic_epoch_id, authority_bundle_digest: input.authority_bundle.bundle_digest, route_selection_digest: input.route_selection.selection_digest, no_counter_reset: true as const, no_authority_rewrite: true as const }
      const semantic = { ...common, kind: 'legacy_profile_accepted' as const, reduction, dispatch_intent_or_null: intent, rollback_preservation_proof: { ...proofBase, proof_digest: digest(proofBase) } }
      return freeze({ ...semantic, cutover_evidence_digest: digest(semantic) })
    }
    const semantic = { ...common, kind: 'cutover_accepted' as const, reduction, dispatch_intent_or_null: intent }
    return freeze({ ...semantic, cutover_evidence_digest: digest(semantic) })
  } catch {
    return resultRejected({ code: 'invalid_cross_input_binding', path: '/input/runtime_projection' })
  }
}

const operandProblem = (value: unknown, path = '/result/ledger_cas_operand_or_null'): Problem | undefined => {
  const keys = ['operand_version','task_id','repository','assignment_revision','semantic_epoch_id','expected_prior_ledger_digest','next_ledger_digest','attempt_idempotency_key','expected_state_digest','route_digest','authority_bundle_digest','operand_digest']
  const problem = exact(value, keys, path)
  if (problem) return problem
  const operand = value as JsonObject
  if (operand.operand_version !== REPAIR_LEDGER_CAS_OPERAND_V1_VERSION || !nonEmpty(operand.task_id) || !nonEmpty(operand.repository) || !uint(operand.assignment_revision) || ![operand.semantic_epoch_id,operand.expected_prior_ledger_digest,operand.next_ledger_digest,operand.attempt_idempotency_key,operand.expected_state_digest,operand.route_digest,operand.authority_bundle_digest].every(sha)) return { code: 'invalid_type_or_format', path }
  return digestOk(operand, 'operand_digest') ? undefined : { code: 'invalid_cross_input_binding', path: `${path}/operand_digest` }
}

const resultProblem = (value: JsonObject): Problem | undefined => {
  if (value.result_version !== AUTHORITY_ROUTING_BUDGET_CUTOVER_RESULT_V1_VERSION || !nonEmpty(value.kind)) return { code: 'invalid_type_or_format', path: '/result' }
  if (value.kind === 'rejected') {
    const problem = exact(value, ['result_version','kind','rejection','state_changed','reduction_invocation_count','transport_invoked','write_invoked','protected_action_invoked','cutover_evidence_digest'], '/result')
    if (problem) return problem
    if (!object(value.rejection) || exact(value.rejection,['code','path','message'],'/result/rejection') || value.state_changed !== false || value.reduction_invocation_count !== 0 || value.transport_invoked !== false || value.write_invoked !== false || value.protected_action_invoked !== false || !digestOk(value,'cutover_evidence_digest')) return { code: 'invalid_conditional_matrix', path: '/result' }
    return undefined
  }
  const common = ['result_version','kind','authority_bundle_digest','profile_digest','route_selection_digest','next_repair_ledger','ledger_cas_operand_or_null','action_guard_status','checkpoint_required','reduction_invocation_count','cutover_evidence_digest','transport_invoked','write_invoked','protected_action_invoked','prepared_route_authority_binding_or_null','delivery_eligible','delivery_intent','finalization_state']
  const specific = value.kind === 'cutover_accepted' ? ['reduction','dispatch_intent_or_null'] : value.kind === 'legacy_profile_accepted' ? ['reduction','dispatch_intent_or_null','rollback_preservation_proof'] : value.kind === 'stopped' ? ['stop_class','stop_reason','reduction_or_null','dispatch_intent_or_null'] : []
  if (specific.length === 0) return { code: 'invalid_enum', path: '/result/kind' }
  const problem = exact(value,[...common,...specific],'/result')
  if (problem) return problem
  if (![value.authority_bundle_digest,value.profile_digest,value.route_selection_digest].every(sha) || validateRepairAttemptLedgerV1(value.next_repair_ledger).kind !== 'accepted' || !['not_required','admitted','required','protected_wait'].includes(String(value.action_guard_status)) || typeof value.checkpoint_required !== 'boolean' || ![0,1].includes(Number(value.reduction_invocation_count)) || value.transport_invoked !== false || value.write_invoked !== false || value.protected_action_invoked !== false || value.delivery_eligible !== false || value.delivery_intent !== null || !['awaiting_cas_outcome','not_applicable'].includes(String(value.finalization_state))) return { code: 'invalid_type_or_format', path: '/result' }
  if (value.prepared_route_authority_binding_or_null !== null) {
    const preparedFailure = preparedProblem(value.prepared_route_authority_binding_or_null,'/result/prepared_route_authority_binding_or_null')
    if (preparedFailure) return preparedFailure
    if (value.finalization_state !== 'awaiting_cas_outcome' || value.action_guard_status !== 'required' || value.dispatch_intent_or_null === null) return { code:'invalid_conditional_matrix', path:'/result/prepared_route_authority_binding_or_null' }
  } else if (value.finalization_state !== 'not_applicable' || value.dispatch_intent_or_null !== null) return { code:'invalid_conditional_matrix', path:'/result/prepared_route_authority_binding_or_null' }
  if (value.ledger_cas_operand_or_null !== null) { const p = operandProblem(value.ledger_cas_operand_or_null); if (p) return p }
  if (value.dispatch_intent_or_null !== null && validateDispatchIntentV1(value.dispatch_intent_or_null).kind !== 'accepted') return { code: 'invalid_cross_input_binding', path: '/result/dispatch_intent_or_null' }
  if (value.kind === 'legacy_profile_accepted') {
    const proof = value.rollback_preservation_proof
    if (!object(proof) || exact(proof,['profile_mode','prior_ledger_digest','next_ledger_digest','semantic_epoch_id','authority_bundle_digest','route_selection_digest','no_counter_reset','no_authority_rewrite','proof_digest'],'/result/rollback_preservation_proof') || proof.profile_mode !== 'legacy_adapter_v1' || ![proof.prior_ledger_digest,proof.next_ledger_digest,proof.semantic_epoch_id,proof.authority_bundle_digest,proof.route_selection_digest].every(sha) || proof.no_counter_reset !== true || proof.no_authority_rewrite !== true || !digestOk(proof,'proof_digest')) return { code: 'invalid_conditional_matrix', path: '/result/rollback_preservation_proof' }
  }
  if (value.kind === 'stopped' && (value.dispatch_intent_or_null !== null || !['authority_conflict','ambiguous_route','freshness_required','protected_action_wait','budget_exhausted','stale_cas','cycle_checkpoint','cycle_exhausted'].includes(String(value.stop_class)) || !['architecture_gap','external_blocker'].includes(String(value.stop_reason)))) return { code: 'invalid_conditional_matrix', path: '/result' }
  return digestOk(value,'cutover_evidence_digest') ? undefined : { code: 'invalid_cross_input_binding', path: '/result/cutover_evidence_digest' }
}

export const validateAuthorityRoutingBudgetCutoverResultV1 = (value: unknown): ClosedAdmissionResultV1<AuthorityRoutingBudgetCutoverResultV1> => runAdmission('m3_result', value, resultProblem)

export const sealAuthorityRoutingBudgetCutoverProfileV1 = (value: Omit<AuthorityRoutingBudgetCutoverProfileV1,'profile_digest'>): AuthorityRoutingBudgetCutoverProfileV1 => freeze({ ...clone(value), profile_digest: digest(value) })
export const sealM3RouteSelectionV1 = <T extends Omit<Extract<M3RouteSelectionV1,{kind:'route'}>,'selection_digest'>|Omit<Extract<M3RouteSelectionV1,{kind:'no_route'}>,'selection_digest'>>(value: T): M3RouteSelectionV1 => freeze({ ...clone(value), selection_digest: digest(value) } as unknown as M3RouteSelectionV1)
export const sealRepairAttemptEvidenceV1 = (value: Omit<RepairAttemptEvidenceV1,'idempotency_key'|'evidence_digest'>): RepairAttemptEvidenceV1 => {
  const idempotency_key = digest({ task_id: value.task_id, repository: value.repository, assignment_revision: value.assignment_revision, semantic_epoch_id: value.semantic_epoch_id, stable_finding_id: value.stable_finding_id, finding_domain: value.finding_domain, attempt_class: value.attempt_class, scope_digest: value.scope_digest, source_counter: value.source_counter, predecessor_record_url: value.predecessor_record_url })
  const base = { ...clone(value), idempotency_key }
  return freeze({ ...base, evidence_digest: digest(base) })
}
export const sealAuthorityRoutingBudgetCutoverInputV1 = (value: Omit<AuthorityRoutingBudgetCutoverInputV1,'input_digest'>): AuthorityRoutingBudgetCutoverInputV1 => freeze({ ...clone(value), input_digest: digest(value) })
