import {
  BuildWorktreeGcRecordEnvelopeV1,
  CanonicalizeWorktreeGcPhase1JcsUtf8V1,
  DigestWorktreeGcPhase1InventoryArtifactV1,
  ParseWorktreeGcPhase1InventoryArtifactV1,
  WorktreeGcPhase1ContractError,
} from './worktree-gc-phase1-inventory-artifact.mjs'

const INPUT_KEYS = ['schema_version', 'artifact_bytes_utf8', 'artifact_digest', 'evaluated_at', 'classification_rule_version']
const SHA256 = /^sha256:[0-9a-f]{64}$/
const RFC3339_SECONDS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/

function compareUtf8(left, right) {
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'))
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort(compareUtf8)
}

function validateInput(input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) throw new WorktreeGcPhase1ContractError('structural_invalid', '/')
  const extras = Object.keys(input).filter(key => !INPUT_KEYS.includes(key))
  if (extras.length) throw new WorktreeGcPhase1ContractError('unknown_field', `/${extras[0]}`)
  const missing = INPUT_KEYS.filter(key => !Object.hasOwn(input, key))
  if (missing.length) throw new WorktreeGcPhase1ContractError('missing_field', `/${missing[0]}`)
  if (input.schema_version !== 'WorktreeGcPhase1ClassificationInputV1' ||
      !(input.artifact_bytes_utf8 instanceof Uint8Array) ||
      typeof input.artifact_digest !== 'string' || !SHA256.test(input.artifact_digest) ||
      typeof input.evaluated_at !== 'string' || !RFC3339_SECONDS.test(input.evaluated_at) ||
      input.classification_rule_version !== 'worktree-classification-rules-v2') {
    throw new WorktreeGcPhase1ContractError('structural_invalid', '/')
  }
}

function hasUnknown(payload) {
  return Object.values(payload.working_tree_state).includes('unknown') ||
    payload.history_state.upstream === 'unknown' || payload.history_state.unpushed_state === 'unknown' ||
    payload.task_pr_state.task_state === 'unknown' || payload.task_pr_state.pr_state === 'unknown' ||
    payload.activity_lock_state.git_lock === 'unknown' || payload.activity_lock_state.process_or_handle === 'unknown' ||
    payload.inactivity_evidence.state === 'unknown' ||
    payload.merge_evidence.admitted_main_sha !== payload.repository_identity.authority_main_sha
}

function classificationFor(payload) {
  if (payload.is_primary_repository) return ['protected_primary_repository', []]
  if (payload.explicit_keep_authority_refs.length > 0) {
    return ['protected_explicit_keep', payload.explicit_keep_authority_refs.length > 1 ? ['keep_authority_conflict'] : []]
  }
  if (hasUnknown(payload)) return ['blocked_unknown', ['authority_drift']]
  if (payload.path_identity.common_git_dir_identity !== payload.repository_identity.common_git_dir_identity) return ['blocked_path_identity', ['path_identity_mismatch']]
  if (payload.registration_state.admin_state !== 'present') return ['blocked_inaccessible_or_linked', ['linked_or_unreadable']]
  if (payload.activity_lock_state.git_lock === 'present' || payload.activity_lock_state.process_or_handle === 'present') return ['blocked_active_or_locked', ['active_or_locked']]
  if (Object.values(payload.working_tree_state).includes('present')) return ['blocked_dirty_or_evidence_present', ['dirty_or_evidence_present']]
  if (payload.history_state.upstream !== 'present' || payload.history_state.unpushed_state !== 'none') return ['blocked_unpushed_or_unbound_history', ['unpushed_or_unbound_history']]
  if (payload.task_pr_state.task_state !== 'none' || payload.task_pr_state.pr_state !== 'none') return ['blocked_open_task_or_pr', ['open_task_or_pr']]
  if (!['exact_head_ancestor_of_admitted_main', 'merged_pr_exact_head'].includes(payload.merge_evidence.kind)) return ['blocked_merge_ambiguous', ['merge_ambiguous']]
  if (payload.path_identity.identity_kind === 'existing_handle_identity' && payload.inactivity_evidence.state === 'satisfied') return ['eligible_clean_merged_inactive_candidate', []]
  if (payload.path_identity.identity_kind === 'absent_registration_identity' && payload.registration_state.state === 'stale_registration' && payload.registration_state.admin_state === 'present') return ['eligible_stale_registration_candidate', []]
  return ['not_candidate', []]
}

function evidenceRefs(inventory) {
  const payload = inventory.payload
  return uniqueSorted([
    inventory.authority_url,
    ...payload.explicit_keep_authority_refs.map(ref => ref.authority_url),
    ...payload.task_pr_state.authority_urls,
    ...payload.activity_lock_state.evidence_refs,
    payload.merge_evidence.authority_url,
    payload.inactivity_evidence.policy_ref,
  ])
}

function mapFailure(error) {
  if (!(error instanceof WorktreeGcPhase1ContractError)) return 'classification_internal_failure'
  const admitted = [
    'structural_invalid', 'unknown_field', 'missing_field', 'duplicate_identity', 'unsupported_schema',
    'artifact_digest_mismatch', 'authority_binding_mismatch', 'inventory_reference_mismatch',
  ]
  return admitted.includes(error.code) ? error.code : 'classification_internal_failure'
}

export function ClassifyWorktreeGcPhase1InventoryV1(input) {
  let inputDigest = null
  try {
    validateInput(input)
    inputDigest = input.artifact_digest
    const actualDigest = DigestWorktreeGcPhase1InventoryArtifactV1(input.artifact_bytes_utf8)
    if (actualDigest !== input.artifact_digest) throw new WorktreeGcPhase1ContractError('artifact_digest_mismatch', '/artifact_digest')
    const artifact = ParseWorktreeGcPhase1InventoryArtifactV1(input.artifact_bytes_utf8)
    const classificationRecords = artifact.inventory_records.map(inventory => {
      const [classification, reasons] = classificationFor(inventory.payload)
      const payload = Object.freeze({
        schema_version: 'WorktreeClassificationPayloadV2',
        inventory_ref: Object.freeze({
          record_type: 'worktree_inventory', record_id: inventory.record_id,
          record_digest: inventory.record_digest, authority_url: inventory.authority_url,
        }),
        inventory_evidence_digest: inventory.payload.inventory_evidence_digest,
        classification_rule_version: 'worktree-classification-rules-v2',
        classification,
        blocking_reason_codes: uniqueSorted(reasons),
        evidence_refs: evidenceRefs(inventory),
        evaluated_at: input.evaluated_at,
      })
      return BuildWorktreeGcRecordEnvelopeV1('worktree_classification', inventory.authority_url, input.evaluated_at, payload)
    }).sort((left, right) => compareUtf8(left.payload.inventory_ref.record_id, right.payload.inventory_ref.record_id))
    const evaluationDigest = DigestWorktreeGcPhase1InventoryArtifactV1(CanonicalizeWorktreeGcPhase1JcsUtf8V1(classificationRecords))
    return Object.freeze({
      schema_version: 'ClassifyWorktreeGcPhase1InventoryResultV1',
      result: 'classified',
      input_artifact_digest: input.artifact_digest,
      classification_records: Object.freeze(classificationRecords),
      evaluation_digest: evaluationDigest,
    })
  } catch (error) {
    const failureCode = mapFailure(error)
    return Object.freeze({
      schema_version: 'ClassifyWorktreeGcPhase1InventoryResultV1',
      result: 'rejected',
      input_artifact_digest_or_null: inputDigest,
      failure_code: failureCode,
      safe_diagnostic_code: `wgc_phase1_${failureCode}`,
      failed_json_pointer_or_null: error instanceof WorktreeGcPhase1ContractError ? error.path : null,
    })
  }
}
