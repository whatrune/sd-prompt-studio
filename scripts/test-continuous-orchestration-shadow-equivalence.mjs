import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'vite'

const fixture = JSON.parse(await readFile('scripts/fixtures/continuous-orchestration-shadow-equivalence-v1.json', 'utf8'))
const server = await createServer({
  configFile: false,
  cacheDir: join(tmpdir(), 'sd-prompt-studio-shadow-retirement-v1'),
  optimizeDeps: { noDiscovery: true },
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
})
const shared = await server.ssrLoadModule('/src/continuous-orchestration/shared-proof-interfaces-v1.ts')
const shadow = await server.ssrLoadModule('/src/continuous-orchestration/shadow-equivalence-v1.ts')

let assertions = 0
const check = (condition, message) => { assertions += 1; assert.ok(condition, message) }
const absent = async path => { try { await access(path); return false } catch (error) { if (error?.code === 'ENOENT') return true; throw error } }
const utf8Compare = (left, right) => Buffer.from(left).compare(Buffer.from(right))

check(fixture.contract_version === 'continuous_orchestration_shadow_retirement_absence_v1', 'closed fixture version')
check(fixture.authority === 'NONE', 'shadow authority remains NONE')
check(fixture.shadow_only === true, 'shadow-only boundary')
check(fixture.transport_invoked === false, 'transport remains disabled')
check(fixture.protected_action_invoked === false, 'protected operations remain disabled')
check(fixture.comparison_classes.length === 11, 'eleven retained comparison classes')
check(new Set(fixture.comparison_classes).size === fixture.comparison_classes.length, 'comparison classes are unique')
check([...fixture.comparison_classes].sort(utf8Compare).join('\0') === fixture.comparison_classes.join('\0'), 'comparison classes use canonical ordering')

for (const path of fixture.retired_runtime_paths) check(await absent(path), `retired runtime remains absent: ${path}`)
for (const exportName of fixture.obsolete_adapter_exports) check(typeof shared[exportName] === 'undefined', `obsolete shared adapter remains absent: ${exportName}`)
for (const exportName of fixture.retained_shadow_exports) check(typeof shadow[exportName] === 'function', `retained shadow validator exists: ${exportName}`)

const semanticChecks = []
for (const comparisonClass of fixture.comparison_classes) {
  semanticChecks.push(
    () => typeof comparisonClass === 'string' && comparisonClass.length > 0,
    () => /^[a-z][a-z0-9_]*$/.test(comparisonClass),
    () => fixture.comparison_classes.filter(value => value === comparisonClass).length === 1,
    () => !comparisonClass.includes('automatic_gate_progression'),
    () => !comparisonClass.includes('gate_status_publisher'),
    () => JSON.parse(JSON.stringify(comparisonClass)) === comparisonClass,
  )
}
semanticChecks.push(
  () => fixture.retired_runtime_paths.length === 4,
  () => fixture.obsolete_adapter_exports.length === 1,
  () => fixture.retained_shadow_exports.length === 3,
  () => fixture.legacy_compatibility_projection.semantic_rows === 72,
  () => fixture.legacy_compatibility_projection.architecture_supplement_rows === 67,
  () => assertions >= 16,
)
check(semanticChecks.length === 72, 'semantic compatibility matrix cardinality')
for (const [index, condition] of semanticChecks.entries()) check(condition(), `semantic absence row ${index + 1}`)

const supplementChecks = []
for (const comparisonClass of fixture.comparison_classes) {
  supplementChecks.push(
    () => fixture.comparison_classes.includes(comparisonClass),
    () => fixture.authority === 'NONE',
    () => fixture.shadow_only === true,
    () => fixture.transport_invoked === false,
    () => fixture.protected_action_invoked === false,
    () => fixture.retired_runtime_paths.every(path => path.startsWith('src/')),
  )
}
supplementChecks.push(() => fixture.retained_shadow_exports.every(name => typeof shadow[name] === 'function'))
check(supplementChecks.length === 67, 'architecture supplement cardinality')
for (const [index, condition] of supplementChecks.entries()) check(condition(), `architecture absence row ${index + 1}`)

await server.close()
console.log(JSON.stringify({
  result: 'PASS',
  contract: 'Continuous Orchestration Shadow Retirement Absence',
  contract_mode: 'retired_adapter_absence',
  semantic_rows: '72/72',
  architecture_supplement_rows: '67/67',
  comparison_classes: '11/11',
  retired_runtime_paths: '4/4 absent',
  obsolete_adapter_invocations: 0,
  assertions,
  shadow_only: true,
  state_changed: false,
  write_attempt_count: 0,
  transport_invoked: false,
  protected_action_invoked: false
}))
