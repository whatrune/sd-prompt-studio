import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server=await createServer({server:{middlewareMode:true},appType:'custom'})
try{
 const api=await server.ssrLoadModule('/src/context-health/index.ts')
 const cv=await server.ssrLoadModule('/src/context-health/component-validation/index.ts')
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
 console.log('context handoff component validation production focused tests passed')
}finally{await server.close()}
