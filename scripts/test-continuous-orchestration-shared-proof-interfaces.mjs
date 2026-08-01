import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile, realpath } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'vite'

const fixture = JSON.parse(await readFile('scripts/fixtures/continuous-orchestration-shared-proof-interfaces-v1.json', 'utf8'))
const server = await createServer({ configFile:false, cacheDir:join(tmpdir(),'sd-prompt-studio-issue221-m1-vite'), optimizeDeps:{noDiscovery:true}, server:{middlewareMode:true}, appType:'custom', logLevel:'error' })
const api = await server.ssrLoadModule('/src/continuous-orchestration/shared-proof-interfaces-v1.ts')
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
const seal = (value,key) => ({...value,[key]:digest(value)})
const ordered = values => [...values].sort((a,b)=>Buffer.from(a).compare(Buffer.from(b)))
const url = suffix => `https://github.com/whatrune/sd-prompt-studio/issues/221#issuecomment-${suffix}`
const prUrl = 'https://github.com/whatrune/sd-prompt-studio/pull/220'
const HEAD = fixture.authority_head
const D = label => sha(label)
const accepted = result => result.kind === 'accepted'
const rejected = result => result.kind === 'rejected'
const deepFrozen = value => !value || typeof value !== 'object' || (Object.isFrozen(value) && Object.values(value).every(deepFrozen))
const mutateUnknown = value => ({...clone(value), private_absolute_path:'must-not-echo'})
const mutateMissing = value => { const copy=clone(value); delete copy[Object.keys(copy)[0]]; return copy }
const noEcho = value => !/(?:["\s][A-Za-z]:[\\/]|Users[\\/]|resolved_git_dir|canonical_absolute_path|private_absolute_path)/i.test(JSON.stringify(value))
let assertionCount=0
const check = (condition,message) => { assertionCount+=1; assert.ok(condition,message) }

const sourceRef = {kind:'canonical_record',url:url('5143943504')}
const freshInput = (purpose='evaluation',observed_at='2026-07-31T14:30:00Z') => ({
  snapshot_version:api.FRESH_AUTHORITY_SNAPSHOT_V1_VERSION,purpose,task_id:fixture.task_id,repository:fixture.repository,
  assignment_revision:1,collected_from:[sourceRef],main_sha_or_null:HEAD,pr_url_or_null:null,pr_head_sha_or_null:null,
  pr_base_sha_or_null:null,pr_state:'not_applicable',check_set_digest_or_null:null,finding_set_digest:D('findings'),
  thread_set_digest:D('threads'),workspace_binding_digest_or_null:D('workspace'),workspace_state:'clean_bound',
  gsp_generation_or_null:null,gsp_body_digest_or_null:null,approval_consumption_digest_or_null:null,observed_at,
})
const fresh = api.deriveFreshAuthoritySnapshotShadowV1(freshInput()).value
const authoritySource = {
  source_type:'review_decision',source_ref:sourceRef,owner_contract_url:url('5143943504'),authority_class:'admission',
  authority_scope_digest:D('scope'),content_projection_digest:D('content'),task_id:fixture.task_id,repository:fixture.repository,
  subject_head_sha_or_null:HEAD,observed_at:'2026-07-31T14:29:59Z',admitted_field_ids:['decision'],admission_result:'accepted',
}
const bundleInput = {bundle_version:api.ADMITTED_AUTHORITY_BUNDLE_V1_VERSION,task_id:fixture.task_id,repository:fixture.repository,assignment_revision:1,scope_digest:D('scope'),sources:[authoritySource],fresh_snapshot:fresh,admission_result:'accepted'}
const bundle = api.deriveAdmittedAuthorityBundleShadowV1(bundleInput).value
const route = {transition_class:'implementation',role_id:'backend_implementer',action_id:'implement_m1',authority_record_url:url('5143956289'),allowed_scope_digest:D('scope'),independent_from_role_id_or_null:null}
const reviewRoute = {...route,transition_class:'implementation_review',role_id:'independent_implementation_reviewer',action_id:'review_m1',independent_from_role_id_or_null:'backend_implementer'}
const dispatchInput = {dispatch_intent_version:api.DISPATCH_INTENT_V1_VERSION,intent_kind:'role_dispatch',task_id:fixture.task_id,repository:fixture.repository,assignment_revision:1,decision_url:url('5143956289'),predecessor_canonical_url:url('5143943504'),route_binding:route,branch:fixture.branch,worktree_identity:fixture.logical_worktree_identity,pr_url_or_null:null,head_sha_or_null:HEAD,scope_digest:D('scope'),transport_authority:false,protected_action_authority:false}
const dispatch = api.deriveDispatchIntentShadowV1(dispatchInput).value
const candidatePaths = fixture.candidate_declared_paths
const candidateInput = {candidate_authority_ref_version:api.CANDIDATE_AUTHORITY_REF_V1_VERSION,task_id:fixture.task_id,repository:fixture.repository,candidate_id:'issue221-m1',aggregate_digest:D('aggregate'),ordered_repository_relative_paths:candidatePaths,base_sha:HEAD,working_head_sha:HEAD,result_handoff_url:url('5144000001'),publication_state:'unpublished',published_head_sha_or_null:null}
const unpublishedCandidate = api.deriveCandidateAuthorityRefShadowV1(candidateInput).value
const publishedCandidate = api.deriveCandidateAuthorityRefShadowV1({...candidateInput,publication_state:'published',published_head_sha_or_null:HEAD}).value
const evidenceUrls = ordered([url('5143943504'),url('5144000001'),url('5144000002'),url('5144000003'),url('5144000004'),url('5144000005'),url('5144000006'),url('5144000007'),url('5144000008')])
const completionInput = {completion_evidence_candidate_version:api.COMPLETION_EVIDENCE_CANDIDATE_V1_VERSION,task_id:fixture.task_id,repository:fixture.repository,pr_url:prUrl,candidate_authority_ref:publishedCandidate,exact_head_sha:HEAD,current_main_sha:HEAD,architecture_review_decision_url:url('5143943504'),implementation_review_decision_url:url('5144000002'),publication_review_decision_url:url('5144000003'),final_regression_result_url:url('5144000004'),operational_validation_result_url:url('5144000005'),completion_preflight_url:url('5144000006'),current_main_binding_url:url('5144000007'),post_merge_gsp_url:url('5144000008'),gsp_generation:1,gsp_head_sha:HEAD,gsp_gate_rows_digest:D('gsp'),blocking_finding_count:0,open_finding_count:0,unresolved_thread_count:0,finding_set_digest:D('findings'),thread_set_digest:D('threads'),evidence_urls:evidenceUrls,assembled_at:'2026-07-31T14:31:00Z',completion_authority:false}
const completion = api.deriveCompletionEvidenceCandidateShadowV1(completionInput).value
const projectionInput = {gate_projection_intent_version:api.GATE_PROJECTION_INTENT_V1_VERSION,task_id:fixture.task_id,repository:fixture.repository,assignment_revision:1,decision_url:url('5143943504'),authorized_metadata_role_id:'publication_manager',pr_url:prUrl,head_sha:HEAD,required_field_ids:['current_head','next_gate'],evidence_urls:ordered([url('5143943504'),url('5144000001')]),reason:'stale',expected_prior_generation_or_null:1,expected_gate_rows_digest_or_null:D('gsp'),must_verify_after_write:true,projection_authority:false,finding_closure_authority:false,approval_authority:false}
const projection = api.deriveGateProjectionIntentFromCovShadowV1(projectionInput).value
const actionSnapshot = api.deriveFreshAuthoritySnapshotShadowV1(freshInput('action_guard','2026-07-31T14:30:01Z')).value
const guardInput = {action_guard_proof_version:api.ACTION_GUARD_PROOF_V1_VERSION,task_id:fixture.task_id,repository:fixture.repository,assignment_revision:1,action_id:'metadata_sync',guard_scope:'non_protected_transport',evaluation_snapshot_digest:fresh.snapshot_digest,action_snapshot:actionSnapshot,approval_record_url_or_null:null,one_use:true,consumption_state:'unconsumed',guarded_at:actionSnapshot.observed_at,execution_authority:false}
const guard = api.deriveActionGuardProofShadowV1(guardInput,fresh).value
const profileInput = {repair_budget_profile_version:api.REPAIR_BUDGET_PROFILE_V1_VERSION,task_id:fixture.task_id,repository:fixture.repository,assignment_revision:1,semantic_epoch_id:D('epoch'),authority_record_url:url('5143943504'),allowed_scope_digest:D('scope'),attempt_limits:{technical:3,architecture:3,metadata:3,delivery:3},cycle_limits:{checkpoint_after_decisions:32,stop_after_decisions:64}}
const profile = api.deriveRepairBudgetProfileShadowV1(profileInput).value
const cycleLedger = {cycle_ledger_version:'cycle_ledger_v1',semantic_counter_epoch_id:D('epoch'),progress_epoch:0,max_gate_ordinal_reached:0,decision_count_without_progress:0,checkpoint_emitted_without_progress:false,signature_occurrences:[],last_progress_record_url:url('5143943504')}
const deliveryKey=D('delivery')
const ledgerInput = {repair_attempt_ledger_version:api.REPAIR_ATTEMPT_LEDGER_V1_VERSION,task_id:fixture.task_id,repository:fixture.repository,assignment_revision:1,semantic_epoch_id:D('epoch'),profile_digest:profile.profile_digest,entries:[{entry_kind:'delivery',stable_finding_id:deliveryKey,finding_domain:'publication',attempt_class:'delivery',scope_digest:D('scope'),counter_key:deliveryKey,attempt_count:0,max_attempts:3,state:'pending',evidence_urls:[],source_counter:{idempotency_key:deliveryKey,delivery_count:0,last_completion_url_or_null:null,state:'pending'}}],cycle_ledger:cycleLedger}
const ledger = api.deriveRepairAttemptLedgerShadowV1(ledgerInput).value
const agpRecommend = {contract_version:'automatic-gate-progression-evaluation-result-v2',task_id:fixture.task_id,evaluated_at:'2026-07-31T14:30:00Z',input_fingerprint:D('input'),precedence_trace:['recommend'],gate_status_requirement:{required:false},kind:'recommend_next_role',target_role:'backend_implementer',next_action:'implement_m1',predecessor_canonical_url:url('5143943504'),target_head:HEAD,same_task_id:fixture.task_id,idempotency_key:D('agp')}
const port = api.deriveProgressionDecisionPortShadowV1(agpRecommend).value

const modulePath='src/continuous-orchestration/shared-proof-interfaces-v1.ts'
const fixturePath='scripts/fixtures/continuous-orchestration-shared-proof-interfaces-v1.json'
const testPath='scripts/test-continuous-orchestration-shared-proof-interfaces.mjs'
const contentHashes = Object.fromEntries(await Promise.all(fixture.candidate_declared_paths.map(async path=>[path,sha(await readFile(path))])))
const entry = (slice_id,ordinal,slice_candidate_url,paths,prior_slice_digest_or_null,prior_cumulative_digest_or_null) => {
  const base={slice_id,ordinal,slice_candidate_url,added_paths:paths,added_path_count:paths.length,content_binding:{kind:'path_byte_sha256',path_bindings:paths.map(path=>({path,byte_sha256:contentHashes[path]}))},prior_slice_digest_or_null,cumulative_paths_after_slice:ordinal===0?[...paths]:[...fixture.candidate_declared_paths.slice(0,2),...paths]}
  const slice_digest=digest(base)
  return {...base,slice_digest,cumulative_digest:digest({prior_cumulative_digest_or_null,slice_digest,cumulative_paths_after_slice:base.cumulative_paths_after_slice})}
}
const m0Entry=entry('M0',0,url('5142664055'),fixture.candidate_declared_paths.slice(0,2),null,null)
const m1Entry=entry('M1',1,url('5143469032'),fixture.candidate_declared_paths.slice(2),m0Entry.slice_digest,m0Entry.cumulative_digest)
const manifestBase={schema_version:api.CUMULATIVE_SLICE_MANIFEST_V1_VERSION,task_id:fixture.task_id,repository:fixture.repository,authority_head_sha:HEAD,branch:fixture.branch,worktree_identity:fixture.logical_worktree_identity,manifest_mode:'m1_bootstrap',active_slice_id:'M1',active_slice_ordinal:1,m0_standalone_evidence:{semantics:'standalone_exact2_only',candidate_url:url('5142664055'),completion_preflight_url:url('5143231842'),completion_result_url:url('5143245865'),validator_path:fixture.m0_historical_binding.paths[1].path,inventory_path:fixture.m0_historical_binding.paths[0].path,inventory_digest:fixture.m0_historical_binding.inventory_digest,exact_paths:fixture.m0_historical_binding.paths,path_count:2},prior_manifest:{state:'none_m1_bootstrap'},slices:[m0Entry,m1Entry],cumulative_paths:fixture.candidate_declared_paths,cumulative_path_count:5}
const manifest={...manifestBase,manifest_digest:digest(manifestBase)}
const admittedManifest=api.validateCumulativeSliceManifestV1(manifest)

const publicContext={task_id:fixture.task_id,repository:fixture.repository,authority_record_url:url('5144802744'),logical_worktree_identity:fixture.logical_worktree_identity,branch:fixture.branch,head_sha:HEAD}
const opaque=(domain,privatePreimage)=>sha(`${domain}\0${jcs({public_context:publicContext,private_preimage:privatePreimage})}`)
const git=(...args)=>execFileSync('git',args,{cwd:process.cwd(),encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()
const gitBytes=(...args)=>execFileSync('git',args,{cwd:process.cwd(),stdio:['ignore','pipe','pipe']})
const gitPaths=(...args)=>git(...args).split('\0').filter(Boolean).map(path=>path.replaceAll('\\','/')).sort((a,b)=>Buffer.from(a).compare(Buffer.from(b)))
const admittedExpectedIdentity=api.validateExpectedWorktreeIdentityBindingV1(fixture.privacy_contract.approved_expected_identity_binding)
assert.equal(admittedExpectedIdentity.kind,'accepted')
const collectTrackedDeltaProof=async path=>({path,base_byte_sha256:sha(gitBytes('show',`${HEAD}:${path}`)),observed_byte_sha256:sha(await readFile(path))})
const collectFocusedObservation=async(manifestValue,testInventory={})=>{
  try{
    const configuredWorktree=await realpath(process.cwd())
    const observedWorktree=await realpath(git('rev-parse','--show-toplevel'))
    const gitDir=await realpath(git('rev-parse','--git-dir'))
    const commonGitDir=await realpath(git('rev-parse','--git-common-dir'))
    const branch=git('branch','--show-current'),head=git('rev-parse','HEAD')
    const worktreeBinding=opaque(fixture.privacy_contract.opaque_binding_domains[0],{configured_worktree:configuredWorktree,observed_worktree:observedWorktree})
    const gitDirBinding=opaque(fixture.privacy_contract.opaque_binding_domains[1],{git_dir:gitDir})
    const commonGitDirBinding=opaque(fixture.privacy_contract.opaque_binding_domains[2],{common_git_dir:commonGitDir})
    const expected=admittedExpectedIdentity.value
    const observed={logical_worktree_identity:fixture.logical_worktree_identity,branch,head_sha:head,worktree_path_binding_digest:worktreeBinding,git_dir_binding_digest:gitDirBinding,common_git_dir_binding_digest:commonGitDirBinding,...testInventory.observedBindingOverride}
    const stagedPaths=testInventory.stagedPaths??gitPaths('diff','--cached','--name-only','-z')
    const trackedPaths=testInventory.trackedPaths??gitPaths('diff','--name-only','-z',HEAD,'--')
    const untrackedPaths=testInventory.untrackedPaths??gitPaths('ls-files','--others','--exclude-standard','-z')
    const deltaInventory=ordered([...new Set([...stagedPaths,...trackedPaths,...untrackedPaths])])
    if(deltaInventory.some(path=>!manifestValue.cumulative_paths.includes(path)))throw new Error('collector inventory outside manifest')
    const observedPaths=ordered(deltaInventory)
    if(jcs(observedPaths)!==jcs(fixture.canonical_observation_paths)||branch!==fixture.branch||head!==HEAD||stagedPaths.length)throw new Error('collector binding mismatch')
    const proofs=await Promise.all(observedPaths.map(async path=>{const bytes=await readFile(path);return{kind:'path_byte_sha256',path,byte_length:bytes.byteLength,byte_sha256:sha(bytes)}}))
    const noPaths=[]
    const trackedDeltas=await Promise.all(trackedPaths.map(collectTrackedDeltaProof))
    const trackedState=trackedDeltas.length?{state:'present',base_head_sha:HEAD,ordered_paths:trackedDeltas.map(item=>item.path),path_deltas:trackedDeltas}:{state:'none',base_head_sha:HEAD,ordered_paths:noPaths,path_deltas:[]}
    const observationBase={observation_version:api.CUMULATIVE_COMPATIBILITY_OBSERVATION_V1_VERSION,task_id:fixture.task_id,repository:fixture.repository,collected_at:'2026-07-31T14:32:00Z',identity:{authority_head_sha:HEAD,expected,observed},base_slice_binding:{base_main_sha:HEAD,manifest_record_url:url('5144534078'),manifest_digest:manifestValue.manifest_digest,active_slice_id:'M1',active_slice_ordinal:1,slice_candidate_url:url('5143469032'),prior_manifest:{state:'none_m1_bootstrap'}},current_observed_ordered_paths_order:'repository_relative_posix_utf8_ascending_v1',current_observed_ordered_paths:observedPaths,current_observed_path_set_digest:digest(observedPaths),content_proofs:proofs,staged_path_state:{state:'none',ordered_paths:noPaths,ordered_paths_digest:digest(noPaths)},tracked_existing_delta:{...trackedState,delta_digest:digest({base_head_sha:HEAD,ordered_paths:trackedState.ordered_paths,path_deltas:trackedState.path_deltas})},m0_standalone_use:{state:'compliant',proof_mode:'canonical_historical_pass',result_record_url:url('5143245865'),validator_path:fixture.m0_historical_binding.paths[1].path,inventory_digest:fixture.m0_historical_binding.inventory_digest,exact_ordered_paths:fixture.candidate_declared_paths.slice(0,2),observed_path_count:2,cumulative_validator_mode:'cumulative_manifest_v1'}}
    const value={...observationBase,observation_digest:digest(observationBase)}
    const admitted=api.validateCumulativeCompatibilityObservationV1(value)
    if(admitted.kind!=='accepted')throw new Error('collector observation rejected')
    return {value,admitted}
  }catch{throw new Error('focused compatibility collector failed')}
}
const collected=await collectFocusedObservation(manifest)
const observation=collected.value
const admittedObservation=collected.admitted
const compatibility=api.evaluateCumulativeCompatibilityV1(admittedManifest.value,admittedObservation.value)

const validators=[
  [api.validateFreshAuthoritySnapshotV1,fresh], [api.validateAdmittedAuthorityBundleV1,bundle], [api.validateRouteBindingV1,route],
  [api.validateDispatchIntentV1,dispatch], [api.validateCandidateAuthorityRefV1,unpublishedCandidate], [api.validateCompletionEvidenceCandidateV1,completion],
  [api.validateGateProjectionIntentV1,projection], [value=>api.validateActionGuardProofV1(value,fresh),guard], [api.validateRepairBudgetProfileV1,profile],
  [api.validateRepairAttemptLedgerV1,ledger], [api.validateProgressionDecisionPortV1,port],
]
const groupChecks={
  'M1-SCHEMA':[], 'M1-AUTH':[], 'M1-ROUTE':[], 'M1-CAND':[], 'M1-COMP':[],
  'M1-PROJ':[], 'M1-FRESH':[], 'M1-BUDGET':[], 'M1-PORT':[], 'M1-REG':[],
}
for(const [validator,value] of validators){
  groupChecks['M1-SCHEMA'].push(()=>accepted(validator(value)))
  groupChecks['M1-SCHEMA'].push(()=>{const result=validator(mutateUnknown(value));return rejected(result)&&result.rejection.path.includes('public.unknown')&&noEcho(result)})
  groupChecks['M1-SCHEMA'].push(()=>rejected(validator(mutateMissing(value))))
}
groupChecks['M1-AUTH'].push(
  ()=>accepted(api.validateFreshAuthoritySnapshotV1(fresh)),()=>accepted(api.validateAdmittedAuthorityBundleV1(bundle)),
  ()=>deepFrozen(api.validateAdmittedAuthorityBundleV1(bundle)),()=>jcs(api.validateAdmittedAuthorityBundleV1(bundle))===jcs(api.validateAdmittedAuthorityBundleV1(clone(bundle))),
  ()=>{const x=clone(bundle);x.sources[0].task_id='wrong';return rejected(api.validateAdmittedAuthorityBundleV1(x))},
  ()=>{const x=clone(bundle);x.sources.push(clone(x.sources[0]));return rejected(api.validateAdmittedAuthorityBundleV1(x))},
  ()=>bundle.fresh_snapshot.purpose==='evaluation',()=>bundle.sources[0].observed_at<=bundle.fresh_snapshot.observed_at,
  ()=>bundle.sources[0].authority_scope_digest===bundle.scope_digest,()=>bundle.bundle_digest===digest(without(bundle,'bundle_digest')),
  ()=>noEcho(bundle),()=>Object.isFrozen(bundle.sources[0]),
)
groupChecks['M1-ROUTE'].push(
  ()=>accepted(api.validateRouteBindingV1(route)),()=>accepted(api.validateDispatchIntentV1(dispatch)),
  ()=>accepted(api.deriveDispatchIntentShadowV1({...dispatchInput,intent_kind:'independent_review_dispatch',route_binding:reviewRoute})),
  ()=>{const x=clone(dispatch);x.scope_digest=D('other');return rejected(api.validateDispatchIntentV1(x))},
  ()=>{const x=clone(dispatch);x.route_binding.independent_from_role_id_or_null='other';return rejected(api.validateDispatchIntentV1(x))},
  ()=>dispatch.transport_authority===false,()=>dispatch.protected_action_authority===false,
  ()=>dispatch.idempotency_key===api.deriveDispatchIntentShadowV1(dispatchInput).value.idempotency_key,
  ()=>dispatch.intent_digest===digest(without(dispatch,'intent_digest')),()=>dispatch.branch===fixture.branch,
  ()=>dispatch.worktree_identity===fixture.logical_worktree_identity,()=>noEcho(dispatch),
)
groupChecks['M1-CAND'].push(
  ()=>accepted(api.validateCandidateAuthorityRefV1(unpublishedCandidate)),()=>accepted(api.validateCandidateAuthorityRefV1(publishedCandidate)),
  ()=>unpublishedCandidate.published_head_sha_or_null===null,()=>publishedCandidate.published_head_sha_or_null===HEAD,
  ()=>{const x=clone(unpublishedCandidate);x.ordered_repository_relative_paths.push(x.ordered_repository_relative_paths[0]);return rejected(api.validateCandidateAuthorityRefV1(x))},
  ()=>{const x=clone(unpublishedCandidate);x.ordered_repository_relative_paths.reverse();return rejected(api.validateCandidateAuthorityRefV1(x))},
  ()=>!JSON.stringify(unpublishedCandidate).includes('byte_sha256'),()=>unpublishedCandidate.candidate_identity_digest===digest({task_id:fixture.task_id,repository:fixture.repository,base_sha:HEAD,working_head_sha:HEAD,ordered_repository_relative_paths:candidatePaths,aggregate_digest:D('aggregate')}),
  ()=>unpublishedCandidate.ref_digest===digest(without(unpublishedCandidate,'ref_digest')),()=>deepFrozen(unpublishedCandidate),
)
groupChecks['M1-COMP'].push(
  ()=>accepted(api.validateCompletionEvidenceCandidateV1(completion)),()=>completion.blocking_finding_count===0,
  ()=>completion.open_finding_count===0,()=>completion.unresolved_thread_count===0,()=>completion.completion_authority===false,
  ()=>completion.candidate_authority_ref.publication_state==='published',()=>completion.candidate_authority_ref.published_head_sha_or_null===completion.exact_head_sha,
  ()=>completion.gsp_head_sha===completion.current_main_sha,()=>completion.evidence_urls.includes(completion.candidate_authority_ref.result_handoff_url),
  ()=>{const x=clone(completion);x.blocking_finding_count=1;return rejected(api.validateCompletionEvidenceCandidateV1(x))},
  ()=>{const x=clone(completion);x.gsp_head_sha=D('bad').slice(0,40);return rejected(api.validateCompletionEvidenceCandidateV1(x))},
  ()=>{const x=clone(completion);x.evidence_urls=x.evidence_urls.filter(item=>item!==x.final_regression_result_url);return rejected(api.validateCompletionEvidenceCandidateV1(x))},
  ()=>completion.candidate_digest===digest(without(completion,'candidate_digest')),()=>deepFrozen(completion),
)
groupChecks['M1-PROJ'].push(
  ()=>accepted(api.validateGateProjectionIntentV1(projection)),()=>accepted(api.deriveGateProjectionIntentFromAgpShadowV1(projectionInput)),
  ()=>jcs(api.deriveGateProjectionIntentFromAgpShadowV1(projectionInput).value)===jcs(api.deriveGateProjectionIntentFromCovShadowV1(projectionInput).value),
  ...['missing','stale','conflicting','historical_at_prior_head'].map(reason=>()=>accepted(api.deriveGateProjectionIntentFromCovShadowV1({...projectionInput,reason}))),
  ()=>projection.must_verify_after_write===true,()=>projection.projection_authority===false,()=>projection.finding_closure_authority===false,
  ()=>projection.approval_authority===false,()=>projection.intent_digest===digest(without(projection,'intent_digest')),
)
groupChecks['M1-FRESH'].push(
  ()=>fresh.purpose==='evaluation',()=>actionSnapshot.purpose==='action_guard',()=>guard.action_snapshot.snapshot_digest!==guard.evaluation_snapshot_digest,
  ()=>accepted(api.validateActionGuardProofV1(guard,fresh)),()=>guard.guarded_at===actionSnapshot.observed_at,
  ()=>Date.parse(actionSnapshot.observed_at)>Date.parse(fresh.observed_at),()=>guard.execution_authority===false,()=>guard.one_use===true,
  ()=>{const x=clone(guard);x.action_snapshot.pr_state='open_draft';x.action_snapshot.snapshot_digest=digest(without(x.action_snapshot,'snapshot_digest'));return rejected(api.validateActionGuardProofV1(x,fresh))},
  ()=>{const x=clone(guard);x.action_snapshot.finding_set_digest=D('drift');x.action_snapshot.snapshot_digest=digest(without(x.action_snapshot,'snapshot_digest'));return rejected(api.validateActionGuardProofV1(x,fresh))},
  ()=>{const x=clone(guard);x.action_snapshot.thread_set_digest=D('drift');x.action_snapshot.snapshot_digest=digest(without(x.action_snapshot,'snapshot_digest'));return rejected(api.validateActionGuardProofV1(x,fresh))},
  ()=>{const x=clone(guard);x.action_snapshot.workspace_binding_digest_or_null=D('drift');x.action_snapshot.snapshot_digest=digest(without(x.action_snapshot,'snapshot_digest'));return rejected(api.validateActionGuardProofV1(x,fresh))},
  ()=>{const x=clone(guard);x.guard_scope='protected_action';return rejected(api.validateActionGuardProofV1(x,fresh))},
  ()=>guard.proof_digest===digest(without(guard,'proof_digest')),()=>deepFrozen(guard),()=>noEcho(guard),
)
groupChecks['M1-BUDGET'].push(
  ()=>accepted(api.validateRepairBudgetProfileV1(profile)),()=>accepted(api.validateRepairAttemptLedgerV1(ledger)),
  ()=>profile.attempt_limits.technical===3,()=>profile.attempt_limits.architecture===3,()=>profile.attempt_limits.metadata===3,()=>profile.attempt_limits.delivery===3,
  ()=>profile.cycle_limits.checkpoint_after_decisions===32,()=>profile.cycle_limits.stop_after_decisions===64,
  ()=>ledger.semantic_epoch_id===profile.semantic_epoch_id,()=>ledger.profile_digest===profile.profile_digest,
  ()=>ledger.entries[0].stable_finding_id===ledger.entries[0].source_counter.idempotency_key,
  ()=>{const x=clone(profile);x.attempt_limits.technical=4;return rejected(api.validateRepairBudgetProfileV1(x))},
  ()=>{const x=clone(ledger);x.entries[0].attempt_count=4;return rejected(api.validateRepairAttemptLedgerV1(x))},
  ()=>{const x=clone(ledger);x.entries[0].state='exhausted';x.entries[0].source_counter.state='exhausted';x.ledger_digest=digest(without(x,'ledger_digest'));return rejected(api.validateRepairAttemptLedgerV1(x))},
  ()=>profile.profile_digest===digest(without(profile,'profile_digest')),()=>ledger.ledger_digest===digest(without(ledger,'ledger_digest')),
  ()=>deepFrozen(profile),()=>deepFrozen(ledger),
)
const agpVariants=[
  agpRecommend,
  {...agpRecommend,kind:'wait_for_protected_action',protected_action:'ready_for_review'},
  {...agpRecommend,kind:'require_gate_status_update'},
  {...agpRecommend,kind:'invalidate_approval',invalidation_reason:'head_drift'},
  {...agpRecommend,kind:'stop',stop_condition:'blocking_finding_recurrence',execution_stop_reason:'architecture_gap',recovery_owner:'architect_team'},
  {...agpRecommend,kind:'no_transition'},
]
groupChecks['M1-PORT'].push(
  ...agpVariants.map((value,index)=>()=>accepted(api.deriveProgressionDecisionPortShadowV1(value,index===5?{future_event_type:'review_decision_published',future_event_role_id:'architect_team'}:undefined))),
  ()=>port.shadow_only===true,()=>port.transport_invoked===false,()=>port.source_result_digest===digest(agpRecommend),
  ()=>port.port_digest===digest(without(port,'port_digest')),()=>jcs(api.deriveProgressionDecisionPortShadowV1(agpRecommend))===jcs(api.deriveProgressionDecisionPortShadowV1(clone(agpRecommend))),
  ()=>rejected(api.deriveProgressionDecisionPortShadowV1(agpVariants[5])),
)
groupChecks['M1-REG'].push(
  ()=>accepted(admittedManifest),()=>accepted(admittedObservation),()=>compatibility.kind==='compatible',
  ()=>compatibility.verified_path_count===5,()=>sameSet(fixture.candidate_declared_paths,fixture.canonical_observation_paths),
  ()=>fixture.m0_historical_binding.paths.every(item=>contentHashes[item.path]===item.byte_sha256),
  ()=>noEcho({manifest,observation,compatibility}),
  async()=>{const sources=await Promise.all(['src/continuous-orchestration/index.ts','src/automatic-gate-progression/index.ts','src/gate-status-publisher/index.ts','src/architecture-repair-loop/index.ts'].map(path=>readFile(path)));return sources.every(source=>!source.toString().includes('shared-proof-interfaces-v1'))},
)
function sameSet(a,b){return a.length===b.length&&a.every(item=>b.includes(item))}

for(const group of fixture.semantic_groups){
  const checks=groupChecks[group.group_id]
  check(checks.length===group.row_count,`${group.group_id} frozen count`)
  for(let index=0;index<checks.length;index+=1)check(await checks[index](),`${group.group_id}-${String(index+1).padStart(3,'0')}`)
}
check(fixture.semantic_groups.reduce((sum,group)=>sum+group.row_count,0)===147,'147 semantic rows')

for(const [validator,value] of validators){
  const unknown=validator(mutateUnknown(value))
  check(rejected(unknown)&&unknown.rejection.path.includes('public.unknown')&&noEcho(unknown),'generated unknown key no echo')
  for(const key of Object.keys(value)){
    const copy=clone(value);delete copy[key]
    check(rejected(validator(copy)),`generated missing ${key}`)
  }
}

const resealObservation=(source,mutator=()=>{})=>{const base=clone(source);mutator(base);base.observation_digest=digest(without(base,'observation_digest'));return base}
const evaluateObservation=(source,mutator=()=>{},manifestAdmission=admittedManifest)=>{const base=resealObservation(source,mutator);const admitted=api.validateCumulativeCompatibilityObservationV1(base);assert.equal(admitted.kind,'accepted');return api.evaluateCumulativeCompatibilityV1(manifestAdmission.value,admitted.value)}
const observationDrift=mutator=>evaluateObservation(observation,mutator)
check(observationDrift(x=>{x.identity.observed.worktree_path_binding_digest=D('drift')}).negative_id==='B-221-M1-COMPAT-01-N13','N13 worktree binding')
check(observationDrift(x=>{x.staged_path_state={state:'present',ordered_paths:[modulePath],ordered_paths_digest:digest([modulePath])}}).negative_id==='B-221-M1-COMPAT-01-N14','N14 staged')
check(observationDrift(x=>{x.m0_standalone_use={state:'m0_applied_to_cumulative',validator_path:fixture.m0_historical_binding.paths[1].path,observed_ordered_paths:fixture.canonical_observation_paths,observed_path_count:5,cumulative_validator_mode:'m0_standalone_misapplied'}}).negative_id==='B-221-M1-COMPAT-01-N15','N15 M0 misapplication')
check(observationDrift(x=>{x.content_proofs.find(p=>p.kind==='path_byte_sha256'&&p.path===fixture.m0_historical_binding.paths[0].path).byte_sha256=D('drift')}).negative_id==='B-221-M1-COMPAT-01-N01','N01 M0 bytes')
check(fixture.cumulative_compatibility.negative_ids.length===16,'N01-N16 frozen')
check(fixture.cumulative_compatibility.negative_precedence.join(',')==='B-221-M1-COMPAT-01-N13,B-221-M1-COMPAT-01-N14,B-221-M1-COMPAT-01-N15,B-221-M1-COMPAT-01-N11,B-221-M1-COMPAT-01-N09,B-221-M1-COMPAT-01-N10,B-221-M1-COMPAT-01-N07,B-221-M1-COMPAT-01-N08,B-221-M1-COMPAT-01-N05,B-221-M1-COMPAT-01-N02,B-221-M1-COMPAT-01-N03,B-221-M1-COMPAT-01-N04,B-221-M1-COMPAT-01-N01,B-221-M1-COMPAT-01-N06,B-221-M1-COMPAT-01-N16,B-221-M1-COMPAT-01-N12','negative precedence frozen')

const m1Paths=fixture.candidate_declared_paths.slice(2)
const mutatePathProof=(value,path,label=`drift:${path}`)=>{value.content_proofs.find(proof=>proof.kind==='path_byte_sha256'&&proof.path===path).byte_sha256=D(label)}
const aggregateSubstitution=(value,path)=>{value.content_proofs=value.content_proofs.filter(proof=>!(proof.kind==='path_byte_sha256'&&proof.path===path));value.content_proofs.push({kind:'approved_aggregate',approval_record_url:url('5144571074'),approval_content_projection_digest:D(`approval:${path}`),ordered_paths:[path],ordered_paths_digest:digest([path]),aggregate_digest:D(`aggregate:${path}`)})}
const removeObservedPath=(value,path)=>{value.current_observed_ordered_paths=value.current_observed_ordered_paths.filter(item=>item!==path);value.current_observed_path_set_digest=digest(value.current_observed_ordered_paths);value.content_proofs=value.content_proofs.filter(proof=>proof.kind!=='path_byte_sha256'||proof.path!==path)}
const addObservedPath=(value,path)=>{value.current_observed_ordered_paths=ordered([...value.current_observed_ordered_paths,path]);value.current_observed_path_set_digest=digest(value.current_observed_ordered_paths);value.content_proofs.push({kind:'path_byte_sha256',path,byte_length:1,byte_sha256:D(path)})}
const successor=(activeOrdinal)=>{
  const slices=[clone(m0Entry),clone(m1Entry)]
  let cumulative=[...fixture.candidate_declared_paths]
  for(let ordinal=2;ordinal<=activeOrdinal;ordinal+=1){
    const path=`scripts/fixtures/issue221-m${ordinal}-proof.json`,prior=slices.at(-1)
    const base={slice_id:`M${ordinal}`,ordinal,slice_candidate_url:url(String(5144600000+ordinal)),added_paths:[path],added_path_count:1,content_binding:{kind:'path_byte_sha256',path_bindings:[{path,byte_sha256:D(`expected:${path}`)}]},prior_slice_digest_or_null:prior.slice_digest,cumulative_paths_after_slice:[...cumulative,path]}
    const slice_digest=digest(base),next={...base,slice_digest,cumulative_digest:digest({prior_cumulative_digest_or_null:prior.cumulative_digest,slice_digest,cumulative_paths_after_slice:base.cumulative_paths_after_slice})}
    slices.push(next);cumulative=next.cumulative_paths_after_slice
  }
  const priorManifestDigest=D(`prior-manifest:M${activeOrdinal}`)
  const manifestBaseValue={...clone(manifestBase),manifest_mode:'successor',active_slice_id:`M${activeOrdinal}`,active_slice_ordinal:activeOrdinal,prior_manifest:{state:'bound',canonical_record_url:url(String(5144610000+activeOrdinal)),manifest_digest:priorManifestDigest},slices,cumulative_paths:cumulative,cumulative_path_count:cumulative.length}
  const manifestValue={...manifestBaseValue,manifest_digest:digest(manifestBaseValue)}
  const admittedManifestValue=api.validateCumulativeSliceManifestV1(manifestValue);assert.equal(admittedManifestValue.kind,'accepted')
  const pathProofs=slices.flatMap(entry=>entry.content_binding.kind==='path_byte_sha256'?entry.content_binding.path_bindings.map(binding=>({kind:'path_byte_sha256',path:binding.path,byte_length:1,byte_sha256:binding.byte_sha256})):[])
  const orderedPaths=ordered(cumulative)
  const observationBaseValue={...clone(observation),base_slice_binding:{base_main_sha:HEAD,manifest_record_url:url(String(5144620000+activeOrdinal)),manifest_digest:manifestValue.manifest_digest,active_slice_id:`M${activeOrdinal}`,active_slice_ordinal:activeOrdinal,slice_candidate_url:slices.at(-1).slice_candidate_url,prior_manifest:{state:'bound',canonical_record_url:manifestValue.prior_manifest.canonical_record_url,manifest_digest:priorManifestDigest,prior_slice_count:activeOrdinal,prior_slice_entries_digest:digest(slices.slice(0,activeOrdinal))}},current_observed_ordered_paths:orderedPaths,current_observed_path_set_digest:digest(orderedPaths),content_proofs:pathProofs}
  observationBaseValue.observation_digest=digest(without(observationBaseValue,'observation_digest'))
  const admittedObservationValue=api.validateCumulativeCompatibilityObservationV1(observationBaseValue);assert.equal(admittedObservationValue.kind,'accepted')
  return{manifest:manifestValue,admittedManifest:admittedManifestValue,observation:observationBaseValue,admittedObservation:admittedObservationValue}
}
const successors=Object.fromEntries([2,3,4,5,6].map(ordinal=>[ordinal,successor(ordinal)]))
const driftResult=(context,path,label)=>evaluateObservation(context.observation,value=>mutatePathProof(value,path,label),context.admittedManifest)
const activePath=context=>context.manifest.slices.at(-1).added_paths[0]
const priorPath=(context,ordinal)=>context.manifest.slices[ordinal].added_paths[0]
const exactEvidenceKeys=['pointer','detail','target_slice','repository_relative_path','expected_byte_sha256','observed_byte_sha256','cumulative_manifest_binding','drift_count','drift_set_digest','evidence_digest']
const sourceText=await readFile(modulePath,'utf8')
const a04Checks=[
  ()=>compatibility.kind==='compatible',
  ()=>m1Paths.every(path=>{const result=observationDrift(value=>mutatePathProof(value,path));return result.kind==='incompatible'&&result.negative_id==='B-221-M1-COMPAT-01-N16'&&result.negative_literal==='active_slice_path_byte_drift'&&result.evidence.repository_relative_path===path}),
  ()=>{const result=observationDrift(value=>{mutatePathProof(value,m1Paths[0]);mutatePathProof(value,m1Paths[2])});return result.negative_id==='B-221-M1-COMPAT-01-N16'&&result.evidence.drift_count===2&&result.evidence.repository_relative_path===m1Paths[0]},
  ()=>observationDrift(value=>m1Paths.forEach(path=>mutatePathProof(value,path))).evidence.drift_count===3,
  ()=>{const first=observationDrift(value=>{mutatePathProof(value,m1Paths[0]);mutatePathProof(value,m1Paths[2])});const reordered=evaluateObservation(observation,value=>{mutatePathProof(value,m1Paths[0]);mutatePathProof(value,m1Paths[2]);value.content_proofs.reverse()});return jcs(first.evidence)===jcs(reordered.evidence)&&first.negative_id===reordered.negative_id},
  ()=>observationDrift(value=>{mutatePathProof(value,fixture.m0_historical_binding.paths[0].path);mutatePathProof(value,m1Paths[0])}).negative_id==='B-221-M1-COMPAT-01-N01',
  ()=>evaluateObservation(observation,value=>{removeObservedPath(value,m1Paths[2]);mutatePathProof(value,m1Paths[0])}).negative_id==='B-221-M1-COMPAT-01-N02',
  ()=>evaluateObservation(observation,value=>{addObservedPath(value,'scripts/fixtures/issue221-extra.json');mutatePathProof(value,m1Paths[0])}).negative_id==='B-221-M1-COMPAT-01-N03',
  ()=>{const bad=resealObservation(observation,value=>{mutatePathProof(value,m1Paths[0]);value.current_observed_ordered_paths.reverse();value.current_observed_path_set_digest=digest(value.current_observed_ordered_paths)});const forged={admission_version:'admitted_cumulative_compatibility_observation_v1',admission_result:'accepted',observation:bad,admitted_observation_digest:bad.observation_digest};return api.evaluateCumulativeCompatibilityV1(admittedManifest.value,forged).negative_id==='B-221-M1-COMPAT-01-N04'},
  ()=>evaluateObservation(observation,value=>{mutatePathProof(value,m1Paths[0]);aggregateSubstitution(value,m1Paths[1])}).negative_id==='B-221-M1-COMPAT-01-N16',
  ()=>evaluateObservation(observation,value=>aggregateSubstitution(value,m1Paths[0])).negative_id==='B-221-M1-COMPAT-01-N12',
  ()=>[2,3,4,5,6].every(ordinal=>driftResult(successors[ordinal],activePath(successors[ordinal]),`active:${ordinal}`).negative_id==='B-221-M1-COMPAT-01-N16'),
  ()=>driftResult(successors[2],priorPath(successors[2],1),'prior:m1').negative_id==='B-221-M1-COMPAT-01-N06',
  ()=>driftResult(successors[3],priorPath(successors[3],2),'prior:m2').negative_id==='B-221-M1-COMPAT-01-N06',
  ()=>observationDrift(value=>mutatePathProof(value,m1Paths[0])).negative_id==='B-221-M1-COMPAT-01-N16'&&[2,3,4,5,6].every(ordinal=>driftResult(successors[ordinal],activePath(successors[ordinal]),`active-all:${ordinal}`).negative_id==='B-221-M1-COMPAT-01-N16'),
  ()=>[2,3,4,5,6].every(active=>Array.from({length:active-1},(_,index)=>index+1).every(prior=>driftResult(successors[active],priorPath(successors[active],prior),`prior:${active}:${prior}`).negative_id==='B-221-M1-COMPAT-01-N06')),
  ()=>[observation,...Object.values(successors).map(context=>context.observation)].every((source,index)=>evaluateObservation(source,value=>mutatePathProof(value,fixture.m0_historical_binding.paths[0].path),index===0?admittedManifest:Object.values(successors)[index-1].admittedManifest).negative_id==='B-221-M1-COMPAT-01-N01'),
  ()=>{const result=driftResult(successors[3],priorPath(successors[3],1),'prior-entry');return result.negative_id==='B-221-M1-COMPAT-01-N06'&&result.evidence.target_slice.ordinal===1},
  ()=>{const result=observationDrift(value=>{mutatePathProof(value,m1Paths[0]);mutatePathProof(value,m1Paths[2])});const ev=result.evidence,binding=manifest.slices[1].content_binding.path_bindings[0];return Object.keys(ev).join(',')===exactEvidenceKeys.join(',')&&ev.evidence_digest===digest(without(ev,'evidence_digest'))&&ev.cumulative_manifest_binding.path_binding_digest===digest({slice_id:'M1',ordinal:1,target_slice_digest:manifest.slices[1].slice_digest,path_binding_index:0,path:binding.path,byte_sha256:binding.byte_sha256})},
  ()=>{const result=observationDrift(value=>mutatePathProof(value,m1Paths[0])),ev=result.evidence;return ev.evidence_digest!==D('bad')&&ev.drift_set_digest!==D('bad')&&ev.cumulative_manifest_binding.path_binding_digest!==D('bad')},
  ()=>{const result=observationDrift(value=>mutatePathProof(value,m1Paths[0]));return Object.keys(result).join(',')==='result_version,kind,negative_id,negative_literal,manifest_digest,observation_digest,evidence,state_changed,transport_invoked'&&Object.keys(result.evidence.target_slice).join(',')==='slice_id,ordinal,relation_to_active'&&Object.keys(result.evidence.cumulative_manifest_binding).join(',')==='manifest_digest,target_slice_digest,content_binding_kind,path_binding_index,path_binding_digest'},
  ()=>{const result=observationDrift(value=>mutatePathProof(value,m1Paths[0]));try{result.evidence.drift_count=99}catch{}return deepFrozen(result)&&result.evidence.drift_count===1},
  ()=>{const a=observationDrift(value=>mutatePathProof(value,m1Paths[0])),b=observationDrift(value=>mutatePathProof(value,m1Paths[0]));return jcs(a)===jcs(b)&&a.evidence.evidence_digest===digest(without(a.evidence,'evidence_digest'))},
  ()=>!/(?:node:fs|node:child_process|execFile|fetch\(|Date\.now|process\.env)/.test(sourceText),
  ()=>noEcho({observation,active:observationDrift(value=>mutatePathProof(value,m1Paths[0])),collector_error:'focused compatibility collector failed'}),
]
check(a04Checks.length===fixture.cumulative_compatibility.amendment_a04.executed_assertion_group_count,'A04 25 groups frozen')
for(let index=0;index<a04Checks.length;index+=1)check(await a04Checks[index](),`A04-${String(index+1).padStart(2,'0')}-${fixture.cumulative_compatibility.amendment_a04.assertion_groups[index]}`)

const admissionCase=(negative_id,result,pathFragment)=>({negative_id,branch:'admission_rejection',pass:rejected(result)&&(!pathFragment||result.rejection.path.includes(pathFragment))})
const resultCase=(negative_id,result)=>({negative_id,branch:'incompatible_result',pass:result.kind==='incompatible'&&result.negative_id===negative_id})
const n02=resultCase('B-221-M1-COMPAT-01-N02',evaluateObservation(observation,value=>removeObservedPath(value,m1Paths[2])))
const n03=resultCase('B-221-M1-COMPAT-01-N03',evaluateObservation(observation,value=>addObservedPath(value,'scripts/fixtures/issue221-extra.json')))
const unordered=resealObservation(observation,value=>{value.current_observed_ordered_paths.reverse();value.current_observed_path_set_digest=digest(value.current_observed_ordered_paths)})
const unorderedEnvelope={admission_version:'admitted_cumulative_compatibility_observation_v1',admission_result:'accepted',observation:unordered,admitted_observation_digest:unordered.observation_digest}
const duplicateObservation=resealObservation(observation,value=>value.content_proofs.push(clone(value.content_proofs[0])))
const missingSlice=clone(successors[2].manifest);missingSlice.slices.pop();missingSlice.manifest_digest=digest(without(missingSlice,'manifest_digest'))
const extraSlice=clone(successors[2].manifest);extraSlice.active_slice_id='M1';extraSlice.active_slice_ordinal=1;extraSlice.manifest_digest=digest(without(extraSlice,'manifest_digest'))
const badSliceDigest=clone(manifest);badSliceDigest.slices[1].slice_digest=D('bad-slice');badSliceDigest.manifest_digest=digest(without(badSliceDigest,'manifest_digest'))
const badCumulativeDigest=clone(manifest);badCumulativeDigest.slices[1].cumulative_digest=D('bad-cumulative');badCumulativeDigest.manifest_digest=digest(without(badCumulativeDigest,'manifest_digest'))
const badRootDigest=clone(manifest);badRootDigest.manifest_digest=D('bad-root')
const badEnvelope=clone(admittedManifest.value);badEnvelope.admitted_manifest_digest=D('bad-envelope')
const priorManifestMismatch=evaluateObservation(successors[2].observation,value=>{value.base_slice_binding.prior_manifest.manifest_digest=D('prior-manifest-mismatch')},successors[2].admittedManifest)
const nMatrix=[
  resultCase('B-221-M1-COMPAT-01-N01',observationDrift(value=>mutatePathProof(value,fixture.m0_historical_binding.paths[0].path))),
  n02,n03,
  resultCase('B-221-M1-COMPAT-01-N04',api.evaluateCumulativeCompatibilityV1(admittedManifest.value,unorderedEnvelope)),
  admissionCase('B-221-M1-COMPAT-01-N05',api.validateCumulativeCompatibilityObservationV1(duplicateObservation),'content_proofs'),
  resultCase('B-221-M1-COMPAT-01-N06',priorManifestMismatch),
  admissionCase('B-221-M1-COMPAT-01-N07',api.validateCumulativeSliceManifestV1(missingSlice),'active_slice_ordinal'),
  admissionCase('B-221-M1-COMPAT-01-N08',api.validateCumulativeSliceManifestV1(extraSlice),'active_slice_ordinal'),
  admissionCase('B-221-M1-COMPAT-01-N09',api.validateCumulativeSliceManifestV1(badSliceDigest),'slice_digest'),
  admissionCase('B-221-M1-COMPAT-01-N10',api.validateCumulativeSliceManifestV1(badCumulativeDigest),'cumulative_digest'),
  resultCase('B-221-M1-COMPAT-01-N11',api.evaluateCumulativeCompatibilityV1(badEnvelope,admittedObservation.value)),
  resultCase('B-221-M1-COMPAT-01-N12',evaluateObservation(observation,value=>aggregateSubstitution(value,m1Paths[0]))),
  resultCase('B-221-M1-COMPAT-01-N13',observationDrift(value=>{value.identity.observed.git_dir_binding_digest=D('git-dir-drift')})),
  resultCase('B-221-M1-COMPAT-01-N14',observationDrift(value=>{value.staged_path_state={state:'present',ordered_paths:[modulePath],ordered_paths_digest:digest([modulePath])}})),
  resultCase('B-221-M1-COMPAT-01-N15',observationDrift(value=>{value.m0_standalone_use={state:'m0_applied_to_cumulative',validator_path:fixture.m0_historical_binding.paths[1].path,observed_ordered_paths:fixture.canonical_observation_paths,observed_path_count:5,cumulative_validator_mode:'m0_standalone_misapplied'}})),
  resultCase('B-221-M1-COMPAT-01-N16',observationDrift(value=>mutatePathProof(value,m1Paths[0]))),
]
check(nMatrix.length===fixture.cumulative_compatibility.amendment_a04.executed_negative_matrix_count,'N01-N16 matrix frozen')
for(const row of nMatrix)check(row.pass,`${row.negative_id} executable ${row.branch}`)
check(rejected(api.validateCumulativeSliceManifestV1(badRootDigest)),'N11 raw root digest admission rejection')
check(priorManifestMismatch.evidence.detail==='prior_entry_digest_mismatch'&&priorManifestMismatch.evidence.pointer==='manifest.prior_entry_binding','N06 prior manifest exact semantics')
check(evaluateObservation(successors[2].observation,value=>{value.base_slice_binding.prior_manifest.prior_slice_entries_digest=D('prior-entries-mismatch')},successors[2].admittedManifest).negative_id==='B-221-M1-COMPAT-01-N06','N06 prior entries digest')
check(driftResult(successors[2],priorPath(successors[2],1),'prior-byte-separate').evidence.detail==='prior_slice_path_byte_drift','N06 prior byte drift separately exercised')

const n16Observation=resealObservation(observation,value=>mutatePathProof(value,m1Paths[0]))
const admittedN16Observation=api.validateCumulativeCompatibilityObservationV1(n16Observation);assert.equal(admittedN16Observation.kind,'accepted')
const n16Result=api.evaluateCumulativeCompatibilityV1(admittedManifest.value,admittedN16Observation.value)
check(accepted(api.validateCumulativeCompatibilityEvaluationResultV1(n16Result,admittedManifest.value,admittedN16Observation.value)),'N16 result revalidation accepted')
for(const field of ['path_binding_digest','drift_set_digest','evidence_digest']){
  const tampered=clone(n16Result)
  if(field==='path_binding_digest')tampered.evidence.cumulative_manifest_binding.path_binding_digest=D(`bad:${field}`)
  else tampered.evidence[field]=D(`bad:${field}`)
  check(rejected(api.validateCumulativeCompatibilityEvaluationResultV1(tampered,admittedManifest.value,admittedN16Observation.value)),`bad ${field} fails closed`)
}
for(const mutate of [
  value=>{value.public_unknown=true},
  value=>{delete value.negative_literal},
  value=>{value.evidence.public_unknown=true},
  value=>{delete value.evidence.drift_count},
  value=>{value.evidence.target_slice.public_unknown=true},
  value=>{delete value.evidence.target_slice.relation_to_active},
  value=>{value.evidence.cumulative_manifest_binding.public_unknown=true},
  value=>{delete value.evidence.cumulative_manifest_binding.path_binding_index},
]){const tampered=clone(n16Result);mutate(tampered);check(rejected(api.validateCumulativeCompatibilityEvaluationResultV1(tampered,admittedManifest.value,admittedN16Observation.value)),'new result field closure')}

const observedIdentityDrift=await collectFocusedObservation(manifest,{observedBindingOverride:{worktree_path_binding_digest:D('observed-private-drift')}})
check(jcs(observedIdentityDrift.value.identity.expected)===jcs(fixture.privacy_contract.approved_expected_identity_binding),'expected authority independently frozen')
check(api.evaluateCumulativeCompatibilityV1(admittedManifest.value,observedIdentityDrift.admitted.value).negative_id==='B-221-M1-COMPAT-01-N13','observed-only private drift reaches N13')
let outsideInventoryError=null
try{await collectFocusedObservation(manifest,{untrackedPaths:[...fixture.candidate_declared_paths,'private/outside-manifest.txt'],trackedPaths:[],stagedPaths:[]})}catch(error){outsideInventoryError=error}
check(outsideInventoryError?.message==='focused compatibility collector failed'&&noEcho(outsideInventoryError.message),'manifest-external inventory fails closed without echo')
const actualTrackedProof=await collectTrackedDeltaProof('package.json')
check(actualTrackedProof.base_byte_sha256===sha(gitBytes('show',`${HEAD}:package.json`))&&actualTrackedProof.observed_byte_sha256===sha(await readFile('package.json')),'tracked delta uses actual base and observed bytes')
check(observation.tracked_existing_delta.state==='none'&&observation.staged_path_state.state==='none','actual cumulative candidate staged/tracked state')

console.log(JSON.stringify({result:'PASS',contract:'Continuous Orchestration M1 Shared Proof Interfaces',semantic_rows:`${fixture.semantic_row_count}/${fixture.semantic_row_count}`,a04_assertion_groups:`${a04Checks.length}/${a04Checks.length}`,negative_matrix:`${nMatrix.length}/${nMatrix.length}`,assertions:assertionCount,cumulative_path_count:compatibility.verified_path_count,positive_ids:compatibility.positive_ids,manifest_digest:compatibility.manifest_digest,observation_digest:compatibility.observation_digest,shadow_only:true,transport_invoked:false}))
await server.close()
