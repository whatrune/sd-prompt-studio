import { createHash } from 'node:crypto'
import { TextDecoder } from 'node:util'

const CONTRACT_TASK = 'DESIGN-WORKTREE-GC-CONTRACT-001'
const PHASE1_TASK = 'DESIGN-WORKTREE-GC-V1-PHASE1-READ-ONLY-INVENTORY-001'
const REPOSITORY = 'whatrune/sd-prompt-studio'
const SHA256 = /^sha256:[0-9a-f]{64}$/
const SHA40 = /^[0-9a-f]{40}$/
const RFC3339_SECONDS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/
const UINT64_DECIMAL = /^(?:0|[1-9][0-9]*)$/
const decoder = new TextDecoder('utf-8', { fatal: true })
const CAPACITY_UNCERTAINTY_CODES = [
  'unreadable_entry', 'reparse_or_mount', 'volume_changed',
  'allocation_size_unavailable', 'hardlink_exclusivity_unproved', 'cloud_placeholder',
  'sparse_allocation', 'compression_or_dedup_unknown', 'alternate_stream_unenumerated',
  'overflow', 'identity_changed', 'enumeration_changed',
]
const BLOCKING_REASON_CODES = [
  'keep_authority_conflict', 'expired_keep_unresolved', 'schema_unsupported',
  'authority_drift', 'path_identity_mismatch', 'linked_or_unreadable',
  'active_or_locked', 'dirty_or_evidence_present', 'unpushed_or_unbound_history',
  'open_task_or_pr', 'merge_ambiguous',
]

const OBSERVATION_KEYS = [
  'schema_version', 'repository', 'authority_main_sha', 'observed_at', 'git_version',
  'common_git_dir_identity_sha256', 'command_argv', 'porcelain_encoding',
  'porcelain_byte_length', 'porcelain_sha256', 'registered_worktree_count',
  'locked_marker_count', 'prunable_marker_count', 'path_disclosure', 'mutation_performed',
]
const INVENTORY_KEYS = [
  'schema_version', 'repository_identity', 'observation_ref', 'path_identity',
  'is_primary_repository', 'head_binding', 'registration_state', 'working_tree_state',
  'history_state', 'task_pr_state', 'activity_lock_state', 'explicit_keep_authority_refs',
  'merge_evidence', 'inactivity_evidence', 'capacity_estimate_ref', 'inventory_evidence_digest',
]

export class WorktreeGcPhase1ContractError extends Error {
  constructor(code, path, message = code) {
    super(message)
    this.name = 'WorktreeGcPhase1ContractError'
    this.code = code
    this.path = path
  }
}

const fail = (code, path, message) => { throw new WorktreeGcPhase1ContractError(code, path, message) }
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)

function closed(value, keys, path) {
  if (!isObject(value)) fail('structural_invalid', path)
  const extras = Object.keys(value).filter(key => !keys.includes(key))
  if (extras.length) fail('unknown_field', `${path}/${extras[0]}`)
  const missing = keys.filter(key => !Object.hasOwn(value, key))
  if (missing.length) fail('missing_field', `${path}/${missing[0]}`)
}

function oneOf(value, values, path) {
  if (!values.includes(value)) fail('structural_invalid', path)
}

function string(value, path, pattern = null) {
  if (typeof value !== 'string' || value.length === 0 || value !== value.normalize('NFC')) {
    fail('structural_invalid', path)
  }
  if (pattern && !pattern.test(value)) fail('structural_invalid', path)
}

function canonicalUrl(value, path) {
  string(value, path)
  let parsed
  try { parsed = new URL(value) } catch { fail('structural_invalid', path) }
  if (parsed.protocol !== 'https:') fail('structural_invalid', path)
}

function timestamp(value, path) {
  string(value, path, RFC3339_SECONDS)
  if (Number.isNaN(Date.parse(value))) fail('structural_invalid', path)
}

function uint32(value, path) {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) fail('structural_invalid', path)
}

function uint64(value, path) {
  string(value, path, UINT64_DECIMAL)
  if (BigInt(value) > 0xffffffffffffffffn) fail('structural_invalid', path)
}

function sha(value, path) { string(value, path, SHA256) }
function sha40(value, path) { string(value, path, SHA40) }

function compareUnsignedUtf8(left, right) {
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'))
}

function sortedUniqueStrings(value, path, validate = string) {
  if (!Array.isArray(value)) fail('structural_invalid', path)
  value.forEach((entry, index) => validate(entry, `${path}/${index}`))
  for (let index = 1; index < value.length; index += 1) {
    const compared = compareUnsignedUtf8(value[index - 1], value[index])
    if (compared === 0) fail('duplicate_identity', `${path}/${index}`)
    if (compared > 0) fail('structural_invalid', `${path}/${index}`)
  }
}

function sortedUniqueRecordRefs(value, expectedType, path) {
  if (!Array.isArray(value)) fail('structural_invalid', path)
  value.forEach((entry, index) => recordRef(entry, expectedType, `${path}/${index}`))
  for (let index = 1; index < value.length; index += 1) {
    const compared = compareUnsignedUtf8(value[index - 1].record_id, value[index].record_id)
    if (compared === 0) fail('duplicate_identity', `${path}/${index}`)
    if (compared > 0) fail('structural_invalid', `${path}/${index}`)
  }
}

function closedCatalog(value, catalog, path) {
  sortedUniqueStrings(value, path)
  value.forEach((entry, index) => {
    if (!catalog.includes(entry)) fail('structural_invalid', `${path}/${index}`)
  })
}

function canonicalize(value) {
  if (value === null) return 'null'
  if (typeof value === 'string') {
    if (value !== value.normalize('NFC')) fail('structural_invalid', '/')
    return JSON.stringify(value)
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail('structural_invalid', '/')
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`
  if (!isObject(value)) fail('structural_invalid', '/')
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`
}

export function CanonicalizeWorktreeGcPhase1JcsUtf8V1(value) {
  return Buffer.from(canonicalize(value), 'utf8')
}

export function DigestWorktreeGcPhase1InventoryArtifactV1(bytes) {
  if (!(bytes instanceof Uint8Array)) fail('structural_invalid', '/artifact_bytes_utf8')
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`
}

function recordRef(value, expectedType, path) {
  closed(value, ['record_type', 'record_id', 'record_digest', 'authority_url'], path)
  if (value.record_type !== expectedType) fail('inventory_reference_mismatch', `${path}/record_type`)
  sha(value.record_digest, `${path}/record_digest`)
  if (value.record_id !== `${expectedType}:${value.record_digest.slice(7)}`) {
    fail('inventory_reference_mismatch', `${path}/record_id`)
  }
  canonicalUrl(value.authority_url, `${path}/authority_url`)
}

function sameRecordRef(reference, record) {
  return reference.record_type === record.record_type &&
    reference.record_id === record.record_id &&
    reference.record_digest === record.record_digest &&
    reference.authority_url === record.authority_url
}

function repositoryIdentity(value, path) {
  closed(value, ['repository', 'owner', 'name', 'authority_main_sha', 'common_git_dir_identity', 'remote_identity'], path)
  canonicalUrl(value.repository, `${path}/repository`)
  string(value.owner, `${path}/owner`)
  string(value.name, `${path}/name`)
  sha40(value.authority_main_sha, `${path}/authority_main_sha`)
  sha(value.common_git_dir_identity, `${path}/common_git_dir_identity`)
  canonicalUrl(value.remote_identity, `${path}/remote_identity`)
}

function pathIdentity(value, path) {
  if (!isObject(value)) fail('structural_invalid', path)
  if (value.identity_kind === 'existing_handle_identity') {
    closed(value, ['identity_kind', 'canonical_path', 'registered_path_sha256', 'final_path_sha256', 'volume_serial_hex', 'file_id_128_hex', 'common_git_dir_identity', 'registration_admin_id', 'reparse_state', 'filesystem_state'], path)
    string(value.canonical_path, `${path}/canonical_path`)
    sha(value.registered_path_sha256, `${path}/registered_path_sha256`)
    sha(value.final_path_sha256, `${path}/final_path_sha256`)
    string(value.volume_serial_hex, `${path}/volume_serial_hex`, /^[0-9a-f]+$/)
    string(value.file_id_128_hex, `${path}/file_id_128_hex`, /^[0-9a-f]{32}$/)
    sha(value.common_git_dir_identity, `${path}/common_git_dir_identity`)
    sha(value.registration_admin_id, `${path}/registration_admin_id`)
    if (value.reparse_state !== 'none' || value.filesystem_state !== 'present') fail('structural_invalid', path)
    return
  }
  if (value.identity_kind === 'absent_registration_identity') {
    closed(value, ['identity_kind', 'canonical_path', 'registered_path_sha256', 'common_git_dir_identity', 'registration_admin_id', 'reparse_state', 'filesystem_state'], path)
    string(value.canonical_path, `${path}/canonical_path`)
    sha(value.registered_path_sha256, `${path}/registered_path_sha256`)
    sha(value.common_git_dir_identity, `${path}/common_git_dir_identity`)
    sha(value.registration_admin_id, `${path}/registration_admin_id`)
    if (value.reparse_state !== 'not_observable_absent' || value.filesystem_state !== 'absent') fail('structural_invalid', path)
    return
  }
  fail('structural_invalid', `${path}/identity_kind`)
}

function validateObservationPayload(payload, path) {
  closed(payload, OBSERVATION_KEYS, path)
  if (payload.schema_version !== 'WorktreeObservationSnapshotV1' || payload.repository !== REPOSITORY) fail('unsupported_schema', `${path}/schema_version`)
  sha40(payload.authority_main_sha, `${path}/authority_main_sha`)
  timestamp(payload.observed_at, `${path}/observed_at`)
  string(payload.git_version, `${path}/git_version`)
  sha(payload.common_git_dir_identity_sha256, `${path}/common_git_dir_identity_sha256`)
  if (JSON.stringify(payload.command_argv) !== JSON.stringify(['git', 'worktree', 'list', '--porcelain', '-z'])) fail('structural_invalid', `${path}/command_argv`)
  if (payload.porcelain_encoding !== 'git-porcelain-v1-nul-terminated-bytes') fail('structural_invalid', `${path}/porcelain_encoding`)
  uint64(payload.porcelain_byte_length, `${path}/porcelain_byte_length`)
  sha(payload.porcelain_sha256, `${path}/porcelain_sha256`)
  uint32(payload.registered_worktree_count, `${path}/registered_worktree_count`)
  uint32(payload.locked_marker_count, `${path}/locked_marker_count`)
  uint32(payload.prunable_marker_count, `${path}/prunable_marker_count`)
  if (payload.path_disclosure !== 'redacted_digest_only' || payload.mutation_performed !== false) fail('structural_invalid', path)
}

function validateCapacityPayload(payload, path) {
  const common = ['schema_version', 'path_identity_ref', 'observation_ref', 'state', 'enumerated_entry_count', 'evidence_digest', 'uncertainty_codes']
  const byState = {
    exact: ['logical_size_bytes', 'exclusive_allocated_bytes'],
    bounded: ['logical_size_bytes', 'exclusive_allocated_lower_bound_bytes', 'exclusive_allocated_upper_bound_bytes_or_null'],
    unknown: [],
  }
  if (!isObject(payload) || !Object.hasOwn(byState, payload.state)) fail('structural_invalid', `${path}/state`)
  closed(payload, [...common, ...byState[payload.state]], path)
  if (payload.schema_version !== 'CapacityEstimateV1') fail('unsupported_schema', `${path}/schema_version`)
  string(payload.path_identity_ref, `${path}/path_identity_ref`)
  recordRef(payload.observation_ref, 'worktree_observation', `${path}/observation_ref`)
  uint32(payload.enumerated_entry_count, `${path}/enumerated_entry_count`)
  sha(payload.evidence_digest, `${path}/evidence_digest`)
  closedCatalog(payload.uncertainty_codes, CAPACITY_UNCERTAINTY_CODES, `${path}/uncertainty_codes`)
  for (const key of byState[payload.state]) {
    const value = payload[key]
    if (key.endsWith('_or_null') && value === null) continue
    uint64(value, `${path}/${key}`)
  }
}

function validateInventoryPayload(payload, path) {
  closed(payload, INVENTORY_KEYS, path)
  if (payload.schema_version !== 'WorktreeInventoryPayloadV2') fail('unsupported_schema', `${path}/schema_version`)
  repositoryIdentity(payload.repository_identity, `${path}/repository_identity`)
  recordRef(payload.observation_ref, 'worktree_observation', `${path}/observation_ref`)
  pathIdentity(payload.path_identity, `${path}/path_identity`)
  if (typeof payload.is_primary_repository !== 'boolean') fail('structural_invalid', `${path}/is_primary_repository`)
  closed(payload.head_binding, ['head_sha', 'ref_kind', 'ref_name'], `${path}/head_binding`)
  sha40(payload.head_binding.head_sha, `${path}/head_binding/head_sha`)
  oneOf(payload.head_binding.ref_kind, ['branch', 'detached'], `${path}/head_binding/ref_kind`)
  if (payload.head_binding.ref_name !== null) string(payload.head_binding.ref_name, `${path}/head_binding/ref_name`)
  closed(payload.registration_state, ['state', 'porcelain_entry_sha256', 'admin_state'], `${path}/registration_state`)
  oneOf(payload.registration_state.state, ['registered', 'stale_registration'], `${path}/registration_state/state`)
  sha(payload.registration_state.porcelain_entry_sha256, `${path}/registration_state/porcelain_entry_sha256`)
  oneOf(payload.registration_state.admin_state, ['present', 'unreadable', 'missing'], `${path}/registration_state/admin_state`)
  closed(payload.working_tree_state, ['staged', 'unstaged', 'untracked', 'ignored', 'submodule'], `${path}/working_tree_state`)
  for (const key of Object.keys(payload.working_tree_state)) oneOf(payload.working_tree_state[key], ['clean', 'present', 'unknown'], `${path}/working_tree_state/${key}`)
  closed(payload.history_state, ['upstream', 'ahead_count', 'behind_count', 'reachable_remote_ref_sha256s', 'unpushed_state'], `${path}/history_state`)
  oneOf(payload.history_state.upstream, ['present', 'missing', 'unknown'], `${path}/history_state/upstream`)
  if (payload.history_state.ahead_count !== null) uint32(payload.history_state.ahead_count, `${path}/history_state/ahead_count`)
  if (payload.history_state.behind_count !== null) uint32(payload.history_state.behind_count, `${path}/history_state/behind_count`)
  sortedUniqueStrings(payload.history_state.reachable_remote_ref_sha256s, `${path}/history_state/reachable_remote_ref_sha256s`, sha)
  oneOf(payload.history_state.unpushed_state, ['none', 'present', 'unknown'], `${path}/history_state/unpushed_state`)
  closed(payload.task_pr_state, ['task_state', 'pr_state', 'authority_urls'], `${path}/task_pr_state`)
  oneOf(payload.task_pr_state.task_state, ['none', 'open', 'unresolved', 'unknown'], `${path}/task_pr_state/task_state`)
  oneOf(payload.task_pr_state.pr_state, ['none', 'open', 'unresolved', 'unknown'], `${path}/task_pr_state/pr_state`)
  sortedUniqueStrings(payload.task_pr_state.authority_urls, `${path}/task_pr_state/authority_urls`, canonicalUrl)
  closed(payload.activity_lock_state, ['git_lock', 'process_or_handle', 'evidence_refs'], `${path}/activity_lock_state`)
  oneOf(payload.activity_lock_state.git_lock, ['absent', 'present', 'unknown'], `${path}/activity_lock_state/git_lock`)
  oneOf(payload.activity_lock_state.process_or_handle, ['absent', 'present', 'unknown'], `${path}/activity_lock_state/process_or_handle`)
  sortedUniqueStrings(payload.activity_lock_state.evidence_refs, `${path}/activity_lock_state/evidence_refs`, canonicalUrl)
  sortedUniqueRecordRefs(payload.explicit_keep_authority_refs, 'explicit_keep_authority', `${path}/explicit_keep_authority_refs`)
  closed(payload.merge_evidence, ['kind', 'authority_url', 'admitted_main_sha'], `${path}/merge_evidence`)
  oneOf(payload.merge_evidence.kind, ['exact_head_ancestor_of_admitted_main', 'merged_pr_exact_head', 'ambiguous', 'none'], `${path}/merge_evidence/kind`)
  if (payload.merge_evidence.authority_url !== null) canonicalUrl(payload.merge_evidence.authority_url, `${path}/merge_evidence/authority_url`)
  sha40(payload.merge_evidence.admitted_main_sha, `${path}/merge_evidence/admitted_main_sha`)
  closed(payload.inactivity_evidence, ['policy_ref', 'threshold_seconds', 'last_activity_at', 'state'], `${path}/inactivity_evidence`)
  if (payload.inactivity_evidence.policy_ref !== null) canonicalUrl(payload.inactivity_evidence.policy_ref, `${path}/inactivity_evidence/policy_ref`)
  if (payload.inactivity_evidence.threshold_seconds !== null) uint64(payload.inactivity_evidence.threshold_seconds, `${path}/inactivity_evidence/threshold_seconds`)
  if (payload.inactivity_evidence.last_activity_at !== null) timestamp(payload.inactivity_evidence.last_activity_at, `${path}/inactivity_evidence/last_activity_at`)
  oneOf(payload.inactivity_evidence.state, ['satisfied', 'not_satisfied', 'unknown'], `${path}/inactivity_evidence/state`)
  recordRef(payload.capacity_estimate_ref, 'capacity_estimate', `${path}/capacity_estimate_ref`)
  sha(payload.inventory_evidence_digest, `${path}/inventory_evidence_digest`)
  const projection = { ...payload }
  delete projection.inventory_evidence_digest
  if (DigestWorktreeGcPhase1InventoryArtifactV1(CanonicalizeWorktreeGcPhase1JcsUtf8V1(projection)) !== payload.inventory_evidence_digest) {
    fail('artifact_digest_mismatch', `${path}/inventory_evidence_digest`)
  }
}

export function validateWorktreeInventoryPayloadV2(payload) {
  validateInventoryPayload(payload, '/payload')
  return payload
}

export function validateWorktreeClassificationPayloadV2(payload) {
  const path = '/payload'
  closed(payload, ['schema_version', 'inventory_ref', 'inventory_evidence_digest', 'classification_rule_version', 'classification', 'blocking_reason_codes', 'evidence_refs', 'evaluated_at'], path)
  if (payload.schema_version !== 'WorktreeClassificationPayloadV2' || payload.classification_rule_version !== 'worktree-classification-rules-v2') fail('unsupported_schema', path)
  recordRef(payload.inventory_ref, 'worktree_inventory', `${path}/inventory_ref`)
  sha(payload.inventory_evidence_digest, `${path}/inventory_evidence_digest`)
  oneOf(payload.classification, [
    'protected_primary_repository', 'protected_explicit_keep', 'blocked_unknown',
    'blocked_path_identity', 'blocked_inaccessible_or_linked', 'blocked_active_or_locked',
    'blocked_dirty_or_evidence_present', 'blocked_unpushed_or_unbound_history',
    'blocked_open_task_or_pr', 'blocked_merge_ambiguous',
    'eligible_clean_merged_inactive_candidate', 'eligible_stale_registration_candidate',
    'not_candidate',
  ], `${path}/classification`)
  closedCatalog(payload.blocking_reason_codes, BLOCKING_REASON_CODES, `${path}/blocking_reason_codes`)
  sortedUniqueStrings(payload.evidence_refs, `${path}/evidence_refs`, canonicalUrl)
  timestamp(payload.evaluated_at, `${path}/evaluated_at`)
  return payload
}

export function BuildWorktreeGcRecordEnvelopeV1(recordType, authorityUrl, recordedAt, payload) {
  oneOf(recordType, ['worktree_observation', 'capacity_estimate', 'worktree_inventory', 'worktree_classification'], '/record_type')
  canonicalUrl(authorityUrl, '/authority_url')
  timestamp(recordedAt, '/recorded_at')
  if (recordType === 'worktree_observation') validateObservationPayload(payload, '/payload')
  if (recordType === 'capacity_estimate') validateCapacityPayload(payload, '/payload')
  if (recordType === 'worktree_inventory') validateInventoryPayload(payload, '/payload')
  if (recordType === 'worktree_classification') validateWorktreeClassificationPayloadV2(payload)
  const projection = {
    contract_version: 'worktree-gc-record-envelope-v1', record_type: recordType,
    task_id: CONTRACT_TASK, repository: REPOSITORY, authority_url: authorityUrl,
    recorded_at: recordedAt, payload,
  }
  const recordDigest = DigestWorktreeGcPhase1InventoryArtifactV1(CanonicalizeWorktreeGcPhase1JcsUtf8V1(projection))
  return Object.freeze({
    contract_version: projection.contract_version, record_type: recordType,
    record_id: `${recordType}:${recordDigest.slice(7)}`, task_id: CONTRACT_TASK,
    repository: REPOSITORY, authority_url: authorityUrl, recorded_at: recordedAt,
    payload, record_digest: recordDigest,
  })
}

export function ValidateWorktreeGcRecordEnvelopeV1(record, expectedType, path = '/record') {
  closed(record, ['contract_version', 'record_type', 'record_id', 'task_id', 'repository', 'authority_url', 'recorded_at', 'payload', 'record_digest'], path)
  if (record.contract_version !== 'worktree-gc-record-envelope-v1' || record.record_type !== expectedType || record.task_id !== CONTRACT_TASK || record.repository !== REPOSITORY) fail('unsupported_schema', path)
  canonicalUrl(record.authority_url, `${path}/authority_url`)
  timestamp(record.recorded_at, `${path}/recorded_at`)
  sha(record.record_digest, `${path}/record_digest`)
  const projection = {
    contract_version: record.contract_version, record_type: record.record_type,
    task_id: record.task_id, repository: record.repository, authority_url: record.authority_url,
    recorded_at: record.recorded_at, payload: record.payload,
  }
  const digest = DigestWorktreeGcPhase1InventoryArtifactV1(CanonicalizeWorktreeGcPhase1JcsUtf8V1(projection))
  if (record.record_digest !== digest || record.record_id !== `${expectedType}:${digest.slice(7)}`) fail('artifact_digest_mismatch', path)
  if (expectedType === 'worktree_observation') validateObservationPayload(record.payload, `${path}/payload`)
  if (expectedType === 'capacity_estimate') validateCapacityPayload(record.payload, `${path}/payload`)
  if (expectedType === 'worktree_inventory') validateInventoryPayload(record.payload, `${path}/payload`)
  if (expectedType === 'worktree_classification') validateWorktreeClassificationPayloadV2(record.payload)
  return record
}

function validateArtifact(artifact) {
  closed(artifact, ['artifact_version', 'task_id', 'repository', 'authority_main_sha', 'observation_record', 'capacity_estimate_records', 'inventory_records', 'path_disclosure', 'mutation_performed'], '')
  if (artifact.artifact_version !== 'worktree-gc-phase1-inventory-artifact-v1' || artifact.task_id !== PHASE1_TASK || artifact.repository !== REPOSITORY) fail('unsupported_schema', '/artifact_version')
  sha40(artifact.authority_main_sha, '/authority_main_sha')
  if (artifact.path_disclosure !== 'redacted_digest_only' || artifact.mutation_performed !== false) fail('structural_invalid', '/')
  ValidateWorktreeGcRecordEnvelopeV1(artifact.observation_record, 'worktree_observation', '/observation_record')
  if (!Array.isArray(artifact.capacity_estimate_records) || !Array.isArray(artifact.inventory_records)) fail('structural_invalid', '/')
  artifact.capacity_estimate_records.forEach((record, index) => ValidateWorktreeGcRecordEnvelopeV1(record, 'capacity_estimate', `/capacity_estimate_records/${index}`))
  artifact.inventory_records.forEach((record, index) => ValidateWorktreeGcRecordEnvelopeV1(record, 'worktree_inventory', `/inventory_records/${index}`))
  for (const [name, records] of [['capacity_estimate_records', artifact.capacity_estimate_records], ['inventory_records', artifact.inventory_records]]) {
    for (let index = 1; index < records.length; index += 1) {
      const compared = compareUnsignedUtf8(records[index - 1].record_id, records[index].record_id)
      if (compared === 0) fail('duplicate_identity', `/${name}/${index}`)
      if (compared > 0) fail('structural_invalid', `/${name}/${index}`)
    }
  }
  if (artifact.observation_record.payload.authority_main_sha !== artifact.authority_main_sha) fail('authority_binding_mismatch', '/observation_record/payload/authority_main_sha')
  const capacities = new Map(artifact.capacity_estimate_records.map(record => [record.record_id, record]))
  for (const record of artifact.capacity_estimate_records) {
    if (!sameRecordRef(record.payload.observation_ref, artifact.observation_record)) fail('inventory_reference_mismatch', '/capacity_estimate_records')
  }
  for (const record of artifact.inventory_records) {
    if (record.payload.repository_identity.authority_main_sha !== artifact.authority_main_sha) fail('authority_binding_mismatch', '/inventory_records')
    if (!sameRecordRef(record.payload.observation_ref, artifact.observation_record)) fail('inventory_reference_mismatch', '/inventory_records')
    const capacity = capacities.get(record.payload.capacity_estimate_ref.record_id)
    if (!capacity || !sameRecordRef(record.payload.capacity_estimate_ref, capacity)) fail('inventory_reference_mismatch', '/inventory_records')
  }
  return artifact
}

export function BuildWorktreeGcPhase1InventoryArtifactV1(records) {
  closed(records, ['authority_main_sha', 'observation_record', 'capacity_estimate_records', 'inventory_records'], '/records')
  sha40(records.authority_main_sha, '/records/authority_main_sha')
  if (!Array.isArray(records.capacity_estimate_records) || !Array.isArray(records.inventory_records)) fail('structural_invalid', '/records')
  const capacity = [...records.capacity_estimate_records].sort((a, b) => compareUnsignedUtf8(a.record_id, b.record_id))
  const inventory = [...records.inventory_records].sort((a, b) => compareUnsignedUtf8(a.record_id, b.record_id))
  const artifact = {
    artifact_version: 'worktree-gc-phase1-inventory-artifact-v1', task_id: PHASE1_TASK,
    repository: REPOSITORY, authority_main_sha: records.authority_main_sha,
    observation_record: records.observation_record, capacity_estimate_records: capacity,
    inventory_records: inventory, path_disclosure: 'redacted_digest_only', mutation_performed: false,
  }
  validateArtifact(artifact)
  return CanonicalizeWorktreeGcPhase1JcsUtf8V1(artifact)
}

export function ParseWorktreeGcPhase1InventoryArtifactV1(bytes) {
  if (!(bytes instanceof Uint8Array)) fail('structural_invalid', '/artifact_bytes_utf8')
  let text
  try { text = decoder.decode(bytes) } catch { fail('structural_invalid', '/artifact_bytes_utf8') }
  let artifact
  try { artifact = JSON.parse(text) } catch { fail('structural_invalid', '/artifact_bytes_utf8') }
  const canonical = CanonicalizeWorktreeGcPhase1JcsUtf8V1(artifact)
  if (!Buffer.from(bytes).equals(canonical)) fail('structural_invalid', '/artifact_bytes_utf8')
  return validateArtifact(artifact)
}
