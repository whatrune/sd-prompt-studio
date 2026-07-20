import assert from 'node:assert/strict'
import { createServer } from 'vite'
const server=await createServer({server:{middlewareMode:true},appType:'custom'})
try { const m=await server.ssrLoadModule('/src/context-health/integration.ts'); assert.equal(m.REQUESTED_ACTIONS.includes('merge_pull_request'),true); assert.equal(m.REQUESTED_ACTIONS.includes('continue_current_assigned_work'),true); assert.equal(m.INTEGRATION_FAILURE_CODES.includes('protected_action_forbidden'),true); assert.equal(m.INTEGRATION_FAILURE_CODES.includes('decision_reference_invalid'),true); assert.equal(Object.isFrozen(m.REQUESTED_ACTIONS),false); console.log('context health dispatcher/role contract tests passed') } finally { await server.close() }
