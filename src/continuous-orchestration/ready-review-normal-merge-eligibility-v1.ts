// Node's focused TypeScript runner requires source extensions; this project has no emit.
// @ts-expect-error TS5097 is intentionally suppressed for the native TypeScript runtime import.
import { evaluateMinimalReadyReviewBarrierV1 } from './minimal-ready-review-barrier-v1.ts'
// @ts-expect-error TS5097 is intentionally suppressed for the native TypeScript runtime import.
import { digestReadyReviewObservationProjectionV1, parseReadyReviewTerminalObservationArtifactV1 } from './ready-review-terminal-observation-artifact-v1.ts'

const INPUT_VERSION = 'ready-review-normal-merge-eligibility-input-v1' as const
const RESULT_VERSION = 'ready-review-normal-merge-eligibility-result-v1' as const
const REPOSITORY = 'whatrune/sd-prompt-studio' as const

type JsonObject = Record<string, unknown>
type BlockedReason = 'review_not_observed' | 'review_unknown' | 'review_timeout' | 'unresolved_non_outdated_thread'
type RejectionReason = 'input_invalid' | 'duplicate_invocation' | 'stale_artifact' | 'binding_mismatch' | 'barrier_not_executed' | 'barrier_result_invalid' | 'internal_fail_closed'

type EligibilityInput = Readonly<{
  input_version: typeof INPUT_VERSION
  repository: typeof REPOSITORY
  pr_number: number
  exact_head: string
  ready_event_id: string
  ready_record_url: string
  sealed_collector_artifact_jcs: string | null
  timeout_reached: boolean
  attempt_id: string
}>

type EligibilityResult =
  | Readonly<{
      result_version: typeof RESULT_VERSION
      kind: 'normal_merge_commit_eligible'
      attempt_id: string
      barrier_invocation_count: 1
      protected_execution_performed: false
      repository: typeof REPOSITORY
      pr_number: number
      exact_head: string
      ready_event_id: string
      ready_record_url: string
      observed_review_id: string
      terminal_snapshot_captured_at: string
      merge_strategy: 'normal_merge_commit'
      barrier_decision: 'merge_allowed'
    }>
  | Readonly<{
      result_version: typeof RESULT_VERSION
      kind: 'merge_blocked'
      attempt_id: string
      barrier_invocation_count: 1
      protected_execution_performed: false
      reason: BlockedReason
    }>
  | Readonly<{
      result_version: typeof RESULT_VERSION
      kind: 'rejected'
      attempt_id: string | null
      barrier_invocation_count: 0 | 1
      protected_execution_performed: false
      reason: RejectionReason
    }>

const startedAttemptIds = new Set<string>()
const eligibleGenerationKeys = new Set<string>()

const isObject = (value: unknown): value is JsonObject => value !== null && typeof value === 'object' && !Array.isArray(value)
const hasOwn = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key)
const exactKeys = (value: unknown, keys: readonly string[]): value is JsonObject =>
  isObject(value) && Object.keys(value).length === keys.length && keys.every((key) => hasOwn(value, key))
const fullHead = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{40}$/.test(value)
const sha256 = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value)
const nonEmpty = (value: unknown): value is string => typeof value === 'string' && value.length > 0
const directIssueComment = (value: unknown): value is string =>
  typeof value === 'string' && /^https:\/\/github\.com\/[^/]+\/[^/]+\/issues\/\d+#issuecomment-\d+$/.test(value)

const deepFreeze = <T>(value: T): Readonly<T> => {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as JsonObject)) deepFreeze(child)
    Object.freeze(value)
  }
  return value as Readonly<T>
}

const rejected = (reason: RejectionReason, attemptId: string | null, calls: 0 | 1): EligibilityResult => deepFreeze({
  result_version: RESULT_VERSION,
  kind: 'rejected' as const,
  attempt_id: attemptId,
  barrier_invocation_count: calls,
  protected_execution_performed: false as const,
  reason,
})

const blocked = (reason: BlockedReason, attemptId: string): EligibilityResult => deepFreeze({
  result_version: RESULT_VERSION,
  kind: 'merge_blocked' as const,
  attempt_id: attemptId,
  barrier_invocation_count: 1 as const,
  protected_execution_performed: false as const,
  reason,
})

const admittedInput = async (value: unknown): Promise<EligibilityInput | null> => {
  const fields = [
    'input_version', 'repository', 'pr_number', 'exact_head', 'ready_event_id', 'ready_record_url',
    'sealed_collector_artifact_jcs', 'timeout_reached', 'attempt_id',
  ] as const
  if (!exactKeys(value, fields) || value.input_version !== INPUT_VERSION || value.repository !== REPOSITORY ||
      !Number.isSafeInteger(value.pr_number) || Number(value.pr_number) <= 0 || !fullHead(value.exact_head) ||
      !nonEmpty(value.ready_event_id) || !directIssueComment(value.ready_record_url) ||
      !(value.sealed_collector_artifact_jcs === null || typeof value.sealed_collector_artifact_jcs === 'string') ||
      typeof value.timeout_reached !== 'boolean' || !sha256(value.attempt_id)) return null
  const attemptProjection = Object.fromEntries(fields.slice(0, 8).map((field) => [field, value[field]]))
  if (await digestReadyReviewObservationProjectionV1(attemptProjection) !== value.attempt_id) return null
  return value as unknown as EligibilityInput
}

const generationKey = (input: EligibilityInput): string =>
  `${input.repository}\u0000${input.pr_number}\u0000${input.exact_head}\u0000${input.ready_event_id}\u0000${input.ready_record_url}`

const isBlockedReason = (value: unknown): value is BlockedReason => [
  'review_not_observed', 'review_unknown', 'review_timeout', 'unresolved_non_outdated_thread',
].includes(String(value))

const barrierResultIsClosed = (value: unknown): value is Awaited<ReturnType<typeof evaluateMinimalReadyReviewBarrierV1>> => {
  if (!isObject(value) || (value.decision !== 'merge_allowed' && value.decision !== 'blocked')) return false
  if (value.decision === 'merge_allowed') return exactKeys(value, [
    'decision', 'repo', 'pr_number', 'exact_head', 'ready_event_id', 'observed_review_id', 'snapshot_captured_at',
  ])
  return exactKeys(value, ['decision', 'reason']) && isBlockedReason(value.reason)
}

export const evaluateReadyReviewNormalMergeEligibilityV1 = async (value: unknown): Promise<EligibilityResult> => {
  const input = await admittedInput(value)
  if (input === null) return rejected('input_invalid', null, 0)
  const generation = generationKey(input)
  if (startedAttemptIds.has(input.attempt_id) || eligibleGenerationKeys.has(generation)) {
    return rejected('duplicate_invocation', input.attempt_id, 0)
  }
  startedAttemptIds.add(input.attempt_id)

  let barrier: Awaited<ReturnType<typeof evaluateMinimalReadyReviewBarrierV1>>
  try {
    barrier = await evaluateMinimalReadyReviewBarrierV1({
      input_version: 'minimal-ready-review-barrier-v1',
      terminal_observation_artifact_jcs: input.sealed_collector_artifact_jcs,
      timeout_reached: input.timeout_reached,
    })
  } catch {
    return rejected('internal_fail_closed', input.attempt_id, 1)
  }
  if (!barrierResultIsClosed(barrier)) return rejected('barrier_result_invalid', input.attempt_id, 1)
  if (barrier.decision === 'blocked') {
    if (!isBlockedReason(barrier.reason)) return rejected('barrier_result_invalid', input.attempt_id, 1)
    return blocked(barrier.reason, input.attempt_id)
  }
  if (input.sealed_collector_artifact_jcs === null) return rejected('barrier_not_executed', input.attempt_id, 1)

  let artifact: Awaited<ReturnType<typeof parseReadyReviewTerminalObservationArtifactV1>>
  try {
    artifact = await parseReadyReviewTerminalObservationArtifactV1(input.sealed_collector_artifact_jcs)
  } catch {
    return rejected('internal_fail_closed', input.attempt_id, 1)
  }
  if (artifact === null) return rejected('barrier_result_invalid', input.attempt_id, 1)
  if (barrier.exact_head !== input.exact_head || artifact.exact_head !== input.exact_head) {
    return rejected('stale_artifact', input.attempt_id, 1)
  }
  if (barrier.repo !== input.repository || artifact.repository !== input.repository ||
      barrier.pr_number !== input.pr_number || artifact.pr_number !== input.pr_number ||
      barrier.ready_event_id !== input.ready_event_id || artifact.ready_event_id !== input.ready_event_id ||
      artifact.ready_generation_record_url !== input.ready_record_url) {
    return rejected('binding_mismatch', input.attempt_id, 1)
  }

  // This synchronous check-and-add is the generation reservation boundary. No
  // await may be introduced between the check and the reservation.
  if (eligibleGenerationKeys.has(generation)) {
    return rejected('duplicate_invocation', input.attempt_id, 1)
  }
  eligibleGenerationKeys.add(generation)
  return deepFreeze({
    result_version: RESULT_VERSION,
    kind: 'normal_merge_commit_eligible' as const,
    attempt_id: input.attempt_id,
    barrier_invocation_count: 1 as const,
    protected_execution_performed: false as const,
    repository: REPOSITORY,
    pr_number: input.pr_number,
    exact_head: input.exact_head,
    ready_event_id: input.ready_event_id,
    ready_record_url: artifact.ready_generation_record_url,
    observed_review_id: barrier.observed_review_id,
    terminal_snapshot_captured_at: barrier.snapshot_captured_at,
    merge_strategy: 'normal_merge_commit' as const,
    barrier_decision: 'merge_allowed' as const,
  })
}
