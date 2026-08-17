import { spawn } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createParityComparisonV1 } from '../core/shared-sealed-evidence-v1.mjs'
import { compareProductionAndGenericV1, evaluateSharedEvidenceGenericV1 } from './sd-prompt-studio-read-only-shadow-v1.mjs'

const SENSITIVE_ENVIRONMENT_KEY = /(?:TOKEN|SECRET|PASSWORD|CREDENTIAL|PRIVATE|BROKER|API_KEY|ACCESS_KEY)/i
const MAX_OUTPUT_BYTES = 1_048_576
const SELF = fileURLToPath(import.meta.url)

const invalidComparisonV1 = () => createParityComparisonV1({
  record_a_sha256: null,
  production_record_sha256: null,
  generic_result_sha256: null,
  binding: null,
  parity_binding: 'INVALID',
  semantic: 'NOT_COMPARABLE',
  reason: 'INPUT_INVALID',
  proof_pass: false,
  authority: 'NONE',
  a_pass: 'NOT_OBSERVED',
  cutover_ready: false,
})

const parseParentArgumentsV1 = (argv, environment) => {
  if (argv.length !== 6 || argv[0] !== '--record-a-file' || argv[2] !== '--record-b-file' || argv[4] !== '--record-c-file') {
    throw new Error('live_shadow_cli_invalid')
  }
  if (typeof environment.RUNNER_TEMP !== 'string') throw new Error('live_shadow_runner_temp_invalid')
  const directory = path.resolve(environment.RUNNER_TEMP, 'gadp-live-shadow-v1')
  const expected = [path.join(directory, 'record-a.json'), path.join(directory, 'record-b.json'), path.join(directory, 'record-c.json')]
  const actual = [argv[1], argv[3], argv[5]].map((value) => path.resolve(value))
  if (actual.some((value, index) => value !== expected[index])) throw new Error('live_shadow_transport_path_invalid')
  return Object.freeze({ recordAFile: actual[0], recordBFile: actual[1], recordCFile: actual[2] })
}

const parseChildArgumentsV1 = (argv) => {
  if (argv.length !== 5 || argv[0] !== '--isolated-evaluate' || argv[1] !== '--record-a-file' || argv[3] !== '--record-b-file') {
    throw new Error('live_shadow_child_cli_invalid')
  }
  return Object.freeze({ recordAFile: path.resolve(argv[2]), recordBFile: path.resolve(argv[4]) })
}

const boundedAppendV1 = (chunks, chunk, bytes) => {
  const next = bytes.value + chunk.length
  if (next > MAX_OUTPUT_BYTES) throw new Error('live_shadow_output_bound_exceeded')
  bytes.value = next
  chunks.push(chunk)
}

export const executeIsolatedLiveShadowV1 = ({ recordAFile, recordBFile, timeoutMs = 30_000 }) => {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 30_000) throw new Error('live_shadow_timeout_invalid')
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [
      SELF,
      '--isolated-evaluate',
      '--record-a-file', recordAFile,
      '--record-b-file', recordBFile,
    ], {
      cwd: path.dirname(SELF),
      env: { GADP_LIVE_SHADOW_ISOLATED: '1' },
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const stdout = []
    const stderr = []
    const stdoutBytes = { value: 0 }
    const stderrBytes = { value: 0 }
    let settled = false
    let timer
    const finish = (value) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(value)
    }
    child.stdout.on('data', (chunk) => {
      try { boundedAppendV1(stdout, chunk, stdoutBytes) } catch { child.kill(); finish(null) }
    })
    child.stderr.on('data', (chunk) => {
      try { boundedAppendV1(stderr, chunk, stderrBytes) } catch { child.kill(); finish(null) }
    })
    child.on('error', () => finish(null))
    child.on('close', (exitCode) => {
      if (exitCode !== 0) return finish(null)
      try {
        const parsed = JSON.parse(Buffer.concat(stdout).toString('utf8'))
        finish(parsed)
      } catch {
        finish(null)
      }
    })
    timer = setTimeout(() => { child.kill(); finish(null) }, timeoutMs)
  })
}

const runIsolatedChildV1 = ({ recordAFile, recordBFile }) => {
  const sensitiveKeys = Object.keys(process.env).filter((key) => SENSITIVE_ENVIRONMENT_KEY.test(key))
  if (sensitiveKeys.length !== 0 || process.env.GADP_LIVE_SHADOW_ISOLATED !== '1') throw new Error('live_shadow_credential_boundary_invalid')
  const recordA = JSON.parse(readFileSync(recordAFile, 'utf8'))
  const productionRecord = JSON.parse(readFileSync(recordBFile, 'utf8'))
  const genericResult = evaluateSharedEvidenceGenericV1({ recordA })
  const comparison = compareProductionAndGenericV1({ productionRecord, genericResult })
  return Object.freeze({
    record_g: genericResult,
    record_c: comparison,
    credential_absent: true,
    network_access_count: 0,
    provider_invocation_count: 0,
    protected_operation_count: 0,
    authority: 'NONE',
  })
}

const main = async () => {
  if (process.argv[2] === '--isolated-evaluate') {
    const result = runIsolatedChildV1(parseChildArgumentsV1(process.argv.slice(2)))
    process.stdout.write(JSON.stringify(result))
    return
  }
  const invocation = parseParentArgumentsV1(process.argv.slice(2), process.env)
  const isolated = await executeIsolatedLiveShadowV1(invocation)
  const comparison = isolated?.record_c ?? invalidComparisonV1()
  if (isolated?.record_g) writeFileSync(path.join(path.dirname(invocation.recordCFile), 'record-g.json'), JSON.stringify(isolated.record_g), 'utf8')
  writeFileSync(invocation.recordCFile, JSON.stringify(comparison), 'utf8')
  process.stdout.write(`${JSON.stringify({
    record_type: 'gadp_live_shadow_execution_result_v1',
    parity_binding: comparison.payload.parity_binding,
    semantic: comparison.payload.semantic,
    proof_pass: comparison.payload.proof_pass,
    authority: 'NONE',
    production_owner_unchanged: true,
    credential_absent: isolated?.credential_absent === true,
    network_access_count: 0,
    provider_invocation_count: 0,
    protected_operation_count: 0,
  })}\n`)
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : ''
if (invokedPath === SELF) {
  try {
    await main()
  } catch {
    process.stdout.write(`${JSON.stringify({
      record_type: 'gadp_live_shadow_execution_result_v1',
      parity_binding: 'INVALID',
      semantic: 'NOT_COMPARABLE',
      proof_pass: false,
      authority: 'NONE',
      production_owner_unchanged: true,
      credential_absent: false,
      network_access_count: 0,
      provider_invocation_count: 0,
      protected_operation_count: 0,
    })}\n`)
  }
}
