import assert from 'node:assert/strict'
import { createServer } from 'vite'
const server=await createServer({server:{middlewareMode:true},appType:'custom'})
try { const api=await server.ssrLoadModule('/src/context-health/evaluator.ts'); assert.equal(typeof api.evaluateContextHealthV1,'function'); console.log('Pure Context Health evaluator boundary tests passed.') } finally { await server.close() }
