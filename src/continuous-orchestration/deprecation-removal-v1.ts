import { digestContinuousOrchestrationJsonV1 as digest } from './index'
import {
  validateAdmittedAuthorityBundleV1,
  type AdmittedAuthorityBundleV1,
} from './shared-proof-interfaces-v1'

export const DEPRECATION_REMOVAL_INPUT_V1_VERSION = 'deprecation_removal_input_v1' as const
export const DEPRECATION_REMOVAL_PROFILE_V1_VERSION = 'deprecation_removal_profile_v1' as const
export const DEPRECATION_REMOVAL_RESULT_V1_VERSION = 'deprecation_removal_result_v1' as const
export const DEPRECATION_CONSUMER_ZERO_PROOF_V1_VERSION = 'deprecation_consumer_zero_proof_v1' as const
export const DEPRECATION_REPLACEMENT_COMPLETION_V1_VERSION = 'deprecation_replacement_completion_v1' as const
export const DEPRECATION_TERMINAL_GRAPH_V1_VERSION = 'deprecation_terminal_graph_v1' as const
export const DEPRECATION_TERMINAL_MANIFEST_V1_VERSION = 'deprecation_terminal_manifest_v1' as const
export const DEPRECATION_REPOSITORY_CONSUMER_SCAN_V1_VERSION = 'deprecation_repository_consumer_scan_v1' as const
export const DEPRECATION_EXECUTABLE_TRACE_V1_VERSION = 'deprecation_executable_trace_v1' as const
export const DEPRECATION_SEMANTIC_CONSUMER_GRAPH_V1_VERSION = 'deprecation_semantic_consumer_graph_v1' as const
export const M6_SEMANTIC_GRAPH_AUTHORITY_REVISION = 1 as const
export const M6_EXPECTED_M5_MANIFEST_DIGEST = '9b81f8d88eff42fc6246c4b618abd101f5a925b3abb4383d6d47cc0782887b39' as const
export const M6_EXPECTED_M5_CUMULATIVE_DIGEST = '957f4da0614d3a0a97c971029fceef43bab8bf72b70d96f22407d7fcf3393383' as const
export const M6_CANONICAL_EMPTY_CONSUMER_SET_DIGEST = digest([])
export const M6_TASK_ID = 'AUDIT-CONTINUOUS-ORCHESTRATION-REFACTORING-001' as const
export const M6_REPOSITORY = 'whatrune/sd-prompt-studio' as const
export const M6_BRANCH = 'codex/issue-221-core-consolidation' as const
export const M6_WORKTREE_IDENTITY = 'issue-221-core-consolidation' as const
export const M6_AUTHORITY_HEAD = 'b7d1013052514aacddb559cc4f24af5e33c08b96' as const
export const M6_ASSIGNMENT_REVISION = 3 as const
export const M6_ALLOWED_SCOPE_DIGEST = digest({task_id:M6_TASK_ID,slice_id:'M6',allowed_finding_ids:['B-221-M6-IIR-04']})
export const M6_DISPATCH_URL = 'https://github.com/whatrune/sd-prompt-studio/issues/221#issuecomment-5151311161' as const
export const M6_DISPATCH_BODY_SHA256 = '56fcb460bf78654f9c19570ae8dacc01cb13787be3045ac44211b112463a98d9' as const
export const M6_CANDIDATE_URL = 'https://github.com/whatrune/sd-prompt-studio/issues/221#issuecomment-5150828856' as const
export const M6_REPOSITORY_SCAN_PATH_COUNT = 546 as const
export const M6_REPOSITORY_SCAN_MANIFEST_DIGEST = 'd380c62111bda5ac661f478001e16c5984a88d6bb8f65736c0edc52281b00e59' as const
export const M6_SEMANTIC_REPOSITORY_PATH_COUNT = 546 as const
export const M6_SEMANTIC_REPOSITORY_PATH_SET_DIGEST = 'd380c62111bda5ac661f478001e16c5984a88d6bb8f65736c0edc52281b00e59' as const
export const M6_SEMANTIC_SOURCE_PATH_COUNT = 118 as const
export const M6_SEMANTIC_SOURCE_PATH_SET_DIGEST = 'b76b88cec4fa4f46b3975611b021ba94d70f05c0b41527eac99a28ab3f090521' as const
export const M6_SEMANTIC_EXCLUDED_PATH_COUNT = 428 as const
export const M6_SEMANTIC_EXCLUDED_PATH_SET_DIGEST = '46f8d1e3cb23afe2304d1522a4f96c2c7dd88b8d800363b4fdf1e80780b6f65c' as const

type JsonObject = Record<string, unknown>
type Sha256 = string
type FullGitSha = string
type CandidateId = 'RA-01'|'RA-02'|'RA-03'|'RA-04'|'RA-05'|'RA-06'|'RA-07'|'RA-08'
type OwnerClass = 'normative_semantic_owner'|'admission_owner'|'pure_decision_owner'|'projection_transport_owner'|'protected_executor'
type RejectionCode = 'unknown_field'|'missing_required_field'|'invalid_type_or_format'|'invalid_enum'|'duplicate_set_member'|'noncanonical_set_order'|'invalid_digest'|'invalid_cross_input_binding'
type Problem = Readonly<{code: RejectionCode; path: string}>

export interface DeprecationCandidateV1 {
  readonly candidate_id: CandidateId
  readonly deprecated_claim_digest: Sha256
  readonly replacement_owner: string
  readonly replacement_path: string
  readonly replacement_authority_digest: Sha256
  readonly replacement_owner_class: OwnerClass
  readonly required_completion_slice_ids: readonly ('M1'|'M2'|'M3'|'M4'|'M5')[]
  readonly candidate_digest: Sha256
}

export interface DeprecationRemovalProfileV1 {
  readonly profile_version: typeof DEPRECATION_REMOVAL_PROFILE_V1_VERSION
  readonly feature_id: 'deprecation_removal'
  readonly mode: 'terminal_evidence_only'
  readonly task_id: string
  readonly repository: string
  readonly assignment_revision: number
  readonly allowed_scope_digest: Sha256
  readonly expected_branch: typeof M6_BRANCH
  readonly expected_worktree_identity: typeof M6_WORKTREE_IDENTITY
  readonly expected_head_sha: typeof M6_AUTHORITY_HEAD
  readonly expected_current_main_sha: typeof M6_AUTHORITY_HEAD
  readonly authority_record_url: string
  readonly expected_m5_manifest_digest: typeof M6_EXPECTED_M5_MANIFEST_DIGEST
  readonly expected_m5_cumulative_digest: typeof M6_EXPECTED_M5_CUMULATIVE_DIGEST
  readonly profile_digest: Sha256
}

export interface DeprecationTerminalGraphV1 {
  readonly graph_version: typeof DEPRECATION_TERMINAL_GRAPH_V1_VERSION
  readonly observed_head_sha: FullGitSha
  readonly covered_surfaces: readonly string[]
  readonly owners: readonly Readonly<{owner_class: OwnerClass; owner_id: string; owned_item_ids: readonly string[]}>[]
  readonly edges: readonly Readonly<{from_owner_id: string; to_owner_id: string; edge_class: 'admission'|'decision'|'projection'|'execution'}>[]
  readonly active_deprecated_candidate_ids: readonly CandidateId[]
  readonly owner_conflict_count: number
  readonly owner_cycle_count: number
  readonly graph_digest: Sha256
}

export interface DeprecationConsumerZeroProofV1 {
  readonly proof_version: typeof DEPRECATION_CONSUMER_ZERO_PROOF_V1_VERSION
  readonly candidate_id: CandidateId
  readonly deprecated_claim_digest: Sha256
  readonly surface_observations: readonly Readonly<{surface_class:string;ordered_repository_relative_paths:readonly string[];ordered_consumer_identities:readonly string[]}>[]
  readonly semantic_consumer_graph: DeprecationSemanticConsumerGraphV1
  readonly repository_scan: Readonly<{scan_version:typeof DEPRECATION_REPOSITORY_CONSUMER_SCAN_V1_VERSION;collector_id:'m6_repository_consumer_scan_v1';authority_head_sha:typeof M6_AUTHORITY_HEAD;excluded_evidence_paths:readonly string[];scanned_path_count:number;scan_manifest_digest:Sha256;semantic_graph_digest:Sha256;ordered_consumer_identities:readonly string[];consumer_count:number;consumer_set_digest:Sha256;scan_result_digest:Sha256}>
  readonly executable_trace: Readonly<{trace_version:typeof DEPRECATION_EXECUTABLE_TRACE_V1_VERSION;trace_id:Sha256;candidate_id:CandidateId;collector_id:'m6_repository_consumer_scan_v1';claim_digest:Sha256;scan_manifest_digest:Sha256;semantic_graph_digest:Sha256;scan_result_digest:Sha256;observed_consumer_set_digest:Sha256;observed_consumer_count:number;executed_path_count:number;exit_code:0;trace_digest:Sha256}>
  readonly ordered_consumer_identities: readonly string[]
  readonly consumer_count: number
  readonly consumer_set_digest: Sha256
  readonly replacement_authority_digest: Sha256
  readonly replacement_completion_evidence_digest: Sha256
  readonly authority_head_sha: FullGitSha
  readonly candidate_aggregate_digest: Sha256
  readonly observed_graph_digest: Sha256
  readonly proof_digest: Sha256
}

export interface DeprecationSemanticConsumerSiteV1 {
  readonly repository_relative_path: string
  readonly node_kind: 'direct_reference'|'direct_import'|'alias_import'|'re_export'|'dynamic_access'|'self_reference'
  readonly symbol_name: string
  readonly local_name: string|null
  readonly module_specifier: string|null
  readonly site_identity: string
}

export interface DeprecationSemanticConsumerGraphV1 {
  readonly graph_version: typeof DEPRECATION_SEMANTIC_CONSUMER_GRAPH_V1_VERSION
  readonly authority_revision: typeof M6_SEMANTIC_GRAPH_AUTHORITY_REVISION
  readonly candidate_id: CandidateId
  readonly canonical_claim_identity: string
  readonly definition_site: Readonly<{repository_relative_path:'src/continuous-orchestration/deprecation-removal-v1.ts';declaration_symbol:'CLAIM_IDENTITIES';property_key:CandidateId;site_identity:string}>
  readonly direct_import_or_reference: readonly DeprecationSemanticConsumerSiteV1[]
  readonly alias_import: readonly DeprecationSemanticConsumerSiteV1[]
  readonly re_export: readonly DeprecationSemanticConsumerSiteV1[]
  readonly dynamic_access: readonly DeprecationSemanticConsumerSiteV1[]
  readonly self_reference_sites: readonly DeprecationSemanticConsumerSiteV1[]
  readonly scanned_repository_scope: Readonly<{scope_mode:'all_repository_paths';authority_head_sha:typeof M6_AUTHORITY_HEAD;repository_path_count:typeof M6_SEMANTIC_REPOSITORY_PATH_COUNT;repository_path_set_digest:typeof M6_SEMANTIC_REPOSITORY_PATH_SET_DIGEST;semantic_source_path_count:typeof M6_SEMANTIC_SOURCE_PATH_COUNT;semantic_source_path_set_digest:typeof M6_SEMANTIC_SOURCE_PATH_SET_DIGEST;definition_target_included:true}>
  readonly excluded_scope_and_reason: readonly Readonly<{scope_class:'non_ecmascript_artifact';reason:'not_a_semantic_source_unit';path_count:typeof M6_SEMANTIC_EXCLUDED_PATH_COUNT;path_set_digest:typeof M6_SEMANTIC_EXCLUDED_PATH_SET_DIGEST}>[]
  readonly missing_scan_targets: readonly string[]
  readonly unknown_nodes: readonly string[]
  readonly unresolved_imports: readonly string[]
  readonly indeterminate_dynamic_access: readonly string[]
  readonly ordered_external_consumer_identities: readonly string[]
  readonly consumer_count: number
  readonly aggregate_proof_digest: Sha256
}

export interface DeprecationReplacementCompletionV1 {
  readonly completion_version: typeof DEPRECATION_REPLACEMENT_COMPLETION_V1_VERSION
  readonly candidate_id: CandidateId
  readonly replacement_owner: string
  readonly replacement_path: string
  readonly authority_head_sha: FullGitSha
  readonly predecessor_manifest_digest: Sha256
  readonly implementation_review: 'PASS'|'NOT_PASS'
  readonly executable_contract_validation: 'PASS'|'NOT_PASS'
  readonly completion_preflight: 'PASS'|'NOT_PASS'
  readonly compatibility: 'PASS'|'NOT_PASS'
  readonly blocking_finding_count: number
  readonly owner_boundary_unchanged: boolean
  readonly safety_boundary_unchanged: boolean
  readonly replacement_active: boolean
  readonly authority_records: readonly Readonly<{slice_id:'M1'|'M2'|'M3'|'M4'|'M5';implementation_review_url:string;implementation_review_body_sha256:Sha256;implementation_review_decision:'APPROVE';executable_contract_validation_url:string;executable_contract_validation_body_sha256:Sha256;executable_contract_validation_result:'PASS';completion_preflight_url:string;completion_preflight_body_sha256:Sha256;completion_preflight_result:'PASS'}>[]
  readonly completion_digest: Sha256
}

export interface DeprecationTerminalManifestBindingV1 {
  readonly manifest_version: typeof DEPRECATION_TERMINAL_MANIFEST_V1_VERSION
  readonly prior_manifest_digest: typeof M6_EXPECTED_M5_MANIFEST_DIGEST
  readonly prior_cumulative_digest: typeof M6_EXPECTED_M5_CUMULATIVE_DIGEST
  readonly prior_slice_count: 6
  readonly manifest_mode: 'successor'
  readonly active_slice_id: 'M6'
  readonly active_slice_ordinal: 6
  readonly predecessor_paths: readonly string[]
  readonly predecessor_path_bindings: readonly Readonly<{path:string;sha256:Sha256}>[]
  readonly added_paths: readonly string[]
  readonly ordered_cumulative_paths: readonly string[]
  readonly added_path_count: 3
  readonly result_path_count: 20
  readonly terminal_migration_state: 'terminal_candidate'
  readonly successor_slice_allowed: false
  readonly manifest_binding_digest: Sha256
}

export interface DeprecationRemovalInputV1 {
  readonly input_version: typeof DEPRECATION_REMOVAL_INPUT_V1_VERSION
  readonly task_id: string
  readonly repository: string
  readonly authority_bundle: AdmittedAuthorityBundleV1
  readonly branch: string
  readonly worktree_identity: string
  readonly head_sha: FullGitSha
  readonly current_main_sha: FullGitSha
  readonly candidate_aggregate_digest: Sha256
  readonly profile: DeprecationRemovalProfileV1
  readonly catalog: readonly DeprecationCandidateV1[]
  readonly terminal_graph: DeprecationTerminalGraphV1
  readonly consumer_zero_proofs: readonly DeprecationConsumerZeroProofV1[]
  readonly replacement_completion_evidence: readonly DeprecationReplacementCompletionV1[]
  readonly compatibility_evidence: Readonly<{status:'PASS'|'NOT_PASS'; predecessor_bytes_unchanged:boolean; old_records_readable:boolean; wrappers_retained:boolean; runtime_dual_authority_count:number; evidence_digest:Sha256}>
  readonly runtime_safety_evidence: Readonly<{status:'PASS'|'NOT_PASS'; external_io_count:number; protected_action_count:number; physical_deletion_count:number; owner_conflict_count:number; evidence_digest:Sha256}>
  readonly rollback_evidence: Readonly<{status:'PASS'|'NOT_PASS'; separately_reviewed_change_required:boolean; automatic_reactivation_allowed:false; history_rewrite_allowed:false; evidence_digest:Sha256}>
  readonly etv_evidence: Readonly<{classification:'NONBLOCKING_ENVIRONMENT_WARNING'; status:'WARNING_NOT_PASS'; semantic_pass_inferred:false; blocking:false; evidence_digest:Sha256}>
  readonly m3_evidence: Readonly<{classification:'NONBLOCKING_STANDALONE_RUNNER_COMPOSITION_CONSTRAINT'; status:'CONSTRAINT_NOT_PASS'; standalone_m3_pass_inferred:false; blocking:false; evidence_digest:Sha256}>
  readonly expected_terminal_manifest: DeprecationTerminalManifestBindingV1
  readonly input_digest: Sha256
}

type Common = Readonly<{result_version:typeof DEPRECATION_REMOVAL_RESULT_V1_VERSION; input_digest:Sha256; authority_bundle_digest:Sha256|null; retired_candidate_ids:readonly CandidateId[]; retained_candidate_ids:readonly CandidateId[]; terminal_graph_digest:Sha256|null; terminal_manifest_binding_digest:Sha256|null; physical_deletion_count:0; predecessor_mutation_count:0; external_io_count:0; protected_action_count:0; successor_slice_allowed:false; etv_status:'WARNING_NOT_PASS'|null; m3_status:'CONSTRAINT_NOT_PASS'|null; result_digest:Sha256}>
export type DeprecationRemovalResultV1 =
  | (Common & Readonly<{kind:'terminal_migration_manifest_ready'; terminal_manifest:DeprecationTerminalManifestBindingV1; terminal_graph:DeprecationTerminalGraphV1}>)
  | (Common & Readonly<{kind:'partial_retirement_blocked'; first_blocked_candidate_id:CandidateId; blocker:'terminal_graph_retains_candidate'; evidence_digest:Sha256}>)
  | (Common & Readonly<{kind:'consumer_present'; candidate_id:CandidateId; consumer_count:number; consumer_set_digest:Sha256; required_owner:string}>)
  | (Common & Readonly<{kind:'replacement_incomplete'; candidate_id:CandidateId; missing_or_conflicting_evidence:readonly string[]}>)
  | (Common & Readonly<{kind:'compatibility_or_safety_blocked'; conflict_class:'compatibility'|'runtime_safety'|'rollback'|'owner_graph'; evidence_digest:Sha256}>)
  | (Common & Readonly<{kind:'rejected'; rejection:Readonly<{code:RejectionCode; path:string; safe_message:string}>}>)

export type ClosedAdmissionResultV1<T> = Readonly<{kind:'accepted'; value:T}|{kind:'rejected'; rejection:Readonly<{code:RejectionCode;path:string;safe_message:string}>}|{kind:'failed'; failure:Readonly<{code:'validator_internal_failure';diagnostic_id:Sha256;safe_message:string}>}>

const CANDIDATE_IDS: readonly CandidateId[] = ['RA-01','RA-02','RA-03','RA-04','RA-05','RA-06','RA-07','RA-08']
const REPLACEMENTS = {
  'RA-01':['agp_cov_decision_owner','src/continuous-orchestration/evaluator-reducer-consolidation-v1.ts'],
  'RA-02':['authority_collector_admission_owner','src/continuous-orchestration/shared-proof-interfaces-v1.ts'],
  'RA-03':['gate_status_publisher','src/gate-status-publisher/index.ts'],
  'RA-04':['independent_completion_assessor','src/continuous-orchestration/completion-candidate-projection-cutover-v1.ts'],
  'RA-05':['protected_action_executor','src/continuous-orchestration/shared-proof-interfaces-v1.ts'],
  'RA-06':['publication_authority_bridge','src/continuous-orchestration/completion-candidate-projection-cutover-v1.ts'],
  'RA-07':['repair_budget_ledger_owner','src/continuous-orchestration/authority-routing-budget-cutover-v1.ts'],
  'RA-08':['integrated_lead_dispatch_owner','src/continuous-orchestration/authority-routing-budget-cutover-v1.ts'],
} as const
const REQUIRED_SLICES:Record<CandidateId,readonly ('M1'|'M2'|'M3'|'M4'|'M5')[]>={
  'RA-01':['M1','M2','M5'],'RA-02':['M1','M2'],'RA-03':['M1','M2','M4'],'RA-04':['M1','M2','M4'],
  'RA-05':['M1','M2','M5'],'RA-06':['M1','M2','M4'],'RA-07':['M1','M2','M3'],'RA-08':['M1','M2','M3','M5'],
}
const REPLACEMENT_OWNER_CLASSES:Record<CandidateId,OwnerClass>={
  'RA-01':'pure_decision_owner','RA-02':'admission_owner','RA-03':'projection_transport_owner','RA-04':'normative_semantic_owner',
  'RA-05':'protected_executor','RA-06':'normative_semantic_owner','RA-07':'admission_owner','RA-08':'projection_transport_owner',
}
const CLAIM_IDENTITIES:Record<CandidateId,string>={
  'RA-01':'cov_local_agp_precedence_reencoding_and_arl_local_continuation_meaning',
  'RA-02':'pure_component_refetch_reparse_and_duplicate_owner_inference',
  'RA-03':'gate_status_construction_outside_gsp_and_hook_as_publication_proof',
  'RA-04':'candidate_phase_ci_gsp_pr_body_as_completion_authority',
  'RA-05':'pure_component_retrieval_and_evaluation_freshness_reused_for_action',
  'RA-06':'pr_body_gsp_per_file_candidate_authority_and_implicit_working_published_equality',
  'RA-07':'module_local_authoritative_counters_and_implicit_reset',
  'RA-08':'role_inference_arl_route_authority_direct_evaluator_transport_and_hard_coded_product_roles',
}
const CLAIM_DIGESTS=Object.fromEntries(CANDIDATE_IDS.map(candidate_id=>[candidate_id,digest({candidate_id,claim_identity:CLAIM_IDENTITIES[candidate_id]})])) as Record<CandidateId,Sha256>
const REPLACEMENT_AUTHORITY_DIGESTS=Object.fromEntries(CANDIDATE_IDS.map(candidate_id=>[candidate_id,digest({candidate_id,replacement_owner:REPLACEMENTS[candidate_id][0],replacement_path:REPLACEMENTS[candidate_id][1],replacement_owner_class:REPLACEMENT_OWNER_CLASSES[candidate_id]})])) as Record<CandidateId,Sha256>
const COMPLETION_AUTHORITIES={
  M1:{implementation_review_url:'https://github.com/whatrune/sd-prompt-studio/issues/221#issuecomment-5145021091',implementation_review_body_sha256:'8a659fe4aca9c3edb9795fd8c6cf78541cca11a8b9b555c731e1d7495ccb09ab',implementation_review_decision:'APPROVE',executable_contract_validation_url:'https://github.com/whatrune/sd-prompt-studio/issues/221#issuecomment-5145094695',executable_contract_validation_body_sha256:'4f98166d089af30c908ae3b589b9bc9cc80f6ddc8b35fa37b0416bef5df9467d',executable_contract_validation_result:'PASS',completion_preflight_url:'https://github.com/whatrune/sd-prompt-studio/issues/221#issuecomment-5145130602',completion_preflight_body_sha256:'c354bffa6c2e1a3d9d5b0d05e14393a1574a7f83ce80b335bfdcc4551db8473d',completion_preflight_result:'PASS'},
  M2:{implementation_review_url:'https://github.com/whatrune/sd-prompt-studio/issues/221#issuecomment-5147604414',implementation_review_body_sha256:'b8de0cb6a8dd5f5a19f351371a09ed34ca16623f11acc376525c82af53e52ecd',implementation_review_decision:'APPROVE',executable_contract_validation_url:'https://github.com/whatrune/sd-prompt-studio/issues/221#issuecomment-5147658845',executable_contract_validation_body_sha256:'a6f8940e64c8f4430fe6b62048de0b1cd933f9ba59fb6e1ade7e38b5a3d2da8a',executable_contract_validation_result:'PASS',completion_preflight_url:'https://github.com/whatrune/sd-prompt-studio/issues/221#issuecomment-5147688820',completion_preflight_body_sha256:'359a981d0650c2a9685e9291d4e0f6ab9872fa9d20c6d487bb7908f95b3626d1',completion_preflight_result:'PASS'},
  M3:{implementation_review_url:'https://github.com/whatrune/sd-prompt-studio/issues/221#issuecomment-5149807142',implementation_review_body_sha256:'c018f56f7319b7c6e7e8c651723cd653314b41b99f7f737af855ba7fa2e03368',implementation_review_decision:'APPROVE',executable_contract_validation_url:'https://github.com/whatrune/sd-prompt-studio/issues/221#issuecomment-5149855003',executable_contract_validation_body_sha256:'2a2c3abdde1f1ef51f4ae314c0a009931cf514632da206ca60a5fb4e139e4326',executable_contract_validation_result:'PASS',completion_preflight_url:'https://github.com/whatrune/sd-prompt-studio/issues/221#issuecomment-5149887306',completion_preflight_body_sha256:'b8da85295bc31cecce818285a774276d57846a3dd08502900db42eb4594dad7b',completion_preflight_result:'PASS'},
  M4:{implementation_review_url:'https://github.com/whatrune/sd-prompt-studio/issues/221#issuecomment-5150218297',implementation_review_body_sha256:'c3422c6dab074a3e470f128ccdbec3268e3d9ab27efad67ed22f4fdbb0c5b8d3',implementation_review_decision:'APPROVE',executable_contract_validation_url:'https://github.com/whatrune/sd-prompt-studio/issues/221#issuecomment-5150240075',executable_contract_validation_body_sha256:'6e0cb2fc5020283030cc8ab0a1b2359e2804445f30ea859cdd6c937ce07075b8',executable_contract_validation_result:'PASS',completion_preflight_url:'https://github.com/whatrune/sd-prompt-studio/issues/221#issuecomment-5150255304',completion_preflight_body_sha256:'421f1c919c1250b20eab37f17a7508dab4846ffc365902209e7d1db0925ee09a',completion_preflight_result:'PASS'},
  M5:{implementation_review_url:'https://github.com/whatrune/sd-prompt-studio/issues/221#issuecomment-5150767938',implementation_review_body_sha256:'63345c7f7af0440fcd5b3fdaa3067f873901cec887183775c78b698d419827bf',implementation_review_decision:'APPROVE',executable_contract_validation_url:'https://github.com/whatrune/sd-prompt-studio/issues/221#issuecomment-5150794702',executable_contract_validation_body_sha256:'0213be766492927ecd6460237d638efe07af3f51dbd6149a825b7f6430e0bc61',executable_contract_validation_result:'PASS',completion_preflight_url:'https://github.com/whatrune/sd-prompt-studio/issues/221#issuecomment-5150807455',completion_preflight_body_sha256:'dce8dd3e401936883f14a8e0c5e2af64c2a74c012bcd2456d1defcb4e45f2a61',completion_preflight_result:'PASS'},
} as const
const PREDECESSOR_PATH_BINDINGS=[
 ['scripts/fixtures/continuous-orchestration-core-consolidation-m0-v1.json','0bb2903dabec3416657361fccf3984b697ee73fe7bf8c3c46bd51725dc854983'],
 ['scripts/test-continuous-orchestration-core-consolidation-m0.mjs','f13fabceee6571b9915f7a323b5fa1ced950bef026a07c199e88f7046675044d'],
 ['src/continuous-orchestration/shared-proof-interfaces-v1.ts','6ee6de35b634edf0481b679e003f7cdc19572e3a29aee139bb36252944cdb094'],
 ['scripts/fixtures/continuous-orchestration-shared-proof-interfaces-v1.json','7d2a3d9b3f94a5ac4d9874fbc1faf9a9d04a1a7f7849d421384675e44a810039'],
 ['scripts/test-continuous-orchestration-shared-proof-interfaces.mjs','5810c429bdd9e40b975154c030f09c442dbc66a3e87e3cd808f507349a34b79c'],
 ['src/continuous-orchestration/shadow-equivalence-v1.ts','2aaab2e0d8cdac1046dee20ec3fc57692ccf13b16a224b1430f03ba7f610d4c2'],
 ['scripts/fixtures/continuous-orchestration-shadow-equivalence-v1.json','8fee556578903174599867c747fd9ababa7bd93c9e5bfb5c76735f32299770d9'],
 ['scripts/test-continuous-orchestration-shadow-equivalence.mjs','647ff5954f8b3d265ae231c553dfe3ad0bbe0315686714c9156ac10a8a97b8a6'],
 ['src/continuous-orchestration/authority-routing-budget-cutover-v1.ts','3aed25556fab6d0105e738624f39015deb804445deb86fd57329128ddfbb952f'],
 ['scripts/fixtures/continuous-orchestration-authority-routing-budget-cutover-v1.json','947ad2d817e0f847a484c770f45355d3bfc508fed90600eab69c24e7677d9f5f'],
 ['scripts/test-continuous-orchestration-authority-routing-budget-cutover.mjs','e971797663e753028b225dfb89d86624a2353f8a2beecbc7cf6e20c4453af8c0'],
 ['src/continuous-orchestration/completion-candidate-projection-cutover-v1.ts','49714919ad25653faadf492768da609e627547928d96c17c6cb0073afbd4460e'],
 ['scripts/fixtures/continuous-orchestration-completion-candidate-projection-cutover-v1.json','e84952ca6ef27c0e262ed64c049b999315ba8b2c9554947bf4aa9e8c76bf7467'],
 ['scripts/test-continuous-orchestration-completion-candidate-projection-cutover.mjs','e2fa0951201112db0ee0739288948440df596cdc506b12f970ba6de3ab338608'],
 ['src/continuous-orchestration/evaluator-reducer-consolidation-v1.ts','f44dc4bbd5f17a2fd3491b6c5546e425d7b1c69c54641cd12d51df6746ec0004'],
 ['scripts/fixtures/continuous-orchestration-evaluator-reducer-consolidation-v1.json','bf80a6174396a12adde87ce754d6e0d80b2569bc1d1e07afe88cd4720ee648ed'],
 ['scripts/test-continuous-orchestration-evaluator-reducer-consolidation.mjs','f41df0e18b0e877498018917356a4c1b0473436e8ec5c6a255e88541f6bf879a'],
].map(([path,sha256])=>({path,sha256}))
const SURFACE_CLASSES=['production_imports','production_calls','direct_exports','indirect_exports','fixtures_and_runners','test_only_imports','generic_progress_runner_profiles','cross_component_bindings','compatibility_wrappers','public_package_entries','canonical_completion_records'] as const
const SURFACE_PATHS:Record<(typeof SURFACE_CLASSES)[number],readonly string[]>={
 production_imports:['src'],production_calls:['src'],direct_exports:['src'],indirect_exports:['src'],fixtures_and_runners:['scripts','scripts/fixtures'],test_only_imports:['scripts'],generic_progress_runner_profiles:['src/continuous-orchestration'],cross_component_bindings:['src/architecture-repair-loop','src/automatic-gate-progression','src/continuous-orchestration','src/gate-status-publisher'],compatibility_wrappers:['src/continuous-orchestration'],public_package_entries:['package.json','src'],canonical_completion_records:['scripts/fixtures'],
}
const OWNER_CLASSES: readonly OwnerClass[] = ['normative_semantic_owner','admission_owner','pure_decision_owner','projection_transport_owner','protected_executor']
const OWNER_MODEL=[
 {owner_class:'normative_semantic_owner',owner_id:'architecture_contract_owner',owned_item_ids:['completion_authority','replacement_authority:RA-04:independent_completion_assessor','replacement_authority:RA-06:publication_authority_bridge']},
 {owner_class:'admission_owner',owner_id:'authority_admission_owner',owned_item_ids:['admitted_authority_bundle','replacement_authority:RA-02:authority_collector_admission_owner','replacement_authority:RA-07:repair_budget_ledger_owner']},
 {owner_class:'pure_decision_owner',owner_id:'continuous_orchestration_decision_owner',owned_item_ids:['progression_decision','replacement_authority:RA-01:agp_cov_decision_owner']},
 {owner_class:'projection_transport_owner',owner_id:'gate_projection_transport_owner',owned_item_ids:['dispatch_intent','gate_projection','replacement_authority:RA-03:gate_status_publisher','replacement_authority:RA-08:integrated_lead_dispatch_owner']},
 {owner_class:'protected_executor',owner_id:'protected_action_executor',owned_item_ids:['protected_action_execution','replacement_authority:RA-05:protected_action_executor']},
] as const
const OWNER_EDGES=[
 {from_owner_id:'architecture_contract_owner',to_owner_id:'authority_admission_owner',edge_class:'admission'},
 {from_owner_id:'authority_admission_owner',to_owner_id:'continuous_orchestration_decision_owner',edge_class:'decision'},
 {from_owner_id:'continuous_orchestration_decision_owner',to_owner_id:'gate_projection_transport_owner',edge_class:'projection'},
 {from_owner_id:'gate_projection_transport_owner',to_owner_id:'protected_action_executor',edge_class:'execution'},
] as const
const REQUIRED_SURFACES = ['production_imports','production_calls','direct_exports','indirect_exports','fixtures_and_runners','test_only_imports','generic_progress_runner_profiles','cross_component_bindings','compatibility_wrappers','public_package_entries','canonical_completion_records'] as const
const ADDED_PATHS = ['src/continuous-orchestration/deprecation-removal-v1.ts','scripts/fixtures/continuous-orchestration-deprecation-removal-v1.json','scripts/test-continuous-orchestration-deprecation-removal.mjs'] as const

const object=(v:unknown):v is JsonObject=>typeof v==='object'&&v!==null&&!Array.isArray(v)
const owns=(v:JsonObject,k:string)=>Object.prototype.hasOwnProperty.call(v,k)
const clone=<T>(v:T):T=>structuredClone(v)
const freeze=<T>(v:T):T=>{if(v!==null&&typeof v==='object'&&!Object.isFrozen(v)){Object.freeze(v);for(const child of Object.values(v as JsonObject))freeze(child)}return v}
const without=(v:JsonObject,...ks:string[])=>Object.fromEntries(Object.entries(v).filter(([k])=>!ks.includes(k)))
const same=(left:unknown,right:unknown)=>digest(left)===digest(right)
const sha=(v:unknown):v is Sha256=>typeof v==='string'&&/^[0-9a-f]{64}$/.test(v)
const gitSha=(v:unknown):v is FullGitSha=>typeof v==='string'&&/^[0-9a-f]{40}$/.test(v)
const nonEmpty=(v:unknown):v is string=>typeof v==='string'&&v.length>0
const uint=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>=0
const repoPath=(v:unknown):v is string=>typeof v==='string'&&v.length>0&&!/^(?:[A-Za-z]:|\\|\/|\.\.\/)/.test(v)&&!v.includes('\\')
const canonical=(v:unknown)=>typeof v==='string'&&/^https:\/\/github\.com\/[^/]+\/[^/]+\/(?:issues|pull)\/[1-9]\d*(?:#issuecomment-[1-9]\d*)?$/.test(v)
const exact=(v:unknown,keys:readonly string[],path:string):Problem|undefined=>{if(!object(v))return{code:'invalid_type_or_format',path};for(const key of keys)if(!owns(v,key))return{code:'missing_required_field',path:`${path}/${key}`};const unknown=Object.keys(v).find(k=>!keys.includes(k));return unknown?{code:'unknown_field',path:`${path}/${unknown}`}:undefined}
const uniqueOrdered=(values:unknown,expected?:readonly string[])=>Array.isArray(values)&&values.every(nonEmpty)&&new Set(values).size===values.length&&(!expected||digest(values)===digest(expected))
const byteOrdered=(values:readonly string[])=>values.every((value,index)=>index===0||values[index-1]<value)
const digestOk=(v:JsonObject,key:string)=>sha(v[key])&&v[key]===digest(without(v,key))
const accepted=<T>(v:T):ClosedAdmissionResultV1<T>=>freeze({kind:'accepted',value:freeze(clone(v))})
const rejected=<T>(p:Problem):ClosedAdmissionResultV1<T>=>freeze({kind:'rejected',rejection:{code:p.code,path:p.path,safe_message:`rejected: ${p.code}`}})
const failed=<T>(stage:string):ClosedAdmissionResultV1<T>=>freeze({kind:'failed',failure:{code:'validator_internal_failure',diagnostic_id:digest({stage}),safe_message:'validator failed internally'}})
const admit=<T>(stage:string,v:unknown,check:(v:JsonObject)=>Problem|undefined):ClosedAdmissionResultV1<T>=>{try{if(!object(v))return rejected({code:'invalid_type_or_format',path:'/'});const p=check(v);return p?rejected(p):accepted(v as T)}catch{return failed(stage)}}
const seal=<T extends JsonObject>(v:T,key:string):T=>freeze({...clone(v),[key]:digest(v)} as T)
const result=<T extends JsonObject>(v:T):DeprecationRemovalResultV1=>freeze({...v,result_digest:digest(v)}) as unknown as DeprecationRemovalResultV1

const candidateKeys=['candidate_id','deprecated_claim_digest','replacement_owner','replacement_path','replacement_authority_digest','replacement_owner_class','required_completion_slice_ids','candidate_digest'] as const
const profileKeys=['profile_version','feature_id','mode','task_id','repository','assignment_revision','allowed_scope_digest','expected_branch','expected_worktree_identity','expected_head_sha','expected_current_main_sha','authority_record_url','expected_m5_manifest_digest','expected_m5_cumulative_digest','profile_digest'] as const
const graphKeys=['graph_version','observed_head_sha','covered_surfaces','owners','edges','active_deprecated_candidate_ids','owner_conflict_count','owner_cycle_count','graph_digest'] as const
const proofKeys=['proof_version','candidate_id','deprecated_claim_digest','surface_observations','semantic_consumer_graph','repository_scan','executable_trace','ordered_consumer_identities','consumer_count','consumer_set_digest','replacement_authority_digest','replacement_completion_evidence_digest','authority_head_sha','candidate_aggregate_digest','observed_graph_digest','proof_digest'] as const
const completionKeys=['completion_version','candidate_id','replacement_owner','replacement_path','authority_head_sha','predecessor_manifest_digest','implementation_review','executable_contract_validation','completion_preflight','compatibility','blocking_finding_count','owner_boundary_unchanged','safety_boundary_unchanged','replacement_active','authority_records','completion_digest'] as const
const manifestKeys=['manifest_version','prior_manifest_digest','prior_cumulative_digest','prior_slice_count','manifest_mode','active_slice_id','active_slice_ordinal','predecessor_paths','predecessor_path_bindings','added_paths','ordered_cumulative_paths','added_path_count','result_path_count','terminal_migration_state','successor_slice_allowed','manifest_binding_digest'] as const
const inputKeys=['input_version','task_id','repository','authority_bundle','branch','worktree_identity','head_sha','current_main_sha','candidate_aggregate_digest','profile','catalog','terminal_graph','consumer_zero_proofs','replacement_completion_evidence','compatibility_evidence','runtime_safety_evidence','rollback_evidence','etv_evidence','m3_evidence','expected_terminal_manifest','input_digest'] as const

const candidateProblem=(v:unknown,path:string):Problem|undefined=>{const p=exact(v,candidateKeys,path);if(p)return p;const x=v as JsonObject;if(!CANDIDATE_IDS.includes(x.candidate_id as CandidateId)||!sha(x.deprecated_claim_digest)||!nonEmpty(x.replacement_owner)||!repoPath(x.replacement_path)||!sha(x.replacement_authority_digest)||!OWNER_CLASSES.includes(x.replacement_owner_class as OwnerClass)||!Array.isArray(x.required_completion_slice_ids))return{code:'invalid_type_or_format',path};const id=x.candidate_id as CandidateId,expected=REPLACEMENTS[id];if(x.deprecated_claim_digest!==CLAIM_DIGESTS[id]||x.replacement_owner!==expected[0]||x.replacement_path!==expected[1]||x.replacement_authority_digest!==REPLACEMENT_AUTHORITY_DIGESTS[id]||x.replacement_owner_class!==REPLACEMENT_OWNER_CLASSES[id]||!same(x.required_completion_slice_ids,REQUIRED_SLICES[id]))return{code:'invalid_cross_input_binding',path};return digestOk(x,'candidate_digest')?undefined:{code:'invalid_digest',path:`${path}/candidate_digest`}}
const profileProblem=(v:unknown,path='/profile'):Problem|undefined=>{const p=exact(v,profileKeys,path);if(p)return p;const x=v as JsonObject;if(x.profile_version!==DEPRECATION_REMOVAL_PROFILE_V1_VERSION||x.feature_id!=='deprecation_removal'||x.mode!=='terminal_evidence_only'||x.task_id!==M6_TASK_ID||x.repository!==M6_REPOSITORY||x.assignment_revision!==M6_ASSIGNMENT_REVISION||x.allowed_scope_digest!==M6_ALLOWED_SCOPE_DIGEST||x.expected_branch!==M6_BRANCH||x.expected_worktree_identity!==M6_WORKTREE_IDENTITY||x.expected_head_sha!==M6_AUTHORITY_HEAD||x.expected_current_main_sha!==M6_AUTHORITY_HEAD||x.authority_record_url!==M6_DISPATCH_URL||x.expected_m5_manifest_digest!==M6_EXPECTED_M5_MANIFEST_DIGEST||x.expected_m5_cumulative_digest!==M6_EXPECTED_M5_CUMULATIVE_DIGEST)return{code:'invalid_cross_input_binding',path};return digestOk(x,'profile_digest')?undefined:{code:'invalid_digest',path:`${path}/profile_digest`}}
const graphProblem=(v:unknown,path='/terminal_graph'):Problem|undefined=>{const p=exact(v,graphKeys,path);if(p)return p;const x=v as JsonObject;if(x.graph_version!==DEPRECATION_TERMINAL_GRAPH_V1_VERSION||x.observed_head_sha!==M6_AUTHORITY_HEAD||!uniqueOrdered(x.covered_surfaces,REQUIRED_SURFACES)||!Array.isArray(x.owners)||!same(x.owners,OWNER_MODEL)||!Array.isArray(x.edges)||!same(x.edges,OWNER_EDGES)||!Array.isArray(x.active_deprecated_candidate_ids)||!uint(x.owner_conflict_count)||!uint(x.owner_cycle_count)||x.owner_conflict_count!==0||x.owner_cycle_count!==0)return{code:'invalid_cross_input_binding',path};if(!uniqueOrdered(x.active_deprecated_candidate_ids as unknown[]))return{code:'duplicate_set_member',path:`${path}/active_deprecated_candidate_ids`};return digestOk(x,'graph_digest')?undefined:{code:'invalid_digest',path:`${path}/graph_digest`}}
const completionProblem=(v:unknown,path:string):Problem|undefined=>{const p=exact(v,completionKeys,path);if(p)return p;const x=v as JsonObject;if(x.completion_version!==DEPRECATION_REPLACEMENT_COMPLETION_V1_VERSION||!CANDIDATE_IDS.includes(x.candidate_id as CandidateId)||!nonEmpty(x.replacement_owner)||!repoPath(x.replacement_path)||x.authority_head_sha!==M6_AUTHORITY_HEAD||x.predecessor_manifest_digest!==M6_EXPECTED_M5_MANIFEST_DIGEST||!['PASS','NOT_PASS'].includes(String(x.implementation_review))||!['PASS','NOT_PASS'].includes(String(x.executable_contract_validation))||!['PASS','NOT_PASS'].includes(String(x.completion_preflight))||!['PASS','NOT_PASS'].includes(String(x.compatibility))||!uint(x.blocking_finding_count)||typeof x.owner_boundary_unchanged!=='boolean'||typeof x.safety_boundary_unchanged!=='boolean'||typeof x.replacement_active!=='boolean'||!Array.isArray(x.authority_records))return{code:'invalid_type_or_format',path};const id=x.candidate_id as CandidateId,expected=REPLACEMENTS[id],required=REQUIRED_SLICES[id];if(x.replacement_owner!==expected[0]||x.replacement_path!==expected[1]||x.authority_records.length!==required.length)return{code:'invalid_cross_input_binding',path};for(let i=0;i<required.length;i++){const recordPath=`${path}/authority_records/${i}`,q=exact(x.authority_records[i],['slice_id','implementation_review_url','implementation_review_body_sha256','implementation_review_decision','executable_contract_validation_url','executable_contract_validation_body_sha256','executable_contract_validation_result','completion_preflight_url','completion_preflight_body_sha256','completion_preflight_result'],recordPath);if(q)return q;const row=x.authority_records[i] as JsonObject,expectedRecord={slice_id:required[i],...COMPLETION_AUTHORITIES[required[i]]};if(!same(row,expectedRecord))return{code:'invalid_cross_input_binding',path:recordPath}}return digestOk(x,'completion_digest')?undefined:{code:'invalid_digest',path:`${path}/completion_digest`}}
const semanticSiteProblem=(v:unknown,path:string):Problem|undefined=>{const p=exact(v,['repository_relative_path','node_kind','symbol_name','local_name','module_specifier','site_identity'],path);if(p)return p;const x=v as JsonObject;if(!repoPath(x.repository_relative_path)||!['direct_reference','direct_import','alias_import','re_export','dynamic_access','self_reference'].includes(String(x.node_kind))||!nonEmpty(x.symbol_name)||!(x.local_name===null||nonEmpty(x.local_name))||!(x.module_specifier===null||nonEmpty(x.module_specifier))||!nonEmpty(x.site_identity))return{code:'invalid_type_or_format',path};return undefined}
const semanticGraphProblem=(v:unknown,candidateId:CandidateId,path:string):Problem|undefined=>{
  const keys=['graph_version','authority_revision','candidate_id','canonical_claim_identity','definition_site','direct_import_or_reference','alias_import','re_export','dynamic_access','self_reference_sites','scanned_repository_scope','excluded_scope_and_reason','missing_scan_targets','unknown_nodes','unresolved_imports','indeterminate_dynamic_access','ordered_external_consumer_identities','consumer_count','aggregate_proof_digest'],p=exact(v,keys,path);if(p)return p
  const x=v as JsonObject
  if(x.graph_version!==DEPRECATION_SEMANTIC_CONSUMER_GRAPH_V1_VERSION||x.authority_revision!==M6_SEMANTIC_GRAPH_AUTHORITY_REVISION||x.candidate_id!==candidateId||x.canonical_claim_identity!==CLAIM_IDENTITIES[candidateId]||!uint(x.consumer_count)||!sha(x.aggregate_proof_digest))return{code:'invalid_cross_input_binding',path}
  const definitionPath=`${path}/definition_site`,definitionExact=exact(x.definition_site,['repository_relative_path','declaration_symbol','property_key','site_identity'],definitionPath);if(definitionExact)return definitionExact
  const definition=x.definition_site as JsonObject
  if(definition.repository_relative_path!=='src/continuous-orchestration/deprecation-removal-v1.ts'||definition.declaration_symbol!=='CLAIM_IDENTITIES'||definition.property_key!==candidateId||definition.site_identity!==`src/continuous-orchestration/deprecation-removal-v1.ts#CLAIM_IDENTITIES.${candidateId}`)return{code:'invalid_cross_input_binding',path:definitionPath}
  const scopePath=`${path}/scanned_repository_scope`,scopeExact=exact(x.scanned_repository_scope,['scope_mode','authority_head_sha','repository_path_count','repository_path_set_digest','semantic_source_path_count','semantic_source_path_set_digest','definition_target_included'],scopePath);if(scopeExact)return scopeExact
  const scope=x.scanned_repository_scope as JsonObject
  if(scope.scope_mode!=='all_repository_paths'||scope.authority_head_sha!==M6_AUTHORITY_HEAD||scope.repository_path_count!==M6_SEMANTIC_REPOSITORY_PATH_COUNT||scope.repository_path_set_digest!==M6_SEMANTIC_REPOSITORY_PATH_SET_DIGEST||scope.semantic_source_path_count!==M6_SEMANTIC_SOURCE_PATH_COUNT||scope.semantic_source_path_set_digest!==M6_SEMANTIC_SOURCE_PATH_SET_DIGEST||scope.definition_target_included!==true)return{code:'invalid_cross_input_binding',path:scopePath}
  if(!Array.isArray(x.excluded_scope_and_reason)||x.excluded_scope_and_reason.length!==1)return{code:'invalid_cross_input_binding',path:`${path}/excluded_scope_and_reason`}
  const excludedPath=`${path}/excluded_scope_and_reason/0`,excludedExact=exact(x.excluded_scope_and_reason[0],['scope_class','reason','path_count','path_set_digest'],excludedPath);if(excludedExact)return excludedExact
  const excluded=x.excluded_scope_and_reason[0] as JsonObject
  if(excluded.scope_class!=='non_ecmascript_artifact'||excluded.reason!=='not_a_semantic_source_unit'||excluded.path_count!==M6_SEMANTIC_EXCLUDED_PATH_COUNT||excluded.path_set_digest!==M6_SEMANTIC_EXCLUDED_PATH_SET_DIGEST)return{code:'invalid_cross_input_binding',path:excludedPath}
  const siteArrays=['direct_import_or_reference','alias_import','re_export','dynamic_access','self_reference_sites'] as const
  for(const key of siteArrays){const rows=x[key];if(!Array.isArray(rows))return{code:'invalid_type_or_format',path:`${path}/${key}`};for(let i=0;i<rows.length;i++){const q=semanticSiteProblem(rows[i],`${path}/${key}/${i}`);if(q)return q};const identities=rows.map(row=>(row as JsonObject).site_identity);if(!uniqueOrdered(identities)||!byteOrdered(identities as string[]))return{code:'noncanonical_set_order',path:`${path}/${key}`}}
  const failClosedArrays=['missing_scan_targets','unknown_nodes','unresolved_imports','indeterminate_dynamic_access'] as const
  for(const key of failClosedArrays)if(!Array.isArray(x[key])||!uniqueOrdered(x[key] as unknown[])||!byteOrdered(x[key] as string[])||(x[key] as unknown[]).length!==0)return{code:'invalid_cross_input_binding',path:`${path}/${key}`}
  const external=[...x.direct_import_or_reference as JsonObject[],...x.alias_import as JsonObject[],...x.re_export as JsonObject[],...x.dynamic_access as JsonObject[]].map(row=>String(row.site_identity)).sort()
  if(!Array.isArray(x.ordered_external_consumer_identities)||!uniqueOrdered(x.ordered_external_consumer_identities as unknown[])||!byteOrdered(x.ordered_external_consumer_identities as string[])||!same(x.ordered_external_consumer_identities,external)||x.consumer_count!==external.length)return{code:'invalid_cross_input_binding',path:`${path}/consumer_count`}
  return digestOk(x,'aggregate_proof_digest')?undefined:{code:'invalid_digest',path:`${path}/aggregate_proof_digest`}
}
const proofProblem=(v:unknown,path:string):Problem|undefined=>{
  const p=exact(v,proofKeys,path);if(p)return p
  const x=v as JsonObject
  if(x.proof_version!==DEPRECATION_CONSUMER_ZERO_PROOF_V1_VERSION||!CANDIDATE_IDS.includes(x.candidate_id as CandidateId)||!sha(x.deprecated_claim_digest)||!Array.isArray(x.surface_observations)||x.surface_observations.length!==SURFACE_CLASSES.length||!Array.isArray(x.ordered_consumer_identities)||!uniqueOrdered(x.ordered_consumer_identities as unknown[])||!byteOrdered(x.ordered_consumer_identities as string[])||!uint(x.consumer_count)||!sha(x.consumer_set_digest)||!sha(x.replacement_authority_digest)||!sha(x.replacement_completion_evidence_digest)||x.authority_head_sha!==M6_AUTHORITY_HEAD||!sha(x.candidate_aggregate_digest)||!sha(x.observed_graph_digest))return{code:'invalid_type_or_format',path}
  const candidateId=x.candidate_id as CandidateId,flattened:string[]=[]
  if(x.deprecated_claim_digest!==CLAIM_DIGESTS[candidateId]||x.replacement_authority_digest!==REPLACEMENT_AUTHORITY_DIGESTS[candidateId])return{code:'invalid_cross_input_binding',path:`${path}/claim_replacement_binding`}
  const semanticProblem=semanticGraphProblem(x.semantic_consumer_graph,candidateId,`${path}/semantic_consumer_graph`);if(semanticProblem)return semanticProblem
  const semanticGraph=x.semantic_consumer_graph as JsonObject
  for(let i=0;i<SURFACE_CLASSES.length;i++){
    const observationPath=`${path}/surface_observations/${i}`,q=exact(x.surface_observations[i],['surface_class','ordered_repository_relative_paths','ordered_consumer_identities'],observationPath);if(q)return q
    const row=x.surface_observations[i] as JsonObject,expectedPaths=SURFACE_PATHS[SURFACE_CLASSES[i]]
    if(row.surface_class!==SURFACE_CLASSES[i]||!same(row.ordered_repository_relative_paths,expectedPaths)||!Array.isArray(row.ordered_consumer_identities)||!uniqueOrdered(row.ordered_consumer_identities as unknown[])||!byteOrdered(row.ordered_consumer_identities as string[]))return{code:'invalid_cross_input_binding',path:observationPath}
    flattened.push(...row.ordered_consumer_identities as string[])
  }
  const scanPath=`${path}/repository_scan`,scanKeys=['scan_version','collector_id','authority_head_sha','excluded_evidence_paths','scanned_path_count','scan_manifest_digest','semantic_graph_digest','ordered_consumer_identities','consumer_count','consumer_set_digest','scan_result_digest'],scanExact=exact(x.repository_scan,scanKeys,scanPath);if(scanExact)return scanExact
  const scan=x.repository_scan as JsonObject
  if(scan.scan_version!==DEPRECATION_REPOSITORY_CONSUMER_SCAN_V1_VERSION||scan.collector_id!=='m6_repository_consumer_scan_v1'||scan.authority_head_sha!==M6_AUTHORITY_HEAD||!same(scan.excluded_evidence_paths,[])||scan.scanned_path_count!==M6_REPOSITORY_SCAN_PATH_COUNT||scan.scan_manifest_digest!==M6_REPOSITORY_SCAN_MANIFEST_DIGEST||scan.semantic_graph_digest!==semanticGraph.aggregate_proof_digest||!Array.isArray(scan.ordered_consumer_identities)||!uniqueOrdered(scan.ordered_consumer_identities as unknown[])||!byteOrdered(scan.ordered_consumer_identities as string[])||!uint(scan.consumer_count)||!sha(scan.consumer_set_digest)||!digestOk(scan,'scan_result_digest'))return{code:'invalid_cross_input_binding',path:scanPath}
  const tracePath=`${path}/executable_trace`,traceKeys=['trace_version','trace_id','candidate_id','collector_id','claim_digest','scan_manifest_digest','semantic_graph_digest','scan_result_digest','observed_consumer_set_digest','observed_consumer_count','executed_path_count','exit_code','trace_digest'],traceExact=exact(x.executable_trace,traceKeys,tracePath);if(traceExact)return traceExact
  const trace=x.executable_trace as JsonObject,expectedTraceId=digest({candidate_id:candidateId,collector_id:'m6_repository_consumer_scan_v1',claim_digest:CLAIM_DIGESTS[candidateId],scan_manifest_digest:M6_REPOSITORY_SCAN_MANIFEST_DIGEST,semantic_graph_digest:semanticGraph.aggregate_proof_digest,scan_result_digest:scan.scan_result_digest})
  if(trace.trace_version!==DEPRECATION_EXECUTABLE_TRACE_V1_VERSION||trace.trace_id!==expectedTraceId||trace.candidate_id!==candidateId||trace.collector_id!=='m6_repository_consumer_scan_v1'||trace.claim_digest!==CLAIM_DIGESTS[candidateId]||trace.scan_manifest_digest!==M6_REPOSITORY_SCAN_MANIFEST_DIGEST||trace.semantic_graph_digest!==semanticGraph.aggregate_proof_digest||trace.scan_result_digest!==scan.scan_result_digest||trace.observed_consumer_set_digest!==scan.consumer_set_digest||trace.observed_consumer_count!==scan.consumer_count||trace.executed_path_count!==M6_REPOSITORY_SCAN_PATH_COUNT||trace.exit_code!==0||!digestOk(trace,'trace_digest'))return{code:'invalid_cross_input_binding',path:tracePath}
  const observed=[...new Set(flattened)].sort()
  if(!same(observed,semanticGraph.ordered_external_consumer_identities)||!same(x.ordered_consumer_identities,observed)||!same(scan.ordered_consumer_identities,observed)||x.consumer_count!==observed.length||scan.consumer_count!==observed.length||semanticGraph.consumer_count!==observed.length||x.consumer_set_digest!==digest(observed)||scan.consumer_set_digest!==digest(observed))return{code:'invalid_cross_input_binding',path:`${path}/consumer_set_digest`}
  return digestOk(x,'proof_digest')?undefined:{code:'invalid_digest',path:`${path}/proof_digest`}
}
const manifestProblem=(v:unknown,path='/expected_terminal_manifest'):Problem|undefined=>{const p=exact(v,manifestKeys,path);if(p)return p;const x=v as JsonObject,predecessorPaths=PREDECESSOR_PATH_BINDINGS.map(binding=>binding.path);if(x.manifest_version!==DEPRECATION_TERMINAL_MANIFEST_V1_VERSION||x.prior_manifest_digest!==M6_EXPECTED_M5_MANIFEST_DIGEST||x.prior_cumulative_digest!==M6_EXPECTED_M5_CUMULATIVE_DIGEST||x.prior_slice_count!==6||x.manifest_mode!=='successor'||x.active_slice_id!=='M6'||x.active_slice_ordinal!==6||!same(x.predecessor_paths,predecessorPaths)||!same(x.predecessor_path_bindings,PREDECESSOR_PATH_BINDINGS)||!Array.isArray(x.added_paths)||!same(x.added_paths,ADDED_PATHS)||!Array.isArray(x.ordered_cumulative_paths)||!same(x.ordered_cumulative_paths,[...predecessorPaths,...ADDED_PATHS])||x.added_path_count!==3||x.result_path_count!==20||x.terminal_migration_state!=='terminal_candidate'||x.successor_slice_allowed!==false)return{code:'invalid_cross_input_binding',path};return digestOk(x,'manifest_binding_digest')?undefined:{code:'invalid_digest',path:`${path}/manifest_binding_digest`}}
const evidenceProblem=(v:unknown,keys:readonly string[],path:string,status:string):Problem|undefined=>{const p=exact(v,keys,path);if(p)return p;const x=v as JsonObject;if(x.status!==status||!digestOk(x,'evidence_digest'))return{code:'invalid_cross_input_binding',path};return undefined}

const inputProblem=(x:JsonObject):Problem|undefined=>{
  let p=exact(x,inputKeys,'/input');if(p)return p
  if(x.input_version!==DEPRECATION_REMOVAL_INPUT_V1_VERSION||x.task_id!==M6_TASK_ID||x.repository!==M6_REPOSITORY||x.branch!==M6_BRANCH||x.worktree_identity!==M6_WORKTREE_IDENTITY||x.head_sha!==M6_AUTHORITY_HEAD||x.current_main_sha!==M6_AUTHORITY_HEAD||!sha(x.candidate_aggregate_digest))return{code:'invalid_cross_input_binding',path:'/input'}
  const authorityAdmission=validateAdmittedAuthorityBundleV1(x.authority_bundle)
  if(authorityAdmission.kind!=='accepted')return{code:'invalid_cross_input_binding',path:'/input/authority_bundle'}
  const bundle=authorityAdmission.value
  if(bundle.task_id!==M6_TASK_ID||bundle.repository!==M6_REPOSITORY||bundle.assignment_revision!==M6_ASSIGNMENT_REVISION||bundle.scope_digest!==M6_ALLOWED_SCOPE_DIGEST||bundle.fresh_snapshot.main_sha_or_null!==M6_AUTHORITY_HEAD||bundle.fresh_snapshot.pr_url_or_null!==null||bundle.fresh_snapshot.pr_head_sha_or_null!==null||bundle.fresh_snapshot.pr_base_sha_or_null!==null||bundle.fresh_snapshot.pr_state!=='not_applicable'||bundle.fresh_snapshot.workspace_state!=='clean_bound'||bundle.sources.length!==1||bundle.sources[0].source_type!=='task_assignment'||bundle.sources[0].source_ref.kind!=='canonical_record'||bundle.sources[0].source_ref.url!==M6_DISPATCH_URL||bundle.sources[0].owner_contract_url!==M6_CANDIDATE_URL||bundle.sources[0].authority_class!=='normative_semantic'||bundle.sources[0].authority_scope_digest!==M6_ALLOWED_SCOPE_DIGEST||bundle.sources[0].content_projection_digest!==M6_DISPATCH_BODY_SHA256||bundle.sources[0].subject_head_sha_or_null!==M6_AUTHORITY_HEAD)return{code:'invalid_cross_input_binding',path:'/input/authority_bundle'}
  if((p=profileProblem(x.profile))||(p=graphProblem(x.terminal_graph))||(p=manifestProblem(x.expected_terminal_manifest)))return p
  const profile=x.profile as JsonObject,graph=x.terminal_graph as JsonObject
  if(profile.task_id!==x.task_id||profile.repository!==x.repository||profile.assignment_revision!==bundle.assignment_revision||profile.allowed_scope_digest!==bundle.scope_digest||profile.expected_branch!==x.branch||profile.expected_worktree_identity!==x.worktree_identity||profile.expected_head_sha!==x.head_sha||profile.expected_current_main_sha!==x.current_main_sha||graph.observed_head_sha!==x.head_sha)return{code:'invalid_cross_input_binding',path:'/input/authority_binding'}
  if(!Array.isArray(x.catalog)||x.catalog.length!==8)return{code:'invalid_cross_input_binding',path:'/input/catalog'}
  for(let i=0;i<8;i++){if((x.catalog[i] as JsonObject)?.candidate_id!==CANDIDATE_IDS[i])return{code:'noncanonical_set_order',path:`/input/catalog/${i}`};if((p=candidateProblem(x.catalog[i],`/input/catalog/${i}`)))return p}
  if(x.candidate_aggregate_digest!==digest((x.catalog as JsonObject[]).map(c=>({candidate_id:c.candidate_id,candidate_digest:c.candidate_digest}))))return{code:'invalid_digest',path:'/input/candidate_aggregate_digest'}
  if(!Array.isArray(x.replacement_completion_evidence)||x.replacement_completion_evidence.length!==8||!Array.isArray(x.consumer_zero_proofs)||x.consumer_zero_proofs.length!==8)return{code:'invalid_cross_input_binding',path:'/input/evidence_sets'}
  for(let i=0;i<8;i++){const c=x.catalog[i] as JsonObject,completion=x.replacement_completion_evidence[i] as JsonObject,proof=x.consumer_zero_proofs[i] as JsonObject;if(completion?.candidate_id!==CANDIDATE_IDS[i]||proof?.candidate_id!==CANDIDATE_IDS[i])return{code:'noncanonical_set_order',path:`/input/evidence_sets/${i}`};if((p=completionProblem(completion,`/input/replacement_completion_evidence/${i}`))||(p=proofProblem(proof,`/input/consumer_zero_proofs/${i}`)))return p;if(completion.authority_head_sha!==x.head_sha||proof.authority_head_sha!==x.head_sha||proof.candidate_aggregate_digest!==x.candidate_aggregate_digest||proof.observed_graph_digest!==graph.graph_digest||proof.deprecated_claim_digest!==c.deprecated_claim_digest||proof.replacement_authority_digest!==c.replacement_authority_digest||proof.replacement_completion_evidence_digest!==completion.completion_digest)return{code:'invalid_cross_input_binding',path:`/input/evidence_sets/${i}`}}
  if((p=evidenceProblem(x.compatibility_evidence,['status','predecessor_bytes_unchanged','old_records_readable','wrappers_retained','runtime_dual_authority_count','evidence_digest'],'/input/compatibility_evidence','PASS'))||(p=evidenceProblem(x.runtime_safety_evidence,['status','external_io_count','protected_action_count','physical_deletion_count','owner_conflict_count','evidence_digest'],'/input/runtime_safety_evidence','PASS'))||(p=evidenceProblem(x.rollback_evidence,['status','separately_reviewed_change_required','automatic_reactivation_allowed','history_rewrite_allowed','evidence_digest'],'/input/rollback_evidence','PASS'))||(p=evidenceProblem(x.etv_evidence,['classification','status','semantic_pass_inferred','blocking','evidence_digest'],'/input/etv_evidence','WARNING_NOT_PASS'))||(p=evidenceProblem(x.m3_evidence,['classification','status','standalone_m3_pass_inferred','blocking','evidence_digest'],'/input/m3_evidence','CONSTRAINT_NOT_PASS')))return p
  const compatibility=x.compatibility_evidence as JsonObject,safety=x.runtime_safety_evidence as JsonObject,rollback=x.rollback_evidence as JsonObject
  if(typeof compatibility.predecessor_bytes_unchanged!=='boolean'||typeof compatibility.old_records_readable!=='boolean'||typeof compatibility.wrappers_retained!=='boolean'||!uint(compatibility.runtime_dual_authority_count)||!uint(safety.external_io_count)||!uint(safety.protected_action_count)||!uint(safety.physical_deletion_count)||!uint(safety.owner_conflict_count)||typeof rollback.separately_reviewed_change_required!=='boolean'||typeof rollback.automatic_reactivation_allowed!=='boolean'||typeof rollback.history_rewrite_allowed!=='boolean')return{code:'invalid_type_or_format',path:'/input/evidence'}
  const etv=x.etv_evidence as JsonObject,m3=x.m3_evidence as JsonObject
  if(etv.classification!=='NONBLOCKING_ENVIRONMENT_WARNING'||etv.semantic_pass_inferred!==false||etv.blocking!==false||m3.classification!=='NONBLOCKING_STANDALONE_RUNNER_COMPOSITION_CONSTRAINT'||m3.standalone_m3_pass_inferred!==false||m3.blocking!==false)return{code:'invalid_cross_input_binding',path:'/input/nonpass_preservation'}
  return digestOk(x,'input_digest')?undefined:{code:'invalid_digest',path:'/input/input_digest'}
}

export const sealDeprecationCandidateV1=(v:Omit<DeprecationCandidateV1,'candidate_digest'>)=>seal(v as unknown as JsonObject,'candidate_digest') as unknown as DeprecationCandidateV1
export const sealDeprecationRemovalProfileV1=(v:Omit<DeprecationRemovalProfileV1,'profile_digest'>)=>seal(v as unknown as JsonObject,'profile_digest') as unknown as DeprecationRemovalProfileV1
export const sealDeprecationTerminalGraphV1=(v:Omit<DeprecationTerminalGraphV1,'graph_digest'>)=>seal(v as unknown as JsonObject,'graph_digest') as unknown as DeprecationTerminalGraphV1
export const sealDeprecationSemanticConsumerGraphV1=(v:Omit<DeprecationSemanticConsumerGraphV1,'aggregate_proof_digest'>)=>seal(v as unknown as JsonObject,'aggregate_proof_digest') as unknown as DeprecationSemanticConsumerGraphV1
export const sealDeprecationConsumerZeroProofV1=(v:Omit<DeprecationConsumerZeroProofV1,'proof_digest'>)=>seal(v as unknown as JsonObject,'proof_digest') as unknown as DeprecationConsumerZeroProofV1
export const sealDeprecationReplacementCompletionV1=(v:Omit<DeprecationReplacementCompletionV1,'completion_digest'>)=>seal(v as unknown as JsonObject,'completion_digest') as unknown as DeprecationReplacementCompletionV1
export const sealDeprecationTerminalManifestBindingV1=(v:Omit<DeprecationTerminalManifestBindingV1,'manifest_binding_digest'>)=>seal(v as unknown as JsonObject,'manifest_binding_digest') as unknown as DeprecationTerminalManifestBindingV1
export const sealDeprecationEvidenceV1=<T extends JsonObject>(v:T)=>seal(v,'evidence_digest')
export const sealDeprecationRemovalInputV1=(v:Omit<DeprecationRemovalInputV1,'input_digest'>)=>seal(v as unknown as JsonObject,'input_digest') as unknown as DeprecationRemovalInputV1
export const validateDeprecationRemovalInputV1=(v:unknown):ClosedAdmissionResultV1<DeprecationRemovalInputV1>=>admit('deprecation_removal_input',v,inputProblem)
export const validateDeprecationRemovalResultV1=(v:unknown):ClosedAdmissionResultV1<DeprecationRemovalResultV1>=>admit('deprecation_removal_result',v,x=>{const common=['result_version','input_digest','authority_bundle_digest','retired_candidate_ids','retained_candidate_ids','terminal_graph_digest','terminal_manifest_binding_digest','physical_deletion_count','predecessor_mutation_count','external_io_count','protected_action_count','successor_slice_allowed','etv_status','m3_status','kind','result_digest'];const extras:Record<string,readonly string[]>={terminal_migration_manifest_ready:['terminal_manifest','terminal_graph'],partial_retirement_blocked:['first_blocked_candidate_id','blocker','evidence_digest'],consumer_present:['candidate_id','consumer_count','consumer_set_digest','required_owner'],replacement_incomplete:['candidate_id','missing_or_conflicting_evidence'],compatibility_or_safety_blocked:['conflict_class','evidence_digest'],rejected:['rejection']};if(!nonEmpty(x.kind)||!owns(extras,String(x.kind)))return{code:'invalid_enum',path:'/result/kind'};const p=exact(x,[...common,...extras[String(x.kind)]],'/result');if(p)return p;if(x.result_version!==DEPRECATION_REMOVAL_RESULT_V1_VERSION||!sha(x.input_digest)||!(x.authority_bundle_digest===null||sha(x.authority_bundle_digest))||!Array.isArray(x.retired_candidate_ids)||!Array.isArray(x.retained_candidate_ids)||!uniqueOrdered(x.retired_candidate_ids as unknown[])||!uniqueOrdered(x.retained_candidate_ids as unknown[])||!(x.terminal_graph_digest===null||sha(x.terminal_graph_digest))||!(x.terminal_manifest_binding_digest===null||sha(x.terminal_manifest_binding_digest))||x.physical_deletion_count!==0||x.predecessor_mutation_count!==0||x.external_io_count!==0||x.protected_action_count!==0||x.successor_slice_allowed!==false||!(x.etv_status===null||x.etv_status==='WARNING_NOT_PASS')||!(x.m3_status===null||x.m3_status==='CONSTRAINT_NOT_PASS')||!sha(x.result_digest)||x.result_digest!==digest(without(x,'result_digest')))return{code:'invalid_digest',path:'/result/result_digest'};if(x.kind==='terminal_migration_manifest_ready'){const mp=manifestProblem(x.terminal_manifest,'/result/terminal_manifest'),gp=graphProblem(x.terminal_graph,'/result/terminal_graph');if(mp||gp)return mp??gp;if(!same(x.retired_candidate_ids,CANDIDATE_IDS)||(x.retained_candidate_ids as unknown[]).length!==0)return{code:'invalid_cross_input_binding',path:'/result/retired_candidate_ids'}}else if(x.kind==='rejected'){const rp=exact(x.rejection,['code','path','safe_message'],'/result/rejection');if(rp)return rp;if((x.retired_candidate_ids as unknown[]).length|| (x.retained_candidate_ids as unknown[]).length||x.authority_bundle_digest!==null||x.terminal_graph_digest!==null||x.terminal_manifest_binding_digest!==null||x.etv_status!==null||x.m3_status!==null)return{code:'invalid_cross_input_binding',path:'/result/rejected'}}else{if((x.retired_candidate_ids as unknown[]).length!==0||!same(x.retained_candidate_ids,CANDIDATE_IDS)||x.authority_bundle_digest===null||x.terminal_graph_digest===null||x.terminal_manifest_binding_digest===null||x.etv_status!=='WARNING_NOT_PASS'||x.m3_status!=='CONSTRAINT_NOT_PASS')return{code:'invalid_cross_input_binding',path:'/result/retirement_state'};if(x.kind==='partial_retirement_blocked'&&(!CANDIDATE_IDS.includes(x.first_blocked_candidate_id as CandidateId)||x.blocker!=='terminal_graph_retains_candidate'||!sha(x.evidence_digest)))return{code:'invalid_cross_input_binding',path:'/result/partial_retirement_blocked'};if(x.kind==='consumer_present'){const id=x.candidate_id as CandidateId;if(!CANDIDATE_IDS.includes(id)||!Number.isSafeInteger(x.consumer_count)||Number(x.consumer_count)<=0||!sha(x.consumer_set_digest)||x.required_owner!==REPLACEMENTS[id][0])return{code:'invalid_cross_input_binding',path:'/result/consumer_present'}}if(x.kind==='replacement_incomplete'){const allowed=['implementation_review','executable_contract_validation','completion_preflight','compatibility','blocking_findings','owner_boundary','safety_boundary','replacement_active'];if(!CANDIDATE_IDS.includes(x.candidate_id as CandidateId)||!Array.isArray(x.missing_or_conflicting_evidence)||x.missing_or_conflicting_evidence.length===0||!x.missing_or_conflicting_evidence.every(value=>allowed.includes(String(value)))||!uniqueOrdered(x.missing_or_conflicting_evidence as unknown[]))return{code:'invalid_cross_input_binding',path:'/result/replacement_incomplete'}}if(x.kind==='compatibility_or_safety_blocked'&&(!['compatibility','runtime_safety','rollback','owner_graph'].includes(String(x.conflict_class))||!sha(x.evidence_digest)))return{code:'invalid_cross_input_binding',path:'/result/compatibility_or_safety_blocked'}}return undefined})

export const evaluateDeprecationRemovalV1=(raw:unknown):DeprecationRemovalResultV1=>{
  const admission=validateDeprecationRemovalInputV1(raw)
  if(admission.kind!=='accepted')return result({result_version:DEPRECATION_REMOVAL_RESULT_V1_VERSION,input_digest:digest({rejected:true}),authority_bundle_digest:null,retired_candidate_ids:[],retained_candidate_ids:[],terminal_graph_digest:null,terminal_manifest_binding_digest:null,physical_deletion_count:0,predecessor_mutation_count:0,external_io_count:0,protected_action_count:0,successor_slice_allowed:false,etv_status:null,m3_status:null,kind:'rejected',rejection:admission.kind==='rejected'?admission.rejection:{code:'invalid_type_or_format',path:'/',safe_message:'validator failed internally'}})
  const input=admission.value,common={result_version:DEPRECATION_REMOVAL_RESULT_V1_VERSION,input_digest:input.input_digest,authority_bundle_digest:input.authority_bundle.bundle_digest,retired_candidate_ids:[] as CandidateId[],retained_candidate_ids:CANDIDATE_IDS as readonly CandidateId[],terminal_graph_digest:input.terminal_graph.graph_digest,terminal_manifest_binding_digest:input.expected_terminal_manifest.manifest_binding_digest,physical_deletion_count:0 as const,predecessor_mutation_count:0 as const,external_io_count:0 as const,protected_action_count:0 as const,successor_slice_allowed:false as const,etv_status:'WARNING_NOT_PASS' as const,m3_status:'CONSTRAINT_NOT_PASS' as const}
  if(input.compatibility_evidence.status!=='PASS'||!input.compatibility_evidence.predecessor_bytes_unchanged||!input.compatibility_evidence.old_records_readable||!input.compatibility_evidence.wrappers_retained||input.compatibility_evidence.runtime_dual_authority_count!==0)return result({...common,kind:'compatibility_or_safety_blocked',conflict_class:'compatibility',evidence_digest:input.compatibility_evidence.evidence_digest})
  if(input.runtime_safety_evidence.status!=='PASS'||input.runtime_safety_evidence.external_io_count!==0||input.runtime_safety_evidence.protected_action_count!==0||input.runtime_safety_evidence.physical_deletion_count!==0||input.runtime_safety_evidence.owner_conflict_count!==0)return result({...common,kind:'compatibility_or_safety_blocked',conflict_class:'runtime_safety',evidence_digest:input.runtime_safety_evidence.evidence_digest})
  if(input.rollback_evidence.status!=='PASS'||!input.rollback_evidence.separately_reviewed_change_required||input.rollback_evidence.automatic_reactivation_allowed||input.rollback_evidence.history_rewrite_allowed)return result({...common,kind:'compatibility_or_safety_blocked',conflict_class:'rollback',evidence_digest:input.rollback_evidence.evidence_digest})
  if(input.terminal_graph.owner_conflict_count!==0||input.terminal_graph.owner_cycle_count!==0)return result({...common,kind:'compatibility_or_safety_blocked',conflict_class:'owner_graph',evidence_digest:input.terminal_graph.graph_digest})
  for(let i=0;i<8;i++){const proof=input.consumer_zero_proofs[i],completion=input.replacement_completion_evidence[i],candidate=input.catalog[i];if(proof.consumer_count>0)return result({...common,kind:'consumer_present',candidate_id:candidate.candidate_id,consumer_count:proof.consumer_count,consumer_set_digest:proof.consumer_set_digest,required_owner:candidate.replacement_owner});const missing:string[]=[];if(completion.implementation_review!=='PASS')missing.push('implementation_review');if(completion.executable_contract_validation!=='PASS')missing.push('executable_contract_validation');if(completion.completion_preflight!=='PASS')missing.push('completion_preflight');if(completion.compatibility!=='PASS')missing.push('compatibility');if(completion.blocking_finding_count!==0)missing.push('blocking_findings');if(!completion.owner_boundary_unchanged)missing.push('owner_boundary');if(!completion.safety_boundary_unchanged)missing.push('safety_boundary');if(!completion.replacement_active)missing.push('replacement_active');if(missing.length)return result({...common,kind:'replacement_incomplete',candidate_id:candidate.candidate_id,missing_or_conflicting_evidence:missing})}
  if(input.terminal_graph.active_deprecated_candidate_ids.length){const first=input.terminal_graph.active_deprecated_candidate_ids[0];return result({...common,kind:'partial_retirement_blocked',first_blocked_candidate_id:first,blocker:'terminal_graph_retains_candidate',evidence_digest:input.terminal_graph.graph_digest})}
  return result({...common,retired_candidate_ids:CANDIDATE_IDS,retained_candidate_ids:[],kind:'terminal_migration_manifest_ready',terminal_manifest:input.expected_terminal_manifest,terminal_graph:input.terminal_graph})
}

export const M6_DEPRECATION_CANDIDATE_IDS=CANDIDATE_IDS
export const M6_TERMINAL_OWNER_CLASSES=OWNER_CLASSES
export const M6_REQUIRED_CONSUMER_SURFACES=REQUIRED_SURFACES
export const M6_ADDED_PATHS=ADDED_PATHS
export const M6_PREDECESSOR_PATH_BINDINGS=PREDECESSOR_PATH_BINDINGS
export const M6_REQUIRED_COMPLETION_SLICES=REQUIRED_SLICES
export const M6_REPLACEMENT_OWNER_CLASSES=REPLACEMENT_OWNER_CLASSES
export const M6_DEPRECATED_CLAIM_DIGESTS=CLAIM_DIGESTS
export const M6_CANONICAL_CLAIM_IDENTITIES=CLAIM_IDENTITIES
export const M6_REPLACEMENT_AUTHORITY_DIGESTS=REPLACEMENT_AUTHORITY_DIGESTS
export const M6_COMPLETION_AUTHORITIES=COMPLETION_AUTHORITIES
export const M6_CONSUMER_SURFACE_CLASSES=SURFACE_CLASSES
export const M6_CONSUMER_SURFACE_PATHS=SURFACE_PATHS
export const M6_TERMINAL_OWNER_MODEL=OWNER_MODEL
export const M6_TERMINAL_OWNER_EDGES=OWNER_EDGES
