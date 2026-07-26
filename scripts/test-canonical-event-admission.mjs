import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createServer } from 'vite'

const ARTIFACT_PATH = 'docs/automation/canonical-event-admission-normative-catalog-v2.json'
const artifactText = await readFile(ARTIFACT_PATH, 'utf8')
const artifact = JSON.parse(artifactText)
const progressionCorpus = JSON.parse(
  await readFile('docs/automation/phase1-v2-normative-fixture-corpus.json', 'utf8'),
)
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

assert.equal(artifact.artifact_version, '2.0.3')
assert.equal(artifact.contract_version, 'canonical-event-admission-amendment-012')
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
assert.equal(artifact.manifest.authority_digests.authority_bundle_digest, 'sha256:922ad4e2c43f84b4eb03766ad751ecb783a052e705d0821b1ba6bd57b98703e3')

const fixtureById = new Map(artifact.fixtures.map((fixture) => [fixture.fixture_id, fixture]))
const portById = new Map(artifact.port_companions.map((fixture) => [fixture.fixture_id, fixture]))
const progressionBase = progressionCorpus.base_fixtures.find((fixture) => fixture.fixture_id === 'B-N')
assert.ok(progressionBase, 'B-N progression fixture')
const validProgressionInput = clone(progressionBase.literal_v2_input)
const malformedProgressionInput = clone(validProgressionInput)
malformedProgressionInput.task_id = 7
const invocationCandidateById = new Map([
  ['CEA-A4-READY-VALID', validProgressionInput],
  ['CEA-A4-READY-MALFORMED-TASK-ID', malformedProgressionInput],
])
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
  const progressionApi = await server.ssrLoadModule('/src/automatic-gate-progression/index.ts')
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
          return { contract_version: 'canonical-event-port-result-v1', kind: 'ok', value: new TextEncoder().encode(canonicalize(value)) }
        },
        sha256: (value) => {
          calls.sha256 += 1
          return { contract_version: 'canonical-event-port-result-v1', kind: 'ok', value: shaRef(Buffer.from(value)) }
        },
        ledger_transact: async () => {
          calls.ledger_transact += 1
          return { contract_version: 'canonical-event-ledger-transaction-result-v1', ...clone(port.ledger_transact) }
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
    const transition = row.expected_outcome.kind === 'applied' ? clone(row.expected_outcome.result) : null
    const actual = await api.transactFreshnessGenerationV1(clone(row.input.request), {
      transact: async () => {
        if (transition === null) throw new Error('ordering invariant')
        return transition
      },
    })
    if (transition === null) assert.equal(actual.kind, 'failed', `generation ${row.row_id}`)
    else {
      assert.equal(actual.kind, 'accepted', `generation admission ${row.row_id}`)
      assert.deepEqual(actual.value, transition, `generation ${row.row_id}`)
    }
    assert.ok(Object.isFrozen(actual), `generation frozen ${row.row_id}`)
    counts.generation += 1
  }
  for (const row of artifact.executable_rows.invocation) {
    const mode = row.test_session_input.fault_mode
    const expected = row.expected_outcome
    const candidateInput = invocationCandidateById.get(row.candidate_fixture_id)
    assert.ok(candidateInput, `invocation candidate fixture ${row.candidate_fixture_id}`)
    const ready = {
      contract_version: 'canonical-event-evaluator-binding-outcome-v1',
      kind: 'ready',
      evaluated_at: expected.evaluated_at === '1970-01-01T00:00:00Z' ? '2026-07-24T00:00:00Z' : expected.evaluated_at,
      snapshot_id: expected.snapshot_id.startsWith('github-fresh-snapshot-v1:sha256:0000') ? `github-fresh-snapshot-v1:sha256:${'2'.repeat(64)}` : expected.snapshot_id,
      triggering_event_ids: [`github-event-v1:sha256:${'3'.repeat(64)}`],
      triggering_generation_keys: expected.generation_keys.length === 0 ? [`github-freshness-generation-v1:sha256:${'1'.repeat(64)}`] : clone(expected.generation_keys),
      input: clone(candidateInput),
    }
    const session = api.createCanonicalEventInvocationTestSessionV1(clone(row.test_session_input))
    assert.equal(session.kind, 'accepted', `session ${row.row_id}`)
    const created = api.readCanonicalEventInvocationTestEvidenceV1(session.value)
    assert.equal(created.kind, 'accepted', `created evidence ${row.row_id}`)
    assert.equal(created.value.lifecycle, 'created', `created lifecycle ${row.row_id}`)
    const actual = api.invokeAutomaticGateProgressionForCanonicalEventsV1(ready, session.value)
    const terminalEvidence = api.readCanonicalEventInvocationTestEvidenceV1(session.value)
    assert.equal(terminalEvidence.kind, 'accepted', `terminal evidence ${row.row_id}`)
    assert.equal(terminalEvidence.value.lifecycle, 'completed', `terminal lifecycle ${row.row_id}`)
    assert.deepEqual(actual, expected, `invocation ${row.row_id}`)
    assert.deepEqual(terminalEvidence.value.call_counts, row.expected_call_counts, `invocation calls ${row.row_id}`)
    assert.equal(terminalEvidence.value.fallback_depth, row.fallback_depth, `fallback ${row.row_id}`)
    assert.equal(terminalEvidence.value.retry_count, row.retry_count, `retry ${row.row_id}`)
    if (row.row_id === 'CEA-A4-INV-002') {
      assert.deepEqual(terminalEvidence.value.ordered_trace, ['ready_admission'], 'INV-002 trace')
    }
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
  const invalidRaw = clone(positive.raw_input)
  invalidRaw.repository.database_id = 'not-a-number'
  assert.equal(api.validateRawGitHubEventInputV1(invalidRaw).kind, 'rejected', 'nested repository type is rejected')
  const accepted = clone(positive.expected_accepted_outcome)
  accepted.envelope = {}
  assert.equal(api.validateCanonicalEventAdmissionOutcomeV1(accepted).kind, 'rejected', 'empty accepted envelope is rejected')
  const invalidDelivery = clone(positive.expected_accepted_outcome)
  invalidDelivery.delivery_id = 'not-a-delivery-uuid'
  assert.equal(api.validateCanonicalEventAdmissionOutcomeV1(invalidDelivery).kind, 'rejected', 'invalid accepted delivery id is rejected')

  let focusedChecks = 0
  const expectRejected = (admission, label) => {
    assert.equal(admission.kind, 'rejected', label)
    focusedChecks += 1
  }
  const expectAccepted = (admission, label) => {
    assert.equal(admission.kind, 'accepted', label)
    assert.ok(Object.isFrozen(admission), `${label} frozen`)
    focusedChecks += 1
  }
  const unknownField = (value) => ({ ...clone(value), zz_unknown: true })
  expectAccepted(api.validateCanonicalEventAdmissionInvocationV1(positive.invocation), 'focused invocation accepted')
  expectRejected(api.validateCanonicalEventAdmissionInvocationV1(unknownField(positive.invocation)), 'focused invocation closed')
  expectAccepted(api.validateRawGitHubEventInputV1(positive.raw_input), 'focused raw accepted')
  expectRejected(api.validateRawGitHubEventInputV1(unknownField(positive.raw_input)), 'focused raw closed')
  const positiveOutcome = artifact.executable_rows.positive[0].expected_outcome
  expectAccepted(api.validateCanonicalEventAdmissionOutcomeV1(positiveOutcome), 'focused outcome accepted')
  expectRejected(api.validateCanonicalEventAdmissionOutcomeV1(unknownField(positiveOutcome)), 'focused outcome closed')
  const envelopeNegativeCases = [
    ['missing', (value) => { delete value.envelope.actor.login }],
    ['unknown', (value) => { value.envelope.source_object.zz_unknown = true }],
    ['type', (value) => { value.envelope.delivery.hook_id = 'invalid' }],
    ['enum', (value) => { value.envelope.lineage.migration_kind = 'future' }],
    ['timestamp', (value) => { value.envelope.observed_at = 'not-a-timestamp' }],
    ['reference', (value) => { value.envelope.ordering.stream_key = `github-stream-v1:sha256:${'0'.repeat(64)}` }],
    ['conditional', (value) => { value.envelope.ordering.disposition = value.evaluator_trigger === 'required' ? 'historical' : 'current' }],
    ['collection', (value) => { value.envelope.immutable_source_refs.push(value.envelope.immutable_source_refs[0]) }],
    ['actor type catalog', (value) => { value.envelope.actor.actor_type = 'Alien' }],
    ['source external host', (value) => { value.envelope.source_object.canonical_url = 'https://evil.example/issues/196' }],
    ['source wrong repository', (value) => { value.envelope.source_object.canonical_url = 'https://github.com/whatrune/other-repository/issues/196' }],
    ['normalized source external host', (value) => {
      if (value.envelope.normalized_payload.kind === 'canonical_record_trigger') value.envelope.normalized_payload.record_url = 'https://evil.example/issues/196'
      else if (value.envelope.normalized_payload.kind === 'pr_snapshot_trigger') value.envelope.normalized_payload.pr_url = 'https://evil.example/pull/196'
      else value.envelope.normalized_payload.source_api_url = 'https://evil.example/repos/whatrune/sd-prompt-studio/check-runs/196'
    }],
    ['immutable source external host', (value) => { value.envelope.immutable_source_refs = ['https://evil.example/evidence'] }],
    ['immutable source wrong repository', (value) => { value.envelope.immutable_source_refs = ['https://github.com/whatrune/other-repository/issues/196'] }],
  ]
  for (const [label, mutate] of envelopeNegativeCases) {
    const candidate = clone(positiveOutcome)
    mutate(candidate)
    expectRejected(api.validateCanonicalEventAdmissionOutcomeV1(candidate), `focused envelope ${label}`)
  }
  const mutableOutcome = clone(positiveOutcome)
  const admittedOutcome = api.validateCanonicalEventAdmissionOutcomeV1(mutableOutcome)
  assert.equal(admittedOutcome.kind, 'accepted')
  mutableOutcome.envelope.actor.login = 'mutated'
  assert.notEqual(admittedOutcome.value.envelope.actor.login, 'mutated')
  assert.ok(Object.isFrozen(admittedOutcome.value.envelope.actor))
  focusedChecks += 1

  const carrier = clone(validProgressionInput)
  const ready = {
    contract_version: 'canonical-event-evaluator-binding-outcome-v1',
    kind: 'ready',
    evaluated_at: '2026-07-24T00:00:00Z',
    snapshot_id: `github-fresh-snapshot-v1:sha256:${'2'.repeat(64)}`,
    triggering_event_ids: [`github-event-v1:sha256:${'3'.repeat(64)}`],
    triggering_generation_keys: [`github-freshness-generation-v1:sha256:${'1'.repeat(64)}`],
    input: carrier,
  }
  expectAccepted(api.validateEvaluatorBindingOutcomeV1(ready), 'focused ready accepted')
  expectRejected(api.validateEvaluatorBindingOutcomeV1(unknownField(ready)), 'focused ready closed')
  expectAccepted(
    progressionApi.validateAutomaticGateProgressionEvaluationInputV2(carrier),
    'focused AGP input authority accepted',
  )
  const readyNegativeCases = [
    ['missing', (value) => { delete value.input.task_assignment.assigned_role }],
    ['unknown', (value) => { value.input.task_assignment.zz_unknown = true }],
    ['type', (value) => { value.input.task_id = 7 }],
    ['enum', (value) => { value.input.repository = 'other/repository' }],
    ['timestamp', (value) => { value.input.evaluated_at = 'not-a-timestamp' }],
    ['reference', (value) => { value.input.result_handoff.canonical_record = 'not-a-canonical-reference' }],
    ['conditional', (value) => { value.input.result_handoff.execution_stop_reason = 'architecture_gap' }],
    ['root-unknown', (value) => { value.input.zz_unknown = true }],
  ]
  for (const [label, mutate] of readyNegativeCases) {
    const candidate = clone(ready)
    mutate(candidate)
    const directAdmission = progressionApi.validateAutomaticGateProgressionEvaluationInputV2(candidate.input)
    expectRejected(directAdmission, `focused AGP input ${label}`)
    const readyAdmission = api.validateEvaluatorBindingOutcomeV1(candidate)
    expectRejected(readyAdmission, `focused ready ${label}`)
    assert.ok(readyAdmission.rejection.path.startsWith('/input'), `focused ready path ${label}`)

    const session = api.createCanonicalEventInvocationTestSessionV1({
      contract_version: 'canonical-event-invocation-test-session-v1',
      fault_mode: 'none',
    })
    assert.equal(session.kind, 'accepted', `focused ready session ${label}`)
    const outcome = api.invokeAutomaticGateProgressionForCanonicalEventsV1(candidate, session.value)
    assert.equal(outcome.kind, 'failed', `focused ready outcome kind ${label}`)
    assert.equal(outcome.failure.code, 'ready_binding_contract_invalid', `focused ready outcome code ${label}`)
    const evidence = api.readCanonicalEventInvocationTestEvidenceV1(session.value)
    assert.equal(evidence.kind, 'accepted', `focused ready evidence ${label}`)
    assert.deepEqual(evidence.value.ordered_trace, ['ready_admission'], `focused ready trace ${label}`)
    assert.deepEqual(evidence.value.call_counts, {
      ready_validator: 1,
      evaluator: 0,
      result_validator: 0,
      outcome_validator: 0,
      terminal_anchor_validator: 0,
    }, `focused ready calls ${label}`)
    assert.equal(evidence.value.fallback_depth, 0, `focused ready fallback ${label}`)
    assert.equal(evidence.value.retry_count, 0, `focused ready retry ${label}`)
    focusedChecks += 6
  }
  const invocationOutcome = artifact.executable_rows.invocation[1].expected_outcome
  expectAccepted(api.validateCanonicalEventEvaluatorInvocationOutcomeV1(invocationOutcome), 'focused invocation outcome accepted')
  expectRejected(api.validateCanonicalEventEvaluatorInvocationOutcomeV1(unknownField(invocationOutcome)), 'focused invocation outcome closed')
  const snapshot = {
    contract_version: 'fresh-progression-snapshot-v1',
    snapshot_id: `github-fresh-snapshot-v1:sha256:${'4'.repeat(64)}`,
    collected_at: '2026-07-24T00:00:00Z',
    collector: {
      collector_id: 'sd-prompt-studio-fresh-progression-collector',
      collector_version: 'collector-v1',
    },
    repository: 'whatrune/sd-prompt-studio',
    triggering_generation_keys: [`github-freshness-generation-v1:sha256:${'1'.repeat(64)}`],
    scope_resolution: { kind: 'single' },
    target_evaluator_contract_version: 'automatic-gate-progression-evaluation-input-v2',
    input_candidate: carrier,
    input_candidate_content_sha256: `sha256:${'5'.repeat(64)}`,
    field_evidence: [],
    collection_ordering: 'fresh-progression-field-order-v1',
  }
  expectAccepted(api.validateFreshProgressionSnapshotV1(snapshot), 'focused snapshot accepted')
  expectRejected(api.validateFreshProgressionSnapshotV1(unknownField(snapshot)), 'focused snapshot closed')

  const validGenerationResult = artifact.executable_rows.generation[0].expected_outcome.result
  expectAccepted(api.validateFreshnessGenerationTransitionResultV1(validGenerationResult), 'focused generation result accepted')
  expectRejected(api.validateFreshnessGenerationTransitionResultV1(unknownField(validGenerationResult)), 'focused generation result closed')
  assert.equal(api.transactFreshnessGenerationV1.length, 2)
  focusedChecks += 1
  let generationPortCalls = 0
  const badRequest = { ...clone(artifact.executable_rows.generation[0].input.request), zz_unknown: true }
  expectRejected(await api.transactFreshnessGenerationV1(badRequest, {
    transact: async () => {
      generationPortCalls += 1
      return validGenerationResult
    },
  }), 'focused generation request closed')
  assert.equal(generationPortCalls, 0)
  focusedChecks += 1
  expectRejected(await api.transactFreshnessGenerationV1(artifact.executable_rows.generation[0].input.request, {
    transact: async () => ({ ...clone(validGenerationResult), zz_unknown: true }),
  }), 'focused generation malformed port result')
  const failedGeneration = await api.transactFreshnessGenerationV1(artifact.executable_rows.generation[0].input.request, {
    transact: async () => { throw new Error('fault') },
  })
  assert.equal(failedGeneration.kind, 'failed')
  focusedChecks += 1

  const malformedFactory = api.createCanonicalEventInvocationTestSessionV1({
    contract_version: 'canonical-event-invocation-test-session-v1',
    fault_mode: 'none',
    zz_unknown: true,
  })
  expectRejected(malformedFactory, 'focused session factory closed')
  expectRejected(api.createCanonicalEventInvocationTestSessionV1({
    contract_version: 'canonical-event-invocation-test-session-v1',
    fault_mode: 'future_mode',
  }), 'focused session mode closed')
  let fabricatedReads = 0
  const unreadCandidate = new Proxy({}, {
    ownKeys() {
      fabricatedReads += 1
      return []
    },
  })
  const fabricatedOutcome = api.invokeAutomaticGateProgressionForCanonicalEventsV1(unreadCandidate, Object.freeze({}))
  assert.equal(fabricatedOutcome.failure.code, 'ready_binding_contract_invalid')
  assert.equal(fabricatedReads, 0)
  focusedChecks += 1
  const reuseSession = api.createCanonicalEventInvocationTestSessionV1({
    contract_version: 'canonical-event-invocation-test-session-v1',
    fault_mode: 'none',
  })
  assert.equal(reuseSession.kind, 'accepted')
  api.invokeAutomaticGateProgressionForCanonicalEventsV1(ready, reuseSession.value)
  const reuseEvidence = api.readCanonicalEventInvocationTestEvidenceV1(reuseSession.value)
  assert.equal(reuseEvidence.kind, 'accepted')
  let reuseReads = 0
  const reuseCandidate = new Proxy({}, {
    ownKeys() {
      reuseReads += 1
      return []
    },
  })
  const reuseOutcome = api.invokeAutomaticGateProgressionForCanonicalEventsV1(reuseCandidate, reuseSession.value)
  assert.equal(reuseOutcome.failure.code, 'ready_binding_contract_invalid')
  assert.equal(reuseReads, 0)
  focusedChecks += 1
  const runningSession = api.createCanonicalEventInvocationTestSessionV1({
    contract_version: 'canonical-event-invocation-test-session-v1',
    fault_mode: 'none',
  })
  assert.equal(runningSession.kind, 'accepted')
  let observedRunning = false
  const runningCandidate = new Proxy(clone(ready), {
    ownKeys(target) {
      const runningEvidence = api.readCanonicalEventInvocationTestEvidenceV1(runningSession.value)
      observedRunning ||= runningEvidence.kind === 'accepted' && runningEvidence.value.lifecycle === 'running'
      return Reflect.ownKeys(target)
    },
  })
  api.invokeAutomaticGateProgressionForCanonicalEventsV1(runningCandidate, runningSession.value)
  assert.equal(observedRunning, true)
  assert.equal(api.readCanonicalEventInvocationTestEvidenceV1(runningSession.value).kind, 'accepted')
  focusedChecks += 1

  const invalidAgpResult = unknownField(invocationOutcome.evaluator_result)
  expectRejected(api.validateCanonicalEventEvaluatorInvocationOutcomeV1({
    ...clone(invocationOutcome),
    evaluator_result: invalidAgpResult,
  }), 'focused sole AGP result authority')
  const mutableReady = clone(ready)
  const admittedReady = api.validateEvaluatorBindingOutcomeV1(mutableReady)
  assert.equal(admittedReady.kind, 'accepted')
  mutableReady.input.task_id = 'mutated'
  assert.equal(admittedReady.value.input.task_id, 'task-001')
  assert.ok(Object.isFrozen(admittedReady.value.input))
  focusedChecks += 1

  const positivePorts = portById.get('CEA-A4-FIX-CEA-MAP-001')
  const makeAdmissionPorts = (overrides = {}) => ({
    canonicalize_jcs: (value) => ({
      contract_version: 'canonical-event-port-result-v1',
      kind: 'ok',
      value: new TextEncoder().encode(canonicalize(value)),
    }),
    sha256: (value) => ({
      contract_version: 'canonical-event-port-result-v1',
      kind: 'ok',
      value: shaRef(Buffer.from(value)),
    }),
    ledger_transact: async () => ({
      contract_version: 'canonical-event-ledger-transaction-result-v1',
      ...clone(positivePorts.ledger_transact),
    }),
    ...overrides,
  })
  const sourceIdentityCases = [
    {
      label: 'valid repository source identity',
      operation: { kind: 'none' },
      expectedKind: positive.expected_accepted_outcome.kind,
    },
    {
      label: 'external host HTML URL',
      operation: {
        kind: 'replace',
        path: '/provider_payload/issue/html_url',
        value: 'https://evil.example/issues/196',
      },
      expectedKind: 'rejected',
      expectedPath: '/provider_payload/issue/html_url',
    },
    {
      label: 'wrong repository API URL',
      operation: {
        kind: 'replace',
        path: '/provider_payload/issue/url',
        value: 'https://api.github.com/repos/whatrune/other-repository/issues/196',
      },
      expectedKind: 'rejected',
      expectedPath: '/provider_payload/issue/url',
    },
    {
      label: 'wrong repository HTML URL',
      operation: {
        kind: 'replace',
        path: '/provider_payload/issue/html_url',
        value: 'https://github.com/whatrune/other-repository/issues/196',
      },
      expectedKind: 'rejected',
      expectedPath: '/provider_payload/issue/html_url',
    },
  ]
  for (const sourceIdentityCase of sourceIdentityCases) {
    const candidate = rebuild(positive, sourceIdentityCase.operation)
    const calls = { canonicalize_jcs: 0, sha256: 0, ledger_transact: 0 }
    const durableEvidence = []
    const outcome = await api.admitCanonicalGitHubEventV1(
      candidate.invocation,
      candidate.rawInput,
      makeAdmissionPorts({
        canonicalize_jcs: (value) => {
          calls.canonicalize_jcs += 1
          return {
            contract_version: 'canonical-event-port-result-v1',
            kind: 'ok',
            value: new TextEncoder().encode(canonicalize(value)),
          }
        },
        sha256: (value) => {
          calls.sha256 += 1
          return {
            contract_version: 'canonical-event-port-result-v1',
            kind: 'ok',
            value: shaRef(Buffer.from(value)),
          }
        },
        ledger_transact: async (request) => {
          calls.ledger_transact += 1
          durableEvidence.push(clone(request))
          return {
            contract_version: 'canonical-event-ledger-transaction-result-v1',
            ...clone(positivePorts.ledger_transact),
          }
        },
      }),
    )
    assert.equal(outcome.kind, sourceIdentityCase.expectedKind, sourceIdentityCase.label)
    if (sourceIdentityCase.expectedKind === 'rejected') {
      assert.equal(outcome.rejection.code, 'repository_mismatch', `${sourceIdentityCase.label} code`)
      assert.equal(outcome.rejection.stage, 'source_identity', `${sourceIdentityCase.label} stage`)
      assert.equal(outcome.rejection.path, sourceIdentityCase.expectedPath, `${sourceIdentityCase.label} path`)
      assert.deepEqual(calls, { canonicalize_jcs: 0, sha256: 1, ledger_transact: 0 }, `${sourceIdentityCase.label} calls`)
      assert.deepEqual(expectedTraceFor(outcome), ['P', 'S', 'B', 'A', 'C', 'R'], `${sourceIdentityCase.label} trace`)
      assert.deepEqual(durableEvidence, [], `${sourceIdentityCase.label} durable evidence`)
    } else {
      assert.deepEqual(outcome, positive.expected_accepted_outcome, `${sourceIdentityCase.label} outcome`)
      assert.deepEqual(calls, positive.expected_call_counts, `${sourceIdentityCase.label} calls`)
      assert.equal(durableEvidence.length, 1, `${sourceIdentityCase.label} durable evidence`)
    }
    focusedChecks += 1
  }
  const invalidShaOutcome = await api.admitCanonicalGitHubEventV1(
    positive.invocation,
    positive.raw_input,
    makeAdmissionPorts({
      sha256: () => ({ contract_version: 'canonical-event-port-result-v1', kind: 'ok', value: 'invalid' }),
    }),
  )
  assert.equal(invalidShaOutcome.kind, 'failed')
  assert.equal(invalidShaOutcome.failure.code, 'port_contract_invalid')
  assert.equal(invalidShaOutcome.failure.stage, 'port_contract')
  assert.equal(invalidShaOutcome.failure.operation, 'sha256')
  focusedChecks += 1
  const ledgerThrowOutcome = await api.admitCanonicalGitHubEventV1(
    positive.invocation,
    positive.raw_input,
    makeAdmissionPorts({
      ledger_transact: async () => { throw new Error('fault') },
    }),
  )
  assert.equal(ledgerThrowOutcome.kind, 'failed')
  assert.equal(ledgerThrowOutcome.failure.code, 'ledger_transaction_internal_failure')
  assert.equal(ledgerThrowOutcome.failure.stage, 'ledger_transaction')
  assert.equal(ledgerThrowOutcome.failure.operation, null)
  assert.notEqual(ledgerThrowOutcome.failure.diagnostic_id, `cea-failure-v1:${'0'.repeat(64)}`)
  const failureProjection = {
    contract_version: 'canonical-event-admission-outcome-v1',
    code: ledgerThrowOutcome.failure.code,
    stage: ledgerThrowOutcome.failure.stage,
    operation: ledgerThrowOutcome.failure.operation,
    delivery_id: ledgerThrowOutcome.delivery_id,
    raw_payload_sha256: ledgerThrowOutcome.raw_payload_sha256,
    evaluated_at: ledgerThrowOutcome.evaluated_at,
  }
  assert.equal(
    ledgerThrowOutcome.failure.diagnostic_id,
    `cea-failure-v1:${shaHex(canonicalize(failureProjection))}`,
  )
  focusedChecks += 1
  const invalidLedgerOutcome = await api.admitCanonicalGitHubEventV1(
    positive.invocation,
    positive.raw_input,
    makeAdmissionPorts({
      ledger_transact: async () => ({
        contract_version: 'canonical-event-ledger-transaction-result-v1',
        ...clone(positivePorts.ledger_transact),
        zz_unknown: true,
      }),
    }),
  )
  assert.equal(invalidLedgerOutcome.kind, 'failed')
  assert.equal(invalidLedgerOutcome.failure.code, 'port_contract_invalid')
  assert.equal(invalidLedgerOutcome.failure.operation, 'ledger_transact')
  focusedChecks += 1

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
    focused_contract_checks: focusedChecks,
  }))
} finally {
  await server.close()
}
