// Node's focused TypeScript runner requires the source extension; the project has no emit.
// @ts-expect-error TS5097 is intentionally suppressed for the native TypeScript runtime import.
import { parseReadyReviewTerminalObservationArtifactV1, type ReadyReviewTerminalObservationArtifactV1 } from './ready-review-terminal-observation-artifact-v1.ts'

export const MINIMAL_READY_REVIEW_BARRIER_V1 = 'minimal-ready-review-barrier-v1' as const
export const CODEX_REVIEW_PRODUCER_V1 = 'chatgpt-codex-connector[bot]' as const

type JsonObject = Record<string, unknown>

export type MinimalReadyReviewBarrierInputV1 = Readonly<{
  input_version: typeof MINIMAL_READY_REVIEW_BARRIER_V1
  terminal_observation_artifact_jcs: string | null
  timeout_reached: boolean
}>

export type BarrierBlockedReasonV1 =
  | 'review_unknown'
  | 'review_timeout'
  | 'review_not_observed'
  | 'snapshot_incomplete'
  | 'candidate_binding_mismatch'
  | 'unresolved_non_outdated_thread'

export type MinimalReadyReviewBarrierResultV1 =
  | Readonly<{
      decision: 'merge_allowed'
      repo: string
      pr_number: number
      exact_head: string
      ready_event_id: string
      observed_review_id: string
      snapshot_captured_at: string
    }>
  | Readonly<{
      decision: 'blocked'
      reason: BarrierBlockedReasonV1
    }>

export const HOST_LEVEL_READY_REVIEW_BARRIER_INPUT_V1 = 'host-level-ready-review-barrier-input-v1' as const

export type CompletionBindingV1 = Readonly<{
  repo: string
  pr_number: number
  exact_head: string
  ready_event_id: string
  observed_review_id: string
  terminal_snapshot_captured_at: string
  terminal_thread_ids: readonly string[]
  completion_id: string
  completed_at: string
}>

export type CompletionReconciliationResultV1 =
  | Readonly<{ result: 'completion_retained' }>
  | Readonly<{
      result: 'completion_invalidated'
      reason: 'new_same_head_technical_thread'
      new_thread_ids: readonly string[]
    }>

const isObject = (value: unknown): value is JsonObject => value !== null && typeof value === 'object' && !Array.isArray(value)
const hasOwn = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key)
const exactKeys = (value: unknown, keys: readonly string[]): value is JsonObject =>
  isObject(value) && Object.keys(value).length === keys.length && keys.every((key) => hasOwn(value, key))
const nonEmpty = (value: unknown): value is string => typeof value === 'string' && value.length > 0
const repoSlug = (value: unknown): value is string => typeof value === 'string' && /^[^/\s]+\/[^/\s]+$/.test(value)
const fullHead = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{40}$/.test(value)
const isoTime = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) && !Number.isNaN(Date.parse(value))
const unique = (values: readonly string[]): boolean => new Set(values).size === values.length
const positiveDecimal = (value: unknown): value is string => typeof value === 'string' && /^[1-9][0-9]*$/.test(value)
const prUrl = (value: unknown): value is string =>
  typeof value === 'string' && /^https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/pull\/\d+$/.test(value)
const reviewUrl = (value: unknown): value is string =>
  typeof value === 'string' && /^https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/pull\/\d+#pullrequestreview-\d+$/.test(value)

const deepFreeze = <T>(value: T): Readonly<T> => {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as JsonObject)) deepFreeze(child)
    Object.freeze(value)
  }
  return value as Readonly<T>
}

const blocked = (reason: BarrierBlockedReasonV1): MinimalReadyReviewBarrierResultV1 =>
  deepFreeze({ decision: 'blocked', reason } as const)

const failureReasons = {
  input: { input_invalid: 'candidate_binding_mismatch' },
  timeline: { github_read_failed: 'review_unknown', ready_event_missing_or_invalid: 'candidate_binding_mismatch' },
  pr: { github_read_failed: 'review_unknown', not_open: 'candidate_binding_mismatch', draft: 'candidate_binding_mismatch', head_mismatch: 'candidate_binding_mismatch' },
  reviews: { github_read_failed: 'review_unknown', review_not_observed: 'review_not_observed', review_head_mismatch: 'candidate_binding_mismatch', review_before_ready: 'candidate_binding_mismatch' },
  threads: { github_read_failed: 'snapshot_incomplete', page_malformed: 'snapshot_incomplete', cursor_incomplete: 'snapshot_incomplete', head_mismatch: 'candidate_binding_mismatch' },
} as const

const evaluateHostFailure = (value: JsonObject): MinimalReadyReviewBarrierResultV1 => {
  if (!exactKeys(value, ['input_version', 'observation', 'failure_stage', 'failure_code']) ||
      value.input_version !== HOST_LEVEL_READY_REVIEW_BARRIER_INPUT_V1 || value.observation !== 'observation_failed' ||
      typeof value.failure_stage !== 'string' || typeof value.failure_code !== 'string') return blocked('candidate_binding_mismatch')
  const stage = failureReasons[value.failure_stage as keyof typeof failureReasons]
  if (!stage || !(value.failure_code in stage)) return blocked('candidate_binding_mismatch')
  return blocked(stage[value.failure_code as keyof typeof stage] as BarrierBlockedReasonV1)
}

export const evaluateHostLevelReadyReviewBarrierV1 = (value: unknown): MinimalReadyReviewBarrierResultV1 => {
  if (!isObject(value)) return blocked('candidate_binding_mismatch')
  if (value.observation === 'observation_failed') return evaluateHostFailure(value)
  if (!exactKeys(value, ['input_version', 'observation', 'request', 'ready_event', 'pull_request', 'review_observation', 'thread_snapshot']) ||
      value.input_version !== HOST_LEVEL_READY_REVIEW_BARRIER_INPUT_V1 || value.observation !== 'observation_complete') {
    return blocked('candidate_binding_mismatch')
  }

  const request = value.request
  if (!exactKeys(request, ['repository', 'pr_number', 'pr_url', 'exact_head']) || !repoSlug(request.repository) ||
      !Number.isSafeInteger(request.pr_number) || Number(request.pr_number) <= 0 || !prUrl(request.pr_url) || !fullHead(request.exact_head) ||
      request.pr_url !== `https://github.com/${request.repository}/pull/${request.pr_number}`) return blocked('candidate_binding_mismatch')

  const ready = value.ready_event
  if (!exactKeys(ready, ['event_id', 'event_type', 'occurred_at', 'source_observed_at']) || !positiveDecimal(ready.event_id) ||
      ready.event_type !== 'ready_for_review' || !isoTime(ready.occurred_at) || !isoTime(ready.source_observed_at) ||
      Date.parse(ready.source_observed_at) < Date.parse(ready.occurred_at)) return blocked('candidate_binding_mismatch')

  const pull = value.pull_request
  if (!exactKeys(pull, ['state', 'draft', 'head_sha', 'source_observed_at']) || pull.state !== 'open' || pull.draft !== false ||
      !fullHead(pull.head_sha) || !isoTime(pull.source_observed_at) || pull.head_sha !== request.exact_head) return blocked('candidate_binding_mismatch')

  const observation = value.review_observation
  if (!exactKeys(observation, ['acquisition_completed_at', 'latest']) || !isoTime(observation.acquisition_completed_at) ||
      !exactKeys(observation.latest, ['producer', 'review_id', 'review_url', 'reviewed_head', 'submitted_at', 'source_observed_at'])) {
    return blocked('review_unknown')
  }
  const review = observation.latest
  if (review.producer !== CODEX_REVIEW_PRODUCER_V1 || !positiveDecimal(review.review_id) || !reviewUrl(review.review_url) ||
      !fullHead(review.reviewed_head) || !isoTime(review.submitted_at) || !isoTime(review.source_observed_at)) return blocked('review_unknown')
  if (review.reviewed_head !== request.exact_head || Date.parse(review.submitted_at) < Date.parse(ready.occurred_at)) {
    return blocked('candidate_binding_mismatch')
  }
  if (Date.parse(review.source_observed_at) < Date.parse(review.submitted_at) ||
      Date.parse(observation.acquisition_completed_at) < Date.parse(review.source_observed_at)) return blocked('review_unknown')

  const snapshot = value.thread_snapshot
  if (!exactKeys(snapshot, ['observed_at', 'pages']) || !isoTime(snapshot.observed_at) || !Array.isArray(snapshot.pages) || snapshot.pages.length === 0) {
    return blocked('snapshot_incomplete')
  }
  const threadIds: string[] = []
  let priorEndCursor: string | null = null
  let maximumPageObservation = 0
  for (let index = 0; index < snapshot.pages.length; index += 1) {
    const page = snapshot.pages[index]
    if (!exactKeys(page, ['ordinal', 'requested_after', 'end_cursor', 'has_next_page', 'head_ref_oid', 'source_observed_at', 'nodes']) ||
        page.ordinal !== index || !(page.requested_after === null || nonEmpty(page.requested_after)) ||
        !(page.end_cursor === null || nonEmpty(page.end_cursor)) || typeof page.has_next_page !== 'boolean' ||
        !fullHead(page.head_ref_oid) || !isoTime(page.source_observed_at) || !Array.isArray(page.nodes)) return blocked('snapshot_incomplete')
    if (page.head_ref_oid !== request.exact_head) return blocked('candidate_binding_mismatch')
    if (page.requested_after !== priorEndCursor || (index < snapshot.pages.length - 1 && (!page.has_next_page || page.end_cursor === null)) ||
        (index === snapshot.pages.length - 1 && page.has_next_page)) return blocked('snapshot_incomplete')
    if (Date.parse(page.source_observed_at) < Date.parse(review.source_observed_at)) return blocked('snapshot_incomplete')
    maximumPageObservation = Math.max(maximumPageObservation, Date.parse(page.source_observed_at))
    priorEndCursor = page.end_cursor
    for (const node of page.nodes) {
      if (!exactKeys(node, ['thread_id', 'is_resolved', 'is_outdated']) || !nonEmpty(node.thread_id) ||
          typeof node.is_resolved !== 'boolean' || typeof node.is_outdated !== 'boolean') return blocked('snapshot_incomplete')
      threadIds.push(node.thread_id)
    }
  }
  if (!unique(threadIds) || Date.parse(snapshot.observed_at) < maximumPageObservation) return blocked('snapshot_incomplete')
  if (snapshot.pages.flatMap((page) => (page as JsonObject).nodes as JsonObject[])
    .some((thread) => thread.is_resolved === false && thread.is_outdated === false)) return blocked('unresolved_non_outdated_thread')

  return deepFreeze({
    decision: 'merge_allowed',
    repo: request.repository,
    pr_number: Number(request.pr_number),
    exact_head: request.exact_head,
    ready_event_id: ready.event_id,
    observed_review_id: review.review_id,
    snapshot_captured_at: snapshot.observed_at,
  } as const)
}

const admittedCodexReview = (artifact: ReadyReviewTerminalObservationArtifactV1) => {
  if (artifact.producer_roster.length !== 1 || artifact.producer_roster[0] !== CODEX_REVIEW_PRODUCER_V1 ||
      artifact.producer_receipts.length !== 1) return null
  const receipt = artifact.producer_receipts[0]
  if (receipt.producer_id !== CODEX_REVIEW_PRODUCER_V1 || receipt.receipt_kind !== 'submitted_review' ||
      receipt.source_projection.kind !== 'submitted_review' || receipt.source_projection.producer_id !== CODEX_REVIEW_PRODUCER_V1 ||
      receipt.reviewed_head !== artifact.exact_head || receipt.source_projection.reviewed_head !== artifact.exact_head ||
      receipt.ready_event_id !== artifact.ready_event_id || receipt.source_projection.ready_event_id !== artifact.ready_event_id ||
      Date.parse(receipt.receipt_created_at) < Date.parse(artifact.ready_occurred_at)) return null
  return receipt.source_projection
}

export const evaluateMinimalReadyReviewBarrierV1 = async (value: unknown): Promise<MinimalReadyReviewBarrierResultV1> => {
  if (!exactKeys(value, ['input_version', 'terminal_observation_artifact_jcs', 'timeout_reached']) ||
      value.input_version !== MINIMAL_READY_REVIEW_BARRIER_V1 || typeof value.timeout_reached !== 'boolean' ||
      !(value.terminal_observation_artifact_jcs === null || typeof value.terminal_observation_artifact_jcs === 'string')) {
    return blocked('review_unknown')
  }

  // A fired deadline is terminal for this attempt. A later review cannot revive it.
  if (value.timeout_reached) return blocked('review_timeout')
  if (value.terminal_observation_artifact_jcs === null) return blocked('review_not_observed')

  const artifact = await parseReadyReviewTerminalObservationArtifactV1(value.terminal_observation_artifact_jcs)
  if (artifact === null) return blocked('review_unknown')
  const review = admittedCodexReview(artifact)
  if (review === null) return blocked('review_not_observed')

  const unresolved = artifact.thread_snapshot.pages.flatMap((page) => page.nodes)
    .filter((thread) => !thread.is_outdated && !thread.is_resolved)
  if (unresolved.length > 0) return blocked('unresolved_non_outdated_thread')
  return deepFreeze({
    decision: 'merge_allowed',
    repo: artifact.repository,
    pr_number: artifact.pr_number,
    exact_head: artifact.exact_head,
    ready_event_id: artifact.ready_event_id,
    observed_review_id: review.review_id,
    snapshot_captured_at: artifact.thread_snapshot.observed_at,
  })
}

const validateCompletionBinding = (value: unknown): value is CompletionBindingV1 =>
  exactKeys(value, [
    'repo', 'pr_number', 'exact_head', 'ready_event_id', 'observed_review_id', 'terminal_snapshot_captured_at',
    'terminal_thread_ids', 'completion_id', 'completed_at',
  ]) && repoSlug(value.repo) && Number.isSafeInteger(value.pr_number) && Number(value.pr_number) > 0 && fullHead(value.exact_head) &&
  nonEmpty(value.ready_event_id) && nonEmpty(value.observed_review_id) && isoTime(value.terminal_snapshot_captured_at) &&
  Array.isArray(value.terminal_thread_ids) && value.terminal_thread_ids.every(nonEmpty) && unique(value.terminal_thread_ids) &&
  nonEmpty(value.completion_id) && isoTime(value.completed_at) && Date.parse(value.completed_at) >= Date.parse(value.terminal_snapshot_captured_at)

export const reconcileCompletionAfterThreadSnapshotV1 = async (
  completion: unknown,
  terminalObservationArtifactJcs: unknown,
): Promise<CompletionReconciliationResultV1> => {
  if (!validateCompletionBinding(completion) || typeof terminalObservationArtifactJcs !== 'string') {
    throw new TypeError('completion reconciliation authority is invalid')
  }
  const artifact = await parseReadyReviewTerminalObservationArtifactV1(terminalObservationArtifactJcs)
  const review = artifact === null ? null : admittedCodexReview(artifact)
  if (artifact === null || review === null || artifact.repository !== completion.repo || artifact.pr_number !== completion.pr_number ||
      artifact.exact_head !== completion.exact_head || artifact.ready_event_id !== completion.ready_event_id ||
      review.review_id !== completion.observed_review_id || Date.parse(artifact.thread_snapshot.observed_at) <= Date.parse(completion.completed_at)) {
    throw new TypeError('completion reconciliation authority is invalid')
  }
  const terminalIds = new Set(completion.terminal_thread_ids)
  const newThreadIds = artifact.thread_snapshot.pages.flatMap((page) => page.nodes.map((thread) => thread.thread_id))
    .filter((threadId) => !terminalIds.has(threadId)).sort()
  if (newThreadIds.length > 0) {
    return deepFreeze({
      result: 'completion_invalidated',
      reason: 'new_same_head_technical_thread',
      new_thread_ids: newThreadIds,
    } as const)
  }
  return deepFreeze({ result: 'completion_retained' } as const)
}
