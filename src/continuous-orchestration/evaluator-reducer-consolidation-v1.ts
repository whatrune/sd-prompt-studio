import {
  digestContinuousOrchestrationJsonV1 as digest,
  reduceContinuousOrchestrationV1,
  validateContinuousOrchestrationEventV1,
  validateContinuousOrchestrationStateV1,
  validateContinuationDecisionV1,
  validateEventAdmissionResultV1,
  validateGenericProgressRunnerProfilesV1,
  type CanonicalRecordUrl,
  type ClosedAdmissionResultV1,
  type ContinuousOrchestrationEventV1,
  type ContinuousOrchestrationReductionV1,
  type ContinuousOrchestrationStateV1,
  type FullGitSha,
  type GenericProgressRunnerProfilesV1,
  type PrUrl,
  type RouteBindingV1,
  type Sha256,
} from './index'
import {
  deriveProgressionDecisionPortShadowV1,
  validateActionGuardProofV1,
  validateAdmittedAuthorityBundleV1,
  validateFreshAuthoritySnapshotV1,
  validateProgressionDecisionPortV1,
  validateRouteBindingV1,
  type ActionGuardProofV1,
  type AdmittedAuthorityBundleV1,
  type FreshAuthoritySnapshotV1,
  type ProgressionDecisionPortV1,
} from './shared-proof-interfaces-v1'
import {
  validateAutomaticGateProgressionEvaluationResultV2,
  type AutomaticGateProgressionEvaluationResultV2,
} from '../automatic-gate-progression/index'
import {
  validateAuthorityRoutingBudgetCutoverInputV1,
  validateAuthorityRoutingBudgetCutoverResultV1,
  type AuthorityRoutingBudgetCutoverInputV1,
  type AuthorityRoutingBudgetCutoverResultV1,
} from './authority-routing-budget-cutover-v1'
import {
  validateCompletionCandidateProjectionCutoverInputV1,
  validateCompletionCandidateProjectionCutoverResultV1,
  type CompletionCandidateProjectionCutoverInputV1,
  type CompletionCandidateProjectionCutoverResultV1,
} from './completion-candidate-projection-cutover-v1'

export const EVALUATOR_REDUCER_CONSOLIDATION_INPUT_V1_VERSION = 'evaluator_reducer_consolidation_input_v1' as const
export const EVALUATOR_REDUCER_CONSOLIDATION_PROFILE_V1_VERSION = 'evaluator_reducer_consolidation_profile_v1' as const
export const EVALUATOR_REDUCER_CONSOLIDATION_RESULT_V1_VERSION = 'evaluator_reducer_consolidation_result_v1' as const
export const M5_PROTECTED_ACTION_SIMULATION_V1_VERSION = 'm5_protected_action_simulation_v1' as const
export const M5_EXPECTED_M4_MANIFEST_DIGEST = 'b66b3cec4a4be12eee5a149b9327d6b553174d39186270d73a069d768c97f6e6' as const

type JsonObject = Record<string, unknown>
type RejectionCode =
  | 'unknown_field'
  | 'missing_required_field'
  | 'forbidden_field'
  | 'invalid_type_or_format'
  | 'invalid_enum'
  | 'duplicate_set_member'
  | 'noncanonical_set_order'
  | 'invalid_conditional_matrix'
  | 'invalid_cross_input_binding'
type Problem = Readonly<{ code: RejectionCode; path: string }>

export interface EvaluatorReducerConsolidationProfileV1 {
  readonly profile_version: typeof EVALUATOR_REDUCER_CONSOLIDATION_PROFILE_V1_VERSION
  readonly feature_id: 'evaluator_reducer_consolidation'
  readonly mode: 'm5_consolidated_v1' | 'compatibility_wrapper_v1'
  readonly task_id: string
  readonly repository: string
  readonly assignment_revision: number
  readonly allowed_scope_digest: Sha256
  readonly profile_authority_record_url: CanonicalRecordUrl
  readonly expected_m4_manifest_digest: typeof M5_EXPECTED_M4_MANIFEST_DIGEST
  readonly profile_digest: Sha256
}

export interface M5ProtectedActionSimulationV1 {
  readonly simulation_version: typeof M5_PROTECTED_ACTION_SIMULATION_V1_VERSION
  readonly action: 'ready_for_review' | 'normal_merge_commit'
  readonly pr_state: 'open_draft' | 'open_ready' | 'closed_unmerged' | 'merged'
  readonly evaluation_snapshot_digest: Sha256
  readonly authorization_state: 'missing_approval' | 'authorized'
  readonly protected_action_guard_or_null: ActionGuardProofV1 | null
  readonly protected_executor_snapshot_or_null: FreshAuthoritySnapshotV1 | null
  readonly product_owner_approval_url_or_null: CanonicalRecordUrl | null
  readonly fresh_guard_count: 0 | 2
  readonly execution_performed: false
  readonly simulation_digest: Sha256
}

export interface EvaluatorReducerConsolidationInputV1 {
  readonly input_version: typeof EVALUATOR_REDUCER_CONSOLIDATION_INPUT_V1_VERSION
  readonly task_id: string
  readonly repository: string
  readonly authority_bundle: AdmittedAuthorityBundleV1
  readonly consolidation_profile: EvaluatorReducerConsolidationProfileV1
  readonly branch: string
  readonly worktree_identity: string
  readonly pr_url: PrUrl
  readonly head_sha: FullGitSha
  readonly current_main_sha: FullGitSha
  readonly state: ContinuousOrchestrationStateV1
  readonly event: ContinuousOrchestrationEventV1
  readonly profiles: GenericProgressRunnerProfilesV1
  readonly agp_result: AutomaticGateProgressionEvaluationResultV2
  readonly progression_decision_port: ProgressionDecisionPortV1
  readonly no_transition_binding_or_null: Readonly<{ future_event_type: string; future_event_role_id: string }> | null
  readonly route_binding_or_null: RouteBindingV1 | null
  readonly m3_input: AuthorityRoutingBudgetCutoverInputV1
  readonly m3_result: AuthorityRoutingBudgetCutoverResultV1
  readonly m4_input: CompletionCandidateProjectionCutoverInputV1
  readonly m4_result: CompletionCandidateProjectionCutoverResultV1
  readonly evaluation_snapshot: FreshAuthoritySnapshotV1
  readonly non_protected_action_guard_or_null: ActionGuardProofV1 | null
  readonly protected_action_simulation_or_null: M5ProtectedActionSimulationV1 | null
  readonly decision_url: CanonicalRecordUrl
  readonly evaluated_at: string
  readonly recovery_role_id_or_null: string | null
  readonly expected_prior_state_digest: Sha256
  readonly expected_m3_ledger_digest: Sha256
  readonly expected_m4_manifest_digest: typeof M5_EXPECTED_M4_MANIFEST_DIGEST
  readonly input_digest: Sha256
}

type ResultCommon = Readonly<{
  result_version: typeof EVALUATOR_REDUCER_CONSOLIDATION_RESULT_V1_VERSION
  input_digest: Sha256
  authority_bundle_digest: Sha256 | null
  profile_digest: Sha256 | null
  decision_port_digest: Sha256 | null
  m3_result_digest: Sha256 | null
  m4_result_digest: Sha256 | null
  agp_evaluator_invocation_count: 0
  decision_port_derivation_count: 0 | 1
  reducer_invocation_count: 0 | 1
  duplicate_precedence_invocation_count: 0
  fallback_reducer_invocation_count: 0
  hard_coded_role_inference_count: 0
  dispatch_intent_count: 0 | 1
  ledger_cas_operand_count: 0 | 1
  projection_request_count: 0 | 1
  completion_assessment_request_count: 0 | 1
  transport_invocation_count: 0
  write_invocation_count: 0
  protected_action_invocation_count: 0
  completion_decision_authored_count: 0
  finding_closure_count: 0
  issue_close_count: 0
  approval_invocation_count: 0
  state_changed: boolean
  result_digest: Sha256
}>

export type EvaluatorReducerConsolidationResultV1 =
  | (ResultCommon & Readonly<{
      kind: 'consolidated_transition'
      reduction: ContinuousOrchestrationReductionV1
      route_binding_or_null: RouteBindingV1 | null
      compatibility_wrapper_invoked: false
    }>)
  | (ResultCommon & Readonly<{
      kind: 'compatibility_wrapper_transition'
      reduction: ContinuousOrchestrationReductionV1
      route_binding_or_null: RouteBindingV1 | null
      parity_digest: Sha256
      consolidated_execution_invoked: false
    }>)
  | (ResultCommon & Readonly<{
      kind: 'no_transition'
      reason: 'replay_or_duplicate_event'
      state_byte_identical: true
      route_binding_or_null: null
    }>)
  | (ResultCommon & Readonly<{
      kind: 'waiting'
      reason: 'protected_action_external' | 'm3_external_wait' | 'm4_external_wait'
      required_role_id: string
      required_action_id: string
      route_binding_or_null: null
    }>)
  | (ResultCommon & Readonly<{
      kind: 'stopped'
      reason:
        | 'authority_conflict'
        | 'decision_port_conflict'
        | 'reducer_divergence'
        | 'route_conflict'
        | 'completion_conflict'
        | 'freshness_conflict'
        | 'protected_action_conflict'
        | 'budget_conflict'
        | 'internal_reducer_failure'
      recovery_role_id: string
      required_evidence_ids: readonly string[]
      route_binding_or_null: null
    }>)
  | (ResultCommon & Readonly<{
      kind: 'rejected'
      rejection: Readonly<{ code: RejectionCode; path: string; safe_message: string }>
      route_binding_or_null: null
    }>)

const object = (value: unknown): value is JsonObject => typeof value === 'object' && value !== null && !Array.isArray(value)
const owns = (value: JsonObject, key: string) => Object.prototype.hasOwnProperty.call(value, key)
const clone = <T>(value: T): T => structuredClone(value)
const freeze = <T>(value: T): T => {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value as JsonObject)) freeze(child)
  }
  return value
}
const without = (value: JsonObject, ...keys: string[]) => Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)))
const same = (left: unknown, right: unknown) => digest(left) === digest(right)
const nonEmpty = (value: unknown): value is string => typeof value === 'string' && value.length > 0
const sha = (value: unknown): value is Sha256 => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value)
const gitSha = (value: unknown): value is FullGitSha => typeof value === 'string' && /^[0-9a-f]{40}$/.test(value)
const canonical = (value: unknown): value is CanonicalRecordUrl => typeof value === 'string' && /^https:\/\/github\.com\/[^/]+\/[^/]+\/(?:issues|pull)\/[1-9]\d*(?:#issuecomment-[1-9]\d*)?$/.test(value)
const prUrl = (value: unknown): value is PrUrl => typeof value === 'string' && /^https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/[1-9]\d*$/.test(value)
const uint = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0
const utc = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value) && Number.isFinite(Date.parse(value))
const exact = (value: unknown, keys: readonly string[], path: string): Problem | undefined => {
  if (!object(value)) return { code: 'invalid_type_or_format', path }
  for (const key of keys) if (!owns(value, key)) return { code: 'missing_required_field', path: `${path}/${key}` }
  const unknown = Object.keys(value).find((key) => !keys.includes(key))
  return unknown ? { code: 'unknown_field', path: `${path}/${unknown}` } : undefined
}
const digestOk = (value: JsonObject, key: string) => sha(value[key]) && value[key] === digest(without(value, key))
const accepted = <T>(value: T): ClosedAdmissionResultV1<T> => freeze({ contract_version: 'closed-admission-result-v1', kind: 'accepted', value: freeze(clone(value)) })
const rejectedAdmission = <T>(problem: Problem): ClosedAdmissionResultV1<T> => freeze({ contract_version: 'closed-admission-result-v1', kind: 'rejected', rejection: { code: problem.code, path: problem.path, message: `rejected: ${problem.code}` } })
const failedAdmission = <T>(stage: string): ClosedAdmissionResultV1<T> => freeze({ contract_version: 'closed-admission-result-v1', kind: 'failed', failure: { code: 'validator_internal_failure', diagnostic_id: digest({ stage }), safe_message: 'validator failed internally' } })
const admit = <T>(stage: string, value: unknown, check: (value: JsonObject) => Problem | undefined): ClosedAdmissionResultV1<T> => {
  try {
    if (!object(value)) return rejectedAdmission({ code: 'invalid_type_or_format', path: '/' })
    const problem = check(value)
    return problem ? rejectedAdmission(problem) : accepted(value as T)
  } catch {
    return failedAdmission(stage)
  }
}

const profileKeys = ['profile_version','feature_id','mode','task_id','repository','assignment_revision','allowed_scope_digest','profile_authority_record_url','expected_m4_manifest_digest','profile_digest'] as const
const simulationKeys = ['simulation_version','action','pr_state','evaluation_snapshot_digest','authorization_state','protected_action_guard_or_null','protected_executor_snapshot_or_null','product_owner_approval_url_or_null','fresh_guard_count','execution_performed','simulation_digest'] as const
const inputKeys = ['input_version','task_id','repository','authority_bundle','consolidation_profile','branch','worktree_identity','pr_url','head_sha','current_main_sha','state','event','profiles','agp_result','progression_decision_port','no_transition_binding_or_null','route_binding_or_null','m3_input','m3_result','m4_input','m4_result','evaluation_snapshot','non_protected_action_guard_or_null','protected_action_simulation_or_null','decision_url','evaluated_at','recovery_role_id_or_null','expected_prior_state_digest','expected_m3_ledger_digest','expected_m4_manifest_digest','input_digest'] as const
const freshMutableKeys = ['main_sha_or_null','pr_url_or_null','pr_head_sha_or_null','pr_base_sha_or_null','pr_state','check_set_digest_or_null','finding_set_digest','thread_set_digest','workspace_binding_digest_or_null','workspace_state','gsp_generation_or_null','gsp_body_digest_or_null','approval_consumption_digest_or_null'] as const

const profileProblem = (value: unknown, path = '/consolidation_profile'): Problem | undefined => {
  const problem = exact(value, profileKeys, path)
  if (problem) return problem
  const profile = value as JsonObject
  if (profile.profile_version !== EVALUATOR_REDUCER_CONSOLIDATION_PROFILE_V1_VERSION || profile.feature_id !== 'evaluator_reducer_consolidation' || !['m5_consolidated_v1','compatibility_wrapper_v1'].includes(String(profile.mode)) || !nonEmpty(profile.task_id) || !nonEmpty(profile.repository) || !uint(profile.assignment_revision) || !sha(profile.allowed_scope_digest) || !canonical(profile.profile_authority_record_url) || profile.expected_m4_manifest_digest !== M5_EXPECTED_M4_MANIFEST_DIGEST) return { code: 'invalid_type_or_format', path }
  return digestOk(profile, 'profile_digest') ? undefined : { code: 'invalid_cross_input_binding', path: `${path}/profile_digest` }
}

const simulationProblem = (value: unknown, path = '/protected_action_simulation_or_null'): Problem | undefined => {
  const problem = exact(value, simulationKeys, path)
  if (problem) return problem
  const simulation = value as JsonObject
  if (simulation.simulation_version !== M5_PROTECTED_ACTION_SIMULATION_V1_VERSION || !['ready_for_review','normal_merge_commit'].includes(String(simulation.action)) || !['open_draft','open_ready','closed_unmerged','merged'].includes(String(simulation.pr_state)) || !sha(simulation.evaluation_snapshot_digest) || !['missing_approval','authorized'].includes(String(simulation.authorization_state)) || !(simulation.product_owner_approval_url_or_null === null || canonical(simulation.product_owner_approval_url_or_null)) || ![0,2].includes(Number(simulation.fresh_guard_count)) || simulation.execution_performed !== false) return { code: 'invalid_type_or_format', path }
  const missing = simulation.authorization_state === 'missing_approval'
  if (missing) {
    if (simulation.protected_action_guard_or_null !== null || simulation.protected_executor_snapshot_or_null !== null || simulation.product_owner_approval_url_or_null !== null || simulation.fresh_guard_count !== 0) return { code: 'invalid_conditional_matrix', path }
  } else {
    if (simulation.protected_action_guard_or_null === null || simulation.protected_executor_snapshot_or_null === null || simulation.product_owner_approval_url_or_null === null || simulation.fresh_guard_count !== 2) return { code: 'invalid_conditional_matrix', path }
    if (validateFreshAuthoritySnapshotV1(simulation.protected_executor_snapshot_or_null).kind !== 'accepted') return { code: 'invalid_cross_input_binding', path: `${path}/protected_executor_snapshot_or_null` }
  }
  return digestOk(simulation, 'simulation_digest') ? undefined : { code: 'invalid_cross_input_binding', path: `${path}/simulation_digest` }
}

const inputProblem = (input: JsonObject): Problem | undefined => {
  let problem = exact(input, inputKeys, '/input')
  if (problem) return problem
  if (input.input_version !== EVALUATOR_REDUCER_CONSOLIDATION_INPUT_V1_VERSION || !nonEmpty(input.task_id) || !nonEmpty(input.repository) || !nonEmpty(input.branch) || !nonEmpty(input.worktree_identity) || !prUrl(input.pr_url) || !gitSha(input.head_sha) || !gitSha(input.current_main_sha) || !canonical(input.decision_url) || !utc(input.evaluated_at) || !(input.recovery_role_id_or_null === null || nonEmpty(input.recovery_role_id_or_null)) || !sha(input.expected_prior_state_digest) || !sha(input.expected_m3_ledger_digest) || input.expected_m4_manifest_digest !== M5_EXPECTED_M4_MANIFEST_DIGEST) return { code: 'invalid_type_or_format', path: '/input' }
  problem = profileProblem(input.consolidation_profile)
  if (problem) return problem
  if (validateAdmittedAuthorityBundleV1(input.authority_bundle).kind !== 'accepted') return { code: 'invalid_cross_input_binding', path: '/input/authority_bundle' }
  if (validateGenericProgressRunnerProfilesV1(input.profiles).kind !== 'accepted') return { code: 'invalid_cross_input_binding', path: '/input/profiles' }
  if (validateContinuousOrchestrationStateV1(input.state, input.profiles as GenericProgressRunnerProfilesV1).kind !== 'accepted') return { code: 'invalid_cross_input_binding', path: '/input/state' }
  if (validateContinuousOrchestrationEventV1(input.event).kind !== 'accepted') return { code: 'invalid_cross_input_binding', path: '/input/event' }
  if (validateAutomaticGateProgressionEvaluationResultV2(input.agp_result).kind !== 'accepted') return { code: 'invalid_cross_input_binding', path: '/input/agp_result' }
  if (validateProgressionDecisionPortV1(input.progression_decision_port).kind !== 'accepted') return { code: 'invalid_cross_input_binding', path: '/input/progression_decision_port' }
  if (validateAuthorityRoutingBudgetCutoverInputV1(input.m3_input).kind !== 'accepted') return { code: 'invalid_cross_input_binding', path: '/input/m3_input' }
  if (validateAuthorityRoutingBudgetCutoverResultV1(input.m3_result).kind !== 'accepted') return { code: 'invalid_cross_input_binding', path: '/input/m3_result' }
  if (validateCompletionCandidateProjectionCutoverInputV1(input.m4_input).kind !== 'accepted') return { code: 'invalid_cross_input_binding', path: '/input/m4_input' }
  if (validateCompletionCandidateProjectionCutoverResultV1(input.m4_result).kind !== 'accepted') return { code: 'invalid_cross_input_binding', path: '/input/m4_result' }
  if (input.no_transition_binding_or_null !== null) {
    problem = exact(input.no_transition_binding_or_null, ['future_event_type','future_event_role_id'], '/input/no_transition_binding_or_null')
    if (problem) return problem
    const binding = input.no_transition_binding_or_null as JsonObject
    if (!nonEmpty(binding.future_event_type) || !nonEmpty(binding.future_event_role_id)) return { code: 'invalid_type_or_format', path: '/input/no_transition_binding_or_null' }
  }
  if (input.route_binding_or_null !== null && validateRouteBindingV1(input.route_binding_or_null).kind !== 'accepted') return { code: 'invalid_cross_input_binding', path: '/input/route_binding_or_null' }
  if (validateFreshAuthoritySnapshotV1(input.evaluation_snapshot).kind !== 'accepted') return { code: 'invalid_cross_input_binding', path: '/input/evaluation_snapshot' }
  if (input.non_protected_action_guard_or_null !== null && validateActionGuardProofV1(input.non_protected_action_guard_or_null, input.evaluation_snapshot as FreshAuthoritySnapshotV1).kind !== 'accepted') return { code: 'invalid_cross_input_binding', path: '/input/non_protected_action_guard_or_null' }
  if (input.protected_action_simulation_or_null !== null) {
    problem = simulationProblem(input.protected_action_simulation_or_null)
    if (problem) return problem
  }
  const bundle = input.authority_bundle as unknown as AdmittedAuthorityBundleV1
  const profile = input.consolidation_profile as unknown as EvaluatorReducerConsolidationProfileV1
  const port = input.progression_decision_port as unknown as ProgressionDecisionPortV1
  const m3Input = input.m3_input as unknown as AuthorityRoutingBudgetCutoverInputV1
  const m3 = input.m3_result as unknown as AuthorityRoutingBudgetCutoverResultV1
  const m4Input = input.m4_input as unknown as CompletionCandidateProjectionCutoverInputV1
  const m4 = input.m4_result as unknown as CompletionCandidateProjectionCutoverResultV1
  const snapshot = input.evaluation_snapshot as unknown as FreshAuthoritySnapshotV1
  const state = input.state as unknown as ContinuousOrchestrationStateV1
  const event = input.event as unknown as ContinuousOrchestrationEventV1
  if (m3.kind === 'rejected' || bundle.task_id !== input.task_id || bundle.repository !== input.repository || profile.task_id !== input.task_id || profile.repository !== input.repository || profile.assignment_revision !== bundle.assignment_revision || profile.allowed_scope_digest !== bundle.scope_digest || m3.authority_bundle_digest !== bundle.bundle_digest || m3.next_repair_ledger.task_id !== input.task_id || m3.next_repair_ledger.repository !== input.repository || m3.next_repair_ledger.assignment_revision !== bundle.assignment_revision || m3.next_repair_ledger.ledger_digest !== input.expected_m3_ledger_digest || m4Input.task_id !== input.task_id || m4Input.repository !== input.repository || m4Input.branch !== input.branch || m4Input.worktree_identity !== input.worktree_identity || m4Input.pr_url !== input.pr_url || m4Input.head_sha !== input.head_sha || m4Input.current_main_sha !== input.current_main_sha || !same(m4Input.authority_bundle, bundle) || m4.input_digest !== m4Input.input_digest || m4.authority_bundle_digest !== bundle.bundle_digest || m4.candidate_authority_ref_digest !== m4Input.candidate_authority_ref.ref_digest || m4Input.candidate_authority_ref.task_id !== input.task_id || m4Input.candidate_authority_ref.repository !== input.repository || m4Input.candidate_authority_ref.working_head_sha !== input.head_sha || !same(snapshot, bundle.fresh_snapshot) || !same(m4Input.evaluation_snapshot, snapshot) || snapshot.purpose !== 'evaluation' || snapshot.main_sha_or_null !== input.current_main_sha || snapshot.pr_url_or_null !== input.pr_url || snapshot.pr_head_sha_or_null !== input.head_sha || state.task_id !== input.task_id || state.repository !== input.repository || state.assignment_revision !== bundle.assignment_revision || event.task_id !== input.task_id || event.assignment_revision !== bundle.assignment_revision || event.authority_snapshot_digest !== state.authority_snapshot.snapshot_digest || (input.agp_result as JsonObject).task_id !== input.task_id || port.source_result_kind !== (input.agp_result as JsonObject).kind || port.source_result_digest !== digest(input.agp_result) || profile.expected_m4_manifest_digest !== input.expected_m4_manifest_digest || input.expected_prior_state_digest !== digest(state)) return { code: 'invalid_cross_input_binding', path: '/input/authority_binding' }
  const m3Profile = m3Input.cutover_profile
  const m3Budget = m3Input.repair_budget_profile
  const m3PriorLedger = m3Input.repair_attempt_ledger
  if (!same(m3Input.state, state) || !same(m3Input.event, event) || !same(m3Input.profiles, input.profiles) || !same(m3Input.evaluation, port.projected_result) || m3Input.decision_url !== input.decision_url || m3Input.evaluated_at !== input.evaluated_at || m3Input.recovery_role_id_or_null !== input.recovery_role_id_or_null || !same(m3Input.authority_bundle, bundle) || m3Input.expected_prior_state_digest !== input.expected_prior_state_digest || m3Input.expected_prior_ledger_digest !== m3PriorLedger.ledger_digest || m3Profile.profile_authority_record_url !== profile.profile_authority_record_url || m3Budget.authority_record_url !== profile.profile_authority_record_url || m3Profile.task_id !== input.task_id || m3Profile.repository !== input.repository || m3Profile.assignment_revision !== bundle.assignment_revision || m3Profile.allowed_scope_digest !== bundle.scope_digest || m3Profile.expected_prior_state_digest !== input.expected_prior_state_digest || m3Profile.expected_prior_ledger_digest !== m3PriorLedger.ledger_digest || m3Budget.task_id !== input.task_id || m3Budget.repository !== input.repository || m3Budget.assignment_revision !== bundle.assignment_revision || m3Budget.allowed_scope_digest !== bundle.scope_digest || m3Budget.semantic_epoch_id !== state.semantic_counter_epoch.epoch_id || m3PriorLedger.task_id !== input.task_id || m3PriorLedger.repository !== input.repository || m3PriorLedger.assignment_revision !== bundle.assignment_revision || m3PriorLedger.semantic_epoch_id !== m3Budget.semantic_epoch_id || m3PriorLedger.profile_digest !== m3Budget.profile_digest || m3.profile_digest !== m3Profile.profile_digest || m3.route_selection_digest !== m3Input.route_selection.selection_digest || m3.next_repair_ledger.profile_digest !== m3Budget.profile_digest || m3.next_repair_ledger.semantic_epoch_id !== m3Budget.semantic_epoch_id || m3.checkpoint_required !== (m3PriorLedger.cycle_ledger.decision_count_without_progress >= 32)) return { code: 'invalid_cross_input_binding', path: '/input/m3_input/result_binding' }
  if (m3Input.combined_task_assignment_authority.active_profile_authority_url !== m3Profile.profile_authority_record_url || m3Input.combined_task_assignment_authority.active_profile_mode !== m3Profile.mode || m3Input.combined_task_assignment_authority.scope_digest !== m3Budget.allowed_scope_digest || m3Input.combined_task_assignment_authority.fresh_snapshot_digest !== bundle.fresh_snapshot.snapshot_digest || m3Input.combined_task_assignment_authority.branch_name !== input.branch || m3Input.combined_task_assignment_authority.worktree_binding_digest !== digest({ worktree_identity: input.worktree_identity }) || m3Input.combined_task_assignment_authority.pr_url !== input.pr_url || m3Input.combined_task_assignment_authority.pr_head_sha !== input.head_sha) return { code: 'invalid_cross_input_binding', path: '/input/m3_input/combined_task_assignment_authority' }
  if (m3Input.route_selection.kind === 'route') {
    if (input.route_binding_or_null === null || !same(m3Input.route_selection.binding, input.route_binding_or_null) || m3Input.route_selection.branch !== input.branch || m3Input.route_selection.worktree_identity !== input.worktree_identity || m3Input.route_selection.pr_url_or_null !== input.pr_url || m3Input.route_selection.head_sha_or_null !== input.head_sha) return { code: 'invalid_cross_input_binding', path: '/input/m3_input/route_selection' }
  } else if (input.route_binding_or_null !== null) return { code: 'invalid_cross_input_binding', path: '/input/m3_input/route_selection' }
  if (m3Input.repair_attempt_evidence_or_null === null) {
    if (!same(m3.next_repair_ledger, m3PriorLedger) || m3.ledger_cas_operand_or_null !== null) return { code: 'invalid_cross_input_binding', path: '/input/m3_result/next_repair_ledger' }
  } else if (m3.ledger_cas_operand_or_null !== null) {
    const operand = m3.ledger_cas_operand_or_null
    if (operand.task_id !== input.task_id || operand.repository !== input.repository || operand.assignment_revision !== bundle.assignment_revision || operand.semantic_epoch_id !== m3Budget.semantic_epoch_id || operand.expected_prior_ledger_digest !== m3PriorLedger.ledger_digest || operand.next_ledger_digest !== m3.next_repair_ledger.ledger_digest || operand.attempt_idempotency_key !== m3Input.repair_attempt_evidence_or_null.idempotency_key || operand.expected_state_digest !== input.expected_prior_state_digest || operand.route_digest !== m3Input.route_selection.selection_digest || operand.authority_bundle_digest !== bundle.bundle_digest) return { code: 'invalid_cross_input_binding', path: '/input/m3_result/ledger_cas_operand_or_null' }
  }
  if (m3.prepared_route_authority_binding_or_null !== null) {
    const prepared = m3.prepared_route_authority_binding_or_null
    if (prepared.combined_task_assignment_authority_digest !== m3Input.combined_task_assignment_authority.combined_task_assignment_authority_digest || prepared.route_selection_digest !== m3Input.route_selection.selection_digest || prepared.branch_name !== input.branch || prepared.worktree_binding_digest !== m3Input.combined_task_assignment_authority.worktree_binding_digest || prepared.pr_url !== input.pr_url || prepared.pr_head_sha !== input.head_sha || prepared.scope_digest !== bundle.scope_digest || prepared.fresh_snapshot_digest !== bundle.fresh_snapshot.snapshot_digest || prepared.active_profile_authority_url !== m3Profile.profile_authority_record_url || prepared.active_profile_mode !== m3Profile.mode || prepared.expected_state_digest !== input.expected_prior_state_digest) return { code: 'invalid_cross_input_binding', path: '/input/m3_result/prepared_route_authority_binding_or_null' }
  }
  const routeRequired = port.projected_result.kind === 'recommend_next_role'
  if (routeRequired !== (input.route_binding_or_null !== null)) return { code: 'invalid_conditional_matrix', path: '/input/route_binding_or_null' }
  const dispatch = m3.kind === 'cutover_accepted' || m3.kind === 'legacy_profile_accepted' ? m3.dispatch_intent_or_null : null
  if (input.route_binding_or_null !== null && (!dispatch || !same(dispatch.route_binding, input.route_binding_or_null) || dispatch.task_id !== input.task_id || dispatch.repository !== input.repository || dispatch.branch !== input.branch || dispatch.worktree_identity !== input.worktree_identity || dispatch.pr_url_or_null !== input.pr_url || dispatch.head_sha_or_null !== input.head_sha || dispatch.scope_digest !== bundle.scope_digest)) return { code: 'invalid_cross_input_binding', path: '/input/m3_result/dispatch_intent_or_null' }
  if (input.route_binding_or_null === null && dispatch !== null) return { code: 'invalid_cross_input_binding', path: '/input/m3_result/dispatch_intent_or_null' }
  if ((port.source_result_kind === 'no_transition') !== (input.no_transition_binding_or_null !== null)) return { code: 'invalid_conditional_matrix', path: '/input/no_transition_binding_or_null' }
  if ((port.source_result_kind === 'wait_for_protected_action') !== (input.protected_action_simulation_or_null !== null)) return { code: 'invalid_conditional_matrix', path: '/input/protected_action_simulation_or_null' }
  const guard = input.non_protected_action_guard_or_null as ActionGuardProofV1 | null
  const simulation = input.protected_action_simulation_or_null as M5ProtectedActionSimulationV1 | null
  if (guard !== null && guard.guard_scope !== 'non_protected_transport') return { code: 'invalid_conditional_matrix', path: '/input/non_protected_action_guard_or_null/guard_scope' }
  if (simulation !== null) {
    if (port.projected_result.kind !== 'wait_for_protected_action' || simulation.action !== port.projected_result.protected_action_id || simulation.evaluation_snapshot_digest !== snapshot.snapshot_digest || simulation.pr_state !== snapshot.pr_state) return { code: 'invalid_cross_input_binding', path: '/input/protected_action_simulation_or_null/evaluation_snapshot_digest' }
    if (simulation.authorization_state === 'authorized') {
      const actionGuard = simulation.protected_action_guard_or_null!
      const executorSnapshot = simulation.protected_executor_snapshot_or_null!
      if (validateActionGuardProofV1(actionGuard, snapshot).kind !== 'accepted' || actionGuard.guard_scope !== 'protected_action' || actionGuard.action_id !== simulation.action || actionGuard.approval_record_url_or_null !== simulation.product_owner_approval_url_or_null || executorSnapshot.purpose !== 'action_guard' || Date.parse(executorSnapshot.observed_at) <= Date.parse(actionGuard.action_snapshot.observed_at) || executorSnapshot.task_id !== input.task_id || executorSnapshot.repository !== input.repository || executorSnapshot.assignment_revision !== bundle.assignment_revision || executorSnapshot.pr_url_or_null !== input.pr_url || executorSnapshot.pr_head_sha_or_null !== input.head_sha || executorSnapshot.pr_base_sha_or_null !== snapshot.pr_base_sha_or_null || executorSnapshot.pr_state !== snapshot.pr_state || executorSnapshot.main_sha_or_null !== input.current_main_sha || executorSnapshot.approval_consumption_digest_or_null !== snapshot.approval_consumption_digest_or_null || executorSnapshot.check_set_digest_or_null !== snapshot.check_set_digest_or_null || executorSnapshot.finding_set_digest !== snapshot.finding_set_digest || executorSnapshot.thread_set_digest !== snapshot.thread_set_digest || executorSnapshot.gsp_generation_or_null !== snapshot.gsp_generation_or_null || executorSnapshot.gsp_body_digest_or_null !== snapshot.gsp_body_digest_or_null || executorSnapshot.workspace_binding_digest_or_null !== snapshot.workspace_binding_digest_or_null || executorSnapshot.workspace_state !== snapshot.workspace_state || !same(executorSnapshot.collected_from, actionGuard.action_snapshot.collected_from) || freshMutableKeys.some((key) => !same(executorSnapshot[key], actionGuard.action_snapshot[key]))) return { code: 'invalid_cross_input_binding', path: '/input/protected_action_simulation_or_null/protected_action_guard_or_null' }
    }
  }
  const completionDecision = m4Input.completion_decision_or_null
  const completionCandidate = m4Input.completion_evidence_candidate_or_null
  if (m4.kind === 'completion_decision_admitted') {
    if (!completionDecision || !completionCandidate || m4.completion_decision_binding_digest !== completionDecision.binding_digest || completionDecision.completion_evidence_candidate_digest !== completionCandidate.candidate_digest || completionDecision.candidate_authority_ref_digest !== m4Input.candidate_authority_ref.ref_digest || completionDecision.pr_head_sha !== input.head_sha || completionDecision.current_main_sha !== input.current_main_sha || completionDecision.gsp_generation !== completionCandidate.gsp_generation || completionDecision.gsp_gate_rows_digest !== completionCandidate.gsp_gate_rows_digest || completionDecision.blocking_finding_count !== 0 || completionDecision.unresolved_thread_count !== 0 || completionCandidate.blocking_finding_count !== 0 || completionCandidate.open_finding_count !== 0 || completionCandidate.unresolved_thread_count !== 0 || completionCandidate.exact_head_sha !== input.head_sha || completionCandidate.current_main_sha !== input.current_main_sha || completionCandidate.candidate_authority_ref.ref_digest !== m4Input.candidate_authority_ref.ref_digest) return { code: 'invalid_cross_input_binding', path: '/input/m4_input/completion_decision_or_null' }
  } else if (completionDecision !== null) return { code: 'invalid_cross_input_binding', path: '/input/m4_result' }
  if (state.phase === 'completed' && m4.kind !== 'completion_decision_admitted') return { code: 'invalid_cross_input_binding', path: '/input/m4_result' }
  return digestOk(input, 'input_digest') ? undefined : { code: 'invalid_cross_input_binding', path: '/input/input_digest' }
}

export const validateEvaluatorReducerConsolidationProfileV1 = (value: unknown): ClosedAdmissionResultV1<EvaluatorReducerConsolidationProfileV1> => admit('m5_profile', value, (input) => profileProblem(input))
export const validateM5ProtectedActionSimulationV1 = (value: unknown): ClosedAdmissionResultV1<M5ProtectedActionSimulationV1> => admit('m5_protected_simulation', value, (input) => simulationProblem(input))
export const validateEvaluatorReducerConsolidationInputV1 = (value: unknown): ClosedAdmissionResultV1<EvaluatorReducerConsolidationInputV1> => admit('m5_input', value, inputProblem)

const zero = {
  agp_evaluator_invocation_count: 0 as const,
  duplicate_precedence_invocation_count: 0 as const,
  fallback_reducer_invocation_count: 0 as const,
  hard_coded_role_inference_count: 0 as const,
  transport_invocation_count: 0 as const,
  write_invocation_count: 0 as const,
  protected_action_invocation_count: 0 as const,
  completion_decision_authored_count: 0 as const,
  finding_closure_count: 0 as const,
  issue_close_count: 0 as const,
  approval_invocation_count: 0 as const,
}
const common = (input: EvaluatorReducerConsolidationInputV1, decisionPortDerivationCount: 0 | 1, reducerInvocationCount: 0 | 1, stateChanged: boolean) => ({
  result_version: EVALUATOR_REDUCER_CONSOLIDATION_RESULT_V1_VERSION,
  input_digest: input.input_digest,
  authority_bundle_digest: input.authority_bundle.bundle_digest,
  profile_digest: input.consolidation_profile.profile_digest,
  decision_port_digest: input.progression_decision_port.port_digest,
  m3_result_digest: input.m3_result.cutover_evidence_digest,
  m4_result_digest: input.m4_result.result_digest,
  ...zero,
  decision_port_derivation_count: decisionPortDerivationCount,
  reducer_invocation_count: reducerInvocationCount,
  dispatch_intent_count: input.m3_result.kind !== 'rejected' && input.m3_result.dispatch_intent_or_null !== null ? 1 as const : 0 as const,
  ledger_cas_operand_count: input.m3_result.kind !== 'rejected' && input.m3_result.ledger_cas_operand_or_null !== null ? 1 as const : 0 as const,
  projection_request_count: input.m4_result.kind === 'projection_publication_required' ? 1 as const : 0 as const,
  completion_assessment_request_count: input.m4_result.kind === 'completion_assessment_required' ? 1 as const : 0 as const,
  state_changed: stateChanged,
})
const sealResult = <T extends JsonObject>(value: T): EvaluatorReducerConsolidationResultV1 => freeze({ ...clone(value), result_digest: digest(value) } as unknown as EvaluatorReducerConsolidationResultV1)
const rejectResult = (raw: unknown, problem: Problem): EvaluatorReducerConsolidationResultV1 => {
  const inputDigest = object(raw) && sha(raw.input_digest) ? raw.input_digest : digest({ invalid_input: true })
  const base = {
    result_version: EVALUATOR_REDUCER_CONSOLIDATION_RESULT_V1_VERSION,
    input_digest: inputDigest,
    authority_bundle_digest: null,
    profile_digest: null,
    decision_port_digest: null,
    m3_result_digest: null,
    m4_result_digest: null,
    ...zero,
    decision_port_derivation_count: 0 as const,
    reducer_invocation_count: 0 as const,
    dispatch_intent_count: 0 as const,
    ledger_cas_operand_count: 0 as const,
    projection_request_count: 0 as const,
    completion_assessment_request_count: 0 as const,
    state_changed: false,
    kind: 'rejected' as const,
    rejection: { code: problem.code, path: problem.path, safe_message: `rejected: ${problem.code}` },
    route_binding_or_null: null,
  }
  return sealResult(base)
}
const stopped = (input: EvaluatorReducerConsolidationInputV1, reason: Extract<EvaluatorReducerConsolidationResultV1,{kind:'stopped'}>['reason'], owner: string, ids: string[], derivations: 0 | 1, reducers: 0 | 1): EvaluatorReducerConsolidationResultV1 => sealResult({ ...common(input, derivations, reducers, false), kind: 'stopped' as const, reason, recovery_role_id: owner, required_evidence_ids: [...ids], route_binding_or_null: null })

const expectedDecisionBranch = (input: EvaluatorReducerConsolidationInputV1, decision: NonNullable<ContinuousOrchestrationReductionV1['decision']>): boolean => {
  const projected = input.progression_decision_port.projected_result
  if (projected.kind === 'recommend_next_role') {
    if (!['dispatch_role','request_independent_review'].includes(decision.branch) || !('route_binding' in decision)) return false
    const route = input.route_binding_or_null
    if (route === null || !same(decision.route_binding, route) || decision.next_owner_role_id !== projected.target_role_id || route.role_id !== projected.target_role_id || route.action_id !== projected.next_action_id) return false
    if (decision.branch === 'dispatch_role') return decision.reason_code === 'declared_next_role' && decision.predecessor_canonical_url === projected.predecessor_canonical_url && decision.target_head_sha_or_null === projected.target_head_sha_or_null && route.independent_from_role_id_or_null === null
    return decision.reason_code === 'independent_review_required' && decision.reviewed_head_sha_or_null === projected.target_head_sha_or_null && decision.review_scope_digest === route.allowed_scope_digest && route.independent_from_role_id_or_null !== null
  }
  if (projected.kind === 'require_gate_status_update') {
    const routes = input.profiles.route_binding_table.bindings.filter((route) => route.transition_class === 'metadata_sync')
    return routes.length === 1 && decision.branch === 'request_metadata_sync' && decision.reason_code === 'metadata_projection_mismatch' && same(decision.route_binding, routes[0]) && decision.next_owner_role_id === routes[0].role_id && decision.pr_url === input.pr_url && decision.head_sha === input.head_sha && decision.must_verify_after_write === true
  }
  if (projected.kind === 'invalidate_approval') return decision.branch === 'invalidate_authority' && decision.reason_code === 'authority_drift' && decision.invalidation_class === projected.invalidation_class && decision.controller_condition === 'authority_drift' && decision.terminal_stop_reason === 'external_blocker' && decision.result_handoff_status === 'blocked' && decision.automatic_resume === true
  if (projected.kind === 'stop') {
    if (projected.stop_condition === 'external_blocker') return decision.branch === 'await_external_recovery' && decision.reason_code === 'external_recovery_required' && decision.controller_condition === 'external_blocker' && decision.terminal_stop_reason === 'external_blocker' && decision.recovery_role_id === projected.recovery_role_id && decision.automatic_resume === true
    return decision.branch === 'stop' && decision.reason_code === (projected.stop_condition === 'blocking_finding' ? 'repeated_finding_failure' : projected.stop_condition) && decision.recovery_role_id === projected.recovery_role_id && decision.automatic_resume === false
  }
  if (projected.kind === 'no_transition') return decision.branch === 'no_transition' && decision.reason_code === 'no_declared_transition' && decision.required_future_event_type === projected.future_event_type && decision.future_event_role_id === projected.future_event_role_id && decision.next_owner_role_id === projected.future_event_role_id
  return false
}

export function runEvaluatorReducerConsolidationV1(raw: unknown): EvaluatorReducerConsolidationResultV1 {
  const admission = validateEvaluatorReducerConsolidationInputV1(raw)
  if (admission.kind === 'rejected') return rejectResult(raw, { code: admission.rejection.code as RejectionCode, path: admission.rejection.path })
  if (admission.kind === 'failed') return rejectResult(raw, { code: 'invalid_type_or_format', path: '/input' })
  const input = admission.value
  if (input.m3_result.kind === 'rejected') return stopped(input, 'authority_conflict', 'backend_architect', ['m3_result','rejected'], 0, 0)
  const derived = deriveProgressionDecisionPortShadowV1(input.agp_result, input.no_transition_binding_or_null ?? undefined)
  if (derived.kind !== 'accepted' || !same(derived.value, input.progression_decision_port)) return stopped(input, 'decision_port_conflict', 'backend_architect', ['agp_result','progression_decision_port'], 1, 0)
  if (input.progression_decision_port.source_result_kind === 'wait_for_protected_action') {
    const simulation = input.protected_action_simulation_or_null!
    if (input.m3_result.kind !== 'stopped' || input.m3_result.stop_class !== 'protected_action_wait' || input.m3_result.reduction_or_null !== null || input.m3_result.action_guard_status !== 'protected_wait') return stopped(input, 'protected_action_conflict', 'backend_architect', ['m3_result','protected_action_wait'], 1, 0)
    if (simulation.pr_state === 'closed_unmerged' || simulation.pr_state === 'merged') return stopped(input, 'protected_action_conflict', 'integrated_lead', ['protected_action_simulation','pr_state'], 1, 0)
    const requiredRole = simulation.authorization_state === 'missing_approval' ? 'product_owner' : 'integrated_lead'
    return sealResult({ ...common(input, 1, 0, false), kind: 'waiting' as const, reason: 'protected_action_external' as const, required_role_id: requiredRole, required_action_id: simulation.action, route_binding_or_null: null })
  }
  if (input.m3_result.kind === 'stopped') return stopped(input, input.m3_result.stop_class === 'authority_conflict' || input.m3_result.stop_class === 'ambiguous_route' || input.m3_result.stop_class === 'freshness_required' || input.m3_result.stop_class === 'stale_cas' ? 'authority_conflict' : 'budget_conflict', 'backend_architect', ['m3_result',input.m3_result.stop_class], 1, 0)
  if (input.m4_result.kind === 'stopped') return stopped(input, 'completion_conflict', 'independent_completion_assessor', ['m4_result',input.m4_result.reason], 1, 0)
  if (input.m4_result.kind === 'waiting') return sealResult({ ...common(input, 1, 0, false), kind: 'waiting' as const, reason: 'm4_external_wait' as const, required_role_id: input.m4_result.required_role_id, required_action_id: input.m4_result.required_evidence_ids[0], route_binding_or_null: null })
  let reduction: ContinuousOrchestrationReductionV1
  try {
    reduction = reduceContinuousOrchestrationV1(input.state, input.event, input.profiles, input.progression_decision_port.projected_result, input.decision_url, input.evaluated_at, input.recovery_role_id_or_null)
  } catch {
    return stopped(input, 'internal_reducer_failure', 'backend_architect', ['reducer_validation'], 1, 1)
  }
  if (reduction.admission?.branch === 'replay' || (reduction.admission === null && reduction.decision === null && reduction.terminal_no_mutation)) {
    if (!same(reduction.state, input.state) || (reduction.admission === null && !reduction.terminal_no_mutation)) return stopped(input, 'reducer_divergence', 'backend_architect', ['replay_state'], 1, 1)
    return sealResult({ ...common(input, 1, 1, false), kind: 'no_transition' as const, reason: 'replay_or_duplicate_event' as const, state_byte_identical: true as const, route_binding_or_null: null })
  }
  const decision = reduction.decision
  if (!decision || !expectedDecisionBranch(input, decision)) return stopped(input, 'reducer_divergence', 'backend_architect', ['decision_branch','progression_decision_port'], 1, 1)
  if (!same(reduction, input.m3_result.reduction)) return stopped(input, 'reducer_divergence', 'backend_architect', ['m3_result','reduction'], 1, 1)
  const decisionRoute = 'route_binding' in decision ? decision.route_binding : null
  if (input.progression_decision_port.projected_result.kind === 'recommend_next_role' && !same(decisionRoute, input.route_binding_or_null)) return stopped(input, 'route_conflict', 'backend_architect', ['route_binding'], 1, 1)
  if (input.consolidation_profile.mode === 'compatibility_wrapper_v1') {
    return sealResult({ ...common(input, 1, 1, reduction.state.state_revision !== input.state.state_revision), kind: 'compatibility_wrapper_transition' as const, reduction, route_binding_or_null: decisionRoute, parity_digest: digest({ decision: reduction.decision, state: reduction.state, cas_projection: reduction.cas_projection }), consolidated_execution_invoked: false as const })
  }
  return sealResult({ ...common(input, 1, 1, reduction.state.state_revision !== input.state.state_revision), kind: 'consolidated_transition' as const, reduction, route_binding_or_null: decisionRoute, compatibility_wrapper_invoked: false as const })
}

const commonResultKeys = ['result_version','input_digest','authority_bundle_digest','profile_digest','decision_port_digest','m3_result_digest','m4_result_digest','agp_evaluator_invocation_count','decision_port_derivation_count','reducer_invocation_count','duplicate_precedence_invocation_count','fallback_reducer_invocation_count','hard_coded_role_inference_count','dispatch_intent_count','ledger_cas_operand_count','projection_request_count','completion_assessment_request_count','transport_invocation_count','write_invocation_count','protected_action_invocation_count','completion_decision_authored_count','finding_closure_count','issue_close_count','approval_invocation_count','state_changed','kind'] as const
const branchKeys: Record<EvaluatorReducerConsolidationResultV1['kind'], readonly string[]> = {
  consolidated_transition: ['reduction','route_binding_or_null','compatibility_wrapper_invoked'],
  compatibility_wrapper_transition: ['reduction','route_binding_or_null','parity_digest','consolidated_execution_invoked'],
  no_transition: ['reason','state_byte_identical','route_binding_or_null'],
  waiting: ['reason','required_role_id','required_action_id','route_binding_or_null'],
  stopped: ['reason','recovery_role_id','required_evidence_ids','route_binding_or_null'],
  rejected: ['rejection','route_binding_or_null'],
}

const resultProblem = (result: JsonObject): Problem | undefined => {
  if (typeof result.kind !== 'string' || !owns(branchKeys, result.kind)) return { code: 'invalid_enum', path: '/result/kind' }
  const problem = exact(result, [...commonResultKeys, ...branchKeys[result.kind as EvaluatorReducerConsolidationResultV1['kind']], 'result_digest'], '/result')
  if (problem) return problem
  const rejectedBranch = result.kind === 'rejected'
  if (result.result_version !== EVALUATOR_REDUCER_CONSOLIDATION_RESULT_V1_VERSION || !sha(result.input_digest) || (rejectedBranch ? ![result.authority_bundle_digest,result.profile_digest,result.decision_port_digest,result.m3_result_digest,result.m4_result_digest].every((value) => value === null) : ![result.authority_bundle_digest,result.profile_digest,result.decision_port_digest,result.m3_result_digest,result.m4_result_digest].every(sha)) || result.agp_evaluator_invocation_count !== 0 || ![0,1].includes(Number(result.decision_port_derivation_count)) || ![0,1].includes(Number(result.reducer_invocation_count)) || result.duplicate_precedence_invocation_count !== 0 || result.fallback_reducer_invocation_count !== 0 || result.hard_coded_role_inference_count !== 0 || ![0,1].includes(Number(result.dispatch_intent_count)) || ![0,1].includes(Number(result.ledger_cas_operand_count)) || ![0,1].includes(Number(result.projection_request_count)) || ![0,1].includes(Number(result.completion_assessment_request_count)) || ['transport_invocation_count','write_invocation_count','protected_action_invocation_count','completion_decision_authored_count','finding_closure_count','issue_close_count','approval_invocation_count'].some((key) => result[key] !== 0) || typeof result.state_changed !== 'boolean') return { code: 'invalid_type_or_format', path: '/result' }
  if (result.kind === 'consolidated_transition' || result.kind === 'compatibility_wrapper_transition') {
    if (!object(result.reduction)) return { code: 'invalid_cross_input_binding', path: '/result/reduction' }
    const reduction = result.reduction as JsonObject
    const reductionShape = exact(reduction, ['admission','decision','state','cas_projection','terminal_no_mutation'], '/result/reduction')
    if (reductionShape || validateEventAdmissionResultV1(reduction.admission).kind !== 'accepted' || (reduction.admission as JsonObject).branch !== 'new_decision' || validateContinuationDecisionV1(reduction.decision).kind !== 'accepted' || !object(reduction.state) || !(reduction.cas_projection === null || object(reduction.cas_projection)) || reduction.terminal_no_mutation !== false) return reductionShape ?? { code: 'invalid_cross_input_binding', path: '/result/reduction' }
    if (!(result.route_binding_or_null === null || validateRouteBindingV1(result.route_binding_or_null).kind === 'accepted')) return { code: 'invalid_cross_input_binding', path: '/result/route_binding_or_null' }
    const decisionRoute = owns(reduction.decision as JsonObject, 'route_binding') ? (reduction.decision as JsonObject).route_binding : null
    if (!same(decisionRoute, result.route_binding_or_null)) return { code: 'invalid_cross_input_binding', path: '/result/route_binding_or_null' }
    if (result.reducer_invocation_count !== 1 || result.decision_port_derivation_count !== 1) return { code: 'invalid_conditional_matrix', path: '/result/reducer_invocation_count' }
    if (result.kind === 'consolidated_transition' && result.compatibility_wrapper_invoked !== false) return { code: 'invalid_conditional_matrix', path: '/result/compatibility_wrapper_invoked' }
    if (result.kind === 'compatibility_wrapper_transition' && (!sha(result.parity_digest) || result.consolidated_execution_invoked !== false)) return { code: 'invalid_conditional_matrix', path: '/result/parity_digest' }
  } else if (result.route_binding_or_null !== null) return { code: 'invalid_conditional_matrix', path: '/result/route_binding_or_null' }
  if (result.kind === 'no_transition' && (result.reason !== 'replay_or_duplicate_event' || result.state_byte_identical !== true || result.state_changed !== false)) return { code: 'invalid_conditional_matrix', path: '/result/no_transition' }
  if (result.kind === 'no_transition' && (result.reducer_invocation_count !== 1 || result.decision_port_derivation_count !== 1)) return { code: 'invalid_conditional_matrix', path: '/result/reducer_invocation_count' }
  if (result.kind === 'waiting' && (!['protected_action_external','m3_external_wait','m4_external_wait'].includes(String(result.reason)) || !nonEmpty(result.required_role_id) || !nonEmpty(result.required_action_id) || result.state_changed !== false)) return { code: 'invalid_conditional_matrix', path: '/result/waiting' }
  if (result.kind === 'waiting' && result.reducer_invocation_count !== 0) return { code: 'invalid_conditional_matrix', path: '/result/reducer_invocation_count' }
  if (result.kind === 'stopped' && (!['authority_conflict','decision_port_conflict','reducer_divergence','route_conflict','completion_conflict','freshness_conflict','protected_action_conflict','budget_conflict','internal_reducer_failure'].includes(String(result.reason)) || !nonEmpty(result.recovery_role_id) || !Array.isArray(result.required_evidence_ids) || result.required_evidence_ids.length === 0 || !result.required_evidence_ids.every(nonEmpty) || result.state_changed !== false)) return { code: 'invalid_conditional_matrix', path: '/result/stopped' }
  if (result.kind === 'rejected') {
    const rejection = result.rejection
    const rejectionProblem = exact(rejection, ['code','path','safe_message'], '/result/rejection')
    if (rejectionProblem) return rejectionProblem
    const value = rejection as JsonObject
    if (!['unknown_field','missing_required_field','forbidden_field','invalid_type_or_format','invalid_enum','duplicate_set_member','noncanonical_set_order','invalid_conditional_matrix','invalid_cross_input_binding'].includes(String(value.code)) || typeof value.path !== 'string' || !value.path.startsWith('/') || value.safe_message !== `rejected: ${String(value.code)}` || result.state_changed !== false) return { code: 'invalid_conditional_matrix', path: '/result/rejection' }
    if (result.reducer_invocation_count !== 0 || result.decision_port_derivation_count !== 0) return { code: 'invalid_conditional_matrix', path: '/result/reducer_invocation_count' }
  }
  return digestOk(result, 'result_digest') ? undefined : { code: 'invalid_cross_input_binding', path: '/result/result_digest' }
}

export const validateEvaluatorReducerConsolidationResultV1 = (value: unknown): ClosedAdmissionResultV1<EvaluatorReducerConsolidationResultV1> => admit('m5_result', value, resultProblem)
export const sealEvaluatorReducerConsolidationProfileV1 = (value: Omit<EvaluatorReducerConsolidationProfileV1,'profile_digest'>): EvaluatorReducerConsolidationProfileV1 => freeze({ ...clone(value), profile_digest: digest(value) })
export const sealM5ProtectedActionSimulationV1 = (value: Omit<M5ProtectedActionSimulationV1,'simulation_digest'>): M5ProtectedActionSimulationV1 => freeze({ ...clone(value), simulation_digest: digest(value) })
export const sealEvaluatorReducerConsolidationInputV1 = (value: Omit<EvaluatorReducerConsolidationInputV1,'input_digest'>): EvaluatorReducerConsolidationInputV1 => freeze({ ...clone(value), input_digest: digest(value) })
export const isDeeplyFrozenEvaluatorReducerConsolidationV1 = (value: unknown): boolean => value === null || typeof value !== 'object' || (Object.isFrozen(value) && Object.values(value as JsonObject).every(isDeeplyFrozenEvaluatorReducerConsolidationV1))
