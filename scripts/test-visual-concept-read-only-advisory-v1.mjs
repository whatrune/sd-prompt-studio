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
const relationAllowlist = JSON.parse(fs.readFileSync(path.join(repoRoot, 'data', 'visual-concept-advisory-relation-allowlist-v1.json'), 'utf8'))
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
  const armSupport = selected('rin-pose-arm-support')
  const reclining = selected('rin-pose-reclining')
  const longHair = selected('hai-long-hair')
  const custom = { id: 'custom-advisory-tag', label: 'Custom', prompt: 'custom advisory tag', category: 'pose', weight: 1 }
  const input = {
    blocks: [
      { id: 'subject-1', name: 'Subject 1', tags: [selected('pos-lying'), selected('rin-pose-arm-support'), selected('pos-lying'), longHair] },
      { id: 'subject-2', name: 'Subject 2', tags: [selected('rin-pose-reclining'), selected('v192-bent-knees'), custom] },
    ],
    sceneTags: [selected('bac-forest'), selected('pos-lying-on-back')],
  }
  const inspectionFor = projectedInput => projectVisualConceptReadOnlyInspectionReportV1({
    projection: createVisualConceptReadOnlyEntryAdapterV1({ bindingContract, graphContract, promptTagRegistry: registry })(projectedInput),
    bindingContract,
    promptTagRegistry: registry,
  })
  const advisoryFor = (report, allowlist = relationAllowlist, graph = graphContract) => projectVisualConceptReadOnlyAdvisoryV1(report, { relationAllowlist: allowlist, graphContract: graph })
  const inspection = inspectionFor(input)
  const advisory = advisoryFor(inspection)

  equal(advisory.advisory_status, 'READY', 'valid inspection must produce a ready advisory')
  equal(advisory.rejection_reason, null, 'ready advisory must not carry a rejection reason')
  deepEqual(advisory.projection_summary, { mapped_count: 7, unmapped_count: 2, rejected_count: 0 }, 'projection summary must reflect the exact sixth explicit mapping')
  deepEqual(advisory.mapped_concepts.map(concept => [concept.concept_id, concept.concept_status, concept.occurrences.length]), [
    ['body.state.lying', 'provisional', 2],
    ['support.arm.rearward', 'provisional', 1],
    ['hair.long', 'provisional', 1],
    ['body.state.reclined', 'provisional', 1],
    ['configuration.knee.bent', 'provisional', 1],
    ['body.orientation.face_up', 'provisional', 1],
  ], 'mapped concepts must preserve first occurrence order and exact status')
  deepEqual(advisory.mapped_concepts[0].occurrences, [
    { owner_kind: 'PROMPT_BLOCK', owner_id: 'subject-1', prompt_tag_id: 'pos-lying' },
    { owner_kind: 'PROMPT_BLOCK', owner_id: 'subject-1', prompt_tag_id: 'pos-lying' },
  ], 'repeated mapped selections must preserve exact ownership and occurrence order')
  deepEqual(advisory.unmapped_tags, [
    { owner_kind: 'PROMPT_BLOCK', owner_id: 'subject-2', prompt_tag_id: 'custom-advisory-tag', diagnostic_reason: 'non_registry_tag_unmapped' },
    { owner_kind: 'SCENE', owner_id: 'scene', prompt_tag_id: 'bac-forest', diagnostic_reason: 'prompt_tag_unmapped' },
  ], 'unmapped tags must preserve projection order and diagnostics')
  deepEqual(advisory.diagnostic_reasons, [
    { reason: 'non_registry_tag_unmapped', count: 1 },
    { reason: 'prompt_tag_unmapped', count: 1 },
  ], 'diagnostic counts must preserve first occurrence order and exact-reason aggregation')
  deepEqual(advisory.relations, [], 'different PromptBlock owners must not create cross-owner relations')
  deepEqual(advisory.source_binding, inspection.source_binding, 'advisory must preserve admitted source identity')
  equal(serializeVisualConceptReadOnlyAdvisoryV1(advisory), serializeVisualConceptReadOnlyAdvisoryV1(advisory), 'identical advisory reports must serialize byte-identically')

  const rejectedInspection = projectVisualConceptReadOnlyInspectionReportV1({
    projection: createVisualConceptReadOnlyEntryAdapterV1({ bindingContract, graphContract, promptTagRegistry: registry })({ blocks: null, sceneTags: [] }),
    bindingContract,
    promptTagRegistry: registry,
  })
  const rejectedAdvisory = advisoryFor(rejectedInspection)
  equal(rejectedAdvisory.advisory_status, 'REJECTED', 'upstream projection rejection must fail closed')
  equal(rejectedAdvisory.rejection_reason, 'projection_input_invalid', 'upstream closed rejection reason must remain unchanged')
  deepEqual(rejectedAdvisory.relations, [], 'rejected advisory must expose no relations')

  const malformed = clone(inspection)
  malformed.extra = true
  equal(advisoryFor(malformed).rejection_reason, 'advisory_input_invalid', 'unknown inspection fields must fail closed')
  const countDrift = clone(inspection)
  countDrift.summary.mapped_count += 1
  equal(advisoryFor(countDrift).rejection_reason, 'advisory_input_invalid', 'projection count drift must fail closed')
  const sourceDrift = clone(inspection)
  sourceDrift.source_binding.graph_version = 'not-a-version'
  equal(advisoryFor(sourceDrift).rejection_reason, 'advisory_input_invalid', 'malformed inspection graph revision must fail closed')
  const nextRevisionInspection = clone(inspection)
  const nextRevisionAllowlist = clone(relationAllowlist)
  const nextRevisionGraph = clone(graphContract)
  nextRevisionInspection.source_binding.graph_version = '0.2.2'
  nextRevisionAllowlist.graph_version = '0.2.2'
  nextRevisionGraph.graph_version = '0.2.2'
  equal(advisoryFor(nextRevisionInspection, nextRevisionAllowlist, nextRevisionGraph).advisory_status, 'READY', 'same-schema next graph revision must preserve exact relation admission')
  const statusDrift = clone(inspection)
  statusDrift.entries[0].concept_status = 'confirmed'
  statusDrift.entries[2].concept_status = 'provisional'
  equal(advisoryFor(statusDrift).rejection_reason, 'advisory_input_invalid', 'conflicting status for one exact concept must fail closed')

  const sameOwnerInspection = inspectionFor({
    blocks: [{ id: 'subject-relation', name: 'Subject', tags: [armSupport, reclining] }],
    sceneTags: [],
  })
  const sameOwnerAdvisory = advisoryFor(sameOwnerInspection)
  equal(sameOwnerAdvisory.relations.length, 1, 'exact unique same-owner endpoints must admit one relation')
  deepEqual(sameOwnerAdvisory.relations[0], {
    record_type: 'visual_concept_advisory_relation_v1',
    relation_id: 'relation.rear_arm_support.biases.reclined',
    relation_type: 'biases',
    direction: 'directed',
    source: { concept_id: 'support.arm.rearward', owner_kind: 'PROMPT_BLOCK', owner_id: 'subject-relation', prompt_tag_id: 'rin-pose-arm-support' },
    target: { concept_id: 'body.state.reclined', owner_kind: 'PROMPT_BLOCK', owner_id: 'subject-relation', prompt_tag_id: 'rin-pose-reclining' },
    relation_status: 'provisional',
    strength: 'high',
    confidence: 'high',
    model_profile: 'model.novaanimexl_ilv190',
    evidence_refs: [{ evidence_ref_id: 'evidence.brg007b.reclined_arm_support', run_id: 'BRG-007-B', confidence: 'high', storage: 'local' }],
  }, 'admitted relation must expose only exact graph fact, ownership, status, and evidence identity')
  deepEqual(advisoryFor(inspectionFor({ blocks: [{ id: 'subject-missing', name: 'Subject', tags: [armSupport] }], sceneTags: [] })).relations, [], 'missing endpoint must omit the relation')
  deepEqual(advisoryFor(inspectionFor({ blocks: [{ id: 'subject-duplicate', name: 'Subject', tags: [armSupport, armSupport, reclining] }], sceneTags: [] })).relations, [], 'duplicate endpoint occurrence must omit the relation')
  deepEqual(advisoryFor(inspectionFor({ blocks: [{ id: 'subject-cross', name: 'Subject', tags: [armSupport] }], sceneTags: [reclining] })).relations, [], 'Scene to PromptBlock endpoints must not create cross-owner relations')
  const sameSceneAdvisory = advisoryFor(inspectionFor({ blocks: [], sceneTags: [armSupport, reclining] }))
  equal(sameSceneAdvisory.relations.length, 1, 'unique endpoints on the exact same Scene owner must admit one relation')
  equal(sameSceneAdvisory.relations[0].source.owner_kind, 'SCENE', 'same-Scene source ownership must remain explicit')

  const duplicateRelationGraph = clone(graphContract)
  duplicateRelationGraph.relations.push(clone(duplicateRelationGraph.relations.find(relation => relation.relation_id === 'relation.rear_arm_support.biases.reclined')))
  equal(advisoryFor(sameOwnerInspection, relationAllowlist, duplicateRelationGraph).rejection_reason, 'advisory_relation_identity_conflict', 'duplicate relation IDs must fail closed')

  const parallelGraph = clone(graphContract)
  const parallelRelation = clone(parallelGraph.relations.find(relation => relation.relation_id === 'relation.rear_arm_support.biases.reclined'))
  parallelRelation.relation_id = 'relation.rear_arm_support.biases.reclined.parallel'
  parallelGraph.relations.push(parallelRelation)
  parallelGraph.relations.sort((left, right) => left.relation_id.localeCompare(right.relation_id))
  parallelGraph.indexes.relations_by_source['support.arm.rearward'].push(parallelRelation.relation_id)
  parallelGraph.indexes.relations_by_source['support.arm.rearward'].sort()
  parallelGraph.indexes.relations_by_target['body.state.reclined'].push(parallelRelation.relation_id)
  parallelGraph.indexes.relations_by_target['body.state.reclined'].sort()
  equal(advisoryFor(sameOwnerInspection, relationAllowlist, parallelGraph).rejection_reason, 'advisory_relation_identity_conflict', 'parallel applicable edges must fail closed')

  for (const [label, mutate] of [
    ['endpoint', value => { value.relations[0].target_concept_id = 'body.state.lying' }],
    ['type', value => { value.relations[0].relation_type = 'requires' }],
    ['status', value => { value.relations[0].status = 'confirmed' }],
    ['evidence', value => { value.relations[0].evidence_refs[0].run_id = 'BRG-OTHER' }],
  ]) {
    const drifted = clone(relationAllowlist)
    mutate(drifted)
    equal(advisoryFor(sameOwnerInspection, drifted).rejection_reason, 'advisory_relation_contract_invalid', `allowlist ${label} drift must fail closed`)
  }
  const compositeAllowlist = clone(relationAllowlist)
  compositeAllowlist.relations[0].relation_id = 'relation.rear_arm_support.observed_as.reclined_pattern'
  compositeAllowlist.relations[0].relation_type = 'observed_as'
  compositeAllowlist.relations[0].target_concept_id = 'pattern.pose.reclined_arm_support'
  equal(advisoryFor(sameOwnerInspection, compositeAllowlist).rejection_reason, 'advisory_relation_contract_invalid', 'composite target-pattern relations must never be admitted')
  equal(serializeVisualConceptReadOnlyAdvisoryV1(sameOwnerAdvisory), serializeVisualConceptReadOnlyAdvisoryV1(advisoryFor(sameOwnerInspection)), 'admitted relation ordering and JSON serialization must be byte-stable')

  const inspectionFile = path.join(temporaryDirectory, 'inspection.json')
  fs.writeFileSync(inspectionFile, JSON.stringify(sameOwnerInspection), 'utf8')
  const cli = spawnSync(process.execPath, [path.join(repoRoot, 'scripts', 'visual-concept-read-only-advisory-v1.mjs'), '--inspection-file', inspectionFile], { cwd: repoRoot, encoding: 'utf8' })
  equal(cli.status, 0, 'CLI must accept a valid inspection report')
  equal(cli.stderr, '', 'successful CLI must not write stderr')
  deepEqual(JSON.parse(cli.stdout), sameOwnerAdvisory, 'CLI must use the same relation-admitting advisory projector')
  equal(cli.stdout, serializeVisualConceptReadOnlyAdvisoryV1(sameOwnerAdvisory), 'CLI must emit one compact byte-stable JSON report')
  deepEqual(fs.readdirSync(temporaryDirectory), ['inspection.json'], 'advisory CLI must not mutate the filesystem')

  console.log(`Visual Concept read-only advisory tests passed: ${assertionCount} assertions`)
} finally {
  await server.close()
  fs.rmSync(temporaryDirectory, { recursive: true, force: true })
}
