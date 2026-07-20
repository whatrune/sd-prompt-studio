import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { basePolicy, baseInput, observation, at, taskSource } from './test-context-health-evaluator.mjs'
const server=await createServer({server:{middlewareMode:true},appType:'custom'})
try {
 const m=await server.ssrLoadModule('/src/context-health/integration.ts')
 const c=await server.ssrLoadModule('/src/context-health/index.ts')
 const e=await server.ssrLoadModule('/src/context-health/evaluator.ts')
 const gh=n=>({kind:'github',url:`https://github.com/whatrune/sd-prompt-studio/issues/${n}`})
 const makeAdmitted=async (mutate=()=>{})=>{
  const policy=basePolicy();policy.context_health_policy_ref=await c.generateContextHealthPolicyRef(policy)
  const input=baseInput(policy.context_health_policy_ref)
  input.role='backend_architect';input.workflow_phase='review'
  input.checkpoint={checkpoint_instance_id:'checkpoint-1',checkpoint_type:'pre_review',blocking_class:'blocking',protected_action_ref:gh(161)}
  input.constraint_snapshot.allowed_change_refs=[gh(161)];input.constraint_snapshot.forbidden_change_refs=[]
  input.canonical_record_coverage=[{coverage_id:'coverage-1',coverage_class:'task_assignment',verification_state:'verified',source_provenance:{provenance_id:'coverage-provenance',source_ref:taskSource,source_kind:'github',observed_at:at,verification_state:'verified',immutable_revision:{kind:'git_sha',git_sha:'a'.repeat(40)}},claimed_ref:taskSource,observed_ref:taskSource}]
  mutate(input,policy)
  input.context_health_input_ref=await c.generateContextHealthInputRef(input)
  const binding={canonical_task_record:input.workflow_identity.canonical_task_record,task_assignment_coverage_id:'coverage-1',task_assignment_immutable_revision:{kind:'git_sha',git_sha:'a'.repeat(40)},task_id:input.task_id,assignment_revision:input.assignment_revision,assigned_role:input.role,repository:input.repository,workflow_phase:input.workflow_phase,requested_action:'begin_review_judgment',requested_action_ref:gh(161)}
  assert.equal(c.validateContextHealthPolicyV1(policy,at).accepted,true,'fixture Policy is admitted')
  assert.equal(c.validateContextHealthEvaluationInputV1(input,at).accepted,true,'fixture Input is admitted')
  assert.equal(m.validateTaskAssignmentActionBindingV1(binding),true,'fixture Binding is admitted')
  return {policy,input,binding}
 }
 const assertIntegrated=async (mutate,kind)=>{const {policy,input,binding}=await makeAdmitted(mutate);const evaluation=await e.evaluateContextHealthV1(input,policy);assert.equal(evaluation.ok,true,JSON.stringify(evaluation));const result=await m.integrateContextHealthV1(binding,input,policy);assert.equal(result.result_kind,kind,JSON.stringify(result));assert.equal(m.validateContextHealthIntegrationResultV1(result),true);assert.equal(m.validateContextHealthIntegrationResultSemantics(result),true);assert.equal(await m.verifyContextHealthIntegrationResultRef(result),true);assert.equal(Object.isFrozen(result),true);return {policy,input,binding,result}}
 const live=await assertIntegrated(()=>{},'continue')
 const checkpointLive=await assertIntegrated(input=>{input.counter_snapshot.operation_count=3},'checkpoint_only')
 assert.equal(checkpointLive.result.checkpoint_publication_instruction.publication_performed,false)
 const handoffLive=await assertIntegrated(input=>{input.atomic_signal_observations=[observation('handoff','operator_handoff_event','authoritative')]},'handoff_required')
 assert.equal(handoffLive.result.handoff_boundary_instruction.continuation_state,'new_design_and_implementation_blocked')
 const hardStopLive=await assertIntegrated(input=>{input.atomic_signal_observations=[observation('hard-stop','operator_hard_stop_event','authoritative')]},'hard_stop_and_handoff')
 assert.equal(hardStopLive.result.handoff_boundary_instruction.continuation_state,'all_continuation_blocked')
 const immutableSnapshot=JSON.stringify(live.result);live.input.counter_snapshot.operation_count=99;live.binding.task_id='mutated';assert.equal(JSON.stringify(live.result),immutableSnapshot)
 const assertFailure=async (bindingMutation, inputMutation, code)=>{const {policy,input,binding}=await makeAdmitted(inputMutation);bindingMutation(binding);const result=await m.integrateContextHealthV1(binding,input,policy);assert.equal(result.result_kind,'failure',JSON.stringify(result));assert.equal(result.failure_code,code,JSON.stringify(result));assert.equal(m.validateContextHealthIntegrationResultV1(result),true);assert.equal(await m.verifyContextHealthIntegrationResultRef(result),true);assert.equal(Object.isFrozen(result),true);return result}
 await assertFailure(binding=>{binding.requested_action='merge_pull_request'},()=>{},'protected_action_forbidden')
 await assertFailure(binding=>{binding.requested_action='continue_current_assigned_work'},()=>{},'illegal_action_tuple')
 await assertFailure(binding=>{binding.task_id='other-task'},()=>{},'cross_input_identity_mismatch')
 await assertFailure(()=>{},input=>{input.policy_ref='policies/context-health/sha256-'+'f'.repeat(64)},'evaluator_failed')
 const binding={canonical_task_record:gh(160),task_assignment_coverage_id:'coverage-1',task_assignment_immutable_revision:{kind:'git_sha',git_sha:'a'.repeat(40)},task_id:'task-1',assignment_revision:1,assigned_role:'backend_implementer',repository:'whatrune/sd-prompt-studio',workflow_phase:'implementation',requested_action:'continue_current_assigned_work',requested_action_ref:gh(161)}
 assert.equal(m.validateTaskAssignmentActionBindingV1(binding),true)
 assert.equal(m.validateTaskAssignmentActionBindingV1({...binding,extra:true}),false)
 assert.equal(m.validateTaskAssignmentActionBindingV1({...binding,assignment_revision:0}),false)
 const rejected=await m.integrateContextHealthV1({...binding,extra:true},{evaluation_timestamp:'2026-07-20T00:00:00.000Z'},{})
 assert.equal(rejected.result_kind,'failure');assert.equal(rejected.failure_code,'evaluation_input_admission_failed')
 const failure={contract_version:'context-health-integration-result-v1',context_health_integration_result_ref:'',result_kind:'failure',failure_code:'protected_action_forbidden',failure_stage:'legality',path:'$.requested_action',message:'blocked',verified_identity_refs:[gh(160)],decision_owner:'product_owner',retry_policy:'after_product_owner_decision'}
 failure.context_health_integration_result_ref=await m.generateContextHealthIntegrationResultRef(failure)
 assert.equal(m.validateContextHealthIntegrationResultV1(failure),true);assert.equal(await m.verifyContextHealthIntegrationResultRef(failure),true)
 assert.equal(m.validateContextHealthIntegrationResultV1({...failure,unknown:true}),false)
 const checkpoint={contract_version:'context-health-integration-result-v1',context_health_integration_result_ref:'x',result_kind:'checkpoint_only',result_reason_code:'checkpoint_record_required_before_exact_continuation',canonical_task_record:gh(160),task_assignment_immutable_revision:binding.task_assignment_immutable_revision,task_id:'task-1',assignment_revision:1,role:'backend_implementer',repository:'whatrune/sd-prompt-studio',workflow_phase:'implementation',checkpoint_instance_id:'c-1',checkpoint_type:'operator_requested',protected_action_ref:gh(161),requested_action:'continue_current_assigned_work',requested_action_ref:gh(161),context_health_policy_ref:'policies/context-health/sha256-'+'a'.repeat(64),context_health_input_ref:'evidence/context-health-inputs/sha256-'+'b'.repeat(64),context_health_decision_ref:'evidence/context-health-decisions/sha256-'+'c'.repeat(64),checkpoint_rule_ref:'r-1',legal_next_action:'follow_checkpoint_publication_instruction',hard_rule_refs:[],forced_handoff_rule_refs:[],checkpoint_publication_instruction:{instruction_kind:'construct_validate_publish_then_release_exact_action'}}
 checkpoint.context_health_integration_result_ref=await m.generateContextHealthIntegrationResultRef(checkpoint)
 assert.equal(m.validateContextHealthIntegrationResultV1(checkpoint),true);assert.equal(m.validateContextHealthIntegrationResultSemantics(checkpoint),true);assert.equal(await m.verifyContextHealthIntegrationResultRef(checkpoint),true)
 const snapshot=JSON.stringify(checkpoint);checkpoint.checkpoint_publication_instruction.mutated=true;assert.notEqual(await m.generateContextHealthIntegrationResultRef(checkpoint),failure.context_health_integration_result_ref);assert.ok(snapshot.includes('checkpoint_only'))
 console.log('Context Health Step 4 normative fixture suite passed')
} finally { await server.close() }
