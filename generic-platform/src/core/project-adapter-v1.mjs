import { ContractViolationV1, isRepositoryRelativePathV1 } from './contracts-v1.mjs'

export const PROJECT_ADAPTER_API_V1 = 'ai-development/v1'

const ID = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/
const REF_NAME = /^[A-Za-z0-9._/-]+$/
const TEST_PATH = /^generic-platform\/test\/[a-z0-9][a-z0-9.-]*\.test\.mjs$/

const violation = (reason) => { throw new ContractViolationV1(reason) }
const plainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)

const exactKeys = (value, expected, reason = 'project_adapter_invalid') => {
  if (!plainObject(value)) violation(reason)
  const actual = Object.keys(value).sort()
  const canonical = [...expected].sort()
  if (actual.length !== canonical.length || actual.some((key, index) => key !== canonical[index])) violation(reason)
}

const registeredId = (value, reason = 'project_adapter_invalid') => {
  if (typeof value !== 'string' || value.length > 128 || !ID.test(value)) violation(reason)
}

const sortedUnique = (values, validator, reason = 'project_adapter_invalid') => {
  if (!Array.isArray(values)) violation(reason)
  let prior = null
  for (const value of values) {
    validator(value, reason)
    if (prior !== null && value <= prior) violation(reason)
    prior = value
  }
}

const registeredOptionalId = (value, allowed, reason) => {
  if (value === '') return
  registeredId(value, reason)
  if (!allowed.has(value)) violation(reason)
}

const freezeCopy = (value) => {
  if (Array.isArray(value)) return Object.freeze(value.map(freezeCopy))
  if (plainObject(value)) return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, child]) => [key, freezeCopy(child)])))
  return value
}

export const validateRegisteredCommandArgvV1 = (commandId, argv, commandContracts) => {
  if (!plainObject(commandContracts) || !Object.hasOwn(commandContracts, commandId)) violation('registered_command_unknown')
  const contract = commandContracts[commandId]
  exactKeys(contract, ['kind'], 'registered_command_contract_invalid')
  if (!Array.isArray(argv) || argv.some((value) => typeof value !== 'string' || value.length > 512 || /[\u0000-\u001f\u007f]/.test(value))) {
    violation('registered_command_argv_invalid')
  }
  if (contract.kind === 'none') {
    if (argv.length !== 0) violation('registered_command_argv_invalid')
  } else if (contract.kind === 'single_test_path') {
    if (argv.length !== 1 || !TEST_PATH.test(argv[0])) violation('registered_command_argv_invalid')
  } else {
    violation('registered_command_contract_invalid')
  }
  return Object.freeze([...argv])
}

export const validateProjectAdapterV1 = (config, catalog) => {
  exactKeys(config, [
    'api_version', 'project_id', 'repository', 'records', 'paths', 'validation', 'commands', 'roles',
    'repair', 'runtime', 'credentials', 'protected_operation_ids', 'workspace',
  ])
  exactKeys(catalog, ['command_contracts', 'profile_ids', 'capability_ids', 'validation_profile_ids', 'deployment_rule_ids'])
  registeredId(config.project_id)
  if (config.api_version !== PROJECT_ADAPTER_API_V1) violation('project_adapter_invalid')

  exactKeys(config.repository, ['provider', 'name', 'default_branch'])
  if (config.repository.provider !== 'github' || !REPOSITORY.test(config.repository.name ?? '') ||
    typeof config.repository.default_branch !== 'string' || !REF_NAME.test(config.repository.default_branch) ||
    config.repository.default_branch.includes('..') || config.repository.default_branch.length > 128) violation('project_adapter_invalid')

  exactKeys(config.records, ['task_source', 'review_source', 'decision_source'])
  if (config.records.task_source !== 'github_issue' || config.records.review_source !== 'task_issue_comment' ||
    config.records.decision_source !== 'task_issue_comment') violation('project_adapter_invalid')

  exactKeys(config.paths, ['writable', 'forbidden'])
  const validatePath = (value, reason) => {
    if (!isRepositoryRelativePathV1(value)) violation(reason)
  }
  sortedUnique(config.paths.writable, validatePath)
  sortedUnique(config.paths.forbidden, validatePath)
  if (config.paths.writable.some((path) => config.paths.forbidden.includes(path))) violation('project_adapter_invalid')

  const profileIds = new Set(catalog.profile_ids)
  const capabilityIds = new Set(catalog.capability_ids)
  const validationProfileIds = new Set(catalog.validation_profile_ids)
  const deploymentRuleIds = new Set(catalog.deployment_rule_ids)
  for (const [values, reason] of [
    [catalog.profile_ids, 'registered_profile_catalog_invalid'],
    [catalog.capability_ids, 'registered_capability_catalog_invalid'],
    [catalog.validation_profile_ids, 'registered_validation_catalog_invalid'],
    [catalog.deployment_rule_ids, 'registered_deployment_catalog_invalid'],
  ]) sortedUnique(values, registeredId, reason)

  exactKeys(config.validation, ['profile_ids', 'required_checks', 'current_generation_only'])
  sortedUnique(config.validation.profile_ids, registeredId)
  sortedUnique(config.validation.required_checks, registeredId)
  if (!config.validation.profile_ids.every((id) => validationProfileIds.has(id)) || config.validation.current_generation_only !== true) {
    violation('project_adapter_invalid')
  }

  exactKeys(config.commands, ['invocations'])
  if (!Array.isArray(config.commands.invocations) || config.commands.invocations.length > 32) violation('project_adapter_invalid')
  const commandIds = new Set()
  for (const invocation of config.commands.invocations) {
    exactKeys(invocation, ['command_id', 'argv'])
    registeredId(invocation.command_id)
    if (commandIds.has(invocation.command_id)) violation('project_adapter_invalid')
    commandIds.add(invocation.command_id)
    validateRegisteredCommandArgvV1(invocation.command_id, invocation.argv, catalog.command_contracts)
  }

  exactKeys(config.roles, ['reviewer_profile_id', 'implementer_profile_id', 'decision_authority_id', 'merge_operator_profile_id'])
  for (const value of Object.values(config.roles)) registeredOptionalId(value, profileIds, 'project_adapter_invalid')

  exactKeys(config.repair, ['max_attempts', 'max_files', 'max_diff_bytes', 'allowed_validation_ids'])
  if (config.repair.max_attempts !== 0 || config.repair.max_files !== 0 || config.repair.max_diff_bytes !== 0 ||
    !Array.isArray(config.repair.allowed_validation_ids) || config.repair.allowed_validation_ids.length !== 0) violation('project_adapter_invalid')

  exactKeys(config.runtime, ['runner_labels', 'toolchain_revision', 'deployment_rule_ids'])
  sortedUnique(config.runtime.runner_labels, registeredId)
  sortedUnique(config.runtime.deployment_rule_ids, registeredId)
  if (typeof config.runtime.toolchain_revision !== 'string' || config.runtime.toolchain_revision.length > 128 ||
    !/^[A-Za-z0-9._-]*$/.test(config.runtime.toolchain_revision) ||
    !config.runtime.deployment_rule_ids.every((id) => deploymentRuleIds.has(id))) violation('project_adapter_invalid')

  exactKeys(config.credentials, ['required_capability_ids'])
  sortedUnique(config.credentials.required_capability_ids, registeredId)
  if (!config.credentials.required_capability_ids.every((id) => capabilityIds.has(id))) violation('project_adapter_invalid')
  if (!Array.isArray(config.protected_operation_ids) || config.protected_operation_ids.length !== 0) violation('project_adapter_invalid')

  exactKeys(config.workspace, ['branch_prefix', 'bootstrap_command_id', 'cleanup'])
  if (typeof config.workspace.branch_prefix !== 'string' || config.workspace.branch_prefix.length > 128 ||
    !/^[A-Za-z0-9._/-]*$/.test(config.workspace.branch_prefix) || config.workspace.branch_prefix.includes('..') ||
    config.workspace.cleanup !== 'terminal_only') violation('project_adapter_invalid')
  if (config.workspace.bootstrap_command_id !== '') {
    registeredId(config.workspace.bootstrap_command_id)
    if (!Object.hasOwn(catalog.command_contracts, config.workspace.bootstrap_command_id)) violation('registered_command_unknown')
  }
  return freezeCopy(config)
}
