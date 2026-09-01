import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  assertMinimalGovernanceProductOwnerV1,
  executeBootstrapPublicationOperatorV1,
  executeNormalTaskExecutionOperatorV1,
  extractProtectedTransitionTaskStateV1,
  insertInitialProtectedTransitionTaskStateV1,
} from './run-bootstrap-publication-operator-v1.mjs'
import {
  serializeCanonicalTaskIssueBodyV1,
} from './run-protected-transition-admission-v1.mjs'

let assertions = 0
const check = (condition, message) => {
  assertions += 1
  if (!condition) throw new Error(`FAIL: ${message}`)
}

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const worktree = path.resolve(scriptDirectory, '..')
const runnerPath = path.join(scriptDirectory, 'run-bootstrap-publication-operator-v1.mjs')
const runnerSource = readFileSync(runnerPath, 'utf8')
const REPOSITORY = 'whatrune/sd-prompt-studio'
const TASK = 359
const PARENT = '8abbb809218683372f43f56d206f1401d1b53824'
const FRESH_BASE = 'c'.repeat(40)
const PUSHED = 'b'.repeat(40)
const AUTHORITY_ID = 5_400_000_001
const AUTHORITY_URL = `https://github.com/${REPOSITORY}/issues/359#issuecomment-${AUTHORITY_ID}`
const BRANCH = 'codex/bootstrap-publication-operator-v1'
const PATHS = Object.freeze([
  'scripts/run-bootstrap-publication-operator-v1.mjs',
  'scripts/test-bootstrap-publication-operator-v1.mjs',
])
const authorityBodyV1 = ({ prCreationAllowed = true, prCreationCount = 1 } = {}) => `# Product Owner Publication Authority

\`\`\`yaml
task_id: "TASK-359-BOOTSTRAP-PUBLICATION-OPERATOR-V1"
record_type: "task_assignment"
authoring_role: "Product Owner / Publication Authorizer"
authority_source: "https://github.com/${REPOSITORY}/issues/${TASK}"
canonical_record: "${AUTHORITY_URL}"
repository: "${REPOSITORY}"
task_issue: "https://github.com/${REPOSITORY}/issues/${TASK}"
requested_by: "Product Owner"
assigned_role: "Publication Operator"
authority_kind: "BOOTSTRAP_PUBLICATION"
exact_parent: "${PARENT}"
target_base_ref: "main"
branch: "${BRANCH}"
worktree: "${worktree.replaceAll('\\', '/')}"
review_decision: "APPROVE"
blocking_finding_count: 0
remaining_finding_count: 0
unknown_count: 0
focused_bootstrap_operator_assertions: 107
focused_bootstrap_operator_result: "PASS_REUSED"
git_diff_check: "PASS_REUSED"
broad_validation_rerun_allowed: false
publication_allowed: true
bootstrap_publication_count: 1
commit_count: 1
push_count: 1
pr_creation_count: ${prCreationCount}
pr_creation_allowed: ${prCreationAllowed}
authorized_paths:
  - "${PATHS[0]}"
  - "${PATHS[1]}"
status: "authorized_for_bootstrap_publication_only"
\`\`\``
const AUTHORITY_BODY = authorityBodyV1()
const AUTHORITY_SHA = createHash('sha256').update(AUTHORITY_BODY, 'utf8').digest('hex')
const PR_NUMBER = 360
const PR_URL = `https://github.com/${REPOSITORY}/pull/${PR_NUMBER}`
const PR_NODE_ID = 'PR_kwDOTUu8Qs6bootstrap'
const PRE_PR_AUTHORITY_ID = 5_390_000_101
const PRE_PR_RESULT_ID = 5_390_000_102
const PRE_PR_AUTHORITY_URL = `https://github.com/${REPOSITORY}/issues/${TASK}#issuecomment-${PRE_PR_AUTHORITY_ID}`
const PRE_PR_RESULT_URL = `https://github.com/${REPOSITORY}/issues/${TASK}#issuecomment-${PRE_PR_RESULT_ID}`
const PRE_PR_VALIDATION_COMMANDS = Object.freeze([
  'node scripts/test-bootstrap-publication-operator-v1.mjs',
  'git diff --check',
])
const PRE_PR_VALIDATION_RESULTS = Object.freeze(PRE_PR_VALIDATION_COMMANDS.map((command, index) =>
  `command_base64=${Buffer.from(command, 'utf8').toString('base64')};exit_code=0;output_sha256=${createHash('sha256').update(`bootstrap-output-${index}`).digest('hex')}`,
))
const PRE_PR_AUTHORITY_BODY = `\`\`\`yaml
record_type: pre_pr_implementation_authority_v1
version: 1
authoring_role: Product Owner
authority_source: https://github.com/${REPOSITORY}/issues/${TASK}
canonical_record: ${PRE_PR_AUTHORITY_URL}
repository: ${REPOSITORY}
task_issue: https://github.com/${REPOSITORY}/issues/${TASK}
exact_baseline: ${PARENT}
branch: ${BRANCH}
worktree: ${worktree.replaceAll('\\', '/')}
assigned_implementer: Worker
assigned_independent_reviewer: Backend Architect
implementation_kind: CODE
purpose: Implement BOOTSTRAP_PUBLICATION_OPERATOR_V1.
operation_count: 1
implementation_allowed: true
publication_allowed: false
authority_lifetime: PRE_PR_IMPLEMENTATION_ONLY
status: authorized_for_pre_pr_implementation_only
authorized_paths:
${PATHS.map((value) => `  - ${value}`).join('\n')}
validation_commands:
${PRE_PR_VALIDATION_COMMANDS.map((value) => `  - ${value}`).join('\n')}
\`\`\``
const PRE_PR_RESULT_BODY = `\`\`\`yaml
record_type: pre_pr_implementation_result_handoff_v1
version: 1
authoring_role: Worker
role: IMPLEMENTER
authority_source: ${PRE_PR_AUTHORITY_URL}
repository: ${REPOSITORY}
task_issue: https://github.com/${REPOSITORY}/issues/${TASK}
exact_baseline: ${PARENT}
branch: ${BRANCH}
worktree: ${worktree.replaceAll('\\', '/')}
status: COMPLETE
execution_stop_reason: completed
blocking_finding_count: 0
remaining_finding_count: 0
unknown_count: 0
changed_paths:
${PATHS.map((value) => `  - ${value}`).join('\n')}
validation_results:
${PRE_PR_VALIDATION_RESULTS.map((value) => `  - ${value}`).join('\n')}
unperformed_items: []
\`\`\``
const PRE_PR_DECISION_BODY = `\`\`\`yaml
decision: BOOTSTRAP_PUBLICATION
repository: ${REPOSITORY}
task_issue_number: ${TASK}
exact_baseline: ${PARENT}
branch: ${BRANCH}
worktree: ${worktree.replaceAll('\\', '/')}
result_handoff_comment_id: ${PRE_PR_RESULT_ID}
result_handoff_url: ${PRE_PR_RESULT_URL}
result_handoff_body_sha256: ${createHash('sha256').update(PRE_PR_RESULT_BODY).digest('hex')}
publication_allowed: true
operation_count: 1
authorized_paths:
${PATHS.map((value) => `  - ${value}`).join('\n')}
\`\`\``
const prePrCommentRecordV1 = (id, url, body) => Object.freeze({
  id,
  issue_url: `https://api.github.com/repos/${REPOSITORY}/issues/${TASK}`,
  html_url: url,
  created_at: '2026-08-24T05:00:00Z',
  author_association: 'OWNER',
  user: Object.freeze({ login: 'whatrune', id: 47842632, type: 'User' }),
  body,
})
const PRE_PR_COMMENT_RECORDS = Object.freeze([
  prePrCommentRecordV1(PRE_PR_RESULT_ID, PRE_PR_RESULT_URL, PRE_PR_RESULT_BODY),
  prePrCommentRecordV1(PRE_PR_AUTHORITY_ID, PRE_PR_AUTHORITY_URL, PRE_PR_AUTHORITY_BODY),
])

const requestV1 = () => ({
  record_type: 'bootstrap_publication_request_v1',
  version: 1,
  repository: REPOSITORY,
  task_issue_number: TASK,
  authorized_paths: [...PATHS],
  branch: BRANCH,
  reviewed_worktree_path: worktree,
  base_branch: 'main',
  expected_parent_head: PARENT,
  publication_authority_comment_id: AUTHORITY_ID,
  publication_authority_url: AUTHORITY_URL,
  publication_authority_body_sha256: AUTHORITY_SHA,
  operation_count: 1,
})

const copy = (value) => JSON.parse(JSON.stringify(value))

const makeHostV1 = (configuration = {}) => {
  const metrics = {
    authorityRefetch: 0,
    gitCommands: [],
    stage: 0,
    stagedArguments: [],
    commit: 0,
    push: 0,
    pushArguments: [],
    originReads: 0,
    lsRemote: 0,
    createPull: 0,
    pullRefetch: 0,
    patch: 0,
    apiCalls: [],
    createdPullBody: null,
    racedRemoteHead: null,
  }
  let currentHead = configuration.currentHead ?? PARENT
  let remoteHead = null
  let stagedPaths = []
  let pullBody = configuration.pullBody ?? null
  const prNumber = configuration.prNumber ?? PR_NUMBER
  const defaultPull = () => ({
    number: prNumber,
    state: 'open',
    draft: true,
    merged: false,
    base: { ref: 'main', repo: { full_name: REPOSITORY } },
    head: { sha: PUSHED, repo: { full_name: REPOSITORY } },
    body: pullBody,
    html_url: configuration.refetchedPrUrl ?? PR_URL,
    node_id: configuration.pullNodeId ?? PR_NODE_ID,
  })
  const host = {
    repository: configuration.hostRepository ?? REPOSITORY,
    worktreePath: configuration.worktreePath ?? worktree,
    metrics,
    git: (args) => {
      metrics.gitCommands.push([...args])
      const command = args.join(' ')
      if (command === 'branch --show-current') return `${configuration.branch ?? BRANCH}\n`
      if (command === 'remote get-url --push --all origin') {
        metrics.originReads += 1
        return configuration.originOutput ?? `git@github.com:${REPOSITORY}.git\n`
      }
      if (command === 'rev-parse --verify HEAD') return `${currentHead}\n`
      if (command === 'diff --cached --quiet --') {
        if (configuration.dirtyIndex) throw new Error('index dirty')
        return ''
      }
      if (command === 'diff --name-only -z --no-renames HEAD --') {
        return `${(configuration.trackedPaths ?? []).join('\0')}${(configuration.trackedPaths ?? []).length ? '\0' : ''}`
      }
      if (command === 'ls-files --others --exclude-standard -z') {
        const paths = configuration.changedPaths ?? PATHS
        return `${paths.join('\0')}${paths.length ? '\0' : ''}`
      }
      if (args[0] === 'add') {
        metrics.stage += 1
        metrics.stagedArguments = args.slice(2)
        stagedPaths = configuration.stagedPaths ?? args.slice(2)
        return ''
      }
      if (command === 'diff --cached --name-only -z --no-renames HEAD --') {
        return `${stagedPaths.join('\0')}${stagedPaths.length ? '\0' : ''}`
      }
      if (args[0] === 'commit') {
        metrics.commit += 1
        if (configuration.commitReject) throw new Error('commit rejected')
        currentHead = PUSHED
        return '[branch commit]\n'
      }
      if (command === 'rev-parse HEAD') return `${currentHead}\n`
      if (command === 'rev-parse HEAD^') return `${configuration.commitParent ?? PARENT}\n`
      if (args[0] === 'push') {
        metrics.push += 1
        metrics.pushArguments = [...args]
        if (configuration.raceRemoteBeforePush) {
          remoteHead = configuration.racedRemoteHead ?? PARENT
          metrics.racedRemoteHead = remoteHead
          throw new Error('create-only lease rejected')
        }
        if (configuration.pushReject) throw new Error('push rejected')
        remoteHead = configuration.remoteHead ?? currentHead
        return configuration.pushOutput ?? `*\tHEAD:refs/heads/${BRANCH}\t[new branch]\n`
      }
      if (args[0] === 'ls-remote') {
        metrics.lsRemote += 1
        if (remoteHead === null) return configuration.initialRemoteOutput ?? ''
        return `${remoteHead}\trefs/heads/${BRANCH}\n`
      }
      throw new Error(`unexpected git command: ${command}`)
    },
    api: async (endpoint, options = undefined) => {
      metrics.apiCalls.push({ endpoint, method: options?.method ?? 'GET', body: options?.body })
      const extraComment = configuration.commentRecords?.find((comment) => endpoint.endsWith(`/issues/comments/${comment.id}`))
      if (extraComment) return extraComment
      if (endpoint.endsWith(`/issues/comments/${AUTHORITY_ID}`)) {
        metrics.authorityRefetch += 1
        if (configuration.authorityReject) throw new Error('authority unavailable')
        return {
          id: configuration.authorityId ?? AUTHORITY_ID,
          html_url: configuration.authorityUrl ?? AUTHORITY_URL,
          body: configuration.authorityBody ?? AUTHORITY_BODY,
          issue_url: configuration.authorityIssueUrl ?? `https://api.github.com/repos/${REPOSITORY}/issues/${TASK}`,
          author_association: configuration.authorityAssociation ?? 'OWNER',
          user: configuration.authorityUser ?? { login: 'whatrune', id: 47842632, type: 'User' },
        }
      }
      if (endpoint === `repos/${REPOSITORY}/pulls` && options?.method === 'POST') {
        metrics.createPull += 1
        if (configuration.createPullReject) throw new Error('create rejected')
        if (configuration.pullBody === undefined) pullBody = options.body.body
        metrics.createdPullBody = options.body.body
        return {
          number: configuration.createdPrNumber ?? prNumber,
          html_url: configuration.createdPrUrl ?? PR_URL,
        }
      }
      if (endpoint === `repos/${REPOSITORY}/pulls/${prNumber}` && options?.method === 'PATCH') {
        metrics.patch += 1
        if (configuration.patchReject) throw new Error('patch rejected')
        pullBody = options.body.body
        return { number: prNumber, body: pullBody }
      }
      if (endpoint === `repos/${REPOSITORY}/pulls/${prNumber}` && (options?.method ?? 'GET') === 'GET') {
        metrics.pullRefetch += 1
        if (configuration.pullRefetchReject) throw new Error('pull unavailable')
        let pull = defaultPull()
        if (typeof configuration.pullMutator === 'function') pull = configuration.pullMutator(copy(pull))
        if (metrics.pullRefetch > 1 && typeof configuration.finalPullMutator === 'function') {
          pull = configuration.finalPullMutator(copy(pull))
        }
        return pull
      }
      throw new Error(`unexpected api call: ${options?.method ?? 'GET'} ${endpoint}`)
    },
  }
  return host
}

const runV1 = async (configuration = {}, request = requestV1()) => {
  const host = makeHostV1(configuration)
  const result = await executeBootstrapPublicationOperatorV1(request, host)
  return { result, host }
}

const runAuthorityBodyV1 = (body, configuration = {}) => runV1(
  { ...configuration, authorityBody: body },
  {
    ...requestV1(),
    publication_authority_body_sha256: createHash('sha256').update(body, 'utf8').digest('hex'),
  },
)

const success = await runV1()
check(success.result.status === 'SUCCESS', 'A exact 13-field request is accepted')
check(success.host.metrics.authorityRefetch === 1, 'A accepted request starts with one authority refetch')
check(success.host.metrics.commit === 1 && success.host.metrics.push === 1, 'A accepted request completes one commit and push')
check(AUTHORITY_URL.includes('#issuecomment-') && success.result.status === 'SUCCESS', 'A actual canonical GitHub html_url form is accepted')
const prePrDecisionRequest = Object.freeze({
  ...requestV1(),
  publication_authority_body_sha256: createHash('sha256').update(PRE_PR_DECISION_BODY).digest('hex'),
})
const prePrDecisionSuccess = await runV1({
  authorityBody: PRE_PR_DECISION_BODY,
  commentRecords: PRE_PR_COMMENT_RECORDS,
}, prePrDecisionRequest)
check(prePrDecisionSuccess.result.status === 'SUCCESS', 'A canonical pre-PR BOOTSTRAP_PUBLICATION decision is admitted as the existing operator authority')
check(
  prePrDecisionSuccess.host.metrics.apiCalls.slice(0, 3).map(({ endpoint }) => endpoint).join('\n') === [
    `repos/${REPOSITORY}/issues/comments/${AUTHORITY_ID}`,
    `repos/${REPOSITORY}/issues/comments/${PRE_PR_RESULT_ID}`,
    `repos/${REPOSITORY}/issues/comments/${PRE_PR_AUTHORITY_ID}`,
  ].join('\n'),
  'A Product Owner decision, Result Handoff, and original authority are rebound in exact chain order',
)
check(
  prePrDecisionSuccess.host.metrics.createdPullBody.includes(`Authority-bound pre-PR validations: ${PRE_PR_VALIDATION_RESULTS.length}/${PRE_PR_VALIDATION_RESULTS.length} PASS_REUSED`) &&
  prePrDecisionSuccess.host.metrics.createdPullBody.includes(`Result Handoff: ${PRE_PR_RESULT_URL}`),
  'A pre-PR decision reuses immutable host validation evidence without inventing legacy Task Assignment fields',
)
check(
  prePrDecisionSuccess.host.metrics.commit === 1 && prePrDecisionSuccess.host.metrics.push === 1 &&
  prePrDecisionSuccess.host.metrics.createPull === 1 && prePrDecisionSuccess.host.metrics.patch === 1,
  'A existing bootstrap transaction remains exactly one commit, push, Draft PR, and Task-state PATCH',
)
const driftedPrePrResultRecord = prePrCommentRecordV1(
  PRE_PR_RESULT_ID,
  PRE_PR_RESULT_URL,
  PRE_PR_RESULT_BODY.replace(`branch: ${BRANCH}`, 'branch: codex/stale-bootstrap-branch'),
)
const invalidPrePrDecisionChain = await runV1({
  authorityBody: PRE_PR_DECISION_BODY,
  commentRecords: Object.freeze([driftedPrePrResultRecord, PRE_PR_COMMENT_RECORDS[1]]),
}, prePrDecisionRequest)
check(
  invalidPrePrDecisionChain.result.status === 'STOP' && invalidPrePrDecisionChain.result.reason === 'bootstrap_publication_owner_invalid' &&
  invalidPrePrDecisionChain.result.mutation_count === 0,
  'A stale Result or authority chain stops the operator before mutation',
)
check(invalidPrePrDecisionChain.host.metrics.gitCommands.length === 0, 'A invalid pre-PR chain stops before duplicating worktree preflight or transaction logic')
check(
  success.result.status === 'SUCCESS' && success.host.metrics.createdPullBody.includes('Focused bootstrap-publication operator: 107 assertions PASS_REUSED'),
  'A legacy Task 359 task_assignment publication owner remains unchanged',
)
check(
  prePrDecisionSuccess.host.metrics.apiCalls.filter(({ method, endpoint }) => method === 'POST' && endpoint.includes('/issues/')).length === 0 &&
  prePrDecisionSuccess.host.metrics.apiCalls.filter(({ method, endpoint }) => method === 'POST' && endpoint.endsWith('/pulls')).length === 1,
  'A decision chain creates no second authority and invokes only the existing Draft PR publication mutation',
)
check(!runnerSource.includes('request.publication_authority_url !== `https://github.com/'), 'B fabricated authority html_url prediction is absent')
const unadmittedAuthority = await runV1({
  authorityUser: { login: 'other-owner', id: 99, type: 'User' },
})
check(unadmittedAuthority.result.reason === 'bootstrap_publication_owner_invalid', 'A schema-valid comment without admitted Product Owner owner result stops')
check(unadmittedAuthority.result.mutation_count === 0 && unadmittedAuthority.result.protected_operation_count === 0, 'A unadmitted comment stops with 0/0 counters')
check(unadmittedAuthority.host.metrics.gitCommands.length === 0, 'A unadmitted comment stops before Git preflight')
const admittedOwnerIdentity = assertMinimalGovernanceProductOwnerV1({
  author_association: 'OWNER',
  user: { login: 'whatrune', id: 47842632, type: 'User' },
}, { requireAssociation: true })
check(admittedOwnerIdentity.login === 'whatrune' && admittedOwnerIdentity.id === 47842632, 'B exported existing Product Owner validator preserves admitted owner identity')
let rejectedOwner = false
try {
  assertMinimalGovernanceProductOwnerV1({
    author_association: 'MEMBER',
    user: { login: 'whatrune', id: 47842632, type: 'User' },
  }, { requireAssociation: true })
} catch (error) {
  rejectedOwner = error.message === 'minimal_governance_product_owner_identity_invalid'
}
check(rejectedOwner, 'B exported existing Product Owner validator preserves association rejection')
check(!runnerSource.includes('47842632') && !runnerSource.includes("login: 'whatrune'"), 'B bootstrap operator does not duplicate Product Owner authentication')
const prCreationProhibitedBody = authorityBodyV1({ prCreationAllowed: false, prCreationCount: 0 })
const prCreationProhibited = await runAuthorityBodyV1(prCreationProhibitedBody)
check(prCreationProhibited.result.reason === 'bootstrap_publication_owner_invalid', 'C Product Owner authority prohibiting PR creation fails closed')
check(prCreationProhibited.result.mutation_count === 0 && prCreationProhibited.result.protected_operation_count === 0, 'C prohibited PR creation stops with 0/0 counters')
check(prCreationProhibited.host.metrics.gitCommands.length === 0, 'C historical prohibited authority stops before Git preflight')

const missingRequest = requestV1()
delete missingRequest.version
const missing = await runV1({}, missingRequest)
check(missing.result.status === 'STOP' && missing.result.reason === 'request_schema_invalid', 'B missing request field fails closed')
check(missing.host.metrics.authorityRefetch === 0, 'B missing request field stops before authority')
const unknown = await runV1({}, { ...requestV1(), extra: true })
check(unknown.result.status === 'STOP' && unknown.result.mutation_count === 0, 'B unknown request field fails closed')
const nullValue = await runV1({}, { ...requestV1(), repository: null })
check(nullValue.result.status === 'STOP' && nullValue.result.reason === 'request_value_invalid', 'B null request field fails closed')
const duplicatePaths = await runV1({}, { ...requestV1(), authorized_paths: [PATHS[0], PATHS[0]] })
check(duplicatePaths.result.status === 'STOP' && duplicatePaths.result.mutation_count === 0, 'B duplicate authorized path fails closed')

const temporaryDirectory = mkdtempSync(path.join(tmpdir(), 'bootstrap-publication-request-'))
try {
  const duplicateFile = path.join(temporaryDirectory, 'duplicate.json')
  const validSource = JSON.stringify(requestV1())
  writeFileSync(duplicateFile, validSource.replace(
    '{"record_type":',
    '{"record_type":"bootstrap_publication_request_v1","record_type":',
  ))
  const duplicateCli = spawnSync(process.execPath, [runnerPath, '--request-file', duplicateFile], {
    cwd: worktree,
    encoding: 'utf8',
  })
  const duplicateResult = JSON.parse(duplicateCli.stdout.trim())
  check(duplicateCli.status === 1, 'B duplicate raw request field returns nonzero')
  check(duplicateResult.reason === 'request_duplicate_field' && duplicateResult.mutation_count === 0, 'B duplicate raw request field is detected before host creation')
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true })
}

for (const [field, value] of [
  ['record_type', 'other_request'],
  ['version', 2],
  ['base_branch', 'develop'],
  ['operation_count', 2],
]) {
  const drift = await runV1({}, { ...requestV1(), [field]: value })
  check(drift.result.status === 'STOP' && drift.result.mutation_count === 0, `C wrong fixed ${field} fails closed`)
}

const authorityIdMismatch = await runV1({ authorityId: AUTHORITY_ID + 1 })
check(authorityIdMismatch.result.reason === 'publication_authority_binding_mismatch', 'D authority ID mismatch stops')
check(authorityIdMismatch.result.mutation_count === 0 && authorityIdMismatch.host.metrics.stage === 0, 'D authority ID mismatch mutates nothing')
const authorityUrlMismatch = await runV1({ authorityUrl: `${AUTHORITY_URL}-drift` })
check(authorityUrlMismatch.result.reason === 'publication_authority_binding_mismatch', 'E authority URL mismatch stops')
check(authorityUrlMismatch.result.mutation_count === 0 && authorityUrlMismatch.host.metrics.gitCommands.length === 0, 'E authority URL mismatch stops before preflight')
const authorityDigestMismatch = await runV1({ authorityBody: `${AUTHORITY_BODY}drift` })
check(authorityDigestMismatch.result.reason === 'publication_authority_binding_mismatch', 'F authority digest mismatch stops')
check(authorityDigestMismatch.result.mutation_count === 0 && authorityDigestMismatch.host.metrics.commit === 0, 'F authority digest mismatch commits nothing')

const wrongRepository = await runV1({ hostRepository: 'other/repository' })
check(wrongRepository.result.reason === 'repository_binding_mismatch' && wrongRepository.result.mutation_count === 0, 'G wrong repository stops before staging')
const wrongWorktree = await runV1({ worktreePath: path.join(worktree, 'other') })
check(wrongWorktree.result.reason === 'worktree_binding_mismatch' && wrongWorktree.host.metrics.stage === 0, 'G wrong worktree stops before staging')
const wrongBranch = await runV1({ branch: 'codex/other' })
check(wrongBranch.result.reason === 'branch_binding_mismatch' && wrongBranch.result.mutation_count === 0, 'G wrong branch stops before staging')
const wrongParent = await runV1({ currentHead: 'c'.repeat(40) })
check(wrongParent.result.reason === 'repair_worktree_head_changed' && wrongParent.result.mutation_count === 0, 'G wrong parent stops before staging')
const originMismatch = await runV1({ originOutput: 'git@github.com:other/repository.git\n' })
check(originMismatch.result.reason === 'origin_repository_mismatch', 'D origin repository mismatch stops')
check(originMismatch.result.mutation_count === 0 && originMismatch.result.protected_operation_count === 0, 'D origin repository mismatch stops with 0/0 counters')
check(originMismatch.host.metrics.lsRemote === 0 && originMismatch.host.metrics.stage === 0 && originMismatch.host.metrics.commit === 0, 'D origin mismatch stops before ls-remote or mutation')
const unsupportedOrigin = await runV1({ originOutput: 'https://example.com/whatrune/sd-prompt-studio.git\n' })
check(unsupportedOrigin.result.reason === 'origin_repository_unsupported' && unsupportedOrigin.result.mutation_count === 0, 'D unsupported origin stops with zero mutations')
const ambiguousOrigin = await runV1({
  originOutput: `git@github.com:${REPOSITORY}.git\nhttps://github.com/${REPOSITORY}.git\n`,
})
check(ambiguousOrigin.result.reason === 'origin_repository_ambiguous' && ambiguousOrigin.result.mutation_count === 0, 'D ambiguous origin stops with zero mutations')
check(success.host.metrics.originReads === 1, 'D valid origin push URL is freshly resolved once before mutation')

const dirtyIndex = await runV1({ dirtyIndex: true })
check(dirtyIndex.result.reason === 'repair_index_not_clean', 'H dirty index is rejected by reused helper')
check(dirtyIndex.result.mutation_count === 0 && dirtyIndex.host.metrics.stage === 0, 'H dirty index stops without operator mutation')
const changedPathMismatch = await runV1({ changedPaths: [PATHS[0], 'scripts/outside.mjs'] })
check(changedPathMismatch.result.reason === 'changed_paths_mismatch', 'I changed path set mismatch stops')
check(changedPathMismatch.result.mutation_count === 0 && changedPathMismatch.host.metrics.stage === 0, 'I changed path set mismatch stops before staging')

check(success.host.metrics.lsRemote === 2, 'D absent branch preflight and post-push confirmation each use ls-remote once')
const successRemotePreflightIndex = success.host.metrics.gitCommands.findIndex((args) => args[0] === 'ls-remote')
const successStageIndex = success.host.metrics.gitCommands.findIndex((args) => args[0] === 'add')
check(successRemotePreflightIndex >= 0 && successRemotePreflightIndex < successStageIndex, 'D remote branch absence is confirmed before staging')
const existingRemoteBranch = await runV1({
  initialRemoteOutput: `${PARENT}\trefs/heads/${BRANCH}\n`,
})
check(existingRemoteBranch.result.reason === 'remote_branch_already_exists', 'E existing remote branch stops branch-creation operator')
check(existingRemoteBranch.result.mutation_count === 0 && existingRemoteBranch.result.protected_operation_count === 0, 'E existing remote branch stops with 0/0 counters')
check(existingRemoteBranch.host.metrics.stage === 0 && existingRemoteBranch.host.metrics.commit === 0 && existingRemoteBranch.host.metrics.push === 0, 'E existing remote branch causes no staging, commit, or push')
const ambiguousRemoteBranch = await runV1({
  initialRemoteOutput: `${PARENT}\trefs/heads/${BRANCH}\n${PUSHED}\trefs/heads/${BRANCH}\n`,
})
check(ambiguousRemoteBranch.result.reason === 'remote_branch_state_ambiguous', 'F ambiguous remote ref result stops')
check(ambiguousRemoteBranch.result.mutation_count === 0 && ambiguousRemoteBranch.result.protected_operation_count === 0, 'F ambiguous remote ref result stops with 0/0 counters')
check(ambiguousRemoteBranch.host.metrics.stage === 0 && ambiguousRemoteBranch.host.metrics.commit === 0, 'F ambiguous remote ref result stops before mutation')

check(success.host.metrics.stage === 1, 'J exact staging occurs once')
check(JSON.stringify(success.host.metrics.stagedArguments) === JSON.stringify(PATHS), 'J git add receives only authorized paths')
check(success.host.metrics.gitCommands.some((args) => args.join(' ') === 'diff --cached --name-only -z --no-renames HEAD --'), 'J staged paths are freshly verified')
const stagedMismatch = await runV1({ stagedPaths: [PATHS[0]] })
check(stagedMismatch.result.reason === 'staged_paths_mismatch' && stagedMismatch.result.mutation_count === 0, 'J staged path mismatch stops before commit')

const commitRejected = await runV1({ commitReject: true })
check(commitRejected.result.reason === 'commit_failed', 'K commit rejection stops')
check(commitRejected.result.mutation_count === 1 && commitRejected.result.protected_operation_count === 1, 'K commit attempt accounts 1/1')
check(commitRejected.host.metrics.commit === 1 && commitRejected.host.metrics.push === 0, 'L commit is attempted once with no continuation')
check(success.host.metrics.commit === 1, 'L successful transaction has no second commit')

const pushRejected = await runV1({ pushReject: true })
check(pushRejected.result.reason === 'push_failed', 'M push rejection stops')
check(pushRejected.result.mutation_count === 2 && pushRejected.result.protected_operation_count === 1, 'M push attempt accounts 2/1')
check(pushRejected.host.metrics.push === 1 && pushRejected.host.metrics.createPull === 0, 'M push rejection does not retry or create PR')
check(JSON.stringify(success.host.metrics.pushArguments) === JSON.stringify([
  'push',
  '--porcelain',
  `--force-with-lease=refs/heads/${BRANCH}:`,
  'origin',
  `HEAD:refs/heads/${BRANCH}`,
]), 'E successful branch creation uses exact empty-lease CAS push')
const racedRemoteBranch = await runV1({ raceRemoteBeforePush: true, racedRemoteHead: PARENT })
check(racedRemoteBranch.result.reason === 'push_failed', 'F branch appearing after preflight causes CAS push failure')
check(racedRemoteBranch.result.mutation_count === 2 && racedRemoteBranch.result.protected_operation_count === 1, 'F raced CAS push retains attempt accounting 2/1')
check(racedRemoteBranch.host.metrics.push === 1 && racedRemoteBranch.host.metrics.createPull === 0, 'F raced CAS push is not retried and creates no PR')
check(racedRemoteBranch.host.metrics.racedRemoteHead === PARENT, 'F raced existing remote ref is not updated')
const remoteMismatch = await runV1({ remoteHead: 'c'.repeat(40) })
check(remoteMismatch.result.reason === 'remote_head_mismatch', 'N remote HEAD mismatch stops')
check(remoteMismatch.result.mutation_count === 2 && remoteMismatch.host.metrics.createPull === 0, 'N remote mismatch stops before PR creation')
check(remoteMismatch.host.metrics.lsRemote === 2, 'G successful branch-creation push retains post-push remote HEAD confirmation')

const createRejected = await runV1({ createPullReject: true })
check(createRejected.result.reason === 'draft_pr_creation_failed', 'O Draft PR rejection stops')
check(createRejected.result.mutation_count === 3 && createRejected.result.protected_operation_count === 1, 'O PR creation attempt accounts 3/1')
check(createRejected.host.metrics.createPull === 1 && createRejected.host.metrics.pullRefetch === 0, 'O PR creation has no retry')
const createdPullUrlMismatch = await runV1({ createdPrUrl: `${PR_URL}?creation=drift` })
check(createdPullUrlMismatch.result.reason === 'draft_pr_binding_mismatch', 'H first fresh PR refetch must match the creation-result URL and number')
check(createdPullUrlMismatch.result.mutation_count === 3 && createdPullUrlMismatch.host.metrics.patch === 0, 'H creation-result identity mismatch stops before body PATCH')
check(success.host.metrics.pullRefetch === 2, 'I first fresh refetch captures identity used by the final refetch')
const requiredPrSections = ['## Purpose', '## User impact', '## Changes', '## Validation', '## Unresolved items']
check(requiredPrSections.every((section) => success.host.metrics.createdPullBody.includes(section)), 'H generated Draft PR body contains every required prose section')
check(PATHS.every((value) => success.host.metrics.createdPullBody.includes(`- \`${value}\``)), 'H generated Draft PR body lists the exact authorized path scope')
check(success.host.metrics.createdPullBody.includes('107 assertions PASS_REUSED') && success.host.metrics.createdPullBody.includes('git diff --check: PASS_REUSED'), 'H generated Draft PR body uses admitted focused validation facts')
check(success.host.metrics.createdPullBody.includes('## Unresolved items\n\nNone.'), 'H generated Draft PR body reports none only from admitted 0/0/0 Review state')

const pullDrifts = [
  ['repository', (pull) => { pull.base.repo.full_name = 'other/repository'; return pull }],
  ['HEAD', (pull) => { pull.head.sha = 'c'.repeat(40); return pull }],
  ['base', (pull) => { pull.base.ref = 'develop'; return pull }],
  ['state', (pull) => { pull.state = 'closed'; return pull }],
  ['draft', (pull) => { pull.draft = false; return pull }],
  ['merged', (pull) => { pull.merged = true; return pull }],
]
for (const [name, pullMutator] of pullDrifts) {
  const drift = await runV1({ pullMutator })
  check(drift.result.reason === 'draft_pr_binding_mismatch', `P fresh PR wrong ${name} stops`)
  check(drift.result.mutation_count === 3 && drift.host.metrics.patch === 0, `P fresh PR wrong ${name} stops before body PATCH`)
}

const preexistingMarker = await runV1({
  pullBody: `Existing\n${'<!-- protected-transition-task-state-v1:start -->'}`,
})
check(preexistingMarker.result.reason === 'initial_task_state_cardinality_invalid', 'Q preexisting state marker stops')
check(preexistingMarker.result.mutation_count === 3 && preexistingMarker.host.metrics.patch === 0, 'Q preexisting state marker stops before PATCH')

const helperBody = 'Existing PR prose exactly.'
const helperUpdated = insertInitialProtectedTransitionTaskStateV1(helperBody, {
  task_issue_number: TASK,
  pr_number: 360,
  observed_head: PUSHED,
  authorized_paths: [...PATHS],
})
const helperState = extractProtectedTransitionTaskStateV1(helperUpdated)
check(helperUpdated.startsWith(`${helperBody}\n\n<!-- protected-transition-task-state-v1:start -->`), 'R helper preserves existing body as exact prefix')
check(Object.keys(helperState).length === 10, 'R helper produces exactly ten state fields')
check(helperState.record_type === 'protected_transition_task_state_v1', 'R helper uses existing state record type')
check(helperState.task_issue_number === TASK && helperState.pr_number === 360, 'R helper binds exact Task and allocated PR')
check(helperState.observed_head === PUSHED, 'R helper binds fresh PR head')
check(JSON.stringify(helperState.authorized_paths) === JSON.stringify(PATHS), 'R helper preserves normalized authorized paths')
check(helperState.architecture_status === 'APPROVED' && helperState.implementation_authorized === true, 'R helper sets approved implementation state')
check(helperState.review_status === 'PENDING' && helperState.reviewed_head === null && helperState.review_blocker_count === null, 'R helper sets exact pending Review state')
check(extractProtectedTransitionTaskStateV1(helperUpdated).pr_number === 360, 'S constructed body passes imported extractor')
check(!Object.hasOwn(helperState, 'repository'), 'T repository is not added to Task state')
check(!runnerSource.includes('writeProtectedTransitionTaskStateV1'), 'T insertion does not call the existing update writer')

check(success.host.metrics.patch === 1, 'U PR body is patched exactly once')
check(success.result.mutation_count === 4 && success.result.protected_operation_count === 1, 'U PATCH attempt accounts 4/1')
check(success.host.metrics.apiCalls.map(({ method }) => method).join(',') === 'GET,POST,GET,PATCH,GET', 'U transaction uses exact authority/create/refetch/PATCH/refetch API order')
const successPatchBody = success.host.metrics.apiCalls.find(({ method }) => method === 'PATCH').body.body
check(successPatchBody.startsWith(success.host.metrics.createdPullBody), 'I Task-state insertion preserves all generated PR prose bytes')
check(requiredPrSections.every((section) => successPatchBody.includes(section)), 'I patched PR body retains every required prose section')
check(successPatchBody.includes('<!-- protected-transition-task-state-v1:start -->'), 'I patched PR body appends exactly one Task-state block')
const finalMismatch = await runV1({
  finalPullMutator: (pull) => ({ ...pull, body: `${pull.body}\nDRIFT` }),
})
check(finalMismatch.result.reason === 'final_pr_binding_mismatch', 'V final refetch mismatch stops')
check(finalMismatch.result.mutation_count === 4 && finalMismatch.result.protected_operation_count === 1, 'V final mismatch preserves 4/1 accounting')
check(finalMismatch.host.metrics.patch === 1 && finalMismatch.host.metrics.pullRefetch === 2, 'V final mismatch has no PATCH retry')
const finalNodeMismatch = await runV1({
  finalPullMutator: (pull) => ({ ...pull, node_id: `${PR_NODE_ID}-different` }),
})
check(finalNodeMismatch.result.reason === 'final_pr_binding_mismatch', 'J final refetch with different immutable PR node identity stops')
check(finalNodeMismatch.result.mutation_count === 4 && finalNodeMismatch.host.metrics.patch === 1, 'J node identity drift is terminal after one PATCH')
check(finalNodeMismatch.host.metrics.pullRefetch === 2, 'J node identity drift causes no refetch retry')

check(success.result.reason === 'bootstrap_publication_complete', 'W success is terminal bootstrap publication result')
check(success.result.mutation_count === 4 && success.result.protected_operation_count === 1, 'W success has exact 4/1 counters')
check(success.result.pr_number === 360 && success.result.pushed_head === PUSHED, 'W success returns actual PR and pushed HEAD')
check(success.result.task_state.pr_number === 360, 'W success returns extractor-verified state')
check(success.result.status === 'SUCCESS' && success.host.metrics.pullRefetch === 2, 'K identical immutable PR node identity preserves normal success')
check(!Object.hasOwn(requestV1(), 'pr_node_id') && !Object.hasOwn(requestV1(), 'node_id'), 'L PR node identity is absent from request schema')
check(!Object.hasOwn(success.result.task_state, 'pr_node_id') && !Object.hasOwn(success.result.task_state, 'node_id'), 'L PR node identity is absent from Task-state schema')
check(success.host.metrics.commit === 1 && success.host.metrics.push === 1 && success.host.metrics.createPull === 1 && success.host.metrics.patch === 1, 'X success performs every mutation once')
check(!runnerSource.includes("['reset'") && !runnerSource.includes("['rebase'") && !runnerSource.includes("['commit', '--amend'"), 'X runner has no reset, rebase, or amend')
check(!runnerSource.includes("'--force'") && !runnerSource.includes("'+refs/heads/"), 'X runner has no unconditional force or plus-refspec push')
check(runnerSource.includes('`--force-with-lease=refs/heads/${request.branch}:`'), 'X runner retains exact create-only empty-lease CAS')
check(!/setTimeout|retry/i.test(runnerSource), 'X runner has no retry mechanism')
check(runnerSource.includes('extractProtectedTransitionTaskStateV1'), 'Y legacy bootstrap Task-state extractor remains available')
check(runnerSource.includes('parseProtectedTransitionTaskStateJsonV1'), 'Y legacy bootstrap retains its bounded Task-state compatibility parser')

// The normal Task route reuses the same bounded owner for commit and unchanged non-Draft publication.
const NORMAL_OBJECTIVE = 'BOUNDED_NORMAL_TASK_EXECUTION_PREDELEGATION_AND_CONTINUATION_WIRING_V1'
const NORMAL_INSTANCE = '706ca1fb-4c8d-43df-9bc3-e1371e038383'
const NORMAL_TARGET = 'codex-thread-normal-task-538'
const NORMAL_COMMON_DIR = path.join(worktree, '.git-common')
const NORMAL_TASK_BODY = serializeCanonicalTaskIssueBodyV1({
  request: {
    title: NORMAL_OBJECTIVE,
    repository: REPOSITORY,
    objective: NORMAL_OBJECTIVE,
    markdown: `# ${NORMAL_OBJECTIVE}\n\nNormal exact-scope execution.`,
    authorized_paths: [...PATHS],
    head_branch: BRANCH,
    worktree_path: worktree,
    expected_base: PARENT,
    authorized_actor: 'whatrune',
    permitted_surface: 'TASK_ISSUE_COMMENT',
    ready_allowed: false,
    product_owner_login: 'whatrune',
  },
  mode: 'BOUND_FINAL',
  taskIssue: TASK,
})
const normalCursorV1 = (operation) => operation === 'COMMIT_VALIDATED_TREE'
  ? 'cursor-implementation-complete'
  : 'cursor-prepublication-review-approve'
const normalRequestV1 = (operation, expectedHead, overrides = {}) => ({
  record_type: 'normal_task_execution_request_v1',
  version: 1,
  operation,
  repository: REPOSITORY,
  task_issue_number: TASK,
  objective: NORMAL_OBJECTIVE,
  authorized_paths: [...PATHS],
  branch: BRANCH,
  worktree_path: worktree,
  git_common_dir: NORMAL_COMMON_DIR,
  expected_base: PARENT,
  expected_head: expectedHead,
  expected_pr: null,
  expected_remote_head: null,
  execution_instance_id: NORMAL_INSTANCE,
  continuation_target: NORMAL_TARGET,
  continuation_cursor: normalCursorV1(operation),
  operation_count: 1,
  ...overrides,
})
const makeNormalHostV1 = ({
  initialHead = PARENT,
  currentBase = PARENT,
  remoteInitially = null,
  actor = 'whatrune',
  taskBody = NORMAL_TASK_BODY,
  advancedPaths = [],
  baseIsDescendant = true,
  existingPr = false,
  terminalEventTransform = (value) => value,
} = {}) => {
  const metrics = { commit: 0, push: 0, createPull: 0, acquireContinuation: 0, apiCalls: [], createdPull: null }
  let currentHead = initialHead
  let remoteHead = remoteInitially
  let staged = []
  let pullBody = null
  const host = {
    repository: REPOSITORY,
    worktreePath: worktree,
    metrics,
    refetchContinuationEvent: async ({ target, cursor }) => {
      metrics.acquireContinuation += 1
      const operation = cursor === normalCursorV1('COMMIT_VALIDATED_TREE')
        ? 'COMMIT_VALIDATED_TREE'
        : 'PUBLISH_REVIEWED_COMMIT'
      const common = {
        target,
        cursor,
        consumed: true,
        kind: operation === 'COMMIT_VALIDATED_TREE'
          ? (existingPr ? 'CORRECTION_IMPLEMENTATION_COMPLETE' : 'IMPLEMENTATION_COMPLETE')
          : 'PREPUBLICATION_REVIEW_APPROVE',
        repository: REPOSITORY,
        task_issue_number: TASK,
        objective: NORMAL_OBJECTIVE,
        branch: BRANCH,
        worktree_path: worktree,
        expected_base: currentBase,
        expected_head: currentHead,
        authorized_paths: [...PATHS],
        execution_instance_id: NORMAL_INSTANCE,
      }
      const result = operation === 'COMMIT_VALIDATED_TREE'
        ? {
            record_type: 'result_handoff',
            authoring_role: 'IMPLEMENTER',
            status: 'completed',
            execution_stop_reason: 'completed',
            blocking: 0,
            remaining: 0,
            unknown: 0,
            changed_paths: [...PATHS],
            validation_results: [{ command: 'canonical validation', result: 'PASS', exact_head: currentHead }],
            unperformed_items: [],
          }
        : {
            reviewer_role: 'INDEPENDENT_REVIEWER',
            decision: 'APPROVE',
            blocking: 0,
            remaining: 0,
            unknown: 0,
            reviewed_head: currentHead,
          }
      return terminalEventTransform({ ...common, result })
    },
    observeExecution: (identity) => ({
      repository: identity.repository,
      canonical_task_id: identity.canonical_task_id,
      objective_digest: identity.objective_digest,
      branch: BRANCH,
      worktree_path: worktree,
      registered_worktree_path: worktree,
      git_common_dir: NORMAL_COMMON_DIR,
      authorized_paths: identity.authorized_paths,
      remote_main_sha: currentBase,
      head: currentHead,
      pr_lookup_attempted: identity.expected_pr !== null,
      requested_pr_number: identity.expected_pr ?? undefined,
      pr: identity.expected_pr === null ? null : {
        number: PR_NUMBER,
        repository: REPOSITORY,
        state: 'OPEN',
        merged: false,
        head: remoteHead,
        base: currentBase,
        branch: BRANCH,
      },
    }),
    git: (args) => {
      const command = args.join(' ')
      if (command === 'rev-parse --verify HEAD') return `${currentHead}\n`
      if (command === 'diff --cached --quiet --') return ''
      if (command === 'diff --name-only -z --no-renames HEAD --') return ''
      if (command === 'ls-files --others --exclude-standard -z') return `${PATHS.join('\0')}\0`
      if (args[0] === 'add') { staged = args.slice(2); return '' }
      if (command === 'diff --cached --name-only -z --no-renames HEAD --') return `${staged.join('\0')}\0`
      if (args[0] === 'commit') { metrics.commit += 1; currentHead = PUSHED; return '[commit]\n' }
      if (command === 'rev-parse HEAD') return `${currentHead}\n`
      if (command === 'rev-parse HEAD^') return `${initialHead}\n`
      if (command === `diff --name-only -z --no-renames ${initialHead} ${PUSHED} --`) return `${PATHS.join('\0')}\0`
      if (command === 'status --porcelain=v1 -z') return ''
      if (command === `merge-base --is-ancestor ${PARENT} ${currentBase}`) {
        if (!baseIsDescendant) throw new Error('not ancestor')
        return ''
      }
      if (command === `diff --name-only -z --no-renames ${PARENT} ${currentBase} --`) {
        return advancedPaths.length === 0 ? '' : `${advancedPaths.join('\0')}\0`
      }
      if (args[0] === 'ls-remote') return remoteHead === null ? '' : `${remoteHead}\trefs/heads/${BRANCH}\n`
      if (args[0] === 'push') { metrics.push += 1; remoteHead = currentHead; return `*\tHEAD:refs/heads/${BRANCH}\t[new branch]\n` }
      throw new Error(`unexpected normal git command: ${command}`)
    },
    api: async (endpoint, options = undefined) => {
      metrics.apiCalls.push({ endpoint, method: options?.method ?? 'GET' })
      if (endpoint === 'user') return { login: actor }
      if (endpoint === `repos/${REPOSITORY}/issues/${TASK}`) return {
        number: TASK,
        state: 'open',
        body: taskBody,
        user: { login: 'whatrune' },
        author_association: 'OWNER',
      }
      if (endpoint === `repos/${REPOSITORY}/pulls` && options?.method === 'POST') {
        metrics.createPull += 1
        pullBody = options.body.body
        metrics.createdPull = options.body
        return { number: PR_NUMBER, html_url: PR_URL }
      }
      if (endpoint === `repos/${REPOSITORY}/pulls/${PR_NUMBER}`) return {
        number: PR_NUMBER,
        html_url: PR_URL,
        state: 'open',
        draft: false,
        merged: false,
        base: { ref: 'main', sha: currentBase, repo: { full_name: REPOSITORY } },
        head: { ref: BRANCH, sha: remoteHead ?? currentHead, repo: { full_name: REPOSITORY } },
        body: pullBody,
      }
      throw new Error(`unexpected normal api call: ${endpoint}`)
    },
  }
  return host
}

{
  const host = makeNormalHostV1()
  const result = await executeNormalTaskExecutionOperatorV1(
    normalRequestV1('COMMIT_VALIDATED_TREE', PARENT), host,
  )
  check(result.status === 'SUCCESS' && result.reason === 'validated_tree_committed', 'N normal route commits the exact validated tree')
  check(result.mutation_count === 1 && result.protected_operation_count === 1 && host.metrics.commit === 1, 'N validated-tree commit is one bounded protected mutation')
  check(result.committed_head === PUSHED && result.parent_head === PARENT, 'N committed tree remains exact-parent bound')
  const duplicate = await executeNormalTaskExecutionOperatorV1(
    normalRequestV1('COMMIT_VALIDATED_TREE', PARENT), host,
  )
  check(duplicate.status === 'STOP' && duplicate.reason === 'execution_identity_mismatch', 'N repeated consumed execution identity cannot create another commit')
  check(host.metrics.commit === 1, 'N duplicate invocation performs zero additional commit mutations')
}

{
  const host = makeNormalHostV1({
    terminalEventTransform: (event) => ({
      ...event,
      result: { ...event.result, validation_results: [{ command: 'canonical validation', result: 'FAIL', exact_head: PARENT }] },
    }),
  })
  const result = await executeNormalTaskExecutionOperatorV1(
    normalRequestV1('COMMIT_VALIDATED_TREE', PARENT), host,
  )
  check(result.reason === 'implementation_result_handoff_invalid' && result.mutation_count === 0, 'N commit requires fetched terminal PASS validation evidence')
  check(host.metrics.acquireContinuation === 1 && host.metrics.commit === 0, 'N invalid fetched handoff performs no stage or commit mutation')
}

{
  const host = makeNormalHostV1()
  const result = await executeNormalTaskExecutionOperatorV1({
    ...normalRequestV1('PUBLISH_REVIEWED_COMMIT', PUSHED),
    prepublication_review: { decision: 'APPROVE', blocking: 0, remaining: 0, unknown: 0, reviewed_head: PUSHED },
  }, host)
  check(result.reason === 'normal_task_execution_request_schema_invalid' && result.mutation_count === 0, 'N caller-supplied Review data is not an admitted request field')
  check(host.metrics.apiCalls.length === 0 && host.metrics.acquireContinuation === 0, 'N synthetic Review data stops before authority or terminal-event access')
}

{
  const host = makeNormalHostV1({
    initialHead: FRESH_BASE,
    currentBase: FRESH_BASE,
    remoteInitially: PARENT,
    existingPr: true,
    advancedPaths: ['docs/unrelated-main-change.md'],
  })
  const result = await executeNormalTaskExecutionOperatorV1(
    normalRequestV1('COMMIT_VALIDATED_TREE', FRESH_BASE, {
      expected_base: FRESH_BASE,
      expected_pr: PR_NUMBER,
      expected_remote_head: PARENT,
    }),
    host,
  )
  check(result.status === 'SUCCESS' && result.parent_head === FRESH_BASE, 'N disjoint fresh-main advancement admits a freshly rebound validated-tree commit')
  check(host.metrics.commit === 1 && host.metrics.acquireContinuation === 1, 'N rebound commit still consumes one fetched terminal handoff and one commit')
}

{
  const host = makeNormalHostV1({
    initialHead: FRESH_BASE,
    currentBase: FRESH_BASE,
    remoteInitially: PARENT,
    existingPr: true,
    advancedPaths: [PATHS[0]],
  })
  const result = await executeNormalTaskExecutionOperatorV1(
    normalRequestV1('COMMIT_VALIDATED_TREE', FRESH_BASE, {
      expected_base: FRESH_BASE,
      expected_pr: PR_NUMBER,
      expected_remote_head: PARENT,
    }),
    host,
  )
  check(result.reason === 'fresh_base_compatibility_required' && result.mutation_count === 0, 'N fresh-base overlap remains fail-closed for compatibility reconciliation')
  check(host.metrics.acquireContinuation === 0 && host.metrics.commit === 0, 'N overlapping fresh base stops before terminal evidence or mutation')
}

{
  const host = makeNormalHostV1({
    initialHead: FRESH_BASE,
    currentBase: FRESH_BASE,
    remoteInitially: PARENT,
    existingPr: true,
    baseIsDescendant: false,
  })
  const result = await executeNormalTaskExecutionOperatorV1(
    normalRequestV1('COMMIT_VALIDATED_TREE', FRESH_BASE, {
      expected_base: FRESH_BASE,
      expected_pr: PR_NUMBER,
      expected_remote_head: PARENT,
    }),
    host,
  )
  check(result.reason === 'fresh_base_not_descendant' && result.mutation_count === 0, 'N divergent fresh base is rejected without mutation')
}

{
  const host = makeNormalHostV1({ initialHead: PUSHED })
  const result = await executeNormalTaskExecutionOperatorV1(
    normalRequestV1('PUBLISH_REVIEWED_COMMIT', PUSHED), host,
  )
  check(result.status === 'SUCCESS' && result.reason === 'reviewed_commit_published', 'P approved reviewed commit publishes normally')
  check(result.mutation_count === 2 && result.protected_operation_count === 1, 'P publication is one push and one PR create under one protected operation')
  check(host.metrics.push === 1 && host.metrics.createPull === 1, 'P unchanged publication performs each mutation once')
  check(host.metrics.createdPull.draft === false, 'P normal Task publication creates a non-Draft PR')
  check(!host.metrics.apiCalls.some(({ method }) => method === 'PATCH'), 'P normal publication does not insert legacy Task-state or PATCH the PR')
}

{
  const host = makeNormalHostV1({ initialHead: PUSHED, remoteInitially: PARENT })
  const result = await executeNormalTaskExecutionOperatorV1(
    normalRequestV1('PUBLISH_REVIEWED_COMMIT', PUSHED, {
      expected_pr: PR_NUMBER,
      expected_remote_head: PARENT,
    }),
    host,
  )
  check(result.status === 'SUCCESS' && result.reason === 'reviewed_correction_published', 'P same-task correction pushes the newly reviewed exact commit to the existing PR')
  check(result.mutation_count === 1 && host.metrics.push === 1 && host.metrics.createPull === 0, 'P correction publication updates only the branch and never creates a duplicate PR')
  check(result.pr_number === PR_NUMBER && result.pushed_head === PUSHED, 'P corrected PR is directly refetched at the successor HEAD')
}

{
  const host = makeNormalHostV1({
    initialHead: PUSHED,
    terminalEventTransform: (event) => ({ ...event, result: { ...event.result, unknown: 1 } }),
  })
  const invalid = await executeNormalTaskExecutionOperatorV1(
    normalRequestV1('PUBLISH_REVIEWED_COMMIT', PUSHED), host,
  )
  check(invalid.reason === 'prepublication_review_invalid' && invalid.mutation_count === 0, 'P blocker or UNKNOWN fails before publication mutation')
  check(host.metrics.acquireContinuation === 1 && host.metrics.push === 0, 'P invalid fetched prepublication result performs zero publication mutation')
}

{
  const host = makeNormalHostV1({ initialHead: PUSHED, remoteInitially: PUSHED })
  const duplicate = await executeNormalTaskExecutionOperatorV1(
    normalRequestV1('PUBLISH_REVIEWED_COMMIT', PUSHED), host,
  )
  check(duplicate.reason === 'remote_branch_already_exists' && duplicate.mutation_count === 0, 'P a pre-existing remote branch fails closed instead of republishing')
  check(host.metrics.push === 0 && host.metrics.createPull === 0, 'P remote identity collision performs no mutation')
}

const scopeDiff = spawnSync('git', ['diff', '--name-only', '--no-renames', PARENT, '759918b6527c2b1fca3de924fa8042f413426822', '--'], {
  cwd: worktree,
  encoding: 'utf8',
})
check(scopeDiff.status === 0, 'J frozen historical implementation scope can be inspected')
const deltaPaths = scopeDiff.stdout.trim().split(/\r?\n/).filter(Boolean).sort()
check(JSON.stringify(deltaPaths) === JSON.stringify([...PATHS].sort()), 'J frozen historical implementation range proves exact two-file isolation')

process.stdout.write(`${assertions} assertions passed\n`)
