import { ContractViolationV1 } from '../core/contracts-v1.mjs'
import { validateRegisteredCommandArgvV1 } from '../core/project-adapter-v1.mjs'

const ENTRIES = Object.freeze({
  'git-diff-check-v1': Object.freeze({
    executable: 'git',
    fixed_argv: Object.freeze(['diff', '--check']),
    argv_contract: Object.freeze({ kind: 'none' }),
  }),
  'node-test-v1': Object.freeze({
    executable: 'node',
    fixed_argv: Object.freeze([]),
    argv_contract: Object.freeze({ kind: 'single_test_path' }),
  }),
})

export const registeredCatalogSnapshotV1 = () => Object.freeze({
  command_contracts: Object.freeze(Object.fromEntries(Object.entries(ENTRIES).map(([id, entry]) => [id, entry.argv_contract]))),
  profile_ids: Object.freeze(['product-owner-v1', 'sdps-implementer-v1', 'sdps-reviewer-v1']),
  capability_ids: Object.freeze(['canonical-record-write', 'repository-read']),
  validation_profile_ids: Object.freeze(['sdps-focused-v1']),
  deployment_rule_ids: Object.freeze([]),
})

export const resolveRegisteredCommandV1 = ({ command_id: commandId, argv }) => {
  if (!Object.hasOwn(ENTRIES, commandId)) throw new ContractViolationV1('registered_command_unknown')
  const entry = ENTRIES[commandId]
  const validatedArgv = validateRegisteredCommandArgvV1(commandId, argv, registeredCatalogSnapshotV1().command_contracts)
  if (['sh', 'bash', 'cmd', 'cmd.exe', 'powershell', 'pwsh'].includes(entry.executable.toLowerCase())) {
    throw new ContractViolationV1('registered_command_contract_invalid')
  }
  return Object.freeze({
    command_id: commandId,
    executable: entry.executable,
    argv: Object.freeze([...entry.fixed_argv, ...validatedArgv]),
    shell: false,
    execution_authorized: false,
  })
}
