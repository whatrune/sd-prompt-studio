import path from 'node:path'
import { spawn } from 'node:child_process'

import { ContractViolationV1 } from '../core/contracts-v1.mjs'

const ENVIRONMENT_KEY = /^[A-Z_][A-Z0-9_]*$/
const SENSITIVE_KEY = /(?:TOKEN|SECRET|PASSWORD|CREDENTIAL|PRIVATE|BROKER|KEY)/
const MAX_OUTPUT_BYTES = 262144
const TERMINATION_GRACE_MS = 200
const FORCE_TERMINATION_CONFIRM_MS = 1000
const FINAL_TERMINATION_CONFIRM_MS = 1000
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
    let gracefulTerminationTimer
    let forceTerminationTimer
    let finalTerminationTimer
    let primaryFailure = null
    let terminationFailure = null
    let terminationStage = 'RUNNING'
    let exitObserved = false
    let closeObserved = false
    let childProcessErrorObserved = false
    const clearTimers = () => {
      clearTimeout(timer)
      clearTimeout(gracefulTerminationTimer)
      clearTimeout(forceTerminationTimer)
      clearTimeout(finalTerminationTimer)
    }
    const fail = (error) => {
      if (settled) return
      settled = true
      clearTimers()
      reject(error)
    }
    const childAbsenceEstablished = () => {
      if (exitObserved || closeObserved || child.exitCode !== null || child.signalCode !== null) return true
      if (!Number.isSafeInteger(child.pid) || child.pid <= 0) return childProcessErrorObserved
      try {
        process.kill(child.pid, 0)
        return false
      } catch (error) {
        return error?.code === 'ESRCH'
      }
    }
    const settleTermination = () => {
      if (!primaryFailure || !childAbsenceEstablished()) return false
      fail(terminationFailure ?? primaryFailure)
      return true
    }
    const requestSignal = (signal) => {
      try {
        child.kill(signal)
      } catch {
        // The bounded lifecycle confirms absence or escalates to its dedicated failure.
      }
    }
    const finalTerminate = () => {
      if (settled || settleTermination()) return
      terminationStage = 'FINAL_CONFIRMATION'
      terminationFailure = new ContractViolationV1('provider_process_termination_failed')
      try {
        process.kill(child.pid, 'SIGKILL')
      } catch {
        // Absence is checked below; an unconfirmed process fails closed.
      }
      finalTerminationTimer = setTimeout(() => {
        if (settled || settleTermination()) return
        fail(terminationFailure)
      }, FINAL_TERMINATION_CONFIRM_MS)
    }
    const forceTerminate = () => {
      if (settled || settleTermination() || terminationStage !== 'GRACEFUL') return
      terminationStage = 'FORCE'
      requestSignal('SIGKILL')
      forceTerminationTimer = setTimeout(() => {
        if (settled || settleTermination()) return
        finalTerminate()
      }, FORCE_TERMINATION_CONFIRM_MS)
    }
    const requireTermination = (error) => {
      if (settled) return
      if (!primaryFailure) primaryFailure = error
      clearTimeout(timer)
      if (settleTermination() || terminationStage !== 'RUNNING') return
      terminationStage = 'GRACEFUL'
      child.stdin.destroy()
      requestSignal('SIGTERM')
      gracefulTerminationTimer = setTimeout(forceTerminate, TERMINATION_GRACE_MS)
    }
    const append = (chunks, chunk, stream) => {
      if (primaryFailure) return
      const nextBytes = stream === 'stdout' ? stdoutBytes + chunk.length : stderrBytes + chunk.length
      if (nextBytes > MAX_OUTPUT_BYTES) {
        requireTermination(new ContractViolationV1('provider_output_bound_exceeded'))
        return
      }
      if (stream === 'stdout') stdoutBytes = nextBytes
      else stderrBytes = nextBytes
      chunks.push(chunk)
    }
    child.stdout.on('data', (chunk) => append(stdout, chunk, 'stdout'))
    child.stderr.on('data', (chunk) => append(stderr, chunk, 'stderr'))
    child.on('error', () => {
      childProcessErrorObserved = true
      if (terminationStage === 'RUNNING') {
        requireTermination(new ContractViolationV1('provider_process_error'))
      } else {
        settleTermination()
      }
    })
    child.on('exit', () => {
      exitObserved = true
      settleTermination()
    })
    child.on('close', (exitCode, signal) => {
      if (settled) return
      closeObserved = true
      exitObserved = true
      if (primaryFailure) {
        settleTermination()
        return
      }
      settled = true
      clearTimers()
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
      requireTermination(new ContractViolationV1('provider_process_timeout'))
    }, timeoutMs)
    const failStdin = () => requireTermination(new ContractViolationV1('provider_stdin_write_failed'))
    child.stdin.on('error', failStdin)
    try {
      child.stdin.end(stdin, (error) => {
        if (error) failStdin()
      })
    } catch {
      failStdin()
    }
  })
}
