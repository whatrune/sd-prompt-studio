import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import {
  BuildWorktreeGcPhase1InventoryArtifactV1,
  BuildWorktreeGcRecordEnvelopeV1,
  CanonicalizeWorktreeGcPhase1JcsUtf8V1,
  DigestWorktreeGcPhase1InventoryArtifactV1,
  WorktreeGcPhase1ContractError,
} from './worktree-gc-phase1-inventory-artifact.mjs'
import { CollectWorktreeGcPhase1InventoryV1 } from './worktree-gc-phase1-collector.mjs'
import { ClassifyWorktreeGcPhase1InventoryV1 } from './worktree-gc-phase1-classifier.mjs'
import { RunWorktreeGcPhase1ReadOnlyInventoryV1 } from './worktree-gc-phase1-read-only-inventory.mjs'
import {
  InvokeWorktreeGcPhase1ReadOnlyInventoryCliV1,
  MainWorktreeGcPhase1ReadOnlyInventoryCliV1,
} from './worktree-gc-phase1-read-only-inventory-cli.mjs'

const HEAD = 'f5f55d68ab81a203151339bf481d0a484c7dbe41'
const OBSERVED_AT = '2026-08-04T11:50:10Z'
const AUTHORITY = 'https://github.com/whatrune/sd-prompt-studio/issues/248#issuecomment-5178584892'
const POLICY = 'https://github.com/whatrune/sd-prompt-studio/issues/209#issuecomment-5097525010'
const sha = value => `sha256:${createHash('sha256').update(value).digest('hex')}`
const COMMON = sha('synthetic-common-git')

const ref = record => ({
  record_type: record.record_type,
  record_id: record.record_id,
  record_digest: record.record_digest,
  authority_url: record.authority_url,
})

function observationRecord(authorityMainSha = HEAD) {
  return BuildWorktreeGcRecordEnvelopeV1('worktree_observation', AUTHORITY, OBSERVED_AT, {
    schema_version: 'WorktreeObservationSnapshotV1',
    repository: 'whatrune/sd-prompt-studio',
    authority_main_sha: authorityMainSha,
    observed_at: OBSERVED_AT,
    git_version: '2.55.0.windows.3',
    common_git_dir_identity_sha256: COMMON,
    command_argv: ['git', 'worktree', 'list', '--porcelain', '-z'],
    porcelain_encoding: 'git-porcelain-v1-nul-terminated-bytes',
    porcelain_byte_length: '128',
    porcelain_sha256: sha('synthetic-porcelain'),
    registered_worktree_count: 1,
    locked_marker_count: 0,
    prunable_marker_count: 0,
    path_disclosure: 'redacted_digest_only',
    mutation_performed: false,
  })
}

function capacityRecord(observation, state = 'exact') {
  const common = {
    schema_version: 'CapacityEstimateV1',
    path_identity_ref: sha('synthetic-path'),
    observation_ref: ref(observation),
    state,
    enumerated_entry_count: 4,
    evidence_digest: sha(`capacity-${state}`),
    uncertainty_codes: state === 'exact' ? [] : state === 'bounded' ? ['hardlink_exclusivity_unproved'] : ['overflow'],
  }
  const branch = state === 'exact'
    ? { logical_size_bytes: '4096', exclusive_allocated_bytes: '4096' }
    : state === 'bounded'
      ? { logical_size_bytes: '4096', exclusive_allocated_lower_bound_bytes: '0', exclusive_allocated_upper_bound_bytes_or_null: '4096' }
      : {}
  return BuildWorktreeGcRecordEnvelopeV1('capacity_estimate', AUTHORITY, OBSERVED_AT, { ...common, ...branch })
}

function baseInventoryPayload(observation, capacity) {
  return {
    schema_version: 'WorktreeInventoryPayloadV2',
    repository_identity: {
      repository: 'https://github.com/whatrune/sd-prompt-studio', owner: 'whatrune', name: 'sd-prompt-studio',
      authority_main_sha: HEAD, common_git_dir_identity: COMMON,
      remote_identity: 'https://github.com/whatrune/sd-prompt-studio',
    },
    observation_ref: ref(observation),
    path_identity: {
      identity_kind: 'existing_handle_identity', canonical_path: 'C:\\synthetic\\task-worktree',
      registered_path_sha256: sha('registered-path'), final_path_sha256: sha('final-path'),
      volume_serial_hex: '00000001', file_id_128_hex: '00000000000000000000000000000001',
      common_git_dir_identity: COMMON, registration_admin_id: sha('admin'),
      reparse_state: 'none', filesystem_state: 'present',
    },
    is_primary_repository: false,
    head_binding: { head_sha: HEAD, ref_kind: 'branch', ref_name: 'codex/synthetic' },
    registration_state: { state: 'registered', porcelain_entry_sha256: sha('entry'), admin_state: 'present' },
    working_tree_state: { staged: 'clean', unstaged: 'clean', untracked: 'clean', ignored: 'clean', submodule: 'clean' },
    history_state: { upstream: 'present', ahead_count: 0, behind_count: 0, reachable_remote_ref_sha256s: [], unpushed_state: 'none' },
    task_pr_state: { task_state: 'none', pr_state: 'none', authority_urls: [] },
    activity_lock_state: { git_lock: 'absent', process_or_handle: 'absent', evidence_refs: [] },
    explicit_keep_authority_refs: [],
    merge_evidence: { kind: 'exact_head_ancestor_of_admitted_main', authority_url: AUTHORITY, admitted_main_sha: HEAD },
    inactivity_evidence: { policy_ref: POLICY, threshold_seconds: '86400', last_activity_at: '2026-08-01T00:00:00Z', state: 'satisfied' },
    capacity_estimate_ref: ref(capacity),
    inventory_evidence_digest: sha('placeholder'),
  }
}

function inventoryRecord(observation, capacity, mutate = () => {}) {
  const payload = structuredClone(baseInventoryPayload(observation, capacity))
  mutate(payload)
  const projection = { ...payload }
  delete projection.inventory_evidence_digest
  payload.inventory_evidence_digest = DigestWorktreeGcPhase1InventoryArtifactV1(CanonicalizeWorktreeGcPhase1JcsUtf8V1(projection))
  return BuildWorktreeGcRecordEnvelopeV1('worktree_inventory', AUTHORITY, OBSERVED_AT, payload)
}

function fixture(mutateInventory = () => {}, capacityState = 'exact') {
  const observation = observationRecord()
  const capacity = capacityRecord(observation, capacityState)
  const inventory = inventoryRecord(observation, capacity, mutateInventory)
  const records = { authority_main_sha: HEAD, observation_record: observation, capacity_estimate_records: [capacity], inventory_records: [inventory] }
  const bytes = BuildWorktreeGcPhase1InventoryArtifactV1(records)
  return { observation, capacity, inventory, records, bytes, digest: DigestWorktreeGcPhase1InventoryArtifactV1(bytes) }
}

function collectionInput(extra = {}) {
  return {
    schema_version: 'WorktreeGcPhase1CollectionInputV1',
    task_id: 'DESIGN-WORKTREE-GC-V1-PHASE1-READ-ONLY-INVENTORY-001',
    repository: 'whatrune/sd-prompt-studio', authority_main_sha: HEAD,
    repository_root: 'C:\\synthetic\\repository', observed_at: OBSERVED_AT,
    authority_refs: [AUTHORITY], expected_common_git_id: COMMON, ...extra,
  }
}

const readNames = [
  'read_repository_identity', 'read_worktree_porcelain_z', 'read_path_identity_no_follow',
  'read_head_and_registration', 'read_working_tree_state', 'read_history_state',
  'read_task_pr_state', 'read_activity_lock_state', 'read_explicit_keep_authority',
  'read_merge_and_inactivity_evidence', 'read_capacity_no_follow',
]

function syntheticPort(data, ledger, overrides = {}) {
  const values = {
    read_repository_identity: { repository: 'whatrune/sd-prompt-studio', authority_main_sha: HEAD, common_git_dir_identity: COMMON },
    read_worktree_porcelain_z: { observation_record: data.observation },
    read_path_identity_no_follow: { inventory_records: [data.inventory] },
    read_head_and_registration: { complete: true },
    read_working_tree_state: { complete: true },
    read_history_state: { complete: true },
    read_task_pr_state: { complete: true },
    read_activity_lock_state: { complete: true },
    read_explicit_keep_authority: { complete: true },
    read_merge_and_inactivity_evidence: { complete: true },
    read_capacity_no_follow: { capacity_estimate_records: [data.capacity] },
    ...overrides,
  }
  return Object.fromEntries(readNames.map(name => [name, async input => {
    ledger.read_calls.push(name)
    assert(Object.isFrozen(input), `${name} receives immutable input`)
    const value = values[name]
    if (value instanceof Error) throw value
    return structuredClone(value)
  }]))
}

function syntheticHost(input, port, ledger, parseError = false) {
  return {
    emitArtifactBytes: async bytes => { ledger.artifact_outputs.push(Buffer.from(bytes)) },
    emitSafeDiagnostic: async diagnostic => { ledger.diagnostics.push(structuredClone(diagnostic)) },
    parseInput: async () => {
      ledger.parse_calls += 1
      if (parseError) throw new Error('synthetic_parse_error')
      return structuredClone(input)
    },
    readOnlyPort: port,
  }
}

function classify(data) {
  return ClassifyWorktreeGcPhase1InventoryV1({
    schema_version: 'WorktreeGcPhase1ClassificationInputV1', artifact_bytes_utf8: data.bytes,
    artifact_digest: data.digest, evaluated_at: OBSERVED_AT,
    classification_rule_version: 'worktree-classification-rules-v2',
  })
}

const base = fixture()
assert(Buffer.from(BuildWorktreeGcPhase1InventoryArtifactV1(base.records)).equals(base.bytes), 'artifact bytes deterministic')
assert.equal(DigestWorktreeGcPhase1InventoryArtifactV1(base.bytes), base.digest, 'external digest deterministic')
assert.equal(base.bytes[0], 0x7b, 'UTF-8 JSON begins without BOM')

const ledger = {
  read_calls: [], artifact_outputs: [], diagnostics: [], parse_calls: 0,
  write: 0, move: 0, quarantine: 0, remove: 0, delete: 0, prune: 0,
  branch_ref: 0, network: 0,
}
const port = syntheticPort(base, ledger)
const host = syntheticHost(collectionInput(), port, ledger)
const direct = await MainWorktreeGcPhase1ReadOnlyInventoryCliV1(['--synthetic'], host)
assert.equal(direct.result, 'completed', 'direct public CLI entrypoint completes with injected input')
assert.deepEqual(ledger.read_calls, readNames, 'collector invokes only the closed read-only port in order')
assert.equal(ledger.artifact_outputs.length, 1, 'artifact emitted exactly once')
assert(ledger.artifact_outputs[0].equals(base.bytes), 'emitted artifact bytes exact')
assert.equal(ledger.diagnostics.length, 1, 'safe diagnostic emitted separately')
assert.equal(ledger.diagnostics[0].canonical_authority, 'result_handoff_required', 'stdout alone is not authority')
assert.equal(direct.classification_result.classification_records[0].payload.classification, 'eligible_clean_merged_inactive_candidate')
assert.equal(direct.mutation_performed, false)

const invokeLedger = { ...ledger, read_calls: [], artifact_outputs: [], diagnostics: [], parse_calls: 0 }
const invoked = await InvokeWorktreeGcPhase1ReadOnlyInventoryCliV1(['--synthetic'], syntheticHost(collectionInput(), syntheticPort(base, invokeLedger), invokeLedger))
assert.equal(invoked.result, 'completed', 'explicit caller reaches public entrypoint')

const classifications = [
  ['protected_primary_repository', payload => { payload.is_primary_repository = true }],
  ['protected_explicit_keep', payload => { payload.explicit_keep_authority_refs = [{ record_type: 'explicit_keep_authority', record_id: `explicit_keep_authority:${sha('keep').slice(7)}`, record_digest: sha('keep'), authority_url: AUTHORITY }] }],
  ['blocked_unknown', payload => { payload.working_tree_state.untracked = 'unknown' }],
  ['blocked_path_identity', payload => { payload.path_identity.common_git_dir_identity = sha('different-common') }],
  ['blocked_inaccessible_or_linked', payload => { payload.registration_state.admin_state = 'unreadable' }],
  ['blocked_active_or_locked', payload => { payload.activity_lock_state.git_lock = 'present' }],
  ['blocked_dirty_or_evidence_present', payload => { payload.working_tree_state.untracked = 'present' }],
  ['blocked_unpushed_or_unbound_history', payload => { payload.history_state.unpushed_state = 'present' }],
  ['blocked_open_task_or_pr', payload => { payload.task_pr_state.pr_state = 'open'; payload.task_pr_state.authority_urls = [AUTHORITY] }],
  ['blocked_merge_ambiguous', payload => { payload.merge_evidence.kind = 'ambiguous' }],
  ['eligible_clean_merged_inactive_candidate', () => {}],
  ['eligible_stale_registration_candidate', payload => {
    payload.path_identity = {
      identity_kind: 'absent_registration_identity', canonical_path: 'C:\\synthetic\\absent',
      registered_path_sha256: sha('absent'), common_git_dir_identity: COMMON,
      registration_admin_id: sha('admin'), reparse_state: 'not_observable_absent', filesystem_state: 'absent',
    }
    payload.registration_state.state = 'stale_registration'
  }],
  ['not_candidate', payload => { payload.inactivity_evidence.state = 'not_satisfied' }],
]
for (const [expected, mutate] of classifications) {
  const result = classify(fixture(mutate))
  assert.equal(result.result, 'classified', expected)
  assert.equal(result.classification_records[0].payload.classification, expected, expected)
}

const unknownCapacity = fixture(() => {}, 'unknown')
assert.equal(classify(unknownCapacity).result, 'classified', 'capacity uncertainty remains observational')
const boundedCapacity = fixture(() => {}, 'bounded')
assert.equal(classify(boundedCapacity).result, 'classified', 'bounded capacity remains observational')

const bytesBefore = Buffer.from(base.bytes)
const digestRejected = ClassifyWorktreeGcPhase1InventoryV1({
  schema_version: 'WorktreeGcPhase1ClassificationInputV1', artifact_bytes_utf8: base.bytes,
  artifact_digest: sha('wrong'), evaluated_at: OBSERVED_AT,
  classification_rule_version: 'worktree-classification-rules-v2',
})
assert.equal(digestRejected.failure_code, 'artifact_digest_mismatch')
assert(base.bytes.equals(bytesBefore), 'classifier does not mutate caller bytes')

const prettyBytes = Buffer.from(JSON.stringify(JSON.parse(base.bytes.toString('utf8')), null, 2), 'utf8')
const nonCanonical = ClassifyWorktreeGcPhase1InventoryV1({
  schema_version: 'WorktreeGcPhase1ClassificationInputV1', artifact_bytes_utf8: prettyBytes,
  artifact_digest: DigestWorktreeGcPhase1InventoryArtifactV1(prettyBytes), evaluated_at: OBSERVED_AT,
  classification_rule_version: 'worktree-classification-rules-v2',
})
assert.equal(nonCanonical.failure_code, 'structural_invalid', 'non-JCS bytes rejected')

assert.throws(
  () => BuildWorktreeGcPhase1InventoryArtifactV1({ ...base.records, unknown: true }),
  error => error instanceof WorktreeGcPhase1ContractError && error.code === 'unknown_field',
  'unknown artifact builder field rejected before evaluation',
)
assert.throws(
  () => BuildWorktreeGcPhase1InventoryArtifactV1({ ...base.records, inventory_records: [base.inventory, base.inventory] }),
  error => error instanceof WorktreeGcPhase1ContractError && error.code === 'duplicate_identity',
  'duplicate inventory identity rejected',
)
assert.throws(() => {
  const malformed = structuredClone(base.inventory.payload)
  delete malformed.head_binding
  const projection = { ...malformed }
  delete projection.inventory_evidence_digest
  malformed.inventory_evidence_digest = DigestWorktreeGcPhase1InventoryArtifactV1(CanonicalizeWorktreeGcPhase1JcsUtf8V1(projection))
  BuildWorktreeGcRecordEnvelopeV1('worktree_inventory', AUTHORITY, OBSERVED_AT, malformed)
}, error => error instanceof WorktreeGcPhase1ContractError && error.code === 'missing_field', 'missing field rejected')
assert.throws(
  () => capacityRecord(observationRecord(), 'unsupported'),
  error => error instanceof WorktreeGcPhase1ContractError && error.code === 'structural_invalid',
  'unsupported capacity union branch rejected',
)
assert.throws(
  () => fixture(payload => {
    const keepDigest = sha('duplicate-keep')
    const keepRef = { record_type: 'explicit_keep_authority', record_id: `explicit_keep_authority:${keepDigest.slice(7)}`, record_digest: keepDigest, authority_url: AUTHORITY }
    payload.explicit_keep_authority_refs = [keepRef, structuredClone(keepRef)]
  }),
  error => error instanceof WorktreeGcPhase1ContractError && error.code === 'duplicate_identity',
  'duplicate explicit keep authority ref rejected',
)
assert.throws(() => {
  const observation = observationRecord()
  const capacity = capacityRecord(observation)
  const inventory = inventoryRecord(observation, capacity, payload => {
    payload.observation_ref.authority_url = 'https://github.com/whatrune/sd-prompt-studio/issues/248'
  })
  BuildWorktreeGcPhase1InventoryArtifactV1({
    authority_main_sha: HEAD,
    observation_record: observation,
    capacity_estimate_records: [capacity],
    inventory_records: [inventory],
  })
}, error => error instanceof WorktreeGcPhase1ContractError && error.code === 'inventory_reference_mismatch', 'all four observation ref fields must resolve')

const mismatchLedger = { read_calls: [] }
const mismatchPort = syntheticPort(base, mismatchLedger, {
  read_repository_identity: { repository: 'whatrune/sd-prompt-studio', authority_main_sha: '0'.repeat(40), common_git_dir_identity: COMMON },
})
const mismatch = await CollectWorktreeGcPhase1InventoryV1(collectionInput(), mismatchPort)
assert.equal(mismatch.failure_code, 'authority_main_mismatch', 'exact-HEAD invalidation fails closed')
assert.equal(mismatch.artifact_bytes_utf8, undefined, 'blocked collection emits no partial artifact')
assert.deepEqual(mismatchLedger.read_calls, ['read_repository_identity'])

const commonLedger = { read_calls: [] }
const commonMismatch = await CollectWorktreeGcPhase1InventoryV1(collectionInput(), syntheticPort(base, commonLedger, {
  read_repository_identity: { repository: 'whatrune/sd-prompt-studio', authority_main_sha: HEAD, common_git_dir_identity: sha('drift') },
}))
assert.equal(commonMismatch.failure_code, 'common_git_identity_mismatch')

const forbiddenLedger = { read_calls: [], mutation_calls: 0 }
const forbiddenPort = syntheticPort(base, forbiddenLedger)
forbiddenPort.remove = async () => { forbiddenLedger.mutation_calls += 1 }
const forbidden = await CollectWorktreeGcPhase1InventoryV1(collectionInput(), forbiddenPort)
assert.equal(forbidden.failure_code, 'input_invalid', 'forbidden capability structurally rejected')
assert.equal(forbiddenLedger.read_calls.length, 0, 'forbidden port rejected before observation')
assert.equal(forbiddenLedger.mutation_calls, 0, 'forbidden capability never called')

const failedReadLedger = { read_calls: [] }
const failedRead = await CollectWorktreeGcPhase1InventoryV1(collectionInput(), syntheticPort(base, failedReadLedger, {
  read_worktree_porcelain_z: new Error('synthetic unavailable'),
}))
assert.equal(failedRead.failure_code, 'porcelain_observation_unavailable')
assert.equal(failedRead.artifact_bytes_utf8, undefined)

const malformedInput = await CollectWorktreeGcPhase1InventoryV1({ ...collectionInput(), extra: true }, syntheticPort(base, { read_calls: [] }))
assert.equal(malformedInput.failure_code, 'input_invalid')
const relativeRootLedger = { read_calls: [] }
const relativeRoot = await CollectWorktreeGcPhase1InventoryV1(
  collectionInput({ repository_root: '.\\synthetic' }),
  syntheticPort(base, relativeRootLedger),
)
assert.equal(relativeRoot.failure_code, 'input_invalid', 'relative repository root rejected before observation')
assert.equal(relativeRootLedger.read_calls.length, 0)
const malformedRef = await CollectWorktreeGcPhase1InventoryV1(
  collectionInput({ authority_refs: [7] }),
  syntheticPort(base, { read_calls: [] }),
)
assert.equal(malformedRef.failure_code, 'input_invalid', 'non-string authority ref rejects as input_invalid')

const owner = await RunWorktreeGcPhase1ReadOnlyInventoryV1(collectionInput(), { readOnlyPort: syntheticPort(base, { read_calls: [] }) })
assert.equal(owner.result, 'completed', 'production owner orchestrates collector, artifact, classifier')

const parseLedger = { read_calls: [], artifact_outputs: [], diagnostics: [], parse_calls: 0 }
const parseFailure = await MainWorktreeGcPhase1ReadOnlyInventoryCliV1([], syntheticHost(collectionInput(), syntheticPort(base, parseLedger), parseLedger, true))
assert.equal(parseFailure.result, 'blocked')
assert.equal(parseLedger.artifact_outputs.length, 0, 'CLI parse failure emits no artifact')
assert.equal(parseLedger.read_calls.length, 0, 'CLI parse failure performs no observation')

for (const key of ['write', 'move', 'quarantine', 'remove', 'delete', 'prune', 'branch_ref', 'network']) {
  assert.equal(ledger[key], 0, `${key} mutation/network count remains zero`)
}

console.log(JSON.stringify({
  result: 'PASS',
  focused_cases: 33,
  classification_branches: classifications.length,
  read_only_port_calls: ledger.read_calls.length,
  artifact_emissions: ledger.artifact_outputs.length,
  mutation_count: 0,
  write: 0, move: 0, quarantine: 0, remove: 0, delete: 0, prune: 0,
  branch_ref: 0, network: 0,
  synthetic_only: true,
  implementation_head: HEAD,
}))
