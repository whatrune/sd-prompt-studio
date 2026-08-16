import path from 'node:path'
import { spawn } from 'node:child_process'

import { ContractViolationV1 } from '../core/contracts-v1.mjs'

const ENVIRONMENT_KEY = /^[A-Z_][A-Z0-9_]*$/
const SENSITIVE_KEY = /(?:TOKEN|SECRET|PASSWORD|CREDENTIAL|PRIVATE|BROKER|KEY)/
const MAX_OUTPUT_BYTES = 262144
const violation = (reason) => { throw new ContractViolationV1(reason) }
const plainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)

const sortedUniqueKeys = (values, reason) => {
  if (!Array.isArray(values)) violation(reason)
  let prior = null
  for (const value of values) {
    if (typeof value !== 'string' || !ENVIRONMENT_KEY.test(value) || (prior !== null && value <= prior)) violation(reason)
    prior = value
  }
  return values
}

const validateStringVector = (values, reason) => {
  if (!Array.isArray(values) || values.length > 64 || values.some((value) =>
    typeof value !== 'string' || value.length > 4096 || value.includes('\0'))) violation(reason)
  return values
}

export const runProviderSubprocessCredentialBoundaryV1 = ({
  command,
  args,
  cwd,
  trustedEnvironment,
  credentialKeys,
  providerAllowedEnvironmentKeys,
  stdin = '',
  timeoutMs = 30000,
}) => {
  if (typeof command !== 'string' || command.length === 0 || command.length > 1024 || !path.isAbsolute(command)) {
    violation('provider_command_invalid')
  }
  validateStringVector(args, 'provider_argv_invalid')
  if (typeof cwd !== 'string' || !path.isAbsolute(cwd) || typeof stdin !== 'string' || Buffer.byteLength(stdin, 'utf8') > MAX_OUTPUT_BYTES ||
    !Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 30000) violation('provider_process_contract_invalid')
  if (!plainObject(trustedEnvironment) || Object.values(trustedEnvironment).some((value) => typeof value !== 'string')) {
    violation('trusted_environment_invalid')
  }
  sortedUniqueKeys(credentialKeys, 'credential_key_contract_invalid')
  sortedUniqueKeys(providerAllowedEnvironmentKeys, 'provider_environment_contract_invalid')
  if (providerAllowedEnvironmentKeys.some((key) => credentialKeys.includes(key) || SENSITIVE_KEY.test(key))) {
    violation('provider_environment_contract_invalid')
  }

  const childEnvironment = Object.freeze(Object.fromEntries(providerAllowedEnvironmentKeys
    .filter((key) => Object.hasOwn(trustedEnvironment, key))
    .map((key) => [key, trustedEnvironment[key]])))

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...childEnvironment },
      shell: false,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    const stdout = []
    const stderr = []
    let stdoutBytes = 0
    let stderrBytes = 0
    let settled = false
    let timer
    const fail = (error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(error)
    }
    const append = (chunks, chunk, stream) => {
      const nextBytes = stream === 'stdout' ? stdoutBytes + chunk.length : stderrBytes + chunk.length
      if (nextBytes > MAX_OUTPUT_BYTES) {
        child.kill()
        fail(new ContractViolationV1('provider_output_bound_exceeded'))
        return
      }
      if (stream === 'stdout') stdoutBytes = nextBytes
      else stderrBytes = nextBytes
      chunks.push(chunk)
    }
    child.stdout.on('data', (chunk) => append(stdout, chunk, 'stdout'))
    child.stderr.on('data', (chunk) => append(stderr, chunk, 'stderr'))
    child.on('error', fail)
    child.on('close', (exitCode, signal) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(Object.freeze({
        exit_code: exitCode,
        signal: signal ?? null,
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
        child_environment_keys: Object.freeze(Object.keys(childEnvironment)),
        trusted_credential_available_after: credentialKeys.every((key) =>
          Object.hasOwn(trustedEnvironment, key) && typeof trustedEnvironment[key] === 'string'),
        protected_operation_executed: false,
      }))
    })
    timer = setTimeout(() => {
      child.kill()
      fail(new ContractViolationV1('provider_process_timeout'))
    }, timeoutMs)
    child.stdin.end(stdin)
  })
}
