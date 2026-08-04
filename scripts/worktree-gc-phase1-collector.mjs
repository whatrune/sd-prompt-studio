import {
  BuildWorktreeGcPhase1InventoryArtifactV1,
  BuildWorktreeGcRecordEnvelopeV1,
  CanonicalizeWorktreeGcPhase1JcsUtf8V1,
  DigestWorktreeGcPhase1InventoryArtifactV1,
  ValidateWorktreeGcPhase1KeepLifecycleEvidenceV1,
  ValidateWorktreeGcRecordEnvelopeV1,
  WorktreeGcPhase1ContractError,
} from './worktree-gc-phase1-inventory-artifact.mjs'

const INPUT_KEYS = [
  'schema_version', 'task_id', 'repository', 'authority_main_sha', 'repository_root',
  'observed_at', 'authority_refs', 'expected_common_git_id',
]
const PORT_SPECS = Object.freeze({
  read_repository_identity: ['ReadRepositoryIdentityResultV1', 'repository_identity_unavailable'],
  read_worktree_porcelain_z: ['ReadWorktreePorcelainZResultV1', 'porcelain_observation_unavailable'],
  read_path_identity_no_follow: ['ReadPathIdentityNoFollowResultV1', 'path_identity_unavailable'],
  read_head_and_registration: ['ReadHeadAndRegistrationResultV1', 'repository_state_unavailable'],
  read_working_tree_state: ['ReadWorkingTreeStateResultV1', 'repository_state_unavailable'],
  read_history_state: ['ReadHistoryStateResultV1', 'repository_state_unavailable'],
  read_task_pr_state: ['ReadTaskPrStateResultV1', 'repository_state_unavailable'],
  read_activity_lock_state: ['ReadActivityLockStateResultV1', 'repository_state_unavailable'],
  read_explicit_keep_authority: ['ReadExplicitKeepAuthorityResultV1', 'authority_evidence_unavailable'],
  read_merge_and_inactivity_evidence: ['ReadMergeAndInactivityEvidenceResultV1', 'authority_evidence_unavailable'],
  read_capacity_no_follow: ['ReadCapacityNoFollowResultV1', 'repository_state_unavailable'],
})
const PORT_OPERATIONS = Object.keys(PORT_SPECS)
const SHA256 = /^sha256:[0-9a-f]{64}$/
const SHA40 = /^[0-9a-f]{40}$/
const RFC3339_SECONDS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/
const ENTRY_KEY = /^worktree:[0-9a-f]{64}$/
const REPOSITORY_ROOT = 'https://github.com/whatrune/sd-prompt-studio'

class CollectionBlocked extends Error {
  constructor(failureCode, safeDiagnosticCode, path = null) {
    super(failureCode)
    this.failureCode = failureCode
    this.safeDiagnosticCode = safeDiagnosticCode
    this.path = path
  }
}

const blocked = (failureCode, path = null) => {
  throw new CollectionBlocked(failureCode, `wgc_phase1_${failureCode}`, path)
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function closed(value, keys, path, failureCode) {
  if (!isObject(value)) blocked(failureCode, path)
  const extras = Object.keys(value).filter(key => !keys.includes(key))
  if (extras.length) blocked(failureCode, `${path}/${extras[0]}`)
  const missing = keys.filter(key => !Object.hasOwn(value, key))
  if (missing.length) blocked(failureCode, `${path}/${missing[0]}`)
}

function valueDigest(value) {
  return DigestWorktreeGcPhase1InventoryArtifactV1(CanonicalizeWorktreeGcPhase1JcsUtf8V1(value))
}

function deepCloneFreeze(value) {
  const clone = structuredClone(value)
  const freeze = current => {
    if (current === null || typeof current !== 'object' || ArrayBuffer.isView(current)) return current
    for (const child of Object.values(current)) freeze(child)
    return Object.freeze(current)
  }
  return freeze(clone)
}

function directAuthorityUrl(value) {
  return typeof value === 'string' &&
    /^https:\/\/github\.com\/whatrune\/sd-prompt-studio\/issues\/[1-9][0-9]*(?:#issuecomment-[1-9][0-9]*)?$/.test(value)
}

function isNormalizedAbsoluteWindowsPath(value) {
  if (typeof value !== 'string' || value.length === 0 || value !== value.normalize('NFC') || value.includes('/') || value.includes('\0')) return false
  let segments
  if (/^[A-Z]:\\/.test(value)) {
    const tail = value.slice(3)
    if (tail.length === 0) return true
    if (tail.endsWith('\\')) return false
    segments = tail.split('\\')
  } else if (value.startsWith('\\\\')) {
    if (value.endsWith('\\')) return false
    segments = value.slice(2).split('\\')
    if (segments.length < 2) return false
  } else {
    return false
  }
  return segments.every(segment => segment.length > 0 && segment !== '.' && segment !== '..')
}

function validateInput(input) {
  if (!isObject(input)) blocked('input_invalid', '/')
  const extras = Object.keys(input).filter(key => !INPUT_KEYS.includes(key))
  if (extras.length) blocked('input_invalid', `/${extras[0]}`)
  const missing = INPUT_KEYS.filter(key => !Object.hasOwn(input, key))
  if (missing.length) blocked('input_invalid', `/${missing[0]}`)
  if (input.schema_version !== 'WorktreeGcPhase1CollectionInputV1' ||
      input.task_id !== 'DESIGN-WORKTREE-GC-V1-PHASE1-READ-ONLY-INVENTORY-001' ||
      input.repository !== 'whatrune/sd-prompt-studio' || !SHA40.test(input.authority_main_sha) ||
      !isNormalizedAbsoluteWindowsPath(input.repository_root) || !RFC3339_SECONDS.test(input.observed_at) ||
      !SHA256.test(input.expected_common_git_id) || !Array.isArray(input.authority_refs)) blocked('input_invalid', '/')
  if (input.authority_refs.some(ref => !directAuthorityUrl(ref))) blocked('input_invalid', '/authority_refs')
  const sorted = [...input.authority_refs].sort((left, right) => Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8')))
  if (new Set(input.authority_refs).size !== input.authority_refs.length || JSON.stringify(sorted) !== JSON.stringify(input.authority_refs)) blocked('input_invalid', '/authority_refs')
}

function validatePort(port) {
  if (!isObject(port)) blocked('input_invalid', '/readOnlyPort')
  const extras = Object.keys(port).filter(key => !PORT_OPERATIONS.includes(key))
  if (extras.length) blocked('input_invalid', `/readOnlyPort/${extras[0]}`)
  const missing = PORT_OPERATIONS.filter(key => typeof port[key] !== 'function')
  if (missing.length) blocked('input_invalid', `/readOnlyPort/${missing[0]}`)
}

function validateRepositoryIdentity(identity, input, failureCode, path) {
  closed(identity, ['repository', 'owner', 'name', 'authority_main_sha', 'common_git_dir_identity', 'remote_identity'], path, failureCode)
  if (identity.repository !== REPOSITORY_ROOT || identity.owner !== 'whatrune' || identity.name !== 'sd-prompt-studio' ||
      identity.remote_identity !== REPOSITORY_ROOT || !SHA40.test(identity.authority_main_sha) ||
      !SHA256.test(identity.common_git_dir_identity)) blocked(failureCode, path)
}

function reference(record) {
  return {
    record_type: record.record_type,
    record_id: record.record_id,
    record_digest: record.record_digest,
    authority_url: record.authority_url,
  }
}

function sameReference(left, right) {
  return left?.record_type === right.record_type && left?.record_id === right.record_id &&
    left?.record_digest === right.record_digest && left?.authority_url === right.authority_url
}

function validateRoster(roster, observationRecord, failureCode, path) {
  if (!Array.isArray(roster)) blocked(failureCode, path)
  let prior = null
  for (let index = 0; index < roster.length; index += 1) {
    const entry = roster[index]
    closed(entry, ['entry_key', 'registered_path_sha256', 'registration_admin_id'], `${path}/${index}`, failureCode)
    if (!ENTRY_KEY.test(entry.entry_key) || !SHA256.test(entry.registered_path_sha256) || !SHA256.test(entry.registration_admin_id)) blocked(failureCode, `${path}/${index}`)
    const expected = `worktree:${valueDigest({
      observation_record_id: observationRecord.record_id,
      registered_path_sha256: entry.registered_path_sha256,
      registration_admin_id: entry.registration_admin_id,
    }).slice(7)}`
    if (entry.entry_key !== expected || (prior !== null && Buffer.compare(Buffer.from(prior), Buffer.from(entry.entry_key)) >= 0)) blocked(failureCode, `${path}/${index}`)
    prior = entry.entry_key
  }
}

const ITEM_FIELDS = Object.freeze({
  read_path_identity_no_follow: ['entry_key', 'path_identity', 'is_primary_repository', 'item_digest'],
  read_head_and_registration: ['entry_key', 'head_binding', 'registration_state', 'item_digest'],
  read_working_tree_state: ['entry_key', 'working_tree_state', 'item_digest'],
  read_history_state: ['entry_key', 'history_state', 'item_digest'],
  read_task_pr_state: ['entry_key', 'task_pr_state', 'item_digest'],
  read_activity_lock_state: ['entry_key', 'activity_lock_state', 'item_digest'],
  read_explicit_keep_authority: ['entry_key', 'explicit_keep_authority_refs', 'item_digest'],
  read_merge_and_inactivity_evidence: ['entry_key', 'merge_evidence', 'inactivity_evidence', 'item_digest'],
  read_capacity_no_follow: ['entry_key', 'capacity_estimate_record', 'item_digest'],
})

function sortedSet(values, validate, failureCode, path) {
  if (!Array.isArray(values)) blocked(failureCode, path)
  let prior = null
  values.forEach((value, index) => {
    if (!validate(value)) blocked(failureCode, `${path}/${index}`)
    if (prior !== null && Buffer.compare(Buffer.from(prior), Buffer.from(value)) >= 0) blocked(failureCode, `${path}/${index}`)
    prior = value
  })
}

function validateRecordRefShape(value, expectedType, failureCode, path) {
  closed(value, ['record_type', 'record_id', 'record_digest', 'authority_url'], path, failureCode)
  if (value.record_type !== expectedType || !SHA256.test(value.record_digest) ||
      value.record_id !== `${expectedType}:${value.record_digest.slice(7)}` || !directAuthorityUrl(value.authority_url)) blocked(failureCode, path)
}

function validatePathIdentity(value, failureCode, path) {
  if (!isObject(value)) blocked(failureCode, path)
  if (value.identity_kind === 'existing_handle_identity') {
    closed(value, ['identity_kind', 'canonical_path', 'registered_path_sha256', 'final_path_sha256', 'volume_serial_hex', 'file_id_128_hex', 'common_git_dir_identity', 'registration_admin_id', 'reparse_state', 'filesystem_state'], path, failureCode)
    if (!isNormalizedAbsoluteWindowsPath(value.canonical_path) || !SHA256.test(value.registered_path_sha256) ||
        !SHA256.test(value.final_path_sha256) || !/^[0-9a-f]+$/.test(value.volume_serial_hex) ||
        !/^[0-9a-f]{32}$/.test(value.file_id_128_hex) || !SHA256.test(value.common_git_dir_identity) ||
        !SHA256.test(value.registration_admin_id) || value.reparse_state !== 'none' || value.filesystem_state !== 'present') blocked(failureCode, path)
    return
  }
  if (value.identity_kind === 'absent_registration_identity') {
    closed(value, ['identity_kind', 'canonical_path', 'registered_path_sha256', 'common_git_dir_identity', 'registration_admin_id', 'reparse_state', 'filesystem_state'], path, failureCode)
    if (!isNormalizedAbsoluteWindowsPath(value.canonical_path) || !SHA256.test(value.registered_path_sha256) ||
        !SHA256.test(value.common_git_dir_identity) || !SHA256.test(value.registration_admin_id) ||
        value.reparse_state !== 'not_observable_absent' || value.filesystem_state !== 'absent') blocked(failureCode, path)
    return
  }
  blocked(failureCode, `${path}/identity_kind`)
}

function validateItemFields(operation, value, failureCode, path) {
  if (operation === 'read_path_identity_no_follow') {
    validatePathIdentity(value.path_identity, failureCode, `${path}/path_identity`)
    if (typeof value.is_primary_repository !== 'boolean') blocked(failureCode, `${path}/is_primary_repository`)
  } else if (operation === 'read_head_and_registration') {
    closed(value.head_binding, ['head_sha', 'ref_kind', 'ref_name'], `${path}/head_binding`, failureCode)
    if (!SHA40.test(value.head_binding.head_sha) || !['branch', 'detached'].includes(value.head_binding.ref_kind) ||
        !(value.head_binding.ref_name === null || typeof value.head_binding.ref_name === 'string')) blocked(failureCode, `${path}/head_binding`)
    closed(value.registration_state, ['state', 'porcelain_entry_sha256', 'admin_state'], `${path}/registration_state`, failureCode)
    if (!['registered', 'stale_registration'].includes(value.registration_state.state) ||
        !SHA256.test(value.registration_state.porcelain_entry_sha256) ||
        !['present', 'unreadable', 'missing'].includes(value.registration_state.admin_state)) blocked(failureCode, `${path}/registration_state`)
  } else if (operation === 'read_working_tree_state') {
    closed(value.working_tree_state, ['staged', 'unstaged', 'untracked', 'ignored', 'submodule'], `${path}/working_tree_state`, failureCode)
    if (Object.values(value.working_tree_state).some(state => !['clean', 'present', 'unknown'].includes(state))) blocked(failureCode, `${path}/working_tree_state`)
  } else if (operation === 'read_history_state') {
    closed(value.history_state, ['upstream', 'ahead_count', 'behind_count', 'reachable_remote_ref_sha256s', 'unpushed_state'], `${path}/history_state`, failureCode)
    if (!['present', 'missing', 'unknown'].includes(value.history_state.upstream) ||
        !(value.history_state.ahead_count === null || Number.isInteger(value.history_state.ahead_count)) ||
        !(value.history_state.behind_count === null || Number.isInteger(value.history_state.behind_count)) ||
        !['none', 'present', 'unknown'].includes(value.history_state.unpushed_state)) blocked(failureCode, `${path}/history_state`)
    sortedSet(value.history_state.reachable_remote_ref_sha256s, itemValue => SHA256.test(itemValue), failureCode, `${path}/history_state/reachable_remote_ref_sha256s`)
  } else if (operation === 'read_task_pr_state') {
    closed(value.task_pr_state, ['task_state', 'pr_state', 'authority_urls'], `${path}/task_pr_state`, failureCode)
    if (!['none', 'open', 'unresolved', 'unknown'].includes(value.task_pr_state.task_state) ||
        !['none', 'open', 'unresolved', 'unknown'].includes(value.task_pr_state.pr_state)) blocked(failureCode, `${path}/task_pr_state`)
    sortedSet(value.task_pr_state.authority_urls, directAuthorityUrl, failureCode, `${path}/task_pr_state/authority_urls`)
  } else if (operation === 'read_activity_lock_state') {
    closed(value.activity_lock_state, ['git_lock', 'process_or_handle', 'evidence_refs'], `${path}/activity_lock_state`, failureCode)
    if (!['absent', 'present', 'unknown'].includes(value.activity_lock_state.git_lock) ||
        !['absent', 'present', 'unknown'].includes(value.activity_lock_state.process_or_handle)) blocked(failureCode, `${path}/activity_lock_state`)
    sortedSet(value.activity_lock_state.evidence_refs, directAuthorityUrl, failureCode, `${path}/activity_lock_state/evidence_refs`)
  } else if (operation === 'read_explicit_keep_authority') {
    if (!Array.isArray(value.explicit_keep_authority_refs)) blocked(failureCode, `${path}/explicit_keep_authority_refs`)
    let prior = null
    value.explicit_keep_authority_refs.forEach((referenceValue, index) => {
      validateRecordRefShape(referenceValue, 'explicit_keep_authority', failureCode, `${path}/explicit_keep_authority_refs/${index}`)
      if (prior !== null && Buffer.compare(Buffer.from(prior), Buffer.from(referenceValue.record_id)) >= 0) blocked(failureCode, `${path}/explicit_keep_authority_refs/${index}`)
      prior = referenceValue.record_id
    })
  } else if (operation === 'read_merge_and_inactivity_evidence') {
    closed(value.merge_evidence, ['kind', 'authority_url', 'admitted_main_sha'], `${path}/merge_evidence`, failureCode)
    if (!['exact_head_ancestor_of_admitted_main', 'merged_pr_exact_head', 'ambiguous', 'none'].includes(value.merge_evidence.kind) ||
        !(value.merge_evidence.authority_url === null || directAuthorityUrl(value.merge_evidence.authority_url)) ||
        !SHA40.test(value.merge_evidence.admitted_main_sha)) blocked(failureCode, `${path}/merge_evidence`)
    closed(value.inactivity_evidence, ['policy_ref', 'threshold_seconds', 'last_activity_at', 'state'], `${path}/inactivity_evidence`, failureCode)
    if (!(value.inactivity_evidence.policy_ref === null || directAuthorityUrl(value.inactivity_evidence.policy_ref)) ||
        !(value.inactivity_evidence.threshold_seconds === null || /^(?:0|[1-9][0-9]*)$/.test(value.inactivity_evidence.threshold_seconds)) ||
        !(value.inactivity_evidence.last_activity_at === null || RFC3339_SECONDS.test(value.inactivity_evidence.last_activity_at)) ||
        !['satisfied', 'not_satisfied', 'unknown'].includes(value.inactivity_evidence.state)) blocked(failureCode, `${path}/inactivity_evidence`)
  }
}

function validateItems(operation, items, roster, failureCode, path) {
  if (!Array.isArray(items) || items.length !== roster.length) blocked(failureCode, path)
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]
    closed(item, ITEM_FIELDS[operation], `${path}/${index}`, failureCode)
    if (item.entry_key !== roster[index].entry_key || !SHA256.test(item.item_digest)) blocked(failureCode, `${path}/${index}`)
    const projection = { ...item }
    delete projection.item_digest
    if (valueDigest(projection) !== item.item_digest) blocked(failureCode, `${path}/${index}/item_digest`)
    validateItemFields(operation, item, failureCode, `${path}/${index}`)
  }
}

function validatePayload(operation, payload, context, failureCode) {
  const path = `/readOnlyPort/${operation}/payload`
  if (operation === 'read_repository_identity') {
    closed(payload, ['repository_identity'], path, failureCode)
    validateRepositoryIdentity(payload.repository_identity, context.input, failureCode, `${path}/repository_identity`)
    return
  }
  if (operation === 'read_worktree_porcelain_z') {
    closed(payload, ['observation_record', 'entry_roster'], path, failureCode)
    try { ValidateWorktreeGcRecordEnvelopeV1(payload.observation_record, 'worktree_observation', `${path}/observation_record`) } catch { blocked(failureCode, `${path}/observation_record`) }
    if (payload.observation_record.payload.authority_main_sha !== context.input.authority_main_sha ||
        payload.observation_record.payload.common_git_dir_identity_sha256 !== context.input.expected_common_git_id ||
        payload.observation_record.payload.observed_at !== context.input.observed_at) blocked(failureCode, `${path}/observation_record`)
    validateRoster(payload.entry_roster, payload.observation_record, failureCode, `${path}/entry_roster`)
    return
  }
  const extra = operation === 'read_explicit_keep_authority' ? ['keep_lifecycle_evidence_records'] : []
  closed(payload, ['observation_ref', 'items', ...extra], path, failureCode)
  if (!sameReference(payload.observation_ref, reference(context.observationRecord))) blocked(failureCode, `${path}/observation_ref`)
  validateItems(operation, payload.items, context.roster, failureCode, `${path}/items`)
  if (operation === 'read_explicit_keep_authority' && !Array.isArray(payload.keep_lifecycle_evidence_records)) blocked(failureCode, `${path}/keep_lifecycle_evidence_records`)
  if (operation === 'read_explicit_keep_authority') {
    let prior = null
    for (let index = 0; index < payload.keep_lifecycle_evidence_records.length; index += 1) {
      const evidence = payload.keep_lifecycle_evidence_records[index]
      try { ValidateWorktreeGcPhase1KeepLifecycleEvidenceV1(evidence, `${path}/keep_lifecycle_evidence_records/${index}`) } catch { blocked(failureCode, `${path}/keep_lifecycle_evidence_records/${index}`) }
      if (prior !== null && Buffer.compare(Buffer.from(prior), Buffer.from(evidence.keep_ref.record_id)) >= 0) blocked(failureCode, `${path}/keep_lifecycle_evidence_records/${index}`)
      prior = evidence.keep_ref.record_id
    }
  }
  if (operation === 'read_capacity_no_follow') {
    for (let index = 0; index < payload.items.length; index += 1) {
      try { ValidateWorktreeGcRecordEnvelopeV1(payload.items[index].capacity_estimate_record, 'capacity_estimate', `${path}/items/${index}/capacity_estimate_record`) } catch { blocked(failureCode, `${path}/items/${index}/capacity_estimate_record`) }
    }
  }
}

async function readOperation(port, operation, immutableInput, context) {
  const [schemaVersion, failureCode] = PORT_SPECS[operation]
  let result
  try { result = await port[operation](immutableInput) } catch { blocked(failureCode, null) }
  const baseKeys = ['schema_version', 'operation', 'result', 'collection_input_digest', 'observed_at']
  if (isObject(result) && result.result === 'unavailable') {
    closed(result, [...baseKeys, 'failure_code', 'safe_diagnostic_code', 'failed_entry_key_or_null'], `/readOnlyPort/${operation}`, failureCode)
    if (result.schema_version !== 'ReadOnlyWorktreeObservationUnavailableV1' || result.operation !== operation ||
        result.collection_input_digest !== context.inputDigest || result.observed_at !== immutableInput.observed_at ||
        result.failure_code !== failureCode || result.safe_diagnostic_code !== `wgc_phase1_${failureCode}` ||
        (result.failed_entry_key_or_null !== null && !ENTRY_KEY.test(result.failed_entry_key_or_null))) blocked(failureCode, `/readOnlyPort/${operation}`)
    blocked(failureCode, result.failed_entry_key_or_null)
  }
  closed(result, [...baseKeys, 'payload', 'result_digest'], `/readOnlyPort/${operation}`, failureCode)
  if (result.schema_version !== schemaVersion || result.operation !== operation || result.result !== 'completed' ||
      result.collection_input_digest !== context.inputDigest || result.observed_at !== immutableInput.observed_at ||
      !SHA256.test(result.result_digest)) blocked(failureCode, `/readOnlyPort/${operation}`)
  const projection = { ...result }
  delete projection.result_digest
  if (valueDigest(projection) !== result.result_digest) blocked(failureCode, `/readOnlyPort/${operation}/result_digest`)
  validatePayload(operation, result.payload, context, failureCode)
  return deepCloneFreeze(result)
}

function mergeBinding(operation, result, item, mergedValue) {
  return {
    operation,
    source_result_digest: result.result_digest,
    source_item_digest_or_null: item?.item_digest ?? null,
    merged_value_digest: valueDigest(mergedValue),
  }
}

function buildProvenance(entryKeyValue, inventory, results, items) {
  const payload = inventory.payload
  const merged = {
    repository_identity: payload.repository_identity,
    observation_ref: payload.observation_ref,
    path_identity_and_primary: { path_identity: payload.path_identity, is_primary_repository: payload.is_primary_repository },
    head_and_registration: { head_binding: payload.head_binding, registration_state: payload.registration_state },
    working_tree_state: payload.working_tree_state,
    history_state: payload.history_state,
    task_pr_state: payload.task_pr_state,
    activity_lock_state: payload.activity_lock_state,
    explicit_keep_authority: { explicit_keep_authority_refs: payload.explicit_keep_authority_refs },
    merge_and_inactivity: { merge_evidence: payload.merge_evidence, inactivity_evidence: payload.inactivity_evidence },
    capacity_estimate_ref: payload.capacity_estimate_ref,
  }
  const fields = {
    schema_version: 'WorktreeInventoryProvenanceV1',
    entry_key: entryKeyValue,
    inventory_ref: reference(inventory),
    repository_identity: mergeBinding('read_repository_identity', results.read_repository_identity, null, merged.repository_identity),
    observation_ref: mergeBinding('read_worktree_porcelain_z', results.read_worktree_porcelain_z, null, merged.observation_ref),
    path_identity_and_primary: mergeBinding('read_path_identity_no_follow', results.read_path_identity_no_follow, items.read_path_identity_no_follow, merged.path_identity_and_primary),
    head_and_registration: mergeBinding('read_head_and_registration', results.read_head_and_registration, items.read_head_and_registration, merged.head_and_registration),
    working_tree_state: mergeBinding('read_working_tree_state', results.read_working_tree_state, items.read_working_tree_state, merged.working_tree_state),
    history_state: mergeBinding('read_history_state', results.read_history_state, items.read_history_state, merged.history_state),
    task_pr_state: mergeBinding('read_task_pr_state', results.read_task_pr_state, items.read_task_pr_state, merged.task_pr_state),
    activity_lock_state: mergeBinding('read_activity_lock_state', results.read_activity_lock_state, items.read_activity_lock_state, merged.activity_lock_state),
    explicit_keep_authority: mergeBinding('read_explicit_keep_authority', results.read_explicit_keep_authority, items.read_explicit_keep_authority, merged.explicit_keep_authority),
    merge_and_inactivity: mergeBinding('read_merge_and_inactivity_evidence', results.read_merge_and_inactivity_evidence, items.read_merge_and_inactivity_evidence, merged.merge_and_inactivity),
    capacity_estimate_ref: mergeBinding('read_capacity_no_follow', results.read_capacity_no_follow, items.read_capacity_no_follow, merged.capacity_estimate_ref),
  }
  return deepCloneFreeze({ ...fields, provenance_digest: valueDigest(fields) })
}

function blockedResult(error) {
  const known = error instanceof CollectionBlocked
  return Object.freeze({
    schema_version: 'CollectWorktreeGcPhase1InventoryResultV1', result: 'blocked',
    failure_code: known ? error.failureCode : 'unexpected_internal_failure',
    safe_diagnostic_code: known ? error.safeDiagnosticCode : 'wgc_phase1_unexpected_internal_failure',
    failed_json_pointer_or_null: known ? error.path : null, mutation_performed: false,
  })
}

export async function CollectWorktreeGcPhase1InventoryV1(input, readOnlyPort) {
  try {
    validateInput(input)
    validatePort(readOnlyPort)
    const immutableInput = deepCloneFreeze(input)
    const context = { input: immutableInput, inputDigest: valueDigest(immutableInput), observationRecord: null, roster: null }
    const results = {}
    results.read_repository_identity = await readOperation(readOnlyPort, 'read_repository_identity', immutableInput, context)
    const repositoryIdentity = results.read_repository_identity.payload.repository_identity
    if (repositoryIdentity.authority_main_sha !== immutableInput.authority_main_sha) blocked('authority_main_mismatch', '/authority_main_sha')
    if (repositoryIdentity.common_git_dir_identity !== immutableInput.expected_common_git_id) blocked('common_git_identity_mismatch', '/expected_common_git_id')
    results.read_worktree_porcelain_z = await readOperation(readOnlyPort, 'read_worktree_porcelain_z', immutableInput, context)
    context.observationRecord = results.read_worktree_porcelain_z.payload.observation_record
    context.roster = results.read_worktree_porcelain_z.payload.entry_roster
    for (const operation of PORT_OPERATIONS.slice(2)) {
      results[operation] = await readOperation(readOnlyPort, operation, immutableInput, context)
    }

    const capacities = results.read_capacity_no_follow.payload.items.map(item => item.capacity_estimate_record)
    const inventories = []
    const provenance = []
    for (let index = 0; index < context.roster.length; index += 1) {
      const items = Object.fromEntries(PORT_OPERATIONS.slice(2).map(operation => [operation, results[operation].payload.items[index]]))
      const payload = {
        schema_version: 'WorktreeInventoryPayloadV2',
        repository_identity: results.read_repository_identity.payload.repository_identity,
        observation_ref: reference(context.observationRecord),
        path_identity: items.read_path_identity_no_follow.path_identity,
        is_primary_repository: items.read_path_identity_no_follow.is_primary_repository,
        head_binding: items.read_head_and_registration.head_binding,
        registration_state: items.read_head_and_registration.registration_state,
        working_tree_state: items.read_working_tree_state.working_tree_state,
        history_state: items.read_history_state.history_state,
        task_pr_state: items.read_task_pr_state.task_pr_state,
        activity_lock_state: items.read_activity_lock_state.activity_lock_state,
        explicit_keep_authority_refs: items.read_explicit_keep_authority.explicit_keep_authority_refs,
        merge_evidence: items.read_merge_and_inactivity_evidence.merge_evidence,
        inactivity_evidence: items.read_merge_and_inactivity_evidence.inactivity_evidence,
        capacity_estimate_ref: reference(items.read_capacity_no_follow.capacity_estimate_record),
        inventory_evidence_digest: 'sha256:'.padEnd(71, '0'),
      }
      const projection = { ...payload }
      delete projection.inventory_evidence_digest
      payload.inventory_evidence_digest = valueDigest(projection)
      const inventory = BuildWorktreeGcRecordEnvelopeV1('worktree_inventory', context.observationRecord.authority_url, immutableInput.observed_at, payload)
      inventories.push(inventory)
      provenance.push(buildProvenance(context.roster[index].entry_key, inventory, results, items))
    }

    let artifactBytes
    try {
      artifactBytes = BuildWorktreeGcPhase1InventoryArtifactV1({
        authority_main_sha: immutableInput.authority_main_sha,
        observation_record: context.observationRecord,
        capacity_estimate_records: capacities,
        inventory_records: inventories,
        keep_lifecycle_evidence_records: results.read_explicit_keep_authority.payload.keep_lifecycle_evidence_records,
        inventory_provenance_records: provenance,
      })
    } catch (error) {
      if (error instanceof WorktreeGcPhase1ContractError) blocked('artifact_canonicalization_failed', error.path)
      throw error
    }

    return Object.freeze({
      schema_version: 'CollectWorktreeGcPhase1InventoryResultV1', result: 'completed',
      artifact_bytes_utf8: artifactBytes,
      artifact_digest: DigestWorktreeGcPhase1InventoryArtifactV1(artifactBytes),
      inventory_record_count: inventories.length, capacity_record_count: capacities.length,
      mutation_performed: false,
    })
  } catch (error) {
    return blockedResult(error)
  }
}
