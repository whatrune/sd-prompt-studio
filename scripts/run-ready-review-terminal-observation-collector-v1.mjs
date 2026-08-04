import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import {
  HOST_LEVEL_READY_REVIEW_BARRIER_INPUT_V1,
  evaluateHostLevelReadyReviewBarrierV1,
} from '../src/continuous-orchestration/minimal-ready-review-barrier-v1.ts'

const execFileAsync = promisify(execFile)
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/
const FULL_HEAD = /^[0-9a-f]{40}$/
const POSITIVE_DECIMAL = /^[1-9][0-9]*$/
const PRODUCER = 'chatgpt-codex-connector[bot]'

const fail = (message) => {
  process.stderr.write(`ready-review-terminal-observation-collector-v1: ${message}\n`)
  process.exitCode = 1
}

const exactArgs = (argv) => {
  const admitted = new Map()
  const allowed = new Set(['--repository', '--pr', '--head', '--ready-event-id'])
  if (argv.length !== 8) return null
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index]
    const value = argv[index + 1]
    if (!allowed.has(key) || admitted.has(key) || typeof value !== 'string' || value.length === 0) return null
    admitted.set(key, value)
  }
  const repository = admitted.get('--repository')
  const prText = admitted.get('--pr')
  const exactHead = admitted.get('--head')
  const readyEventId = admitted.get('--ready-event-id')
  const prNumber = Number(prText)
  if (!REPOSITORY.test(repository) || !Number.isSafeInteger(prNumber) || prNumber <= 0 ||
      !FULL_HEAD.test(exactHead) || !POSITIVE_DECIMAL.test(readyEventId)) return null
  return Object.freeze({ repository, prNumber, exactHead, readyEventId })
}

class TransportFailureV1 extends Error {}

const ghJson = async (args) => {
  let stdout
  try {
    ;({ stdout } = await execFileAsync('gh', ['api', ...args], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, windowsHide: true }))
  } catch {
    throw new TransportFailureV1('authenticated GitHub acquisition failed')
  }
  try {
    return JSON.parse(stdout)
  } catch {
    throw new TransportFailureV1('GitHub response is not JSON')
  }
}

const ghPaginated = async (endpoint) => {
  const pages = await ghJson(['--paginate', '--slurp', endpoint])
  if (!Array.isArray(pages) || !pages.every(Array.isArray)) throw new TransportFailureV1('GitHub pagination shape mismatch')
  return pages.flat()
}

const failed = (failureStage, failureCode) => ({
  input_version: HOST_LEVEL_READY_REVIEW_BARRIER_INPUT_V1,
  observation: 'observation_failed',
  failure_stage: failureStage,
  failure_code: failureCode,
})

const evaluateFailure = (stage, code) => evaluateHostLevelReadyReviewBarrierV1(failed(stage, code))

const collectThreadPages = async ({ repository, prNumber, exactHead }) => {
  const [owner, name] = repository.split('/')
  const query = 'query($owner:String!,$name:String!,$number:Int!,$cursor:String){repository(owner:$owner,name:$name){pullRequest(number:$number){headRefOid reviewThreads(first:100,after:$cursor){nodes{id isResolved isOutdated}pageInfo{hasNextPage endCursor}}}}}'
  const pages = []
  let cursor = null
  do {
    const args = ['graphql', '-f', `query=${query}`, '-f', `owner=${owner}`, '-f', `name=${name}`, '-F', `number=${prNumber}`]
    if (cursor !== null) args.push('-f', `cursor=${cursor}`)
    const response = await ghJson(args)
    const pull = response?.data?.repository?.pullRequest
    const connection = pull?.reviewThreads
    if (pull?.headRefOid !== exactHead) return { failure: 'head_mismatch' }
    if (!connection || !Array.isArray(connection.nodes) || !connection.pageInfo ||
        typeof connection.pageInfo.hasNextPage !== 'boolean') return { failure: 'page_malformed' }
    const sourceObservedAt = new Date().toISOString()
    const endCursor = connection.pageInfo.endCursor ?? null
    pages.push({
      ordinal: pages.length,
      requested_after: cursor,
      end_cursor: endCursor,
      has_next_page: connection.pageInfo.hasNextPage,
      head_ref_oid: pull.headRefOid,
      source_observed_at: sourceObservedAt,
      nodes: connection.nodes.map((thread) => ({
        thread_id: typeof thread?.id === 'string' ? thread.id : '',
        is_resolved: thread?.isResolved,
        is_outdated: thread?.isOutdated,
      })),
    })
    if (connection.pageInfo.hasNextPage && endCursor === null) return { failure: 'cursor_incomplete' }
    cursor = endCursor
  } while (pages.at(-1).has_next_page)
  return { pages }
}

const runHost = async (request) => {
  let timeline
  try {
    timeline = await ghPaginated(`repos/${request.repository}/issues/${request.prNumber}/timeline?per_page=100`)
  } catch {
    return evaluateFailure('timeline', 'github_read_failed')
  }
  const timelineObservedAt = new Date().toISOString()
  const ready = timeline.find((event) => String(event?.id ?? '') === request.readyEventId && event?.event === 'ready_for_review')
  if (!ready || typeof ready.created_at !== 'string') return evaluateFailure('timeline', 'ready_event_missing_or_invalid')

  let pull
  try {
    pull = await ghJson([`repos/${request.repository}/pulls/${request.prNumber}`])
  } catch {
    return evaluateFailure('pr', 'github_read_failed')
  }
  const pullObservedAt = new Date().toISOString()
  if (pull?.state !== 'open') return evaluateFailure('pr', 'not_open')
  if (pull?.draft !== false) return evaluateFailure('pr', 'draft')
  if (pull?.head?.sha !== request.exactHead) return evaluateFailure('pr', 'head_mismatch')

  let reviews
  try {
    reviews = await ghPaginated(`repos/${request.repository}/pulls/${request.prNumber}/reviews?per_page=100`)
  } catch {
    return evaluateFailure('reviews', 'github_read_failed')
  }
  const reviewsObservedAt = new Date().toISOString()
  const codexReviews = reviews.filter((review) => review?.user?.login === PRODUCER)
  const headBound = codexReviews.filter((review) => review?.commit_id === request.exactHead)
  const qualified = headBound.filter((review) => typeof review?.submitted_at === 'string' &&
    Date.parse(review.submitted_at) >= Date.parse(ready.created_at))
  if (qualified.length === 0) {
    if (codexReviews.some((review) => review?.commit_id !== request.exactHead)) return evaluateFailure('reviews', 'review_head_mismatch')
    if (headBound.some((review) => typeof review?.submitted_at === 'string' && Date.parse(review.submitted_at) < Date.parse(ready.created_at))) {
      return evaluateFailure('reviews', 'review_before_ready')
    }
    return evaluateFailure('reviews', 'review_not_observed')
  }
  qualified.sort((left, right) => Date.parse(left.submitted_at) - Date.parse(right.submitted_at) || Number(left.id) - Number(right.id))
  const latest = qualified.at(-1)

  let threadResult
  try {
    threadResult = await collectThreadPages(request)
  } catch {
    return evaluateFailure('threads', 'github_read_failed')
  }
  if (threadResult.failure) return evaluateFailure('threads', threadResult.failure)
  const snapshotObservedAt = threadResult.pages.reduce((latestTime, page) =>
    Date.parse(page.source_observed_at) > Date.parse(latestTime) ? page.source_observed_at : latestTime,
  threadResult.pages[0].source_observed_at)

  return evaluateHostLevelReadyReviewBarrierV1({
    input_version: HOST_LEVEL_READY_REVIEW_BARRIER_INPUT_V1,
    observation: 'observation_complete',
    request: {
      repository: request.repository,
      pr_number: request.prNumber,
      pr_url: `https://github.com/${request.repository}/pull/${request.prNumber}`,
      exact_head: request.exactHead,
    },
    ready_event: {
      event_id: request.readyEventId,
      event_type: 'ready_for_review',
      occurred_at: ready.created_at,
      source_observed_at: timelineObservedAt,
    },
    pull_request: {
      state: pull.state,
      draft: pull.draft,
      head_sha: pull.head.sha,
      source_observed_at: pullObservedAt,
    },
    review_observation: {
      acquisition_completed_at: reviewsObservedAt,
      latest: {
        producer: PRODUCER,
        review_id: String(latest.id),
        review_url: latest.html_url,
        reviewed_head: latest.commit_id,
        submitted_at: latest.submitted_at,
        source_observed_at: reviewsObservedAt,
      },
    },
    thread_snapshot: {
      observed_at: snapshotObservedAt,
      pages: threadResult.pages,
    },
  })
}

const request = exactArgs(process.argv.slice(2))
if (request === null) {
  fail('expected exactly --repository OWNER/REPO --pr NUMBER --head FULL_SHA --ready-event-id POSITIVE_DECIMAL_ID')
} else {
  process.stdout.write(JSON.stringify(await runHost(request)))
}
