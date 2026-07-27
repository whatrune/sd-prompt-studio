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
const ROLE_AUTH_TASK = `${TASK}#test-gsp-role-authority-00-task`
const ROLE_AUTH_REVIEW = `${TASK}#test-gsp-role-authority-01-review`
const ROLE_AUTH_FINAL = `${TASK}#test-gsp-role-authority-02-final-regression`
const ROLE_AUTH_OPERATIONAL = `${TASK}#test-gsp-role-authority-03-operational-validation`
const ROLE_AUTH_PROTECTED = `${TASK}#test-gsp-role-authority-04-protected-action`

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

  const canonicalBody = (content, title = 'Canonical evidence') =>
    `# ${title}\n\n\`\`\`yaml\n${JSON.stringify({ gate_status_evidence_binding: content }, null, 2)}\n\`\`\`\n`
  const controlWrapperKeys = {
    prior_attempt_authority_set_v1:
      'gate_status_prior_attempt_authority_set_binding',
    prior_attempt_authority_record_v1:
      'gate_status_prior_attempt_authority_binding',
    receipt_authority_authorized_v1:
      'gate_status_receipt_authority_binding',
    receipt_store_capability_v1:
      'gate_status_receipt_store_capability_binding',
    prior_attempt_reconciliation_observation_v1:
      'gate_status_prior_attempt_reconciliation_observation_binding',
    proven_atomic_transport_capability_v1:
      'gate_status_transport_capability_binding',
  }
  const controlBody = (decoder, content) => {
    const payload = clone(content)
    if (
      [
        'prior_attempt_authority_set_v1',
        'prior_attempt_authority_record_v1',
        'prior_attempt_reconciliation_observation_v1',
      ].includes(decoder)
    ) delete payload.fetched_content_sha256
    return `# Exact canonical control\n\n\`\`\`yaml\n${
      JSON.stringify({ [controlWrapperKeys[decoder]]: payload }, null, 2)
    }\n\`\`\`\n`
  }
  const bindControlDigest = (decoder, content) => {
    content.fetched_content_sha256 = shaText(controlBody(decoder, content))
  }
  const ordinaryEvidence = ({
    kind,
    url,
    author,
    head_binding,
    source_record_url = url,
    authority_ref,
    protected_action,
  }) => {
    const content = {
      contract_version: 'gate-status-canonical-role-evidence-content-v1',
      evidence_class: 'canonical_role_record',
      evidence_kind: kind,
      canonical_url: url,
      source_record_url,
      authoring_role: author,
      task_id: 'DESIGN-GATE-STATUS-PUBLISHER-CONTRACT-001',
      repository: 'whatrune/sd-prompt-studio',
      head_binding,
    }
    if (authority_ref !== undefined) content.author_role_authority_ref = authority_ref
    if (protected_action !== undefined) content.protected_action = protected_action
    content.verification_state = 'verified'
    const body_utf8 = canonicalBody(content, kind)
    const value = {
      evidence: {
        evidence_class: 'canonical_role_record',
        evidence_kind: kind,
        canonical_url: url,
        authoring_role: author,
        task_id: 'DESIGN-GATE-STATUS-PUBLISHER-CONTRACT-001',
        repository: 'whatrune/sd-prompt-studio',
        head_binding,
      },
      read: {
        state: 'available',
        source_kind: 'canonical_body',
        canonical_url: url,
        body_utf8,
        fetched_content_sha256: shaText(body_utf8),
        content,
        content_projection_sha256: shaJcs(content),
      },
    }
    if (authority_ref !== undefined) {
      value.evidence.author_role_authority_ref = authority_ref
    }
    if (protected_action !== undefined) {
      value.evidence.protected_action = protected_action
    }
    value.evidence.fetched_content_sha256 = shaText(body_utf8)
    value.evidence.content_projection_sha256 = shaJcs(content)
    value.evidence.verification_state = 'verified'
    return value
  }
  const roleAuthorityBody = (content, ordinal) =>
    `# Gate Status Role Authority ${ordinal}\n\n\`\`\`yaml\n${
      JSON.stringify({ gate_status_role_authority_binding: content }, null, 2)
    }\n\`\`\`\n`
  const roleAuthority = ({
    ordinal,
    kind,
    url,
    source_record_url,
    issuer,
    authorized,
    scope,
  }) => {
    const content = {
      contract_version: 'gate-status-role-authority-content-v1',
      authority_class: 'admitted_role_authority',
      authority_kind: kind,
      canonical_url: url,
      source_record_url,
      issuer_role: issuer,
      authorized_role: authorized,
      task_id: 'DESIGN-GATE-STATUS-PUBLISHER-CONTRACT-001',
      assignment_revision: 1,
      repository: 'whatrune/sd-prompt-studio',
      scope,
      verification_state: 'verified',
    }
    const body_utf8 = roleAuthorityBody(content, ordinal)
    return {
      record: {
        authority_class: 'admitted_role_authority',
        authority_kind: kind,
        canonical_url: url,
        source_record_url,
        issuer_role: issuer,
        authorized_role: authorized,
        task_id: 'DESIGN-GATE-STATUS-PUBLISHER-CONTRACT-001',
        assignment_revision: 1,
        repository: 'whatrune/sd-prompt-studio',
        scope,
        fetched_content_sha256: shaText(body_utf8),
        content_projection_sha256: shaJcs(content),
        verification_state: 'verified',
      },
      read: {
        state: 'available',
        source_kind: 'canonical_body',
        canonical_url: url,
        body_utf8,
        fetched_content_sha256: shaText(body_utf8),
        content,
        content_projection_sha256: shaJcs(content),
      },
    }
  }
  const projectionAuthorizationHeader = {
    task_id: 'DESIGN-GATE-STATUS-PUBLISHER-CONTRACT-001',
    implementation_phase_id: 'IMPLEMENT-GATE-STATUS-PUBLISHER-V1-001',
    record_type: 'same_task_implementation_resume_dispatch',
    canonical_task: TASK,
    authoring_role: 'Integrated Lead',
    assigned_role: 'Backend Implementer',
    authority_main_full_head_sha: '15a173e8482e72913e57dc89c8c0539eb96b1b1d',
    freeze_candidate:
      'https://github.com/whatrune/sd-prompt-studio/issues/206#issuecomment-5085601779',
    cumulative_amendment_001:
      'https://github.com/whatrune/sd-prompt-studio/issues/206#issuecomment-5085674758',
    cumulative_amendment_002:
      'https://github.com/whatrune/sd-prompt-studio/issues/206#issuecomment-5085733363',
    cumulative_amendment_003:
      'https://github.com/whatrune/sd-prompt-studio/issues/206#issuecomment-5085861985',
    cumulative_amendment_004:
      'https://github.com/whatrune/sd-prompt-studio/issues/206#issuecomment-5085942624',
    architecture_review_decision: REVIEW,
    architecture_review_decision_value: 'APPROVE',
    architecture_review_blocking_finding_count: 0,
    implementation_resume_allowed: true,
    new_task_allowed: false,
    new_task_branch_allowed: true,
    new_task_worktree_allowed: true,
    draft_pr_allowed_after_validation_pass: true,
    ready_allowed: false,
    approve_allowed: false,
    merge_allowed: false,
  }
  const projectionAuthorizationContent = {
    contract_version: 'gate-status-projection-authorization-source-content-v1',
    canonical_url: PROJECTION_AUTH,
    task_id: projectionAuthorizationHeader.task_id,
    implementation_phase_id: projectionAuthorizationHeader.implementation_phase_id,
    record_type: projectionAuthorizationHeader.record_type,
    canonical_task: projectionAuthorizationHeader.canonical_task,
    record_authoring_role: 'integrated_lead',
    assigned_role: 'backend_implementer',
    authority_main_full_head_sha: projectionAuthorizationHeader.authority_main_full_head_sha,
    freeze_candidate: projectionAuthorizationHeader.freeze_candidate,
    cumulative_amendment_001: projectionAuthorizationHeader.cumulative_amendment_001,
    cumulative_amendment_002: projectionAuthorizationHeader.cumulative_amendment_002,
    cumulative_amendment_003: projectionAuthorizationHeader.cumulative_amendment_003,
    cumulative_amendment_004: projectionAuthorizationHeader.cumulative_amendment_004,
    architecture_review_decision: projectionAuthorizationHeader.architecture_review_decision,
    architecture_review_decision_value:
      projectionAuthorizationHeader.architecture_review_decision_value,
    architecture_review_blocking_finding_count:
      projectionAuthorizationHeader.architecture_review_blocking_finding_count,
    implementation_resume_allowed: projectionAuthorizationHeader.implementation_resume_allowed,
    new_task_allowed: projectionAuthorizationHeader.new_task_allowed,
    new_task_branch_allowed: projectionAuthorizationHeader.new_task_branch_allowed,
    new_task_worktree_allowed: projectionAuthorizationHeader.new_task_worktree_allowed,
    draft_pr_allowed_after_validation_pass:
      projectionAuthorizationHeader.draft_pr_allowed_after_validation_pass,
    ready_allowed: projectionAuthorizationHeader.ready_allowed,
    approve_allowed: projectionAuthorizationHeader.approve_allowed,
    merge_allowed: projectionAuthorizationHeader.merge_allowed,
  }
  const projectionAuthorizationBody =
    `# Same-Task Implementation Resume Dispatch\n\n\`\`\`yaml\n${JSON.stringify(projectionAuthorizationHeader, null, 2)}\n\`\`\`\n`
  const projectionAuthorizationEvidence = {
    evidence_class: 'canonical_role_record',
    evidence_kind: 'projection_authorization',
    canonical_url: PROJECTION_AUTH,
    authoring_role: 'integrated_lead',
    task_id: 'DESIGN-GATE-STATUS-PUBLISHER-CONTRACT-001',
    repository: 'whatrune/sd-prompt-studio',
    head_binding: { state: 'not_head_bound', basis_url: PROJECTION_AUTH },
    fetched_content_sha256: shaText(projectionAuthorizationBody),
    content_projection_sha256: shaJcs(projectionAuthorizationContent),
    verification_state: 'verified',
  }
  const projectionAuthorizationRead = {
    state: 'available',
    source_kind: 'canonical_body',
    canonical_url: PROJECTION_AUTH,
    body_utf8: projectionAuthorizationBody,
    fetched_content_sha256: shaText(projectionAuthorizationBody),
    content: projectionAuthorizationContent,
    content_projection_sha256: shaJcs(projectionAuthorizationContent),
  }
  const taskEvidence = ordinaryEvidence({
    kind: 'task_assignment',
    url: TASK,
    author: 'integrated_lead',
    head_binding: { state: 'not_head_bound', basis_url: TASK },
    authority_ref: ROLE_AUTH_TASK,
  })
  const reviewEvidence = ordinaryEvidence({
    kind: 'review_decision',
    url: REVIEW,
    author: 'architect_team',
    head_binding: { state: 'current', head: HEAD },
    authority_ref: ROLE_AUTH_REVIEW,
  })
  const taskRoleAuthority = roleAuthority({
    ordinal: 'A0',
    kind: 'task_assignment',
    url: ROLE_AUTH_TASK,
    source_record_url: TASK,
    issuer: 'integrated_lead',
    authorized: 'backend_implementer',
    scope: { scope_kind: 'task_assignment', task_assignment_url: TASK },
  })
  const reviewRoleAuthority = roleAuthority({
    ordinal: 'A1',
    kind: 'review_assignment',
    url: ROLE_AUTH_REVIEW,
    source_record_url: `${TASK}#test-review-assignment`,
    issuer: 'integrated_lead',
    authorized: 'architect_team',
    scope: {
      scope_kind: 'review_assignment',
      pr_url: PR,
      reviewed_head: HEAD,
      review_kind: 'implementation_review',
    },
  })
  const finalRoleAuthority = roleAuthority({
    ordinal: 'A2',
    kind: 'validation_dispatch',
    url: ROLE_AUTH_FINAL,
    source_record_url: `${TASK}#test-final-regression-dispatch`,
    issuer: 'integrated_lead',
    authorized: 'backend_implementer',
    scope: {
      scope_kind: 'validation_dispatch',
      pr_url: PR,
      validated_head: HEAD,
      validation_kind: 'final_regression',
    },
  })
  const operationalRoleAuthority = roleAuthority({
    ordinal: 'A3',
    kind: 'validation_dispatch',
    url: ROLE_AUTH_OPERATIONAL,
    source_record_url: `${TASK}#test-operational-validation-dispatch`,
    issuer: 'integrated_lead',
    authorized: 'maintenance_op',
    scope: {
      scope_kind: 'validation_dispatch',
      pr_url: PR,
      validated_head: HEAD,
      validation_kind: 'operational_validation',
    },
  })
  const protectedRoleAuthority = roleAuthority({
    ordinal: 'A4',
    kind: 'protected_action_authority',
    url: ROLE_AUTH_PROTECTED,
    source_record_url: `${TASK}#test-protected-action-authority`,
    issuer: 'product_owner',
    authorized: 'integrated_lead',
    scope: {
      scope_kind: 'protected_action_authority',
      pr_url: PR,
      authorized_head: HEAD,
      protected_action: 'ready_for_review',
    },
  })
  const baseRoleAuthorityRecords = [
    taskRoleAuthority.record,
    reviewRoleAuthority.record,
  ].sort((a, b) => Buffer.from(a.canonical_url).compare(Buffer.from(b.canonical_url)))
  const baseRoleAuthorityReads = new Map([
    [ROLE_AUTH_TASK, taskRoleAuthority.read],
    [ROLE_AUTH_REVIEW, reviewRoleAuthority.read],
  ])
  const evidenceRecords = [
    taskEvidence.evidence,
    reviewEvidence.evidence,
    projectionAuthorizationEvidence,
  ].sort((a, b) => Buffer.from(a.canonical_url).compare(Buffer.from(b.canonical_url)))
  const evidenceReads = new Map([
    [TASK, taskEvidence.read],
    [REVIEW, reviewEvidence.read],
    [PROJECTION_AUTH, projectionAuthorizationRead],
  ])

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
      role_authority_set: {
        contract_version: 'gate-status-role-authority-set-v1',
        task_id: 'DESIGN-GATE-STATUS-PUBLISHER-CONTRACT-001',
        assignment_revision: 1,
        repository: 'whatrune/sd-prompt-studio',
        records: clone(baseRoleAuthorityRecords),
      },
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
    bindControlDigest(
      'prior_attempt_authority_set_v1',
      input.prior_attempt_authorities,
    )
    const admission = api.validateGateStatusPublicationInputV1(input)
    assert.equal(admission.accepted, true, JSON.stringify(admission))
    return {
      input,
      body,
      snapshot,
      desired,
      key,
      evidence_reads: new Map([...evidenceReads].map(([url, read]) => [url, clone(read)])),
      role_authority_reads:
        new Map([...baseRoleAuthorityReads].map(([url, read]) => [url, clone(read)])),
    }
  }

  const makePorts = (
    fixture,
    {
      cas = 'applied',
      receipt = 'created',
      unavailable = new Set(),
      invalid = new Set(),
      readback = 'exact',
      postRevision = 'changed',
      throwAt = null,
    } = {},
  ) => {
    const counts = {
      canonical: 0,
      canonical_by_url: new Map(),
      pr_read: 0,
      cas: 0,
      receipt: 0,
      retry_write: 0,
    }
    let replacementBody = null
    let storedReceipt = null
    const map = new Map([
      ...fixture.input.evidence_records.map((item) => [item.canonical_url, item]),
      ...fixture.input.role_authority_set.records.map((item) => [item.canonical_url, item]),
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
        counts.canonical_by_url.set(url, (counts.canonical_by_url.get(url) ?? 0) + 1)
        if (throwAt === 'canonical') throw new Error('secret-token')
        if (unavailable.has(url)) return { state: 'unavailable' }
        if (fixture.evidence_reads.has(url)) {
          const result = clone(fixture.evidence_reads.get(url))
          if (invalid.has(url)) result.content.invalid = true
          return result
        }
        if (fixture.role_authority_reads.has(url)) {
          const result = clone(fixture.role_authority_reads.get(url))
          if (invalid.has(url)) result.content.invalid = true
          return result
        }
        const content = clone(map.get(url))
        if (invalid.has(url)) content.invalid = true
        const evidence = fixture.input.evidence_records.find((item) => item.canonical_url === url)
        const prior = fixture.input.prior_attempt_authorities.records.find(
          (item) => item.canonical_record === url,
        )
        const decoder =
          url === PRIOR_SET
            ? 'prior_attempt_authority_set_v1'
            : prior
              ? 'prior_attempt_authority_record_v1'
              : url === RECEIPT_AUTH
                ? 'receipt_authority_authorized_v1'
                : url === RECEIPT_STORE_AUTH
                  ? 'receipt_store_capability_v1'
                  : url === TRANSPORT_AUTH
                    ? 'proven_atomic_transport_capability_v1'
                    : content?.contract_version ===
                        'gate-status-prior-attempt-reconciliation-observation-v1'
                      ? 'prior_attempt_reconciliation_observation_v1'
                      : null
        assert.ok(decoder, `missing exact control decoder for ${url}`)
        const body_utf8 = controlBody(decoder, content)
        return {
          state: 'available',
          source_kind: 'canonical_body',
          canonical_url: url,
          body_utf8,
          fetched_content_sha256: shaText(body_utf8),
          content,
          content_projection_sha256: shaJcs(content),
        }
      },
      read_pr: async () => {
        counts.pr_read += 1
        if (throwAt === 'read_pr') throw new Error('secret-token')
        if (counts.pr_read === 1 || replacementBody === null) {
          return {
            state: 'available',
            snapshot: clone(fixture.snapshot),
            body_utf8: fixture.body,
            ...(fixture.input.transport_capability.kind ===
            'proven_atomic_compare_and_swap'
              ? {
                  atomic_revision_observation: {
                    state: 'available',
                    provider: fixture.input.transport_capability.provider,
                    adapter_id: fixture.input.transport_capability.adapter_id,
                    adapter_version: fixture.input.transport_capability.adapter_version,
                    atomic_scope: 'complete_pr_body',
                    revision_identity: clone(
                      fixture.input.transport_capability.atomic_revision_identity,
                    ),
                  },
                }
              : {}),
          }
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
          ...(fixture.input.transport_capability.kind ===
          'proven_atomic_compare_and_swap'
            ? {
                atomic_revision_observation: {
                  state: 'available',
                  provider: fixture.input.transport_capability.provider,
                  adapter_id: fixture.input.transport_capability.adapter_id,
                  adapter_version: fixture.input.transport_capability.adapter_version,
                  atomic_scope: 'complete_pr_body',
                  revision_identity: {
                    ...clone(
                      fixture.input.transport_capability.atomic_revision_identity,
                    ),
                    normalized_identity_sha256:
                      postRevision === 'unchanged'
                        ? fixture.input.transport_capability
                          .atomic_revision_identity
                          .normalized_identity_sha256
                        : fixedDigest('6'),
                  },
                },
              }
            : {}),
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
    assert.equal(result.result.kind, 'stopped', JSON.stringify(result.result))
    assert.equal(
      result.result.branch.stopped.stop_code,
      'atomic_precondition_unavailable',
    )
    assert.equal(result.counts.cas, 0)
  })

  await caseResult('GSP-003', async () => {
    const fixture = make({ current: true })
    const first = await execute(fixture)
    const second = await execute(fixture)
    assert.deepEqual(first.result, second.result)
    assert.equal(first.result.kind, 'stopped')
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
    assert.equal(result.result.branch.stopped.stop_code, 'canonical_evidence_invalid')
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
    const tampered = make()
    const tamperedHarness = makePorts(tampered)
    const canonicalRead = tamperedHarness.ports.read_canonical_record
    tamperedHarness.ports.read_canonical_record = async (url) => {
      const value = await canonicalRead(url)
      return url === REVIEW ? { ...value, content: { tampered: true } } : value
    }
    const tamperedResult = await api.publishGateStatusV1(clone(tampered.input), tamperedHarness.ports)
    assert.equal(tamperedResult.branch.stopped.stop_code, 'canonical_evidence_invalid')
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
    second.input.projection_authorization.projection.final_regression.value = 'unperformed'
    second.input.projection_authorization.projection_sha256 =
      shaJcs(second.input.projection_authorization.projection)
    second.key = api.buildGateStatusPublicationKeyV1(second.input)
    second.input.prior_attempt_authorities.publication_key = second.key
    bindControlDigest(
      'prior_attempt_authority_set_v1',
      second.input.prior_attempt_authorities,
    )
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
    for (const item of fixture.input.prior_attempt_authorities.records) {
      bindControlDigest('prior_attempt_authority_record_v1', item)
    }
    if (
      fixture.input.prior_attempt_reconciliation_observation.state !==
      'not_required'
    ) {
      bindControlDigest(
        'prior_attempt_reconciliation_observation_v1',
        fixture.input.prior_attempt_reconciliation_observation,
      )
    }
    bindControlDigest(
      'prior_attempt_authority_set_v1',
      fixture.input.prior_attempt_authorities,
    )
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
      if (throwAt === 'cas') {
        assert.equal(result.result.kind, 'applied')
        assert.equal(
          result.result.write_state.confirmation,
          'reconciled_after_indeterminate',
        )
      } else {
        assert.ok(['stopped', 'reconciliation_required'].includes(result.result.kind))
      }
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
    const valid = await execute(make({ atomic: true }))
    const impossible = clone(valid.result)
    impossible.identity_binding = { state: 'unavailable' }
    impossible.evaluator_binding = { state: 'unavailable' }
    impossible.publication_binding = { state: 'unavailable' }
    impossible.operation_binding = { state: 'unavailable' }
    impossible.transport_binding = { state: 'unavailable' }
    impossible.receipt_store_binding = { state: 'unavailable' }
    impossible.write_state = { attempted: false, observed: false, verified: false, confirmation: 'none' }
    impossible.receipt_disposition = { state: 'not_performed', reason: 'publication_stopped' }
    assert.equal(api.validateGateStatusPublicationResultV1(impossible).accepted, false)
  })

  const refreshFixtureAuthority = (fixture) => {
    fixture.input.evidence_records.sort((a, b) =>
      Buffer.from(a.canonical_url).compare(Buffer.from(b.canonical_url)))
    const citations = fixture.input.evidence_records
      .map((item) => item.canonical_url)
      .filter((url) => url !== TASK && url !== PROJECTION_AUTH)
      .sort((a, b) => Buffer.from(a).compare(Buffer.from(b)))
    fixture.input.evaluator.result.requirement.citation_urls = clone(citations)
    fixture.input.evaluator.result.gate_status_requirement.citation_urls = clone(citations)
    fixture.input.evaluator.result_sha256 = shaJcs(fixture.input.evaluator.result)
    fixture.input.projection_authorization.evaluator_result_sha256 =
      fixture.input.evaluator.result_sha256
    fixture.input.projection_authorization.projection.current_blocker_next_gate.evidence_urls =
      fixture.input.evidence_records
        .filter((item) =>
          ['review_decision', 'result_handoff'].includes(item.evidence_kind))
        .map((item) => item.canonical_url)
        .sort((a, b) => Buffer.from(a).compare(Buffer.from(b)))
    fixture.input.projection_authorization.projection_sha256 =
      shaJcs(fixture.input.projection_authorization.projection)
    fixture.key = api.buildGateStatusPublicationKeyV1(fixture.input)
    assert.ok(fixture.key)
    fixture.input.prior_attempt_authorities.publication_key = fixture.key
    bindControlDigest(
      'prior_attempt_authority_set_v1',
      fixture.input.prior_attempt_authorities,
    )
    if (fixture.input.receipt_store_capability.state === 'admitted') {
      fixture.input.receipt_store_capability.value.unique_key = fixture.key
    }
    const admission = api.validateGateStatusPublicationInputV1(fixture.input)
    assert.equal(admission.accepted, true, JSON.stringify(admission))
    return fixture
  }

  const refreshPublicationKeyOnly = (fixture) => {
    fixture.input.evidence_records.sort((a, b) =>
      Buffer.from(a.canonical_url).compare(Buffer.from(b.canonical_url)))
    fixture.key = api.buildGateStatusPublicationKeyV1(fixture.input)
    assert.ok(fixture.key)
    fixture.input.prior_attempt_authorities.publication_key = fixture.key
    bindControlDigest(
      'prior_attempt_authority_set_v1',
      fixture.input.prior_attempt_authorities,
    )
    if (fixture.input.receipt_store_capability.state === 'admitted') {
      fixture.input.receipt_store_capability.value.unique_key = fixture.key
    }
    return fixture
  }

  const githubCheckEvidence = ({
    conclusion = 'success',
    started_at = '2026-07-26T22:00:00Z',
    completed_at = '2026-07-26T22:01:00Z',
  } = {}) => {
    const url = 'https://github.com/whatrune/sd-prompt-studio/actions/runs/30227255862/job/89859405099'
    const source = {
      contract_version: 'gate-status-github-check-source-v1',
      canonical_url: url,
      repository: 'whatrune/sd-prompt-studio',
      pr_url: PR,
      checked_head: HEAD,
      name: 'build-preview',
      conclusion,
      producer: { kind: 'github_app', login: 'github-actions', database_id: 15368 },
      started_at,
      completed_at,
    }
    const content = {
      contract_version: 'gate-status-github-check-content-v1',
      evidence_class: 'github_mutable_evidence',
      evidence_kind: 'github_check',
      canonical_url: url,
      repository: source.repository,
      pr_url: source.pr_url,
      checked_head: source.checked_head,
      name: source.name,
      conclusion: source.conclusion,
      producer: source.producer,
      started_at: source.started_at,
      completed_at: source.completed_at,
      verification_state: 'verified',
    }
    return {
      evidence: {
        evidence_class: 'github_mutable_evidence',
        evidence_kind: 'github_check',
        canonical_url: url,
        repository: source.repository,
        pr_url: source.pr_url,
        checked_head: source.checked_head,
        name: source.name,
        conclusion: source.conclusion,
        producer: source.producer,
        started_at: source.started_at,
        completed_at: source.completed_at,
        fetched_content_sha256: shaJcs(source),
        content_projection_sha256: shaJcs(content),
        verification_state: 'verified',
      },
      read: {
        state: 'available',
        source_kind: 'github_resource',
        canonical_url: url,
        source,
        fetched_content_sha256: shaJcs(source),
        content,
        content_projection_sha256: shaJcs(content),
      },
    }
  }

  const githubThreadEvidence = () => {
    const url = `${PR}#discussion_r2000000001`
    const source = {
      contract_version: 'gate-status-github-review-thread-source-v1',
      canonical_url: url,
      repository: 'whatrune/sd-prompt-studio',
      pr_url: PR,
      observed_head: HEAD,
      state: 'resolved',
      outdated: false,
      blocking: false,
    }
    const content = {
      contract_version: 'gate-status-github-review-thread-content-v1',
      evidence_class: 'github_mutable_evidence',
      evidence_kind: 'review_thread',
      canonical_url: url,
      repository: source.repository,
      pr_url: source.pr_url,
      observed_head: source.observed_head,
      state: source.state,
      outdated: source.outdated,
      blocking: source.blocking,
      verification_state: 'verified',
    }
    return {
      evidence: {
        evidence_class: 'github_mutable_evidence',
        evidence_kind: 'review_thread',
        canonical_url: url,
        repository: source.repository,
        pr_url: source.pr_url,
        observed_head: source.observed_head,
        state: source.state,
        outdated: source.outdated,
        blocking: source.blocking,
        fetched_content_sha256: shaJcs(source),
        content_projection_sha256: shaJcs(content),
        verification_state: 'verified',
      },
      read: {
        state: 'available',
        source_kind: 'github_resource',
        canonical_url: url,
        source,
        fetched_content_sha256: shaJcs(source),
        content,
        content_projection_sha256: shaJcs(content),
      },
    }
  }

  const canonicalKindConfig = {
    task_assignment: {
      url: TASK,
      author: 'integrated_lead',
      head_binding: { state: 'not_head_bound', basis_url: TASK },
      authority_ref: ROLE_AUTH_TASK,
    },
    result_handoff: {
      url: `${TASK}#issuecomment-5087000001`,
      author: 'backend_implementer',
      head_binding: { state: 'current', head: HEAD },
      authority_ref: ROLE_AUTH_TASK,
    },
    review_decision: {
      url: REVIEW,
      author: 'architect_team',
      head_binding: { state: 'current', head: HEAD },
      authority_ref: ROLE_AUTH_REVIEW,
    },
    final_regression_result: {
      url: `${TASK}#issuecomment-5087000002`,
      author: 'backend_implementer',
      head_binding: { state: 'current', head: HEAD },
      authority_ref: ROLE_AUTH_FINAL,
    },
    operational_validation_result: {
      url: `${TASK}#issuecomment-5087000003`,
      author: 'maintenance_op',
      head_binding: { state: 'current', head: HEAD },
      authority_ref: ROLE_AUTH_OPERATIONAL,
    },
    product_owner_approval: {
      url: `${TASK}#issuecomment-5087000004`,
      author: 'product_owner',
      head_binding: { state: 'current', head: HEAD },
    },
    protected_action_completion: {
      url: `${TASK}#issuecomment-5087000005`,
      author: 'integrated_lead',
      head_binding: { state: 'current', head: HEAD },
      authority_ref: ROLE_AUTH_PROTECTED,
      protected_action: 'ready_for_review',
    },
  }

  const fixtureForEvidenceKind = (kind, options = {}) => {
    const fixture = make()
    const authorityByKind = {
      final_regression_result: finalRoleAuthority,
      operational_validation_result: operationalRoleAuthority,
      protected_action_completion: protectedRoleAuthority,
    }
    const extraAuthority = authorityByKind[kind]
    if (extraAuthority) {
      fixture.input.role_authority_set.records.push(clone(extraAuthority.record))
      fixture.input.role_authority_set.records.sort((a, b) =>
        Buffer.from(a.canonical_url).compare(Buffer.from(b.canonical_url)))
      fixture.role_authority_reads.set(
        extraAuthority.record.canonical_url,
        clone(extraAuthority.read),
      )
    }
    let target
    if (kind === 'projection_authorization') {
      target = {
        evidence: clone(projectionAuthorizationEvidence),
        read: clone(projectionAuthorizationRead),
      }
    } else if (kind === 'github_check') {
      target = githubCheckEvidence(options)
    } else if (kind === 'review_thread') {
      target = githubThreadEvidence()
    } else {
      target = ordinaryEvidence({ kind, ...canonicalKindConfig[kind] })
    }
    const existingIndex = fixture.input.evidence_records.findIndex(
      (item) => item.evidence_kind === kind,
    )
    if (existingIndex === -1) fixture.input.evidence_records.push(clone(target.evidence))
    else fixture.input.evidence_records[existingIndex] = clone(target.evidence)
    fixture.evidence_reads.set(target.evidence.canonical_url, clone(target.read))
    refreshFixtureAuthority(fixture)
    return { fixture, target_url: target.evidence.canonical_url }
  }

  const runDeterministicNegative = async (
    fixture,
    expectedCode = 'canonical_evidence_invalid',
    options = undefined,
  ) => {
    const before = canonicalize(fixture.input)
    const firstHarness = makePorts(fixture, options)
    const first = await api.publishGateStatusV1(clone(fixture.input), firstHarness.ports)
    const secondHarness = makePorts(fixture, options)
    const second = await api.publishGateStatusV1(clone(fixture.input), secondHarness.ports)
    assert.equal(first.kind, 'stopped')
    assert.equal(first.branch.stopped.stop_code, expectedCode)
    assert.equal(firstHarness.counts.pr_read, 0)
    assert.equal(firstHarness.counts.cas, 0)
    assert.equal(firstHarness.counts.receipt, 0)
    assert.equal(firstHarness.counts.retry_write, 0)
    assert.equal(api.validateGateStatusPublicationResultV1(first).accepted, true)
    assert.ok(Object.isFrozen(first))
    assert.equal(JSON.stringify(first), JSON.stringify(second))
    assert.equal(canonicalize(fixture.input), before)
    return first
  }

  const evidenceCutoverRows = []
  {
    for (const [id, target] of [
      ['GSP-S1-EVIDENCE-CUTOVER-001', fixtureForEvidenceKind('github_check')],
      [
        'GSP-S1-EVIDENCE-CUTOVER-002',
        fixtureForEvidenceKind('github_check', {
          conclusion: 'pending',
          started_at: null,
          completed_at: null,
        }),
      ],
      ['GSP-S1-EVIDENCE-CUTOVER-003', fixtureForEvidenceKind('review_thread')],
    ]) {
      const admission = api.validateGateStatusPublicationInputV1(target.fixture.input)
      assert.equal(admission.accepted, true, id)
      const result = await execute(target.fixture)
      assert.equal(result.result.branch.stopped.stop_code, 'atomic_precondition_unavailable')
      evidenceCutoverRows.push(id)
    }
    for (const [id, kind] of [
      ['GSP-S1-EVIDENCE-CUTOVER-004', 'github_check'],
      ['GSP-S1-EVIDENCE-CUTOVER-005', 'review_thread'],
      ['GSP-S1-EVIDENCE-CUTOVER-006', 'github_check'],
    ]) {
      const { fixture } = fixtureForEvidenceKind(kind)
      const index = fixture.input.evidence_records.findIndex((item) => item.evidence_kind === kind)
      fixture.input.evidence_records[index].observed_at = '2026-07-26T22:00:00Z'
      if (id !== 'GSP-S1-EVIDENCE-CUTOVER-006') {
        delete fixture.input.evidence_records[index].content_projection_sha256
        if (kind === 'github_check') {
          delete fixture.input.evidence_records[index].started_at
          delete fixture.input.evidence_records[index].completed_at
        }
      }
      const admission = api.validateGateStatusPublicationInputV1(fixture.input)
      assert.equal(admission.accepted, false)
      assert.equal(admission.rejection.path, `/evidence_records/${index}/observed_at`)
      const harness = makePorts(fixture)
      const result = await api.publishGateStatusV1(clone(fixture.input), harness.ports)
      assert.equal(result.branch.stopped.stop_code, 'structural_admission_failed')
      assert.equal(harness.counts.canonical, 0)
      evidenceCutoverRows.push(id)
    }
    {
      const { fixture } = fixtureForEvidenceKind('github_check')
      const index = fixture.input.evidence_records.findIndex(
        (item) => item.evidence_kind === 'github_check',
      )
      delete fixture.input.evidence_records[index].content_projection_sha256
      const admission = api.validateGateStatusPublicationInputV1(fixture.input)
      assert.equal(admission.accepted, false)
      assert.equal(
        admission.rejection.path,
        `/evidence_records/${index}/content_projection_sha256`,
      )
      evidenceCutoverRows.push('GSP-S1-EVIDENCE-CUTOVER-007')
    }
    {
      const { fixture } = fixtureForEvidenceKind('github_check')
      const index = fixture.input.evidence_records.findIndex(
        (item) => item.evidence_kind === 'github_check',
      )
      fixture.input.evidence_records[index].evidence_class = 'canonical_role_record'
      const admission = api.validateGateStatusPublicationInputV1(fixture.input)
      assert.equal(admission.accepted, false)
      assert.equal(admission.rejection.path, `/evidence_records/${index}/evidence_kind`)
      evidenceCutoverRows.push('GSP-S1-EVIDENCE-CUTOVER-008')
    }
    {
      const { fixture } = fixtureForEvidenceKind('github_check')
      const index = fixture.input.evidence_records.findIndex(
        (item) => item.evidence_kind === 'github_check',
      )
      fixture.input.evidence_records[index].completed_at = '2026-07-26T21:59:59Z'
      const admission = api.validateGateStatusPublicationInputV1(fixture.input)
      assert.equal(admission.accepted, false)
      assert.equal(admission.rejection.code, 'invalid_conditional_matrix')
      evidenceCutoverRows.push('GSP-S1-EVIDENCE-CUTOVER-009')
    }
    {
      const fixture = make()
      fixture.input.evidence_records.splice(1, 0, clone(fixture.input.evidence_records[0]))
      const admission = api.validateGateStatusPublicationInputV1(fixture.input)
      assert.equal(admission.accepted, false)
      assert.equal(admission.rejection.code, 'duplicate_set_member')
      assert.match(admission.rejection.path, /\/canonical_url$/)
      evidenceCutoverRows.push('GSP-S1-EVIDENCE-CUTOVER-010')
    }
  }
  assert.equal(evidenceCutoverRows.length, 10)

  const s6BranchRows = []
  const s6Kinds = [
    'task_assignment',
    'result_handoff',
    'review_decision',
    'final_regression_result',
    'operational_validation_result',
    'product_owner_approval',
    'protected_action_completion',
    'projection_authorization',
    'github_check',
    'review_thread',
  ]
  for (const kind of s6Kinds) {
    {
      const { fixture } = fixtureForEvidenceKind(kind)
      const result = await execute(fixture)
      assert.equal(result.result.branch.stopped.stop_code, 'atomic_precondition_unavailable')
      s6BranchRows.push(`GSP-S6-POS-${kind}`)
    }
    {
      const { fixture, target_url } = fixtureForEvidenceKind(kind)
      const read = fixture.evidence_reads.get(target_url)
      if (read.source_kind === 'canonical_body') read.body_utf8 += 'x'
      else if (kind === 'github_check') read.source.started_at = '2026-07-26T21:59:59Z'
      else read.source.blocking = !read.source.blocking
      await runDeterministicNegative(fixture)
      s6BranchRows.push(`GSP-S6-BODY-SOURCE-${kind}`)
    }
    {
      const { fixture, target_url } = fixtureForEvidenceKind(kind)
      fixture.evidence_reads.get(target_url).content.unexpected = true
      await runDeterministicNegative(fixture)
      s6BranchRows.push(`GSP-S6-CONTENT-${kind}`)
    }
    {
      const { fixture, target_url } = fixtureForEvidenceKind(kind)
      const read = fixture.evidence_reads.get(target_url)
      const inputEvidence = fixture.input.evidence_records.find(
        (item) => item.canonical_url === target_url,
      )
      if (read.source_kind === 'canonical_body') {
        if (kind === 'projection_authorization') {
          read.body_utf8 = read.body_utf8.replace(
            '\"authoring_role\": \"Integrated Lead\"',
            '\"authoring_role\": \"Backend Implementer\"',
          )
          inputEvidence.fetched_content_sha256 = shaText(read.body_utf8)
          read.fetched_content_sha256 = inputEvidence.fetched_content_sha256
        } else {
          read.content.authoring_role =
            read.content.authoring_role === 'product_owner'
              ? 'backend_implementer'
              : 'product_owner'
          read.body_utf8 = canonicalBody(read.content, kind)
          read.fetched_content_sha256 = shaText(read.body_utf8)
          read.content_projection_sha256 = shaJcs(read.content)
          inputEvidence.fetched_content_sha256 = read.fetched_content_sha256
          inputEvidence.content_projection_sha256 = read.content_projection_sha256
        }
      } else if (kind === 'github_check') {
        read.source.producer.login = 'different-app'
        read.content = {
          ...read.content,
          producer: clone(read.source.producer),
        }
        read.fetched_content_sha256 = shaJcs(read.source)
        read.content_projection_sha256 = shaJcs(read.content)
        inputEvidence.fetched_content_sha256 = read.fetched_content_sha256
        inputEvidence.content_projection_sha256 = read.content_projection_sha256
      } else {
        read.source.producer = {
          kind: 'github_user',
          login: 'not-admissible',
          database_id: 1,
        }
      }
      await runDeterministicNegative(fixture)
      s6BranchRows.push(`GSP-S6-ATTR-${kind}`)
    }
    {
      const { fixture, target_url } = fixtureForEvidenceKind(kind)
      const inputEvidence = fixture.input.evidence_records.find(
        (item) => item.canonical_url === target_url,
      )
      if (kind === 'github_check') {
        const read = fixture.evidence_reads.get(target_url)
        read.source.checked_head = 'f'.repeat(40)
        read.content.checked_head = read.source.checked_head
        read.fetched_content_sha256 = shaJcs(read.source)
        read.content_projection_sha256 = shaJcs(read.content)
        inputEvidence.fetched_content_sha256 = read.fetched_content_sha256
        inputEvidence.content_projection_sha256 = read.content_projection_sha256
      } else if (kind === 'review_thread') {
        const read = fixture.evidence_reads.get(target_url)
        read.source.observed_head = 'f'.repeat(40)
        read.content.observed_head = read.source.observed_head
        read.fetched_content_sha256 = shaJcs(read.source)
        read.content_projection_sha256 = shaJcs(read.content)
        inputEvidence.fetched_content_sha256 = read.fetched_content_sha256
        inputEvidence.content_projection_sha256 = read.content_projection_sha256
      } else {
        if (kind === 'task_assignment') {
          inputEvidence.head_binding.basis_url = `${TASK}#issuecomment-5087999991`
        } else if (kind === 'projection_authorization') {
          inputEvidence.head_binding = { state: 'current', head: HEAD }
        } else {
          inputEvidence.head_binding = { state: 'historical', head: 'f'.repeat(40) }
        }
      }
      const admission = api.validateGateStatusPublicationInputV1(fixture.input)
      if (admission.accepted) await runDeterministicNegative(fixture)
      else {
        const harness = makePorts(fixture)
        const result = await api.publishGateStatusV1(clone(fixture.input), harness.ports)
        assert.equal(result.branch.stopped.stop_code, 'structural_admission_failed')
        assert.equal(harness.counts.canonical, 0)
      }
      s6BranchRows.push(`GSP-S6-HEAD-${kind}`)
    }
  }
  assert.equal(s6BranchRows.length, 50)

  const s6CrossRows = []
  {
    const fixture = make()
    fixture.input.evidence_records = fixture.input.evidence_records.filter(
      (item) => item.canonical_url !== REVIEW,
    )
    fixture.input.role_authority_set.records =
      fixture.input.role_authority_set.records.filter(
        (item) => item.canonical_url !== ROLE_AUTH_REVIEW,
      )
    fixture.role_authority_reads.delete(ROLE_AUTH_REVIEW)
    refreshPublicationKeyOnly(fixture)
    await runDeterministicNegative(fixture)
    s6CrossRows.push('GSP-S6-X-001')
  }
  {
    const fixture = make()
    const extra = ordinaryEvidence({
      kind: 'result_handoff',
      url: `${TASK}#issuecomment-5087100001`,
      author: 'backend_implementer',
      head_binding: { state: 'current', head: HEAD },
      authority_ref: ROLE_AUTH_TASK,
    })
    fixture.input.evidence_records.push(extra.evidence)
    fixture.input.evidence_records.sort((a, b) =>
      Buffer.from(a.canonical_url).compare(Buffer.from(b.canonical_url)))
    fixture.evidence_reads.set(extra.evidence.canonical_url, extra.read)
    refreshPublicationKeyOnly(fixture)
    await runDeterministicNegative(fixture)
    s6CrossRows.push('GSP-S6-X-002')
  }
  {
    const fixture = make()
    fixture.input.evidence_records.splice(1, 0, clone(fixture.input.evidence_records[0]))
    const harness = makePorts(fixture)
    const result = await api.publishGateStatusV1(clone(fixture.input), harness.ports)
    assert.equal(result.branch.stopped.stop_code, 'structural_admission_failed')
    assert.equal(harness.counts.canonical, 0)
    s6CrossRows.push('GSP-S6-X-003')
  }
  {
    const fixture = make()
    fixture.input.evidence_records.reverse()
    const harness = makePorts(fixture)
    const result = await api.publishGateStatusV1(clone(fixture.input), harness.ports)
    assert.equal(result.branch.stopped.stop_code, 'structural_admission_failed')
    assert.equal(harness.counts.canonical, 0)
    s6CrossRows.push('GSP-S6-X-004')
  }
  for (const id of ['GSP-S6-X-005', 'GSP-S6-X-006']) {
    const fixture = make()
    const source = `${TASK}#issuecomment-5087200000`
    for (const suffix of [1, 2]) {
      const candidate = ordinaryEvidence({
        kind: 'result_handoff',
        url: `${TASK}#issuecomment-508720000${suffix}`,
        source_record_url: source,
        author: 'backend_implementer',
        head_binding: { state: 'current', head: HEAD },
        authority_ref: ROLE_AUTH_TASK,
      })
      fixture.input.evidence_records.push(candidate.evidence)
      fixture.evidence_reads.set(candidate.evidence.canonical_url, candidate.read)
    }
    refreshFixtureAuthority(fixture)
    await runDeterministicNegative(fixture, 'canonical_conflict')
    s6CrossRows.push(id)
  }
  {
    const { fixture, target_url } = fixtureForEvidenceKind('github_check')
    const read = fixture.evidence_reads.get(target_url)
    read.source_kind = 'canonical_body'
    read.body_utf8 = '{}'
    delete read.source
    await runDeterministicNegative(fixture)
    s6CrossRows.push('GSP-S6-X-007')
  }
  {
    const { fixture, target_url } = fixtureForEvidenceKind('result_handoff')
    const read = fixture.evidence_reads.get(target_url)
    read.content.authoring_role = 'github-actions'
    read.body_utf8 = canonicalBody(read.content, 'result_handoff')
    read.fetched_content_sha256 = shaText(read.body_utf8)
    read.content_projection_sha256 = shaJcs(read.content)
    const inputEvidence = fixture.input.evidence_records.find(
      (item) => item.canonical_url === target_url,
    )
    inputEvidence.fetched_content_sha256 = read.fetched_content_sha256
    inputEvidence.content_projection_sha256 = read.content_projection_sha256
    await runDeterministicNegative(fixture)
    s6CrossRows.push('GSP-S6-X-008')
  }
  {
    const { fixture, target_url } = fixtureForEvidenceKind('github_check')
    fixture.evidence_reads.get(target_url).source.producer.kind = 'backend_implementer'
    await runDeterministicNegative(fixture)
    s6CrossRows.push('GSP-S6-X-009')
  }
  {
    const { fixture, target_url } = fixtureForEvidenceKind('review_thread')
    await runDeterministicNegative(fixture, 'canonical_evidence_invalid', {
      unavailable: new Set([target_url]),
    })
    s6CrossRows.push('GSP-S6-X-010')
  }
  {
    const { fixture, target_url } = fixtureForEvidenceKind('review_thread')
    const first = makePorts(fixture)
    const original = first.ports.read_canonical_record
    first.ports.read_canonical_record = async (url) => {
      if (url === target_url) throw new Error('raw-provider-secret')
      return original(url)
    }
    const result = await api.publishGateStatusV1(clone(fixture.input), first.ports)
    assert.equal(result.branch.stopped.stop_code, 'canonical_evidence_invalid')
    assert.equal(JSON.stringify(result).includes('raw-provider-secret'), false)
    s6CrossRows.push('GSP-S6-X-011')
  }
  {
    const fixture = make()
    const lastUrl = PROJECTION_AUTH
    fixture.evidence_reads.get(lastUrl).content.assigned_role = 'architect_team'
    const harness = makePorts(fixture)
    const result = await api.publishGateStatusV1(clone(fixture.input), harness.ports)
    assert.equal(result.branch.stopped.stop_code, 'canonical_evidence_invalid')
    assert.equal(harness.counts.pr_read, 0)
    assert.equal(harness.counts.canonical_by_url.get(TASK), 1)
    assert.equal(harness.counts.canonical_by_url.get(REVIEW), 1)
    s6CrossRows.push('GSP-S6-X-012')
  }
  assert.equal(s6CrossRows.length, 12)

  const resultValidatorCases = []
  {
    const validResults = {
      applied: (await execute(make({ atomic: true }))).result,
      already_current: (
        await execute(make({ current: true, receipt: true }), { receipt: 'created' })
      ).result,
      stopped: (await execute(make())).result,
      reconciliation_required: (
        await execute(make({ atomic: true }), { readback: 'mismatch' })
      ).result,
    }
    for (const [kind, valid] of Object.entries(validResults)) {
      assert.equal(api.validateGateStatusPublicationResultV1(valid).accepted, true)
      resultValidatorCases.push(`${kind}:positive`)
      const mutations = [
        (value) => { value.unexpected = true },
        (value) => { value.branch.unexpected = true },
        (value) => {
          value.write_state.confirmation =
            value.write_state.confirmation === 'none' ? 'confirmed' : 'none'
        },
      ]
      if (kind !== 'stopped') {
        mutations.push(
          (value) => { value.identity_binding = { state: 'unavailable' } },
          (value) => {
            value.publication_binding.intended_projection_sha256 =
              value.publication_binding.intended_projection_sha256.replace(
                /^./,
                (char) => char === '0' ? '1' : '0',
              )
          },
          (value) => {
            const branch = value.branch[kind]
            const snapshot = branch.post_snapshot ?? branch.current_snapshot ??
              branch.last_observation?.snapshot
            if (snapshot) {
              snapshot.head = snapshot.head.replace(
                /^./,
                (char) => char === '0' ? '1' : '0',
              )
            }
          },
        )
      } else {
        mutations.push(
          (value) => { value.receipt_disposition.reason = 'write_not_verified' },
          (value) => { value.diagnostics[0].code = 'identity_mismatch' },
        )
      }
      for (const [mutationIndex, mutate] of mutations.entries()) {
        const invalid = clone(valid)
        mutate(invalid)
        assert.equal(
          api.validateGateStatusPublicationResultV1(invalid).accepted,
          false,
          `${kind} mutation ${mutationIndex}`,
        )
        resultValidatorCases.push(`${kind}:negative`)
      }
    }
  }

  const focused = {
    task_id: 'DESIGN-GATE-STATUS-PUBLISHER-CONTRACT-001',
    implementation_phase_id: 'IMPLEMENT-GATE-STATUS-PUBLISHER-V1-001',
    repository: 'whatrune/sd-prompt-studio',
    pr_url: 'https://github.com/whatrune/sd-prompt-studio/pull/207',
    head: '84ef079dd2abe94de6c69c0e7bf0b73911338301',
    base: '15a173e8482e72913e57dc89c8c0539eb96b1b1d',
    branch: 'codex/issue-206-gate-status-publisher-v1',
    worktree: 'issue-206-gate-status-publisher-v1',
    evaluated_at: '2026-07-27T04:00:00Z',
    fetched_at: '2026-07-27T04:00:01Z',
    check_started_at: '2026-07-27T03:55:00Z',
    check_completed_at: '2026-07-27T03:59:00Z',
  }
  const focusedAuthorityUrls = Array.from(
    { length: 5 },
    (_, index) =>
      `https://github.com/whatrune/sd-prompt-studio/issues/206#test-gsp-role-authority-0${index}-${
        ['task', 'review', 'final-regression', 'operational-validation', 'protected-action'][index]
      }`,
  )
  const focusedAuthoritySourceUrls = [
    'https://github.com/whatrune/sd-prompt-studio/issues/206#test-gsp-evidence-00-task-assignment',
    'https://github.com/whatrune/sd-prompt-studio/issues/206#test-gsp-source-01-review-assignment',
    'https://github.com/whatrune/sd-prompt-studio/issues/206#test-gsp-source-02-final-regression-dispatch',
    'https://github.com/whatrune/sd-prompt-studio/issues/206#test-gsp-source-03-operational-validation-dispatch',
    'https://github.com/whatrune/sd-prompt-studio/issues/206#test-gsp-source-04-protected-action-authority',
  ]
  const focusedEvidenceUrls = Array.from(
    { length: 10 },
    (_, index) =>
      `https://github.com/whatrune/sd-prompt-studio/issues/206#test-gsp-evidence-${String(index).padStart(2, '0')}-${
        [
          'task-assignment',
          'result-handoff',
          'review-decision',
          'final-regression',
          'operational-validation',
          'product-owner-approval',
          'protected-action-completion',
          'projection-authorization',
          'github-check',
          'review-thread',
        ][index]
      }`,
  )
  const focusedFixtureBody = (ordinal, bindingKey, content) =>
    `# Gate Status Focused Fixture: ${ordinal}\n\n\`\`\`yaml\n${
      JSON.stringify({ [bindingKey]: content }, null, 2)
    }\n\`\`\`\n`
  const focusedAuthoritySpecs = [
    {
      authority_kind: 'task_assignment',
      issuer_role: 'integrated_lead',
      authorized_role: 'backend_implementer',
      scope: {
        scope_kind: 'task_assignment',
        task_assignment_url: focusedEvidenceUrls[0],
      },
    },
    {
      authority_kind: 'review_assignment',
      issuer_role: 'integrated_lead',
      authorized_role: 'architect_team',
      scope: {
        scope_kind: 'review_assignment',
        pr_url: focused.pr_url,
        reviewed_head: focused.head,
        review_kind: 'implementation_review',
      },
    },
    {
      authority_kind: 'validation_dispatch',
      issuer_role: 'integrated_lead',
      authorized_role: 'backend_implementer',
      scope: {
        scope_kind: 'validation_dispatch',
        pr_url: focused.pr_url,
        validated_head: focused.head,
        validation_kind: 'final_regression',
      },
    },
    {
      authority_kind: 'validation_dispatch',
      issuer_role: 'integrated_lead',
      authorized_role: 'maintenance_op',
      scope: {
        scope_kind: 'validation_dispatch',
        pr_url: focused.pr_url,
        validated_head: focused.head,
        validation_kind: 'operational_validation',
      },
    },
    {
      authority_kind: 'protected_action_authority',
      issuer_role: 'product_owner',
      authorized_role: 'integrated_lead',
      scope: {
        scope_kind: 'protected_action_authority',
        pr_url: focused.pr_url,
        authorized_head: focused.head,
        protected_action: 'ready_for_review',
      },
    },
  ]
  const buildFocusedAuthority = (index, override = {}) => {
    const spec = focusedAuthoritySpecs[index]
    const canonical_url = override.canonical_url ?? focusedAuthorityUrls[index]
    const source_record_url =
      override.source_record_url ?? focusedAuthoritySourceUrls[index]
    const content = {
      contract_version: 'gate-status-role-authority-content-v1',
      authority_class: 'admitted_role_authority',
      authority_kind: spec.authority_kind,
      canonical_url,
      source_record_url,
      issuer_role: spec.issuer_role,
      authorized_role: spec.authorized_role,
      task_id: focused.task_id,
      assignment_revision: 1,
      repository: focused.repository,
      scope: clone(spec.scope),
      verification_state: 'verified',
    }
    const body_utf8 = focusedFixtureBody(
      `A${index}`,
      'gate_status_role_authority_binding',
      content,
    )
    const record = {
      authority_class: content.authority_class,
      authority_kind: content.authority_kind,
      canonical_url,
      source_record_url,
      issuer_role: content.issuer_role,
      authorized_role: content.authorized_role,
      task_id: content.task_id,
      assignment_revision: content.assignment_revision,
      repository: content.repository,
      scope: clone(content.scope),
      fetched_content_sha256: shaText(body_utf8),
      content_projection_sha256: shaJcs(content),
      verification_state: 'verified',
    }
    const read = {
      state: 'available',
      source_kind: 'canonical_body',
      canonical_url,
      body_utf8,
      fetched_content_sha256: record.fetched_content_sha256,
      content,
      content_projection_sha256: record.content_projection_sha256,
    }
    return { record, read }
  }
  const focusedAuthorities = focusedAuthoritySpecs.map((_, index) =>
    buildFocusedAuthority(index))

  const focusedEvidenceSpecs = [
    {
      evidence_kind: 'task_assignment',
      authoring_role: 'integrated_lead',
      head_binding: { state: 'not_head_bound', basis_url: focusedEvidenceUrls[0] },
      author_role_authority_ref: focusedAuthorityUrls[0],
    },
    {
      evidence_kind: 'result_handoff',
      authoring_role: 'backend_implementer',
      head_binding: { state: 'current', head: focused.head },
      author_role_authority_ref: focusedAuthorityUrls[0],
    },
    {
      evidence_kind: 'review_decision',
      authoring_role: 'architect_team',
      head_binding: { state: 'current', head: focused.head },
      author_role_authority_ref: focusedAuthorityUrls[1],
    },
    {
      evidence_kind: 'final_regression_result',
      authoring_role: 'backend_implementer',
      head_binding: { state: 'current', head: focused.head },
      author_role_authority_ref: focusedAuthorityUrls[2],
    },
    {
      evidence_kind: 'operational_validation_result',
      authoring_role: 'maintenance_op',
      head_binding: { state: 'current', head: focused.head },
      author_role_authority_ref: focusedAuthorityUrls[3],
    },
    {
      evidence_kind: 'product_owner_approval',
      authoring_role: 'product_owner',
      head_binding: { state: 'current', head: focused.head },
    },
    {
      evidence_kind: 'protected_action_completion',
      authoring_role: 'integrated_lead',
      head_binding: { state: 'current', head: focused.head },
      author_role_authority_ref: focusedAuthorityUrls[4],
      protected_action: 'ready_for_review',
    },
  ]
  const buildFocusedOrdinaryEvidence = (index) => {
    const spec = focusedEvidenceSpecs[index]
    const canonical_url = focusedEvidenceUrls[index]
    const content = {
      contract_version: 'gate-status-canonical-role-evidence-content-v1',
      evidence_class: 'canonical_role_record',
      evidence_kind: spec.evidence_kind,
      canonical_url,
      source_record_url: canonical_url,
      authoring_role: spec.authoring_role,
      task_id: focused.task_id,
      repository: focused.repository,
      head_binding: clone(spec.head_binding),
    }
    if (spec.author_role_authority_ref !== undefined) {
      content.author_role_authority_ref = spec.author_role_authority_ref
    }
    if (spec.protected_action !== undefined) {
      content.protected_action = spec.protected_action
    }
    content.verification_state = 'verified'
    const body_utf8 = focusedFixtureBody(
      `E${index}`,
      'gate_status_evidence_binding',
      content,
    )
    const record = {
      evidence_class: content.evidence_class,
      evidence_kind: content.evidence_kind,
      canonical_url,
      authoring_role: content.authoring_role,
      task_id: content.task_id,
      repository: content.repository,
      head_binding: clone(content.head_binding),
    }
    if (content.author_role_authority_ref !== undefined) {
      record.author_role_authority_ref = content.author_role_authority_ref
    }
    if (content.protected_action !== undefined) {
      record.protected_action = content.protected_action
    }
    record.fetched_content_sha256 = shaText(body_utf8)
    record.content_projection_sha256 = shaJcs(content)
    record.verification_state = 'verified'
    return {
      record,
      read: {
        state: 'available',
        source_kind: 'canonical_body',
        canonical_url,
        body_utf8,
        fetched_content_sha256: record.fetched_content_sha256,
        content,
        content_projection_sha256: record.content_projection_sha256,
      },
    }
  }
  const focusedEvidence = focusedEvidenceSpecs.map((_, index) =>
    buildFocusedOrdinaryEvidence(index))
  const focusedProjectionAuthorizationContent = {
    contract_version: 'gate-status-projection-authorization-source-content-v1',
    canonical_url: focusedEvidenceUrls[7],
    task_id: focused.task_id,
    implementation_phase_id: focused.implementation_phase_id,
    record_type: 'same_task_implementation_resume_dispatch',
    canonical_task: focusedEvidenceUrls[0],
    record_authoring_role: 'integrated_lead',
    assigned_role: 'backend_implementer',
    authority_main_full_head_sha: focused.base,
    freeze_candidate:
      'https://github.com/whatrune/sd-prompt-studio/issues/206#test-gsp-authority-freeze',
    cumulative_amendment_001:
      'https://github.com/whatrune/sd-prompt-studio/issues/206#test-gsp-amendment-001',
    cumulative_amendment_002:
      'https://github.com/whatrune/sd-prompt-studio/issues/206#test-gsp-amendment-002',
    cumulative_amendment_003:
      'https://github.com/whatrune/sd-prompt-studio/issues/206#test-gsp-amendment-003',
    cumulative_amendment_004:
      'https://github.com/whatrune/sd-prompt-studio/issues/206#test-gsp-amendment-004',
    architecture_review_decision:
      'https://github.com/whatrune/sd-prompt-studio/issues/206#test-gsp-review-decision',
    architecture_review_decision_value: 'APPROVE',
    architecture_review_blocking_finding_count: 0,
    implementation_resume_allowed: true,
    new_task_allowed: false,
    new_task_branch_allowed: true,
    new_task_worktree_allowed: true,
    draft_pr_allowed_after_validation_pass: true,
    ready_allowed: false,
    approve_allowed: false,
    merge_allowed: false,
  }
  const focusedProjectionAuthorizationBody = focusedFixtureBody(
    'E7',
    'gate_status_evidence_binding',
    focusedProjectionAuthorizationContent,
  )
  focusedEvidence[7] = {
    record: {
      evidence_class: 'canonical_role_record',
      evidence_kind: 'projection_authorization',
      canonical_url: focusedEvidenceUrls[7],
      authoring_role: 'integrated_lead',
      task_id: focused.task_id,
      repository: focused.repository,
      head_binding: {
        state: 'not_head_bound',
        basis_url: focusedEvidenceUrls[7],
      },
      fetched_content_sha256: shaText(focusedProjectionAuthorizationBody),
      content_projection_sha256: shaJcs(focusedProjectionAuthorizationContent),
      verification_state: 'verified',
    },
    read: {
      state: 'available',
      source_kind: 'canonical_body',
      canonical_url: focusedEvidenceUrls[7],
      body_utf8: focusedProjectionAuthorizationBody,
      fetched_content_sha256: shaText(focusedProjectionAuthorizationBody),
      content: focusedProjectionAuthorizationContent,
      content_projection_sha256: shaJcs(focusedProjectionAuthorizationContent),
    },
  }
  const focusedCheckSource = {
    contract_version: 'gate-status-github-check-source-v1',
    canonical_url: focusedEvidenceUrls[8],
    repository: focused.repository,
    pr_url: focused.pr_url,
    checked_head: focused.head,
    name: 'build-preview',
    conclusion: 'success',
    producer: { kind: 'github_app', login: 'github-actions', database_id: 15368 },
    started_at: focused.check_started_at,
    completed_at: focused.check_completed_at,
  }
  const focusedCheckContent = {
    contract_version: 'gate-status-github-check-content-v1',
    evidence_class: 'github_mutable_evidence',
    evidence_kind: 'github_check',
    canonical_url: focusedEvidenceUrls[8],
    repository: focused.repository,
    pr_url: focused.pr_url,
    checked_head: focused.head,
    name: 'build-preview',
    conclusion: 'success',
    producer: clone(focusedCheckSource.producer),
    started_at: focused.check_started_at,
    completed_at: focused.check_completed_at,
    verification_state: 'verified',
  }
  focusedEvidence[8] = {
    record: {
      evidence_class: 'github_mutable_evidence',
      evidence_kind: 'github_check',
      canonical_url: focusedEvidenceUrls[8],
      repository: focused.repository,
      pr_url: focused.pr_url,
      checked_head: focused.head,
      name: 'build-preview',
      conclusion: 'success',
      producer: clone(focusedCheckSource.producer),
      started_at: focused.check_started_at,
      completed_at: focused.check_completed_at,
      fetched_content_sha256: shaJcs(focusedCheckSource),
      content_projection_sha256: shaJcs(focusedCheckContent),
      verification_state: 'verified',
    },
    read: {
      state: 'available',
      source_kind: 'github_resource',
      canonical_url: focusedEvidenceUrls[8],
      source: focusedCheckSource,
      fetched_content_sha256: shaJcs(focusedCheckSource),
      content: focusedCheckContent,
      content_projection_sha256: shaJcs(focusedCheckContent),
    },
  }
  const focusedThreadSource = {
    contract_version: 'gate-status-github-review-thread-source-v1',
    canonical_url: focusedEvidenceUrls[9],
    repository: focused.repository,
    pr_url: focused.pr_url,
    observed_head: focused.head,
    state: 'resolved',
    outdated: false,
    blocking: false,
  }
  const focusedThreadContent = {
    contract_version: 'gate-status-github-review-thread-content-v1',
    evidence_class: 'github_mutable_evidence',
    evidence_kind: 'review_thread',
    canonical_url: focusedEvidenceUrls[9],
    repository: focused.repository,
    pr_url: focused.pr_url,
    observed_head: focused.head,
    state: 'resolved',
    outdated: false,
    blocking: false,
    verification_state: 'verified',
  }
  focusedEvidence[9] = {
    record: {
      evidence_class: 'github_mutable_evidence',
      evidence_kind: 'review_thread',
      canonical_url: focusedEvidenceUrls[9],
      repository: focused.repository,
      pr_url: focused.pr_url,
      observed_head: focused.head,
      state: 'resolved',
      outdated: false,
      blocking: false,
      fetched_content_sha256: shaJcs(focusedThreadSource),
      content_projection_sha256: shaJcs(focusedThreadContent),
      verification_state: 'verified',
    },
    read: {
      state: 'available',
      source_kind: 'github_resource',
      canonical_url: focusedEvidenceUrls[9],
      source: focusedThreadSource,
      fetched_content_sha256: shaJcs(focusedThreadSource),
      content: focusedThreadContent,
      content_projection_sha256: shaJcs(focusedThreadContent),
    },
  }
  const focusedProjection = {
    contract_version: 'gate-status-projection-v1',
    current_head: row(focused.head, [focusedEvidenceUrls[7]]),
    final_regression: row('pending', [focusedEvidenceUrls[3]]),
    operational_validation: row('unperformed', [focusedEvidenceUrls[4]]),
    pr_state_draft: row('open_draft', [focusedEvidenceUrls[7]]),
    ready: row('unperformed', [focusedEvidenceUrls[6]]),
    approve: row('unperformed', [focusedEvidenceUrls[5]]),
    merge: row('unperformed', [focusedEvidenceUrls[5]]),
    current_blocker_next_gate: {
      blocker_id: null,
      next_action: null,
      next_owner: null,
      evidence_urls: [focusedEvidenceUrls[2]],
    },
    historical_evidence: [],
  }
  const focusedPrBody =
    `Purpose\r\n\r\n${api.renderGateStatusProjectionV1(focusedProjection)
    }\r\n\r\n## Scope boundary\r\noutside\r\n`
  const focusedPrSnapshot = {
    contract_version: 'github-body-snapshot-v1',
    source_kind: 'github_pull_request',
    pr_url: focused.pr_url,
    pr_number: 207,
    head: focused.head,
    base: focused.base,
    state: 'open',
    draft: true,
    body_utf8_sha256: shaText(focusedPrBody),
    fetched_at: focused.fetched_at,
    etag: { state: 'absent' },
  }
  assert.equal(
    focusedPrSnapshot.body_utf8_sha256,
    'sha256:90cb4da543b6a8dd840eb96681e7c2e41ea28c74abaec56b5836397d02ec1b9b',
    'A012 exact PR body bytes',
  )
  const focusedProfiles = {
    ALL: { authorities: [0, 1, 2, 3, 4], evidence: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] },
    TASK: { authorities: [0], evidence: [0, 7] },
    RESULT: { authorities: [0], evidence: [0, 1, 7] },
    REVIEW: { authorities: [0, 1], evidence: [0, 2, 7] },
    FINAL: { authorities: [0, 2], evidence: [0, 3, 7] },
    OPERATIONAL: { authorities: [0, 3], evidence: [0, 4, 7] },
    PO_APPROVAL: { authorities: [0], evidence: [0, 5, 7] },
    PROTECTED: { authorities: [0, 4], evidence: [0, 6, 7] },
    PROJECTION: { authorities: [0], evidence: [0, 7] },
    CHECK: { authorities: [0], evidence: [0, 7, 8] },
    THREAD: { authorities: [0], evidence: [0, 7, 9] },
  }
  const buildFocusedProfileInput = (profileId) => {
    const selected = focusedProfiles[profileId]
    const citation_urls = selected.evidence
      .filter((index) => index !== 0 && index !== 7)
      .map((index) => focusedEvidenceUrls[index])
      .sort((a, b) => Buffer.from(a).compare(Buffer.from(b)))
    const gateRequirement = {
      required: true,
      authorized_metadata_role: 'backend_implementer',
      pr: focused.pr_url,
      current_head: focused.head,
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
      citation_urls,
      reason: 'missing',
      must_verify_after_write: true,
    }
    const result = {
      contract_version: 'automatic-gate-progression-evaluation-result-v2',
      task_id: focused.task_id,
      evaluated_at: focused.evaluated_at,
      input_fingerprint: `agp-input-v2:sha256:${'d'.repeat(64)}`,
      precedence_trace: ['structural_admission', 'gate_status_projection'],
      gate_status_requirement: clone(gateRequirement),
      kind: 'require_gate_status_update',
      requirement: clone(gateRequirement),
    }
    const authorization = {
      authoring_role: 'backend_implementer',
      canonical_record: focusedEvidenceUrls[7],
      task_id: focused.task_id,
      assignment_revision: 1,
      repository: focused.repository,
      pr_url: focused.pr_url,
      head: focused.head,
      base: focused.base,
      evaluator_input_fingerprint: result.input_fingerprint,
      evaluator_result_sha256: shaJcs(result),
      projection: clone(focusedProjection),
      projection_sha256: shaJcs(focusedProjection),
    }
    const input = {
      contract_version: 'gate-status-publication-input-v1',
      identity: {
        task_id: focused.task_id,
        assignment_revision: 1,
        repository: focused.repository,
        task_assignment_url: focusedEvidenceUrls[0],
        projection_authority_url: focusedEvidenceUrls[7],
        authorized_metadata_role: 'backend_implementer',
        authorized_transport_action: 'publish_gate_status_projection',
        pr_url: focused.pr_url,
        pr_number: 207,
        branch: { state: 'assigned', value: focused.branch },
        worktree: { state: 'assigned', value: focused.worktree },
        expected_head: focused.head,
        expected_base: focused.base,
      },
      evaluator: {
        admission_state: 'accepted',
        result,
        result_sha256: shaJcs(result),
      },
      projection_authorization: authorization,
      role_authority_set: {
        contract_version: 'gate-status-role-authority-set-v1',
        task_id: focused.task_id,
        assignment_revision: 1,
        repository: focused.repository,
        records: selected.authorities.map((index) =>
          clone(focusedAuthorities[index].record)),
      },
      evidence_records: selected.evidence.map((index) =>
        clone(focusedEvidence[index].record)),
      pr_snapshot: {
        snapshot: clone(focusedPrSnapshot),
        body_utf8: focusedPrBody,
        body_matches_snapshot_sha256: true,
      },
      prior_attempt_authorities: {
        contract_version: 'gate-status-prior-attempt-authority-set-v1',
        authority_set_url:
          'https://github.com/whatrune/sd-prompt-studio/issues/206#test-gsp-prior-attempt-authority-set',
        authoring_role: 'backend_implementer',
        task_id: focused.task_id,
        assignment_revision: 1,
        repository: focused.repository,
        pr_url: focused.pr_url,
        pr_number: 207,
        head: focused.head,
        base: focused.base,
        publication_key: `gate-status-publication-v1:sha256:${'0'.repeat(64)}`,
        completeness: 'complete_for_publication_key',
        state: 'absent',
        records: [],
        fetched_content_sha256: fixedDigest('5'),
        verification_state: 'verified',
      },
      prior_attempt_reconciliation_observation: { state: 'not_required' },
      prior_receipt: { state: 'absent' },
      receipt_authority: { state: 'not_authorized' },
      receipt_store_capability: { state: 'not_required' },
      transport_capability: {
        kind: 'github_pr_body_patch_without_atomic_precondition',
        provider: 'github',
        update_endpoint:
          'https://docs.github.com/en/rest/issues/issues#update-an-issue',
        conditional_write_supported: false,
        publisher_mutation_allowed: false,
        recovery_protocol:
          'authorized_metadata_role_update_then_fresh_reconciliation',
      },
    }
    input.prior_attempt_authorities.publication_key =
      api.buildGateStatusPublicationKeyV1(input)
    return input
  }
  const focusedProfileDigests = {
    ALL: 'sha256:67a3280bb94fb3b35d991d105dbb007b7d0bba5e6eb5bb5c2bc1d6d0005eadf8',
    TASK: 'sha256:cd5646903dc656271c723fcb1c5b14be68b86aa0c1bbd6dac588de2fa9b6721a',
    RESULT: 'sha256:2a80ac028864da45f0efdb57085e179abc418bc2efa350cad967f5304a2baeed',
    REVIEW: 'sha256:915f44cdea05523364cf9698aeeccab77739d6ad49a6dd962803571f40b252c9',
    FINAL: 'sha256:eab3b5412569b98483b80042c12038091e5f0f419144af40f24a12d456bcdc1f',
    OPERATIONAL:
      'sha256:952e610f7bf03b88b2630d8217a9fc01e970b0f68b3d90ce0976b9a399ec3f4c',
    PO_APPROVAL:
      'sha256:acb01d31d2725bec9aaf91aabaacb0e64ccd89e372ee0c290531b2a0a8f12d50',
    PROTECTED:
      'sha256:d285c8983ce13c3094ebfa213bb28093a04d7fb58629eb1940cc9906e1809395',
    PROJECTION:
      'sha256:cd5646903dc656271c723fcb1c5b14be68b86aa0c1bbd6dac588de2fa9b6721a',
    CHECK: 'sha256:35d26185432ad2deea2950e5ef1606b0f4c0ef23adf9011e7a8768d34127ad66',
    THREAD: 'sha256:5c8ce5e8f1a26586a0a0207348a8420387c337ed26ec7d90ec0ddd1847dac7f8',
  }
  for (const [profileId, expectedDigest] of Object.entries(focusedProfileDigests)) {
    assert.equal(
      shaJcs(buildFocusedProfileInput(profileId)),
      expectedDigest,
      `A012 ${profileId} profile input digest`,
    )
  }
  const decodePointer = (pointer) =>
    pointer === ''
      ? []
      : pointer.slice(1).split('/').map((part) =>
          part.replaceAll('~1', '/').replaceAll('~0', '~'))
  const focusedPointerParent = (root, pointer) => {
    const segments = decodePointer(pointer)
    const key = segments.pop()
    let parent = root
    for (const segment of segments) parent = parent[segment]
    return { parent, key }
  }
  const focusedPointerGet = (root, pointer) =>
    decodePointer(pointer).reduce((value, segment) => value[segment], root)
  const focusedPointerReplace = (root, pointer, value) => {
    const { parent, key } = focusedPointerParent(root, pointer)
    parent[key] = clone(value)
  }
  const focusedPointerAdd = (root, pointer, value) => {
    const { parent, key } = focusedPointerParent(root, pointer)
    if (Array.isArray(parent)) parent.splice(Number(key), 0, clone(value))
    else parent[key] = clone(value)
  }
  const focusedPointerRemove = (root, pointer) => {
    const { parent, key } = focusedPointerParent(root, pointer)
    if (Array.isArray(parent)) parent.splice(Number(key), 1)
    else delete parent[key]
  }
  const applyFocusedInputOperation = (input, operation) => {
    if (
      operation.kind === 'none' ||
      operation.kind === 'invoke_twice_without_mutation' ||
      operation.kind === 'mutate_after_admission'
    ) return
    if (operation.kind === 'sequence_input') {
      for (const child of operation.operations) applyFocusedInputOperation(input, child)
      return
    }
    if (operation.kind === 'remove_input') {
      focusedPointerRemove(input, operation.pointer)
      return
    }
    if (operation.kind === 'add_input') {
      focusedPointerAdd(input, operation.pointer, operation.value)
      return
    }
    if (operation.kind === 'replace_input') {
      focusedPointerReplace(input, operation.pointer, operation.value)
      return
    }
    if (operation.kind === 'swap_input') {
      const first = clone(focusedPointerGet(input, operation.pointer_a))
      const second = clone(focusedPointerGet(input, operation.pointer_b))
      focusedPointerReplace(input, operation.pointer_a, second)
      focusedPointerReplace(input, operation.pointer_b, first)
      return
    }
    if (operation.kind === 'duplicate_input_value') {
      focusedPointerReplace(
        input,
        operation.target_pointer,
        focusedPointerGet(input, operation.source_pointer),
      )
      return
    }
    assert.fail(`unknown focused input operation: ${operation.kind}`)
  }
  const focusedCanonicalRecords = (profileId) => {
    const profile = focusedProfiles[profileId]
    return [
      ...profile.authorities.map((index) => ({
        ordinal: `A${index}`,
        canonical_url: focusedAuthorityUrls[index],
        result: clone(focusedAuthorities[index].read),
      })),
      ...profile.evidence.map((index) => ({
        ordinal: `E${index}`,
        canonical_url: focusedEvidenceUrls[index],
        result: clone(focusedEvidence[index].read),
      })),
    ].sort((a, b) => Buffer.from(a.canonical_url).compare(Buffer.from(b.canonical_url)))
  }
  const applyFocusedSourceOperation = (entry, operation) => {
    const result = entry.result
    if (operation.kind === 'none') return
    if (operation.kind === 'replace_reader_digest') {
      const current = result[operation.digest_field]
      const replacement = current.endsWith('0') ? '1' : '0'
      result[operation.digest_field] = `${current.slice(0, -1)}${replacement}`
      return
    }
    if (operation.kind === 'add_reader_content') {
      focusedPointerAdd(result.content, operation.pointer, operation.value)
      result.content_projection_sha256 = shaJcs(result.content)
      return
    }
    if (operation.kind === 'replace_fetched_binding' && operation.pointer === '') {
      result.content = clone(operation.value)
    } else if (operation.kind === 'replace_fetched_binding') {
      focusedPointerReplace(result.content, operation.pointer, operation.value)
    } else if (operation.kind === 'add_fetched_binding') {
      focusedPointerAdd(result.content, operation.pointer, operation.value)
    } else if (operation.kind === 'remove_fetched_binding') {
      focusedPointerRemove(result.content, operation.pointer)
    } else {
      assert.fail(`unknown focused source operation: ${operation.kind}`)
    }
    result.body_utf8 = focusedFixtureBody(
      entry.ordinal,
      entry.ordinal.startsWith('A')
        ? 'gate_status_role_authority_binding'
        : 'gate_status_evidence_binding',
      result.content,
    )
    result.fetched_content_sha256 = shaText(result.body_utf8)
    result.content_projection_sha256 = shaJcs(result.content)
  }
  const synchronizeFocusedClaim = (input, entry, claimBinding) => {
    if (claimBinding === 'preserve') return
    const records = entry.ordinal.startsWith('A')
      ? input.role_authority_set.records
      : input.evidence_records
    const record = records.find((candidate) =>
      candidate.canonical_url === entry.canonical_url)
    assert.ok(record, `claim target ${entry.ordinal}`)
    if (claimBinding === 'synchronize_both_digests') {
      record.fetched_content_sha256 = entry.result.fetched_content_sha256
      record.content_projection_sha256 = entry.result.content_projection_sha256
    } else if (claimBinding === 'synchronize_content_projection_digest') {
      record.content_projection_sha256 = entry.result.content_projection_sha256
    } else {
      assert.fail(`unknown focused claim binding: ${claimBinding}`)
    }
  }
  const expandFocusedPorts = (profileId, input, plan) => {
    const canonical_records =
      plan.kind === 'validator_only' ? [] : focusedCanonicalRecords(profileId)
    let fault = null
    if (plan.kind === 'canonical_unavailable') {
      canonical_records.find((entry) =>
        entry.ordinal === plan.target_ordinal).result = { state: 'unavailable' }
    } else if (plan.kind === 'canonical_throw') {
      fault = {
        kind: 'canonical_read_throw',
        target_ordinal: plan.target_ordinal,
        safe_error_id: plan.safe_error_id,
      }
    } else if (plan.kind === 'canonical_override') {
      const entry = canonical_records.find((candidate) =>
        candidate.ordinal === plan.target_ordinal)
      assert.ok(entry, `source target ${plan.target_ordinal}`)
      applyFocusedSourceOperation(entry, plan.source_operation)
      synchronizeFocusedClaim(input, entry, plan.claim_binding)
    }
    return {
      contract_version: 'gate-status-focused-port-plan-v1',
      plan_kind: plan.kind,
      canonical_records,
      pr_read:
        plan.kind === 'validator_only' || plan.kind === 'canonical_throw'
          ? { kind: 'forbidden' }
          : {
              kind: 'single_available',
              value: {
                snapshot: clone(focusedPrSnapshot),
                body_utf8: focusedPrBody,
              },
            },
      cas: { kind: 'forbidden' },
      receipt_store: { kind: 'forbidden' },
      write: { kind: 'forbidden' },
      retry: { kind: 'forbidden' },
      fault,
    }
  }
  const expandFocusedCase = (rowEncoding) => {
    const input = buildFocusedProfileInput(rowEncoding.profile_id)
    applyFocusedInputOperation(input, rowEncoding.input_operation)
    const ports = expandFocusedPorts(
      rowEncoding.profile_id,
      input,
      rowEncoding.port_plan,
    )
    return {
      contract_version: 'gate-status-focused-expanded-case-v1',
      row_id: rowEncoding.row_id,
      profile_id: rowEncoding.profile_id,
      input_operation: clone(rowEncoding.input_operation),
      port_plan_encoding: clone(rowEncoding.port_plan),
      public_surface: rowEncoding.public_surface,
      input,
      ports,
      expected_tuple: clone(rowEncoding.expected_tuple),
      call_vector: clone(rowEncoding.call_vector),
      assertion_profile: rowEncoding.assertion_profile,
    }
  }
  const focusedAcceptedTuple = {
    result_kind: 'accepted',
    stage: null,
    stop_code: null,
    diagnostic_path: null,
  }
  const focusedFirstRow = {
    row_id: 'GSP-S1-ROLE-AUTH-001',
    profile_id: 'ALL',
    input_operation: { kind: 'none' },
    port_plan: { kind: 'validator_only' },
    public_surface: 'validateGateStatusPublicationInputV1',
    expected_tuple: focusedAcceptedTuple,
    call_vector: [0, 0, 0, 0, 0, 0, 0],
    assertion_profile: 'validator_accept',
  }
  assert.equal(
    shaJcs(expandFocusedCase(focusedFirstRow)),
    'sha256:aee3ca81967aacc6791c849a489dcc45f6f6da3b9100f8028725d6c67fa7fb72',
    'A012 first expanded case digest',
  )
  const focusedStoppedTuple = (stage, stop_code, diagnostic_path) => ({
    result_kind: 'stopped',
    stage,
    stop_code,
    diagnostic_path,
  })
  const focusedValidatorPlan = { kind: 'validator_only' }
  const focusedNonAtomicPlan = { kind: 'nonatomic_baseline' }
  const focusedLaterTuple = focusedStoppedTuple(
    'S11',
    'atomic_precondition_unavailable',
    '/prior_attempt_reconciliation_observation',
  )
  const focusedS1Tuple = (code, path) =>
    focusedStoppedTuple('S1', code, path)
  const focusedS6Tuple = (path) =>
    focusedStoppedTuple('S6', 'canonical_evidence_invalid', path)
  const focusedOverride = (
    target_ordinal,
    source_operation,
    claim_binding = 'synchronize_both_digests',
  ) => ({
    kind: 'canonical_override',
    target_ordinal,
    source_operation,
    claim_binding,
  })
  const focusedRows = [
    focusedFirstRow,
    {
      row_id: 'GSP-S1-ROLE-AUTH-002',
      profile_id: 'ALL',
      input_operation: { kind: 'remove_input', pointer: '/role_authority_set' },
      port_plan: focusedValidatorPlan,
      public_surface: 'publishGateStatusV1',
      expected_tuple: focusedS1Tuple(
        'structural_admission_failed',
        '/role_authority_set',
      ),
      call_vector: [0, 0, 0, 0, 0, 0, 0],
      assertion_profile: 'fail_closed',
    },
    {
      row_id: 'GSP-S1-ROLE-AUTH-003',
      profile_id: 'ALL',
      input_operation: {
        kind: 'add_input',
        pointer: '/role_authority_set/records/0/scope/unexpected',
        value: true,
      },
      port_plan: focusedValidatorPlan,
      public_surface: 'publishGateStatusV1',
      expected_tuple: focusedS1Tuple(
        'structural_admission_failed',
        '/role_authority_set/records/0/scope/unexpected',
      ),
      call_vector: [0, 0, 0, 0, 0, 0, 0],
      assertion_profile: 'fail_closed',
    },
    {
      row_id: 'GSP-S1-ROLE-AUTH-004',
      profile_id: 'ALL',
      input_operation: {
        kind: 'duplicate_input_value',
        source_pointer: '/role_authority_set/records/0/canonical_url',
        target_pointer: '/role_authority_set/records/1/canonical_url',
      },
      port_plan: focusedValidatorPlan,
      public_surface: 'publishGateStatusV1',
      expected_tuple: focusedS1Tuple(
        'duplicate_set_member',
        '/role_authority_set/records/1/canonical_url',
      ),
      call_vector: [0, 0, 0, 0, 0, 0, 0],
      assertion_profile: 'fail_closed',
    },
    {
      row_id: 'GSP-S1-ROLE-AUTH-005',
      profile_id: 'ALL',
      input_operation: {
        kind: 'swap_input',
        pointer_a: '/role_authority_set/records/0',
        pointer_b: '/role_authority_set/records/1',
      },
      port_plan: focusedValidatorPlan,
      public_surface: 'publishGateStatusV1',
      expected_tuple: focusedS1Tuple(
        'noncanonical_set_order',
        '/role_authority_set/records/1/canonical_url',
      ),
      call_vector: [0, 0, 0, 0, 0, 0, 0],
      assertion_profile: 'fail_closed',
    },
    {
      row_id: 'GSP-S1-ROLE-AUTH-006',
      profile_id: 'ALL',
      input_operation: {
        kind: 'remove_input',
        pointer: '/role_authority_set/records/0',
      },
      port_plan: focusedValidatorPlan,
      public_surface: 'publishGateStatusV1',
      expected_tuple: focusedS1Tuple(
        'invalid_cross_input_binding',
        '/role_authority_set/records',
      ),
      call_vector: [0, 0, 0, 0, 0, 0, 0],
      assertion_profile: 'fail_closed',
    },
    {
      row_id: 'GSP-S1-ROLE-AUTH-007',
      profile_id: 'ALL',
      input_operation: {
        kind: 'add_input',
        pointer: '/role_authority_set/records/5',
        value: {
          authority_class: 'admitted_role_authority',
          authority_kind: 'review_assignment',
          canonical_url:
            'https://github.com/whatrune/sd-prompt-studio/issues/206#test-gsp-role-authority-05-unused-review',
          source_record_url:
            'https://github.com/whatrune/sd-prompt-studio/issues/206#test-gsp-source-05-unused-review-source',
          issuer_role: 'integrated_lead',
          authorized_role: 'architect_team',
          task_id: focused.task_id,
          assignment_revision: 1,
          repository: focused.repository,
          scope: {
            scope_kind: 'review_assignment',
            pr_url: focused.pr_url,
            reviewed_head: focused.head,
            review_kind: 'implementation_review',
          },
          fetched_content_sha256:
            'sha256:6d915e34df6037b62e1dfa73cb9943422c4912247c5b926d8f729d457242ca0a',
          content_projection_sha256:
            'sha256:665f69ce86b82c30b3ee7d1b737d834ab84caa0b93f62013bfdf979043a7353d',
          verification_state: 'verified',
        },
      },
      port_plan: focusedValidatorPlan,
      public_surface: 'publishGateStatusV1',
      expected_tuple: focusedS1Tuple(
        'invalid_cross_input_binding',
        '/role_authority_set/records/5',
      ),
      call_vector: [0, 0, 0, 0, 0, 0, 0],
      assertion_profile: 'fail_closed',
    },
    {
      row_id: 'GSP-S1-ROLE-AUTH-008',
      profile_id: 'ALL',
      input_operation: {
        kind: 'replace_input',
        pointer: '/evidence_records/1/author_role_authority_ref',
        value:
          'https://github.com/whatrune/sd-prompt-studio/issues/206#test-gsp-role-authority-99-absent',
      },
      port_plan: focusedValidatorPlan,
      public_surface: 'publishGateStatusV1',
      expected_tuple: focusedS1Tuple(
        'invalid_cross_input_binding',
        '/evidence_records/1/author_role_authority_ref',
      ),
      call_vector: [0, 0, 0, 0, 0, 0, 0],
      assertion_profile: 'fail_closed',
    },
    {
      row_id: 'GSP-S1-ROLE-AUTH-009',
      profile_id: 'ALL',
      input_operation: {
        kind: 'add_input',
        pointer: '/evidence_records/5/author_role_authority_ref',
        value: focusedAuthorityUrls[0],
      },
      port_plan: focusedValidatorPlan,
      public_surface: 'publishGateStatusV1',
      expected_tuple: focusedS1Tuple(
        'unknown_field',
        '/evidence_records/5/author_role_authority_ref',
      ),
      call_vector: [0, 0, 0, 0, 0, 0, 0],
      assertion_profile: 'fail_closed',
    },
    {
      row_id: 'GSP-S1-ROLE-AUTH-010',
      profile_id: 'ALL',
      input_operation: {
        kind: 'add_input',
        pointer: '/evidence_records/7/author_role_authority_ref',
        value: focusedAuthorityUrls[0],
      },
      port_plan: focusedValidatorPlan,
      public_surface: 'publishGateStatusV1',
      expected_tuple: focusedS1Tuple(
        'unknown_field',
        '/evidence_records/7/author_role_authority_ref',
      ),
      call_vector: [0, 0, 0, 0, 0, 0, 0],
      assertion_profile: 'fail_closed',
    },
    {
      row_id: 'GSP-S1-ROLE-AUTH-011',
      profile_id: 'ALL',
      input_operation: {
        kind: 'add_input',
        pointer: '/evidence_records/9/authoring_role',
        value: 'architect_team',
      },
      port_plan: focusedValidatorPlan,
      public_surface: 'publishGateStatusV1',
      expected_tuple: focusedS1Tuple(
        'unknown_field',
        '/evidence_records/9/authoring_role',
      ),
      call_vector: [0, 0, 0, 0, 0, 0, 0],
      assertion_profile: 'fail_closed',
    },
    {
      row_id: 'GSP-S1-ROLE-AUTH-012',
      profile_id: 'ALL',
      input_operation: {
        kind: 'replace_input',
        pointer: '/role_authority_set/records/0/scope/scope_kind',
        value: 'review_assignment',
      },
      port_plan: focusedValidatorPlan,
      public_surface: 'publishGateStatusV1',
      expected_tuple: focusedS1Tuple(
        'invalid_conditional_matrix',
        '/role_authority_set/records/0/scope/scope_kind',
      ),
      call_vector: [0, 0, 0, 0, 0, 0, 0],
      assertion_profile: 'fail_closed',
    },
  ]
  focusedRows.push(
    ...[
      ['GSP-S6-ROLE-AUTH-001', 'TASK', [1, 2, 1, 0, 0, 0, 0]],
      ['GSP-S6-ROLE-AUTH-002', 'REVIEW', [2, 3, 1, 0, 0, 0, 0]],
      ['GSP-S6-ROLE-AUTH-003', 'FINAL', [2, 3, 1, 0, 0, 0, 0]],
      ['GSP-S6-ROLE-AUTH-004', 'PROTECTED', [2, 3, 1, 0, 0, 0, 0]],
    ].map(([row_id, profile_id, call_vector]) => ({
      row_id,
      profile_id,
      input_operation: { kind: 'none' },
      port_plan: focusedNonAtomicPlan,
      public_surface: 'publishGateStatusV1',
      expected_tuple: focusedLaterTuple,
      call_vector,
      assertion_profile: 'later_stop',
    })),
    {
      row_id: 'GSP-S6-ROLE-AUTH-005',
      profile_id: 'TASK',
      input_operation: { kind: 'none' },
      port_plan: focusedOverride('A0', {
        kind: 'replace_fetched_binding',
        pointer: '',
        value: {},
        recompute: 'body_and_both_digests',
      }),
      public_surface: 'publishGateStatusV1',
      expected_tuple: focusedS6Tuple('/role_authority_set/records/0'),
      call_vector: [1, 0, 0, 0, 0, 0, 0],
      assertion_profile: 'fail_closed',
    },
    {
      row_id: 'GSP-S6-ROLE-AUTH-006',
      profile_id: 'TASK',
      input_operation: { kind: 'none' },
      port_plan: focusedOverride('A0', {
        kind: 'add_fetched_binding',
        pointer: '/unexpected',
        value: true,
        recompute: 'body_and_both_digests',
      }),
      public_surface: 'publishGateStatusV1',
      expected_tuple: focusedS6Tuple('/role_authority_set/records/0/unexpected'),
      call_vector: [1, 0, 0, 0, 0, 0, 0],
      assertion_profile: 'fail_closed',
    },
    {
      row_id: 'GSP-S6-ROLE-AUTH-007',
      profile_id: 'TASK',
      input_operation: { kind: 'none' },
      port_plan: focusedOverride('A0', {
        kind: 'remove_fetched_binding',
        pointer: '/authorized_role',
        recompute: 'body_and_both_digests',
      }),
      public_surface: 'publishGateStatusV1',
      expected_tuple:
        focusedS6Tuple('/role_authority_set/records/0/authorized_role'),
      call_vector: [1, 0, 0, 0, 0, 0, 0],
      assertion_profile: 'fail_closed',
    },
    {
      row_id: 'GSP-S6-ROLE-AUTH-008',
      profile_id: 'TASK',
      input_operation: { kind: 'none' },
      port_plan: focusedOverride(
        'A0',
        {
          kind: 'replace_reader_digest',
          digest_field: 'fetched_content_sha256',
          last_hex: '0',
        },
        'preserve',
      ),
      public_surface: 'publishGateStatusV1',
      expected_tuple:
        focusedS6Tuple('/role_authority_set/records/0/fetched_content_sha256'),
      call_vector: [1, 0, 0, 0, 0, 0, 0],
      assertion_profile: 'fail_closed',
    },
    {
      row_id: 'GSP-S6-ROLE-AUTH-009',
      profile_id: 'TASK',
      input_operation: { kind: 'none' },
      port_plan: focusedOverride(
        'A0',
        {
          kind: 'replace_reader_digest',
          digest_field: 'content_projection_sha256',
          last_hex: '0',
        },
        'preserve',
      ),
      public_surface: 'publishGateStatusV1',
      expected_tuple:
        focusedS6Tuple('/role_authority_set/records/0/content_projection_sha256'),
      call_vector: [1, 0, 0, 0, 0, 0, 0],
      assertion_profile: 'fail_closed',
    },
    {
      row_id: 'GSP-S6-ROLE-AUTH-010',
      profile_id: 'TASK',
      input_operation: { kind: 'none' },
      port_plan: focusedOverride('A0', {
        kind: 'replace_fetched_binding',
        pointer: '/authorized_role',
        value: 'product_owner',
        recompute: 'body_and_both_digests',
      }),
      public_surface: 'publishGateStatusV1',
      expected_tuple:
        focusedS6Tuple('/role_authority_set/records/0/authorized_role'),
      call_vector: [1, 0, 0, 0, 0, 0, 0],
      assertion_profile: 'fail_closed',
    },
    {
      row_id: 'GSP-S6-ROLE-AUTH-011',
      profile_id: 'TASK',
      input_operation: { kind: 'none' },
      port_plan: { kind: 'canonical_unavailable', target_ordinal: 'A0' },
      public_surface: 'publishGateStatusV1',
      expected_tuple: focusedS6Tuple('/role_authority_set/records/0'),
      call_vector: [1, 0, 0, 0, 0, 0, 0],
      assertion_profile: 'fail_closed',
    },
    {
      row_id: 'GSP-S6-ROLE-AUTH-012',
      profile_id: 'TASK',
      input_operation: { kind: 'none' },
      port_plan: {
        kind: 'canonical_throw',
        target_ordinal: 'A0',
        safe_error_id: 'deterministic_test_error',
      },
      public_surface: 'publishGateStatusV1',
      expected_tuple: focusedS6Tuple('/role_authority_set/records/0'),
      call_vector: [1, 0, 0, 0, 0, 0, 0],
      assertion_profile: 'fail_closed',
    },
  )
  focusedRows.push(
    {
      row_id: 'GSP-S6-ROLE-MATRIX-NEG-001',
      profile_id: 'TASK',
      input_operation: {
        kind: 'replace_input',
        pointer: '/evidence_records/0/authoring_role',
        value: 'product_owner',
      },
      port_plan: focusedOverride('E0', {
        kind: 'replace_fetched_binding',
        pointer: '/authoring_role',
        value: 'product_owner',
        recompute: 'body_and_both_digests',
      }),
      public_surface: 'publishGateStatusV1',
      expected_tuple: focusedS6Tuple('/evidence_records/0/authoring_role'),
      call_vector: [1, 1, 0, 0, 0, 0, 0],
      assertion_profile: 'fail_closed',
    },
    ...[
      ['GSP-S6-ROLE-MATRIX-NEG-002', 'RESULT', 'E1', 'product_owner', [1, 2, 0, 0, 0, 0, 0]],
      ['GSP-S6-ROLE-MATRIX-NEG-003', 'REVIEW', 'E2', 'product_owner', [2, 2, 0, 0, 0, 0, 0]],
      ['GSP-S6-ROLE-MATRIX-NEG-004', 'FINAL', 'E3', 'product_owner', [2, 2, 0, 0, 0, 0, 0]],
      ['GSP-S6-ROLE-MATRIX-NEG-005', 'OPERATIONAL', 'E4', 'product_owner', [2, 2, 0, 0, 0, 0, 0]],
      ['GSP-S6-ROLE-MATRIX-NEG-006', 'PO_APPROVAL', 'E5', 'integrated_lead', [1, 2, 0, 0, 0, 0, 0]],
      ['GSP-S6-ROLE-MATRIX-NEG-007', 'PROTECTED', 'E6', 'product_owner', [2, 2, 0, 0, 0, 0, 0]],
    ].map(([row_id, profile_id, target, role, call_vector]) => ({
      row_id,
      profile_id,
      input_operation: {
        kind: 'replace_input',
        pointer: '/evidence_records/1/authoring_role',
        value: role,
      },
      port_plan: focusedOverride(target, {
        kind: 'replace_fetched_binding',
        pointer: '/authoring_role',
        value: role,
        recompute: 'body_and_both_digests',
      }),
      public_surface: 'publishGateStatusV1',
      expected_tuple: focusedS6Tuple('/evidence_records/1/authoring_role'),
      call_vector,
      assertion_profile: 'fail_closed',
    })),
    {
      row_id: 'GSP-S6-ROLE-MATRIX-NEG-008',
      profile_id: 'PROJECTION',
      input_operation: {
        kind: 'replace_input',
        pointer: '/evidence_records/1/authoring_role',
        value: 'product_owner',
      },
      port_plan: focusedOverride('E7', {
        kind: 'replace_fetched_binding',
        pointer: '/record_authoring_role',
        value: 'product_owner',
        recompute: 'body_and_both_digests',
      }),
      public_surface: 'publishGateStatusV1',
      expected_tuple: focusedS6Tuple('/evidence_records/1/authoring_role'),
      call_vector: [1, 2, 0, 0, 0, 0, 0],
      assertion_profile: 'fail_closed',
    },
    {
      row_id: 'GSP-S6-ROLE-MATRIX-NEG-009',
      profile_id: 'CHECK',
      input_operation: {
        kind: 'replace_input',
        pointer: '/evidence_records/2/producer',
        value: {
          kind: 'github_user',
          login: 'backend-architect',
          database_id: 206,
        },
      },
      port_plan: focusedOverride(
        'E8',
        { kind: 'none' },
        'preserve',
      ),
      public_surface: 'publishGateStatusV1',
      expected_tuple: focusedS6Tuple('/evidence_records/2/producer'),
      call_vector: [1, 3, 0, 0, 0, 0, 0],
      assertion_profile: 'fail_closed',
    },
    {
      row_id: 'GSP-S6-ROLE-MATRIX-NEG-010',
      profile_id: 'THREAD',
      input_operation: { kind: 'none' },
      port_plan: focusedOverride(
        'E9',
        {
          kind: 'add_reader_content',
          pointer: '/producer',
          value: {
            kind: 'github_user',
            login: 'backend-architect',
            database_id: 206,
          },
          recompute: 'content_projection_digest_only',
        },
        'synchronize_content_projection_digest',
      ),
      public_surface: 'publishGateStatusV1',
      expected_tuple: focusedS6Tuple('/evidence_records/2/producer'),
      call_vector: [1, 3, 0, 0, 0, 0, 0],
      assertion_profile: 'fail_closed',
    },
  )
  focusedRows.push(
    ...[
      ['GSP-S6-ROLE-MATRIX-POS-001', 'TASK', [1, 2, 1, 0, 0, 0, 0]],
      ['GSP-S6-ROLE-MATRIX-POS-002', 'RESULT', [1, 3, 1, 0, 0, 0, 0]],
      ['GSP-S6-ROLE-MATRIX-POS-003', 'REVIEW', [2, 3, 1, 0, 0, 0, 0]],
      ['GSP-S6-ROLE-MATRIX-POS-004', 'FINAL', [2, 3, 1, 0, 0, 0, 0]],
      ['GSP-S6-ROLE-MATRIX-POS-005', 'OPERATIONAL', [2, 3, 1, 0, 0, 0, 0]],
      ['GSP-S6-ROLE-MATRIX-POS-006', 'PO_APPROVAL', [1, 3, 1, 0, 0, 0, 0]],
      ['GSP-S6-ROLE-MATRIX-POS-007', 'PROTECTED', [2, 3, 1, 0, 0, 0, 0]],
      ['GSP-S6-ROLE-MATRIX-POS-008', 'PROJECTION', [1, 2, 1, 0, 0, 0, 0]],
      ['GSP-S6-ROLE-MATRIX-POS-009', 'CHECK', [1, 3, 1, 0, 0, 0, 0]],
      ['GSP-S6-ROLE-MATRIX-POS-010', 'THREAD', [1, 3, 1, 0, 0, 0, 0]],
    ].map(([row_id, profile_id, call_vector]) => ({
      row_id,
      profile_id,
      input_operation: { kind: 'none' },
      port_plan: focusedNonAtomicPlan,
      public_surface: 'publishGateStatusV1',
      expected_tuple: focusedLaterTuple,
      call_vector,
      assertion_profile: 'later_stop',
    })),
  )
  const focusedCaseDigests = {
    'GSP-S1-ROLE-AUTH-001': 'sha256:aee3ca81967aacc6791c849a489dcc45f6f6da3b9100f8028725d6c67fa7fb72',
    'GSP-S1-ROLE-AUTH-002': 'sha256:277ec8d795e657f29d4e4e04f729f9c0e6dd03ff05609167bd4dbff7f6f8a740',
    'GSP-S1-ROLE-AUTH-003': 'sha256:481d618ec51ae49512afe259059c16ab81b2f8ce12836122e88c84d1738b77f0',
    'GSP-S1-ROLE-AUTH-004': 'sha256:9ab576c89f4e955fed75388bfaa97ee66c74801768313f528e1eae614cbd359e',
    'GSP-S1-ROLE-AUTH-005': 'sha256:304c18095690c8a7c573fac031514ffe0bbf4230993a4ae5c84724255b13e930',
    'GSP-S1-ROLE-AUTH-006': 'sha256:ba58ceb5f30cd5623f678b3e52672211885e2e455d2ed8fa83a82645ada01b25',
    'GSP-S1-ROLE-AUTH-007': 'sha256:eb5d69d8fe421504f7b066a97b2e76f127195ace9ed0e09440270535edd505b7',
    'GSP-S1-ROLE-AUTH-008': 'sha256:f4a4014ced45149e370a61bcbd2211fc365de26193d5707f0bbd3db8f2ed58a3',
    'GSP-S1-ROLE-AUTH-009': 'sha256:01c29cf8723e516a535883ccc81e492f4117cab774692365a76d2b94111401de',
    'GSP-S1-ROLE-AUTH-010': 'sha256:ad5120e9a04bf22772394ac6648704c309934d6a586a28a644330c9e477e5559',
    'GSP-S1-ROLE-AUTH-011': 'sha256:62c70a479f354667c6d4451742a34f3c1a81afacc79a20f01c7b7863a6e56e1a',
    'GSP-S1-ROLE-AUTH-012': 'sha256:c35815f7bf09c751256d0413413b855bf742fc23c48db2e2ce0b9c8bb4b190da',
    'GSP-S6-ROLE-AUTH-001': 'sha256:684741059cbc688df7583ec9c59b9084ecd1b44e33af5b6514367ba6fc17edbe',
    'GSP-S6-ROLE-AUTH-002': 'sha256:c4c9f8228fd83bfe55e360f4a38ee6a8597d898ecfd819e82008141c40f3247f',
    'GSP-S6-ROLE-AUTH-003': 'sha256:4743baf896411bfb8f8fdef0a00f7dc18f10526352baa21b9081276252dd01f3',
    'GSP-S6-ROLE-AUTH-004': 'sha256:5a998116ce19f2cf7e88f41933e948ca9b5c0ce6f32989f2d4927897a4128f16',
    'GSP-S6-ROLE-AUTH-005': 'sha256:8aef4eda7924e0596f16b0c7943dd57cbe44b3d84c7a0d9a922bdc154beef79a',
    'GSP-S6-ROLE-AUTH-006': 'sha256:e0ec1b5828a6763165ec8bd04381c8267051f2483de8044ce8bcfb484df674a9',
    'GSP-S6-ROLE-AUTH-007': 'sha256:0374df5dbffc0d5d07b61f937ef084ac5e8264af99418a5609091be046c2ec04',
    'GSP-S6-ROLE-AUTH-008': 'sha256:af3eaa759cc5b89a9d261757c35f44cadfb35ff3224b770105690f685f21ca75',
    'GSP-S6-ROLE-AUTH-009': 'sha256:7dfcff7b15d284fb1c3bce045796e57c305c17a49e6e16f44bb9f09e0d66f0a2',
    'GSP-S6-ROLE-AUTH-010': 'sha256:17007aa3daf8f90e80e496b8a743e666517a3f4550ccaa627b849da15079d4ae',
    'GSP-S6-ROLE-AUTH-011': 'sha256:70b4b498b3a8c845cf8884406108e834d59fd798f44cf548bd453fc662bbf89a',
    'GSP-S6-ROLE-AUTH-012': 'sha256:857a334fc8e1ecb305e8761707d70620ea2d78b26c726094e02b27f6af6bbf12',
    'GSP-S6-ROLE-BIND-001': 'sha256:21159418289e7b991a453b1fe663cf2991820805f9c252b5271c0b8caaa7b819',
    'GSP-S6-ROLE-BIND-002': 'sha256:854cad6690c014070fe6a8b54f49a3122510c04ce9f211789f65d404ce62fdb8',
    'GSP-S6-ROLE-BIND-003': 'sha256:450350085082e6244ff67d2de8fb0676f0ed1eba5bfbebd1f92aea05914d53d8',
    'GSP-S6-ROLE-BIND-004': 'sha256:d702914952b420edffddf7e64aaa845e687b895634c1bf3494d35186f0ae1fc2',
    'GSP-S6-ROLE-BIND-005': 'sha256:595cd5968df5c32639182b43f7dc0185be157b5c1c06a1a56eb8cd7a96f7b129',
    'GSP-S6-ROLE-BIND-006': 'sha256:f05209b941a1be1b192f8c899c5b5062754168ab77191cb9615c4ca44ce11be3',
    'GSP-S6-ROLE-BIND-007': 'sha256:5c7f89ece5fa71563c05e45e979c29b7a1a4eb52860c860b6bfd4ff3d952e9f0',
    'GSP-S6-ROLE-BIND-008': 'sha256:2cf8273d5e061a91478764153e3ab28f41d377837bfda5b3dafdb855db050d1d',
    'GSP-S6-ROLE-BIND-009': 'sha256:c4b795232783a46038340969fb8409560cc9745e51e3beb3215f7ee0202c800e',
    'GSP-S6-ROLE-BIND-010': 'sha256:09b18ca624d33e787005124281e122239d8e39b9955f3c9e1df3f4b7366a0b15',
    'GSP-S6-ROLE-BIND-011': 'sha256:f1ef380d024c3b18e4ad0283b2216a95a40e8930b2dbbd92cc35facfed6a1b04',
    'GSP-S6-ROLE-BIND-012': 'sha256:3eabe27351e7fb52ed600a84bd2bed9869c23b1cc0b3d91aea159a00474b1ff8',
    'GSP-S6-ROLE-MATRIX-NEG-001': 'sha256:f681f0bc18d27decbeb89c0936d1636084034b3e64c431426bec9f31c2aa81ac',
    'GSP-S6-ROLE-MATRIX-NEG-002': 'sha256:37e242ed588161966cbb23f647774ac256af93e315f2b653762f3291bbb12073',
    'GSP-S6-ROLE-MATRIX-NEG-003': 'sha256:eb136e99b9e11fa7ea6738e2a396c1324eee379d99386a0eceab79efb21eb083',
    'GSP-S6-ROLE-MATRIX-NEG-004': 'sha256:6f8705ddfc3f17aa3200d37c765413d2d0a1c2938201b8bced913e66ccf3dd00',
    'GSP-S6-ROLE-MATRIX-NEG-005': 'sha256:a221b1e41e6af4469175b13bebd0d59daae1907848ca81eeca3d453cb479d2eb',
    'GSP-S6-ROLE-MATRIX-NEG-006': 'sha256:02462c78cb7efa7910b11c9e2204b41d93f4e3d5d87bd583563d191f49316f26',
    'GSP-S6-ROLE-MATRIX-NEG-007': 'sha256:3d1f0bff28f2323b8592366553c2044fcef71e7dac2b0d42f334c5cda6dac31c',
    'GSP-S6-ROLE-MATRIX-NEG-008': 'sha256:2103102476340125c478cc92a23a63482ff54607362b75c5f8ac3db94760f4e1',
    'GSP-S6-ROLE-MATRIX-NEG-009': 'sha256:b62f33a06f34e0b616759230fcfc1595b6da8decf60478a86ad91d6d4b073945',
    'GSP-S6-ROLE-MATRIX-NEG-010': 'sha256:20a312f0e8b57658a07a60bd6b07bc18fd9e29809d7e531c5e4e046cea2258f3',
    'GSP-S6-ROLE-MATRIX-POS-001': 'sha256:67167118758bd0d1dece1b6a080fb78ad5a77e0620422fc446746ad5f9189e76',
    'GSP-S6-ROLE-MATRIX-POS-002': 'sha256:03690f0ab98c007d876b6d8692bfec16b57f46dceab85b48b08ac52c3c55cc9f',
    'GSP-S6-ROLE-MATRIX-POS-003': 'sha256:beccad6a66f318b4f69261fbe68b51e8f949e337c67862b5052150fd51f0f815',
    'GSP-S6-ROLE-MATRIX-POS-004': 'sha256:22408979a3c16e948b31c464764c7bc5cd393ceb8bbdee3f452d1cbab06d8826',
    'GSP-S6-ROLE-MATRIX-POS-005': 'sha256:a5ee19761d686d94204f821af77fa9adb85accf584c69d7da35de1348ab9dc05',
    'GSP-S6-ROLE-MATRIX-POS-006': 'sha256:c6b5bad0b1f4fb8a598a5f16d4c8ec2b7c06d1148a3eae463aed0180e7db7359',
    'GSP-S6-ROLE-MATRIX-POS-007': 'sha256:409f4b9446787435ad2ddc70e7603587a08b8806ba7bf5cce18cf9fc67de4cd6',
    'GSP-S6-ROLE-MATRIX-POS-008': 'sha256:427b26571c6d617ddcd4ff46c1a2e75f5b833309cf16d36b3fd047e562f16637',
    'GSP-S6-ROLE-MATRIX-POS-009': 'sha256:c28d804ddba5454cd636b8fe0bfa25e9d983febddfd8a868f74def5547826651',
    'GSP-S6-ROLE-MATRIX-POS-010': 'sha256:139f6c75e2442b88f727c18b2c5659315a483e9998b7d590850eef75e79f5e7b',
  }
  focusedRows.push(
    {
      row_id: 'GSP-S6-ROLE-BIND-001',
      profile_id: 'RESULT',
      input_operation: {
        kind: 'sequence_input',
        operations: [
          {
            kind: 'replace_input',
            pointer: '/role_authority_set/records/0/authorized_role',
            value: 'product_owner',
          },
          {
            kind: 'replace_input',
            pointer: '/evidence_records/1/authoring_role',
            value: 'product_owner',
          },
        ],
      },
      port_plan: focusedOverride('E1', {
        kind: 'replace_fetched_binding',
        pointer: '/authoring_role',
        value: 'product_owner',
        recompute: 'body_and_both_digests',
      }),
      public_surface: 'publishGateStatusV1',
      expected_tuple:
        focusedS6Tuple('/role_authority_set/records/0/authorized_role'),
      call_vector: [1, 0, 0, 0, 0, 0, 0],
      assertion_profile: 'fail_closed',
    },
    {
      row_id: 'GSP-S6-ROLE-BIND-002',
      profile_id: 'TASK',
      input_operation: { kind: 'none' },
      port_plan: focusedOverride('A0', {
        kind: 'replace_fetched_binding',
        pointer: '/source_record_url',
        value:
          'https://github.com/whatrune/sd-prompt-studio/issues/206#test-gsp-source-99-wrong',
        recompute: 'body_and_both_digests',
      }),
      public_surface: 'publishGateStatusV1',
      expected_tuple:
        focusedS6Tuple('/role_authority_set/records/0/source_record_url'),
      call_vector: [1, 0, 0, 0, 0, 0, 0],
      assertion_profile: 'fail_closed',
    },
    {
      row_id: 'GSP-S6-ROLE-BIND-003',
      profile_id: 'TASK',
      input_operation: { kind: 'none' },
      port_plan: focusedOverride('A0', {
        kind: 'replace_fetched_binding',
        pointer: '/task_id',
        value: 'OTHER-TASK-001',
        recompute: 'body_and_both_digests',
      }),
      public_surface: 'publishGateStatusV1',
      expected_tuple: focusedS6Tuple('/role_authority_set/records/0/task_id'),
      call_vector: [1, 0, 0, 0, 0, 0, 0],
      assertion_profile: 'fail_closed',
    },
    {
      row_id: 'GSP-S6-ROLE-BIND-004',
      profile_id: 'TASK',
      input_operation: { kind: 'none' },
      port_plan: focusedOverride('A0', {
        kind: 'replace_fetched_binding',
        pointer: '/assignment_revision',
        value: 2,
        recompute: 'body_and_both_digests',
      }),
      public_surface: 'publishGateStatusV1',
      expected_tuple:
        focusedS6Tuple('/role_authority_set/records/0/assignment_revision'),
      call_vector: [1, 0, 0, 0, 0, 0, 0],
      assertion_profile: 'fail_closed',
    },
    {
      row_id: 'GSP-S6-ROLE-BIND-005',
      profile_id: 'TASK',
      input_operation: { kind: 'none' },
      port_plan: focusedOverride('A0', {
        kind: 'replace_fetched_binding',
        pointer: '/repository',
        value: 'whatrune/other-repository',
        recompute: 'body_and_both_digests',
      }),
      public_surface: 'publishGateStatusV1',
      expected_tuple:
        focusedS6Tuple('/role_authority_set/records/0/repository'),
      call_vector: [1, 0, 0, 0, 0, 0, 0],
      assertion_profile: 'fail_closed',
    },
    {
      row_id: 'GSP-S6-ROLE-BIND-006',
      profile_id: 'REVIEW',
      input_operation: { kind: 'none' },
      port_plan: focusedOverride('A1', {
        kind: 'replace_fetched_binding',
        pointer: '/scope/pr_url',
        value: 'https://github.com/whatrune/sd-prompt-studio/pull/208',
        recompute: 'body_and_both_digests',
      }),
      public_surface: 'publishGateStatusV1',
      expected_tuple:
        focusedS6Tuple('/role_authority_set/records/1/scope/pr_url'),
      call_vector: [2, 0, 0, 0, 0, 0, 0],
      assertion_profile: 'fail_closed',
    },
    {
      row_id: 'GSP-S6-ROLE-BIND-007',
      profile_id: 'REVIEW',
      input_operation: { kind: 'none' },
      port_plan: focusedOverride('A1', {
        kind: 'replace_fetched_binding',
        pointer: '/scope/reviewed_head',
        value: '1111111111111111111111111111111111111111',
        recompute: 'body_and_both_digests',
      }),
      public_surface: 'publishGateStatusV1',
      expected_tuple:
        focusedS6Tuple('/role_authority_set/records/1/scope/reviewed_head'),
      call_vector: [2, 0, 0, 0, 0, 0, 0],
      assertion_profile: 'fail_closed',
    },
    {
      row_id: 'GSP-S6-ROLE-BIND-008',
      profile_id: 'FINAL',
      input_operation: { kind: 'none' },
      port_plan: focusedOverride('A2', {
        kind: 'replace_fetched_binding',
        pointer: '/scope/validation_kind',
        value: 'operational_validation',
        recompute: 'body_and_both_digests',
      }),
      public_surface: 'publishGateStatusV1',
      expected_tuple:
        focusedS6Tuple('/role_authority_set/records/1/scope/validation_kind'),
      call_vector: [2, 0, 0, 0, 0, 0, 0],
      assertion_profile: 'fail_closed',
    },
    {
      row_id: 'GSP-S6-ROLE-BIND-009',
      profile_id: 'PROTECTED',
      input_operation: {
        kind: 'replace_input',
        pointer: '/evidence_records/1/protected_action',
        value: 'approve',
      },
      port_plan: focusedOverride('E6', {
        kind: 'replace_fetched_binding',
        pointer: '/protected_action',
        value: 'approve',
        recompute: 'body_and_both_digests',
      }),
      public_surface: 'publishGateStatusV1',
      expected_tuple: focusedS6Tuple('/evidence_records/1/protected_action'),
      call_vector: [2, 2, 0, 0, 0, 0, 0],
      assertion_profile: 'fail_closed',
    },
    {
      row_id: 'GSP-S6-ROLE-BIND-010',
      profile_id: 'ALL',
      input_operation: { kind: 'none' },
      port_plan: focusedOverride('E1', {
        kind: 'replace_fetched_binding',
        pointer: '/author_role_authority_ref',
        value: focusedAuthorityUrls[1],
        recompute: 'body_and_both_digests',
      }),
      public_surface: 'publishGateStatusV1',
      expected_tuple:
        focusedS6Tuple('/evidence_records/1/author_role_authority_ref'),
      call_vector: [5, 2, 0, 0, 0, 0, 0],
      assertion_profile: 'fail_closed',
    },
    {
      row_id: 'GSP-S6-ROLE-BIND-011',
      profile_id: 'ALL',
      input_operation: { kind: 'invoke_twice_without_mutation' },
      port_plan: focusedNonAtomicPlan,
      public_surface: 'publishGateStatusV1',
      expected_tuple: focusedLaterTuple,
      call_vector: [10, 20, 2, 0, 0, 0, 0],
      assertion_profile: 'deterministic_rerun',
    },
    {
      row_id: 'GSP-S6-ROLE-BIND-012',
      profile_id: 'ALL',
      input_operation: {
        kind: 'mutate_after_admission',
        pointer: '/evidence_records/1/authoring_role',
        value: 'product_owner',
      },
      port_plan: focusedNonAtomicPlan,
      public_surface: 'publishGateStatusV1',
      expected_tuple: focusedLaterTuple,
      call_vector: [5, 10, 1, 0, 0, 0, 0],
      assertion_profile: 'mutation_isolation',
    },
  )
  focusedRows.sort((a, b) =>
    Buffer.from(a.row_id).compare(Buffer.from(b.row_id)))
  assert.equal(focusedRows.length, 56)
  assert.equal(new Set(focusedRows.map((item) => item.row_id)).size, 56)
  const focusedLiteralBundle = {
    contract_version: 'gate-status-focused-literal-bundle-v1',
    constants: clone(focused),
    authority_urls: clone(focusedAuthorityUrls),
    authority_source_urls: clone(focusedAuthoritySourceUrls),
    evidence_urls: clone(focusedEvidenceUrls),
    authority_records: focusedAuthorities.map((item) => clone(item.record)),
    authority_reads: focusedAuthorities.map((item) => clone(item.read)),
    evidence_records: focusedEvidence.map((item) => clone(item.record)),
    evidence_reads: focusedEvidence.map((item) => clone(item.read)),
    unused_authority_record: clone(
      focusedRows.find((item) => item.row_id === 'GSP-S1-ROLE-AUTH-007')
        .input_operation.value,
    ),
    projection: clone(focusedProjection),
    pr_body_utf8: focusedPrBody,
    pr_snapshot: clone(focusedPrSnapshot),
    full_profile_input: buildFocusedProfileInput('ALL'),
  }
  assert.equal(
    shaJcs(focusedLiteralBundle),
    'sha256:da36ae82c12c312886f391f0b305e5aac46a6e23043161a507515eb545b58af0',
    'A012 literal bundle digest',
  )
  assert.equal(
    shaJcs(focusedRows),
    'sha256:2702a4b1cdd9abe0eb7eb1fa2a6f2ba80faf789304055ab744f0580c7beb555c',
    'A012 row encoding catalog digest',
  )
  const focusedExpandedCases = focusedRows.map((rowEncoding) => {
    const expanded = expandFocusedCase(rowEncoding)
    assert.equal(
      shaJcs(expanded),
      focusedCaseDigests[rowEncoding.row_id],
      `A012 expanded case digest ${rowEncoding.row_id}`,
    )
    return expanded
  })
  assert.equal(
    new Set(Object.values(focusedCaseDigests)).size,
    56,
    'A012 unique case digests',
  )
  const focusedCorpusProjection = (amendmentId, caseDigests) => ({
    contract_version: 'gate-status-focused-corpus-digest-v1',
    amendment_id: amendmentId,
    row_order: focusedRows.map((item) => item.row_id),
    cases: focusedRows.map((item) => ({
      row_id: item.row_id,
      case_sha256: caseDigests[item.row_id],
    })),
  })
  const focusedCurrentCorpus = focusedCorpusProjection(
    'GSP-ARCH-AMENDMENT-014',
    focusedCaseDigests,
  )
  assert.equal(
    shaJcs(focusedCurrentCorpus),
    'sha256:7a6fc92e95f4fb8e18381a7b173a78d1835b7a18ff1dfa8727bdcdc0e3ddba73',
    'A014 canonical corpus digest',
  )
  const focusedHistoricalCaseDigests = {
    ...focusedCaseDigests,
    'GSP-S6-ROLE-AUTH-012':
      'sha256:3d0886b7a02e774245e4a66e0ac93efda06afb2dc8da5063594672ecc8476794',
  }
  assert.equal(
    shaJcs(focusedCorpusProjection(
      'GSP-ARCH-AMENDMENT-012',
      focusedHistoricalCaseDigests,
    )),
    'sha256:9354c37514de61039d7303cf556a7a692eb97de9892efc39db1f68e1055f8bf9',
    'A014 historical corpus digest boundary',
  )
  assert.equal(
    shaJcs(focusedCorpusProjection(
      'GSP-ARCH-AMENDMENT-012',
      focusedCaseDigests,
    )),
    'sha256:937923f7081a9202d5f2403336d815ec68a5a7737fd45d1b1b3ee84b9faa8d03',
    'A014 forbidden intermediate corpus digest boundary',
  )
  const focusedReaderResultAdmitted = (result) => {
    if (result?.state === 'unavailable') {
      return Object.keys(result).length === 1
    }
    if (result?.state !== 'available') return false
    if (result.source_kind === 'canonical_body') {
      return (
        Object.keys(result).sort().join(',') ===
          [
            'body_utf8',
            'canonical_url',
            'content',
            'content_projection_sha256',
            'fetched_content_sha256',
            'source_kind',
            'state',
          ].sort().join(',') &&
        typeof result.body_utf8 === 'string' &&
        /^sha256:[0-9a-f]{64}$/.test(result.fetched_content_sha256) &&
        /^sha256:[0-9a-f]{64}$/.test(result.content_projection_sha256) &&
        result.content !== null &&
        typeof result.content === 'object'
      )
    }
    if (result.source_kind === 'github_resource') {
      return (
        Object.keys(result).sort().join(',') ===
          [
            'canonical_url',
            'content',
            'content_projection_sha256',
            'fetched_content_sha256',
            'source',
            'source_kind',
            'state',
          ].sort().join(',') &&
        /^sha256:[0-9a-f]{64}$/.test(result.fetched_content_sha256) &&
        /^sha256:[0-9a-f]{64}$/.test(result.content_projection_sha256) &&
        result.source !== null &&
        typeof result.source === 'object' &&
        result.content !== null &&
        typeof result.content === 'object'
      )
    }
    return false
  }
  const focusedCorpusCandidate = ({
    rows = focusedRows,
    cases = focusedExpandedCases,
    caseDigests = focusedCaseDigests,
    corpus = focusedCurrentCorpus,
    corpusDigest =
      'sha256:7a6fc92e95f4fb8e18381a7b173a78d1835b7a18ff1dfa8727bdcdc0e3ddba73',
  } = {}) => ({
    rows: clone(rows),
    cases: clone(cases),
    case_digests: clone(caseDigests),
    corpus: clone(corpus),
    corpus_digest: corpusDigest,
  })
  let focusedCorpusPublisherInvocations = 0
  const admitFocusedCorpus = (candidate) => {
    try {
      if (
        !Array.isArray(candidate.rows) ||
        candidate.rows.length !== 56 ||
        new Set(candidate.rows.map((row) => row.row_id)).size !== 56 ||
        shaJcs(candidate.rows) !==
          'sha256:2702a4b1cdd9abe0eb7eb1fa2a6f2ba80faf789304055ab744f0580c7beb555c'
      ) return { accepted: false, code: 'row_catalog_mismatch' }
      if (
        !Array.isArray(candidate.cases) ||
        candidate.cases.length !== 56 ||
        Object.keys(candidate.case_digests ?? {}).length !== 56
      ) return { accepted: false, code: 'case_set_mismatch' }
      for (let index = 0; index < candidate.rows.length; index += 1) {
        const rowId = candidate.rows[index].row_id
        const expandedCase = candidate.cases[index]
        if (
          expandedCase?.row_id !== rowId ||
          shaJcs(expandedCase) !== candidate.case_digests[rowId] ||
          candidate.case_digests[rowId] !== focusedCaseDigests[rowId]
        ) return { accepted: false, code: 'case_digest_mismatch', row_id: rowId }
        if (
          expandedCase.ports.canonical_records.some((entry) =>
            !focusedReaderResultAdmitted(entry.result))
        ) return { accepted: false, code: 'reader_result_invalid', row_id: rowId }
        if (expandedCase.ports.fault?.kind === 'canonical_read_throw') {
          const target = expandedCase.ports.canonical_records.find((entry) =>
            entry.ordinal === expandedCase.ports.fault.target_ordinal)
          if (!target || !focusedReaderResultAdmitted(target.result)) {
            return { accepted: false, code: 'throw_target_invalid', row_id: rowId }
          }
        }
      }
      const exactCorpus = focusedCorpusProjection(
        'GSP-ARCH-AMENDMENT-014',
        candidate.case_digests,
      )
      if (
        canonicalize(candidate.corpus) !== canonicalize(exactCorpus) ||
        shaJcs(candidate.corpus) !== candidate.corpus_digest ||
        candidate.corpus_digest !==
          'sha256:7a6fc92e95f4fb8e18381a7b173a78d1835b7a18ff1dfa8727bdcdc0e3ddba73'
      ) return { accepted: false, code: 'corpus_digest_mismatch' }
      return { accepted: true }
    } catch {
      return { accepted: false, code: 'malformed_corpus' }
    }
  }
  const focusedCorpusAdmissionCases = []
  {
    const exact = focusedCorpusCandidate()
    assert.equal(admitFocusedCorpus(exact).accepted, true)
    focusedCorpusAdmissionCases.push('GSP-A014-001')
  }
  {
    const oldClaim = focusedCorpusCandidate()
    oldClaim.case_digests['GSP-S6-ROLE-AUTH-012'] =
      'sha256:3d0886b7a02e774245e4a66e0ac93efda06afb2dc8da5063594672ecc8476794'
    assert.equal(admitFocusedCorpus(oldClaim).code, 'case_digest_mismatch')
    assert.equal(focusedCorpusPublisherInvocations, 0)
    focusedCorpusAdmissionCases.push('GSP-A014-002')
  }
  {
    assert.equal(
      shaJcs(focusedRows),
      'sha256:2702a4b1cdd9abe0eb7eb1fa2a6f2ba80faf789304055ab744f0580c7beb555c',
    )
    focusedCorpusAdmissionCases.push('GSP-A014-003')
  }
  {
    assert.equal(new Set(Object.values(focusedCaseDigests)).size, 56)
    focusedCorpusAdmissionCases.push('GSP-A014-004')
  }
  {
    assert.equal(
      shaJcs(focusedCurrentCorpus),
      'sha256:7a6fc92e95f4fb8e18381a7b173a78d1835b7a18ff1dfa8727bdcdc0e3ddba73',
    )
    focusedCorpusAdmissionCases.push('GSP-A014-005')
  }
  {
    const oldCorpus = focusedCorpusCandidate({
      caseDigests: focusedHistoricalCaseDigests,
      corpus: focusedCorpusProjection(
        'GSP-ARCH-AMENDMENT-012',
        focusedHistoricalCaseDigests,
      ),
      corpusDigest:
        'sha256:9354c37514de61039d7303cf556a7a692eb97de9892efc39db1f68e1055f8bf9',
    })
    assert.equal(admitFocusedCorpus(oldCorpus).accepted, false)
    assert.equal(focusedCorpusPublisherInvocations, 0)
    focusedCorpusAdmissionCases.push('GSP-A014-006')
  }
  {
    const intermediate = focusedCorpusCandidate({
      corpus: focusedCorpusProjection('GSP-ARCH-AMENDMENT-012', focusedCaseDigests),
      corpusDigest:
        'sha256:937923f7081a9202d5f2403336d815ec68a5a7737fd45d1b1b3ee84b9faa8d03',
    })
    assert.equal(admitFocusedCorpus(intermediate).accepted, false)
    assert.equal(focusedCorpusPublisherInvocations, 0)
    focusedCorpusAdmissionCases.push('GSP-A014-007')
  }
  {
    const comparison = clone(
      focusedExpandedCases.find((item) => item.row_id === 'GSP-S6-ROLE-AUTH-012'),
    )
    comparison.ports.pr_read = {
      kind: 'single_available',
      value: {
        snapshot: clone(focusedPrSnapshot),
        body_utf8: focusedPrBody,
      },
    }
    assert.equal(
      shaJcs(comparison),
      'sha256:3db5433306fdb62792c046056feec31409ca1943b47d3557b9406a34c906f75d',
    )
    const comparisonCandidate = focusedCorpusCandidate()
    comparisonCandidate.cases[
      focusedRows.findIndex((row) => row.row_id === 'GSP-S6-ROLE-AUTH-012')
    ] = comparison
    assert.equal(admitFocusedCorpus(comparisonCandidate).code, 'case_digest_mismatch')
    assert.equal(focusedCorpusPublisherInvocations, 0)
    focusedCorpusAdmissionCases.push('GSP-A014-008')
  }
  {
    const otherChange = focusedCorpusCandidate()
    otherChange.case_digests['GSP-S1-ROLE-AUTH-001'] =
      'sha256:0000000000000000000000000000000000000000000000000000000000000000'
    assert.equal(admitFocusedCorpus(otherChange).code, 'case_digest_mismatch')
    assert.equal(focusedCorpusPublisherInvocations, 0)
    focusedCorpusAdmissionCases.push('GSP-A014-009')
  }
  {
    const first = focusedCorpusCandidate()
    const second = focusedCorpusCandidate()
    assert.equal(canonicalize(first.corpus), canonicalize(second.corpus))
    assert.equal(shaJcs(first.corpus), shaJcs(second.corpus))
    focusedCorpusAdmissionCases.push('GSP-A014-010')
  }
  {
    const throwInsideResult = focusedCorpusCandidate()
    const authIndex = focusedRows.findIndex((row) =>
      row.row_id === 'GSP-S6-ROLE-AUTH-012')
    throwInsideResult.cases[authIndex].ports.canonical_records
      .find((entry) => entry.ordinal === 'A0').result.throw_sentinel =
        'deterministic_test_error'
    assert.equal(admitFocusedCorpus(throwInsideResult).accepted, false)
    assert.equal(focusedCorpusPublisherInvocations, 0)
    focusedCorpusAdmissionCases.push('GSP-A013-009')
  }
  for (const kind of ['omit', 'replace']) {
    const invalidTarget = focusedCorpusCandidate()
    const authIndex = focusedRows.findIndex((row) =>
      row.row_id === 'GSP-S6-ROLE-AUTH-012')
    const records = invalidTarget.cases[authIndex].ports.canonical_records
    const targetIndex = records.findIndex((entry) => entry.ordinal === 'A0')
    if (kind === 'omit') records.splice(targetIndex, 1)
    else records[targetIndex].result = { state: 'unavailable' }
    assert.equal(admitFocusedCorpus(invalidTarget).accepted, false)
    assert.equal(focusedCorpusPublisherInvocations, 0)
  }
  focusedCorpusAdmissionCases.push('GSP-A013-010')
  assert.equal(focusedCorpusAdmissionCases.length, 12)
  const focusedDeepFreeze = (value) => {
    if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
      for (const child of Object.values(value)) focusedDeepFreeze(child)
      Object.freeze(value)
    }
    return value
  }
  const focusedIsDeepFrozen = (value) =>
    value === null ||
    typeof value !== 'object' ||
    (
      Object.isFrozen(value) &&
      Object.values(value).every((child) => focusedIsDeepFrozen(child))
    )
  const makeFocusedPublicHarness = (expanded) => {
    const counts = {
      authority_read: 0,
      evidence_read: 0,
      pr_read: 0,
      cas: 0,
      receipt: 0,
      write: 0,
      retry: 0,
      other_canonical_read: 0,
    }
    const byUrl = new Map()
    const entries = new Map(
      expanded.ports.canonical_records.map((entry) =>
        [entry.canonical_url, entry]),
    )
    const authoritySet = new Set(
      expanded.input.role_authority_set?.records?.map((item) =>
        item.canonical_url) ?? [],
    )
    const evidenceSet = new Set(
      expanded.input.evidence_records?.map((item) => item.canonical_url) ?? [],
    )
    const read_canonical_record = async (url) => {
      byUrl.set(url, (byUrl.get(url) ?? 0) + 1)
      if (authoritySet.has(url)) counts.authority_read += 1
      else if (evidenceSet.has(url)) counts.evidence_read += 1
      else counts.other_canonical_read += 1
      const entry = entries.get(url)
      if (!entry) return { state: 'unavailable' }
      if (
        expanded.ports.fault?.kind === 'canonical_read_throw' &&
        expanded.ports.fault.target_ordinal === entry.ordinal
      ) throw new Error(expanded.ports.fault.safe_error_id)
      return clone(entry.result)
    }
    return {
      counts,
      ports: {
        read_canonical_record,
        read_pr: async () => {
          counts.pr_read += 1
          assert.equal(expanded.ports.pr_read.kind, 'single_available')
          return {
            state: 'available',
            ...clone(expanded.ports.pr_read.value),
          }
        },
        compare_and_swap_gate_status: async () => {
          counts.cas += 1
          counts.write += 1
          assert.fail('focused CAS is forbidden')
        },
        receipt_create_or_get: async () => {
          counts.receipt += 1
          assert.fail('focused receipt is forbidden')
        },
      },
    }
  }
  const focusedVector = (counts) => [
    counts.authority_read,
    counts.evidence_read,
    counts.pr_read,
    counts.cas,
    counts.receipt,
    counts.write,
    counts.retry,
  ]
  const focusedResultTuple = (result) => ({
    result_kind: result.kind,
    stage: result.branch.stopped.failed_stage.split('_', 1)[0],
    stop_code: result.branch.stopped.stop_code,
    diagnostic_path: result.diagnostics[0].path,
  })
  const runFocusedSingleInvocation = async (rowEncoding, expanded, input) => {
    focusedDeepFreeze(expanded.ports)
    assert.equal(focusedIsDeepFrozen(expanded.ports), true)
    const harness = makeFocusedPublicHarness({ ...expanded, input })
    const result = await api.publishGateStatusV1(input, harness.ports)
    assert.deepEqual(
      focusedResultTuple(result),
      rowEncoding.expected_tuple,
      rowEncoding.row_id,
    )
    assert.equal(harness.counts.other_canonical_read, 0, rowEncoding.row_id)
    assert.equal(focusedIsDeepFrozen(result), true, rowEncoding.row_id)
    assert.equal(JSON.stringify(result).includes('deterministic_test_error'), false)
    return { result, vector: focusedVector(harness.counts) }
  }
  const runFocusedPublicCase = async (rowEncoding) => {
    const expanded = expandFocusedCase(rowEncoding)
    if (rowEncoding.public_surface === 'validateGateStatusPublicationInputV1') {
      const input = focusedDeepFreeze(clone(expanded.input))
      assert.equal(focusedIsDeepFrozen(input), true)
      const admission = api.validateGateStatusPublicationInputV1(input)
      assert.equal(admission.accepted, true, rowEncoding.row_id)
      assert.deepEqual(rowEncoding.expected_tuple, focusedAcceptedTuple)
      assert.deepEqual(rowEncoding.call_vector, [0, 0, 0, 0, 0, 0, 0])
      return { result: admission, vector: rowEncoding.call_vector }
    }
    if (rowEncoding.assertion_profile === 'deterministic_rerun') {
      const firstExpanded = expandFocusedCase(rowEncoding)
      const secondExpanded = expandFocusedCase(rowEncoding)
      const first = await runFocusedSingleInvocation(
        rowEncoding,
        firstExpanded,
        focusedDeepFreeze(clone(firstExpanded.input)),
      )
      const second = await runFocusedSingleInvocation(
        rowEncoding,
        secondExpanded,
        focusedDeepFreeze(clone(secondExpanded.input)),
      )
      assert.equal(canonicalize(first.result), canonicalize(second.result), rowEncoding.row_id)
      assert.deepEqual(
        first.vector.map((value, index) => value + second.vector[index]),
        rowEncoding.call_vector,
        rowEncoding.row_id,
      )
      return { result: first.result, vector: rowEncoding.call_vector }
    }
    if (rowEncoding.assertion_profile === 'mutation_isolation') {
      const baselineExpanded = expandFocusedCase(rowEncoding)
      const baseline = await runFocusedSingleInvocation(
        rowEncoding,
        baselineExpanded,
        focusedDeepFreeze(clone(baselineExpanded.input)),
      )
      const callerInput = clone(expanded.input)
      focusedDeepFreeze(expanded.ports)
      const harness = makeFocusedPublicHarness({ ...expanded, input: callerInput })
      const originalRead = harness.ports.read_canonical_record
      let releaseFirstRead
      let signalFirstRead
      const firstReadEntered = new Promise((resolve) => { signalFirstRead = resolve })
      const firstReadRelease = new Promise((resolve) => { releaseFirstRead = resolve })
      let firstRead = true
      harness.ports.read_canonical_record = async (url) => {
        const result = await originalRead(url)
        if (firstRead) {
          firstRead = false
          signalFirstRead()
          await firstReadRelease
        }
        return result
      }
      const pending = api.publishGateStatusV1(callerInput, harness.ports)
      await firstReadEntered
      focusedPointerReplace(
        callerInput,
        rowEncoding.input_operation.pointer,
        rowEncoding.input_operation.value,
      )
      releaseFirstRead()
      const result = await pending
      assert.deepEqual(
        focusedResultTuple(result),
        rowEncoding.expected_tuple,
        rowEncoding.row_id,
      )
      assert.equal(canonicalize(result), canonicalize(baseline.result), rowEncoding.row_id)
      assert.deepEqual(focusedVector(harness.counts), rowEncoding.call_vector, rowEncoding.row_id)
      assert.equal(harness.counts.other_canonical_read, 0, rowEncoding.row_id)
      assert.equal(focusedIsDeepFrozen(result), true, rowEncoding.row_id)
      return { result, vector: focusedVector(harness.counts) }
    }
    const input = focusedDeepFreeze(clone(expanded.input))
    assert.equal(focusedIsDeepFrozen(input), true)
    const execution = await runFocusedSingleInvocation(rowEncoding, expanded, input)
    assert.deepEqual(execution.vector, rowEncoding.call_vector, rowEncoding.row_id)
    return execution
  }
  const focusedPublicRows = []
  const focusedPublicResults = new Map()
  for (const row of focusedRows) {
    const execution = await runFocusedPublicCase(row)
    focusedPublicRows.push(row.row_id)
    focusedPublicResults.set(row.row_id, execution)
  }
  assert.equal(focusedPublicRows.length, 56)
  const focusedA013Cases = []
  {
    const authCase = focusedExpandedCases.find((item) =>
      item.row_id === 'GSP-S6-ROLE-AUTH-012')
    assert.deepEqual(
      authCase.ports.canonical_records.map((entry) => entry.ordinal),
      ['E0', 'E7', 'A0'],
    )
    focusedA013Cases.push('GSP-A013-001')
    const target = authCase.ports.canonical_records.find((entry) =>
      entry.ordinal === 'A0')
    assert.equal(target.result.state, 'available')
    assert.equal(target.result.source_kind, 'canonical_body')
    assert.equal(focusedReaderResultAdmitted(target.result), true)
    focusedA013Cases.push('GSP-A013-002')
    assert.equal(
      authCase.ports.canonical_records.every((entry) =>
        focusedReaderResultAdmitted(entry.result)),
      true,
    )
    focusedA013Cases.push('GSP-A013-003')
    assert.deepEqual(authCase.ports.fault, {
      kind: 'canonical_read_throw',
      target_ordinal: 'A0',
      safe_error_id: 'deterministic_test_error',
    })
    focusedA013Cases.push('GSP-A013-004')
    const execution = focusedPublicResults.get('GSP-S6-ROLE-AUTH-012')
    assert.deepEqual(focusedResultTuple(execution.result), {
      result_kind: 'stopped',
      stage: 'S6',
      stop_code: 'canonical_evidence_invalid',
      diagnostic_path: '/role_authority_set/records/0',
    })
    assert.equal(JSON.stringify(execution.result).includes('deterministic_test_error'), false)
    focusedA013Cases.push('GSP-A013-005')
    assert.deepEqual(execution.vector, [1, 0, 0, 0, 0, 0, 0])
    focusedA013Cases.push('GSP-A013-006')
    assert.equal(
      shaJcs(authCase),
      'sha256:857a334fc8e1ecb305e8761707d70620ea2d78b26c726094e02b27f6af6bbf12',
    )
    focusedA013Cases.push('GSP-A013-007')
    assert.equal(
      shaJcs(focusedCurrentCorpus),
      'sha256:7a6fc92e95f4fb8e18381a7b173a78d1835b7a18ff1dfa8727bdcdc0e3ddba73',
    )
    focusedA013Cases.push('GSP-A013-008')
  }
  assert.equal(focusedA013Cases.length, 8)

  const cumulativeCases = []
  const additiveSemanticFixture = (
    profileId,
    evidenceIndex,
    projectionRow,
    projectionValue,
    semantics,
  ) => {
    const input = buildFocusedProfileInput(profileId)
    input.projection_authorization.projection[projectionRow].value = projectionValue
    input.projection_authorization.projection[projectionRow].evidence_urls = [
      focusedEvidenceUrls[evidenceIndex],
    ]
    input.projection_authorization.projection_sha256 =
      shaJcs(input.projection_authorization.projection)
    const key = api.buildGateStatusPublicationKeyV1(input)
    input.prior_attempt_authorities.publication_key = key
    const ports = expandFocusedPorts(
      profileId,
      input,
      { kind: 'nonatomic_baseline' },
    )
    const entry = ports.canonical_records.find((candidate) =>
      candidate.ordinal === `E${evidenceIndex}`)
    assert.ok(entry)
    const binding = clone(entry.result.content)
    const body_utf8 =
      `# Additive direct semantic evidence\n\n\`\`\`yaml\n${
        JSON.stringify({
          gate_status_evidence_binding: binding,
          gate_status_evidence_semantics: semantics,
        }, null, 2)
      }\n\`\`\`\n`
    entry.result.body_utf8 = body_utf8
    entry.result.fetched_content_sha256 = shaText(body_utf8)
    const record = input.evidence_records.find((candidate) =>
      candidate.canonical_url === entry.canonical_url)
    record.fetched_content_sha256 = entry.result.fetched_content_sha256
    return { input, ports }
  }
  const validationSemantics = (
    evidenceIndex,
    validationKind,
    result = 'PASS',
    count = result === 'PASS' ? 0 : 1,
  ) => ({
    contract_version: 'gate-status-direct-evidence-semantics-v1',
    semantic_branch: 'validation_result',
    evidence_kind: focusedEvidenceSpecs[evidenceIndex].evidence_kind,
    canonical_url: focusedEvidenceUrls[evidenceIndex],
    task_id: focused.task_id,
    repository: focused.repository,
    head_binding: { state: 'current', head: focused.head },
    validation_kind: validationKind,
    validated_head: focused.head,
    result,
    blocking_finding_count: count,
  })
  for (const [id, profileId, evidenceIndex, rowName, validationKind] of [
    ['GSP-A016-014', 'FINAL', 3, 'final_regression', 'final_regression'],
    ['GSP-A018-OV-001', 'OPERATIONAL', 4, 'operational_validation', 'operational_validation'],
  ]) {
    const fixture = additiveSemanticFixture(
      profileId,
      evidenceIndex,
      rowName,
      'completed',
      validationSemantics(evidenceIndex, validationKind),
    )
    const harness = makeFocusedPublicHarness({ ...fixture, input: fixture.input })
    const result = await api.publishGateStatusV1(
      focusedDeepFreeze(clone(fixture.input)),
      harness.ports,
    )
    assert.deepEqual(focusedResultTuple(result), focusedLaterTuple, id)
    assert.deepEqual(focusedVector(harness.counts), [2, 3, 1, 0, 0, 0, 0], id)
    cumulativeCases.push(id)
  }
  for (const [id, evidenceIndex, rowName, validationKind] of [
    ['GSP-A018-FR-BLOCKED', 3, 'final_regression', 'final_regression'],
    ['GSP-A018-OV-BLOCKED', 4, 'operational_validation', 'operational_validation'],
  ]) {
    const profileId = evidenceIndex === 3 ? 'FINAL' : 'OPERATIONAL'
    const fixture = additiveSemanticFixture(
      profileId,
      evidenceIndex,
      rowName,
      'blocked',
      validationSemantics(evidenceIndex, validationKind, 'BLOCKED', 1),
    )
    const harness = makeFocusedPublicHarness({ ...fixture, input: fixture.input })
    const result = await api.publishGateStatusV1(clone(fixture.input), harness.ports)
    assert.deepEqual(focusedResultTuple(result), focusedLaterTuple, id)
    cumulativeCases.push(id)
  }
  for (const [id, mutate, expectedPath] of [
    [
      'GSP-A018-REJECT-COMPLETION-ALIAS',
      (semantic) => { semantic.evidence_kind = 'final_regression_completion' },
      '/gate_status_evidence_semantics/evidence_kind',
    ],
    [
      'GSP-A018-REJECT-CROSS-VALIDATION',
      (semantic) => { semantic.validation_kind = 'operational_validation' },
      '/gate_status_evidence_semantics/validation_kind',
    ],
    [
      'GSP-A018-REJECT-FALSE-PASS',
      (semantic) => { semantic.blocking_finding_count = 1 },
      '/gate_status_evidence_semantics/blocking_finding_count',
    ],
  ]) {
    const semantic = validationSemantics(3, 'final_regression')
    mutate(semantic)
    const fixture = additiveSemanticFixture(
      'FINAL',
      3,
      'final_regression',
      'completed',
      semantic,
    )
    const harness = makeFocusedPublicHarness({ ...fixture, input: fixture.input })
    const result = await api.publishGateStatusV1(clone(fixture.input), harness.ports)
    assert.equal(result.kind, 'stopped', id)
    assert.equal(result.branch.stopped.failed_stage, 'S6_evidence_admission', id)
    assert.ok(result.diagnostics[0].path.endsWith(expectedPath), id)
    assert.equal(harness.counts.pr_read, 0, id)
    cumulativeCases.push(id)
  }
  {
    const fixture = additiveSemanticFixture(
      'FINAL',
      3,
      'final_regression',
      'blocked',
      validationSemantics(3, 'final_regression'),
    )
    const harness = makeFocusedPublicHarness({ ...fixture, input: fixture.input })
    const result = await api.publishGateStatusV1(clone(fixture.input), harness.ports)
    assert.equal(result.branch.stopped.stop_code, 'authority_projection_conflict')
    assert.equal(result.branch.stopped.failed_stage, 'S7_stop_consistency')
    cumulativeCases.push('GSP-A018-S7-SEMANTIC-MISMATCH')
  }
  {
    const fixture = additiveSemanticFixture(
      'FINAL',
      3,
      'final_regression',
      'completed',
      validationSemantics(3, 'final_regression'),
    )
    const entry = fixture.ports.canonical_records.find((candidate) =>
      candidate.ordinal === 'E3')
    entry.result.body_utf8 = `${entry.result.body_utf8} `
    const harness = makeFocusedPublicHarness({ ...fixture, input: fixture.input })
    const result = await api.publishGateStatusV1(clone(fixture.input), harness.ports)
    assert.equal(result.branch.stopped.stop_code, 'canonical_evidence_invalid')
    assert.equal(harness.counts.pr_read, 0)
    cumulativeCases.push('GSP-A017-RAW-BODY-TAMPER')
  }
  {
    const indeterminateFixture = make({ atomic: true })
    const indeterminateAdmission =
      api.validateGateStatusPublicationInputV1(clone(indeterminateFixture.input))
    assert.equal(indeterminateAdmission.accepted, true, JSON.stringify(indeterminateAdmission))
    assert.ok(api.buildGateStatusPublicationKeyV1(indeterminateAdmission.value))
    const indeterminateHarness = makePorts(
      indeterminateFixture,
      { cas: 'indeterminate' },
    )
    const postHarnessAdmission =
      api.validateGateStatusPublicationInputV1(clone(indeterminateFixture.input))
    assert.equal(postHarnessAdmission.accepted, true, JSON.stringify(postHarnessAdmission))
    const appliedResult = await api.publishGateStatusV1(
      clone(indeterminateFixture.input),
      indeterminateHarness.ports,
    )
    assert.equal(api.validateGateStatusPublicationResultV1(appliedResult).accepted, true)
    const applied = { result: appliedResult, ...indeterminateHarness }
    assert.equal(applied.result.kind, 'applied', JSON.stringify(applied.result))
    assert.equal(
      applied.result.write_state.confirmation,
      'reconciled_after_indeterminate',
    )
    assert.equal(applied.counts.cas, 1)
    assert.equal(applied.counts.retry_write, 0)
    const unknown = await execute(make({ atomic: true }), {
      cas: 'indeterminate',
      postRevision: 'unchanged',
    })
    assert.equal(
      unknown.result.branch.reconciliation_required.reconciliation_code,
      'write_outcome_unknown',
    )
    assert.equal(unknown.counts.receipt, 0)
    cumulativeCases.push('GSP-A015-013', 'GSP-A015-014')
  }
  {
    const exact = make({ atomic: true })
    const first = await execute(exact, { cas: 'indeterminate' })
    const second = await execute(exact, { cas: 'indeterminate' })
    assert.equal(canonicalize(first.result), canonicalize(second.result))
    assert.deepEqual(first.counts, second.counts)
    cumulativeCases.push('GSP-A015-020')
  }
  assert.equal(new Set(cumulativeCases).size, cumulativeCases.length)

  const amendment020Cases = []
  const synchronizeAmendment020Input = (input) => {
    input.evaluator.result_sha256 = shaJcs(input.evaluator.result)
    input.projection_authorization.evaluator_result_sha256 =
      input.evaluator.result_sha256
    input.projection_authorization.projection_sha256 =
      shaJcs(input.projection_authorization.projection)
    input.prior_attempt_authorities.publication_key =
      api.buildGateStatusPublicationKeyV1(input)
    assert.ok(input.prior_attempt_authorities.publication_key)
    return input
  }
  const runAmendment020 = async (
    profileId,
    input = buildFocusedProfileInput(profileId),
    ports = null,
  ) => {
    synchronizeAmendment020Input(input)
    const expandedPorts = ports ?? expandFocusedPorts(
      profileId,
      input,
      focusedNonAtomicPlan,
    )
    const harness = makeFocusedPublicHarness({
      input,
      ports: expandedPorts,
    })
    const frozenInput = focusedDeepFreeze(clone(input))
    const result = await api.publishGateStatusV1(frozenInput, harness.ports)
    assert.equal(api.validateGateStatusPublicationResultV1(result).accepted, true)
    return {
      result,
      tuple: focusedResultTuple(result),
      vector: focusedVector(harness.counts),
      counts: harness.counts,
    }
  }
  {
    for (const rowId of [
      'GSP-S6-ROLE-AUTH-001',
      'GSP-S6-ROLE-AUTH-002',
      'GSP-S6-ROLE-AUTH-003',
      'GSP-S6-ROLE-AUTH-004',
    ]) {
      const row = focusedRows.find((candidate) => candidate.row_id === rowId)
      const execution = focusedPublicResults.get(rowId)
      assert.ok(row)
      assert.ok(execution)
      assert.equal(shaJcs(expandFocusedCase(row)), focusedCaseDigests[rowId])
      assert.deepEqual(focusedResultTuple(execution.result), focusedLaterTuple)
      assert.deepEqual(execution.vector, row.call_vector)
    }
    amendment020Cases.push('GSP-A020-001')
  }
  {
    assert.equal(focusedRows.length, 56)
    assert.equal(focusedPublicResults.size, 56)
    for (const row of focusedRows) {
      const execution = focusedPublicResults.get(row.row_id)
      assert.ok(execution)
      assert.deepEqual(execution.vector, row.call_vector, row.row_id)
    }
    assert.equal(
      shaJcs(focusedCurrentCorpus),
      'sha256:7a6fc92e95f4fb8e18381a7b173a78d1835b7a18ff1dfa8727bdcdc0e3ddba73',
    )
    amendment020Cases.push('GSP-A020-002')
  }
  {
    const passive = await runAmendment020('TASK')
    assert.deepEqual(passive.tuple, focusedLaterTuple)
    assert.deepEqual(passive.vector, [1, 2, 1, 0, 0, 0, 0])
    assert.equal(passive.counts.other_canonical_read, 0)
    amendment020Cases.push('GSP-A020-003')
    assert.equal(
      buildFocusedProfileInput('TASK')
        .projection_authorization.projection.current_blocker_next_gate
        .evidence_urls[0],
      focusedEvidenceUrls[2],
    )
    assert.deepEqual(passive.vector, [1, 2, 1, 0, 0, 0, 0])
    amendment020Cases.push('GSP-A020-004')
  }
  {
    const input = buildFocusedProfileInput('TASK')
    input.projection_authorization.projection.current_head.evidence_urls = [
      focusedEvidenceUrls[3],
    ]
    const execution = await runAmendment020('TASK', input)
    assert.equal(execution.result.branch.stopped.stop_code, 'authority_projection_conflict')
    assert.equal(
      execution.result.diagnostics[0].path,
      '/projection_authorization/projection/current_head/evidence_urls/0',
    )
    assert.deepEqual(execution.vector, [1, 2, 0, 0, 0, 0, 0])
    amendment020Cases.push('GSP-A020-005')
  }
  {
    const input = buildFocusedProfileInput('TASK')
    input.projection_authorization.projection.final_regression.value = 'completed'
    const execution = await runAmendment020('TASK', input)
    assert.equal(execution.result.branch.stopped.stop_code, 'authority_projection_conflict')
    assert.equal(
      execution.result.diagnostics[0].path,
      '/projection_authorization/projection/final_regression/evidence_urls/0',
    )
    assert.equal(execution.counts.pr_read, 0)
    amendment020Cases.push('GSP-A020-006')
  }
  {
    const input = buildFocusedProfileInput('TASK')
    input.projection_authorization.projection.ready.value = 'completed'
    const execution = await runAmendment020('TASK', input)
    assert.equal(
      execution.result.diagnostics[0].path,
      '/projection_authorization/projection/ready/evidence_urls/0',
    )
    assert.equal(execution.counts.pr_read, 0)
    amendment020Cases.push('GSP-A020-007')
  }
  {
    const input = buildFocusedProfileInput('TASK')
    for (const requirement of [
      input.evaluator.result.gate_status_requirement,
      input.evaluator.result.requirement,
    ]) {
      requirement.current_blocker = 'architecture_review'
      requirement.next_gate_owner = 'architect_team'
    }
    input.projection_authorization.projection.current_blocker_next_gate = {
      blocker_id: 'architecture_review',
      next_action: 'architecture_review',
      next_owner: 'architect_team',
      evidence_urls: [focusedEvidenceUrls[2]],
    }
    const execution = await runAmendment020('TASK', input)
    assert.equal(
      execution.result.diagnostics[0].path,
      '/projection_authorization/projection/current_blocker_next_gate/evidence_urls/0',
    )
    assert.equal(execution.counts.pr_read, 0)
    amendment020Cases.push('GSP-A020-008')
  }
  {
    const input = buildFocusedProfileInput('TASK')
    input.projection_authorization.projection.historical_evidence = [{
      head: focused.base,
      value: 'historical_at_prior_head',
      evidence_url: focusedEvidenceUrls[3],
    }]
    const execution = await runAmendment020('TASK', input)
    assert.equal(
      execution.result.diagnostics[0].path,
      '/projection_authorization/projection/historical_evidence/0/evidence_url',
    )
    amendment020Cases.push('GSP-A020-009')
  }
  {
    const input = buildFocusedProfileInput('REVIEW')
    input.projection_authorization.projection.final_regression = {
      value: 'completed',
      evidence_urls: [focusedEvidenceUrls[2]],
      next_action: null,
      next_owner: null,
    }
    const execution = await runAmendment020('REVIEW', input)
    assert.equal(
      execution.result.diagnostics[0].path,
      '/projection_authorization/projection/final_regression/evidence_urls/0',
    )
    amendment020Cases.push('GSP-A020-010')
  }
  {
    const fixture = additiveSemanticFixture(
      'FINAL',
      3,
      'operational_validation',
      'completed',
      validationSemantics(3, 'final_regression'),
    )
    const execution = await runAmendment020('FINAL', fixture.input, fixture.ports)
    assert.equal(
      execution.result.diagnostics[0].path,
      '/projection_authorization/projection/operational_validation/evidence_urls/0',
    )
    amendment020Cases.push('GSP-A020-011')
  }
  {
    const fixture = additiveSemanticFixture(
      'FINAL',
      3,
      'final_regression',
      'completed',
      validationSemantics(3, 'final_regression'),
    )
    const target = fixture.ports.canonical_records.find((candidate) =>
      candidate.ordinal === 'E3')
    target.result.body_utf8 = `${target.result.body_utf8} `
    const execution = await runAmendment020('FINAL', fixture.input, fixture.ports)
    assert.equal(execution.result.branch.stopped.stop_code, 'canonical_evidence_invalid')
    assert.equal(execution.counts.pr_read, 0)
    assert.equal(execution.counts.evidence_read, 2)
    amendment020Cases.push('GSP-A020-012')
  }
  {
    const currentInput = buildFocusedProfileInput('TASK')
    currentInput.projection_authorization.projection.historical_evidence = [{
      head: focused.base,
      value: 'historical_at_prior_head',
      evidence_url: focusedEvidenceUrls[7],
    }]
    const currentAsHistorical = await runAmendment020('TASK', currentInput)
    assert.equal(
      currentAsHistorical.result.diagnostics[0].path,
      '/projection_authorization/projection/historical_evidence/0/evidence_url',
    )

    const historicalInput = buildFocusedProfileInput('FINAL')
    historicalInput.projection_authorization.projection.final_regression.value = 'completed'
    const historicalPorts = expandFocusedPorts(
      'FINAL',
      historicalInput,
      focusedNonAtomicPlan,
    )
    const historicalEntry = historicalPorts.canonical_records.find((candidate) =>
      candidate.ordinal === 'E3')
    const historicalAuthority = historicalPorts.canonical_records.find((candidate) =>
      candidate.ordinal === 'A2')
    historicalInput.evidence_records.find((candidate) =>
      candidate.canonical_url === focusedEvidenceUrls[3]).head_binding = {
      state: 'historical',
      head: focused.base,
    }
    historicalInput.role_authority_set.records.find((candidate) =>
      candidate.canonical_url === focusedAuthorityUrls[2]).scope.validated_head =
        focused.base
    applyFocusedSourceOperation(historicalEntry, {
      kind: 'replace_fetched_binding',
      pointer: '/head_binding',
      value: { state: 'historical', head: focused.base },
      recompute: 'body_and_both_digests',
    })
    synchronizeFocusedClaim(
      historicalInput,
      historicalEntry,
      'synchronize_both_digests',
    )
    applyFocusedSourceOperation(historicalAuthority, {
      kind: 'replace_fetched_binding',
      pointer: '/scope/validated_head',
      value: focused.base,
      recompute: 'body_and_both_digests',
    })
    synchronizeFocusedClaim(
      historicalInput,
      historicalAuthority,
      'synchronize_both_digests',
    )
    const historicalAsCurrent = await runAmendment020(
      'FINAL',
      historicalInput,
      historicalPorts,
    )
    assert.equal(
      historicalAsCurrent.result.diagnostics[0].path,
      '/projection_authorization/projection/final_regression/evidence_urls/0',
    )
    amendment020Cases.push('GSP-A020-013')
  }
  {
    const missing = buildFocusedProfileInput('FINAL')
    missing.evidence_records = missing.evidence_records.filter((candidate) =>
      candidate.canonical_url !== focusedEvidenceUrls[3])
    missing.role_authority_set.records =
      missing.role_authority_set.records.filter((candidate) =>
        candidate.canonical_url !== focusedAuthorityUrls[2])
    const missingResult = await runAmendment020('FINAL', missing)
    assert.equal(missingResult.result.branch.stopped.stop_code, 'canonical_evidence_invalid')
    assert.equal(missingResult.result.diagnostics[0].path, '/evidence_records')
    assert.deepEqual(missingResult.vector, [0, 0, 0, 0, 0, 0, 0])

    const extra = buildFocusedProfileInput('TASK')
    extra.evidence_records.push(clone(focusedEvidence[5].record))
    extra.evidence_records.sort((left, right) =>
      Buffer.from(left.canonical_url).compare(Buffer.from(right.canonical_url)))
    const extraResult = await runAmendment020('TASK', extra)
    assert.equal(extraResult.result.branch.stopped.stop_code, 'canonical_evidence_invalid')
    assert.equal(extraResult.result.diagnostics[0].path, '/evidence_records')
    assert.deepEqual(extraResult.vector, [0, 0, 0, 0, 0, 0, 0])
    amendment020Cases.push('GSP-A020-014')
  }
  {
    for (const [rowName, value] of [
      ['final_regression', 'completed'],
      ['ready', 'blocked'],
    ]) {
      const input = buildFocusedProfileInput('TASK')
      input.projection_authorization.projection[rowName].value = value
      const execution = await runAmendment020('TASK', input)
      assert.equal(execution.result.branch.stopped.stop_code, 'authority_projection_conflict')
      assert.equal(execution.counts.pr_read, 0)
    }
    amendment020Cases.push('GSP-A020-015')
  }
  {
    const passiveUrl =
      'https://github.com/whatrune/sd-prompt-studio/issues/206#issuecomment-5096999999'
    const passiveInput = buildFocusedProfileInput('TASK')
    passiveInput.projection_authorization.projection.final_regression.evidence_urls = [
      passiveUrl,
    ]
    const passive = await runAmendment020('TASK', passiveInput)
    assert.deepEqual(passive.tuple, focusedLaterTuple)
    const assertedInput = buildFocusedProfileInput('TASK')
    assertedInput.projection_authorization.projection.final_regression = {
      value: 'completed',
      evidence_urls: [passiveUrl],
      next_action: null,
      next_owner: null,
    }
    const asserted = await runAmendment020('TASK', assertedInput)
    assert.equal(asserted.result.branch.stopped.stop_code, 'authority_projection_conflict')
    assert.equal(asserted.counts.pr_read, 0)
    amendment020Cases.push('GSP-A020-016')
  }
  {
    const noAuthority = buildFocusedProfileInput('TASK')
    for (const requirement of [
      noAuthority.evaluator.result.gate_status_requirement,
      noAuthority.evaluator.result.requirement,
    ]) {
      requirement.citation_urls = [...requirement.citation_urls, focusedEvidenceUrls[2]]
        .sort((left, right) => Buffer.from(left).compare(Buffer.from(right)))
    }
    noAuthority.evidence_records.push(clone(focusedEvidence[2].record))
    noAuthority.evidence_records.sort((left, right) =>
      Buffer.from(left.canonical_url).compare(Buffer.from(right.canonical_url)))
    const noAuthorityResult = await runAmendment020('TASK', noAuthority)
    assert.equal(noAuthorityResult.result.branch.stopped.failed_stage, 'S1_structural_admission')
    assert.equal(noAuthorityResult.counts.authority_read, 0)

    const wrongRow = clone(noAuthority)
    wrongRow.role_authority_set.records.push(clone(focusedAuthorities[1].record))
    wrongRow.role_authority_set.records.sort((left, right) =>
      Buffer.from(left.canonical_url).compare(Buffer.from(right.canonical_url)))
    wrongRow.projection_authorization.projection.final_regression = {
      value: 'completed',
      evidence_urls: [focusedEvidenceUrls[2]],
      next_action: null,
      next_owner: null,
    }
    const wrongRowResult = await runAmendment020('REVIEW', wrongRow)
    assert.equal(wrongRowResult.result.branch.stopped.stop_code, 'authority_projection_conflict')
    assert.equal(
      wrongRowResult.result.diagnostics[0].path,
      '/projection_authorization/projection/final_regression/evidence_urls/0',
    )
    amendment020Cases.push('GSP-A020-017')
  }
  {
    const input = buildFocusedProfileInput('TASK')
    const first = await runAmendment020('TASK', clone(input))
    const second = await runAmendment020('TASK', clone(input))
    assert.equal(canonicalize(first.result), canonicalize(second.result))
    assert.deepEqual(first.vector, second.vector)
    assert.equal(canonicalize(input), canonicalize(buildFocusedProfileInput('TASK')))
    amendment020Cases.push('GSP-A020-018')
  }
  assert.deepEqual(
    amendment020Cases,
    Array.from(
      { length: 18 },
      (_, index) => `GSP-A020-${String(index + 1).padStart(3, '0')}`,
    ),
  )

  assert.deepEqual(evidence, Array.from({ length: 36 }, (_, index) => `GSP-${String(index + 1).padStart(3, '0')}`))
  const summary = {
    contract: 'Gate Status Publisher V1',
    rows: evidence.length,
    first_row: evidence[0],
    last_row: evidence.at(-1),
    public_producer: true,
    deterministic: true,
    evidence_cutover_cases: evidenceCutoverRows.length,
    s6_branch_bound_cases: s6BranchRows.length,
    s6_cross_branch_cases: s6CrossRows.length,
    result_validator_cases: resultValidatorCases.length,
    normative_public_cases: focusedPublicRows.length,
    corpus_admission_cases: focusedCorpusAdmissionCases.length,
    canonical_throw_cases: focusedA013Cases.length + 2,
    cumulative_amendment_cases: cumulativeCases.length,
    amendment_020_cases: amendment020Cases.length,
    result: 'PASS',
  }
  console.log(JSON.stringify(summary))
} finally {
  await server.close()
}
