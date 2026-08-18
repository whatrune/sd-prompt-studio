import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'

const fixturePath = 'scripts/fixtures/continuous-orchestration-completion-candidate-projection-cutover-v1.json'
const fixture = JSON.parse(await readFile(fixturePath, 'utf8'))
let assertions = 0
const check = (condition, message) => { assertions += 1; assert.ok(condition, message) }
const absent = async path => { try { await access(path); return false } catch (error) { if (error?.code === 'ENOENT') return true; throw error } }

check(fixture.contract_version === 'continuous_orchestration_completion_candidate_retirement_absence_v1', 'closed fixture version')
check(Object.keys(fixture).sort().join(',') === ['contract_version', 'required_properties', 'retired_api_names', 'retired_runtime_paths'].sort().join(','), 'closed fixture fields')
check(fixture.retired_runtime_paths.length === 2 && new Set(fixture.retired_runtime_paths).size === 2, 'exact retired runtime set')
check(fixture.retired_api_names.length === 1, 'exact retired API set')
for (const path of fixture.retired_runtime_paths) check(await absent(path), `retired module is absent: ${path}`)
for (const value of Object.values(fixture.required_properties)) check(value === 0, 'zero-authority absence property')

const ownSource = await readFile(new URL(import.meta.url), 'utf8')
check(!/ssrLoadModule\([^)]*(?:completion-candidate-projection-cutover|gate-status-publisher)/.test(ownSource), 'no obsolete module loader')
check(!/\.(?:evaluateCompletionCandidateProjectionCutoverV1)\s*\(/.test(ownSource), 'no obsolete runtime invocation')

console.log(JSON.stringify({
  result: 'PASS',
  contract: 'Completion Candidate Projection Retirement Absence',
  contract_mode: 'explicit_absence',
  retired_runtime_paths: '2/2 absent',
  retired_api_invocations: 0,
  production_import_count: 0,
  protected_action_count: 0,
  assertions,
}))
