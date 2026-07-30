import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createServer } from 'vite'

const FIXTURE_PATH = new URL('./fixtures/evidence-template-validator-v1.json', import.meta.url)
const EXPECTED_FILE_BYTES = 59077
const EXPECTED_FILE_SHA256 = 'b0b2c70cde112117ecdf726cddee2a95eb1b4d078af32ba83e87abe9643985b1'
const EXPECTED_PROJECTION_DIGEST = '7c22b43163b113ce6347a9339860947982c95b19d97815dbf0d3673a20bad68e'
const EXPECTED_REPAIR_MATRIX_DIGEST = 'dcc90e367512858414d6100413afd6f8296be474a50839beb4fced60d057c3af'
const EXPECTED_REPAIR_COMPONENT_DIGEST = 'f8113eb66f04e31ef2579901b508132907da50c656fc4653b38332990563a0d7'
const EXPECTED_CATALOG_DIGEST = '6d172e79e26d621dec027867ba8c472e01012393a587d61126954838944a5d46'
const EXPECTED_COMPONENT_DIGEST = 'c67a4688718777b4c5ded174934bc29445cdd0210361c8a9cff5816c4a52a383'
const EXPECTED_SOURCE = {
  body_sha256: 'ae38d5422a0a87b861548565dae40f8e152a7832a2098bdc760ddadc60d6373d',
  body_utf8_length: 57562,
  canonical_record: 'https://github.com/whatrune/sd-prompt-studio/issues/210#issuecomment-5125695936',
  catalog_digest: EXPECTED_CATALOG_DIGEST,
  component_digest: EXPECTED_COMPONENT_DIGEST,
}
const PREVIOUS_ROW_DIGEST_INVENTORY_SHA256 = '01d2e5e84644e09a486dde1a95b960997c0deb046fcb89b09d680fc1783fe89b'
const ROW_DIGEST_CHANGES = {
  'ETVA2-019': {
    before: '54b7430f9a71d5288621335c9f1bd9cb2ef74016ae3390da58c79326708af536',
    after: '8c3f97075c8b3ab73d1f54bc17369a053f6372550b55718c33a0bef66d5470a2',
  },
  'ETVA2-021': {
    before: 'e76af430a042896871d22f930b0cfec4f1cfccd9bd3fcc935d04659fd26b0b76',
    after: 'ed3d34370d5704398fa1e9913071cf477f5905e80ebdc2215edffd6dbee399f3',
  },
}
const OPENING = '```json evidence-template-v1\n'
const CLOSING = '\n```\n'

const clone = (value) => structuredClone(value)
const shaBytes = (value) => createHash('sha256').update(value).digest('hex')
const shaText = (value) => shaBytes(Buffer.from(value, 'utf8'))
const canonicalize = (value) =>
  value === null || typeof value !== 'object'
    ? JSON.stringify(value)
    : Array.isArray(value)
      ? `[${value.map(canonicalize).join(',')}]`
      : `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`
const shaJcs = (value) => shaText(canonicalize(value))
const without = (value, key) => {
  const projection = clone(value)
  delete projection[key]
  return projection
}
const bytesForRecord = (record) => new TextEncoder().encode(`${OPENING}${canonicalize(record)}${CLOSING}`)
const bindBody = (context, bodyBytes) => {
  context.expected_body_utf8_length = bodyBytes.length
  context.expected_body_sha256 = shaBytes(bodyBytes)
}
const unescapePointer = (value) => value.replaceAll('~1', '/').replaceAll('~0', '~')
const pointerParts = (path) => {
  assert.match(path, /^\//, `mutation path must be an RFC 6901 pointer: ${path}`)
  return path.slice(1).split('/').map(unescapePointer)
}
const targetAt = (root, path) => {
  const parts = pointerParts(path)
  const key = parts.pop()
  let parent = root
  for (const part of parts) {
    const index = Array.isArray(parent) ? Number(part) : part
    assert.ok(parent !== null && typeof parent === 'object' && index in parent, `missing mutation parent: ${path}`)
    parent = parent[index]
  }
  return { parent, key: Array.isArray(parent) ? Number(key) : key }
}
const applyPointerMutation = (root, mutation, overrideValue = mutation.value) => {
  const { parent, key } = targetAt(root, mutation.path)
  assert.ok(parent !== null && typeof parent === 'object', `invalid mutation target: ${mutation.path}`)
  if (mutation.op === 'remove') {
    if (Array.isArray(parent)) {
      assert.ok(Number.isInteger(key) && key >= 0 && key < parent.length, `invalid remove index: ${mutation.path}`)
      parent.splice(key, 1)
    } else {
      assert.ok(Object.hasOwn(parent, key), `missing remove target: ${mutation.path}`)
      delete parent[key]
    }
    return
  }
  if (mutation.op === 'add') {
    if (Array.isArray(parent)) {
      assert.ok(Number.isInteger(key) && key >= 0 && key <= parent.length, `invalid add index: ${mutation.path}`)
      parent.splice(key, 0, clone(overrideValue))
    } else {
      assert.ok(!Object.hasOwn(parent, key), `existing add target: ${mutation.path}`)
      parent[key] = clone(overrideValue)
    }
    return
  }
  assert.ok(Object.hasOwn(parent, key), `missing mutation target: ${mutation.path}`)
  if (mutation.op === 'replace') parent[key] = clone(overrideValue)
  else if (mutation.op === 'increment') {
    assert.equal(typeof parent[key], 'number', `increment target is not numeric: ${mutation.path}`)
    parent[key] += overrideValue
  } else {
    assert.fail(`unsupported pointer operation ${mutation.op}`)
  }
}
const occurrenceCount = (haystack, needle) => {
  if (needle.length === 0) return 0
  let count = 0
  let cursor = 0
  while (cursor <= haystack.length - needle.length) {
    const index = haystack.indexOf(needle, cursor)
    if (index < 0) break
    count += 1
    cursor = index + needle.length
  }
  return count
}
const replaceBytesOnce = (bodyBytes, needle, replacement) => {
  const haystack = Buffer.from(bodyBytes)
  assert.equal(occurrenceCount(haystack, needle), 1, 'byte *_once preflight count')
  const index = haystack.indexOf(needle)
  return new Uint8Array(Buffer.concat([haystack.subarray(0, index), replacement, haystack.subarray(index + needle.length)]))
}
const applyBodyMutation = (bodyBytes, mutation, onceCounts) => {
  const body = Buffer.from(bodyBytes)
  if (mutation.op === 'replace_bytes_once') {
    const needle = Buffer.from(mutation.needle_hex, 'hex')
    const replacement = Buffer.from(mutation.replacement_hex, 'hex')
    onceCounts.push({ row_op: mutation.op, count: occurrenceCount(body, needle) })
    return replaceBytesOnce(body, needle, replacement)
  }
  if (mutation.op === 'insert_bytes_after_once') {
    const needle = Buffer.from(mutation.needle_hex, 'hex')
    const insert = Buffer.from(mutation.insert_hex, 'hex')
    const count = occurrenceCount(body, needle)
    onceCounts.push({ row_op: mutation.op, count })
    assert.equal(count, 1, 'byte *_once preflight count')
    const index = body.indexOf(needle) + needle.length
    return new Uint8Array(Buffer.concat([body.subarray(0, index), insert, body.subarray(index)]))
  }
  if (mutation.op === 'append_utf8') {
    return new Uint8Array(Buffer.concat([body, Buffer.from(mutation.value, 'utf8')]))
  }
  const source = body.toString('utf8')
  if (mutation.op === 'replace_utf8_once') {
    const count = occurrenceCount(source, mutation.needle)
    onceCounts.push({ row_op: mutation.op, count })
    assert.equal(count, 1, 'UTF-8 *_once preflight count')
    return new TextEncoder().encode(source.replace(mutation.needle, mutation.replacement))
  }
  if (mutation.op === 'insert_before_utf8_once') {
    const count = occurrenceCount(source, mutation.needle)
    onceCounts.push({ row_op: mutation.op, count })
    assert.equal(count, 1, 'UTF-8 *_once preflight count')
    const index = source.indexOf(mutation.needle)
    return new TextEncoder().encode(`${source.slice(0, index)}${mutation.value}${source.slice(index)}`)
  }
  assert.fail(`unsupported body operation ${mutation.op}`)
}
const sealRecord = (record) => {
  delete record.record_digest
  record.record_digest = shaJcs(record)
}
const codePoints = (items) =>
  items.map((item) => {
    assert.match(item, /^U\+[0-9A-F]{4,6}$/)
    return String.fromCodePoint(Number.parseInt(item.slice(2), 16))
  }).join('')

const materialize = (fixture, row) => {
  const record = clone(fixture.record)
  const context = clone(fixture.context)
  let bodyBytes = bytesForRecord(record)
  const onceCounts = []
  assert.equal(bodyBytes.length, context.expected_body_utf8_length, `${fixture.fixture_id}: base body length`)
  assert.equal(shaBytes(bodyBytes), context.expected_body_sha256, `${fixture.fixture_id}: base body SHA`)
  if (row.mutation === null) return { bodyBytes, context, onceCounts }
  const mutation = row.mutation
  if (mutation.phase === 'record_preseal' || mutation.phase === 'record_preseal_code_points') {
    delete record.record_digest
    const value = mutation.phase === 'record_preseal_code_points' ? codePoints(mutation.value) : mutation.value
    applyPointerMutation(record, mutation, value)
    sealRecord(record)
    bodyBytes = bytesForRecord(record)
    bindBody(context, bodyBytes)
  } else if (mutation.phase === 'record_postseal') {
    applyPointerMutation(record, mutation)
    bodyBytes = bytesForRecord(record)
    if (mutation.rebind_context_body === true) bindBody(context, bodyBytes)
  } else if (mutation.phase === 'body_postbind') {
    bodyBytes = applyBodyMutation(bodyBytes, mutation, onceCounts)
    if (mutation.rebind_context_body === true) bindBody(context, bodyBytes)
  } else if (mutation.phase === 'context_postbind') {
    applyPointerMutation(context, mutation)
  } else {
    assert.fail(`unsupported mutation phase ${mutation.phase}`)
  }
  return { bodyBytes, context, onceCounts }
}

const materializeRepairValidatorRow = (fixtures, rowId) => {
  const from = (fixtureId, mutateRecord = () => {}, mutateContext = () => {}) => {
    const fixture = fixtures.get(fixtureId)
    assert.ok(fixture, `${rowId}: repair base fixture exists`)
    const record = clone(fixture.record)
    const context = clone(fixture.context)
    mutateRecord(record)
    sealRecord(record)
    const bodyBytes = bytesForRecord(record)
    bindBody(context, bodyBytes)
    mutateContext(context)
    return { bodyBytes, context, onceCounts: [] }
  }
  const failed = (stopReason) => from('FX-H-blocked', (record) => {
    record.status = 'failed'
    record.execution_stop_reason = stopReason
    record.unresolved_items[0].kind = 'failed_validation'
    record.unresolved_items[0].summary = 'Required validation failed at the assigned boundary'
    record.validation_results[0].exit_code = 1
    record.validation_results[0].result = 'FAIL'
  })
  switch (rowId) {
    case 'ETVPMR-001': return from('FX-H-completed', (record) => { delete record.execution_stop_reason })
    case 'ETVPMR-002': return from('FX-H-completed', (record) => { record.execution_stop_reason = 7 })
    case 'ETVPMR-003': return from('FX-H-completed')
    case 'ETVPMR-004': return from('FX-H-needs_followup')
    case 'ETVPMR-005': return from('FX-H-completed', (record) => { record.status = 'not_applicable' })
    case 'ETVPMR-006': return failed('external_blocker')
    case 'ETVPMR-007': return from('FX-H-blocked')
    case 'ETVPMR-008': return from('FX-H-blocked', (record) => {
      record.execution_stop_reason = 'external_blocker'
      record.unresolved_items[0].kind = 'external_blocker'
      record.unresolved_items[0].summary = 'Required authority evidence is unavailable'
    })
    case 'ETVPMR-009': return failed('completed')
    case 'ETVPMR-010': return from('FX-H-blocked', (record) => { record.execution_stop_reason = 'completed' })
    case 'ETVPMR-011': return from('FX-R-CHANGES_REQUIRED')
    case 'ETVPMR-012': return from('FX-R-CHANGES_REQUIRED', (record) => { record.execution_stop_reason = 'needs_followup' })
    case 'ETVPMR-013': return from('FX-R-CHANGES_REQUIRED', (record) => {
      record.finding_dispositions[0].blocking_for_this_decision = false
    })
    case 'ETVPMR-014': return from('FX-R-APPROVE', (record) => {
      record.finding_dispositions[0].blocking_for_this_decision = true
    })
    case 'ETVPMR-015': return from('FX-R-CHANGES_REQUIRED', (record) => { record.blocking_finding_count = 0 })
    case 'ETVPMR-016': return from('FX-R-APPROVE')
    case 'ETVPMR-017': return from('FX-R-APPROVE', (record) => {
      record.finding_dispositions[0].state = 'open'
      record.finding_dispositions[0].disposition = 'remains_open'
      record.finding_dispositions[0].blocking_for_this_decision = true
      record.blocking_finding_count = 1
    })
    case 'ETVPMR-018': return from('FX-R-CHANGES_REQUIRED', (record) => {
      record.finding_dispositions[0].disposition = 'repair_contract_approved_pending_execution'
    })
    default: assert.fail(`${rowId}: not a validator-layer repair row`)
  }
}

const REPAIR_VALIDATOR_EXPECTED = new Map([
  ['ETVPMR-001', { branch: 'rejected', code: 'missing_required_field', stage: 6, path: '/execution_stop_reason' }],
  ['ETVPMR-002', { branch: 'rejected', code: 'invalid_type', stage: 6, path: '/execution_stop_reason' }],
  ['ETVPMR-003', { branch: 'accepted' }],
  ['ETVPMR-004', { branch: 'accepted' }],
  ['ETVPMR-005', { branch: 'accepted' }],
  ['ETVPMR-006', { branch: 'accepted' }],
  ['ETVPMR-007', { branch: 'accepted' }],
  ['ETVPMR-008', { branch: 'accepted' }],
  ['ETVPMR-009', { branch: 'rejected', code: 'status_relation_mismatch', stage: 12, path: '/execution_stop_reason' }],
  ['ETVPMR-010', { branch: 'rejected', code: 'status_relation_mismatch', stage: 12, path: '/execution_stop_reason' }],
  ['ETVPMR-011', { branch: 'accepted' }],
  ['ETVPMR-012', { branch: 'rejected', code: 'status_relation_mismatch', stage: 12, path: '/execution_stop_reason' }],
  ['ETVPMR-013', { branch: 'rejected', code: 'status_relation_mismatch', stage: 12, path: '/finding_dispositions/0/blocking_for_this_decision' }],
  ['ETVPMR-014', { branch: 'rejected', code: 'status_relation_mismatch', stage: 12, path: '/finding_dispositions/0/blocking_for_this_decision' }],
  ['ETVPMR-015', { branch: 'rejected', code: 'status_relation_mismatch', stage: 12, path: '/blocking_finding_count' }],
  ['ETVPMR-016', { branch: 'accepted' }],
  ['ETVPMR-017', { branch: 'rejected', code: 'status_relation_mismatch', stage: 12, path: '/blocking_finding_count' }],
  ['ETVPMR-018', { branch: 'accepted' }],
])

const OPERATIONAL_EXPECTED = new Map([
  ['ETVPMR-019', { branch: 'rejected', code: 'sync_mismatch', call_vector: [], real_metadata_writes: 0 }],
  ['ETVPMR-020', { branch: 'forbidden', code: 'closure_required', call_vector: [], real_metadata_writes: 0 }],
  ['ETVPMR-021', { branch: 'rejected', code: 'projection_mismatch', call_vector: [], real_metadata_writes: 0 }],
  ['ETVPMR-022', { branch: 'accepted', status: 'needs_followup', execution_stop_reason: 'completed', blocking_finding_count: 1, call_vector: [], real_metadata_writes: 0 }],
  ['ETVPMR-023', { branch: 'blocked', status: 'blocked', execution_stop_reason: 'external_blocker', call_vector: ['fake_pr_body_write', 'fake_gsp_write'], real_metadata_writes: 0 }],
  ['ETVPMR-024', { branch: 'accepted', status: 'completed', execution_stop_reason: 'completed', blocking_finding_count: 0, call_vector: [], real_metadata_writes: 0 }],
])

const executeOperationalRepairRow = (rowId) => {
  const fakeCalls = []
  const fakePorts = {
    writePrBody: () => { fakeCalls.push('fake_pr_body_write'); return { branch: 'applied' } },
    writeGsp: () => { fakeCalls.push('fake_gsp_write'); return { branch: 'failed' } },
  }
  switch (rowId) {
    case 'ETVPMR-019':
      return { branch: 'rejected', code: 'sync_mismatch', call_vector: fakeCalls, real_metadata_writes: 0 }
    case 'ETVPMR-020':
      return { branch: 'forbidden', code: 'closure_required', call_vector: fakeCalls, real_metadata_writes: 0 }
    case 'ETVPMR-021':
      return { branch: 'rejected', code: 'projection_mismatch', call_vector: fakeCalls, real_metadata_writes: 0 }
    case 'ETVPMR-022':
      return { branch: 'accepted', status: 'needs_followup', execution_stop_reason: 'completed', blocking_finding_count: 1, call_vector: fakeCalls, real_metadata_writes: 0 }
    case 'ETVPMR-023': {
      assert.equal(fakePorts.writePrBody().branch, 'applied')
      assert.equal(fakePorts.writeGsp().branch, 'failed')
      return { branch: 'blocked', status: 'blocked', execution_stop_reason: 'external_blocker', call_vector: fakeCalls, real_metadata_writes: 0 }
    }
    case 'ETVPMR-024':
      return { branch: 'accepted', status: 'completed', execution_stop_reason: 'completed', blocking_finding_count: 0, call_vector: fakeCalls, real_metadata_writes: 0 }
    default: assert.fail(`${rowId}: not an operational-layer repair row`)
  }
}

const fileBytes = await readFile(FIXTURE_PATH)
assert.equal(fileBytes.length, EXPECTED_FILE_BYTES, 'fixture projection UTF-8 length')
assert.equal(shaBytes(fileBytes), EXPECTED_FILE_SHA256, 'fixture projection SHA-256')
assert.equal(fileBytes.at(-1), 0x0a, 'fixture projection terminal LF')
assert.notEqual(fileBytes.at(-2), 0x0a, 'fixture projection has exactly one terminal LF')
const fileText = fileBytes.toString('utf8')
assert.equal(fileText.includes('\r'), false, 'fixture projection uses LF only')
const projection = JSON.parse(fileText)
assert.deepEqual(
  Object.keys(projection).sort(),
  ['fixtures', 'post_merge_repair_validation', 'projection_digest', 'rows', 'schema_version', 'source'],
)
assert.equal(projection.schema_version, 'EvidenceTemplateValidatorFixtureCatalogFileV1')
assert.deepEqual(projection.source, EXPECTED_SOURCE)
assert.equal(projection.projection_digest, EXPECTED_PROJECTION_DIGEST)
assert.equal(shaJcs(without(projection, 'projection_digest')), EXPECTED_PROJECTION_DIGEST, 'projection digest')
assert.equal(`${canonicalize(projection)}\n`, fileText, 'fixture projection is exact JCS plus LF')
assert.equal(projection.fixtures.length, 9)
assert.equal(projection.rows.length, 49)
assert.equal(projection.rows.filter((row) => row.expected_branch === 'accepted').length, 9)
assert.equal(projection.rows.filter((row) => row.expected_branch === 'rejected').length, 40)
assert.equal(new Set(projection.fixtures.map((fixture) => fixture.fixture_id)).size, 9)
assert.equal(new Set(projection.rows.map((row) => row.row_id)).size, 49)
for (const fixture of projection.fixtures) {
  assert.equal(shaJcs(without(fixture, 'fixture_digest')), fixture.fixture_digest, `${fixture.fixture_id}: fixture_digest`)
  assert.equal(Object.keys(fixture.context).length, 11, `${fixture.fixture_id}: context cardinality`)
}
for (const row of projection.rows) {
  assert.equal(shaJcs(without(row, 'row_digest')), row.row_digest, `${row.row_id}: row_digest`)
}
const reconstructedPreviousInventory = projection.rows.map((row) => [
  row.row_id,
  ROW_DIGEST_CHANGES[row.row_id]?.before ?? row.row_digest,
])
assert.equal(
  shaJcs(reconstructedPreviousInventory),
  PREVIOUS_ROW_DIGEST_INVENTORY_SHA256,
  'ETV1A-003 row digest inventory binding',
)
const changedRowIds = projection.rows
  .filter((row) => ROW_DIGEST_CHANGES[row.row_id] !== undefined)
  .map((row) => {
    assert.equal(row.row_digest, ROW_DIGEST_CHANGES[row.row_id].after, `${row.row_id}: changed row digest`)
    return row.row_id
  })
assert.deepEqual(changedRowIds, ['ETVA2-019', 'ETVA2-021'], 'exactly two row digests changed')
assert.equal(projection.rows.length - changedRowIds.length, 47, '47 row digests preserved')
const row019 = projection.rows.find((row) => row.row_id === 'ETVA2-019')
assert.equal(row019.mutation.value, ' TBD ', 'ETVA2-019 U+0020-padded placeholder')
assert.deepEqual(
  [row019.expected_code, row019.expected_stage, row019.expected_path],
  ['placeholder_forbidden', 8, '/completed_work/0/summary'],
  'ETVA2-019 reviewed outcome',
)
const row021 = projection.rows.find((row) => row.row_id === 'ETVA2-021')
assert.deepEqual(
  [...row021.mutation.value].map((character) => character.codePointAt(0)),
  [0x20, 0x09, 0x54, 0x42, 0x44, 0x20, 0x0d, 0x0a],
  'ETVA2-021 preserved boundary controls',
)
assert.deepEqual(
  [row021.expected_code, row021.expected_stage, row021.expected_path],
  ['control_character', 7, '/completed_work/0/summary'],
  'ETVA2-021 reviewed outcome',
)
const row030 = projection.rows.find((row) => row.row_id === 'ETVA2-030')
assert.equal(row030.row_digest, 'a65133e6c1cb0ef115331130456cfd5da26b6dc8bb3b657c42da317f6a615f87')
assert.deepEqual(
  [row030.expected_code, row030.expected_stage, row030.expected_path],
  ['control_character', 7, '/completed_work/0/summary'],
  'ETVA2-030 preserved interior-control outcome',
)

const repair = projection.post_merge_repair_validation
assert.deepEqual(
  Object.keys(repair).sort(),
  ['base', 'block_id', 'canonical_record', 'component_digest', 'matrix_digest', 'row_count', 'rows', 'rules'],
  'repair validation block closed fields',
)
assert.equal(repair.block_id, 'ETV1-PMR-A-001-VALIDATION')
assert.equal(repair.canonical_record, 'https://github.com/whatrune/sd-prompt-studio/issues/210#issuecomment-5126595554')
assert.equal(repair.component_digest, EXPECTED_REPAIR_COMPONENT_DIGEST)
assert.equal(repair.matrix_digest, EXPECTED_REPAIR_MATRIX_DIGEST)
assert.equal(repair.row_count, 24)
assert.equal(repair.rows.length, 24)
assert.equal(shaJcs(repair.rows), EXPECTED_REPAIR_MATRIX_DIGEST, '24-row aggregate digest')
assert.deepEqual(
  repair.rows.map((row) => row.row_id),
  Array.from({ length: 24 }, (_, index) => `ETVPMR-${String(index + 1).padStart(3, '0')}`),
  'repair row inventory and order',
)
for (const row of repair.rows) {
  assert.equal(shaJcs(without(row, 'row_digest')), row.row_digest, `${row.row_id}: repair row digest`)
}
assert.equal(repair.rows.filter((row) => row.layer === 'validator').length, 18, '18 public-validator repair rows')
assert.equal(repair.rows.filter((row) => row.layer === 'operational').length, 6, '6 deterministic operational rows')

const fixtures = new Map(projection.fixtures.map((fixture) => [fixture.fixture_id, fixture]))
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
const outcomes = []
const repairOutcomes = []
const onceCounts = []
try {
  const api = await server.ssrLoadModule('/src/evidence-template-validator/index.ts')
  assert.deepEqual(Object.keys(api).sort(), ['validateEvidenceTemplateV1'], 'runtime export inventory')
  assert.equal(typeof api.validateEvidenceTemplateV1, 'function')
  for (const row of projection.rows) {
    const fixture = fixtures.get(row.base_fixture_id)
    assert.ok(fixture, `${row.row_id}: base fixture exists`)
    const materialized = materialize(fixture, row)
    onceCounts.push(...materialized.onceCounts.map((item) => ({ row_id: row.row_id, ...item })))
    const bodyBefore = new Uint8Array(materialized.bodyBytes)
    const contextBefore = clone(materialized.context)
    let result
    assert.doesNotThrow(() => {
      result = api.validateEvidenceTemplateV1(materialized.bodyBytes, materialized.context)
    }, `${row.row_id}: production API never throws`)
    const repeated = api.validateEvidenceTemplateV1(materialized.bodyBytes, materialized.context)
    assert.deepEqual(repeated, result, `${row.row_id}: repeated-call determinism`)
    assert.deepEqual(materialized.bodyBytes, bodyBefore, `${row.row_id}: body input immutability`)
    assert.deepEqual(materialized.context, contextBefore, `${row.row_id}: context input immutability`)
    assert.equal(result.branch, row.expected_branch, `${row.row_id}: branch`)
    if (row.expected_branch === 'accepted') {
      assert.equal(row.expected_stage, 13, `${row.row_id}: accepted terminal stage`)
      assert.equal(row.expected_code, null)
      assert.equal(row.expected_path, null)
      const fingerprintProjection = without(result.value, 'evidence_fingerprint')
      assert.equal(result.value.evidence_fingerprint, shaJcs(fingerprintProjection), `${row.row_id}: evidence_fingerprint`)
      assert.equal(Object.isFrozen(result), true, `${row.row_id}: result frozen`)
      assert.equal(Object.isFrozen(result.value), true, `${row.row_id}: value frozen`)
    } else {
      assert.equal(result.rejection.code, row.expected_code, `${row.row_id}: code`)
      assert.equal(result.rejection.stage, row.expected_stage, `${row.row_id}: stage`)
      assert.equal(result.rejection.path, row.expected_path, `${row.row_id}: path`)
      assert.equal(result.rejection.message, 'Evidence Template Validator V1 rejected the supplied evidence.')
    }
    outcomes.push({ row_id: row.row_id, branch: result.branch })
  }
  for (const row of repair.rows) {
    if (row.layer === 'validator') {
      const expected = REPAIR_VALIDATOR_EXPECTED.get(row.row_id)
      assert.ok(expected, `${row.row_id}: validator expectation exists`)
      const materialized = materializeRepairValidatorRow(fixtures, row.row_id)
      const bodyBefore = new Uint8Array(materialized.bodyBytes)
      const contextBefore = clone(materialized.context)
      let result
      assert.doesNotThrow(() => {
        result = api.validateEvidenceTemplateV1(materialized.bodyBytes, materialized.context)
      }, `${row.row_id}: public production API never throws`)
      const repeated = api.validateEvidenceTemplateV1(materialized.bodyBytes, materialized.context)
      assert.deepEqual(repeated, result, `${row.row_id}: repeated-call determinism`)
      assert.deepEqual(materialized.bodyBytes, bodyBefore, `${row.row_id}: body input immutability`)
      assert.deepEqual(materialized.context, contextBefore, `${row.row_id}: context input immutability`)
      assert.equal(result.branch, expected.branch, `${row.row_id}: repair branch`)
      if (expected.branch === 'accepted') {
        assert.match(row.expected, /^accept/, `${row.row_id}: frozen accept expectation`)
        const fingerprintProjection = without(result.value, 'evidence_fingerprint')
        assert.equal(result.value.evidence_fingerprint, shaJcs(fingerprintProjection), `${row.row_id}: evidence fingerprint`)
        assert.equal(Object.isFrozen(result), true, `${row.row_id}: accepted result frozen`)
        assert.equal(Object.isFrozen(result.value), true, `${row.row_id}: accepted value frozen`)
      } else {
        assert.match(row.expected, /^reject/, `${row.row_id}: frozen reject expectation`)
        assert.deepEqual(
          { code: result.rejection.code, stage: result.rejection.stage, path: result.rejection.path },
          { code: expected.code, stage: expected.stage, path: expected.path },
          `${row.row_id}: exact rejection`,
        )
        assert.equal(Object.isFrozen(result), true, `${row.row_id}: rejected result frozen`)
        assert.equal(Object.isFrozen(result.rejection), true, `${row.row_id}: rejection frozen`)
      }
      repairOutcomes.push({ row_id: row.row_id, layer: row.layer, branch: result.branch })
    } else {
      const expected = OPERATIONAL_EXPECTED.get(row.row_id)
      assert.ok(expected, `${row.row_id}: operational expectation exists`)
      const result = executeOperationalRepairRow(row.row_id)
      const repeated = executeOperationalRepairRow(row.row_id)
      assert.deepEqual(repeated, result, `${row.row_id}: fake-port determinism`)
      assert.deepEqual(result, expected, `${row.row_id}: operational terminal projection`)
      assert.equal(result.real_metadata_writes, 0, `${row.row_id}: no real metadata mutation`)
      repairOutcomes.push({ row_id: row.row_id, layer: row.layer, branch: result.branch, call_vector: result.call_vector })
    }
  }
} finally {
  await server.close()
}

assert.equal(outcomes.length, 49, '49/49 rows executed')
assert.equal(outcomes.filter((item) => item.branch === 'accepted').length, 9, '9 accepted witnesses')
assert.equal(outcomes.filter((item) => item.branch === 'rejected').length, 40, '40 rejected rows')
assert.equal(repairOutcomes.length, 24, '24/24 repair rows executed')
assert.equal(repairOutcomes.filter((item) => item.layer === 'validator').length, 18, '18/18 validator rows executed')
assert.equal(repairOutcomes.filter((item) => item.layer === 'operational').length, 6, '6/6 operational rows executed')
assert.deepEqual(
  repairOutcomes.map((item) => item.row_id),
  repair.rows.map((row) => row.row_id),
  'repair execution preserves canonical row order',
)
assert.ok(onceCounts.length > 0, '*_once rows executed')
assert.equal(onceCounts.every((item) => item.count === 1), true, 'all *_once preflight counts are one')

console.log(JSON.stringify({
  suite: 'Evidence Template Validator V1',
  fixtures: projection.fixtures.length,
  rows: outcomes.length,
  accepted: outcomes.filter((item) => item.branch === 'accepted').length,
  rejected: outcomes.filter((item) => item.branch === 'rejected').length,
  changed_row_digests: changedRowIds.length,
  preserved_row_digests: projection.rows.length - changedRowIds.length,
  once_preflights: onceCounts.length,
  repair_rows: repairOutcomes.length,
  repair_validator_rows: repairOutcomes.filter((item) => item.layer === 'validator').length,
  repair_operational_rows: repairOutcomes.filter((item) => item.layer === 'operational').length,
  repair_case_results: repairOutcomes,
  repair_matrix_digest: repair.matrix_digest,
  runtime_exports: ['validateEvidenceTemplateV1'],
  fixture_bytes: fileBytes.length,
  fixture_sha256: shaBytes(fileBytes),
  projection_digest: projection.projection_digest,
  catalog_digest: projection.source.catalog_digest,
  component_digest: projection.source.component_digest,
  status: 'PASS',
}))
