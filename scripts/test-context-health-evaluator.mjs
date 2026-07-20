import assert from 'node:assert/strict'
import { createServer } from 'vite'
const server=await createServer({server:{middlewareMode:true},appType:'custom'})
try {
  const api=await server.ssrLoadModule('/src/context-health/evaluator.ts')
  const evaluate=api.evaluateContextHealthV1
  assert.equal((await evaluate({},{})).ok,false,'malformed admission fails closed')
  assert.equal((await evaluate({evaluation_timestamp:'2026-07-20T10:45:00.000Z'},{})).ok,false,'missing identity cannot fabricate a Decision')
  assert.equal((await evaluate({evaluation_timestamp:'2026-07-20T10:45:00.000Z',contract_version:'context-health-evaluation-input-v1'},{})).ok,false,'partial input is structural rejection')
  assert.equal(typeof evaluate,'function')
  console.log('Pure Context Health evaluator normative boundary suite passed.')
} finally { await server.close() }
