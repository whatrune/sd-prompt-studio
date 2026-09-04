#!/usr/bin/env node

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import {
  isVisualConceptProductionAdvisoryArtifactCurrentV1,
  projectVisualConceptProductionAdvisoryCatalogV1,
  serializeVisualConceptProductionAdvisoryCatalogV1,
} from './promote-visual-concept-production-advisory-v1.mjs'

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const readJson = relative => JSON.parse(fs.readFileSync(path.join(repoRoot, relative), 'utf8'))
const hairDictionary = readJson('data/hair.json')
const bindingContract = readJson('data/visual-concept-prompt-tag-bindings-v1.json')
const graphContract = readJson('research/sd-prompt-research/dist/visual-concept-graph.json')
const checkedInCatalog = readJson('src/data/visual-concept-production-advisory-v1.json')
const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'App.tsx'), 'utf8')
const promptSource = fs.readFileSync(path.join(repoRoot, 'src', 'prompt.ts'), 'utf8')
const stylesSource = fs.readFileSync(path.join(repoRoot, 'src', 'styles.css'), 'utf8')
const runtimeSource = fs.readFileSync(path.join(repoRoot, 'src', 'visualConceptProductionAdvisoryV1.ts'), 'utf8')
const clone = value => structuredClone(value)
let assertionCount = 0
const check = (condition, message) => { assertionCount += 1; assert(condition, message) }
const equal = (actual, expected, message) => { assertionCount += 1; assert.equal(actual, expected, message) }
const deepEqual = (actual, expected, message) => { assertionCount += 1; assert.deepEqual(actual, expected, message) }
const errorMessage = callback => { try { callback(); return null } catch (error) { return error instanceof Error ? error.message : String(error) } }
const framingBindings = [
  ['cam-close-up', 'camera.framing.close_up', 'close-up', 'CAM-004-D'],
  ['cam-cowboy-shot', 'camera.framing.cowboy_shot', 'cowboy shot', 'CAM-004-B'],
  ['cam-full-body', 'camera.framing.full_body', 'full body', 'CAM-004-A'],
  ['cam-upper-body', 'camera.framing.upper_body', 'upper body', 'CAM-004-C'],
]

const server = await createServer({ root: repoRoot, configFile: false, logLevel: 'silent', server: { middlewareMode: true }, appType: 'custom' })
try {
  const [{ tags }, { adultTags }, runtime, promptModule, smartTagEngine] = await Promise.all([
    server.ssrLoadModule('/src/data/tags.ts'),
    server.ssrLoadModule('/src/data/adultTags.ts'),
    server.ssrLoadModule('/src/visualConceptProductionAdvisoryV1.ts'),
    server.ssrLoadModule('/src/prompt.ts'),
    server.ssrLoadModule('/src/engine/smartTagEngine.ts'),
  ])
  const registry = [...tags, ...adultTags]
  const catalog = projectVisualConceptProductionAdvisoryCatalogV1({ bindingContract, graphContract, promptTagRegistry: registry })
  const serialized = serializeVisualConceptProductionAdvisoryCatalogV1(catalog)
  const selected = id => ({ ...registry.find(tag => tag.id === id), weight: 1 })

  equal(catalog.record_type, 'visual_concept_production_advisory_catalog_v1', 'promoted catalog record type must be exact')
  equal(catalog.version, 1, 'promoted catalog version must be exact')
  equal(catalog.mappings.length, 10, 'promoter must emit the existing six plus exactly four framing mappings')
  deepEqual(catalog.mappings.map(mapping => [mapping.prompt_tag_id, mapping.concept_id]), [
    ...framingBindings.map(([tagId, conceptId]) => [tagId, conceptId]),
    ['hai-long-hair', 'hair.long'],
    ['pos-lying', 'body.state.lying'],
    ['pos-lying-on-back', 'body.orientation.face_up'],
    ['rin-pose-arm-support', 'support.arm.rearward'],
    ['rin-pose-reclining', 'body.state.reclined'],
    ['v192-bent-knees', 'configuration.knee.bent'],
  ], 'promoted mapping slice must remain exact and ordered')
  deepEqual(catalog.relations, [], 'production V1 catalog must not promote relations')
  deepEqual(catalog.coverage, { active_prompt_tag_count: 2522, mapped_active_prompt_tag_count: 10, unmapped_active_prompt_tag_count: 2512 }, 'coverage must bind the exact active registry')
  deepEqual(Object.keys(catalog.source_binding), ['binding_record_type', 'binding_version', 'binding_sha256', 'graph_schema_id', 'graph_schema_version', 'registry_sha256'], 'catalog source binding must use schema identity and production inputs without full-Graph revision or digest coupling')
  equal(serialized, serializeVisualConceptProductionAdvisoryCatalogV1(catalog), 'promoted output must be byte-stable')
  check(isVisualConceptProductionAdvisoryArtifactCurrentV1(`${JSON.stringify(checkedInCatalog, null, 2)}\n`, serialized), 'checked-in artifact must equal fresh promotion bytes')
  check(!isVisualConceptProductionAdvisoryArtifactCurrentV1(`${serialized} `, serialized), 'stale artifact bytes must be rejected')
  check(!/research[\\/]|evidence\.|BRG-/i.test(serialized), 'production catalog must contain no Research path or evidence identity')

  const duplicateBinding = clone(bindingContract)
  duplicateBinding.bindings.splice(1, 0, clone(duplicateBinding.bindings[0]))
  equal(errorMessage(() => projectVisualConceptProductionAdvisoryCatalogV1({ bindingContract: duplicateBinding, graphContract, promptTagRegistry: registry })), 'binding_identity_conflict', 'duplicate source binding must fail closed')
  const danglingBinding = clone(bindingContract)
  danglingBinding.bindings[0].prompt_tag_id = 'aaa-missing-production-tag'
  equal(errorMessage(() => projectVisualConceptProductionAdvisoryCatalogV1({ bindingContract: danglingBinding, graphContract, promptTagRegistry: registry })), 'binding_prompt_tag_missing', 'dangling production tag must fail closed')
  const inadmissibleGraph = clone(graphContract)
  inadmissibleGraph.concepts.find(concept => concept.concept_id === 'body.state.lying').status = 'deprecated'
  equal(errorMessage(() => projectVisualConceptProductionAdvisoryCatalogV1({ bindingContract, graphContract: inadmissibleGraph, promptTagRegistry: registry })), 'binding_concept_inadmissible', 'inadmissible concept status must fail closed')
  const unmappedResearchChange = clone(graphContract)
  unmappedResearchChange.concepts.find(concept => concept.concept_id === 'clothing.upper.oversized_white_tshirt').label = 'Changed unmapped research label'
  const unmappedResearchCatalog = projectVisualConceptProductionAdvisoryCatalogV1({ bindingContract, graphContract: unmappedResearchChange, promptTagRegistry: registry })
  equal(serializeVisualConceptProductionAdvisoryCatalogV1(unmappedResearchCatalog), serialized, 'unmapped same-schema research content must not stale the production catalog')
  const mappedProductionChange = clone(graphContract)
  mappedProductionChange.concepts.find(concept => concept.concept_id === 'hair.long').label = 'Changed production label'
  const mappedProductionCatalog = projectVisualConceptProductionAdvisoryCatalogV1({ bindingContract, graphContract: mappedProductionChange, promptTagRegistry: registry })
  check(serializeVisualConceptProductionAdvisoryCatalogV1(mappedProductionCatalog) !== serialized, 'mapped production-relevant field change must stale the catalog')

  for (const [tagId, conceptId, phrase, runId] of framingBindings) {
    const tag = registry.find(candidate => candidate.id === tagId)
    deepEqual([tag?.prompt, tag?.category, tag?.slot], [phrase, 'camera', 'camera_framing'], `${tagId} must preserve its exact production phrase and single-slot identity`)
    const concept = graphContract.concepts.find(candidate => candidate.concept_id === conceptId)
    deepEqual([concept?.module, concept?.concept_type, concept?.status], ['camera', 'camera', 'provisional'], `${conceptId} must remain an existing provisional camera concept`)
    equal(concept.model_behaviors.length, 1, `${conceptId} must not generalize the admitted model context`)
    const behavior = concept.model_behaviors[0]
    deepEqual([behavior.model_profile_id, behavior.status], ['model.novaanimexl_ilv190', 'provisional'], `${conceptId} retains its bounded Research model identity`)
    equal(behavior.evidence_refs.length, 1, `${conceptId} retains one exact CAM-004 reference`)
    const evidence = behavior.evidence_refs[0]
    const framing = conceptId.slice('camera.framing.'.length)
    deepEqual([evidence.run_id, evidence.observation_path, evidence.metric, evidence.count, evidence.total], [runId, `experiments/camera/${runId}/observation.json`, `computed_aggregate.axis_counts.observed_framing.${framing}`, 6, 6], `${conceptId} preserves the exact 6/6 observation reference`)
    const observation = readJson(`research/sd-prompt-research/${evidence.observation_path}`)
    equal(evidence.metric.split('.').reduce((value, key) => value?.[key], observation), 6, `${conceptId} evidence must resolve to the tracked observation`)
    const sceneSelection = [selected(tagId)]
    const sceneSnapshot = clone(sceneSelection)
    const projected = runtime.projectVisualConceptProductionAdvisoryV1({ catalog: checkedInCatalog, blocks: [], sceneTags: sceneSelection })
    deepEqual(projected.mapped_entries.map(entry => [entry.prompt_tag_id, entry.concept_id, entry.concept_status, entry.owner_kind, entry.owner_id]), [[tagId, conceptId, 'provisional', 'SCENE', 'scene']], `${tagId} maps only the explicitly selected Scene identity`)
    const compiled = promptModule.buildPromptWithStrategy([], sceneSelection)
    deepEqual(compiled.visualConceptAdvisory, projected, `${tagId} compiler metadata must equal the existing semantic-owner projection`)
    deepEqual(compiled.visualConceptAdvisory.mapped_entries.map(entry => [entry.prompt_tag_id, entry.concept_id, entry.concept_status, entry.owner_kind, entry.owner_id]), [[tagId, conceptId, 'provisional', 'SCENE', 'scene']], `${tagId} compiler metadata must expose its exact canonical Graph identity, status, and selected owner`)
    deepEqual(sceneSelection, sceneSnapshot, `${tagId} projection must not mutate selection or weight`)
    equal(promptModule.buildPrompt([], sceneSelection), `[]\n\n[]\n\n[]\n\n[]\n\n[${phrase}]\n\nBREAK\n\n[]`, `${tagId} must preserve the baseline exact prompt bytes`)
    equal(smartTagEngine.getConflictReason(tag, sceneSelection, registry), null, `${tagId} must not conflict with its own selection`)
    for (const [otherId] of framingBindings.filter(([id]) => id !== tagId)) {
      equal(smartTagEngine.getConflictReason(tag, [selected(otherId)], registry)?.level, 'hard', `${tagId} and ${otherId} retain existing framing conflicts in every selection direction`)
    }
  }

  const unapprovedBinding = clone(bindingContract)
  unapprovedBinding.bindings[0].concept_id = 'camera.framing.full_body'
  equal(errorMessage(() => projectVisualConceptProductionAdvisoryCatalogV1({ bindingContract: unapprovedBinding, graphContract, promptTagRegistry: registry })), 'visual_concept_production_binding_scope_invalid', 'an existing concept paired to the wrong existing PromptTag must not be promoted')
  const framingLabelChange = clone(graphContract)
  framingLabelChange.concepts.find(concept => concept.concept_id === 'camera.framing.full_body').label = 'Changed framing label'
  check(serializeVisualConceptProductionAdvisoryCatalogV1(projectVisualConceptProductionAdvisoryCatalogV1({ bindingContract, graphContract: framingLabelChange, promptTagRegistry: registry })) !== serialized, 'mapped framing changes must be detected by canonical promotion freshness')

  const longHairTag = registry.find(tag => tag.id === 'hai-long-hair')
  const bobCutTag = registry.find(tag => tag.id === 'hai-bob-cut')
  deepEqual([longHairTag?.prompt, longHairTag?.category, longHairTag?.slot], ['long hair', 'hair', 'hair_length_back'], 'bound PromptTag emission identity must remain unchanged')
  deepEqual(hairDictionary.find(tag => tag.id === 'hai-bob-cut')?.conflicts, ['long hair'], 'source dictionary must own exactly the bob-cut to long-hair conflict')
  deepEqual(bobCutTag?.conflicts, ['long hair'], 'runtime PromptTag registry must preserve the exact source conflict')
  equal(longHairTag?.conflicts, undefined, 'long hair must not gain a reciprocal conflict record')
  for (const conflictingId of ['hai-short-hair', 'hai-medium-hair', 'hai-shoulder-length-hair', 'hai-very-long-hair']) {
    equal(smartTagEngine.getConflictReason(registry.find(tag => tag.id === conflictingId), [selected('hai-long-hair')], registry)?.level, 'hard', `${conflictingId} must preserve the existing hair-length slot conflict`)
  }
  equal(smartTagEngine.getConflictReason(registry.find(tag => tag.id === 'hai-bob-cut'), [selected('hai-long-hair')], registry)?.level, 'hard', 'bob cut must explicitly conflict when long hair is already selected')
  equal(smartTagEngine.getConflictReason(registry.find(tag => tag.id === 'hai-long-hair'), [selected('hai-bob-cut')], registry)?.level, 'hard', 'long hair must conflict when bob cut is already selected through symmetric evaluation')
  for (const compatibleId of ['hai-twintails', 'hai-ponytail']) {
    equal(smartTagEngine.getConflictReason(registry.find(tag => tag.id === compatibleId), [selected('hai-long-hair')], registry), null, `${compatibleId} must preserve existing main-hairstyle coexistence`)
  }
  for (const conflictingId of ['hai-twintails', 'hai-ponytail']) {
    equal(smartTagEngine.getConflictReason(registry.find(tag => tag.id === conflictingId), [selected('hai-bob-cut')], registry)?.level, 'hard', `${conflictingId} must preserve the existing main-hairstyle slot conflict`)
  }
  const promptFor = ids => promptModule.buildPrompt([{ id: 'subject-1', name: 'Subject 1', tags: ids.map(selected) }])
  const promptEnvelope = body => `[]\n\n[]\n\n[${body}]\n\nBREAK\n\n[]\n\n[]\n\nBREAK\n\n[]`
  equal(promptFor(['hai-bob-cut']), promptEnvelope('bob cut'), 'bob cut alone must preserve its exact emitted Prompt bytes')
  equal(promptFor(['hai-long-hair']), promptEnvelope('long hair'), 'long hair alone must preserve its exact emitted Prompt bytes')
  equal(promptFor(['hai-twintails', 'hai-long-hair']), promptEnvelope('twintails, long hair'), 'twintails and long hair must coexist in the existing main-hairstyle-before-length order')
  equal(promptFor(['hai-ponytail', 'hai-long-hair']), promptEnvelope('ponytail, long hair'), 'ponytail and long hair must coexist in the existing main-hairstyle-before-length order')
  equal(promptFor(['pos-standing', 'eye-blue-eyes']), '[]\n\n[]\n\n[blue eyes]\n\nBREAK\n\n[standing]\n\n[]\n\nBREAK\n\n[]', 'unrelated Prompt output must remain byte-identical')
  const weighted = (id, weight) => ({ ...selected(id), weight })
  const framingBlocks = [
    { id: 'subject-a', name: 'A', tags: [weighted('cam-upper-body', 1.2), weighted('hai-long-hair', 1.3), selected('pos-standing')] },
    { id: 'subject-b', name: 'B', tags: [weighted('cam-close-up', 0.8), selected('eye-blue-eyes')] },
  ]
  const framingScene = [weighted('cam-full-body', 1.4), selected('bac-forest')]
  const framingInputBefore = clone({ blocks: framingBlocks, sceneTags: framingScene })
  const framingPrompt = '[]\n\n[]\n\nLeft side:\n[(long hair:1.3)]\n\nBREAK\n\n[standing]\n\nBREAK\n\nRight side:\n[blue eyes]\n\nBREAK\n\n[]\n\n[(close-up:0.8), (upper body:1.2), (full body:1.4), forest]\n\nBREAK\n\n[]'
  const framingExpansion = promptModule.buildPromptWithStrategy(framingBlocks, framingScene)
  equal(framingExpansion.prompt, framingPrompt, 'weighted multi-subject/Scene prompt must equal the pre-binding baseline, including order and BREAK')
  const framingAdvisory = runtime.projectVisualConceptProductionAdvisoryV1({ catalog: checkedInCatalog, blocks: framingBlocks, sceneTags: framingScene })
  deepEqual(framingExpansion.visualConceptAdvisory, framingAdvisory, 'compiler metadata must deep-equal the existing semantic owner for weighted multi-subject/Scene input')
  deepEqual(framingAdvisory.mapped_entries.map(entry => [entry.owner_kind, entry.owner_id, entry.prompt_tag_id]), [
    ['PROMPT_BLOCK', 'subject-a', 'cam-upper-body'],
    ['PROMPT_BLOCK', 'subject-a', 'hai-long-hair'],
    ['PROMPT_BLOCK', 'subject-b', 'cam-close-up'],
    ['SCENE', 'scene', 'cam-full-body'],
  ], 'advisory must preserve exact stored ownership even when compiler projects subject-owned camera tags to Scene')
  deepEqual({ blocks: framingBlocks, sceneTags: framingScene }, framingInputBefore, 'advisory must not move, correct, insert, delete, or reweight existing selections')
  equal(promptModule.buildPrompt(framingBlocks, framingScene), framingPrompt, 'advisory must not alter weighted multi-subject prompt bytes')
  const sdxlExpansion = promptModule.buildPromptWithStrategy(framingBlocks, framingScene, 'sdxl')
  equal(sdxlExpansion.prompt, framingPrompt.replace('Left side:\n', '').replace('Right side:\n', ''), 'other model preset rendering stays byte-identical; mapping makes no model reliability claim')
  deepEqual(sdxlExpansion.visualConceptAdvisory, framingAdvisory, 'model strategy must not change compiler semantic identity metadata')
  const customSeparatorExpansion = promptModule.buildPromptWithStrategy(framingBlocks, framingScene, 'illustrious', 'CUSTOM BREAK')
  equal(customSeparatorExpansion.prompt, framingPrompt.replaceAll('BREAK', 'CUSTOM BREAK').replace(/CUSTOM BREAK(?=\n\n\[\]$)/, 'BREAK'), 'custom subject separators and the Scene BREAK must remain independent')
  deepEqual(customSeparatorExpansion.visualConceptAdvisory, framingAdvisory, 'custom separators must not change compiler semantic identity metadata')
  deepEqual({ blocks: framingBlocks, sceneTags: framingScene }, framingInputBefore, 'compiler prompt and metadata projection must not mutate source selection, ownership, or weights')
  const forcedBlocks = [{ id: 'forced', name: 'Forced', tags: framingBindings.map(([id]) => selected(id)) }]
  const forcedBefore = clone(forcedBlocks)
  const forcedAdvisory = runtime.projectVisualConceptProductionAdvisoryV1({ catalog: checkedInCatalog, blocks: forcedBlocks, sceneTags: [] })
  const forcedExpansion = promptModule.buildPromptWithStrategy(forcedBlocks)
  deepEqual(forcedExpansion.visualConceptAdvisory, forcedAdvisory, 'compiler metadata must retain every forced simultaneous framing identity without suppression')
  equal(forcedAdvisory.mapped_count, 4, 'forced/imported incompatible selections remain visible; advisory does not resolve conflicts')
  deepEqual(forcedBlocks, forcedBefore, 'forced/imported combinations must never be silently deleted or corrected')
  equal(promptModule.buildPrompt(forcedBlocks), '[]\n\n[]\n\n[]\n\n[]\n\n[close-up, upper body, cowboy shot, full body]\n\nBREAK\n\n[]', 'forced/imported framing prompt bytes must preserve every selected phrase in the original production order')
  const aliasTags = framingBindings.map(([id, , phrase]) => ({ ...selected(id), id: `custom-${id}`, prompt: phrase }))
  const aliasAdvisory = runtime.projectVisualConceptProductionAdvisoryV1({ catalog: checkedInCatalog, blocks: [], sceneTags: aliasTags })
  deepEqual(promptModule.buildPromptWithStrategy([], aliasTags).visualConceptAdvisory, aliasAdvisory, 'compiler metadata must keep custom or alias IDs uncovered exactly as the semantic owner does')
  equal(aliasAdvisory.mapped_count, 0, 'exact phrases under custom or alias IDs must not infer Graph bindings')
  equal(aliasAdvisory.uncovered_selected_tag_count, 4, 'unapproved aliases must remain explicitly uncovered')
  const blocks = [
    { id: 'subject-1', name: 'Subject 1', tags: [selected('hai-long-hair'), selected('pos-lying'), selected('pos-lying-on-back'), { id: 'custom-tag', label: 'Custom', prompt: 'custom', category: 'pose', weight: 1 }] },
    { id: 'subject-2', name: 'Subject 2', tags: [selected('rin-pose-arm-support'), selected('rin-pose-reclining'), selected('v192-bent-knees')] },
  ]
  const sceneTags = [selected('bac-forest')]
  const promptBefore = promptModule.buildPromptWithStrategy(blocks, sceneTags, 'illustrious').prompt
  const advisory = runtime.projectVisualConceptProductionAdvisoryV1({ catalog: checkedInCatalog, blocks, sceneTags })
  equal(advisory.advisory_status, 'READY', 'valid production input must produce a ready advisory')
  equal(advisory.mapped_count, 6, 'all six selected mapped tags must be reported')
  equal(advisory.selected_tag_count, 8, 'all selected tags must be counted without mutation')
  equal(advisory.uncovered_selected_tag_count, 2, 'custom and unbound Scene tags must remain uncovered')
  deepEqual(advisory.mapped_entries.map(entry => [entry.owner_kind, entry.owner_id, entry.prompt_tag_id]), [
    ['PROMPT_BLOCK', 'subject-1', 'hai-long-hair'],
    ['PROMPT_BLOCK', 'subject-1', 'pos-lying'],
    ['PROMPT_BLOCK', 'subject-1', 'pos-lying-on-back'],
    ['PROMPT_BLOCK', 'subject-2', 'rin-pose-arm-support'],
    ['PROMPT_BLOCK', 'subject-2', 'rin-pose-reclining'],
    ['PROMPT_BLOCK', 'subject-2', 'v192-bent-knees'],
  ], 'mapped entry ownership and production input order must be preserved')
  const hairLongEntry = advisory.mapped_entries.find(entry => entry.prompt_tag_id === 'hai-long-hair')
  deepEqual([hairLongEntry?.concept_id, hairLongEntry?.concept_status], ['hair.long', 'provisional'], 'long hair must expose only the exact provisional hair.long concept')
  const faceUpEntry = advisory.mapped_entries.find(entry => entry.prompt_tag_id === 'pos-lying-on-back')
  deepEqual([faceUpEntry?.concept_id, faceUpEntry?.concept_status], ['body.orientation.face_up', 'provisional'], 'lying on back must expose only the exact face-up orientation concept')
  deepEqual(advisory.uncovered_entries.map(entry => [entry.owner_kind, entry.owner_id, entry.prompt_tag_id, entry.prompt_tag_label]), [
    ['PROMPT_BLOCK', 'subject-1', 'custom-tag', 'Custom'],
    ['SCENE', 'scene', 'bac-forest', selected('bac-forest').label],
  ], 'uncovered entry identity, ownership, label, and production input order must be preserved')
  equal(advisory.uncovered_entries.length, advisory.uncovered_selected_tag_count, 'uncovered count must equal the projected uncovered entry cardinality')
  check(promptBefore.includes('long hair'), 'existing Prompt Compiler must continue to emit the exact long hair phrase')
  equal(promptModule.buildPromptWithStrategy(blocks, sceneTags, 'illustrious').prompt, promptBefore, 'advisory projection must leave Prompt Compiler output byte-identical')
  const emptySelection = runtime.projectVisualConceptProductionAdvisoryV1({ catalog: checkedInCatalog, blocks: [], sceneTags: [] })
  deepEqual(promptModule.buildPromptWithStrategy([], []).visualConceptAdvisory, emptySelection, 'compiler metadata must preserve the existing empty-selection projection')
  equal(emptySelection.mapped_count, 0, 'empty selection must remain safe')
  deepEqual(emptySelection.uncovered_entries, [], 'empty selection must expose no uncovered identities')
  const noMapped = runtime.projectVisualConceptProductionAdvisoryV1({ catalog: checkedInCatalog, blocks: [{ id: 'subject-1', name: 'Subject 1', tags: [selected('pos-standing')] }], sceneTags: [] })
  equal(noMapped.advisory_status, 'READY', 'unmapped-only selection must remain an available advisory')
  equal(noMapped.uncovered_selected_tag_count, 1, 'unmapped-only selection must increment coverage count only')
  deepEqual(noMapped.uncovered_entries.map(entry => entry.prompt_tag_id), ['pos-standing'], 'unmapped-only selection must expose the exact selected tag identity')
  const deprecated = { id: 'rin-pose-on-back', label: 'Deprecated', prompt: 'lying on back', category: 'pose', weight: 1 }
  equal(runtime.projectVisualConceptProductionAdvisoryV1({ catalog: checkedInCatalog, blocks: [{ id: 'subject-1', name: 'Subject 1', tags: [deprecated] }], sceneTags: [] }).mapped_count, 0, 'deprecated IDs must not receive inferred mappings')
  const invalidCatalog = clone(checkedInCatalog)
  invalidCatalog.extra = true
  const unavailableAdvisory = runtime.projectVisualConceptProductionAdvisoryV1({ catalog: invalidCatalog, blocks, sceneTags })
  equal(unavailableAdvisory.advisory_status, 'UNAVAILABLE', 'invalid catalog must degrade the advisory only')
  deepEqual(unavailableAdvisory.uncovered_entries, [], 'unavailable advisory must not expose partial uncovered identities')
  const relationCatalog = clone(checkedInCatalog)
  relationCatalog.relations.push({ relation_id: 'not-admitted' })
  equal(runtime.projectVisualConceptProductionAdvisoryV1({ catalog: relationCatalog, blocks, sceneTags }).advisory_status, 'UNAVAILABLE', 'relations must remain unsupported in production V1')
  for (const mutate of [
    value => { value.mappings[0].concept_id = 'camera.framing.full_body' },
    value => { value.mappings[0].concept_status = 'draft' },
    value => { value.mappings[0].model_guarantee = 'all-models' },
    value => { value.mappings.splice(0, 1) },
    value => { value.mappings[1] = clone(value.mappings[0]) },
  ]) {
    const malformedFramingCatalog = clone(checkedInCatalog)
    mutate(malformedFramingCatalog)
    equal(runtime.projectVisualConceptProductionAdvisoryV1({ catalog: malformedFramingCatalog, blocks, sceneTags }).unavailable_reason, 'catalog_contract_invalid', 'malformed framing identity/status/shape/cardinality must fail closed without partial projection')
  }
  const expandedCatalog = clone(checkedInCatalog)
  expandedCatalog.mappings.push({ ...expandedCatalog.mappings.at(-1), prompt_tag_id: 'zzz-unapproved', concept_id: 'body.state.lying' })
  expandedCatalog.coverage.mapped_active_prompt_tag_count += 1
  expandedCatalog.coverage.unmapped_active_prompt_tag_count -= 1
  equal(runtime.projectVisualConceptProductionAdvisoryV1({ catalog: expandedCatalog, blocks, sceneTags }).advisory_status, 'UNAVAILABLE', 'runtime must reject mapping scope expansion outside the promoted V1 slice')
  equal(runtime.projectVisualConceptProductionAdvisoryV1({ catalog: checkedInCatalog, blocks: [{ id: 'duplicate', name: 'One', tags: [] }, { id: 'duplicate', name: 'Two', tags: [] }], sceneTags: [] }).unavailable_reason, 'projection_input_invalid', 'duplicate ownership must fail locally')
  const duplicateOwnershipBlocks = [
    { id: 'duplicate', name: 'One', tags: [selected('cam-upper-body')] },
    { id: 'duplicate', name: 'Two', tags: [selected('cam-full-body')] },
  ]
  const unavailableExpansion = promptModule.buildPromptWithStrategy(duplicateOwnershipBlocks)
  equal(unavailableExpansion.visualConceptAdvisory.unavailable_reason, 'projection_input_invalid', 'invalid metadata ownership must remain isolated as compiler advisory UNAVAILABLE')
  equal(unavailableExpansion.prompt, '[]\n\n[]\n\n[]\n\n[]\n\n[upper body, full body]\n\nBREAK\n\n[]', 'advisory UNAVAILABLE must not suppress, rewrite, or otherwise change prompt compilation')

  const visualSection = appSource.indexOf('className={`preview-section visual-concept-advisory')
  check(visualSection > appSource.indexOf('className="selected-outline"') && visualSection < appSource.indexOf('className={`preview-section generation-context'), 'Visual Concepts must render after Prompt Context and before Generation Context')
  equal((appSource.match(/id="visual-concept-advisory-title"/g) ?? []).length, 1, 'Visual Concepts must appear only in the current Prompt Inspector')
  check(appSource.includes('Visual Concept advisory unavailable') && appSource.includes('No mapped concepts for this selection.'), 'Inspector must expose unavailable and no-mapped states')
  check(appSource.includes('MAPPED') && appSource.includes('UNCOVERED') && appSource.includes('TOTAL'), 'Inspector must distinguish all three coverage counts')
  check(appSource.includes('Uncovered selected tags') && appSource.includes('entry.prompt_tag_id') && appSource.includes('entry.prompt_tag_label'), 'Inspector must expose uncovered tag identities in a secondary list')
  check(appSource.includes('<details className="visual-concept-advisory-uncovered">'), 'uncovered identities must remain collapsed by default using an accessible native disclosure')
  check(appSource.includes('entry.owner_kind') && appSource.includes('entry.owner_id'), 'Inspector must show exact selected-tag ownership')
  check(!appSource.includes('visualConceptAdvisory.relations'), 'production V1 UI must not display relations')
  check(appSource.includes('const visualConceptAdvisory = expansion.visualConceptAdvisory'), 'Prompt Inspector must consume the compiler-carried semantic identity field')
  check(!appSource.includes("from './visualConceptProductionAdvisoryV1'") && !appSource.includes("from './data/visual-concept-production-advisory-v1.json'"), 'App must not create parallel semantic ownership by importing the projector or catalog directly')
  check(promptSource.includes('const expansion = expandPrompt(') && promptSource.indexOf('const expansion = expandPrompt(') < promptSource.indexOf('visualConceptAdvisory: projectVisualConceptProductionAdvisoryV1('), 'compiler must render through the existing expansion path before adding semantic identity metadata')
  check(stylesSource.includes('.visual-concept-advisory-entry') && stylesSource.includes('.visual-concept-advisory-coverage') && stylesSource.includes('.visual-concept-advisory-uncovered'), 'advisory must have deterministic Inspector-native visual treatment')
  check(!runtimeSource.includes('usePromptStore') && !runtimeSource.includes('buildPrompt') && !runtimeSource.includes('research/'), 'runtime owner must be pure and independent of store, compiler, and Research Repository')

  console.log(`Visual Concept production advisory tests passed: ${assertionCount} assertions`)
} finally {
  await server.close()
}
