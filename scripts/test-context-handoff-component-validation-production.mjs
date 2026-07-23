import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { basePolicy, baseInput, taskSource } from './test-context-health-evaluator.mjs'

const server=await createServer({server:{middlewareMode:true},appType:'custom'})
try{
 const api=await server.ssrLoadModule('/src/context-health/index.ts')
 const cv=api
 const evaluator=await server.ssrLoadModule('/src/context-health/evaluator.ts')
 const artifacts=api
 const at='2026-07-23T04:03:30.000Z'
 const manifest={context_handoff_manifest_ref:`evidence/context-handoffs/sha256-${'a'.repeat(64)}`}
 const descriptor={component_id:`compressed_context_handoff/sha256-${'b'.repeat(64)}`,component_kind:'compressed_context_handoff',content_type:'application/json',byte_length:12,sha256:'b'.repeat(64)}
 const d=await cv.generateDescriptorEvidenceRefV1(manifest,descriptor)
 const o=await cv.generateObservedBytesEvidenceRefV1(manifest,'compressed_context_handoff',12,'b'.repeat(64))
 assert.equal(api.validateCanonicalSourceRefV1(d),true)
 assert.equal(api.validateCanonicalSourceRefV1(o),true)
 assert.match(d.content_ref,/^evidence\/context-handoff-component-descriptors\/sha256-[0-9a-f]{64}$/)
 assert.match(o.content_ref,/^evidence\/context-handoff-component-observations\/sha256-[0-9a-f]{64}$/)
 assert.notEqual(d.content_ref,o.content_ref)
 const diagnostic={component_kind:'compressed_context_handoff',code:'component_digest_mismatch',path:'$.component',message:'component digest mismatch',evidence_refs:[o,d]}
 const diagnostic_id=await cv.generateComponentValidationDiagnosticIdV1(diagnostic)
 assert.equal(await cv.verifyComponentValidationDiagnosticIdV1({...diagnostic,diagnostic_id}),true)
 assert.equal(await cv.verifyComponentValidationDiagnosticIdV1({...diagnostic,diagnostic_id:`${diagnostic_id}0`}),false)
 const rejected=await cv.produceContextHandoffComponentValidationResultV1(null,at)
 assert.equal(rejected.outcome_kind,'rejected')
 assert.equal(rejected.structural_rejection.code,'null_forbidden')
 assert.equal('component_validation_result' in rejected,false)
 assert.equal('failure' in rejected,false)
 const policy=basePolicy();policy.context_health_policy_ref=await api.generateContextHealthPolicyRef(policy)
 const input=baseInput(policy.context_health_policy_ref);input.atomic_signal_observations=[{observation_id:'handoff-event',atomic_signal_code:'operator_handoff_event',presence:'present',authority:'authoritative',evidence_refs:[taskSource],observed_at:at}];input.context_health_input_ref=await api.generateContextHealthInputRef(input)
 const decision=(await evaluator.evaluateContextHealthV1(input,policy)).decision
 const provenance={provenance_id:'provenance-1',source_ref:taskSource,source_kind:'github',observed_at:at,verification_state:'verified',immutable_revision:{kind:'github_database_id',github_database_id:158}}
 const fact={fact_id:'fact-1',fact_kind:'unresolved_item',resolution_state:'unresolved',evidence_state:'verified',owner_role:'backend_implementer',value:{kind:'string',string_value:'unresolved'},source_refs:[taskSource],freshness_evidence_ids:[],redaction_record_ids:[],provenance_ids:['provenance-1']}
 const bundleInput={contract_version:artifacts.CONTEXT_HANDOFF_BUNDLE_BUILDER_INPUT_VERSION,context_handoff_bundle_builder_input_ref:'',context_health_policy:policy,context_health_evaluation_input:input,context_health_decision:decision,canonical_task_record:input.workflow_identity.canonical_task_record,dispatch_record:input.workflow_identity.dispatch_record,workflow_identity_snapshot:input.workflow_identity,completed_work:[],frozen_decisions:[],unresolved_items:[fact],blockers_and_risks:[],forbidden_operations:[],exact_next_action:{action_id:'next-action',owner_role:'backend_implementer',action_summary:'continue',preconditions:[],source_refs:[taskSource]},validation_annotations:[],material_facts:[fact],freshness_evidence:[],redaction_records:[],source_provenance:[provenance],repository_state:{state:'available',repository:'whatrune/sd-prompt-studio',workflow_identity_snapshot:input.workflow_identity,dirty_state:'clean',observed_at:at,evidence_refs:[taskSource]},generated_at:at,generator_contract_version:artifacts.ARTIFACT_GENERATOR_VERSION}
 bundleInput.context_handoff_bundle_builder_input_ref=await artifacts.generateContextHandoffBundleBuilderInputRef(bundleInput)
 const bundle=await artifacts.buildContextHandoffBundleV1(bundleInput);assert.equal(bundle.result_kind,'complete')
 assert.equal(await api.generateContextHandoffManifestRef(bundle.context_handoff_manifest),bundle.context_handoff_manifest.context_handoff_manifest_ref)
 const manifestProjection=api.projectContextHandoffManifestV1(bundle.context_handoff_manifest)
 assert.equal(Object.keys(manifestProjection).length,25)
 assert.equal(Object.hasOwn(manifestProjection,'context_handoff_manifest_ref'),false)
 const manifestVerification=await api.verifyContextHandoffManifestRef(bundle.context_handoff_manifest,at)
 assert.equal(manifestVerification.result_kind,'matched');assert.equal(Object.isFrozen(manifestVerification),true)
 const producerInput={contract_version:api.CONTEXT_COMPONENT_VALIDATION_INPUT_VERSION,context_handoff_manifest:bundle.context_handoff_manifest,component_payloads:bundle.generated_components.map(component=>component.transport),validator_contract_version:'context-handoff-component-validator-v1',validation_timestamp:at}
 const produced=await cv.produceContextHandoffComponentValidationResultV1(producerInput,at)
 assert.equal(produced.outcome_kind,'produced');assert.equal(produced.component_validation_result.result_kind,'valid');assert.equal(api.validateContextHandoffComponentValidationResultV1(produced.component_validation_result,at).accepted,true)
 for(const fault_point of ['throw_after_input_admission','invalidate_failure_before_failure_admission','invalidate_failed_wrapper_before_outcome_admission','throw_at_manifest_verifier_call_boundary','reject_manifest_verifier_promise_at_call_boundary']){const anchor=await cv.produceContextHandoffComponentValidationResultV1(producerInput,at,{contract_version:'component-validation-production-execution-control-v1',mode:'normative_test',fault_point,test_contract_version:'component-validation-production-normative-test-v1'});assert.equal(anchor.contract_version,'context-handoff-component-validation-terminal-anchor-outcome-v1');assert.equal(anchor.outcome_kind,'terminal_failed');assert.equal(Object.isFrozen(anchor),true);assert.equal((await cv.validateComponentValidationProducerOutcomeV1(anchor,producerInput,at)).accepted,true)}
 for(const invalidControl of [null,{}, {contract_version:'bad',mode:'production'},{contract_version:'component-validation-production-execution-control-v1',mode:'production',extra:true},{contract_version:'component-validation-production-execution-control-v1',mode:'normative_test',fault_point:'unknown',test_contract_version:'component-validation-production-normative-test-v1'}]){const anchor=await cv.produceContextHandoffComponentValidationResultV1(producerInput,at,invalidControl);assert.equal(anchor.contract_version,'context-handoff-component-validation-terminal-anchor-outcome-v1');assert.equal((await cv.validateComponentValidationProducerOutcomeV1(anchor,producerInput,at)).accepted,true)}
 const mismatched=structuredClone(producerInput);mismatched.context_handoff_manifest.context_handoff_manifest_ref=`evidence/context-handoffs/sha256-${'f'.repeat(64)}`
 const mismatchVerification=await api.verifyContextHandoffManifestRef(mismatched.context_handoff_manifest,at)
 assert.equal(mismatchVerification.result_kind,'mismatch');assert.equal(mismatchVerification.stored_ref,mismatched.context_handoff_manifest.context_handoff_manifest_ref)
 const mismatchOutcome=await cv.produceContextHandoffComponentValidationResultV1(mismatched,at)
 assert.equal(mismatchOutcome.outcome_kind,'rejected');assert.equal(mismatchOutcome.structural_rejection.code,'content_reference_mismatch');assert.equal(mismatchOutcome.structural_rejection.path,'$.context_handoff_manifest.context_handoff_manifest_ref')
 const missing=structuredClone(producerInput);const decoded=JSON.parse(atob(missing.component_payloads[0].content_base64));delete decoded.contract_version;const bytes=new TextEncoder().encode(JSON.stringify(decoded));missing.component_payloads[0].content_base64=btoa(String.fromCharCode(...bytes));const missingManifest=structuredClone(bundle.context_handoff_manifest);missingManifest.component_artifacts[0].byte_length=bytes.length;missingManifest.component_artifacts[0].sha256=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');missingManifest.component_artifacts[0].component_id=`compressed_context_handoff/sha256-${missingManifest.component_artifacts[0].sha256}`;missingManifest.context_handoff_manifest_ref=await api.generateContextHandoffManifestRef(missingManifest);missing.context_handoff_manifest=missingManifest;const missingResult=await cv.produceContextHandoffComponentValidationResultV1(missing,at);assert.equal(missingResult.outcome_kind,'produced');assert.equal(missingResult.component_validation_result.result_kind,'invalid');assert.equal(Object.hasOwn(missingResult.component_validation_result.component_results[0],'observed_contract_version'),false)
 console.log('context handoff component validation production focused tests passed')
}finally{await server.close()}
