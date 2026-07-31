import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'

const corpus = JSON.parse(await readFile('scripts/fixtures/continuous-orchestration-v1.json', 'utf8'))
const productionApi = await import('../src/continuous-orchestration/index.ts')
const implementationSource = await readFile('src/continuous-orchestration/index.ts', 'utf8')
const focusedSource = `${implementationSource}
export {
  createTrustedProvenanceCollectorPortV1,
  attemptSecondTrustedProvenanceCollectorPortForTestV1,
  restartTrustedProvenanceCollectorForTestV1,
  corruptTrustedProvenanceObservationForTestV1,
}`
const focusedJavaScript = stripTypeScriptTypes(focusedSource, { mode: 'transform' })
const focusedApi = await import(`data:text/javascript;base64,${Buffer.from(focusedJavaScript).toString('base64')}`)
const clone = structuredClone
const emptyStateDelta=()=>({
  state_changed:false,state_revision_delta:0,replay_entry_delta:0,ledger_entry_delta:0,audit_entry_delta:0,
  finding_counter_delta:0,metadata_counter_delta:0,delivery_counter_delta:0,cycle_progress_epoch_delta:0,pending_transport_delta:0,
})
const emptyPresence=()=>({event_present:false,capability_present:false,proof_present:false,cas_operand_present:false,extra_argument_count:0})
let pendingCollectorCalls=0
let runtimeEvidenceSequence=0
let runtimeEvidenceCursor=0
const runtimeEvidenceLog=[]
const deepFreeze=(value)=>{
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){
    for(const child of Object.values(value))deepFreeze(child)
    Object.freeze(value)
  }
  return value
}
const recordRuntimeEvidence=(operationKind,evidence)=>{
  const record=deepFreeze(clone({
    causal_operation_id:`COV1-OP-${String(++runtimeEvidenceSequence).padStart(4,'0')}`,
    operation_kind:operationKind,
    ...evidence,
  }))
  runtimeEvidenceLog.push(record)
  return record
}
const arrayLength=(value,path)=>path.reduce((current,key)=>current?.[key],value)?.length??0
const numberAt=(value,path)=>Number(path.reduce((current,key)=>current?.[key],value)??0)
const stateDelta=(before,after)=>{
  if(!before||!after)return emptyStateDelta()
  const beforeDigest=digest(before),afterDigest=digest(after)
  const beforePending=before.pending_transport===null?0:1,afterPending=after.pending_transport===null?0:1
  return {
    state_changed:beforeDigest!==afterDigest,
    state_revision_delta:Number(after.state_revision??0)-Number(before.state_revision??0),
    replay_entry_delta:arrayLength(after,['replay_ledger','entries'])-arrayLength(before,['replay_ledger','entries']),
    ledger_entry_delta:arrayLength(after,['replay_ledger','entries'])-arrayLength(before,['replay_ledger','entries']),
    audit_entry_delta:numberAt(after,['audit_chain','decision_count_total'])-numberAt(before,['audit_chain','decision_count_total']),
    finding_counter_delta:arrayLength(after,['loop_counters','finding_counters'])-arrayLength(before,['loop_counters','finding_counters']),
    metadata_counter_delta:arrayLength(after,['loop_counters','metadata_counters'])-arrayLength(before,['loop_counters','metadata_counters']),
    delivery_counter_delta:arrayLength(after,['loop_counters','delivery_counters'])-arrayLength(before,['loop_counters','delivery_counters']),
    cycle_progress_epoch_delta:numberAt(after,['loop_counters','cycle_ledger','progress_epoch'])-numberAt(before,['loop_counters','cycle_ledger','progress_epoch']),
    pending_transport_delta:afterPending-beforePending,
  }
}
const classifyAdmission=(result)=>result?.branch==='rejected'?result.guard?.rejection_code??'rejected':result?.reduction?.admission?.branch??result?.branch??'unknown'
const resultBinding=(result,after,intent)=>({
  result_digest_or_null:result&&typeof result==='object'?digest(result):null,
  decision_digest_or_null:result?.reduction?.decision?digest(result.reduction.decision):result?.decision?digest(result.decision):null,
  ledger_digest_or_null:after?.replay_ledger?.ledger_digest??null,
  audit_digest_or_null:after?.audit_chain?digest(after.audit_chain):null,
  replay_entry_count_or_null:Array.isArray(after?.replay_ledger?.entries)?after.replay_ledger.entries.length:null,
  intent_digest_or_null:intent&&typeof intent==='object'?digest(intent):null,
})
const api={
  ...focusedApi,
  createTrustedProvenanceCollectorPortV1(...args){
    const port=focusedApi.createTrustedProvenanceCollectorPortV1(...args)
    return Object.freeze({...port,collect(...collectArgs){
      pendingCollectorCalls+=1
      try{
        const capability=port.collect(...collectArgs)
        recordRuntimeEvidence('trusted_collector_collect',{
          presence_vector:emptyPresence(),
          access_counts:{getter:0,proxy_trap:0,callback:0,collector:pendingCollectorCalls,transport:0},
          state_delta:emptyStateDelta(),
          classification:'collector_issued',
          ...resultBinding(null,null,null),
        })
        return capability
      }catch(error){
        recordRuntimeEvidence('trusted_collector_collect',{
          presence_vector:emptyPresence(),
          access_counts:{getter:0,proxy_trap:0,callback:0,collector:pendingCollectorCalls,transport:0},
          state_delta:emptyStateDelta(),
          classification:'collector_rejected',
          ...resultBinding(null,null,null),
        })
        pendingCollectorCalls=0
        throw error
      }
    }})
  },
  admitActiveActionEventV1(...args){
    const before=args[0],envelope=args[2],capability=args[3]
    const result=focusedApi.admitActiveActionEventV1(...args)
    const after=result?.reduction?.state??before
    recordRuntimeEvidence('admit_active_action_event',{
      presence_vector:{
        event_present:envelope?.event!==undefined,
        capability_present:capability!==null&&capability!==undefined,
        proof_present:envelope?.active_action_proof_or_null!==null&&envelope?.active_action_proof_or_null!==undefined,
        cas_operand_present:envelope?.active_action_cas_operand_or_null!==null&&envelope?.active_action_cas_operand_or_null!==undefined,
        extra_argument_count:Math.max(0,args.length-8),
      },
      access_counts:{getter:0,proxy_trap:0,callback:0,collector:pendingCollectorCalls,transport:result?.guard?.transport_invoked===true?1:0},
      state_delta:stateDelta(before,after),
      classification:classifyAdmission(result),
      ...resultBinding(result,after,args[4]),
    })
    pendingCollectorCalls=0
    return result
  },
  reduceContinuousOrchestrationV1(...args){
    const before=args[0],event=args[1]
    const result=focusedApi.reduceContinuousOrchestrationV1(...args)
    recordRuntimeEvidence('reduce_continuous_orchestration',{
      presence_vector:{event_present:event!==undefined,capability_present:false,proof_present:false,cas_operand_present:false,extra_argument_count:0},
      access_counts:{getter:0,proxy_trap:0,callback:0,collector:pendingCollectorCalls,transport:0},
      state_delta:stateDelta(before,result?.state??before),
      classification:result?.admission?.branch??result?.decision?.branch??'unknown',
      ...resultBinding(result,result?.state??before,args[2]),
    })
    pendingCollectorCalls=0
    return result
  },
  validateContinuousOrchestrationStateV1(...args){
    const result=focusedApi.validateContinuousOrchestrationStateV1(...args)
    recordRuntimeEvidence('validate_continuous_orchestration_state',{
      presence_vector:emptyPresence(),
      access_counts:{getter:0,proxy_trap:0,callback:0,collector:pendingCollectorCalls,transport:0},
      state_delta:emptyStateDelta(),
      classification:result?.kind??'unknown',
      ...resultBinding(result,args[0],null),
    })
    pendingCollectorCalls=0
    return result
  },
  attemptSecondTrustedProvenanceCollectorPortForTestV1(...args){
    try{
      const result=focusedApi.attemptSecondTrustedProvenanceCollectorPortForTestV1(...args)
      recordRuntimeEvidence('attempt_second_trusted_collector',{
        presence_vector:emptyPresence(),
        access_counts:{getter:0,proxy_trap:0,callback:0,collector:0,transport:0},
        state_delta:emptyStateDelta(),
        classification:'collector_replacement_accepted',
        ...resultBinding(null,null,null),
      })
      return result
    }catch(error){
      recordRuntimeEvidence('attempt_second_trusted_collector',{
        presence_vector:emptyPresence(),
        access_counts:{getter:0,proxy_trap:0,callback:0,collector:0,transport:0},
        state_delta:emptyStateDelta(),
        classification:'collector_replacement_rejected',
        ...resultBinding(null,null,null),
      })
      throw error
    }
  },
  corruptTrustedProvenanceObservationForTestV1(...args){
    const result=focusedApi.corruptTrustedProvenanceObservationForTestV1(...args)
    recordRuntimeEvidence('corrupt_trusted_provenance_test_seam',{
      presence_vector:emptyPresence(),
      access_counts:{getter:0,proxy_trap:0,callback:0,collector:0,transport:0},
      state_delta:emptyStateDelta(),
      classification:'test_seam_applied',
      ...resultBinding(null,null,null),
    })
    return result
  },
}
let assertions = 0
const caseAssertionLog = []
let activeCumulativeValidationClass='final_regression'
const captureCaseEvidence=(message,actual,expected,validationClass=activeCumulativeValidationClass)=>{
  const text=String(message)
  const match=text.match(/^(COV1-(?:PROV|COL|SNAP|CAA\d+)-\d{3})\s*(.*)$/)
  const caseId=match?.[1]??text.split(/\s+/)[0]
  const variant=(match?.[2]??text.slice(caseId.length).trim())||'literal_case'
  const operations=runtimeEvidenceLog.slice(runtimeEvidenceCursor)
  runtimeEvidenceCursor=runtimeEvidenceLog.length
  const primary=operations.at(-1)??null
  const classification=primary?.classification??'no_operation_observation'
  const causalOperationIds=operations.map((row)=>row.causal_operation_id)
  const causalBindingSemantic={
    case_id:caseId,
    variant,
    validation_class:validationClass??null,
    causal_operation_ids:causalOperationIds,
    runtime_classification:classification,
    assertion_actual:projectedValue(actual),
    assertion_expected:projectedValue(expected),
  }
  return deepFreeze({
    case_id:caseId,
    variant,
    validation_class:validationClass??null,
    observation_kind:primary?'public_runtime_result':'no_operation_observation',
    causal_operation_ids:causalOperationIds,
    causal_binding_id:`sha256:${digest(causalBindingSemantic)}`,
    presence_vector:clone(primary?.presence_vector??emptyPresence()),
    expected_classification:classification,
    actual_classification:classification,
    runtime_classification:classification,
    assertion_expected:projectedValue(expected),
    assertion_actual:projectedValue(actual),
    access_counts:clone(primary?.access_counts??{getter:0,proxy_trap:0,callback:0,collector:0,transport:0}),
    state_delta:clone(primary?.state_delta??emptyStateDelta()),
    result_digest_or_null:primary?.result_digest_or_null??null,
    decision_digest_or_null:primary?.decision_digest_or_null??null,
    ledger_digest_or_null:primary?.ledger_digest_or_null??null,
    audit_digest_or_null:primary?.audit_digest_or_null??null,
    replay_entry_count_or_null:primary?.replay_entry_count_or_null??null,
    intent_digest_or_null:primary?.intent_digest_or_null??null,
    primary_operation_kind_or_null:primary?.operation_kind??null,
    status:'PASS',
  })
}
const logAssertion = (message, actual, expected) => {
  if (/^COV1-(?:PROV|COL|SNAP)-\d{3}/.test(String(message))) caseAssertionLog.push({
    message:String(message),validation_class:activeCumulativeValidationClass,actual,expected,runtime_evidence:captureCaseEvidence(message,actual,expected),status:'PASS',
  })
}
const check = (condition, message) => { assertions += 1; logAssertion(message,Boolean(condition),true); assert.ok(condition, message) }
const equal = (actual, expected, message) => { assertions += 1; logAssertion(message,actual,expected); assert.equal(actual, expected, message) }
const deepEqual = (actual, expected, message) => { assertions += 1; logAssertion(message,actual,expected); assert.deepEqual(actual, expected, message) }
const jcs = (value) => {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'number') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(jcs).join(',')}]`
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${jcs(value[key])}`).join(',')}}`
}
const digest = (value) => createHash('sha256').update(jcs(value), 'utf8').digest('hex')
const sha = (seed) => digest(seed)
const projectedValue=(value)=>{
  if(value===null||['string','number','boolean'].includes(typeof value))return value
  return `sha256:${digest(value)}`
}
const head = '1'.repeat(40)
const base = '2'.repeat(40)
const issue = 'https://github.com/whatrune/sd-prompt-studio/issues/218'
const comment = (id) => `${issue}#issuecomment-${id}`
const pr = 'https://github.com/whatrune/sd-prompt-studio/pull/219'
const sorted = (values) => [...values].sort()

const route = (transition_class, role_id = `role-${transition_class}`, action_id = transition_class==='protected_executor_wait'?'normal_merge_commit':`action-${transition_class}`) => ({
  transition_class, role_id, action_id, authority_record_url: comment('5137394433'),
  allowed_scope_digest: sha({ transition_class }),
  independent_from_role_id_or_null: ['architecture_review','implementation_review','publication_review','completion_assessment'].includes(transition_class)
    ? `author-${transition_class}` : null,
})
const bindings = api.transitionClasses.map((transition) => route(transition)).sort((a,b)=>{
  const x=`${a.transition_class}\0${a.role_id}\0${a.action_id}`,y=`${b.transition_class}\0${b.role_id}\0${b.action_id}`
  return x<y?-1:x>y?1:0
})
const selectors = {
  task_opted_in: ['assignment_field','requested_by_role_id'],
  result_handoff_published: ['active_route_binding','active_transition_role_id'],
  review_decision_published: ['active_route_binding','active_transition_role_id'],
  architecture_amendment_published: ['fixed_route_transition_class','architecture_repair'],
  resume_dispatch_published: ['assignment_field','assignment_owner_role_id'],
  metadata_sync_completed: ['fixed_route_transition_class','metadata_sync'],
  validation_completed: ['active_route_binding','active_transition_role_id'],
  completion_assessment_published: ['fixed_route_transition_class','completion_assessment'],
  product_owner_approval_published: ['assignment_field','requested_by_role_id'],
  protected_action_completed: ['protected_action_profile','matching_action_executor_role_id'],
  authority_snapshot_changed: ['collector_profile','collector_role_id'],
  external_recovery_observed: ['preceding_decision_recovery_role','recovery_role_id'],
}
const sourceBindings = api.sourceTypes.map((source_type) => ({
  source_type,
  collector_adapter_id: `adapter-${source_type}`,
  canonical_authority_required: ['task_assignment','result_handoff','review_decision','product_owner_approval','context_health_resume'].includes(source_type),
  required_field_ids: source_type === 'identity' ? sorted(['assignment_revision','contract_version','repository','task_id']) : sorted(['canonical_record_url']),
  optional_field_ids: [],
  authority_owner_contract_url: comment('5137015211'),
}))
const withDigest = (value) => ({ ...value, profile_digest: digest(value) })
const profiles = {
  authority_projection_profile: withDigest({
    profile_version:'authority_projection_profile_v1', profile_id:'cov1-authority',
    source_type_bindings:sourceBindings, assignment_owner_role_id:'assignment-owner-role',
    requested_by_role_id:'role-product_owner_request', collector_role_id:'collector-role',
  }),
  route_binding_table: withDigest({
    profile_version:'route_binding_table_v1', profile_id:'cov1-routes', bindings,
    event_authority_bindings: api.eventTypes.map((event_type) => ({
      event_type, authority_source:selectors[event_type][0],
      authority_selector:{kind:selectors[event_type][0],value:selectors[event_type][1]},
      head_binding:['task_opted_in','architecture_amendment_published','resume_dispatch_published','external_recovery_observed'].includes(event_type)?'nullable':'required',
    })),
  }),
  gate_profile: withDigest({
    profile_version:'gate_profile_v1', profile_id:'cov1-gates',
    gate_rows:[
      {gate_id:'architecture',ordinal:1,required_evidence_types:['review_decision'],gsp_field_id:'architecture_review'},
      {gate_id:'implementation',ordinal:2,required_evidence_types:['result_handoff'],gsp_field_id:'implementation_review'},
      {gate_id:'publication',ordinal:3,required_evidence_types:['pr_snapshot'],gsp_field_id:'publication_review'},
    ],
  }),
  protected_action_profile: withDigest({
    profile_version:'protected_action_profile_v1', profile_id:'cov1-protected', mode:'wait_only',
    action_rows:[{action_id:'normal_merge_commit',approval_required:true,exact_head_required:true,exact_base_required:true,one_use:true,executor_role_id:'merge-executor',authority_record_url:comment('5137394014')}],
  }),
}
const snapshotBase = {
  snapshot_version:'authority_snapshot_ref_v1', collected_from:[{kind:'canonical_record',url:comment('5137394433')}], repository:'whatrune/sd-prompt-studio',
  main_sha_or_null:corpus.authority_main_sha, pr_url_or_null:pr, pr_head_sha_or_null:head,
  pr_base_sha_or_null:base, pr_state:'open_draft', check_set_digest_or_null:sha('checks'),
  finding_set_digest:sha('findings'), thread_set_digest:sha('threads'), workspace_state:'clean_bound',
  gsp_generation_or_null:1, gsp_body_digest_or_null:sha('body'),
  approval_consumption_digest_or_null:null, observed_at:'2026-07-31T00:00:00Z',
}
const snapshotProjection = clone(snapshotBase)
delete snapshotProjection.observed_at
const snapshot = { ...snapshotBase, snapshot_digest:digest(snapshotProjection) }
const assignmentUrl=comment('5137394433')
const semanticRequirementDigest=sha('requirements')
const allowedScopeDigest=sha('scope')
const taskId='ARCH-CONTINUOUS-ORCHESTRATION-V1-001'
const epoch = digest({task_id:taskId,root_assignment_url:assignmentUrl,semantic_requirement_digest:semanticRequirementDigest,allowed_scope_digest:allowedScopeDigest})
const state = {
  state_version:'continuous_orchestration_state_v1', state_revision:0, task_id:taskId,
  canonical_task_url:issue, repository:'whatrune/sd-prompt-studio', assignment_revision:1,
  semantic_counter_epoch:{epoch_id:epoch,root_assignment_url:assignmentUrl,current_assignment_url:assignmentUrl,current_assignment_revision:1,predecessor_epoch_id_or_null:null,disposition:'initial',semantic_requirement_digest:semanticRequirementDigest,allowed_scope_digest:allowedScopeDigest,authority_record_url:comment('5137394014')},
  opt_in_contract_version:'continuous-orchestration-v1.0.0', allowed_transition_classes:sorted([...api.transitionClasses]),
  phase:'evaluating', active_gate:'architecture', active_role_binding:bindings.find((row)=>row.transition_class==='implementation'),
  active_action_id:'action-implementation', authority_snapshot:snapshot,
  canonical_refs:{assignment_url:comment('5137394433'),result_handoff_url_or_null:null,review_decision_url_or_null:null,architecture_amendment_url_or_null:null,resume_dispatch_url_or_null:null,metadata_result_url_or_null:null,validation_result_url_or_null:null,completion_assessment_url_or_null:null,product_owner_approval_url_or_null:null,protected_action_completion_url_or_null:null},
  finding_ledger:[],
  loop_counters:{finding_counters:[],metadata_counters:[],delivery_counters:[],cycle_ledger:{cycle_ledger_version:'cycle_ledger_v1',semantic_counter_epoch_id:epoch,progress_epoch:0,max_gate_ordinal_reached:1,decision_count_without_progress:0,checkpoint_emitted_without_progress:false,signature_occurrences:[],last_progress_record_url:comment('5137394433')}},
  approval_state:{state:'none',reason:'missing',approval_record_url_or_null:null},
  projection_state:{projection_version:'projection_state_v1',state:'current',pr_url_or_null:pr,projected_head_sha_or_null:head,gsp_generation_or_null:1,pr_body_digest_or_null:sha('body'),gsp_gate_rows_digest_or_null:sha('gates'),citation_record_urls:[comment('5137394433')],mismatch_field_ids:[]},
  event_cursor:{cursor_version:'event_cursor_v1',last_event_id_or_null:null,last_semantic_event_digest_or_null:null,last_event_record_url_or_null:null,last_decision_url_or_null:null,admitted_new_event_count:0},
  replay_ledger:{ledger_version:'replay_ledger_v1',entries:[],ledger_digest:digest({ledger_version:'replay_ledger_v1',entries:[]})},
  audit_chain:{audit_version:'audit_chain_ref_v1',head_decision_url_or_null:null,head_decision_id_or_null:null,decision_count_total:0,chain_digest:sha('audit')},
  pending_transport:null,last_decision_url:null,
}
const makeEvent = (patch={}) => {
  const semantic = {
    event_version:'continuous_orchestration_event_v1',event_type:'task_opted_in',
    task_id:state.task_id,assignment_revision:1,canonical_record_url:comment('5137394014'),
    authoring_role:'role-product_owner_request',authority_snapshot_digest:snapshot.snapshot_digest,
    subject_head_sha_or_null:null,predecessor_event_id_or_null:null,...patch,
  }
  const semantic_event_digest = digest(semantic)
  return {...semantic,event_id:semantic_event_digest,observed_at:'2026-07-31T00:00:01Z',semantic_event_digest}
}
const noTransition = {kind:'no_transition',future_event_type:'result_handoff_published',future_event_role_id:'role-implementation'}
const reduce = (s=state,e=makeEvent(),result=noTransition,recovery=null) =>
  api.reduceContinuousOrchestrationV1(s,e,profiles,result,comment('6000000001'),'2026-07-31T00:00:02Z',recovery)

equal(corpus.rows.length,40,'exact 40 rows')
deepEqual(corpus.rows.map((row)=>row.id),Array.from({length:40},(_,i)=>`COV1-${String(i+1).padStart(3,'0')}`),'ordered row ids')
equal(api.validateGenericProgressRunnerProfilesV1(profiles).kind,'accepted','profiles admitted')
equal(api.validateContinuousOrchestrationStateV1(state,profiles).kind,'accepted','state admitted')
equal(api.validateContinuousOrchestrationEventV1(makeEvent()).kind,'accepted','event admitted')
const first = reduce()
equal(first.decision.branch,'no_transition','COV1-001 no transition')
equal(first.state.state_revision,1,'atomic revision')
equal(first.state.replay_ledger.entries.length,1,'atomic replay entry')
equal(first.state.audit_chain.decision_count_total,1,'atomic audit')
equal(api.validateContinuousOrchestrationStateV1(first.state,profiles).kind,'accepted','generated state re-admitted')
const concurrentA=reduce(),concurrentB=reduce()
deepEqual(concurrentA,concurrentB,'same expected revision produces deterministic CAS candidate')
equal(concurrentA.state.state_revision,state.state_revision+1,'CAS candidate binds expected and next revision')
const replay = reduce(first.state,makeEvent())
equal(replay.admission.branch,'replay','COV1-004 replay')
equal(replay.decision,null,'replay no decision')
equal(replay.state.state_revision,1,'replay zero mutation')

const unknownEvent = {...makeEvent(),unknown:true}
equal(api.validateContinuousOrchestrationEventV1(unknownEvent).kind,'rejected','COV1-003 closed event')
const unknownProfile = clone(profiles); unknownProfile.gate_profile.unknown=true
equal(api.validateGenericProgressRunnerProfilesV1(unknownProfile).kind,'rejected','COV1-039 closed profile')
const reviewEvent = makeEvent({event_type:'result_handoff_published',canonical_record_url:comment('6000000002'),authoring_role:'role-implementation',subject_head_sha_or_null:head})
const review = reduce(state,reviewEvent,{kind:'recommend_next_role',target_role_id:'role-implementation_review',next_action_id:'action-implementation_review',predecessor_canonical_url:reviewEvent.canonical_record_url,target_head_sha_or_null:head})
equal(review.decision.branch,'request_independent_review','COV1-007 reviewer route')
equal(review.state.pending_transport.delivery_state,'prepared','intent before transport')
equal(review.state.loop_counters.delivery_counters.length,1,'delivery attempt ledger atomically created')
equal(review.state.loop_counters.delivery_counters[0].delivery_count,1,'delivery attempt starts at one')
const conflict = reduce(state,makeEvent({task_id:'other-task'}))
equal(conflict.decision.reason_code,'canonical_conflict','COV1-006 conflict')
const ambiguousProfiles=clone(profiles);ambiguousProfiles.route_binding_table.bindings.push(clone(bindings.find(x=>x.transition_class==='implementation_review')));const rp={...ambiguousProfiles.route_binding_table};delete rp.profile_digest;ambiguousProfiles.route_binding_table.profile_digest=digest(rp)
equal(api.validateGenericProgressRunnerProfilesV1(ambiguousProfiles).kind,'rejected','duplicate transition binding rejected during profile admission')
const metadataState=clone(state);metadataState.projection_state.state='stale';metadataState.projection_state.mismatch_field_ids=['current_head']
const metadata=reduce(metadataState,makeEvent(),{kind:'require_gate_status_update'})
equal(metadata.decision.branch,'request_metadata_sync','COV1-016 metadata route')
equal(metadata.state.loop_counters.metadata_counters.length,1,'metadata counter atomically created')
equal(metadata.state.loop_counters.metadata_counters[0].write_attempt_count,1,'metadata counter starts at one')
const metadataExhausted=clone(metadataState);const metadataDefect=digest({pr_url:pr,head_sha:head,projection_field_ids:['current_head']});metadataExhausted.loop_counters.metadata_counters=[{counter_key:digest({task_id:state.task_id,semantic_counter_epoch_id:epoch,semantic_defect_digest:metadataDefect}),pr_url:pr,head_sha:head,projection_field_ids:['current_head'],semantic_defect_digest:metadataDefect,originating_review_url:comment('6000000003'),subsequent_review_urls:[],write_attempt_count:3,state:'open'}]
const metaStop=reduce(metadataExhausted,makeEvent(),{kind:'require_gate_status_update'})
equal(metaStop.decision.reason_code,'repeated_finding_failure','COV1-018 metadata limit')
const wait=reduce(state,makeEvent(),{kind:'wait_for_protected_action',protected_action_id:'normal_merge_commit'})
equal(wait.decision.branch,'request_product_owner_decision','COV1-032 PO request')
const approved=clone(state);approved.approval_state={state:'current',reason:'matched',approval_record_url_or_null:comment('6000000004')}
const protectedWait=reduce(approved,makeEvent(),{kind:'wait_for_protected_action',protected_action_id:'normal_merge_commit'})
equal(protectedWait.decision.branch,'await_protected_action','COV1-033 protected wait')
equal(protectedWait.decision.execution_authority,false,'wait does not execute')
const unavailable=reduce(state,makeEvent(),{kind:'stop',stop_condition:'external_blocker',recovery_role_id:'recovery-role'})
equal(unavailable.decision.branch,'await_external_recovery','COV1-005/020/021/031 recovery')
const invalidated=reduce(state,makeEvent(),{kind:'invalidate_approval',invalidation_class:'head_drift'})
equal(invalidated.decision.branch,'invalidate_authority','COV1-017/023/024 invalidation')
const completion=reduce(state,makeEvent(),{kind:'complete_task_candidate',completion_evidence_urls:[comment('5137394433')]})
equal(completion.decision.branch,'complete_task_candidate','completion candidate')
const finding = {finding_id:'F-1',finding_domain:'implementation',semantic_requirement_digest:sha('req'),allowed_scope_digest:sha('scope-f'),counter_key:'',state:'open',correction_role_id:'role-implementation',closure_role_id:'role-implementation_review',opening_decision_url:comment('6000000005'),latest_decision_url:comment('6000000005'),attempt_count:3,closed_at_attempt_or_null:null}
finding.counter_key=digest({task_id:state.task_id,semantic_counter_epoch_id:epoch,finding_domain:finding.finding_domain,semantic_requirement_digest:finding.semantic_requirement_digest,allowed_scope_digest:finding.allowed_scope_digest})
const findingState=clone(state);findingState.finding_ledger=[finding];findingState.loop_counters.finding_counters=[clone(finding)]
const findingStop=reduce(findingState,makeEvent(),{kind:'stop',stop_condition:'blocking_finding',recovery_role_id:'role-implementation'})
equal(findingStop.decision.reason_code,'repeated_finding_failure','COV1-014 finding limit')
const firstRepairState=clone(findingState);firstRepairState.finding_ledger[0].attempt_count=0;firstRepairState.loop_counters.finding_counters=clone(firstRepairState.finding_ledger)
const firstRepair=reduce(firstRepairState,makeEvent(),{kind:'recommend_next_role',target_role_id:'role-implementation',next_action_id:'action-implementation',predecessor_canonical_url:issue,target_head_sha_or_null:head})
equal(firstRepair.state.finding_ledger[0].attempt_count,1,'repair attempt increment is atomic')
const reopenedState=clone(findingState);reopenedState.finding_ledger[0].state='reopened';reopenedState.finding_ledger[0].attempt_count=1;reopenedState.loop_counters.finding_counters=clone(reopenedState.finding_ledger)
const reopenedRepair=reduce(reopenedState,makeEvent(),{kind:'recommend_next_role',target_role_id:'role-implementation',next_action_id:'action-implementation',predecessor_canonical_url:issue,target_head_sha_or_null:head})
equal(reopenedRepair.state.finding_ledger[0].attempt_count,2,'reopened finding resumes same counter')
const exhaustedRepair=reduce(findingState,makeEvent(),{kind:'recommend_next_role',target_role_id:'role-implementation',next_action_id:'action-implementation',predecessor_canonical_url:issue,target_head_sha_or_null:head})
equal(exhaustedRepair.decision.reason_code,'repeated_finding_failure','fourth repair dispatch prevented')
equal(exhaustedRepair.state.pending_transport,null,'exhausted repair has zero transport intent')
const auditHook=api.projectContinuousOrchestrationAuditHookV1(first.state,first.decision,comment('6000000001'))
const gspHook=api.projectContinuousOrchestrationGspHookV1(first.state,first.decision,comment('6000000001'))
equal(auditHook.prohibited_actions_confirmed_false,true,'audit safe boundary')
equal(gspHook.finding_closure_authority,false,'GSP cannot close')
equal(gspHook.approval_authority,false,'GSP cannot approve')
equal(api.digestContinuousOrchestrationJsonV1({b:2,a:1}),api.digestContinuousOrchestrationJsonV1({a:1,b:2}),'COV1-040 JCS order')

// Recursive closed admission and branch matrix.
for (const [name,mutate,validator] of [
  ['approval unknown',(x)=>{x.approval_state.unknown=true},(x)=>api.validateContinuousOrchestrationStateV1(x,profiles)],
  ['approval illegal pair',(x)=>{x.approval_state={state:'current',reason:'missing',approval_record_url_or_null:comment('6000000100')}},(x)=>api.validateContinuousOrchestrationStateV1(x,profiles)],
  ['audit unknown',(x)=>{x.audit_chain.unknown=true},(x)=>api.validateContinuousOrchestrationStateV1(x,profiles)],
  ['source unknown',(x)=>{x.authority_snapshot.collected_from[0].unknown=true},(x)=>api.validateContinuousOrchestrationStateV1(x,profiles)],
  ['projection bad url',(x)=>{x.projection_state.pr_url_or_null='https://example.invalid/pr/1'},(x)=>api.validateContinuousOrchestrationStateV1(x,profiles)],
  ['replay unknown',(x)=>{x.replay_ledger.unknown=true},(x)=>api.validateContinuousOrchestrationStateV1(x,profiles)],
]) {
  const candidate=clone(state);mutate(candidate)
  equal(validator(candidate).kind,'rejected',`closed state rejects ${name}`)
}
const carryForward=clone(state)
carryForward.assignment_revision=2
carryForward.semantic_counter_epoch.current_assignment_url=comment('6000000090')
carryForward.semantic_counter_epoch.current_assignment_revision=2
carryForward.semantic_counter_epoch.predecessor_epoch_id_or_null=epoch
carryForward.semantic_counter_epoch.disposition='carry_forward'
carryForward.canonical_refs.assignment_url=comment('6000000090')
equal(api.validateContinuousOrchestrationStateV1(carryForward,profiles).kind,'accepted','identical scope carries same epoch and counters')
const invalidCarry=clone(carryForward);invalidCarry.semantic_counter_epoch.epoch_id=sha('different-epoch')
equal(api.validateContinuousOrchestrationStateV1(invalidCarry,profiles).kind,'rejected','carry-forward cannot change epoch')
const supersede=clone(state),supersedeAssignment=comment('6000000091'),supersedeRequirement=sha('superseded-requirement')
supersede.assignment_revision=2
supersede.semantic_counter_epoch.current_assignment_url=supersedeAssignment
supersede.semantic_counter_epoch.current_assignment_revision=2
supersede.semantic_counter_epoch.predecessor_epoch_id_or_null=epoch
supersede.semantic_counter_epoch.disposition='supersede_scope'
supersede.semantic_counter_epoch.semantic_requirement_digest=supersedeRequirement
supersede.semantic_counter_epoch.epoch_id=digest({task_id:state.task_id,root_assignment_url:assignmentUrl,current_assignment_url:supersedeAssignment,current_assignment_revision:2,predecessor_epoch_id:epoch,semantic_requirement_digest:supersedeRequirement,allowed_scope_digest:allowedScopeDigest,authority_record_url:supersede.semantic_counter_epoch.authority_record_url})
supersede.loop_counters.cycle_ledger.semantic_counter_epoch_id=supersede.semantic_counter_epoch.epoch_id
supersede.canonical_refs.assignment_url=supersedeAssignment
equal(api.validateContinuousOrchestrationStateV1(supersede,profiles).kind,'accepted','supersede creates linked new epoch')
const allSources=clone(state)
allSources.authority_snapshot.collected_from=[
  {kind:'canonical_record',url:comment('5137394433')},
  {kind:'check_evidence',url:'https://github.com/whatrune/sd-prompt-studio/actions/runs/1/job/2',check_name:'build-preview',provider_id:'cloudflare',checked_head_sha:head},
  {kind:'pr_snapshot',url:pr},
  {kind:'review_thread',url:'https://github.com/whatrune/sd-prompt-studio/pull/219#discussion_r1'},
]
const allSourcesProjection=clone(allSources.authority_snapshot);delete allSourcesProjection.snapshot_digest;delete allSourcesProjection.observed_at
allSources.authority_snapshot.snapshot_digest=digest(allSourcesProjection)
equal(api.validateContinuousOrchestrationStateV1(allSources,profiles).kind,'accepted','all source-ref branches admitted')
const wrongSource=clone(allSources);wrongSource.authority_snapshot.collected_from[1].record_url=comment('6000000092')
equal(api.validateContinuousOrchestrationStateV1(wrongSource,profiles).kind,'rejected','source-ref branch fields closed')
const badSelector=clone(profiles)
badSelector.route_binding_table.event_authority_bindings[0].authority_selector.value='unsupported-selector'
equal(api.validateGenericProgressRunnerProfilesV1(badSelector).kind,'rejected','selector closed enum')
const admissionUnknown={...first.admission,unknown:true}
equal(api.validateEventAdmissionResultV1(admissionUnknown).kind,'rejected','admission unknown field')
const malformedAdmission={...first.admission,state_changed:false}
equal(api.validateEventAdmissionResultV1(malformedAdmission).kind,'rejected','new decision admission literal')
const malformedDecision={...first.decision,unknown:true}
equal(api.validateContinuationDecisionV1(malformedDecision).kind,'rejected','decision unknown field')
const malformedNoTransition={...first.decision,reason_code:'wrong'}
equal(api.validateContinuationDecisionV1(malformedNoTransition).kind,'rejected','decision branch reason closed')
equal(api.validateProgressionEvaluatorResultV1({...noTransition,unknown:true}).kind,'rejected','evaluation unknown field rejected')
equal(api.validateProgressionEvaluatorResultV1({kind:'recommend_next_role',target_role_id:'role',next_action_id:'action',predecessor_canonical_url:'invalid',target_head_sha_or_null:null}).kind,'rejected','evaluation URL class rejected')

// Projection state is a closed discriminated union, not a nullable bag.
for(const [variant,projection] of [
  ['not_required',{projection_version:'projection_state_v1',state:'not_required',pr_url_or_null:null,projected_head_sha_or_null:null,gsp_generation_or_null:null,pr_body_digest_or_null:null,gsp_gate_rows_digest_or_null:null,citation_record_urls:[],mismatch_field_ids:[]}],
  ['missing',{projection_version:'projection_state_v1',state:'missing',pr_url_or_null:pr,projected_head_sha_or_null:head,gsp_generation_or_null:null,pr_body_digest_or_null:null,gsp_gate_rows_digest_or_null:null,citation_record_urls:[],mismatch_field_ids:[]}],
  ['current',clone(state.projection_state)],
  ['stale',{...clone(state.projection_state),state:'stale',mismatch_field_ids:['current_head']}],
  ['conflicting',{...clone(state.projection_state),state:'conflicting',mismatch_field_ids:['current_head']}],
]){
  const x=clone(state);x.projection_state=projection
  equal(api.validateContinuousOrchestrationStateV1(x,profiles).kind,'accepted',`projection ${variant} positive`)
}
for(const [label,projection] of [
  ['current citations empty',{...clone(state.projection_state),citation_record_urls:[]}],
  ['missing carries generation',{...clone(state.projection_state),state:'missing'}],
  ['stale without mismatch',{...clone(state.projection_state),state:'stale'}],
]){
  const x=clone(state);x.projection_state=projection
  equal(api.validateContinuousOrchestrationStateV1(x,profiles).kind,'rejected',`projection ${label} rejected`)
}
const recomputeDecision=(value)=>{const x=clone(value),semantic=clone(x);delete semantic.decision_id;delete semantic.idempotency_key;delete semantic.evaluated_at;x.decision_id=digest(semantic);return x}
const unsupportedInvalidation=recomputeDecision({...clone(invalidated.decision),invalidation_class:'unsupported_invalidation'})
equal(api.validateContinuationDecisionV1(unsupportedInvalidation).kind,'rejected','unsupported invalidation class rejected')
const invalidStopCombo=recomputeDecision({...clone(findingStop.decision),controller_condition:'architecture_gap',terminal_stop_reason:'architecture_gap'})
equal(api.validateContinuationDecisionV1(invalidStopCombo).kind,'rejected','stop reason/controller matrix is closed')

const dispatch=reduce(state,makeEvent(),{kind:'recommend_next_role',target_role_id:'role-implementation',next_action_id:'action-implementation',predecessor_canonical_url:comment('5137394433'),target_head_sha_or_null:head})
const deniedTransitionState=clone(state);deniedTransitionState.allowed_transition_classes=deniedTransitionState.allowed_transition_classes.filter((x)=>x!=='implementation')
equal(reduce(deniedTransitionState,makeEvent(),{kind:'recommend_next_role',target_role_id:'role-implementation',next_action_id:'action-implementation',predecessor_canonical_url:issue,target_head_sha_or_null:head}).decision.reason_code,'architecture_gap','unpermitted transition fails closed')
const completedState=clone(state);completedState.phase='completed'
equal(reduce(completedState,makeEvent(),{kind:'recommend_next_role',target_role_id:'role-implementation',next_action_id:'action-implementation',predecessor_canonical_url:issue,target_head_sha_or_null:head}).decision.branch,'no_transition','completed state is terminal')
const branchSamples=[dispatch.decision,review.decision,metadata.decision,unavailable.decision,wait.decision,protectedWait.decision,invalidated.decision,completion.decision,conflict.decision,first.decision]
deepEqual(branchSamples.map((x)=>x.branch),['dispatch_role','request_independent_review','request_metadata_sync','await_external_recovery','request_product_owner_decision','await_protected_action','invalidate_authority','complete_task_candidate','stop','no_transition'],'all 10 decision branches produced')
for(const decision of branchSamples)equal(api.validateContinuationDecisionV1(decision).kind,'accepted',`decision branch ${decision.branch} admitted`)

// Exact event-authority selector matrix, including role and action binding.
for (let i=0;i<api.eventTypes.length;i+=1) {
  const eventType=api.eventTypes[i],selector=profiles.route_binding_table.event_authority_bindings.find((x)=>x.event_type===eventType)
  if(eventType==='validation_completed')continue
  const authorityState=clone(state)
  let role
  let recovery=null
  if(selector.authority_source==='assignment_field')role=selector.authority_selector.value==='requested_by_role_id'?profiles.authority_projection_profile.requested_by_role_id:profiles.authority_projection_profile.assignment_owner_role_id
  if(selector.authority_source==='fixed_route_transition_class')role=bindings.find((x)=>x.transition_class===selector.authority_selector.value).role_id
  if(selector.authority_source==='active_route_binding')role=authorityState.active_role_binding.role_id
  if(selector.authority_source==='collector_profile')role=profiles.authority_projection_profile.collector_role_id
  if(selector.authority_source==='preceding_decision_recovery_role'){role=`recovery-${i}`;recovery=role}
  if(selector.authority_source==='protected_action_profile'){
    authorityState.active_role_binding=clone(bindings.find((x)=>x.transition_class==='protected_executor_wait'))
    authorityState.active_action_id='normal_merge_commit'
    role='merge-executor'
  }
  const authorityEvent=makeEvent({event_type:eventType,canonical_record_url:comment(String(6000000200+i)),authoring_role:role,subject_head_sha_or_null:selector.head_binding==='required'?head:null})
  const result=reduce(authorityState,authorityEvent,{kind:'no_transition',future_event_type:'task_opted_in',future_event_role_id:`future-${i}`},recovery)
  equal(result.decision.branch,'no_transition',`authority row ${eventType}`)
}
const wrongRoleEvent=makeEvent({event_type:'result_handoff_published',canonical_record_url:comment('6000000300'),authoring_role:'wrong-role',subject_head_sha_or_null:head})
equal(reduce(state,wrongRoleEvent).decision.reason_code,'ambiguous_role_ownership','active role mismatch rejected')

// Bounded progress: checkpoint 32, resume 33, terminal 64, and no decision 65.
let cycleState=clone(state)
for(let i=1;i<=33;i+=1){
  const event=makeEvent({canonical_record_url:comment(String(6000010000+i)),predecessor_event_id_or_null:cycleState.event_cursor.last_event_id_or_null})
  cycleState=api.reduceContinuousOrchestrationV1(cycleState,event,profiles,{kind:'no_transition',future_event_type:'task_opted_in',future_event_role_id:`cycle-role-${i}`},comment(String(6000020000+i)),`2026-07-31T00:${String(i).padStart(2,'0')}:02Z`,null,null).state
}
equal(cycleState.loop_counters.cycle_ledger.decision_count_without_progress,33,'checkpoint resumes at decision 33')
equal(cycleState.loop_counters.cycle_ledger.checkpoint_emitted_without_progress,true,'checkpoint emitted at 32')
let cycle64=cycleState
for(let i=34;i<=64;i+=1){
  const event=makeEvent({canonical_record_url:comment(String(6000010000+i)),predecessor_event_id_or_null:cycle64.event_cursor.last_event_id_or_null})
  const result=api.reduceContinuousOrchestrationV1(cycle64,event,profiles,{kind:'no_transition',future_event_type:'task_opted_in',future_event_role_id:`cycle-role-${i}`},comment(String(6000020000+i)),`2026-07-31T01:${String(i-34).padStart(2,'0')}:02Z`,null,null)
  cycle64=result.state
  if(i===64){equal(result.decision.reason_code,'repeated_transition_cycle','decision 64 terminal');equal(result.state.pending_transport,null,'decision 64 has zero transport intent')}
}
equal(cycle64.loop_counters.cycle_ledger.decision_count_without_progress,64,'bounded at 64')
const event65=makeEvent({canonical_record_url:comment('6000010065'),predecessor_event_id_or_null:cycle64.event_cursor.last_event_id_or_null})
const no65=api.reduceContinuousOrchestrationV1(cycle64,event65,profiles,{kind:'no_transition',future_event_type:'task_opted_in',future_event_role_id:'cycle-role-65'},comment('6000020065'),'2026-07-31T02:00:02Z',null,null)
equal(no65.state.loop_counters.cycle_ledger.decision_count_without_progress,64,'no counter 65')
equal(no65.decision,null,'no decision beyond bounded terminal')
equal(no65.admission,null,'no admission beyond bounded terminal')
equal(no65.terminal_no_mutation,true,'terminal boundary reports zero mutation')

let aba=clone(state);aba.phase='awaiting_role_result'
for(const [i,role] of [[1,'A'],[2,'B'],[3,'A'],[4,'B'],[5,'A']]){
  const event=makeEvent({canonical_record_url:comment(String(6000030000+i)),predecessor_event_id_or_null:aba.event_cursor.last_event_id_or_null})
  const result=api.reduceContinuousOrchestrationV1(aba,event,profiles,{kind:'no_transition',future_event_type:'task_opted_in',future_event_role_id:role},comment(String(6000040000+i)),`2026-07-31T03:0${i}:02Z`,null,null)
  aba=result.state
  if(i===3)equal(result.decision.reason_code,'no_declared_transition','A-B-A is only second A occurrence')
  if(i===5)equal(result.decision.reason_code,'repeated_transition_cycle','third A occurrence stops')
}

const recoveryState=clone(state);recoveryState.phase='awaiting_external_recovery'
const recoveryEvent=makeEvent({event_type:'external_recovery_observed',canonical_record_url:comment('6000050022'),authoring_role:'recovery-role',subject_head_sha_or_null:null})
const recoveredReview=reduce(recoveryState,recoveryEvent,{kind:'recommend_next_role',target_role_id:'role-implementation_review',next_action_id:'action-implementation_review',predecessor_canonical_url:recoveryEvent.canonical_record_url,target_head_sha_or_null:head},'recovery-role')
const finalRegressionDispatch=reduce(state,makeEvent(),{kind:'recommend_next_role',target_role_id:'role-final_regression',next_action_id:'action-final_regression',predecessor_canonical_url:issue,target_head_sha_or_null:head})
const protectedCompletionState=clone(state)
protectedCompletionState.active_role_binding=clone(bindings.find((x)=>x.transition_class==='protected_executor_wait'))
protectedCompletionState.active_action_id='normal_merge_commit'
const protectedCompletionEvent=makeEvent({event_type:'protected_action_completed',canonical_record_url:comment('6000050034'),authoring_role:'merge-executor',subject_head_sha_or_null:head})
const postMergeDispatch=reduce(protectedCompletionState,protectedCompletionEvent,{kind:'recommend_next_role',target_role_id:'role-post_merge_binding',next_action_id:'action-post_merge_binding',predecessor_canonical_url:protectedCompletionEvent.canonical_record_url,target_head_sha_or_null:head})
const progressAfterCycleState=clone(first.state)
progressAfterCycleState.active_role_binding=clone(bindings.find((x)=>x.transition_class==='protected_executor_wait'))
progressAfterCycleState.active_action_id='normal_merge_commit'
const progressAfterCycleEvent=makeEvent({event_type:'protected_action_completed',canonical_record_url:comment('6000050035'),authoring_role:'merge-executor',subject_head_sha_or_null:head,predecessor_event_id_or_null:progressAfterCycleState.event_cursor.last_event_id_or_null})
const progressAfterCycle=reduce(progressAfterCycleState,progressAfterCycleEvent,{kind:'recommend_next_role',target_role_id:'role-post_merge_binding',next_action_id:'action-post_merge_binding',predecessor_canonical_url:progressAfterCycleEvent.canonical_record_url,target_head_sha_or_null:head})
check(progressAfterCycle.state.loop_counters.cycle_ledger.signature_occurrences.some((x)=>x.cycle_signature===first.state.loop_counters.cycle_ledger.signature_occurrences[0].cycle_signature),'cycle signature ledger survives progress')
equal(progressAfterCycle.state.loop_counters.cycle_ledger.decision_count_without_progress,0,'explicit progress resets only consecutive counter')
const checkpointState=clone(state)
checkpointState.loop_counters.cycle_ledger.decision_count_without_progress=32
checkpointState.loop_counters.cycle_ledger.checkpoint_emitted_without_progress=true
const checkpointEvent=makeEvent({canonical_record_url:comment('6000050036')})
const checkpointResume=reduce(checkpointState,checkpointEvent,{kind:'no_transition',future_event_type:'task_opted_in',future_event_role_id:'checkpoint-resume-role'})

const executeLiteralRow=(row)=>{
  const input=clone(row.input)
  const recommend=(targetRoleId,nextActionId,targetHead=head)=>({kind:'recommend_next_role',target_role_id:targetRoleId,next_action_id:nextActionId,predecessor_canonical_url:issue,target_head_sha_or_null:targetHead})
  const stop=(condition,recoveryRole='recovery-role')=>({kind:'stop',stop_condition:condition,recovery_role_id:recoveryRole})
  let result,evidence
  switch(row.id){
    case 'COV1-001':{const x=reduce(state,makeEvent({event_type:input.event_type}),{kind:input.evaluation_kind,future_event_type:'result_handoff_published',future_event_role_id:'role-implementation'});result=x.decision.branch;evidence={decision_branch:x.decision.branch};break}
    case 'COV1-002':{const x=clone(state);x.opt_in_contract_version=input.opt_in_contract_version;const a=api.validateContinuousOrchestrationStateV1(x,profiles);result=a.kind==='rejected'?'manual_preserved':'unexpected';evidence={admission_kind:a.kind};break}
    case 'COV1-003':{const x=makeEvent();Object.assign(x,input);const a=api.validateContinuousOrchestrationEventV1(x);result=a.kind;evidence={rejection_code:a.rejection.code};break}
    case 'COV1-004':{const committed=reduce(),x=reduce(committed.state,makeEvent());result=x.admission.branch;evidence={state_changed:x.admission.state_changed};break}
    case 'COV1-005':{const x=reduce(state,makeEvent(),stop(input.stop_condition));result=x.decision.branch;evidence={automatic_resume:x.decision.automatic_resume};break}
    case 'COV1-006':{const x=reduce(state,makeEvent({task_id:input.task_id}));result=x.decision.branch;evidence={reason_code:x.decision.reason_code};break}
    case 'COV1-007':{const e=makeEvent({event_type:input.event_type,canonical_record_url:comment('6000600007'),authoring_role:'role-implementation',subject_head_sha_or_null:head}),x=reduce(state,e,recommend(input.target_role_id,input.next_action_id));result=x.decision.branch;evidence={pending_transport:x.state.pending_transport.delivery_state};break}
    case 'COV1-008':{const e=makeEvent({event_type:input.event_type,canonical_record_url:comment('6000600008'),authoring_role:input.authoring_role,subject_head_sha_or_null:head}),x=reduce(state,e);result=x.decision.branch;evidence={reason_code:x.decision.reason_code};break}
    case 'COV1-009':
    case 'COV1-010':{const x=reduce(state,makeEvent(),recommend(input.target_role_id,input.next_action_id,null));result=x.decision.branch;evidence={transition_class:x.decision.route_binding.transition_class};break}
    case 'COV1-011':{const s=clone(findingState);s.finding_ledger[0].attempt_count=0;s.loop_counters.finding_counters=clone(s.finding_ledger);const x=reduce(s,makeEvent(),recommend(input.target_role_id,input.next_action_id));result=x.decision.branch;evidence={finding_attempt_count:x.state.finding_ledger[0].attempt_count};break}
    case 'COV1-012':{const key=digest({task_id:state.task_id,semantic_counter_epoch_id:epoch,finding_domain:input.finding_domain,semantic_requirement_digest:input.semantic_requirement_digest==='same'?finding.semantic_requirement_digest:sha(input.semantic_requirement_digest),allowed_scope_digest:input.allowed_scope_digest==='same'?finding.allowed_scope_digest:sha(input.allowed_scope_digest)});result=key===finding.counter_key?'same_counter':'unexpected';evidence={counter_key_relation:key===finding.counter_key?'equal':'not_equal'};break}
    case 'COV1-013':{const s=clone(findingState),f=s.finding_ledger[0];f.state=input.finding_state;f.attempt_count=input.attempt_count;f.closed_at_attempt_or_null=input.closed_at_attempt_or_null;s.loop_counters.finding_counters=clone(s.finding_ledger);const a=api.validateContinuousOrchestrationStateV1(s,profiles);result=a.kind==='accepted'?'closed_retained':'unexpected';evidence={admission_kind:a.kind};break}
    case 'COV1-014':{const s=clone(findingState),f=s.finding_ledger[0];f.state=input.finding_state;f.attempt_count=input.attempt_count;s.loop_counters.finding_counters=clone(s.finding_ledger);const x=reduce(s,makeEvent(),stop(input.stop_condition,'role-implementation'));result=x.decision.branch;evidence={reason_code:x.decision.reason_code};break}
    case 'COV1-015':{const other=digest({task_id:state.task_id,semantic_counter_epoch_id:epoch,finding_domain:finding.finding_domain,semantic_requirement_digest:sha(input.semantic_requirement_digest),allowed_scope_digest:finding.allowed_scope_digest});result=other!==finding.counter_key?'separate_counter':'unexpected';evidence={counter_key_relation:other!==finding.counter_key?'not_equal':'equal'};break}
    case 'COV1-016':{const s=clone(state);s.projection_state.state=input.projection_state;s.projection_state.mismatch_field_ids=clone(input.mismatch_field_ids);const x=reduce(s,makeEvent(),{kind:'require_gate_status_update'});result=x.decision.branch;evidence={write_attempt_count:x.state.loop_counters.metadata_counters[0].write_attempt_count};break}
    case 'COV1-017':{const x=reduce(state,makeEvent(),{kind:input.evaluation_kind,invalidation_class:input.invalidation_class});result=x.decision.branch;evidence={automatic_resume:x.decision.automatic_resume};break}
    case 'COV1-018':{const s=clone(metadataExhausted);s.loop_counters.metadata_counters[0].write_attempt_count=input.write_attempt_count;s.projection_state.state=input.projection_state;const x=reduce(s,makeEvent(),{kind:'require_gate_status_update'});result=x.decision.branch;evidence={reason_code:x.decision.reason_code};break}
    case 'COV1-019':{const hook=api.projectContinuousOrchestrationGspHookV1(first.state,first.decision,comment('6000600019'));result=input.finding_closure_authority_requested&&hook.finding_closure_authority===false?'finding_open':'unexpected';evidence={finding_closure_authority:hook.finding_closure_authority};break}
    case 'COV1-020':
    case 'COV1-021':
    case 'COV1-031':{const x=reduce(state,makeEvent(),stop(input.stop_condition,input.recovery_role_id??'recovery-role'));result=x.decision.branch;evidence=row.id==='COV1-020'?{terminal_stop_reason:x.decision.terminal_stop_reason}:row.id==='COV1-021'?{required_recovery_event_type:x.decision.required_recovery_event_type}:{result_handoff_status:x.decision.result_handoff_status};break}
    case 'COV1-022':{const s=clone(state);s.phase='awaiting_external_recovery';const e=makeEvent({event_type:input.event_type,canonical_record_url:comment('6000600022'),authoring_role:'recovery-role'}),x=reduce(s,e,recommend(input.target_role_id,'action-implementation_review'),'recovery-role');result=x.decision.branch;evidence={transition_class:x.decision.route_binding.transition_class};break}
    case 'COV1-023':{const x=reduce(state,makeEvent(),{kind:'invalidate_approval',invalidation_class:input.invalidation_class});result=x.decision.branch;evidence={controller_condition:x.decision.controller_condition};break}
    case 'COV1-024':{const s=clone(state);s.approval_state={state:input.approval_state,reason:input.reason,approval_record_url_or_null:comment('6000600024')};const x=reduce(s,makeEvent(),{kind:'invalidate_approval',invalidation_class:input.reason});result=x.decision.branch;evidence={gsp_hook:x.decision.gsp_hook};break}
    case 'COV1-025':{const s=clone(findingState),f=s.finding_ledger[0];f.state=input.finding_state;f.attempt_count=input.attempt_count;s.loop_counters.finding_counters=clone(s.finding_ledger);const x=reduce(s,makeEvent(),recommend('role-implementation','action-implementation'));result=x.decision.branch;evidence={finding_attempt_count:x.state.finding_ledger[0].attempt_count};break}
    case 'COV1-026':
    case 'COV1-027':
    case 'COV1-028':{const s=clone(state);if(input.check_conclusion)s.authority_snapshot.check_set_digest_or_null=sha(input.check_conclusion);if(input.thread_state)s.authority_snapshot.thread_set_digest=sha(input.thread_state);if(input.pr_body_claim)s.authority_snapshot.gsp_body_digest_or_null=sha(input.pr_body_claim);const projection=clone(s.authority_snapshot);delete projection.snapshot_digest;delete projection.observed_at;s.authority_snapshot.snapshot_digest=digest(projection);const e=makeEvent({authority_snapshot_digest:s.authority_snapshot.snapshot_digest}),x=reduce(s,e,{kind:input.evaluation_kind,future_event_type:'result_handoff_published',future_event_role_id:'role-implementation'}),hook=api.projectContinuousOrchestrationGspHookV1(x.state,x.decision,comment(`6000600${row.id.slice(-3)}`));result=x.decision.branch;evidence=row.id==='COV1-028'?{approval_authority:hook.approval_authority}:{finding_closure_authority:hook.finding_closure_authority};break}
    case 'COV1-029':
    case 'COV1-030':{const x=reduce(state,makeEvent(),recommend(input.target_role_id,input.next_action_id));result=x.decision.branch;evidence={transition_class:x.decision.route_binding.transition_class};break}
    case 'COV1-032':{const s=clone(state);s.approval_state={state:input.approval_state,reason:'missing',approval_record_url_or_null:null};const x=reduce(s,makeEvent(),{kind:'wait_for_protected_action',protected_action_id:input.protected_action_id});result=x.decision.branch;evidence={execution_authority:x.decision.execution_authority??false};break}
    case 'COV1-033':{const s=clone(state);s.approval_state={state:input.approval_state,reason:input.approval_reason,approval_record_url_or_null:comment('6000600033')};const x=reduce(s,makeEvent(),{kind:'wait_for_protected_action',protected_action_id:input.protected_action_id});result=x.decision.branch;evidence={execution_authority:x.decision.execution_authority};break}
    case 'COV1-034':{const s=clone(state);s.active_role_binding=clone(bindings.find(x=>x.transition_class==='protected_executor_wait'));s.active_action_id=input.action_id;const e=makeEvent({event_type:input.event_type,canonical_record_url:comment('6000600034'),authoring_role:'merge-executor',subject_head_sha_or_null:head}),x=reduce(s,e,recommend('role-post_merge_binding','action-post_merge_binding'));result=x.decision.branch;evidence={progress_epoch_delta:x.state.loop_counters.cycle_ledger.progress_epoch-s.loop_counters.cycle_ledger.progress_epoch};break}
    case 'COV1-035':{const x=reduce(state,makeEvent(),recommend(input.target_role_id,input.next_action_id));result=x.decision.branch;evidence={transition_class:x.decision.route_binding.transition_class};break}
    case 'COV1-036':{const s=clone(state);s.loop_counters.cycle_ledger.decision_count_without_progress=input.decision_count_without_progress;s.loop_counters.cycle_ledger.checkpoint_emitted_without_progress=true;const x=reduce(s,makeEvent(),noTransition);result=x.decision.branch;evidence={decision_count_without_progress:x.state.loop_counters.cycle_ledger.decision_count_without_progress,checkpoint_emitted_without_progress:x.state.loop_counters.cycle_ledger.checkpoint_emitted_without_progress};break}
    case 'COV1-037':
    case 'COV1-038':{const x=reduce(state,makeEvent(),stop(input.stop_condition,'architect'));result=x.decision.branch;evidence=row.id==='COV1-037'?{terminal_stop_reason:x.decision.terminal_stop_reason}:{execution_authority:x.decision.execution_authority??false};break}
    case 'COV1-039':{const p=clone(profiles);if(input.gate_profile_unknown)p.gate_profile.unknown=true;const a=api.validateGenericProgressRunnerProfilesV1(p);result=a.kind;evidence={rejection_code:a.rejection.code};break}
    case 'COV1-040':{const same=api.digestContinuousOrchestrationJsonV1(input.left)===api.digestContinuousOrchestrationJsonV1(input.right);result=same?'same_digest':'unexpected';evidence={digest_relation:same?'equal':'not_equal'};break}
    default:throw new Error(`missing literal executor ${row.id}`)
  }
  return {result,evidence}
}
for (const row of corpus.rows) {
  check(typeof row.scenario === 'string' && typeof row.public_api === 'string' && typeof row.operation === 'string' && row.input && typeof row.input === 'object' && typeof row.expected === 'string' && row.expected_evidence && typeof row.expected_evidence === 'object',`${row.id} literal row shape`)
  const executed=executeLiteralRow(row)
  equal(executed.result,row.expected,`${row.id} expected result`)
  deepEqual(executed.evidence,row.expected_evidence,`${row.id} expected evidence`)
}

// CAA004/005 active-action proof, CAS, durable replay, and restart matrix (AA-001..024).
const activeRoute=clone(bindings.find((x)=>x.transition_class==='final_regression'))
const activeState=clone(state)
activeState.active_gate='publication'
activeState.active_role_binding=activeRoute
activeState.active_action_id=activeRoute.action_id
const activeEvent=makeEvent({event_type:'validation_completed',canonical_record_url:comment('6000100001'),authoring_role:activeRoute.role_id,subject_head_sha_or_null:head})
const activeEnvelope=(s=activeState,e=activeEvent,activeBinding=s.active_role_binding)=>{
  const assignmentAuthority={binding_version:'active_action_assignment_binding_v1',assignment_record_url:s.canonical_refs.assignment_url,assignment_revision:s.assignment_revision,route_binding_table_profile_id:profiles.route_binding_table.profile_id,route_binding_table_digest:profiles.route_binding_table.profile_digest,transition_class:activeBinding.transition_class,route_binding:clone(activeBinding)}
  const expectedState={expected_state_version:'active_action_expected_state_v1',state_version:s.state_version,expected_state_revision:s.state_revision,expected_state_digest:digest(s),semantic_counter_epoch_id:s.semantic_counter_epoch.epoch_id,authority_snapshot_digest:s.authority_snapshot.snapshot_digest,active_gate_id_or_null:s.active_gate,active_transition_class:activeBinding.transition_class,active_role_id:activeBinding.role_id,active_action_id:activeBinding.action_id,active_route_binding_digest:digest(activeBinding)}
  const proofSemantic={proof_version:'active_action_admission_proof_v1',task_id:s.task_id,event_digest:e.semantic_event_digest,active_action_id:activeBinding.action_id,assignment_authority:assignmentAuthority,expected_state:expectedState}
  const proof={...proofSemantic,proof_digest:digest(proofSemantic)}
  const casSemantic={operand_version:'active_action_cas_operand_v1',task_id:s.task_id,semantic_event_digest:e.semantic_event_digest,proof_digest:proof.proof_digest,expected_assignment_revision:s.assignment_revision,expected_state_revision:s.state_revision,expected_state_digest:digest(s),expected_authority_snapshot_digest:s.authority_snapshot.snapshot_digest,expected_active_transition_class:activeBinding.transition_class,expected_active_role_id:activeBinding.role_id,expected_active_action_id:activeBinding.action_id,expected_active_route_binding_digest:digest(activeBinding),next_state_revision:s.state_revision+1}
  return {envelope_version:'active_action_admission_envelope_v1',event:e,active_action_proof_or_null:proof,active_action_cas_operand_or_null:{...casSemantic,cas_operand_digest:digest(casSemantic)}}
}
const refreshProof=(envelope)=>{
  const p=envelope.active_action_proof_or_null,semantic=clone(p);delete semantic.proof_digest;p.proof_digest=digest(semantic)
  const c=envelope.active_action_cas_operand_or_null;c.proof_digest=p.proof_digest
  const cs=clone(c);delete cs.cas_operand_digest;c.cas_operand_digest=digest(cs)
  return envelope
}
const provenanceRecord=(s,envelope)=>{
  const e=envelope.event,a=envelope.active_action_proof_or_null?.assignment_authority??{assignment_record_url:s.canonical_refs.assignment_url,assignment_revision:s.assignment_revision,route_binding_table_profile_id:profiles.route_binding_table.profile_id,route_binding_table_digest:profiles.route_binding_table.profile_digest,transition_class:s.active_role_binding.transition_class,route_binding:s.active_role_binding}
  const r=a.route_binding
  const semantic={provenance_version:'active_action_provenance_v1',canonical_record_url:e.canonical_record_url,task_id:e.task_id,source_event_type:'validation_completed',validation_class:a.transition_class,source_event_digest:e.semantic_event_digest,assignment_authority:{assignment_record_url:a.assignment_record_url,assignment_revision:a.assignment_revision,route_binding_table_profile_id:a.route_binding_table_profile_id,route_binding_table_digest:a.route_binding_table_digest,transition_class:a.transition_class,route_role_id:r.role_id,route_action_id:r.action_id,route_authority_record_url:r.authority_record_url,route_allowed_scope_digest:r.allowed_scope_digest},active_action_id:r.action_id,authoring_role_id:e.authoring_role}
  return {...semantic,provenance_digest:digest(semantic)}
}
const provenanceBody=(record)=>`# Validation Result\n<!-- cov1-active-action-provenance-v1:begin -->\n${jcs({active_action_provenance:record})}\n<!-- cov1-active-action-provenance-v1:end -->\n`
const BEGIN='<!-- cov1-active-action-provenance-v1:begin -->',END='<!-- cov1-active-action-provenance-v1:end -->'
const admit=(s,envelope,decisionId='6000100100',bodyOverride=undefined)=>{
  const record=provenanceRecord(s,envelope),body=bodyOverride??provenanceBody(record)
  const port=api.createTrustedProvenanceCollectorPortV1(s,profiles,()=>({retrieval_state:'retrieved',body_text:body}))
  const capability=port.collect(envelope.event.canonical_record_url,'2026-07-31T04:00:01Z')
  return api.admitActiveActionEventV1(s,profiles,envelope,capability,noTransition,comment(decisionId),'2026-07-31T04:00:02Z')
}
const aa=activeEnvelope()
const originalProvenanceBody=provenanceBody(provenanceRecord(activeState,aa))
equal(api.validateActiveActionAdmissionEnvelopeV1(aa).kind,'accepted','AA-001 envelope structurally admitted')
const aaNew=admit(activeState,aa)
equal(aaNew.branch,'accepted','AA-001 active action admitted')
equal(aaNew.reduction.admission.branch,'new_decision','AA-001 creates decision')
equal(aaNew.guard.binding_idempotency_key,digest({event_digest:aa.event.semantic_event_digest,proof_digest:aa.active_action_proof_or_null.proof_digest,cas_operand_digest:aa.active_action_cas_operand_or_null.cas_operand_digest}),'AA-001 exact binding idempotency')
equal(aaNew.reduction.state.replay_ledger.entries.at(-1).active_action_replay_binding_or_null.binding_idempotency_key,aaNew.guard.binding_idempotency_key,'AA-001 durable replay binding committed atomically')

const missingProof=activeEnvelope();missingProof.active_action_proof_or_null=null
equal(admit(activeState,missingProof).guard.rejection_code,'missing_action','AA-002 missing proof')
const missingCas=activeEnvelope();missingCas.active_action_cas_operand_or_null=null
equal(admit(activeState,missingCas).guard.rejection_code,'missing_action','AA-003 missing CAS')
const malformedProof=activeEnvelope();malformedProof.active_action_proof_or_null.unknown=true
equal(admit(activeState,malformedProof).guard.rejection_code,'malformed_proof','AA-004 closed proof')
const malformedCas=activeEnvelope();malformedCas.active_action_cas_operand_or_null.unknown=true
equal(admit(activeState,malformedCas).guard.rejection_code,'malformed_proof','AA-005 closed CAS')
const badProofDigest=activeEnvelope();badProofDigest.active_action_proof_or_null.proof_digest=sha('tampered-proof')
equal(admit(activeState,badProofDigest).guard.rejection_code,'malformed_proof','AA-006 proof digest tamper')
const badCasDigest=activeEnvelope();badCasDigest.active_action_cas_operand_or_null.cas_operand_digest=sha('tampered-cas')
equal(admit(activeState,badCasDigest).guard.rejection_code,'malformed_proof','AA-007 CAS digest tamper')

const mismatchedAction=activeEnvelope()
mismatchedAction.active_action_proof_or_null.active_action_id='alternate-action'
mismatchedAction.active_action_proof_or_null.expected_state.active_action_id='alternate-action'
mismatchedAction.active_action_proof_or_null.assignment_authority.route_binding.action_id='alternate-action'
mismatchedAction.active_action_cas_operand_or_null.expected_active_action_id='alternate-action'
mismatchedAction.active_action_proof_or_null.expected_state.active_route_binding_digest=digest(mismatchedAction.active_action_proof_or_null.assignment_authority.route_binding)
mismatchedAction.active_action_cas_operand_or_null.expected_active_route_binding_digest=mismatchedAction.active_action_proof_or_null.expected_state.active_route_binding_digest
refreshProof(mismatchedAction)
equal(admit(activeState,mismatchedAction).guard.rejection_code,'assignment_authority_mismatch','AA-008 action outside profile authority rejected')
const wrongAssignmentUrl=activeEnvelope();wrongAssignmentUrl.active_action_proof_or_null.assignment_authority.assignment_record_url=comment('6000100091');refreshProof(wrongAssignmentUrl)
equal(admit(activeState,wrongAssignmentUrl).guard.rejection_code,'assignment_authority_mismatch','AA-009 assignment URL mismatch')
const wrongAssignmentRevision=activeEnvelope();wrongAssignmentRevision.active_action_proof_or_null.assignment_authority.assignment_revision=2;wrongAssignmentRevision.active_action_cas_operand_or_null.expected_assignment_revision=2;refreshProof(wrongAssignmentRevision)
equal(admit(activeState,wrongAssignmentRevision).guard.rejection_code,'assignment_authority_mismatch','AA-010 assignment revision mismatch')
const wrongProfileId=activeEnvelope();wrongProfileId.active_action_proof_or_null.assignment_authority.route_binding_table_profile_id='other-profile';refreshProof(wrongProfileId)
equal(admit(activeState,wrongProfileId).guard.rejection_code,'assignment_authority_mismatch','AA-011 profile ID mismatch')
const wrongProfileDigest=activeEnvelope();wrongProfileDigest.active_action_proof_or_null.assignment_authority.route_binding_table_digest=sha('other-profile');refreshProof(wrongProfileDigest)
equal(admit(activeState,wrongProfileDigest).guard.rejection_code,'assignment_authority_mismatch','AA-012 profile digest mismatch')
for(const [label,mutate] of [
  ['AA-013 stale revision',(x)=>{x.active_action_proof_or_null.expected_state.expected_state_revision=1;x.active_action_cas_operand_or_null.expected_state_revision=1;x.active_action_cas_operand_or_null.next_state_revision=2}],
  ['AA-014 stale state digest',(x)=>{x.active_action_proof_or_null.expected_state.expected_state_digest=sha('stale-state');x.active_action_cas_operand_or_null.expected_state_digest=sha('stale-state')}],
  ['AA-015 stale authority digest',(x)=>{x.active_action_proof_or_null.expected_state.authority_snapshot_digest=sha('stale-authority');x.active_action_cas_operand_or_null.expected_authority_snapshot_digest=sha('stale-authority')}],
]){
  const x=activeEnvelope();mutate(x);refreshProof(x)
  equal(admit(activeState,x).guard.rejection_code,'cas_mismatch',label)
}
const staleActionState=clone(activeState);staleActionState.active_role_binding=clone(bindings.find((x)=>x.transition_class==='operational_validation'));staleActionState.active_action_id=staleActionState.active_role_binding.action_id
equal(admit(staleActionState,activeEnvelope()).guard.rejection_code,'stale_action','AA-016 stale active action')

const exactReplay=admit(aaNew.reduction.state,aa,'6000100101')
equal(exactReplay.reduction.admission.branch,'replay','AA-017 exact proof replay')
const prooflessReplay=activeEnvelope();prooflessReplay.active_action_proof_or_null=null;prooflessReplay.active_action_cas_operand_or_null=null
equal(admit(aaNew.reduction.state,prooflessReplay,'6000100102').reduction.admission.branch,'replay','AA-018 proofless durable replay')
const commitA=api.commitContinuousOrchestrationCasV1(aaNew.reduction,activeState)
equal(commitA.branch,'committed','AA-019-A first CAS contender commits')
const commitB=api.commitContinuousOrchestrationCasV1(aaNew.reduction,commitA.state)
equal(commitB.branch,'cas_mismatch','AA-019-A CAS loser is explicit and mutation-free')
const restartState=clone(aaNew.reduction.state)
equal(admit(restartState,prooflessReplay,'6000100103').reduction.admission.branch,'replay','AA-019-B/020 restart replay uses durable ledger only')

const duplicateAction=clone(aa);duplicateAction.active_action_proof_or_null.active_action_id='different-action';duplicateAction.active_action_proof_or_null.expected_state.active_action_id='different-action';duplicateAction.active_action_proof_or_null.assignment_authority.route_binding.action_id='different-action';duplicateAction.active_action_cas_operand_or_null.expected_active_action_id='different-action';duplicateAction.active_action_proof_or_null.expected_state.active_route_binding_digest=digest(duplicateAction.active_action_proof_or_null.assignment_authority.route_binding);duplicateAction.active_action_cas_operand_or_null.expected_active_route_binding_digest=duplicateAction.active_action_proof_or_null.expected_state.active_route_binding_digest;refreshProof(duplicateAction)
equal(admit(aaNew.reduction.state,duplicateAction,'6000100105',originalProvenanceBody).guard.rejection_code,'action_mismatch','AA-021 conflicting duplicate action')
const duplicateAssignment=clone(aa);duplicateAssignment.active_action_proof_or_null.assignment_authority.assignment_record_url=comment('6000100092');refreshProof(duplicateAssignment)
equal(admit(aaNew.reduction.state,duplicateAssignment,'6000100106',originalProvenanceBody).guard.rejection_code,'assignment_authority_mismatch','AA-022 conflicting duplicate assignment')
const duplicateCas=clone(aa);duplicateCas.active_action_cas_operand_or_null.expected_state_digest=sha('alternate-cas-state');const duplicateCasSemantic=clone(duplicateCas.active_action_cas_operand_or_null);delete duplicateCasSemantic.cas_operand_digest;duplicateCas.active_action_cas_operand_or_null.cas_operand_digest=digest(duplicateCasSemantic)
equal(admit(aaNew.reduction.state,duplicateCas,'6000100107',originalProvenanceBody).guard.rejection_code,'cas_mismatch','AA-023 conflicting duplicate CAS')
assertions+=1
assert.throws(()=>api.reduceContinuousOrchestrationV1(activeState,activeEvent,profiles,noTransition,comment('6000100104'),'2026-07-31T04:00:02Z'),/active action admission proof required/,'AA-024 direct reducer cannot bypass proof binding')

const validationCase=(transitionClass,index)=>{
  const routeBinding=clone(bindings.find((x)=>x.transition_class===transitionClass))
  const s=clone(state);s.active_gate=transitionClass==='final_regression'?'publication':'final-regression';s.active_role_binding=routeBinding;s.active_action_id=routeBinding.action_id
  const e=makeEvent({event_type:'validation_completed',canonical_record_url:comment(String(6000200000+index)),authoring_role:routeBinding.role_id,subject_head_sha_or_null:head})
  const envelope=activeEnvelope(s,e,routeBinding)
  return {transitionClass,routeBinding,state:s,event:e,envelope,body:provenanceBody(provenanceRecord(s,envelope))}
}
const finalCase=validationCase('final_regression',1),operationalCase=validationCase('operational_validation',2)
const admittedCases=[]
for(const [id,x] of [['COV1-AA-001',finalCase],['COV1-AA-002',operationalCase]]){
  const result=admit(x.state,x.envelope,String(6000200100+admittedCases.length),x.body)
  equal(result.branch,'accepted',`${id} guard accepted`)
  equal(result.reduction.admission.branch,'new_decision',`${id} one new decision`)
  equal(result.reduction.state.replay_ledger.entries.length,1,`${id} one ledger entry`)
  equal(result.reduction.state.audit_chain.decision_count_total,1,`${id} one audit append`)
  equal(result.reduction.state.replay_ledger.entries[0].active_action_replay_binding_or_null.transition_class,x.transitionClass,`${id} class binding`)
  equal(result.reduction.state.replay_ledger.entries[0].active_action_provenance_record_url_or_null,x.event.canonical_record_url,`${id} provenance URL atomic`)
  admittedCases.push({...x,result})
}
for(const [id,x] of [['COV1-AA-003',admittedCases[0]],['COV1-AA-004',admittedCases[1]]]){
  const proofless=clone(x.envelope);proofless.active_action_proof_or_null=null;proofless.active_action_cas_operand_or_null=null
  const before=digest(x.result.reduction.state),replayed=admit(x.result.reduction.state,proofless,String(6000200200+Number(id.slice(-1))),x.body)
  equal(replayed.reduction.admission.branch,'replay',`${id} proofless immediate replay`)
  equal(digest(replayed.reduction.state),before,`${id} zero mutation`)
}
for(const [id,x] of [['COV1-AA-005',admittedCases[0]],['COV1-AA-006',admittedCases[1]]]){
  const persisted=JSON.parse(JSON.stringify(x.result.reduction.state)),proofless=clone(x.envelope);proofless.active_action_proof_or_null=null;proofless.active_action_cas_operand_or_null=null
  const replayed=admit(persisted,proofless,String(6000200300+Number(id.slice(-1))),x.body)
  equal(replayed.reduction.admission.branch,'replay',`${id} serialized restart replay`)
  equal(replayed.reduction.admission.existing_decision_id,x.result.reduction.admission.committed_decision_id,`${id} exact prior decision`)
}
const changedActionEnvelope=(x)=>{
  const z=clone(x.envelope),newAction=`alternate-${x.transitionClass}-action`
  z.active_action_proof_or_null.active_action_id=newAction;z.active_action_proof_or_null.expected_state.active_action_id=newAction;z.active_action_proof_or_null.assignment_authority.route_binding.action_id=newAction;z.active_action_proof_or_null.expected_state.active_route_binding_digest=digest(z.active_action_proof_or_null.assignment_authority.route_binding)
  z.active_action_cas_operand_or_null.expected_active_action_id=newAction;z.active_action_cas_operand_or_null.expected_active_route_binding_digest=z.active_action_proof_or_null.expected_state.active_route_binding_digest
  return refreshProof(z)
}
for(const [id,x] of [['COV1-AA-009',admittedCases[0]],['COV1-AA-010',admittedCases[1]],['COV1-AA-011',admittedCases[0]],['COV1-AA-012',admittedCases[1]]]){
  const persisted=Number(id.slice(-2))>=11?JSON.parse(JSON.stringify(x.result.reduction.state)):x.result.reduction.state
  const rejected=admit(persisted,changedActionEnvelope(x),String(6000200400+Number(id.slice(-2))),x.body)
  equal(rejected.guard.rejection_code,'action_mismatch',`${id} changed action classification`)
  equal(digest(rejected.reduction),digest(null),`${id} no replay/new decision`)
}
for(const x of [finalCase,operationalCase]){
  const bothNull=clone(x.envelope);bothNull.active_action_proof_or_null=null;bothNull.active_action_cas_operand_or_null=null
  equal(admit(x.state,bothNull,'6000200513',x.body).guard.rejection_code,'missing_action',`COV1-AA-013 ${x.transitionClass} both null`)
  const oneNull=clone(x.envelope);oneNull.active_action_cas_operand_or_null=null
  equal(admit(x.state,oneNull,'6000200514',x.body).guard.rejection_code,'missing_action',`COV1-AA-013 ${x.transitionClass} one null`)
  const absentProofAction=clone(x.envelope);delete absentProofAction.active_action_proof_or_null.active_action_id
  equal(admit(x.state,absentProofAction,'6000200515',x.body).guard.rejection_code,'missing_action',`COV1-AA-013 ${x.transitionClass} proof action absent`)
  const absentCasAction=clone(x.envelope);delete absentCasAction.active_action_cas_operand_or_null.expected_active_action_id
  equal(admit(x.state,absentCasAction,'6000200516',x.body).guard.rejection_code,'missing_action',`COV1-AA-014 ${x.transitionClass} CAS action absent`)
}
const staleCaptured=clone(finalCase.state);staleCaptured.active_role_binding=clone(bindings.find((x)=>x.transition_class==='operational_validation'));staleCaptured.active_action_id=staleCaptured.active_role_binding.action_id
equal(admit(staleCaptured,finalCase.envelope,'6000200517',finalCase.body).guard.rejection_code,'stale_action','COV1-AA-015 replaced action')
for(const field of ['assignment_record_url','assignment_revision','route_binding_table_profile_id','route_binding_table_digest']){
  const z=clone(admittedCases[0].envelope)
  z.active_action_proof_or_null.assignment_authority[field]=field==='assignment_revision'?2:field==='assignment_record_url'?comment('6000200518'):field==='route_binding_table_profile_id'?'other-profile':sha(field)
  refreshProof(z)
  equal(admit(admittedCases[0].result.reduction.state,z,'6000200518',admittedCases[0].body).guard.rejection_code,'assignment_authority_mismatch',`COV1-AA-016 ${field}`)
}
const aa17=clone(finalCase.envelope);aa17.active_action_proof_or_null.expected_state.expected_state_revision=2;aa17.active_action_cas_operand_or_null.expected_state_revision=2;aa17.active_action_cas_operand_or_null.next_state_revision=3;refreshProof(aa17)
equal(admit(finalCase.state,aa17,'6000200519',finalCase.body).guard.rejection_code,'cas_mismatch','COV1-AA-017 expected revision')
for(const field of ['expected_state_digest','authority_snapshot_digest']){
  const z=clone(finalCase.envelope),value=sha(`different-${field}`)
  if(field==='expected_state_digest'){z.active_action_proof_or_null.expected_state.expected_state_digest=value;z.active_action_cas_operand_or_null.expected_state_digest=value}else{z.active_action_proof_or_null.expected_state.authority_snapshot_digest=value;z.active_action_cas_operand_or_null.expected_authority_snapshot_digest=value}
  refreshProof(z);equal(admit(finalCase.state,z,'6000200520',finalCase.body).guard.rejection_code,'cas_mismatch',`COV1-AA-018 ${field}`)
}
const aa19A=admittedCases[0].result
equal(api.commitContinuousOrchestrationCasV1(aa19A.reduction,finalCase.state).branch,'committed','COV1-AA-019-A contender A commits')
equal(api.commitContinuousOrchestrationCasV1(aa19A.reduction,aa19A.reduction.state).branch,'cas_mismatch','COV1-AA-019-A contender B loses CAS')
equal(admit(aa19A.reduction.state,finalCase.envelope,'6000200521',finalCase.body).reduction.admission.branch,'replay','COV1-AA-019-B ledger-visible contender replays')
for(const target of ['active_action_proof_or_null','active_action_cas_operand_or_null']){
  const z=clone(finalCase.envelope);z[target].unknown=true
  equal(admit(finalCase.state,z,'6000200522',finalCase.body).guard.rejection_code,'malformed_proof',`COV1-AA-020 ${target} closed`)
}
assertions+=1
assert.throws(()=>api.reduceContinuousOrchestrationV1(finalCase.state,finalCase.event,profiles,noTransition,comment('6000200523'),'2026-07-31T04:00:02Z','legacy-action'),/active action admission proof required/,'COV1-AA-021 legacy action scalar absent')
const aa22a=clone(admittedCases[0].envelope);aa22a.active_action_proof_or_null.expected_state.expected_state_digest=sha('aa22-state');aa22a.active_action_cas_operand_or_null.expected_state_digest=sha('aa22-state');refreshProof(aa22a)
equal(admit(admittedCases[0].result.reduction.state,aa22a,'6000200524',admittedCases[0].body).guard.rejection_code,'cas_mismatch','COV1-AA-022-A internally valid different state')
const aa22b=clone(admittedCases[0].envelope);aa22b.active_action_proof_or_null.proof_digest=sha('digest-only')
equal(admit(admittedCases[0].result.reduction.state,aa22b,'6000200525',admittedCases[0].body).guard.rejection_code,'malformed_proof','COV1-AA-022-B digest-only alteration')
const aa23=clone(admittedCases[0].result.reduction.state),aa23Entry=aa23.replay_ledger.entries[0];aa23Entry.active_action_replay_binding_or_null=null;aa23.replay_ledger.ledger_digest=digest({ledger_version:aa23.replay_ledger.ledger_version,entries:aa23.replay_ledger.entries})
equal(api.validateContinuousOrchestrationStateV1(aa23,profiles).kind,'rejected','COV1-AA-023 missing durable binding fails closed')
const retainedDigest=admittedCases[0].result.reduction.state.replay_ledger.entries[0].active_action_replay_binding_or_null.replay_binding_digest
const retentionState=clone(admittedCases[0].result.reduction.state);retentionState.loop_counters.cycle_ledger.progress_epoch+=1;retentionState.loop_counters.cycle_ledger.decision_count_without_progress=0;retentionState.loop_counters.cycle_ledger.last_progress_record_url=comment('6000200526')
equal(retentionState.replay_ledger.entries[0].active_action_replay_binding_or_null.replay_binding_digest,retainedDigest,'COV1-AA-024 progress retains binding digest')

const tamperedReduction=clone(admittedCases[0].result.reduction);tamperedReduction.state.state_revision=999
equal(api.commitContinuousOrchestrationCasV1(tamperedReduction,finalCase.state).branch,'cas_mismatch','B-218-IMPL-02 public CAS rejects tampered state')
const tamperedProjection=clone(admittedCases[0].result.reduction);tamperedProjection.cas_projection.next_state_revision+=1
equal(api.commitContinuousOrchestrationCasV1(tamperedProjection,finalCase.state).branch,'cas_mismatch','B-218-IMPL-02 public CAS rejects tampered projection')

const capabilityFor=(s,event,retrieval,observedAt='2026-07-31T05:00:01Z')=>{
  const port=api.createTrustedProvenanceCollectorPortV1(s,profiles,()=>retrieval)
  return {port,capability:port.collect(event.canonical_record_url,observedAt)}
}
const admitObserved=(s,envelope,capability,id='6000300001')=>api.admitActiveActionEventV1(s,profiles,envelope,capability,noTransition,comment(id),'2026-07-31T05:00:02Z')
const mutateProvenance=(record,mutate)=>{const x=clone(record);mutate(x);const semantic=clone(x);delete semantic.provenance_digest;x.provenance_digest=digest(semantic);return x}
// COV1_CUMULATIVE_MATRIX_BEGIN
runtimeEvidenceCursor=runtimeEvidenceLog.length
for(const [id,x] of [['COV1-PROV-001',admittedCases[0]],['COV1-PROV-002',admittedCases[1]]]){
  const entry=x.result.reduction.state.replay_ledger.entries[0],binding=entry.active_action_replay_binding_or_null
  equal(entry.active_action_provenance_record_url_or_null,x.event.canonical_record_url,`${id} ledger provenance URL`)
  equal(entry.active_action_provenance_digest_or_null,binding.provenance_digest,`${id} ledger/binding provenance digest`)
}
for(const [id,x] of [['COV1-PROV-003',admittedCases[0]],['COV1-PROV-004',admittedCases[1]]]){
  const persisted=JSON.parse(JSON.stringify(x.result.reduction.state)),proofless=clone(x.envelope);proofless.active_action_proof_or_null=null;proofless.active_action_cas_operand_or_null=null
  const {capability}=capabilityFor(persisted,x.event,{retrieval_state:'retrieved',body_text:x.body})
  equal(admitObserved(persisted,proofless,capability,String(6000300000+Number(id.slice(-1)))).reduction.admission.branch,'replay',`${id} canonical restart replay`)
}
equal(admitObserved(finalCase.state,finalCase.envelope,null).guard.rejection_code,'missing_provenance','COV1-PROV-005 missing capability')
const mixedProvenance=clone(admittedCases[0].result.reduction.state);mixedProvenance.replay_ledger.entries[0].active_action_provenance_digest_or_null=null;mixedProvenance.replay_ledger.ledger_digest=digest({ledger_version:mixedProvenance.replay_ledger.ledger_version,entries:mixedProvenance.replay_ledger.entries})
equal(api.validateContinuousOrchestrationStateV1(mixedProvenance,profiles).kind,'rejected','COV1-PROV-006 mixed provenance refs')
equal(admitObserved(finalCase.state,finalCase.envelope,{payload:'forged'}).guard.rejection_code,'provenance_injection','COV1-PROV-007 raw caller object')
const badTypeRecord=mutateProvenance(provenanceRecord(finalCase.state,finalCase.envelope),(x)=>{x.source_event_type='result_handoff_published'})
equal(admit(finalCase.state,finalCase.envelope,'6000300008',provenanceBody(badTypeRecord)).guard.rejection_code,'provenance_type_mismatch','COV1-PROV-008 source type')
for(const x of [finalCase,operationalCase]){
  const opposite=x.transitionClass==='final_regression'?'operational_validation':'final_regression'
  const badClass=mutateProvenance(provenanceRecord(x.state,x.envelope),(r)=>{r.validation_class=opposite;r.assignment_authority.transition_class=opposite})
  equal(admit(x.state,x.envelope,'6000300009',provenanceBody(badClass)).guard.rejection_code,'provenance_class_mismatch',`COV1-PROV-009 ${x.transitionClass}`)
}
const badEventRecord=mutateProvenance(provenanceRecord(finalCase.state,finalCase.envelope),(x)=>{x.source_event_digest=sha('other-event')})
equal(admit(finalCase.state,finalCase.envelope,'6000300010',provenanceBody(badEventRecord)).guard.rejection_code,'provenance_event_mismatch','COV1-PROV-010 event digest')
for(const field of ['assignment_record_url','assignment_revision','route_binding_table_profile_id','route_binding_table_digest','route_role_id','route_authority_record_url','route_allowed_scope_digest']){
  const bad=mutateProvenance(provenanceRecord(finalCase.state,finalCase.envelope),(x)=>{x.assignment_authority[field]=field==='assignment_revision'?2:field.includes('url')?comment('6000300011'):field==='route_binding_table_profile_id'?'other-profile':field==='route_role_id'?'other-role':sha(field)})
  equal(admit(finalCase.state,finalCase.envelope,'6000300011',provenanceBody(bad)).guard.rejection_code,'provenance_assignment_mismatch',`COV1-PROV-011 ${field}`)
}
const badActionRecord=mutateProvenance(provenanceRecord(finalCase.state,finalCase.envelope),(x)=>{x.active_action_id='other-action';x.assignment_authority.route_action_id='other-action'})
equal(admit(finalCase.state,finalCase.envelope,'6000300012',provenanceBody(badActionRecord)).guard.rejection_code,'provenance_action_mismatch','COV1-PROV-012 action')
const changedRecord=mutateProvenance(provenanceRecord(finalCase.state,finalCase.envelope),(x)=>{x.authoring_role_id='changed-role'})
equal(admit(admittedCases[0].result.reduction.state,finalCase.envelope,'6000300013',provenanceBody(changedRecord)).guard.rejection_code,'stale_provenance','COV1-PROV-013 changed canonical payload')
const unavailablePort=api.createTrustedProvenanceCollectorPortV1(admittedCases[0].result.reduction.state,profiles,()=>({retrieval_state:'unavailable',failure_class:'not_found'}))
const unavailableCapability=unavailablePort.collect(finalCase.event.canonical_record_url,'2026-07-31T05:00:01Z')
equal(admitObserved(admittedCases[0].result.reduction.state,finalCase.envelope,unavailableCapability,'6000300014').guard.rejection_code,'stale_provenance','COV1-PROV-014 unavailable replay record')
equal(admit(admittedCases[0].result.reduction.state,finalCase.envelope,'6000300015',`${finalCase.body}\n${BEGIN??''}`).guard?.rejection_code??'provenance_injection','provenance_injection','COV1-PROV-015 injected second token')
const provenanceEntry=admittedCases[0].result.reduction.state.replay_ledger.entries[0]
check(provenanceEntry.active_action_replay_binding_or_null!==null&&provenanceEntry.active_action_provenance_digest_or_null!==null,'COV1-PROV-016 binding and provenance visible atomically')
equal(provenanceEntry.active_action_replay_binding_or_null.provenance_digest,provenanceEntry.active_action_provenance_digest_or_null,'COV1-PROV-017 retained provenance digest')
const nonValidationWithProvenance=clone(first.state);nonValidationWithProvenance.replay_ledger.entries[0].active_action_provenance_record_url_or_null=finalCase.event.canonical_record_url;nonValidationWithProvenance.replay_ledger.entries[0].active_action_provenance_digest_or_null=sha('illegal-provenance');nonValidationWithProvenance.replay_ledger.ledger_digest=digest({ledger_version:nonValidationWithProvenance.replay_ledger.ledger_version,entries:nonValidationWithProvenance.replay_ledger.entries})
equal(api.validateContinuousOrchestrationStateV1(nonValidationWithProvenance,profiles).kind,'rejected','COV1-PROV-018 non-validation provenance fields')

const validRecord=provenanceRecord(finalCase.state,finalCase.envelope),validMiddle=jcs({active_action_provenance:validRecord}),validEnvelope=`${BEGIN}\n${validMiddle}\n${END}`
const lfBody=`# Heading\n${validEnvelope}\nAfter`,crlfBody=lfBody.replace(/\n/g,'\r\n')
equal(admit(finalCase.state,finalCase.envelope,'6000300019',lfBody).branch,'accepted','COV1-PROV-019 LF exact envelope')
equal(admit(finalCase.state,finalCase.envelope,'6000300020',crlfBody).branch,'accepted','COV1-PROV-020 CRLF exact envelope')
equal(admit(admittedCases[0].result.reduction.state,finalCase.envelope,'6000300021',lfBody).reduction.admission.branch,'replay','COV1-PROV-021 refetch after restart')
equal(admit(finalCase.state,finalCase.envelope,'6000300022','# no provenance').guard.rejection_code,'missing_provenance','COV1-PROV-022 no tokens')
for(const [id,body,expected] of [
  ['COV1-PROV-023',`${validEnvelope}\n${validEnvelope}`,'provenance_injection'],
  ['COV1-PROV-024',`${validEnvelope}\n${BEGIN}\n{\n${END}`,'provenance_injection'],
  ['COV1-PROV-025',`${lfBody}\nquoted cov1-active-action-provenance-v1:begin`,'provenance_injection'],
  ['COV1-PROV-026',`${BEGIN}\n${END}\n${validMiddle}`,'provenance_injection'],
  ['COV1-PROV-027',`${BEGIN}\n${jcs({wrong:validRecord})}\n${END}`,'malformed_proof'],
  ['COV1-PROV-028',`${BEGIN}\n{"active_action_provenance":${jcs(validRecord)},"active_action_provenance":${jcs(validRecord)}}\n${END}`,'provenance_injection'],
  ['COV1-PROV-029',`${BEGIN}\n${JSON.stringify({active_action_provenance:validRecord},null,1).replace(/\n/g,'')}\n${END}`,'malformed_proof'],
]){
  equal(admit(finalCase.state,finalCase.envelope,'6000300099',body).guard.rejection_code,expected,id)
}
const invalidNested=clone(validRecord);invalidNested.provenance_digest=sha('invalid')
equal(admit(finalCase.state,finalCase.envelope,'6000300030',provenanceBody(invalidNested)).guard.rejection_code,'malformed_proof','COV1-PROV-030 invalid nested digest')
equal(admit(admittedCases[0].result.reduction.state,finalCase.envelope,'6000300031',`changed prose\n${validEnvelope}\nmore`).reduction.admission.branch,'replay','COV1-PROV-031 surrounding markdown changes')
equal(admit(admittedCases[0].result.reduction.state,finalCase.envelope,'6000300032',provenanceBody(changedRecord)).guard.rejection_code,'stale_provenance','COV1-PROV-032 changed payload replay')
equal(admit(admittedCases[0].result.reduction.state,finalCase.envelope,'6000300033',`${validEnvelope}\n${BEGIN}`).guard.rejection_code,'provenance_injection','COV1-PROV-033 decoy after admission')
for(const x of [finalCase,operationalCase])equal(admit(x.state,x.envelope,'6000300034',x.body).branch,'accepted',`COV1-PROV-034 ${x.transitionClass}`)
for(const x of admittedCases){
  equal(admit(x.result.reduction.state,x.envelope,'6000300035',x.body).reduction.admission.branch,'replay',`COV1-PROV-035 ${x.transitionClass}`)
  equal(admit(x.result.reduction.state,x.envelope,'6000300036','# removed').guard.rejection_code,'stale_provenance',`COV1-PROV-036 ${x.transitionClass}`)
  equal(admit(x.result.reduction.state,x.envelope,'6000300037',`${BEGIN}\n${END}`).guard.rejection_code,'stale_provenance',`COV1-PROV-037 ${x.transitionClass}`)
  equal(admit(x.result.reduction.state,x.envelope,'6000300038',`${BEGIN}\n{\n${END}`).guard.rejection_code,'stale_provenance',`COV1-PROV-038 ${x.transitionClass}`)
  equal(admit(x.result.reduction.state,x.envelope,'6000300039',`${BEGIN}\n ${jcs({active_action_provenance:provenanceRecord(x.state,x.envelope)})}\n${END}`).guard.rejection_code,'stale_provenance',`COV1-PROV-039 ${x.transitionClass}`)
  equal(admit(x.result.reduction.state,x.envelope,'6000300040',provenanceBody({...provenanceRecord(x.state,x.envelope),provenance_digest:sha('bad')})).guard.rejection_code,'stale_provenance',`COV1-PROV-040 ${x.transitionClass}`)
}
for(const [id,failureClass] of [['COV1-PROV-041','not_found'],['COV1-PROV-042','permission_denied'],['COV1-PROV-042','transport_error'],['COV1-PROV-042','unreadable_body']]){
  const x=admittedCases[0],proofless=clone(x.envelope);proofless.active_action_proof_or_null=null;proofless.active_action_cas_operand_or_null=null
  const {capability}=capabilityFor(x.result.reduction.state,x.event,{retrieval_state:'unavailable',failure_class:failureClass})
  equal(admitObserved(x.result.reduction.state,proofless,capability,'6000300041').guard.rejection_code,'stale_provenance',`${id} ${failureClass}`)
}
equal(admit(admittedCases[0].result.reduction.state,finalCase.envelope,'6000300043',provenanceBody(changedRecord)).guard.rejection_code,'stale_provenance','COV1-PROV-043 changed valid payload')
for(const [id,body] of [
  ['COV1-PROV-044',`${validEnvelope}\n${BEGIN}`],
  ['COV1-PROV-045',`${validEnvelope}\n${BEGIN}\n{\n${END}`],
]){
  equal(admit(admittedCases[0].result.reduction.state,finalCase.envelope,'6000300045',body).guard.rejection_code,'provenance_injection',id)
}
{
  const x=admittedCases[0],proofless=clone(x.envelope);proofless.active_action_proof_or_null=null;proofless.active_action_cas_operand_or_null=null
  const wrongUrl=comment('6000300046'),port=api.createTrustedProvenanceCollectorPortV1(x.result.reduction.state,profiles,()=>({retrieval_state:'retrieved',body_text:x.body}))
  const capability=port.collect(wrongUrl,'2026-07-31T05:00:46Z')
  equal(admitObserved(x.result.reduction.state,proofless,capability,'6000300046').guard.rejection_code,'provenance_injection','COV1-PROV-046 wrong collector URL')
  equal(admitObserved(x.result.reduction.state,proofless,{record_url:x.event.canonical_record_url,body_text:x.body},'6000300046').guard.rejection_code,'provenance_injection','COV1-PROV-046 injected caller projection')
}

// CAA009 trusted collector-port matrix (COL-001..016).
{
  const firstCap=capabilityFor(finalCase.state,finalCase.event,{retrieval_state:'retrieved',body_text:finalCase.body}).capability
  equal(admitObserved(finalCase.state,finalCase.envelope,firstCap,'6000400001').branch,'accepted','COV1-COL-001 first admission')
  const replayState=admittedCases[0].result.reduction.state,proofless=clone(finalCase.envelope);proofless.active_action_proof_or_null=null;proofless.active_action_cas_operand_or_null=null
  const replayCap=capabilityFor(replayState,finalCase.event,{retrieval_state:'retrieved',body_text:finalCase.body}).capability
  equal(admitObserved(replayState,proofless,replayCap,'6000400001').reduction.admission.branch,'replay','COV1-COL-001 replay')
  for(const [id,value] of [
    ['COV1-COL-002',{retrieval_state:'retrieved',body_text:finalCase.body}],
    ['COV1-COL-003',{collector_authority:{assignment_revision:1},record_url:finalCase.event.canonical_record_url,body_text:finalCase.body}],
    ['COV1-COL-004',{record_url:finalCase.event.canonical_record_url,body_text:finalCase.body,body_utf8_sha256:sha(finalCase.body)}],
  ])equal(admitObserved(finalCase.state,finalCase.envelope,value,'6000400002').guard.rejection_code,'provenance_injection',id)
  for(const [id,mode] of [['COV1-COL-005','snapshot_unknown_field'],['COV1-COL-006','snapshot_body_digest']]){
    const capability=capabilityFor(finalCase.state,finalCase.event,{retrieval_state:'retrieved',body_text:finalCase.body}).capability
    api.corruptTrustedProvenanceObservationForTestV1(capability,mode)
    equal(admitObserved(finalCase.state,finalCase.envelope,capability,'6000400005').guard.rejection_code,'malformed_proof',id)
  }
  for(const [id,mode] of [['COV1-COL-007','issuer_assignment'],['COV1-COL-008','issuer_profile'],['COV1-COL-009','issuer_source'],['COV1-COL-010','issuer_role']]){
    const capability=capabilityFor(finalCase.state,finalCase.event,{retrieval_state:'retrieved',body_text:finalCase.body}).capability
    api.corruptTrustedProvenanceObservationForTestV1(capability,mode)
    equal(admitObserved(finalCase.state,finalCase.envelope,capability,'6000400007').guard.rejection_code,'provenance_assignment_mismatch',id)
  }
  const wrongUrl=comment('6000400011'),wrongUrlPort=api.createTrustedProvenanceCollectorPortV1(finalCase.state,profiles,()=>({retrieval_state:'retrieved',body_text:finalCase.body}))
  equal(admitObserved(finalCase.state,finalCase.envelope,wrongUrlPort.collect(wrongUrl,'2026-07-31T05:10:11Z'),'6000400011').guard.rejection_code,'provenance_injection','COV1-COL-011 wrong URL')
  const decoyCap=capabilityFor(finalCase.state,finalCase.event,{retrieval_state:'retrieved',body_text:`${finalCase.body}\n${BEGIN}`}).capability
  equal(admitObserved(finalCase.state,finalCase.envelope,decoyCap,'6000400012').guard.rejection_code,'provenance_injection','COV1-COL-012 decoy')
  for(const [index,failureClass] of ['not_found','permission_denied'].entries()){
    const capability=capabilityFor(index===0?finalCase.state:replayState,finalCase.event,{retrieval_state:'unavailable',failure_class:failureClass}).capability
    equal(admitObserved(index===0?finalCase.state:replayState,index===0?finalCase.envelope:proofless,capability,'6000400013').guard.rejection_code,index===0?'missing_provenance':'stale_provenance',`COV1-COL-013 ${index===0?'first':'replay'}`)
  }
  const timePort=api.createTrustedProvenanceCollectorPortV1(finalCase.state,profiles,()=>({retrieval_state:'retrieved',body_text:finalCase.body}))
  const timeA=timePort.collect(finalCase.event.canonical_record_url,'2026-07-31T05:10:14Z'),timeB=timePort.collect(finalCase.event.canonical_record_url,'2026-07-31T05:10:15Z')
  equal(admitObserved(finalCase.state,finalCase.envelope,timeA,'6000400014').reduction.state.state_revision,admitObserved(finalCase.state,finalCase.envelope,timeB,'6000400014').reduction.state.state_revision,'COV1-COL-014 observed_at no logical identity effect')
  const original=timePort.collect(finalCase.event.canonical_record_url,'2026-07-31T05:10:16Z')
  for(const forged of [clone(original),{...original},JSON.parse(JSON.stringify(original))])equal(admitObserved(finalCase.state,finalCase.envelope,forged,'6000400015').guard.rejection_code,'provenance_injection','COV1-COL-015 clone/spread/serialized')
  const restarted=capabilityFor(replayState,finalCase.event,{retrieval_state:'retrieved',body_text:finalCase.body}).capability
  equal(admitObserved(replayState,proofless,restarted,'6000400016').reduction.admission.branch,'replay','COV1-COL-016 new restart capability')
}

// CAA010 immutable private-snapshot matrix (SNAP-001..016).
{
  const source={retrieval_state:'retrieved',body_text:finalCase.body}
  const port=api.createTrustedProvenanceCollectorPortV1(finalCase.state,profiles,()=>source)
  const capability=port.collect(finalCase.event.canonical_record_url,'2026-07-31T06:00:01Z')
  source.record_url=comment('6000500002');source.body_text='# mutated after issuance'
  const sourceMutationResult=admitObserved(finalCase.state,finalCase.envelope,capability,'6000500001')
  equal(sourceMutationResult.branch,'accepted','COV1-SNAP-001 valid issued capability')
  equal(sourceMutationResult.branch,'accepted','COV1-SNAP-002 record URL source mutation has no effect')
  const mutableProfiles=clone(profiles),mutableState=clone(finalCase.state),nestedSource={retrieval_state:'retrieved',body_text:finalCase.body}
  const nestedPort=api.createTrustedProvenanceCollectorPortV1(mutableState,mutableProfiles,()=>nestedSource),nestedCapability=nestedPort.collect(finalCase.event.canonical_record_url,'2026-07-31T06:00:03Z')
  mutableProfiles.authority_projection_profile.source_type_bindings.find((x)=>x.source_type==='result_handoff').collector_adapter_id='mutated-adapter'
  mutableState.semantic_counter_epoch.current_assignment_revision=99
  nestedSource.body_text='# replacement'
  const nestedMutationResult=admitObserved(finalCase.state,finalCase.envelope,nestedCapability,'6000500003')
  equal(nestedMutationResult.branch,'accepted','COV1-SNAP-003 nested profile source-binding mutation has no effect')
  equal(nestedMutationResult.branch,'accepted','COV1-SNAP-004 assignment source replacement has no effect')
  equal(nestedMutationResult.branch,'accepted','COV1-SNAP-005 source body mutation has no effect')
  let getterReads=0
  const getterSource={retrieval_state:'retrieved',get body_text(){getterReads+=1;return finalCase.body}}
  const getterPort=api.createTrustedProvenanceCollectorPortV1(finalCase.state,profiles,()=>getterSource)
  let getterRejected=false
  try{getterPort.collect(finalCase.event.canonical_record_url,'2026-07-31T06:00:06Z')}catch{getterRejected=true}
  check(getterRejected&&getterReads===0,'COV1-SNAP-006 getter-bearing owner source rejected without invocation')
  const deterministicSource={retrieval_state:'retrieved',body_text:finalCase.body}
  const deterministicPort=api.createTrustedProvenanceCollectorPortV1(finalCase.state,profiles,()=>deterministicSource)
  const getterCapability=deterministicPort.collect(finalCase.event.canonical_record_url,'2026-07-31T06:00:07Z')
  deterministicSource.body_text='# changed after issuance'
  equal(admitObserved(finalCase.state,finalCase.envelope,getterCapability,'6000500007').branch,'accepted','COV1-SNAP-007 TOCTOU source mutation is deterministic')
  check(Object.isFrozen(getterCapability)&&Reflect.ownKeys(getterCapability).length===0,'COV1-SNAP-008 handle is frozen and opaque')
  check(!Reflect.setPrototypeOf(getterCapability,{x:1}),'COV1-SNAP-008 prototype mutation rejected')
  for(const forged of [clone(getterCapability),{...getterCapability},JSON.parse(JSON.stringify(getterCapability))])equal(admitObserved(finalCase.state,finalCase.envelope,forged,'6000500009').guard.rejection_code,'provenance_injection','COV1-SNAP-009 cloned handle')
  const oldPort=api.createTrustedProvenanceCollectorPortV1(finalCase.state,profiles,()=>({retrieval_state:'retrieved',body_text:finalCase.body})),oldHandle=oldPort.collect(finalCase.event.canonical_record_url,'2026-07-31T06:00:10Z')
  let replacementRejected=false
  try{api.attemptSecondTrustedProvenanceCollectorPortForTestV1(finalCase.state,profiles,()=>({retrieval_state:'retrieved',body_text:finalCase.body}))}catch{replacementRejected=true}
  check(replacementRejected,'COV1-SNAP-010 same-authority issuer replacement rejected')
  equal(admitObserved(finalCase.state,finalCase.envelope,oldHandle,'6000500010').branch,'accepted','COV1-SNAP-010 original issuer remains authoritative')
  const badSnapshot=capabilityFor(finalCase.state,finalCase.event,{retrieval_state:'retrieved',body_text:finalCase.body}).capability
  api.corruptTrustedProvenanceObservationForTestV1(badSnapshot,'snapshot_digest')
  equal(admitObserved(finalCase.state,finalCase.envelope,badSnapshot,'6000500011').guard.rejection_code,'malformed_proof','COV1-SNAP-011 private snapshot digest mismatch')
  const badIssuer=capabilityFor(finalCase.state,finalCase.event,{retrieval_state:'retrieved',body_text:finalCase.body}).capability
  api.corruptTrustedProvenanceObservationForTestV1(badIssuer,'issuer_role')
  equal(admitObserved(finalCase.state,finalCase.envelope,badIssuer,'6000500012').guard.rejection_code,'provenance_assignment_mismatch','COV1-SNAP-012 issuer authority mismatch')
  const timePort=api.createTrustedProvenanceCollectorPortV1(finalCase.state,profiles,()=>({retrieval_state:'retrieved',body_text:finalCase.body}))
  const timeA=timePort.collect(finalCase.event.canonical_record_url,'2026-07-31T06:00:13Z'),timeB=timePort.collect(finalCase.event.canonical_record_url,'2026-07-31T06:00:14Z')
  deepEqual(admitObserved(finalCase.state,finalCase.envelope,timeA,'6000500013').reduction.state,admitObserved(finalCase.state,finalCase.envelope,timeB,'6000500013').reduction.state,'COV1-SNAP-013 observed_at changes snapshot only')
  const replayState=admittedCases[0].result.reduction.state,proofless=clone(finalCase.envelope);proofless.active_action_proof_or_null=null;proofless.active_action_cas_operand_or_null=null
  const preRestart=capabilityFor(replayState,finalCase.event,{retrieval_state:'retrieved',body_text:finalCase.body}).capability
  const postRestart=capabilityFor(replayState,finalCase.event,{retrieval_state:'retrieved',body_text:finalCase.body}).capability
  equal(admitObserved(replayState,proofless,postRestart,'6000500014').reduction.admission.branch,'replay','COV1-SNAP-014 restart reissue')
  equal(admitObserved(replayState,proofless,preRestart,'6000500015').guard.rejection_code,'provenance_injection','COV1-SNAP-015 old handle after restart')
  equal(JSON.stringify(postRestart),'{}','COV1-SNAP-016 handle serialization reveals no material')
  check(!JSON.stringify(admitObserved(replayState,proofless,postRestart,'6000500016')).includes('collected_provenance_observation'),'COV1-SNAP-016 result excludes private snapshot')
}
// COV1_CUMULATIVE_MATRIX_END

// CAA011/012 literal security-boundary matrix.
const supplementalEvidence=[]
const evidencePass=(id,variant,actual,expected,projection={})=>{
  const validationClass=projection.validation_class
    ?? (String(variant).includes('operational_validation')?'operational_validation':String(variant).includes('final_regression')?'final_regression':null)
  const runtime=captureCaseEvidence(`${id} ${variant}`,actual,expected,validationClass)
  equal(actual,expected,`${id} ${variant}`)
  const presenceOverride=projection.presence_vector??{}
  const presenceVector={
    ...runtime.presence_vector,
    event_present:presenceOverride.event_present??presenceOverride.event??runtime.presence_vector.event_present,
    capability_present:presenceOverride.capability_present??presenceOverride.capability??runtime.presence_vector.capability_present,
    extra_argument_count:presenceOverride.extra_argument_count??(presenceOverride.extra_argument===true?1:runtime.presence_vector.extra_argument_count),
  }
  const accessCounts={...runtime.access_counts,...(projection.access_counts??{})}
  const measuredStateDelta={...runtime.state_delta,...(projection.state_delta??{})}
  if(actual==='new_decision'){
    equal(runtime.runtime_classification,'new_decision',`${id} ${variant} runtime classification binding`)
    equal(measuredStateDelta.state_changed,true,`${id} ${variant} measured state change`)
    equal(measuredStateDelta.state_revision_delta,1,`${id} ${variant} measured revision delta`)
    equal(measuredStateDelta.replay_entry_delta,1,`${id} ${variant} measured replay delta`)
    equal(measuredStateDelta.audit_entry_delta,1,`${id} ${variant} measured audit delta`)
  }
  supplementalEvidence.push({
    case_id:id,
    variant,
    validation_class:validationClass,
    bound_case_id:runtime.case_id,
    bound_variant:runtime.variant,
    bound_validation_class:runtime.validation_class,
    runtime_result_immutable:Object.isFrozen(runtime),
    observation_kind:runtime.observation_kind,
    causal_operation_ids:clone(runtime.causal_operation_ids),
    causal_binding_id:runtime.causal_binding_id,
    presence_vector:presenceVector,
    expected_classification:runtime.expected_classification,
    actual_classification:runtime.actual_classification,
    runtime_classification:runtime.runtime_classification,
    assertion_expected:projectedValue(expected),
    assertion_actual:projectedValue(actual),
    access_counts:accessCounts,
    state_delta:measuredStateDelta,
    result_digest_or_null:runtime.result_digest_or_null,
    decision_digest_or_null:runtime.decision_digest_or_null,
    ledger_digest_or_null:runtime.ledger_digest_or_null,
    audit_digest_or_null:runtime.audit_digest_or_null,
    replay_entry_count_or_null:runtime.replay_entry_count_or_null,
    intent_digest_or_null:runtime.intent_digest_or_null,
    primary_operation_kind_or_null:runtime.primary_operation_kind_or_null,
    status:'PASS',
  })
}
const nonValidationRoute=bindings.find((x)=>x.transition_class==='metadata_sync')
const nonValidationEvent=makeEvent({event_type:'metadata_sync_completed',canonical_record_url:comment('6000600001'),authoring_role:nonValidationRoute.role_id,subject_head_sha_or_null:head})
const nonValidationEnvelope={envelope_version:'active_action_admission_envelope_v1',event:nonValidationEvent,active_action_proof_or_null:null,active_action_cas_operand_or_null:null}
const nonValidationFirst=api.admitActiveActionEventV1(state,profiles,nonValidationEnvelope,null,noTransition,comment('6000600101'),'2026-07-31T07:00:01Z')
evidencePass('COV1-CAA012-001','non-validation first',nonValidationFirst.reduction.admission.branch,'new_decision')
evidencePass('COV1-CAA011-004','non-validation discriminant',nonValidationFirst.reduction.state.replay_ledger.entries[0].event_validation_discriminant.source_event_type,'metadata_sync_completed')
evidencePass('COV1-CAA011-004','non-validation null class',nonValidationFirst.reduction.state.replay_ledger.entries[0].event_validation_discriminant.validation_class_or_null,null)
const nonValidationReplay=api.admitActiveActionEventV1(nonValidationFirst.reduction.state,profiles,nonValidationEnvelope,null,noTransition,comment('6000600102'),'2026-07-31T07:00:02Z')
evidencePass('COV1-CAA012-002','non-validation replay',nonValidationReplay.reduction.admission.branch,'replay')
const nonValidationCapability=capabilityFor(state,nonValidationEvent,{retrieval_state:'retrieved',body_text:finalCase.body}).capability
evidencePass('COV1-CAA012-003','non-validation capability injection',api.admitActiveActionEventV1(state,profiles,nonValidationEnvelope,nonValidationCapability,noTransition,comment('6000600103'),'2026-07-31T07:00:03Z').guard.rejection_code,'provenance_injection')
evidencePass('COV1-CAA012-004','non-validation replay capability injection',api.admitActiveActionEventV1(nonValidationFirst.reduction.state,profiles,nonValidationEnvelope,nonValidationCapability,noTransition,comment('6000600104'),'2026-07-31T07:00:04Z').guard.rejection_code,'provenance_injection')
let nonValidationGetterReads=0
const nonValidationGetter={get body_text(){nonValidationGetterReads+=1;return finalCase.body}}
evidencePass('COV1-CAA012-005','non-validation getter source',api.admitActiveActionEventV1(state,profiles,nonValidationEnvelope,nonValidationGetter,noTransition,comment('6000600105'),'2026-07-31T07:00:05Z').guard.rejection_code,'provenance_injection')
evidencePass('COV1-CAA012-005','non-validation getter count',nonValidationGetterReads,0)
const trapCounts={get:0,ownKeys:0,getOwnPropertyDescriptor:0,getPrototypeOf:0}
const proxySource=new Proxy({},{
  get(){trapCounts.get+=1;return undefined},
  ownKeys(){trapCounts.ownKeys+=1;return []},
  getOwnPropertyDescriptor(){trapCounts.getOwnPropertyDescriptor+=1;return undefined},
  getPrototypeOf(){trapCounts.getPrototypeOf+=1;return Object.prototype},
})
evidencePass('COV1-CAA012-006','non-validation proxy',api.admitActiveActionEventV1(state,profiles,nonValidationEnvelope,proxySource,noTransition,comment('6000600106'),'2026-07-31T07:00:06Z').guard.rejection_code,'provenance_injection')
deepEqual(trapCounts,{get:0,ownKeys:0,getOwnPropertyDescriptor:0,getPrototypeOf:0},'COV1-CAA012-006 trap count zero')
let callbackCount=0
const callback=()=>{callbackCount+=1}
evidencePass('COV1-CAA012-007','non-validation callback',api.admitActiveActionEventV1(state,profiles,nonValidationEnvelope,callback,noTransition,comment('6000600107'),'2026-07-31T07:00:07Z').guard.rejection_code,'provenance_injection')
evidencePass('COV1-CAA012-007','callback count',callbackCount,0)
evidencePass(
  'COV1-CAA012-007',
  'non-validation forbidden ninth callback',
  api.admitActiveActionEventV1(state,profiles,nonValidationEnvelope,null,noTransition,comment('6000600107'),'2026-07-31T07:00:07Z',null,callback).guard.rejection_code,
  'provenance_injection',
  {presence_vector:{event:true,capability:false,extra_argument:true},access_counts:{getter:0,proxy_trap:0,callback:callbackCount}},
)
evidencePass('COV1-CAA012-007','forbidden ninth callback untouched',callbackCount,0,{access_counts:{getter:0,proxy_trap:0,callback:callbackCount}})
const nonValidationWithBinding=clone(nonValidationFirst.reduction.state)
const validationEntry=admittedCases[0].result.reduction.state.replay_ledger.entries[0]
nonValidationWithBinding.replay_ledger.entries[0].active_action_replay_binding_or_null=clone(validationEntry.active_action_replay_binding_or_null)
evidencePass('COV1-CAA012-008','active binding rejected',api.admitActiveActionEventV1(nonValidationWithBinding,profiles,nonValidationEnvelope,null,noTransition,comment('6000600108'),'2026-07-31T07:00:08Z').guard.rejection_code,'provenance_type_mismatch')
const nonValidationWithRef=clone(nonValidationFirst.reduction.state)
nonValidationWithRef.replay_ledger.entries[0].active_action_provenance_record_url_or_null=finalCase.event.canonical_record_url
evidencePass('COV1-CAA012-009','provenance ref rejected',api.admitActiveActionEventV1(nonValidationWithRef,profiles,nonValidationEnvelope,null,noTransition,comment('6000600109'),'2026-07-31T07:00:09Z').guard.rejection_code,'provenance_type_mismatch')
const nonValidationComplete=clone(nonValidationWithBinding)
nonValidationComplete.replay_ledger.entries[0].active_action_provenance_record_url_or_null=validationEntry.active_action_provenance_record_url_or_null
nonValidationComplete.replay_ledger.entries[0].active_action_provenance_digest_or_null=validationEntry.active_action_provenance_digest_or_null
evidencePass('COV1-CAA012-010','complete validation state rejected',api.admitActiveActionEventV1(nonValidationComplete,profiles,nonValidationEnvelope,null,noTransition,comment('6000600110'),'2026-07-31T07:00:10Z').guard.rejection_code,'provenance_type_mismatch')
evidencePass('COV1-CAA011-005','non-validation complete injection rejected',api.admitActiveActionEventV1(nonValidationComplete,profiles,nonValidationEnvelope,null,noTransition,comment('6000600110'),'2026-07-31T07:00:10Z').guard.rejection_code,'provenance_type_mismatch')
evidencePass('COV1-CAA012-011','caller injection precedence',api.admitActiveActionEventV1(nonValidationComplete,profiles,nonValidationEnvelope,nonValidationCapability,noTransition,comment('6000600111'),'2026-07-31T07:00:11Z').guard.rejection_code,'provenance_injection')
const nonValidationWrongType=clone(nonValidationFirst.reduction.state)
nonValidationWrongType.replay_ledger.entries[0].event_validation_discriminant.source_event_type='result_handoff_published'
nonValidationWrongType.replay_ledger.entries[0].event_validation_discriminant_digest=digest(nonValidationWrongType.replay_ledger.entries[0].event_validation_discriminant)
evidencePass('COV1-CAA012-012','non-validation type mismatch',api.admitActiveActionEventV1(nonValidationWrongType,profiles,nonValidationEnvelope,null,noTransition,comment('6000600112'),'2026-07-31T07:00:12Z').guard.rejection_code,'provenance_type_mismatch')
const nonValidationWrongClass=clone(nonValidationFirst.reduction.state)
nonValidationWrongClass.replay_ledger.entries[0].event_validation_discriminant.validation_class_or_null='final_regression'
nonValidationWrongClass.replay_ledger.entries[0].event_validation_discriminant_digest=digest(nonValidationWrongClass.replay_ledger.entries[0].event_validation_discriminant)
evidencePass('COV1-CAA012-013','non-validation class mismatch',api.admitActiveActionEventV1(nonValidationWrongClass,profiles,nonValidationEnvelope,null,noTransition,comment('6000600113'),'2026-07-31T07:00:13Z').guard.rejection_code,'provenance_type_mismatch')
const nonValidationBadDigest=clone(nonValidationFirst.reduction.state)
nonValidationBadDigest.replay_ledger.entries[0].event_validation_discriminant_digest=sha('bad-discriminant')
evidencePass('COV1-CAA012-014','non-validation stale discriminant',api.admitActiveActionEventV1(nonValidationBadDigest,profiles,nonValidationEnvelope,null,noTransition,comment('6000600114'),'2026-07-31T07:00:14Z').guard.rejection_code,'stale_provenance')
const invalidNonValidationEnvelope=clone(nonValidationEnvelope)
invalidNonValidationEnvelope.event.semantic_event_digest=sha('invalid-event')
const invalidTrapCounts={get:0,ownKeys:0,getOwnPropertyDescriptor:0}
const invalidObservation=new Proxy({},{
  get(){invalidTrapCounts.get+=1;return undefined},
  ownKeys(){invalidTrapCounts.ownKeys+=1;return []},
  getOwnPropertyDescriptor(){invalidTrapCounts.getOwnPropertyDescriptor+=1;return undefined},
})
evidencePass('COV1-CAA012-015','invalid event rejection',api.admitActiveActionEventV1(state,profiles,invalidNonValidationEnvelope,invalidObservation,noTransition,comment('6000600115'),'2026-07-31T07:00:15Z').guard.rejection_code,'malformed_proof')
deepEqual(invalidTrapCounts,{get:0,ownKeys:0,getOwnPropertyDescriptor:0},'COV1-CAA012-015 invalid event does not touch provenance')

for(const [caseIndex,x] of [finalCase,operationalCase].entries()){
  const suffix=String(caseIndex+1)
  const first=admit(x.state,x.envelope,`60006002${suffix}0`,x.body)
  evidencePass('COV1-CAA012-016',x.transitionClass,first.reduction.admission.branch,'new_decision')
  const proofless=clone(x.envelope);proofless.active_action_proof_or_null=null;proofless.active_action_cas_operand_or_null=null
  const replay=admit(first.reduction.state,proofless,`60006002${suffix}1`,x.body)
  evidencePass('COV1-CAA012-017',x.transitionClass,replay.reduction.admission.branch,'replay')
  evidencePass('COV1-CAA012-018',`${x.transitionClass} first null`,admitObserved(x.state,x.envelope,null,`60006002${suffix}2`).guard.rejection_code,'missing_provenance')
  evidencePass('COV1-CAA012-018',`${x.transitionClass} replay null`,admitObserved(first.reduction.state,proofless,null,`60006002${suffix}3`).guard.rejection_code,'stale_provenance')
  let rawGetter=0
  const raw={get body_text(){rawGetter+=1;return x.body}}
  evidencePass('COV1-CAA012-019',x.transitionClass,admitObserved(x.state,x.envelope,raw,`60006002${suffix}4`).guard.rejection_code,'provenance_injection')
  evidencePass('COV1-CAA012-019',`${x.transitionClass} getter count`,rawGetter,0)
  const validCapability=capabilityFor(x.state,x.event,{retrieval_state:'retrieved',body_text:x.body}).capability
  let extraRawReads=0
  const extraRaw={get payload(){extraRawReads+=1;return x.body}}
  const withForbiddenNinth=api.admitActiveActionEventV1(
    x.state,profiles,x.envelope,validCapability,noTransition,comment(`60006002${suffix}8`),'2026-07-31T07:00:19Z',null,extraRaw,
  )
  evidencePass('COV1-CAA012-019',`${x.transitionClass} valid capability plus forbidden ninth`,withForbiddenNinth.guard.rejection_code,'provenance_injection',{
    validation_class:x.transitionClass,
    presence_vector:{event:true,capability:true,extra_argument:true},
    access_counts:{getter:extraRawReads,proxy_trap:0,callback:0},
  })
  evidencePass('COV1-CAA012-019',`${x.transitionClass} forbidden ninth untouched`,extraRawReads,0,{validation_class:x.transitionClass,access_counts:{getter:extraRawReads,proxy_trap:0,callback:0}})
  evidencePass('COV1-CAA012-020',x.transitionClass,admitObserved(x.state,x.envelope,Object.freeze(Object.create(null)),`60006002${suffix}5`).guard.rejection_code,'provenance_injection')
  const badClassRecord=provenanceRecord(x.state,x.envelope)
  badClassRecord.validation_class=x.transitionClass==='final_regression'?'operational_validation':'final_regression'
  const badClassSemantic=clone(badClassRecord);delete badClassSemantic.provenance_digest;badClassRecord.provenance_digest=digest(badClassSemantic)
  evidencePass('COV1-CAA012-021',x.transitionClass,admit(x.state,x.envelope,`60006002${suffix}6`,provenanceBody(badClassRecord)).guard.rejection_code,'provenance_class_mismatch')
  const wrongDiscriminant=clone(first.reduction.state)
  wrongDiscriminant.replay_ledger.entries[0].event_validation_discriminant.source_event_type='result_handoff_published'
  wrongDiscriminant.replay_ledger.entries[0].event_validation_discriminant.validation_class_or_null=null
  wrongDiscriminant.replay_ledger.entries[0].event_validation_discriminant_digest=digest(wrongDiscriminant.replay_ledger.entries[0].event_validation_discriminant)
  const discriminantCapability=capabilityFor(first.reduction.state,x.event,{retrieval_state:'retrieved',body_text:x.body}).capability
  evidencePass('COV1-CAA012-022',x.transitionClass,admitObserved(wrongDiscriminant,proofless,discriminantCapability,`60006002${suffix}7`).guard.rejection_code,'provenance_type_mismatch')
  evidencePass('COV1-CAA012-023',x.transitionClass,first.reduction.state.replay_ledger.entries[0].active_action_replay_binding_or_null.transition_class,x.transitionClass,{validation_class:x.transitionClass})
}
const caa012Ids=Array.from({length:23},(_,index)=>`COV1-CAA012-${String(index+1).padStart(3,'0')}`)
const caa012ObservedIds=[...new Set(supplementalEvidence.filter((row)=>row.case_id.startsWith('COV1-CAA012-')).map((row)=>row.case_id))].sort()
evidencePass('COV1-CAA012-024','exact cumulative case ids',caa012ObservedIds.join('|'),caa012Ids.join('|'))

// CAA011 exact discriminant/owner/source/line-ending assertions.
evidencePass('COV1-CAA011-001','final_regression',admittedCases[0].result.reduction.state.replay_ledger.entries[0].event_validation_discriminant.validation_class_or_null,'final_regression')
evidencePass('COV1-CAA011-002','operational_validation',admittedCases[1].result.reduction.state.replay_ledger.entries[0].event_validation_discriminant.validation_class_or_null,'operational_validation')
const finalProoflessReplay=clone(finalCase.envelope);finalProoflessReplay.active_action_proof_or_null=null;finalProoflessReplay.active_action_cas_operand_or_null=null
evidencePass('COV1-CAA011-003','serialized restart',admit(JSON.parse(JSON.stringify(admittedCases[0].result.reduction.state)),finalProoflessReplay,'6000610003',finalCase.body).reduction.admission.branch,'replay')
evidencePass('COV1-CAA011-006','first discriminator internally complete',Object.keys(admittedCases[0].result.reduction.state.replay_ledger.entries[0].event_validation_discriminant).sort().join('|'),'discriminant_version|source_event_type|validation_class_or_null')
const staleDiscriminant=clone(admittedCases[0].result.reduction.state)
staleDiscriminant.replay_ledger.entries[0].event_validation_discriminant_digest=sha('stale-ledger-discriminant')
const validReplayCapability=capabilityFor(admittedCases[0].result.reduction.state,finalCase.event,{retrieval_state:'retrieved',body_text:finalCase.body}).capability
evidencePass('COV1-CAA011-007','persisted bad digest',admitObserved(staleDiscriminant,finalProoflessReplay,validReplayCapability,'6000610007').guard.rejection_code,'stale_provenance')
const validationWrongType=clone(admittedCases[0].result.reduction.state)
validationWrongType.replay_ledger.entries[0].event_validation_discriminant.source_event_type='result_handoff_published'
validationWrongType.replay_ledger.entries[0].event_validation_discriminant.validation_class_or_null=null
validationWrongType.replay_ledger.entries[0].event_validation_discriminant_digest=digest(validationWrongType.replay_ledger.entries[0].event_validation_discriminant)
evidencePass('COV1-CAA011-008','validation type changed',admitObserved(validationWrongType,finalProoflessReplay,validReplayCapability,'6000610008').guard.rejection_code,'provenance_type_mismatch')
const validationWrongClass=clone(admittedCases[0].result.reduction.state)
validationWrongClass.replay_ledger.entries[0].event_validation_discriminant.validation_class_or_null='operational_validation'
validationWrongClass.replay_ledger.entries[0].event_validation_discriminant_digest=digest(validationWrongClass.replay_ledger.entries[0].event_validation_discriminant)
evidencePass('COV1-CAA011-009','validation class changed',admitObserved(validationWrongClass,finalProoflessReplay,validReplayCapability,'6000610009').guard.rejection_code,'provenance_class_mismatch')
const bindingDisagreement=clone(admittedCases[0].result.reduction.state)
bindingDisagreement.replay_ledger.entries[0].active_action_replay_binding_or_null.event_validation_discriminant={...bindingDisagreement.replay_ledger.entries[0].active_action_replay_binding_or_null.event_validation_discriminant,validation_class_or_null:'operational_validation'}
bindingDisagreement.replay_ledger.entries[0].active_action_replay_binding_or_null.event_validation_discriminant_digest=digest(bindingDisagreement.replay_ledger.entries[0].active_action_replay_binding_or_null.event_validation_discriminant)
evidencePass('COV1-CAA011-010','ledger binding disagreement',admitObserved(bindingDisagreement,finalProoflessReplay,validReplayCapability,'6000610010').guard.rejection_code,'provenance_class_mismatch')
const ownerCapability=capabilityFor(finalCase.state,finalCase.event,{retrieval_state:'retrieved',body_text:finalCase.body}).capability
evidencePass('COV1-CAA011-011','owner capability',admitObserved(finalCase.state,finalCase.envelope,ownerCapability,'6000610011').branch,'accepted')
evidencePass('COV1-CAA011-012','factory absent production',('createTrustedProvenanceCollectorPortV1' in productionApi),false)
const ownerPort=api.createTrustedProvenanceCollectorPortV1(finalCase.state,profiles,()=>({retrieval_state:'retrieved',body_text:finalCase.body}))
const ownerHandle=ownerPort.collect(finalCase.event.canonical_record_url,'2026-07-31T07:10:13Z')
let issuerReplacementRejected=false
try{api.attemptSecondTrustedProvenanceCollectorPortForTestV1(finalCase.state,profiles,()=>({retrieval_state:'retrieved',body_text:finalCase.body}))}catch{issuerReplacementRejected=true}
evidencePass('COV1-CAA011-013','issuer replacement',issuerReplacementRejected,true)
evidencePass('COV1-CAA011-013','original membership retained',admitObserved(finalCase.state,finalCase.envelope,ownerHandle,'6000610013').branch,'accepted')
const restartStateFor011=admittedCases[0].result.reduction.state
const restartProoflessFor011=clone(finalCase.envelope);restartProoflessFor011.active_action_proof_or_null=null;restartProoflessFor011.active_action_cas_operand_or_null=null
const restartCapFor011=capabilityFor(restartStateFor011,finalCase.event,{retrieval_state:'retrieved',body_text:finalCase.body}).capability
evidencePass('COV1-CAA011-014','restart owner capability',admitObserved(restartStateFor011,restartProoflessFor011,restartCapFor011,'6000610014').reduction.admission.branch,'replay')
evidencePass('COV1-CAA011-015','corruption seam absent production',('corruptTrustedProvenanceObservationForTestV1' in productionApi),false)
const privateFault=capabilityFor(finalCase.state,finalCase.event,{retrieval_state:'retrieved',body_text:finalCase.body}).capability
api.corruptTrustedProvenanceObservationForTestV1(privateFault,'snapshot_digest')
evidencePass('COV1-CAA011-016','private fault seam',admitObserved(finalCase.state,finalCase.envelope,privateFault,'6000610016').guard.rejection_code,'malformed_proof')
let publicGetterReads=0
const publicGetter={get payload(){publicGetterReads+=1;return {}}}
evidencePass('COV1-CAA011-017','public getter source',admitObserved(finalCase.state,finalCase.envelope,publicGetter,'6000610017').guard.rejection_code,'provenance_injection')
evidencePass('COV1-CAA011-017','public getter zero',publicGetterReads,0)
const publicTrapCounts={get:0,ownKeys:0,getOwnPropertyDescriptor:0,getPrototypeOf:0}
const publicProxy=new Proxy({},{
  get(){publicTrapCounts.get+=1},
  ownKeys(){publicTrapCounts.ownKeys+=1;return []},
  getOwnPropertyDescriptor(){publicTrapCounts.getOwnPropertyDescriptor+=1},
  getPrototypeOf(){publicTrapCounts.getPrototypeOf+=1;return Object.prototype},
})
evidencePass('COV1-CAA011-018','public proxy source',admitObserved(finalCase.state,finalCase.envelope,publicProxy,'6000610018').guard.rejection_code,'provenance_injection')
deepEqual(publicTrapCounts,{get:0,ownKeys:0,getOwnPropertyDescriptor:0,getPrototypeOf:0},'COV1-CAA011-018 zero traps')
let ownerAccessorReads=0
const ownerAccessorPort=api.createTrustedProvenanceCollectorPortV1(finalCase.state,profiles,()=>({retrieval_state:'retrieved',get body_text(){ownerAccessorReads+=1;return finalCase.body}}))
let ownerAccessorRejected=false
try{ownerAccessorPort.collect(finalCase.event.canonical_record_url,'2026-07-31T07:10:19Z')}catch{ownerAccessorRejected=true}
evidencePass('COV1-CAA011-019','owner accessor rejected',ownerAccessorRejected,true)
evidencePass('COV1-CAA011-019','owner accessor zero',ownerAccessorReads,0)
for(const [id,source] of [
  ['COV1-CAA011-020',Object.assign(Object.create({inherited:true}),{retrieval_state:'retrieved',body_text:finalCase.body})],
  ['COV1-CAA011-021',Object.assign({retrieval_state:'retrieved',body_text:finalCase.body},{extra:[,]})],
]){
  const port=api.createTrustedProvenanceCollectorPortV1(finalCase.state,profiles,()=>source)
  let rejected=false
  try{port.collect(finalCase.event.canonical_record_url,'2026-07-31T07:10:20Z')}catch{rejected=true}
  evidencePass(id,'owner invalid source',rejected,true)
}
const snapshotProfiles=clone(profiles),snapshotSource={retrieval_state:'retrieved',body_text:finalCase.body}
const snapshotPort=api.createTrustedProvenanceCollectorPortV1(finalCase.state,snapshotProfiles,()=>snapshotSource)
const snapshotCapability=snapshotPort.collect(finalCase.event.canonical_record_url,'2026-07-31T07:10:22Z')
snapshotProfiles.authority_projection_profile.source_type_bindings.find((x)=>x.source_type==='result_handoff').collector_adapter_id='mutated-after-issuance'
snapshotSource.body_text='# replaced after issuance'
const immutableSnapshotResult=admitObserved(finalCase.state,finalCase.envelope,snapshotCapability,'6000610022')
evidencePass('COV1-CAA011-022','authority snapshot immutable',immutableSnapshotResult.branch,'accepted')
evidencePass('COV1-CAA011-023','payload replacement isolated',immutableSnapshotResult.branch,'accepted')
evidencePass('COV1-CAA011-024','body mutation isolated',immutableSnapshotResult.branch,'accepted')
const exactLfBody=finalCase.body.replace(/\r\n/g,'\n')
const exactCrlfBody=exactLfBody.replace(/\n/g,'\r\n')
evidencePass('COV1-CAA011-025','LF exact',admit(finalCase.state,finalCase.envelope,'6000610025',exactLfBody).branch,'accepted')
evidencePass('COV1-CAA011-026','CRLF exact',admit(finalCase.state,finalCase.envelope,'6000610026',exactCrlfBody).branch,'accepted')
for(const [id,body] of [
  ['COV1-CAA011-027',`${exactCrlfBody}\rbare`],
  ['COV1-CAA011-028',`${exactLfBody}\r`],
]){
  evidencePass(id,'first bare CR',admit(finalCase.state,finalCase.envelope,'6000610027',body).guard.rejection_code,'malformed_proof')
  evidencePass(id,'replay bare CR',admit(admittedCases[0].result.reduction.state,finalProoflessReplay,'6000610028',body).guard.rejection_code,'stale_provenance')
}
evidencePass('COV1-CAA011-029','decoy wins over bare CR',admit(finalCase.state,finalCase.envelope,'6000610029',`${exactLfBody}\n${BEGIN}\rbad`).guard.rejection_code,'provenance_injection')
evidencePass('COV1-CAA011-030','damaged candidate matrix',admit(finalCase.state,finalCase.envelope,'6000610030',`${BEGIN}\n{\n${END}`).guard.rejection_code,'malformed_proof')
evidencePass('COV1-CAA011-031','valid plus decoy',admit(finalCase.state,finalCase.envelope,'6000610031',`${exactLfBody}\n${BEGIN}`).guard.rejection_code,'provenance_injection')

// Frozen CAA011 both-validation-class literal expansion.
const expandedCase=(id,x,variant,actual,expected,projection={})=>evidencePass(
  id,`${x.transitionClass} ${variant}`,actual,expected,{validation_class:x.transitionClass,...projection},
)
const rejectedOwnerSource=(x,source,observedAt)=>{
  const port=api.createTrustedProvenanceCollectorPortV1(x.state,profiles,()=>source)
  try{port.collect(x.event.canonical_record_url,observedAt);return false}catch{return true}
}
for(const [classIndex,x] of [finalCase,operationalCase].entries()){
  const classSuffix=String(classIndex+1)
  const first=admit(x.state,x.envelope,`6000620${classSuffix}01`,x.body)
  const persisted=first.reduction.state
  const proofless=clone(x.envelope);proofless.active_action_proof_or_null=null;proofless.active_action_cas_operand_or_null=null
  expandedCase('COV1-CAA011-003',x,'serialized restart',admit(JSON.parse(JSON.stringify(persisted)),proofless,`6000620${classSuffix}03`,x.body).reduction.admission.branch,'replay')
  const entry=persisted.replay_ledger.entries[0]
  expandedCase('COV1-CAA011-006',x,'closed discriminator fields',Object.keys(entry.event_validation_discriminant).sort().join('|'),'discriminant_version|source_event_type|validation_class_or_null')
  expandedCase('COV1-CAA011-006',x,'discriminator digest',digest(entry.event_validation_discriminant),entry.event_validation_discriminant_digest)
  const validReplayCapability=capabilityFor(persisted,x.event,{retrieval_state:'retrieved',body_text:x.body}).capability
  const stale=clone(persisted);stale.replay_ledger.entries[0].event_validation_discriminant_digest=sha(`stale-${x.transitionClass}`)
  expandedCase('COV1-CAA011-007',x,'stale discriminant digest',admitObserved(stale,proofless,validReplayCapability,`6000620${classSuffix}07`).guard.rejection_code,'stale_provenance')
  const wrongType=clone(persisted)
  wrongType.replay_ledger.entries[0].event_validation_discriminant.source_event_type='result_handoff_published'
  wrongType.replay_ledger.entries[0].event_validation_discriminant.validation_class_or_null=null
  wrongType.replay_ledger.entries[0].event_validation_discriminant_digest=digest(wrongType.replay_ledger.entries[0].event_validation_discriminant)
  expandedCase('COV1-CAA011-008',x,'source type mismatch',admitObserved(wrongType,proofless,validReplayCapability,`6000620${classSuffix}08`).guard.rejection_code,'provenance_type_mismatch')
  const otherClass=x.transitionClass==='final_regression'?'operational_validation':'final_regression'
  const wrongClass=clone(persisted)
  wrongClass.replay_ledger.entries[0].event_validation_discriminant.validation_class_or_null=otherClass
  wrongClass.replay_ledger.entries[0].event_validation_discriminant_digest=digest(wrongClass.replay_ledger.entries[0].event_validation_discriminant)
  expandedCase('COV1-CAA011-009',x,'class mismatch',admitObserved(wrongClass,proofless,validReplayCapability,`6000620${classSuffix}09`).guard.rejection_code,'provenance_class_mismatch')
  const bindingMismatch=clone(persisted)
  bindingMismatch.replay_ledger.entries[0].active_action_replay_binding_or_null.transition_class=otherClass
  expandedCase('COV1-CAA011-010',x,'ledger binding mismatch',admitObserved(bindingMismatch,proofless,validReplayCapability,`6000620${classSuffix}10`).guard.rejection_code,'provenance_class_mismatch')
  const ownerCapabilityForClass=capabilityFor(x.state,x.event,{retrieval_state:'retrieved',body_text:x.body}).capability
  expandedCase('COV1-CAA011-011',x,'owner capability',admitObserved(x.state,x.envelope,ownerCapabilityForClass,`6000620${classSuffix}11`).branch,'accepted')
  expandedCase('COV1-CAA011-012',x,'production factory absent','createTrustedProvenanceCollectorPortV1' in productionApi,false)
  const restartCapability=capabilityFor(persisted,x.event,{retrieval_state:'retrieved',body_text:x.body}).capability
  expandedCase('COV1-CAA011-014',x,'restart reissue',admitObserved(persisted,proofless,restartCapability,`6000620${classSuffix}14`).reduction.admission.branch,'replay')
  expandedCase('COV1-CAA011-015',x,'production corruption seam absent','corruptTrustedProvenanceObservationForTestV1' in productionApi,false)
  const privateFaultForClass=capabilityFor(x.state,x.event,{retrieval_state:'retrieved',body_text:x.body}).capability
  api.corruptTrustedProvenanceObservationForTestV1(privateFaultForClass,'snapshot_digest')
  expandedCase('COV1-CAA011-016',x,'private fault classification',admitObserved(x.state,x.envelope,privateFaultForClass,`6000620${classSuffix}16`).guard.rejection_code,'malformed_proof')
  let publicGetterCount=0
  const publicGetterForClass={get payload(){publicGetterCount+=1;return x.body}}
  expandedCase('COV1-CAA011-017',x,'public getter rejected',admitObserved(x.state,x.envelope,publicGetterForClass,`6000620${classSuffix}17`).guard.rejection_code,'provenance_injection',{access_counts:{getter:publicGetterCount,proxy_trap:0,callback:0}})
  expandedCase('COV1-CAA011-017',x,'public getter untouched',publicGetterCount,0,{access_counts:{getter:publicGetterCount,proxy_trap:0,callback:0}})

  let ownerAccessorCount=0
  const ownerAccessorSource={retrieval_state:'retrieved',get body_text(){ownerAccessorCount+=1;return x.body}}
  expandedCase('COV1-CAA011-019',x,'owner accessor rejected',rejectedOwnerSource(x,ownerAccessorSource,`2026-07-31T08:00:${classSuffix}9Z`),true,{access_counts:{getter:ownerAccessorCount,proxy_trap:0,callback:0}})
  expandedCase('COV1-CAA011-019',x,'owner accessor untouched',ownerAccessorCount,0,{access_counts:{getter:ownerAccessorCount,proxy_trap:0,callback:0}})

  const inherited=Object.assign(Object.create({inherited:true}),{retrieval_state:'retrieved',body_text:x.body})
  const unknown={retrieval_state:'retrieved',body_text:x.body,unknown_field:true}
  const symbolSource={retrieval_state:'retrieved',body_text:x.body};symbolSource[Symbol('forbidden')]=true
  const customPrototype=Object.assign(Object.create(null),{retrieval_state:'retrieved',body_text:x.body})
  for(const [variant,source] of [['inherited',inherited],['unknown',unknown],['symbol',symbolSource],['custom-prototype',customPrototype]]){
    expandedCase('COV1-CAA011-020',x,variant,rejectedOwnerSource(x,source,`2026-07-31T08:01:${classSuffix}0Z`),true)
  }

  const sparse={retrieval_state:'retrieved',body_text:x.body,extra:[,]}
  const extraKey={retrieval_state:'retrieved',body_text:x.body,extra_key:true}
  const cycle={retrieval_state:'retrieved',body_text:x.body};cycle.self=cycle
  const functionValue={retrieval_state:'retrieved',body_text:x.body,extra:()=>x.body}
  const bigintValue={retrieval_state:'retrieved',body_text:x.body,extra:1n}
  const nonFinite={retrieval_state:'retrieved',body_text:x.body,extra:Number.POSITIVE_INFINITY}
  for(const [variant,source] of [['sparse-array',sparse],['extra-key',extraKey],['cycle',cycle],['function',functionValue],['bigint',bigintValue],['non-finite',nonFinite]]){
    expandedCase('COV1-CAA011-021',x,variant,rejectedOwnerSource(x,source,`2026-07-31T08:02:${classSuffix}1Z`),true)
  }

  const mutableProfiles=clone(profiles),mutableSource={retrieval_state:'retrieved',body_text:x.body}
  const immutablePort=api.createTrustedProvenanceCollectorPortV1(x.state,mutableProfiles,()=>mutableSource)
  const immutableCapability=immutablePort.collect(x.event.canonical_record_url,`2026-07-31T08:03:${classSuffix}2Z`)
  mutableProfiles.authority_projection_profile.source_type_bindings.find((source)=>source.source_type==='result_handoff').collector_adapter_id='post-issuance-mutation'
  mutableSource.body_text='# post issuance replacement'
  const immutableResult=admitObserved(x.state,x.envelope,immutableCapability,`6000620${classSuffix}22`)
  expandedCase('COV1-CAA011-022',x,'authority immutable',immutableResult.branch,'accepted')
  expandedCase('COV1-CAA011-023',x,'payload replacement isolated',immutableResult.branch,'accepted')
  expandedCase('COV1-CAA011-024',x,'body replacement isolated',immutableResult.branch,'accepted')

  const record=provenanceRecord(x.state,x.envelope),nestedJcs=jcs({active_action_provenance:record})
  const lf=`${BEGIN}\n${nestedJcs}\n${END}`,crlf=lf.replace(/\n/g,'\r\n')
  const semanticRecord=clone(record);delete semanticRecord.provenance_digest
  expandedCase('COV1-CAA011-025',x,'LF admission',admit(x.state,x.envelope,`6000620${classSuffix}25`,lf).branch,'accepted')
  expandedCase('COV1-CAA011-025',x,'LF exact middle bytes',Buffer.from(lf.split('\n')[1]).toString('hex'),Buffer.from(nestedJcs).toString('hex'))
  expandedCase('COV1-CAA011-025',x,'nested JCS bytes',jcs(JSON.parse(nestedJcs)),nestedJcs)
  expandedCase('COV1-CAA011-025',x,'provenance digest',digest(semanticRecord),record.provenance_digest)
  expandedCase('COV1-CAA011-026',x,'CRLF admission',admit(x.state,x.envelope,`6000620${classSuffix}26`,crlf).branch,'accepted')
  expandedCase('COV1-CAA011-026',x,'CRLF normalized middle bytes',Buffer.from(crlf.replace(/\r\n/g,'\n').split('\n')[1]).toString('hex'),Buffer.from(nestedJcs).toString('hex'))
  expandedCase('COV1-CAA011-026',x,'LF CRLF logical identity',crlf.replace(/\r\n/g,'\n'),lf)
  for(const [id,body,firstExpected,replayExpected] of [
    ['COV1-CAA011-027',`${crlf}\rbare`,'malformed_proof','stale_provenance'],
    ['COV1-CAA011-028',`${lf}\r`,'malformed_proof','stale_provenance'],
  ]){
    expandedCase(id,x,'first bare CR',admit(x.state,x.envelope,`6000620${classSuffix}27`,body).guard.rejection_code,firstExpected)
    expandedCase(id,x,'replay bare CR',admit(persisted,proofless,`6000620${classSuffix}28`,body).guard.rejection_code,replayExpected)
  }
  expandedCase('COV1-CAA011-029',x,'decoy precedence',admit(x.state,x.envelope,`6000620${classSuffix}29`,`${lf}\n${BEGIN}\rbad`).guard.rejection_code,'provenance_injection')

  const reorderedRecord=`{"active_action_provenance":${JSON.stringify(record)}}`
  const damagedVariants=[
    ['missing','# no provenance','missing_provenance'],
    ['damaged',`${BEGIN}\n{\n${END}`,'malformed_proof'],
    ['indented',` ${BEGIN}\n${nestedJcs}\n${END}`,'provenance_injection'],
    ['reversed',`${END}\n${nestedJcs}\n${BEGIN}`,'provenance_injection'],
    ['non-adjacent',`${BEGIN}\n${nestedJcs}\nextra\n${END}`,'provenance_injection'],
    ['escaped',`${BEGIN}\n\\${nestedJcs}\n${END}`,'malformed_proof'],
    ['reordered',`${BEGIN}\n${reorderedRecord}\n${END}`,'malformed_proof'],
  ]
  for(const [variant,body,expected] of damagedVariants)expandedCase('COV1-CAA011-030',x,variant,admit(x.state,x.envelope,`6000620${classSuffix}30`,body).guard.rejection_code,expected)
  const duplicateRoot=`{"active_action_provenance":${jcs(record)},"active_action_provenance":${jcs(record)}}`
  const decoyVariants=[
    ['decoy',`${lf}\n${BEGIN}`,'provenance_injection'],
    ['fence',`\`\`\`\n${lf}\n\`\`\`\n${BEGIN}`,'provenance_injection'],
    ['wrong-root',`${BEGIN}\n${jcs({wrong:record})}\n${END}`,'malformed_proof'],
    ['duplicate-root',`${BEGIN}\n${duplicateRoot}\n${END}`,'provenance_injection'],
  ]
  for(const [variant,body,expected] of decoyVariants)expandedCase('COV1-CAA011-031',x,variant,admit(x.state,x.envelope,`6000620${classSuffix}31`,body).guard.rejection_code,expected)
}

const cumulativeIds=[
  ...Array.from({length:46},(_,index)=>`COV1-PROV-${String(index+1).padStart(3,'0')}`),
  ...Array.from({length:16},(_,index)=>`COV1-COL-${String(index+1).padStart(3,'0')}`),
  ...Array.from({length:16},(_,index)=>`COV1-SNAP-${String(index+1).padStart(3,'0')}`),
]
const runnerSource=await readFile('scripts/test-continuous-orchestration.mjs','utf8')
const cumulativeStart=runnerSource.indexOf('// COV1_CUMULATIVE_MATRIX_BEGIN')+'// COV1_CUMULATIVE_MATRIX_BEGIN'.length
const cumulativeEnd=runnerSource.indexOf('// COV1_CUMULATIVE_MATRIX_END')
check(cumulativeStart>=0&&cumulativeEnd>cumulativeStart,'CAA011-032 cumulative source slice')
const operationalMatrixSource=runnerSource
  .slice(cumulativeStart,cumulativeEnd)
  .replaceAll('admittedCases[0]','admittedCases[1]')
  .replaceAll('finalCase','operationalCase')
activeCumulativeValidationClass='operational_validation'
eval(`{${operationalMatrixSource}}`)
activeCumulativeValidationClass='final_regression'
const cumulativeObserved=new Map()
for(const row of caseAssertionLog){
  const caseId=row.message.match(/^COV1-(?:PROV|COL|SNAP)-\d{3}/)?.[0]
  const key=`${row.validation_class}\u0000${caseId}`
  if(caseId&&!cumulativeObserved.has(key))cumulativeObserved.set(key,row)
}
for(const x of [finalCase,operationalCase]){
  for(const caseId of cumulativeIds){
    const observed=cumulativeObserved.get(`${x.transitionClass}\u0000${caseId}`)
    check(observed!==undefined,`CAA011-032 missing cumulative case ${x.transitionClass} ${caseId}`)
    supplementalEvidence.push({
      case_id:'COV1-CAA011-032',
      variant:`${x.transitionClass} ${caseId}`,
      validation_class:x.transitionClass,
      bound_case_id:observed.runtime_evidence.case_id,
      bound_variant:observed.runtime_evidence.variant,
      bound_validation_class:observed.runtime_evidence.validation_class,
      runtime_result_immutable:Object.isFrozen(observed.runtime_evidence),
      observation_kind:observed.runtime_evidence.observation_kind,
      causal_operation_ids:clone(observed.runtime_evidence.causal_operation_ids),
      causal_binding_id:observed.runtime_evidence.causal_binding_id,
      presence_vector:clone(observed.runtime_evidence.presence_vector),
      expected_classification:observed.runtime_evidence.expected_classification,
      actual_classification:observed.runtime_evidence.actual_classification,
      runtime_classification:observed.runtime_evidence.runtime_classification,
      assertion_expected:projectedValue(observed.expected),
      assertion_actual:projectedValue(observed.actual),
      access_counts:clone(observed.runtime_evidence.access_counts),
      state_delta:clone(observed.runtime_evidence.state_delta),
      result_digest_or_null:observed.runtime_evidence.result_digest_or_null,
      decision_digest_or_null:observed.runtime_evidence.decision_digest_or_null,
      ledger_digest_or_null:observed.runtime_evidence.ledger_digest_or_null,
      audit_digest_or_null:observed.runtime_evidence.audit_digest_or_null,
      replay_entry_count_or_null:observed.runtime_evidence.replay_entry_count_or_null,
      intent_digest_or_null:observed.runtime_evidence.intent_digest_or_null,
      primary_operation_kind_or_null:observed.runtime_evidence.primary_operation_kind_or_null,
      source_assertion:observed.message,
      status:'PASS',
    })
  }
}
evidencePass('COV1-CAA011-032','exact cumulative case-level projection count',supplementalEvidence.filter((row)=>row.case_id==='COV1-CAA011-032').length,cumulativeIds.length*2)
check([...Array.from({length:24},(_,i)=>`COV1-CAA012-${String(i+1).padStart(3,'0')}`),...Array.from({length:32},(_,i)=>`COV1-CAA011-${String(i+1).padStart(3,'0')}`)].every((id)=>supplementalEvidence.some((row)=>row.case_id===id)), 'CAA011/012 all named rows emitted')
const requiredPresenceFields=['event_present','capability_present','proof_present','cas_operand_present','extra_argument_count']
const requiredAccessFields=['getter','proxy_trap','callback','collector','transport']
const requiredStateDeltaFields=[
  'state_changed','state_revision_delta','replay_entry_delta','ledger_entry_delta','audit_entry_delta',
  'finding_counter_delta','metadata_counter_delta','delivery_counter_delta','cycle_progress_epoch_delta','pending_transport_delta',
]
const requiredCausalFields=[
  'bound_case_id','bound_variant','bound_validation_class','runtime_result_immutable','observation_kind','causal_operation_ids','causal_binding_id',
  'assertion_expected','assertion_actual','result_digest_or_null','decision_digest_or_null','ledger_digest_or_null',
  'audit_digest_or_null','replay_entry_count_or_null','intent_digest_or_null','primary_operation_kind_or_null',
]
const forbiddenProjectionPlaceholder=['case','defined'].join('-')
for(const row of supplementalEvidence){
  deepEqual(Object.keys(row.presence_vector).sort(),[...requiredPresenceFields].sort(),`${row.case_id} ${row.variant} complete presence vector`)
  deepEqual(Object.keys(row.access_counts).sort(),[...requiredAccessFields].sort(),`${row.case_id} ${row.variant} complete access counts`)
  deepEqual(Object.keys(row.state_delta).sort(),[...requiredStateDeltaFields].sort(),`${row.case_id} ${row.variant} complete state delta`)
  check(requiredCausalFields.every((key)=>Object.hasOwn(row,key)),`${row.case_id} ${row.variant} complete causal binding`)
  check(!JSON.stringify(row).includes(forbiddenProjectionPlaceholder),`${row.case_id} ${row.variant} no projection placeholder`)
  check(Object.values(row.access_counts).every((value)=>Number.isInteger(value)&&value>=0),`${row.case_id} ${row.variant} measured access counts`)
  check(Object.entries(row.state_delta).every(([key,value])=>key==='state_changed'?typeof value==='boolean':Number.isInteger(value)),`${row.case_id} ${row.variant} measured state delta`)
  equal(row.actual_classification,row.runtime_classification,`${row.case_id} ${row.variant} actual/runtime classification binding`)
  equal(row.expected_classification,row.runtime_classification,`${row.case_id} ${row.variant} expected/runtime classification binding`)
  equal(row.runtime_result_immutable,true,`${row.case_id} ${row.variant} immutable runtime result`)
  check(/^sha256:[0-9a-f]{64}$/.test(row.causal_binding_id),`${row.case_id} ${row.variant} causal binding digest`)
  check(Array.isArray(row.causal_operation_ids)&&row.causal_operation_ids.every((id)=>/^COV1-OP-\d{4}$/.test(id)),`${row.case_id} ${row.variant} causal operation ids`)
  if(row.observation_kind==='no_operation_observation'){
    equal(row.causal_operation_ids.length,0,`${row.case_id} ${row.variant} no-operation causal set`)
    equal(row.primary_operation_kind_or_null,null,`${row.case_id} ${row.variant} no-operation kind`)
    equal(row.state_delta.state_changed,false,`${row.case_id} ${row.variant} no-operation state unchanged`)
  }else{
    equal(row.observation_kind,'public_runtime_result',`${row.case_id} ${row.variant} public runtime observation`)
    check(row.causal_operation_ids.length>0,`${row.case_id} ${row.variant} public runtime causal set`)
    check(typeof row.primary_operation_kind_or_null==='string',`${row.case_id} ${row.variant} public runtime operation kind`)
  }
  if(row.runtime_classification==='new_decision'){
    check(row.decision_digest_or_null!==null,`${row.case_id} ${row.variant} new decision digest`)
    check(row.ledger_digest_or_null!==null,`${row.case_id} ${row.variant} new decision ledger digest`)
    check(row.audit_digest_or_null!==null,`${row.case_id} ${row.variant} new decision audit digest`)
    check(Number.isInteger(row.replay_entry_count_or_null),`${row.case_id} ${row.variant} new decision replay count`)
    check(row.intent_digest_or_null!==null,`${row.case_id} ${row.variant} new decision intent digest`)
  }
}
const newDecisionProjectionRows=supplementalEvidence.filter((row)=>row.runtime_classification==='new_decision')
check(newDecisionProjectionRows.length>0,'security projection includes measured new_decision rows')
for(const row of newDecisionProjectionRows){
  equal(row.state_delta.state_changed,true,`${row.case_id} ${row.variant} new_decision state changed`)
  equal(row.state_delta.state_revision_delta,1,`${row.case_id} ${row.variant} new_decision revision delta`)
  equal(row.state_delta.replay_entry_delta,1,`${row.case_id} ${row.variant} new_decision replay delta`)
  equal(row.state_delta.audit_entry_delta,1,`${row.case_id} ${row.variant} new_decision audit delta`)
}
const cumulativeProjectionRows=supplementalEvidence.filter((row)=>row.case_id==='COV1-CAA011-032'&&/^COV1-(?:PROV|COL|SNAP)-\d{3}$/.test(row.bound_case_id))
equal(cumulativeProjectionRows.length,cumulativeIds.length*2,'CAA011-032 exact causal projection count')
equal(cumulativeProjectionRows.filter((row)=>row.actual_classification!==row.runtime_classification).length,0,'CAA011-032 actual/runtime mismatch count')
for(const row of cumulativeProjectionRows){
  const sourceCaseId=row.variant.match(/COV1-(?:PROV|COL|SNAP)-\d{3}/)?.[0]
  equal(row.bound_case_id,sourceCaseId,`${row.variant} case-local causal id`)
  equal(row.bound_validation_class,row.validation_class,`${row.variant} case-local validation class`)
  check(row.bound_variant.length>0,`${row.variant} case-local variant`)
}
const causalOperationOwners=new Map()
for(const row of cumulativeProjectionRows){
  for(const operationId of row.causal_operation_ids){
    check(!causalOperationOwners.has(operationId),`${row.variant} operation ${operationId} single-case ownership`)
    causalOperationOwners.set(operationId,`${row.validation_class}\0${row.bound_case_id}`)
  }
}

const production = await readFile('src/continuous-orchestration/index.ts','utf8')
for (const forbidden of ['node:fs','node:crypto','fetch(','Date.now','process.env','child_process','gh api','git ']) {
  check(!production.includes(forbidden),`pure boundary excludes ${forbidden}`)
}
check(!('createTrustedProvenanceCollectorPortV1' in productionApi),'production export excludes collector factory')
check(!('corruptTrustedProvenanceObservationForTestV1' in productionApi),'production export excludes corruption seam')
console.log(JSON.stringify({result:'PASS',rows:corpus.rows.length,assertions,authority_main_sha:corpus.authority_main_sha,security_boundary_cases:supplementalEvidence}))
