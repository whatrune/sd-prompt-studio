import { ROLE_VALUES, type RoleV1 } from '../context-health'

export const AUTOMATIC_GATE_PROGRESSION_EVALUATION_INPUT_V2_VERSION =
  'automatic-gate-progression-evaluation-input-v2' as const
export const AUTOMATIC_GATE_PROGRESSION_EVALUATION_RESULT_V2_VERSION =
  'automatic-gate-progression-evaluation-result-v2' as const

type CanonicalUrl = string
type HeadSha = string
type ActionId = string

export type GateStatusValueV2 =
  | 'completed'
  | 'historical_at_prior_head'
  | 'pending'
  | 'blocked'
  | 'unperformed'
export type ExecutionStopReasonV2 = 'architecture_gap' | 'external_blocker'
export type ProtectedActionV2 = 'draft_return' | 'ready_for_review' | 'normal_merge_commit'
export type ApprovalRecordStateV2 = 'absent' | 'unreadable' | 'present'
export type ApprovalValidityV2 =
  | {
      readonly mode: 'expires_at'
      readonly expires_at: string
      readonly consumed: boolean
    }
  | {
      readonly mode: 'one_use'
      readonly consumed: boolean
    }

type NextTransitionV2 = {
  readonly target_role: RoleV1
  readonly next_action: ActionId
  readonly protected_action?: ProtectedActionV2
}

type ResultHandoffV2 = {
  readonly canonical_record: CanonicalUrl
  readonly task_id: string
  readonly repository: 'whatrune/sd-prompt-studio'
  readonly pr: CanonicalUrl
  readonly execution_head: HeadSha
  readonly authoring_role: RoleV1
  readonly status: 'completed' | 'needs_followup' | 'blocked'
  readonly execution_stop_reason: 'completed' | ExecutionStopReasonV2
  readonly recommended_next_action?: ActionId
  readonly identity_binding?: {
    readonly branch: string
    readonly worktree: string
    readonly pr: CanonicalUrl
  }
}

type ReviewCorrectionV2 = {
  readonly target_role: RoleV1
  readonly next_action: ActionId
  readonly task_id: string
  readonly repository: 'whatrune/sd-prompt-studio'
  readonly pr: CanonicalUrl
  readonly head: HeadSha
  readonly correction_scope_ref: CanonicalUrl
  readonly predecessor_handoff_ref: CanonicalUrl
  readonly predecessor_action: ActionId
}

type ApprovalRecordV2 =
  | { readonly record_state: 'absent' }
  | { readonly record_state: 'unreadable'; readonly canonical_record: CanonicalUrl }
  | {
      readonly record_state: 'present'
      readonly canonical_record: CanonicalUrl
      readonly author: {
        readonly provider: 'github'
        readonly login: string
        readonly verified_role: 'product_owner'
        readonly role_authority_ref: CanonicalUrl
      }
      readonly repository: 'whatrune/sd-prompt-studio'
      readonly task_id: string
      readonly pr: CanonicalUrl
      readonly action: ProtectedActionV2
      readonly approved_head: HeadSha
      readonly approved_base: string
      readonly approved_pr_state: 'open' | 'closed'
      readonly approved_draft: boolean
      readonly scope: {
        readonly scope_kind: 'single_protected_action'
        readonly task_id: string
        readonly repository: 'whatrune/sd-prompt-studio'
        readonly pr: CanonicalUrl
        readonly action: ProtectedActionV2
        readonly head: HeadSha
        readonly base: string
        readonly pr_state: 'open' | 'closed'
        readonly draft: boolean
      }
      readonly validity: ApprovalValidityV2
    }

export interface AutomaticGateProgressionEvaluationInputV2 {
  readonly contract_version: typeof AUTOMATIC_GATE_PROGRESSION_EVALUATION_INPUT_V2_VERSION
  readonly task_id: string
  readonly repository: 'whatrune/sd-prompt-studio'
  readonly assignment_revision: number
  readonly evaluated_at: string
  readonly task_assignment: {
    readonly canonical_record: CanonicalUrl
    readonly assigned_role: RoleV1
    readonly allowed_actions: readonly ActionId[]
    readonly forbidden_actions: readonly ActionId[]
    readonly completion_conditions: readonly ActionId[]
    readonly escalation_conditions: readonly ActionId[]
    readonly next_transition?: NextTransitionV2 | null
  }
  readonly result_handoff: ResultHandoffV2
  readonly review_decision: {
    readonly canonical_record: CanonicalUrl
    readonly reviewed_pr: CanonicalUrl
    readonly reviewed_head: HeadSha
    readonly decision: 'approved' | 'needs_followup' | 'blocked'
    readonly blocking_findings: readonly {
      readonly finding_id: ActionId
      readonly state: 'open' | 'reopened' | 'closed'
    }[]
    readonly correction?: ReviewCorrectionV2
  }
  readonly pr: {
    readonly url: CanonicalUrl
    readonly head: HeadSha
    readonly base: string
    readonly state: 'open' | 'closed'
    readonly draft: boolean
    readonly blocking_findings: readonly ActionId[]
  }
  readonly checks: readonly {
    readonly name: ActionId
    readonly url: CanonicalUrl
    readonly conclusion: 'success' | 'failure' | 'pending' | 'cancelled'
    readonly checked_head: HeadSha
  }[]
  readonly review_threads: readonly {
    readonly url: CanonicalUrl
    readonly state: 'resolved' | 'unresolved'
    readonly outdated: boolean
    readonly blocking: boolean
  }[]
  readonly gate_status: {
    readonly projected_head: HeadSha
    readonly rows: readonly {
      readonly gate:
        | 'current_head'
        | 'final_regression'
        | 'operational_validation'
        | 'pr_state'
        | 'draft_state'
        | 'ready'
        | 'approve'
        | 'merge'
        | 'next_gate_owner'
      readonly value: GateStatusValueV2
      readonly citation_urls: readonly CanonicalUrl[]
    }[]
    readonly current_blocker?: ActionId
    readonly next_gate_owner?: RoleV1
  }
  readonly workspace: {
    readonly branch: string
    readonly worktree: string
    readonly head: HeadSha
    readonly clean: boolean
    readonly available: boolean
  }
  readonly context_health:
    | {
        readonly required: false
        readonly admitted: false
      }
    | {
        readonly required: true
        readonly admitted: true
        readonly canonical_record: CanonicalUrl
      }
  readonly approval?: ApprovalRecordV2 | null
}

export type GateStatusRequirementV2 =
  | { readonly required: false }
  | {
      readonly required: true
      readonly authorized_metadata_role: RoleV1
      readonly pr: CanonicalUrl
      readonly current_head: HeadSha
      readonly required_gate_fields: readonly [
        'current_head',
        'final_regression',
        'operational_validation',
        'pr_state',
        'draft_state',
        'ready',
        'approve',
        'merge',
        'next_gate_owner',
      ]
      readonly citation_urls: readonly CanonicalUrl[]
      readonly reason: 'missing' | 'stale' | 'conflicting' | 'historical_at_prior_head'
      readonly must_verify_after_write: true
      readonly current_blocker?: ActionId
      readonly next_gate_owner?: RoleV1
    }

type ResultCommonV2 = {
  readonly contract_version: typeof AUTOMATIC_GATE_PROGRESSION_EVALUATION_RESULT_V2_VERSION
  readonly task_id: string
  readonly evaluated_at: string
  readonly input_fingerprint: string
  readonly precedence_trace: readonly string[]
  readonly gate_status_requirement: GateStatusRequirementV2
}

export type AutomaticGateProgressionEvaluationResultV2 =
  | (ResultCommonV2 & {
      readonly kind: 'recommend_next_role'
      readonly target_role: RoleV1
      readonly next_action: ActionId
      readonly predecessor_canonical_url: CanonicalUrl
      readonly target_head: HeadSha
      readonly same_task_id: string
      readonly idempotency_key: string
    })
  | (ResultCommonV2 & {
      readonly kind: 'wait_for_protected_action'
      readonly protected_action: ProtectedActionV2
      readonly wait_reason: 'approval_missing_or_not_current'
      readonly required_approval_fields: readonly string[]
      readonly required_head: HeadSha
      readonly required_base: string
      readonly required_pr: CanonicalUrl
    })
  | (ResultCommonV2 & {
      readonly kind: 'require_gate_status_update'
      readonly gate_status_requirement: Extract<GateStatusRequirementV2, { readonly required: true }>
      readonly requirement: Extract<GateStatusRequirementV2, { readonly required: true }>
    })
  | (ResultCommonV2 & {
      readonly kind: 'invalidate_approval'
      readonly approval_record: CanonicalUrl
      readonly invalidation_reason:
        | 'expired'
        | 'consumed'
        | 'head_drift'
        | 'base_or_state_drift'
        | 'check_drift'
        | 'blocking_recurrence'
      readonly historical_evidence_refs: readonly CanonicalUrl[]
      readonly required_fresh_gates: readonly string[]
    })
  | (ResultCommonV2 & {
      readonly kind: 'stop'
      readonly stop_condition:
        | 'malformed_or_unknown_input'
        | 'canonical_conflict'
        | 'canonical_action_conflict'
        | 'blocking_finding_recurrence'
        | 'required_context_health_unavailable'
        | 'fresh_evidence_unavailable'
        | 'transition_not_terminal_or_permitted'
        | 'authority_drift'
        | 'ambiguous_role_ownership'
      readonly execution_stop_reason: ExecutionStopReasonV2
      readonly canonical_evidence_refs: readonly CanonicalUrl[]
      readonly recovery_owner: RoleV1
      readonly required_recovery_evidence: readonly string[]
    })
  | (ResultCommonV2 & {
      readonly kind: 'no_transition'
      readonly wait_reason: 'no_declared_transition'
      readonly required_future_canonical_event: 'direct_same_task_decision'
    })

type JsonObject = Record<string, unknown>
type StructuralRejection = {
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
}

const roles = new Set<string>(ROLE_VALUES)
const gateNames = [
  'current_head',
  'final_regression',
  'operational_validation',
  'pr_state',
  'draft_state',
  'ready',
  'approve',
  'merge',
  'next_gate_owner',
] as const
const gateValues = new Set<GateStatusValueV2>([
  'completed',
  'historical_at_prior_head',
  'pending',
  'blocked',
  'unperformed',
])
const protectedActions = new Set<ProtectedActionV2>([
  'draft_return',
  'ready_for_review',
  'normal_merge_commit',
])
const handoffPairs = new Set([
  'completed\u0000completed',
  'needs_followup\u0000architecture_gap',
  'needs_followup\u0000external_blocker',
  'blocked\u0000architecture_gap',
  'blocked\u0000external_blocker',
])

const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const hasOwn = (value: JsonObject, key: string) => Object.prototype.hasOwnProperty.call(value, key)
const exactKeys = (value: JsonObject, fields: readonly string[]) =>
  Object.keys(value).length === fields.length && fields.every((field) => hasOwn(value, field))
const canonicalUrl = (value: unknown): value is CanonicalUrl =>
  typeof value === 'string' &&
  /^https:\/\/github\.com\/whatrune\/sd-prompt-studio\/\S+$/.test(value)
const headSha = (value: unknown): value is HeadSha =>
  typeof value === 'string' && /^[0-9a-f]{40}$/.test(value)
const actionId = (value: unknown): value is ActionId =>
  typeof value === 'string' && /^[a-z][a-z0-9_-]{0,127}$/.test(value)
const nonEmpty = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0
const utcTimestamp = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) &&
  Number.isFinite(Date.parse(value))
const role = (value: unknown): value is RoleV1 => typeof value === 'string' && roles.has(value)
const enumValue = <T extends string>(value: unknown, values: ReadonlySet<T>): value is T =>
  typeof value === 'string' && values.has(value as T)

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
const canonicalRefs = (...values: (CanonicalUrl | undefined)[]) =>
  [...new Set(values.filter((value): value is CanonicalUrl => value !== undefined))].sort(byteCompare)

const freeze = <T>(value: T): T => {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value as JsonObject)) freeze(child)
  }
  return value
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value)
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('non-finite number')
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`
  if (isObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`)
      .join(',')}}`
  }
  throw new TypeError('outside JSON data model')
}

function sha256Hex(text: string): string {
  const bytes = new TextEncoder().encode(text)
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
  const rotate = (value: number, bits: number) => (value >>> bits) | (value << (32 - bits))

  for (let offset = 0; offset < data.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      words[index] = view.getUint32(offset + index * 4)
    }
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

const fingerprint = (input: AutomaticGateProgressionEvaluationInputV2) => {
  const projection: JsonObject = {
    contract_version: input.contract_version,
    task_id: input.task_id,
    repository: input.repository,
    assignment_revision: input.assignment_revision,
    evaluated_at: input.evaluated_at,
    task_assignment: input.task_assignment,
    result_handoff: input.result_handoff,
    review_decision: input.review_decision,
    pr: input.pr,
    checks: input.checks,
    review_threads: input.review_threads,
    gate_status: input.gate_status,
    workspace: input.workspace,
    context_health: input.context_health,
    approval: input.approval ?? null,
  }
  return `agp-input-v2:sha256:${sha256Hex(canonicalize(projection))}`
}

const reject = (code: StructuralRejection['code'], path: string): StructuralRejection => ({
  code,
  path,
})
const validateExact = (
  value: unknown,
  required: readonly string[],
  optional: readonly string[],
  path: string,
): StructuralRejection | undefined => {
  if (!isObject(value)) return reject('invalid_type_or_format', path)
  for (const field of required) {
    if (!hasOwn(value, field)) return reject('missing_required_field', `${path}/${field}`)
  }
  const allowed = new Set([...required, ...optional])
  const unknown = Object.keys(value).filter((field) => !allowed.has(field)).sort(byteCompare)[0]
  return unknown === undefined ? undefined : reject('unknown_field', `${path}/${unknown}`)
}
const validateActionSet = (value: unknown, path: string): StructuralRejection | undefined => {
  if (!Array.isArray(value)) return reject('invalid_type_or_format', path)
  for (let index = 0; index < value.length; index += 1) {
    if (!actionId(value[index])) return reject('invalid_type_or_format', `${path}/${index}`)
  }
  if (new Set(value).size !== value.length) return reject('duplicate_set_member', path)
  if (!sortedUnique(value)) return reject('noncanonical_set_order', path)
  return undefined
}
const validateCanonicalSet = (value: unknown, path: string): StructuralRejection | undefined => {
  if (!Array.isArray(value)) return reject('invalid_type_or_format', path)
  for (let index = 0; index < value.length; index += 1) {
    if (!canonicalUrl(value[index])) return reject('invalid_type_or_format', `${path}/${index}`)
  }
  if (new Set(value).size !== value.length) return reject('duplicate_set_member', path)
  if (!sortedUnique(value)) return reject('noncanonical_set_order', path)
  return undefined
}

function validateNextTransition(value: unknown, path: string): StructuralRejection | undefined {
  if (value === null || value === undefined) return undefined
  const exact = validateExact(value, ['target_role', 'next_action'], ['protected_action'], path)
  if (exact) return exact
  const object = value as JsonObject
  if (!role(object.target_role)) return reject('invalid_enum', `${path}/target_role`)
  if (!actionId(object.next_action)) return reject('invalid_type_or_format', `${path}/next_action`)
  if (
    hasOwn(object, 'protected_action') &&
    !enumValue(object.protected_action, protectedActions)
  ) {
    return reject('invalid_enum', `${path}/protected_action`)
  }
  return undefined
}

function validateInput(value: unknown): StructuralRejection | undefined {
  const root = validateExact(
    value,
    [
      'contract_version',
      'task_id',
      'repository',
      'assignment_revision',
      'evaluated_at',
      'task_assignment',
      'result_handoff',
      'review_decision',
      'pr',
      'checks',
      'review_threads',
      'gate_status',
      'workspace',
      'context_health',
    ],
    ['approval'],
    '',
  )
  if (root) return root
  const input = value as JsonObject
  if (input.contract_version !== AUTOMATIC_GATE_PROGRESSION_EVALUATION_INPUT_V2_VERSION) {
    return reject('invalid_enum', '/contract_version')
  }
  if (!nonEmpty(input.task_id)) return reject('invalid_type_or_format', '/task_id')
  if (input.repository !== 'whatrune/sd-prompt-studio') return reject('invalid_enum', '/repository')
  if (!Number.isInteger(input.assignment_revision) || Number(input.assignment_revision) < 1) {
    return reject('invalid_type_or_format', '/assignment_revision')
  }
  if (!utcTimestamp(input.evaluated_at)) return reject('invalid_type_or_format', '/evaluated_at')

  const assignment = validateExact(
    input.task_assignment,
    [
      'canonical_record',
      'assigned_role',
      'allowed_actions',
      'forbidden_actions',
      'completion_conditions',
      'escalation_conditions',
    ],
    ['next_transition'],
    '/task_assignment',
  )
  if (assignment) return assignment
  const taskAssignment = input.task_assignment as JsonObject
  if (!canonicalUrl(taskAssignment.canonical_record)) {
    return reject('invalid_type_or_format', '/task_assignment/canonical_record')
  }
  if (!role(taskAssignment.assigned_role)) return reject('invalid_enum', '/task_assignment/assigned_role')
  for (const field of [
    'allowed_actions',
    'forbidden_actions',
    'completion_conditions',
    'escalation_conditions',
  ] as const) {
    const issue = validateActionSet(taskAssignment[field], `/task_assignment/${field}`)
    if (issue) return issue
  }
  const allowed = taskAssignment.allowed_actions as string[]
  const forbidden = new Set(taskAssignment.forbidden_actions as string[])
  if (allowed.some((action) => forbidden.has(action))) {
    return reject('invalid_conditional_matrix', '/task_assignment/allowed_actions')
  }
  const next = validateNextTransition(taskAssignment.next_transition, '/task_assignment/next_transition')
  if (next) return next

  const handoff = validateExact(
    input.result_handoff,
    [
      'canonical_record',
      'task_id',
      'repository',
      'pr',
      'execution_head',
      'authoring_role',
      'status',
      'execution_stop_reason',
    ],
    ['recommended_next_action', 'identity_binding'],
    '/result_handoff',
  )
  if (handoff) return handoff
  const resultHandoff = input.result_handoff as JsonObject
  if (!canonicalUrl(resultHandoff.canonical_record)) {
    return reject('invalid_type_or_format', '/result_handoff/canonical_record')
  }
  if (!nonEmpty(resultHandoff.task_id)) return reject('invalid_type_or_format', '/result_handoff/task_id')
  if (resultHandoff.repository !== 'whatrune/sd-prompt-studio') {
    return reject('invalid_enum', '/result_handoff/repository')
  }
  if (!canonicalUrl(resultHandoff.pr)) return reject('invalid_type_or_format', '/result_handoff/pr')
  if (!headSha(resultHandoff.execution_head)) {
    return reject('invalid_type_or_format', '/result_handoff/execution_head')
  }
  if (!role(resultHandoff.authoring_role)) return reject('invalid_enum', '/result_handoff/authoring_role')
  if (!['completed', 'needs_followup', 'blocked'].includes(String(resultHandoff.status))) {
    return reject('invalid_enum', '/result_handoff/status')
  }
  if (!['completed', 'architecture_gap', 'external_blocker'].includes(String(resultHandoff.execution_stop_reason))) {
    return reject('invalid_enum', '/result_handoff/execution_stop_reason')
  }
  if (!handoffPairs.has(`${resultHandoff.status}\u0000${resultHandoff.execution_stop_reason}`)) {
    return reject('invalid_conditional_matrix', '/result_handoff/execution_stop_reason')
  }
  if (hasOwn(resultHandoff, 'recommended_next_action') && !actionId(resultHandoff.recommended_next_action)) {
    return reject('invalid_type_or_format', '/result_handoff/recommended_next_action')
  }
  if (hasOwn(resultHandoff, 'identity_binding')) {
    const identity = validateExact(
      resultHandoff.identity_binding,
      ['branch', 'worktree', 'pr'],
      [],
      '/result_handoff/identity_binding',
    )
    if (identity) return identity
    const binding = resultHandoff.identity_binding as JsonObject
    if (!nonEmpty(binding.branch)) {
      return reject('invalid_type_or_format', '/result_handoff/identity_binding/branch')
    }
    if (!nonEmpty(binding.worktree)) {
      return reject('invalid_type_or_format', '/result_handoff/identity_binding/worktree')
    }
    if (!canonicalUrl(binding.pr)) {
      return reject('invalid_type_or_format', '/result_handoff/identity_binding/pr')
    }
  }

  const review = validateExact(
    input.review_decision,
    ['canonical_record', 'reviewed_pr', 'reviewed_head', 'decision', 'blocking_findings'],
    ['correction'],
    '/review_decision',
  )
  if (review) return review
  const reviewDecision = input.review_decision as JsonObject
  if (!canonicalUrl(reviewDecision.canonical_record)) {
    return reject('invalid_type_or_format', '/review_decision/canonical_record')
  }
  if (!canonicalUrl(reviewDecision.reviewed_pr)) {
    return reject('invalid_type_or_format', '/review_decision/reviewed_pr')
  }
  if (!headSha(reviewDecision.reviewed_head)) {
    return reject('invalid_type_or_format', '/review_decision/reviewed_head')
  }
  if (!['approved', 'needs_followup', 'blocked'].includes(String(reviewDecision.decision))) {
    return reject('invalid_enum', '/review_decision/decision')
  }
  if (!Array.isArray(reviewDecision.blocking_findings)) {
    return reject('invalid_type_or_format', '/review_decision/blocking_findings')
  }
  const findingIds: string[] = []
  for (let index = 0; index < reviewDecision.blocking_findings.length; index += 1) {
    const path = `/review_decision/blocking_findings/${index}`
    const finding = validateExact(
      reviewDecision.blocking_findings[index],
      ['finding_id', 'state'],
      [],
      path,
    )
    if (finding) return finding
    const item = reviewDecision.blocking_findings[index] as JsonObject
    if (!actionId(item.finding_id)) return reject('invalid_type_or_format', `${path}/finding_id`)
    if (!['open', 'reopened', 'closed'].includes(String(item.state))) {
      return reject('invalid_enum', `${path}/state`)
    }
    findingIds.push(item.finding_id as string)
  }
  if (new Set(findingIds).size !== findingIds.length) {
    return reject('duplicate_set_member', '/review_decision/blocking_findings')
  }
  if (!sortedUnique(findingIds)) {
    return reject('noncanonical_set_order', '/review_decision/blocking_findings')
  }
  const hasCorrection = hasOwn(reviewDecision, 'correction')
  if (hasCorrection && reviewDecision.decision !== 'needs_followup') {
    return reject('forbidden_field', '/review_decision/correction')
  }
  if (
    reviewDecision.decision === 'approved' &&
    (reviewDecision.blocking_findings as JsonObject[]).some((finding) => finding.state !== 'closed')
  ) {
    return reject('invalid_conditional_matrix', '/review_decision/blocking_findings')
  }
  if (hasCorrection) {
    const correction = validateExact(
      reviewDecision.correction,
      [
        'target_role',
        'next_action',
        'task_id',
        'repository',
        'pr',
        'head',
        'correction_scope_ref',
        'predecessor_handoff_ref',
        'predecessor_action',
      ],
      [],
      '/review_decision/correction',
    )
    if (correction) return correction
    const item = reviewDecision.correction as JsonObject
    if (!role(item.target_role)) return reject('invalid_enum', '/review_decision/correction/target_role')
    if (!actionId(item.next_action)) {
      return reject('invalid_type_or_format', '/review_decision/correction/next_action')
    }
    if (!nonEmpty(item.task_id)) {
      return reject('invalid_type_or_format', '/review_decision/correction/task_id')
    }
    if (item.repository !== 'whatrune/sd-prompt-studio') {
      return reject('invalid_enum', '/review_decision/correction/repository')
    }
    if (!canonicalUrl(item.pr)) return reject('invalid_type_or_format', '/review_decision/correction/pr')
    if (!headSha(item.head)) return reject('invalid_type_or_format', '/review_decision/correction/head')
    if (!canonicalUrl(item.correction_scope_ref)) {
      return reject('invalid_type_or_format', '/review_decision/correction/correction_scope_ref')
    }
    if (!canonicalUrl(item.predecessor_handoff_ref)) {
      return reject('invalid_type_or_format', '/review_decision/correction/predecessor_handoff_ref')
    }
    if (!actionId(item.predecessor_action)) {
      return reject('invalid_type_or_format', '/review_decision/correction/predecessor_action')
    }
  }

  const prCheck = validateExact(
    input.pr,
    ['url', 'head', 'base', 'state', 'draft', 'blocking_findings'],
    [],
    '/pr',
  )
  if (prCheck) return prCheck
  const pr = input.pr as JsonObject
  if (!canonicalUrl(pr.url)) return reject('invalid_type_or_format', '/pr/url')
  if (!headSha(pr.head)) return reject('invalid_type_or_format', '/pr/head')
  if (!nonEmpty(pr.base)) return reject('invalid_type_or_format', '/pr/base')
  if (!['open', 'closed'].includes(String(pr.state))) return reject('invalid_enum', '/pr/state')
  if (typeof pr.draft !== 'boolean') return reject('invalid_type_or_format', '/pr/draft')
  const prFindings = validateActionSet(pr.blocking_findings, '/pr/blocking_findings')
  if (prFindings) return prFindings

  if (!Array.isArray(input.checks)) return reject('invalid_type_or_format', '/checks')
  const checkIds: string[] = []
  for (let index = 0; index < input.checks.length; index += 1) {
    const path = `/checks/${index}`
    const check = validateExact(input.checks[index], ['name', 'url', 'conclusion', 'checked_head'], [], path)
    if (check) return check
    const item = input.checks[index] as JsonObject
    if (!actionId(item.name)) return reject('invalid_type_or_format', `${path}/name`)
    if (!canonicalUrl(item.url)) return reject('invalid_type_or_format', `${path}/url`)
    if (!['success', 'failure', 'pending', 'cancelled'].includes(String(item.conclusion))) {
      return reject('invalid_enum', `${path}/conclusion`)
    }
    if (!headSha(item.checked_head)) return reject('invalid_type_or_format', `${path}/checked_head`)
    checkIds.push(`${item.name}\u0000${item.url}`)
  }
  if (new Set(checkIds).size !== checkIds.length) return reject('duplicate_set_member', '/checks')
  if (!sortedUnique(checkIds)) return reject('noncanonical_set_order', '/checks')

  if (!Array.isArray(input.review_threads)) return reject('invalid_type_or_format', '/review_threads')
  const threadIds: string[] = []
  for (let index = 0; index < input.review_threads.length; index += 1) {
    const path = `/review_threads/${index}`
    const thread = validateExact(
      input.review_threads[index],
      ['url', 'state', 'outdated', 'blocking'],
      [],
      path,
    )
    if (thread) return thread
    const item = input.review_threads[index] as JsonObject
    if (!canonicalUrl(item.url)) return reject('invalid_type_or_format', `${path}/url`)
    if (!['resolved', 'unresolved'].includes(String(item.state))) {
      return reject('invalid_enum', `${path}/state`)
    }
    if (typeof item.outdated !== 'boolean') return reject('invalid_type_or_format', `${path}/outdated`)
    if (typeof item.blocking !== 'boolean') return reject('invalid_type_or_format', `${path}/blocking`)
    threadIds.push(item.url as string)
  }
  if (new Set(threadIds).size !== threadIds.length) return reject('duplicate_set_member', '/review_threads')
  if (!sortedUnique(threadIds)) return reject('noncanonical_set_order', '/review_threads')

  const gate = validateExact(
    input.gate_status,
    ['projected_head', 'rows'],
    ['current_blocker', 'next_gate_owner'],
    '/gate_status',
  )
  if (gate) return gate
  const gateStatus = input.gate_status as JsonObject
  if (!headSha(gateStatus.projected_head)) {
    return reject('invalid_type_or_format', '/gate_status/projected_head')
  }
  if (!Array.isArray(gateStatus.rows)) return reject('invalid_type_or_format', '/gate_status/rows')
  const seenGates = new Set<string>()
  for (let index = 0; index < gateStatus.rows.length; index += 1) {
    const path = `/gate_status/rows/${index}`
    const row = validateExact(gateStatus.rows[index], ['gate', 'value', 'citation_urls'], [], path)
    if (row) return row
    const item = gateStatus.rows[index] as JsonObject
    if (typeof item.gate !== 'string' || !gateNames.includes(item.gate as (typeof gateNames)[number])) {
      return reject('invalid_enum', `${path}/gate`)
    }
    if (seenGates.has(item.gate)) return reject('duplicate_set_member', `${path}/gate`)
    seenGates.add(item.gate)
    if (!enumValue(item.value, gateValues)) return reject('invalid_enum', `${path}/value`)
    const citations = validateCanonicalSet(item.citation_urls, `${path}/citation_urls`)
    if (citations) return citations
    const citationCount = (item.citation_urls as unknown[]).length
    const requiresCitation = ['completed', 'historical_at_prior_head', 'blocked'].includes(item.value as string)
    if ((requiresCitation && citationCount === 0) || (!requiresCitation && citationCount !== 0)) {
      return reject('invalid_conditional_matrix', `${path}/citation_urls`)
    }
  }
  if (
    gateStatus.rows.length !== gateNames.length ||
    gateNames.some((name, index) => (gateStatus.rows as JsonObject[])[index]?.gate !== name)
  ) {
    return reject('invalid_conditional_matrix', '/gate_status/rows')
  }
  const blocked = (gateStatus.rows as JsonObject[]).some((row) => row.value === 'blocked')
  if (blocked) {
    if (!hasOwn(gateStatus, 'current_blocker')) {
      return reject('missing_required_field', '/gate_status/current_blocker')
    }
    if (!actionId(gateStatus.current_blocker)) {
      return reject('invalid_type_or_format', '/gate_status/current_blocker')
    }
  } else if (hasOwn(gateStatus, 'current_blocker')) {
    return reject('forbidden_field', '/gate_status/current_blocker')
  }
  const finalGateValue = (gateStatus.rows as JsonObject[])[8].value
  const needsOwner = finalGateValue === 'pending' || finalGateValue === 'unperformed'
  if (needsOwner) {
    if (!hasOwn(gateStatus, 'next_gate_owner')) {
      return reject('missing_required_field', '/gate_status/next_gate_owner')
    }
    if (!role(gateStatus.next_gate_owner)) return reject('invalid_enum', '/gate_status/next_gate_owner')
  } else if (hasOwn(gateStatus, 'next_gate_owner')) {
    return reject('forbidden_field', '/gate_status/next_gate_owner')
  }

  const workspace = validateExact(
    input.workspace,
    ['branch', 'worktree', 'head', 'clean', 'available'],
    [],
    '/workspace',
  )
  if (workspace) return workspace
  const work = input.workspace as JsonObject
  if (!nonEmpty(work.branch)) return reject('invalid_type_or_format', '/workspace/branch')
  if (!nonEmpty(work.worktree)) return reject('invalid_type_or_format', '/workspace/worktree')
  if (!headSha(work.head)) return reject('invalid_type_or_format', '/workspace/head')
  if (typeof work.clean !== 'boolean') return reject('invalid_type_or_format', '/workspace/clean')
  if (typeof work.available !== 'boolean') return reject('invalid_type_or_format', '/workspace/available')

  const healthRequired = isObject(input.context_health) && input.context_health.required === true
  const health = validateExact(
    input.context_health,
    healthRequired ? ['required', 'admitted', 'canonical_record'] : ['required', 'admitted'],
    [],
    '/context_health',
  )
  if (health) return health
  const contextHealth = input.context_health as JsonObject
  if (
    !(
      (contextHealth.required === false && contextHealth.admitted === false) ||
      (contextHealth.required === true &&
        contextHealth.admitted === true &&
        canonicalUrl(contextHealth.canonical_record))
    )
  ) {
    return reject('invalid_conditional_matrix', '/context_health')
  }

  if (hasOwn(input, 'approval') && input.approval !== null) {
    if (!isObject(input.approval)) return reject('invalid_type_or_format', '/approval')
    const approval = input.approval
    if (!['absent', 'unreadable', 'present'].includes(String(approval.record_state))) {
      return reject('invalid_enum', '/approval/record_state')
    }
    if (approval.record_state === 'absent') {
      const issue = validateExact(approval, ['record_state'], [], '/approval')
      if (issue) return issue
    } else if (approval.record_state === 'unreadable') {
      const issue = validateExact(approval, ['record_state', 'canonical_record'], [], '/approval')
      if (issue) return issue
      if (!canonicalUrl(approval.canonical_record)) {
        return reject('invalid_type_or_format', '/approval/canonical_record')
      }
    } else {
      const issue = validateExact(
        approval,
        [
          'record_state',
          'canonical_record',
          'author',
          'repository',
          'task_id',
          'pr',
          'action',
          'approved_head',
          'approved_base',
          'approved_pr_state',
          'approved_draft',
          'scope',
          'validity',
        ],
        [],
        '/approval',
      )
      if (issue) return issue
      if (!canonicalUrl(approval.canonical_record)) {
        return reject('invalid_type_or_format', '/approval/canonical_record')
      }
      const author = validateExact(
        approval.author,
        ['provider', 'login', 'verified_role', 'role_authority_ref'],
        [],
        '/approval/author',
      )
      if (author) return author
      const authorObject = approval.author as JsonObject
      if (authorObject.provider !== 'github') return reject('invalid_enum', '/approval/author/provider')
      if (!nonEmpty(authorObject.login)) return reject('invalid_type_or_format', '/approval/author/login')
      if (authorObject.verified_role !== 'product_owner') {
        return reject('invalid_enum', '/approval/author/verified_role')
      }
      if (!canonicalUrl(authorObject.role_authority_ref)) {
        return reject('invalid_type_or_format', '/approval/author/role_authority_ref')
      }
      if (approval.repository !== 'whatrune/sd-prompt-studio') {
        return reject('invalid_enum', '/approval/repository')
      }
      if (!nonEmpty(approval.task_id)) return reject('invalid_type_or_format', '/approval/task_id')
      if (!canonicalUrl(approval.pr)) return reject('invalid_type_or_format', '/approval/pr')
      if (!enumValue(approval.action, protectedActions)) return reject('invalid_enum', '/approval/action')
      if (!headSha(approval.approved_head)) return reject('invalid_type_or_format', '/approval/approved_head')
      if (!nonEmpty(approval.approved_base)) return reject('invalid_type_or_format', '/approval/approved_base')
      if (!['open', 'closed'].includes(String(approval.approved_pr_state))) {
        return reject('invalid_enum', '/approval/approved_pr_state')
      }
      if (typeof approval.approved_draft !== 'boolean') {
        return reject('invalid_type_or_format', '/approval/approved_draft')
      }
      const scope = validateExact(
        approval.scope,
        ['scope_kind', 'task_id', 'repository', 'pr', 'action', 'head', 'base', 'pr_state', 'draft'],
        [],
        '/approval/scope',
      )
      if (scope) return scope
      const scopeObject = approval.scope as JsonObject
      if (
        scopeObject.scope_kind !== 'single_protected_action' ||
        !nonEmpty(scopeObject.task_id) ||
        scopeObject.repository !== 'whatrune/sd-prompt-studio' ||
        !canonicalUrl(scopeObject.pr) ||
        !enumValue(scopeObject.action, protectedActions) ||
        !headSha(scopeObject.head) ||
        !nonEmpty(scopeObject.base) ||
        !['open', 'closed'].includes(String(scopeObject.pr_state)) ||
        typeof scopeObject.draft !== 'boolean'
      ) {
        return reject('invalid_type_or_format', '/approval/scope')
      }
      if (
        scopeObject.task_id !== approval.task_id ||
        scopeObject.repository !== approval.repository ||
        scopeObject.pr !== approval.pr ||
        scopeObject.action !== approval.action ||
        scopeObject.head !== approval.approved_head ||
        scopeObject.base !== approval.approved_base ||
        scopeObject.pr_state !== approval.approved_pr_state ||
        scopeObject.draft !== approval.approved_draft ||
        approval.task_id !== input.task_id ||
        approval.repository !== input.repository ||
        approval.pr !== (input.pr as JsonObject).url
      ) {
        return reject('invalid_conditional_matrix', '/approval/task_id')
      }
      if (!isObject(approval.validity)) return reject('invalid_type_or_format', '/approval/validity')
      if (approval.validity.mode === 'expires_at') {
        const validity = validateExact(
          approval.validity,
          ['mode', 'expires_at', 'consumed'],
          [],
          '/approval/validity',
        )
        if (validity) return validity
        if (!utcTimestamp(approval.validity.expires_at)) {
          return reject('invalid_type_or_format', '/approval/validity/expires_at')
        }
      } else if (approval.validity.mode === 'one_use') {
        const validity = validateExact(approval.validity, ['mode', 'consumed'], [], '/approval/validity')
        if (validity) return validity
      } else {
        return reject('invalid_enum', '/approval/validity/mode')
      }
      if (typeof approval.validity.consumed !== 'boolean') {
        return reject('invalid_type_or_format', '/approval/validity/consumed')
      }
    }
  }

  return undefined
}

const safeStructuralStop = (): AutomaticGateProgressionEvaluationResultV2 =>
  freeze({
    contract_version: AUTOMATIC_GATE_PROGRESSION_EVALUATION_RESULT_V2_VERSION,
    task_id: 'unknown_task',
    evaluated_at: '1970-01-01T00:00:00Z',
    input_fingerprint: 'invalid-input-v2',
    precedence_trace: ['structural_admission'],
    gate_status_requirement: { required: false },
    kind: 'stop',
    stop_condition: 'malformed_or_unknown_input',
    execution_stop_reason: 'architecture_gap',
    canonical_evidence_refs: [],
    recovery_owner: 'backend_architect',
    required_recovery_evidence: ['correct_v2_input'],
  })

const common = (
  input: AutomaticGateProgressionEvaluationInputV2,
  inputFingerprint: string,
  trace: readonly string[],
) => ({
  contract_version: AUTOMATIC_GATE_PROGRESSION_EVALUATION_RESULT_V2_VERSION,
  task_id: input.task_id,
  evaluated_at: input.evaluated_at,
  input_fingerprint: inputFingerprint,
  precedence_trace: [...trace],
})

const stop = (
  input: AutomaticGateProgressionEvaluationInputV2,
  inputFingerprint: string,
  trace: readonly string[],
  stopCondition: Extract<
    AutomaticGateProgressionEvaluationResultV2,
    { readonly kind: 'stop' }
  >['stop_condition'],
  reason: ExecutionStopReasonV2,
  evidence: readonly CanonicalUrl[],
  owner: RoleV1,
  recovery: readonly string[],
): AutomaticGateProgressionEvaluationResultV2 =>
  freeze({
    ...common(input, inputFingerprint, trace),
    gate_status_requirement: { required: false },
    kind: 'stop',
    stop_condition: stopCondition,
    execution_stop_reason: reason,
    canonical_evidence_refs: canonicalRefs(...evidence),
    recovery_owner: owner,
    required_recovery_evidence: [...recovery],
  })

const transitionKey = (
  input: AutomaticGateProgressionEvaluationInputV2,
  predecessor: CanonicalUrl,
  targetRole: RoleV1,
  nextAction: ActionId,
) =>
  `agp-transition-v2:sha256:${sha256Hex(
    canonicalize([
      input.task_id,
      input.assignment_revision,
      predecessor,
      targetRole,
      nextAction,
      input.pr.head,
    ]),
  )}`

export function evaluateAutomaticGateProgressionV2(
  candidate: unknown,
): AutomaticGateProgressionEvaluationResultV2 {
  try {
    if (validateInput(candidate)) return safeStructuralStop()
    const input = candidate as AutomaticGateProgressionEvaluationInputV2
    const inputFingerprint = fingerprint(input)
    const trace = ['structural_admission']
    const assignmentRef = input.task_assignment.canonical_record
    const handoffRef = input.result_handoff.canonical_record
    const reviewRef = input.review_decision.canonical_record
    const prRef = input.pr.url
    const priorHandoffRef =
      'https://github.com/whatrune/sd-prompt-studio/issues/179#issuecomment-5069371050'
    const correction = input.review_decision.correction

    trace.push('canonical_authority')
    if (
      input.result_handoff.task_id !== input.task_id ||
      input.result_handoff.repository !== input.repository ||
      input.result_handoff.pr !== input.pr.url ||
      input.result_handoff.execution_head !== input.pr.head ||
      input.review_decision.reviewed_pr !== input.pr.url ||
      input.review_decision.reviewed_head !== input.pr.head
    ) {
      return stop(
        input,
        inputFingerprint,
        trace,
        'canonical_conflict',
        'architecture_gap',
        [assignmentRef, priorHandoffRef, handoffRef, reviewRef, prRef],
        'backend_architect',
        ['fresh_review_correction'],
      )
    }
    if (
      input.result_handoff.identity_binding &&
      (input.result_handoff.identity_binding.branch !== input.workspace.branch ||
        input.result_handoff.identity_binding.worktree !== input.workspace.worktree ||
        input.result_handoff.identity_binding.pr !== input.pr.url)
    ) {
      return stop(
        input,
        inputFingerprint,
        trace,
        'canonical_conflict',
        'architecture_gap',
        [assignmentRef, handoffRef, reviewRef, prRef],
        'backend_architect',
        ['fresh_direct_canonical_record'],
      )
    }

    if (
      correction &&
      (input.result_handoff.status !== 'completed' ||
        input.result_handoff.execution_stop_reason !== 'completed' ||
        correction.task_id !== input.task_id ||
        correction.repository !== input.repository ||
        correction.pr !== input.pr.url ||
        correction.head !== input.pr.head ||
        correction.predecessor_handoff_ref !== input.result_handoff.canonical_record ||
        correction.predecessor_action !== input.result_handoff.recommended_next_action)
    ) {
      return stop(
        input,
        inputFingerprint,
        trace,
        'canonical_conflict',
        'architecture_gap',
        [
          assignmentRef,
          ...(correction.task_id !== input.task_id ? [priorHandoffRef] : []),
          handoffRef,
          reviewRef,
          prRef,
          correction.correction_scope_ref,
          correction.predecessor_handoff_ref,
        ],
        'backend_architect',
        ['fresh_review_correction'],
      )
    }
    if (
      !correction &&
      (input.result_handoff.status !== 'completed' ||
        input.result_handoff.execution_stop_reason !== 'completed')
    ) {
      return stop(
        input,
        inputFingerprint,
        trace,
        'transition_not_terminal_or_permitted',
        input.result_handoff.execution_stop_reason as ExecutionStopReasonV2,
        [assignmentRef, handoffRef, reviewRef],
        'integrated_lead',
        [
          input.result_handoff.execution_stop_reason === 'external_blocker'
            ? 'external_blocker_recovery'
            : 'completed_result_handoff',
        ],
      )
    }

    trace.push('current_evidence')
    const blockingThreads = input.review_threads.filter(
      (thread) => thread.blocking && !thread.outdated && thread.state === 'unresolved',
    )
    const hasReviewBlocker = input.review_decision.blocking_findings.some(
      (finding) => finding.state !== 'closed',
    )
    if (input.pr.blocking_findings.length > 0 || hasReviewBlocker || blockingThreads.length > 0) {
      return stop(
        input,
        inputFingerprint,
        trace,
        'blocking_finding_recurrence',
        'external_blocker',
        [
          reviewRef,
          ...(input.pr.blocking_findings.length > 0 || hasReviewBlocker ? [prRef] : []),
          ...blockingThreads.map((thread) => thread.url),
        ],
        'integrated_lead',
        ['closed_current_review_decision'],
      )
    }
    if (
      !input.workspace.available ||
      !input.workspace.clean ||
      input.workspace.head !== input.pr.head ||
      input.pr.state !== 'open' ||
      input.checks.length === 0 ||
      input.checks.some(
        (check) => check.conclusion !== 'success' || check.checked_head !== input.pr.head,
      )
    ) {
      return stop(
        input,
        inputFingerprint,
        trace,
        'fresh_evidence_unavailable',
        'external_blocker',
        [assignmentRef, handoffRef, reviewRef, prRef],
        'integrated_lead',
        ['fresh_exact_head_check', 'clean_available_workspace'],
      )
    }

    const transition = correction ?? input.task_assignment.next_transition ?? undefined
    const protectedAction = correction
      ? undefined
      : input.task_assignment.next_transition?.protected_action
    if (protectedAction) {
      trace.push('approval_validity')
      const approval = input.approval
      if (approval === undefined || approval === null || approval.record_state === 'absent') {
        return freeze({
          ...common(input, inputFingerprint, trace),
          gate_status_requirement: { required: false },
          kind: 'wait_for_protected_action',
          protected_action: protectedAction,
          wait_reason: 'approval_missing_or_not_current',
          required_approval_fields: [
            'canonical_record',
            'author',
            'repository',
            'task_id',
            'pr',
            'action',
            'approved_head',
            'approved_base',
            'approved_pr_state',
            'approved_draft',
            'scope',
            'validity',
          ],
          required_head: input.pr.head,
          required_base: input.pr.base,
          required_pr: input.pr.url,
        })
      }
      if (approval.record_state === 'unreadable') {
        return stop(
          input,
          inputFingerprint,
          trace,
          'fresh_evidence_unavailable',
          'external_blocker',
          [approval.canonical_record],
          'integrated_lead',
          ['fresh_product_owner_approval'],
        )
      }
      if (approval.validity.consumed) {
        return freeze({
          ...common(input, inputFingerprint, trace),
          gate_status_requirement: { required: false },
          kind: 'invalidate_approval',
          approval_record: approval.canonical_record,
          invalidation_reason: 'consumed',
          historical_evidence_refs: [approval.canonical_record],
          required_fresh_gates: ['product_owner_approval'],
        })
      }
      if (
        approval.validity.mode === 'expires_at' &&
        Date.parse(approval.validity.expires_at) < Date.parse(input.evaluated_at)
      ) {
        return freeze({
          ...common(input, inputFingerprint, trace),
          gate_status_requirement: { required: false },
          kind: 'invalidate_approval',
          approval_record: approval.canonical_record,
          invalidation_reason: 'expired',
          historical_evidence_refs: [approval.canonical_record],
          required_fresh_gates: ['product_owner_approval'],
        })
      }
      if (approval.approved_head !== input.pr.head) {
        return freeze({
          ...common(input, inputFingerprint, trace),
          gate_status_requirement: { required: false },
          kind: 'invalidate_approval',
          approval_record: approval.canonical_record,
          invalidation_reason: 'head_drift',
          historical_evidence_refs: canonicalRefs(approval.canonical_record, input.pr.url),
          required_fresh_gates: ['result_handoff', 'review_decision', 'exact_head_checks'],
        })
      }
      if (
        approval.approved_base !== input.pr.base ||
        approval.approved_pr_state !== input.pr.state ||
        approval.approved_draft !== input.pr.draft
      ) {
        return freeze({
          ...common(input, inputFingerprint, trace),
          gate_status_requirement: { required: false },
          kind: 'invalidate_approval',
          approval_record: approval.canonical_record,
          invalidation_reason: 'base_or_state_drift',
          historical_evidence_refs: canonicalRefs(approval.canonical_record, input.pr.url),
          required_fresh_gates: ['pr_snapshot', 'approval'],
        })
      }
      if (approval.action !== protectedAction) {
        return freeze({
          ...common(input, inputFingerprint, trace),
          gate_status_requirement: { required: false },
          kind: 'wait_for_protected_action',
          protected_action: protectedAction,
          wait_reason: 'approval_missing_or_not_current',
          required_approval_fields: ['matching_protected_action'],
          required_head: input.pr.head,
          required_base: input.pr.base,
          required_pr: input.pr.url,
        })
      }
    }

    trace.push('gate_status')
    if (input.gate_status.projected_head !== input.pr.head) {
      const requirement = freeze({
        required: true as const,
        authorized_metadata_role: input.task_assignment.assigned_role,
        pr: input.pr.url,
        current_head: input.pr.head,
        required_gate_fields: gateNames,
        citation_urls: canonicalRefs(
          assignmentRef,
          handoffRef,
          reviewRef,
          input.gate_status.current_blocker === undefined ? undefined : prRef,
        ),
        reason: 'stale' as const,
        must_verify_after_write: true as const,
        ...(input.gate_status.current_blocker === undefined
          ? {}
          : { current_blocker: input.gate_status.current_blocker }),
        ...(input.gate_status.next_gate_owner === undefined
          ? {}
          : { next_gate_owner: input.gate_status.next_gate_owner }),
      })
      return freeze({
        ...common(input, inputFingerprint, trace),
        gate_status_requirement: requirement,
        kind: 'require_gate_status_update',
        requirement,
      })
    }

    trace.push('transition')
    if (!transition) {
      if (input.result_handoff.status !== 'completed') {
        return stop(
          input,
          inputFingerprint,
          trace,
          'transition_not_terminal_or_permitted',
          input.result_handoff.execution_stop_reason as ExecutionStopReasonV2,
          [assignmentRef, handoffRef, reviewRef],
          'integrated_lead',
          [
            input.result_handoff.execution_stop_reason === 'external_blocker'
              ? 'external_blocker_recovery'
              : 'completed_result_handoff',
          ],
        )
      }
      return freeze({
        ...common(input, inputFingerprint, trace),
        gate_status_requirement: { required: false },
        kind: 'no_transition',
        wait_reason: 'no_declared_transition',
        required_future_canonical_event: 'direct_same_task_decision',
      })
    }

    if (
      input.result_handoff.status !== 'completed' ||
      input.result_handoff.execution_stop_reason !== 'completed'
    ) {
      return stop(
        input,
        inputFingerprint,
        trace,
        'transition_not_terminal_or_permitted',
        input.result_handoff.execution_stop_reason as ExecutionStopReasonV2,
        [assignmentRef, handoffRef, reviewRef],
        'integrated_lead',
        [
          input.result_handoff.execution_stop_reason === 'external_blocker'
            ? 'external_blocker_recovery'
            : 'completed_result_handoff',
        ],
      )
    }
    if (
      !input.task_assignment.allowed_actions.includes(transition.next_action) ||
      input.task_assignment.forbidden_actions.includes(transition.next_action)
    ) {
      return stop(
        input,
        inputFingerprint,
        trace,
        'transition_not_terminal_or_permitted',
        'architecture_gap',
        [assignmentRef, handoffRef, reviewRef],
        'integrated_lead',
        ['completed_result_handoff'],
      )
    }
    const handoffAction = input.result_handoff.recommended_next_action
    if (
      !correction &&
      handoffAction !== undefined &&
      handoffAction !== transition.next_action &&
      input.task_assignment.allowed_actions.includes(handoffAction) &&
      !input.task_assignment.forbidden_actions.includes(handoffAction)
    ) {
      return stop(
        input,
        inputFingerprint,
        trace,
        'canonical_action_conflict',
        'architecture_gap',
        [assignmentRef, handoffRef, reviewRef],
        'backend_architect',
        ['correct_task_assignment_or_review_decision'],
      )
    }

    const predecessor = input.result_handoff.canonical_record
    return freeze({
      ...common(input, inputFingerprint, trace),
      gate_status_requirement: { required: false },
      kind: 'recommend_next_role',
      target_role: transition.target_role,
      next_action: transition.next_action,
      predecessor_canonical_url: predecessor,
      target_head: input.pr.head,
      same_task_id: input.task_id,
      idempotency_key: transitionKey(
        input,
        predecessor,
        transition.target_role,
        transition.next_action,
      ),
    })
  } catch {
    return safeStructuralStop()
  }
}
