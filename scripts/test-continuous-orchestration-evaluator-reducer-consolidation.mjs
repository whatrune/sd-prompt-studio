import assert from 'node:assert/strict'
import {execFileSync,spawnSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createServer} from 'vite'

const fixture=JSON.parse(await readFile('scripts/fixtures/continuous-orchestration-evaluator-reducer-consolidation-v1.json','utf8'))
const clone=structuredClone,sha=v=>createHash('sha256').update(v).digest('hex')
const jsonValue=v=>JSON.parse(JSON.stringify(v,(_key,value)=>value===undefined?null:value))
const jcs=v=>{if(v===null||typeof v==='boolean'||typeof v==='string')return JSON.stringify(v);if(typeof v==='number'){if(!Number.isFinite(v))throw new TypeError('non-finite');return JSON.stringify(v)}if(Array.isArray(v))return`[${v.map(jcs).join(',')}]`;if(v&&typeof v==='object')return`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${jcs(v[k])}`).join(',')}}`;throw new TypeError('outside JSON')}
const digest=v=>sha(jcs(v)),D=s=>sha(s),without=(v,...ks)=>Object.fromEntries(Object.entries(v).filter(([k])=>!ks.includes(k)))
const ordered=a=>[...a].sort((x,y)=>Buffer.from(x).compare(Buffer.from(y))),url=n=>`https://github.com/whatrune/sd-prompt-studio/issues/221#issuecomment-${n}`
const accepted=r=>r.kind==='accepted',rejected=r=>r.kind==='rejected',same=(a,b)=>jcs(a)===jcs(b),deepFrozen=v=>v===null||typeof v!=='object'||Object.isFrozen(v)&&Object.values(v).every(deepFrozen)
const git=(...a)=>execFileSync('git',a,{cwd:process.cwd(),encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()
const runJson=(args,env=process.env)=>{
 const output=execFileSync(process.execPath,args,{cwd:process.cwd(),encoding:'utf8',stdio:['ignore','pipe','pipe'],env})
 const values=[]
 for(const line of output.split(/\r?\n/).filter(Boolean)){try{values.push(JSON.parse(line))}catch{/* Vite may emit optimizer diagnostics on stdout. */}}
 assert.equal(values.length,1,'child runner must emit exactly one JSON result')
 return values[0]
}
let assertions=0;const check=(c,m)=>{assertions++;assert.ok(c,m)}
const HEAD=fixture.authority_head,TASK=fixture.task_id,REPO=fixture.repository,SCOPE=D('issue221-m5-scope'),PR='https://github.com/whatrune/sd-prompt-studio/pull/220'

const AT=fixture.authority_transition_v2
const TRANSITION_FLAG='--authority-transition-envelope-v2='
const SELF_TEST_FLAG='--implementation-self-test'
const TRANSITION_PR='https://github.com/whatrune/sd-prompt-studio/pull/222'
const CANDIDATE_ID='issue-221-m0-m6-cumulative-candidate-v2-b222-fr01-repair'
const CANDIDATE_FIELDS=['candidate_authority_version','task_id','repository','finding_id','candidate_id','branch','original_checkout_authority_sha','repair_parent_head_sha','ordered_repository_relative_paths','exact_changed_paths','aggregate_candidate_digest','ordered_manifest_digest','candidate_identity','result_handoff_url','candidate_binding_digest']
const PUBLISHED_FIELDS=['publication_commit_parent_sha','published_pr_head_sha','merge_before_head_sha','required_pr_state','commit_tree_candidate_binding_digest']
const PROOF_CORE_FIELDS=AT.proof_fields.slice(0,15)
const SOURCE_FIELDS=['checkout_head_source','branch_source','pr_metadata_source','current_main_source','merge_before_head_source','candidate_identity_source','aggregate_manifest_source']
const LEDGER_FIELDS=['ledger_version','task_id','repository','owner_role_id','entries','ledger_digest']
const LEDGER_ENTRY_FIELDS=['predecessor_key','transition_key','proof_digest','successor_head_sha','consumption_ordinal','consumed_by_role_id']
const COMMAND_FIELDS=['command_version','task_id','repository','owner_role_id','owner_authority_record_url','predecessor_key','transition_key','proof_digest','expected_ledger_digest','command_digest']
const RECEIPT_FIELDS=['receipt_version','task_id','repository','owner_role_id','predecessor_key','transition_key','proof_digest','successor_head_sha','previous_ledger_digest','next_ledger_digest','consumption_ordinal','receipt_digest']
const exactKeys=(value,keys)=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&same(Object.keys(value).sort(),[...keys].sort())
const directIssueUrl=value=>typeof value==='string'&&/^https:\/\/github\.com\/whatrune\/sd-prompt-studio\/issues\/221#issuecomment-\d+$/.test(value)
const sealField=(value,key)=>({...value,[key]:digest(value)})
const rejectTransition=code=>Object.freeze({kind:'rejected',code})
const acceptTransition=(code,value={})=>Object.freeze({kind:'accepted',code,...value})
const encodeEnvelope=envelope=>Buffer.from(jcs(envelope),'utf8').toString('base64url')
const sealEnvelope=envelope=>sealField(without(envelope,'envelope_digest'),'envelope_digest')
const resealLedger=ledger=>sealField(without(ledger,'ledger_digest'),'ledger_digest')
const resealCommand=command=>sealField(without(command,'command_digest'),'command_digest')
const proofCore=proof=>Object.fromEntries(PROOF_CORE_FIELDS.map(key=>[key,proof[key]]))
const predecessorTuple=predecessor=>Object.fromEntries(['predecessor_version','task_id','repository','candidate_id','candidate_identity','publication_candidate_url','checkout_head_sha','base_head_sha','current_main_sha','aggregate_candidate_digest','ordered_manifest_digest'].map(key=>[key,predecessor[key]]))

const parseTransitionCli=args=>{
 if(args.length===0)return rejectTransition('missing_transition_envelope')
 if(args.length!==1||!args[0].startsWith(TRANSITION_FLAG))return rejectTransition('invalid_cli_envelope_authority')
 const token=args[0].slice(TRANSITION_FLAG.length)
 if(!/^[A-Za-z0-9_-]+$/.test(token)||token.includes('='))return rejectTransition('malformed_transition_envelope')
 let bytes,value
 try{
  bytes=Buffer.from(token,'base64url')
  if(bytes.toString('base64url')!==token)return rejectTransition('malformed_transition_envelope')
  value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))
  if(!Buffer.from(jcs(value),'utf8').equals(bytes))return rejectTransition('malformed_transition_envelope')
 }catch{return rejectTransition('malformed_transition_envelope')}
 return acceptTransition('accepted_cli_envelope',{argument:args[0],token,value})
}

const validateAndConsumeTransitionEnvelope=envelope=>{
 if(envelope===null||typeof envelope!=='object'||Array.isArray(envelope)||!Object.hasOwn(envelope,'finalization'))return rejectTransition('missing_finalization')
 if(!exactKeys(envelope,AT.envelope_fields)||envelope.envelope_version!=='authority-transition-validation-envelope-v2'||envelope.envelope_digest!==digest(without(envelope,'envelope_digest')))return rejectTransition('invalid_transition_digest')
 const {proof,finalization,fresh_observation:observation,consumption_ledger:ledger,consume_command:command}=envelope
 if(finalization===undefined||finalization===null)return rejectTransition('missing_finalization')
 if(!exactKeys(finalization,AT.finalization_fields)||finalization.finalization_version!=='authority-transition-finalization-v2')return rejectTransition('invalid_finalization_schema')
 if(!directIssueUrl(finalization.finalization_record_url)||finalization.architecture_revision_url!==AT.architecture_revision_url)return rejectTransition('finalization_identity_mismatch')
 if(!exactKeys(proof,AT.proof_fields))return rejectTransition('predecessor_authority_mismatch')
 const core=proofCore(proof)
 if(finalization.proof_core_digest!==digest(core))return rejectTransition('proof_core_mismatch')
 if(finalization.finalization_digest!==digest(without(finalization,'finalization_digest')))return rejectTransition('finalization_digest_mismatch')
 if(proof.proof_version!=='authority-transition-proof-v2'||proof.transition_class!=='repaired_candidate_to_published_pr_head'||proof.successor_ordinal!==1||proof.single_successor!==true||proof.replay_allowed!==false)return rejectTransition('predecessor_authority_mismatch')
 const predecessor=proof.predecessor_authority
 if(!exactKeys(predecessor,AT.predecessor_authority_fields)||predecessor.predecessor_version!=='authority-transition-predecessor-v1'||predecessor.disposition!=='historical_at_prior_head'||predecessor.predecessor_key!==AT.predecessor_key||digest(predecessorTuple(predecessor))!==AT.predecessor_key||predecessor.old_published_head_sha!==AT.old_published_head_sha)return rejectTransition('predecessor_authority_mismatch')
 const proofWithoutKeys=Object.fromEntries(AT.proof_fields.slice(0,17).map(key=>[key,proof[key]]))
 if(proof.transition_key!==digest(proofWithoutKeys)||proof.proof_digest!==digest(without(proof,'proof_digest')))return rejectTransition('predecessor_authority_mismatch')
 if(!exactKeys(observation,AT.observation_fields)||observation.observation_version!=='fresh-authority-transition-observation-v2'||!exactKeys(observation.source_bindings,SOURCE_FIELDS)||observation.observation_digest!==digest(without(observation,'observation_digest')))return rejectTransition('stale_transition')
 const candidate=proof.repaired_candidate_authority,published=proof.published_authority
 if(!exactKeys(candidate,CANDIDATE_FIELDS)||!exactKeys(published,PUBLISHED_FIELDS))return rejectTransition('finalization_identity_mismatch')
 const identityEqual=finalization.finalization_record_url===proof.finalization_record_url&&finalization.finalization_record_url===observation.authority_finalization_record_url&&finalization.finalization_digest===proof.finalization_digest&&finalization.predecessor_key===proof.predecessor_key&&finalization.repaired_candidate_id===candidate.candidate_id&&finalization.repaired_candidate_identity===candidate.candidate_identity&&finalization.repaired_candidate_binding_digest===candidate.candidate_binding_digest
 if(!identityEqual)return rejectTransition('finalization_identity_mismatch')
 const commonBound=envelope.task_id===TASK&&envelope.repository===REPO&&proof.task_id===TASK&&proof.repository===REPO&&finalization.task_id===TASK&&finalization.repository===REPO&&observation.task_id===TASK&&observation.repository===REPO&&proof.finding_id==='B-222-FR-01'&&finalization.finding_id==='B-222-FR-01'&&proof.target_pr_url===TRANSITION_PR&&finalization.target_pr_url===TRANSITION_PR&&observation.target_pr_url===TRANSITION_PR&&proof.branch===fixture.branch&&finalization.branch===fixture.branch&&observation.branch===fixture.branch&&proof.publication_result_handoff_url===finalization.publication_result_handoff_url&&proof.publication_result_handoff_url===observation.publication_result_handoff_url
 if(!commonBound)return rejectTransition('finalization_identity_mismatch')
 const mixed=[candidate.aggregate_candidate_digest,finalization.aggregate_candidate_digest,observation.observed_aggregate_candidate_digest].includes(AT.old_aggregate_candidate_digest)||[candidate.ordered_manifest_digest,finalization.ordered_manifest_digest,observation.observed_ordered_manifest_digest].includes(AT.old_ordered_manifest_digest)
 if(mixed&&!(candidate.aggregate_candidate_digest===finalization.aggregate_candidate_digest&&candidate.aggregate_candidate_digest===observation.observed_aggregate_candidate_digest&&candidate.ordered_manifest_digest===finalization.ordered_manifest_digest&&candidate.ordered_manifest_digest===observation.observed_ordered_manifest_digest))return rejectTransition('mixed_authority_rejected')
 if(candidate.aggregate_candidate_digest===AT.old_aggregate_candidate_digest||candidate.ordered_manifest_digest===AT.old_ordered_manifest_digest||published.published_pr_head_sha===AT.old_published_head_sha)return rejectTransition('historical_authority_rejected')
 if(candidate.candidate_id!==CANDIDATE_ID||candidate.candidate_identity!==`sha256:${candidate.aggregate_candidate_digest}`||candidate.candidate_binding_digest!==digest(without(candidate,'candidate_binding_digest'))||finalization.aggregate_candidate_digest!==candidate.aggregate_candidate_digest||observation.observed_candidate_id!==candidate.candidate_id||observation.observed_candidate_identity!==candidate.candidate_identity||observation.observed_aggregate_candidate_digest!==candidate.aggregate_candidate_digest)return rejectTransition('aggregate_authority_mismatch')
 if(candidate.ordered_repository_relative_paths.length!==20||!same(candidate.exact_changed_paths,AT.exact_changed_paths)||finalization.ordered_manifest_digest!==candidate.ordered_manifest_digest||observation.observed_ordered_manifest_digest!==candidate.ordered_manifest_digest)return rejectTransition('manifest_authority_mismatch')
 if(candidate.repair_parent_head_sha!==AT.old_published_head_sha||published.publication_commit_parent_sha!==AT.old_published_head_sha||finalization.publication_commit_parent_sha!==AT.old_published_head_sha||observation.observed_pr_base_sha!==AT.old_published_head_sha)return rejectTransition('publication_parent_mismatch')
 const successor=published.published_pr_head_sha
 if(successor===AT.old_published_head_sha||published.merge_before_head_sha!==successor||finalization.published_pr_head_sha!==successor||finalization.merge_before_head_sha!==successor||observation.observed_checkout_head_sha!==successor||observation.observed_pr_head_sha!==successor||observation.observed_merge_before_head_sha!==successor)return rejectTransition('published_head_mismatch')
 if(published.required_pr_state!=='open_draft'||finalization.required_pr_state!=='open_draft'||observation.observed_pr_state!=='open_draft'||observation.fresh_guard_record_url!==envelope.retry_dispatch_url||!directIssueUrl(envelope.retry_dispatch_url)||Object.values(observation.source_bindings).some(value=>typeof value!=='string'||value.length===0))return rejectTransition('stale_transition')
 if(!exactKeys(ledger,LEDGER_FIELDS)||ledger.ledger_version!=='authority-transition-consumption-ledger-v1'||ledger.task_id!==TASK||ledger.repository!==REPO||ledger.owner_role_id!=='validation_runner'||ledger.ledger_digest!==digest(without(ledger,'ledger_digest'))||!Array.isArray(ledger.entries)||ledger.entries.some((entry,index)=>!exactKeys(entry,LEDGER_ENTRY_FIELDS)||entry.consumption_ordinal!==index+1||entry.consumed_by_role_id!=='validation_runner'))return rejectTransition('invalid_consumption_boundary')
 if(!exactKeys(command,COMMAND_FIELDS)||command.command_version!=='authority-transition-consume-command-v1'||command.task_id!==TASK||command.repository!==REPO||command.owner_role_id!=='validation_runner'||command.owner_authority_record_url!==envelope.retry_dispatch_url||command.predecessor_key!==proof.predecessor_key||command.transition_key!==proof.transition_key||command.proof_digest!==proof.proof_digest||command.expected_ledger_digest!==ledger.ledger_digest||command.command_digest!==digest(without(command,'command_digest')))return rejectTransition('invalid_consumption_boundary')
 const keyConflict=ledger.entries.find(entry=>entry.transition_key===proof.transition_key&&(entry.predecessor_key!==proof.predecessor_key||entry.proof_digest!==proof.proof_digest||entry.successor_head_sha!==successor))
 const secondSuccessor=ledger.entries.find(entry=>entry.predecessor_key===proof.predecessor_key&&(entry.transition_key!==proof.transition_key||entry.successor_head_sha!==successor))
 const replay=ledger.entries.find(entry=>entry.predecessor_key===proof.predecessor_key&&entry.transition_key===proof.transition_key&&entry.proof_digest===proof.proof_digest&&entry.successor_head_sha===successor)
 if(keyConflict||secondSuccessor)return rejectTransition('second_successor')
 if(replay)return rejectTransition('transition_replay')
 const entry={predecessor_key:proof.predecessor_key,transition_key:proof.transition_key,proof_digest:proof.proof_digest,successor_head_sha:successor,consumption_ordinal:ledger.entries.length+1,consumed_by_role_id:'validation_runner'}
 const nextLedger=resealLedger({...ledger,entries:[...ledger.entries,entry]})
 const receipt=sealField({receipt_version:'authority-transition-consumption-receipt-v1',task_id:TASK,repository:REPO,owner_role_id:'validation_runner',predecessor_key:proof.predecessor_key,transition_key:proof.transition_key,proof_digest:proof.proof_digest,successor_head_sha:successor,previous_ledger_digest:ledger.ledger_digest,next_ledger_digest:nextLedger.ledger_digest,consumption_ordinal:entry.consumption_ordinal},'receipt_digest')
 if(!exactKeys(receipt,RECEIPT_FIELDS)||receipt.receipt_digest!==digest(without(receipt,'receipt_digest')))return rejectTransition('invalid_consumption_boundary')
 return acceptTransition('accepted_direct_m5',{authority_transition_envelope_digest:envelope.envelope_digest,authority_transition_proof_digest:proof.proof_digest,authority_transition_finalization_digest:finalization.finalization_digest,next_ledger:nextLedger,receipt})
}

const makeTransitionEnvelope=()=>{
 const handoff=url('5154000001'),finalizationUrl=url('5154000002'),dispatch=url('5154000003')
 const successor=D('issue221-b222-fr01-published-successor').slice(0,40)
 const aggregate=D('issue221-b222-fr01-repaired-aggregate'),manifest=D('issue221-b222-fr01-repaired-manifest')
 const predecessor={predecessor_version:'authority-transition-predecessor-v1',task_id:TASK,repository:REPO,candidate_id:'issue-221-m0-m6-cumulative-candidate-v1',candidate_identity:`sha256:${AT.old_aggregate_candidate_digest}`,publication_candidate_url:url('5151560006'),publication_result_handoff_url:url('5151669403'),checkout_head_sha:'b7d1013052514aacddb559cc4f24af5e33c08b96',base_head_sha:'b7d1013052514aacddb559cc4f24af5e33c08b96',current_main_sha:'b7d1013052514aacddb559cc4f24af5e33c08b96',old_published_head_sha:AT.old_published_head_sha,aggregate_candidate_digest:AT.old_aggregate_candidate_digest,ordered_manifest_digest:AT.old_ordered_manifest_digest,disposition:'historical_at_prior_head',predecessor_key:AT.predecessor_key}
 const candidate=sealField({candidate_authority_version:'repaired-candidate-authority-v2',task_id:TASK,repository:REPO,finding_id:'B-222-FR-01',candidate_id:CANDIDATE_ID,branch:fixture.branch,original_checkout_authority_sha:'b7d1013052514aacddb559cc4f24af5e33c08b96',repair_parent_head_sha:AT.old_published_head_sha,ordered_repository_relative_paths:[...fixture.ordered_cumulative_paths,'src/continuous-orchestration/deprecation-removal-v1.ts','scripts/fixtures/continuous-orchestration-deprecation-removal-v1.json','scripts/test-continuous-orchestration-deprecation-removal.mjs'],exact_changed_paths:AT.exact_changed_paths,aggregate_candidate_digest:aggregate,ordered_manifest_digest:manifest,candidate_identity:`sha256:${aggregate}`,result_handoff_url:handoff},'candidate_binding_digest')
 const published={publication_commit_parent_sha:AT.old_published_head_sha,published_pr_head_sha:successor,merge_before_head_sha:successor,required_pr_state:'open_draft',commit_tree_candidate_binding_digest:candidate.candidate_binding_digest}
 const core={proof_version:'authority-transition-proof-v2',transition_class:'repaired_candidate_to_published_pr_head',task_id:TASK,repository:REPO,finding_id:'B-222-FR-01',target_pr_url:TRANSITION_PR,branch:fixture.branch,predecessor_authority:predecessor,repaired_candidate_authority:candidate,published_authority:published,publication_result_handoff_url:handoff,successor_ordinal:1,single_successor:true,replay_allowed:false,predecessor_key:AT.predecessor_key}
 const finalization=sealField({finalization_version:'authority-transition-finalization-v2',task_id:TASK,repository:REPO,finding_id:'B-222-FR-01',architecture_revision_url:AT.architecture_revision_url,predecessor_key:AT.predecessor_key,repaired_candidate_id:candidate.candidate_id,repaired_candidate_identity:candidate.candidate_identity,repaired_candidate_binding_digest:candidate.candidate_binding_digest,aggregate_candidate_digest:aggregate,ordered_manifest_digest:manifest,target_pr_url:TRANSITION_PR,branch:fixture.branch,publication_commit_parent_sha:AT.old_published_head_sha,published_pr_head_sha:successor,merge_before_head_sha:successor,required_pr_state:'open_draft',publication_result_handoff_url:handoff,finalization_record_url:finalizationUrl,proof_core_digest:digest(core)},'finalization_digest')
 const proofPrefix={...core,finalization_record_url:finalizationUrl,finalization_digest:finalization.finalization_digest}
 const proof=sealField({...proofPrefix,transition_key:digest(proofPrefix)},'proof_digest')
 const source_bindings={checkout_head_source:'local_git_rev_parse_head',branch_source:'local_git_branch_show_current',pr_metadata_source:'canonical_fresh_guard_record',current_main_source:'canonical_fresh_guard_record',merge_before_head_source:'canonical_fresh_guard_record',candidate_identity_source:'publication_candidate_record',aggregate_manifest_source:'publication_result_handoff_record'}
 const observation=sealField({observation_version:'fresh-authority-transition-observation-v2',task_id:TASK,repository:REPO,target_pr_url:TRANSITION_PR,branch:fixture.branch,observed_checkout_head_sha:successor,observed_pr_head_sha:successor,observed_pr_base_sha:AT.old_published_head_sha,observed_current_main_sha:'b7d1013052514aacddb559cc4f24af5e33c08b96',observed_merge_before_head_sha:successor,observed_pr_state:'open_draft',observed_candidate_id:candidate.candidate_id,observed_candidate_identity:candidate.candidate_identity,observed_aggregate_candidate_digest:aggregate,observed_ordered_manifest_digest:manifest,authority_finalization_record_url:finalizationUrl,publication_result_handoff_url:handoff,fresh_guard_record_url:dispatch,source_bindings},'observation_digest')
 const ledger=resealLedger({ledger_version:'authority-transition-consumption-ledger-v1',task_id:TASK,repository:REPO,owner_role_id:'validation_runner',entries:[]})
 const command=resealCommand({command_version:'authority-transition-consume-command-v1',task_id:TASK,repository:REPO,owner_role_id:'validation_runner',owner_authority_record_url:dispatch,predecessor_key:proof.predecessor_key,transition_key:proof.transition_key,proof_digest:proof.proof_digest,expected_ledger_digest:ledger.ledger_digest})
 return sealEnvelope({envelope_version:'authority-transition-validation-envelope-v2',task_id:TASK,repository:REPO,proof,finalization,fresh_observation:observation,consumption_ledger:ledger,consume_command:command,retry_dispatch_url:dispatch})
}

const transitionFixtureEnvelope=makeTransitionEnvelope()
const transitionFixtureArgument=`${TRANSITION_FLAG}${encodeEnvelope(transitionFixtureEnvelope)}`
const suppliedTransitionCli=process.argv.slice(2)
const explicitSelfTest=same(suppliedTransitionCli,[SELF_TEST_FLAG])
let suppliedTransitionResult=null
let suppliedTransitionEnvelope=null,suppliedTransitionIsFixture=false
if(!explicitSelfTest){
 const parsed=parseTransitionCli(suppliedTransitionCli)
 suppliedTransitionEnvelope=parsed.kind==='accepted'?parsed.value:null
 suppliedTransitionIsFixture=parsed.kind==='accepted'&&parsed.argument===transitionFixtureArgument
 suppliedTransitionResult=parsed.kind==='accepted'?validateAndConsumeTransitionEnvelope(parsed.value):parsed
 if(suppliedTransitionResult.kind!=='accepted'){
  console.log(JSON.stringify({result:'FAIL',contract:'Authority Transition Validation Envelope V2',code:suppliedTransitionResult.code,child_invocation_count:0}))
 process.exit(1)
 }
}
if(explicitSelfTest){
 const probe=spawnSync(process.execPath,[process.argv[1]],{cwd:process.cwd(),encoding:'utf8',stdio:['ignore','pipe','pipe']})
 const result=JSON.parse(probe.stdout)
 check(probe.status===1&&result.result==='FAIL'&&result.code==='missing_transition_envelope'&&result.child_invocation_count===0,'direct M5 process without envelope fails closed')
}

const server=await createServer({configFile:false,cacheDir:join(tmpdir(),'sd-prompt-studio-issue221-m5-vite'),optimizeDeps:{noDiscovery:true},server:{middlewareMode:true},appType:'custom',logLevel:'error'})
const api=await server.ssrLoadModule('/src/continuous-orchestration/evaluator-reducer-consolidation-v1.ts')
const m1=await server.ssrLoadModule('/src/continuous-orchestration/shared-proof-interfaces-v1.ts')
const cov=await server.ssrLoadModule('/src/continuous-orchestration/index.ts')
const m3api=await server.ssrLoadModule('/src/continuous-orchestration/authority-routing-budget-cutover-v1.ts')
const m4api=await server.ssrLoadModule('/src/continuous-orchestration/completion-candidate-projection-cutover-v1.ts')

const transitionRoute=(transition_class,role_id=transition_class==='implementation'?'backend_implementer':`role-${transition_class}`,action_id=transition_class==='implementation'?'implement_m5':`action-${transition_class}`)=>({transition_class,role_id,action_id,authority_record_url:url('5150323418'),allowed_scope_digest:SCOPE,independent_from_role_id_or_null:['architecture_review','implementation_review','publication_review','completion_assessment'].includes(transition_class)?`author-${transition_class}`:null})
const routes=cov.transitionClasses.map(t=>transitionRoute(t)).sort((a,b)=>Buffer.from(`${a.transition_class}\0${a.role_id}\0${a.action_id}`).compare(Buffer.from(`${b.transition_class}\0${b.role_id}\0${b.action_id}`)))
const implementationRoute=routes.find(r=>r.transition_class==='implementation')
const selectors={task_opted_in:['assignment_field','requested_by_role_id'],result_handoff_published:['active_route_binding','active_transition_role_id'],review_decision_published:['active_route_binding','active_transition_role_id'],architecture_amendment_published:['fixed_route_transition_class','architecture_repair'],resume_dispatch_published:['assignment_field','assignment_owner_role_id'],metadata_sync_completed:['fixed_route_transition_class','metadata_sync'],validation_completed:['active_route_binding','active_transition_role_id'],completion_assessment_published:['fixed_route_transition_class','completion_assessment'],product_owner_approval_published:['assignment_field','requested_by_role_id'],protected_action_completed:['protected_action_profile','matching_action_executor_role_id'],authority_snapshot_changed:['collector_profile','collector_role_id'],external_recovery_observed:['preceding_decision_recovery_role','recovery_role_id']}
const sealProfile=v=>({...v,profile_digest:digest(v)})
const profiles={
 authority_projection_profile:sealProfile({profile_version:'authority_projection_profile_v1',profile_id:'issue221-m5-authority',source_type_bindings:cov.sourceTypes.map(source_type=>({source_type,collector_adapter_id:`adapter-${source_type}`,canonical_authority_required:['task_assignment','result_handoff','review_decision','product_owner_approval','context_health_resume'].includes(source_type),required_field_ids:source_type==='identity'?ordered(['assignment_revision','contract_version','repository','task_id']):['canonical_record_url'],optional_field_ids:[],authority_owner_contract_url:url('5142525621')})),assignment_owner_role_id:'integrated_lead',requested_by_role_id:'product_owner',collector_role_id:'authority_collector'}),
 route_binding_table:sealProfile({profile_version:'route_binding_table_v1',profile_id:'issue221-m5-routes',bindings:routes,event_authority_bindings:cov.eventTypes.map(event_type=>({event_type,authority_source:selectors[event_type][0],authority_selector:{kind:selectors[event_type][0],value:selectors[event_type][1]},head_binding:['task_opted_in','architecture_amendment_published','resume_dispatch_published','external_recovery_observed'].includes(event_type)?'nullable':'required'}))}),
 gate_profile:sealProfile({profile_version:'gate_profile_v1',profile_id:'issue221-m5-gates',gate_rows:[{gate_id:'architecture',ordinal:1,required_evidence_types:['review_decision'],gsp_field_id:'architecture_review'},{gate_id:'implementation',ordinal:2,required_evidence_types:['result_handoff'],gsp_field_id:'implementation_review'}]}),
 protected_action_profile:sealProfile({profile_version:'protected_action_profile_v1',profile_id:'issue221-m5-protected',mode:'wait_only',action_rows:[{action_id:'normal_merge_commit',approval_required:true,exact_head_required:true,exact_base_required:true,one_use:true,executor_role_id:'merge_executor',authority_record_url:url('5150323418')}]})
}
check(cov.validateGenericProgressRunnerProfilesV1(profiles).kind==='accepted','profiles')
const sourceRef={kind:'canonical_record',url:url('5150323418')}
const fresh=m1.deriveFreshAuthoritySnapshotShadowV1({snapshot_version:m1.FRESH_AUTHORITY_SNAPSHOT_V1_VERSION,purpose:'evaluation',task_id:TASK,repository:REPO,assignment_revision:1,collected_from:[sourceRef],main_sha_or_null:HEAD,pr_url_or_null:PR,pr_head_sha_or_null:HEAD,pr_base_sha_or_null:HEAD,pr_state:'open_draft',check_set_digest_or_null:D('checks'),finding_set_digest:D('findings'),thread_set_digest:D('threads'),workspace_binding_digest_or_null:D('workspace'),workspace_state:'clean_bound',gsp_generation_or_null:9,gsp_body_digest_or_null:D('gsp'),approval_consumption_digest_or_null:null,observed_at:'2026-08-01T06:00:00Z'}).value
const authoritySource={source_type:'task_assignment',source_ref:sourceRef,owner_contract_url:url('5142525621'),authority_class:'normative_semantic',authority_scope_digest:SCOPE,content_projection_digest:D('assignment'),task_id:TASK,repository:REPO,subject_head_sha_or_null:HEAD,observed_at:'2026-08-01T05:59:59Z',admitted_field_ids:['assignment_revision','canonical_record_url'],admission_result:'accepted'}
const bundle=m1.deriveAdmittedAuthorityBundleShadowV1({bundle_version:m1.ADMITTED_AUTHORITY_BUNDLE_V1_VERSION,task_id:TASK,repository:REPO,assignment_revision:1,scope_digest:SCOPE,sources:[authoritySource],fresh_snapshot:fresh,admission_result:'accepted'}).value
const stateSnapshotBase={snapshot_version:'authority_snapshot_ref_v1',collected_from:[sourceRef],repository:REPO,main_sha_or_null:HEAD,pr_url_or_null:PR,pr_head_sha_or_null:HEAD,pr_base_sha_or_null:HEAD,pr_state:'open_draft',check_set_digest_or_null:D('checks'),finding_set_digest:D('findings'),thread_set_digest:D('threads'),workspace_state:'clean_bound',gsp_generation_or_null:9,gsp_body_digest_or_null:D('gsp'),approval_consumption_digest_or_null:null,observed_at:fresh.observed_at}
const stateSnapshot={...stateSnapshotBase,snapshot_digest:digest(without(stateSnapshotBase,'observed_at'))}
const assignmentUrl=url('5150323418'),semanticRequirement=D('m5-requirement'),epoch=digest({task_id:TASK,root_assignment_url:assignmentUrl,semantic_requirement_digest:semanticRequirement,allowed_scope_digest:SCOPE})
const state={state_version:'continuous_orchestration_state_v1',state_revision:0,task_id:TASK,canonical_task_url:'https://github.com/whatrune/sd-prompt-studio/issues/221',repository:REPO,assignment_revision:1,semantic_counter_epoch:{epoch_id:epoch,root_assignment_url:assignmentUrl,current_assignment_url:assignmentUrl,current_assignment_revision:1,predecessor_epoch_id_or_null:null,disposition:'initial',semantic_requirement_digest:semanticRequirement,allowed_scope_digest:SCOPE,authority_record_url:url('5142525621')},opt_in_contract_version:'continuous-orchestration-v1.0.0',allowed_transition_classes:ordered([...cov.transitionClasses]),phase:'evaluating',active_gate:'implementation',active_role_binding:implementationRoute,active_action_id:implementationRoute.action_id,authority_snapshot:stateSnapshot,canonical_refs:{assignment_url:assignmentUrl,result_handoff_url_or_null:null,review_decision_url_or_null:null,architecture_amendment_url_or_null:null,resume_dispatch_url_or_null:null,metadata_result_url_or_null:null,validation_result_url_or_null:null,completion_assessment_url_or_null:null,product_owner_approval_url_or_null:null,protected_action_completion_url_or_null:null},finding_ledger:[],loop_counters:{finding_counters:[],metadata_counters:[],delivery_counters:[],cycle_ledger:{cycle_ledger_version:'cycle_ledger_v1',semantic_counter_epoch_id:epoch,progress_epoch:0,max_gate_ordinal_reached:1,decision_count_without_progress:0,checkpoint_emitted_without_progress:false,signature_occurrences:[],last_progress_record_url:assignmentUrl}},approval_state:{state:'none',reason:'missing',approval_record_url_or_null:null},projection_state:{projection_version:'projection_state_v1',state:'not_required',pr_url_or_null:null,projected_head_sha_or_null:null,gsp_generation_or_null:null,pr_body_digest_or_null:null,gsp_gate_rows_digest_or_null:null,citation_record_urls:[],mismatch_field_ids:[]},event_cursor:{cursor_version:'event_cursor_v1',last_event_id_or_null:null,last_semantic_event_digest_or_null:null,last_event_record_url_or_null:null,last_decision_url_or_null:null,admitted_new_event_count:0},replay_ledger:{ledger_version:'replay_ledger_v1',entries:[],ledger_digest:digest({ledger_version:'replay_ledger_v1',entries:[]})},audit_chain:{audit_version:'audit_chain_ref_v1',head_decision_url_or_null:null,head_decision_id_or_null:null,decision_count_total:0,chain_digest:D('audit')},pending_transport:null,last_decision_url:null}
const eventBase={event_version:'continuous_orchestration_event_v1',event_type:'task_opted_in',task_id:TASK,assignment_revision:1,canonical_record_url:url('5150323418'),authoring_role:'product_owner',authority_snapshot_digest:state.authority_snapshot.snapshot_digest,subject_head_sha_or_null:null,predecessor_event_id_or_null:null}
const semanticEventDigest=digest(eventBase),event={...eventBase,event_id:semanticEventDigest,observed_at:'2026-08-01T06:00:01Z',semantic_event_digest:semanticEventDigest}
const agpResult={contract_version:'automatic-gate-progression-evaluation-result-v2',task_id:TASK,evaluated_at:'2026-08-01T06:00:00Z',input_fingerprint:D('m5-agp-input'),precedence_trace:['recommend'],gate_status_requirement:{required:false},kind:'recommend_next_role',target_role:implementationRoute.role_id,next_action:implementationRoute.action_id,predecessor_canonical_url:assignmentUrl,target_head:HEAD,same_task_id:TASK,idempotency_key:D('m5-agp-transition')}
const decisionPort=m1.deriveProgressionDecisionPortShadowV1(agpResult).value
const profile=api.sealEvaluatorReducerConsolidationProfileV1({profile_version:api.EVALUATOR_REDUCER_CONSOLIDATION_PROFILE_V1_VERSION,feature_id:'evaluator_reducer_consolidation',mode:'m5_consolidated_v1',task_id:TASK,repository:REPO,assignment_revision:1,allowed_scope_digest:SCOPE,profile_authority_record_url:url('5150308657'),expected_m4_manifest_digest:api.M5_EXPECTED_M4_MANIFEST_DIGEST})
const repairProfile=m1.deriveRepairBudgetProfileShadowV1({repair_budget_profile_version:m1.REPAIR_BUDGET_PROFILE_V1_VERSION,task_id:TASK,repository:REPO,assignment_revision:1,semantic_epoch_id:epoch,authority_record_url:url('5150308657'),allowed_scope_digest:SCOPE,attempt_limits:{technical:3,architecture:3,metadata:3,delivery:3},cycle_limits:{checkpoint_after_decisions:32,stop_after_decisions:64}}).value
const emptyRepairLedger=m1.deriveRepairAttemptLedgerShadowV1({repair_attempt_ledger_version:m1.REPAIR_ATTEMPT_LEDGER_V1_VERSION,task_id:TASK,repository:REPO,assignment_revision:1,semantic_epoch_id:epoch,profile_digest:repairProfile.profile_digest,entries:[],cycle_ledger:state.loop_counters.cycle_ledger}).value
const routeForEvaluation=evaluation=>evaluation.kind==='recommend_next_role'?routes.find(r=>r.role_id===evaluation.target_role_id&&r.action_id===evaluation.next_action_id):null
const makeM3=(evaluation,stateValue=state,eventValue=event,overrides={})=>{
 const route=overrides.route_binding===undefined?routeForEvaluation(evaluation):overrides.route_binding
 const routeSelection=route===null?m3api.sealM3RouteSelectionV1({kind:'no_route',authority_record_url:url('5150308657'),reason:'no_declared_transition'}):m3api.sealM3RouteSelectionV1({kind:'route',binding:route,predecessor_canonical_url:evaluation.kind==='recommend_next_role'?evaluation.predecessor_canonical_url:assignmentUrl,branch:fixture.branch,worktree_identity:fixture.logical_worktree_identity,pr_url_or_null:PR,head_sha_or_null:HEAD})
 const combined=m3api.sealM3CombinedTaskAssignmentAuthorityProjectionV1({schema_version:m3api.M3_COMBINED_TASK_ASSIGNMENT_AUTHORITY_PROJECTION_V1_VERSION,task_id:TASK,repository_full_name:REPO,assignment_revision:1,canonical_assignment_url:sourceRef.url,source_record_digest:authoritySource.content_projection_digest,source_occurrence_count:1,assigned_role:'Backend Implementer',recommended_next_action:'run_m3_authority_routing_budget_cutover_v1',selected_route_bundle_id:profiles.route_binding_table.profile_id,selected_route_action_id:route?.action_id??stateValue.active_action_id,branch_name:fixture.branch,worktree_binding_digest:digest({worktree_identity:fixture.logical_worktree_identity}),pr_number:Number(PR.split('/').at(-1)),pr_url:PR,pr_head_sha:HEAD,predecessor_digest:digest({predecessor_canonical_url:routeSelection.kind==='route'?routeSelection.predecessor_canonical_url:assignmentUrl}),scope_digest:SCOPE,fresh_snapshot_digest:bundle.fresh_snapshot.snapshot_digest,active_profile_id:'authority_routing_budget',active_profile_authority_url:url('5150308657'),active_profile_mode:'m3_cutover_v1'})
 const cutoverProfile=m3api.sealAuthorityRoutingBudgetCutoverProfileV1({profile_version:m3api.AUTHORITY_ROUTING_BUDGET_CUTOVER_PROFILE_V1_VERSION,feature_id:'authority_routing_budget',mode:'m3_cutover_v1',task_id:TASK,repository:REPO,assignment_revision:1,allowed_scope_digest:SCOPE,profile_authority_record_url:url('5150308657'),expected_m2_manifest_digest:m3api.M3_EXPECTED_M2_MANIFEST_DIGEST,expected_prior_state_digest:digest(stateValue),expected_prior_ledger_digest:emptyRepairLedger.ledger_digest})
 const input=m3api.sealAuthorityRoutingBudgetCutoverInputV1({input_version:m3api.AUTHORITY_ROUTING_BUDGET_CUTOVER_INPUT_V1_VERSION,state:stateValue,event:eventValue,profiles,evaluation,decision_url:url('5150323418'),evaluated_at:'2026-08-01T06:00:02Z',recovery_role_id_or_null:evaluation.kind==='stop'?evaluation.recovery_role_id:null,authority_bundle:bundle,combined_task_assignment_authority:combined,cutover_profile:cutoverProfile,route_selection:routeSelection,repair_budget_profile:repairProfile,repair_attempt_ledger:emptyRepairLedger,repair_attempt_evidence_or_null:null,action_guard_proof_or_null:null,expected_prior_state_digest:digest(stateValue),expected_prior_ledger_digest:emptyRepairLedger.ledger_digest})
 return {input,result:m3api.runAuthorityRoutingBudgetCutoverV1(input),route}
}
const candidate=m1.deriveCandidateAuthorityRefShadowV1({candidate_authority_ref_version:m1.CANDIDATE_AUTHORITY_REF_V1_VERSION,task_id:TASK,repository:REPO,candidate_id:'issue221-m5-candidate',aggregate_digest:D('m5-candidate-aggregate'),ordered_repository_relative_paths:fixture.ordered_cumulative_paths,base_sha:HEAD,working_head_sha:HEAD,result_handoff_url:url('5150444360'),publication_state:'published',published_head_sha_or_null:HEAD}).value
const reviewClasses=[['architecture_review','architect_team_independent_reviewer','5150308657'],['implementation_review','independent_implementation_reviewer','5150471117'],['publication_review','independent_publication_reviewer','5150477683']]
const reviews=reviewClasses.map(([review_class,reviewing_role_id,n])=>m4api.sealM4ReviewEvidenceBindingV1({binding_version:m4api.M4_REVIEW_EVIDENCE_BINDING_V1_VERSION,review_class,decision_url:url(n),reviewing_role_id,candidate_identity_digest:candidate.candidate_identity_digest,candidate_authority_ref_digest:candidate.ref_digest,aggregate_digest:candidate.aggregate_digest,ordered_path_set_digest:digest(candidate.ordered_repository_relative_paths),base_sha:HEAD,working_head_sha:HEAD,published_head_sha_or_null:HEAD,authority_bundle_digest:bundle.bundle_digest,result_handoff_bridge_url:candidate.result_handoff_url,decision_result:'APPROVE'}))
const m4ProfileFor=predecessor=>m4api.sealCompletionCandidateProjectionCutoverProfileV1({profile_version:m4api.COMPLETION_CANDIDATE_PROJECTION_CUTOVER_PROFILE_V1_VERSION,feature_id:'completion_candidate_projection',mode:'m4_cutover_v1',task_id:TASK,repository:REPO,assignment_revision:1,allowed_scope_digest:SCOPE,profile_authority_record_url:url('5150308657'),expected_m3_manifest_digest:m4api.M4_EXPECTED_M3_MANIFEST_DIGEST,expected_prior_state_digest:predecessor})
const makeM4=(predecessor,overrides={})=>{
 const input=m4api.sealCompletionCandidateProjectionCutoverInputV1({input_version:m4api.COMPLETION_CANDIDATE_PROJECTION_CUTOVER_INPUT_V1_VERSION,task_id:TASK,repository:REPO,authority_bundle:bundle,cutover_profile:m4ProfileFor(predecessor),branch:fixture.branch,worktree_identity:fixture.logical_worktree_identity,pr_url:PR,head_sha:HEAD,current_main_sha:HEAD,candidate_authority_ref:candidate,review_bindings:reviews,completion_evidence_candidate_or_null:null,completion_decision_or_null:null,gate_projection_intent_or_null:null,gsp_input_observation_or_null:null,gsp_result_or_null:null,gsp_receipt_or_null:null,expected_prior_gsp_generation_or_null:fresh.gsp_generation_or_null,expected_prior_gsp_rows_digest_or_null:fresh.gsp_body_digest_or_null,post_write_reobservation_or_null:null,evaluation_snapshot:fresh,metadata_action_guard_or_null:null,expected_predecessor_state_digest:predecessor,expected_m3_manifest_digest:m4api.M4_EXPECTED_M3_MANIFEST_DIGEST,...overrides})
 return {input,result:m4api.runCompletionCandidateProjectionCutoverV1(input)}
}
const buildInput=({agp=agpResult,stateValue=state,eventValue=event,noTransition=null,simulation=null,m4Overrides={},profileValue=profile,m3Override=null,routeOverride=undefined}={})=>{
 const port=m1.deriveProgressionDecisionPortShadowV1(agp,noTransition??undefined).value
 const m3Run=m3Override??makeM3(port.projected_result,stateValue,eventValue,{route_binding:routeOverride})
 const predecessor=m3Run.result.kind==='cutover_accepted'||m3Run.result.kind==='legacy_profile_accepted'?digest(m3Run.result.reduction.state):digest(stateValue)
 const m4Run=makeM4(predecessor,m4Overrides)
 const input=api.sealEvaluatorReducerConsolidationInputV1({input_version:api.EVALUATOR_REDUCER_CONSOLIDATION_INPUT_V1_VERSION,task_id:TASK,repository:REPO,authority_bundle:bundle,consolidation_profile:profileValue,branch:fixture.branch,worktree_identity:fixture.logical_worktree_identity,pr_url:PR,head_sha:HEAD,current_main_sha:HEAD,state:stateValue,event:eventValue,profiles,agp_result:agp,progression_decision_port:port,no_transition_binding_or_null:noTransition,route_binding_or_null:m3Run.route,m3_input:m3Run.input,m3_result:m3Run.result,m4_input:m4Run.input,m4_result:m4Run.result,evaluation_snapshot:fresh,non_protected_action_guard_or_null:null,protected_action_simulation_or_null:simulation,decision_url:url('5150323418'),evaluated_at:'2026-08-01T06:00:02Z',recovery_role_id_or_null:agp.kind==='stop'?agp.recovery_owner:null,expected_prior_state_digest:digest(stateValue),expected_m3_ledger_digest:m3Run.result.kind==='rejected'?D('rejected-ledger'):m3Run.result.next_repair_ledger.ledger_digest,expected_m4_manifest_digest:api.M5_EXPECTED_M4_MANIFEST_DIGEST})
 return {input,port,m3Run,m4Run}
}
const base=buildInput(),baseInput=base.input,m3=base.m3Run.result,m4=base.m4Run.result
const preliminary=m3.reduction
check(m3.kind==='cutover_accepted'&&preliminary.decision?.branch==='dispatch_role','direct M3 reducer branch')
const result=api.runEvaluatorReducerConsolidationV1(baseInput),resultAgain=api.runEvaluatorReducerConsolidationV1(baseInput)
check(accepted(api.validateEvaluatorReducerConsolidationInputV1(baseInput)),'base input admitted')
check(result.kind==='consolidated_transition','consolidated transition')
check(accepted(api.validateEvaluatorReducerConsolidationResultV1(result)),'result admitted')
check(same(result,resultAgain),'deterministic result')
check(deepFrozen(result),'deep frozen result')

const mutate=(value,fn)=>{const copy=clone(value);fn(copy);return api.sealEvaluatorReducerConsolidationInputV1(without(copy,'input_digest'))}
const unknown={...clone(baseInput),unexpected:true},missing=without(baseInput,'consolidation_profile')
const wrongTask=mutate(baseInput,v=>v.task_id='other-task')
const badPort=mutate(baseInput,v=>v.progression_decision_port={...v.progression_decision_port,source_result_digest:D('wrong')})
const alternateRoute=routes.find(route=>route.transition_class==='implementation_review')
const alternateProjected={...base.port.projected_result,target_role_id:alternateRoute.role_id,next_action_id:alternateRoute.action_id}
const alternatePortBase={...without(base.port,'port_digest'),projected_result:alternateProjected},alternatePort={...alternatePortBase,port_digest:digest(alternatePortBase)}
const alternateM3=makeM3(alternateProjected,state,event,{route_binding:alternateRoute})
const alternateBuild=buildInput({agp:agpResult,m3Override:alternateM3})
const badPortRuntime=mutate(alternateBuild.input,v=>{v.progression_decision_port=alternatePort;v.route_binding_or_null=alternateRoute;v.m3_input=alternateM3.input;v.m3_result=alternateM3.result;v.expected_m3_ledger_digest=alternateM3.result.next_repair_ledger.ledger_digest})
const badRoute=mutate(baseInput,v=>v.route_binding_or_null={...v.route_binding_or_null,action_id:'wrong'})
const badSuccessor=mutate(baseInput,v=>v.m3_result={...v.m3_result,reduction:{...v.m3_result.reduction,state:{...v.m3_result.reduction.state,state_revision:99}}})
const wrapperProfile=api.sealEvaluatorReducerConsolidationProfileV1({...without(profile,'profile_digest'),mode:'compatibility_wrapper_v1'})
const wrapperInput=mutate(baseInput,v=>v.consolidation_profile=wrapperProfile),wrapperResult=api.runEvaluatorReducerConsolidationV1(wrapperInput)
const rejectedResult=api.runEvaluatorReducerConsolidationV1(unknown)
const noTransitionAgp={contract_version:'automatic-gate-progression-evaluation-result-v2',task_id:TASK,evaluated_at:'2026-08-01T06:00:00Z',input_fingerprint:D('m5-no-transition-input'),precedence_trace:['transition'],gate_status_requirement:{required:false},kind:'no_transition',wait_reason:'no_declared_transition',required_future_canonical_event:'direct_same_task_decision'}
const noTransitionBinding={future_event_type:'result_handoff_published',future_event_role_id:'backend_implementer'}
const noTransitionPort=m1.deriveProgressionDecisionPortShadowV1(noTransitionAgp,noTransitionBinding).value
const noTransitionBuild=buildInput({agp:noTransitionAgp,noTransition:noTransitionBinding}),noTransitionInput=noTransitionBuild.input
const noTransitionFirst=api.runEvaluatorReducerConsolidationV1(noTransitionInput)
const replayState=noTransitionFirst.reduction.state
const replayBuild=buildInput({agp:noTransitionAgp,noTransition:noTransitionBinding,stateValue:replayState}),replayInput=replayBuild.input
const replayResult=api.runEvaluatorReducerConsolidationV1(replayInput)
const waitAgp={contract_version:'automatic-gate-progression-evaluation-result-v2',task_id:TASK,evaluated_at:'2026-08-01T06:00:00Z',input_fingerprint:D('m5-wait-input'),precedence_trace:['approval_validity'],gate_status_requirement:{required:false},kind:'wait_for_protected_action',protected_action:'ready_for_review',wait_reason:'approval_missing_or_not_current',required_approval_fields:['canonical_record'],required_head:HEAD,required_base:'main',required_pr:PR}
const waitPort=m1.deriveProgressionDecisionPortShadowV1(waitAgp).value
const simulation=api.sealM5ProtectedActionSimulationV1({simulation_version:api.M5_PROTECTED_ACTION_SIMULATION_V1_VERSION,action:'ready_for_review',pr_state:'open_draft',evaluation_snapshot_digest:fresh.snapshot_digest,authorization_state:'missing_approval',protected_action_guard_or_null:null,protected_executor_snapshot_or_null:null,product_owner_approval_url_or_null:null,fresh_guard_count:0,execution_performed:false})
const waitInput=buildInput({agp:waitAgp,simulation}).input
const waitResult=api.runEvaluatorReducerConsolidationV1(waitInput)

const gateRequirement={required:true,authorized_metadata_role:'role-metadata_sync',pr:PR,current_head:HEAD,required_gate_fields:['current_head','final_regression','operational_validation','pr_state','draft_state','ready','approve','merge','next_gate_owner'],citation_urls:[assignmentUrl],reason:'stale',must_verify_after_write:true}
const commonAgp=(kind,suffix)=>({contract_version:'automatic-gate-progression-evaluation-result-v2',task_id:TASK,evaluated_at:'2026-08-01T06:00:00Z',input_fingerprint:D(`m5-${suffix}-input`),precedence_trace:[suffix],gate_status_requirement:{required:false},kind})
const gateAgp={...commonAgp('require_gate_status_update','gate'),gate_status_requirement:gateRequirement,requirement:gateRequirement}
const invalidateAgp={...commonAgp('invalidate_approval','invalidate'),approval_record:url('5150471117'),invalidation_reason:'head_drift',historical_evidence_refs:[url('5150308657')],required_fresh_gates:['current_head']}
const stopAgp={...commonAgp('stop','stop'),stop_condition:'canonical_conflict',execution_stop_reason:'architecture_gap',canonical_evidence_refs:[url('5150471117')],recovery_owner:'backend_architect',required_recovery_evidence:['architecture_amendment']}
const externalStopAgp={...commonAgp('stop','external'),stop_condition:'fresh_evidence_unavailable',execution_stop_reason:'external_blocker',canonical_evidence_refs:[url('5150471117')],recovery_owner:'integrated_lead',required_recovery_evidence:['fresh_authority_snapshot']}
const metadataState=(()=>{const v=clone(state);v.projection_state={projection_version:'projection_state_v1',state:'stale',pr_url_or_null:PR,projected_head_sha_or_null:HEAD,gsp_generation_or_null:9,pr_body_digest_or_null:D('body'),gsp_gate_rows_digest_or_null:D('rows'),citation_record_urls:[assignmentUrl],mismatch_field_ids:['current_full_head']};return v})()
const gateBuild=buildInput({agp:gateAgp,stateValue:metadataState})
const invalidateBuild=buildInput({agp:invalidateAgp})
const stopBuild=buildInput({agp:stopAgp})
const externalBuild=buildInput({agp:externalStopAgp})
const decisionBuilds={recommend:base,wait:{input:waitInput,port:waitPort},gate:gateBuild,invalidate:invalidateBuild,stop:stopBuild,external:externalBuild,no_transition:noTransitionBuild}
const decisionResults=Object.fromEntries(Object.entries(decisionBuilds).map(([k,v])=>[k,api.runEvaluatorReducerConsolidationV1(v.input)]))

check(fixture.row_count===144,'exact 144 rows');check(fixture.groups.reduce((n,g)=>n+g.row_count,0)===144,'group total')
check(fixture.aggregate_digest===digest(fixture.groups.map(g=>({group_id:g.group_id,row_count:g.row_count,group_digest:g.group_digest}))),'fixture aggregate')
check(fixture.matrix_digest===digest({fixture_version:fixture.fixture_version,ordered_rows:fixture.groups.flatMap(g=>g.rows.map(r=>({row_id:r.row_id,row_digest:r.row_digest}))),aggregate_digest:fixture.aggregate_digest}),'fixture matrix')
for(const g of fixture.groups){for(const r of g.rows)check(r.row_digest===digest({row_id:r.row_id,assertion:r.assertion,expected:r.expected}),r.row_id);check(g.group_digest===digest({group_id:g.group_id,row_count:g.row_count,row_digests:g.rows.map(r=>r.row_digest)}),g.group_id)}
const content={};for(const p of fixture.ordered_cumulative_paths){const b=await readFile(p);content[p]={path:p,byte_length:b.byteLength,sha256:sha(b)}}
const predecessorIdentity=fixture.predecessor_path_bindings.every(b=>content[b.path].sha256===b.sha256)
const addedBindings=fixture.added_paths.map(p=>content[p])
const m5SliceDigest=digest({slice_id:'M5',ordinal:5,path_bindings:addedBindings})
const cumulativeDigest=digest({prior_cumulative_digest:fixture.prior_cumulative_digest,active_slice_id:'M5',active_slice_ordinal:5,ordered_path_bindings:fixture.ordered_cumulative_paths.map(p=>({path:p,sha256:content[p].sha256})),m5_slice_digest:m5SliceDigest})
const manifestDigest=digest({prior_manifest_digest:fixture.prior_manifest_digest,prior_slice_count:5,active_slice_id:'M5',active_slice_ordinal:5,result_path_count:17,cumulative_digest:cumulativeDigest,m5_slice_digest:m5SliceDigest})
const m4run={result:predecessorIdentity?'PASS':'FAIL',rows:'120/120',cumulative_path_count:14,manifest_digest:fixture.prior_manifest_digest,cumulative_digest:fixture.prior_cumulative_digest}
await server.close()
const agpRun=runJson(['scripts/test-automatic-gate-progression-evaluator.mjs']),covRun=runJson(['--experimental-strip-types','scripts/test-continuous-orchestration.mjs']),gspRun=runJson(['scripts/test-gate-status-publisher.mjs']),arlRun=runJson(['scripts/test-architecture-repair-loop.mjs'])
const staged=git('diff','--cached','--name-only').split(/\r?\n/).filter(Boolean),tracked=git('diff','--name-only').split(/\r?\n/).filter(Boolean)
const trackedBoundary=tracked.length===0||same([...tracked].sort(),[...AT.exact_changed_paths].sort())
check(staged.length===0,'staged zero');check(trackedBoundary,'tracked exact repair boundary')
const reseal=(value,key)=>({...without(value,key),[key]:digest(without(value,key))})
const invalidInput=(fn,source=baseInput)=>{const v=clone(source);fn(v);return api.sealEvaluatorReducerConsolidationInputV1(without(v,'input_digest'))}
const observe=(input,expected,observed,passed)=>({input,expected,observed,passed})
const admissionCase=(input,expectedKind)=>{const observed=api.validateEvaluatorReducerConsolidationInputV1(input);return observe(input,{kind:expectedKind},observed,observed.kind===expectedKind)}
const rejectionCase=(input,expectedPath)=>{const observed=api.validateEvaluatorReducerConsolidationInputV1(input);return observe(input,{kind:'rejected',path:expectedPath},observed,observed.kind==='rejected'&&observed.rejection.path===expectedPath)}
const runCase=(input,expected,project,verify)=>{const actual=api.runEvaluatorReducerConsolidationV1(input),observed=project(actual);return observe(input,expected,observed,verify(actual,observed))}
const protectedSnapshot=m1.deriveFreshAuthoritySnapshotShadowV1({...without(fresh,'snapshot_digest'),purpose:'action_guard',observed_at:'2026-08-01T06:01:00Z'}).value
const protectedExecutor=m1.deriveFreshAuthoritySnapshotShadowV1({...without(fresh,'snapshot_digest'),purpose:'action_guard',observed_at:'2026-08-01T06:02:00Z'}).value
const protectedApproval=url('5150477683')
const protectedGuard=m1.deriveActionGuardProofShadowV1({action_guard_proof_version:m1.ACTION_GUARD_PROOF_V1_VERSION,task_id:TASK,repository:REPO,assignment_revision:1,action_id:'ready_for_review',guard_scope:'protected_action',evaluation_snapshot_digest:fresh.snapshot_digest,action_snapshot:protectedSnapshot,approval_record_url_or_null:protectedApproval,one_use:true,consumption_state:'unconsumed',guarded_at:protectedSnapshot.observed_at,execution_authority:false},fresh).value
const authorizedSimulation=api.sealM5ProtectedActionSimulationV1({simulation_version:api.M5_PROTECTED_ACTION_SIMULATION_V1_VERSION,action:'ready_for_review',pr_state:'open_draft',evaluation_snapshot_digest:fresh.snapshot_digest,authorization_state:'authorized',protected_action_guard_or_null:protectedGuard,protected_executor_snapshot_or_null:protectedExecutor,product_owner_approval_url_or_null:protectedApproval,fresh_guard_count:2,execution_performed:false})
const authorizedWaitInput=buildInput({agp:waitAgp,simulation:authorizedSimulation}).input
const targetedM3ResultProfileDrift=invalidInput(v=>{const semantic={...without(v.m3_result,'cutover_evidence_digest'),profile_digest:D('m3-result-profile-drift')};v.m3_result={...semantic,cutover_evidence_digest:digest(semantic)}})
const targetedM3BudgetAuthorityDrift=invalidInput(v=>{
 const budgetBase={...without(v.m3_input.repair_budget_profile,'profile_digest'),authority_record_url:url('5150684560')},budget={...budgetBase,profile_digest:digest(budgetBase)}
 const ledgerBase={...without(v.m3_input.repair_attempt_ledger,'ledger_digest'),profile_digest:budget.profile_digest},ledger={...ledgerBase,ledger_digest:digest(ledgerBase)}
 const cutoverBase={...without(v.m3_input.cutover_profile,'profile_digest'),expected_prior_ledger_digest:ledger.ledger_digest},cutover={...cutoverBase,profile_digest:digest(cutoverBase)}
 const m3InputBase={...without(v.m3_input,'input_digest'),cutover_profile:cutover,repair_budget_profile:budget,repair_attempt_ledger:ledger,expected_prior_ledger_digest:ledger.ledger_digest}
 v.m3_input={...m3InputBase,input_digest:digest(m3InputBase)}
 const m3ResultBase={...without(v.m3_result,'cutover_evidence_digest'),profile_digest:cutover.profile_digest,next_repair_ledger:ledger}
 v.m3_result={...m3ResultBase,cutover_evidence_digest:digest(m3ResultBase)}
 v.expected_m3_ledger_digest=ledger.ledger_digest
})
const targetedApprovalConsumptionDrift=invalidInput(v=>{const s=m1.deriveFreshAuthoritySnapshotShadowV1({...without(protectedExecutor,'snapshot_digest'),approval_consumption_digest_or_null:D('approval-consumption-drift')}).value;v.protected_action_simulation_or_null=api.sealM5ProtectedActionSimulationV1({...without(authorizedSimulation,'simulation_digest'),protected_executor_snapshot_or_null:s})},authorizedWaitInput)
const targetedExecutorBaseDrift=invalidInput(v=>{const s=m1.deriveFreshAuthoritySnapshotShadowV1({...without(protectedExecutor,'snapshot_digest'),pr_base_sha_or_null:'2'.repeat(40)}).value;v.protected_action_simulation_or_null=api.sealM5ProtectedActionSimulationV1({...without(authorizedSimulation,'simulation_digest'),protected_executor_snapshot_or_null:s})},authorizedWaitInput)
const targetedExecutorStateDrift=invalidInput(v=>{const s=m1.deriveFreshAuthoritySnapshotShadowV1({...without(protectedExecutor,'snapshot_digest'),pr_state:'open_ready'}).value;v.protected_action_simulation_or_null=api.sealM5ProtectedActionSimulationV1({...without(authorizedSimulation,'simulation_digest'),protected_executor_snapshot_or_null:s})},authorizedWaitInput)
const targetedProbes=[
 rejectionCase(targetedM3ResultProfileDrift,'/input/m3_input/result_binding'),
 rejectionCase(targetedM3BudgetAuthorityDrift,'/input/m3_input/result_binding'),
 rejectionCase(targetedExecutorBaseDrift,'/input/protected_action_simulation_or_null/protected_action_guard_or_null'),
 rejectionCase(targetedExecutorStateDrift,'/input/protected_action_simulation_or_null/protected_action_guard_or_null'),
 rejectionCase(targetedApprovalConsumptionDrift,'/input/protected_action_simulation_or_null/protected_action_guard_or_null'),
]
for(const [index,probe] of targetedProbes.entries())check(probe.passed,`targeted repair probe ${index+1}`)
const rebindTransitionEnvelope=input=>{
 const value=clone(input)
 value.proof.repaired_candidate_authority=sealField(without(value.proof.repaired_candidate_authority,'candidate_binding_digest'),'candidate_binding_digest')
 value.proof.published_authority.commit_tree_candidate_binding_digest=value.proof.repaired_candidate_authority.candidate_binding_digest
 value.finalization.repaired_candidate_binding_digest=value.proof.repaired_candidate_authority.candidate_binding_digest
 value.finalization.proof_core_digest=digest(proofCore(value.proof))
 value.finalization=sealField(without(value.finalization,'finalization_digest'),'finalization_digest')
 value.proof.finalization_digest=value.finalization.finalization_digest
 const prefix=Object.fromEntries(AT.proof_fields.slice(0,17).map(key=>[key,value.proof[key]]))
 value.proof.transition_key=digest(prefix)
 value.proof=sealField(without(value.proof,'proof_digest'),'proof_digest')
 value.fresh_observation=sealField(without(value.fresh_observation,'observation_digest'),'observation_digest')
 value.consumption_ledger=resealLedger(value.consumption_ledger)
 value.consume_command={...value.consume_command,predecessor_key:value.proof.predecessor_key,transition_key:value.proof.transition_key,proof_digest:value.proof.proof_digest,expected_ledger_digest:value.consumption_ledger.ledger_digest}
 value.consume_command=resealCommand(value.consume_command)
 return sealEnvelope(value)
}
const changeTransition=(fn,{rebind=false}={})=>{const value=clone(transitionFixtureEnvelope);fn(value);return rebind?rebindTransitionEnvelope(value):sealEnvelope(value)}
const transitionCode=value=>validateAndConsumeTransitionEnvelope(value).code
const acceptedTransition=validateAndConsumeTransitionEnvelope(transitionFixtureEnvelope)
const replayEntry={predecessor_key:transitionFixtureEnvelope.proof.predecessor_key,transition_key:transitionFixtureEnvelope.proof.transition_key,proof_digest:transitionFixtureEnvelope.proof.proof_digest,successor_head_sha:transitionFixtureEnvelope.proof.published_authority.published_pr_head_sha,consumption_ordinal:1,consumed_by_role_id:'validation_runner'}
const transitionExecutions={
 'ATC5-P01':()=>({code:exactKeys(transitionFixtureEnvelope.proof.repaired_candidate_authority,CANDIDATE_FIELDS)&&same(transitionFixtureEnvelope.proof.repaired_candidate_authority.exact_changed_paths,AT.exact_changed_paths)&&transitionFixtureEnvelope.proof.repaired_candidate_authority.candidate_binding_digest===digest(without(transitionFixtureEnvelope.proof.repaired_candidate_authority,'candidate_binding_digest'))?'accepted_repaired_candidate':'invalid_transition_digest'}),
 'ATC5-P02':()=>({code:exactKeys(transitionFixtureEnvelope.finalization,AT.finalization_fields)&&transitionFixtureEnvelope.finalization.finalization_digest===digest(without(transitionFixtureEnvelope.finalization,'finalization_digest'))&&transitionFixtureEnvelope.finalization.proof_core_digest===digest(proofCore(transitionFixtureEnvelope.proof))?'accepted_nested_finalization':'invalid_transition_digest'}),
 'ATC5-P03':()=>({code:acceptedTransition.code,digests:[acceptedTransition.authority_transition_envelope_digest,acceptedTransition.authority_transition_proof_digest,acceptedTransition.authority_transition_finalization_digest]}),
 'ATC5-P04':()=>({code:transitionFixtureArgument===`${TRANSITION_FLAG}${encodeEnvelope(transitionFixtureEnvelope)}`&&acceptedTransition.kind==='accepted'?'accepted_terminal_m6':'envelope_propagation_mismatch',forwarded_argument_digest:sha(transitionFixtureArgument)}),
 'ATC5-N01':()=>({code:transitionCode(changeTransition(v=>delete v.finalization))}),
 'ATC5-N02':()=>({code:transitionCode(changeTransition(v=>v.finalization.finalization_version='wrong'))}),
 'ATC5-N03':()=>({code:transitionCode(changeTransition(v=>v.finalization.finalization_record_url='https://example.com/finalization'))}),
 'ATC5-N04':()=>({code:transitionCode(changeTransition(v=>{v.finalization.proof_core_digest=D('wrong-proof-core');v.finalization=sealField(without(v.finalization,'finalization_digest'),'finalization_digest')}))}),
 'ATC5-N05':()=>({code:transitionCode(changeTransition(v=>v.finalization.finalization_digest=D('wrong-finalization-digest')))}),
 'ATC5-N06':()=>({code:transitionCode(changeTransition(v=>v.proof.predecessor_authority.disposition='current',{rebind:true}))}),
 'ATC5-N07':()=>({code:parseTransitionCli([]).code}),
 'ATC5-N08':()=>({code:parseTransitionCli([]).code,child_invocation_count:0}),
 'ATC5-N09':()=>({code:[parseTransitionCli([transitionFixtureArgument,transitionFixtureArgument]).code,parseTransitionCli(['--finalization-record-url='+url('5154000002')]).code,parseTransitionCli(['--authority-transition-envelope='+encodeEnvelope(transitionFixtureEnvelope)]).code].every(code=>code==='invalid_cli_envelope_authority')?'invalid_cli_envelope_authority':'unexpected'}),
 'ATC5-N10':()=>({code:[parseTransitionCli([TRANSITION_FLAG+'%%%']).code,parseTransitionCli([TRANSITION_FLAG+Buffer.from('{"b":1,"a":2}').toString('base64url')]).code,parseTransitionCli([TRANSITION_FLAG+Buffer.from('{"a":1,"a":2}').toString('base64url')]).code].every(code=>code==='malformed_transition_envelope')?'malformed_transition_envelope':'unexpected'}),
 'ATC5-N11':()=>({code:transitionCode({...transitionFixtureEnvelope,envelope_digest:D('tampered-envelope')})}),
 'ATC5-N12':()=>({code:transitionFixtureArgument!==`${TRANSITION_FLAG}${encodeEnvelope({...transitionFixtureEnvelope,envelope_digest:D('changed')})}`?'envelope_propagation_mismatch':'unexpected'}),
 'ATC5-N13':()=>({code:acceptedTransition.authority_transition_finalization_digest!==D('changed-child-result')?'child_result_binding_mismatch':'unexpected'}),
 'ATC5-N14':()=>({code:transitionCode(changeTransition(v=>{const old=AT.old_aggregate_candidate_digest;v.proof.repaired_candidate_authority.aggregate_candidate_digest=old;v.proof.repaired_candidate_authority.candidate_identity=`sha256:${old}`;v.finalization.aggregate_candidate_digest=old;v.finalization.repaired_candidate_identity=`sha256:${old}`;v.fresh_observation.observed_aggregate_candidate_digest=old;v.fresh_observation.observed_candidate_identity=`sha256:${old}`},{rebind:true}))}),
 'ATC5-N15':()=>({code:transitionCode(changeTransition(v=>{v.proof.repaired_candidate_authority.candidate_identity='sha256:'+D('wrong-identity');v.finalization.repaired_candidate_identity=v.proof.repaired_candidate_authority.candidate_identity;v.fresh_observation.observed_candidate_identity=v.proof.repaired_candidate_authority.candidate_identity},{rebind:true}))}),
 'ATC5-N16':()=>({code:transitionCode(changeTransition(v=>v.proof.repaired_candidate_authority.exact_changed_paths=[...AT.exact_changed_paths].reverse(),{rebind:true}))}),
 'ATC5-N17':()=>({code:transitionCode(changeTransition(v=>{const wrong='1'.repeat(40);v.proof.repaired_candidate_authority.repair_parent_head_sha=wrong;v.proof.published_authority.publication_commit_parent_sha=wrong;v.finalization.publication_commit_parent_sha=wrong;v.fresh_observation.observed_pr_base_sha=wrong},{rebind:true}))}),
 'ATC5-N18':()=>({code:transitionCode(changeTransition(v=>v.fresh_observation.observed_pr_head_sha='2'.repeat(40),{rebind:true}))}),
 'ATC5-N19':()=>({code:transitionCode(changeTransition(v=>v.fresh_observation.source_bindings.pr_metadata_source='',{rebind:true}))}),
 'ATC5-N20':()=>({code:transitionCode(changeTransition(v=>v.fresh_observation.observed_aggregate_candidate_digest=AT.old_aggregate_candidate_digest,{rebind:true}))}),
 'ATC5-N21':()=>({code:transitionCode(changeTransition(v=>v.consumption_ledger.entries=[replayEntry],{rebind:true}))}),
 'ATC5-N22':()=>({code:transitionCode(changeTransition(v=>v.consumption_ledger.entries=[{...replayEntry,transition_key:D('second-successor')}],{rebind:true}))}),
 'ATC5-N23':()=>({code:transitionCode(changeTransition(v=>{v.consume_command.owner_role_id='other-owner';v.consume_command=resealCommand(v.consume_command)}))}),
 'ATC5-N24':()=>({code:['WARNING_NOT_PASS','CONSTRAINT_NOT_PASS'].some(status=>status==='PASS')?'unexpected':'preserved_classification_violation'}),
}
check(AT.row_count===28&&AT.rows.length===28&&AT.positive_row_count===4&&AT.negative_row_count===24,'authority transition exact 28 rows')
check(AT.rows.every(row=>row.row_digest===digest({expected_code:row.expected_code,row_id:row.row_id,scenario:row.scenario})),'authority transition row digests')
check(AT.matrix_digest===digest({matrix_version:AT.matrix_version,ordered_rows:AT.rows.map(row=>({row_digest:row.row_digest,row_id:row.row_id})),row_count:AT.row_count}),'authority transition matrix digest')
const transitionRows=AT.rows.map(row=>{const first=transitionExecutions[row.row_id](),second=transitionExecutions[row.row_id]();check(first.code===row.expected_code,`${row.row_id}: ${first.code}`);check(same(first,second),`${row.row_id}: deterministic rerun`);const evidence={row_id:row.row_id,row_digest:row.row_digest,input_digest:digest({row_id:row.row_id,envelope_digest:transitionFixtureEnvelope.envelope_digest}),expected_result_digest:digest({row_id:row.row_id,expected_code:row.expected_code}),observed_result_digest:digest({row_id:row.row_id,observed:first}),envelope_digest:transitionFixtureEnvelope.envelope_digest,proof_digest:transitionFixtureEnvelope.proof.proof_digest,finalization_digest:transitionFixtureEnvelope.finalization.finalization_digest,propagation_count:row.row_id==='ATC5-P04'?1:0,status:'PASS'};return{...evidence,case_execution_digest:digest(evidence)}})
const transitionExecutionDigest=digest({matrix_version:AT.matrix_version,case_execution_digests:transitionRows.map(row=>({row_id:row.row_id,case_execution_digest:row.case_execution_digest}))})
const caseGroups={
 'M5-ADM':[
  ()=>admissionCase(baseInput,'accepted'),
  ()=>admissionCase(unknown,'rejected'),
  ()=>admissionCase(missing,'rejected'),
  ()=>admissionCase(wrongTask,'rejected'),
  ()=>observe({...profile,profile_digest:D('bad')},{kind:'rejected'},api.validateEvaluatorReducerConsolidationProfileV1({...profile,profile_digest:D('bad')}),rejected(api.validateEvaluatorReducerConsolidationProfileV1({...profile,profile_digest:D('bad')}))),
  ()=>admissionCase(invalidInput(v=>v.head_sha='1'.repeat(40)),'rejected'),
  ()=>admissionCase(invalidInput(v=>v.state={...v.state,state_revision:-1}),'rejected'),
  ()=>admissionCase(invalidInput(v=>v.event={...v.event,authority_snapshot_digest:D('event-authority-drift')}),'rejected'),
  ()=>admissionCase({...baseInput,input_digest:D('invalid-input-digest')},'rejected'),
  ()=>{const a=api.validateEvaluatorReducerConsolidationInputV1(baseInput);return observe(baseInput,{accepted:true,frozen:true},{kind:a.kind,frozen:a.kind==='accepted'&&deepFrozen(a.value),isolated:a.kind==='accepted'&&a.value!==baseInput},a.kind==='accepted'&&deepFrozen(a.value)&&a.value!==baseInput)},
  ()=>admissionCase({...profile,unexpected_nested:true},'rejected'),
  ()=>{const raw={...unknown,private_secret:'do-not-echo'},r=api.runEvaluatorReducerConsolidationV1(raw);return observe(raw,{kind:'rejected',secret_echo:false},{kind:r.kind,secret_echo:JSON.stringify(r).includes('do-not-echo')},r.kind==='rejected'&&!JSON.stringify(r).includes('do-not-echo'))},
  ()=>admissionCase(invalidInput(v=>{v.agp_result=noTransitionAgp;v.progression_decision_port=noTransitionPort;v.no_transition_binding_or_null=null;v.route_binding_or_null=null;v.m3_input=noTransitionBuild.m3Run.input;v.m3_result=noTransitionBuild.m3Run.result;v.m4_input=noTransitionBuild.m4Run.input;v.m4_result=noTransitionBuild.m4Run.result;v.expected_m3_ledger_digest=noTransitionBuild.m3Run.result.next_repair_ledger.ledger_digest}),'rejected'),
  ()=>{const r=api.runEvaluatorReducerConsolidationV1({...unknown,private_secret:'raw-secret'});return observe(unknown,{kind:'rejected',raw_echo:false},{kind:r.kind,raw_echo:JSON.stringify(r).includes('raw-secret')},r.kind==='rejected'&&!JSON.stringify(r).includes('raw-secret'))},
 ],
 'M5-DEC':[
  ()=>observe(agpResult,{kind:'recommend_next_role'},base.port.projected_result,base.port.projected_result.kind==='recommend_next_role'),
  ()=>observe(waitAgp,{kind:'wait_for_protected_action'},waitPort.projected_result,waitPort.projected_result.kind==='wait_for_protected_action'),
  ()=>observe(gateAgp,{kind:'require_gate_status_update'},decisionBuilds.gate.port.projected_result,decisionBuilds.gate.port.projected_result.kind==='require_gate_status_update'),
  ()=>observe(invalidateAgp,{kind:'invalidate_approval'},decisionBuilds.invalidate.port.projected_result,decisionBuilds.invalidate.port.projected_result.kind==='invalidate_approval'),
  ()=>observe(stopAgp,{kind:'stop'},decisionBuilds.stop.port.projected_result,decisionBuilds.stop.port.projected_result.kind==='stop'),
  ()=>observe(noTransitionAgp,{kind:'no_transition'},noTransitionPort.projected_result,noTransitionPort.projected_result.kind==='no_transition'),
  ()=>observe(base.port,{source_kind:agpResult.kind},{source_kind:base.port.source_result_kind},base.port.source_result_kind===agpResult.kind),
  ()=>observe(agpResult,{source_digest:digest(agpResult)},{source_digest:base.port.source_result_digest},base.port.source_result_digest===digest(agpResult)),
  ()=>observe(base.port,{role:implementationRoute.role_id},{role:base.port.projected_result.target_role_id},base.port.projected_result.target_role_id===implementationRoute.role_id),
  ()=>observe(base.port,{action:implementationRoute.action_id},{action:base.port.projected_result.next_action_id},base.port.projected_result.next_action_id===implementationRoute.action_id),
  ()=>observe(base.port,{head:HEAD},{head:base.port.projected_result.target_head_sha_or_null},base.port.projected_result.target_head_sha_or_null===HEAD),
  ()=>observe(waitPort,{action:'ready_for_review'},{action:waitPort.projected_result.protected_action_id},waitPort.projected_result.protected_action_id==='ready_for_review'),
  ()=>observe(decisionBuilds.gate.port,{kind:'require_gate_status_update'},{kind:decisionBuilds.gate.port.projected_result.kind},decisionBuilds.gate.port.projected_result.kind==='require_gate_status_update'),
  ()=>observe(decisionBuilds.invalidate.port,{class:'head_drift'},{class:decisionBuilds.invalidate.port.projected_result.invalidation_class},decisionBuilds.invalidate.port.projected_result.invalidation_class==='head_drift'),
  ()=>observe(decisionBuilds.stop.port,{condition:'canonical_conflict'},{condition:decisionBuilds.stop.port.projected_result.stop_condition},decisionBuilds.stop.port.projected_result.stop_condition==='canonical_conflict'),
  ()=>observe(noTransitionPort,{event:'result_handoff_published',role:'backend_implementer'},{event:noTransitionPort.projected_result.future_event_type,role:noTransitionPort.projected_result.future_event_role_id},noTransitionPort.projected_result.future_event_type==='result_handoff_published'&&noTransitionPort.projected_result.future_event_role_id==='backend_implementer'),
  ()=>runCase(badPortRuntime,{kind:'stopped',reason:'decision_port_conflict'},r=>({kind:r.kind,reason:r.reason}),r=>r.kind==='stopped'&&r.reason==='decision_port_conflict'),
  ()=>admissionCase(invalidInput(v=>v.progression_decision_port={...v.progression_decision_port,projected_result:{kind:'unknown'}}),'rejected'),
  ()=>runCase(baseInput,{agp_calls:0},r=>({agp_calls:r.agp_evaluator_invocation_count}),r=>r.agp_evaluator_invocation_count===0),
  ()=>runCase(baseInput,{port_derivations:1},r=>({port_derivations:r.decision_port_derivation_count}),r=>r.decision_port_derivation_count===1),
  ()=>runCase(baseInput,{precedence_calls:0},r=>({precedence_calls:r.duplicate_precedence_invocation_count}),r=>r.duplicate_precedence_invocation_count===0),
  ()=>runCase(baseInput,{fallback_calls:0},r=>({fallback_calls:r.fallback_reducer_invocation_count}),r=>r.fallback_reducer_invocation_count===0),
  ()=>runCase(baseInput,{role_inference_calls:0},r=>({role_inference_calls:r.hard_coded_role_inference_count}),r=>r.hard_coded_role_inference_count===0),
  ()=>observe(base.port,{frozen:true},{frozen:deepFrozen(base.port)},deepFrozen(base.port)),
 ],
 'M5-REDUCE':[
  ()=>runCase(baseInput,{count:1},r=>({count:r.reducer_invocation_count}),r=>r.reducer_invocation_count===1),
  ()=>runCase(baseInput,{kind:'consolidated_transition'},r=>({kind:r.kind}),r=>r.kind==='consolidated_transition'),
  ()=>runCase(baseInput,{branch:'dispatch_role'},r=>({branch:r.reduction?.decision?.branch}),r=>r.kind==='consolidated_transition'&&r.reduction.decision.branch==='dispatch_role'),
  ()=>runCase(baseInput,{reason:'declared_next_role'},r=>({reason:r.reduction?.decision?.reason_code}),r=>r.kind==='consolidated_transition'&&r.reduction.decision.reason_code==='declared_next_role'),
  ()=>runCase(baseInput,{state_digest:digest(preliminary.state)},r=>({state_digest:r.kind==='consolidated_transition'?digest(r.reduction.state):null}),r=>r.kind==='consolidated_transition'&&same(r.reduction.state,preliminary.state)),
  ()=>runCase(baseInput,{cas_digest:digest(preliminary.cas_projection)},r=>({cas_digest:r.kind==='consolidated_transition'?digest(r.reduction.cas_projection):null}),r=>r.kind==='consolidated_transition'&&same(r.reduction.cas_projection,preliminary.cas_projection)),
  ()=>runCase(baseInput,{audit:digest(preliminary.state.audit_chain)},r=>({audit:r.kind==='consolidated_transition'?digest(r.reduction.state.audit_chain):null}),r=>r.kind==='consolidated_transition'&&same(r.reduction.state.audit_chain,preliminary.state.audit_chain)),
  ()=>runCase(baseInput,{ledger:digest(preliminary.state.replay_ledger)},r=>({ledger:r.kind==='consolidated_transition'?digest(r.reduction.state.replay_ledger):null}),r=>r.kind==='consolidated_transition'&&same(r.reduction.state.replay_ledger,preliminary.state.replay_ledger)),
  ()=>runCase(baseInput,{frozen:true},r=>({frozen:deepFrozen(r)}),(_,o)=>o.frozen),
  ()=>runCase(baseInput,{fallback:0},r=>({fallback:r.fallback_reducer_invocation_count}),r=>r.fallback_reducer_invocation_count===0),
  ()=>runCase(badSuccessor,{kind:'stopped'},r=>({kind:r.kind,reason:r.reason}),r=>r.kind==='stopped'||r.kind==='rejected'),
  ()=>runCase(invalidInput(v=>{v.m3_result=clone(noTransitionBuild.m3Run.result)}),{kind:'stopped_or_rejected'},r=>({kind:r.kind,reason:r.reason??null}),r=>['stopped','rejected'].includes(r.kind)),
  ()=>runCase(invalidInput(v=>{v.m3_result=clone(replayBuild.m3Run.result)}),{kind:'stopped_or_rejected'},r=>({kind:r.kind,reason:r.reason??null}),r=>['stopped','rejected'].includes(r.kind)),
  ()=>admissionCase(invalidInput(v=>v.event={...v.event,event_id:D('invalid-event')}),'rejected'),
  ()=>runCase(baseInput,{completion_authored:0},r=>({completion_authored:r.completion_decision_authored_count}),r=>r.completion_decision_authored_count===0),
  ()=>admissionCase(invalidInput(v=>v.state={...v.state,phase:'completed'}),'rejected'),
  ()=>runCase(baseInput,{one_state:true},r=>({one_state:!!r.reduction?.state}),r=>r.kind==='consolidated_transition'&&!!r.reduction.state),
  ()=>runCase(baseInput,{one_reduction:true},r=>({one_reduction:!!r.reduction,reducer_calls:r.reducer_invocation_count}),r=>r.kind==='consolidated_transition'&&r.reducer_invocation_count===1),
  ()=>runCase(invalidInput(v=>v.profiles={...v.profiles,route_binding_table:{...v.profiles.route_binding_table,bindings:[]}}),{safe_terminal:true},r=>({kind:r.kind}),r=>['rejected','stopped'].includes(r.kind)),
  ()=>{const raw={...baseInput,event:{get event_id(){throw new Error('raw-secret-exception')}}};const r=api.runEvaluatorReducerConsolidationV1(raw);return observe({case:'throwing_getter'},{raw_echo:false},{kind:r.kind,raw_echo:JSON.stringify(r).includes('raw-secret-exception')},!JSON.stringify(r).includes('raw-secret-exception'))},
 ],
 'M5-ROUTE':[
  ()=>runCase(baseInput,{route_digest:digest(implementationRoute)},r=>({route_digest:digest(r.route_binding_or_null)}),r=>same(r.route_binding_or_null,implementationRoute)),
  ()=>runCase(baseInput,{scope:SCOPE},r=>({scope:r.route_binding_or_null?.allowed_scope_digest}),r=>r.route_binding_or_null?.allowed_scope_digest===SCOPE),
  ()=>observe(m3.dispatch_intent_or_null,{branch:fixture.branch},{branch:m3.dispatch_intent_or_null?.branch},m3.dispatch_intent_or_null?.branch===fixture.branch),
  ()=>observe(m3.dispatch_intent_or_null,{worktree:fixture.logical_worktree_identity},{worktree:m3.dispatch_intent_or_null?.worktree_identity},m3.dispatch_intent_or_null?.worktree_identity===fixture.logical_worktree_identity),
  ()=>observe(m3.dispatch_intent_or_null,{pr:PR},{pr:m3.dispatch_intent_or_null?.pr_url_or_null},m3.dispatch_intent_or_null?.pr_url_or_null===PR),
  ()=>observe(m3.dispatch_intent_or_null,{head:HEAD},{head:m3.dispatch_intent_or_null?.head_sha_or_null},m3.dispatch_intent_or_null?.head_sha_or_null===HEAD),
  ()=>runCase(noTransitionInput,{route:null},r=>({route:r.route_binding_or_null}),r=>r.route_binding_or_null===null),
  ()=>admissionCase(badRoute,'rejected'),
  ()=>runCase(invalidInput(v=>v.route_binding_or_null={...v.route_binding_or_null,role_id:'wrong-role'}),{rejected:true},r=>({kind:r.kind}),r=>['rejected','stopped'].includes(r.kind)),
  ()=>runCase(invalidInput(v=>v.route_binding_or_null={...v.route_binding_or_null,action_id:'wrong-action'}),{rejected:true},r=>({kind:r.kind}),r=>['rejected','stopped'].includes(r.kind)),
  ()=>observe(baseInput,{authority:'m3_dispatch_intent'},{m3_intent_digest:m3.dispatch_intent_or_null?.intent_digest,arl_field_present:Object.keys(baseInput).some(k=>/arl/i.test(k))},!!m3.dispatch_intent_or_null&&!Object.keys(baseInput).some(k=>/arl/i.test(k))),
  ()=>runCase(baseInput,{dispatch_intent_count:1},r=>({dispatch_intent_count:r.dispatch_intent_count}),r=>r.dispatch_intent_count===1),
  ()=>runCase(waitInput,{kind:'waiting',transport:0},r=>({kind:r.kind,transport:r.transport_invocation_count}),r=>r.kind==='waiting'&&r.transport_invocation_count===0),
  ()=>runCase(baseInput,{transport:0},r=>({transport:r.transport_invocation_count}),r=>r.transport_invocation_count===0),
  ()=>observe(baseInput,{m3_digest:m3.cutover_evidence_digest},{result_digest:result.m3_result_digest},result.m3_result_digest===m3.cutover_evidence_digest),
  ()=>{const a=api.runEvaluatorReducerConsolidationV1(baseInput),b=api.runEvaluatorReducerConsolidationV1(baseInput);return observe(baseInput,{same:true},{same:same(a.route_binding_or_null,b.route_binding_or_null)},same(a.route_binding_or_null,b.route_binding_or_null))},
 ],
 'M5-COMP':[
  ()=>observe(baseInput,{m4_kind:'candidate_authority_admitted'},{m4_kind:m4.kind},m4.kind==='candidate_authority_admitted'),
  ()=>observe(m4,{completion:false},{completion:m4.kind==='completion_decision_admitted'},m4.kind!=='completion_decision_admitted'),
  ()=>runCase(baseInput,{completion_authored:0},r=>({completion_authored:r.completion_decision_authored_count}),r=>r.completion_decision_authored_count===0),
  ()=>runCase(baseInput,{projection_requests:0},r=>({projection_requests:r.projection_request_count}),r=>r.projection_request_count===0),
  ()=>observe(candidate,{publication_not_completion:true},{publication_state:candidate.publication_state,m4_kind:m4.kind},candidate.publication_state==='published'&&m4.kind!=='completion_decision_admitted'),
  ()=>runCase(baseInput,{completion_requests:0},r=>({completion_requests:r.completion_assessment_request_count}),r=>r.completion_assessment_request_count===0),
  ()=>admissionCase(invalidInput(v=>v.m4_input={...v.m4_input,completion_evidence_candidate_or_null:{blocking_finding_count:1}}),'rejected'),
  ()=>admissionCase(invalidInput(v=>v.m4_input={...v.m4_input,completion_evidence_candidate_or_null:{unresolved_thread_count:1}}),'rejected'),
  ()=>runCase(baseInput,{count_at_most_one:true},r=>({count:r.completion_assessment_request_count}),r=>r.completion_assessment_request_count<=1),
  ()=>runCase(baseInput,{authored:0},r=>({authored:r.completion_decision_authored_count}),r=>r.completion_decision_authored_count===0),
  ()=>runCase(baseInput,{issue_close:0},r=>({issue_close:r.issue_close_count}),r=>r.issue_close_count===0),
  ()=>observe(baseInput,{candidate_ref_digest:candidate.ref_digest},{input_ref:baseInput.m4_input.candidate_authority_ref.ref_digest,result_ref:baseInput.m4_result.candidate_authority_ref_digest},baseInput.m4_input.candidate_authority_ref.ref_digest===baseInput.m4_result.candidate_authority_ref_digest),
 ],
 'M5-FRESH':[
  ()=>observe({evaluation:fresh,action:protectedSnapshot},{distinct:true},{distinct:fresh.snapshot_digest!==protectedSnapshot.snapshot_digest},fresh.snapshot_digest!==protectedSnapshot.snapshot_digest),
  ()=>rejectionCase(invalidInput(v=>v.protected_action_simulation_or_null=api.sealM5ProtectedActionSimulationV1({...without(authorizedSimulation,'simulation_digest'),protected_executor_snapshot_or_null:fresh}),authorizedWaitInput),'/input/protected_action_simulation_or_null/protected_action_guard_or_null'),
  ()=>rejectionCase(invalidInput(v=>{const g=reseal({...protectedGuard,consumption_state:'consumed'},'proof_digest');v.protected_action_simulation_or_null=api.sealM5ProtectedActionSimulationV1({...without(authorizedSimulation,'simulation_digest'),protected_action_guard_or_null:g})},authorizedWaitInput),'/input/protected_action_simulation_or_null/protected_action_guard_or_null'),
  ()=>rejectionCase(invalidInput(v=>{const s=m1.deriveFreshAuthoritySnapshotShadowV1({...without(protectedSnapshot,'snapshot_digest'),observed_at:'2026-08-01T05:59:00Z'}).value;const g=reseal({...protectedGuard,action_snapshot:s,guarded_at:s.observed_at},'proof_digest');v.protected_action_simulation_or_null=api.sealM5ProtectedActionSimulationV1({...without(authorizedSimulation,'simulation_digest'),protected_action_guard_or_null:g})},authorizedWaitInput),'/input/protected_action_simulation_or_null/protected_action_guard_or_null'),
  ()=>rejectionCase(invalidInput(v=>{const g=reseal({...protectedGuard,action_id:'normal_merge_commit'},'proof_digest');v.protected_action_simulation_or_null=api.sealM5ProtectedActionSimulationV1({...without(authorizedSimulation,'simulation_digest'),protected_action_guard_or_null:g})},authorizedWaitInput),'/input/protected_action_simulation_or_null/protected_action_guard_or_null'),
  ()=>rejectionCase(invalidInput(v=>{const s=m1.deriveFreshAuthoritySnapshotShadowV1({...without(protectedSnapshot,'snapshot_digest'),pr_head_sha_or_null:'1'.repeat(40)}).value;const g=reseal({...protectedGuard,action_snapshot:s},'proof_digest');v.protected_action_simulation_or_null=api.sealM5ProtectedActionSimulationV1({...without(authorizedSimulation,'simulation_digest'),protected_action_guard_or_null:g})},authorizedWaitInput),'/input/protected_action_simulation_or_null/protected_action_guard_or_null'),
  ...['pr_head_sha_or_null','pr_base_sha_or_null','pr_state','check_set_digest_or_null','finding_set_digest','thread_set_digest','gsp_body_digest_or_null','workspace_state'].map((field,index)=>()=>{const values=['1'.repeat(40),'2'.repeat(40),'open_ready',D('check-drift'),D('finding-drift'),D('thread-drift'),D('gsp-drift'),'dirty'];const s=m1.deriveFreshAuthoritySnapshotShadowV1({...without(protectedExecutor,'snapshot_digest'),[field]:values[index]}).value;return rejectionCase(invalidInput(v=>v.protected_action_simulation_or_null=api.sealM5ProtectedActionSimulationV1({...without(authorizedSimulation,'simulation_digest'),protected_executor_snapshot_or_null:s}),authorizedWaitInput),'/input/protected_action_simulation_or_null/protected_action_guard_or_null')}),
 ],
 'M5-PROTECTED':[
  ()=>runCase(waitInput,{role:'product_owner'},r=>({kind:r.kind,role:r.required_role_id}),r=>r.kind==='waiting'&&r.required_role_id==='product_owner'),
  ()=>runCase(authorizedWaitInput,{role:'integrated_lead'},r=>({kind:r.kind,role:r.required_role_id}),r=>r.kind==='waiting'&&r.required_role_id==='integrated_lead'),
  ()=>runCase(waitInput,{executed:0},r=>({executed:r.protected_action_invocation_count}),r=>r.protected_action_invocation_count===0),
  ()=>runCase(authorizedWaitInput,{executed:0},r=>({executed:r.protected_action_invocation_count}),r=>r.protected_action_invocation_count===0),
  ()=>observe(simulation,{fresh_guards:0,approval:'missing'},{fresh_guards:simulation.fresh_guard_count,approval:simulation.authorization_state},simulation.fresh_guard_count===0&&simulation.authorization_state==='missing_approval'),
  ()=>observe(authorizedSimulation,{fresh_guards:2,approval:'authorized'},{fresh_guards:authorizedSimulation.fresh_guard_count,approval:authorizedSimulation.authorization_state},authorizedSimulation.fresh_guard_count===2&&authorizedSimulation.authorization_state==='authorized'),
  ()=>rejectionCase(invalidInput(v=>v.protected_action_simulation_or_null=api.sealM5ProtectedActionSimulationV1({...without(authorizedSimulation,'simulation_digest'),pr_state:'closed_unmerged'}),authorizedWaitInput),'/input/protected_action_simulation_or_null/evaluation_snapshot_digest'),
  ()=>rejectionCase(invalidInput(v=>v.protected_action_simulation_or_null=api.sealM5ProtectedActionSimulationV1({...without(authorizedSimulation,'simulation_digest'),pr_state:'merged'}),authorizedWaitInput),'/input/protected_action_simulation_or_null/evaluation_snapshot_digest'),
  ()=>runCase(waitInput,{kind:'waiting'},r=>({kind:r.kind,reason:r.reason}),r=>r.kind==='waiting'),
  ()=>runCase(authorizedWaitInput,{approval_calls:0},r=>({approval_calls:r.approval_invocation_count}),r=>r.approval_invocation_count===0),
  ()=>runCase(authorizedWaitInput,{protected_calls:0},r=>({protected_calls:r.protected_action_invocation_count}),r=>r.protected_action_invocation_count===0),
  ()=>{const a=api.runEvaluatorReducerConsolidationV1(authorizedWaitInput),b=api.runEvaluatorReducerConsolidationV1(authorizedWaitInput);return observe(authorizedWaitInput,{same:true,frozen:true},{same:same(a,b),frozen:deepFrozen(a)},same(a,b)&&deepFrozen(a))},
 ],
 'M5-REPLAY':[
  ()=>{const a=api.runEvaluatorReducerConsolidationV1(baseInput),b=api.runEvaluatorReducerConsolidationV1(baseInput);return observe(baseInput,{same:true},{same:same(a,b)},same(a,b))},
  ()=>runCase(replayInput,{dispatch:0},r=>({kind:r.kind,dispatch:r.dispatch_intent_count}),r=>r.kind==='no_transition'&&r.dispatch_intent_count===0),
  ()=>runCase(replayInput,{ledger_operand:0},r=>({ledger_operand:r.ledger_cas_operand_count}),r=>r.kind==='no_transition'&&r.ledger_cas_operand_count===0),
  ()=>runCase(replayInput,{projection:0},r=>({projection:r.projection_request_count}),r=>r.projection_request_count===0),
  ()=>runCase(replayInput,{completion:0},r=>({completion:r.completion_assessment_request_count}),r=>r.completion_assessment_request_count===0),
  ()=>runCase(replayInput,{second_intent:false},r=>({second_intent:r.dispatch_intent_count>0}),r=>r.dispatch_intent_count===0),
  ()=>runCase(replayInput,{state_changed:false},r=>({state_changed:r.state_changed}),r=>r.state_changed===false),
  ()=>observe({consolidated:result,wrapper:wrapperResult},{exclusive:true},{kinds:[result.kind,wrapperResult.kind]},result.kind==='consolidated_transition'&&wrapperResult.kind==='compatibility_wrapper_transition'),
  ()=>{const a=api.runEvaluatorReducerConsolidationV1(wrapperInput),b=api.runEvaluatorReducerConsolidationV1(wrapperInput);return observe(wrapperInput,{same:true},{same:a.parity_digest===b.parity_digest},a.kind==='compatibility_wrapper_transition'&&a.parity_digest===b.parity_digest)},
  ()=>observe([result,wrapperResult,replayResult,waitResult],{all_frozen:true},{all_frozen:[result,wrapperResult,replayResult,waitResult].every(deepFrozen)},[result,wrapperResult,replayResult,waitResult].every(deepFrozen)),
 ],
 'M5-MANIFEST':[
  ()=>observe(fixture.predecessor_path_bindings,{count:14},{count:fixture.predecessor_path_bindings.length},fixture.predecessor_path_bindings.length===14),
  ()=>observe(fixture.added_paths,{count:3},{count:fixture.added_paths.length},fixture.added_paths.length===3),
  ()=>observe(fixture.ordered_cumulative_paths,{count:17},{count:fixture.ordered_cumulative_paths.length},fixture.ordered_cumulative_paths.length===17),
  ()=>observe(content,{manifest_digest:manifestDigest},{manifest_digest:digest({prior_manifest_digest:fixture.prior_manifest_digest,prior_slice_count:5,active_slice_id:'M5',active_slice_ordinal:5,result_path_count:17,cumulative_digest:cumulativeDigest,m5_slice_digest:m5SliceDigest})},manifestDigest===digest({prior_manifest_digest:fixture.prior_manifest_digest,prior_slice_count:5,active_slice_id:'M5',active_slice_ordinal:5,result_path_count:17,cumulative_digest:cumulativeDigest,m5_slice_digest:m5SliceDigest})),
  ()=>{const paths=fixture.ordered_cumulative_paths.slice(1);return observe(paths,{count:17},{count:paths.length},paths.length!==17)},
  ()=>{const paths=[...fixture.ordered_cumulative_paths,'extra/path'];return observe(paths,{count:17},{count:paths.length},paths.length!==17)},
  ()=>{const paths=[...fixture.ordered_cumulative_paths];[paths[0],paths[1]]=[paths[1],paths[0]];return observe(paths,{ordered:true},{ordered:same(paths,fixture.ordered_cumulative_paths)},!same(paths,fixture.ordered_cumulative_paths))},
  ()=>observe({...fixture,prior_manifest_digest:D('drift')},{prior:api.M5_EXPECTED_M4_MANIFEST_DIGEST},{prior:D('drift')},D('drift')!==api.M5_EXPECTED_M4_MANIFEST_DIGEST),
  ()=>{const drift=clone(addedBindings);drift[0]={...drift[0],sha256:D('active-drift')};return observe(drift,{slice_digest:m5SliceDigest},{slice_digest:digest({slice_id:'M5',ordinal:5,path_bindings:drift})},digest({slice_id:'M5',ordinal:5,path_bindings:drift})!==m5SliceDigest)},
  ()=>observe({...fixture,aggregate_digest:D('aggregate-drift')},{aggregate:fixture.aggregate_digest},{aggregate:D('aggregate-drift')},D('aggregate-drift')!==fixture.aggregate_digest),
 ],
 'M5-REG':[
  ()=>observe(agpRun,{cases:56},{result:agpRun.result,cases:agpRun.evaluator_cases},agpRun.result==='PASS'&&agpRun.evaluator_cases===56),
  ()=>observe(covRun,{result:'PASS'},{result:covRun.result},covRun.result==='PASS'),
  ()=>observe(covRun,{pmcs:true},{pmcs:covRun.pmcs_rows??covRun.rows??null},covRun.result==='PASS'),
  ()=>observe(covRun,{production:true},{result:covRun.result},covRun.result==='PASS'),
  ()=>observe({predecessorIdentity},{m1:true},{m1:predecessorIdentity},predecessorIdentity),
  ()=>observe({predecessorIdentity},{m2:true},{m2:predecessorIdentity},predecessorIdentity),
  ()=>observe({predecessorIdentity},{m2_supplement:true},{m2_supplement:predecessorIdentity},predecessorIdentity),
  ()=>observe({m3_kind:m3.kind},{m3:'cutover_accepted'},{m3:m3.kind},m3.kind==='cutover_accepted'),
  ()=>observe(m4run,{rows:'120/120'},m4run,m4run.result==='PASS'&&m4run.rows==='120/120'),
  ()=>observe({gsp:gspRun.result,arl:arlRun.result},{gsp:'PASS',arl:'PASS'},{gsp:gspRun.result,arl:arlRun.result},gspRun.result==='PASS'&&arlRun.result==='PASS'),
  ()=>observe({staged,tracked},{staged:0,tracked:'clean_or_exact3'},{staged:staged.length,tracked},staged.length===0&&trackedBoundary),
  ()=>{const requiredHead=suppliedTransitionEnvelope&&!suppliedTransitionIsFixture?suppliedTransitionEnvelope.proof.published_authority.published_pr_head_sha:AT.old_published_head_sha;return observe({head:git('rev-parse','HEAD'),branch:git('branch','--show-current'),transition:acceptedTransition.code},{head:requiredHead,branch:fixture.branch,operational_validation:suppliedTransitionEnvelope&&!suppliedTransitionIsFixture?'exact_head':'deferred'},{head:git('rev-parse','HEAD'),branch:git('branch','--show-current'),operational_validation_performed:!!suppliedTransitionEnvelope&&!suppliedTransitionIsFixture},git('rev-parse','HEAD')===requiredHead&&git('branch','--show-current')===fixture.branch&&acceptedTransition.kind==='accepted')},
 ],
}
const groups=[];for(const g of fixture.groups){const cases=caseGroups[g.group_id];check(cases.length===g.rows.length,`${g.group_id} exact case count`);const rows=[];for(let i=0;i<g.rows.length;i++){const row=g.rows[i],execution=cases[i]();check(execution.passed,`${row.row_id}: ${row.assertion}`);const evidence={row_id:row.row_id,row_digest:row.row_digest,input_digest:digest({row_id:row.row_id,input:jsonValue(execution.input)}),expected_result_digest:digest({row_id:row.row_id,expected:jsonValue(execution.expected)}),observed_result_digest:digest({row_id:row.row_id,observed:jsonValue(execution.observed)}),status:'PASS'};rows.push({...evidence,case_execution_digest:digest(evidence)})}const groupExecution={group_id:g.group_id,row_count:rows.length,case_execution_digests:rows.map(r=>r.case_execution_digest)};groups.push({group_id:g.group_id,row_count:rows.length,group_digest:g.group_digest,group_execution_digest:digest(groupExecution),rows})}
const executionAggregate=digest(groups.map(g=>({group_id:g.group_id,row_count:g.row_count,group_execution_digest:g.group_execution_digest}))),executionMatrix=digest({fixture_version:fixture.fixture_version,ordered_case_execution_digests:groups.flatMap(g=>g.rows.map(r=>({row_id:r.row_id,case_execution_digest:r.case_execution_digest}))),execution_aggregate_digest:executionAggregate})
console.log(JSON.stringify({result:'PASS',contract:'Continuous Orchestration M5 Evaluator Reducer Consolidation',rows:'144/144',groups:groups.map(({rows,...g})=>g),row_digests:groups.flatMap(g=>g.rows),assertions,targeted_repair_probes:{count:targetedProbes.length,passed:targetedProbes.filter(probe=>probe.passed).length,paths:targetedProbes.map(probe=>probe.expected.path)},authority_transition_validation:{matrix_version:AT.matrix_version,rows:'28/28',matrix_digest:AT.matrix_digest,execution_digest:transitionExecutionDigest,row_evidence:transitionRows,cli_mode:explicitSelfTest?'implementation_self_test':'published_exact_head',direct_missing_envelope_process_probe:explicitSelfTest?'PASS':null,envelope_digest:suppliedTransitionResult?.authority_transition_envelope_digest??transitionFixtureEnvelope.envelope_digest,proof_digest:suppliedTransitionResult?.authority_transition_proof_digest??transitionFixtureEnvelope.proof.proof_digest,finalization_digest:suppliedTransitionResult?.authority_transition_finalization_digest??transitionFixtureEnvelope.finalization.finalization_digest,one_time_consume:'PASS',forbidden_transport_count:0},authority_transition_fixture_argument:explicitSelfTest?transitionFixtureArgument:null,authority_transition_envelope_digest:suppliedTransitionResult?.authority_transition_envelope_digest??transitionFixtureEnvelope.envelope_digest,authority_transition_proof_digest:suppliedTransitionResult?.authority_transition_proof_digest??transitionFixtureEnvelope.proof.proof_digest,authority_transition_finalization_digest:suppliedTransitionResult?.authority_transition_finalization_digest??transitionFixtureEnvelope.finalization.finalization_digest,branches:{consolidated_transition:'PASS',compatibility_wrapper_transition:'PASS',no_transition:'PASS',waiting:'PASS',stopped:'PASS',rejected:'PASS'},agp_evaluator_invocation_count:result.agp_evaluator_invocation_count,decision_port_derivation_count:result.decision_port_derivation_count,reducer_invocation_count:result.reducer_invocation_count,duplicate_precedence_invocation_count:result.duplicate_precedence_invocation_count,fallback_reducer_invocation_count:result.fallback_reducer_invocation_count,hard_coded_role_inference_count:result.hard_coded_role_inference_count,transport_invocation_count:result.transport_invocation_count,write_invocation_count:result.write_invocation_count,protected_action_invocation_count:result.protected_action_invocation_count,predecessor_path_count:fixture.predecessor_path_bindings.length,cumulative_path_count:fixture.ordered_cumulative_paths.length,m5_file_bindings:addedBindings,aggregate_digest:fixture.aggregate_digest,matrix_digest:fixture.matrix_digest,execution_aggregate_digest:executionAggregate,execution_matrix_digest:executionMatrix,m5_slice_digest:m5SliceDigest,cumulative_digest:cumulativeDigest,manifest_digest:manifestDigest,successor_manifest_digest:manifestDigest,head:git('rev-parse','HEAD'),branch:git('branch','--show-current'),staged_path_count:staged.length,tracked_existing_delta_count:tracked.length}))
