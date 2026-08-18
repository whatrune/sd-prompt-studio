import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'vite'

const fixture = JSON.parse(await readFile('scripts/fixtures/continuous-orchestration-shadow-equivalence-v1.json', 'utf8'))
const m1Fixture = JSON.parse(await readFile('scripts/fixtures/continuous-orchestration-shared-proof-interfaces-v1.json', 'utf8'))
const agpCorpus = JSON.parse(await readFile('docs/automation/phase1-v2-normative-fixture-corpus.json', 'utf8'))
const covCorpus = JSON.parse(await readFile('scripts/fixtures/continuous-orchestration-v1.json', 'utf8'))
const server = await createServer({ configFile:false, cacheDir:join(tmpdir(),'sd-prompt-studio-issue221-m2-vite'), optimizeDeps:{noDiscovery:true}, server:{middlewareMode:true}, appType:'custom', logLevel:'error' })
const api = await server.ssrLoadModule('/src/continuous-orchestration/shadow-equivalence-v1.ts')
const m1 = await server.ssrLoadModule('/src/continuous-orchestration/shared-proof-interfaces-v1.ts')
const agp = await server.ssrLoadModule('/src/automatic-gate-progression/index.ts')

const clone = structuredClone
const sha = value => createHash('sha256').update(value).digest('hex')
const jcs = value => {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'number') { if (!Number.isFinite(value)) throw new TypeError('non-finite'); return JSON.stringify(value) }
  if (Array.isArray(value)) return `[${value.map(jcs).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${jcs(value[key])}`).join(',')}}`
  throw new TypeError('outside JSON model')
}
const digest = value => sha(jcs(value))
const without = (value,...keys) => Object.fromEntries(Object.entries(value).filter(([key])=>!keys.includes(key)))
const pointerTokens = pointer => pointer.slice(1).split('/').map(token=>token.replace(/~1/g,'/').replace(/~0/g,'~'))
const containerAt = (root,tokens) => tokens.reduce((cursor,token)=>cursor[token],root)
const applyOperations = (base,operations) => {
  const root=clone(base)
  for(const operation of operations){
    const tokens=pointerTokens(operation.path), key=tokens.at(-1), parent=containerAt(root,tokens.slice(0,-1))
    if(operation.op==='test'){assert.deepEqual(parent[key],operation.value);continue}
    if(operation.op==='remove'){if(Array.isArray(parent))parent.splice(Number(key),1);else delete parent[key];continue}
    if(operation.op==='replace'){parent[key]=clone(operation.value);continue}
    if(Array.isArray(parent)){if(key==='-')parent.push(clone(operation.value));else parent.splice(Number(key),0,clone(operation.value))}else parent[key]=clone(operation.value)
  }
  return root
}
const D = label => sha(label)
const HEAD = fixture.authority_head_sha
const url = suffix => `https://github.com/whatrune/sd-prompt-studio/issues/221#issuecomment-${suffix}`
const accepted = result => result.kind === 'accepted'
const rejected = result => result.kind === 'rejected'
const ordered = values => [...values].sort((a,b)=>Buffer.from(a).compare(Buffer.from(b)))
const deepFrozen = value => !value || typeof value !== 'object' || (Object.isFrozen(value) && Object.values(value).every(deepFrozen))
const noEcho = value => !/(?:private-secret|Users[\\/]|[A-Za-z]:[\\/]|credential|environment_variable)/i.test(JSON.stringify(value))
const git = (...args) => execFileSync('git',args,{cwd:process.cwd(),encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()
let assertionCount = 0
const check = (condition,message) => { assertionCount += 1; assert.ok(condition,message) }

check(fixture.fixture_digest===digest(without(fixture,'fixture_digest')),'fixture digest')
check(fixture.groups.reduce((sum,group)=>sum+group.rows.length,0)===72,'72 rows frozen')
check(new Set(fixture.groups.flatMap(group=>group.rows.map(row=>row.id))).size===72,'72 row ids unique')
check(agpCorpus.evaluator_rows.length===56,'AGP 56 corpus binding')
check(covCorpus.rows.length===40&&covCorpus.pre_merge_completion_simulation.rows.length===14,'COV 40+14 corpus binding')

const sourceRef = {kind:'canonical_record',url:url('5144571074')}
const freshBase = {
  snapshot_version:m1.FRESH_AUTHORITY_SNAPSHOT_V1_VERSION,purpose:'evaluation',task_id:fixture.task_id,repository:fixture.repository,
  assignment_revision:1,collected_from:[sourceRef],main_sha_or_null:HEAD,pr_url_or_null:null,pr_head_sha_or_null:null,
  pr_base_sha_or_null:null,pr_state:'not_applicable',check_set_digest_or_null:null,finding_set_digest:D('findings'),
  thread_set_digest:D('threads'),workspace_binding_digest_or_null:D('workspace'),workspace_state:'clean_bound',
  gsp_generation_or_null:null,gsp_body_digest_or_null:null,approval_consumption_digest_or_null:null,observed_at:'2026-08-01T01:00:00Z',
}
const fresh = m1.deriveFreshAuthoritySnapshotShadowV1(freshBase).value
const authorityBindings = {
  authority_bundle:{existing:'continuous_orchestration_authority_snapshot_v1',shadow:'deriveAdmittedAuthorityBundleShadowV1',authorityClass:'admission'},
  progression_decision:{existing:'automatic_gate_progression_v2_result',shadow:'deriveProgressionDecisionM2LocalAdapterV1',authorityClass:'pure_decision'},
  route_binding:{existing:'continuous_orchestration_route_binding_v1',shadow:'deriveDispatchIntentShadowV1',authorityClass:'normative_semantic'},
  dispatch_intent:{existing:'continuous_orchestration_pending_transport_projection_v1',shadow:'deriveDispatchIntentShadowV1',authorityClass:'projection_transport'},
  gate_projection_intent:{existing:'continuous_orchestration_gsp_hook_v1',shadow:'deriveGateProjectionIntentFromCovShadowV1',authorityClass:'projection_transport'},
  fresh_action_guard:{existing:'continuous_orchestration_action_guard_observation_v1',shadow:'deriveActionGuardProofShadowV1',authorityClass:'admission'},
  candidate_authority:{existing:'aggregate_candidate_binding_v1',shadow:'deriveCandidateAuthorityRefShadowV1',authorityClass:'admission'},
  completion_evidence:{existing:'completion_evidence_chain_v1',shadow:'deriveCompletionEvidenceCandidateShadowV1',authorityClass:'admission'},
  repair_budget:{existing:'continuous_orchestration_repair_budget_v1',shadow:'deriveRepairBudgetProfileShadowV1',authorityClass:'normative_semantic'},
  repair_ledger:{existing:'continuous_orchestration_repair_ledger_v1',shadow:'deriveRepairAttemptLedgerShadowV1',authorityClass:'pure_decision'},
  architecture_repair_evidence:{existing:'architecture_repair_loop_evidence_projection_v1',shadow:'admitted_authority_source_route_evidence_projection_v1',authorityClass:'pure_decision'},
}
const sourceTypes=['identity','task_assignment','result_handoff','review_decision','product_owner_approval','pr_snapshot','check_snapshot','review_thread_snapshot','gate_status_projection','context_health_resume','workspace_snapshot']
const authoritySources = fixture.comparison_classes.map((comparisonClass,index)=>({
  source_type:sourceTypes[index],source_ref:{kind:'canonical_record',url:url(String(5144571101+index))},owner_contract_url:url('5144571074'),authority_class:authorityBindings[comparisonClass].authorityClass,
  authority_scope_digest:D('scope'),content_projection_digest:D(`content:${comparisonClass}`),task_id:fixture.task_id,repository:fixture.repository,
  subject_head_sha_or_null:HEAD,observed_at:'2026-08-01T00:59:59Z',admitted_field_ids:[comparisonClass],admission_result:'accepted',
})).sort((a,b)=>Buffer.from(`${a.source_type}\0${jcs(a.source_ref)}`).compare(Buffer.from(`${b.source_type}\0${jcs(b.source_ref)}`)))
const sourceByClass=Object.fromEntries(fixture.comparison_classes.map(comparisonClass=>[comparisonClass,authoritySources.find(source=>source.admitted_field_ids[0]===comparisonClass)]))
const bundleBase = {bundle_version:m1.ADMITTED_AUTHORITY_BUNDLE_V1_VERSION,task_id:fixture.task_id,repository:fixture.repository,assignment_revision:1,scope_digest:D('scope'),sources:authoritySources,fresh_snapshot:fresh,admission_result:'accepted'}
const bundle = m1.deriveAdmittedAuthorityBundleShadowV1(bundleBase).value

const projectionFields = {
  authority_bundle:['task_id','repository','assignment_revision','scope_digest','source_set_digest','snapshot_digest','bundle_digest'],
  progression_decision:['result_kind','result_digest','stop_reason_or_null','target_role_or_null','target_action_or_null','target_head_or_null','gate_requirement_digest','no_transition_binding_digest_or_null'],
  route_binding:['route_digest','role_id','action_id','scope_digest','assignment_revision','predecessor_url','branch','worktree_identity','pr_url_or_null','head_sha_or_null','idempotency_key'],
  dispatch_intent:['decision_url','predecessor_url','route_digest','scope_digest','branch','worktree_identity','pr_url_or_null','head_sha_or_null','idempotency_key','transport_authority'],
  gate_projection_intent:['requirement_digest','required_fields_digest','evidence_urls_digest','reason','pr_url','head_sha','authorized_metadata_role_id','observed_generation_or_null','observed_digest_or_null','projection_authority','finding_closure_authority','approval_authority'],
  fresh_action_guard:['evaluation_snapshot_digest','action_snapshot_digest','action_id','guarded_at','one_use','consumption_state','execution_authority'],
  candidate_authority:['candidate_identity_digest','aggregate_digest','ordered_paths_digest','base_sha','working_head_sha','result_handoff_url','publication_state','published_head_sha_or_null'],
  completion_evidence:['evidence_chain_digest','exact_head_sha','current_main_sha','candidate_ref_digest','gsp_generation','gsp_head_sha','gsp_rows_digest','finding_set_digest','thread_set_digest','completion_authority'],
  repair_budget:['profile_digest','semantic_epoch_id','scope_digest','technical_limit','architecture_limit','metadata_limit','delivery_limit','checkpoint_limit','stop_limit'],
  repair_ledger:['ledger_digest','semantic_epoch_id','profile_digest','entries_digest','cycle_ledger_digest'],
  architecture_repair_evidence:['evidence_projection_digest','authority_urls_digest','finding_bindings_digest','dispositions_digest','next_role_evidence_digest','dispatch_authority'],
}

const payload = comparisonClass => {
  const values = {
    authority_bundle:{task_id:fixture.task_id,repository:fixture.repository,assignment_revision:1,scope_digest:D('scope'),source_set_digest:D('sources'),snapshot_digest:fresh.snapshot_digest,bundle_digest:bundle.bundle_digest},
    progression_decision:{result_kind:'recommend_next_role',result_digest:D('decision'),stop_reason_or_null:null,target_role_or_null:'backend_implementer',target_action_or_null:'implement_m2',target_head_or_null:HEAD,gate_requirement_digest:D('gate'),no_transition_binding_digest_or_null:null},
    route_binding:{route_digest:D('route'),role_id:'backend_implementer',action_id:'implement_m2',scope_digest:D('scope'),assignment_revision:1,predecessor_url:url('5145198472'),branch:'codex/issue-221-core-consolidation',worktree_identity:'issue-221-core-consolidation',pr_url_or_null:null,head_sha_or_null:HEAD,idempotency_key:D('route-key')},
    dispatch_intent:{decision_url:url('5145198472'),predecessor_url:url('5145135716'),route_digest:D('route'),scope_digest:D('scope'),branch:'codex/issue-221-core-consolidation',worktree_identity:'issue-221-core-consolidation',pr_url_or_null:null,head_sha_or_null:HEAD,idempotency_key:D('dispatch-key'),transport_authority:false},
    gate_projection_intent:{requirement_digest:D('requirement'),required_fields_digest:D('fields'),evidence_urls_digest:D('evidence-urls'),reason:'stale',pr_url:'https://github.com/whatrune/sd-prompt-studio/pull/220',head_sha:HEAD,authorized_metadata_role_id:'publication_manager',observed_generation_or_null:1,observed_digest_or_null:D('gsp'),projection_authority:false,finding_closure_authority:false,approval_authority:false},
    fresh_action_guard:{evaluation_snapshot_digest:fresh.snapshot_digest,action_snapshot_digest:D('action-snapshot'),action_id:'metadata_sync',guarded_at:'2026-08-01T01:00:01Z',one_use:true,consumption_state:'unconsumed',execution_authority:false},
    candidate_authority:{candidate_identity_digest:D('candidate'),aggregate_digest:D('aggregate'),ordered_paths_digest:D('paths'),base_sha:HEAD,working_head_sha:HEAD,result_handoff_url:url('5144927385'),publication_state:'unpublished',published_head_sha_or_null:null},
    completion_evidence:{evidence_chain_digest:D('completion-chain'),exact_head_sha:HEAD,current_main_sha:HEAD,candidate_ref_digest:D('candidate-ref'),gsp_generation:1,gsp_head_sha:HEAD,gsp_rows_digest:D('gsp-rows'),finding_set_digest:D('findings'),thread_set_digest:D('threads'),completion_authority:false},
    repair_budget:{profile_digest:D('profile'),semantic_epoch_id:D('epoch'),scope_digest:D('scope'),technical_limit:3,architecture_limit:3,metadata_limit:3,delivery_limit:3,checkpoint_limit:32,stop_limit:64},
    repair_ledger:{ledger_digest:D('ledger'),semantic_epoch_id:D('epoch'),profile_digest:D('profile'),entries_digest:D('entries'),cycle_ledger_digest:D('cycles')},
    architecture_repair_evidence:{evidence_projection_digest:D('arl-evidence'),authority_urls_digest:D('arl-urls'),finding_bindings_digest:D('arl-findings'),dispositions_digest:D('arl-dispositions'),next_role_evidence_digest:D('arl-next-role'),dispatch_authority:false},
  }
  return values[comparisonClass]
}

const makePair = (comparisonClass,index) => {
  const projection = {comparison_class:comparisonClass,payload:payload(comparisonClass)}
  const sourceUrls=[sourceByClass[comparisonClass].source_ref.url]
  const binding=authorityBindings[comparisonClass]
  return {
    comparison_id:`M2-${String(index+1).padStart(2,'0')}-${comparisonClass}`,
    comparison_class:comparisonClass,
    authority_bundle_digest:bundle.bundle_digest,
    source_canonical_record_urls:sourceUrls,
    existing_path_projection:clone(projection),shadow_path_projection:clone(projection),
    comparison_projection:{comparison_contract_version:'shadow_equivalence_comparison_projection_v1',comparison_class:comparisonClass,equality_rule:'exact_jcs_value',required_field_ids:projectionFields[comparisonClass],existing_authority_id:binding.existing,shadow_adapter_id:binding.shadow,required_authority_classes:[binding.authorityClass],source_binding_digest:D('pending'),existing_authority_digest:digest(projection),shadow_adapter_input_digest:D('pending'),shadow_adapter_output_digest:digest(projection)},
    existing_projection_digest:digest(projection),shadow_projection_digest:digest(projection),
  }
}
const sealInput = value => {
  const copy=clone(value)
  for(const pair of copy.pairs){
    pair.existing_projection_digest=digest(pair.existing_path_projection);pair.shadow_projection_digest=digest(pair.shadow_path_projection)
    pair.comparison_projection.existing_authority_digest=pair.existing_projection_digest
    pair.comparison_projection.shadow_adapter_output_digest=pair.shadow_projection_digest
    pair.comparison_projection.source_binding_digest=digest({comparison_class:pair.comparison_class,authority_bundle_digest:copy.authority_bundle.bundle_digest,source_canonical_record_urls:pair.source_canonical_record_urls,admitted_sources:copy.authority_bundle.sources.filter(source=>pair.source_canonical_record_urls.includes(source.source_ref.url))})
    pair.comparison_projection.shadow_adapter_input_digest=digest({comparison_class:pair.comparison_class,shadow_adapter_id:pair.comparison_projection.shadow_adapter_id,authority_bundle_digest:copy.authority_bundle.bundle_digest,source_binding_digest:pair.comparison_projection.source_binding_digest,existing_authority_digest:pair.existing_projection_digest})
  }
  const base=without(copy,'input_digest');return {...base,input_digest:digest(base)}
}
const inputBase = {input_version:api.SHADOW_EQUIVALENCE_INPUT_V1_VERSION,task_id:fixture.task_id,repository:fixture.repository,slice_id:'M2',authority_bundle:bundle,pairs:fixture.comparison_classes.map(makePair)}
const validInput = sealInput(inputBase)
const admittedInput = api.validateShadowEquivalenceInputV1(validInput)
const evaluation = api.evaluateShadowEquivalenceV1(validInput)
assert.equal(admittedInput.kind,'accepted')
assert.equal(evaluation.kind,'accepted')
assert.equal(evaluation.value.kind,'equivalent')

// Execute the M1 adapters against admitted authority, rather than treating their
// names as documentation-only bindings.
const route={transition_class:'implementation',role_id:'backend_implementer',action_id:'implement_m2',authority_record_url:url('5145198472'),allowed_scope_digest:D('scope'),independent_from_role_id_or_null:null}
const dispatchInput={dispatch_intent_version:m1.DISPATCH_INTENT_V1_VERSION,intent_kind:'role_dispatch',task_id:fixture.task_id,repository:fixture.repository,assignment_revision:1,decision_url:url('5145198472'),predecessor_canonical_url:url('5145135716'),route_binding:route,branch:'codex/issue-221-core-consolidation',worktree_identity:'issue-221-core-consolidation',pr_url_or_null:null,head_sha_or_null:HEAD,scope_digest:D('scope'),transport_authority:false,protected_action_authority:false}
const dispatchAdapter=m1.deriveDispatchIntentShadowV1(dispatchInput)
const candidateInput={candidate_authority_ref_version:m1.CANDIDATE_AUTHORITY_REF_V1_VERSION,task_id:fixture.task_id,repository:fixture.repository,candidate_id:'issue221-m2',aggregate_digest:D('aggregate'),ordered_repository_relative_paths:fixture.cumulative_successor.added_paths,base_sha:HEAD,working_head_sha:HEAD,result_handoff_url:url('5145411287'),publication_state:'unpublished',published_head_sha_or_null:null}
const candidateAdapter=m1.deriveCandidateAuthorityRefShadowV1(candidateInput)
const publishedCandidate=m1.deriveCandidateAuthorityRefShadowV1({...candidateInput,publication_state:'published',published_head_sha_or_null:HEAD}).value
const evidenceUrls=ordered([url('5143943504'),url('5144000001'),url('5144000002'),url('5144000003'),url('5144000004'),url('5144000005'),url('5144000006'),url('5144000007'),url('5144000008'),url('5145411287')])
const completionInput={completion_evidence_candidate_version:m1.COMPLETION_EVIDENCE_CANDIDATE_V1_VERSION,task_id:fixture.task_id,repository:fixture.repository,pr_url:'https://github.com/whatrune/sd-prompt-studio/pull/220',candidate_authority_ref:publishedCandidate,exact_head_sha:HEAD,current_main_sha:HEAD,architecture_review_decision_url:url('5143943504'),implementation_review_decision_url:url('5144000002'),publication_review_decision_url:url('5144000003'),final_regression_result_url:url('5144000004'),operational_validation_result_url:url('5144000005'),completion_preflight_url:url('5144000006'),current_main_binding_url:url('5144000007'),post_merge_gsp_url:url('5144000008'),gsp_generation:1,gsp_head_sha:HEAD,gsp_gate_rows_digest:D('gsp'),blocking_finding_count:0,open_finding_count:0,unresolved_thread_count:0,finding_set_digest:D('findings'),thread_set_digest:D('threads'),evidence_urls:evidenceUrls,assembled_at:'2026-08-01T01:01:00Z',completion_authority:false}
const completionAdapter=m1.deriveCompletionEvidenceCandidateShadowV1(completionInput)
const gateInput={gate_projection_intent_version:m1.GATE_PROJECTION_INTENT_V1_VERSION,task_id:fixture.task_id,repository:fixture.repository,assignment_revision:1,decision_url:url('5145198472'),authorized_metadata_role_id:'publication_manager',pr_url:'https://github.com/whatrune/sd-prompt-studio/pull/220',head_sha:HEAD,required_field_ids:['current_head','next_gate'],evidence_urls:ordered([url('5145198472'),url('5145411287')]),reason:'stale',expected_prior_generation_or_null:1,expected_gate_rows_digest_or_null:D('gsp'),must_verify_after_write:true,projection_authority:false,finding_closure_authority:false,approval_authority:false}
const gateAdapter=m1.deriveGateProjectionIntentFromCovShadowV1(gateInput)
const actionFresh=m1.deriveFreshAuthoritySnapshotShadowV1({...freshBase,purpose:'action_guard',observed_at:'2026-08-01T01:00:01Z'}).value
const guardInput={action_guard_proof_version:m1.ACTION_GUARD_PROOF_V1_VERSION,task_id:fixture.task_id,repository:fixture.repository,assignment_revision:1,action_id:'metadata_sync',guard_scope:'non_protected_transport',evaluation_snapshot_digest:fresh.snapshot_digest,action_snapshot:actionFresh,approval_record_url_or_null:null,one_use:true,consumption_state:'unconsumed',guarded_at:actionFresh.observed_at,execution_authority:false}
const guardAdapter=m1.deriveActionGuardProofShadowV1(guardInput,fresh)
const profileInput={repair_budget_profile_version:m1.REPAIR_BUDGET_PROFILE_V1_VERSION,task_id:fixture.task_id,repository:fixture.repository,assignment_revision:1,semantic_epoch_id:D('epoch'),authority_record_url:url('5145198472'),allowed_scope_digest:D('scope'),attempt_limits:{technical:3,architecture:3,metadata:3,delivery:3},cycle_limits:{checkpoint_after_decisions:32,stop_after_decisions:64}}
const profileAdapter=m1.deriveRepairBudgetProfileShadowV1(profileInput)
const deliveryKey=D('delivery'), cycleLedger={cycle_ledger_version:'cycle_ledger_v1',semantic_counter_epoch_id:D('epoch'),progress_epoch:0,max_gate_ordinal_reached:0,decision_count_without_progress:0,checkpoint_emitted_without_progress:false,signature_occurrences:[],last_progress_record_url:url('5145198472')}
const ledgerInput={repair_attempt_ledger_version:m1.REPAIR_ATTEMPT_LEDGER_V1_VERSION,task_id:fixture.task_id,repository:fixture.repository,assignment_revision:1,semantic_epoch_id:D('epoch'),profile_digest:profileAdapter.value.profile_digest,entries:[{entry_kind:'delivery',stable_finding_id:deliveryKey,finding_domain:'publication',attempt_class:'delivery',scope_digest:D('scope'),counter_key:deliveryKey,attempt_count:0,max_attempts:3,state:'pending',evidence_urls:[],source_counter:{idempotency_key:deliveryKey,delivery_count:0,last_completion_url_or_null:null,state:'pending'}}],cycle_ledger:cycleLedger}
const ledgerAdapter=m1.deriveRepairAttemptLedgerShadowV1(ledgerInput)
const agpRecommend={contract_version:'automatic-gate-progression-evaluation-result-v2',task_id:fixture.task_id,evaluated_at:'2026-08-01T01:00:00Z',input_fingerprint:D('input'),precedence_trace:['recommend'],gate_status_requirement:{required:false},kind:'recommend_next_role',target_role:'backend_implementer',next_action:'implement_m2',predecessor_canonical_url:url('5145198472'),target_head:HEAD,same_task_id:fixture.task_id,idempotency_key:D('agp')}
const progressionAdapter=m1.deriveProgressionDecisionPortShadowV1(agpRecommend)
const adapterAdmissions=[m1.deriveAdmittedAuthorityBundleShadowV1(bundleBase),dispatchAdapter,candidateAdapter,completionAdapter,gateAdapter,guardAdapter,profileAdapter,ledgerAdapter,progressionAdapter]
check(adapterAdmissions.every(accepted),`all executable M1 adapters admitted: ${JSON.stringify(adapterAdmissions)}`)
check(accepted(m1.validateRouteBindingV1(route)),'route binding admitted through M1 validator')
check(bundle.sources.length===11&&new Set(bundle.sources.map(source=>source.authority_class)).size===4,'11 class sources admitted with closed authority classes')

// Execute all 56 frozen AGP rows and route every result through the M1 port.
const agpBases=new Map(agpCorpus.base_fixtures.map(base=>[base.fixture_id,base.literal_v2_input]))
const agpKindCounts={}
const agpPortCounts={accepted:0,rejected:0}
const agpPortRejectedRows=[]
const agpRuntimeCases=new Map()
const m2AdapterCounts={accepted_projection:0,explicit_rejection:0}
const m2AdapterOrigins={m1_accepted_passthrough:0,m2_local_exact_invalidation_mapping:0}
for(const row of agpCorpus.evaluator_rows){
  const input=applyOperations(agpBases.get(row.base_fixture_id),row.operations)
  const inputAdmission=agp.validateAutomaticGateProgressionEvaluationInputV2(input)
  check(inputAdmission.kind==='accepted',`AGP input ${row.row_id}`)
  const actual=agp.evaluateAutomaticGateProgressionV2(input)
  check(jcs(actual)===jcs(row.expected_result),`AGP result ${row.row_id}`)
  const binding=actual.kind==='no_transition'?{future_event_type:'review_decision_published',future_event_role_id:'architect_team'}:undefined
  const portResult=m1.deriveProgressionDecisionPortShadowV1(actual,binding)
  check(portResult.kind!=='failed',`AGP port closed result ${row.row_id}`)
  if(portResult.kind==='accepted')check(portResult.value.source_result_digest===digest(actual),`AGP port source binding ${row.row_id}`)
  else agpPortRejectedRows.push({row_id:row.row_id,source_kind:actual.kind,rejection_code:portResult.rejection.code,rejection_path:portResult.rejection.path})
  agpPortCounts[portResult.kind]+=1
  const localInput={adapter_input_version:api.PROGRESSION_DECISION_M2_LOCAL_ADAPTER_INPUT_V1_VERSION,canonical_row_id:row.row_id,expanded_input:input,public_evaluator_result:actual,frozen_m1_port_result:portResult,corpus_artifact_version:api.M2_AGP_CORPUS_ARTIFACT_VERSION,corpus_artifact_digest:api.M2_AGP_CORPUS_ARTIFACT_DIGEST}
  const localResult=api.deriveProgressionDecisionM2LocalAdapterV1(localInput)
  check(localResult.classification==='accepted_projection',`M2 local adapter accepted ${row.row_id}`)
  check(accepted(api.validateProgressionDecisionM2LocalAdapterResultV1(localResult)),`M2 local result admitted ${row.row_id}`)
  m2AdapterCounts[localResult.classification]+=1
  m2AdapterOrigins[localResult.adapter_origin]+=1
  agpRuntimeCases.set(row.row_id,{row,input,actual,portResult,localInput,localResult})
  agpKindCounts[actual.kind]=(agpKindCounts[actual.kind]??0)+1
}
check(Object.keys(agpKindCounts).sort().join(',')===['invalidate_approval','no_transition','recommend_next_role','require_gate_status_update','stop','wait_for_protected_action'].sort().join(','),'AGP closed six-kind matrix')
check(agpPortCounts.accepted>0&&agpPortCounts.accepted+agpPortCounts.rejected===56,'AGP port accepted/rejected closed matrix')
check(jcs(agpPortRejectedRows.map(row=>row.row_id))===jcs(fixture.executed_regression_matrix_contract.automatic_gate_progression.expected_m1_port_rejection_rows),'AGP exact expected M1 port rejection rows')
check(m2AdapterCounts.accepted_projection===56&&m2AdapterCounts.explicit_rejection===0&&m2AdapterOrigins.m1_accepted_passthrough===54&&m2AdapterOrigins.m2_local_exact_invalidation_mapping===2,'M2 canonical adapter 56/0 classification')

// Execute the canonical COV 40+14 runner. Its result, not static row counts, is
// the compatibility authority consumed by this focused matrix.
const covExecution=JSON.parse(execFileSync(process.execPath,['--experimental-strip-types','scripts/test-continuous-orchestration.mjs'],{cwd:process.cwd(),encoding:'utf8',stdio:['ignore','pipe','ignore']}))
check(covExecution.result==='PASS'&&covExecution.rows===40&&covExecution.pre_merge_completion_simulation_rows===14,'COV executable 40+14 matrix')
check(covExecution.pre_merge_completion_simulation_cases.every(row=>row.status==='PASS'),'COV PMCS 14/14 PASS')
const executedCorpusBindingDigest=digest({agp_rows:56,agp_kind_counts:agpKindCounts,cov_rows:covExecution.rows,cov_pmcs_rows:covExecution.pre_merge_completion_simulation_rows,cov_assertions:covExecution.assertions})
check(/^[0-9a-f]{64}$/.test(executedCorpusBindingDigest),'executed corpus binding digest')

const mutate = (comparisonClass,field,value,both=false,source=validInput) => sealInput((()=>{const x=clone(source),pair=x.pairs.find(item=>item.comparison_class===comparisonClass);pair.shadow_path_projection.payload[field]=value;if(both)pair.existing_path_projection.payload[field]=value;return x})())
const decisionPayload = kind => ({
  result_kind:kind,result_digest:D(`decision:${kind}`),
  stop_reason_or_null:kind==='stop'?'architecture_gap':null,
  target_role_or_null:kind==='recommend_next_role'?'backend_implementer':null,
  target_action_or_null:kind==='recommend_next_role'?'implement_m2':null,
  target_head_or_null:kind==='recommend_next_role'?HEAD:null,
  gate_requirement_digest:D(`gate:${kind}`),
  no_transition_binding_digest_or_null:kind==='no_transition'?D('no-transition'):null,
})
const withDecision = (kind,source=validInput) => sealInput((()=>{const x=clone(source),pair=x.pairs.find(item=>item.comparison_class==='progression_decision');pair.existing_path_projection.payload=decisionPayload(kind);pair.shadow_path_projection.payload=clone(pair.existing_path_projection.payload);return x})())
const result = value => {const output=api.evaluateShadowEquivalenceV1(value);assert.equal(output.kind,'accepted');return output.value}
const mismatch = (comparisonClass,field='scope_digest') => {
  const pair=validInput.pairs.find(item=>item.comparison_class===comparisonClass)
  const target=field in pair.shadow_path_projection.payload?field:Object.keys(pair.shadow_path_projection.payload)[0]
  return result(mutate(comparisonClass,target,D(`mismatch:${comparisonClass}:${target}`)))
}
const equivalent = value => result(value).kind==='equivalent'
const mismatchSafe = value => {const r=result(value);return r.kind==='mismatch'&&r.selected_path==='existing'&&r.blocking_finding_required&&r.state_changed===false&&r.write_attempt_count===0&&r.transport_invoked===false&&r.protected_action_invoked===false}

const groupChecks = Object.fromEntries(fixture.groups.map(group=>[group.group_id,[]]))
groupChecks['M2-ADM'].push(
  ()=>accepted(api.validateShadowEquivalenceInputV1(validInput)),
  ()=>{const x=clone(validInput);x.private_secret='private-secret';return rejected(api.validateShadowEquivalenceInputV1(x))},
  ()=>{const x=clone(validInput);delete x.slice_id;return rejected(api.validateShadowEquivalenceInputV1(x))},
  ()=>{const x=clone(validInput);x.pairs[0].existing_path_projection.payload.private_secret='private-secret';return rejected(api.validateShadowEquivalenceInputV1(x))},
  ()=>{const x=clone(validInput);delete x.pairs[0].existing_path_projection.payload.task_id;return rejected(api.validateShadowEquivalenceInputV1(x))},
  ()=>{const x=clone(validInput);x.pairs[0].comparison_class='unknown';return rejected(api.validateShadowEquivalenceInputV1(x))},
  ()=>{const x=clone(validInput);[x.pairs[0],x.pairs[1]]=[x.pairs[1],x.pairs[0]];x.input_digest=digest(without(x,'input_digest'));return rejected(api.validateShadowEquivalenceInputV1(x))},
  ()=>{const x=clone(validInput);x.pairs[0].existing_projection_digest=D('bad');x.input_digest=digest(without(x,'input_digest'));return rejected(api.validateShadowEquivalenceInputV1(x))},
  ()=>{const x=clone(validInput);x.pairs[0].authority_bundle_digest=D('other');x.input_digest=digest(without(x,'input_digest'));return rejected(api.validateShadowEquivalenceInputV1(x))},
  ()=>{const x=clone(validInput);x.pairs[0].source_canonical_record_urls=[url('5144571999')];x.input_digest=digest(without(x,'input_digest'));return rejected(api.validateShadowEquivalenceInputV1(x))},
  ()=>{const x=clone(validInput);x.private_secret='private-secret';return noEcho(api.validateShadowEquivalenceInputV1(x))},
  ()=>{const x=clone(validInput);x.private_secret='private-secret';const r=api.evaluateShadowEquivalenceV1(x);return r.kind==='rejected'&&!JSON.stringify(r).includes('mismatch')&&noEcho(r)},
)

groupChecks['M2-AUTH'].push(
  ()=>validInput.pairs.every(pair=>pair.authority_bundle_digest===bundle.bundle_digest),
  ()=>validInput.pairs.every(pair=>jcs(pair.source_canonical_record_urls)===jcs(ordered(pair.source_canonical_record_urls))),
  ()=>mismatchSafe(mutate('authority_bundle','source_set_digest',D('owner-mismatch'))),
  ()=>rejected(api.validateShadowEquivalenceInputV1(mutate('authority_bundle','scope_digest',D('scope-mismatch')))),
  ()=>mismatchSafe(mutate('authority_bundle','source_set_digest',D('content-mismatch'))),
  ()=>rejected(api.validateShadowEquivalenceInputV1(mutate('authority_bundle','snapshot_digest',D('head-mismatch')))),
  ()=>{const x=clone(validInput);x.pairs[0].source_canonical_record_urls=[sourceByClass.progression_decision.source_ref.url];return rejected(api.validateShadowEquivalenceInputV1(sealInput(x)))},
  ()=>{const x=clone(validInput),a=api.validateShadowEquivalenceInputV1(x);x.pairs[0].existing_path_projection.payload.task_id='mutated';return a.kind==='accepted'&&a.value.pairs[0].existing_path_projection.payload.task_id===fixture.task_id&&deepFrozen(a)},
)

const decisionKinds=['recommend_next_role','wait_for_protected_action','require_gate_status_update','invalidate_approval','stop','no_transition']
groupChecks['M2-DEC'].push(
  ...decisionKinds.map(kind=>()=>equivalent(withDecision(kind))),
  ...decisionKinds.map(kind=>()=>mismatchSafe(mutate('progression_decision','result_digest',D(`different:${kind}`),false,withDecision(kind)))),
)

groupChecks['M2-ROUTE'].push(
  ()=>equivalent(validInput),
  ()=>equivalent(mutate('route_binding','role_id','independent_implementation_reviewer',true)),
  ()=>validInput.pairs.find(x=>x.comparison_class==='route_binding').existing_path_projection.payload.branch==='codex/issue-221-core-consolidation',
  ()=>rejected(api.validateShadowEquivalenceInputV1(mutate('route_binding','scope_digest',D('route-scope')))),
  ()=>mismatchSafe(mutate('route_binding','predecessor_url',url('5140000001'))),
  ()=>mismatchSafe(mutate('route_binding','idempotency_key',D('route-idempotency'))),
  ()=>result(validInput).transport_invoked===false,
  ()=>mismatch('dispatch_intent','route_digest').transport_invoked===false,
)

groupChecks['M2-PROJ'].push(
  ...['missing','stale','conflicting','historical_at_prior_head'].map(reason=>()=>equivalent(mutate('gate_projection_intent','reason',reason,true))),
  ()=>mismatchSafe(mutate('gate_projection_intent','observed_generation_or_null',2)),
  ()=>mismatchSafe(mutate('gate_projection_intent','observed_digest_or_null',D('other-gsp'))),
  ()=>validInput.pairs.find(x=>x.comparison_class==='gate_projection_intent').existing_path_projection.payload.projection_authority===false,
  ()=>{const p=validInput.pairs.find(x=>x.comparison_class==='gate_projection_intent').existing_path_projection.payload;return p.finding_closure_authority===false&&p.approval_authority===false},
)

groupChecks['M2-EVID'].push(
  ()=>equivalent(mutate('fresh_action_guard','action_id','metadata_sync',true)),
  ()=>equivalent(mutate('candidate_authority','publication_state','unpublished',true)),
  ()=>equivalent(mutate('completion_evidence','gsp_generation',2,true)),
  ()=>equivalent(mutate('repair_budget','checkpoint_limit',32,true)),
  ()=>equivalent(mutate('repair_ledger','entries_digest',D('entries-2'),true)),
  ()=>equivalent(mutate('architecture_repair_evidence','finding_bindings_digest',D('findings-2'),true)),
  ()=>fixture.comparison_classes.every(cls=>!Object.entries(validInput.pairs.find(x=>x.comparison_class===cls).existing_path_projection.payload).some(([key,value])=>key.endsWith('_authority')&&value!==false)),
  ()=>mismatchSafe(mutate('completion_evidence','evidence_chain_digest',D('completion-mismatch'))),
)

groupChecks['M2-MISMATCH'].push(
  ()=>{const x=mutate('repair_ledger','ledger_digest',D('late'));const y=mutate('authority_bundle','source_set_digest',D('early'),false,x);const r=result(y);return r.kind==='mismatch'&&r.first_mismatch.comparison_class==='authority_bundle'},
  ()=>{const x=mutate('repair_ledger','ledger_digest',D('late'));const y=mutate('authority_bundle','source_set_digest',D('early'),false,x);const r=result(y),early=result(mutate('authority_bundle','source_set_digest',D('early'))).first_mismatch,late=result(mutate('repair_ledger','ledger_digest',D('late'))).first_mismatch;return r.kind==='mismatch'&&r.mismatch_count===2&&r.mismatch_set_digest===digest([early,late])},
  ()=>mismatch('repair_budget','profile_digest').selected_path==='existing',
  ()=>{const a=mismatch('repair_budget','profile_digest'),b=mismatch('repair_budget','profile_digest');return a.stable_finding_key===b.stable_finding_key},
  ()=>mismatch('candidate_authority','aggregate_digest').state_changed===false,
  ()=>mismatch('route_binding','route_digest').write_attempt_count===0,
  ()=>mismatch('dispatch_intent','route_digest').transport_invoked===false,
  ()=>mismatch('fresh_action_guard','action_id').protected_action_invoked===false,
  ()=>{const x=mutate('architecture_repair_evidence','evidence_projection_digest',D('private-secret'));return noEcho(result(x))},
  ()=>fixture.comparison_classes.every(cls=>equivalent(validInput)&&mismatchSafe(mismatchInput(cls))),
)
const mismatchFields={authority_bundle:'source_set_digest',progression_decision:'result_digest',route_binding:'route_digest',dispatch_intent:'route_digest',gate_projection_intent:'requirement_digest',fresh_action_guard:'evaluation_snapshot_digest',candidate_authority:'candidate_identity_digest',completion_evidence:'evidence_chain_digest',repair_budget:'profile_digest',repair_ledger:'ledger_digest',architecture_repair_evidence:'evidence_projection_digest'}
function mismatchInput(comparisonClass){return mutate(comparisonClass,mismatchFields[comparisonClass],D(`all:${comparisonClass}`))}

groupChecks['M2-REPLAY'].push(
  ()=>jcs(result(validInput))===jcs(result(clone(validInput))),
  ()=>{const x=clone(validInput);x.pairs.reverse();x.input_digest=digest(without(x,'input_digest'));return rejected(api.validateShadowEquivalenceInputV1(x))},
  ()=>accepted(api.validateShadowEquivalenceResultV1(evaluation.value,validInput)),
  ()=>deepFrozen(evaluation),
  async()=>{const outputs=await Promise.all(Array.from({length:16},()=>Promise.resolve().then(()=>api.evaluateShadowEquivalenceV1(clone(validInput)))));return outputs.every(item=>jcs(item)===jcs(outputs[0]))},
  ()=>evaluation.value.result_digest===digest(without(evaluation.value,'result_digest')),
)

for(const group of fixture.groups){
  const checks=groupChecks[group.group_id]
  check(checks.length===group.rows.length,`${group.group_id} row count`)
  for(let index=0;index<checks.length;index+=1)check(await checks[index](),group.rows[index].id)
}

const baseDriftCase=agpRuntimeCases.get('AGP-P05#base_drift')
const stateDriftCase=agpRuntimeCases.get('AGP-P05#state_drift')
const passThroughCase=[...agpRuntimeCases.values()].find(item=>item.portResult.kind==='accepted')
const explicitLocal=value=>api.deriveProgressionDecisionM2LocalAdapterV1(value).classification==='explicit_rejection'
const supplementChecks={
  'M2A-MAP':[
    ()=>agpPortCounts.accepted===54&&agpPortCounts.rejected===2,
    ()=>m2AdapterCounts.accepted_projection===56&&m2AdapterCounts.explicit_rejection===0,
    ()=>baseDriftCase.localResult.projection.invalidation_class==='base_drift'&&baseDriftCase.localResult.adapter_origin==='m2_local_exact_invalidation_mapping',
    ()=>stateDriftCase.localResult.projection.invalidation_class==='pr_state_drift'&&stateDriftCase.localResult.adapter_origin==='m2_local_exact_invalidation_mapping',
    ()=>{const x=clone(baseDriftCase.localInput);x.frozen_m1_port_result.rejection.code='invalid_type_or_format';return explicitLocal(x)},
    ()=>{const x=clone(baseDriftCase.localInput);x.frozen_m1_port_result.rejection.path='/other';return explicitLocal(x)},
    ()=>explicitLocal({...clone(baseDriftCase.localInput),frozen_m1_port_result:clone(passThroughCase.portResult)}),
    ()=>explicitLocal({...clone(passThroughCase.localInput),frozen_m1_port_result:clone(baseDriftCase.portResult)}),
    ()=>{const x=clone(baseDriftCase.localInput);x.public_evaluator_result.input_fingerprint='agp-input-v2:sha256:'+D('tampered');return explicitLocal(x)},
    ()=>explicitLocal({...clone(baseDriftCase.localInput),expanded_input:clone(stateDriftCase.input),public_evaluator_result:clone(stateDriftCase.actual),frozen_m1_port_result:clone(stateDriftCase.portResult)}),
    ()=>explicitLocal({...clone(baseDriftCase.localInput),canonical_row_id:'AGP-P05#unknown'}),
    ()=>jcs(api.deriveProgressionDecisionM2LocalAdapterV1(baseDriftCase.localInput))===jcs(api.deriveProgressionDecisionM2LocalAdapterV1(clone(baseDriftCase.localInput))),
  ],
  'M2A-SRC':[],
  'M2A-COND':[],
  'M2A-CLASSIFY':[
    ()=>[...agpRuntimeCases.values()].every(item=>['accepted_projection','explicit_rejection'].includes(item.localResult.classification)),
    ()=>[...agpRuntimeCases.values()].every(item=>!['failed','skipped'].includes(item.localResult.classification)),
    ()=>agpPortCounts.accepted===54&&agpPortCounts.rejected===2,
    ()=>m2AdapterCounts.accepted_projection===56&&m2AdapterCounts.explicit_rejection===0,
    ()=>[...agpRuntimeCases.values()].every(item=>accepted(api.validateProgressionDecisionM2LocalAdapterResultV1(item.localResult))),
  ],
  'M2A-REG':[],
}
for(const comparisonClass of fixture.comparison_classes){
  supplementChecks['M2A-SRC'].push(()=>accepted(api.validateShadowEquivalenceInputV1(validInput)))
  supplementChecks['M2A-SRC'].push(()=>{const x=clone(validInput),pair=x.pairs.find(item=>item.comparison_class===comparisonClass),ownSource=sourceByClass[comparisonClass],other=authoritySources.find(source=>source.authority_class===ownSource.authority_class&&source.admitted_field_ids[0]!==comparisonClass);pair.source_canonical_record_urls=[other.source_ref.url];return rejected(api.validateShadowEquivalenceInputV1(sealInput(x)))})
  supplementChecks['M2A-COND'].push(()=>accepted(api.validateShadowEquivalenceInputV1(validInput)))
  supplementChecks['M2A-COND'].push(()=>{const x=clone(validInput),pair=x.pairs.find(item=>item.comparison_class===comparisonClass);pair.existing_path_projection.payload.zz_matching_invalid=true;pair.shadow_path_projection.payload.zz_matching_invalid=true;return rejected(api.validateShadowEquivalenceInputV1(sealInput(x)))})
}
supplementChecks['M2A-REG'].push(
  ()=>evaluation.value.kind==='equivalent'&&fixture.groups.reduce((sum,group)=>sum+group.rows.length,0)===72,
  ()=>agpRuntimeCases.size===56&&m2AdapterCounts.accepted_projection===56,
  ()=>covExecution.result==='PASS'&&covExecution.rows===40&&covExecution.pre_merge_completion_simulation_rows===14,
  async()=>{const expected={'scripts/fixtures/continuous-orchestration-core-consolidation-m0-v1.json':'0bb2903dabec3416657361fccf3984b697ee73fe7bf8c3c46bd51725dc854983','scripts/test-continuous-orchestration-core-consolidation-m0.mjs':'f13fabceee6571b9915f7a323b5fa1ced950bef026a07c199e88f7046675044d','src/continuous-orchestration/shared-proof-interfaces-v1.ts':'6ee6de35b634edf0481b679e003f7cdc19572e3a29aee139bb36252944cdb094','scripts/fixtures/continuous-orchestration-shared-proof-interfaces-v1.json':'7d2a3d9b3f94a5ac4d9874fbc1faf9a9d04a1a7f7849d421384675e44a810039','scripts/test-continuous-orchestration-shared-proof-interfaces.mjs':'5810c429bdd9e40b975154c030f09c442dbc66a3e87e3cd808f507349a34b79c'};return (await Promise.all(Object.entries(expected).map(async([path,value])=>sha(await readFile(path))===value))).every(Boolean)},
  ()=>git('diff','--cached','--name-only')===''&&git('diff','--name-only')===''&&git('ls-files','--others','--exclude-standard').split(/\r?\n/).filter(Boolean).length===8,
  async()=>{const sources=await Promise.all(['src/continuous-orchestration/index.ts','src/automatic-gate-progression/index.ts','src/gate-status-publisher/index.ts'].map(path=>readFile(path,'utf8')));return sources.every(source=>!source.includes('shadow-equivalence-v1'))&&[...agpRuntimeCases.values()].every(item=>item.localResult.classification==='accepted_projection')},
)
const supplementRows=[]
const supplementGroups=[]
for(const group of fixture.architecture_supplement.groups){
  const checks=supplementChecks[group.group_id]
  check(checks.length===group.row_count,`${group.group_id} frozen count`)
  const rows=[]
  for(let index=0;index<checks.length;index+=1){
    const row_id=`${group.group_id}-${String(index+1).padStart(3,'0')}`, assertion=`${group.group_id} frozen assertion ${String(index+1).padStart(3,'0')}`
    check(await checks[index](),row_id)
    rows.push({row_id,assertion,result:'PASS',row_digest:digest({row_id,assertion,result:'PASS'})})
  }
  const group_digest=digest({group_id:group.group_id,rows})
  supplementRows.push(...rows);supplementGroups.push({group_id:group.group_id,row_count:rows.length,group_digest})
}
check(supplementRows.length===67&&new Set(supplementRows.map(row=>row.row_id)).size===67,'M2A exact 67 unique ordered rows')
const supplementAggregateDigest=digest(supplementRows)
const supplementMatrixDigest=digest({revision_record_url:fixture.architecture_supplement.revision_record_url,review_approve_url:fixture.architecture_supplement.review_approve_url,groups:supplementGroups,rows:supplementRows})

const m0Paths=fixture.cumulative_successor.prior_paths.slice(0,2)
const m1Paths=fixture.cumulative_successor.prior_paths.slice(2)
const m2Paths=fixture.cumulative_successor.added_paths
const allPaths=[...fixture.cumulative_successor.prior_paths,...m2Paths]
const contentHashes=Object.fromEntries(await Promise.all(allPaths.map(async path=>[path,sha(await readFile(path))])))
const entry=(slice_id,ordinal,slice_candidate_url,paths,priorSlice,priorCumulative,priorPaths=[])=>{
  const base={slice_id,ordinal,slice_candidate_url,added_paths:paths,added_path_count:paths.length,content_binding:{kind:'path_byte_sha256',path_bindings:paths.map(path=>({path,byte_sha256:contentHashes[path]}))},prior_slice_digest_or_null:priorSlice,cumulative_paths_after_slice:[...priorPaths,...paths]}
  const slice_digest=digest(base);return{...base,slice_digest,cumulative_digest:digest({prior_cumulative_digest_or_null:priorCumulative,slice_digest,cumulative_paths_after_slice:base.cumulative_paths_after_slice})}
}
const m0Entry=entry('M0',0,url('5142664055'),m0Paths,null,null)
const m1Entry=entry('M1',1,url('5143469032'),m1Paths,m0Entry.slice_digest,m0Entry.cumulative_digest,m0Paths)
const m0Evidence={semantics:'standalone_exact2_only',candidate_url:url('5142664055'),completion_preflight_url:url('5143231842'),completion_result_url:url('5143245865'),validator_path:m0Paths[1],inventory_path:m0Paths[0],inventory_digest:m1Fixture.m0_historical_binding.inventory_digest,exact_paths:m1Fixture.m0_historical_binding.paths,path_count:2}
const priorBase={schema_version:m1.CUMULATIVE_SLICE_MANIFEST_V1_VERSION,task_id:fixture.task_id,repository:fixture.repository,authority_head_sha:HEAD,branch:'codex/issue-221-core-consolidation',worktree_identity:'issue-221-core-consolidation',manifest_mode:'m1_bootstrap',active_slice_id:'M1',active_slice_ordinal:1,m0_standalone_evidence:m0Evidence,prior_manifest:{state:'none_m1_bootstrap'},slices:[m0Entry,m1Entry],cumulative_paths:fixture.cumulative_successor.prior_paths,cumulative_path_count:5}
const priorManifest={...priorBase,manifest_digest:digest(priorBase)}
check(priorManifest.manifest_digest===fixture.cumulative_successor.prior_manifest_digest,'prior M1 manifest exact binding')
const m2Entry=entry('M2',2,fixture.candidate_record_url,m2Paths,m1Entry.slice_digest,m1Entry.cumulative_digest,fixture.cumulative_successor.prior_paths)
const manifestBase={...priorBase,manifest_mode:'successor',active_slice_id:'M2',active_slice_ordinal:2,prior_manifest:{state:'bound',canonical_record_url:fixture.cumulative_successor.prior_canonical_record_url,manifest_digest:priorManifest.manifest_digest},slices:[m0Entry,m1Entry,m2Entry],cumulative_paths:allPaths,cumulative_path_count:8}
const manifest={...manifestBase,manifest_digest:digest(manifestBase)}
const admittedManifest=m1.validateCumulativeSliceManifestV1(manifest)
check(admittedManifest.kind==='accepted','M2 successor manifest admitted')
const observedPaths=ordered(allPaths)
const contentProofs=await Promise.all(observedPaths.map(async path=>{const bytes=await readFile(path);return{kind:'path_byte_sha256',path,byte_length:bytes.byteLength,byte_sha256:sha(bytes)}}))
const expected=m1Fixture.privacy_contract.approved_expected_identity_binding
const noPaths=[]
const observationBase={observation_version:m1.CUMULATIVE_COMPATIBILITY_OBSERVATION_V1_VERSION,task_id:fixture.task_id,repository:fixture.repository,collected_at:'2026-08-01T01:01:00Z',identity:{authority_head_sha:HEAD,expected,observed:{logical_worktree_identity:'issue-221-core-consolidation',branch:'codex/issue-221-core-consolidation',head_sha:HEAD,worktree_path_binding_digest:expected.worktree_path_binding_digest,git_dir_binding_digest:expected.git_dir_binding_digest,common_git_dir_binding_digest:expected.common_git_dir_binding_digest}},base_slice_binding:{base_main_sha:HEAD,manifest_record_url:fixture.candidate_record_url,manifest_digest:manifest.manifest_digest,active_slice_id:'M2',active_slice_ordinal:2,slice_candidate_url:fixture.candidate_record_url,prior_manifest:{state:'bound',canonical_record_url:fixture.cumulative_successor.prior_canonical_record_url,manifest_digest:priorManifest.manifest_digest,prior_slice_count:2,prior_slice_entries_digest:digest([m0Entry,m1Entry])}},current_observed_ordered_paths_order:'repository_relative_posix_utf8_ascending_v1',current_observed_ordered_paths:observedPaths,current_observed_path_set_digest:digest(observedPaths),content_proofs:contentProofs,staged_path_state:{state:'none',ordered_paths:noPaths,ordered_paths_digest:digest(noPaths)},tracked_existing_delta:{state:'none',base_head_sha:HEAD,ordered_paths:noPaths,path_deltas:[],delta_digest:digest({base_head_sha:HEAD,ordered_paths:noPaths,path_deltas:[]})},m0_standalone_use:{state:'compliant',proof_mode:'canonical_historical_pass',result_record_url:url('5143245865'),validator_path:m0Paths[1],inventory_digest:m1Fixture.m0_historical_binding.inventory_digest,exact_ordered_paths:m0Paths,observed_path_count:2,cumulative_validator_mode:'cumulative_manifest_v1'}}
const observation={...observationBase,observation_digest:digest(observationBase)}
const admittedObservation=m1.validateCumulativeCompatibilityObservationV1(observation)
check(admittedObservation.kind==='accepted','M2 cumulative observation admitted')
const compatibility=m1.evaluateCumulativeCompatibilityV1(admittedManifest.value,admittedObservation.value)
check(compatibility.kind==='compatible'&&compatibility.verified_path_count===8,'M2 cumulative exact8 compatible')
check(m0Paths.every(path=>contentHashes[path]===m1Fixture.m0_historical_binding.paths.find(item=>item.path===path).byte_sha256),'M0 exact2 bytes preserved')
check(m1Paths.every(path=>contentHashes[path]===fixture.corpus_bindings[2].candidate_byte_sha256||path!==fixture.corpus_bindings[2].path),'M1 fixture bytes preserved')
check(git('rev-parse','HEAD')===HEAD&&git('branch','--show-current')==='codex/issue-221-core-consolidation','HEAD and branch exact')
check(git('diff','--cached','--name-only')===''&&git('diff','--name-only')==='','staged0 tracked0')
const untracked=git('ls-files','--others','--exclude-standard').split(/\r?\n/).filter(Boolean).map(path=>path.replaceAll('\\','/'))
check(jcs(ordered(untracked))===jcs(ordered(allPaths)),'exact cumulative 8 untracked paths')
const productionSources=await Promise.all(['src/continuous-orchestration/index.ts','src/automatic-gate-progression/index.ts','src/gate-status-publisher/index.ts'].map(path=>readFile(path,'utf8')))
check(productionSources.every(source=>!source.includes('shadow-equivalence-v1')),'M2 not imported by production')

await server.close()
console.log(JSON.stringify({result:'PASS',contract:'Continuous Orchestration M2 Shadow Equivalence',semantic_rows:'72/72',architecture_supplement_rows:'67/67',comparison_classes:'11/11',assertions:assertionCount,agp_executed_rows:56,agp_port_closed_results:agpPortCounts,agp_port_rejected_rows:agpPortRejectedRows,m2_adapter_classification:m2AdapterCounts,m2_adapter_origins:m2AdapterOrigins,cov_executed_rows:40,cov_pmcs_executed_rows:14,executed_corpus_binding_digest:executedCorpusBindingDigest,supplement_row_digests:supplementRows.map(({row_id,row_digest})=>({row_id,row_digest})),supplement_groups:supplementGroups,supplement_aggregate_digest:supplementAggregateDigest,supplement_matrix_digest:supplementMatrixDigest,existing_path_selected:true,shadow_only:true,blocking_on_mismatch:true,state_changed:false,write_attempt_count:0,transport_invoked:false,protected_action_invoked:false,cumulative_path_count:8,prior_manifest_digest:priorManifest.manifest_digest,prior_slice_entries_digest:digest([m0Entry,m1Entry]),m2_slice_digest:m2Entry.slice_digest,cumulative_digest:m2Entry.cumulative_digest,manifest_digest:manifest.manifest_digest}))
