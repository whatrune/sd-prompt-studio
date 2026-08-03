import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'vite'

const fixturePath = 'scripts/fixtures/continuous-orchestration-production-first-protocol-v1.json'
const modulePath = 'src/continuous-orchestration/production-first-protocol-v1.ts'
const fixture = JSON.parse(await readFile(fixturePath, 'utf8'))
const source = await readFile(modulePath, 'utf8')
const initialHead = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const server = await createServer({
  configFile: false,
  cacheDir: join(tmpdir(), 'sd-prompt-studio-issue224-production-first-v1'),
  optimizeDeps: { noDiscovery: true },
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
})
const api = await server.ssrLoadModule(`/${modulePath}`)
const clone = structuredClone
const exactKeys = (value, keys) => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key))
const deepFrozen = (value) => value === null || typeof value !== 'object' || (Object.isFrozen(value) && Object.values(value).every(deepFrozen))
let assertions = 0
const check = (condition, message) => { assertions += 1; assert.ok(condition, message) }

check(fixture.contract_version === 'production-first-protocol-validation-corpus-v1', 'fixture contract')
check(fixture.rows.length === 8, 'exact eight rows')
check(new Set(fixture.rows.map((row) => row.row_id)).size === 8, 'row ids unique')
check(!Object.hasOwn(fixture, 'discovery_input'), 'corpus has no shared Discovery input')
const rowFields = ['row_id', 'admitted_input_fixture', 'expected_result_branch', 'expected_ordered_trace', 'expected_stage_call_count', 'expected_safe_stop_or_error', 'expected_side_effect_count']
for (const row of fixture.rows) check(exactKeys(row, rowFields), `${row.row_id} exact seven fields`)

const executions = new Map()
const assessments = new Map()
for (const row of fixture.rows) {
  let inspectionCalls = 0
  const inputFixture = clone(row.admitted_input_fixture)
  check(exactKeys(inputFixture, ['host_request', 'discovery_input', 'source_inspection_port_result', 'host_observer_behavior']), `${row.row_id} standalone literal fixture`)
  inputFixture.discovery_input.source_identity.full_head_sha = initialHead
  check(api.validateProductionOwnershipDiscoveryInputV2(inputFixture.discovery_input), `${row.row_id} Discovery V2 input admitted`)
  const host = api.createContinuousOrchestrationProductionHostV1({
    discovery_input: inputFixture.discovery_input,
    source_inspection_port: {
      inspect() {
        inspectionCalls += 1
        if (inputFixture.source_inspection_port_result.status === 'must_not_read') throw new Error('must_not_read')
        return clone(inputFixture.source_inspection_port_result)
      },
    },
    observer_behavior: clone(inputFixture.host_observer_behavior),
  })
  const execution = host.handle(clone(inputFixture.host_request))
  check(deepFrozen(execution), `${row.row_id} execution deeply frozen`)
  check(execution.business_result.branch === execution.completion_record.branch && execution.business_result.branch === execution.audit_gsp_record.branch, `${row.row_id} branch identity`)
  check(execution.business_result.code === execution.completion_record.code && execution.business_result.code === execution.audit_gsp_record.code, `${row.row_id} code identity`)
  check(inspectionCalls === row.expected_stage_call_count.production_host.source_inspection, `${row.row_id} source inspection causal count`)
  check(JSON.stringify(execution.stage_call_count) === JSON.stringify(row.expected_stage_call_count.production_host), `${row.row_id} Host counts`)
  check(execution.side_effect_count === row.expected_side_effect_count.production_host.total, `${row.row_id} Host side effects`)
  check(!Object.hasOwn(execution.stage_call_count, 'graph_comparison'), `${row.row_id} no Assessor count in Host`)

  const scenario = {
    row_id: row.row_id,
    expected_result_branch: row.expected_result_branch,
    expected_ordered_trace: clone(row.expected_ordered_trace),
    expected_stage_call_count: clone(row.expected_stage_call_count),
    expected_safe_stop_or_error: clone(row.expected_safe_stop_or_error),
    expected_side_effect_count: clone(row.expected_side_effect_count),
  }
  const before = JSON.stringify(execution)
  let assessorEvaluationCount = 0
  const assessment = api.ProductionFirstProtocolAssessorV1.assess(scenario, execution)
  assessorEvaluationCount += 1
  check(assessorEvaluationCount === row.expected_stage_call_count.protocol_assessor_evaluation_count, `${row.row_id} one post-return assessment`)
  check(api.ProductionFirstProtocolAssessorV1.production_side_effect_count === row.expected_side_effect_count.protocol_assessor_production_side_effect_count, `${row.row_id} pure Assessor`)
  check(assessment.status === 'conformant' && assessment.first_mismatch === null, `${row.row_id} conformant`)
  check(JSON.stringify(execution) === before && deepFrozen(execution), `${row.row_id} Assessor did not mutate execution`)
  executions.set(row.row_id, execution)
  assessments.set(row.row_id, assessment)
}

check(executions.get('PFV1-001-success').business_result.branch === 'success', 'success path')
check(executions.get('PFV1-006-intentional-library-consumer-zero').business_result.branch === 'success', 'intentional library consumer zero admitted')
for (const id of ['PFV1-002-admission-safe-stop', 'PFV1-003-host-bypass-rejection', 'PFV1-004-missing-production-caller', 'PFV1-005-runtime-consumer-zero', 'PFV1-007-retry-owner-missing', 'PFV1-008-unresolved-dynamic-edge']) {
  check(executions.get(id).business_result.branch === 'safe_stop', `${id} safe-stop`)
}

const successRow = fixture.rows.find((row) => row.row_id === 'PFV1-001-success')
const discoveryInput = clone(successRow.admitted_input_fixture.discovery_input)
discoveryInput.source_identity.full_head_sha = initialHead
const successScenario = {
  row_id: successRow.row_id,
  expected_result_branch: successRow.expected_result_branch,
  expected_ordered_trace: clone(successRow.expected_ordered_trace),
  expected_stage_call_count: clone(successRow.expected_stage_call_count),
  expected_safe_stop_or_error: clone(successRow.expected_safe_stop_or_error),
  expected_side_effect_count: clone(successRow.expected_side_effect_count),
}
const immutableSuccess = executions.get('PFV1-001-success')
const unexpectedScenario = clone(successScenario)
unexpectedScenario.expected_ordered_trace[4] = 'future.injected'
check(api.ProductionFirstProtocolAssessorV1.assess(unexpectedScenario, immutableSuccess).first_mismatch === 'unexpected_edge', 'unexpected trace is Assessor-only nonconformance')
check(immutableSuccess.business_result.branch === 'success' && immutableSuccess.completion_record.branch === 'success', 'assessment cannot rewrite business result')
const missingTraceExecution = clone(immutableSuccess)
delete missingTraceExecution.ordered_trace
check(api.ProductionFirstProtocolAssessorV1.assess(successScenario, missingTraceExecution).first_mismatch === 'observation_missing', 'missing observation fails closed')

assert.throws(() => api.createContinuousOrchestrationProductionHostV1({
  discovery_input: discoveryInput,
  source_inspection_port: { inspect() { return successRow.admitted_input_fixture.source_inspection_port_result } },
  observer_behavior: { initial_state: 'preloaded', causal_mode: 'append_completed_transition_only', unresolved_on_edge: 'none' },
}), /configuration rejected/)
assertions += 1

const unknownExpectedFieldHost = api.createContinuousOrchestrationProductionHostV1({
  discovery_input: discoveryInput,
  source_inspection_port: { inspect() { return successRow.admitted_input_fixture.source_inspection_port_result } },
  observer_behavior: successRow.admitted_input_fixture.host_observer_behavior,
})
const unknownExpectedFieldResult = unknownExpectedFieldHost.handle({ ...successRow.admitted_input_fixture.host_request, expected_terminal_path: [] })
check(unknownExpectedFieldResult.business_result.code === 'input_invalid', 'expected path rejected from business input')

for (const path of ['scripts/test-only-host.mjs', 'scripts/fixtures/fake-runtime.json', 'src/barrel/runtime.ts']) {
  const invalid = clone(discoveryInput)
  invalid.production_roots[0].repository_relative_path = path
  check(!api.validateProductionOwnershipDiscoveryInputV2(invalid), `${path} is not production reachability evidence`)
}
const illegalRetry = clone(discoveryInput)
illegalRetry.retry_ownership = { kind: 'retry_owner_missing', owner: 'none' }
check(!api.validateProductionOwnershipDiscoveryInputV2(illegalRetry), 'rejection code is not RetryOwnership input branch')

const directDiscovery = api.discoverProductionOwnershipV2(discoveryInput, successRow.admitted_input_fixture.source_inspection_port_result)
check(directDiscovery.kind === 'EXISTING_PRODUCTION_PATH_FOUND', 'fresh static Discovery result')
check(Object.hasOwn(directDiscovery, 'static_expected_graph') && !Object.hasOwn(directDiscovery.static_expected_graph, 'ordered_trace'), 'static expected graph is separate from dynamic observed trace')
check(!Object.hasOwn(immutableSuccess, 'static_expected_graph'), 'Host execution does not expose static expected graph as trace')

const libraryMilestones = api.assessProtocolMilestonesV1({
  intended_role: 'library', library_contract_passed: true, fresh_discovery_admission: null, same_host_e2e_admission: null,
  operational_gates_pass: false,
})
check(libraryMilestones.highest_state === 'library_complete' && !libraryMilestones.runtime_wired, 'library_complete is not runtime evidence')

const sameHost = api.createContinuousOrchestrationProductionHostV1({
  discovery_input: discoveryInput,
  source_inspection_port: { inspect() { return clone(successRow.admitted_input_fixture.source_inspection_port_result) } },
  observer_behavior: clone(successRow.admitted_input_fixture.host_observer_behavior),
})
const sameHostSuccess = sameHost.handle(clone(successRow.admitted_input_fixture.host_request))
const sameHostSafeStop = sameHost.handle(clone(fixture.rows.find((row) => row.row_id === 'PFV1-002-admission-safe-stop').admitted_input_fixture.host_request))
const freshDiscoveryAdmission = api.deriveFreshProductionDiscoveryAdmissionV2(sameHostSuccess)
const sameHostE2EAdmission = api.deriveSameHostE2EAdmissionV1(sameHostSuccess, sameHostSafeStop)
check(freshDiscoveryAdmission !== null && sameHostE2EAdmission !== null, 'Host-derived Discovery and same-host E2E admissions')
const runtimeMilestones = api.assessProtocolMilestonesV1({
  intended_role: 'runtime', library_contract_passed: false, fresh_discovery_admission: freshDiscoveryAdmission,
  same_host_e2e_admission: sameHostE2EAdmission, operational_gates_pass: false,
})
check(runtimeMilestones.runtime_wired && runtimeMilestones.runtime_e2e_pass && !runtimeMilestones.production_ready && runtimeMilestones.highest_state === 'runtime_e2e_pass', 'Walking Skeleton cannot claim production_ready')

let repairNegativeChecks = 0
assert.throws(() => api.runContinuousOrchestrationV1({}, clone(successRow.admitted_input_fixture.host_request)), /host_bypass/)
repairNegativeChecks += 1
const fabricatedMilestones = api.assessProtocolMilestonesV1({
  intended_role: 'runtime', library_contract_passed: false,
  fresh_discovery_admission: { admission_version: 'fresh-production-discovery-admission-v2', source_identity: clone(directDiscovery.source_identity), result: directDiscovery },
  same_host_e2e_admission: { admission_version: 'same-host-e2e-admission-v1', source_identity: clone(directDiscovery.source_identity), host_symbol: 'ContinuousOrchestrationProductionHostV1.handle', entrypoint_symbol: 'runContinuousOrchestrationV1', success_execution: sameHostSuccess, safe_stop_execution: sameHostSafeStop },
  operational_gates_pass: true,
})
check(fabricatedMilestones.highest_state === 'not_assessed' && !fabricatedMilestones.runtime_wired && !fabricatedMilestones.runtime_e2e_pass && !fabricatedMilestones.production_ready, 'fabricated milestone claims rejected')
repairNegativeChecks += 1
const mismatchedInspection = clone(successRow.admitted_input_fixture.source_inspection_port_result)
mismatchedInspection.runtime_consumers[0].owner = 'wrong-owner'
check(api.discoverProductionOwnershipV2(discoveryInput, mismatchedInspection).error_code === 'discovery_input_invalid', 'Discovery target and owner mismatch rejected')
const duplicateRetryInspection = clone(fixture.rows.find((row) => row.row_id === 'PFV1-007-retry-owner-missing').admitted_input_fixture.source_inspection_port_result)
duplicateRetryInspection.discovered_retry_edges.push(clone(duplicateRetryInspection.discovered_retry_edges[0]))
check(api.discoverProductionOwnershipV2(discoveryInput, duplicateRetryInspection).error_code === 'discovery_input_invalid', 'duplicate retry relation rejected')
repairNegativeChecks += 1
const incompleteStandalone = clone(successRow.admitted_input_fixture)
delete incompleteStandalone.discovery_input
check(!exactKeys(incompleteStandalone, ['host_request', 'discovery_input', 'source_inspection_port_result', 'host_observer_behavior']), 'row missing own Discovery input rejected as incomplete')
repairNegativeChecks += 1
check(repairNegativeChecks === 4, 'four focused negative repairs')

check(api.classifyReuseDecisionV1({ intended_role: 'library', public_contract_compatibility: 'exact', production_caller_count: 1, production_consumer_count: 1, replacement_required: false, retirement_allowed: false }) === 'reuse', 'reuse classification')
check(api.classifyReuseDecisionV1({ intended_role: 'library', public_contract_compatibility: 'exact', production_caller_count: 0, production_consumer_count: 0, replacement_required: false, retirement_allowed: false }) === 'wire', 'wire classification')
check(api.classifyReuseDecisionV1({ intended_role: 'adapter', public_contract_compatibility: 'incompatible', production_caller_count: 1, production_consumer_count: 1, replacement_required: true, retirement_allowed: false }) === 'replace', 'replace classification')
check(api.classifyReuseDecisionV1({ intended_role: 'test_only', public_contract_compatibility: 'not_applicable', production_caller_count: 0, production_consumer_count: 0, replacement_required: false, retirement_allowed: true }) === 'retire', 'retire classification')

check(!source.includes("from '../../scripts") && !source.includes('scripts/fixtures/'), 'production module does not import runner or fixture')
check(!/future[_-]trace|preload(?:ed)?[_-]trace/i.test(source), 'no future trace injection surface')
const finalHead = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
check(finalHead === initialHead, 'source HEAD stable through table run')

console.log(JSON.stringify({
  result: 'PASS',
  contract: 'Production-First Implementation Protocol V1',
  rows: `${fixture.rows.length}/${fixture.rows.length}`,
  repair_negative_checks: `${repairNegativeChecks}/4`,
  assertions,
  host: 'ContinuousOrchestrationProductionHostV1.handle',
  assessor: 'ProductionFirstProtocolAssessorV1.assess',
  assessor_side_effect_count: api.ProductionFirstProtocolAssessorV1.production_side_effect_count,
  fixture_or_runner_as_reachability_evidence: false,
  runtime_completion_requires_fresh_discovery_and_same_host_e2e: true,
}))
await server.close()
