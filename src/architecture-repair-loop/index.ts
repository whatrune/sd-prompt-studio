/** Frozen V9 + CAA014-017 Architecture Repair Loop public surface. */
export type StructuralRejectionV2 = Readonly<{ code: string; path: string; message: string }>
export type AdmissionResultV2<T> = Readonly<{ branch: 'accepted'; value: T } | { branch: 'rejected'; rejection: StructuralRejectionV2 }>
export type ArchitectureRepairMaterializationPortResponseV8 = Readonly<{ request_kind: 'canonical_body' | 'repository_state' | 'issue_state'; request_identity: string; observed_at: string; status: 'found'; body_utf8: string; body_utf8_length: number; body_sha256: string }>
export type ArchitectureRepairAuthorityMaterializationPortsV8 = Readonly<{
  readCanonicalBody: (request: unknown, observedAt: string) => Promise<ArchitectureRepairMaterializationPortResponseV8>
  readRepositoryState: (request: unknown, observedAt: string) => Promise<ArchitectureRepairMaterializationPortResponseV8>
  readIssueState: (request: unknown, observedAt: string) => Promise<ArchitectureRepairMaterializationPortResponseV8>
}>
export type ArchitectureRepairMaterializationResultV8 = Readonly<{ branch: 'produced'; proof_token: object } | { branch: 'rejected'; rejection: StructuralRejectionV2 } | { branch: 'failed'; failure: Readonly<{ schema_version: 'ArchitectureRepairMaterializationFailureV8'; code: 'external_blocker' | 'internal_failure'; stage: string; path: string; safe_message: 'external blocker' | 'internal failure'; retryable: false }> }>

type Obj = Record<string, unknown>
const isObject = (value: unknown): value is Obj => value !== null && typeof value === 'object' && !Array.isArray(value)
const tokens = new WeakMap<object, Readonly<{ input: Obj; canonicalBodies: readonly ArchitectureRepairMaterializationPortResponseV8[]; repository: ArchitectureRepairMaterializationPortResponseV8; issues: readonly ArchitectureRepairMaterializationPortResponseV8[]; proof: Obj }>>()
let nextTokenId = 0
const deepFreeze = <T>(value: T): Readonly<T> => { if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) { for (const child of Object.values(value as Obj)) deepFreeze(child); Object.freeze(value) }; return value as Readonly<T> }
const reject = (code: string, path: string, message: string): AdmissionResultV2<never> => Object.freeze({ branch: 'rejected' as const, rejection: Object.freeze({ code, path, message }) })
const materializationFailure = (code: 'external_blocker' | 'internal_failure', stage: string, path: string): ArchitectureRepairMaterializationResultV8 =>
  Object.freeze({ branch: 'failed' as const, failure: Object.freeze({ schema_version: 'ArchitectureRepairMaterializationFailureV8' as const, code, stage, path, safe_message: code === 'external_blocker' ? 'external blocker' as const : 'internal failure' as const, retryable: false as const }) })
const exact = (value: unknown, fields: readonly string[], path: string): AdmissionResultV2<Obj> => {
  if (!isObject(value)) return reject('invalid_type', path, 'object required')
  const unknown = Object.keys(value).filter((key) => !fields.includes(key)).sort(compareUtf8)[0]
  if (unknown) return reject('unknown_field', `${path}/${unknown}`, 'unknown field')
  const missing = fields.find((field) => !Object.prototype.hasOwnProperty.call(value, field))
  return missing ? reject('missing_required_field', `${path}/${missing}`, 'missing required field') : Object.freeze({ branch: 'accepted' as const, value })
}
const sha256 = async (value: string): Promise<string> => {
  const hash = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}
const metadata = (body: string): Obj | null => {
  const match = /^# [^\n]+\n\n```yaml\n([\s\S]*?)\n```/.exec(body)
  if (!match) return null
  const values: Obj = {}
  for (const line of match[1].split('\n')) {
    if (/^[ \t]/.test(line)) continue
    const index = line.indexOf(':')
    if (index > 0) {
      const key = line.slice(0, index)
      if (Object.prototype.hasOwnProperty.call(values, key)) return null
      values[key] = line.slice(index + 1).trim()
    }
  }
  return values
}
function compareUtf8(left: string, right: string): number {
  const a = new TextEncoder().encode(left); const b = new TextEncoder().encode(right)
  for (let index = 0; index < Math.min(a.length, b.length); index += 1) if (a[index] !== b[index]) return a[index] - b[index]
  return a.length - b.length
}
const recordRef = (value: unknown, path: string): AdmissionResultV2<Obj> => {
  const admitted = exact(value, ['body_sha256', 'body_utf8_length', 'canonical_record', 'record_type', 'task_id'], path)
  if (admitted.branch === 'rejected') return admitted
  if (typeof admitted.value.body_sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(admitted.value.body_sha256) || !Number.isSafeInteger(admitted.value.body_utf8_length) || Number(admitted.value.body_utf8_length) < 0 || typeof admitted.value.canonical_record !== 'string' || locator(admitted.value.canonical_record).branch === 'rejected' || typeof admitted.value.record_type !== 'string' || admitted.value.record_type.length === 0 || typeof admitted.value.task_id !== 'string' || admitted.value.task_id.length === 0) return reject('invalid_format', path, 'invalid canonical record reference')
  return admitted
}
const DECISION_FINDING_IDS = Object.freeze([
  'B-210-A008-REV-01',
  'B-210-A008-REV-02',
  'B-210-A008-REV-03',
  'B-210-CBV3-DISPATCH-01',
  'B-210-CBV5-REV-01',
  'B-210-CBV7-REV-01',
  'B-210-CBV8-REV-01',
])
const DECISION_STATES = Object.freeze(['open', 'closed', 'reopened_with_new_finding'])
const decisionBinding = (
  value: unknown,
  path: string,
  relationPolicy: 'enforce' | 'defer_to_proof_binding' = 'enforce',
): AdmissionResultV2<Obj> => {
  const fields = ['schema_version','decision_record','task_id','authoring_role','decision','blocking_finding_count','finding_dispositions','contract_gap_closed','architecture_review_closed','implementation_resume_allowed','source_issue_209_resume_allowed','status','execution_stop_reason','projection_digest']
  const admitted = exact(value, fields, path); if (admitted.branch === 'rejected') return admitted
  const ref = recordRef(admitted.value.decision_record, `${path}/decision_record`); if (ref.branch === 'rejected') return ref
  if (ref.value.record_type !== 'independent_architecture_review_decision') return reject('cross_reference_mismatch', `${path}/decision_record/record_type`, 'Decision record type mismatch')
  if (!Array.isArray(admitted.value.finding_dispositions)) return reject('invalid_type', `${path}/finding_dispositions`, 'array required')
  const findingIds: string[] = []
  let nonclosedCount = 0
  for (const [index, disposition] of admitted.value.finding_dispositions.entries()) {
    const item = exact(disposition, ['evidence_ref','finding_id','state'], `${path}/finding_dispositions/${index}`); if (item.branch === 'rejected') return item
    const evidence = recordRef(item.value.evidence_ref, `${path}/finding_dispositions/${index}/evidence_ref`); if (evidence.branch === 'rejected') return evidence
    if (typeof item.value.finding_id !== 'string' || !DECISION_FINDING_IDS.includes(item.value.finding_id) || typeof item.value.state !== 'string' || !DECISION_STATES.includes(item.value.state)) return reject('invalid_enum', `${path}/finding_dispositions/${index}`, 'invalid finding disposition')
    if (stableJson(evidence.value) !== stableJson(ref.value)) return reject('cross_reference_mismatch', `${path}/finding_dispositions/${index}/evidence_ref`, 'finding evidence must bind the Decision record')
    findingIds.push(item.value.finding_id)
    if (item.value.state !== 'closed') nonclosedCount += 1
  }
  const duplicateIndex = findingIds.findIndex((findingId, index) => findingIds.indexOf(findingId) !== index)
  if (duplicateIndex >= 0) return reject('duplicate_identity', `${path}/finding_dispositions/${duplicateIndex}/finding_id`, 'duplicate finding disposition')
  if (stableJson(findingIds) !== stableJson(DECISION_FINDING_IDS)) return reject('semantic_coverage_mismatch', `${path}/finding_dispositions`, 'finding dispositions must be complete and ordered')
  if (admitted.value.schema_version !== 'ArchitectureRepairReviewDecisionBindingV8' ||
      admitted.value.task_id !== 'DESIGN-ARCHITECTURE-REPAIR-LOOP-CONTRACT-001' ||
      admitted.value.authoring_role !== 'Architect Team Independent Reviewer') {
    return reject('invalid_enum', path, 'invalid Decision binding')
  }
  if (!['APPROVE','CHANGES_REQUIRED','BLOCKED'].includes(String(admitted.value.decision))) {
    return reject('invalid_enum', `${path}/decision`, 'invalid Decision')
  }
  if (!Number.isSafeInteger(admitted.value.blocking_finding_count)) {
    return reject('invalid_enum', `${path}/blocking_finding_count`, 'invalid blocking finding count')
  }
  if (relationPolicy === 'enforce' && admitted.value.blocking_finding_count !== nonclosedCount) {
    return reject('cross_reference_mismatch', `${path}/blocking_finding_count`, 'blocking finding count must equal non-closed finding count')
  }
  if (relationPolicy === 'enforce' &&
      ((admitted.value.decision === 'APPROVE' && nonclosedCount !== 0) ||
       (admitted.value.decision === 'CHANGES_REQUIRED' && nonclosedCount === 0))) {
    return reject('cross_reference_mismatch', `${path}/decision`, 'Decision must match non-closed finding count')
  }
  if (typeof admitted.value.contract_gap_closed !== 'boolean' ||
      typeof admitted.value.architecture_review_closed !== 'boolean' ||
      typeof admitted.value.implementation_resume_allowed !== 'boolean' ||
      typeof admitted.value.source_issue_209_resume_allowed !== 'boolean' ||
      !['completed','completed_with_warnings','needs_followup','blocked'].includes(String(admitted.value.status))) {
    return reject('invalid_enum', path, 'invalid Decision binding')
  }
  if (!['completed','architecture_gap','external_blocker'].includes(String(admitted.value.execution_stop_reason))) {
    return reject('invalid_enum', `${path}/execution_stop_reason`, 'invalid execution stop reason')
  }
  if (typeof admitted.value.projection_digest !== 'string' ||
      !/^[0-9a-f]{64}$/.test(admitted.value.projection_digest)) return reject('invalid_enum', path, 'invalid Decision binding')
  const projection = { ...admitted.value }; delete projection.projection_digest
  if (sha256Pure(stableJson(projection)) !== admitted.value.projection_digest) return reject('digest_mismatch', `${path}/projection_digest`, 'Decision binding digest mismatch')
  return admitted
}
const admitMaterializationNested = (root: Obj): AdmissionResultV2<true> => {
  if (!Array.isArray(root.canonical_body_requests) || root.canonical_body_requests.length !== 6) return reject('conditional_field_mismatch', '/input/canonical_body_requests', 'exactly six canonical requests required')
  const canonicalIds: string[] = []
  for (const [index, request] of root.canonical_body_requests.entries()) {
    const item = exact(request, ['expected_authoring_role','expected_record_type','source_record'], `/input/canonical_body_requests/${index}`); if (item.branch === 'rejected') return item
    const ref = recordRef(item.value.source_record, `/input/canonical_body_requests/${index}/source_record`); if (ref.branch === 'rejected') return ref
    if (typeof item.value.expected_authoring_role !== 'string' || typeof item.value.expected_record_type !== 'string' || item.value.expected_record_type !== ref.value.record_type) return reject('cross_reference_mismatch', `/input/canonical_body_requests/${index}`, 'canonical request binding mismatch')
    canonicalIds.push(ref.value.canonical_record as string)
  }
  if (new Set(canonicalIds).size !== canonicalIds.length) return reject('duplicate_identity', '/input/canonical_body_requests', 'duplicate canonical identity')
  if (stableJson(canonicalIds) !== stableJson([...canonicalIds].sort(compareUtf8))) return reject('semantic_coverage_mismatch', '/input/canonical_body_requests', 'canonical requests out of order')
  const repository = exact(root.repository_state_request, ['repository','full_commit_sha','path_bindings'], '/input/repository_state_request'); if (repository.branch === 'rejected') return repository
  if (repository.value.repository !== 'whatrune/sd-prompt-studio' || typeof repository.value.full_commit_sha !== 'string' || !/^[0-9a-f]{40}$/.test(repository.value.full_commit_sha) || !Array.isArray(repository.value.path_bindings) || repository.value.path_bindings.length !== 3) return reject('invalid_enum', '/input/repository_state_request', 'invalid repository request')
  const paths: string[] = []
  for (const [index, binding] of repository.value.path_bindings.entries()) { const item = exact(binding, ['path','full_commit_sha','blob_sha'], `/input/repository_state_request/path_bindings/${index}`); if (item.branch === 'rejected') return item; if (typeof item.value.path !== 'string' || item.value.full_commit_sha !== repository.value.full_commit_sha || typeof item.value.blob_sha !== 'string' || !/^[0-9a-f]{40}$/.test(item.value.blob_sha)) return reject('cross_reference_mismatch', `/input/repository_state_request/path_bindings/${index}`, 'invalid path binding'); paths.push(item.value.path) }
  if (new Set(paths).size !== 3 || stableJson(paths) !== stableJson([...paths].sort(compareUtf8))) return reject('semantic_coverage_mismatch', '/input/repository_state_request/path_bindings', 'path bindings out of order')
  if (!Array.isArray(root.issue_state_requests)) return reject('invalid_type', '/input/issue_state_requests', 'issue request array required')
  const issueIds: string[] = []
  for (const [index, issue] of root.issue_state_requests.entries()) { const item = exact(issue, ['issue_url','state','latest_top_level_comment_ref'], `/input/issue_state_requests/${index}`); if (item.branch === 'rejected') return item; const ref = recordRef(item.value.latest_top_level_comment_ref, `/input/issue_state_requests/${index}/latest_top_level_comment_ref`); if (ref.branch === 'rejected') return ref; if (!/^https:\/\/github\.com\/whatrune\/sd-prompt-studio\/issues\/(209|210)$/.test(String(item.value.issue_url)) || item.value.state !== 'open' || !(ref.value.canonical_record as string).startsWith(`${item.value.issue_url}#`)) return reject('cross_reference_mismatch', `/input/issue_state_requests/${index}`, 'invalid issue binding'); issueIds.push(item.value.issue_url as string) }
  const duplicateIndex = issueIds.findIndex((identity, index) => issueIds.indexOf(identity) !== index)
  if (duplicateIndex >= 0) return reject('duplicate_identity', `/materialization_input/issue_state_requests/${duplicateIndex}/issue_url`, 'duplicate issue identity')
  if (issueIds.length !== 2) return reject('conditional_field_mismatch', '/input/issue_state_requests', 'exactly two issue requests required')
  if (stableJson(issueIds) !== stableJson([...issueIds].sort(compareUtf8))) return reject('semantic_coverage_mismatch', '/input/issue_state_requests', 'issue requests out of order')
  const decision = decisionBinding(root.decision_binding, '/input/decision_binding'); if (decision.branch === 'rejected') return decision
  return Object.freeze({ branch: 'accepted' as const, value: true as const })
}
const deriveDecisionBinding = (body: string, request: Obj): Obj | null => {
  if (!isObject(request.source_record)) return null
  const match = /^# [^\n]+\n\n```yaml\n([\s\S]*?)\n```/.exec(body); if (!match) return null
  const scalars: Obj = {}; const dispositions: Obj = {}; const seenTopLevel = new Set<string>(); let inDisposition = false
  for (const line of match[1].split('\n')) {
    if (/^[^ \t][^:]*:/.test(line)) {
      const index = line.indexOf(':'); const key = line.slice(0,index)
      if (seenTopLevel.has(key)) return null
      seenTopLevel.add(key)
      inDisposition = key === 'finding_disposition'
      if (!inDisposition) scalars[key] = line.slice(index + 1).trim()
      continue
    }
    if (inDisposition && line.startsWith('  ')) {
      const found = /^  ([^:]+): (closed|open|reopened_with_new_finding)$/.exec(line)
      if (!found || Object.prototype.hasOwnProperty.call(dispositions, found[1])) return null
      dispositions[found[1]] = found[2]
    }
  }
  const boolean = (key: string) => scalars[key] === 'true' ? true : scalars[key] === 'false' ? false : null
  const booleans = ['contract_gap_closed','architecture_review_closed','implementation_resume_allowed','source_issue_209_resume_allowed']
  const findingIds = Object.keys(dispositions).sort(compareUtf8)
  if (!/^(0|[1-9][0-9]*)$/.test(String(scalars.blocking_finding_count)) ||
      findingIds.length !== DECISION_FINDING_IDS.length ||
      stableJson(findingIds) !== stableJson(DECISION_FINDING_IDS) ||
      booleans.some((key) => boolean(key) === null)) return null
  const decisionRef = structuredClone(request.source_record)
  const binding: Obj = { schema_version:'ArchitectureRepairReviewDecisionBindingV8', decision_record:decisionRef, task_id:scalars.task_id, authoring_role:scalars.authoring_role, decision:scalars.decision, blocking_finding_count:Number(scalars.blocking_finding_count), finding_dispositions:findingIds.map((finding_id)=>({finding_id,state:dispositions[finding_id],evidence_ref:structuredClone(decisionRef)})), contract_gap_closed:boolean('contract_gap_closed'), architecture_review_closed:boolean('architecture_review_closed'), implementation_resume_allowed:boolean('implementation_resume_allowed'), source_issue_209_resume_allowed:boolean('source_issue_209_resume_allowed'), status:scalars.status, execution_stop_reason:scalars.execution_stop_reason }
  binding.projection_digest = sha256Pure(stableJson(binding))
  return decisionBinding(binding, '/derivedDecision').branch === 'accepted' ? binding : null
}
const admitObservationNested = (observation: Obj): AdmissionResultV2<true> => {
  const decision = decisionBinding(observation.decision_binding, '/observation/decision_binding'); if (decision.branch === 'rejected') return decision
  const snapshot = exact(observation.authority_snapshot, ['canonical_record_refs','issue_states','main_full_head_sha','path_bindings','snapshot_digest'], '/observation/authority_snapshot'); if (snapshot.branch === 'rejected') return snapshot
  if (!Array.isArray(snapshot.value.canonical_record_refs) || !Array.isArray(snapshot.value.issue_states) || !Array.isArray(snapshot.value.path_bindings) || typeof snapshot.value.snapshot_digest !== 'string') return reject('invalid_type', '/observation/authority_snapshot', 'invalid authority snapshot')
  for (const [index, ref] of snapshot.value.canonical_record_refs.entries()) { const admitted = recordRef(ref, `/observation/authority_snapshot/canonical_record_refs/${index}`); if (admitted.branch === 'rejected') return admitted }
  const projection = exact(observation.projection, ['schema_version','decision_record','decision','blocking_finding_count','open_finding_ids','closed_finding_ids','reopened_finding_ids','authority_current','next_role','next_action','stop_reason','implementation_resume_allowed','source_issue_209_resume_allowed','projection_digest'], '/observation/projection'); if (projection.branch === 'rejected') return projection
  return Object.freeze({ branch: 'accepted' as const, value: true as const })
}
const deriveObservationValues = (state: Readonly<{ input: Obj }>): Readonly<{ snapshot: Obj; projection: Obj }> | null => {
  if (!Array.isArray(state.input.canonical_body_requests) || !isObject(state.input.repository_state_request) || !Array.isArray(state.input.issue_state_requests) || !isObject(state.input.decision_binding)) return null
  const canonicalRefs = state.input.canonical_body_requests.map((request) => isObject(request) ? structuredClone(request.source_record) : null)
  if (canonicalRefs.some((value) => !isObject(value))) return null
  const repository = state.input.repository_state_request
  const snapshot: Obj = { canonical_record_refs: canonicalRefs, issue_states: structuredClone(state.input.issue_state_requests), main_full_head_sha: repository.full_commit_sha, path_bindings: structuredClone(repository.path_bindings) }
  snapshot.snapshot_digest = sha256Pure(stableJson(snapshot))
  const decision = state.input.decision_binding
  if (!Array.isArray(decision.finding_dispositions) || !isObject(decision.decision_record)) return null
  const dispositions = decision.finding_dispositions.filter(isObject)
  const ids = (stateValue: string) => dispositions.filter((item) => item.state === stateValue).map((item) => item.finding_id as string).sort(compareUtf8)
  const projection: Obj = {
    schema_version: 'RepairLoopProjectionV8',
    decision_record: structuredClone(decision.decision_record),
    decision: decision.decision,
    blocking_finding_count: decision.blocking_finding_count,
    open_finding_ids: ids('open'),
    closed_finding_ids: ids('closed'),
    reopened_finding_ids: ids('reopened_with_new_finding'),
    authority_current: true,
    next_role: decision.decision === 'CHANGES_REQUIRED' ? 'Fresh Architect Team' : 'Integrated Lead',
    next_action: decision.decision === 'CHANGES_REQUIRED' ? 'create_cumulative_architecture_baseline' : 'none',
    stop_reason: Number(decision.blocking_finding_count) > 0 ? 'architecture_gap' : 'completed',
    implementation_resume_allowed: decision.implementation_resume_allowed,
    source_issue_209_resume_allowed: decision.source_issue_209_resume_allowed,
  }
  projection.projection_digest = sha256Pure(stableJson(projection))
  return { snapshot, projection }
}
const admitPortResponse = (value: unknown, path: string): AdmissionResultV2<ArchitectureRepairMaterializationPortResponseV8> => {
  const admitted = exact(value, ['request_kind','request_identity','observed_at','status','body_utf8','body_utf8_length','body_sha256'], path)
  if (admitted.branch === 'rejected') return admitted
  if (!['canonical_body','repository_state','issue_state'].includes(String(admitted.value.request_kind)) || typeof admitted.value.request_identity !== 'string' || typeof admitted.value.observed_at !== 'string' || admitted.value.status !== 'found' || typeof admitted.value.body_utf8 !== 'string' || !Number.isSafeInteger(admitted.value.body_utf8_length) || typeof admitted.value.body_sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(admitted.value.body_sha256)) return reject('invalid_type', path, 'invalid port response')
  return Object.freeze({ branch: 'accepted' as const, value: admitted.value as ArchitectureRepairMaterializationPortResponseV8 })
}
const stableJson = (value: unknown): string => value === null || typeof value !== 'object' ? JSON.stringify(value) : Array.isArray(value) ? `[${value.map(stableJson).join(',')}]` : `{${Object.keys(value as Obj).sort().map((key) => `${JSON.stringify(key)}:${stableJson((value as Obj)[key])}`).join(',')}}`
const sha256Pure = (text: string): string => {
  const bytes = new TextEncoder().encode(text)
  const paddedLength = (((bytes.length + 9 + 63) >> 6) << 6)
  const data = new Uint8Array(paddedLength); data.set(bytes); data[bytes.length] = 0x80
  const view = new DataView(data.buffer); const bitLength = bytes.length * 8
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000)); view.setUint32(paddedLength - 4, bitLength >>> 0)
  const constants = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]
  const state = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]; const words = new Uint32Array(64)
  const rotate = (value: number, bits: number) => (value >>> bits) | (value << (32 - bits))
  for (let offset = 0; offset < data.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) words[index] = view.getUint32(offset + index * 4)
    for (let index = 16; index < 64; index += 1) { const a = words[index - 15]; const b = words[index - 2]; words[index] = (words[index - 16] + (rotate(a,7)^rotate(a,18)^(a>>>3)) + words[index - 7] + (rotate(b,17)^rotate(b,19)^(b>>>10))) >>> 0 }
    let [a,b,c,d,e,f,g,h] = state
    for (let index = 0; index < 64; index += 1) { const first=(h+(rotate(e,6)^rotate(e,11)^rotate(e,25))+((e&f)^(~e&g))+constants[index]+words[index])>>>0; const second=((rotate(a,2)^rotate(a,13)^rotate(a,22))+((a&b)^(a&c)^(b&c)))>>>0; h=g;g=f;f=e;e=(d+first)>>>0;d=c;c=b;b=a;a=(first+second)>>>0 }
    state[0]=(state[0]+a)>>>0;state[1]=(state[1]+b)>>>0;state[2]=(state[2]+c)>>>0;state[3]=(state[3]+d)>>>0;state[4]=(state[4]+e)>>>0;state[5]=(state[5]+f)>>>0;state[6]=(state[6]+g)>>>0;state[7]=(state[7]+h)>>>0
  }
  return state.map((word) => word.toString(16).padStart(8, '0')).join('')
}
const locator = (value: unknown): AdmissionResultV2<{ issue: string; comment: string; canonical: string }> => {
  if (typeof value !== 'string') return reject('invalid_type', '/fixture/port_entries/source_locator', 'locator must be string')
  const match = /^https:\/\/github\.com\/whatrune\/sd-prompt-studio\/issues\/(209|210)#issuecomment-([1-9][0-9]*)$/.exec(value)
  return match ? Object.freeze({ branch: 'accepted' as const, value: { issue: match[1], comment: match[2], canonical: value } }) : reject('invalid_format', '/fixture/port_entries/source_locator', 'unsupported canonical comment locator')
}
const portEntries = (fixture: unknown): AdmissionResultV2<readonly Obj[]> => {
  const root = exact(fixture, ['schema_version', 'component_id', 'observation', 'production_input', 'materialization_input', 'port_entries', 'proof_projection', 'expected_materialization', 'expected_validation', 'component_digest'], '/fixture')
  if (root.branch === 'rejected') return root
  if (!Array.isArray(root.value.port_entries)) return reject('invalid_type', '/fixture/port_entries', 'array required')
  const entries = root.value.port_entries
  if (entries.length !== 9) return reject('conditional_field_mismatch', '/fixture/port_entries', 'exactly nine fixture port entries required')
  const identities = new Set<string>()
  for (const [index, value] of entries.entries()) {
    if (!isObject(value)) return reject('invalid_type', `/fixture/port_entries/${index}`, 'entry object required')
    const literal = value.source_mode === 'literal_jcs_capture'
    const admitted = exact(value, literal ? ['request_kind', 'request_identity', 'source_mode', 'source_locator', 'captured_value', 'body_utf8_length', 'body_sha256', 'observed_at'] : ['request_kind', 'request_identity', 'source_mode', 'source_locator', 'body_utf8_length', 'body_sha256', 'observed_at'], `/fixture/port_entries/${index}`)
    if (admitted.branch === 'rejected') return admitted
    if (!['canonical_body', 'repository_state', 'issue_state'].includes(String(value.request_kind)) || typeof value.request_identity !== 'string' || identities.has(value.request_identity) || !Number.isSafeInteger(value.body_utf8_length) || Number(value.body_utf8_length) < 0 || typeof value.body_sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(value.body_sha256) || typeof value.observed_at !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(value.observed_at)) return reject(identities.has(String(value.request_identity)) ? 'duplicate_identity' : 'invalid_enum', `/fixture/port_entries/${index}`, 'invalid fixture port entry')
    identities.add(value.request_identity)
    if (value.request_kind === 'canonical_body') {
      if (value.source_mode !== 'github_exact_comment_body') return reject('conditional_field_mismatch', `/fixture/port_entries/${index}/source_mode`, 'canonical body requires GitHub exact body mode')
      const parsed = locator(value.source_locator); if (parsed.branch === 'rejected') return parsed
      if (parsed.value.canonical !== value.request_identity) return reject('cross_reference_mismatch', `/fixture/port_entries/${index}/request_identity`, 'locator identity mismatch')
    } else {
      if (!literal || value.source_locator !== '') return reject('conditional_field_mismatch', `/fixture/port_entries/${index}/source_mode`, 'state entry requires literal JCS capture')
      const body = stableJson(value.captured_value)
      if (new TextEncoder().encode(body).length !== value.body_utf8_length || sha256Pure(body) !== value.body_sha256) return reject('digest_mismatch', `/fixture/port_entries/${index}/body_sha256`, 'literal capture digest mismatch')
    }
  }
  const counts = {
    canonical_body: entries.filter((entry) => isObject(entry) && entry.request_kind === 'canonical_body').length,
    repository_state: entries.filter((entry) => isObject(entry) && entry.request_kind === 'repository_state').length,
    issue_state: entries.filter((entry) => isObject(entry) && entry.request_kind === 'issue_state').length,
  }
  if (counts.canonical_body !== 6 || counts.repository_state !== 1 || counts.issue_state !== 2) return reject('conditional_field_mismatch', '/fixture/port_entries', 'fixture requires six canonical, one repository, and two issue entries')
  if (!isObject(root.value.materialization_input)) return reject('invalid_type', '/fixture/materialization_input', 'materialization input required')
  const materialization = root.value.materialization_input
  if (!Array.isArray(materialization.canonical_body_requests) || materialization.canonical_body_requests.length !== 6 ||
      !isObject(materialization.repository_state_request) || !Array.isArray(materialization.issue_state_requests) ||
      materialization.issue_state_requests.length !== 2 || typeof materialization.observed_at !== 'string') return reject('cross_reference_mismatch', '/fixture/port_entries', 'fixture requests unavailable')
  for (const [index, request] of materialization.canonical_body_requests.entries()) {
    const entry = entries[index]
    if (!isObject(entry) || !isObject(request) || !isObject(request.source_record) ||
        entry.request_kind !== 'canonical_body' ||
        entry.request_identity !== request.source_record.canonical_record ||
        entry.source_locator !== request.source_record.canonical_record ||
        entry.body_utf8_length !== request.source_record.body_utf8_length ||
        entry.body_sha256 !== request.source_record.body_sha256 ||
        entry.observed_at !== materialization.observed_at) return reject('cross_reference_mismatch', `/fixture/port_entries/${index}`, 'canonical entry request binding mismatch')
  }
  const repositoryEntry = entries[6]
  const repositoryRequest = materialization.repository_state_request
  const repositoryIdentity = `${repositoryRequest.repository}@${repositoryRequest.full_commit_sha}`
  if (!isObject(repositoryEntry) || repositoryEntry.request_kind !== 'repository_state' ||
      repositoryEntry.request_identity !== repositoryIdentity ||
      repositoryEntry.observed_at !== materialization.observed_at ||
      stableJson(repositoryEntry.captured_value) !== stableJson(repositoryRequest)) return reject('cross_reference_mismatch', '/fixture/port_entries/6', 'repository entry request binding mismatch')
  for (const [offset, request] of materialization.issue_state_requests.entries()) {
    const index = offset + 7
    const entry = entries[index]
    if (!isObject(entry) || !isObject(request) || entry.request_kind !== 'issue_state' ||
        entry.request_identity !== request.issue_url ||
        entry.observed_at !== materialization.observed_at ||
        stableJson(entry.captured_value) !== stableJson(request)) return reject('cross_reference_mismatch', `/fixture/port_entries/${index}`, 'issue entry request binding mismatch')
  }
  return Object.freeze({ branch: 'accepted' as const, value: Object.freeze(entries.map((entry) => deepFreeze(structuredClone(entry)) as Obj)) })
}

/** CAA016: creation is synchronous and performs zero I/O; only this returned port fetches bodies. */
export function createArchitectureRepairAuthorityFixturePortsV8(fixture: unknown): AdmissionResultV2<ArchitectureRepairAuthorityMaterializationPortsV8> {
  const admitted = portEntries(fixture)
  if (admitted.branch === 'rejected') return admitted
  const byIdentity = new Map(admitted.value.map((entry) => [entry.request_identity as string, entry]))
  const readCanonicalBody = async (request: unknown, observedAt: string): Promise<ArchitectureRepairMaterializationPortResponseV8> => {
    const requestObject = exact(request, ['source_record', 'expected_authoring_role', 'expected_record_type'], '/request')
    if (requestObject.branch === 'rejected' || !isObject(requestObject.value.source_record) || typeof requestObject.value.source_record.canonical_record !== 'string') throw new Error('canonical request rejected')
    const identity = requestObject.value.source_record.canonical_record
    const entry = byIdentity.get(identity)
    if (!entry) throw new Error('canonical request not in fixture')
    const parsed = locator(entry.source_locator); if (parsed.branch === 'rejected') throw new Error('invalid locator')
    const response = await globalThis.fetch(`https://api.github.com/repos/whatrune/sd-prompt-studio/issues/comments/${parsed.value.comment}`, { method: 'GET', redirect: 'error', cache: 'no-store', credentials: 'omit', headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } })
    if (response.status !== 200) throw new Error('canonical body unavailable')
    const payload: unknown = await response.json()
    if (!isObject(payload) || !Number.isSafeInteger(payload.id) || String(payload.id) !== parsed.value.comment || payload.html_url !== identity || typeof payload.body !== 'string' || /[\uD800-\uDFFF]/u.test(payload.body)) throw new Error('canonical body response invalid')
    const body = payload.body
    const length = new TextEncoder().encode(body).length
    const digest = await sha256(body)
    return Object.freeze({ request_kind: 'canonical_body', request_identity: identity, observed_at: observedAt, status: 'found', body_utf8: body, body_utf8_length: length, body_sha256: digest })
  }
  const readLiteral = async (kind: 'repository_state' | 'issue_state', request: unknown, observedAt: string): Promise<ArchitectureRepairMaterializationPortResponseV8> => {
    if (!isObject(request)) throw new Error('literal request rejected')
    const identity = kind === 'repository_state' ? `${request.repository}@${request.full_commit_sha}` : request.issue_url
    if (typeof identity !== 'string') throw new Error('literal request identity rejected')
    const entry = byIdentity.get(identity)
    if (!entry || entry.request_kind !== kind || entry.source_mode !== 'literal_jcs_capture') throw new Error('literal request not in fixture')
    const body = stableJson(entry.captured_value)
    return Object.freeze({ request_kind: kind, request_identity: identity, observed_at: observedAt, status: 'found', body_utf8: body, body_utf8_length: new TextEncoder().encode(body).length, body_sha256: sha256Pure(body) })
  }
  const readRepositoryState = async function (request: unknown, observedAt: string) { return readLiteral('repository_state', request, observedAt) }
  const readIssueState = async function (request: unknown, observedAt: string) { return readLiteral('issue_state', request, observedAt) }
  return Object.freeze({ branch: 'accepted' as const, value: Object.freeze({ readCanonicalBody, readRepositoryState, readIssueState }) })
}

export async function materializeArchitectureRepairAuthorityProofV8(input: unknown, ports: ArchitectureRepairAuthorityMaterializationPortsV8): Promise<ArchitectureRepairMaterializationResultV8> {
  const root = exact(input, ['schema_version', 'mode', 'task_id', 'observed_at', 'canonical_body_requests', 'repository_state_request', 'issue_state_requests', 'decision_binding', 'input_digest'], '/input')
  if (root.branch === 'rejected') return Object.freeze({ branch: 'rejected' as const, rejection: root.rejection })
  if (root.value.schema_version !== 'ArchitectureRepairMaterializationInputV8' || !['captured_replay', 'live_current'].includes(String(root.value.mode)) || root.value.task_id !== 'DESIGN-ARCHITECTURE-REPAIR-LOOP-CONTRACT-001' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(String(root.value.observed_at)) || !Array.isArray(root.value.canonical_body_requests) || typeof root.value.observed_at !== 'string') return Object.freeze({ branch: 'rejected' as const, rejection: Object.freeze({ code: 'invalid_enum', path: '/input', message: 'invalid materialization input' }) })
  const nested = admitMaterializationNested(root.value)
  if (nested.branch === 'rejected') return Object.freeze({ branch: 'rejected' as const, rejection: nested.rejection })
  if (!isObject(ports) || Object.keys(ports).sort().join(',') !== 'readCanonicalBody,readIssueState,readRepositoryState' || typeof ports.readCanonicalBody !== 'function' || typeof ports.readRepositoryState !== 'function' || typeof ports.readIssueState !== 'function' || ports.readCanonicalBody.length !== 2 || ports.readRepositoryState.length !== 2 || ports.readIssueState.length !== 2) return Object.freeze({ branch: 'rejected' as const, rejection: Object.freeze({ code: 'invalid_type', path: '/ports', message: 'closed two-argument port surface required' }) })
  const canonical = root.value.canonical_body_requests as unknown[]
  const issues = root.value.issue_state_requests
  if (!isObject(root.value.repository_state_request) || !Array.isArray(issues)) return Object.freeze({ branch: 'rejected' as const, rejection: Object.freeze({ code: 'invalid_type', path: '/input', message: 'invalid repository or issue requests' }) })
  const issueIdentities = issues.map((issue) => isObject(issue) ? issue.issue_url : undefined)
  const duplicateIssue = issueIdentities.findIndex((identity, index) => issueIdentities.indexOf(identity) !== index)
  if (duplicateIssue >= 0) return Object.freeze({ branch: 'rejected' as const, rejection: Object.freeze({ code: 'duplicate_identity', path: `/materialization_input/issue_state_requests/${duplicateIssue}/issue_url`, message: 'duplicate issue request identity' }) })
  if (issues.length !== 2) return Object.freeze({ branch: 'rejected' as const, rejection: Object.freeze({ code: 'conditional_field_mismatch', path: '/input/issue_state_requests', message: 'exactly two issue requests required' }) })
  const inputProjection = { ...root.value }; delete inputProjection.input_digest
  if (sha256Pure(stableJson(inputProjection)) !== root.value.input_digest) return Object.freeze({ branch: 'rejected' as const, rejection: Object.freeze({ code: 'digest_mismatch', path: '/input/input_digest', message: 'materialization input digest mismatch' }) })
  let activePortPath = '/ports'
  try {
    const bodies: ArchitectureRepairMaterializationPortResponseV8[] = []
    for (const [index, request] of canonical.entries()) {
      if (!isObject(request) || !isObject(request.source_record) || typeof request.source_record.canonical_record !== 'string' || typeof request.source_record.body_sha256 !== 'string' || typeof request.source_record.body_utf8_length !== 'number') return Object.freeze({ branch: 'rejected' as const, rejection: Object.freeze({ code: 'invalid_type', path: '/input/canonical_body_requests', message: 'invalid canonical request' }) })
      activePortPath = `/ports/readCanonicalBody/${index + 1}`
      let body: ArchitectureRepairMaterializationPortResponseV8
      try { body = await ports.readCanonicalBody(request, root.value.observed_at) } catch { return materializationFailure('external_blocker', 'M3', activePortPath) }
      const bodyAdmission = admitPortResponse(body, activePortPath); if (bodyAdmission.branch === 'rejected') return Object.freeze({ branch: 'rejected' as const, rejection: bodyAdmission.rejection }); body = bodyAdmission.value
      const header = metadata(body.body_utf8)
      if (body.request_kind !== 'canonical_body' || body.request_identity !== request.source_record.canonical_record || body.observed_at !== root.value.observed_at || body.status !== 'found' || new TextEncoder().encode(body.body_utf8).length !== body.body_utf8_length || await sha256(body.body_utf8) !== body.body_sha256 || body.body_sha256 !== request.source_record.body_sha256 || body.body_utf8_length !== request.source_record.body_utf8_length) return Object.freeze({ branch: 'rejected' as const, rejection: Object.freeze({ code: 'digest_mismatch', path: `/ports/readCanonicalBody/${index}/body_sha256`, message: 'canonical body binding mismatch' }) })
      if (!header || header.task_id !== request.source_record.task_id || header.record_type !== request.expected_record_type || header.record_type !== request.source_record.record_type || header.authoring_role !== request.expected_authoring_role) return Object.freeze({ branch: 'rejected' as const, rejection: Object.freeze({ code: 'cross_reference_mismatch', path: `/ports/readCanonicalBody/${index}`, message: 'canonical body role/type/task mismatch' }) })
      bodies.push(body)
    }
    const decisionIndex = canonical.findIndex((request) => isObject(request) && request.expected_record_type === 'independent_architecture_review_decision')
    const derivedDecision = decisionIndex >= 0 && isObject(canonical[decisionIndex]) ? deriveDecisionBinding(bodies[decisionIndex].body_utf8, canonical[decisionIndex]) : null
    if (!derivedDecision || stableJson(derivedDecision) !== stableJson(root.value.decision_binding)) return Object.freeze({ branch: 'rejected' as const, rejection: Object.freeze({ code: 'cross_reference_mismatch', path: '/decision_binding', message: 'Decision body binding mismatch' }) })
    const repository = root.value.repository_state_request
    const repositoryIdentity = `${repository.repository}@${repository.full_commit_sha}`
    activePortPath = '/ports/readRepositoryState/1'
    let repositoryResponse: ArchitectureRepairMaterializationPortResponseV8
    try { repositoryResponse = await ports.readRepositoryState(repository, root.value.observed_at) } catch { return materializationFailure('external_blocker', 'M5', activePortPath) }
    const repositoryAdmission = admitPortResponse(repositoryResponse, activePortPath); if (repositoryAdmission.branch === 'rejected') return Object.freeze({ branch: 'rejected' as const, rejection: repositoryAdmission.rejection }); repositoryResponse = repositoryAdmission.value
    if (repositoryResponse.request_kind !== 'repository_state' || repositoryResponse.request_identity !== repositoryIdentity || repositoryResponse.observed_at !== root.value.observed_at || repositoryResponse.status !== 'found' || new TextEncoder().encode(repositoryResponse.body_utf8).length !== repositoryResponse.body_utf8_length || await sha256(repositoryResponse.body_utf8) !== repositoryResponse.body_sha256 || stableJson(JSON.parse(repositoryResponse.body_utf8)) !== stableJson(repository)) return Object.freeze({ branch: 'rejected' as const, rejection: Object.freeze({ code: 'cross_reference_mismatch', path: '/ports/readRepositoryState/1/path_bindings/0/blob_sha', message: 'repository response mismatch' }) })
    const issueResponses: ArchitectureRepairMaterializationPortResponseV8[] = []
    for (const [index, issue] of issues.entries()) { if (!isObject(issue) || typeof issue.issue_url !== 'string') return Object.freeze({ branch: 'rejected' as const, rejection: Object.freeze({ code: 'invalid_type', path: '/input/issue_state_requests', message: 'invalid issue request' }) }); activePortPath = `/ports/readIssueState/${index + 1}`; let state: ArchitectureRepairMaterializationPortResponseV8; try { state = await ports.readIssueState(issue, root.value.observed_at) } catch { return materializationFailure('external_blocker', 'M6', activePortPath) }; const stateAdmission = admitPortResponse(state, activePortPath); if (stateAdmission.branch === 'rejected') return Object.freeze({ branch: 'rejected' as const, rejection: stateAdmission.rejection }); state = stateAdmission.value; if (state.request_kind !== 'issue_state' || state.request_identity !== issue.issue_url || state.observed_at !== root.value.observed_at || state.status !== 'found' || new TextEncoder().encode(state.body_utf8).length !== state.body_utf8_length || await sha256(state.body_utf8) !== state.body_sha256 || stableJson(JSON.parse(state.body_utf8)) !== stableJson(issue)) return Object.freeze({ branch: 'rejected' as const, rejection: Object.freeze({ code: 'freshness_mismatch', path: `/ports/readIssueState/${index + 1}/latest_top_level_comment_ref`, message: 'issue state mismatch' }) }); issueResponses.push(state) }
    const projection: Obj = { schema_version: 'ArchitectureRepairAuthorityProofProjectionV8', mode: root.value.mode, task_id: root.value.task_id, materialization_input_digest: root.value.input_digest, canonical_body_digests: bodies.map((body) => body.body_sha256), repository_state_digest: repositoryResponse.body_sha256, issue_state_digest: await sha256(stableJson(issueResponses.map((state) => JSON.parse(state.body_utf8)))), decision_binding_digest: derivedDecision.projection_digest, producer: 'ArchitectureRepairAuthorityMaterializerV8', observed_at: root.value.observed_at }
    projection.proof_digest = await sha256(stableJson(projection))
    const token = deepFreeze({ schema_version: 'ArchitectureRepairAuthorityProofTokenV8', token_id: (++nextTokenId).toString(16).padStart(32, '0'), proof_projection: deepFreeze(projection) })
    tokens.set(token, deepFreeze({ input: structuredClone(root.value), canonicalBodies: bodies.map((body) => deepFreeze(structuredClone(body))), repository: deepFreeze(structuredClone(repositoryResponse)), issues: issueResponses.map((state) => deepFreeze(structuredClone(state))), proof: deepFreeze(structuredClone(projection)) }))
    return Object.freeze({ branch: 'produced' as const, proof_token: token })
  } catch { return Object.freeze({ branch: 'failed' as const, failure: Object.freeze({ schema_version: 'ArchitectureRepairMaterializationFailureV8' as const, code: 'internal_failure' as const, stage: 'M8', path: activePortPath, safe_message: 'internal failure' as const, retryable: false as const }) }) }
}

export function validateArchitectureRepairAuthorityObservationV8(observation: unknown, productionInput: unknown, proofToken: unknown): AdmissionResultV2<Obj> {
  const admitted = exact(observation, ['schema_version', 'task_id', 'producer', 'observed_at', 'production_input_binding', 'decision_binding', 'authority_snapshot', 'projection', 'proof_binding_digest', 'observation_digest'], '/observation')
  if (admitted.branch === 'rejected') return admitted
  if (admitted.value.schema_version !== 'ArchitectureRepairAuthorityObservationV8') return reject('unsupported_schema_version', '/observation/schema_version', 'unsupported observation schema')
  if (admitted.value.producer !== 'Integrated Lead') return reject('invalid_enum', '/observation/producer', 'invalid producer')
  const production = exact(productionInput, ['schema_version', 'task_id', 'operation_key', 'iteration_number', 'attempt_number', 'decision_binding', 'pre_read_authority_refs', 'input_digest'], '/productionInput')
  if (production.branch === 'rejected') return production
  if (production.value.schema_version !== 'ArchitectureRepairProductionInputV8' || production.value.task_id !== 'DESIGN-ARCHITECTURE-REPAIR-LOOP-CONTRACT-001' || typeof production.value.operation_key !== 'string' || production.value.operation_key.length === 0 || !Number.isSafeInteger(production.value.iteration_number) || Number(production.value.iteration_number) < 1 || !Number.isSafeInteger(production.value.attempt_number) || Number(production.value.attempt_number) < 1 || !Array.isArray(production.value.pre_read_authority_refs) || typeof production.value.input_digest !== 'string' || !/^[0-9a-f]{64}$/.test(production.value.input_digest)) return reject('invalid_enum', '/productionInput', 'invalid production input')
  const productionDecision = decisionBinding(production.value.decision_binding, '/productionInput/decision_binding', 'defer_to_proof_binding'); if (productionDecision.branch === 'rejected') return productionDecision
  for (const [index, ref] of production.value.pre_read_authority_refs.entries()) { const reference = recordRef(ref, `/productionInput/pre_read_authority_refs/${index}`); if (reference.branch === 'rejected') return reference }
  const productionProjection = { ...production.value }; delete productionProjection.input_digest
  if (sha256Pure(stableJson(productionProjection)) !== production.value.input_digest) return reject('digest_mismatch', '/productionInput/input_digest', 'production input digest mismatch')
  if (!isObject(proofToken) || !tokens.has(proofToken)) return reject('cross_reference_mismatch', '/proofToken', 'forged or reused proof token')
  const state = tokens.get(proofToken)!; tokens.delete(proofToken)
  const tokenBoundDecision = state.input.decision_binding
  if (!isObject(tokenBoundDecision)) return reject('cross_reference_mismatch', '/productionInput/decision_binding', 'token-bound decision unavailable')
  if (stableJson(productionDecision.value) !== stableJson(tokenBoundDecision)) {
    if (productionDecision.value.contract_gap_closed !== tokenBoundDecision.contract_gap_closed) return reject('cross_reference_mismatch', '/productionInput/decision_binding/contract_gap_closed', 'decision binding mismatch')
    if (productionDecision.value.status !== tokenBoundDecision.status) return reject('cross_reference_mismatch', '/productionInput/decision_binding/status', 'decision binding mismatch')
    return reject('cross_reference_mismatch', '/productionInput/decision_binding', 'decision binding mismatch')
  }
  const observationNested = admitObservationNested(admitted.value); if (observationNested.branch === 'rejected') return observationNested
  if (admitted.value.task_id !== state.input.task_id || admitted.value.observed_at !== state.input.observed_at || admitted.value.production_input_binding !== production.value.input_digest || admitted.value.proof_binding_digest !== state.proof.proof_digest || stableJson(admitted.value.decision_binding) !== stableJson(production.value.decision_binding) || !isObject(admitted.value.authority_snapshot) || !isObject(admitted.value.projection)) return reject('cross_reference_mismatch', '/observation', 'observation binding mismatch')
  const derived = deriveObservationValues(state)
  if (!derived) return reject('cross_reference_mismatch', '/observation', 'proof-derived observation unavailable')
  if (stableJson(admitted.value.authority_snapshot) !== stableJson(derived.snapshot)) return reject('cross_reference_mismatch', '/observation/authority_snapshot', 'authority snapshot mismatch')
  if (stableJson(admitted.value.projection) !== stableJson(derived.projection)) {
    if (isObject(admitted.value.projection) && admitted.value.projection.source_issue_209_resume_allowed !== derived.projection.source_issue_209_resume_allowed) return reject('cross_reference_mismatch', '/observation/projection/source_issue_209_resume_allowed', 'projection binding mismatch')
    return reject('cross_reference_mismatch', '/observation/projection', 'Repair Loop projection mismatch')
  }
  const observationProjection = { ...admitted.value }; delete observationProjection.observation_digest
  if (sha256Pure(stableJson(observationProjection)) !== admitted.value.observation_digest) return reject('digest_mismatch', '/observation/observation_digest', 'observation digest mismatch')
  return Object.freeze({ branch: 'accepted' as const, value: deepFreeze(structuredClone(admitted.value)) as Obj })
}
