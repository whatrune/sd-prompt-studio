import assert from 'node:assert/strict'
import { createServer } from 'vite'
const server=await createServer({server:{middlewareMode:true},appType:'custom'})
try {
 const m=await server.ssrLoadModule('/src/context-health/integration.ts')
 const gh=n=>({kind:'github',url:`https://github.com/whatrune/sd-prompt-studio/issues/${n}`})
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
