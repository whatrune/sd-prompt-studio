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
 assert.equal(complete.result_kind,'complete')
 assert.equal(artifacts.validateCheckpointRecordV1(complete.checkpoint_record),true)
 assert.deepEqual(artifacts.validateCheckpointRecordSemanticsV1(complete.checkpoint_record,checkpointInput),{valid:true})
 assert.equal(await artifacts.verifyCheckpointRecordRef(complete.checkpoint_record),true)
 assert.equal(artifacts.validateCheckpointRecordBuilderResultV1(complete),true)
 assert.equal(await artifacts.verifyCheckpointRecordBuilderResultRefV1(complete),true)
 assert.equal(await artifacts.verifyCheckpointRecordBuilderResultIntegrityV1(complete,checkpointInput),true)
 assert.equal(await artifacts.verifyCheckpointRecordBuilderResultIntegrityV1(complete,{...checkpointInput,checkpoint_record_builder_input_ref:`evidence/context-health-checkpoint-builder-inputs/sha256-${'0'.repeat(64)}`}),false)
 assert.equal(complete.checkpoint_record.unresolved_items[0].resolution_state,'unresolved')
 assert.equal(Object.isFrozen(complete),true)
 for(const field of ['applied_atomic_signal_rule_refs','applied_coverage_rule_refs','hard_rule_refs','forced_handoff_rule_refs','soft_contributions','applied_unknown_handling_rule_refs','unknown_advisory_signal_codes','prior_decision_refs','checkpoint_escalation_evaluation','operator_override_evaluation'])assert.deepEqual(complete.checkpoint_record[field],checkpointDecision[field],field)
 for(const [recordField,inputField] of [['workflow_identity_snapshot','workflow_identity'],['constraint_snapshot','constraint_snapshot'],['canonical_record_coverage','canonical_record_coverage'],['validation_bindings','validation_bindings']])assert.deepEqual(complete.checkpoint_record[recordField],input[inputField],recordField)
 for(const field of Object.keys(complete.checkpoint_record)){const missing=structuredClone(complete.checkpoint_record);delete missing[field];assert.equal(artifacts.validateCheckpointRecordV1(missing),false,`missing ${field}`)}
 assert.equal(artifacts.validateCheckpointRecordV1({...complete.checkpoint_record,unknown_field:true}),false)
 assert.equal(artifacts.validateCheckpointRecordV1({...complete.checkpoint_record,hard_rule_refs:['rules/context-health/derived-signal/unexpected']}),false)
 assert.equal(artifacts.validateCheckpointRecordV1({...complete.checkpoint_record,workflow_identity_snapshot:{...complete.checkpoint_record.workflow_identity_snapshot,unknown_field:true}}),false)
 const semanticMismatch={...complete.checkpoint_record,soft_score:complete.checkpoint_record.soft_score+1}
 assert.equal(artifacts.validateCheckpointRecordV1(semanticMismatch),true)
 assert.equal(artifacts.validateCheckpointRecordSemanticsV1(semanticMismatch,checkpointInput).valid,false)
 assert.equal(await artifacts.verifyCheckpointRecordBuilderResultRefV1({...complete,checkpoint_record_builder_result_ref:`evidence/context-health-checkpoint-builder-results/sha256-${'0'.repeat(64)}`}),false)
 const resolved={fact_id:'fact-2',fact_kind:'completed_work',resolution_state:'resolved',evidence_state:'verified',owner_role:'backend_implementer',value:{kind:'string',string_value:'typed checkpoint projection completed'},source_refs:[taskSource,input.workflow_identity.dispatch_record],freshness_evidence_ids:[],redaction_record_ids:[],provenance_ids:['provenance-1']}
 const equivalentA={...checkpointInput,checkpoint_record_builder_input_ref:'',material_facts:[unresolved,resolved]}; equivalentA.checkpoint_record_builder_input_ref=await artifacts.generateCheckpointRecordBuilderInputRef(equivalentA)
 const equivalentB={...checkpointInput,checkpoint_record_builder_input_ref:'',material_facts:[{...resolved,source_refs:[...resolved.source_refs].reverse()},unresolved]}; equivalentB.checkpoint_record_builder_input_ref=await artifacts.generateCheckpointRecordBuilderInputRef(equivalentB)
 assert.equal(equivalentA.checkpoint_record_builder_input_ref,equivalentB.checkpoint_record_builder_input_ref)
 const equivalentResultA=await artifacts.buildCheckpointRecordV1(equivalentA),equivalentResultB=await artifacts.buildCheckpointRecordV1(equivalentB)
 assert.equal(equivalentResultA.result_kind,'complete'); assert.equal(equivalentResultB.result_kind,'complete'); assert.equal(equivalentResultA.checkpoint_record_builder_result_ref,equivalentResultB.checkpoint_record_builder_result_ref)
 const safeRedaction={redaction_record_id:'redaction-safe',redaction_code:'token',affected_fact_ids:['fact-1'],source_refs:[taskSource],basis_ref:taskSource,disposition:'source_detail_omitted'}
 const redactionPreservedFact={...unresolved,redaction_record_ids:['redaction-safe']}
 const redactionPreservedInput={...checkpointInput,checkpoint_record_builder_input_ref:'',material_facts:[redactionPreservedFact],redaction_records:[safeRedaction]}; redactionPreservedInput.checkpoint_record_builder_input_ref=await artifacts.generateCheckpointRecordBuilderInputRef(redactionPreservedInput)
 assert.equal((await artifacts.buildCheckpointRecordV1(redactionPreservedInput)).result_kind,'complete')
 const {value: removedValue,...redactedFactBase}=redactionPreservedFact
 const removedRedaction={...safeRedaction,redaction_record_id:'redaction-removed',disposition:'fact_value_removed'}
 const removedFact={...redactedFactBase,evidence_state:'redacted',redaction_record_ids:['redaction-removed']}
 const removedInput={...checkpointInput,checkpoint_record_builder_input_ref:'',material_facts:[removedFact],redaction_records:[removedRedaction]}; removedInput.checkpoint_record_builder_input_ref=await artifacts.generateCheckpointRecordBuilderInputRef(removedInput)
 assert.equal((await artifacts.buildCheckpointRecordV1(removedInput)).result_kind,'incomplete')
 const contradictedInput={...checkpointInput,checkpoint_record_builder_input_ref:'',source_provenance:[{...provenance,verification_state:'contradicted'}]}; contradictedInput.checkpoint_record_builder_input_ref=await artifacts.generateCheckpointRecordBuilderInputRef(contradictedInput)
 assert.equal((await artifacts.buildCheckpointRecordV1(contradictedInput)).result_kind,'failure')
 const unsafeInput={...checkpointInput,checkpoint_record_builder_input_ref:'',material_facts:[{...unresolved,value:{kind:'string',string_value:'authorization: Bearer abcdefghijklmnop'}}]}; unsafeInput.checkpoint_record_builder_input_ref=await artifacts.generateCheckpointRecordBuilderInputRef(unsafeInput)
 assert.equal((await artifacts.buildCheckpointRecordV1(unsafeInput)).result_kind,'failure')
 const {value: omittedValue,...unverifiedFact}=unresolved; const incomplete={...checkpointInput,material_facts:[{...unverifiedFact,evidence_state:'unverified',provenance_ids:[]}]}; incomplete.checkpoint_record_builder_input_ref=await artifacts.generateCheckpointRecordBuilderInputRef(incomplete)
 const incompleteResult=await artifacts.buildCheckpointRecordV1(incomplete)
 assert.equal(incompleteResult.result_kind,'incomplete')
 assert.equal(artifacts.validateCheckpointRecordBuilderResultV1(incompleteResult),true)
 assert.equal(await artifacts.verifyCheckpointRecordBuilderResultIntegrityV1(incompleteResult,incomplete),true)
 const checkpointFailure=await artifacts.buildCheckpointRecordV1({...checkpointInput,unknown_field:true})
 assert.equal(checkpointFailure.result_kind,'failure')
 assert.equal(artifacts.validateCheckpointRecordBuilderResultV1(checkpointFailure),true)
 assert.equal(await artifacts.verifyCheckpointRecordBuilderResultRefV1(checkpointFailure),true)
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
 assert.ok(bundle.generated_components.every(artifacts.validateGeneratedComponentV1),JSON.stringify(bundle.generated_components.find(component=>component.artifact.component_kind==='canonical_record_manifest'))); assert.ok(await artifacts.verifyContextHandoffBundleBuilderResultIntegrityV1(bundle)); assert.ok(artifacts.validateContextHandoffBundleBuilderResultV1(bundle)); assert.ok(await artifacts.verifyContextHandoffBundleBuilderResultRefV1(bundle))
 assert.ok(await api.verifyContextHealthReference(bundle.context_handoff_manifest))
 const payloadValidators=[artifacts.validateCompressedContextHandoffPayloadV1,artifacts.validateContextBootstrapPromptPayloadV1,artifacts.validateCanonicalRecordManifestPayloadV1,artifacts.validateRepositoryStateSnapshotPayloadV1,artifacts.validateValidationSnapshotPayloadV1]
 payloadValidators.forEach((validator,index)=>assert.equal(validator(bundle.generated_components[index].payload),true,`payload ${index}`))
 const bootstrap=bundle.generated_components[1].payload
 assert.ok(artifacts.validateContextBootstrapPromptPayloadV1(bootstrap)); assert.equal(artifacts.validateContextBootstrapPromptPayloadV1({...bootstrap,stop_conditions:[...bootstrap.stop_conditions].reverse()}),false)
 assert.equal(artifacts.validateGeneratedComponentV1({...bundle.generated_components[0],extra:true}),false)
 const tampered={...bundle.generated_components[0],transport:{...bundle.generated_components[0].transport,content_base64:bundle.generated_components[0].transport.content_base64.slice(0,-4)+'AAAA'}}
 assert.equal(await artifacts.verifyGeneratedComponentIntegrityV1(tampered),false)
 assert.equal(await artifacts.verifyGeneratedComponentIntegrityV1({...bundle.generated_components[0],artifact:{...bundle.generated_components[0].artifact,sha256:'0'.repeat(64)}}),false)
 assert.equal(await artifacts.verifyGeneratedComponentIntegrityV1({...bundle.generated_components[0],artifact:{...bundle.generated_components[0].artifact,byte_length:1}}),false)
 const reordered={...bundle,generated_components:[...bundle.generated_components].reverse()}; assert.equal(artifacts.validateContextHandoffBundleBuilderResultV1(reordered),false)
 const missingComponent={...bundle,generated_components:bundle.generated_components.slice(0,-1)}; assert.equal(artifacts.validateContextHandoffBundleBuilderResultV1(missingComponent),false)
 const duplicateComponent={...bundle,generated_components:[...bundle.generated_components.slice(0,-1),bundle.generated_components[0]]}; assert.equal(artifacts.validateContextHandoffBundleBuilderResultV1(duplicateComponent),false)
 const manifestMismatch={...bundle,context_handoff_manifest:{...bundle.context_handoff_manifest,component_artifacts:[...bundle.context_handoff_manifest.component_artifacts.slice(1),bundle.context_handoff_manifest.component_artifacts[0]]}}; assert.equal(artifacts.validateContextHandoffBundleBuilderResultV1(manifestMismatch),false)
 assert.equal(artifacts.validateContextHandoffBundleBuilderInputV1({...bundleInput,unknown_field:true}),false)
 const unavailable={...bundleInput,repository_state:{state:'unavailable',repository:'whatrune/sd-prompt-studio',workflow_identity_snapshot:handoffInput.workflow_identity,observed_at:at,attempt:{attempt_id:'attempt-1',source_ref:taskSource,attempted_at:at,method:'github_api',failure_reason:'source_unreachable',safe_diagnostic_code:'source_unreachable'}}}; unavailable.context_handoff_bundle_builder_input_ref=await artifacts.generateContextHandoffBundleBuilderInputRef(unavailable); const unavailableResult=await artifacts.buildContextHandoffBundleV1(unavailable); assert.equal(unavailableResult.result_kind,'incomplete'); assert.equal(artifacts.validateContextHandoffBundleBuilderResultV1(unavailableResult),true); assert.equal(await artifacts.verifyContextHandoffBundleBuilderResultIntegrityV1(unavailableResult),true)
 const bundleFailure=await artifacts.buildContextHandoffBundleV1({...bundleInput,unknown_field:true}); assert.equal(bundleFailure.result_kind,'failure'); assert.equal(artifacts.validateContextHandoffBundleBuilderResultV1(bundleFailure),true); assert.equal(await artifacts.verifyContextHandoffBundleBuilderResultIntegrityV1(bundleFailure),true)
 const hardStopInput=baseInput(policy.context_health_policy_ref)
 hardStopInput.atomic_signal_observations=[{observation_id:'hard-stop-event',atomic_signal_code:'operator_hard_stop_event',presence:'present',authority:'authoritative',evidence_refs:[taskSource],observed_at:at}]
 hardStopInput.context_health_input_ref=await api.generateContextHealthInputRef(hardStopInput)
 const hardStopDecision=(await evaluator.evaluateContextHealthV1(hardStopInput,policy)).decision
 assert.equal(hardStopDecision.outcome,'hard_stop_and_handoff')
 const hardStopBundleInput={...bundleInput,context_handoff_bundle_builder_input_ref:'',context_health_evaluation_input:hardStopInput,context_health_decision:hardStopDecision,canonical_task_record:hardStopInput.workflow_identity.canonical_task_record,dispatch_record:hardStopInput.workflow_identity.dispatch_record,workflow_identity_snapshot:hardStopInput.workflow_identity,repository_state:{...bundleInput.repository_state,workflow_identity_snapshot:hardStopInput.workflow_identity}}
 hardStopBundleInput.context_handoff_bundle_builder_input_ref=await artifacts.generateContextHandoffBundleBuilderInputRef(hardStopBundleInput)
 assert.equal((await artifacts.buildContextHandoffBundleV1(hardStopBundleInput)).result_kind,'complete')
 const malformedWorkflow={...bundleInput,workflow_identity_snapshot:{...handoffInput.workflow_identity,issue_binding:{...handoffInput.workflow_identity.issue_binding,unknown_field:true}}}; malformedWorkflow.context_handoff_bundle_builder_input_ref=await artifacts.generateContextHandoffBundleBuilderInputRef(malformedWorkflow); assert.equal(artifacts.validateContextHandoffBundleBuilderInputV1(malformedWorkflow),false)
 const malformedRevision={...bundleInput,source_provenance:[{...provenance,immutable_revision:{kind:'github_database_id',github_database_id:158,unknown_field:true}}]}; malformedRevision.context_handoff_bundle_builder_input_ref=await artifacts.generateContextHandoffBundleBuilderInputRef(malformedRevision); assert.equal(artifacts.validateContextHandoffBundleBuilderInputV1(malformedRevision),false)
 const invalidFactCatalog={...bundleInput,material_facts:[{...unresolved,fact_kind:'invented'}]}; invalidFactCatalog.context_handoff_bundle_builder_input_ref=await artifacts.generateContextHandoffBundleBuilderInputRef(invalidFactCatalog); assert.equal(artifacts.validateContextHandoffBundleBuilderInputV1(invalidFactCatalog),false)
 const duplicateFact={...bundleInput,material_facts:[unresolved,{...unresolved,value:{kind:'string',string_value:'conflicting duplicate'}}]}; duplicateFact.context_handoff_bundle_builder_input_ref=await artifacts.generateContextHandoffBundleBuilderInputRef(duplicateFact); assert.equal(artifacts.validateContextHandoffBundleBuilderInputV1(duplicateFact),false); assert.equal((await artifacts.buildContextHandoffBundleV1(duplicateFact)).result_kind,'failure')
 const duplicateProvenance={...bundleInput,source_provenance:[provenance,{...provenance,observed_at:at}]}; duplicateProvenance.context_handoff_bundle_builder_input_ref=await artifacts.generateContextHandoffBundleBuilderInputRef(duplicateProvenance); assert.equal(artifacts.validateContextHandoffBundleBuilderInputV1(duplicateProvenance),false)
 const redaction={redaction_record_id:'redaction-1',redaction_code:'token',affected_fact_ids:['fact-1'],source_refs:[taskSource],basis_ref:taskSource,disposition:'fact_value_removed'}; const duplicateRedaction={...bundleInput,redaction_records:[redaction,{...redaction}]}; duplicateRedaction.context_handoff_bundle_builder_input_ref=await artifacts.generateContextHandoffBundleBuilderInputRef(duplicateRedaction); assert.equal(artifacts.validateContextHandoffBundleBuilderInputV1(duplicateRedaction),false)
 const annotation={annotation_id:'annotation-1',validation_id:'validation-1',annotation_kind:'warning',fact_id:'fact-1',source_refs:[taskSource]}; const duplicateAnnotation={...bundleInput,validation_annotations:[annotation,{...annotation}]}; duplicateAnnotation.context_handoff_bundle_builder_input_ref=await artifacts.generateContextHandoffBundleBuilderInputRef(duplicateAnnotation); assert.equal(artifacts.validateContextHandoffBundleBuilderInputV1(duplicateAnnotation),false)
 assert.ok(Object.isFrozen(bundle)&&Object.isFrozen(bundle.generated_components)&&Object.isFrozen(bundle.generated_components[0].payload))
 const saved=JSON.stringify(complete); checkpointInput.material_facts[0].value.string_value='mutated'; assert.equal(JSON.stringify(complete),saved)
 console.log('Pure Context Handoff Artifact Generator focused tests passed.')
} finally { await server.close() }
