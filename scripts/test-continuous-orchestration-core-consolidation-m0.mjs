import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = dirname(scriptDir)
const fixturePath = join(scriptDir, 'fixtures', 'continuous-orchestration-core-consolidation-m0-v1.json')
const artifact = JSON.parse(readFileSync(fixturePath, 'utf8'))
const utf8Compare = (left, right) => Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'))
const sorted = (values) => [...values].sort(utf8Compare)
const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex')

function jcs(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('JCS numbers must be finite')
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) return `[${value.map(jcs).join(',')}]`
  if (typeof value === 'object') {
    return `{${Object.keys(value).sort(utf8Compare).map((key) => `${JSON.stringify(key)}:${jcs(value[key])}`).join(',')}}`
  }
  throw new TypeError(`unsupported JCS value: ${typeof value}`)
}

const objectAt = (root, tokens) => tokens.reduce((node, token) => node[token], root)
const displayPath = (tokens) => tokens.length === 0 ? '/' : `/${tokens.join('/')}`
const requireString = (value, path) => assert.equal(typeof value === 'string' && value.length > 0, true, `${path}: non-empty string`)
const requireBoolean = (value, path) => assert.equal(typeof value, 'boolean', `${path}: boolean`)
const requireArray = (value, path) => assert.equal(Array.isArray(value), true, `${path}: array`)

function validateInventory(value, { captureClosedObjects = false } = {}) {
  const closedObjects = []
  const exact = (node, keys, tokens) => {
    assert.equal(node !== null && typeof node === 'object' && !Array.isArray(node), true, `${displayPath(tokens)}: object`)
    const actual = Object.keys(node).sort(utf8Compare)
    const expected = sorted(keys)
    const unknown = actual.filter((key) => !expected.includes(key))
    const missing = expected.filter((key) => !actual.includes(key))
    assert.deepEqual(unknown, [], `${displayPath(tokens)}: unknown_field`)
    assert.deepEqual(missing, [], `${displayPath(tokens)}: missing_required_field`)
    if (captureClosedObjects) closedObjects.push({ tokens: [...tokens], keys: expected })
  }
  const orderedUnique = (rows, key, path, { allowEmpty = false } = {}) => {
    requireArray(rows, path)
    if (!allowEmpty) assert.ok(rows.length > 0, `${path}: non-empty ordered set`)
    const identities = rows.map(key)
    assert.equal(new Set(identities).size, identities.length, `${path}: duplicate_set_member`)
    assert.deepEqual(identities, sorted(identities), `${path}: noncanonical_set_order`)
  }
  const stringSet = (rows, path, options) => {
    orderedUnique(rows, (entry) => entry, path, options)
    for (let index = 0; index < rows.length; index += 1) requireString(rows[index], `${path}/${index}`)
  }

  exact(value, [
    'schema_version', 'authority_main_sha', 'authority_blob_bindings', 'owner_registry',
    'field_writer_reader_map', 'branch_reason_stop_matrix', 'test_owner_map',
    'compatibility_checkpoint', 'inventory_digest',
  ], [])
  assert.equal(value.schema_version, 'continuous-orchestration-core-consolidation-m0-v1')
  assert.match(value.authority_main_sha, /^[0-9a-f]{40}$/)
  assert.match(value.inventory_digest, /^[0-9a-f]{64}$/)

  orderedUnique(value.authority_blob_bindings, (row) => row.path, '/authority_blob_bindings')
  for (let index = 0; index < value.authority_blob_bindings.length; index += 1) {
    const row = value.authority_blob_bindings[index]
    exact(row, ['path', 'blob_sha'], ['authority_blob_bindings', index])
    requireString(row.path, `/authority_blob_bindings/${index}/path`)
    assert.match(row.blob_sha, /^[0-9a-f]{40}$/)
  }

  orderedUnique(value.owner_registry, (row) => row.owner_id, '/owner_registry')
  for (let index = 0; index < value.owner_registry.length; index += 1) {
    const row = value.owner_registry[index]
    exact(row, ['owner_id', 'authority_class', 'canonical_owner', 'owned_meaning'], ['owner_registry', index])
    assert.match(row.owner_id, /^OWN-[A-Z]+$/)
    requireString(row.authority_class, `/owner_registry/${index}/authority_class`)
    requireString(row.canonical_owner, `/owner_registry/${index}/canonical_owner`)
    requireString(row.owned_meaning, `/owner_registry/${index}/owned_meaning`)
  }
  const registeredOwnerIds = new Set(value.owner_registry.map((row) => row.owner_id))

  orderedUnique(value.field_writer_reader_map, (row) => row.map_id, '/field_writer_reader_map')
  for (let index = 0; index < value.field_writer_reader_map.length; index += 1) {
    const row = value.field_writer_reader_map[index]
    exact(row, [
      'map_id', 'selector', 'surface_status', 'semantic_owner', 'semantic_owner_ids',
      'sole_mechanical_writer', 'mechanical_writer_owner_ids', 'current_readers',
      'reader_owner_ids', 'closed_key_sets', 'discriminant_sets',
    ], ['field_writer_reader_map', index])
    assert.match(row.map_id, /^FWR-(0[1-9]|1[0-6])$/)
    requireString(row.selector, `/field_writer_reader_map/${index}/selector`)
    assert.ok(['canonical_record', 'current', 'future_candidate'].includes(row.surface_status))
    requireString(row.semantic_owner, `/field_writer_reader_map/${index}/semantic_owner`)
    stringSet(row.semantic_owner_ids, `/field_writer_reader_map/${index}/semantic_owner_ids`)
    requireString(row.sole_mechanical_writer, `/field_writer_reader_map/${index}/sole_mechanical_writer`)
    stringSet(row.mechanical_writer_owner_ids, `/field_writer_reader_map/${index}/mechanical_writer_owner_ids`)
    stringSet(row.current_readers, `/field_writer_reader_map/${index}/current_readers`)
    stringSet(row.reader_owner_ids, `/field_writer_reader_map/${index}/reader_owner_ids`, { allowEmpty: true })
    for (const ownerId of [...row.semantic_owner_ids, ...row.mechanical_writer_owner_ids, ...row.reader_owner_ids]) {
      assert.ok(registeredOwnerIds.has(ownerId), `/field_writer_reader_map/${index}: unresolved owner ${ownerId}`)
    }
    orderedUnique(row.closed_key_sets, (entry) => entry.object_selector, `/field_writer_reader_map/${index}/closed_key_sets`, { allowEmpty: true })
    for (let keyIndex = 0; keyIndex < row.closed_key_sets.length; keyIndex += 1) {
      const keySet = row.closed_key_sets[keyIndex]
      exact(keySet, ['object_selector', 'keys'], ['field_writer_reader_map', index, 'closed_key_sets', keyIndex])
      requireString(keySet.object_selector, `/field_writer_reader_map/${index}/closed_key_sets/${keyIndex}/object_selector`)
      stringSet(keySet.keys, `/field_writer_reader_map/${index}/closed_key_sets/${keyIndex}/keys`)
    }
    orderedUnique(row.discriminant_sets, (entry) => entry.selector, `/field_writer_reader_map/${index}/discriminant_sets`, { allowEmpty: true })
    for (let discriminatorIndex = 0; discriminatorIndex < row.discriminant_sets.length; discriminatorIndex += 1) {
      const discriminator = row.discriminant_sets[discriminatorIndex]
      exact(discriminator, ['selector', 'values'], ['field_writer_reader_map', index, 'discriminant_sets', discriminatorIndex])
      requireString(discriminator.selector, `/field_writer_reader_map/${index}/discriminant_sets/${discriminatorIndex}/selector`)
      stringSet(discriminator.values, `/field_writer_reader_map/${index}/discriminant_sets/${discriminatorIndex}/values`)
    }
  }

  const matrix = value.branch_reason_stop_matrix
  exact(matrix, ['agp_result_surface', 'compatibility_surfaces', 'cov_continuation_surface'], ['branch_reason_stop_matrix'])
  orderedUnique(matrix.agp_result_surface, (row) => row.branch, '/branch_reason_stop_matrix/agp_result_surface')
  for (let index = 0; index < matrix.agp_result_surface.length; index += 1) {
    const row = matrix.agp_result_surface[index]
    exact(row, ['branch', 'reason_field', 'reasons', 'stop_class'], ['branch_reason_stop_matrix', 'agp_result_surface', index])
    requireString(row.branch, `/branch_reason_stop_matrix/agp_result_surface/${index}/branch`)
    requireString(row.reason_field, `/branch_reason_stop_matrix/agp_result_surface/${index}/reason_field`)
    stringSet(row.reasons, `/branch_reason_stop_matrix/agp_result_surface/${index}/reasons`)
    requireString(row.stop_class, `/branch_reason_stop_matrix/agp_result_surface/${index}/stop_class`)
  }
  orderedUnique(matrix.cov_continuation_surface, (row) => row.branch, '/branch_reason_stop_matrix/cov_continuation_surface')
  for (let index = 0; index < matrix.cov_continuation_surface.length; index += 1) {
    const row = matrix.cov_continuation_surface[index]
    exact(row, ['boundary', 'branch', 'controller_conditions', 'reason_codes', 'recovery_event_types', 'terminal_stop_reasons'], ['branch_reason_stop_matrix', 'cov_continuation_surface', index])
    requireString(row.branch, `/branch_reason_stop_matrix/cov_continuation_surface/${index}/branch`)
    stringSet(row.controller_conditions, `/branch_reason_stop_matrix/cov_continuation_surface/${index}/controller_conditions`, { allowEmpty: true })
    stringSet(row.reason_codes, `/branch_reason_stop_matrix/cov_continuation_surface/${index}/reason_codes`)
    stringSet(row.recovery_event_types, `/branch_reason_stop_matrix/cov_continuation_surface/${index}/recovery_event_types`, { allowEmpty: true })
    stringSet(row.terminal_stop_reasons, `/branch_reason_stop_matrix/cov_continuation_surface/${index}/terminal_stop_reasons`, { allowEmpty: true })
    requireString(row.boundary, `/branch_reason_stop_matrix/cov_continuation_surface/${index}/boundary`)
  }
  exact(matrix.compatibility_surfaces, ['event_types', 'gsp_hook_values', 'invalidation_classes', 'progression_evaluator_kinds', 'protected_actions'], ['branch_reason_stop_matrix', 'compatibility_surfaces'])
  for (const key of Object.keys(matrix.compatibility_surfaces)) stringSet(matrix.compatibility_surfaces[key], `/branch_reason_stop_matrix/compatibility_surfaces/${key}`)

  orderedUnique(value.test_owner_map, (row) => row.test_path, '/test_owner_map')
  for (let index = 0; index < value.test_owner_map.length; index += 1) {
    const row = value.test_owner_map[index]
    exact(row, ['coverage', 'primary_owner_ids', 'semantic_authority', 'test_path'], ['test_owner_map', index])
    requireString(row.test_path, `/test_owner_map/${index}/test_path`)
    stringSet(row.primary_owner_ids, `/test_owner_map/${index}/primary_owner_ids`, { allowEmpty: true })
    requireString(row.coverage, `/test_owner_map/${index}/coverage`)
    requireBoolean(row.semantic_authority, `/test_owner_map/${index}/semantic_authority`)
    for (const ownerId of row.primary_owner_ids) assert.ok(registeredOwnerIds.has(ownerId), `/test_owner_map/${index}: unresolved owner ${ownerId}`)
  }

  const checkpoint = value.compatibility_checkpoint
  exact(checkpoint, [
    'checkpoint_id', 'required_conditions', 'changed_paths_allowlist', 'unchanged_path_classes',
    'runtime_behavior_change', 'public_export_or_type_change', 'canonical_record_format_change',
    'role_vocabulary_change', 'protected_action_boundary_change', 'completion_authority_change',
    'repair_limit_change', 'route_scope_change', 'gsp_sole_writer_change', 'issue_209_state',
    'rollback_unit', 'm1_gate',
  ], ['compatibility_checkpoint'])
  assert.equal(checkpoint.checkpoint_id, 'M0-COMPATIBILITY-CHECKPOINT')
  orderedUnique(checkpoint.required_conditions, (row) => row.condition_id, '/compatibility_checkpoint/required_conditions')
  for (let index = 0; index < checkpoint.required_conditions.length; index += 1) {
    const row = checkpoint.required_conditions[index]
    exact(row, ['condition_id', 'requirement'], ['compatibility_checkpoint', 'required_conditions', index])
    assert.match(row.condition_id, /^CC-0[1-7]$/)
    requireString(row.requirement, `/compatibility_checkpoint/required_conditions/${index}/requirement`)
  }
  stringSet(checkpoint.changed_paths_allowlist, '/compatibility_checkpoint/changed_paths_allowlist')
  stringSet(checkpoint.unchanged_path_classes, '/compatibility_checkpoint/unchanged_path_classes')
  stringSet(checkpoint.rollback_unit, '/compatibility_checkpoint/rollback_unit')
  for (const field of [
    'runtime_behavior_change', 'public_export_or_type_change', 'canonical_record_format_change',
    'role_vocabulary_change', 'protected_action_boundary_change', 'completion_authority_change',
    'repair_limit_change', 'route_scope_change', 'gsp_sole_writer_change',
  ]) requireBoolean(checkpoint[field], `/compatibility_checkpoint/${field}`)
  assert.equal(checkpoint.issue_209_state, 'paused')
  requireString(checkpoint.m1_gate, '/compatibility_checkpoint/m1_gate')
  return closedObjects
}

const EXPECTED_AUTHORITY_BINDINGS = {
  'docs/automation/23-automatic-gate-progression-contract.md': '4c463b93838b14c6401396346593020674c88747',
  'docs/automation/24-pure-automatic-gate-progression-evaluator-design.md': 'f0f5747f98171fbb08dbc1d0bbf35cc4f926e5be',
  'docs/team/13-shared-role-execution-contract.md': '29a99ba093ed503233d5c4227f30891e0bd976d9',
  'docs/team/14-review-execution-contract.md': '711a049731716fe7c82ca001ac7fc0e500f36671',
  'scripts/fixtures/continuous-orchestration-v1.json': 'afe2b2f58fbac61d7a4231c171cdc2e9aeeae0da',
  'scripts/test-continuous-orchestration.mjs': 'f7b2694b47041f872bf651b70673b4eb1e633304',
  'src/architecture-repair-loop/index.ts': '06ab8e78621604492d395c633d82ca6eb7a865a8',
  'src/automatic-gate-progression/index.ts': '0c93f16fee741f4dd49457249c7c79147afcbc4d',
  'src/continuous-orchestration/index.ts': '396ae3cce1f5bbb487d7154872f1b3883f391741',
  'src/gate-status-publisher/index.ts': '7d9b8ac4febf2e38af2b1daf962dee4bf6939e40',
}

const EXPECTED_OWNER_IDS = ['OWN-AGP', 'OWN-ARL', 'OWN-CAND', 'OWN-COMP', 'OWN-COV', 'OWN-EXEC', 'OWN-GSP', 'OWN-IL', 'OWN-PO', 'OWN-POLICY']
const EXPECTED_FWR = [
  ['FWR-01', 'AutomaticGateProgressionEvaluationInputV2::**', 'COV collector/admitted-input adapter', 23],
  ['FWR-02', 'AutomaticGateProgressionEvaluationResultV2::**', 'pure AGP evaluator', 6],
  ['FWR-03', 'GenericProgressRunnerProfilesV1::**', 'Task/profile assembler', 11],
  ['FWR-04', 'ContinuousOrchestrationEventV1::**', 'COV event assembler/admission boundary', 1],
  ['FWR-05', 'ContinuousOrchestrationStateV1.authority_snapshot::**', 'COV collector/admission boundary', 1],
  ['FWR-06', 'ContinuousOrchestrationStateV1::{state,canonical_refs,event_cursor,replay_ledger,audit_chain,pending_transport,projection_state}', 'COV reducer plus successful CAS', 8],
  ['FWR-07', 'ContinuousOrchestrationStateV1::{finding_ledger,loop_counters,semantic_counter_epoch}', 'COV reducer plus successful CAS', 6],
  ['FWR-08', 'ContinuationDecisionV1::**', 'pure COV reducer', 10],
  ['FWR-09', 'ArchitectureRepairMaterializationResultV8::**', 'ARL materializer', 5],
  ['FWR-10', 'Gate Status projection/body/receipt::**', 'GSP atomic publisher/receipt store', 10],
  ['FWR-11', 'CompletionEvidenceCandidateV1::**', 'COV completion-candidate assembler', 0],
  ['FWR-12', 'Completion Decision::**', 'Independent Completion Assessor', 1],
  ['FWR-13', 'CandidateAuthorityRefV1 / Aggregate Candidate Binding::**', 'assigned Candidate producer / Publication Manager', 0],
  ['FWR-14', 'Product Owner Approval::**', 'Product Owner canonical record', 1],
  ['FWR-15', 'protected action completion::**', 'one-action executor', 1],
  ['FWR-16', 'canonical Dispatch / Task Completion Result::**', 'Integrated Lead', 2],
]

const EXPECTED_AGP_REASONS = {
  invalidate_approval: ['base_or_state_drift', 'blocking_recurrence', 'check_drift', 'consumed', 'expired', 'head_drift'],
  no_transition: ['no_declared_transition'],
  recommend_next_role: ['admitted_legal_transition'],
  require_gate_status_update: ['conflicting', 'historical_at_prior_head', 'missing', 'stale'],
  stop: ['ambiguous_role_ownership', 'authority_drift', 'blocking_finding_recurrence', 'canonical_action_conflict', 'canonical_conflict', 'fresh_evidence_unavailable', 'malformed_or_unknown_input', 'required_context_health_unavailable', 'transition_not_terminal_or_permitted'],
  wait_for_protected_action: ['approval_missing_or_not_current'],
}

const EXPECTED_COV_REASONS = {
  await_external_recovery: ['external_recovery_required'],
  await_protected_action: ['protected_action_completion_required'],
  complete_task_candidate: ['completion_evidence_ready'],
  dispatch_role: ['declared_next_role'],
  invalidate_authority: ['authority_drift'],
  no_transition: ['no_declared_transition'],
  request_independent_review: ['independent_review_required'],
  request_metadata_sync: ['metadata_projection_mismatch'],
  request_product_owner_decision: ['product_decision_required'],
  stop: ['ambiguous_role_ownership', 'architecture_gap', 'canonical_conflict', 'repeated_finding_failure', 'repeated_transition_cycle'],
}

const git = (...args) => execFileSync('git', ['-c', `safe.directory=${repoRoot.replaceAll('\\', '/')}`, '-C', repoRoot, ...args], { encoding: 'utf8' }).trim()
const withoutDigest = structuredClone(artifact)
delete withoutDigest.inventory_digest
const beforeValidation = jcs(artifact)
const closedObjects = validateInventory(artifact, { captureClosedObjects: true })
assert.equal(jcs(artifact), beforeValidation, 'validation must not mutate the inventory')
assert.equal(artifact.inventory_digest, sha256(jcs(withoutDigest)), 'inventory_digest must bind the JCS projection with inventory_digest omitted')
assert.deepEqual(Object.fromEntries(artifact.authority_blob_bindings.map((row) => [row.path, row.blob_sha])), EXPECTED_AUTHORITY_BINDINGS)
assert.deepEqual(artifact.owner_registry.map((row) => row.owner_id), EXPECTED_OWNER_IDS)

assert.equal(artifact.field_writer_reader_map.length, 16)
for (let index = 0; index < EXPECTED_FWR.length; index += 1) {
  const [mapId, selector, writer, closedKeySetCount] = EXPECTED_FWR[index]
  const row = artifact.field_writer_reader_map[index]
  assert.equal(row.map_id, mapId)
  assert.equal(row.selector, selector)
  assert.equal(row.sole_mechanical_writer, writer)
  assert.equal(row.closed_key_sets.length, closedKeySetCount)
}
const ownerIds = new Set(EXPECTED_OWNER_IDS)
for (const row of artifact.field_writer_reader_map) {
  assert.equal(typeof row.semantic_owner, 'string', `${row.map_id}: exactly one semantic owner rule`)
  assert.equal(Array.isArray(row.sole_mechanical_writer), false, `${row.map_id}: exactly one mechanical writer class`)
  for (const ownerId of [...row.semantic_owner_ids, ...row.mechanical_writer_owner_ids, ...row.reader_owner_ids]) assert.ok(ownerIds.has(ownerId), `${row.map_id}: unresolved owner ${ownerId}`)
}
for (const row of artifact.test_owner_map) for (const ownerId of row.primary_owner_ids) assert.ok(ownerIds.has(ownerId), `${row.test_path}: unresolved owner ${ownerId}`)

assert.deepEqual(Object.fromEntries(artifact.branch_reason_stop_matrix.agp_result_surface.map((row) => [row.branch, row.reasons])), EXPECTED_AGP_REASONS)
assert.deepEqual(Object.fromEntries(artifact.branch_reason_stop_matrix.cov_continuation_surface.map((row) => [row.branch, row.reason_codes])), EXPECTED_COV_REASONS)

const agpSource = readFileSync(join(repoRoot, 'src', 'automatic-gate-progression', 'index.ts'), 'utf8')
const covSource = readFileSync(join(repoRoot, 'src', 'continuous-orchestration', 'index.ts'), 'utf8')
const arlSource = readFileSync(join(repoRoot, 'src', 'architecture-repair-loop', 'index.ts'), 'utf8')
const gspSource = readFileSync(join(repoRoot, 'src', 'gate-status-publisher', 'index.ts'), 'utf8')
const sourceByFwr = new Map([
  ['FWR-01', agpSource], ['FWR-02', agpSource], ['FWR-03', covSource], ['FWR-04', covSource],
  ['FWR-05', covSource], ['FWR-06', covSource], ['FWR-07', covSource], ['FWR-08', covSource],
  ['FWR-09', arlSource], ['FWR-10', `${gspSource}\n${covSource}`],
])
for (const row of artifact.field_writer_reader_map) {
  const source = sourceByFwr.get(row.map_id)
  if (!source) continue
  for (const keySet of row.closed_key_sets) for (const key of keySet.keys) assert.ok(source.includes(key), `${row.map_id} missing bound source key ${key}`)
  for (const discriminant of row.discriminant_sets) for (const value of discriminant.values) assert.ok(source.includes(value.split('/')[0]), `${row.map_id} missing bound source discriminant ${value}`)
}

const extractConstSet = (source, name) => {
  const match = source.match(new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\] as const`))
  assert.ok(match, `missing exported const set ${name}`)
  return sorted([...match[1].matchAll(/'([^']+)'/g)].map((entry) => entry[1]))
}
assert.deepEqual(artifact.branch_reason_stop_matrix.compatibility_surfaces.event_types, extractConstSet(covSource, 'eventTypes'))
const expectedGspHooks = ['not_required', 'required_after_transition', 'required_before_transition']
assert.deepEqual(artifact.branch_reason_stop_matrix.compatibility_surfaces.gsp_hook_values, expectedGspHooks)
for (const hook of expectedGspHooks) assert.ok(covSource.includes(`'${hook}'`), `missing GSP hook ${hook}`)
for (const [branch, reasons] of Object.entries(EXPECTED_AGP_REASONS)) {
  assert.ok(agpSource.includes(`'${branch}'`), `missing AGP branch ${branch}`)
  for (const reason of reasons.filter((value) => value !== 'admitted_legal_transition')) assert.ok(agpSource.includes(`'${reason}'`), `missing AGP reason ${reason}`)
}
for (const [branch, reasons] of Object.entries(EXPECTED_COV_REASONS)) {
  assert.ok(covSource.includes(`'${branch}'`), `missing COV branch ${branch}`)
  for (const reason of reasons) assert.ok(covSource.includes(`'${reason}'`), `missing COV reason ${reason}`)
}

assert.equal(git('rev-parse', 'HEAD'), artifact.authority_main_sha, 'working HEAD must remain at exact authority main')
assert.equal(git('branch', '--show-current'), 'codex/issue-221-core-consolidation', 'task isolation branch')
for (const binding of artifact.authority_blob_bindings) assert.equal(git('rev-parse', `${artifact.authority_main_sha}:${binding.path}`), binding.blob_sha, `authority blob ${binding.path}`)

const statusOutput = execFileSync('git', ['-c', `safe.directory=${repoRoot.replaceAll('\\', '/')}`, '-C', repoRoot, 'status', '--porcelain=v1', '-z', '--untracked-files=all'], { encoding: 'utf8' })
const changedPaths = sorted(statusOutput.split('\0').filter(Boolean).map((entry) => entry.slice(3).replaceAll('\\', '/')))
assert.deepEqual(changedPaths, artifact.compatibility_checkpoint.changed_paths_allowlist, 'exact changed-file allowlist')
assert.equal(git('diff', '--cached', '--name-only'), '', 'staged changes must remain zero')
assert.equal(git('diff', '--name-only', artifact.authority_main_sha, '--', '.'), '', 'no tracked pre-existing blob may change')
assert.deepEqual(artifact.compatibility_checkpoint.rollback_unit, artifact.compatibility_checkpoint.changed_paths_allowlist)
for (const field of ['runtime_behavior_change', 'public_export_or_type_change', 'canonical_record_format_change', 'role_vocabulary_change', 'protected_action_boundary_change', 'completion_authority_change', 'repair_limit_change', 'route_scope_change', 'gsp_sole_writer_change']) assert.equal(artifact.compatibility_checkpoint[field], false, `${field} must remain false`)
assert.equal(artifact.compatibility_checkpoint.issue_209_state, 'paused')
assert.equal(artifact.compatibility_checkpoint.required_conditions.length, 7)
for (const row of artifact.test_owner_map) assert.ok(existsSync(join(repoRoot, row.test_path)), `mapped test path must exist: ${row.test_path}`)

for (const { tokens } of closedObjects) {
  const withUnknown = structuredClone(artifact)
  objectAt(withUnknown, tokens).__unknown_m0 = true
  assert.throws(() => validateInventory(withUnknown), /unknown_field/, `${displayPath(tokens)} unknown-field rejection`)
}
for (const { tokens, keys } of closedObjects) {
  const withMissing = structuredClone(artifact)
  delete objectAt(withMissing, tokens)[keys[0]]
  assert.throws(() => validateInventory(withMissing), undefined, `${displayPath(tokens)} missing-field rejection`)
}
const duplicateOwner = structuredClone(artifact)
duplicateOwner.owner_registry.splice(1, 0, structuredClone(duplicateOwner.owner_registry[0]))
assert.throws(() => validateInventory(duplicateOwner), /duplicate_set_member|noncanonical_set_order/)
const unresolvedOwner = structuredClone(artifact)
unresolvedOwner.field_writer_reader_map[0].reader_owner_ids = ['OWN-UNKNOWN']
assert.throws(() => validateInventory(unresolvedOwner), /unresolved owner/, 'unresolved owner negative case')
const reorderedOwnerSet = structuredClone(artifact)
reorderedOwnerSet.owner_registry.reverse()
assert.throws(() => validateInventory(reorderedOwnerSet), /noncanonical_set_order/)
const badDigest = structuredClone(artifact)
badDigest.inventory_digest = 'f'.repeat(64)
const badProjection = structuredClone(badDigest)
delete badProjection.inventory_digest
assert.notEqual(badDigest.inventory_digest, sha256(jcs(badProjection)), 'digest mismatch negative case')
assert.equal(jcs({ a: 1, b: 2 }), jcs({ b: 2, a: 1 }), 'JCS object key ordering')

console.log(JSON.stringify({
  result: 'PASS',
  authority_main_sha: artifact.authority_main_sha,
  inventory_digest: artifact.inventory_digest,
  authority_blob_bindings: artifact.authority_blob_bindings.length,
  owner_registry_entries: artifact.owner_registry.length,
  field_writer_reader_rows: artifact.field_writer_reader_map.length,
  agp_branches: artifact.branch_reason_stop_matrix.agp_result_surface.length,
  cov_branches: artifact.branch_reason_stop_matrix.cov_continuation_surface.length,
  test_owner_rows: artifact.test_owner_map.length,
  closed_object_unknown_cases: closedObjects.length,
  closed_object_missing_cases: closedObjects.length,
  compatibility_checkpoint: 'PASS',
  changed_paths: changedPaths.map((path) => relative(repoRoot, join(repoRoot, path)).replaceAll('\\', '/')),
}))
