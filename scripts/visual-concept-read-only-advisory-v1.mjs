import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'

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

const RELATION_ALLOWLIST_ROOT_KEYS = [
  'record_type',
  'version',
  'graph_source',
  'graph_schema_source',
  'graph_schema_id',
  'graph_schema_version',
  'graph_version',
  'relations',
]

const ALLOWLIST_RELATION_KEYS = [
  'relation_id',
  'relation_type',
  'source_concept_id',
  'target_concept_id',
  'direction',
  'status',
  'strength',
  'confidence',
  'model_profile',
  'evidence_refs',
]

const GRAPH_ROOT_KEYS = [
  'schema_version',
  'graph_version',
  'generated_at',
  'source_files',
  'concepts',
  'relations',
  'target_patterns',
  'unmodeled_effects',
  'model_profiles',
  'intent_profiles',
  'control_context_profiles',
  'indexes',
]

const GRAPH_RELATION_REQUIRED_KEYS = [
  'relation_id',
  'relation_type',
  'source_concept_id',
  'target_concept_id',
  'direction',
  'strength',
  'confidence',
  'status',
]

const GRAPH_RELATION_KEYS = [
  ...GRAPH_RELATION_REQUIRED_KEYS,
  'context',
  'model_profile',
  'evidence_refs',
  'notes',
]

const EVIDENCE_REQUIRED_KEYS = [
  'evidence_ref_id',
  'run_id',
  'observation_path',
  'metric',
  'confidence',
  'storage',
]

const EVIDENCE_KEYS = [
  ...EVIDENCE_REQUIRED_KEYS,
  'research_packet_path',
  'count',
  'total',
  'notes',
]

const RELATION_TYPES = new Set([
  'supports', 'contacts', 'positioned_relative_to', 'covers', 'obscures',
  'increases_visibility', 'decreases_visibility', 'biases', 'strengthens',
  'weakens', 'conflicts_with', 'requires', 'implies', 'may_trigger',
  'observed_as', 'candidate_interpretation',
])

const CONFIDENCE_VALUES = new Set(['low', 'medium', 'high', 'unknown'])
const STATUS_VALUES = new Set(['draft', 'provisional', 'confirmed', 'deprecated', 'rejected'])

const AUTHORIZED_RELATION = Object.freeze({
  relation_id: 'relation.rear_arm_support.biases.reclined',
  relation_type: 'biases',
  source_concept_id: 'support.arm.rearward',
  target_concept_id: 'body.state.reclined',
  direction: 'directed',
  status: 'provisional',
  strength: 'high',
  confidence: 'high',
  model_profile: 'model.novaanimexl_ilv190',
  evidence_ref_id: 'evidence.brg007b.reclined_arm_support',
  run_id: 'BRG-007-B',
  evidence_confidence: 'high',
  storage: 'local',
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

function hasOnlyKeys(value, allowed) {
  return isRecord(value) && Object.keys(value).every(key => allowed.includes(key))
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

function validNonEmptyStringSet(value) {
  return Array.isArray(value)
    && new Set(value).size === value.length
    && value.every(item => typeof item === 'string' && item.length > 0)
}

function validGraphEvidenceRef(evidence) {
  if (!hasOnlyKeys(evidence, EVIDENCE_KEYS)
    || !EVIDENCE_REQUIRED_KEYS.every(key => Object.hasOwn(evidence, key))
    || typeof evidence.evidence_ref_id !== 'string' || !/^evidence\.[a-z0-9._-]+$/.test(evidence.evidence_ref_id)
    || typeof evidence.run_id !== 'string' || !evidence.run_id
    || typeof evidence.observation_path !== 'string' || !evidence.observation_path
    || typeof evidence.metric !== 'string' || !evidence.metric
    || !CONFIDENCE_VALUES.has(evidence.confidence)
    || (evidence.storage !== 'local' && evidence.storage !== 'external')) return false
  if (Object.hasOwn(evidence, 'research_packet_path') && (typeof evidence.research_packet_path !== 'string' || !evidence.research_packet_path)) return false
  if (Object.hasOwn(evidence, 'count') !== Object.hasOwn(evidence, 'total')) return false
  if (Object.hasOwn(evidence, 'count') && (!isNonNegativeInteger(evidence.count) || !Number.isInteger(evidence.total) || evidence.total < 1)) return false
  return !Object.hasOwn(evidence, 'notes') || validNonEmptyStringSet(evidence.notes)
}

function validGraphRelation(relation) {
  return hasOnlyKeys(relation, GRAPH_RELATION_KEYS)
    && GRAPH_RELATION_REQUIRED_KEYS.every(key => Object.hasOwn(relation, key))
    && typeof relation.relation_id === 'string' && /^relation\.[a-z0-9._-]+$/.test(relation.relation_id)
    && RELATION_TYPES.has(relation.relation_type)
    && typeof relation.source_concept_id === 'string' && relation.source_concept_id.length > 0
    && typeof relation.target_concept_id === 'string' && relation.target_concept_id.length > 0
    && (relation.direction === 'directed' || relation.direction === 'symmetric')
    && CONFIDENCE_VALUES.has(relation.strength)
    && CONFIDENCE_VALUES.has(relation.confidence)
    && STATUS_VALUES.has(relation.status)
    && (!Object.hasOwn(relation, 'context') || (typeof relation.context === 'string' && relation.context.length > 0))
    && (!Object.hasOwn(relation, 'model_profile') || (typeof relation.model_profile === 'string' && relation.model_profile.length > 0))
    && (!Object.hasOwn(relation, 'evidence_refs') || (Array.isArray(relation.evidence_refs) && relation.evidence_refs.every(validGraphEvidenceRef)))
    && (!Object.hasOwn(relation, 'notes') || validNonEmptyStringSet(relation.notes))
}

function sameArray(left, right) {
  return Array.isArray(left)
    && left.length === right.length
    && left.every((value, index) => value === right[index])
}

function validRelationIndex(index, relations, endpointKey) {
  if (!isRecord(index)) return false
  const expected = new Map()
  for (const relation of relations) {
    const endpoint = relation[endpointKey]
    expected.set(endpoint, [...(expected.get(endpoint) ?? []), relation.relation_id])
  }
  const expectedKeys = [...expected.keys()].sort()
  if (!sameArray(Object.keys(index).sort(), expectedKeys)) return false
  return expectedKeys.every(key => sameArray(index[key], [...expected.get(key)].sort()))
}

function validateRelationAllowlist(value) {
  if (!hasExactKeys(value, RELATION_ALLOWLIST_ROOT_KEYS)
    || value.record_type !== 'visual_concept_advisory_relation_allowlist_v1'
    || value.version !== 1
    || value.graph_source !== SOURCE_BINDING_CONSTANTS.graph_source
    || value.graph_schema_source !== SOURCE_BINDING_CONSTANTS.graph_schema_source
    || value.graph_schema_id !== SOURCE_BINDING_CONSTANTS.graph_schema_id
    || value.graph_schema_version !== SOURCE_BINDING_CONSTANTS.graph_schema_version
    || value.graph_version !== SOURCE_BINDING_CONSTANTS.graph_version
    || !Array.isArray(value.relations)
    || value.relations.length !== 1) return 'advisory_relation_contract_invalid'

  const relation = value.relations[0]
  if (!hasExactKeys(relation, ALLOWLIST_RELATION_KEYS)
    || !Array.isArray(relation.evidence_refs)
    || relation.evidence_refs.length !== 1
    || !hasExactKeys(relation.evidence_refs[0], ['evidence_ref_id', 'run_id', 'confidence', 'storage'])) return 'advisory_relation_contract_invalid'
  const evidence = relation.evidence_refs[0]
  if (relation.relation_id !== AUTHORIZED_RELATION.relation_id
    || relation.relation_type !== AUTHORIZED_RELATION.relation_type
    || relation.source_concept_id !== AUTHORIZED_RELATION.source_concept_id
    || relation.target_concept_id !== AUTHORIZED_RELATION.target_concept_id
    || relation.direction !== AUTHORIZED_RELATION.direction
    || relation.status !== AUTHORIZED_RELATION.status
    || relation.strength !== AUTHORIZED_RELATION.strength
    || relation.confidence !== AUTHORIZED_RELATION.confidence
    || relation.model_profile !== AUTHORIZED_RELATION.model_profile
    || evidence.evidence_ref_id !== AUTHORIZED_RELATION.evidence_ref_id
    || evidence.run_id !== AUTHORIZED_RELATION.run_id
    || evidence.confidence !== AUTHORIZED_RELATION.evidence_confidence
    || evidence.storage !== AUTHORIZED_RELATION.storage) return 'advisory_relation_contract_invalid'
  return relation
}

function validateRelationGraph(graphContract, allowlistedRelation) {
  if (!hasExactKeys(graphContract, GRAPH_ROOT_KEYS)
    || graphContract.schema_version !== SOURCE_BINDING_CONSTANTS.graph_schema_version
    || graphContract.graph_version !== SOURCE_BINDING_CONSTANTS.graph_version
    || !Array.isArray(graphContract.concepts)
    || !Array.isArray(graphContract.target_patterns)
    || !Array.isArray(graphContract.model_profiles)
    || !Array.isArray(graphContract.relations)
    || !isRecord(graphContract.indexes)) return 'advisory_relation_contract_invalid'

  const conceptIds = graphContract.concepts.map(concept => concept?.concept_id)
  const patternIds = graphContract.target_patterns.map(pattern => pattern?.target_pattern_id)
  const modelProfileIds = graphContract.model_profiles.map(profile => profile?.model_profile_id)
  if (conceptIds.some(id => typeof id !== 'string' || !id)
    || patternIds.some(id => typeof id !== 'string' || !id)
    || modelProfileIds.some(id => typeof id !== 'string' || !id)
    || new Set(conceptIds).size !== conceptIds.length
    || new Set(patternIds).size !== patternIds.length
    || new Set(modelProfileIds).size !== modelProfileIds.length
    || !graphContract.relations.every(validGraphRelation)) return 'advisory_relation_contract_invalid'

  const relationIds = graphContract.relations.map(relation => relation.relation_id)
  if (new Set(relationIds).size !== relationIds.length) return 'advisory_relation_identity_conflict'
  if (relationIds.some((id, index) => index > 0 && relationIds[index - 1].localeCompare(id) >= 0)) return 'advisory_relation_contract_invalid'

  const endpointIds = new Set([...conceptIds, ...patternIds])
  const modelProfiles = new Set(modelProfileIds)
  if (graphContract.relations.some(relation => !endpointIds.has(relation.source_concept_id)
    || !endpointIds.has(relation.target_concept_id)
    || (Object.hasOwn(relation, 'model_profile') && !modelProfiles.has(relation.model_profile)))) return 'advisory_relation_contract_invalid'
  if (!validRelationIndex(graphContract.indexes.relations_by_source, graphContract.relations, 'source_concept_id')
    || !validRelationIndex(graphContract.indexes.relations_by_target, graphContract.relations, 'target_concept_id')) return 'advisory_relation_contract_invalid'

  if (!conceptIds.includes(allowlistedRelation.source_concept_id) || !conceptIds.includes(allowlistedRelation.target_concept_id)) return 'advisory_relation_contract_invalid'
  const admitted = graphContract.relations.find(relation => relation.relation_id === allowlistedRelation.relation_id)
  if (!admitted) return 'advisory_relation_contract_invalid'
  const fields = ['relation_id', 'relation_type', 'source_concept_id', 'target_concept_id', 'direction', 'status', 'strength', 'confidence', 'model_profile']
  if (fields.some(field => admitted[field] !== allowlistedRelation[field])) return 'advisory_relation_contract_invalid'
  if (!Array.isArray(admitted.evidence_refs) || admitted.evidence_refs.length !== allowlistedRelation.evidence_refs.length) return 'advisory_relation_contract_invalid'
  for (let index = 0; index < allowlistedRelation.evidence_refs.length; index += 1) {
    const expected = allowlistedRelation.evidence_refs[index]
    const actual = admitted.evidence_refs[index]
    if (actual.evidence_ref_id !== expected.evidence_ref_id
      || actual.run_id !== expected.run_id
      || actual.confidence !== expected.confidence
      || actual.storage !== expected.storage) return 'advisory_relation_contract_invalid'
  }
  return { admitted, relations: graphContract.relations }
}

function acquireRelationAdmission(dependencies) {
  if (!isRecord(dependencies)) return 'advisory_relation_contract_invalid'
  const allowlistedRelation = validateRelationAllowlist(dependencies.relationAllowlist)
  if (typeof allowlistedRelation === 'string') return allowlistedRelation
  return validateRelationGraph(dependencies.graphContract, allowlistedRelation)
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

export function projectVisualConceptReadOnlyAdvisoryV1(inspectionReport, dependencies) {
  if (!validateInspectionReport(inspectionReport)) return rejected('advisory_input_invalid')
  if (inspectionReport.projection_status === 'REJECTED') return rejected(inspectionReport.rejection_reason)

  const relationAdmission = acquireRelationAdmission(dependencies)
  if (typeof relationAdmission === 'string') return rejected(relationAdmission)

  const mappedConcepts = []
  const mappedById = new Map()
  const unmappedTags = []
  const diagnosticReasons = []
  const diagnosticByReason = new Map()
  const mappedEntriesByConcept = new Map()

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
      mappedEntriesByConcept.set(entry.concept_id, [...(mappedEntriesByConcept.get(entry.concept_id) ?? []), entry])
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

  const relations = []
  const admittedRelation = relationAdmission.admitted
  const sourceEntries = mappedEntriesByConcept.get(admittedRelation.source_concept_id) ?? []
  const targetEntries = mappedEntriesByConcept.get(admittedRelation.target_concept_id) ?? []
  if (sourceEntries.length === 1 && targetEntries.length === 1) {
    const source = sourceEntries[0]
    const target = targetEntries[0]
    if (source.owner_kind === target.owner_kind && source.owner_id === target.owner_id) {
      const parallel = relationAdmission.relations.filter(relation => relation.source_concept_id === admittedRelation.source_concept_id
        && relation.target_concept_id === admittedRelation.target_concept_id)
      if (parallel.length !== 1) return rejected('advisory_relation_identity_conflict')
      relations.push(Object.freeze({
        record_type: 'visual_concept_advisory_relation_v1',
        relation_id: admittedRelation.relation_id,
        relation_type: admittedRelation.relation_type,
        direction: admittedRelation.direction,
        source: Object.freeze({ concept_id: source.concept_id, owner_kind: source.owner_kind, owner_id: source.owner_id, prompt_tag_id: source.prompt_tag_id }),
        target: Object.freeze({ concept_id: target.concept_id, owner_kind: target.owner_kind, owner_id: target.owner_id, prompt_tag_id: target.prompt_tag_id }),
        relation_status: admittedRelation.status,
        strength: admittedRelation.strength,
        confidence: admittedRelation.confidence,
        model_profile: admittedRelation.model_profile,
        evidence_refs: Object.freeze(admittedRelation.evidence_refs.map(evidence => Object.freeze({
          evidence_ref_id: evidence.evidence_ref_id,
          run_id: evidence.run_id,
          confidence: evidence.confidence,
          storage: evidence.storage,
        }))),
      }))
    }
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
    relations: Object.freeze(relations.sort((left, right) => left.relation_id.localeCompare(right.relation_id))),
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
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
  const repoRoot = path.resolve(scriptDirectory, '..')
  const relationAllowlist = JSON.parse(fs.readFileSync(path.join(repoRoot, 'data', 'visual-concept-advisory-relation-allowlist-v1.json'), 'utf8'))
  const graphContract = JSON.parse(fs.readFileSync(path.join(repoRoot, 'research', 'sd-prompt-research', 'dist', 'visual-concept-graph.json'), 'utf8'))
  const advisory = projectVisualConceptReadOnlyAdvisoryV1(inspectionReport, { relationAllowlist, graphContract })
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
