import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createServer } from 'vite'
import { createVisualConceptReadOnlyEntryAdapterV1 } from './visual-concept-read-only-entry-adapter-v1.mjs'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
let assertionCount = 0
const equal = (actual, expected, message) => { assertionCount += 1; assert.equal(actual, expected, message) }
const deepEqual = (actual, expected, message) => { assertionCount += 1; assert.deepEqual(actual, expected, message) }

const clone = value => structuredClone(value)
const bindingContract = JSON.parse(fs.readFileSync(new URL('../data/visual-concept-prompt-tag-bindings-v1.json', import.meta.url), 'utf8'))
const graphContract = JSON.parse(fs.readFileSync(new URL('../research/sd-prompt-research/dist/visual-concept-graph.json', import.meta.url), 'utf8'))

try {
  const [{ tags }, { adultTags }, { buildPrompt }] = await Promise.all([
    server.ssrLoadModule('/src/data/tags.ts'),
    server.ssrLoadModule('/src/data/adultTags.ts'),
    server.ssrLoadModule('/src/prompt.ts'),
  ])
  const registry = [...tags, ...adultTags]
  const projectVisualConceptReadOnlyEntryV1 = createVisualConceptReadOnlyEntryAdapterV1({ bindingContract, graphContract, promptTagRegistry: registry })
  const selected = id => ({ ...registry.find(tag => tag.id === id), weight: 1 })
  const lying = selected('pos-lying')
  const armSupport = selected('rin-pose-arm-support')
  const reclining = selected('rin-pose-reclining')
  const bentKnees = selected('v192-bent-knees')
  const lyingOnBack = selected('pos-lying-on-back')
  const lyingOnStomach = selected('pos-lying-on-stomach')
  const sidewaysLying = selected('pos-sideways-lying')
  const lyingOnSide = selected('pos-v5-lying-on-side')
  const forest = selected('bac-forest')
  const deprecated = { id: 'rin-pose-on-back', label: '仰向け', prompt: 'on back', category: 'pose', subcategory: '基本姿勢', weight: 1 }
  const custom = { id: 'custom-library-entry', label: 'Custom', prompt: 'custom library entry', category: 'pose', subcategory: 'カスタム', weight: 1 }
  const input = {
    blocks: [
      { id: 'subject-1', name: 'Subject 1', tags: [lying, armSupport, reclining, bentKnees, lyingOnBack] },
      { id: 'subject-2', name: 'Subject 2', tags: [lyingOnStomach, sidewaysLying, lyingOnSide, custom, deprecated] },
    ],
    sceneTags: [forest],
  }

  equal(Object.keys(bindingContract).length, 8, 'binding root must contain exactly eight fields')
  deepEqual(Object.keys(bindingContract), ['record_type', 'version', 'graph_source', 'graph_schema_source', 'graph_schema_id', 'graph_schema_version', 'graph_version', 'bindings'], 'binding root field order must remain frozen')
  deepEqual(bindingContract.bindings, [
    { prompt_tag_id: 'pos-lying', concept_id: 'body.state.lying' },
    { prompt_tag_id: 'pos-lying-on-back', concept_id: 'body.orientation.face_up' },
    { prompt_tag_id: 'rin-pose-arm-support', concept_id: 'support.arm.rearward' },
    { prompt_tag_id: 'rin-pose-reclining', concept_id: 'body.state.reclined' },
    { prompt_tag_id: 'v192-bent-knees', concept_id: 'configuration.knee.bent' },
  ], 'binding slice must remain lexically ordered and explicit')

  const projection = projectVisualConceptReadOnlyEntryV1(input)
  equal(projection.status, 'PROJECTED', 'valid production contracts must project')
  equal(projection.reason, null, 'successful projection must not carry a rejection reason')
  deepEqual(projection.entries.map(entry => [entry.owner_kind, entry.owner_id, entry.prompt_tag_id]), [
    ['PROMPT_BLOCK', 'subject-1', 'pos-lying'],
    ['PROMPT_BLOCK', 'subject-1', 'rin-pose-arm-support'],
    ['PROMPT_BLOCK', 'subject-1', 'rin-pose-reclining'],
    ['PROMPT_BLOCK', 'subject-1', 'v192-bent-knees'],
    ['PROMPT_BLOCK', 'subject-1', 'pos-lying-on-back'],
    ['PROMPT_BLOCK', 'subject-2', 'pos-lying-on-stomach'],
    ['PROMPT_BLOCK', 'subject-2', 'pos-sideways-lying'],
    ['PROMPT_BLOCK', 'subject-2', 'pos-v5-lying-on-side'],
    ['PROMPT_BLOCK', 'subject-2', 'custom-library-entry'],
    ['PROMPT_BLOCK', 'subject-2', 'rin-pose-on-back'],
    ['SCENE', 'scene', 'bac-forest'],
  ], 'block, tag, and Scene order must preserve production input order')
  deepEqual(projection.entries[0], {
    record_type: 'visual_concept_entry_v1',
    owner_kind: 'PROMPT_BLOCK',
    owner_id: 'subject-1',
    prompt_tag_id: 'pos-lying',
    mapping_status: 'MAPPED',
    concept_id: 'body.state.lying',
    concept_status: 'provisional',
    diagnostic: null,
  }, 'pos-lying must map exactly to body.state.lying with PromptBlock ownership')
  deepEqual(projection.entries[1], {
    record_type: 'visual_concept_entry_v1', owner_kind: 'PROMPT_BLOCK', owner_id: 'subject-1', prompt_tag_id: 'rin-pose-arm-support', mapping_status: 'MAPPED', concept_id: 'support.arm.rearward', concept_status: 'provisional', diagnostic: null,
  }, 'arm support must map exactly to rearward arm support')
  deepEqual(projection.entries[2], {
    record_type: 'visual_concept_entry_v1', owner_kind: 'PROMPT_BLOCK', owner_id: 'subject-1', prompt_tag_id: 'rin-pose-reclining', mapping_status: 'MAPPED', concept_id: 'body.state.reclined', concept_status: 'provisional', diagnostic: null,
  }, 'reclining must map exactly to the reclined body state')
  deepEqual(projection.entries[3], {
    record_type: 'visual_concept_entry_v1', owner_kind: 'PROMPT_BLOCK', owner_id: 'subject-1', prompt_tag_id: 'v192-bent-knees', mapping_status: 'MAPPED', concept_id: 'configuration.knee.bent', concept_status: 'provisional', diagnostic: null,
  }, 'bent knees must map exactly to the bent-knee configuration')
  deepEqual(projection.entries[4], {
    record_type: 'visual_concept_entry_v1', owner_kind: 'PROMPT_BLOCK', owner_id: 'subject-1', prompt_tag_id: 'pos-lying-on-back', mapping_status: 'MAPPED', concept_id: 'body.orientation.face_up', concept_status: 'provisional', diagnostic: null,
  }, 'lying on back must map exactly to face-up orientation without inferring a body state')
  deepEqual(projection.entries.slice(5, 8).map(entry => [entry.prompt_tag_id, entry.mapping_status, entry.diagnostic]), [
    ['pos-lying-on-stomach', 'UNMAPPED', 'prompt_tag_unmapped'],
    ['pos-sideways-lying', 'UNMAPPED', 'prompt_tag_unmapped'],
    ['pos-v5-lying-on-side', 'UNMAPPED', 'prompt_tag_unmapped'],
  ], 'related but unbound orientation tags must remain explicitly unmapped')
  equal(projection.entries[8].diagnostic, 'non_registry_tag_unmapped', 'custom IDs must remain explicitly unmapped without inference')
  equal(projection.entries[9].diagnostic, 'non_registry_tag_unmapped', 'deprecated IDs must remain unmapped without following redirects')
  deepEqual(projection.entries[10], {
    record_type: 'visual_concept_entry_v1', owner_kind: 'SCENE', owner_id: 'scene', prompt_tag_id: 'bac-forest', mapping_status: 'UNMAPPED', concept_id: null, concept_status: null, diagnostic: 'prompt_tag_unmapped',
  }, 'bac-forest must remain an exact Scene-owned unmapped entry')

  const adapterFor = (binding = bindingContract, graph = graphContract, promptTagRegistry = registry) => createVisualConceptReadOnlyEntryAdapterV1({ bindingContract: binding, graphContract: graph, promptTagRegistry })
  const reasonFor = (binding, graph = graphContract, projectedInput = input, promptTagRegistry = registry) => adapterFor(binding, graph, promptTagRegistry)(projectedInput).reason

  const duplicateBinding = clone(bindingContract)
  duplicateBinding.bindings.push(clone(duplicateBinding.bindings[0]))
  equal(reasonFor(duplicateBinding), 'binding_identity_conflict', 'duplicate PromptTag bindings must fail closed')

  const danglingPromptTag = clone(bindingContract)
  danglingPromptTag.bindings[0].prompt_tag_id = 'pos-aaa-missing-tag'
  equal(reasonFor(danglingPromptTag), 'binding_prompt_tag_missing', 'binding to a missing production PromptTag must fail closed')

  const danglingConcept = clone(bindingContract)
  danglingConcept.bindings[0].concept_id = 'body.state.missing'
  equal(reasonFor(danglingConcept), 'binding_concept_missing', 'binding to a missing concept must fail closed')

  const ambiguousGraph = clone(graphContract)
  ambiguousGraph.concepts.push(clone(ambiguousGraph.concepts.find(concept => concept.concept_id === 'body.state.lying')))
  equal(reasonFor(bindingContract, ambiguousGraph), 'binding_concept_ambiguous', 'duplicate mapped graph concept identity must fail closed as ambiguous')

  const unsupportedSchema = clone(graphContract)
  unsupportedSchema.schema_version = '0.3.0'
  equal(reasonFor(bindingContract, unsupportedSchema), 'graph_contract_unsupported', 'unsupported graph schema version must fail closed')
  const unsupportedGraph = clone(graphContract)
  unsupportedGraph.graph_version = '0.3.0'
  equal(reasonFor(bindingContract, unsupportedGraph), 'graph_contract_unsupported', 'unsupported graph version must fail closed')

  const inadmissibleGraph = clone(graphContract)
  inadmissibleGraph.concepts.find(concept => concept.concept_id === 'body.state.lying').status = 'deprecated'
  equal(reasonFor(bindingContract, inadmissibleGraph), 'binding_concept_inadmissible', 'mapped concepts outside provisional or confirmed must fail closed')

  const sourceDriftGraph = clone(graphContract)
  sourceDriftGraph.source_files = sourceDriftGraph.source_files.slice(1)
  equal(reasonFor(bindingContract, sourceDriftGraph), 'graph_contract_invalid', 'graph source_files must remain the exact closed set')
  const indexDriftGraph = clone(graphContract)
  indexDriftGraph.indexes.concepts_by_id['body.state.lying'] = 0
  equal(reasonFor(bindingContract, indexDriftGraph), 'graph_contract_invalid', 'concepts_by_id must agree with concept identities')

  const malformedBinding = clone(bindingContract)
  malformedBinding.extra = true
  equal(reasonFor(malformedBinding), 'binding_contract_invalid', 'unknown binding root fields must fail closed')
  const duplicateRegistry = [...registry, registry[0]]
  equal(reasonFor(bindingContract, graphContract, input, duplicateRegistry), 'binding_identity_conflict', 'ambiguous production PromptTag identity must fail closed')

  equal(adapterFor()({ blocks: null, sceneTags: [] }).reason, 'projection_input_invalid', 'malformed block input must fail closed locally')
  equal(adapterFor()({ blocks: [{ id: 'subject-1', name: 'Subject 1', tags: [{ ...lying, prompt: 'spoofed lying' }] }], sceneTags: [] }).reason, 'projection_input_invalid', 'registry identity drift in projected input must fail closed')
  equal(adapterFor()({ blocks: [{ id: 'subject-1', name: 'Subject 1', tags: [] }, { id: 'subject-1', name: 'Duplicate', tags: [] }], sceneTags: [] }).reason, 'projection_input_invalid', 'duplicate PromptBlock ownership must fail closed')

  const compilerBlocks = [{ id: 'compiler-subject', name: 'Subject', tags: [lying, armSupport, reclining, bentKnees, lyingOnBack] }]
  const beforeProjection = buildPrompt(compilerBlocks)
  projectVisualConceptReadOnlyEntryV1({ blocks: compilerBlocks, sceneTags: [forest] })
  equal(buildPrompt(compilerBlocks), beforeProjection, 'read-only projection must leave existing Prompt Compiler output byte-identical')

  console.log(`Visual Concept read-only entry adapter tests passed: ${assertionCount} assertions`)
} finally {
  await server.close()
}
