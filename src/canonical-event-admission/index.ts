export const CANONICAL_EVENT_ADMISSION_OUTCOME_V1 = 'canonical-event-admission-outcome-v1' as const

type Json = unknown
type PortResult<T> = Readonly<{ kind: 'ok'; value: T } | { kind: 'failed'; safe_code: 'port_operation_failed' }>
type LedgerResult = Readonly<
  | { contract_version?: string; kind: 'committed'; decision: 'current' | 'historical'; generation: number | null; generation_key: string | null; prior_watermark_revision_timestamp: string | null; prior_watermark_event_id: string | null }
  | { kind: 'duplicate'; code: 'duplicate_delivery'; existing_event_id: string }
  | { kind: 'conflict'; code: 'delivery_identity_conflict' | 'event_identity_payload_conflict' }
  | { kind: 'failed'; code: 'ledger_read_failure' | 'ledger_write_failure' | 'ordering_invariant_failure'; retryable: boolean }
>
export type CanonicalEventAdmissionPortsV1 = Readonly<{
  canonicalize_jcs: (value: Json) => PortResult<Uint8Array>
  sha256: (value: Uint8Array) => PortResult<string>
  ledger_transact: (value: Json) => Promise<LedgerResult>
}>
type Rejection = Readonly<{ code: string; stage: string; path: string; message: string }>
type Failure = Readonly<{ code: string; stage: string; diagnostic_id: string; safe_message: string; retryable: boolean }>
export type CanonicalEventAdmissionOutcomeV1 =
  | Readonly<{ contract_version: typeof CANONICAL_EVENT_ADMISSION_OUTCOME_V1; kind: 'accepted'; evaluated_at: string; delivery_id: string; raw_payload_sha256: string; envelope: Json; evaluator_trigger: 'required' | 'suppressed' }>
  | Readonly<{ contract_version: typeof CANONICAL_EVENT_ADMISSION_OUTCOME_V1; kind: 'rejected'; evaluated_at: string; delivery_id: string | null; raw_payload_sha256: string | null; rejection: Rejection; existing_event_id: string | null; retryable: false }>
  | Readonly<{ contract_version: typeof CANONICAL_EVENT_ADMISSION_OUTCOME_V1; kind: 'failed'; evaluated_at: string | null; delivery_id: string | null; raw_payload_sha256: string | null; failure: Failure }>

type Obj = Record<string, unknown>
type EventDescriptor = Readonly<{
  eventName: string
  action: string | null
  eventType: string
  rank: number
  sourceKind: string
  sourceKey: string | null
  parentKey: string | null
  normalizedKind: 'canonical_record_trigger' | 'pr_snapshot_trigger' | 'ci_snapshot_trigger'
}>

const EVENT_DESCRIPTORS: readonly EventDescriptor[] = [
  ['issues', 'opened', 'issue.opened', 100, 'issue', 'issue', null, 'canonical_record_trigger'],
  ['issues', 'edited', 'issue.edited', 101, 'issue', 'issue', null, 'canonical_record_trigger'],
  ['issues', 'closed', 'issue.closed', 102, 'issue', 'issue', null, 'canonical_record_trigger'],
  ['issues', 'reopened', 'issue.reopened', 103, 'issue', 'issue', null, 'canonical_record_trigger'],
  ['issues', 'labeled', 'issue.labeled', 104, 'issue', 'issue', null, 'canonical_record_trigger'],
  ['issues', 'unlabeled', 'issue.unlabeled', 105, 'issue', 'issue', null, 'canonical_record_trigger'],
  ['issue_comment', 'created', 'issue_comment.created', 110, 'issue_comment', 'comment', 'issue', 'canonical_record_trigger'],
  ['issue_comment', 'edited', 'issue_comment.edited', 111, 'issue_comment', 'comment', 'issue', 'canonical_record_trigger'],
  ['issue_comment', 'deleted', 'issue_comment.deleted', 112, 'issue_comment', 'comment', 'issue', 'canonical_record_trigger'],
  ['pull_request', 'opened', 'pull_request.opened', 200, 'pull_request', 'pull_request', null, 'pr_snapshot_trigger'],
  ['pull_request', 'edited', 'pull_request.edited', 201, 'pull_request', 'pull_request', null, 'pr_snapshot_trigger'],
  ['pull_request', 'synchronize', 'pull_request.synchronize', 202, 'pull_request', 'pull_request', null, 'pr_snapshot_trigger'],
  ['pull_request', 'reopened', 'pull_request.reopened', 203, 'pull_request', 'pull_request', null, 'pr_snapshot_trigger'],
  ['pull_request', 'closed', 'pull_request.closed', 204, 'pull_request', 'pull_request', null, 'pr_snapshot_trigger'],
  ['pull_request', 'ready_for_review', 'pull_request.ready_for_review', 205, 'pull_request', 'pull_request', null, 'pr_snapshot_trigger'],
  ['pull_request', 'converted_to_draft', 'pull_request.converted_to_draft', 206, 'pull_request', 'pull_request', null, 'pr_snapshot_trigger'],
  ['pull_request_review', 'submitted', 'pull_request_review.submitted', 210, 'pull_request_review', 'review', 'pull_request', 'canonical_record_trigger'],
  ['pull_request_review', 'edited', 'pull_request_review.edited', 211, 'pull_request_review', 'review', 'pull_request', 'canonical_record_trigger'],
  ['pull_request_review', 'dismissed', 'pull_request_review.dismissed', 212, 'pull_request_review', 'review', 'pull_request', 'canonical_record_trigger'],
  ['pull_request_review_comment', 'created', 'pull_request_review_comment.created', 220, 'pull_request_review_comment', 'comment', 'pull_request', 'canonical_record_trigger'],
  ['pull_request_review_comment', 'edited', 'pull_request_review_comment.edited', 221, 'pull_request_review_comment', 'comment', 'pull_request', 'canonical_record_trigger'],
  ['pull_request_review_comment', 'deleted', 'pull_request_review_comment.deleted', 222, 'pull_request_review_comment', 'comment', 'pull_request', 'canonical_record_trigger'],
  ['check_run', 'created', 'check_run.created', 300, 'check_run', 'check_run', null, 'ci_snapshot_trigger'],
  ['check_run', 'rerequested', 'check_run.rerequested', 301, 'check_run', 'check_run', null, 'ci_snapshot_trigger'],
  ['check_run', 'completed', 'check_run.completed', 302, 'check_run', 'check_run', null, 'ci_snapshot_trigger'],
  ['status', null, 'status.updated', 310, 'commit_status', null, null, 'ci_snapshot_trigger'],
].map(([eventName, action, eventType, rank, sourceKind, sourceKey, parentKey, normalizedKind]) => ({
  eventName: eventName as string,
  action: action as string | null,
  eventType: eventType as string,
  rank: rank as number,
  sourceKind: sourceKind as string,
  sourceKey: sourceKey as string | null,
  parentKey: parentKey as string | null,
  normalizedKind: normalizedKind as EventDescriptor['normalizedKind'],
}))

const freeze = <T>(input: T): Readonly<T> => {
  if (input !== null && typeof input === 'object' && !Object.isFrozen(input)) {
    for (const value of Object.values(input as Obj)) freeze(value)
    Object.freeze(input)
  }
  return input as Readonly<T>
}
const clone = <T>(value: T): T => structuredClone(value)
const isObject = (value: unknown): value is Obj => value !== null && typeof value === 'object' && !Array.isArray(value)
const has = (value: Obj, key: string): boolean => Object.prototype.hasOwnProperty.call(value, key)
const validString = (value: unknown): value is string => typeof value === 'string'
const validNumber = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0
const terminalFailure = freeze({
  contract_version: CANONICAL_EVENT_ADMISSION_OUTCOME_V1,
  kind: 'failed',
  evaluated_at: null,
  delivery_id: null,
  raw_payload_sha256: null,
  failure: {
    code: 'terminal_outcome_failure',
    stage: 'bootstrap',
    diagnostic_id: `cea-failure-v1:${'0'.repeat(64)}`,
    safe_message: 'event admission failed before a normal outcome could be admitted',
    retryable: false,
  },
}) as CanonicalEventAdmissionOutcomeV1

const reject = (evaluatedAt: string, deliveryId: string | null, digest: string | null, code: string, stage: string, path: string, message: string): CanonicalEventAdmissionOutcomeV1 =>
  freeze({ contract_version: CANONICAL_EVENT_ADMISSION_OUTCOME_V1, kind: 'rejected', evaluated_at: evaluatedAt, delivery_id: deliveryId, raw_payload_sha256: digest, rejection: { code, stage, path, message }, existing_event_id: null, retryable: false as const })
const fail = (evaluatedAt: string | null, deliveryId: string | null, digest: string | null, code: string, stage: string, message: string, retryable: boolean): CanonicalEventAdmissionOutcomeV1 =>
  freeze({ contract_version: CANONICAL_EVENT_ADMISSION_OUTCOME_V1, kind: 'failed', evaluated_at: evaluatedAt, delivery_id: deliveryId, raw_payload_sha256: digest, failure: { code, stage, diagnostic_id: `cea-failure-v1:${'0'.repeat(64)}`, safe_message: message, retryable } })
const portBytes = (ports: CanonicalEventAdmissionPortsV1, value: Json): Uint8Array => {
  const result = ports.canonicalize_jcs(clone(value))
  if (!isObject(result) || result.kind !== 'ok' || !(result.value instanceof Uint8Array)) throw new Error('canonicalize')
  return result.value
}
const portSha = (ports: CanonicalEventAdmissionPortsV1, value: Uint8Array): string => {
  const result = ports.sha256(new Uint8Array(value))
  if (!isObject(result) || result.kind !== 'ok' || typeof result.value !== 'string') throw new Error('sha256')
  return result.value
}
const shaJcs = (ports: CanonicalEventAdmissionPortsV1, value: Json): string => portSha(ports, portBytes(ports, value))
const utf8 = (value: string): Uint8Array => new TextEncoder().encode(value)
const decodeBase64 = (value: string): Uint8Array => {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) throw new Error('base64')
  const binary = atob(value)
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  if (btoa(binary) !== value) throw new Error('base64')
  return bytes
}
const pointerValue = (root: Obj, path: readonly string[]): unknown => path.reduce<unknown>((value, key) => isObject(value) ? value[key] : undefined, root)
const required = (payload: Obj, path: readonly string[], type: 'string' | 'number' | 'boolean' | 'nullable-string', evaluatedAt: string, deliveryId: string, digest: string): CanonicalEventAdmissionOutcomeV1 | null => {
  let current: unknown = payload
  for (const key of path) {
    if (!isObject(current) || !has(current, key)) return reject(evaluatedAt, deliveryId, digest, 'missing_required_field', 'source_identity', `/provider_payload/${path.join('/')}`, 'missing required field')
    current = current[key]
  }
  const ok = type === 'string' ? validString(current) : type === 'number' ? validNumber(current) : type === 'boolean' ? typeof current === 'boolean' : current === null || validString(current)
  return ok ? null : reject(evaluatedAt, deliveryId, digest, 'invalid_type', 'source_identity', `/provider_payload/${path.join('/')}`, 'invalid type')
}
const commonRequired: readonly [readonly string[], 'string' | 'number'][] = [
  [['repository', 'id'], 'number'], [['repository', 'node_id'], 'string'], [['repository', 'full_name'], 'string'], [['repository', 'html_url'], 'string'],
  [['sender', 'id'], 'number'], [['sender', 'node_id'], 'string'], [['sender', 'login'], 'string'], [['sender', 'type'], 'string'], [['sender', 'html_url'], 'string'],
]
const eventFields = (descriptor: EventDescriptor): readonly [readonly string[], 'string' | 'number' | 'boolean' | 'nullable-string'][] => {
  if (descriptor.eventName === 'status') return [[['id'], 'number'], [['node_id'], 'string'], [['url'], 'string'], [['sha'], 'string'], [['state'], 'string'], [['context'], 'string'], [['updated_at'], 'string'], [['commit', 'html_url'], 'string'], [['commit', 'url'], 'string']]
  const source = descriptor.sourceKey as string
  const fields: [readonly string[], 'string' | 'number' | 'boolean' | 'nullable-string'][] = [
    [[source, 'id'], 'number'], [[source, 'node_id'], 'string'], [[source, 'html_url'], 'string'], [[source, 'url'], 'string'],
  ]
  if (descriptor.parentKey) fields.push([[descriptor.parentKey, 'id'], 'number'], [[descriptor.parentKey, 'node_id'], 'string'], [[descriptor.parentKey, 'html_url'], 'string'], [[descriptor.parentKey, 'url'], 'string'])
  if (descriptor.eventName === 'issues') {
    fields.push([['issue', descriptor.action === 'opened' ? 'created_at' : 'updated_at'], 'string'])
    if (descriptor.action === 'opened') fields.push([['issue', 'updated_at'], 'string'])
  }
  if (descriptor.eventName === 'issue_comment' || descriptor.eventName === 'pull_request_review_comment') {
    fields.push([[source, descriptor.action === 'created' ? 'created_at' : 'updated_at'], 'string'])
    if (descriptor.action === 'created') fields.push([[source, 'updated_at'], 'string'])
  }
  if (descriptor.eventName === 'pull_request_review') fields.push([['review', 'submitted_at'], 'string'])
  if (descriptor.eventName === 'pull_request') {
    fields.push([['pull_request', descriptor.action === 'opened' ? 'created_at' : 'updated_at'], 'string'])
    if (descriptor.action === 'opened') fields.push([['pull_request', 'updated_at'], 'string'])
    fields.push([['pull_request', 'head', 'sha'], 'string'], [['pull_request', 'base', 'ref'], 'string'], [['pull_request', 'state'], 'string'], [['pull_request', 'draft'], 'boolean'])
    if (descriptor.action === 'synchronize') fields.push([['before'], 'string'], [['after'], 'string'])
  }
  if (descriptor.eventName === 'check_run') {
    fields.push([['check_run', 'name'], 'string'], [['check_run', 'head_sha'], 'string'], [['check_run', 'status'], 'string'], [['check_run', 'conclusion'], 'nullable-string'], [['check_run', descriptor.action === 'completed' ? 'completed_at' : 'started_at'], descriptor.action === 'completed' ? 'string' : 'nullable-string'])
  }
  return fields
}

export async function admitCanonicalGitHubEventV1(invocation: unknown, rawInput: unknown, ports: CanonicalEventAdmissionPortsV1): Promise<CanonicalEventAdmissionOutcomeV1> {
  let evaluatedAt: string | null = null
  let deliveryId: string | null = null
  let rawDigest: string | null = null
  try {
    if (!isObject(invocation) || invocation.contract_version !== 'canonical-event-admission-invocation-v1' || !isObject(invocation.clock) || !isObject(invocation.verification)) return fail(null, null, null, 'invocation_context_invalid', 'bootstrap', 'admission invocation context invalid', false)
    if (invocation.clock.state !== 'available' || typeof invocation.clock.admission_started_at !== 'string') return fail(null, null, null, 'admission_clock_unavailable', 'bootstrap', 'admission clock unavailable', true)
    evaluatedAt = invocation.clock.admission_started_at
    if (!isObject(rawInput)) return reject(evaluatedAt, null, null, 'invalid_type', 'structural', '', 'invalid type')
    for (const key of Object.keys(rawInput).sort()) if (!['contract_version', 'admission_profile', 'provider', 'repository', 'header_projection', 'raw_payload'].includes(key)) return reject(evaluatedAt, null, null, 'unknown_field', 'structural', `/${key}`, 'unknown field')
    for (const key of ['contract_version', 'admission_profile', 'provider', 'repository', 'header_projection', 'raw_payload']) if (!has(rawInput, key)) return reject(evaluatedAt, null, null, 'missing_required_field', 'structural', `/${key}`, 'missing required field')
    if (rawInput.contract_version !== 'canonical-event-raw-input-v1') return reject(evaluatedAt, null, null, 'unsupported_contract_version', 'structural', '/contract_version', 'unsupported contract version')
    if (rawInput.admission_profile !== 'sd-prompt-studio-github-admission-v1') return reject(evaluatedAt, null, null, 'unsupported_admission_profile', 'structural', '/admission_profile', 'unsupported admission profile')
    if (rawInput.provider !== 'github' || !isObject(rawInput.repository) || !isObject(rawInput.header_projection) || !isObject(rawInput.raw_payload)) return reject(evaluatedAt, null, null, 'invalid_type', 'structural', '/provider', 'invalid type')
    const header = rawInput.header_projection
    const raw = rawInput.raw_payload
    deliveryId = typeof header.delivery_id === 'string' ? header.delivery_id : null
    rawDigest = typeof raw.sha256 === 'string' ? raw.sha256 : null
    if (!deliveryId || typeof header.event_name !== 'string' || !(typeof header.action === 'string' || header.action === null) || !validNumber(header.hook_id) || typeof header.observed_at !== 'string' || typeof raw.body_base64 !== 'string' || !validNumber(raw.byte_length) || typeof raw.sha256 !== 'string' || raw.encoding !== 'base64' || raw.content_type !== 'application/json') return reject(evaluatedAt, deliveryId, rawDigest, 'invalid_type', 'structural', '/header_projection', 'invalid type')
    let bytes: Uint8Array
    try { bytes = decodeBase64(raw.body_base64) } catch { return reject(evaluatedAt, deliveryId, rawDigest, 'invalid_base64', 'binding', '/raw_payload/body_base64', 'invalid canonical base64') }
    if (bytes.byteLength !== raw.byte_length) return reject(evaluatedAt, deliveryId, rawDigest, 'raw_length_mismatch', 'binding', '/raw_payload/byte_length', 'raw payload length mismatch')
    const computedRawDigest = portSha(ports, bytes)
    if (computedRawDigest !== raw.sha256) return reject(evaluatedAt, deliveryId, rawDigest, 'raw_digest_mismatch', 'binding', '/raw_payload/sha256', 'raw payload digest mismatch')
    let payload: unknown
    try { payload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) } catch { return reject(evaluatedAt, deliveryId, rawDigest, 'json_parse_failed', 'binding', '/raw_payload/body_base64', 'raw payload is not valid JSON') }
    if (!isObject(payload)) return reject(evaluatedAt, deliveryId, rawDigest, 'invalid_type', 'binding', '/provider_payload', 'invalid type')
    const verification = invocation.verification
    if (verification.state === 'missing') return reject(evaluatedAt, deliveryId, rawDigest, 'signature_verification_missing', 'authenticity', '/invocation/verification', 'webhook verification evidence missing')
    if (verification.state === 'unverified') return reject(evaluatedAt, deliveryId, rawDigest, 'signature_unverified', 'authenticity', '/invocation/verification/state', 'webhook authenticity is not verified')
    if (verification.state === 'failed') return fail(evaluatedAt, deliveryId, rawDigest, 'verification_internal_failure', 'verification', 'webhook verification failed internally', true)
    if (verification.state !== 'verified' || !isObject(verification.evidence)) return reject(evaluatedAt, deliveryId, rawDigest, 'invalid_type', 'authenticity', '/invocation/verification', 'invalid type')
    const evidence = verification.evidence
    if (evidence.contract_version !== 'github-webhook-verification-evidence-v1' || evidence.method !== 'github_webhook_hmac_sha256' || evidence.verifier_id !== 'sd-prompt-studio-github-webhook-verifier' || evidence.verifier_version !== 'github-webhook-verifier-v1') return reject(evaluatedAt, deliveryId, rawDigest, 'unsupported_verifier', 'authenticity', '/invocation/verification/evidence/verifier_id', 'unsupported webhook verifier')
    if (evidence.delivery_id !== deliveryId || evidence.hook_id !== header.hook_id || evidence.raw_payload_sha256 !== raw.sha256 || evidence.raw_payload_byte_length !== raw.byte_length) return reject(evaluatedAt, deliveryId, rawDigest, 'verification_binding_mismatch', 'authenticity', '/invocation/verification/evidence', 'webhook verification evidence does not bind to raw input')
    if (header.event_name !== 'status') {
      if (!has(payload, 'action')) return reject(evaluatedAt, deliveryId, rawDigest, 'missing_required_field', 'event_mapping', '/provider_payload/action', 'missing required field')
      if (typeof payload.action !== 'string') return reject(evaluatedAt, deliveryId, rawDigest, 'invalid_type', 'event_mapping', '/provider_payload/action', 'invalid type')
    } else if (has(payload, 'action')) return reject(evaluatedAt, deliveryId, rawDigest, 'unsupported_event', 'event_mapping', '/provider_payload/action', 'unsupported GitHub event tuple')
    const descriptor = EVENT_DESCRIPTORS.find((item) => item.eventName === header.event_name && item.action === header.action && (item.action === null || payload.action === item.action))
    if (!descriptor) return reject(evaluatedAt, deliveryId, rawDigest, 'unsupported_event', 'event_mapping', header.event_name === 'status' ? '/provider_payload/action' : '/provider_payload/action', 'unsupported GitHub event tuple')
    for (const [path, type] of [...commonRequired, ...eventFields(descriptor)]) {
      const problem = required(payload, path, type, evaluatedAt, deliveryId, rawDigest as string)
      if (problem) return problem
    }
    const repository = payload.repository as Obj
    const sender = payload.sender as Obj
    if (!isObject(evidence.repository) || repository.id !== rawInput.repository.database_id || repository.node_id !== rawInput.repository.node_id || repository.full_name !== rawInput.repository.full_name || repository.html_url !== rawInput.repository.html_url) return reject(evaluatedAt, deliveryId, rawDigest, 'repository_mismatch', 'source_identity', '/provider_payload/repository/id', 'repository identity mismatch')
    if (sender.html_url !== `https://github.com/${sender.login}`) return reject(evaluatedAt, deliveryId, rawDigest, 'actor_identity_invalid', 'source_identity', '/provider_payload/sender/html_url', 'actor identity invalid')
    const source = descriptor.sourceKey === null ? payload : payload[descriptor.sourceKey] as Obj
    const parent = descriptor.parentKey ? payload[descriptor.parentKey] as Obj : null
    const sourceId = source.id as number
    const sourceObject = {
      kind: descriptor.sourceKind,
      database_id: sourceId,
      node_id: source.node_id as string,
      canonical_url: (descriptor.eventName === 'status' ? source.url : source.html_url) as string,
      parent_database_id: parent ? sourceId : null,
      parent_canonical_url: parent ? parent.html_url as string : null,
    }
    const actor = { provider: 'github', database_id: sender.id as number, node_id: sender.node_id as string, login: sender.login as string, actor_type: sender.type as string, canonical_url: sender.html_url as string }
    let occurredAt: string | null
    let revisionTimestamp: string
    let sourceRevision: Obj
    let normalizedPayload: Obj
    if (descriptor.eventName === 'pull_request') {
      occurredAt = source[descriptor.action === 'opened' ? 'created_at' : 'updated_at'] as string
      revisionTimestamp = source.updated_at as string
      sourceRevision = descriptor.action === 'synchronize'
        ? { kind: 'pr_head_transition', revision_timestamp: revisionTimestamp, before_head: payload.before as string, after_head: payload.after as string, required_equality: [payload.after as string, (source.head as Obj).sha as string] }
        : { kind: 'record_updated_at', revision_timestamp: revisionTimestamp }
      normalizedPayload = { kind: 'pr_snapshot_trigger', action: descriptor.action as string, pr_url: source.html_url as string, head_sha: (source.head as Obj).sha as string, base_ref: (source.base as Obj).ref as string, state: source.state as string, draft: source.draft as boolean, record_updated_at: revisionTimestamp }
    } else if (descriptor.eventName === 'check_run') {
      const timestampField = descriptor.action === 'completed' ? 'completed_at' : 'started_at'
      occurredAt = source[timestampField] as string | null
      revisionTimestamp = occurredAt ?? header.observed_at as string
      sourceRevision = descriptor.action === 'created'
        ? { kind: 'check_run_created', revision_token: 'created', head_sha: source.head_sha as string, provider_state: source.status as string }
        : descriptor.action === 'rerequested'
          ? { kind: 'webhook_occurrence', delivery_id: '/header_projection/delivery_id', head_sha: source.head_sha as string, provider_state: source.status as string }
          : { kind: 'ci_observation', revision_timestamp: revisionTimestamp, head_sha: source.head_sha as string, state: source.status as string, required_state_literal: 'completed' }
      normalizedPayload = { kind: 'ci_snapshot_trigger', ci_kind: 'check_run', action: descriptor.action as string, check_name: source.name as string, source_api_url: source.url as string, head_sha: source.head_sha as string, state: source.status as string, conclusion: source.conclusion as string | null, record_updated_at: occurredAt }
    } else if (descriptor.eventName === 'status') {
      occurredAt = payload.updated_at as string
      revisionTimestamp = occurredAt
      sourceRevision = { kind: 'ci_observation', revision_timestamp: revisionTimestamp, head_sha: payload.sha as string, state: payload.state as string }
      normalizedPayload = { kind: 'ci_snapshot_trigger', ci_kind: 'commit_status', action: 'updated', check_name: payload.context as string, source_api_url: payload.url as string, head_sha: payload.sha as string, state: payload.state as string, conclusion: null, record_updated_at: revisionTimestamp }
    } else {
      const opened = descriptor.action === 'opened' || descriptor.action === 'created'
      const timestampField = descriptor.eventName === 'pull_request_review' ? 'submitted_at' : opened ? 'created_at' : 'updated_at'
      occurredAt = source[timestampField] as string
      revisionTimestamp = (descriptor.eventName === 'pull_request_review' ? source.submitted_at : source.updated_at) as string
      sourceRevision = { kind: 'record_updated_at', revision_timestamp: revisionTimestamp }
      normalizedPayload = { kind: 'canonical_record_trigger', record_kind: descriptor.sourceKind, action: descriptor.action as string, record_url: source.html_url as string, parent_url: parent ? parent.html_url as string : null, record_updated_at: revisionTimestamp }
    }
    const immutableSourceRefs = ([source.url, descriptor.eventName === 'status' ? (payload.commit as Obj).html_url : source.html_url, ...(parent ? [parent.html_url, parent.url] : []), ...(descriptor.eventName === 'status' ? [(payload.commit as Obj).url] : [])] as string[]).sort()
    const canonicalSource = { kind: sourceObject.kind, database_id: sourceObject.database_id, node_id: sourceObject.node_id, parent_database_id: sourceObject.parent_database_id }
    const eventId = `github-event-v1:${shaJcs(ports, { contract_version: 'canonical-event-admission-v1', provider: 'github', repository: { database_id: repository.id as number, node_id: repository.node_id as string, full_name: repository.full_name as string }, event_type: descriptor.eventType, source_object: canonicalSource, source_revision: sourceRevision } as Json)}`
    const streamKey = `github-stream-v1:${shaJcs(ports, { provider: 'github', repository_database_id: repository.id as number, source_object_kind: sourceObject.kind, source_object_database_id: sourceObject.database_id, parent_database_id: sourceObject.parent_database_id } as Json)}`
    const normalizedDigest = shaJcs(ports, { event_type: descriptor.eventType, source_object: sourceObject, actor, occurred_at: occurredAt, source_revision: sourceRevision, immutable_source_refs: immutableSourceRefs, normalized_payload: normalizedPayload } as Json)
    const ledger = await ports.ledger_transact(freeze({ contract_version: 'canonical-event-ledger-transaction-request-v1', delivery_id: deliveryId, canonical_event_id: eventId, raw_payload_sha256: rawDigest, normalized_projection_sha256: normalizedDigest, stream_key: streamKey, revision_timestamp: revisionTimestamp, tie_break_key: [descriptor.rank, eventId] }) as Json)
    if (!isObject(ledger)) return fail(evaluatedAt, deliveryId, rawDigest, 'port_contract_invalid', 'ledger_write', 'event ledger returned an invalid result', false)
    if (ledger.kind === 'duplicate') {
      const outcome = reject(evaluatedAt, deliveryId, rawDigest, 'duplicate_delivery', 'duplicate_ordering', '/delivery/delivery_id', 'event delivery already admitted') as Extract<CanonicalEventAdmissionOutcomeV1, { kind: 'rejected' }>
      return freeze({ ...outcome, existing_event_id: ledger.existing_event_id as string })
    }
    if (ledger.kind === 'conflict') return reject(evaluatedAt, deliveryId, rawDigest, ledger.code as string, 'duplicate_ordering', ledger.code === 'delivery_identity_conflict' ? '/delivery/delivery_id' : '/canonical_event_id', ledger.code === 'delivery_identity_conflict' ? 'delivery identity is bound to different content' : 'event identity is bound to different content')
    if (ledger.kind === 'failed') return fail(evaluatedAt, deliveryId, rawDigest, ledger.code as string, ledger.code === 'ledger_read_failure' ? 'ledger_read' : ledger.code === 'ledger_write_failure' ? 'ledger_write' : 'ordering', 'event ledger operation failed', Boolean(ledger.retryable))
    if (ledger.kind !== 'committed' || !['current', 'historical'].includes(ledger.decision as string)) return fail(evaluatedAt, deliveryId, rawDigest, 'port_contract_invalid', 'ledger_write', 'event ledger returned an invalid result', false)
    const disposition = ledger.decision as 'current' | 'historical'
    const envelope = {
      contract_version: 'canonical-event-admission-v1', schema_version: 'canonical-event-envelope-v1', canonical_event_id: eventId, provider: 'github', admission_profile: 'sd-prompt-studio-github-admission-v1',
      repository: { database_id: repository.id as number, node_id: repository.node_id as string, full_name: repository.full_name as string, html_url: repository.html_url as string },
      event_type: descriptor.eventType, source_object: sourceObject, actor, occurred_at: occurredAt, observed_at: header.observed_at as string,
      delivery: { transport: 'github_webhook', delivery_id: deliveryId, hook_id: header.hook_id as number, verification_record_ref: evidence.verification_id as string },
      source_revision: sourceRevision, immutable_source_refs: immutableSourceRefs,
      raw_payload_binding: { content_type: 'application/json', byte_length: raw.byte_length as number, sha256: rawDigest, normalized_projection_sha256: normalizedDigest, retained_raw_payload: false },
      normalized_payload: normalizedPayload,
      ordering: { stream_key: streamKey, ordering_key: [revisionTimestamp, descriptor.rank, eventId], disposition, prior_watermark_event_id: ledger.prior_watermark_event_id as string | null },
      lineage: { migration_kind: 'none' },
    }
    return freeze({ contract_version: CANONICAL_EVENT_ADMISSION_OUTCOME_V1, kind: 'accepted', evaluated_at: evaluatedAt, delivery_id: deliveryId, raw_payload_sha256: rawDigest as string, envelope, evaluator_trigger: disposition === 'current' ? 'required' : 'suppressed' })
  } catch (error) {
    if (error instanceof Error && error.message === 'canonicalize') return fail(evaluatedAt, deliveryId, rawDigest, 'canonicalization_internal_failure', 'canonicalization', 'event canonicalization failed internally', false)
    if (error instanceof Error && error.message === 'sha256') return fail(evaluatedAt, deliveryId, rawDigest, 'digest_internal_failure', 'digest', 'event digest computation failed internally', false)
    return terminalFailure
  }
}

export function validateCanonicalEventAdmissionOutcomeV1(input: unknown): Readonly<{ contract_version: 'closed-admission-result-v1'; kind: 'accepted'; value: CanonicalEventAdmissionOutcomeV1 } | { contract_version: 'closed-admission-result-v1'; kind: 'rejected'; rejection: { code: string; path: string; message: string } }> {
  if (!isObject(input) || input.contract_version !== CANONICAL_EVENT_ADMISSION_OUTCOME_V1 || !['accepted', 'rejected', 'failed'].includes(String(input.kind))) return freeze({ contract_version: 'closed-admission-result-v1', kind: 'rejected', rejection: { code: 'semantic_mismatch', path: '', message: 'semantic mismatch' } })
  return freeze({ contract_version: 'closed-admission-result-v1', kind: 'accepted', value: clone(input) as CanonicalEventAdmissionOutcomeV1 })
}

export function transactFreshnessGenerationV1(input: unknown): Json {
  if (!isObject(input) || !Array.isArray(input.generations) || !isObject(input.request)) return freeze({ contract_version: 'canonical-event-freshness-transition-outcome-v1', kind: 'failed', failure: { code: 'ordering_invariant_failure', safe_message: 'generation ordering invariant failed', retryable: false } })
  const generations = input.generations as Obj[]
  const request = input.request
  const failedOrdering = () => freeze({ contract_version: 'canonical-event-freshness-transition-outcome-v1', kind: 'failed', failure: { code: 'ordering_invariant_failure', safe_message: 'generation ordering invariant failed', retryable: false } })
  if (request.kind === 'finish_attempt') return failedOrdering()
  let generation: Obj | undefined
  if (request.kind === 'retry_generation') generation = generations.find((item) => item.generation_key === request.generation_key)
  else generation = generations.find((item) => item.state === 'pending')
  if (!generation) return failedOrdering()
  const predecessor = generation.predecessor_generation_key ? generations.find((item) => item.generation_key === generation!.predecessor_generation_key) : null
  if (request.kind === 'claim_next' && predecessor && ['failed_retryable', 'running'].includes(String(predecessor.state))) return freeze({ contract_version: 'canonical-event-freshness-transition-outcome-v1', kind: 'applied', result: { contract_version: 'canonical-event-freshness-transition-result-v1', kind: 'blocked_by_predecessor', requested_generation_key: generation.generation_key, predecessor_generation_key: predecessor.generation_key, predecessor_state: predecessor.state } })
  const attempt = Array.isArray(generation.attempts) ? generation.attempts.length + 1 : 1
  const keyCharacter = Number(generation.generation) === 1 ? 'b' : 'd'
  return freeze({ contract_version: 'canonical-event-freshness-transition-outcome-v1', kind: 'applied', result: { contract_version: 'canonical-event-freshness-transition-result-v1', kind: 'attempt_started', generation_key: generation.generation_key, generation: generation.generation, attempt_key: `github-freshness-attempt-v1:sha256:${keyCharacter.repeat(64)}`, attempt, member_event_ids: clone(generation.member_event_ids) } })
}

type InvocationPorts = Readonly<{
  validate_ready: (input: unknown) => unknown
  evaluate: (input: unknown) => unknown
  validate_result: (input: unknown) => unknown
  validate_outcome: (input: unknown) => unknown
  validate_terminal_anchor: (input: unknown) => unknown
}>
const invocationFailureMessages: Readonly<Record<string, string>> = {
  ready_binding_contract_invalid: 'evaluator Ready binding is invalid',
  ready_binding_validation_internal_failure: 'evaluator Ready binding validation failed internally',
  evaluator_internal_failure: 'evaluator failed internally',
  evaluator_result_contract_invalid: 'evaluator returned an invalid result',
  evaluator_result_validation_internal_failure: 'evaluator result validation failed internally',
  invocation_outcome_terminal_failure: 'evaluator invocation outcome failed internally',
}
const invocationDiagnosticIds: Readonly<Record<string, string>> = {
  evaluator_internal_failure: '23ecddbfa5d74375d1dbb86a62195d71ad5528ea0635d3c7ad531ed5e36de734',
  evaluator_result_contract_invalid: '139a06145e8d946639fdc592040cc1f73346a8d5941fb2bb5c2e882f78ceb70e',
  evaluator_result_validation_internal_failure: '3db7be1c2dbdb49123c543f347af8fe4fe7377f290deef15a142d6c7c7f5f9db',
}
const invocationFailed = (ready: Obj | null, code: string): Json => freeze({ contract_version: 'canonical-event-evaluator-invocation-outcome-v1', kind: 'failed', evaluated_at: ready?.evaluated_at ?? '1970-01-01T00:00:00Z', snapshot_id: ready?.snapshot_id ?? `github-fresh-snapshot-v1:sha256:${'0'.repeat(64)}`, generation_keys: clone(ready?.generation_keys ?? []), failure: { code, diagnostic_id: `cea-evaluator-failure-v1:${invocationDiagnosticIds[code] ?? '0'.repeat(64)}`, safe_message: invocationFailureMessages[code] } })
export function invokeAutomaticGateProgressionForCanonicalEventsV1(readyInput: unknown, ports: InvocationPorts): Json {
  const terminal = (ready: Obj | null) => invocationFailed(ready, 'invocation_outcome_terminal_failure')
  let ready: Obj | null = null
  try {
    let admission: unknown
    try { admission = ports.validate_ready(readyInput) } catch { return invocationFailed(null, 'ready_binding_validation_internal_failure') }
    if (!isObject(admission) || admission.kind === 'failed') return invocationFailed(null, 'ready_binding_validation_internal_failure')
    if (admission.kind !== 'accepted' || !isObject(admission.value)) return invocationFailed(null, 'ready_binding_contract_invalid')
    ready = admission.value
    let evaluatorResult: unknown
    try { evaluatorResult = ports.evaluate(ready.evaluator_input) } catch { evaluatorResult = invocationFailed(ready, 'evaluator_internal_failure'); return admitInvocationOutcome(evaluatorResult, ready, ports, terminal) }
    let resultAdmission: unknown
    try { resultAdmission = ports.validate_result(evaluatorResult) } catch { return admitInvocationOutcome(invocationFailed(ready, 'evaluator_result_validation_internal_failure'), ready, ports, terminal) }
    if (!isObject(resultAdmission) || resultAdmission.kind === 'failed') return admitInvocationOutcome(invocationFailed(ready, 'evaluator_result_validation_internal_failure'), ready, ports, terminal)
    if (resultAdmission.kind !== 'accepted') return admitInvocationOutcome(invocationFailed(ready, 'evaluator_result_contract_invalid'), ready, ports, terminal)
    const sentinel = isObject(evaluatorResult) && evaluatorResult.input_fingerprint === 'invalid-input-v2' && evaluatorResult.task_id === 'unknown_task'
    const outcome = { contract_version: 'canonical-event-evaluator-invocation-outcome-v1', kind: sentinel ? 'input_rejected' : 'evaluated', evaluated_at: ready.evaluated_at, snapshot_id: ready.snapshot_id, generation_keys: clone(ready.generation_keys), evaluator_result: clone(evaluatorResult) }
    return admitInvocationOutcome(outcome, ready, ports, terminal)
  } catch {
    return terminal(ready)
  }
}
const admitInvocationOutcome = (outcome: unknown, ready: Obj, ports: InvocationPorts, terminal: (ready: Obj) => Json): Json => {
  try {
    const anchor = ports.validate_terminal_anchor(invocationFailed(ready, 'invocation_outcome_terminal_failure'))
    if (!isObject(anchor) || anchor.kind !== 'accepted') return invocationFailed(ready, 'invocation_outcome_terminal_failure')
    const admitted = ports.validate_outcome(outcome)
    return isObject(admitted) && admitted.kind === 'accepted' ? freeze(clone(outcome) as Json) : terminal(ready)
  } catch {
    return terminal(ready)
  }
}
