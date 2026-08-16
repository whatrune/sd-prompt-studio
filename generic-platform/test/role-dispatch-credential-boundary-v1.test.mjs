import assert from 'node:assert/strict'
import { ChildProcess } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { ContractViolationV1 } from '../src/core/contracts-v1.mjs'
import {
  digestCanonicalV1,
  projectProviderInvocationV1,
  sealRoleDispatchV1,
  validateRoleOutputV1,
} from '../src/core/role-dispatch-v1.mjs'
import { runProviderSubprocessCredentialBoundaryV1 } from '../src/host/provider-credential-boundary-v1.mjs'

let assertions = 0
const check = (condition, message) => { assertions += 1; assert.ok(condition, message) }
const rejectsSync = (operation, reason) => {
  assertions += 1
  assert.throws(operation, (error) => error instanceof ContractViolationV1 && error.message === reason)
}
const rejectsAsync = async (operation, reason) => {
  assertions += 1
  await assert.rejects(operation, (error) => error instanceof ContractViolationV1 && error.message === reason)
}
const processIsRunning = (pid) => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}
const readOptional = async (file) => {
  try {
    return await readFile(file, 'utf8')
  } catch (error) {
    if (error?.code === 'ENOENT') return ''
    throw error
  }
}
const withPatchedChildKill = async (replacement, operation) => {
  const originalKill = ChildProcess.prototype.kill
  ChildProcess.prototype.kill = function (signal) {
    return replacement.call(this, originalKill, signal)
  }
  try {
    return await operation()
  } finally {
    ChildProcess.prototype.kill = originalKill
  }
}
const rejectsExactlyOnce = async (operation, reason) => {
  let settlementCount = 0
  let observedError
  await operation().then(
    () => { settlementCount += 1 },
    (error) => {
      settlementCount += 1
      observedError = error
    },
  )
  await new Promise((resolve) => setTimeout(resolve, 50))
  check(
    observedError instanceof ContractViolationV1 && observedError.message === reason,
    `${reason} is the bounded terminal failure`,
  )
  check(settlementCount === 1, `${reason} settles exactly once`)
}

const identity = {
  record_type: 'gadp_identity_v1', repository: 'whatrune/sd-prompt-studio', task_issue_number: 251,
  pr_number: 316, exact_head: 'a'.repeat(40), attempt: 1,
}
const review = {
  record_type: 'gadp_review_v1', identity, source_id: 'comment-100', source_order: 100, observed_at: '2026-08-16T00:00:00Z',
  decision: 'APPROVE', blocking_finding_count: 0, remaining_finding_count: 0, unknown_count: 0,
}
const prompt = 'Perform the sealed read-only role assignment.'
const dispatch = sealRoleDispatchV1({
  identity,
  review,
  roleId: 'independent-reviewer',
  profileId: 'sdps-reviewer-v1',
  purpose: 'INDEPENDENT_REVIEW',
  authorizedPaths: ['generic-platform/src/core/role-dispatch-v1.mjs'],
  capabilityIds: [],
  promptSha256: digestCanonicalV1(prompt),
})

check(Object.isFrozen(dispatch) && Object.isFrozen(dispatch.identity), 'sealed dispatch is immutable')
check(dispatch.source_review_id === review.source_id && dispatch.identity.exact_head === identity.exact_head, 'dispatch binds Review and full HEAD')
rejectsSync(() => sealRoleDispatchV1({
  identity: { ...identity, exact_head: 'b'.repeat(40) }, review, roleId: 'independent-reviewer',
  profileId: 'sdps-reviewer-v1', purpose: 'INDEPENDENT_REVIEW', authorizedPaths: [], capabilityIds: [],
  promptSha256: digestCanonicalV1(prompt),
}), 'role_dispatch_binding_invalid')

const invocation = projectProviderInvocationV1({ dispatch, prompt })
check(invocation.provider_credential_keys.length === 0 && invocation.repository_access === false, 'provider projection is credential-free and repository-free')
check(invocation.protected_operation_authorized === false && !Object.hasOwn(invocation, 'executable'), 'provider projection grants no protected operation or command execution')
rejectsSync(() => projectProviderInvocationV1({ dispatch, prompt: `${prompt} changed` }), 'provider_invocation_binding_invalid')

const body = '# Independent Review\nstatus: completed'
const output = {
  record_type: 'gadp_role_output_v1',
  dispatch_sha256: digestCanonicalV1(dispatch),
  identity,
  role_id: dispatch.role_id,
  purpose: dispatch.purpose,
  status: 'COMPLETED',
  body,
  body_sha256: createHash('sha256').update(body, 'utf8').digest('hex'),
}
const validatedOutput = validateRoleOutputV1({ dispatch, output })
check(validatedOutput.ok && validatedOutput.output.body === body, 'role output is bound to sealed dispatch and payload digest')
check(validatedOutput.protected_operation_authorized === false, 'validated role output grants no protected operation')
rejectsSync(() => validateRoleOutputV1({ dispatch, output: { ...output, body: `${body} changed` } }), 'role_output_invalid')
rejectsSync(() => validateRoleOutputV1({ dispatch, output: { ...output, dispatch_sha256: '0'.repeat(64) } }), 'role_output_invalid')
rejectsSync(() => validateRoleOutputV1({ dispatch, output: { ...output, identity: { ...identity, exact_head: 'b'.repeat(40) } } }), 'role_output_invalid')
rejectsSync(() => validateRoleOutputV1({ dispatch, output: { ...output, operation_authorized: true } }), 'role_output_invalid')

const trustedEnvironment = {
  SAFE_VALUE: 'provider-safe',
  BROKER_TOKEN: 'trusted-broker',
  CLOUD_TOKEN: 'trusted-cloud',
  GH_TOKEN: 'trusted-github',
  REPOSITORY_TOKEN: 'trusted-repository',
  UNRELATED_SECRET: 'never-provider-visible',
}
const credentialKeys = ['BROKER_TOKEN', 'CLOUD_TOKEN', 'GH_TOKEN', 'REPOSITORY_TOKEN']
const childProbe = String.raw`process.stdout.write(JSON.stringify({
  safe: process.env.SAFE_VALUE ?? null,
  broker: process.env.BROKER_TOKEN ?? null,
  cloud: process.env.CLOUD_TOKEN ?? null,
  github: process.env.GH_TOKEN ?? null,
  repository: process.env.REPOSITORY_TOKEN ?? null,
  unrelated: process.env.UNRELATED_SECRET ?? null,
  keys: Object.keys(process.env).sort()
}))`
const bounded = await runProviderSubprocessCredentialBoundaryV1({
  command: process.execPath,
  args: ['-e', childProbe],
  cwd: fileURLToPath(new URL('.', import.meta.url)),
  trustedEnvironment,
  credentialKeys,
  providerAllowedEnvironmentKeys: ['SAFE_VALUE'],
})
const childObservation = JSON.parse(bounded.stdout)
const trustedKeysObservedByChild = Object.keys(trustedEnvironment).filter((key) => childObservation.keys.includes(key))
check(bounded.exit_code === 0 && bounded.signal === null, 'credential boundary owns and completes the provider subprocess')
check(
  childObservation.broker === null && childObservation.cloud === null && childObservation.github === null &&
    childObservation.repository === null && childObservation.unrelated === null,
  'actual provider child receives no repository, cloud, broker, GitHub, or unrelated credential',
)
check(
  childObservation.safe === 'provider-safe' && trustedKeysObservedByChild.join(',') === 'SAFE_VALUE' &&
    bounded.child_environment_keys.join(',') === 'SAFE_VALUE',
  'actual provider child inherits only the explicit non-sensitive allowlist from trusted host input',
)
check(
  trustedEnvironment.BROKER_TOKEN === 'trusted-broker' && trustedEnvironment.CLOUD_TOKEN === 'trusted-cloud' &&
    trustedEnvironment.GH_TOKEN === 'trusted-github' && trustedEnvironment.REPOSITORY_TOKEN === 'trusted-repository',
  'trusted-host credentials remain available independently after provider completion',
)
const trustedValidationAfterProvider = validateRoleOutputV1({ dispatch, output })
check(trustedValidationAfterProvider.ok && bounded.trusted_credential_available_after, 'trusted role-output validation executes after provider completion')
check(bounded.protected_operation_executed === false, 'provider subprocess boundary executes no protected operation')

const nonzero = await runProviderSubprocessCredentialBoundaryV1({
  command: process.execPath,
  args: ['-e', 'process.exit(7)'],
  cwd: fileURLToPath(new URL('.', import.meta.url)),
  trustedEnvironment,
  credentialKeys,
  providerAllowedEnvironmentKeys: [],
})
check(nonzero.exit_code === 7, 'provider nonzero completion is returned to the trusted host')
check(trustedEnvironment.GH_TOKEN === 'trusted-github', 'provider nonzero completion does not consume trusted-host credentials')

await rejectsAsync(() => runProviderSubprocessCredentialBoundaryV1({
  command: process.execPath,
  args: ['-e', 'process.exit(0)'],
  cwd: fileURLToPath(new URL('.', import.meta.url)),
  trustedEnvironment,
  credentialKeys,
  providerAllowedEnvironmentKeys: [],
  stdin: 'x'.repeat(262144),
  timeoutMs: 1000,
}), 'provider_stdin_write_failed')
check(trustedEnvironment.GH_TOKEN === 'trusted-github', 'stdin early-close failure is bounded without terminating the trusted host')

const lifecycleTemp = await mkdtemp(path.join(tmpdir(), 'gadp-provider-boundary-'))
try {
  const gracefulPidFile = path.join(lifecycleTemp, 'graceful.pid')
  const gracefulSignalFile = path.join(lifecycleTemp, 'graceful.signal')
  const gracefulProbe = `
    const { appendFileSync, writeFileSync } = require('node:fs')
    writeFileSync(${JSON.stringify(gracefulPidFile)}, String(process.pid))
    process.on('SIGTERM', () => {
      appendFileSync(${JSON.stringify(gracefulSignalFile)}, 'SIGTERM')
      setTimeout(() => process.exit(0), 25)
    })
    setInterval(() => {}, 1000)
  `
  const gracefulStarted = Date.now()
  await rejectsAsync(() => runProviderSubprocessCredentialBoundaryV1({
    command: process.execPath,
    args: ['-e', gracefulProbe],
    cwd: fileURLToPath(new URL('.', import.meta.url)),
    trustedEnvironment,
    credentialKeys,
    providerAllowedEnvironmentKeys: [],
    timeoutMs: 500,
  }), 'provider_process_timeout')
  const gracefulElapsed = Date.now() - gracefulStarted
  const gracefulPid = Number(await readFile(gracefulPidFile, 'utf8'))
  const gracefulSignal = await readOptional(gracefulSignalFile)
  check(!processIsRunning(gracefulPid), 'timeout waits for graceful child termination confirmation')
  check(
    process.platform === 'win32' || (gracefulSignal === 'SIGTERM' && gracefulElapsed < 700),
    'timeout child that handles SIGTERM terminates within the bounded grace period',
  )

  const forcedPidFile = path.join(lifecycleTemp, 'forced.pid')
  const forcedSignalFile = path.join(lifecycleTemp, 'forced.signal')
  const forcedProbe = `
    const { appendFileSync, writeFileSync } = require('node:fs')
    writeFileSync(${JSON.stringify(forcedPidFile)}, String(process.pid))
    process.on('SIGTERM', () => appendFileSync(${JSON.stringify(forcedSignalFile)}, 'SIGTERM'))
    setInterval(() => {}, 1000)
  `
  const forcedStarted = Date.now()
  await withPatchedChildKill(function (originalKill, signal) {
    if (signal === 'SIGTERM') return true
    return originalKill.call(this, signal)
  }, () => rejectsAsync(() => runProviderSubprocessCredentialBoundaryV1({
    command: process.execPath,
    args: ['-e', forcedProbe],
    cwd: fileURLToPath(new URL('.', import.meta.url)),
    trustedEnvironment,
    credentialKeys,
    providerAllowedEnvironmentKeys: [],
    timeoutMs: 500,
  }), 'provider_process_timeout'))
  const forcedElapsed = Date.now() - forcedStarted
  const forcedPid = Number(await readFile(forcedPidFile, 'utf8'))
  const forcedSignal = await readOptional(forcedSignalFile)
  check(!processIsRunning(forcedPid), 'SIGTERM-ignoring child is absent after force termination confirmation')
  check(
    forcedSignal === '' && forcedElapsed >= 700,
    'SIGTERM-ignoring child reaches bounded force termination after the grace period',
  )

  const killErrorPidFile = path.join(lifecycleTemp, 'kill-error.pid')
  let killErrorSettlementCount = 0
  let killErrorEmissionCount = 0
  await withPatchedChildKill(function (originalKill, signal) {
    if (signal === 'SIGTERM') {
      killErrorEmissionCount += 1
      this.emit('error', Object.assign(new Error('signal delivery failed'), { code: 'EPERM' }))
      return false
    }
    return originalKill.call(this, signal)
  }, async () => {
    await runProviderSubprocessCredentialBoundaryV1({
      command: process.execPath,
      args: ['-e', `require('node:fs').writeFileSync(${JSON.stringify(killErrorPidFile)}, String(process.pid)); setInterval(() => {}, 1000)`],
      cwd: fileURLToPath(new URL('.', import.meta.url)),
      trustedEnvironment,
      credentialKeys,
      providerAllowedEnvironmentKeys: [],
      timeoutMs: 500,
    }).then(
      () => { killErrorSettlementCount += 1 },
      (error) => {
        killErrorSettlementCount += 1
        check(error instanceof ContractViolationV1 && error.message === 'provider_process_timeout', 'kill ChildProcess.error preserves the primary timeout reason after confirmed cleanup')
      },
    )
  })
  await new Promise((resolve) => setTimeout(resolve, 50))
  const killErrorPid = Number(await readFile(killErrorPidFile, 'utf8'))
  check(killErrorEmissionCount === 1, 'kill/signal delivery ChildProcess.error is absorbed by termination lifecycle')
  check(killErrorSettlementCount === 1, 'kill ChildProcess.error and close race settles exactly once')
  check(!processIsRunning(killErrorPid), 'kill ChildProcess.error path returns only after child absence')

  const overflowPidFile = path.join(lifecycleTemp, 'overflow.pid')
  const overflowProbe = `
    const { writeFileSync } = require('node:fs')
    writeFileSync(${JSON.stringify(overflowPidFile)}, String(process.pid))
    setInterval(() => process.stdout.write('x'.repeat(65536)), 1)
  `
  await rejectsExactlyOnce(() => runProviderSubprocessCredentialBoundaryV1({
    command: process.execPath,
    args: ['-e', overflowProbe],
    cwd: fileURLToPath(new URL('.', import.meta.url)),
    trustedEnvironment,
    credentialKeys,
    providerAllowedEnvironmentKeys: [],
    timeoutMs: 5000,
  }), 'provider_output_bound_exceeded')
  const overflowPid = Number(await readFile(overflowPidFile, 'utf8'))
  check(!processIsRunning(overflowPid), 'output overflow returns only after the continuing child is absent')

  const overflowKillPidFile = path.join(lifecycleTemp, 'overflow-kill-error.pid')
  let overflowKillErrorCount = 0
  await withPatchedChildKill(function (originalKill, signal) {
    if (signal === 'SIGTERM') {
      overflowKillErrorCount += 1
      this.emit('error', Object.assign(new Error('overflow signal delivery failed'), { code: 'EPERM' }))
      return false
    }
    return originalKill.call(this, signal)
  }, () => rejectsExactlyOnce(() => runProviderSubprocessCredentialBoundaryV1({
    command: process.execPath,
    args: ['-e', `require('node:fs').writeFileSync(${JSON.stringify(overflowKillPidFile)}, String(process.pid)); setInterval(() => process.stdout.write('x'.repeat(65536)), 1)`],
    cwd: fileURLToPath(new URL('.', import.meta.url)),
    trustedEnvironment,
    credentialKeys,
    providerAllowedEnvironmentKeys: [],
    timeoutMs: 5000,
  }), 'provider_output_bound_exceeded'))
  const overflowKillPid = Number(await readFile(overflowKillPidFile, 'utf8'))
  check(overflowKillErrorCount === 1, 'output overflow absorbs graceful kill failure without losing its primary reason')
  check(!processIsRunning(overflowKillPid), 'output overflow plus kill failure returns only after force-confirmed absence')

  const unconfirmedPidFile = path.join(lifecycleTemp, 'unconfirmed.pid')
  let unconfirmedSignalErrors = 0
  await withPatchedChildKill(function (_originalKill, signal) {
    unconfirmedSignalErrors += 1
    this.emit('error', Object.assign(new Error(`${signal} delivery failed`), { code: 'EPERM' }))
    return false
  }, () => rejectsExactlyOnce(() => runProviderSubprocessCredentialBoundaryV1({
    command: process.execPath,
    args: ['-e', `require('node:fs').writeFileSync(${JSON.stringify(unconfirmedPidFile)}, String(process.pid)); setInterval(() => {}, 1000)`],
    cwd: fileURLToPath(new URL('.', import.meta.url)),
    trustedEnvironment,
    credentialKeys,
    providerAllowedEnvironmentKeys: [],
    timeoutMs: 500,
  }), 'provider_process_termination_failed'))
  const unconfirmedPid = Number(await readFile(unconfirmedPidFile, 'utf8'))
  check(unconfirmedSignalErrors === 2, 'unconfirmed graceful and force requests enter dedicated termination failure')
  check(!processIsRunning(unconfirmedPid), 'dedicated termination failure settles only after final child absence')

  await rejectsExactlyOnce(() => runProviderSubprocessCredentialBoundaryV1({
    command: path.join(lifecycleTemp, 'provider-does-not-exist.exe'),
    args: [],
    cwd: fileURLToPath(new URL('.', import.meta.url)),
    trustedEnvironment,
    credentialKeys,
    providerAllowedEnvironmentKeys: [],
    timeoutMs: 500,
  }), 'provider_process_error')

  let raceSettlementCount = 0
  await runProviderSubprocessCredentialBoundaryV1({
    command: process.execPath,
    args: ['-e', 'process.exit(0)'],
    cwd: fileURLToPath(new URL('.', import.meta.url)),
    trustedEnvironment,
    credentialKeys,
    providerAllowedEnvironmentKeys: [],
    stdin: 'x'.repeat(262144),
    timeoutMs: 1,
  }).then(
    () => { raceSettlementCount += 1 },
    (error) => {
      raceSettlementCount += 1
      check(
        error instanceof ContractViolationV1 &&
          ['provider_stdin_write_failed', 'provider_process_timeout'].includes(error.message),
        'completion, timeout, and stdin-error race retains one bounded failure vocabulary',
      )
    },
  )
  await new Promise((resolve) => setTimeout(resolve, 250))
  check(raceSettlementCount === 1, 'completion, timeout, and stdin-error race settles exactly once')
} finally {
  await rm(lifecycleTemp, { recursive: true, force: true })
}

rejectsSync(() => runProviderSubprocessCredentialBoundaryV1({
  command: process.execPath,
  args: [],
  cwd: fileURLToPath(new URL('.', import.meta.url)),
  trustedEnvironment,
  credentialKeys,
  providerAllowedEnvironmentKeys: ['GH_TOKEN'],
}), 'provider_environment_contract_invalid')
rejectsSync(() => runProviderSubprocessCredentialBoundaryV1({
  command: 'node',
  args: [],
  cwd: fileURLToPath(new URL('.', import.meta.url)),
  trustedEnvironment,
  credentialKeys,
  providerAllowedEnvironmentKeys: [],
}), 'provider_command_invalid')

const roleModule = await import('../src/core/role-dispatch-v1.mjs')
const boundaryModule = await import('../src/host/provider-credential-boundary-v1.mjs')
check(!Object.hasOwn(roleModule, 'executeProtectedOperationV1') && !Object.hasOwn(boundaryModule, 'executeProtectedOperationV1'), 'Slice 4 exports no protected-operation executor')
check(!Object.hasOwn(roleModule, 'executeMergeOperatorV1'), 'Slice 4 exports no Merge Operator')
check(Object.hasOwn(boundaryModule, 'runProviderSubprocessCredentialBoundaryV1') && !Object.hasOwn(boundaryModule, 'withProviderCredentialBoundaryV1'), 'provider boundary exposes subprocess ownership, not a callback design')

check(assertions === 52, 'Slice 4 assertion count is stable')
process.stdout.write(`role-dispatch-credential-boundary-v1: ${assertions} assertions passed\n`)
