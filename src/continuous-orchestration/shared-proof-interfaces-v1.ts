import {
  canonicalizeContinuousOrchestrationJsonV1 as jcs,
  digestContinuousOrchestrationJsonV1 as digest,
  validateProgressionEvaluatorResultV1,
  type ActionId,
  type CanonicalRecordUrl,
  type ClosedAdmissionResultV1,
  type CycleLedgerV1,
  type EvidenceSourceRefV1,
  type FindingLoopStateV1,
  type FullGitSha,
  type GspFieldIdV1,
  type IdentityFieldIdV1,
  type MetadataLoopCounterV1,
  type PrUrl,
  type ProgressionEvaluatorResultV1,
  type RoleId,
  type RouteBindingV1,
  type Sha256,
  type SourceTypeV1,
} from './index'

export const FRESH_AUTHORITY_SNAPSHOT_V1_VERSION = 'fresh_authority_snapshot_v1' as const
export const ADMITTED_AUTHORITY_BUNDLE_V1_VERSION = 'admitted_authority_bundle_v1' as const
export const DISPATCH_INTENT_V1_VERSION = 'dispatch_intent_v1' as const
export const CANDIDATE_AUTHORITY_REF_V1_VERSION = 'candidate_authority_ref_v1' as const
export const COMPLETION_EVIDENCE_CANDIDATE_V1_VERSION = 'completion_evidence_candidate_v1' as const
export const GATE_PROJECTION_INTENT_V1_VERSION = 'gate_projection_intent_v1' as const
export const ACTION_GUARD_PROOF_V1_VERSION = 'action_guard_proof_v1' as const
export const REPAIR_BUDGET_PROFILE_V1_VERSION = 'repair_budget_profile_v1' as const
export const REPAIR_ATTEMPT_LEDGER_V1_VERSION = 'repair_attempt_ledger_v1' as const
export const PROGRESSION_DECISION_PORT_V1_VERSION = 'progression_decision_port_v1' as const
export const CUMULATIVE_SLICE_MANIFEST_V1_VERSION = 'continuous_orchestration_cumulative_slice_manifest_v1' as const
export const CUMULATIVE_COMPATIBILITY_OBSERVATION_V1_VERSION = 'cumulative_compatibility_observation_v1' as const
export const CUMULATIVE_COMPATIBILITY_EVALUATION_RESULT_V1_VERSION = 'cumulative_compatibility_evaluation_result_v1' as const

export type AuthorityClassV1 = 'normative_semantic' | 'admission' | 'pure_decision' | 'projection_transport' | 'protected_executor'
export type FreshSnapshotPurposeV1 = 'evaluation' | 'action_guard'
export type RepairAttemptClassV1 = 'technical' | 'architecture' | 'metadata' | 'delivery'
export type RepairFindingDomainV1 = 'architecture' | 'implementation' | 'metadata' | 'validation' | 'publication'

export type { RouteBindingV1 }

export interface FreshAuthoritySnapshotV1 {
  readonly snapshot_version: typeof FRESH_AUTHORITY_SNAPSHOT_V1_VERSION
  readonly purpose: FreshSnapshotPurposeV1
  readonly task_id: string
  readonly repository: string
  readonly assignment_revision: number
  readonly collected_from: readonly EvidenceSourceRefV1[]
  readonly main_sha_or_null: FullGitSha | null
  readonly pr_url_or_null: PrUrl | null
  readonly pr_head_sha_or_null: FullGitSha | null
  readonly pr_base_sha_or_null: FullGitSha | null
  readonly pr_state: 'not_applicable' | 'open_draft' | 'open_ready' | 'merged' | 'closed_unmerged'
  readonly check_set_digest_or_null: Sha256 | null
  readonly finding_set_digest: Sha256
  readonly thread_set_digest: Sha256
  readonly workspace_binding_digest_or_null: Sha256 | null
  readonly workspace_state: 'not_required' | 'clean_bound' | 'dirty' | 'missing' | 'mismatched'
  readonly gsp_generation_or_null: number | null
  readonly gsp_body_digest_or_null: Sha256 | null
  readonly approval_consumption_digest_or_null: Sha256 | null
  readonly observed_at: string
  readonly snapshot_digest: Sha256
}

export interface AdmittedAuthoritySourceV1 {
  readonly source_type: SourceTypeV1
  readonly source_ref: EvidenceSourceRefV1
  readonly owner_contract_url: CanonicalRecordUrl
  readonly authority_class: AuthorityClassV1
  readonly authority_scope_digest: Sha256
  readonly content_projection_digest: Sha256
  readonly task_id: string
  readonly repository: string
  readonly subject_head_sha_or_null: FullGitSha | null
  readonly observed_at: string
  readonly admitted_field_ids: readonly IdentityFieldIdV1[]
  readonly admission_result: 'accepted'
}

export interface AdmittedAuthorityBundleV1 {
  readonly bundle_version: typeof ADMITTED_AUTHORITY_BUNDLE_V1_VERSION
  readonly task_id: string
  readonly repository: string
  readonly assignment_revision: number
  readonly scope_digest: Sha256
  readonly sources: readonly AdmittedAuthoritySourceV1[]
  readonly fresh_snapshot: FreshAuthoritySnapshotV1
  readonly admission_result: 'accepted'
  readonly bundle_digest: Sha256
}

export interface DispatchIntentV1 {
  readonly dispatch_intent_version: typeof DISPATCH_INTENT_V1_VERSION
  readonly intent_kind: 'role_dispatch' | 'independent_review_dispatch'
  readonly task_id: string
  readonly repository: string
  readonly assignment_revision: number
  readonly decision_url: CanonicalRecordUrl
  readonly predecessor_canonical_url: CanonicalRecordUrl
  readonly route_binding: RouteBindingV1
  readonly branch: string
  readonly worktree_identity: string
  readonly pr_url_or_null: PrUrl | null
  readonly head_sha_or_null: FullGitSha | null
  readonly scope_digest: Sha256
  readonly idempotency_key: Sha256
  readonly transport_authority: false
  readonly protected_action_authority: false
  readonly intent_digest: Sha256
}

export interface CandidateAuthorityRefV1 {
  readonly candidate_authority_ref_version: typeof CANDIDATE_AUTHORITY_REF_V1_VERSION
  readonly task_id: string
  readonly repository: string
  readonly candidate_id: string
  readonly candidate_identity_digest: Sha256
  readonly aggregate_digest: Sha256
  readonly ordered_repository_relative_paths: readonly string[]
  readonly base_sha: FullGitSha
  readonly working_head_sha: FullGitSha
  readonly result_handoff_url: CanonicalRecordUrl
  readonly publication_state: 'unpublished' | 'published'
  readonly published_head_sha_or_null: FullGitSha | null
  readonly ref_digest: Sha256
}

export interface CompletionEvidenceCandidateV1 {
  readonly completion_evidence_candidate_version: typeof COMPLETION_EVIDENCE_CANDIDATE_V1_VERSION
  readonly task_id: string
  readonly repository: string
  readonly pr_url: PrUrl
  readonly candidate_authority_ref: CandidateAuthorityRefV1
  readonly exact_head_sha: FullGitSha
  readonly current_main_sha: FullGitSha
  readonly architecture_review_decision_url: CanonicalRecordUrl
  readonly implementation_review_decision_url: CanonicalRecordUrl
  readonly publication_review_decision_url: CanonicalRecordUrl
  readonly final_regression_result_url: CanonicalRecordUrl
  readonly operational_validation_result_url: CanonicalRecordUrl
  readonly completion_preflight_url: CanonicalRecordUrl
  readonly current_main_binding_url: CanonicalRecordUrl
  readonly post_merge_gsp_url: CanonicalRecordUrl
  readonly gsp_generation: number
  readonly gsp_head_sha: FullGitSha
  readonly gsp_gate_rows_digest: Sha256
  readonly blocking_finding_count: 0
  readonly open_finding_count: 0
  readonly unresolved_thread_count: 0
  readonly finding_set_digest: Sha256
  readonly thread_set_digest: Sha256
  readonly evidence_urls: readonly CanonicalRecordUrl[]
  readonly assembled_at: string
  readonly completion_authority: false
  readonly candidate_digest: Sha256
}

export interface GateProjectionIntentV1 {
  readonly gate_projection_intent_version: typeof GATE_PROJECTION_INTENT_V1_VERSION
  readonly task_id: string
  readonly repository: string
  readonly assignment_revision: number
  readonly decision_url: CanonicalRecordUrl
  readonly authorized_metadata_role_id: RoleId
  readonly pr_url: PrUrl
  readonly head_sha: FullGitSha
  readonly required_field_ids: readonly GspFieldIdV1[]
  readonly evidence_urls: readonly CanonicalRecordUrl[]
  readonly reason: 'missing' | 'stale' | 'conflicting' | 'historical_at_prior_head'
  readonly expected_prior_generation_or_null: number | null
  readonly expected_gate_rows_digest_or_null: Sha256 | null
  readonly must_verify_after_write: true
  readonly projection_authority: false
  readonly finding_closure_authority: false
  readonly approval_authority: false
  readonly intent_digest: Sha256
}

export interface ActionGuardProofV1 {
  readonly action_guard_proof_version: typeof ACTION_GUARD_PROOF_V1_VERSION
  readonly task_id: string
  readonly repository: string
  readonly assignment_revision: number
  readonly action_id: ActionId
  readonly guard_scope: 'non_protected_transport' | 'protected_action'
  readonly evaluation_snapshot_digest: Sha256
  readonly action_snapshot: FreshAuthoritySnapshotV1
  readonly approval_record_url_or_null: CanonicalRecordUrl | null
  readonly one_use: true
  readonly consumption_state: 'unconsumed'
  readonly guarded_at: string
  readonly execution_authority: false
  readonly proof_digest: Sha256
}

export interface RepairBudgetProfileV1 {
  readonly repair_budget_profile_version: typeof REPAIR_BUDGET_PROFILE_V1_VERSION
  readonly task_id: string
  readonly repository: string
  readonly assignment_revision: number
  readonly semantic_epoch_id: Sha256
  readonly authority_record_url: CanonicalRecordUrl
  readonly allowed_scope_digest: Sha256
  readonly attempt_limits: Readonly<{ technical: 3; architecture: 3; metadata: 3; delivery: 3 }>
  readonly cycle_limits: Readonly<{ checkpoint_after_decisions: 32; stop_after_decisions: 64 }>
  readonly profile_digest: Sha256
}

export type RepairAttemptLedgerEntryV1 =
  | Readonly<{ entry_kind:'finding'; stable_finding_id:string; finding_domain:RepairFindingDomainV1; attempt_class:'technical'|'architecture'|'metadata'; scope_digest:Sha256; counter_key:Sha256; attempt_count:number; max_attempts:3; state:'open'|'closed'|'reopened'|'exhausted'; evidence_urls:readonly CanonicalRecordUrl[]; source_counter:FindingLoopStateV1 }>
  | Readonly<{ entry_kind:'metadata'; stable_finding_id:string; finding_domain:'metadata'; attempt_class:'metadata'; scope_digest:Sha256; counter_key:Sha256; attempt_count:number; max_attempts:3; state:'open'|'closed'|'exhausted'; evidence_urls:readonly CanonicalRecordUrl[]; source_counter:MetadataLoopCounterV1 }>
  | Readonly<{ entry_kind:'delivery'; stable_finding_id:string; finding_domain:RepairFindingDomainV1; attempt_class:'delivery'; scope_digest:Sha256; counter_key:Sha256; attempt_count:number; max_attempts:3; state:'pending'|'completed'|'awaiting_recovery'|'exhausted'; evidence_urls:readonly CanonicalRecordUrl[]; source_counter:Readonly<{ idempotency_key:Sha256; delivery_count:number; last_completion_url_or_null:CanonicalRecordUrl|null; state:'pending'|'completed'|'awaiting_recovery'|'exhausted' }> }>

export interface RepairAttemptLedgerV1 {
  readonly repair_attempt_ledger_version: typeof REPAIR_ATTEMPT_LEDGER_V1_VERSION
  readonly task_id: string
  readonly repository: string
  readonly assignment_revision: number
  readonly semantic_epoch_id: Sha256
  readonly profile_digest: Sha256
  readonly entries: readonly RepairAttemptLedgerEntryV1[]
  readonly cycle_ledger: CycleLedgerV1
  readonly ledger_digest: Sha256
}

export interface ProgressionDecisionPortV1 {
  readonly progression_decision_port_version: typeof PROGRESSION_DECISION_PORT_V1_VERSION
  readonly source_result_kind: 'recommend_next_role'|'wait_for_protected_action'|'require_gate_status_update'|'invalidate_approval'|'stop'|'no_transition'
  readonly source_result_digest: Sha256
  readonly projected_result: ProgressionEvaluatorResultV1
  readonly shadow_only: true
  readonly transport_invoked: false
  readonly port_digest: Sha256
}

export type SliceIdV1 = 'M0'|'M1'|'M2'|'M3'|'M4'|'M5'|'M6'
export type SliceOrdinalV1 = 0|1|2|3|4|5|6
export interface PathByteBindingV1 { readonly path:string; readonly byte_sha256:Sha256 }
export type SliceContentBindingV1 =
  | Readonly<{ kind:'path_byte_sha256'; path_bindings:readonly PathByteBindingV1[] }>
  | Readonly<{ kind:'approved_aggregate'; approval_record_url:CanonicalRecordUrl; ordered_paths_digest:Sha256; aggregate_digest:Sha256 }>
export interface CumulativeSliceEntryV1 { readonly slice_id:SliceIdV1; readonly ordinal:SliceOrdinalV1; readonly slice_candidate_url:CanonicalRecordUrl; readonly added_paths:readonly string[]; readonly added_path_count:number; readonly content_binding:SliceContentBindingV1; readonly prior_slice_digest_or_null:Sha256|null; readonly cumulative_paths_after_slice:readonly string[]; readonly slice_digest:Sha256; readonly cumulative_digest:Sha256 }
export type PriorManifestBindingV1 = Readonly<{state:'none_m1_bootstrap'}>|Readonly<{state:'bound';canonical_record_url:CanonicalRecordUrl;manifest_digest:Sha256}>
export interface M0StandaloneEvidenceV1 { readonly semantics:'standalone_exact2_only'; readonly candidate_url:CanonicalRecordUrl; readonly completion_preflight_url:CanonicalRecordUrl; readonly completion_result_url:CanonicalRecordUrl; readonly validator_path:'scripts/test-continuous-orchestration-core-consolidation-m0.mjs'; readonly inventory_path:'scripts/fixtures/continuous-orchestration-core-consolidation-m0-v1.json'; readonly inventory_digest:Sha256; readonly exact_paths:readonly [PathByteBindingV1,PathByteBindingV1]; readonly path_count:2 }
export interface CumulativeSliceManifestV1 { readonly schema_version:typeof CUMULATIVE_SLICE_MANIFEST_V1_VERSION; readonly task_id:'AUDIT-CONTINUOUS-ORCHESTRATION-REFACTORING-001'; readonly repository:'whatrune/sd-prompt-studio'; readonly authority_head_sha:FullGitSha; readonly branch:'codex/issue-221-core-consolidation'; readonly worktree_identity:'issue-221-core-consolidation'; readonly manifest_mode:'m1_bootstrap'|'successor'; readonly active_slice_id:SliceIdV1; readonly active_slice_ordinal:SliceOrdinalV1; readonly m0_standalone_evidence:M0StandaloneEvidenceV1; readonly prior_manifest:PriorManifestBindingV1; readonly slices:readonly CumulativeSliceEntryV1[]; readonly cumulative_paths:readonly string[]; readonly cumulative_path_count:number; readonly manifest_digest:Sha256 }
export interface AdmittedCumulativeSliceManifestV1 { readonly admission_version:'admitted_cumulative_slice_manifest_v1'; readonly admission_result:'accepted'; readonly manifest:CumulativeSliceManifestV1; readonly admitted_manifest_digest:Sha256 }

export interface ObservedWorktreeIdentityV1 { readonly logical_worktree_identity:'issue-221-core-consolidation'; readonly branch:'codex/issue-221-core-consolidation'; readonly head_sha:FullGitSha; readonly worktree_path_binding_digest:Sha256; readonly git_dir_binding_digest:Sha256; readonly common_git_dir_binding_digest:Sha256 }
export interface ExpectedWorktreeIdentityBindingV1 { readonly binding_version:'expected_worktree_identity_binding_v1'; readonly authority_record_url:CanonicalRecordUrl; readonly task_id:'AUDIT-CONTINUOUS-ORCHESTRATION-REFACTORING-001'; readonly repository:'whatrune/sd-prompt-studio'; readonly authority_head_sha:FullGitSha; readonly logical_worktree_identity:'issue-221-core-consolidation'; readonly branch:'codex/issue-221-core-consolidation'; readonly head_sha:FullGitSha; readonly worktree_path_binding_digest:Sha256; readonly git_dir_binding_digest:Sha256; readonly common_git_dir_binding_digest:Sha256; readonly identity_binding_digest:Sha256 }
export interface ObservationIdentityV1 { readonly authority_head_sha:FullGitSha; readonly expected:ExpectedWorktreeIdentityBindingV1; readonly observed:ObservedWorktreeIdentityV1 }
export type PriorManifestObservationProofV1 = Readonly<{state:'none_m1_bootstrap'}>|Readonly<{state:'bound';canonical_record_url:CanonicalRecordUrl;manifest_digest:Sha256;prior_slice_count:number;prior_slice_entries_digest:Sha256}>
export interface ObservationBaseSliceBindingV1 { readonly base_main_sha:FullGitSha; readonly manifest_record_url:CanonicalRecordUrl; readonly manifest_digest:Sha256; readonly active_slice_id:SliceIdV1; readonly active_slice_ordinal:SliceOrdinalV1; readonly slice_candidate_url:CanonicalRecordUrl; readonly prior_manifest:PriorManifestObservationProofV1 }
export interface ObservedPathByteProofV1 { readonly kind:'path_byte_sha256'; readonly path:string; readonly byte_length:number; readonly byte_sha256:Sha256 }
export interface ObservedApprovedAggregateProofV1 { readonly kind:'approved_aggregate'; readonly approval_record_url:CanonicalRecordUrl; readonly approval_content_projection_digest:Sha256; readonly ordered_paths:readonly string[]; readonly ordered_paths_digest:Sha256; readonly aggregate_digest:Sha256 }
export type ObservedContentProofV1 = ObservedPathByteProofV1|ObservedApprovedAggregateProofV1
export type ObservedStagedPathStateV1 = Readonly<{state:'none';ordered_paths:readonly [];ordered_paths_digest:Sha256}>|Readonly<{state:'present';ordered_paths:readonly [string,...string[]];ordered_paths_digest:Sha256}>
export interface ObservedTrackedDeltaPathV1 { readonly path:string; readonly base_byte_sha256:Sha256; readonly observed_byte_sha256:Sha256 }
export type ObservedTrackedExistingDeltaV1 = Readonly<{state:'none';base_head_sha:FullGitSha;ordered_paths:readonly [];path_deltas:readonly [];delta_digest:Sha256}>|Readonly<{state:'present';base_head_sha:FullGitSha;ordered_paths:readonly [string,...string[]];path_deltas:readonly [ObservedTrackedDeltaPathV1,...ObservedTrackedDeltaPathV1[]];delta_digest:Sha256}>
export type M0StandaloneUseProofV1 = Readonly<{state:'compliant';proof_mode:'canonical_historical_pass'|'isolated_exact2_rerun';result_record_url:CanonicalRecordUrl;validator_path:'scripts/test-continuous-orchestration-core-consolidation-m0.mjs';inventory_digest:Sha256;exact_ordered_paths:readonly [string,string];observed_path_count:2;cumulative_validator_mode:'cumulative_manifest_v1'}>|Readonly<{state:'m0_applied_to_cumulative';validator_path:'scripts/test-continuous-orchestration-core-consolidation-m0.mjs';observed_ordered_paths:readonly [string,string,string,...string[]];observed_path_count:number;cumulative_validator_mode:'m0_standalone_misapplied'}>
export interface CumulativeCompatibilityObservationV1 { readonly observation_version:typeof CUMULATIVE_COMPATIBILITY_OBSERVATION_V1_VERSION; readonly task_id:'AUDIT-CONTINUOUS-ORCHESTRATION-REFACTORING-001'; readonly repository:'whatrune/sd-prompt-studio'; readonly collected_at:string; readonly identity:ObservationIdentityV1; readonly base_slice_binding:ObservationBaseSliceBindingV1; readonly current_observed_ordered_paths_order:'repository_relative_posix_utf8_ascending_v1'; readonly current_observed_ordered_paths:readonly string[]; readonly current_observed_path_set_digest:Sha256; readonly content_proofs:readonly ObservedContentProofV1[]; readonly staged_path_state:ObservedStagedPathStateV1; readonly tracked_existing_delta:ObservedTrackedExistingDeltaV1; readonly m0_standalone_use:M0StandaloneUseProofV1; readonly observation_digest:Sha256 }
export interface AdmittedCumulativeCompatibilityObservationV1 { readonly admission_version:'admitted_cumulative_compatibility_observation_v1'; readonly admission_result:'accepted'; readonly observation:CumulativeCompatibilityObservationV1; readonly admitted_observation_digest:Sha256 }
export type CumulativeCompatibilityNegativeIdV1 = `B-221-M1-COMPAT-01-N${'01'|'02'|'03'|'04'|'05'|'06'|'07'|'08'|'09'|'10'|'11'|'12'|'13'|'14'|'15'|'16'}`
export type CumulativeCompatibilityEvidencePointerV1 = 'manifest.m0_byte_binding'|'manifest.current_membership'|'manifest.declared_order'|'manifest.duplicate_membership'|'manifest.prior_entry_binding'|'manifest.slice_prefix'|'manifest.slice_digest'|'manifest.cumulative_digest'|'manifest.root_digest'|'manifest.aggregate_approval'|'manifest.active_slice_path_byte_binding'|'manifest.prior_slice_path_byte_binding'|'identity.logical_worktree_identity'|'identity.branch'|'identity.head_sha'|'identity.worktree_path_binding_digest'|'identity.git_dir_binding_digest'|'identity.common_git_dir_binding_digest'|'workspace.staged_state'|'workspace.tracked_existing_delta'|'validation.m0_standalone_use'
export type CumulativeCompatibilityEvidenceDetailV1 = 'byte_digest_mismatch'|'missing_repository_relative_path'|'extra_repository_relative_path'|'declared_order_mismatch'|'duplicate_repository_relative_path'|'prior_entry_digest_mismatch'|'slice_prefix_mismatch'|'slice_digest_mismatch'|'cumulative_digest_mismatch'|'manifest_digest_mismatch'|'aggregate_approval_mismatch'|'active_slice_path_byte_drift'|'prior_slice_path_byte_drift'|'logical_identity_mismatch'|'branch_mismatch'|'head_mismatch'|'worktree_path_binding_mismatch'|'git_dir_binding_mismatch'|'common_git_dir_binding_mismatch'|'alias_binding_mismatch'|'staged_state_present'|'tracked_existing_delta_present'|'m0_validator_scope_mismatch'
export interface SanitizedCompatibilityEvidenceV1 { readonly pointer:CumulativeCompatibilityEvidencePointerV1; readonly detail:CumulativeCompatibilityEvidenceDetailV1; readonly repository_relative_path_or_null:string|null; readonly expected_digest_or_null:Sha256|null; readonly observed_digest_or_null:Sha256|null }
export interface SliceTargetV1 { readonly slice_id:SliceIdV1; readonly ordinal:SliceOrdinalV1; readonly relation_to_active:'active'|'prior' }
export interface CumulativeManifestPathByteBindingV1 { readonly manifest_digest:Sha256; readonly target_slice_digest:Sha256; readonly content_binding_kind:'path_byte_sha256'; readonly path_binding_index:number; readonly path_binding_digest:Sha256 }
export interface PathByteDriftTupleV1 { readonly target_slice_id:SliceIdV1; readonly target_slice_ordinal:SliceOrdinalV1; readonly path_binding_index:number; readonly repository_relative_path:string; readonly expected_byte_sha256:Sha256; readonly observed_byte_sha256:Sha256; readonly path_binding_digest:Sha256 }
export interface ActiveSlicePathByteDriftEvidenceV1 { readonly pointer:'manifest.active_slice_path_byte_binding'; readonly detail:'active_slice_path_byte_drift'; readonly target_slice:SliceTargetV1&Readonly<{relation_to_active:'active'}>; readonly repository_relative_path:string; readonly expected_byte_sha256:Sha256; readonly observed_byte_sha256:Sha256; readonly cumulative_manifest_binding:CumulativeManifestPathByteBindingV1; readonly drift_count:number; readonly drift_set_digest:Sha256; readonly evidence_digest:Sha256 }
export interface PriorSlicePathByteDriftEvidenceV1 { readonly pointer:'manifest.prior_slice_path_byte_binding'; readonly detail:'prior_slice_path_byte_drift'; readonly target_slice:SliceTargetV1&Readonly<{relation_to_active:'prior'}>; readonly repository_relative_path:string; readonly expected_byte_sha256:Sha256; readonly observed_byte_sha256:Sha256; readonly cumulative_manifest_binding:CumulativeManifestPathByteBindingV1; readonly drift_count:number; readonly drift_set_digest:Sha256; readonly evidence_digest:Sha256 }
export type CumulativeCompatibilityEvaluationResultV1 =
  | Readonly<{result_version:typeof CUMULATIVE_COMPATIBILITY_EVALUATION_RESULT_V1_VERSION;kind:'compatible';active_slice_id:SliceIdV1;manifest_digest:Sha256;observation_digest:Sha256;verified_path_count:number;positive_ids:readonly ['B-221-M1-COMPAT-01-P01','B-221-M1-COMPAT-01-P02'];state_changed:false;transport_invoked:false}>
  | Readonly<{result_version:typeof CUMULATIVE_COMPATIBILITY_EVALUATION_RESULT_V1_VERSION;kind:'incompatible';negative_id:Exclude<CumulativeCompatibilityNegativeIdV1,'B-221-M1-COMPAT-01-N16'>;manifest_digest:Sha256;observation_digest:Sha256;evidence:SanitizedCompatibilityEvidenceV1|PriorSlicePathByteDriftEvidenceV1;state_changed:false;transport_invoked:false}>
  | Readonly<{result_version:typeof CUMULATIVE_COMPATIBILITY_EVALUATION_RESULT_V1_VERSION;kind:'incompatible';negative_id:'B-221-M1-COMPAT-01-N16';negative_literal:'active_slice_path_byte_drift';manifest_digest:Sha256;observation_digest:Sha256;evidence:ActiveSlicePathByteDriftEvidenceV1;state_changed:false;transport_invoked:false}>
  | Readonly<{result_version:typeof CUMULATIVE_COMPATIBILITY_EVALUATION_RESULT_V1_VERSION;kind:'failed';failure:Readonly<{code:'cumulative_compatibility_internal_failure';stage:'manifest_admission'|'observation_admission'|'evaluation';diagnostic_id:Sha256;safe_message:'cumulative compatibility evaluation failed'}>;state_changed:false;transport_invoked:false}>

type JsonObject=Record<string,unknown>
type RejectCode='unknown_field'|'missing_required_field'|'forbidden_field'|'invalid_type_or_format'|'invalid_enum'|'duplicate_set_member'|'noncanonical_set_order'|'invalid_conditional_matrix'|'invalid_cross_input_binding'
type Problem={code:RejectCode;path:string}
const object=(value:unknown):value is JsonObject=>typeof value==='object'&&value!==null&&!Array.isArray(value)
const clone=<T>(value:T):T=>structuredClone(value)
const freeze=<T>(value:T):T=>{if(value!==null&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);for(const child of Object.values(value as JsonObject))freeze(child)}return value}
const utf8Compare=(a:string,b:string)=>{const x=new TextEncoder().encode(a),y=new TextEncoder().encode(b);for(let i=0;i<Math.min(x.length,y.length);i+=1)if(x[i]!==y[i])return x[i]-y[i];return x.length-y.length}
const orderedUnique=(value:unknown,predicate:(item:unknown)=>boolean=nonEmpty)=>Array.isArray(value)&&value.every(predicate)&&value.every((item,index)=>index===0||utf8Compare(String(value[index-1]),String(item))<0)
const nonEmpty=(value:unknown):value is string=>typeof value==='string'&&value.length>0
const sha=(value:unknown):value is Sha256=>typeof value==='string'&&/^[0-9a-f]{64}$/.test(value)
const gitSha=(value:unknown):value is FullGitSha=>typeof value==='string'&&/^[0-9a-f]{40}$/.test(value)
const utc=(value:unknown)=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value)&&Number.isFinite(Date.parse(value))
const canonical=(value:unknown):value is CanonicalRecordUrl=>typeof value==='string'&&/^https:\/\/github\.com\/[^/]+\/[^/]+\/(?:issues|pull)\/[1-9]\d*(?:#issuecomment-[1-9]\d*)?$/.test(value)
const pr=(value:unknown):value is PrUrl=>typeof value==='string'&&/^https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/[1-9]\d*$/.test(value)
const uint=(value:unknown)=>Number.isSafeInteger(value)&&Number(value)>=0
const posixPath=(value:unknown):value is string=>typeof value==='string'&&value.length>0&&!value.startsWith('/')&&!value.includes('\\')&&!value.split('/').some(segment=>segment===''||segment==='.'||segment==='..')
const exact=(value:unknown,keys:readonly string[],path:string):Problem|undefined=>{if(!object(value))return{code:'invalid_type_or_format',path};for(const key of keys)if(!Object.prototype.hasOwnProperty.call(value,key))return{code:'missing_required_field',path:`${path}/${key}`};if(Object.keys(value).some(key=>!keys.includes(key)))return{code:'unknown_field',path:`${path}/public.unknown`};return undefined}
const omitted=<T extends JsonObject>(value:T,...keys:string[])=>Object.fromEntries(Object.entries(value).filter(([key])=>!keys.includes(key)))
const same=(a:unknown,b:unknown)=>jcs(a)===jcs(b)
const digestWithout=(value:JsonObject,...keys:string[])=>digest(omitted(value,...keys))
const accepted=<T>(value:T):ClosedAdmissionResultV1<T>=>freeze({contract_version:'closed-admission-result-v1',kind:'accepted',value:freeze(clone(value))})
const rejected=<T>(problem:Problem):ClosedAdmissionResultV1<T>=>freeze({contract_version:'closed-admission-result-v1',kind:'rejected',rejection:{code:problem.code,path:problem.path,message:`rejected: ${problem.code}`}})
const failed=<T>(stage:string):ClosedAdmissionResultV1<T>=>freeze({contract_version:'closed-admission-result-v1',kind:'failed',failure:{code:'validator_internal_failure',diagnostic_id:digest({stage}),safe_message:'validator failed internally'}})
const run=<T>(stage:string,value:unknown,check:(value:JsonObject)=>Problem|undefined):ClosedAdmissionResultV1<T>=>{try{if(!object(value))return rejected({code:'invalid_type_or_format',path:'/'});const problem=check(value);return problem?rejected(problem):accepted(value as T)}catch{return failed(stage)}}
const digestOk=(value:JsonObject,key:string)=>sha(value[key])&&value[key]===digestWithout(value,key)
const nullable=(predicate:(value:unknown)=>boolean,value:unknown)=>value===null||predicate(value)
const enumOf=(values:readonly string[],value:unknown)=>typeof value==='string'&&values.includes(value)
const canonicalArray=(value:unknown,nonEmptyRequired=false)=>Array.isArray(value)&&(!nonEmptyRequired||value.length>0)&&value.every(canonical)&&orderedUnique(value,canonical)
const safeSourceRef=(value:unknown,path:string):Problem|undefined=>{if(!object(value))return{code:'invalid_type_or_format',path};if(value.kind==='canonical_record'){const p=exact(value,['kind','url'],path);return p??(canonical(value.url)?undefined:{code:'invalid_type_or_format',path:`${path}/url`})}if(value.kind==='pr_snapshot'||value.kind==='review_thread'){const p=exact(value,['kind','url'],path);return p??(canonical(value.url)||pr(value.url)?undefined:{code:'invalid_type_or_format',path:`${path}/url`})}if(value.kind==='check_evidence'){const p=exact(value,['kind','url','check_name','provider_id','checked_head_sha'],path);return p??(canonical(value.url)&&nonEmpty(value.check_name)&&nonEmpty(value.provider_id)&&gitSha(value.checked_head_sha)?undefined:{code:'invalid_type_or_format',path})}return{code:'invalid_enum',path:`${path}/kind`}}
const routeProblem=(value:unknown,path='/route_binding'):Problem|undefined=>{const p=exact(value,['transition_class','role_id','action_id','authority_record_url','allowed_scope_digest','independent_from_role_id_or_null'],path);if(p)return p;const v=value as JsonObject;return nonEmpty(v.transition_class)&&nonEmpty(v.role_id)&&nonEmpty(v.action_id)&&canonical(v.authority_record_url)&&sha(v.allowed_scope_digest)&&nullable(nonEmpty,v.independent_from_role_id_or_null)?undefined:{code:'invalid_type_or_format',path}}

const snapshotKeys=['snapshot_version','purpose','task_id','repository','assignment_revision','collected_from','main_sha_or_null','pr_url_or_null','pr_head_sha_or_null','pr_base_sha_or_null','pr_state','check_set_digest_or_null','finding_set_digest','thread_set_digest','workspace_binding_digest_or_null','workspace_state','gsp_generation_or_null','gsp_body_digest_or_null','approval_consumption_digest_or_null','observed_at','snapshot_digest'] as const
const snapshotProblem=(v:JsonObject):Problem|undefined=>{let p=exact(v,snapshotKeys,'/snapshot');if(p)return p;if(v.snapshot_version!==FRESH_AUTHORITY_SNAPSHOT_V1_VERSION||!enumOf(['evaluation','action_guard'],v.purpose)||!nonEmpty(v.task_id)||!nonEmpty(v.repository)||!uint(v.assignment_revision)||!Array.isArray(v.collected_from)||!nullable(gitSha,v.main_sha_or_null)||!nullable(pr,v.pr_url_or_null)||!nullable(gitSha,v.pr_head_sha_or_null)||!nullable(gitSha,v.pr_base_sha_or_null)||!enumOf(['not_applicable','open_draft','open_ready','merged','closed_unmerged'],v.pr_state)||!nullable(sha,v.check_set_digest_or_null)||!sha(v.finding_set_digest)||!sha(v.thread_set_digest)||!nullable(sha,v.workspace_binding_digest_or_null)||!enumOf(['not_required','clean_bound','dirty','missing','mismatched'],v.workspace_state)||!(v.gsp_generation_or_null===null||uint(v.gsp_generation_or_null))||!nullable(sha,v.gsp_body_digest_or_null)||!nullable(sha,v.approval_consumption_digest_or_null)||!utc(v.observed_at))return{code:'invalid_type_or_format',path:'/snapshot'};for(let i=0;i<v.collected_from.length;i+=1){p=safeSourceRef(v.collected_from[i],`/snapshot/collected_from/${i}`);if(p)return p}if(v.pr_state==='not_applicable'&&[v.pr_url_or_null,v.pr_head_sha_or_null,v.pr_base_sha_or_null].some(x=>x!==null))return{code:'invalid_conditional_matrix',path:'/snapshot/pr_state'};if(v.pr_state!=='not_applicable'&&(!pr(v.pr_url_or_null)||!gitSha(v.pr_head_sha_or_null)||!gitSha(v.pr_base_sha_or_null)))return{code:'invalid_conditional_matrix',path:'/snapshot/pr_state'};if((v.gsp_generation_or_null===null)!==(v.gsp_body_digest_or_null===null))return{code:'invalid_conditional_matrix',path:'/snapshot/gsp_generation_or_null'};if(v.workspace_state==='not_required'&&v.workspace_binding_digest_or_null!==null)return{code:'invalid_conditional_matrix',path:'/snapshot/workspace_state'};if(v.workspace_state==='clean_bound'&&!sha(v.workspace_binding_digest_or_null))return{code:'invalid_conditional_matrix',path:'/snapshot/workspace_state'};if(!digestOk(v,'snapshot_digest'))return{code:'invalid_cross_input_binding',path:'/snapshot/snapshot_digest'};return undefined}

export const validateFreshAuthoritySnapshotV1=(value:unknown)=>run<FreshAuthoritySnapshotV1>('fresh_snapshot',value,snapshotProblem)

const sourceKeys=['source_type','source_ref','owner_contract_url','authority_class','authority_scope_digest','content_projection_digest','task_id','repository','subject_head_sha_or_null','observed_at','admitted_field_ids','admission_result'] as const
const sourceProblem=(value:unknown,path:string):Problem|undefined=>{const p=exact(value,sourceKeys,path);if(p)return p;const v=value as JsonObject;if(!nonEmpty(v.source_type)||!canonical(v.owner_contract_url)||!enumOf(['normative_semantic','admission','pure_decision','projection_transport','protected_executor'],v.authority_class)||!sha(v.authority_scope_digest)||!sha(v.content_projection_digest)||!nonEmpty(v.task_id)||!nonEmpty(v.repository)||!nullable(gitSha,v.subject_head_sha_or_null)||!utc(v.observed_at)||!orderedUnique(v.admitted_field_ids)||v.admission_result!=='accepted')return{code:'invalid_type_or_format',path};return safeSourceRef(v.source_ref,`${path}/source_ref`)}
export const validateAdmittedAuthorityBundleV1=(value:unknown)=>run<AdmittedAuthorityBundleV1>('authority_bundle',value,v=>{let p=exact(v,['bundle_version','task_id','repository','assignment_revision','scope_digest','sources','fresh_snapshot','admission_result','bundle_digest'],'/bundle');if(p)return p;if(v.bundle_version!==ADMITTED_AUTHORITY_BUNDLE_V1_VERSION||!nonEmpty(v.task_id)||!nonEmpty(v.repository)||!uint(v.assignment_revision)||!sha(v.scope_digest)||!Array.isArray(v.sources)||v.sources.length===0||v.admission_result!=='accepted')return{code:'invalid_type_or_format',path:'/bundle'};const snap=validateFreshAuthoritySnapshotV1(v.fresh_snapshot);if(snap.kind!=='accepted')return{code:snap.kind==='rejected'?snap.rejection.code as RejectCode:'invalid_type_or_format',path:'/bundle/fresh_snapshot'};const keys:string[]=[];for(let i=0;i<v.sources.length;i+=1){p=sourceProblem(v.sources[i],`/bundle/sources/${i}`);if(p)return p;const s=v.sources[i] as JsonObject;if(s.task_id!==v.task_id||s.repository!==v.repository||Date.parse(String(s.observed_at))>Date.parse(snap.value.observed_at))return{code:'invalid_cross_input_binding',path:`/bundle/sources/${i}`};keys.push(`${s.source_type}\0${jcs(s.source_ref)}`)}if(!orderedUnique(keys))return{code:new Set(keys).size!==keys.length?'duplicate_set_member':'noncanonical_set_order',path:'/bundle/sources'};if(snap.value.purpose!=='evaluation'||snap.value.task_id!==v.task_id||snap.value.repository!==v.repository||snap.value.assignment_revision!==v.assignment_revision)return{code:'invalid_cross_input_binding',path:'/bundle/fresh_snapshot'};if(!digestOk(v,'bundle_digest'))return{code:'invalid_cross_input_binding',path:'/bundle/bundle_digest'};return undefined})

export const validateRouteBindingV1=(value:unknown)=>run<RouteBindingV1>('route_binding',value,v=>routeProblem(v))

export const validateDispatchIntentV1=(value:unknown)=>run<DispatchIntentV1>('dispatch_intent',value,v=>{const p=exact(v,['dispatch_intent_version','intent_kind','task_id','repository','assignment_revision','decision_url','predecessor_canonical_url','route_binding','branch','worktree_identity','pr_url_or_null','head_sha_or_null','scope_digest','idempotency_key','transport_authority','protected_action_authority','intent_digest'],'/dispatch_intent');if(p)return p;const rp=routeProblem(v.route_binding);if(rp)return rp;const route=v.route_binding as unknown as RouteBindingV1;if(v.dispatch_intent_version!==DISPATCH_INTENT_V1_VERSION||!enumOf(['role_dispatch','independent_review_dispatch'],v.intent_kind)||!nonEmpty(v.task_id)||!nonEmpty(v.repository)||!uint(v.assignment_revision)||!canonical(v.decision_url)||!canonical(v.predecessor_canonical_url)||!nonEmpty(v.branch)||!nonEmpty(v.worktree_identity)||!nullable(pr,v.pr_url_or_null)||!nullable(gitSha,v.head_sha_or_null)||!sha(v.scope_digest)||!sha(v.idempotency_key)||v.transport_authority!==false||v.protected_action_authority!==false)return{code:'invalid_type_or_format',path:'/dispatch_intent'};if(v.scope_digest!==route.allowed_scope_digest)return{code:'invalid_cross_input_binding',path:'/dispatch_intent/scope_digest'};const independent=route.independent_from_role_id_or_null!==null&&route.independent_from_role_id_or_null!==route.role_id;if((v.intent_kind==='independent_review_dispatch')!==independent)return{code:'invalid_conditional_matrix',path:'/dispatch_intent/intent_kind'};if(v.idempotency_key!==digest({task_id:v.task_id,assignment_revision:v.assignment_revision,decision_url:v.decision_url,predecessor_canonical_url:v.predecessor_canonical_url,route_binding:v.route_binding,branch:v.branch,worktree_identity:v.worktree_identity,pr_url_or_null:v.pr_url_or_null,head_sha_or_null:v.head_sha_or_null,scope_digest:v.scope_digest}))return{code:'invalid_cross_input_binding',path:'/dispatch_intent/idempotency_key'};if(!digestOk(v,'intent_digest'))return{code:'invalid_cross_input_binding',path:'/dispatch_intent/intent_digest'};return undefined})

export const validateCandidateAuthorityRefV1=(value:unknown)=>run<CandidateAuthorityRefV1>('candidate_ref',value,v=>{const p=exact(v,['candidate_authority_ref_version','task_id','repository','candidate_id','candidate_identity_digest','aggregate_digest','ordered_repository_relative_paths','base_sha','working_head_sha','result_handoff_url','publication_state','published_head_sha_or_null','ref_digest'],'/candidate_ref');if(p)return p;if(v.candidate_authority_ref_version!==CANDIDATE_AUTHORITY_REF_V1_VERSION||!nonEmpty(v.task_id)||!nonEmpty(v.repository)||!nonEmpty(v.candidate_id)||!sha(v.candidate_identity_digest)||!sha(v.aggregate_digest)||!Array.isArray(v.ordered_repository_relative_paths)||v.ordered_repository_relative_paths.length===0||!v.ordered_repository_relative_paths.every(posixPath)||new Set(v.ordered_repository_relative_paths).size!==v.ordered_repository_relative_paths.length||!gitSha(v.base_sha)||!gitSha(v.working_head_sha)||!canonical(v.result_handoff_url)||!enumOf(['unpublished','published'],v.publication_state)||!nullable(gitSha,v.published_head_sha_or_null))return{code:'invalid_type_or_format',path:'/candidate_ref'};const identity={task_id:v.task_id,repository:v.repository,base_sha:v.base_sha,working_head_sha:v.working_head_sha,ordered_repository_relative_paths:v.ordered_repository_relative_paths,aggregate_digest:v.aggregate_digest};if(v.candidate_identity_digest!==digest(identity))return{code:'invalid_cross_input_binding',path:'/candidate_ref/candidate_identity_digest'};if((v.publication_state==='unpublished')!==(v.published_head_sha_or_null===null))return{code:'invalid_conditional_matrix',path:'/candidate_ref/publication_state'};if(!digestOk(v,'ref_digest'))return{code:'invalid_cross_input_binding',path:'/candidate_ref/ref_digest'};return undefined})

export const validateCompletionEvidenceCandidateV1=(value:unknown)=>run<CompletionEvidenceCandidateV1>('completion_candidate',value,v=>{const keys=['completion_evidence_candidate_version','task_id','repository','pr_url','candidate_authority_ref','exact_head_sha','current_main_sha','architecture_review_decision_url','implementation_review_decision_url','publication_review_decision_url','final_regression_result_url','operational_validation_result_url','completion_preflight_url','current_main_binding_url','post_merge_gsp_url','gsp_generation','gsp_head_sha','gsp_gate_rows_digest','blocking_finding_count','open_finding_count','unresolved_thread_count','finding_set_digest','thread_set_digest','evidence_urls','assembled_at','completion_authority','candidate_digest'];const p=exact(v,keys,'/completion_candidate');if(p)return p;const ref=validateCandidateAuthorityRefV1(v.candidate_authority_ref);if(ref.kind!=='accepted')return{code:'invalid_cross_input_binding',path:'/completion_candidate/candidate_authority_ref'};const named=['architecture_review_decision_url','implementation_review_decision_url','publication_review_decision_url','final_regression_result_url','operational_validation_result_url','completion_preflight_url','current_main_binding_url','post_merge_gsp_url'].map(k=>v[k]);if(v.completion_evidence_candidate_version!==COMPLETION_EVIDENCE_CANDIDATE_V1_VERSION||!nonEmpty(v.task_id)||!nonEmpty(v.repository)||!pr(v.pr_url)||!gitSha(v.exact_head_sha)||!gitSha(v.current_main_sha)||!named.every(canonical)||!Number.isSafeInteger(v.gsp_generation)||Number(v.gsp_generation)<1||!gitSha(v.gsp_head_sha)||!sha(v.gsp_gate_rows_digest)||v.blocking_finding_count!==0||v.open_finding_count!==0||v.unresolved_thread_count!==0||!sha(v.finding_set_digest)||!sha(v.thread_set_digest)||!canonicalArray(v.evidence_urls,true)||!utc(v.assembled_at)||v.completion_authority!==false)return{code:'invalid_type_or_format',path:'/completion_candidate'};const required=[...named,ref.value.result_handoff_url];if(!required.every(url=>(v.evidence_urls as unknown[]).includes(url)))return{code:'invalid_cross_input_binding',path:'/completion_candidate/evidence_urls'};if(ref.value.task_id!==v.task_id||ref.value.repository!==v.repository||ref.value.publication_state!=='published'||ref.value.published_head_sha_or_null!==v.exact_head_sha||v.gsp_head_sha!==v.current_main_sha)return{code:'invalid_cross_input_binding',path:'/completion_candidate'};if(!digestOk(v,'candidate_digest'))return{code:'invalid_cross_input_binding',path:'/completion_candidate/candidate_digest'};return undefined})

export const validateGateProjectionIntentV1=(value:unknown)=>run<GateProjectionIntentV1>('gate_projection',value,v=>{const p=exact(v,['gate_projection_intent_version','task_id','repository','assignment_revision','decision_url','authorized_metadata_role_id','pr_url','head_sha','required_field_ids','evidence_urls','reason','expected_prior_generation_or_null','expected_gate_rows_digest_or_null','must_verify_after_write','projection_authority','finding_closure_authority','approval_authority','intent_digest'],'/gate_projection');if(p)return p;if(v.gate_projection_intent_version!==GATE_PROJECTION_INTENT_V1_VERSION||!nonEmpty(v.task_id)||!nonEmpty(v.repository)||!uint(v.assignment_revision)||!canonical(v.decision_url)||!nonEmpty(v.authorized_metadata_role_id)||!pr(v.pr_url)||!gitSha(v.head_sha)||!orderedUnique(v.required_field_ids)||!(v.required_field_ids as unknown[]).length||!canonicalArray(v.evidence_urls,true)||!enumOf(['missing','stale','conflicting','historical_at_prior_head'],v.reason)||!(v.expected_prior_generation_or_null===null||uint(v.expected_prior_generation_or_null))||!nullable(sha,v.expected_gate_rows_digest_or_null)||v.must_verify_after_write!==true||v.projection_authority!==false||v.finding_closure_authority!==false||v.approval_authority!==false)return{code:'invalid_type_or_format',path:'/gate_projection'};if(!digestOk(v,'intent_digest'))return{code:'invalid_cross_input_binding',path:'/gate_projection/intent_digest'};return undefined})

const mutableSnapshotKeys=['main_sha_or_null','pr_url_or_null','pr_head_sha_or_null','pr_base_sha_or_null','pr_state','check_set_digest_or_null','finding_set_digest','thread_set_digest','workspace_binding_digest_or_null','workspace_state','gsp_generation_or_null','gsp_body_digest_or_null','approval_consumption_digest_or_null'] as const
export const validateActionGuardProofV1=(value:unknown,evaluationSnapshot?:FreshAuthoritySnapshotV1)=>run<ActionGuardProofV1>('action_guard',value,v=>{const p=exact(v,['action_guard_proof_version','task_id','repository','assignment_revision','action_id','guard_scope','evaluation_snapshot_digest','action_snapshot','approval_record_url_or_null','one_use','consumption_state','guarded_at','execution_authority','proof_digest'],'/action_guard');if(p)return p;const action=validateFreshAuthoritySnapshotV1(v.action_snapshot);if(action.kind!=='accepted')return{code:'invalid_cross_input_binding',path:'/action_guard/action_snapshot'};if(v.action_guard_proof_version!==ACTION_GUARD_PROOF_V1_VERSION||!nonEmpty(v.task_id)||!nonEmpty(v.repository)||!uint(v.assignment_revision)||!nonEmpty(v.action_id)||!enumOf(['non_protected_transport','protected_action'],v.guard_scope)||!sha(v.evaluation_snapshot_digest)||!nullable(canonical,v.approval_record_url_or_null)||v.one_use!==true||v.consumption_state!=='unconsumed'||!utc(v.guarded_at)||v.execution_authority!==false)return{code:'invalid_type_or_format',path:'/action_guard'};if(action.value.purpose!=='action_guard'||action.value.task_id!==v.task_id||action.value.repository!==v.repository||action.value.assignment_revision!==v.assignment_revision||action.value.observed_at!==v.guarded_at)return{code:'invalid_cross_input_binding',path:'/action_guard/action_snapshot'};if((v.guard_scope==='protected_action')!==(v.approval_record_url_or_null!==null))return{code:'invalid_conditional_matrix',path:'/action_guard/guard_scope'};if(evaluationSnapshot){if(evaluationSnapshot.purpose!=='evaluation'||evaluationSnapshot.snapshot_digest!==v.evaluation_snapshot_digest||Date.parse(action.value.observed_at)<=Date.parse(evaluationSnapshot.observed_at)||mutableSnapshotKeys.some(key=>!same(action.value[key],evaluationSnapshot[key])))return{code:'invalid_cross_input_binding',path:'/action_guard/evaluation_snapshot_digest'}}if(!digestOk(v,'proof_digest'))return{code:'invalid_cross_input_binding',path:'/action_guard/proof_digest'};return undefined})

export const validateRepairBudgetProfileV1=(value:unknown)=>run<RepairBudgetProfileV1>('repair_profile',value,v=>{let p=exact(v,['repair_budget_profile_version','task_id','repository','assignment_revision','semantic_epoch_id','authority_record_url','allowed_scope_digest','attempt_limits','cycle_limits','profile_digest'],'/repair_profile');if(p)return p;p=exact(v.attempt_limits,['technical','architecture','metadata','delivery'],'/repair_profile/attempt_limits')??exact(v.cycle_limits,['checkpoint_after_decisions','stop_after_decisions'],'/repair_profile/cycle_limits');if(p)return p;const a=v.attempt_limits as JsonObject,c=v.cycle_limits as JsonObject;if(v.repair_budget_profile_version!==REPAIR_BUDGET_PROFILE_V1_VERSION||!nonEmpty(v.task_id)||!nonEmpty(v.repository)||!uint(v.assignment_revision)||!sha(v.semantic_epoch_id)||!canonical(v.authority_record_url)||!sha(v.allowed_scope_digest)||!['technical','architecture','metadata','delivery'].every(k=>a[k]===3)||c.checkpoint_after_decisions!==32||c.stop_after_decisions!==64)return{code:'invalid_conditional_matrix',path:'/repair_profile'};if(!digestOk(v,'profile_digest'))return{code:'invalid_cross_input_binding',path:'/repair_profile/profile_digest'};return undefined})

const entryProblem=(value:unknown,path:string):Problem|undefined=>{if(!object(value))return{code:'invalid_type_or_format',path};const common=['entry_kind','stable_finding_id','finding_domain','attempt_class','scope_digest','counter_key','attempt_count','max_attempts','state','evidence_urls','source_counter'];const p=exact(value,common,path);if(p)return p;if(!enumOf(['finding','metadata','delivery'],value.entry_kind)||!nonEmpty(value.stable_finding_id)||!enumOf(['architecture','implementation','metadata','validation','publication'],value.finding_domain)||!enumOf(['technical','architecture','metadata','delivery'],value.attempt_class)||!sha(value.scope_digest)||!sha(value.counter_key)||!uint(value.attempt_count)||value.max_attempts!==3||!canonicalArray(value.evidence_urls))return{code:'invalid_type_or_format',path};if(Number(value.attempt_count)>3||(value.state==='exhausted'&&value.attempt_count!==3))return{code:'invalid_conditional_matrix',path};if(value.entry_kind==='finding'){if(!enumOf(['open','closed','reopened','exhausted'],value.state)||!object(value.source_counter))return{code:'invalid_type_or_format',path};const expected=value.finding_domain==='architecture'?'architecture':value.finding_domain==='metadata'?'metadata':'technical';if(value.attempt_class!==expected)return{code:'invalid_cross_input_binding',path:`${path}/attempt_class`}}else if(value.entry_kind==='metadata'){if(value.finding_domain!=='metadata'||value.attempt_class!=='metadata'||!enumOf(['open','closed','exhausted'],value.state)||!object(value.source_counter)||value.stable_finding_id!==(value.source_counter as JsonObject).semantic_defect_digest)return{code:'invalid_cross_input_binding',path}}else{if(value.attempt_class!=='delivery'||!enumOf(['pending','completed','awaiting_recovery','exhausted'],value.state))return{code:'invalid_conditional_matrix',path};const s=value.source_counter;if(!object(s))return{code:'invalid_type_or_format',path};const sp=exact(s,['idempotency_key','delivery_count','last_completion_url_or_null','state'],`${path}/source_counter`);if(sp)return sp;if(!sha(s.idempotency_key)||!uint(s.delivery_count)||!nullable(canonical,s.last_completion_url_or_null)||s.state!==value.state||value.stable_finding_id!==s.idempotency_key)return{code:'invalid_cross_input_binding',path}}return undefined}
export const validateRepairAttemptLedgerV1=(value:unknown)=>run<RepairAttemptLedgerV1>('repair_ledger',value,v=>{const p=exact(v,['repair_attempt_ledger_version','task_id','repository','assignment_revision','semantic_epoch_id','profile_digest','entries','cycle_ledger','ledger_digest'],'/repair_ledger');if(p)return p;if(v.repair_attempt_ledger_version!==REPAIR_ATTEMPT_LEDGER_V1_VERSION||!nonEmpty(v.task_id)||!nonEmpty(v.repository)||!uint(v.assignment_revision)||!sha(v.semantic_epoch_id)||!sha(v.profile_digest)||!Array.isArray(v.entries)||!object(v.cycle_ledger))return{code:'invalid_type_or_format',path:'/repair_ledger'};const keys:string[]=[];for(let i=0;i<v.entries.length;i+=1){const ep=entryProblem(v.entries[i],`/repair_ledger/entries/${i}`);if(ep)return ep;const e=v.entries[i] as JsonObject;keys.push(`${e.entry_kind}\0${e.counter_key}`)}if(!orderedUnique(keys))return{code:new Set(keys).size!==keys.length?'duplicate_set_member':'noncanonical_set_order',path:'/repair_ledger/entries'};if(!digestOk(v,'ledger_digest'))return{code:'invalid_cross_input_binding',path:'/repair_ledger/ledger_digest'};return undefined})

export const validateProgressionDecisionPortV1=(value:unknown)=>run<ProgressionDecisionPortV1>('progression_port',value,v=>{const p=exact(v,['progression_decision_port_version','source_result_kind','source_result_digest','projected_result','shadow_only','transport_invoked','port_digest'],'/progression_port');if(p)return p;if(v.progression_decision_port_version!==PROGRESSION_DECISION_PORT_V1_VERSION||!enumOf(['recommend_next_role','wait_for_protected_action','require_gate_status_update','invalidate_approval','stop','no_transition'],v.source_result_kind)||!sha(v.source_result_digest)||!object(v.projected_result)||v.shadow_only!==true||v.transport_invoked!==false)return{code:'invalid_type_or_format',path:'/progression_port'};const projected=validateProgressionEvaluatorResultV1(v.projected_result);if(projected.kind!=='accepted')return{code:'invalid_cross_input_binding',path:'/progression_port/projected_result'};if(projected.value.kind!==v.source_result_kind||!digestOk(v,'port_digest'))return{code:'invalid_cross_input_binding',path:'/progression_port'};return undefined})

const seal=<T extends JsonObject>(value:T,digestKey:string)=>({...value,[digestKey]:digest(value)}) as T
export const deriveFreshAuthoritySnapshotShadowV1=(value:Omit<FreshAuthoritySnapshotV1,'snapshot_digest'>)=>validateFreshAuthoritySnapshotV1(seal(value as JsonObject,'snapshot_digest'))
export const deriveAdmittedAuthorityBundleShadowV1=(value:Omit<AdmittedAuthorityBundleV1,'bundle_digest'>)=>validateAdmittedAuthorityBundleV1(seal(value as JsonObject,'bundle_digest'))
export const deriveDispatchIntentShadowV1=(value:Omit<DispatchIntentV1,'idempotency_key'|'intent_digest'>)=>{const idempotency_key=digest({task_id:value.task_id,assignment_revision:value.assignment_revision,decision_url:value.decision_url,predecessor_canonical_url:value.predecessor_canonical_url,route_binding:value.route_binding,branch:value.branch,worktree_identity:value.worktree_identity,pr_url_or_null:value.pr_url_or_null,head_sha_or_null:value.head_sha_or_null,scope_digest:value.scope_digest});return validateDispatchIntentV1(seal({...value,idempotency_key} as JsonObject,'intent_digest'))}
export const deriveCandidateAuthorityRefShadowV1=(value:Omit<CandidateAuthorityRefV1,'candidate_identity_digest'|'ref_digest'>)=>{const candidate_identity_digest=digest({task_id:value.task_id,repository:value.repository,base_sha:value.base_sha,working_head_sha:value.working_head_sha,ordered_repository_relative_paths:value.ordered_repository_relative_paths,aggregate_digest:value.aggregate_digest});return validateCandidateAuthorityRefV1(seal({...value,candidate_identity_digest} as JsonObject,'ref_digest'))}
export const deriveCompletionEvidenceCandidateShadowV1=(value:Omit<CompletionEvidenceCandidateV1,'candidate_digest'>)=>validateCompletionEvidenceCandidateV1(seal(value as unknown as JsonObject,'candidate_digest'))
const deriveGate=(value:Omit<GateProjectionIntentV1,'intent_digest'>)=>validateGateProjectionIntentV1(seal(value as unknown as JsonObject,'intent_digest'))
export const deriveGateProjectionIntentFromAgpShadowV1=deriveGate
export const deriveGateProjectionIntentFromCovShadowV1=deriveGate
export const deriveActionGuardProofShadowV1=(value:Omit<ActionGuardProofV1,'proof_digest'>,evaluationSnapshot:FreshAuthoritySnapshotV1)=>validateActionGuardProofV1(seal(value as unknown as JsonObject,'proof_digest'),evaluationSnapshot)
export const deriveRepairBudgetProfileShadowV1=(value:Omit<RepairBudgetProfileV1,'profile_digest'>)=>validateRepairBudgetProfileV1(seal(value as unknown as JsonObject,'profile_digest'))
export const deriveRepairAttemptLedgerShadowV1=(value:Omit<RepairAttemptLedgerV1,'ledger_digest'>)=>validateRepairAttemptLedgerV1(seal(value as unknown as JsonObject,'ledger_digest'))

const manifestEntryProblem=(value:unknown,index:number,priorPaths:string[],priorSliceDigest:string|null,priorCumulativeDigest:string|null):Problem|undefined=>{const path=`/manifest/slices/${index}`;let p=exact(value,['slice_id','ordinal','slice_candidate_url','added_paths','added_path_count','content_binding','prior_slice_digest_or_null','cumulative_paths_after_slice','slice_digest','cumulative_digest'],path);if(p)return p;const v=value as JsonObject;if(v.slice_id!==`M${index}`||v.ordinal!==index||!canonical(v.slice_candidate_url)||!Array.isArray(v.added_paths)||v.added_paths.length===0||!v.added_paths.every(posixPath)||new Set(v.added_paths).size!==v.added_paths.length||v.added_path_count!==v.added_paths.length||v.prior_slice_digest_or_null!==priorSliceDigest||!Array.isArray(v.cumulative_paths_after_slice)||!same(v.cumulative_paths_after_slice,[...priorPaths,...v.added_paths as string[]]))return{code:'invalid_conditional_matrix',path};if((v.added_paths as string[]).some(x=>priorPaths.includes(x)))return{code:'duplicate_set_member',path:`${path}/added_paths`};if(!object(v.content_binding))return{code:'invalid_type_or_format',path:`${path}/content_binding`};if(v.content_binding.kind==='path_byte_sha256'){p=exact(v.content_binding,['kind','path_bindings'],`${path}/content_binding`);if(p)return p;const bindings=(v.content_binding as JsonObject).path_bindings;if(!Array.isArray(bindings)||bindings.length!==v.added_paths.length)return{code:'invalid_conditional_matrix',path:`${path}/content_binding/path_bindings`};for(let i=0;i<bindings.length;i+=1){p=exact(bindings[i],['path','byte_sha256'],`${path}/content_binding/path_bindings/${i}`);if(p)return p;const b=bindings[i] as JsonObject;if(b.path!==(v.added_paths as unknown[])[i]||!sha(b.byte_sha256))return{code:'invalid_cross_input_binding',path:`${path}/content_binding/path_bindings/${i}`}}}else if(v.content_binding.kind==='approved_aggregate'){p=exact(v.content_binding,['kind','approval_record_url','ordered_paths_digest','aggregate_digest'],`${path}/content_binding`);if(p)return p;const b=v.content_binding as JsonObject;if(!canonical(b.approval_record_url)||!sha(b.ordered_paths_digest)||!sha(b.aggregate_digest)||b.ordered_paths_digest!==digest(v.added_paths))return{code:'invalid_cross_input_binding',path:`${path}/content_binding`}}else return{code:'invalid_enum',path:`${path}/content_binding/kind`};if(v.slice_digest!==digestWithout(v,'slice_digest','cumulative_digest'))return{code:'invalid_cross_input_binding',path:`${path}/slice_digest`};const expectedCumulative=digest({prior_cumulative_digest_or_null:priorCumulativeDigest,slice_digest:v.slice_digest,cumulative_paths_after_slice:v.cumulative_paths_after_slice});if(v.cumulative_digest!==expectedCumulative)return{code:'invalid_cross_input_binding',path:`${path}/cumulative_digest`};return undefined}

const m0Paths=['scripts/fixtures/continuous-orchestration-core-consolidation-m0-v1.json','scripts/test-continuous-orchestration-core-consolidation-m0.mjs'] as const
const m1Paths=['src/continuous-orchestration/shared-proof-interfaces-v1.ts','scripts/fixtures/continuous-orchestration-shared-proof-interfaces-v1.json','scripts/test-continuous-orchestration-shared-proof-interfaces.mjs'] as const
const m0Hashes=['0bb2903dabec3416657361fccf3984b697ee73fe7bf8c3c46bd51725dc854983','f13fabceee6571b9915f7a323b5fa1ced950bef026a07c199e88f7046675044d'] as const
const manifestProblem=(v:JsonObject):Problem|undefined=>{let p=exact(v,['schema_version','task_id','repository','authority_head_sha','branch','worktree_identity','manifest_mode','active_slice_id','active_slice_ordinal','m0_standalone_evidence','prior_manifest','slices','cumulative_paths','cumulative_path_count','manifest_digest'],'/manifest');if(p)return p;if(v.schema_version!==CUMULATIVE_SLICE_MANIFEST_V1_VERSION||v.task_id!=='AUDIT-CONTINUOUS-ORCHESTRATION-REFACTORING-001'||v.repository!=='whatrune/sd-prompt-studio'||!gitSha(v.authority_head_sha)||v.branch!=='codex/issue-221-core-consolidation'||v.worktree_identity!=='issue-221-core-consolidation'||!enumOf(['m1_bootstrap','successor'],v.manifest_mode)||!enumOf(['M0','M1','M2','M3','M4','M5','M6'],v.active_slice_id)||!uint(v.active_slice_ordinal)||!Array.isArray(v.slices)||!Array.isArray(v.cumulative_paths)||!v.cumulative_paths.every(posixPath)||v.cumulative_path_count!==v.cumulative_paths.length)return{code:'invalid_type_or_format',path:'/manifest'};const active=Number(String(v.active_slice_id).slice(1));if(v.active_slice_ordinal!==active||v.slices.length!==active+1)return{code:'invalid_conditional_matrix',path:'/manifest/active_slice_ordinal'};p=exact(v.m0_standalone_evidence,['semantics','candidate_url','completion_preflight_url','completion_result_url','validator_path','inventory_path','inventory_digest','exact_paths','path_count'],'/manifest/m0_standalone_evidence');if(p)return p;const m0=v.m0_standalone_evidence as JsonObject;if(m0.semantics!=='standalone_exact2_only'||!canonical(m0.candidate_url)||!canonical(m0.completion_preflight_url)||!canonical(m0.completion_result_url)||m0.validator_path!==m0Paths[1]||m0.inventory_path!==m0Paths[0]||m0.inventory_digest!=='977d7e213221a4a79322b1d67d20699f4b18e9b5b1769882385af6ab2561c635'||!Array.isArray(m0.exact_paths)||m0.exact_paths.length!==2||m0.path_count!==2)return{code:'invalid_cross_input_binding',path:'/manifest/m0_standalone_evidence'};for(let i=0;i<2;i+=1){p=exact(m0.exact_paths[i],['path','byte_sha256'],`/manifest/m0_standalone_evidence/exact_paths/${i}`);if(p)return p;const b=m0.exact_paths[i] as JsonObject;if(b.path!==m0Paths[i]||b.byte_sha256!==m0Hashes[i])return{code:'invalid_cross_input_binding',path:`/manifest/m0_standalone_evidence/exact_paths/${i}`}}if(!object(v.prior_manifest))return{code:'invalid_type_or_format',path:'/manifest/prior_manifest'};if(v.manifest_mode==='m1_bootstrap'){p=exact(v.prior_manifest,['state'],'/manifest/prior_manifest');if(p)return p;if((v.prior_manifest as JsonObject).state!=='none_m1_bootstrap'||active!==1)return{code:'invalid_conditional_matrix',path:'/manifest/prior_manifest'}}else{p=exact(v.prior_manifest,['state','canonical_record_url','manifest_digest'],'/manifest/prior_manifest');if(p)return p;const prior=v.prior_manifest as JsonObject;if(prior.state!=='bound'||!canonical(prior.canonical_record_url)||!sha(prior.manifest_digest)||active<2)return{code:'invalid_conditional_matrix',path:'/manifest/prior_manifest'}}let paths:string[]=[],priorSlice:string|null=null,priorCumulative:string|null=null;for(let i=0;i<v.slices.length;i+=1){p=manifestEntryProblem(v.slices[i],i,paths,priorSlice,priorCumulative);if(p)return p;const entry=v.slices[i] as JsonObject;paths=[...entry.cumulative_paths_after_slice as string[]];priorSlice=entry.slice_digest as string;priorCumulative=entry.cumulative_digest as string}if(!same(paths,v.cumulative_paths))return{code:'invalid_cross_input_binding',path:'/manifest/cumulative_paths'};if(v.manifest_mode==='m1_bootstrap'&&(!same((v.slices[0] as JsonObject).added_paths,m0Paths)||!same((v.slices[1] as JsonObject).added_paths,m1Paths)))return{code:'invalid_conditional_matrix',path:'/manifest/slices'};if(!digestOk(v,'manifest_digest'))return{code:'invalid_cross_input_binding',path:'/manifest/manifest_digest'};return undefined}
export const validateCumulativeSliceManifestV1=(value:unknown):ClosedAdmissionResultV1<AdmittedCumulativeSliceManifestV1>=>{const admitted=run<CumulativeSliceManifestV1>('cumulative_manifest',value,manifestProblem);if(admitted.kind!=='accepted')return admitted as ClosedAdmissionResultV1<AdmittedCumulativeSliceManifestV1>;return accepted({admission_version:'admitted_cumulative_slice_manifest_v1',admission_result:'accepted',manifest:admitted.value,admitted_manifest_digest:admitted.value.manifest_digest})}

const expectedIdentityProblem=(value:unknown,path='/expected_identity_binding'):Problem|undefined=>{let p=exact(value,['binding_version','authority_record_url','task_id','repository','authority_head_sha','logical_worktree_identity','branch','head_sha','worktree_path_binding_digest','git_dir_binding_digest','common_git_dir_binding_digest','identity_binding_digest'],path);if(p)return p;const e=value as JsonObject;if(e.binding_version!=='expected_worktree_identity_binding_v1'||!canonical(e.authority_record_url)||e.task_id!=='AUDIT-CONTINUOUS-ORCHESTRATION-REFACTORING-001'||e.repository!=='whatrune/sd-prompt-studio'||!gitSha(e.authority_head_sha)||e.logical_worktree_identity!=='issue-221-core-consolidation'||e.branch!=='codex/issue-221-core-consolidation'||!gitSha(e.head_sha)||![e.worktree_path_binding_digest,e.git_dir_binding_digest,e.common_git_dir_binding_digest,e.identity_binding_digest].every(sha))return{code:'invalid_type_or_format',path};if(e.identity_binding_digest!==digestWithout(e,'identity_binding_digest'))return{code:'invalid_cross_input_binding',path:`${path}/identity_binding_digest`};return undefined}
export const validateExpectedWorktreeIdentityBindingV1=(value:unknown):ClosedAdmissionResultV1<ExpectedWorktreeIdentityBindingV1>=>run<ExpectedWorktreeIdentityBindingV1>('expected_worktree_identity_binding',value,v=>expectedIdentityProblem(v))
const identityProblem=(value:unknown):Problem|undefined=>{let p=exact(value,['authority_head_sha','expected','observed'],'/observation/identity');if(p)return p;const v=value as JsonObject;p=expectedIdentityProblem(v.expected,'/observation/identity/expected');if(p)return p;p=exact(v.observed,['logical_worktree_identity','branch','head_sha','worktree_path_binding_digest','git_dir_binding_digest','common_git_dir_binding_digest'],'/observation/identity/observed');if(p)return p;const o=v.observed as JsonObject;if(!gitSha(v.authority_head_sha)||o.logical_worktree_identity!=='issue-221-core-consolidation'||o.branch!=='codex/issue-221-core-consolidation'||!gitSha(o.head_sha)||![o.worktree_path_binding_digest,o.git_dir_binding_digest,o.common_git_dir_binding_digest].every(sha))return{code:'invalid_type_or_format',path:'/observation/identity'};return undefined}
const observationProblem=(v:JsonObject):Problem|undefined=>{let p=exact(v,['observation_version','task_id','repository','collected_at','identity','base_slice_binding','current_observed_ordered_paths_order','current_observed_ordered_paths','current_observed_path_set_digest','content_proofs','staged_path_state','tracked_existing_delta','m0_standalone_use','observation_digest'],'/observation');if(p)return p;if(v.observation_version!==CUMULATIVE_COMPATIBILITY_OBSERVATION_V1_VERSION||v.task_id!=='AUDIT-CONTINUOUS-ORCHESTRATION-REFACTORING-001'||v.repository!=='whatrune/sd-prompt-studio'||!utc(v.collected_at)||v.current_observed_ordered_paths_order!=='repository_relative_posix_utf8_ascending_v1'||!orderedUnique(v.current_observed_ordered_paths,posixPath)||v.current_observed_path_set_digest!==digest(v.current_observed_ordered_paths)||!Array.isArray(v.content_proofs))return{code:'invalid_type_or_format',path:'/observation'};p=identityProblem(v.identity);if(p)return p;p=exact(v.base_slice_binding,['base_main_sha','manifest_record_url','manifest_digest','active_slice_id','active_slice_ordinal','slice_candidate_url','prior_manifest'],'/observation/base_slice_binding');if(p)return p;const b=v.base_slice_binding as JsonObject;if(!gitSha(b.base_main_sha)||!canonical(b.manifest_record_url)||!sha(b.manifest_digest)||!enumOf(['M0','M1','M2','M3','M4','M5','M6'],b.active_slice_id)||!uint(b.active_slice_ordinal)||!canonical(b.slice_candidate_url)||!object(b.prior_manifest))return{code:'invalid_type_or_format',path:'/observation/base_slice_binding'};const covered:string[]=[];for(let i=0;i<v.content_proofs.length;i+=1){const proof=v.content_proofs[i];if(!object(proof))return{code:'invalid_type_or_format',path:`/observation/content_proofs/${i}`};if(proof.kind==='path_byte_sha256'){p=exact(proof,['kind','path','byte_length','byte_sha256'],`/observation/content_proofs/${i}`);if(p)return p;if(!posixPath(proof.path)||!uint(proof.byte_length)||!sha(proof.byte_sha256))return{code:'invalid_type_or_format',path:`/observation/content_proofs/${i}`};covered.push(proof.path)}else if(proof.kind==='approved_aggregate'){p=exact(proof,['kind','approval_record_url','approval_content_projection_digest','ordered_paths','ordered_paths_digest','aggregate_digest'],`/observation/content_proofs/${i}`);if(p)return p;if(!canonical(proof.approval_record_url)||!sha(proof.approval_content_projection_digest)||!orderedUnique(proof.ordered_paths,posixPath)||!(proof.ordered_paths as unknown[]).length||proof.ordered_paths_digest!==digest(proof.ordered_paths)||!sha(proof.aggregate_digest))return{code:'invalid_cross_input_binding',path:`/observation/content_proofs/${i}`};covered.push(...proof.ordered_paths as string[])}else return{code:'invalid_enum',path:`/observation/content_proofs/${i}/kind`}}const sortedCovered=[...covered].sort(utf8Compare);if(new Set(covered).size!==covered.length)return{code:'duplicate_set_member',path:'/observation/content_proofs'};if(!same(sortedCovered,v.current_observed_ordered_paths))return{code:'invalid_cross_input_binding',path:'/observation/content_proofs'};p=exact(v.staged_path_state,['state','ordered_paths','ordered_paths_digest'],'/observation/staged_path_state');if(p)return p;const staged=v.staged_path_state as JsonObject;if(!enumOf(['none','present'],staged.state)||!orderedUnique(staged.ordered_paths,posixPath)||staged.ordered_paths_digest!==digest(staged.ordered_paths)||(staged.state==='none')!==(Array.isArray(staged.ordered_paths)&&staged.ordered_paths.length===0))return{code:'invalid_conditional_matrix',path:'/observation/staged_path_state'};p=exact(v.tracked_existing_delta,['state','base_head_sha','ordered_paths','path_deltas','delta_digest'],'/observation/tracked_existing_delta');if(p)return p;const tracked=v.tracked_existing_delta as JsonObject;if(!enumOf(['none','present'],tracked.state)||!gitSha(tracked.base_head_sha)||!orderedUnique(tracked.ordered_paths,posixPath)||!Array.isArray(tracked.path_deltas)||tracked.path_deltas.length!==(tracked.ordered_paths as unknown[]).length)return{code:'invalid_conditional_matrix',path:'/observation/tracked_existing_delta'};for(let i=0;i<tracked.path_deltas.length;i+=1){p=exact(tracked.path_deltas[i],['path','base_byte_sha256','observed_byte_sha256'],`/observation/tracked_existing_delta/path_deltas/${i}`);if(p)return p;const d=tracked.path_deltas[i] as JsonObject;if(d.path!==(tracked.ordered_paths as unknown[])[i]||!sha(d.base_byte_sha256)||!sha(d.observed_byte_sha256))return{code:'invalid_cross_input_binding',path:`/observation/tracked_existing_delta/path_deltas/${i}`}}if(tracked.delta_digest!==digest({base_head_sha:tracked.base_head_sha,ordered_paths:tracked.ordered_paths,path_deltas:tracked.path_deltas}))return{code:'invalid_cross_input_binding',path:'/observation/tracked_existing_delta/delta_digest'};if(!object(v.m0_standalone_use))return{code:'invalid_type_or_format',path:'/observation/m0_standalone_use'};const m0=v.m0_standalone_use as JsonObject;if(m0.state==='compliant'){p=exact(m0,['state','proof_mode','result_record_url','validator_path','inventory_digest','exact_ordered_paths','observed_path_count','cumulative_validator_mode'],'/observation/m0_standalone_use');if(p)return p;if(!enumOf(['canonical_historical_pass','isolated_exact2_rerun'],m0.proof_mode)||!canonical(m0.result_record_url)||m0.validator_path!==m0Paths[1]||m0.inventory_digest!=='977d7e213221a4a79322b1d67d20699f4b18e9b5b1769882385af6ab2561c635'||!same(m0.exact_ordered_paths,m0Paths)||m0.observed_path_count!==2||m0.cumulative_validator_mode!=='cumulative_manifest_v1')return{code:'invalid_cross_input_binding',path:'/observation/m0_standalone_use'}}else if(m0.state==='m0_applied_to_cumulative'){p=exact(m0,['state','validator_path','observed_ordered_paths','observed_path_count','cumulative_validator_mode'],'/observation/m0_standalone_use');if(p)return p;if(m0.validator_path!==m0Paths[1]||!Array.isArray(m0.observed_ordered_paths)||m0.observed_ordered_paths.length<3||m0.observed_path_count!==(m0.observed_ordered_paths as unknown[]).length||m0.cumulative_validator_mode!=='m0_standalone_misapplied')return{code:'invalid_conditional_matrix',path:'/observation/m0_standalone_use'}}else return{code:'invalid_enum',path:'/observation/m0_standalone_use/state'};if(!digestOk(v,'observation_digest'))return{code:'invalid_cross_input_binding',path:'/observation/observation_digest'};return undefined}
const priorObservationProblem=(v:JsonObject):Problem|undefined=>{const b=v.base_slice_binding as JsonObject,prior=b.prior_manifest as JsonObject;let p:Problem|undefined;if(prior.state==='none_m1_bootstrap'){p=exact(prior,['state'],'/observation/base_slice_binding/prior_manifest');if(p)return p;if(b.active_slice_ordinal!==1)return{code:'invalid_conditional_matrix',path:'/observation/base_slice_binding/prior_manifest'}}else if(prior.state==='bound'){p=exact(prior,['state','canonical_record_url','manifest_digest','prior_slice_count','prior_slice_entries_digest'],'/observation/base_slice_binding/prior_manifest');if(p)return p;if(!canonical(prior.canonical_record_url)||!sha(prior.manifest_digest)||!uint(prior.prior_slice_count)||!sha(prior.prior_slice_entries_digest)||Number(b.active_slice_ordinal)<2)return{code:'invalid_conditional_matrix',path:'/observation/base_slice_binding/prior_manifest'}}else return{code:'invalid_enum',path:'/observation/base_slice_binding/prior_manifest/state'};return undefined}
export const validateCumulativeCompatibilityObservationV1=(value:unknown):ClosedAdmissionResultV1<AdmittedCumulativeCompatibilityObservationV1>=>{const admitted=run<CumulativeCompatibilityObservationV1>('cumulative_observation',value,v=>observationProblem(v)??priorObservationProblem(v));if(admitted.kind!=='accepted')return admitted as ClosedAdmissionResultV1<AdmittedCumulativeCompatibilityObservationV1>;return accepted({admission_version:'admitted_cumulative_compatibility_observation_v1',admission_result:'accepted',observation:admitted.value,admitted_observation_digest:admitted.value.observation_digest})}

const evidence=(pointer:CumulativeCompatibilityEvidencePointerV1,detail:CumulativeCompatibilityEvidenceDetailV1,path:string|null=null,expected:string|null=null,observed:string|null=null):SanitizedCompatibilityEvidenceV1=>freeze({pointer,detail,repository_relative_path_or_null:path,expected_digest_or_null:sha(expected)?expected:null,observed_digest_or_null:sha(observed)?observed:null})
type GenericNegativeIdV1=Exclude<CumulativeCompatibilityNegativeIdV1,'B-221-M1-COMPAT-01-N16'>
const incompatible=(negative_id:GenericNegativeIdV1,m:AdmittedCumulativeSliceManifestV1,o:AdmittedCumulativeCompatibilityObservationV1,e:SanitizedCompatibilityEvidenceV1|PriorSlicePathByteDriftEvidenceV1):CumulativeCompatibilityEvaluationResultV1=>freeze({result_version:CUMULATIVE_COMPATIBILITY_EVALUATION_RESULT_V1_VERSION,kind:'incompatible',negative_id,manifest_digest:m.admitted_manifest_digest,observation_digest:o.admitted_observation_digest,evidence:e,state_changed:false,transport_invoked:false})
const pathBindingDigest=(entry:CumulativeSliceEntryV1,index:number,binding:PathByteBindingV1):Sha256=>digest({slice_id:entry.slice_id,ordinal:entry.ordinal,target_slice_digest:entry.slice_digest,path_binding_index:index,path:binding.path,byte_sha256:binding.byte_sha256})
const driftEvidence=(tuples:readonly PathByteDriftTupleV1[],manifest:CumulativeSliceManifestV1,relation:'active'|'prior'):ActiveSlicePathByteDriftEvidenceV1|PriorSlicePathByteDriftEvidenceV1=>{
  const selected=tuples[0],target=manifest.slices[selected.target_slice_ordinal]
  const base={
    pointer:relation==='active'?'manifest.active_slice_path_byte_binding' as const:'manifest.prior_slice_path_byte_binding' as const,
    detail:relation==='active'?'active_slice_path_byte_drift' as const:'prior_slice_path_byte_drift' as const,
    target_slice:{slice_id:selected.target_slice_id,ordinal:selected.target_slice_ordinal,relation_to_active:relation},
    repository_relative_path:selected.repository_relative_path,
    expected_byte_sha256:selected.expected_byte_sha256,
    observed_byte_sha256:selected.observed_byte_sha256,
    cumulative_manifest_binding:{manifest_digest:manifest.manifest_digest,target_slice_digest:target.slice_digest,content_binding_kind:'path_byte_sha256' as const,path_binding_index:selected.path_binding_index,path_binding_digest:selected.path_binding_digest},
    drift_count:tuples.length,
    drift_set_digest:digest(tuples),
  }
  return freeze({...base,evidence_digest:digest(base)}) as ActiveSlicePathByteDriftEvidenceV1|PriorSlicePathByteDriftEvidenceV1
}
const activeDriftIncompatible=(m:AdmittedCumulativeSliceManifestV1,o:AdmittedCumulativeCompatibilityObservationV1,e:ActiveSlicePathByteDriftEvidenceV1):CumulativeCompatibilityEvaluationResultV1=>freeze({result_version:CUMULATIVE_COMPATIBILITY_EVALUATION_RESULT_V1_VERSION,kind:'incompatible',negative_id:'B-221-M1-COMPAT-01-N16',negative_literal:'active_slice_path_byte_drift',manifest_digest:m.admitted_manifest_digest,observation_digest:o.admitted_observation_digest,evidence:e,state_changed:false,transport_invoked:false})

export function evaluateCumulativeCompatibilityV1(m:AdmittedCumulativeSliceManifestV1,o:AdmittedCumulativeCompatibilityObservationV1):CumulativeCompatibilityEvaluationResultV1{
  try{
    if(m.admission_version!=='admitted_cumulative_slice_manifest_v1'||m.admission_result!=='accepted'||m.admitted_manifest_digest!==m.manifest.manifest_digest||o.admission_version!=='admitted_cumulative_compatibility_observation_v1'||o.admission_result!=='accepted'||o.admitted_observation_digest!==o.observation.observation_digest)return incompatible('B-221-M1-COMPAT-01-N11',m,o,evidence('manifest.root_digest','manifest_digest_mismatch'))
    const manifest=m.manifest,observation=o.observation,id=observation.identity,expected=id.expected,observed=id.observed
    if(id.authority_head_sha!==manifest.authority_head_sha||expected.authority_head_sha!==manifest.authority_head_sha)return incompatible('B-221-M1-COMPAT-01-N13',m,o,evidence('identity.head_sha','head_mismatch'))
    if(expected.logical_worktree_identity!==manifest.worktree_identity||observed.logical_worktree_identity!==expected.logical_worktree_identity)return incompatible('B-221-M1-COMPAT-01-N13',m,o,evidence('identity.logical_worktree_identity','logical_identity_mismatch'))
    if(expected.branch!==manifest.branch||observed.branch!==expected.branch)return incompatible('B-221-M1-COMPAT-01-N13',m,o,evidence('identity.branch','branch_mismatch'))
    if(expected.head_sha!==manifest.authority_head_sha||observed.head_sha!==expected.head_sha)return incompatible('B-221-M1-COMPAT-01-N13',m,o,evidence('identity.head_sha','head_mismatch'))
    if(observed.worktree_path_binding_digest!==expected.worktree_path_binding_digest)return incompatible('B-221-M1-COMPAT-01-N13',m,o,evidence('identity.worktree_path_binding_digest','worktree_path_binding_mismatch',null,expected.worktree_path_binding_digest,observed.worktree_path_binding_digest))
    if(observed.git_dir_binding_digest!==expected.git_dir_binding_digest)return incompatible('B-221-M1-COMPAT-01-N13',m,o,evidence('identity.git_dir_binding_digest','git_dir_binding_mismatch',null,expected.git_dir_binding_digest,observed.git_dir_binding_digest))
    if(observed.common_git_dir_binding_digest!==expected.common_git_dir_binding_digest)return incompatible('B-221-M1-COMPAT-01-N13',m,o,evidence('identity.common_git_dir_binding_digest','common_git_dir_binding_mismatch',null,expected.common_git_dir_binding_digest,observed.common_git_dir_binding_digest))
    if(expected.identity_binding_digest!==digestWithout(expected as unknown as JsonObject,'identity_binding_digest'))return incompatible('B-221-M1-COMPAT-01-N13',m,o,evidence('identity.worktree_path_binding_digest','alias_binding_mismatch'))
    if(observation.staged_path_state.state==='present')return incompatible('B-221-M1-COMPAT-01-N14',m,o,evidence('workspace.staged_state','staged_state_present'))
    if(observation.tracked_existing_delta.state==='present'||observation.tracked_existing_delta.base_head_sha!==observation.base_slice_binding.base_main_sha)return incompatible('B-221-M1-COMPAT-01-N14',m,o,evidence('workspace.tracked_existing_delta','tracked_existing_delta_present'))
    if(observation.m0_standalone_use.state!=='compliant')return incompatible('B-221-M1-COMPAT-01-N15',m,o,evidence('validation.m0_standalone_use','m0_validator_scope_mismatch'))
    if(manifest.manifest_digest!==digestWithout(manifest as unknown as JsonObject,'manifest_digest'))return incompatible('B-221-M1-COMPAT-01-N11',m,o,evidence('manifest.root_digest','manifest_digest_mismatch'))
    const manifestPaths=manifest.cumulative_paths,observedPaths=observation.current_observed_ordered_paths
    if(manifestPaths.length!==new Set(manifestPaths).size)return incompatible('B-221-M1-COMPAT-01-N05',m,o,evidence('manifest.duplicate_membership','duplicate_repository_relative_path'))
    for(const entry of manifest.slices){
      const sd=digestWithout(entry as unknown as JsonObject,'slice_digest','cumulative_digest')
      if(entry.slice_digest!==sd)return incompatible('B-221-M1-COMPAT-01-N09',m,o,evidence('manifest.slice_digest','slice_digest_mismatch'))
      const prior=entry.ordinal===0?null:manifest.slices[entry.ordinal-1].cumulative_digest
      const cd=digest({prior_cumulative_digest_or_null:prior,slice_digest:entry.slice_digest,cumulative_paths_after_slice:entry.cumulative_paths_after_slice})
      if(entry.cumulative_digest!==cd)return incompatible('B-221-M1-COMPAT-01-N10',m,o,evidence('manifest.cumulative_digest','cumulative_digest_mismatch'))
    }
    const missing=manifestPaths.find(path=>!observedPaths.includes(path))
    if(missing)return incompatible('B-221-M1-COMPAT-01-N02',m,o,evidence('manifest.current_membership','missing_repository_relative_path',missing))
    const extra=observedPaths.find(path=>!manifestPaths.includes(path))
    if(extra)return incompatible('B-221-M1-COMPAT-01-N03',m,o,evidence('manifest.current_membership','extra_repository_relative_path',extra))
    if(!same([...observedPaths].sort(utf8Compare),observedPaths))return incompatible('B-221-M1-COMPAT-01-N04',m,o,evidence('manifest.declared_order','declared_order_mismatch'))
    const proofByPath=new Map<string,ObservedPathByteProofV1>()
    for(const proof of observation.content_proofs)if(proof.kind==='path_byte_sha256')proofByPath.set(proof.path,proof)
    for(const binding of manifest.m0_standalone_evidence.exact_paths){
      const proof=proofByPath.get(binding.path)
      if(!proof||proof.byte_sha256!==binding.byte_sha256)return incompatible('B-221-M1-COMPAT-01-N01',m,o,evidence('manifest.m0_byte_binding','byte_digest_mismatch',binding.path,binding.byte_sha256,proof?.byte_sha256??null))
    }
    const observedBase=observation.base_slice_binding
    if(observedBase.manifest_digest!==manifest.manifest_digest)return incompatible('B-221-M1-COMPAT-01-N11',m,o,evidence('manifest.root_digest','manifest_digest_mismatch',null,manifest.manifest_digest,observedBase.manifest_digest))
    if(observedBase.active_slice_id!==manifest.active_slice_id||observedBase.active_slice_ordinal!==manifest.active_slice_ordinal||observedBase.slice_candidate_url!==manifest.slices[manifest.active_slice_ordinal].slice_candidate_url)return incompatible('B-221-M1-COMPAT-01-N06',m,o,evidence('manifest.prior_entry_binding','prior_entry_digest_mismatch'))
    if(manifest.manifest_mode==='successor'){
      const manifestPrior=manifest.prior_manifest,observedPrior=observedBase.prior_manifest
      const expectedEntriesDigest=digest(manifest.slices.slice(0,manifest.active_slice_ordinal))
      if(manifestPrior.state!=='bound'||observedPrior.state!=='bound'||observedPrior.canonical_record_url!==manifestPrior.canonical_record_url||observedPrior.manifest_digest!==manifestPrior.manifest_digest||observedPrior.prior_slice_count!==manifest.active_slice_ordinal||observedPrior.prior_slice_entries_digest!==expectedEntriesDigest)return incompatible('B-221-M1-COMPAT-01-N06',m,o,evidence('manifest.prior_entry_binding','prior_entry_digest_mismatch',null,manifestPrior.state==='bound'?manifestPrior.manifest_digest:null,observedPrior.state==='bound'?observedPrior.manifest_digest:null))
    }else if(observedBase.prior_manifest.state!=='none_m1_bootstrap')return incompatible('B-221-M1-COMPAT-01-N06',m,o,evidence('manifest.prior_entry_binding','prior_entry_digest_mismatch'))
    const priorDrifts:PathByteDriftTupleV1[]=[],activeDrifts:PathByteDriftTupleV1[]=[]
    let missingIndividualProof:string|null=null
    for(const entry of manifest.slices){
      if(entry.ordinal===0||entry.content_binding.kind!=='path_byte_sha256')continue
      for(let index=0;index<entry.content_binding.path_bindings.length;index+=1){
        const binding=entry.content_binding.path_bindings[index],proof=proofByPath.get(binding.path)
        if(!proof){missingIndividualProof??=binding.path;continue}
        if(proof.byte_sha256!==binding.byte_sha256){
          const tuple:PathByteDriftTupleV1={target_slice_id:entry.slice_id,target_slice_ordinal:entry.ordinal,path_binding_index:index,repository_relative_path:binding.path,expected_byte_sha256:binding.byte_sha256,observed_byte_sha256:proof.byte_sha256,path_binding_digest:pathBindingDigest(entry,index,binding)}
          ;(entry.ordinal===manifest.active_slice_ordinal?activeDrifts:priorDrifts).push(tuple)
        }
      }
    }
    if(priorDrifts.length)return incompatible('B-221-M1-COMPAT-01-N06',m,o,driftEvidence(priorDrifts,manifest,'prior') as PriorSlicePathByteDriftEvidenceV1)
    if(activeDrifts.length)return activeDriftIncompatible(m,o,driftEvidence(activeDrifts,manifest,'active') as ActiveSlicePathByteDriftEvidenceV1)
    if(missingIndividualProof)return incompatible('B-221-M1-COMPAT-01-N12',m,o,evidence('manifest.aggregate_approval','aggregate_approval_mismatch',missingIndividualProof))
    return freeze({result_version:CUMULATIVE_COMPATIBILITY_EVALUATION_RESULT_V1_VERSION,kind:'compatible',active_slice_id:manifest.active_slice_id,manifest_digest:m.admitted_manifest_digest,observation_digest:o.admitted_observation_digest,verified_path_count:manifestPaths.length,positive_ids:['B-221-M1-COMPAT-01-P01','B-221-M1-COMPAT-01-P02'],state_changed:false,transport_invoked:false})
  }catch{
    return freeze({result_version:CUMULATIVE_COMPATIBILITY_EVALUATION_RESULT_V1_VERSION,kind:'failed',failure:{code:'cumulative_compatibility_internal_failure',stage:'evaluation',diagnostic_id:digest({stage:'evaluation',manifest_digest:m?.admitted_manifest_digest??null,observation_digest:o?.admitted_observation_digest??null}),safe_message:'cumulative compatibility evaluation failed'},state_changed:false,transport_invoked:false})
  }
}

export const validateCumulativeCompatibilityEvaluationResultV1=(value:unknown,m:AdmittedCumulativeSliceManifestV1,o:AdmittedCumulativeCompatibilityObservationV1):ClosedAdmissionResultV1<CumulativeCompatibilityEvaluationResultV1>=>{
  try{
    if(!object(value))return rejected({code:'invalid_type_or_format',path:'/evaluation_result'})
    const expected=evaluateCumulativeCompatibilityV1(m,o)
    if(!same(value,expected))return rejected({code:'invalid_cross_input_binding',path:'/evaluation_result'})
    return accepted(value as unknown as CumulativeCompatibilityEvaluationResultV1)
  }catch{return failed('cumulative_compatibility_evaluation_result')}
}
