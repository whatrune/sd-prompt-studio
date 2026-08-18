import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { access, readFile, readdir } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { createServer } from 'vite'

const fixturePath = 'scripts/fixtures/continuous-orchestration-deprecation-removal-v1.json'
const fixture = JSON.parse(await readFile(fixturePath, 'utf8'))
const server = await createServer({
  configFile: false,
  cacheDir: join(tmpdir(), 'sd-prompt-studio-deprecation-retirement-v1'),
  optimizeDeps: { noDiscovery: true },
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
})
const api = await server.ssrLoadModule('/src/continuous-orchestration/deprecation-removal-v1.ts')

let assertions = 0
const check = (condition, message) => { assertions += 1; assert.ok(condition, message) }
const absent = async path => { try { await access(path); return false } catch (error) { if (error?.code === 'ENOENT') return true; throw error } }
const runJson = path => JSON.parse(execFileSync(process.execPath, [path], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }))

const record = {
  contract_version: fixture.contract_version,
  retired_runtime_paths: fixture.retired_runtime_paths,
  retired_api_names: fixture.retired_api_names,
  runtime_reference_count: fixture.runtime_reference_count,
  restored_module_count: fixture.restored_module_count,
  protected_action_count: fixture.protected_action_count,
  production_behavior_delta: fixture.production_behavior_delta,
}
const admitted = api.validateDeprecationRemovalAbsenceV1(record)
check(admitted.kind === 'accepted', 'aggregate absence record is accepted')
check(api.validateDeprecationRemovalAbsenceV1({ ...record, runtime_reference_count: 1 }).kind === 'rejected', 'nonzero runtime reference fails closed')
check(api.validateDeprecationRemovalAbsenceV1({ ...record, retired_runtime_paths: record.retired_runtime_paths.slice(1) }).kind === 'rejected', 'retired path drift fails closed')
check(api.validateDeprecationRemovalAbsenceV1({ ...record, retired_api_names: [...record.retired_api_names, 'unknown'] }).kind === 'rejected', 'retired API drift fails closed')

for (const path of fixture.retired_runtime_paths) check(await absent(path), `retired runtime remains absent: ${path}`)

const childValidators = fixture.focused_validators.filter(path => path !== 'scripts/test-continuous-orchestration-deprecation-removal.mjs')
const childResults = childValidators.map(runJson)
for (const [index, result] of childResults.entries()) check(result.result === 'PASS', `focused predecessor validator passes: ${childValidators[index]}`)

const productionFiles = []
const collect = async root => {
  try {
    for (const entry of await readdir(root, { withFileTypes: true })) {
      const path = join(root, entry.name)
      if (entry.isDirectory()) await collect(path)
      else if (['.ts', '.tsx', '.mjs', '.yml', '.yaml'].includes(extname(path))) productionFiles.push(path.replaceAll('\\', '/'))
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
}
await collect('src')
await collect('generic-platform/src')
await collect('.github/workflows')
productionFiles.push('scripts/run-protected-transition-admission-v1.mjs')

const selfPath = 'src/continuous-orchestration/deprecation-removal-v1.ts'
const scannedFiles = [...new Set(productionFiles)].filter(path => path !== selfPath)
const forbiddenTokens = [...fixture.retired_runtime_paths, ...fixture.retired_api_names]
const activeReferences = []
for (const path of scannedFiles) {
  const source = await readFile(path, 'utf8')
  for (const token of forbiddenTokens) if (source.includes(token)) activeReferences.push({ path, token })
}
check(activeReferences.length === 0, `retired runtime/reference scan is zero: ${JSON.stringify(activeReferences)}`)

const fixtureKeys = new Set(Object.keys(fixture))
for (const field of fixture.stale_binding_fields_forbidden) check(!fixtureKeys.has(field), `stale top-level binding removed: ${field}`)
check(fixture.focused_validators.length === 5 && new Set(fixture.focused_validators).size === 5, 'five corrected focused validators are closed and unique')

await server.close()
console.log(JSON.stringify({
  result: 'PASS',
  contract: 'Continuous Orchestration Deprecation Removal Absence',
  contract_mode: 'explicit_absence',
  retired_runtime_paths: '4/4 absent',
  focused_validators: `${childResults.length + 1}/${fixture.focused_validators.length}`,
  retired_runtime_reference_scan: 0,
  stale_binding_fields: 0,
  production_behavior_delta: 0,
  protected_action_count: 0,
  assertions,
}))
