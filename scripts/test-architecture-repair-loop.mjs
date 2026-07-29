import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { createServer } from 'vite'

const ISSUE_API = 'https://api.github.com/repos/whatrune/sd-prompt-studio/issues/comments/'
const RECORDS = {
  fixture: '5111908988',
  validation: '5112099601',
  amendment: '5112849287',
  amendment018: '5113638767',
  corpus: '5098979462',
}

const clone = structuredClone
const canonicalize = (value) => value === null || typeof value !== 'object'
  ? JSON.stringify(value)
  : Array.isArray(value)
    ? `[${value.map(canonicalize).join(',')}]`
    : `{${Object.keys(value).sort((a, b) => Buffer.from(a).compare(Buffer.from(b))).map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`
const shaText = (value) => createHash('sha256').update(value, 'utf8').digest('hex')
const sha = (value) => shaText(canonicalize(value))
const without = (value, field) => Object.fromEntries(Object.entries(value).filter(([key]) => key !== field))
const decodePointer = (path) => path === '' ? [] : path.slice(1).split('/').map((token) => token.replaceAll('~1', '/').replaceAll('~0', '~'))
const pointer = (root, path) => decodePointer(path).reduce((node, key) => node[key], root)
const parentAt = (root, path) => {
  const keys = decodePointer(path)
  const key = keys.pop()
  return { parent: keys.reduce((node, part) => node[part], root), key }
}
const replaceAt = (root, path, value) => {
  const { parent, key } = parentAt(root, path)
  assert.notEqual(key, undefined)
  assert.ok(Object.prototype.hasOwnProperty.call(parent, key), `replace target ${path}`)
  parent[key] = clone(value)
}
const addAt = (root, path, value) => {
  const { parent, key } = parentAt(root, path)
  assert.notEqual(key, undefined)
  if (Array.isArray(parent)) parent.splice(Number(key), 0, clone(value))
  else {
    assert.equal(Object.prototype.hasOwnProperty.call(parent, key), false, `add target ${path}`)
    parent[key] = clone(value)
  }
}
const removeAt = (root, path) => {
  const { parent, key } = parentAt(root, path)
  assert.notEqual(key, undefined)
  assert.ok(Object.prototype.hasOwnProperty.call(parent, key), `remove target ${path}`)
  if (Array.isArray(parent)) parent.splice(Number(key), 1)
  else delete parent[key]
}
const reseal = (state, step) => {
  if (step === 'decision_binding.projection_digest') {
    const target = state.production_input.decision_binding
    target.projection_digest = sha(without(target, 'projection_digest'))
  } else if (step === 'production_input.input_digest') {
    state.production_input.input_digest = sha(without(state.production_input, 'input_digest'))
  } else if (step === 'materialization_input.input_digest') {
    state.materialization_input.input_digest = sha(without(state.materialization_input, 'input_digest'))
  } else if (step === 'port_entry.body_utf8_length' || step === 'port_entry.body_sha256') {
    const entry = state.port_entries[state.activePortIndex]
    const body = canonicalize(entry.captured_value)
    entry.body_utf8_length = Buffer.byteLength(body)
    entry.body_sha256 = shaText(body)
  } else assert.fail(`unknown reseal step ${step}`)
}

const readComment = async (id) => {
  const response = await fetch(`${ISSUE_API}${id}`, { headers: { Accept: 'application/vnd.github+json' }, redirect: 'error', cache: 'no-store', credentials: 'omit' })
  const payload = response.ok
    ? await response.json()
    : JSON.parse(execFileSync('gh', ['api', `repos/whatrune/sd-prompt-studio/issues/comments/${id}`], { encoding: 'utf8', maxBuffer: 2 ** 24 }))
  assert.equal(String(payload.id), id)
  assert.equal(typeof payload.body, 'string')
  return payload.body
}
const jsonBlocks = (body) => Array.from(body.matchAll(/```json\n([\s\S]*?)\n```/g), (match) => JSON.parse(match[1]))

const bodies = Object.fromEntries(await Promise.all(Object.entries(RECORDS).map(async ([key, id]) => [key, await readComment(id)])))
let fixtureCatalog = jsonBlocks(bodies.fixture)[0]
let validationCatalog = jsonBlocks(bodies.validation)[0]
const amendment = jsonBlocks(bodies.amendment)[0]
const amendment018 = jsonBlocks(bodies.amendment018)[0]
for (const replacement of [...amendment.ordered_replacements, ...amendment018.ordered_replacements]) {
  const target = replacement.target_block_id === fixtureCatalog.block_id ? fixtureCatalog : validationCatalog
  assert.deepEqual(pointer(target, replacement.path), replacement.old_value)
  assert.equal(sha(pointer(target, replacement.path)), replacement.old_value_jcs_sha256)
  replaceAt(target, replacement.path, replacement.new_value)
  assert.equal(sha(pointer(target, replacement.path)), replacement.new_value_jcs_sha256)
}
assert.equal(fixtureCatalog.catalog_digest, amendment018.reconstruction.effective_fixture_catalog_digest)
assert.equal(validationCatalog.catalog_digest, amendment018.reconstruction.effective_validation_catalog_digest)
assert.equal(sha(without(fixtureCatalog, 'catalog_digest')), fixtureCatalog.catalog_digest)
assert.equal(sha(without(validationCatalog, 'catalog_digest')), validationCatalog.catalog_digest)
for (const row of validationCatalog.rows) assert.equal(sha(without(row, 'row_digest')), row.row_digest, row.row_id)

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' })
const production = await vite.ssrLoadModule('/src/architecture-repair-loop/index.ts')
const exactBodies = new Map()
for (const entry of fixtureCatalog.base_components[0].port_entries.filter((entry) => entry.source_mode === 'github_exact_comment_body')) {
  const id = /issuecomment-([0-9]+)$/.exec(entry.source_locator)?.[1]
  assert.ok(id)
  const body = await readComment(id)
  assert.equal(Buffer.byteLength(body), entry.body_utf8_length)
  assert.equal(shaText(body), entry.body_sha256)
  exactBodies.set(entry.request_identity, body)
}

const baseFixture = fixtureCatalog.base_components[0]
const nativeFetch = globalThis.fetch
let adapterFetchCalls = 0
const installAdapterFetch = (mutate = (value) => value) => {
  adapterFetchCalls = 0
  globalThis.fetch = async (url, options) => {
    adapterFetchCalls += 1
    assert.deepEqual(options, { method: 'GET', redirect: 'error', cache: 'no-store', credentials: 'omit', headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } })
    const id = /\/comments\/([1-9][0-9]*)$/.exec(String(url))?.[1]
    assert.ok(id)
    const identity = [...exactBodies.keys()].find((candidate) => candidate.endsWith(`issuecomment-${id}`))
    assert.ok(identity)
    const payload = mutate({ id: Number(id), html_url: identity, body: exactBodies.get(identity) })
    return { status: 200, json: async () => payload }
  }
}
installAdapterFetch()
const fixturePorts = production.createArchitectureRepairAuthorityFixturePortsV8(baseFixture)
assert.equal(fixturePorts.branch, 'accepted', `CAA016 factory positive Admission ${JSON.stringify(fixturePorts)}`)
assert.equal(adapterFetchCalls, 0, 'CAA016 factory creation performs zero I/O')
const factoryCounts = [0, 0, 0]
const countedFactoryPorts = Object.freeze({
  readCanonicalBody: async function (request, observedAt) { factoryCounts[0] += 1; return fixturePorts.value.readCanonicalBody(request, observedAt) },
  readRepositoryState: async function (request, observedAt) { factoryCounts[1] += 1; return fixturePorts.value.readRepositoryState(request, observedAt) },
  readIssueState: async function (request, observedAt) { factoryCounts[2] += 1; return fixturePorts.value.readIssueState(request, observedAt) },
})
const factoryMaterialized = await production.materializeArchitectureRepairAuthorityProofV8(baseFixture.materialization_input, countedFactoryPorts)
assert.equal(factoryMaterialized.branch, 'produced', 'CAA016 factory materializer positive')
assert.deepEqual(factoryCounts, [6, 1, 2], 'CAA016 factory three-port positive vector')
const factoryValidated = production.validateArchitectureRepairAuthorityObservationV8(baseFixture.observation, baseFixture.production_input, factoryMaterialized.proof_token)
assert.equal(factoryValidated.branch, 'accepted', 'CAA016 factory validator positive')
assert.equal(adapterFetchCalls, 6, 'CAA016 sole canonical-body I/O count')

const locatorZeroFixture = clone(baseFixture)
locatorZeroFixture.port_entries[0].source_locator = 'https://github.com/whatrune/sd-prompt-studio/issues/209#issuecomment-0'
assert.equal(production.createArchitectureRepairAuthorityFixturePortsV8(locatorZeroFixture).branch, 'rejected', 'CAA016 locator zero rejected')
const duplicatePortFixture = clone(baseFixture)
duplicatePortFixture.port_entries[1].request_identity = duplicatePortFixture.port_entries[0].request_identity
assert.equal(production.createArchitectureRepairAuthorityFixturePortsV8(duplicatePortFixture).branch, 'rejected', 'CAA016 duplicate identity rejected')
const extraPortFixture = clone(baseFixture)
extraPortFixture.port_entries.push(clone(extraPortFixture.port_entries[6]))
extraPortFixture.port_entries[9].request_identity = 'extra-repository-state'
assert.equal(production.createArchitectureRepairAuthorityFixturePortsV8(extraPortFixture).branch, 'rejected', 'CAA016 extra tenth entry rejected')
const missingPortFixture = clone(baseFixture)
missingPortFixture.port_entries.pop()
assert.equal(production.createArchitectureRepairAuthorityFixturePortsV8(missingPortFixture).branch, 'rejected', 'CAA016 missing entry rejected')
for (const [name, index, mutate] of [
  ['wrong repository kind', 6, (entry) => { entry.request_kind = 'issue_state' }],
  ['wrong repository identity', 6, (entry) => { entry.request_identity = 'wrong-repository-state' }],
  ['wrong issue kind', 7, (entry) => { entry.request_kind = 'repository_state' }],
  ['wrong issue identity', 7, (entry) => { entry.request_identity = 'https://github.com/whatrune/sd-prompt-studio/issues/999' }],
]) {
  const fixture = clone(baseFixture)
  mutate(fixture.port_entries[index])
  assert.equal(production.createArchitectureRepairAuthorityFixturePortsV8(fixture).branch, 'rejected', `CAA016 ${name} rejected`)
}
for (const [name, index] of [['repository capture', 6], ['issue capture', 7]]) {
  const fixture = clone(baseFixture)
  fixture.port_entries[index].captured_value = { ...fixture.port_entries[index].captured_value, state: 'tampered' }
  const body = canonicalize(fixture.port_entries[index].captured_value)
  fixture.port_entries[index].body_utf8_length = Buffer.byteLength(body)
  fixture.port_entries[index].body_sha256 = shaText(body)
  assert.equal(production.createArchitectureRepairAuthorityFixturePortsV8(fixture).branch, 'rejected', `CAA016 ${name} request binding rejected`)
}
for (const [name, mutate] of [
  ['coercible string id', (payload) => ({ ...payload, id: String(payload.id) })],
  ['unpaired surrogate', (payload) => ({ ...payload, body: `${payload.body}\uD800` })],
]) {
  installAdapterFetch(mutate)
  const ports = production.createArchitectureRepairAuthorityFixturePortsV8(baseFixture)
  assert.equal(ports.branch, 'accepted')
  const failed = await production.materializeArchitectureRepairAuthorityProofV8(baseFixture.materialization_input, ports.value)
  assert.equal(failed.branch, 'failed', `CAA016 ${name}`)
}
globalThis.fetch = async () => ({ status: 201, json: async () => ({}) })
const non200Ports = production.createArchitectureRepairAuthorityFixturePortsV8(baseFixture)
assert.equal(non200Ports.branch, 'accepted')
assert.equal(
  (await production.materializeArchitectureRepairAuthorityProofV8(baseFixture.materialization_input, non200Ports.value)).branch,
  'failed',
  'CAA016 exact status 200 required',
)
globalThis.fetch = async () => { throw new Error('deterministic transport failure') }
const throwingPorts = production.createArchitectureRepairAuthorityFixturePortsV8(baseFixture)
assert.equal(throwingPorts.branch, 'accepted')
assert.equal(
  (await production.materializeArchitectureRepairAuthorityProofV8(baseFixture.materialization_input, throwingPorts.value)).branch,
  'failed',
  'CAA016 transport rejection fail-closed',
)
installAdapterFetch()
const nestedUnknown = clone(baseFixture.materialization_input)
nestedUnknown.canonical_body_requests[0].zzz = true
assert.equal((await production.materializeArchitectureRepairAuthorityProofV8(nestedUnknown, fixturePorts.value)).branch, 'rejected', 'M0 nested unknown rejected')
assert.equal(adapterFetchCalls, 0, 'M0 nested rejection performs zero port calls')
const utf8UnknownPrecedence = clone(baseFixture.materialization_input)
delete utf8UnknownPrecedence.schema_version
utf8UnknownPrecedence['\u{10000}'] = true
utf8UnknownPrecedence['\uE000'] = true
const utf8UnknownResult = await production.materializeArchitectureRepairAuthorityProofV8(utf8UnknownPrecedence, fixturePorts.value)
assert.equal(utf8UnknownResult.branch, 'rejected', 'M0 unknown before missing')
assert.equal(utf8UnknownResult.rejection.path, '/input/\uE000', 'M0 first unknown uses unsigned UTF-8 byte order')
assert.equal(adapterFetchCalls, 0, 'M0 unknown precedence performs zero port calls')
const outOfOrder = clone(baseFixture.materialization_input)
outOfOrder.canonical_body_requests.reverse()
assert.equal((await production.materializeArchitectureRepairAuthorityProofV8(outOfOrder, fixturePorts.value)).branch, 'rejected', 'M0 canonical order rejected')
assert.equal(adapterFetchCalls, 0, 'M0 ordering rejection performs zero port calls')
const resealDecisionInput = (input) => {
  input.decision_binding.projection_digest = sha(without(input.decision_binding, 'projection_digest'))
  input.input_digest = sha(without(input, 'input_digest'))
}
for (const [name, mutate, expectedCode] of [
  ['incomplete finding set', (binding) => { binding.finding_dispositions.pop() }, 'semantic_coverage_mismatch'],
  ['duplicate finding identity', (binding) => { binding.finding_dispositions[1].finding_id = binding.finding_dispositions[0].finding_id }, 'duplicate_identity'],
  ['out-of-order finding set', (binding) => { binding.finding_dispositions.reverse() }, 'semantic_coverage_mismatch'],
  ['invalid finding state', (binding) => { binding.finding_dispositions[0].state = 'unknown' }, 'invalid_enum'],
  ['blocking count mismatch', (binding) => { binding.blocking_finding_count += 1 }, 'invalid_enum'],
  ['invalid boolean', (binding) => { binding.contract_gap_closed = 'false' }, 'invalid_enum'],
  ['invalid status', (binding) => { binding.status = 'pending' }, 'invalid_enum'],
  ['unbound evidence ref', (binding) => { binding.finding_dispositions[0].evidence_ref.body_sha256 = '0'.repeat(64) }, 'cross_reference_mismatch'],
]) {
  const input = clone(baseFixture.materialization_input)
  mutate(input.decision_binding)
  resealDecisionInput(input)
  const result = await production.materializeArchitectureRepairAuthorityProofV8(input, fixturePorts.value)
  assert.equal(result.branch, 'rejected', `M0 Decision ${name}`)
  assert.equal(result.rejection.code, expectedCode, `M0 Decision ${name} code`)
  assert.equal(adapterFetchCalls, 0, `M0 Decision ${name} performs zero port calls`)
}
const decisionRequestIndex = baseFixture.materialization_input.canonical_body_requests.findIndex((request) => request.expected_record_type === 'independent_architecture_review_decision')
assert.ok(decisionRequestIndex >= 0, 'Decision request fixture')
const decisionIdentity = baseFixture.materialization_input.canonical_body_requests[decisionRequestIndex].source_record.canonical_record
const originalDecisionBody = exactBodies.get(decisionIdentity)
assert.equal(typeof originalDecisionBody, 'string', 'Decision exact body fixture')
const makeDecisionGrammarProbe = (mutateBody) => {
  const input = clone(baseFixture.materialization_input)
  const body = mutateBody(originalDecisionBody)
  const sourceRef = input.canonical_body_requests[decisionRequestIndex].source_record
  sourceRef.body_utf8_length = Buffer.byteLength(body)
  sourceRef.body_sha256 = shaText(body)
  input.decision_binding.decision_record = clone(sourceRef)
  for (const disposition of input.decision_binding.finding_dispositions) disposition.evidence_ref = clone(sourceRef)
  resealDecisionInput(input)
  const ports = Object.freeze({
    readCanonicalBody: async function (request, observedAt) {
      if (request.source_record.canonical_record !== decisionIdentity) return fixturePorts.value.readCanonicalBody(request, observedAt)
      return Object.freeze({ request_kind: 'canonical_body', request_identity: decisionIdentity, observed_at: observedAt, status: 'found', body_utf8: body, body_utf8_length: Buffer.byteLength(body), body_sha256: shaText(body) })
    },
    readRepositoryState: async function (request, observedAt) { return fixturePorts.value.readRepositoryState(request, observedAt) },
    readIssueState: async function (request, observedAt) { return fixturePorts.value.readIssueState(request, observedAt) },
  })
  return { input, ports }
}
for (const [name, mutateBody, expectedPath] of [
  ['duplicate top-level key', (body) => body.replace('decision: CHANGES_REQUIRED', 'decision: CHANGES_REQUIRED\ndecision: CHANGES_REQUIRED'), `/ports/readCanonicalBody/${decisionRequestIndex}`],
  ['incomplete disposition mapping', (body) => body.replace('  B-210-CBV8-REV-01: open\n', ''), '/decision_binding'],
  ['invalid boolean scalar', (body) => body.replace('contract_gap_closed: false', 'contract_gap_closed: maybe'), '/decision_binding'],
]) {
  const probe = makeDecisionGrammarProbe(mutateBody)
  const result = await production.materializeArchitectureRepairAuthorityProofV8(probe.input, probe.ports)
  assert.equal(result.branch, 'rejected', `M4 Decision grammar ${name}`)
  assert.equal(result.rejection.path, expectedPath, `M4 Decision grammar ${name} path`)
}
const internalPorts = Object.freeze({
  readCanonicalBody: async function (request, observedAt) { return fixturePorts.value.readCanonicalBody(request, observedAt) },
  readRepositoryState: async function (request, observedAt) {
    const value = await fixturePorts.value.readRepositoryState(request, observedAt)
    const body_utf8 = '{'
    return { ...value, body_utf8, body_utf8_length: Buffer.byteLength(body_utf8), body_sha256: shaText(body_utf8) }
  },
  readIssueState: async function (request, observedAt) { return fixturePorts.value.readIssueState(request, observedAt) },
})
const internalResult = await production.materializeArchitectureRepairAuthorityProofV8(baseFixture.materialization_input, internalPorts)
assert.equal(internalResult.branch, 'failed', 'M8 internal failure branch')
assert.equal(internalResult.failure.code, 'internal_failure', 'M8 owner exception classified internal')
globalThis.fetch = nativeFetch

const selectorReject = (code, path) => ({ branch: 'rejected', code, path, terminal_stage: 'selector', materialization_branch: 'not_invoked', validation_branch: 'not_invoked', materializer_call_vector: [0, 0, 0], validator_invocations: [], raw_body_retained: false })
const applySelectorOperation = (catalog, selector, operation) => {
  if (operation.kind === 'not_applicable') return null
  if (operation.kind === 'selector_replace') {
    const target = operation.path.startsWith('/base_components') || operation.path.startsWith('/derived_components') ? catalog : selector
    const old = pointer(target, operation.path)
    assert.equal(sha(old), operation.old_value_digest)
    replaceAt(target, operation.path, operation.value)
  } else if (operation.kind === 'selector_duplicate_identity') {
    const matches = [...catalog.base_components, ...catalog.derived_components].filter((item) => item.component_id === operation.source_component_id)
    assert.equal(matches.length, 1)
    addAt(catalog, operation.path, matches[0])
  } else assert.fail(`selector operation ${operation.kind}`)
  return null
}
const resolveComponent = (catalog, selector) => {
  const all = [...catalog.base_components, ...catalog.derived_components]
  const matches = all.filter((item) => item.component_id === selector.component_id)
  if (matches.length !== 1) {
    if (matches.length > 1) return { error: selectorReject('duplicate_identity', '/base_components/1/component_id') }
    return { error: selectorReject('cross_reference_mismatch', '/input_selector/component_id') }
  }
  const selected = matches[0]
  if (selected.schema_version === 'ArchitectureRepairFixtureComponentV8') {
    if (sha(without(selected, 'component_digest')) !== selected.component_digest) return { error: selectorReject('digest_mismatch', '/base_components/0/component_digest') }
    return { component: clone(selected) }
  }
  const base = catalog.base_components.filter((item) => item.component_id === selected.base_component_id)
  if (base.length !== 1 || base[0].component_digest !== selected.base_component_digest) return { error: selectorReject('cross_reference_mismatch', '/derived_components/0/base_component_digest') }
  if (sha(pointer(base[0][selected.mutation.argument], selected.mutation.path)) !== selected.mutation.old_value_digest) return { error: selectorReject('digest_mismatch', '/derived_components/0/mutation/old_value_digest') }
  const expanded = clone(base[0])
  expanded.component_id = selected.component_id
  replaceAt(expanded[selected.mutation.argument], selected.mutation.path, selected.mutation.value)
  expanded.expected_materialization = clone(selected.expected_materialization)
  expanded.expected_validation = clone(selected.expected_validation)
  expanded.component_digest = selected.expanded_component_digest
  if (sha(without(expanded, 'component_digest')) !== selected.expanded_component_digest) return { error: selectorReject('digest_mismatch', '/derived_components/0/expanded_component_digest') }
  return { component: expanded }
}

const applyInputOperation = (state, operation) => {
  state.operation = operation
  if (operation.kind === 'not_applicable' || ['port_fault', 'forged_token', 'token_reuse_sequence', 'forbidden_surface_scan', 'retired_export_absence', 'captured_successor'].includes(operation.kind)) return
  const target = state[operation.argument]
  if (operation.kind === 'json_add') addAt(target, operation.path, operation.value)
  else if (operation.kind === 'json_remove') removeAt(target, operation.path)
  else if (operation.kind === 'json_replace' || operation.kind === 'live_current_successor') {
    assert.equal(sha(pointer(target, operation.path)), operation.old_value_digest)
    replaceAt(target, operation.path, operation.value)
    if (operation.kind === 'live_current_successor') {
      const entry = state.port_entries.find((item) => item.request_kind === 'issue_state' && item.request_identity === operation.issue_url)
      assert.ok(entry)
      entry.captured_value.latest_top_level_comment_ref = {
        ...entry.captured_value.latest_top_level_comment_ref,
        canonical_record: operation.successor_record,
      }
      const body = canonicalize(entry.captured_value)
      entry.body_utf8_length = Buffer.byteLength(body)
      entry.body_sha256 = sha(body)
    }
  } else if (operation.kind === 'request_duplicate') {
    const source = pointer(target, operation.source_array_path)
    const { parent } = parentAt(target, operation.path)
    assert.equal(parent, source)
    addAt(target, operation.path, source[operation.source_index])
  } else assert.fail(`input operation ${operation.kind}`)
  if (operation.argument === 'port_entries') state.activePortIndex = Number(decodePointer(operation.path)[0])
  for (const step of operation.reseal ?? []) reseal(state, step)
}

const buildPorts = (state, counts) => {
  const byKind = (kind) => state.port_entries.filter((entry) => entry.request_kind === kind)
  const invoke = async (method, kind, request, observedAt) => {
    counts[method] += 1
    const ordinal = counts[method]
    if (state.operation.kind === 'port_fault' && state.operation.method === method && state.operation.ordinal === ordinal) {
      if (state.operation.fault === 'promise_rejection') throw new Error('deterministic port rejection')
    }
    const identity = kind === 'canonical_body' ? request.source_record.canonical_record : kind === 'repository_state' ? `${request.repository}@${request.full_commit_sha}` : request.issue_url
    const entry = byKind(kind).find((candidate) => candidate.request_identity === identity)
    assert.ok(entry, `${method} fixture ${identity}`)
    const body = entry.source_mode === 'github_exact_comment_body' ? exactBodies.get(identity) : canonicalize(entry.captured_value)
    assert.equal(typeof body, 'string')
    const digest = state.operation.kind === 'port_fault' && state.operation.method === method && state.operation.ordinal === ordinal && state.operation.fault === 'body_sha256_mismatch'
      ? '0'.repeat(64)
      : shaText(body)
    return Object.freeze({ request_kind: kind, request_identity: identity, observed_at: observedAt, status: 'found', body_utf8: body, body_utf8_length: Buffer.byteLength(body), body_sha256: digest })
  }
  return Object.freeze({
    readCanonicalBody: async function (request, observedAt) { return invoke('readCanonicalBody', 'canonical_body', request, observedAt) },
    readRepositoryState: async function (request, observedAt) { return invoke('readRepositoryState', 'repository_state', request, observedAt) },
    readIssueState: async function (request, observedAt) { return invoke('readIssueState', 'issue_state', request, observedAt) },
  })
}
const normalizeMaterialization = (result) => result.branch === 'produced'
  ? { branch: 'produced', code: 'not_applicable', path: '' }
  : result.branch === 'failed'
    ? { branch: 'failed', code: result.failure.code, path: result.failure.path }
    : { branch: 'rejected', code: result.rejection.code, path: result.rejection.path }
const normalizeValidation = (result) => result.branch === 'accepted'
  ? { branch: 'accepted', code: 'not_applicable', path: '' }
  : { branch: 'rejected', code: result.rejection.code, path: result.rejection.path }

const runCbvRow = async (row) => {
  const catalog = clone(fixtureCatalog)
  const selector = { kind: 'content_addressed_fixture_component_v7', catalog_record: RECORDS.fixture, catalog_block_id: catalog.block_id, catalog_block_sha256: catalog.catalog_digest, component_id: row.component_id }
  applySelectorOperation(catalog, selector, row.selector_mutation)
  const resolved = resolveComponent(catalog, selector)
  if (resolved.error) return resolved.error
  const state = { observation: clone(resolved.component.observation), production_input: clone(resolved.component.production_input), materialization_input: clone(resolved.component.materialization_input), port_entries: clone(resolved.component.port_entries) }
  applyInputOperation(state, row.input_mutation)
  if (row.input_mutation.kind === 'retired_export_absence') {
    assert.equal(Object.prototype.hasOwnProperty.call(production, row.input_mutation.export_name), false)
    return { branch: 'accepted', code: 'not_applicable', path: '', terminal_stage: 'static_surface', materialization_branch: 'not_invoked', validation_branch: 'not_invoked', materializer_call_vector: [0, 0, 0], validator_invocations: [], raw_body_retained: false }
  }
  const counts = { readCanonicalBody: 0, readRepositoryState: 0, readIssueState: 0 }
  const materialized = await production.materializeArchitectureRepairAuthorityProofV8(state.materialization_input, buildPorts(state, counts))
  const material = normalizeMaterialization(materialized)
  if (materialized.branch !== 'produced') return { branch: material.branch, code: material.code, path: material.path, terminal_stage: 'materializer', materialization_branch: material.branch, validation_branch: 'not_invoked', materializer_call_vector: Object.values(counts), validator_invocations: [], raw_body_retained: false }
  let token = materialized.proof_token
  if (row.input_mutation.kind === 'forged_token') token = clone(token)
  const invocations = []
  const callValidator = () => {
    const admitted = production.validateArchitectureRepairAuthorityObservationV8(state.observation, state.production_input, token)
    const normalized = normalizeValidation(admitted)
    invocations.push({ ordinal: invocations.length + 1, branch: normalized.branch, code: normalized.code, path: normalized.path, projection_reads: normalized.branch === 'accepted' || normalized.path.includes('/projection/') || normalized.path.endsWith('/observation_digest') ? 1 : 0 })
    return normalized
  }
  let validated = callValidator()
  let validationBranch = validated.branch
  if (row.input_mutation.kind === 'token_reuse_sequence') {
    validated = callValidator()
    validationBranch = 'accepted_then_rejected'
  }
  if (row.input_mutation.kind === 'forbidden_surface_scan') {
    const text = canonicalize({ result: validated, trace: [], diagnostic: '', evidence: null, evaluator_input: null, result_handoff: null, dispatch: null, redispatch: null, log: null, cache: null })
    for (const body of exactBodies.values()) assert.equal(text.includes(body), false)
  }
  return { branch: validated.branch, code: validated.code, path: validated.path, terminal_stage: 'validator', materialization_branch: 'produced', validation_branch: validationBranch, materializer_call_vector: Object.values(counts), validator_invocations: invocations, raw_body_retained: false }
}

const proofDerivedState = { observation: clone(baseFixture.observation), production_input: clone(baseFixture.production_input), materialization_input: clone(baseFixture.materialization_input), port_entries: clone(baseFixture.port_entries), operation: { kind: 'not_applicable' } }
const proofDerivedCounts = { readCanonicalBody: 0, readRepositoryState: 0, readIssueState: 0 }
const proofDerivedMaterialized = await production.materializeArchitectureRepairAuthorityProofV8(proofDerivedState.materialization_input, buildPorts(proofDerivedState, proofDerivedCounts))
assert.equal(proofDerivedMaterialized.branch, 'produced', 'V8 proof-derived fixture materialized')
proofDerivedState.observation.authority_snapshot.main_full_head_sha = '0'.repeat(40)
proofDerivedState.observation.authority_snapshot.snapshot_digest = sha(without(proofDerivedState.observation.authority_snapshot, 'snapshot_digest'))
proofDerivedState.observation.observation_digest = sha(without(proofDerivedState.observation, 'observation_digest'))
const proofDerivedRejected = production.validateArchitectureRepairAuthorityObservationV8(proofDerivedState.observation, proofDerivedState.production_input, proofDerivedMaterialized.proof_token)
assert.equal(proofDerivedRejected.branch, 'rejected', 'V8 caller-consistent forged snapshot rejected')
assert.equal(proofDerivedRejected.rejection.path, '/observation/authority_snapshot', 'V8 proof-derived snapshot authority')

const cbvResults = []
for (const row of validationCatalog.rows) {
  const actual = await runCbvRow(row)
  assert.deepEqual(actual, row.expected, row.row_id)
  cbvResults.push({ row_id: row.row_id, branch: actual.branch, digest: sha(actual) })
}

const parseArlRows = (body) => body.split('\n').filter((line) => /^\| \d+ \| ARL-/.test(line)).map((line) => {
  const columns = line.split(' | ')
  return { ordinal: Number(columns[0].slice(2)), row_id: columns[1], family_id: columns[2], input: JSON.parse(columns[3].slice(1, -1)), input_digest: columns[4].slice(1, -1), expected: JSON.parse(columns[5].slice(1, -1)), expected_digest: columns[6].slice(1, -1), row_digest: columns[7].replaceAll('`', '').replaceAll('|', '').trim() }
})
const arlRows = parseArlRows(bodies.corpus)
assert.equal(arlRows.length, 41)
assert.equal(sha({ schema_version: 'ArlRowCorpusV2', ordering: 'ordinal_ascending', rows: arlRows.map(({ row_id, ordinal, row_digest }) => ({ row_id, ordinal, row_digest })) }), '1a19023e505c27ecdb83bd9429de1fbb81df1e7302ee360bc9ba7713dc28562c')
const evaluateArl = (input) => {
  const calls = { amendment_create: 0, dispatch_create: 0, fresh_fetch: 1, protected_action: 0, redispatch_create: 0, source_issue_209_mutation: 0 }
  const result = (attempt_state, diagnostic, next_action, next_role, terminal, trace) => ({ attempt_state, calls: { ...calls }, diagnostic, next_action, next_role, terminal, trace })
  const s = input.source
  const d = input.decision
  const f = input.findings
  const a = input.artifact
  const p = input.publication
  const r = input.rereview
  const S0 = ['S0-STRUCTURE']
  if (s.fetch_state === 'unavailable') return result('none', 'external_evidence_unavailable', 'retry_fresh_read', 'Integrated Lead', 'evidence_refresh_wait', [...S0, 'STOP'])
  if (d.kind === 'pending' || !d.current && !d.superseded && s.authority_current) return result('none', 'pending_not_decision', 'none', 'none', 'structural_rejected', [...S0, 'STOP'])
  if (!s.decision_direct || s.decision_alias) return result('none', 'non_direct_canonical_url', 'none', 'none', 'structural_rejected', [...S0, 'STOP'])
  if (d.unknown_field) return result('none', 'unknown_field', 'none', 'none', 'structural_rejected', [...S0, 'STOP'])
  const S1 = [...S0, 'S1-DECISION']
  if (s.fetch_state === 'evidence_unreadable') return result('none', 'external_evidence_unavailable', 'restore_readable_authority', 'Integrated Lead', 'evidence_refresh_wait', [...S1, 'STOP'])
  if (d.kind === 'APPROVE' && a.amendment_state === 'none') return result('none', 'unsupported_decision', 'none', 'none', 'not_completed', [...S1, 'STOP'])
  if (d.kind === 'BLOCKED') return result('none', 'unsupported_decision', 'refresh_evidence_only', 'Integrated Lead', 'evidence_refresh_wait', [...S1, 'STOP'])
  if (s.decision_head_count > 1) return result('conflict', 'authority_drift', 'resolve_canonical_chain', 'Integrated Lead', 'canonical_conflict', [...S1, 'STOP'])
  if (!s.authority_current && d.superseded) return result('none', 'authority_drift', 'fetch_current_successor', 'Integrated Lead', 'semantic_rejected', [...S1, 'STOP'])
  const S2 = [...S1, 'S2-PAUSE']
  if (!s.pause_current) return result('none', 'source_pause_not_current', 'resolve_pause_authority', 'Integrated Lead', 'evidence_refresh_wait', [...S2, 'STOP'])
  const S3 = [...S2, 'S3-FINDINGS']
  if (f.identity_state === 'duplicate' || f.identity_state === 'different_id_same_digest') return result('none', 'duplicate_identity', 'none', 'none', 'structural_rejected', [...S1, 'S3-FINDINGS', 'STOP'])
  if (f.identity_state === 'same_id_different_digest') return result('conflict', 'finding_identity_conflict', 'route_collision_gate', 'Integrated Lead', 'canonical_conflict', [...S1, 'S3-FINDINGS', 'STOP'])
  if (!f.source_text_exact) return result('none', 'finding_semantic_rewrite', 'none', 'none', 'semantic_rejected', [...S1, 'S3-FINDINGS', 'STOP'])
  const S4 = [...S3, 'S4-GATE']
  const gates = new Set(f.gate_classes)
  if (f.collision_count > 0) return result('none', 'finding_collision', gates.size > 1 ? 'resolve_collision_first' : 'clarify_collision', 'Architect Team Independent Reviewer', 'human_gate_wait', [...S4, 'STOP'])
  if (gates.has('specification_meaning_change')) return result('none', 'none', f.count > 1 ? 'resolve_meaning_before_routing' : 'decide_exact_meaning_option', 'Product Owner', 'human_gate_wait', [...S4, 'STOP'])
  if (gates.has('safety_boundary_change')) return result('none', 'none', 'decide_exact_safety_option', 'Product Owner', 'human_gate_wait', [...S4, 'STOP'])
  if (gates.has('destructive_action')) return result('none', 'none', 'decide_exact_destructive_scope', 'Product Owner', 'human_gate_wait', [...S4, 'STOP'])
  if (a.amendment_state === 'none') {
    const S5 = [...S4, 'S5-DISPATCH']
    if (p.slot_state === 'identical_existing' && p.payload_relation === 'identical') return result('reused', 'none', p.invocation_role === 'concurrent_loser' ? 'reuse_winner_dispatch' : 'reuse_canonical_dispatch', p.invocation_role === 'concurrent_loser' ? 'Architect Team' : 'Integrated Lead', 'idempotent_replay', S5)
    if (p.slot_state === 'divergent_existing') return result('conflict', 'publication_payload_conflict', 'resolve_canonical_conflict', 'Integrated Lead', 'canonical_conflict', [...S5, 'STOP'])
    if (p.transport_state === 'create_failed_no_record') { calls.dispatch_create = 1; return result('failed_retryable', 'transport_failed_no_record', 'retry_same_slot_after_fresh_read', 'Integrated Lead', 'evidence_refresh_wait', [...S5, 'STOP']) }
    if (p.transport_state === 'create_success') { calls.dispatch_create = 1; return result('published', 'none', p.invocation_role === 'concurrent_winner' ? 'use_winner_dispatch' : 'publish_cumulative_amendment', 'Architect Team', 'architect_dispatched', S5) }
    return result('unclaimed', 'none', 'publish_repair_dispatch', 'Integrated Lead', 'iteration_admitted', S4)
  }
  const S6 = [...S4, 'S6-AMENDMENT']
  if (!s.authority_current) return result('none', 'authority_drift', 'fresh_redispatch_new_iteration_review', 'Integrated Lead', 'evidence_refresh_wait', [...S6, 'STOP'])
  if (a.amendment_state === 'orphan_section') return result('none', 'orphan_amendment_section', 'map_or_remove_section', 'Architect Team', 'amendment_rejected', [...S6, 'STOP'])
  const S7 = [...S6, 'S7-RESPONSE']
  if (a.response_state === 'orphan_response') return result('none', 'orphan_response', 'correct_response_matrix', 'Architect Team', 'amendment_rejected', [...S7, 'STOP'])
  const S8 = [...S7, 'S8-MATRIX']
  if (a.matrix_state === 'unaffected_changed') return result('none', 'unaffected_row_changed', 'restore_unaffected_row', 'Architect Team', 'amendment_rejected', [...S8, 'STOP'])
  if (a.matrix_state === 'positive_missing') return result('none', 'required_validation_missing', 'add_positive_row', 'Architect Team', 'amendment_rejected', [...S8, 'STOP'])
  if (a.matrix_state === 'negative_missing') return result('none', 'required_validation_missing', 'add_negative_zero_call_row', 'Architect Team', 'amendment_rejected', [...S8, 'STOP'])
  const S9 = [...S8, 'S9-REDISPATCH']
  if (r.kind === 'none' && p.transport_state === 'create_success') { calls.redispatch_create = 1; return result('published', 'none', 'fresh_review', 'Architect Team Independent Reviewer', 'fresh_review_dispatched', S9) }
  const S10 = [...S9, 'S10-REREVIEW']
  if (r.kind === 'CHANGES_REQUIRED') return result('unclaimed', 'none', 'admit_successor_findings', 'Integrated Lead', 'next_iteration', S10)
  if (r.kind === 'BLOCKED') return result('none', 'external_evidence_unavailable', 'refresh_evidence_only', 'Integrated Lead', 'evidence_refresh_wait', [...S10, 'STOP'])
  if (a.closure_state === 'architect_claim_only') return result('none', 'closure_table_mismatch', 'review_claims', 'Architect Team Independent Reviewer', 'not_completed', [...S10, 'STOP'])
  if (r.kind === 'APPROVE' && r.new_finding_count > 0) return result('none', 'new_finding_present', 'next_changes_required_iteration', 'Integrated Lead', 'not_completed', [...S10, 'STOP'])
  if (r.kind === 'APPROVE' && (a.closure_state !== 'complete' || !r.all_prior_closed)) return result('none', 'closure_table_mismatch', 'correct_decision_record', 'Architect Team Independent Reviewer', 'not_completed', [...S10, 'STOP'])
  return result('none', 'none', 'report_architecture_review_completion', 'Integrated Lead', 'completed', [...S10, 'S11-COMPLETE'])
}
const arlResults = []
for (const row of arlRows) {
  assert.equal(sha(row.input), row.input_digest, `${row.row_id} input digest`)
  assert.equal(sha(row.expected), row.expected_digest, `${row.row_id} expected digest`)
  assert.equal(sha({ row_id: row.row_id, ordinal: row.ordinal, family_id: row.family_id, input: row.input, input_digest: row.input_digest, expected: row.expected, expected_digest: row.expected_digest }), row.row_digest, `${row.row_id} row digest`)
  const actual = evaluateArl(clone(row.input))
  assert.deepEqual(actual, row.expected, row.row_id)
  assert.deepEqual(actual.calls.protected_action, 0)
  assert.deepEqual(actual.calls.source_issue_209_mutation, 0)
  arlResults.push({ row_id: row.row_id, terminal: actual.terminal, digest: sha(actual) })
}

await vite.close()
console.log(JSON.stringify({ result: 'PASS', operations: 14, cbv: { rows: cbvResults.length, results: cbvResults }, arl: { rows: arlResults.length, results: arlResults } }))
