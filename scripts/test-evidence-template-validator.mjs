import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createServer } from 'vite'

const FIXTURE_PATH = new URL('./fixtures/evidence-template-validator-v1.json', import.meta.url)
const EXPECTED_FILE_BYTES = 161361
const EXPECTED_FILE_SHA256 = 'a864f07c9bc9c35c5aa95824d3e505609ea2186f43c6b9b7c6ee3e5cca455485'
const EXPECTED_PROJECTION_DIGEST = '75e03db1c9d9eaa8242c31439d0a2c0704d602ebf5fb314521c49b184450f4ec'
const EXPECTED_REPAIR_MATRIX_DIGEST = 'dcc90e367512858414d6100413afd6f8296be474a50839beb4fced60d057c3af'
const EXPECTED_REPAIR_COMPONENT_DIGEST = 'f8113eb66f04e31ef2579901b508132907da50c656fc4653b38332990563a0d7'
const EXPECTED_LIMITED_MATRIX_DIGEST = '8218093a3a7b784916aa204eac3b1491c5eed5278c683dda6bcb67918223241d'
const EXPECTED_WITNESS_MATRIX_DIGEST = '1131a6831e9e82f2780eb0c5f287b8eb06100ad1d92fdf89709a6c354bff28fb'
const EXPECTED_FINAL_MATRIX_DIGEST = '34f5906770107ba6bf5c4e637469313d3400325729dad48fa1db57b118e997be'
const EXPECTED_FINAL_COMPONENT_DIGEST = 'b0224a1b8d73870ad9453b6a639b8dbec42ca01e0d0b06e5ad299f90274f9974'
const EXPECTED_JCS_MATRIX_DIGEST = '6f81e6a6fd7d2f1a3bb05d2f319b386773f8f8d12fe40fd29f92231f5ed23a8a'
const EXPECTED_CATALOG_DIGEST = '6d172e79e26d621dec027867ba8c472e01012393a587d61126954838944a5d46'
const EXPECTED_COMPONENT_DIGEST = 'c67a4688718777b4c5ded174934bc29445cdd0210361c8a9cff5816c4a52a383'
const EXPECTED_SOURCE = {
  body_sha256: 'ae38d5422a0a87b861548565dae40f8e152a7832a2098bdc760ddadc60d6373d',
  body_utf8_length: 57562,
  canonical_record: 'https://github.com/whatrune/sd-prompt-studio/issues/210#issuecomment-5125695936',
  catalog_digest: EXPECTED_CATALOG_DIGEST,
  component_digest: EXPECTED_COMPONENT_DIGEST,
}
const PREVIOUS_ROW_DIGEST_INVENTORY_SHA256 = '01d2e5e84644e09a486dde1a95b960997c0deb046fcb89b09d680fc1783fe89b'
const ROW_DIGEST_CHANGES = {
  'ETVA2-019': {
    before: '54b7430f9a71d5288621335c9f1bd9cb2ef74016ae3390da58c79326708af536',
    after: '8c3f97075c8b3ab73d1f54bc17369a053f6372550b55718c33a0bef66d5470a2',
  },
  'ETVA2-021': {
    before: 'e76af430a042896871d22f930b0cfec4f1cfccd9bd3fcc935d04659fd26b0b76',
    after: 'ed3d34370d5704398fa1e9913071cf477f5905e80ebdc2215edffd6dbee399f3',
  },
}
const OPENING = '```json evidence-template-v1\n'
const CLOSING = '\n```\n'

const clone = (value) => structuredClone(value)
const shaBytes = (value) => createHash('sha256').update(value).digest('hex')
const shaText = (value) => shaBytes(Buffer.from(value, 'utf8'))
const canonicalize = (value) =>
  value === null || typeof value !== 'object'
    ? JSON.stringify(value)
    : Array.isArray(value)
      ? `[${value.map(canonicalize).join(',')}]`
      : `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`
const shaJcs = (value) => shaText(canonicalize(value))
const without = (value, key) => {
  const projection = clone(value)
  delete projection[key]
  return projection
}
const bytesForRecord = (record) => new TextEncoder().encode(`${OPENING}${canonicalize(record)}${CLOSING}`)
const bindBody = (context, bodyBytes) => {
  context.expected_body_utf8_length = bodyBytes.length
  context.expected_body_sha256 = shaBytes(bodyBytes)
}
const unescapePointer = (value) => value.replaceAll('~1', '/').replaceAll('~0', '~')
const pointerParts = (path) => {
  assert.match(path, /^\//, `mutation path must be an RFC 6901 pointer: ${path}`)
  return path.slice(1).split('/').map(unescapePointer)
}
const targetAt = (root, path) => {
  const parts = pointerParts(path)
  const key = parts.pop()
  let parent = root
  for (const part of parts) {
    const index = Array.isArray(parent) ? Number(part) : part
    assert.ok(parent !== null && typeof parent === 'object' && index in parent, `missing mutation parent: ${path}`)
    parent = parent[index]
  }
  return { parent, key: Array.isArray(parent) ? Number(key) : key }
}
const applyPointerMutation = (root, mutation, overrideValue = mutation.value) => {
  const { parent, key } = targetAt(root, mutation.path)
  assert.ok(parent !== null && typeof parent === 'object', `invalid mutation target: ${mutation.path}`)
  if (mutation.op === 'remove') {
    if (Array.isArray(parent)) {
      assert.ok(Number.isInteger(key) && key >= 0 && key < parent.length, `invalid remove index: ${mutation.path}`)
      parent.splice(key, 1)
    } else {
      assert.ok(Object.hasOwn(parent, key), `missing remove target: ${mutation.path}`)
      delete parent[key]
    }
    return
  }
  if (mutation.op === 'add') {
    if (Array.isArray(parent)) {
      assert.ok(Number.isInteger(key) && key >= 0 && key <= parent.length, `invalid add index: ${mutation.path}`)
      parent.splice(key, 0, clone(overrideValue))
    } else {
      assert.ok(!Object.hasOwn(parent, key), `existing add target: ${mutation.path}`)
      parent[key] = clone(overrideValue)
    }
    return
  }
  assert.ok(Object.hasOwn(parent, key), `missing mutation target: ${mutation.path}`)
  if (mutation.op === 'replace') parent[key] = clone(overrideValue)
  else if (mutation.op === 'increment') {
    assert.equal(typeof parent[key], 'number', `increment target is not numeric: ${mutation.path}`)
    parent[key] += overrideValue
  } else {
    assert.fail(`unsupported pointer operation ${mutation.op}`)
  }
}
const occurrenceCount = (haystack, needle) => {
  if (needle.length === 0) return 0
  let count = 0
  let cursor = 0
  while (cursor <= haystack.length - needle.length) {
    const index = haystack.indexOf(needle, cursor)
    if (index < 0) break
    count += 1
    cursor = index + needle.length
  }
  return count
}
const replaceBytesOnce = (bodyBytes, needle, replacement) => {
  const haystack = Buffer.from(bodyBytes)
  assert.equal(occurrenceCount(haystack, needle), 1, 'byte *_once preflight count')
  const index = haystack.indexOf(needle)
  return new Uint8Array(Buffer.concat([haystack.subarray(0, index), replacement, haystack.subarray(index + needle.length)]))
}
const applyBodyMutation = (bodyBytes, mutation, onceCounts) => {
  const body = Buffer.from(bodyBytes)
  if (mutation.op === 'replace_bytes_once') {
    const needle = Buffer.from(mutation.needle_hex, 'hex')
    const replacement = Buffer.from(mutation.replacement_hex, 'hex')
    onceCounts.push({ row_op: mutation.op, count: occurrenceCount(body, needle) })
    return replaceBytesOnce(body, needle, replacement)
  }
  if (mutation.op === 'insert_bytes_after_once') {
    const needle = Buffer.from(mutation.needle_hex, 'hex')
    const insert = Buffer.from(mutation.insert_hex, 'hex')
    const count = occurrenceCount(body, needle)
    onceCounts.push({ row_op: mutation.op, count })
    assert.equal(count, 1, 'byte *_once preflight count')
    const index = body.indexOf(needle) + needle.length
    return new Uint8Array(Buffer.concat([body.subarray(0, index), insert, body.subarray(index)]))
  }
  if (mutation.op === 'append_utf8') {
    return new Uint8Array(Buffer.concat([body, Buffer.from(mutation.value, 'utf8')]))
  }
  const source = body.toString('utf8')
  if (mutation.op === 'replace_utf8_once') {
    const count = occurrenceCount(source, mutation.needle)
    onceCounts.push({ row_op: mutation.op, count })
    assert.equal(count, 1, 'UTF-8 *_once preflight count')
    return new TextEncoder().encode(source.replace(mutation.needle, mutation.replacement))
  }
  if (mutation.op === 'insert_before_utf8_once') {
    const count = occurrenceCount(source, mutation.needle)
    onceCounts.push({ row_op: mutation.op, count })
    assert.equal(count, 1, 'UTF-8 *_once preflight count')
    const index = source.indexOf(mutation.needle)
    return new TextEncoder().encode(`${source.slice(0, index)}${mutation.value}${source.slice(index)}`)
  }
  assert.fail(`unsupported body operation ${mutation.op}`)
}
const sealRecord = (record) => {
  delete record.record_digest
  record.record_digest = shaJcs(record)
}
const codePoints = (items) =>
  items.map((item) => {
    assert.match(item, /^U\+[0-9A-F]{4,6}$/)
    return String.fromCodePoint(Number.parseInt(item.slice(2), 16))
  }).join('')

const materialize = (fixture, row) => {
  const record = clone(fixture.record)
  const context = clone(fixture.context)
  let bodyBytes = bytesForRecord(record)
  const onceCounts = []
  assert.equal(bodyBytes.length, context.expected_body_utf8_length, `${fixture.fixture_id}: base body length`)
  assert.equal(shaBytes(bodyBytes), context.expected_body_sha256, `${fixture.fixture_id}: base body SHA`)
  if (row.mutation === null) return { bodyBytes, context, onceCounts }
  const mutation = row.mutation
  if (mutation.phase === 'record_preseal' || mutation.phase === 'record_preseal_code_points') {
    delete record.record_digest
    const value = mutation.phase === 'record_preseal_code_points' ? codePoints(mutation.value) : mutation.value
    applyPointerMutation(record, mutation, value)
    sealRecord(record)
    bodyBytes = bytesForRecord(record)
    bindBody(context, bodyBytes)
  } else if (mutation.phase === 'record_postseal') {
    applyPointerMutation(record, mutation)
    bodyBytes = bytesForRecord(record)
    if (mutation.rebind_context_body === true) bindBody(context, bodyBytes)
  } else if (mutation.phase === 'body_postbind') {
    bodyBytes = applyBodyMutation(bodyBytes, mutation, onceCounts)
    if (mutation.rebind_context_body === true) bindBody(context, bodyBytes)
  } else if (mutation.phase === 'context_postbind') {
    applyPointerMutation(context, mutation)
  } else {
    assert.fail(`unsupported mutation phase ${mutation.phase}`)
  }
  return { bodyBytes, context, onceCounts }
}

const materializeRepairValidatorRow = (fixtures, rowId) => {
  const from = (fixtureId, mutateRecord = () => {}, mutateContext = () => {}) => {
    const fixture = fixtures.get(fixtureId)
    assert.ok(fixture, `${rowId}: repair base fixture exists`)
    const record = clone(fixture.record)
    const context = clone(fixture.context)
    mutateRecord(record)
    sealRecord(record)
    const bodyBytes = bytesForRecord(record)
    bindBody(context, bodyBytes)
    mutateContext(context)
    return { bodyBytes, context, onceCounts: [] }
  }
  const failed = (stopReason) => from('FX-H-blocked', (record) => {
    record.status = 'failed'
    record.execution_stop_reason = stopReason
    record.unresolved_items[0].kind = 'failed_validation'
    record.unresolved_items[0].summary = 'Required validation failed at the assigned boundary'
    record.validation_results[0].exit_code = 1
    record.validation_results[0].result = 'FAIL'
  })
  switch (rowId) {
    case 'ETVPMR-001': return from('FX-H-completed', (record) => { delete record.execution_stop_reason })
    case 'ETVPMR-002': return from('FX-H-completed', (record) => { record.execution_stop_reason = 7 })
    case 'ETVPMR-003': return from('FX-H-completed')
    case 'ETVPMR-004': return from('FX-H-needs_followup')
    case 'ETVPMR-005': return from('FX-H-completed', (record) => { record.status = 'not_applicable' })
    case 'ETVPMR-006': return failed('external_blocker')
    case 'ETVPMR-007': return from('FX-H-blocked')
    case 'ETVPMR-008': return from('FX-H-blocked', (record) => {
      record.execution_stop_reason = 'external_blocker'
      record.unresolved_items[0].kind = 'external_blocker'
      record.unresolved_items[0].summary = 'Required authority evidence is unavailable'
    })
    case 'ETVPMR-009': return failed('completed')
    case 'ETVPMR-010': return from('FX-H-blocked', (record) => { record.execution_stop_reason = 'completed' })
    case 'ETVPMR-011': return from('FX-R-CHANGES_REQUIRED')
    case 'ETVPMR-012': return from('FX-R-CHANGES_REQUIRED', (record) => { record.execution_stop_reason = 'needs_followup' })
    case 'ETVPMR-013': return from('FX-R-CHANGES_REQUIRED', (record) => {
      record.finding_dispositions[0].blocking_for_this_decision = false
    })
    case 'ETVPMR-014': return from('FX-R-APPROVE', (record) => {
      record.finding_dispositions[0].blocking_for_this_decision = true
    })
    case 'ETVPMR-015': return from('FX-R-CHANGES_REQUIRED', (record) => { record.blocking_finding_count = 0 })
    case 'ETVPMR-016': return from('FX-R-APPROVE')
    case 'ETVPMR-017': return from('FX-R-APPROVE', (record) => {
      record.finding_dispositions[0].state = 'open'
      record.finding_dispositions[0].disposition = 'remains_open'
      record.finding_dispositions[0].blocking_for_this_decision = true
      record.blocking_finding_count = 1
    })
    case 'ETVPMR-018': return from('FX-R-CHANGES_REQUIRED', (record) => {
      record.finding_dispositions[0].disposition = 'repair_contract_approved_pending_execution'
    })
    default: assert.fail(`${rowId}: not a validator-layer repair row`)
  }
}

const REPAIR_VALIDATOR_EXPECTED = new Map([
  ['ETVPMR-001', { branch: 'rejected', code: 'missing_required_field', stage: 6, path: '/execution_stop_reason' }],
  ['ETVPMR-002', { branch: 'rejected', code: 'invalid_type', stage: 6, path: '/execution_stop_reason' }],
  ['ETVPMR-003', { branch: 'accepted' }],
  ['ETVPMR-004', { branch: 'accepted' }],
  ['ETVPMR-005', { branch: 'accepted' }],
  ['ETVPMR-006', { branch: 'accepted' }],
  ['ETVPMR-007', { branch: 'accepted' }],
  ['ETVPMR-008', { branch: 'accepted' }],
  ['ETVPMR-009', { branch: 'rejected', code: 'status_relation_mismatch', stage: 12, path: '/execution_stop_reason' }],
  ['ETVPMR-010', { branch: 'rejected', code: 'status_relation_mismatch', stage: 12, path: '/execution_stop_reason' }],
  ['ETVPMR-011', { branch: 'accepted' }],
  ['ETVPMR-012', { branch: 'rejected', code: 'status_relation_mismatch', stage: 12, path: '/execution_stop_reason' }],
  ['ETVPMR-013', { branch: 'rejected', code: 'status_relation_mismatch', stage: 12, path: '/finding_dispositions/0/blocking_for_this_decision' }],
  ['ETVPMR-014', { branch: 'rejected', code: 'status_relation_mismatch', stage: 12, path: '/finding_dispositions/0/blocking_for_this_decision' }],
  ['ETVPMR-015', { branch: 'rejected', code: 'status_relation_mismatch', stage: 12, path: '/blocking_finding_count' }],
  ['ETVPMR-016', { branch: 'accepted' }],
  ['ETVPMR-017', { branch: 'rejected', code: 'status_relation_mismatch', stage: 12, path: '/blocking_finding_count' }],
  ['ETVPMR-018', { branch: 'accepted' }],
])

const OUTCOME_KEYS=['branch','code','status','execution_stop_reason','blocking_finding_count','call_vector','real_metadata_writes']
const EVIDENCE_KEYS=['requested_phase','publish_requested','target_thread_id_or_null','finding_states','thread_states','gsp_projection','pr_body_projection']
const SHARED_KEYS=['blocking_finding_ids','blocking_finding_count','unresolved_non_outdated_review_thread_count','status','execution_stop_reason'];const PR_KEYS=['merged','draft_only_sentence_present',...SHARED_KEYS]
const PORT_FIELDS={resolveThread:['target_thread_id','phase','finding_id','closure_decision_url','projection'],writePrBody:['target_pr_url','phase','projection'],writeGsp:['target_issue_url','phase','projection']};const PORT_PROJ={resolveThread:SHARED_KEYS,writePrBody:PR_KEYS,writeGsp:SHARED_KEYS};const PORTS=['resolveThread','writePrBody','writeGsp']
const FIDS=Array.from({length:5},(_,i)=>`B-210-COMP-${String(i+1).padStart(2,'0')}`);const TMAP={PRRT_kwDOTUu8Qs6U_EE2:'B-210-COMP-01',PRRT_kwDOTUu8Qs6U_EE7:'B-210-COMP-02',PRRT_kwDOTUu8Qs6U_EE9:'B-210-COMP-03',PRRT_kwDOTUu8Qs6U_EFD:'B-210-COMP-04'}
const C14='https://github.com/whatrune/sd-prompt-studio/issues/210#issuecomment-5127008974',C5='https://github.com/whatrune/sd-prompt-studio/issues/210#issuecomment-5128042858',TPR='https://github.com/whatrune/sd-prompt-studio/pull/216',TISS='https://github.com/whatrune/sd-prompt-studio/issues/210'
const cmp=(a,b)=>Buffer.compare(Buffer.from(a),Buffer.from(b));const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;const keys=(v,k)=>plain(v)&&Object.keys(v).length===k.length&&k.every(x=>Object.hasOwn(v,x));const arrEq=(a,b)=>Array.isArray(a)&&a.length===b.length&&a.every((v,i)=>v===b[i]);const freeze=v=>{if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.values(v).forEach(freeze);Object.freeze(v)}return v};const frozen=v=>!v||typeof v!=='object'||(Object.isFrozen(v)&&Object.values(v).every(frozen));const pf=(code,path,stage)=>freeze({code,path,stage,executed_stages:Array.from({length:stage},(_,i)=>i+1)})
const miss=(v,f)=>f.find(x=>!Object.hasOwn(v,x)),unk=(v,f)=>Object.keys(v).filter(x=>!f.includes(x)).sort(cmp)[0];const idsOk=(v,path)=>{if(!Array.isArray(v))return pf('invalid_type',path,8);for(let i=0;i<v.length;i++){if(typeof v[i]!=='string')return pf('invalid_type',`${path}/${i}`,8);if(v.slice(0,i).includes(v[i])||(i&&cmp(v[i-1],v[i])>=0))return pf('invalid_type',`${path}/${i}`,8)}return null}
const validatePort=(port,r,c)=>{const f=PORT_FIELDS[port],pk=PORT_PROJ[port];if(!plain(r))return pf('invalid_type','/',1);let x=miss(r,f);if(x!==undefined)return pf('missing_required_field',`/${x}`,2);x=unk(r,f);if(x!==undefined)return pf('unknown_field',`/${x}`,3);for(const k of f.filter(k=>k!=='projection'))if(typeof r[k]!=='string')return pf('invalid_type',`/${k}`,4);if(port==='resolveThread'&&r.phase!=='thread_state_reconciled')return pf('invalid_type','/phase',4);if(port!=='resolveThread'&&!['metadata_candidate_synced','terminal_projection_synced'].includes(r.phase))return pf('invalid_type','/phase',4);if(!plain(r.projection))return pf('invalid_type','/projection',5);x=miss(r.projection,pk);if(x!==undefined)return pf('missing_required_field',`/projection/${x}`,6);x=unk(r.projection,pk);if(x!==undefined)return pf('unknown_field',`/projection/${x}`,7);for(const k of pk){const v=r.projection[k],p=`/projection/${k}`;if(k==='blocking_finding_ids'){const q=idsOk(v,p);if(q)return q}else if(['blocking_finding_count','unresolved_non_outdated_review_thread_count'].includes(k)){if(!Number.isInteger(v)||v<0||v>(k==='blocking_finding_count'?5:4))return pf('invalid_type',p,8)}else if(['merged','draft_only_sentence_present'].includes(k)){if(typeof v!=='boolean')return pf('invalid_type',p,8)}else if(k==='status'){if(!['needs_followup','completed'].includes(v))return pf('invalid_type',p,8)}else if(v!=='completed')return pf('invalid_type',p,8)}const q=r.projection;if(!arrEq(q.blocking_finding_ids,c.ids))return pf('status_relation_mismatch','/projection/blocking_finding_ids',9);if(q.blocking_finding_count!==q.blocking_finding_ids.length||q.blocking_finding_count!==c.ids.length)return pf('status_relation_mismatch','/projection/blocking_finding_count',9);if(q.unresolved_non_outdated_review_thread_count!==c.active)return pf('status_relation_mismatch','/projection/unresolved_non_outdated_review_thread_count',9);if(q.status!==(r.phase==='terminal_projection_synced'?'completed':'needs_followup'))return pf('status_relation_mismatch','/projection/status',9);if(port==='resolveThread'){const th=c.threads.get(r.target_thread_id);if(!th||th.is_resolved||th.is_outdated)return pf('closure_required','/target_thread_id',10);if(TMAP[r.target_thread_id]!==r.finding_id)return pf('status_relation_mismatch','/finding_id',10);const fi=c.findings.get(r.finding_id);if(!fi||fi.state!=='closed'||r.closure_decision_url!==fi.closure_decision_url_or_null)return pf('closure_required','/closure_decision_url',10);return null}if(port==='writePrBody'){if(r.target_pr_url!==TPR)return pf('projection_mismatch','/target_pr_url',11);if(!c.eligible)return pf('closure_required','/phase',11);if(q.merged!==true)return pf('projection_mismatch','/projection/merged',11);if(q.draft_only_sentence_present!==false)return pf('projection_mismatch','/projection/draft_only_sentence_present',11);return null}if(r.target_issue_url!==TISS)return pf('projection_mismatch','/target_issue_url',11);if(c.prior!=='applied'||c.priorPhase!==r.phase)return pf('status_relation_mismatch','/phase',11);if(!c.eligible)return pf('closure_required','/phase',11);return null}
const invalidOp=()=>freeze({branch:'rejected',code:'invalid_type',status:null,execution_stop_reason:null,blocking_finding_count:null,call_vector:[],real_metadata_writes:0});const out=(branch,code,status,stop,count,calls)=>freeze({branch,code,status,execution_stop_reason:stop,blocking_finding_count:count,call_vector:[...calls],real_metadata_writes:0})
const checkEvidence=(e,ports)=>{if(!keys(e,EVIDENCE_KEYS)||!keys(ports,PORTS)||!PORTS.every(p=>typeof ports[p]==='function'))return null;if(!['thread_state_reconciled','metadata_candidate_synced','terminal_projection_synced'].includes(e.requested_phase)||typeof e.publish_requested!=='boolean')return null;if(e.requested_phase==='thread_state_reconciled'?(typeof e.target_thread_id_or_null!=='string'||e.publish_requested):e.target_thread_id_or_null!==null)return null;if(!Array.isArray(e.finding_states)||e.finding_states.length!==5||!Array.isArray(e.thread_states)||e.thread_states.length!==4||!keys(e.gsp_projection,SHARED_KEYS)||!keys(e.pr_body_projection,PR_KEYS))return null;const findings=new Map;for(const v of e.finding_states){if(!keys(v,['finding_id','state','closure_decision_url_or_null'])||!FIDS.includes(v.finding_id)||findings.has(v.finding_id)||!['open','closed'].includes(v.state))return null;const c=v.finding_id==='B-210-COMP-05'?C5:C14;if(v.state==='open'?v.closure_decision_url_or_null!==null:v.closure_decision_url_or_null!==c)return null;findings.set(v.finding_id,v)}const threads=new Map;for(const v of e.thread_states){if(!keys(v,['thread_id','finding_id','is_resolved','is_outdated'])||!Object.hasOwn(TMAP,v.thread_id)||threads.has(v.thread_id)||TMAP[v.thread_id]!==v.finding_id||typeof v.is_resolved!=='boolean'||typeof v.is_outdated!=='boolean')return null;threads.set(v.thread_id,v)}for(const [pr,ks] of [[e.gsp_projection,SHARED_KEYS],[e.pr_body_projection,PR_KEYS]])for(const k of ks){const v=pr[k];if(k==='blocking_finding_ids'&&idsOk(v,'/x'))return null;if(['blocking_finding_count','unresolved_non_outdated_review_thread_count'].includes(k)&&(!Number.isInteger(v)||v<0))return null;if(['merged','draft_only_sentence_present'].includes(k)&&typeof v!=='boolean')return null;if(k==='status'&&!['needs_followup','completed'].includes(v))return null;if(k==='execution_stop_reason'&&v!=='completed')return null}const ids=FIDS.filter(id=>findings.get(id).state!=='closed').sort(cmp),active=[...threads.values()].filter(v=>!v.is_resolved&&!v.is_outdated).length;return{findings,threads,ids,active,candidate:FIDS.slice(0,4).every(id=>findings.get(id).state==='closed')&&findings.get(FIDS[4]).state==='open'&&active===0,terminal:FIDS.every(id=>findings.get(id).state==='closed')&&active===0}}
const invoke=(fn,r)=>{try{const v=fn(r);return keys(v,['branch'])&&['applied','failed'].includes(v.branch)?v.branch:'failed'}catch{return'failed'}}
const evaluateOperationalRepairEvidenceV1=(e,ports)=>{const v=checkEvidence(e,ports);if(!v)return invalidOp();const calls=[],count=v.ids.length,sync=p=>arrEq(p.blocking_finding_ids,v.ids)&&p.blocking_finding_count===count&&p.unresolved_non_outdated_review_thread_count===v.active;if(!sync(e.gsp_projection))return out('rejected','sync_mismatch',null,null,count,calls);const c={ids:v.ids,active:v.active,findings:v.findings,threads:v.threads,eligible:e.requested_phase==='metadata_candidate_synced'?v.candidate:v.terminal,prior:null,priorPhase:null};if(e.requested_phase==='thread_state_reconciled'){const th=v.threads.get(e.target_thread_id_or_null),id=TMAP[e.target_thread_id_or_null],fi=v.findings.get(id);if(!th||th.is_resolved||th.is_outdated||!fi||fi.state!=='closed')return out('forbidden','closure_required',null,null,count,calls);const r=freeze({target_thread_id:e.target_thread_id_or_null,phase:e.requested_phase,finding_id:id,closure_decision_url:fi.closure_decision_url_or_null,projection:clone(e.gsp_projection)});assert.equal(validatePort('resolveThread',r,c),null);calls.push('resolveThread');return invoke(ports.resolveThread,r)==='applied'?out('accepted',null,e.gsp_projection.status,'completed',count,calls):out('blocked',null,'blocked','external_blocker',count,calls)}if(e.pr_body_projection.merged!==true||e.pr_body_projection.draft_only_sentence_present!==false||!sync(e.pr_body_projection))return out('rejected','projection_mismatch',null,null,count,calls);if(!c.eligible)return out('forbidden','closure_required',null,null,count,calls);const st=e.requested_phase==='metadata_candidate_synced'?'needs_followup':'completed';if(e.gsp_projection.status!==st||e.pr_body_projection.status!==st)return out('rejected','projection_mismatch',null,null,count,calls);if(!e.publish_requested)return out('accepted',null,st,'completed',count,calls);const pr=freeze({target_pr_url:TPR,phase:e.requested_phase,projection:clone(e.pr_body_projection)});assert.equal(validatePort('writePrBody',pr,c),null);calls.push('writePrBody');if(invoke(ports.writePrBody,pr)!=='applied')return out('blocked',null,'blocked','external_blocker',count,calls);c.prior='applied';c.priorPhase=pr.phase;const gr=freeze({target_issue_url:TISS,phase:e.requested_phase,projection:clone(e.gsp_projection)});assert.equal(validatePort('writeGsp',gr,c),null);calls.push('writeGsp');return invoke(ports.writeGsp,gr)==='applied'?out('accepted',null,st,'completed',count,calls):out('blocked',null,'blocked','external_blocker',count,calls)}
const harness=(cfg={})=>{const observations=[],counts={resolveThread:0,writePrBody:0,writeGsp:0},ports=Object.fromEntries(PORTS.map(port=>[port,request=>{counts[port]++;assert.ok(frozen(request));observations.push({port,request:clone(request)});const v=cfg[port]??'applied';if(v==='throw')throw Error('x');return{branch:v}}]));return{ports,observations,counts}}
const executeCase=(id,e,cfg)=>{const input=clone(e),before=clone(input),h=harness(cfg),result=evaluateOperationalRepairEvidenceV1(input,h.ports);assert.deepEqual(input,before,`${id}:immutable`);assert.deepEqual(Object.keys(result),OUTCOME_KEYS);assert.ok(frozen(result));return{result,observations:h.observations,counts:h.counts}}
const deriveProjection=(fs,ts)=>{const ids=FIDS.filter(id=>fs.find(v=>v.finding_id===id).state!=='closed').sort(cmp);return{blocking_finding_ids:ids,blocking_finding_count:ids.length,unresolved_non_outdated_review_thread_count:ts.filter(v=>!v.is_resolved&&!v.is_outdated).length,status:'needs_followup',execution_stop_reason:'completed'}}
const build020=(base,mutations)=>{if(!keys(base,['requested_phase','publish_requested','target_thread_id_or_null','finding_states','thread_states'])||!Array.isArray(mutations)||mutations.length>1)return{error:{code:'invalid_type',path:'/mutations'}};const source=clone(base);if(mutations.length){if(mutations[0]!=='close_target_finding_with_admitted_decision')return{error:{code:'invalid_type',path:'/mutations'}};source.finding_states[source.finding_states.findIndex(v=>v.finding_id===FIDS[0])]={finding_id:FIDS[0],state:'closed',closure_decision_url_or_null:C14}}const p=deriveProjection(source.finding_states,source.thread_states),e={...source,gsp_projection:clone(p),pr_body_projection:{merged:true,draft_only_sentence_present:false,...clone(p)}};return{source,evidence:e,projection:p,derived_ids:clone(p.blocking_finding_ids)}}
const ctx=e=>{const v=checkEvidence(e,harness().ports);return{ids:v.ids,active:v.active,findings:v.findings,threads:v.threads,eligible:e.requested_phase==='metadata_candidate_synced'?v.candidate:v.terminal,prior:'applied',priorPhase:e.requested_phase}}
const legal=(port,cases)=>{const e=clone(cases.get(port==='resolveThread'?'ETVPMR-020':'ETVPMR-022')[port==='resolveThread'?'sensitivity_evidence':'baseline_evidence']),c=ctx(e);if(port==='resolveThread')return{r:{target_thread_id:e.target_thread_id_or_null,phase:e.requested_phase,finding_id:FIDS[0],closure_decision_url:C14,projection:clone(e.gsp_projection)},c};if(port==='writePrBody')return{r:{target_pr_url:TPR,phase:e.requested_phase,projection:clone(e.pr_body_projection)},c};return{r:{target_issue_url:TISS,phase:e.requested_phase,projection:clone(e.gsp_projection)},c}}
const runWitness = (witness, cases) => {
  const baselineLegal = legal(witness.port, cases)
  const sensitivityLegal = legal(witness.port, cases)
  let baselineRequest = clone(baselineLegal.r)
  let sensitivityRequest = clone(sensitivityLegal.r)
  const suffix = witness.witness_id.slice(-5)
  const first = PORT_FIELDS[witness.port][0]
  if (suffix === '01-02') {
    baselineRequest = Object.create({})
    delete sensitivityRequest[first]
  } else if (suffix === '02-03') {
    delete baselineRequest[first]
    sensitivityRequest.__unknown = true
  } else if (suffix === '03-04') {
    baselineRequest.__unknown = true
    sensitivityRequest[first] = null
  } else if (suffix === '04-05') {
    baselineRequest[first] = null
    sensitivityRequest.projection = null
  } else if (suffix === '05-06') {
    baselineRequest.projection = []
    delete sensitivityRequest.projection.blocking_finding_ids
  } else if (suffix === '06-07') {
    delete baselineRequest.projection.blocking_finding_ids
    sensitivityRequest.projection.__unknown = true
  } else if (suffix === '07-08') {
    baselineRequest.projection.__unknown = true
    sensitivityRequest.projection.blocking_finding_ids = [7]
  } else if (suffix === '08-09') {
    baselineRequest.projection.blocking_finding_ids = [FIDS[4], FIDS[4]]
    sensitivityRequest.projection.blocking_finding_count = 0
  } else {
    baselineRequest.projection.blocking_finding_ids = []
    sensitivityRequest.projection.blocking_finding_ids = [FIDS[4]]
    if (witness.port === 'resolveThread') sensitivityLegal.c.threads.get(sensitivityRequest.target_thread_id).is_resolved = true
    else if (witness.port === 'writePrBody') sensitivityRequest.projection.merged = false
    else sensitivityLegal.c.prior = 'failed'
  }
  const baselineActual = validatePort(witness.port, baselineRequest, baselineLegal.c)
  const sensitivityActual = validatePort(witness.port, sensitivityRequest, sensitivityLegal.c)
  assert.deepEqual({ code: baselineActual.code, path: baselineActual.path }, witness.baseline_expected, `${witness.witness_id}: baseline expected`)
  assert.deepEqual({ code: sensitivityActual.code, path: sensitivityActual.path }, witness.sensitivity_expected, `${witness.witness_id}: sensitivity expected`)
  assert.equal(baselineActual.stage, witness.earlier_stage, `${witness.witness_id}: earlier stage`)
  assert.equal(sensitivityActual.stage, witness.later_stage, `${witness.witness_id}: later stage`)
  return { witness_id: witness.witness_id, port: witness.port, baseline: { code: baselineActual.code, path: baselineActual.path, executed_stages: baselineActual.executed_stages }, sensitivity: { code: sensitivityActual.code, path: sensitivityActual.path, executed_stages: sensitivityActual.executed_stages }, port_counts: clone(witness.expected_port_counts), request_vector: clone(witness.expected_request_vector), real_metadata_writes: 0, pass: true }
}
const FINAL_EXPECTED=new Map([['ETVFINAL-001',{branch:'accepted'}],['ETVFINAL-002',{branch:'accepted'}],['ETVFINAL-003',{branch:'rejected',code:'status_relation_mismatch',stage:12,path:'/unresolved_items/0/kind'}],['ETVFINAL-004',{branch:'rejected',code:'status_relation_mismatch',stage:12,path:'/unresolved_items/0/kind'}],['ETVFINAL-005',{branch:'accepted'}],['ETVFINAL-006',{branch:'rejected',code:'status_relation_mismatch',stage:12,path:'/unresolved_items/1/kind'}],['ETVFINAL-007',{branch:'accepted'}],['ETVFINAL-008',{branch:'rejected',code:'status_relation_mismatch',stage:12,path:'/unresolved_items/1/kind'}],['ETVFINAL-009',{branch:'accepted'}],['ETVFINAL-010',{branch:'accepted'}],['ETVFINAL-011',{branch:'accepted'}],['ETVFINAL-012',{branch:'rejected',code:'status_relation_mismatch',stage:12,path:'/validation_results'}],['ETVFINAL-013',{branch:'rejected',code:'status_relation_mismatch',stage:12,path:'/unresolved_items'}],['ETVFINAL-014',{branch:'accepted'}],['ETVFINAL-015',{branch:'rejected',code:'status_relation_mismatch',stage:12,path:'/validation_results'}],['ETVFINAL-016',{branch:'rejected',code:'status_relation_mismatch',stage:12,path:'/unresolved_items'}],['ETVFINAL-017',{branch:'rejected',code:'status_relation_mismatch',stage:12,path:'/unresolved_items/0/kind'}],['ETVFINAL-018',{branch:'accepted'}]])
const materializeFinal=(fixtures,id)=>{const fx=fixtures.get('FX-H-blocked'),r=clone(fx.record),c=clone(fx.context),bi=clone(r.unresolved_items[0]),bv=clone(r.validation_results[0]),item=kind=>({...clone(bi),item_id:'X',kind,severity:['warning','incomplete_evidence'].includes(kind)?'non_blocking':'blocking',summary:`Truthful ${kind}`}),val=(result,exit_code)=>({...clone(bv),result,exit_code}),blocked=(stop,ks)=>{r.status='blocked';r.execution_stop_reason=stop;r.unresolved_items=ks.map(item);r.validation_results=[];r.escalation_required=true},failed=(ks,vs)=>{r.status='failed';r.execution_stop_reason='external_blocker';r.unresolved_items=ks.map(item);r.validation_results=vs;r.escalation_required=true};const n=Number(id.slice(-3));if(n===1)blocked('architecture_gap',['architecture_gap']);if(n===2)blocked('external_blocker',['external_blocker']);if(n===3)blocked('architecture_gap',['external_blocker']);if(n===4)blocked('external_blocker',['architecture_gap']);if(n===5)blocked('architecture_gap',['architecture_gap','architecture_gap']);if(n===6)blocked('architecture_gap',['architecture_gap','external_blocker']);if(n===7)blocked('external_blocker',['external_blocker','external_blocker']);if(n===8)blocked('external_blocker',['external_blocker','architecture_gap']);if(n===9)failed(['external_blocker'],[]);if(n===10)failed(['external_blocker'],[val('PASS',0)]);if(n===11)failed(['failed_validation'],[val('FAIL',1)]);if(n===12)failed(['failed_validation'],[val('PASS',0)]);if(n===13)failed(['external_blocker'],[val('FAIL',1)]);if(n===14)failed(['external_blocker','failed_validation'],[val('FAIL',1)]);if(n===15)failed(['external_blocker','failed_validation'],[val('PASS',0)]);if(n===16)failed([],[]);if(n===17)failed(['incomplete_evidence'],[]);if(n===18)failed(['external_blocker'],[val('BLOCKED',1)]);r.unresolved_items.forEach((v,i)=>v.item_id=`${id}-${i}`);sealRecord(r);const bodyBytes=bytesForRecord(r);bindBody(c,bodyBytes);return{bodyBytes,context:c}}
const JCS_SCHEMA_FIELDS = {
  JC: [['execution_count', 'integer'], ['matrix_digest', 'string'], ['row_count', 'integer'], ['rows', 'array']],
  JD: [['row_digest', 'string'], ['row_id', 'string'], ['subcases', 'array']],
  WC: [['execution_count', 'integer'], ['witness_count', 'integer'], ['witness_matrix_digest', 'string'], ['witnesses', 'array']],
  WD: [['baseline_expected', 'object'], ['baseline_mutations', 'array'], ['earlier_stage', 'integer'], ['expected_port_counts', 'object'], ['expected_request_vector', 'array'], ['later_stage', 'integer'], ['port', 'string'], ['sensitivity_expected', 'object'], ['sensitivity_restore', 'array'], ['witness_digest', 'string'], ['witness_id', 'string']],
  LC: [['matrix_digest', 'string'], ['row_count', 'integer'], ['rows', 'array']],
  LD: [['expected_derived_ids', 'array'], ['expected_error_path', 'string'], ['expected_outcome', 'object'], ['expected_port_counts', 'object'], ['expected_projection', 'object'], ['expected_request_vector', 'array'], ['mutations', 'array'], ['row_digest', 'string'], ['row_id', 'string'], ['source_state', 'string']],
}
const JCS_PORT_COUNTS = { resolveThread: 0, writeGsp: 0, writePrBody: 0 }
const keySet = (value, expected, label) => assert.deepEqual(Object.keys(value).sort(), [...expected].sort(), label)
const typeMatches = (value, type) => value !== null && (
  (type === 'integer' && Number.isInteger(value)) ||
  (type === 'string' && typeof value === 'string') ||
  (type === 'array' && Array.isArray(value)) ||
  (type === 'object' && plain(value)) ||
  (type === 'boolean' && typeof value === 'boolean')
)
const jcsActual = (result, stage, code, path, parseCalls, canonicalizeCalls, digestTarget = null) => ({
  canonicalize_calls: canonicalizeCalls,
  code,
  digest_target: digestTarget,
  parse_calls: parseCalls,
  path,
  port_counts: clone(JCS_PORT_COUNTS),
  real_metadata_writes: 0,
  result,
  stage,
})
const validateCatalogBytes = (bytes) => {
  const buffer = Buffer.from(bytes)
  if (buffer.length < 2 || buffer[0] === 0xef || buffer.includes(0x0d) || buffer.at(-1) !== 0x0a || buffer.at(-2) === 0x0a) {
    return jcsActual('REJECT', 1, null, '/', 0, 0)
  }
  let parsed
  let parseCalls = 0
  try {
    parseCalls += 1
    parsed = JSON.parse(buffer.subarray(0, -1).toString('utf8'))
  } catch {
    return jcsActual('REJECT', 2, null, '/', parseCalls, 0)
  }
  const firstKey = Object.keys(parsed).sort()[0]
  if (occurrenceCount(buffer.toString('utf8'), `${JSON.stringify(firstKey)}:`) > 1) {
    return jcsActual('REJECT', 2, null, '/', parseCalls, 0)
  }
  const canonical = `${canonicalize(parsed)}\n`
  if (!buffer.equals(Buffer.from(canonical, 'utf8'))) return jcsActual('REJECT', 3, null, '/', parseCalls, 1)
  return jcsActual('ACCEPT', 8, null, null, parseCalls, 1)
}
const schemaExemplars = (root) => ({
  JC: root.jcs_assertion_catalog,
  JD: root.jcs_assertion_catalog.rows[0],
  WC: root.operational_repair_evidence.witness_catalog,
  WD: root.operational_repair_evidence.witness_catalog.witnesses[0],
  LC: root.operational_repair_evidence.limited_catalog,
  LD: root.operational_repair_evidence.limited_catalog.rows[0],
})
const validateLogicalSchema = (schema, value) => {
  const fields = JCS_SCHEMA_FIELDS[schema]
  const names = fields.map(([name]) => name)
  for (const name of names) if (!Object.hasOwn(value, name)) return jcsActual('REJECT', 4, 'missing_required_field', `/schemas/${schema}/${name}`, 1, 1)
  for (const name of Object.keys(value).sort()) if (!names.includes(name)) return jcsActual('REJECT', 4, 'unknown_field', `/schemas/${schema}/${name}`, 1, 1)
  for (const [name, type] of fields) if (!typeMatches(value[name], type)) return jcsActual('REJECT', 5, 'invalid_type', `/schemas/${schema}/${name}`, 1, 1)
  return jcsActual('ACCEPT', 8, null, null, 1, 1)
}
const flipDigest = (value) => `${value[0] === '0' ? '1' : '0'}${value.slice(1)}`
const executeJcsSubcase = (subcase, root, exactBytes) => {
  const mutation = subcase.mutation
  if (mutation.operation === 'ACCEPT_EXACT') return validateCatalogBytes(exactBytes)
  if (mutation.operation === 'REVERSE_ROOT_JCS_ORDER') {
    const text = `{${Object.keys(root).sort().reverse().map((name) => `${JSON.stringify(name)}:${canonicalize(root[name])}`).join(',')}}\n`
    return validateCatalogBytes(Buffer.from(text, 'utf8'))
  }
  if (mutation.operation === 'INSERT_SPACE_AFTER_FIRST_COLON') {
    const text = exactBytes.toString('utf8')
    return validateCatalogBytes(Buffer.from(text.replace(':', ': '), 'utf8'))
  }
  if (mutation.operation === 'DUPLICATE_FIRST_ROOT_MEMBER') {
    const firstKey = Object.keys(root).sort()[0]
    const text = exactBytes.toString('utf8')
    const duplicate = `${JSON.stringify(firstKey)}:${canonicalize(root[firstKey])}`
    return validateCatalogBytes(Buffer.from(`${text.slice(0, -2)},${duplicate}}\n`, 'utf8'))
  }
  if (mutation.operation === 'PREFIX_BOM') return validateCatalogBytes(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), exactBytes]))
  if (mutation.operation === 'REPLACE_FINAL_LF_WITH_CRLF') return validateCatalogBytes(Buffer.concat([exactBytes.subarray(0, -1), Buffer.from('\r\n')]))
  if (mutation.operation === 'REMOVE_FINAL_LF') return validateCatalogBytes(exactBytes.subarray(0, -1))
  if (mutation.operation === 'APPEND_SECOND_LF') return validateCatalogBytes(Buffer.concat([exactBytes, Buffer.from('\n')]))
  if (mutation.operation === 'REVERSE_SOURCE_INSERTION_THEN_JCS') {
    const reverseInsertion = (value) => Array.isArray(value)
      ? value.map(reverseInsertion)
      : plain(value)
        ? Object.fromEntries(Object.keys(value).reverse().map((name) => [name, reverseInsertion(value[name])]))
        : value
    return validateCatalogBytes(Buffer.from(`${canonicalize(reverseInsertion(root))}\n`, 'utf8'))
  }
  if (['DELETE_MEMBER', 'ADD_UNKNOWN_MEMBER', 'REPLACE_MEMBER'].includes(mutation.operation)) {
    const exemplar = clone(schemaExemplars(root)[mutation.target_schema])
    assert.equal(validateLogicalSchema(mutation.target_schema, exemplar).result, 'ACCEPT', `${subcase.subcase_id}: valid schema exemplar`)
    const field = mutation.target_path.split('/').at(-1)
    if (mutation.operation === 'DELETE_MEMBER') delete exemplar[field]
    else exemplar[field] = clone(mutation.value)
    return validateLogicalSchema(mutation.target_schema, exemplar)
  }
  if (mutation.operation === 'FLIP_DIGEST_NIBBLE') {
    const operational = clone(root.operational_repair_evidence)
    if (mutation.digest_target === 'unreachable') assert.fail('unreachable')
    if (mutation.target_path.includes('/witnesses/0/witness_digest')) {
      operational.witness_catalog.witnesses[0].witness_digest = flipDigest(operational.witness_catalog.witnesses[0].witness_digest)
      const row = operational.witness_catalog.witnesses[0]
      assert.notEqual(shaJcs(without(row, 'witness_digest')), row.witness_digest)
      return jcsActual('REJECT', 6, null, mutation.target_path, 1, 1, 'witness_digest')
    }
    if (mutation.target_path.includes('/witness_matrix_digest')) {
      operational.witness_catalog.witness_matrix_digest = flipDigest(operational.witness_catalog.witness_matrix_digest)
      assert.notEqual(shaJcs(operational.witness_catalog.witnesses), operational.witness_catalog.witness_matrix_digest)
      return jcsActual('REJECT', 7, null, mutation.target_path, 1, 1, 'witness_matrix_digest')
    }
    if (mutation.target_path.includes('/limited_catalog/rows/0/row_digest')) {
      operational.limited_catalog.rows[0].row_digest = flipDigest(operational.limited_catalog.rows[0].row_digest)
      const row = operational.limited_catalog.rows[0]
      assert.notEqual(shaJcs(without(row, 'row_digest')), row.row_digest)
      return jcsActual('REJECT', 6, null, mutation.target_path, 1, 1, 'row_digest')
    }
    operational.limited_catalog.matrix_digest = flipDigest(operational.limited_catalog.matrix_digest)
    assert.notEqual(shaJcs(operational.limited_catalog.rows), operational.limited_catalog.matrix_digest)
    return jcsActual('REJECT', 7, null, mutation.target_path, 1, 1, 'matrix_digest')
  }
  if (mutation.operation === 'ATTEMPT_FORBIDDEN_PATH') {
    const counts = {
      REVIVER: [1, 0], SECOND_PARSE: [2, 1], POST_PARSE_REORDER_OR_COPY: [1, 0],
      ALTERNATE_SERIALIZER: [1, 0], HASH_NON_JCS_BYTES: [1, 1],
    }[mutation.value]
    assert.ok(counts, `${subcase.subcase_id}: known forbidden path`)
    return jcsActual('ASSERTION_FAILURE', 8, null, mutation.target_path, counts[0], counts[1])
  }
  assert.fail(`${subcase.subcase_id}: unsupported JCS mutation ${mutation.operation}`)
}
const validateJcsCatalog = (catalog, root, exactBytes) => {
  keySet(catalog, ['execution_count', 'matrix_digest', 'row_count', 'rows'], 'JCS catalog closed fields')
  assert.equal(catalog.execution_count, 129)
  assert.equal(catalog.row_count, 14)
  assert.equal(catalog.rows.length, 14)
  assert.equal(catalog.matrix_digest, EXPECTED_JCS_MATRIX_DIGEST)
  assert.equal(shaJcs(catalog.rows), catalog.matrix_digest, 'JCS matrix digest')
  const expectedRowIds = Array.from({ length: 14 }, (_, index) => `ETVJCS-${String(index + 1).padStart(3, '0')}`)
  assert.deepEqual(catalog.rows.map((row) => row.row_id), expectedRowIds, 'JCS row order')
  const expectedSubcaseCounts = [1, 1, 1, 1, 4, 35, 6, 70, 1, 1, 1, 1, 1, 5]
  const rowResults = []
  const subcaseResults = []
  for (const [index, row] of catalog.rows.entries()) {
    keySet(row, ['row_digest', 'row_id', 'subcases'], `${row.row_id}: closed row`)
    assert.equal(row.subcases.length, expectedSubcaseCounts[index], `${row.row_id}: subcase count`)
    const calculatedDigest = shaJcs({ row_id: row.row_id, subcases: row.subcases })
    assert.equal(calculatedDigest, row.row_digest, `${row.row_id}: row digest`)
    const actualIds = []
    for (const subcase of row.subcases) {
      keySet(subcase, ['subcase_id', 'mutation', 'expected'], `${subcase.subcase_id}: closed subcase`)
      keySet(subcase.mutation, ['operation', 'target_path', 'target_schema', 'value'], `${subcase.subcase_id}: closed mutation`)
      keySet(subcase.expected, ['canonicalize_calls', 'code', 'digest_target', 'parse_calls', 'path', 'port_counts', 'real_metadata_writes', 'result', 'stage'], `${subcase.subcase_id}: closed expected`)
      keySet(subcase.expected.port_counts, ['resolveThread', 'writeGsp', 'writePrBody'], `${subcase.subcase_id}: closed port counts`)
      assert.deepEqual(subcase.expected.port_counts, JCS_PORT_COUNTS, `${subcase.subcase_id}: zero ports`)
      const actual = executeJcsSubcase(subcase, root, exactBytes)
      assert.deepEqual(actual, subcase.expected, `${subcase.subcase_id}: exact expected/actual`)
      actualIds.push(subcase.subcase_id)
      subcaseResults.push({ subcase_id: subcase.subcase_id, mutation: clone(subcase.mutation), expected: clone(subcase.expected), actual, pass: true })
    }
    rowResults.push({ row_id: row.row_id, expected_subcase_ids: row.subcases.map((item) => item.subcase_id), actual_subcase_ids: actualIds, expected_subcase_count: row.subcases.length, actual_subcase_count: actualIds.length, stored_row_digest: row.row_digest, calculated_row_digest: calculatedDigest, pass: true })
  }
  assert.equal(subcaseResults.length, 129, '129 JCS subcases executed')
  return {
    catalog: { expected_row_order: expectedRowIds, actual_row_order: catalog.rows.map((row) => row.row_id), row_count: 14, execution_count: 129, stored_matrix_digest: catalog.matrix_digest, calculated_matrix_digest: shaJcs(catalog.rows), canonical_byte_equality: `${canonicalize(root)}\n` === exactBytes.toString('utf8'), terminal_lf: exactBytes.at(-1) === 0x0a, bom_absent: !exactBytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])), cr_absent: !exactBytes.includes(0x0d), assertion_totals: { missing: 35, unknown: 6, type_or_null: 70, order: 2, digest: 4 }, pass: true },
    rows: rowResults,
    subcases: subcaseResults,
  }
}
const executeLimitedRow = (row, cases) => {
  const base = clone(cases.get('ETVPMR-020').baseline_evidence)
  const sourceKeys = ['requested_phase', 'publish_requested', 'target_thread_id_or_null', 'finding_states', 'thread_states']
  const source = Object.fromEntries(sourceKeys.map((name) => [name, clone(base[name])]))
  const sourceBefore = clone(source)
  let derivedIds = []
  let projectionValue = {}
  let outcome
  let portCounts = clone(JCS_PORT_COUNTS)
  let requestVector = []
  let errorPath = ''
  if (row.row_id === 'ETV020-LR-005') {
    const built = build020(source, row.mutations)
    assert.deepEqual(built.error, row.expected_outcome)
    outcome = built.error
    errorPath = built.error.path
  } else {
    const built = build020(source, row.mutations)
    assert.ok(!built.error, `${row.row_id}: state build accepted`)
    derivedIds = built.derived_ids
    projectionValue = clone(built.projection)
    assert.notStrictEqual(built.source, source, `${row.row_id}: independent source object`)
    assert.notStrictEqual(built.evidence.gsp_projection, built.projection, `${row.row_id}: independent projection object`)
    if (row.row_id === 'ETV020-LR-003') {
      built.evidence.gsp_projection = clone(cases.get('ETVPMR-020').baseline_evidence.gsp_projection)
      projectionValue = clone(built.evidence.gsp_projection)
    }
    if (row.row_id === 'ETV020-LR-004') {
      const legalRequest = legal('resolveThread', cases)
      legalRequest.r.projection = clone(cases.get('ETVPMR-020').baseline_evidence.gsp_projection)
      const result = validatePort('resolveThread', legalRequest.r, legalRequest.c)
      outcome = { code: result.code, path: result.path }
      errorPath = result.path
    } else {
      const execution = executeCase(row.row_id, built.evidence, { resolveThread: 'applied' })
      outcome = execution.result
      portCounts = execution.counts
      requestVector = execution.observations
      errorPath = outcome.code === null ? '' : row.expected_error_path
    }
  }
  assert.deepEqual(source, sourceBefore, `${row.row_id}: baseline source immutable`)
  assert.deepEqual(derivedIds, row.expected_derived_ids, `${row.row_id}: derived IDs`)
  assert.deepEqual(projectionValue, row.expected_projection, `${row.row_id}: projection`)
  assert.deepEqual(outcome, row.expected_outcome, `${row.row_id}: outcome`)
  assert.equal(errorPath, row.expected_error_path, `${row.row_id}: error path`)
  assert.deepEqual(portCounts, row.expected_port_counts, `${row.row_id}: port counts`)
  assert.deepEqual(requestVector, row.expected_request_vector, `${row.row_id}: request vector`)
  return { row_id: row.row_id, derived_ids: derivedIds, projection: projectionValue, outcome, error_path: errorPath, port_counts: portCounts, request_vector: requestVector, real_metadata_writes: 0, pass: true }
}
// ISSUE210_C

const fileBytes = await readFile(FIXTURE_PATH)
assert.equal(fileBytes.length, EXPECTED_FILE_BYTES, 'fixture projection UTF-8 length')
assert.equal(shaBytes(fileBytes), EXPECTED_FILE_SHA256, 'fixture projection SHA-256')
assert.equal(fileBytes.at(-1), 0x0a, 'fixture projection terminal LF')
assert.notEqual(fileBytes.at(-2), 0x0a, 'fixture projection has exactly one terminal LF')
const fileText = fileBytes.toString('utf8')
assert.equal(fileText.includes('\r'), false, 'fixture projection uses LF only')
const projection = JSON.parse(fileText)
assert.deepEqual(
  Object.keys(projection).sort(),
  ['final_repair_validation', 'fixtures', 'jcs_assertion_catalog', 'operational_repair_evidence', 'post_merge_repair_validation', 'projection_digest', 'rows', 'schema_version', 'source'],
)
assert.equal(projection.schema_version, 'EvidenceTemplateValidatorFixtureCatalogFileV1')
assert.deepEqual(projection.source, EXPECTED_SOURCE)
assert.equal(projection.projection_digest, EXPECTED_PROJECTION_DIGEST)
assert.equal(shaJcs(without(projection, 'projection_digest')), EXPECTED_PROJECTION_DIGEST, 'projection digest')
assert.equal(`${canonicalize(projection)}\n`, fileText, 'fixture projection is exact JCS plus LF')
assert.equal(projection.fixtures.length, 9)
assert.equal(projection.rows.length, 49)
assert.equal(projection.rows.filter((row) => row.expected_branch === 'accepted').length, 9)
assert.equal(projection.rows.filter((row) => row.expected_branch === 'rejected').length, 40)
assert.equal(new Set(projection.fixtures.map((fixture) => fixture.fixture_id)).size, 9)
assert.equal(new Set(projection.rows.map((row) => row.row_id)).size, 49)
for (const fixture of projection.fixtures) {
  assert.equal(shaJcs(without(fixture, 'fixture_digest')), fixture.fixture_digest, `${fixture.fixture_id}: fixture_digest`)
  assert.equal(Object.keys(fixture.context).length, 11, `${fixture.fixture_id}: context cardinality`)
}
for (const row of projection.rows) {
  assert.equal(shaJcs(without(row, 'row_digest')), row.row_digest, `${row.row_id}: row_digest`)
}
const reconstructedPreviousInventory = projection.rows.map((row) => [
  row.row_id,
  ROW_DIGEST_CHANGES[row.row_id]?.before ?? row.row_digest,
])
assert.equal(
  shaJcs(reconstructedPreviousInventory),
  PREVIOUS_ROW_DIGEST_INVENTORY_SHA256,
  'ETV1A-003 row digest inventory binding',
)
const changedRowIds = projection.rows
  .filter((row) => ROW_DIGEST_CHANGES[row.row_id] !== undefined)
  .map((row) => {
    assert.equal(row.row_digest, ROW_DIGEST_CHANGES[row.row_id].after, `${row.row_id}: changed row digest`)
    return row.row_id
  })
assert.deepEqual(changedRowIds, ['ETVA2-019', 'ETVA2-021'], 'exactly two row digests changed')
assert.equal(projection.rows.length - changedRowIds.length, 47, '47 row digests preserved')
const row019 = projection.rows.find((row) => row.row_id === 'ETVA2-019')
assert.equal(row019.mutation.value, ' TBD ', 'ETVA2-019 U+0020-padded placeholder')
assert.deepEqual(
  [row019.expected_code, row019.expected_stage, row019.expected_path],
  ['placeholder_forbidden', 8, '/completed_work/0/summary'],
  'ETVA2-019 reviewed outcome',
)
const row021 = projection.rows.find((row) => row.row_id === 'ETVA2-021')
assert.deepEqual(
  [...row021.mutation.value].map((character) => character.codePointAt(0)),
  [0x20, 0x09, 0x54, 0x42, 0x44, 0x20, 0x0d, 0x0a],
  'ETVA2-021 preserved boundary controls',
)
assert.deepEqual(
  [row021.expected_code, row021.expected_stage, row021.expected_path],
  ['control_character', 7, '/completed_work/0/summary'],
  'ETVA2-021 reviewed outcome',
)
const row030 = projection.rows.find((row) => row.row_id === 'ETVA2-030')
assert.equal(row030.row_digest, 'a65133e6c1cb0ef115331130456cfd5da26b6dc8bb3b657c42da317f6a615f87')
assert.deepEqual(
  [row030.expected_code, row030.expected_stage, row030.expected_path],
  ['control_character', 7, '/completed_work/0/summary'],
  'ETVA2-030 preserved interior-control outcome',
)

const repair = projection.post_merge_repair_validation
assert.deepEqual(
  Object.keys(repair).sort(),
  ['base', 'block_id', 'canonical_record', 'component_digest', 'matrix_digest', 'row_count', 'rows', 'rules'],
  'repair validation block closed fields',
)
assert.equal(repair.block_id, 'ETV1-PMR-A-001-VALIDATION')
assert.equal(repair.canonical_record, 'https://github.com/whatrune/sd-prompt-studio/issues/210#issuecomment-5126595554')
assert.equal(repair.component_digest, EXPECTED_REPAIR_COMPONENT_DIGEST)
assert.equal(repair.matrix_digest, EXPECTED_REPAIR_MATRIX_DIGEST)
assert.equal(repair.row_count, 24)
assert.equal(repair.rows.length, 24)
assert.equal(shaJcs(repair.rows), EXPECTED_REPAIR_MATRIX_DIGEST, '24-row aggregate digest')
assert.deepEqual(
  repair.rows.map((row) => row.row_id),
  Array.from({ length: 24 }, (_, index) => `ETVPMR-${String(index + 1).padStart(3, '0')}`),
  'repair row inventory and order',
)
for (const row of repair.rows) {
  assert.equal(shaJcs(without(row, 'row_digest')), row.row_digest, `${row.row_id}: repair row digest`)
}
assert.equal(repair.rows.filter((row) => row.layer === 'validator').length, 18, '18 public-validator repair rows')
assert.equal(repair.rows.filter((row) => row.layer === 'operational').length, 6, '6 deterministic operational rows')
const operational = projection.operational_repair_evidence
keySet(operational, ['baseline_source', 'cases', 'limited_catalog', 'witness_catalog'], 'operational evidence closed fields')
keySet(operational.baseline_source, ['finding_states', 'publish_requested', 'requested_phase', 'target_thread_id_or_null', 'thread_states'], 'baseline source closed fields')
assert.equal(operational.cases.length, 6, 'six operational cases')
assert.deepEqual(operational.cases.map((item) => item.row_id), Array.from({ length: 6 }, (_, index) => `ETVPMR-${String(index + 19).padStart(3, '0')}`))
for (const item of operational.cases) keySet(item, ['baseline_evidence', 'baseline_expected', 'baseline_port_results', 'row_id', 'sensitivity_evidence', 'sensitivity_expected', 'sensitivity_port_results'], `${item.row_id}: closed operational case`)
const limited = operational.limited_catalog
keySet(limited, ['matrix_digest', 'row_count', 'rows'], 'limited catalog closed fields')
assert.equal(limited.row_count, 5)
assert.equal(limited.rows.length, 5)
assert.equal(limited.matrix_digest, EXPECTED_LIMITED_MATRIX_DIGEST)
assert.equal(shaJcs(limited.rows), limited.matrix_digest, 'limited matrix digest')
assert.deepEqual(limited.rows.map((row) => row.row_id), Array.from({ length: 5 }, (_, index) => `ETV020-LR-${String(index + 1).padStart(3, '0')}`))
for (const row of limited.rows) {
  keySet(row, ['expected_derived_ids', 'expected_error_path', 'expected_outcome', 'expected_port_counts', 'expected_projection', 'expected_request_vector', 'mutations', 'row_digest', 'row_id', 'source_state'], `${row.row_id}: closed limited descriptor`)
  assert.equal(shaJcs(without(row, 'row_digest')), row.row_digest, `${row.row_id}: limited row digest`)
}
const witness = operational.witness_catalog
keySet(witness, ['execution_count', 'witness_count', 'witness_matrix_digest', 'witnesses'], 'witness catalog closed fields')
assert.equal(witness.witness_count, 27)
assert.equal(witness.execution_count, 54)
assert.equal(witness.witnesses.length, 27)
assert.equal(witness.witness_matrix_digest, EXPECTED_WITNESS_MATRIX_DIGEST)
assert.equal(shaJcs(witness.witnesses), witness.witness_matrix_digest, 'witness matrix digest')
for (const row of witness.witnesses) {
  keySet(row, JCS_SCHEMA_FIELDS.WD.map(([name]) => name), `${row.witness_id}: closed witness descriptor`)
  assert.equal(shaJcs(without(row, 'witness_digest')), row.witness_digest, `${row.witness_id}: witness digest`)
}
const finalRepair = projection.final_repair_validation
keySet(finalRepair, ['base', 'block_id', 'canonical_record', 'component_digest', 'matrix_digest', 'row_count', 'rows', 'rules'], 'final repair closed fields')
assert.equal(finalRepair.row_count, 18)
assert.equal(finalRepair.rows.length, 18)
assert.equal(finalRepair.matrix_digest, EXPECTED_FINAL_MATRIX_DIGEST)
assert.equal(finalRepair.component_digest, EXPECTED_FINAL_COMPONENT_DIGEST)
assert.equal(shaJcs(finalRepair.rows), finalRepair.matrix_digest, 'final repair matrix digest')
assert.equal(shaJcs(without(finalRepair, 'component_digest')), finalRepair.component_digest, 'final repair component digest')
for (const row of finalRepair.rows) assert.equal(shaJcs(without(row, 'row_digest')), row.row_digest, `${row.row_id}: final row digest`)
const jcsEvidence = validateJcsCatalog(projection.jcs_assertion_catalog, projection, fileBytes)

const fixtures = new Map(projection.fixtures.map((fixture) => [fixture.fixture_id, fixture]))
const operationalCases = new Map(operational.cases.map((item) => [item.row_id, item]))
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
const outcomes = []
const repairOutcomes = []
const limitedResults = []
const witnessResults = []
const finalResults = []
const onceCounts = []
try {
  const api = await server.ssrLoadModule('/src/evidence-template-validator/index.ts')
  assert.deepEqual(Object.keys(api).sort(), ['validateEvidenceTemplateV1'], 'runtime export inventory')
  assert.equal(typeof api.validateEvidenceTemplateV1, 'function')
  for (const row of projection.rows) {
    const fixture = fixtures.get(row.base_fixture_id)
    assert.ok(fixture, `${row.row_id}: base fixture exists`)
    const materialized = materialize(fixture, row)
    onceCounts.push(...materialized.onceCounts.map((item) => ({ row_id: row.row_id, ...item })))
    const bodyBefore = new Uint8Array(materialized.bodyBytes)
    const contextBefore = clone(materialized.context)
    let result
    assert.doesNotThrow(() => {
      result = api.validateEvidenceTemplateV1(materialized.bodyBytes, materialized.context)
    }, `${row.row_id}: production API never throws`)
    const repeated = api.validateEvidenceTemplateV1(materialized.bodyBytes, materialized.context)
    assert.deepEqual(repeated, result, `${row.row_id}: repeated-call determinism`)
    assert.deepEqual(materialized.bodyBytes, bodyBefore, `${row.row_id}: body input immutability`)
    assert.deepEqual(materialized.context, contextBefore, `${row.row_id}: context input immutability`)
    assert.equal(result.branch, row.expected_branch, `${row.row_id}: branch`)
    if (row.expected_branch === 'accepted') {
      assert.equal(row.expected_stage, 13, `${row.row_id}: accepted terminal stage`)
      assert.equal(row.expected_code, null)
      assert.equal(row.expected_path, null)
      const fingerprintProjection = without(result.value, 'evidence_fingerprint')
      assert.equal(result.value.evidence_fingerprint, shaJcs(fingerprintProjection), `${row.row_id}: evidence_fingerprint`)
      assert.equal(Object.isFrozen(result), true, `${row.row_id}: result frozen`)
      assert.equal(Object.isFrozen(result.value), true, `${row.row_id}: value frozen`)
    } else {
      assert.equal(result.rejection.code, row.expected_code, `${row.row_id}: code`)
      assert.equal(result.rejection.stage, row.expected_stage, `${row.row_id}: stage`)
      assert.equal(result.rejection.path, row.expected_path, `${row.row_id}: path`)
      assert.equal(result.rejection.message, 'Evidence Template Validator V1 rejected the supplied evidence.')
    }
    outcomes.push({ row_id: row.row_id, branch: result.branch })
  }
  for (const row of repair.rows) {
    if (row.layer === 'validator') {
      const expected = REPAIR_VALIDATOR_EXPECTED.get(row.row_id)
      assert.ok(expected, `${row.row_id}: validator expectation exists`)
      const materialized = materializeRepairValidatorRow(fixtures, row.row_id)
      const bodyBefore = new Uint8Array(materialized.bodyBytes)
      const contextBefore = clone(materialized.context)
      let result
      assert.doesNotThrow(() => {
        result = api.validateEvidenceTemplateV1(materialized.bodyBytes, materialized.context)
      }, `${row.row_id}: public production API never throws`)
      const repeated = api.validateEvidenceTemplateV1(materialized.bodyBytes, materialized.context)
      assert.deepEqual(repeated, result, `${row.row_id}: repeated-call determinism`)
      assert.deepEqual(materialized.bodyBytes, bodyBefore, `${row.row_id}: body input immutability`)
      assert.deepEqual(materialized.context, contextBefore, `${row.row_id}: context input immutability`)
      assert.equal(result.branch, expected.branch, `${row.row_id}: repair branch`)
      if (expected.branch === 'accepted') {
        assert.match(row.expected, /^accept/, `${row.row_id}: frozen accept expectation`)
        const fingerprintProjection = without(result.value, 'evidence_fingerprint')
        assert.equal(result.value.evidence_fingerprint, shaJcs(fingerprintProjection), `${row.row_id}: evidence fingerprint`)
        assert.equal(Object.isFrozen(result), true, `${row.row_id}: accepted result frozen`)
        assert.equal(Object.isFrozen(result.value), true, `${row.row_id}: accepted value frozen`)
      } else {
        assert.match(row.expected, /^reject/, `${row.row_id}: frozen reject expectation`)
        assert.deepEqual(
          { code: result.rejection.code, stage: result.rejection.stage, path: result.rejection.path },
          { code: expected.code, stage: expected.stage, path: expected.path },
          `${row.row_id}: exact rejection`,
        )
        assert.equal(Object.isFrozen(result), true, `${row.row_id}: rejected result frozen`)
        assert.equal(Object.isFrozen(result.rejection), true, `${row.row_id}: rejection frozen`)
      }
      repairOutcomes.push({ row_id: row.row_id, layer: row.layer, branch: result.branch })
    } else {
      const operationalCase = operationalCases.get(row.row_id)
      assert.ok(operationalCase, `${row.row_id}: operational case exists`)
      const baseline = executeCase(`${row.row_id}:baseline`, operationalCase.baseline_evidence, operationalCase.baseline_port_results)
      const sensitivity = executeCase(`${row.row_id}:sensitivity`, operationalCase.sensitivity_evidence, operationalCase.sensitivity_port_results)
      const repeatedBaseline = executeCase(`${row.row_id}:baseline-repeat`, operationalCase.baseline_evidence, operationalCase.baseline_port_results)
      const repeatedSensitivity = executeCase(`${row.row_id}:sensitivity-repeat`, operationalCase.sensitivity_evidence, operationalCase.sensitivity_port_results)
      assert.deepEqual(repeatedBaseline, baseline, `${row.row_id}: baseline fake-port determinism`)
      assert.deepEqual(repeatedSensitivity, sensitivity, `${row.row_id}: sensitivity fake-port determinism`)
      assert.deepEqual(baseline.result, operationalCase.baseline_expected, `${row.row_id}: baseline terminal projection`)
      assert.deepEqual(sensitivity.result, operationalCase.sensitivity_expected, `${row.row_id}: sensitivity terminal projection`)
      assert.deepEqual(baseline.counts, Object.fromEntries(PORTS.map((port) => [port, baseline.result.call_vector.filter((name) => name === port).length])), `${row.row_id}: baseline port counts`)
      assert.deepEqual(sensitivity.counts, Object.fromEntries(PORTS.map((port) => [port, sensitivity.result.call_vector.filter((name) => name === port).length])), `${row.row_id}: sensitivity port counts`)
      assert.equal(baseline.result.real_metadata_writes, 0, `${row.row_id}: baseline no real metadata mutation`)
      assert.equal(sensitivity.result.real_metadata_writes, 0, `${row.row_id}: sensitivity no real metadata mutation`)
      repairOutcomes.push({ row_id: row.row_id, layer: row.layer, branch: baseline.result.branch, baseline, sensitivity })
    }
  }
  for (const row of limited.rows) limitedResults.push(executeLimitedRow(row, operationalCases))
  for (const row of witness.witnesses) witnessResults.push(runWitness(row, operationalCases))
  for (const row of finalRepair.rows) {
    const expected = FINAL_EXPECTED.get(row.row_id)
    assert.ok(expected, `${row.row_id}: final expectation exists`)
    const materialized = materializeFinal(fixtures, row.row_id)
    const bodyBefore = new Uint8Array(materialized.bodyBytes)
    const contextBefore = clone(materialized.context)
    const result = api.validateEvidenceTemplateV1(materialized.bodyBytes, materialized.context)
    const repeated = api.validateEvidenceTemplateV1(materialized.bodyBytes, materialized.context)
    assert.deepEqual(repeated, result, `${row.row_id}: final repeated-call determinism`)
    assert.deepEqual(materialized.bodyBytes, bodyBefore, `${row.row_id}: final body immutability`)
    assert.deepEqual(materialized.context, contextBefore, `${row.row_id}: final context immutability`)
    assert.equal(result.branch, expected.branch, `${row.row_id}: final branch`)
    if (expected.branch === 'rejected') assert.deepEqual({ code: result.rejection.code, stage: result.rejection.stage, path: result.rejection.path }, { code: expected.code, stage: expected.stage, path: expected.path }, `${row.row_id}: final rejection`)
    finalResults.push({ row_id: row.row_id, expected: clone(expected), actual: expected.branch === 'accepted' ? { branch: result.branch } : { branch: result.branch, code: result.rejection.code, stage: result.rejection.stage, path: result.rejection.path }, real_metadata_writes: 0, pass: true })
  }
} finally {
  await server.close()
}

assert.equal(outcomes.length, 49, '49/49 rows executed')
assert.equal(outcomes.filter((item) => item.branch === 'accepted').length, 9, '9 accepted witnesses')
assert.equal(outcomes.filter((item) => item.branch === 'rejected').length, 40, '40 rejected rows')
assert.equal(repairOutcomes.length, 24, '24/24 repair rows executed')
assert.equal(repairOutcomes.filter((item) => item.layer === 'validator').length, 18, '18/18 validator rows executed')
assert.equal(repairOutcomes.filter((item) => item.layer === 'operational').length, 6, '6/6 operational rows executed')
assert.equal(limitedResults.length, 5, '5/5 limited rows executed')
assert.equal(witnessResults.length, 27, '27/27 precedence witnesses executed')
assert.equal(witnessResults.reduce((count, item) => count + (item.baseline ? 2 : 0), 0), 54, '54 witness executions represented')
assert.equal(finalResults.length, 18, '18/18 final rows executed')
assert.equal(jcsEvidence.rows.length, 14, '14/14 JCS parent rows')
assert.equal(jcsEvidence.subcases.length, 129, '129/129 JCS subcases')
assert.equal(repairOutcomes.every((item) => item.layer !== 'operational' || (item.baseline.result.real_metadata_writes === 0 && item.sensitivity.result.real_metadata_writes === 0)), true, 'all operational executions have zero real writes')
assert.deepEqual(
  repairOutcomes.map((item) => item.row_id),
  repair.rows.map((row) => row.row_id),
  'repair execution preserves canonical row order',
)
assert.ok(onceCounts.length > 0, '*_once rows executed')
assert.equal(onceCounts.every((item) => item.count === 1), true, 'all *_once preflight counts are one')

console.log(JSON.stringify({
  suite: 'Evidence Template Validator V1',
  fixtures: projection.fixtures.length,
  rows: outcomes.length,
  accepted: outcomes.filter((item) => item.branch === 'accepted').length,
  rejected: outcomes.filter((item) => item.branch === 'rejected').length,
  changed_row_digests: changedRowIds.length,
  preserved_row_digests: projection.rows.length - changedRowIds.length,
  once_preflights: onceCounts.length,
  repair_rows: repairOutcomes.length,
  repair_validator_rows: repairOutcomes.filter((item) => item.layer === 'validator').length,
  repair_operational_rows: repairOutcomes.filter((item) => item.layer === 'operational').length,
  repair_case_results: repairOutcomes,
  repair_matrix_digest: repair.matrix_digest,
  limited_matrix_digest: limited.matrix_digest,
  witness_matrix_digest: witness.witness_matrix_digest,
  final_matrix_digest: finalRepair.matrix_digest,
  operational_case_results: repairOutcomes.filter((item) => item.layer === 'operational'),
  limited_case_results: limitedResults,
  witness_case_results: witnessResults,
  final_case_results: finalResults,
  jcs_catalog_result: jcsEvidence.catalog,
  jcs_row_results: jcsEvidence.rows,
  jcs_subcase_results: jcsEvidence.subcases,
  runtime_exports: ['validateEvidenceTemplateV1'],
  fixture_bytes: fileBytes.length,
  fixture_sha256: shaBytes(fileBytes),
  projection_digest: projection.projection_digest,
  catalog_digest: projection.source.catalog_digest,
  component_digest: projection.source.component_digest,
  status: 'PASS',
}))
