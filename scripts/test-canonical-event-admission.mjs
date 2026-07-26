import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createServer } from 'vite'

const ARTIFACT_PATH = 'docs/automation/canonical-event-admission-normative-catalog-v2.json'
const artifactText = await readFile(ARTIFACT_PATH, 'utf8')
const artifact = JSON.parse(artifactText)
const canonicalize = (value) => value === null || typeof value !== 'object'
  ? JSON.stringify(value)
  : Array.isArray(value)
    ? `[${value.map(canonicalize).join(',')}]`
    : `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`
const shaHex = (value) => createHash('sha256').update(value).digest('hex')
const shaRef = (value) => `sha256:${shaHex(value)}`
const clone = (value) => structuredClone(value)
const without = (value, key) => {
  const copy = clone(value)
  delete copy[key]
  return copy
}

assert.equal(artifact.artifact_version, '2.0.2')
assert.equal(artifact.contract_version, 'canonical-event-admission-amendment-007')
assert.equal(artifact.manifest.counts.active_executable_rows, 1020)
assert.deepEqual(
  ['positive', 'field_negative', 'tuple_negative', 'generation', 'invocation'].map((key) => artifact.executable_rows[key].length),
  [26, 900, 76, 6, 12],
)
const rows = Object.values(artifact.executable_rows).flat()
assert.equal(rows.length, 1020)
assert.equal(new Set(rows.map((row) => row.row_id)).size, 1020)
for (const row of rows) assert.equal(shaRef(canonicalize(without(row, 'row_digest'))), row.row_digest, `row digest ${row.row_id}`)
assert.equal(shaRef(canonicalize(artifact.fixtures)), artifact.manifest.authority_digests.fixture_catalog_digest)
assert.equal(shaRef(canonicalize(artifact.port_companions)), artifact.manifest.authority_digests.port_companion_catalog_digest)
const admissionRows = [...artifact.executable_rows.positive, ...artifact.executable_rows.field_negative, ...artifact.executable_rows.tuple_negative]
assert.equal(shaRef(canonicalize(admissionRows)), artifact.manifest.authority_digests.admission_matrix_digest)
assert.equal(shaRef(canonicalize(rows)), artifact.manifest.authority_digests.executable_catalog_digest)
const artifactForDigest = clone(artifact)
delete artifactForDigest.manifest.artifact_digest.value
assert.equal(shaRef(canonicalize(artifactForDigest)), artifact.manifest.artifact_digest.value)
assert.equal(artifact.manifest.authority_digests.authority_bundle_digest, 'sha256:32063d4bc62ff87a185e2de68377259f18f44d70b2695e85bb565638c8efa44d')

const fixtureById = new Map(artifact.fixtures.map((fixture) => [fixture.fixture_id, fixture]))
const portById = new Map(artifact.port_companions.map((fixture) => [fixture.fixture_id, fixture]))
const decodePointer = (pointer) => pointer.split('/').slice(1).map((part) => part.replaceAll('~1', '/').replaceAll('~0', '~'))
const applyOperation = (providerPayload, operation) => {
  if (operation.kind === 'none') return
  const path = decodePointer(operation.path)
  assert.equal(path.shift(), 'provider_payload')
  let parent = providerPayload
  for (const segment of path.slice(0, -1)) parent = parent[segment]
  const key = path.at(-1)
  if (operation.kind === 'remove') delete parent[key]
  else parent[key] = clone(operation.value)
}
const rebuild = (fixture, operation) => {
  const invocation = clone(fixture.invocation)
  const rawInput = clone(fixture.raw_input)
  const providerPayload = clone(fixture.provider_payload)
  applyOperation(providerPayload, operation)
  const payloadJcs = canonicalize(providerPayload)
  const payloadBytes = Buffer.from(payloadJcs, 'utf8')
  const digest = shaRef(payloadBytes)
  rawInput.raw_payload.body_base64 = payloadBytes.toString('base64')
  rawInput.raw_payload.byte_length = payloadBytes.length
  rawInput.raw_payload.sha256 = digest
  const evidence = invocation.verification.evidence
  evidence.raw_payload_sha256 = digest
  evidence.raw_payload_byte_length = payloadBytes.length
  const evidenceProjection = clone(evidence)
  delete evidenceProjection.verification_id
  evidence.verification_id = `github-webhook-verification-v1:${shaRef(canonicalize(evidenceProjection))}`
  return { invocation, rawInput }
}
const expectedTraceFor = (outcome) => {
  if (outcome.kind === 'accepted') return ['P', 'S', 'B', 'A', 'C', 'R', 'N', 'I', 'D']
  if (outcome.kind !== 'rejected') return ['P']
  const stage = outcome.rejection.stage
  return stage === 'event_mapping' ? ['P', 'S', 'B', 'A', 'C']
    : stage === 'source_identity' ? ['P', 'S', 'B', 'A', 'C', 'R']
      : stage === 'authenticity' ? ['P', 'S', 'B', 'A']
        : stage === 'binding' ? ['P', 'S', 'B']
          : ['P', 'S']
}

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
try {
  const api = await server.ssrLoadModule('/src/canonical-event-admission/index.ts')
  const counts = { positive: 0, field_negative: 0, tuple_negative: 0, generation: 0, invocation: 0 }
  for (const group of ['positive', 'field_negative', 'tuple_negative']) {
    for (const row of artifact.executable_rows[group]) {
      const fixture = fixtureById.get(row.base_fixture_id)
      const port = portById.get(row.base_fixture_id)
      assert.ok(fixture && port, `fixture and port ${row.row_id}`)
      const { invocation, rawInput } = rebuild(fixture, row.operation)
      const calls = { canonicalize_jcs: 0, sha256: 0, ledger_transact: 0 }
      const ports = {
        canonicalize_jcs: (value) => {
          calls.canonicalize_jcs += 1
          return { kind: 'ok', value: new TextEncoder().encode(canonicalize(value)) }
        },
        sha256: (value) => {
          calls.sha256 += 1
          return { kind: 'ok', value: shaRef(Buffer.from(value)) }
        },
        ledger_transact: async () => {
          calls.ledger_transact += 1
          return clone(port.ledger_transact)
        },
      }
      const actual = await api.admitCanonicalGitHubEventV1(invocation, rawInput, ports)
      assert.deepEqual(actual, row.expected_outcome, `outcome ${row.row_id}`)
      assert.deepEqual(calls, row.expected_call_counts, `call counts ${row.row_id}`)
      assert.deepEqual(expectedTraceFor(actual), row.expected_trace, `trace ${row.row_id}`)
      assert.ok(Object.isFrozen(actual), `root frozen ${row.row_id}`)
      counts[group] += 1
    }
  }
  for (const row of artifact.executable_rows.generation) {
    const actual = api.transactFreshnessGenerationV1(clone(row.input))
    assert.deepEqual(actual, row.expected_outcome, `generation ${row.row_id}`)
    assert.ok(Object.isFrozen(actual), `generation frozen ${row.row_id}`)
    counts.generation += 1
  }
  for (const row of artifact.executable_rows.invocation) {
    const mode = row.test_session_input.fault_mode
    const expected = row.expected_outcome
    const ready = {
      evaluated_at: expected.evaluated_at === '1970-01-01T00:00:00Z' ? '2026-07-24T00:00:00Z' : expected.evaluated_at,
      snapshot_id: expected.snapshot_id.startsWith('github-fresh-snapshot-v1:sha256:0000') ? `github-fresh-snapshot-v1:sha256:${'2'.repeat(64)}` : expected.snapshot_id,
      generation_keys: expected.generation_keys.length === 0 ? [`github-freshness-generation-v1:sha256:${'1'.repeat(64)}`] : clone(expected.generation_keys),
      evaluator_input: { contract_version: 'automatic-gate-progression-evaluation-input-v2' },
    }
    const calls = { ready_validator: 0, evaluator: 0, result_validator: 0, outcome_validator: 0, terminal_anchor_validator: 0 }
    const ports = {
      validate_ready: () => {
        calls.ready_validator += 1
        if (mode === 'ready_validator_throw') throw new Error('fault')
        if (mode === 'ready_validator_failed') return { kind: 'failed' }
        if (mode === 'ready_validator_rejected') return { kind: 'rejected' }
        return { kind: 'accepted', value: clone(ready) }
      },
      evaluate: () => {
        calls.evaluator += 1
        if (mode === 'evaluator_throw') throw new Error('fault')
        return clone(expected.evaluator_result ?? { contract_version: 'automatic-gate-progression-evaluation-result-v2' })
      },
      validate_result: (value) => {
        calls.result_validator += 1
        if (mode === 'result_validator_throw') throw new Error('fault')
        if (mode === 'result_validator_failed') return { kind: 'failed' }
        if (mode === 'result_validator_rejected') return { kind: 'rejected' }
        return { kind: 'accepted', value }
      },
      validate_outcome: (value) => {
        calls.outcome_validator += 1
        if (mode === 'outcome_validator_throw') throw new Error('fault')
        if (mode === 'outcome_validator_failed') return { kind: 'failed' }
        if (mode === 'outcome_validator_rejected') return { kind: 'rejected' }
        return { kind: 'accepted', value }
      },
      validate_terminal_anchor: (value) => {
        calls.terminal_anchor_validator += 1
        return { kind: 'accepted', value }
      },
    }
    const actual = api.invokeAutomaticGateProgressionForCanonicalEventsV1(ready, ports)
    assert.deepEqual(actual, expected, `invocation ${row.row_id}`)
    assert.deepEqual(calls, row.expected_call_counts, `invocation calls ${row.row_id}`)
    assert.ok(Object.isFrozen(actual), `invocation frozen ${row.row_id}`)
    counts.invocation += 1
  }
  const positive = fixtureById.get('CEA-A4-FIX-CEA-MAP-001')
  const unknownInput = clone(positive.raw_input)
  unknownInput.zz_unknown = true
  const noCalls = { canonicalize_jcs: 0, sha256: 0, ledger_transact: 0 }
  const unknownOutcome = await api.admitCanonicalGitHubEventV1(positive.invocation, unknownInput, {
    canonicalize_jcs: () => { noCalls.canonicalize_jcs += 1; throw new Error('unexpected') },
    sha256: () => { noCalls.sha256 += 1; throw new Error('unexpected') },
    ledger_transact: async () => { noCalls.ledger_transact += 1; throw new Error('unexpected') },
  })
  assert.equal(unknownOutcome.kind, 'rejected')
  assert.equal(unknownOutcome.rejection.code, 'unknown_field')
  assert.deepEqual(noCalls, { canonicalize_jcs: 0, sha256: 0, ledger_transact: 0 })
  assert.deepEqual(counts, { positive: 26, field_negative: 900, tuple_negative: 76, generation: 6, invocation: 12 })
  console.log(JSON.stringify({
    result: 'PASS',
    artifact_version: artifact.artifact_version,
    artifact_digest: artifact.manifest.artifact_digest.value,
    active_rows: rows.length,
    group_counts: counts,
    skipped: 0,
    duplicates: 0,
    placeholders: 0,
    unresolved: 0,
  }))
} finally {
  await server.close()
}
