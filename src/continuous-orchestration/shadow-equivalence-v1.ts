import {
  canonicalizeContinuousOrchestrationJsonV1 as canonicalize,
  digestContinuousOrchestrationJsonV1 as digest,
  validateProgressionEvaluatorResultV1,
  type ClosedAdmissionResultV1,
  type ProgressionEvaluatorResultV1,
  type Sha256,
} from './index'
import {
  validateAdmittedAuthorityBundleV1,
  validateProgressionDecisionPortV1,
  type AdmittedAuthorityBundleV1,
  type ProgressionDecisionPortV1,
} from './shared-proof-interfaces-v1'
import agpCorpusJson from '../../docs/automation/phase1-v2-normative-fixture-corpus.json'

export const SHADOW_EQUIVALENCE_INPUT_V1_VERSION = 'shadow_equivalence_input_v1' as const
export const SHADOW_EQUIVALENCE_RESULT_V1_VERSION = 'shadow_equivalence_result_v1' as const
export const PROGRESSION_DECISION_M2_LOCAL_ADAPTER_INPUT_V1_VERSION = 'progression_decision_m2_local_adapter_input_v1' as const
export const PROGRESSION_DECISION_M2_LOCAL_ADAPTER_RESULT_V1_VERSION = 'progression_decision_m2_local_adapter_result_v1' as const
export const M2_AGP_CORPUS_ARTIFACT_VERSION = '1.0.1' as const
export const M2_AGP_CORPUS_ARTIFACT_DIGEST = 'sha256:5271fa413afdace667086c6fa69f5f59a7a3cb089ba416700fd6e6c60163a289' as const

export type ShadowEquivalenceComparisonClassV1 =
  | 'authority_bundle'
  | 'progression_decision'
  | 'route_binding'
  | 'dispatch_intent'
  | 'gate_projection_intent'
  | 'fresh_action_guard'
  | 'candidate_authority'
  | 'completion_evidence'
  | 'repair_budget'
  | 'repair_ledger'
  | 'architecture_repair_evidence'

type JsonPrimitive = string | number | boolean | null
type JsonValue = JsonPrimitive | readonly JsonValue[] | { readonly [key: string]: JsonValue }
type ProjectionV1 = Readonly<{
  comparison_class: ShadowEquivalenceComparisonClassV1
  payload: Readonly<Record<string, JsonValue>>
}>
type ComparisonProjectionV1 = Readonly<{
  comparison_contract_version: 'shadow_equivalence_comparison_projection_v1'
  comparison_class: ShadowEquivalenceComparisonClassV1
  equality_rule: 'exact_jcs_value'
  required_field_ids: readonly string[]
  existing_authority_id: string
  shadow_adapter_id: string
  required_authority_classes: readonly string[]
  source_binding_digest: Sha256
  existing_authority_digest: Sha256
  shadow_adapter_input_digest: Sha256
  shadow_adapter_output_digest: Sha256
}>

export interface ProgressionDecisionM2LocalAdapterInputV1 {
  readonly adapter_input_version: typeof PROGRESSION_DECISION_M2_LOCAL_ADAPTER_INPUT_V1_VERSION
  readonly canonical_row_id: string
  readonly expanded_input: JsonValue
  readonly public_evaluator_result: JsonValue
  readonly frozen_m1_port_result: ClosedAdmissionResultV1<ProgressionDecisionPortV1>
  readonly corpus_artifact_version: typeof M2_AGP_CORPUS_ARTIFACT_VERSION
  readonly corpus_artifact_digest: typeof M2_AGP_CORPUS_ARTIFACT_DIGEST
}

type M2PortAdmissionKind = 'accepted' | 'rejected' | 'failed' | 'invalid'
export type ProgressionDecisionM2LocalAdapterResultV1 =
  | Readonly<{
      adapter_result_version: typeof PROGRESSION_DECISION_M2_LOCAL_ADAPTER_RESULT_V1_VERSION
      classification: 'accepted_projection'
      source_result_digest: Sha256
      frozen_m1_port_admission_kind: M2PortAdmissionKind
      projection: ProgressionEvaluatorResultV1
      projection_digest: Sha256
      adapter_origin: 'm1_accepted_passthrough' | 'm2_local_exact_invalidation_mapping'
      adapter_digest: Sha256
    }>
  | Readonly<{
      adapter_result_version: typeof PROGRESSION_DECISION_M2_LOCAL_ADAPTER_RESULT_V1_VERSION
      classification: 'explicit_rejection'
      source_result_digest_or_null: Sha256 | null
      frozen_m1_port_admission_kind: M2PortAdmissionKind
      rejection_code: 'invalid_type_or_format' | 'invalid_cross_input_binding' | 'invalid_digest'
      rejection_path: string
      adapter_digest: Sha256
    }>

export interface ShadowEquivalencePairV1 {
  readonly comparison_id: string
  readonly comparison_class: ShadowEquivalenceComparisonClassV1
  readonly authority_bundle_digest: Sha256
  readonly source_canonical_record_urls: readonly string[]
  readonly existing_path_projection: ProjectionV1
  readonly shadow_path_projection: ProjectionV1
  readonly comparison_projection: ComparisonProjectionV1
  readonly existing_projection_digest: Sha256
  readonly shadow_projection_digest: Sha256
}

export interface ShadowEquivalenceInputV1 {
  readonly input_version: typeof SHADOW_EQUIVALENCE_INPUT_V1_VERSION
  readonly task_id: 'AUDIT-CONTINUOUS-ORCHESTRATION-REFACTORING-001'
  readonly repository: 'whatrune/sd-prompt-studio'
  readonly slice_id: 'M2'
  readonly authority_bundle: AdmittedAuthorityBundleV1
  readonly pairs: readonly ShadowEquivalencePairV1[]
  readonly input_digest: Sha256
}

export interface ShadowEquivalenceEvidenceV1 {
  readonly comparison_id: string
  readonly comparison_class: ShadowEquivalenceComparisonClassV1
  readonly json_pointer: string
  readonly existing_projection_digest: Sha256
  readonly shadow_projection_digest: Sha256
  readonly evidence_digest: Sha256
}

export type ShadowEquivalenceResultV1 =
  | Readonly<{
      result_version: typeof SHADOW_EQUIVALENCE_RESULT_V1_VERSION
      kind: 'equivalent'
      ordered_comparison_ids: readonly string[]
      ordered_comparison_classes: readonly ShadowEquivalenceComparisonClassV1[]
      comparison_count: number
      authority_bundle_digest: Sha256
      existing_projection_set_digest: Sha256
      shadow_projection_set_digest: Sha256
      normalized_equivalence_digest: Sha256
      existing_path_selected: true
      shadow_path_eligible: true
      blocking_finding_required: false
      state_changed: false
      write_attempt_count: 0
      transport_invoked: false
      protected_action_invoked: false
      result_digest: Sha256
    }>
  | Readonly<{
      result_version: typeof SHADOW_EQUIVALENCE_RESULT_V1_VERSION
      kind: 'mismatch'
      first_mismatch: ShadowEquivalenceEvidenceV1
      mismatch_count: number
      mismatch_set_digest: Sha256
      authority_bundle_digest: Sha256
      selected_path: 'existing'
      shadow_path_eligible: false
      blocking_finding_required: true
      blocking_finding_class: 'shadow_equivalence_mismatch'
      stable_finding_key: Sha256
      state_changed: false
      write_attempt_count: 0
      transport_invoked: false
      protected_action_invoked: false
      result_digest: Sha256
    }>

type ObjectValue = Record<string, unknown>
type RejectionCode =
  | 'unknown_field'
  | 'missing_required_field'
  | 'invalid_type_or_format'
  | 'invalid_enum'
  | 'invalid_order'
  | 'duplicate_set_member'
  | 'invalid_digest'
  | 'invalid_cross_input_binding'
  | 'invalid_conditional_matrix'

type Problem = Readonly<{ code: RejectionCode; path: string }>

const comparisonClasses = [
  'authority_bundle',
  'progression_decision',
  'route_binding',
  'dispatch_intent',
  'gate_projection_intent',
  'fresh_action_guard',
  'candidate_authority',
  'completion_evidence',
  'repair_budget',
  'repair_ledger',
  'architecture_repair_evidence',
] as const satisfies readonly ShadowEquivalenceComparisonClassV1[]

const projectionFields: Readonly<Record<ShadowEquivalenceComparisonClassV1, readonly string[]>> = {
  authority_bundle: ['task_id', 'repository', 'assignment_revision', 'scope_digest', 'source_set_digest', 'snapshot_digest', 'bundle_digest'],
  progression_decision: ['result_kind', 'result_digest', 'stop_reason_or_null', 'target_role_or_null', 'target_action_or_null', 'target_head_or_null', 'gate_requirement_digest', 'no_transition_binding_digest_or_null'],
  route_binding: ['route_digest', 'role_id', 'action_id', 'scope_digest', 'assignment_revision', 'predecessor_url', 'branch', 'worktree_identity', 'pr_url_or_null', 'head_sha_or_null', 'idempotency_key'],
  dispatch_intent: ['decision_url', 'predecessor_url', 'route_digest', 'scope_digest', 'branch', 'worktree_identity', 'pr_url_or_null', 'head_sha_or_null', 'idempotency_key', 'transport_authority'],
  gate_projection_intent: ['requirement_digest', 'required_fields_digest', 'evidence_urls_digest', 'reason', 'pr_url', 'head_sha', 'authorized_metadata_role_id', 'observed_generation_or_null', 'observed_digest_or_null', 'projection_authority', 'finding_closure_authority', 'approval_authority'],
  fresh_action_guard: ['evaluation_snapshot_digest', 'action_snapshot_digest', 'action_id', 'guarded_at', 'one_use', 'consumption_state', 'execution_authority'],
  candidate_authority: ['candidate_identity_digest', 'aggregate_digest', 'ordered_paths_digest', 'base_sha', 'working_head_sha', 'result_handoff_url', 'publication_state', 'published_head_sha_or_null'],
  completion_evidence: ['evidence_chain_digest', 'exact_head_sha', 'current_main_sha', 'candidate_ref_digest', 'gsp_generation', 'gsp_head_sha', 'gsp_rows_digest', 'finding_set_digest', 'thread_set_digest', 'completion_authority'],
  repair_budget: ['profile_digest', 'semantic_epoch_id', 'scope_digest', 'technical_limit', 'architecture_limit', 'metadata_limit', 'delivery_limit', 'checkpoint_limit', 'stop_limit'],
  repair_ledger: ['ledger_digest', 'semantic_epoch_id', 'profile_digest', 'entries_digest', 'cycle_ledger_digest'],
  architecture_repair_evidence: ['evidence_projection_digest', 'authority_urls_digest', 'finding_bindings_digest', 'dispositions_digest', 'next_role_evidence_digest', 'dispatch_authority'],
}

const authorityBindings: Readonly<Record<ShadowEquivalenceComparisonClassV1, Readonly<{ existing: string; shadow: string; authorityClass: string }>>> = {
  authority_bundle:{existing:'continuous_orchestration_authority_snapshot_v1',shadow:'deriveAdmittedAuthorityBundleShadowV1',authorityClass:'admission'},
  progression_decision:{existing:'automatic_gate_progression_v2_result',shadow:'deriveProgressionDecisionM2LocalAdapterV1',authorityClass:'pure_decision'},
  route_binding:{existing:'continuous_orchestration_route_binding_v1',shadow:'deriveDispatchIntentShadowV1',authorityClass:'normative_semantic'},
  dispatch_intent:{existing:'continuous_orchestration_pending_transport_projection_v1',shadow:'deriveDispatchIntentShadowV1',authorityClass:'projection_transport'},
  gate_projection_intent:{existing:'continuous_orchestration_gsp_hook_v1',shadow:'deriveGateProjectionIntentFromCovShadowV1',authorityClass:'projection_transport'},
  fresh_action_guard:{existing:'continuous_orchestration_action_guard_observation_v1',shadow:'deriveActionGuardProofShadowV1',authorityClass:'admission'},
  candidate_authority:{existing:'aggregate_candidate_binding_v1',shadow:'deriveCandidateAuthorityRefShadowV1',authorityClass:'admission'},
  completion_evidence:{existing:'completion_evidence_chain_v1',shadow:'deriveCompletionEvidenceCandidateShadowV1',authorityClass:'admission'},
  repair_budget:{existing:'continuous_orchestration_repair_budget_v1',shadow:'deriveRepairBudgetProfileShadowV1',authorityClass:'normative_semantic'},
  repair_ledger:{existing:'continuous_orchestration_repair_ledger_v1',shadow:'deriveRepairAttemptLedgerShadowV1',authorityClass:'pure_decision'},
  architecture_repair_evidence:{existing:'architecture_repair_loop_evidence_projection_v1',shadow:'admitted_authority_source_route_evidence_projection_v1',authorityClass:'pure_decision'},
}

const object = (value: unknown): value is ObjectValue => value !== null && typeof value === 'object' && !Array.isArray(value)
const nonEmpty = (value: unknown): value is string => typeof value === 'string' && value.length > 0
const sha = (value: unknown): value is Sha256 => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value)
const gitSha = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{40}$/.test(value)
const canonicalUrl = (value: unknown): value is string => typeof value === 'string' && /^https:\/\/github\.com\/whatrune\/sd-prompt-studio\/(?:issues|pull)\/[1-9][0-9]*(?:#issuecomment-[1-9][0-9]*)?$/.test(value)
const integer = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0
const same = (left: unknown, right: unknown) => canonicalize(left) === canonicalize(right)
const utf8Compare = (left: string, right: string) => {
  const a = new TextEncoder().encode(left), b = new TextEncoder().encode(right)
  for (let index = 0; index < Math.min(a.length, b.length); index += 1) if (a[index] !== b[index]) return a[index] - b[index]
  return a.length - b.length
}
const without = (value: ObjectValue, ...keys: string[]) => Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)))

const deepFreeze = <T>(value: T): T => {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as ObjectValue)) deepFreeze(child)
    Object.freeze(value)
  }
  return value
}
const detached = <T>(value: T): T => JSON.parse(canonicalize(value)) as T
const accepted = <T>(value: T): ClosedAdmissionResultV1<T> => deepFreeze({ contract_version: 'closed-admission-result-v1', kind: 'accepted', value: deepFreeze(detached(value)) })
const rejected = <T>(problem: Problem): ClosedAdmissionResultV1<T> => deepFreeze({ contract_version: 'closed-admission-result-v1', kind: 'rejected', rejection: { code: problem.code, path: problem.path, message: `rejected: ${problem.code}` } })
const failed = <T>(stage: string): ClosedAdmissionResultV1<T> => deepFreeze({ contract_version: 'closed-admission-result-v1', kind: 'failed', failure: { code: 'validator_internal_failure', diagnostic_id: digest({ stage }), safe_message: 'validator failed internally' } })

const exact = (value: unknown, expected: readonly string[], path: string): Problem | undefined => {
  if (!object(value)) return { code: 'invalid_type_or_format', path }
  const actual = Object.keys(value)
  const unknown = actual.find((key) => !expected.includes(key))
  if (unknown) return { code: 'unknown_field', path: `${path}/${unknown}` }
  const missing = expected.find((key) => !Object.prototype.hasOwnProperty.call(value, key))
  return missing ? { code: 'missing_required_field', path: `${path}/${missing}` } : undefined
}

const jsonValue = (value: unknown): value is JsonValue => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (Array.isArray(value)) return value.every(jsonValue)
  if (!object(value)) return false
  return Object.values(value).every(jsonValue)
}

type CorpusPatchOperation = Readonly<{ op: 'add' | 'replace' | 'remove' | 'test'; path: string; value?: JsonValue }>
type CorpusRow = Readonly<{
  row_id: string
  base_fixture_id: string
  operations: readonly CorpusPatchOperation[]
  expanded_input_digest: string
  expected_result: JsonValue
  expanded_result_digest: string
  row_digest: string
}>
type CorpusBase = Readonly<{ fixture_id: string; literal_v2_input: JsonValue }>
type CorpusAuthority = Readonly<{
  artifact_version: string
  base_fixtures: readonly CorpusBase[]
  evaluator_rows: readonly CorpusRow[]
  manifest: Readonly<{ digest: Readonly<{ value: string }> }>
}>
const agpCorpus = agpCorpusJson as unknown as CorpusAuthority

const pointerTokens = (pointer: string) => pointer === '' ? [] : pointer.slice(1).split('/').map((token) => token.replace(/~1/g, '/').replace(/~0/g, '~'))
const patchContainer = (root: unknown, tokens: readonly string[]): ObjectValue | unknown[] | undefined => {
  let cursor: unknown = root
  for (const token of tokens) {
    if ((!object(cursor) && !Array.isArray(cursor)) || !(token in cursor)) return undefined
    cursor = (cursor as ObjectValue)[token]
  }
  return object(cursor) || Array.isArray(cursor) ? cursor : undefined
}
const expandCorpusRow = (base: JsonValue, operations: readonly CorpusPatchOperation[]): JsonValue | undefined => {
  const root = detached(base) as unknown
  for (const operation of operations) {
    if (!['add', 'replace', 'remove', 'test'].includes(operation.op) || !operation.path.startsWith('/')) return undefined
    const tokens = pointerTokens(operation.path), key = tokens[tokens.length - 1]
    if (key === undefined) return undefined
    const parent = patchContainer(root, tokens.slice(0, -1))
    if (parent === undefined) return undefined
    const exists = Object.prototype.hasOwnProperty.call(parent, key)
    if (operation.op === 'test') { if (!exists || !same((parent as ObjectValue)[key], operation.value)) return undefined; continue }
    if (operation.op === 'remove') { if (!exists) return undefined; if (Array.isArray(parent)) parent.splice(Number(key), 1); else delete parent[key]; continue }
    if (operation.op === 'replace') { if (!exists || !Object.prototype.hasOwnProperty.call(operation, 'value')) return undefined; (parent as ObjectValue)[key] = detached(operation.value) as unknown; continue }
    if (!Object.prototype.hasOwnProperty.call(operation, 'value')) return undefined
    if (Array.isArray(parent)) { if (key === '-') parent.push(detached(operation.value)); else parent.splice(Number(key), 0, detached(operation.value)) }
    else { if (exists) return undefined; parent[key] = detached(operation.value) as unknown }
  }
  return jsonValue(root) ? root : undefined
}

const adapterAdmissionKind = (value: unknown): M2PortAdmissionKind => object(value) && ['accepted', 'rejected', 'failed'].includes(String(value.kind)) ? value.kind as M2PortAdmissionKind : 'invalid'
const sealAdapterResult = <T extends ObjectValue>(base: T): Readonly<T & { adapter_digest: Sha256 }> => deepFreeze({ ...base, adapter_digest: digest(base) })
const adapterRejection = (kind: M2PortAdmissionKind, code: 'invalid_type_or_format' | 'invalid_cross_input_binding' | 'invalid_digest', path: string, publicResult?: unknown): ProgressionDecisionM2LocalAdapterResultV1 => sealAdapterResult({
  adapter_result_version: PROGRESSION_DECISION_M2_LOCAL_ADAPTER_RESULT_V1_VERSION,
  classification: 'explicit_rejection' as const,
  source_result_digest_or_null: jsonValue(publicResult) ? digest(publicResult) : null,
  frozen_m1_port_admission_kind: kind,
  rejection_code: code,
  rejection_path: path,
})
const adapterAccepted = (kind: M2PortAdmissionKind, publicResult: JsonValue, projection: ProgressionEvaluatorResultV1, origin: 'm1_accepted_passthrough' | 'm2_local_exact_invalidation_mapping'): ProgressionDecisionM2LocalAdapterResultV1 => sealAdapterResult({
  adapter_result_version: PROGRESSION_DECISION_M2_LOCAL_ADAPTER_RESULT_V1_VERSION,
  classification: 'accepted_projection' as const,
  source_result_digest: digest(publicResult),
  frozen_m1_port_admission_kind: kind,
  projection: detached(projection),
  projection_digest: digest(projection),
  adapter_origin: origin,
})

const exactInvalidationMappings: Readonly<Record<string, Readonly<{ inputFingerprint: string; expectedResultDigest: string; rowDigest: string; invalidationClass: 'base_drift' | 'pr_state_drift' }>>> = {
  'AGP-P05#base_drift': { inputFingerprint: 'agp-input-v2:sha256:3bdf2d04143b3bb77b751d8358e0587b3986843cbc08adfebc71795e5780beda', expectedResultDigest: 'sha256:2f55e765a4d92b6a64db244d8f3e338b5cd31988fafceec62fec62cbf9222aa0', rowDigest: 'sha256:d12877d2f61cdd28185e8766da565a48d346fc4b14e76abc85bc010dace43bf3', invalidationClass: 'base_drift' },
  'AGP-P05#state_drift': { inputFingerprint: 'agp-input-v2:sha256:ff7e32b17ce85992fbc534648e1f7796911d7a822587b4433ee2333b2d01a0cd', expectedResultDigest: 'sha256:6fe89dd574abf167755b5f748fa7bf923f0e336a094b855abf2d3dd7c8adef49', rowDigest: 'sha256:fbc76eaa878dc22fffbc1d75f7f772be5cd5c1e05ea9d32df6182febe509ffbb', invalidationClass: 'pr_state_drift' },
}

export const deriveProgressionDecisionM2LocalAdapterV1 = (candidate: unknown): ProgressionDecisionM2LocalAdapterResultV1 => {
  try {
    const kind = object(candidate) ? adapterAdmissionKind(candidate.frozen_m1_port_result) : 'invalid'
    let problem = exact(candidate, ['adapter_input_version', 'canonical_row_id', 'expanded_input', 'public_evaluator_result', 'frozen_m1_port_result', 'corpus_artifact_version', 'corpus_artifact_digest'], '/m2_progression_adapter')
    if (problem) return adapterRejection(kind, 'invalid_type_or_format', problem.path)
    const input = candidate as ObjectValue
    if (input.adapter_input_version !== PROGRESSION_DECISION_M2_LOCAL_ADAPTER_INPUT_V1_VERSION || !nonEmpty(input.canonical_row_id) || !jsonValue(input.expanded_input) || !jsonValue(input.public_evaluator_result) || input.corpus_artifact_version !== M2_AGP_CORPUS_ARTIFACT_VERSION || input.corpus_artifact_digest !== M2_AGP_CORPUS_ARTIFACT_DIGEST) return adapterRejection(kind, 'invalid_type_or_format', '/m2_progression_adapter', input.public_evaluator_result)
    const corpusProjection = detached(agpCorpus) as unknown as ObjectValue
    const manifest = corpusProjection.manifest as ObjectValue, manifestDigest = manifest.digest as ObjectValue
    delete manifestDigest.value
    if (agpCorpus.artifact_version !== M2_AGP_CORPUS_ARTIFACT_VERSION || agpCorpus.manifest.digest.value !== M2_AGP_CORPUS_ARTIFACT_DIGEST || `sha256:${digest(corpusProjection)}` !== M2_AGP_CORPUS_ARTIFACT_DIGEST) return adapterRejection(kind, 'invalid_digest', '/m2_progression_adapter/corpus_artifact_digest', input.public_evaluator_result)
    const row = agpCorpus.evaluator_rows.find((item) => item.row_id === input.canonical_row_id)
    const base = row && agpCorpus.base_fixtures.find((item) => item.fixture_id === row.base_fixture_id)
    const expanded = row && base ? expandCorpusRow(base.literal_v2_input, row.operations) : undefined
    if (!row || !expanded || !same(expanded, input.expanded_input) || row.expanded_input_digest !== `sha256:${digest(expanded)}` || row.expanded_result_digest !== `sha256:${digest(row.expected_result)}` || row.row_digest !== `sha256:${digest({ expanded_input: expanded, expected_result: row.expected_result })}` || !same(row.expected_result, input.public_evaluator_result)) return adapterRejection(kind, 'invalid_cross_input_binding', '/m2_progression_adapter/canonical_row', input.public_evaluator_result)
    const publicResult = input.public_evaluator_result as JsonValue
    const publicObject = publicResult as ObjectValue
    if (publicObject.input_fingerprint !== (row.expected_result as ObjectValue).input_fingerprint || publicObject.kind !== (row.expected_result as ObjectValue).kind) return adapterRejection(kind, 'invalid_cross_input_binding', '/m2_progression_adapter/public_evaluator_result', publicResult)
    const mapping = exactInvalidationMappings[row.row_id]
    if (mapping) {
      const m1Result = input.frozen_m1_port_result
      const exactM1Rejection = object(m1Result) && m1Result.kind === 'rejected' && object(m1Result.rejection) && m1Result.rejection.code === 'invalid_cross_input_binding' && m1Result.rejection.path === '/progression_port/projected_result'
      if (!exactM1Rejection || publicObject.kind !== 'invalidate_approval' || publicObject.invalidation_reason !== 'base_or_state_drift' || publicObject.input_fingerprint !== mapping.inputFingerprint || row.expanded_result_digest !== mapping.expectedResultDigest || row.row_digest !== mapping.rowDigest) return adapterRejection(kind, 'invalid_cross_input_binding', '/m2_progression_adapter/invalidation_mapping', publicResult)
      const projection: ProgressionEvaluatorResultV1 = { kind: 'invalidate_approval', invalidation_class: mapping.invalidationClass }
      if (validateProgressionEvaluatorResultV1(projection).kind !== 'accepted') return adapterRejection(kind, 'invalid_cross_input_binding', '/m2_progression_adapter/invalidation_mapping', publicResult)
      return adapterAccepted(kind, publicResult, projection, 'm2_local_exact_invalidation_mapping')
    }
    const m1Result = input.frozen_m1_port_result as ClosedAdmissionResultV1<ProgressionDecisionPortV1>
    if (m1Result.kind !== 'accepted') return adapterRejection(kind, 'invalid_cross_input_binding', '/m2_progression_adapter/m1_passthrough', publicResult)
    const port = m1Result.value
    if (validateProgressionDecisionPortV1(port).kind !== 'accepted' || port.source_result_digest !== digest(publicResult) || port.source_result_kind !== publicObject.kind || validateProgressionEvaluatorResultV1(port.projected_result).kind !== 'accepted') return adapterRejection(kind, 'invalid_cross_input_binding', '/m2_progression_adapter/m1_passthrough', publicResult)
    return adapterAccepted(kind, publicResult, port.projected_result, 'm1_accepted_passthrough')
  } catch {
    return adapterRejection('invalid', 'invalid_type_or_format', '/m2_progression_adapter')
  }
}

export const validateProgressionDecisionM2LocalAdapterResultV1 = (candidate: unknown): ClosedAdmissionResultV1<ProgressionDecisionM2LocalAdapterResultV1> => {
  try {
    if (!object(candidate)) return rejected({ code: 'invalid_type_or_format', path: '/m2_progression_adapter_result' })
    const acceptedFields = ['adapter_result_version', 'classification', 'source_result_digest', 'frozen_m1_port_admission_kind', 'projection', 'projection_digest', 'adapter_origin', 'adapter_digest']
    const rejectedFields = ['adapter_result_version', 'classification', 'source_result_digest_or_null', 'frozen_m1_port_admission_kind', 'rejection_code', 'rejection_path', 'adapter_digest']
    const problem = exact(candidate, candidate.classification === 'accepted_projection' ? acceptedFields : candidate.classification === 'explicit_rejection' ? rejectedFields : [], '/m2_progression_adapter_result')
    if (problem || candidate.adapter_result_version !== PROGRESSION_DECISION_M2_LOCAL_ADAPTER_RESULT_V1_VERSION || !['accepted', 'rejected', 'failed', 'invalid'].includes(String(candidate.frozen_m1_port_admission_kind)) || !sha(candidate.adapter_digest) || candidate.adapter_digest !== digest(without(candidate, 'adapter_digest'))) return rejected(problem ?? { code: 'invalid_cross_input_binding', path: '/m2_progression_adapter_result' })
    if (candidate.classification === 'accepted_projection') {
      if (!sha(candidate.source_result_digest) || !sha(candidate.projection_digest) || candidate.projection_digest !== digest(candidate.projection) || !['m1_accepted_passthrough', 'm2_local_exact_invalidation_mapping'].includes(String(candidate.adapter_origin)) || validateProgressionEvaluatorResultV1(candidate.projection).kind !== 'accepted') return rejected({ code: 'invalid_cross_input_binding', path: '/m2_progression_adapter_result/projection' })
    } else if (!((candidate.source_result_digest_or_null === null || sha(candidate.source_result_digest_or_null)) && ['invalid_type_or_format', 'invalid_cross_input_binding', 'invalid_digest'].includes(String(candidate.rejection_code)) && nonEmpty(candidate.rejection_path))) return rejected({ code: 'invalid_cross_input_binding', path: '/m2_progression_adapter_result' })
    return accepted(candidate as unknown as ProgressionDecisionM2LocalAdapterResultV1)
  } catch { return failed('m2_progression_adapter_result') }
}

const projectionProblem = (value: unknown, comparisonClass: ShadowEquivalenceComparisonClassV1, bundle: AdmittedAuthorityBundleV1, path: string): Problem | undefined => {
  let problem = exact(value, ['comparison_class', 'payload'], path)
  if (problem) return problem
  const projection = value as ObjectValue
  if (projection.comparison_class !== comparisonClass) return { code: 'invalid_cross_input_binding', path: `${path}/comparison_class` }
  problem = exact(projection.payload, projectionFields[comparisonClass], `${path}/payload`)
  if (problem) return problem
  if (!Object.values(projection.payload as ObjectValue).every(jsonValue)) return { code: 'invalid_type_or_format', path: `${path}/payload` }
  const payload = projection.payload as ObjectValue
  for (const [key, fieldValue] of Object.entries(payload)) {
    if (key.endsWith('_digest') && !sha(fieldValue)) return { code: 'invalid_type_or_format', path: `${path}/payload/${key}` }
    if ((key.endsWith('_sha') || key.endsWith('_head')) && !gitSha(fieldValue)) return { code: 'invalid_type_or_format', path: `${path}/payload/${key}` }
    if (key.endsWith('_sha_or_null') && fieldValue !== null && !gitSha(fieldValue)) return { code: 'invalid_type_or_format', path: `${path}/payload/${key}` }
    if (key.endsWith('_head_or_null') && fieldValue !== null && !gitSha(fieldValue)) return { code: 'invalid_type_or_format', path: `${path}/payload/${key}` }
    if ((key.endsWith('_url') || key.endsWith('_record_url')) && !canonicalUrl(fieldValue)) return { code: 'invalid_type_or_format', path: `${path}/payload/${key}` }
    if (key.endsWith('_url_or_null') && fieldValue !== null && !canonicalUrl(fieldValue)) return { code: 'invalid_type_or_format', path: `${path}/payload/${key}` }
    if ((key.endsWith('_limit') || key === 'assignment_revision' || key === 'gsp_generation') && !integer(fieldValue)) return { code: 'invalid_type_or_format', path: `${path}/payload/${key}` }
  }
  if ('result_kind' in payload && !['recommend_next_role','wait_for_protected_action','require_gate_status_update','invalidate_approval','stop','no_transition'].includes(String(payload.result_kind))) return { code: 'invalid_enum', path: `${path}/payload/result_kind` }
  if ('reason' in payload && !['missing','stale','conflicting','historical_at_prior_head'].includes(String(payload.reason))) return { code: 'invalid_enum', path: `${path}/payload/reason` }
  if ('publication_state' in payload && !['unpublished','published'].includes(String(payload.publication_state))) return { code: 'invalid_enum', path: `${path}/payload/publication_state` }
  if ('consumption_state' in payload && payload.consumption_state !== 'unconsumed') return { code: 'invalid_enum', path: `${path}/payload/consumption_state` }
  for (const key of ['technical_limit','architecture_limit','metadata_limit','delivery_limit']) if (key in payload && payload[key] !== 3) return { code: 'invalid_conditional_matrix', path: `${path}/payload/${key}` }
  if ('checkpoint_limit' in payload && payload.checkpoint_limit !== 32) return { code: 'invalid_conditional_matrix', path: `${path}/payload/checkpoint_limit` }
  if ('stop_limit' in payload && payload.stop_limit !== 64) return { code: 'invalid_conditional_matrix', path: `${path}/payload/stop_limit` }
  if (comparisonClass === 'authority_bundle' && (payload.task_id !== bundle.task_id || payload.repository !== bundle.repository || payload.assignment_revision !== bundle.assignment_revision || payload.scope_digest !== bundle.scope_digest || payload.snapshot_digest !== bundle.fresh_snapshot.snapshot_digest || payload.bundle_digest !== bundle.bundle_digest)) return { code: 'invalid_cross_input_binding', path: `${path}/payload` }
  if ('assignment_revision' in payload && payload.assignment_revision !== bundle.assignment_revision) return { code: 'invalid_cross_input_binding', path: `${path}/payload/assignment_revision` }
  if ('scope_digest' in payload && payload.scope_digest !== bundle.scope_digest) return { code: 'invalid_cross_input_binding', path: `${path}/payload/scope_digest` }
  if (comparisonClass === 'progression_decision') {
    const kind=payload.result_kind, targetRole=payload.target_role_or_null, targetAction=payload.target_action_or_null, targetHead=payload.target_head_or_null, stop=payload.stop_reason_or_null, noTransition=payload.no_transition_binding_digest_or_null
    const targetNull=targetRole===null&&targetAction===null&&targetHead===null
    if (kind==='recommend_next_role') { if (!nonEmpty(targetRole)||!nonEmpty(targetAction)||!(targetHead===null||gitSha(targetHead))||stop!==null||noTransition!==null) return { code:'invalid_conditional_matrix',path:`${path}/payload` } }
    else if (kind==='stop') { if (!targetNull||!nonEmpty(stop)||noTransition!==null) return { code:'invalid_conditional_matrix',path:`${path}/payload` } }
    else if (kind==='no_transition') { if (!targetNull||stop!==null||!sha(noTransition)) return { code:'invalid_conditional_matrix',path:`${path}/payload` } }
    else if (!targetNull||stop!==null||noTransition!==null) return { code:'invalid_conditional_matrix',path:`${path}/payload` }
  }
  if (comparisonClass==='route_binding' && (!nonEmpty(payload.role_id)||!nonEmpty(payload.action_id)||!canonicalUrl(payload.predecessor_url)||!nonEmpty(payload.branch)||!nonEmpty(payload.worktree_identity))) return { code:'invalid_type_or_format',path:`${path}/payload` }
  if (comparisonClass==='dispatch_intent' && (!canonicalUrl(payload.decision_url)||!canonicalUrl(payload.predecessor_url)||!nonEmpty(payload.branch)||!nonEmpty(payload.worktree_identity)||payload.transport_authority!==false)) return { code:'invalid_type_or_format',path:`${path}/payload` }
  if (comparisonClass==='candidate_authority' && ((payload.publication_state==='unpublished')!==(payload.published_head_sha_or_null===null))) return { code:'invalid_conditional_matrix',path:`${path}/payload/publication_state` }
  for (const authorityField of ['transport_authority', 'projection_authority', 'finding_closure_authority', 'approval_authority', 'execution_authority', 'completion_authority', 'dispatch_authority']) {
    if (authorityField in payload && payload[authorityField] !== false) return { code: 'invalid_conditional_matrix', path: `${path}/payload/${authorityField}` }
  }
  if ('one_use' in payload && payload.one_use !== true) return { code: 'invalid_conditional_matrix', path: `${path}/payload/one_use` }
  return undefined
}

const sourceUrl = (source: AdmittedAuthorityBundleV1['sources'][number]) => source.source_ref.url
const sourceBindingDigest = (comparisonClass: ShadowEquivalenceComparisonClassV1, bundle: AdmittedAuthorityBundleV1, urls: readonly string[]) => digest({comparison_class:comparisonClass,authority_bundle_digest:bundle.bundle_digest,source_canonical_record_urls:urls,admitted_sources:bundle.sources.filter(source=>urls.includes(sourceUrl(source)))})
const shadowAdapterInputDigest = (comparisonClass: ShadowEquivalenceComparisonClassV1, bundle: AdmittedAuthorityBundleV1, urls: readonly string[], existingProjection: unknown) => digest({comparison_class:comparisonClass,shadow_adapter_id:authorityBindings[comparisonClass].shadow,authority_bundle_digest:bundle.bundle_digest,source_binding_digest:sourceBindingDigest(comparisonClass,bundle,urls),existing_authority_digest:digest(existingProjection)})

const pairProblem = (value: unknown, index: number, bundle: AdmittedAuthorityBundleV1): Problem | undefined => {
  const path = `/input/pairs/${index}`
  let problem = exact(value, ['comparison_id', 'comparison_class', 'authority_bundle_digest', 'source_canonical_record_urls', 'existing_path_projection', 'shadow_path_projection', 'comparison_projection', 'existing_projection_digest', 'shadow_projection_digest'], path)
  if (problem) return problem
  const pair = value as ObjectValue
  if (!nonEmpty(pair.comparison_id) || !comparisonClasses.includes(pair.comparison_class as ShadowEquivalenceComparisonClassV1)) return { code: 'invalid_enum', path: `${path}/comparison_class` }
  const comparisonClass = pair.comparison_class as ShadowEquivalenceComparisonClassV1
  if (pair.authority_bundle_digest !== bundle.bundle_digest) return { code: 'invalid_cross_input_binding', path: `${path}/authority_bundle_digest` }
  if (!Array.isArray(pair.source_canonical_record_urls) || pair.source_canonical_record_urls.length === 0 || !pair.source_canonical_record_urls.every(canonicalUrl)) return { code: 'invalid_type_or_format', path: `${path}/source_canonical_record_urls` }
  const sourceUrls = pair.source_canonical_record_urls as string[]
  if (new Set(sourceUrls).size !== sourceUrls.length) return { code: 'duplicate_set_member', path: `${path}/source_canonical_record_urls` }
  if (!same(sourceUrls, [...sourceUrls].sort(utf8Compare))) return { code: 'invalid_order', path: `${path}/source_canonical_record_urls` }
  const matchedSources=bundle.sources.filter(source=>sourceUrls.includes(sourceUrl(source)))
  const binding=authorityBindings[comparisonClass]
  if (matchedSources.length!==sourceUrls.length||matchedSources.some(source=>source.authority_class!==binding.authorityClass||!same(source.admitted_field_ids,[comparisonClass]))||sourceUrls.some(url=>!matchedSources.some(source=>sourceUrl(source)===url))) return { code:'invalid_cross_input_binding',path:`${path}/source_canonical_record_urls` }
  problem = projectionProblem(pair.existing_path_projection, comparisonClass, bundle, `${path}/existing_path_projection`) ?? projectionProblem(pair.shadow_path_projection, comparisonClass, bundle, `${path}/shadow_path_projection`)
  if (problem) return problem
  problem = exact(pair.comparison_projection, ['comparison_contract_version', 'comparison_class', 'equality_rule', 'required_field_ids','existing_authority_id','shadow_adapter_id','required_authority_classes','source_binding_digest','existing_authority_digest','shadow_adapter_input_digest','shadow_adapter_output_digest'], `${path}/comparison_projection`)
  if (problem) return problem
  const contract = pair.comparison_projection as ObjectValue
  if (contract.comparison_contract_version !== 'shadow_equivalence_comparison_projection_v1' || contract.comparison_class !== comparisonClass || contract.equality_rule !== 'exact_jcs_value' || !same(contract.required_field_ids, projectionFields[comparisonClass])||contract.existing_authority_id!==binding.existing||contract.shadow_adapter_id!==binding.shadow||!same(contract.required_authority_classes,[binding.authorityClass])) return { code: 'invalid_conditional_matrix', path: `${path}/comparison_projection` }
  if (contract.source_binding_digest!==sourceBindingDigest(comparisonClass,bundle,sourceUrls)) return { code:'invalid_cross_input_binding',path:`${path}/comparison_projection/source_binding_digest` }
  if (contract.existing_authority_digest!==digest(pair.existing_path_projection)||contract.shadow_adapter_input_digest!==shadowAdapterInputDigest(comparisonClass,bundle,sourceUrls,pair.existing_path_projection)||contract.shadow_adapter_output_digest!==digest(pair.shadow_path_projection)) return { code:'invalid_cross_input_binding',path:`${path}/comparison_projection` }
  if (!sha(pair.existing_projection_digest) || pair.existing_projection_digest !== digest(pair.existing_path_projection)) return { code: 'invalid_digest', path: `${path}/existing_projection_digest` }
  if (!sha(pair.shadow_projection_digest) || pair.shadow_projection_digest !== digest(pair.shadow_path_projection)) return { code: 'invalid_digest', path: `${path}/shadow_projection_digest` }
  return undefined
}

const inputProblem = (value: ObjectValue): Problem | undefined => {
  let problem = exact(value, ['input_version', 'task_id', 'repository', 'slice_id', 'authority_bundle', 'pairs', 'input_digest'], '/input')
  if (problem) return problem
  if (value.input_version !== SHADOW_EQUIVALENCE_INPUT_V1_VERSION || value.task_id !== 'AUDIT-CONTINUOUS-ORCHESTRATION-REFACTORING-001' || value.repository !== 'whatrune/sd-prompt-studio' || value.slice_id !== 'M2') return { code: 'invalid_enum', path: '/input' }
  const bundle = validateAdmittedAuthorityBundleV1(value.authority_bundle)
  if (bundle.kind !== 'accepted') return { code: 'invalid_cross_input_binding', path: '/input/authority_bundle' }
  if (bundle.value.task_id !== value.task_id || bundle.value.repository !== value.repository) return { code: 'invalid_cross_input_binding', path: '/input/authority_bundle' }
  if (!Array.isArray(value.pairs) || value.pairs.length !== comparisonClasses.length) return { code: 'invalid_conditional_matrix', path: '/input/pairs' }
  const seenIds = new Set<string>()
  const seenClasses = new Set<string>()
  for (let index = 0; index < value.pairs.length; index += 1) {
    problem = pairProblem(value.pairs[index], index, bundle.value)
    if (problem) return problem
    const pair = value.pairs[index] as ObjectValue
    if (seenIds.has(String(pair.comparison_id))) return { code: 'duplicate_set_member', path: '/input/pairs' }
    if (seenClasses.has(String(pair.comparison_class))) return { code: 'duplicate_set_member', path: '/input/pairs' }
    seenIds.add(String(pair.comparison_id)); seenClasses.add(String(pair.comparison_class))
    if (pair.comparison_class !== comparisonClasses[index]) return { code: 'invalid_order', path: `/input/pairs/${index}/comparison_class` }
  }
  if (!sha(value.input_digest) || value.input_digest !== digest(without(value, 'input_digest'))) return { code: 'invalid_digest', path: '/input/input_digest' }
  return undefined
}

export const validateShadowEquivalenceInputV1 = (value: unknown): ClosedAdmissionResultV1<ShadowEquivalenceInputV1> => {
  try {
    if (!object(value)) return rejected({ code: 'invalid_type_or_format', path: '/input' })
    const problem = inputProblem(value)
    return problem ? rejected(problem) : accepted(value as unknown as ShadowEquivalenceInputV1)
  } catch {
    return failed('shadow_equivalence_input')
  }
}

const firstDifference = (left: JsonValue, right: JsonValue, path = ''): string | null => {
  if (canonicalize(left) === canonicalize(right)) return null
  if (Array.isArray(left) && Array.isArray(right)) {
    const length = Math.max(left.length, right.length)
    for (let index = 0; index < length; index += 1) {
      if (index >= left.length || index >= right.length) return `${path}/${index}`
      const nested = firstDifference(left[index], right[index], `${path}/${index}`)
      if (nested !== null) return nested
    }
  }
  if (object(left) && object(right)) {
    const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort(utf8Compare)
    for (const key of keys) {
      if (!(key in left) || !(key in right)) return `${path}/${key.replace(/~/g, '~0').replace(/\//g, '~1')}`
      const nested = firstDifference(left[key] as JsonValue, right[key] as JsonValue, `${path}/${key.replace(/~/g, '~0').replace(/\//g, '~1')}`)
      if (nested !== null) return nested
    }
  }
  return path || '/'
}

const sealResult = <T extends ObjectValue>(base: T): Readonly<T & { result_digest: Sha256 }> => deepFreeze({ ...base, result_digest: digest(base) })

const evaluateAccepted = (input: ShadowEquivalenceInputV1): ShadowEquivalenceResultV1 => {
  const mismatches = input.pairs.flatMap((pair) => {
    const pointer = firstDifference(pair.existing_path_projection as unknown as JsonValue, pair.shadow_path_projection as unknown as JsonValue)
    if (pointer === null) return []
    const evidenceBase = {
      comparison_id: pair.comparison_id,
      comparison_class: pair.comparison_class,
      json_pointer: pointer,
      existing_projection_digest: pair.existing_projection_digest,
      shadow_projection_digest: pair.shadow_projection_digest,
    }
    return [deepFreeze({ ...evidenceBase, evidence_digest: digest(evidenceBase) })]
  })
  if (mismatches.length > 0) {
    const first = mismatches[0]
    return sealResult({
      result_version: SHADOW_EQUIVALENCE_RESULT_V1_VERSION,
      kind: 'mismatch',
      first_mismatch: first,
      mismatch_count: mismatches.length,
      mismatch_set_digest: digest(mismatches),
      authority_bundle_digest: input.authority_bundle.bundle_digest,
      selected_path: 'existing',
      shadow_path_eligible: false,
      blocking_finding_required: true,
      blocking_finding_class: 'shadow_equivalence_mismatch',
      stable_finding_key: digest({ task_id: input.task_id, slice_id: input.slice_id, comparison_class: first.comparison_class, comparison_id: first.comparison_id, pointer: first.json_pointer, authority_bundle_digest: input.authority_bundle.bundle_digest }),
      state_changed: false,
      write_attempt_count: 0,
      transport_invoked: false,
      protected_action_invoked: false,
    }) as ShadowEquivalenceResultV1
  }
  const existingSet = input.pairs.map((pair) => ({ comparison_id: pair.comparison_id, comparison_class: pair.comparison_class, projection_digest: pair.existing_projection_digest }))
  const shadowSet = input.pairs.map((pair) => ({ comparison_id: pair.comparison_id, comparison_class: pair.comparison_class, projection_digest: pair.shadow_projection_digest }))
  return sealResult({
    result_version: SHADOW_EQUIVALENCE_RESULT_V1_VERSION,
    kind: 'equivalent',
    ordered_comparison_ids: input.pairs.map((pair) => pair.comparison_id),
    ordered_comparison_classes: input.pairs.map((pair) => pair.comparison_class),
    comparison_count: input.pairs.length,
    authority_bundle_digest: input.authority_bundle.bundle_digest,
    existing_projection_set_digest: digest(existingSet),
    shadow_projection_set_digest: digest(shadowSet),
    normalized_equivalence_digest: digest({ authority_bundle_digest: input.authority_bundle.bundle_digest, comparisons: existingSet }),
    existing_path_selected: true,
    shadow_path_eligible: true,
    blocking_finding_required: false,
    state_changed: false,
    write_attempt_count: 0,
    transport_invoked: false,
    protected_action_invoked: false,
  }) as ShadowEquivalenceResultV1
}

export const evaluateShadowEquivalenceV1 = (value: unknown): ClosedAdmissionResultV1<ShadowEquivalenceResultV1> => {
  const admitted = validateShadowEquivalenceInputV1(value)
  if (admitted.kind !== 'accepted') return admitted as ClosedAdmissionResultV1<ShadowEquivalenceResultV1>
  try { return accepted(evaluateAccepted(admitted.value)) } catch { return failed('shadow_equivalence_evaluation') }
}

const resultProblem = (value: ObjectValue): Problem | undefined => {
  const equivalentKeys = ['result_version', 'kind', 'ordered_comparison_ids', 'ordered_comparison_classes', 'comparison_count', 'authority_bundle_digest', 'existing_projection_set_digest', 'shadow_projection_set_digest', 'normalized_equivalence_digest', 'existing_path_selected', 'shadow_path_eligible', 'blocking_finding_required', 'state_changed', 'write_attempt_count', 'transport_invoked', 'protected_action_invoked', 'result_digest']
  const mismatchKeys = ['result_version', 'kind', 'first_mismatch', 'mismatch_count', 'mismatch_set_digest', 'authority_bundle_digest', 'selected_path', 'shadow_path_eligible', 'blocking_finding_required', 'blocking_finding_class', 'stable_finding_key', 'state_changed', 'write_attempt_count', 'transport_invoked', 'protected_action_invoked', 'result_digest']
  let problem = exact(value, value.kind === 'equivalent' ? equivalentKeys : value.kind === 'mismatch' ? mismatchKeys : [], '/result')
  if (problem) return problem
  if (value.result_version !== SHADOW_EQUIVALENCE_RESULT_V1_VERSION || !sha(value.authority_bundle_digest) || value.state_changed !== false || value.write_attempt_count !== 0 || value.transport_invoked !== false || value.protected_action_invoked !== false) return { code: 'invalid_conditional_matrix', path: '/result' }
  if (value.kind === 'equivalent') {
    if (!Array.isArray(value.ordered_comparison_ids) || !Array.isArray(value.ordered_comparison_classes) || value.comparison_count !== comparisonClasses.length || !same(value.ordered_comparison_classes, comparisonClasses) || value.existing_path_selected !== true || value.shadow_path_eligible !== true || value.blocking_finding_required !== false || ![value.existing_projection_set_digest, value.shadow_projection_set_digest, value.normalized_equivalence_digest].every(sha)) return { code: 'invalid_conditional_matrix', path: '/result' }
  } else if (value.kind === 'mismatch') {
    problem = exact(value.first_mismatch, ['comparison_id', 'comparison_class', 'json_pointer', 'existing_projection_digest', 'shadow_projection_digest', 'evidence_digest'], '/result/first_mismatch')
    if (problem) return problem
    const evidence = value.first_mismatch as ObjectValue
    if (!nonEmpty(evidence.comparison_id) || !comparisonClasses.includes(evidence.comparison_class as ShadowEquivalenceComparisonClassV1) || !nonEmpty(evidence.json_pointer) || !sha(evidence.existing_projection_digest) || !sha(evidence.shadow_projection_digest) || !sha(evidence.evidence_digest) || evidence.evidence_digest !== digest(without(evidence, 'evidence_digest')) || !integer(value.mismatch_count) || Number(value.mismatch_count) < 1 || !sha(value.mismatch_set_digest) || value.selected_path !== 'existing' || value.shadow_path_eligible !== false || value.blocking_finding_required !== true || value.blocking_finding_class !== 'shadow_equivalence_mismatch' || !sha(value.stable_finding_key)) return { code: 'invalid_conditional_matrix', path: '/result' }
  } else return { code: 'invalid_enum', path: '/result/kind' }
  if (!sha(value.result_digest) || value.result_digest !== digest(without(value, 'result_digest'))) return { code: 'invalid_digest', path: '/result/result_digest' }
  return undefined
}

export const validateShadowEquivalenceResultV1 = (value: unknown, input?: ShadowEquivalenceInputV1): ClosedAdmissionResultV1<ShadowEquivalenceResultV1> => {
  try {
    if (!object(value)) return rejected({ code: 'invalid_type_or_format', path: '/result' })
    const problem = resultProblem(value)
    if (problem) return rejected(problem)
    if (input) {
      const admittedInput = validateShadowEquivalenceInputV1(input)
      if (admittedInput.kind !== 'accepted') return rejected({ code: 'invalid_cross_input_binding', path: '/result' })
      const expected = evaluateAccepted(admittedInput.value)
      if (!same(value, expected)) return rejected({ code: 'invalid_cross_input_binding', path: '/result' })
    }
    return accepted(value as unknown as ShadowEquivalenceResultV1)
  } catch {
    return failed('shadow_equivalence_result')
  }
}
