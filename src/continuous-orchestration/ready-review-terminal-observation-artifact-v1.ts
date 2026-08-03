export const READY_REVIEW_TERMINAL_OBSERVATION_ARTIFACT_V1 = 'ready-review-terminal-observation-artifact-v1' as const
export const PRODUCER_TERMINAL_RECEIPT_OBSERVATION_V1 = 'producer-terminal-receipt-observation-v1' as const
export const POST_TERMINAL_THREAD_SNAPSHOT_V1 = 'post-terminal-thread-snapshot-v1' as const
export const READY_REVIEW_TERMINAL_OBSERVATION_CORE_INPUT_V1 = 'ready-review-terminal-observation-core-input-v1' as const

type JsonObject = Record<string, unknown>

export type ReadyReviewGenerationRecordV1 = Readonly<{
  record_type: 'ready_review_generation_record_v1'
  canonical_record: string
  repository: string
  pr_number: number
  pr_url: string
  exact_head: string
  ready_event_id: string
  ready_occurred_at: string
  task_issue_url: string
  revision: number
  prior_record_url: string | null
  producer_roster_source_url: string
  producer_roster_source_digest: string
  record_digest: string
}>

export type ReadyReviewProducerRosterV1 = Readonly<{
  record_type: 'ready_review_producer_roster_v1'
  canonical_record: string
  repository: string
  pr_number: number
  exact_head: string
  ready_event_id: string
  producer_ids: readonly string[]
  effective_from: string
  effective_until: string | null
  record_digest: string
}>

export type SubmittedReviewSourceProjectionV1 = Readonly<{
  projection_version: 'submitted-review-source-projection-v1'
  kind: 'submitted_review'
  producer_id: string
  review_id: string
  review_url: string
  submitted_at: string
  reviewed_head: string
  ready_event_id: string
  review_state: string
  finding_ids: readonly string[]
  source_observed_at: string
}>

export type NoFindingsCorrelationSourceProjectionV1 = Readonly<{
  projection_version: 'no-findings-correlation-source-projection-v1'
  kind: 'no_findings_correlation'
  producer_id: string
  reaction_id: string
  reaction_target_url: string
  reaction_actor: string
  reaction_content: '+1'
  reaction_created_at: string
  reviewed_head: string
  ready_event_id: string
  ready_interval_observation_digest: string
  correlation_source_urls: readonly string[]
  source_observed_at: string
}>

export type ProducerTerminalReceiptObservationV1 = Readonly<{
  observation_version: typeof PRODUCER_TERMINAL_RECEIPT_OBSERVATION_V1
  producer_id: string
  receipt_id: string
  receipt_source_url: string
  receipt_kind: 'submitted_review' | 'no_findings_correlation'
  receipt_created_at: string
  reviewed_head: string
  ready_event_id: string
  source_projection: SubmittedReviewSourceProjectionV1 | NoFindingsCorrelationSourceProjectionV1
  source_projection_digest: string
  source_observed_at: string
}>

export type ThreadNodeObservationV1 = Readonly<{
  thread_id: string
  is_resolved: boolean
  is_outdated: boolean
  path: string
  line: number | null
  start_line: number | null
  last_comment_id: string
  last_comment_created_at: string
}>

export type ThreadPageObservationV1 = Readonly<{
  page_ordinal: number
  start_cursor: string | null
  end_cursor: string | null
  has_next_page: boolean
  nodes: readonly ThreadNodeObservationV1[]
  source_url: string
  source_observed_at: string
  page_digest: string
}>

export type PostTerminalThreadSnapshotV1 = Readonly<{
  snapshot_version: typeof POST_TERMINAL_THREAD_SNAPSHOT_V1
  query_identity: Readonly<{ connection: 'PullRequest.reviewThreads'; query_sha256: string }>
  variables_identity: Readonly<{ repository: string; pr_number: number; exact_head: string; variables_sha256: string }>
  pages: readonly ThreadPageObservationV1[]
  terminal_receipt_ids: readonly string[]
  terminal_receipts_digest: string
  last_terminal_receipt_at: string
  observed_at: string
  source_observation_urls: readonly string[]
  snapshot_digest: string
}>

export type ReadyReviewTerminalObservationArtifactV1 = Readonly<{
  artifact_version: typeof READY_REVIEW_TERMINAL_OBSERVATION_ARTIFACT_V1
  repository: string
  pr_number: number
  pr_url: string
  exact_head: string
  ready_generation_record_url: string
  ready_event_id: string
  ready_occurred_at: string
  producer_roster: readonly string[]
  producer_roster_source_digest: string
  producer_receipts: readonly ProducerTerminalReceiptObservationV1[]
  terminal_receipt_ids: readonly string[]
  terminal_receipts_digest: string
  last_terminal_receipt_at: string
  thread_snapshot: PostTerminalThreadSnapshotV1
  artifact_digest: string
}>

export type ReadyReviewRecordObservationV1 = Readonly<{
  source_url: string
  author_login: string
  author_association: 'OWNER'
  record: ReadyReviewGenerationRecordV1
}>

export type ReadyReviewRosterRecordObservationV1 = Readonly<{
  source_url: string
  author_login: string
  author_association: 'OWNER'
  record: ReadyReviewProducerRosterV1
}>

export type ReadyReviewEventObservationV1 = Readonly<{
  event_id: string
  event: 'ready_for_review'
  created_at: string
}>

export type ReadyReviewTerminalObservationCoreInputV1 = Readonly<{
  input_version: typeof READY_REVIEW_TERMINAL_OBSERVATION_CORE_INPUT_V1
  request_identity: Readonly<{
    repository: string
    pr_number: number
    pr_url: string
    exact_head: string
    ready_record_url: string
  }>
  ready_record_observations: readonly ReadyReviewRecordObservationV1[]
  ready_event_observations: readonly ReadyReviewEventObservationV1[]
  roster_record_observation: ReadyReviewRosterRecordObservationV1
  producer_source_observations: readonly (SubmittedReviewSourceProjectionV1 | NoFindingsCorrelationSourceProjectionV1)[]
  thread_pages: readonly ThreadPageObservationV1[]
  receipts_observed_at: string
  thread_snapshot_observed_at: string
}>

export type ReadyReviewTerminalObservationFailureCodeV1 =
  | 'input_shape_invalid'
  | 'ready_authority_invalid'
  | 'ready_chain_invalid'
  | 'ready_event_invalid'
  | 'roster_authority_invalid'
  | 'producer_receipt_invalid'
  | 'producer_receipt_incomplete'
  | 'thread_snapshot_invalid'
  | 'temporal_binding_invalid'
  | 'artifact_seal_invalid'

export type ReadyReviewTerminalObservationFailureStageV1 =
  | 'input'
  | 'ready_authority'
  | 'ready_chain'
  | 'ready_event'
  | 'roster'
  | 'receipts'
  | 'threads'
  | 'artifact'

export type ReadyReviewTerminalObservationCoreResultV1 =
  | Readonly<{ branch: 'artifact_produced'; artifact: ReadyReviewTerminalObservationArtifactV1 }>
  | Readonly<{
      branch: 'observation_rejected'
      failure: Readonly<{
        failure_code: ReadyReviewTerminalObservationFailureCodeV1
        stage: ReadyReviewTerminalObservationFailureStageV1
      }>
    }>

const isObject = (value: unknown): value is JsonObject => value !== null && typeof value === 'object' && !Array.isArray(value)
const hasOwn = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key)
const exactKeys = (value: unknown, keys: readonly string[]): value is JsonObject =>
  isObject(value) && Object.keys(value).length === keys.length && keys.every((key) => hasOwn(value, key))
const nonEmpty = (value: unknown): value is string => typeof value === 'string' && value.length > 0
const fullHead = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{40}$/.test(value)
const sha256Value = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value)
const isoTime = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) && !Number.isNaN(Date.parse(value))
const directCommentUrl = (value: unknown): value is string =>
  typeof value === 'string' && /^https:\/\/github\.com\/[^/]+\/[^/]+\/issues\/\d+#issuecomment-\d+$/.test(value)
const directIssueUrl = (value: unknown): value is string =>
  typeof value === 'string' && /^https:\/\/github\.com\/[^/]+\/[^/]+\/issues\/\d+$/.test(value)
const directPrUrl = (value: unknown): value is string =>
  typeof value === 'string' && /^https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+$/.test(value)
const stringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every(nonEmpty)
const unique = (values: readonly string[]) => new Set(values).size === values.length
const sortedUnique = (values: readonly string[]) => unique(values) && values.every((value, index) => index === 0 || values[index - 1] < value)

export const deepFreezeReadyReviewObservationV1 = <T>(value: T): Readonly<T> => {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as JsonObject)) deepFreezeReadyReviewObservationV1(child)
    Object.freeze(value)
  }
  return value as Readonly<T>
}

export const canonicalizeReadyReviewObservationJcsV1 = (value: unknown): string => {
  if (value === null) return 'null'
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value)
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('JCS does not admit non-finite numbers')
    return JSON.stringify(Object.is(value, -0) ? 0 : value)
  }
  if (Array.isArray(value)) return `[${value.map(canonicalizeReadyReviewObservationJcsV1).join(',')}]`
  if (isObject(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalizeReadyReviewObservationJcsV1(value[key])}`).join(',')}}`
  }
  throw new TypeError('JCS admits JSON values only')
}

export const sha256ReadyReviewObservationV1 = async (value: string): Promise<string> => {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export const digestReadyReviewObservationProjectionV1 = async (value: unknown): Promise<string> =>
  sha256ReadyReviewObservationV1(canonicalizeReadyReviewObservationJcsV1(value))

export const deriveLastTerminalReceiptAtV1 = (admittedLiterals: readonly string[]): string | null => {
  if (admittedLiterals.length === 0 || !admittedLiterals.every(isoTime)) return null
  let winner = admittedLiterals[0]
  let winnerTime = Date.parse(winner)
  for (let index = 1; index < admittedLiterals.length; index += 1) {
    const candidate = admittedLiterals[index]
    const candidateTime = Date.parse(candidate)
    if (candidateTime > winnerTime) {
      winner = candidate
      winnerTime = candidateTime
    }
  }
  return winner
}

const without = (value: JsonObject, key: string): JsonObject => Object.fromEntries(Object.entries(value).filter(([name]) => name !== key))

export const validateReadyReviewGenerationRecordV1 = async (value: unknown): Promise<boolean> => {
  const keys = ['record_type', 'canonical_record', 'repository', 'pr_number', 'pr_url', 'exact_head', 'ready_event_id', 'ready_occurred_at', 'task_issue_url', 'revision', 'prior_record_url', 'producer_roster_source_url', 'producer_roster_source_digest', 'record_digest']
  if (!exactKeys(value, keys)) return false
  if (value.record_type !== 'ready_review_generation_record_v1' || !directCommentUrl(value.canonical_record) || !nonEmpty(value.repository) ||
      !Number.isSafeInteger(value.pr_number) || Number(value.pr_number) <= 0 || !directPrUrl(value.pr_url) || !fullHead(value.exact_head) ||
      !nonEmpty(value.ready_event_id) || !isoTime(value.ready_occurred_at) || !directIssueUrl(value.task_issue_url) ||
      !Number.isSafeInteger(value.revision) || Number(value.revision) <= 0 || !(value.prior_record_url === null || directCommentUrl(value.prior_record_url)) ||
      !directCommentUrl(value.producer_roster_source_url) || !sha256Value(value.producer_roster_source_digest) || !sha256Value(value.record_digest)) return false
  if ((value.revision === 1) !== (value.prior_record_url === null)) return false
  return await digestReadyReviewObservationProjectionV1(without(value, 'record_digest')) === value.record_digest
}

export const validateReadyReviewProducerRosterV1 = async (value: unknown): Promise<boolean> => {
  const keys = ['record_type', 'canonical_record', 'repository', 'pr_number', 'exact_head', 'ready_event_id', 'producer_ids', 'effective_from', 'effective_until', 'record_digest']
  if (!exactKeys(value, keys)) return false
  if (value.record_type !== 'ready_review_producer_roster_v1' || !directCommentUrl(value.canonical_record) || !nonEmpty(value.repository) ||
      !Number.isSafeInteger(value.pr_number) || Number(value.pr_number) <= 0 || !fullHead(value.exact_head) || !nonEmpty(value.ready_event_id) ||
      !stringArray(value.producer_ids) || value.producer_ids.length === 0 || !sortedUnique(value.producer_ids) || !isoTime(value.effective_from) ||
      !(value.effective_until === null || isoTime(value.effective_until)) || !sha256Value(value.record_digest)) return false
  if (value.effective_until !== null && Date.parse(value.effective_until) <= Date.parse(value.effective_from)) return false
  return await digestReadyReviewObservationProjectionV1(without(value, 'record_digest')) === value.record_digest
}

const validateSubmittedReviewProjection = (value: unknown): value is SubmittedReviewSourceProjectionV1 =>
  exactKeys(value, ['projection_version', 'kind', 'producer_id', 'review_id', 'review_url', 'submitted_at', 'reviewed_head', 'ready_event_id', 'review_state', 'finding_ids', 'source_observed_at']) &&
  value.projection_version === 'submitted-review-source-projection-v1' && value.kind === 'submitted_review' && nonEmpty(value.producer_id) && nonEmpty(value.review_id) &&
  typeof value.review_url === 'string' && /^https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+#pullrequestreview-\d+$/.test(value.review_url) &&
  isoTime(value.submitted_at) && fullHead(value.reviewed_head) && nonEmpty(value.ready_event_id) && nonEmpty(value.review_state) &&
  stringArray(value.finding_ids) && unique(value.finding_ids) && isoTime(value.source_observed_at)

const validateNoFindingsProjection = (value: unknown): value is NoFindingsCorrelationSourceProjectionV1 =>
  exactKeys(value, ['projection_version', 'kind', 'producer_id', 'reaction_id', 'reaction_target_url', 'reaction_actor', 'reaction_content', 'reaction_created_at', 'reviewed_head', 'ready_event_id', 'ready_interval_observation_digest', 'correlation_source_urls', 'source_observed_at']) &&
  value.projection_version === 'no-findings-correlation-source-projection-v1' && value.kind === 'no_findings_correlation' && nonEmpty(value.producer_id) && nonEmpty(value.reaction_id) &&
  directPrUrl(value.reaction_target_url) && nonEmpty(value.reaction_actor) && value.reaction_content === '+1' && isoTime(value.reaction_created_at) &&
  fullHead(value.reviewed_head) && nonEmpty(value.ready_event_id) && sha256Value(value.ready_interval_observation_digest) &&
  stringArray(value.correlation_source_urls) && value.correlation_source_urls.length > 0 && unique(value.correlation_source_urls) && isoTime(value.source_observed_at)

export const validateProducerTerminalReceiptObservationV1 = async (value: unknown): Promise<boolean> => {
  const keys = ['observation_version', 'producer_id', 'receipt_id', 'receipt_source_url', 'receipt_kind', 'receipt_created_at', 'reviewed_head', 'ready_event_id', 'source_projection', 'source_projection_digest', 'source_observed_at']
  if (!exactKeys(value, keys) || value.observation_version !== PRODUCER_TERMINAL_RECEIPT_OBSERVATION_V1 || !nonEmpty(value.producer_id) ||
      !nonEmpty(value.receipt_id) || !nonEmpty(value.receipt_source_url) || !isoTime(value.receipt_created_at) || !fullHead(value.reviewed_head) ||
      !nonEmpty(value.ready_event_id) || !sha256Value(value.source_projection_digest) || !isoTime(value.source_observed_at)) return false
  if (await digestReadyReviewObservationProjectionV1(value.source_projection) !== value.source_projection_digest) return false
  if (value.receipt_kind === 'submitted_review') {
    if (!validateSubmittedReviewProjection(value.source_projection)) return false
    return value.producer_id === value.source_projection.producer_id && value.receipt_id === value.source_projection.review_id &&
      value.receipt_source_url === value.source_projection.review_url && value.receipt_created_at === value.source_projection.submitted_at &&
      value.reviewed_head === value.source_projection.reviewed_head && value.ready_event_id === value.source_projection.ready_event_id &&
      value.source_observed_at === value.source_projection.source_observed_at
  }
  if (value.receipt_kind !== 'no_findings_correlation' || !validateNoFindingsProjection(value.source_projection)) return false
  return value.producer_id === value.source_projection.producer_id && value.receipt_id === value.source_projection.reaction_id &&
    value.receipt_source_url === value.source_projection.reaction_target_url && value.receipt_created_at === value.source_projection.reaction_created_at &&
    value.reviewed_head === value.source_projection.reviewed_head && value.ready_event_id === value.source_projection.ready_event_id &&
    value.source_observed_at === value.source_projection.source_observed_at
}

const validateThreadNode = (value: unknown): value is ThreadNodeObservationV1 =>
  exactKeys(value, ['thread_id', 'is_resolved', 'is_outdated', 'path', 'line', 'start_line', 'last_comment_id', 'last_comment_created_at']) &&
  nonEmpty(value.thread_id) && typeof value.is_resolved === 'boolean' && typeof value.is_outdated === 'boolean' && nonEmpty(value.path) &&
  (value.line === null || (Number.isSafeInteger(value.line) && Number(value.line) > 0)) &&
  (value.start_line === null || (Number.isSafeInteger(value.start_line) && Number(value.start_line) > 0)) &&
  nonEmpty(value.last_comment_id) && isoTime(value.last_comment_created_at)

const validateThreadPage = async (value: unknown): Promise<boolean> => {
  const keys = ['page_ordinal', 'start_cursor', 'end_cursor', 'has_next_page', 'nodes', 'source_url', 'source_observed_at', 'page_digest']
  if (!exactKeys(value, keys) || !Number.isSafeInteger(value.page_ordinal) || Number(value.page_ordinal) < 0 ||
      !(value.start_cursor === null || nonEmpty(value.start_cursor)) || !(value.end_cursor === null || nonEmpty(value.end_cursor)) ||
      typeof value.has_next_page !== 'boolean' || !Array.isArray(value.nodes) || !value.nodes.every(validateThreadNode) ||
      !nonEmpty(value.source_url) || !isoTime(value.source_observed_at) || !sha256Value(value.page_digest)) return false
  return await digestReadyReviewObservationProjectionV1(without(value, 'page_digest')) === value.page_digest
}

export const validatePostTerminalThreadSnapshotV1 = async (value: unknown): Promise<boolean> => {
  const keys = ['snapshot_version', 'query_identity', 'variables_identity', 'pages', 'terminal_receipt_ids', 'terminal_receipts_digest', 'last_terminal_receipt_at', 'observed_at', 'source_observation_urls', 'snapshot_digest']
  if (!exactKeys(value, keys) || value.snapshot_version !== POST_TERMINAL_THREAD_SNAPSHOT_V1 ||
      !exactKeys(value.query_identity, ['connection', 'query_sha256']) || value.query_identity.connection !== 'PullRequest.reviewThreads' || !sha256Value(value.query_identity.query_sha256) ||
      !exactKeys(value.variables_identity, ['repository', 'pr_number', 'exact_head', 'variables_sha256']) || !nonEmpty(value.variables_identity.repository) ||
      !Number.isSafeInteger(value.variables_identity.pr_number) || Number(value.variables_identity.pr_number) <= 0 || !fullHead(value.variables_identity.exact_head) || !sha256Value(value.variables_identity.variables_sha256) ||
      !Array.isArray(value.pages) || value.pages.length === 0 || !stringArray(value.terminal_receipt_ids) || value.terminal_receipt_ids.length === 0 || !unique(value.terminal_receipt_ids) ||
      !sha256Value(value.terminal_receipts_digest) || !isoTime(value.last_terminal_receipt_at) || !isoTime(value.observed_at) ||
      !stringArray(value.source_observation_urls) || value.source_observation_urls.length !== value.pages.length || !sha256Value(value.snapshot_digest)) return false
  if (Date.parse(value.observed_at) < Date.parse(value.last_terminal_receipt_at)) return false
  if (await digestReadyReviewObservationProjectionV1(value.terminal_receipt_ids) !== value.terminal_receipts_digest) return false
  const threadIds = new Set<string>()
  for (let index = 0; index < value.pages.length; index += 1) {
    const page = value.pages[index]
    if (!await validateThreadPage(page) || page.page_ordinal !== index || value.source_observation_urls[index] !== page.source_url ||
        Date.parse(page.source_observed_at) < Date.parse(value.last_terminal_receipt_at)) return false
    if (index === 0 ? page.start_cursor !== null : page.start_cursor !== value.pages[index - 1].end_cursor) return false
    if (index < value.pages.length - 1 ? (!page.has_next_page || page.end_cursor === null) : page.has_next_page) return false
    for (const node of page.nodes) {
      if (threadIds.has(node.thread_id)) return false
      threadIds.add(node.thread_id)
    }
  }
  return await digestReadyReviewObservationProjectionV1(without(value, 'snapshot_digest')) === value.snapshot_digest
}

export type ArtifactInputV1 = Omit<ReadyReviewTerminalObservationArtifactV1, 'artifact_digest'>

export const buildReadyReviewTerminalObservationArtifactV1 = async (input: unknown): Promise<ReadyReviewTerminalObservationArtifactV1 | null> => {
  const keys = ['artifact_version', 'repository', 'pr_number', 'pr_url', 'exact_head', 'ready_generation_record_url', 'ready_event_id', 'ready_occurred_at', 'producer_roster', 'producer_roster_source_digest', 'producer_receipts', 'terminal_receipt_ids', 'terminal_receipts_digest', 'last_terminal_receipt_at', 'thread_snapshot']
  if (!exactKeys(input, keys) || input.artifact_version !== READY_REVIEW_TERMINAL_OBSERVATION_ARTIFACT_V1 || !nonEmpty(input.repository) ||
      !Number.isSafeInteger(input.pr_number) || Number(input.pr_number) <= 0 || !directPrUrl(input.pr_url) || !fullHead(input.exact_head) ||
      !directCommentUrl(input.ready_generation_record_url) || !nonEmpty(input.ready_event_id) || !isoTime(input.ready_occurred_at) ||
      !stringArray(input.producer_roster) || input.producer_roster.length === 0 || !sortedUnique(input.producer_roster) || !sha256Value(input.producer_roster_source_digest) ||
      !Array.isArray(input.producer_receipts) || input.producer_receipts.length !== input.producer_roster.length || !stringArray(input.terminal_receipt_ids) ||
      input.terminal_receipt_ids.length !== input.producer_roster.length || !sha256Value(input.terminal_receipts_digest) || !isoTime(input.last_terminal_receipt_at)) return null
  const receipts = input.producer_receipts as unknown[]
  for (let index = 0; index < receipts.length; index += 1) {
    if (!await validateProducerTerminalReceiptObservationV1(receipts[index])) return null
    const receipt = receipts[index] as ProducerTerminalReceiptObservationV1
    if (receipt.producer_id !== input.producer_roster[index] || receipt.receipt_id !== input.terminal_receipt_ids[index] ||
        receipt.reviewed_head !== input.exact_head || receipt.ready_event_id !== input.ready_event_id || Date.parse(receipt.receipt_created_at) < Date.parse(input.ready_occurred_at)) return null
  }
  if (!unique(input.terminal_receipt_ids) || await digestReadyReviewObservationProjectionV1(input.terminal_receipt_ids) !== input.terminal_receipts_digest) return null
  const derivedLast = deriveLastTerminalReceiptAtV1(receipts.map((receipt) => (receipt as ProducerTerminalReceiptObservationV1).receipt_created_at))
  if (derivedLast !== input.last_terminal_receipt_at || !await validatePostTerminalThreadSnapshotV1(input.thread_snapshot)) return null
  const snapshot = input.thread_snapshot as PostTerminalThreadSnapshotV1
  if (snapshot.variables_identity.repository !== input.repository || snapshot.variables_identity.pr_number !== input.pr_number || snapshot.variables_identity.exact_head !== input.exact_head ||
      JSON.stringify(snapshot.terminal_receipt_ids) !== JSON.stringify(input.terminal_receipt_ids) || snapshot.terminal_receipts_digest !== input.terminal_receipts_digest || snapshot.last_terminal_receipt_at !== input.last_terminal_receipt_at) return null
  const projection = structuredClone(input) as ArtifactInputV1
  const artifact = { ...projection, artifact_digest: await digestReadyReviewObservationProjectionV1(projection) }
  return deepFreezeReadyReviewObservationV1(artifact) as ReadyReviewTerminalObservationArtifactV1
}

export const parseReadyReviewTerminalObservationArtifactV1 = async (utf8Jcs: string): Promise<ReadyReviewTerminalObservationArtifactV1 | null> => {
  let value: unknown
  try { value = JSON.parse(utf8Jcs) } catch { return null }
  if (!exactKeys(value, ['artifact_version', 'repository', 'pr_number', 'pr_url', 'exact_head', 'ready_generation_record_url', 'ready_event_id', 'ready_occurred_at', 'producer_roster', 'producer_roster_source_digest', 'producer_receipts', 'terminal_receipt_ids', 'terminal_receipts_digest', 'last_terminal_receipt_at', 'thread_snapshot', 'artifact_digest'])) return null
  const projection = without(value, 'artifact_digest')
  if (!sha256Value(value.artifact_digest) || utf8Jcs !== canonicalizeReadyReviewObservationJcsV1(value) || await digestReadyReviewObservationProjectionV1(projection) !== value.artifact_digest) return null
  const rebuilt = await buildReadyReviewTerminalObservationArtifactV1(projection)
  return rebuilt !== null && rebuilt.artifact_digest === value.artifact_digest ? rebuilt : null
}

const CORE_INPUT_KEYS = [
  'input_version',
  'request_identity',
  'ready_record_observations',
  'ready_event_observations',
  'roster_record_observation',
  'producer_source_observations',
  'thread_pages',
  'receipts_observed_at',
  'thread_snapshot_observed_at',
] as const

const REQUEST_IDENTITY_KEYS = ['repository', 'pr_number', 'pr_url', 'exact_head', 'ready_record_url'] as const
const RECORD_OBSERVATION_KEYS = ['source_url', 'author_login', 'author_association', 'record'] as const
const READY_EVENT_OBSERVATION_KEYS = ['event_id', 'event', 'created_at'] as const
const REVIEW_THREADS_QUERY_V1 = 'query($owner:String!,$name:String!,$number:Int!,$cursor:String){repository(owner:$owner,name:$name){pullRequest(number:$number){headRefOid reviewThreads(first:100,after:$cursor){nodes{id isResolved isOutdated path line startLine comments(last:1){nodes{id createdAt}}}pageInfo{hasNextPage endCursor}}}}}'

const rejectObservationV1 = (
  failureCode: ReadyReviewTerminalObservationFailureCodeV1,
  stage: ReadyReviewTerminalObservationFailureStageV1,
): ReadyReviewTerminalObservationCoreResultV1 => deepFreezeReadyReviewObservationV1({
  branch: 'observation_rejected' as const,
  failure: { failure_code: failureCode, stage },
})

const validateCoreInputEnvelopeV1 = (value: unknown): value is ReadyReviewTerminalObservationCoreInputV1 =>
  exactKeys(value, CORE_INPUT_KEYS) &&
  value.input_version === READY_REVIEW_TERMINAL_OBSERVATION_CORE_INPUT_V1 &&
  exactKeys(value.request_identity, REQUEST_IDENTITY_KEYS) &&
  nonEmpty(value.request_identity.repository) &&
  /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value.request_identity.repository) &&
  Number.isSafeInteger(value.request_identity.pr_number) && Number(value.request_identity.pr_number) > 0 &&
  directPrUrl(value.request_identity.pr_url) &&
  fullHead(value.request_identity.exact_head) &&
  directCommentUrl(value.request_identity.ready_record_url) &&
  Array.isArray(value.ready_record_observations) && value.ready_record_observations.length > 0 &&
  Array.isArray(value.ready_event_observations) && value.ready_event_observations.length > 0 &&
  isObject(value.roster_record_observation) &&
  Array.isArray(value.producer_source_observations) &&
  Array.isArray(value.thread_pages) && value.thread_pages.length > 0 &&
  isoTime(value.receipts_observed_at) &&
  isoTime(value.thread_snapshot_observed_at)

const sourceProjectionIsAdmittedV1 = (value: unknown): value is SubmittedReviewSourceProjectionV1 | NoFindingsCorrelationSourceProjectionV1 =>
  validateSubmittedReviewProjection(value) || validateNoFindingsProjection(value)

const makeTerminalReceiptV1 = async (
  projection: SubmittedReviewSourceProjectionV1 | NoFindingsCorrelationSourceProjectionV1,
): Promise<ProducerTerminalReceiptObservationV1> => {
  const submitted = projection.kind === 'submitted_review'
  return {
    observation_version: PRODUCER_TERMINAL_RECEIPT_OBSERVATION_V1,
    producer_id: projection.producer_id,
    receipt_id: submitted ? projection.review_id : projection.reaction_id,
    receipt_source_url: submitted ? projection.review_url : projection.reaction_target_url,
    receipt_kind: projection.kind,
    receipt_created_at: submitted ? projection.submitted_at : projection.reaction_created_at,
    reviewed_head: projection.reviewed_head,
    ready_event_id: projection.ready_event_id,
    source_projection: structuredClone(projection),
    source_projection_digest: await digestReadyReviewObservationProjectionV1(projection),
    source_observed_at: projection.source_observed_at,
  }
}

export const evaluateReadyReviewTerminalObservationCoreV1 = async (
  value: unknown,
): Promise<ReadyReviewTerminalObservationCoreResultV1> => {
  if (!validateCoreInputEnvelopeV1(value)) return rejectObservationV1('input_shape_invalid', 'input')
  const input = value
  const request = input.request_identity
  const repositoryOwner = request.repository.split('/')[0]

  const admittedReadyRecords: ReadyReviewGenerationRecordV1[] = []
  for (const observation of input.ready_record_observations) {
    if (!exactKeys(observation, RECORD_OBSERVATION_KEYS) || observation.author_association !== 'OWNER' ||
        observation.author_login !== repositoryOwner || observation.source_url !== (isObject(observation.record) ? observation.record.canonical_record : undefined) ||
        !await validateReadyReviewGenerationRecordV1(observation.record)) {
      return rejectObservationV1('ready_authority_invalid', 'ready_authority')
    }
    const record = observation.record
    if (record.repository !== request.repository || record.pr_number !== request.pr_number || record.pr_url !== request.pr_url ||
        record.exact_head !== request.exact_head) return rejectObservationV1('ready_authority_invalid', 'ready_authority')
    admittedReadyRecords.push(record)
  }

  const byRevision = new Map<number, ReadyReviewGenerationRecordV1>()
  const referenced = new Set<string>()
  for (const record of admittedReadyRecords) {
    if (byRevision.has(record.revision)) return rejectObservationV1('ready_chain_invalid', 'ready_chain')
    byRevision.set(record.revision, record)
    if (record.prior_record_url !== null) referenced.add(record.prior_record_url)
  }
  const maximumRevision = Math.max(...byRevision.keys())
  if (byRevision.size !== maximumRevision) return rejectObservationV1('ready_chain_invalid', 'ready_chain')
  for (let revision = 1; revision <= maximumRevision; revision += 1) {
    const record = byRevision.get(revision)
    if (record === undefined) return rejectObservationV1('ready_chain_invalid', 'ready_chain')
    const expectedPrior = revision === 1 ? null : byRevision.get(revision - 1)?.canonical_record
    if (record.prior_record_url !== expectedPrior) return rejectObservationV1('ready_chain_invalid', 'ready_chain')
  }
  const leaves = admittedReadyRecords.filter((record) => !referenced.has(record.canonical_record))
  if (leaves.length !== 1 || leaves[0].canonical_record !== request.ready_record_url) return rejectObservationV1('ready_chain_invalid', 'ready_chain')
  const readyRecord = leaves[0]

  let matchingReadyEvents = 0
  for (const event of input.ready_event_observations) {
    if (!exactKeys(event, READY_EVENT_OBSERVATION_KEYS) || event.event !== 'ready_for_review' || !nonEmpty(event.event_id) || !isoTime(event.created_at)) {
      return rejectObservationV1('ready_event_invalid', 'ready_event')
    }
    if (event.event_id === readyRecord.ready_event_id && event.created_at === readyRecord.ready_occurred_at) matchingReadyEvents += 1
  }
  if (matchingReadyEvents !== 1) return rejectObservationV1('ready_event_invalid', 'ready_event')

  const rosterObservation = input.roster_record_observation
  if (!exactKeys(rosterObservation, RECORD_OBSERVATION_KEYS) || rosterObservation.author_association !== 'OWNER' ||
      rosterObservation.author_login !== repositoryOwner || rosterObservation.source_url !== (isObject(rosterObservation.record) ? rosterObservation.record.canonical_record : undefined) ||
      !await validateReadyReviewProducerRosterV1(rosterObservation.record)) return rejectObservationV1('roster_authority_invalid', 'roster')
  const roster = rosterObservation.record
  if (roster.canonical_record !== readyRecord.producer_roster_source_url || roster.record_digest !== readyRecord.producer_roster_source_digest ||
      roster.repository !== request.repository || roster.pr_number !== request.pr_number || roster.exact_head !== request.exact_head ||
      roster.ready_event_id !== readyRecord.ready_event_id || Date.parse(readyRecord.ready_occurred_at) < Date.parse(roster.effective_from) ||
      (roster.effective_until !== null && Date.parse(readyRecord.ready_occurred_at) >= Date.parse(roster.effective_until))) {
    return rejectObservationV1('roster_authority_invalid', 'roster')
  }

  if (!input.producer_source_observations.every(sourceProjectionIsAdmittedV1)) return rejectObservationV1('producer_receipt_invalid', 'receipts')
  const receipts: ProducerTerminalReceiptObservationV1[] = []
  for (const producerId of roster.producer_ids) {
    const sources = input.producer_source_observations.filter((source) => source.producer_id === producerId)
    if (sources.length !== 1) return rejectObservationV1('producer_receipt_incomplete', 'receipts')
    const source = sources[0]
    const receiptCreatedAt = source.kind === 'submitted_review' ? source.submitted_at : source.reaction_created_at
    if (source.reviewed_head !== request.exact_head || source.ready_event_id !== readyRecord.ready_event_id ||
        source.source_observed_at !== input.receipts_observed_at || Date.parse(receiptCreatedAt) < Date.parse(readyRecord.ready_occurred_at) ||
        Date.parse(source.source_observed_at) < Date.parse(receiptCreatedAt)) return rejectObservationV1('producer_receipt_invalid', 'receipts')
    receipts.push(await makeTerminalReceiptV1(source))
  }
  if (input.producer_source_observations.length !== receipts.length) return rejectObservationV1('producer_receipt_invalid', 'receipts')

  const terminalReceiptIds = receipts.map((receipt) => receipt.receipt_id)
  if (!unique(terminalReceiptIds)) return rejectObservationV1('producer_receipt_invalid', 'receipts')
  const lastTerminalReceiptAt = deriveLastTerminalReceiptAtV1(receipts.map((receipt) => receipt.receipt_created_at))
  if (lastTerminalReceiptAt === null || Date.parse(input.thread_snapshot_observed_at) < Date.parse(lastTerminalReceiptAt)) {
    return rejectObservationV1('temporal_binding_invalid', 'threads')
  }

  for (const page of input.thread_pages) {
    if (!await validateThreadPage(page)) return rejectObservationV1('thread_snapshot_invalid', 'threads')
    if (Date.parse(page.source_observed_at) < Date.parse(lastTerminalReceiptAt)) return rejectObservationV1('temporal_binding_invalid', 'threads')
  }
  const terminalReceiptsDigest = await digestReadyReviewObservationProjectionV1(terminalReceiptIds)
  const querySha256 = await digestReadyReviewObservationProjectionV1(REVIEW_THREADS_QUERY_V1)
  const variablesSha256 = await digestReadyReviewObservationProjectionV1({
    repository: request.repository,
    pr_number: request.pr_number,
    exact_head: request.exact_head,
  })
  const snapshotProjection = {
    snapshot_version: POST_TERMINAL_THREAD_SNAPSHOT_V1,
    query_identity: { connection: 'PullRequest.reviewThreads' as const, query_sha256: querySha256 },
    variables_identity: { repository: request.repository, pr_number: request.pr_number, exact_head: request.exact_head, variables_sha256: variablesSha256 },
    pages: structuredClone(input.thread_pages),
    terminal_receipt_ids: terminalReceiptIds,
    terminal_receipts_digest: terminalReceiptsDigest,
    last_terminal_receipt_at: lastTerminalReceiptAt,
    observed_at: input.thread_snapshot_observed_at,
    source_observation_urls: input.thread_pages.map((page) => page.source_url),
  }
  const threadSnapshot = {
    ...snapshotProjection,
    snapshot_digest: await digestReadyReviewObservationProjectionV1(snapshotProjection),
  }
  if (!await validatePostTerminalThreadSnapshotV1(threadSnapshot)) return rejectObservationV1('thread_snapshot_invalid', 'threads')

  const artifact = await buildReadyReviewTerminalObservationArtifactV1({
    artifact_version: READY_REVIEW_TERMINAL_OBSERVATION_ARTIFACT_V1,
    repository: request.repository,
    pr_number: request.pr_number,
    pr_url: request.pr_url,
    exact_head: request.exact_head,
    ready_generation_record_url: readyRecord.canonical_record,
    ready_event_id: readyRecord.ready_event_id,
    ready_occurred_at: readyRecord.ready_occurred_at,
    producer_roster: roster.producer_ids,
    producer_roster_source_digest: roster.record_digest,
    producer_receipts: receipts,
    terminal_receipt_ids: terminalReceiptIds,
    terminal_receipts_digest: terminalReceiptsDigest,
    last_terminal_receipt_at: lastTerminalReceiptAt,
    thread_snapshot: threadSnapshot,
  })
  if (artifact === null) return rejectObservationV1('artifact_seal_invalid', 'artifact')
  return deepFreezeReadyReviewObservationV1({ branch: 'artifact_produced' as const, artifact })
}
