import type { ReadyReviewTerminalObservationArtifactV1 } from './ready-review-terminal-observation-artifact-v1'

const collectorModulePath = './ready-review-terminal-observation-artifact-v1.ts'
const {
  READY_REVIEW_TERMINAL_OBSERVATION_ARTIFACT_V1,
  canonicalizeReadyReviewObservationJcsV1,
  deepFreezeReadyReviewObservationV1,
  digestReadyReviewObservationProjectionV1,
  parseReadyReviewTerminalObservationArtifactV1,
  sha256ReadyReviewObservationV1,
} = await import(collectorModulePath) as typeof import('./ready-review-terminal-observation-artifact-v1')

export const PROTECTED_TRANSITION_ADMISSION_INPUT_V1 = 'protected-transition-admission-input-v1' as const
export const PROTECTED_TRANSITION_ADMISSION_RECEIPT_V1 = 'protected-transition-admission-receipt-v1' as const
export const PROTECTED_TRANSITION_ADMISSION_RESULT_V1 = 'protected-transition-admission-result-v1' as const
export const PROTECTED_TRANSITION_COLLECTOR_FILE_V1 = 'ready-review-terminal-observation-artifact-v1.jcs' as const
export const PROTECTED_TRANSITION_RECEIPT_FILE_V1 = 'protected-transition-admission-v1-receipt.jcs' as const

export type ProtectedTransitionV1 = 'terminal_review_admission' | 'merge_decision_admission'
export type ProtectedTransitionActorRoleV1 = 'Independent PR Reviewer' | 'Product Owner'
type JsonObject = Record<string, unknown>

export type ProtectedTransitionAdmissionReceiptV1 = Readonly<{
  receipt_version: typeof PROTECTED_TRANSITION_ADMISSION_RECEIPT_V1
  result: 'accepted' | 'rejected'
  transition: ProtectedTransitionV1
  repository: string
  repository_id: string
  task_record_url: string
  task_scope_digest: string
  pr_number: number
  pr_url: string
  exact_head: string
  ready_generation_record_url: string
  ready_generation_record_digest: string
  ready_event_endpoint: string
  ready_event_id: string
  ready_occurred_at: string
  ready_event_commit_id: string
  ready_actor_login: string
  actor_login: string
  actor_role: ProtectedTransitionActorRoleV1
  trust_root_record_url: string
  trust_root_record_digest: string
  trust_root_review_url: string
  trust_root_review_digest: string
  assignment_record_url: string
  assignment_record_digest: string
  assignment_id: string
  assignment_revision: number
  assignment_issuer_login: string
  assignment_issuer_role: 'Integrated Lead' | 'Product Owner'
  collector_artifact_version: typeof READY_REVIEW_TERMINAL_OBSERVATION_ARTIFACT_V1
  collector_artifact_digest: string
  collector_artifact_jcs_sha256: string
  thread_snapshot_digest: string
  terminal_review_record_url: string | null
  terminal_review_record_digest: string | null
  terminal_review_decision: 'APPROVE' | null
  terminal_review_accepted_receipt_digest: string | null
  default_branch: 'main'
  workflow_path: '.github/workflows/protected-transition-admission-v1.yml'
  workflow_ref: string
  workflow_sha: string
  workflow_run_id: string
  workflow_run_attempt: number
  workflow_actor: string
  workflow_run_url: string
  evaluated_at: string
  expires_at: string
  rejection_codes: readonly string[]
  state_changed: false
  admission_digest: string
}>

type TerminalReviewBindingV1 = Readonly<{
  record_url: string
  record_digest: string
  task_record_url: string
  repository: string
  pr_number: number
  pr_url: string
  exact_head: string
  ready_generation_record_url: string
  ready_event_id: string
  decision: 'APPROVE'
  actor_login: string
  published_at: string
  collector_artifact_digest: string
  accepted_receipts: readonly ProtectedTransitionAdmissionReceiptV1[]
}>

export type ProtectedTransitionAdmissionInputV1 = Readonly<{
  input_version: typeof PROTECTED_TRANSITION_ADMISSION_INPUT_V1
  transition: ProtectedTransitionV1
  repository: string
  repository_id: string
  task_record_url: string
  task_scope_digest: string
  pr_number: number
  pr_url: string
  exact_head: string
  ready_generation: Readonly<{
    record_url: string
    record_digest: string
    endpoint: string
    event_id: string
    occurred_at: string
    commit_id: string
    actor_login: string
  }>
  actor: Readonly<{
    login: string
  }>
  authority: Readonly<{
    trust_root: Readonly<{
      record_url: string
      record_digest: string
      review_url: string
      review_digest: string
      revision: 1
      issuer_anchor_url: string
      issuer_anchor_digest: string
      issuer_login: string
      issuer_role: 'Integrated Lead' | 'Product Owner'
      anchor_review_url: string | null
      anchor_review_digest: string | null
    }>
    assignment: Readonly<{
      record_url: string
      record_digest: string
      assignment_id: string
      revision: number
      issuer_login: string
      issuer_role: 'Integrated Lead' | 'Product Owner'
      assigned_login: string
      assigned_role: ProtectedTransitionActorRoleV1
      transition: ProtectedTransitionV1
    }>
  }>
  collector_artifact_jcs: string
  collector_artifact_jcs_sha256: string
  terminal_review: TerminalReviewBindingV1 | null
  workflow_identity: Readonly<{
    path: '.github/workflows/protected-transition-admission-v1.yml'
    ref: string
    sha: string
    invocation_ref: string
    run_id: string
    run_attempt: number
    actor: string
    server_url: string
    run_url: string
    default_branch: string
  }>
  current_state: Readonly<{
    repository: string
    pr_number: number
    exact_head: string
    task_scope_digest: string
    ready_generation_record_url: string
    ready_event_id: string
    ready_occurred_at: string
    ready_actor_login: string
    actor_login: string
    actor_role: ProtectedTransitionActorRoleV1
    assignment_record_url: string
    assignment_record_digest: string
    trust_root_record_url: string
    trust_root_record_digest: string
    default_branch: string
    workflow_sha: string
    thread_snapshot_digest: string
    terminal_review_decision: 'APPROVE' | null
    latest_protected_event_at: string
  }>
  persistence: Readonly<{
    owner: 'github_actions_artifact_service'
    available: boolean
  }>
  evaluated_at: string
}>

type PersistedFileV1 = Readonly<{ file_name: string; utf8_jcs: string; sha256: string }>

export type ProtectedTransitionAdmissionResultV1 =
  | Readonly<{
      result_version: typeof PROTECTED_TRANSITION_ADMISSION_RESULT_V1
      result: 'accepted'
      transition: ProtectedTransitionV1
      state_changed: false
      protected_transition_performed: false
      receipt_count: 1
      admitted_artifact_count: 1
      receipt: ProtectedTransitionAdmissionReceiptV1
      files_to_persist: readonly [PersistedFileV1, PersistedFileV1]
    }>
  | Readonly<{
      result_version: typeof PROTECTED_TRANSITION_ADMISSION_RESULT_V1
      result: 'rejected'
      transition: ProtectedTransitionV1
      state_changed: false
      protected_transition_performed: false
      receipt_count: 1
      admitted_artifact_count: 0
      receipt: ProtectedTransitionAdmissionReceiptV1
      rejection_codes: readonly string[]
      files_to_persist: readonly [PersistedFileV1]
    }>
  | Readonly<{
      result_version: typeof PROTECTED_TRANSITION_ADMISSION_RESULT_V1
      result: 'failed'
      transition: ProtectedTransitionV1 | null
      state_changed: false
      protected_transition_performed: false
      receipt_count: 0
      admitted_artifact_count: 0
      failure: Readonly<{ code: string; diagnostic_digest: string; safe_message: string }>
      files_to_persist: readonly []
    }>

const INPUT_KEYS = [
  'input_version', 'transition', 'repository', 'repository_id', 'task_record_url', 'task_scope_digest', 'pr_number', 'pr_url', 'exact_head',
  'ready_generation', 'actor', 'authority', 'collector_artifact_jcs', 'collector_artifact_jcs_sha256', 'terminal_review', 'workflow_identity', 'current_state',
  'persistence', 'evaluated_at',
] as const
const READY_KEYS = ['record_url', 'record_digest', 'endpoint', 'event_id', 'occurred_at', 'commit_id', 'actor_login'] as const
const ACTOR_KEYS = ['login'] as const
const AUTHORITY_KEYS = ['trust_root', 'assignment'] as const
const TRUST_ROOT_KEYS = [
  'record_url', 'record_digest', 'review_url', 'review_digest', 'revision', 'issuer_anchor_url', 'issuer_anchor_digest', 'issuer_login', 'issuer_role',
  'anchor_review_url', 'anchor_review_digest',
] as const
const ASSIGNMENT_KEYS = [
  'record_url', 'record_digest', 'assignment_id', 'revision', 'issuer_login', 'issuer_role', 'assigned_login', 'assigned_role', 'transition',
] as const
const WORKFLOW_KEYS = ['path', 'ref', 'sha', 'invocation_ref', 'run_id', 'run_attempt', 'actor', 'server_url', 'run_url', 'default_branch'] as const
const CURRENT_KEYS = [
  'repository', 'pr_number', 'exact_head', 'task_scope_digest', 'ready_generation_record_url', 'ready_event_id', 'ready_occurred_at',
  'ready_actor_login', 'actor_login', 'actor_role', 'assignment_record_url', 'assignment_record_digest', 'trust_root_record_url',
  'trust_root_record_digest', 'default_branch', 'workflow_sha', 'thread_snapshot_digest', 'terminal_review_decision',
  'latest_protected_event_at',
] as const
const PERSISTENCE_KEYS = ['owner', 'available'] as const
const TERMINAL_KEYS = [
  'record_url', 'record_digest', 'task_record_url', 'repository', 'pr_number', 'pr_url', 'exact_head', 'ready_generation_record_url',
  'ready_event_id', 'decision', 'actor_login', 'published_at', 'collector_artifact_digest', 'accepted_receipts',
] as const
const RECEIPT_KEYS = [
  'receipt_version', 'result', 'transition', 'repository', 'repository_id', 'task_record_url', 'task_scope_digest', 'pr_number', 'pr_url', 'exact_head',
  'ready_generation_record_url', 'ready_generation_record_digest', 'ready_event_endpoint', 'ready_event_id', 'ready_occurred_at', 'ready_event_commit_id',
  'ready_actor_login', 'actor_login', 'actor_role', 'trust_root_record_url', 'trust_root_record_digest', 'trust_root_review_url', 'trust_root_review_digest',
  'assignment_record_url', 'assignment_record_digest', 'assignment_id', 'assignment_revision', 'assignment_issuer_login', 'assignment_issuer_role',
  'collector_artifact_version', 'collector_artifact_digest', 'collector_artifact_jcs_sha256', 'thread_snapshot_digest', 'terminal_review_record_url',
  'terminal_review_record_digest', 'terminal_review_decision', 'terminal_review_accepted_receipt_digest', 'default_branch', 'workflow_path', 'workflow_ref',
  'workflow_sha', 'workflow_run_id', 'workflow_run_attempt', 'workflow_actor', 'workflow_run_url', 'evaluated_at', 'expires_at', 'rejection_codes',
  'state_changed', 'admission_digest',
] as const

const isObject = (value: unknown): value is JsonObject => value !== null && typeof value === 'object' && !Array.isArray(value)
const exactKeys = (value: unknown, keys: readonly string[]): value is JsonObject =>
  isObject(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key))
const nonEmpty = (value: unknown): value is string => typeof value === 'string' && value.length > 0
const sha256 = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value)
const fullHead = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{40}$/.test(value)
const repository = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value)
const commentUrl = (value: unknown): value is string => typeof value === 'string' && /^https:\/\/github\.com\/[^/]+\/[^/]+\/issues\/\d+#issuecomment-\d+$/.test(value)
const issueOrCommentUrl = (value: unknown): value is string => typeof value === 'string' && /^https:\/\/github\.com\/[^/]+\/[^/]+\/issues\/\d+(?:#issuecomment-\d+)?$/.test(value)
const prUrl = (value: unknown): value is string => typeof value === 'string' && /^https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+$/.test(value)
const readyTimelineUrl = (value: unknown): value is string => typeof value === 'string' && /^https:\/\/api\.github\.com\/repos\/[^/]+\/[^/]+\/issues\/\d+\/timeline$/.test(value)
const isoTime = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) && !Number.isNaN(Date.parse(value))
const roleFor = (transition: ProtectedTransitionV1): ProtectedTransitionActorRoleV1 =>
  transition === 'terminal_review_admission' ? 'Independent PR Reviewer' : 'Product Owner'
const without = (value: JsonObject, key: string): JsonObject => Object.fromEntries(Object.entries(value).filter(([name]) => name !== key))
const sortedUnique = (values: readonly string[]): boolean => values.every((value, index) => nonEmpty(value) && (index === 0 || values[index - 1] < value))

const validateReceiptV1 = async (value: unknown): Promise<boolean> => {
  if (!exactKeys(value, RECEIPT_KEYS) || value.receipt_version !== PROTECTED_TRANSITION_ADMISSION_RECEIPT_V1 ||
      (value.result !== 'accepted' && value.result !== 'rejected') ||
      (value.transition !== 'terminal_review_admission' && value.transition !== 'merge_decision_admission') ||
      !repository(value.repository) || !nonEmpty(value.repository_id) || !issueOrCommentUrl(value.task_record_url) || !sha256(value.task_scope_digest) ||
      !Number.isSafeInteger(value.pr_number) || Number(value.pr_number) <= 0 || !prUrl(value.pr_url) || !fullHead(value.exact_head) ||
      !commentUrl(value.ready_generation_record_url) || !sha256(value.ready_generation_record_digest) || !readyTimelineUrl(value.ready_event_endpoint) ||
      !nonEmpty(value.ready_event_id) || !isoTime(value.ready_occurred_at) || !fullHead(value.ready_event_commit_id) || !nonEmpty(value.ready_actor_login) ||
      !nonEmpty(value.actor_login) || (value.actor_role !== 'Independent PR Reviewer' && value.actor_role !== 'Product Owner') || !commentUrl(value.trust_root_record_url) ||
      !sha256(value.trust_root_record_digest) || !commentUrl(value.trust_root_review_url) || !sha256(value.trust_root_review_digest) ||
      !commentUrl(value.assignment_record_url) || !sha256(value.assignment_record_digest) || !nonEmpty(value.assignment_id) ||
      !Number.isSafeInteger(value.assignment_revision) || Number(value.assignment_revision) <= 0 || !nonEmpty(value.assignment_issuer_login) ||
      (value.assignment_issuer_role !== 'Integrated Lead' && value.assignment_issuer_role !== 'Product Owner') ||
      value.collector_artifact_version !== READY_REVIEW_TERMINAL_OBSERVATION_ARTIFACT_V1 || !sha256(value.collector_artifact_digest) ||
      !sha256(value.collector_artifact_jcs_sha256) || !sha256(value.thread_snapshot_digest) || value.default_branch !== 'main' ||
      value.workflow_path !== '.github/workflows/protected-transition-admission-v1.yml' || !nonEmpty(value.workflow_ref) || !fullHead(value.workflow_sha) ||
      !nonEmpty(value.workflow_run_id) || !Number.isSafeInteger(value.workflow_run_attempt) || Number(value.workflow_run_attempt) <= 0 ||
      !nonEmpty(value.workflow_actor) || !nonEmpty(value.workflow_run_url) || !isoTime(value.evaluated_at) || !isoTime(value.expires_at) ||
      Date.parse(value.expires_at) - Date.parse(value.evaluated_at) !== 30 * 60 * 1000 || !Array.isArray(value.rejection_codes) ||
      !value.rejection_codes.every(nonEmpty) || !sortedUnique(value.rejection_codes as string[]) || value.state_changed !== false || !sha256(value.admission_digest)) return false
  if ((value.result === 'accepted') !== (value.rejection_codes.length === 0)) return false
  if (value.result === 'accepted' && (
    value.ready_event_commit_id !== value.exact_head || value.actor_role !== roleFor(value.transition) ||
    (value.transition === 'terminal_review_admission' && value.assignment_issuer_role !== 'Integrated Lead') ||
    (value.transition === 'merge_decision_admission' && value.assignment_issuer_role !== 'Product Owner')
  )) return false
  const terminalFields = [value.terminal_review_record_url, value.terminal_review_record_digest, value.terminal_review_decision, value.terminal_review_accepted_receipt_digest]
  if (value.transition === 'terminal_review_admission') {
    if (!terminalFields.every((field) => field === null)) return false
  } else if (!commentUrl(value.terminal_review_record_url) || !sha256(value.terminal_review_record_digest) ||
      value.terminal_review_decision !== 'APPROVE' || !sha256(value.terminal_review_accepted_receipt_digest)) return false
  return await digestReadyReviewObservationProjectionV1(without(value, 'admission_digest')) === value.admission_digest
}

const validateTerminalReviewBindingV1 = async (value: unknown): Promise<boolean> => {
  if (!exactKeys(value, TERMINAL_KEYS) || !commentUrl(value.record_url) || !sha256(value.record_digest) || !issueOrCommentUrl(value.task_record_url) ||
      !repository(value.repository) || !Number.isSafeInteger(value.pr_number) || Number(value.pr_number) <= 0 || !prUrl(value.pr_url) ||
      !fullHead(value.exact_head) || !commentUrl(value.ready_generation_record_url) || !nonEmpty(value.ready_event_id) || value.decision !== 'APPROVE' ||
      !nonEmpty(value.actor_login) || !isoTime(value.published_at) || !sha256(value.collector_artifact_digest) || !Array.isArray(value.accepted_receipts)) return false
  if (await digestReadyReviewObservationProjectionV1(without(value, 'record_digest')) !== value.record_digest) return false
  for (const receipt of value.accepted_receipts) if (!await validateReceiptV1(receipt)) return false
  return true
}

const admittedInput = (value: unknown): value is ProtectedTransitionAdmissionInputV1 => {
  if (!exactKeys(value, INPUT_KEYS) || value.input_version !== PROTECTED_TRANSITION_ADMISSION_INPUT_V1 ||
      (value.transition !== 'terminal_review_admission' && value.transition !== 'merge_decision_admission') || !repository(value.repository) ||
      !nonEmpty(value.repository_id) || !issueOrCommentUrl(value.task_record_url) || !sha256(value.task_scope_digest) ||
      !Number.isSafeInteger(value.pr_number) || Number(value.pr_number) <= 0 || !prUrl(value.pr_url) || !fullHead(value.exact_head) ||
      !exactKeys(value.ready_generation, READY_KEYS) || !commentUrl(value.ready_generation.record_url) || !sha256(value.ready_generation.record_digest) ||
      !readyTimelineUrl(value.ready_generation.endpoint) || !nonEmpty(value.ready_generation.event_id) || !isoTime(value.ready_generation.occurred_at) ||
      !fullHead(value.ready_generation.commit_id) || !nonEmpty(value.ready_generation.actor_login) || !exactKeys(value.actor, ACTOR_KEYS) || !nonEmpty(value.actor.login) ||
      !exactKeys(value.authority, AUTHORITY_KEYS) || !exactKeys(value.authority.trust_root, TRUST_ROOT_KEYS) ||
      !commentUrl(value.authority.trust_root.record_url) || !sha256(value.authority.trust_root.record_digest) ||
      !commentUrl(value.authority.trust_root.review_url) || !sha256(value.authority.trust_root.review_digest) || value.authority.trust_root.revision !== 1 ||
      !commentUrl(value.authority.trust_root.issuer_anchor_url) || !sha256(value.authority.trust_root.issuer_anchor_digest) ||
      !nonEmpty(value.authority.trust_root.issuer_login) ||
      (value.authority.trust_root.issuer_role !== 'Integrated Lead' && value.authority.trust_root.issuer_role !== 'Product Owner') ||
      !((value.authority.trust_root.anchor_review_url === null && value.authority.trust_root.anchor_review_digest === null) ||
        (commentUrl(value.authority.trust_root.anchor_review_url) && sha256(value.authority.trust_root.anchor_review_digest))) ||
      !exactKeys(value.authority.assignment, ASSIGNMENT_KEYS) || !commentUrl(value.authority.assignment.record_url) ||
      !sha256(value.authority.assignment.record_digest) || !nonEmpty(value.authority.assignment.assignment_id) ||
      !Number.isSafeInteger(value.authority.assignment.revision) || Number(value.authority.assignment.revision) <= 0 ||
      !nonEmpty(value.authority.assignment.issuer_login) ||
      (value.authority.assignment.issuer_role !== 'Integrated Lead' && value.authority.assignment.issuer_role !== 'Product Owner') ||
      !nonEmpty(value.authority.assignment.assigned_login) ||
      (value.authority.assignment.assigned_role !== 'Independent PR Reviewer' && value.authority.assignment.assigned_role !== 'Product Owner') ||
      (value.authority.assignment.transition !== 'terminal_review_admission' && value.authority.assignment.transition !== 'merge_decision_admission') ||
      !nonEmpty(value.collector_artifact_jcs) ||
      !sha256(value.collector_artifact_jcs_sha256) || !(value.terminal_review === null || isObject(value.terminal_review)) ||
      !exactKeys(value.workflow_identity, WORKFLOW_KEYS) || value.workflow_identity.path !== '.github/workflows/protected-transition-admission-v1.yml' ||
      !nonEmpty(value.workflow_identity.ref) || !fullHead(value.workflow_identity.sha) || !nonEmpty(value.workflow_identity.invocation_ref) ||
      !nonEmpty(value.workflow_identity.run_id) || !Number.isSafeInteger(value.workflow_identity.run_attempt) || Number(value.workflow_identity.run_attempt) <= 0 ||
      !nonEmpty(value.workflow_identity.actor) || !nonEmpty(value.workflow_identity.server_url) || !nonEmpty(value.workflow_identity.run_url) ||
      !nonEmpty(value.workflow_identity.default_branch) || !exactKeys(value.current_state, CURRENT_KEYS) || !repository(value.current_state.repository) ||
      !Number.isSafeInteger(value.current_state.pr_number) || Number(value.current_state.pr_number) <= 0 || !fullHead(value.current_state.exact_head) ||
      !sha256(value.current_state.task_scope_digest) || !commentUrl(value.current_state.ready_generation_record_url) || !nonEmpty(value.current_state.ready_event_id) ||
      !isoTime(value.current_state.ready_occurred_at) || !nonEmpty(value.current_state.ready_actor_login) || !nonEmpty(value.current_state.actor_login) ||
      (value.current_state.actor_role !== 'Independent PR Reviewer' && value.current_state.actor_role !== 'Product Owner') ||
      !commentUrl(value.current_state.assignment_record_url) || !sha256(value.current_state.assignment_record_digest) ||
      !commentUrl(value.current_state.trust_root_record_url) || !sha256(value.current_state.trust_root_record_digest) ||
      !nonEmpty(value.current_state.default_branch) || !fullHead(value.current_state.workflow_sha) || !sha256(value.current_state.thread_snapshot_digest) ||
      !(value.current_state.terminal_review_decision === null || value.current_state.terminal_review_decision === 'APPROVE') ||
      !isoTime(value.current_state.latest_protected_event_at) || !exactKeys(value.persistence, PERSISTENCE_KEYS) ||
      value.persistence.owner !== 'github_actions_artifact_service' || typeof value.persistence.available !== 'boolean' || !isoTime(value.evaluated_at)) return false
  return true
}

const failureResult = async (transition: ProtectedTransitionV1 | null, code: string): Promise<ProtectedTransitionAdmissionResultV1> =>
  deepFreezeReadyReviewObservationV1({
    result_version: PROTECTED_TRANSITION_ADMISSION_RESULT_V1,
    result: 'failed' as const,
    transition,
    state_changed: false as const,
    protected_transition_performed: false as const,
    receipt_count: 0 as const,
    admitted_artifact_count: 0 as const,
    failure: {
      code,
      diagnostic_digest: await digestReadyReviewObservationProjectionV1({ code, transition }),
      safe_message: `protected transition admission failed: ${code}`,
    },
    files_to_persist: [] as const,
  }) as ProtectedTransitionAdmissionResultV1

const buildReceipt = async (
  input: ProtectedTransitionAdmissionInputV1,
  artifact: ReadyReviewTerminalObservationArtifactV1,
  result: 'accepted' | 'rejected',
  rejectionCodes: readonly string[],
): Promise<ProtectedTransitionAdmissionReceiptV1> => {
  const terminal = input.transition === 'merge_decision_admission' ? input.terminal_review : null
  const priorReceipt = terminal?.accepted_receipts.length === 1 ? terminal.accepted_receipts[0] : null
  const priorReceiptBindingDigest = terminal === null
    ? null
    : priorReceipt?.admission_digest ?? await digestReadyReviewObservationProjectionV1(terminal.accepted_receipts.map((receipt) => receipt.admission_digest))
  const projection = {
    receipt_version: PROTECTED_TRANSITION_ADMISSION_RECEIPT_V1,
    result,
    transition: input.transition,
    repository: input.repository,
    repository_id: input.repository_id,
    task_record_url: input.task_record_url,
    task_scope_digest: input.task_scope_digest,
    pr_number: input.pr_number,
    pr_url: input.pr_url,
    exact_head: input.exact_head,
    ready_generation_record_url: input.ready_generation.record_url,
    ready_generation_record_digest: input.ready_generation.record_digest,
    ready_event_endpoint: input.ready_generation.endpoint,
    ready_event_id: input.ready_generation.event_id,
    ready_occurred_at: input.ready_generation.occurred_at,
    ready_event_commit_id: input.ready_generation.commit_id,
    ready_actor_login: input.ready_generation.actor_login,
    actor_login: input.actor.login,
    actor_role: input.authority.assignment.assigned_role,
    trust_root_record_url: input.authority.trust_root.record_url,
    trust_root_record_digest: input.authority.trust_root.record_digest,
    trust_root_review_url: input.authority.trust_root.review_url,
    trust_root_review_digest: input.authority.trust_root.review_digest,
    assignment_record_url: input.authority.assignment.record_url,
    assignment_record_digest: input.authority.assignment.record_digest,
    assignment_id: input.authority.assignment.assignment_id,
    assignment_revision: input.authority.assignment.revision,
    assignment_issuer_login: input.authority.assignment.issuer_login,
    assignment_issuer_role: input.authority.assignment.issuer_role,
    collector_artifact_version: READY_REVIEW_TERMINAL_OBSERVATION_ARTIFACT_V1,
    collector_artifact_digest: artifact.artifact_digest,
    collector_artifact_jcs_sha256: input.collector_artifact_jcs_sha256,
    thread_snapshot_digest: artifact.thread_snapshot.snapshot_digest,
    terminal_review_record_url: terminal?.record_url ?? null,
    terminal_review_record_digest: terminal?.record_digest ?? null,
    terminal_review_decision: terminal?.decision ?? null,
    terminal_review_accepted_receipt_digest: priorReceiptBindingDigest,
    default_branch: 'main' as const,
    workflow_path: '.github/workflows/protected-transition-admission-v1.yml' as const,
    workflow_ref: input.workflow_identity.ref,
    workflow_sha: input.workflow_identity.sha,
    workflow_run_id: input.workflow_identity.run_id,
    workflow_run_attempt: input.workflow_identity.run_attempt,
    workflow_actor: input.workflow_identity.actor,
    workflow_run_url: input.workflow_identity.run_url,
    evaluated_at: input.evaluated_at,
    expires_at: new Date(Date.parse(input.evaluated_at) + 30 * 60 * 1000).toISOString(),
    rejection_codes: [...rejectionCodes],
    state_changed: false as const,
  }
  return deepFreezeReadyReviewObservationV1({
    ...projection,
    admission_digest: await digestReadyReviewObservationProjectionV1(projection),
  }) as ProtectedTransitionAdmissionReceiptV1
}

const semanticRejections = (
  input: ProtectedTransitionAdmissionInputV1,
  artifact: ReadyReviewTerminalObservationArtifactV1,
): string[] => {
  const codes: string[] = []
  const expectedPrUrl = `https://github.com/${input.repository}/pull/${input.pr_number}`
  const expectedWorkflowRef = `${input.repository}/.github/workflows/protected-transition-admission-v1.yml@refs/heads/main`
  const current = input.current_state
  const assignment = input.authority.assignment
  const root = input.authority.trust_root
  if (input.actor.login !== assignment.assigned_login || input.actor.login !== input.workflow_identity.actor || input.actor.login !== current.actor_login) codes.push('actor_mismatch')
  if (assignment.assigned_role !== roleFor(input.transition) || assignment.assigned_role !== current.actor_role || assignment.transition !== input.transition) codes.push('actor_role_mismatch')
  if (assignment.issuer_login !== root.issuer_login || assignment.issuer_role !== root.issuer_role ||
      (input.transition === 'terminal_review_admission' && root.issuer_role !== 'Integrated Lead') ||
      (input.transition === 'merge_decision_admission' && root.issuer_role !== 'Product Owner')) codes.push('assignment_issuer_mismatch')
  if (assignment.record_url !== current.assignment_record_url || assignment.record_digest !== current.assignment_record_digest ||
      root.record_url !== current.trust_root_record_url || root.record_digest !== current.trust_root_record_digest) codes.push('authority_binding_mismatch')
  if (input.repository !== current.repository || input.repository !== artifact.repository) codes.push('repository_mismatch')
  if (input.pr_number !== current.pr_number || input.pr_number !== artifact.pr_number || input.pr_url !== expectedPrUrl || input.pr_url !== artifact.pr_url) codes.push('pr_mismatch')
  if (input.exact_head !== current.exact_head || input.exact_head !== artifact.exact_head) codes.push('head_mismatch')
  if (input.task_scope_digest !== current.task_scope_digest) codes.push('task_scope_mismatch')
  if (input.ready_generation.record_url !== current.ready_generation_record_url || input.ready_generation.record_url !== artifact.ready_generation_record_url ||
      input.ready_generation.event_id !== current.ready_event_id || input.ready_generation.event_id !== artifact.ready_event_id ||
      input.ready_generation.occurred_at !== current.ready_occurred_at || input.ready_generation.occurred_at !== artifact.ready_occurred_at ||
      input.ready_generation.actor_login !== current.ready_actor_login || input.ready_generation.commit_id !== input.exact_head ||
      input.ready_generation.endpoint !== `https://api.github.com/repos/${input.repository}/issues/${input.pr_number}/timeline`) codes.push('ready_generation_mismatch')
  if (input.workflow_identity.path !== '.github/workflows/protected-transition-admission-v1.yml' || input.workflow_identity.ref !== expectedWorkflowRef ||
      input.workflow_identity.invocation_ref !== 'refs/heads/main' || input.workflow_identity.default_branch !== 'main' ||
      input.workflow_identity.sha !== current.workflow_sha || input.workflow_identity.actor !== input.actor.login) codes.push('workflow_identity_mismatch')
  if (artifact.thread_snapshot.snapshot_digest !== current.thread_snapshot_digest) codes.push('thread_snapshot_mismatch')
  const artifactObservedAt = artifact.thread_snapshot.post_snapshot_head_recheck.observed_at
  const age = Date.parse(input.evaluated_at) - Date.parse(artifactObservedAt)
  if (age < 0 || age > 30 * 60 * 1000) codes.push('collector_artifact_expired')
  if (input.transition === 'terminal_review_admission') {
    if (input.terminal_review !== null) codes.push('terminal_review_record_forbidden')
    if (current.terminal_review_decision !== null || current.latest_protected_event_at !== input.ready_generation.occurred_at) codes.push('protected_event_order_invalid')
  }
  return codes
}

export const evaluateProtectedTransitionAdmissionV1 = async (raw: unknown): Promise<ProtectedTransitionAdmissionResultV1> => {
  const transition = isObject(raw) && (raw.transition === 'terminal_review_admission' || raw.transition === 'merge_decision_admission') ? raw.transition : null
  try {
    if (!admittedInput(raw)) return await failureResult(transition, 'input_contract_invalid')
    const input = raw
    if (!input.persistence.available) return await failureResult(input.transition, 'persistence_unavailable')
    if (await sha256ReadyReviewObservationV1(input.collector_artifact_jcs) !== input.collector_artifact_jcs_sha256) {
      return await failureResult(input.transition, 'collector_artifact_digest_invalid')
    }
    const artifact = await parseReadyReviewTerminalObservationArtifactV1(input.collector_artifact_jcs)
    if (artifact === null) return await failureResult(input.transition, 'collector_artifact_invalid')

    const rejectionCodes = semanticRejections(input, artifact)
    if (input.transition === 'merge_decision_admission') {
      const terminal = input.terminal_review
      if (terminal === null || !await validateTerminalReviewBindingV1(terminal)) {
        return await failureResult(input.transition, 'terminal_review_record_invalid')
      }
      if (terminal.accepted_receipts.length !== 1) rejectionCodes.push('terminal_receipt_cardinality_invalid')
      const prior = terminal.accepted_receipts.length === 1 ? terminal.accepted_receipts[0] : null
      if (prior !== null) {
        if (prior.result !== 'accepted' || prior.transition !== 'terminal_review_admission' || prior.repository !== input.repository ||
            prior.task_record_url !== input.task_record_url || prior.task_scope_digest !== input.task_scope_digest || prior.pr_number !== input.pr_number ||
            prior.pr_url !== input.pr_url || prior.exact_head !== input.exact_head || prior.ready_generation_record_url !== input.ready_generation.record_url ||
            prior.ready_event_id !== input.ready_generation.event_id || prior.ready_occurred_at !== input.ready_generation.occurred_at ||
            prior.actor_login !== terminal.actor_login || prior.collector_artifact_digest !== terminal.collector_artifact_digest ||
            terminal.task_record_url !== input.task_record_url || terminal.repository !== input.repository || terminal.pr_number !== input.pr_number ||
            terminal.pr_url !== input.pr_url || terminal.exact_head !== input.exact_head || terminal.ready_generation_record_url !== input.ready_generation.record_url ||
            terminal.ready_event_id !== input.ready_generation.event_id) rejectionCodes.push('terminal_review_binding_mismatch')
        if (Date.parse(terminal.published_at) < Date.parse(prior.evaluated_at) || Date.parse(terminal.published_at) > Date.parse(prior.expires_at) ||
            Date.parse(input.evaluated_at) > Date.parse(prior.expires_at)) rejectionCodes.push('terminal_receipt_expired')
      }
      const currentArtifactObservedAt = artifact.thread_snapshot.post_snapshot_head_recheck.observed_at
      if (artifact.artifact_digest === terminal.collector_artifact_digest || Date.parse(currentArtifactObservedAt) <= Date.parse(terminal.published_at)) {
        rejectionCodes.push('distinct_post_terminal_artifact_required')
      }
      if (input.current_state.terminal_review_decision !== terminal.decision ||
          input.current_state.latest_protected_event_at !== terminal.published_at) rejectionCodes.push('protected_event_order_invalid')
    }

    const uniqueCodes = [...new Set(rejectionCodes)].sort()
    const result = uniqueCodes.length === 0 ? 'accepted' as const : 'rejected' as const
    const receipt = await buildReceipt(input, artifact, result, uniqueCodes)
    if (!await validateReceiptV1(receipt)) return await failureResult(input.transition, 'receipt_seal_invalid')
    const receiptJcs = canonicalizeReadyReviewObservationJcsV1(receipt)
    const receiptFile: PersistedFileV1 = {
      file_name: PROTECTED_TRANSITION_RECEIPT_FILE_V1,
      utf8_jcs: receiptJcs,
      sha256: await sha256ReadyReviewObservationV1(receiptJcs),
    }
    if (result === 'rejected') {
      return deepFreezeReadyReviewObservationV1({
        result_version: PROTECTED_TRANSITION_ADMISSION_RESULT_V1,
        result,
        transition: input.transition,
        state_changed: false as const,
        protected_transition_performed: false as const,
        receipt_count: 1 as const,
        admitted_artifact_count: 0 as const,
        receipt,
        rejection_codes: uniqueCodes,
        files_to_persist: [receiptFile] as const,
      }) as ProtectedTransitionAdmissionResultV1
    }
    const collectorFile: PersistedFileV1 = {
      file_name: PROTECTED_TRANSITION_COLLECTOR_FILE_V1,
      utf8_jcs: input.collector_artifact_jcs,
      sha256: input.collector_artifact_jcs_sha256,
    }
    return deepFreezeReadyReviewObservationV1({
      result_version: PROTECTED_TRANSITION_ADMISSION_RESULT_V1,
      result,
      transition: input.transition,
      state_changed: false as const,
      protected_transition_performed: false as const,
      receipt_count: 1 as const,
      admitted_artifact_count: 1 as const,
      receipt,
      files_to_persist: [collectorFile, receiptFile] as const,
    }) as ProtectedTransitionAdmissionResultV1
  } catch {
    return await failureResult(transition, 'evaluator_internal_failure')
  }
}
