import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createServer } from 'vite'

const ARTIFACT_PATH = 'docs/automation/phase1-v2-normative-fixture-corpus.json'
const ARTIFACT_VERSION = '1.0.1'
const SCHEMA_VERSION = 'phase1-v2-fixture-manifest-v1'
const EXPANSION_VERSION = 'normative-fixture-expansion-v1'
const CONTRACT_VERSION = 'normative-fixture-encoding-v1'
const CORPUS_ID = 'phase1-v2-automatic-gate-progression'
const MATRIX_DIGEST = 'sha256:ee0663ec97dee4fc80a06d8dd8d9bd4c147c97a20705042358316df09c1c92da'
const CORPUS_DIGEST = 'sha256:5271fa413afdace667086c6fa69f5f59a7a3cb089ba416700fd6e6c60163a289'
const BASE_ORDER = ['B-N', 'B-O', 'G-N', 'G-B', 'G-B-ALT']
const STRUCTURAL_CODES = new Set([
  'unknown_field',
  'missing_required_field',
  'forbidden_field',
  'invalid_type_or_format',
  'invalid_enum',
  'duplicate_set_member',
  'noncanonical_set_order',
  'invalid_conditional_matrix',
  'invalid_cross_input_binding',
])
const RESULT_KINDS = new Set([
  'recommend_next_role',
  'wait_for_protected_action',
  'require_gate_status_update',
  'invalidate_approval',
  'stop',
  'no_transition',
])

let assertionCount = 0
const check = (condition, message) => {
  assertionCount += 1
  assert.ok(condition, message)
}
const equal = (actual, expected, message) => {
  assertionCount += 1
  assert.equal(actual, expected, message)
}
const deepEqual = (actual, expected, message) => {
  assertionCount += 1
  assert.deepEqual(actual, expected, message)
}

function canonicalize(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value)
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('JCS numbers must be finite')
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`
  if (typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`)
      .join(',')}}`
  }
  throw new TypeError('outside RFC 8785 JSON data model')
}

const digest = (value) =>
  `sha256:${createHash('sha256').update(canonicalize(value), 'utf8').digest('hex')}`
const clone = (value) => structuredClone(value)
const pointerTokens = (pointer) => {
  if (pointer === '') return []
  if (!pointer.startsWith('/')) throw new TypeError(`invalid RFC 6901 pointer: ${pointer}`)
  return pointer
    .slice(1)
    .split('/')
    .map((token) => token.replace(/~1/g, '/').replace(/~0/g, '~'))
}
const containerAt = (root, tokens) => {
  let cursor = root
  for (const token of tokens) {
    if (cursor === null || typeof cursor !== 'object') {
      throw new TypeError(`pointer parent is not a container at ${token}`)
    }
    cursor = cursor[token]
  }
  return cursor
}
const valueAt = (root, pointer) => {
  const tokens = pointerTokens(pointer)
  return tokens.length === 0 ? root : containerAt(root, tokens)
}
const hasPointer = (root, pointer) => {
  try {
    const tokens = pointerTokens(pointer)
    if (tokens.length === 0) return true
    const parent = containerAt(root, tokens.slice(0, -1))
    return (
      parent !== null &&
      typeof parent === 'object' &&
      Object.prototype.hasOwnProperty.call(parent, tokens.at(-1))
    )
  } catch {
    return false
  }
}
function applyOperations(base, operations) {
  const root = clone(base)
  for (const operation of operations) {
    check(
      operation &&
        typeof operation === 'object' &&
        ['add', 'replace', 'remove', 'test'].includes(operation.op) &&
        typeof operation.path === 'string',
      `PatchOperationV1 ${JSON.stringify(operation)}`,
    )
    const tokens = pointerTokens(operation.path)
    check(tokens.length > 0, `root replacement is not admitted: ${operation.path}`)
    const key = tokens.at(-1)
    const parent = containerAt(root, tokens.slice(0, -1))
    check(parent !== null && typeof parent === 'object', `patch parent ${operation.path}`)
    if (operation.op === 'test') {
      deepEqual(parent[key], operation.value, `test ${operation.path}`)
      continue
    }
    if (operation.op === 'remove') {
      check(Object.prototype.hasOwnProperty.call(parent, key), `remove exists ${operation.path}`)
      if (Array.isArray(parent)) parent.splice(Number(key), 1)
      else delete parent[key]
      continue
    }
    if (operation.op === 'replace') {
      check(Object.prototype.hasOwnProperty.call(parent, key), `replace exists ${operation.path}`)
      parent[key] = clone(operation.value)
      continue
    }
    if (Array.isArray(parent)) {
      if (key === '-') parent.push(clone(operation.value))
      else parent.splice(Number(key), 0, clone(operation.value))
    } else {
      check(!Object.prototype.hasOwnProperty.call(parent, key), `add absent ${operation.path}`)
      parent[key] = clone(operation.value)
    }
  }
  return root
}

const raw = await readFile(ARTIFACT_PATH, 'utf8')
const corpus = JSON.parse(raw)

equal(corpus.artifact_version, ARTIFACT_VERSION, 'artifact version')
equal(corpus.schema_version, SCHEMA_VERSION, 'schema version')
equal(corpus.expansion_contract_version, EXPANSION_VERSION, 'expansion version')
equal(corpus.contract_version, CONTRACT_VERSION, 'contract version')
equal(corpus.corpus_id, CORPUS_ID, 'corpus id')
equal(corpus.manifest.artifact_path, ARTIFACT_PATH, 'manifest artifact path')
equal(corpus.manifest.artifact_version, ARTIFACT_VERSION, 'manifest artifact version')
equal(corpus.manifest.schema_version, SCHEMA_VERSION, 'manifest schema version')
deepEqual(corpus.manifest.ordering.base_fixtures, BASE_ORDER, 'fixed base order')
equal(corpus.manifest.matrix_expansion_digest, MATRIX_DIGEST, 'frozen matrix digest')
equal(corpus.manifest.digest.value, CORPUS_DIGEST, 'frozen corpus digest')

equal(corpus.catalog.length, 72, 'catalog identity count')
equal(corpus.evaluator_rows.length, 56, 'evaluator case count')
equal(
  corpus.structural_admission_meta_tests.reduce(
    (count, record) => count + record.structural_cases.length,
    0,
  ),
  25,
  'Structural Admission case count',
)
equal(
  corpus.source_admission_meta_tests.reduce(
    (count, record) => count + record.source_cases.length,
    0,
  ),
  9,
  'Source Admission case count',
)
equal(corpus.static_meta_tests.length, 1, 'static meta-test count')
equal(corpus.generated_meta_tests.length, 2, 'generated meta-test count')

const catalogIds = corpus.catalog.map((record) => record.identity)
equal(new Set(catalogIds).size, catalogIds.length, 'unique catalog identities')
corpus.catalog.forEach((record, index) => {
  equal(record.ordinal, index + 1, `catalog ordinal ${record.identity}`)
})
corpus.evaluator_rows.forEach((row, index) => {
  equal(row.ordinal, index + 1, `evaluator ordinal ${row.row_id}`)
})

const baseById = new Map(corpus.base_fixtures.map((base) => [base.fixture_id, base]))
deepEqual([...baseById.keys()], BASE_ORDER, 'base map order')
for (const base of corpus.base_fixtures) {
  equal(
    digest(base.literal_v2_input),
    base.input_expansion_digest,
    `base digest ${base.fixture_id}`,
  )
}

const expandedRows = new Map()
for (const row of corpus.evaluator_rows) {
  const base = baseById.get(row.base_fixture_id)
  check(base !== undefined, `base exists for ${row.row_id}`)
  const expandedInput = applyOperations(base.literal_v2_input, row.operations)
  equal(
    digest(expandedInput),
    row.expanded_input_digest,
    `expanded input digest ${row.row_id}`,
  )
  equal(
    digest(row.expected_result),
    row.expanded_result_digest,
    `expanded result digest ${row.row_id}`,
  )
  equal(
    digest({ expanded_input: expandedInput, expected_result: row.expected_result }),
    row.row_digest,
    `row digest ${row.row_id}`,
  )
  deepEqual(row.expected_trace, row.expected_result.precedence_trace, `trace projection ${row.row_id}`)
  if (row.expected_result.input_fingerprint === 'invalid-input-v2') {
    equal(row.fingerprint_relation.kind, 'invalid', `invalid relation ${row.row_id}`)
  } else {
    equal(
      row.expected_result.input_fingerprint,
      `agp-input-v2:${row.expanded_input_digest}`,
      `fingerprint projection ${row.row_id}`,
    )
  }
  expandedRows.set(row.row_id, expandedInput)
}

const orderedRows = corpus.evaluator_rows.map((row) => ({
  ordinal: row.ordinal,
  row_id: row.row_id,
  base_fixture_id: row.base_fixture_id,
  operations: row.operations,
  expanded_input_digest: row.expanded_input_digest,
  expanded_result_digest: row.expanded_result_digest,
  expected_trace: row.expected_trace,
  expected_evidence: row.expected_evidence,
  forbidden_result_paths: row.forbidden_result_paths,
  fingerprint_relation: row.fingerprint_relation,
}))
const matrixProjection = {
  contract_version: corpus.expansion_contract_version,
  ordered_base_fixture_input_digests: corpus.base_fixtures.map((base) => ({
    fixture_id: base.fixture_id,
    input_expansion_digest: base.input_expansion_digest,
  })),
  ordered_rows: orderedRows,
}
equal(digest(matrixProjection), MATRIX_DIGEST, 'matrix digest recomputation')

const corpusProjection = clone(corpus)
delete corpusProjection.manifest.digest.value
equal(digest(corpusProjection), CORPUS_DIGEST, 'corpus digest recomputation')

const recordIds = new Set([
  ...corpus.evaluator_rows.map((row) => row.row_id.split('#')[0]),
  ...corpus.structural_admission_meta_tests.map((record) => record.meta_test_id),
  ...corpus.source_admission_meta_tests.map((record) => record.meta_test_id),
  ...corpus.static_meta_tests.map((record) => record.meta_test_id),
  ...corpus.generated_meta_tests.map((record) => record.meta_test_id),
])
for (const identity of catalogIds) check(recordIds.has(identity), `catalog record resolves ${identity}`)

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
try {
  const api = await server.ssrLoadModule('/src/automatic-gate-progression/index.ts')
  equal(
    api.AUTOMATIC_GATE_PROGRESSION_EVALUATION_INPUT_V2_VERSION,
    'automatic-gate-progression-evaluation-input-v2',
    'public input version',
  )
  equal(
    api.AUTOMATIC_GATE_PROGRESSION_EVALUATION_RESULT_V2_VERSION,
    'automatic-gate-progression-evaluation-result-v2',
    'public result version',
  )
  equal(typeof api.evaluateAutomaticGateProgressionV2, 'function', 'public V2 evaluator')
  equal(
    typeof api.validateAutomaticGateProgressionEvaluationResultV2,
    'function',
    'public V2 result validator',
  )
  check(!('evaluateAutomaticGateProgressionV1' in api), 'V1 evaluator is not exported')

  const actualByRow = new Map()
  for (const row of corpus.evaluator_rows) {
    const input = expandedRows.get(row.row_id)
    const before = canonicalize(input)
    const actual = api.evaluateAutomaticGateProgressionV2(input)
    deepEqual(actual, row.expected_result, `complete result ${row.row_id}`)
    deepEqual(actual.precedence_trace, row.expected_trace, `expected trace ${row.row_id}`)
    for (const evidence of row.expected_evidence) {
      deepEqual(valueAt(actual, evidence.path), evidence.urls, `evidence ${row.row_id} ${evidence.path}`)
    }
    for (const pointer of row.forbidden_result_paths) {
      check(!hasPointer(actual, pointer), `forbidden result path ${row.row_id} ${pointer}`)
    }
    equal(canonicalize(input), before, `input immutability ${row.row_id}`)
    check(Object.isFrozen(actual), `result root frozen ${row.row_id}`)
    check(RESULT_KINDS.has(actual.kind), `closed result kind ${row.row_id}`)
    const admittedResult = api.validateAutomaticGateProgressionEvaluationResultV2(actual)
    equal(admittedResult.kind, 'accepted', `result Admission ${row.row_id}`)
    deepEqual(admittedResult.value, actual, `result Admission value ${row.row_id}`)
    check(Object.isFrozen(admittedResult.value), `result Admission frozen ${row.row_id}`)
    actualByRow.set(row.row_id, actual)
  }
  const resultWithUnknown = {
    ...clone(actualByRow.values().next().value),
    zz_unknown: true,
  }
  equal(
    api.validateAutomaticGateProgressionEvaluationResultV2(resultWithUnknown).kind,
    'rejected',
    'result Admission rejects unknown root field',
  )
  const resultWithNestedUnknown = clone(actualByRow.values().next().value)
  resultWithNestedUnknown.gate_status_requirement.zz_unknown = true
  equal(
    api.validateAutomaticGateProgressionEvaluationResultV2(resultWithNestedUnknown).kind,
    'rejected',
    'result Admission rejects unknown nested field',
  )

  let structuralInvocationCount = 0
  for (const record of corpus.structural_admission_meta_tests) {
    equal(
      record.target_public_export,
      'evaluateAutomaticGateProgressionV2',
      `Structural export ${record.meta_test_id}`,
    )
    for (const testCase of record.structural_cases) {
      const base = baseById.get(testCase.base_fixture_id)
      check(base !== undefined, `Structural base ${record.meta_test_id}#${testCase.case_key}`)
      const input = applyOperations(base.literal_v2_input, testCase.operations)
      check(
        STRUCTURAL_CODES.has(testCase.expected_admission_rejection.code),
        `Structural code ${record.meta_test_id}#${testCase.case_key}`,
      )
      check(
        /^\/(?:[^/~]|~[01])+(?:\/(?:[^/~]|~[01])+)*$/.test(
          testCase.expected_admission_rejection.path,
        ),
        `RFC 6901 path ${record.meta_test_id}#${testCase.case_key}`,
      )
      const before = canonicalize(input)
      structuralInvocationCount += 1
      const actual = api.evaluateAutomaticGateProgressionV2(input)
      deepEqual(
        actual,
        testCase.expected_safe_result,
        `safe Structural result ${record.meta_test_id}#${testCase.case_key}`,
      )
      deepEqual(
        actual.precedence_trace,
        testCase.expected_trace,
        `Structural trace ${record.meta_test_id}#${testCase.case_key}`,
      )
      for (const evidence of testCase.expected_evidence) {
        deepEqual(
          valueAt(actual, evidence.path),
          evidence.urls,
          `Structural evidence ${record.meta_test_id}#${testCase.case_key}`,
        )
      }
      for (const pointer of testCase.forbidden_result_paths) {
        check(
          !hasPointer(actual, pointer),
          `Structural forbidden ${record.meta_test_id}#${testCase.case_key} ${pointer}`,
        )
      }
      equal(
        canonicalize(input),
        before,
        `Structural input immutability ${record.meta_test_id}#${testCase.case_key}`,
      )
    }
  }
  equal(structuralInvocationCount, 25, 'all Structural Admission cases invoked')

  const actionIdRegressionCases = [
    { caseKey: 'hyphenated_action_id', actionId: 'implement-phase1' },
    { caseKey: 'sixty_five_character_action_id', actionId: `a${'a'.repeat(64)}` },
  ]
  for (const testCase of actionIdRegressionCases) {
    const input = clone(baseById.get('B-O').literal_v2_input)
    input.task_assignment.allowed_actions = [testCase.actionId]
    const before = canonicalize(input)
    const actual = api.evaluateAutomaticGateProgressionV2(input)
    equal(actual.kind, 'stop', `ActionId regression kind ${testCase.caseKey}`)
    equal(
      actual.stop_condition,
      'malformed_or_unknown_input',
      `ActionId regression stop condition ${testCase.caseKey}`,
    )
    equal(actual.input_fingerprint, 'invalid-input-v2', `ActionId regression fingerprint ${testCase.caseKey}`)
    deepEqual(
      actual.precedence_trace,
      ['structural_admission'],
      `ActionId regression trace ${testCase.caseKey}`,
    )
    equal(canonicalize(input), before, `ActionId regression input immutability ${testCase.caseKey}`)
  }

  const unrelatedTaskInput = clone(baseById.get('B-N').literal_v2_input)
  const unrelatedTaskUrl = (value) =>
    typeof value === 'string'
      ? value.replaceAll('/issues/179', '/issues/999').replaceAll('/pull/180', '/pull/999')
      : Array.isArray(value)
        ? value.map(unrelatedTaskUrl)
        : value && typeof value === 'object'
          ? Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, unrelatedTaskUrl(nested)]))
          : value
  const unrelatedTask = unrelatedTaskUrl(unrelatedTaskInput)
  unrelatedTask.task_id = 'task-999'
  const unrelatedTaskBefore = canonicalize(unrelatedTask)
  const unrelatedTaskActual = api.evaluateAutomaticGateProgressionV2(unrelatedTask)
  const admittedEvidence = new Set([
    unrelatedTask.task_assignment.canonical_record,
    unrelatedTask.result_handoff.canonical_record,
    unrelatedTask.review_decision.canonical_record,
    unrelatedTask.pr.url,
  ])
  equal(unrelatedTaskActual.kind, 'stop', 'unrelated task evidence kind')
  equal(unrelatedTaskActual.stop_condition, 'canonical_conflict', 'unrelated task evidence conflict')
  deepEqual(
    unrelatedTaskActual.canonical_evidence_refs,
    [...admittedEvidence],
    'unrelated task evidence exact admitted projection',
  )
  check(
    unrelatedTaskActual.canonical_evidence_refs.every((ref) => admittedEvidence.has(ref)),
    'unrelated task evidence is entirely input-bound',
  )
  check(
    unrelatedTaskActual.canonical_evidence_refs.every((ref) => !ref.includes('/issues/179')),
    'unrelated task evidence does not synthesize Issue 179 history',
  )
  equal(canonicalize(unrelatedTask), unrelatedTaskBefore, 'unrelated task input immutability')

  let sourceCaseCount = 0
  for (const record of corpus.source_admission_meta_tests) {
    equal(
      record.public_evaluator_export,
      'evaluateAutomaticGateProgressionV2',
      `Source boundary export ${record.meta_test_id}`,
    )
    for (const testCase of record.source_cases) {
      sourceCaseCount += 1
      check(
        ['admitted_singleton', 'canonical_conflict', 'external_blocker'].includes(
          testCase.expected_source_outcome.kind,
        ),
        `closed Source outcome ${record.meta_test_id}#${testCase.case_key}`,
      )
      if (testCase.expected_source_outcome.evaluator_invoked === false) {
        equal(testCase.v2_fingerprint_produced, false, `no source fingerprint ${record.meta_test_id}`)
        deepEqual(
          testCase.expected_trace,
          ['source_admission'],
          `Source Admission stops before evaluator ${record.meta_test_id}#${testCase.case_key}`,
        )
      } else {
        check(
          testCase.downstream_input_encoding !== null,
          `admitted source encoding ${record.meta_test_id}#${testCase.case_key}`,
        )
      }
    }
  }
  equal(sourceCaseCount, 9, 'all Source Admission cases bound without transport implementation')

  const staticMeta = corpus.static_meta_tests[0]
  equal(staticMeta.meta_test_id, 'AGP-I01', 'I01 identity')
  equal(staticMeta.target_public_export, 'evaluateAutomaticGateProgressionV2', 'I01 export')
  const productionSources = [
    await readFile('src/automatic-gate-progression/index.ts', 'utf8'),
    await readFile('src/context-health/index.ts', 'utf8'),
  ].join('\n')
  const forbiddenCapabilityPatterns = [
    /\bfetch\s*\(/,
    /XMLHttpRequest/,
    /WebSocket/,
    /node:fs/,
    /node:child_process/,
    /\bDate\.now\s*\(/,
    /\bnew Date\s*\(/,
    /\bprocess\./,
    /import\.meta\.env/,
    /\bgh\s+/,
    /\bgit\s+/,
  ]
  for (const pattern of forbiddenCapabilityPatterns) {
    check(!pattern.test(productionSources), `I01 pure boundary ${pattern}`)
  }

  const m01 = corpus.generated_meta_tests.find((record) => record.meta_test_id === 'AGP-M01')
  const m02 = corpus.generated_meta_tests.find((record) => record.meta_test_id === 'AGP-M02')
  check(m01 !== undefined, 'M01 exists')
  check(m02 !== undefined, 'M02 exists')
  equal(m01.case_bindings.length, 6, 'M01 branch binding count')
  const m01Kinds = new Set()
  for (const binding of m01.case_bindings) {
    equal(binding.bound_evaluator_row_ids.length, 1, `M01 singleton ${binding.case_key}`)
    const actual = actualByRow.get(binding.bound_evaluator_row_ids[0])
    check(actual !== undefined, `M01 bound row ${binding.case_key}`)
    equal(actual.kind, binding.expected_result_kind, `M01 result kind ${binding.case_key}`)
    m01Kinds.add(actual.kind)
  }
  deepEqual(m01Kinds, RESULT_KINDS, 'M01 all six result branches')

  const expectedM02 = new Map([
    ['all_structural_rejections', 25],
    ['all_semantic_stops', 19],
    ['all_approval_invalidations', 7],
  ])
  equal(m02.case_bindings.length, 3, 'M02 binding set count')
  for (const binding of m02.case_bindings) {
    equal(
      binding.bound_evaluator_row_ids.length,
      expectedM02.get(binding.case_key),
      `M02 exact set size ${binding.case_key}`,
    )
    equal(
      new Set(binding.bound_evaluator_row_ids).size,
      binding.bound_evaluator_row_ids.length,
      `M02 unique binding ${binding.case_key}`,
    )
    for (const rowId of binding.bound_evaluator_row_ids) {
      const isStructural = rowId.includes('#') && !actualByRow.has(rowId)
      check(
        isStructural ||
          actualByRow.has(rowId) ||
          corpus.structural_admission_meta_tests.some(
            (record) =>
              record.meta_test_id === rowId.split('#')[0] &&
              record.structural_cases.some(
                (testCase) => `${record.meta_test_id}#${testCase.case_key}` === rowId,
              ),
          ),
        `M02 binding resolves ${rowId}`,
      )
    }
  }

  console.log(
    JSON.stringify({
      result: 'PASS',
      artifact: ARTIFACT_PATH,
      matrix_digest: MATRIX_DIGEST,
      corpus_digest: CORPUS_DIGEST,
      evaluator_cases: corpus.evaluator_rows.length,
      structural_cases: structuralInvocationCount,
      source_cases: sourceCaseCount,
      m01_branches: m01.case_bindings.length,
      m02_binding_sets: m02.case_bindings.map((binding) => binding.bound_evaluator_row_ids.length),
      assertions: assertionCount,
    }),
  )
} finally {
  await server.close()
}
