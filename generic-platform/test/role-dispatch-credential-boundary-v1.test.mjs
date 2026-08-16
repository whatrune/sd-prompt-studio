import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
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

check(assertions === 25, 'Slice 4 assertion count is stable')
process.stdout.write(`role-dispatch-credential-boundary-v1: ${assertions} assertions passed\n`)
