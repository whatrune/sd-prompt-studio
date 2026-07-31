export const STATE_VERSION = 'continuous_orchestration_state_v1' as const
export const EVENT_VERSION = 'continuous_orchestration_event_v1' as const
export const DECISION_VERSION = 'continuation_decision_v1' as const
export const ADMISSION_VERSION = 'event_admission_result_v1' as const

type ObjectValue = Record<string, unknown>
type Predicate = (value: unknown) => boolean
export type RoleId = string
export type ActionId = string
export type GateId = string
export type Sha256 = string
export type FullGitSha = string
export type CanonicalRecordUrl = string
export type PrUrl = string
export type ReviewThreadUrl = string
export type CheckEvidenceUrl = string

export const transitionClasses = [
  'architecture_review','architecture_repair','implementation_candidate','implementation',
  'implementation_review','publication_candidate','publication','publication_review',
  'final_regression','operational_validation','completion_assessment','metadata_sync',
  'product_owner_request','protected_executor_wait','post_merge_binding','gsp_projection',
] as const
export type TransitionClassV1 = typeof transitionClasses[number]
export const eventTypes = [
  'task_opted_in','result_handoff_published','review_decision_published',
  'architecture_amendment_published','resume_dispatch_published','metadata_sync_completed',
  'validation_completed','completion_assessment_published','product_owner_approval_published',
  'protected_action_completed','authority_snapshot_changed','external_recovery_observed',
] as const
export type EventTypeV1 = typeof eventTypes[number]
export const phases = [
  'admitting','evaluating','awaiting_role_result','awaiting_repair_result',
  'awaiting_independent_review','awaiting_metadata_sync','awaiting_external_recovery',
  'awaiting_product_owner','awaiting_protected_action','completion_assessment','completed','stopped',
] as const
export type PhaseV1 = typeof phases[number]
export const gspFields = [
  'architecture_review','implementation_review','publication_review','final_regression',
  'operational_validation','completion_preflight','metadata_sync','ready','approve','merge',
  'current_main_binding','blocking_finding_count','open_finding_count','next_gate','next_owner',
  'current_head','current_base','pr_state',
] as const
export type GspFieldIdV1 = typeof gspFields[number]
export const sourceTypes = [
  'identity','task_assignment','result_handoff','review_decision','product_owner_approval',
  'pr_snapshot','check_snapshot','review_thread_snapshot','gate_status_projection',
  'context_health_resume','workspace_snapshot',
] as const
export type SourceTypeV1 = typeof sourceTypes[number]
export const identityFields = [
  'contract_version','task_id','repository','assignment_revision','canonical_record_url',
  'authoring_role_id','assigned_role_id','status','execution_stop_reason',
  'recommended_next_action_id','reviewed_head_sha','decision','finding_ids','closure_flags',
  'approved_action_id','approved_head_sha','approved_base_sha','approval_state','pr_url',
  'pr_head_sha','pr_base_sha','pr_state','check_name','check_url','check_conclusion',
  'checked_head_sha','thread_url','thread_state','thread_blocking_class','gsp_generation',
  'gsp_head_sha','gsp_gate_rows_digest','context_health_outcome','resume_record_url',
  'workspace_binding_digest','workspace_clean_state',
] as const
export type IdentityFieldIdV1 = typeof identityFields[number]

export type ClosedAdmissionResultV1<T> =
  | Readonly<{ contract_version:'closed-admission-result-v1'; kind:'accepted'; value:T }>
  | Readonly<{ contract_version:'closed-admission-result-v1'; kind:'rejected'; rejection:{code:string;path:string;message:string} }>
  | Readonly<{ contract_version:'closed-admission-result-v1'; kind:'failed'; failure:{code:'validator_internal_failure';diagnostic_id:string;safe_message:'validator failed internally'} }>

export interface RouteBindingV1 {
  readonly transition_class:TransitionClassV1
  readonly role_id:RoleId
  readonly action_id:ActionId
  readonly authority_record_url:CanonicalRecordUrl
  readonly allowed_scope_digest:Sha256
  readonly independent_from_role_id_or_null:RoleId|null
}
export interface EventAuthorityBindingV1 {
  readonly event_type:EventTypeV1
  readonly authority_source:'assignment_field'|'fixed_route_transition_class'|'active_route_binding'|'protected_action_profile'|'collector_profile'|'preceding_decision_recovery_role'
  readonly authority_selector:{readonly kind:EventAuthorityBindingV1['authority_source'];readonly value:string}
  readonly head_binding:'required'|'nullable'
}
export interface AuthorityProjectionProfileV1 {
  readonly profile_version:'authority_projection_profile_v1'
  readonly profile_id:string
  readonly source_type_bindings:readonly {
    readonly source_type:SourceTypeV1
    readonly collector_adapter_id:string
    readonly canonical_authority_required:boolean
    readonly required_field_ids:readonly IdentityFieldIdV1[]
    readonly optional_field_ids:readonly IdentityFieldIdV1[]
    readonly authority_owner_contract_url:CanonicalRecordUrl
  }[]
  readonly assignment_owner_role_id:RoleId
  readonly requested_by_role_id:RoleId
  readonly collector_role_id:RoleId
  readonly profile_digest:Sha256
}
export interface RouteBindingTableV1 {
  readonly profile_version:'route_binding_table_v1'
  readonly profile_id:string
  readonly bindings:readonly RouteBindingV1[]
  readonly event_authority_bindings:readonly EventAuthorityBindingV1[]
  readonly profile_digest:Sha256
}
export interface GateProfileV1 {
  readonly profile_version:'gate_profile_v1'
  readonly profile_id:string
  readonly gate_rows:readonly {readonly gate_id:GateId;readonly ordinal:number;readonly required_evidence_types:readonly SourceTypeV1[];readonly gsp_field_id:GspFieldIdV1}[]
  readonly profile_digest:Sha256
}
export interface ProtectedActionProfileV1 {
  readonly profile_version:'protected_action_profile_v1'
  readonly profile_id:string
  readonly mode:'wait_only'
  readonly action_rows:readonly {readonly action_id:ActionId;readonly approval_required:true;readonly exact_head_required:true;readonly exact_base_required:boolean;readonly one_use:true;readonly executor_role_id:RoleId;readonly authority_record_url:CanonicalRecordUrl}[]
  readonly profile_digest:Sha256
}
export interface GenericProgressRunnerProfilesV1 {
  readonly authority_projection_profile:AuthorityProjectionProfileV1
  readonly route_binding_table:RouteBindingTableV1
  readonly gate_profile:GateProfileV1
  readonly protected_action_profile:ProtectedActionProfileV1
}
export interface FindingLoopStateV1 {
  readonly finding_id:string
  readonly finding_domain:'architecture'|'implementation'|'metadata'|'validation'|'publication'
  readonly semantic_requirement_digest:Sha256
  readonly allowed_scope_digest:Sha256
  readonly counter_key:Sha256
  readonly state:'open'|'closed'|'reopened'|'exhausted'
  readonly correction_role_id:RoleId
  readonly closure_role_id:RoleId
  readonly opening_decision_url:CanonicalRecordUrl
  readonly latest_decision_url:CanonicalRecordUrl
  readonly attempt_count:number
  readonly closed_at_attempt_or_null:number|null
}
export interface MetadataLoopCounterV1 {
  readonly counter_key:Sha256
  readonly pr_url:PrUrl
  readonly head_sha:FullGitSha
  readonly projection_field_ids:readonly GspFieldIdV1[]
  readonly semantic_defect_digest:Sha256
  readonly originating_review_url:CanonicalRecordUrl
  readonly subsequent_review_urls:readonly CanonicalRecordUrl[]
  readonly write_attempt_count:number
  readonly state:'open'|'closed'|'exhausted'
}
export interface CycleLedgerV1 {
  readonly cycle_ledger_version:'cycle_ledger_v1'
  readonly semantic_counter_epoch_id:Sha256
  readonly progress_epoch:number
  readonly max_gate_ordinal_reached:number
  readonly decision_count_without_progress:number
  readonly checkpoint_emitted_without_progress:boolean
  readonly signature_occurrences:readonly {readonly cycle_signature:Sha256;readonly occurrence_count:number;readonly first_decision_url:CanonicalRecordUrl;readonly last_decision_url:CanonicalRecordUrl}[]
  readonly last_progress_record_url:CanonicalRecordUrl
}
export interface ReplayEventValidationDiscriminantV1 {
  readonly discriminant_version:'replay_event_validation_discriminant_v1'
  readonly source_event_type:EventTypeV1
  readonly validation_class_or_null:'final_regression'|'operational_validation'|null
}
export interface ReplayLedgerEntryV1 {
  readonly task_id:string
  readonly semantic_counter_epoch_id:Sha256
  readonly semantic_event_digest:Sha256
  readonly decision_id:Sha256
  readonly decision_url:CanonicalRecordUrl
  readonly idempotency_key:Sha256
  readonly committed_state_revision:number
  readonly event_validation_discriminant:ReplayEventValidationDiscriminantV1
  readonly event_validation_discriminant_digest:Sha256
  readonly active_action_replay_binding_or_null:ActiveActionReplayBindingV1|null
  readonly active_action_provenance_record_url_or_null:CanonicalRecordUrl|null
  readonly active_action_provenance_digest_or_null:Sha256|null
}
export interface ActiveActionAssignmentBindingV1 {
  readonly binding_version:'active_action_assignment_binding_v1'
  readonly assignment_record_url:CanonicalRecordUrl
  readonly assignment_revision:number
  readonly route_binding_table_profile_id:string
  readonly route_binding_table_digest:Sha256
  readonly transition_class:'final_regression'|'operational_validation'
  readonly route_binding:RouteBindingV1
}
export interface ActiveActionExpectedStateV1 {
  readonly expected_state_version:'active_action_expected_state_v1'
  readonly state_version:typeof STATE_VERSION
  readonly expected_state_revision:number
  readonly expected_state_digest:Sha256
  readonly semantic_counter_epoch_id:Sha256
  readonly authority_snapshot_digest:Sha256
  readonly active_gate_id_or_null:GateId|null
  readonly active_transition_class:'final_regression'|'operational_validation'
  readonly active_role_id:RoleId
  readonly active_action_id:ActionId
  readonly active_route_binding_digest:Sha256
}
export interface ActiveActionAdmissionProofV1 {
  readonly proof_version:'active_action_admission_proof_v1'
  readonly task_id:string
  readonly event_digest:Sha256
  readonly active_action_id:ActionId
  readonly assignment_authority:ActiveActionAssignmentBindingV1
  readonly expected_state:ActiveActionExpectedStateV1
  readonly proof_digest:Sha256
}
export interface ActiveActionCasOperandV1 {
  readonly operand_version:'active_action_cas_operand_v1'
  readonly task_id:string
  readonly semantic_event_digest:Sha256
  readonly proof_digest:Sha256
  readonly expected_assignment_revision:number
  readonly expected_state_revision:number
  readonly expected_state_digest:Sha256
  readonly expected_authority_snapshot_digest:Sha256
  readonly expected_active_transition_class:'final_regression'|'operational_validation'
  readonly expected_active_role_id:RoleId
  readonly expected_active_action_id:ActionId
  readonly expected_active_route_binding_digest:Sha256
  readonly next_state_revision:number
  readonly cas_operand_digest:Sha256
}
export interface ActiveActionReplayBindingV1 {
  readonly replay_binding_version:'active_action_replay_binding_v1'
  readonly task_id:string
  readonly semantic_counter_epoch_id:Sha256
  readonly event_digest:Sha256
  readonly proof_digest:Sha256
  readonly cas_operand_digest:Sha256
  readonly binding_idempotency_key:Sha256
  readonly active_action_id:ActionId
  readonly assignment_record_url:CanonicalRecordUrl
  readonly assignment_revision:number
  readonly route_binding_table_profile_id:string
  readonly route_binding_table_digest:Sha256
  readonly transition_class:'final_regression'|'operational_validation'
  readonly route_role_id:RoleId
  readonly route_action_id:ActionId
  readonly route_authority_record_url:CanonicalRecordUrl
  readonly route_allowed_scope_digest:Sha256
  readonly expected_state_revision:number
  readonly expected_state_digest:Sha256
  readonly expected_authority_snapshot_digest:Sha256
  readonly expected_active_transition_class:'final_regression'|'operational_validation'
  readonly expected_active_role_id:RoleId
  readonly expected_active_action_id:ActionId
  readonly expected_active_route_binding_digest:Sha256
  readonly provenance_record_url:CanonicalRecordUrl
  readonly provenance_digest:Sha256
  readonly event_validation_discriminant:ReplayEventValidationDiscriminantV1
  readonly event_validation_discriminant_digest:Sha256
  readonly replay_binding_digest:Sha256
}
export interface ActiveActionAdmissionEnvelopeV1 {
  readonly envelope_version:'active_action_admission_envelope_v1'
  readonly event:ContinuousOrchestrationEventV1
  readonly active_action_proof_or_null:ActiveActionAdmissionProofV1|null
  readonly active_action_cas_operand_or_null:ActiveActionCasOperandV1|null
}
export interface ActiveActionProvenanceAssignmentV1 {
  readonly assignment_record_url:CanonicalRecordUrl
  readonly assignment_revision:number
  readonly route_binding_table_profile_id:string
  readonly route_binding_table_digest:Sha256
  readonly transition_class:'final_regression'|'operational_validation'
  readonly route_role_id:RoleId
  readonly route_action_id:ActionId
  readonly route_authority_record_url:CanonicalRecordUrl
  readonly route_allowed_scope_digest:Sha256
}
export interface ActiveActionProvenanceRecordV1 {
  readonly provenance_version:'active_action_provenance_v1'
  readonly canonical_record_url:CanonicalRecordUrl
  readonly task_id:string
  readonly source_event_type:'validation_completed'
  readonly validation_class:'final_regression'|'operational_validation'
  readonly source_event_digest:Sha256
  readonly assignment_authority:ActiveActionProvenanceAssignmentV1
  readonly active_action_id:ActionId
  readonly authoring_role_id:RoleId
  readonly provenance_digest:Sha256
}
export interface CollectorAuthorityRefV1 {
  readonly authority_ref_version:'collector_authority_ref_v1'
  readonly task_id:string
  readonly assignment_record_url:CanonicalRecordUrl
  readonly assignment_revision:number
  readonly authority_projection_profile_id:string
  readonly authority_projection_profile_digest:Sha256
  readonly source_type_binding:AuthorityProjectionProfileV1['source_type_bindings'][number]
  readonly collector_role_id:RoleId
}
export type CollectedProvenanceObservationPayloadV1 =
  | Readonly<{observation_version:'collected_provenance_observation_v1';collector_authority:CollectorAuthorityRefV1;record_url:CanonicalRecordUrl;observed_at:string;retrieval_state:'retrieved';body_text:string;body_utf8_sha256:Sha256}>
  | Readonly<{observation_version:'collected_provenance_observation_v1';collector_authority:CollectorAuthorityRefV1;record_url:CanonicalRecordUrl;observed_at:string;retrieval_state:'unavailable';failure_class:'not_found'|'permission_denied'|'transport_error'|'unreadable_body'}>
export interface TrustedCollectedProvenanceObservationV1 {readonly __trusted_collected_provenance_observation_v1?:never}
export type EvidenceSourceRefV1 =
  | Readonly<{readonly kind:'canonical_record';readonly url:CanonicalRecordUrl}>
  | Readonly<{readonly kind:'pr_snapshot';readonly url:PrUrl}>
  | Readonly<{readonly kind:'review_thread';readonly url:ReviewThreadUrl}>
  | Readonly<{readonly kind:'check_evidence';readonly url:CheckEvidenceUrl;readonly check_name:string;readonly provider_id:string;readonly checked_head_sha:FullGitSha}>
export interface ContinuousOrchestrationStateV1 {
  readonly state_version:typeof STATE_VERSION
  readonly state_revision:number
  readonly task_id:string
  readonly canonical_task_url:CanonicalRecordUrl
  readonly repository:string
  readonly assignment_revision:number
  readonly semantic_counter_epoch:{readonly epoch_id:Sha256;readonly root_assignment_url:CanonicalRecordUrl;readonly current_assignment_url:CanonicalRecordUrl;readonly current_assignment_revision:number;readonly predecessor_epoch_id_or_null:Sha256|null;readonly disposition:'initial'|'carry_forward'|'supersede_scope';readonly semantic_requirement_digest:Sha256;readonly allowed_scope_digest:Sha256;readonly authority_record_url:CanonicalRecordUrl}
  readonly opt_in_contract_version:string
  readonly allowed_transition_classes:readonly TransitionClassV1[]
  readonly phase:PhaseV1
  readonly active_gate:GateId|null
  readonly active_role_binding:RouteBindingV1|null
  readonly active_action_id:ActionId|null
  readonly authority_snapshot:{readonly snapshot_version:'authority_snapshot_ref_v1';readonly snapshot_digest:Sha256;readonly collected_from:readonly EvidenceSourceRefV1[];readonly repository:string;readonly main_sha_or_null:FullGitSha|null;readonly pr_url_or_null:PrUrl|null;readonly pr_head_sha_or_null:FullGitSha|null;readonly pr_base_sha_or_null:FullGitSha|null;readonly pr_state:'not_applicable'|'open_draft'|'open_ready'|'merged'|'closed_unmerged';readonly check_set_digest_or_null:Sha256|null;readonly finding_set_digest:Sha256;readonly thread_set_digest:Sha256;readonly workspace_state:'not_required'|'clean_bound'|'dirty'|'missing'|'mismatched';readonly gsp_generation_or_null:number|null;readonly gsp_body_digest_or_null:Sha256|null;readonly approval_consumption_digest_or_null:Sha256|null;readonly observed_at:string}
  readonly canonical_refs:{readonly assignment_url:CanonicalRecordUrl;readonly result_handoff_url_or_null:CanonicalRecordUrl|null;readonly review_decision_url_or_null:CanonicalRecordUrl|null;readonly architecture_amendment_url_or_null:CanonicalRecordUrl|null;readonly resume_dispatch_url_or_null:CanonicalRecordUrl|null;readonly metadata_result_url_or_null:CanonicalRecordUrl|null;readonly validation_result_url_or_null:CanonicalRecordUrl|null;readonly completion_assessment_url_or_null:CanonicalRecordUrl|null;readonly product_owner_approval_url_or_null:CanonicalRecordUrl|null;readonly protected_action_completion_url_or_null:CanonicalRecordUrl|null}
  readonly finding_ledger:readonly FindingLoopStateV1[]
  readonly loop_counters:{readonly finding_counters:readonly FindingLoopStateV1[];readonly metadata_counters:readonly MetadataLoopCounterV1[];readonly delivery_counters:readonly {readonly idempotency_key:Sha256;readonly delivery_count:number;readonly last_completion_url_or_null:CanonicalRecordUrl|null;readonly state:'pending'|'completed'|'awaiting_recovery'|'exhausted'}[];readonly cycle_ledger:CycleLedgerV1}
  readonly approval_state:{readonly state:'none'|'current'|'historical_at_prior_head'|'invalid'|'not_evaluable';readonly reason:'missing'|'matched'|'head_drift'|'base_drift'|'pr_state_drift'|'check_drift'|'finding_drift'|'gsp_drift'|'expired'|'consumed'|'malformed'|'scope_mismatch'|'unreadable';readonly approval_record_url_or_null:CanonicalRecordUrl|null}
  readonly projection_state:{readonly projection_version:'projection_state_v1';readonly state:'current'|'stale'|'missing'|'conflicting'|'not_required';readonly pr_url_or_null:PrUrl|null;readonly projected_head_sha_or_null:FullGitSha|null;readonly gsp_generation_or_null:number|null;readonly pr_body_digest_or_null:Sha256|null;readonly gsp_gate_rows_digest_or_null:Sha256|null;readonly citation_record_urls:readonly CanonicalRecordUrl[];readonly mismatch_field_ids:readonly GspFieldIdV1[]}
  readonly event_cursor:{readonly cursor_version:'event_cursor_v1';readonly last_event_id_or_null:Sha256|null;readonly last_semantic_event_digest_or_null:Sha256|null;readonly last_event_record_url_or_null:CanonicalRecordUrl|null;readonly last_decision_url_or_null:CanonicalRecordUrl|null;readonly admitted_new_event_count:number}
  readonly replay_ledger:{readonly ledger_version:'replay_ledger_v1';readonly entries:readonly ReplayLedgerEntryV1[];readonly ledger_digest:Sha256}
  readonly audit_chain:{readonly audit_version:'audit_chain_ref_v1';readonly head_decision_url_or_null:CanonicalRecordUrl|null;readonly head_decision_id_or_null:Sha256|null;readonly decision_count_total:number;readonly chain_digest:Sha256}
  readonly pending_transport:{readonly intent_version:'pending_transport_intent_v1';readonly idempotency_key:Sha256;readonly decision_url:CanonicalRecordUrl;readonly route_binding:RouteBindingV1;readonly scope_digest:Sha256;readonly created_from_state_revision:number;readonly delivery_state:'prepared'|'delivered'|'awaiting_recovery';readonly completion_record_url_or_null:CanonicalRecordUrl|null}|null
  readonly last_decision_url:CanonicalRecordUrl|null
}
export interface ContinuousOrchestrationEventV1 {
  readonly event_version:typeof EVENT_VERSION
  readonly event_id:Sha256
  readonly event_type:EventTypeV1
  readonly task_id:string
  readonly assignment_revision:number
  readonly canonical_record_url:CanonicalRecordUrl
  readonly authoring_role:RoleId
  readonly authority_snapshot_digest:Sha256
  readonly subject_head_sha_or_null:FullGitSha|null
  readonly predecessor_event_id_or_null:Sha256|null
  readonly observed_at:string
  readonly semantic_event_digest:Sha256
}

type CommonDecision = {
  readonly decision_version:typeof DECISION_VERSION;readonly decision_id:Sha256;readonly task_id:string
  readonly assignment_revision:number;readonly input_event_url:CanonicalRecordUrl;readonly input_event_digest:Sha256
  readonly predecessor_decision_url_or_null:CanonicalRecordUrl|null;readonly authority_snapshot_digest:Sha256
  readonly branch:string;readonly reason_code:string;readonly idempotency_key:Sha256
  readonly gsp_hook:'not_required'|'required_before_transition'|'required_after_transition'
  readonly next_owner_role_id:RoleId;readonly evaluated_at:string
}
type RouteDecision = CommonDecision & Readonly<{route_binding:RouteBindingV1}>
export type ContinuationDecisionV1 =
  | (RouteDecision & Readonly<{branch:'dispatch_role';reason_code:'declared_next_role';predecessor_canonical_url:CanonicalRecordUrl;target_head_sha_or_null:FullGitSha|null}>)
  | (RouteDecision & Readonly<{branch:'request_independent_review';reason_code:'independent_review_required';review_scope_digest:Sha256;reviewed_head_sha_or_null:FullGitSha|null}>)
  | (RouteDecision & Readonly<{branch:'request_metadata_sync';reason_code:'metadata_projection_mismatch';pr_url:PrUrl;head_sha:FullGitSha;projection_field_ids:readonly GspFieldIdV1[];citation_record_urls:readonly CanonicalRecordUrl[];expected_projection_digest_or_null:Sha256|null;must_verify_after_write:true}>)
  | (CommonDecision & Readonly<{branch:'await_external_recovery';reason_code:'external_recovery_required';controller_condition:'external_blocker';terminal_stop_reason:'external_blocker';result_handoff_status:'blocked'|'failed';recovery_role_id:RoleId;required_recovery_event_type:'external_recovery_observed'|'validation_completed'|'metadata_sync_completed'|'result_handoff_published';recovery_evidence_field_ids:readonly IdentityFieldIdV1[];automatic_resume:true}>)
  | (CommonDecision & Readonly<{branch:'request_product_owner_decision';reason_code:'product_decision_required';decision_subject_id:ActionId;decision_scope_digest:Sha256;required_authority_field_ids:readonly IdentityFieldIdV1[];requested_action_id_or_null:ActionId|null}>)
  | (CommonDecision & Readonly<{branch:'await_protected_action';reason_code:'protected_action_completion_required';protected_action_id:ActionId;approval_record_url:CanonicalRecordUrl;approved_head_sha:FullGitSha;approved_base_sha:FullGitSha;approved_pr_state:'open_draft'|'open_ready';executor_role_id:RoleId;execution_authority:false}>)
  | (CommonDecision & Readonly<{branch:'invalidate_authority';reason_code:'authority_drift';invalidated_record_urls:readonly CanonicalRecordUrl[];invalidation_class:'head_drift'|'base_drift'|'pr_state_drift'|'check_drift'|'finding_drift'|'gsp_drift'|'approval_expired'|'approval_consumed'|'approval_malformed'|'approval_scope_mismatch';historical_evidence_record_urls:readonly CanonicalRecordUrl[];earliest_gate_id:GateId;controller_condition:'authority_drift';terminal_stop_reason:'external_blocker';result_handoff_status:'blocked';recovery_role_id:RoleId;required_recovery_event_type:'review_decision_published'|'validation_completed'|'product_owner_approval_published'|'metadata_sync_completed';recovery_evidence_field_ids:readonly IdentityFieldIdV1[];automatic_resume:true}>)
  | (CommonDecision & Readonly<{branch:'complete_task_candidate';reason_code:'completion_evidence_ready';completion_evidence_urls:readonly CanonicalRecordUrl[];blocking_finding_count:0;open_finding_count:0;assessor_route_binding:RouteBindingV1}>)
  | (CommonDecision & Readonly<{branch:'stop';reason_code:'canonical_conflict'|'architecture_gap'|'ambiguous_role_ownership'|'repeated_finding_failure'|'repeated_transition_cycle';controller_condition:'canonical_conflict'|'architecture_gap'|'ambiguous_role_ownership'|'external_blocker';terminal_stop_reason:'architecture_gap'|'external_blocker';result_handoff_status:'blocked'|'failed';recovery_role_id:RoleId;required_recovery_event_type:'architecture_amendment_published'|'review_decision_published'|'product_owner_approval_published'|'authority_snapshot_changed'|'external_recovery_observed';recovery_evidence_field_ids:readonly IdentityFieldIdV1[];automatic_resume:false}>)
  | (CommonDecision & Readonly<{branch:'no_transition';reason_code:'no_declared_transition';required_future_event_type:EventTypeV1;future_event_role_id:RoleId}>)
export type EventAdmissionResultV1 =
  | Readonly<{result_version:typeof ADMISSION_VERSION;branch:'new_decision';semantic_event_digest:Sha256;committed_decision_id:Sha256;committed_decision_url:CanonicalRecordUrl;committed_state_revision:number;state_changed:true}>
  | Readonly<{result_version:typeof ADMISSION_VERSION;branch:'replay';semantic_event_digest:Sha256;existing_decision_id:Sha256;existing_decision_url:CanonicalRecordUrl;existing_state_revision:number;state_changed:false;transport_invoked:false;audit_head_changed:false;counter_changed:false}>
export type ActiveActionProofGuardResultV1 =
  | Readonly<{guard_result_version:'active_action_proof_guard_result_v1';branch:'accepted';event_digest:Sha256;proof_digest:Sha256|null;cas_operand_digest:Sha256|null;binding_idempotency_key:Sha256|null;replay_lookup_allowed:true;state_changed:false;transport_invoked:false}>
  | Readonly<{guard_result_version:'active_action_proof_guard_result_v1';branch:'rejected';event_digest_or_null:Sha256|null;rejection_code:'missing_action'|'malformed_proof'|'action_mismatch'|'assignment_authority_mismatch'|'stale_action'|'cas_mismatch'|'missing_provenance'|'provenance_injection'|'provenance_type_mismatch'|'provenance_class_mismatch'|'provenance_event_mismatch'|'provenance_assignment_mismatch'|'provenance_action_mismatch'|'stale_provenance';controller_condition:'canonical_conflict'|'authority_drift'|'external_blocker';terminal_stop_reason:'architecture_gap'|'external_blocker';result_handoff_status:'blocked';fresh_evaluation_required:boolean;replay_lookup_performed:boolean;state_changed:false;transport_invoked:false;audit_head_changed:false;counter_changed:false}>
export interface CasProjectionV1 {readonly cas_version:'continuous_orchestration_cas_projection_v1';readonly expected_state_revision:number;readonly expected_state_digest:Sha256;readonly next_state_revision:number;readonly candidate_digest:Sha256}
export type CasCommitResultV1 =
  | Readonly<{cas_result_version:'continuous_orchestration_cas_result_v1';branch:'committed';expected_state_revision:number;committed_state_revision:number;state:ContinuousOrchestrationStateV1}>
  | Readonly<{cas_result_version:'continuous_orchestration_cas_result_v1';branch:'cas_mismatch';expected_state_revision:number;observed_state_revision:number;state_changed:false;audit_head_changed:false;counter_changed:false;transport_invoked:false}>
export type ProgressionEvaluatorResultV1 =
  | Readonly<{kind:'recommend_next_role';target_role_id:RoleId;next_action_id:ActionId;predecessor_canonical_url:CanonicalRecordUrl;target_head_sha_or_null:FullGitSha|null}>
  | Readonly<{kind:'wait_for_protected_action';protected_action_id:ActionId}>
  | Readonly<{kind:'require_gate_status_update'}>
  | Readonly<{kind:'invalidate_approval';invalidation_class:string}>
  | Readonly<{kind:'stop';stop_condition:'canonical_conflict'|'architecture_gap'|'ambiguous_role_ownership'|'blocking_finding'|'external_blocker';recovery_role_id:RoleId}>
  | Readonly<{kind:'no_transition';future_event_type:EventTypeV1;future_event_role_id:RoleId}>
  | Readonly<{kind:'complete_task_candidate';completion_evidence_urls:readonly CanonicalRecordUrl[]}>

const object=(v:unknown):v is ObjectValue=>typeof v==='object'&&v!==null&&!Array.isArray(v)
const own=(v:ObjectValue,k:string)=>Object.prototype.hasOwnProperty.call(v,k)
const exact=(v:unknown,keys:readonly string[],path='')=>{
  if(!object(v))return `${path}:invalid_type_or_format`
  for(const key of keys)if(!own(v,key))return `${path}/${key}:missing_required_field`
  const unknown=Object.keys(v).find(key=>!keys.includes(key))
  return unknown===undefined?undefined:`${path}/${unknown}:unknown_field`
}
const nonEmpty=(v:unknown):v is string=>typeof v==='string'&&v.length>0
const uint=(v:unknown,max=Number.MAX_SAFE_INTEGER)=>Number.isInteger(v)&&Number(v)>=0&&Number(v)<=max
const positive=(v:unknown)=>Number.isInteger(v)&&Number(v)>=1
const sha=(v:unknown):v is Sha256=>typeof v==='string'&&/^[0-9a-f]{64}$/.test(v)
const gitSha=(v:unknown):v is FullGitSha=>typeof v==='string'&&/^[0-9a-f]{40}$/.test(v)
const utc=(v:unknown)=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(v)&&Number.isFinite(Date.parse(v))
const canonical=(v:unknown):v is CanonicalRecordUrl=>typeof v==='string'&&/^https:\/\/github\.com\/[^/]+\/[^/]+\/(?:issues|pull)\/[1-9]\d*(?:#issuecomment-[1-9]\d*)?$/.test(v)
const issue=(v:unknown)=>typeof v==='string'&&/^https:\/\/github\.com\/[^/]+\/[^/]+\/issues\/[1-9]\d*$/.test(v)
const pr=(v:unknown):v is PrUrl=>typeof v==='string'&&/^https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/[1-9]\d*$/.test(v)
const reviewThread=(v:unknown):v is ReviewThreadUrl=>typeof v==='string'&&/^https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/[1-9]\d*#discussion_r[1-9]\d*$/.test(v)
const checkEvidence=(v:unknown):v is CheckEvidenceUrl=>typeof v==='string'&&/^https:\/\/github\.com\/[^/]+\/[^/]+\/(?:actions\/runs\/[1-9]\d*(?:\/job\/[1-9]\d*)?|commit\/[0-9a-f]{40}\/checks\/[1-9]\d*)$/.test(v)
const oneOf=<T extends string>(values:readonly T[],v:unknown):v is T=>typeof v==='string'&&values.includes(v as T)
const nullable=(pred:Predicate,v:unknown)=>v===null||pred(v)
const arrayOf=(v:unknown,pred:Predicate)=>Array.isArray(v)&&v.every(pred)
const compare=(a:string,b:string)=>{const x=new TextEncoder().encode(a),y=new TextEncoder().encode(b);for(let i=0;i<Math.min(x.length,y.length);i+=1)if(x[i]!==y[i])return x[i]-y[i];return x.length-y.length}
const setOf=(v:unknown,pred:Predicate)=>Array.isArray(v)&&v.every(pred)&&new Set(v).size===v.length&&(v as string[]).every((x,i)=>i===0||compare((v as string[])[i-1],x)<0)
const frozen=<T>(v:T):T=>{if(v!==null&&typeof v==='object'&&!Object.isFrozen(v)){Object.freeze(v);for(const child of Object.values(v as ObjectValue))frozen(child)}return v}

export function canonicalizeContinuousOrchestrationJsonV1(v:unknown):string{
  if(v===null||typeof v==='boolean'||typeof v==='string')return JSON.stringify(v)
  if(typeof v==='number'){if(!Number.isFinite(v))throw new TypeError('non-finite');return JSON.stringify(v)}
  if(Array.isArray(v))return `[${v.map(canonicalizeContinuousOrchestrationJsonV1).join(',')}]`
  if(object(v))return `{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canonicalizeContinuousOrchestrationJsonV1(v[k])}`).join(',')}}`
  throw new TypeError('outside JSON model')
}
function hash(text:string){
  const bytes=new TextEncoder().encode(text),length=bytes.length*8,size=((bytes.length+72)>>6)<<6,data=new Uint8Array(size)
  data.set(bytes);data[bytes.length]=128;const view=new DataView(data.buffer);view.setUint32(size-4,length>>>0);view.setUint32(size-8,Math.floor(length/0x100000000))
  const k=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]
  const h=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19],w=new Uint32Array(64),r=(x:number,n:number)=>(x>>>n)|(x<<(32-n))
  for(let o=0;o<size;o+=64){for(let i=0;i<16;i+=1)w[i]=view.getUint32(o+i*4);for(let i=16;i<64;i+=1){const a=w[i-15],b=w[i-2];w[i]=(w[i-16]+(r(a,7)^r(a,18)^(a>>>3))+w[i-7]+(r(b,17)^r(b,19)^(b>>>10)))>>>0}let[a,b,c,d,e,f,g,z]=h;for(let i=0;i<64;i+=1){const p=(z+(r(e,6)^r(e,11)^r(e,25))+((e&f)^(~e&g))+k[i]+w[i])>>>0,q=((r(a,2)^r(a,13)^r(a,22))+((a&b)^(a&c)^(b&c)))>>>0;z=g;g=f;f=e;e=(d+p)>>>0;d=c;c=b;b=a;a=(p+q)>>>0}h[0]=(h[0]+a)>>>0;h[1]=(h[1]+b)>>>0;h[2]=(h[2]+c)>>>0;h[3]=(h[3]+d)>>>0;h[4]=(h[4]+e)>>>0;h[5]=(h[5]+f)>>>0;h[6]=(h[6]+g)>>>0;h[7]=(h[7]+z)>>>0}
  return h.map(x=>x.toString(16).padStart(8,'0')).join('')
}
export const digestContinuousOrchestrationJsonV1=(v:unknown)=>hash(canonicalizeContinuousOrchestrationJsonV1(v))
const accepted=<T>(value:T):ClosedAdmissionResultV1<T>=>frozen({contract_version:'closed-admission-result-v1',kind:'accepted',value:frozen(structuredClone(value))})
const rejected=<T>(problem:string):ClosedAdmissionResultV1<T>=>{const n=problem.lastIndexOf(':'),code=n<0?'invalid_type_or_format':problem.slice(n+1),path=n<0?'':problem.slice(0,n);return frozen({contract_version:'closed-admission-result-v1',kind:'rejected',rejection:{code,path,message:code.split('_').join(' ')}})}
const failed=<T>(id:string):ClosedAdmissionResultV1<T>=>frozen({contract_version:'closed-admission-result-v1',kind:'failed',failure:{code:'validator_internal_failure',diagnostic_id:`closed-admission-failure-v1:${digestContinuousOrchestrationJsonV1({id})}`,safe_message:'validator failed internally'}})

const routeProblem=(v:unknown,path='')=>{const p=exact(v,['transition_class','role_id','action_id','authority_record_url','allowed_scope_digest','independent_from_role_id_or_null'],path);if(p)return p;const r=v as RouteBindingV1;if(!oneOf(transitionClasses,r.transition_class)||!nonEmpty(r.role_id)||!nonEmpty(r.action_id)||!canonical(r.authority_record_url)||!sha(r.allowed_scope_digest)||!nullable(nonEmpty,r.independent_from_role_id_or_null))return `${path}:invalid_type_or_format`;const independent=['architecture_review','implementation_review','publication_review','completion_assessment'].includes(r.transition_class);if(independent!==(r.independent_from_role_id_or_null!==null)||(independent&&r.independent_from_role_id_or_null===r.role_id))return `${path}:invalid_conditional_matrix`;return undefined}
const selectorValues:Readonly<Record<EventAuthorityBindingV1['authority_source'],readonly string[]>>={
  assignment_field:['assignment_owner_role_id','requested_by_role_id'],
  fixed_route_transition_class:transitionClasses,
  active_route_binding:['active_transition_role_id'],
  protected_action_profile:['matching_action_executor_role_id'],
  collector_profile:['collector_role_id'],
  preceding_decision_recovery_role:['recovery_role_id'],
}
const profileProblem=(v:unknown)=>{
  let p=exact(v,['authority_projection_profile','route_binding_table','gate_profile','protected_action_profile']);if(p)return p;const x=v as unknown as GenericProgressRunnerProfilesV1
  p=exact(x.authority_projection_profile,['profile_version','profile_id','source_type_bindings','assignment_owner_role_id','requested_by_role_id','collector_role_id','profile_digest'],'/authority_projection_profile');if(p)return p
  if(x.authority_projection_profile.profile_version!=='authority_projection_profile_v1'||!nonEmpty(x.authority_projection_profile.profile_id)||!nonEmpty(x.authority_projection_profile.assignment_owner_role_id)||!nonEmpty(x.authority_projection_profile.requested_by_role_id)||!nonEmpty(x.authority_projection_profile.collector_role_id)||!sha(x.authority_projection_profile.profile_digest)||x.authority_projection_profile.source_type_bindings.length!==sourceTypes.length)return '/authority_projection_profile:invalid_type_or_format'
  for(let i=0;i<x.authority_projection_profile.source_type_bindings.length;i+=1){const s=x.authority_projection_profile.source_type_bindings[i];p=exact(s,['source_type','collector_adapter_id','canonical_authority_required','required_field_ids','optional_field_ids','authority_owner_contract_url'],`/authority_projection_profile/source_type_bindings/${i}`);if(p)return p;if(!oneOf(sourceTypes,s.source_type)||!nonEmpty(s.collector_adapter_id)||typeof s.canonical_authority_required!=='boolean'||!setOf(s.required_field_ids,z=>oneOf(identityFields,z))||!setOf(s.optional_field_ids,z=>oneOf(identityFields,z))||!canonical(s.authority_owner_contract_url))return `/authority_projection_profile/source_type_bindings/${i}:invalid_type_or_format`}
  if(new Set(x.authority_projection_profile.source_type_bindings.map(s=>s.source_type)).size!==sourceTypes.length)return '/authority_projection_profile/source_type_bindings:duplicate_set_member'
  p=exact(x.route_binding_table,['profile_version','profile_id','bindings','event_authority_bindings','profile_digest'],'/route_binding_table');if(p)return p
  if(x.route_binding_table.profile_version!=='route_binding_table_v1'||!nonEmpty(x.route_binding_table.profile_id)||!sha(x.route_binding_table.profile_digest)||x.route_binding_table.event_authority_bindings.length!==eventTypes.length)return '/route_binding_table:invalid_type_or_format'
  for(let i=0;i<x.route_binding_table.bindings.length;i+=1){p=routeProblem(x.route_binding_table.bindings[i],`/route_binding_table/bindings/${i}`);if(p)return p}
  const routeKeys=x.route_binding_table.bindings.map(r=>`${r.transition_class}\u0000${r.role_id}\u0000${r.action_id}`)
  if(new Set(x.route_binding_table.bindings.map(r=>r.transition_class)).size!==x.route_binding_table.bindings.length||routeKeys.some((k,i)=>i>0&&compare(routeKeys[i-1],k)>=0))return '/route_binding_table/bindings:duplicate_set_member'
  for(let i=0;i<x.route_binding_table.event_authority_bindings.length;i+=1){const e=x.route_binding_table.event_authority_bindings[i];p=exact(e,['event_type','authority_source','authority_selector','head_binding'],`/route_binding_table/event_authority_bindings/${i}`);if(p)return p;p=exact(e.authority_selector,['kind','value'],`/route_binding_table/event_authority_bindings/${i}/authority_selector`);if(p)return p;if(!oneOf(eventTypes,e.event_type)||!oneOf(Object.keys(selectorValues) as EventAuthorityBindingV1['authority_source'][],e.authority_source)||e.authority_selector.kind!==e.authority_source||!selectorValues[e.authority_source].includes(e.authority_selector.value)||!oneOf(['required','nullable'] as const,e.head_binding))return `/route_binding_table/event_authority_bindings/${i}:invalid_conditional_matrix`}
  if(new Set(x.route_binding_table.event_authority_bindings.map(e=>e.event_type)).size!==eventTypes.length)return '/route_binding_table/event_authority_bindings:duplicate_set_member'
  p=exact(x.gate_profile,['profile_version','profile_id','gate_rows','profile_digest'],'/gate_profile');if(p)return p
  if(x.gate_profile.profile_version!=='gate_profile_v1'||!nonEmpty(x.gate_profile.profile_id)||!sha(x.gate_profile.profile_digest))return '/gate_profile:invalid_type_or_format'
  for(let i=0;i<x.gate_profile.gate_rows.length;i+=1){const g=x.gate_profile.gate_rows[i];p=exact(g,['gate_id','ordinal','required_evidence_types','gsp_field_id'],`/gate_profile/gate_rows/${i}`);if(p)return p;if(!nonEmpty(g.gate_id)||g.ordinal!==i+1||!setOf(g.required_evidence_types,z=>oneOf(sourceTypes,z))||!oneOf(gspFields,g.gsp_field_id))return `/gate_profile/gate_rows/${i}:invalid_conditional_matrix`}
  p=exact(x.protected_action_profile,['profile_version','profile_id','mode','action_rows','profile_digest'],'/protected_action_profile');if(p)return p
  if(x.protected_action_profile.profile_version!=='protected_action_profile_v1'||!nonEmpty(x.protected_action_profile.profile_id)||x.protected_action_profile.mode!=='wait_only'||!sha(x.protected_action_profile.profile_digest))return '/protected_action_profile:invalid_type_or_format'
  for(let i=0;i<x.protected_action_profile.action_rows.length;i+=1){const a=x.protected_action_profile.action_rows[i];p=exact(a,['action_id','approval_required','exact_head_required','exact_base_required','one_use','executor_role_id','authority_record_url'],`/protected_action_profile/action_rows/${i}`);if(p)return p;if(!nonEmpty(a.action_id)||a.approval_required!==true||a.exact_head_required!==true||typeof a.exact_base_required!=='boolean'||a.one_use!==true||!nonEmpty(a.executor_role_id)||!canonical(a.authority_record_url))return `/protected_action_profile/action_rows/${i}:invalid_type_or_format`}
  for(const profile of [x.authority_projection_profile,x.route_binding_table,x.gate_profile,x.protected_action_profile]){const y={...profile} as ObjectValue,expected=y.profile_digest;delete y.profile_digest;if(digestContinuousOrchestrationJsonV1(y)!==expected)return '/profile_digest:invalid_cross_input_binding'}
  return undefined
}
export const validateGenericProgressRunnerProfilesV1=(v:unknown):ClosedAdmissionResultV1<GenericProgressRunnerProfilesV1>=>{try{const p=profileProblem(v);return p?rejected(p):accepted(v as GenericProgressRunnerProfilesV1)}catch{return failed('profiles')}}

const eventProblem=(v:unknown)=>{const p=exact(v,['event_version','event_id','event_type','task_id','assignment_revision','canonical_record_url','authoring_role','authority_snapshot_digest','subject_head_sha_or_null','predecessor_event_id_or_null','observed_at','semantic_event_digest']);if(p)return p;const e=v as ContinuousOrchestrationEventV1;if(e.event_version!==EVENT_VERSION||!sha(e.event_id)||!oneOf(eventTypes,e.event_type)||!nonEmpty(e.task_id)||!positive(e.assignment_revision)||!canonical(e.canonical_record_url)||!nonEmpty(e.authoring_role)||!sha(e.authority_snapshot_digest)||!nullable(gitSha,e.subject_head_sha_or_null)||!nullable(sha,e.predecessor_event_id_or_null)||!utc(e.observed_at)||!sha(e.semantic_event_digest))return ':invalid_type_or_format';const projection={event_version:e.event_version,event_type:e.event_type,task_id:e.task_id,assignment_revision:e.assignment_revision,canonical_record_url:e.canonical_record_url,authoring_role:e.authoring_role,authority_snapshot_digest:e.authority_snapshot_digest,subject_head_sha_or_null:e.subject_head_sha_or_null,predecessor_event_id_or_null:e.predecessor_event_id_or_null};const expected=digestContinuousOrchestrationJsonV1(projection);return e.event_id===expected&&e.semantic_event_digest===expected?undefined:'/semantic_event_digest:invalid_cross_input_binding'}
export const validateContinuousOrchestrationEventV1=(v:unknown):ClosedAdmissionResultV1<ContinuousOrchestrationEventV1>=>{try{const p=eventProblem(v);return p?rejected(p):accepted(v as ContinuousOrchestrationEventV1)}catch{return failed('event')}}
const evaluationFields:Readonly<Record<ProgressionEvaluatorResultV1['kind'],readonly string[]>>={
  recommend_next_role:['kind','target_role_id','next_action_id','predecessor_canonical_url','target_head_sha_or_null'],
  wait_for_protected_action:['kind','protected_action_id'],require_gate_status_update:['kind'],
  invalidate_approval:['kind','invalidation_class'],stop:['kind','stop_condition','recovery_role_id'],
  no_transition:['kind','future_event_type','future_event_role_id'],complete_task_candidate:['kind','completion_evidence_urls'],
}
const evaluationProblem=(v:unknown)=>{
  if(!object(v)||!oneOf(Object.keys(evaluationFields) as ProgressionEvaluatorResultV1['kind'][],v.kind))return '/kind:invalid_enum'
  const p=exact(v,evaluationFields[v.kind]);if(p)return p
  if(v.kind==='recommend_next_role'&&(!nonEmpty(v.target_role_id)||!nonEmpty(v.next_action_id)||!canonical(v.predecessor_canonical_url)||!nullable(gitSha,v.target_head_sha_or_null)))return ':invalid_type_or_format'
  if(v.kind==='wait_for_protected_action'&&!nonEmpty(v.protected_action_id))return ':invalid_type_or_format'
  if(v.kind==='invalidate_approval'&&!oneOf(['head_drift','base_drift','pr_state_drift','check_drift','finding_drift','gsp_drift','expired','consumed','malformed','scope_mismatch'] as const,v.invalidation_class))return '/invalidation_class:invalid_enum'
  if(v.kind==='stop'&&(!oneOf(['canonical_conflict','architecture_gap','ambiguous_role_ownership','blocking_finding','external_blocker'] as const,v.stop_condition)||!nonEmpty(v.recovery_role_id)))return ':invalid_type_or_format'
  if(v.kind==='no_transition'&&(!oneOf(eventTypes,v.future_event_type)||!nonEmpty(v.future_event_role_id)))return ':invalid_type_or_format'
  if(v.kind==='complete_task_candidate'&&!setOf(v.completion_evidence_urls,canonical))return ':invalid_type_or_format'
  return undefined
}
export const validateProgressionEvaluatorResultV1=(v:unknown):ClosedAdmissionResultV1<ProgressionEvaluatorResultV1>=>{try{const p=evaluationProblem(v);return p?rejected(p):accepted(v as ProgressionEvaluatorResultV1)}catch{return failed('evaluation')}}
const assignmentBindingProblem=(v:unknown,path:string,profiles?:GenericProgressRunnerProfilesV1)=>{
  let p=exact(v,['binding_version','assignment_record_url','assignment_revision','route_binding_table_profile_id','route_binding_table_digest','transition_class','route_binding'],path);if(p)return p
  const x=v as ActiveActionAssignmentBindingV1
  p=routeProblem(x.route_binding,`${path}/route_binding`);if(p)return p
  if(x.binding_version!=='active_action_assignment_binding_v1'||!canonical(x.assignment_record_url)||!positive(x.assignment_revision)||!nonEmpty(x.route_binding_table_profile_id)||!sha(x.route_binding_table_digest)||!oneOf(['final_regression','operational_validation'] as const,x.transition_class)||x.route_binding.transition_class!==x.transition_class||x.route_binding.independent_from_role_id_or_null!==null)return `${path}:invalid_conditional_matrix`
  if(profiles&&(x.route_binding_table_profile_id!==profiles.route_binding_table.profile_id||x.route_binding_table_digest!==profiles.route_binding_table.profile_digest||profiles.route_binding_table.bindings.filter(r=>canonicalizeContinuousOrchestrationJsonV1(r)===canonicalizeContinuousOrchestrationJsonV1(x.route_binding)).length!==1))return `${path}:invalid_cross_input_binding`
  return undefined
}
const expectedStateProblem=(v:unknown,path:string,state?:ContinuousOrchestrationStateV1)=>{
  const p=exact(v,['expected_state_version','state_version','expected_state_revision','expected_state_digest','semantic_counter_epoch_id','authority_snapshot_digest','active_gate_id_or_null','active_transition_class','active_role_id','active_action_id','active_route_binding_digest'],path);if(p)return p
  const x=v as ActiveActionExpectedStateV1
  if(x.expected_state_version!=='active_action_expected_state_v1'||x.state_version!==STATE_VERSION||!uint(x.expected_state_revision)||!sha(x.expected_state_digest)||!sha(x.semantic_counter_epoch_id)||!sha(x.authority_snapshot_digest)||!nullable(nonEmpty,x.active_gate_id_or_null)||!oneOf(['final_regression','operational_validation'] as const,x.active_transition_class)||!nonEmpty(x.active_role_id)||!nonEmpty(x.active_action_id)||!sha(x.active_route_binding_digest))return `${path}:invalid_type_or_format`
  if(state&&(x.expected_state_revision!==state.state_revision||x.expected_state_digest!==digestContinuousOrchestrationJsonV1(state)||x.semantic_counter_epoch_id!==state.semantic_counter_epoch.epoch_id||x.authority_snapshot_digest!==state.authority_snapshot.snapshot_digest||x.active_gate_id_or_null!==state.active_gate||state.active_role_binding===null||x.active_transition_class!==state.active_role_binding.transition_class||x.active_role_id!==state.active_role_binding.role_id||x.active_action_id!==state.active_action_id||x.active_route_binding_digest!==digestContinuousOrchestrationJsonV1(state.active_role_binding)))return `${path}:invalid_cross_input_binding`
  return undefined
}
const proofProblem=(v:unknown,path:string,event?:ContinuousOrchestrationEventV1,profiles?:GenericProgressRunnerProfilesV1,state?:ContinuousOrchestrationStateV1)=>{
  let p=exact(v,['proof_version','task_id','event_digest','active_action_id','assignment_authority','expected_state','proof_digest'],path);if(p)return p
  const x=v as ActiveActionAdmissionProofV1
  p=assignmentBindingProblem(x.assignment_authority,`${path}/assignment_authority`,profiles);if(p)return p
  p=expectedStateProblem(x.expected_state,`${path}/expected_state`,state);if(p)return p
  if(x.proof_version!=='active_action_admission_proof_v1'||!nonEmpty(x.task_id)||!sha(x.event_digest)||!nonEmpty(x.active_action_id)||!sha(x.proof_digest))return `${path}:invalid_type_or_format`
  const semantic={...x} as ObjectValue;delete semantic.proof_digest
  if(digestContinuousOrchestrationJsonV1(semantic)!==x.proof_digest)return `${path}/proof_digest:invalid_cross_input_binding`
  if(event&&(x.event_digest!==event.semantic_event_digest||x.task_id!==event.task_id||event.assignment_revision!==x.assignment_authority.assignment_revision||event.authoring_role!==x.assignment_authority.route_binding.role_id))return `${path}:invalid_cross_input_binding`
  if(x.active_action_id!==x.assignment_authority.route_binding.action_id||x.active_action_id!==x.expected_state.active_action_id||x.assignment_authority.transition_class!==x.expected_state.active_transition_class||x.assignment_authority.route_binding.role_id!==x.expected_state.active_role_id||digestContinuousOrchestrationJsonV1(x.assignment_authority.route_binding)!==x.expected_state.active_route_binding_digest)return `${path}:invalid_cross_input_binding`
  return undefined
}
const casOperandProblem=(v:unknown,path:string,proof?:ActiveActionAdmissionProofV1,event?:ContinuousOrchestrationEventV1)=>{
  const p=exact(v,['operand_version','task_id','semantic_event_digest','proof_digest','expected_assignment_revision','expected_state_revision','expected_state_digest','expected_authority_snapshot_digest','expected_active_transition_class','expected_active_role_id','expected_active_action_id','expected_active_route_binding_digest','next_state_revision','cas_operand_digest'],path);if(p)return p
  const x=v as ActiveActionCasOperandV1
  if(x.operand_version!=='active_action_cas_operand_v1'||!nonEmpty(x.task_id)||!sha(x.semantic_event_digest)||!sha(x.proof_digest)||!positive(x.expected_assignment_revision)||!uint(x.expected_state_revision)||!sha(x.expected_state_digest)||!sha(x.expected_authority_snapshot_digest)||!oneOf(['final_regression','operational_validation'] as const,x.expected_active_transition_class)||!nonEmpty(x.expected_active_role_id)||!nonEmpty(x.expected_active_action_id)||!sha(x.expected_active_route_binding_digest)||x.next_state_revision!==x.expected_state_revision+1||!sha(x.cas_operand_digest))return `${path}:invalid_type_or_format`
  const semantic={...x} as ObjectValue;delete semantic.cas_operand_digest
  if(digestContinuousOrchestrationJsonV1(semantic)!==x.cas_operand_digest)return `${path}/cas_operand_digest:invalid_cross_input_binding`
  if(proof&&(x.task_id!==proof.task_id||x.semantic_event_digest!==proof.event_digest||x.proof_digest!==proof.proof_digest||x.expected_assignment_revision!==proof.assignment_authority.assignment_revision||x.expected_state_revision!==proof.expected_state.expected_state_revision||x.expected_state_digest!==proof.expected_state.expected_state_digest||x.expected_authority_snapshot_digest!==proof.expected_state.authority_snapshot_digest||x.expected_active_transition_class!==proof.expected_state.active_transition_class||x.expected_active_role_id!==proof.expected_state.active_role_id||x.expected_active_action_id!==proof.expected_state.active_action_id||x.expected_active_route_binding_digest!==proof.expected_state.active_route_binding_digest))return `${path}:invalid_cross_input_binding`
  if(event&&(x.task_id!==event.task_id||x.semantic_event_digest!==event.semantic_event_digest))return `${path}:invalid_cross_input_binding`
  return undefined
}
const replayDiscriminantProblem=(v:unknown,path:string)=>{
  const p=exact(v,['discriminant_version','source_event_type','validation_class_or_null'],path);if(p)return p
  const x=v as ReplayEventValidationDiscriminantV1
  if(x.discriminant_version!=='replay_event_validation_discriminant_v1'||!oneOf(eventTypes,x.source_event_type)||!nullable(z=>oneOf(['final_regression','operational_validation'] as const,z),x.validation_class_or_null))return `${path}:invalid_type_or_format`
  if((x.source_event_type==='validation_completed')!==(x.validation_class_or_null!==null))return `${path}:invalid_conditional_matrix`
  return undefined
}
const discriminantFor=(sourceEventType:EventTypeV1,validationClass:'final_regression'|'operational_validation'|null):ReplayEventValidationDiscriminantV1=>frozen({
  discriminant_version:'replay_event_validation_discriminant_v1',
  source_event_type:sourceEventType,
  validation_class_or_null:validationClass,
})
const replayBindingProblem=(v:unknown,path:string)=>{
  const keys=['replay_binding_version','task_id','semantic_counter_epoch_id','event_digest','proof_digest','cas_operand_digest','binding_idempotency_key','active_action_id','assignment_record_url','assignment_revision','route_binding_table_profile_id','route_binding_table_digest','transition_class','route_role_id','route_action_id','route_authority_record_url','route_allowed_scope_digest','expected_state_revision','expected_state_digest','expected_authority_snapshot_digest','expected_active_transition_class','expected_active_role_id','expected_active_action_id','expected_active_route_binding_digest','provenance_record_url','provenance_digest','event_validation_discriminant','event_validation_discriminant_digest','replay_binding_digest']
  let p=exact(v,keys,path);if(p)return p
  const x=v as ActiveActionReplayBindingV1
  p=replayDiscriminantProblem(x.event_validation_discriminant,`${path}/event_validation_discriminant`);if(p)return p
  if(x.replay_binding_version!=='active_action_replay_binding_v1'||!nonEmpty(x.task_id)||!sha(x.semantic_counter_epoch_id)||!sha(x.event_digest)||!sha(x.proof_digest)||!sha(x.cas_operand_digest)||!sha(x.binding_idempotency_key)||!nonEmpty(x.active_action_id)||!canonical(x.assignment_record_url)||!positive(x.assignment_revision)||!nonEmpty(x.route_binding_table_profile_id)||!sha(x.route_binding_table_digest)||!oneOf(['final_regression','operational_validation'] as const,x.transition_class)||!nonEmpty(x.route_role_id)||!nonEmpty(x.route_action_id)||!canonical(x.route_authority_record_url)||!sha(x.route_allowed_scope_digest)||!uint(x.expected_state_revision)||!sha(x.expected_state_digest)||!sha(x.expected_authority_snapshot_digest)||!oneOf(['final_regression','operational_validation'] as const,x.expected_active_transition_class)||!nonEmpty(x.expected_active_role_id)||!nonEmpty(x.expected_active_action_id)||!sha(x.expected_active_route_binding_digest)||!canonical(x.provenance_record_url)||!sha(x.provenance_digest)||!sha(x.event_validation_discriminant_digest)||!sha(x.replay_binding_digest))return `${path}:invalid_type_or_format`
  const semantic={...x} as ObjectValue;delete semantic.replay_binding_digest
  if(digestContinuousOrchestrationJsonV1(semantic)!==x.replay_binding_digest||digestContinuousOrchestrationJsonV1(x.event_validation_discriminant)!==x.event_validation_discriminant_digest||x.event_validation_discriminant.source_event_type!=='validation_completed'||x.event_validation_discriminant.validation_class_or_null!==x.transition_class||x.active_action_id!==x.route_action_id||x.active_action_id!==x.expected_active_action_id||x.transition_class!==x.expected_active_transition_class||x.route_role_id!==x.expected_active_role_id)return `${path}:invalid_cross_input_binding`
  return undefined
}
export const validateActiveActionAdmissionEnvelopeV1=(v:unknown):ClosedAdmissionResultV1<ActiveActionAdmissionEnvelopeV1>=>{try{
  let p=exact(v,['envelope_version','event','active_action_proof_or_null','active_action_cas_operand_or_null']);if(p)return rejected(p)
  const x=v as ActiveActionAdmissionEnvelopeV1
  if(x.envelope_version!=='active_action_admission_envelope_v1')return rejected('/envelope_version:invalid_enum')
  p=eventProblem(x.event);if(p)return rejected(`/event${p}`)
  if(x.active_action_proof_or_null!==null){p=proofProblem(x.active_action_proof_or_null,'/active_action_proof_or_null');if(p)return rejected(p)}
  if(x.active_action_cas_operand_or_null!==null){p=casOperandProblem(x.active_action_cas_operand_or_null,'/active_action_cas_operand_or_null');if(p)return rejected(p)}
  return accepted(x)
}catch{return failed('active-action-envelope')}}

const sourceTypeBindingProblem=(v:unknown,path:string)=>{
  const p=exact(v,['source_type','collector_adapter_id','canonical_authority_required','required_field_ids','optional_field_ids','authority_owner_contract_url'],path);if(p)return p
  const x=v as AuthorityProjectionProfileV1['source_type_bindings'][number]
  if(x.source_type!=='result_handoff'||!nonEmpty(x.collector_adapter_id)||typeof x.canonical_authority_required!=='boolean'||!setOf(x.required_field_ids,z=>oneOf(identityFields,z))||!setOf(x.optional_field_ids,z=>oneOf(identityFields,z))||!canonical(x.authority_owner_contract_url))return `${path}:invalid_type_or_format`
  return undefined
}
const collectorAuthorityProblem=(v:unknown,path:string)=>{
  let p=exact(v,['authority_ref_version','task_id','assignment_record_url','assignment_revision','authority_projection_profile_id','authority_projection_profile_digest','source_type_binding','collector_role_id'],path);if(p)return p
  const x=v as CollectorAuthorityRefV1
  p=sourceTypeBindingProblem(x.source_type_binding,`${path}/source_type_binding`);if(p)return p
  if(x.authority_ref_version!=='collector_authority_ref_v1'||!nonEmpty(x.task_id)||!canonical(x.assignment_record_url)||!positive(x.assignment_revision)||!nonEmpty(x.authority_projection_profile_id)||!sha(x.authority_projection_profile_digest)||!nonEmpty(x.collector_role_id))return `${path}:invalid_type_or_format`
  return undefined
}
const observationProblem=(v:unknown,path='')=>{
  if(!object(v)||!oneOf(['retrieved','unavailable'] as const,v.retrieval_state))return `${path}/retrieval_state:invalid_enum`
  const keys=v.retrieval_state==='retrieved'?['observation_version','collector_authority','record_url','observed_at','retrieval_state','body_text','body_utf8_sha256']:['observation_version','collector_authority','record_url','observed_at','retrieval_state','failure_class']
  let p=exact(v,keys,path);if(p)return p
  const x=v as unknown as CollectedProvenanceObservationPayloadV1
  p=collectorAuthorityProblem(x.collector_authority,`${path}/collector_authority`);if(p)return p
  if(x.observation_version!=='collected_provenance_observation_v1'||!canonical(x.record_url)||!utc(x.observed_at))return `${path}:invalid_type_or_format`
  if(x.retrieval_state==='retrieved'&&(!nonEmpty(x.body_text)||!sha(x.body_utf8_sha256)||hash(x.body_text)!==x.body_utf8_sha256))return `${path}:invalid_conditional_matrix`
  if(x.retrieval_state==='unavailable'&&!oneOf(['not_found','permission_denied','transport_error','unreadable_body'] as const,x.failure_class))return `${path}:invalid_type_or_format`
  return undefined
}
const provenanceAssignmentProblem=(v:unknown,path:string)=>{
  const p=exact(v,['assignment_record_url','assignment_revision','route_binding_table_profile_id','route_binding_table_digest','transition_class','route_role_id','route_action_id','route_authority_record_url','route_allowed_scope_digest'],path);if(p)return p
  const x=v as ActiveActionProvenanceAssignmentV1
  if(!canonical(x.assignment_record_url)||!positive(x.assignment_revision)||!nonEmpty(x.route_binding_table_profile_id)||!sha(x.route_binding_table_digest)||!oneOf(['final_regression','operational_validation'] as const,x.transition_class)||!nonEmpty(x.route_role_id)||!nonEmpty(x.route_action_id)||!canonical(x.route_authority_record_url)||!sha(x.route_allowed_scope_digest))return `${path}:invalid_type_or_format`
  return undefined
}
const provenanceProblem=(v:unknown,path='')=>{
  let p=exact(v,['provenance_version','canonical_record_url','task_id','source_event_type','validation_class','source_event_digest','assignment_authority','active_action_id','authoring_role_id','provenance_digest'],path);if(p)return p
  const x=v as ActiveActionProvenanceRecordV1
  p=provenanceAssignmentProblem(x.assignment_authority,`${path}/assignment_authority`);if(p)return p
  if(x.provenance_version!=='active_action_provenance_v1'||!canonical(x.canonical_record_url)||!nonEmpty(x.task_id)||!nonEmpty(x.source_event_type)||!oneOf(['final_regression','operational_validation'] as const,x.validation_class)||!sha(x.source_event_digest)||!nonEmpty(x.active_action_id)||!nonEmpty(x.authoring_role_id)||!sha(x.provenance_digest))return `${path}:invalid_type_or_format`
  const semantic={...x} as ObjectValue;delete semantic.provenance_digest
  return digestContinuousOrchestrationJsonV1(semantic)===x.provenance_digest?undefined:`${path}/provenance_digest:invalid_cross_input_binding`
}
const collectorAuthorityFor=(s:ContinuousOrchestrationStateV1,p:GenericProgressRunnerProfilesV1):CollectorAuthorityRefV1=>{
  const source=p.authority_projection_profile.source_type_bindings.find(x=>x.source_type==='result_handoff')
  if(!source)throw new TypeError('collector authority missing')
  return frozen({authority_ref_version:'collector_authority_ref_v1',task_id:s.task_id,assignment_record_url:s.semantic_counter_epoch.current_assignment_url,assignment_revision:s.assignment_revision,authority_projection_profile_id:p.authority_projection_profile.profile_id,authority_projection_profile_digest:p.authority_projection_profile.profile_digest,source_type_binding:source,collector_role_id:p.authority_projection_profile.collector_role_id})
}
type OwnedRetrievalResultV1=
  | Readonly<{retrieval_state:'retrieved';body_text:string}>
  | Readonly<{retrieval_state:'unavailable';failure_class:'not_found'|'permission_denied'|'transport_error'|'unreadable_body'}>
type OwnedRetrievalV1=(recordUrl:string)=>OwnedRetrievalResultV1
type CollectorFaultModeV1='snapshot_digest'|'snapshot_unknown_field'|'snapshot_body_digest'|'issuer_assignment'|'issuer_profile'|'issuer_source'|'issuer_role'
type CollectorEntry={
  readonly brand:object
  readonly issuer:object
  readonly authority:CollectorAuthorityRefV1
  readonly snapshot:CollectedProvenanceObservationPayloadV1
  readonly snapshotJcs:string
  readonly snapshotDigest:Sha256
  readonly issuerDigest:Sha256
  readonly bindingDigest:Sha256
}
const collectorPrivateBrand=Object.freeze({})
const collectorRegistry=new WeakMap<object,CollectorEntry>()
const activeCollectorIssuers=new Map<string,object>()
const nodeIsProxy=((globalThis as unknown as {process?:{getBuiltinModule?:(id:string)=>{types?:{isProxy?:(value:unknown)=>boolean}}}}).process?.getBuiltinModule?.('node:util')?.types?.isProxy)??(()=>false)
const deeplyFrozen=(value:unknown):boolean=>{
  if(value===null||typeof value!=='object')return true
  if(!Object.isFrozen(value))return false
  for(const descriptor of Object.values(Object.getOwnPropertyDescriptors(value))){
    if(!('value' in descriptor)||descriptor.get!==undefined||descriptor.set!==undefined||!deeplyFrozen(descriptor.value))return false
  }
  return true
}
const copyOwnedDataTree=(value:unknown,seen=new Set<object>(),depth=0):unknown=>{
  if(value===null||typeof value==='boolean'||typeof value==='string')return value
  if(typeof value==='number'){if(!Number.isFinite(value))throw new TypeError('non-finite owner source');return value}
  if(typeof value!=='object'||depth>64||seen.has(value)||nodeIsProxy(value))throw new TypeError('invalid owner source')
  seen.add(value)
  try{
    const prototype=Object.getPrototypeOf(value)
    const descriptors=Object.getOwnPropertyDescriptors(value)
    if(Array.isArray(value)){
      if(prototype!==Array.prototype)throw new TypeError('custom array prototype')
      const keys=Reflect.ownKeys(descriptors)
      if(keys.some(key=>typeof key!=='string'))throw new TypeError('symbol array key')
      const lengthDescriptor=descriptors.length
      const length=typeof lengthDescriptor?.value==='number'&&Number.isSafeInteger(lengthDescriptor.value)&&lengthDescriptor.value>=0?lengthDescriptor.value:null
      if(length===null)throw new TypeError('invalid array length')
      const expected=['length',...Array.from({length},(_,index)=>String(index))].sort()
      const actual=(keys as string[]).sort()
      if(actual.length!==expected.length||actual.some((key,index)=>key!==expected[index]))throw new TypeError('sparse or extended array')
      const result:unknown[]=[]
      for(let index=0;index<length;index+=1){
        const descriptor=descriptors[String(index)]
        if(!descriptor||!('value' in descriptor)||descriptor.get!==undefined||descriptor.set!==undefined||!descriptor.enumerable)throw new TypeError('invalid array descriptor')
        result.push(copyOwnedDataTree(descriptor.value,seen,depth+1))
      }
      return result
    }
    if(prototype!==Object.prototype)throw new TypeError('custom object prototype')
    const keys=Reflect.ownKeys(descriptors)
    if(keys.some(key=>typeof key!=='string'))throw new TypeError('symbol object key')
    const result:ObjectValue={}
    for(const key of keys as string[]){
      const descriptor=descriptors[key]
      if(!descriptor||!('value' in descriptor)||descriptor.get!==undefined||descriptor.set!==undefined||!descriptor.enumerable)throw new TypeError('invalid object descriptor')
      result[key]=copyOwnedDataTree(descriptor.value,seen,depth+1)
    }
    return result
  }finally{seen.delete(value)}
}
const admitOwnedRetrieval=(value:unknown):OwnedRetrievalResultV1=>{
  const copied=copyOwnedDataTree(value)
  if(!object(copied)||!oneOf(['retrieved','unavailable'] as const,copied.retrieval_state))throw new TypeError('collector retrieval failed')
  if(copied.retrieval_state==='retrieved'){
    if(exact(copied,['retrieval_state','body_text'])!==undefined||!nonEmpty(copied.body_text))throw new TypeError('collector retrieval failed')
    return copied as OwnedRetrievalResultV1
  }
  if(exact(copied,['retrieval_state','failure_class'])!==undefined||!oneOf(['not_found','permission_denied','transport_error','unreadable_body'] as const,copied.failure_class))throw new TypeError('collector retrieval failed')
  return copied as OwnedRetrievalResultV1
}
const collectorBindingDigest=(issuerDigest:Sha256,snapshotDigest:Sha256)=>digestContinuousOrchestrationJsonV1({
  binding_version:'trusted_collector_capability_binding_v1',
  issuer_authority_digest:issuerDigest,
  payload_snapshot_digest:snapshotDigest,
})
const createOwnedCollectorPort=(authority:CollectorAuthorityRefV1,retrieve:OwnedRetrievalV1)=>{
  if(typeof retrieve!=='function')throw new TypeError('closed owner admission failed')
  const authoritySnapshot=frozen(JSON.parse(canonicalizeContinuousOrchestrationJsonV1(authority)) as CollectorAuthorityRefV1)
  const authorityKey=digestContinuousOrchestrationJsonV1(authoritySnapshot)
  if(activeCollectorIssuers.has(authorityKey))throw new TypeError('collector issuer already active')
  const issuer=Object.freeze({})
  activeCollectorIssuers.set(authorityKey,issuer)
  return Object.freeze({collect(recordUrl:string,observedAt:string):TrustedCollectedProvenanceObservationV1{
    const result=admitOwnedRetrieval(retrieve(recordUrl))
    const payload:CollectedProvenanceObservationPayloadV1=result.retrieval_state==='retrieved'?{
      observation_version:'collected_provenance_observation_v1',collector_authority:authoritySnapshot,record_url:recordUrl,observed_at:observedAt,retrieval_state:'retrieved',body_text:result.body_text,body_utf8_sha256:hash(result.body_text),
    }:{
      observation_version:'collected_provenance_observation_v1',collector_authority:authoritySnapshot,record_url:recordUrl,observed_at:observedAt,retrieval_state:'unavailable',failure_class:result.failure_class,
    }
    if(observationProblem(payload)!==undefined)throw new TypeError('collector issuance failed')
    const snapshotJcs=canonicalizeContinuousOrchestrationJsonV1(payload)
    const snapshot=frozen(JSON.parse(snapshotJcs) as CollectedProvenanceObservationPayloadV1)
    const snapshotDigest=hash(snapshotJcs),issuerDigest=digestContinuousOrchestrationJsonV1(authoritySnapshot)
    const handle=Object.freeze(Object.create(null)) as TrustedCollectedProvenanceObservationV1
    collectorRegistry.set(handle as object,{brand:collectorPrivateBrand,issuer,authority:authoritySnapshot,snapshot,snapshotJcs,snapshotDigest,issuerDigest,bindingDigest:collectorBindingDigest(issuerDigest,snapshotDigest)})
    return handle
  }})
}
const restartCollectorAuthority=(authority:CollectorAuthorityRefV1)=>{activeCollectorIssuers.delete(digestContinuousOrchestrationJsonV1(authority))}
const unwrapTrustedObservationInternal=(value:unknown,expectedAuthority:CollectorAuthorityRefV1):UnwrapResult=>{
  if(!object(value))return {ok:false,code:'provenance_injection'}
  const entry=collectorRegistry.get(value)
  if(!entry||entry.brand!==collectorPrivateBrand)return {ok:false,code:'provenance_injection'}
  const expectedAuthorityKey=digestContinuousOrchestrationJsonV1(expectedAuthority)
  if(activeCollectorIssuers.get(expectedAuthorityKey)!==entry.issuer)return {ok:false,code:'provenance_injection'}
  if(!deeplyFrozen(entry.snapshot)||canonicalizeContinuousOrchestrationJsonV1(entry.snapshot)!==entry.snapshotJcs||hash(entry.snapshotJcs)!==entry.snapshotDigest||digestContinuousOrchestrationJsonV1(entry.authority)!==entry.issuerDigest||collectorBindingDigest(entry.issuerDigest,entry.snapshotDigest)!==entry.bindingDigest||observationProblem(entry.snapshot)!==undefined)return {ok:false,code:'malformed_proof'}
  if(canonicalizeContinuousOrchestrationJsonV1(entry.authority)!==canonicalizeContinuousOrchestrationJsonV1(expectedAuthority))return {ok:false,code:'provenance_assignment_mismatch'}
  return {ok:true,payload:entry.snapshot}
}
const corruptTrustedObservation=(value:unknown,mode:CollectorFaultModeV1):void=>{
  if(!object(value))throw new TypeError('unknown test capability')
  const entry=collectorRegistry.get(value)
  if(!entry)throw new TypeError('unknown test capability')
  if(mode==='snapshot_digest'){collectorRegistry.set(value,{...entry,snapshotDigest:hash(`${entry.snapshotJcs}\u0000corrupt`)});return}
  if(mode==='snapshot_unknown_field'||mode==='snapshot_body_digest'){
    const mutable=JSON.parse(entry.snapshotJcs) as ObjectValue
    if(mode==='snapshot_unknown_field')mutable.collector_binding_digest=hash('legacy')
    else mutable.body_utf8_sha256=hash('wrong-body')
    const snapshotJcs=canonicalizeContinuousOrchestrationJsonV1(mutable),snapshot=frozen(JSON.parse(snapshotJcs) as CollectedProvenanceObservationPayloadV1),snapshotDigest=hash(snapshotJcs)
    collectorRegistry.set(value,{...entry,snapshot,snapshotJcs,snapshotDigest,bindingDigest:collectorBindingDigest(entry.issuerDigest,snapshotDigest)})
    return
  }
  const mutable=JSON.parse(canonicalizeContinuousOrchestrationJsonV1(entry.authority)) as ObjectValue
  if(mode==='issuer_assignment')mutable.assignment_revision=Number(mutable.assignment_revision)+1
  else if(mode==='issuer_profile')mutable.authority_projection_profile_id=`${String(mutable.authority_projection_profile_id)}-corrupt`
  else if(mode==='issuer_source'){const source=mutable.source_type_binding as ObjectValue;mutable.source_type_binding={...source,collector_adapter_id:`${String(source.collector_adapter_id)}-corrupt`}}
  else mutable.collector_role_id=`${String(mutable.collector_role_id)}-corrupt`
  const authority=frozen(mutable) as unknown as CollectorAuthorityRefV1,issuerDigest=digestContinuousOrchestrationJsonV1(authority)
  collectorRegistry.set(value,{...entry,authority,issuerDigest,bindingDigest:collectorBindingDigest(issuerDigest,entry.snapshotDigest)})
}
const admitCollectorOwnerAuthority=(stateValue:unknown,profileValue:unknown)=>{
  const profileAdmission=validateGenericProgressRunnerProfilesV1(profileValue)
  if(profileAdmission.kind!=='accepted')throw new TypeError('closed owner admission failed')
  const stateAdmission=validateContinuousOrchestrationStateV1(stateValue,profileAdmission.value)
  if(stateAdmission.kind!=='accepted')throw new TypeError('closed owner admission failed')
  return {state:stateAdmission.value,profiles:profileAdmission.value}
}
const createTrustedProvenanceCollectorPortV1=(stateValue:unknown,profileValue:unknown,retrieve:OwnedRetrievalV1)=>{
  const admitted=admitCollectorOwnerAuthority(stateValue,profileValue),authority=collectorAuthorityFor(admitted.state,admitted.profiles)
  restartCollectorAuthority(authority)
  return createOwnedCollectorPort(authority,retrieve)
}
const attemptSecondTrustedProvenanceCollectorPortForTestV1=(stateValue:unknown,profileValue:unknown,retrieve:OwnedRetrievalV1)=>{
  const admitted=admitCollectorOwnerAuthority(stateValue,profileValue)
  return createOwnedCollectorPort(collectorAuthorityFor(admitted.state,admitted.profiles),retrieve)
}
const restartTrustedProvenanceCollectorForTestV1=(stateValue:unknown,profileValue:unknown)=>{
  const admitted=admitCollectorOwnerAuthority(stateValue,profileValue)
  restartCollectorAuthority(collectorAuthorityFor(admitted.state,admitted.profiles))
}
const corruptTrustedProvenanceObservationForTestV1=(value:unknown,mode:CollectorFaultModeV1)=>corruptTrustedObservation(value,mode)
type UnwrapResult={ok:true;payload:CollectedProvenanceObservationPayloadV1}|{ok:false;code:'provenance_injection'|'malformed_proof'|'provenance_assignment_mismatch'}
const unwrapTrustedObservation=(value:unknown,s:ContinuousOrchestrationStateV1,p:GenericProgressRunnerProfilesV1):UnwrapResult=>{
  return unwrapTrustedObservationInternal(value,collectorAuthorityFor(s,p))
}
const BEGIN='<!-- cov1-active-action-provenance-v1:begin -->',END='<!-- cov1-active-action-provenance-v1:end -->',ROOT='"active_action_provenance"'
type ExtractionResult={ok:true;record:ActiveActionProvenanceRecordV1}|{ok:false;code:'missing_provenance'|'provenance_injection'|'malformed_proof'|'stale_provenance'}
const countToken=(s:string,t:string)=>s.split(t).length-1
const extractProvenance=(body:string,replay:boolean):ExtractionResult=>{
  if(body.charCodeAt(0)===0xfeff||/[\ud800-\udfff]/u.test(body.replace(/[\ud800-\udbff][\udc00-\udfff]/gu,'')))return {ok:false,code:replay?'stale_provenance':'malformed_proof'}
  const rawB=countToken(body,'cov1-active-action-provenance-v1:begin'),rawE=countToken(body,'cov1-active-action-provenance-v1:end'),rawK=countToken(body,ROOT)
  if(rawB>1||rawE>1||rawK>1)return {ok:false,code:'provenance_injection'}
  if(/\r(?!\n)/u.test(body))return {ok:false,code:replay?'stale_provenance':'malformed_proof'}
  const normalized=body.replace(/\r\n/g,'\n'),lines=normalized.split('\n'),B=countToken(normalized,'cov1-active-action-provenance-v1:begin'),E=countToken(normalized,'cov1-active-action-provenance-v1:end'),K=countToken(normalized,ROOT),BL=lines.filter(x=>x===BEGIN).length,EL=lines.filter(x=>x===END).length
  if(B===0&&E===0&&K===0&&BL===0&&EL===0)return {ok:false,code:replay?'stale_provenance':'missing_provenance'}
  if(B>1||E>1||K>1)return {ok:false,code:'provenance_injection'}
  if(B!==1||E!==1||BL!==1||EL!==1)return {ok:false,code:replay?'stale_provenance':'provenance_injection'}
  const i=lines.indexOf(BEGIN)
  if(i<0||lines[i+2]!==END||i+2>=lines.length)return {ok:false,code:replay?'stale_provenance':'provenance_injection'}
  const middle=lines[i+1]
  let parsed:unknown
  try{parsed=JSON.parse(middle)}catch{return {ok:false,code:replay?'stale_provenance':'malformed_proof'}}
  if(!object(parsed)||Object.keys(parsed).length!==1||!own(parsed,'active_action_provenance')||canonicalizeContinuousOrchestrationJsonV1(parsed)!==middle)return {ok:false,code:replay?'stale_provenance':'malformed_proof'}
  const problem=provenanceProblem(parsed.active_action_provenance)
  if(problem)return {ok:false,code:replay?'stale_provenance':'malformed_proof'}
  return {ok:true,record:parsed.active_action_provenance as ActiveActionProvenanceRecordV1}
}

const stateKeys=['state_version','state_revision','task_id','canonical_task_url','repository','assignment_revision','semantic_counter_epoch','opt_in_contract_version','allowed_transition_classes','phase','active_gate','active_role_binding','active_action_id','authority_snapshot','canonical_refs','finding_ledger','loop_counters','approval_state','projection_state','event_cursor','replay_ledger','audit_chain','pending_transport','last_decision_url']
const sourceRefProblem=(v:unknown,path:string)=>{
  if(!object(v)||!oneOf(['canonical_record','pr_snapshot','review_thread','check_evidence'] as const,v.kind))return `${path}/kind:invalid_enum`
  const keys=v.kind==='check_evidence'?['kind','url','check_name','provider_id','checked_head_sha']:['kind','url']
  const p=exact(v,keys,path);if(p)return p
  if(v.kind==='canonical_record'&&!canonical(v.url))return `${path}:invalid_type_or_format`
  if(v.kind==='pr_snapshot'&&!pr(v.url))return `${path}:invalid_type_or_format`
  if(v.kind==='review_thread'&&!reviewThread(v.url))return `${path}:invalid_type_or_format`
  if(v.kind==='check_evidence'&&(!checkEvidence(v.url)||!nonEmpty(v.check_name)||!nonEmpty(v.provider_id)||!gitSha(v.checked_head_sha)))return `${path}:invalid_type_or_format`
  return undefined
}
const sourceRefSortKey=(v:EvidenceSourceRefV1)=>`${v.kind}\u0000${v.url}\u0000${v.kind==='check_evidence'?`${v.check_name}\u0000${v.provider_id}`:''}`
const findingProblem=(f:unknown,path:string,state:ContinuousOrchestrationStateV1)=>{
  let p=exact(f,['finding_id','finding_domain','semantic_requirement_digest','allowed_scope_digest','counter_key','state','correction_role_id','closure_role_id','opening_decision_url','latest_decision_url','attempt_count','closed_at_attempt_or_null'],path);if(p)return p
  const x=f as FindingLoopStateV1
  if(!nonEmpty(x.finding_id)||!oneOf(['architecture','implementation','metadata','validation','publication'] as const,x.finding_domain)||!sha(x.semantic_requirement_digest)||!sha(x.allowed_scope_digest)||!sha(x.counter_key)||!oneOf(['open','closed','reopened','exhausted'] as const,x.state)||!nonEmpty(x.correction_role_id)||!nonEmpty(x.closure_role_id)||x.correction_role_id===x.closure_role_id||!canonical(x.opening_decision_url)||!canonical(x.latest_decision_url)||!uint(x.attempt_count,3)||!nullable((z)=>uint(z,3),x.closed_at_attempt_or_null))return `${path}:invalid_type_or_format`
  if((x.state==='closed')!==(x.closed_at_attempt_or_null!==null)||x.state==='exhausted'&&x.attempt_count!==3||x.closed_at_attempt_or_null!==null&&x.closed_at_attempt_or_null>x.attempt_count)return `${path}:invalid_conditional_matrix`
  const key=digestContinuousOrchestrationJsonV1({task_id:state.task_id,semantic_counter_epoch_id:state.semantic_counter_epoch.epoch_id,finding_domain:x.finding_domain,semantic_requirement_digest:x.semantic_requirement_digest,allowed_scope_digest:x.allowed_scope_digest})
  return key===x.counter_key?undefined:`${path}/counter_key:invalid_cross_input_binding`
}
const metadataCounterProblem=(v:unknown,path:string)=>{
  let p=exact(v,['counter_key','pr_url','head_sha','projection_field_ids','semantic_defect_digest','originating_review_url','subsequent_review_urls','write_attempt_count','state'],path);if(p)return p
  const x=v as MetadataLoopCounterV1
  if(!sha(x.counter_key)||!pr(x.pr_url)||!gitSha(x.head_sha)||!setOf(x.projection_field_ids,z=>oneOf(gspFields,z))||!sha(x.semantic_defect_digest)||!canonical(x.originating_review_url)||!setOf(x.subsequent_review_urls,canonical)||!uint(x.write_attempt_count,3)||!oneOf(['open','closed','exhausted'] as const,x.state)||x.state==='exhausted'&&x.write_attempt_count!==3)return `${path}:invalid_type_or_format`
  return undefined
}
const deliveryCounterProblem=(v:unknown,path:string)=>{
  const p=exact(v,['idempotency_key','delivery_count','last_completion_url_or_null','state'],path);if(p)return p
  const x=v as ContinuousOrchestrationStateV1['loop_counters']['delivery_counters'][number]
  if(!sha(x.idempotency_key)||!uint(x.delivery_count,3)||!nullable(canonical,x.last_completion_url_or_null)||!oneOf(['pending','completed','awaiting_recovery','exhausted'] as const,x.state))return `${path}:invalid_type_or_format`
  if(x.state==='completed'&&x.last_completion_url_or_null===null||x.state==='exhausted'&&x.delivery_count!==3)return `${path}:invalid_conditional_matrix`
  return undefined
}
const replayEntryProblem=(v:unknown,path:string)=>{
  let p=exact(v,['task_id','semantic_counter_epoch_id','semantic_event_digest','decision_id','decision_url','idempotency_key','committed_state_revision','event_validation_discriminant','event_validation_discriminant_digest','active_action_replay_binding_or_null','active_action_provenance_record_url_or_null','active_action_provenance_digest_or_null'],path);if(p)return p
  const x=v as ReplayLedgerEntryV1
  p=replayDiscriminantProblem(x.event_validation_discriminant,`${path}/event_validation_discriminant`);if(p)return p
  if(!(nonEmpty(x.task_id)&&sha(x.semantic_counter_epoch_id)&&sha(x.semantic_event_digest)&&sha(x.decision_id)&&canonical(x.decision_url)&&sha(x.idempotency_key)&&positive(x.committed_state_revision)&&sha(x.event_validation_discriminant_digest)))return `${path}:invalid_type_or_format`
  if(digestContinuousOrchestrationJsonV1(x.event_validation_discriminant)!==x.event_validation_discriminant_digest)return `${path}/event_validation_discriminant_digest:invalid_cross_input_binding`
  if(!nullable(canonical,x.active_action_provenance_record_url_or_null)||!nullable(sha,x.active_action_provenance_digest_or_null))return `${path}:invalid_type_or_format`
  const active=x.active_action_replay_binding_or_null!==null
  if(active!==[x.active_action_provenance_record_url_or_null,x.active_action_provenance_digest_or_null].every(z=>z!==null))return `${path}:invalid_conditional_matrix`
  if(active){p=replayBindingProblem(x.active_action_replay_binding_or_null,`${path}/active_action_replay_binding_or_null`);if(p)return p;const b=x.active_action_replay_binding_or_null as ActiveActionReplayBindingV1;if(x.event_validation_discriminant.source_event_type!=='validation_completed'||x.event_validation_discriminant.validation_class_or_null!==b.transition_class||b.event_validation_discriminant_digest!==x.event_validation_discriminant_digest||b.event_digest!==x.semantic_event_digest||b.binding_idempotency_key!==x.idempotency_key||b.provenance_record_url!==x.active_action_provenance_record_url_or_null||b.provenance_digest!==x.active_action_provenance_digest_or_null)return `${path}:invalid_cross_input_binding`}
  else if(x.event_validation_discriminant.validation_class_or_null!==null)return `${path}:invalid_conditional_matrix`
  return undefined
}
const approvalPairs:Readonly<Record<ContinuousOrchestrationStateV1['approval_state']['state'],readonly ContinuousOrchestrationStateV1['approval_state']['reason'][]>>={
  none:['missing'],current:['matched'],historical_at_prior_head:['head_drift','base_drift','pr_state_drift','check_drift','finding_drift','gsp_drift'],
  invalid:['expired','consumed','malformed','scope_mismatch'],not_evaluable:['unreadable'],
}
const stateProblem=(v:unknown,profiles?:GenericProgressRunnerProfilesV1)=>{
  let p=exact(v,stateKeys);if(p)return p;const s=v as ContinuousOrchestrationStateV1
  if(s.state_version!==STATE_VERSION||!uint(s.state_revision)||!nonEmpty(s.task_id)||!issue(s.canonical_task_url)||!nonEmpty(s.repository)||!positive(s.assignment_revision)||!nonEmpty(s.opt_in_contract_version)||!setOf(s.allowed_transition_classes,z=>oneOf(transitionClasses,z))||!oneOf(phases,s.phase)||!nullable(nonEmpty,s.active_gate)||!nullable(nonEmpty,s.active_action_id)||!nullable(canonical,s.last_decision_url))return ':invalid_type_or_format'
  if(s.active_role_binding!==null&&(p=routeProblem(s.active_role_binding,'/active_role_binding')))return p
  p=exact(s.semantic_counter_epoch,['epoch_id','root_assignment_url','current_assignment_url','current_assignment_revision','predecessor_epoch_id_or_null','disposition','semantic_requirement_digest','allowed_scope_digest','authority_record_url'],'/semantic_counter_epoch');if(p)return p
  if(!sha(s.semantic_counter_epoch.epoch_id)||!canonical(s.semantic_counter_epoch.root_assignment_url)||!canonical(s.semantic_counter_epoch.current_assignment_url)||s.semantic_counter_epoch.current_assignment_revision!==s.assignment_revision||!nullable(sha,s.semantic_counter_epoch.predecessor_epoch_id_or_null)||!oneOf(['initial','carry_forward','supersede_scope'] as const,s.semantic_counter_epoch.disposition)||!sha(s.semantic_counter_epoch.semantic_requirement_digest)||!sha(s.semantic_counter_epoch.allowed_scope_digest)||!canonical(s.semantic_counter_epoch.authority_record_url))return '/semantic_counter_epoch:invalid_type_or_format'
  const epoch=s.semantic_counter_epoch
  if(epoch.disposition==='initial'){
    const expected=digestContinuousOrchestrationJsonV1({task_id:s.task_id,root_assignment_url:epoch.root_assignment_url,semantic_requirement_digest:epoch.semantic_requirement_digest,allowed_scope_digest:epoch.allowed_scope_digest})
    if(epoch.predecessor_epoch_id_or_null!==null||epoch.current_assignment_url!==epoch.root_assignment_url||epoch.epoch_id!==expected)return '/semantic_counter_epoch:invalid_cross_input_binding'
  }else if(epoch.disposition==='carry_forward'){
    if(epoch.predecessor_epoch_id_or_null!==epoch.epoch_id||epoch.current_assignment_revision<=1)return '/semantic_counter_epoch:invalid_conditional_matrix'
  }else{
    const expected=digestContinuousOrchestrationJsonV1({task_id:s.task_id,root_assignment_url:epoch.root_assignment_url,current_assignment_url:epoch.current_assignment_url,current_assignment_revision:epoch.current_assignment_revision,predecessor_epoch_id:epoch.predecessor_epoch_id_or_null,semantic_requirement_digest:epoch.semantic_requirement_digest,allowed_scope_digest:epoch.allowed_scope_digest,authority_record_url:epoch.authority_record_url})
    if(epoch.predecessor_epoch_id_or_null===null||epoch.predecessor_epoch_id_or_null===epoch.epoch_id||epoch.current_assignment_revision<=1||epoch.epoch_id!==expected)return '/semantic_counter_epoch:invalid_cross_input_binding'
  }
  p=exact(s.authority_snapshot,['snapshot_version','snapshot_digest','collected_from','repository','main_sha_or_null','pr_url_or_null','pr_head_sha_or_null','pr_base_sha_or_null','pr_state','check_set_digest_or_null','finding_set_digest','thread_set_digest','workspace_state','gsp_generation_or_null','gsp_body_digest_or_null','approval_consumption_digest_or_null','observed_at'],'/authority_snapshot');if(p)return p
  const a=s.authority_snapshot;if(a.snapshot_version!=='authority_snapshot_ref_v1'||!sha(a.snapshot_digest)||!Array.isArray(a.collected_from)||a.repository!==s.repository||!nullable(gitSha,a.main_sha_or_null)||!nullable(pr,a.pr_url_or_null)||!nullable(gitSha,a.pr_head_sha_or_null)||!nullable(gitSha,a.pr_base_sha_or_null)||!oneOf(['not_applicable','open_draft','open_ready','merged','closed_unmerged'] as const,a.pr_state)||!nullable(sha,a.check_set_digest_or_null)||!sha(a.finding_set_digest)||!sha(a.thread_set_digest)||!oneOf(['not_required','clean_bound','dirty','missing','mismatched'] as const,a.workspace_state)||!nullable((z)=>positive(z),a.gsp_generation_or_null)||!nullable(sha,a.gsp_body_digest_or_null)||!nullable(sha,a.approval_consumption_digest_or_null)||!utc(a.observed_at))return '/authority_snapshot:invalid_type_or_format'
  for(let i=0;i<a.collected_from.length;i+=1){p=sourceRefProblem(a.collected_from[i],`/authority_snapshot/collected_from/${i}`);if(p)return p}
  if(a.collected_from.some((x,i)=>i>0&&compare(sourceRefSortKey(a.collected_from[i-1]),sourceRefSortKey(x))>=0))return '/authority_snapshot/collected_from:duplicate_set_member'
  const prApplicable=a.pr_state!=='not_applicable'
  if(prApplicable!==([a.pr_url_or_null,a.pr_head_sha_or_null,a.pr_base_sha_or_null].every(x=>x!==null))||((a.gsp_generation_or_null===null)!==(a.gsp_body_digest_or_null===null)))return '/authority_snapshot:invalid_conditional_matrix'
  const snap={...a} as ObjectValue;delete snap.snapshot_digest;delete snap.observed_at;if(digestContinuousOrchestrationJsonV1(snap)!==a.snapshot_digest)return '/authority_snapshot/snapshot_digest:invalid_cross_input_binding'
  if(!Array.isArray(s.finding_ledger)||canonicalizeContinuousOrchestrationJsonV1(s.finding_ledger)!==canonicalizeContinuousOrchestrationJsonV1(s.loop_counters.finding_counters))return '/finding_ledger:invalid_cross_input_binding'
  for(let i=0;i<s.finding_ledger.length;i+=1){p=findingProblem(s.finding_ledger[i],`/finding_ledger/${i}`,s);if(p)return p}
  if(new Set(s.finding_ledger.map(x=>x.finding_id)).size!==s.finding_ledger.length||new Set(s.finding_ledger.map(x=>x.counter_key)).size!==s.finding_ledger.length)return '/finding_ledger:duplicate_set_member'
  p=exact(s.canonical_refs,['assignment_url','result_handoff_url_or_null','review_decision_url_or_null','architecture_amendment_url_or_null','resume_dispatch_url_or_null','metadata_result_url_or_null','validation_result_url_or_null','completion_assessment_url_or_null','product_owner_approval_url_or_null','protected_action_completion_url_or_null'],'/canonical_refs');if(p)return p
  if(!canonical(s.canonical_refs.assignment_url)||s.canonical_refs.assignment_url!==epoch.current_assignment_url||Object.entries(s.canonical_refs).some(([k,z])=>k!=='assignment_url'&&!nullable(canonical,z)))return '/canonical_refs:invalid_type_or_format'
  p=exact(s.loop_counters,['finding_counters','metadata_counters','delivery_counters','cycle_ledger'],'/loop_counters');if(p)return p
  if(!Array.isArray(s.loop_counters.finding_counters)||!Array.isArray(s.loop_counters.metadata_counters)||!Array.isArray(s.loop_counters.delivery_counters))return '/loop_counters:invalid_type_or_format'
  for(let i=0;i<s.loop_counters.metadata_counters.length;i+=1){const m=s.loop_counters.metadata_counters[i];p=metadataCounterProblem(m,`/loop_counters/metadata_counters/${i}`);if(p)return p;const expected=digestContinuousOrchestrationJsonV1({task_id:s.task_id,semantic_counter_epoch_id:s.semantic_counter_epoch.epoch_id,semantic_defect_digest:m.semantic_defect_digest});if(m.counter_key!==expected)return `/loop_counters/metadata_counters/${i}/counter_key:invalid_cross_input_binding`}
  for(let i=0;i<s.loop_counters.delivery_counters.length;i+=1){p=deliveryCounterProblem(s.loop_counters.delivery_counters[i],`/loop_counters/delivery_counters/${i}`);if(p)return p}
  if(new Set(s.loop_counters.metadata_counters.map(x=>x.counter_key)).size!==s.loop_counters.metadata_counters.length||new Set(s.loop_counters.delivery_counters.map(x=>x.idempotency_key)).size!==s.loop_counters.delivery_counters.length)return '/loop_counters:duplicate_set_member'
  const c=s.loop_counters.cycle_ledger
  p=exact(c,['cycle_ledger_version','semantic_counter_epoch_id','progress_epoch','max_gate_ordinal_reached','decision_count_without_progress','checkpoint_emitted_without_progress','signature_occurrences','last_progress_record_url'],'/loop_counters/cycle_ledger');if(p)return p
  if(c.cycle_ledger_version!=='cycle_ledger_v1'||c.semantic_counter_epoch_id!==s.semantic_counter_epoch.epoch_id||!uint(c.progress_epoch)||!uint(c.max_gate_ordinal_reached)||!uint(c.decision_count_without_progress,64)||typeof c.checkpoint_emitted_without_progress!=='boolean'||!Array.isArray(c.signature_occurrences)||!canonical(c.last_progress_record_url))return '/loop_counters/cycle_ledger:invalid_type_or_format'
  for(let i=0;i<c.signature_occurrences.length;i+=1){const x=c.signature_occurrences[i];p=exact(x,['cycle_signature','occurrence_count','first_decision_url','last_decision_url'],`/loop_counters/cycle_ledger/signature_occurrences/${i}`);if(p)return p;if(!sha(x.cycle_signature)||!positive(x.occurrence_count)||x.occurrence_count>3||!canonical(x.first_decision_url)||!canonical(x.last_decision_url))return `/loop_counters/cycle_ledger/signature_occurrences/${i}:invalid_type_or_format`}
  if(new Set(c.signature_occurrences.map(x=>x.cycle_signature)).size!==c.signature_occurrences.length||c.decision_count_without_progress<32&&c.checkpoint_emitted_without_progress)return '/loop_counters/cycle_ledger:invalid_conditional_matrix'
  p=exact(s.approval_state,['state','reason','approval_record_url_or_null'],'/approval_state');if(p)return p
  if(!oneOf(Object.keys(approvalPairs) as ContinuousOrchestrationStateV1['approval_state']['state'][],s.approval_state.state)||!approvalPairs[s.approval_state.state].includes(s.approval_state.reason)||!nullable(canonical,s.approval_state.approval_record_url_or_null)||((s.approval_state.state==='none')!==(s.approval_state.approval_record_url_or_null===null)))return '/approval_state:invalid_conditional_matrix'
  p=exact(s.projection_state,['projection_version','state','pr_url_or_null','projected_head_sha_or_null','gsp_generation_or_null','pr_body_digest_or_null','gsp_gate_rows_digest_or_null','citation_record_urls','mismatch_field_ids'],'/projection_state');if(p)return p
  if(s.projection_state.projection_version!=='projection_state_v1'||!oneOf(['current','stale','missing','conflicting','not_required'] as const,s.projection_state.state)||!nullable(pr,s.projection_state.pr_url_or_null)||!nullable(gitSha,s.projection_state.projected_head_sha_or_null)||!nullable((z)=>uint(z),s.projection_state.gsp_generation_or_null)||!nullable(sha,s.projection_state.pr_body_digest_or_null)||!nullable(sha,s.projection_state.gsp_gate_rows_digest_or_null)||!setOf(s.projection_state.citation_record_urls,canonical)||!setOf(s.projection_state.mismatch_field_ids,z=>oneOf(gspFields,z)))return '/projection_state:invalid_type_or_format'
  const ps=s.projection_state,allProjectionNull=[ps.pr_url_or_null,ps.projected_head_sha_or_null,ps.gsp_generation_or_null,ps.pr_body_digest_or_null,ps.gsp_gate_rows_digest_or_null].every(x=>x===null)
  if(ps.state==='not_required'&&(!allProjectionNull||ps.citation_record_urls.length!==0||ps.mismatch_field_ids.length!==0))return '/projection_state:invalid_conditional_matrix'
  if(ps.state==='missing'&&(!(ps.pr_url_or_null&&ps.projected_head_sha_or_null)||ps.gsp_generation_or_null!==null||ps.pr_body_digest_or_null!==null||ps.gsp_gate_rows_digest_or_null!==null))return '/projection_state:invalid_conditional_matrix'
  if(ps.state==='current'&&(!(ps.pr_url_or_null&&ps.projected_head_sha_or_null&&ps.pr_body_digest_or_null&&ps.gsp_gate_rows_digest_or_null)||ps.gsp_generation_or_null===null||ps.citation_record_urls.length===0||ps.mismatch_field_ids.length!==0))return '/projection_state:invalid_conditional_matrix'
  if((ps.state==='stale'||ps.state==='conflicting')&&(!(ps.pr_url_or_null&&ps.projected_head_sha_or_null&&ps.pr_body_digest_or_null)||ps.mismatch_field_ids.length===0))return '/projection_state:invalid_conditional_matrix'
  p=exact(s.event_cursor,['cursor_version','last_event_id_or_null','last_semantic_event_digest_or_null','last_event_record_url_or_null','last_decision_url_or_null','admitted_new_event_count'],'/event_cursor');if(p)return p
  if(s.event_cursor.cursor_version!=='event_cursor_v1'||!nullable(sha,s.event_cursor.last_event_id_or_null)||!nullable(sha,s.event_cursor.last_semantic_event_digest_or_null)||!nullable(canonical,s.event_cursor.last_event_record_url_or_null)||!nullable(canonical,s.event_cursor.last_decision_url_or_null)||!uint(s.event_cursor.admitted_new_event_count))return '/event_cursor:invalid_type_or_format'
  const cursorEmpty=s.event_cursor.admitted_new_event_count===0
  if(cursorEmpty!==[s.event_cursor.last_event_id_or_null,s.event_cursor.last_semantic_event_digest_or_null,s.event_cursor.last_event_record_url_or_null,s.event_cursor.last_decision_url_or_null].every(x=>x===null))return '/event_cursor:invalid_conditional_matrix'
  p=exact(s.replay_ledger,['ledger_version','entries','ledger_digest'],'/replay_ledger');if(p)return p
  if(s.replay_ledger.ledger_version!=='replay_ledger_v1'||!Array.isArray(s.replay_ledger.entries)||!sha(s.replay_ledger.ledger_digest))return '/replay_ledger:invalid_type_or_format'
  for(let i=0;i<s.replay_ledger.entries.length;i+=1){p=replayEntryProblem(s.replay_ledger.entries[i],`/replay_ledger/entries/${i}`);if(p)return p}
  if(new Set(s.replay_ledger.entries.map(x=>x.semantic_event_digest)).size!==s.replay_ledger.entries.length||digestContinuousOrchestrationJsonV1({ledger_version:s.replay_ledger.ledger_version,entries:s.replay_ledger.entries})!==s.replay_ledger.ledger_digest)return '/replay_ledger:invalid_cross_input_binding'
  p=exact(s.audit_chain,['audit_version','head_decision_url_or_null','head_decision_id_or_null','decision_count_total','chain_digest'],'/audit_chain');if(p)return p
  if(s.audit_chain.audit_version!=='audit_chain_ref_v1'||!nullable(canonical,s.audit_chain.head_decision_url_or_null)||!nullable(sha,s.audit_chain.head_decision_id_or_null)||!uint(s.audit_chain.decision_count_total)||!sha(s.audit_chain.chain_digest)||((s.audit_chain.decision_count_total===0)!==([s.audit_chain.head_decision_url_or_null,s.audit_chain.head_decision_id_or_null].every(x=>x===null))))return '/audit_chain:invalid_conditional_matrix'
  if(s.pending_transport!==null){p=exact(s.pending_transport,['intent_version','idempotency_key','decision_url','route_binding','scope_digest','created_from_state_revision','delivery_state','completion_record_url_or_null'],'/pending_transport');if(p)return p;p=routeProblem(s.pending_transport.route_binding,'/pending_transport/route_binding');if(p)return p;if(s.pending_transport.intent_version!=='pending_transport_intent_v1'||!sha(s.pending_transport.idempotency_key)||!canonical(s.pending_transport.decision_url)||!sha(s.pending_transport.scope_digest)||!positive(s.pending_transport.created_from_state_revision)||!oneOf(['prepared','delivered','awaiting_recovery'] as const,s.pending_transport.delivery_state)||!nullable(canonical,s.pending_transport.completion_record_url_or_null)||s.pending_transport.scope_digest!==s.pending_transport.route_binding.allowed_scope_digest||(s.pending_transport.delivery_state==='delivered')!==(s.pending_transport.completion_record_url_or_null!==null))return '/pending_transport:invalid_conditional_matrix'}
  if((s.active_role_binding===null)!==(s.active_action_id===null)||s.active_role_binding!==null&&s.active_role_binding.action_id!==s.active_action_id)return '/active_role_binding:invalid_cross_input_binding'
  if(s.last_decision_url!==s.event_cursor.last_decision_url_or_null||s.replay_ledger.entries.length!==s.event_cursor.admitted_new_event_count||s.audit_chain.decision_count_total!==s.event_cursor.admitted_new_event_count)return '/event_cursor:invalid_cross_input_binding'
  if(profiles){p=profileProblem(profiles);if(p)return `/profiles${p}`;if(!s.allowed_transition_classes.every(t=>profiles.route_binding_table.bindings.some(r=>r.transition_class===t)))return '/allowed_transition_classes:invalid_cross_input_binding'}
  return undefined
}
export const validateContinuousOrchestrationStateV1=(v:unknown,p?:GenericProgressRunnerProfilesV1):ClosedAdmissionResultV1<ContinuousOrchestrationStateV1>=>{try{const q=stateProblem(v,p);return q?rejected(q):accepted(v as ContinuousOrchestrationStateV1)}catch{return failed('state')}}

const branchFields:Record<string,string[]>={
  dispatch_role:['route_binding','predecessor_canonical_url','target_head_sha_or_null'],
  request_independent_review:['route_binding','review_scope_digest','reviewed_head_sha_or_null'],
  request_metadata_sync:['route_binding','pr_url','head_sha','projection_field_ids','citation_record_urls','expected_projection_digest_or_null','must_verify_after_write'],
  await_external_recovery:['controller_condition','terminal_stop_reason','result_handoff_status','recovery_role_id','required_recovery_event_type','recovery_evidence_field_ids','automatic_resume'],
  request_product_owner_decision:['decision_subject_id','decision_scope_digest','required_authority_field_ids','requested_action_id_or_null'],
  await_protected_action:['protected_action_id','approval_record_url','approved_head_sha','approved_base_sha','approved_pr_state','executor_role_id','execution_authority'],
  invalidate_authority:['invalidated_record_urls','invalidation_class','historical_evidence_record_urls','earliest_gate_id','controller_condition','terminal_stop_reason','result_handoff_status','recovery_role_id','required_recovery_event_type','recovery_evidence_field_ids','automatic_resume'],
  complete_task_candidate:['completion_evidence_urls','blocking_finding_count','open_finding_count','assessor_route_binding'],
  stop:['controller_condition','terminal_stop_reason','result_handoff_status','recovery_role_id','required_recovery_event_type','recovery_evidence_field_ids','automatic_resume'],
  no_transition:['required_future_event_type','future_event_role_id'],
}
const commonFields=['decision_version','decision_id','task_id','assignment_revision','input_event_url','input_event_digest','predecessor_decision_url_or_null','authority_snapshot_digest','branch','reason_code','idempotency_key','gsp_hook','next_owner_role_id','evaluated_at']
const semanticDecision=(v:ContinuationDecisionV1)=>{const x=structuredClone(v) as ObjectValue;delete x.decision_id;delete x.idempotency_key;delete x.evaluated_at;return x}
const branchReasons:Readonly<Record<string,readonly string[]>>={
  dispatch_role:['declared_next_role'],request_independent_review:['independent_review_required'],request_metadata_sync:['metadata_projection_mismatch'],
  await_external_recovery:['external_recovery_required'],request_product_owner_decision:['product_decision_required'],
  await_protected_action:['protected_action_completion_required'],invalidate_authority:['authority_drift'],
  complete_task_candidate:['completion_evidence_ready'],stop:['canonical_conflict','architecture_gap','ambiguous_role_ownership','repeated_finding_failure','repeated_transition_cycle'],
  no_transition:['no_declared_transition'],
}
const decisionProblem=(v:unknown)=>{
  if(!object(v)||!nonEmpty(v.branch)||!branchFields[v.branch])return '/branch:invalid_enum'
  let p=exact(v,[...commonFields,...branchFields[v.branch]]);if(p)return p
  const d=v as ObjectValue
  if(d.decision_version!==DECISION_VERSION||!sha(d.decision_id)||!nonEmpty(d.task_id)||!positive(d.assignment_revision)||!canonical(d.input_event_url)||!sha(d.input_event_digest)||!nullable(canonical,d.predecessor_decision_url_or_null)||!sha(d.authority_snapshot_digest)||!branchReasons[String(d.branch)].includes(String(d.reason_code))||!sha(d.idempotency_key)||!oneOf(['not_required','required_before_transition','required_after_transition'] as const,d.gsp_hook)||!nonEmpty(d.next_owner_role_id)||!utc(d.evaluated_at)||d.decision_id!==digestContinuousOrchestrationJsonV1(semanticDecision(v as ContinuationDecisionV1)))return ':invalid_cross_input_binding'
  if('route_binding'in d){p=routeProblem(d.route_binding,'/route_binding');if(p)return p}
  switch(d.branch){
    case'dispatch_role':if(!canonical(d.predecessor_canonical_url)||!nullable(gitSha,d.target_head_sha_or_null))return ':invalid_type_or_format';break
    case'request_independent_review':if(!sha(d.review_scope_digest)||!nullable(gitSha,d.reviewed_head_sha_or_null))return ':invalid_type_or_format';break
    case'request_metadata_sync':if(!pr(d.pr_url)||!gitSha(d.head_sha)||!setOf(d.projection_field_ids,z=>oneOf(gspFields,z))||!setOf(d.citation_record_urls,canonical)||!nullable(sha,d.expected_projection_digest_or_null)||d.must_verify_after_write!==true)return ':invalid_type_or_format';break
    case'await_external_recovery':if(d.controller_condition!=='external_blocker'||d.terminal_stop_reason!=='external_blocker'||!oneOf(['blocked','failed'] as const,d.result_handoff_status)||!nonEmpty(d.recovery_role_id)||!oneOf(['external_recovery_observed','validation_completed','metadata_sync_completed','result_handoff_published'] as const,d.required_recovery_event_type)||!setOf(d.recovery_evidence_field_ids,z=>oneOf(identityFields,z))||d.automatic_resume!==true)return ':invalid_conditional_matrix';break
    case'request_product_owner_decision':if(!nonEmpty(d.decision_subject_id)||!sha(d.decision_scope_digest)||!setOf(d.required_authority_field_ids,z=>oneOf(identityFields,z))||!nullable(nonEmpty,d.requested_action_id_or_null))return ':invalid_type_or_format';break
    case'await_protected_action':if(!nonEmpty(d.protected_action_id)||!canonical(d.approval_record_url)||!gitSha(d.approved_head_sha)||!gitSha(d.approved_base_sha)||!oneOf(['open_draft','open_ready'] as const,d.approved_pr_state)||!nonEmpty(d.executor_role_id)||d.execution_authority!==false)return ':invalid_conditional_matrix';break
    case'invalidate_authority':if(!setOf(d.invalidated_record_urls,canonical)||!oneOf(['head_drift','base_drift','pr_state_drift','check_drift','finding_drift','gsp_drift','approval_expired','approval_consumed','approval_malformed','approval_scope_mismatch'] as const,d.invalidation_class)||!setOf(d.historical_evidence_record_urls,canonical)||!nonEmpty(d.earliest_gate_id)||d.controller_condition!=='authority_drift'||d.terminal_stop_reason!=='external_blocker'||d.result_handoff_status!=='blocked'||!nonEmpty(d.recovery_role_id)||!oneOf(['review_decision_published','validation_completed','product_owner_approval_published','metadata_sync_completed'] as const,d.required_recovery_event_type)||!setOf(d.recovery_evidence_field_ids,z=>oneOf(identityFields,z))||d.automatic_resume!==true)return ':invalid_conditional_matrix';break
    case'complete_task_candidate':p=routeProblem(d.assessor_route_binding,'/assessor_route_binding');if(p)return p;if(!setOf(d.completion_evidence_urls,canonical)||d.blocking_finding_count!==0||d.open_finding_count!==0||(d.assessor_route_binding as RouteBindingV1).transition_class!=='completion_assessment')return ':invalid_conditional_matrix';break
    case'stop':{
      if(!oneOf(['canonical_conflict','architecture_gap','ambiguous_role_ownership','external_blocker'] as const,d.controller_condition)||!oneOf(['architecture_gap','external_blocker'] as const,d.terminal_stop_reason)||!oneOf(['blocked','failed'] as const,d.result_handoff_status)||!nonEmpty(d.recovery_role_id)||!oneOf(['architecture_amendment_published','review_decision_published','product_owner_approval_published','authority_snapshot_changed','external_recovery_observed'] as const,d.required_recovery_event_type)||!setOf(d.recovery_evidence_field_ids,z=>oneOf(identityFields,z))||d.automatic_resume!==false)return ':invalid_conditional_matrix'
      const comboOk=(d.reason_code==='canonical_conflict'&&d.controller_condition==='canonical_conflict'&&d.terminal_stop_reason==='architecture_gap')||(d.reason_code==='architecture_gap'&&d.controller_condition==='architecture_gap'&&d.terminal_stop_reason==='architecture_gap')||(d.reason_code==='ambiguous_role_ownership'&&d.controller_condition==='ambiguous_role_ownership'&&d.terminal_stop_reason==='architecture_gap')||((d.reason_code==='repeated_finding_failure'||d.reason_code==='repeated_transition_cycle')&&d.controller_condition==='external_blocker'&&d.terminal_stop_reason==='external_blocker')
      if(!comboOk)return ':invalid_conditional_matrix';break
    }
    case'no_transition':if(!oneOf(eventTypes,d.required_future_event_type)||!nonEmpty(d.future_event_role_id))return ':invalid_type_or_format';break
  }
  return undefined
}
export const validateContinuationDecisionV1=(v:unknown):ClosedAdmissionResultV1<ContinuationDecisionV1>=>{try{const p=decisionProblem(v);return p?rejected(p):accepted(v as ContinuationDecisionV1)}catch{return failed('decision')}}
export const validateEventAdmissionResultV1=(v:unknown):ClosedAdmissionResultV1<EventAdmissionResultV1>=>{try{
  if(!object(v)||!oneOf(['new_decision','replay'] as const,v.branch))return rejected('/branch:invalid_enum')
  const keys=v.branch==='new_decision'?['result_version','branch','semantic_event_digest','committed_decision_id','committed_decision_url','committed_state_revision','state_changed']:['result_version','branch','semantic_event_digest','existing_decision_id','existing_decision_url','existing_state_revision','state_changed','transport_invoked','audit_head_changed','counter_changed']
  const p=exact(v,keys);if(p)return rejected(p)
  if(v.result_version!==ADMISSION_VERSION||!sha(v.semantic_event_digest))return rejected(':invalid_type_or_format')
  if(v.branch==='new_decision'&&(!sha(v.committed_decision_id)||!canonical(v.committed_decision_url)||!positive(v.committed_state_revision)||v.state_changed!==true))return rejected(':invalid_conditional_matrix')
  if(v.branch==='replay'&&(!sha(v.existing_decision_id)||!canonical(v.existing_decision_url)||!positive(v.existing_state_revision)||v.state_changed!==false||v.transport_invoked!==false||v.audit_head_changed!==false||v.counter_changed!==false))return rejected(':invalid_conditional_matrix')
  return accepted(v as unknown as EventAdmissionResultV1)
}catch{return failed('admission')}}

const makeDecision=(state:ContinuousOrchestrationStateV1,event:ContinuousOrchestrationEventV1,branch:string,reason:string,owner:string,at:string,gsp:string,specific:ObjectValue)=>{
  const semantic={decision_version:DECISION_VERSION,task_id:state.task_id,assignment_revision:state.assignment_revision,input_event_url:event.canonical_record_url,input_event_digest:event.semantic_event_digest,predecessor_decision_url_or_null:state.last_decision_url,authority_snapshot_digest:state.authority_snapshot.snapshot_digest,branch,reason_code:reason,gsp_hook:gsp,next_owner_role_id:owner,...specific}
  return frozen({...semantic,decision_id:digestContinuousOrchestrationJsonV1(semantic),idempotency_key:digestContinuousOrchestrationJsonV1({task_id:state.task_id,epoch:state.semantic_counter_epoch.epoch_id,event:event.semantic_event_digest,branch,owner,specific}),evaluated_at:at}) as ContinuationDecisionV1
}
const route=(p:GenericProgressRunnerProfilesV1,role:string,action:string)=>p.route_binding_table.bindings.filter(r=>r.role_id===role&&r.action_id===action)
const byClass=(p:GenericProgressRunnerProfilesV1,c:TransitionClassV1)=>p.route_binding_table.bindings.filter(r=>r.transition_class===c)
const authorityRole=(s:ContinuousOrchestrationStateV1,e:ContinuousOrchestrationEventV1,p:GenericProgressRunnerProfilesV1,recovery:string|null)=>{
  const b=p.route_binding_table.event_authority_bindings.find(x=>x.event_type===e.event_type);if(!b)return null
  if(b.authority_source==='active_route_binding')return s.active_role_binding?.role_id??null
  if(b.authority_source==='collector_profile')return p.authority_projection_profile.collector_role_id
  if(b.authority_source==='preceding_decision_recovery_role')return recovery
  if(b.authority_source==='protected_action_profile')return p.protected_action_profile.action_rows.find(x=>x.action_id===s.active_action_id)?.executor_role_id??null
  if(b.authority_source==='fixed_route_transition_class')return byClass(p,b.authority_selector.value as TransitionClassV1)[0]?.role_id??null
  return b.authority_selector.value==='requested_by_role_id'?p.authority_projection_profile.requested_by_role_id:p.authority_projection_profile.assignment_owner_role_id
}
export interface ContinuousOrchestrationReductionV1 {
  readonly admission:EventAdmissionResultV1|null
  readonly decision:ContinuationDecisionV1|null
  readonly state:ContinuousOrchestrationStateV1
  readonly cas_projection:CasProjectionV1|null
  readonly terminal_no_mutation:boolean
}
export type ActiveActionAdmissionResultV1 =
  | Readonly<{branch:'accepted';guard:Extract<ActiveActionProofGuardResultV1,{branch:'accepted'}>;reduction:ContinuousOrchestrationReductionV1}>
  | Readonly<{branch:'rejected';guard:Extract<ActiveActionProofGuardResultV1,{branch:'rejected'}>;reduction:null}>

const replayAdmission=(entry:ReplayLedgerEntryV1):EventAdmissionResultV1=>frozen({
  result_version:ADMISSION_VERSION,branch:'replay',semantic_event_digest:entry.semantic_event_digest,
  existing_decision_id:entry.decision_id,existing_decision_url:entry.decision_url,
  existing_state_revision:entry.committed_state_revision,state_changed:false,transport_invoked:false,
  audit_head_changed:false,counter_changed:false,
})
const cycleSignatureFor=(s:ContinuousOrchestrationStateV1,d:ContinuationDecisionV1)=>digestContinuousOrchestrationJsonV1({
  task_id:s.task_id,semantic_counter_epoch_id:s.semantic_counter_epoch.epoch_id,phase:s.phase,
  active_gate:s.active_gate,max_gate_ordinal_reached:s.loop_counters.cycle_ledger.max_gate_ordinal_reached,
  branch:d.branch,reason_code:d.reason_code,next_owner_role_id:d.next_owner_role_id,
  active_transition_class:s.active_role_binding?.transition_class??null,
  active_action_id:s.active_action_id,
  open_finding_keys:s.finding_ledger.filter(x=>x.state==='open'||x.state==='reopened').map(x=>x.counter_key).sort(compare),
  approval_class:`${s.approval_state.state}:${s.approval_state.reason}`,
  projection_class:s.projection_state.state,
  protected_action_consumption:s.authority_snapshot.approval_consumption_digest_or_null,
})
const explicitProgress=(s:ContinuousOrchestrationStateV1,e:ContinuousOrchestrationEventV1,d:ContinuationDecisionV1,gateOrdinal:number)=>{
  if(gateOrdinal>s.loop_counters.cycle_ledger.max_gate_ordinal_reached)return true
  if(e.event_type==='protected_action_completed')return true
  if(e.event_type==='review_decision_published'&&s.finding_ledger.some(x=>x.state==='closed'&&x.latest_decision_url===e.canonical_record_url))return true
  if(e.event_type==='result_handoff_published'&&s.active_role_binding?.transition_class==='post_merge_binding')return true
  if(e.event_type==='validation_completed'&&s.active_role_binding?.transition_class==='operational_validation')return true
  return d.branch==='complete_task_candidate'
}
function reduceCoreContinuousOrchestrationV1(
  stateValue:unknown,eventValue:unknown,profileValue:unknown,evaluation:ProgressionEvaluatorResultV1,
  decisionUrl:string,evaluatedAt:string,recoveryRole:string|null,
  activeReplayBinding:ActiveActionReplayBindingV1|null,
):ContinuousOrchestrationReductionV1{
  const pa=validateGenericProgressRunnerProfilesV1(profileValue),ea=validateContinuousOrchestrationEventV1(eventValue),va=validateProgressionEvaluatorResultV1(evaluation);if(pa.kind!=='accepted'||ea.kind!=='accepted'||va.kind!=='accepted')throw new TypeError('closed admission failed')
  const sa=validateContinuousOrchestrationStateV1(stateValue,pa.value);if(sa.kind!=='accepted'||!canonical(decisionUrl)||!utc(evaluatedAt))throw new TypeError('closed admission failed')
  const s=sa.value,e=ea.value;evaluation=va.value;const replay=s.replay_ledger.entries.find(x=>x.semantic_event_digest===e.semantic_event_digest)
  if(replay)return frozen({admission:replayAdmission(replay),decision:null,state:s,cas_projection:null,terminal_no_mutation:false})
  if(s.loop_counters.cycle_ledger.decision_count_without_progress>=64&&e.event_type!=='external_recovery_observed')return frozen({admission:null,decision:null,state:s,cas_projection:null,terminal_no_mutation:true})
  const stop=(reason:string,condition:string,owner:string)=>makeDecision(s,e,'stop',reason,owner,evaluatedAt,'required_after_transition',{controller_condition:condition,terminal_stop_reason:condition==='external_blocker'?'external_blocker':'architecture_gap',result_handoff_status:'blocked',recovery_role_id:owner,required_recovery_event_type:condition==='architecture_gap'?'architecture_amendment_published':'external_recovery_observed',recovery_evidence_field_ids:['canonical_record_url'],automatic_resume:false})
  let d:ContinuationDecisionV1
  const eventAuthority=pa.value.route_binding_table.event_authority_bindings.find(x=>x.event_type===e.event_type)
  if(e.task_id!==s.task_id||e.assignment_revision!==s.assignment_revision||e.authority_snapshot_digest!==s.authority_snapshot.snapshot_digest||eventAuthority?.head_binding==='required'&&e.subject_head_sha_or_null===null)d=stop('canonical_conflict','canonical_conflict',pa.value.authority_projection_profile.collector_role_id)
  else if(authorityRole(s,e,pa.value,recoveryRole)!==e.authoring_role)d=stop('ambiguous_role_ownership','ambiguous_role_ownership',pa.value.authority_projection_profile.collector_role_id)
  else if(s.phase==='completed'||s.phase==='stopped'&&e.event_type!=='external_recovery_observed')d=makeDecision(s,e,'no_transition','no_declared_transition',e.authoring_role,evaluatedAt,'not_required',{required_future_event_type:s.phase==='completed'?'task_opted_in':'external_recovery_observed',future_event_role_id:e.authoring_role})
  else if(evaluation.kind==='recommend_next_role'){const rows=route(pa.value,evaluation.target_role_id,evaluation.next_action_id),repairExhausted=rows.length===1&&['architecture_repair','implementation'].includes(rows[0].transition_class)&&s.finding_ledger.some(x=>(x.state==='open'||x.state==='reopened')&&x.correction_role_id===rows[0].role_id&&x.attempt_count>=3);if(rows.length!==1)d=stop('ambiguous_role_ownership','ambiguous_role_ownership',pa.value.authority_projection_profile.collector_role_id);else if(!s.allowed_transition_classes.includes(rows[0].transition_class))d=stop('architecture_gap','architecture_gap',pa.value.authority_projection_profile.collector_role_id);else if(repairExhausted)d=stop('repeated_finding_failure','external_blocker',rows[0].role_id);else if(['architecture_review','implementation_review','publication_review','completion_assessment'].includes(rows[0].transition_class))d=makeDecision(s,e,'request_independent_review','independent_review_required',rows[0].role_id,evaluatedAt,'required_before_transition',{route_binding:rows[0],review_scope_digest:rows[0].allowed_scope_digest,reviewed_head_sha_or_null:evaluation.target_head_sha_or_null});else d=makeDecision(s,e,'dispatch_role','declared_next_role',rows[0].role_id,evaluatedAt,'required_before_transition',{route_binding:rows[0],predecessor_canonical_url:evaluation.predecessor_canonical_url,target_head_sha_or_null:evaluation.target_head_sha_or_null})}
  else if(evaluation.kind==='require_gate_status_update'){const rows=byClass(pa.value,'metadata_sync'),x=s.projection_state,m=s.loop_counters.metadata_counters.find(c=>c.pr_url===x.pr_url_or_null&&c.head_sha===x.projected_head_sha_or_null&&canonicalizeContinuousOrchestrationJsonV1(c.projection_field_ids)===canonicalizeContinuousOrchestrationJsonV1(x.mismatch_field_ids));if(rows.length!==1||x.pr_url_or_null===null||x.projected_head_sha_or_null===null)d=stop('ambiguous_role_ownership','ambiguous_role_ownership',pa.value.authority_projection_profile.collector_role_id);else if(m&&m.write_attempt_count>=3)d=stop('repeated_finding_failure','external_blocker',rows[0].role_id);else d=makeDecision(s,e,'request_metadata_sync','metadata_projection_mismatch',rows[0].role_id,evaluatedAt,'required_before_transition',{route_binding:rows[0],pr_url:x.pr_url_or_null,head_sha:x.projected_head_sha_or_null,projection_field_ids:x.mismatch_field_ids,citation_record_urls:x.citation_record_urls,expected_projection_digest_or_null:x.gsp_gate_rows_digest_or_null,must_verify_after_write:true})}
  else if(evaluation.kind==='wait_for_protected_action'){const row=pa.value.protected_action_profile.action_rows.find(x=>x.action_id===evaluation.protected_action_id),a=s.approval_state;if(!row)d=stop('architecture_gap','architecture_gap',pa.value.authority_projection_profile.collector_role_id);else if(a.state==='none'){const owner=byClass(pa.value,'product_owner_request')[0]?.role_id??pa.value.authority_projection_profile.collector_role_id;d=makeDecision(s,e,'request_product_owner_decision','product_decision_required',owner,evaluatedAt,'required_before_transition',{decision_subject_id:evaluation.protected_action_id,decision_scope_digest:digestContinuousOrchestrationJsonV1({action:evaluation.protected_action_id,head:s.authority_snapshot.pr_head_sha_or_null}),required_authority_field_ids:['approval_state','approved_action_id','approved_base_sha','approved_head_sha'],requested_action_id_or_null:evaluation.protected_action_id})}else if(a.state==='current'&&a.approval_record_url_or_null&&s.authority_snapshot.pr_head_sha_or_null&&s.authority_snapshot.pr_base_sha_or_null)d=makeDecision(s,e,'await_protected_action','protected_action_completion_required',row.executor_role_id,evaluatedAt,'required_after_transition',{protected_action_id:row.action_id,approval_record_url:a.approval_record_url_or_null,approved_head_sha:s.authority_snapshot.pr_head_sha_or_null,approved_base_sha:s.authority_snapshot.pr_base_sha_or_null,approved_pr_state:s.authority_snapshot.pr_state==='open_ready'?'open_ready':'open_draft',executor_role_id:row.executor_role_id,execution_authority:false});else if(a.state==='not_evaluable')d=makeDecision(s,e,'await_external_recovery','external_recovery_required',pa.value.authority_projection_profile.collector_role_id,evaluatedAt,'not_required',{controller_condition:'external_blocker',terminal_stop_reason:'external_blocker',result_handoff_status:'blocked',recovery_role_id:pa.value.authority_projection_profile.collector_role_id,required_recovery_event_type:'external_recovery_observed',recovery_evidence_field_ids:['approval_state'],automatic_resume:true});else{const invalidationClass=({expired:'approval_expired',consumed:'approval_consumed',malformed:'approval_malformed',scope_mismatch:'approval_scope_mismatch'} as Record<string,string>)[a.reason]??a.reason;d=makeDecision(s,e,'invalidate_authority','authority_drift',pa.value.authority_projection_profile.collector_role_id,evaluatedAt,'required_after_transition',{invalidated_record_urls:a.approval_record_url_or_null?[a.approval_record_url_or_null]:[],invalidation_class:invalidationClass,historical_evidence_record_urls:a.approval_record_url_or_null?[a.approval_record_url_or_null]:[],earliest_gate_id:s.active_gate??'authority',controller_condition:'authority_drift',terminal_stop_reason:'external_blocker',result_handoff_status:'blocked',recovery_role_id:pa.value.authority_projection_profile.collector_role_id,required_recovery_event_type:'product_owner_approval_published',recovery_evidence_field_ids:['approval_state'],automatic_resume:true})}}
  else if(evaluation.kind==='invalidate_approval'){const invalidationClass=({expired:'approval_expired',consumed:'approval_consumed',malformed:'approval_malformed',scope_mismatch:'approval_scope_mismatch'} as Record<string,string>)[evaluation.invalidation_class]??evaluation.invalidation_class;d=makeDecision(s,e,'invalidate_authority','authority_drift',pa.value.authority_projection_profile.collector_role_id,evaluatedAt,'required_after_transition',{invalidated_record_urls:s.approval_state.approval_record_url_or_null?[s.approval_state.approval_record_url_or_null]:[],invalidation_class:invalidationClass,historical_evidence_record_urls:[],earliest_gate_id:s.active_gate??'authority',controller_condition:'authority_drift',terminal_stop_reason:'external_blocker',result_handoff_status:'blocked',recovery_role_id:pa.value.authority_projection_profile.collector_role_id,required_recovery_event_type:'review_decision_published',recovery_evidence_field_ids:['reviewed_head_sha'],automatic_resume:true})}
  else if(evaluation.kind==='stop'){if(evaluation.stop_condition==='external_blocker')d=makeDecision(s,e,'await_external_recovery','external_recovery_required',evaluation.recovery_role_id,evaluatedAt,'not_required',{controller_condition:'external_blocker',terminal_stop_reason:'external_blocker',result_handoff_status:'blocked',recovery_role_id:evaluation.recovery_role_id,required_recovery_event_type:'external_recovery_observed',recovery_evidence_field_ids:['canonical_record_url'],automatic_resume:true});else if(evaluation.stop_condition==='blocking_finding')d=s.finding_ledger.some(x=>(x.state==='open'||x.state==='reopened')&&x.attempt_count>=3)?stop('repeated_finding_failure','external_blocker',evaluation.recovery_role_id):stop('architecture_gap','architecture_gap',evaluation.recovery_role_id);else d=stop(evaluation.stop_condition,evaluation.stop_condition,evaluation.recovery_role_id)}
  else if(evaluation.kind==='complete_task_candidate'){const rows=byClass(pa.value,'completion_assessment');d=rows.length===1&&!s.finding_ledger.some(x=>x.state==='open'||x.state==='reopened')?makeDecision(s,e,'complete_task_candidate','completion_evidence_ready',rows[0].role_id,evaluatedAt,'required_before_transition',{completion_evidence_urls:evaluation.completion_evidence_urls,blocking_finding_count:0,open_finding_count:0,assessor_route_binding:rows[0]}):stop('ambiguous_role_ownership','ambiguous_role_ownership',pa.value.authority_projection_profile.collector_role_id)}
  else d=makeDecision(s,e,'no_transition','no_declared_transition',evaluation.future_event_role_id,evaluatedAt,'not_required',{required_future_event_type:evaluation.future_event_type,future_event_role_id:evaluation.future_event_role_id})
  const gateOrdinal=pa.value.gate_profile.gate_rows.find(x=>x.gate_id===s.active_gate)?.ordinal??0
  const progress=explicitProgress(s,e,d,gateOrdinal)
  const prospectiveCount=progress?0:Math.min(64,s.loop_counters.cycle_ledger.decision_count_without_progress+1)
  const cycleSignature=cycleSignatureFor(s,d)
  const priorSignature=s.loop_counters.cycle_ledger.signature_occurrences.find(x=>x.cycle_signature===cycleSignature)
  const repeatedCycle=!progress&&((priorSignature?.occurrence_count??0)>=2||prospectiveCount>=64)
  if(repeatedCycle)d=makeDecision(s,e,'stop','repeated_transition_cycle',pa.value.authority_projection_profile.collector_role_id,evaluatedAt,'required_after_transition',{controller_condition:'external_blocker',terminal_stop_reason:'external_blocker',result_handoff_status:'blocked',recovery_role_id:pa.value.authority_projection_profile.collector_role_id,required_recovery_event_type:'external_recovery_observed',recovery_evidence_field_ids:['canonical_record_url'],automatic_resume:false})
  if(activeReplayBinding!==null){
    const semantic=semanticDecision(d)
    d=frozen({...d,decision_id:digestContinuousOrchestrationJsonV1(semantic),idempotency_key:activeReplayBinding.binding_idempotency_key}) as ContinuationDecisionV1
  }
  const eventValidationDiscriminant=activeReplayBinding?.event_validation_discriminant??discriminantFor(e.event_type,null)
  const revision=s.state_revision+1,entry:ReplayLedgerEntryV1={task_id:s.task_id,semantic_counter_epoch_id:s.semantic_counter_epoch.epoch_id,semantic_event_digest:e.semantic_event_digest,decision_id:d.decision_id,decision_url:decisionUrl,idempotency_key:d.idempotency_key,committed_state_revision:revision,event_validation_discriminant:eventValidationDiscriminant,event_validation_discriminant_digest:digestContinuousOrchestrationJsonV1(eventValidationDiscriminant),active_action_replay_binding_or_null:activeReplayBinding,active_action_provenance_record_url_or_null:activeReplayBinding?.provenance_record_url??null,active_action_provenance_digest_or_null:activeReplayBinding?.provenance_digest??null},entries=[...s.replay_ledger.entries,entry],r=('route_binding'in d?d.route_binding:null) as RouteBindingV1|null
  const phase:PhaseV1=d.branch==='request_independent_review'?'awaiting_independent_review':d.branch==='request_metadata_sync'?'awaiting_metadata_sync':d.branch==='await_external_recovery'?'awaiting_external_recovery':d.branch==='request_product_owner_decision'?'awaiting_product_owner':d.branch==='await_protected_action'?'awaiting_protected_action':d.branch==='complete_task_candidate'?'completion_assessment':d.branch==='stop'?'stopped':'awaiting_role_result'
  const findingCounters=s.loop_counters.finding_counters.map(x=>({...x}))
  if(d.branch==='dispatch_role'&&['architecture_repair','implementation'].includes(d.route_binding.transition_class)){for(const f of findingCounters){if((f.state==='open'||f.state==='reopened')&&f.correction_role_id===d.route_binding.role_id&&f.attempt_count<3)f.attempt_count+=1}}
  const metadataCounters=s.loop_counters.metadata_counters.map(x=>({...x,projection_field_ids:[...x.projection_field_ids],subsequent_review_urls:[...x.subsequent_review_urls]}))
  if(d.branch==='request_metadata_sync'){const semanticDefectDigest=digestContinuousOrchestrationJsonV1({pr_url:d.pr_url,head_sha:d.head_sha,projection_field_ids:d.projection_field_ids}),counterKey=digestContinuousOrchestrationJsonV1({task_id:s.task_id,semantic_counter_epoch_id:s.semantic_counter_epoch.epoch_id,semantic_defect_digest:semanticDefectDigest});const current=metadataCounters.find(x=>x.counter_key===counterKey);if(current)current.write_attempt_count=Math.min(3,current.write_attempt_count+1);else metadataCounters.push({counter_key:counterKey,pr_url:d.pr_url,head_sha:d.head_sha,projection_field_ids:[...d.projection_field_ids],semantic_defect_digest:semanticDefectDigest,originating_review_url:e.canonical_record_url,subsequent_review_urls:[],write_attempt_count:1,state:'open'})}
  const deliveryCounters=s.loop_counters.delivery_counters.map(x=>({...x}))
  if(r&&!repeatedCycle){const current=deliveryCounters.find(x=>x.idempotency_key===d.idempotency_key);if(current)current.delivery_count=Math.min(3,current.delivery_count+1);else deliveryCounters.push({idempotency_key:d.idempotency_key,delivery_count:1,last_completion_url_or_null:null,state:'pending'})}
  const occurrenceCount=Math.min(3,(priorSignature?.occurrence_count??0)+1)
  const signatureOccurrences=s.loop_counters.cycle_ledger.signature_occurrences.filter(x=>x.cycle_signature!==cycleSignature).map(x=>({...x}))
  signatureOccurrences.push({cycle_signature:cycleSignature,occurrence_count:occurrenceCount,first_decision_url:priorSignature?.first_decision_url??decisionUrl,last_decision_url:decisionUrl})
  signatureOccurrences.sort((a,b)=>compare(a.cycle_signature,b.cycle_signature))
  const cycleLedger:CycleLedgerV1={cycle_ledger_version:'cycle_ledger_v1',semantic_counter_epoch_id:s.semantic_counter_epoch.epoch_id,progress_epoch:s.loop_counters.cycle_ledger.progress_epoch+(progress?1:0),max_gate_ordinal_reached:Math.max(s.loop_counters.cycle_ledger.max_gate_ordinal_reached,gateOrdinal),decision_count_without_progress:prospectiveCount,checkpoint_emitted_without_progress:progress?false:s.loop_counters.cycle_ledger.checkpoint_emitted_without_progress||prospectiveCount>=32,signature_occurrences:signatureOccurrences,last_progress_record_url:progress?e.canonical_record_url:s.loop_counters.cycle_ledger.last_progress_record_url}
  const pendingTransport=r&&!repeatedCycle?{intent_version:'pending_transport_intent_v1' as const,idempotency_key:d.idempotency_key,decision_url:decisionUrl,route_binding:r,scope_digest:r.allowed_scope_digest,created_from_state_revision:revision,delivery_state:'prepared' as const,completion_record_url_or_null:null}:null
  const next=frozen({...s,state_revision:revision,phase,active_role_binding:r??s.active_role_binding,active_action_id:r?.action_id??s.active_action_id,finding_ledger:findingCounters,loop_counters:{finding_counters:findingCounters,metadata_counters:metadataCounters,delivery_counters:deliveryCounters,cycle_ledger:cycleLedger},event_cursor:{cursor_version:'event_cursor_v1',last_event_id_or_null:e.event_id,last_semantic_event_digest_or_null:e.semantic_event_digest,last_event_record_url_or_null:e.canonical_record_url,last_decision_url_or_null:decisionUrl,admitted_new_event_count:s.event_cursor.admitted_new_event_count+1},replay_ledger:{ledger_version:'replay_ledger_v1',entries,ledger_digest:digestContinuousOrchestrationJsonV1({ledger_version:'replay_ledger_v1',entries})},audit_chain:{audit_version:'audit_chain_ref_v1',head_decision_url_or_null:decisionUrl,head_decision_id_or_null:d.decision_id,decision_count_total:s.audit_chain.decision_count_total+1,chain_digest:digestContinuousOrchestrationJsonV1({previous:s.audit_chain.chain_digest,decision_id:d.decision_id,decision_url:decisionUrl})},pending_transport:pendingTransport,last_decision_url:decisionUrl}) as ContinuousOrchestrationStateV1
  if(validateContinuationDecisionV1(d).kind!=='accepted'||validateContinuousOrchestrationStateV1(next,pa.value).kind!=='accepted')throw new TypeError('generated contract invalid')
  const admission:EventAdmissionResultV1={result_version:ADMISSION_VERSION,branch:'new_decision',semantic_event_digest:e.semantic_event_digest,committed_decision_id:d.decision_id,committed_decision_url:decisionUrl,committed_state_revision:revision,state_changed:true}
  const candidateDigest=digestContinuousOrchestrationJsonV1({admission,decision:d,state:next})
  return frozen({admission,decision:d,state:next,cas_projection:{cas_version:'continuous_orchestration_cas_projection_v1',expected_state_revision:s.state_revision,expected_state_digest:digestContinuousOrchestrationJsonV1(s),next_state_revision:revision,candidate_digest:candidateDigest},terminal_no_mutation:false})
}

export function reduceContinuousOrchestrationV1(stateValue:unknown,eventValue:unknown,profileValue:unknown,evaluation:ProgressionEvaluatorResultV1,decisionUrl:string,evaluatedAt:string,recoveryRole:string|null=null):ContinuousOrchestrationReductionV1{
  const ea=validateContinuousOrchestrationEventV1(eventValue)
  if(ea.kind==='accepted'&&ea.value.event_type==='validation_completed')throw new TypeError('active action admission proof required')
  return reduceCoreContinuousOrchestrationV1(stateValue,eventValue,profileValue,evaluation,decisionUrl,evaluatedAt,recoveryRole,null)
}

const rejectedGuard=(eventDigest:Sha256|null,code:Extract<ActiveActionProofGuardResultV1,{branch:'rejected'}>['rejection_code'],replayLookup:boolean):Extract<ActiveActionProofGuardResultV1,{branch:'rejected'}>=>frozen({
  guard_result_version:'active_action_proof_guard_result_v1',branch:'rejected',event_digest_or_null:eventDigest,rejection_code:code,
  controller_condition:code==='stale_action'||code==='stale_provenance'||code==='assignment_authority_mismatch'?'authority_drift':code==='cas_mismatch'?'external_blocker':'canonical_conflict',
  terminal_stop_reason:code==='cas_mismatch'||code==='stale_action'||code==='stale_provenance'?'external_blocker':'architecture_gap',result_handoff_status:'blocked',
  fresh_evaluation_required:code==='stale_action'||code==='stale_provenance'||code==='assignment_authority_mismatch'||code==='cas_mismatch',
  replay_lookup_performed:replayLookup,state_changed:false,transport_invoked:false,audit_head_changed:false,counter_changed:false,
})
const bindingFrom=(s:ContinuousOrchestrationStateV1,p:ActiveActionAdmissionProofV1,c:ActiveActionCasOperandV1,provenance:ActiveActionProvenanceRecordV1):ActiveActionReplayBindingV1=>{
  const a=p.assignment_authority,r=a.route_binding
  const eventValidationDiscriminant=discriminantFor('validation_completed',a.transition_class)
  const semantic={
    replay_binding_version:'active_action_replay_binding_v1' as const,task_id:s.task_id,semantic_counter_epoch_id:s.semantic_counter_epoch.epoch_id,
    event_digest:p.event_digest,proof_digest:p.proof_digest,cas_operand_digest:c.cas_operand_digest,
    binding_idempotency_key:digestContinuousOrchestrationJsonV1({event_digest:p.event_digest,proof_digest:p.proof_digest,cas_operand_digest:c.cas_operand_digest}),
    active_action_id:p.active_action_id,assignment_record_url:a.assignment_record_url,assignment_revision:a.assignment_revision,
    route_binding_table_profile_id:a.route_binding_table_profile_id,route_binding_table_digest:a.route_binding_table_digest,
    transition_class:a.transition_class,route_role_id:r.role_id,route_action_id:r.action_id,route_authority_record_url:r.authority_record_url,
    route_allowed_scope_digest:r.allowed_scope_digest,expected_state_revision:p.expected_state.expected_state_revision,
    expected_state_digest:p.expected_state.expected_state_digest,expected_authority_snapshot_digest:p.expected_state.authority_snapshot_digest,
    expected_active_transition_class:p.expected_state.active_transition_class,expected_active_role_id:p.expected_state.active_role_id,
    expected_active_action_id:p.expected_state.active_action_id,expected_active_route_binding_digest:p.expected_state.active_route_binding_digest,
    provenance_record_url:provenance.canonical_record_url,provenance_digest:provenance.provenance_digest,
    event_validation_discriminant:eventValidationDiscriminant,
    event_validation_discriminant_digest:digestContinuousOrchestrationJsonV1(eventValidationDiscriminant),
  }
  return frozen({...semantic,replay_binding_digest:digestContinuousOrchestrationJsonV1(semantic)})
}
const guardAccepted=(b:ActiveActionReplayBindingV1):Extract<ActiveActionProofGuardResultV1,{branch:'accepted'}>=>frozen({
  guard_result_version:'active_action_proof_guard_result_v1',branch:'accepted',event_digest:b.event_digest,proof_digest:b.proof_digest,
  cas_operand_digest:b.cas_operand_digest,binding_idempotency_key:b.binding_idempotency_key,replay_lookup_allowed:true,state_changed:false,transport_invoked:false,
})
export function admitActiveActionEventV1(
  stateValue:unknown,profileValue:unknown,envelopeValue:unknown,observationValue:unknown,evaluation:ProgressionEvaluatorResultV1,
  decisionUrl:string,evaluatedAt:string,recoveryRole:string|null=null,...forbiddenProvenanceArguments:unknown[]
):ActiveActionAdmissionResultV1{
  if(!object(envelopeValue))return frozen({branch:'rejected',guard:rejectedGuard(null,'malformed_proof',false),reduction:null})
  const env=envelopeValue as ObjectValue,event=env.event
  const ea=validateContinuousOrchestrationEventV1(event)
  if(ea.kind!=='accepted')return frozen({branch:'rejected',guard:rejectedGuard(null,'malformed_proof',false),reduction:null})
  const e=ea.value
  if(forbiddenProvenanceArguments.length!==0)return frozen({branch:'rejected',guard:rejectedGuard(e.semantic_event_digest,'provenance_injection',false),reduction:null})
  if(env.envelope_version!=='active_action_admission_envelope_v1'||Object.keys(env).sort().join('|')!=='active_action_cas_operand_or_null|active_action_proof_or_null|envelope_version|event')return frozen({branch:'rejected',guard:rejectedGuard(e.semantic_event_digest,'malformed_proof',false),reduction:null})
  const rawEntries=object(stateValue)&&object(stateValue.replay_ledger)&&Array.isArray(stateValue.replay_ledger.entries)?stateValue.replay_ledger.entries:[]
  const rawPrior=rawEntries.find((entry)=>object(entry)&&entry.semantic_event_digest===e.semantic_event_digest) as ObjectValue|undefined
  const rawPriorExists=rawPrior!==undefined
  const rawDiscriminant=rawPrior&&object(rawPrior.event_validation_discriminant)?rawPrior.event_validation_discriminant:undefined
  if(e.event_type!=='validation_completed'){
    if(observationValue!==null)return frozen({branch:'rejected',guard:rejectedGuard(e.semantic_event_digest,'provenance_injection',rawPriorExists),reduction:null})
    if(env.active_action_proof_or_null!==null||env.active_action_cas_operand_or_null!==null)return frozen({branch:'rejected',guard:rejectedGuard(e.semantic_event_digest,'provenance_injection',rawPriorExists),reduction:null})
    if(rawPrior&&(rawPrior.active_action_replay_binding_or_null!==null||rawPrior.active_action_provenance_record_url_or_null!==null||rawPrior.active_action_provenance_digest_or_null!==null))return frozen({branch:'rejected',guard:rejectedGuard(e.semantic_event_digest,'provenance_type_mismatch',true),reduction:null})
    if(rawPrior){
      if(rawDiscriminant&&(rawDiscriminant.source_event_type!==e.event_type||rawDiscriminant.validation_class_or_null!==null))return frozen({branch:'rejected',guard:rejectedGuard(e.semantic_event_digest,'provenance_type_mismatch',true),reduction:null})
      if(!rawDiscriminant||replayDiscriminantProblem(rawDiscriminant,'')!==undefined||!sha(rawPrior.event_validation_discriminant_digest)||digestContinuousOrchestrationJsonV1(rawDiscriminant)!==rawPrior.event_validation_discriminant_digest)return frozen({branch:'rejected',guard:rejectedGuard(e.semantic_event_digest,'stale_provenance',true),reduction:null})
    }
  }else if(rawPrior){
    if(!rawDiscriminant||replayDiscriminantProblem(rawDiscriminant,'')!==undefined||!sha(rawPrior.event_validation_discriminant_digest)||digestContinuousOrchestrationJsonV1(rawDiscriminant)!==rawPrior.event_validation_discriminant_digest)return frozen({branch:'rejected',guard:rejectedGuard(e.semantic_event_digest,'stale_provenance',true),reduction:null})
    if(rawDiscriminant.source_event_type!=='validation_completed')return frozen({branch:'rejected',guard:rejectedGuard(e.semantic_event_digest,'provenance_type_mismatch',true),reduction:null})
    if(object(rawPrior.active_action_replay_binding_or_null)){
      const rawBinding=rawPrior.active_action_replay_binding_or_null
      if(object(rawBinding.event_validation_discriminant)&&rawBinding.event_validation_discriminant.source_event_type!==rawDiscriminant.source_event_type)return frozen({branch:'rejected',guard:rejectedGuard(e.semantic_event_digest,'provenance_type_mismatch',true),reduction:null})
      if(rawDiscriminant.validation_class_or_null!==rawBinding.transition_class||object(rawBinding.event_validation_discriminant)&&rawBinding.event_validation_discriminant.validation_class_or_null!==rawDiscriminant.validation_class_or_null)return frozen({branch:'rejected',guard:rejectedGuard(e.semantic_event_digest,'provenance_class_mismatch',true),reduction:null})
    }
  }
  const pa=validateGenericProgressRunnerProfilesV1(profileValue),sa=pa.kind==='accepted'?validateContinuousOrchestrationStateV1(stateValue,pa.value):pa
  if(pa.kind!=='accepted'||sa.kind!=='accepted')return frozen({branch:'rejected',guard:rejectedGuard(e.semantic_event_digest,'malformed_proof',rawPriorExists),reduction:null})
  const s=sa.value
  const prior=s.replay_ledger.entries.find(x=>x.semantic_event_digest===e.semantic_event_digest)
  const provenanceFailure=(code:Extract<ActiveActionProofGuardResultV1,{branch:'rejected'}>['rejection_code'])=>frozen({branch:'rejected' as const,guard:rejectedGuard(e.semantic_event_digest,code,prior!==undefined),reduction:null})
  if(e.event_type!=='validation_completed'){
    try{
      const reduction=reduceCoreContinuousOrchestrationV1(s,e,pa.value,evaluation,decisionUrl,evaluatedAt,recoveryRole,null)
      return frozen({branch:'accepted',guard:null,reduction}) as unknown as ActiveActionAdmissionResultV1
    }catch{return provenanceFailure('malformed_proof')}
  }
  if(observationValue===null)return provenanceFailure(prior?'stale_provenance':'missing_provenance')
  const unwrapped=unwrapTrustedObservation(observationValue,s,pa.value)
  if(!unwrapped.ok)return provenanceFailure(unwrapped.code)
  const observation=unwrapped.payload,expectedRecordUrl=prior?.active_action_provenance_record_url_or_null??e.canonical_record_url
  if(observation.record_url!==expectedRecordUrl)return provenanceFailure('provenance_injection')
  if(observation.retrieval_state==='unavailable')return provenanceFailure(prior?'stale_provenance':'missing_provenance')
  const extracted=extractProvenance(observation.body_text,prior!==undefined)
  if(!extracted.ok)return provenanceFailure(extracted.code)
  const provenance=extracted.record
  if(provenance.source_event_type!=='validation_completed')return provenanceFailure('provenance_type_mismatch')
  if(provenance.canonical_record_url!==expectedRecordUrl)return provenanceFailure('provenance_event_mismatch')
  if(prior&&provenance.provenance_digest!==prior.active_action_provenance_digest_or_null)return provenanceFailure('stale_provenance')
  if(provenance.task_id!==e.task_id||provenance.source_event_digest!==e.semantic_event_digest)return provenanceFailure('provenance_event_mismatch')
  if(provenance.authoring_role_id!==e.authoring_role||provenance.authoring_role_id!==provenance.assignment_authority.route_role_id)return provenanceFailure('provenance_assignment_mismatch')
  const actionMissing=(proof:unknown,cas:unknown)=>!object(proof)||!nonEmpty(proof.active_action_id)||!object(proof.assignment_authority)||!object(proof.assignment_authority.route_binding)||!nonEmpty(proof.assignment_authority.route_binding.action_id)||!object(proof.expected_state)||!nonEmpty(proof.expected_state.active_action_id)||!object(cas)||!nonEmpty(cas.expected_active_action_id)
  if(prior){
    const b=prior.active_action_replay_binding_or_null
    if(b===null||prior.active_action_provenance_record_url_or_null===null||prior.active_action_provenance_digest_or_null===null||replayBindingProblem(b,'')!==undefined)return frozen({branch:'rejected',guard:rejectedGuard(e.semantic_event_digest,'malformed_proof',true),reduction:null})
    if(provenance.validation_class!==b.transition_class)return provenanceFailure('provenance_class_mismatch')
    if(provenance.active_action_id!==b.active_action_id)return provenanceFailure('provenance_action_mismatch')
    const pauth=provenance.assignment_authority
    if(pauth.assignment_record_url!==b.assignment_record_url||pauth.assignment_revision!==b.assignment_revision||pauth.route_binding_table_profile_id!==b.route_binding_table_profile_id||pauth.route_binding_table_digest!==b.route_binding_table_digest||pauth.transition_class!==b.transition_class||pauth.route_role_id!==b.route_role_id||pauth.route_action_id!==b.route_action_id||pauth.route_authority_record_url!==b.route_authority_record_url||pauth.route_allowed_scope_digest!==b.route_allowed_scope_digest)return provenanceFailure('provenance_assignment_mismatch')
    const proof=env.active_action_proof_or_null,cas=env.active_action_cas_operand_or_null
    if(proof===null&&cas===null)return frozen({branch:'accepted',guard:guardAccepted(b),reduction:frozen({admission:replayAdmission(prior),decision:null,state:s,cas_projection:null,terminal_no_mutation:false})})
    if(proof===null||cas===null)return frozen({branch:'rejected',guard:rejectedGuard(e.semantic_event_digest,'missing_action',true),reduction:null})
    if(actionMissing(proof,cas))return frozen({branch:'rejected',guard:rejectedGuard(e.semantic_event_digest,'missing_action',true),reduction:null})
    if(proofProblem(proof,'')!==undefined||casOperandProblem(cas,'')!==undefined)return frozen({branch:'rejected',guard:rejectedGuard(e.semantic_event_digest,'malformed_proof',true),reduction:null})
    const p=proof as ActiveActionAdmissionProofV1,c=cas as ActiveActionCasOperandV1
    const a=p.assignment_authority,r=a.route_binding
    if(p.active_action_id!==b.active_action_id||r.action_id!==b.route_action_id||p.expected_state.active_action_id!==b.expected_active_action_id||c.expected_active_action_id!==b.expected_active_action_id)return frozen({branch:'rejected',guard:rejectedGuard(e.semantic_event_digest,'action_mismatch',true),reduction:null})
    if(a.assignment_record_url!==b.assignment_record_url||a.assignment_revision!==b.assignment_revision||a.route_binding_table_profile_id!==b.route_binding_table_profile_id||a.route_binding_table_digest!==b.route_binding_table_digest||a.transition_class!==b.transition_class||r.role_id!==b.route_role_id||r.authority_record_url!==b.route_authority_record_url||r.allowed_scope_digest!==b.route_allowed_scope_digest)return frozen({branch:'rejected',guard:rejectedGuard(e.semantic_event_digest,'assignment_authority_mismatch',true),reduction:null})
    if(p.proof_digest!==b.proof_digest||c.cas_operand_digest!==b.cas_operand_digest)return frozen({branch:'rejected',guard:rejectedGuard(e.semantic_event_digest,'cas_mismatch',true),reduction:null})
    return frozen({branch:'accepted',guard:guardAccepted(b),reduction:frozen({admission:replayAdmission(prior),decision:null,state:s,cas_projection:null,terminal_no_mutation:false})})
  }
  const proof=env.active_action_proof_or_null,cas=env.active_action_cas_operand_or_null
  if(proof===null||cas===null)return frozen({branch:'rejected',guard:rejectedGuard(e.semantic_event_digest,'missing_action',true),reduction:null})
  if(actionMissing(proof,cas))return frozen({branch:'rejected',guard:rejectedGuard(e.semantic_event_digest,'missing_action',true),reduction:null})
  if(proofProblem(proof,'')!==undefined||casOperandProblem(cas,'')!==undefined)return frozen({branch:'rejected',guard:rejectedGuard(e.semantic_event_digest,'malformed_proof',true),reduction:null})
  const p=proof as ActiveActionAdmissionProofV1,c=cas as ActiveActionCasOperandV1
  if(provenance.validation_class!==p.assignment_authority.transition_class)return provenanceFailure('provenance_class_mismatch')
  if(provenance.active_action_id!==p.active_action_id)return provenanceFailure('provenance_action_mismatch')
  const pauth=provenance.assignment_authority,routeAuthority=p.assignment_authority.route_binding
  if(pauth.assignment_record_url!==p.assignment_authority.assignment_record_url||pauth.assignment_revision!==p.assignment_authority.assignment_revision||pauth.route_binding_table_profile_id!==p.assignment_authority.route_binding_table_profile_id||pauth.route_binding_table_digest!==p.assignment_authority.route_binding_table_digest||pauth.transition_class!==p.assignment_authority.transition_class||pauth.route_role_id!==routeAuthority.role_id||pauth.route_action_id!==routeAuthority.action_id||pauth.route_authority_record_url!==routeAuthority.authority_record_url||pauth.route_allowed_scope_digest!==routeAuthority.allowed_scope_digest)return provenanceFailure('provenance_assignment_mismatch')
  if(p.event_digest!==e.semantic_event_digest||p.task_id!==e.task_id||p.active_action_id!==p.assignment_authority.route_binding.action_id||p.active_action_id!==p.expected_state.active_action_id||c.expected_active_action_id!==p.active_action_id)return frozen({branch:'rejected',guard:rejectedGuard(e.semantic_event_digest,'action_mismatch',true),reduction:null})
  if(assignmentBindingProblem(p.assignment_authority,'',pa.value)!==undefined||p.assignment_authority.assignment_revision!==s.assignment_revision||p.assignment_authority.assignment_record_url!==s.semantic_counter_epoch.current_assignment_url)return frozen({branch:'rejected',guard:rejectedGuard(e.semantic_event_digest,'assignment_authority_mismatch',true),reduction:null})
  if(s.active_role_binding===null||s.active_action_id!==p.active_action_id||s.active_role_binding.transition_class!==p.assignment_authority.transition_class||digestContinuousOrchestrationJsonV1(s.active_role_binding)!==p.expected_state.active_route_binding_digest)return frozen({branch:'rejected',guard:rejectedGuard(e.semantic_event_digest,'stale_action',true),reduction:null})
  if(expectedStateProblem(p.expected_state,'',s)!==undefined||casOperandProblem(c,'',p,e)!==undefined)return frozen({branch:'rejected',guard:rejectedGuard(e.semantic_event_digest,'cas_mismatch',true),reduction:null})
  const binding=bindingFrom(s,p,c,provenance),reduction=reduceCoreContinuousOrchestrationV1(s,e,pa.value,evaluation,decisionUrl,evaluatedAt,recoveryRole,binding)
  return frozen({branch:'accepted',guard:guardAccepted(binding),reduction})
}
export function commitContinuousOrchestrationCasV1(reduction:ContinuousOrchestrationReductionV1,observedState:ContinuousOrchestrationStateV1):CasCommitResultV1{
  const c=reduction.cas_projection
  const mismatch=()=>frozen({cas_result_version:'continuous_orchestration_cas_result_v1' as const,branch:'cas_mismatch' as const,expected_state_revision:c?.expected_state_revision??observedState.state_revision,observed_state_revision:observedState.state_revision,state_changed:false as const,audit_head_changed:false as const,counter_changed:false as const,transport_invoked:false as const})
  if(c===null||exact(c,['cas_version','expected_state_revision','expected_state_digest','next_state_revision','candidate_digest'])!==undefined||c.cas_version!=='continuous_orchestration_cas_projection_v1'||!uint(c.expected_state_revision)||!sha(c.expected_state_digest)||c.next_state_revision!==c.expected_state_revision+1||!sha(c.candidate_digest))return mismatch()
  if(observedState.state_revision!==c.expected_state_revision||digestContinuousOrchestrationJsonV1(observedState)!==c.expected_state_digest)return mismatch()
  if(reduction.admission===null||reduction.admission.branch!=='new_decision'||reduction.decision===null||reduction.terminal_no_mutation||validateEventAdmissionResultV1(reduction.admission).kind!=='accepted'||validateContinuationDecisionV1(reduction.decision).kind!=='accepted'||validateContinuousOrchestrationStateV1(reduction.state).kind!=='accepted')return mismatch()
  const a=reduction.admission,d=reduction.decision,s=reduction.state,last=s.replay_ledger.entries[s.replay_ledger.entries.length-1]
  if(c.next_state_revision!==s.state_revision||c.candidate_digest!==digestContinuousOrchestrationJsonV1({admission:a,decision:d,state:s})||a.committed_state_revision!==s.state_revision||a.committed_decision_id!==d.decision_id||a.semantic_event_digest!==d.input_event_digest||a.committed_decision_url!==last?.decision_url||last?.decision_id!==d.decision_id||last?.semantic_event_digest!==d.input_event_digest||last?.idempotency_key!==d.idempotency_key||last?.committed_state_revision!==s.state_revision||s.audit_chain.head_decision_id_or_null!==d.decision_id||s.audit_chain.head_decision_url_or_null!==a.committed_decision_url||s.event_cursor.last_semantic_event_digest_or_null!==d.input_event_digest||s.event_cursor.last_decision_url_or_null!==a.committed_decision_url||s.last_decision_url!==a.committed_decision_url)return mismatch()
  if(s.pending_transport!==null&&(s.pending_transport.idempotency_key!==d.idempotency_key||s.pending_transport.decision_url!==a.committed_decision_url||s.pending_transport.created_from_state_revision!==s.state_revision))return mismatch()
  return frozen({cas_result_version:'continuous_orchestration_cas_result_v1',branch:'committed',expected_state_revision:c.expected_state_revision,committed_state_revision:reduction.state.state_revision,state:reduction.state})
}

export const projectContinuousOrchestrationAuditHookV1=(state:ContinuousOrchestrationStateV1,decision:ContinuationDecisionV1,decisionUrl:CanonicalRecordUrl)=>frozen({hook_version:'continuous_orchestration_audit_hook_v1',task_id:state.task_id,assignment_revision:state.assignment_revision,decision_id:decision.decision_id,decision_url:decisionUrl,predecessor_decision_url_or_null:decision.predecessor_decision_url_or_null,authority_snapshot_digest:decision.authority_snapshot_digest,branch:decision.branch,idempotency_key:decision.idempotency_key,prohibited_actions_confirmed_false:true})
export const projectContinuousOrchestrationGspHookV1=(state:ContinuousOrchestrationStateV1,decision:ContinuationDecisionV1,decisionUrl:CanonicalRecordUrl)=>frozen({hook_version:'continuous_orchestration_gsp_hook_v1',task_id:state.task_id,decision_url:decisionUrl,requirement:decision.gsp_hook,projected_head_sha_or_null:state.authority_snapshot.pr_head_sha_or_null,blocking_finding_count:state.finding_ledger.filter(x=>x.state==='open'||x.state==='reopened').length,open_finding_count:state.finding_ledger.filter(x=>x.state==='open'||x.state==='reopened').length,finding_closure_authority:false,approval_authority:false})
