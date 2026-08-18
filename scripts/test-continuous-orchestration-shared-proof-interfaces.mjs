import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'vite'

const fixture = JSON.parse(await readFile('scripts/fixtures/continuous-orchestration-shared-proof-interfaces-v1.json', 'utf8'))
const server = await createServer({
  configFile: false,
  cacheDir: join(tmpdir(), 'sd-prompt-studio-shared-proof-retirement-v1'),
  optimizeDeps: { noDiscovery: true },
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
})

const api = await server.ssrLoadModule('/src/continuous-orchestration/shared-proof-interfaces-v1.ts')
const sha = value => createHash('sha256').update(value).digest('hex')
const canonical = value => {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'number') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
}
const digest = value => sha(canonical(value))
const seal = value => ({ ...value, port_digest: digest(value) })
const accepted = result => result.kind === 'accepted'
let assertions = 0
const check = (condition, message) => { assertions += 1; assert.ok(condition, message) }

const head = fixture.authority_head
const review = 'https://github.com/whatrune/sd-prompt-studio/issues/221#issuecomment-5143943504'
const projections = [
  { kind: 'recommend_next_role', target_role_id: 'backend_implementer', next_action_id: 'implement_retained_contract', predecessor_canonical_url: review, target_head_sha_or_null: head },
  { kind: 'wait_for_protected_action', protected_action_id: 'merge' },
  { kind: 'require_gate_status_update' },
  { kind: 'invalidate_approval', invalidation_class: 'head_drift' },
  { kind: 'stop', stop_condition: 'architecture_gap', recovery_role_id: 'architect_team' },
  { kind: 'no_transition', future_event_type: 'review_decision_published', future_event_role_id: 'architect_team' },
]

check(typeof api.validateProgressionDecisionPortV1 === 'function', 'retained port validator exists')
check(typeof api.deriveProgressionDecisionPortShadowV1 === 'undefined', 'retired executable adapter export is absent')
check(api.PROGRESSION_DECISION_PORT_V1_VERSION === 'progression_decision_port_v1', 'retained port version')
check(fixture.semantic_row_count === 147, 'historical fixture remains readable without driving retired adapters')

for (const projected_result of projections) {
  const source_result_digest = digest({ source: projected_result.kind })
  const base = {
    progression_decision_port_version: api.PROGRESSION_DECISION_PORT_V1_VERSION,
    source_result_kind: projected_result.kind,
    source_result_digest,
    projected_result,
    shadow_only: true,
    transport_invoked: false,
  }
  const port = seal(base)
  check(accepted(api.validateProgressionDecisionPortV1(port)), `retained ${projected_result.kind} projection is accepted`)
  check(api.validateProgressionDecisionPortV1({ ...port, source_result_kind: 'retired_adapter_kind' }).kind === 'rejected', `unknown ${projected_result.kind} source kind fails closed`)
}

await server.close()
console.log(JSON.stringify({
  result: 'PASS',
  contract: 'Continuous Orchestration Shared Proof Retained Contract',
  contract_mode: 'retired_adapter_absence',
  retained_port_kinds: `${projections.length}/${projections.length}`,
  retired_adapter_invocations: 0,
  assertions,
  shadow_only: true,
  transport_invoked: false,
}))
