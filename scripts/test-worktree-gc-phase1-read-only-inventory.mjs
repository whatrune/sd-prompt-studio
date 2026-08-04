import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  BuildWorktreeGcRecordEnvelopeV1,
  CanonicalizeWorktreeGcPhase1JcsUtf8V1,
  DigestWorktreeGcPhase1InventoryArtifactV1,
  ParseWorktreeGcPhase1InventoryArtifactV1,
  WorktreeGcPhase1ContractError,
} from './worktree-gc-phase1-inventory-artifact.mjs'
import { CollectWorktreeGcPhase1InventoryV1 } from './worktree-gc-phase1-collector.mjs'
import { ClassifyWorktreeGcPhase1InventoryV1 } from './worktree-gc-phase1-classifier.mjs'
import { RunWorktreeGcPhase1ReadOnlyInventoryV1 } from './worktree-gc-phase1-read-only-inventory.mjs'
import {
  InvokeWorktreeGcPhase1ReadOnlyInventoryCliV1,
  MainWorktreeGcPhase1ReadOnlyInventoryCliV1,
} from './worktree-gc-phase1-read-only-inventory-cli.mjs'

const EXECUTION_HEAD = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
assert.match(EXECUTION_HEAD, /^[0-9a-f]{40}$/, 'correction execution HEAD is an exact Git commit')
const OBSERVED_AT = '2026-08-04T15:00:00Z'
const AUTHORITY = 'https://github.com/whatrune/sd-prompt-studio/issues/248#issuecomment-5179407064'
const POLICY = 'https://github.com/whatrune/sd-prompt-studio/issues/209#issuecomment-5097525010'
const REPOSITORY_ROOT = 'https://github.com/whatrune/sd-prompt-studio'
const sha = value => `sha256:${createHash('sha256').update(value).digest('hex')}`
const digest = value => DigestWorktreeGcPhase1InventoryArtifactV1(CanonicalizeWorktreeGcPhase1JcsUtf8V1(value))
const COMMON = sha('synthetic-common-git')
const REGISTERED_PATH = sha('synthetic-registered-path')
const ADMIN_ID = sha('synthetic-admin-id')

const resultSchemas = Object.freeze({
  read_repository_identity: 'ReadRepositoryIdentityResultV1',
  read_worktree_porcelain_z: 'ReadWorktreePorcelainZResultV1',
  read_path_identity_no_follow: 'ReadPathIdentityNoFollowResultV1',
  read_head_and_registration: 'ReadHeadAndRegistrationResultV1',
  read_working_tree_state: 'ReadWorkingTreeStateResultV1',
  read_history_state: 'ReadHistoryStateResultV1',
  read_task_pr_state: 'ReadTaskPrStateResultV1',
  read_activity_lock_state: 'ReadActivityLockStateResultV1',
  read_explicit_keep_authority: 'ReadExplicitKeepAuthorityResultV1',
  read_merge_and_inactivity_evidence: 'ReadMergeAndInactivityEvidenceResultV1',
  read_capacity_no_follow: 'ReadCapacityNoFollowResultV1',
})
const readNames = Object.keys(resultSchemas)

function ref(record) {
  return {
    record_type: record.record_type,
    record_id: record.record_id,
    record_digest: record.record_digest,
    authority_url: record.authority_url,
  }
}

function collectionInput(extra = {}) {
  return {
    schema_version: 'WorktreeGcPhase1CollectionInputV1',
    task_id: 'DESIGN-WORKTREE-GC-V1-PHASE1-READ-ONLY-INVENTORY-001',
    repository: 'whatrune/sd-prompt-studio',
    authority_main_sha: EXECUTION_HEAD,
    repository_root: 'C:\\synthetic\\repository',
    observed_at: OBSERVED_AT,
    authority_refs: [AUTHORITY],
    expected_common_git_id: COMMON,
    ...extra,
  }
}

function observationRecord() {
  return BuildWorktreeGcRecordEnvelopeV1('worktree_observation', AUTHORITY, OBSERVED_AT, {
    schema_version: 'WorktreeObservationSnapshotV1', repository: 'whatrune/sd-prompt-studio',
    authority_main_sha: EXECUTION_HEAD, observed_at: OBSERVED_AT,
    git_version: '2.55.0.windows.3', common_git_dir_identity_sha256: COMMON,
    command_argv: ['git', 'worktree', 'list', '--porcelain', '-z'],
    porcelain_encoding: 'git-porcelain-v1-nul-terminated-bytes', porcelain_byte_length: '128',
    porcelain_sha256: sha('synthetic-porcelain'), registered_worktree_count: 1,
    locked_marker_count: 0, prunable_marker_count: 0,
    path_disclosure: 'redacted_digest_only', mutation_performed: false,
  })
}

function item(fields) {
  return { ...fields, item_digest: digest(fields) }
}

function completed(operation, payload, inputDigest) {
  const projection = {
    schema_version: resultSchemas[operation], operation, result: 'completed',
    collection_input_digest: inputDigest, observed_at: OBSERVED_AT, payload,
  }
  return { ...projection, result_digest: digest(projection) }
}

function makeKeepRecord(repositoryIdentity, pathIdentity, headBinding, index, supersedesKeepRef = null, revocationRef = null) {
  const repositoryIdentityDigest = digest(repositoryIdentity)
  const pathIdentityDigest = digest(pathIdentity)
  const validFrom = index === 0 ? '2026-08-01T00:00:00Z' : '2026-08-02T00:00:00Z'
  return BuildWorktreeGcRecordEnvelopeV1('explicit_keep_authority', AUTHORITY, OBSERVED_AT, {
    schema_version: 'ExplicitKeepAuthorityV1',
    owner_role: index === 0 ? 'Product Owner' : 'Integrated Lead',
    owner_record_url: AUTHORITY,
    repository_identity_ref: repositoryIdentityDigest,
    path_identity_ref: pathIdentityDigest,
    head_binding_or_null: headBinding,
    reason_code: index === 0 ? 'product_keep' : 'active_assignment',
    valid_from: validFrom,
    expires_at_or_null: null,
    supersedes_keep_ref_or_null: supersedesKeepRef,
    revocation_ref_or_null: revocationRef,
  })
}

function makeLifecycleEvidence(entryKey, repositoryIdentity, pathIdentity, headBinding, keepRecord, lifecycleState, options = {}) {
  const repositoryIdentityDigest = digest(repositoryIdentity)
  const pathIdentityDigest = digest(pathIdentity)
  const fields = {
    schema_version: 'KeepLifecycleEvidenceV1', entry_key: entryKey,
    keep_record: keepRecord, keep_ref: ref(keepRecord),
    repository_identity_digest: repositoryIdentityDigest,
    path_identity_digest: pathIdentityDigest,
    head_binding_digest_or_null: digest(headBinding),
    evaluated_at: OBSERVED_AT, lifecycle_state: lifecycleState,
    superseding_keep_ref_or_null: options.supersedingKeepRef ?? null,
    revocation_ref_or_null: options.revocationRef ?? null,
    resolution_evidence_refs: options.resolutionEvidenceRefs ?? [],
  }
  return { ...fields, lifecycle_evidence_digest: digest(fields) }
}

function makeKeep(entryKey, repositoryIdentity, pathIdentity, headBinding, index, lifecycleState) {
  const expiresAt = lifecycleState === 'expired_unresolved' ? '2026-08-03T00:00:00Z' : null
  let keepRecord = makeKeepRecord(repositoryIdentity, pathIdentity, headBinding, index)
  if (expiresAt !== null) {
    const payload = { ...keepRecord.payload, expires_at_or_null: expiresAt }
    keepRecord = BuildWorktreeGcRecordEnvelopeV1('explicit_keep_authority', AUTHORITY, OBSERVED_AT, payload)
  }
  return {
    keepRecord,
    evidence: makeLifecycleEvidence(entryKey, repositoryIdentity, pathIdentity, headBinding, keepRecord, lifecycleState),
  }
}

function makeScenario(options = {}) {
  const input = collectionInput(options.input)
  const inputDigest = digest(input)
  const observation = observationRecord()
  const entryKey = `worktree:${digest({
    observation_record_id: observation.record_id,
    registered_path_sha256: REGISTERED_PATH,
    registration_admin_id: ADMIN_ID,
  }).slice(7)}`
  const repositoryIdentity = {
    repository: REPOSITORY_ROOT, owner: 'whatrune', name: 'sd-prompt-studio',
    authority_main_sha: EXECUTION_HEAD, common_git_dir_identity: COMMON,
    remote_identity: REPOSITORY_ROOT,
  }
  const state = {
    pathIdentity: {
      identity_kind: 'existing_handle_identity', canonical_path: 'C:\\synthetic\\task-worktree',
      registered_path_sha256: REGISTERED_PATH, final_path_sha256: sha('synthetic-final-path'),
      volume_serial_hex: '00000001', file_id_128_hex: '00000000000000000000000000000001',
      common_git_dir_identity: COMMON, registration_admin_id: ADMIN_ID,
      reparse_state: 'none', filesystem_state: 'present',
    },
    isPrimary: false,
    headBinding: { head_sha: EXECUTION_HEAD, ref_kind: 'branch', ref_name: 'codex/synthetic' },
    registrationState: { state: 'registered', porcelain_entry_sha256: sha('entry'), admin_state: 'present' },
    workingTreeState: { staged: 'clean', unstaged: 'clean', untracked: 'clean', ignored: 'clean', submodule: 'clean' },
    historyState: { upstream: 'present', ahead_count: 0, behind_count: 0, reachable_remote_ref_sha256s: [], unpushed_state: 'none' },
    taskPrState: { task_state: 'none', pr_state: 'none', authority_urls: [] },
    activityLockState: { git_lock: 'absent', process_or_handle: 'absent', evidence_refs: [] },
    mergeEvidence: { kind: 'exact_head_ancestor_of_admitted_main', authority_url: AUTHORITY, admitted_main_sha: EXECUTION_HEAD },
    inactivityEvidence: { policy_ref: POLICY, threshold_seconds: '86400', last_activity_at: '2026-08-01T00:00:00Z', state: 'satisfied' },
  }
  options.mutate?.(state)
  const keepDefinitions = options.keepDefinitions ?? (options.keepStates ?? []).map((lifecycle, index) => ({ lifecycle, index }))
  const keeps = keepDefinitions.map(definition => makeKeep(
    entryKey, repositoryIdentity, state.pathIdentity, state.headBinding,
    definition.index, definition.lifecycle,
  ))
  const keepRefs = keeps.map(value => ref(value.keepRecord)).sort((left, right) => Buffer.compare(Buffer.from(left.record_id), Buffer.from(right.record_id)))
  const lifecycleRecords = keeps.map(value => value.evidence).sort((left, right) => Buffer.compare(Buffer.from(left.keep_ref.record_id), Buffer.from(right.keep_ref.record_id)))
  const capacityState = options.capacityState ?? 'exact'
  const uncertaintyCodes = options.uncertaintyCodes ?? (capacityState === 'exact' ? [] : ['hardlink_exclusivity_unproved'])
  const capacityBase = {
    schema_version: 'CapacityEstimateV1', path_identity_ref: digest(state.pathIdentity),
    observation_ref: ref(observation), state: capacityState, enumerated_entry_count: 4,
    evidence_digest: sha(`capacity-${capacityState}-${uncertaintyCodes.join('-')}`),
    uncertainty_codes: [...uncertaintyCodes].sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right))),
  }
  const capacityBranch = capacityState === 'exact'
    ? { logical_size_bytes: '4096', exclusive_allocated_bytes: '4096' }
    : capacityState === 'bounded'
      ? { logical_size_bytes: '4096', exclusive_allocated_lower_bound_bytes: '0', exclusive_allocated_upper_bound_bytes_or_null: '4096' }
      : {}
  const capacity = BuildWorktreeGcRecordEnvelopeV1('capacity_estimate', AUTHORITY, OBSERVED_AT, { ...capacityBase, ...capacityBranch })
  const observationRef = ref(observation)
  const roster = [{ entry_key: entryKey, registered_path_sha256: REGISTERED_PATH, registration_admin_id: ADMIN_ID }]
  const payloads = {
    read_repository_identity: { repository_identity: repositoryIdentity },
    read_worktree_porcelain_z: { observation_record: observation, entry_roster: roster },
    read_path_identity_no_follow: { observation_ref: observationRef, items: [item({ entry_key: entryKey, path_identity: state.pathIdentity, is_primary_repository: state.isPrimary })] },
    read_head_and_registration: { observation_ref: observationRef, items: [item({ entry_key: entryKey, head_binding: state.headBinding, registration_state: state.registrationState })] },
    read_working_tree_state: { observation_ref: observationRef, items: [item({ entry_key: entryKey, working_tree_state: state.workingTreeState })] },
    read_history_state: { observation_ref: observationRef, items: [item({ entry_key: entryKey, history_state: state.historyState })] },
    read_task_pr_state: { observation_ref: observationRef, items: [item({ entry_key: entryKey, task_pr_state: state.taskPrState })] },
    read_activity_lock_state: { observation_ref: observationRef, items: [item({ entry_key: entryKey, activity_lock_state: state.activityLockState })] },
    read_explicit_keep_authority: { observation_ref: observationRef, items: [item({ entry_key: entryKey, explicit_keep_authority_refs: keepRefs })], keep_lifecycle_evidence_records: lifecycleRecords },
    read_merge_and_inactivity_evidence: { observation_ref: observationRef, items: [item({ entry_key: entryKey, merge_evidence: state.mergeEvidence, inactivity_evidence: state.inactivityEvidence })] },
    read_capacity_no_follow: { observation_ref: observationRef, items: [item({ entry_key: entryKey, capacity_estimate_record: capacity })] },
  }
  const results = Object.fromEntries(readNames.map(operation => [operation, completed(operation, payloads[operation], inputDigest)]))
  options.mutateResults?.(results, { entryKey, inputDigest })
  return { input, results, entryKey, repositoryIdentity, state }
}

function replaceKeepResult(scenario, keepRecords, lifecycleEvidenceRecords) {
  const explicitKeepAuthorityRefs = keepRecords.map(ref).sort((left, right) => Buffer.compare(Buffer.from(left.record_id), Buffer.from(right.record_id)))
  const keepLifecycleEvidenceRecords = [...lifecycleEvidenceRecords].sort((left, right) => Buffer.compare(Buffer.from(left.keep_ref.record_id), Buffer.from(right.keep_ref.record_id)))
  const observationRef = scenario.results.read_explicit_keep_authority.payload.observation_ref
  const payload = {
    observation_ref: observationRef,
    items: [item({ entry_key: scenario.entryKey, explicit_keep_authority_refs: explicitKeepAuthorityRefs })],
    keep_lifecycle_evidence_records: keepLifecycleEvidenceRecords,
  }
  scenario.results.read_explicit_keep_authority = completed('read_explicit_keep_authority', payload, digest(scenario.input))
  return scenario
}

function syntheticPort(results, ledger) {
  return Object.fromEntries(readNames.map(operation => [operation, async input => {
    ledger.read_calls.push(operation)
    assert(Object.isFrozen(input), `${operation}: input root frozen`)
    assert(Object.isFrozen(input.authority_refs), `${operation}: nested input frozen`)
    return structuredClone(results[operation])
  }]))
}

function hostFor(scenario, ledger, parseError = false) {
  return {
    emitArtifactBytes: async bytes => { ledger.artifact_outputs.push(Buffer.from(bytes)) },
    emitSafeDiagnostic: async diagnostic => { ledger.diagnostics.push(structuredClone(diagnostic)) },
    parseInput: async () => {
      ledger.parse_calls += 1
      if (parseError) throw new Error('synthetic_parse_failure')
      return structuredClone(scenario.input)
    },
    readOnlyPort: syntheticPort(scenario.results, ledger),
  }
}

function newLedger() {
  return {
    read_calls: [], artifact_outputs: [], diagnostics: [], parse_calls: 0,
    write: 0, move: 0, quarantine: 0, remove: 0, delete: 0, prune: 0,
    branch_ref: 0, network: 0,
  }
}

async function collectScenario(options = {}) {
  const scenario = makeScenario(options)
  return collectBuiltScenario(scenario)
}

async function collectBuiltScenario(scenario) {
  const ledger = newLedger()
  const collection = await CollectWorktreeGcPhase1InventoryV1(scenario.input, syntheticPort(scenario.results, ledger))
  return { scenario, ledger, collection }
}

function classifyCollection(collection) {
  return ClassifyWorktreeGcPhase1InventoryV1({
    schema_version: 'WorktreeGcPhase1ClassificationInputV1',
    artifact_bytes_utf8: collection.artifact_bytes_utf8,
    artifact_digest: collection.artifact_digest,
    evaluated_at: OBSERVED_AT,
    classification_rule_version: 'worktree-classification-rules-v2',
  })
}

const directScenario = makeScenario()
const directLedger = newLedger()
const direct = await MainWorktreeGcPhase1ReadOnlyInventoryCliV1(['--synthetic'], hostFor(directScenario, directLedger))
assert.equal(direct.result, 'completed')
assert.deepEqual(directLedger.read_calls, readNames)
assert.equal(directLedger.artifact_outputs.length, 1)
assert.equal(directLedger.diagnostics.length, 1)
assert.equal(directLedger.diagnostics[0].canonical_authority, 'result_handoff_required')
assert.equal(direct.classification_result.classification_records[0].payload.classification, 'eligible_clean_merged_inactive_candidate')
assert.equal(ParseWorktreeGcPhase1InventoryArtifactV1(direct.artifact_bytes_utf8).inventory_provenance_records.length, 1)

const invokeLedger = newLedger()
assert.equal((await InvokeWorktreeGcPhase1ReadOnlyInventoryCliV1(['--synthetic'], hostFor(directScenario, invokeLedger))).result, 'completed')

const classificationCases = [
  ['protected_primary_repository', { mutate: state => { state.isPrimary = true } }],
  ['protected_explicit_keep', { keepStates: ['current'] }],
  ['blocked_unknown', { mutate: state => { state.workingTreeState.untracked = 'unknown' } }],
  ['blocked_path_identity', { mutate: state => { state.pathIdentity.common_git_dir_identity = sha('drift') } }],
  ['blocked_inaccessible_or_linked', { mutate: state => { state.registrationState.admin_state = 'unreadable' } }],
  ['blocked_active_or_locked', { mutate: state => { state.activityLockState.git_lock = 'present' } }],
  ['blocked_dirty_or_evidence_present', { mutate: state => { state.workingTreeState.untracked = 'present' } }],
  ['blocked_unpushed_or_unbound_history', { mutate: state => { state.historyState.unpushed_state = 'present' } }],
  ['blocked_open_task_or_pr', { mutate: state => { state.taskPrState.pr_state = 'open'; state.taskPrState.authority_urls = [AUTHORITY] } }],
  ['blocked_merge_ambiguous', { mutate: state => { state.mergeEvidence.kind = 'ambiguous' } }],
  ['eligible_clean_merged_inactive_candidate', {}],
  ['eligible_stale_registration_candidate', { mutate: state => {
    state.pathIdentity = {
      identity_kind: 'absent_registration_identity', canonical_path: 'C:\\synthetic\\absent',
      registered_path_sha256: REGISTERED_PATH, common_git_dir_identity: COMMON,
      registration_admin_id: ADMIN_ID, reparse_state: 'not_observable_absent', filesystem_state: 'absent',
    }
    state.registrationState.state = 'stale_registration'
  } }],
  ['not_candidate', { mutate: state => { state.inactivityEvidence.state = 'not_satisfied' } }],
]
for (const [expected, options] of classificationCases) {
  const { collection } = await collectScenario(options)
  assert.equal(collection.result, 'completed', expected)
  assert.equal(classifyCollection(collection).classification_records[0].payload.classification, expected, expected)
}

// WGC-003: two independently current keeps protect and conflict.
const wgc003 = classifyCollection((await collectScenario({ keepStates: ['current', 'current'] })).collection)
assert.equal(wgc003.classification_records[0].payload.classification, 'protected_explicit_keep')
assert.deepEqual(wgc003.classification_records[0].payload.blocking_reason_codes, ['keep_authority_conflict'])

// WGC-004: expired unresolved keep blocks UNKNOWN instead of protecting.
const wgc004 = classifyCollection((await collectScenario({ keepStates: ['expired_unresolved'] })).collection)
assert.equal(wgc004.classification_records[0].payload.classification, 'blocked_unknown')
assert.deepEqual(wgc004.classification_records[0].payload.blocking_reason_codes, ['expired_keep_unresolved'])

// Exact supersession admits an acyclic chain even when the direct superseder is itself superseded.
const chainScenario = makeScenario()
const chainA = makeKeepRecord(chainScenario.repositoryIdentity, chainScenario.state.pathIdentity, chainScenario.state.headBinding, 0)
const chainB = makeKeepRecord(chainScenario.repositoryIdentity, chainScenario.state.pathIdentity, chainScenario.state.headBinding, 1, ref(chainA))
const chainC = makeKeepRecord(chainScenario.repositoryIdentity, chainScenario.state.pathIdentity, chainScenario.state.headBinding, 2, ref(chainB))
replaceKeepResult(chainScenario, [chainA, chainB, chainC], [
  makeLifecycleEvidence(chainScenario.entryKey, chainScenario.repositoryIdentity, chainScenario.state.pathIdentity, chainScenario.state.headBinding, chainA, 'superseded', { supersedingKeepRef: ref(chainB) }),
  makeLifecycleEvidence(chainScenario.entryKey, chainScenario.repositoryIdentity, chainScenario.state.pathIdentity, chainScenario.state.headBinding, chainB, 'superseded', { supersedingKeepRef: ref(chainC) }),
  makeLifecycleEvidence(chainScenario.entryKey, chainScenario.repositoryIdentity, chainScenario.state.pathIdentity, chainScenario.state.headBinding, chainC, 'current'),
])
const chainCollection = (await collectBuiltScenario(chainScenario)).collection
assert.equal(chainCollection.result, 'completed', 'acyclic supersession chain admitted')
assert.equal(classifyCollection(chainCollection).classification_records[0].payload.classification, 'protected_explicit_keep')
assert.deepEqual(classifyCollection(chainCollection).classification_records[0].payload.blocking_reason_codes, [])

// Revoked evidence remains in the artifact but does not protect or block by itself.
const revokedScenario = makeScenario()
const revokedKeep = makeKeepRecord(
  revokedScenario.repositoryIdentity, revokedScenario.state.pathIdentity,
  revokedScenario.state.headBinding, 0, null, AUTHORITY,
)
replaceKeepResult(revokedScenario, [revokedKeep], [
  makeLifecycleEvidence(revokedScenario.entryKey, revokedScenario.repositoryIdentity, revokedScenario.state.pathIdentity, revokedScenario.state.headBinding, revokedKeep, 'revoked', {
    revocationRef: AUTHORITY,
    resolutionEvidenceRefs: [AUTHORITY],
  }),
])
const revokedCollection = (await collectBuiltScenario(revokedScenario)).collection
assert.equal(revokedCollection.result, 'completed', 'revoked keep evidence admitted')
assert.equal(classifyCollection(revokedCollection).classification_records[0].payload.classification, 'eligible_clean_merged_inactive_candidate')

// A supersedes ref with matching ID/digest but a different authority URL is not the exact target ref.
const mismatchedRefScenario = makeScenario()
const targetKeep = makeKeepRecord(mismatchedRefScenario.repositoryIdentity, mismatchedRefScenario.state.pathIdentity, mismatchedRefScenario.state.headBinding, 0)
const mismatchedTargetRef = {
  ...ref(targetKeep),
  authority_url: 'https://github.com/whatrune/sd-prompt-studio/issues/247#issuecomment-5179347436',
}
const invalidSuperseder = makeKeepRecord(
  mismatchedRefScenario.repositoryIdentity, mismatchedRefScenario.state.pathIdentity,
  mismatchedRefScenario.state.headBinding, 1, mismatchedTargetRef,
)
replaceKeepResult(mismatchedRefScenario, [targetKeep, invalidSuperseder], [
  makeLifecycleEvidence(mismatchedRefScenario.entryKey, mismatchedRefScenario.repositoryIdentity, mismatchedRefScenario.state.pathIdentity, mismatchedRefScenario.state.headBinding, targetKeep, 'superseded', { supersedingKeepRef: ref(invalidSuperseder) }),
  makeLifecycleEvidence(mismatchedRefScenario.entryKey, mismatchedRefScenario.repositoryIdentity, mismatchedRefScenario.state.pathIdentity, mismatchedRefScenario.state.headBinding, invalidSuperseder, 'current'),
])
const mismatchedRefCollection = (await collectBuiltScenario(mismatchedRefScenario)).collection
assert.equal(mismatchedRefCollection.result, 'blocked')
assert.equal(mismatchedRefCollection.failure_code, 'artifact_canonicalization_failed')

// WGC-037: all named allocation uncertainties remain bounded evidence, never reclaimable exact bytes.
const capacityUncertainties = ['alternate_stream_unenumerated', 'cloud_placeholder', 'compression_or_dedup_unknown', 'sparse_allocation']
const wgc037Collection = (await collectScenario({ capacityState: 'bounded', uncertaintyCodes: capacityUncertainties })).collection
const wgc037Artifact = ParseWorktreeGcPhase1InventoryArtifactV1(wgc037Collection.artifact_bytes_utf8)
assert.equal(wgc037Artifact.capacity_estimate_records[0].payload.state, 'bounded')
assert.equal(wgc037Artifact.capacity_estimate_records[0].payload.exclusive_allocated_lower_bound_bytes, '0')
assert.deepEqual(wgc037Artifact.capacity_estimate_records[0].payload.uncertainty_codes, [...capacityUncertainties].sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b))))

// WGC-039: semantically identical current-keep sets are normalized before admission.
const orderedDefinitions = [{ lifecycle: 'current', index: 0 }, { lifecycle: 'current', index: 1 }]
const orderedKeep = await collectScenario({ keepDefinitions: orderedDefinitions })
const reversedKeep = await collectScenario({ keepDefinitions: [...orderedDefinitions].reverse() })
assert.equal(orderedKeep.collection.artifact_digest, reversedKeep.collection.artifact_digest)
assert.equal(classifyCollection(orderedKeep.collection).evaluation_digest, classifyCollection(reversedKeep.collection).evaluation_digest)

// Provenance: path identity cannot smuggle unrelated state, and distinct state result controls merge.
const smuggled = await collectScenario({ mutateResults: results => {
  const pathResult = results.read_path_identity_no_follow
  const original = pathResult.payload.items[0]
  pathResult.payload.items[0] = item({
    entry_key: original.entry_key, path_identity: original.path_identity,
    is_primary_repository: original.is_primary_repository,
    working_tree_state: { staged: 'clean' },
  })
  const projection = { ...pathResult }
  delete projection.result_digest
  pathResult.result_digest = digest(projection)
} })
assert.equal(smuggled.collection.result, 'blocked')
assert.equal(smuggled.collection.failure_code, 'path_identity_unavailable')
const dirtyFromOwner = await collectScenario({ mutate: state => { state.workingTreeState.untracked = 'present' } })
assert.equal(classifyCollection(dirtyFromOwner.collection).classification_records[0].payload.classification, 'blocked_dirty_or_evidence_present')

const badProvenance = await collectScenario({ mutateResults: results => {
  results.read_history_state.collection_input_digest = sha('wrong-input')
} })
assert.equal(badProvenance.collection.failure_code, 'repository_state_unavailable')
assert.equal(badProvenance.collection.artifact_bytes_utf8, undefined)

// Identity admission: only exact repository root and direct Issue body/top-level comment URLs.
for (const invalidUrl of [
  'https://example.com/issues/248',
  'https://github.com/other/sd-prompt-studio/issues/248',
  'https://github.com/whatrune/sd-prompt-studio/pull/248',
  'https://github.com/whatrune/sd-prompt-studio/issues/248/comments/1',
  'https://github.com/whatrune/sd-prompt-studio/issues/248?secret=token',
  'https://github.com/whatrune/sd-prompt-studio/issues/248#files',
  'C:\\Users\\unrelated\\secret.txt',
]) {
  const invalid = await CollectWorktreeGcPhase1InventoryV1(collectionInput({ authority_refs: [invalidUrl] }), syntheticPort(directScenario.results, newLedger()))
  assert.equal(invalid.failure_code, 'input_invalid', invalidUrl)
}
for (const mutation of [
  identity => { identity.repository = 'https://github.com/other/sd-prompt-studio' },
  identity => { identity.owner = 'other' },
  identity => { identity.name = 'other' },
  identity => { identity.remote_identity = 'https://github.com/whatrune/other' },
]) {
  const wrongIdentity = await collectScenario({ mutateResults: results => {
    mutation(results.read_repository_identity.payload.repository_identity)
    const result = results.read_repository_identity
    const projection = { ...result }
    delete projection.result_digest
    result.result_digest = digest(projection)
  } })
  assert.equal(wrongIdentity.collection.failure_code, 'repository_identity_unavailable')
}

// WGC-042: no legacy schema or old digest projection fallback.
const validCollection = (await collectScenario()).collection
const legacyObject = JSON.parse(Buffer.from(validCollection.artifact_bytes_utf8).toString('utf8'))
legacyObject.inventory_records[0].payload.schema_version = 'WorktreeInventoryPayloadV1'
const legacyBytes = CanonicalizeWorktreeGcPhase1JcsUtf8V1(legacyObject)
const legacyResult = ClassifyWorktreeGcPhase1InventoryV1({
  schema_version: 'WorktreeGcPhase1ClassificationInputV1', artifact_bytes_utf8: legacyBytes,
  artifact_digest: DigestWorktreeGcPhase1InventoryArtifactV1(legacyBytes), evaluated_at: OBSERVED_AT,
  classification_rule_version: 'worktree-classification-rules-v2',
})
assert.equal(legacyResult.failure_code, 'artifact_digest_mismatch', 'legacy payload cannot bypass its bound envelope digest')
const digestMismatch = ClassifyWorktreeGcPhase1InventoryV1({
  schema_version: 'WorktreeGcPhase1ClassificationInputV1', artifact_bytes_utf8: validCollection.artifact_bytes_utf8,
  artifact_digest: sha('legacy-projection'), evaluated_at: OBSERVED_AT,
  classification_rule_version: 'worktree-classification-rules-v2',
})
assert.equal(digestMismatch.failure_code, 'artifact_digest_mismatch')

// WGC-045: arbitrary HTTPS/PR/query/fragment/local-path public authority evidence is rejected above.
assert.throws(() => BuildWorktreeGcRecordEnvelopeV1('worktree_observation', 'https://example.com/secret', OBSERVED_AT, {}),
  error => error instanceof WorktreeGcPhase1ContractError && error.code === 'structural_invalid')

// Deep immutability and mutation isolation after evaluation digest calculation.
const immutable = classifyCollection(validCollection)
const immutableSnapshot = JSON.stringify(immutable)
const immutableDigest = immutable.evaluation_digest
const record = immutable.classification_records[0]
assert(Object.isFrozen(immutable))
assert(Object.isFrozen(immutable.classification_records))
assert(Object.isFrozen(record.payload))
assert(Object.isFrozen(record.payload.blocking_reason_codes))
assert(Object.isFrozen(record.payload.evidence_refs))
assert.throws(() => record.payload.evidence_refs.push(AUTHORITY), TypeError)
assert.throws(() => { record.payload.inventory_ref.record_id = 'worktree_inventory:tampered' }, TypeError)
assert.equal(JSON.stringify(immutable), immutableSnapshot)
assert.equal(immutable.evaluation_digest, immutableDigest)

const forbiddenLedger = newLedger()
const forbiddenPort = syntheticPort(directScenario.results, forbiddenLedger)
forbiddenPort.remove = async () => { forbiddenLedger.remove += 1 }
const forbidden = await CollectWorktreeGcPhase1InventoryV1(directScenario.input, forbiddenPort)
assert.equal(forbidden.failure_code, 'input_invalid')
assert.equal(forbiddenLedger.read_calls.length, 0)
assert.equal(forbiddenLedger.remove, 0)

const failedReadScenario = makeScenario()
const failedReadPort = syntheticPort(failedReadScenario.results, newLedger())
failedReadPort.read_worktree_porcelain_z = async () => { throw new Error('synthetic unavailable') }
const failedRead = await CollectWorktreeGcPhase1InventoryV1(failedReadScenario.input, failedReadPort)
assert.equal(failedRead.failure_code, 'porcelain_observation_unavailable')
assert.equal(failedRead.artifact_bytes_utf8, undefined)

const owner = await RunWorktreeGcPhase1ReadOnlyInventoryV1(directScenario.input, { readOnlyPort: syntheticPort(directScenario.results, newLedger()) })
assert.equal(owner.result, 'completed')
const parseLedger = newLedger()
const parseFailure = await MainWorktreeGcPhase1ReadOnlyInventoryCliV1([], hostFor(directScenario, parseLedger, true))
assert.equal(parseFailure.result, 'blocked')
assert.equal(parseLedger.artifact_outputs.length, 0)
assert.equal(parseLedger.read_calls.length, 0)

for (const key of ['write', 'move', 'quarantine', 'remove', 'delete', 'prune', 'branch_ref', 'network']) {
  assert.equal(directLedger[key], 0, `${key} remains zero`)
}

console.log(JSON.stringify({
  result: 'PASS', focused_cases: 61, classification_branches: classificationCases.length,
  retained_rows: ['WGC-003', 'WGC-004', 'WGC-037', 'WGC-039', 'WGC-042', 'WGC-045'],
  lifecycle_cases: ['exact_ref_chain', 'revoked_non_protecting', 'mismatched_authority_ref_rejected'],
  read_only_port_calls: directLedger.read_calls.length,
  artifact_emissions: directLedger.artifact_outputs.length,
  provenance_records: 1, deep_immutability: 'PASS',
  mutation_count: 0, write: 0, move: 0, quarantine: 0, remove: 0, delete: 0,
  prune: 0, branch_ref: 0, network: 0, synthetic_only: true,
  correction_execution_head: EXECUTION_HEAD,
}))
