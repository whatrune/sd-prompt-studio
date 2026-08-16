import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import { ContractViolationV1, REPOSITORY_RELATIVE_PATH_PATTERN_SOURCE_V1 } from '../src/core/contracts-v1.mjs'
import { validateProjectAdapterV1 } from '../src/core/project-adapter-v1.mjs'
import { registeredCatalogSnapshotV1, resolveRegisteredCommandV1 } from '../src/host/registered-command-catalog-v1.mjs'

let assertions = 0
const check = (condition, message) => { assertions += 1; assert.ok(condition, message) }
const rejects = (operation, reason) => {
  assertions += 1
  assert.throws(operation, (error) => error instanceof ContractViolationV1 && error.message === reason)
}

const config = {
  api_version: 'ai-development/v1',
  project_id: 'sd-prompt-studio',
  repository: { provider: 'github', name: 'whatrune/sd-prompt-studio', default_branch: 'main' },
  records: { task_source: 'github_issue', review_source: 'task_issue_comment', decision_source: 'task_issue_comment' },
  paths: { writable: ['generic-platform/src/core'], forbidden: ['.github/workflows'] },
  validation: { profile_ids: ['sdps-focused-v1'], required_checks: ['unit-tests'], current_generation_only: true },
  commands: {
    invocations: [
      { command_id: 'node-test-v1', argv: ['generic-platform/test/core-contracts-v1.test.mjs'] },
      { command_id: 'git-diff-check-v1', argv: [] },
    ],
  },
  roles: {
    reviewer_profile_id: 'sdps-reviewer-v1',
    implementer_profile_id: 'sdps-implementer-v1',
    decision_authority_id: 'product-owner-v1',
    merge_operator_profile_id: '',
  },
  repair: { max_attempts: 0, max_files: 0, max_diff_bytes: 0, allowed_validation_ids: [] },
  runtime: { runner_labels: ['self-hosted', 'windows'], toolchain_revision: 'node-22', deployment_rule_ids: [] },
  credentials: { required_capability_ids: ['repository-read'] },
  protected_operation_ids: [],
  workspace: { branch_prefix: 'codex/', bootstrap_command_id: '', cleanup: 'terminal_only' },
}

const catalog = registeredCatalogSnapshotV1()
const validated = validateProjectAdapterV1(config, catalog)
check(Object.isFrozen(validated) && Object.isFrozen(validated.commands.invocations), 'validated adapter is immutable declarative data')
check(validated.repair.max_attempts === 0 && validated.protected_operation_ids.length === 0, 'deferred capabilities remain disabled')

const nodeProjection = resolveRegisteredCommandV1(config.commands.invocations[0])
const gitProjection = resolveRegisteredCommandV1(config.commands.invocations[1])
check(nodeProjection.executable === 'node' && nodeProjection.argv.length === 1 && nodeProjection.shell === false, 'node command resolves without a shell')
check(gitProjection.executable === 'git' && gitProjection.argv.join(' ') === 'diff --check', 'fixed git argv cannot be consumer-replaced')
check(nodeProjection.execution_authorized === false && gitProjection.execution_authorized === false, 'resolution grants no execution authority')

rejects(() => validateProjectAdapterV1({ ...config, plugin: './adapter.mjs' }, catalog), 'project_adapter_invalid')
rejects(() => validateProjectAdapterV1({ ...config, api_version: 'ai-development/v2' }, catalog), 'project_adapter_invalid')
rejects(() => validateProjectAdapterV1({ ...config, validation: { ...config.validation, profile_ids: ['unknown-profile'] } }, catalog), 'project_adapter_invalid')
rejects(() => validateProjectAdapterV1({ ...config, credentials: { required_capability_ids: ['secret-access'] } }, catalog), 'project_adapter_invalid')
rejects(() => validateProjectAdapterV1({ ...config, protected_operation_ids: ['merge-pr'] }, catalog), 'project_adapter_invalid')
rejects(() => validateProjectAdapterV1({ ...config, repair: { ...config.repair, max_attempts: 1 } }, catalog), 'project_adapter_invalid')
rejects(() => validateProjectAdapterV1({ ...config, paths: { ...config.paths, writable: ['../escape'] } }, catalog), 'project_adapter_invalid')
rejects(() => validateProjectAdapterV1({ ...config, commands: { invocations: [{ command_id: 'unknown-command', argv: [] }] } }, catalog), 'registered_command_unknown')
rejects(() => resolveRegisteredCommandV1({ command_id: 'unknown-command', argv: [] }), 'registered_command_unknown')
rejects(() => resolveRegisteredCommandV1({ command_id: 'node-test-v1', argv: ['--eval=process.env'] }), 'registered_command_argv_invalid')
rejects(() => resolveRegisteredCommandV1({ command_id: 'node-test-v1', argv: ['generic-platform/test/core-contracts-v1.test.mjs', '; calc'] }), 'registered_command_argv_invalid')
rejects(() => resolveRegisteredCommandV1({ command_id: 'git-diff-check-v1', argv: ['--no-index'] }), 'registered_command_argv_invalid')

const schema = JSON.parse(await readFile(new URL('../schemas/project-adapter-v1.schema.json', import.meta.url), 'utf8'))
check(schema.additionalProperties === false && schema.properties.commands.properties.invocations.items.additionalProperties === false, 'schema rejects unknown adapter and invocation fields')
check(schema.properties.repair.properties.max_attempts.const === 0 && schema.properties.protected_operation_ids.maxItems === 0, 'schema freezes deferred behavior off')
const schemaPathPattern = new RegExp(schema.$defs.pathList.items.pattern)
check(schema.$defs.pathList.items.pattern === REPOSITORY_RELATIVE_PATH_PATTERN_SOURCE_V1, 'schema and Core use the identical repository-relative path grammar')
for (const invalidPath of ['C:/escape', '\\\\server\\share', '/absolute', '\\absolute', '../escape', 'safe/../escape', 'safe/./file', `safe/${String.fromCharCode(0)}file`, `safe/${String.fromCharCode(31)}file`, `safe/${String.fromCharCode(127)}file`]) {
  rejects(() => validateProjectAdapterV1({ ...config, paths: { ...config.paths, writable: [invalidPath] } }, catalog), 'project_adapter_invalid')
  check(!schemaPathPattern.test(invalidPath), `schema rejects repository escape path ${JSON.stringify(invalidPath)}`)
}
check(schemaPathPattern.test('generic-platform/src/core/contracts-v1.mjs'), 'schema accepts canonical repository-relative path')
check(!('execute' in nodeProjection) && !('credential' in nodeProjection), 'catalog projection contains no executable operation or credential')

check(assertions === 42, 'Slice 2 assertion count is stable')
process.stdout.write(`project-adapter-v1: ${assertions} assertions passed\n`)
