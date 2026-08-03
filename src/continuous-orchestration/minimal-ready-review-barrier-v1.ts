export const MINIMAL_READY_REVIEW_BARRIER_V1 = 'minimal-ready-review-barrier-v1' as const
export const CODEX_REVIEW_PRODUCER_V1 = 'chatgpt-codex-connector[bot]' as const

type JsonObject = Record<string, unknown>

export type ReviewSubmissionV1 = Readonly<{
  review_id: string
  bot_login: typeof CODEX_REVIEW_PRODUCER_V1
  commit_id: string
  submitted_at: string
}>

export type RawGitHubObservationV1 = Readonly<{
  repo: string
  pr_number: number
  exact_head: string
  ready_event_id: string
  ready_head: string
  ready_at: string
  review_listing_provenance: 'verified' | 'unknown'
  review_listing_state: 'complete' | 'incomplete' | 'error'
  review_submissions: readonly ReviewSubmissionV1[]
}>

export type CodexReviewStatusV1 =
  | Readonly<{
      status: 'observed'
      review_id: string
      bot_login: typeof CODEX_REVIEW_PRODUCER_V1
      exact_head: string
      submitted_at: string
    }>
  | Readonly<{ status: 'not_observed'; matching_review_count: 0 }>
  | Readonly<{
      status: 'unknown'
      reason: 'provenance_unknown' | 'review_query_incomplete' | 'review_query_error' | 'multiple_matching_reviews'
    }>

export type ReviewThreadV1 = Readonly<{
  thread_id: string
  is_resolved: boolean
  is_outdated: boolean
}>

export type ReviewThreadPageV1 = Readonly<{
  page_ordinal: number
  has_next_page: boolean
  threads: readonly ReviewThreadV1[]
}>

export type TerminalThreadSnapshotV1 = Readonly<{
  repo: string
  pr_number: number
  exact_head: string
  ready_event_id: string
  observed_review_id: string
  observed_review_submitted_at: string
  captured_at: string
  pages: readonly ReviewThreadPageV1[]
}>

export type MinimalReadyReviewBarrierInputV1 = Readonly<{
  input_version: typeof MINIMAL_READY_REVIEW_BARRIER_V1
  raw_observation: RawGitHubObservationV1
  timeout_reached: boolean
  terminal_thread_snapshot: TerminalThreadSnapshotV1 | null
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

const deepFreeze = <T>(value: T): Readonly<T> => {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as JsonObject)) deepFreeze(child)
    Object.freeze(value)
  }
  return value as Readonly<T>
}

const isReviewSubmission = (value: unknown): value is ReviewSubmissionV1 =>
  exactKeys(value, ['review_id', 'bot_login', 'commit_id', 'submitted_at']) &&
  nonEmpty(value.review_id) && value.bot_login === CODEX_REVIEW_PRODUCER_V1 && fullHead(value.commit_id) && isoTime(value.submitted_at)

export const validateRawGitHubObservationV1 = (value: unknown): value is RawGitHubObservationV1 =>
  exactKeys(value, [
    'repo', 'pr_number', 'exact_head', 'ready_event_id', 'ready_head', 'ready_at',
    'review_listing_provenance', 'review_listing_state', 'review_submissions',
  ]) && repoSlug(value.repo) && Number.isSafeInteger(value.pr_number) && Number(value.pr_number) > 0 &&
  fullHead(value.exact_head) && nonEmpty(value.ready_event_id) && fullHead(value.ready_head) && isoTime(value.ready_at) &&
  (value.review_listing_provenance === 'verified' || value.review_listing_provenance === 'unknown') &&
  (value.review_listing_state === 'complete' || value.review_listing_state === 'incomplete' || value.review_listing_state === 'error') &&
  Array.isArray(value.review_submissions) && value.review_submissions.every(isReviewSubmission)

export const classifyCodexReviewV1 = (value: unknown): CodexReviewStatusV1 => {
  if (!validateRawGitHubObservationV1(value)) throw new TypeError('raw GitHub observation is invalid')
  if (value.review_listing_provenance === 'unknown') return deepFreeze({ status: 'unknown', reason: 'provenance_unknown' } as const)
  if (value.review_listing_state === 'error') return deepFreeze({ status: 'unknown', reason: 'review_query_error' } as const)
  if (value.review_listing_state === 'incomplete') return deepFreeze({ status: 'unknown', reason: 'review_query_incomplete' } as const)

  const matching = value.review_submissions.filter((review) =>
    review.bot_login === CODEX_REVIEW_PRODUCER_V1 &&
    review.commit_id === value.exact_head &&
    review.commit_id === value.ready_head &&
    Date.parse(review.submitted_at) > Date.parse(value.ready_at))
  if (matching.length === 0) return deepFreeze({ status: 'not_observed', matching_review_count: 0 } as const)
  if (matching.length > 1) return deepFreeze({ status: 'unknown', reason: 'multiple_matching_reviews' } as const)
  return deepFreeze({
    status: 'observed',
    review_id: matching[0].review_id,
    bot_login: CODEX_REVIEW_PRODUCER_V1,
    exact_head: matching[0].commit_id,
    submitted_at: matching[0].submitted_at,
  })
}

const isThread = (value: unknown): value is ReviewThreadV1 =>
  exactKeys(value, ['thread_id', 'is_resolved', 'is_outdated']) && nonEmpty(value.thread_id) &&
  typeof value.is_resolved === 'boolean' && typeof value.is_outdated === 'boolean'

const isPage = (value: unknown): value is ReviewThreadPageV1 =>
  exactKeys(value, ['page_ordinal', 'has_next_page', 'threads']) && Number.isSafeInteger(value.page_ordinal) && Number(value.page_ordinal) > 0 &&
  typeof value.has_next_page === 'boolean' && Array.isArray(value.threads) && value.threads.every(isThread)

export const validateTerminalThreadSnapshotShapeV1 = (value: unknown): value is TerminalThreadSnapshotV1 => {
  if (!exactKeys(value, [
    'repo', 'pr_number', 'exact_head', 'ready_event_id', 'observed_review_id',
    'observed_review_submitted_at', 'captured_at', 'pages',
  ]) || !repoSlug(value.repo) || !Number.isSafeInteger(value.pr_number) || Number(value.pr_number) <= 0 ||
      !fullHead(value.exact_head) || !nonEmpty(value.ready_event_id) || !nonEmpty(value.observed_review_id) ||
      !isoTime(value.observed_review_submitted_at) || !isoTime(value.captured_at) || !Array.isArray(value.pages) ||
      value.pages.length === 0 || !value.pages.every(isPage)) return false

  const pages = value.pages as readonly ReviewThreadPageV1[]
  if (Date.parse(value.captured_at as string) < Date.parse(value.observed_review_submitted_at as string)) return false
  for (let index = 0; index < pages.length; index += 1) {
    if (pages[index].page_ordinal !== index + 1) return false
    if (pages[index].has_next_page !== (index < pages.length - 1)) return false
  }
  const threadIds = pages.flatMap((page) => page.threads.map((thread) => thread.thread_id))
  return unique(threadIds)
}

const snapshotMatches = (
  observation: RawGitHubObservationV1,
  review: Extract<CodexReviewStatusV1, { status: 'observed' }>,
  snapshot: TerminalThreadSnapshotV1,
): boolean => observation.ready_head === observation.exact_head &&
  snapshot.repo === observation.repo && snapshot.pr_number === observation.pr_number &&
  snapshot.exact_head === observation.exact_head && snapshot.ready_event_id === observation.ready_event_id &&
  snapshot.observed_review_id === review.review_id && snapshot.observed_review_submitted_at === review.submitted_at

export const evaluateMinimalReadyReviewBarrierV1 = (value: unknown): MinimalReadyReviewBarrierResultV1 => {
  if (!exactKeys(value, ['input_version', 'raw_observation', 'timeout_reached', 'terminal_thread_snapshot']) ||
      value.input_version !== MINIMAL_READY_REVIEW_BARRIER_V1 || typeof value.timeout_reached !== 'boolean') {
    return deepFreeze({ decision: 'blocked', reason: 'review_unknown' } as const)
  }
  if (!validateRawGitHubObservationV1(value.raw_observation)) return deepFreeze({ decision: 'blocked', reason: 'review_unknown' } as const)
  const review = classifyCodexReviewV1(value.raw_observation)
  if (review.status === 'unknown') return deepFreeze({ decision: 'blocked', reason: 'review_unknown' } as const)
  if (review.status === 'not_observed') {
    return deepFreeze({ decision: 'blocked', reason: value.timeout_reached ? 'review_timeout' : 'review_not_observed' } as const)
  }
  if (!validateTerminalThreadSnapshotShapeV1(value.terminal_thread_snapshot)) {
    return deepFreeze({ decision: 'blocked', reason: 'snapshot_incomplete' } as const)
  }
  if (!snapshotMatches(value.raw_observation, review, value.terminal_thread_snapshot)) {
    return deepFreeze({ decision: 'blocked', reason: 'candidate_binding_mismatch' } as const)
  }
  const unresolved = value.terminal_thread_snapshot.pages.flatMap((page) => page.threads)
    .filter((thread) => !thread.is_outdated && !thread.is_resolved)
  if (unresolved.length > 0) return deepFreeze({ decision: 'blocked', reason: 'unresolved_non_outdated_thread' } as const)
  return deepFreeze({
    decision: 'merge_allowed',
    repo: value.raw_observation.repo,
    pr_number: value.raw_observation.pr_number,
    exact_head: value.raw_observation.exact_head,
    ready_event_id: value.raw_observation.ready_event_id,
    observed_review_id: review.review_id,
    snapshot_captured_at: value.terminal_thread_snapshot.captured_at,
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

export const reconcileCompletionAfterThreadSnapshotV1 = (
  completion: unknown,
  snapshot: unknown,
): CompletionReconciliationResultV1 => {
  if (!validateCompletionBinding(completion) || !validateTerminalThreadSnapshotShapeV1(snapshot) ||
      snapshot.repo !== completion.repo || snapshot.pr_number !== completion.pr_number ||
      snapshot.exact_head !== completion.exact_head || snapshot.ready_event_id !== completion.ready_event_id ||
      snapshot.observed_review_id !== completion.observed_review_id ||
      Date.parse(snapshot.captured_at) <= Date.parse(completion.completed_at)) {
    throw new TypeError('completion reconciliation authority is invalid')
  }
  const terminalIds = new Set(completion.terminal_thread_ids)
  const newThreadIds = snapshot.pages.flatMap((page) => page.threads.map((thread) => thread.thread_id))
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
