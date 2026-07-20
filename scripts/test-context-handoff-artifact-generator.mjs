import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { basePolicy, baseInput, at, taskSource } from './test-context-health-evaluator.mjs'
const server=await createServer({server:{middlewareMode:true},appType:'custom'})
try{
 const api=await server.ssrLoadModule('/src/context-health/index.ts'),e=await server.ssrLoadModule('/src/context-health/evaluator.ts'),a=await server.ssrLoadModule('/src/context-health/artifacts/index.ts')
 const p=basePolicy();p.context_health_policy_ref=await api.generateContextHealthPolicyRef(p);const i=baseInput(p.context_health_policy_ref);i.counter_snapshot.operation_count=3;i.context_health_input_ref=await api.generateContextHealthInputRef(i);const d=(await e.evaluateContextHealthV1(i,p)).decision
 const fact={fact_id:'fact-1',fact_kind:'unresolved_item',resolution_state:'unresolved',evidence_state:'verified',owner_role:'backend_implementer',value:{kind:'string',string_value:'contract remains unresolved'},source_refs:[taskSource],freshness_evidence_ids:[],redaction_record_ids:[],provenance_ids:['provenance-1']},provenance={provenance_id:'provenance-1',source_ref:taskSource,source_kind:'github',observed_at:at,verification_state:'verified',immutable_revision:{kind:'github_database_id',github_database_id:158}}
 const x={contract_version:a.CHECKPOINT_RECORD_BUILDER_INPUT_VERSION,checkpoint_record_builder_input_ref:'',context_health_policy:p,context_health_evaluation_input:i,context_health_decision:d,material_facts:[fact],redaction_records:[],source_provenance:[provenance],generated_at:at,generator_contract_version:a.ARTIFACT_GENERATOR_VERSION};x.checkpoint_record_builder_input_ref=await a.generateCheckpointRecordBuilderInputRef(x)
 const complete=await a.buildCheckpointRecordV1(x);assert.equal(complete.result_kind,'complete');assert.equal(await a.verifyCheckpointRecordRef(complete.checkpoint_record),true);assert.equal(complete.checkpoint_record.unresolved_items[0].resolution_state,'unresolved');assert.equal(Object.isFrozen(complete),true)
 const y={...x,material_facts:[{...fact,evidence_state:'unverified',provenance_ids:[]}]};y.checkpoint_record_builder_input_ref=await a.generateCheckpointRecordBuilderInputRef(y);assert.equal((await a.buildCheckpointRecordV1(y)).result_kind,'incomplete')
 const saved=JSON.stringify(complete);x.material_facts[0].value.string_value='mutated';assert.equal(JSON.stringify(complete),saved);console.log('Pure Context Handoff Artifact Generator focused tests passed.')
}finally{await server.close()}
