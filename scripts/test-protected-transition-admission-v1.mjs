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
  executeReadyForReviewProgressionV1,
  executeReviewApprovalAutomationV1,
  executeProtectedTransitionAdmissionV1,
  extractProtectedTransitionTaskStateV1,
  parseIndependentReviewDecisionProjectionV1,
  parseReviewApprovalEventV1,
  projectProtectedTransitionReviewStateV1,
  resolveEffectiveReviewDecisionV1,
} from './run-protected-transition-admission-v1.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const REPOSITORY = 'whatrune/sd-prompt-studio'
const TASK = 259
const PR = 260
const HEAD = 'a'.repeat(40)
const OTHER_HEAD = 'b'.repeat(40)
const BASE = 'bc5c745c9b772c38a68d2e49a155710212711184'
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

const changedPaths = execFileSync('git', ['diff', '--name-only', BASE], { cwd: repositoryRoot, encoding: 'utf8' }).trim().split(/\r?\n/).filter(Boolean)
const expectedPaths = [
  '.github/workflows/protected-transition-admission-v1.yml',
  'scripts/run-protected-transition-admission-v1.mjs',
  'scripts/test-protected-transition-admission-v1.mjs',
  'src/continuous-orchestration/protected-transition-admission-v1.ts',
]
check(changedPaths.join('\n') === expectedPaths.join('\n'), 'final cumulative diff is exactly four paths')
const productionSource = `${workflowSource}\n${runnerSource}\n${coreSource}`
check(!/(trust_root|revocation|ready_generation|producer_roster|assignment_record|finalization_binding|collector|\.jcs|upload-artifact)/i.test(productionSource), 'retired mechanisms are absent')
check(runnerSource.includes('/comments?since=') && runnerSource.includes('pageNumber > 32'), 'runner uses bounded forward-only Review pagination')
check(runnerSource.includes('acquireTaskIdentityV1') && runnerSource.includes('acquireChangedPathScopeV1') && runnerSource.includes('executeManualProgressionControllerV1'), 'runner owns direct Task, scope, and manual progression composition')
check(runnerSource.includes('previous_filename') && runnerSource.includes('state_changed_during_evaluation'), 'runner checks rename and late state change')
check(!workflowSource.includes('pnpm install') && !workflowSource.includes('actions: read') && !workflowSource.includes('upload-artifact') && !workflowSource.includes('gh workflow run'), 'workflow has no dependency install, nested dispatch, or artifact permission/persistence')
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
})

const automationHost = ({
  initialState = state(),
  changedFiles = 0,
  filePages = [[]],
  commentPages = [[reviewEvent().comment]],
  headAtPullRead = {},
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
  const metrics = { patchCalls: 0, pullReads: 0, fileReads: 0, commentReads: 0, checkReads: 0, threadReads: 0 }
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
      graphql: async (query) => {
        if (graphqlFailure) throw graphqlFailure
        if (query.includes('statusCheckRollup')) {
          metrics.checkReads += 1
          const page = checkPages[metrics.checkReads - 1] ?? checkPages.at(-1)
          return structuredClone({
            repository: {
              object: {
                oid: currentHead,
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

const validReadyAutomation = automationHost({ initialState: approvedState() })
const validReadyResult = await executeReadyForReviewProgressionV1({ event: readyEvent(), host: validReadyAutomation.host })
check(validReadyResult.allowed === true && validReadyResult.automation_status === 'HANDOFF_READY' && validReadyResult.next_action === 'MERGE_OPERATOR', 'RFR-02 valid Ready event reaches the existing Controller handoff')
check(validReadyResult.task_issue_number === TASK && validReadyResult.pr_number === PR && validReadyResult.current_head === HEAD, 'RFR-02 derives exact Task, PR, and HEAD')
check(validReadyAutomation.metrics.patchCalls === 0 && validReadyAutomation.metrics.checkReads === 1 && validReadyAutomation.metrics.threadReads === 1, 'RFR-02 Ready adapter is read-only and reuses the terminal gate')

const wrongReadyResult = await executeReadyForReviewProgressionV1({ event: readyEvent({ action: 'opened' }), host: { api: async () => { throw new Error('host_must_not_be_called') } } })
const missingReadyResult = await executeReadyForReviewProgressionV1({ event: readyEvent({ repository: null }), host: { api: async () => { throw new Error('host_must_not_be_called') } } })
const malformedReadyResult = await executeReadyForReviewProgressionV1({ event: readyEvent({ pull: { body: 'no state' } }), host: { api: async () => { throw new Error('host_must_not_be_called') } } })
check(wrongReadyResult.state === 'INDETERMINATE' && wrongReadyResult.reason === 'ready_event_invalid', 'RFR-03 wrong Ready action fails closed')
check(missingReadyResult.state === 'INDETERMINATE' && missingReadyResult.reason === 'ready_event_invalid', 'RFR-03 missing repository identity fails closed')
check(malformedReadyResult.state === 'INDETERMINATE' && malformedReadyResult.reason === 'state_block_cardinality_invalid', 'RFR-03 malformed state fails closed before acquisition')

const readyPrMismatch = automationHost({ initialState: approvedState() })
const readyPrMismatchResult = await executeReadyForReviewProgressionV1({
  event: readyEvent({ pull: { body: stateBlock(state({ pr_number: PR + 1, review_status: 'APPROVE', reviewed_head: HEAD, review_blocker_count: 0 })) } }),
  host: readyPrMismatch.host,
})
const readyTaskMismatch = automationHost({ initialState: approvedState() })
const readyTaskMismatchResult = await executeReadyForReviewProgressionV1({
  event: readyEvent({ pull: { body: stateBlock(state({ task_issue_number: TASK + 1, review_status: 'APPROVE', reviewed_head: HEAD, review_blocker_count: 0 })) } }),
  host: readyTaskMismatch.host,
})
check(readyPrMismatchResult.state === 'INDETERMINATE' && readyPrMismatchResult.reason === 'ready_event_pr_binding_mismatch', 'RFR-04 event/state PR mismatch fails closed')
check(readyTaskMismatchResult.state === 'INDETERMINATE' && readyTaskMismatchResult.reason === 'task_identity_invalid', 'RFR-04 event-derived Task must match fresh repository reality')
check(readyPrMismatch.metrics.patchCalls === 0 && readyTaskMismatch.metrics.patchCalls === 0, 'RFR-04 identity mismatch performs no state mutation')

const readyHeadMismatch = automationHost({ initialState: approvedState() })
const readyHeadMismatchResult = await executeReadyForReviewProgressionV1({
  event: readyEvent({ pull: { body: stateBlock(state({ observed_head: OTHER_HEAD, review_status: 'APPROVE', reviewed_head: OTHER_HEAD, review_blocker_count: 0 })) } }),
  host: readyHeadMismatch.host,
})
check(readyHeadMismatchResult.state === 'STALE' && readyHeadMismatchResult.reason === 'head_binding_stale', 'RFR-05 event/state HEAD mismatch is stale')
check(readyHeadMismatchResult.allowed === false && readyHeadMismatchResult.next_action === 'STOP', 'RFR-05 stale Ready event cannot advance')
check(readyHeadMismatch.metrics.pullReads === 0 && readyHeadMismatch.metrics.patchCalls === 0, 'RFR-05 stale Ready event stops before acquisition or mutation')

const draftReadyResult = await executeReadyForReviewProgressionV1({ event: readyEvent({ pull: { draft: true } }), host: { api: async () => { throw new Error('host_must_not_be_called') } } })
const pendingReadyAutomation = automationHost({ initialState: state() })
const pendingReadyResult = await executeReadyForReviewProgressionV1({ event: readyEvent({ pull: { body: stateBlock(state()) } }), host: pendingReadyAutomation.host })
const scopeReadyAutomation = automationHost({ initialState: approvedState(), changedFiles: 1, filePages: [[{ filename: 'outside.ts', status: 'modified' }]] })
const scopeReadyResult = await executeReadyForReviewProgressionV1({ event: readyEvent(), host: scopeReadyAutomation.host })
check(draftReadyResult.state === 'REVIEW_PENDING' && draftReadyResult.next_action === 'NONE' && draftReadyResult.reason === 'pull_not_ready', 'RFR-06 Draft Ready event reuses waiting behavior')
check(pendingReadyResult.state === 'REVIEW_PENDING' && pendingReadyResult.next_action === 'NONE' && pendingReadyAutomation.metrics.patchCalls === 0, 'RFR-06 pending Review reuses existing stop behavior')
check(scopeReadyResult.state === 'IMPLEMENTATION_BLOCKED' && scopeReadyResult.reason === 'scope_outside_authorized_paths' && scopeReadyAutomation.metrics.patchCalls === 0, 'RFR-06 scope overflow reuses existing fail-closed behavior')

const duplicateReadyAutomation = automationHost({ initialState: approvedState() })
const duplicateReadyFirst = await executeReadyForReviewProgressionV1({ event: readyEvent(), host: duplicateReadyAutomation.host })
const duplicateReadyBody = duplicateReadyAutomation.body()
const duplicateReadySecond = await executeReadyForReviewProgressionV1({ event: readyEvent(), host: duplicateReadyAutomation.host })
check(JSON.stringify(duplicateReadyFirst) === JSON.stringify(duplicateReadySecond), 'RFR-07 duplicate Ready event converges to the same result')
check(duplicateReadyAutomation.metrics.patchCalls === 0 && duplicateReadyAutomation.metrics.checkReads === 2 && duplicateReadyAutomation.metrics.threadReads === 2, 'RFR-07 duplicate Ready event remains read-only with one gate evaluation per event')
check(duplicateReadyAutomation.body() === duplicateReadyBody, 'RFR-07 duplicate Ready event does not mutate state')

// Ten writer/orchestration/idempotency/race units x three assertions = 30.
const validAutomation = automationHost()
const validAutomationResult = await executeReviewApprovalAutomationV1({ event: reviewEvent(), host: validAutomation.host })
const validWrittenState = extractProtectedTransitionTaskStateV1(validAutomation.body())
check(validAutomationResult.allowed && validAutomationResult.automation_status === 'HANDOFF_READY' && validAutomationResult.next_action === 'MERGE_OPERATOR', 'valid Review reaches the merge operator handoff')
check(validAutomation.metrics.patchCalls === 1 && validAutomationResult.admission_executed === true && validAutomation.metrics.checkReads === 1 && validAutomation.metrics.threadReads === 1, 'valid Review performs one PATCH, admission, and terminal gate')
check(validWrittenState.observed_head === HEAD && validWrittenState.review_status === 'APPROVE' && validWrittenState.reviewed_head === HEAD && validWrittenState.review_blocker_count === 0 && validWrittenState.record_type === state().record_type && validWrittenState.task_issue_number === TASK && validWrittenState.pr_number === PR && validWrittenState.authorized_paths.join(',') === ALLOWED.join(',') && validWrittenState.architecture_status === 'APPROVED' && validWrittenState.implementation_authorized === true, 'valid Review changes four fields and preserves six')

const convergedAutomation = automationHost({ initialState: approvedState() })
const convergedResult = await executeReviewApprovalAutomationV1({ event: reviewEvent(), host: convergedAutomation.host })
check(convergedResult.allowed && convergedResult.automation_status === 'HANDOFF_READY', 'converged Review returns stable merge-gate handoff')
check(convergedAutomation.metrics.patchCalls === 0 && convergedResult.admission_executed === true && convergedAutomation.metrics.checkReads === 1 && convergedAutomation.metrics.threadReads === 1, 'converged Review performs no duplicate mutation and re-evaluates the read-only gate')
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
check(mergeSuccess.metrics.pullReads === 3 && mergeSuccess.metrics.fileReads === 1 && mergeSuccess.metrics.checkReads === 1 && mergeSuccess.metrics.threadReads === 1 && mergeSuccess.metrics.patchCalls === 0, 'merge gate is read-only and freshly re-admits one complete snapshot')

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
  ],
})
const pagedChecksResult = await evaluateMergeAllowedAutomationV1({ request: mergeRequest, admitted: mergeAdmitted, host: pagedChecks.host })
check(pagedChecksResult.allowed && pagedChecksResult.automation_status === 'MERGE_ALLOWED', 'complete multi-page checks can advance')
check(pagedChecks.metrics.checkReads === 2 && pagedChecks.metrics.threadReads === 1, 'check pagination reaches its terminal page')
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
const taskChangedPaths = execFileSync('git', ['diff', '--name-only', 'd39c58329eb8e0b52aabc831be024b940b6d41df'], { cwd: repositoryRoot, encoding: 'utf8' }).trim().split(/\r?\n/).filter(Boolean)
check(JSON.stringify(retryGateFirst) === JSON.stringify(retryGateSecond), 'identical retry converges to the same result')
check(retryGate.metrics.patchCalls === 0 && retryGate.metrics.pullReads === 6 && retryGate.metrics.fileReads === 2 && retryGate.metrics.checkReads === 2 && retryGate.metrics.threadReads === 2, 'identical retry remains read-only')
check(taskChangedPaths.join('\n') === ['.github/workflows/protected-transition-admission-v1.yml', 'scripts/run-protected-transition-admission-v1.mjs', 'scripts/test-protected-transition-admission-v1.mjs'].join('\n'), 'current Task diff is exactly three paths')

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

if (assertions !== 294) throw new Error(`expected exactly 294 assertions, observed ${assertions}`)
process.stdout.write(`protected-transition-admission-v1: ${assertions} assertions passed\n`)
