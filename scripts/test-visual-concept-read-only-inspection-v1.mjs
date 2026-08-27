import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { createVisualConceptReadOnlyEntryAdapterV1 } from './visual-concept-read-only-entry-adapter-v1.mjs'
import {
  projectVisualConceptReadOnlyInspectionReportV1,
  serializeVisualConceptReadOnlyInspectionReportV1,
} from './inspect-visual-concept-read-only-v1.mjs'

let assertionCount = 0
const equal = (actual, expected, message) => { assertionCount += 1; assert.equal(actual, expected, message) }
const deepEqual = (actual, expected, message) => { assertionCount += 1; assert.deepEqual(actual, expected, message) }

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const bindingContract = JSON.parse(fs.readFileSync(path.join(repoRoot, 'data', 'visual-concept-prompt-tag-bindings-v1.json'), 'utf8'))
const graphContract = JSON.parse(fs.readFileSync(path.join(repoRoot, 'research', 'sd-prompt-research', 'dist', 'visual-concept-graph.json'), 'utf8'))
const server = await createServer({ root: repoRoot, configFile: false, logLevel: 'silent', server: { middlewareMode: true }, appType: 'custom' })
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'visual-concept-inspection-v1-'))

try {
  const [{ tags }, { adultTags }] = await Promise.all([
    server.ssrLoadModule('/src/data/tags.ts'),
    server.ssrLoadModule('/src/data/adultTags.ts'),
  ])
  const registry = [...tags, ...adultTags]
  const selected = id => ({ ...registry.find(tag => tag.id === id), weight: 1 })
  const input = {
    blocks: [{ id: 'subject-1', name: 'Subject 1', tags: [
      selected('pos-lying'),
      selected('rin-pose-arm-support'),
      selected('rin-pose-reclining'),
      selected('v192-bent-knees'),
      selected('pos-lying-on-back'),
    ] }],
    sceneTags: [selected('bac-forest')],
  }
  const projection = createVisualConceptReadOnlyEntryAdapterV1({ bindingContract, graphContract, promptTagRegistry: registry })(input)
  const report = projectVisualConceptReadOnlyInspectionReportV1({ projection, bindingContract, promptTagRegistry: registry })

  equal(report.projection_status, 'PROJECTED', 'valid production-shaped input must project')
  equal(report.rejection_reason, null, 'successful inspection must have no rejection reason')
  deepEqual(report.summary, { mapped_count: 5, unmapped_count: 1, rejected_count: 0 }, 'summary counts must reflect ordered projection entries')
  equal(report.coverage.explicit_binding_count, 5, 'coverage must report all five explicit bindings')
  equal(report.coverage.mapped_active_prompt_tag_count, 5, 'coverage must use exact active PromptTag identity matches')
  equal(report.coverage.unmapped_active_prompt_tag_count, registry.length - 5, 'coverage must not infer additional mappings')
  equal(report.source_binding.binding_record_type, 'visual_concept_prompt_tag_bindings_v1', 'source binding must identify the binding dataset')
  equal(report.source_binding.graph_schema_version, '0.2.0', 'source binding must identify the admitted graph schema version')
  equal(report.source_binding.graph_version, '0.2.0', 'source binding must identify the admitted graph version')
  deepEqual(report.entries.map(entry => [entry.owner_kind, entry.owner_id, entry.prompt_tag_id, entry.mapping_status]), [
    ['PROMPT_BLOCK', 'subject-1', 'pos-lying', 'MAPPED'],
    ['PROMPT_BLOCK', 'subject-1', 'rin-pose-arm-support', 'MAPPED'],
    ['PROMPT_BLOCK', 'subject-1', 'rin-pose-reclining', 'MAPPED'],
    ['PROMPT_BLOCK', 'subject-1', 'v192-bent-knees', 'MAPPED'],
    ['PROMPT_BLOCK', 'subject-1', 'pos-lying-on-back', 'MAPPED'],
    ['SCENE', 'scene', 'bac-forest', 'UNMAPPED'],
  ], 'inspection must preserve projection ownership and input ordering')
  deepEqual([report.entries[4].concept_id, report.entries[4].concept_status, report.entries[4].diagnostic], ['body.orientation.face_up', 'provisional', null], 'face-up orientation must remain exact in inspection output')
  equal(serializeVisualConceptReadOnlyInspectionReportV1(report), serializeVisualConceptReadOnlyInspectionReportV1(report), 'identical reports must serialize to byte-identical JSON')

  const rejectedProjection = createVisualConceptReadOnlyEntryAdapterV1({ bindingContract, graphContract, promptTagRegistry: registry })({ blocks: null, sceneTags: [] })
  const rejectedReport = projectVisualConceptReadOnlyInspectionReportV1({ projection: rejectedProjection, bindingContract, promptTagRegistry: registry })
  equal(rejectedReport.projection_status, 'REJECTED', 'adapter rejection must remain visible in the inspection report')
  equal(rejectedReport.rejection_reason, 'projection_input_invalid', 'existing closed adapter rejection reasons must pass through unchanged')
  deepEqual(rejectedReport.summary, { mapped_count: 0, unmapped_count: 0, rejected_count: 1 }, 'rejected inspection must report exactly one rejected projection')
  equal(rejectedReport.coverage, null, 'rejected contracts must not emit a coverage claim')

  const inputFile = path.join(temporaryDirectory, 'input.json')
  fs.writeFileSync(inputFile, JSON.stringify(input), 'utf8')
  const cli = spawnSync(process.execPath, [path.join(repoRoot, 'scripts', 'inspect-visual-concept-read-only-v1.mjs'), '--input-file', inputFile], { cwd: repoRoot, encoding: 'utf8' })
  equal(cli.status, 0, 'CLI must succeed for valid production-shaped input')
  equal(cli.stderr, '', 'successful CLI must not write diagnostics to stderr')
  const cliReport = JSON.parse(cli.stdout)
  deepEqual(cliReport, report, 'CLI must use the same projection/report owners')
  equal(cli.stdout, serializeVisualConceptReadOnlyInspectionReportV1(report), 'CLI stdout must be one byte-stable compact JSON report')
  deepEqual(fs.readdirSync(temporaryDirectory), ['input.json'], 'inspection CLI must not mutate the filesystem')

  console.log(`Visual Concept read-only inspection tests passed: ${assertionCount} assertions`)
} finally {
  await server.close()
  fs.rmSync(temporaryDirectory, { recursive: true, force: true })
}
