#!/usr/bin/env node

import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = path => fs.readFileSync(path, 'utf8')

const packageJson = JSON.parse(read('package.json'))
const router = read('src/appRouter.tsx')
const apiClient = read('src/features/research-explorer/api/researchApiClient.ts')
const types = read('src/features/research-explorer/types/research.ts')
const viewer = read('src/features/research-explorer/components/ArtifactViewer.tsx')
const inspector = read('src/features/research-explorer/components/ArtifactInspector.tsx')
const page = read('src/features/research-explorer/pages/ResearchExplorerPage.tsx')

assert.match(router, /pathname === '\/research'/)
assert.match(router, /\/research\\\/artifact\\\//)
assert.match(apiClient, /const INDEX_ENDPOINT = '\/api\/research\/index'/)
assert.match(apiClient, /const ARTIFACT_ENDPOINT = '\/api\/research\/artifacts\/'/)
assert.match(apiClient, /'X-Research-Index-Snapshot': snapshotId/)
assert.doesNotMatch(apiClient, /method:\s*'(?:POST|PUT|PATCH|DELETE|OPTIONS)'/)

for (const scope of [
  'run',
  'observation',
  'draft',
  'candidate',
  'canonical_assertion',
  'receipt',
  'validation_result',
]) {
  assert.match(types, new RegExp(`value: '${scope}'`))
}
assert.doesNotMatch(types, /value: 'experiment'/)

assert.match(viewer, /parse as parseYaml/)
assert.match(viewer, /disableParsingRawHTML: true/)
assert.match(viewer, /PrismLight as SyntaxHighlighter/)
assert.doesNotMatch(viewer, /contentEditable|dangerouslySetInnerHTML/)
assert.match(inspector, /Not Provided/)
assert.match(page, /Research Data Unavailable/)
assert.match(packageJson.scripts['build:research-local'], /vite build --base \/(?:\s|$)/)
assert.match(packageJson.scripts['build:research-local'], /validate-research-explorer-boundaries\.mjs --dist dist/)

console.log('Research Explorer UI contract regression tests passed.')
