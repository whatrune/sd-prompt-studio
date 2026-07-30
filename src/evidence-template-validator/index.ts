export type EvidenceRecordRefV1 = Readonly<{
  record_type: string
  task_id: string
  canonical_record: string
  body_sha256: string
  body_utf8_length: number
  record_digest: string
}>

export type EvidenceTemplateAuthorityCeilingV1 = Readonly<{
  escalation_claim_allowed: boolean
  implementation_resume_allowed: boolean
}>

export type EvidenceTemplateValidationContextV1 = Readonly<{
  schema_version: 'EvidenceTemplateValidationContextV1'
  target_record_type: 'result_handoff' | 'review_dispatch' | 'review_decision'
  expected_task_id: string
  expected_canonical_task: string
  actual_canonical_record: string
  expected_body_utf8_length: number
  expected_body_sha256: string
  required_evidence_ids: readonly string[]
  required_validation_commands: readonly string[]
  authorized_record_refs: readonly EvidenceRecordRefV1[]
  authority_ceiling: EvidenceTemplateAuthorityCeilingV1
}>

export type EvidenceTemplateValidationRejectionCodeV1 =
  | 'invalid_context'
  | 'body_too_large'
  | 'body_binding_mismatch'
  | 'invalid_utf8'
  | 'control_character'
  | 'invalid_line_ending'
  | 'machine_block_count'
  | 'machine_fence_invalid'
  | 'parse_error'
  | 'duplicate_key'
  | 'resource_limit'
  | 'invalid_root'
  | 'unknown_field'
  | 'missing_required_field'
  | 'invalid_type'
  | 'placeholder_forbidden'
  | 'record_digest_mismatch'
  | 'canonical_record_mismatch'
  | 'task_identity_mismatch'
  | 'unauthorized_record_ref'
  | 'invalid_status'
  | 'status_relation_mismatch'

export type EvidenceTemplateValidationRejectionV1 = Readonly<{
  code: EvidenceTemplateValidationRejectionCodeV1
  stage: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12
  path: string
  message: 'Evidence Template Validator V1 rejected the supplied evidence.'
}>

export type EvidenceTemplateAcceptedValueV1 = Readonly<{
  record_type: 'result_handoff' | 'review_dispatch' | 'review_decision'
  task_id: string
  canonical_task: string
  canonical_record: string
  status: string
  record_digest: string
  body_sha256: string
  body_utf8_length: number
  evidence_fingerprint: string
}>

export type EvidenceTemplateValidationResultV1 = Readonly<
  | { branch: 'accepted'; value: EvidenceTemplateAcceptedValueV1 }
  | { branch: 'rejected'; rejection: EvidenceTemplateValidationRejectionV1 }
>

type JsonObject = { [key: string]: unknown }
type RecordType = EvidenceTemplateValidationContextV1['target_record_type']
type Stage = EvidenceTemplateValidationRejectionV1['stage']

const MESSAGE = 'Evidence Template Validator V1 rejected the supplied evidence.' as const
const RECORD_TYPES: readonly RecordType[] = ['result_handoff', 'review_dispatch', 'review_decision']
const ROLES = [
  'Architect Team',
  'Architect Team Independent Reviewer',
  'Independent Reviewer',
  'Integrated Lead',
  'Implementation Team',
  'Product Owner',
] as const
const CONTEXT_FIELDS = [
  'schema_version',
  'target_record_type',
  'expected_task_id',
  'expected_canonical_task',
  'actual_canonical_record',
  'expected_body_utf8_length',
  'expected_body_sha256',
  'required_evidence_ids',
  'required_validation_commands',
  'authorized_record_refs',
  'authority_ceiling',
] as const
const COMMON_FIELDS = [
  'schema_version',
  'record_type',
  'task_id',
  'authoring_role',
  'canonical_task',
  'canonical_record',
  'status',
  'authority_refs',
  'record_digest',
] as const
const PROFILE_FIELDS: Readonly<Record<RecordType, readonly string[]>> = {
  result_handoff: [
    ...COMMON_FIELDS,
    'completed_work',
    'created_files',
    'updated_files',
    'validation_results',
    'contract_boundary_confirmation',
    'unresolved_items',
    'escalation_required',
    'recommended_next_action',
  ],
  review_dispatch: [
    ...COMMON_FIELDS,
    'assigned_next_role',
    'target_record',
    'review_scope',
    'required_output',
    'implementation_resume_allowed',
    'execution_stop_reason',
  ],
  review_decision: [
    ...COMMON_FIELDS,
    'authority_dispatch',
    'reviewed_record',
    'decision',
    'blocking_finding_count',
    'finding_dispositions',
    'implementation_resume_allowed',
    'execution_stop_reason',
  ],
}
const RECORD_REF_FIELDS = [
  'record_type',
  'task_id',
  'canonical_record',
  'body_sha256',
  'body_utf8_length',
  'record_digest',
] as const
const PROHIBITED_ACTION_FIELDS = [
  'commit',
  'destructive_action',
  'implementation',
  'issue_209_operation',
  'merge',
  'pr',
  'protected_action',
  'push',
  'repository_change',
  'thread_resolve',
  'worktree_change',
] as const
const FORBIDDEN_TOKENS = new Set(['fixme', 'n/a', 'na', 'pending', 'self', 'tbd', 'todo', 'unknown', 'xxx'])
const PLACEHOLDER_PATTERNS = [
  /\{\{[A-Za-z_][A-Za-z0-9_.-]*\}\}/,
  /\$\{[A-Za-z_][A-Za-z0-9_.-]*\}/,
  /<[A-Za-z_][A-Za-z0-9_.-]*>/,
  /__[A-Za-z_][A-Za-z0-9_.-]*__/,
] as const

const isObject = (value: unknown): value is JsonObject =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
const has = (value: JsonObject, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key)
const pointerPart = (value: string): string => value.replace(/~/g, '~0').replace(/\//g, '~1')
const childPath = (path: string, key: string | number): string => `${path}/${pointerPart(String(key))}`
const utf8Compare = (left: string, right: string): number => {
  const a = new TextEncoder().encode(left)
  const b = new TextEncoder().encode(right)
  const length = Math.min(a.length, b.length)
  for (let index = 0; index < length; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index]
  }
  return a.length - b.length
}
const exactKeys = (value: JsonObject, fields: readonly string[]): boolean =>
  Object.keys(value).length === fields.length && fields.every((field) => has(value, field))
const safeInteger = (value: unknown, minimum = 0): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum && !Object.is(value, -0)
const nonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.replace(/^[\u0009-\u000d\u0020]+|[\u0009-\u000d\u0020]+$/g, '').length > 0
const asciiIdentifier = (value: unknown): value is string =>
  typeof value === 'string' && /^[\x21-\x7e]+$/.test(value)
const evidenceId = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*$/.test(value)
const lowerHex64 = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f]{64}$/.test(value)
const nonZeroHex64 = (value: unknown): value is string =>
  lowerHex64(value) && value !== '0'.repeat(64)
const canonicalTaskUrl = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/issues\/[1-9][0-9]*$/.test(value)
const canonicalRecordUrl = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/issues\/[1-9][0-9]*#issuecomment-[1-9][0-9]*$/.test(value)
const role = (value: unknown): value is (typeof ROLES)[number] =>
  typeof value === 'string' && (ROLES as readonly string[]).includes(value)
const unique = <T>(values: readonly T[], key: (value: T) => string): boolean => {
  const seen = new Set<string>()
  for (const value of values) {
    const identity = key(value)
    if (seen.has(identity)) return false
    seen.add(identity)
  }
  return true
}
const sortedUniqueStrings = (
  value: unknown,
  predicate: (item: unknown) => item is string,
): value is string[] =>
  Array.isArray(value) &&
  value.every(predicate) &&
  unique(value, (item) => item) &&
  value.every((item, index) => index === 0 || utf8Compare(value[index - 1], item) < 0)

const deepFreeze = <T>(value: T): Readonly<T> => {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const item of Object.values(value as JsonObject)) deepFreeze(item)
    Object.freeze(value)
  }
  return value as Readonly<T>
}
const reject = (
  code: EvidenceTemplateValidationRejectionCodeV1,
  stage: Stage,
  path: string,
): EvidenceTemplateValidationResultV1 =>
  deepFreeze({ branch: 'rejected' as const, rejection: { code, stage, path, message: MESSAGE } })

const canonicalize = (value: unknown): string => {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`
  if (isObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`)
      .join(',')}}`
  }
  throw new TypeError('outside JSON data model')
}

const sha256 = (bytes: Uint8Array): string => {
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64
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
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
    0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
    0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]
  const state = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]
  const words = new Uint32Array(64)
  const rotate = (value: number, bits: number): number => (value >>> bits) | (value << (32 - bits))
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
const sha256Text = (value: string): string => sha256(new TextEncoder().encode(value))

const validateClosed = (
  value: unknown,
  fields: readonly string[],
  path: string,
): EvidenceTemplateValidationResultV1 | null => {
  if (!isObject(value)) return reject('invalid_type', 6, path)
  const allowed = new Set(fields)
  const unknown = Object.keys(value).filter((key) => !allowed.has(key)).sort(utf8Compare)[0]
  if (unknown !== undefined) return reject('unknown_field', 6, childPath(path, unknown))
  const missing = fields.find((field) => !has(value, field))
  return missing === undefined ? null : reject('missing_required_field', 6, childPath(path, missing))
}

const recordRefShape = (value: unknown): value is JsonObject =>
  isObject(value) &&
  exactKeys(value, RECORD_REF_FIELDS) &&
  nonEmptyString(value.record_type) &&
  asciiIdentifier(value.task_id) &&
  canonicalRecordUrl(value.canonical_record) &&
  lowerHex64(value.body_sha256) &&
  safeInteger(value.body_utf8_length, 1) &&
  lowerHex64(value.record_digest)

const validateContext = (
  bodyBytes: unknown,
  context: unknown,
): context is EvidenceTemplateValidationContextV1 => {
  if (!(bodyBytes instanceof Uint8Array) || !isObject(context) || !exactKeys(context, CONTEXT_FIELDS)) return false
  if (
    context.schema_version !== 'EvidenceTemplateValidationContextV1' ||
    !RECORD_TYPES.includes(context.target_record_type as RecordType) ||
    !asciiIdentifier(context.expected_task_id) ||
    !canonicalTaskUrl(context.expected_canonical_task) ||
    !canonicalRecordUrl(context.actual_canonical_record) ||
    !safeInteger(context.expected_body_utf8_length) ||
    !nonZeroHex64(context.expected_body_sha256) ||
    !sortedUniqueStrings(context.required_evidence_ids, evidenceId) ||
    !Array.isArray(context.required_validation_commands) ||
    !context.required_validation_commands.every(nonEmptyString) ||
    !unique(context.required_validation_commands, (item) => item) ||
    !Array.isArray(context.authorized_record_refs) ||
    !context.authorized_record_refs.every(recordRefShape) ||
    !unique(context.authorized_record_refs, (item) => canonicalize(item)) ||
    !isObject(context.authority_ceiling) ||
    !exactKeys(context.authority_ceiling, ['escalation_claim_allowed', 'implementation_resume_allowed']) ||
    typeof context.authority_ceiling.escalation_claim_allowed !== 'boolean' ||
    typeof context.authority_ceiling.implementation_resume_allowed !== 'boolean'
  ) return false
  return context.authorized_record_refs.every(
    (item) => nonZeroHex64(item.body_sha256) && nonZeroHex64(item.record_digest),
  )
}

class JsonFailure extends Error {
  constructor(
    readonly code: 'parse_error' | 'duplicate_key' | 'resource_limit',
    readonly path: string,
  ) {
    super(code)
  }
}

class StrictJsonParser {
  private index = 0
  private members = 0

  constructor(private readonly source: string) {}

  parse(): unknown {
    this.space()
    const value = this.value('', 0)
    this.space()
    if (this.index !== this.source.length) throw new JsonFailure('parse_error', '')
    return value
  }

  private space(): void {
    while (this.index < this.source.length && /[\u0009\u000a\u000d\u0020]/.test(this.source[this.index])) {
      this.index += 1
    }
  }

  private value(path: string, depth: number): unknown {
    if (depth > 32) throw new JsonFailure('resource_limit', path)
    this.space()
    const current = this.source[this.index]
    if (current === '{') return this.object(path, depth)
    if (current === '[') return this.array(path, depth)
    if (current === '"') return this.string()
    if (this.source.startsWith('true', this.index)) {
      this.index += 4
      return true
    }
    if (this.source.startsWith('false', this.index)) {
      this.index += 5
      return false
    }
    if (this.source.startsWith('null', this.index)) {
      this.index += 4
      return null
    }
    const match = this.source.slice(this.index).match(/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/)
    if (match === null) throw new JsonFailure('parse_error', path)
    this.index += match[0].length
    const number = Number(match[0])
    if (!Number.isSafeInteger(number) || Object.is(number, -0)) throw new JsonFailure('parse_error', path)
    return number
  }

  private object(path: string, depth: number): JsonObject {
    this.index += 1
    this.space()
    const result: JsonObject = {}
    const seen = new Set<string>()
    if (this.source[this.index] === '}') {
      this.index += 1
      return result
    }
    while (this.index < this.source.length) {
      this.space()
      if (this.source[this.index] !== '"') throw new JsonFailure('parse_error', path)
      const key = this.string()
      const keyPath = childPath(path, key)
      if (seen.has(key)) throw new JsonFailure('duplicate_key', keyPath)
      seen.add(key)
      this.members += 1
      if (this.members > 2048) throw new JsonFailure('resource_limit', keyPath)
      this.space()
      if (this.source[this.index] !== ':') throw new JsonFailure('parse_error', keyPath)
      this.index += 1
      result[key] = this.value(keyPath, depth + 1)
      this.space()
      if (this.source[this.index] === '}') {
        this.index += 1
        return result
      }
      if (this.source[this.index] !== ',') throw new JsonFailure('parse_error', path)
      this.index += 1
    }
    throw new JsonFailure('parse_error', path)
  }

  private array(path: string, depth: number): unknown[] {
    this.index += 1
    this.space()
    const result: unknown[] = []
    if (this.source[this.index] === ']') {
      this.index += 1
      return result
    }
    while (this.index < this.source.length) {
      const itemPath = childPath(path, result.length)
      result.push(this.value(itemPath, depth + 1))
      this.space()
      if (this.source[this.index] === ']') {
        this.index += 1
        return result
      }
      if (this.source[this.index] !== ',') throw new JsonFailure('parse_error', path)
      this.index += 1
    }
    throw new JsonFailure('parse_error', path)
  }

  private string(): string {
    const start = this.index
    this.index += 1
    while (this.index < this.source.length) {
      const code = this.source.charCodeAt(this.index)
      if (code === 0x22) {
        this.index += 1
        try {
          return JSON.parse(this.source.slice(start, this.index)) as string
        } catch {
          throw new JsonFailure('parse_error', '')
        }
      }
      if (code < 0x20) throw new JsonFailure('parse_error', '')
      if (code === 0x5c) {
        this.index += 1
        const escape = this.source[this.index]
        if (escape === 'u') {
          if (!/^[0-9a-fA-F]{4}$/.test(this.source.slice(this.index + 1, this.index + 5))) {
            throw new JsonFailure('parse_error', '')
          }
          this.index += 5
          continue
        }
        if (!'"\\/bfnrt'.includes(escape ?? '')) throw new JsonFailure('parse_error', '')
      }
      this.index += 1
    }
    throw new JsonFailure('parse_error', '')
  }
}

const validateRecordRefAt = (
  value: unknown,
  path: string,
): EvidenceTemplateValidationResultV1 | null => {
  const closed = validateClosed(value, RECORD_REF_FIELDS, path)
  if (closed !== null) return closed
  const object = value as JsonObject
  if (!nonEmptyString(object.record_type)) return reject('invalid_type', 6, childPath(path, 'record_type'))
  if (!asciiIdentifier(object.task_id)) return reject('invalid_type', 6, childPath(path, 'task_id'))
  if (!canonicalRecordUrl(object.canonical_record)) return reject('invalid_type', 6, childPath(path, 'canonical_record'))
  if (!lowerHex64(object.body_sha256)) return reject('invalid_type', 6, childPath(path, 'body_sha256'))
  if (!safeInteger(object.body_utf8_length, 1)) return reject('invalid_type', 6, childPath(path, 'body_utf8_length'))
  if (!lowerHex64(object.record_digest)) return reject('invalid_type', 6, childPath(path, 'record_digest'))
  return null
}

const validateRefArray = (
  value: unknown,
  path: string,
  refs: Array<{ path: string; value: JsonObject }>,
): EvidenceTemplateValidationResultV1 | null => {
  if (!Array.isArray(value)) return reject('invalid_type', 6, path)
  if (!unique(value, (item) => canonicalize(item))) return reject('invalid_type', 6, path)
  for (let index = 0; index < value.length; index += 1) {
    const itemPath = childPath(path, index)
    const invalid = validateRecordRefAt(value[index], itemPath)
    if (invalid !== null) return invalid
    refs.push({ path: itemPath, value: value[index] as JsonObject })
  }
  return null
}

const validateRepositoryPaths = (value: unknown, path: string): EvidenceTemplateValidationResultV1 | null => {
  if (
    !Array.isArray(value) ||
    !value.every(
      (item) =>
        typeof item === 'string' &&
        item.length > 0 &&
        !item.includes('\\') &&
        !item.includes('\0') &&
        !item.includes('://') &&
        !/^[A-Za-z]:/.test(item) &&
        !item.startsWith('/') &&
        item.split('/').every((part) => part !== '' && part !== '.' && part !== '..'),
    ) ||
    !unique(value, (item) => item) ||
    !value.every((item, index) => index === 0 || utf8Compare(value[index - 1], item) < 0)
  ) return reject('invalid_type', 6, path)
  return null
}

const validateRecordStructure = (
  record: JsonObject,
  context: EvidenceTemplateValidationContextV1,
): { rejection: EvidenceTemplateValidationResultV1 | null; refs: Array<{ path: string; value: JsonObject }> } => {
  const refs: Array<{ path: string; value: JsonObject }> = []
  const root = validateClosed(record, PROFILE_FIELDS[context.target_record_type], '')
  if (root !== null) return { rejection: root, refs }
  if (record.schema_version !== 'EvidenceTemplateRecordV1') return { rejection: reject('invalid_type', 6, '/schema_version'), refs }
  if (typeof record.record_type !== 'string') return { rejection: reject('invalid_type', 6, '/record_type'), refs }
  if (!asciiIdentifier(record.task_id)) return { rejection: reject('invalid_type', 6, '/task_id'), refs }
  if (!role(record.authoring_role)) return { rejection: reject('invalid_type', 6, '/authoring_role'), refs }
  if (!canonicalTaskUrl(record.canonical_task)) return { rejection: reject('invalid_type', 6, '/canonical_task'), refs }
  if (!canonicalRecordUrl(record.canonical_record)) return { rejection: reject('invalid_type', 6, '/canonical_record'), refs }
  if (!nonEmptyString(record.status)) return { rejection: reject('invalid_type', 6, '/status'), refs }
  const authorityRefs = validateRefArray(record.authority_refs, '/authority_refs', refs)
  if (authorityRefs !== null) return { rejection: authorityRefs, refs }
  if (!lowerHex64(record.record_digest)) return { rejection: reject('invalid_type', 6, '/record_digest'), refs }

  if (context.target_record_type === 'result_handoff') {
    if (!Array.isArray(record.completed_work)) return { rejection: reject('invalid_type', 6, '/completed_work'), refs }
    const completedIds = new Set<string>()
    for (let index = 0; index < record.completed_work.length; index += 1) {
      const path = `/completed_work/${index}`
      const item = record.completed_work[index]
      const closed = validateClosed(item, ['evidence_id', 'summary', 'evidence_refs'], path)
      if (closed !== null) return { rejection: closed, refs }
      const object = item as JsonObject
      if (!evidenceId(object.evidence_id) || completedIds.has(object.evidence_id)) {
        return { rejection: reject('invalid_type', 6, `${path}/evidence_id`), refs }
      }
      completedIds.add(object.evidence_id)
      if (!nonEmptyString(object.summary)) return { rejection: reject('invalid_type', 6, `${path}/summary`), refs }
      const evidenceRefs = validateRefArray(object.evidence_refs, `${path}/evidence_refs`, refs)
      if (evidenceRefs !== null) return { rejection: evidenceRefs, refs }
    }
    const created = validateRepositoryPaths(record.created_files, '/created_files')
    if (created !== null) return { rejection: created, refs }
    const updated = validateRepositoryPaths(record.updated_files, '/updated_files')
    if (updated !== null) return { rejection: updated, refs }
    if ((record.created_files as string[]).some((path) => (record.updated_files as string[]).includes(path))) {
      return { rejection: reject('invalid_type', 6, '/updated_files'), refs }
    }
    if (!Array.isArray(record.validation_results)) return { rejection: reject('invalid_type', 6, '/validation_results'), refs }
    const commands = new Set<string>()
    for (let index = 0; index < record.validation_results.length; index += 1) {
      const path = `/validation_results/${index}`
      const item = record.validation_results[index]
      const closed = validateClosed(item, ['command', 'exit_code', 'result', 'evidence_refs'], path)
      if (closed !== null) return { rejection: closed, refs }
      const object = item as JsonObject
      if (!nonEmptyString(object.command) || commands.has(object.command)) {
        return { rejection: reject('invalid_type', 6, `${path}/command`), refs }
      }
      commands.add(object.command)
      if (!safeInteger(object.exit_code) || object.exit_code > 255) {
        return { rejection: reject('invalid_type', 6, `${path}/exit_code`), refs }
      }
      if (!['PASS', 'FAIL', 'BLOCKED'].includes(String(object.result))) {
        return { rejection: reject('invalid_type', 6, `${path}/result`), refs }
      }
      const evidenceRefs = validateRefArray(object.evidence_refs, `${path}/evidence_refs`, refs)
      if (evidenceRefs !== null) return { rejection: evidenceRefs, refs }
    }
    const boundary = validateClosed(
      record.contract_boundary_confirmation,
      [
        'task_identity_preserved',
        'canonical_record_verified',
        'digest_verified',
        'placeholder_scan_passed',
        'parse_passed',
        'control_character_scan_passed',
        'prohibited_actions',
      ],
      '/contract_boundary_confirmation',
    )
    if (boundary !== null) return { rejection: boundary, refs }
    const boundaryObject = record.contract_boundary_confirmation as JsonObject
    for (const field of [
      'task_identity_preserved',
      'canonical_record_verified',
      'digest_verified',
      'placeholder_scan_passed',
      'parse_passed',
      'control_character_scan_passed',
    ]) {
      if (typeof boundaryObject[field] !== 'boolean') {
        return { rejection: reject('invalid_type', 6, `/contract_boundary_confirmation/${field}`), refs }
      }
    }
    const prohibited = validateClosed(
      boundaryObject.prohibited_actions,
      PROHIBITED_ACTION_FIELDS,
      '/contract_boundary_confirmation/prohibited_actions',
    )
    if (prohibited !== null) return { rejection: prohibited, refs }
    for (const field of PROHIBITED_ACTION_FIELDS) {
      if (typeof (boundaryObject.prohibited_actions as JsonObject)[field] !== 'boolean') {
        return { rejection: reject('invalid_type', 6, `/contract_boundary_confirmation/prohibited_actions/${field}`), refs }
      }
    }
    if (!Array.isArray(record.unresolved_items)) return { rejection: reject('invalid_type', 6, '/unresolved_items'), refs }
    const itemIds = new Set<string>()
    for (let index = 0; index < record.unresolved_items.length; index += 1) {
      const path = `/unresolved_items/${index}`
      const item = record.unresolved_items[index]
      const closed = validateClosed(
        item,
        ['item_id', 'kind', 'severity', 'summary', 'actionable_by_role', 'evidence_refs'],
        path,
      )
      if (closed !== null) return { rejection: closed, refs }
      const object = item as JsonObject
      if (!evidenceId(object.item_id) || itemIds.has(object.item_id)) return { rejection: reject('invalid_type', 6, `${path}/item_id`), refs }
      itemIds.add(object.item_id)
      if (!['warning', 'incomplete_evidence', 'failed_validation', 'architecture_gap', 'external_blocker'].includes(String(object.kind))) {
        return { rejection: reject('invalid_type', 6, `${path}/kind`), refs }
      }
      if (!['blocking', 'non_blocking'].includes(String(object.severity))) return { rejection: reject('invalid_type', 6, `${path}/severity`), refs }
      if (!nonEmptyString(object.summary)) return { rejection: reject('invalid_type', 6, `${path}/summary`), refs }
      if (!role(object.actionable_by_role)) return { rejection: reject('invalid_type', 6, `${path}/actionable_by_role`), refs }
      const evidenceRefs = validateRefArray(object.evidence_refs, `${path}/evidence_refs`, refs)
      if (evidenceRefs !== null) return { rejection: evidenceRefs, refs }
    }
    if (typeof record.escalation_required !== 'boolean') return { rejection: reject('invalid_type', 6, '/escalation_required'), refs }
    const action = validateClosed(record.recommended_next_action, ['action', 'authority_ref', 'role'], '/recommended_next_action')
    if (action !== null) return { rejection: action, refs }
    const actionObject = record.recommended_next_action as JsonObject
    if (!nonEmptyString(actionObject.action)) return { rejection: reject('invalid_type', 6, '/recommended_next_action/action'), refs }
    if (!role(actionObject.role)) return { rejection: reject('invalid_type', 6, '/recommended_next_action/role'), refs }
    if (actionObject.authority_ref !== null) {
      const invalid = validateRecordRefAt(actionObject.authority_ref, '/recommended_next_action/authority_ref')
      if (invalid !== null) return { rejection: invalid, refs }
      refs.push({ path: '/recommended_next_action/authority_ref', value: actionObject.authority_ref as JsonObject })
    }
    return { rejection: null, refs }
  }

  if (context.target_record_type === 'review_dispatch') {
    if (!role(record.assigned_next_role)) return { rejection: reject('invalid_type', 6, '/assigned_next_role'), refs }
    const target = validateRecordRefAt(record.target_record, '/target_record')
    if (target !== null) return { rejection: target, refs }
    refs.push({ path: '/target_record', value: record.target_record as JsonObject })
    if (!Array.isArray(record.review_scope)) return { rejection: reject('invalid_type', 6, '/review_scope'), refs }
    const scopeIds = new Set<string>()
    for (let index = 0; index < record.review_scope.length; index += 1) {
      const path = `/review_scope/${index}`
      const item = record.review_scope[index]
      const closed = validateClosed(item, ['evidence_id', 'obligation'], path)
      if (closed !== null) return { rejection: closed, refs }
      const object = item as JsonObject
      if (!evidenceId(object.evidence_id) || scopeIds.has(object.evidence_id)) return { rejection: reject('invalid_type', 6, `${path}/evidence_id`), refs }
      scopeIds.add(object.evidence_id)
      if (!nonEmptyString(object.obligation)) return { rejection: reject('invalid_type', 6, `${path}/obligation`), refs }
    }
    if (!nonEmptyString(record.required_output)) return { rejection: reject('invalid_type', 6, '/required_output'), refs }
    if (typeof record.implementation_resume_allowed !== 'boolean') return { rejection: reject('invalid_type', 6, '/implementation_resume_allowed'), refs }
    if (record.execution_stop_reason !== 'dispatch_recorded') return { rejection: reject('invalid_type', 6, '/execution_stop_reason'), refs }
    return { rejection: null, refs }
  }

  const dispatch = validateRecordRefAt(record.authority_dispatch, '/authority_dispatch')
  if (dispatch !== null) return { rejection: dispatch, refs }
  refs.push({ path: '/authority_dispatch', value: record.authority_dispatch as JsonObject })
  const reviewed = validateRecordRefAt(record.reviewed_record, '/reviewed_record')
  if (reviewed !== null) return { rejection: reviewed, refs }
  refs.push({ path: '/reviewed_record', value: record.reviewed_record as JsonObject })
  if (!['APPROVE', 'CHANGES_REQUIRED', 'BLOCKED'].includes(String(record.decision))) return { rejection: reject('invalid_type', 6, '/decision'), refs }
  if (!safeInteger(record.blocking_finding_count)) return { rejection: reject('invalid_type', 6, '/blocking_finding_count'), refs }
  if (!Array.isArray(record.finding_dispositions)) return { rejection: reject('invalid_type', 6, '/finding_dispositions'), refs }
  const findingIds = new Set<string>()
  for (let index = 0; index < record.finding_dispositions.length; index += 1) {
    const path = `/finding_dispositions/${index}`
    const item = record.finding_dispositions[index]
    const closed = validateClosed(
      item,
      ['finding_id', 'state', 'blocking_for_this_decision', 'disposition', 'evidence_refs'],
      path,
    )
    if (closed !== null) return { rejection: closed, refs }
    const object = item as JsonObject
    if (!evidenceId(object.finding_id) || findingIds.has(object.finding_id)) return { rejection: reject('invalid_type', 6, `${path}/finding_id`), refs }
    findingIds.add(object.finding_id)
    if (!['open', 'closed', 'reopened', 'not_owned'].includes(String(object.state))) return { rejection: reject('invalid_type', 6, `${path}/state`), refs }
    if (typeof object.blocking_for_this_decision !== 'boolean') return { rejection: reject('invalid_type', 6, `${path}/blocking_for_this_decision`), refs }
    if (!['closed', 'remains_open', 'repair_contract_approved_pending_execution', 'not_in_scope'].includes(String(object.disposition))) {
      return { rejection: reject('invalid_type', 6, `${path}/disposition`), refs }
    }
    const evidenceRefs = validateRefArray(object.evidence_refs, `${path}/evidence_refs`, refs)
    if (evidenceRefs !== null) return { rejection: evidenceRefs, refs }
  }
  if (typeof record.implementation_resume_allowed !== 'boolean') return { rejection: reject('invalid_type', 6, '/implementation_resume_allowed'), refs }
  if (!['completed', 'needs_followup', 'architecture_gap', 'external_blocker'].includes(String(record.execution_stop_reason))) {
    return { rejection: reject('invalid_type', 6, '/execution_stop_reason'), refs }
  }
  return { rejection: null, refs }
}

const firstControlPath = (value: unknown, path = ''): string | null => {
  if (typeof value === 'string') {
    for (const character of value) {
      const point = character.codePointAt(0) ?? 0
      if (
        point <= 0x1f ||
        (point >= 0x7f && point <= 0x9f) ||
        (point >= 0x200b && point <= 0x200f) ||
        (point >= 0x2028 && point <= 0x202e) ||
        (point >= 0x2060 && point <= 0x206f) ||
        point === 0xfeff
      ) return path
    }
    return null
  }
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = firstControlPath(value[index], childPath(path, index))
      if (found !== null) return found
    }
    return null
  }
  if (isObject(value)) {
    for (const key of Object.keys(value).sort(utf8Compare)) {
      const keyPath = childPath(path, key)
      const keyControl = firstControlPath(key, keyPath)
      if (keyControl !== null) return keyControl
      const found = firstControlPath(value[key], keyPath)
      if (found !== null) return found
    }
  }
  return null
}

const firstPlaceholderPath = (value: unknown, path = ''): string | null => {
  const forbidden = (text: string): boolean => {
    const trimmed = text.replace(/^[\u0009-\u000d\u0020]+|[\u0009-\u000d\u0020]+$/g, '')
    const folded = trimmed.replace(/[A-Z]/g, (character) => character.toLowerCase())
    return (
      trimmed.length === 0 ||
      FORBIDDEN_TOKENS.has(folded) ||
      PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(text) || pattern.test(trimmed)) ||
      text.includes('issuecomment-0') ||
      text.includes('/issues/0') ||
      /(^|[^0-9a-f])0{64}([^0-9a-f]|$)/.test(text) ||
      /(^|[^0-9a-f])0{40}([^0-9a-f]|$)/.test(text)
    )
  }
  if (typeof value === 'string') return forbidden(value) ? path : null
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = firstPlaceholderPath(value[index], childPath(path, index))
      if (found !== null) return found
    }
    return null
  }
  if (isObject(value)) {
    for (const key of Object.keys(value).sort(utf8Compare)) {
      const keyPath = childPath(path, key)
      if (forbidden(key)) return keyPath
      const found = firstPlaceholderPath(value[key], keyPath)
      if (found !== null) return found
    }
  }
  return null
}

const deepEqual = (left: unknown, right: unknown): boolean => canonicalize(left) === canonicalize(right)
const sameStringSet = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((value) => right.includes(value))

const validateRelations = (
  record: JsonObject,
  context: EvidenceTemplateValidationContextV1,
): EvidenceTemplateValidationResultV1 | null => {
  if (context.target_record_type === 'result_handoff') {
    const statuses = ['completed', 'completed_with_warnings', 'needs_followup', 'blocked']
    if (!statuses.includes(String(record.status))) return reject('invalid_status', 12, '/status')
    const unresolved = record.unresolved_items as JsonObject[]
    for (let index = 0; index < unresolved.length; index += 1) {
      const item = unresolved[index]
      const kind = item.kind as string
      const expectedSeverity = ['warning', 'incomplete_evidence'].includes(kind) ? 'non_blocking' : 'blocking'
      if (item.severity !== expectedSeverity) return reject('status_relation_mismatch', 12, `/unresolved_items/${index}/severity`)
    }
    const completedIds = (record.completed_work as JsonObject[]).map((item) => item.evidence_id as string)
    const evidenceComplete = sameStringSet(completedIds, context.required_evidence_ids)
    const validation = record.validation_results as JsonObject[]
    const validationComplete =
      validation.length === context.required_validation_commands.length &&
      context.required_validation_commands.every((command) =>
        validation.some((item) => item.command === command && item.result === 'PASS' && item.exit_code === 0),
      )
    for (let index = 0; index < validation.length; index += 1) {
      const item = validation[index]
      if ((item.result === 'PASS') !== (item.exit_code === 0)) return reject('status_relation_mismatch', 12, `/validation_results/${index}/result`)
      if (item.result === 'BLOCKED' && item.exit_code === 0) return reject('status_relation_mismatch', 12, `/validation_results/${index}/result`)
      if (!context.required_validation_commands.includes(item.command as string)) {
        return reject('status_relation_mismatch', 12, `/validation_results/${index}/command`)
      }
    }
    const boundary = record.contract_boundary_confirmation as JsonObject
    for (const field of [
      'task_identity_preserved',
      'canonical_record_verified',
      'digest_verified',
      'placeholder_scan_passed',
      'parse_passed',
      'control_character_scan_passed',
    ]) {
      if (boundary[field] !== true) return reject('status_relation_mismatch', 12, `/contract_boundary_confirmation/${field}`)
    }
    for (const field of PROHIBITED_ACTION_FIELDS) {
      if ((boundary.prohibited_actions as JsonObject)[field] !== false) {
        return reject('status_relation_mismatch', 12, `/contract_boundary_confirmation/prohibited_actions/${field}`)
      }
    }
    if (record.escalation_required === true && !context.authority_ceiling.escalation_claim_allowed) {
      return reject('status_relation_mismatch', 12, '/escalation_required')
    }
    const action = record.recommended_next_action as JsonObject
    if (record.status === 'completed' && action.authority_ref !== null) return reject('status_relation_mismatch', 12, '/recommended_next_action/authority_ref')
    if (record.status !== 'completed' && action.authority_ref === null) return reject('status_relation_mismatch', 12, '/recommended_next_action/authority_ref')
    if (record.status === 'completed') {
      if (unresolved.length !== 0) return reject('status_relation_mismatch', 12, '/unresolved_items')
      if (!evidenceComplete) return reject('status_relation_mismatch', 12, '/completed_work')
      if (!validationComplete) return reject('status_relation_mismatch', 12, '/validation_results')
      if (record.escalation_required !== false) return reject('status_relation_mismatch', 12, '/escalation_required')
    } else if (record.status === 'completed_with_warnings') {
      if (unresolved.length === 0) return reject('status_relation_mismatch', 12, '/unresolved_items')
      const nonWarning = unresolved.findIndex((item) => item.kind !== 'warning')
      if (nonWarning >= 0) return reject('status_relation_mismatch', 12, `/unresolved_items/${nonWarning}/kind`)
      if (!evidenceComplete) return reject('status_relation_mismatch', 12, '/completed_work')
      if (!validationComplete) return reject('status_relation_mismatch', 12, '/validation_results')
      if (record.escalation_required !== false) return reject('status_relation_mismatch', 12, '/escalation_required')
    } else if (record.status === 'needs_followup') {
      if (unresolved.length === 0) return reject('status_relation_mismatch', 12, '/unresolved_items')
      const blocking = unresolved.findIndex((item) => item.severity === 'blocking')
      if (blocking >= 0) return reject('status_relation_mismatch', 12, `/unresolved_items/${blocking}/severity`)
      if (evidenceComplete && validationComplete) return reject('status_relation_mismatch', 12, '/completed_work')
    } else {
      if (unresolved.length === 0) return reject('status_relation_mismatch', 12, '/unresolved_items')
      const nonBlockingKind = unresolved.findIndex(
        (item) => !['architecture_gap', 'external_blocker'].includes(item.kind as string),
      )
      if (nonBlockingKind >= 0) return reject('status_relation_mismatch', 12, `/unresolved_items/${nonBlockingKind}/kind`)
      if (record.escalation_required !== true) return reject('status_relation_mismatch', 12, '/escalation_required')
    }
    return null
  }

  if (context.target_record_type === 'review_dispatch') {
    if (!['dispatched_stop', 'redispatch_requested_stop'].includes(String(record.status))) {
      return reject('invalid_status', 12, '/status')
    }
    const scopeIds = (record.review_scope as JsonObject[]).map((item) => item.evidence_id as string)
    if (!sameStringSet(scopeIds, context.required_evidence_ids)) return reject('status_relation_mismatch', 12, '/review_scope')
    if (record.execution_stop_reason !== 'dispatch_recorded') return reject('status_relation_mismatch', 12, '/execution_stop_reason')
    if (record.implementation_resume_allowed === true && !context.authority_ceiling.implementation_resume_allowed) {
      return reject('status_relation_mismatch', 12, '/implementation_resume_allowed')
    }
    return null
  }

  if (!['completed', 'needs_followup', 'blocked'].includes(String(record.status))) {
    return reject('invalid_status', 12, '/status')
  }
  const findings = record.finding_dispositions as JsonObject[]
  const findingIds = findings.map((item) => item.finding_id as string)
  if (!sameStringSet(findingIds, context.required_evidence_ids)) return reject('status_relation_mismatch', 12, '/finding_dispositions')
  const blockingCount = findings.filter((item) => item.blocking_for_this_decision === true).length
  if (record.blocking_finding_count !== blockingCount) return reject('status_relation_mismatch', 12, '/blocking_finding_count')
  if ((record.authority_dispatch as JsonObject).record_type !== 'review_dispatch') {
    return reject('status_relation_mismatch', 12, '/authority_dispatch/record_type')
  }
  if (
    record.implementation_resume_allowed === true &&
    (record.decision !== 'APPROVE' || !context.authority_ceiling.implementation_resume_allowed)
  ) return reject('status_relation_mismatch', 12, '/implementation_resume_allowed')
  if (record.decision === 'APPROVE') {
    if (record.status !== 'completed') return reject('status_relation_mismatch', 12, '/status')
    if (record.blocking_finding_count !== 0) return reject('status_relation_mismatch', 12, '/blocking_finding_count')
    if (record.execution_stop_reason !== 'completed') return reject('status_relation_mismatch', 12, '/execution_stop_reason')
  } else if (record.decision === 'CHANGES_REQUIRED') {
    if (record.status !== 'needs_followup') return reject('status_relation_mismatch', 12, '/status')
    if ((record.blocking_finding_count as number) < 1) return reject('status_relation_mismatch', 12, '/blocking_finding_count')
    if (record.execution_stop_reason !== 'needs_followup') return reject('status_relation_mismatch', 12, '/execution_stop_reason')
  } else {
    if (record.status !== 'blocked') return reject('status_relation_mismatch', 12, '/status')
    if ((record.blocking_finding_count as number) < 1) return reject('status_relation_mismatch', 12, '/blocking_finding_count')
    if (!['architecture_gap', 'external_blocker'].includes(String(record.execution_stop_reason))) {
      return reject('status_relation_mismatch', 12, '/execution_stop_reason')
    }
  }
  return null
}

export function validateEvidenceTemplateV1(
  bodyBytes: Uint8Array,
  context: EvidenceTemplateValidationContextV1,
): EvidenceTemplateValidationResultV1 {
  try {
    if (!validateContext(bodyBytes, context)) return reject('invalid_context', 1, '')
    if (bodyBytes.length > 262144) return reject('body_too_large', 2, '')
    const bodySha = sha256(bodyBytes)
    if (
      bodyBytes.length !== context.expected_body_utf8_length ||
      bodySha !== context.expected_body_sha256
    ) return reject('body_binding_mismatch', 2, '')

    let body: string
    try {
      body = new TextDecoder('utf-8', { fatal: true }).decode(bodyBytes)
    } catch {
      return reject('invalid_utf8', 3, '')
    }
    if (body.startsWith('\ufeff')) return reject('control_character', 3, '')
    for (const character of body) {
      const point = character.codePointAt(0) ?? 0
      if (
        (point <= 0x1f && point !== 0x0a && point !== 0x0d) ||
        (point >= 0x7f && point <= 0x9f)
      ) return reject('control_character', 3, '')
    }
    if (/(^|[^\r])\r(?!\n)/.test(body)) return reject('invalid_line_ending', 3, '')

    const opening = '```json evidence-template-v1'
    const lines = body.split(/\r?\n/)
    const exactOpenings = lines.filter((line) => line === opening).length
    if (exactOpenings > 1) return reject('machine_block_count', 4, '')
    const fenceLines = lines.filter((line) => line.startsWith('```'))
    if (exactOpenings !== 1) return reject('machine_fence_invalid', 4, '')
    const openingIndex = lines.indexOf(opening)
    const closingIndexes = lines
      .map((line, index) => (line === '```' ? index : -1))
      .filter((index) => index >= 0)
    if (
      closingIndexes.length !== 1 ||
      closingIndexes[0] <= openingIndex ||
      fenceLines.length !== 2
    ) return reject('machine_block_count', 4, '')
    const closingIndex = closingIndexes[0]
    const machineText = lines.slice(openingIndex + 1, closingIndex).join('\n')
    if (machineText.length === 0) return reject('machine_fence_invalid', 4, '')

    let parsed: unknown
    try {
      parsed = new StrictJsonParser(machineText).parse()
    } catch (error) {
      if (error instanceof JsonFailure) return reject(error.code, 5, error.path)
      return reject('parse_error', 5, '')
    }
    if (!isObject(parsed)) return reject('invalid_root', 5, '')

    const structural = validateRecordStructure(parsed, context)
    if (structural.rejection !== null) return structural.rejection
    const controlPath = firstControlPath(parsed)
    if (controlPath !== null) return reject('control_character', 7, controlPath)
    const placeholderPath = firstPlaceholderPath(parsed)
    if (placeholderPath !== null) return reject('placeholder_forbidden', 8, placeholderPath)

    const digestProjection = { ...parsed }
    delete digestProjection.record_digest
    const recordDigest = sha256Text(canonicalize(digestProjection))
    if (parsed.record_digest !== recordDigest) return reject('record_digest_mismatch', 9, '/record_digest')
    if (parsed.canonical_record !== context.actual_canonical_record) return reject('canonical_record_mismatch', 10, '/canonical_record')
    if (parsed.task_id !== context.expected_task_id) return reject('task_identity_mismatch', 10, '/task_id')
    if (parsed.canonical_task !== context.expected_canonical_task) return reject('task_identity_mismatch', 10, '/canonical_task')
    if (parsed.record_type !== context.target_record_type) return reject('task_identity_mismatch', 10, '/record_type')

    for (const reference of structural.refs) {
      if (!context.authorized_record_refs.some((authorized) => deepEqual(reference.value, authorized))) {
        return reject('unauthorized_record_ref', 11, reference.path)
      }
    }
    const relations = validateRelations(parsed, context)
    if (relations !== null) return relations

    const valueWithoutFingerprint = {
      record_type: context.target_record_type,
      task_id: parsed.task_id as string,
      canonical_task: parsed.canonical_task as string,
      canonical_record: parsed.canonical_record as string,
      status: parsed.status as string,
      record_digest: parsed.record_digest as string,
      body_sha256: bodySha,
      body_utf8_length: bodyBytes.length,
    }
    const value: EvidenceTemplateAcceptedValueV1 = {
      ...valueWithoutFingerprint,
      evidence_fingerprint: sha256Text(canonicalize(valueWithoutFingerprint)),
    }
    return deepFreeze({ branch: 'accepted' as const, value })
  } catch {
    return reject('invalid_context', 1, '')
  }
}
