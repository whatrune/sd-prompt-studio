import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { basePolicy, baseInput, at, taskSource } from './test-context-health-evaluator.mjs'

const server=await createServer({server:{middlewareMode:true},appType:'custom'})
try {
 const api=await server.ssrLoadModule('/src/context-health/index.ts')
 const evaluator=await server.ssrLoadModule('/src/context-health/evaluator.ts')
 const artifacts=await server.ssrLoadModule('/src/context-health/artifacts/index.ts')
 const policy=basePolicy(); policy.context_health_policy_ref=await api.generateContextHealthPolicyRef(policy)
 const input=baseInput(policy.context_health_policy_ref); input.counter_snapshot.operation_count=3; input.context_health_input_ref=await api.generateContextHealthInputRef(input)
 const checkpointDecision=(await evaluator.evaluateContextHealthV1(input,policy)).decision
 const provenance={provenance_id:'provenance-1',source_ref:taskSource,source_kind:'github',observed_at:at,verification_state:'verified',immutable_revision:{kind:'github_database_id',github_database_id:158}}
 const unresolved={fact_id:'fact-1',fact_kind:'unresolved_item',resolution_state:'unresolved',evidence_state:'verified',owner_role:'backend_implementer',value:{kind:'string',string_value:'contract remains unresolved'},source_refs:[taskSource],freshness_evidence_ids:[],redaction_record_ids:[],provenance_ids:['provenance-1']}
 const checkpointInput={contract_version:artifacts.CHECKPOINT_RECORD_BUILDER_INPUT_VERSION,checkpoint_record_builder_input_ref:'',context_health_policy:policy,context_health_evaluation_input:input,context_health_decision:checkpointDecision,material_facts:[unresolved],redaction_records:[],source_provenance:[provenance],generated_at:at,generator_contract_version:artifacts.ARTIFACT_GENERATOR_VERSION}
 checkpointInput.checkpoint_record_builder_input_ref=await artifacts.generateCheckpointRecordBuilderInputRef(checkpointInput)
 const complete=await artifacts.buildCheckpointRecordV1(checkpointInput)
 assert.equal(complete.result_kind,'complete'); assert.equal(await artifacts.verifyCheckpointRecordRef(complete.checkpoint_record),true); assert.equal(complete.checkpoint_record.unresolved_items[0].resolution_state,'unresolved'); assert.equal(Object.isFrozen(complete),true)
 const {value: omittedValue,...unverifiedFact}=unresolved; const incomplete={...checkpointInput,material_facts:[{...unverifiedFact,evidence_state:'unverified',provenance_ids:[]}]}; incomplete.checkpoint_record_builder_input_ref=await artifacts.generateCheckpointRecordBuilderInputRef(incomplete)
 assert.equal((await artifacts.buildCheckpointRecordV1(incomplete)).result_kind,'incomplete')
 const handoffInput=baseInput(policy.context_health_policy_ref)
 handoffInput.atomic_signal_observations=[{observation_id:'handoff-event',atomic_signal_code:'operator_handoff_event',presence:'present',authority:'authoritative',evidence_refs:[taskSource],observed_at:at}]
 handoffInput.context_health_input_ref=await api.generateContextHealthInputRef(handoffInput)
 const handoffDecision=(await evaluator.evaluateContextHealthV1(handoffInput,policy)).decision
 assert.equal(handoffDecision.outcome,'handoff_required')
 const bundleInput={contract_version:artifacts.CONTEXT_HANDOFF_BUNDLE_BUILDER_INPUT_VERSION,context_handoff_bundle_builder_input_ref:'',context_health_policy:policy,context_health_evaluation_input:handoffInput,context_health_decision:handoffDecision,canonical_task_record:handoffInput.workflow_identity.canonical_task_record,dispatch_record:handoffInput.workflow_identity.dispatch_record,workflow_identity_snapshot:handoffInput.workflow_identity,completed_work:[],frozen_decisions:[],unresolved_items:[unresolved],blockers_and_risks:[],forbidden_operations:[],exact_next_action:{action_id:'next-action',owner_role:'backend_implementer',action_summary:'resolve the admitted contract gap',preconditions:['assignment remains bound'],source_refs:[taskSource]},validation_annotations:[],material_facts:[unresolved],freshness_evidence:[],redaction_records:[],source_provenance:[provenance],repository_state:{state:'available',repository:'whatrune/sd-prompt-studio',workflow_identity_snapshot:handoffInput.workflow_identity,dirty_state:'clean',observed_at:at,evidence_refs:[taskSource]},generated_at:at,generator_contract_version:artifacts.ARTIFACT_GENERATOR_VERSION}
 bundleInput.context_handoff_bundle_builder_input_ref=await artifacts.generateContextHandoffBundleBuilderInputRef(bundleInput)
 const bundle=await artifacts.buildContextHandoffBundleV1(bundleInput)
 assert.equal(bundle.result_kind,'complete',JSON.stringify(bundle)); assert.equal(bundle.generated_components.length,5)
 assert.deepEqual(bundle.generated_components.map(component=>component.artifact.component_kind),['compressed_context_handoff','bootstrap_prompt','canonical_record_manifest','repository_state_snapshot','validation_snapshot'])
 assert.ok(bundle.generated_components.every(artifacts.validateGeneratedComponentV1),JSON.stringify(bundle.generated_components.find(component=>component.artifact.component_kind==='canonical_record_manifest'))); assert.ok(await artifacts.verifyContextHandoffBundleBuilderResultIntegrityV1(bundle)); assert.ok(artifacts.validateContextHandoffBundleBuilderResultV1(bundle))
 const bootstrap=bundle.generated_components[1].payload
 assert.ok(artifacts.validateContextBootstrapPromptPayloadV1(bootstrap)); assert.equal(artifacts.validateContextBootstrapPromptPayloadV1({...bootstrap,stop_conditions:[...bootstrap.stop_conditions].reverse()}),false)
 assert.equal(artifacts.validateGeneratedComponentV1({...bundle.generated_components[0],extra:true}),false)
 const tampered={...bundle.generated_components[0],transport:{...bundle.generated_components[0].transport,content_base64:bundle.generated_components[0].transport.content_base64.slice(0,-4)+'AAAA'}}
 assert.equal(await artifacts.verifyGeneratedComponentIntegrityV1(tampered),false)
 assert.equal(await artifacts.verifyGeneratedComponentIntegrityV1({...bundle.generated_components[0],artifact:{...bundle.generated_components[0].artifact,sha256:'0'.repeat(64)}}),false)
 assert.equal(await artifacts.verifyGeneratedComponentIntegrityV1({...bundle.generated_components[0],artifact:{...bundle.generated_components[0].artifact,byte_length:1}}),false)
 const reordered={...bundle,generated_components:[...bundle.generated_components].reverse()}; assert.equal(artifacts.validateContextHandoffBundleBuilderResultV1(reordered),false)
 const manifestMismatch={...bundle,context_handoff_manifest:{...bundle.context_handoff_manifest,component_artifacts:[...bundle.context_handoff_manifest.component_artifacts.slice(1),bundle.context_handoff_manifest.component_artifacts[0]]}}; assert.equal(artifacts.validateContextHandoffBundleBuilderResultV1(manifestMismatch),false)
 assert.equal(artifacts.validateContextHandoffBundleBuilderInputV1({...bundleInput,unknown_field:true}),false)
 const unavailable={...bundleInput,repository_state:{state:'unavailable',repository:'whatrune/sd-prompt-studio',workflow_identity_snapshot:handoffInput.workflow_identity,observed_at:at,attempt:{attempt_id:'attempt-1'}}}; unavailable.context_handoff_bundle_builder_input_ref=await artifacts.generateContextHandoffBundleBuilderInputRef(unavailable); assert.equal((await artifacts.buildContextHandoffBundleV1(unavailable)).result_kind,'incomplete')
 assert.ok(Object.isFrozen(bundle)&&Object.isFrozen(bundle.generated_components)&&Object.isFrozen(bundle.generated_components[0].payload))
 const saved=JSON.stringify(complete); checkpointInput.material_facts[0].value.string_value='mutated'; assert.equal(JSON.stringify(complete),saved)
 console.log('Pure Context Handoff Artifact Generator focused tests passed.')
} finally { await server.close() }
