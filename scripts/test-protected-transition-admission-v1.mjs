import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseYaml } from 'yaml'
import {
  PROTECTED_TRANSITION_TASK_STATE_V1,
  evaluateProtectedTransitionAdmissionV1,
  parseProtectedTransitionTaskStateJsonV1,
  parseProtectedTransitionTaskStateV1,
  projectProtectedTransitionApprovedReviewStateV1,
} from '../src/continuous-orchestration/protected-transition-admission-v1.ts'
import {
  acquireChangedPathScopeV1,
  evaluateProgressionControllerV1,
  evaluateMergeAllowedAutomationV1,
  evaluateProductOwnerMergeDecisionV1,
  evaluateRoleTransitionOrchestratorV1,
  evaluateRoleDispatchOutputV1,
  executeRoleDispatchConsumerV1,
  executeRoleDispatchRebindV1,
  executeRepairExecutorV1,
  executeReadyForReviewProgressionV1,
  executeReviewApprovalAutomationV1 as executeReviewApprovalAutomationProductionV1,
  executeRoleTransitionOrchestratorV1,
  executeProtectedTransitionAdmissionV1,
  executeRepairProviderBindingV3,
  extractProtectedTransitionTaskStateV1,
  isRepairProfilePathV1,
  normalizeRoleTransitionEventV1,
  parseProductOwnerMergeDecisionV1,
  parseIndependentReviewDecisionProjectionV1,
  parseReviewApprovalEventV1,
  projectProtectedTransitionReviewStateV1,
  projectSelfHostedWindowsRepairProviderV3,
  projectRoleDispatchEnvelopeV1,
  repairWorkingTreePathsV1,
  resolveEffectiveReviewDecisionV1,
  selectRepairValidationProfileV1,
} from './run-protected-transition-admission-v1.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const REPOSITORY = 'whatrune/sd-prompt-studio'
const TASK = 259
const PR = 260
const HEAD = 'a'.repeat(40)
const OTHER_HEAD = 'b'.repeat(40)
const READY_RUN_ID = '31246327840'
const REVIEW_RUN_ID = '31561746789'
const BASE = '9fda08907ff21c5c596146b779d7feeac5efbfa8'
const HOST_RUNNER_BINDING_BASE = '3631d84351a49088baaadb5b3445751a7bf0b44e'
const HOST_RUNNER_BINDING_HEAD = '35b7849840a2a9191f4ebf56bf83e145725a6dfa'
const CURRENT_GENERATION_REDUCER_BASE = HOST_RUNNER_BINDING_HEAD
const HOST_ACQUISITION_PREFLIGHT_BASE = 'c0cba56a53d9e394d85383b6e305a4a59e212401'
const ALLOWED = ['scripts/run-protected-transition-admission-v1.mjs', 'src/continuous-orchestration/protected-transition-admission-v1.ts']
let assertions = 0

const executeReviewApprovalAutomationV1 = (options) =>
  executeReviewApprovalAutomationProductionV1({ ...options, runId: REVIEW_RUN_ID })

const check = (condition, message) => {
  assertions += 1
  if (!condition) throw new Error(`assertion ${assertions} failed: ${message}`)
}

const state = (overrides = {}) => ({
  record_type: PROTECTED_TRANSITION_TASK_STATE_V1,
  task_issue_number: TASK,
  pr_number: PR,
  observed_head: HEAD,
  authorized_paths: [...ALLOWED],
  architecture_status: 'APPROVED',
  implementation_authorized: true,
  review_status: 'PENDING',
  reviewed_head: null,
  review_blocker_count: null,
  ...overrides,
})

const input = (overrides = {}) => ({
  transition: 'terminal_review_admission',
  repository: REPOSITORY,
  task_issue_number: TASK,
  pr_number: PR,
  exact_head: HEAD,
  task: { repository: REPOSITORY, number: TASK, state: 'open', is_pull_request: false },
  pull: { repository: REPOSITORY, number: PR, state: 'open', head: HEAD },
  task_state: state(),
  scope: { complete: true, actual_paths: [...ALLOWED], failure_reason: null },
  ...overrides,
})

const approvedState = () => state({ review_status: 'APPROVE', reviewed_head: HEAD, review_blocker_count: 0 })
const blockedReviewState = () => state({ review_status: 'CHANGES_REQUIRED', reviewed_head: HEAD, review_blocker_count: 1 })

const classificationCases = [
  { expected: 'INDETERMINATE', value: input({ task_state: null }), allowed: false },
  { expected: 'STALE', value: input({ exact_head: OTHER_HEAD }), allowed: false },
  { expected: 'ARCHITECTURE_BLOCKED', value: input({ task_state: state({ architecture_status: 'NOT_APPROVED' }) }), allowed: false },
  { expected: 'IMPLEMENTATION_BLOCKED', value: input({ task_state: state({ implementation_authorized: false }) }), allowed: false },
  { expected: 'REVIEW_PENDING', value: input(), allowed: true },
  { expected: 'REVIEW_BLOCKED', value: input({ transition: 'merge_decision_admission', task_state: blockedReviewState() }), allowed: false },
  { expected: 'MERGE_ELIGIBLE', value: input({ transition: 'merge_decision_admission', task_state: approvedState() }), allowed: true },
]

// Seven state-classification units x five assertions = 35.
for (const unit of classificationCases) {
  const result = evaluateProtectedTransitionAdmissionV1(unit.value)
  check(result.state === unit.expected, `${unit.expected} classification`)
  check(result.allowed === unit.allowed, `${unit.expected} allowed value`)
  check(result.exit_code === (unit.allowed ? 0 : unit.expected === 'INDETERMINATE' ? 1 : 2), `${unit.expected} exit code`)
  check(result.state_changed === false, `${unit.expected} has no state mutation`)
  check(typeof result.reason === 'string' && result.reason.length > 0, `${unit.expected} has a reason`)
}

const transitionStates = [
  { expected: 'INDETERMINATE', value: input({ task_state: null }) },
  { expected: 'STALE', value: input({ exact_head: OTHER_HEAD }) },
  { expected: 'ARCHITECTURE_BLOCKED', value: input({ task_state: state({ architecture_status: 'NOT_APPROVED' }) }) },
  { expected: 'IMPLEMENTATION_BLOCKED', value: input({ task_state: state({ implementation_authorized: false }) }) },
  { expected: 'REVIEW_PENDING', value: input() },
  { expected: 'REVIEW_BLOCKED', value: input({ task_state: blockedReviewState() }) },
  { expected: 'MERGE_ELIGIBLE', value: input({ task_state: approvedState() }) },
]

// Fourteen transition rows x two assertions = 28.
for (const unit of transitionStates) {
  for (const transition of ['terminal_review_admission', 'merge_decision_admission']) {
    const result = evaluateProtectedTransitionAdmissionV1({ ...unit.value, transition })
    const expectedAllowed =
      (unit.expected === 'REVIEW_PENDING' && transition === 'terminal_review_admission') ||
      (unit.expected === 'MERGE_ELIGIBLE' && transition === 'merge_decision_admission')
    check(result.state === unit.expected, `${unit.expected}/${transition} preserves state`)
    check(result.allowed === expectedAllowed, `${unit.expected}/${transition} transition row`)
  }
}

// Eight dynamic-binding units x two assertions = 16.
const dynamicUnits = [
  { result: evaluateProtectedTransitionAdmissionV1(input()), expected: 'REVIEW_PENDING', reason: 'valid tuple' },
  { result: evaluateProtectedTransitionAdmissionV1(input({ repository: 'other/repository' })), expected: 'INDETERMINATE', reason: 'repository mismatch' },
  { result: evaluateProtectedTransitionAdmissionV1(input({ task_state: state({ task_issue_number: TASK + 1 }) })), expected: 'INDETERMINATE', reason: 'Task state mismatch' },
  { result: evaluateProtectedTransitionAdmissionV1(input({ task: { repository: REPOSITORY, number: TASK + 1, state: 'open', is_pull_request: false } })), expected: 'INDETERMINATE', reason: 'Task REST mismatch' },
  { result: evaluateProtectedTransitionAdmissionV1(input({ task: { repository: REPOSITORY, number: TASK, state: 'open', is_pull_request: true } })), expected: 'INDETERMINATE', reason: 'PR-shaped Task' },
  { result: evaluateProtectedTransitionAdmissionV1(input({ task: { repository: REPOSITORY, number: TASK, state: 'closed', is_pull_request: false } })), expected: 'INDETERMINATE', reason: 'closed Task' },
  { result: evaluateProtectedTransitionAdmissionV1(input({ task_state: state({ pr_number: PR + 1 }) })), expected: 'INDETERMINATE', reason: 'PR mismatch' },
  { result: evaluateProtectedTransitionAdmissionV1(input({ task_state: state({ review_status: 'APPROVE', reviewed_head: OTHER_HEAD, review_blocker_count: 0 }) })), expected: 'STALE', reason: 'review HEAD mismatch' },
]
for (const unit of dynamicUnits) {
  check(unit.result.state === unit.expected, `${unit.reason} state`)
  check(unit.result.allowed === (unit.expected === 'REVIEW_PENDING'), `${unit.reason} admission`)
}

const request = Object.freeze({
  transition: 'terminal_review_admission',
  repository: REPOSITORY,
  taskIssueNumber: TASK,
  prNumber: PR,
  exactHead: HEAD,
})

const progressionResult = (overrides = {}) => Object.freeze({
  transition: 'merge_decision_admission',
  state: 'REVIEW_BLOCKED',
  allowed: false,
  exit_code: 2,
  reason: 'review_not_approved',
  task_issue_number: TASK,
  pr_number: PR,
  current_head: HEAD,
  out_of_scope_paths: Object.freeze([]),
  state_changed: false,
  admission_executed: false,
  next_action: 'STOP',
  ...overrides,
})
const repairReview = (overrides = {}) => Object.freeze({
  task_issue_number: TASK,
  pr_number: PR,
  reviewed_head: HEAD,
  decision: 'CHANGES_REQUIRED',
  blocking_finding_count: 1,
  remaining_finding_count: 1,
  unknown_count: 0,
  ...overrides,
})
const progressionContext = (overrides = {}) => Object.freeze({
  request: Object.freeze({ ...request, transition: 'merge_decision_admission' }),
  task_state: blockedReviewState(),
  scope: Object.freeze({ complete: true, actual_paths: Object.freeze([ALLOWED[0]]), failure_reason: null }),
  review: repairReview(),
  review_comment_id: 9002,
  review_body: 'current blocking findings',
  effective_review_current: true,
  ...overrides,
})

// Eight deterministic Progression Controller units x three assertions = 24.
const progressionUnits = [
  {
    result: evaluateProgressionControllerV1(progressionResult({ state: 'INDETERMINATE', next_action: 'NONE', exit_code: 0 })),
    status: 'COMPLETED_NOOP', next: 'NONE', evidence: (value) => value.exit_code === 0,
  },
  {
    result: evaluateProgressionControllerV1(progressionResult({ state: 'REVIEW_PENDING' })),
    status: 'WAITING', next: 'NONE', evidence: (value) => value.exit_code === 0,
  },
  {
    result: evaluateProgressionControllerV1(progressionResult({ state: 'MERGE_ELIGIBLE', allowed: true, exit_code: 0, next_action: 'MERGE_DECISION' })),
    status: 'MERGE_DECISION_PENDING', next: 'MERGE_DECISION', evidence: (value) => value.allowed === true,
  },
  {
    result: evaluateProgressionControllerV1(progressionResult({ state: 'MERGE_ELIGIBLE', allowed: true, exit_code: 0, next_action: 'MERGE_OPERATOR' })),
    status: 'HANDOFF_READY', next: 'MERGE_OPERATOR', evidence: (value) => value.allowed === true,
  },
  {
    result: evaluateProgressionControllerV1(progressionResult(), progressionContext()),
    status: 'DISPATCH_READY', next: 'REPAIR_EXECUTOR', evidence: (value) => value.repair_dispatch.review_decision_url.endsWith('#issuecomment-9002'),
  },
  {
    result: evaluateProgressionControllerV1(progressionResult(), progressionContext({ scope: Object.freeze({ complete: true, actual_paths: Object.freeze(['outside.ts']), failure_reason: null }) })),
    status: 'BLOCKED', next: 'STOP', evidence: (value) => value.reason === 'repair_scope_outside_authorized_paths',
  },
  {
    result: evaluateProgressionControllerV1(progressionResult(), progressionContext({ review: repairReview({ unknown_count: 1 }) })),
    status: 'BLOCKED', next: 'STOP', evidence: (value) => value.reason === 'repair_review_unknown',
  },
  {
    result: evaluateProgressionControllerV1(progressionResult(), progressionContext({ review: repairReview({ decision: 'BLOCKED' }) })),
    status: 'BLOCKED', next: 'STOP', evidence: (value) => value.reason === 'review_not_approved',
  },
]
for (const unit of progressionUnits) {
  check(unit.result.automation_status === unit.status, `${unit.status} progression status`)
  check(unit.result.next_action === unit.next, `${unit.status} next action`)
  check(unit.evidence(unit.result), `${unit.status} deterministic evidence`)
}
const issueObject = () => ({
  number: TASK,
  state: 'open',
  repository_url: `https://api.github.com/repos/${REPOSITORY}`,
  html_url: `https://github.com/${REPOSITORY}/issues/${TASK}`,
})
const stateBlock = (value = state()) => `before\n<!-- protected-transition-task-state-v1:start -->\n\`\`\`json\n${JSON.stringify(value)}\n\`\`\`\n<!-- protected-transition-task-state-v1:end -->\nafter`
const pullObject = ({ head = HEAD, changedFiles = 0, taskState = state() } = {}) => ({
  number: PR,
  state: 'open',
  base: { repo: { full_name: REPOSITORY } },
  head: { sha: head },
  body: stateBlock(taskState),
  changed_files: changedFiles,
})
const scopeHost = (pages) => ({
  api: async (endpoint) => {
    const page = Number(new URL(`https://api.github.com/${endpoint}`).searchParams.get('page') ?? '1')
    if (pages instanceof Error) throw pages
    return structuredClone(pages[page - 1] ?? [])
  },
})
const errorOf = async (operation) => {
  try {
    await operation()
    return null
  } catch (error) {
    return error
  }
}

// Twelve path-scope units x two assertions = 24.
let result = evaluateProtectedTransitionAdmissionV1(input())
check(result.state === 'REVIEW_PENDING', 'exact authorized set passes')
check(result.out_of_scope_paths.length === 0, 'exact authorized set has no outside path')

result = evaluateProtectedTransitionAdmissionV1(input({ scope: { complete: true, actual_paths: [ALLOWED[0]], failure_reason: null } }))
check(result.state === 'REVIEW_PENDING', 'authorized subset passes')
check(result.out_of_scope_paths.length === 0, 'authorized subset has no outside path')

result = evaluateProtectedTransitionAdmissionV1(input({ scope: { complete: true, actual_paths: [...ALLOWED, 'outside.ts'], failure_reason: null } }))
check(result.state === 'IMPLEMENTATION_BLOCKED', 'outside current filename blocks')
check(result.out_of_scope_paths.join(',') === 'outside.ts', 'outside current filename is reported')

const renamedScope = await acquireChangedPathScopeV1(request, { changed_files: 1 }, scopeHost([[
  { filename: 'new.ts', previous_filename: 'old.ts', status: 'renamed' },
]]))
result = evaluateProtectedTransitionAdmissionV1(input({ task_state: state({ authorized_paths: ['new.ts'] }), scope: renamedScope }))
check(result.state === 'IMPLEMENTATION_BLOCKED', 'rename old path outside blocks')
check(result.out_of_scope_paths.join(',') === 'old.ts', 'rename old path is checked')

result = evaluateProtectedTransitionAdmissionV1(input({ task_state: state({ authorized_paths: ['old.ts'] }), scope: renamedScope }))
check(result.state === 'IMPLEMENTATION_BLOCKED', 'rename new path outside blocks')
check(result.out_of_scope_paths.join(',') === 'new.ts', 'rename new path is checked')

result = evaluateProtectedTransitionAdmissionV1(input({ task_state: state({ authorized_paths: ['../outside.ts'] }) }))
check(result.state === 'INDETERMINATE', 'malformed authorized path is indeterminate')
check(result.reason === 'authorized_paths_invalid', 'malformed authorized path reason')

result = evaluateProtectedTransitionAdmissionV1(input({ task_state: state({ authorized_paths: ['same.ts', 'same.ts'] }) }))
check(result.state === 'INDETERMINATE', 'duplicate authorized path is indeterminate')
check(result.reason === 'authorized_paths_duplicate', 'duplicate authorized path reason')

const fileFailureHost = {
  api: async (endpoint) => {
    if (endpoint.includes('/issues/')) return issueObject()
    if (endpoint.includes('/files?')) throw new Error('synthetic_file_failure')
    return pullObject({ changedFiles: 1 })
  },
}
result = await executeProtectedTransitionAdmissionV1({ request, host: fileFailureHost })
check(result.state === 'INDETERMINATE', 'pagination failure is indeterminate')
check(result.reason === 'synthetic_file_failure', 'pagination failure reason is preserved')

let scopeError = await errorOf(() => acquireChangedPathScopeV1(request, { changed_files: 2 }, scopeHost([[
  { filename: 'only.ts', status: 'modified' },
]])))
check(scopeError instanceof Error, 'item-count mismatch fails')
check(scopeError?.message === 'pull_files_count_mismatch', 'item-count mismatch reason')

scopeError = await errorOf(() => acquireChangedPathScopeV1(request, { changed_files: 2 }, scopeHost([[
  { filename: 'same.ts', status: 'modified' },
  { filename: 'same.ts', status: 'modified' },
]])))
check(scopeError instanceof Error, 'duplicate file entry fails')
check(scopeError?.message === 'pull_file_item_duplicate', 'duplicate file entry reason')

scopeError = await errorOf(() => acquireChangedPathScopeV1(request, { changed_files: 3001 }, scopeHost([])))
check(scopeError instanceof Error, '3000-file ceiling fails closed')
check(scopeError?.message === 'pull_files_enumeration_limit_exceeded', '3000-file ceiling reason')

let pullCalls = 0
const lateHeadHost = {
  api: async (endpoint) => {
    if (endpoint.includes('/issues/')) return issueObject()
    if (endpoint.includes('/files?')) return []
    pullCalls += 1
    return pullObject({ head: pullCalls === 1 ? HEAD : OTHER_HEAD })
  },
}
result = await executeProtectedTransitionAdmissionV1({ request, host: lateHeadHost })
check(result.state === 'STALE', 'late HEAD change is stale')
check(result.reason === 'head_changed_during_evaluation', 'late HEAD change reason')

// Twelve structure assertions = 12.
const parsedState = parseProtectedTransitionTaskStateV1(state())
check(Object.keys(parsedState).length === 10, 'state has exactly ten fields')
const duplicateJson = JSON.stringify(state()).replace(`"pr_number":${PR}`, `"pr_number":${PR},"pr_number":${PR}`)
const duplicateJsonError = await errorOf(async () => parseProtectedTransitionTaskStateJsonV1(duplicateJson))
check(duplicateJsonError?.message === 'json_duplicate_key', 'duplicate JSON keys fail closed')

const workflowPath = path.join(repositoryRoot, '.github/workflows/protected-transition-admission-v1.yml')
const runnerPath = path.join(repositoryRoot, 'scripts/run-protected-transition-admission-v1.mjs')
const corePath = path.join(repositoryRoot, 'src/continuous-orchestration/protected-transition-admission-v1.ts')
const workflowSource = readFileSync(workflowPath, 'utf8')
const runnerSource = readFileSync(runnerPath, 'utf8')
const coreSource = readFileSync(corePath, 'utf8')
const workflow = parseYaml(workflowSource)

// Ten Role Transition Orchestrator V1 units x three assertions = 30.
const rolePaths = Object.freeze([
  '.github/workflows/protected-transition-admission-v1.yml',
  'scripts/run-protected-transition-admission-v1.mjs',
  'scripts/test-protected-transition-admission-v1.mjs',
])
const roleState = (overrides = {}) => state({ authorized_paths: [...rolePaths], ...overrides })
const roleRequest = (overrides = {}) => Object.freeze({
  transition: 'role_transition_orchestrator_v1',
  repository: REPOSITORY,
  taskIssueNumber: TASK,
  prNumber: PR,
  exactHead: OTHER_HEAD,
  ...overrides,
})
const roleInput = (overrides = {}) => ({
  terminalResult: 'IMPLEMENTATION_AUTHORIZED',
  request: roleRequest(),
  taskState: roleState({ observed_head: OTHER_HEAD }),
  paths: [...rolePaths],
  authorityValid: true,
  ...overrides,
})
const repairRoute = Object.freeze({
  transition: 'review_approval_automation_v1', state: 'REVIEW_BLOCKED', allowed: false, exit_code: 0,
  reason: 'repair_dispatch_ready', task_issue_number: TASK, pr_number: PR, current_head: OTHER_HEAD,
  out_of_scope_paths: Object.freeze([]), state_changed: true, automation_status: 'DISPATCH_READY',
  next_action: 'REPAIR_EXECUTOR',
})
const mergeRoute = Object.freeze({
  transition: 'merge_allowed_automation_v1', state: 'MERGE_ELIGIBLE', allowed: true, exit_code: 0,
  reason: 'merge_gate_satisfied', task_issue_number: TASK, pr_number: PR, current_head: OTHER_HEAD,
  out_of_scope_paths: Object.freeze([]), state_changed: false, automation_status: 'HANDOFF_READY',
  next_action: 'MERGE_OPERATOR', external_check_success_count: 2, blocking_thread_count: 0,
})
const rolePublicationAuthorityId = 9101
const roleImplementationResultId = 9102
const roleImplementationAuthorizationId = 9301
const rolePublicationBody = `## Publication Handoff — Role Transition Orchestrator V1

- Publication Authority: https://github.com/${REPOSITORY}/issues/${TASK}#issuecomment-${rolePublicationAuthorityId}
- target PR: \`#${PR}\`
- published HEAD: \`${OTHER_HEAD}\`
- exact parent: \`${HEAD}\`
- push mode: normal non-force fast-forward
- local / remote HEAD equality: PASS

### Published scope

${rolePaths.map((value) => `- \`${value}\``).join('\n')}

### Terminal state

- status: \`completed\`
- execution_stop_reason: \`completed\`
`
const rolePublicationAuthorityBody = `\`\`\`yaml
record_type: commit_push_publication_authorization_v1
authorizing_role: Product Owner / Implementation Lead
parent_issue: ${TASK}
consumer_pr: ${PR}
publication_allowed: true
expected_parent: ${HEAD}
result_handoff_comment_id: ${roleImplementationResultId}
exact_paths:
${rolePaths.map((value) => `  - ${value}`).join('\n')}
status: authorized_for_publication_only
\`\`\``
const roleImplementationResultBody = `## Backend Implementer Result Handoff — Role Transition Orchestrator V1

- Implementation Authorization: https://github.com/${REPOSITORY}/issues/${TASK}#issuecomment-${roleImplementationAuthorizationId}
- target PR: \`#${PR}\`
- implementation HEAD: \`${HEAD}\`

### Changed paths

${rolePaths.map((value) => `- \`${value}\``).join('\n')}

### Terminal state

- status: \`completed\`
- execution_stop_reason: \`completed\`
- blocker / remaining / UNKNOWN: \`0 / 0 / 0\`
`
const roleImplementationAuthorizationBody = `\`\`\`yaml
record_type: implementation_authorization_v1
authorizing_role: Product Owner / Implementation Lead
parent_issue: ${TASK}
consumer_pr: ${PR}
implementation_allowed: true
status: authorized_for_implementation_only
exact_base: ${HEAD}
architecture_review_comment_id: 9000
candidate_payload_sha256: ${'c'.repeat(64)}
exact_paths:
${rolePaths.map((value) => `  - ${value}`).join('\n')}
\`\`\``
const roleArchitectureReviewBody = `\`\`\`yaml
record_type: independent_architecture_review_decision_v1
parent_issue: ${TASK}
candidate_payload_sha256: ${'c'.repeat(64)}
decision: APPROVE
blocking_finding_count: 0
remaining_finding_count: 0
unknown_count: 0
\`\`\``
const roleTaskTitle = 'Implement the authorized Role Dispatch correction'
const roleTaskBody = 'Apply the approved correction to the exact authorized paths.\nPreserve every frozen authority boundary.'
const roleImplementerContext = Object.freeze({
  task_title: roleTaskTitle,
  task_body: roleTaskBody,
  approved_correction_context: roleImplementationAuthorizationBody,
})
const roleTaskObject = (overrides = {}) => ({
  number: TASK,
  title: roleTaskTitle,
  body: roleTaskBody,
  state: 'open',
  repository_url: `https://api.github.com/repos/${REPOSITORY}`,
  html_url: `https://github.com/${REPOSITORY}/issues/${TASK}`,
  ...overrides,
})
let rolePullReads = 0
let roleStateWrites = 0
let roleTriggerReads = 0
let roleCommitReads = 0
let rolePullBody = stateBlock(roleState({
  observed_head: HEAD,
  review_status: 'APPROVE',
  reviewed_head: HEAD,
  review_blocker_count: 0,
}))
const rolePublicationHost = {
  api: async (endpoint, options) => {
    if (endpoint.endsWith(`/issues/comments/${rolePublicationEvent.comment.id}`)) {
      roleTriggerReads += 1
      return { id: rolePublicationEvent.comment.id, issue_url: `https://api.github.com/repos/${REPOSITORY}/issues/${TASK}`, body: rolePublicationBody, author_association: 'OWNER' }
    }
    if (endpoint.endsWith(`/issues/comments/${rolePublicationAuthorityId}`)) {
      return { id: rolePublicationAuthorityId, issue_url: `https://api.github.com/repos/${REPOSITORY}/issues/${TASK}`, body: rolePublicationAuthorityBody, author_association: 'OWNER' }
    }
    if (endpoint.endsWith(`/issues/comments/${roleImplementationResultId}`)) {
      return { id: roleImplementationResultId, issue_url: `https://api.github.com/repos/${REPOSITORY}/issues/${TASK}`, body: roleImplementationResultBody, author_association: 'OWNER' }
    }
    if (endpoint.endsWith(`/issues/comments/${roleImplementationAuthorizationId}`)) {
      return { id: roleImplementationAuthorizationId, issue_url: `https://api.github.com/repos/${REPOSITORY}/issues/${TASK}`, body: roleImplementationAuthorizationBody, author_association: 'OWNER' }
    }
    if (endpoint.endsWith('/issues/comments/9000')) {
      return { id: 9000, issue_url: `https://api.github.com/repos/${REPOSITORY}/issues/${TASK}`, body: roleArchitectureReviewBody, author_association: 'OWNER' }
    }
    if (endpoint.endsWith(`/commits/${OTHER_HEAD}`)) {
      roleCommitReads += 1
      return { sha: OTHER_HEAD, parents: [{ sha: HEAD }] }
    }
    if (endpoint.endsWith(`/pulls/${PR}`)) {
      if (options?.method === 'PATCH') {
        roleStateWrites += 1
        rolePullBody = options.body.body
      } else {
        rolePullReads += 1
      }
      return { ...pullObject({ head: OTHER_HEAD, taskState: roleState({ observed_head: OTHER_HEAD }) }), body: rolePullBody }
    }
    throw new Error(`unexpected_role_endpoint:${endpoint}`)
  },
}
const rolePublicationEvent = Object.freeze({
  action: 'created',
  repository: Object.freeze({ full_name: REPOSITORY }),
  issue: Object.freeze({ number: TASK, state: 'open' }),
  comment: Object.freeze({ id: 9103, author_association: 'OWNER', body: rolePublicationBody }),
})
const publishedRoute = await executeRoleTransitionOrchestratorV1({ event: rolePublicationEvent, host: rolePublicationHost })
const reboundRoleState = extractProtectedTransitionTaskStateV1(rolePullBody)
const publishedRolePullReads = rolePullReads
const publishedRoleStateWrites = roleStateWrites
const publishedRoleTriggerReads = roleTriggerReads
const publishedRoleCommitReads = roleCommitReads
const freshnessCase = async ({ body = rolePublicationBody, issueNumber = TASK, unavailable = false } = {}) => {
  const metrics = { triggerReads: 0, downstreamCalls: 0 }
  const result = await executeRoleTransitionOrchestratorV1({
    event: rolePublicationEvent,
    host: {
      api: async (endpoint) => {
        if (endpoint.endsWith(`/issues/comments/${rolePublicationEvent.comment.id}`)) {
          metrics.triggerReads += 1
          if (unavailable) throw new Error('synthetic_trigger_deleted')
          return { id: rolePublicationEvent.comment.id, issue_url: `https://api.github.com/repos/${REPOSITORY}/issues/${issueNumber}`, body, author_association: 'OWNER' }
        }
        metrics.downstreamCalls += 1
        throw new Error(`freshness_downstream_must_not_be_called:${endpoint}`)
      },
    },
  })
  return Object.freeze({ result, metrics: Object.freeze(metrics) })
}
const deletedTrigger = await freshnessCase({ unavailable: true })
const crossTaskTrigger = await freshnessCase({ issueNumber: TASK + 1 })
const malformedTrigger = await freshnessCase({ body: '## Publication Handoff\n- malformed current record' })
const disappearedTrigger = await freshnessCase({ body: 'current comment no longer contains a supported terminal marker' })
const commitBindingCase = async ({ commit, unavailable = false }) => {
  const metrics = { triggerReads: 0, pullReads: 0, commitReads: 0, downstreamCalls: 0, stateWrites: 0 }
  const result = await executeRoleTransitionOrchestratorV1({
    event: rolePublicationEvent,
    host: {
      api: async (endpoint, options) => {
        if (endpoint.endsWith(`/issues/comments/${rolePublicationEvent.comment.id}`)) {
          metrics.triggerReads += 1
          return { id: rolePublicationEvent.comment.id, issue_url: `https://api.github.com/repos/${REPOSITORY}/issues/${TASK}`, body: rolePublicationBody, author_association: 'OWNER' }
        }
        if (endpoint.endsWith(`/pulls/${PR}`)) {
          if (options?.method === 'PATCH') metrics.stateWrites += 1
          else metrics.pullReads += 1
          return pullObject({ head: OTHER_HEAD, taskState: roleState({ observed_head: HEAD, review_status: 'APPROVE', reviewed_head: HEAD, review_blocker_count: 0 }) })
        }
        if (endpoint.endsWith(`/commits/${OTHER_HEAD}`)) {
          metrics.commitReads += 1
          if (unavailable) throw new Error('synthetic_commit_acquisition_failure')
          return commit
        }
        metrics.downstreamCalls += 1
        throw new Error(`commit_binding_downstream_must_not_be_called:${endpoint}`)
      },
    },
  })
  return Object.freeze({ result, metrics: Object.freeze(metrics) })
}
const commitAcquisitionFailure = await commitBindingCase({ unavailable: true })
const commitShaMismatch = await commitBindingCase({ commit: { sha: HEAD, parents: [{ sha: HEAD }] } })
const commitZeroParents = await commitBindingCase({ commit: { sha: OTHER_HEAD, parents: [] } })
const commitMultipleParents = await commitBindingCase({ commit: { sha: OTHER_HEAD, parents: [{ sha: HEAD }, { sha: 'c'.repeat(40) }] } })
const commitMalformedParent = await commitBindingCase({ commit: { sha: OTHER_HEAD, parents: [{}] } })
const commitWrongParent = await commitBindingCase({ commit: { sha: OTHER_HEAD, parents: [{ sha: 'c'.repeat(40) }] } })
const ambiguousRoleError = await errorOf(() => normalizeRoleTransitionEventV1({
  ...rolePublicationEvent,
  comment: {
    ...rolePublicationEvent.comment,
    id: 9104,
    body: `${rolePublicationBody}\nrecord_type: implementation_authorization_v1`,
  },
}))
let zeroMarkerHostCalls = 0
const zeroMarkerResult = await executeRoleTransitionOrchestratorV1({
  event: {
    ...rolePublicationEvent,
    comment: { ...rolePublicationEvent.comment, id: 9105, body: 'ordinary project discussion without a supported terminal marker' },
  },
  host: { api: async () => { zeroMarkerHostCalls += 1; throw new Error('zero_marker_host_must_not_be_called') } },
})
const roleUnits = [
  {
    name: 'IMPLEMENTATION_AUTHORIZED',
    result: evaluateRoleTransitionOrchestratorV1(roleInput()),
    status: 'HANDOFF_READY',
    next: 'IMPLEMENTER',
    evidence: (value) => value.reason === 'implementation_authorized' && value.terminal_result === 'IMPLEMENTATION_AUTHORIZED' && workflowSource.includes('next_action: ${{ steps.evaluate.outputs.next_action }}'),
  },
  {
    name: 'IMPLEMENTATION_RESULT_READY',
    result: evaluateRoleTransitionOrchestratorV1(roleInput({ terminalResult: 'IMPLEMENTATION_RESULT_READY' })),
    status: 'HANDOFF_READY',
    next: 'PRODUCT_OWNER_IMPLEMENTATION_LEAD',
    evidence: (value) => value.reason === 'implementation_result_ready' && value.terminal_result === 'IMPLEMENTATION_RESULT_READY',
  },
  {
    name: 'PUBLISHED',
    result: publishedRoute,
    status: 'HANDOFF_READY',
    next: 'INDEPENDENT_IMPLEMENTATION_REVIEWER',
    evidence: (value) => value.reason === 'publication_state_rebound' && value.state_changed === true && publishedRoleTriggerReads === 1 && publishedRoleCommitReads === 1 && publishedRoleStateWrites === 1 && publishedRolePullReads === 3 && Object.keys(reboundRoleState).length === 10 && reboundRoleState.observed_head === OTHER_HEAD && reboundRoleState.review_status === 'PENDING' && reboundRoleState.reviewed_head === null && reboundRoleState.review_blocker_count === null,
  },
  {
    name: 'CHANGES_REQUIRED',
    result: evaluateRoleTransitionOrchestratorV1(roleInput({ terminalResult: 'CHANGES_REQUIRED', routeResult: repairRoute })),
    status: 'DISPATCH_READY',
    next: 'REPAIR_EXECUTOR',
    evidence: (value) => value.reason === 'repair_dispatch_ready' && value.allowed === false && value.terminal_result === 'CHANGES_REQUIRED',
  },
  {
    name: 'APPROVE and MERGE_ELIGIBLE',
    result: evaluateRoleTransitionOrchestratorV1(roleInput({ terminalResult: 'APPROVE', routeResult: mergeRoute })),
    status: 'HANDOFF_READY',
    next: 'PRODUCT_OWNER_IMPLEMENTATION_LEAD',
    evidence: (value) => value.reason === 'merge_decision_required' && value.allowed === false && value.terminal_result === 'APPROVE',
  },
  {
    name: 'HEAD mismatch',
    result: evaluateRoleTransitionOrchestratorV1(roleInput({ taskState: roleState({ observed_head: HEAD }) })),
    status: 'BLOCKED',
    next: 'STOP',
    evidence: (value) => value.state === 'STALE' && value.reason === 'head_binding_stale',
  },
  {
    name: 'triggering comment freshness failures',
    result: deletedTrigger.result,
    status: 'BLOCKED',
    next: 'STOP',
    evidence: (value) => [value, crossTaskTrigger.result, malformedTrigger.result, disappearedTrigger.result].every((item) => item.state === 'INDETERMINATE' && item.reason === 'terminal_result_ambiguous_or_invalid' && item.state_changed === false) && [deletedTrigger, crossTaskTrigger, malformedTrigger, disappearedTrigger].every((item) => item.metrics.triggerReads === 1 && item.metrics.downstreamCalls === 0) && roleStateWrites === publishedRoleStateWrites,
  },
  {
    name: 'PUBLISHED commit parent binding failures',
    result: commitAcquisitionFailure.result,
    status: 'BLOCKED',
    next: 'STOP',
    evidence: (value) => [value, commitShaMismatch.result, commitZeroParents.result, commitMultipleParents.result, commitMalformedParent.result, commitWrongParent.result].every((item) => item.state === 'INDETERMINATE' && item.reason === 'terminal_result_ambiguous_or_invalid' && item.state_changed === false) && [commitAcquisitionFailure, commitShaMismatch, commitZeroParents, commitMultipleParents, commitMalformedParent, commitWrongParent].every((item) => item.metrics.triggerReads === 1 && item.metrics.pullReads === 1 && item.metrics.commitReads === 1 && item.metrics.downstreamCalls === 0 && item.metrics.stateWrites === 0),
  },
  {
    name: 'event marker applicability',
    result: zeroMarkerResult,
    status: 'COMPLETED_NOOP',
    next: 'NONE',
    evidence: (value) => value.state === 'INDETERMINATE' && value.reason === 'review_event_not_applicable' && value.exit_code === 0 && zeroMarkerHostCalls === 0 && ambiguousRoleError?.message === 'terminal_result_ambiguous_or_invalid',
  },
  {
    name: 'Merge not admitted',
    result: evaluateRoleTransitionOrchestratorV1(roleInput({ terminalResult: 'APPROVE', routeResult: { ...mergeRoute, allowed: false, next_action: 'STOP' } })),
    status: 'BLOCKED',
    next: 'STOP',
    evidence: (value) => value.state === 'IMPLEMENTATION_BLOCKED' && value.reason === 'review_not_approved',
  },
]
for (const unit of roleUnits) {
  check(unit.result.automation_status === unit.status, `${unit.name} automation status`)
  check(unit.result.next_action === unit.next, `${unit.name} next action`)
  check(unit.evidence(unit.result), `${unit.name} binding or reason`)
}

check(Object.keys(workflow.on).join(',') === 'workflow_dispatch,issue_comment,pull_request' && workflow.on.issue_comment.types.join(',') === 'created' && workflow.on.pull_request.types.join(',') === 'ready_for_review', 'workflow has manual recovery, created Review, and Ready triggers')
check(Object.keys(workflow.on.workflow_dispatch.inputs).join(',') === 'transition,task_issue_number,pr_number,exact_head' && workflow.on.workflow_dispatch.inputs.task_issue_number.type === 'number', 'workflow has exactly four inputs and canonicalizes the Task input as a number')
check(Object.keys(workflow.permissions).join(',') === 'contents,checks,issues,pull-requests,statuses' && workflow.permissions.contents === 'read' && workflow.permissions.checks === 'read' && workflow.permissions.issues === 'read' && workflow.permissions['pull-requests'] === 'write' && workflow.permissions.statuses === 'read', 'workflow adds only read access for checks and statuses')

const admissionJob = workflow.jobs.protected_transition_admission_v1
const hostIdentityStep = admissionJob.steps.find((step) => step.name === 'Admit exact default-branch host identity')
const hostIdentityRun = hostIdentityStep?.run ?? ''
const pullRequestBranch = 'if [[ "$PTA_EVENT_NAME" == "pull_request" ]]; then'
const pullRequestRef = 'refs/pull/${PTA_EVENT_PR_NUMBER}/merge'
const workflowRefPrefix = 'workflow_ref_prefix="${GITHUB_REPOSITORY}/.github/workflows/protected-transition-admission-v1.yml@"'
const runtimeWorkflowRefCheck = '[[ "$GITHUB_WORKFLOW_REF" == "${workflow_ref_prefix}refs/"?* ]]'
const mainWorkflowRefCheck = '[[ "$GITHUB_WORKFLOW_REF" == "${workflow_ref_prefix}refs/heads/main" ]]'
const pullRequestBlock = hostIdentityRun.slice(hostIdentityRun.indexOf(pullRequestBranch), hostIdentityRun.indexOf('else'))
check(hostIdentityStep?.shell === 'bash' && hostIdentityRun.trimStart().startsWith('set -euo pipefail'), 'HID-01 host identity remains one fail-closed bash step')
check(pullRequestBlock.includes(`[[ "$GITHUB_REF" == "${pullRequestRef}" ]]`) && pullRequestBlock.includes(runtimeWorkflowRefCheck), 'HID-02 Ready PR accepts the exact execution ref with a runtime-derived workflow source ref')
check(pullRequestBlock.includes('[[ "$PTA_BASE_REF" == "main" ]]') && (hostIdentityRun.match(/\$\{PTA_EVENT_PR_NUMBER\}/g) ?? []).length === 1, 'HID-03 wrong PR number, execution ref, or base fails closed')
check(hostIdentityRun.includes(workflowRefPrefix) && pullRequestBlock.includes(runtimeWorkflowRefCheck) && !pullRequestBlock.includes('refs/heads/main') && (hostIdentityRun.match(/workflow_ref_prefix=/g) ?? []).length === 1, 'HID-04 wrong workflow repository/path, delimiter, or empty or malformed ref suffix fails closed')
check(hostIdentityRun.includes('else\n  [[ "$GITHUB_REF" == "refs/heads/main" ]]\n  ' + mainWorkflowRefCheck), 'HID-05 non-PR events retain exact main execution and workflow source identity')
check(hostIdentityRun.includes('[[ "$GITHUB_WORKFLOW_SHA" =~ ^[0-9a-f]{40}$ ]]') && admissionJob.steps.some((step) => step.name === 'Checkout exact workflow SHA' && step.with?.ref === '${{ github.workflow_sha }}') && admissionJob.steps.some((step) => step.name === 'Evaluate protected transition admission'), 'HID-06 common SHA, checkout, and Controller routing remain unchanged')

const changedPaths = execFileSync('git', ['diff', '--name-only', BASE], { cwd: repositoryRoot, encoding: 'utf8' }).trim().split(/\r?\n/).filter(Boolean)
const expectedPaths = [
  '.github/workflows/protected-transition-admission-v1.yml',
  'scripts/run-protected-transition-admission-v1.mjs',
  'scripts/test-protected-transition-admission-v1.mjs',
]
check(changedPaths.join('\n') === expectedPaths.join('\n'), 'Repair Executor diff is exactly three paths')
const productionSource = `${workflowSource}\n${runnerSource}\n${coreSource}`
check(!/(trust_root|revocation|ready_generation|producer_roster|assignment_record|finalization_binding|collector|\.jcs|upload-artifact)/i.test(productionSource), 'retired mechanisms are absent')
check(runnerSource.includes('/comments?since=') && runnerSource.includes('pageNumber > 32'), 'runner uses bounded forward-only Review pagination')
check(runnerSource.includes('acquireTaskIdentityV1') && runnerSource.includes('acquireChangedPathScopeV1') && runnerSource.includes('executeManualProgressionControllerV1'), 'runner owns direct Task, scope, and manual progression composition')
check(runnerSource.includes('previous_filename') && runnerSource.includes('state_changed_during_evaluation'), 'runner checks rename and late state change')
check(workflowSource.includes('pnpm.cmd install --frozen-lockfile') && !workflowSource.includes('actions: read') && !workflowSource.includes('upload-artifact') && !workflowSource.includes('gh workflow run'), 'workflow uses frozen repair dependencies without nested dispatch or artifact permission/persistence')
check(coreSource.includes('export const evaluateProtectedTransitionAdmissionV1') && !/\b(fetch|writeFile|execFile)\b/.test(coreSource), 'one pure evaluator owns classification')

const reviewDecisionBody = (overrides = {}, extraLines = []) => {
  const values = {
    record_type: 'independent_review_decision_v1',
    authoring_role: 'Independent Reviewer',
    task_issue: `https://github.com/${REPOSITORY}/issues/${TASK}`,
    pull_request: `https://github.com/${REPOSITORY}/pull/${PR}`,
    reviewed_head: HEAD,
    decision: 'APPROVE',
    blocking_finding_count: 0,
    remaining_finding_count: 0,
    unknown_count: 0,
    status: 'completed',
    execution_stop_reason: 'completed',
    ...overrides,
  }
  const lines = Object.entries(values).map(([key, value]) => `${key}: ${typeof value === 'number' ? value : JSON.stringify(value)}`)
  return `# Independent Review Decision\n\n\`\`\`yaml\n${[...lines, ...extraLines].join('\n')}\n\`\`\``
}

const reviewEvent = ({ body = reviewDecisionBody(), association = 'MEMBER', issue = {}, comment = {} } = {}) => ({
  action: 'created',
  repository: { full_name: REPOSITORY },
  issue: {
    number: TASK,
    state: 'open',
    html_url: `https://github.com/${REPOSITORY}/issues/${TASK}`,
    ...issue,
  },
  comment: {
    id: 9001,
    created_at: '2026-08-07T00:00:00Z',
    author_association: association,
    body,
    ...comment,
  },
})

const readyEvent = ({ action = 'ready_for_review', repository = REPOSITORY, pull = {} } = {}) => ({
  action,
  repository: { full_name: repository },
  pull_request: {
    number: PR,
    state: 'open',
    draft: false,
    body: stateBlock(approvedState()),
    head: { sha: HEAD },
    ...pull,
  },
})

// Ten Review-event/projection units x two assertions = 20.
const validReviewEvent = parseReviewApprovalEventV1(reviewEvent())
check(validReviewEvent.taskIssueNumber === TASK && validReviewEvent.prNumber === PR, 'valid Review event binds Task and PR')
check(validReviewEvent.exactHead === HEAD && validReviewEvent.review.decision === 'APPROVE', 'valid Review event binds exact APPROVE HEAD')

const nonApproveReview = parseReviewApprovalEventV1(reviewEvent({ body: reviewDecisionBody({ decision: 'CHANGES_REQUIRED' }) }))
const nonApproveProjection = projectProtectedTransitionReviewStateV1(approvedState(), nonApproveReview.review)
check(nonApproveProjection.review_status === 'CHANGES_REQUIRED' && nonApproveProjection.reviewed_head === HEAD, 'non-APPROVE Review projects the exact status and HEAD')
check(nonApproveProjection.review_blocker_count === 0 && nonApproveProjection.observed_head === HEAD, 'non-APPROVE projection preserves current binding')

const blockingReview = parseReviewApprovalEventV1(reviewEvent({ body: reviewDecisionBody({ blocking_finding_count: 1 }) }))
const blockingReviewResult = await executeReviewApprovalAutomationV1({
  event: reviewEvent({ body: reviewDecisionBody({ blocking_finding_count: 1 }) }),
  host: { api: async () => { throw new Error('host_must_not_be_called') } },
})
const invalidReviewRunResult = await executeReviewApprovalAutomationProductionV1({
  event: reviewEvent(),
  host: { api: async () => { throw new Error('host_must_not_be_called') } },
  runId: '0',
})
check(blockingReview.review.blocking_finding_count === 1 && blockingReviewResult.state === 'REVIEW_BLOCKED', 'blocking count is retained and blocks')
check(blockingReviewResult.state_changed === false && blockingReviewResult.admission_executed === false && invalidReviewRunResult.reason === 'review_event_invalid', 'blocking count prevents mutation and invalid Review run identity fails closed')

const remainingReview = parseReviewApprovalEventV1(reviewEvent({ body: reviewDecisionBody({ remaining_finding_count: 1 }) }))
const remainingReviewError = await errorOf(() => projectProtectedTransitionApprovedReviewStateV1(state(), remainingReview.review))
check(remainingReview.review.remaining_finding_count === 1, 'remaining count is retained')
check(remainingReviewError?.message === 'review_not_approvable', 'remaining count prevents projection')

const unknownReview = parseReviewApprovalEventV1(reviewEvent({ body: reviewDecisionBody({ unknown_count: 1 }) }))
const unknownReviewError = await errorOf(() => projectProtectedTransitionApprovedReviewStateV1(state(), unknownReview.review))
check(unknownReview.review.unknown_count === 1, 'UNKNOWN count is retained')
check(unknownReviewError?.message === 'review_not_approvable', 'UNKNOWN count prevents projection')

const otherHeadReview = parseReviewApprovalEventV1(reviewEvent({ body: reviewDecisionBody({ reviewed_head: OTHER_HEAD }) }))
const otherHeadState = projectProtectedTransitionApprovedReviewStateV1(state(), otherHeadReview.review)
const otherHeadResult = evaluateProtectedTransitionAdmissionV1(input({ transition: 'merge_decision_admission', exact_head: OTHER_HEAD, task_state: otherHeadState }))
check(otherHeadResult.state === 'STALE', 'reviewed/current HEAD mismatch is stale')
check(otherHeadResult.allowed === false, 'reviewed/current HEAD mismatch is not admitted')

const taskMismatchError = await errorOf(() => parseReviewApprovalEventV1(reviewEvent({ body: reviewDecisionBody({ task_issue: `https://github.com/${REPOSITORY}/issues/${TASK + 1}` }) })))
check(taskMismatchError instanceof Error, 'Task mismatch fails')
check(taskMismatchError?.message === 'review_projection_invalid', 'Task mismatch reason')

const prMismatchReview = parseReviewApprovalEventV1(reviewEvent({ body: reviewDecisionBody({ pull_request: `https://github.com/${REPOSITORY}/pull/${PR + 1}` }) }))
const prMismatchError = await errorOf(() => projectProtectedTransitionApprovedReviewStateV1(state(), prMismatchReview.review))
check(prMismatchError instanceof Error, 'PR mismatch fails')
check(prMismatchError?.message === 'review_execution_tuple_mismatch', 'PR mismatch reason')

const duplicateReviewError = await errorOf(() => parseIndependentReviewDecisionProjectionV1(
  reviewDecisionBody({}, ['decision: APPROVE']),
  REPOSITORY,
  TASK,
))
check(duplicateReviewError instanceof Error, 'duplicate scalar fails')
check(duplicateReviewError?.message === 'review_yaml_scalar_invalid', 'duplicate scalar reason')

const associationError = await errorOf(() => parseReviewApprovalEventV1(reviewEvent({ association: 'NONE' })))
check(associationError instanceof Error, 'invalid event association fails')
check(associationError?.message === 'review_event_invalid', 'invalid event association reason')

const connectionPage = (nodes, { totalCount = nodes.length, hasNextPage = false, endCursor = null } = {}) => ({
  totalCount,
  nodes,
  pageInfo: { hasNextPage, endCursor },
})
const successfulCheck = (id = 'check-1') => ({
  __typename: 'CheckRun',
  id,
  name: `check-${id}`,
  status: 'COMPLETED',
  conclusion: 'SUCCESS',
  detailsUrl: null,
  startedAt: '2026-08-08T00:00:00Z',
  checkSuite: { app: { id: 'github-actions-app' } },
})

const currentReadyCheck = ({
  id = 'ready-current-check',
  name = 'protected_transition_admission_v1',
  status = 'IN_PROGRESS',
  conclusion = null,
  detailsUrl = `https://github.com/${REPOSITORY}/actions/runs/${READY_RUN_ID}/job/93075431467`,
  startedAt = '2026-08-08T02:00:00Z',
  appId = 'github-actions-app',
} = {}) => ({
  __typename: 'CheckRun',
  id,
  name,
  status,
  conclusion,
  detailsUrl,
  startedAt,
  checkSuite: { app: { id: appId } },
})

const readyCheckPage = (other = successfulCheck()) => connectionPage([currentReadyCheck(), other])

const automationHost = ({
  initialState = state(),
  changedFiles = 0,
  filePages = [[]],
  commentPages = [[reviewEvent().comment]],
  headAtPullRead = {},
  headAtCheckRead = {},
  bodyAtPullRead = {},
  pullState = 'open',
  draft = false,
  mergeable = true,
  mergeableState = 'clean',
  checkPages = [connectionPage([successfulCheck()])],
  threadPages = [connectionPage([])],
  graphqlPull = {},
  graphqlFailure = null,
  patchFailure = false,
  applyPatch = true,
} = {}) => {
  const metrics = { patchCalls: 0, pullReads: 0, fileReads: 0, commentReads: 0, commitReads: 0, checkReads: 0, threadReads: 0, waitCalls: 0 }
  let currentHead = HEAD
  let currentBody = stateBlock(initialState)
  const currentPull = () => ({
    number: PR,
    state: pullState,
    base: { repo: { full_name: REPOSITORY } },
    head: { sha: currentHead },
    body: currentBody,
    changed_files: changedFiles,
    draft,
    mergeable,
    mergeable_state: mergeableState,
  })
  return {
    metrics,
    body: () => currentBody,
    host: {
      wait: async () => { metrics.waitCalls += 1 },
      api: async (endpoint, options = undefined) => {
        if (endpoint.includes('/commits/')) {
          metrics.commitReads += 1
          throw new Error('unexpected_commit_read')
        }
        if (endpoint.includes('/comments?')) {
          metrics.commentReads += 1
          const page = Number(new URL(`https://api.github.com/${endpoint}`).searchParams.get('page') ?? '1')
          return structuredClone(commentPages[page - 1] ?? [])
        }
        const directComment = /\/issues\/comments\/(\d+)$/.exec(endpoint)
        if (directComment) {
          metrics.commentReads += 1
          const comment = commentPages.flat().find((candidate) => candidate.id === Number(directComment[1]))
          if (!comment) throw new Error('synthetic_comment_missing')
          return structuredClone({ ...comment, issue_url: `https://api.github.com/repos/${REPOSITORY}/issues/${TASK}` })
        }
        if (endpoint.includes('/issues/')) return issueObject()
        if (endpoint.includes('/files?')) {
          metrics.fileReads += 1
          return structuredClone(filePages[metrics.fileReads - 1] ?? filePages.at(-1) ?? [])
        }
        if (options?.method === 'PATCH') {
          metrics.patchCalls += 1
          if (patchFailure) throw new Error('synthetic_patch_failure')
          if (applyPatch) currentBody = options.body.body
          return structuredClone(currentPull())
        }
        metrics.pullReads += 1
        if (headAtPullRead[metrics.pullReads]) currentHead = headAtPullRead[metrics.pullReads]
        if (bodyAtPullRead[metrics.pullReads]) currentBody = bodyAtPullRead[metrics.pullReads]
        return structuredClone(currentPull())
      },
      graphql: async (query, variables = {}) => {
        if (graphqlFailure) throw graphqlFailure
        if (query.includes('statusCheckRollup')) {
          metrics.checkReads += 1
          const page = checkPages[metrics.checkReads - 1] ?? checkPages.at(-1)
          const snapshotHead = headAtCheckRead[metrics.checkReads] ?? currentHead
          return structuredClone({
            repository: {
              pullRequest: { headRefOid: snapshotHead },
              object: {
                oid: variables.head,
                statusCheckRollup: page === null ? null : { contexts: page },
              },
            },
          })
        }
        if (query.includes('reviewThreads')) {
          metrics.threadReads += 1
          const page = threadPages[metrics.threadReads - 1] ?? threadPages.at(-1)
          return structuredClone({
            repository: {
              pullRequest: {
                number: PR,
                state: pullState === 'open' ? 'OPEN' : 'CLOSED',
                isDraft: draft,
                mergeable: mergeable === null ? 'UNKNOWN' : mergeable ? 'MERGEABLE' : 'CONFLICTING',
                mergeStateStatus: mergeableState.toUpperCase(),
                headRefOid: currentHead,
                ...graphqlPull,
                reviewThreads: page,
              },
            },
          })
        }
        throw new Error('unexpected_graphql_query')
      },
    },
  }
}

// Seven Ready-for-Review bridge units x three assertions = 21.
check(workflow.on.pull_request.types.join(',') === 'ready_for_review' && workflowSource.includes('--ready-event-file "$PTA_EVENT_PATH"'), 'RFR-01 workflow routes only Ready events to the Ready adapter')
check(workflowSource.includes('[[ "$PTA_BASE_REF" == "main" ]]') && workflowSource.includes('refs/pull/${PTA_EVENT_PR_NUMBER}/merge'), 'RFR-01 Ready host binds main base and exact PR merge ref')
check(Object.keys(workflow.on.workflow_dispatch.inputs).length === 4 && workflow.concurrency.group.includes('github.event.pull_request.number'), 'RFR-01 preserves four recovery inputs and adds only the PR fallback queue key')

const validReadyAutomation = automationHost({
  initialState: approvedState(),
  checkPages: [readyCheckPage(), readyCheckPage()],
})
const validReadyResult = await executeReadyForReviewProgressionV1({ event: readyEvent(), host: validReadyAutomation.host, runId: READY_RUN_ID })
check(validReadyResult.allowed === false && validReadyResult.automation_status === 'HANDOFF_READY' && validReadyResult.next_action === 'PRODUCT_OWNER_IMPLEMENTATION_LEAD', 'RFR-02 valid Ready event reaches Product Owner decision handoff')
check(validReadyResult.task_issue_number === TASK && validReadyResult.pr_number === PR && validReadyResult.current_head === HEAD && validReadyResult.role_dispatch?.source_comment_id === reviewEvent().comment.id, 'RFR-02 binds exact Task, PR, HEAD, and effective Review source')
check(validReadyAutomation.metrics.patchCalls === 0 && validReadyAutomation.metrics.checkReads === 3 && validReadyAutomation.metrics.threadReads === 1 && validReadyAutomation.metrics.waitCalls === 0, 'RFR-02 Ready adapter excludes its own running check and rechecks the final rollup read-only')

const wrongReadyResult = await executeReadyForReviewProgressionV1({ event: readyEvent({ action: 'opened' }), host: { api: async () => { throw new Error('host_must_not_be_called') } }, runId: READY_RUN_ID })
const missingReadyResult = await executeReadyForReviewProgressionV1({ event: readyEvent({ repository: null }), host: { api: async () => { throw new Error('host_must_not_be_called') } }, runId: READY_RUN_ID })
const malformedReadyResult = await executeReadyForReviewProgressionV1({ event: readyEvent({ pull: { body: 'no state' } }), host: { api: async () => { throw new Error('host_must_not_be_called') } }, runId: READY_RUN_ID })
check(wrongReadyResult.state === 'INDETERMINATE' && wrongReadyResult.reason === 'ready_event_invalid', 'RFR-03 wrong Ready action fails closed')
check(missingReadyResult.state === 'INDETERMINATE' && missingReadyResult.reason === 'ready_event_invalid', 'RFR-03 missing repository identity fails closed')
check(malformedReadyResult.state === 'INDETERMINATE' && malformedReadyResult.reason === 'state_block_cardinality_invalid', 'RFR-03 malformed state fails closed before acquisition')

const readyPrMismatch = automationHost({ initialState: approvedState() })
const readyPrMismatchResult = await executeReadyForReviewProgressionV1({
  event: readyEvent({ pull: { body: stateBlock(state({ pr_number: PR + 1, review_status: 'APPROVE', reviewed_head: HEAD, review_blocker_count: 0 })) } }),
  host: readyPrMismatch.host,
  runId: READY_RUN_ID,
})
const readyTaskMismatch = automationHost({ initialState: approvedState() })
const readyTaskMismatchResult = await executeReadyForReviewProgressionV1({
  event: readyEvent({ pull: { body: stateBlock(state({ task_issue_number: TASK + 1, review_status: 'APPROVE', reviewed_head: HEAD, review_blocker_count: 0 })) } }),
  host: readyTaskMismatch.host,
  runId: READY_RUN_ID,
})
check(readyPrMismatchResult.state === 'INDETERMINATE' && readyPrMismatchResult.reason === 'ready_event_pr_binding_mismatch', 'RFR-04 event/state PR mismatch fails closed')
check(readyTaskMismatchResult.state === 'INDETERMINATE' && readyTaskMismatchResult.reason === 'task_identity_invalid', 'RFR-04 event-derived Task must match fresh repository reality')
check(readyPrMismatch.metrics.patchCalls === 0 && readyTaskMismatch.metrics.patchCalls === 0, 'RFR-04 identity mismatch performs no state mutation')

const readyHeadMismatch = automationHost({ initialState: approvedState() })
const readyHeadMismatchResult = await executeReadyForReviewProgressionV1({
  event: readyEvent({ pull: { body: stateBlock(state({ observed_head: OTHER_HEAD, review_status: 'APPROVE', reviewed_head: OTHER_HEAD, review_blocker_count: 0 })) } }),
  host: readyHeadMismatch.host,
  runId: READY_RUN_ID,
})
check(readyHeadMismatchResult.state === 'STALE' && readyHeadMismatchResult.reason === 'head_binding_stale', 'RFR-05 event/state HEAD mismatch is stale')
check(readyHeadMismatchResult.allowed === false && readyHeadMismatchResult.next_action === 'STOP', 'RFR-05 stale Ready event cannot advance')
check(readyHeadMismatch.metrics.pullReads === 0 && readyHeadMismatch.metrics.patchCalls === 0, 'RFR-05 stale Ready event stops before acquisition or mutation')

const draftReadyResult = await executeReadyForReviewProgressionV1({ event: readyEvent({ pull: { draft: true } }), host: { api: async () => { throw new Error('host_must_not_be_called') } }, runId: READY_RUN_ID })
const pendingReadyAutomation = automationHost({ initialState: state() })
const pendingReadyResult = await executeReadyForReviewProgressionV1({ event: readyEvent({ pull: { body: stateBlock(state()) } }), host: pendingReadyAutomation.host, runId: READY_RUN_ID })
const scopeReadyAutomation = automationHost({ initialState: approvedState(), changedFiles: 1, filePages: [[{ filename: 'outside.ts', status: 'modified' }]] })
const scopeReadyResult = await executeReadyForReviewProgressionV1({ event: readyEvent(), host: scopeReadyAutomation.host, runId: READY_RUN_ID })
check(draftReadyResult.state === 'REVIEW_PENDING' && draftReadyResult.next_action === 'NONE' && draftReadyResult.reason === 'pull_not_ready', 'RFR-06 Draft Ready event reuses waiting behavior')
check(pendingReadyResult.state === 'REVIEW_PENDING' && pendingReadyResult.next_action === 'NONE' && pendingReadyAutomation.metrics.patchCalls === 0, 'RFR-06 pending Review reuses existing stop behavior')
check(scopeReadyResult.state === 'IMPLEMENTATION_BLOCKED' && scopeReadyResult.reason === 'scope_outside_authorized_paths' && scopeReadyAutomation.metrics.patchCalls === 0, 'RFR-06 scope overflow reuses existing fail-closed behavior')

const duplicateReadyAutomation = automationHost({
  initialState: approvedState(),
  checkPages: [readyCheckPage(), readyCheckPage(), readyCheckPage(), readyCheckPage()],
})
const duplicateReadyFirst = await executeReadyForReviewProgressionV1({ event: readyEvent(), host: duplicateReadyAutomation.host, runId: READY_RUN_ID })
const duplicateReadyBody = duplicateReadyAutomation.body()
const duplicateReadySecond = await executeReadyForReviewProgressionV1({ event: readyEvent(), host: duplicateReadyAutomation.host, runId: READY_RUN_ID })
check(JSON.stringify(duplicateReadyFirst) === JSON.stringify(duplicateReadySecond), 'RFR-07 duplicate Ready event converges to the same result')
check(duplicateReadyAutomation.metrics.patchCalls === 0 && duplicateReadyAutomation.metrics.checkReads === 6 && duplicateReadyAutomation.metrics.threadReads === 2, 'RFR-07 duplicate Ready event remains read-only with one gate evaluation per event')
check(duplicateReadyAutomation.body() === duplicateReadyBody, 'RFR-07 duplicate Ready event does not mutate state')

// Four Ready terminal-wait repair units x three assertions = 12.
const delayedReadyAutomation = automationHost({
  initialState: approvedState(),
  checkPages: [
    readyCheckPage({ ...successfulCheck('delayed-check'), status: 'IN_PROGRESS', conclusion: null }),
    readyCheckPage(successfulCheck('delayed-check')),
    readyCheckPage(successfulCheck('delayed-check')),
  ],
})
const delayedReadyResult = await executeReadyForReviewProgressionV1({ event: readyEvent(), host: delayedReadyAutomation.host, runId: READY_RUN_ID })
check(delayedReadyResult.allowed === false && delayedReadyResult.next_action === 'PRODUCT_OWNER_IMPLEMENTATION_LEAD', 'RFR-08 delayed exact-HEAD check reaches Product Owner decision after terminal success')
check(delayedReadyAutomation.metrics.waitCalls === 1 && delayedReadyAutomation.metrics.checkReads === 4, 'RFR-08 performs one bounded wait and one final gate evaluation')
check(delayedReadyAutomation.metrics.patchCalls === 0 && delayedReadyAutomation.metrics.threadReads === 1, 'RFR-08 remains read-only and reaches terminal thread acquisition')

const failedReadyAutomation = automationHost({
  initialState: approvedState(),
  checkPages: [readyCheckPage({ ...successfulCheck('failed-check'), conclusion: 'FAILURE' })],
})
const failedReadyResult = await executeReadyForReviewProgressionV1({ event: readyEvent(), host: failedReadyAutomation.host, runId: READY_RUN_ID })
check(failedReadyResult.state === 'IMPLEMENTATION_BLOCKED' && failedReadyResult.reason === 'checks_not_successful', 'RFR-09 failed exact-HEAD check blocks Ready progression')
check(failedReadyResult.allowed === false && failedReadyResult.next_action === 'STOP', 'RFR-09 failed check cannot reach the Controller gate')
check(failedReadyAutomation.metrics.waitCalls === 0 && failedReadyAutomation.metrics.threadReads === 0, 'RFR-09 fails before waiting or thread acquisition')

const timeoutReadyAutomation = automationHost({
  initialState: approvedState(),
  checkPages: Array.from({ length: 3 }, () => readyCheckPage({ ...successfulCheck('pending-check'), status: 'IN_PROGRESS', conclusion: null })),
})
const timeoutReadyResult = await executeReadyForReviewProgressionV1({ event: readyEvent(), host: timeoutReadyAutomation.host, runId: READY_RUN_ID })
check(timeoutReadyResult.state === 'INDETERMINATE' && timeoutReadyResult.reason === 'checks_not_terminal', 'RFR-10 bounded Ready wait fails closed on timeout')
check(timeoutReadyResult.allowed === false && timeoutReadyResult.next_action === 'STOP', 'RFR-10 timeout cannot reach Merge eligibility')
check(timeoutReadyAutomation.metrics.waitCalls === 2 && timeoutReadyAutomation.metrics.checkReads === 3 && timeoutReadyAutomation.metrics.threadReads === 0, 'RFR-10 performs exactly the bounded attempts without terminal acquisition')

const waitingHeadDriftAutomation = automationHost({
  initialState: approvedState(),
  headAtPullRead: { 3: OTHER_HEAD },
  checkPages: [readyCheckPage()],
})
const waitingHeadDriftResult = await executeReadyForReviewProgressionV1({ event: readyEvent(), host: waitingHeadDriftAutomation.host, runId: READY_RUN_ID })
check(waitingHeadDriftResult.state === 'STALE' && waitingHeadDriftResult.reason === 'head_changed_while_waiting_for_checks', 'RFR-11 HEAD drift during Ready wait is stale')
check(waitingHeadDriftResult.current_head === OTHER_HEAD && waitingHeadDriftResult.allowed === false, 'RFR-11 reports the fresh drifted HEAD and stops')
check(waitingHeadDriftAutomation.metrics.checkReads === 0 && waitingHeadDriftAutomation.metrics.waitCalls === 0, 'RFR-11 stops before check polling or waiting')

// Four current-generation Ready terminal-wait units x three assertions = 12.
const historicalReadyGeneration = ({ id, conclusion, startedAt }) => currentReadyCheck({
  id,
  status: 'COMPLETED',
  conclusion,
  detailsUrl: `https://github.com/${REPOSITORY}/actions/runs/31261170331/job/${id}`,
  startedAt,
})
const historicalReadyPage = connectionPage([
  historicalReadyGeneration({ id: 'ready-history-failure', conclusion: 'FAILURE', startedAt: '2026-08-08T00:00:00Z' }),
  historicalReadyGeneration({ id: 'ready-history-success', conclusion: 'SUCCESS', startedAt: '2026-08-08T01:00:00Z' }),
  currentReadyCheck(),
  successfulCheck('ready-effective-success'),
])
const historicalReadyAutomation = automationHost({
  initialState: approvedState(),
  checkPages: [historicalReadyPage],
})
const historicalReadyResult = await executeReadyForReviewProgressionV1({ event: readyEvent(), host: historicalReadyAutomation.host, runId: READY_RUN_ID })
check(historicalReadyResult.allowed === false && historicalReadyResult.next_action === 'PRODUCT_OWNER_IMPLEMENTATION_LEAD', 'RFR-12 historical same-identity success and failure still route the selected current generation through Product Owner')
check(historicalReadyAutomation.metrics.waitCalls === 0 && historicalReadyAutomation.metrics.checkReads === 3, 'RFR-12 selected terminal success reaches the unchanged gate without waiting')
check(historicalReadyAutomation.metrics.threadReads === 1 && historicalReadyAutomation.metrics.patchCalls === 0, 'RFR-12 remains read-only and reaches terminal thread acquisition')

const otherAppReadyFailure = automationHost({
  initialState: approvedState(),
  checkPages: [connectionPage([
    currentReadyCheck(),
    currentReadyCheck({ id: 'ready-other-app-failure', status: 'COMPLETED', conclusion: 'FAILURE', detailsUrl: null, appId: 'other-check-app' }),
    successfulCheck(),
  ])],
})
const unrelatedReadyFailure = automationHost({
  initialState: approvedState(),
  checkPages: [readyCheckPage({ ...successfulCheck('ready-unrelated-failure'), conclusion: 'FAILURE' })],
})
const otherAppReadyFailureResult = await executeReadyForReviewProgressionV1({ event: readyEvent(), host: otherAppReadyFailure.host, runId: READY_RUN_ID })
const unrelatedReadyFailureResult = await executeReadyForReviewProgressionV1({ event: readyEvent(), host: unrelatedReadyFailure.host, runId: READY_RUN_ID })
check(otherAppReadyFailureResult.state === 'IMPLEMENTATION_BLOCKED' && otherAppReadyFailureResult.reason === 'checks_not_successful', 'RFR-13 same-name check from another app remains effective')
check(unrelatedReadyFailureResult.state === 'IMPLEMENTATION_BLOCKED' && unrelatedReadyFailureResult.reason === 'checks_not_successful', 'RFR-13 selected unrelated failure remains effective')
check(otherAppReadyFailure.metrics.threadReads === 0 && unrelatedReadyFailure.metrics.threadReads === 0 && otherAppReadyFailure.metrics.waitCalls === 0 && unrelatedReadyFailure.metrics.waitCalls === 0, 'RFR-13 effective failures stop before waiting or thread acquisition')

const selectedPendingPage = readyCheckPage({ ...successfulCheck('ready-selected-pending'), status: 'IN_PROGRESS', conclusion: null })
const selectedPendingAutomation = automationHost({
  initialState: approvedState(),
  checkPages: Array.from({ length: 3 }, () => selectedPendingPage),
})
const selectedPendingResult = await executeReadyForReviewProgressionV1({ event: readyEvent(), host: selectedPendingAutomation.host, runId: READY_RUN_ID })
check(selectedPendingResult.state === 'INDETERMINATE' && selectedPendingResult.reason === 'checks_not_terminal', 'RFR-14 selected unrelated pending check retains the terminal-wait timeout')
check(selectedPendingAutomation.metrics.waitCalls === 2 && selectedPendingAutomation.metrics.checkReads === 3, 'RFR-14 retains exactly three attempts and two bounded waits')
check(!selectedPendingResult.allowed && selectedPendingAutomation.metrics.threadReads === 0 && selectedPendingAutomation.metrics.patchCalls === 0, 'RFR-14 pending timeout cannot advance or mutate state')

const newerReadyGeneration = automationHost({
  initialState: approvedState(),
  checkPages: [connectionPage([
    currentReadyCheck(),
    currentReadyCheck({ id: 'ready-newer-non-self', detailsUrl: null, startedAt: '2026-08-08T03:00:00Z' }),
    successfulCheck(),
  ])],
})
const tiedReadyGeneration = automationHost({
  initialState: approvedState(),
  checkPages: [connectionPage([currentReadyCheck(), currentReadyCheck({ id: 'ready-tied-non-self', detailsUrl: null }), successfulCheck()])],
})
const malformedReadyGeneration = automationHost({
  initialState: approvedState(),
  checkPages: [connectionPage([currentReadyCheck(), { ...successfulCheck('ready-malformed-generation'), startedAt: null }])],
})
const missingRawReadySelf = automationHost({
  initialState: approvedState(),
  checkPages: [connectionPage([successfulCheck('ready-missing-self')])],
})
const duplicateRawReadySelf = automationHost({
  initialState: approvedState(),
  checkPages: [connectionPage([currentReadyCheck(), currentReadyCheck({ id: 'ready-duplicate-self' }), successfulCheck()])],
})
const newerReadyGenerationResult = await executeReadyForReviewProgressionV1({ event: readyEvent(), host: newerReadyGeneration.host, runId: READY_RUN_ID })
const tiedReadyGenerationResult = await executeReadyForReviewProgressionV1({ event: readyEvent(), host: tiedReadyGeneration.host, runId: READY_RUN_ID })
const malformedReadyGenerationResult = await executeReadyForReviewProgressionV1({ event: readyEvent(), host: malformedReadyGeneration.host, runId: READY_RUN_ID })
const missingRawReadySelfResult = await executeReadyForReviewProgressionV1({ event: readyEvent(), host: missingRawReadySelf.host, runId: READY_RUN_ID })
const duplicateRawReadySelfResult = await executeReadyForReviewProgressionV1({ event: readyEvent(), host: duplicateRawReadySelf.host, runId: READY_RUN_ID })
check(newerReadyGenerationResult.reason === 'ready_current_check_not_selected_generation' && tiedReadyGenerationResult.reason === 'check_generation_ambiguous' && malformedReadyGenerationResult.reason === 'check_generation_identity_invalid', 'RFR-15 newer non-self, tied latest, and malformed generations fail closed')
check(missingRawReadySelfResult.reason === 'ready_current_check_missing' && duplicateRawReadySelfResult.reason === 'check_generation_ambiguous', 'RFR-15 raw missing or duplicate self fails closed before classification')
check([newerReadyGenerationResult, tiedReadyGenerationResult, malformedReadyGenerationResult, missingRawReadySelfResult, duplicateRawReadySelfResult].every((result) => !result.allowed) && [newerReadyGeneration, tiedReadyGeneration, malformedReadyGeneration, missingRawReadySelf, duplicateRawReadySelf].every((automation) => automation.metrics.threadReads === 0), 'RFR-15 no generation or raw-self boundary can advance to thread acquisition')

// Ten writer/orchestration/idempotency/race units x three assertions = 30.
const validAutomation = automationHost()
const validAutomationResult = await executeReviewApprovalAutomationV1({ event: reviewEvent(), host: validAutomation.host })
const validWrittenState = extractProtectedTransitionTaskStateV1(validAutomation.body())
check(validAutomationResult.allowed && validAutomationResult.automation_status === 'HANDOFF_READY' && validAutomationResult.next_action === 'MERGE_OPERATOR', 'valid Review reaches the merge operator handoff')
check(validAutomation.metrics.patchCalls === 1 && validAutomationResult.admission_executed === true && validAutomation.metrics.checkReads === 2 && validAutomation.metrics.threadReads === 1, 'valid Review performs one PATCH, admission, and terminal gate')
check(validWrittenState.observed_head === HEAD && validWrittenState.review_status === 'APPROVE' && validWrittenState.reviewed_head === HEAD && validWrittenState.review_blocker_count === 0 && validWrittenState.record_type === state().record_type && validWrittenState.task_issue_number === TASK && validWrittenState.pr_number === PR && validWrittenState.authorized_paths.join(',') === ALLOWED.join(',') && validWrittenState.architecture_status === 'APPROVED' && validWrittenState.implementation_authorized === true, 'valid Review changes four fields and preserves six')

const convergedAutomation = automationHost({ initialState: approvedState() })
const convergedResult = await executeReviewApprovalAutomationV1({ event: reviewEvent(), host: convergedAutomation.host })
check(convergedResult.allowed && convergedResult.automation_status === 'HANDOFF_READY', 'converged Review returns stable merge-gate handoff')
check(convergedAutomation.metrics.patchCalls === 0 && convergedResult.admission_executed === true && convergedAutomation.metrics.checkReads === 2 && convergedAutomation.metrics.threadReads === 1, 'converged Review performs no duplicate mutation and re-evaluates the read-only gate')
check(convergedResult.next_action === 'MERGE_OPERATOR' && convergedResult.state_changed === false, 'converged Review advances without mutation')

const architectureAutomation = automationHost({ initialState: state({ architecture_status: 'NOT_APPROVED' }) })
const architectureResult = await executeReviewApprovalAutomationV1({ event: reviewEvent(), host: architectureAutomation.host })
check(architectureResult.state === 'ARCHITECTURE_BLOCKED' && architectureResult.reason === 'architecture_not_approved', 'Architecture block is preserved')
check(architectureAutomation.metrics.patchCalls === 0, 'Architecture block performs no PATCH')
check(architectureResult.admission_executed === false && architectureResult.state_changed === false, 'Architecture block performs no admission')

const implementationAutomation = automationHost({ initialState: state({ implementation_authorized: false }) })
const implementationResult = await executeReviewApprovalAutomationV1({ event: reviewEvent(), host: implementationAutomation.host })
check(implementationResult.state === 'IMPLEMENTATION_BLOCKED' && implementationResult.reason === 'implementation_not_authorized', 'implementation block is preserved')
check(implementationAutomation.metrics.patchCalls === 0, 'implementation block performs no PATCH')
check(implementationResult.admission_executed === false && implementationResult.state_changed === false, 'implementation block performs no admission')

const scopeAutomation = automationHost({ changedFiles: 1, filePages: [[{ filename: 'outside.ts', status: 'modified' }]] })
const scopeResult = await executeReviewApprovalAutomationV1({ event: reviewEvent(), host: scopeAutomation.host })
check(scopeResult.state === 'IMPLEMENTATION_BLOCKED' && scopeResult.reason === 'scope_outside_authorized_paths', 'scope drift blocks')
check(scopeAutomation.metrics.patchCalls === 0, 'scope drift performs no PATCH')
check(scopeResult.out_of_scope_paths.join(',') === 'outside.ts' && scopeResult.admission_executed === false, 'scope drift reports path and performs no admission')

const preWriteHeadAutomation = automationHost({ headAtPullRead: { 2: OTHER_HEAD } })
const preWriteHeadResult = await executeReviewApprovalAutomationV1({ event: reviewEvent(), host: preWriteHeadAutomation.host })
check(preWriteHeadResult.state === 'STALE' && preWriteHeadResult.reason === 'head_changed_before_state_write', 'pre-write HEAD race is stale')
check(preWriteHeadAutomation.metrics.patchCalls === 0, 'pre-write HEAD race performs no PATCH')
check(preWriteHeadResult.admission_executed === false && preWriteHeadResult.state_changed === false, 'pre-write HEAD race performs no admission')

const preWriteBodyAutomation = automationHost({ bodyAtPullRead: { 2: stateBlock(state({ architecture_status: 'NOT_APPROVED' })) } })
const preWriteBodyResult = await executeReviewApprovalAutomationV1({ event: reviewEvent(), host: preWriteBodyAutomation.host })
check(preWriteBodyResult.state === 'INDETERMINATE' && preWriteBodyResult.reason === 'state_changed_before_state_write', 'pre-write state race is indeterminate')
check(preWriteBodyAutomation.metrics.patchCalls === 0, 'pre-write body race performs no PATCH')
check(preWriteBodyResult.admission_executed === false && preWriteBodyResult.state_changed === false, 'pre-write body race performs no admission')

const patchFailureAutomation = automationHost({ patchFailure: true })
const patchFailureResult = await executeReviewApprovalAutomationV1({ event: reviewEvent(), host: patchFailureAutomation.host })
check(patchFailureResult.state === 'INDETERMINATE' && patchFailureResult.reason === 'synthetic_patch_failure', 'PATCH failure is indeterminate')
check(patchFailureAutomation.metrics.patchCalls === 1, 'PATCH failure is attempted once')
check(patchFailureResult.admission_executed === false && patchFailureResult.state_changed === false, 'PATCH failure performs no admission')

const postPatchHeadAutomation = automationHost({ headAtPullRead: { 3: OTHER_HEAD } })
const postPatchHeadResult = await executeReviewApprovalAutomationV1({ event: reviewEvent(), host: postPatchHeadAutomation.host })
check(postPatchHeadResult.state === 'STALE' && postPatchHeadResult.reason === 'head_changed_after_state_write', 'post-PATCH HEAD race is stale')
check(postPatchHeadAutomation.metrics.patchCalls === 1 && postPatchHeadResult.admission_executed === false, 'post-PATCH HEAD race performs no admission')
check(postPatchHeadResult.state_changed === false && postPatchHeadResult.allowed === false, 'post-PATCH HEAD race stops without retry')

const falseAdmissionAutomation = automationHost({
  changedFiles: 1,
  filePages: [
    [{ filename: ALLOWED[0], status: 'modified' }],
    [{ filename: 'outside.ts', status: 'modified' }],
  ],
})
const falseAdmissionResult = await executeReviewApprovalAutomationV1({ event: reviewEvent(), host: falseAdmissionAutomation.host })
check(falseAdmissionResult.state === 'IMPLEMENTATION_BLOCKED' && falseAdmissionResult.reason === 'scope_outside_authorized_paths', 'false admission reason is preserved')
check(falseAdmissionAutomation.metrics.patchCalls === 1 && falseAdmissionResult.admission_executed === true, 'false admission follows one verified PATCH')
check(falseAdmissionAutomation.metrics.fileReads === 2 && falseAdmissionResult.next_action === 'STOP', 'false admission is not retried')

// Twelve corrected-Architecture units x three assertions = 36.
const staleOriginalAutomation = automationHost({ initialState: state({ observed_head: OTHER_HEAD }) })
const staleOriginalResult = await executeReviewApprovalAutomationV1({ event: reviewEvent(), host: staleOriginalAutomation.host })
const staleOriginalWritten = extractProtectedTransitionTaskStateV1(staleOriginalAutomation.body())
check(staleOriginalResult.allowed && staleOriginalResult.automation_status === 'HANDOFF_READY', 'fresh APPROVE rebinds a stale original state before admission')
check(staleOriginalAutomation.metrics.patchCalls === 1 && staleOriginalResult.admission_executed === true, 'stale original state is written once before one admission')
check(staleOriginalWritten.observed_head === HEAD && staleOriginalWritten.reviewed_head === HEAD, 'fresh APPROVE rebinds both HEAD fields to the current HEAD')

const staleReviewedHeadEvent = reviewEvent({
  body: reviewDecisionBody({ reviewed_head: OTHER_HEAD }),
  comment: { id: 9005, created_at: '2026-08-07T00:00:04Z' },
})
const staleReviewedHeadAutomation = automationHost({ commentPages: [[staleReviewedHeadEvent.comment]] })
const staleReviewedHeadResult = await executeReviewApprovalAutomationV1({ event: staleReviewedHeadEvent, host: staleReviewedHeadAutomation.host })
check(staleReviewedHeadResult.state === 'STALE' && staleReviewedHeadResult.reason === 'head_binding_stale', 'reviewed HEAD mismatch remains stale')
check(staleReviewedHeadAutomation.metrics.patchCalls === 0, 'reviewed HEAD mismatch performs no PATCH')
check(staleReviewedHeadResult.admission_executed === false && staleReviewedHeadResult.state_changed === false, 'reviewed HEAD mismatch performs no admission')

const changesRequiredEvent = reviewEvent({
  body: reviewDecisionBody({ decision: 'CHANGES_REQUIRED', blocking_finding_count: 1, remaining_finding_count: 1 }),
  comment: { id: 9002, created_at: '2026-08-07T00:00:01Z' },
})
const changesRequiredAutomation = automationHost({
  initialState: approvedState(),
  commentPages: [[changesRequiredEvent.comment]],
})
const changesRequiredResult = await executeReviewApprovalAutomationV1({ event: changesRequiredEvent, host: changesRequiredAutomation.host })
const changesRequiredWritten = extractProtectedTransitionTaskStateV1(changesRequiredAutomation.body())
check(changesRequiredResult.state === 'REVIEW_BLOCKED' && changesRequiredResult.next_action === 'REPAIR_EXECUTOR' && changesRequiredResult.automation_status === 'DISPATCH_READY', 'later CHANGES_REQUIRED revokes eligibility and projects repair dispatch')
check(changesRequiredAutomation.metrics.patchCalls === 1 && changesRequiredResult.admission_executed === false, 'later CHANGES_REQUIRED writes once without admission')
check(changesRequiredWritten.review_status === 'CHANGES_REQUIRED' && changesRequiredWritten.review_blocker_count === 1, 'later CHANGES_REQUIRED is the stored effective Decision')

const blockedEvent = reviewEvent({
  body: reviewDecisionBody({ decision: 'BLOCKED', blocking_finding_count: 2 }),
  comment: { id: 9003, created_at: '2026-08-07T00:00:02Z' },
})
const blockedAutomation = automationHost({
  initialState: approvedState(),
  commentPages: [[blockedEvent.comment]],
})
const blockedResult = await executeRoleTransitionOrchestratorV1({ event: blockedEvent, host: blockedAutomation.host, runId: REVIEW_RUN_ID })
const blockedWritten = extractProtectedTransitionTaskStateV1(blockedAutomation.body())
check(blockedResult.state === 'REVIEW_BLOCKED' && blockedResult.allowed === false && blockedResult.next_action === 'STOP' && blockedResult.terminal_result === 'BLOCKED', 'central Orchestrator delegates later BLOCKED without Role dispatch')
check(blockedAutomation.metrics.patchCalls === 1 && blockedAutomation.metrics.commitReads === 0 && blockedResult.admission_executed === false, 'later BLOCKED writes once without admission or PUBLISHED commit acquisition')
check(blockedWritten.review_status === 'BLOCKED' && blockedWritten.review_blocker_count === 2, 'later BLOCKED is the stored effective Decision')

const recoveryEvent = reviewEvent({ comment: { id: 9004, created_at: '2026-08-07T00:00:03Z' } })
const recoveryAutomation = automationHost({
  initialState: blockedReviewState(),
  commentPages: [[recoveryEvent.comment]],
})
const recoveryResult = await executeReviewApprovalAutomationV1({ event: recoveryEvent, host: recoveryAutomation.host })
const recoveryWritten = extractProtectedTransitionTaskStateV1(recoveryAutomation.body())
check(recoveryResult.allowed && recoveryResult.automation_status === 'HANDOFF_READY', 'later valid APPROVE restores eligibility')
check(recoveryAutomation.metrics.patchCalls === 1 && recoveryResult.admission_executed === true, 'later valid APPROVE writes and admits once')
check(recoveryWritten.review_status === 'APPROVE' && recoveryWritten.review_blocker_count === 0, 'later APPROVE becomes the stored effective Decision')

const olderEvent = reviewEvent()
const laterDecision = reviewEvent({
  body: reviewDecisionBody({ decision: 'CHANGES_REQUIRED', blocking_finding_count: 1 }),
  comment: { id: 9010, created_at: '2026-08-07T00:00:10Z' },
})
const supersededAutomation = automationHost({ commentPages: [[olderEvent.comment, laterDecision.comment]] })
const supersededResult = await executeReviewApprovalAutomationV1({ event: olderEvent, host: supersededAutomation.host })
check(supersededResult.reason === 'review_event_superseded' && supersededResult.automation_status === 'COMPLETED_NOOP', 'older Review event is superseded')
check(supersededAutomation.metrics.patchCalls === 0 && supersededAutomation.metrics.pullReads === 0, 'superseded event performs no state acquisition or PATCH')
check(supersededResult.admission_executed === false && supersededResult.next_action === 'NONE', 'superseded event performs no admission')

const sameTimeOlder = reviewEvent({ comment: { id: 9100, created_at: '2026-08-07T00:01:00Z' } })
const sameTimeNewer = reviewEvent({
  body: reviewDecisionBody({ decision: 'BLOCKED', blocking_finding_count: 1 }),
  comment: { id: 9101, created_at: '2026-08-07T00:01:00Z' },
})
const tiedAutomation = automationHost({ commentPages: [[sameTimeOlder.comment, sameTimeNewer.comment]] })
const tiedResult = await executeReviewApprovalAutomationV1({ event: sameTimeOlder, host: tiedAutomation.host })
check(tiedResult.reason === 'review_event_superseded', 'same-time greatest comment ID wins')
check(tiedAutomation.metrics.patchCalls === 0, 'same-time older comment performs no PATCH')
check(tiedAutomation.metrics.commentReads === 1 && tiedResult.admission_executed === false, 'same-time tie is resolved in one forward scan')

const pagedEvent = reviewEvent({ comment: { id: 9200, created_at: '2026-08-07T00:02:00Z' } })
const fillerComments = Array.from({ length: 99 }, (_, index) => ({
  id: 9300 + index,
  created_at: '2026-08-07T00:02:00Z',
  author_association: 'MEMBER',
  body: `non-review-${index}`,
}))
const pagedLeaf = reviewEvent({ comment: { id: 9400, created_at: '2026-08-07T00:02:01Z' } })
const pagedAutomation = automationHost({ commentPages: [[pagedEvent.comment, ...fillerComments], [pagedLeaf.comment]] })
const pagedParsed = parseReviewApprovalEventV1(pagedEvent)
const pagedEffective = await resolveEffectiveReviewDecisionV1({ request, parsedEvent: pagedParsed, host: pagedAutomation.host })
check(pagedEffective.commentId === 9400, 'forward pagination resolves the later current leaf')
check(pagedAutomation.metrics.commentReads === 2, 'forward pagination reads through the terminal page')
check(pagedEffective.review.pr_number === PR && pagedEffective.review.reviewed_head === HEAD, 'forward pagination preserves Task/PR/HEAD filtering')

const malformedBody = reviewDecisionBody({}, ['decision: APPROVE'])
const malformedComment = reviewEvent({
  body: malformedBody,
  comment: { id: 9500, created_at: '2026-08-07T00:03:01Z' },
}).comment
const malformedAutomation = automationHost({ commentPages: [[reviewEvent().comment, malformedComment]] })
const malformedResult = await executeReviewApprovalAutomationV1({ event: reviewEvent(), host: malformedAutomation.host })
check(malformedResult.state === 'INDETERMINATE' && malformedResult.reason === 'review_decision_candidate_invalid', 'malformed applicable leaf fails closed')
check(malformedAutomation.metrics.patchCalls === 0, 'malformed applicable leaf performs no PATCH')
check(malformedResult.admission_executed === false && malformedResult.next_action === 'STOP', 'malformed applicable leaf performs no admission')

const productionPaths = execFileSync('git', ['ls-files', '.github', 'scripts', 'src'], { cwd: repositoryRoot, encoding: 'utf8' })
  .trim().split(/\r?\n/).filter((value) => value && !/^scripts\/test-/.test(value))
const repositoryProductionSource = productionPaths.map((value) => readFileSync(path.join(repositoryRoot, value), 'utf8')).join('\n')
const patchCallsites = repositoryProductionSource.match(/method:\s*['"]PATCH['"]/g) ?? []
check(patchCallsites.length === 1, 'repository production has exactly one PATCH callsite')
check(/export const writeProtectedTransitionTaskStateV1[\s\S]*?method:\s*['"]PATCH['"]/.test(runnerSource), 'canonical writer owns the PATCH callsite')
check(!/(?:gh\s+pr\s+edit|updatePullRequest|mutatePullRequest)/.test(repositoryProductionSource), 'repository production has no alternate PR-body writer')

const concurrencyGroup = workflow.concurrency.group
const preservedBodyAutomation = automationHost({
  bodyAtPullRead: { 2: `concurrent-note\n${stateBlock(state())}\nconcurrent-footer` },
})
const preservedBodyResult = await executeReviewApprovalAutomationV1({ event: reviewEvent(), host: preservedBodyAutomation.host })
check(concurrencyGroup === 'protected-transition-admission-v1-${{ github.repository }}-${{ github.event.issue.number || github.event.pull_request.number || inputs.task_issue_number }}' && workflow.on.workflow_dispatch.inputs.task_issue_number.type === 'number' && workflow.concurrency['cancel-in-progress'] === false, 'all triggers share one repository and canonical Task or PR queue')
check(!concurrencyGroup.includes('comment.id') && !concurrencyGroup.includes('run_id'), 'comment and run IDs do not partition serialization')
check(preservedBodyResult.allowed && preservedBodyAutomation.body().startsWith('concurrent-note\n') && preservedBodyAutomation.body().endsWith('\nconcurrent-footer'), 'canonical writer preserves fresh non-state body bytes')

const exactConvergedAutomation = automationHost({ initialState: approvedState() })
const exactConvergedResult = await executeReviewApprovalAutomationV1({ event: reviewEvent(), host: exactConvergedAutomation.host })
const ambiguousAutomation = automationHost({ applyPatch: false })
const ambiguousResult = await executeReviewApprovalAutomationV1({ event: reviewEvent(), host: ambiguousAutomation.host })
check(exactConvergedAutomation.metrics.patchCalls === 0 && exactConvergedResult.admission_executed === true && exactConvergedResult.state_changed === false, 'same-state retry has zero duplicate mutation')
check(ambiguousResult.reason === 'state_write_verification_failed' && ambiguousResult.admission_executed === false, 'ambiguous PATCH verification performs no admission')
check(ambiguousAutomation.metrics.patchCalls === 1 && ambiguousResult.state_changed === false, 'ambiguous PATCH is not retried')

// Twelve MERGE_ALLOWED terminal-gate units x three assertions = 36.
const mergeRequest = Object.freeze({ ...request, transition: 'merge_decision_admission' })
const mergeAdmitted = evaluateProtectedTransitionAdmissionV1(input({
  transition: 'merge_decision_admission',
  task_state: approvedState(),
}))
const reviewDetachedMergeRequest = Object.freeze({
  ...mergeRequest,
  currentWorkflowRunId: REVIEW_RUN_ID,
  selfCheckContext: 'DETACHED_SELF_CHECK_AWARE',
})
const historicalReviewSelfCheck = ({
  id = 'historical-review-admission',
  name = 'protected_transition_admission_v1',
  conclusion = 'FAILURE',
  runId = '31560744932',
  detailsUrl = `https://github.com/${REPOSITORY}/actions/runs/${runId}/job/${id}`,
  startedAt = '2026-08-12T03:39:26Z',
  appId = 'github-actions-app',
} = {}) => currentReadyCheck({ id, name, status: 'COMPLETED', conclusion, detailsUrl, startedAt, appId })
const detachedReviewCheckPage = (external = successfulCheck('review-external-success')) => connectionPage([
  historicalReviewSelfCheck(),
  historicalReviewSelfCheck({
    id: 'historical-review-repair',
    name: 'protected_transition_repair_executor_v1',
    conclusion: 'SKIPPED',
    startedAt: '2026-08-12T03:39:32Z',
  }),
  ...(external === null ? [] : [external]),
])

const mergeSuccess = automationHost({ initialState: approvedState() })
const mergeSuccessResult = await evaluateMergeAllowedAutomationV1({ request: mergeRequest, admitted: mergeAdmitted, host: mergeSuccess.host })
check(mergeSuccessResult.state === 'MERGE_ELIGIBLE' && mergeSuccessResult.allowed, 'stable exact-HEAD gate remains merge eligible')
check(mergeSuccessResult.automation_status === 'MERGE_ALLOWED' && mergeSuccessResult.reason === 'merge_gate_satisfied' && mergeSuccessResult.next_action === 'MERGE_OPERATOR', 'stable exact-HEAD gate reaches merge operator')
check(mergeSuccess.metrics.pullReads === 3 && mergeSuccess.metrics.fileReads === 1 && mergeSuccess.metrics.checkReads === 2 && mergeSuccess.metrics.threadReads === 1 && mergeSuccess.metrics.patchCalls === 0, 'merge gate is read-only and reacquires checks at the final decision')

const initialHeadDrift = automationHost({ initialState: approvedState(), headAtPullRead: { 1: OTHER_HEAD } })
const initialHeadDriftResult = await evaluateMergeAllowedAutomationV1({ request: mergeRequest, admitted: mergeAdmitted, host: initialHeadDrift.host })
check(initialHeadDriftResult.state === 'STALE' && initialHeadDriftResult.reason === 'head_changed_during_merge_gate', 'initial merge-gate HEAD drift is stale')
check(initialHeadDriftResult.current_head === OTHER_HEAD && initialHeadDriftResult.allowed === false, 'initial merge-gate HEAD drift reports the observed HEAD')
check(initialHeadDrift.metrics.checkReads === 0 && initialHeadDrift.metrics.threadReads === 0, 'initial HEAD drift stops before GraphQL acquisition')

const draftGate = automationHost({ initialState: approvedState(), draft: true })
const closedGate = automationHost({ initialState: approvedState(), pullState: 'closed' })
const dirtyGate = automationHost({ initialState: approvedState(), mergeableState: 'dirty' })
const draftGateResult = await evaluateMergeAllowedAutomationV1({ request: mergeRequest, admitted: mergeAdmitted, host: draftGate.host })
const closedGateResult = await evaluateMergeAllowedAutomationV1({ request: mergeRequest, admitted: mergeAdmitted, host: closedGate.host })
const dirtyGateResult = await evaluateMergeAllowedAutomationV1({ request: mergeRequest, admitted: mergeAdmitted, host: dirtyGate.host })
check(draftGateResult.state === 'REVIEW_PENDING' && draftGateResult.reason === 'pull_not_ready', 'Draft PR stops as Review pending')
check(closedGateResult.state === 'REVIEW_PENDING' && closedGateResult.reason === 'pull_not_ready', 'closed PR stops as Review pending')
check(dirtyGateResult.state === 'IMPLEMENTATION_BLOCKED' && dirtyGateResult.reason === 'pull_not_mergeable', 'non-clean PR blocks implementation')

const missingChecks = automationHost({ initialState: approvedState(), checkPages: [null] })
const zeroChecks = automationHost({ initialState: approvedState(), mergeableState: 'unstable', checkPages: [detachedReviewCheckPage(null)] })
const missingChecksResult = await evaluateMergeAllowedAutomationV1({ request: mergeRequest, admitted: mergeAdmitted, host: missingChecks.host })
const zeroChecksResult = await evaluateMergeAllowedAutomationV1({ request: reviewDetachedMergeRequest, admitted: mergeAdmitted, host: zeroChecks.host })
check(missingChecksResult.state === 'INDETERMINATE' && missingChecksResult.reason === 'check_rollup_page_invalid', 'missing check rollup fails closed')
check(zeroChecksResult.state === 'INDETERMINATE' && zeroChecksResult.reason === 'checks_missing', 'zero current check contexts fail closed')
check(missingChecks.metrics.threadReads === 0 && zeroChecks.metrics.threadReads === 0, 'missing checks stop before thread acquisition')

const pendingChecks = automationHost({
  initialState: approvedState(),
  mergeableState: 'unstable',
  checkPages: [detachedReviewCheckPage({ ...successfulCheck(), status: 'IN_PROGRESS', conclusion: null })],
})
const pendingChecksResult = await evaluateMergeAllowedAutomationV1({ request: reviewDetachedMergeRequest, admitted: mergeAdmitted, host: pendingChecks.host })
check(pendingChecksResult.state === 'INDETERMINATE' && pendingChecksResult.reason === 'checks_not_terminal', 'non-terminal check is indeterminate')
check(pendingChecksResult.allowed === false && pendingChecksResult.next_action === 'STOP', 'non-terminal check cannot advance')
check(pendingChecks.metrics.checkReads === 1 && pendingChecks.metrics.threadReads === 0, 'non-terminal check stops before threads')

const failedChecks = automationHost({
  initialState: approvedState(),
  mergeableState: 'unstable',
  checkPages: [detachedReviewCheckPage({ ...successfulCheck(), conclusion: 'FAILURE' })],
})
const failedChecksResult = await evaluateMergeAllowedAutomationV1({ request: reviewDetachedMergeRequest, admitted: mergeAdmitted, host: failedChecks.host })
check(failedChecksResult.state === 'IMPLEMENTATION_BLOCKED' && failedChecksResult.reason === 'checks_not_successful', 'failed terminal check blocks implementation')
check(failedChecksResult.allowed === false && failedChecksResult.automation_status === 'STOPPED', 'failed terminal check cannot advance')
check(failedChecks.metrics.checkReads === 1 && failedChecks.metrics.threadReads === 0, 'failed terminal check stops before threads')

const pagedChecks = automationHost({
  initialState: approvedState(),
  checkPages: [
    connectionPage([successfulCheck('check-a')], { totalCount: 2, hasNextPage: true, endCursor: 'checks-1' }),
    connectionPage([successfulCheck('check-b')], { totalCount: 2 }),
    connectionPage([successfulCheck('check-a')], { totalCount: 2, hasNextPage: true, endCursor: 'checks-1-final' }),
    connectionPage([successfulCheck('check-b')], { totalCount: 2 }),
  ],
})
const pagedChecksResult = await evaluateMergeAllowedAutomationV1({ request: mergeRequest, admitted: mergeAdmitted, host: pagedChecks.host })
check(pagedChecksResult.allowed && pagedChecksResult.automation_status === 'MERGE_ALLOWED', 'complete multi-page checks can advance')
check(pagedChecks.metrics.checkReads === 4 && pagedChecks.metrics.threadReads === 1, 'both check snapshots reach their terminal page')
check(pagedChecksResult.reason === 'merge_gate_satisfied', 'multi-page checks preserve success reason')

const blockingThreads = automationHost({
  initialState: approvedState(),
  mergeableState: 'unstable',
  checkPages: [detachedReviewCheckPage()],
  threadPages: [connectionPage([{ id: 'thread-1', isResolved: false, isOutdated: false }])],
})
const blockingThreadsResult = await evaluateMergeAllowedAutomationV1({ request: reviewDetachedMergeRequest, admitted: mergeAdmitted, host: blockingThreads.host })
check(blockingThreadsResult.state === 'REVIEW_BLOCKED' && blockingThreadsResult.reason === 'blocking_review_threads_present', 'current unresolved thread blocks Review')
check(blockingThreadsResult.allowed === false && blockingThreadsResult.next_action === 'STOP', 'current unresolved thread cannot advance')
check(blockingThreads.metrics.threadReads === 1 && blockingThreads.metrics.pullReads === 2, 'blocking thread stops before final pull refetch')

const ignoredThreads = automationHost({
  initialState: approvedState(),
  threadPages: [connectionPage([
    { id: 'thread-resolved', isResolved: true, isOutdated: false },
    { id: 'thread-outdated', isResolved: false, isOutdated: true },
  ])],
})
const ignoredThreadsResult = await evaluateMergeAllowedAutomationV1({ request: mergeRequest, admitted: mergeAdmitted, host: ignoredThreads.host })
check(ignoredThreadsResult.allowed && ignoredThreadsResult.automation_status === 'MERGE_ALLOWED', 'resolved and outdated threads are non-blocking')
check(ignoredThreads.metrics.threadReads === 1 && ignoredThreads.metrics.pullReads === 3, 'non-blocking threads permit final pull refetch')
check(ignoredThreadsResult.next_action === 'MERGE_OPERATOR', 'non-blocking threads advance to merge operator')

const pagedThreads = automationHost({
  initialState: approvedState(),
  threadPages: [
    connectionPage([{ id: 'thread-resolved', isResolved: true, isOutdated: false }], { totalCount: 2, hasNextPage: true, endCursor: 'threads-1' }),
    connectionPage([{ id: 'thread-late', isResolved: false, isOutdated: false }], { totalCount: 2 }),
  ],
})
const pagedThreadsResult = await evaluateMergeAllowedAutomationV1({ request: mergeRequest, admitted: mergeAdmitted, host: pagedThreads.host })
check(pagedThreadsResult.state === 'REVIEW_BLOCKED' && pagedThreadsResult.reason === 'blocking_review_threads_present', 'late paginated thread blocks Review')
check(pagedThreads.metrics.threadReads === 2, 'thread pagination reaches the late blocker')
check(pagedThreadsResult.allowed === false && pagedThreads.metrics.pullReads === 2, 'late blocker stops before final pull refetch')

const finalHeadDrift = automationHost({ initialState: approvedState(), headAtPullRead: { 3: OTHER_HEAD } })
const finalStateDrift = automationHost({
  initialState: approvedState(),
  bodyAtPullRead: {
    3: stateBlock(state({ architecture_status: 'NOT_APPROVED', review_status: 'APPROVE', reviewed_head: HEAD, review_blocker_count: 0 })),
  },
})
const finalHeadDriftResult = await evaluateMergeAllowedAutomationV1({ request: mergeRequest, admitted: mergeAdmitted, host: finalHeadDrift.host })
const finalStateDriftResult = await evaluateMergeAllowedAutomationV1({ request: mergeRequest, admitted: mergeAdmitted, host: finalStateDrift.host })
check(finalHeadDriftResult.state === 'STALE' && finalHeadDriftResult.reason === 'head_changed_during_merge_gate', 'post-snapshot HEAD drift is stale')
check(finalStateDriftResult.state === 'INDETERMINATE' && finalStateDriftResult.reason === 'state_changed_during_merge_gate', 'post-snapshot state drift is indeterminate')
check(!finalHeadDriftResult.allowed && !finalStateDriftResult.allowed, 'post-snapshot drift cannot advance')

const retryGate = automationHost({ initialState: approvedState() })
const retryGateFirst = await evaluateMergeAllowedAutomationV1({ request: mergeRequest, admitted: mergeAdmitted, host: retryGate.host })
const retryGateSecond = await evaluateMergeAllowedAutomationV1({ request: mergeRequest, admitted: mergeAdmitted, host: retryGate.host })
const taskChangedPaths = execFileSync('git', ['diff', '--name-only', BASE], { cwd: repositoryRoot, encoding: 'utf8' }).trim().split(/\r?\n/).filter(Boolean)
check(JSON.stringify(retryGateFirst) === JSON.stringify(retryGateSecond), 'identical retry converges to the same result')
check(retryGate.metrics.patchCalls === 0 && retryGate.metrics.pullReads === 6 && retryGate.metrics.fileReads === 2 && retryGate.metrics.checkReads === 4 && retryGate.metrics.threadReads === 2, 'identical retry remains read-only')
check(taskChangedPaths.join('\n') === ['.github/workflows/protected-transition-admission-v1.yml', 'scripts/run-protected-transition-admission-v1.mjs', 'scripts/test-protected-transition-admission-v1.mjs'].join('\n'), 'current Task diff is exactly three paths')

// Four current-generation Merge Gate units x three assertions = 12.
const selfAwareMergeRequest = Object.freeze({
  ...mergeRequest,
  currentWorkflowRunId: READY_RUN_ID,
  selfCheckContext: 'ATTACHED_CURRENT_CHECK_REQUIRED',
})
const historicalReadyCheck = ({ id, conclusion }) => currentReadyCheck({
  id,
  status: 'COMPLETED',
  conclusion,
  detailsUrl: `https://github.com/${REPOSITORY}/actions/runs/31261170331/job/${id}`,
  startedAt: id.endsWith('failure') ? '2026-08-08T00:00:00Z' : '2026-08-08T01:00:00Z',
})
const stableGenerationPage = () => connectionPage([
  historicalReadyCheck({ id: 'stale-failure', conclusion: 'FAILURE' }),
  historicalReadyCheck({ id: 'stale-success', conclusion: 'SUCCESS' }),
  currentReadyCheck(),
  currentReadyCheck({
    id: 'other-app-same-name',
    status: 'COMPLETED',
    conclusion: 'SUCCESS',
    detailsUrl: null,
    startedAt: '2026-08-08T01:30:00Z',
    appId: 'other-check-app',
  }),
  successfulCheck(),
])
const selfAwareUnstable = automationHost({
  initialState: approvedState(),
  mergeableState: 'unstable',
  checkPages: [detachedReviewCheckPage(), detachedReviewCheckPage()],
})
const selfAwareUnstableResult = await evaluateMergeAllowedAutomationV1({ request: reviewDetachedMergeRequest, admitted: mergeAdmitted, host: selfAwareUnstable.host })
check(selfAwareUnstableResult.state === 'MERGE_ELIGIBLE' && selfAwareUnstableResult.allowed, 'MGA-01 historical Review Admission and Repair self-checks are excluded')
check(selfAwareUnstableResult.automation_status === 'MERGE_ALLOWED' && selfAwareUnstableResult.reason === 'merge_gate_satisfied', 'MGA-01 remaining external success establishes effective clean')
check(selfAwareUnstable.metrics.checkReads === 2 && selfAwareUnstable.metrics.threadReads === 1 && selfAwareUnstable.metrics.pullReads === 3, 'MGA-01 independently reduces initial and final external snapshots before the thread gate')

const missingInitialSelf = automationHost({
  initialState: approvedState(),
  mergeableState: 'unstable',
  checkPages: [connectionPage([successfulCheck()])],
})
const duplicateFinalSelf = automationHost({
  initialState: approvedState(),
  mergeableState: 'unstable',
  checkPages: [
    readyCheckPage(),
    connectionPage([currentReadyCheck(), currentReadyCheck({ id: 'ready-current-check-2' }), successfulCheck()]),
  ],
})
const newerInitialGeneration = automationHost({
  initialState: approvedState(),
  mergeableState: 'unstable',
  checkPages: [connectionPage([
    currentReadyCheck(),
    currentReadyCheck({ id: 'newer-non-self', detailsUrl: null, startedAt: '2026-08-08T03:00:00Z' }),
    successfulCheck(),
  ])],
})
const tiedInitialGeneration = automationHost({
  initialState: approvedState(),
  mergeableState: 'unstable',
  checkPages: [connectionPage([currentReadyCheck(), currentReadyCheck({ id: 'tied-non-self', detailsUrl: null }), successfulCheck()])],
})
const malformedInitialGeneration = automationHost({
  initialState: approvedState(),
  mergeableState: 'unstable',
  checkPages: [connectionPage([currentReadyCheck(), { ...successfulCheck('malformed-generation'), startedAt: null }])],
})
const missingInitialSelfResult = await evaluateMergeAllowedAutomationV1({ request: selfAwareMergeRequest, admitted: mergeAdmitted, host: missingInitialSelf.host })
const duplicateFinalSelfResult = await evaluateMergeAllowedAutomationV1({ request: selfAwareMergeRequest, admitted: mergeAdmitted, host: duplicateFinalSelf.host })
const newerInitialGenerationResult = await evaluateMergeAllowedAutomationV1({ request: selfAwareMergeRequest, admitted: mergeAdmitted, host: newerInitialGeneration.host })
const tiedInitialGenerationResult = await evaluateMergeAllowedAutomationV1({ request: selfAwareMergeRequest, admitted: mergeAdmitted, host: tiedInitialGeneration.host })
const malformedInitialGenerationResult = await evaluateMergeAllowedAutomationV1({ request: selfAwareMergeRequest, admitted: mergeAdmitted, host: malformedInitialGeneration.host })
check(missingInitialSelfResult.state === 'INDETERMINATE' && missingInitialSelfResult.reason === 'ready_current_check_missing' && missingInitialSelf.metrics.threadReads === 0, 'MGA-02 missing initial raw self fails closed')
check(duplicateFinalSelfResult.state === 'INDETERMINATE' && duplicateFinalSelfResult.reason === 'check_generation_ambiguous' && duplicateFinalSelf.metrics.threadReads === 1, 'MGA-02 duplicate final raw self fails closed during generation selection')
check(newerInitialGenerationResult.reason === 'ready_current_check_not_selected_generation' && tiedInitialGenerationResult.reason === 'check_generation_ambiguous' && malformedInitialGenerationResult.reason === 'check_generation_identity_invalid', 'MGA-02 newer non-self, tied latest, and malformed generation identity fail closed')

const latePendingCheck = automationHost({
  initialState: approvedState(),
  mergeableState: 'unstable',
  checkPages: [
    detachedReviewCheckPage(),
    detachedReviewCheckPage({ ...successfulCheck('late-pending'), status: 'IN_PROGRESS', conclusion: null }),
  ],
})
const lateFailedCheck = automationHost({
  initialState: approvedState(),
  mergeableState: 'unstable',
  checkPages: [detachedReviewCheckPage(), detachedReviewCheckPage({ ...successfulCheck('late-failed'), conclusion: 'FAILURE' })],
})
const otherAppSameNameFailure = automationHost({
  initialState: approvedState(),
  mergeableState: 'unstable',
  checkPages: [connectionPage([
    historicalReviewSelfCheck(),
    historicalReviewSelfCheck({ id: 'historical-review-repair', name: 'protected_transition_repair_executor_v1', conclusion: 'SKIPPED' }),
    currentReadyCheck({ id: 'other-app-failure', status: 'COMPLETED', conclusion: 'FAILURE', detailsUrl: null, appId: 'other-check-app' }),
    successfulCheck(),
  ])],
})
const finalNewerGeneration = automationHost({
  initialState: approvedState(),
  mergeableState: 'unstable',
  checkPages: [readyCheckPage(), connectionPage([
    currentReadyCheck(),
    currentReadyCheck({ id: 'final-newer-non-self', detailsUrl: null, startedAt: '2026-08-08T03:00:00Z' }),
    successfulCheck(),
  ])],
})
const finalTiedGeneration = automationHost({
  initialState: approvedState(),
  mergeableState: 'unstable',
  checkPages: [readyCheckPage(), connectionPage([currentReadyCheck(), currentReadyCheck({ id: 'final-tied-non-self', detailsUrl: null }), successfulCheck()])],
})
const latePendingCheckResult = await evaluateMergeAllowedAutomationV1({ request: reviewDetachedMergeRequest, admitted: mergeAdmitted, host: latePendingCheck.host })
const lateFailedCheckResult = await evaluateMergeAllowedAutomationV1({ request: reviewDetachedMergeRequest, admitted: mergeAdmitted, host: lateFailedCheck.host })
const otherAppSameNameFailureResult = await evaluateMergeAllowedAutomationV1({ request: reviewDetachedMergeRequest, admitted: mergeAdmitted, host: otherAppSameNameFailure.host })
const finalNewerGenerationResult = await evaluateMergeAllowedAutomationV1({ request: selfAwareMergeRequest, admitted: mergeAdmitted, host: finalNewerGeneration.host })
const finalTiedGenerationResult = await evaluateMergeAllowedAutomationV1({ request: selfAwareMergeRequest, admitted: mergeAdmitted, host: finalTiedGeneration.host })
check(otherAppSameNameFailureResult.reason === 'checks_not_successful' && otherAppSameNameFailureResult.state === 'IMPLEMENTATION_BLOCKED', 'MGA-03 same-name check from another app remains independently enforced')
check(latePendingCheckResult.reason === 'checks_not_terminal' && lateFailedCheckResult.reason === 'checks_not_successful' && !latePendingCheckResult.allowed && !lateFailedCheckResult.allowed, 'MGA-03 selected unrelated pending and failed checks remain blocking')
check(finalNewerGenerationResult.reason === 'ready_current_check_not_selected_generation' && finalTiedGenerationResult.reason === 'check_generation_ambiguous' && finalNewerGeneration.metrics.checkReads === 2 && finalTiedGeneration.metrics.checkReads === 2, 'MGA-03 final snapshot independently rejects newer or tied generations')

const finalCheckHeadDrift = automationHost({
  initialState: approvedState(),
  mergeableState: 'unstable',
  checkPages: [readyCheckPage(), readyCheckPage()],
  headAtCheckRead: { 2: OTHER_HEAD },
})
const finalCheckPaginationFailure = automationHost({
  initialState: approvedState(),
  mergeableState: 'unstable',
  checkPages: [readyCheckPage(), null],
})
const selfAwareConflict = automationHost({ initialState: approvedState(), mergeable: false, mergeableState: 'dirty' })
const nonSelfUnstable = automationHost({ initialState: approvedState(), mergeableState: 'unstable' })
const finalCheckHeadDriftResult = await evaluateMergeAllowedAutomationV1({ request: selfAwareMergeRequest, admitted: mergeAdmitted, host: finalCheckHeadDrift.host })
const finalCheckPaginationFailureResult = await evaluateMergeAllowedAutomationV1({ request: selfAwareMergeRequest, admitted: mergeAdmitted, host: finalCheckPaginationFailure.host })
const selfAwareConflictResult = await evaluateMergeAllowedAutomationV1({ request: reviewDetachedMergeRequest, admitted: mergeAdmitted, host: selfAwareConflict.host })
const nonSelfUnstableResult = await evaluateMergeAllowedAutomationV1({ request: mergeRequest, admitted: mergeAdmitted, host: nonSelfUnstable.host })
check(finalCheckHeadDriftResult.state === 'STALE' && finalCheckHeadDriftResult.reason === 'head_changed_during_merge_gate', 'MGA-04 final check snapshot HEAD drift is stale')
check(finalCheckPaginationFailureResult.state === 'INDETERMINATE' && finalCheckPaginationFailureResult.reason === 'check_rollup_page_invalid', 'MGA-04 final check pagination failure is indeterminate')
check(selfAwareConflictResult.state === 'IMPLEMENTATION_BLOCKED' && nonSelfUnstableResult.state === 'IMPLEMENTATION_BLOCKED' && selfAwareConflict.metrics.checkReads === 0 && nonSelfUnstable.metrics.checkReads === 0, 'MGA-04 conflict and non-self-aware UNSTABLE remain blocked')

// Shared current-generation self-sibling reduction: 12 assertions.
const priorRepairSibling = ({
  id = 'prior-repair-sibling',
  conclusion = 'SKIPPED',
  runId = '31314694508',
  detailsUrl = `https://github.com/${REPOSITORY}/actions/runs/${runId}/job/${id}`,
  startedAt = '2026-08-08T01:00:00Z',
  appId = 'github-actions-app',
} = {}) => currentReadyCheck({
  id,
  name: 'protected_transition_repair_executor_v1',
  status: 'COMPLETED',
  conclusion,
  detailsUrl,
  startedAt,
  appId,
})
const selfSiblingPage = ({ repair = priorRepairSibling(), external = successfulCheck('shared-external-success') } = {}) =>
  connectionPage([currentReadyCheck(), repair, external])

const skippedSiblingLifecycle = automationHost({
  initialState: approvedState(),
  mergeableState: 'unstable',
  checkPages: [selfSiblingPage(), selfSiblingPage(), selfSiblingPage()],
})
const skippedSiblingLifecycleResult = await executeReadyForReviewProgressionV1({ event: readyEvent(), host: skippedSiblingLifecycle.host, runId: READY_RUN_ID })
check(!skippedSiblingLifecycleResult.allowed && skippedSiblingLifecycleResult.next_action === 'PRODUCT_OWNER_IMPLEMENTATION_LEAD', 'SGR-01 Ready-wait excludes a prior SKIPPED Repair Executor sibling')

const conclusionIndependentResults = await Promise.all(['SUCCESS', 'FAILURE', 'SKIPPED'].map(async (conclusion) => {
  const automation = automationHost({
    initialState: approvedState(),
    mergeableState: 'unstable',
    checkPages: [selfSiblingPage({ repair: priorRepairSibling({ id: `repair-${conclusion.toLowerCase()}`, conclusion }) })],
  })
  return executeReadyForReviewProgressionV1({ event: readyEvent(), host: automation.host, runId: READY_RUN_ID })
}))
check(conclusionIndependentResults.every((result) => !result.allowed && result.next_action === 'PRODUCT_OWNER_IMPLEMENTATION_LEAD'), 'SGR-02 prior self-sibling exclusion is conclusion-independent')
check(skippedSiblingLifecycle.metrics.waitCalls === 0 && skippedSiblingLifecycle.metrics.threadReads === 1, 'SGR-03 all-success external checks progress from Ready-wait')

const differentAppRepair = automationHost({
  initialState: approvedState(),
  checkPages: [selfSiblingPage({ repair: priorRepairSibling({ id: 'different-app-repair', conclusion: 'FAILURE', detailsUrl: null, appId: 'other-check-app' }) })],
})
const differentAppRepairResult = await executeReadyForReviewProgressionV1({ event: readyEvent(), host: differentAppRepair.host, runId: READY_RUN_ID })
check(differentAppRepairResult.state === 'IMPLEMENTATION_BLOCKED' && differentAppRepairResult.reason === 'checks_not_successful', 'SGR-04 same-name different-app failure remains effective')

const malformedRepair = automationHost({
  initialState: approvedState(),
  checkPages: [selfSiblingPage({ repair: priorRepairSibling({ detailsUrl: `https://github.com/${REPOSITORY}/actions/runs/not-a-run/job/malformed` }) })],
})
const ambiguousRepair = automationHost({
  initialState: approvedState(),
  checkPages: [connectionPage([
    currentReadyCheck(),
    priorRepairSibling({ id: 'ambiguous-repair-a', runId: '31314694508' }),
    priorRepairSibling({ id: 'ambiguous-repair-b', runId: '31314694509' }),
    successfulCheck('ambiguous-external-success'),
  ])],
})
const malformedRepairResult = await executeReadyForReviewProgressionV1({ event: readyEvent(), host: malformedRepair.host, runId: READY_RUN_ID })
const ambiguousRepairResult = await executeReadyForReviewProgressionV1({ event: readyEvent(), host: ambiguousRepair.host, runId: READY_RUN_ID })
check(malformedRepairResult.reason === 'ready_self_sibling_identity_invalid' && ambiguousRepairResult.reason === 'check_generation_ambiguous', 'SGR-05 malformed or ambiguous same-app sibling identity fails closed')

const currentRunRepair = automationHost({
  initialState: approvedState(),
  checkPages: [selfSiblingPage({ repair: priorRepairSibling({ id: 'current-run-repair', runId: READY_RUN_ID }) })],
})
const currentRunRepairResult = await executeReadyForReviewProgressionV1({ event: readyEvent(), host: currentRunRepair.host, runId: READY_RUN_ID })
check(currentRunRepairResult.reason === 'ready_current_repair_check_present' && !currentRunRepairResult.allowed, 'SGR-06 current-run Repair Executor presence fails closed')

const initialSiblingGate = automationHost({
  initialState: approvedState(),
  mergeableState: 'unstable',
  checkPages: [selfSiblingPage(), readyCheckPage()],
})
const finalSiblingGate = automationHost({
  initialState: approvedState(),
  mergeableState: 'unstable',
  checkPages: [readyCheckPage(), selfSiblingPage()],
})
const initialSiblingGateResult = await evaluateMergeAllowedAutomationV1({ request: selfAwareMergeRequest, admitted: mergeAdmitted, host: initialSiblingGate.host })
const finalSiblingGateResult = await evaluateMergeAllowedAutomationV1({ request: selfAwareMergeRequest, admitted: mergeAdmitted, host: finalSiblingGate.host })
check(initialSiblingGateResult.automation_status === 'MERGE_ALLOWED' && initialSiblingGate.metrics.threadReads === 1, 'SGR-07 Merge Gate initial snapshot excludes the prior self sibling')
check(finalSiblingGateResult.automation_status === 'MERGE_ALLOWED' && finalSiblingGate.metrics.checkReads === 2, 'SGR-08 Merge Gate final snapshot excludes the prior self sibling')
check(!skippedSiblingLifecycleResult.allowed && skippedSiblingLifecycleResult.next_action === 'PRODUCT_OWNER_IMPLEMENTATION_LEAD' && skippedSiblingLifecycle.metrics.checkReads === 3, 'SGR-09 one positive traverses Ready-wait and both Merge Gate snapshots')

const lateSharedFailure = automationHost({
  initialState: approvedState(),
  mergeableState: 'unstable',
  checkPages: [
    selfSiblingPage(),
    selfSiblingPage(),
    selfSiblingPage({ external: { ...successfulCheck('late-shared-failure'), conclusion: 'FAILURE' } }),
  ],
})
const lateSharedPending = automationHost({
  initialState: approvedState(),
  mergeableState: 'unstable',
  checkPages: [
    selfSiblingPage(),
    selfSiblingPage(),
    selfSiblingPage({ external: { ...successfulCheck('late-shared-pending'), status: 'IN_PROGRESS', conclusion: null } }),
  ],
})
const lateSharedFailureResult = await executeReadyForReviewProgressionV1({ event: readyEvent(), host: lateSharedFailure.host, runId: READY_RUN_ID })
const lateSharedPendingResult = await executeReadyForReviewProgressionV1({ event: readyEvent(), host: lateSharedPending.host, runId: READY_RUN_ID })
check(lateSharedFailureResult.reason === 'checks_not_successful' && lateSharedFailure.metrics.checkReads === 3, 'SGR-10 newly failed external final-snapshot check blocks')
check(lateSharedPendingResult.reason === 'checks_not_terminal' && lateSharedPending.metrics.checkReads === 3, 'SGR-11 newly pending external final-snapshot check blocks')

const currentGenerationCorrectionPaths = execFileSync('git', ['diff', '--name-only', CURRENT_GENERATION_REDUCER_BASE, HOST_ACQUISITION_PREFLIGHT_BASE], { cwd: repositoryRoot, encoding: 'utf8' }).trim().split(/\r?\n/).filter(Boolean)
check(
  currentGenerationCorrectionPaths.join('\n') === ['scripts/run-protected-transition-admission-v1.mjs', 'scripts/test-protected-transition-admission-v1.mjs'].join('\n') &&
  taskChangedPaths.join('\n') === ['.github/workflows/protected-transition-admission-v1.yml', 'scripts/run-protected-transition-admission-v1.mjs', 'scripts/test-protected-transition-admission-v1.mjs'].join('\n') &&
  (runnerSource.match(/const reduceSelfAwareCurrentChecksV1 =/g) ?? []).length === 1 &&
  (runnerSource.match(/reduceSelfAwareCurrentChecksV1\(/g) ?? []).length === 3 &&
  (runnerSource.match(/partitionReadyRunChecksV1\(/g) ?? []).length === 2 &&
  runnerSource.includes("const REVIEW_DETACHED_SELF_CHECK_CONTEXT_V1 = 'DETACHED_SELF_CHECK_AWARE'") &&
  (runnerSource.match(/runId: process\.env\.GITHUB_RUN_ID/g) ?? []).length === 2,
  'SGR-12 shared-helper use and correction/cumulative allowlists hold without duplicate sibling filters',
)

// Four fresh-admission binding repair units x three assertions = 12.
const revokedArchitectureGate = automationHost({
  initialState: state({ architecture_status: 'NOT_APPROVED', review_status: 'APPROVE', reviewed_head: HEAD, review_blocker_count: 0 }),
})
const revokedArchitectureResult = await evaluateMergeAllowedAutomationV1({ request: mergeRequest, admitted: mergeAdmitted, host: revokedArchitectureGate.host })
check(revokedArchitectureResult.state === 'ARCHITECTURE_BLOCKED' && revokedArchitectureResult.reason === 'architecture_not_approved', 'fresh Architecture revocation blocks stale admission reuse')
check(revokedArchitectureResult.allowed === false && revokedArchitectureResult.next_action === 'STOP', 'fresh Architecture revocation cannot advance')
check(revokedArchitectureGate.metrics.checkReads === 0 && revokedArchitectureGate.metrics.threadReads === 0, 'fresh Architecture revocation stops before terminal acquisition')

const revokedImplementationGate = automationHost({
  initialState: state({ implementation_authorized: false, review_status: 'APPROVE', reviewed_head: HEAD, review_blocker_count: 0 }),
})
const revokedImplementationResult = await evaluateMergeAllowedAutomationV1({ request: mergeRequest, admitted: mergeAdmitted, host: revokedImplementationGate.host })
check(revokedImplementationResult.state === 'IMPLEMENTATION_BLOCKED' && revokedImplementationResult.reason === 'implementation_not_authorized', 'fresh implementation revocation blocks stale admission reuse')
check(revokedImplementationResult.allowed === false && revokedImplementationResult.next_action === 'STOP', 'fresh implementation revocation cannot advance')
check(revokedImplementationGate.metrics.checkReads === 0 && revokedImplementationGate.metrics.threadReads === 0, 'fresh implementation revocation stops before terminal acquisition')

const narrowedScopeGate = automationHost({
  initialState: state({ authorized_paths: [ALLOWED[0]], review_status: 'APPROVE', reviewed_head: HEAD, review_blocker_count: 0 }),
  changedFiles: 1,
  filePages: [[{ filename: ALLOWED[1], status: 'modified' }]],
})
const narrowedScopeResult = await evaluateMergeAllowedAutomationV1({ request: mergeRequest, admitted: mergeAdmitted, host: narrowedScopeGate.host })
check(narrowedScopeResult.state === 'IMPLEMENTATION_BLOCKED' && narrowedScopeResult.reason === 'scope_outside_authorized_paths', 'fresh authorized-path narrowing blocks stale admission reuse')
check(narrowedScopeResult.allowed === false && narrowedScopeResult.out_of_scope_paths.join(',') === ALLOWED[1], 'fresh scope revocation reports the current out-of-scope path')
check(narrowedScopeGate.metrics.checkReads === 0 && narrowedScopeGate.metrics.threadReads === 0, 'fresh scope revocation stops before terminal acquisition')

const postAdmissionStateDriftGate = automationHost({
  initialState: approvedState(),
  bodyAtPullRead: {
    2: stateBlock(state({ authorized_paths: [...ALLOWED, 'docs/extra.md'], review_status: 'APPROVE', reviewed_head: HEAD, review_blocker_count: 0 })),
  },
})
const postAdmissionStateDriftResult = await evaluateMergeAllowedAutomationV1({ request: mergeRequest, admitted: mergeAdmitted, host: postAdmissionStateDriftGate.host })
check(postAdmissionStateDriftResult.state === 'INDETERMINATE' && postAdmissionStateDriftResult.reason === 'state_changed_after_fresh_admission', 'state drift after fresh admission fails closed')
check(postAdmissionStateDriftResult.allowed === false && postAdmissionStateDriftResult.next_action === 'STOP', 'post-admission state drift cannot advance')
check(postAdmissionStateDriftGate.metrics.checkReads === 0 && postAdmissionStateDriftGate.metrics.threadReads === 0, 'post-admission state drift stops before terminal acquisition')

const REPAIR_PATHS = Object.freeze([
  '.github/workflows/protected-transition-admission-v1.yml',
  'scripts/run-protected-transition-admission-v1.mjs',
  'scripts/test-protected-transition-admission-v1.mjs',
])
const repairDispatch = (overrides = {}) => Object.freeze({
  repository: REPOSITORY,
  task_issue_number: TASK,
  pr_number: PR,
  exact_head: HEAD,
  review_decision_url: `https://github.com/${REPOSITORY}/issues/${TASK}#issuecomment-9002`,
  review_body: 'current blocking findings',
  authorized_paths: [...REPAIR_PATHS],
  next_action: 'REPAIR_EXECUTOR',
  instruction: 'Generate and apply the minimum repair for current blocking findings only within current authorized_paths; stop on an Architecture gap.',
  ...overrides,
})
const expectedRepairPromptFor = (dispatch = repairDispatch()) => `${dispatch.instruction}\nUse Codex native file read only for current authorized_paths, then generate and apply the minimum authorized repair with apply_patch only. Do not use shell execution, network, repository discovery outside authorized_paths, git, pwsh, gh, validation, test, build, stage, commit, push, mutate PR/state, or redesign Architecture; leave a non-empty unstaged diff and stop on an Architecture gap.\n\nReviewed exact HEAD:\n${dispatch.exact_head}\n\nCurrent authorized_paths:\n${JSON.stringify([...dispatch.authorized_paths].sort())}\n\nCurrent blocking finding:\n${dispatch.review_body}`
const expectedRepairPrompt = expectedRepairPromptFor()
const repairTaskState = (overrides = {}) => state({
  authorized_paths: [...REPAIR_PATHS],
  review_status: 'CHANGES_REQUIRED',
  reviewed_head: HEAD,
  review_blocker_count: 1,
  ...overrides,
})
const repairPull = ({ head = HEAD, headRepository = REPOSITORY, headRef = 'codex/repair', paths = REPAIR_PATHS, body = stateBlock(repairTaskState()) } = {}) => ({
  number: PR,
  state: 'open',
  base: { repo: { full_name: REPOSITORY } },
  head: { sha: head, ref: headRef, repo: { full_name: headRepository } },
  body,
  changed_files: paths.length,
})
const repairHost = ({ head = HEAD, heads = [head], remoteHead = head, headRepository = REPOSITORY, paths = REPAIR_PATHS, body = stateBlock(repairTaskState()) } = {}) => {
  const metrics = { pullReads: 0, fileReads: 0, branchReads: 0, patches: 0, waitCalls: 0 }
  let currentBody = body
  let pullIndex = 0
  const host = {
    api: async (endpoint, options) => {
      if (endpoint === `repos/${REPOSITORY}/pulls/${PR}`) {
        if (options?.method === 'PATCH') {
          metrics.patches += 1
          currentBody = options.body.body
        } else {
          metrics.pullReads += 1
          pullIndex += 1
        }
        return repairPull({ head: heads[Math.min(Math.max(pullIndex - 1, 0), heads.length - 1)], headRepository, paths, body: currentBody })
      }
      if (endpoint.includes(`/pulls/${PR}/files?`)) {
        metrics.fileReads += 1
        const page = Number(new URL(`https://api.github.com/${endpoint}`).searchParams.get('page'))
        return page === 1 ? paths.map((filename) => ({ filename, status: 'modified' })) : []
      }
      throw new Error(`unexpected repair endpoint: ${endpoint}`)
    },
    branchHead: async () => {
      metrics.branchReads += 1
      return remoteHead
    },
    wait: async () => { metrics.waitCalls += 1 },
  }
  return Object.freeze({ host, metrics, currentBody: () => currentBody })
}

const validRepair = repairHost()
const preflightResult = await executeRepairExecutorV1({ phase: 'preflight', dispatch: repairDispatch(), host: validRepair.host })
const approveNoRepair = evaluateProgressionControllerV1(progressionResult(), progressionContext({ review: repairReview({ decision: 'APPROVE', blocking_finding_count: 0, remaining_finding_count: 0 }) }))
const staleRepair = repairHost({ head: OTHER_HEAD })
const staleRepairResult = await executeRepairExecutorV1({ phase: 'preflight', dispatch: repairDispatch(), host: staleRepair.host })
const unknownNoRepair = evaluateProgressionControllerV1(progressionResult(), progressionContext({ review: repairReview({ unknown_count: 1 }) }))
const overflowRepair = repairHost({ paths: [...REPAIR_PATHS, 'outside.ts'] })
const overflowRepairResult = await executeRepairExecutorV1({ phase: 'preflight', dispatch: repairDispatch(), host: overflowRepair.host })
const forkRepair = repairHost({ headRepository: 'fork/repository' })
const forkRepairResult = await executeRepairExecutorV1({ phase: 'preflight', dispatch: repairDispatch(), host: forkRepair.host })
const docsProfile = selectRepairValidationProfileV1({
  authorizedPaths: ['docs/a.md'],
  currentPaths: ['docs/a.md'],
  repairPaths: ['docs/a.md'],
})
const controls = ['\t', '\n', '\r', String.fromCodePoint(0x1F), String.fromCodePoint(0x7F)]
const controlMatrixRejected = controls.every((control) =>
  ['authorizedPaths', 'currentPaths', 'repairPaths'].every((position) => {
    const values = { authorizedPaths: ['docs/a.md'], currentPaths: ['docs/a.md'], repairPaths: ['docs/a.md'] }
    values[position] = [`docs/a${control}.md`]
    return selectRepairValidationProfileV1(values).reason === 'repair_validation_profile_architecture_gap'
  }))
const protectedProfile = selectRepairValidationProfileV1({
  authorizedPaths: REPAIR_PATHS,
  currentPaths: REPAIR_PATHS,
  repairPaths: REPAIR_PATHS,
})
const protectedNearName = selectRepairValidationProfileV1({
  authorizedPaths: [...REPAIR_PATHS, 'scripts/test-protected-transition-admission-v1.mjs.bak'],
  currentPaths: REPAIR_PATHS,
  repairPaths: REPAIR_PATHS,
})
const zeroProfile = selectRepairValidationProfileV1({ authorizedPaths: [], currentPaths: [], repairPaths: [] })
const mixedProfile = selectRepairValidationProfileV1({
  authorizedPaths: ['docs/a.md', REPAIR_PATHS[0]],
  currentPaths: ['docs/a.md'],
  repairPaths: ['docs/a.md'],
})
const duplicateProfile = selectRepairValidationProfileV1({
  authorizedPaths: [REPAIR_PATHS[0], REPAIR_PATHS[0]],
  currentPaths: [REPAIR_PATHS[0]],
  repairPaths: [REPAIR_PATHS[0]],
})
const postAgentAllowedHost = repairHost()
const postAgentAllowed = await executeRepairExecutorV1({
  phase: 'post_agent',
  dispatch: repairDispatch(),
  providerResult: { status: 'completed', summary: 'repaired current findings' },
  repairPaths: REPAIR_PATHS,
  host: postAgentAllowedHost.host,
})
const postAgentEscapeHost = repairHost()
const postAgentEscape = await executeRepairExecutorV1({
  phase: 'post_agent',
  dispatch: repairDispatch(),
  providerResult: { status: 'completed', summary: 'repaired current findings' },
  repairPaths: [...REPAIR_PATHS, 'outside.ts'],
  host: postAgentEscapeHost.host,
})
const postAgentEmptyHost = repairHost()
const postAgentEmpty = await executeRepairExecutorV1({
  phase: 'post_agent',
  dispatch: repairDispatch(),
  providerResult: { status: 'completed', summary: 'no change' },
  repairPaths: [],
  host: postAgentEmptyHost.host,
})
const malformedProviderHost = repairHost()
const malformedProvider = await executeRepairExecutorV1({
  phase: 'post_agent',
  dispatch: repairDispatch(),
  providerResult: { status: 'failed', summary: '' },
  repairPaths: REPAIR_PATHS,
  host: malformedProviderHost.host,
})
const validationFailureHost = repairHost()
const validationFailure = await executeRepairExecutorV1({
  phase: 'commit_plan', dispatch: repairDispatch(), repairPaths: REPAIR_PATHS, validationSucceeded: false, host: validationFailureHost.host,
})
const commitHeadDriftHost = repairHost({ head: OTHER_HEAD })
const commitHeadDrift = await executeRepairExecutorV1({
  phase: 'commit_plan', dispatch: repairDispatch(), repairPaths: REPAIR_PATHS, validationSucceeded: true, host: commitHeadDriftHost.host,
})
const localHeadCommands = []
const localHeadDriftError = await errorOf(async () => repairWorkingTreePathsV1(HEAD, (args) => {
  localHeadCommands.push(args.join(' '))
  if (args[0] === 'rev-parse') return `${OTHER_HEAD}\n`
  throw new Error('downstream_git_command_reached')
}))
const remoteDriftHost = repairHost({ remoteHead: OTHER_HEAD })
const remoteDrift = await executeRepairExecutorV1({
  phase: 'commit_plan', dispatch: repairDispatch(), repairPaths: REPAIR_PATHS, validationSucceeded: true, host: remoteDriftHost.host,
})
const commitPlanHost = repairHost()
const commitPlan = await executeRepairExecutorV1({
  phase: 'commit_plan', dispatch: repairDispatch(), repairPaths: REPAIR_PATHS, validationSucceeded: true, host: commitPlanHost.host,
})
const completedHost = repairHost({
  head: OTHER_HEAD,
  remoteHead: OTHER_HEAD,
  body: stateBlock(repairTaskState()),
})
const completedRepair = await executeRepairExecutorV1({
  phase: 'complete',
  dispatch: repairDispatch(),
  newHead: OTHER_HEAD,
  repairPaths: REPAIR_PATHS,
  validationProfile: 'protected_transition',
  headRef: 'codex/repair',
  host: completedHost.host,
})
const reboundState = extractProtectedTransitionTaskStateV1(completedHost.currentBody())
const completedRepairRetry = await executeRepairExecutorV1({
  phase: 'complete',
  dispatch: repairDispatch(),
  newHead: OTHER_HEAD,
  repairPaths: REPAIR_PATHS,
  validationProfile: 'protected_transition',
  headRef: 'codex/repair',
  host: completedHost.host,
})
const convergingRepairHost = repairHost({
  heads: [HEAD, OTHER_HEAD],
  remoteHead: OTHER_HEAD,
  body: stateBlock(repairTaskState()),
})
const convergingRepair = await executeRepairExecutorV1({
  phase: 'complete',
  dispatch: repairDispatch(),
  newHead: OTHER_HEAD,
  repairPaths: REPAIR_PATHS,
  validationProfile: 'protected_transition',
  headRef: 'codex/repair',
  host: convergingRepairHost.host,
})
const exhaustedRepairHost = repairHost({
  heads: [HEAD, HEAD, HEAD],
  remoteHead: OTHER_HEAD,
  body: stateBlock(repairTaskState()),
})
const exhaustedRepair = await executeRepairExecutorV1({
  phase: 'complete',
  dispatch: repairDispatch(),
  newHead: OTHER_HEAD,
  repairPaths: REPAIR_PATHS,
  validationProfile: 'protected_transition',
  headRef: 'codex/repair',
  host: exhaustedRepairHost.host,
})
const unexpectedRepairHost = repairHost({
  heads: [HEAD, 'c'.repeat(40)],
  remoteHead: OTHER_HEAD,
  body: stateBlock(repairTaskState()),
})
const unexpectedRepair = await executeRepairExecutorV1({
  phase: 'complete',
  dispatch: repairDispatch(),
  newHead: OTHER_HEAD,
  repairPaths: REPAIR_PATHS,
  validationProfile: 'protected_transition',
  headRef: 'codex/repair',
  host: unexpectedRepairHost.host,
})
// Twenty-three fixed Repair Executor units x three assertions = 69.
const repairUnits = [
  { name: 'current CHANGES_REQUIRED dispatch', result: preflightResult, reason: 'repair_preflight_satisfied', next: 'REPAIR_AGENT', evidence: (value) => value.validation_profile === 'protected_transition' && value.prompt === expectedRepairPrompt },
  { name: 'APPROVE does not repair', result: approveNoRepair, reason: 'review_not_approved', next: 'STOP', evidence: (value) => !('repair_dispatch' in value) },
  { name: 'stale HEAD', result: staleRepairResult, reason: 'repair_pull_binding_invalid', next: 'STOP', evidence: () => staleRepair.metrics.fileReads === 0 },
  { name: 'UNKNOWN review', result: unknownNoRepair, reason: 'repair_review_unknown', next: 'STOP', evidence: (value) => !('repair_dispatch' in value) },
  { name: 'current PR scope overflow', result: overflowRepairResult, reason: 'repair_validation_profile_architecture_gap', next: 'STOP', evidence: () => overflowRepair.metrics.branchReads === 0 },
  { name: 'fork PR', result: forkRepairResult, reason: 'repair_pull_binding_invalid', next: 'STOP', evidence: () => forkRepair.metrics.fileReads === 0 },
  { name: 'docs profile and control matrix', result: docsProfile, reason: undefined, next: undefined, evidence: (value) => value.name === 'docs_only' && value.commands.join('|') === 'node scripts/test-role-execution-contracts.mjs|git diff --check' && controlMatrixRejected },
  { name: 'protected profile and near-name rejection', result: protectedProfile, reason: undefined, next: undefined, evidence: (value) => value.name === 'protected_transition' && value.commands.length === 6 && protectedNearName.next_action === 'STOP' && REPAIR_PATHS.every(isRepairProfilePathV1) },
  { name: 'zero or mixed profile', result: zeroProfile, reason: 'repair_validation_profile_architecture_gap', next: 'STOP', evidence: () => mixedProfile.reason === 'repair_validation_profile_architecture_gap' },
  { name: 'duplicate tuple and handoff convergence', result: duplicateProfile, reason: 'repair_validation_profile_architecture_gap', next: 'STOP', evidence: (value) => value.detail === 'authorized_paths_duplicate' && completedRepairRetry.reason === completedRepair.reason && completedRepairRetry.current_head === completedRepair.current_head },
  { name: 'allowed post-agent diff', result: postAgentAllowed, reason: 'repair_post_agent_satisfied', next: 'VALIDATE_REPAIR', evidence: (value) => value.repair_paths.join('|') === [...REPAIR_PATHS].sort().join('|') },
  { name: 'post-agent scope escape', result: postAgentEscape, reason: 'repair_validation_profile_architecture_gap', next: 'STOP', evidence: () => postAgentEscapeHost.metrics.branchReads === 0 },
  { name: 'empty post-agent diff', result: postAgentEmpty, reason: 'repair_validation_profile_architecture_gap', next: 'STOP', evidence: (value) => value.detail === 'repair_paths_invalid' },
  { name: 'malformed provider result', result: malformedProvider, reason: 'repair_provider_result_invalid', next: 'STOP', evidence: () => malformedProviderHost.metrics.pullReads === 0 },
  { name: 'focused validation failure', result: validationFailure, reason: 'repair_validation_failed', next: 'STOP', evidence: () => validationFailureHost.metrics.pullReads === 0 },
  { name: 'PR or local HEAD drift before commit', result: commitHeadDrift, reason: 'repair_pull_binding_invalid', next: 'STOP', evidence: () => commitHeadDriftHost.metrics.branchReads === 0 && localHeadDriftError?.message === 'repair_worktree_head_changed' && localHeadCommands.join('|') === 'rev-parse --verify HEAD' && runnerSource.split('repairWorkingTreePathsV1(readJsonFileV1(invocation.dispatchFile).exact_head)').length === 4 },
  { name: 'remote branch drift before push', result: remoteDrift, reason: 'repair_remote_head_changed', next: 'STOP', evidence: () => remoteDriftHost.metrics.branchReads === 1 },
  { name: 'one normal commit plan', result: commitPlan, reason: 'repair_commit_plan_satisfied', next: 'COMMIT_AND_PUSH', evidence: (value) => value.commit_count === 1 && value.force === false && !workflowSource.includes('openai/codex-action') && !workflowSource.includes('OPENAI_API_KEY') },
  { name: 'post-push exact HEAD', result: completedRepair, reason: 'fresh_review_required', next: 'REVIEW', evidence: (value) => value.current_head === OTHER_HEAD && value.validation_profile === 'protected_transition' && completedHost.metrics.branchReads === 2 },
  { name: 'PENDING rebind and fresh review handoff', result: completedRepair, reason: 'fresh_review_required', next: 'REVIEW', evidence: (value) => value.automation_status === 'HANDOFF_READY' && value.repair_paths.length === 3 && reboundState.observed_head === OTHER_HEAD && reboundState.review_status === 'PENDING' && reboundState.reviewed_head === null && reboundState.review_blocker_count === null && completedHost.metrics.patches === 1 },
  { name: 'post-push old-to-new HEAD convergence', result: convergingRepair, reason: 'fresh_review_required', next: 'REVIEW', evidence: (value) => value.current_head === OTHER_HEAD && convergingRepairHost.metrics.pullReads === 5 && convergingRepairHost.metrics.waitCalls === 1 && convergingRepairHost.metrics.patches === 1 },
  { name: 'post-push old HEAD exhaustion', result: exhaustedRepair, reason: 'repair_pull_binding_invalid', next: 'STOP', evidence: () => exhaustedRepairHost.metrics.pullReads === 3 && exhaustedRepairHost.metrics.waitCalls === 2 && exhaustedRepairHost.metrics.fileReads === 0 && exhaustedRepairHost.metrics.branchReads === 0 && exhaustedRepairHost.metrics.patches === 0 },
  { name: 'post-push unexpected third HEAD', result: unexpectedRepair, reason: 'repair_pull_binding_invalid', next: 'STOP', evidence: () => unexpectedRepairHost.metrics.pullReads === 2 && unexpectedRepairHost.metrics.waitCalls === 1 && unexpectedRepairHost.metrics.fileReads === 0 && unexpectedRepairHost.metrics.branchReads === 0 && unexpectedRepairHost.metrics.patches === 0 },
]
for (const unit of repairUnits) {
  check(unit.result.reason === unit.reason, `${unit.name} reason`)
  check(unit.result.next_action === unit.next, `${unit.name} next action`)
  check(unit.evidence(unit.result), `${unit.name} exact evidence`)
}

const WINDOWS_WORKSPACE = 'C:\\actions-runner\\_work\\sd-prompt-studio\\sd-prompt-studio'
const authorizedFileByteSizes = REPAIR_PATHS.map((repositoryPath) =>
  readFileSync(path.resolve(repositoryRoot, ...repositoryPath.split('/'))).byteLength)
const providerExecHost = repairHost()
const providerExec = await executeRepairProviderBindingV3({
  boundary: 'pre_exec',
  dispatch: repairDispatch(),
  host: providerExecHost.host,
  localPaths: [],
  cliVersion: 'codex-cli 0.147.0',
  loginStatus: 'Logged in using ChatGPT',
  runAttempt: 1,
  workspacePath: WINDOWS_WORKSPACE,
})
const metadataPromptSeed = expectedRepairPromptFor(repairDispatch({ review_body: 'x' }))
const metadataCapPadding = 16_384 - Buffer.byteLength(metadataPromptSeed, 'utf8')
const capBoundaryHost = repairHost()
const capBoundaryPrompt = await executeRepairProviderBindingV3({
  boundary: 'pre_exec', dispatch: repairDispatch({ review_body: 'x'.repeat(metadataCapPadding + 1) }), host: capBoundaryHost.host, localPaths: [], cliVersion: 'codex-cli 0.147.0', loginStatus: 'Logged in using ChatGPT', runAttempt: 1, workspacePath: WINDOWS_WORKSPACE,
})
const oversizedPromptHost = repairHost()
const oversizedPrompt = await executeRepairProviderBindingV3({
  boundary: 'pre_exec', dispatch: repairDispatch({ review_body: 'x'.repeat(metadataCapPadding + 2) }), host: oversizedPromptHost.host, localPaths: [], cliVersion: 'codex-cli 0.147.0', loginStatus: 'Logged in using ChatGPT', runAttempt: 1, workspacePath: WINDOWS_WORKSPACE,
})
const providerProjectionInput = {
  providerBranch: 'codex/repair',
  prompt: 'current repair',
  cliVersion: 'codex-cli 0.147.0',
  loginStatus: 'Logged in using ChatGPT',
  runAttempt: 1,
  workspacePath: WINDOWS_WORKSPACE,
}
const missingCliError = await errorOf(async () => projectSelfHostedWindowsRepairProviderV3({ ...providerProjectionInput, cliVersion: undefined }))
const wrongCliError = await errorOf(async () => projectSelfHostedWindowsRepairProviderV3({ ...providerProjectionInput, cliVersion: 'codex-cli 0.148.0' }))
const apiLoginError = await errorOf(async () => projectSelfHostedWindowsRepairProviderV3({ ...providerProjectionInput, loginStatus: 'Logged in using an API key' }))
const providerRemoteDriftHost = repairHost({ remoteHead: OTHER_HEAD })
const providerRemoteDrift = await executeRepairProviderBindingV3({
  boundary: 'pre_exec', dispatch: repairDispatch(), host: providerRemoteDriftHost.host, localPaths: [], cliVersion: 'codex-cli 0.147.0', loginStatus: 'Logged in using ChatGPT', runAttempt: 1, workspacePath: WINDOWS_WORKSPACE,
})
const providerDirtyHost = repairHost()
const providerDirty = await executeRepairProviderBindingV3({
  boundary: 'pre_exec', dispatch: repairDispatch(), host: providerDirtyHost.host, localPaths: [REPAIR_PATHS[0]], cliVersion: 'codex-cli 0.147.0', loginStatus: 'Logged in using ChatGPT', runAttempt: 1, workspacePath: WINDOWS_WORKSPACE,
})
const providerPullDriftHost = repairHost({ head: OTHER_HEAD })
const providerPullDrift = await executeRepairProviderBindingV3({
  boundary: 'pre_exec', dispatch: repairDispatch(), host: providerPullDriftHost.host, localPaths: [], cliVersion: 'codex-cli 0.147.0', loginStatus: 'Logged in using ChatGPT', runAttempt: 1, workspacePath: WINDOWS_WORKSPACE,
})
const rerunProviderHost = repairHost()
const rerunProvider = await executeRepairProviderBindingV3({
  boundary: 'pre_exec', dispatch: repairDispatch(), host: rerunProviderHost.host, localPaths: [], cliVersion: 'codex-cli 0.147.0', loginStatus: 'Logged in using ChatGPT', runAttempt: 2, workspacePath: WINDOWS_WORKSPACE,
})
const providerPostBranchHost = repairHost()
const providerPostBranchDrift = await executeRepairProviderBindingV3({
  boundary: 'post_exec', dispatch: repairDispatch(), host: providerPostBranchHost.host, providerBranch: 'codex/stale', localPaths: REPAIR_PATHS,
})
const providerPostEmptyHost = repairHost()
const providerPostEmpty = await executeRepairProviderBindingV3({
  boundary: 'post_exec', dispatch: repairDispatch(), host: providerPostEmptyHost.host, providerBranch: 'codex/repair', localPaths: [],
})
const providerPostRemoteHost = repairHost({ remoteHead: OTHER_HEAD })
const providerPostRemote = await executeRepairProviderBindingV3({
  boundary: 'post_exec', dispatch: repairDispatch(), host: providerPostRemoteHost.host, providerBranch: 'codex/repair', localPaths: REPAIR_PATHS,
})
const providerPostHost = repairHost()
const providerPost = await executeRepairProviderBindingV3({
  boundary: 'post_exec', dispatch: repairDispatch(), host: providerPostHost.host, providerBranch: 'codex/repair', localPaths: REPAIR_PATHS,
})
const repairJob = workflow.jobs.protected_transition_repair_executor_v1
const repairRunSteps = repairJob.steps.filter((step) => typeof step.run === 'string')
const repairRunSource = repairRunSteps.map((step) => step.run).join('\n')
const repairStepByName = new Map(repairRunSteps.map((step) => [step.name, step]))
const hostRunnerStep = repairJob.steps.find((step) => step.name === 'Materialize exact protected-transition host runner')
const hostRunnerRun = hostRunnerStep?.run ?? ''
const powershellMajorGuard = "if ($PSVersionTable.PSVersion.Major -ne 7) { throw 'repair_powershell_major_invalid' }"
const providerExecutionStep = repairJob.steps.find((step) => step.name === 'Execute one local blocking repair')
const providerProbeStep = repairJob.steps.find((step) => step.name === 'Preflight exact Repair Executor environment')
const providerProbeRun = providerProbeStep?.run ?? ''
const providerPostExecStep = repairJob.steps.find((step) => step.name === 'Rebind reviewed HEAD and project local provider completion')
const providerPostExecRun = providerPostExecStep?.run ?? ''
const providerPostAgentStep = repairJob.steps.find((step) => step.name === 'Rebind repair paths and validation profile')
const providerPostAgentRun = providerPostAgentStep?.run ?? ''
const providerCommitPlanStep = repairJob.steps.find((step) => step.name === 'Recheck current HEAD and prepare one commit')
const providerCommitPlanRun = providerCommitPlanStep?.run ?? ''
const repairResultStep = repairJob.steps.find((step) => step.name === 'Rebind existing state and hand off fresh review')
const repairResultRun = repairResultStep?.run ?? ''
const extractNativeHelper = (source) => {
  const start = source.indexOf('function Invoke-NativeSeparated {')
  const ends = [source.indexOf('\n}\n\nfunction Invoke-RepairPushPreflight', start), source.indexOf('\n}\n\n$gitCommand', start)].filter((index) => index > start)
  const end = ends.length > 0 ? Math.min(...ends) : -1
  return start >= 0 && end > start ? source.slice(start, end + 2) : ''
}
const nativeHelperSources = [hostRunnerRun, providerProbeRun].map(extractNativeHelper)
const nativeExitProbes = process.platform === 'win32' ? nativeHelperSources.map((helperSource, index) => {
  const failure = `native_probe_failure_${index}`
  const script = `
$ErrorActionPreference = 'Stop'
$env:RUNNER_TEMP = [IO.Path]::GetTempPath()
${helperSource}
$nodeCommand = (Get-Command node.exe -ErrorAction Stop).Source
$successAccepted = $false
try {
  $null = Invoke-NativeSeparated -Command $nodeCommand -Arguments @('-e', 'process.exit(0)') -Failure 'native_probe_success_rejected' -SuppressOutput
  $successAccepted = $true
} catch {
  $successAccepted = $false
}
$nonzeroFailure = $null
try {
  $null = Invoke-NativeSeparated -Command $nodeCommand -Arguments @('-e', 'process.exit(7)') -Failure '${failure}' -SuppressOutput
} catch {
  $nonzeroFailure = $_.Exception.Message
}
[Console]::Out.Write((@{ successAccepted = $successAccepted; nonzeroFailure = $nonzeroFailure } | ConvertTo-Json -Compress))
`
  return JSON.parse(execFileSync('pwsh.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8' }))
}) : null
const loginStatusStreamProbe = process.platform === 'win32' ? (() => {
  const script = `
$ErrorActionPreference = 'Stop'
$env:RUNNER_TEMP = [IO.Path]::GetTempPath()
${nativeHelperSources[1]}
$nodeCommand = (Get-Command node.exe -ErrorAction Stop).Source
$arguments = @('-e', 'process.stdout.write("stdout-contract"); process.stderr.write("Logged in using ChatGPT")')
$stdoutSelected = ((Invoke-NativeSeparated -Command $nodeCommand -Arguments $arguments -Failure 'login_stream_probe_failed' -SuppressOutput) -join [Environment]::NewLine).Trim()
$stderrSelected = ((Invoke-NativeSeparated -Command $nodeCommand -Arguments $arguments -Failure 'login_stream_probe_failed' -SuppressOutput -ReturnStream 'stderr') -join [Environment]::NewLine).Trim()
[Console]::Out.Write((@{ stdoutSelected = $stdoutSelected; stderrSelected = $stderrSelected } | ConvertTo-Json -Compress))
`
  return JSON.parse(execFileSync('pwsh.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8' }))
})() : null
const postExecStreamSeparationProbe = process.platform === 'win32' ? (() => {
  const script = `
$ErrorActionPreference = 'Stop'
$utf8NoBom = [Text.UTF8Encoding]::new($false)
$stdoutPath = Join-Path ([IO.Path]::GetTempPath()) (([guid]::NewGuid().ToString('N')) + '.stdout.json')
$stderrPath = Join-Path ([IO.Path]::GetTempPath()) (([guid]::NewGuid().ToString('N')) + '.stderr.log')
try {
  $LASTEXITCODE = $null
  node -e 'process.stdout.write(JSON.stringify({next_action:"PROJECT_PROVIDER_COMPLETION"})); process.stderr.write("warning: LF will be replaced by CRLF\\n")' 1> $stdoutPath 2> $stderrPath
  $nativeExit = $LASTEXITCODE
  $stdout = [IO.File]::ReadAllText($stdoutPath, $utf8NoBom)
  $stderr = [IO.File]::ReadAllText($stderrPath, $utf8NoBom)
  $parsed = $stdout | ConvertFrom-Json
  $mergedRejected = $false
  try {
    ($stderr + $stdout) | ConvertFrom-Json -ErrorAction Stop | Out-Null
  } catch {
    $mergedRejected = $true
  }
  [Console]::Out.Write((@{
    nativeExit = $nativeExit
    nextAction = $parsed.next_action
    stderrWarning = $stderr.Trim()
    mergedRejected = $mergedRejected
  } | ConvertTo-Json -Compress))
} finally {
  Remove-Item -LiteralPath $stdoutPath -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $stderrPath -Force -ErrorAction SilentlyContinue
}
`
  return JSON.parse(execFileSync('pwsh.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8' }))
})() : null
const postAgentStreamSeparationProbe = process.platform === 'win32' ? (() => {
  const script = `
$ErrorActionPreference = 'Stop'
$utf8NoBom = [Text.UTF8Encoding]::new($false)
$stdoutPath = Join-Path ([IO.Path]::GetTempPath()) (([guid]::NewGuid().ToString('N')) + '.stdout.json')
$stderrPath = Join-Path ([IO.Path]::GetTempPath()) (([guid]::NewGuid().ToString('N')) + '.stderr.log')
try {
  $LASTEXITCODE = $null
  node -e 'process.stdout.write(JSON.stringify({next_action:"VALIDATE_REPAIR",validation_profile:"docs_only"})); process.stderr.write("warning: LF will be replaced by CRLF\\n")' 1> $stdoutPath 2> $stderrPath
  $nativeExit = $LASTEXITCODE
  $stdout = [IO.File]::ReadAllText($stdoutPath, $utf8NoBom)
  $stderr = [IO.File]::ReadAllText($stderrPath, $utf8NoBom)
  $parsed = $stdout | ConvertFrom-Json
  $mergedRejected = $false
  try {
    ($stderr + $stdout) | ConvertFrom-Json -ErrorAction Stop | Out-Null
  } catch {
    $mergedRejected = $true
  }
  [Console]::Out.Write((@{
    nativeExit = $nativeExit
    nextAction = $parsed.next_action
    validationProfile = $parsed.validation_profile
    stderrWarning = $stderr.Trim()
    mergedRejected = $mergedRejected
  } | ConvertTo-Json -Compress))
} finally {
  Remove-Item -LiteralPath $stdoutPath -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $stderrPath -Force -ErrorAction SilentlyContinue
}
`
  return JSON.parse(execFileSync('pwsh.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8' }))
})() : null
const commitPlanStreamSeparationProbe = process.platform === 'win32' ? (() => {
  const script = `
$ErrorActionPreference = 'Stop'
$utf8NoBom = [Text.UTF8Encoding]::new($false)
$stdoutPath = Join-Path ([IO.Path]::GetTempPath()) (([guid]::NewGuid().ToString('N')) + '.stdout.json')
$stderrPath = Join-Path ([IO.Path]::GetTempPath()) (([guid]::NewGuid().ToString('N')) + '.stderr.log')
try {
  $LASTEXITCODE = $null
  node -e 'process.stdout.write(JSON.stringify({automation_status:"COMMIT_READY",next_action:"COMMIT_AND_PUSH",force:false,commit_count:1})); process.stderr.write("warning: LF will be replaced by CRLF\\n")' 1> $stdoutPath 2> $stderrPath
  $nativeExit = $LASTEXITCODE
  $stdout = [IO.File]::ReadAllText($stdoutPath, $utf8NoBom)
  $stderr = [IO.File]::ReadAllText($stderrPath, $utf8NoBom)
  $parsed = $stdout | ConvertFrom-Json
  $mergedRejected = $false
  try {
    ($stderr + $stdout) | ConvertFrom-Json -ErrorAction Stop | Out-Null
  } catch {
    $mergedRejected = $true
  }
  [Console]::Out.Write((@{
    nativeExit = $nativeExit
    automationStatus = $parsed.automation_status
    nextAction = $parsed.next_action
    force = $parsed.force
    commitCount = $parsed.commit_count
    stderrWarning = $stderr.Trim()
    mergedRejected = $mergedRejected
  } | ConvertTo-Json -Compress))
} finally {
  Remove-Item -LiteralPath $stdoutPath -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $stderrPath -Force -ErrorAction SilentlyContinue
}
`
  return JSON.parse(execFileSync('pwsh.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8' }))
})() : null
const extractRepairPushPreflightHelper = (source) => {
  const start = source.indexOf('function Invoke-RepairPushPreflight {')
  const end = source.indexOf('\n}\n\n$gitCommand', start)
  return start >= 0 && end > start ? source.slice(start, end + 2) : ''
}
const repairPushPreflightHelperSource = extractRepairPushPreflightHelper(providerProbeRun)
const repairPushPreflightProbe = process.platform === 'win32' ? (() => {
  const script = `
$ErrorActionPreference = 'Stop'
$probeTemp = Join-Path ([IO.Path]::GetTempPath()) ('repair-push-preflight-probe-' + [Guid]::NewGuid().ToString('N'))
[IO.Directory]::CreateDirectory($probeTemp) | Out-Null
$env:RUNNER_TEMP = $probeTemp
${repairPushPreflightHelperSource}
$nodeCommand = (Get-Command node.exe -ErrorAction Stop).Source
$expectedHead = '${HEAD}'
$otherHead = '${OTHER_HEAD}'
$expectedRef = 'refs/heads/codex/repair'
$script:forceCleanupFailure = $false
$script:forceCleanupProbeFailure = $false
$script:forceDiagnosticProbeFailure = $false

function Remove-Item {
  param([string[]]$LiteralPath, [switch]$Force, [string]$ErrorAction)
  if ($script:forceCleanupFailure) { throw 'simulated_cleanup_failure' }
  Microsoft.PowerShell.Management\\Remove-Item -LiteralPath $LiteralPath -Force:$Force -ErrorAction $ErrorAction
}

function Test-Path {
  param([string]$LiteralPath)
  $exists = Microsoft.PowerShell.Management\\Test-Path -LiteralPath $LiteralPath
  if ($script:forceDiagnosticProbeFailure -and $LiteralPath.EndsWith('.stderr')) { throw 'simulated_diagnostic_probe_failure' }
  if ($script:forceCleanupProbeFailure -and -not $exists) { throw 'simulated_cleanup_probe_failure' }
  return $exists
}

function Invoke-ProbeCase {
  param([string]$Stdout, [string]$Stderr, [int]$ExitCode)
  $stdoutBase64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($Stdout))
  $stderrBase64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($Stderr))
  $nodeScript = "process.stdout.write(Buffer.from('$stdoutBase64','base64')); process.stderr.write(Buffer.from('$stderrBase64','base64')); process.exit($ExitCode)"
  try {
    $result = Invoke-RepairPushPreflight -Command $nodeCommand -Arguments @('-e', $nodeScript) -ExpectedHead $expectedHead -ExpectedRef $expectedRef
    return @{ result = $result; error = $null }
  } catch {
    return @{ result = $null; error = $_.Exception.Message }
  }
}

$exactProjection = $expectedHead + [char]9 + $expectedRef + [Environment]::NewLine
$wrongProjection = $otherHead + [char]9 + $expectedRef + [Environment]::NewLine
$exact = Invoke-ProbeCase -Stdout $exactProjection -Stderr '' -ExitCode 0
$empty = Invoke-ProbeCase -Stdout '' -Stderr '' -ExitCode 0
$multiple = Invoke-ProbeCase -Stdout ($exactProjection + $exactProjection) -Stderr '' -ExitCode 0
$wrong = Invoke-ProbeCase -Stdout $wrongProjection -Stderr '' -ExitCode 0
$auth = Invoke-ProbeCase -Stdout '' -Stderr "fatal: Authentication failed for 'https://github.com/whatrune/sd-prompt-studio.git/'" -ExitCode 128
$authGitCurl = Invoke-ProbeCase -Stdout '' -Stderr 'fatal: unable to access remote: The requested URL returned error: 403' -ExitCode 128
$authPrecedence = Invoke-ProbeCase -Stdout '' -Stderr 'remote rejected; Could not resolve host github.com; Repository not found; Authentication failed' -ExitCode 128
$repoNotFound = Invoke-ProbeCase -Stdout '' -Stderr 'permission denied; Could not resolve host github.com; Repository not found' -ExitCode 128
$repoHttp = Invoke-ProbeCase -Stdout '' -Stderr 'fatal: unable to access remote: The requested URL returned error: 404' -ExitCode 22
$network = Invoke-ProbeCase -Stdout '' -Stderr 'permission denied; Could not resolve host github.com' -ExitCode 7
$networkHttp = Invoke-ProbeCase -Stdout '' -Stderr 'fatal: unable to access remote: The requested URL returned error: 503' -ExitCode 22
$remoteAccess = Invoke-ProbeCase -Stdout '' -Stderr 'fatal: Could not read from remote repository' -ExitCode 128
$other = Invoke-ProbeCase -Stdout '' -Stderr 'fatal: transport unavailable' -ExitCode 9
$exit128 = Invoke-ProbeCase -Stdout '' -Stderr 'fatal: connection reset by peer' -ExitCode 128
$diagnostic = $null
try {
  $script:forceDiagnosticProbeFailure = $true
  $diagnostic = Invoke-ProbeCase -Stdout '' -Stderr 'fatal: transport unavailable' -ExitCode 9
} finally {
  $script:forceDiagnosticProbeFailure = $false
  @(Get-ChildItem -LiteralPath $probeTemp -Filter 'repair-push-preflight-*' -File) | ForEach-Object {
    Microsoft.PowerShell.Management\\Remove-Item -LiteralPath $_.FullName -Force -ErrorAction Stop
  }
}
$cleanupFailure = $null
try {
  $script:forceCleanupFailure = $true
  $cleanupFailure = Invoke-ProbeCase -Stdout '' -Stderr 'fatal: transport unavailable' -ExitCode 9
} finally {
  $script:forceCleanupFailure = $false
  @(Get-ChildItem -LiteralPath $probeTemp -Filter 'repair-push-preflight-*' -File) | ForEach-Object {
    Microsoft.PowerShell.Management\\Remove-Item -LiteralPath $_.FullName -Force -ErrorAction Stop
  }
}
$cleanupProbeFailure = $null
try {
  $script:forceCleanupProbeFailure = $true
  $cleanupProbeFailure = Invoke-ProbeCase -Stdout '' -Stderr 'fatal: transport unavailable' -ExitCode 9
} finally {
  $script:forceCleanupProbeFailure = $false
  @(Get-ChildItem -LiteralPath $probeTemp -Filter 'repair-push-preflight-*' -File) | ForEach-Object {
    Microsoft.PowerShell.Management\\Remove-Item -LiteralPath $_.FullName -Force -ErrorAction Stop
  }
}
$executionError = $null
try {
  $null = Invoke-RepairPushPreflight -Command (Join-Path $probeTemp 'missing-preflight-command.exe') -Arguments @() -ExpectedHead $expectedHead -ExpectedRef $expectedRef
} catch {
  $executionError = $_.Exception.Message
}
$captureCount = @(Get-ChildItem -LiteralPath $probeTemp -Filter 'repair-push-preflight-*' -File).Count
$observable = @($empty.error, $multiple.error, $wrong.error, $auth.error, $authGitCurl.error, $authPrecedence.error, $repoNotFound.error, $repoHttp.error, $network.error, $networkHttp.error, $remoteAccess.error, $other.error, $exit128.error, $diagnostic.error, $cleanupFailure.error, $cleanupProbeFailure.error, $executionError) -join [Environment]::NewLine
[IO.Directory]::Delete($probeTemp, $true)
[Console]::Out.Write((@{
  exact = $exact
  empty = $empty
  multiple = $multiple
  wrong = $wrong
  auth = $auth
  authGitCurl = $authGitCurl
  authPrecedence = $authPrecedence
  repoNotFound = $repoNotFound
  repoHttp = $repoHttp
  network = $network
  networkHttp = $networkHttp
  remoteAccess = $remoteAccess
  other = $other
  exit128 = $exit128
  diagnostic = $diagnostic
  cleanupFailure = $cleanupFailure
  cleanupProbeFailure = $cleanupProbeFailure
  executionError = $executionError
  captureCount = $captureCount
  observable = $observable
} | ConvertTo-Json -Compress -Depth 5))
`
  return JSON.parse(execFileSync('pwsh.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8' }))
})() : null
const hostOrchestrationSteps = [
  'Prepare current repair tuple',
  'Bind reviewed HEAD immediately before local execution',
  'Rebind reviewed HEAD and project local provider completion',
  'Rebind repair paths and validation profile',
  'Recheck current HEAD and prepare one commit',
  'Rebind existing state and hand off fresh review',
].map((name) => repairStepByName.get(name))
const nativeBoundarySteps = [
  'Preflight exact Repair Executor environment',
  'Prepare current repair tuple',
  'Bind reviewed HEAD immediately before local execution',
  'Execute one local blocking repair',
  'Rebind reviewed HEAD and project local provider completion',
  'Rebind repair paths and validation profile',
  'Recheck current HEAD and prepare one commit',
  'Rebind existing state and hand off fresh review',
].map((name) => repairStepByName.get(name))
const parsedIntermediarySteps = [
  'Prepare current repair tuple',
  'Bind reviewed HEAD immediately before local execution',
  'Rebind reviewed HEAD and project local provider completion',
  'Rebind repair paths and validation profile',
  'Recheck current HEAD and prepare one commit',
  'Rebind existing state and hand off fresh review',
].map((name) => repairStepByName.get(name))
const standardParsedIntermediarySteps = parsedIntermediarySteps.filter((step) => step !== providerPostExecStep && step !== providerPostAgentStep && step !== providerCommitPlanStep)
const nativeJsonCaptureSteps = [...parsedIntermediarySteps, providerExecutionStep]
const nonAsciiNativeJson = JSON.stringify({ finding: '修復対象—café' })
const nonAsciiNativeBytes = Buffer.from(nonAsciiNativeJson, 'utf8')
const nonAsciiNativeDecoded = new TextDecoder('utf-8', { fatal: true }).decode(nonAsciiNativeBytes)
const nonAsciiNativeReencoded = Buffer.from(nonAsciiNativeDecoded, 'utf8')
const powershell51NativeUtf8RoundTrip = process.platform !== 'win32' || (() => {
  const encoded = nonAsciiNativeBytes.toString('base64')
  const script = `
$ErrorActionPreference = 'Stop'
$encoded = '${encoded}'
$expected = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($encoded))
$utf8NoBom = [Text.UTF8Encoding]::new($false)
$priorConsoleOutputEncoding = [Console]::OutputEncoding
$priorErrorActionPreference = $ErrorActionPreference
try {
  [Console]::OutputEncoding = $utf8NoBom
  $ErrorActionPreference = 'Continue'
  $LASTEXITCODE = $null
  $captured = [string[]]@(& node -e 'process.stdout.write(Buffer.from(process.argv[1], ''base64''))' $encoded 2>&1)
  $nativeExit = $LASTEXITCODE
} finally {
  [Console]::OutputEncoding = $priorConsoleOutputEncoding
  $ErrorActionPreference = $priorErrorActionPreference
}
if ($nativeExit -ne 0 -or ($captured -join '') -cne $expected) { throw 'native_utf8_decode_failed' }
if ([Convert]::ToBase64String($utf8NoBom.GetBytes(($captured -join ''))) -cne $encoded) { throw 'native_utf8_reencode_failed' }
if ([Console]::OutputEncoding.CodePage -ne $priorConsoleOutputEncoding.CodePage) { throw 'native_output_encoding_not_restored' }
`
  try {
    execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
})()
const forbiddenProviderMechanisms = ['OPENAI_API_KEY', 'CODEX_API_KEY', 'CODEX_ACCESS_TOKEN', 'CODEX_REPAIR_ENV_ID', 'codex cloud', 'codex apply', 'task_source_sha', 'provider_receipt', 'provider_digest', 'provider_branch_lock']
const repairPushSecretName = ['REPAIR', 'EXECUTOR', 'PUSH', 'TOKEN'].join('_')
const tokenUserInfoMarker = ['x-access', 'token:'].join('-')
const providerProductionSource = `${workflowSource}\n${runnerSource}`

// Eight self-hosted Windows provider-boundary units x three assertions = 24.
const providerUnits = [
  {
    name: 'exact self-hosted Windows PowerShell 7 boundary',
    evidence: [
      repairJob['runs-on'].join('|') === 'self-hosted|Windows|X64',
      repairRunSteps.length === 12 && repairRunSteps.every((step) => step.shell === 'pwsh') && repairRunSteps.every((step) => step.shell !== 'powershell') && hostRunnerRun.includes(powershellMajorGuard) && repairRunSource.split(powershellMajorGuard).length === 2 && hostRunnerRun.indexOf(powershellMajorGuard) < hostRunnerRun.indexOf('$utf8NoBom'),
      providerExec.provider_projection.runner_labels.join('|') === 'self-hosted|Windows|X64' && providerExec.provider === undefined,
    ],
  },
  {
    name: 'pinned CLI and ChatGPT login probe',
    evidence: [
      providerExec.provider_projection.cli_version === 'codex-cli 0.147.0' && providerExec.provider_projection.login_status === 'Logged in using ChatGPT',
      missingCliError?.message === 'repair_provider_cli_version_invalid' && wrongCliError?.message === 'repair_provider_cli_version_invalid' && apiLoginError?.message === 'repair_provider_chatgpt_login_required',
      providerProbeRun.includes('Get-Command codex.cmd') && providerProbeRun.includes("$version -cne 'codex-cli 0.147.0'") && providerProbeRun.includes("$loginStatus -cne 'Logged in using ChatGPT'") && providerProbeRun.includes('Invoke-NativeSeparated') && providerProbeRun.includes('1> $stdoutPath') && providerProbeRun.includes('2> $stderrPath') && !providerProbeRun.includes('2>&1'),
    ],
  },
  {
    name: 'API cloud secret retry and fallback absence',
    evidence: [
      forbiddenProviderMechanisms.every((needle) => !providerProductionSource.includes(needle)),
      !workflowSource.includes('npm install --global @openai/codex') && repairRunSteps.every((step) => step.shell === 'pwsh') && !repairRunSource.includes('powershell.exe') && !workflowSource.includes(repairPushSecretName) && !workflowSource.includes(tokenUserInfoMarker),
      providerExecutionStep?.run.split('& codex.cmd exec').length === 2 && !providerExecutionStep.run.includes('while (') && !providerExecutionStep.run.includes('Start-Sleep'),
    ],
  },
  {
    name: 'bounded exact prompt and UTF-8 stdin',
    evidence: [
      Buffer.from(providerExec.prompt, 'utf8').equals(Buffer.from(expectedRepairPrompt, 'utf8')) && providerExec.provider_projection.prompt_bytes === Buffer.byteLength(expectedRepairPrompt, 'utf8') && providerExec.prompt.includes(JSON.stringify([...REPAIR_PATHS].sort())) && authorizedFileByteSizes.every((byteLength) => byteLength > 16_384),
      providerExec.prompt.includes(`Reviewed exact HEAD:\n${HEAD}\n`) && providerExec.prompt.includes('Use Codex native file read only for current authorized_paths') && providerExec.prompt.includes('apply_patch only') && providerExec.prompt.includes('Current blocking finding:\ncurrent blocking findings') && !providerExec.prompt.includes('Current authorized-file snapshots') && !providerExec.prompt.includes('Repository:') && !providerExec.prompt.includes('Task:') && !providerExec.prompt.includes('PR:') && providerExec.provider_projection.prompt_bytes <= 16_384,
      capBoundaryPrompt.provider_projection.prompt_bytes === 16_384 && oversizedPrompt.reason === 'repair_provider_prompt_too_large' && workflowSource.includes('[Text.UTF8Encoding]::new($false)') && providerExecutionStep?.run.includes('$prompt | & codex.cmd exec') && repairStepByName.get('Bind reviewed HEAD immediately before local execution')?.run.includes('[IO.File]::WriteAllText($promptPath, [string]$result.prompt, $utf8NoBom)'),
    ],
  },
  {
    name: 'pre-exec reviewed tuple and clean checkout',
    evidence: [
      providerPullDrift.reason === 'repair_pull_binding_invalid' && providerPullDriftHost.metrics.branchReads === 0,
      providerRemoteDrift.reason === 'repair_remote_head_changed' && providerRemoteDriftHost.metrics.branchReads === 1 && providerDirty.reason === 'repair_provider_worktree_not_clean' && providerRemoteDrift.provider_projection === undefined && providerDirty.provider_projection === undefined,
      rerunProvider.reason === 'repair_provider_rerun_forbidden' && rerunProvider.next_action === 'STOP' && !runnerSource.includes('materializeRepairAuthorizedFileSnapshotsV1') && !runnerSource.includes('repairAuthorizedFileSnapshotsV1') && !runnerSource.includes('readAuthorizedSnapshots') && !runnerSource.includes('Current authorized-file snapshots'),
    ],
  },
  {
    name: 'one sandboxed ephemeral local execution',
    evidence: [
      providerExec.reason === 'repair_provider_exec_binding_satisfied' && providerExec.next_action === 'EXECUTE_REPAIR_AGENT' && providerExec.provider_projection.invocation_count === 1,
      providerExec.provider_projection.exec_argv.join('|') === `exec|-c|features.shell_tool=false|-c|sandbox_workspace_write.network_access=false|-c|sandbox_workspace_write.writable_roots=[]|--sandbox|workspace-write|--ephemeral|--json|--cd|${WINDOWS_WORKSPACE}|-`,
      providerExecutionStep?.run.split('& codex.cmd exec').length === 2 && providerExecutionStep?.['timeout-minutes'] === 20 && !providerExecutionStep.run.includes('danger-full-access') && !providerExecutionStep.run.includes('bypass'),
    ],
  },
  {
    name: 'nonzero timeout or invalid post-exec workspace stops',
    evidence: [
      providerExecutionStep?.run.includes("if ($providerExit -ne 0)") && providerExecutionStep?.['timeout-minutes'] === 20 && providerExecutionStep.run.includes("$ErrorActionPreference = 'Continue'") && providerExecutionStep.run.includes('$ErrorActionPreference = $priorErrorActionPreference') && providerExecutionStep.run.includes('[IO.File]::WriteAllLines($outputPath') && providerExecutionStep.run.includes('$priorConsoleOutputEncoding = [Console]::OutputEncoding') && providerExecutionStep.run.includes('[Console]::OutputEncoding = $utf8NoBom') && providerExecutionStep.run.includes('[Console]::OutputEncoding = $priorConsoleOutputEncoding'),
      providerPostBranchDrift.reason === 'repair_provider_branch_changed' && providerPostRemote.reason === 'repair_remote_head_changed',
      providerPostEmpty.reason === 'repair_provider_diff_missing' && malformedProvider.next_action === 'STOP' && postAgentEscape.next_action === 'STOP' && providerPostExecRun.includes('if ($postExecExit -ne 0) {') && providerPostExecRun.includes('[IO.File]::ReadAllLines($postExecPath, $utf8NoBom)') && providerPostExecRun.includes('[Console]::Out.WriteLine($_)') && providerPostExecRun.indexOf('[Console]::Out.WriteLine($_)') < providerPostExecRun.indexOf("throw 'repair_provider_post_exec_binding_failed'") && providerPostExecRun.indexOf('$postExecExit = $LASTEXITCODE') < providerPostExecRun.indexOf('if ($postExecExit -ne 0) {') && !providerPostExecRun.includes('ConvertFrom-Json $postExecErrorPath') && providerPostExecRun.includes('repair_provider_post_exec_encoding_invalid') && providerPostExecRun.includes("if ($result.next_action -cne 'PROJECT_PROVIDER_COMPLETION')"),
    ],
  },
  {
    name: 'successful uncommitted exact-scope lifecycle return',
    evidence: [
      providerPost.reason === 'repair_provider_post_exec_binding_satisfied' && providerPost.next_action === 'PROJECT_PROVIDER_COMPLETION' && (process.platform !== 'win32' || (postExecStreamSeparationProbe.nativeExit === 0 && postExecStreamSeparationProbe.nextAction === 'PROJECT_PROVIDER_COMPLETION' && postExecStreamSeparationProbe.stderrWarning === 'warning: LF will be replaced by CRLF' && postExecStreamSeparationProbe.mergedRejected === true)),
      postAgentAllowed.next_action === 'VALIDATE_REPAIR' && postAgentAllowed.repair_paths.join('|') === [...REPAIR_PATHS].sort().join('|') && (process.platform !== 'win32' || (postAgentStreamSeparationProbe.nativeExit === 0 && postAgentStreamSeparationProbe.nextAction === 'VALIDATE_REPAIR' && postAgentStreamSeparationProbe.validationProfile === 'docs_only' && postAgentStreamSeparationProbe.stderrWarning === 'warning: LF will be replaced by CRLF' && postAgentStreamSeparationProbe.mergedRejected === true)) && standardParsedIntermediarySteps.every((step) => step?.run.includes('[IO.File]::WriteAllLines') && step.run.includes('encoding_invalid') && step.run.includes('-Raw -Encoding utf8') && step.run.includes('$priorConsoleOutputEncoding = [Console]::OutputEncoding') && step.run.includes('[Console]::OutputEncoding = $utf8NoBom') && step.run.includes('[Console]::OutputEncoding = $priorConsoleOutputEncoding') && !step.run.includes('Tee-Object')) && providerPostExecRun.split('--repair-provider-post-exec-bind-file').length === 2 && providerPostExecRun.includes('1> $postExecPath') && providerPostExecRun.includes('2> $postExecErrorPath') && !providerPostExecRun.includes('2>&1') && providerPostExecRun.includes('Get-Content -LiteralPath $postExecPath -Raw -Encoding utf8 | ConvertFrom-Json') && !providerPostExecRun.includes('Get-Content -LiteralPath $postExecErrorPath -Raw') && providerPostExecRun.includes('Remove-Item -LiteralPath $postExecPath') && providerPostExecRun.includes('Remove-Item -LiteralPath $postExecErrorPath') && providerPostAgentRun.split('--repair-post-agent-file').length === 2 && providerPostAgentRun.includes('1> $postAgentPath') && providerPostAgentRun.includes('2> $postAgentErrorPath') && !providerPostAgentRun.includes('2>&1') && providerPostAgentRun.indexOf('$postAgentExit = $LASTEXITCODE') < providerPostAgentRun.indexOf("if ($postAgentExit -ne 0)") && providerPostAgentRun.includes('Get-Content -LiteralPath $postAgentPath -Raw -Encoding utf8 | ConvertFrom-Json') && !providerPostAgentRun.includes('Get-Content -LiteralPath $postAgentErrorPath -Raw') && providerPostAgentRun.includes("throw 'repair_post_agent_failed'") && providerPostAgentRun.includes("throw 'repair_post_agent_encoding_invalid'") && providerPostAgentRun.includes("if ($result.next_action -cne 'VALIDATE_REPAIR')") && !providerPostAgentRun.includes('Remove-Item -LiteralPath $postAgentPath') && providerPostAgentRun.includes('Remove-Item -LiteralPath $postAgentErrorPath') && repairResultRun.includes("$evidencePath = Join-Path $env:RUNNER_TEMP 'repair-post-agent.json'") && repairResultRun.includes('--repair-evidence-file $evidencePath') && repairResultRun.includes('Remove-Item -LiteralPath $evidencePath') && repairResultRun.indexOf('--repair-evidence-file $evidencePath') < repairResultRun.indexOf('Remove-Item -LiteralPath $evidencePath') && repairResultRun.indexOf("if ($result.state -cne 'REVIEW_PENDING'") < repairResultRun.indexOf('Remove-Item -LiteralPath $evidencePath') && (repairResultRun.match(/\btry \{/g) ?? []).length === 2 && (repairResultRun.match(/\} finally \{/g) ?? []).length === 2 && repairResultRun.indexOf('try {') < repairResultRun.indexOf('$priorErrorActionPreference') && repairResultRun.trimEnd().endsWith("} finally {\n  Remove-Item -LiteralPath $evidencePath -Force -ErrorAction SilentlyContinue\n}") && runnerSource.includes('repairPaths: evidence.repair_paths') && runnerSource.includes('validationProfile: evidence.validation_profile') && runnerSource.includes('headRef: evidence.head_ref'),
      commitPlan.next_action === 'COMMIT_AND_PUSH' && completedRepair.next_action === 'REVIEW' && (process.platform !== 'win32' || (commitPlanStreamSeparationProbe.nativeExit === 0 && commitPlanStreamSeparationProbe.automationStatus === 'COMMIT_READY' && commitPlanStreamSeparationProbe.nextAction === 'COMMIT_AND_PUSH' && commitPlanStreamSeparationProbe.force === false && commitPlanStreamSeparationProbe.commitCount === 1 && commitPlanStreamSeparationProbe.stderrWarning === 'warning: LF will be replaced by CRLF' && commitPlanStreamSeparationProbe.mergedRejected === true)) && providerCommitPlanRun.split('--repair-commit-plan-file').length === 2 && providerCommitPlanRun.includes('1> $planPath') && providerCommitPlanRun.includes('2> $planErrorPath') && !providerCommitPlanRun.includes('2>&1') && providerCommitPlanRun.indexOf('$planExit = $LASTEXITCODE') < providerCommitPlanRun.indexOf("if ($planExit -ne 0)") && providerCommitPlanRun.includes('Get-Content -LiteralPath $planPath -Raw -Encoding utf8 | ConvertFrom-Json') && !providerCommitPlanRun.includes('Get-Content -LiteralPath $planErrorPath -Raw') && providerCommitPlanRun.includes("throw 'repair_commit_plan_failed'") && providerCommitPlanRun.includes("throw 'repair_commit_plan_encoding_invalid'") && providerCommitPlanRun.includes("if ($plan.next_action -cne 'COMMIT_AND_PUSH' -or $plan.force -or $plan.commit_count -ne 1)") && providerCommitPlanRun.indexOf("throw 'repair_commit_plan_invalid'") < providerCommitPlanRun.indexOf('git add -- $repairPaths') && providerCommitPlanRun.includes('Remove-Item -LiteralPath $planPath') && providerCommitPlanRun.includes('Remove-Item -LiteralPath $planErrorPath') && forbiddenProviderMechanisms.every((needle) => !providerProductionSource.includes(needle)) && runnerSource.includes('Use Codex native file read only for current authorized_paths') && runnerSource.includes('apply_patch only') && !runnerSource.includes('materializeRepairAuthorizedFileSnapshotsV1') && !runnerSource.includes('readAuthorizedSnapshots') && nativeBoundarySteps.every((step) => step?.run.includes("$ErrorActionPreference = 'Continue'") && step.run.includes('finally {') && step.run.includes('$ErrorActionPreference = $priorErrorActionPreference') && /\$\w+Exit = \$LASTEXITCODE/.test(step.run)) && nativeBoundarySteps.filter((step) => step !== providerProbeStep).every((step) => step.run.includes('$LASTEXITCODE = $null')) && !providerProbeRun.includes('$LASTEXITCODE = $null') && nativeJsonCaptureSteps.every((step) => step?.run.includes('[Console]::OutputEncoding = $utf8NoBom') && step.run.includes('[Console]::OutputEncoding = $priorConsoleOutputEncoding')) && nonAsciiNativeDecoded === nonAsciiNativeJson && nonAsciiNativeReencoded.equals(nonAsciiNativeBytes) && powershell51NativeUtf8RoundTrip && !repairRunSource.includes('Tee-Object') && !repairRunSource.includes('Add-Content') && repairRunSource.split('[IO.File]::AppendAllText').length === 9 && repairRunSource.split('[Text.UTF8Encoding]::new($false)').length === 10 && repairRunSource.includes('$persistedBytes[0] -eq 0xff') && repairRunSource.includes('$persistedBytes[0] -eq 0xef'),
    ],
  },
]
for (const unit of providerUnits) {
  for (const [index, evidence] of unit.evidence.entries()) check(evidence, `${unit.name} evidence ${index + 1}`)
}

const hostBindingChangedPaths = execFileSync('git', ['diff', '--name-only', HOST_RUNNER_BINDING_BASE, HOST_RUNNER_BINDING_HEAD], { cwd: repositoryRoot, encoding: 'utf8' }).trim().split(/\r?\n/).filter(Boolean)
const hostBindingExpectedPaths = [
  '.github/workflows/protected-transition-admission-v1.yml',
  'scripts/test-protected-transition-admission-v1.mjs',
]
const hostRunnerBindingMatrix = [
  hostRunnerRun.includes("@('-C', $hostWorktree, 'fetch', '--no-tags', '--depth=1', 'origin', $env:GITHUB_WORKFLOW_SHA)") && hostRunnerRun.split("'fetch'").length === 2,
  hostRunnerRun.includes("protected-transition-host-{0}-{1}") && hostRunnerRun.includes('$env:GITHUB_RUN_ID') && hostRunnerRun.includes('$env:GITHUB_RUN_ATTEMPT'),
  hostRunnerRun.includes("if ($hostHead -cne $env:GITHUB_WORKFLOW_SHA) { throw 'repair_host_sha_mismatch' }"),
  providerProbeRun.includes("if ($targetHead -cne $env:REPAIR_HEAD) { throw 'repair_worktree_head_changed' }"),
  hostRunnerRun.includes('[IO.File]::AppendAllText($env:GITHUB_ENV, "PTA_HOST_RUNNER=$hostRunner$([Environment]::NewLine)", $utf8NoBom)'),
  hostOrchestrationSteps.length === 6 && hostOrchestrationSteps.every((step) => step?.run.includes('node $env:PTA_HOST_RUNNER')),
  hostOrchestrationSteps.every((step) => !step?.run.includes('node scripts/run-protected-transition-admission-v1.mjs')) && !repairRunSource.includes('node scripts/run-protected-transition-admission-v1.mjs'),
  providerExecutionStep?.run.includes('$prompt | & codex.cmd exec -c features.shell_tool=false -c sandbox_workspace_write.network_access=false -c sandbox_workspace_write.writable_roots=[] --sandbox workspace-write --ephemeral --json --cd $env:GITHUB_WORKSPACE -') && providerExecutionStep.run.split('& codex.cmd exec').length === 2,
  hostRunnerRun.includes("throw 'repair_host_inside_target_workspace'") && !repairRunSource.includes('Set-Location') && hostOrchestrationSteps.every((step) => !step?.['working-directory']),
  hostOrchestrationSteps.every((step) => step?.run.includes('$env:PTA_HOST_RUNNER')) && hostOrchestrationSteps.every((step) => !step?.run.includes('$env:GITHUB_WORKSPACE/scripts/run-protected-transition-admission-v1.mjs')),
  repairJob.steps.indexOf(hostRunnerStep) < repairJob.steps.indexOf(providerProbeStep) && repairJob.steps.indexOf(hostRunnerStep) < repairJob.steps.indexOf(providerExecutionStep) && !hostRunnerStep?.['continue-on-error'] && hostRunnerRun.includes("-Failure 'repair_host_fetch_failed'") && hostRunnerRun.includes("throw 'repair_host_runner_missing'"),
  hostBindingChangedPaths.join('\n') === hostBindingExpectedPaths.join('\n') && changedPaths.join('\n') === expectedPaths.join('\n'),
]
for (const [index, evidence] of hostRunnerBindingMatrix.entries()) check(evidence, `host-runner binding matrix ${index + 1}`)

const hostAcquisitionPreflightChangedPaths = execFileSync('git', ['diff', '--name-only', BASE], { cwd: repositoryRoot, encoding: 'utf8' }).trim().split(/\r?\n/).filter(Boolean)
const hostAcquisitionPreflightExpectedPaths = [
  '.github/workflows/protected-transition-admission-v1.yml',
  'scripts/run-protected-transition-admission-v1.mjs',
  'scripts/test-protected-transition-admission-v1.mjs',
]
const providerBindingStep = repairJob.steps.find((step) => step.name === 'Bind reviewed HEAD immediately before local execution')
const providerPreflightIndex = repairJob.steps.indexOf(providerProbeStep)
const protectedSideEffectSteps = [
  providerBindingStep,
  providerExecutionStep,
  repairJob.steps.find((step) => step.name === 'Run exact repair validation profile'),
  repairJob.steps.find((step) => step.name === 'Recheck current HEAD and prepare one commit'),
  repairJob.steps.find((step) => step.name === 'Push one normal non-force repair commit'),
  repairJob.steps.find((step) => step.name === 'Rebind existing state and hand off fresh review'),
]
const hostAcquisitionPreflightMatrix = [
  hostRunnerRun.includes('1> $stdoutPath') && hostRunnerRun.includes('2> $stderrPath') && hostRunnerRun.includes('[Console]::Error.WriteLine($_)') && hostRunnerRun.includes('if ($nativeExit -ne 0) { throw $Failure }') && !hostRunnerRun.includes('2>&1'),
  hostRunnerRun.split("'fetch'").length === 2 && hostRunnerRun.includes("'--no-tags', '--depth=1'") && hostRunnerRun.includes("-Failure 'repair_host_fetch_failed'") && !hostRunnerRun.includes('while (') && !hostRunnerRun.includes('Start-Sleep'),
  hostRunnerRun.includes("'checkout', '--quiet', '--detach', 'FETCH_HEAD'") && hostRunnerRun.includes("throw 'repair_host_sha_mismatch'") && hostRunnerRun.includes("throw 'repair_host_runner_missing'"),
  hostRunnerRun.includes('protected-transition-host-{0}-{1}') && hostRunnerRun.includes("throw 'repair_host_path_escape'") && hostRunnerRun.includes("throw 'repair_host_inside_target_workspace'") && hostRunnerRun.includes("throw 'repair_host_path_collision'") && hostRunnerRun.includes('New-Item -ItemType Directory -Path $hostWorktree -ErrorAction Stop') && !repairRunSource.includes('New-Item -ItemType Directory -LiteralPath') && (repairRunSource.match(/\bNew-Item\b/g) ?? []).length === 1 && !hostRunnerRun.includes("'worktree', 'add'"),
  repairJob.steps.indexOf(repairStepByName.get('Prepare current repair tuple')) < providerPreflightIndex && providerPreflightIndex < repairJob.steps.indexOf(providerBindingStep) && protectedSideEffectSteps.every((step) => providerPreflightIndex < repairJob.steps.indexOf(step) && !step?.['continue-on-error']),
  providerProbeRun.includes('$actualHostRunner -cne $expectedHostRunner') && providerProbeRun.includes("'-C', $hostRoot, 'rev-parse', 'HEAD'") && providerProbeRun.includes("$hostHead -cne $env:GITHUB_WORKFLOW_SHA"),
  providerProbeRun.includes('Get-Command codex.cmd -ErrorAction Stop') && providerProbeRun.includes("@('--version')") && providerProbeRun.includes("$version -cne 'codex-cli 0.147.0'") && providerProbeRun.split("throw 'repair_provider_cli_version_invalid'").length === 3,
  providerProbeRun.includes("@('login', 'status')") && providerProbeRun.includes("$loginStatus -cne 'Logged in using ChatGPT'") && providerProbeRun.includes("throw 'repair_provider_chatgpt_login_required'"),
  providerProbeRun.includes("'rev-parse', '--show-toplevel'") && !providerProbeRun.includes("'symbolic-ref'") && !providerProbeRun.includes("repair_provider_branch_changed") && repairJob.steps.find((step) => step.name === 'Checkout exact repair HEAD')?.with?.ref === '${{ needs.protected_transition_admission_v1.outputs.repair_exact_head }}' && providerProbeRun.includes("'status', '--porcelain=v1', '--untracked-files=all'") && providerProbeRun.split("'status', '--porcelain=v1', '--untracked-files=all'").length === 3 && providerProbeRun.includes('[IO.File]::WriteAllBytes($sentinelPath, $sentinelBytes)') && providerProbeRun.includes("throw 'repair_target_worktree_not_writable'"),
  providerProbeRun.includes('$pushTransport = "https://github.com/$($env:GITHUB_REPOSITORY).git"') && providerProbeRun.includes("@('ls-remote', '--heads', $pushTransport") && providerProbeRun.split("'ls-remote'").length === 2 && providerProbeRun.includes('Invoke-RepairPushPreflight') && !providerProbeRun.includes("-Failure 'repair_push_transport_failed' -SuppressOutput") && !providerProbeRun.includes(repairPushSecretName) && !providerProbeRun.includes(tokenUserInfoMarker),
  repairPushPreflightHelperSource.includes('$remoteLines.Count -ne 1') && repairPushPreflightHelperSource.includes('$remoteFields.Count -ne 2') && repairPushPreflightHelperSource.includes('$remoteFields[0] -cne $ExpectedHead') && repairPushPreflightHelperSource.includes('$remoteFields[1] -cne $ExpectedRef') && repairPushPreflightHelperSource.split("throw 'repair_push_remote_head_mismatch exit_code=0'").length === 3,
  hostAcquisitionPreflightChangedPaths.join('\n') === hostAcquisitionPreflightExpectedPaths.join('\n') && workflowSource.includes('protected-transition-admission-v1: 576 assertions passed') && !repairRunSource.includes('retry') && !repairRunSource.includes('fallback') && !repairRunSource.includes('default branch'),
]
for (const [index, evidence] of hostAcquisitionPreflightMatrix.entries()) check(evidence, `host acquisition and provider preflight matrix ${index + 1}`)

const nativeExitShadowingMatrix = [
  nativeHelperSources.length === 2 && nativeHelperSources.every((source) => source.startsWith('function Invoke-NativeSeparated {') && !source.includes('$LASTEXITCODE = $null') && source.indexOf('& $Command @Arguments') < source.indexOf('$nativeExit = $LASTEXITCODE')),
  nativeHelperSources.every((source) => source.includes('1> $stdoutPath 2> $stderrPath') && source.includes('if ($nativeExit -ne 0) { throw $Failure }') && source.includes('Remove-Item -LiteralPath $stdoutPath, $stderrPath')),
  process.platform !== 'win32' || (nativeExitProbes.length === 2 && nativeExitProbes.every((probe, index) => probe.successAccepted === true && probe.nonzeroFailure === `native_probe_failure_${index}`)),
]
for (const [index, evidence] of nativeExitShadowingMatrix.entries()) check(evidence, `pwsh native exit shadowing matrix ${index + 1}`)

const loginStatusStreamContractMatrix = [
  !nativeHelperSources[0].includes('$ReturnStream') && nativeHelperSources[1].includes("[ValidateSet('stdout', 'stderr')][string]$ReturnStream = 'stdout'") && nativeHelperSources[1].includes("if ($ReturnStream -ceq 'stderr') { return ,$stderr }"),
  providerProbeRun.includes("@('login', 'status')") && providerProbeRun.includes("-ReturnStream 'stderr'") && providerProbeRun.includes("$loginStatus -cne 'Logged in using ChatGPT'") && providerProbeRun.includes("if ($nativeExit -ne 0) { throw $Failure }"),
  process.platform !== 'win32' || (loginStatusStreamProbe.stdoutSelected === 'stdout-contract' && loginStatusStreamProbe.stderrSelected === 'Logged in using ChatGPT'),
]
for (const [index, evidence] of loginStatusStreamContractMatrix.entries()) check(evidence, `codex login status stream contract matrix ${index + 1}`)

const repairPushStep = repairJob.steps.find((step) => step.name === 'Push one normal non-force repair commit')
const repairPushRun = repairPushStep?.run ?? ''
const exactPushRun = 'git push --porcelain "https://github.com/$($env:GITHUB_REPOSITORY).git" "HEAD:refs/heads/$($env:REPAIR_HEAD_REF)"'
const repairPushPreflightContractMatrix = [
  repairPushPreflightHelperSource.includes("return 'PREFLIGHT_PUSH_CHECK_OK'") && (process.platform !== 'win32' || (repairPushPreflightProbe.exact.result === 'PREFLIGHT_PUSH_CHECK_OK' && repairPushPreflightProbe.exact.error === null)),
  repairPushPreflightHelperSource.includes("throw 'repair_push_remote_head_mismatch exit_code=0'") && (process.platform !== 'win32' || repairPushPreflightProbe.empty.error === 'repair_push_remote_head_mismatch exit_code=0'),
  process.platform !== 'win32' || (repairPushPreflightProbe.multiple.error === 'repair_push_remote_head_mismatch exit_code=0' && repairPushPreflightProbe.wrong.error === 'repair_push_remote_head_mismatch exit_code=0'),
  repairPushPreflightHelperSource.includes("$diagnosticCategory = 'GIT_AUTH'") && (process.platform !== 'win32' || [repairPushPreflightProbe.auth.error, repairPushPreflightProbe.authGitCurl.error, repairPushPreflightProbe.authPrecedence.error].every((error) => error === 'repair_push_auth_failed category=GIT_AUTH exit_code=128')),
  repairPushPreflightHelperSource.includes("$diagnosticCategory = 'REPO_NOT_FOUND'") && (process.platform !== 'win32' || (repairPushPreflightProbe.repoNotFound.error === 'repair_push_transport_failed category=REPO_NOT_FOUND exit_code=128' && repairPushPreflightProbe.repoHttp.error === 'repair_push_transport_failed category=REPO_NOT_FOUND exit_code=22')),
  repairPushPreflightHelperSource.includes("$diagnosticCategory = 'NETWORK'") && (process.platform !== 'win32' || (repairPushPreflightProbe.network.error === 'repair_push_transport_failed category=NETWORK exit_code=7' && repairPushPreflightProbe.networkHttp.error === 'repair_push_transport_failed category=NETWORK exit_code=22')),
  repairPushPreflightHelperSource.includes("$diagnosticCategory = 'REMOTE_ACCESS'") && (process.platform !== 'win32' || repairPushPreflightProbe.remoteAccess.error === 'repair_push_transport_failed category=REMOTE_ACCESS exit_code=128'),
  repairPushPreflightHelperSource.includes("$diagnosticCategory = 'OTHER'") && (process.platform !== 'win32' || repairPushPreflightProbe.other.error === 'repair_push_transport_failed category=OTHER exit_code=9'),
  repairPushPreflightHelperSource.indexOf("$diagnosticCategory = 'GIT_AUTH'") < repairPushPreflightHelperSource.indexOf("$diagnosticCategory = 'REPO_NOT_FOUND'") && repairPushPreflightHelperSource.indexOf("$diagnosticCategory = 'REPO_NOT_FOUND'") < repairPushPreflightHelperSource.indexOf("$diagnosticCategory = 'NETWORK'") && repairPushPreflightHelperSource.indexOf("$diagnosticCategory = 'NETWORK'") < repairPushPreflightHelperSource.indexOf("$diagnosticCategory = 'REMOTE_ACCESS'") && (process.platform !== 'win32' || (repairPushPreflightProbe.authPrecedence.error.includes('category=GIT_AUTH') && repairPushPreflightProbe.repoNotFound.error.includes('category=REPO_NOT_FOUND') && repairPushPreflightProbe.network.error.includes('category=NETWORK'))),
  !repairPushPreflightHelperSource.includes('$nativeExit -eq 128') && (process.platform !== 'win32' || repairPushPreflightProbe.exit128.error === 'repair_push_transport_failed category=NETWORK exit_code=128'),
  repairPushPreflightHelperSource.includes('-not (Test-Path -LiteralPath $stderrPath)') && repairPushPreflightHelperSource.includes('[IO.File]::ReadAllText($stderrPath)') && repairPushPreflightHelperSource.includes('$diagnosticUnavailable = $true') && repairPushPreflightHelperSource.includes('repair_push_preflight_diagnostic_unavailable category=OTHER exit_code=$nativeExit') && (process.platform !== 'win32' || [repairPushPreflightProbe.diagnostic.error, repairPushPreflightProbe.cleanupFailure.error, repairPushPreflightProbe.cleanupProbeFailure.error].every((error) => error === 'repair_push_preflight_diagnostic_unavailable category=OTHER exit_code=9')),
  repairPushPreflightHelperSource.includes("if ($null -eq $nativeExit) { throw 'repair_push_preflight_execution_failed' }") && (process.platform !== 'win32' || repairPushPreflightProbe.executionError === 'repair_push_preflight_execution_failed'),
  !repairPushPreflightHelperSource.includes('[Console]') && !repairPushPreflightHelperSource.includes('GITHUB_OUTPUT') && !repairPushPreflightHelperSource.includes('GITHUB_ENV') && !repairPushPreflightHelperSource.includes('GITHUB_STEP_SUMMARY') && (process.platform !== 'win32' || ['Authentication failed', 'The requested URL returned error', 'Repository not found', 'Could not resolve host', 'Could not read from remote repository', 'transport unavailable', 'repair-push-preflight-probe-', 'simulated_cleanup_probe_failure', 'simulated_diagnostic_probe_failure'].every((needle) => !repairPushPreflightProbe.observable.includes(needle))),
  repairPushPreflightHelperSource.includes('finally {') && repairPushPreflightHelperSource.includes('if (Test-Path -LiteralPath $capturePath) { Remove-Item -LiteralPath $capturePath -Force -ErrorAction Stop }\n        if (Test-Path -LiteralPath $capturePath) { $cleanupFailed = $true }\n      } catch {') && providerProbeRun.split("'ls-remote'").length === 2 && !repairPushPreflightHelperSource.includes('Start-Sleep') && !repairPushPreflightHelperSource.includes('retry') && !repairPushPreflightHelperSource.includes('fallback') && (process.platform !== 'win32' || repairPushPreflightProbe.captureCount === 0),
  repairPushRun.includes(exactPushRun) && !repairPushRun.includes('--force') && protectedSideEffectSteps.every((step) => providerPreflightIndex < repairJob.steps.indexOf(step)) && !repairPushPreflightHelperSource.includes('GITHUB_REPOSITORY') && !repairPushPreflightHelperSource.includes(repairPushSecretName) && !repairPushPreflightHelperSource.includes(tokenUserInfoMarker),
]
for (const [index, evidence] of repairPushPreflightContractMatrix.entries()) check(evidence, `repair push preflight contract matrix ${index + 1}`)

// Twelve Role Dispatch Consumer V1 units x five assertions = 60.
const mergeDecisionReviewId = 9201
const mergeDecisionRunId = Number(REVIEW_RUN_ID)
const mergeDecisionBody = (overrides = {}) => {
  const values = {
    record_type: 'product_owner_merge_decision_v1',
    authoring_role: 'Product Owner / Implementation Lead',
    parent_issue: `https://github.com/${REPOSITORY}/issues/${TASK}`,
    pull_request: `https://github.com/${REPOSITORY}/pull/${PR}`,
    review_decision_comment: `https://github.com/${REPOSITORY}/issues/${TASK}#issuecomment-${mergeDecisionReviewId}`,
    reviewed_head: OTHER_HEAD,
    review_decision: 'APPROVE',
    blocking_finding_count: 0,
    remaining_finding_count: 0,
    unknown_count: 0,
    admission_run_id: mergeDecisionRunId,
    admission_run_url: `https://github.com/${REPOSITORY}/actions/runs/${mergeDecisionRunId}`,
    admission_state: 'MERGE_ELIGIBLE',
    admission_allowed: true,
    admission_reason: 'merge_gate_satisfied',
    admission_evaluated_head: OTHER_HEAD,
    external_check_success_count: 2,
    blocking_thread_count: 0,
    decision: 'MERGE_ALLOWED',
    merge_allowed: true,
    status: 'completed',
    execution_stop_reason: 'completed',
    ...overrides,
  }
  return `# Product Owner Merge Decision\n\n\`\`\`yaml\n${Object.entries(values).map(([key, value]) => `${key}: ${value}`).join('\n')}\n\`\`\``
}
const parsedMergeDecision = parseProductOwnerMergeDecisionV1(mergeDecisionBody(), REPOSITORY, TASK)
const mergeDecisionParseMatrix = [
  parsedMergeDecision.prNumber === PR,
  parsedMergeDecision.exactHead === OTHER_HEAD,
  parsedMergeDecision.reviewCommentId === mergeDecisionReviewId,
  parsedMergeDecision.admissionRunId === mergeDecisionRunId,
  parsedMergeDecision.externalCheckSuccessCount === 2 && parsedMergeDecision.blockingThreadCount === 0,
]
for (const [index, evidence] of mergeDecisionParseMatrix.entries()) check(evidence, `RDC-01 merge decision parse ${index + 1}`)

const mergeDecisionEvent = Object.freeze({
  action: 'created', repository: Object.freeze({ full_name: REPOSITORY }),
  issue: Object.freeze({ number: TASK, state: 'open' }),
  comment: Object.freeze({ id: 9202, author_association: 'OWNER', body: mergeDecisionBody() }),
})
const normalizedMergeDecision = normalizeRoleTransitionEventV1(mergeDecisionEvent)
const duplicateMergeMarkerError = await errorOf(() => normalizeRoleTransitionEventV1({
  ...mergeDecisionEvent,
  comment: { ...mergeDecisionEvent.comment, body: `${mergeDecisionBody()}\nrecord_type: implementation_authorization_v1` },
}))
const malformedMergeDecisionError = await errorOf(() => parseProductOwnerMergeDecisionV1(mergeDecisionBody({ admission_evaluated_head: HEAD }), REPOSITORY, TASK))
const noncanonicalMergeStopError = await errorOf(() => parseProductOwnerMergeDecisionV1(mergeDecisionBody({ execution_stop_reason: 'merge_allowed' }), REPOSITORY, TASK))
const mergeDecisionNormalizationMatrix = [
  normalizedMergeDecision.terminalResult === 'MERGE_ALLOWED',
  normalizedMergeDecision.repository === REPOSITORY && normalizedMergeDecision.taskIssueNumber === TASK,
  normalizedMergeDecision.commentId === 9202 && normalizedMergeDecision.prNumber === PR,
  duplicateMergeMarkerError?.message === 'terminal_result_ambiguous_or_invalid',
  malformedMergeDecisionError?.message === 'terminal_result_ambiguous_or_invalid' && noncanonicalMergeStopError?.message === 'terminal_result_ambiguous_or_invalid',
]
for (const [index, evidence] of mergeDecisionNormalizationMatrix.entries()) check(evidence, `RDC-02 merge decision normalization ${index + 1}`)

const correctedApproveRoute = evaluateRoleTransitionOrchestratorV1(roleInput({ terminalResult: 'APPROVE', routeResult: mergeRoute }))
const approveRouteMatrix = [
  correctedApproveRoute.next_action === 'PRODUCT_OWNER_IMPLEMENTATION_LEAD',
  correctedApproveRoute.automation_status === 'HANDOFF_READY',
  correctedApproveRoute.reason === 'merge_decision_required',
  correctedApproveRoute.allowed === false && correctedApproveRoute.terminal_result === 'APPROVE',
  !/terminalResult === 'APPROVE' && routeResult\?\.allowed === true && routeResult\?\.next_action === 'MERGE_OPERATOR'/.test(runnerSource) && runnerSource.includes("routeResult?.reason === 'merge_gate_satisfied'"),
]
for (const [index, evidence] of approveRouteMatrix.entries()) check(evidence, `RDC-03 approve authority separation ${index + 1}`)

const mergeDecisionRequest = roleRequest()
const mergeDecisionState = roleState({ observed_head: OTHER_HEAD, review_status: 'APPROVE', reviewed_head: OTHER_HEAD, review_blocker_count: 0 })
const mergeDecisionReview = Object.freeze({ pr_number: PR, reviewed_head: OTHER_HEAD, decision: 'APPROVE', blocking_finding_count: 0, remaining_finding_count: 0, unknown_count: 0 })
const mergeDecisionRun = Object.freeze({ id: mergeDecisionRunId, html_url: parsedMergeDecision.admissionRunUrl, head_sha: OTHER_HEAD, path: '.github/workflows/protected-transition-admission-v1.yml', event: 'issue_comment', status: 'completed', conclusion: 'success' })
const mergeDecisionGate = Object.freeze({ ...mergeRoute, reason: 'merge_gate_satisfied', external_check_success_count: 2, blocking_thread_count: 0 })
const admittedMergeDecision = evaluateProductOwnerMergeDecisionV1({ decision: parsedMergeDecision, request: mergeDecisionRequest, taskState: mergeDecisionState, review: mergeDecisionReview, admissionRun: mergeDecisionRun, gateResult: mergeDecisionGate })
const admittedMergeDecisionMatrix = [
  admittedMergeDecision.next_action === 'MERGE_OPERATOR',
  admittedMergeDecision.automation_status === 'HANDOFF_READY',
  admittedMergeDecision.reason === 'merge_allowed',
  admittedMergeDecision.decisionValid === true && admittedMergeDecision.terminal_result === 'MERGE_ALLOWED',
  admittedMergeDecision.allowed === false && admittedMergeDecision.current_head === OTHER_HEAD,
]
for (const [index, evidence] of admittedMergeDecisionMatrix.entries()) check(evidence, `RDC-04 merge decision admission ${index + 1}`)

const rejectedMergeDecisions = [
  evaluateProductOwnerMergeDecisionV1({ decision: { ...parsedMergeDecision, exactHead: HEAD }, request: mergeDecisionRequest, taskState: mergeDecisionState, review: mergeDecisionReview, admissionRun: mergeDecisionRun, gateResult: mergeDecisionGate }),
  evaluateProductOwnerMergeDecisionV1({ decision: parsedMergeDecision, request: mergeDecisionRequest, taskState: { ...mergeDecisionState, observed_head: HEAD }, review: mergeDecisionReview, admissionRun: mergeDecisionRun, gateResult: mergeDecisionGate }),
  evaluateProductOwnerMergeDecisionV1({ decision: parsedMergeDecision, request: mergeDecisionRequest, taskState: mergeDecisionState, review: { ...mergeDecisionReview, decision: 'CHANGES_REQUIRED' }, admissionRun: mergeDecisionRun, gateResult: mergeDecisionGate }),
  evaluateProductOwnerMergeDecisionV1({ decision: parsedMergeDecision, request: mergeDecisionRequest, taskState: mergeDecisionState, review: mergeDecisionReview, admissionRun: { ...mergeDecisionRun, conclusion: 'failure' }, gateResult: mergeDecisionGate }),
  evaluateProductOwnerMergeDecisionV1({ decision: parsedMergeDecision, request: mergeDecisionRequest, taskState: mergeDecisionState, review: mergeDecisionReview, admissionRun: mergeDecisionRun, gateResult: { ...mergeDecisionGate, external_check_success_count: 1 } }),
]
for (const [index, rejected] of rejectedMergeDecisions.entries()) check(rejected.next_action === 'STOP' && rejected.allowed === false && rejected.state_changed === false, `RDC-05 merge decision fail closed ${index + 1}`)

const implementerRoute = evaluateRoleTransitionOrchestratorV1(roleInput({ request: roleRequest({ exactHead: HEAD }), taskState: roleState({ observed_head: HEAD }) }))
const implementerState = roleState({ observed_head: HEAD })
const implementerSourceBinding = Object.freeze({
  kind: 'IMPLEMENTATION_AUTHORIZATION', comment_id: roleImplementationAuthorizationId,
  architecture_review_comment_id: 9000, candidate_sha256: 'c'.repeat(64),
})
const implementerDispatch = projectRoleDispatchEnvelopeV1({
  result: implementerRoute, repository: REPOSITORY, sourceCommentId: roleImplementationAuthorizationId,
  authorizedPaths: rolePaths, taskState: implementerState, sourceBinding: implementerSourceBinding,
  implementerContext: roleImplementerContext,
})
const implementationRouteMetrics = { sourceReads: 0, taskReads: 0, architectureReads: 0, pullReads: 0 }
const implementationAuthorizationEvent = Object.freeze({
  action: 'created', repository: Object.freeze({ full_name: REPOSITORY }),
  issue: Object.freeze({ number: TASK, state: 'open' }),
  comment: Object.freeze({ id: roleImplementationAuthorizationId, author_association: 'OWNER', body: roleImplementationAuthorizationBody }),
})
const materializedImplementationRoute = await executeRoleTransitionOrchestratorV1({
  event: implementationAuthorizationEvent,
  host: {
    api: async (endpoint) => {
      if (endpoint.endsWith(`/issues/comments/${roleImplementationAuthorizationId}`)) {
        implementationRouteMetrics.sourceReads += 1
        return { id: roleImplementationAuthorizationId, created_at: '2026-08-13T00:00:01Z', issue_url: `https://api.github.com/repos/${REPOSITORY}/issues/${TASK}`, author_association: 'OWNER', body: roleImplementationAuthorizationBody }
      }
      if (endpoint.endsWith('/issues/comments/9000')) {
        implementationRouteMetrics.architectureReads += 1
        return { id: 9000, created_at: '2026-08-13T00:00:00Z', issue_url: `https://api.github.com/repos/${REPOSITORY}/issues/${TASK}`, author_association: 'OWNER', body: roleArchitectureReviewBody }
      }
      if (endpoint.endsWith(`/issues/${TASK}`)) {
        implementationRouteMetrics.taskReads += 1
        return roleTaskObject()
      }
      if (endpoint.endsWith(`/pulls/${PR}`)) {
        implementationRouteMetrics.pullReads += 1
        return pullObject({ head: HEAD, changedFiles: rolePaths.length, taskState: implementerState })
      }
      throw new Error(`unexpected_implementation_route_endpoint:${endpoint}`)
    },
  },
})
const invalidImplementerContexts = [
  null,
  { ...roleImplementerContext, task_title: '' },
  { ...roleImplementerContext, task_body: 42 },
  { ...roleImplementerContext, task_title: 'é'.repeat(129) },
  { ...roleImplementerContext, task_body: 'b'.repeat(8193) },
  { ...roleImplementerContext, approved_correction_context: 'c'.repeat(8193) },
  { task_title: 't', task_body: 'b'.repeat(8192), approved_correction_context: 'c'.repeat(8192) },
  { ...roleImplementerContext, extra: 'not allowed' },
]
const invalidImplementerContextErrors = await Promise.all(invalidImplementerContexts.map((implementerContext) => errorOf(() => projectRoleDispatchEnvelopeV1({
  result: implementerRoute, repository: REPOSITORY, sourceCommentId: roleImplementationAuthorizationId,
  authorizedPaths: rolePaths, taskState: implementerState, sourceBinding: implementerSourceBinding, implementerContext,
}))))
const invalidMaterializationResults = await Promise.all([
  roleTaskObject({ state: 'closed' }),
  roleTaskObject({ pull_request: {} }),
  roleTaskObject({ number: TASK + 1 }),
  roleTaskObject({ repository_url: `https://api.github.com/repos/${REPOSITORY}-other` }),
].map((task) => executeRoleTransitionOrchestratorV1({
  event: implementationAuthorizationEvent,
  host: {
    api: async (endpoint) => {
      if (endpoint.endsWith(`/issues/comments/${roleImplementationAuthorizationId}`)) return { id: roleImplementationAuthorizationId, issue_url: `https://api.github.com/repos/${REPOSITORY}/issues/${TASK}`, author_association: 'OWNER', body: roleImplementationAuthorizationBody }
      if (endpoint.endsWith('/issues/comments/9000')) return { id: 9000, issue_url: `https://api.github.com/repos/${REPOSITORY}/issues/${TASK}`, author_association: 'OWNER', body: roleArchitectureReviewBody }
      if (endpoint.endsWith(`/issues/${TASK}`)) return task
      if (endpoint.endsWith(`/pulls/${PR}`)) return pullObject({ head: HEAD, changedFiles: rolePaths.length, taskState: implementerState })
      throw new Error(`unexpected_invalid_materialization_endpoint:${endpoint}`)
    },
  },
})))
const implementerDispatchMatrix = [
  implementerDispatch.next_action === 'IMPLEMENTER' && implementerDispatch.purpose === 'IMPLEMENTER' && materializedImplementationRoute.next_action === 'IMPLEMENTER',
  materializedImplementationRoute.role_dispatch?.implementer_context.task_title === roleTaskTitle && materializedImplementationRoute.role_dispatch?.implementer_context.task_body === roleTaskBody && materializedImplementationRoute.role_dispatch?.implementer_context.approved_correction_context === roleImplementationAuthorizationBody && Object.isFrozen(materializedImplementationRoute.role_dispatch.implementer_context),
  implementerDispatch.repository === REPOSITORY && implementerDispatch.task_issue_number === TASK && implementerDispatch.pr_number === PR && implementerDispatch.exact_head === HEAD && implementerDispatch.source_comment_id === roleImplementationAuthorizationId && implementerDispatch.source_binding.candidate_sha256 === 'c'.repeat(64),
  implementerDispatch.authorized_paths.join('\n') === rolePaths.join('\n') && JSON.stringify(implementerDispatch.task_state) === JSON.stringify(implementerState) && implementationRouteMetrics.sourceReads === 1 && implementationRouteMetrics.taskReads === 1 && implementationRouteMetrics.architectureReads === 1 && implementationRouteMetrics.pullReads === 1,
  invalidImplementerContextErrors.every((error) => error?.message === 'role_dispatch_envelope_invalid') && invalidMaterializationResults.every((result) => result.next_action === 'STOP' && result.reason === 'task_identity_invalid' && result.state_changed === false),
]
for (const [index, evidence] of implementerDispatchMatrix.entries()) check(evidence, `RDC-06 implementer envelope ${index + 1}`)

const mergeDecisionDispatch = projectRoleDispatchEnvelopeV1({
  result: correctedApproveRoute, repository: REPOSITORY, sourceCommentId: mergeDecisionReviewId,
  authorizedPaths: rolePaths, taskState: mergeDecisionState,
  sourceBinding: Object.freeze({ kind: 'REVIEW', comment_id: mergeDecisionReviewId, reviewed_head: OTHER_HEAD, decision: 'APPROVE' }),
  admissionRunId: REVIEW_RUN_ID,
})
const mergeDecisionDispatchMatrix = [
  mergeDecisionDispatch.next_action === 'PRODUCT_OWNER_IMPLEMENTATION_LEAD',
  mergeDecisionDispatch.purpose === 'MERGE_DECISION',
  mergeDecisionDispatch.admission_run_id === REVIEW_RUN_ID,
  mergeDecisionDispatch.admission_state === 'MERGE_ELIGIBLE' && mergeDecisionDispatch.admission_allowed === true && mergeDecisionDispatch.admission_reason === 'merge_gate_satisfied',
  mergeDecisionDispatch.source_comment_id === mergeDecisionReviewId && mergeDecisionDispatch.source_binding.kind === 'REVIEW' && JSON.stringify(mergeDecisionDispatch.task_state) === JSON.stringify(mergeDecisionState),
]
for (const [index, evidence] of mergeDecisionDispatchMatrix.entries()) check(evidence, `RDC-07 Product Owner envelope ${index + 1}`)

const publicationDispatch = Object.freeze({
  ...implementerDispatch,
  source_comment_id: roleImplementationResultId,
  terminal_result: 'IMPLEMENTATION_RESULT_READY',
  next_action: 'PRODUCT_OWNER_IMPLEMENTATION_LEAD',
  purpose: 'PUBLICATION_DECISION',
  source_binding: Object.freeze({
    kind: 'IMPLEMENTATION_RESULT', comment_id: roleImplementationResultId,
    authorization_comment_id: roleImplementationAuthorizationId,
    architecture_review_comment_id: 9000, candidate_sha256: 'c'.repeat(64),
  }),
})
const reviewerDispatch = publishedRoute.role_dispatch
const postRepairReviewSourceId = 9204
const postRepairReviewBody = reviewDecisionBody({
  reviewed_head: HEAD,
  decision: 'CHANGES_REQUIRED',
  blocking_finding_count: 1,
  remaining_finding_count: 1,
  unknown_count: 0,
})
const postRepairReviewerDispatch = projectRoleDispatchEnvelopeV1({
  result: publishedRoute, repository: REPOSITORY, sourceCommentId: postRepairReviewSourceId,
  authorizedPaths: rolePaths, taskState: reviewerDispatch.task_state,
  sourceBinding: Object.freeze({
    kind: 'REVIEW', comment_id: postRepairReviewSourceId, reviewed_head: HEAD, decision: 'CHANGES_REQUIRED',
  }),
})
const roleComment = (id, body, createdAt) => Object.freeze({ id, created_at: createdAt, issue_url: `https://api.github.com/repos/${REPOSITORY}/issues/${TASK}`, author_association: 'OWNER', body })
const roleSourceRecords = new Map([
  [roleImplementationAuthorizationId, roleComment(roleImplementationAuthorizationId, roleImplementationAuthorizationBody, '2026-08-13T00:00:01Z')],
  [9000, roleComment(9000, roleArchitectureReviewBody, '2026-08-13T00:00:00Z')],
  [roleImplementationResultId, roleComment(roleImplementationResultId, roleImplementationResultBody, '2026-08-13T00:00:02Z')],
  [rolePublicationAuthorityId, roleComment(rolePublicationAuthorityId, rolePublicationAuthorityBody, '2026-08-13T00:00:03Z')],
  [mergeDecisionReviewId, roleComment(mergeDecisionReviewId, reviewDecisionBody({ reviewed_head: OTHER_HEAD }), '2026-08-13T00:00:03Z')],
  [postRepairReviewSourceId, roleComment(postRepairReviewSourceId, postRepairReviewBody, '2026-08-13T00:00:03Z')],
  [rolePublicationEvent.comment.id, roleComment(rolePublicationEvent.comment.id, rolePublicationBody, '2026-08-13T00:00:04Z')],
])
const roleHost = ({ head = HEAD, taskState = implementerState, paths = rolePaths, evidence = [], sourceRecords = roleSourceRecords, taskTitle = roleTaskTitle, taskBody = roleTaskBody, taskNumber = TASK, taskIssueState = 'open', taskPullRequest = false, taskRepositoryUrl = `https://api.github.com/repos/${REPOSITORY}`, metrics = null } = {}) => ({
  api: async (endpoint) => {
    if (endpoint.endsWith(`/pulls/${PR}`)) return pullObject({ head, changedFiles: paths.length, taskState })
    if (endpoint.includes(`/pulls/${PR}/files?`)) return paths.map((filename) => ({ filename, status: 'modified' }))
    if (endpoint.endsWith(`/issues/${TASK}`)) {
      if (metrics) metrics.taskReads += 1
      return roleTaskObject({
        number: taskNumber, title: taskTitle, body: taskBody, state: taskIssueState,
        repository_url: taskRepositoryUrl,
        ...(taskPullRequest ? { pull_request: {} } : {}),
      })
    }
    if (endpoint.includes(`/issues/${TASK}/comments?`)) return structuredClone(evidence)
    const sourceMatch = /\/issues\/comments\/(\d+)$/.exec(endpoint)
    if (sourceMatch) {
      const id = Number(sourceMatch[1])
      const record = sourceRecords.get(id) ?? evidence.find((comment) => comment.id === id)
      if (record) return structuredClone(record)
    }
    throw new Error(`unexpected_role_dispatch_endpoint:${endpoint}`)
  },
})
const implementerHostMetrics = { taskReads: 0 }
const mergeDecisionHostMetrics = { taskReads: 0 }
const publicationHostMetrics = { taskReads: 0 }
const implementerPlan = await executeRoleDispatchConsumerV1({ dispatch: implementerDispatch, host: roleHost({ metrics: implementerHostMetrics }) })
const mergeDecisionPlan = await executeRoleDispatchConsumerV1({ dispatch: mergeDecisionDispatch, host: roleHost({ head: OTHER_HEAD, taskState: mergeDecisionState, metrics: mergeDecisionHostMetrics }) })
const publicationPlan = await executeRoleDispatchConsumerV1({ dispatch: publicationDispatch, host: roleHost({ metrics: publicationHostMetrics }) })
const unknownPublicationField = await executeRoleDispatchConsumerV1({ dispatch: { ...publicationDispatch, unexpected_context: 'reject' }, host: roleHost() })
const reviewerContextLeak = await executeRoleDispatchConsumerV1({ dispatch: { ...mergeDecisionDispatch, implementer_context: roleImplementerContext }, host: roleHost({ head: OTHER_HEAD, taskState: mergeDecisionState }) })
const promptSection = (prompt, start, end) => prompt.split(`${start}\n`)[1]?.split(`\n${end}`)[0]
const consumerBindingMatrix = [
  implementerPlan.next_action === 'EXECUTE_ROLE' && implementerPlan.role === 'IMPLEMENTER' && implementerPlan.read_only === false && implementerHostMetrics.taskReads === 1,
  implementerPlan.prompt.includes(`Source comment: #${roleImplementationAuthorizationId}`) && promptSection(implementerPlan.prompt, '--- BEGIN CURRENT TASK TITLE ---', '--- END CURRENT TASK TITLE ---') === roleTaskTitle && promptSection(implementerPlan.prompt, '--- BEGIN CURRENT TASK BODY ---', '--- END CURRENT TASK BODY ---') === roleTaskBody && promptSection(implementerPlan.prompt, '--- BEGIN APPROVED CORRECTION CONTEXT ---', '--- END APPROVED CORRECTION CONTEXT ---') === roleImplementationAuthorizationBody,
  mergeDecisionPlan.next_action === 'EXECUTE_ROLE' && mergeDecisionPlan.role === 'PRODUCT_OWNER_IMPLEMENTATION_LEAD' && mergeDecisionPlan.read_only === true && !Object.hasOwn(mergeDecisionDispatch, 'implementer_context') && mergeDecisionHostMetrics.taskReads === 0 && publicationPlan.next_action === 'EXECUTE_ROLE' && publicationHostMetrics.taskReads === 0,
  mergeDecisionPlan.prompt.includes(`Admission run: ${REVIEW_RUN_ID}`) && mergeDecisionPlan.provider_projection.exec_argv.includes('read-only') && implementerPlan.prompt.includes('cannot expand the authorized paths') && implementerPlan.prompt.includes('Do not fetch GitHub context') && !publicationPlan.prompt.includes('BEGIN CURRENT TASK') && !publicationPlan.prompt.includes(roleTaskBody),
  [implementerPlan, mergeDecisionPlan, publicationPlan].every((value) => value.mutation_count === 0 && value.provider_projection.exec_argv.includes('features.shell_tool=false') && value.provider_projection.exec_argv.includes('sandbox_workspace_write.network_access=false') && value.provider_projection.exec_argv.includes('sandbox_workspace_write.writable_roots=[]')) && implementerPlan.provider_projection.exec_argv.includes('workspace-write') && unknownPublicationField.reason === 'role_dispatch_envelope_invalid' && reviewerContextLeak.reason === 'role_dispatch_envelope_invalid',
]
for (const [index, evidence] of consumerBindingMatrix.entries()) check(evidence, `RDC-08 bounded source and state binding ${index + 1}`)

const implementerOutput = evaluateRoleDispatchOutputV1({ dispatch: implementerDispatch, body: roleImplementationResultBody })
const reviewerOutput = evaluateRoleDispatchOutputV1({ dispatch: reviewerDispatch, body: reviewDecisionBody({ reviewed_head: OTHER_HEAD }) })
const mergeDecisionOutput = evaluateRoleDispatchOutputV1({ dispatch: mergeDecisionDispatch, body: mergeDecisionBody() })
const invalidImplementerOutput = evaluateRoleDispatchOutputV1({ dispatch: { ...implementerDispatch, source_comment_id: 9991 }, body: roleImplementationResultBody })
const invalidPublicationOutput = evaluateRoleDispatchOutputV1({ dispatch: { ...publicationDispatch, source_comment_id: 9992 }, body: rolePublicationAuthorityBody })
const invalidMergeDecisionOutput = evaluateRoleDispatchOutputV1({ dispatch: { ...mergeDecisionDispatch, source_comment_id: 9993 }, body: mergeDecisionBody() })
const roleOutputMatrix = [
  implementerOutput.next_action === 'VALIDATE_IMPLEMENTATION',
  reviewerOutput.next_action === 'POST_REVIEW',
  mergeDecisionOutput.next_action === 'POST_MERGE_DECISION',
  invalidImplementerOutput.next_action === 'STOP' && invalidPublicationOutput.next_action === 'STOP' && invalidMergeDecisionOutput.next_action === 'STOP',
  [implementerOutput, reviewerOutput, mergeDecisionOutput, invalidImplementerOutput, invalidPublicationOutput, invalidMergeDecisionOutput].every((value) => value.mutation_count === 0),
]
for (const [index, evidence] of roleOutputMatrix.entries()) check(evidence, `RDC-09 source-record output binding ${index + 1}`)

const implementerEvidence = roleComment(9401, roleImplementationResultBody, '2026-08-13T01:00:01Z')
const reviewerEvidence = roleComment(9402, reviewDecisionBody({ reviewed_head: OTHER_HEAD }), '2026-08-13T01:00:02Z')
const mergeDecisionEvidence = roleComment(9403, mergeDecisionBody(), '2026-08-13T01:00:03Z')
const publicationEvidence = roleComment(9404, rolePublicationAuthorityBody, '2026-08-13T01:00:04Z')
const convergedImplementer = await executeRoleDispatchConsumerV1({ dispatch: implementerDispatch, host: roleHost({ evidence: [implementerEvidence] }) })
const convergedReviewer = await executeRoleDispatchConsumerV1({ dispatch: reviewerDispatch, host: roleHost({ head: OTHER_HEAD, taskState: reviewerDispatch.task_state, evidence: [reviewerEvidence] }) })
const convergedMergeDecision = await executeRoleDispatchConsumerV1({ dispatch: mergeDecisionDispatch, host: roleHost({ head: OTHER_HEAD, taskState: mergeDecisionState, evidence: [mergeDecisionEvidence] }) })
const convergedPublication = await executeRoleDispatchConsumerV1({ dispatch: publicationDispatch, host: roleHost({ evidence: [publicationEvidence] }) })
const convergenceMatrix = [
  convergedImplementer.next_action === 'CONVERGED_NOOP' && convergedImplementer.evidence_kind === 'IMPLEMENTATION_RESULT',
  convergedReviewer.next_action === 'CONVERGED_NOOP' && convergedReviewer.evidence_kind === 'REVIEW_DECISION',
  convergedMergeDecision.next_action === 'CONVERGED_NOOP' && convergedMergeDecision.evidence_kind === 'MERGE_DECISION',
  convergedPublication.next_action === 'CONVERGED_NOOP' && convergedPublication.evidence_kind === 'PUBLICATION_AUTHORITY',
  [convergedImplementer, convergedReviewer, convergedMergeDecision, convergedPublication].every((value) => value.reason === 'role_evidence_reused' && value.mutation_count === 0),
]
for (const [index, evidence] of convergenceMatrix.entries()) check(evidence, `RDC-10 idempotent evidence reuse ${index + 1}`)

const reboundImplementer = await executeRoleDispatchRebindV1({ dispatch: implementerDispatch, host: roleHost() })
const taskTitleDrift = await executeRoleDispatchConsumerV1({ dispatch: implementerDispatch, host: roleHost({ taskTitle: `${roleTaskTitle} changed` }) })
const taskBodyDriftRebind = await executeRoleDispatchRebindV1({ dispatch: implementerDispatch, host: roleHost({ taskBody: `${roleTaskBody} changed` }) })
const closedTaskConsumer = await executeRoleDispatchConsumerV1({ dispatch: implementerDispatch, host: roleHost({ taskIssueState: 'closed' }) })
const pullRequestTaskRebind = await executeRoleDispatchRebindV1({ dispatch: implementerDispatch, host: roleHost({ taskPullRequest: true }) })
const mismatchedTaskConsumer = await executeRoleDispatchConsumerV1({ dispatch: implementerDispatch, host: roleHost({ taskNumber: TASK + 1 }) })
const malformedTaskRebind = await executeRoleDispatchRebindV1({ dispatch: implementerDispatch, host: roleHost({ taskRepositoryUrl: `https://api.github.com/repos/${REPOSITORY}-other` }) })
const reboundPostRepairReviewer = await executeRoleDispatchRebindV1({
  dispatch: postRepairReviewerDispatch,
  host: roleHost({ head: postRepairReviewerDispatch.exact_head, taskState: postRepairReviewerDispatch.task_state }),
})
const implementerAuthorityDriftRecords = new Map(roleSourceRecords)
implementerAuthorityDriftRecords.set(roleImplementationAuthorizationId, roleComment(roleImplementationAuthorizationId, roleImplementationAuthorizationBody.replace('c'.repeat(64), 'd'.repeat(64)), '2026-08-13T00:00:01Z'))
const implementerAuthorityDrift = await executeRoleDispatchConsumerV1({ dispatch: implementerDispatch, host: roleHost({ sourceRecords: implementerAuthorityDriftRecords }) })
const postRepairDecisionDriftRecords = new Map(roleSourceRecords)
postRepairDecisionDriftRecords.set(postRepairReviewSourceId, roleComment(postRepairReviewSourceId, reviewDecisionBody({ reviewed_head: HEAD }), '2026-08-13T00:00:03Z'))
const postRepairDecisionDrift = await executeRoleDispatchConsumerV1({
  dispatch: postRepairReviewerDispatch,
  host: roleHost({ head: postRepairReviewerDispatch.exact_head, taskState: postRepairReviewerDispatch.task_state, sourceRecords: postRepairDecisionDriftRecords }),
})
const publicationReferenceDriftRecords = new Map(roleSourceRecords)
publicationReferenceDriftRecords.set(roleImplementationResultId, roleComment(roleImplementationResultId, roleImplementationResultBody.replace(`issuecomment-${roleImplementationAuthorizationId}`, 'issuecomment-9999'), '2026-08-13T00:00:02Z'))
const publicationReferenceDrift = await executeRoleDispatchConsumerV1({ dispatch: publicationDispatch, host: roleHost({ sourceRecords: publicationReferenceDriftRecords }) })
const postRepairCountDrifts = await Promise.all([
  { blocking_finding_count: 0, remaining_finding_count: 0 },
  { blocking_finding_count: 2, remaining_finding_count: 1 },
  { blocking_finding_count: 1, remaining_finding_count: 1, unknown_count: 1 },
].map(async (overrides) => {
  const sourceRecords = new Map(roleSourceRecords)
  sourceRecords.set(postRepairReviewSourceId, roleComment(postRepairReviewSourceId, reviewDecisionBody({
    reviewed_head: HEAD, decision: 'CHANGES_REQUIRED', blocking_finding_count: 1,
    remaining_finding_count: 1, unknown_count: 0, ...overrides,
  }), '2026-08-13T00:00:03Z'))
  return executeRoleDispatchConsumerV1({
    dispatch: postRepairReviewerDispatch,
    host: roleHost({ head: postRepairReviewerDispatch.exact_head, taskState: postRepairReviewerDispatch.task_state, sourceRecords }),
  })
}))
const reviewerDeletedRecords = new Map(roleSourceRecords)
reviewerDeletedRecords.delete(rolePublicationEvent.comment.id)
const reviewerDeletedSource = await executeRoleDispatchConsumerV1({ dispatch: reviewerDispatch, host: roleHost({ head: OTHER_HEAD, taskState: reviewerDispatch.task_state, sourceRecords: reviewerDeletedRecords }) })
const mergeSourceDriftRecords = new Map(roleSourceRecords)
mergeSourceDriftRecords.set(mergeDecisionReviewId, roleComment(mergeDecisionReviewId, reviewDecisionBody({ reviewed_head: OTHER_HEAD, decision: 'CHANGES_REQUIRED', blocking_finding_count: 1, remaining_finding_count: 1 }), '2026-08-13T00:00:03Z'))
const mergeSourceDrift = await executeRoleDispatchConsumerV1({ dispatch: mergeDecisionDispatch, host: roleHost({ head: OTHER_HEAD, taskState: mergeDecisionState, sourceRecords: mergeSourceDriftRecords }) })
const postRepairBindingDrift = await executeRoleDispatchConsumerV1({
  dispatch: Object.freeze({
    ...postRepairReviewerDispatch,
    source_binding: Object.freeze({ ...postRepairReviewerDispatch.source_binding, reviewed_head: OTHER_HEAD }),
  }),
  host: roleHost({ head: postRepairReviewerDispatch.exact_head, taskState: postRepairReviewerDispatch.task_state }),
})
const rebindMatrix = [
  reboundImplementer.next_action === 'PROTECTED_OPERATION_READY' && reboundImplementer.exact_head === HEAD && reboundPostRepairReviewer.next_action === 'PROTECTED_OPERATION_READY' && [taskTitleDrift, taskBodyDriftRebind, closedTaskConsumer, pullRequestTaskRebind, mismatchedTaskConsumer, malformedTaskRebind].every((value) => value.reason === 'role_dispatch_binding_changed'),
  implementerAuthorityDrift.next_action === 'STOP' && implementerAuthorityDrift.reason === 'role_dispatch_source_binding_changed' && postRepairDecisionDrift.next_action === 'STOP',
  publicationReferenceDrift.next_action === 'STOP' && publicationReferenceDrift.reason === 'role_dispatch_source_binding_changed' && postRepairCountDrifts.every((value) => value.next_action === 'STOP' && value.reason === 'role_dispatch_source_binding_changed'),
  reviewerDeletedSource.next_action === 'STOP' && mergeSourceDrift.next_action === 'STOP' && postRepairBindingDrift.next_action === 'STOP',
  [reboundImplementer, reboundPostRepairReviewer, taskTitleDrift, taskBodyDriftRebind, closedTaskConsumer, pullRequestTaskRebind, mismatchedTaskConsumer, malformedTaskRebind, implementerAuthorityDrift, postRepairDecisionDrift, publicationReferenceDrift, ...postRepairCountDrifts, reviewerDeletedSource, mergeSourceDrift, postRepairBindingDrift].every((value) => value.mutation_count === 0),
]
for (const [index, evidence] of rebindMatrix.entries()) check(evidence, `RDC-11 complete source authority revalidation ${index + 1}`)

const roleConsumerJob = workflow.jobs.protected_transition_role_dispatch_consumer_v1
const mergeOperatorJob = workflow.jobs.protected_transition_merge_operator_v1
const postRepairReviewJob = workflow.jobs.protected_transition_post_repair_review_v1
const roleBindRun = roleConsumerJob.steps.find((step) => step.name === 'Bind bounded role dispatch')?.run ?? ''
const roleExecutionRun = roleConsumerJob.steps.find((step) => step.name === 'Execute bounded role and host operation')?.run ?? ''
const mergeOperationRun = mergeOperatorJob.steps.find((step) => step.name === 'Perform one normal merge commit')?.run ?? ''
const boundedRoleStart = roleExecutionRun.indexOf('function Invoke-BoundedRole {')
const boundedRoleEnd = roleExecutionRun.indexOf('\n}\n\nfunction Assert-RoleOutput', boundedRoleStart)
const boundedRoleSource = boundedRoleStart >= 0 && boundedRoleEnd > boundedRoleStart ? roleExecutionRun.slice(boundedRoleStart, boundedRoleEnd + 2) : ''
const roleProviderNativeExitProbe = process.platform === 'win32' ? (() => {
  const script = `
function Invoke-NativeExitProbe {
  param([int]$ExitCode)
  node -e 'process.exit(Number(process.argv[1]))' $ExitCode
  return $LASTEXITCODE
}
[Console]::Out.Write((@{
  success = Invoke-NativeExitProbe -ExitCode 0
  failure = Invoke-NativeExitProbe -ExitCode 37
} | ConvertTo-Json -Compress))
`
  return JSON.parse(execFileSync('pwsh.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8' }))
})() : null
const terminalAgentSelectorStart = boundedRoleSource.indexOf('$terminalMessage = $null')
const terminalAgentSelectorEnd = boundedRoleSource.indexOf('[IO.File]::WriteAllText($BodyFile', terminalAgentSelectorStart)
const terminalAgentSelectorSource = terminalAgentSelectorStart >= 0 && terminalAgentSelectorEnd > terminalAgentSelectorStart ? boundedRoleSource.slice(terminalAgentSelectorStart, terminalAgentSelectorEnd) : ''
const roleProviderTerminalMessageProbe = process.platform === 'win32' ? (() => {
  const encodeLines = (lines) => Buffer.from(JSON.stringify(lines), 'utf8').toString('base64')
  const intermediate = JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: 'intermediate transport message' } })
  const canonical = JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: roleImplementationResultBody } })
  const malformed = JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: '{not valid json' } })
  const multipleEncoded = encodeLines([intermediate, intermediate, canonical, JSON.stringify({ type: 'turn.completed' })])
  const zeroEncoded = encodeLines([JSON.stringify({ type: 'thread.started' }), JSON.stringify({ type: 'turn.completed' })])
  const malformedEncoded = encodeLines([intermediate, malformed, JSON.stringify({ type: 'turn.completed' })])
  const script = `
$ErrorActionPreference = 'Stop'
function Select-TerminalAgentMessage {
  param([string[]]$events)
${terminalAgentSelectorSource}
  return $terminalMessage
}
function Read-Lines([string]$Encoded) {
  return @([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($Encoded)) | ConvertFrom-Json)
}
$zeroRejected = $false
try { Select-TerminalAgentMessage -events (Read-Lines '${zeroEncoded}') | Out-Null } catch { $zeroRejected = $_.Exception.Message -ceq 'role_provider_result_cardinality_invalid' }
[Console]::Out.Write((@{
  multiple = Select-TerminalAgentMessage -events (Read-Lines '${multipleEncoded}')
  malformed = Select-TerminalAgentMessage -events (Read-Lines '${malformedEncoded}')
  zeroRejected = $zeroRejected
} | ConvertTo-Json -Compress))
`
  return JSON.parse(execFileSync('pwsh.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8' }))
})() : null
const malformedTerminalOutput = process.platform === 'win32' ? evaluateRoleDispatchOutputV1({ dispatch: implementerDispatch, body: roleProviderTerminalMessageProbe.malformed }) : null
const workflowBoundaryMatrix = [
  roleBindRun.includes("operation=CONVERGED_NOOP") && roleConsumerJob.steps.find((step) => step.name === 'Execute bounded role and host operation')?.if === "steps.role_dispatch_plan.outputs.operation == 'EXECUTE_ROLE'",
  boundedRoleSource.startsWith('function Invoke-BoundedRole {') && !boundedRoleSource.includes('$LASTEXITCODE = $null') && boundedRoleSource.indexOf('codex.cmd exec') < boundedRoleSource.indexOf('$nativeExit = $LASTEXITCODE') && terminalAgentSelectorSource.includes('$terminalMessage = [string]$event.item.text') && !terminalAgentSelectorSource.includes('$messages +=') && (process.platform !== 'win32' || (roleProviderNativeExitProbe.success === 0 && roleProviderNativeExitProbe.failure === 37 && roleProviderTerminalMessageProbe.multiple === roleImplementationResultBody && roleProviderTerminalMessageProbe.zeroRejected === true && malformedTerminalOutput.next_action === 'STOP')) && roleExecutionRun.split('Assert-FreshRoleBinding').length >= 7 && roleExecutionRun.includes("-Operation 'commit_push'") && roleExecutionRun.includes("-Operation 'publication_handoff'"),
  postRepairReviewJob.steps.find((step) => step.name === 'Bind post-repair Independent Reviewer')?.run.includes('task_state = $state') && postRepairReviewJob.steps.find((step) => step.name === 'Execute and publish post-repair Review')?.run.includes('--role-rebind-file'),
  runnerSource.includes('verifyMergeDecisionGateV1') && runnerSource.includes("next_action: 'CONVERGED_NOOP'") && runnerSource.includes('result.authorizationCommentId === dispatch.source_comment_id'),
  mergeOperatorJob?.if === "needs.protected_transition_admission_v1.outputs.next_action == 'MERGE_OPERATOR'" && mergeOperationRun.includes('--merge-operator-file $dispatchPath') && mergeOperationRun.indexOf('--merge-operator-file $dispatchPath') < mergeOperationRun.indexOf('--method PUT') && mergeOperationRun.includes("merge_method = 'merge'") && !mergeOperationRun.includes('--force'),
]
for (const [index, evidence] of workflowBoundaryMatrix.entries()) check(evidence, `RDC-12 protected operation boundaries ${index + 1}`)

if (assertions !== 576) throw new Error(`expected exactly 576 assertions, observed ${assertions}`)
process.stdout.write(`protected-transition-admission-v1: ${assertions} assertions passed\n`)
