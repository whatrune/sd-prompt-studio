export const projectMergeOperatorWorkflowResultV1 = ({ plan, expectedHead }) => {
  if (plan?.next_action === 'NONE' && plan?.reason === 'already_merged') {
    return Object.freeze({ operation: 'NONE' })
  }
  if (
    plan?.next_action !== 'MERGE_PR' || plan?.merge_method !== 'merge' ||
    plan?.exact_head !== expectedHead
  ) throw new Error('merge_operator_plan_invalid')
  return Object.freeze({
    operation: 'MERGE_PR',
    pr_number: plan.pr_number,
    exact_head: plan.exact_head,
  })
}

export const createMergeOperatorPreflightOwnerV1 = ({
  REPOSITORY,
  FULL_HEAD,
  WORKFLOW_RUN_ID,
  MERGE_DECISION_OWNER_SELF_CHECK_CONTEXT_V1,
  positiveInteger,
  isNormalizedRepositoryPathV1,
  normalizeRoleDispatchConsumerV1,
  parseProtectedTransitionTaskStateV1,
  projectRoleSourceBindingV1,
  sameRolePathsV1,
  acquireTaskIdentityV1,
  acquireMergeGatePullV1,
  classifyMergeGatePullV1,
  extractProtectedTransitionTaskStateV1,
  acquireChangedPathScopeV1,
  acquireCanonicalProductOwnerMergeDecisionV1,
  createHash,
  acquireMergeCheckRollupSnapshotV1,
  mergeGateChecksStopV1,
  acquireMergeReviewThreadsV1,
  mergeGateAllowsUnstableV1,
  verifyRoleDispatchSourceV1,
  roleDispatchStopV1,
}) => {
  const acquireMergeOperatorMechanicalSnapshotV1 = async ({ request, dispatch, decisionBody, host }) => {
    const task = await acquireTaskIdentityV1(request, host)
    const pull = await acquireMergeGatePullV1(request, host)
    const pullStop = classifyMergeGatePullV1(request, pull)
    if (pullStop !== null) throw new Error(pullStop.reason)
    if (
      task.repository !== request.repository || task.number !== request.taskIssueNumber ||
      task.state !== 'open' || task.is_pull_request || pull.number !== request.prNumber ||
      pull.state !== 'open' || pull.draft !== false || pull.merged !== false ||
      pull.head?.sha !== request.exactHead || pull.head?.repo?.full_name !== request.repository ||
      pull.base?.ref !== 'main' || pull.base?.repo?.full_name !== request.repository
    ) throw new Error('merge_operator_pull_binding_changed')

    const taskState = extractProtectedTransitionTaskStateV1(pull.body)
    const scope = await acquireChangedPathScopeV1(request, pull, host)
    if (
      taskState.task_issue_number !== request.taskIssueNumber || taskState.pr_number !== request.prNumber ||
      taskState.observed_head !== request.exactHead || taskState.architecture_status !== 'APPROVED' ||
      taskState.implementation_authorized !== true || taskState.review_status !== 'APPROVE' ||
      taskState.reviewed_head !== request.exactHead || taskState.review_blocker_count !== 0 ||
      scope.complete !== true || !sameRolePathsV1(scope.actual_paths, taskState.authorized_paths) ||
      !sameRolePathsV1(scope.actual_paths, dispatch.authorized_paths)
    ) throw new Error('merge_operator_task_state_binding_changed')

    const owner = await acquireCanonicalProductOwnerMergeDecisionV1({
      request,
      commentId: dispatch.source_comment_id,
      body: decisionBody,
      host,
    })
    const review = owner.effective_review.review
    if (
      owner.decision.decision !== 'MERGE_ALLOWED' || owner.decision.prNumber !== request.prNumber ||
      owner.decision.exactHead !== request.exactHead ||
      owner.decision.reviewCommentId !== dispatch.source_binding.review_comment_id ||
      String(owner.decision.admissionRunId) !== String(dispatch.admission_run_id) ||
      review.decision !== 'APPROVE' || review.reviewed_head !== request.exactHead ||
      review.blocking_finding_count !== 0 || review.remaining_finding_count !== 0 || review.unknown_count !== 0
    ) throw new Error('merge_operator_decision_binding_changed')

    const checkSnapshot = await acquireMergeCheckRollupSnapshotV1(request, host, { stopOnPullHeadDrift: true })
    if (checkSnapshot.headRefOid !== request.exactHead) throw new Error('head_changed_during_merge_gate')
    const checksStop = mergeGateChecksStopV1(request, checkSnapshot.checks, request.exactHead)
    if (checksStop !== null) throw new Error(checksStop.reason)

    const threadSnapshot = await acquireMergeReviewThreadsV1(request, host)
    const mergeStateAllowed = threadSnapshot.pull.mergeStateStatus === 'CLEAN' ||
      (threadSnapshot.pull.mergeStateStatus === 'UNSTABLE' && mergeGateAllowsUnstableV1(request))
    if (
      threadSnapshot.pull.state !== 'OPEN' || threadSnapshot.pull.isDraft ||
      threadSnapshot.pull.headRefOid !== request.exactHead ||
      threadSnapshot.pull.mergeable !== 'MERGEABLE' || !mergeStateAllowed
    ) throw new Error('pull_not_mergeable')
    if (threadSnapshot.threads.some((thread) => !thread.isResolved && !thread.isOutdated)) {
      throw new Error('blocking_review_threads_present')
    }

    return Object.freeze({
      task_state: taskState,
      authorized_paths: Object.freeze([...scope.actual_paths]),
      decision_comment_id: owner.comment_id,
      review_comment_id: owner.effective_review.commentId,
      decision_body_sha256: createHash('sha256').update(Buffer.from(owner.body, 'utf8')).digest('hex'),
      review_body_sha256: owner.review_body_sha256,
    })
  }

  const validateMergeOperatorDispatchEnvelopeV1 = (dispatch) => {
    dispatch = normalizeRoleDispatchConsumerV1(dispatch)
    if (
      dispatch.next_action !== 'MERGE_OPERATOR' || dispatch.purpose !== 'MERGE_OPERATOR' ||
      dispatch.terminal_result !== 'MERGE_ALLOWED' || !REPOSITORY.test(dispatch.repository ?? '') ||
      !positiveInteger(dispatch.task_issue_number) || !positiveInteger(dispatch.pr_number) ||
      !FULL_HEAD.test(dispatch.exact_head ?? '') || !positiveInteger(dispatch.source_comment_id) ||
      !WORKFLOW_RUN_ID.test(dispatch.admission_run_id ?? '') || dispatch.admission_state !== null ||
      dispatch.admission_allowed !== null || dispatch.admission_reason !== null ||
      dispatch.external_check_success_count !== null || dispatch.blocking_thread_count !== null ||
      !Array.isArray(dispatch.authorized_paths) || dispatch.authorized_paths.length === 0 ||
      new Set(dispatch.authorized_paths).size !== dispatch.authorized_paths.length ||
      dispatch.authorized_paths.some((value) => !isNormalizedRepositoryPathV1(value))
    ) throw new Error('merge_operator_dispatch_invalid')
    const taskState = parseProtectedTransitionTaskStateV1(dispatch.task_state)
    const binding = projectRoleSourceBindingV1(dispatch.source_binding, dispatch.source_comment_id)
    if (
      binding.kind !== 'MERGE_DECISION' || binding.comment_id !== dispatch.source_comment_id ||
      !positiveInteger(binding.review_comment_id) || String(binding.admission_run_id) !== dispatch.admission_run_id ||
      taskState.task_issue_number !== dispatch.task_issue_number || taskState.pr_number !== dispatch.pr_number ||
      taskState.observed_head !== dispatch.exact_head ||
      !sameRolePathsV1(taskState.authorized_paths, dispatch.authorized_paths)
    ) throw new Error('merge_operator_dispatch_invalid')
    return Object.freeze({ ...dispatch })
  }

  const executeMergeOperatorV1 = async ({ dispatch, host }) => {
    try {
      dispatch = validateMergeOperatorDispatchEnvelopeV1(dispatch)
      if (
        !dispatch || dispatch.next_action !== 'MERGE_OPERATOR' || dispatch.terminal_result !== 'MERGE_ALLOWED' ||
        !REPOSITORY.test(dispatch.repository ?? '') || !positiveInteger(dispatch.task_issue_number) ||
        !positiveInteger(dispatch.pr_number) || !FULL_HEAD.test(dispatch.exact_head ?? '') ||
        !positiveInteger(dispatch.source_comment_id) || !WORKFLOW_RUN_ID.test(dispatch.admission_run_id ?? '')
      ) throw new Error('merge_operator_dispatch_invalid')
      const decisionRecord = await verifyRoleDispatchSourceV1(dispatch, host)
      const request = Object.freeze({
        transition: 'merge_decision_admission', repository: dispatch.repository,
        taskIssueNumber: dispatch.task_issue_number, prNumber: dispatch.pr_number, exactHead: dispatch.exact_head,
        selfCheckContext: MERGE_DECISION_OWNER_SELF_CHECK_CONTEXT_V1,
      })
      const initialPull = await acquireMergeGatePullV1(request, host)
      if (initialPull.head.sha !== request.exactHead) throw new Error('head_binding_stale')
      if (initialPull.state === 'closed' && initialPull.merged === true) {
        return Object.freeze({ state: 'COMPLETED', allowed: false, exit_code: 0, reason: 'already_merged', automation_status: 'COMPLETED_NOOP', next_action: 'NONE', mutation_count: 0, current_head: request.exactHead })
      }
      if (initialPull.state !== 'open' || initialPull.draft) throw new Error('pull_not_ready')
      const initialSnapshot = await acquireMergeOperatorMechanicalSnapshotV1({
        request, dispatch, decisionBody: decisionRecord.body, host,
      })
      const finalSnapshot = await acquireMergeOperatorMechanicalSnapshotV1({
        request, dispatch, decisionBody: decisionRecord.body, host,
      })
      if (JSON.stringify(finalSnapshot) !== JSON.stringify(initialSnapshot)) {
        throw new Error('merge_operator_final_drift')
      }
      return Object.freeze({
        state: 'READY', allowed: false, exit_code: 0, reason: 'merge_operator_bound',
        automation_status: 'OPERATION_READY', next_action: 'MERGE_PR', mutation_count: 0,
        repository: request.repository, task_issue_number: request.taskIssueNumber,
        pr_number: request.prNumber, exact_head: request.exactHead, merge_method: 'merge',
      })
    } catch (error) {
      return roleDispatchStopV1(error instanceof Error ? error.message : 'merge_operator_failed')
    }
  }

  return Object.freeze({ executeMergeOperatorV1 })
}
