import {
  evaluateAutomaticGateProgressionV2,
  validateAutomaticGateProgressionEvaluationInputV2,
  validateAutomaticGateProgressionEvaluationResultV2,
  type AutomaticGateProgressionEvaluationResultV2,
} from '../automatic-gate-progression'

export const CANONICAL_EVENT_ADMISSION_OUTCOME_V1 = 'canonical-event-admission-outcome-v1' as const

type Json = unknown
type PortResult<T> = Readonly<
  | { contract_version: 'canonical-event-port-result-v1'; kind: 'ok'; value: T }
  | { contract_version: 'canonical-event-port-result-v1'; kind: 'failed'; safe_code: 'port_operation_failed' }
>
type LedgerResult = Readonly<
  | { contract_version: 'canonical-event-ledger-transaction-result-v1'; kind: 'committed'; decision: 'current' | 'historical'; generation: number | null; generation_key: string | null; prior_watermark_revision_timestamp: string | null; prior_watermark_event_id: string | null }
  | { contract_version: 'canonical-event-ledger-transaction-result-v1'; kind: 'duplicate'; code: 'duplicate_delivery'; existing_event_id: string }
  | { contract_version: 'canonical-event-ledger-transaction-result-v1'; kind: 'conflict'; code: 'delivery_identity_conflict' | 'event_identity_payload_conflict' }
  | { contract_version: 'canonical-event-ledger-transaction-result-v1'; kind: 'failed'; code: 'ledger_read_failure' | 'ledger_write_failure' | 'ordering_invariant_failure'; retryable: boolean }
>
export type CanonicalEventAdmissionPortsV1 = Readonly<{
  canonicalize_jcs: (value: Json) => PortResult<Uint8Array>
  sha256: (value: Uint8Array) => PortResult<string>
  ledger_transact: (value: Json) => Promise<LedgerResult>
}>
type Rejection = Readonly<{ code: string; stage: string; path: string; message: string }>
type Failure = Readonly<{ code: string; stage: string; operation: 'canonicalize_jcs' | 'sha256' | 'ledger_transact' | null; diagnostic_id: string; safe_message: string; retryable: boolean }>
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
    operation: null,
    diagnostic_id: `cea-failure-v1:${'0'.repeat(64)}`,
    safe_message: 'event admission failed before a normal outcome could be admitted',
    retryable: false,
  },
}) as CanonicalEventAdmissionOutcomeV1

const reject = (evaluatedAt: string, deliveryId: string | null, digest: string | null, code: string, stage: string, path: string, message: string): CanonicalEventAdmissionOutcomeV1 =>
  freeze({ contract_version: CANONICAL_EVENT_ADMISSION_OUTCOME_V1, kind: 'rejected', evaluated_at: evaluatedAt, delivery_id: deliveryId, raw_payload_sha256: digest, rejection: { code, stage, path, message }, existing_event_id: null, retryable: false as const })
const canonicalJson = (value: unknown): string => {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (isObject(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`
  throw new TypeError('outside JSON data model')
}
const sha256HexPure = (text: string): string => {
  const bytes = new TextEncoder().encode(text)
  const paddedLength = (((bytes.length + 9 + 63) >> 6) << 6)
  const data = new Uint8Array(paddedLength)
  data.set(bytes)
  data[bytes.length] = 0x80
  const view = new DataView(data.buffer)
  const bitLength = bytes.length * 8
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000))
  view.setUint32(paddedLength - 4, bitLength >>> 0)
  const constants = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
    0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
    0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
    0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354,
    0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70,
    0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116,
    0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f,
    0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa,
    0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]
  const state = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]
  const words = new Uint32Array(64)
  const rotate = (value: number, bits: number) => (value >>> bits) | (value << (32 - bits))
  for (let offset = 0; offset < data.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) words[index] = view.getUint32(offset + index * 4)
    for (let index = 16; index < 64; index += 1) {
      const first = words[index - 15]
      const second = words[index - 2]
      const s0 = rotate(first, 7) ^ rotate(first, 18) ^ (first >>> 3)
      const s1 = rotate(second, 17) ^ rotate(second, 19) ^ (second >>> 10)
      words[index] = (words[index - 16] + s0 + words[index - 7] + s1) >>> 0
    }
    let [a, b, c, d, e, f, g, h] = state
    for (let index = 0; index < 64; index += 1) {
      const s1 = rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25)
      const choice = (e & f) ^ (~e & g)
      const first = (h + s1 + choice + constants[index] + words[index]) >>> 0
      const s0 = rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22)
      const majority = (a & b) ^ (a & c) ^ (b & c)
      const second = (s0 + majority) >>> 0
      h = g; g = f; f = e; e = (d + first) >>> 0; d = c; c = b; b = a; a = (first + second) >>> 0
    }
    state[0] = (state[0] + a) >>> 0; state[1] = (state[1] + b) >>> 0
    state[2] = (state[2] + c) >>> 0; state[3] = (state[3] + d) >>> 0
    state[4] = (state[4] + e) >>> 0; state[5] = (state[5] + f) >>> 0
    state[6] = (state[6] + g) >>> 0; state[7] = (state[7] + h) >>> 0
  }
  return state.map((word) => word.toString(16).padStart(8, '0')).join('')
}
const fail = (evaluatedAt: string | null, deliveryId: string | null, digest: string | null, code: string, stage: string, message: string, retryable: boolean, operation: Failure['operation'] = null): CanonicalEventAdmissionOutcomeV1 =>
  freeze({
    contract_version: CANONICAL_EVENT_ADMISSION_OUTCOME_V1,
    kind: 'failed',
    evaluated_at: evaluatedAt,
    delivery_id: deliveryId,
    raw_payload_sha256: digest,
    failure: {
      code,
      stage,
      operation,
      diagnostic_id: `cea-failure-v1:${sha256HexPure(canonicalJson({
        contract_version: CANONICAL_EVENT_ADMISSION_OUTCOME_V1,
        code,
        stage,
        operation,
        delivery_id: deliveryId,
        raw_payload_sha256: digest,
        evaluated_at: evaluatedAt,
      }))}`,
      safe_message: message,
      retryable,
    },
  })
class PortBoundaryError extends Error {
  constructor(
    readonly operation: 'canonicalize_jcs' | 'sha256',
    readonly boundary: 'internal' | 'contract',
  ) {
    super(`${operation}:${boundary}`)
  }
}
const portBytes = (ports: CanonicalEventAdmissionPortsV1, value: Json): Uint8Array => {
  let result: unknown
  try {
    result = ports.canonicalize_jcs(clone(value))
  } catch {
    throw new PortBoundaryError('canonicalize_jcs', 'internal')
  }
  if (!isObject(result) || result.contract_version !== 'canonical-event-port-result-v1') throw new PortBoundaryError('canonicalize_jcs', 'contract')
  if (result.kind === 'failed' && Object.keys(result).length === 3 && result.safe_code === 'port_operation_failed') throw new PortBoundaryError('canonicalize_jcs', 'internal')
  if (result.kind !== 'ok' || Object.keys(result).length !== 3 || !(result.value instanceof Uint8Array)) throw new PortBoundaryError('canonicalize_jcs', 'contract')
  return new Uint8Array(result.value)
}
const portSha = (ports: CanonicalEventAdmissionPortsV1, value: Uint8Array): string => {
  let result: unknown
  try {
    result = ports.sha256(new Uint8Array(value))
  } catch {
    throw new PortBoundaryError('sha256', 'internal')
  }
  if (!isObject(result) || result.contract_version !== 'canonical-event-port-result-v1') throw new PortBoundaryError('sha256', 'contract')
  if (result.kind === 'failed' && Object.keys(result).length === 3 && result.safe_code === 'port_operation_failed') throw new PortBoundaryError('sha256', 'internal')
  if (result.kind !== 'ok' || Object.keys(result).length !== 3 || !format(result.value, /^sha256:[0-9a-f]{64}$/)) throw new PortBoundaryError('sha256', 'contract')
  return result.value as string
}
const ledgerResultIsClosed = (input: unknown): input is LedgerResult => {
  if (!isObject(input) || input.contract_version !== 'canonical-event-ledger-transaction-result-v1') return false
  const fields = input.kind === 'committed'
    ? ['contract_version', 'kind', 'decision', 'generation', 'generation_key', 'prior_watermark_revision_timestamp', 'prior_watermark_event_id']
    : input.kind === 'duplicate'
      ? ['contract_version', 'kind', 'code', 'existing_event_id']
      : input.kind === 'conflict'
        ? ['contract_version', 'kind', 'code']
        : input.kind === 'failed'
          ? ['contract_version', 'kind', 'code', 'retryable']
          : []
  if (fields.length === 0 || Object.keys(input).length !== fields.length || fields.some((field) => !has(input, field))) return false
  if (input.kind === 'committed') {
    return ['current', 'historical'].includes(String(input.decision)) &&
      (input.generation === null || validNumber(input.generation)) &&
      (input.generation_key === null || format(input.generation_key, /^github-freshness-generation-v1:sha256:[0-9a-f]{64}$/)) &&
      (input.prior_watermark_revision_timestamp === null || utcTimestamp(input.prior_watermark_revision_timestamp)) &&
      (input.prior_watermark_event_id === null || format(input.prior_watermark_event_id, /^github-event-v1:sha256:[0-9a-f]{64}$/))
  }
  if (input.kind === 'duplicate') return input.code === 'duplicate_delivery' && format(input.existing_event_id, /^github-event-v1:sha256:[0-9a-f]{64}$/)
  if (input.kind === 'conflict') return ['delivery_identity_conflict', 'event_identity_payload_conflict'].includes(String(input.code))
  return ['ledger_read_failure', 'ledger_write_failure', 'ordering_invariant_failure'].includes(String(input.code)) &&
    input.retryable === (input.code !== 'ordering_invariant_failure')
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

async function produceCanonicalGitHubEventV1(invocation: unknown, rawInput: unknown, ports: CanonicalEventAdmissionPortsV1): Promise<CanonicalEventAdmissionOutcomeV1> {
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
    const sourceIdentityUrls: readonly [unknown, string][] = descriptor.eventName === 'status'
      ? [
          [source.url, '/provider_payload/url'],
          [(payload.commit as Obj).html_url, '/provider_payload/commit/html_url'],
          [(payload.commit as Obj).url, '/provider_payload/commit/url'],
        ]
      : [
          [source.html_url, `/provider_payload/${descriptor.sourceKey}/html_url`],
          [source.url, `/provider_payload/${descriptor.sourceKey}/url`],
          ...(parent
            ? [
                [parent.html_url, `/provider_payload/${descriptor.parentKey}/html_url`],
                [parent.url, `/provider_payload/${descriptor.parentKey}/url`],
              ] as readonly [unknown, string][]
            : []),
        ]
    const invalidSourceIdentity = sourceIdentityUrls.find(([value]) => !gitHubSourceUrl(value))
    if (invalidSourceIdentity) return reject(evaluatedAt, deliveryId, rawDigest, 'repository_mismatch', 'source_identity', invalidSourceIdentity[1], 'repository identity mismatch')
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
    let ledger: LedgerResult
    try {
      ledger = await ports.ledger_transact(freeze({ contract_version: 'canonical-event-ledger-transaction-request-v1', delivery_id: deliveryId, canonical_event_id: eventId, raw_payload_sha256: rawDigest, normalized_projection_sha256: normalizedDigest, stream_key: streamKey, revision_timestamp: revisionTimestamp, tie_break_key: [descriptor.rank, eventId] }) as Json)
    } catch {
      return fail(evaluatedAt, deliveryId, rawDigest, 'ledger_transaction_internal_failure', 'ledger_transaction', 'event ledger transaction failed internally', true)
    }
    if (!ledgerResultIsClosed(ledger)) return fail(evaluatedAt, deliveryId, rawDigest, 'port_contract_invalid', 'port_contract', 'ledger_transact returned an invalid port result', false, 'ledger_transact')
    if (ledger.kind === 'duplicate') {
      const outcome = reject(evaluatedAt, deliveryId, rawDigest, 'duplicate_delivery', 'duplicate_ordering', '/delivery/delivery_id', 'event delivery already admitted') as Extract<CanonicalEventAdmissionOutcomeV1, { kind: 'rejected' }>
      return freeze({ ...outcome, existing_event_id: ledger.existing_event_id as string })
    }
    if (ledger.kind === 'conflict') return reject(evaluatedAt, deliveryId, rawDigest, ledger.code as string, 'duplicate_ordering', ledger.code === 'delivery_identity_conflict' ? '/delivery/delivery_id' : '/canonical_event_id', ledger.code === 'delivery_identity_conflict' ? 'delivery identity is bound to different content' : 'event identity is bound to different content')
    if (ledger.kind === 'failed') {
      const message = ledger.code === 'ledger_read_failure' ? 'event ledger read failed' : ledger.code === 'ledger_write_failure' ? 'event ledger write failed' : 'event ordering invariant failed'
      return fail(evaluatedAt, deliveryId, rawDigest, ledger.code, ledger.code === 'ledger_read_failure' ? 'ledger_read' : ledger.code === 'ledger_write_failure' ? 'ledger_write' : 'ordering', message, ledger.retryable)
    }
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
    if (error instanceof PortBoundaryError && error.boundary === 'contract') return fail(evaluatedAt, deliveryId, rawDigest, 'port_contract_invalid', 'port_contract', `${error.operation} returned an invalid port result`, false, error.operation)
    if (error instanceof PortBoundaryError && error.operation === 'canonicalize_jcs') return fail(evaluatedAt, deliveryId, rawDigest, 'canonicalization_internal_failure', 'canonicalization', 'event canonicalization failed internally', false)
    if (error instanceof PortBoundaryError && error.operation === 'sha256') return fail(evaluatedAt, deliveryId, rawDigest, 'digest_internal_failure', 'digest', 'event digest computation failed internally', false)
    return terminalFailure
  }
}

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
export type AdmissionResultV1<T> =
  | Readonly<{ contract_version: 'closed-admission-result-v1'; kind: 'accepted'; value: T }>
  | Readonly<{ contract_version: 'closed-admission-result-v1'; kind: 'rejected'; rejection: Readonly<{ code: string; path: string; message: string }> }>
  | Readonly<{ contract_version: 'closed-admission-result-v1'; kind: 'failed'; failure: Readonly<{ code: 'validator_internal_failure'; diagnostic_id: string; safe_message: 'validator failed internally' }> }>

const rejectAdmission = (code: string, path: string, message: string) =>
  freeze({ contract_version: 'closed-admission-result-v1' as const, kind: 'rejected' as const, rejection: { code, path, message } })
const failAdmission = (validatorId = 'canonical-event-internal-v1') =>
  freeze({
    contract_version: 'closed-admission-result-v1' as const,
    kind: 'failed' as const,
    failure: {
      code: 'validator_internal_failure' as const,
      diagnostic_id: `closed-admission-failure-v1:${sha256HexPure(canonicalJson({
        contract_version: 'closed-admission-result-v1',
        validator_id: validatorId,
        code: 'validator_internal_failure',
      }))}`,
      safe_message: 'validator failed internally' as const,
    },
  })
const acceptAdmission = <T>(value: T, validatorId = 'canonical-event-internal-v1'): AdmissionResultV1<T> => {
  try {
    return freeze({ contract_version: 'closed-admission-result-v1' as const, kind: 'accepted' as const, value: freeze(clone(value)) as T })
  } catch {
    return failAdmission(validatorId)
  }
}
const exactObject = (input: unknown, requiredFields: readonly string[], optionalFields: readonly string[] = [], path = '') => {
  if (!isObject(input)) return rejectAdmission('invalid_type', path, 'invalid type')
  for (const field of requiredFields) {
    if (!has(input, field)) return rejectAdmission('missing_required_field', `${path}/${field}`, 'missing required field')
  }
  const allowed = new Set([...requiredFields, ...optionalFields])
  const unknown = Object.keys(input).find((field) => !allowed.has(field))
  return unknown === undefined ? undefined : rejectAdmission('unknown_field', `${path}/${unknown}`, 'unknown field')
}
const utcTimestamp = (value: unknown) =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) &&
  Number.isFinite(Date.parse(value))
const format = (value: unknown, expression: RegExp) => typeof value === 'string' && expression.test(value)
const sortedUnique = (value: unknown, expression?: RegExp) =>
  Array.isArray(value) &&
  value.every((item) => typeof item === 'string' && (!expression || expression.test(item))) &&
  value.every((item, index) => index === 0 || String(value[index - 1]) < item)
const jsonData = (value: unknown, ancestors = new Set<object>()): boolean => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value !== 'object' || ancestors.has(value)) return false
  ancestors.add(value)
  if (Array.isArray(value)) {
    return Object.keys(value).every((key) => /^(0|[1-9][0-9]*)$/.test(key) && Number(key) < value.length) &&
      value.every((item) => jsonData(item, new Set(ancestors)))
  }
  if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) return false
  return Object.values(Object.getOwnPropertyDescriptors(value)).every(
    (descriptor) => 'value' in descriptor && descriptor.enumerable && jsonData(descriptor.value, new Set(ancestors)),
  )
}

export function validateCanonicalEventAdmissionInvocationV1(input: unknown): AdmissionResultV1<Readonly<Obj>> {
  try {
    const root = exactObject(input, ['contract_version', 'clock', 'verification'])
    if (root) return root
    const value = input as Obj
    if (value.contract_version !== 'canonical-event-admission-invocation-v1') return rejectAdmission('invalid_enum', '/contract_version', 'invalid enum value')
    const clockIssue = exactObject(value.clock, ['state', 'admission_started_at'], [], '/clock')
    if (clockIssue) return clockIssue
    const clock = value.clock as Obj
    if (!['available', 'unavailable'].includes(String(clock.state)) || !(clock.admission_started_at === null || utcTimestamp(clock.admission_started_at))) return rejectAdmission('conditional_field_violation', '/clock', 'conditional field violation')
    const verificationIssue = exactObject(value.verification, ['state'], ['evidence'], '/verification')
    if (verificationIssue) return verificationIssue
    const verification = value.verification as Obj
    if (!['verified', 'unverified', 'missing', 'failed'].includes(String(verification.state))) return rejectAdmission('invalid_enum', '/verification/state', 'invalid enum value')
    if ((verification.state === 'verified') !== has(verification, 'evidence')) return rejectAdmission('conditional_field_violation', '/verification/evidence', 'conditional field violation')
    return jsonData(value) ? acceptAdmission(value) : rejectAdmission('invalid_type', '', 'invalid type')
  } catch {
    return failAdmission('canonical-event-admission-invocation-v1')
  }
}

export function validateRawGitHubEventInputV1(input: unknown): AdmissionResultV1<Readonly<Obj>> {
  try {
    const root = exactObject(input, ['contract_version', 'admission_profile', 'provider', 'repository', 'header_projection', 'raw_payload'])
    if (root) return root
    const value = input as Obj
    if (value.contract_version !== 'canonical-event-raw-input-v1' || value.admission_profile !== 'sd-prompt-studio-github-admission-v1' || value.provider !== 'github') return rejectAdmission('invalid_enum', '/contract_version', 'invalid enum value')
    for (const [field, fields] of [
      ['repository', ['database_id', 'node_id', 'full_name', 'html_url']],
      ['header_projection', ['delivery_id', 'event_name', 'action', 'hook_id', 'observed_at']],
      ['raw_payload', ['content_type', 'encoding', 'body_base64', 'byte_length', 'sha256']],
    ] as const) {
      const issue = exactObject(value[field], fields, [], `/${field}`)
      if (issue) return issue
    }
    const repository = value.repository as Obj
    const header = value.header_projection as Obj
    const payload = value.raw_payload as Obj
    if (!validNumber(repository.database_id)) return rejectAdmission('invalid_type', '/repository/database_id', 'invalid type')
    if (!format(repository.node_id, /^[A-Za-z0-9_=-]+$/)) return rejectAdmission('invalid_format', '/repository/node_id', 'invalid format')
    if (!format(repository.full_name, /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/)) return rejectAdmission('invalid_format', '/repository/full_name', 'invalid format')
    if (repository.html_url !== `https://github.com/${repository.full_name}`) return rejectAdmission('semantic_mismatch', '/repository/html_url', 'semantic mismatch')
    if (!format(header.delivery_id, /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/) || !validNumber(header.hook_id) || !utcTimestamp(header.observed_at) || !(typeof header.action === 'string' || header.action === null) || !validString(header.event_name)) return rejectAdmission('invalid_format', '/header_projection', 'invalid format')
    if (payload.content_type !== 'application/json' || payload.encoding !== 'base64' || !validNumber(payload.byte_length) || !format(payload.sha256, /^sha256:[0-9a-f]{64}$/) || !validString(payload.body_base64)) return rejectAdmission('invalid_format', '/raw_payload', 'invalid format')
    return jsonData(value) ? acceptAdmission(value) : rejectAdmission('invalid_type', '', 'invalid type')
  } catch {
    return failAdmission('canonical-event-raw-input-v1')
  }
}

const admissionFailureMatrix: Readonly<Record<string, readonly [string, string | null, string, boolean]>> = {
  invocation_context_invalid: ['bootstrap', null, 'admission invocation context invalid', false],
  admission_clock_unavailable: ['bootstrap', null, 'admission clock unavailable', true],
  terminal_outcome_failure: ['bootstrap', null, 'event admission failed before a normal outcome could be admitted', false],
  structural_validation_internal_failure: ['structural_validation', null, 'event structural validation failed internally', false],
  binding_internal_failure: ['binding', null, 'event raw binding failed internally', false],
  verification_internal_failure: ['verification', null, 'webhook verification failed internally', true],
  source_validation_internal_failure: ['source_validation', null, 'event source validation failed internally', false],
  normalization_internal_failure: ['normalization', null, 'event normalization failed internally', false],
  canonicalization_internal_failure: ['canonicalization', null, 'event canonicalization failed internally', false],
  digest_internal_failure: ['digest', null, 'event digest computation failed internally', false],
  ledger_read_failure: ['ledger_read', null, 'event ledger read failed', true],
  ledger_write_failure: ['ledger_write', null, 'event ledger write failed', true],
  ledger_transaction_internal_failure: ['ledger_transaction', null, 'event ledger transaction failed internally', true],
  ordering_invariant_failure: ['ordering', null, 'event ordering invariant failed', false],
}

const envelopeIssue = (code: string, path: string, message: string) =>
  rejectAdmission(code, path, message)
const envelopeSemantic = (path: string) =>
  envelopeIssue('semantic_mismatch', path, 'semantic mismatch')
const canonicalHttpUrl = (value: unknown) =>
  typeof value === 'string' && /^https:\/\/[^\s]+$/.test(value)
const gitHubSourceUrl = (value: unknown) =>
  typeof value === 'string' &&
  (/^https:\/\/github\.com\/whatrune\/sd-prompt-studio\/[^\s]+$/.test(value) ||
    /^https:\/\/api\.github\.com\/repos\/whatrune\/sd-prompt-studio\/[^\s]+$/.test(value))
const nullableUtcTimestamp = (value: unknown) => value === null || utcTimestamp(value)
const nullableEventId = (value: unknown) =>
  value === null || format(value, /^github-event-v1:sha256:[0-9a-f]{64}$/)

const validateCanonicalEventEnvelopeV1 = (
  input: unknown,
  deliveryId: unknown,
  rawPayloadSha256: unknown,
  evaluatorTrigger: unknown,
) => {
  const root = exactObject(input, [
    'contract_version',
    'schema_version',
    'canonical_event_id',
    'provider',
    'admission_profile',
    'repository',
    'event_type',
    'source_object',
    'actor',
    'occurred_at',
    'observed_at',
    'delivery',
    'source_revision',
    'immutable_source_refs',
    'raw_payload_binding',
    'normalized_payload',
    'ordering',
    'lineage',
  ], [], '/envelope')
  if (root) return root
  const envelope = input as Obj
  if (
    envelope.contract_version !== 'canonical-event-admission-v1' ||
    envelope.schema_version !== 'canonical-event-envelope-v1' ||
    envelope.provider !== 'github' ||
    envelope.admission_profile !== 'sd-prompt-studio-github-admission-v1' ||
    !format(envelope.canonical_event_id, /^github-event-v1:sha256:[0-9a-f]{64}$/) ||
    !utcTimestamp(envelope.observed_at) ||
    !nullableUtcTimestamp(envelope.occurred_at)
  ) {
    return envelopeSemantic('/envelope')
  }

  const repositoryIssue = exactObject(
    envelope.repository,
    ['database_id', 'node_id', 'full_name', 'html_url'],
    [],
    '/envelope/repository',
  )
  if (repositoryIssue) return repositoryIssue
  const repository = envelope.repository as Obj
  if (
    !validNumber(repository.database_id) ||
    !validString(repository.node_id) ||
    !format(repository.full_name, /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/) ||
    repository.html_url !== `https://github.com/${repository.full_name}`
  ) {
    return envelopeSemantic('/envelope/repository')
  }

  const normalizedPayload = envelope.normalized_payload
  if (!isObject(normalizedPayload)) return envelopeIssue('invalid_type', '/envelope/normalized_payload', 'invalid type')
  const descriptor = EVENT_DESCRIPTORS.find(
    (candidate) =>
      candidate.eventType === envelope.event_type &&
      candidate.normalizedKind === normalizedPayload.kind &&
      (candidate.action === normalizedPayload.action ||
        (candidate.eventName === 'status' && normalizedPayload.action === 'updated')),
  )
  if (!descriptor) return envelopeIssue('invalid_enum', '/envelope/event_type', 'invalid enum value')

  const sourceIssue = exactObject(
    envelope.source_object,
    ['kind', 'database_id', 'node_id', 'canonical_url', 'parent_database_id', 'parent_canonical_url'],
    [],
    '/envelope/source_object',
  )
  if (sourceIssue) return sourceIssue
  const source = envelope.source_object as Obj
  const expectsParent = descriptor.parentKey !== null
  if (
    source.kind !== descriptor.sourceKind ||
    !validNumber(source.database_id) ||
    !validString(source.node_id) ||
    !gitHubSourceUrl(source.canonical_url) ||
    (expectsParent
      ? !validNumber(source.parent_database_id) || !gitHubSourceUrl(source.parent_canonical_url)
      : source.parent_database_id !== null || source.parent_canonical_url !== null)
  ) {
    return envelopeSemantic('/envelope/source_object')
  }

  const actorIssue = exactObject(
    envelope.actor,
    ['provider', 'database_id', 'node_id', 'login', 'actor_type', 'canonical_url'],
    [],
    '/envelope/actor',
  )
  if (actorIssue) return actorIssue
  const actor = envelope.actor as Obj
  if (
    actor.provider !== 'github' ||
    !validNumber(actor.database_id) ||
    !validString(actor.node_id) ||
    !validString(actor.login) ||
    !['User', 'Bot', 'Organization'].includes(String(actor.actor_type)) ||
    actor.canonical_url !== `https://github.com/${actor.login}`
  ) {
    return envelopeSemantic('/envelope/actor')
  }

  const deliveryIssue = exactObject(
    envelope.delivery,
    ['transport', 'delivery_id', 'hook_id', 'verification_record_ref'],
    [],
    '/envelope/delivery',
  )
  if (deliveryIssue) return deliveryIssue
  const delivery = envelope.delivery as Obj
  if (
    delivery.transport !== 'github_webhook' ||
    delivery.delivery_id !== deliveryId ||
    !validNumber(delivery.hook_id) ||
    !format(delivery.verification_record_ref, /^github-webhook-verification-v1:sha256:[0-9a-f]{64}$/)
  ) {
    return envelopeSemantic('/envelope/delivery')
  }

  if (!isObject(envelope.source_revision)) {
    return envelopeIssue('invalid_type', '/envelope/source_revision', 'invalid type')
  }
  const revision = envelope.source_revision as Obj
  const revisionFields: Readonly<Record<string, readonly string[]>> = {
    record_updated_at: ['kind', 'revision_timestamp'],
    pr_head_transition: ['kind', 'revision_timestamp', 'before_head', 'after_head', 'required_equality'],
    check_run_created: ['kind', 'revision_token', 'head_sha', 'provider_state'],
    webhook_occurrence: ['kind', 'delivery_id', 'head_sha', 'provider_state'],
    ci_observation: [
      'kind',
      'revision_timestamp',
      'head_sha',
      'state',
      ...(has(revision, 'required_state_literal') ? ['required_state_literal'] : []),
    ],
  }
  const selectedRevisionFields = revisionFields[String(revision.kind)]
  if (!selectedRevisionFields) return envelopeIssue('invalid_enum', '/envelope/source_revision/kind', 'invalid enum value')
  const revisionIssue = exactObject(revision, selectedRevisionFields, [], '/envelope/source_revision')
  if (revisionIssue) return revisionIssue
  let validRevision = false
  if (revision.kind === 'record_updated_at') {
    validRevision = utcTimestamp(revision.revision_timestamp)
  } else if (revision.kind === 'pr_head_transition') {
    validRevision =
      utcTimestamp(revision.revision_timestamp) &&
      format(revision.before_head, /^[0-9a-f]{40}$/) &&
      format(revision.after_head, /^[0-9a-f]{40}$/) &&
      Array.isArray(revision.required_equality) &&
      revision.required_equality.length === 2 &&
      revision.required_equality[0] === revision.after_head &&
      revision.required_equality[1] === revision.after_head
  } else if (revision.kind === 'check_run_created') {
    validRevision =
      revision.revision_token === 'created' &&
      format(revision.head_sha, /^[0-9a-f]{40}$/) &&
      validString(revision.provider_state)
  } else if (revision.kind === 'webhook_occurrence') {
    validRevision =
      revision.delivery_id === '/header_projection/delivery_id' &&
      format(revision.head_sha, /^[0-9a-f]{40}$/) &&
      validString(revision.provider_state)
  } else {
    validRevision =
      utcTimestamp(revision.revision_timestamp) &&
      format(revision.head_sha, /^[0-9a-f]{40}$/) &&
      validString(revision.state) &&
      (!has(revision, 'required_state_literal') ||
        (revision.required_state_literal === 'completed' && revision.state === 'completed'))
  }
  if (!validRevision) return envelopeSemantic('/envelope/source_revision')

  if (
    !sortedUnique(envelope.immutable_source_refs) ||
    !(envelope.immutable_source_refs as unknown[]).every(gitHubSourceUrl) ||
    (envelope.immutable_source_refs as unknown[]).length === 0
  ) {
    return envelopeIssue('noncanonical_order', '/envelope/immutable_source_refs', 'noncanonical order')
  }

  const rawBindingIssue = exactObject(
    envelope.raw_payload_binding,
    ['content_type', 'byte_length', 'sha256', 'normalized_projection_sha256', 'retained_raw_payload'],
    [],
    '/envelope/raw_payload_binding',
  )
  if (rawBindingIssue) return rawBindingIssue
  const rawBinding = envelope.raw_payload_binding as Obj
  if (
    rawBinding.content_type !== 'application/json' ||
    !validNumber(rawBinding.byte_length) ||
    rawBinding.sha256 !== rawPayloadSha256 ||
    !format(rawBinding.normalized_projection_sha256, /^sha256:[0-9a-f]{64}$/) ||
    rawBinding.retained_raw_payload !== false
  ) {
    return envelopeSemantic('/envelope/raw_payload_binding')
  }

  const normalizedFields: Readonly<Record<string, readonly string[]>> = {
    canonical_record_trigger: ['kind', 'record_kind', 'action', 'record_url', 'parent_url', 'record_updated_at'],
    pr_snapshot_trigger: ['kind', 'action', 'pr_url', 'head_sha', 'base_ref', 'state', 'draft', 'record_updated_at'],
    ci_snapshot_trigger: ['kind', 'ci_kind', 'action', 'check_name', 'source_api_url', 'head_sha', 'state', 'conclusion', 'record_updated_at'],
  }
  const selectedNormalizedFields = normalizedFields[String(normalizedPayload.kind)]
  if (!selectedNormalizedFields) {
    return envelopeIssue('invalid_enum', '/envelope/normalized_payload/kind', 'invalid enum value')
  }
  const normalizedIssue = exactObject(
    normalizedPayload,
    selectedNormalizedFields,
    [],
    '/envelope/normalized_payload',
  )
  if (normalizedIssue) return normalizedIssue
  let validNormalized = false
  if (normalizedPayload.kind === 'canonical_record_trigger') {
    validNormalized =
      normalizedPayload.record_kind === descriptor.sourceKind &&
      normalizedPayload.action === descriptor.action &&
      normalizedPayload.record_url === source.canonical_url &&
      (expectsParent
        ? normalizedPayload.parent_url === source.parent_canonical_url
        : normalizedPayload.parent_url === null) &&
      utcTimestamp(normalizedPayload.record_updated_at)
  } else if (normalizedPayload.kind === 'pr_snapshot_trigger') {
    validNormalized =
      normalizedPayload.action === descriptor.action &&
      normalizedPayload.pr_url === source.canonical_url &&
      format(normalizedPayload.head_sha, /^[0-9a-f]{40}$/) &&
      validString(normalizedPayload.base_ref) &&
      ['open', 'closed'].includes(String(normalizedPayload.state)) &&
      typeof normalizedPayload.draft === 'boolean' &&
      utcTimestamp(normalizedPayload.record_updated_at)
  } else {
    validNormalized =
      ['check_run', 'commit_status'].includes(String(normalizedPayload.ci_kind)) &&
      normalizedPayload.action === (descriptor.eventName === 'status' ? 'updated' : descriptor.action) &&
      validString(normalizedPayload.check_name) &&
      gitHubSourceUrl(normalizedPayload.source_api_url) &&
      format(normalizedPayload.head_sha, /^[0-9a-f]{40}$/) &&
      validString(normalizedPayload.state) &&
      (normalizedPayload.conclusion === null || validString(normalizedPayload.conclusion)) &&
      nullableUtcTimestamp(normalizedPayload.record_updated_at)
  }
  if (!validNormalized) return envelopeSemantic('/envelope/normalized_payload')

  const orderingIssue = exactObject(
    envelope.ordering,
    ['stream_key', 'ordering_key', 'disposition', 'prior_watermark_event_id'],
    [],
    '/envelope/ordering',
  )
  if (orderingIssue) return orderingIssue
  const ordering = envelope.ordering as Obj
  if (
    !format(ordering.stream_key, /^github-stream-v1:sha256:[0-9a-f]{64}$/) ||
    !Array.isArray(ordering.ordering_key) ||
    ordering.ordering_key.length !== 3 ||
    !utcTimestamp(ordering.ordering_key[0]) ||
    ordering.ordering_key[1] !== descriptor.rank ||
    ordering.ordering_key[2] !== envelope.canonical_event_id ||
    !['current', 'historical'].includes(String(ordering.disposition)) ||
    !nullableEventId(ordering.prior_watermark_event_id) ||
    (ordering.disposition === 'current') !== (evaluatorTrigger === 'required')
  ) {
    return envelopeSemantic('/envelope/ordering')
  }

  const lineageIssue = exactObject(envelope.lineage, ['migration_kind'], [], '/envelope/lineage')
  if (lineageIssue) return lineageIssue
  if ((envelope.lineage as Obj).migration_kind !== 'none') {
    return envelopeIssue('invalid_enum', '/envelope/lineage/migration_kind', 'invalid enum value')
  }

  const sourceProjection = {
    kind: source.kind,
    database_id: source.database_id,
    node_id: source.node_id,
    parent_database_id: source.parent_database_id,
  }
  const eventIdProjection = {
    contract_version: 'canonical-event-admission-v1',
    provider: 'github',
    repository: {
      database_id: repository.database_id,
      node_id: repository.node_id,
      full_name: repository.full_name,
    },
    event_type: envelope.event_type,
    source_object: sourceProjection,
    source_revision: revision,
  }
  if (
    envelope.canonical_event_id !==
    `github-event-v1:sha256:${sha256HexPure(canonicalJson(eventIdProjection))}`
  ) {
    return envelopeIssue('reference_mismatch', '/envelope/canonical_event_id', 'reference mismatch')
  }
  const streamProjection = {
    provider: 'github',
    repository_database_id: repository.database_id,
    source_object_kind: source.kind,
    source_object_database_id: source.database_id,
    parent_database_id: source.parent_database_id,
  }
  if (
    ordering.stream_key !==
    `github-stream-v1:sha256:${sha256HexPure(canonicalJson(streamProjection))}`
  ) {
    return envelopeIssue('reference_mismatch', '/envelope/ordering/stream_key', 'reference mismatch')
  }
  const normalizedProjection = {
    event_type: envelope.event_type,
    source_object: source,
    actor,
    occurred_at: envelope.occurred_at,
    source_revision: revision,
    immutable_source_refs: envelope.immutable_source_refs,
    normalized_payload: normalizedPayload,
  }
  if (
    rawBinding.normalized_projection_sha256 !==
    `sha256:${sha256HexPure(canonicalJson(normalizedProjection))}`
  ) {
    return envelopeIssue(
      'reference_mismatch',
      '/envelope/raw_payload_binding/normalized_projection_sha256',
      'reference mismatch',
    )
  }
  return undefined
}

export function validateCanonicalEventAdmissionOutcomeV1(input: unknown): AdmissionResultV1<CanonicalEventAdmissionOutcomeV1> {
  try {
    if (!isObject(input)) return rejectAdmission('invalid_type', '', 'invalid type')
    const fields = input.kind === 'accepted'
      ? ['contract_version', 'kind', 'evaluated_at', 'delivery_id', 'raw_payload_sha256', 'envelope', 'evaluator_trigger']
      : input.kind === 'rejected'
        ? ['contract_version', 'kind', 'evaluated_at', 'delivery_id', 'raw_payload_sha256', 'rejection', 'existing_event_id', 'retryable']
        : input.kind === 'failed'
          ? ['contract_version', 'kind', 'evaluated_at', 'delivery_id', 'raw_payload_sha256', 'failure']
          : []
    if (fields.length === 0) return rejectAdmission('invalid_enum', '/kind', 'invalid enum value')
    const root = exactObject(input, fields)
    if (root) return root
    if (input.contract_version !== CANONICAL_EVENT_ADMISSION_OUTCOME_V1) return rejectAdmission('invalid_enum', '/contract_version', 'invalid enum value')
    if (!(input.delivery_id === null || typeof input.delivery_id === 'string') || !(input.raw_payload_sha256 === null || typeof input.raw_payload_sha256 === 'string')) return rejectAdmission('invalid_type', '/delivery_id', 'invalid type')
    if (input.kind === 'accepted') {
      if (!utcTimestamp(input.evaluated_at) || !format(input.delivery_id, /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/) || !format(input.raw_payload_sha256, /^sha256:[0-9a-f]{64}$/) || !['required', 'suppressed'].includes(String(input.evaluator_trigger))) return rejectAdmission('semantic_mismatch', '', 'semantic mismatch')
      const envelope = validateCanonicalEventEnvelopeV1(
        input.envelope,
        input.delivery_id,
        input.raw_payload_sha256,
        input.evaluator_trigger,
      )
      if (envelope) return envelope
    } else if (input.kind === 'rejected') {
      const issue = exactObject(input.rejection, ['code', 'stage', 'path', 'message'], [], '/rejection')
      if (issue) return issue
      if (!utcTimestamp(input.evaluated_at) || input.retryable !== false || !(input.existing_event_id === null || typeof input.existing_event_id === 'string')) return rejectAdmission('semantic_mismatch', '', 'semantic mismatch')
    } else {
      const issue = exactObject(input.failure, ['code', 'stage', 'operation', 'diagnostic_id', 'safe_message', 'retryable'], [], '/failure')
      if (issue) return issue
      const failure = input.failure as Obj
      const standard = admissionFailureMatrix[String(failure.code)]
      const port = failure.code === 'port_contract_invalid' && failure.stage === 'port_contract' && ['canonicalize_jcs', 'sha256', 'ledger_transact'].includes(String(failure.operation)) && failure.safe_message === `${failure.operation} returned an invalid port result` && failure.retryable === false
      if ((!standard || standard[0] !== failure.stage || standard[1] !== failure.operation || standard[2] !== failure.safe_message || standard[3] !== failure.retryable) && !port) return rejectAdmission('semantic_mismatch', '/failure', 'semantic mismatch')
      if (!format(failure.diagnostic_id, /^cea-failure-v1:[0-9a-f]{64}$/)) return rejectAdmission('invalid_format', '/failure/diagnostic_id', 'invalid format')
    }
    return acceptAdmission(input as CanonicalEventAdmissionOutcomeV1)
  } catch {
    return failAdmission('canonical-event-admission-outcome-v1')
  }
}

export async function admitCanonicalGitHubEventV1(
  invocation: unknown,
  rawInput: unknown,
  ports: CanonicalEventAdmissionPortsV1,
): Promise<CanonicalEventAdmissionOutcomeV1> {
  try {
    const outcome = await produceCanonicalGitHubEventV1(invocation, rawInput, ports)
    const admission = validateCanonicalEventAdmissionOutcomeV1(outcome)
    return admission.kind === 'accepted' ? admission.value : terminalFailure
  } catch {
    return terminalFailure
  }
}

export function validateFreshProgressionSnapshotV1(input: unknown): AdmissionResultV1<Readonly<Obj>> {
  try {
    const root = exactObject(input, ['contract_version', 'snapshot_id', 'collected_at', 'collector', 'repository', 'triggering_generation_keys', 'scope_resolution', 'target_evaluator_contract_version', 'input_candidate', 'input_candidate_content_sha256', 'field_evidence', 'collection_ordering'])
    if (root) return root
    const value = input as Obj
    const collectorIssue = exactObject(value.collector, ['collector_id', 'collector_version'], [], '/collector')
    if (collectorIssue) return collectorIssue
    const collector = value.collector as Obj
    if (!validString(value.contract_version) || !format(value.snapshot_id, /^github-fresh-snapshot-v1:sha256:[0-9a-f]{64}$/) || !utcTimestamp(value.collected_at) || collector.collector_id !== 'sd-prompt-studio-fresh-progression-collector' || !validString(collector.collector_version) || value.repository !== 'whatrune/sd-prompt-studio' || !sortedUnique(value.triggering_generation_keys, /^github-freshness-generation-v1:sha256:[0-9a-f]{64}$/) || !isObject(value.scope_resolution) || !validString(value.target_evaluator_contract_version) || !Array.isArray(value.field_evidence) || value.collection_ordering !== 'fresh-progression-field-order-v1') return rejectAdmission('semantic_mismatch', '', 'semantic mismatch')
    return acceptAdmission(value)
  } catch {
    return failAdmission('fresh-progression-snapshot-v1')
  }
}

const validateCandidateCarrier = (input: unknown, path: string) => {
  const admission = validateAutomaticGateProgressionEvaluationInputV2(input)
  if (admission.kind === 'failed') return failAdmission('automatic-gate-progression-evaluation-input-v2')
  if (admission.kind === 'rejected') {
    return rejectAdmission(
      admission.rejection.code,
      `${path}${admission.rejection.path}`,
      admission.rejection.message,
    )
  }
  return undefined
}

export function validateEvaluatorBindingOutcomeV1(input: unknown): AdmissionResultV1<Readonly<Obj>> {
  try {
    if (!isObject(input)) return rejectAdmission('invalid_type', '', 'invalid type')
    const fields = input.kind === 'ready'
      ? ['contract_version', 'kind', 'evaluated_at', 'snapshot_id', 'triggering_event_ids', 'triggering_generation_keys', 'input']
      : input.kind === 'blocked'
        ? ['contract_version', 'kind', 'evaluated_at', 'snapshot_id', 'triggering_event_ids', 'triggering_generation_keys', 'reason', 'diagnostic_path', 'canonical_evidence_refs']
        : []
    if (fields.length === 0) return rejectAdmission('invalid_enum', '/kind', 'invalid enum value')
    const root = exactObject(input, fields)
    if (root) return root
    if (input.contract_version !== 'canonical-event-evaluator-binding-outcome-v1' || !sortedUnique(input.triggering_event_ids, /^github-event-v1:sha256:[0-9a-f]{64}$/) || !sortedUnique(input.triggering_generation_keys, /^github-freshness-generation-v1:sha256:[0-9a-f]{64}$/)) return rejectAdmission('semantic_mismatch', '', 'semantic mismatch')
    if (input.kind === 'ready') {
      const carrierIssue = validateCandidateCarrier(input.input, '/input')
      if (carrierIssue) return carrierIssue
      if (!utcTimestamp(input.evaluated_at) || !format(input.snapshot_id, /^github-fresh-snapshot-v1:sha256:[0-9a-f]{64}$/)) return rejectAdmission('invalid_format', '/evaluated_at', 'invalid format')
    } else if (!(input.evaluated_at === null || utcTimestamp(input.evaluated_at)) || !(input.snapshot_id === null || format(input.snapshot_id, /^github-fresh-snapshot-v1:sha256:[0-9a-f]{64}$/)) || !['invalid_event_set', 'fresh_snapshot_unavailable', 'source_scope_ambiguous', 'source_conflict', 'identity_binding_mismatch', 'unsupported_snapshot_contract', 'unsupported_evaluator_contract'].includes(String(input.reason)) || typeof input.diagnostic_path !== 'string' || !sortedUnique(input.canonical_evidence_refs, /^https:\/\/github\.com\/whatrune\/sd-prompt-studio\//)) {
      return rejectAdmission('semantic_mismatch', '', 'semantic mismatch')
    }
    return acceptAdmission(input)
  } catch {
    return failAdmission('canonical-event-evaluator-binding-outcome-v1')
  }
}

export function validateCanonicalEventEvaluatorInvocationOutcomeV1(input: unknown): AdmissionResultV1<Readonly<Obj>> {
  try {
    if (!isObject(input)) return rejectAdmission('invalid_type', '', 'invalid type')
    const fields = input.kind === 'evaluated' || input.kind === 'input_rejected'
      ? ['contract_version', 'kind', 'evaluated_at', 'snapshot_id', 'generation_keys', 'evaluator_result']
      : input.kind === 'failed'
        ? ['contract_version', 'kind', 'evaluated_at', 'snapshot_id', 'generation_keys', 'failure']
        : []
    if (fields.length === 0) return rejectAdmission('invalid_enum', '/kind', 'invalid enum value')
    const root = exactObject(input, fields)
    if (root) return root
    if (input.contract_version !== 'canonical-event-evaluator-invocation-outcome-v1' || !utcTimestamp(input.evaluated_at) || !format(input.snapshot_id, /^github-fresh-snapshot-v1:sha256:[0-9a-f]{64}$/) || !sortedUnique(input.generation_keys, /^github-freshness-generation-v1:sha256:[0-9a-f]{64}$/)) return rejectAdmission('semantic_mismatch', '', 'semantic mismatch')
    if (input.kind === 'failed') {
      const failureIssue = exactObject(input.failure, ['code', 'diagnostic_id', 'safe_message'], [], '/failure')
      if (failureIssue) return failureIssue
      const failure = input.failure as Obj
      if (!has(invocationFailureMessages, String(failure.code)) || failure.safe_message !== invocationFailureMessages[String(failure.code)] || !format(failure.diagnostic_id, /^cea-evaluator-failure-v1:[0-9a-f]{64}$/)) return rejectAdmission('semantic_mismatch', '/failure', 'semantic mismatch')
    } else {
      const result = validateAutomaticGateProgressionEvaluationResultV2(input.evaluator_result)
      if (result.kind !== 'accepted') return rejectAdmission('semantic_mismatch', '/evaluator_result', 'semantic mismatch')
      const resultValue = input.evaluator_result as Obj
      const sentinel = resultValue.input_fingerprint === 'invalid-input-v2' && resultValue.task_id === 'unknown_task'
      if ((input.kind === 'input_rejected') !== sentinel) return rejectAdmission('conditional_field_violation', '/kind', 'conditional field violation')
    }
    return acceptAdmission(input)
  } catch {
    return failAdmission('canonical-event-evaluator-invocation-outcome-v1')
  }
}

export type FreshnessGenerationTransitionResultV1 = Readonly<Obj>
export type FreshnessGenerationTransactionPortV1 = Readonly<{ transact: (request: Readonly<Obj>) => Promise<unknown> }>
const generationRequestFields: Readonly<Record<string, readonly string[]>> = {
  admit_current_event: ['contract_version', 'kind', 'freshness_cycle_key', 'canonical_event_id', 'requested_at'],
  claim_next: ['contract_version', 'kind', 'freshness_cycle_key', 'requested_at'],
  retry_generation: ['contract_version', 'kind', 'generation_key', 'requested_at'],
  finish_attempt: ['contract_version', 'kind', 'generation_key', 'attempt_key', 'requested_at', 'terminal_state', 'evaluator_call_count', 'safe_failure_code', 'durable_result_ref'],
}
const validateGenerationRequest = (input: unknown): AdmissionResultV1<Readonly<Obj>> => {
  if (!isObject(input)) return rejectAdmission('invalid_type', '', 'invalid type')
  const fields = generationRequestFields[String(input.kind)]
  if (!fields) return rejectAdmission('invalid_enum', '/kind', 'invalid enum value')
  const issue = exactObject(input, fields)
  if (issue) return issue
  if (input.contract_version !== 'canonical-event-freshness-transition-request-v1' || !utcTimestamp(input.requested_at)) return rejectAdmission('semantic_mismatch', '', 'semantic mismatch')
  if (input.kind === 'finish_attempt') {
    const completed = input.terminal_state === 'completed' && input.evaluator_call_count === 1 && input.safe_failure_code === null && typeof input.durable_result_ref === 'string'
    const failed = ['failed_retryable', 'failed_terminal'].includes(String(input.terminal_state)) && [0, 1].includes(Number(input.evaluator_call_count)) && typeof input.safe_failure_code === 'string' && input.durable_result_ref === null
    if (!completed && !failed) return rejectAdmission('conditional_field_violation', '', 'conditional field violation')
  }
  return acceptAdmission(input)
}
const generationResultFields: Readonly<Record<string, readonly string[]>> = {
  member_admitted: ['contract_version', 'kind', 'generation_key', 'generation', 'member_event_ids'],
  attempt_started: ['contract_version', 'kind', 'generation_key', 'generation', 'attempt_key', 'attempt', 'member_event_ids'],
  attempt_finished: ['contract_version', 'kind', 'generation_key', 'generation', 'attempt_key', 'terminal_state', 'durable_result_ref'],
  blocked_by_predecessor: ['contract_version', 'kind', 'requested_generation_key', 'predecessor_generation_key', 'predecessor_state'],
  transition_rejected: ['contract_version', 'kind', 'generation_key', 'reason'],
}
export function validateFreshnessGenerationTransitionResultV1(input: unknown): AdmissionResultV1<FreshnessGenerationTransitionResultV1> {
  try {
    if (!isObject(input)) return rejectAdmission('invalid_type', '', 'invalid type')
    const fields = generationResultFields[String(input.kind)]
    if (!fields) return rejectAdmission('invalid_enum', '/kind', 'invalid enum value')
    const issue = exactObject(input, fields)
    if (issue) return issue
    if (input.contract_version !== 'canonical-event-freshness-transition-result-v1') return rejectAdmission('invalid_enum', '/contract_version', 'invalid enum value')
    if (has(input, 'generation') && !validNumber(input.generation)) return rejectAdmission('invalid_type', '/generation', 'invalid type')
    if (has(input, 'attempt') && !validNumber(input.attempt)) return rejectAdmission('invalid_type', '/attempt', 'invalid type')
    if (has(input, 'member_event_ids') && !sortedUnique(input.member_event_ids, /^github-event-v1:sha256:[0-9a-f]{64}$/)) return rejectAdmission('noncanonical_order', '/member_event_ids', 'noncanonical order')
    return acceptAdmission(input)
  } catch {
    return failAdmission('canonical-event-freshness-transition-result-v1')
  }
}
export async function transactFreshnessGenerationV1(
  request: unknown,
  port: FreshnessGenerationTransactionPortV1,
): Promise<AdmissionResultV1<FreshnessGenerationTransitionResultV1>> {
  const requestAdmission = validateGenerationRequest(request)
  if (requestAdmission.kind !== 'accepted') return requestAdmission as AdmissionResultV1<FreshnessGenerationTransitionResultV1>
  try {
    if (!isObject(port) || Object.keys(port).length !== 1 || typeof port.transact !== 'function') return rejectAdmission('semantic_mismatch', '/port', 'semantic mismatch')
    return validateFreshnessGenerationTransitionResultV1(await port.transact(requestAdmission.value))
  } catch {
    return failAdmission('canonical-event-freshness-transition-result-v1')
  }
}

export type CanonicalEventInvocationFaultModeV1 =
  | 'none'
  | 'evaluator_return_valid_non_sentinel'
  | 'evaluator_throw'
  | 'result_validator_rejected'
  | 'result_validator_failed'
  | 'result_validator_throw'
  | 'outcome_validator_rejected'
  | 'outcome_validator_failed'
  | 'outcome_validator_throw'
  | 'ready_validator_rejected'
  | 'ready_validator_failed'
  | 'ready_validator_throw'
export type CanonicalEventInvocationTestSessionTokenV1 = Readonly<object>
type CanonicalEventInvocationTestEvidenceV1 = {
  contract_version: 'canonical-event-invocation-test-evidence-v1'
  lifecycle: 'created' | 'running' | 'completed' | 'capture_internal_failure'
  ordered_trace: string[]
  call_counts: {
    ready_validator: number
    evaluator: number
    result_validator: number
    outcome_validator: number
    terminal_anchor_validator: number
  }
  intermediate_admission_kinds: string[]
  fallback_depth: 0 | 1
  retry_count: 0
  safe_diagnostic: 'test evidence capture failed' | null
}
type InvocationSessionV1 = {
  fault_mode: CanonicalEventInvocationFaultModeV1
  lifecycle: CanonicalEventInvocationTestEvidenceV1['lifecycle']
  evidence: CanonicalEventInvocationTestEvidenceV1
}
const invocationFaultModes = new Set<CanonicalEventInvocationFaultModeV1>([
  'none',
  'evaluator_return_valid_non_sentinel',
  'evaluator_throw',
  'result_validator_rejected',
  'result_validator_failed',
  'result_validator_throw',
  'outcome_validator_rejected',
  'outcome_validator_failed',
  'outcome_validator_throw',
  'ready_validator_rejected',
  'ready_validator_failed',
  'ready_validator_throw',
])
const invocationSessions = new WeakMap<object, InvocationSessionV1>()
const createInvocationEvidence = (): CanonicalEventInvocationTestEvidenceV1 => ({
  contract_version: 'canonical-event-invocation-test-evidence-v1',
  lifecycle: 'created',
  ordered_trace: [],
  call_counts: {
    ready_validator: 0,
    evaluator: 0,
    result_validator: 0,
    outcome_validator: 0,
    terminal_anchor_validator: 0,
  },
  intermediate_admission_kinds: [],
  fallback_depth: 0,
  retry_count: 0,
  safe_diagnostic: null,
})

export function createCanonicalEventInvocationTestSessionV1(
  input: unknown,
): AdmissionResultV1<CanonicalEventInvocationTestSessionTokenV1> {
  try {
    const issue = exactObject(input, ['contract_version', 'fault_mode'])
    if (issue) return issue
    const value = input as Obj
    if (
      value.contract_version !== 'canonical-event-invocation-test-session-v1' ||
      !invocationFaultModes.has(value.fault_mode as CanonicalEventInvocationFaultModeV1)
    ) {
      return rejectAdmission('invalid_enum', '/fault_mode', 'invalid enum value')
    }
    const token = freeze(Object.create(null) as object)
    invocationSessions.set(token, {
      fault_mode: value.fault_mode as CanonicalEventInvocationFaultModeV1,
      lifecycle: 'created',
      evidence: createInvocationEvidence(),
    })
    return freeze({ contract_version: 'closed-admission-result-v1', kind: 'accepted', value: token })
  } catch {
    return failAdmission('canonical-event-invocation-test-session-v1')
  }
}

export function readCanonicalEventInvocationTestEvidenceV1(
  input: unknown,
): AdmissionResultV1<Readonly<CanonicalEventInvocationTestEvidenceV1>> {
  try {
    if ((typeof input !== 'object' && typeof input !== 'function') || input === null) {
      return rejectAdmission('invalid_type', '', 'invalid type')
    }
    const session = invocationSessions.get(input)
    if (!session) return rejectAdmission('semantic_mismatch', '', 'semantic mismatch')
    session.evidence.lifecycle = session.lifecycle
    const result = acceptAdmission(session.evidence)
    if (session.lifecycle === 'completed' || session.lifecycle === 'capture_internal_failure') {
      invocationSessions.delete(input)
    }
    return result
  } catch {
    return failAdmission('canonical-event-invocation-test-evidence-v1')
  }
}

const contractInvocationFailed = (ready: Obj | null, code: string): Readonly<Obj> =>
  freeze({
    contract_version: 'canonical-event-evaluator-invocation-outcome-v1',
    kind: 'failed',
    evaluated_at: ready?.evaluated_at ?? '1970-01-01T00:00:00Z',
    snapshot_id: ready?.snapshot_id ?? `github-fresh-snapshot-v1:sha256:${'0'.repeat(64)}`,
    generation_keys: clone(ready?.triggering_generation_keys ?? []),
    failure: {
      code,
      diagnostic_id: `cea-evaluator-failure-v1:${invocationDiagnosticIds[code] ?? '0'.repeat(64)}`,
      safe_message: invocationFailureMessages[code],
    },
  })
const preReadyInvalidAnchor = contractInvocationFailed(null, 'ready_binding_contract_invalid')
const preReadyInternalAnchor = contractInvocationFailed(null, 'ready_binding_validation_internal_failure')
const deterministicNonSentinelResult = freeze({
  contract_version: 'automatic-gate-progression-evaluation-result-v2',
  task_id: 'task-001',
  evaluated_at: '2026-07-24T00:00:00Z',
  input_fingerprint: 'agp-input-v2:sha256:45ae2c8fd7737659f215c74158b6600236a28f4f9f0138586f0f6b4db6be4ab6',
  precedence_trace: ['structural_admission', 'canonical_authority'],
  gate_status_requirement: { required: false },
  kind: 'stop',
  stop_condition: 'transition_not_terminal_or_permitted',
  execution_stop_reason: 'architecture_gap',
  canonical_evidence_refs: ['https://github.com/whatrune/sd-prompt-studio/issues/179'],
  recovery_owner: 'backend_architect',
  required_recovery_evidence: ['fresh_terminal_transition_authority'],
}) as AutomaticGateProgressionEvaluationResultV2

export function invokeAutomaticGateProgressionForCanonicalEventsV1(
  candidate: unknown,
  test_session: CanonicalEventInvocationTestSessionTokenV1 | null,
): Readonly<Obj> {
  let session: InvocationSessionV1 | null = null
  if (test_session !== null) {
    session = invocationSessions.get(test_session as object) ?? null
    if (!session || session.lifecycle !== 'created') return preReadyInvalidAnchor
    session.lifecycle = 'running'
    session.evidence.lifecycle = 'running'
  }
  const mode = session?.fault_mode ?? 'none'
  const evidence = session?.evidence
  let ready: Obj | null = null
  let retainedAnchor: Readonly<Obj> | null = null
  const finish = (value: Readonly<Obj>) => {
    if (session) {
      session.lifecycle = 'completed'
      session.evidence.lifecycle = 'completed'
    }
    return value
  }
  const recordAdmission = (admission: unknown) => {
    if (evidence && isObject(admission) && ['accepted', 'rejected', 'failed'].includes(String(admission.kind))) {
      evidence.intermediate_admission_kinds.push(String(admission.kind))
    }
  }
  const terminal = () => {
    if (evidence) {
      evidence.ordered_trace.push('terminal_anchor_return')
      evidence.fallback_depth = 1
    }
    return finish(retainedAnchor ?? preReadyInternalAnchor)
  }
  try {
    evidence?.ordered_trace.push('ready_admission')
    if (evidence) evidence.call_counts.ready_validator += 1
    let readyAdmission = validateEvaluatorBindingOutcomeV1(candidate)
    if (mode === 'ready_validator_throw') throw new Error('ready_validator_throw')
    if (mode === 'ready_validator_rejected') readyAdmission = rejectAdmission('semantic_mismatch', '', 'semantic mismatch')
    if (mode === 'ready_validator_failed') readyAdmission = failAdmission()
    recordAdmission(readyAdmission)
    if (readyAdmission.kind === 'failed') return finish(preReadyInternalAnchor)
    if (readyAdmission.kind !== 'accepted' || readyAdmission.value.kind !== 'ready') return finish(preReadyInvalidAnchor)
    ready = freeze(clone(readyAdmission.value)) as Obj
    evidence?.ordered_trace.push('ready_copy')

    retainedAnchor = contractInvocationFailed(ready, 'invocation_outcome_terminal_failure')
    evidence?.ordered_trace.push('terminal_anchor_admission')
    if (evidence) evidence.call_counts.terminal_anchor_validator += 1
    const anchorAdmission = validateCanonicalEventEvaluatorInvocationOutcomeV1(retainedAnchor)
    recordAdmission(anchorAdmission)
    if (anchorAdmission.kind !== 'accepted') return finish(preReadyInternalAnchor)

    evidence?.ordered_trace.push('evaluator')
    if (evidence) evidence.call_counts.evaluator += 1
    let evaluatorResult = evaluateAutomaticGateProgressionV2(ready.input)
    if (mode === 'evaluator_throw') throw new Error('evaluator_throw')
    if (mode === 'evaluator_return_valid_non_sentinel') evaluatorResult = deterministicNonSentinelResult

    evidence?.ordered_trace.push('result_admission')
    if (evidence) evidence.call_counts.result_validator += 1
    let resultAdmission = validateAutomaticGateProgressionEvaluationResultV2(evaluatorResult)
    if (mode === 'result_validator_throw') throw new Error('result_validator_throw')
    if (mode === 'result_validator_rejected') resultAdmission = rejectAdmission('semantic_mismatch', '', 'semantic mismatch')
    if (mode === 'result_validator_failed') resultAdmission = failAdmission()
    recordAdmission(resultAdmission)

    let outcome: Readonly<Obj>
    if (resultAdmission.kind === 'failed') outcome = contractInvocationFailed(ready, 'evaluator_result_validation_internal_failure')
    else if (resultAdmission.kind === 'rejected') outcome = contractInvocationFailed(ready, 'evaluator_result_contract_invalid')
    else {
      evidence?.ordered_trace.push('sentinel_comparison')
      const result = resultAdmission.value
      const sentinel = result.input_fingerprint === 'invalid-input-v2' && result.task_id === 'unknown_task'
      outcome = freeze({
        contract_version: 'canonical-event-evaluator-invocation-outcome-v1',
        kind: sentinel ? 'input_rejected' : 'evaluated',
        evaluated_at: ready.evaluated_at,
        snapshot_id: ready.snapshot_id,
        generation_keys: clone(ready.triggering_generation_keys),
        evaluator_result: clone(result),
      })
    }

    evidence?.ordered_trace.push('outcome_admission')
    if (evidence) evidence.call_counts.outcome_validator += 1
    let outcomeAdmission = validateCanonicalEventEvaluatorInvocationOutcomeV1(outcome)
    if (mode === 'outcome_validator_throw') throw new Error('outcome_validator_throw')
    if (mode === 'outcome_validator_rejected') outcomeAdmission = rejectAdmission('semantic_mismatch', '', 'semantic mismatch')
    if (mode === 'outcome_validator_failed') outcomeAdmission = failAdmission()
    recordAdmission(outcomeAdmission)
    return outcomeAdmission.kind === 'accepted' ? finish(outcomeAdmission.value) : terminal()
  } catch (error) {
    if (error instanceof Error && error.message === 'ready_validator_throw') {
      recordAdmission(failAdmission())
      return finish(preReadyInternalAnchor)
    }
    if (!ready || !retainedAnchor) return finish(preReadyInternalAnchor)
    let failureCode = 'invocation_outcome_terminal_failure'
    if (error instanceof Error && error.message === 'evaluator_throw') failureCode = 'evaluator_internal_failure'
    if (error instanceof Error && error.message === 'result_validator_throw') failureCode = 'evaluator_result_validation_internal_failure'
    if (failureCode === 'invocation_outcome_terminal_failure') return terminal()
    const failed = contractInvocationFailed(ready, failureCode)
    evidence?.ordered_trace.push('outcome_admission')
    if (evidence) evidence.call_counts.outcome_validator += 1
    const admission = validateCanonicalEventEvaluatorInvocationOutcomeV1(failed)
    recordAdmission(admission)
    return admission.kind === 'accepted' ? finish(admission.value) : terminal()
  }
}
