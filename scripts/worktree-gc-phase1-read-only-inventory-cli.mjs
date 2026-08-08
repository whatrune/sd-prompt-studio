import { pathToFileURL } from 'node:url'
import { RunWorktreeGcPhase1ReadOnlyInventoryV1 } from './worktree-gc-phase1-read-only-inventory.mjs'

const HOST_KEYS = ['emitArtifactBytes', 'emitSafeDiagnostic', 'parseInput', 'readOnlyPort']
const READ_OPERATIONS = [
  'read_repository_identity', 'read_worktree_porcelain_z', 'read_path_identity_no_follow',
  'read_head_and_registration', 'read_working_tree_state', 'read_history_state',
  'read_task_pr_state', 'read_activity_lock_state', 'read_explicit_keep_authority',
  'read_merge_and_inactivity_evidence', 'read_capacity_no_follow',
]

function safeBlocked(code, path = null) {
  return Object.freeze({
    schema_version: 'RunWorktreeGcPhase1ReadOnlyInventoryResultV1',
    result: 'blocked',
    failure_code: 'input_invalid',
    safe_diagnostic_code: code,
    failed_json_pointer_or_null: path,
    mutation_performed: false,
  })
}

function validateHost(host) {
  if (host === null || typeof host !== 'object' || Array.isArray(host)) return false
  if (JSON.stringify(Object.keys(host).sort()) !== JSON.stringify([...HOST_KEYS].sort())) return false
  return typeof host.parseInput === 'function' && typeof host.emitArtifactBytes === 'function' &&
    typeof host.emitSafeDiagnostic === 'function' && host.readOnlyPort !== null &&
    typeof host.readOnlyPort === 'object'
}

export async function EmitWorktreeGcPhase1InventoryArtifactV1(result, host) {
  if (!validateHost(host)) return safeBlocked('wgc_phase1_host_invalid', '/host')
  if (result.result === 'completed') {
    await host.emitArtifactBytes(result.artifact_bytes_utf8)
    await host.emitSafeDiagnostic(Object.freeze({
      code: 'wgc_phase1_completed', artifact_digest: result.artifact_digest,
      mutation_performed: false, canonical_authority: 'result_handoff_required',
    }))
    return result
  }
  await host.emitSafeDiagnostic(Object.freeze({
    code: result.safe_diagnostic_code,
    failed_json_pointer_or_null: result.failed_json_pointer_or_null,
    mutation_performed: false,
    artifact_emitted: false,
  }))
  return result
}

export async function MainWorktreeGcPhase1ReadOnlyInventoryCliV1(argv, host) {
  if (!Array.isArray(argv) || argv.some(value => typeof value !== 'string') || !validateHost(host)) {
    const result = safeBlocked('wgc_phase1_cli_input_invalid', '/argv')
    if (validateHost(host)) await host.emitSafeDiagnostic(Object.freeze({ code: result.safe_diagnostic_code, mutation_performed: false, artifact_emitted: false }))
    return result
  }
  let input
  try {
    input = await host.parseInput(Object.freeze([...argv]))
  } catch {
    const result = safeBlocked('wgc_phase1_cli_input_invalid', '/argv')
    await host.emitSafeDiagnostic(Object.freeze({ code: result.safe_diagnostic_code, mutation_performed: false, artifact_emitted: false }))
    return result
  }
  const result = await RunWorktreeGcPhase1ReadOnlyInventoryV1(input, { readOnlyPort: host.readOnlyPort })
  return EmitWorktreeGcPhase1InventoryArtifactV1(result, host)
}

export async function InvokeWorktreeGcPhase1ReadOnlyInventoryCliV1(argv, host) {
  return MainWorktreeGcPhase1ReadOnlyInventoryCliV1(argv, host)
}

function createFailClosedLocalHost() {
  const readOnlyPort = Object.fromEntries(READ_OPERATIONS.map(operation => [operation, async () => {
    throw new Error('read_only_adapter_not_bound')
  }]))
  return {
    emitArtifactBytes: async bytes => { process.stdout.write(bytes) },
    emitSafeDiagnostic: async diagnostic => { process.stderr.write(`${JSON.stringify(diagnostic)}\n`) },
    parseInput: async argv => {
      if (argv.length !== 2 || argv[0] !== '--input-json') throw new Error('invalid_arguments')
      return JSON.parse(argv[1])
    },
    readOnlyPort,
  }
}

const isDirect = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirect) {
  const result = await InvokeWorktreeGcPhase1ReadOnlyInventoryCliV1(process.argv.slice(2), createFailClosedLocalHost())
  process.exitCode = result.result === 'completed' ? 0 : 1
}
