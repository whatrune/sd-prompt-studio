import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createServer } from 'vite'
import { createVisualConceptReadOnlyEntryAdapterV1 } from './visual-concept-read-only-entry-adapter-v1.mjs'

const REPORT_RECORD_TYPE = 'visual_concept_read_only_inspection_report_v1'

function sourceBindingFrom(bindingContract) {
  return Object.freeze({
    binding_record_type: bindingContract.record_type,
    binding_version: bindingContract.version,
    graph_source: bindingContract.graph_source,
    graph_schema_source: bindingContract.graph_schema_source,
    graph_schema_id: bindingContract.graph_schema_id,
    graph_schema_version: bindingContract.graph_schema_version,
    graph_version: bindingContract.graph_version,
  })
}

export function projectVisualConceptReadOnlyInspectionReportV1({ projection, bindingContract, promptTagRegistry }) {
  if (projection.status === 'REJECTED') {
    return Object.freeze({
      record_type: REPORT_RECORD_TYPE,
      version: 1,
      projection_status: 'REJECTED',
      rejection_reason: projection.reason,
      summary: Object.freeze({ mapped_count: 0, unmapped_count: 0, rejected_count: 1 }),
      coverage: null,
      source_binding: null,
      entries: Object.freeze([]),
    })
  }

  const bindingIds = new Set(bindingContract.bindings.map(binding => binding.prompt_tag_id))
  const mappedCount = projection.entries.filter(entry => entry.mapping_status === 'MAPPED').length
  const unmappedCount = projection.entries.length - mappedCount
  const mappedActivePromptTagCount = promptTagRegistry.filter(tag => bindingIds.has(tag.id)).length

  return Object.freeze({
    record_type: REPORT_RECORD_TYPE,
    version: 1,
    projection_status: 'PROJECTED',
    rejection_reason: null,
    summary: Object.freeze({ mapped_count: mappedCount, unmapped_count: unmappedCount, rejected_count: 0 }),
    coverage: Object.freeze({
      explicit_binding_count: bindingContract.bindings.length,
      active_prompt_tag_count: promptTagRegistry.length,
      mapped_active_prompt_tag_count: mappedActivePromptTagCount,
      unmapped_active_prompt_tag_count: promptTagRegistry.length - mappedActivePromptTagCount,
    }),
    source_binding: sourceBindingFrom(bindingContract),
    entries: projection.entries,
  })
}

export function serializeVisualConceptReadOnlyInspectionReportV1(report) {
  return `${JSON.stringify(report)}\n`
}

function parseArguments(argv) {
  if (argv.length !== 2 || argv[0] !== '--input-file' || typeof argv[1] !== 'string' || argv[1].length === 0) {
    throw new Error('visual_concept_inspection_arguments_invalid')
  }
  return Object.freeze({ inputFile: argv[1] })
}

async function acquireProductionPromptTagRegistryV1(repoRoot) {
  const server = await createServer({
    root: repoRoot,
    configFile: false,
    logLevel: 'silent',
    server: { middlewareMode: true },
    appType: 'custom',
  })
  try {
    const [{ tags }, { adultTags }] = await Promise.all([
      server.ssrLoadModule('/src/data/tags.ts'),
      server.ssrLoadModule('/src/data/adultTags.ts'),
    ])
    return Object.freeze([...tags, ...adultTags])
  } finally {
    await server.close()
  }
}

export async function runVisualConceptReadOnlyInspectionCliV1(argv, output = process.stdout) {
  const { inputFile } = parseArguments(argv)
  let input
  try {
    input = JSON.parse(fs.readFileSync(inputFile, 'utf8'))
  } catch {
    throw new Error('visual_concept_inspection_input_invalid')
  }

  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
  const repoRoot = path.resolve(scriptDirectory, '..')
  const bindingContract = JSON.parse(fs.readFileSync(path.join(repoRoot, 'data', 'visual-concept-prompt-tag-bindings-v1.json'), 'utf8'))
  const graphContract = JSON.parse(fs.readFileSync(path.join(repoRoot, 'research', 'sd-prompt-research', 'dist', 'visual-concept-graph.json'), 'utf8'))
  const promptTagRegistry = await acquireProductionPromptTagRegistryV1(repoRoot)
  const projection = createVisualConceptReadOnlyEntryAdapterV1({ bindingContract, graphContract, promptTagRegistry })(input)
  const report = projectVisualConceptReadOnlyInspectionReportV1({ projection, bindingContract, promptTagRegistry })
  output.write(serializeVisualConceptReadOnlyInspectionReportV1(report))
  return report.projection_status === 'PROJECTED' ? 0 : 1
}

const isDirectInvocation = process.argv[1]
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url

if (isDirectInvocation) {
  try {
    process.exitCode = await runVisualConceptReadOnlyInspectionCliV1(process.argv.slice(2))
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : 'visual_concept_inspection_failed'}\n`)
    process.exitCode = 1
  }
}
