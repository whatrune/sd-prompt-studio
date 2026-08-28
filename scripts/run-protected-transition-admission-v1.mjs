import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import {
  executeSimplifiedMergeV1,
  executeSimplifiedReadyV1,
  serializeSimplifiedMergeDecisionV1,
  serializeSimplifiedReviewV1,
  serializeSimplifiedTaskAuthorityV1,
} from './protected-transition-merge-operator-preflight-v1.mjs'

const API_ROOT = 'https://api.github.com'
const args = process.argv.slice(2)
const valueAfter = (flag) => {
  const index = args.indexOf(flag)
  return index < 0 || index + 1 >= args.length ? null : args[index + 1]
}

const boundedMessage = (value) => String(value ?? 'github_request_failed')
  .replace(/(?:[A-Za-z][A-Za-z0-9+.-]*:\/\/|www\.)[^\s<>"']+/gu, '[REDACTED_URL]')
  .replace(/[\r\n\t]+/gu, ' ')
  .slice(0, 512)

const request = async (url, options = {}) => {
  const token = process.env.GH_TOKEN
  if (typeof token !== 'string' || token.length === 0) throw new Error('github_token_missing')
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...options.headers,
    },
  })
  let body
  try { body = await response.json() } catch { throw new Error(`github_response_invalid:${response.status}`) }
  if (!response.ok) throw new Error(`github_http_${response.status}:${boundedMessage(body?.message)}`)
  return body
}

export const createProductionHostV1 = () => Object.freeze({
  api: (route) => request(`${API_ROOT}/${route}`),
  graphql: async (query, variables) => {
    const body = await request(`${API_ROOT}/graphql`, {
      method: 'POST',
      body: JSON.stringify({ query, variables }),
    })
    if (Array.isArray(body?.errors) && body.errors.length > 0) {
      throw new Error(`github_graphql_error:${boundedMessage(body.errors[0]?.message)}`)
    }
    if (body?.data === undefined) throw new Error('github_graphql_response_invalid')
    return body.data
  },
})

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'))
if (process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const serializeMode = valueAfter('--serialize-task-authority-file') !== null
    ? ['task', valueAfter('--serialize-task-authority-file')]
    : valueAfter('--serialize-review-file') !== null
      ? ['review', valueAfter('--serialize-review-file')]
      : valueAfter('--serialize-merge-decision-file') !== null
        ? ['merge', valueAfter('--serialize-merge-decision-file')]
        : null

  if (serializeMode !== null) {
    const [kind, file] = serializeMode
    const input = readJson(file)
    const body = kind === 'task'
      ? serializeSimplifiedTaskAuthorityV1(input)
      : kind === 'review'
        ? serializeSimplifiedReviewV1(input)
        : serializeSimplifiedMergeDecisionV1(input)
    process.stdout.write(body)
  } else {
    const issueEventFile = valueAfter('--simplified-issue-comment-event-file')
    const dispatchEventFile = valueAfter('--simplified-workflow-dispatch-event-file')
    if ((issueEventFile === null) === (dispatchEventFile === null)) throw new Error('exactly_one_event_file_required')
    const event = readJson(issueEventFile ?? dispatchEventFile)
    if (dispatchEventFile !== null) event.action = 'workflow_dispatch'
    const plan = issueEventFile !== null
      ? await executeSimplifiedMergeV1({ event, host: createProductionHostV1() })
      : await executeSimplifiedReadyV1({ event, host: createProductionHostV1() })
    process.stdout.write(`${JSON.stringify(plan)}\n`)
    process.exitCode = plan.exit_code
  }
}
