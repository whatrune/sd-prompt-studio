import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

const INSPECTION_KEYS = [
  'record_type',
  'version',
  'projection_status',
  'rejection_reason',
  'summary',
  'coverage',
  'source_binding',
  'entries',
]

const ENTRY_KEYS = [
  'record_type',
  'owner_kind',
  'owner_id',
  'prompt_tag_id',
  'mapping_status',
  'concept_id',
  'concept_status',
  'diagnostic',
]

const SOURCE_BINDING_KEYS = [
  'binding_record_type',
  'binding_version',
  'graph_source',
  'graph_schema_source',
  'graph_schema_id',
  'graph_schema_version',
  'graph_version',
]

const UPSTREAM_REJECTION_REASONS = new Set([
  'binding_contract_invalid',
  'binding_identity_conflict',
  'binding_prompt_tag_missing',
  'binding_concept_missing',
  'binding_concept_ambiguous',
  'binding_concept_inadmissible',
  'graph_contract_unsupported',
  'graph_contract_invalid',
  'projection_input_invalid',
])

const UNMAPPED_DIAGNOSTICS = new Set([
  'prompt_tag_unmapped',
  'non_registry_tag_unmapped',
])

const SOURCE_BINDING_CONSTANTS = Object.freeze({
  binding_record_type: 'visual_concept_prompt_tag_bindings_v1',
  binding_version: 1,
  graph_source: 'research/sd-prompt-research/dist/visual-concept-graph.json',
  graph_schema_source: 'research/sd-prompt-research/schemas/visual-concept-graph.schema.json',
  graph_schema_id: 'https://local.sd-prompt-studio/visual-concept-graph-v0.2.schema.json',
  graph_schema_version: '0.2.0',
  graph_version: '0.2.0',
})

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasExactKeys(value, expected) {
  if (!isRecord(value)) return false
  const actual = Object.keys(value).sort()
  const canonical = [...expected].sort()
  return actual.length === canonical.length && actual.every((key, index) => key === canonical[index])
}

function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0
}

function validSummary(summary, expected) {
  return hasExactKeys(summary, ['mapped_count', 'unmapped_count', 'rejected_count'])
    && summary.mapped_count === expected.mapped
    && summary.unmapped_count === expected.unmapped
    && summary.rejected_count === expected.rejected
}

function validCoverage(coverage) {
  if (!hasExactKeys(coverage, [
    'explicit_binding_count',
    'active_prompt_tag_count',
    'mapped_active_prompt_tag_count',
    'unmapped_active_prompt_tag_count',
  ])) return false
  if (!Object.values(coverage).every(isNonNegativeInteger)) return false
  return coverage.mapped_active_prompt_tag_count + coverage.unmapped_active_prompt_tag_count === coverage.active_prompt_tag_count
}

function validSourceBinding(sourceBinding) {
  return hasExactKeys(sourceBinding, SOURCE_BINDING_KEYS)
    && Object.entries(SOURCE_BINDING_CONSTANTS).every(([key, value]) => sourceBinding[key] === value)
}

function validEntry(entry) {
  if (!hasExactKeys(entry, ENTRY_KEYS)
    || entry.record_type !== 'visual_concept_entry_v1'
    || (entry.owner_kind !== 'PROMPT_BLOCK' && entry.owner_kind !== 'SCENE')
    || typeof entry.owner_id !== 'string' || !entry.owner_id
    || typeof entry.prompt_tag_id !== 'string' || !entry.prompt_tag_id) return false

  if (entry.mapping_status === 'MAPPED') {
    return typeof entry.concept_id === 'string' && entry.concept_id.length > 0
      && (entry.concept_status === 'provisional' || entry.concept_status === 'confirmed')
      && entry.diagnostic === null
  }
  return entry.mapping_status === 'UNMAPPED'
    && entry.concept_id === null
    && entry.concept_status === null
    && UNMAPPED_DIAGNOSTICS.has(entry.diagnostic)
}

function validateInspectionReport(report) {
  if (!hasExactKeys(report, INSPECTION_KEYS)
    || report.record_type !== 'visual_concept_read_only_inspection_report_v1'
    || report.version !== 1
    || !Array.isArray(report.entries)) return false

  if (report.projection_status === 'REJECTED') {
    return UPSTREAM_REJECTION_REASONS.has(report.rejection_reason)
      && validSummary(report.summary, { mapped: 0, unmapped: 0, rejected: 1 })
      && report.coverage === null
      && report.source_binding === null
      && report.entries.length === 0
  }
  if (report.projection_status !== 'PROJECTED'
    || report.rejection_reason !== null
    || !validCoverage(report.coverage)
    || !validSourceBinding(report.source_binding)
    || !report.entries.every(validEntry)) return false

  const mapped = report.entries.filter(entry => entry.mapping_status === 'MAPPED').length
  const unmapped = report.entries.length - mapped
  return validSummary(report.summary, { mapped, unmapped, rejected: 0 })
}

function rejected(reason) {
  return Object.freeze({
    record_type: 'visual_concept_read_only_advisory_v1',
    version: 1,
    advisory_status: 'REJECTED',
    rejection_reason: reason,
    projection_summary: Object.freeze({ mapped_count: 0, unmapped_count: 0, rejected_count: 1 }),
    source_binding: null,
    mapped_concepts: Object.freeze([]),
    unmapped_tags: Object.freeze([]),
    relations: Object.freeze([]),
    diagnostic_reasons: Object.freeze([]),
  })
}

export function projectVisualConceptReadOnlyAdvisoryV1(inspectionReport) {
  if (!validateInspectionReport(inspectionReport)) return rejected('advisory_input_invalid')
  if (inspectionReport.projection_status === 'REJECTED') return rejected(inspectionReport.rejection_reason)

  const mappedConcepts = []
  const mappedById = new Map()
  const unmappedTags = []
  const diagnosticReasons = []
  const diagnosticByReason = new Map()

  for (const entry of inspectionReport.entries) {
    if (entry.mapping_status === 'MAPPED') {
      let concept = mappedById.get(entry.concept_id)
      if (!concept) {
        concept = {
          concept_id: entry.concept_id,
          concept_status: entry.concept_status,
          occurrences: [],
        }
        mappedById.set(entry.concept_id, concept)
        mappedConcepts.push(concept)
      } else if (concept.concept_status !== entry.concept_status) {
        return rejected('advisory_input_invalid')
      }
      concept.occurrences.push(Object.freeze({
        owner_kind: entry.owner_kind,
        owner_id: entry.owner_id,
        prompt_tag_id: entry.prompt_tag_id,
      }))
      continue
    }

    unmappedTags.push(Object.freeze({
      owner_kind: entry.owner_kind,
      owner_id: entry.owner_id,
      prompt_tag_id: entry.prompt_tag_id,
      diagnostic_reason: entry.diagnostic,
    }))
    let diagnostic = diagnosticByReason.get(entry.diagnostic)
    if (!diagnostic) {
      diagnostic = { reason: entry.diagnostic, count: 0 }
      diagnosticByReason.set(entry.diagnostic, diagnostic)
      diagnosticReasons.push(diagnostic)
    }
    diagnostic.count += 1
  }

  return Object.freeze({
    record_type: 'visual_concept_read_only_advisory_v1',
    version: 1,
    advisory_status: 'READY',
    rejection_reason: null,
    projection_summary: Object.freeze({ ...inspectionReport.summary }),
    source_binding: Object.freeze({ ...inspectionReport.source_binding }),
    mapped_concepts: Object.freeze(mappedConcepts.map(concept => Object.freeze({
      concept_id: concept.concept_id,
      concept_status: concept.concept_status,
      occurrences: Object.freeze(concept.occurrences),
    }))),
    unmapped_tags: Object.freeze(unmappedTags),
    relations: Object.freeze([]),
    diagnostic_reasons: Object.freeze(diagnosticReasons.map(diagnostic => Object.freeze({ ...diagnostic }))),
  })
}

export function serializeVisualConceptReadOnlyAdvisoryV1(advisory) {
  return `${JSON.stringify(advisory)}\n`
}

function parseArguments(argv) {
  if (argv.length !== 2 || argv[0] !== '--inspection-file' || typeof argv[1] !== 'string' || !argv[1]) {
    throw new Error('visual_concept_advisory_arguments_invalid')
  }
  return argv[1]
}

export function runVisualConceptReadOnlyAdvisoryCliV1(argv, output = process.stdout) {
  const inspectionFile = parseArguments(argv)
  let inspectionReport
  try {
    inspectionReport = JSON.parse(fs.readFileSync(inspectionFile, 'utf8'))
  } catch {
    throw new Error('visual_concept_advisory_input_invalid')
  }
  const advisory = projectVisualConceptReadOnlyAdvisoryV1(inspectionReport)
  output.write(serializeVisualConceptReadOnlyAdvisoryV1(advisory))
  return advisory.advisory_status === 'READY' ? 0 : 1
}

const isDirectInvocation = process.argv[1]
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url

if (isDirectInvocation) {
  try {
    process.exitCode = runVisualConceptReadOnlyAdvisoryCliV1(process.argv.slice(2))
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : 'visual_concept_advisory_failed'}\n`)
    process.exitCode = 1
  }
}
