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
  evaluateCodexCloudTaskStatusV2,
  evaluateProgressionControllerV1,
  evaluateMergeAllowedAutomationV1,
  executeRepairExecutorV1,
  executeReadyForReviewProgressionV1,
  executeReviewApprovalAutomationV1,
  executeProtectedTransitionAdmissionV1,
  executeRepairProviderBindingV2,
  extractProtectedTransitionTaskStateV1,
  isRepairProfilePathV1,
  parseIndependentReviewDecisionProjectionV1,
  parseCodexCloudTaskSubmissionV2,
  parseReviewApprovalEventV1,
  projectProtectedTransitionReviewStateV1,
  projectCodexCloudRepairProviderV2,
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
const BASE = '5c6885a4f76712fde940e39587f3a88f9d4697a6'
const ALLOWED = ['scripts/run-protected-transition-admission-v1.mjs', 'src/continuous-orchestration/protected-transition-admission-v1.ts']
let assertions = 0

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
check(workflowSource.includes('pnpm install --frozen-lockfile') && !workflowSource.includes('actions: read') && !workflowSource.includes('upload-artifact') && !workflowSource.includes('gh workflow run'), 'workflow uses frozen repair dependencies without nested dispatch or artifact permission/persistence')
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
check(blockingReview.review.blocking_finding_count === 1 && blockingReviewResult.state === 'REVIEW_BLOCKED', 'blocking count is retained and blocks')
check(blockingReviewResult.state_changed === false && blockingReviewResult.admission_executed === false, 'blocking count prevents mutation and admission')

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
  const metrics = { patchCalls: 0, pullReads: 0, fileReads: 0, commentReads: 0, checkReads: 0, threadReads: 0, waitCalls: 0 }
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
        if (endpoint.includes('/comments?')) {
          metrics.commentReads += 1
          const page = Number(new URL(`https://api.github.com/${endpoint}`).searchParams.get('page') ?? '1')
          return structuredClone(commentPages[page - 1] ?? [])
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
check(validReadyResult.allowed === true && validReadyResult.automation_status === 'HANDOFF_READY' && validReadyResult.next_action === 'MERGE_OPERATOR', 'RFR-02 valid Ready event reaches the existing Controller handoff')
check(validReadyResult.task_issue_number === TASK && validReadyResult.pr_number === PR && validReadyResult.current_head === HEAD, 'RFR-02 derives exact Task, PR, and HEAD')
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
check(delayedReadyResult.allowed && delayedReadyResult.next_action === 'MERGE_OPERATOR', 'RFR-08 delayed exact-HEAD check reaches the existing Controller after terminal success')
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
check(historicalReadyResult.allowed && historicalReadyResult.next_action === 'MERGE_OPERATOR', 'RFR-12 historical same-identity success and failure do not block the selected current generation')
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
check(missingRawReadySelfResult.reason === 'ready_current_check_missing' && duplicateRawReadySelfResult.reason === 'ready_current_check_cardinality_invalid', 'RFR-15 raw missing and duplicate self semantics remain unchanged')
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
const blockedResult = await executeReviewApprovalAutomationV1({ event: blockedEvent, host: blockedAutomation.host })
const blockedWritten = extractProtectedTransitionTaskStateV1(blockedAutomation.body())
check(blockedResult.state === 'REVIEW_BLOCKED' && blockedResult.allowed === false, 'later BLOCKED revokes eligibility')
check(blockedAutomation.metrics.patchCalls === 1 && blockedResult.admission_executed === false, 'later BLOCKED writes once without admission')
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
const zeroChecks = automationHost({ initialState: approvedState(), checkPages: [connectionPage([])] })
const missingChecksResult = await evaluateMergeAllowedAutomationV1({ request: mergeRequest, admitted: mergeAdmitted, host: missingChecks.host })
const zeroChecksResult = await evaluateMergeAllowedAutomationV1({ request: mergeRequest, admitted: mergeAdmitted, host: zeroChecks.host })
check(missingChecksResult.state === 'INDETERMINATE' && missingChecksResult.reason === 'check_rollup_page_invalid', 'missing check rollup fails closed')
check(zeroChecksResult.state === 'INDETERMINATE' && zeroChecksResult.reason === 'checks_missing', 'zero current check contexts fail closed')
check(missingChecks.metrics.threadReads === 0 && zeroChecks.metrics.threadReads === 0, 'missing checks stop before thread acquisition')

const pendingChecks = automationHost({
  initialState: approvedState(),
  checkPages: [connectionPage([{ ...successfulCheck(), status: 'IN_PROGRESS', conclusion: null }])],
})
const pendingChecksResult = await evaluateMergeAllowedAutomationV1({ request: mergeRequest, admitted: mergeAdmitted, host: pendingChecks.host })
check(pendingChecksResult.state === 'INDETERMINATE' && pendingChecksResult.reason === 'checks_not_terminal', 'non-terminal check is indeterminate')
check(pendingChecksResult.allowed === false && pendingChecksResult.next_action === 'STOP', 'non-terminal check cannot advance')
check(pendingChecks.metrics.checkReads === 1 && pendingChecks.metrics.threadReads === 0, 'non-terminal check stops before threads')

const failedChecks = automationHost({
  initialState: approvedState(),
  checkPages: [connectionPage([{ ...successfulCheck(), conclusion: 'FAILURE' }])],
})
const failedChecksResult = await evaluateMergeAllowedAutomationV1({ request: mergeRequest, admitted: mergeAdmitted, host: failedChecks.host })
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
  threadPages: [connectionPage([{ id: 'thread-1', isResolved: false, isOutdated: false }])],
})
const blockingThreadsResult = await evaluateMergeAllowedAutomationV1({ request: mergeRequest, admitted: mergeAdmitted, host: blockingThreads.host })
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
const selfAwareMergeRequest = Object.freeze({ ...mergeRequest, currentWorkflowRunId: READY_RUN_ID })
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
  checkPages: [stableGenerationPage(), stableGenerationPage()],
})
const selfAwareUnstableResult = await evaluateMergeAllowedAutomationV1({ request: selfAwareMergeRequest, admitted: mergeAdmitted, host: selfAwareUnstable.host })
check(selfAwareUnstableResult.state === 'MERGE_ELIGIBLE' && selfAwareUnstableResult.allowed, 'MGA-01 older same-identity success and failure generations are excluded')
check(selfAwareUnstableResult.automation_status === 'MERGE_ALLOWED' && selfAwareUnstableResult.reason === 'merge_gate_satisfied', 'MGA-01 selected self and other-app same-name success establish effective clean')
check(selfAwareUnstable.metrics.checkReads === 2 && selfAwareUnstable.metrics.threadReads === 1 && selfAwareUnstable.metrics.pullReads === 3, 'MGA-01 independently reduces initial and final complete snapshots')

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
check(missingInitialSelfResult.state === 'INDETERMINATE' && missingInitialSelfResult.reason === 'ready_current_check_cardinality_invalid' && missingInitialSelf.metrics.threadReads === 0, 'MGA-02 missing initial raw self fails closed')
check(duplicateFinalSelfResult.state === 'INDETERMINATE' && duplicateFinalSelfResult.reason === 'ready_current_check_cardinality_invalid' && duplicateFinalSelf.metrics.threadReads === 1, 'MGA-02 duplicate final raw self fails closed')
check(newerInitialGenerationResult.reason === 'ready_current_check_not_selected_generation' && tiedInitialGenerationResult.reason === 'check_generation_ambiguous' && malformedInitialGenerationResult.reason === 'check_generation_identity_invalid', 'MGA-02 newer non-self, tied latest, and malformed generation identity fail closed')

const latePendingCheck = automationHost({
  initialState: approvedState(),
  mergeableState: 'unstable',
  checkPages: [
    readyCheckPage(),
    readyCheckPage({ ...successfulCheck('late-pending'), status: 'IN_PROGRESS', conclusion: null }),
  ],
})
const lateFailedCheck = automationHost({
  initialState: approvedState(),
  mergeableState: 'unstable',
  checkPages: [readyCheckPage(), readyCheckPage({ ...successfulCheck('late-failed'), conclusion: 'FAILURE' })],
})
const otherAppSameNameFailure = automationHost({
  initialState: approvedState(),
  mergeableState: 'unstable',
  checkPages: [connectionPage([
    currentReadyCheck(),
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
const latePendingCheckResult = await evaluateMergeAllowedAutomationV1({ request: selfAwareMergeRequest, admitted: mergeAdmitted, host: latePendingCheck.host })
const lateFailedCheckResult = await evaluateMergeAllowedAutomationV1({ request: selfAwareMergeRequest, admitted: mergeAdmitted, host: lateFailedCheck.host })
const otherAppSameNameFailureResult = await evaluateMergeAllowedAutomationV1({ request: selfAwareMergeRequest, admitted: mergeAdmitted, host: otherAppSameNameFailure.host })
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
const selfAwareConflictResult = await evaluateMergeAllowedAutomationV1({ request: selfAwareMergeRequest, admitted: mergeAdmitted, host: selfAwareConflict.host })
const nonSelfUnstableResult = await evaluateMergeAllowedAutomationV1({ request: mergeRequest, admitted: mergeAdmitted, host: nonSelfUnstable.host })
check(finalCheckHeadDriftResult.state === 'STALE' && finalCheckHeadDriftResult.reason === 'head_changed_during_merge_gate', 'MGA-04 final check snapshot HEAD drift is stale')
check(finalCheckPaginationFailureResult.state === 'INDETERMINATE' && finalCheckPaginationFailureResult.reason === 'check_rollup_page_invalid', 'MGA-04 final check pagination failure is indeterminate')
check(selfAwareConflictResult.state === 'IMPLEMENTATION_BLOCKED' && nonSelfUnstableResult.state === 'IMPLEMENTATION_BLOCKED' && selfAwareConflict.metrics.checkReads === 0 && nonSelfUnstable.metrics.checkReads === 0, 'MGA-04 conflict and non-self-aware UNSTABLE remain blocked')

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
  instruction: 'Fix current blocking findings only; use current authorized_paths; stop on Architecture gap; run focused validation.',
  ...overrides,
})
const expectedRepairPrompt = `${repairDispatch().instruction}\n\nCurrent repair tuple:\nRepository: ${REPOSITORY}\nTask: #${TASK}\nPR: #${PR}\nExact HEAD: ${HEAD}\n\nCurrent authorized_paths:\n${JSON.stringify([...REPAIR_PATHS].sort())}\n\nCurrent review decision:\ncurrent blocking findings`
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
const repairHost = ({ head = HEAD, remoteHead = head, headRepository = REPOSITORY, paths = REPAIR_PATHS, body = stateBlock(repairTaskState()) } = {}) => {
  const metrics = { pullReads: 0, fileReads: 0, branchReads: 0, patches: 0 }
  let currentBody = body
  const host = {
    api: async (endpoint, options) => {
      if (endpoint === `repos/${REPOSITORY}/pulls/${PR}`) {
        if (options?.method === 'PATCH') {
          metrics.patches += 1
          currentBody = options.body.body
        } else {
          metrics.pullReads += 1
        }
        return repairPull({ head, headRepository, paths, body: currentBody })
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
// Twenty fixed Repair Executor units x three assertions = 60.
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
]
for (const unit of repairUnits) {
  check(unit.result.reason === unit.reason, `${unit.name} reason`)
  check(unit.result.next_action === unit.next, `${unit.name} next action`)
  check(unit.evidence(unit.result), `${unit.name} exact evidence`)
}

const providerSubmitHost = repairHost()
const providerSubmit = await executeRepairProviderBindingV2({
  boundary: 'pre_submit',
  dispatch: repairDispatch(),
  host: providerSubmitHost.host,
  localPaths: [],
  environmentId: 'env_repair',
  credentialPresent: true,
  runAttempt: 1,
})
const oversizedPromptHost = repairHost()
const oversizedPrompt = await executeRepairProviderBindingV2({
  boundary: 'pre_submit',
  dispatch: repairDispatch({ review_body: 'x'.repeat(4096) }),
  host: oversizedPromptHost.host,
  localPaths: [],
  environmentId: 'env_repair',
  credentialPresent: true,
  runAttempt: 1,
})
const missingCredentialHost = repairHost()
const missingCredential = await executeRepairProviderBindingV2({
  boundary: 'pre_submit',
  dispatch: repairDispatch(),
  host: missingCredentialHost.host,
  localPaths: [],
  environmentId: 'env_repair',
  credentialPresent: false,
  runAttempt: 1,
})
const missingEnvironmentHost = repairHost()
const missingEnvironment = await executeRepairProviderBindingV2({
  boundary: 'pre_submit',
  dispatch: repairDispatch(),
  host: missingEnvironmentHost.host,
  localPaths: [],
  environmentId: '',
  credentialPresent: true,
  runAttempt: 1,
})
const providerRemoteDriftHost = repairHost({ remoteHead: OTHER_HEAD })
const providerRemoteDrift = await executeRepairProviderBindingV2({
  boundary: 'pre_submit', dispatch: repairDispatch(), host: providerRemoteDriftHost.host, localPaths: [], environmentId: 'env_repair', credentialPresent: true, runAttempt: 1,
})
const providerDirtyHost = repairHost()
const providerDirty = await executeRepairProviderBindingV2({
  boundary: 'pre_submit', dispatch: repairDispatch(), host: providerDirtyHost.host, localPaths: [REPAIR_PATHS[0]], environmentId: 'env_repair', credentialPresent: true, runAttempt: 1,
})
const providerPullDriftHost = repairHost({ head: OTHER_HEAD })
const providerPullDrift = await executeRepairProviderBindingV2({
  boundary: 'pre_submit', dispatch: repairDispatch(), host: providerPullDriftHost.host, localPaths: [], environmentId: 'env_repair', credentialPresent: true, runAttempt: 1,
})
const rerunProviderHost = repairHost()
const rerunProvider = await executeRepairProviderBindingV2({
  boundary: 'pre_submit', dispatch: repairDispatch(), host: rerunProviderHost.host, localPaths: [], environmentId: 'env_repair', credentialPresent: true, runAttempt: 2,
})
const exactTask = parseCodexCloudTaskSubmissionV2('https://chatgpt.com/codex/tasks/task_i_exact\n')
const ambiguousTaskError = await errorOf(async () => parseCodexCloudTaskSubmissionV2('https://chatgpt.com/codex/tasks/task_a\nhttps://chatgpt.com/codex/tasks/task_b\n'))
const pendingTask = evaluateCodexCloudTaskStatusV2({ output: '[PENDING] current repair\n', exitCode: 1 })
const readyTask = evaluateCodexCloudTaskStatusV2({ output: '[READY] current repair\n', exitCode: 0 })
const failedTask = evaluateCodexCloudTaskStatusV2({ output: '[ERROR] current repair\n', exitCode: 1 })
const timedOutTask = evaluateCodexCloudTaskStatusV2({ output: '[PENDING] current repair\n', exitCode: 1, timedOut: true })
const providerApplyBranchHost = repairHost()
const providerApplyBranchDrift = await executeRepairProviderBindingV2({
  boundary: 'pre_apply', dispatch: repairDispatch(), host: providerApplyBranchHost.host, providerBranch: 'codex/stale', localPaths: [], environmentId: 'env_repair', credentialPresent: true, runAttempt: 1,
})
const providerApplyHost = repairHost()
const providerApply = await executeRepairProviderBindingV2({
  boundary: 'pre_apply', dispatch: repairDispatch(), host: providerApplyHost.host, providerBranch: 'codex/repair', localPaths: [], environmentId: 'env_repair', credentialPresent: true, runAttempt: 1,
})
const taskProjection = projectCodexCloudRepairProviderV2({
  providerBranch: 'codex/repair', prompt: 'current repair', environmentId: 'env_repair', credentialPresent: true, runAttempt: 1, taskId: exactTask.task_id,
})
const forbiddenProviderMechanisms = ['task_source_sha', 'provider_receipt', 'provider_digest', 'provider_branch_lock']

// Eight Codex Cloud provider-boundary units x three assertions = 24.
const providerUnits = [
  {
    name: 'mandatory explicit canonical PR branch',
    evidence: [
      providerSubmit.reason === 'repair_provider_submit_binding_satisfied' && providerSubmit.provider_branch === 'codex/repair',
      providerSubmit.provider_projection.submit_argv.join('|') === 'cloud|exec|--env|env_repair|--attempts|1|--branch|codex/repair|-',
      workflowSource.split('--branch "$REPAIR_PROVIDER_BRANCH"').length === 2 && !workflowSource.includes('--branch main'),
    ],
  },
  {
    name: 'bounded current-only prompt and exact tuple',
    evidence: [
      Buffer.from(providerSubmit.prompt, 'utf8').equals(Buffer.from(expectedRepairPrompt, 'utf8')) && providerSubmit.provider_projection.prompt_bytes === Buffer.byteLength(expectedRepairPrompt, 'utf8'),
      providerSubmit.prompt.includes(`Current repair tuple:\nRepository: ${REPOSITORY}\nTask: #${TASK}\nPR: #${PR}\nExact HEAD: ${HEAD}\n`) && providerSubmit.provider_projection.prompt_bytes <= 4096 && oversizedPrompt.reason === 'repair_provider_prompt_too_large' && oversizedPrompt.next_action === 'STOP',
      providerSubmit.exact_head === HEAD && providerSubmitHost.metrics.pullReads === 1 && providerSubmitHost.metrics.branchReads === 1,
    ],
  },
  {
    name: 'credential and environment stop before submit',
    evidence: [
      missingCredential.reason === 'repair_provider_credential_missing' && missingCredential.next_action === 'STOP',
      missingEnvironment.reason === 'repair_provider_environment_missing' && missingEnvironment.next_action === 'STOP',
      !workflowSource.includes('CODEX_API_KEY') && !workflowSource.includes('OPENAI_API_KEY') && !workflowSource.includes('openai/codex-action'),
    ],
  },
  {
    name: 'pre-submit reviewed tuple and clean checkout',
    evidence: [
      providerPullDrift.reason === 'repair_pull_binding_invalid' && providerPullDriftHost.metrics.branchReads === 0,
      providerRemoteDrift.reason === 'repair_remote_head_changed' && providerRemoteDriftHost.metrics.branchReads === 1,
      providerDirty.reason === 'repair_provider_worktree_not_clean' && providerDirty.next_action === 'STOP',
    ],
  },
  {
    name: 'one exact task serialization and no resubmit',
    evidence: [
      exactTask.task_id === 'task_i_exact' && ambiguousTaskError?.message === 'repair_provider_task_identity_invalid',
      rerunProvider.reason === 'repair_provider_rerun_forbidden' && rerunProvider.next_action === 'STOP',
      workflowSource.split('codex cloud exec').length === 2 && workflowSource.split('--attempts 1').length === 2 && workflowSource.includes('cancel-in-progress: false'),
    ],
  },
  {
    name: 'terminal timeout quota failure without apply',
    evidence: [
      pendingTask.next_action === 'WAIT' && readyTask.next_action === 'APPLY_REPAIR_TASK',
      failedTask.reason === 'repair_provider_task_failed' && failedTask.next_action === 'STOP',
      timedOutTask.reason === 'repair_provider_timeout' && timedOutTask.next_action === 'STOP' && workflowSource.includes('deadline=$((SECONDS + 1200))'),
    ],
  },
  {
    name: 'pre-apply tuple and exact local apply failures',
    evidence: [
      providerApplyBranchDrift.reason === 'repair_provider_branch_changed' && providerApplyBranchDrift.next_action === 'STOP',
      taskProjection.status_argv.join('|') === 'cloud|status|task_i_exact' && taskProjection.apply_argv.join('|') === 'apply|task_i_exact',
      postAgentEmpty.next_action === 'STOP' && postAgentEscape.next_action === 'STOP',
    ],
  },
  {
    name: 'successful uncommitted exact-scope lifecycle return',
    evidence: [
      providerApply.reason === 'repair_provider_apply_binding_satisfied' && providerApply.next_action === 'APPLY_REPAIR_TASK',
      postAgentAllowed.next_action === 'VALIDATE_REPAIR' && postAgentAllowed.repair_paths.join('|') === [...REPAIR_PATHS].sort().join('|'),
      forbiddenProviderMechanisms.every((needle) => !workflowSource.includes(needle) && !runnerSource.includes(needle)) && workflowSource.includes('codex apply "$REPAIR_PROVIDER_TASK_ID"'),
    ],
  },
]
for (const unit of providerUnits) {
  for (const [index, evidence] of unit.evidence.entries()) check(evidence, `${unit.name} evidence ${index + 1}`)
}

if (assertions !== 420) throw new Error(`expected exactly 420 assertions, observed ${assertions}`)
process.stdout.write(`protected-transition-admission-v1: ${assertions} assertions passed\n`)
