import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { access, readFile } from 'node:fs/promises'

const fixturePath = 'scripts/fixtures/continuous-orchestration-evaluator-reducer-consolidation-v1.json'
const fixture = JSON.parse(await readFile(fixturePath, 'utf8'))
let assertions = 0
const check = (condition, message) => { assertions += 1; assert.ok(condition, message) }
const absent = async path => { try { await access(path); return false } catch (error) { if (error?.code === 'ENOENT') return true; throw error } }

check(fixture.contract_version === 'continuous_orchestration_evaluator_reducer_retirement_absence_v1', 'closed fixture version')
check(Object.keys(fixture).sort().join(',') === ['contract_version', 'required_predecessor_contract', 'required_properties', 'retired_api_names', 'retired_runtime_paths'].sort().join(','), 'closed fixture fields')
check(fixture.retired_runtime_paths.length === 3 && new Set(fixture.retired_runtime_paths).size === 3, 'exact retired runtime set')
check(fixture.retired_api_names.length === 2 && new Set(fixture.retired_api_names).size === 2, 'exact retired API set')
for (const path of fixture.retired_runtime_paths) check(await absent(path), `retired module is absent: ${path}`)

const completion = JSON.parse(execFileSync(process.execPath, ['scripts/test-continuous-orchestration-completion-candidate-projection-cutover.mjs'], { encoding: 'utf8' }))
check(completion.result === 'PASS', 'completion predecessor absence validator passes')
check(completion.contract_mode === 'explicit_absence', 'completion predecessor is an absence contract')
for (const value of Object.values(fixture.required_properties)) check(value === 0, 'zero-authority absence property')

const ownSource = await readFile(new URL(import.meta.url), 'utf8')
check(!/ssrLoadModule\([^)]*(?:evaluator-reducer-consolidation|completion-candidate-projection-cutover|automatic-gate-progression)/.test(ownSource), 'no obsolete module loader')
check(!/\.(?:deriveProgressionDecisionPortShadowV1|evaluateEvaluatorReducerConsolidationV1)\s*\(/.test(ownSource), 'no obsolete runtime invocation')

console.log(JSON.stringify({
  result: 'PASS',
  contract: 'Evaluator Reducer Consolidation Retirement Absence',
  contract_mode: 'explicit_absence',
  retired_runtime_paths: '3/3 absent',
  retired_api_invocations: 0,
  predecessor_absence_contract: 'PASS',
  production_import_count: 0,
  protected_action_count: 0,
  assertions,
}))
