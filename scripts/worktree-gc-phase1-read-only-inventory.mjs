import { CollectWorktreeGcPhase1InventoryV1 } from './worktree-gc-phase1-collector.mjs'
import { ClassifyWorktreeGcPhase1InventoryV1 } from './worktree-gc-phase1-classifier.mjs'

function blocked(failureCode, safeDiagnosticCode, path = null) {
  return Object.freeze({
    schema_version: 'RunWorktreeGcPhase1ReadOnlyInventoryResultV1',
    result: 'blocked',
    failure_code: failureCode,
    safe_diagnostic_code: safeDiagnosticCode,
    failed_json_pointer_or_null: path,
    mutation_performed: false,
  })
}

export async function RunWorktreeGcPhase1ReadOnlyInventoryV1(input, ports) {
  if (ports === null || typeof ports !== 'object' || Array.isArray(ports) ||
      JSON.stringify(Object.keys(ports)) !== JSON.stringify(['readOnlyPort'])) {
    return blocked('input_invalid', 'wgc_phase1_input_invalid', '/ports')
  }

  const collection = await CollectWorktreeGcPhase1InventoryV1(input, ports.readOnlyPort)
  if (collection.result === 'blocked') return collection

  const classification = ClassifyWorktreeGcPhase1InventoryV1({
    schema_version: 'WorktreeGcPhase1ClassificationInputV1',
    artifact_bytes_utf8: collection.artifact_bytes_utf8,
    artifact_digest: collection.artifact_digest,
    evaluated_at: input.observed_at,
    classification_rule_version: 'worktree-classification-rules-v2',
  })
  if (classification.result === 'rejected') {
    return blocked(classification.failure_code, classification.safe_diagnostic_code, classification.failed_json_pointer_or_null)
  }

  return Object.freeze({
    schema_version: 'RunWorktreeGcPhase1ReadOnlyInventoryResultV1',
    result: 'completed',
    artifact_bytes_utf8: collection.artifact_bytes_utf8,
    artifact_digest: collection.artifact_digest,
    inventory_record_count: collection.inventory_record_count,
    capacity_record_count: collection.capacity_record_count,
    classification_result: classification,
    mutation_performed: false,
  })
}
