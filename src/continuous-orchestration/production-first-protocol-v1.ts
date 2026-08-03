export const PRODUCTION_FIRST_PROTOCOL_V1 = 'production-first-v1' as const
export const PRODUCTION_OWNERSHIP_DISCOVERY_V2 = 'production-ownership-discovery-v2' as const
export const PRODUCTION_HOST_EXECUTION_V1 = 'production-host-execution-v1' as const
export const PRODUCTION_FIRST_PROTOCOL_ASSESSMENT_V1 = 'production-first-protocol-assessment-v1' as const

const HOST_SYMBOL = 'ContinuousOrchestrationProductionHostV1.handle' as const
const ENTRYPOINT_SYMBOL = 'runContinuousOrchestrationV1' as const
const FORBIDDEN_REACHABILITY_PATH = /^(?:scripts(?:\/|$)|.*(?:fixture|test-runner|barrel)(?:\/|$))/i

type JsonObject = Record<string, unknown>
export type BusinessBranchV1 = 'success' | 'safe_stop'
export type IntendedRoleV1 = 'runtime' | 'library' | 'adapter' | 'test_only'
export type ReuseClassificationV1 = 'reuse' | 'wire' | 'replace' | 'retire'

export type SourceIdentityV1 = Readonly<{
  repository: 'whatrune/sd-prompt-studio'
  full_head_sha: string
}>

export type DiscoveryRootV2 = Readonly<{
  repository_relative_path: string
  symbol: string
  owner_id: string
}>

export type DiscoveryTargetV2 = Readonly<{
  repository_relative_path: string
  symbol: string
  intended_role: 'runtime' | 'library'
  consumer_zero_policy: 'forbidden' | 'intentional_library_only'
  owner_id: string
}>

export type RetryOwnershipV2 =
  | Readonly<{ kind: 'retry_disabled'; owner: 'none' }>
  | Readonly<{ kind: 'single_retry_owner'; owner: string }>

export type ProductionOwnershipDiscoveryInputV2 = Readonly<{
  discovery_version: typeof PRODUCTION_OWNERSHIP_DISCOVERY_V2
  source_identity: SourceIdentityV1
  production_roots: readonly DiscoveryRootV2[]
  targets: readonly DiscoveryTargetV2[]
  resolvable_edge_kinds: readonly ['static_import', 'direct_call', 'construct', 'produce', 'consume', 'retry']
  retry_ownership: RetryOwnershipV2
  unresolved_dynamic_edge_policy: 'reject'
}>

export type RuntimeConsumerV2 = Readonly<{
  symbol: string
  owner: string
  consumer_count: number
}>

export type IntentionalLibraryZeroConsumerV2 = Readonly<{
  symbol: string
  owner: string
  consumer_count: 0
  intent: 'intentional_library_only'
}>

export type SourceInspectionPortResultV2 = Readonly<{
  status: 'inspected'
  declared_production_caller: string | 'none'
  declared_production_caller_owner: string | 'none'
  runtime_consumers: readonly RuntimeConsumerV2[]
  intentional_library_zero_consumers: readonly IntentionalLibraryZeroConsumerV2[]
  discovered_retry_edges: readonly Readonly<{ edge: string; retry_id: string; owner_id: string | 'none' }>[]
  retry_ownership: RetryOwnershipV2
}>

export type StaticExpectedGraphV2 = Readonly<{
  source_identity: SourceIdentityV1
  declared_production_caller: string | 'none'
  declared_production_caller_owner: string | 'none'
  runtime_consumers: readonly RuntimeConsumerV2[]
  intentional_library_zero_consumers: readonly IntentionalLibraryZeroConsumerV2[]
  discovered_retry_edges: readonly Readonly<{ edge: string; retry_id: string; owner_id: string | 'none' }>[]
  retry_ownership: RetryOwnershipV2
}>

export type FreshDiscoveryAdmissionV2 = Readonly<{
  admission_version: 'fresh-production-discovery-admission-v2'
  source_identity: SourceIdentityV1
  result: ProductionOwnershipDiscoveryResultV2
}>

export type SameHostE2EAdmissionV1 = Readonly<{
  admission_version: 'same-host-e2e-admission-v1'
  source_identity: SourceIdentityV1
  host_symbol: typeof HOST_SYMBOL
  entrypoint_symbol: typeof ENTRYPOINT_SYMBOL
  success_execution: HostExecutionV1
  safe_stop_execution: HostExecutionV1
}>

export type ProductionOwnershipDiscoveryResultV2 =
  | Readonly<{
      result_version: 'production-ownership-discovery-result-v2'
      kind: 'EXISTING_PRODUCTION_PATH_FOUND'
      source_identity: SourceIdentityV1
      host_symbol: typeof HOST_SYMBOL
      entrypoint_symbol: typeof ENTRYPOINT_SYMBOL
      static_expected_graph: StaticExpectedGraphV2
      error_code: null
    }>
  | Readonly<{
      result_version: 'production-ownership-discovery-result-v2'
      kind: 'PARTIAL_PRODUCTION_PATH_FOUND'
      source_identity: SourceIdentityV1
      host_symbol: typeof HOST_SYMBOL
      entrypoint_symbol: typeof ENTRYPOINT_SYMBOL
      static_expected_graph: StaticExpectedGraphV2
      error_code: 'production_caller_missing' | 'runtime_consumer_zero' | 'retry_owner_missing'
    }>
  | Readonly<{
      result_version: 'production-ownership-discovery-result-v2'
      kind: 'FAILED'
      source_identity: SourceIdentityV1
      error_code: 'discovery_source_unavailable' | 'discovery_input_invalid'
    }>

export type HostRequestV1 = Readonly<{
  protocol_version: typeof PRODUCTION_FIRST_PROTOCOL_V1
  request_id: string
  task_id: string
  requested_action: 'evaluate'
}>

export type HostObserverBehaviorV1 = Readonly<{
  initial_state: 'empty'
  causal_mode: 'append_completed_transition_only'
  unresolved_on_edge:
    | 'none'
    | Readonly<{ source_symbol: string; expression: string }>
}>

export type HostStageCallCountV1 = Readonly<{
  host_handle: number
  internal_entrypoint: number
  input_admission: number
  source_inspection: number
  host_observation: number
  routing_stub: number
  cas_ledger_stub: number
  projection_v2_stub: number
  evaluator_reducer_stub: number
  completion_stub: number
  audit_gsp_stub: number
}>

export type HostExecutionV1 = Readonly<{
  execution_version: typeof PRODUCTION_HOST_EXECUTION_V1
  business_result: Readonly<{ branch: BusinessBranchV1; code: string | null }>
  completion_record: Readonly<{ branch: BusinessBranchV1; code: string | null; write_count: 1 }>
  audit_gsp_record: Readonly<{ branch: BusinessBranchV1; code: string | null; write_count: 1 }>
  ordered_trace: readonly string[]
  stage_call_count: HostStageCallCountV1
  side_effect_count: 2
}>

export type ExpectedStageCallCountV1 = Readonly<{
  production_host: HostStageCallCountV1
  protocol_assessor_evaluation_count: 1
}>

export type ExpectedSideEffectCountV1 = Readonly<{
  production_host: Readonly<{
    completion_record_write_count: 1
    audit_gsp_record_write_count: 1
    total: 2
  }>
  protocol_assessor_production_side_effect_count: 0
}>

export type ProtocolScenarioV1 = Readonly<{
  row_id: string
  expected_result_branch: BusinessBranchV1
  expected_ordered_trace: readonly string[]
  expected_stage_call_count: ExpectedStageCallCountV1
  expected_safe_stop_or_error: Readonly<{ kind: 'none'; code: 'none' } | { kind: 'safe_stop'; code: string }>
  expected_side_effect_count: ExpectedSideEffectCountV1
}>

export type ProtocolAssessmentV1 = Readonly<{
  assessment_version: typeof PRODUCTION_FIRST_PROTOCOL_ASSESSMENT_V1
  row_id: string
  status: 'conformant' | 'nonconformant'
  first_mismatch:
    | null
    | 'business_result_mismatch'
    | 'observation_missing'
    | 'unexpected_edge'
    | 'missing_edge'
    | 'order_mismatch'
    | 'stage_call_count_mismatch'
    | 'safe_stop_error_mismatch'
    | 'side_effect_count_mismatch'
}>

export type ProtocolMilestoneAssessmentV1 = Readonly<{
  assessment_version: 'production-first-milestone-assessment-v1'
  library_complete: boolean
  runtime_wired: boolean
  runtime_e2e_pass: boolean
  production_ready: boolean
  highest_state: 'not_assessed' | 'library_complete' | 'runtime_wired' | 'runtime_e2e_pass' | 'production_ready'
}>

const isObject = (value: unknown): value is JsonObject => value !== null && typeof value === 'object' && !Array.isArray(value)
const hasOwn = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key)
const exactKeys = (value: unknown, keys: readonly string[]): value is JsonObject =>
  isObject(value) && Object.keys(value).length === keys.length && keys.every((key) => hasOwn(value, key))
const nonEmpty = (value: unknown): value is string => typeof value === 'string' && value.length > 0
const fullSha = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{40}$/.test(value)
const clone = <T>(value: T): T => structuredClone(value)

const deepFreeze = <T>(value: T): T => {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as JsonObject)) deepFreeze(child)
    Object.freeze(value)
  }
  return value
}

const equalJson = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right)
const allFrozen = (value: unknown): boolean =>
  value === null || typeof value !== 'object' || (Object.isFrozen(value) && Object.values(value as JsonObject).every(allFrozen))

const validateSourceIdentity = (value: unknown): value is SourceIdentityV1 =>
  exactKeys(value, ['repository', 'full_head_sha']) && value.repository === 'whatrune/sd-prompt-studio' && fullSha(value.full_head_sha)

const validateRoot = (value: unknown): value is DiscoveryRootV2 =>
  exactKeys(value, ['repository_relative_path', 'symbol', 'owner_id']) &&
  nonEmpty(value.repository_relative_path) && nonEmpty(value.symbol) && nonEmpty(value.owner_id) &&
  !FORBIDDEN_REACHABILITY_PATH.test(value.repository_relative_path)

const validateTarget = (value: unknown): value is DiscoveryTargetV2 =>
  exactKeys(value, ['repository_relative_path', 'symbol', 'intended_role', 'consumer_zero_policy', 'owner_id']) &&
  nonEmpty(value.repository_relative_path) && nonEmpty(value.symbol) && nonEmpty(value.owner_id) &&
  (value.intended_role === 'runtime' || value.intended_role === 'library') &&
  (value.consumer_zero_policy === 'forbidden' || value.consumer_zero_policy === 'intentional_library_only') &&
  !FORBIDDEN_REACHABILITY_PATH.test(value.repository_relative_path) &&
  (value.intended_role === 'library' || value.consumer_zero_policy === 'forbidden')

const validateRetryOwnership = (value: unknown): value is RetryOwnershipV2 => {
  if (!isObject(value) || !hasOwn(value, 'kind')) return false
  if (value.kind === 'retry_disabled') return exactKeys(value, ['kind', 'owner']) && value.owner === 'none'
  return value.kind === 'single_retry_owner' && exactKeys(value, ['kind', 'owner']) && nonEmpty(value.owner)
}

export const validateProductionOwnershipDiscoveryInputV2 = (value: unknown): value is ProductionOwnershipDiscoveryInputV2 => {
  if (!exactKeys(value, ['discovery_version', 'source_identity', 'production_roots', 'targets', 'resolvable_edge_kinds', 'retry_ownership', 'unresolved_dynamic_edge_policy'])) return false
  if (value.discovery_version !== PRODUCTION_OWNERSHIP_DISCOVERY_V2 || !validateSourceIdentity(value.source_identity)) return false
  if (!Array.isArray(value.production_roots) || value.production_roots.length !== 1 || !value.production_roots.every(validateRoot)) return false
  if (!Array.isArray(value.targets) || value.targets.length === 0 || !value.targets.every(validateTarget)) return false
  if (!equalJson(value.resolvable_edge_kinds, ['static_import', 'direct_call', 'construct', 'produce', 'consume', 'retry'])) return false
  return validateRetryOwnership(value.retry_ownership) && value.unresolved_dynamic_edge_policy === 'reject'
}

const validateRuntimeConsumer = (value: unknown): value is RuntimeConsumerV2 =>
  exactKeys(value, ['symbol', 'owner', 'consumer_count']) && nonEmpty(value.symbol) && nonEmpty(value.owner) &&
  Number.isSafeInteger(value.consumer_count) && Number(value.consumer_count) >= 0

const validateLibraryZero = (value: unknown): value is IntentionalLibraryZeroConsumerV2 =>
  exactKeys(value, ['symbol', 'owner', 'consumer_count', 'intent']) && nonEmpty(value.symbol) && nonEmpty(value.owner) &&
  value.consumer_count === 0 && value.intent === 'intentional_library_only'

const validateSourceInspection = (value: unknown): value is SourceInspectionPortResultV2 => {
  if (!exactKeys(value, ['status', 'declared_production_caller', 'declared_production_caller_owner', 'runtime_consumers', 'intentional_library_zero_consumers', 'discovered_retry_edges', 'retry_ownership'])) return false
  if (value.status !== 'inspected' || !(value.declared_production_caller === 'none' || nonEmpty(value.declared_production_caller)) ||
      !(value.declared_production_caller_owner === 'none' || nonEmpty(value.declared_production_caller_owner))) return false
  if (!Array.isArray(value.runtime_consumers) || !value.runtime_consumers.every(validateRuntimeConsumer)) return false
  if (!Array.isArray(value.intentional_library_zero_consumers) || !value.intentional_library_zero_consumers.every(validateLibraryZero)) return false
  if (!Array.isArray(value.discovered_retry_edges) || !value.discovered_retry_edges.every((edge) => exactKeys(edge, ['edge', 'retry_id', 'owner_id']) && nonEmpty(edge.edge) && nonEmpty(edge.retry_id) && (edge.owner_id === 'none' || nonEmpty(edge.owner_id)))) return false
  return validateRetryOwnership(value.retry_ownership)
}

const runtimeDiscoveryResults = new WeakSet<object>()
const freshDiscoveryAdmissions = new WeakSet<object>()
const sameHostE2EAdmissions = new WeakSet<object>()
const hostExecutionMetadata = new WeakMap<object, Readonly<{host_identity: object; source_identity: SourceIdentityV1; discovery_result: ProductionOwnershipDiscoveryResultV2 | null}>>()

const hasDuplicateRelation = (values: readonly Readonly<{symbol: string; owner: string}>[]) =>
  new Set(values.map((value) => `${value.symbol}\u0000${value.owner}`)).size !== values.length

const hasDuplicateRetryEdge = (values: readonly Readonly<{edge: string; retry_id: string; owner_id: string | 'none'}>[]) =>
  new Set(values.map((value) => `${value.edge}\u0000${value.retry_id}\u0000${value.owner_id}`)).size !== values.length

const discoverProductionOwnershipV2Internal = (
  input: unknown,
  inspectedSource: unknown,
  hostOwned: boolean,
): ProductionOwnershipDiscoveryResultV2 => {
  const fallbackSource: SourceIdentityV1 = deepFreeze({ repository: 'whatrune/sd-prompt-studio', full_head_sha: '0000000000000000000000000000000000000000' })
  if (!validateProductionOwnershipDiscoveryInputV2(input)) {
    return deepFreeze({ result_version: 'production-ownership-discovery-result-v2', kind: 'FAILED', source_identity: fallbackSource, error_code: 'discovery_input_invalid' })
  }
  if (!validateSourceInspection(inspectedSource)) {
    return deepFreeze({ result_version: 'production-ownership-discovery-result-v2', kind: 'FAILED', source_identity: clone(input.source_identity), error_code: 'discovery_source_unavailable' })
  }
  const expected = deepFreeze<StaticExpectedGraphV2>({
    source_identity: clone(input.source_identity),
    declared_production_caller: inspectedSource.declared_production_caller,
    declared_production_caller_owner: inspectedSource.declared_production_caller_owner,
    runtime_consumers: clone(inspectedSource.runtime_consumers),
    intentional_library_zero_consumers: clone(inspectedSource.intentional_library_zero_consumers),
    discovered_retry_edges: clone(inspectedSource.discovered_retry_edges),
    retry_ownership: clone(inspectedSource.retry_ownership),
  })
  const root = input.production_roots[0]
  const runtimeTargets = input.targets.filter((target) => target.intended_role === 'runtime')
  const libraryTargets = input.targets.filter((target) => target.intended_role === 'library')
  const runtimeRelationsValid = !hasDuplicateRelation(inspectedSource.runtime_consumers) &&
    inspectedSource.runtime_consumers.length === runtimeTargets.length &&
    inspectedSource.runtime_consumers.every((consumer) => runtimeTargets.some((target) => target.symbol === consumer.symbol && target.owner_id === consumer.owner && target.consumer_zero_policy === 'forbidden'))
  const libraryRelationsValid = !hasDuplicateRelation(inspectedSource.intentional_library_zero_consumers) &&
    inspectedSource.intentional_library_zero_consumers.length === libraryTargets.length &&
    inspectedSource.intentional_library_zero_consumers.every((consumer) => libraryTargets.some((target) => target.symbol === consumer.symbol && target.owner_id === consumer.owner && target.consumer_zero_policy === 'intentional_library_only'))
  const rootBindingValid = inspectedSource.declared_production_caller === 'none' ||
    (inspectedSource.declared_production_caller === root.symbol && inspectedSource.declared_production_caller_owner === root.owner_id)
  const retryBindingValid = equalJson(inspectedSource.retry_ownership, input.retry_ownership) &&
    !hasDuplicateRetryEdge(inspectedSource.discovered_retry_edges) &&
    (input.retry_ownership.kind === 'retry_disabled'
      ? inspectedSource.discovered_retry_edges.length <= 1 && inspectedSource.discovered_retry_edges.every((edge) => edge.owner_id === 'none')
      : inspectedSource.discovered_retry_edges.length === 1 && inspectedSource.discovered_retry_edges[0].owner_id === input.retry_ownership.owner)
  if (!runtimeRelationsValid || !libraryRelationsValid || !rootBindingValid || !retryBindingValid) {
    return deepFreeze({ result_version: 'production-ownership-discovery-result-v2', kind: 'FAILED', source_identity: clone(input.source_identity), error_code: 'discovery_input_invalid' })
  }
  let error: 'production_caller_missing' | 'runtime_consumer_zero' | 'retry_owner_missing' | null = null
  if (inspectedSource.declared_production_caller !== HOST_SYMBOL) error = 'production_caller_missing'
  else if (inspectedSource.runtime_consumers.some((consumer) => consumer.consumer_count === 0)) error = 'runtime_consumer_zero'
  else if (
    (inspectedSource.retry_ownership.kind === 'retry_disabled' && inspectedSource.discovered_retry_edges.length > 0) ||
    (inspectedSource.retry_ownership.kind === 'single_retry_owner' && inspectedSource.discovered_retry_edges.length !== 1)
  ) error = 'retry_owner_missing'
  if (error !== null) return deepFreeze({
    result_version: 'production-ownership-discovery-result-v2', kind: 'PARTIAL_PRODUCTION_PATH_FOUND',
    source_identity: clone(input.source_identity), host_symbol: HOST_SYMBOL, entrypoint_symbol: ENTRYPOINT_SYMBOL,
    static_expected_graph: expected, error_code: error,
  })
  const result = deepFreeze<ProductionOwnershipDiscoveryResultV2>({
    result_version: 'production-ownership-discovery-result-v2', kind: 'EXISTING_PRODUCTION_PATH_FOUND',
    source_identity: clone(input.source_identity), host_symbol: HOST_SYMBOL, entrypoint_symbol: ENTRYPOINT_SYMBOL,
    static_expected_graph: expected, error_code: null,
  })
  if (hostOwned) runtimeDiscoveryResults.add(result)
  return result
}

export const discoverProductionOwnershipV2 = (input: unknown, inspectedSource: unknown): ProductionOwnershipDiscoveryResultV2 =>
  discoverProductionOwnershipV2Internal(input, inspectedSource, false)

const validateObserverBehavior = (value: unknown): value is HostObserverBehaviorV1 =>
  exactKeys(value, ['initial_state', 'causal_mode', 'unresolved_on_edge']) &&
  value.initial_state === 'empty' && value.causal_mode === 'append_completed_transition_only' &&
  (value.unresolved_on_edge === 'none' || (exactKeys(value.unresolved_on_edge, ['source_symbol', 'expression']) && nonEmpty(value.unresolved_on_edge.source_symbol) && nonEmpty(value.unresolved_on_edge.expression)))

const emptyStageCounts = (): Record<keyof HostStageCallCountV1, number> => ({
  host_handle: 0, internal_entrypoint: 0, input_admission: 0, source_inspection: 0, host_observation: 0,
  routing_stub: 0, cas_ledger_stub: 0, projection_v2_stub: 0, evaluator_reducer_stub: 0,
  completion_stub: 0, audit_gsp_stub: 0,
})

const validateHostRequest = (value: unknown) =>
  exactKeys(value, ['protocol_version', 'request_id', 'task_id', 'requested_action']) &&
  value.protocol_version === PRODUCTION_FIRST_PROTOCOL_V1 && nonEmpty(value.request_id) && nonEmpty(value.task_id) && value.requested_action === 'evaluate'

const containsHostBypass = (value: unknown) =>
  isObject(value) && (hasOwn(value, 'host_invocation_context') || hasOwn(value, 'internal_mode') || hasOwn(value, 'validation_row'))

type ProductionHostPortsV1 = Readonly<{
  discovery_input: ProductionOwnershipDiscoveryInputV2
  source_inspection_port: Readonly<{ inspect: (input: ProductionOwnershipDiscoveryInputV2) => unknown }>
  observer_behavior: HostObserverBehaviorV1
}>

export type ContinuousOrchestrationProductionHostV1 = Readonly<{
  handle(request: unknown): HostExecutionV1
}>

type HostInvocationContextV1 = Readonly<{
  discovery_input: ProductionOwnershipDiscoveryInputV2
  observer_behavior: HostObserverBehaviorV1
  inspect: (input: ProductionOwnershipDiscoveryInputV2) => unknown
  host_identity: object
  counts: Record<keyof HostStageCallCountV1, number>
  trace: string[]
}>

const authorizedInvocationContexts = new WeakSet<object>()
const consumedInvocationContexts = new WeakSet<object>()

export const runContinuousOrchestrationV1 = (context: unknown, request: unknown): HostExecutionV1 => {
  if (!isObject(context) || !authorizedInvocationContexts.has(context) || consumedInvocationContexts.has(context)) throw new TypeError('host_bypass')
  consumedInvocationContexts.add(context)
  const invocation = context as HostInvocationContextV1
  const { counts, trace, observer_behavior: observer, discovery_input: frozenInput, inspect } = invocation
  counts.internal_entrypoint += 1
  trace.push('runtime.run')
  trace.push('observer.append(host.handle->runtime.run)')
  counts.input_admission += 1

  let branch: BusinessBranchV1 = 'success'
  let code: string | null = null
  let terminalFrom = 'admission'
  let discoveryResult: ProductionOwnershipDiscoveryResultV2 | null = null

  if (containsHostBypass(request)) {
    branch = 'safe_stop'; code = 'host_bypass'
    trace.push('admission.reject_host_bypass')
    trace.push('observer.append(runtime.run->admission)')
  } else if (!validateHostRequest(request)) {
    branch = 'safe_stop'; code = 'input_invalid'
    trace.push('admission.reject_input_invalid')
    trace.push('observer.append(runtime.run->admission)')
  } else {
    trace.push('admission.accept')
    trace.push('observer.append(runtime.run->admission)')
    counts.source_inspection += 1
    let inspected: unknown
    try { inspected = inspect(frozenInput) } catch { inspected = null }
    discoveryResult = discoverProductionOwnershipV2Internal(frozenInput, inspected, true)
    trace.push('discovery.inspect')
    trace.push('observer.append(admission->discovery)')
    terminalFrom = 'discovery'

    if (discoveryResult.kind === 'FAILED') {
      branch = 'safe_stop'; code = 'discovery_source_unavailable'
      trace.push('discovery.reject_discovery_source_unavailable')
    } else if (discoveryResult.kind === 'PARTIAL_PRODUCTION_PATH_FOUND') {
      branch = 'safe_stop'; code = discoveryResult.error_code
      trace.push(`discovery.reject_${discoveryResult.error_code}`)
    } else if (observer.unresolved_on_edge !== 'none') {
      branch = 'safe_stop'; code = 'unresolved_dynamic_edge'
      trace.push('discovery.detect_unresolved_dynamic_edge')
      trace.push('discovery.reject_unresolved_dynamic_edge')
    } else {
      counts.routing_stub += 1; trace.push('routing.stub'); trace.push('observer.append(discovery->routing)')
      counts.cas_ledger_stub += 1; trace.push('cas_ledger.stub'); trace.push('observer.append(routing->cas_ledger)')
      counts.projection_v2_stub += 1; trace.push('projection_v2.stub'); trace.push('observer.append(cas_ledger->projection_v2)')
      counts.evaluator_reducer_stub += 1; trace.push('evaluator_reducer.stub'); trace.push('observer.append(projection_v2->evaluator_reducer)')
      terminalFrom = 'evaluator_reducer'
    }
  }

  counts.completion_stub += 1
  trace.push(branch === 'success' ? 'completion.success' : 'completion.safe_stop')
  trace.push(`observer.append(${terminalFrom}->completion)`)
  counts.audit_gsp_stub += 1
  trace.push('audit_gsp.stub')
  trace.push('observer.append(completion->audit_gsp)')
  trace.push(branch === 'success' ? 'terminal.success.fixed' : 'terminal.safe_stop.fixed')
  trace.push('observer.append(audit_gsp->terminal_result)')
  trace.push('host.return')

  const execution = deepFreeze({
    execution_version: PRODUCTION_HOST_EXECUTION_V1,
    business_result: { branch, code },
    completion_record: { branch, code, write_count: 1 as const },
    audit_gsp_record: { branch, code, write_count: 1 as const },
    ordered_trace: trace,
    stage_call_count: counts,
    side_effect_count: 2 as const,
  })
  hostExecutionMetadata.set(execution, deepFreeze({ host_identity: invocation.host_identity, source_identity: clone(frozenInput.source_identity), discovery_result: discoveryResult }))
  return execution
}

export const createContinuousOrchestrationProductionHostV1 = (ports: ProductionHostPortsV1): ContinuousOrchestrationProductionHostV1 => {
  if (!isObject(ports) || !validateProductionOwnershipDiscoveryInputV2(ports.discovery_input) ||
      !isObject(ports.source_inspection_port) || typeof ports.source_inspection_port.inspect !== 'function' ||
      !validateObserverBehavior(ports.observer_behavior)) {
    throw new TypeError('production host configuration rejected')
  }
  const frozenInput = deepFreeze(clone(ports.discovery_input))
  const observer = deepFreeze(clone(ports.observer_behavior))
  const inspect = ports.source_inspection_port.inspect
  const hostIdentity = Object.freeze({})

  const handle = (request: unknown): HostExecutionV1 => {
    const counts = emptyStageCounts()
    const trace: string[] = []
    counts.host_handle += 1
    trace.push('host.handle')
    counts.host_observation += 1
    trace.push('observer.empty')
    const context: HostInvocationContextV1 = Object.freeze({ discovery_input: frozenInput, observer_behavior: observer, inspect, host_identity: hostIdentity, counts, trace })
    authorizedInvocationContexts.add(context)
    return runContinuousOrchestrationV1(context, request)
  }
  return deepFreeze({ handle })
}

export const deriveFreshProductionDiscoveryAdmissionV2 = (execution: unknown): FreshDiscoveryAdmissionV2 | null => {
  if (!isObject(execution)) return null
  const metadata = hostExecutionMetadata.get(execution)
  if (metadata?.discovery_result?.kind !== 'EXISTING_PRODUCTION_PATH_FOUND' || !runtimeDiscoveryResults.has(metadata.discovery_result)) return null
  const admission = deepFreeze({ admission_version: 'fresh-production-discovery-admission-v2' as const, source_identity: clone(metadata.source_identity), result: metadata.discovery_result })
  freshDiscoveryAdmissions.add(admission)
  return admission
}

export const deriveSameHostE2EAdmissionV1 = (successExecution: unknown, safeStopExecution: unknown): SameHostE2EAdmissionV1 | null => {
  if (!isObject(successExecution) || !isObject(safeStopExecution)) return null
  const successMetadata = hostExecutionMetadata.get(successExecution)
  const safeStopMetadata = hostExecutionMetadata.get(safeStopExecution)
  if (!successMetadata || !safeStopMetadata || successMetadata.host_identity !== safeStopMetadata.host_identity ||
      !equalJson(successMetadata.source_identity, safeStopMetadata.source_identity) ||
      !isObject(successExecution.business_result) || successExecution.business_result.branch !== 'success' ||
      !isObject(safeStopExecution.business_result) || safeStopExecution.business_result.branch !== 'safe_stop' ||
      !allFrozen(successExecution) || !allFrozen(safeStopExecution)) return null
  const admission = deepFreeze({
    admission_version: 'same-host-e2e-admission-v1' as const,
    source_identity: clone(successMetadata.source_identity), host_symbol: HOST_SYMBOL, entrypoint_symbol: ENTRYPOINT_SYMBOL,
    success_execution: successExecution as HostExecutionV1, safe_stop_execution: safeStopExecution as HostExecutionV1,
  })
  sameHostE2EAdmissions.add(admission)
  return admission
}

const sequenceMismatch = (expected: readonly string[], observed: readonly string[]): ProtocolAssessmentV1['first_mismatch'] => {
  if (observed.some((token) => !expected.includes(token))) return 'unexpected_edge'
  if (expected.some((token) => !observed.includes(token))) return 'missing_edge'
  return equalJson(expected, observed) ? null : 'order_mismatch'
}

const HOST_STAGE_KEYS = [
  'host_handle', 'internal_entrypoint', 'input_admission', 'source_inspection', 'host_observation',
  'routing_stub', 'cas_ledger_stub', 'projection_v2_stub', 'evaluator_reducer_stub',
  'completion_stub', 'audit_gsp_stub',
] as const

const validateScenario = (scenario: unknown): scenario is ProtocolScenarioV1 => {
  if (!exactKeys(scenario, ['row_id', 'expected_result_branch', 'expected_ordered_trace', 'expected_stage_call_count', 'expected_safe_stop_or_error', 'expected_side_effect_count'])) return false
  if (!nonEmpty(scenario.row_id) || (scenario.expected_result_branch !== 'success' && scenario.expected_result_branch !== 'safe_stop') ||
      !Array.isArray(scenario.expected_ordered_trace) || !scenario.expected_ordered_trace.every(nonEmpty)) return false
  const stageCounts = scenario.expected_stage_call_count
  if (!exactKeys(stageCounts, ['production_host', 'protocol_assessor_evaluation_count']) || stageCounts.protocol_assessor_evaluation_count !== 1) return false
  const hostCounts = stageCounts.production_host
  if (!exactKeys(hostCounts, HOST_STAGE_KEYS) || !HOST_STAGE_KEYS.every((key) => Number.isSafeInteger(hostCounts[key]) && Number(hostCounts[key]) >= 0)) return false
  const sideEffects = scenario.expected_side_effect_count
  if (!exactKeys(sideEffects, ['production_host', 'protocol_assessor_production_side_effect_count']) || sideEffects.protocol_assessor_production_side_effect_count !== 0) return false
  const hostSideEffects = sideEffects.production_host
  if (!exactKeys(hostSideEffects, ['completion_record_write_count', 'audit_gsp_record_write_count', 'total']) ||
      hostSideEffects.completion_record_write_count !== 1 || hostSideEffects.audit_gsp_record_write_count !== 1 || hostSideEffects.total !== 2) return false
  if (!isObject(scenario.expected_safe_stop_or_error)) return false
  if (scenario.expected_result_branch === 'success') return exactKeys(scenario.expected_safe_stop_or_error, ['kind', 'code']) && scenario.expected_safe_stop_or_error.kind === 'none' && scenario.expected_safe_stop_or_error.code === 'none'
  return exactKeys(scenario.expected_safe_stop_or_error, ['kind', 'code']) && scenario.expected_safe_stop_or_error.kind === 'safe_stop' && nonEmpty(scenario.expected_safe_stop_or_error.code)
}

export const ProductionFirstProtocolAssessorV1 = deepFreeze({
  assess(scenario: unknown, execution: unknown): ProtocolAssessmentV1 {
    const rowId = isObject(scenario) && nonEmpty(scenario.row_id) ? scenario.row_id : 'invalid-scenario'
    const result = (firstMismatch: ProtocolAssessmentV1['first_mismatch']): ProtocolAssessmentV1 => deepFreeze({
      assessment_version: PRODUCTION_FIRST_PROTOCOL_ASSESSMENT_V1,
      row_id: rowId,
      status: firstMismatch === null ? 'conformant' : 'nonconformant',
      first_mismatch: firstMismatch,
    })
    if (!validateScenario(scenario) || !isObject(execution)) return result('observation_missing')
    if (!exactKeys(execution, ['execution_version', 'business_result', 'completion_record', 'audit_gsp_record', 'ordered_trace', 'stage_call_count', 'side_effect_count']) ||
        execution.execution_version !== PRODUCTION_HOST_EXECUTION_V1 || !isObject(execution.business_result)) return result('observation_missing')
    if (execution.business_result.branch !== scenario.expected_result_branch) return result('business_result_mismatch')
    if (!Array.isArray(execution.ordered_trace) || !execution.ordered_trace.every(nonEmpty)) return result('observation_missing')
    const traceMismatch = sequenceMismatch(scenario.expected_ordered_trace, execution.ordered_trace)
    if (traceMismatch !== null) return result(traceMismatch)
    if (!isObject(scenario.expected_stage_call_count.production_host) || !equalJson(scenario.expected_stage_call_count.production_host, execution.stage_call_count)) return result('stage_call_count_mismatch')
    const expectedError = scenario.expected_safe_stop_or_error
    const expectedCode = expectedError.kind === 'none' ? null : expectedError.code
    if (execution.business_result.code !== expectedCode) return result('safe_stop_error_mismatch')
    const expectedEffects = scenario.expected_side_effect_count.production_host
    if (!isObject(expectedEffects) || expectedEffects.completion_record_write_count !== 1 || expectedEffects.audit_gsp_record_write_count !== 1 || expectedEffects.total !== execution.side_effect_count) return result('side_effect_count_mismatch')
    return result(null)
  },
  production_side_effect_count: 0 as const,
})

export const assessProtocolMilestonesV1 = (input: Readonly<{
  intended_role: 'library' | 'runtime'
  library_contract_passed: boolean
  fresh_discovery_admission: FreshDiscoveryAdmissionV2 | null
  same_host_e2e_admission: SameHostE2EAdmissionV1 | null
  operational_gates_pass: boolean
}>): ProtocolMilestoneAssessmentV1 => {
  const libraryComplete = input.intended_role === 'library' && input.library_contract_passed
  const discoveryAdmission = input.fresh_discovery_admission
  const e2eAdmission = input.same_host_e2e_admission
  const runtimeWired = input.intended_role === 'runtime' && isObject(discoveryAdmission) &&
    freshDiscoveryAdmissions.has(discoveryAdmission) && discoveryAdmission.result.kind === 'EXISTING_PRODUCTION_PATH_FOUND' &&
    runtimeDiscoveryResults.has(discoveryAdmission.result) && equalJson(discoveryAdmission.source_identity, discoveryAdmission.result.source_identity)
  const runtimeE2e = runtimeWired && isObject(e2eAdmission) && sameHostE2EAdmissions.has(e2eAdmission) &&
    e2eAdmission.host_symbol === HOST_SYMBOL && e2eAdmission.entrypoint_symbol === ENTRYPOINT_SYMBOL &&
    equalJson(e2eAdmission.source_identity, discoveryAdmission.source_identity)
  const deterministicStubCount: number = 6
  const productionReady = runtimeE2e && deterministicStubCount === 0 && input.operational_gates_pass
  const highest = productionReady ? 'production_ready' : runtimeE2e ? 'runtime_e2e_pass' : runtimeWired ? 'runtime_wired' : libraryComplete ? 'library_complete' : 'not_assessed'
  return deepFreeze({ assessment_version: 'production-first-milestone-assessment-v1', library_complete: libraryComplete, runtime_wired: runtimeWired, runtime_e2e_pass: runtimeE2e, production_ready: productionReady, highest_state: highest })
}

export const classifyReuseDecisionV1 = (input: Readonly<{
  intended_role: IntendedRoleV1
  public_contract_compatibility: 'exact' | 'incompatible' | 'not_applicable'
  production_caller_count: number
  production_consumer_count: number
  replacement_required: boolean
  retirement_allowed: boolean
}>): ReuseClassificationV1 => {
  if (input.replacement_required || input.public_contract_compatibility === 'incompatible') return 'replace'
  if (input.retirement_allowed && input.production_caller_count === 0 && input.production_consumer_count === 0) return 'retire'
  if (input.public_contract_compatibility === 'exact' && input.production_caller_count > 0 && input.production_consumer_count > 0) return 'reuse'
  return 'wire'
}

export const isDeepFrozenProductionFirstV1 = allFrozen
