import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createServer } from 'vite'

const clone = (value) => structuredClone(value)
const canonicalize = (value) =>
  value === null || typeof value !== 'object'
    ? JSON.stringify(value)
    : Array.isArray(value)
      ? `[${value.map(canonicalize).join(',')}]`
      : `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`
const shaText = (value) => `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`
const shaJcs = (value) => shaText(canonicalize(value))
const fixedDigest = (digit) => `sha256:${digit.repeat(64)}`
const HEAD = 'a'.repeat(40)
const BASE = 'b'.repeat(40)
const PRIOR = 'c'.repeat(40)
const PR = 'https://github.com/whatrune/sd-prompt-studio/pull/207'
const TASK = 'https://github.com/whatrune/sd-prompt-studio/issues/206'
const PROJECTION_AUTH =
  'https://github.com/whatrune/sd-prompt-studio/issues/206#issuecomment-5085964357'
const REVIEW =
  'https://github.com/whatrune/sd-prompt-studio/issues/206#issuecomment-5085953316'
const PRIOR_SET =
  'https://github.com/whatrune/sd-prompt-studio/issues/206#issuecomment-5086000001'
const TRANSPORT_AUTH =
  'https://github.com/whatrune/sd-prompt-studio/issues/206#issuecomment-5086000002'
const RECEIPT_AUTH =
  'https://github.com/whatrune/sd-prompt-studio/issues/206#issuecomment-5086000003'
const RECEIPT_STORE_AUTH =
  'https://github.com/whatrune/sd-prompt-studio/issues/206#issuecomment-5086000004'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
try {
  const api = await server.ssrLoadModule('/src/gate-status-publisher/index.ts')
  const row = (value, evidence_urls = []) => ({
    value,
    evidence_urls,
    next_action: null,
    next_owner: null,
  })
  const projection = (head = HEAD) => ({
    contract_version: 'gate-status-projection-v1',
    current_head: row(head, [PROJECTION_AUTH]),
    final_regression: row('pending'),
    operational_validation: row('unperformed'),
    pr_state_draft: row('open_draft', [PROJECTION_AUTH]),
    ready: row('unperformed'),
    approve: row('unperformed'),
    merge: row('unperformed'),
    current_blocker_next_gate: {
      blocker_id: null,
      next_action: null,
      next_owner: null,
      evidence_urls: [REVIEW],
    },
    historical_evidence: [],
  })
  const requirement = {
    required: true,
    authorized_metadata_role: 'backend_implementer',
    pr: PR,
    current_head: HEAD,
    required_gate_fields: [
      'current_head',
      'final_regression',
      'operational_validation',
      'pr_state',
      'draft_state',
      'ready',
      'approve',
      'merge',
      'next_gate_owner',
    ],
    citation_urls: [REVIEW],
    reason: 'missing',
    must_verify_after_write: true,
  }
  const evaluatorResult = {
    contract_version: 'automatic-gate-progression-evaluation-result-v2',
    task_id: 'DESIGN-GATE-STATUS-PUBLISHER-CONTRACT-001',
    evaluated_at: '2026-07-26T23:00:00Z',
    input_fingerprint: `agp-input-v2:sha256:${'d'.repeat(64)}`,
    precedence_trace: ['structural_admission', 'gate_status_projection'],
    gate_status_requirement: requirement,
    kind: 'require_gate_status_update',
    requirement: clone(requirement),
  }
  assert.equal(api.gateStatusJcsSha256V1(evaluatorResult), shaJcs(evaluatorResult), 'JCS/SHA parity')
  assert.equal(
    api.validateAutomaticGateProgressionEvaluationResultV2?.(evaluatorResult),
    undefined,
    'Publisher must not re-export evaluator validator',
  )

  const evidenceRecords = [
    {
      evidence_class: 'canonical_role_record',
      evidence_kind: 'task_assignment',
      canonical_url: TASK,
      authoring_role: 'integrated_lead',
      task_id: 'DESIGN-GATE-STATUS-PUBLISHER-CONTRACT-001',
      repository: 'whatrune/sd-prompt-studio',
      head_binding: { state: 'not_head_bound', basis_url: TASK },
      fetched_content_sha256: fixedDigest('1'),
      verification_state: 'verified',
    },
    {
      evidence_class: 'canonical_role_record',
      evidence_kind: 'review_decision',
      canonical_url: REVIEW,
      authoring_role: 'architect_team',
      task_id: 'DESIGN-GATE-STATUS-PUBLISHER-CONTRACT-001',
      repository: 'whatrune/sd-prompt-studio',
      head_binding: { state: 'current', head: HEAD },
      fetched_content_sha256: fixedDigest('2'),
      verification_state: 'verified',
    },
    {
      evidence_class: 'canonical_role_record',
      evidence_kind: 'projection_authorization',
      canonical_url: PROJECTION_AUTH,
      authoring_role: 'integrated_lead',
      task_id: 'DESIGN-GATE-STATUS-PUBLISHER-CONTRACT-001',
      repository: 'whatrune/sd-prompt-studio',
      head_binding: { state: 'current', head: HEAD },
      fetched_content_sha256: fixedDigest('3'),
      verification_state: 'verified',
    },
  ].sort((a, b) => Buffer.from(a.canonical_url).compare(Buffer.from(b.canonical_url)))

  const taskAuthority = {
    task_id: 'DESIGN-GATE-STATUS-PUBLISHER-CONTRACT-001',
    assignment_revision: 1,
    repository: 'whatrune/sd-prompt-studio',
    assigned_role: 'backend_implementer',
    allowed_actions: ['publish_gate_status_projection'],
    forbidden_actions: [],
  }

  const make = ({
    current = false,
    atomic = false,
    receipt = false,
    bodyPrefix = 'Purpose\r\nユニコード🙂\r\n\r\n',
    bodySuffix = '\r\n\r\n## Scope boundary\r\noutside\r\n',
  } = {}) => {
    const desired = projection()
    const displayed = current ? desired : projection(PRIOR)
    const section = api.renderGateStatusProjectionV1(displayed)
    assert.ok(section)
    const body = `${bodyPrefix}${section}${bodySuffix}`
    const snapshot = {
      contract_version: 'github-body-snapshot-v1',
      source_kind: 'github_pull_request',
      pr_url: PR,
      pr_number: 207,
      head: HEAD,
      base: BASE,
      state: 'open',
      draft: true,
      body_utf8_sha256: shaText(body),
      fetched_at: '2026-07-26T23:01:00Z',
      etag: { state: 'absent' },
    }
    const authorization = {
      authoring_role: 'backend_implementer',
      canonical_record: PROJECTION_AUTH,
      task_id: 'DESIGN-GATE-STATUS-PUBLISHER-CONTRACT-001',
      assignment_revision: 1,
      repository: 'whatrune/sd-prompt-studio',
      pr_url: PR,
      head: HEAD,
      base: BASE,
      evaluator_input_fingerprint: evaluatorResult.input_fingerprint,
      evaluator_result_sha256: shaJcs(evaluatorResult),
      projection: desired,
      projection_sha256: shaJcs(desired),
    }
    const transport = atomic
      ? {
          kind: 'proven_atomic_compare_and_swap',
          provider: 'test-atomic-provider',
          adapter_id: 'test-adapter',
          adapter_version: '1.0.0',
          atomic_scope: 'complete_pr_body',
          capability_authority_url: TRANSPORT_AUTH,
          conditional_write_supported: true,
          publisher_mutation_allowed: true,
          atomic_revision_identity: {
            contract_version: 'provider-atomic-revision-identity-v1',
            identity_kind: 'exact_value_frozen_by_transport_capability_authority',
            normalized_identity_sha256: fixedDigest('4'),
          },
        }
      : {
          kind: 'github_pr_body_patch_without_atomic_precondition',
          provider: 'github',
          update_endpoint: 'https://docs.github.com/en/rest/issues/issues#update-an-issue',
          conditional_write_supported: false,
          publisher_mutation_allowed: false,
          recovery_protocol: 'authorized_metadata_role_update_then_fresh_reconciliation',
        }
    const input = {
      contract_version: 'gate-status-publication-input-v1',
      identity: {
        task_id: 'DESIGN-GATE-STATUS-PUBLISHER-CONTRACT-001',
        assignment_revision: 1,
        repository: 'whatrune/sd-prompt-studio',
        task_assignment_url: TASK,
        projection_authority_url: PROJECTION_AUTH,
        authorized_metadata_role: 'backend_implementer',
        authorized_transport_action: 'publish_gate_status_projection',
        pr_url: PR,
        pr_number: 207,
        branch: { state: 'assigned', value: 'codex/issue-206-gate-status-publisher-v1' },
        worktree: { state: 'assigned', value: 'issue-206-gate-status-publisher-v1' },
        expected_head: HEAD,
        expected_base: BASE,
      },
      evaluator: {
        admission_state: 'accepted',
        result: clone(evaluatorResult),
        result_sha256: shaJcs(evaluatorResult),
      },
      projection_authorization: authorization,
      evidence_records: clone(evidenceRecords),
      pr_snapshot: {
        snapshot,
        body_utf8: body,
        body_matches_snapshot_sha256: true,
      },
      prior_attempt_authorities: {
        contract_version: 'gate-status-prior-attempt-authority-set-v1',
        authority_set_url: PRIOR_SET,
        authoring_role: 'backend_implementer',
        task_id: 'DESIGN-GATE-STATUS-PUBLISHER-CONTRACT-001',
        assignment_revision: 1,
        repository: 'whatrune/sd-prompt-studio',
        pr_url: PR,
        pr_number: 207,
        head: HEAD,
        base: BASE,
        publication_key: `gate-status-publication-v1:sha256:${'0'.repeat(64)}`,
        completeness: 'complete_for_publication_key',
        state: 'absent',
        records: [],
        fetched_content_sha256: fixedDigest('5'),
        verification_state: 'verified',
      },
      prior_attempt_reconciliation_observation: { state: 'not_required' },
      prior_receipt: { state: 'absent' },
      receipt_authority: receipt
        ? {
            state: 'authorized',
            owner_role: 'backend_implementer',
            canonical_record: RECEIPT_AUTH,
          }
        : { state: 'not_authorized' },
      receipt_store_capability: receipt
        ? {
            state: 'admitted',
            value: {
              contract_version: 'gate-status-receipt-store-capability-v1',
              kind: 'proven_atomic_create_or_get',
              provider: 'test-receipt-store',
              adapter_id: 'receipt-adapter',
              adapter_version: '1.0.0',
              capability_authority_url: RECEIPT_STORE_AUTH,
              key_namespace: 'gate-status-publication-receipt-v1',
              unique_key: `gate-status-publication-v1:sha256:${'0'.repeat(64)}`,
              consistency: 'linearizable',
              operation: 'atomic_create_or_get',
              supported_outcomes: [
                'created',
                'existing_exact',
                'existing_conflict',
                'failed_before_commit',
                'indeterminate',
              ],
            },
          }
        : { state: 'not_required' },
      transport_capability: transport,
    }
    const key = api.buildGateStatusPublicationKeyV1(input)
    assert.ok(key)
    input.prior_attempt_authorities.publication_key = key
    if (receipt) input.receipt_store_capability.value.unique_key = key
    const admission = api.validateGateStatusPublicationInputV1(input)
    assert.equal(admission.accepted, true, JSON.stringify(admission))
    return { input, body, snapshot, desired, key }
  }

  const makePorts = (
    fixture,
    {
      cas = 'applied',
      receipt = 'created',
      unavailable = new Set(),
      invalid = new Set(),
      readback = 'exact',
      throwAt = null,
    } = {},
  ) => {
    const counts = { canonical: 0, pr_read: 0, cas: 0, receipt: 0, retry_write: 0 }
    let replacementBody = null
    let storedReceipt = null
    const map = new Map([
      ...fixture.input.evidence_records.map((item) => [item.canonical_url, item]),
      [TASK, taskAuthority],
      [PROJECTION_AUTH, fixture.input.projection_authorization],
      [PRIOR_SET, fixture.input.prior_attempt_authorities],
    ])
    if (fixture.input.transport_capability.capability_authority_url) {
      map.set(TRANSPORT_AUTH, fixture.input.transport_capability)
    }
    if (fixture.input.receipt_authority.state === 'authorized') {
      map.set(RECEIPT_AUTH, fixture.input.receipt_authority)
      map.set(RECEIPT_STORE_AUTH, fixture.input.receipt_store_capability.value)
    }
    const ports = {
      read_canonical_record: async (url) => {
        counts.canonical += 1
        if (throwAt === 'canonical') throw new Error('secret-token')
        if (unavailable.has(url)) return { state: 'unavailable' }
        const content = clone(map.get(url))
        if (invalid.has(url)) content.invalid = true
        const evidence = fixture.input.evidence_records.find((item) => item.canonical_url === url)
        const prior = fixture.input.prior_attempt_authorities.records.find(
          (item) => item.canonical_record === url,
        )
        const digestValue =
          evidence?.fetched_content_sha256 ??
          prior?.fetched_content_sha256 ??
          content?.fetched_content_sha256 ??
          (url === PRIOR_SET
            ? fixture.input.prior_attempt_authorities.fetched_content_sha256
            : fixedDigest('9'))
        return { state: 'available', canonical_url: url, fetched_content_sha256: digestValue, content }
      },
      read_pr: async () => {
        counts.pr_read += 1
        if (throwAt === 'read_pr') throw new Error('secret-token')
        if (counts.pr_read === 1 || replacementBody === null) {
          return { state: 'available', snapshot: clone(fixture.snapshot), body_utf8: fixture.body }
        }
        if (readback === 'unavailable') return { state: 'unavailable' }
        const body =
          readback === 'mismatch'
            ? replacementBody.replace('outside', 'outside-mutated')
            : replacementBody
        return {
          state: 'available',
          snapshot: {
            ...clone(fixture.snapshot),
            body_utf8_sha256: shaText(body),
            fetched_at: '2026-07-26T23:02:00Z',
          },
          body_utf8: body,
        }
      },
      compare_and_swap_gate_status: async (request) => {
        counts.cas += 1
        if (counts.cas > 1) counts.retry_write += 1
        replacementBody = request.replacement_body_utf8
        if (throwAt === 'cas') throw new Error('secret-token')
        if (cas === 'applied') {
          return { state: 'applied', normalized_revision_identity_sha256: fixedDigest('6') }
        }
        return { state: cas }
      },
      receipt_create_or_get: async ({ candidate }) => {
        counts.receipt += 1
        if (throwAt === 'receipt') throw new Error('secret-token')
        if (receipt === 'created') {
          storedReceipt = clone(candidate)
          return { state: 'created', receipt_url: candidate.receipt_url, receipt: storedReceipt }
        }
        if (receipt === 'existing_exact') {
          storedReceipt ??= clone(candidate)
          return { state: 'existing_exact', receipt_url: candidate.receipt_url, receipt: storedReceipt }
        }
        return { state: receipt }
      },
    }
    return { ports, counts, map }
  }

  const execute = async (fixture, options) => {
    const harness = makePorts(fixture, options)
    const result = await api.publishGateStatusV1(clone(fixture.input), harness.ports)
    assert.equal(api.validateGateStatusPublicationResultV1(result).accepted, true)
    assert.ok(Object.isFrozen(result))
    return { result, ...harness }
  }

  const evidence = []
  const caseResult = async (id, run) => {
    const before = evidence.length
    await run()
    evidence.push(id)
    assert.equal(evidence.length, before + 1)
  }

  await caseResult('GSP-001', async () => {
    const noCas = await execute(make())
    assert.equal(noCas.result.kind, 'stopped')
    assert.equal(noCas.result.branch.stopped.stop_code, 'atomic_precondition_unavailable')
    assert.equal(noCas.counts.cas, 0)
    const applied = await execute(make({ atomic: true }))
    assert.equal(applied.result.kind, 'applied')
    assert.deepEqual(applied.result.write_state, {
      attempted: true,
      observed: true,
      verified: true,
      confirmation: 'direct_response_and_readback',
    })
    assert.equal(applied.counts.cas, 1)
  })

  await caseResult('GSP-002', async () => {
    const result = await execute(make({ current: true }))
    assert.equal(result.result.kind, 'already_current', JSON.stringify(result.result))
    assert.equal(result.counts.cas, 0)
  })

  await caseResult('GSP-003', async () => {
    const fixture = make({ current: true })
    const first = await execute(fixture)
    const second = await execute(fixture)
    assert.deepEqual(first.result, second.result)
    assert.equal(first.result.publication_binding.publication_key, second.result.publication_binding.publication_key)
  })

  await caseResult('GSP-004', async () => {
    for (const mutate of [
      (input) => { input.unknown = true },
      (input) => { input.identity.unknown = true },
      (input) => { input.projection_authorization.projection.ready.unknown = true },
    ]) {
      const fixture = make()
      mutate(fixture.input)
      const { result, counts } = await execute(fixture)
      assert.equal(result.branch.stopped.stop_code, 'structural_admission_failed')
      assert.equal(counts.cas, 0)
    }
  })

  await caseResult('GSP-005', async () => {
    const fixture = make()
    fixture.input.evidence_records.reverse()
    const result = await execute(fixture)
    assert.equal(result.result.branch.stopped.stop_code, 'structural_admission_failed')
  })

  await caseResult('GSP-006', async () => {
    for (const value of ['abc', 'D'.repeat(40)]) {
      const fixture = make()
      fixture.input.identity.expected_head = value
      const result = await execute(fixture)
      assert.equal(result.result.kind, 'stopped')
      assert.equal(result.counts.cas, 0)
    }
  })

  await caseResult('GSP-007', async () => {
    const fixture = make()
    const result = await execute(fixture, { invalid: new Set([TASK]) })
    assert.equal(result.result.branch.stopped.stop_code, 'metadata_transport_unauthorized')
  })

  await caseResult('GSP-008', async () => {
    const fixture = make()
    fixture.input.evaluator.result.kind = 'no_transition'
    fixture.input.evaluator.result.wait_reason = 'no_declared_transition'
    fixture.input.evaluator.result.required_future_canonical_event = 'direct_same_task_decision'
    delete fixture.input.evaluator.result.requirement
    fixture.input.evaluator.result.gate_status_requirement = { required: false }
    fixture.input.evaluator.result_sha256 = shaJcs(fixture.input.evaluator.result)
    fixture.input.projection_authorization.evaluator_result_sha256 =
      fixture.input.evaluator.result_sha256
    const result = await execute(fixture)
    assert.equal(result.result.kind, 'stopped')
    assert.equal(result.counts.cas, 0)
  })

  await caseResult('GSP-009', async () => {
    const fixture = make()
    fixture.input.projection_authorization.head = PRIOR
    const result = await execute(fixture)
    assert.equal(result.result.kind, 'stopped')
  })

  await caseResult('GSP-010', async () => {
    const fixture = make()
    const result = await execute(fixture, { unavailable: new Set([REVIEW]) })
    assert.equal(result.result.branch.stopped.stop_code, 'canonical_evidence_invalid')
  })

  await caseResult('GSP-011', async () => {
    const fixture = make()
    fixture.input.projection_authorization.projection.current_blocker_next_gate.blocker_id = 'blocking_finding'
    fixture.input.projection_authorization.projection_sha256 =
      shaJcs(fixture.input.projection_authorization.projection)
    const result = await execute(fixture)
    assert.equal(result.result.kind, 'stopped')
  })

  await caseResult('GSP-012', async () => {
    const fixture = make()
    const harness = makePorts(fixture)
    harness.ports.read_pr = async () => ({
      state: 'available',
      snapshot: { ...clone(fixture.snapshot), head: PRIOR },
      body_utf8: fixture.body,
    })
    const result = await api.publishGateStatusV1(clone(fixture.input), harness.ports)
    assert.equal(result.branch.stopped.stop_code, 'authority_drift')
    assert.equal(harness.counts.cas, 0)
  })

  await caseResult('GSP-013', async () => {
    const fixture = make()
    fixture.body = 'no section'
    fixture.snapshot.body_utf8_sha256 = shaText(fixture.body)
    fixture.input.pr_snapshot.body_utf8 = fixture.body
    fixture.input.pr_snapshot.snapshot.body_utf8_sha256 = fixture.snapshot.body_utf8_sha256
    const result = await execute(fixture)
    assert.equal(result.result.branch.stopped.stop_code, 'gate_status_section_invalid')
  })

  await caseResult('GSP-014', async () => {
    const fixture = make()
    fixture.body = `${fixture.body}\n${api.renderGateStatusProjectionV1(projection())}`
    fixture.snapshot.body_utf8_sha256 = shaText(fixture.body)
    fixture.input.pr_snapshot.body_utf8 = fixture.body
    fixture.input.pr_snapshot.snapshot.body_utf8_sha256 = fixture.snapshot.body_utf8_sha256
    const result = await execute(fixture)
    assert.equal(result.result.branch.stopped.stop_code, 'gate_status_section_invalid')
  })

  await caseResult('GSP-015', async () => {
    const fixture = make()
    fixture.input.projection_authorization.projection.ready.value = 'new_status'
    const result = await execute(fixture)
    assert.equal(result.result.branch.stopped.stop_code, 'structural_admission_failed')
  })

  await caseResult('GSP-016', async () => {
    const fixture = make()
    fixture.input.projection_authorization.projection.ready.next_action = 'ready_for_review'
    fixture.input.projection_authorization.projection.ready.next_owner = 'integrated_lead'
    fixture.input.projection_authorization.projection_sha256 =
      shaJcs(fixture.input.projection_authorization.projection)
    const result = await execute(fixture)
    assert.equal(result.result.kind, 'stopped')
    assert.equal(result.counts.cas, 0)
  })

  await caseResult('GSP-017', async () => {
    const fixture = make({ bodyPrefix: 'α\r\n', bodySuffix: '\r\n## End\r\nω\r\n' })
    const result = await execute(fixture, { readback: 'mismatch' })
    assert.equal(result.result.kind, 'stopped')
    assert.equal(result.counts.cas, 0)
  })

  await caseResult('GSP-018', async () => {
    const result = await execute(make({ atomic: true }), { cas: 'precondition_failed' })
    assert.equal(result.result.branch.stopped.stop_code, 'compare_and_swap_failed')
    assert.equal(result.counts.cas, 1)
  })

  await caseResult('GSP-019', async () => {
    const result = await execute(make())
    assert.equal(result.result.branch.stopped.stop_code, 'atomic_precondition_unavailable')
    assert.equal(result.counts.cas, 0)
  })

  await caseResult('GSP-020', async () => {
    const fixture = make({ current: true, receipt: true })
    const first = await execute(fixture, { receipt: 'created' })
    const second = await execute(fixture, { receipt: 'existing_exact' })
    assert.equal(first.result.kind, 'already_current')
    assert.equal(second.result.kind, 'already_current')
    assert.equal(first.counts.cas + second.counts.cas, 0)
  })

  await caseResult('GSP-021', async () => {
    const first = make({ atomic: true })
    const second = make({ atomic: true })
    second.input.projection_authorization.projection.final_regression.value = 'blocked'
    second.input.projection_authorization.projection_sha256 =
      shaJcs(second.input.projection_authorization.projection)
    second.key = api.buildGateStatusPublicationKeyV1(second.input)
    second.input.prior_attempt_authorities.publication_key = second.key
    const one = await execute(first)
    const two = await execute(second, { cas: 'precondition_failed' })
    assert.notEqual(one.result.publication_binding.publication_key, two.result.publication_binding.publication_key)
    assert.equal(one.counts.cas + two.counts.cas, 2)
  })

  await caseResult('GSP-022', async () => {
    const result = await execute(make({ atomic: true }), { cas: 'failed_before_write' })
    assert.equal(result.result.branch.stopped.stop_code, 'transport_unavailable_before_write')
    assert.deepEqual(result.result.write_state, {
      attempted: false,
      observed: false,
      verified: false,
      confirmation: 'none',
    })
  })

  const makePriorAttempt = ({ observation = 'available', records = 1, unreadable = false } = {}) => {
    const fixture = make({ current: true })
    const staleBody = `${'Purpose\r\nユニコード🙂\r\n\r\n'}${api.renderGateStatusProjectionV1(projection(PRIOR))}\r\n\r\n## Scope boundary\r\noutside\r\n`
    const staleInspection = api.inspectGateStatusSectionV1(staleBody)
    const atomicProjection = {
      contract_version: 'gate-status-atomic-operation-key-projection-v1',
      key_kind: 'proven_atomic_attempt',
      publication_key: fixture.key,
      transport_capability_authority_url: TRANSPORT_AUTH,
      provider: 'test-atomic-provider',
      adapter_id: 'test-adapter',
      adapter_version: '1.0.0',
      atomic_scope: 'complete_pr_body',
      atomic_revision_identity: {
        contract_version: 'provider-atomic-revision-identity-v1',
        identity_kind: 'exact_value_frozen_by_transport_capability_authority',
        normalized_identity_sha256: fixedDigest('4'),
      },
      precondition_body_utf8_sha256: shaText(staleBody),
      precondition_non_gate_sha256: staleInspection.non_gate_sha256,
      receipt_authority_state: 'not_authorized',
      receipt_store_capability_state: 'not_required',
      prior_receipt_state: 'absent',
      prior_receipt_url: null,
    }
    const atomicSha = shaJcs(atomicProjection)
    const record = (index) => ({
      contract_version: 'gate-status-prior-attempt-authority-v1',
      canonical_record: `${TASK}#issuecomment-508600001${index}`,
      record_type: 'gate_status_publication_attempt',
      authoring_role: 'backend_implementer',
      task_id: 'DESIGN-GATE-STATUS-PUBLISHER-CONTRACT-001',
      assignment_revision: 1,
      repository: 'whatrune/sd-prompt-studio',
      pr_url: PR,
      pr_number: 207,
      head: HEAD,
      base: BASE,
      publication_key: fixture.key,
      intended_projection_sha256: fixture.input.projection_authorization.projection_sha256,
      precondition_non_gate_sha256: staleInspection.non_gate_sha256,
      submission_scope: 'atomic_body_write',
      atomic_operation_projection: clone(atomicProjection),
      atomic_operation_projection_sha256: atomicSha,
      atomic_operation_key: `gate-status-publication-atomic-operation-v1:${atomicSha}`,
      transport_capability_authority_url: TRANSPORT_AUTH,
      submission_state: 'indeterminate',
      submitted_at: `2026-07-26T23:0${index}:00Z`,
      fetched_content_sha256: fixedDigest(String(6 + index)),
      verification_state: 'verified',
    })
    fixture.input.prior_attempt_authorities.state = records === 0 ? 'absent' : 'present'
    fixture.input.prior_attempt_authorities.records = Array.from({ length: records }, (_, i) => record(i + 1))
    const currentInspection = api.inspectGateStatusSectionV1(fixture.body)
    if (records === 1 && observation !== 'not_required') {
      const prior = fixture.input.prior_attempt_authorities.records[0]
      fixture.input.prior_attempt_reconciliation_observation =
        observation === 'unavailable'
          ? {
              state: 'unavailable',
              contract_version: 'gate-status-prior-attempt-reconciliation-observation-v1',
              canonical_record: `${TASK}#issuecomment-5086000021`,
              authoring_role: 'backend_implementer',
              task_id: 'DESIGN-GATE-STATUS-PUBLISHER-CONTRACT-001',
              repository: 'whatrune/sd-prompt-studio',
              pr_url: PR,
              head: HEAD,
              base: BASE,
              prior_attempt_authority_url: prior.canonical_record,
              publication_key: fixture.key,
              atomic_operation_key: prior.atomic_operation_key,
              transport_capability_authority_url: TRANSPORT_AUTH,
              observation_state: 'read_unavailable',
              observed_at: '2026-07-26T23:10:00Z',
              fetched_content_sha256: fixedDigest('8'),
              verification_state: 'verified',
            }
          : {
              state: 'available',
              contract_version: 'gate-status-prior-attempt-reconciliation-observation-v1',
              canonical_record: `${TASK}#issuecomment-5086000022`,
              authoring_role: 'backend_implementer',
              task_id: 'DESIGN-GATE-STATUS-PUBLISHER-CONTRACT-001',
              repository: 'whatrune/sd-prompt-studio',
              pr_url: PR,
              pr_number: 207,
              head: HEAD,
              base: BASE,
              prior_attempt_authority_url: prior.canonical_record,
              publication_key: fixture.key,
              atomic_operation_key: prior.atomic_operation_key,
              transport_capability_authority_url: TRANSPORT_AUTH,
              snapshot_identity: {
                source_kind: 'github_pull_request',
                pr_url: PR,
                pr_number: 207,
                head: HEAD,
                base: BASE,
                state: 'open',
                draft: true,
                body_utf8_sha256: fixture.snapshot.body_utf8_sha256,
              },
              post_read_atomic_revision_identity: {
                contract_version: 'provider-atomic-revision-identity-v1',
                identity_kind: 'exact_value_frozen_by_transport_capability_authority',
                normalized_identity_sha256: fixedDigest('9'),
              },
              observed_projection_sha256: fixture.input.projection_authorization.projection_sha256,
              observed_non_gate_sha256: currentInspection.non_gate_sha256,
              observed_at: '2026-07-26T23:10:00Z',
              fetched_content_sha256: fixedDigest('8'),
              verification_state: 'verified',
            }
    } else {
      fixture.input.prior_attempt_reconciliation_observation = { state: 'not_required' }
    }
    assert.equal(api.validateGateStatusPublicationInputV1(fixture.input).accepted, true)
    const harness = makePorts(fixture)
    harness.map.set(PRIOR_SET, fixture.input.prior_attempt_authorities)
    for (const item of fixture.input.prior_attempt_authorities.records) {
      harness.map.set(item.canonical_record, item)
    }
    const obs = fixture.input.prior_attempt_reconciliation_observation
    if (obs.canonical_record) harness.map.set(obs.canonical_record, obs)
    if (unreadable && fixture.input.prior_attempt_authorities.records[0]) {
      const target = fixture.input.prior_attempt_authorities.records[0].canonical_record
      const original = harness.ports.read_canonical_record
      harness.ports.read_canonical_record = async (url) =>
        url === target ? { state: 'unavailable' } : original(url)
    }
    return { fixture, harness }
  }

  await caseResult('GSP-023', async () => {
    const { fixture, harness } = makePriorAttempt()
    const result = await api.publishGateStatusV1(clone(fixture.input), harness.ports)
    assert.equal(result.kind, 'applied', JSON.stringify(result))
    assert.equal(result.write_state.confirmation, 'reconciled_after_indeterminate')
    assert.equal(harness.counts.cas, 0)
  })

  await caseResult('GSP-024', async () => {
    const unavailable = makePriorAttempt({ observation: 'unavailable' })
    let result = await api.publishGateStatusV1(clone(unavailable.fixture.input), unavailable.harness.ports)
    assert.equal(result.branch.reconciliation_required.reconciliation_code, 'post_write_read_unavailable')
    const missing = makePriorAttempt({ observation: 'not_required' })
    result = await api.publishGateStatusV1(clone(missing.fixture.input), missing.harness.ports)
    assert.equal(result.branch.stopped.stop_code, 'prior_attempt_observation_required')
    const unreadable = makePriorAttempt({ observation: 'not_required', unreadable: true })
    result = await api.publishGateStatusV1(clone(unreadable.fixture.input), unreadable.harness.ports)
    assert.equal(result.branch.stopped.stop_code, 'prior_attempt_authority_unavailable')
  })

  await caseResult('GSP-025', async () => {
    const result = await execute(make({ atomic: true }), { readback: 'unavailable' })
    assert.equal(result.result.branch.reconciliation_required.reconciliation_code, 'post_write_read_unavailable')
    assert.equal(result.counts.retry_write, 0)
  })

  await caseResult('GSP-026', async () => {
    const result = await execute(make({ atomic: true }), { readback: 'mismatch' })
    assert.equal(result.result.branch.reconciliation_required.reconciliation_code, 'readback_mismatch')
  })

  await caseResult('GSP-027', async () => {
    const result = await execute(make({ atomic: true }), { readback: 'mismatch' })
    assert.equal(result.result.kind, 'reconciliation_required')
    assert.equal(result.counts.cas, 1)
  })

  await caseResult('GSP-028', async () => {
    for (const receiptState of [
      'created',
      'existing_exact',
      'existing_conflict',
      'failed_before_commit',
      'indeterminate',
    ]) {
      const result = await execute(make({ current: true, receipt: true }), {
        receipt: receiptState,
      })
      if (receiptState === 'created' || receiptState === 'existing_exact') {
        assert.equal(result.result.kind, 'already_current')
      } else {
        assert.equal(result.result.kind, 'reconciliation_required')
      }
      assert.equal(result.counts.cas, 0)
    }
  })

  await caseResult('GSP-029', async () => {
    const result = await execute(make({ current: true, receipt: true }), {
      receipt: 'existing_conflict',
    })
    assert.equal(result.result.branch.reconciliation_required.reconciliation_code, 'receipt_conflict')
  })

  await caseResult('GSP-030', async () => {
    const first = make({ current: true })
    const second = make({ current: true })
    assert.equal(first.key, second.key)
    assert.deepEqual((await execute(first)).result, (await execute(second)).result)
  })

  await caseResult('GSP-031', async () => {
    const original = make()
    const mutations = [
      (x) => { x.input.identity.assignment_revision = 2; x.input.projection_authorization.assignment_revision = 2 },
      (x) => { x.input.identity.expected_head = 'e'.repeat(40); x.input.projection_authorization.head = 'e'.repeat(40) },
      (x) => { x.input.projection_authorization.projection.final_regression.value = 'blocked' },
      (x) => { x.input.evidence_records[1].canonical_url = `${TASK}#issuecomment-5086000099` },
    ]
    for (const mutate of mutations) {
      const item = make()
      mutate(item)
      assert.notEqual(api.buildGateStatusPublicationKeyV1(item.input), original.key)
      const result = await execute(item)
      assert.ok(['stopped', 'already_current'].includes(result.result.kind))
    }
  })

  await caseResult('GSP-032', async () => {
    const fixture = make({ current: true })
    const result = await execute(fixture)
    fixture.input.identity.task_id = 'mutated'
    assert.notEqual(result.result.identity_binding.value.task_id, 'mutated')
    assert.ok(Object.isFrozen(result.result.identity_binding.value))
  })

  await caseResult('GSP-033', async () => {
    for (const throwAt of ['canonical', 'read_pr', 'cas', 'receipt']) {
      const fixture = make({
        atomic: throwAt === 'cas',
        current: throwAt === 'receipt',
        receipt: throwAt === 'receipt',
      })
      const result = await execute(fixture, { throwAt })
      assert.ok(['stopped', 'reconciliation_required'].includes(result.result.kind))
      assert.equal(result.counts.retry_write, 0)
    }
  })

  await caseResult('GSP-034', async () => {
    const result = await execute(make())
    const text = JSON.stringify(result.result)
    for (const secret of ['secret-token', 'authorization:', 'C:\\Users\\', 'ユニコード🙂']) {
      assert.equal(text.includes(secret), false)
    }
    const mutated = clone(result.result)
    mutated.raw_body = 'secret'
    assert.equal(api.validateGateStatusPublicationResultV1(mutated).accepted, false)
  })

  await caseResult('GSP-035', async () => {
    const fixture = make({
      atomic: true,
      bodyPrefix: 'α🙂\r\n<!-- before -->\r\n',
      bodySuffix: '\r\n<!-- after -->\r\n## Next\r\nΩ\r\n',
    })
    const before = api.inspectGateStatusSectionV1(fixture.body)
    const result = await execute(fixture)
    assert.equal(result.result.kind, 'applied')
    assert.equal(result.result.branch.applied.before_non_gate_sha256, before.non_gate_sha256)
    assert.equal(
      result.result.branch.applied.before_non_gate_sha256,
      result.result.branch.applied.after_non_gate_sha256,
    )
  })

  await caseResult('GSP-036', async () => {
    const fixture = make()
    const result = await execute(fixture, { invalid: new Set([REVIEW]) })
    assert.equal(result.result.kind, 'stopped')
    assert.equal(result.counts.cas, 0)
  })

  assert.deepEqual(evidence, Array.from({ length: 36 }, (_, index) => `GSP-${String(index + 1).padStart(3, '0')}`))
  const summary = {
    contract: 'Gate Status Publisher V1',
    rows: evidence.length,
    first_row: evidence[0],
    last_row: evidence.at(-1),
    public_producer: true,
    deterministic: true,
    result: 'PASS',
  }
  console.log(JSON.stringify(summary))
} finally {
  await server.close()
}
