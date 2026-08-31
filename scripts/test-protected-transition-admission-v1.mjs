import assert from 'node:assert/strict'
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { parseDocument } from 'yaml'
import {
  acquireSimplifiedPreDecisionPreflightV1,
  classifyValidationPathsV1,
  evaluateRequiredChecksV1,
  executeSimplifiedMergeV1,
  parseSimplifiedMergeDecisionV1,
  parseSimplifiedReviewV1,
  parseSimplifiedTaskAuthorityV1,
  serializeSimplifiedMergeDecisionV1,
  serializeSimplifiedReviewV1,
  serializeSimplifiedTaskAuthorityV1,
} from './protected-transition-merge-operator-preflight-v1.mjs'
import {
  createProductionHostV1,
  writeProtectedPublicationBodyFileV1,
} from './run-protected-transition-admission-v1.mjs'
import {
  discoverPromptTagDictionaryFilesV1,
  parsePromptTagDictionaryV1,
  validatePromptTagDictionaryRootV1,
} from './validate-dictionaries.mjs'

const REPOSITORY = 'whatrune/sd-prompt-studio'
const HEAD = '1'.repeat(40)
const BASE = '2'.repeat(40)
const MERGE = '3'.repeat(40)
const PATHS = Object.freeze([
  '.github/workflows/protected-transition-admission-v1.yml',
  'scripts/protected-transition-merge-operator-preflight-v1.mjs',
])
const TASK = 429
const PR = 430
const REVIEW = 9001
const REVIEW_URL = `https://github.com/${REPOSITORY}/pull/${PR}#pullrequestreview-${REVIEW}`

const taskInput = Object.freeze({
  record_type: 'simplified_task_authority_v1',
  task_issue: TASK,
  repository: REPOSITORY,
  objective: 'SIMPLIFIED_AUTONOMOUS_LIFECYCLE_V1',
  authorized_paths: PATHS,
  ready_allowed: true,
  product_owner_login: 'whatrune',
})
const reviewInput = (head = HEAD) => Object.freeze({
  record_type: 'simplified_independent_review_v1',
  reviewer_role: 'INDEPENDENT_REVIEWER',
  task_issue: TASK,
  pull_request: PR,
  reviewed_head: head,
  decision: 'APPROVE',
  blocking: 0,
  remaining: 0,
  unknown: 0,
})
const decisionInput = (overrides = {}) => Object.freeze({
  record_type: 'simplified_merge_decision_v1',
  task_issue: TASK,
  pull_request: PR,
  exact_head: HEAD,
  expected_base: BASE,
  authorized_paths: PATHS,
  review_kind: 'PULL_REQUEST_REVIEW',
  review_id: REVIEW,
  review_url: REVIEW_URL,
  merge_method: 'merge',
  operation_count: 1,
  ...overrides,
})
const preDecisionInput = (overrides = {}) => Object.freeze({
  repository: REPOSITORY,
  task_issue: TASK,
  pull_request: PR,
  exact_head: HEAD,
  expected_base: BASE,
  authorized_paths: PATHS,
  review_kind: 'PULL_REQUEST_REVIEW',
  review_id: REVIEW,
  review_url: REVIEW_URL,
  ...overrides,
})

const check = (name, appDatabaseId, overrides = {}) => ({
  __typename: 'CheckRun',
  id: `check-${name}`,
  name,
  status: 'COMPLETED',
  conclusion: 'SUCCESS',
  detailsUrl: `https://checks.invalid/${encodeURIComponent(name)}`,
  startedAt: '2026-08-28T00:00:00Z',
  checkSuite: { commit: { oid: HEAD }, app: { databaseId: appDatabaseId } },
  ...overrides,
})

const createFixture = ({
  draft = false,
  head = HEAD,
  reviewHead = HEAD,
  paths = PATHS,
  threads = [],
  checks,
  main = BASE,
  mergeable = 'MERGEABLE',
  mergeStateStatus = 'CLEAN',
  mergeError = null,
  mergeResponse = { sha: MERGE, merged: true, message: 'Pull Request successfully merged' },
  afterMergeParents = [{ sha: BASE }, { sha: HEAD }],
} = {}) => {
  const state = {
    draft,
    merged: false,
    head,
    main,
    mergeCommit: null,
    mergeMutations: 0,
    mergeExpectedHead: null,
  }
  const checkNodes = checks ?? [check('validate', 15368), check('build-preview', 15368), check('Cloudflare Pages', 85455)]
  const taskBody = serializeSimplifiedTaskAuthorityV1(taskInput)
  const reviewBody = serializeSimplifiedReviewV1(reviewInput(reviewHead))
  const pullRest = () => ({
    id: 77,
    node_id: 'PR_node_430',
    number: PR,
    state: state.merged ? 'closed' : 'open',
    merged: state.merged,
    draft: state.draft,
    user: { login: 'implementation-author' },
    head: { sha: state.head, repo: { full_name: REPOSITORY } },
    base: { ref: 'main', repo: { full_name: REPOSITORY } },
    merge_commit_sha: state.mergeCommit,
  })
  const host = {
    async api(route) {
      if (route === `repos/${REPOSITORY}/issues/${TASK}`) {
        return { number: TASK, state: 'open', user: { login: 'whatrune' }, body: taskBody }
      }
      if (route === `repos/${REPOSITORY}/pulls/${PR}`) return pullRest()
      if (route === `repos/${REPOSITORY}/pulls/${PR}/reviews/${REVIEW}`) {
        return { id: REVIEW, state: 'APPROVED', commit_id: reviewHead, html_url: REVIEW_URL, author_association: 'COLLABORATOR', user: { login: 'reviewer' }, body: reviewBody }
      }
      if (route === `repos/${REPOSITORY}/issues/comments/${REVIEW}`) {
        return { id: REVIEW, issue_url: `https://api.github.com/repos/${REPOSITORY}/issues/${TASK}`, html_url: `https://github.com/${REPOSITORY}/issues/${TASK}#issuecomment-${REVIEW}`, author_association: 'OWNER', user: { login: 'whatrune' }, body: reviewBody }
      }
      if (route === `repos/${REPOSITORY}/git/ref/heads/main`) return { ref: 'refs/heads/main', object: { sha: state.main } }
      if (route === `repos/${REPOSITORY}/pulls/${PR}/files?per_page=100&page=1`) return paths.map((filename) => ({ filename }))
      if (route === `repos/${REPOSITORY}/git/commits/${MERGE}`) return { sha: MERGE, parents: afterMergeParents }
      throw new Error(`unexpected_api:${route}`)
    },
    async mergePullRequest({ repository, prNumber, exactHead }) {
      state.mergeMutations += 1
      state.mergeExpectedHead = exactHead
      if (repository !== REPOSITORY || prNumber !== PR) throw new Error('unexpected_merge_request')
      if (mergeError !== null) throw mergeError
      if (mergeResponse?.merged === true && mergeResponse.sha === MERGE) {
        state.merged = true
        state.mergeCommit = MERGE
        state.main = MERGE
      }
      return mergeResponse
    },
    async graphql(query, variables) {
      if (query.includes('query SimplifiedChecks')) {
        return { repository: { object: { oid: HEAD, statusCheckRollup: { contexts: { nodes: checkNodes, pageInfo: { hasNextPage: false, endCursor: null } } } } } }
      }
      if (query.includes('query SimplifiedThreads')) {
        return { repository: { pullRequest: {
          number: PR,
          state: state.merged ? 'MERGED' : 'OPEN',
          isDraft: state.draft,
          merged: state.merged,
          headRefOid: state.head,
          mergeable,
          mergeStateStatus,
          reviewThreads: { nodes: threads, pageInfo: { hasNextPage: false, endCursor: null } },
        } } }
      }
      throw new Error('unexpected_graphql')
    },
  }
  return { host, state }
}

const mergeEvent = (decision = decisionInput()) => ({
  action: 'created',
  repository: { full_name: REPOSITORY },
  issue: { number: TASK },
  comment: { user: { login: 'whatrune' }, body: serializeSimplifiedMergeDecisionV1(decision) },
})

let assertions = 0
const equal = (actual, expected) => { assert.equal(actual, expected); assertions += 1 }
const ok = (actual) => { assert.ok(actual); assertions += 1 }
const throws = (fn, expected) => { assert.throws(fn, expected); assertions += 1 }
const captureError = async (fn) => {
  try {
    await fn()
  } catch (error) {
    return error
  }
  throw new Error('expected_error_not_thrown')
}

const simulateImmediateCoordinatorContinuationV1 = ({
  waitTerminal,
  terminalKind,
  identityMatches,
  owningWorker,
  observedAt,
}) => {
  if (waitTerminal !== true || identityMatches !== true) {
    return Object.freeze({ actions: Object.freeze([]), action_at: null })
  }
  const action = terminalKind === 'CHECKS_PASS'
    ? Object.freeze({ type: 'DISPATCH_FRESH_REVIEW' })
    : terminalKind === 'REVIEW_FINDING'
      ? Object.freeze({ type: 'FOLLOW_UP_OWNING_WORKER', worker: owningWorker })
      : terminalKind === 'REVIEW_APPROVE'
        ? Object.freeze({ type: 'RUN_PRE_DECISION_PREFLIGHT' })
        : null
  return Object.freeze({
    actions: Object.freeze(action === null ? [] : [action]),
    action_at: action === null ? null : observedAt,
  })
}

const taskBody = serializeSimplifiedTaskAuthorityV1(taskInput)
equal(parseSimplifiedTaskAuthorityV1(taskBody).objective, taskInput.objective)
equal(serializeSimplifiedTaskAuthorityV1(parseSimplifiedTaskAuthorityV1(taskBody)), taskBody)
equal(parseSimplifiedTaskAuthorityV1(taskBody).ready_allowed, true)
const taskBodyWithoutReadyPermission = serializeSimplifiedTaskAuthorityV1({ ...taskInput, ready_allowed: false })
equal(parseSimplifiedTaskAuthorityV1(taskBodyWithoutReadyPermission).ready_allowed, false)
const reviewBody = serializeSimplifiedReviewV1(reviewInput())
equal(parseSimplifiedReviewV1(reviewBody).reviewed_head, HEAD)
equal(serializeSimplifiedReviewV1(parseSimplifiedReviewV1(reviewBody)), reviewBody)
const decisionBody = serializeSimplifiedMergeDecisionV1(decisionInput())
equal(parseSimplifiedMergeDecisionV1(decisionBody).exact_head, HEAD)
equal(serializeSimplifiedMergeDecisionV1(parseSimplifiedMergeDecisionV1(decisionBody)), decisionBody)
throws(() => parseSimplifiedTaskAuthorityV1('# placeholder'), /task_authority_invalid/)
throws(() => parseSimplifiedReviewV1(reviewBody.replace('"decision": "APPROVE"', '"decision": "CHANGES_REQUIRED"')), /review_invalid/)
throws(() => parseSimplifiedMergeDecisionV1(`${decisionBody}\n\`\`\`json\n{}\n\`\`\``), /merge_decision_invalid/)

{
  const directory = mkdtempSync(join(tmpdir(), 'protected-publication-transport-'))
  try {
    const reviewFile = join(directory, 'review.md')
    const reviewPublicationBody = `# 独立レビュー #477\n\n可視 evidence の確認。\n\n${reviewBody}\n追記: # は本文です。\n`
    const reviewResult = writeProtectedPublicationBodyFileV1({
      kind: 'review',
      body: reviewPublicationBody,
      outputFile: reviewFile,
    })
    equal(reviewResult.state, 'COMPLETED')
    equal(Buffer.compare(readFileSync(reviewFile), Buffer.from(reviewPublicationBody, 'utf8')), 0)
    equal(parseSimplifiedReviewV1(readFileSync(reviewFile, 'utf8')).reviewed_head, HEAD)
    ok(readFileSync(reviewFile, 'utf8').includes('\n\n'))
    ok(readFileSync(reviewFile, 'utf8').includes('追記: # は本文です。'))

    const decisionFile = join(directory, 'decision.md')
    const decisionPublicationBody = `# マージ判断\r\n\r\n${decisionBody.replaceAll('\n', '\r\n')}\r\n決定 #482\r\n`
    const decisionResult = writeProtectedPublicationBodyFileV1({
      kind: 'merge',
      body: decisionPublicationBody,
      outputFile: decisionFile,
    })
    equal(decisionResult.state, 'COMPLETED')
    equal(Buffer.compare(readFileSync(decisionFile), Buffer.from(decisionPublicationBody, 'utf8')), 0)
    equal(parseSimplifiedMergeDecisionV1(readFileSync(decisionFile, 'utf8')).exact_head, HEAD)
    ok(readFileSync(decisionFile, 'utf8').includes('\r\n\r\n'))

    const cliReviewInput = join(directory, 'review-input.json')
    const cliReviewOutput = join(directory, 'review-output.md')
    writeFileSync(cliReviewInput, JSON.stringify(reviewInput()), 'utf8')
    const cliReview = spawnSync(process.execPath, [
      fileURLToPath(new URL('./run-protected-transition-admission-v1.mjs', import.meta.url)),
      '--serialize-review-file', cliReviewInput,
      '--publication-body-output-file', cliReviewOutput,
    ], { encoding: 'utf8' })
    equal(cliReview.status, 0)
    equal(JSON.parse(cliReview.stdout).state, 'COMPLETED')
    equal(Buffer.compare(readFileSync(cliReviewOutput), Buffer.from(reviewBody, 'utf8')), 0)
    equal(parseSimplifiedReviewV1(readFileSync(cliReviewOutput, 'utf8')).reviewed_head, HEAD)

    const cliDecisionInput = join(directory, 'decision-input.json')
    const cliDecisionOutput = join(directory, 'decision-output.md')
    writeFileSync(cliDecisionInput, JSON.stringify(decisionInput()), 'utf8')
    const cliDecision = spawnSync(process.execPath, [
      fileURLToPath(new URL('./run-protected-transition-admission-v1.mjs', import.meta.url)),
      '--serialize-merge-decision-file', cliDecisionInput,
      '--publication-body-output-file', cliDecisionOutput,
    ], { encoding: 'utf8' })
    equal(cliDecision.status, 0)
    equal(JSON.parse(cliDecision.stdout).publication_kind, 'merge')
    equal(Buffer.compare(readFileSync(cliDecisionOutput), Buffer.from(decisionBody, 'utf8')), 0)
    equal(parseSimplifiedMergeDecisionV1(readFileSync(cliDecisionOutput, 'utf8')).exact_head, HEAD)

    const legacyStdout = spawnSync(process.execPath, [
      fileURLToPath(new URL('./run-protected-transition-admission-v1.mjs', import.meta.url)),
      '--serialize-review-file', cliReviewInput,
    ], { encoding: 'utf8' })
    equal(legacyStdout.status, 0)
    equal(legacyStdout.stdout, reviewBody)

    throws(() => writeProtectedPublicationBodyFileV1({
      kind: 'review', body: '', outputFile: join(directory, 'empty.md'),
    }), /publication_transport_body_invalid/)
    throws(() => writeProtectedPublicationBodyFileV1({
      kind: 'review', body: '# malformed', outputFile: join(directory, 'malformed.md'),
    }), /review_invalid/)
    throws(() => writeProtectedPublicationBodyFileV1({
      kind: 'review', body: reviewBody, outputFile: reviewFile,
    }), /publication_transport_invalid/)

    let partialRemoved = false
    throws(() => writeProtectedPublicationBodyFileV1({
      kind: 'review',
      body: reviewBody,
      outputFile: 'partial.md',
      fileHost: {
        openSync: () => 7,
        writeSync: (_descriptor, bytes) => bytes.length - 1,
        fsyncSync: () => {},
        closeSync: () => {},
        readFileSync: () => Buffer.from(reviewBody, 'utf8'),
        unlinkSync: () => { partialRemoved = true },
      },
    }), /publication_transport_invalid/)
    equal(partialRemoved, true)

    let mismatchRemoved = false
    throws(() => writeProtectedPublicationBodyFileV1({
      kind: 'merge',
      body: decisionBody,
      outputFile: 'mismatch.md',
      fileHost: {
        openSync: () => 8,
        writeSync: (_descriptor, bytes) => bytes.length,
        fsyncSync: () => {},
        closeSync: () => {},
        readFileSync: () => Buffer.from(`${decisionBody}corrupt`, 'utf8'),
        unlinkSync: () => { mismatchRemoved = true },
      },
    }), /publication_transport_invalid/)
    equal(mismatchRemoved, true)

    throws(() => writeProtectedPublicationBodyFileV1({
      kind: 'merge',
      body: decisionBody,
      outputFile: 'uncreatable.md',
      fileHost: {
        openSync: () => { throw new Error('permission denied') },
        writeSync: () => 0,
        fsyncSync: () => {},
        closeSync: () => {},
        readFileSync: () => Buffer.alloc(0),
        unlinkSync: () => {},
      },
    }), /publication_transport_invalid/)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

const allChecks = [check('validate', 15368), check('build-preview', 15368), check('Cloudflare Pages', 85455)]
equal(classifyValidationPathsV1(['research/sd-prompt-research/experiments/hair/HAIR-001-A/observation.json']).profile, 'RESEARCH_EXPERIMENT')
equal(classifyValidationPathsV1(['research/sd-prompt-research/concepts/physical-concepts.json']).profile, 'CONCEPT_GRAPH')
equal(classifyValidationPathsV1(['data/visual-concept-prompt-tag-bindings-v1.json', 'src/visualConceptProductionAdvisoryV1.ts']).profile, 'PRODUCTION_ADVISORY')
equal(classifyValidationPathsV1(['data/prompt-tags.json']).profile, 'PROMPT_DATA')
equal(classifyValidationPathsV1(['src/main.tsx']).profile, 'APPLICATION')
equal(classifyValidationPathsV1(['scripts/ordinary-platform-check.mjs']).profile, 'PLATFORM')
equal(classifyValidationPathsV1(['docs/product/guide.md']).profile, 'DOCUMENTATION')
equal(classifyValidationPathsV1(['unknown/new.bin']).profile, 'FULL_RESEARCH')
equal(classifyValidationPathsV1(['docs/product/guide.md', 'src/main.tsx']).fallback_reason, 'mixed_ownership_classes')
equal(classifyValidationPathsV1([]).fallback_reason, 'empty_changed_path_set')
equal(classifyValidationPathsV1(['docs/a.md', 'docs/a.md']).fallback_reason, 'duplicate_changed_path')
equal(classifyValidationPathsV1(['a//b']).fallback_reason, 'malformed_changed_path')
equal(classifyValidationPathsV1(['docs/x\ny.md']).fallback_reason, 'malformed_changed_path')
equal(classifyValidationPathsV1(['docs/x\u007fy.md']).fallback_reason, 'malformed_changed_path')
equal(classifyValidationPathsV1(['C:/docs/a.md']).fallback_reason, 'malformed_changed_path')
equal(classifyValidationPathsV1(['data/validation-path-ownership-v1.json']).profile, 'FULL_RESEARCH')
equal(classifyValidationPathsV1(['research/sd-prompt-research/requirements.lock.txt']).profile, 'FULL_RESEARCH')
equal(classifyValidationPathsV1(['scripts/acquire-python-validation-environment-v1.ps1']).profile, 'FULL_RESEARCH')
equal(classifyValidationPathsV1(['scripts/test-python-validation-environment-v1.ps1']).profile, 'FULL_RESEARCH')
equal(classifyValidationPathsV1(['scripts/validate-dictionaries.mjs']).profile, 'FULL_RESEARCH')

const validationWorkflow = readFileSync(new URL('../.github/workflows/research-claims.yml', import.meta.url), 'utf8')
const pythonCacheHelper = readFileSync(new URL('./acquire-python-validation-environment-v1.ps1', import.meta.url), 'utf8')
const pythonLock = readFileSync(new URL('../research/sd-prompt-research/requirements.lock.txt', import.meta.url), 'utf8')
ok(validationWorkflow.includes('actions/cache@v4'))
ok(validationWorkflow.includes('acquire-python-validation-environment-v1.ps1'))
ok(validationWorkflow.includes('test-python-validation-environment-v1.ps1'))
ok(validationWorkflow.includes('"$VALIDATION_PYTHON" -B -E -s'))
equal(validationWorkflow.includes('python -m pip install -r research/sd-prompt-research/requirements.txt'), false)
ok(pythonCacheHelper.includes("Join-Path $gitCommonDirectory 'codex-cache/python-validation-v1'"))
ok(pythonCacheHelper.includes("'--require-hashes'"))
ok(pythonCacheHelper.includes("$script:RequiredImports = @('yaml', 'jsonschema', 'rfc8785', 'PIL', 'reportlab', 'pypdf')"))
equal((pythonLock.match(/^[-A-Za-z0-9_.]+==/gm) ?? []).length, 12)
ok((pythonLock.match(/--hash=sha256:[0-9a-f]{64}/g) ?? []).length >= 12)

const discoveredDictionaryFiles = discoverPromptTagDictionaryFilesV1([
  'hair.json',
  'validation-path-ownership-v1.json',
  'visual-concept-advisory-relation-allowlist-v1.json',
  'visual-concept-prompt-tag-bindings-v1.json',
  'slots.json',
  'unexpected-data-contract.json',
  'notes.md',
])
equal(discoveredDictionaryFiles.join(','), 'hair.json,unexpected-data-contract.json')
equal(parsePromptTagDictionaryV1('hair.json', '[{"id":"hai-long-hair","prompt":"long hair","category":"hair"}]').length, 1)
throws(() => validatePromptTagDictionaryRootV1('hair.json', [{ id: 'broken', prompt: '', category: 'hair' }]), /invalid row/)
throws(() => validatePromptTagDictionaryRootV1('unexpected-data-contract.json', { catalog: true }), /dictionary root must be an array/)
throws(() => parsePromptTagDictionaryV1('foreign-malformed.json', '{'), SyntaxError)
equal(evaluateRequiredChecksV1({ checks: allChecks, paths: PATHS, exactHead: HEAD }).length, 3)
equal(evaluateRequiredChecksV1({ checks: allChecks, paths: ['data/visual-concept-prompt-tag-bindings-v1.json', 'scripts/test-visual-concept-read-only-inspection-v1.mjs'], exactHead: HEAD }).length, 3)
equal(evaluateRequiredChecksV1({ checks: allChecks, paths: ['unknown/new.bin'], exactHead: HEAD }).length, 3)
equal(evaluateRequiredChecksV1({ checks: [check('validate', 15368)], paths: ['docs/product/guide.md'], exactHead: HEAD }).length, 1)
equal(evaluateRequiredChecksV1({ checks: [check('validate', 15368)], paths: ['research/sd-prompt-research/experiments/hair/HAIR-001-A/observation.json'], exactHead: HEAD }).length, 1)
throws(() => evaluateRequiredChecksV1({ checks: [check('build-preview', 15368), check('Cloudflare Pages', 85455)], paths: PATHS, exactHead: HEAD }), /required_check_missing:validate/)
throws(() => evaluateRequiredChecksV1({ checks: [check('validate', 15368), check('Cloudflare Pages', 85455)], paths: PATHS, exactHead: HEAD }), /required_check_missing:build-preview/)
throws(() => evaluateRequiredChecksV1({ checks: [check('validate', 15368), check('build-preview', 15368, { conclusion: 'FAILURE' }), check('Cloudflare Pages', 85455)], paths: PATHS, exactHead: HEAD }), /required_check_not_successful:build-preview/)

{
  const fixture = createFixture()
  const snapshot = await acquireSimplifiedPreDecisionPreflightV1({ request: preDecisionInput(), host: fixture.host })
  equal(snapshot.task_issue, TASK)
  equal(snapshot.pr_number, PR)
  equal(snapshot.exact_head, HEAD)
  equal(snapshot.expected_base, BASE)
  equal(snapshot.authorized_paths.join(','), PATHS.slice().sort().join(','))
  equal(snapshot.required_checks.length, 3)
  equal(snapshot.thread_ids.length, 0)
  equal(snapshot.mergeable, 'MERGEABLE')
  equal(fixture.state.mergeMutations, 0)
}
{
  const fixture = createFixture({ threads: [{ id: 'thread-1', isResolved: false, isOutdated: false }] })
  const error = await captureError(() => acquireSimplifiedPreDecisionPreflightV1({ request: preDecisionInput(), host: fixture.host }))
  equal(error.message, 'blocking_review_threads_present')
  equal(fixture.state.mergeMutations, 0)
}
{
  const fixture = createFixture({ checks: [check('validate', 15368), check('build-preview', 15368), check('Cloudflare Pages', 85455, { status: 'IN_PROGRESS', conclusion: null })] })
  const error = await captureError(() => acquireSimplifiedPreDecisionPreflightV1({ request: preDecisionInput(), host: fixture.host }))
  equal(error.message, 'required_check_not_successful:Cloudflare Pages')
  equal(fixture.state.mergeMutations, 0)
}
{
  const fixture = createFixture({ main: '4'.repeat(40) })
  const error = await captureError(() => acquireSimplifiedPreDecisionPreflightV1({ request: preDecisionInput(), host: fixture.host }))
  equal(error.message, 'live_binding_invalid')
  equal(fixture.state.mergeMutations, 0)
}
{
  const fixture = createFixture({ draft: true })
  const error = await captureError(() => acquireSimplifiedPreDecisionPreflightV1({ request: preDecisionInput(), host: fixture.host }))
  equal(error.message, 'live_binding_invalid')
  equal(fixture.state.mergeMutations, 0)
}
{
  const fixture = createFixture({ head: '4'.repeat(40) })
  const error = await captureError(() => acquireSimplifiedPreDecisionPreflightV1({ request: preDecisionInput(), host: fixture.host }))
  equal(error.message, 'review_threads_acquisition_failed')
  equal(fixture.state.mergeMutations, 0)
}
{
  const fixture = createFixture({ reviewHead: BASE })
  const error = await captureError(() => acquireSimplifiedPreDecisionPreflightV1({ request: preDecisionInput(), host: fixture.host }))
  equal(error.message, 'live_binding_invalid')
  equal(fixture.state.mergeMutations, 0)
}
{
  const fixture = createFixture({ paths: ['AGENTS.md'] })
  const error = await captureError(() => acquireSimplifiedPreDecisionPreflightV1({ request: preDecisionInput(), host: fixture.host }))
  equal(error.message, 'live_binding_invalid')
  equal(fixture.state.mergeMutations, 0)
}
{
  const fixture = createFixture({ mergeable: 'CONFLICTING', mergeStateStatus: 'DIRTY' })
  const error = await captureError(() => acquireSimplifiedPreDecisionPreflightV1({ request: preDecisionInput(), host: fixture.host }))
  equal(error.message, 'mergeability_invalid')
  equal(fixture.state.mergeMutations, 0)
}
{
  const fixture = createFixture()
  const error = await captureError(() => acquireSimplifiedPreDecisionPreflightV1({
    request: { ...preDecisionInput(), unknown_field: true },
    host: fixture.host,
  }))
  equal(error.message, 'pre_decision_preflight_request_invalid')
  equal(fixture.state.mergeMutations, 0)
}

{
  const historicalFindingTerminal = Date.parse('2026-08-28T12:40:20Z')
  const historicalWorkerStart = Date.parse('2026-08-28T13:17:44Z')
  equal(historicalWorkerStart - historicalFindingTerminal, 37 * 60 * 1000 + 24 * 1000)
  const continuation = simulateImmediateCoordinatorContinuationV1({
    waitTerminal: true,
    terminalKind: 'REVIEW_FINDING',
    identityMatches: true,
    owningWorker: 'task-468-worker',
    observedAt: historicalFindingTerminal,
  })
  equal(continuation.actions.length, 1)
  equal(continuation.actions[0].type, 'FOLLOW_UP_OWNING_WORKER')
  equal(continuation.actions[0].worker, 'task-468-worker')
  equal(continuation.action_at - historicalFindingTerminal <= 10_000, true)
}
{
  const checks = simulateImmediateCoordinatorContinuationV1({
    waitTerminal: true, terminalKind: 'CHECKS_PASS', identityMatches: true,
    owningWorker: 'worker', observedAt: 100,
  })
  const approval = simulateImmediateCoordinatorContinuationV1({
    waitTerminal: true, terminalKind: 'REVIEW_APPROVE', identityMatches: true,
    owningWorker: 'worker', observedAt: 100,
  })
  const nonterminal = simulateImmediateCoordinatorContinuationV1({
    waitTerminal: false, terminalKind: 'CHECKS_PASS', identityMatches: true,
    owningWorker: 'worker', observedAt: 100,
  })
  const mismatch = simulateImmediateCoordinatorContinuationV1({
    waitTerminal: true, terminalKind: 'REVIEW_FINDING', identityMatches: false,
    owningWorker: 'worker', observedAt: 100,
  })
  equal(checks.actions.length, 1)
  equal(checks.actions[0].type, 'DISPATCH_FRESH_REVIEW')
  equal(approval.actions.length, 1)
  equal(approval.actions[0].type, 'RUN_PRE_DECISION_PREFLIGHT')
  equal(nonterminal.actions.length, 0)
  equal(mismatch.actions.length, 0)
}

{
  const fixture = createFixture()
  const result = await executeSimplifiedMergeV1({ event: mergeEvent(), host: fixture.host })
  equal(result.state, 'COMPLETED')
  equal(result.reason, 'merge_completed')
  equal(result.mutation_count, 1)
  equal(fixture.state.mergeMutations, 1)
  equal(fixture.state.mergeExpectedHead, HEAD)
  equal(result.merge_commit, MERGE)
}
{
  const fixture = createFixture({ reviewHead: BASE })
  const result = await executeSimplifiedMergeV1({ event: mergeEvent(), host: fixture.host })
  equal(result.reason, 'live_binding_invalid')
  equal(fixture.state.mergeMutations, 0)
}
{
  const fixture = createFixture({ checks: [check('validate', 15368), check('build-preview', 15368), check('Cloudflare Pages', 85455, { status: 'IN_PROGRESS', conclusion: null })] })
  const result = await executeSimplifiedMergeV1({ event: mergeEvent(), host: fixture.host })
  equal(result.reason, 'required_check_not_successful:Cloudflare Pages')
  equal(fixture.state.mergeMutations, 0)
}
{
  const fixture = createFixture({ threads: [{ id: 'thread-1', isResolved: false, isOutdated: false }] })
  const result = await executeSimplifiedMergeV1({ event: mergeEvent(), host: fixture.host })
  equal(result.reason, 'blocking_review_threads_present')
  equal(fixture.state.mergeMutations, 0)
}
{
  const fixture = createFixture()
  const result = await executeSimplifiedMergeV1({ event: mergeEvent(decisionInput({ expected_base: '4'.repeat(40) })), host: fixture.host })
  equal(result.reason, 'live_binding_invalid')
  equal(fixture.state.mergeMutations, 0)
}
{
  const fixture = createFixture({ draft: true })
  const result = await executeSimplifiedMergeV1({ event: mergeEvent(), host: fixture.host })
  equal(result.reason, 'live_binding_invalid')
  equal(fixture.state.mergeMutations, 0)
}
{
  let observedAuthorization = null
  const host = createProductionHostV1({
    token: 'test-token',
    fetchImpl: async (_url, options) => {
      observedAuthorization = options.headers.Authorization
      return new Response(JSON.stringify({
        sha: MERGE,
        merged: true,
        message: 'Pull Request successfully merged',
      }), { status: 200, headers: { 'x-github-request-id': 'REQ:SUCCESS' } })
    },
  })
  const result = await host.mergePullRequest({ repository: REPOSITORY, prNumber: PR, exactHead: HEAD })
  equal(result.sha, MERGE)
  equal(result.merged, true)
  equal(observedAuthorization, 'Bearer test-token')
}
{
  let observedRequest = null
  const host = createProductionHostV1({
    token: 'test-token',
    fetchImpl: async (url, options) => {
      observedRequest = { url, options }
      return new Response(JSON.stringify({
        message: 'Denied by https://api.github.com/private?token=secret-value',
      }), { status: 403, headers: { 'x-github-request-id': 'REQ:PERMISSION' } })
    },
  })
  const error = await captureError(() => host.mergePullRequest({ repository: REPOSITORY, prNumber: PR, exactHead: HEAD }))
  const diagnostic = error.mutation_diagnostic
  equal(observedRequest.url, `https://api.github.com/repos/whatrune/sd-prompt-studio/pulls/${PR}/merge`)
  equal(observedRequest.options.method, 'PUT')
  equal(observedRequest.options.body, JSON.stringify({ sha: HEAD, merge_method: 'merge' }))
  equal(diagnostic.phase, 'MERGE_MUTATION_HTTP_RESPONSE')
  equal(diagnostic.request_dispatch_started, true)
  equal(diagnostic.response_received, true)
  equal(diagnostic.http_status, 403)
  equal(diagnostic.github_request_id, 'REQ:PERMISSION')
  equal(diagnostic.response_message, 'Denied by [REDACTED_URL]')
  equal(diagnostic.graphql_errors.length, 0)
  equal(Object.keys(diagnostic).join(','), 'phase,request_dispatch_started,response_received,http_status,github_request_id,response_message,graphql_errors,network_exception')
  equal(JSON.stringify(diagnostic).includes('secret-value'), false)
  equal(JSON.stringify(diagnostic).includes('api.github.com'), false)
  equal(JSON.stringify(diagnostic).includes('test-token'), false)
  equal(JSON.stringify(diagnostic).includes('Authorization'), false)

  const fixture = createFixture({ mergeError: error })
  const result = await executeSimplifiedMergeV1({ event: mergeEvent(), host: fixture.host })
  equal(result.state, 'STOPPED')
  equal(result.reason, 'merge_rejected')
  equal(result.outcome, 'DEFINITIVE_REJECTION')
  equal(result.mutation_count, 1)
  equal(result.mutation_diagnostic.phase, 'MERGE_MUTATION_HTTP_RESPONSE')
  equal(fixture.state.mergeMutations, 1)
}
{
  const secretMessages = [
    ['Authorization: Bearer bearer-secret', 'Authorization: Bearer [REDACTED]'],
    ['Authorization: Basic basic-secret', 'Authorization: Basic [REDACTED]'],
    ['Cookie: session=cookie-secret', 'Cookie: [REDACTED]'],
    ['Set-Cookie: session=set-cookie-secret; Secure', 'Set-Cookie: [REDACTED]'],
    ['aUtHoRiZaTiOn: bEaReR mixed-secret', 'aUtHoRiZaTiOn: bEaReR [REDACTED]'],
    ['Authorization   :   Basic    whitespace-secret', 'Authorization   :   Basic    [REDACTED]'],
    ['Mutation failed: Authorization: Bearer embedded-secret while processing', 'Mutation failed: Authorization: Bearer [REDACTED] while processing'],
  ]
  for (const [message, expected] of secretMessages) {
    const host = createProductionHostV1({
      token: 'test-token',
      fetchImpl: async () => new Response(JSON.stringify({ message }), {
        status: 403,
        headers: { 'x-github-request-id': 'REQ:CREDENTIALS' },
      }),
    })
    const error = await captureError(() => host.mergePullRequest({ repository: REPOSITORY, prNumber: PR, exactHead: HEAD }))
    equal(error.mutation_diagnostic.response_message, expected)
    equal(error.mutation_diagnostic.response_message.includes('[REDACTED]'), true)
    equal(error.mutation_diagnostic.response_message === message, false)
  }
}
{
  const host = createProductionHostV1({
    token: 'test-token',
    fetchImpl: async () => new Response(JSON.stringify({ message: 'Head branch was modified' }), {
      status: 409,
      headers: { 'x-github-request-id': 'REQ:HEAD-MISMATCH' },
    }),
  })
  const error = await captureError(() => host.mergePullRequest({ repository: REPOSITORY, prNumber: PR, exactHead: HEAD }))
  const fixture = createFixture({ mergeError: error })
  const result = await executeSimplifiedMergeV1({ event: mergeEvent(), host: fixture.host })
  equal(result.state, 'STOPPED')
  equal(result.reason, 'merge_exact_head_rejected')
  equal(result.outcome, 'DEFINITIVE_REJECTION')
  equal(result.mutation_count, 1)
  equal(result.mutation_diagnostic.http_status, 409)
  equal(result.mutation_diagnostic.response_message, 'Head branch was modified')
  equal(fixture.state.mergeMutations, 1)
}
{
  const host = createProductionHostV1({
    token: 'test-token',
    fetchImpl: async () => new Response(JSON.stringify({ message: 'Service unavailable' }), {
      status: 503,
      headers: { 'x-github-request-id': 'REQ:SERVER' },
    }),
  })
  const error = await captureError(() => host.mergePullRequest({ repository: REPOSITORY, prNumber: PR, exactHead: HEAD }))
  const fixture = createFixture({ mergeError: error })
  const result = await executeSimplifiedMergeV1({ event: mergeEvent(), host: fixture.host })
  equal(result.state, 'INDETERMINATE')
  equal(result.reason, 'merge_outcome_unknown')
  equal(result.outcome, 'OUTCOME_UNKNOWN')
  equal(result.mutation_count, 1)
  equal(result.mutation_diagnostic.http_status, 503)
  equal(fixture.state.mergeMutations, 1)
}
{
  const host = createProductionHostV1({
    token: 'test-token',
    fetchImpl: async () => new Response(JSON.stringify({
      message: 'Denied by https://api.github.com/merge?token=url-secret',
    }), { status: 403, headers: { 'x-github-request-id': 'REQ:TEXT' } }),
  })
  const error = await captureError(() => host.mergePullRequest({ repository: REPOSITORY, prNumber: PR, exactHead: HEAD }))
  const diagnostic = error.mutation_diagnostic
  equal(diagnostic.response_message, 'Denied by [REDACTED_URL]')
  equal(JSON.stringify(diagnostic).includes('url-secret'), false)

  const ordinaryHost = createProductionHostV1({
    token: 'test-token',
    fetchImpl: async () => new Response(JSON.stringify({ message: 'ordinary non-secret diagnostic text' }), {
      status: 403,
      headers: { 'x-github-request-id': 'REQ:ORDINARY' },
    }),
  })
  const ordinaryError = await captureError(() => ordinaryHost.mergePullRequest({ repository: REPOSITORY, prNumber: PR, exactHead: HEAD }))
  equal(ordinaryError.mutation_diagnostic.response_message, 'ordinary non-secret diagnostic text')
}
{
  const urlLikeMessages = [
    'Denied by //example.test/private?token=protocol-relative-secret',
    'Denied by 192.0.2.10/private?token=ipv4-secret',
    'Denied by [2001:db8::1]/private?token=ipv6-secret',
    'Denied by 2001:db8::1/private?token=bare-ipv6-secret',
    'Denied by localhost/private?secret=localhost-secret',
    'Denied by example.test/private?secret=host-path-secret',
    'Denied by user:password@example.test/private?secret=userinfo-secret',
    'Denied by user:password@[2001:db8::1]/private?secret=ipv6-userinfo-secret',
  ]
  for (const message of urlLikeMessages) {
    const host = createProductionHostV1({
      token: 'test-token',
      fetchImpl: async () => new Response(JSON.stringify({ message }), {
        status: 403,
        headers: { 'x-github-request-id': 'REQ:URL-FORMS' },
      }),
    })
    const error = await captureError(() => host.mergePullRequest({ repository: REPOSITORY, prNumber: PR, exactHead: HEAD }))
    equal(error.mutation_diagnostic.response_message, 'Denied by [REDACTED_URL]')
  }

  const projectionError = new Error('raw_projection_failure')
  Object.defineProperty(projectionError, 'mutation_diagnostic', { value: {
    phase: 'MERGE_MUTATION_HTTP_RESPONSE',
    request_dispatch_started: true,
    response_received: true,
    http_status: 403,
    github_request_id: 'REQ:RAW-PROJECTION',
    response_message: 'Projection saw //example.test/private?token=projection-secret; Authorization: Bearer projection-bearer-secret',
    graphql_errors: [],
    network_exception: null,
  } })
  const fixture = createFixture({ mergeError: projectionError })
  const result = await executeSimplifiedMergeV1({ event: mergeEvent(), host: fixture.host })
  equal(result.mutation_diagnostic.response_message, 'Projection saw [REDACTED_URL] Authorization: Bearer [REDACTED]')
  equal(JSON.stringify(result.mutation_diagnostic).includes('projection-secret'), false)
  equal(JSON.stringify(result.mutation_diagnostic).includes('projection-bearer-secret'), false)
}
{
  const host = createProductionHostV1({
    token: 'test-token',
    fetchImpl: async () => new Response(JSON.stringify({ message: 'Resource not accessible by integration' }), {
      status: 403,
      headers: { 'x-github-request-id': 'REQ:HTTP' },
    }),
  })
  const error = await captureError(() => host.mergePullRequest({ repository: REPOSITORY, prNumber: PR, exactHead: HEAD }))
  equal(error.mutation_diagnostic.phase, 'MERGE_MUTATION_HTTP_RESPONSE')
  equal(error.mutation_diagnostic.request_dispatch_started, true)
  equal(error.mutation_diagnostic.response_received, true)
  equal(error.mutation_diagnostic.http_status, 403)
  equal(error.mutation_diagnostic.github_request_id, 'REQ:HTTP')
  equal(error.mutation_diagnostic.response_message, 'Resource not accessible by integration')
  equal(error.mutation_diagnostic.graphql_errors.length, 0)
}
{
  const host = createProductionHostV1({
    token: 'test-token',
    fetchImpl: async () => {
      const error = new TypeError('connection reset after dispatch; Authorization: Bearer transport-secret')
      error.code = 'ECONNRESET'
      throw error
    },
  })
  const error = await captureError(() => host.mergePullRequest({ repository: REPOSITORY, prNumber: PR, exactHead: HEAD }))
  equal(error.mutation_diagnostic.phase, 'MERGE_MUTATION_TRANSPORT')
  equal(error.mutation_diagnostic.request_dispatch_started, true)
  equal(error.mutation_diagnostic.response_received, false)
  equal(error.mutation_diagnostic.http_status, null)
  equal(error.mutation_diagnostic.network_exception.name, 'TypeError')
  equal(error.mutation_diagnostic.network_exception.code, 'ECONNRESET')
  equal(JSON.stringify(error.mutation_diagnostic).includes('connection reset'), false)
  equal(JSON.stringify(error.mutation_diagnostic).includes('transport-secret'), false)
  const fixture = createFixture({ mergeError: error })
  const result = await executeSimplifiedMergeV1({ event: mergeEvent(), host: fixture.host })
  equal(result.state, 'INDETERMINATE')
  equal(result.outcome, 'OUTCOME_UNKNOWN')
  equal(fixture.state.mergeMutations, 1)
}
{
  const host = createProductionHostV1({
    token: 'test-token',
    fetchImpl: async () => new Response('{invalid-json', {
      status: 200,
      headers: { 'x-github-request-id': 'REQ:MALFORMED' },
    }),
  })
  const error = await captureError(() => host.mergePullRequest({ repository: REPOSITORY, prNumber: PR, exactHead: HEAD }))
  equal(error.mutation_diagnostic.phase, 'MERGE_MUTATION_RESPONSE_PARSE')
  equal(error.mutation_diagnostic.request_dispatch_started, true)
  equal(error.mutation_diagnostic.response_received, true)
  equal(error.mutation_diagnostic.http_status, 200)
  equal(error.mutation_diagnostic.github_request_id, 'REQ:MALFORMED')
  equal(error.mutation_diagnostic.response_message, null)
  equal(error.mutation_diagnostic.graphql_errors.length, 0)
  equal(error.mutation_diagnostic.network_exception, null)
  const fixture = createFixture({ mergeError: error })
  const result = await executeSimplifiedMergeV1({ event: mergeEvent(), host: fixture.host })
  equal(result.state, 'INDETERMINATE')
  equal(result.outcome, 'OUTCOME_UNKNOWN')
  equal(fixture.state.mergeMutations, 1)
}
{
  const fixture = createFixture({ mergeResponse: { message: 'indeterminate response' } })
  const result = await executeSimplifiedMergeV1({ event: mergeEvent(), host: fixture.host })
  equal(result.state, 'INDETERMINATE')
  equal(result.reason, 'merge_after_state_invalid')
  equal(result.outcome, 'OUTCOME_UNKNOWN')
  equal(result.mutation_count, 1)
  equal(fixture.state.mergeMutations, 1)
}
{
  const fixture = createFixture({ afterMergeParents: [{ sha: BASE }, { sha: '4'.repeat(40) }] })
  const result = await executeSimplifiedMergeV1({ event: mergeEvent(), host: fixture.host })
  equal(result.state, 'INDETERMINATE')
  equal(result.reason, 'merge_after_refetch_invalid')
  equal(result.outcome, 'OUTCOME_UNKNOWN')
  equal(result.mutation_count, 1)
  equal(fixture.state.mergeMutations, 1)
}
{
  const fixture = createFixture()
  const decision = decisionInput({
    review_kind: 'TASK_ISSUE_COMMENT',
    review_url: `https://github.com/${REPOSITORY}/issues/${TASK}#issuecomment-${REVIEW}`,
  })
  const result = await executeSimplifiedMergeV1({ event: mergeEvent(decision), host: fixture.host })
  equal(result.state, 'COMPLETED')
  equal(fixture.state.mergeMutations, 1)
}
{
  const fixture = createFixture()
  const result = await executeSimplifiedMergeV1({ event: {
    action: 'created', repository: { full_name: REPOSITORY },
    issue: { number: PR, pull_request: { url: 'https://api.invalid/pull' } },
    comment: { user: { login: 'someone' }, body: 'ordinary review reply' },
  }, host: fixture.host })
  equal(result.state, 'NOT_APPLICABLE')
  equal(fixture.state.mergeMutations, 0)
}

const workflow = readFileSync(new URL('../.github/workflows/protected-transition-admission-v1.yml', import.meta.url), 'utf8')
const workflowDocument = parseDocument(workflow)
equal(workflowDocument.errors.length, 0)
const workflowPermissions = workflowDocument.toJS().permissions
const preflightSource = readFileSync(new URL('./protected-transition-merge-operator-preflight-v1.mjs', import.meta.url), 'utf8')
const runnerSource = readFileSync(new URL('./run-protected-transition-admission-v1.mjs', import.meta.url), 'utf8')
const agentsSource = readFileSync(new URL('../AGENTS.md', import.meta.url), 'utf8')
const integratedLeadSource = readFileSync(new URL('../docs/team/08-integrated-lead-charter.md', import.meta.url), 'utf8')
const sharedRoleSource = readFileSync(new URL('../docs/team/13-shared-role-execution-contract.md', import.meta.url), 'utf8')
ok(workflow.includes('simplified_protected_transition_v1:'))
ok(workflow.includes('persist-credentials: false'))
ok(workflow.includes('github.workflow_sha'))
ok(workflow.includes('issue_comment:'))
equal(Object.keys(workflowPermissions).sort().join(','), 'checks,contents,issues,pull-requests,statuses')
equal(workflowPermissions.contents, 'write')
equal(workflowPermissions.checks, 'read')
equal(workflowPermissions.issues, 'read')
equal(workflowPermissions['pull-requests'], 'read')
equal(workflowPermissions.statuses, 'read')
equal(workflow.includes('workflow_dispatch:'), false)
equal(workflow.includes('READY_BOT_TOKEN'), false)
equal(preflightSource.includes('executeSimplifiedReadyV1'), false)
equal(preflightSource.includes('markPullRequestReadyForReview'), false)
equal(preflightSource.includes('READY_MUTATION'), false)
equal(preflightSource.includes('mutation MergeSimplifiedPullRequest'), false)
equal(preflightSource.includes('mergePullRequest(input:'), false)
ok(preflightSource.includes('host.mergePullRequest'))
ok(runnerSource.includes("valueAfter('--pre-decision-preflight-file')"))
ok(runnerSource.includes('acquireSimplifiedPreDecisionPreflightV1'))
ok(runnerSource.includes("args.includes('--publication-body-output-file')"))
ok(runnerSource.includes('writeProtectedPublicationBodyFileV1'))
equal(runnerSource.includes(".join(' ')"), false)
ok(agentsSource.includes('## Immediate Terminal Continuation'))
ok(agentsSource.includes('wait_threads'))
ok(agentsSource.includes('same owning Worker'))
ok(agentsSource.includes('at most 10 seconds'))
ok(integratedLeadSource.includes('checks PASS dispatches Fresh Review'))
ok(integratedLeadSource.includes('correction checks PASS dispatches replacement Fresh Review'))
ok(integratedLeadSource.includes('read-only pre-Decision preflight'))
ok(sharedRoleSource.includes('Timeout, nonterminal state, stale HEAD, and identity mismatch prohibit stage advance'))
ok(sharedRoleSource.includes('zero active unresolved non-outdated threads'))
equal((preflightSource.match(/const initial = await acquireLiveSnapshot/g) ?? []).length, 1)
equal((preflightSource.match(/const final = await acquireLiveSnapshot/g) ?? []).length, 1)
ok(runnerSource.includes("method: 'PUT'"))
ok(runnerSource.includes("body: JSON.stringify({ sha: exactHead, merge_method: 'merge' })"))
equal(runnerSource.includes('simplified-workflow-dispatch-event-file'), false)
equal((workflow.match(/^    runs-on:/gm) ?? []).length, 1)
for (const retired of ['ready_transition_required_resume', 'minimal_governance', 'terminal_observation', 'protected_transition_task_state']) {
  equal(workflow.includes(retired), false)
}

process.stdout.write(`simplified protected-transition checks passed (${assertions} assertions)\n`)
