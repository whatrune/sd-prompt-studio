import {
  validateAutomaticGateProgressionEvaluationResultV2,
  type AutomaticGateProgressionEvaluationResultV2,
} from '../automatic-gate-progression'
import { ROLE_VALUES, type RoleV1 } from '../context-health'
import { parseDocument } from 'yaml'

export const GATE_STATUS_PUBLICATION_INPUT_V1 = 'gate-status-publication-input-v1' as const
export const GATE_STATUS_PROJECTION_V1 = 'gate-status-projection-v1' as const
export const GATE_STATUS_PUBLICATION_RESULT_V1 = 'gate-status-publication-result-v1' as const
export const GATE_STATUS_PUBLICATION_RECEIPT_V1 = 'gate-status-publication-receipt-v1' as const
export const GATE_STATUS_ROLE_AUTHORITY_SET_V1 =
  'gate-status-role-authority-set-v1' as const

type JsonObject = Record<string, unknown>
type DigestV1 = string
type CanonicalUrlV1 = string
type FullShaV1 = string

export type GateStatusPublicationInputV1 = Readonly<JsonObject>
export type GateStatusProjectionV1 = Readonly<JsonObject>
export type GateStatusPublicationResultV1 = Readonly<JsonObject>
export type GateStatusPublicationReceiptV1 = Readonly<JsonObject>
export type GateStatusRoleAuthorityRecordV1 = Readonly<Record<string, unknown>>
export type GateStatusRoleAuthoritySetV1 = Readonly<Record<string, unknown>>

export type GateStatusAdmissionRejectionV1 = {
  readonly code:
    | 'unknown_field'
    | 'missing_required_field'
    | 'forbidden_field'
    | 'invalid_type_or_format'
    | 'invalid_enum'
    | 'duplicate_set_member'
    | 'noncanonical_set_order'
    | 'invalid_conditional_matrix'
    | 'invalid_cross_input_binding'
  readonly path: string
  readonly message: string
}

export type GateStatusAdmissionResultV1<T> =
  | { readonly accepted: true; readonly value: T }
  | { readonly accepted: false; readonly rejection: GateStatusAdmissionRejectionV1 }

export type CanonicalRecordReadResultV1 =
  | {
      readonly state: 'available'
      readonly source_kind: 'canonical_body'
      readonly canonical_url: CanonicalUrlV1
      readonly body_utf8: string
      readonly fetched_content_sha256: DigestV1
      readonly content: unknown
      readonly content_projection_sha256: DigestV1
    }
  | {
      readonly state: 'available'
      readonly source_kind: 'github_resource'
      readonly canonical_url: CanonicalUrlV1
      readonly source: unknown
      readonly fetched_content_sha256: DigestV1
      readonly content: unknown
      readonly content_projection_sha256: DigestV1
    }
  | { readonly state: 'unavailable' }

export type FreshPrReadResultV1 =
  | {
      readonly state: 'available'
      readonly snapshot: Readonly<JsonObject>
      readonly body_utf8: string
      readonly atomic_revision_observation?: Readonly<JsonObject>
    }
  | { readonly state: 'unavailable' }

export type AtomicCompareAndSwapResultV1 =
  | {
      readonly state: 'applied'
      readonly normalized_revision_identity_sha256: DigestV1
    }
  | { readonly state: 'precondition_failed' }
  | { readonly state: 'failed_before_write' }
  | { readonly state: 'indeterminate' }

export type ReceiptCreateOrGetResultV1 =
  | {
      readonly state: 'created' | 'existing_exact'
      readonly receipt_url: CanonicalUrlV1
      readonly receipt: GateStatusPublicationReceiptV1
    }
  | { readonly state: 'existing_conflict' }
  | { readonly state: 'failed_before_commit' }
  | { readonly state: 'indeterminate' }

export interface GateStatusPublisherPortsV1 {
  readonly read_canonical_record: (
    canonicalUrl: CanonicalUrlV1,
  ) => Promise<CanonicalRecordReadResultV1>
  readonly read_pr: (prUrl: CanonicalUrlV1) => Promise<FreshPrReadResultV1>
  readonly compare_and_swap_gate_status: (request: {
    readonly pr_url: CanonicalUrlV1
    readonly expected_body_utf8_sha256: DigestV1
    readonly expected_normalized_revision_identity_sha256: DigestV1
    readonly replacement_body_utf8: string
    readonly atomic_operation_key: string
  }) => Promise<AtomicCompareAndSwapResultV1>
  readonly receipt_create_or_get: (request: {
    readonly publication_key: string
    readonly candidate: GateStatusPublicationReceiptV1
  }) => Promise<ReceiptCreateOrGetResultV1>
}

const roles = new Set<string>(ROLE_VALUES)
const protectedActions = new Set([
  'ready_for_review',
  'approve',
  'normal_merge_commit',
])
const digestPattern = /^sha256:[0-9a-f]{64}$/
const fullShaPattern = /^[0-9a-f]{40}$/
const canonicalUrlPattern = /^https:\/\/github\.com\/whatrune\/sd-prompt-studio\/\S+$/
const prUrlPattern = /^https:\/\/github\.com\/whatrune\/sd-prompt-studio\/pull\/[1-9][0-9]*$/
const utcPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/
const actionPattern = /^[a-z][a-z0-9_]{0,63}$/

const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const hasOwn = (value: JsonObject, key: string) => Object.prototype.hasOwnProperty.call(value, key)
const nonEmpty = (value: unknown): value is string => typeof value === 'string' && value.length > 0
const digest = (value: unknown): value is DigestV1 =>
  typeof value === 'string' && digestPattern.test(value)
const fullSha = (value: unknown): value is FullShaV1 =>
  typeof value === 'string' && fullShaPattern.test(value)
const canonicalUrl = (value: unknown): value is CanonicalUrlV1 =>
  typeof value === 'string' && canonicalUrlPattern.test(value)
const prUrl = (value: unknown): value is CanonicalUrlV1 =>
  typeof value === 'string' && prUrlPattern.test(value)
const utc = (value: unknown): value is string =>
  typeof value === 'string' && utcPattern.test(value) && Number.isFinite(Date.parse(value))
const role = (value: unknown): value is RoleV1 =>
  typeof value === 'string' && roles.has(value)
const action = (value: unknown): value is string =>
  typeof value === 'string' && actionPattern.test(value)

const byteCompare = (left: string, right: string) => {
  const a = new TextEncoder().encode(left)
  const b = new TextEncoder().encode(right)
  for (let index = 0; index < Math.min(a.length, b.length); index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index]
  }
  return a.length - b.length
}
const sortedUnique = (values: readonly string[]) =>
  values.every((value, index) => index === 0 || byteCompare(values[index - 1], value) < 0)
const deepFreeze = <T>(value: T): T => {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value as JsonObject)) deepFreeze(child)
  }
  return value
}
const cloneFreeze = <T>(value: T): T => deepFreeze(structuredClone(value))

function canonicalize(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value)
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('outside RFC 8785 JSON data model')
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`
  if (isObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`)
      .join(',')}}`
  }
  throw new TypeError('outside RFC 8785 JSON data model')
}
const sameJsonMember = (left: JsonObject, right: JsonObject, key: string) =>
  hasOwn(left, key) === hasOwn(right, key) &&
  (!hasOwn(left, key) || canonicalize(left[key]) === canonicalize(right[key]))

function sha256HexBytes(bytes: Uint8Array): string {
  const bitLength = bytes.length * 8
  const paddedLength = (((bytes.length + 9 + 63) >> 6) << 6)
  const data = new Uint8Array(paddedLength)
  data.set(bytes)
  data[bytes.length] = 0x80
  const view = new DataView(data.buffer)
  view.setUint32(paddedLength - 4, bitLength >>> 0)
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000))
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
  const state = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]
  const words = new Uint32Array(64)
  const rotate = (value: number, bits: number) => (value >>> bits) | (value << (32 - bits))
  for (let offset = 0; offset < data.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) words[index] = view.getUint32(offset + index * 4)
    for (let index = 16; index < 64; index += 1) {
      const a = words[index - 15]
      const b = words[index - 2]
      const s0 = rotate(a, 7) ^ rotate(a, 18) ^ (a >>> 3)
      const s1 = rotate(b, 17) ^ rotate(b, 19) ^ (b >>> 10)
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
      h = g
      g = f
      f = e
      e = (d + first) >>> 0
      d = c
      c = b
      b = a
      a = (first + second) >>> 0
    }
    state[0] = (state[0] + a) >>> 0
    state[1] = (state[1] + b) >>> 0
    state[2] = (state[2] + c) >>> 0
    state[3] = (state[3] + d) >>> 0
    state[4] = (state[4] + e) >>> 0
    state[5] = (state[5] + f) >>> 0
    state[6] = (state[6] + g) >>> 0
    state[7] = (state[7] + h) >>> 0
  }
  return state.map((word) => word.toString(16).padStart(8, '0')).join('')
}

const sha256Bytes = (bytes: Uint8Array): DigestV1 => `sha256:${sha256HexBytes(bytes)}`
const sha256Utf8 = (value: string): DigestV1 => sha256Bytes(new TextEncoder().encode(value))
export const gateStatusJcsSha256V1 = (value: unknown): DigestV1 =>
  sha256Bytes(new TextEncoder().encode(canonicalize(value)))

const rejection = (
  code: GateStatusAdmissionRejectionV1['code'],
  path: string,
): GateStatusAdmissionRejectionV1 => ({
  code,
  path,
  message: 'Gate Status Publisher V1 admission rejected the supplied value.',
})
const exact = (
  value: unknown,
  fields: readonly string[],
  path: string,
): GateStatusAdmissionRejectionV1 | undefined => {
  if (!isObject(value)) return rejection('invalid_type_or_format', path)
  const missing = fields.find((field) => !hasOwn(value, field))
  if (missing !== undefined) return rejection('missing_required_field', `${path}/${missing}`)
  const allowed = new Set(fields)
  const unknown = Object.keys(value).filter((field) => !allowed.has(field)).sort(byteCompare)[0]
  return unknown === undefined ? undefined : rejection('unknown_field', `${path}/${unknown}`)
}
const exactUnknownBeforeMissing = (
  value: unknown,
  fields: readonly string[],
  path: string,
): GateStatusAdmissionRejectionV1 | undefined => {
  if (!isObject(value)) return rejection('invalid_type_or_format', path)
  const allowed = new Set(fields)
  const unknown = Object.keys(value).filter((field) => !allowed.has(field)).sort(byteCompare)[0]
  if (unknown !== undefined) return rejection('unknown_field', `${path}/${unknown}`)
  const missing = fields.find((field) => !hasOwn(value, field))
  return missing === undefined ? undefined : rejection('missing_required_field', `${path}/${missing}`)
}
const exactOptional = (
  value: unknown,
  required: readonly string[],
  optional: readonly string[],
  path: string,
): GateStatusAdmissionRejectionV1 | undefined => {
  if (!isObject(value)) return rejection('invalid_type_or_format', path)
  const missing = required.find((field) => !hasOwn(value, field))
  if (missing !== undefined) return rejection('missing_required_field', `${path}/${missing}`)
  const allowed = new Set([...required, ...optional])
  const unknown = Object.keys(value).filter((field) => !allowed.has(field)).sort(byteCompare)[0]
  return unknown === undefined ? undefined : rejection('unknown_field', `${path}/${unknown}`)
}
const validateStringSet = (
  value: unknown,
  path: string,
  item: (value: unknown) => boolean = nonEmpty,
): GateStatusAdmissionRejectionV1 | undefined => {
  if (!Array.isArray(value)) return rejection('invalid_type_or_format', path)
  for (let index = 0; index < value.length; index += 1) {
    if (!item(value[index])) return rejection('invalid_type_or_format', `${path}/${index}`)
  }
  if (new Set(value).size !== value.length) return rejection('duplicate_set_member', path)
  if (!sortedUnique(value)) return rejection('noncanonical_set_order', path)
  return undefined
}
const accepted = <T>(value: T): GateStatusAdmissionResultV1<T> => ({
  accepted: true,
  value: cloneFreeze(value),
})
const rejected = <T>(issue: GateStatusAdmissionRejectionV1): GateStatusAdmissionResultV1<T> => ({
  accepted: false,
  rejection: issue,
})

const projectionRows = [
  'current_head',
  'final_regression',
  'operational_validation',
  'pr_state_draft',
  'ready',
  'approve',
  'merge',
  'current_blocker_next_gate',
  'historical_evidence',
] as const
const statusValues = new Set([
  'completed',
  'historical_at_prior_head',
  'pending',
  'blocked',
  'unperformed',
])
const validateTransitionRow = (
  value: unknown,
  path: string,
  valueValidator: (value: unknown) => boolean,
): GateStatusAdmissionRejectionV1 | undefined => {
  const issue = exact(value, ['value', 'evidence_urls', 'next_action', 'next_owner'], path)
  if (issue) return issue
  const row = value as JsonObject
  if (!valueValidator(row.value)) return rejection('invalid_enum', `${path}/value`)
  const refs = validateStringSet(row.evidence_urls, `${path}/evidence_urls`, canonicalUrl)
  if (refs) return refs
  if (!(row.next_action === null || action(row.next_action))) {
    return rejection('invalid_type_or_format', `${path}/next_action`)
  }
  if (!(row.next_owner === null || role(row.next_owner))) {
    return rejection('invalid_type_or_format', `${path}/next_owner`)
  }
  if ((row.next_action === null) !== (row.next_owner === null)) {
    return rejection('invalid_conditional_matrix', path)
  }
  return undefined
}

export function validateGateStatusProjectionV1(
  input: unknown,
): GateStatusAdmissionResultV1<GateStatusProjectionV1> {
  try {
    const root = exact(input, ['contract_version', ...projectionRows], '')
    if (root) return rejected(root)
    const value = input as JsonObject
    if (value.contract_version !== GATE_STATUS_PROJECTION_V1) {
      return rejected(rejection('invalid_enum', '/contract_version'))
    }
    let issue = validateTransitionRow(value.current_head, '/current_head', fullSha)
    if (issue) return rejected(issue)
    issue = validateTransitionRow(value.final_regression, '/final_regression', (item) =>
      typeof item === 'string' && statusValues.has(item))
    if (issue) return rejected(issue)
    issue = validateTransitionRow(value.operational_validation, '/operational_validation', (item) =>
      typeof item === 'string' && statusValues.has(item))
    if (issue) return rejected(issue)
    issue = validateTransitionRow(value.pr_state_draft, '/pr_state_draft', (item) =>
      typeof item === 'string' && ['open_draft', 'open_ready', 'closed'].includes(item))
    if (issue) return rejected(issue)
    for (const key of ['ready', 'approve', 'merge'] as const) {
      issue = validateTransitionRow(value[key], `/${key}`, (item) =>
        typeof item === 'string' && statusValues.has(item))
      if (issue) return rejected(issue)
    }
    issue = exact(
      value.current_blocker_next_gate,
      ['blocker_id', 'next_action', 'next_owner', 'evidence_urls'],
      '/current_blocker_next_gate',
    )
    if (issue) return rejected(issue)
    const blocker = value.current_blocker_next_gate as JsonObject
    if (!(blocker.blocker_id === null || action(blocker.blocker_id))) {
      return rejected(rejection('invalid_type_or_format', '/current_blocker_next_gate/blocker_id'))
    }
    if (!(blocker.next_action === null || action(blocker.next_action))) {
      return rejected(rejection('invalid_type_or_format', '/current_blocker_next_gate/next_action'))
    }
    if (!(blocker.next_owner === null || role(blocker.next_owner))) {
      return rejected(rejection('invalid_type_or_format', '/current_blocker_next_gate/next_owner'))
    }
    if ((blocker.next_action === null) !== (blocker.next_owner === null)) {
      return rejected(rejection('invalid_conditional_matrix', '/current_blocker_next_gate'))
    }
    issue = validateStringSet(blocker.evidence_urls, '/current_blocker_next_gate/evidence_urls', canonicalUrl)
    if (issue) return rejected(issue)
    if (!Array.isArray(value.historical_evidence)) {
      return rejected(rejection('invalid_type_or_format', '/historical_evidence'))
    }
    const historicalKeys: string[] = []
    for (let index = 0; index < value.historical_evidence.length; index += 1) {
      const item = value.historical_evidence[index]
      issue = exact(item, ['head', 'value', 'evidence_url'], `/historical_evidence/${index}`)
      if (issue) return rejected(issue)
      const record = item as JsonObject
      if (!fullSha(record.head) || record.value !== 'historical_at_prior_head' || !canonicalUrl(record.evidence_url)) {
        return rejected(rejection('invalid_type_or_format', `/historical_evidence/${index}`))
      }
      historicalKeys.push(`${record.head}\u0000${record.evidence_url}`)
    }
    if (!sortedUnique(historicalKeys) && historicalKeys.length > 1) {
      return rejected(rejection('noncanonical_set_order', '/historical_evidence'))
    }
    return accepted(value)
  } catch {
    return rejected(rejection('invalid_type_or_format', ''))
  }
}

const renderEvidence = (value: unknown) =>
  Array.isArray(value) && value.length > 0 ? value.join('<br>') : 'not_applicable'
const renderNext = (row: JsonObject) =>
  row.next_action === null ? 'none' : `${row.next_action} (owner: ${row.next_owner})`

export function renderGateStatusProjectionV1(projection: unknown): string | null {
  const admission = validateGateStatusProjectionV1(projection)
  if (!admission.accepted) return null
  const value = admission.value as JsonObject
  const rows: [string, JsonObject][] = [
    ['Current exact HEAD', value.current_head as JsonObject],
    ['Final Regression', value.final_regression as JsonObject],
    ['Operational Validation', value.operational_validation as JsonObject],
    ['PR state / Draft status', value.pr_state_draft as JsonObject],
    ['Ready for Review', value.ready as JsonObject],
    ['Approve', value.approve as JsonObject],
    ['Merge', value.merge as JsonObject],
  ]
  const blocker = value.current_blocker_next_gate as JsonObject
  const blockerValue = blocker.blocker_id === null ? 'none' : String(blocker.blocker_id)
  const lines = [
    '## Gate Status',
    '',
    '> This section is the current PR Body Result-Handoff surface. Cite Issue or PR',
    '> top-level canonical records directly; do not infer completion from CI green.',
    '',
    '| Field | Current value | Canonical evidence | Next required transition |',
    '| --- | --- | --- | --- |',
    ...rows.map(([label, row]) =>
      `| ${label} | \`${row.value}\` | ${renderEvidence(row.evidence_urls)} | ${renderNext(row)} |`),
    `| Current blocking reason / next gate | \`${blockerValue}\` | ${renderEvidence(blocker.evidence_urls)} | ${renderNext(blocker)} |`,
    '',
    '### Historical evidence',
    '',
  ]
  const historical = value.historical_evidence as JsonObject[]
  if (historical.length === 0) lines.push('- none')
  else for (const item of historical) {
    lines.push(`- \`${item.head}\`: \`historical_at_prior_head\` - ${item.evidence_url}`)
  }
  return lines.join('\n')
}

type SectionInspection =
  | {
      readonly valid: true
      readonly start: number
      readonly end: number
      readonly section: string
      readonly non_gate_sha256: DigestV1
    }
  | { readonly valid: false }

export function inspectGateStatusSectionV1(body: string): SectionInspection {
  const matches = [...body.matchAll(/^## Gate Status[ \t]*$/gm)]
  if (matches.length !== 1 || matches[0].index === undefined) return { valid: false }
  const start = matches[0].index
  const afterHeading = start + matches[0][0].length
  const next = /^## (?!Gate Status(?:[ \t]*$)).+$/gm
  next.lastIndex = afterHeading
  const found = next.exec(body)
  let end = found?.index ?? body.length
  if (end > start && body[end - 1] === '\n') end -= 1
  if (end > start && body[end - 1] === '\r') end -= 1
  const section = body.slice(start, end)
  if (
    !section.includes('| Field | Current value | Canonical evidence | Next required transition |') ||
    (section.match(/^### Historical evidence[ \t]*$/gm) ?? []).length > 1
  ) return { valid: false }
  const encoder = new TextEncoder()
  const prefix = encoder.encode(body.slice(0, start))
  const suffix = encoder.encode(body.slice(end))
  const bytes = new Uint8Array(prefix.length + suffix.length)
  bytes.set(prefix)
  bytes.set(suffix, prefix.length)
  return { valid: true, start, end, section, non_gate_sha256: sha256Bytes(bytes) }
}

const validateBinding = (
  value: unknown,
  path: string,
): GateStatusAdmissionRejectionV1 | undefined => {
  if (!isObject(value)) return rejection('invalid_type_or_format', path)
  if (value.state === 'assigned') {
    const issue = exact(value, ['state', 'value'], path)
    if (issue) return issue
    return nonEmpty(value.value) ? undefined : rejection('invalid_type_or_format', `${path}/value`)
  }
  if (value.state === 'not_assigned') {
    const issue = exact(value, ['state', 'basis_url'], path)
    if (issue) return issue
    return canonicalUrl(value.basis_url)
      ? undefined
      : rejection('invalid_type_or_format', `${path}/basis_url`)
  }
  return rejection('invalid_enum', `${path}/state`)
}

const validateSnapshot = (
  value: unknown,
  path: string,
): GateStatusAdmissionRejectionV1 | undefined => {
  const issue = exact(
    value,
    [
      'contract_version',
      'source_kind',
      'pr_url',
      'pr_number',
      'head',
      'base',
      'state',
      'draft',
      'body_utf8_sha256',
      'fetched_at',
      'etag',
    ],
    path,
  )
  if (issue) return issue
  const snapshot = value as JsonObject
  if (
    snapshot.contract_version !== 'github-body-snapshot-v1' ||
    snapshot.source_kind !== 'github_pull_request' ||
    !prUrl(snapshot.pr_url) ||
    !Number.isInteger(snapshot.pr_number) ||
    Number(snapshot.pr_number) < 1 ||
    !fullSha(snapshot.head) ||
    !fullSha(snapshot.base) ||
    snapshot.state !== 'open' ||
    typeof snapshot.draft !== 'boolean' ||
    !digest(snapshot.body_utf8_sha256) ||
    !utc(snapshot.fetched_at) ||
    !isObject(snapshot.etag)
  ) return rejection('invalid_type_or_format', path)
  if (snapshot.etag.state === 'absent') return exact(snapshot.etag, ['state'], `${path}/etag`)
  if (snapshot.etag.state === 'observed_for_read_cache_only') {
    const etagIssue = exact(snapshot.etag, ['state', 'value'], `${path}/etag`)
    if (etagIssue) return etagIssue
    return nonEmpty(snapshot.etag.value)
      ? undefined
      : rejection('invalid_type_or_format', `${path}/etag/value`)
  }
  return rejection('invalid_enum', `${path}/etag/state`)
}

const roleAuthorityKinds = new Set([
  'task_assignment',
  'review_assignment',
  'validation_dispatch',
  'protected_action_authority',
])

const validateRoleAuthorityScope = (
  value: unknown,
  path: string,
): GateStatusAdmissionRejectionV1 | undefined => {
  if (!isObject(value)) return rejection('invalid_type_or_format', path)
  if (!hasOwn(value, 'scope_kind')) {
    return rejection('missing_required_field', `${path}/scope_kind`)
  }
  if (value.scope_kind === 'task_assignment') {
    const issue = exactUnknownBeforeMissing(
      value,
      ['scope_kind', 'task_assignment_url'],
      path,
    )
    if (issue) return issue
    return canonicalUrl(value.task_assignment_url)
      ? undefined
      : rejection('invalid_type_or_format', `${path}/task_assignment_url`)
  }
  if (value.scope_kind === 'review_assignment') {
    const issue = exactUnknownBeforeMissing(
      value,
      ['scope_kind', 'pr_url', 'reviewed_head', 'review_kind'],
      path,
    )
    if (issue) return issue
    if (!prUrl(value.pr_url)) return rejection('invalid_type_or_format', `${path}/pr_url`)
    if (!fullSha(value.reviewed_head)) {
      return rejection('invalid_type_or_format', `${path}/reviewed_head`)
    }
    return ['architecture_review', 'implementation_review'].includes(String(value.review_kind))
      ? undefined
      : rejection('invalid_type_or_format', `${path}/review_kind`)
  }
  if (value.scope_kind === 'validation_dispatch') {
    const issue = exactUnknownBeforeMissing(
      value,
      ['scope_kind', 'pr_url', 'validated_head', 'validation_kind'],
      path,
    )
    if (issue) return issue
    if (!prUrl(value.pr_url)) return rejection('invalid_type_or_format', `${path}/pr_url`)
    if (!fullSha(value.validated_head)) {
      return rejection('invalid_type_or_format', `${path}/validated_head`)
    }
    return ['final_regression', 'operational_validation'].includes(String(value.validation_kind))
      ? undefined
      : rejection('invalid_type_or_format', `${path}/validation_kind`)
  }
  if (value.scope_kind === 'protected_action_authority') {
    const issue = exactUnknownBeforeMissing(
      value,
      ['scope_kind', 'pr_url', 'authorized_head', 'protected_action'],
      path,
    )
    if (issue) return issue
    if (!prUrl(value.pr_url)) return rejection('invalid_type_or_format', `${path}/pr_url`)
    if (!fullSha(value.authorized_head)) {
      return rejection('invalid_type_or_format', `${path}/authorized_head`)
    }
    return protectedActions.has(String(value.protected_action))
      ? undefined
      : rejection('invalid_type_or_format', `${path}/protected_action`)
  }
  return rejection('invalid_enum', `${path}/scope_kind`)
}

const validateRoleAuthorityRecord = (
  value: unknown,
  path: string,
): GateStatusAdmissionRejectionV1 | undefined => {
  const issue = exactUnknownBeforeMissing(
    value,
    [
      'authority_class',
      'authority_kind',
      'canonical_url',
      'source_record_url',
      'issuer_role',
      'authorized_role',
      'task_id',
      'assignment_revision',
      'repository',
      'scope',
      'fetched_content_sha256',
      'content_projection_sha256',
      'verification_state',
    ],
    path,
  )
  if (issue) return issue
  const record = value as JsonObject
  if (
    record.authority_class !== 'admitted_role_authority' ||
    typeof record.authority_kind !== 'string' ||
    !roleAuthorityKinds.has(record.authority_kind) ||
    !canonicalUrl(record.canonical_url) ||
    !canonicalUrl(record.source_record_url) ||
    !role(record.issuer_role) ||
    !role(record.authorized_role) ||
    !nonEmpty(record.task_id) ||
    !Number.isInteger(record.assignment_revision) ||
    Number(record.assignment_revision) < 1 ||
    record.repository !== 'whatrune/sd-prompt-studio' ||
    !digest(record.fetched_content_sha256) ||
    !digest(record.content_projection_sha256) ||
    record.verification_state !== 'verified'
  ) return rejection('invalid_type_or_format', path)
  if (
    isObject(record.scope) &&
    typeof record.scope.scope_kind === 'string' &&
    record.authority_kind !== record.scope.scope_kind
  ) {
    return rejection('invalid_conditional_matrix', `${path}/scope/scope_kind`)
  }
  const scopeIssue = validateRoleAuthorityScope(record.scope, `${path}/scope`)
  if (scopeIssue) return scopeIssue
  if (
    record.authority_kind === 'protected_action_authority'
      ? record.issuer_role !== 'product_owner'
      : !['integrated_lead', 'product_owner'].includes(String(record.issuer_role))
  ) return rejection('invalid_conditional_matrix', `${path}/issuer_role`)
  return undefined
}

export function validateGateStatusRoleAuthoritySetV1(
  input: unknown,
): GateStatusAdmissionResultV1<GateStatusRoleAuthoritySetV1> {
  try {
    const issue = exactUnknownBeforeMissing(
      input,
      ['contract_version', 'task_id', 'assignment_revision', 'repository', 'records'],
      '',
    )
    if (issue) return rejected(issue)
    const value = input as JsonObject
    if (
      value.contract_version !== GATE_STATUS_ROLE_AUTHORITY_SET_V1 ||
      !nonEmpty(value.task_id) ||
      !Number.isInteger(value.assignment_revision) ||
      Number(value.assignment_revision) < 1 ||
      value.repository !== 'whatrune/sd-prompt-studio' ||
      !Array.isArray(value.records)
    ) return rejected(rejection('invalid_type_or_format', ''))
    const urls: string[] = []
    const semantic = new Set<string>()
    for (let index = 0; index < value.records.length; index += 1) {
      const memberIssue = validateRoleAuthorityRecord(
        value.records[index],
        `/records/${index}`,
      )
      if (memberIssue) return rejected(memberIssue)
      const record = value.records[index] as JsonObject
      const url = String(record.canonical_url)
      if (urls.includes(url)) {
        return rejected(rejection('duplicate_set_member', `/records/${index}/canonical_url`))
      }
      if (urls.length > 0 && byteCompare(urls[urls.length - 1], url) >= 0) {
        return rejected(rejection('noncanonical_set_order', `/records/${index}/canonical_url`))
      }
      urls.push(url)
      const identity = canonicalize({
        authority_kind: record.authority_kind,
        source_record_url: record.source_record_url,
        scope: record.scope,
      })
      if (semantic.has(identity)) {
        return rejected(rejection('duplicate_set_member', `/records/${index}`))
      }
      semantic.add(identity)
    }
    return accepted(value)
  } catch {
    return rejected(rejection('invalid_type_or_format', ''))
  }
}

const canonicalEvidenceKinds = new Set([
  'task_assignment',
  'result_handoff',
  'review_decision',
  'final_regression_result',
  'operational_validation_result',
  'product_owner_approval',
  'protected_action_completion',
  'projection_authorization',
])
const authorityBoundEvidenceKinds = new Set([
  'task_assignment',
  'result_handoff',
  'review_decision',
  'final_regression_result',
  'operational_validation_result',
  'protected_action_completion',
])

const validateEvidence = (
  value: unknown,
  path: string,
): GateStatusAdmissionRejectionV1 | undefined => {
  if (!isObject(value)) return rejection('invalid_type_or_format', path)
  if (!hasOwn(value, 'evidence_class')) {
    return rejection('missing_required_field', `${path}/evidence_class`)
  }
  if (!hasOwn(value, 'evidence_kind')) {
    return rejection('missing_required_field', `${path}/evidence_kind`)
  }
  if (!['canonical_role_record', 'github_mutable_evidence'].includes(String(value.evidence_class))) {
    return rejection('invalid_enum', `${path}/evidence_class`)
  }
  if (
    typeof value.evidence_kind !== 'string' ||
    !canonicalEvidenceKinds.has(value.evidence_kind) &&
      !['github_check', 'review_thread'].includes(value.evidence_kind)
  ) return rejection('invalid_enum', `${path}/evidence_kind`)

  if (value.evidence_class === 'canonical_role_record' &&
      typeof value.evidence_kind === 'string' &&
      canonicalEvidenceKinds.has(value.evidence_kind)) {
    const fields = [
      'evidence_class',
      'evidence_kind',
      'canonical_url',
      'authoring_role',
      'task_id',
      'repository',
      'head_binding',
      'fetched_content_sha256',
      'content_projection_sha256',
      'verification_state',
    ]
    if (authorityBoundEvidenceKinds.has(value.evidence_kind)) {
      fields.splice(7, 0, 'author_role_authority_ref')
      if (value.evidence_kind === 'protected_action_completion') {
        fields.splice(8, 0, 'protected_action')
      }
    }
    const issue = exactUnknownBeforeMissing(
      value,
      fields,
      path,
    )
    if (issue) return issue
    if (
      typeof value.evidence_kind !== 'string' ||
      !canonicalEvidenceKinds.has(value.evidence_kind) ||
      !canonicalUrl(value.canonical_url) ||
      !role(value.authoring_role) ||
      !nonEmpty(value.task_id) ||
      value.repository !== 'whatrune/sd-prompt-studio' ||
      !digest(value.fetched_content_sha256) ||
      !digest(value.content_projection_sha256) ||
      value.verification_state !== 'verified' ||
      !isObject(value.head_binding)
    ) return rejection('invalid_type_or_format', path)
    if (
      authorityBoundEvidenceKinds.has(value.evidence_kind) &&
      !canonicalUrl(value.author_role_authority_ref)
    ) return rejection('invalid_type_or_format', `${path}/author_role_authority_ref`)
    if (
      value.evidence_kind === 'protected_action_completion' &&
      !protectedActions.has(String(value.protected_action))
    ) return rejection('invalid_enum', `${path}/protected_action`)
    const binding = value.head_binding
    if (binding.state === 'current' || binding.state === 'historical') {
      const bindingIssue = exact(binding, ['state', 'head'], `${path}/head_binding`)
      if (bindingIssue) return bindingIssue
      if (!fullSha(binding.head)) {
        return rejection('invalid_type_or_format', `${path}/head_binding/head`)
      }
      if (['task_assignment', 'projection_authorization'].includes(String(value.evidence_kind))) {
        return rejection('invalid_conditional_matrix', `${path}/head_binding/state`)
      }
      return undefined
    }
    if (binding.state === 'not_head_bound') {
      const bindingIssue = exact(binding, ['state', 'basis_url'], `${path}/head_binding`)
      if (bindingIssue) return bindingIssue
      if (!canonicalUrl(binding.basis_url)) {
        return rejection('invalid_type_or_format', `${path}/head_binding/basis_url`)
      }
      if (!['task_assignment', 'projection_authorization'].includes(String(value.evidence_kind))) {
        return rejection('invalid_conditional_matrix', `${path}/head_binding/state`)
      }
      if (
        value.evidence_kind === 'projection_authorization' &&
        binding.basis_url !== value.canonical_url
      ) return rejection('invalid_cross_input_binding', `${path}/head_binding/basis_url`)
      return undefined
    }
    return rejection('invalid_enum', `${path}/head_binding/state`)
  }
  if (value.evidence_class === 'github_mutable_evidence' && value.evidence_kind === 'github_check') {
    const issue = exactUnknownBeforeMissing(
      value,
      [
        'evidence_class',
        'evidence_kind',
        'canonical_url',
        'repository',
        'pr_url',
        'checked_head',
        'name',
        'conclusion',
        'producer',
        'started_at',
        'completed_at',
        'fetched_content_sha256',
        'content_projection_sha256',
        'verification_state',
      ],
      path,
    )
    if (issue) return issue
    if (
      !canonicalUrl(value.canonical_url) ||
      value.repository !== 'whatrune/sd-prompt-studio' ||
      !prUrl(value.pr_url) ||
      !fullSha(value.checked_head) ||
      !nonEmpty(value.name) ||
      !['success', 'failure', 'pending', 'cancelled'].includes(String(value.conclusion)) ||
      !isObject(value.producer) ||
      !digest(value.fetched_content_sha256) ||
      !digest(value.content_projection_sha256) ||
      value.verification_state !== 'verified'
    ) return rejection('invalid_type_or_format', path)
    const producerIssue = exact(value.producer, ['kind', 'login', 'database_id'], `${path}/producer`)
    if (producerIssue) return producerIssue
    if (!(
      ['github_app', 'github_user'].includes(String(value.producer.kind)) &&
      nonEmpty(value.producer.login) &&
      Number.isInteger(value.producer.database_id) &&
      Number(value.producer.database_id) > 0
    )) return rejection('invalid_type_or_format', `${path}/producer`)
    if (value.conclusion === 'pending') {
      return (value.started_at === null || utc(value.started_at)) && value.completed_at === null
        ? undefined
        : rejection('invalid_conditional_matrix', path)
    }
    return utc(value.started_at) &&
      utc(value.completed_at) &&
      Date.parse(value.started_at) <= Date.parse(value.completed_at)
      ? undefined
      : rejection('invalid_conditional_matrix', path)
  }
  if (value.evidence_class === 'github_mutable_evidence' && value.evidence_kind === 'review_thread') {
    const issue = exactUnknownBeforeMissing(
      value,
      [
        'evidence_class',
        'evidence_kind',
        'canonical_url',
        'repository',
        'pr_url',
        'observed_head',
        'state',
        'outdated',
        'blocking',
        'fetched_content_sha256',
        'content_projection_sha256',
        'verification_state',
      ],
      path,
    )
    if (issue) return issue
    return canonicalUrl(value.canonical_url) &&
      value.repository === 'whatrune/sd-prompt-studio' &&
      prUrl(value.pr_url) &&
      fullSha(value.observed_head) &&
      ['resolved', 'unresolved'].includes(String(value.state)) &&
      typeof value.outdated === 'boolean' &&
      typeof value.blocking === 'boolean' &&
      digest(value.fetched_content_sha256) &&
      digest(value.content_projection_sha256) &&
      value.verification_state === 'verified'
      ? undefined
      : rejection('invalid_type_or_format', path)
  }
  return rejection('invalid_enum', `${path}/evidence_kind`)
}

const ordinaryCanonicalKinds = new Set([
  'task_assignment',
  'result_handoff',
  'review_decision',
  'final_regression_result',
  'operational_validation_result',
  'product_owner_approval',
  'protected_action_completion',
])

const firstYamlAuthority = (body: string): JsonObject | null => {
  const match = /^```yaml\r?\n([\s\S]*?)\r?\n```[ \t]*$/m.exec(body)
  if (!match) return null
  const source = match[1]
  if (
    /(^|[\s[{,])(?:&|\*)[A-Za-z0-9_-]+/m.test(source) ||
    /(^|\s)!(?:<[^>]+>|[A-Za-z])/m.test(source) ||
    /^\s*<<\s*:/m.test(source)
  ) return null
  try {
    const document = parseDocument(source, {
      uniqueKeys: true,
      strict: true,
    })
    if (document.errors.length > 0 || document.warnings.length > 0) return null
    const value: unknown = document.toJS({ maxAliasCount: 0 })
    return isObject(value) ? value : null
  } catch {
    return null
  }
}

const validateHeadBindingValue = (
  value: unknown,
  path: string,
): GateStatusAdmissionRejectionV1 | undefined => {
  if (!isObject(value)) return rejection('invalid_type_or_format', path)
  if (value.state === 'current' || value.state === 'historical') {
    const issue = exact(value, ['state', 'head'], path)
    if (issue) return issue
    return fullSha(value.head) ? undefined : rejection('invalid_type_or_format', `${path}/head`)
  }
  if (value.state === 'not_head_bound') {
    const issue = exact(value, ['state', 'basis_url'], path)
    if (issue) return issue
    return canonicalUrl(value.basis_url)
      ? undefined
      : rejection('invalid_type_or_format', `${path}/basis_url`)
  }
  return rejection('invalid_enum', `${path}/state`)
}

const validateOrdinaryCanonicalContent = (
  content: unknown,
): GateStatusAdmissionRejectionV1 | undefined => {
  if (!isObject(content) || typeof content.evidence_kind !== 'string') {
    return rejection('invalid_type_or_format', '')
  }
  const fields = [
    'contract_version',
    'evidence_class',
    'evidence_kind',
    'canonical_url',
    'source_record_url',
    'authoring_role',
    'task_id',
    'repository',
    'head_binding',
  ]
  if (authorityBoundEvidenceKinds.has(content.evidence_kind)) {
    fields.push('author_role_authority_ref')
    if (content.evidence_kind === 'protected_action_completion') {
      fields.push('protected_action')
    }
  }
  fields.push('verification_state')
  const issue = exactUnknownBeforeMissing(content, fields, '')
  if (issue) return issue
  const value = content as JsonObject
  if (
    value.contract_version !== 'gate-status-canonical-role-evidence-content-v1' ||
    value.evidence_class !== 'canonical_role_record' ||
    typeof value.evidence_kind !== 'string' ||
    !ordinaryCanonicalKinds.has(value.evidence_kind) ||
    !canonicalUrl(value.canonical_url) ||
    !canonicalUrl(value.source_record_url) ||
    !role(value.authoring_role) ||
    !nonEmpty(value.task_id) ||
    value.repository !== 'whatrune/sd-prompt-studio' ||
    value.verification_state !== 'verified'
  ) return rejection('invalid_type_or_format', '')
  if (
    authorityBoundEvidenceKinds.has(String(value.evidence_kind)) &&
    !canonicalUrl(value.author_role_authority_ref)
  ) return rejection('invalid_type_or_format', '/author_role_authority_ref')
  if (
    value.evidence_kind === 'protected_action_completion' &&
    !protectedActions.has(String(value.protected_action))
  ) return rejection('invalid_enum', '/protected_action')
  return validateHeadBindingValue(value.head_binding, '/head_binding')
}

type DirectEvidenceWrapperAdmission =
  | {
      readonly accepted: true
      readonly binding: Readonly<JsonObject>
      readonly semantics: Readonly<JsonObject> | null
    }
  | { readonly accepted: false; readonly path: string }

const validateDirectEvidenceSemantics = (
  semantics: unknown,
  binding: JsonObject,
): GateStatusAdmissionRejectionV1 | undefined => {
  if (!isObject(semantics)) {
    return rejection('invalid_type_or_format', '/gate_status_evidence_semantics')
  }
  const common = [
    'contract_version',
    'semantic_branch',
    'evidence_kind',
    'canonical_url',
    'task_id',
    'repository',
    'head_binding',
  ]
  const branch = String(semantics.semantic_branch)
  const branchFields =
    branch === 'validation_result'
      ? ['validation_kind', 'validated_head', 'result', 'blocking_finding_count']
      : branch === 'protected_action_result'
        ? ['protected_action', 'action_head', 'action_result', 'blocking_finding_count']
        : branch === 'blocker_transition'
          ? ['blocker_id', 'next_action', 'next_owner', 'blocking_finding_count']
          : []
  if (branchFields.length === 0) {
    return rejection('invalid_enum', '/gate_status_evidence_semantics/semantic_branch')
  }
  const issue = exactUnknownBeforeMissing(
    semantics,
    [...common, ...branchFields],
    '/gate_status_evidence_semantics',
  )
  if (issue) return issue
  if (
    semantics.contract_version !== 'gate-status-direct-evidence-semantics-v1' ||
    semantics.evidence_kind !== binding.evidence_kind
  ) {
    return rejection(
      'invalid_cross_input_binding',
      '/gate_status_evidence_semantics/evidence_kind',
    )
  }
  if (
    semantics.evidence_kind === 'final_regression_completion' ||
    semantics.evidence_kind === 'operational_validation_completion'
  ) {
    return rejection('invalid_enum', '/gate_status_evidence_semantics/evidence_kind')
  }
  if (
    semantics.canonical_url !== binding.canonical_url ||
    semantics.task_id !== binding.task_id ||
    semantics.repository !== binding.repository ||
    !isObject(semantics.head_binding) ||
    semantics.head_binding.state !== 'current' ||
    canonicalize(semantics.head_binding) !== canonicalize(binding.head_binding)
  ) {
    return rejection(
      'invalid_cross_input_binding',
      '/gate_status_evidence_semantics/head_binding',
    )
  }
  const head = semantics.head_binding.head
  if (!fullSha(head)) {
    return rejection(
      'invalid_type_or_format',
      '/gate_status_evidence_semantics/head_binding/head',
    )
  }
  if (branch === 'validation_result') {
    const kind = String(semantics.evidence_kind)
    const validationKind = String(semantics.validation_kind)
    if (!['final_regression_result', 'operational_validation_result'].includes(kind)) {
      return rejection('invalid_enum', '/gate_status_evidence_semantics/evidence_kind')
    }
    if (
      (kind === 'final_regression_result' && validationKind !== 'final_regression') ||
      (kind === 'operational_validation_result' &&
        validationKind !== 'operational_validation')
    ) {
      return rejection(
        'invalid_cross_input_binding',
        '/gate_status_evidence_semantics/validation_kind',
      )
    }
    if (semantics.validated_head !== head) {
      return rejection(
        'invalid_cross_input_binding',
        '/gate_status_evidence_semantics/validated_head',
      )
    }
    if (
      !['PASS', 'BLOCKED'].includes(String(semantics.result)) ||
      !Number.isInteger(semantics.blocking_finding_count) ||
      Number(semantics.blocking_finding_count) < 0 ||
      (semantics.result === 'PASS' && semantics.blocking_finding_count !== 0) ||
      (semantics.result === 'BLOCKED' && Number(semantics.blocking_finding_count) < 1)
    ) {
      return rejection(
        'invalid_conditional_matrix',
        '/gate_status_evidence_semantics/blocking_finding_count',
      )
    }
    return undefined
  }
  if (branch === 'protected_action_result') {
    if (semantics.evidence_kind !== 'protected_action_completion') {
      return rejection('invalid_enum', '/gate_status_evidence_semantics/evidence_kind')
    }
    if (
      !protectedActions.has(String(semantics.protected_action)) ||
      semantics.protected_action !== binding.protected_action
    ) {
      return rejection(
        'invalid_cross_input_binding',
        '/gate_status_evidence_semantics/protected_action',
      )
    }
    if (semantics.action_head !== head) {
      return rejection(
        'invalid_cross_input_binding',
        '/gate_status_evidence_semantics/action_head',
      )
    }
    if (
      !['completed', 'blocked'].includes(String(semantics.action_result)) ||
      !Number.isInteger(semantics.blocking_finding_count) ||
      Number(semantics.blocking_finding_count) < 0 ||
      (semantics.action_result === 'completed' &&
        semantics.blocking_finding_count !== 0) ||
      (semantics.action_result === 'blocked' &&
        Number(semantics.blocking_finding_count) < 1)
    ) {
      return rejection(
        'invalid_conditional_matrix',
        '/gate_status_evidence_semantics/blocking_finding_count',
      )
    }
    return undefined
  }
  if (!['review_decision', 'result_handoff'].includes(String(semantics.evidence_kind))) {
    return rejection('invalid_enum', '/gate_status_evidence_semantics/evidence_kind')
  }
  if (
    !(semantics.blocker_id === null || action(semantics.blocker_id)) ||
    !(semantics.next_action === null || action(semantics.next_action)) ||
    !(semantics.next_owner === null || role(semantics.next_owner)) ||
    (semantics.next_action === null) !== (semantics.next_owner === null) ||
    (
      semantics.blocker_id === null &&
      semantics.next_action === null &&
      semantics.next_owner === null
    ) ||
    !Number.isInteger(semantics.blocking_finding_count) ||
    Number(semantics.blocking_finding_count) < 0 ||
    (semantics.blocker_id === null && semantics.blocking_finding_count !== 0) ||
    (semantics.blocker_id !== null && Number(semantics.blocking_finding_count) < 1)
  ) {
    return rejection(
      'invalid_conditional_matrix',
      '/gate_status_evidence_semantics/blocker_id',
    )
  }
  return undefined
}

const admitDirectEvidenceWrapper = (
  body: string,
): DirectEvidenceWrapperAdmission => {
  const wrapper = firstYamlAuthority(body)
  if (!wrapper) return { accepted: false, path: '' }
  const keys = Object.keys(wrapper)
  const expected =
    keys.length === 1
      ? ['gate_status_evidence_binding']
      : ['gate_status_evidence_binding', 'gate_status_evidence_semantics']
  if (
    keys.length !== expected.length ||
    keys.some((key, index) => key !== expected[index]) ||
    !isObject(wrapper.gate_status_evidence_binding)
  ) return { accepted: false, path: '' }
  const binding = wrapper.gate_status_evidence_binding
  const bindingIssue = validateOrdinaryCanonicalContent(binding)
  if (bindingIssue) return { accepted: false, path: bindingIssue.path }
  if (!hasOwn(wrapper, 'gate_status_evidence_semantics')) {
    return { accepted: true, binding, semantics: null }
  }
  const semanticIssue = validateDirectEvidenceSemantics(
    wrapper.gate_status_evidence_semantics,
    binding,
  )
  if (semanticIssue) return { accepted: false, path: semanticIssue.path }
  return {
    accepted: true,
    binding,
    semantics: wrapper.gate_status_evidence_semantics as JsonObject,
  }
}

const roleAuthorityContentFields = [
  'contract_version',
  'authority_class',
  'authority_kind',
  'canonical_url',
  'source_record_url',
  'issuer_role',
  'authorized_role',
  'task_id',
  'assignment_revision',
  'repository',
  'scope',
  'verification_state',
] as const

const validateRoleAuthorityContent = (
  content: unknown,
): GateStatusAdmissionRejectionV1 | undefined => {
  const issue = exactUnknownBeforeMissing(content, roleAuthorityContentFields, '')
  if (issue) return issue
  const value = content as JsonObject
  const invalidFields: readonly [boolean, string][] = [
    [value.contract_version !== 'gate-status-role-authority-content-v1', '/contract_version'],
    [value.authority_class !== 'admitted_role_authority', '/authority_class'],
    [
      typeof value.authority_kind !== 'string' ||
        !roleAuthorityKinds.has(String(value.authority_kind)),
      '/authority_kind',
    ],
    [!canonicalUrl(value.canonical_url), '/canonical_url'],
    [!canonicalUrl(value.source_record_url), '/source_record_url'],
    [!role(value.issuer_role), '/issuer_role'],
    [!role(value.authorized_role), '/authorized_role'],
    [!nonEmpty(value.task_id), '/task_id'],
    [
      !Number.isInteger(value.assignment_revision) ||
        Number(value.assignment_revision) < 1,
      '/assignment_revision',
    ],
    [value.repository !== 'whatrune/sd-prompt-studio', '/repository'],
    [value.verification_state !== 'verified', '/verification_state'],
  ]
  const invalidField = invalidFields.find(([invalid]) => invalid)
  if (invalidField) return rejection('invalid_type_or_format', invalidField[1])
  if (
    isObject(value.scope) &&
    typeof value.scope.scope_kind === 'string' &&
    value.scope.scope_kind !== value.authority_kind
  ) return rejection('invalid_conditional_matrix', '/scope/scope_kind')
  const scopeIssue = validateRoleAuthorityScope(value.scope, '/scope')
  if (scopeIssue) return scopeIssue
  if (
    value.authority_kind === 'protected_action_authority'
      ? value.issuer_role !== 'product_owner'
      : !['integrated_lead', 'product_owner'].includes(String(value.issuer_role))
  ) return rejection('invalid_conditional_matrix', '/issuer_role')
  return undefined
}

type RoleAuthorityMemberAdmission =
  | {
      readonly state: 'valid'
      readonly value: JsonObject
      readonly semantic_identity: string
    }
  | { readonly state: 'invalid'; readonly path: string }
  | { readonly state: 'unavailable'; readonly path: string }

const admitRoleAuthorityRead = (
  result: unknown,
  record: JsonObject,
): RoleAuthorityMemberAdmission => {
  if (canonicalReadUnavailable(result)) return { state: 'unavailable', path: '' }
  if (
    !isObject(result) ||
    exactUnknownBeforeMissing(
      result,
      [
        'state',
        'source_kind',
        'canonical_url',
        'body_utf8',
        'fetched_content_sha256',
        'content',
        'content_projection_sha256',
      ],
      '',
    ) !== undefined ||
    result.state !== 'available' ||
    result.source_kind !== 'canonical_body' ||
    result.canonical_url !== record.canonical_url ||
    typeof result.body_utf8 !== 'string'
  ) return { state: 'invalid', path: '' }
  if (
    sha256Utf8(result.body_utf8) !== result.fetched_content_sha256 ||
    result.fetched_content_sha256 !== record.fetched_content_sha256
  ) return { state: 'invalid', path: '/fetched_content_sha256' }
  const authority = firstYamlAuthority(result.body_utf8)
  if (
    !authority ||
    exactUnknownBeforeMissing(authority, ['gate_status_role_authority_binding'], '') !==
      undefined ||
    !isObject(authority.gate_status_role_authority_binding)
  ) return { state: 'invalid', path: '' }
  const reconstructed = authority.gate_status_role_authority_binding
  const contentIssue = validateRoleAuthorityContent(reconstructed)
  if (contentIssue) {
    return {
      state: 'invalid',
      path: Object.keys(reconstructed).length === 0 ? '' : contentIssue.path,
    }
  }
  const reconstructedDigest = gateStatusJcsSha256V1(reconstructed)
  if (
    reconstructedDigest !== result.content_projection_sha256 ||
    reconstructedDigest !== record.content_projection_sha256
  ) return { state: 'invalid', path: '/content_projection_sha256' }
  if (canonicalize(reconstructed) !== canonicalize(result.content)) {
    return { state: 'invalid', path: '' }
  }
  const publicProjection = { ...reconstructed }
  delete publicProjection.contract_version
  publicProjection.fetched_content_sha256 = record.fetched_content_sha256
  publicProjection.content_projection_sha256 = record.content_projection_sha256
  const claimed = { ...record }
  if (canonicalize(publicProjection) !== canonicalize(claimed)) {
    for (const key of roleAuthorityContentFields) {
      if (
        key !== 'contract_version' &&
        canonicalize(reconstructed[key]) !== canonicalize(record[key])
      ) {
        if (key === 'scope' && isObject(reconstructed.scope) && isObject(record.scope)) {
          const reconstructedScope = reconstructed.scope
          const recordScope = record.scope
          const scopeKeys = [
            ...new Set([
              ...Object.keys(reconstructedScope),
              ...Object.keys(recordScope),
            ]),
          ].sort(byteCompare)
          const differingScopeKey = scopeKeys.find((scopeKey) =>
            !sameJsonMember(reconstructedScope, recordScope, scopeKey))
          if (differingScopeKey !== undefined) {
            return { state: 'invalid', path: `/scope/${differingScopeKey}` }
          }
        }
        return { state: 'invalid', path: `/${key}` }
      }
    }
    return { state: 'invalid', path: '' }
  }
  return {
    state: 'valid',
    value: reconstructed,
    semantic_identity: canonicalize({
      authority_kind: reconstructed.authority_kind,
      source_record_url: reconstructed.source_record_url,
      scope: reconstructed.scope,
    }),
  }
}

const projectionAuthorizationSourceFields = [
  'task_id',
  'implementation_phase_id',
  'record_type',
  'canonical_task',
  'authoring_role',
  'assigned_role',
  'authority_main_full_head_sha',
  'freeze_candidate',
  'cumulative_amendment_001',
  'cumulative_amendment_002',
  'cumulative_amendment_003',
  'cumulative_amendment_004',
  'architecture_review_decision',
  'architecture_review_decision_value',
  'architecture_review_blocking_finding_count',
  'implementation_resume_allowed',
  'new_task_allowed',
  'new_task_branch_allowed',
  'new_task_worktree_allowed',
  'draft_pr_allowed_after_validation_pass',
  'ready_allowed',
  'approve_allowed',
  'merge_allowed',
] as const

const projectionAuthorizationContentFields = [
  'contract_version',
  'canonical_url',
  'task_id',
  'implementation_phase_id',
  'record_type',
  'canonical_task',
  'record_authoring_role',
  'assigned_role',
  'authority_main_full_head_sha',
  'freeze_candidate',
  'cumulative_amendment_001',
  'cumulative_amendment_002',
  'cumulative_amendment_003',
  'cumulative_amendment_004',
  'architecture_review_decision',
  'architecture_review_decision_value',
  'architecture_review_blocking_finding_count',
  'implementation_resume_allowed',
  'new_task_allowed',
  'new_task_branch_allowed',
  'new_task_worktree_allowed',
  'draft_pr_allowed_after_validation_pass',
  'ready_allowed',
  'approve_allowed',
  'merge_allowed',
] as const

const reconstructProjectionAuthorizationContent = (
  body: string,
  canonicalUrlValue: string,
): JsonObject | null => {
  const authority = firstYamlAuthority(body)
  if (!authority) return null
  if (
    exact(authority, ['gate_status_evidence_binding'], '') === undefined &&
    isObject(authority.gate_status_evidence_binding)
  ) {
    const boundContent = authority.gate_status_evidence_binding
    return (
      exact(boundContent, projectionAuthorizationContentFields, '') === undefined &&
      boundContent.contract_version ===
        'gate-status-projection-authorization-source-content-v1' &&
      boundContent.canonical_url === canonicalUrlValue &&
      boundContent.task_id === 'DESIGN-GATE-STATUS-PUBLISHER-CONTRACT-001' &&
      boundContent.implementation_phase_id === 'IMPLEMENT-GATE-STATUS-PUBLISHER-V1-001' &&
      boundContent.record_type === 'same_task_implementation_resume_dispatch' &&
      canonicalUrl(boundContent.canonical_task) &&
      boundContent.record_authoring_role === 'integrated_lead' &&
      boundContent.assigned_role === 'backend_implementer' &&
      fullSha(boundContent.authority_main_full_head_sha) &&
      canonicalUrl(boundContent.freeze_candidate) &&
      canonicalUrl(boundContent.cumulative_amendment_001) &&
      canonicalUrl(boundContent.cumulative_amendment_002) &&
      canonicalUrl(boundContent.cumulative_amendment_003) &&
      canonicalUrl(boundContent.cumulative_amendment_004) &&
      canonicalUrl(boundContent.architecture_review_decision) &&
      boundContent.architecture_review_decision_value === 'APPROVE' &&
      boundContent.architecture_review_blocking_finding_count === 0 &&
      boundContent.implementation_resume_allowed === true &&
      boundContent.new_task_allowed === false &&
      boundContent.new_task_branch_allowed === true &&
      boundContent.new_task_worktree_allowed === true &&
      boundContent.draft_pr_allowed_after_validation_pass === true &&
      boundContent.ready_allowed === false &&
      boundContent.approve_allowed === false &&
      boundContent.merge_allowed === false
    ) ? boundContent : null
  }
  if (exact(authority, projectionAuthorizationSourceFields, '') !== undefined) {
    return null
  }
  if (
    authority.authoring_role !== 'Integrated Lead' ||
    authority.assigned_role !== 'Backend Implementer'
  ) return null
  const content = {
    contract_version: 'gate-status-projection-authorization-source-content-v1',
    canonical_url: canonicalUrlValue,
    task_id: authority.task_id,
    implementation_phase_id: authority.implementation_phase_id,
    record_type: authority.record_type,
    canonical_task: authority.canonical_task,
    record_authoring_role: 'integrated_lead',
    assigned_role: 'backend_implementer',
    authority_main_full_head_sha: authority.authority_main_full_head_sha,
    freeze_candidate: authority.freeze_candidate,
    cumulative_amendment_001: authority.cumulative_amendment_001,
    cumulative_amendment_002: authority.cumulative_amendment_002,
    cumulative_amendment_003: authority.cumulative_amendment_003,
    cumulative_amendment_004: authority.cumulative_amendment_004,
    architecture_review_decision: authority.architecture_review_decision,
    architecture_review_decision_value: authority.architecture_review_decision_value,
    architecture_review_blocking_finding_count:
      authority.architecture_review_blocking_finding_count,
    implementation_resume_allowed: authority.implementation_resume_allowed,
    new_task_allowed: authority.new_task_allowed,
    new_task_branch_allowed: authority.new_task_branch_allowed,
    new_task_worktree_allowed: authority.new_task_worktree_allowed,
    draft_pr_allowed_after_validation_pass: authority.draft_pr_allowed_after_validation_pass,
    ready_allowed: authority.ready_allowed,
    approve_allowed: authority.approve_allowed,
    merge_allowed: authority.merge_allowed,
  }
  return (
    content.task_id === 'DESIGN-GATE-STATUS-PUBLISHER-CONTRACT-001' &&
    content.implementation_phase_id === 'IMPLEMENT-GATE-STATUS-PUBLISHER-V1-001' &&
    content.record_type === 'same_task_implementation_resume_dispatch' &&
    content.canonical_task === 'https://github.com/whatrune/sd-prompt-studio/issues/206' &&
    fullSha(content.authority_main_full_head_sha) &&
    canonicalUrl(content.freeze_candidate) &&
    canonicalUrl(content.cumulative_amendment_001) &&
    canonicalUrl(content.cumulative_amendment_002) &&
    canonicalUrl(content.cumulative_amendment_003) &&
    canonicalUrl(content.cumulative_amendment_004) &&
    canonicalUrl(content.architecture_review_decision) &&
    content.architecture_review_decision_value === 'APPROVE' &&
    content.architecture_review_blocking_finding_count === 0 &&
    content.implementation_resume_allowed === true &&
    content.new_task_allowed === false &&
    content.new_task_branch_allowed === true &&
    content.new_task_worktree_allowed === true &&
    content.draft_pr_allowed_after_validation_pass === true &&
    content.ready_allowed === false &&
    content.approve_allowed === false &&
    content.merge_allowed === false
  ) ? content : null
}

const githubCheckSourceFields = [
  'contract_version',
  'canonical_url',
  'repository',
  'pr_url',
  'checked_head',
  'name',
  'conclusion',
  'producer',
  'started_at',
  'completed_at',
] as const

const githubThreadSourceFields = [
  'contract_version',
  'canonical_url',
  'repository',
  'pr_url',
  'observed_head',
  'state',
  'outdated',
  'blocking',
] as const

const validateGitHubCheckSource = (
  source: unknown,
): GateStatusAdmissionRejectionV1 | undefined => {
  const issue = exact(source, githubCheckSourceFields, '')
  if (issue) return issue
  const value = source as JsonObject
  const producerIssue = exact(value.producer, ['kind', 'login', 'database_id'], '/producer')
  if (producerIssue) return producerIssue
  const producer = value.producer as JsonObject
  if (
    value.contract_version !== 'gate-status-github-check-source-v1' ||
    !canonicalUrl(value.canonical_url) ||
    value.repository !== 'whatrune/sd-prompt-studio' ||
    !prUrl(value.pr_url) ||
    !fullSha(value.checked_head) ||
    !nonEmpty(value.name) ||
    !['success', 'failure', 'pending', 'cancelled'].includes(String(value.conclusion)) ||
    !['github_app', 'github_user'].includes(String(producer.kind)) ||
    !nonEmpty(producer.login) ||
    !Number.isInteger(producer.database_id) ||
    Number(producer.database_id) < 1
  ) return rejection('invalid_type_or_format', '')
  if (value.conclusion === 'pending') {
    return (value.started_at === null || utc(value.started_at)) && value.completed_at === null
      ? undefined
      : rejection('invalid_conditional_matrix', '')
  }
  return utc(value.started_at) &&
    utc(value.completed_at) &&
    Date.parse(value.started_at) <= Date.parse(value.completed_at)
    ? undefined
    : rejection('invalid_conditional_matrix', '')
}

const validateGitHubThreadSource = (
  source: unknown,
): GateStatusAdmissionRejectionV1 | undefined => {
  const issue = exact(source, githubThreadSourceFields, '')
  if (issue) return issue
  const value = source as JsonObject
  return value.contract_version === 'gate-status-github-review-thread-source-v1' &&
    canonicalUrl(value.canonical_url) &&
    value.repository === 'whatrune/sd-prompt-studio' &&
    prUrl(value.pr_url) &&
    fullSha(value.observed_head) &&
    ['resolved', 'unresolved'].includes(String(value.state)) &&
    typeof value.outdated === 'boolean' &&
    typeof value.blocking === 'boolean'
    ? undefined
    : rejection('invalid_type_or_format', '')
}

const checkContentFromSource = (source: JsonObject) => ({
  contract_version: 'gate-status-github-check-content-v1',
  evidence_class: 'github_mutable_evidence',
  evidence_kind: 'github_check',
  canonical_url: source.canonical_url,
  repository: source.repository,
  pr_url: source.pr_url,
  checked_head: source.checked_head,
  name: source.name,
  conclusion: source.conclusion,
  producer: source.producer,
  started_at: source.started_at,
  completed_at: source.completed_at,
  verification_state: 'verified',
})

const threadContentFromSource = (source: JsonObject) => ({
  contract_version: 'gate-status-github-review-thread-content-v1',
  evidence_class: 'github_mutable_evidence',
  evidence_kind: 'review_thread',
  canonical_url: source.canonical_url,
  repository: source.repository,
  pr_url: source.pr_url,
  observed_head: source.observed_head,
  state: source.state,
  outdated: source.outdated,
  blocking: source.blocking,
  verification_state: 'verified',
})

type EvidenceMemberAdmission =
  | {
      readonly state: 'valid'
      readonly authority_identity: string
      readonly evidence: Readonly<JsonObject>
      readonly semantics: Readonly<JsonObject> | null
    }
  | { readonly state: 'invalid'; readonly path: string }
  | { readonly state: 'unavailable'; readonly path: string }

const authorityForEvidence = (
  evidence: JsonObject,
  authorities: ReadonlyMap<string, JsonObject>,
): JsonObject | null => {
  if (!authorityBoundEvidenceKinds.has(String(evidence.evidence_kind))) return null
  const reference = evidence.author_role_authority_ref
  return typeof reference === 'string' ? authorities.get(reference) ?? null : null
}

const roleAuthorityBindingIssue = (
  evidence: JsonObject,
  content: JsonObject,
  input: JsonObject,
  authorities: ReadonlyMap<string, JsonObject>,
): string | null => {
  const identity = input.identity as JsonObject
  const kind = String(evidence.evidence_kind)
  if (kind === 'product_owner_approval') {
    return evidence.authoring_role === 'product_owner' &&
      content.authoring_role === 'product_owner'
      ? null
      : '/authoring_role'
  }
  if (!authorityBoundEvidenceKinds.has(kind)) return null
  if (
    evidence.author_role_authority_ref !== content.author_role_authority_ref
  ) return '/author_role_authority_ref'
  const authority = authorityForEvidence(evidence, authorities)
  if (!authority) return '/author_role_authority_ref'
  const scope = authority.scope as JsonObject
  let expectedRole: unknown
  if (kind === 'task_assignment') {
    if (
      authority.authority_kind !== 'task_assignment' ||
      scope.scope_kind !== 'task_assignment' ||
      scope.task_assignment_url !== identity.task_assignment_url
    ) return '/author_role_authority_ref'
    expectedRole = authority.issuer_role
  } else if (kind === 'result_handoff') {
    if (
      authority.authority_kind !== 'task_assignment' ||
      scope.scope_kind !== 'task_assignment' ||
      scope.task_assignment_url !== identity.task_assignment_url
    ) {
      return '/author_role_authority_ref'
    }
    expectedRole = authority.authorized_role
  } else if (kind === 'review_decision') {
    if (
      authority.authority_kind !== 'review_assignment' ||
      scope.pr_url !== identity.pr_url
    ) return '/author_role_authority_ref'
    expectedRole = authority.authorized_role
  } else if (
    kind === 'final_regression_result' ||
    kind === 'operational_validation_result'
  ) {
    const validationKind = kind === 'final_regression_result'
      ? 'final_regression'
      : 'operational_validation'
    if (
      authority.authority_kind !== 'validation_dispatch' ||
      scope.pr_url !== identity.pr_url ||
      scope.validation_kind !== validationKind
    ) return '/author_role_authority_ref'
    expectedRole = authority.authorized_role
  } else {
    if (
      authority.authority_kind !== 'protected_action_authority' ||
      scope.pr_url !== identity.pr_url
    ) return '/author_role_authority_ref'
    expectedRole = authority.authorized_role
    if (
      evidence.protected_action !== content.protected_action ||
      evidence.protected_action !== scope.protected_action
    ) return '/protected_action'
  }
  if (
    evidence.authoring_role !== expectedRole ||
    content.authoring_role !== expectedRole
  ) return '/authoring_role'
  const headBinding = evidence.head_binding as JsonObject
  if (kind === 'review_decision') {
    if (scope.reviewed_head !== headBinding.head) return '/head_binding/head'
  } else if (
    kind === 'final_regression_result' ||
    kind === 'operational_validation_result'
  ) {
    if (scope.validated_head !== headBinding.head) return '/head_binding/head'
  } else if (kind === 'protected_action_completion') {
    if (scope.authorized_head !== headBinding.head) return '/head_binding/head'
  }
  return null
}

const admitEvidenceRead = (
  result: unknown,
  evidence: JsonObject,
  input: JsonObject,
  authorities: ReadonlyMap<string, JsonObject>,
): EvidenceMemberAdmission => {
  if (canonicalReadUnavailable(result)) return { state: 'unavailable', path: '' }
  if (!isObject(result) || result.state !== 'available') {
    return { state: 'invalid', path: '' }
  }
  const identity = input.identity as JsonObject
  const authorization = input.projection_authorization as JsonObject
  const requestedUrl = String(evidence.canonical_url)

  if (evidence.evidence_class === 'canonical_role_record') {
    if (
      exact(
        result,
        [
          'state',
          'source_kind',
          'canonical_url',
          'body_utf8',
          'fetched_content_sha256',
          'content',
          'content_projection_sha256',
        ],
        '',
      ) !== undefined ||
      result.source_kind !== 'canonical_body' ||
      result.canonical_url !== requestedUrl ||
      typeof result.body_utf8 !== 'string' ||
      sha256Utf8(result.body_utf8) !== result.fetched_content_sha256 ||
      result.fetched_content_sha256 !== evidence.fetched_content_sha256
    ) return { state: 'invalid', path: '' }

    let reconstructed: JsonObject | null = null
    let semantics: JsonObject | null = null
    let authorityIdentity = requestedUrl
    if (evidence.evidence_kind === 'projection_authorization') {
      reconstructed = reconstructProjectionAuthorizationContent(result.body_utf8, requestedUrl)
      if (
        reconstructed === null ||
        reconstructed.record_authoring_role !== evidence.authoring_role ||
        reconstructed.assigned_role !== authorization.authoring_role ||
        reconstructed.assigned_role !== identity.authorized_metadata_role ||
        reconstructed.task_id !== identity.task_id ||
        reconstructed.canonical_task !== identity.task_assignment_url ||
        reconstructed.canonical_url !== requestedUrl ||
        (evidence.head_binding as JsonObject).state !== 'not_head_bound' ||
        (evidence.head_binding as JsonObject).basis_url !== requestedUrl
      ) return { state: 'invalid', path: '/authoring_role' }
    } else {
      const wrapper = admitDirectEvidenceWrapper(result.body_utf8)
      if (!wrapper.accepted) return { state: 'invalid', path: wrapper.path }
      reconstructed = wrapper.binding as JsonObject
      semantics = wrapper.semantics as JsonObject | null
      if (
        reconstructed.evidence_kind !== evidence.evidence_kind ||
        reconstructed.canonical_url !== requestedUrl ||
        reconstructed.authoring_role !== evidence.authoring_role ||
        reconstructed.task_id !== identity.task_id ||
        reconstructed.repository !== identity.repository ||
        canonicalize(reconstructed.head_binding) !== canonicalize(evidence.head_binding)
      ) return { state: 'invalid', path: '' }
      authorityIdentity = String(reconstructed.source_record_url)
      const roleIssue = roleAuthorityBindingIssue(
        evidence,
        reconstructed,
        input,
        authorities,
      )
      if (roleIssue) return { state: 'invalid', path: roleIssue }
    }
    const reconstructedDigest = gateStatusJcsSha256V1(reconstructed)
    if (
      reconstructedDigest !== result.content_projection_sha256 ||
      reconstructedDigest !== evidence.content_projection_sha256 ||
      canonicalize(reconstructed) !== canonicalize(result.content)
    ) return { state: 'invalid', path: '' }
    return {
      state: 'valid',
      authority_identity: authorityIdentity,
      evidence: cloneFreeze(evidence),
      semantics: semantics === null ? null : cloneFreeze(semantics),
    }
  }

  if (
    exact(
      result,
      [
        'state',
        'source_kind',
        'canonical_url',
        'source',
        'fetched_content_sha256',
        'content',
        'content_projection_sha256',
      ],
      '',
    ) !== undefined ||
    result.source_kind !== 'github_resource' ||
    result.canonical_url !== requestedUrl ||
    !isObject(result.source)
  ) return { state: 'invalid', path: '' }
  const source = result.source
  const sourceIssue = evidence.evidence_kind === 'github_check'
    ? validateGitHubCheckSource(source)
    : validateGitHubThreadSource(source)
  if (sourceIssue) return { state: 'invalid', path: sourceIssue.path }
  const reconstructed: JsonObject = evidence.evidence_kind === 'github_check'
    ? checkContentFromSource(source)
    : threadContentFromSource(source)
  if (canonicalize(reconstructed) !== canonicalize(result.content)) {
    const resultContent = isObject(result.content) ? result.content : {}
    const differingKey = [
      ...new Set([...Object.keys(reconstructed), ...Object.keys(resultContent)]),
    ].sort(byteCompare).find((key) => !sameJsonMember(reconstructed, resultContent, key))
    return { state: 'invalid', path: differingKey === undefined ? '' : `/${differingKey}` }
  }
  if (
    gateStatusJcsSha256V1(source) !== result.fetched_content_sha256 ||
    result.fetched_content_sha256 !== evidence.fetched_content_sha256 ||
    gateStatusJcsSha256V1(reconstructed) !== result.content_projection_sha256 ||
    result.content_projection_sha256 !== evidence.content_projection_sha256 ||
    source.canonical_url !== requestedUrl ||
    source.repository !== identity.repository ||
    source.pr_url !== identity.pr_url ||
    (evidence.evidence_kind === 'github_check'
      ? source.checked_head !== identity.expected_head
      : source.observed_head !== identity.expected_head)
  ) return { state: 'invalid', path: '' }
  const expectedContent = { ...evidence }
  delete expectedContent.fetched_content_sha256
  delete expectedContent.content_projection_sha256
  const differingClaim = Object.entries(expectedContent).find(([key, value]) =>
      key !== 'evidence_class' &&
      key !== 'evidence_kind' &&
      key !== 'verification_state' &&
      canonicalize(reconstructed[key]) !== canonicalize(value))
  if (differingClaim) return { state: 'invalid', path: `/${differingClaim[0]}` }
  return {
    state: 'valid',
    authority_identity: requestedUrl,
    evidence: cloneFreeze(evidence),
    semantics: null,
  }
}

const validateTransport = (
  value: unknown,
  path: string,
): GateStatusAdmissionRejectionV1 | undefined => {
  if (!isObject(value)) return rejection('invalid_type_or_format', path)
  if (value.kind === 'github_pr_body_patch_without_atomic_precondition') {
    const issue = exact(
      value,
      [
        'kind',
        'provider',
        'update_endpoint',
        'conditional_write_supported',
        'publisher_mutation_allowed',
        'recovery_protocol',
      ],
      path,
    )
    if (issue) return issue
    return value.provider === 'github' &&
      value.update_endpoint ===
        'https://docs.github.com/en/rest/issues/issues#update-an-issue' &&
      value.conditional_write_supported === false &&
      value.publisher_mutation_allowed === false &&
      value.recovery_protocol === 'authorized_metadata_role_update_then_fresh_reconciliation'
      ? undefined
      : rejection('invalid_conditional_matrix', path)
  }
  if (value.kind === 'proven_atomic_compare_and_swap') {
    const issue = exact(
      value,
      [
        'kind',
        'provider',
        'adapter_id',
        'adapter_version',
        'atomic_scope',
        'capability_authority_url',
        'conditional_write_supported',
        'publisher_mutation_allowed',
        'atomic_revision_identity',
      ],
      path,
    )
    if (issue) return issue
    const revisionIssue = exact(
      value.atomic_revision_identity,
      ['contract_version', 'identity_kind', 'normalized_identity_sha256'],
      `${path}/atomic_revision_identity`,
    )
    if (revisionIssue) return revisionIssue
    const revision = value.atomic_revision_identity as JsonObject
    return nonEmpty(value.provider) &&
      nonEmpty(value.adapter_id) &&
      nonEmpty(value.adapter_version) &&
      value.atomic_scope === 'complete_pr_body' &&
      canonicalUrl(value.capability_authority_url) &&
      value.conditional_write_supported === true &&
      value.publisher_mutation_allowed === true &&
      revision.contract_version === 'provider-atomic-revision-identity-v1' &&
      revision.identity_kind === 'exact_value_frozen_by_transport_capability_authority' &&
      digest(revision.normalized_identity_sha256)
      ? undefined
      : rejection('invalid_conditional_matrix', path)
  }
  return rejection('invalid_enum', `${path}/kind`)
}

const validateReceiptAuthority = (
  value: unknown,
  path: string,
): GateStatusAdmissionRejectionV1 | undefined => {
  if (!isObject(value)) return rejection('invalid_type_or_format', path)
  if (value.state === 'not_authorized') return exact(value, ['state'], path)
  if (value.state === 'authorized') {
    const issue = exact(value, ['state', 'owner_role', 'canonical_record'], path)
    if (issue) return issue
    return role(value.owner_role) && canonicalUrl(value.canonical_record)
      ? undefined
      : rejection('invalid_type_or_format', path)
  }
  return rejection('invalid_enum', `${path}/state`)
}

const validateReceiptStoreCapability = (
  value: unknown,
  path: string,
): GateStatusAdmissionRejectionV1 | undefined => {
  if (!isObject(value)) return rejection('invalid_type_or_format', path)
  if (value.state === 'not_required') return exact(value, ['state'], path)
  if (value.state !== 'admitted') return rejection('invalid_enum', `${path}/state`)
  const issue = exact(value, ['state', 'value'], path)
  if (issue) return issue
  const capabilityIssue = exact(
    value.value,
    [
      'contract_version',
      'kind',
      'provider',
      'adapter_id',
      'adapter_version',
      'capability_authority_url',
      'key_namespace',
      'unique_key',
      'consistency',
      'operation',
      'supported_outcomes',
    ],
    `${path}/value`,
  )
  if (capabilityIssue) return capabilityIssue
  const capability = value.value as JsonObject
  const outcomes = [
    'created',
    'existing_exact',
    'existing_conflict',
    'failed_before_commit',
    'indeterminate',
  ]
  return capability.contract_version === 'gate-status-receipt-store-capability-v1' &&
    capability.kind === 'proven_atomic_create_or_get' &&
    nonEmpty(capability.provider) &&
    nonEmpty(capability.adapter_id) &&
    nonEmpty(capability.adapter_version) &&
    canonicalUrl(capability.capability_authority_url) &&
    capability.key_namespace === 'gate-status-publication-receipt-v1' &&
    nonEmpty(capability.unique_key) &&
    capability.consistency === 'linearizable' &&
    capability.operation === 'atomic_create_or_get' &&
    Array.isArray(capability.supported_outcomes) &&
    canonicalize(capability.supported_outcomes) === canonicalize(outcomes)
    ? undefined
    : rejection('invalid_conditional_matrix', `${path}/value`)
}

const validatePriorReceipt = (
  value: unknown,
  path: string,
): GateStatusAdmissionRejectionV1 | undefined => {
  if (!isObject(value)) return rejection('invalid_type_or_format', path)
  if (value.state === 'absent') return exact(value, ['state'], path)
  if (value.state === 'present') {
    const issue = exact(value, ['state', 'receipt_url', 'receipt'], path)
    if (issue) return issue
    if (!canonicalUrl(value.receipt_url)) return rejection('invalid_type_or_format', `${path}/receipt_url`)
    const receipt = validateGateStatusPublicationReceiptV1(value.receipt)
    return receipt.accepted ? undefined : receipt.rejection
  }
  return rejection('invalid_enum', `${path}/state`)
}

export function validateAtomicOperationKeyProjectionV1(
  input: unknown,
): GateStatusAdmissionResultV1<Readonly<JsonObject>> {
  try {
    const issue = exact(
      input,
      [
        'contract_version',
        'key_kind',
        'publication_key',
        'transport_capability_authority_url',
        'provider',
        'adapter_id',
        'adapter_version',
        'atomic_scope',
        'atomic_revision_identity',
        'precondition_body_utf8_sha256',
        'precondition_non_gate_sha256',
        'receipt_authority_state',
        'receipt_store_capability_state',
        'prior_receipt_state',
        'prior_receipt_url',
      ],
      '',
    )
    if (issue) return rejected(issue)
    const value = input as JsonObject
    const revisionIssue = exact(
      value.atomic_revision_identity,
      ['contract_version', 'identity_kind', 'normalized_identity_sha256'],
      '/atomic_revision_identity',
    )
    if (revisionIssue) return rejected(revisionIssue)
    const revision = value.atomic_revision_identity as JsonObject
    if (
      value.contract_version !== 'gate-status-atomic-operation-key-projection-v1' ||
      value.key_kind !== 'proven_atomic_attempt' ||
      !/^gate-status-publication-v1:sha256:[0-9a-f]{64}$/.test(String(value.publication_key)) ||
      !canonicalUrl(value.transport_capability_authority_url) ||
      !nonEmpty(value.provider) ||
      !nonEmpty(value.adapter_id) ||
      !nonEmpty(value.adapter_version) ||
      value.atomic_scope !== 'complete_pr_body' ||
      revision.contract_version !== 'provider-atomic-revision-identity-v1' ||
      revision.identity_kind !== 'exact_value_frozen_by_transport_capability_authority' ||
      !digest(revision.normalized_identity_sha256) ||
      !digest(value.precondition_body_utf8_sha256) ||
      !digest(value.precondition_non_gate_sha256) ||
      !['not_authorized', 'authorized'].includes(String(value.receipt_authority_state)) ||
      !['not_required', 'proven_atomic_create_or_get'].includes(
        String(value.receipt_store_capability_state),
      ) ||
      !['absent', 'present'].includes(String(value.prior_receipt_state)) ||
      !(
        (value.prior_receipt_state === 'absent' && value.prior_receipt_url === null) ||
        (value.prior_receipt_state === 'present' && canonicalUrl(value.prior_receipt_url))
      )
    ) return rejected(rejection('invalid_conditional_matrix', ''))
    if (
      (value.receipt_authority_state === 'not_authorized' &&
        value.receipt_store_capability_state !== 'not_required') ||
      (value.receipt_authority_state === 'authorized' &&
        value.receipt_store_capability_state !== 'proven_atomic_create_or_get')
    ) return rejected(rejection('invalid_conditional_matrix', '/receipt_store_capability_state'))
    return accepted(value)
  } catch {
    return rejected(rejection('invalid_type_or_format', ''))
  }
}

const validatePriorRecord = (
  input: unknown,
  path: string,
): GateStatusAdmissionRejectionV1 | undefined => {
  const issue = exact(
    input,
    [
      'contract_version',
      'canonical_record',
      'record_type',
      'authoring_role',
      'task_id',
      'assignment_revision',
      'repository',
      'pr_url',
      'pr_number',
      'head',
      'base',
      'publication_key',
      'intended_projection_sha256',
      'precondition_non_gate_sha256',
      'submission_scope',
      'atomic_operation_projection',
      'atomic_operation_projection_sha256',
      'atomic_operation_key',
      'transport_capability_authority_url',
      'submission_state',
      'submitted_at',
      'fetched_content_sha256',
      'verification_state',
    ],
    path,
  )
  if (issue) return issue
  const value = input as JsonObject
  const projection = validateAtomicOperationKeyProjectionV1(value.atomic_operation_projection)
  if (!projection.accepted) {
    return rejection(projection.rejection.code, `${path}/atomic_operation_projection${projection.rejection.path}`)
  }
  const projected = projection.value as JsonObject
  if (
    value.contract_version !== 'gate-status-prior-attempt-authority-v1' ||
    !canonicalUrl(value.canonical_record) ||
    value.record_type !== 'gate_status_publication_attempt' ||
    !role(value.authoring_role) ||
    !nonEmpty(value.task_id) ||
    !Number.isInteger(value.assignment_revision) ||
    Number(value.assignment_revision) < 1 ||
    value.repository !== 'whatrune/sd-prompt-studio' ||
    !prUrl(value.pr_url) ||
    !Number.isInteger(value.pr_number) ||
    !fullSha(value.head) ||
    !fullSha(value.base) ||
    !/^gate-status-publication-v1:sha256:[0-9a-f]{64}$/.test(String(value.publication_key)) ||
    !digest(value.intended_projection_sha256) ||
    !digest(value.precondition_non_gate_sha256) ||
    value.submission_scope !== 'atomic_body_write' ||
    !digest(value.atomic_operation_projection_sha256) ||
    !/^gate-status-publication-atomic-operation-v1:sha256:[0-9a-f]{64}$/.test(
      String(value.atomic_operation_key),
    ) ||
    !canonicalUrl(value.transport_capability_authority_url) ||
    value.submission_state !== 'indeterminate' ||
    !utc(value.submitted_at) ||
    !digest(value.fetched_content_sha256) ||
    value.verification_state !== 'verified'
  ) return rejection('invalid_type_or_format', path)
  const projectionSha = gateStatusJcsSha256V1(projected)
  const operationKey = `gate-status-publication-atomic-operation-v1:${projectionSha}`
  if (
    value.atomic_operation_projection_sha256 !== projectionSha ||
    value.atomic_operation_key !== operationKey ||
    value.publication_key !== projected.publication_key ||
    value.precondition_non_gate_sha256 !== projected.precondition_non_gate_sha256 ||
    value.transport_capability_authority_url !== projected.transport_capability_authority_url
  ) return rejection('invalid_cross_input_binding', path)
  return undefined
}

export function validatePriorAttemptAuthoritySetInputV1(
  input: unknown,
): GateStatusAdmissionResultV1<Readonly<JsonObject>> {
  try {
    const issue = exact(
      input,
      [
        'contract_version',
        'authority_set_url',
        'authoring_role',
        'task_id',
        'assignment_revision',
        'repository',
        'pr_url',
        'pr_number',
        'head',
        'base',
        'publication_key',
        'completeness',
        'state',
        'records',
        'fetched_content_sha256',
        'verification_state',
      ],
      '',
    )
    if (issue) return rejected(issue)
    const value = input as JsonObject
    if (
      value.contract_version !== 'gate-status-prior-attempt-authority-set-v1' ||
      !canonicalUrl(value.authority_set_url) ||
      !role(value.authoring_role) ||
      !nonEmpty(value.task_id) ||
      !Number.isInteger(value.assignment_revision) ||
      Number(value.assignment_revision) < 1 ||
      value.repository !== 'whatrune/sd-prompt-studio' ||
      !prUrl(value.pr_url) ||
      !Number.isInteger(value.pr_number) ||
      Number(value.pr_number) < 1 ||
      !fullSha(value.head) ||
      !fullSha(value.base) ||
      !/^gate-status-publication-v1:sha256:[0-9a-f]{64}$/.test(String(value.publication_key)) ||
      value.completeness !== 'complete_for_publication_key' ||
      !['absent', 'present'].includes(String(value.state)) ||
      !Array.isArray(value.records) ||
      !digest(value.fetched_content_sha256) ||
      value.verification_state !== 'verified'
    ) return rejected(rejection('invalid_type_or_format', ''))
    if (
      (value.state === 'absent' && value.records.length !== 0) ||
      (value.state === 'present' && (value.records.length < 1 || value.records.length > 32))
    ) return rejected(rejection('invalid_conditional_matrix', '/records'))
    const urls: string[] = []
    for (let index = 0; index < value.records.length; index += 1) {
      const recordIssue = validatePriorRecord(value.records[index], `/records/${index}`)
      if (recordIssue) return rejected(recordIssue)
      urls.push(String((value.records[index] as JsonObject).canonical_record))
    }
    if (new Set(urls).size !== urls.length) {
      return rejected(rejection('duplicate_set_member', '/records'))
    }
    if (!sortedUnique(urls)) return rejected(rejection('noncanonical_set_order', '/records'))
    return accepted(value)
  } catch {
    return rejected(rejection('invalid_type_or_format', ''))
  }
}

export function validatePriorAttemptReconciliationObservationInputV1(
  input: unknown,
): GateStatusAdmissionResultV1<Readonly<JsonObject>> {
  try {
    if (!isObject(input)) return rejected(rejection('invalid_type_or_format', ''))
    if (input.state === 'not_required') {
      const issue = exact(input, ['state'], '')
      return issue ? rejected(issue) : accepted(input)
    }
    if (input.state === 'unavailable') {
      const issue = exact(
        input,
        [
          'state',
          'contract_version',
          'canonical_record',
          'authoring_role',
          'task_id',
          'repository',
          'pr_url',
          'head',
          'base',
          'prior_attempt_authority_url',
          'publication_key',
          'atomic_operation_key',
          'transport_capability_authority_url',
          'observation_state',
          'observed_at',
          'fetched_content_sha256',
          'verification_state',
        ],
        '',
      )
      if (issue) return rejected(issue)
      return input.contract_version === 'gate-status-prior-attempt-reconciliation-observation-v1' &&
        canonicalUrl(input.canonical_record) &&
        role(input.authoring_role) &&
        nonEmpty(input.task_id) &&
        input.repository === 'whatrune/sd-prompt-studio' &&
        prUrl(input.pr_url) &&
        fullSha(input.head) &&
        fullSha(input.base) &&
        canonicalUrl(input.prior_attempt_authority_url) &&
        /^gate-status-publication-v1:sha256:[0-9a-f]{64}$/.test(String(input.publication_key)) &&
        /^gate-status-publication-atomic-operation-v1:sha256:[0-9a-f]{64}$/.test(
          String(input.atomic_operation_key),
        ) &&
        canonicalUrl(input.transport_capability_authority_url) &&
        input.observation_state === 'read_unavailable' &&
        utc(input.observed_at) &&
        digest(input.fetched_content_sha256) &&
        input.verification_state === 'verified'
        ? accepted(input)
        : rejected(rejection('invalid_type_or_format', ''))
    }
    if (input.state !== 'available') return rejected(rejection('invalid_enum', '/state'))
    const issue = exact(
      input,
      [
        'state',
        'contract_version',
        'canonical_record',
        'authoring_role',
        'task_id',
        'repository',
        'pr_url',
        'pr_number',
        'head',
        'base',
        'prior_attempt_authority_url',
        'publication_key',
        'atomic_operation_key',
        'transport_capability_authority_url',
        'snapshot_identity',
        'post_read_atomic_revision_identity',
        'observed_projection_sha256',
        'observed_non_gate_sha256',
        'observed_at',
        'fetched_content_sha256',
        'verification_state',
      ],
      '',
    )
    if (issue) return rejected(issue)
    const snapshotIssue = exact(
      input.snapshot_identity,
      ['source_kind', 'pr_url', 'pr_number', 'head', 'base', 'state', 'draft', 'body_utf8_sha256'],
      '/snapshot_identity',
    )
    if (snapshotIssue) return rejected(snapshotIssue)
    const revisionIssue = exact(
      input.post_read_atomic_revision_identity,
      ['contract_version', 'identity_kind', 'normalized_identity_sha256'],
      '/post_read_atomic_revision_identity',
    )
    if (revisionIssue) return rejected(revisionIssue)
    const snapshot = input.snapshot_identity as JsonObject
    const revision = input.post_read_atomic_revision_identity as JsonObject
    return input.contract_version === 'gate-status-prior-attempt-reconciliation-observation-v1' &&
      canonicalUrl(input.canonical_record) &&
      role(input.authoring_role) &&
      nonEmpty(input.task_id) &&
      input.repository === 'whatrune/sd-prompt-studio' &&
      prUrl(input.pr_url) &&
      Number.isInteger(input.pr_number) &&
      fullSha(input.head) &&
      fullSha(input.base) &&
      canonicalUrl(input.prior_attempt_authority_url) &&
      /^gate-status-publication-v1:sha256:[0-9a-f]{64}$/.test(String(input.publication_key)) &&
      /^gate-status-publication-atomic-operation-v1:sha256:[0-9a-f]{64}$/.test(
        String(input.atomic_operation_key),
      ) &&
      canonicalUrl(input.transport_capability_authority_url) &&
      snapshot.source_kind === 'github_pull_request' &&
      prUrl(snapshot.pr_url) &&
      Number.isInteger(snapshot.pr_number) &&
      fullSha(snapshot.head) &&
      fullSha(snapshot.base) &&
      snapshot.state === 'open' &&
      typeof snapshot.draft === 'boolean' &&
      digest(snapshot.body_utf8_sha256) &&
      revision.contract_version === 'provider-atomic-revision-identity-v1' &&
      revision.identity_kind === 'exact_value_frozen_by_transport_capability_authority' &&
      digest(revision.normalized_identity_sha256) &&
      digest(input.observed_projection_sha256) &&
      digest(input.observed_non_gate_sha256) &&
      utc(input.observed_at) &&
      digest(input.fetched_content_sha256) &&
      input.verification_state === 'verified'
      ? accepted(input)
      : rejected(rejection('invalid_type_or_format', ''))
  } catch {
    return rejected(rejection('invalid_type_or_format', ''))
  }
}

const publicationProjection = (input: JsonObject, projectionSha: DigestV1, citations: string[]) => {
  const identity = input.identity as JsonObject
  const evaluator = input.evaluator as JsonObject
  const evaluatorResult = evaluator.result as JsonObject
  return {
    contract_version: GATE_STATUS_PUBLICATION_INPUT_V1,
    task_id: identity.task_id,
    assignment_revision: identity.assignment_revision,
    task_assignment_url: identity.task_assignment_url,
    projection_authority_url: identity.projection_authority_url,
    authorized_metadata_role: identity.authorized_metadata_role,
    repository: identity.repository,
    pr_url: identity.pr_url,
    pr_number: identity.pr_number,
    branch_binding: identity.branch,
    worktree_binding: identity.worktree,
    expected_head: identity.expected_head,
    expected_base: identity.expected_base,
    evaluator_contract_version: evaluatorResult.contract_version,
    evaluator_input_fingerprint: evaluatorResult.input_fingerprint,
    evaluator_result_sha256: evaluator.result_sha256,
    sorted_citation_urls: citations,
    intended_projection_sha256: projectionSha,
    role_authority_set: input.role_authority_set,
  }
}

export function buildGateStatusPublicationKeyV1(input: unknown): string | null {
  if (!isObject(input) || !isObject(input.identity) || !isObject(input.evaluator)) return null
  const authorization = isObject(input.projection_authorization)
    ? input.projection_authorization
    : undefined
  if (!authorization) return null
  const projection = validateGateStatusProjectionV1(authorization.projection)
  const authoritySet = validateGateStatusRoleAuthoritySetV1(input.role_authority_set)
  if (
    !projection.accepted ||
    !authoritySet.accepted ||
    !Array.isArray(input.evidence_records)
  ) return null
  const evidenceCitations = input.evidence_records
    .map((item) => (isObject(item) ? item.canonical_url : undefined))
  const authorityCitations = ((authoritySet.value as JsonObject).records as JsonObject[])
    .map((item) => item.canonical_url)
  const citations = [...evidenceCitations, ...authorityCitations]
    .filter(canonicalUrl)
    .sort(byteCompare)
  if (
    evidenceCitations.some((item) => !canonicalUrl(item)) ||
    authorityCitations.some((item) => !canonicalUrl(item)) ||
    new Set(citations).size !== citations.length
  ) return null
  const projectionSha = gateStatusJcsSha256V1(projection.value)
  return `gate-status-publication-v1:${gateStatusJcsSha256V1(
    publicationProjection(input, projectionSha, citations),
  )}`
}

const readOnlyOperationProjection = (
  input: JsonObject,
  publicationKey: string,
  snapshot: JsonObject,
) => {
  const prior = input.prior_attempt_authorities as JsonObject
  const receiptAuthority = input.receipt_authority as JsonObject
  const receiptStore = input.receipt_store_capability as JsonObject
  const priorReceipt = input.prior_receipt as JsonObject
  const priorRecords = prior.records as JsonObject[]
  return {
    contract_version: 'gate-status-read-only-operation-key-projection-v1',
    key_kind: 'github_read_only_snapshot',
    publication_key: publicationKey,
    snapshot_identity: {
      source_kind: snapshot.source_kind,
      pr_url: snapshot.pr_url,
      pr_number: snapshot.pr_number,
      head: snapshot.head,
      base: snapshot.base,
      state: snapshot.state,
      draft: snapshot.draft,
      body_utf8_sha256: snapshot.body_utf8_sha256,
    },
    transport_capability_kind: (input.transport_capability as JsonObject).kind,
    prior_attempt_state: priorRecords.length === 1 ? 'indeterminate' : 'absent',
    prior_attempt_operation_key:
      priorRecords.length === 1 ? priorRecords[0].atomic_operation_key : null,
    receipt_authority_state: receiptAuthority.state,
    receipt_store_capability_state:
      receiptStore.state === 'admitted' ? 'proven_atomic_create_or_get' : 'not_required',
    prior_receipt_state: priorReceipt.state,
    prior_receipt_url: priorReceipt.state === 'present' ? priorReceipt.receipt_url : null,
  }
}

export function buildGateStatusReadOnlyOperationKeyV1(
  input: unknown,
): { readonly projection: Readonly<JsonObject>; readonly projection_sha256: DigestV1; readonly operation_key: string } | null {
  if (!isObject(input) || !isObject(input.pr_snapshot) || !isObject(input.pr_snapshot.snapshot)) {
    return null
  }
  const publicationKey = buildGateStatusPublicationKeyV1(input)
  if (publicationKey === null) return null
  const projection = readOnlyOperationProjection(input, publicationKey, input.pr_snapshot.snapshot)
  const projectionSha = gateStatusJcsSha256V1(projection)
  return cloneFreeze({
    projection,
    projection_sha256: projectionSha,
    operation_key: `gate-status-publication-read-only-operation-v1:${projectionSha}`,
  })
}

export function validateGateStatusPublicationInputV1(
  input: unknown,
): GateStatusAdmissionResultV1<GateStatusPublicationInputV1> {
  try {
    const root = exact(
      input,
      [
        'contract_version',
        'identity',
        'evaluator',
        'projection_authorization',
        'role_authority_set',
        'evidence_records',
        'pr_snapshot',
        'prior_attempt_authorities',
        'prior_attempt_reconciliation_observation',
        'prior_receipt',
        'receipt_authority',
        'receipt_store_capability',
        'transport_capability',
      ],
      '',
    )
    if (root) return rejected(root)
    const value = input as JsonObject
    if (value.contract_version !== GATE_STATUS_PUBLICATION_INPUT_V1) {
      return rejected(rejection('invalid_enum', '/contract_version'))
    }
    let issue = exact(
      value.identity,
      [
        'task_id',
        'assignment_revision',
        'repository',
        'task_assignment_url',
        'projection_authority_url',
        'authorized_metadata_role',
        'authorized_transport_action',
        'pr_url',
        'pr_number',
        'branch',
        'worktree',
        'expected_head',
        'expected_base',
      ],
      '/identity',
    )
    if (issue) return rejected(issue)
    const identity = value.identity as JsonObject
    if (
      !nonEmpty(identity.task_id) ||
      !Number.isInteger(identity.assignment_revision) ||
      Number(identity.assignment_revision) < 1 ||
      identity.repository !== 'whatrune/sd-prompt-studio' ||
      !canonicalUrl(identity.task_assignment_url) ||
      !canonicalUrl(identity.projection_authority_url) ||
      !role(identity.authorized_metadata_role) ||
      identity.authorized_transport_action !== 'publish_gate_status_projection' ||
      !prUrl(identity.pr_url) ||
      !Number.isInteger(identity.pr_number) ||
      Number(identity.pr_number) < 1 ||
      !fullSha(identity.expected_head) ||
      !fullSha(identity.expected_base)
    ) return rejected(rejection('invalid_type_or_format', '/identity'))
    issue = validateBinding(identity.branch, '/identity/branch')
    if (issue) return rejected(issue)
    issue = validateBinding(identity.worktree, '/identity/worktree')
    if (issue) return rejected(issue)
    issue = exact(value.evaluator, ['admission_state', 'result', 'result_sha256'], '/evaluator')
    if (issue) return rejected(issue)
    const evaluator = value.evaluator as JsonObject
    if (evaluator.admission_state !== 'accepted' || !digest(evaluator.result_sha256)) {
      return rejected(rejection('invalid_type_or_format', '/evaluator'))
    }
    const evaluatorAdmission = validateAutomaticGateProgressionEvaluationResultV2(evaluator.result)
    if (evaluatorAdmission.kind !== 'accepted') {
      return rejected(rejection('invalid_cross_input_binding', '/evaluator/result'))
    }
    if (gateStatusJcsSha256V1(evaluatorAdmission.value) !== evaluator.result_sha256) {
      return rejected(rejection('invalid_cross_input_binding', '/evaluator'))
    }
    issue = exact(
      value.projection_authorization,
      [
        'authoring_role',
        'canonical_record',
        'task_id',
        'assignment_revision',
        'repository',
        'pr_url',
        'head',
        'base',
        'evaluator_input_fingerprint',
        'evaluator_result_sha256',
        'projection',
        'projection_sha256',
      ],
      '/projection_authorization',
    )
    if (issue) return rejected(issue)
    const authorization = value.projection_authorization as JsonObject
    const projectionAdmission = validateGateStatusProjectionV1(authorization.projection)
    if (!projectionAdmission.accepted) {
      return rejected(rejection(
        projectionAdmission.rejection.code,
        `/projection_authorization/projection${projectionAdmission.rejection.path}`,
      ))
    }
    if (
      !role(authorization.authoring_role) ||
      !canonicalUrl(authorization.canonical_record) ||
      authorization.task_id !== identity.task_id ||
      authorization.assignment_revision !== identity.assignment_revision ||
      authorization.repository !== identity.repository ||
      authorization.pr_url !== identity.pr_url ||
      authorization.head !== identity.expected_head ||
      authorization.base !== identity.expected_base ||
      authorization.evaluator_input_fingerprint !== evaluatorAdmission.value.input_fingerprint ||
      authorization.evaluator_result_sha256 !== evaluator.result_sha256 ||
      authorization.projection_sha256 !== gateStatusJcsSha256V1(projectionAdmission.value)
    ) return rejected(rejection('invalid_cross_input_binding', '/projection_authorization'))
    if (authorization.authoring_role !== identity.authorized_metadata_role) {
      return rejected(rejection('invalid_cross_input_binding', '/projection_authorization/authoring_role'))
    }
    const roleAuthorityAdmission =
      validateGateStatusRoleAuthoritySetV1(value.role_authority_set)
    if (!roleAuthorityAdmission.accepted) {
      return rejected(rejection(
        roleAuthorityAdmission.rejection.code,
        `/role_authority_set${roleAuthorityAdmission.rejection.path}`,
      ))
    }
    const roleAuthoritySet = roleAuthorityAdmission.value as JsonObject
    if (
      roleAuthoritySet.task_id !== identity.task_id ||
      roleAuthoritySet.assignment_revision !== identity.assignment_revision ||
      roleAuthoritySet.repository !== identity.repository
    ) return rejected(rejection('invalid_cross_input_binding', '/role_authority_set'))
    if (!Array.isArray(value.evidence_records)) {
      return rejected(rejection('invalid_type_or_format', '/evidence_records'))
    }
    const evidenceUrls: string[] = []
    for (let index = 0; index < value.evidence_records.length; index += 1) {
      issue = validateEvidence(value.evidence_records[index], `/evidence_records/${index}`)
      if (issue) return rejected(issue)
      const evidence = value.evidence_records[index] as JsonObject
      evidenceUrls.push(String(evidence.canonical_url))
      if (evidence.evidence_class === 'canonical_role_record') {
        const headBinding = evidence.head_binding as JsonObject
        if (
          evidence.task_id !== identity.task_id ||
          evidence.repository !== identity.repository ||
          (headBinding.state === 'current' && headBinding.head !== identity.expected_head)
        ) return rejected(rejection('invalid_cross_input_binding', `/evidence_records/${index}`))
      } else if (
        evidence.repository !== identity.repository ||
        evidence.pr_url !== identity.pr_url ||
        (evidence.evidence_kind === 'github_check'
          ? evidence.checked_head !== identity.expected_head
          : evidence.observed_head !== identity.expected_head)
      ) return rejected(rejection('invalid_cross_input_binding', `/evidence_records/${index}`))
    }
    if (new Set(evidenceUrls).size !== evidenceUrls.length) {
      const seen = new Set<string>()
      const duplicateIndex = evidenceUrls.findIndex((url) => {
        if (seen.has(url)) return true
        seen.add(url)
        return false
      })
      return rejected(rejection(
        'duplicate_set_member',
        `/evidence_records/${duplicateIndex}/canonical_url`,
      ))
    }
    if (!sortedUnique(evidenceUrls)) {
      return rejected(rejection('noncanonical_set_order', '/evidence_records'))
    }
    const authorityRecords = roleAuthoritySet.records as JsonObject[]
    const authorityUrls = authorityRecords.map((record) => String(record.canonical_url))
    const overlappingUrlIndex = authorityRecords.findIndex((record) =>
      evidenceUrls.includes(String(record.canonical_url)))
    if (overlappingUrlIndex >= 0) {
      return rejected(rejection(
        'invalid_cross_input_binding',
        `/role_authority_set/records/${overlappingUrlIndex}/canonical_url`,
      ))
    }
    const authorityByUrl = new Map(
      authorityRecords.map((record) => [String(record.canonical_url), record]),
    )
    const taskAuthority = authorityRecords.find((record) =>
      record.authority_kind === 'task_assignment' &&
      isObject(record.scope) &&
      record.scope.task_assignment_url === identity.task_assignment_url)
    if (!taskAuthority) {
      return rejected(rejection('invalid_cross_input_binding', '/role_authority_set/records'))
    }
    const referencedAuthorityUrls = new Set<string>()
    for (let index = 0; index < value.evidence_records.length; index += 1) {
      const evidence = value.evidence_records[index] as JsonObject
      if (authorityBoundEvidenceKinds.has(String(evidence.evidence_kind))) {
        const reference = String(evidence.author_role_authority_ref)
        if (!authorityByUrl.has(reference)) {
          return rejected(rejection(
            'invalid_cross_input_binding',
            `/evidence_records/${index}/author_role_authority_ref`,
          ))
        }
        referencedAuthorityUrls.add(reference)
      }
    }
    for (let index = 0; index < authorityRecords.length; index += 1) {
      if (!referencedAuthorityUrls.has(authorityUrls[index])) {
        return rejected(rejection(
          'invalid_cross_input_binding',
          `/role_authority_set/records/${index}`,
        ))
      }
    }
    for (let index = 0; index < value.evidence_records.length; index += 1) {
      const evidence = value.evidence_records[index] as JsonObject
      if (evidence.evidence_kind !== 'result_handoff') continue
      const authority = authorityByUrl.get(
        String(evidence.author_role_authority_ref),
      )
      const scope = authority?.scope
      if (
        authority?.authority_kind !== 'task_assignment' ||
        !isObject(scope) ||
        scope.scope_kind !== 'task_assignment' ||
        scope.task_assignment_url !== identity.task_assignment_url
      ) {
        return rejected(rejection(
          'invalid_cross_input_binding',
          `/evidence_records/${index}/author_role_authority_ref`,
        ))
      }
    }
    const evaluatorResult = evaluatorAdmission.value
    issue = exact(value.pr_snapshot, ['snapshot', 'body_utf8', 'body_matches_snapshot_sha256'], '/pr_snapshot')
    if (issue) return rejected(issue)
    const snapshotContainer = value.pr_snapshot as JsonObject
    issue = validateSnapshot(snapshotContainer.snapshot, '/pr_snapshot/snapshot')
    if (issue) return rejected(issue)
    if (
      typeof snapshotContainer.body_utf8 !== 'string' ||
      snapshotContainer.body_matches_snapshot_sha256 !== true ||
      sha256Utf8(snapshotContainer.body_utf8) !==
        (snapshotContainer.snapshot as JsonObject).body_utf8_sha256
    ) return rejected(rejection('invalid_cross_input_binding', '/pr_snapshot'))
    const snapshot = snapshotContainer.snapshot as JsonObject
    if (
      snapshot.pr_url !== identity.pr_url ||
      snapshot.pr_number !== identity.pr_number ||
      snapshot.head !== identity.expected_head ||
      snapshot.base !== identity.expected_base
    ) return rejected(rejection('invalid_cross_input_binding', '/pr_snapshot/snapshot'))
    const priorAdmission = validatePriorAttemptAuthoritySetInputV1(value.prior_attempt_authorities)
    if (!priorAdmission.accepted) {
      return rejected(rejection(
        priorAdmission.rejection.code,
        `/prior_attempt_authorities${priorAdmission.rejection.path}`,
      ))
    }
    const observationAdmission =
      validatePriorAttemptReconciliationObservationInputV1(
        value.prior_attempt_reconciliation_observation,
      )
    if (!observationAdmission.accepted) {
      return rejected(rejection(
        observationAdmission.rejection.code,
        `/prior_attempt_reconciliation_observation${observationAdmission.rejection.path}`,
      ))
    }
    const prior = priorAdmission.value as JsonObject
    const records = prior.records as JsonObject[]
    const observation = observationAdmission.value as JsonObject
    if (
      (records.length === 0 && observation.state !== 'not_required') ||
      (records.length > 1 && observation.state !== 'not_required')
    ) return rejected(rejection('invalid_conditional_matrix', '/prior_attempt_reconciliation_observation/state'))
    issue = validatePriorReceipt(value.prior_receipt, '/prior_receipt')
    if (issue) return rejected(issue)
    issue = validateReceiptAuthority(value.receipt_authority, '/receipt_authority')
    if (issue) return rejected(issue)
    issue = validateReceiptStoreCapability(value.receipt_store_capability, '/receipt_store_capability')
    if (issue) return rejected(issue)
    issue = validateTransport(value.transport_capability, '/transport_capability')
    if (issue) return rejected(issue)
    const receiptAuthority = value.receipt_authority as JsonObject
    const receiptStore = value.receipt_store_capability as JsonObject
    const priorReceipt = value.prior_receipt as JsonObject
    if (
      (receiptAuthority.state === 'not_authorized' &&
        (receiptStore.state !== 'not_required' || priorReceipt.state !== 'absent')) ||
      (receiptAuthority.state === 'authorized' &&
        (receiptAuthority.owner_role !== identity.authorized_metadata_role ||
          receiptStore.state !== 'admitted'))
    ) return rejected(rejection('invalid_conditional_matrix', '/receipt_store_capability'))
    if (evaluatorResult.kind === 'require_gate_status_update') {
      const projection = projectionAdmission.value as JsonObject
      if (
        (projection.current_head as JsonObject).value !== identity.expected_head ||
        (projection.pr_state_draft as JsonObject).value !==
          (snapshot.draft === true ? 'open_draft' : 'open_ready') ||
        evaluatorResult.requirement.pr !== identity.pr_url ||
        evaluatorResult.requirement.current_head !== identity.expected_head ||
        evaluatorResult.requirement.authorized_metadata_role !== identity.authorized_metadata_role ||
        (projection.current_blocker_next_gate as JsonObject).blocker_id !==
          (evaluatorResult.requirement.current_blocker ?? null) ||
        (projection.current_blocker_next_gate as JsonObject).next_owner !==
          (evaluatorResult.requirement.next_gate_owner ?? null)
      ) return rejected(rejection('invalid_cross_input_binding', '/projection_authorization/projection'))
    }
    const publicationKey = buildGateStatusPublicationKeyV1(value)
    if (publicationKey === null) {
      return rejected(rejection('invalid_cross_input_binding', '/prior_attempt_authorities/publication_key'))
    }
    if (receiptStore.state === 'admitted') {
      const capability = receiptStore.value as JsonObject
      if (capability.unique_key !== publicationKey) {
        return rejected(rejection('invalid_cross_input_binding', '/receipt_store_capability/value/unique_key'))
      }
    }
    return accepted(value)
  } catch {
    return rejected(rejection('invalid_type_or_format', ''))
  }
}

export function validateGateStatusPublicationReceiptV1(
  input: unknown,
): GateStatusAdmissionResultV1<GateStatusPublicationReceiptV1> {
  try {
    const issue = exact(
      input,
      [
        'contract_version',
        'publication_key',
        'successful_operation_key',
        'task_id',
        'assignment_revision',
        'repository',
        'pr_url',
        'pr_number',
        'head',
        'base',
        'authorized_metadata_role',
        'projection_authority_url',
        'evaluator_input_fingerprint',
        'evaluator_result_sha256',
        'intended_projection_sha256',
        'observed_projection_sha256',
        'pre_snapshot',
        'post_snapshot',
        'before_non_gate_sha256',
        'after_non_gate_sha256',
        'canonical_citation_urls',
        'result_kind',
        'receipt_url',
      ],
      '',
    )
    if (issue) return rejected(issue)
    const value = input as JsonObject
    let nested = validateSnapshot(value.pre_snapshot, '/pre_snapshot')
    if (nested) return rejected(nested)
    nested = validateSnapshot(value.post_snapshot, '/post_snapshot')
    if (nested) return rejected(nested)
    nested = validateStringSet(value.canonical_citation_urls, '/canonical_citation_urls', canonicalUrl)
    if (nested) return rejected(nested)
    return value.contract_version === GATE_STATUS_PUBLICATION_RECEIPT_V1 &&
      /^gate-status-publication-v1:sha256:[0-9a-f]{64}$/.test(String(value.publication_key)) &&
      /^(?:gate-status-publication-read-only-operation-v1|gate-status-publication-atomic-operation-v1):sha256:[0-9a-f]{64}$/.test(
        String(value.successful_operation_key),
      ) &&
      nonEmpty(value.task_id) &&
      Number.isInteger(value.assignment_revision) &&
      Number(value.assignment_revision) > 0 &&
      value.repository === 'whatrune/sd-prompt-studio' &&
      prUrl(value.pr_url) &&
      Number.isInteger(value.pr_number) &&
      Number(value.pr_number) > 0 &&
      fullSha(value.head) &&
      fullSha(value.base) &&
      role(value.authorized_metadata_role) &&
      canonicalUrl(value.projection_authority_url) &&
      nonEmpty(value.evaluator_input_fingerprint) &&
      digest(value.evaluator_result_sha256) &&
      digest(value.intended_projection_sha256) &&
      value.observed_projection_sha256 === value.intended_projection_sha256 &&
      digest(value.before_non_gate_sha256) &&
      value.after_non_gate_sha256 === value.before_non_gate_sha256 &&
      ['applied', 'already_current'].includes(String(value.result_kind)) &&
      canonicalUrl(value.receipt_url)
      ? accepted(value)
      : rejected(rejection('invalid_cross_input_binding', ''))
  } catch {
    return rejected(rejection('invalid_type_or_format', ''))
  }
}

const stages = new Set([
  'S1_structural_admission',
  'S2_assignment_authority',
  'S3_identity_binding',
  'S4_evaluator_admission',
  'S5_projection_admission',
  'S6_evidence_admission',
  'S7_stop_consistency',
  'S8_fresh_pr_read',
  'S9_section_admission',
  'S10_render_and_publication_key',
  'S11_prior_attempt_set_admission',
  'S12_receipt_authority_and_store_admission',
  'S13_operation_binding',
  'S14_prior_attempt_reconciliation_observation',
  'S15_transport_capability',
  'S16_atomic_precondition',
  'S17_single_write',
  'S18_body_read_only_reconciliation',
  'S19_receipt_atomic_create_or_get',
  'S20_result_admission',
])

const diagnosticCatalog = {
  structural_admission_failed: 'Gate Status publication input failed structural admission.',
  unknown_field: 'Gate Status publication input contains a forbidden field.',
  duplicate_set_member: 'Gate Status publication input contains a duplicate set member.',
  noncanonical_set_order: 'Gate Status publication input set is not in canonical order.',
  invalid_conditional_matrix: 'Gate Status publication input violates a closed conditional matrix.',
  invalid_cross_input_binding: 'Gate Status publication input contains an invalid cross-input binding.',
  assignment_authority_unavailable: 'Task Assignment or projection authority is unavailable.',
  metadata_transport_unauthorized: 'The metadata transport action is not authorized.',
  identity_mismatch: 'Publication identity does not match admitted authority.',
  evaluator_authority_invalid: 'The evaluator result is not admissible publication authority.',
  gate_status_update_not_required: 'The evaluator result does not require Gate Status publication.',
  projection_authority_invalid: 'The desired projection is not exactly authorized.',
  canonical_evidence_invalid: 'Required canonical evidence is missing, stale, or invalid.',
  canonical_conflict: 'Admitted authority records conflict.',
  authority_projection_conflict: 'The desired projection conflicts with admitted authority.',
  forbidden_authority_smuggling: 'The request contains forbidden decision or protected-action authority.',
  fresh_pr_unavailable: 'Fresh pull request state is unavailable.',
  authority_drift: 'Fresh pull request state differs from admitted authority.',
  gate_status_section_invalid: 'The Gate Status section is missing, duplicate, ambiguous, or malformed.',
  non_gate_mutation_detected: 'The candidate would change content outside Gate Status.',
  atomic_precondition_unavailable: 'The provider does not offer an admitted atomic body-write precondition.',
  compare_and_swap_failed: 'The admitted atomic write precondition did not match.',
  transport_unavailable_before_write: 'The transport failed before write acceptance.',
  prior_attempt_authority_unavailable: 'The canonical prior publication attempt is unavailable.',
  prior_attempt_authority_invalid: 'The canonical prior publication attempt does not match this publication.',
  prior_attempt_observation_required: 'A valid single prior attempt requires a reconciliation observation.',
  receipt_capability_unavailable: 'Authorized receipt publication requires an admitted atomic create-or-get capability.',
  receipt_capability_invalid: 'The receipt-store capability does not match its reviewed authority.',
  internal_failure_before_submission: 'An internal failure occurred before write submission.',
  write_outcome_unknown: 'Write acceptance cannot be determined without fresh reconciliation.',
  post_write_read_unavailable: 'Post-write state is unavailable for verification.',
  readback_mismatch: 'Read-back state does not equal the intended safe projection.',
  receipt_indeterminate: 'Receipt publication requires read-only reconciliation.',
  internal_state_indeterminate: 'Internal state after submission requires read-only reconciliation.',
  receipt_conflict: 'An existing receipt conflicts with this publication.',
  receipt_store_unavailable_after_body_verified: 'The receipt store failed after the body state was verified.',
} as const

type DiagnosticCodeV1 = keyof typeof diagnosticCatalog
const stopCodes = new Set<DiagnosticCodeV1>([
  'structural_admission_failed',
  'unknown_field',
  'duplicate_set_member',
  'noncanonical_set_order',
  'invalid_conditional_matrix',
  'invalid_cross_input_binding',
  'assignment_authority_unavailable',
  'metadata_transport_unauthorized',
  'identity_mismatch',
  'evaluator_authority_invalid',
  'gate_status_update_not_required',
  'projection_authority_invalid',
  'canonical_evidence_invalid',
  'canonical_conflict',
  'authority_projection_conflict',
  'forbidden_authority_smuggling',
  'fresh_pr_unavailable',
  'authority_drift',
  'gate_status_section_invalid',
  'non_gate_mutation_detected',
  'atomic_precondition_unavailable',
  'compare_and_swap_failed',
  'transport_unavailable_before_write',
  'prior_attempt_authority_unavailable',
  'prior_attempt_authority_invalid',
  'prior_attempt_observation_required',
  'receipt_capability_unavailable',
  'receipt_capability_invalid',
  'internal_failure_before_submission',
])

const structuralStopCode = (
  rejectionValue: GateStatusAdmissionRejectionV1,
): DiagnosticCodeV1 => {
  if (rejectionValue.code === 'unknown_field') {
    return rejectionValue.path.startsWith('/evidence_records/') &&
        (
          rejectionValue.path.endsWith('/author_role_authority_ref') ||
          rejectionValue.path.endsWith('/authoring_role')
        )
      ? 'unknown_field'
      : 'structural_admission_failed'
  }
  if (
    rejectionValue.code === 'duplicate_set_member' ||
    rejectionValue.code === 'noncanonical_set_order'
  ) {
    return rejectionValue.path.startsWith('/role_authority_set/')
      ? rejectionValue.code
      : 'structural_admission_failed'
  }
  if (rejectionValue.code === 'invalid_conditional_matrix') {
    return rejectionValue.path.startsWith('/role_authority_set/records/')
      ? 'invalid_conditional_matrix'
      : 'structural_admission_failed'
  }
  if (rejectionValue.code === 'invalid_cross_input_binding') {
    return (
      rejectionValue.path.startsWith('/role_authority_set/records') ||
      (
        rejectionValue.path.startsWith('/evidence_records/') &&
        rejectionValue.path.endsWith('/author_role_authority_ref')
      )
    )
      ? 'invalid_cross_input_binding'
      : 'structural_admission_failed'
  }
  return stopCodes.has(rejectionValue.code as DiagnosticCodeV1)
    ? rejectionValue.code as DiagnosticCodeV1
    : 'structural_admission_failed'
}
const reconciliationCodes = new Set<DiagnosticCodeV1>([
  'write_outcome_unknown',
  'post_write_read_unavailable',
  'readback_mismatch',
  'receipt_indeterminate',
  'internal_state_indeterminate',
  'receipt_conflict',
  'receipt_store_unavailable_after_body_verified',
])

const validateDiagnostic = (
  value: unknown,
  path: string,
): GateStatusAdmissionRejectionV1 | undefined => {
  const issue = exact(value, ['code', 'path', 'message', 'evidence_urls'], path)
  if (issue) return issue
  const diagnostic = value as JsonObject
  if (
    typeof diagnostic.code !== 'string' ||
    !hasOwn(diagnosticCatalog, diagnostic.code) ||
    typeof diagnostic.path !== 'string' ||
    diagnostic.message !== diagnosticCatalog[diagnostic.code as DiagnosticCodeV1]
  ) return rejection('invalid_conditional_matrix', path)
  return validateStringSet(diagnostic.evidence_urls, `${path}/evidence_urls`, canonicalUrl)
}

const validateIdentityBinding = (
  value: unknown,
  path: string,
): GateStatusAdmissionRejectionV1 | undefined => {
  if (!isObject(value)) return rejection('invalid_type_or_format', path)
  if (value.state === 'unavailable') return exact(value, ['state'], path)
  if (value.state !== 'admitted') return rejection('invalid_enum', `${path}/state`)
  const issue = exact(value, ['state', 'value'], path)
  if (issue) return issue
  const nested = exact(
    value.value,
    [
      'task_id',
      'assignment_revision',
      'repository',
      'task_assignment_url',
      'projection_authority_url',
      'authorized_metadata_role',
      'authorized_transport_action',
      'pr_url',
      'pr_number',
      'branch',
      'worktree',
      'expected_head',
      'expected_base',
    ],
    `${path}/value`,
  )
  if (nested) return nested
  const identity = value.value as JsonObject
  if (
    !nonEmpty(identity.task_id) ||
    !Number.isInteger(identity.assignment_revision) ||
    Number(identity.assignment_revision) < 1 ||
    identity.repository !== 'whatrune/sd-prompt-studio' ||
    !canonicalUrl(identity.task_assignment_url) ||
    !canonicalUrl(identity.projection_authority_url) ||
    !role(identity.authorized_metadata_role) ||
    identity.authorized_transport_action !== 'publish_gate_status_projection' ||
    !prUrl(identity.pr_url) ||
    !Number.isInteger(identity.pr_number) ||
    Number(identity.pr_number) < 1 ||
    !fullSha(identity.expected_head) ||
    !fullSha(identity.expected_base)
  ) return rejection('invalid_type_or_format', `${path}/value`)
  const branchIssue = validateBinding(identity.branch, `${path}/value/branch`)
  if (branchIssue) return branchIssue
  return validateBinding(identity.worktree, `${path}/value/worktree`)
}

const validateSimpleBinding = (
  value: unknown,
  path: string,
  admittedState: string,
): GateStatusAdmissionRejectionV1 | undefined => {
  if (!isObject(value)) return rejection('invalid_type_or_format', path)
  if (value.state === 'unavailable') return exact(value, ['state'], path)
  if (value.state !== admittedState) return rejection('invalid_enum', `${path}/state`)
  const issue = exact(value, ['state', 'value'], path)
  if (issue) return issue
  if (path === '/evaluator_binding') {
    const nested = exact(
      value.value,
      ['contract_version', 'input_fingerprint', 'result_sha256'],
      `${path}/value`,
    )
    if (nested) return nested
    const evaluator = value.value as JsonObject
    return evaluator.contract_version === 'automatic-gate-progression-evaluation-result-v2' &&
      nonEmpty(evaluator.input_fingerprint) &&
      digest(evaluator.result_sha256)
      ? undefined
      : rejection('invalid_type_or_format', `${path}/value`)
  }
  if (path === '/transport_binding') {
    return validateTransport(value.value, `${path}/value`)
  }
  return undefined
}

const validatePublicationBinding = (
  value: unknown,
  path: string,
): GateStatusAdmissionRejectionV1 | undefined => {
  if (!isObject(value)) return rejection('invalid_type_or_format', path)
  if (value.state === 'unavailable') return exact(value, ['state'], path)
  const issue = exact(
    value,
    ['state', 'publication_key', 'intended_projection_sha256', 'canonical_citation_urls'],
    path,
  )
  if (issue) return issue
  if (
    value.state !== 'available' ||
    !/^gate-status-publication-v1:sha256:[0-9a-f]{64}$/.test(String(value.publication_key)) ||
    !digest(value.intended_projection_sha256)
  ) return rejection('invalid_type_or_format', path)
  return validateStringSet(value.canonical_citation_urls, `${path}/canonical_citation_urls`, canonicalUrl)
}

const validateWriteState = (
  value: unknown,
  path: string,
): GateStatusAdmissionRejectionV1 | undefined => {
  const issue = exact(value, ['attempted', 'observed', 'verified', 'confirmation'], path)
  if (issue) return issue
  const state = value as JsonObject
  const key = `${state.attempted}/${state.observed}/${state.verified}/${state.confirmation}`
  return new Set([
    'false/false/false/none',
    'false/false/true/already_current_read',
    'true/false/false/submission_indeterminate',
    'true/true/false/readback_mismatch',
    'true/true/true/direct_response_and_readback',
    'true/true/true/reconciled_after_indeterminate',
  ]).has(key)
    ? undefined
    : rejection('invalid_conditional_matrix', path)
}

const validateReadOnlyOperationProjection = (
  value: unknown,
  path: string,
): GateStatusAdmissionRejectionV1 | undefined => {
  const issue = exact(
    value,
    [
      'contract_version',
      'key_kind',
      'publication_key',
      'snapshot_identity',
      'transport_capability_kind',
      'prior_attempt_state',
      'prior_attempt_operation_key',
      'receipt_authority_state',
      'receipt_store_capability_state',
      'prior_receipt_state',
      'prior_receipt_url',
    ],
    path,
  )
  if (issue) return issue
  const projection = value as JsonObject
  const snapshotIssue = exact(
    projection.snapshot_identity,
    ['source_kind', 'pr_url', 'pr_number', 'head', 'base', 'state', 'draft', 'body_utf8_sha256'],
    `${path}/snapshot_identity`,
  )
  if (snapshotIssue) return snapshotIssue
  const snapshot = projection.snapshot_identity as JsonObject
  if (
    projection.contract_version !== 'gate-status-read-only-operation-key-projection-v1' ||
    projection.key_kind !== 'github_read_only_snapshot' ||
    !/^gate-status-publication-v1:sha256:[0-9a-f]{64}$/.test(String(projection.publication_key)) ||
    snapshot.source_kind !== 'github_pull_request' ||
    !prUrl(snapshot.pr_url) ||
    !Number.isInteger(snapshot.pr_number) ||
    Number(snapshot.pr_number) < 1 ||
    !fullSha(snapshot.head) ||
    !fullSha(snapshot.base) ||
    snapshot.state !== 'open' ||
    typeof snapshot.draft !== 'boolean' ||
    !digest(snapshot.body_utf8_sha256) ||
    !['github_pr_body_patch_without_atomic_precondition', 'proven_atomic_compare_and_swap'].includes(
      String(projection.transport_capability_kind),
    ) ||
    !['absent', 'indeterminate'].includes(String(projection.prior_attempt_state)) ||
    !['not_authorized', 'authorized'].includes(String(projection.receipt_authority_state)) ||
    !['not_required', 'proven_atomic_create_or_get'].includes(
      String(projection.receipt_store_capability_state),
    ) ||
    !['absent', 'present'].includes(String(projection.prior_receipt_state))
  ) return rejection('invalid_type_or_format', path)
  if (
    (projection.prior_attempt_state === 'absent' &&
      projection.prior_attempt_operation_key !== null) ||
    (projection.prior_attempt_state === 'indeterminate' &&
      !/^gate-status-publication-atomic-operation-v1:sha256:[0-9a-f]{64}$/.test(
        String(projection.prior_attempt_operation_key),
      )) ||
    (projection.receipt_authority_state === 'not_authorized' &&
      projection.receipt_store_capability_state !== 'not_required') ||
    (projection.receipt_authority_state === 'authorized' &&
      projection.receipt_store_capability_state !== 'proven_atomic_create_or_get') ||
    (projection.prior_receipt_state === 'absent' && projection.prior_receipt_url !== null) ||
    (projection.prior_receipt_state === 'present' &&
      !canonicalUrl(projection.prior_receipt_url))
  ) return rejection('invalid_conditional_matrix', path)
  return undefined
}

const validateOperationBinding = (
  value: unknown,
  path: string,
): GateStatusAdmissionRejectionV1 | undefined => {
  if (!isObject(value)) return rejection('invalid_type_or_format', path)
  if (value.state === 'unavailable') return exact(value, ['state'], path)
  const issue = exact(value, ['state', 'read_only_evaluation', 'atomic_attempt'], path)
  if (issue) return issue
  if (value.state !== 'available') return rejection('invalid_enum', `${path}/state`)
  const readOnlyIssue = exact(
    value.read_only_evaluation,
    ['projection', 'projection_sha256', 'operation_key'],
    `${path}/read_only_evaluation`,
  )
  if (readOnlyIssue) return readOnlyIssue
  const readOnly = value.read_only_evaluation as JsonObject
  const readOnlyProjectionIssue = validateReadOnlyOperationProjection(
    readOnly.projection,
    `${path}/read_only_evaluation/projection`,
  )
  if (readOnlyProjectionIssue) return readOnlyProjectionIssue
  if (
    !digest(readOnly.projection_sha256) ||
    readOnly.projection_sha256 !== gateStatusJcsSha256V1(readOnly.projection) ||
    readOnly.operation_key !==
      `gate-status-publication-read-only-operation-v1:${readOnly.projection_sha256}`
  ) return rejection('invalid_cross_input_binding', `${path}/read_only_evaluation`)
  if (!isObject(value.atomic_attempt)) {
    return rejection('invalid_type_or_format', `${path}/atomic_attempt`)
  }
  const atomic = value.atomic_attempt
  if (atomic.state === 'absent') return exact(atomic, ['state'], `${path}/atomic_attempt`)
  const atomicIssue = exact(
    atomic,
    ['state', 'authority_url', 'projection', 'projection_sha256', 'operation_key'],
    `${path}/atomic_attempt`,
  )
  if (atomicIssue) return atomicIssue
  const projectionAdmission = validateAtomicOperationKeyProjectionV1(atomic.projection)
  if (!projectionAdmission.accepted) {
    return rejection(
      projectionAdmission.rejection.code,
      `${path}/atomic_attempt/projection${projectionAdmission.rejection.path}`,
    )
  }
  const projectionSha = gateStatusJcsSha256V1(projectionAdmission.value)
  return ['direct', 'prior_indeterminate'].includes(String(atomic.state)) &&
    canonicalUrl(atomic.authority_url) &&
    atomic.projection_sha256 === projectionSha &&
    atomic.operation_key === `gate-status-publication-atomic-operation-v1:${projectionSha}`
    ? undefined
    : rejection('invalid_cross_input_binding', `${path}/atomic_attempt`)
}

const validatePriorAttemptBinding = (
  value: unknown,
  path: string,
): GateStatusAdmissionRejectionV1 | undefined => {
  if (!isObject(value)) return rejection('invalid_type_or_format', path)
  if (value.state === 'unavailable' || value.state === 'absent') return exact(value, ['state'], path)
  const issue = exact(
    value,
    [
      'state',
      'authority_set_url',
      'authority_url',
      'publication_key',
      'operation_key',
      'submitted_at',
      'transport_capability_ref',
    ],
    path,
  )
  if (issue) return issue
  return value.state === 'indeterminate' &&
    canonicalUrl(value.authority_set_url) &&
    canonicalUrl(value.authority_url) &&
    /^gate-status-publication-v1:sha256:[0-9a-f]{64}$/.test(String(value.publication_key)) &&
    /^gate-status-publication-atomic-operation-v1:sha256:[0-9a-f]{64}$/.test(
      String(value.operation_key),
    ) &&
    utc(value.submitted_at) &&
    canonicalUrl(value.transport_capability_ref)
    ? undefined
    : rejection('invalid_type_or_format', path)
}

const validateReceiptStoreBinding = (
  value: unknown,
  path: string,
): GateStatusAdmissionRejectionV1 | undefined => {
  if (!isObject(value)) return rejection('invalid_type_or_format', path)
  if (value.state === 'unavailable' || value.state === 'not_required') return exact(value, ['state'], path)
  const issue = exact(
    value,
    [
      'state',
      'capability_authority_url',
      'provider',
      'adapter_id',
      'adapter_version',
      'unique_key',
    ],
    path,
  )
  if (issue) return issue
  return value.state === 'admitted' &&
    canonicalUrl(value.capability_authority_url) &&
    nonEmpty(value.provider) &&
    nonEmpty(value.adapter_id) &&
    nonEmpty(value.adapter_version) &&
    /^gate-status-publication-v1:sha256:[0-9a-f]{64}$/.test(String(value.unique_key))
    ? undefined
    : rejection('invalid_type_or_format', path)
}

const validateReceiptDisposition = (
  value: unknown,
  path: string,
): GateStatusAdmissionRejectionV1 | undefined => {
  if (!isObject(value)) return rejection('invalid_type_or_format', path)
  if (value.state === 'not_authorized') return exact(value, ['state'], path)
  if (value.state === 'created' || value.state === 'reused') {
    const issue = exact(value, ['state', 'owner_role', 'receipt_url', 'receipt_key'], path)
    if (issue) return issue
    return role(value.owner_role) &&
      canonicalUrl(value.receipt_url) &&
      /^gate-status-publication-v1:sha256:[0-9a-f]{64}$/.test(String(value.receipt_key))
      ? undefined
      : rejection('invalid_type_or_format', path)
  }
  if (value.state === 'not_performed') {
    const issue = exact(value, ['state', 'reason'], path)
    if (issue) return issue
    return [
      'publication_stopped',
      'write_not_verified',
      'receipt_store_failed_before_commit',
      'receipt_conflict',
    ].includes(String(value.reason))
      ? undefined
      : rejection('invalid_enum', `${path}/reason`)
  }
  if (value.state === 'verification_required') {
    const issue = exact(value, ['state', 'owner_role', 'publication_key', 'reason'], path)
    if (issue) return issue
    return role(value.owner_role) &&
      /^gate-status-publication-v1:sha256:[0-9a-f]{64}$/.test(String(value.publication_key)) &&
      value.reason === 'receipt_store_outcome_indeterminate'
      ? undefined
      : rejection('invalid_type_or_format', path)
  }
  return rejection('invalid_enum', `${path}/state`)
}

const snapshotBindsIdentity = (snapshot: JsonObject, identity: JsonObject) =>
  snapshot.pr_url === identity.pr_url &&
  snapshot.pr_number === identity.pr_number &&
  snapshot.head === identity.expected_head &&
  snapshot.base === identity.expected_base

const validateResultCrossBindings = (
  value: JsonObject,
): GateStatusAdmissionRejectionV1 | undefined => {
  const identityBinding = value.identity_binding as JsonObject
  const evaluatorBinding = value.evaluator_binding as JsonObject
  const publicationBinding = value.publication_binding as JsonObject
  const operationBinding = value.operation_binding as JsonObject
  const transportBinding = value.transport_binding as JsonObject
  const priorBinding = value.prior_attempt_binding as JsonObject
  const receiptStore = value.receipt_store_binding as JsonObject
  const receipt = value.receipt_disposition as JsonObject
  const write = value.write_state as JsonObject
  const branch = value.branch as JsonObject
  const success = value.kind === 'applied' || value.kind === 'already_current'

  if (
    (success || value.kind === 'reconciliation_required') &&
    (
      identityBinding.state !== 'admitted' ||
      evaluatorBinding.state !== 'admitted' ||
      publicationBinding.state !== 'available' ||
      operationBinding.state !== 'available'
    )
  ) return rejection('invalid_conditional_matrix', '/identity_binding')

  const identity = identityBinding.state === 'admitted'
    ? identityBinding.value as JsonObject
    : null
  const publication = publicationBinding.state === 'available'
    ? publicationBinding
    : null
  const operation = operationBinding.state === 'available'
    ? operationBinding
    : null
  const transport = transportBinding.state === 'admitted'
    ? transportBinding.value as JsonObject
    : null

  if (publication && operation) {
    const readOnly = operation.read_only_evaluation as JsonObject
    const readOnlyProjection = readOnly.projection as JsonObject
    const snapshot = readOnlyProjection.snapshot_identity as JsonObject
    if (
      readOnlyProjection.publication_key !== publication.publication_key ||
      transport !== null && readOnlyProjection.transport_capability_kind !== transport.kind ||
      identity !== null && !snapshotBindsIdentity(snapshot, identity)
    ) return rejection('invalid_cross_input_binding', '/operation_binding/read_only_evaluation')
    if (
      (priorBinding.state === 'absent' && readOnlyProjection.prior_attempt_state !== 'absent') ||
      (priorBinding.state === 'indeterminate' &&
        (
          readOnlyProjection.prior_attempt_state !== 'indeterminate' ||
          readOnlyProjection.prior_attempt_operation_key !== priorBinding.operation_key
        ))
    ) return rejection('invalid_cross_input_binding', '/prior_attempt_binding')
    const atomic = operation.atomic_attempt as JsonObject
    if (atomic.state !== 'absent') {
      const projection = atomic.projection as JsonObject
      if (
        projection.publication_key !== publication.publication_key ||
        atomic.operation_key !==
          `gate-status-publication-atomic-operation-v1:${atomic.projection_sha256}` ||
        (atomic.state === 'prior_indeterminate' &&
          (
            priorBinding.state !== 'indeterminate' ||
            atomic.operation_key !== priorBinding.operation_key ||
            atomic.authority_url !== priorBinding.authority_url
          ))
      ) return rejection('invalid_cross_input_binding', '/operation_binding/atomic_attempt')
    }
  }

  if (
    publication &&
    receiptStore.state === 'admitted' &&
    receiptStore.unique_key !== publication.publication_key
  ) return rejection('invalid_cross_input_binding', '/receipt_store_binding/unique_key')
  if (identity && publication) {
    if (receipt.state === 'created' || receipt.state === 'reused') {
      if (
        receiptStore.state !== 'admitted' ||
        receipt.owner_role !== identity.authorized_metadata_role ||
        receipt.receipt_key !== publication.publication_key
      ) return rejection('invalid_cross_input_binding', '/receipt_disposition')
    } else if (receipt.state === 'verification_required') {
      if (
        receiptStore.state !== 'admitted' ||
        receipt.owner_role !== identity.authorized_metadata_role ||
        receipt.publication_key !== publication.publication_key
      ) return rejection('invalid_cross_input_binding', '/receipt_disposition')
    } else if (receipt.state === 'not_authorized' && receiptStore.state !== 'not_required') {
      return rejection('invalid_conditional_matrix', '/receipt_store_binding')
    }
  }

  if (value.kind === 'applied') {
    const applied = branch.applied as JsonObject
    const atomic = operation ? operation.atomic_attempt as JsonObject : { state: 'absent' }
    if (
      identity === null ||
      publication === null ||
      transport === null ||
      atomic.state === 'absent' ||
      !snapshotBindsIdentity(applied.post_snapshot as JsonObject, identity) ||
      applied.observed_projection_sha256 !== publication.intended_projection_sha256 ||
      applied.after_non_gate_sha256 !== applied.before_non_gate_sha256 ||
      write.attempted !== true ||
      write.observed !== true ||
      write.verified !== true ||
      !['created', 'reused', 'not_authorized'].includes(String(receipt.state))
    ) return rejection('invalid_conditional_matrix', '/branch/applied')
    if (
      (write.confirmation === 'direct_response_and_readback' &&
        (
          transport.kind !== 'proven_atomic_compare_and_swap' ||
          atomic.state !== 'direct' ||
          priorBinding.state !== 'absent'
        )) ||
      (write.confirmation === 'reconciled_after_indeterminate' &&
        !(
          (
            atomic.state === 'prior_indeterminate' &&
            priorBinding.state === 'indeterminate'
          ) ||
          (
            atomic.state === 'direct' &&
            priorBinding.state === 'absent' &&
            transport.kind === 'proven_atomic_compare_and_swap'
          )
        ))
    ) return rejection('invalid_conditional_matrix', '/write_state/confirmation')
  } else if (value.kind === 'already_current') {
    const current = branch.already_current as JsonObject
    const atomic = operation ? operation.atomic_attempt as JsonObject : { state: 'absent' }
    if (
      identity === null ||
      publication === null ||
      transport === null ||
      priorBinding.state !== 'absent' ||
      atomic.state !== 'absent' ||
      !snapshotBindsIdentity(current.current_snapshot as JsonObject, identity) ||
      current.observed_projection_sha256 !== publication.intended_projection_sha256 ||
      write.attempted !== false ||
      write.observed !== false ||
      write.verified !== true ||
      write.confirmation !== 'already_current_read' ||
      !['created', 'reused', 'not_authorized'].includes(String(receipt.state))
    ) return rejection('invalid_conditional_matrix', '/branch/already_current')
  } else if (value.kind === 'stopped') {
    if (
      write.attempted !== false ||
      write.observed !== false ||
      write.verified !== false ||
      write.confirmation !== 'none' ||
      receipt.state !== 'not_performed' ||
      receipt.reason !== 'publication_stopped'
    ) return rejection('invalid_conditional_matrix', '/write_state')
  } else {
    const reconciliation = branch.reconciliation_required as JsonObject
    const code = String(reconciliation.reconciliation_code)
    const unverifiedUnavailable = new Set([
      'write_outcome_unknown',
      'post_write_read_unavailable',
      'internal_state_indeterminate',
    ])
    if (unverifiedUnavailable.has(code)) {
      if (
        write.attempted !== true ||
        write.observed !== false ||
        write.verified !== false ||
        write.confirmation !== 'submission_indeterminate' ||
        receipt.state !== 'not_performed' ||
        receipt.reason !== 'write_not_verified'
      ) return rejection('invalid_conditional_matrix', '/write_state')
    } else if (code === 'readback_mismatch') {
      if (
        write.attempted !== true ||
        write.observed !== true ||
        write.verified !== false ||
        write.confirmation !== 'readback_mismatch' ||
        receipt.state !== 'not_performed' ||
        receipt.reason !== 'write_not_verified'
      ) return rejection('invalid_conditional_matrix', '/write_state')
    } else {
      const verifiedBody =
        (write.attempted === false &&
          write.observed === false &&
          write.verified === true &&
          write.confirmation === 'already_current_read') ||
        (write.attempted === true &&
          write.observed === true &&
          write.verified === true &&
          ['direct_response_and_readback', 'reconciled_after_indeterminate'].includes(
            String(write.confirmation),
          ))
      if (!verifiedBody || receiptStore.state !== 'admitted') {
        return rejection('invalid_conditional_matrix', '/write_state')
      }
      if (
        (code === 'receipt_indeterminate' &&
          receipt.state !== 'verification_required') ||
        (code === 'receipt_conflict' &&
          !(receipt.state === 'not_performed' && receipt.reason === 'receipt_conflict')) ||
        (code === 'receipt_store_unavailable_after_body_verified' &&
          !(receipt.state === 'not_performed' &&
            receipt.reason === 'receipt_store_failed_before_commit'))
      ) return rejection('invalid_conditional_matrix', '/receipt_disposition')
    }
    if (transport === null && priorBinding.state !== 'indeterminate') {
      return rejection('invalid_conditional_matrix', '/transport_binding')
    }
    const observation = reconciliation.last_observation as JsonObject
    if (
      identity !== null &&
      observation.state === 'available' &&
      !snapshotBindsIdentity(observation.snapshot as JsonObject, identity)
    ) return rejection(
      'invalid_cross_input_binding',
      '/branch/reconciliation_required/last_observation/snapshot',
    )
  }
  return undefined
}

export function validateGateStatusPublicationResultV1(
  input: unknown,
): GateStatusAdmissionResultV1<GateStatusPublicationResultV1> {
  try {
    const root = exact(
      input,
      [
        'contract_version',
        'kind',
        'identity_binding',
        'evaluator_binding',
        'publication_binding',
        'operation_binding',
        'transport_binding',
        'prior_attempt_binding',
        'write_state',
        'receipt_store_binding',
        'receipt_disposition',
        'diagnostics',
        'branch',
      ],
      '',
    )
    if (root) return rejected(root)
    const value = input as JsonObject
    if (
      value.contract_version !== GATE_STATUS_PUBLICATION_RESULT_V1 ||
      !['applied', 'already_current', 'stopped', 'reconciliation_required'].includes(
        String(value.kind),
      )
    ) return rejected(rejection('invalid_enum', '/kind'))
    let issue = validateIdentityBinding(value.identity_binding, '/identity_binding')
    if (issue) return rejected(issue)
    issue = validateSimpleBinding(value.evaluator_binding, '/evaluator_binding', 'admitted')
    if (issue) return rejected(issue)
    issue = validatePublicationBinding(value.publication_binding, '/publication_binding')
    if (issue) return rejected(issue)
    issue = validateOperationBinding(value.operation_binding, '/operation_binding')
    if (issue) return rejected(issue)
    issue = validateSimpleBinding(value.transport_binding, '/transport_binding', 'admitted')
    if (issue) return rejected(issue)
    issue = validatePriorAttemptBinding(value.prior_attempt_binding, '/prior_attempt_binding')
    if (issue) return rejected(issue)
    issue = validateWriteState(value.write_state, '/write_state')
    if (issue) return rejected(issue)
    issue = validateReceiptStoreBinding(value.receipt_store_binding, '/receipt_store_binding')
    if (issue) return rejected(issue)
    issue = validateReceiptDisposition(value.receipt_disposition, '/receipt_disposition')
    if (issue) return rejected(issue)
    if (!Array.isArray(value.diagnostics)) {
      return rejected(rejection('invalid_type_or_format', '/diagnostics'))
    }
    if (
      ((value.kind === 'applied' || value.kind === 'already_current') &&
        value.diagnostics.length !== 0) ||
      ((value.kind === 'stopped' || value.kind === 'reconciliation_required') &&
        value.diagnostics.length !== 1)
    ) return rejected(rejection('invalid_conditional_matrix', '/diagnostics'))
    for (let index = 0; index < value.diagnostics.length; index += 1) {
      issue = validateDiagnostic(value.diagnostics[index], `/diagnostics/${index}`)
      if (issue) return rejected(issue)
    }
    if (!isObject(value.branch)) return rejected(rejection('invalid_type_or_format', '/branch'))
    const branch = value.branch
    if (value.kind === 'applied') {
      issue = exact(branch, ['applied'], '/branch')
      if (issue) return rejected(issue)
      issue = exact(
        branch.applied,
        [
          'post_snapshot',
          'observed_projection_sha256',
          'before_non_gate_sha256',
          'after_non_gate_sha256',
        ],
        '/branch/applied',
      )
      if (issue) return rejected(issue)
      const applied = branch.applied as JsonObject
      issue = validateSnapshot(applied.post_snapshot, '/branch/applied/post_snapshot')
      if (issue) return rejected(issue)
      if (
        !digest(applied.observed_projection_sha256) ||
        !digest(applied.before_non_gate_sha256) ||
        applied.after_non_gate_sha256 !== applied.before_non_gate_sha256
      ) return rejected(rejection('invalid_cross_input_binding', '/branch/applied'))
    } else if (value.kind === 'already_current') {
      issue = exact(branch, ['already_current'], '/branch')
      if (issue) return rejected(issue)
      issue = exact(
        branch.already_current,
        [
          'current_snapshot',
          'observed_projection_sha256',
          'observed_non_gate_sha256',
          'current_state_basis',
        ],
        '/branch/already_current',
      )
      if (issue) return rejected(issue)
      const current = branch.already_current as JsonObject
      issue = validateSnapshot(current.current_snapshot, '/branch/already_current/current_snapshot')
      if (issue) return rejected(issue)
      if (
        !digest(current.observed_projection_sha256) ||
        !digest(current.observed_non_gate_sha256) ||
        !['initial_fresh_read', 'authorized_metadata_role_correction'].includes(
          String(current.current_state_basis),
        )
      ) return rejected(rejection('invalid_conditional_matrix', '/branch/already_current'))
    } else if (value.kind === 'stopped') {
      issue = exact(branch, ['stopped'], '/branch')
      if (issue) return rejected(issue)
      issue = exact(
        branch.stopped,
        ['stop_code', 'failed_stage', 'recovery_owner', 'required_evidence_urls'],
        '/branch/stopped',
      )
      if (issue) return rejected(issue)
      const stopped = branch.stopped as JsonObject
      if (
        typeof stopped.stop_code !== 'string' ||
        !stopCodes.has(stopped.stop_code as DiagnosticCodeV1) ||
        typeof stopped.failed_stage !== 'string' ||
        !stages.has(stopped.failed_stage) ||
        !role(stopped.recovery_owner)
      ) return rejected(rejection('invalid_conditional_matrix', '/branch/stopped'))
      issue = validateStringSet(
        stopped.required_evidence_urls,
        '/branch/stopped/required_evidence_urls',
        canonicalUrl,
      )
      if (issue) return rejected(issue)
      const diagnostic = value.diagnostics[0] as JsonObject
      if (diagnostic.code !== stopped.stop_code) {
        return rejected(rejection('invalid_cross_input_binding', '/diagnostics/0/code'))
      }
    } else {
      issue = exact(branch, ['reconciliation_required'], '/branch')
      if (issue) return rejected(issue)
      issue = exact(
        branch.reconciliation_required,
        [
          'reconciliation_code',
          'last_observation',
          'reconciliation_owner',
          'procedure',
          'retry_write_allowed',
          'required_evidence_urls',
        ],
        '/branch/reconciliation_required',
      )
      if (issue) return rejected(issue)
      const reconciliation = branch.reconciliation_required as JsonObject
      if (
        typeof reconciliation.reconciliation_code !== 'string' ||
        !reconciliationCodes.has(reconciliation.reconciliation_code as DiagnosticCodeV1) ||
        !role(reconciliation.reconciliation_owner) ||
        reconciliation.procedure !== 'fresh_read_only' ||
        reconciliation.retry_write_allowed !== false ||
        !isObject(reconciliation.last_observation)
      ) return rejected(rejection('invalid_conditional_matrix', '/branch/reconciliation_required'))
      if (reconciliation.last_observation.state === 'unavailable') {
        issue = exact(reconciliation.last_observation, ['state'], '/branch/reconciliation_required/last_observation')
      } else {
        issue = exact(
          reconciliation.last_observation,
          ['state', 'snapshot', 'observed_projection_sha256', 'observed_non_gate_sha256'],
          '/branch/reconciliation_required/last_observation',
        )
        if (!issue) {
          const observation = reconciliation.last_observation
          issue = validateSnapshot(
            observation.snapshot,
            '/branch/reconciliation_required/last_observation/snapshot',
          )
          if (
            !issue &&
            !(
              (observation.observed_projection_sha256 === null ||
                digest(observation.observed_projection_sha256)) &&
              (observation.observed_non_gate_sha256 === null ||
                digest(observation.observed_non_gate_sha256))
            )
          ) issue = rejection('invalid_type_or_format', '/branch/reconciliation_required/last_observation')
        }
      }
      if (issue) return rejected(issue)
      issue = validateStringSet(
        reconciliation.required_evidence_urls,
        '/branch/reconciliation_required/required_evidence_urls',
        canonicalUrl,
      )
      if (issue) return rejected(issue)
      const diagnostic = value.diagnostics[0] as JsonObject
      if (diagnostic.code !== reconciliation.reconciliation_code) {
        return rejected(rejection('invalid_cross_input_binding', '/diagnostics/0/code'))
      }
    }
    issue = validateResultCrossBindings(value)
    if (issue) return rejected(issue)
    return accepted(value)
  } catch {
    return rejected(rejection('invalid_type_or_format', ''))
  }
}

type RuntimeContext = {
  identity_binding: JsonObject
  evaluator_binding: JsonObject
  publication_binding: JsonObject
  operation_binding: JsonObject
  transport_binding: JsonObject
  prior_attempt_binding: JsonObject
  receipt_store_binding: JsonObject
}

const unavailableContext = (): RuntimeContext => ({
  identity_binding: { state: 'unavailable' },
  evaluator_binding: { state: 'unavailable' },
  publication_binding: { state: 'unavailable' },
  operation_binding: { state: 'unavailable' },
  transport_binding: { state: 'unavailable' },
  prior_attempt_binding: { state: 'unavailable' },
  receipt_store_binding: { state: 'unavailable' },
})

const diagnostic = (
  code: DiagnosticCodeV1,
  path: string,
  evidenceUrls: readonly string[],
) => ({
  code,
  path,
  message: diagnosticCatalog[code],
  evidence_urls: [...evidenceUrls].sort(byteCompare),
})

const admitResult = (candidate: JsonObject, terminal: JsonObject): GateStatusPublicationResultV1 => {
  const admission = validateGateStatusPublicationResultV1(candidate)
  if (admission.accepted) return admission.value
  const terminalAdmission = validateGateStatusPublicationResultV1(terminal)
  return terminalAdmission.accepted ? terminalAdmission.value : cloneFreeze(terminal)
}

const stoppedResult = (
  context: RuntimeContext,
  code: DiagnosticCodeV1,
  stage: string,
  path: string,
  recoveryOwner: RoleV1,
  evidenceUrls: readonly string[],
): GateStatusPublicationResultV1 => {
  const terminal = {
    contract_version: GATE_STATUS_PUBLICATION_RESULT_V1,
    kind: 'stopped',
    ...unavailableContext(),
    write_state: { attempted: false, observed: false, verified: false, confirmation: 'none' },
    receipt_disposition: { state: 'not_performed', reason: 'publication_stopped' },
    diagnostics: [diagnostic('internal_failure_before_submission', '', [])],
    branch: {
      stopped: {
        stop_code: 'internal_failure_before_submission',
        failed_stage: 'S1_structural_admission',
        recovery_owner: 'backend_implementer',
        required_evidence_urls: [],
      },
    },
  }
  const candidate = {
    contract_version: GATE_STATUS_PUBLICATION_RESULT_V1,
    kind: 'stopped',
    ...context,
    write_state: { attempted: false, observed: false, verified: false, confirmation: 'none' },
    receipt_disposition: { state: 'not_performed', reason: 'publication_stopped' },
    diagnostics: [diagnostic(code, path, evidenceUrls)],
    branch: {
      stopped: {
        stop_code: code,
        failed_stage: stage,
        recovery_owner: recoveryOwner,
        required_evidence_urls: [...evidenceUrls].sort(byteCompare),
      },
    },
  }
  return admitResult(candidate, terminal)
}

const reconciliationResult = (
  context: RuntimeContext,
  code: DiagnosticCodeV1,
  writeState: JsonObject,
  receiptDisposition: JsonObject,
  owner: RoleV1,
  evidenceUrls: readonly string[],
  lastObservation: JsonObject,
  diagnosticPath = '/branch/reconciliation_required',
): GateStatusPublicationResultV1 => {
  const terminal = stoppedResult(
    unavailableContext(),
    'internal_failure_before_submission',
    'S1_structural_admission',
    '',
    'backend_implementer',
    [],
  ) as JsonObject
  const candidate = {
    contract_version: GATE_STATUS_PUBLICATION_RESULT_V1,
    kind: 'reconciliation_required',
    ...context,
    write_state: writeState,
    receipt_disposition: receiptDisposition,
    diagnostics: [diagnostic(code, diagnosticPath, evidenceUrls)],
    branch: {
      reconciliation_required: {
        reconciliation_code: code,
        last_observation: lastObservation,
        reconciliation_owner: owner,
        procedure: 'fresh_read_only',
        retry_write_allowed: false,
        required_evidence_urls: [...evidenceUrls].sort(byteCompare),
      },
    },
  }
  return admitResult(candidate, terminal)
}

const validCanonicalRead = (
  result: unknown,
  url: string,
): result is Extract<CanonicalRecordReadResultV1, { readonly state: 'available' }> => {
  if (!isObject(result)) return false
  if (result.state === 'unavailable') return exact(result, ['state'], '') === undefined
  if (result.state !== 'available' || result.canonical_url !== url) return false
  if (result.source_kind === 'canonical_body') {
    return exact(
      result,
      [
        'state',
        'source_kind',
        'canonical_url',
        'body_utf8',
        'fetched_content_sha256',
        'content',
        'content_projection_sha256',
      ],
      '',
    ) === undefined &&
      typeof result.body_utf8 === 'string' &&
      digest(result.fetched_content_sha256) &&
      digest(result.content_projection_sha256)
  }
  if (result.source_kind === 'github_resource') {
    return exact(
      result,
      [
        'state',
        'source_kind',
        'canonical_url',
        'source',
        'fetched_content_sha256',
        'content',
        'content_projection_sha256',
      ],
      '',
    ) === undefined &&
      isObject(result.source) &&
      digest(result.fetched_content_sha256) &&
      digest(result.content_projection_sha256)
  }
  return false
}

const canonicalReadUnavailable = (result: unknown) =>
  isObject(result) && result.state === 'unavailable' && exact(result, ['state'], '') === undefined

const validateAtomicRevisionObservation = (
  value: unknown,
  transport?: JsonObject,
): boolean => {
  if (!isObject(value)) return false
  if (value.state === 'unavailable') {
    return exact(value, ['state'], '') === undefined
  }
  if (
    value.state !== 'available' ||
    exact(
      value,
      [
        'state',
        'provider',
        'adapter_id',
        'adapter_version',
        'atomic_scope',
        'revision_identity',
      ],
      '',
    ) !== undefined ||
    !isObject(value.revision_identity)
  ) return false
  const revision = value.revision_identity
  if (
    exact(
      revision,
      ['contract_version', 'identity_kind', 'normalized_identity_sha256'],
      '',
    ) !== undefined ||
    revision.contract_version !== 'provider-atomic-revision-identity-v1' ||
    revision.identity_kind !== 'exact_value_frozen_by_transport_capability_authority' ||
    !digest(revision.normalized_identity_sha256)
  ) return false
  return transport === undefined ||
    (
      value.provider === transport.provider &&
      value.adapter_id === transport.adapter_id &&
      value.adapter_version === transport.adapter_version &&
      value.atomic_scope === transport.atomic_scope
    )
}

const validFreshPrRead = (
  result: unknown,
  transport: JsonObject,
): result is Extract<FreshPrReadResultV1, { readonly state: 'available' }> => {
  if (!isObject(result) || result.state !== 'available') return false
  const requiresRevision =
    transport.kind === 'proven_atomic_compare_and_swap'
  const fields = [
    'state',
    'snapshot',
    'body_utf8',
    ...(requiresRevision ? ['atomic_revision_observation'] : []),
  ]
  if (exact(result, fields, '') !== undefined) return false
  return validateSnapshot(result.snapshot, '/snapshot') === undefined &&
    typeof result.body_utf8 === 'string' &&
    (
      !requiresRevision ||
      validateAtomicRevisionObservation(
        result.atomic_revision_observation,
        transport,
      )
    ) &&
    sha256Bytes(new TextEncoder().encode(result.body_utf8)) ===
      (result.snapshot as JsonObject).body_utf8_sha256
}

const freshPrUnavailable = (result: unknown) =>
  isObject(result) && result.state === 'unavailable' && exact(result, ['state'], '') === undefined

const atomicResultState = (result: unknown): string | null => {
  if (!isObject(result) || typeof result.state !== 'string') return null
  if (result.state === 'applied') {
    return exact(result, ['state', 'normalized_revision_identity_sha256'], '') === undefined &&
      digest(result.normalized_revision_identity_sha256)
      ? result.state
      : null
  }
  return ['precondition_failed', 'failed_before_write', 'indeterminate'].includes(result.state) &&
    exact(result, ['state'], '') === undefined
    ? result.state
    : null
}

const receiptResultState = (result: unknown): string | null => {
  if (!isObject(result) || typeof result.state !== 'string') return null
  if (result.state === 'created' || result.state === 'existing_exact') {
    if (exact(result, ['state', 'receipt_url', 'receipt'], '') !== undefined) return null
    return canonicalUrl(result.receipt_url) &&
      validateGateStatusPublicationReceiptV1(result.receipt).accepted
      ? result.state
      : null
  }
  return ['existing_conflict', 'failed_before_commit', 'indeterminate'].includes(result.state) &&
    exact(result, ['state'], '') === undefined
    ? result.state
    : null
}

const evidenceUrlsFrom = (input: JsonObject): string[] =>
  [
    ...(input.evidence_records as JsonObject[]).map((item) => String(item.canonical_url)),
    ...((input.role_authority_set as JsonObject).records as JsonObject[])
      .map((item) => String(item.canonical_url)),
  ].sort(byteCompare)

const publicationContext = (input: JsonObject): RuntimeContext => {
  const identity = input.identity as JsonObject
  const evaluator = input.evaluator as JsonObject
  const result = evaluator.result as JsonObject
  const publicationKey = buildGateStatusPublicationKeyV1(input)
  const projection = (input.projection_authorization as JsonObject).projection
  return {
    identity_binding: { state: 'admitted', value: identity },
    evaluator_binding: {
      state: 'admitted',
      value: {
        contract_version: result.contract_version,
        input_fingerprint: result.input_fingerprint,
        result_sha256: evaluator.result_sha256,
      },
    },
    publication_binding: {
      state: 'available',
      publication_key: publicationKey,
      intended_projection_sha256: gateStatusJcsSha256V1(projection),
      canonical_citation_urls: evidenceUrlsFrom(input),
    },
    operation_binding: { state: 'unavailable' },
    transport_binding: { state: 'unavailable' },
    prior_attempt_binding: { state: 'unavailable' },
    receipt_store_binding: { state: 'unavailable' },
  }
}

type DerivedEvidenceMember = {
  readonly evidence: Readonly<JsonObject>
  readonly semantics: Readonly<JsonObject> | null
}

const currentHeadEvidence = (
  member: DerivedEvidenceMember,
  expectedHead: unknown,
) =>
  isObject(member.evidence.head_binding) &&
  member.evidence.head_binding.state === 'current' &&
  member.evidence.head_binding.head === expectedHead

const semanticsProvesStatus = (
  member: DerivedEvidenceMember,
  expectedKind: 'final_regression_result' | 'operational_validation_result',
  value: unknown,
  expectedHead: unknown,
) => {
  const semantics = member.semantics
  if (
    !semantics ||
    semantics.semantic_branch !== 'validation_result' ||
    semantics.evidence_kind !== expectedKind ||
    !isObject(semantics.head_binding) ||
    semantics.head_binding.head !== expectedHead
  ) return false
  return value === 'completed'
    ? semantics.result === 'PASS'
    : value === 'blocked'
      ? semantics.result === 'BLOCKED'
      : false
}

const semanticsProvesAction = (
  member: DerivedEvidenceMember,
  protectedAction: string,
  value: unknown,
  expectedHead: unknown,
) => {
  const semantics = member.semantics
  if (
    !semantics ||
    semantics.semantic_branch !== 'protected_action_result' ||
    semantics.evidence_kind !== 'protected_action_completion' ||
    semantics.protected_action !== protectedAction ||
    !isObject(semantics.head_binding) ||
    semantics.head_binding.head !== expectedHead
  ) return false
  return semantics.action_result === value
}

const validateDerivedEvidenceBinding = (
  input: JsonObject,
  projection: JsonObject,
  requirement: JsonObject,
  admitted: ReadonlyMap<string, DerivedEvidenceMember>,
): string | null => {
  const identity = input.identity as JsonObject
  const snapshot = (input.pr_snapshot as JsonObject).snapshot as JsonObject
  const authorizationUrl = String(identity.projection_authority_url)
  const expectedHead = identity.expected_head
  const checkUrls = (
    rowName: string,
    urls: unknown,
    predicate: (member: DerivedEvidenceMember) => boolean,
    passiveAllowed = false,
  ): string | null => {
    if (!Array.isArray(urls)) return `/${rowName}/evidence_urls`
    for (let index = 0; index < urls.length; index += 1) {
      const member = admitted.get(String(urls[index]))
      if ((!member && !passiveAllowed) || (member && !predicate(member))) {
        return `/${rowName}/evidence_urls/${index}`
      }
    }
    return null
  }
  const currentHead = projection.current_head as JsonObject
  if (
    currentHead.value !== expectedHead ||
    currentHead.value !== requirement.current_head
  ) return '/current_head/value'
  let issue = checkUrls(
    'current_head',
    currentHead.evidence_urls,
    (member) =>
      member.evidence.evidence_kind === 'projection_authorization' &&
      member.evidence.canonical_url === authorizationUrl,
  )
  if (issue) return issue

  const prState = projection.pr_state_draft as JsonObject
  const expectedPrState =
    snapshot.state === 'open'
      ? snapshot.draft === true
        ? 'open_draft'
        : 'open_ready'
      : 'closed'
  if (prState.value !== expectedPrState) return '/pr_state_draft/value'
  issue = checkUrls(
    'pr_state_draft',
    prState.evidence_urls,
    (member) =>
      member.evidence.evidence_kind === 'projection_authorization' &&
      member.evidence.canonical_url === authorizationUrl,
  )
  if (issue) return issue

  const validationRows = [
    ['final_regression', 'final_regression_result'],
    ['operational_validation', 'operational_validation_result'],
  ] as const
  for (const [rowName, evidenceKind] of validationRows) {
    const row = projection[rowName] as JsonObject
    issue = checkUrls(
      rowName,
      row.evidence_urls,
      (member) => {
        if (
          member.evidence.evidence_kind !== evidenceKind ||
          !currentHeadEvidence(member, expectedHead)
        ) return false
        return ['completed', 'blocked'].includes(String(row.value))
          ? semanticsProvesStatus(member, evidenceKind, row.value, expectedHead)
          : ['pending', 'unperformed'].includes(String(row.value))
      },
      ['pending', 'unperformed'].includes(String(row.value)),
    )
    if (issue) return issue
    if (
      ['completed', 'blocked'].includes(String(row.value)) &&
      (row.evidence_urls as unknown[]).length === 0
    ) return `/${rowName}/evidence_urls`
    if (row.value === 'historical_at_prior_head') return `/${rowName}/value`
  }

  const actionRows = [
    ['ready', 'ready_for_review'],
    ['approve', 'approve'],
    ['merge', 'normal_merge_commit'],
  ] as const
  for (const [rowName, protectedAction] of actionRows) {
    const row = projection[rowName] as JsonObject
    issue = checkUrls(
      rowName,
      row.evidence_urls,
      (member) => {
        if (!currentHeadEvidence(member, expectedHead)) return false
        if (['pending', 'unperformed'].includes(String(row.value))) {
          return rowName === 'ready'
            ? member.evidence.evidence_kind === 'protected_action_completion' &&
                member.evidence.protected_action === protectedAction
            : member.evidence.evidence_kind === 'product_owner_approval' ||
                (
                  member.evidence.evidence_kind === 'protected_action_completion' &&
                  member.evidence.protected_action === protectedAction
                )
        }
        return ['completed', 'blocked'].includes(String(row.value)) &&
          semanticsProvesAction(member, protectedAction, row.value, expectedHead)
      },
      ['pending', 'unperformed'].includes(String(row.value)),
    )
    if (issue) return issue
    if (
      ['completed', 'blocked'].includes(String(row.value)) &&
      (row.evidence_urls as unknown[]).length === 0
    ) return `/${rowName}/evidence_urls`
    if (row.value === 'historical_at_prior_head') return `/${rowName}/value`
  }

  const blocker = projection.current_blocker_next_gate as JsonObject
  const expectedBlocker = hasOwn(requirement, 'current_blocker')
    ? requirement.current_blocker
    : null
  const expectedOwner = hasOwn(requirement, 'next_gate_owner')
    ? requirement.next_gate_owner
    : null
  if (blocker.blocker_id !== expectedBlocker) {
    return '/current_blocker_next_gate/blocker_id'
  }
  if (blocker.next_owner !== expectedOwner) {
    return '/current_blocker_next_gate/next_owner'
  }
  if (
    (expectedOwner === null && blocker.next_action !== null) ||
    (expectedOwner !== null && blocker.next_action === null)
  ) return '/current_blocker_next_gate/next_action'
  const nonNullTriple =
    blocker.blocker_id !== null ||
    blocker.next_action !== null ||
    blocker.next_owner !== null
  issue = checkUrls(
    'current_blocker_next_gate',
    blocker.evidence_urls,
    (member) => {
      if (
        !currentHeadEvidence(member, expectedHead) ||
        !['review_decision', 'result_handoff'].includes(
          String(member.evidence.evidence_kind),
        )
      ) return false
      if (!nonNullTriple) {
        return member.evidence.evidence_kind === 'review_decision' &&
          member.semantics === null
      }
      const semantics = member.semantics
      return semantics !== null &&
        semantics.semantic_branch === 'blocker_transition' &&
        semantics.blocker_id === blocker.blocker_id &&
        semantics.next_action === blocker.next_action &&
        semantics.next_owner === blocker.next_owner
    },
    !nonNullTriple,
  )
  if (issue) return issue
  if (
    nonNullTriple &&
    (blocker.evidence_urls as unknown[]).length === 0
  ) return '/current_blocker_next_gate/evidence_urls'

  const historical = projection.historical_evidence as JsonObject[]
  for (let index = 0; index < historical.length; index += 1) {
    const item = historical[index]
    const member = admitted.get(String(item.evidence_url))
    const binding = member?.evidence.head_binding
    if (
      !member ||
      !isObject(binding) ||
      binding.state !== 'historical' ||
      binding.head !== item.head
    ) return `/historical_evidence/${index}/evidence_url`
  }
  return null
}

type ExactCanonicalDecoderId =
  | 'prior_attempt_authority_set_v1'
  | 'prior_attempt_authority_record_v1'
  | 'receipt_authority_authorized_v1'
  | 'receipt_store_capability_v1'
  | 'prior_attempt_reconciliation_observation_v1'
  | 'proven_atomic_transport_capability_v1'

const exactCanonicalDecoderWrapper: Readonly<
  Record<ExactCanonicalDecoderId, string>
> = {
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

const reconstructExactCanonicalControl = (
  decoder: ExactCanonicalDecoderId,
  body: string,
  bodyDigest: string,
): JsonObject | null => {
  const wrapper = firstYamlAuthority(body)
  const wrapperKey = exactCanonicalDecoderWrapper[decoder]
  if (
    !wrapper ||
    Object.keys(wrapper).length !== 1 ||
    Object.keys(wrapper)[0] !== wrapperKey ||
    !isObject(wrapper[wrapperKey])
  ) return null
  const payload = structuredClone(wrapper[wrapperKey]) as JsonObject
  if (
    decoder === 'prior_attempt_authority_set_v1' ||
    decoder === 'prior_attempt_authority_record_v1' ||
    decoder === 'prior_attempt_reconciliation_observation_v1'
  ) {
    if (hasOwn(payload, 'fetched_content_sha256')) return null
    payload.fetched_content_sha256 = bodyDigest
  }
  let issue: GateStatusAdmissionRejectionV1 | undefined
  if (decoder === 'prior_attempt_authority_set_v1') {
    const admission = validatePriorAttemptAuthoritySetInputV1(payload)
    if (!admission.accepted) return null
    return admission.value as JsonObject
  }
  if (decoder === 'prior_attempt_authority_record_v1') {
    issue = validatePriorRecord(payload, '')
  } else if (decoder === 'receipt_authority_authorized_v1') {
    issue = validateReceiptAuthority(payload, '')
    if (payload.state !== 'authorized') return null
  } else if (decoder === 'receipt_store_capability_v1') {
    issue = validateReceiptStoreCapability(
      { state: 'admitted', value: payload },
      '',
    )
  } else if (decoder === 'prior_attempt_reconciliation_observation_v1') {
    const admission =
      validatePriorAttemptReconciliationObservationInputV1(payload)
    if (!admission.accepted) return null
    return admission.value as JsonObject
  } else {
    issue = validateTransport(payload, '')
    if (payload.kind !== 'proven_atomic_compare_and_swap') return null
  }
  return issue === undefined ? payload : null
}

const exactContentRead = async (
  ports: GateStatusPublisherPortsV1,
  decoder: ExactCanonicalDecoderId,
  url: string,
  expectedContent: unknown,
  expectedDigest?: string,
): Promise<'valid' | 'unavailable' | 'invalid'> => {
  let result: unknown
  try {
    result = await ports.read_canonical_record(url)
  } catch {
    return 'unavailable'
  }
  if (canonicalReadUnavailable(result)) return 'unavailable'
  if (!validCanonicalRead(result, url)) return 'invalid'
  if (result.source_kind !== 'canonical_body') return 'invalid'
  const rawDigest = sha256Utf8(result.body_utf8)
  if (
    rawDigest !== result.fetched_content_sha256 ||
    (expectedDigest !== undefined && rawDigest !== expectedDigest)
  ) return 'invalid'
  const reconstructed = reconstructExactCanonicalControl(
    decoder,
    result.body_utf8,
    rawDigest,
  )
  if (
    reconstructed === null ||
    gateStatusJcsSha256V1(reconstructed) !== result.content_projection_sha256 ||
    canonicalize(reconstructed) !== canonicalize(result.content) ||
    canonicalize(reconstructed) !== canonicalize(expectedContent)
  ) return 'invalid'
  return 'valid'
}

const makeReceiptCandidate = (
  input: JsonObject,
  context: RuntimeContext,
  operationKey: string,
  preSnapshot: JsonObject,
  postSnapshot: JsonObject,
  nonGate: string,
  resultKind: 'applied' | 'already_current',
): GateStatusPublicationReceiptV1 => {
  const identity = input.identity as JsonObject
  const evaluator = input.evaluator as JsonObject
  const evaluatorResult = evaluator.result as JsonObject
  const publication = context.publication_binding
  const authority = input.receipt_authority as JsonObject
  return cloneFreeze({
    contract_version: GATE_STATUS_PUBLICATION_RECEIPT_V1,
    publication_key: publication.publication_key,
    successful_operation_key: operationKey,
    task_id: identity.task_id,
    assignment_revision: identity.assignment_revision,
    repository: identity.repository,
    pr_url: identity.pr_url,
    pr_number: identity.pr_number,
    head: identity.expected_head,
    base: identity.expected_base,
    authorized_metadata_role: identity.authorized_metadata_role,
    projection_authority_url: identity.projection_authority_url,
    evaluator_input_fingerprint: evaluatorResult.input_fingerprint,
    evaluator_result_sha256: evaluator.result_sha256,
    intended_projection_sha256: publication.intended_projection_sha256,
    observed_projection_sha256: publication.intended_projection_sha256,
    pre_snapshot: preSnapshot,
    post_snapshot: postSnapshot,
    before_non_gate_sha256: nonGate,
    after_non_gate_sha256: nonGate,
    canonical_citation_urls: publication.canonical_citation_urls,
    result_kind: resultKind,
    receipt_url: authority.canonical_record,
  })
}

const receiptForVerifiedBody = async (
  input: JsonObject,
  context: RuntimeContext,
  ports: GateStatusPublisherPortsV1,
  operationKey: string,
  preSnapshot: JsonObject,
  postSnapshot: JsonObject,
  nonGate: string,
  resultKind: 'applied' | 'already_current',
): Promise<
  | { readonly kind: 'success'; readonly disposition: JsonObject }
  | { readonly kind: 'reconciliation'; readonly code: DiagnosticCodeV1; readonly disposition: JsonObject }
> => {
  const authority = input.receipt_authority as JsonObject
  if (authority.state === 'not_authorized') {
    return { kind: 'success', disposition: { state: 'not_authorized' } }
  }
  const priorReceipt = input.prior_receipt as JsonObject
  const owner = authority.owner_role as RoleV1
  const publicationKey = context.publication_binding.publication_key as string
  if (priorReceipt.state === 'present') {
    return {
      kind: 'success',
      disposition: {
        state: 'reused',
        owner_role: owner,
        receipt_url: priorReceipt.receipt_url,
        receipt_key: publicationKey,
      },
    }
  }
  const candidate = makeReceiptCandidate(
    input,
    context,
    operationKey,
    preSnapshot,
    postSnapshot,
    nonGate,
    resultKind,
  )
  let result: unknown
  try {
    result = await ports.receipt_create_or_get({ publication_key: publicationKey, candidate })
  } catch {
    return {
      kind: 'reconciliation',
      code: 'receipt_store_unavailable_after_body_verified',
      disposition: { state: 'not_performed', reason: 'receipt_store_failed_before_commit' },
    }
  }
  const state = receiptResultState(result)
  if (state === 'created' || state === 'existing_exact') {
    const available = result as Extract<
      ReceiptCreateOrGetResultV1,
      { readonly state: 'created' | 'existing_exact' }
    >
    const admitted = validateGateStatusPublicationReceiptV1(available.receipt)
    if (
      !admitted.accepted ||
      (admitted.value as JsonObject).publication_key !== publicationKey ||
      available.receipt_url !== (admitted.value as JsonObject).receipt_url ||
      canonicalize(admitted.value) !== canonicalize(candidate)
    ) {
      return {
        kind: 'reconciliation',
        code: 'receipt_conflict',
        disposition: { state: 'not_performed', reason: 'receipt_conflict' },
      }
    }
    return {
      kind: 'success',
      disposition: {
        state: state === 'created' ? 'created' : 'reused',
        owner_role: owner,
        receipt_url: available.receipt_url,
        receipt_key: publicationKey,
      },
    }
  }
  if (state === 'existing_conflict') {
    return {
      kind: 'reconciliation',
      code: 'receipt_conflict',
      disposition: { state: 'not_performed', reason: 'receipt_conflict' },
    }
  }
  if (state === 'failed_before_commit' || state === null) {
    return {
      kind: 'reconciliation',
      code: 'receipt_store_unavailable_after_body_verified',
      disposition: { state: 'not_performed', reason: 'receipt_store_failed_before_commit' },
    }
  }
  return {
    kind: 'reconciliation',
    code: 'receipt_indeterminate',
    disposition: {
      state: 'verification_required',
      owner_role: owner,
      publication_key: publicationKey,
      reason: 'receipt_store_outcome_indeterminate',
    },
  }
}

const alreadyCurrentResult = (
  context: RuntimeContext,
  snapshot: JsonObject,
  nonGate: string,
  disposition: JsonObject,
  basis: 'initial_fresh_read' | 'authorized_metadata_role_correction',
): GateStatusPublicationResultV1 => {
  const terminal = stoppedResult(
    unavailableContext(),
    'internal_failure_before_submission',
    'S1_structural_admission',
    '',
    'backend_implementer',
    [],
  ) as JsonObject
  return admitResult(
    {
      contract_version: GATE_STATUS_PUBLICATION_RESULT_V1,
      kind: 'already_current',
      ...context,
      write_state: {
        attempted: false,
        observed: false,
        verified: true,
        confirmation: 'already_current_read',
      },
      receipt_disposition: disposition,
      diagnostics: [],
      branch: {
        already_current: {
          current_snapshot: snapshot,
          observed_projection_sha256: context.publication_binding.intended_projection_sha256,
          observed_non_gate_sha256: nonGate,
          current_state_basis: basis,
        },
      },
    },
    terminal,
  )
}

const appliedResult = (
  context: RuntimeContext,
  postSnapshot: JsonObject,
  nonGate: string,
  disposition: JsonObject,
  confirmation: 'direct_response_and_readback' | 'reconciled_after_indeterminate',
): GateStatusPublicationResultV1 => {
  const terminal = stoppedResult(
    unavailableContext(),
    'internal_failure_before_submission',
    'S1_structural_admission',
    '',
    'backend_implementer',
    [],
  ) as JsonObject
  return admitResult(
    {
      contract_version: GATE_STATUS_PUBLICATION_RESULT_V1,
      kind: 'applied',
      ...context,
      write_state: {
        attempted: true,
        observed: true,
        verified: true,
        confirmation,
      },
      receipt_disposition: disposition,
      diagnostics: [],
      branch: {
        applied: {
          post_snapshot: postSnapshot,
          observed_projection_sha256: context.publication_binding.intended_projection_sha256,
          before_non_gate_sha256: nonGate,
          after_non_gate_sha256: nonGate,
        },
      },
    },
    terminal,
  )
}

const receiptObservation = (snapshot: JsonObject, projection: string, nonGate: string) => ({
  state: 'available',
  snapshot,
  observed_projection_sha256: projection,
  observed_non_gate_sha256: nonGate,
})

export async function publishGateStatusV1(
  rawInput: unknown,
  ports: GateStatusPublisherPortsV1,
): Promise<GateStatusPublicationResultV1> {
  let submitted = false
  let context = unavailableContext()
  let recoveryOwner: RoleV1 = 'backend_implementer'
  try {
    const inputAdmission = validateGateStatusPublicationInputV1(rawInput)
    if (!inputAdmission.accepted) {
      return stoppedResult(
        context,
        structuralStopCode(inputAdmission.rejection),
        'S1_structural_admission',
        inputAdmission.rejection.path,
        recoveryOwner,
        [],
      )
    }
    const input = inputAdmission.value as JsonObject
    const identity = input.identity as JsonObject
    recoveryOwner = identity.authorized_metadata_role as RoleV1
    context = publicationContext(input)
    const citations = evidenceUrlsFrom(input)

    const authorization = input.projection_authorization as JsonObject

    const evaluator = input.evaluator as JsonObject
    const evaluatorResult = evaluator.result as JsonObject
    const evaluatorGateRequirement = evaluatorResult.gate_status_requirement as JsonObject
    if (
      evaluatorResult.task_id !== identity.task_id ||
      (evaluatorGateRequirement.required === true &&
        (evaluatorGateRequirement.pr !== identity.pr_url ||
          evaluatorGateRequirement.current_head !== identity.expected_head))
    ) {
      return stoppedResult(
        context,
        'identity_mismatch',
        'S3_identity_binding',
        '/evaluator/result',
        recoveryOwner,
        citations,
      )
    }
    const evaluatorAdmission = validateAutomaticGateProgressionEvaluationResultV2(evaluatorResult)
    if (evaluatorAdmission.kind !== 'accepted') {
      return stoppedResult(
        context,
        'evaluator_authority_invalid',
        'S4_evaluator_admission',
        '/evaluator/result',
        recoveryOwner,
        citations,
      )
    }
    if (evaluatorAdmission.value.kind !== 'require_gate_status_update') {
      return stoppedResult(
        context,
        'gate_status_update_not_required',
        'S4_evaluator_admission',
        '/evaluator/result/kind',
        'integrated_lead',
        citations,
      )
    }
    const projectionAdmission = validateGateStatusProjectionV1(authorization.projection)
    if (!projectionAdmission.accepted) {
      return stoppedResult(
        context,
        'projection_authority_invalid',
        'S5_projection_admission',
        `/projection_authorization/projection${projectionAdmission.rejection.path}`,
        recoveryOwner,
        citations,
      )
    }
    const projection = projectionAdmission.value as JsonObject

    const evidenceRecords = input.evidence_records as JsonObject[]
    const expectedEvidenceUrls = [
      ...new Set([
        ...evaluatorAdmission.value.requirement.citation_urls,
        String(identity.task_assignment_url),
        String(identity.projection_authority_url),
      ]),
    ].sort(byteCompare)
    const actualEvidenceUrls = evidenceRecords.map((evidence) => String(evidence.canonical_url))
    const expectedEvidenceSet = new Set(expectedEvidenceUrls)
    const actualEvidenceSet = new Set(actualEvidenceUrls)
    const missingEvidence = expectedEvidenceUrls.filter((url) => !actualEvidenceSet.has(url))
    const extraEvidence = actualEvidenceUrls.filter((url) => !expectedEvidenceSet.has(url))
    if (missingEvidence.length > 0 || extraEvidence.length > 0) {
      return stoppedResult(
        context,
        'canonical_evidence_invalid',
        'S6_evidence_admission',
        '/evidence_records',
        recoveryOwner,
        actualEvidenceUrls,
      )
    }
    const roleAuthorityRecords =
      ((input.role_authority_set as JsonObject).records as JsonObject[])
    const admittedRoleAuthorities = new Map<string, JsonObject>()
    const admittedRoleSemanticIdentities = new Set<string>()
    for (let index = 0; index < roleAuthorityRecords.length; index += 1) {
      const record = roleAuthorityRecords[index]
      let result: unknown
      try {
        result = await ports.read_canonical_record(String(record.canonical_url))
      } catch {
        result = { state: 'unavailable' }
      }
      const member = admitRoleAuthorityRead(result, record)
      if (member.state !== 'valid') {
        return stoppedResult(
          context,
          'canonical_evidence_invalid',
          'S6_evidence_admission',
          `/role_authority_set/records/${index}${member.path}`,
          recoveryOwner,
          [String(record.canonical_url)],
        )
      }
      if (admittedRoleSemanticIdentities.has(member.semantic_identity)) {
        return stoppedResult(
          context,
          'canonical_conflict',
          'S6_evidence_admission',
          '/role_authority_set/records',
          recoveryOwner,
          [String(record.canonical_url)],
        )
      }
      admittedRoleSemanticIdentities.add(member.semantic_identity)
      admittedRoleAuthorities.set(String(record.canonical_url), member.value)
    }
    const admittedAuthorityIdentities = new Set<string>()
    const admittedEvidence = new Map<string, DerivedEvidenceMember>()
    for (let index = 0; index < evidenceRecords.length; index += 1) {
      const evidence = evidenceRecords[index]
      let result: unknown
      try {
        result = await ports.read_canonical_record(String(evidence.canonical_url))
      } catch {
        result = { state: 'unavailable' }
      }
      const member = admitEvidenceRead(result, evidence, input, admittedRoleAuthorities)
      if (member.state !== 'valid') {
        return stoppedResult(
          context,
          'canonical_evidence_invalid',
          'S6_evidence_admission',
          `/evidence_records/${index}${member.path}`,
          recoveryOwner,
          [String(evidence.canonical_url)],
        )
      }
      if (admittedAuthorityIdentities.has(member.authority_identity)) {
        return stoppedResult(
          context,
          'canonical_conflict',
          'S6_evidence_admission',
          '/evidence_records',
          recoveryOwner,
          [String(evidence.canonical_url)],
        )
      }
      admittedAuthorityIdentities.add(member.authority_identity)
      admittedEvidence.set(String(evidence.canonical_url), {
        evidence: member.evidence,
        semantics: member.semantics,
      })
    }

    const requirement = evaluatorAdmission.value.requirement
    const derivedBindingIssue = validateDerivedEvidenceBinding(
      input,
      projection,
      requirement as JsonObject,
      admittedEvidence,
    )
    if (derivedBindingIssue !== null) {
      return stoppedResult(
        context,
        'authority_projection_conflict',
        'S7_stop_consistency',
        `/projection_authorization/projection${derivedBindingIssue}`,
        recoveryOwner,
        citations,
      )
    }
    if (
      JSON.stringify(projection).includes('ready_for_review') ||
      JSON.stringify(projection).includes('normal_merge_commit') ||
      JSON.stringify(projection).includes('dispatch')
    ) {
      return stoppedResult(
        context,
        'forbidden_authority_smuggling',
        'S7_stop_consistency',
        '/projection_authorization/projection',
        'integrated_lead',
        citations,
      )
    }

    const freshReadTransport = input.transport_capability as JsonObject
    let fresh: unknown
    try {
      fresh = await ports.read_pr(String(identity.pr_url))
    } catch {
      fresh = { state: 'unavailable' }
    }
    if (freshPrUnavailable(fresh)) {
      return stoppedResult(
        context,
        'fresh_pr_unavailable',
        'S8_fresh_pr_read',
        '/pr_snapshot',
        recoveryOwner,
        citations,
      )
    }
    if (!validFreshPrRead(fresh, freshReadTransport)) {
      return stoppedResult(
        context,
        'fresh_pr_unavailable',
        'S8_fresh_pr_read',
        '/pr_snapshot',
        recoveryOwner,
        citations,
      )
    }
    const snapshotContainer = input.pr_snapshot as JsonObject
    const expectedSnapshot = snapshotContainer.snapshot as JsonObject
    if (
      canonicalize(fresh.snapshot) !== canonicalize(expectedSnapshot) ||
      fresh.body_utf8 !== snapshotContainer.body_utf8
    ) {
      return stoppedResult(
        context,
        'authority_drift',
        'S8_fresh_pr_read',
        '/pr_snapshot',
        'integrated_lead',
        citations,
      )
    }
    const inspection = inspectGateStatusSectionV1(fresh.body_utf8)
    if (!inspection.valid) {
      return stoppedResult(
        context,
        'gate_status_section_invalid',
        'S9_section_admission',
        '/pr_snapshot/body_utf8',
        recoveryOwner,
        citations,
      )
    }
    const rendered = renderGateStatusProjectionV1(projection)
    if (rendered === null) {
      return stoppedResult(
        context,
        'projection_authority_invalid',
        'S10_render_and_publication_key',
        '/projection_authorization/projection',
        recoveryOwner,
        citations,
      )
    }
    const sectionTail = inspection.section.slice(inspection.section.trimEnd().length)
    const candidateBody =
      fresh.body_utf8.slice(0, inspection.start) +
      rendered +
      sectionTail +
      fresh.body_utf8.slice(inspection.end)
    const candidateInspection = inspectGateStatusSectionV1(candidateBody)
    if (!candidateInspection.valid || candidateInspection.non_gate_sha256 !== inspection.non_gate_sha256) {
      return stoppedResult(
        context,
        'non_gate_mutation_detected',
        'S10_render_and_publication_key',
        '/projection_authorization/projection',
        'backend_implementer',
        citations,
      )
    }

    const transport = input.transport_capability as JsonObject
    context = { ...context, transport_binding: { state: 'admitted', value: transport } }
    if (
      transport.kind === 'github_pr_body_patch_without_atomic_precondition' &&
      (input.receipt_authority as JsonObject).state === 'not_authorized' &&
      ((input.prior_attempt_authorities as JsonObject).records as JsonObject[]).length === 0
    ) {
      return stoppedResult(
        context,
        'atomic_precondition_unavailable',
        'S11_prior_attempt_set_admission',
        '/prior_attempt_reconciliation_observation',
        recoveryOwner,
        citations,
      )
    }

    const priorSet = input.prior_attempt_authorities as JsonObject
    const setRead = await exactContentRead(
      ports,
      'prior_attempt_authority_set_v1',
      String(priorSet.authority_set_url),
      priorSet,
      String(priorSet.fetched_content_sha256),
    )
    if (setRead !== 'valid') {
      context = { ...context, prior_attempt_binding: { state: 'unavailable' } }
      return stoppedResult(
        context,
        setRead === 'unavailable'
          ? 'prior_attempt_authority_unavailable'
          : 'prior_attempt_authority_invalid',
        'S11_prior_attempt_set_admission',
        '/prior_attempt_authorities/authority_set_url',
        recoveryOwner,
        [String(priorSet.authority_set_url)],
      )
    }
    const priorRecords = priorSet.records as JsonObject[]
    for (let index = 0; index < priorRecords.length; index += 1) {
      const record = priorRecords[index]
      const memberRead = await exactContentRead(
        ports,
        'prior_attempt_authority_record_v1',
        String(record.canonical_record),
        record,
        String(record.fetched_content_sha256),
      )
      if (memberRead !== 'valid') {
        return stoppedResult(
          context,
          memberRead === 'unavailable'
            ? 'prior_attempt_authority_unavailable'
            : 'prior_attempt_authority_invalid',
          'S11_prior_attempt_set_admission',
          `/prior_attempt_authorities/records/${index}/canonical_record`,
          recoveryOwner,
          [String(record.canonical_record)],
        )
      }
    }
    if (priorRecords.length > 1) {
      return stoppedResult(
        context,
        'canonical_conflict',
        'S11_prior_attempt_set_admission',
        '/prior_attempt_authorities/records/1',
        recoveryOwner,
        priorRecords.map((record) => String(record.canonical_record)),
      )
    }
    context = {
      ...context,
      prior_attempt_binding:
        priorRecords.length === 0
          ? { state: 'absent' }
          : {
              state: 'indeterminate',
              authority_set_url: priorSet.authority_set_url,
              authority_url: priorRecords[0].canonical_record,
              publication_key: priorRecords[0].publication_key,
              operation_key: priorRecords[0].atomic_operation_key,
              submitted_at: priorRecords[0].submitted_at,
              transport_capability_ref: priorRecords[0].transport_capability_authority_url,
            },
    }

    const receiptAuthority = input.receipt_authority as JsonObject
    const receiptStore = input.receipt_store_capability as JsonObject
    if (receiptAuthority.state === 'authorized') {
      const authorityRead = await exactContentRead(
        ports,
        'receipt_authority_authorized_v1',
        String(receiptAuthority.canonical_record),
        receiptAuthority,
      )
      if (authorityRead !== 'valid') {
        return stoppedResult(
          context,
          'receipt_capability_unavailable',
          'S12_receipt_authority_and_store_admission',
          '/receipt_authority/canonical_record',
          recoveryOwner,
          [String(receiptAuthority.canonical_record)],
        )
      }
      const capability = receiptStore.value as JsonObject
      const capabilityRead = await exactContentRead(
        ports,
        'receipt_store_capability_v1',
        String(capability.capability_authority_url),
        capability,
      )
      if (capabilityRead !== 'valid') {
        return stoppedResult(
          context,
          capabilityRead === 'unavailable'
            ? 'receipt_capability_unavailable'
            : 'receipt_capability_invalid',
          'S12_receipt_authority_and_store_admission',
          '/receipt_store_capability',
          recoveryOwner,
          [String(capability.capability_authority_url)],
        )
      }
      context = {
        ...context,
        receipt_store_binding: {
          state: 'admitted',
          capability_authority_url: capability.capability_authority_url,
          provider: capability.provider,
          adapter_id: capability.adapter_id,
          adapter_version: capability.adapter_version,
          unique_key: context.publication_binding.publication_key,
        },
      }
    } else {
      context = { ...context, receipt_store_binding: { state: 'not_required' } }
    }
    const readOnly = buildGateStatusReadOnlyOperationKeyV1(input)
    if (readOnly === null) {
      return stoppedResult(
        context,
        'internal_failure_before_submission',
        'S13_operation_binding',
        '/operation_binding',
        'backend_implementer',
        citations,
      )
    }
    context = {
      ...context,
      operation_binding: {
        state: 'available',
        read_only_evaluation: readOnly,
        atomic_attempt: { state: 'absent' },
      },
    }

    if (priorRecords.length === 1) {
      const prior = priorRecords[0]
      context = {
        ...context,
        operation_binding: {
          state: 'available',
          read_only_evaluation: readOnly,
          atomic_attempt: {
            state: 'prior_indeterminate',
            authority_url: prior.canonical_record,
            projection: prior.atomic_operation_projection,
            projection_sha256: prior.atomic_operation_projection_sha256,
            operation_key: prior.atomic_operation_key,
          },
        },
      }
      const observation = input.prior_attempt_reconciliation_observation as JsonObject
      if (observation.state === 'not_required') {
        return stoppedResult(
          context,
          'prior_attempt_observation_required',
          'S14_prior_attempt_reconciliation_observation',
          '/prior_attempt_reconciliation_observation/state',
          recoveryOwner,
          [String(prior.canonical_record)],
        )
      }
      const observationRead = await exactContentRead(
        ports,
        'prior_attempt_reconciliation_observation_v1',
        String(observation.canonical_record),
        observation,
        String(observation.fetched_content_sha256),
      )
      if (observationRead === 'invalid') {
        return reconciliationResult(
          context,
          'readback_mismatch',
          {
            attempted: true,
            observed: true,
            verified: false,
            confirmation: 'readback_mismatch',
          },
          { state: 'not_performed', reason: 'write_not_verified' },
          recoveryOwner,
          [String(observation.canonical_record)],
          { state: 'unavailable' },
          '/prior_attempt_reconciliation_observation/canonical_record',
        )
      }
      if (observation.state === 'unavailable' || observationRead === 'unavailable') {
        return reconciliationResult(
          context,
          'post_write_read_unavailable',
          { attempted: true, observed: false, verified: false, confirmation: 'submission_indeterminate' },
          { state: 'not_performed', reason: 'write_not_verified' },
          recoveryOwner,
          [String(observation.canonical_record)],
          { state: 'unavailable' },
        )
      }
      const atomicProjection = prior.atomic_operation_projection as JsonObject
      const observedRevision = (observation.post_read_atomic_revision_identity as JsonObject)
        .normalized_identity_sha256
      const preRevision = (atomicProjection.atomic_revision_identity as JsonObject)
        .normalized_identity_sha256
      const projectionMatches =
        inspection.section.trimEnd() === rendered &&
        observation.observed_projection_sha256 === context.publication_binding.intended_projection_sha256
      const nonGateMatches =
        inspection.non_gate_sha256 === prior.precondition_non_gate_sha256 &&
        observation.observed_non_gate_sha256 === inspection.non_gate_sha256
      const bodyUnchanged =
        fresh.snapshot.body_utf8_sha256 === atomicProjection.precondition_body_utf8_sha256
      if (!projectionMatches || !nonGateMatches || observationRead !== 'valid') {
        return reconciliationResult(
          context,
          'readback_mismatch',
          { attempted: true, observed: true, verified: false, confirmation: 'readback_mismatch' },
          { state: 'not_performed', reason: 'write_not_verified' },
          recoveryOwner,
          [String(observation.canonical_record)],
          receiptObservation(
            fresh.snapshot,
            String(observation.observed_projection_sha256),
            String(observation.observed_non_gate_sha256),
          ),
        )
      }
      if ((bodyUnchanged && observedRevision === preRevision) || observedRevision === preRevision) {
        return reconciliationResult(
          context,
          'write_outcome_unknown',
          { attempted: true, observed: false, verified: false, confirmation: 'submission_indeterminate' },
          { state: 'not_performed', reason: 'write_not_verified' },
          recoveryOwner,
          [String(observation.canonical_record)],
          receiptObservation(
            fresh.snapshot,
            String(observation.observed_projection_sha256),
            String(observation.observed_non_gate_sha256),
          ),
        )
      }
      const receipt = await receiptForVerifiedBody(
        input,
        context,
        ports,
        String(prior.atomic_operation_key),
        expectedSnapshot,
        fresh.snapshot,
        inspection.non_gate_sha256,
        'applied',
      )
      if (receipt.kind === 'reconciliation') {
        return reconciliationResult(
          context,
          receipt.code,
          { attempted: true, observed: true, verified: true, confirmation: 'reconciled_after_indeterminate' },
          receipt.disposition,
          recoveryOwner,
          citations,
          receiptObservation(
            fresh.snapshot,
            String(context.publication_binding.intended_projection_sha256),
            inspection.non_gate_sha256,
          ),
        )
      }
      return appliedResult(
        context,
        fresh.snapshot,
        inspection.non_gate_sha256,
        receipt.disposition,
        'reconciled_after_indeterminate',
      )
    }

    if (inspection.section.trimEnd() === rendered) {
      const receipt = await receiptForVerifiedBody(
        input,
        context,
        ports,
        String(readOnly.operation_key),
        expectedSnapshot,
        fresh.snapshot,
        inspection.non_gate_sha256,
        'already_current',
      )
      if (receipt.kind === 'reconciliation') {
        return reconciliationResult(
          context,
          receipt.code,
          { attempted: false, observed: false, verified: true, confirmation: 'already_current_read' },
          receipt.disposition,
          recoveryOwner,
          citations,
          receiptObservation(
            fresh.snapshot,
            String(context.publication_binding.intended_projection_sha256),
            inspection.non_gate_sha256,
          ),
        )
      }
      return alreadyCurrentResult(
        context,
        fresh.snapshot,
        inspection.non_gate_sha256,
        receipt.disposition,
        'initial_fresh_read',
      )
    }

    if (transport.kind === 'github_pr_body_patch_without_atomic_precondition') {
      return stoppedResult(
        context,
        'atomic_precondition_unavailable',
        'S15_transport_capability',
        '/transport_capability',
        recoveryOwner,
        citations,
      )
    }
    const capabilityRead = await exactContentRead(
      ports,
      'proven_atomic_transport_capability_v1',
      String(transport.capability_authority_url),
      transport,
    )
    if (capabilityRead !== 'valid') {
      return stoppedResult(
        context,
        'atomic_precondition_unavailable',
        'S15_transport_capability',
        '/transport_capability/capability_authority_url',
        'architect_team',
        [String(transport.capability_authority_url)],
      )
    }
    const preRevisionObservation = fresh.atomic_revision_observation
    if (
      !validateAtomicRevisionObservation(preRevisionObservation, transport) ||
      !isObject(preRevisionObservation) ||
      preRevisionObservation.state !== 'available' ||
      !isObject(preRevisionObservation.revision_identity) ||
      preRevisionObservation.revision_identity.normalized_identity_sha256 !==
        (transport.atomic_revision_identity as JsonObject)
          .normalized_identity_sha256
    ) {
      return stoppedResult(
        context,
        'atomic_precondition_unavailable',
        'S16_atomic_precondition',
        '/transport_capability/atomic_revision_identity',
        'architect_team',
        [String(transport.capability_authority_url)],
      )
    }
    const receiptAuthorityState = receiptAuthority.state as string
    const priorReceipt = input.prior_receipt as JsonObject
    const atomicProjection = {
      contract_version: 'gate-status-atomic-operation-key-projection-v1',
      key_kind: 'proven_atomic_attempt',
      publication_key: context.publication_binding.publication_key,
      transport_capability_authority_url: transport.capability_authority_url,
      provider: transport.provider,
      adapter_id: transport.adapter_id,
      adapter_version: transport.adapter_version,
      atomic_scope: 'complete_pr_body',
      atomic_revision_identity: transport.atomic_revision_identity,
      precondition_body_utf8_sha256: fresh.snapshot.body_utf8_sha256,
      precondition_non_gate_sha256: inspection.non_gate_sha256,
      receipt_authority_state: receiptAuthorityState,
      receipt_store_capability_state:
        receiptStore.state === 'admitted' ? 'proven_atomic_create_or_get' : 'not_required',
      prior_receipt_state: priorReceipt.state,
      prior_receipt_url: priorReceipt.state === 'present' ? priorReceipt.receipt_url : null,
    }
    const atomicAdmission = validateAtomicOperationKeyProjectionV1(atomicProjection)
    if (!atomicAdmission.accepted) {
      return stoppedResult(
        context,
        'internal_failure_before_submission',
        'S16_atomic_precondition',
        '/operation_binding/atomic_attempt/projection',
        'backend_implementer',
        citations,
      )
    }
    const atomicSha = gateStatusJcsSha256V1(atomicAdmission.value)
    const atomicKey = `gate-status-publication-atomic-operation-v1:${atomicSha}`
    context = {
      ...context,
      operation_binding: {
        state: 'available',
        read_only_evaluation: readOnly,
        atomic_attempt: {
          state: 'direct',
          authority_url: transport.capability_authority_url,
          projection: atomicAdmission.value,
          projection_sha256: atomicSha,
          operation_key: atomicKey,
        },
      },
    }
    let casResult: unknown
    submitted = true
    try {
      casResult = await ports.compare_and_swap_gate_status({
        pr_url: String(identity.pr_url),
        expected_body_utf8_sha256: String(fresh.snapshot.body_utf8_sha256),
        expected_normalized_revision_identity_sha256: String(
          (transport.atomic_revision_identity as JsonObject).normalized_identity_sha256,
        ),
        replacement_body_utf8: candidateBody,
        atomic_operation_key: atomicKey,
      })
    } catch {
      casResult = { state: 'indeterminate' }
    }
    const casState = atomicResultState(casResult)
    if (casState === 'precondition_failed') {
      submitted = false
      return stoppedResult(
        context,
        'compare_and_swap_failed',
        'S16_atomic_precondition',
        '/operation_binding',
        recoveryOwner,
        citations,
      )
    }
    if (casState === 'failed_before_write' || casState === null) {
      submitted = false
      return stoppedResult(
        context,
        'transport_unavailable_before_write',
        'S17_single_write',
        '/transport_capability',
        recoveryOwner,
        citations,
      )
    }
    let readback: unknown
    try {
      readback = await ports.read_pr(String(identity.pr_url))
    } catch {
      readback = { state: 'unavailable' }
    }
    if (!validFreshPrRead(readback, transport)) {
      return reconciliationResult(
        context,
        'post_write_read_unavailable',
        { attempted: true, observed: false, verified: false, confirmation: 'submission_indeterminate' },
        { state: 'not_performed', reason: 'write_not_verified' },
        recoveryOwner,
        citations,
        { state: 'unavailable' },
      )
    }
    const postRevisionObservation = readback.atomic_revision_observation
    const postRevisionAdmitted =
      validateAtomicRevisionObservation(postRevisionObservation, transport) &&
      isObject(postRevisionObservation) &&
      postRevisionObservation.state === 'available' &&
      isObject(postRevisionObservation.revision_identity)
    const after = inspectGateStatusSectionV1(readback.body_utf8)
    const exactAfter =
      after.valid &&
      after.section.trimEnd() === rendered &&
      after.non_gate_sha256 === inspection.non_gate_sha256 &&
      (readback.snapshot as JsonObject).head === identity.expected_head &&
      (readback.snapshot as JsonObject).base === identity.expected_base
    if (!exactAfter) {
      return reconciliationResult(
        context,
        'readback_mismatch',
        { attempted: true, observed: true, verified: false, confirmation: 'readback_mismatch' },
        { state: 'not_performed', reason: 'write_not_verified' },
        recoveryOwner,
        citations,
        {
          state: 'available',
          snapshot: readback.snapshot,
          observed_projection_sha256: null,
          observed_non_gate_sha256: after.valid ? after.non_gate_sha256 : null,
        },
      )
    }
    const preRevision = (transport.atomic_revision_identity as JsonObject)
      .normalized_identity_sha256
    const postRevision = postRevisionAdmitted
      ? (postRevisionObservation.revision_identity as JsonObject)
        .normalized_identity_sha256
      : null
    if (casState === 'indeterminate') {
      if (!digest(postRevision) || postRevision === preRevision) {
        return reconciliationResult(
          context,
          'write_outcome_unknown',
          { attempted: true, observed: false, verified: false, confirmation: 'submission_indeterminate' },
          { state: 'not_performed', reason: 'write_not_verified' },
          recoveryOwner,
          citations,
          receiptObservation(
            readback.snapshot,
            String(context.publication_binding.intended_projection_sha256),
            after.non_gate_sha256,
          ),
        )
      }
    } else {
      const appliedRevision = (casResult as JsonObject)
        .normalized_revision_identity_sha256
      if (
        !digest(postRevision) ||
        postRevision !== appliedRevision ||
        postRevision === preRevision
      ) {
        return reconciliationResult(
          context,
          'readback_mismatch',
          { attempted: true, observed: true, verified: false, confirmation: 'readback_mismatch' },
          { state: 'not_performed', reason: 'write_not_verified' },
          recoveryOwner,
          citations,
          receiptObservation(
            readback.snapshot,
            String(context.publication_binding.intended_projection_sha256),
            after.non_gate_sha256,
          ),
        )
      }
    }
    const receipt = await receiptForVerifiedBody(
      input,
      context,
      ports,
      atomicKey,
      fresh.snapshot,
      readback.snapshot,
      after.non_gate_sha256,
      'applied',
    )
    if (receipt.kind === 'reconciliation') {
      return reconciliationResult(
        context,
        receipt.code,
        { attempted: true, observed: true, verified: true, confirmation:
          casState === 'indeterminate' ? 'reconciled_after_indeterminate' : 'direct_response_and_readback' },
        receipt.disposition,
        recoveryOwner,
        citations,
        receiptObservation(
          readback.snapshot,
          String(context.publication_binding.intended_projection_sha256),
          after.non_gate_sha256,
        ),
      )
    }
    return appliedResult(
      context,
      readback.snapshot,
      after.non_gate_sha256,
      receipt.disposition,
      casState === 'indeterminate' ? 'reconciled_after_indeterminate' : 'direct_response_and_readback',
    )
  } catch {
    if (submitted) {
      return reconciliationResult(
        context,
        'internal_state_indeterminate',
        { attempted: true, observed: false, verified: false, confirmation: 'submission_indeterminate' },
        { state: 'not_performed', reason: 'write_not_verified' },
        recoveryOwner,
        [],
        { state: 'unavailable' },
      )
    }
    return stoppedResult(
      context,
      'internal_failure_before_submission',
      'S20_result_admission',
      '',
      'backend_implementer',
      [],
    )
  }
}
