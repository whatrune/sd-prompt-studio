import {
  BuildWorktreeGcPhase1InventoryArtifactV1,
  DigestWorktreeGcPhase1InventoryArtifactV1,
  WorktreeGcPhase1ContractError,
} from './worktree-gc-phase1-inventory-artifact.mjs'

const INPUT_KEYS = [
  'schema_version', 'task_id', 'repository', 'authority_main_sha', 'repository_root',
  'observed_at', 'authority_refs', 'expected_common_git_id',
]
const PORT_OPERATIONS = [
  'read_repository_identity',
  'read_worktree_porcelain_z',
  'read_path_identity_no_follow',
  'read_head_and_registration',
  'read_working_tree_state',
  'read_history_state',
  'read_task_pr_state',
  'read_activity_lock_state',
  'read_explicit_keep_authority',
  'read_merge_and_inactivity_evidence',
  'read_capacity_no_follow',
]
const SHA256 = /^sha256:[0-9a-f]{64}$/
const SHA40 = /^[0-9a-f]{40}$/
const RFC3339_SECONDS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/

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
  if (input === null || typeof input !== 'object' || Array.isArray(input)) blocked('input_invalid', '/')
  const extras = Object.keys(input).filter(key => !INPUT_KEYS.includes(key))
  if (extras.length) blocked('input_invalid', `/${extras[0]}`)
  const missing = INPUT_KEYS.filter(key => !Object.hasOwn(input, key))
  if (missing.length) blocked('input_invalid', `/${missing[0]}`)
  if (input.schema_version !== 'WorktreeGcPhase1CollectionInputV1' ||
      input.task_id !== 'DESIGN-WORKTREE-GC-V1-PHASE1-READ-ONLY-INVENTORY-001' ||
      input.repository !== 'whatrune/sd-prompt-studio' ||
      !SHA40.test(input.authority_main_sha) ||
      !isNormalizedAbsoluteWindowsPath(input.repository_root) ||
      !RFC3339_SECONDS.test(input.observed_at) ||
      !SHA256.test(input.expected_common_git_id) ||
      !Array.isArray(input.authority_refs)) blocked('input_invalid', '/')
  for (const ref of input.authority_refs) {
    if (typeof ref !== 'string' || ref !== ref.normalize('NFC')) blocked('input_invalid', '/authority_refs')
    try {
      const url = new URL(ref)
      if (url.protocol !== 'https:') blocked('input_invalid', '/authority_refs')
    } catch { blocked('input_invalid', '/authority_refs') }
  }
  const sorted = [...input.authority_refs].sort((left, right) => Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8')))
  if (new Set(input.authority_refs).size !== input.authority_refs.length || JSON.stringify(sorted) !== JSON.stringify(input.authority_refs)) blocked('input_invalid', '/authority_refs')
}

function validatePort(port) {
  if (port === null || typeof port !== 'object' || Array.isArray(port)) blocked('input_invalid', '/readOnlyPort')
  const keys = Object.keys(port)
  const extras = keys.filter(key => !PORT_OPERATIONS.includes(key))
  if (extras.length) blocked('input_invalid', `/readOnlyPort/${extras[0]}`)
  const missing = PORT_OPERATIONS.filter(key => typeof port[key] !== 'function')
  if (missing.length) blocked('input_invalid', `/readOnlyPort/${missing[0]}`)
}

async function invoke(port, operation, input, failureCode) {
  try {
    return await port[operation](input)
  } catch {
    blocked(failureCode, null)
  }
}

function completeMarker(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length === 1 && value.complete === true
}

function blockedResult(error) {
  const known = error instanceof CollectionBlocked
  return Object.freeze({
    schema_version: 'CollectWorktreeGcPhase1InventoryResultV1',
    result: 'blocked',
    failure_code: known ? error.failureCode : 'unexpected_internal_failure',
    safe_diagnostic_code: known ? error.safeDiagnosticCode : 'wgc_phase1_unexpected_internal_failure',
    failed_json_pointer_or_null: known ? error.path : null,
    mutation_performed: false,
  })
}

export async function CollectWorktreeGcPhase1InventoryV1(input, readOnlyPort) {
  try {
    validateInput(input)
    validatePort(readOnlyPort)
    const immutableInput = Object.freeze(structuredClone(input))

    const repositoryIdentity = await invoke(readOnlyPort, 'read_repository_identity', immutableInput, 'repository_identity_unavailable')
    if (repositoryIdentity?.repository !== input.repository || repositoryIdentity?.authority_main_sha !== input.authority_main_sha) blocked('authority_main_mismatch', '/authority_main_sha')
    if (repositoryIdentity?.common_git_dir_identity !== input.expected_common_git_id) blocked('common_git_identity_mismatch', '/expected_common_git_id')

    const porcelain = await invoke(readOnlyPort, 'read_worktree_porcelain_z', immutableInput, 'porcelain_observation_unavailable')
    const paths = await invoke(readOnlyPort, 'read_path_identity_no_follow', immutableInput, 'path_identity_unavailable')
    const stateOperations = [
      'read_head_and_registration', 'read_working_tree_state', 'read_history_state',
      'read_task_pr_state', 'read_activity_lock_state',
    ]
    for (const operation of stateOperations) {
      const value = await invoke(readOnlyPort, operation, immutableInput, 'repository_state_unavailable')
      if (!completeMarker(value)) blocked('repository_state_unavailable', null)
    }
    for (const operation of ['read_explicit_keep_authority', 'read_merge_and_inactivity_evidence']) {
      const value = await invoke(readOnlyPort, operation, immutableInput, 'authority_evidence_unavailable')
      if (!completeMarker(value)) blocked('authority_evidence_unavailable', null)
    }
    const capacity = await invoke(readOnlyPort, 'read_capacity_no_follow', immutableInput, 'repository_state_unavailable')

    if (!porcelain || Object.keys(porcelain).length !== 1 || !porcelain.observation_record ||
        !paths || Object.keys(paths).length !== 1 || !Array.isArray(paths.inventory_records) ||
        !capacity || Object.keys(capacity).length !== 1 || !Array.isArray(capacity.capacity_estimate_records)) {
      blocked('repository_state_unavailable', null)
    }

    let artifactBytes
    try {
      artifactBytes = BuildWorktreeGcPhase1InventoryArtifactV1({
        authority_main_sha: input.authority_main_sha,
        observation_record: porcelain.observation_record,
        capacity_estimate_records: capacity.capacity_estimate_records,
        inventory_records: paths.inventory_records,
      })
    } catch (error) {
      if (error instanceof WorktreeGcPhase1ContractError) blocked('artifact_canonicalization_failed', error.path)
      throw error
    }

    return Object.freeze({
      schema_version: 'CollectWorktreeGcPhase1InventoryResultV1',
      result: 'completed',
      artifact_bytes_utf8: artifactBytes,
      artifact_digest: DigestWorktreeGcPhase1InventoryArtifactV1(artifactBytes),
      inventory_record_count: paths.inventory_records.length,
      capacity_record_count: capacity.capacity_estimate_records.length,
      mutation_performed: false,
    })
  } catch (error) {
    return blockedResult(error)
  }
}
