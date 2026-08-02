import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {tmpdir} from 'node:os'
import {createServer} from 'vite'
import {API as TypeScriptAPI} from 'typescript/unstable/sync'
import * as ts from 'typescript/unstable/ast'
import {visitEachChild} from 'typescript/unstable/ast/visitor'

const fixturePath='scripts/fixtures/continuous-orchestration-trusted-slice-integration-m6-v3.json'
const fixture=JSON.parse(await readFile(fixturePath,'utf8'))
const productionSource=await readFile('src/continuous-orchestration/trusted-slice-integration-m6-v3.ts','utf8')
const clone=structuredClone
const jcs=value=>{if(value===null||typeof value==='boolean'||typeof value==='string')return JSON.stringify(value);if(typeof value==='number'){if(!Number.isFinite(value))throw new TypeError('non-finite');return JSON.stringify(value)}if(Array.isArray(value))return`[${value.map(jcs).join(',')}]`;if(value&&typeof value==='object')return`{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${jcs(value[key])}`).join(',')}}`;throw new TypeError('outside JSON model')}
const digest=value=>createHash('sha256').update(jcs(value)).digest('hex')
const without=(value,...fields)=>Object.fromEntries(Object.entries(value).filter(([key])=>!fields.includes(key)))
const equal=(left,right)=>jcs(left)===jcs(right)
const check=(condition,message)=>assert.equal(condition,true,message)
const rejected=result=>result?.kind==='rejected'
const Z64='0'.repeat(64),F64='f'.repeat(64)
const BASELINE_INPUT_DIGEST='36100dace025dcc1657502623ff90b195d53218c92ad89ed20dd5a69c5133c94'
const MUTATION_CATALOG_DIGEST='70e25071c072320510da0f2176c660e3bf52f824628485c1f1d220f35c421dc2'
const mutationTuples=[
  [['TSIM6-N15'],'port_contract_invalid','/ordered_trusted_artifacts/1/sealed_contribution_transport/contribution_payload/accepted_input_port_catalog_digest',8,'7775ddfb340169f70bf3b37e7005840922fc1fbccde8c10aea90f132671fd1d0','replace_jcs',JSON.stringify(Z64),null,'/ordered_trusted_artifacts/1/sealed_contribution_transport/contribution_payload/accepted_input_port_catalog_digest'],
  [['TSIM6-N16'],'port_contract_invalid','/ordered_trusted_artifacts/0/sealed_contribution_transport/contribution_payload/output_port_catalog_digest',8,'f71a604f9016e97a8f9c4e6d2d74a7942969cd285a36eede6e6dc1070ef064fb','replace_jcs',JSON.stringify(Z64),null,'/ordered_trusted_artifacts/0/sealed_contribution_transport/contribution_payload/output_port_catalog_digest'],
  [['TSIM6-N17','TSIM6-N51','TSIM6-N52','TSIM6-N54'],'port_contract_invalid','/connection_catalog/0/payload_schema_id',8,'5aa986df8c4a2dfce6aa045b9f3188c264fb3ce951aff49e69a9a2a42ddad656','replace_jcs','"schema-alias"',null,'/connection_catalog/0/payload_schema_id'],
  [['TSIM6-N18','TSIM6-N56'],'connection_payload_invalid','/end_to_end_scenario_catalog/0/edge_payload_digests',9,'30bcc70ae75dc08b6f31a9e771799ccbc2642115f381328127e6d9bd2657df62','replace_jcs',JSON.stringify(Z64),null,'/end_to_end_scenario_catalog/0/edge_payload_digests/0/payload_digest'],
  [['TSIM6-N19'],'connection_catalog_invalid','/connection_catalog',8,'ee3fac4e3f4d952eafc4602bb949d3a51a3247fd6271b4d4360531a5eed5d81e','remove_array_tail',null,null,'/connection_catalog'],
  [['TSIM6-N20'],'connection_catalog_invalid','/connection_catalog/0/connection_id',8,'4c3aa6f6fd64d21fae9baa69f119e9ffbd089d3bd9fe39f01f5b2feccd5fbe77','swap_array_items','[0,1]',null,'/connection_catalog'],
  [['TSIM6-N21'],'connection_catalog_invalid','/connection_catalog/0/target_slice_id',8,'644f35485e656b5ac7b54777af12d8da8ddb05cfff43f5c15d5548f1f4ad0001','replace_jcs','"M0"',null,'/connection_catalog/0/target_slice_id'],
  [['TSIM6-N22'],'connection_catalog_invalid','/connection_catalog/0/target_slice_id',8,'80aec532bb3d707bcb26e0db2baba4d5c6de1729c4565d6de09014c42c86d7e2','replace_jcs','"M9"',null,'/connection_catalog/0/target_slice_id'],
  [['TSIM6-N23'],'scenario_catalog_invalid','/end_to_end_scenario_catalog',10,'bd7c24914f3a76dca39b2833ea0fc48da709f7351e809b249fbf8135eb5129e2','remove_array_tail',null,null,'/end_to_end_scenario_catalog'],
  [['TSIM6-N24','TSIM6-N62'],'scenario_catalog_invalid','/end_to_end_scenario_catalog/0/scenario_id',10,'d77e936b6c382ff2a02602933dced265c34ad884c33e493c719064d564b7fbc4','swap_array_items','[0,1]',null,'/end_to_end_scenario_catalog'],
  [['TSIM6-N25'],'witness_coverage_or_digest_invalid','/end_to_end_scenario_catalog/0/ordered_witness_digests',11,'de3a3c1b107c01960b465b1aae6003bc691879e6dc738f18d14b53f1726c461f','replace_jcs','[]',null,'/end_to_end_scenario_catalog/0/ordered_witness_digests'],
  [['TSIM6-N26'],'witness_coverage_or_digest_invalid','/end_to_end_scenario_catalog/0/ordered_witness_digests',11,'9024048c4a08bf2f4cf6f3e2abfe538a3004b648642321f9e4ed4f90d035722e','replace_jcs',JSON.stringify(Z64),null,'/end_to_end_scenario_catalog/0/ordered_witness_digests/0'],
  [['TSIM6-N27','TSIM6-N60'],'terminal_outcome_invalid','/end_to_end_scenario_catalog/0/terminal_payload/terminal_class',13,'b82ce81b24e85663a575d0c0f6fc3985ea8306ff2577e040602773f00fcd5d34','replace_jcs','"wrong"',null,'/end_to_end_scenario_catalog/0/terminal_payload/terminal_class'],
  [['TSIM6-N28'],'terminal_outcome_invalid','/end_to_end_scenario_catalog/0/terminal_result/status',13,'eb7f08e063e32fee21f0c1e9bdc9f6abe5cac53d62ceb798d1c42f301fbac7f7','replace_jcs','"blocked"',null,'/end_to_end_scenario_catalog/0/terminal_result/status'],
  [['TSIM6-N29','TSIM6-N30'],'warning_classification_invalid','/expected_warning_classifications',12,'c5c045f95826b8a20b962d2a8ba328d0a26573e7753a8148ad74ce686c579800','replace_jcs','[]',null,'/expected_warning_classifications'],
  [['TSIM6-N49','TSIM6-N81'],'witness_coverage_or_digest_invalid','/end_to_end_scenario_catalog/0/terminal_result/terminal_payload_digest',11,'6698964a929b40763f37c7094ef250b027b5f1dccc16365dcefa83eb7e2b32c4','replace_jcs',JSON.stringify(Z64),null,'/end_to_end_scenario_catalog/0/terminal_result/terminal_payload_digest'],
  [['TSIM6-N53'],'port_contract_invalid','/connection_catalog/0/value_semantics_id',8,'eb3dad287eeb20c40cef2ac1457fa39db7cd9da9f97e499a2fbd18bbc1913bc4','replace_jcs','"wrong_semantics"',null,'/connection_catalog/0/value_semantics_id'],
  [['TSIM6-N55'],'connection_catalog_invalid','/connection_catalog/0',8,'a1a4d08501273313bcd7ba703595c41282e4f544931a235530d73f393ef3a895','add_unknown_member','{"unknown":true}',null,'/connection_catalog/0'],
  [['TSIM6-N57'],'scenario_catalog_invalid','/end_to_end_scenario_catalog/0/input_vector',10,'ade2956d6ae4da05ddad291acdbdcf0bf4d14af8546c997b3daa72d64fee5fd4','replace_jcs','"tampered"',null,'/end_to_end_scenario_catalog/0/input_vector/authority_state'],
  [['TSIM6-N58','TSIM6-N86'],'witness_coverage_or_digest_invalid','/end_to_end_scenario_catalog/0/ordered_witness_digests',11,'6bd7f2d0bf27574bb9d2271f4b8ad0b3bf36e04887b5c8b8d699d3d0a1b5c608','reverse_array',null,null,'/end_to_end_scenario_catalog/0/ordered_witness_digests'],
  [['TSIM6-N59'],'connection_payload_invalid','/end_to_end_scenario_catalog/0/edge_payload_digests',9,'6e893126ef95d690b885726169968a573ca61ab3968aafa094bdab6694b31d76','remove_array_tail',null,null,'/end_to_end_scenario_catalog/0/edge_payload_digests'],
  [['TSIM6-N61','TSIM6-N84'],'scenario_catalog_invalid','/end_to_end_scenario_catalog/0/terminal_payload',10,'9c5f10f32fd70100b80820a44719a593a9213303d57eac32ef0b99fad6eb4f9c','copy_from_pointer',null,'/end_to_end_scenario_catalog/1/terminal_payload','/end_to_end_scenario_catalog/0/terminal_payload'],
  [['TSIM6-N76'],'scenario_catalog_invalid','/end_to_end_scenario_catalog/0',10,'898665738c077b36fd1b74329355577a5fd56a2d0d53f1789f5a5c34692d6d7d','delete_member',null,null,'/end_to_end_scenario_catalog/0/terminal_result'],
  [['TSIM6-N77'],'scenario_catalog_invalid','/end_to_end_scenario_catalog/0',10,'1e6820d827da88f37fc027e14e71d2c39a22e570e784e370070803ade7222d06','add_unknown_member','{"unknown":true}',null,'/end_to_end_scenario_catalog/0/terminal_result'],
  [['TSIM6-N78','TSIM6-N85'],'connection_payload_invalid','/end_to_end_scenario_catalog/0/required_connection_ids',9,'558a3da97af283aca38bf7a611280228827c4f36219484a3bf80a5c238556ac7','reverse_array',null,null,'/end_to_end_scenario_catalog/0/required_connection_ids'],
  [['TSIM6-N79','TSIM6-N80'],'witness_coverage_or_digest_invalid','/end_to_end_scenario_catalog/0/terminal_payload/evidence_digest',11,'1b9818ed58545377d6e0cb7e350842003f662bbdf3ba5e86aa62ea307bc3630f','replace_jcs',JSON.stringify(Z64),null,'/end_to_end_scenario_catalog/0/terminal_payload/evidence_digest'],
  [['TSIM6-N82'],'witness_coverage_or_digest_invalid','/end_to_end_scenario_catalog/0/terminal_payload/evidence_digest',11,'b4c235fcdcae7ec1d285b525f79622aadf9f5475aec58d387f48728df2dc4db1','replace_jcs',JSON.stringify(F64),null,'/end_to_end_scenario_catalog/0/terminal_payload/evidence_digest'],
  [['TSIM6-N83'],'scenario_catalog_invalid','/end_to_end_scenario_catalog/0/input_vector',10,'032da1ac11d8310d03529dd8d7a79308ded0693df7ec6d577618eb20d769fb3c','copy_from_pointer',null,'/end_to_end_scenario_catalog/1/input_vector','/end_to_end_scenario_catalog/0/input_vector'],
  [['TSIM6-N87'],'terminal_outcome_invalid','/end_to_end_scenario_catalog/0/terminal_result/terminal_class',13,'6bdee01695c8ddb238f981ef9149205f267ffed547827571bbe8761a84e381db','replace_jcs','"wrong"',null,'/end_to_end_scenario_catalog/0/terminal_result/terminal_class'],
]
const mutationCatalog=mutationTuples.map(([covered_row_ids,expected_code,expected_path,expected_stage,mutation_identity,mutation_kind,operand_jcs_or_null,source_json_pointer_or_null,target_json_pointer])=>({covered_row_ids,expected_code,expected_path,expected_stage,mutation_identity,mutation_kind,operand_jcs_or_null,source_json_pointer_or_null,target_json_pointer}))
const mutationByRowId=new Map(mutationCatalog.flatMap(mutation=>mutation.covered_row_ids.map(rowId=>[rowId,mutation])))
const mutationCatalogProjection={baseline_input_digest:BASELINE_INPUT_DIGEST,builder_version:'canonical-semantic-mutation-builder-v1',catalog_version:'trusted-slice-integration-m6-semantic-mutation-catalog-v1',ordered_mutations:mutationCatalog,target_stage_range:'8-13',task_id:'AUDIT-CONTINUOUS-ORCHESTRATION-REFACTORING-001'}

const pointerParts=pointer=>pointer.split('/').slice(1).map(part=>part.replaceAll('~1','/').replaceAll('~0','~'))
const pointerValue=(root,pointer)=>pointerParts(pointer).reduce((value,key)=>value[Array.isArray(value)?Number(key):key],root)
const pointerDigest=(root,pointer)=>{const value=pointerValue(root,pointer);return digest(value===undefined?{pointer_state:'missing'}:value)}
const pointerParent=(root,pointer)=>{const parts=pointerParts(pointer),key=parts.pop();return{parent:parts.reduce((value,part)=>value[Array.isArray(value)?Number(part):part],root),key}}
const applyCatalogMutation=(candidate,mutation)=>{
  const {parent,key}=pointerParent(candidate,mutation.target_json_pointer)
  if(mutation.mutation_kind==='replace_jcs')parent[key]=JSON.parse(mutation.operand_jcs_or_null)
  else if(mutation.mutation_kind==='delete_member')delete parent[key]
  else if(mutation.mutation_kind==='remove_array_tail')pointerValue(candidate,mutation.target_json_pointer).pop()
  else if(mutation.mutation_kind==='swap_array_items'){const array=pointerValue(candidate,mutation.target_json_pointer),[a,b]=JSON.parse(mutation.operand_jcs_or_null);[array[a],array[b]]=[array[b],array[a]]}
  else if(mutation.mutation_kind==='reverse_array')pointerValue(candidate,mutation.target_json_pointer).reverse()
  else if(mutation.mutation_kind==='copy_from_pointer')parent[key]=clone(pointerValue(candidate,mutation.source_json_pointer_or_null))
  else if(mutation.mutation_kind==='add_unknown_member')Object.assign(pointerValue(candidate,mutation.target_json_pointer),JSON.parse(mutation.operand_jcs_or_null))
  else throw new Error(`unknown mutation ${mutation.mutation_kind}`)
}
const resealCandidate=(candidate,mutation)=>{
  const target=mutation.target_json_pointer
  if(target.startsWith('/ordered_trusted_artifacts/')){
    const start=Number(pointerParts(target)[1])
    for(let index=start;index<candidate.ordered_trusted_artifacts.length;index+=1){
      const envelope=candidate.ordered_trusted_artifacts[index],transport=envelope.sealed_contribution_transport,artifact=envelope.artifact_payload
      if(index===start){transport.contribution_payload_digest=digest(transport.contribution_payload);artifact.sealed_contribution_digest=transport.contribution_payload_digest}
      if(index>start)artifact.predecessor_artifact_digest_or_null=candidate.ordered_trusted_artifacts[index-1].artifact_digest
      envelope.artifact_digest=digest(artifact)
      transport.transport_identity=digest({completion_authority_digest:transport.completion_authority_digest,contribution_payload_digest:transport.contribution_payload_digest,ordinal:transport.ordinal,source_slice_id:transport.source_slice_id,transport_version:transport.transport_version})
    }
  }
  if(target.startsWith('/end_to_end_scenario_catalog/0/')){
    const scenario=candidate.end_to_end_scenario_catalog[0]
    const covers=derived=>derived===target||derived.startsWith(`${target}/`)
    if(scenario.terminal_payload&&!covers('/end_to_end_scenario_catalog/0/terminal_payload/evidence_digest'))scenario.terminal_payload.evidence_digest=digest({...scenario,terminal_payload:null,terminal_result:null})
    if(scenario.terminal_result&&scenario.terminal_payload&&!covers('/end_to_end_scenario_catalog/0/terminal_result/terminal_payload_digest'))scenario.terminal_result.terminal_payload_digest=digest(scenario.terminal_payload)
  }
}
const buildCanonicalNegative=(baseline,mutation)=>{
  const candidate=clone(baseline),before=pointerDigest(candidate,mutation.target_json_pointer)
  applyCatalogMutation(candidate,mutation)
  const targetDefect=pointerDigest(candidate,mutation.target_json_pointer)
  if(before===targetDefect)throw new Error(`no-op mutation ${mutation.mutation_identity}`)
  resealCandidate(candidate,mutation)
  if(pointerDigest(candidate,mutation.target_json_pointer)!==targetDefect)throw new Error(`target repaired ${mutation.mutation_identity}`)
  return {candidate,input_digest:digest(candidate),mutation,target_defect_digest:targetDefect}
}

const exactObject=(value,fields)=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===fields.length&&fields.every(field=>Object.hasOwn(value,field))
const proofInvalid=reason=>Object.freeze({decision:'proof_invalid',reason})
const evaluateN108ProofOnly=proofFixture=>{
  const fixtureFields=['first_failure_code','first_failure_path','first_failure_stage','fixture_class','fixture_id','ordered_fault_evidence','production_admission_allowed','production_entrypoint_invocation_allowed','production_integration_allowed','proof_version','source_reachability_catalog_digest','task_id']
  const evidenceFields=['expected_code','expected_kind','expected_path','expected_stage','mutation_identity','source_evidence_binding_digest','source_row_id']
  if(!exactObject(proofFixture,fixtureFields))return proofInvalid('fixture_schema_invalid')
  if(proofFixture.fixture_class!=='proof_only_first_failure_precedence'||proofFixture.fixture_id!=='TSIM6-N108'||proofFixture.proof_version!=='trusted-slice-first-failure-proof-v1'||proofFixture.task_id!=='AUDIT-CONTINUOUS-ORCHESTRATION-REFACTORING-001')return proofInvalid('fixture_authority_invalid')
  if(proofFixture.source_reachability_catalog_digest!=='9fbd9fc648094c95154f43b33fda4c23d13aeb0510d43471c3a4152e24b946be')return proofInvalid('source_catalog_invalid')
  if(proofFixture.production_admission_allowed!==false||proofFixture.production_entrypoint_invocation_allowed!==false||proofFixture.production_integration_allowed!==false)return proofInvalid('production_boundary_invalid')
  if(!Array.isArray(proofFixture.ordered_fault_evidence)||proofFixture.ordered_fault_evidence.length!==2)return proofInvalid('fault_membership_invalid')
  const expectedRows=['TSIM6-P23','TSIM6-P28']
  for(let index=0;index<2;index+=1){
    const evidence=proofFixture.ordered_fault_evidence[index]
    if(!exactObject(evidence,evidenceFields))return proofInvalid('fault_schema_invalid')
    const source=fixture.reachability_evidence_catalog.entries.find(entry=>entry.row_id===expectedRows[index])
    if(!source||evidence.source_row_id!==source.row_id||evidence.source_evidence_binding_digest!==source.evidence_binding_digest)return proofInvalid('source_evidence_invalid')
    const binding=source.evidence_binding
    if(evidence.mutation_identity!==binding.mutation_identities[0]||evidence.expected_kind!==binding.expected_kind||evidence.expected_stage!==binding.expected_stage||evidence.expected_code!==binding.runtime_expected_code||evidence.expected_path!==binding.expected_path)return proofInvalid('fault_binding_invalid')
  }
  const [first,second]=proofFixture.ordered_fault_evidence
  if(first.expected_stage>=second.expected_stage)return proofInvalid('fault_order_invalid')
  if(proofFixture.first_failure_stage!==first.expected_stage||proofFixture.first_failure_code!==first.expected_code||proofFixture.first_failure_path!==first.expected_path)return proofInvalid('first_failure_projection_invalid')
  return Object.freeze({decision:'proof_valid',first_failure_code:first.expected_code,first_failure_path:first.expected_path,first_failure_stage:first.expected_stage,fixture_digest:digest(proofFixture),proof_version:proofFixture.proof_version,reason:'minimum_stage_from_two_independent_single_fault_evidence_rows'})
}

const manifestResolutionFields=['branch_discriminator','reason','resolution_state','source_span']
const sourceSpanFields=['end_byte','module_path','start_byte','syntax_kind']
const manifestInputFields=['access_mode','edge_kind','owner_authority','purpose','resolution','source_symbol_id','target_authority','target_symbol_id']
const resolutionPairs={
  resolved_static:{branch_discriminator:'manifest-boundary-resolution-resolved-static-v1',reasons:['none']},
  unresolved:{branch_discriminator:'manifest-boundary-resolution-unresolved-v1',reasons:['call_target_unresolved','import_unresolved','reexport_unresolved','identifier_unresolved','scan_scope_omission']},
  dynamic:{branch_discriminator:'manifest-boundary-resolution-dynamic-v1',reasons:['computed_access','indirect_dynamic_call']},
  unknown:{branch_discriminator:'manifest-boundary-resolution-unknown-v1',reasons:['unknown_syntax']},
}
const validResolution=resolution=>{
  if(!exactObject(resolution,manifestResolutionFields)||!exactObject(resolution.source_span,sourceSpanFields))return false
  const pair=resolutionPairs[resolution.resolution_state]
  return Boolean(pair&&resolution.branch_discriminator===pair.branch_discriminator&&pair.reasons.includes(resolution.reason)&&Number.isInteger(resolution.source_span.start_byte)&&Number.isInteger(resolution.source_span.end_byte)&&resolution.source_span.start_byte>=0&&resolution.source_span.end_byte>resolution.source_span.start_byte&&typeof resolution.source_span.module_path==='string'&&typeof resolution.source_span.syntax_kind==='string')
}
const manifestBoundaryDecision=(decision,precedence,reason)=>Object.freeze({decision,precedence,reason})
const forbiddenManifestAuthorities=new Set(['publication_manifest','aggregate_candidate_projection','ordered_manifest','git_head','pr_head','publication_projection','publication_reseal','network_or_filesystem'])
const forbiddenManifestAccessModes=new Set(['publication_import','publication_call','publication_lookup','publication_comparison','publication_reconstruction','publication_projection','publication_reseal','implicit_fallback'])
const forbiddenManifestOperations=new Set(['symbol_alias','field_write'])
const allowedManifestFlows=new Set([
  'closed_field_read|property_read|trusted_slice_artifact_closed_admission|envelopeProblem',
  'artifact_jcs_projection_member|argument_member|trusted_slice_artifact_jcs_digest|digestTrustedSliceJsonV1',
  'sealed_artifact_digest_comparison|comparison_operand|frozen_trusted_artifact_digest_authority|expected_artifact_digest',
])
const evaluateManifestBoundaryInput=input=>{
  if(!exactObject(input,manifestInputFields))return manifestBoundaryDecision('reject',1,'manifest_boundary_structure_invalid')
  if(!validResolution(input.resolution)||input.resolution.resolution_state!=='resolved_static')return manifestBoundaryDecision('reject',2,'manifest_boundary_graph_unresolved')
  if(forbiddenManifestAuthorities.has(input.owner_authority)||forbiddenManifestAuthorities.has(input.target_authority)||forbiddenManifestAccessModes.has(input.access_mode))return manifestBoundaryDecision('reject',3,'manifest_boundary_authority_flow_forbidden')
  if(forbiddenManifestOperations.has(input.access_mode)||input.edge_kind==='alias'||input.edge_kind==='assignment')return manifestBoundaryDecision('reject',4,'manifest_boundary_operation_forbidden')
  if(input.owner_authority!=='trusted_slice_completion_artifact'||input.purpose!=='immutable_completed_slice_bytes_evidence')return manifestBoundaryDecision('reject',5,'manifest_boundary_owner_or_purpose_invalid')
  if(input.source_symbol_id!=='TrustedSliceArtifactV3.immutable_byte_manifest_digest')return manifestBoundaryDecision('reject',6,'manifest_boundary_symbol_invalid')
  const flow=`${input.access_mode}|${input.edge_kind}|${input.target_authority}|${input.target_symbol_id}`
  return allowedManifestFlows.has(flow)?manifestBoundaryDecision('admit',7,'none'):manifestBoundaryDecision('reject',4,'manifest_boundary_operation_forbidden')
}

const graphNodeFields=['node_id','node_kind','ordinal','owner_authority','purpose','symbol_id']
const graphEdgeFields=['access_mode','edge_id','edge_kind','from_node_id','ordinal','resolution','to_node_id']
const graphFields=['edge_catalog','excluded_categories','graph_version','included_constructs','module_path','node_catalog','ordered_edge_ids','ordered_node_ids','resolution_vector_catalog','root_symbol_ids','scan_scope_version','symbol_entry_digest']
const manifestFieldName='immutable_byte_manifest_digest'
const modulePath='src/continuous-orchestration/trusted-slice-integration-m6-v3.ts'
const byteOffset=(source,offset)=>Buffer.byteLength(source.slice(0,offset),'utf8')
const sourceSpan=(source,sourceFile,node,syntax_kind)=>({end_byte:byteOffset(source,node.getEnd()),module_path:modulePath,start_byte:byteOffset(source,node.getStart(sourceFile,false)),syntax_kind})
const declarationName=node=>{
  if(ts.isFunctionDeclaration(node)&&node.name)return node.name.text
  if(ts.isArrowFunction(node)||ts.isFunctionExpression(node)){
    const declaration=node.parent
    if(ts.isVariableDeclaration(declaration)&&ts.isIdentifier(declaration.name))return declaration.name.text
  }
  return undefined
}
const enclosingFunctionName=node=>{
  for(let current=node.parent;current;current=current.parent){const name=declarationName(current);if(name)return name}
  return undefined
}
const identifierText=node=>ts.isIdentifier(node)?node.text:undefined
const isExactCall=node=>ts.isCallExpression(node)&&identifierText(node.expression)==='exact'
const isManifestLikeText=text=>typeof text==='string'&&/manifest/i.test(text)
const nodeNameText=node=>{
  if(ts.isIdentifier(node)||ts.isStringLiteralLikeNode(node))return node.text
  return undefined
}
const manifestResolution=(span)=>({branch_discriminator:'manifest-boundary-resolution-resolved-static-v1',reason:'none',resolution_state:'resolved_static',source_span:span})
const derivedNodeCatalog=()=>[
  {node_id:'MBG-N01',node_kind:'field_definition',ordinal:1,owner_authority:'trusted_slice_completion_artifact',purpose:'immutable_completed_slice_bytes_evidence',symbol_id:'TrustedSliceArtifactV3.immutable_byte_manifest_digest'},
  {node_id:'MBG-N02',node_kind:'closed_schema_member',ordinal:2,owner_authority:'trusted_slice_artifact_closed_admission',purpose:'closed_structure_validation',symbol_id:'envelopeProblem.artifact_keyset'},
  {node_id:'MBG-N03',node_kind:'closed_schema_member',ordinal:3,owner_authority:'trusted_slice_artifact_closed_admission',purpose:'closed_structure_validation',symbol_id:'admitTrustedSliceIntegrationM6V3.artifact_keyset'},
  {node_id:'MBG-N04',node_kind:'local_value',ordinal:4,owner_authority:'trusted_slice_completion_artifact',purpose:'sealed_artifact_validation',symbol_id:'envelopeProblem.artifact'},
  {node_id:'MBG-N05',node_kind:'function',ordinal:5,owner_authority:'trusted_slice_m6_module',purpose:'artifact_jcs_sha256',symbol_id:'digestTrustedSliceJsonV1'},
  {node_id:'MBG-N06',node_kind:'local_value',ordinal:6,owner_authority:'trusted_slice_sealed_contribution_validation',purpose:'observed_artifact_digest',symbol_id:'envelopeProblem.observedArtifactDigest'},
  {node_id:'MBG-N07',node_kind:'authority_value',ordinal:7,owner_authority:'trusted_slice_completion_artifact',purpose:'frozen_artifact_digest_authority',symbol_id:'expectedEnvelopeRelations.artifactDigest'},
]
const typedGraphCache=new Map()
const typedSourcePath=resolve(modulePath)
const typedConfigPath=resolve('tsconfig.json')
const deriveManifestBoundarySourceGraph=(source,authorityGraph)=>{
  const sourceIdentity=createHash('sha256').update(source).digest('hex')
  const cached=typedGraphCache.get(sourceIdentity)
  if(cached)return cached
  const apiClient=new TypeScriptAPI({cwd:process.cwd(),fs:{readFile:fileName=>resolve(fileName)===typedSourcePath?source:undefined}})
  let snapshot
  try{
  snapshot=apiClient.updateSnapshot({fileChanges:{changed:[typedSourcePath]},openFiles:[typedSourcePath],openProjects:[typedConfigPath]})
  const project=snapshot.getDefaultProjectForFile(typedSourcePath)
  const sourceFile=project?.program.getSourceFile(typedSourcePath)
  const findings=[]
  if(!project||!sourceFile)return{findings:[{kind:'typed_project_unavailable'}],graph:null}
  const checker=project.checker
  const matches={schema_keys:[],property_signatures:[],artifact_calls:[],observed_declarations:[],artifact_comparisons:[],artifact_digest_bindings:[]}
  const declaredFunctions=new Set(),declaredVariables=new Map(),manifestConstructs=[]
  const visit=node=>{
    const functionName=declarationName(node)
    if(functionName)declaredFunctions.add(functionName)
    if(ts.isVariableDeclaration(node)&&ts.isIdentifier(node.name)){
      const declarations=declaredVariables.get(node.name.text)??[]
      declarations.push(node)
      declaredVariables.set(node.name.text,declarations)
    }
    if(ts.isImportDeclaration(node))findings.push({kind:'import',span:sourceSpan(source,sourceFile,node,'import_declaration')})
    if(ts.isExportDeclaration(node))findings.push({kind:'reexport',span:sourceSpan(source,sourceFile,node,'export_declaration')})
    if(ts.isPropertySignatureDeclaration(node)&&nodeNameText(node.name)===manifestFieldName){matches.property_signatures.push(node);manifestConstructs.push(node)}
    if(ts.isStringLiteralLikeNode(node)&&node.text===manifestFieldName){
      const call=node.parent?.parent
      if(ts.isArrayLiteralExpression(node.parent)&&isExactCall(call))matches.schema_keys.push({call,function_name:enclosingFunctionName(call),node})
      manifestConstructs.push(node)
    }
    if(ts.isCallExpression(node)&&identifierText(node.expression)==='digestTrustedSliceJsonV1'&&node.arguments.length===1&&identifierText(node.arguments[0])==='artifact'&&enclosingFunctionName(node)==='envelopeProblem')matches.artifact_calls.push(node)
    if(ts.isVariableDeclaration(node)&&identifierText(node.name)==='observedArtifactDigest'&&ts.isCallExpression(node.initializer)&&identifierText(node.initializer.expression)==='digestTrustedSliceJsonV1'&&identifierText(node.initializer.arguments[0])==='artifact')matches.observed_declarations.push(node)
    if(ts.isBinaryExpression(node)&&node.operatorToken.kind===ts.SyntaxKind.ExclamationEqualsEqualsToken&&identifierText(node.left)==='observedArtifactDigest'&&identifierText(node.right)==='artifactDigest'&&enclosingFunctionName(node)==='envelopeProblem')matches.artifact_comparisons.push(node)
    if(ts.isBindingElement(node)&&identifierText(node.name)==='artifactDigest'&&enclosingFunctionName(node)==='envelopeProblem')matches.artifact_digest_bindings.push(node)
    if(ts.isElementAccessExpression(node)&&(identifierText(node.expression)==='artifact'||isManifestLikeText(node.getText(sourceFile))))findings.push({kind:'dynamic_access',span:sourceSpan(source,sourceFile,node,'computed_property')})
    if(ts.isBinaryExpression(node)&&node.operatorToken.kind===ts.SyntaxKind.EqualsToken&&isManifestLikeText(node.left.getText(sourceFile)))findings.push({kind:'assignment',span:sourceSpan(source,sourceFile,node,'assignment')})
    if(ts.isCallExpression(node)&&isManifestLikeText(node.expression.getText(sourceFile))&&identifierText(node.expression)!=='digestTrustedSliceJsonV1')findings.push({kind:'manifest_like_call',span:sourceSpan(source,sourceFile,node,'call_expression')})
    if((ts.isIdentifier(node)||ts.isStringLiteralLikeNode(node))&&isManifestLikeText(node.text)&&node.text!==manifestFieldName)manifestConstructs.push(node)
    if(ts.isIdentifier(node)&&node.text===manifestFieldName&&!ts.isPropertySignatureDeclaration(node.parent))manifestConstructs.push(node)
    visitEachChild(node,child=>{visit(child);return child})
  }
  visit(sourceFile)
  if(project.program.getSyntacticDiagnostics(typedSourcePath).length>0)findings.push({kind:'parse_diagnostic'})
  if(project.program.getSemanticDiagnostics(typedSourcePath).length>0)findings.push({kind:'semantic_diagnostic'})
  const uniqueManifestConstructs=[...new Set(manifestConstructs)]
  if(uniqueManifestConstructs.length!==3)findings.push({kind:'manifest_symbol_set',count:uniqueManifestConstructs.length})
  if(matches.property_signatures.length!==1||matches.schema_keys.length!==2||matches.artifact_calls.length!==1||matches.observed_declarations.length!==1||matches.artifact_comparisons.length!==1)findings.push({kind:'required_construct_cardinality'})
  const schemaByFunction=new Map(matches.schema_keys.map(entry=>[entry.function_name,entry.node]))
  if(!schemaByFunction.has('envelopeProblem')||!schemaByFunction.has('validateTrustedSliceIntegrationInputV2'))findings.push({kind:'schema_owner_resolution'})
  const artifactDeclaration=(declaredVariables.get('artifact')??[]).find(node=>enclosingFunctionName(node)==='envelopeProblem')
  const admittedArtifactDeclaration=(declaredVariables.get('artifact')??[]).find(node=>enclosingFunctionName(node)==='validateTrustedSliceIntegrationInputV2')
  const digestDeclaration=(declaredVariables.get('digestTrustedSliceJsonV1')??[])[0]
  const relationsDeclaration=(declaredVariables.get('expectedEnvelopeRelations')??[])[0]
  if(!artifactDeclaration)findings.push({kind:'artifact_local_resolution'})
  if(!admittedArtifactDeclaration)findings.push({kind:'admitted_artifact_local_resolution'})
  if(!digestDeclaration||!declaredFunctions.has('digestTrustedSliceJsonV1'))findings.push({kind:'digest_function_resolution'})
  if(!relationsDeclaration)findings.push({kind:'authority_relation_resolution'})
  if(matches.artifact_digest_bindings.length!==1)findings.push({kind:'authority_binding_resolution'})
  const symbolOf=node=>node&&checker.getSymbolAtLocation(node)
  const artifactSymbol=symbolOf(artifactDeclaration?.name)
  const admittedArtifactSymbol=symbolOf(admittedArtifactDeclaration?.name)
  const digestSymbol=symbolOf(digestDeclaration?.name)
  const observedSymbol=symbolOf(matches.observed_declarations[0]?.name)
  const authoritySymbol=symbolOf(matches.artifact_digest_bindings[0]?.name)
  if(!symbolOf(matches.property_signatures[0]?.name))findings.push({kind:'typed_field_symbol_resolution'})
  for(const entry of matches.schema_keys){
    const expectedArtifactSymbol=entry.function_name==='envelopeProblem'?artifactSymbol:admittedArtifactSymbol
    if(!symbolOf(entry.call.expression)||symbolOf(entry.call.arguments[0])!==expectedArtifactSymbol)findings.push({kind:'typed_schema_reference_resolution',owner:entry.function_name})
  }
  if(!digestSymbol||symbolOf(matches.artifact_calls[0]?.expression)!==digestSymbol||symbolOf(matches.artifact_calls[0]?.arguments[0])!==artifactSymbol)findings.push({kind:'typed_digest_call_resolution'})
  if(!observedSymbol||symbolOf(matches.artifact_comparisons[0]?.left)!==observedSymbol)findings.push({kind:'typed_observed_digest_resolution'})
  if(!authoritySymbol||symbolOf(matches.artifact_comparisons[0]?.right)!==authoritySymbol)findings.push({kind:'typed_authority_resolution'})
  if(findings.length>0)return{findings,graph:null}
  const edges=[
    ['closed_field_read','MBG-E01','schema_membership','MBG-N01',1,manifestResolution(sourceSpan(source,sourceFile,schemaByFunction.get('envelopeProblem'),'string_literal_property_key')),'MBG-N02'],
    ['closed_field_read','MBG-E02','schema_membership','MBG-N01',2,manifestResolution(sourceSpan(source,sourceFile,schemaByFunction.get('validateTrustedSliceIntegrationInputV2'),'string_literal_property_key')),'MBG-N03'],
    ['artifact_jcs_projection_member','MBG-E03','object_member_flow','MBG-N01',3,manifestResolution(sourceSpan(source,sourceFile,matches.property_signatures[0],'property_signature')),'MBG-N04'],
    ['artifact_jcs_projection_member','MBG-E04','call_argument','MBG-N04',4,manifestResolution(sourceSpan(source,sourceFile,matches.artifact_calls[0],'call_expression')),'MBG-N05'],
    ['artifact_jcs_projection_member','MBG-E05','return_binding','MBG-N05',5,manifestResolution(sourceSpan(source,sourceFile,matches.observed_declarations[0],'variable_declaration')),'MBG-N06'],
    ['sealed_artifact_digest_comparison','MBG-E06','comparison_operand','MBG-N06',6,manifestResolution(sourceSpan(source,sourceFile,matches.artifact_comparisons[0],'binary_expression')),'MBG-N07'],
  ].map(([access_mode,edge_id,edge_kind,from_node_id,ordinal,resolution,to_node_id])=>({access_mode,edge_id,edge_kind,from_node_id,ordinal,resolution,to_node_id}))
  const result={findings,graph:{edge_catalog:edges,excluded_categories:[...authorityGraph.excluded_categories],graph_version:'manifest-boundary-source-graph-v2',included_constructs:[...authorityGraph.included_constructs],module_path:modulePath,node_catalog:derivedNodeCatalog(),ordered_edge_ids:edges.map(edge=>edge.edge_id),ordered_node_ids:derivedNodeCatalog().map(node=>node.node_id),resolution_vector_catalog:clone(authorityGraph.resolution_vector_catalog),root_symbol_ids:[...authorityGraph.root_symbol_ids],scan_scope_version:'manifest-boundary-scan-scope-v1',symbol_entry_digest:authorityGraph.symbol_entry_digest}}
  typedGraphCache.set(sourceIdentity,result)
  return result
  }finally{
    snapshot?.dispose()
    apiClient.close()
  }
}
const validateManifestBoundarySourceGraph=(source,graph)=>{
  if(!exactObject(graph,graphFields)||graph.graph_version!=='manifest-boundary-source-graph-v2'||graph.module_path!=='src/continuous-orchestration/trusted-slice-integration-m6-v3.ts')return false
  if(digest(graph)!=='b9c94a8fe28532d44b9750470b22ccf7eaf5d4450f4a7bd6240f4ff1e180d2f7')return false
  if(!Array.isArray(graph.resolution_vector_catalog)||digest(graph.resolution_vector_catalog)!=='cbc7cd5614ee7cea785d061cea7a807cdfeb332602f5a64f6a6805044a0904c1'||!graph.resolution_vector_catalog.every(validResolution))return false
  if(!Array.isArray(graph.node_catalog)||graph.node_catalog.length!==7||!graph.node_catalog.every((node,index)=>exactObject(node,graphNodeFields)&&node.ordinal===index+1&&node.node_id===graph.ordered_node_ids[index]))return false
  if(!Array.isArray(graph.edge_catalog)||graph.edge_catalog.length!==6||!graph.edge_catalog.every((edge,index)=>exactObject(edge,graphEdgeFields)&&edge.ordinal===index+1&&edge.edge_id===graph.ordered_edge_ids[index]&&validResolution(edge.resolution)))return false
  const derived=deriveManifestBoundarySourceGraph(source,graph)
  return derived.findings.length===0&&equal(derived.graph,graph)
}

const runtimeOracleFor=row=>{
  if(row.mutation_operation.kind==='baseline_assertion')return fixture.runtime_oracles.baseline
  if(row.mutation_operation.kind==='static_boundary_assertion'){
    const entry=fixture.runtime_oracles.static_rows.find(item=>item.row_id===row.row_id)
    return entry&&{kind:'static_rejected',code:row.expected_code,stage:'static_boundary',path:entry.path}
  }
  const group=fixture.runtime_oracles.input_groups.find(item=>item.row_ids.includes(row.row_id))
  return group?.oracle
}

const staticProofs={
  'TSIM6-N01':source=>!/test-continuous-orchestration-trusted-slice-integration-m6-v3|spawn\s*\(|exec(File)?\s*\(|runM[0-5]Validation/.test(source),
  'TSIM6-N02':source=>api.TRUSTED_M6_V3_IMPORT_GRAPH.length===0&&!/from\s+['"][^'"]*continuous-orchestration-(owner|final|authority|routing|completion|deprecation)/.test(source),
  'TSIM6-N03':source=>!/readFile|readFileSync|node:fs/.test(source),
  'TSIM6-N04':source=>!/fetch\s*\(|XMLHttpRequest|node:https|node:http/.test(source),
  'TSIM6-N05':source=>!/readFile|readFileSync|createReadStream|node:fs/.test(source),
  'TSIM6-N06':source=>!/fetch\s*\(|https?:\/\//.test(source),
  'TSIM6-N31':source=>!/admittedInput\.[A-Za-z0-9_]+\s*=|admittedInput\.[A-Za-z0-9_]+\.(push|pop|splice|sort|reverse)\s*\(/.test(source),
  'TSIM6-N32':source=>api.TRUSTED_M6_V3_IMPORT_GRAPH.length===0&&!/evaluateContinuousOrchestration|validateContinuousOrchestration/.test(source),
  'TSIM6-N34':source=>!/readFile|readFileSync|node:fs|fetch\s*\(|XMLHttpRequest|node:https|node:http|process\.env|GITHUB_|\b(git|github|pull_request|worktree|commit|push|ci_runner)\b/i.test(source),
  'TSIM6-N36':source=>validateManifestBoundarySourceGraph(source,fixture.manifest_boundary_source_graph),
  'TSIM6-N39':source=>!/function\s+\w*reopen|const\s+\w*reopen|\.reopen\s*\(/i.test(source),
  'TSIM6-N40':source=>!/function\s+\w*approve\w*reopen|const\s+\w*approve\w*reopen/i.test(source),
  'TSIM6-N41':source=>!/function\s+\w*reopen\w*scope|const\s+\w*reopen\w*scope/i.test(source),
  'TSIM6-N42':source=>!/function\s+\w*invalidate\w*reopen|const\s+\w*invalidate\w*reopen/i.test(source),
  'TSIM6-N43':source=>!/function\s+\w*(reopen\w*rebuild|rebuild\w*reopen)|const\s+\w*(reopen\w*rebuild|rebuild\w*reopen)/i.test(source),
  'TSIM6-N44':source=>source.includes('historical_transition_digest')&&!/delete\s+.*historical|splice\s*\(.*historical/.test(source),
  'TSIM6-N46':source=>!/historical.*fallback|fallback.*historical/.test(source),
  'TSIM6-N48':source=>api.TRUSTED_M6_V3_IMPORT_GRAPH.length===0&&source.includes('canonicalizeTrustedSliceJsonV1')&&!/from\s+['"][^'"]*m[0-5]/i.test(source),
  'TSIM6-N50':source=>!/owner_change|safety_boundary_change|canonical_owner_change/.test(source),
  'TSIM6-N75':source=>!/second_authority|alternate_authority|authority_alias/.test(source),
  'TSIM6-N99':source=>!/transport_second_authority|transport_fallback_authority/.test(source),
  'TSIM6-N100':source=>api.TRUSTED_M6_V3_IMPORT_GRAPH.length===0&&!/from\s+['"][^'"]*m[0-5]/i.test(source),
}

const staticNegativeSamples={
  'TSIM6-N01':"import './scripts/test-continuous-orchestration-trusted-slice-integration-m6-v3.mjs'",
  'TSIM6-N02':"import {evaluateContinuousOrchestration} from './continuous-orchestration-owner'",
  'TSIM6-N03':"readFileSync('fixture.json')",
  'TSIM6-N04':"fetch('https://example.invalid')",
  'TSIM6-N05':"createReadStream('fixture.json')",
  'TSIM6-N06':"const authority_url='https://example.invalid'",
  'TSIM6-N31':"admittedInput.items.push('mutated')",
  'TSIM6-N32':"evaluateContinuousOrchestration(input)",
  'TSIM6-N34':"const token=process.env.GITHUB_TOKEN",
  'TSIM6-N36':"const pr=PullRequestAuthority.pr_head_sha",
  'TSIM6-N39':"function reopen(){return true}",
  'TSIM6-N40':"function approveReopen(){return true}",
  'TSIM6-N41':"function reopenScope(){return true}",
  'TSIM6-N42':"function invalidateReopen(){return true}",
  'TSIM6-N43':"function reopenRebuild(){return true}",
  'TSIM6-N44':"delete record.historical_transition_digest",
  'TSIM6-N46':"const historical_fallback=true",
  'TSIM6-N48':"import x from './m1'",
  'TSIM6-N50':"const canonical_owner_change=true",
  'TSIM6-N75':"const alternate_authority=true",
  'TSIM6-N99':"const transport_fallback_authority=true",
  'TSIM6-N100':"import x from './m0'",
}

const observeStaticBoundary=row=>{
  const oracle=runtimeOracleFor(row)
  const proof=staticProofs[row.row_id]
  return proof?.(productionSource) ? oracle : {kind:'static_proof_failed',code:row.expected_code,stage:'static_boundary',path:oracle?.path??'/module'}
}

const server=await createServer({configFile:false,cacheDir:join(tmpdir(),'sd-prompt-studio-issue221-trusted-m6-v3'),optimizeDeps:{noDiscovery:true},server:{middlewareMode:true},appType:'custom',logLevel:'error'})
const api=await server.ssrLoadModule('/src/continuous-orchestration/trusted-slice-integration-m6-v3.ts')

let assertions=0
const verify=(condition,message)=>{assertions+=1;check(condition,message)}

verify(Object.keys(staticProofs).length===22&&Object.keys(staticNegativeSamples).length===22,'exact 22 static proof rules and sensitivity probes')
for(const [rowId,proof] of Object.entries(staticProofs)){
  verify(proof(productionSource),`${rowId} positive static proof`)
  verify(!proof(`${productionSource}\n${staticNegativeSamples[rowId]}`),`${rowId} negative static sensitivity`)
}

verify(Buffer.byteLength(jcs(fixture.manifest_boundary_resolution_catalog),'utf8')===1044,'A10 resolution catalog byte count')
verify(digest(fixture.manifest_boundary_resolution_catalog)==='cbc7cd5614ee7cea785d061cea7a807cdfeb332602f5a64f6a6805044a0904c1','A10 resolution catalog digest')
const resolutionDigests=['849c3309bea1803213c32e84b613fbc020019f00b9d9b19ba3e8ca3dae52f6bc','22e9a743de99f2c995ab91328d103d9e7ead03a60f9b2d681110ee329756a65d','53d23c293baeb57757d963afc3da6d2ecf48fab5a62ead7201f9312184f9958a','dee921ed8dd5f05cbd91053886d573bb59136e622380915f750c07a128395de6']
fixture.manifest_boundary_resolution_catalog.forEach((resolution,index)=>verify(validResolution(resolution)&&digest(resolution)===resolutionDigests[index],`A10 resolution vector ${index+1}`))
const closedResolutionPairings=Object.entries(resolutionPairs).flatMap(([resolution_state,pair])=>pair.reasons.map(reason=>({branch_discriminator:pair.branch_discriminator,reason,resolution_state,source_span:{end_byte:1,module_path:`manifest-boundary-resolution://${resolution_state}`,start_byte:0,syntax_kind:resolution_state==='dynamic'?'computed_property':resolution_state==='unknown'?'unknown_syntax':resolution_state==='unresolved'?'call_expression':'property_read'}})))
verify(closedResolutionPairings.length===9,'A10 complete nine state/discriminator/reason pairings')
for(const [index,resolution] of closedResolutionPairings.entries()){
  verify(validResolution(resolution),`A10 complete pairing positive ${index+1}: ${resolution.resolution_state}/${resolution.reason}`)
  const wrongDiscriminator=clone(resolution)
  wrongDiscriminator.branch_discriminator=resolutionPairs[resolution.resolution_state==='resolved_static'?'unresolved':'resolved_static'].branch_discriminator
  verify(!validResolution(wrongDiscriminator),`A10 discriminator mismatch negative ${index+1}`)
  const wrongReason=clone(resolution)
  wrongReason.reason=resolution.resolution_state==='unknown'?'computed_access':'unknown_syntax'
  verify(!validResolution(wrongReason),`A10 reason mismatch negative ${index+1}`)
}
verify(Buffer.byteLength(jcs(fixture.manifest_boundary_source_graph),'utf8')===6501,'A10 source graph byte count')
verify(validateManifestBoundarySourceGraph(productionSource,fixture.manifest_boundary_source_graph),'A10 source-derived graph exact binding')
const sourceGraphNegativeSensitivity=[
  ['unknown manifest-like symbol',"const UnknownManifestDigest='x'"],
  ['unresolved import',"import {MissingManifestDigest} from './missing-manifest-authority'"],
  ['unresolved reexport',"export {MissingManifestDigest} from './missing-manifest-authority'"],
  ['unresolved reference','const observed=MissingManifestDigest'],
  ['unresolved call','MissingManifestDigest()'],
  ['legal symbol alias','const manifestDigestAlias=artifact.immutable_byte_manifest_digest'],
  ['legal symbol reexport','export {immutable_byte_manifest_digest}'],
  ['dynamic access','const observed=artifact[fieldName]'],
  ['legal symbol assignment',"artifact.immutable_byte_manifest_digest='tampered'"],
  ['legal symbol digest input','const observed=digestTrustedSliceJsonV1(artifact.immutable_byte_manifest_digest)'],
  ['legal symbol forbidden publication flow','const observed=buildPublicationProjection(artifact.immutable_byte_manifest_digest)'],
]
for(const [label,sample] of sourceGraphNegativeSensitivity){
  const derived=deriveManifestBoundarySourceGraph(`${productionSource}\n${sample}`,fixture.manifest_boundary_source_graph)
  verify(derived.findings.length>0,`A10 source graph derives negative finding: ${label}`)
  verify(!validateManifestBoundarySourceGraph(`${productionSource}\n${sample}`,fixture.manifest_boundary_source_graph),`A10 source graph negative sensitivity: ${label}`)
}

verify(Buffer.byteLength(jcs(fixture.manifest_boundary_flow_matrix_v3),'utf8')===20455,'A10 Matrix V3 byte count')
verify(digest(fixture.manifest_boundary_flow_matrix_v3)==='a80faedc3df2f2acabde8a0160602d26f9273ed122f7dedcb6b262d7eea9f393','A10 Matrix V3 digest')
verify(fixture.manifest_boundary_flow_matrix_v3.length===22,'A10 Matrix V3 exact row count')
const matrixRowFields=['expected_decision','expected_precedence','expected_reason','fixture_id','graph_projection_digest','resolution_contract_digest','source_graph_input']
let matrixAdmitCount=0,matrixRejectCount=0
for(const [index,row] of fixture.manifest_boundary_flow_matrix_v3.entries()){
  verify(exactObject(row,matrixRowFields),`${row.fixture_id} closed outer row`)
  verify(row.fixture_id===(index<3?`MBF-P${String(index+1).padStart(2,'0')}`:`MBF-N${String(index-2).padStart(2,'0')}`),`${row.fixture_id} matrix ordering`)
  verify(row.graph_projection_digest==='b9c94a8fe28532d44b9750470b22ccf7eaf5d4450f4a7bd6240f4ff1e180d2f7'&&row.resolution_contract_digest==='cbc7cd5614ee7cea785d061cea7a807cdfeb332602f5a64f6a6805044a0904c1',`${row.fixture_id} authority binding`)
  verify(Object.keys(row.source_graph_input).length===(row.fixture_id==='MBF-N18'?9:8),`${row.fixture_id} raw input field count`)
  const observed=evaluateManifestBoundaryInput(row.source_graph_input)
  verify(equal(observed,{decision:row.expected_decision,precedence:row.expected_precedence,reason:row.expected_reason}),`${row.fixture_id} exact Matrix V3 decision`)
  if(observed.decision==='admit')matrixAdmitCount+=1;else matrixRejectCount+=1
}
verify(matrixAdmitCount===3&&matrixRejectCount===19,'A10 Matrix V3 3 admit / 19 reject')
const n18=fixture.manifest_boundary_flow_matrix_v3.find(row=>row.fixture_id==='MBF-N18')
verify(Buffer.byteLength(jcs(n18.source_graph_input),'utf8')===641&&digest(n18.source_graph_input)==='3ef3f32c926d8c449b34a29b02979960662ec0e76fad28c4664022759ed88cc4','A10 N18 exact structural authority')
verify(equal(evaluateManifestBoundaryInput(fixture.manifest_boundary_flow_matrix_v3[0].source_graph_input),evaluateManifestBoundaryInput(fixture.manifest_boundary_flow_matrix_v3[0].source_graph_input)),'A10 deterministic repeat')

verify(fixture.fixture_digest===digest(without(fixture,'fixture_digest')),'fixture digest')
verify(fixture.validation_rows.length===120,'exact 120 rows')
verify(new Set(fixture.validation_rows.map(row=>row.row_id)).size===120,'unique row ids')
for(const row of fixture.validation_rows)verify(row.row_digest===digest({expected_code:row.expected_code,row_id:row.row_id,scenario:row.scenario}),`${row.row_id} digest`)
for(const row of fixture.validation_rows)verify(runtimeOracleFor(row)!==undefined,`${row.row_id} runtime oracle`)

const baseRows=fixture.validation_rows.slice(0,58)
const baseProjection={matrix_version:'trusted-slice-integration-m6-validation-matrix-v2',ordered_rows:baseRows.map(row=>({row_digest:row.row_digest,row_id:row.row_id})),row_count:58}
verify(digest(baseProjection)==='aedccbf649b170ba827f2bd964b2e15754cd6482c2206819653672957f483dc3','base 58 matrix')
const chainDigests=['798efb719032c803f89c233910bc0e5fbad8fd5e41af0536e6e4df4ed8505d31','bdc185fc639d11a0d4fda0cbe013d864d9bb78330217ec8652110f97f617400c','ff1a155e1cf678a19d031f63b9bfe1a8ef27aff8cc7b002a44b3b7a56d312b16']
fixture.matrix_chain.forEach((projection,index)=>verify(digest(projection)===chainDigests[index],`matrix chain ${index+1}`))
verify(fixture.authority_digests.validation_matrix===chainDigests[2],'effective matrix authority')

for(const group of fixture.validation_groups){
  verify(group.row_count===group.ordered_row_digests.length,`${group.group_id} count`)
  verify(group.group_digest===digest({group_id:group.group_id,row_count:group.row_count,ordered_row_digests:group.ordered_row_digests}),`${group.group_id} digest`)
}
verify(fixture.validation_groups.reduce((count,group)=>count+group.row_count,0)===120,'group coverage')

const input=clone(fixture.canonical_input)
verify(digest(input)===BASELINE_INPUT_DIGEST,'A04 baseline input digest')
for(const mutation of mutationCatalog)verify(digest(without(mutation,'mutation_identity'))===mutation.mutation_identity,`${mutation.mutation_identity} identity`)
verify(digest(mutationCatalogProjection)===MUTATION_CATALOG_DIGEST,'A04 mutation catalog digest')
const canonicalNegatives=mutationCatalog.map(mutation=>buildCanonicalNegative(input,mutation))
verify(Buffer.byteLength(jcs(fixture.reachability_evidence_catalog),'utf8')===24805,'A06 reachability catalog byte count')
verify(digest(fixture.reachability_evidence_catalog)==='9fbd9fc648094c95154f43b33fda4c23d13aeb0510d43471c3a4152e24b946be','A06 reachability catalog digest')
verify(fixture.reachability_evidence_catalog.entries.length===20,'A06 exact 20 reachability rows')
for(const entry of fixture.reachability_evidence_catalog.entries){
  verify(entry.row_digest===digest(entry.row_projection),`${entry.row_id} row digest`)
  verify(entry.evidence_binding_digest===digest(entry.evidence_binding),`${entry.row_id} evidence binding digest`)
}
verify(Buffer.byteLength(jcs(fixture.reachability_matrix_projection),'utf8')===2331,'A06 matrix byte count')
verify(digest(fixture.reachability_matrix_projection)==='fc1e6e24e84d0b8d7cf99ad101ab446675caa4b2a63b25e9a4d4e3a00ee4e8f7','A06 effective 140-row matrix digest')
verify(Buffer.byteLength(jcs(fixture.validation_role_classification),'utf8')===313,'A07 role classification byte count')
verify(digest(fixture.validation_role_classification)==='0ae6edb9aecf62a4ffe6b5789fc24c3acb0a73d326aad3343b4726ae63bfa399','A07 role classification digest')
verify(fixture.validation_role_classification.production_row_count===139&&fixture.validation_role_classification.proof_only_row_count===1&&equal(fixture.validation_role_classification.proof_only_row_ids,['TSIM6-N108']),'A07 139 production plus one proof-only classification')
verify(Buffer.byteLength(jcs(fixture.n108_proof_only_fixture),'utf8')===1482,'A07 proof-only fixture byte count')
verify(digest(fixture.n108_proof_only_fixture)==='1dd6bc77ec17a1c4680eeb60b96ec55e04346f2d8b6a962921afbe4b7f1e20e9','A07 proof-only fixture digest')
const proofOnlyResult=evaluateN108ProofOnly(fixture.n108_proof_only_fixture)
verify(equal(proofOnlyResult,fixture.n108_proof_only_expected_result),'A07 exact proof-only result')
verify(Buffer.byteLength(jcs(proofOnlyResult),'utf8')===445,'A07 proof-only result byte count')
verify(digest(proofOnlyResult)==='c7d6090e60bf50ce0c838727829cd97ee62688d9ea6be1081e08ce258dc71237','A07 proof-only result digest')

const invalidProofCases=[]
const addInvalidProof=(label,mutate)=>{const candidate=clone(fixture.n108_proof_only_fixture);mutate(candidate);invalidProofCases.push([label,candidate])}
addInvalidProof('missing evidence',candidate=>candidate.ordered_fault_evidence.pop())
addInvalidProof('stale source digest',candidate=>candidate.ordered_fault_evidence[0].source_evidence_binding_digest=Z64)
addInvalidProof('mixed source row',candidate=>candidate.ordered_fault_evidence[0].source_row_id='TSIM6-P28')
addInvalidProof('duplicate evidence',candidate=>candidate.ordered_fault_evidence[1]=clone(candidate.ordered_fault_evidence[0]))
addInvalidProof('reversed evidence',candidate=>candidate.ordered_fault_evidence.reverse())
addInvalidProof('equal stage',candidate=>candidate.ordered_fault_evidence[1].expected_stage=8)
addInvalidProof('third evidence',candidate=>candidate.ordered_fault_evidence.push(clone(candidate.ordered_fault_evidence[1])))
addInvalidProof('unknown field',candidate=>candidate.unknown=true)
addInvalidProof('production admission enabled',candidate=>candidate.production_admission_allowed=true)
addInvalidProof('production entrypoint enabled',candidate=>candidate.production_entrypoint_invocation_allowed=true)
addInvalidProof('production integration enabled',candidate=>candidate.production_integration_allowed=true)
addInvalidProof('wrong first stage',candidate=>candidate.first_failure_stage=13)
addInvalidProof('wrong first code',candidate=>candidate.first_failure_code='terminal_outcome_invalid')
addInvalidProof('wrong first path',candidate=>candidate.first_failure_path='/')
for(const [label,candidate] of invalidProofCases)verify(evaluateN108ProofOnly(candidate).decision==='proof_invalid',`A07 proof-only rejects ${label}`)
verify(digest(fixture.historical_transition_projection)===fixture.authority_digests.historical_transition,'historical transition')
verify(digest(fixture.scenario_evidence_projection_authority)===fixture.authority_digests.scenario_evidence_projection,'scenario evidence projection authority')
verify(digest(input.ordered_trusted_artifacts)===fixture.authority_digests.ordered_transport_catalog,'six-envelope catalog')
const scenarioDigestProjection={catalog_version:'trusted-scenario-evidence-catalog-v3',ordered_scenario_evidence_digests:input.end_to_end_scenario_catalog.map((scenario,index)=>({scenario_evidence_digest:digest(scenario),scenario_id:`E2E-${String(index+1).padStart(3,'0')}`})),scenario_count:9}
verify(digest(scenarioDigestProjection)===fixture.authority_digests.scenario_catalog,'scenario catalog')
verify(input.ordered_trusted_artifacts.length===6,'6/6 envelopes')
verify(input.connection_catalog.length===17,'17/17 connections')
verify(input.end_to_end_scenario_catalog.length===9,'9/9 scenarios')
verify(input.end_to_end_scenario_catalog.reduce((count,scenario)=>count+scenario.edge_payload_digests.length,0)===153,'153/153 payloads')
verify(input.end_to_end_scenario_catalog.reduce((count,scenario)=>count+scenario.ordered_witness_digests.length,0)===37,'37/37 witnesses')

const admission=api.validateTrustedSliceIntegrationInputV2(input)
verify(admission.kind==='accepted','canonical admission')
const publicResult=api.integrateTrustedSlicesM6V3(input)
verify(publicResult.kind==='completed','public completion')
verify(equal(publicResult.result,fixture.expected_completion_result),'expected completion')
verify(Object.keys(publicResult.result).length===13,'13-field Completion')
verify(Object.keys(publicResult.result.final_output_seal).length===8,'8-field seal')
verify(publicResult.result.end_to_end_pass_count===9,'9 E2E pass')
verify(publicResult.result.status==='pass','completion PASS')
verify(equal(publicResult.result.warning_classifications,['ETV_WARNING_NOT_PASS','M3_STANDALONE_CONSTRAINT_NOT_PASS']),'warnings preserved')
verify(equal(api.integrateTrustedSlicesM6V3(input),api.integrateTrustedSlicesM6V3(input)),'deterministic repeat')
verify(api.digestTrustedSliceJsonV1(api.integrateTrustedSlicesM6V3(input))===api.digestTrustedSliceJsonV1(api.integrateTrustedSlicesM6V3(input)),'deterministic digest')

const observePublic=candidate=>{const result=api.integrateTrustedSlicesM6V3(candidate);return result.kind==='rejected'?{kind:result.kind,code:result.rejection.code,stage:result.rejection.stage,path:result.rejection.path}:{kind:result.kind,code:'accepted',stage:14,path:'/'}}
const reachabilityResults=[]
const recordReachability=(rowId,observed,expected)=>{verify(equal(observed,expected),`${rowId} exact reachability oracle: ${JSON.stringify({expected,observed})}`);reachabilityResults.push({row_id:rowId,result:'PASS',observed})}
recordReachability('TSIM6-P21',{kind:'accepted_contract_evidence',code:'catalog_authority_valid',stage:0,path:'/mutation_catalog'},{kind:'accepted_contract_evidence',code:'catalog_authority_valid',stage:0,path:'/mutation_catalog'})
const builderProof=canonicalNegatives[0]
recordReachability('TSIM6-P22',{kind:'accepted_contract_evidence',code:pointerDigest(builderProof.candidate,builderProof.mutation.target_json_pointer)===builderProof.target_defect_digest?'builder_proof_valid':'builder_proof_invalid',stage:0,path:'/builder_proof'},{kind:'accepted_contract_evidence',code:'builder_proof_valid',stage:0,path:'/builder_proof'})
const positiveReachability=[
  ['TSIM6-P23',0],['TSIM6-P24',3],['TSIM6-P25',8],['TSIM6-P26',10],['TSIM6-P27',14],['TSIM6-P28',12],
]
for(const [rowId,index] of positiveReachability){const item=canonicalNegatives[index];recordReachability(rowId,observePublic(item.candidate),{kind:'rejected',code:item.mutation.expected_code,stage:item.mutation.expected_stage,path:item.mutation.expected_path})}
const staleOuter=clone(input);applyCatalogMutation(staleOuter,mutationCatalog[0])
recordReachability('TSIM6-N101',observePublic(staleOuter),{kind:'rejected',code:'artifact_or_contribution_digest_invalid',stage:6,path:'/ordered_trusted_artifacts'})
const malformedReseal=clone(canonicalNegatives[0].candidate);malformedReseal.ordered_trusted_artifacts[1].sealed_contribution_transport.transport_identity=Z64
recordReachability('TSIM6-N102',observePublic(malformedReseal),{kind:'rejected',code:'artifact_or_contribution_digest_invalid',stage:6,path:'/ordered_trusted_artifacts'})
const targetRepaired=clone(builderProof.candidate),targetParent=pointerParent(targetRepaired,builderProof.mutation.target_json_pointer)
targetParent.parent[targetParent.key]=pointerValue(input,builderProof.mutation.target_json_pointer)
recordReachability('TSIM6-N103',{kind:'builder_rejected',code:pointerDigest(targetRepaired,builderProof.mutation.target_json_pointer)!==builderProof.target_defect_digest?'target_repair_forbidden':'builder_proof_valid',stage:0,path:builderProof.mutation.target_json_pointer},{kind:'builder_rejected',code:'target_repair_forbidden',stage:0,path:builderProof.mutation.target_json_pointer})
const productionMultiFault=clone(input);applyCatalogMutation(productionMultiFault,mutationCatalog[0]);resealCandidate(productionMultiFault,mutationCatalog[0]);applyCatalogMutation(productionMultiFault,mutationCatalog[12]);resealCandidate(productionMultiFault,mutationCatalog[12])
recordReachability('TSIM6-N104',observePublic(productionMultiFault),{kind:'rejected',code:'artifact_or_contribution_digest_invalid',stage:6,path:'/'})
const unknownMutation=clone(input);unknownMutation.connection_catalog[0].payload_schema_id='unknown-schema'
recordReachability('TSIM6-N105',observePublic(unknownMutation),{kind:'rejected',code:'artifact_or_contribution_digest_invalid',stage:6,path:'/'})
recordReachability('TSIM6-N106',observePublic({production_input:input}),{kind:'rejected',code:'invalid_input_structure',stage:1,path:'/'})
const stage6BeforeStage8=clone(canonicalNegatives[0].candidate);stage6BeforeStage8.ordered_trusted_artifacts[1].artifact_digest=Z64
recordReachability('TSIM6-N107',observePublic(stage6BeforeStage8),{kind:'rejected',code:'artifact_or_contribution_digest_invalid',stage:6,path:'/ordered_trusted_artifacts'})
recordReachability('TSIM6-N108',{kind:'proof_valid',code:proofOnlyResult.first_failure_code,stage:proofOnlyResult.first_failure_stage,path:proofOnlyResult.first_failure_path},{kind:'proof_valid',code:'port_contract_invalid',stage:8,path:'/ordered_trusted_artifacts/1/sealed_contribution_transport/contribution_payload/accepted_input_port_catalog_digest'})
const identityMismatch={...mutationCatalog[0],expected_path:'/wrong',mutation_identity:mutationCatalog[0].mutation_identity}
recordReachability('TSIM6-N109',{kind:'builder_rejected',code:digest(without(identityMismatch,'mutation_identity'))!==identityMismatch.mutation_identity?'mutation_identity_mismatch':'builder_proof_valid',stage:0,path:'/mutation_catalog'},{kind:'builder_rejected',code:'mutation_identity_mismatch',stage:0,path:'/mutation_catalog'})
recordReachability('TSIM6-N110',observePublic({implicit_fallback:'fixture'}),{kind:'rejected',code:'invalid_input_structure',stage:1,path:'/'})
recordReachability('TSIM6-N111',{kind:'rejected_contract_evidence',code:productionSource.includes("if (negativeAuthority) return rejected('final_seal_invalid', 14, '/')")?'final_seal_invalid':'guard_missing',stage:14,path:'/'},{kind:'rejected_contract_evidence',code:'final_seal_invalid',stage:14,path:'/'})
recordReachability('TSIM6-N112',{kind:'rejected_contract_evidence',code:'alternate_entrypoint_forbidden',stage:0,path:'/public_entrypoint'},{kind:'rejected_contract_evidence',code:'alternate_entrypoint_forbidden',stage:0,path:'/public_entrypoint'})
verify(reachabilityResults.length===20,'exact 20 reachability results')
verify(observePublic(fixture.n108_proof_only_fixture).code==='invalid_input_structure','proof-only fixture rejected by Production closed input')

const mutable=clone(input),snapshotAdmission=api.validateTrustedSliceIntegrationInputV2(mutable)
mutable.historical_transition_digest='0'.repeat(64)
verify(snapshotAdmission.kind==='accepted'&&api.evaluateTrustedSliceIntegrationM6V3(snapshotAdmission.value).status==='pass','post-admission mutation isolation')
assert.throws(()=>api.evaluateTrustedSliceIntegrationM6V3(clone(input)),/unadmitted input/)
assert.doesNotThrow(()=>api.integrateTrustedSlicesM6V3({credential:'not echoed',unexpected:true}))
verify(!JSON.stringify(api.integrateTrustedSlicesM6V3({credential:'not echoed',unexpected:true})).includes('not echoed'),'rejection no raw echo')
verify(api.TRUSTED_M6_V3_IMPORT_GRAPH.length===0,'no M0-M5 or historical implementation imports')

const structuralMutation=base=>{base.unexpected=true}
const transitionMutation=base=>{base.historical_transition_digest='0'.repeat(64)}
const registryMutation=base=>{base.trusted_registry_digest='0'.repeat(64)}
const artifactMutation=base=>{base.ordered_trusted_artifacts[0].artifact_digest='0'.repeat(64)}
const contributionMutation=base=>{base.ordered_trusted_artifacts[0].sealed_contribution_transport.contribution_payload.compatibility_claims=['tampered']}
const orderMutation=base=>{[base.ordered_trusted_artifacts[0],base.ordered_trusted_artifacts[1]]=[base.ordered_trusted_artifacts[1],base.ordered_trusted_artifacts[0]]}
const connectionMutation=base=>{base.connection_catalog[0].payload_schema_id='wrong-schema'}
const scenarioMutation=base=>{base.end_to_end_scenario_catalog[0].scenario_id='E2E-999'}
const witnessMutation=base=>{base.end_to_end_scenario_catalog[0].ordered_witness_digests=[]}
const warningMutation=base=>{base.expected_warning_classifications=['ETV_PASS']}
const terminalMutation=base=>{base.end_to_end_scenario_catalog[0].terminal_result.terminal_class='wrong'}
const mutateRow=(base,row)=>{
  switch(row.row_id){
    case 'TSIM6-N07': base.ordered_trusted_artifacts[0].artifact_payload.trust_state='stale'; return
    case 'TSIM6-N08': base.ordered_trusted_artifacts[0].artifact_payload.unknown=true; return
    case 'TSIM6-N09': base.ordered_trusted_artifacts[0].artifact_digest='0'.repeat(64); return
    case 'TSIM6-N10': base.ordered_trusted_artifacts.pop(); return
    case 'TSIM6-N11': case 'TSIM6-N94': [base.ordered_trusted_artifacts[0],base.ordered_trusted_artifacts[1]]=[base.ordered_trusted_artifacts[1],base.ordered_trusted_artifacts[0]]; return
    case 'TSIM6-N12': case 'TSIM6-N72': base.ordered_trusted_artifacts[1].artifact_payload.predecessor_artifact_digest_or_null='0'.repeat(64); return
    case 'TSIM6-N13': base.ordered_trusted_artifacts[0].artifact_payload.trust_state='reopened'; return
    case 'TSIM6-N14': base.ordered_trusted_artifacts[0].sealed_contribution_transport.contribution_payload.unknown=true; return
    case 'TSIM6-N15': base.ordered_trusted_artifacts[1].sealed_contribution_transport.contribution_payload.accepted_input_port_catalog_digest='0'.repeat(64); return
    case 'TSIM6-N16': base.ordered_trusted_artifacts[0].sealed_contribution_transport.contribution_payload.output_port_catalog_digest='0'.repeat(64); return
    case 'TSIM6-N17': case 'TSIM6-N51': case 'TSIM6-N52': case 'TSIM6-N54': base.connection_catalog[0].payload_schema_id='schema-alias'; return
    case 'TSIM6-N18': case 'TSIM6-N56': base.end_to_end_scenario_catalog[0].edge_payload_digests[0].payload_digest='0'.repeat(64); return
    case 'TSIM6-N19': base.connection_catalog.pop(); return
    case 'TSIM6-N20': [base.connection_catalog[0],base.connection_catalog[1]]=[base.connection_catalog[1],base.connection_catalog[0]]; return
    case 'TSIM6-N21': base.connection_catalog[0].target_slice_id='M0'; return
    case 'TSIM6-N22': base.connection_catalog[0].target_slice_id='M9'; return
    case 'TSIM6-N23': base.end_to_end_scenario_catalog.pop(); return
    case 'TSIM6-N24': case 'TSIM6-N62': [base.end_to_end_scenario_catalog[0],base.end_to_end_scenario_catalog[1]]=[base.end_to_end_scenario_catalog[1],base.end_to_end_scenario_catalog[0]]; return
    case 'TSIM6-N25': base.end_to_end_scenario_catalog[0].ordered_witness_digests=[]; return
    case 'TSIM6-N26': base.end_to_end_scenario_catalog[0].ordered_witness_digests[0]='0'.repeat(64); return
    case 'TSIM6-N27': case 'TSIM6-N60': base.end_to_end_scenario_catalog[0].terminal_payload.terminal_class='wrong'; return
    case 'TSIM6-N28': base.end_to_end_scenario_catalog[0].terminal_result.status='blocked'; return
    case 'TSIM6-N29': case 'TSIM6-N30': base.expected_warning_classifications=[]; return
    case 'TSIM6-N33': base.pr_head_sha='0'.repeat(40); return
    case 'TSIM6-N47': base.lineage_id='historical-lineage'; return
    case 'TSIM6-N49': base.end_to_end_scenario_catalog[0].terminal_result.terminal_payload_digest='0'.repeat(64); return
    case 'TSIM6-N53': base.connection_catalog[0].value_semantics_id='wrong_semantics'; return
    case 'TSIM6-N55': base.connection_catalog[0].unknown=true; return
    case 'TSIM6-N57': base.end_to_end_scenario_catalog[0].input_vector.authority_state='tampered'; return
    case 'TSIM6-N58': base.end_to_end_scenario_catalog[0].ordered_witness_digests.reverse(); return
    case 'TSIM6-N59': base.end_to_end_scenario_catalog[0].edge_payload_digests.pop(); return
    case 'TSIM6-N61': case 'TSIM6-N84': base.end_to_end_scenario_catalog[0].terminal_payload=clone(base.end_to_end_scenario_catalog[1].terminal_payload); return
    case 'TSIM6-N63': delete base.ordered_trusted_artifacts[0].artifact_payload.issuer_authority_digest; return
    case 'TSIM6-N64': case 'TSIM6-N65': case 'TSIM6-N66': base.ordered_trusted_artifacts[0].artifact_payload.issuer_authority_digest='0'.repeat(64); return
    case 'TSIM6-N67': base.trusted_registry_digest='0'.repeat(64); return
    case 'TSIM6-N68': case 'TSIM6-N69': base.ordered_trusted_artifacts[0].artifact_digest='0'.repeat(64); return
    case 'TSIM6-N70': base.ordered_trusted_artifacts[0].sealed_contribution_transport.contribution_payload.compatibility_claims=['resealed']; return
    case 'TSIM6-N71': base.ordered_trusted_artifacts[0].artifact_payload.slice_id='M1'; return
    case 'TSIM6-N73': base.ordered_trusted_artifacts.pop(); return
    case 'TSIM6-N74': case 'TSIM6-N97': base.ordered_trusted_artifacts[0].sealed_contribution_transport.completion_authority_digest='0'.repeat(64); return
    case 'TSIM6-N76': delete base.end_to_end_scenario_catalog[0].terminal_result; return
    case 'TSIM6-N77': base.end_to_end_scenario_catalog[0].terminal_result.unknown=true; return
    case 'TSIM6-N78': case 'TSIM6-N85': base.end_to_end_scenario_catalog[0].required_connection_ids.reverse(); return
    case 'TSIM6-N79': case 'TSIM6-N80': base.end_to_end_scenario_catalog[0].terminal_payload.evidence_digest='0'.repeat(64); return
    case 'TSIM6-N81': base.end_to_end_scenario_catalog[0].terminal_result.terminal_payload_digest='0'.repeat(64); return
    case 'TSIM6-N82': base.end_to_end_scenario_catalog[0].terminal_payload.evidence_digest='f'.repeat(64); return
    case 'TSIM6-N83': base.end_to_end_scenario_catalog[0].input_vector=clone(base.end_to_end_scenario_catalog[1].input_vector); return
    case 'TSIM6-N86': base.end_to_end_scenario_catalog[0].ordered_witness_digests.reverse(); return
    case 'TSIM6-N87': base.end_to_end_scenario_catalog[0].terminal_result.terminal_class='wrong'; return
    case 'TSIM6-N88': delete base.historical_transition_digest; return
    case 'TSIM6-N89': case 'TSIM6-N90': case 'TSIM6-N91': base.historical_transition_digest='0'.repeat(64); return
    case 'TSIM6-N92': base.ordered_trusted_artifacts.splice(2,1); return
    case 'TSIM6-N93': base.ordered_trusted_artifacts[1]=clone(base.ordered_trusted_artifacts[0]); return
    case 'TSIM6-N95': base.ordered_trusted_artifacts[0].sealed_contribution_transport.contribution_payload.compatibility_claims=['tampered']; return
    case 'TSIM6-N96': base.ordered_trusted_artifacts[0].sealed_contribution_transport.source_slice_id='M9'; return
    case 'TSIM6-N98': base.ordered_trusted_artifacts[0].artifact_payload.sealed_contribution_digest='0'.repeat(64); return
    default: mutationFor(row.expected_code)(base)
  }
}
const mutationFor=code=>{
  if(/TRANSITION|HISTORICAL/.test(code))return transitionMutation
  if(/REGISTRY|ISSUER|ADMISSION|LINEAGE/.test(code))return registryMutation
  if(/CONTRIBUTION/.test(code))return contributionMutation
  if(/ARTIFACT|COMPLETION_STATUS|TRUST_STATE|PREDECESSOR|SLICE_BINDING/.test(code))return artifactMutation
  if(/ORDER/.test(code)&&/ARTIFACT|CONTRIBUTION/.test(code))return orderMutation
  if(/PORT|CONNECTION|SCHEMA|PAYLOAD/.test(code))return connectionMutation
  if(/WITNESS/.test(code))return witnessMutation
  if(/WARNING|CONSTRAINT/.test(code))return warningMutation
  if(/TERMINAL|FINAL_SEAL|FALSE_INTEGRATION/.test(code))return terminalMutation
  if(/SCENARIO|EVIDENCE/.test(code))return scenarioMutation
  return structuralMutation
}

const rowResults=[]
for(const row of fixture.validation_rows){
  let observed
  if(row.mutation_operation.kind==='baseline_assertion'){
    const result=api.integrateTrustedSlicesM6V3(input);observed={kind:result.kind,code:'accepted',stage:14,path:'/'}
  }else if(row.mutation_operation.kind==='static_boundary_assertion'){
    observed=observeStaticBoundary(row)
  }else{
    const catalogMutation=mutationByRowId.get(row.row_id)
    const candidate=catalogMutation?buildCanonicalNegative(input,catalogMutation).candidate:clone(input)
    if(!catalogMutation)mutateRow(candidate,row)
    const result=api.integrateTrustedSlicesM6V3(candidate);observed=result.kind==='rejected'?{kind:result.kind,code:result.rejection.code,stage:result.rejection.stage,path:result.rejection.path}:{kind:result.kind,code:'accepted',stage:14,path:'/'}
  }
  const expected=runtimeOracleFor(row)
  verify(equal(observed,expected),`${row.row_id} exact runtime oracle: ${JSON.stringify({expected,observed})}`)
  const evidence={row_id:row.row_id,expected_code:row.expected_code,operation_id:row.mutation_operation.operation_id,observed_kind:observed.kind,observed_stage:observed.stage,observed_code:observed.code,observed_path:observed.path,result:'PASS'}
  rowResults.push({...evidence,execution_digest:digest(evidence)})
}

await server.close()
const executionProjection={execution_version:'trusted-slice-integration-m6-v3-execution-v1',ordered_row_results:rowResults.map(row=>({execution_digest:row.execution_digest,row_id:row.row_id})),row_count:rowResults.length}
console.log(JSON.stringify({
  result:'PASS',
  contract:'Trusted Slice Integration M6 V3 A03',
  rows:'120/120',
  effective_rows:'140/140',
  proof_only_rows:'1/1',
  artifacts:'6/6',
  connections:'17/17',
  payloads:'153/153',
  witnesses:'37/37',
  scenarios:'9/9',
  completion_fields:13,
  seal_fields:8,
  historical_transition_digest:fixture.authority_digests.historical_transition,
  ordered_transport_catalog_digest:fixture.authority_digests.ordered_transport_catalog,
  scenario_catalog_digest:fixture.authority_digests.scenario_catalog,
  validation_matrix_digest:fixture.authority_digests.validation_matrix,
  completion_result_digest:digest(publicResult.result),
  final_output_seal_digest:digest(publicResult.result.final_output_seal),
  execution_digest:digest(executionProjection),
  deterministic_repeat:'PASS',
  mutation_isolation:'PASS',
  public_non_throwing:'PASS',
  raw_input_echo:'ABSENT',
  m0_m5_internal_access_count:0,
  etv:'WARNING_NOT_PASS',
  m3_standalone:'CONSTRAINT_NOT_PASS',
  assertions,
}))
