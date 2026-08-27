import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { createVisualConceptReadOnlyEntryAdapterV1 } from './visual-concept-read-only-entry-adapter-v1.mjs'
import { projectVisualConceptReadOnlyInspectionReportV1 } from './inspect-visual-concept-read-only-v1.mjs'
import {
  projectVisualConceptReadOnlyAdvisoryV1,
  serializeVisualConceptReadOnlyAdvisoryV1,
} from './visual-concept-read-only-advisory-v1.mjs'

let assertionCount = 0
const equal = (actual, expected, message) => { assertionCount += 1; assert.equal(actual, expected, message) }
const deepEqual = (actual, expected, message) => { assertionCount += 1; assert.deepEqual(actual, expected, message) }
const clone = value => structuredClone(value)

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const bindingContract = JSON.parse(fs.readFileSync(path.join(repoRoot, 'data', 'visual-concept-prompt-tag-bindings-v1.json'), 'utf8'))
const graphContract = JSON.parse(fs.readFileSync(path.join(repoRoot, 'research', 'sd-prompt-research', 'dist', 'visual-concept-graph.json'), 'utf8'))
const server = await createServer({ root: repoRoot, configFile: false, logLevel: 'silent', server: { middlewareMode: true }, appType: 'custom' })
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'visual-concept-advisory-v1-'))

try {
  const [{ tags }, { adultTags }] = await Promise.all([
    server.ssrLoadModule('/src/data/tags.ts'),
    server.ssrLoadModule('/src/data/adultTags.ts'),
  ])
  const registry = [...tags, ...adultTags]
  const selected = id => ({ ...registry.find(tag => tag.id === id), weight: 1 })
  const custom = { id: 'custom-advisory-tag', label: 'Custom', prompt: 'custom advisory tag', category: 'pose', weight: 1 }
  const input = {
    blocks: [
      { id: 'subject-1', name: 'Subject 1', tags: [selected('pos-lying'), selected('rin-pose-arm-support'), selected('pos-lying')] },
      { id: 'subject-2', name: 'Subject 2', tags: [selected('rin-pose-reclining'), selected('v192-bent-knees'), custom] },
    ],
    sceneTags: [selected('bac-forest'), selected('pos-lying-on-back')],
  }
  const projection = createVisualConceptReadOnlyEntryAdapterV1({ bindingContract, graphContract, promptTagRegistry: registry })(input)
  const inspection = projectVisualConceptReadOnlyInspectionReportV1({ projection, bindingContract, promptTagRegistry: registry })
  const advisory = projectVisualConceptReadOnlyAdvisoryV1(inspection)

  equal(advisory.advisory_status, 'READY', 'valid inspection must produce a ready advisory')
  equal(advisory.rejection_reason, null, 'ready advisory must not carry a rejection reason')
  deepEqual(advisory.projection_summary, { mapped_count: 5, unmapped_count: 3, rejected_count: 0 }, 'projection summary must remain unchanged')
  deepEqual(advisory.mapped_concepts.map(concept => [concept.concept_id, concept.concept_status, concept.occurrences.length]), [
    ['body.state.lying', 'provisional', 2],
    ['support.arm.rearward', 'provisional', 1],
    ['body.state.reclined', 'provisional', 1],
    ['configuration.knee.bent', 'provisional', 1],
  ], 'mapped concepts must preserve first occurrence order and exact status')
  deepEqual(advisory.mapped_concepts[0].occurrences, [
    { owner_kind: 'PROMPT_BLOCK', owner_id: 'subject-1', prompt_tag_id: 'pos-lying' },
    { owner_kind: 'PROMPT_BLOCK', owner_id: 'subject-1', prompt_tag_id: 'pos-lying' },
  ], 'repeated mapped selections must preserve exact ownership and occurrence order')
  deepEqual(advisory.unmapped_tags, [
    { owner_kind: 'PROMPT_BLOCK', owner_id: 'subject-2', prompt_tag_id: 'custom-advisory-tag', diagnostic_reason: 'non_registry_tag_unmapped' },
    { owner_kind: 'SCENE', owner_id: 'scene', prompt_tag_id: 'bac-forest', diagnostic_reason: 'prompt_tag_unmapped' },
    { owner_kind: 'SCENE', owner_id: 'scene', prompt_tag_id: 'pos-lying-on-back', diagnostic_reason: 'prompt_tag_unmapped' },
  ], 'unmapped tags must preserve projection order and diagnostics')
  deepEqual(advisory.diagnostic_reasons, [
    { reason: 'non_registry_tag_unmapped', count: 1 },
    { reason: 'prompt_tag_unmapped', count: 2 },
  ], 'diagnostic counts must preserve first occurrence order and exact-reason aggregation')
  deepEqual(advisory.relations, [], 'V1 advisory must not interpret graph relations')
  deepEqual(advisory.source_binding, inspection.source_binding, 'advisory must preserve admitted source identity')
  equal(serializeVisualConceptReadOnlyAdvisoryV1(advisory), serializeVisualConceptReadOnlyAdvisoryV1(advisory), 'identical advisory reports must serialize byte-identically')

  const rejectedInspection = projectVisualConceptReadOnlyInspectionReportV1({
    projection: createVisualConceptReadOnlyEntryAdapterV1({ bindingContract, graphContract, promptTagRegistry: registry })({ blocks: null, sceneTags: [] }),
    bindingContract,
    promptTagRegistry: registry,
  })
  const rejectedAdvisory = projectVisualConceptReadOnlyAdvisoryV1(rejectedInspection)
  equal(rejectedAdvisory.advisory_status, 'REJECTED', 'upstream projection rejection must fail closed')
  equal(rejectedAdvisory.rejection_reason, 'projection_input_invalid', 'upstream closed rejection reason must remain unchanged')
  deepEqual(rejectedAdvisory.relations, [], 'rejected advisory must expose no relations')

  const malformed = clone(inspection)
  malformed.extra = true
  equal(projectVisualConceptReadOnlyAdvisoryV1(malformed).rejection_reason, 'advisory_input_invalid', 'unknown inspection fields must fail closed')
  const countDrift = clone(inspection)
  countDrift.summary.mapped_count += 1
  equal(projectVisualConceptReadOnlyAdvisoryV1(countDrift).rejection_reason, 'advisory_input_invalid', 'projection count drift must fail closed')
  const sourceDrift = clone(inspection)
  sourceDrift.source_binding.graph_version = '0.3.0'
  equal(projectVisualConceptReadOnlyAdvisoryV1(sourceDrift).rejection_reason, 'advisory_input_invalid', 'unsupported inspection source identity must fail closed')
  const statusDrift = clone(inspection)
  statusDrift.entries[0].concept_status = 'confirmed'
  statusDrift.entries[2].concept_status = 'provisional'
  equal(projectVisualConceptReadOnlyAdvisoryV1(statusDrift).rejection_reason, 'advisory_input_invalid', 'conflicting status for one exact concept must fail closed')

  const inspectionFile = path.join(temporaryDirectory, 'inspection.json')
  fs.writeFileSync(inspectionFile, JSON.stringify(inspection), 'utf8')
  const cli = spawnSync(process.execPath, [path.join(repoRoot, 'scripts', 'visual-concept-read-only-advisory-v1.mjs'), '--inspection-file', inspectionFile], { cwd: repoRoot, encoding: 'utf8' })
  equal(cli.status, 0, 'CLI must accept a valid inspection report')
  equal(cli.stderr, '', 'successful CLI must not write stderr')
  deepEqual(JSON.parse(cli.stdout), advisory, 'CLI must use the same advisory projector')
  equal(cli.stdout, serializeVisualConceptReadOnlyAdvisoryV1(advisory), 'CLI must emit one compact byte-stable JSON report')
  deepEqual(fs.readdirSync(temporaryDirectory), ['inspection.json'], 'advisory CLI must not mutate the filesystem')

  console.log(`Visual Concept read-only advisory tests passed: ${assertionCount} assertions`)
} finally {
  await server.close()
  fs.rmSync(temporaryDirectory, { recursive: true, force: true })
}
