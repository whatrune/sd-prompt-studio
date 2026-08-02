import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'vite'

const fixture = JSON.parse(await readFile('scripts/fixtures/continuous-orchestration-authority-routing-budget-cutover-v1.json','utf8'))

const clone = structuredClone
const sha = value => createHash('sha256').update(value).digest('hex')
const jcs = value => {
  if(value===null||typeof value==='boolean'||typeof value==='string')return JSON.stringify(value)
  if(typeof value==='number'){if(!Number.isFinite(value))throw new TypeError('non-finite');return JSON.stringify(value)}
  if(Array.isArray(value))return `[${value.map(jcs).join(',')}]`
  if(value&&typeof value==='object')return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${jcs(value[key])}`).join(',')}}`
  throw new TypeError('outside JSON model')
}
const digest = value => sha(jcs(value))
const D = label => sha(label)
const without = (value,...keys) => Object.fromEntries(Object.entries(value).filter(([key])=>!keys.includes(key)))
const deepFrozen = value => !value||typeof value!=='object'||(Object.isFrozen(value)&&Object.values(value).every(deepFrozen))
const ordered = values => [...values].sort((a,b)=>Buffer.from(a).compare(Buffer.from(b)))
const url = suffix => `https://github.com/whatrune/sd-prompt-studio/issues/221#issuecomment-${suffix}`
const HEAD = fixture.authority_head_sha
const TASK = fixture.task_id
const REPO = fixture.repository
const SCOPE = D('issue221-m3-scope')
const accepted = result => result.kind==='accepted'
const rejected = result => result.kind==='rejected'
const resealObject = (value,key) => ({...without(value,key),[key]:digest(without(value,key))})
const noEcho = value => !/(?:Users[\\/]|(?:^|["\s])[A-Za-z]:[\\/]|credential|private_secret|environment_variable)/i.test(JSON.stringify(value))
const runJson = (args,env=process.env) => JSON.parse(execFileSync(process.execPath,args,{cwd:process.cwd(),encoding:'utf8',stdio:['ignore','pipe','pipe'],env}))
const focusedPrHeadGuard = process.env.M3_PR_HEAD_GUARD_FOCUSED === '1'
const withUntrackedExclusions = async (paths,run) => {
  const directory=await mkdtemp(join(tmpdir(),'m3-predecessor-'))
  const excludes=join(directory,'exclude')
  await writeFile(excludes,`${paths.join('\n')}\n`,'utf8')
  const priorCount=Number(process.env.GIT_CONFIG_COUNT??0)
  try{return run({...process.env,GIT_CONFIG_COUNT:String(priorCount+1),[`GIT_CONFIG_KEY_${priorCount}`]:'core.excludesFile',[`GIT_CONFIG_VALUE_${priorCount}`]:excludes.replaceAll('\\','/')})}
  finally{await rm(directory,{recursive:true,force:true})}
}
const m1M2M3Paths=fixture.ordered_cumulative_paths.slice(2)
const m2M3Paths=fixture.ordered_cumulative_paths.slice(5)
const m3OnlyPaths=fixture.ordered_cumulative_paths.slice(8)
const m0=focusedPrHeadGuard?null:await withUntrackedExclusions(m1M2M3Paths,env=>runJson(['scripts/test-continuous-orchestration-core-consolidation-m0.mjs'],env))
const m1Result=focusedPrHeadGuard?null:await withUntrackedExclusions(m2M3Paths,env=>runJson(['scripts/test-continuous-orchestration-shared-proof-interfaces.mjs'],env))
const m2=focusedPrHeadGuard?null:await withUntrackedExclusions(m3OnlyPaths,env=>runJson(['scripts/test-continuous-orchestration-shadow-equivalence.mjs'],env))
const agp=focusedPrHeadGuard?null:runJson(['scripts/test-automatic-gate-progression-evaluator.mjs'])
const cov=focusedPrHeadGuard?null:runJson(['--experimental-strip-types','scripts/test-continuous-orchestration.mjs'])
const gsp=focusedPrHeadGuard?null:runJson(['scripts/test-gate-status-publisher.mjs'])
const arl=focusedPrHeadGuard?null:runJson(['scripts/test-architecture-repair-loop.mjs'])
const server = await createServer({configFile:false,cacheDir:join(tmpdir(),'sd-prompt-studio-issue221-m3-vite'),optimizeDeps:{noDiscovery:true},server:{middlewareMode:true},appType:'custom',logLevel:'error'})
const api = await server.ssrLoadModule('/src/continuous-orchestration/authority-routing-budget-cutover-v1.ts')
const core = await server.ssrLoadModule('/src/continuous-orchestration/index.ts')
const m1 = await server.ssrLoadModule('/src/continuous-orchestration/shared-proof-interfaces-v1.ts')
const git = (...args) => execFileSync('git',args,{cwd:process.cwd(),encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()
let assertionCount=0
const check = (condition,message) => {assertionCount+=1;assert.ok(condition,message)}

check(fixture.row_count===130,'fixture exact 130 rows')
check(fixture.group_count===9,'fixture exact nine groups')
check(fixture.fixture_digest===digest(without(fixture,'fixture_digest')),'fixture self digest')
for(const group of fixture.groups){
  check(group.row_count===group.rows.length,`${group.group_id} count`)
  for(const row of group.rows)check(row.row_digest===digest({row_id:row.row_id,assertion:row.assertion,expected:row.expected}),`${row.row_id} digest`)
  check(group.group_digest===digest({group_id:group.group_id,row_count:group.row_count,row_digests:group.rows.map(row=>row.row_digest)}),`${group.group_id} digest`)
}
check(fixture.aggregate_digest===digest(fixture.groups.map(group=>({group_id:group.group_id,row_count:group.row_count,group_digest:group.group_digest}))),'aggregate digest')
check(fixture.matrix_digest===digest({fixture_version:fixture.fixture_version,ordered_rows:fixture.groups.flatMap(group=>group.rows.map(row=>({row_id:row.row_id,row_digest:row.row_digest}))),aggregate_digest:fixture.aggregate_digest}),'matrix digest')

const transitionRoute = (transition_class,role_id=`role-${transition_class}`,action_id=`action-${transition_class}`) => ({
  transition_class,role_id,action_id,authority_record_url:url('5147777774'),allowed_scope_digest:SCOPE,
  independent_from_role_id_or_null:['architecture_review','implementation_review','publication_review','completion_assessment'].includes(transition_class)?`author-${transition_class}`:null,
})
const routes = core.transitionClasses.map(transition=>transitionRoute(transition)).sort((a,b)=>Buffer.from(`${a.transition_class}\0${a.role_id}\0${a.action_id}`).compare(Buffer.from(`${b.transition_class}\0${b.role_id}\0${b.action_id}`)))
const selectors = {
  task_opted_in:['assignment_field','requested_by_role_id'],result_handoff_published:['active_route_binding','active_transition_role_id'],review_decision_published:['active_route_binding','active_transition_role_id'],architecture_amendment_published:['fixed_route_transition_class','architecture_repair'],resume_dispatch_published:['assignment_field','assignment_owner_role_id'],metadata_sync_completed:['fixed_route_transition_class','metadata_sync'],validation_completed:['active_route_binding','active_transition_role_id'],completion_assessment_published:['fixed_route_transition_class','completion_assessment'],product_owner_approval_published:['assignment_field','requested_by_role_id'],protected_action_completed:['protected_action_profile','matching_action_executor_role_id'],authority_snapshot_changed:['collector_profile','collector_role_id'],external_recovery_observed:['preceding_decision_recovery_role','recovery_role_id'],
}
const withProfileDigest = value => ({...value,profile_digest:digest(value)})
const sourceBindings = core.sourceTypes.map(source_type=>({source_type,collector_adapter_id:`adapter-${source_type}`,canonical_authority_required:['task_assignment','result_handoff','review_decision','product_owner_approval','context_health_resume'].includes(source_type),required_field_ids:source_type==='identity'?ordered(['assignment_revision','contract_version','repository','task_id']):['canonical_record_url'],optional_field_ids:[],authority_owner_contract_url:url('5142525621')}))
const profiles = {
  authority_projection_profile:withProfileDigest({profile_version:'authority_projection_profile_v1',profile_id:'issue221-m3-authority',source_type_bindings:sourceBindings,assignment_owner_role_id:'integrated_lead',requested_by_role_id:'product_owner',collector_role_id:'authority_collector'}),
  route_binding_table:withProfileDigest({profile_version:'route_binding_table_v1',profile_id:'issue221-m3-routes',bindings:routes,event_authority_bindings:core.eventTypes.map(event_type=>({event_type,authority_source:selectors[event_type][0],authority_selector:{kind:selectors[event_type][0],value:selectors[event_type][1]},head_binding:['task_opted_in','architecture_amendment_published','resume_dispatch_published','external_recovery_observed'].includes(event_type)?'nullable':'required'}))}),
  gate_profile:withProfileDigest({profile_version:'gate_profile_v1',profile_id:'issue221-m3-gates',gate_rows:[{gate_id:'architecture',ordinal:1,required_evidence_types:['review_decision'],gsp_field_id:'architecture_review'},{gate_id:'implementation',ordinal:2,required_evidence_types:['result_handoff'],gsp_field_id:'implementation_review'}]}),
  protected_action_profile:withProfileDigest({profile_version:'protected_action_profile_v1',profile_id:'issue221-m3-protected',mode:'wait_only',action_rows:[{action_id:'normal_merge_commit',approval_required:true,exact_head_required:true,exact_base_required:true,one_use:true,executor_role_id:'merge_executor',authority_record_url:url('5147777774')}]})
}
check(core.validateGenericProgressRunnerProfilesV1(profiles).kind==='accepted','profiles valid')

const sourceRef={kind:'canonical_record',url:url('5147777774')}
const freshBase={snapshot_version:m1.FRESH_AUTHORITY_SNAPSHOT_V1_VERSION,purpose:'evaluation',task_id:TASK,repository:REPO,assignment_revision:1,collected_from:[sourceRef],main_sha_or_null:HEAD,pr_url_or_null:null,pr_head_sha_or_null:null,pr_base_sha_or_null:null,pr_state:'not_applicable',check_set_digest_or_null:null,finding_set_digest:D('findings'),thread_set_digest:D('threads'),workspace_binding_digest_or_null:D('workspace'),workspace_state:'clean_bound',gsp_generation_or_null:null,gsp_body_digest_or_null:null,approval_consumption_digest_or_null:null,observed_at:'2026-08-01T02:00:00Z'}
const fresh=m1.deriveFreshAuthoritySnapshotShadowV1(freshBase).value
const authoritySource={source_type:'task_assignment',source_ref:sourceRef,owner_contract_url:url('5142525621'),authority_class:'normative_semantic',authority_scope_digest:SCOPE,content_projection_digest:D('assignment-content'),task_id:TASK,repository:REPO,subject_head_sha_or_null:HEAD,observed_at:'2026-08-01T01:59:59Z',admitted_field_ids:['assignment_revision','canonical_record_url'],admission_result:'accepted'}
const bundleBase={bundle_version:m1.ADMITTED_AUTHORITY_BUNDLE_V1_VERSION,task_id:TASK,repository:REPO,assignment_revision:1,scope_digest:SCOPE,sources:[authoritySource],fresh_snapshot:fresh,admission_result:'accepted'}
const bundle=m1.deriveAdmittedAuthorityBundleShadowV1(bundleBase).value
const stateSnapshotBase={snapshot_version:'authority_snapshot_ref_v1',collected_from:[sourceRef],repository:REPO,main_sha_or_null:HEAD,pr_url_or_null:null,pr_head_sha_or_null:null,pr_base_sha_or_null:null,pr_state:'not_applicable',check_set_digest_or_null:null,finding_set_digest:D('findings'),thread_set_digest:D('threads'),workspace_state:'clean_bound',gsp_generation_or_null:null,gsp_body_digest_or_null:null,approval_consumption_digest_or_null:null,observed_at:fresh.observed_at}
const stateSnapshot={...stateSnapshotBase,snapshot_digest:digest(without(stateSnapshotBase,'observed_at'))}
const assignmentUrl=url('5147777774'),semanticRequirement=D('m3-requirement')
const epoch=digest({task_id:TASK,root_assignment_url:assignmentUrl,semantic_requirement_digest:semanticRequirement,allowed_scope_digest:SCOPE})
const activeRoute=routes.find(route=>route.transition_class==='implementation')
const state={state_version:'continuous_orchestration_state_v1',state_revision:0,task_id:TASK,canonical_task_url:'https://github.com/whatrune/sd-prompt-studio/issues/221',repository:REPO,assignment_revision:1,semantic_counter_epoch:{epoch_id:epoch,root_assignment_url:assignmentUrl,current_assignment_url:assignmentUrl,current_assignment_revision:1,predecessor_epoch_id_or_null:null,disposition:'initial',semantic_requirement_digest:semanticRequirement,allowed_scope_digest:SCOPE,authority_record_url:url('5142525621')},opt_in_contract_version:'continuous-orchestration-v1.0.0',allowed_transition_classes:ordered([...core.transitionClasses]),phase:'evaluating',active_gate:'implementation',active_role_binding:activeRoute,active_action_id:activeRoute.action_id,authority_snapshot:stateSnapshot,canonical_refs:{assignment_url:assignmentUrl,result_handoff_url_or_null:null,review_decision_url_or_null:null,architecture_amendment_url_or_null:null,resume_dispatch_url_or_null:null,metadata_result_url_or_null:null,validation_result_url_or_null:null,completion_assessment_url_or_null:null,product_owner_approval_url_or_null:null,protected_action_completion_url_or_null:null},finding_ledger:[],loop_counters:{finding_counters:[],metadata_counters:[],delivery_counters:[],cycle_ledger:{cycle_ledger_version:'cycle_ledger_v1',semantic_counter_epoch_id:epoch,progress_epoch:0,max_gate_ordinal_reached:1,decision_count_without_progress:0,checkpoint_emitted_without_progress:false,signature_occurrences:[],last_progress_record_url:assignmentUrl}},approval_state:{state:'none',reason:'missing',approval_record_url_or_null:null},projection_state:{projection_version:'projection_state_v1',state:'not_required',pr_url_or_null:null,projected_head_sha_or_null:null,gsp_generation_or_null:null,pr_body_digest_or_null:null,gsp_gate_rows_digest_or_null:null,citation_record_urls:[],mismatch_field_ids:[]},event_cursor:{cursor_version:'event_cursor_v1',last_event_id_or_null:null,last_semantic_event_digest_or_null:null,last_event_record_url_or_null:null,last_decision_url_or_null:null,admitted_new_event_count:0},replay_ledger:{ledger_version:'replay_ledger_v1',entries:[],ledger_digest:digest({ledger_version:'replay_ledger_v1',entries:[]})},audit_chain:{audit_version:'audit_chain_ref_v1',head_decision_url_or_null:null,head_decision_id_or_null:null,decision_count_total:0,chain_digest:D('audit')},pending_transport:null,last_decision_url:null}
check(core.validateContinuousOrchestrationStateV1(state,profiles).kind==='accepted','state valid')
const eventBase={event_version:'continuous_orchestration_event_v1',event_type:'task_opted_in',task_id:TASK,assignment_revision:1,canonical_record_url:url('5147777774'),authoring_role:'product_owner',authority_snapshot_digest:state.authority_snapshot.snapshot_digest,subject_head_sha_or_null:null,predecessor_event_id_or_null:null}
const eventSemantic=digest(eventBase)
const event={...eventBase,event_id:eventSemantic,observed_at:'2026-08-01T02:00:01Z',semantic_event_digest:eventSemantic}
const noTransition={kind:'no_transition',future_event_type:'result_handoff_published',future_event_role_id:'backend_implementer'}
const repairProfile=m1.deriveRepairBudgetProfileShadowV1({repair_budget_profile_version:m1.REPAIR_BUDGET_PROFILE_V1_VERSION,task_id:TASK,repository:REPO,assignment_revision:1,semantic_epoch_id:epoch,authority_record_url:url('5142525621'),allowed_scope_digest:SCOPE,attempt_limits:{technical:3,architecture:3,metadata:3,delivery:3},cycle_limits:{checkpoint_after_decisions:32,stop_after_decisions:64}}).value
const cycleLedger={cycle_ledger_version:'cycle_ledger_v1',semantic_counter_epoch_id:epoch,progress_epoch:0,max_gate_ordinal_reached:1,decision_count_without_progress:0,checkpoint_emitted_without_progress:false,signature_occurrences:[],last_progress_record_url:assignmentUrl}
const emptyLedger=m1.deriveRepairAttemptLedgerShadowV1({repair_attempt_ledger_version:m1.REPAIR_ATTEMPT_LEDGER_V1_VERSION,task_id:TASK,repository:REPO,assignment_revision:1,semantic_epoch_id:epoch,profile_digest:repairProfile.profile_digest,entries:[],cycle_ledger:cycleLedger}).value
const noRoute=api.sealM3RouteSelectionV1({kind:'no_route',authority_record_url:url('5147777774'),reason:'no_declared_transition'})
const makeProfile=(mode,stateValue,ledgerValue,scope=SCOPE)=>api.sealAuthorityRoutingBudgetCutoverProfileV1({profile_version:api.AUTHORITY_ROUTING_BUDGET_CUTOVER_PROFILE_V1_VERSION,feature_id:'authority_routing_budget',mode,task_id:TASK,repository:REPO,assignment_revision:1,allowed_scope_digest:scope,profile_authority_record_url:url('5147777774'),expected_m2_manifest_digest:api.M3_EXPECTED_M2_MANIFEST_DIGEST,expected_prior_state_digest:digest(stateValue),expected_prior_ledger_digest:ledgerValue.ledger_digest})
const makeInput=(overrides={})=>{
  const stateValue=overrides.state??state,ledgerValue=overrides.repair_attempt_ledger??emptyLedger,mode=overrides.mode??'m3_cutover_v1'
  const authorityBundle=overrides.authority_bundle??bundle,routeSelectionValue=overrides.route_selection??noRoute
  const routeAction=routeSelectionValue.kind==='route'?routeSelectionValue.binding.action_id:activeRoute.action_id
  const combined=overrides.combined_task_assignment_authority??api.sealM3CombinedTaskAssignmentAuthorityProjectionV1({schema_version:api.M3_COMBINED_TASK_ASSIGNMENT_AUTHORITY_PROJECTION_V1_VERSION,task_id:TASK,repository_full_name:REPO,assignment_revision:1,canonical_assignment_url:sourceRef.url,source_record_digest:authorityBundle.sources.find(source=>source.source_type==='task_assignment').content_projection_digest,source_occurrence_count:1,assigned_role:'Backend Implementer',recommended_next_action:mode==='m3_cutover_v1'?'run_m3_authority_routing_budget_cutover_v1':'run_m3_legacy_adapter_v1',selected_route_bundle_id:profiles.route_binding_table.profile_id,selected_route_action_id:routeAction,branch_name:routeSelectionValue.kind==='route'?routeSelectionValue.branch:fixture.branch,worktree_binding_digest:digest({worktree_identity:routeSelectionValue.kind==='route'?routeSelectionValue.worktree_identity:fixture.logical_worktree_identity}),pr_number:routeSelectionValue.kind==='route'&&routeSelectionValue.pr_url_or_null?Number(routeSelectionValue.pr_url_or_null.split('/').at(-1)):null,pr_url:routeSelectionValue.kind==='route'?routeSelectionValue.pr_url_or_null:null,pr_head_sha:routeSelectionValue.kind==='route'?(routeSelectionValue.head_sha_or_null??HEAD):HEAD,predecessor_digest:digest({predecessor_canonical_url:routeSelectionValue.kind==='route'?routeSelectionValue.predecessor_canonical_url:url('5147777774')}),scope_digest:overrides.scope??SCOPE,fresh_snapshot_digest:authorityBundle.fresh_snapshot.snapshot_digest,active_profile_id:'authority_routing_budget',active_profile_authority_url:url('5147777774'),active_profile_mode:mode})
  const base={input_version:api.AUTHORITY_ROUTING_BUDGET_CUTOVER_INPUT_V1_VERSION,state:stateValue,event:overrides.event??event,profiles:overrides.profiles??profiles,evaluation:overrides.evaluation??noTransition,decision_url:overrides.decision_url??url('5147800001'),evaluated_at:overrides.evaluated_at??'2026-08-01T02:00:02Z',recovery_role_id_or_null:overrides.recovery_role_id_or_null??null,authority_bundle:authorityBundle,combined_task_assignment_authority:combined,cutover_profile:overrides.cutover_profile??makeProfile(mode,stateValue,ledgerValue,overrides.scope??SCOPE),route_selection:routeSelectionValue,repair_budget_profile:overrides.repair_budget_profile??repairProfile,repair_attempt_ledger:ledgerValue,repair_attempt_evidence_or_null:overrides.repair_attempt_evidence_or_null??null,action_guard_proof_or_null:overrides.action_guard_proof_or_null??null,expected_prior_state_digest:digest(stateValue),expected_prior_ledger_digest:ledgerValue.ledger_digest}
  return api.sealAuthorityRoutingBudgetCutoverInputV1(base)
}
const baseInput=makeInput()
const baseResult=api.runAuthorityRoutingBudgetCutoverV1(baseInput)
check(baseResult.kind==='cutover_accepted','base cutover accepted')
check(accepted(api.validateAuthorityRoutingBudgetCutoverInputV1(baseInput)),'base input admitted')
check(accepted(api.validateAuthorityRoutingBudgetCutoverResultV1(baseResult)),'base result admitted')

const implementationRoute=routes.find(route=>route.transition_class==='implementation')
const routeSelection=api.sealM3RouteSelectionV1({kind:'route',binding:implementationRoute,predecessor_canonical_url:url('5147777774'),branch:fixture.branch,worktree_identity:fixture.logical_worktree_identity,pr_url_or_null:null,head_sha_or_null:HEAD})
const routeEvaluation={kind:'recommend_next_role',target_role_id:implementationRoute.role_id,next_action_id:implementationRoute.action_id,predecessor_canonical_url:url('5147777774'),target_head_sha_or_null:HEAD}
const actionFresh=m1.deriveFreshAuthoritySnapshotShadowV1({...freshBase,purpose:'action_guard',observed_at:'2026-08-01T02:00:03Z'}).value
const guard=m1.deriveActionGuardProofShadowV1({action_guard_proof_version:m1.ACTION_GUARD_PROOF_V1_VERSION,task_id:TASK,repository:REPO,assignment_revision:1,action_id:implementationRoute.action_id,guard_scope:'non_protected_transport',evaluation_snapshot_digest:fresh.snapshot_digest,action_snapshot:actionFresh,approval_record_url_or_null:null,one_use:true,consumption_state:'unconsumed',guarded_at:actionFresh.observed_at,execution_authority:false},fresh).value
const routeInput=makeInput({evaluation:routeEvaluation,route_selection:routeSelection,action_guard_proof_or_null:guard})
const routeResult=api.runAuthorityRoutingBudgetCutoverV1(routeInput)
check(routeResult.kind==='cutover_accepted'&&routeResult.dispatch_intent_or_null!==null,'route cutover accepted')
const prepared=routeResult.prepared_route_authority_binding_or_null
check(prepared!==null&&accepted(api.validateM3PreparedRouteAuthorityBindingV1(prepared)),'route prepared binding admitted')
const casWinner=api.sealM3CasOutcomeProofV1({schema_version:api.M3_CAS_OUTCOME_PROOF_V1_VERSION,prepared_route_authority_binding_digest:prepared.prepared_route_authority_binding_digest,combined_task_assignment_authority_digest:prepared.combined_task_assignment_authority_digest,route_identity_digest:prepared.route_identity_digest,profile_mode_binding_digest:prepared.profile_mode_binding_digest,action_id:prepared.action_id,cas_operand_digest:prepared.cas_operand_digest,expected_state_digest:prepared.expected_state_digest,observed_state_digest:prepared.expected_state_digest,successor_state_digest:prepared.successor_state_digest,outcome:'winner',compare_matched:true,write_applied:true,loser_reason:null,receipt_id:'cas-winner-1',receipt_issuer_authority_url:url('5148251385'),receipt_issuer_authority_digest:D('cas-receipt-issuer'),receipt_digest:D('cas-winner-receipt')})
const casLoser=api.sealM3CasOutcomeProofV1({...without(casWinner,'cas_outcome_proof_digest'),observed_state_digest:D('cas-observed-loser'),outcome:'loser',compare_matched:false,write_applied:false,loser_reason:'compare_mismatch',receipt_id:'cas-loser-1',receipt_digest:D('cas-loser-receipt')})
const routeGuard=api.sealM3RouteBoundActionGuardV1({schema_version:api.M3_ROUTE_BOUND_ACTION_GUARD_V1_VERSION,predecessor_guard_proof:guard,predecessor_guard_proof_digest:guard.proof_digest,prepared_route_authority_binding_digest:prepared.prepared_route_authority_binding_digest,combined_task_assignment_authority_digest:prepared.combined_task_assignment_authority_digest,route_identity_digest:prepared.route_identity_digest,route_selection_digest:prepared.route_selection_digest,branch_name:prepared.branch_name,worktree_binding_digest:prepared.worktree_binding_digest,pr_number:prepared.pr_number,pr_url:prepared.pr_url,pr_head_sha:prepared.pr_head_sha,fresh_snapshot_digest:prepared.fresh_snapshot_digest,action_id:prepared.action_id})
const deliveryKey=digest({task_id:prepared.task_id,repository_full_name:prepared.repository_full_name,assignment_revision:prepared.assignment_revision,action_id:prepared.action_id,prepared_route_authority_binding_digest:prepared.prepared_route_authority_binding_digest,cas_outcome_proof_digest:casWinner.cas_outcome_proof_digest,route_identity_digest:prepared.route_identity_digest,profile_mode_binding_digest:prepared.profile_mode_binding_digest,pr_head_sha:prepared.pr_head_sha})
const makeReceipt=(consumption_outcome,owner_state,count,newEligibility,retry)=>api.sealM3TransportConsumptionReceiptV1({schema_version:api.M3_TRANSPORT_CONSUMPTION_RECEIPT_V1_VERSION,transport_idempotency_key:deliveryKey,prepared_route_authority_binding_digest:prepared.prepared_route_authority_binding_digest,cas_outcome_proof_digest:casWinner.cas_outcome_proof_digest,action_id:prepared.action_id,owner_authority_url:url('5148251385'),owner_authority_digest:D('transport-owner'),consumption_outcome,owner_state,transport_execution_count_for_key:count,new_delivery_eligibility_authorized:newEligibility,retry_disposition:retry,receipt_id:`transport-${consumption_outcome}`})
const acquiredReceipt=makeReceipt('acquired','reserved_not_executed',0,true,null)
const inProgressReceipt=makeReceipt('owner_in_progress','reserved_not_executed',0,false,'replay_wait')
const consumedReceipt=makeReceipt('already_consumed','executed',1,false,null)
const finalInput=(cas,receipt,guardValue=routeGuard,authorityValue=routeInput.combined_task_assignment_authority)=>api.sealM3DeliveryFinalizationInputV1({input_version:api.M3_DELIVERY_FINALIZATION_INPUT_V1_VERSION,prepared_route_authority_binding:prepared,cas_outcome_proof:cas,route_bound_action_guard:guardValue,combined_task_assignment_authority:authorityValue,transport_consumption_receipt_or_null:receipt})
const winnerFinal=api.finalizeAuthorityRoutingBudgetDeliveryV1(finalInput(casWinner,acquiredReceipt))
const inProgressFinal=api.finalizeAuthorityRoutingBudgetDeliveryV1(finalInput(casWinner,inProgressReceipt))
const consumedFinal=api.finalizeAuthorityRoutingBudgetDeliveryV1(finalInput(casWinner,consumedReceipt))
const loserFinal=api.finalizeAuthorityRoutingBudgetDeliveryV1(finalInput(casLoser,null))
check(winnerFinal.branch==='eligible_token'&&loserFinal.branch==='cas_loser_rejected','winner and loser finalization branches')
for(const result of [winnerFinal,inProgressFinal,consumedFinal,loserFinal])check(accepted(api.validateM3DeliveryFinalizationResultV1(result)),`finalization result admitted: ${result.branch}`)
check(api.finalizeAuthorityRoutingBudgetDeliveryV1(finalInput(casWinner,null)).branch==='invalid_finalization_authority','winner requires owner receipt')
check(api.finalizeAuthorityRoutingBudgetDeliveryV1(finalInput(casLoser,acquiredReceipt)).branch==='invalid_finalization_authority','loser forbids owner receipt')
const invalidLifecycleReceipt=api.sealM3TransportConsumptionReceiptV1({...without(acquiredReceipt,'first_receipt_digest','receipt_digest'),consumption_outcome:'already_consumed',owner_state:'reserved_not_executed',transport_execution_count_for_key:0,new_delivery_eligibility_authorized:true})
check(api.finalizeAuthorityRoutingBudgetDeliveryV1(finalInput(casWinner,invalidLifecycleReceipt)).branch==='invalid_finalization_authority','invalid owner lifecycle rejected')
const driftGuard=api.sealM3RouteBoundActionGuardV1({...without(routeGuard,'guard_binding_digest'),branch_name:'drifted-branch'})
check(api.finalizeAuthorityRoutingBudgetDeliveryV1(finalInput(casWinner,acquiredReceipt,driftGuard)).branch==='invalid_finalization_authority','route guard drift rejected')
const driftAuthority=api.sealM3CombinedTaskAssignmentAuthorityProjectionV1({...without(routeInput.combined_task_assignment_authority,'combined_task_assignment_authority_digest'),active_profile_mode:'legacy_adapter_v1',recommended_next_action:'run_m3_legacy_adapter_v1'})
check(api.finalizeAuthorityRoutingBudgetDeliveryV1(finalInput(casWinner,acquiredReceipt,routeGuard,driftAuthority)).branch==='invalid_finalization_authority','profile mode authority drift rejected')

const reconstructFinalBindingProjection=(delivery_result_branch,cas,receipt)=>{
  const common={schema_version:'m3_final_route_delivery_binding_v1',prepared_route_authority_binding_digest:prepared.prepared_route_authority_binding_digest,cas_outcome_proof_digest:cas.cas_outcome_proof_digest,predecessor_guard_proof_digest:routeGuard.predecessor_guard_proof_digest,combined_task_assignment_authority_digest:routeInput.combined_task_assignment_authority.combined_task_assignment_authority_digest,route_identity_digest:prepared.route_identity_digest,profile_mode_binding_digest:prepared.profile_mode_binding_digest,delivery_result_branch}
  return receipt===null?{...common,receipt_binding_kind:'no_receipt_cas_loser',transport_idempotency_key:null,consumption_receipt_digest:null,transport_port_invocation_count:0,no_receipt_reason:'cas_outcome_loser'}:{...common,receipt_binding_kind:'transport_consumption_receipt',transport_idempotency_key:receipt.transport_idempotency_key,consumption_receipt_digest:receipt.receipt_digest,transport_port_invocation_count:1}
}
const finalBindingCases=[
  {branch:'eligible_token',cas:casWinner,receipt:acquiredReceipt,result:winnerFinal},
  {branch:'owner_in_progress_rejected',cas:casWinner,receipt:inProgressReceipt,result:inProgressFinal},
  {branch:'already_consumed_rejected',cas:casWinner,receipt:consumedReceipt,result:consumedFinal},
  {branch:'cas_loser_rejected',cas:casLoser,receipt:null,result:loserFinal},
]
for(const scenario of finalBindingCases){
  const projection=reconstructFinalBindingProjection(scenario.branch,scenario.cas,scenario.receipt)
  const expectedFields=ordered([...fixture.final_binding_common_fields,...(scenario.receipt===null?fixture.final_binding_loser_fields:fixture.final_binding_winner_fields)])
  check(jcs(ordered(Object.keys(projection)))===jcs(expectedFields),`${scenario.branch} exact Revision 3 final projection fields`)
  check(digest(projection)===scenario.result.final_route_delivery_binding_digest,`${scenario.branch} canonical final projection reconstruction`)
  check(digest({...without(projection,'delivery_result_branch'),branch:scenario.branch})!==scenario.result.final_route_delivery_binding_digest,`${scenario.branch} alternate branch field name rejected`)
  check(digest({...without(projection,'predecessor_guard_proof_digest'),guard_binding_digest:routeGuard.guard_binding_digest})!==scenario.result.final_route_delivery_binding_digest,`${scenario.branch} alternate guard field name rejected`)
  check(digest({...projection,transport_port_invocation_count:projection.transport_port_invocation_count===0?1:0})!==scenario.result.final_route_delivery_binding_digest,`${scenario.branch} transport port value mutation rejected`)
}

const mutatedInput=(mutator,source=baseInput)=>{const copy=clone(source);mutator(copy);delete copy.input_digest;return api.sealAuthorityRoutingBudgetCutoverInputV1(copy)}
const invalid = (mutator,source=baseInput) => api.runAuthorityRoutingBudgetCutoverV1(mutatedInput(mutator,source)).kind==='rejected'

// B-222-READY-REV-01: a PR-scoped route is bound to the observed PR HEAD, not
// to a concurrently different main HEAD. The no-PR route retains its existing
// main-HEAD binding, and mixed URL/HEAD authorities fail closed.
const PR_URL='https://github.com/whatrune/sd-prompt-studio/pull/222'
const PR_HEAD='b'.repeat(40)
const MISMATCHED_PR_HEAD='c'.repeat(40)
const prFresh=m1.deriveFreshAuthoritySnapshotShadowV1({...freshBase,pr_url_or_null:PR_URL,pr_head_sha_or_null:PR_HEAD,pr_base_sha_or_null:HEAD,pr_state:'open_draft'}).value
const prBundle=m1.deriveAdmittedAuthorityBundleShadowV1({...bundleBase,sources:[{...authoritySource,subject_head_sha_or_null:PR_HEAD}],fresh_snapshot:prFresh}).value
const prStateSnapshotBase={...stateSnapshotBase,main_sha_or_null:HEAD,pr_url_or_null:PR_URL,pr_head_sha_or_null:PR_HEAD,pr_base_sha_or_null:HEAD,pr_state:'open_draft'}
const prStateSnapshot={...prStateSnapshotBase,snapshot_digest:digest(without(prStateSnapshotBase,'observed_at'))}
const prState={...clone(state),authority_snapshot:prStateSnapshot}
const prEventBase={...without(event,'event_id','observed_at','semantic_event_digest'),authority_snapshot_digest:prStateSnapshot.snapshot_digest,subject_head_sha_or_null:PR_HEAD}
const prEventSemantic=digest(prEventBase)
const prEvent={...prEventBase,event_id:prEventSemantic,observed_at:event.observed_at,semantic_event_digest:prEventSemantic}
const prRouteSelection=api.sealM3RouteSelectionV1({...without(routeSelection,'selection_digest'),pr_url_or_null:PR_URL,head_sha_or_null:PR_HEAD})
const prRouteEvaluation={...routeEvaluation,target_head_sha_or_null:PR_HEAD}
const prActionFresh=m1.deriveFreshAuthoritySnapshotShadowV1({...without(prFresh,'snapshot_digest'),purpose:'action_guard',observed_at:'2026-08-01T02:00:03Z'}).value
const prGuard=m1.deriveActionGuardProofShadowV1({...without(guard,'proof_digest'),evaluation_snapshot_digest:prFresh.snapshot_digest,action_snapshot:prActionFresh},prFresh).value
const prRouteInput=makeInput({state:prState,event:prEvent,authority_bundle:prBundle,evaluation:prRouteEvaluation,route_selection:prRouteSelection,action_guard_proof_or_null:prGuard})
const prRouteResult=api.runAuthorityRoutingBudgetCutoverV1(prRouteInput)
check(routeResult.kind==='cutover_accepted'&&routeSelection.pr_url_or_null===null&&routeInput.combined_task_assignment_authority.pr_head_sha===HEAD,'no-PR route preserves main HEAD binding')
check(PR_HEAD!==HEAD&&prRouteResult.kind==='cutover_accepted'&&prRouteResult.prepared_route_authority_binding_or_null?.pr_head_sha===PR_HEAD,'PR route admits diverged main and PR HEAD')
check(invalid(x=>{
  x.route_selection=api.sealM3RouteSelectionV1({...without(x.route_selection,'selection_digest'),head_sha_or_null:MISMATCHED_PR_HEAD})
  x.evaluation={...x.evaluation,target_head_sha_or_null:MISMATCHED_PR_HEAD}
  x.combined_task_assignment_authority=api.sealM3CombinedTaskAssignmentAuthorityProjectionV1({...without(x.combined_task_assignment_authority,'combined_task_assignment_authority_digest'),pr_head_sha:MISMATCHED_PR_HEAD})
},prRouteInput),'PR route rejects observed PR HEAD mismatch')
check(invalid(x=>{
  const mismatchedUrl='https://github.com/whatrune/sd-prompt-studio/pull/223'
  x.route_selection=api.sealM3RouteSelectionV1({...without(x.route_selection,'selection_digest'),pr_url_or_null:mismatchedUrl})
  x.combined_task_assignment_authority=api.sealM3CombinedTaskAssignmentAuthorityProjectionV1({...without(x.combined_task_assignment_authority,'combined_task_assignment_authority_digest'),pr_number:223,pr_url:mismatchedUrl})
},prRouteInput),'PR route rejects observed PR URL mismatch')
if(focusedPrHeadGuard){
  await server.close()
  console.log(JSON.stringify({result:'PASS',contract:'B-222-READY-REV-01 PR HEAD action-guard binding',cases:'4/4',no_pr_main_binding:'PASS',diverged_main_pr_head:'PASS',pr_head_mismatch:'PASS',pr_url_mismatch:'PASS',m3_standalone_classification:'CONSTRAINT_NOT_PASS'}))
  process.exit(0)
}
const repairEvidence=(findingDomain,attemptClass,sourceCounter,suffix,stableFindingId=D(`${findingDomain}:${attemptClass}`))=>api.sealRepairAttemptEvidenceV1({evidence_version:api.REPAIR_ATTEMPT_EVIDENCE_V1_VERSION,evidence_record_url:url(suffix),task_id:TASK,repository:REPO,assignment_revision:1,semantic_epoch_id:epoch,stable_finding_id:stableFindingId,finding_domain:findingDomain,attempt_class:attemptClass,scope_digest:SCOPE,source_counter:sourceCounter,predecessor_record_url:url('5147777774')})
const inputWithAttempt=(ledgerValue,evidenceValue,extra={})=>makeInput({repair_attempt_ledger:ledgerValue,repair_attempt_evidence_or_null:evidenceValue,...extra})
const advanceAttempt=(ledgerValue,domain,attemptClass,count,suffix,stableId=D(`${domain}:${attemptClass}`))=>{
  const evidenceValue=repairEvidence(domain,attemptClass,count,suffix,stableId)
  const input=inputWithAttempt(ledgerValue,evidenceValue)
  const result=api.runAuthorityRoutingBudgetCutoverV1(input)
  if(!('next_repair_ledger' in result))throw new Error(`attempt rejected: ${attemptClass}:${count}:${JSON.stringify(result)}`)
  return {input,evidence:evidenceValue,result,ledger:result.next_repair_ledger}
}
const sequences={}
for(const [domain,attemptClass] of [['implementation','technical'],['architecture','architecture'],['metadata','metadata'],['publication','delivery']]){
  const stable=D(`${domain}:${attemptClass}`)
  const first=advanceAttempt(emptyLedger,domain,attemptClass,0,String(5147801000+Object.keys(sequences).length*10+1),stable)
  const second=advanceAttempt(first.ledger,domain,attemptClass,1,String(5147801000+Object.keys(sequences).length*10+2),stable)
  const third=advanceAttempt(second.ledger,domain,attemptClass,2,String(5147801000+Object.keys(sequences).length*10+3),stable)
  const fourth=advanceAttempt(third.ledger,domain,attemptClass,3,String(5147801000+Object.keys(sequences).length*10+4),stable)
  sequences[attemptClass]={first,second,third,fourth}
}

const groupChecks=Object.fromEntries(fixture.groups.map(group=>[group.group_id,[]]))
groupChecks['M3-ADM'].push(
  ()=>accepted(api.validateAuthorityRoutingBudgetCutoverInputV1(baseInput)),
  ()=>accepted(m1.validateAdmittedAuthorityBundleV1(bundle)),
  ()=>invalid(x=>{x.private_secret='private_secret'}),
  ()=>invalid(x=>{x.cutover_profile.private_secret='private_secret'}),
  ()=>invalid(x=>{delete x.evaluation}),
  ()=>invalid(x=>{x.authority_bundle.fresh_snapshot.collected_from=[{kind:'canonical_record',url:url('5147802001')}];x.authority_bundle.fresh_snapshot=resealObject(x.authority_bundle.fresh_snapshot,'snapshot_digest');x.authority_bundle=resealObject(x.authority_bundle,'bundle_digest')}),
  ()=>invalid(x=>{x.authority_bundle.sources[0].owner_contract_url=url('5147802002');x.authority_bundle=resealObject(x.authority_bundle,'bundle_digest')}),
  ()=>invalid(x=>{x.cutover_profile=api.sealAuthorityRoutingBudgetCutoverProfileV1({...without(x.cutover_profile,'profile_digest'),allowed_scope_digest:D('other-scope')})}),
  ()=>invalid(x=>{x.authority_bundle.sources[0].content_projection_digest=D('changed-content');x.authority_bundle=resealObject(x.authority_bundle,'bundle_digest')}),
  ()=>invalid(x=>{x.authority_bundle.fresh_snapshot.main_sha_or_null='a'.repeat(40);x.authority_bundle.fresh_snapshot=resealObject(x.authority_bundle.fresh_snapshot,'snapshot_digest');x.authority_bundle=resealObject(x.authority_bundle,'bundle_digest')}),
  ()=>invalid(x=>{x.authority_bundle.fresh_snapshot.observed_at='2026-08-01T02:00:01Z';x.authority_bundle.fresh_snapshot=resealObject(x.authority_bundle.fresh_snapshot,'snapshot_digest');x.authority_bundle=resealObject(x.authority_bundle,'bundle_digest')}),
  ()=>invalid(x=>{x.authority_bundle.sources.push(clone(x.authority_bundle.sources[0]));x.authority_bundle=resealObject(x.authority_bundle,'bundle_digest')}),
  ()=>invalid(x=>{const second={...clone(x.authority_bundle.sources[0]),source_type:'review_decision',source_ref:{kind:'canonical_record',url:url('5147802003')}};x.authority_bundle.sources=[...x.authority_bundle.sources,second];x.authority_bundle=resealObject(x.authority_bundle,'bundle_digest')}),
  ()=>deepFrozen(api.validateAuthorityRoutingBudgetCutoverInputV1(baseInput))&&jcs(api.runAuthorityRoutingBudgetCutoverV1(baseInput))===jcs(api.runAuthorityRoutingBudgetCutoverV1(clone(baseInput)))
)
groupChecks['M3-OWNER'].push(
  ()=>bundle.sources.every(source=>source.admission_result==='accepted'),
  ()=>bundle.admission_result==='accepted',
  ()=>routeSelection.binding.authority_record_url===url('5147777774'),
  ()=>repairProfile.authority_record_url===url('5142525621'),
  ()=>baseResult.next_repair_ledger.profile_digest===repairProfile.profile_digest,
  ()=>routeResult.dispatch_intent_or_null.transport_authority===false,
  ()=>winnerFinal.branch==='eligible_token'&&acquiredReceipt.new_delivery_eligibility_authorized===true&&acquiredReceipt.transport_execution_count_for_key===0,
  ()=>routeResult.protected_action_invoked===false,
  ()=>!JSON.stringify(baseResult).includes('label'),
  ()=>!JSON.stringify(baseResult).includes('recency'),
  ()=>invalid(x=>{x.profiles.route_binding_table.bindings.push(clone(x.profiles.route_binding_table.bindings[0]));x.profiles.route_binding_table=withProfileDigest(without(x.profiles.route_binding_table,'profile_digest'))}),
  ()=>api.runAuthorityRoutingBudgetCutoverV1(mutatedInput(x=>{x.authority_bundle.sources[0].authority_scope_digest=D('owner-conflict');x.authority_bundle=resealObject(x.authority_bundle,'bundle_digest')})).kind==='rejected'
)
const reviewRoute=routes.find(route=>route.transition_class==='implementation_review')
const reviewSelection=api.sealM3RouteSelectionV1({kind:'route',binding:reviewRoute,predecessor_canonical_url:url('5147777774'),branch:fixture.branch,worktree_identity:fixture.logical_worktree_identity,pr_url_or_null:null,head_sha_or_null:HEAD})
const reviewEvaluation={kind:'recommend_next_role',target_role_id:reviewRoute.role_id,next_action_id:reviewRoute.action_id,predecessor_canonical_url:url('5147777774'),target_head_sha_or_null:HEAD}
const reviewGuard=m1.deriveActionGuardProofShadowV1({...without(guard,'proof_digest'),action_id:reviewRoute.action_id},fresh).value
const reviewResult=api.runAuthorityRoutingBudgetCutoverV1(makeInput({evaluation:reviewEvaluation,route_selection:reviewSelection,action_guard_proof_or_null:reviewGuard}))
const metadataRoute=routes.find(route=>route.transition_class==='metadata_sync')
const metadataSelection=api.sealM3RouteSelectionV1({kind:'route',binding:metadataRoute,predecessor_canonical_url:url('5147777774'),branch:fixture.branch,worktree_identity:fixture.logical_worktree_identity,pr_url_or_null:null,head_sha_or_null:HEAD})
const metadataEvaluation={kind:'recommend_next_role',target_role_id:metadataRoute.role_id,next_action_id:metadataRoute.action_id,predecessor_canonical_url:url('5147777774'),target_head_sha_or_null:HEAD}
const metadataGuard=m1.deriveActionGuardProofShadowV1({...without(guard,'proof_digest'),action_id:metadataRoute.action_id},fresh).value
const metadataResult=api.runAuthorityRoutingBudgetCutoverV1(makeInput({evaluation:metadataEvaluation,route_selection:metadataSelection,action_guard_proof_or_null:metadataGuard}))
groupChecks['M3-ROUTE'].push(
  ()=>routeResult.kind==='cutover_accepted'&&routeResult.dispatch_intent_or_null.intent_kind==='role_dispatch',
  ()=>reviewResult.kind==='cutover_accepted'&&reviewResult.dispatch_intent_or_null.intent_kind==='independent_review_dispatch',
  ()=>metadataResult.kind==='cutover_accepted'&&metadataResult.dispatch_intent_or_null.route_binding.transition_class==='metadata_sync',
  ()=>routeResult.dispatch_intent_or_null.task_id===TASK,
  ()=>invalid(x=>{x.combined_task_assignment_authority.branch_name='other';x.combined_task_assignment_authority=resealObject(x.combined_task_assignment_authority,'combined_task_assignment_authority_digest')},routeInput),
  ()=>invalid(x=>{x.combined_task_assignment_authority.worktree_binding_digest=D('other-worktree');x.combined_task_assignment_authority=resealObject(x.combined_task_assignment_authority,'combined_task_assignment_authority_digest')},routeInput),
  ()=>invalid(x=>{x.combined_task_assignment_authority.pr_url='https://github.com/whatrune/sd-prompt-studio/pull/221';x.combined_task_assignment_authority.pr_number=221;x.combined_task_assignment_authority=resealObject(x.combined_task_assignment_authority,'combined_task_assignment_authority_digest')},routeInput),
  ()=>invalid(x=>{x.combined_task_assignment_authority.pr_head_sha='a'.repeat(40);x.combined_task_assignment_authority=resealObject(x.combined_task_assignment_authority,'combined_task_assignment_authority_digest')},routeInput),
  ()=>invalid(x=>{x.combined_task_assignment_authority.predecessor_digest=D('other-predecessor');x.combined_task_assignment_authority=resealObject(x.combined_task_assignment_authority,'combined_task_assignment_authority_digest')},routeInput),
  ()=>invalid(x=>{x.combined_task_assignment_authority.scope_digest=D('other-scope');x.combined_task_assignment_authority=resealObject(x.combined_task_assignment_authority,'combined_task_assignment_authority_digest')},routeInput),
  ()=>api.runAuthorityRoutingBudgetCutoverV1(makeInput({evaluation:routeEvaluation})).kind==='rejected',
  ()=>invalid(x=>{x.profiles.route_binding_table.bindings.push(clone(implementationRoute));x.profiles.route_binding_table=withProfileDigest(without(x.profiles.route_binding_table,'profile_digest'))},routeInput),
  ()=>invalid(x=>{x.evaluation.target_role_id='unauthorized_role'},routeInput),
  ()=>jcs(routeResult.dispatch_intent_or_null)===jcs(api.runAuthorityRoutingBudgetCutoverV1(routeInput).dispatch_intent_or_null),
  ()=>inProgressFinal.branch==='owner_in_progress_rejected'&&consumedFinal.branch==='already_consumed_rejected'&&inProgressFinal.new_delivery_eligibility===false&&consumedFinal.new_delivery_eligibility===false,
  ()=>api.runAuthorityRoutingBudgetCutoverV1(makeInput({evaluation:{kind:'wait_for_protected_action',protected_action_id:'normal_merge_commit'}})).kind==='stopped',
  ()=>routeResult.dispatch_intent_or_null.route_binding===routeResult.reduction.decision.route_binding||jcs(routeResult.dispatch_intent_or_null.route_binding)===jcs(routeResult.reduction.decision.route_binding),
  ()=>routeResult.transport_invoked===false&&routeResult.write_invoked===false&&winnerFinal.receipt_port_invocation_count===1&&loserFinal.receipt_port_invocation_count===0
)
const guardMutation = (mutator) => {
  const copy=clone(guard);mutator(copy);delete copy.proof_digest;copy.proof_digest=digest(copy)
  return api.runAuthorityRoutingBudgetCutoverV1(makeInput({evaluation:routeEvaluation,route_selection:routeSelection,action_guard_proof_or_null:copy})).kind==='rejected'
}
groupChecks['M3-FRESH'].push(
  ()=>accepted(m1.validateFreshAuthoritySnapshotV1(fresh)),
  ()=>routeResult.kind==='cutover_accepted'&&routeResult.action_guard_status==='required'&&accepted(api.validateM3RouteBoundActionGuardV1(routeGuard))&&winnerFinal.branch==='eligible_token',
  ()=>guardMutation(x=>{x.action_snapshot.main_sha_or_null='a'.repeat(40);x.action_snapshot=resealObject(x.action_snapshot,'snapshot_digest')}),
  ()=>guardMutation(x=>{x.action_snapshot.pr_base_sha_or_null='a'.repeat(40);x.action_snapshot.pr_url_or_null='https://github.com/whatrune/sd-prompt-studio/pull/1';x.action_snapshot.pr_head_sha_or_null=HEAD;x.action_snapshot.pr_state='open_draft';x.action_snapshot=resealObject(x.action_snapshot,'snapshot_digest')}),
  ()=>guardMutation(x=>{x.action_snapshot.pr_url_or_null='https://github.com/whatrune/sd-prompt-studio/pull/1';x.action_snapshot.pr_head_sha_or_null=HEAD;x.action_snapshot.pr_base_sha_or_null=HEAD;x.action_snapshot.pr_state='open_draft';x.action_snapshot=resealObject(x.action_snapshot,'snapshot_digest')}),
  ()=>guardMutation(x=>{x.action_snapshot.check_set_digest_or_null=D('changed');x.action_snapshot=resealObject(x.action_snapshot,'snapshot_digest')}),
  ()=>guardMutation(x=>{x.action_snapshot.finding_set_digest=D('changed');x.action_snapshot=resealObject(x.action_snapshot,'snapshot_digest')}),
  ()=>guardMutation(x=>{x.action_snapshot.thread_set_digest=D('changed');x.action_snapshot=resealObject(x.action_snapshot,'snapshot_digest')}),
  ()=>guardMutation(x=>{x.action_snapshot.gsp_generation_or_null=1;x.action_snapshot.gsp_body_digest_or_null=D('gsp');x.action_snapshot=resealObject(x.action_snapshot,'snapshot_digest')}),
  ()=>guardMutation(x=>{x.action_snapshot.workspace_state='dirty';x.action_snapshot.workspace_binding_digest_or_null=D('dirty');x.action_snapshot=resealObject(x.action_snapshot,'snapshot_digest')}),
  ()=>invalid(x=>{x.authority_bundle.fresh_snapshot.workspace_state='missing';x.authority_bundle.fresh_snapshot.workspace_binding_digest_or_null=null;x.authority_bundle.fresh_snapshot=resealObject(x.authority_bundle.fresh_snapshot,'snapshot_digest');x.authority_bundle=resealObject(x.authority_bundle,'bundle_digest')}),
  ()=>consumedFinal.branch==='already_consumed_rejected'&&consumedFinal.transport_execution_count_for_key===1,
  ()=>guardMutation(x=>{x.consumption_state='consumed'}),
  ()=>guardMutation(x=>{x.action_snapshot.purpose='evaluation';x.action_snapshot=resealObject(x.action_snapshot,'snapshot_digest')}),
  ()=>guardMutation(x=>{x.guarded_at=fresh.observed_at;x.action_snapshot.observed_at=fresh.observed_at;x.action_snapshot=resealObject(x.action_snapshot,'snapshot_digest')}),
  ()=>jcs(routeResult)===jcs(api.runAuthorityRoutingBudgetCutoverV1(clone(routeInput)))
)
const budgetClasses=['technical','architecture','metadata','delivery']
for(const attemptClass of budgetClasses){
  const sequence=sequences[attemptClass]
  groupChecks['M3-BUDGET'].push(
    ()=>sequence.second.ledger.entries.find(entry=>entry.attempt_class===attemptClass).attempt_count===2,
    ()=>sequence.third.ledger.entries.find(entry=>entry.attempt_class===attemptClass).attempt_count===3,
    ()=>sequence.fourth.result.kind==='stopped'&&sequence.fourth.result.stop_class==='budget_exhausted'
  )
}
const tech=sequences.technical
const rebindMain=(source,newHead)=>{
  const copy=clone(source)
  copy.state.authority_snapshot.main_sha_or_null=newHead
  copy.state.authority_snapshot.snapshot_digest=digest(without(copy.state.authority_snapshot,'observed_at','snapshot_digest'))
  copy.event.authority_snapshot_digest=copy.state.authority_snapshot.snapshot_digest
  const eventBaseForDigest=without(copy.event,'event_id','observed_at','semantic_event_digest')
  copy.event.event_id=digest(eventBaseForDigest);copy.event.semantic_event_digest=copy.event.event_id
  copy.authority_bundle.fresh_snapshot.main_sha_or_null=newHead
  copy.authority_bundle.fresh_snapshot=resealObject(copy.authority_bundle.fresh_snapshot,'snapshot_digest')
  copy.authority_bundle.sources=copy.authority_bundle.sources.map(source=>({...source,subject_head_sha_or_null:newHead}))
  copy.authority_bundle=resealObject(copy.authority_bundle,'bundle_digest')
  copy.combined_task_assignment_authority.pr_head_sha=newHead
  copy.combined_task_assignment_authority.fresh_snapshot_digest=copy.authority_bundle.fresh_snapshot.snapshot_digest
  copy.combined_task_assignment_authority=resealObject(copy.combined_task_assignment_authority,'combined_task_assignment_authority_digest')
  const stateDigest=digest(copy.state)
  copy.cutover_profile=api.sealAuthorityRoutingBudgetCutoverProfileV1({...without(copy.cutover_profile,'profile_digest'),expected_prior_state_digest:stateDigest})
  copy.expected_prior_state_digest=stateDigest
  delete copy.input_digest
  return api.sealAuthorityRoutingBudgetCutoverInputV1(copy)
}
const newHeadReplay=api.runAuthorityRoutingBudgetCutoverV1(rebindMain(tech.first.input,'a'.repeat(40)))
const firstEntry=tech.first.ledger.entries[0]
const reopenedLedger=m1.deriveRepairAttemptLedgerShadowV1({...without(tech.first.ledger,'ledger_digest'),entries:[{...firstEntry,state:'reopened'}]}).value
const reopenedAdvance=advanceAttempt(reopenedLedger,'implementation','technical',1,'5147802901',firstEntry.stable_finding_id)
const splitFirst=advanceAttempt(emptyLedger,'implementation','technical',0,'5147802902',D('split-a'))
const splitSecond=advanceAttempt(splitFirst.ledger,'architecture','architecture',0,'5147802903',D('split-b'))
const mergedEvidence=ordered(splitSecond.ledger.entries.flatMap(entry=>entry.evidence_urls))
const mergedEntry={...clone(splitSecond.ledger.entries[0]),stable_finding_id:D('merged-finding'),counter_key:D('merged-counter'),attempt_count:2,state:'reopened',evidence_urls:mergedEvidence}
const mergedLedger=m1.deriveRepairAttemptLedgerShadowV1({...without(splitSecond.ledger,'ledger_digest'),entries:[mergedEntry]}).value
const carriedEpoch=D('admitted-epoch-change')
const carriedLedger=m1.deriveRepairAttemptLedgerShadowV1({...without(splitSecond.ledger,'ledger_digest'),semantic_epoch_id:carriedEpoch,cycle_ledger:{...splitSecond.ledger.cycle_ledger,semantic_counter_epoch_id:carriedEpoch},entries:clone(splitSecond.ledger.entries)}).value
groupChecks['M3-BUDGET'].unshift(()=>accepted(m1.validateRepairBudgetProfileV1(repairProfile)),()=>accepted(m1.validateRepairAttemptLedgerV1(emptyLedger)))
groupChecks['M3-BUDGET'].push(
  ()=>api.runAuthorityRoutingBudgetCutoverV1(inputWithAttempt(tech.first.ledger,tech.first.evidence)).next_repair_ledger.ledger_digest===tech.first.ledger.ledger_digest,
  ()=>jcs(tech.first.result.ledger_cas_operand_or_null)===jcs(api.runAuthorityRoutingBudgetCutoverV1(tech.first.input).ledger_cas_operand_or_null),
  ()=>newHeadReplay.kind==='cutover_accepted'&&newHeadReplay.next_repair_ledger.ledger_digest===tech.first.ledger.ledger_digest,
  ()=>reopenedAdvance.ledger.entries[0].attempt_count===2&&reopenedAdvance.ledger.entries[0].evidence_urls.includes(firstEntry.evidence_urls[0]),
  ()=>splitSecond.ledger.entries.length===2&&splitSecond.ledger.entries.some(entry=>entry.evidence_urls.includes(splitFirst.evidence.evidence_record_url)),
  ()=>accepted(m1.validateRepairAttemptLedgerV1(mergedLedger))&&mergedLedger.entries[0].evidence_urls.length===2,
  ()=>sequences.technical.first.ledger.entries[0].counter_key!==sequences.architecture.first.ledger.entries[0].counter_key,
  ()=>accepted(m1.validateRepairAttemptLedgerV1(carriedLedger))&&carriedLedger.semantic_epoch_id===carriedEpoch&&carriedLedger.entries.length===2,
  ()=>splitSecond.ledger.entries.every(entry=>entry.evidence_urls.length===1)&&mergedLedger.entries[0].evidence_urls.every(record=>mergedEvidence.includes(record)),
  ()=>{const l=m1.deriveRepairAttemptLedgerShadowV1({...without(emptyLedger,'ledger_digest'),cycle_ledger:{...cycleLedger,decision_count_without_progress:32,checkpoint_emitted_without_progress:true}}).value;return api.runAuthorityRoutingBudgetCutoverV1(makeInput({repair_attempt_ledger:l})).checkpoint_required===true},
  ()=>{const l=m1.deriveRepairAttemptLedgerShadowV1({...without(emptyLedger,'ledger_digest'),cycle_ledger:{...cycleLedger,decision_count_without_progress:64,checkpoint_emitted_without_progress:true}}).value;const r=api.runAuthorityRoutingBudgetCutoverV1(makeInput({repair_attempt_ledger:l}));return r.kind==='stopped'&&r.stop_class==='cycle_exhausted'},
  ()=>invalid(x=>{x.repair_budget_profile={...x.repair_budget_profile,profile_digest:D('wrong')}}),
  ()=>invalid(x=>{x.repair_attempt_evidence_or_null={...tech.first.evidence,attempt_class:'unknown',evidence_digest:D('wrong')}},tech.first.input),
  ()=>invalid(x=>{x.repair_attempt_evidence_or_null={...tech.first.evidence,scope_digest:D('wrong'),evidence_digest:D('wrong')}},tech.first.input)
)
const replayInput=inputWithAttempt(tech.first.ledger,tech.first.evidence)
const replayResult=api.runAuthorityRoutingBudgetCutoverV1(replayInput)
const distinctA=advanceAttempt(emptyLedger,'implementation','technical',0,'5147803001',D('distinct-a'))
const distinctB=advanceAttempt(distinctA.ledger,'architecture','architecture',0,'5147803002',D('distinct-b'))
groupChecks['M3-REPLAY'].push(
  ()=>jcs(baseResult)===jcs(api.runAuthorityRoutingBudgetCutoverV1(baseInput)),
  ()=>replayResult.next_repair_ledger.ledger_digest===tech.first.ledger.ledger_digest&&replayResult.ledger_cas_operand_or_null===null,
  ()=>jcs(tech.first.result.ledger_cas_operand_or_null)===jcs(api.runAuthorityRoutingBudgetCutoverV1(tech.first.input).ledger_cas_operand_or_null),
  ()=>casWinner.outcome==='winner'&&winnerFinal.branch==='eligible_token'&&winnerFinal.receipt_port_invocation_count===1&&winnerFinal.transport_execution_count_for_key===0,
  ()=>casLoser.outcome==='loser'&&loserFinal.branch==='cas_loser_rejected'&&loserFinal.receipt_binding_kind==='no_receipt_cas_loser'&&loserFinal.receipt_port_invocation_count===0,
  ()=>distinctB.ledger.entries.every((entry,index,array)=>index===0||Buffer.from(`${array[index-1].entry_kind}\0${array[index-1].counter_key}`).compare(Buffer.from(`${entry.entry_kind}\0${entry.counter_key}`))<0),
  ()=>consumedFinal.branch==='already_consumed_rejected'&&consumedFinal.distinct_delivery_eligibility_token_count===0,
  ()=>invalid(x=>{x.expected_prior_ledger_digest=D('stale')}),
  ()=>invalid(x=>{x.expected_prior_state_digest=D('stale')}),
  ()=>invalid(x=>{x.repair_attempt_evidence_or_null=api.sealRepairAttemptEvidenceV1({...without(x.repair_attempt_evidence_or_null,'idempotency_key','evidence_digest'),source_counter:2})},tech.first.input),
  ()=>deepFrozen(tech.first.result),
  ()=>[baseResult,routeResult,tech.first.result].every(result=>result.transport_invoked===false&&result.write_invoked===false&&result.protected_action_invoked===false)&&[winnerFinal,inProgressFinal,consumedFinal,loserFinal].every(result=>result.transport_execution_performed===false)
)
const legacyInput=makeInput({mode:'legacy_adapter_v1'})
const legacyResult=api.runAuthorityRoutingBudgetCutoverV1(legacyInput)
groupChecks['M3-FALLBACK'].push(
  ()=>baseResult.kind==='cutover_accepted',
  ()=>legacyResult.kind==='legacy_profile_accepted',
  ()=>invalid(x=>{x.cutover_profile.secondary_mode='legacy_adapter_v1'}),
  ()=>invalid(x=>{delete x.cutover_profile.mode}),
  ()=>invalid(x=>{x.cutover_profile.mode='unbound';x.cutover_profile=resealObject(x.cutover_profile,'profile_digest')}),
  ()=>legacyResult.rollback_preservation_proof.profile_mode==='legacy_adapter_v1',
  ()=>legacyResult.rollback_preservation_proof.prior_ledger_digest===emptyLedger.ledger_digest,
  ()=>legacyResult.rollback_preservation_proof.authority_bundle_digest===bundle.bundle_digest,
  ()=>api.runAuthorityRoutingBudgetCutoverV1(mutatedInput(x=>{x.cutover_profile.mode='bad';x.cutover_profile=resealObject(x.cutover_profile,'profile_digest')})).kind==='rejected',
  ()=>core.reduceContinuousOrchestrationV1(state,event,profiles,noTransition,url('5147804001'),'2026-08-01T02:00:02Z').decision.branch==='no_transition'
)
const bytes=Object.fromEntries(await Promise.all(fixture.ordered_cumulative_paths.map(async path=>[path,await readFile(path)])))
const byteHashes=Object.fromEntries(Object.entries(bytes).map(([path,value])=>[path,sha(value)]))
const m3Paths=fixture.ordered_cumulative_paths.slice(8)
const m3SliceBase={slice_id:'M3',ordinal:3,added_paths:m3Paths,added_path_count:3,content_binding:{kind:'path_byte_sha256',path_bindings:m3Paths.map(path=>({path,byte_length:bytes[path].byteLength,byte_sha256:byteHashes[path]}))},prior_slice_digest_or_null:'50c8778f0e6cd02a6b5b1fee4087c9092502b2b16a1e5587b04b20cc8c149c24',cumulative_paths_after_slice:fixture.ordered_cumulative_paths}
const m3SliceDigest=digest(m3SliceBase)
const cumulativeDigest=digest({prior_cumulative_digest_or_null:fixture.prior_cumulative_digest,slice_digest:m3SliceDigest,cumulative_paths_after_slice:fixture.ordered_cumulative_paths})
const successorManifestDigest=digest({prior_manifest_digest:fixture.prior_manifest_digest,prior_cumulative_digest:fixture.prior_cumulative_digest,slice_digest:m3SliceDigest,cumulative_digest:cumulativeDigest,cumulative_paths:fixture.ordered_cumulative_paths})
const manifestCompatible=paths=>jcs(paths)===jcs(fixture.ordered_cumulative_paths)
groupChecks['M3-MANIFEST'].push(
  ()=>fixture.ordered_cumulative_paths.slice(0,8).every((path,index)=>path===['scripts/fixtures/continuous-orchestration-core-consolidation-m0-v1.json','scripts/test-continuous-orchestration-core-consolidation-m0.mjs','src/continuous-orchestration/shared-proof-interfaces-v1.ts','scripts/fixtures/continuous-orchestration-shared-proof-interfaces-v1.json','scripts/test-continuous-orchestration-shared-proof-interfaces.mjs','src/continuous-orchestration/shadow-equivalence-v1.ts','scripts/fixtures/continuous-orchestration-shadow-equivalence-v1.json','scripts/test-continuous-orchestration-shadow-equivalence.mjs'][index]),
  ()=>fixture.ordered_cumulative_paths.slice(0,8).length===8,
  ()=>fixture.prior_manifest_digest===api.M3_EXPECTED_M2_MANIFEST_DIGEST,
  ()=>jcs(m3Paths)===jcs(['src/continuous-orchestration/authority-routing-budget-cutover-v1.ts','scripts/fixtures/continuous-orchestration-authority-routing-budget-cutover-v1.json','scripts/test-continuous-orchestration-authority-routing-budget-cutover.mjs']),
  ()=>fixture.result_path_count===11&&fixture.ordered_cumulative_paths.length===11,
  ()=>cumulativeDigest===digest({prior_cumulative_digest_or_null:fixture.prior_cumulative_digest,slice_digest:m3SliceDigest,cumulative_paths_after_slice:fixture.ordered_cumulative_paths}),
  ()=>!manifestCompatible(fixture.ordered_cumulative_paths.slice(0,-1)),
  ()=>!manifestCompatible([...fixture.ordered_cumulative_paths,'extra']),
  ()=>!manifestCompatible([fixture.ordered_cumulative_paths[1],fixture.ordered_cumulative_paths[0],...fixture.ordered_cumulative_paths.slice(2)]),
  ()=>m3SliceDigest!==fixture.prior_manifest_digest&&successorManifestDigest!==fixture.prior_manifest_digest
)

groupChecks['M3-REG'].push(
  ()=>m0.result==='PASS',()=>m1Result.result==='PASS',()=>m2.result==='PASS'&&m2.semantic_rows==='72/72',()=>m2.architecture_supplement_rows==='67/67',
  ()=>agp.result==='PASS'&&agp.evaluator_cases===56,()=>cov.result==='PASS'&&cov.rows===40&&cov.pre_merge_completion_simulation_rows===14,
  ()=>gsp.result==='PASS',()=>arl.result==='PASS',
  ()=>git('diff','--check')==='',
  ()=>!['src/continuous-orchestration/index.ts','src/automatic-gate-progression/index.ts','src/gate-status-publisher/index.ts','src/architecture-repair-loop/index.ts'].some(path=>new RegExp('authority-routing-budget-cutover-v1').test(execFileSync('git',['show',`${HEAD}:${path}`],{cwd:process.cwd(),encoding:'utf8'})))
)

const rowResults=[]
for(const group of fixture.groups){
  const checks=groupChecks[group.group_id]
  assert.equal(checks.length,group.row_count,`${group.group_id} executable check count`)
  const rows=[]
  for(let index=0;index<checks.length;index+=1){
    const row=group.rows[index]
    check(checks[index](),`${row.row_id} ${row.assertion}`)
    const evidence={row_id:row.row_id,row_digest:row.row_digest,group_id:group.group_id,execution_ordinal:index+1,assertion:row.assertion,status:'PASS'}
    rows.push({...evidence,case_execution_digest:digest(evidence)})
  }
  const executionBase={group_id:group.group_id,row_count:rows.length,case_execution_digests:rows.map(row=>row.case_execution_digest)}
  rowResults.push({group_id:group.group_id,row_count:rows.length,group_digest:group.group_digest,group_execution_digest:digest(executionBase),rows})
}
const executionAggregateDigest=digest(rowResults.map(group=>({group_id:group.group_id,row_count:group.row_count,group_execution_digest:group.group_execution_digest})))
const executionMatrixDigest=digest({fixture_version:fixture.fixture_version,ordered_case_execution_digests:rowResults.flatMap(group=>group.rows.map(row=>({row_id:row.row_id,case_execution_digest:row.case_execution_digest}))),execution_aggregate_digest:executionAggregateDigest})

const status=git('status','--porcelain=v1').split(/\r?\n/).filter(Boolean)
const untracked=git('ls-files','--others','--exclude-standard').split(/\r?\n/).filter(Boolean)
const staged=git('diff','--cached','--name-only').split(/\r?\n/).filter(Boolean)
const tracked=git('diff','--name-only').split(/\r?\n/).filter(Boolean)
check(status.length===11&&untracked.length===11&&staged.length===0&&tracked.length===0,'exact11 guard')
check(fixture.ordered_cumulative_paths.every(path=>untracked.includes(path)),'exact11 membership')
check(noEcho({fixture,rowResults}),'public evidence sanitized')

await server.close()
console.log(JSON.stringify({result:'PASS',contract:'Continuous Orchestration M3 Authority Routing Budget Cutover',rows:'130/130',groups:rowResults.map(group=>({group_id:group.group_id,row_count:group.row_count,group_digest:group.group_digest,group_execution_digest:group.group_execution_digest})),row_digests:rowResults.flatMap(group=>group.rows),assertions:assertionCount,replay_matrix:'PASS',concurrency_matrix:'PASS',freshness_matrix:'PASS',budget_matrix:'PASS',fallback_matrix:'PASS',phase_a_prepared_binding:'PASS',cas_winner_loser_matrix:'PASS',phase_b_finalization_union:'PASS',owner_lifecycle_matrix:'PASS',route_bound_action_guard:'PASS',combined_task_assignment_authority:'PASS',canonical_final_binding_reconstruction:'PASS',unique_delivery_eligible_intents:1,unique_admitted_transitions:1,extra_dispatch_count:0,transport_invocation_count:0,write_invocation_count:0,protected_action_invocation_count:0,io_invocation_count:0,predecessor_path_count:8,cumulative_path_count:11,m3_file_bindings:m3Paths.map(path=>({path,byte_length:bytes[path].byteLength,sha256:byteHashes[path]})),aggregate_digest:fixture.aggregate_digest,matrix_digest:fixture.matrix_digest,execution_aggregate_digest:executionAggregateDigest,execution_matrix_digest:executionMatrixDigest,m3_slice_digest:m3SliceDigest,cumulative_digest:cumulativeDigest,manifest_digest:successorManifestDigest,successor_manifest_digest:successorManifestDigest,head:git('rev-parse','HEAD'),branch:git('branch','--show-current'),staged_path_count:staged.length,tracked_existing_delta_count:tracked.length}))
