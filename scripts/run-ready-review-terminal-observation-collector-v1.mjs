import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { parse as parseYaml } from 'yaml'
import {
  READY_REVIEW_TERMINAL_OBSERVATION_CORE_INPUT_V1,
  canonicalizeReadyReviewObservationJcsV1,
  digestReadyReviewObservationProjectionV1,
  evaluateReadyReviewTerminalObservationCoreV1,
} from '../src/continuous-orchestration/ready-review-terminal-observation-artifact-v1.ts'

const execFileAsync = promisify(execFile)
const COMMENT_URL = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)#issuecomment-(\d+)$/
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/
const FULL_HEAD = /^[0-9a-f]{40}$/

const fail = (message) => {
  process.stderr.write(`ready-review-terminal-observation-collector-v1: ${message}\n`)
  process.exitCode = 1
}

const exactArgs = (argv) => {
  const admitted = new Map()
  const allowed = new Set(['--repository', '--pr', '--head', '--ready-record'])
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
  const readyRecordUrl = admitted.get('--ready-record')
  const prNumber = Number(prText)
  if (!REPOSITORY.test(repository) || !Number.isSafeInteger(prNumber) || prNumber <= 0 || !FULL_HEAD.test(exactHead) || !COMMENT_URL.test(readyRecordUrl)) return null
  return Object.freeze({ repository, prNumber, exactHead, readyRecordUrl })
}

const parseRecordBody = (body) => {
  if (typeof body !== 'string') return null
  const fenced = /```(?:yaml|yml|json)\r?\n([\s\S]*?)\r?\n```/i.exec(body)
  const source = fenced ? fenced[1] : body.trim()
  try {
    const parsed = parseYaml(source)
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

class TransportFailureV1 extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
  }
}

const ghJson = async (args) => {
  let stdout
  try {
    ;({ stdout } = await execFileAsync('gh', ['api', ...args], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, windowsHide: true }))
  } catch {
    throw new TransportFailureV1('github_command_failed', 'authenticated GitHub acquisition failed')
  }
  try {
    return JSON.parse(stdout)
  } catch {
    throw new TransportFailureV1('github_response_invalid', 'GitHub response is not JSON')
  }
}

const ghPaginated = async (endpoint) => {
  const pages = await ghJson(['--paginate', '--slurp', endpoint])
  if (!Array.isArray(pages) || !pages.every(Array.isArray)) throw new TransportFailureV1('pagination_incomplete', 'GitHub pagination shape mismatch')
  return pages.flat()
}

const commentIdentity = (url) => {
  const match = typeof url === 'string' ? COMMENT_URL.exec(url) : null
  return match === null ? null : { owner: match[1], repositoryName: match[2], issueNumber: Number(match[3]), commentId: match[4] }
}

const recordObservation = (comment) => ({
  source_url: typeof comment?.html_url === 'string' ? comment.html_url : '',
  author_login: typeof comment?.user?.login === 'string' ? comment.user.login : '',
  author_association: comment?.author_association,
  record: parseRecordBody(comment?.body),
})

const extractFindingIds = (body) => {
  if (typeof body !== 'string') return []
  return [...new Set(body.match(/\bB-[A-Z0-9]+(?:-[A-Z0-9]+)+\b/g) ?? [])]
}

const privateTransportFailure = (error) => Object.freeze({
  branch: 'transport_failed',
  failure_code: error instanceof TransportFailureV1 ? error.code : 'github_response_invalid',
})

class OwnerOnlyReadyReviewObservationTransportAdapterV1 {
  async collect(request) {
    try {
      const [repositoryOwner, repositoryName] = request.repository.split('/')
      const readyIdentity = commentIdentity(request.readyRecordUrl)
      if (!readyIdentity || `${readyIdentity.owner}/${readyIdentity.repositoryName}` !== request.repository) {
        return privateTransportFailure(new TransportFailureV1('github_response_invalid', 'Ready record repository mismatch'))
      }

      const [readyComment, pullRequest, timeline, issueComments] = await Promise.all([
        ghJson([`repos/${request.repository}/issues/comments/${readyIdentity.commentId}`]),
        ghJson([`repos/${request.repository}/pulls/${request.prNumber}`]),
        ghPaginated(`repos/${request.repository}/issues/${request.prNumber}/timeline?per_page=100`),
        ghPaginated(`repos/${request.repository}/issues/${readyIdentity.issueNumber}/comments?per_page=100`),
      ])
      if (pullRequest?.head?.sha !== request.exactHead) return privateTransportFailure(new TransportFailureV1('head_changed_during_collection', 'exact PR HEAD changed'))

      const readyRecord = parseRecordBody(readyComment?.body)
      const readyRecordObservations = issueComments
        .map(recordObservation)
        .filter((observation) => observation.source_url === request.readyRecordUrl || observation.record?.record_type === 'ready_review_generation_record_v1')
      if (!readyRecordObservations.some((observation) => observation.source_url === request.readyRecordUrl)) readyRecordObservations.push(recordObservation(readyComment))

      const rosterIdentity = commentIdentity(readyRecord?.producer_roster_source_url)
      let rosterComment = null
      if (rosterIdentity && `${rosterIdentity.owner}/${rosterIdentity.repositoryName}` === request.repository) {
        rosterComment = await ghJson([`repos/${request.repository}/issues/comments/${rosterIdentity.commentId}`])
      }
      const rosterRecordObservation = recordObservation(rosterComment)
      const roster = rosterRecordObservation.record

      const [reviews, reactions] = await Promise.all([
        ghPaginated(`repos/${request.repository}/pulls/${request.prNumber}/reviews?per_page=100`),
        ghPaginated(`repos/${request.repository}/issues/${request.prNumber}/reactions?per_page=100`),
      ])
      const receiptsObservedAt = new Date().toISOString()
      const producerIds = Array.isArray(roster?.producer_ids) ? roster.producer_ids.filter((value) => typeof value === 'string') : []
      const producerSourceObservations = []
      for (const producerId of producerIds) {
        for (const review of reviews.filter((item) => item?.user?.login === producerId)) {
          producerSourceObservations.push({
            projection_version: 'submitted-review-source-projection-v1',
            kind: 'submitted_review',
            producer_id: producerId,
            review_id: String(review.id),
            review_url: review.html_url,
            submitted_at: review.submitted_at,
            reviewed_head: review.commit_id,
            ready_event_id: readyRecord?.ready_event_id,
            review_state: String(review.state),
            finding_ids: extractFindingIds(review.body),
            source_observed_at: receiptsObservedAt,
          })
        }
        for (const reaction of reactions.filter((item) => item?.user?.login === producerId && item?.content === '+1')) {
          const correlationSourceUrls = [pullRequest?.html_url, readyComment?.html_url, reaction.url ?? `${pullRequest?.html_url}#reaction-${reaction.id}`]
          producerSourceObservations.push({
            projection_version: 'no-findings-correlation-source-projection-v1',
            kind: 'no_findings_correlation',
            producer_id: producerId,
            reaction_id: String(reaction.id),
            reaction_target_url: pullRequest?.html_url,
            reaction_actor: reaction.user.login,
            reaction_content: '+1',
            reaction_created_at: reaction.created_at,
            reviewed_head: request.exactHead,
            ready_event_id: readyRecord?.ready_event_id,
            ready_interval_observation_digest: await digestReadyReviewObservationProjectionV1({
              repository: request.repository,
              pr_number: request.prNumber,
              exact_head: request.exactHead,
              ready_event_id: readyRecord?.ready_event_id,
              ready_occurred_at: readyRecord?.ready_occurred_at,
              reaction_id: String(reaction.id),
              reaction_created_at: reaction.created_at,
              source_urls: correlationSourceUrls,
            }),
            correlation_source_urls: correlationSourceUrls,
            source_observed_at: receiptsObservedAt,
          })
        }
      }

      const hasOneSourcePerProducer = producerIds.length > 0 && producerIds.every((producerId) =>
        producerSourceObservations.filter((source) => source.producer_id === producerId).length === 1)
      const threadPages = hasOneSourcePerProducer
        ? await this.#collectThreadPages({ request, repositoryOwner, repositoryName })
        : []
      const coreInput = {
        input_version: READY_REVIEW_TERMINAL_OBSERVATION_CORE_INPUT_V1,
        request_identity: {
          repository: request.repository,
          pr_number: request.prNumber,
          pr_url: `https://github.com/${request.repository}/pull/${request.prNumber}`,
          exact_head: request.exactHead,
          ready_record_url: request.readyRecordUrl,
        },
        ready_record_observations: readyRecordObservations,
        ready_event_observations: timeline
          .filter((event) => event?.event === 'ready_for_review')
          .map((event) => ({ event_id: String(event.id), event: event.event, created_at: event.created_at })),
        roster_record_observation: rosterRecordObservation,
        producer_source_observations: producerSourceObservations,
        thread_pages: threadPages,
        receipts_observed_at: receiptsObservedAt,
        thread_snapshot_observed_at: new Date().toISOString(),
      }
      return await evaluateReadyReviewTerminalObservationCoreV1(coreInput)
    } catch (error) {
      return privateTransportFailure(error)
    }
  }

  async #collectThreadPages({ request, repositoryOwner, repositoryName }) {
    const query = 'query($owner:String!,$name:String!,$number:Int!,$cursor:String){repository(owner:$owner,name:$name){pullRequest(number:$number){headRefOid reviewThreads(first:100,after:$cursor){nodes{id isResolved isOutdated path line startLine comments(last:1){nodes{id createdAt}}}pageInfo{hasNextPage endCursor}}}}}'
    const pages = []
    let cursor = null
    do {
      const args = ['graphql', '-f', `query=${query}`, '-f', `owner=${repositoryOwner}`, '-f', `name=${repositoryName}`, '-F', `number=${request.prNumber}`]
      if (cursor !== null) args.push('-f', `cursor=${cursor}`)
      const response = await ghJson(args)
      const pull = response?.data?.repository?.pullRequest
      const connection = pull?.reviewThreads
      if (pull?.headRefOid !== request.exactHead) throw new TransportFailureV1('head_changed_during_collection', 'exact PR HEAD changed during thread acquisition')
      if (!connection || !Array.isArray(connection.nodes) || !connection.pageInfo) throw new TransportFailureV1('github_response_invalid', 'reviewThreads response failed admission')
      const observedAt = new Date().toISOString()
      const nodes = connection.nodes.map((thread) => {
        const comments = thread?.comments?.nodes
        const last = Array.isArray(comments) ? comments.at(-1) : null
        return {
          thread_id: String(thread?.id ?? ''),
          is_resolved: thread?.isResolved,
          is_outdated: thread?.isOutdated,
          path: thread?.path,
          line: thread?.line ?? null,
          start_line: thread?.startLine ?? null,
          last_comment_id: String(last?.id ?? ''),
          last_comment_created_at: last?.createdAt,
        }
      })
      const pageProjection = {
        page_ordinal: pages.length,
        start_cursor: cursor,
        end_cursor: connection.pageInfo.endCursor ?? null,
        has_next_page: connection.pageInfo.hasNextPage,
        nodes,
        source_url: `https://api.github.com/graphql#PullRequest.reviewThreads-page-${pages.length}`,
        source_observed_at: observedAt,
      }
      pages.push({ ...pageProjection, page_digest: await digestReadyReviewObservationProjectionV1(pageProjection) })
      cursor = connection.pageInfo.endCursor ?? null
      if (connection.pageInfo.hasNextPage && cursor === null) throw new TransportFailureV1('pagination_incomplete', 'reviewThreads cursor chain is broken')
    } while (pages.at(-1).has_next_page)
    return pages
  }
}

const request = exactArgs(process.argv.slice(2))
if (request === null) {
  fail('expected exactly --repository OWNER/REPO --pr NUMBER --head FULL_SHA --ready-record DIRECT_COMMENT_URL')
} else {
  const adapter = new OwnerOnlyReadyReviewObservationTransportAdapterV1()
  const result = await adapter.collect(request)
  if (result.branch === 'artifact_produced') {
    process.stdout.write(canonicalizeReadyReviewObservationJcsV1(result.artifact))
  } else {
    fail(result.branch === 'transport_failed' ? result.failure_code : `${result.failure.stage}:${result.failure.failure_code}`)
  }
}
