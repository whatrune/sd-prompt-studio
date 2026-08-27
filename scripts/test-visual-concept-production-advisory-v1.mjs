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
const bindingContract = readJson('data/visual-concept-prompt-tag-bindings-v1.json')
const graphContract = readJson('research/sd-prompt-research/dist/visual-concept-graph.json')
const checkedInCatalog = readJson('src/data/visual-concept-production-advisory-v1.json')
const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'App.tsx'), 'utf8')
const stylesSource = fs.readFileSync(path.join(repoRoot, 'src', 'styles.css'), 'utf8')
const runtimeSource = fs.readFileSync(path.join(repoRoot, 'src', 'visualConceptProductionAdvisoryV1.ts'), 'utf8')
const clone = value => structuredClone(value)
let assertionCount = 0
const check = (condition, message) => { assertionCount += 1; assert(condition, message) }
const equal = (actual, expected, message) => { assertionCount += 1; assert.equal(actual, expected, message) }
const deepEqual = (actual, expected, message) => { assertionCount += 1; assert.deepEqual(actual, expected, message) }
const errorMessage = callback => { try { callback(); return null } catch (error) { return error instanceof Error ? error.message : String(error) } }

const server = await createServer({ root: repoRoot, configFile: false, logLevel: 'silent', server: { middlewareMode: true }, appType: 'custom' })
try {
  const [{ tags }, { adultTags }, runtime, promptModule] = await Promise.all([
    server.ssrLoadModule('/src/data/tags.ts'),
    server.ssrLoadModule('/src/data/adultTags.ts'),
    server.ssrLoadModule('/src/visualConceptProductionAdvisoryV1.ts'),
    server.ssrLoadModule('/src/prompt.ts'),
  ])
  const registry = [...tags, ...adultTags]
  const catalog = projectVisualConceptProductionAdvisoryCatalogV1({ bindingContract, graphContract, promptTagRegistry: registry })
  const serialized = serializeVisualConceptProductionAdvisoryCatalogV1(catalog)
  const selected = id => ({ ...registry.find(tag => tag.id === id), weight: 1 })

  equal(catalog.record_type, 'visual_concept_production_advisory_catalog_v1', 'promoted catalog record type must be exact')
  equal(catalog.version, 1, 'promoted catalog version must be exact')
  equal(catalog.mappings.length, 4, 'promoter must emit exactly four approved mappings')
  deepEqual(catalog.mappings.map(mapping => [mapping.prompt_tag_id, mapping.concept_id]), [
    ['pos-lying', 'body.state.lying'],
    ['rin-pose-arm-support', 'support.arm.rearward'],
    ['rin-pose-reclining', 'body.state.reclined'],
    ['v192-bent-knees', 'configuration.knee.bent'],
  ], 'promoted mapping slice must remain exact and ordered')
  deepEqual(catalog.relations, [], 'production V1 catalog must not promote relations')
  deepEqual(catalog.coverage, { active_prompt_tag_count: 2522, mapped_active_prompt_tag_count: 4, unmapped_active_prompt_tag_count: 2518 }, 'coverage must bind the exact active registry')
  equal(serialized, serializeVisualConceptProductionAdvisoryCatalogV1(catalog), 'promoted output must be byte-stable')
  check(isVisualConceptProductionAdvisoryArtifactCurrentV1(`${JSON.stringify(checkedInCatalog, null, 2)}\n`, serialized), 'checked-in artifact must equal fresh promotion bytes')
  check(!isVisualConceptProductionAdvisoryArtifactCurrentV1(`${serialized} `, serialized), 'stale artifact bytes must be rejected')
  check(!/research[\\/]|evidence\.|BRG-/i.test(serialized), 'production catalog must contain no Research path or evidence identity')

  const duplicateBinding = clone(bindingContract)
  duplicateBinding.bindings.splice(1, 0, clone(duplicateBinding.bindings[0]))
  equal(errorMessage(() => projectVisualConceptProductionAdvisoryCatalogV1({ bindingContract: duplicateBinding, graphContract, promptTagRegistry: registry })), 'binding_identity_conflict', 'duplicate source binding must fail closed')
  const danglingBinding = clone(bindingContract)
  danglingBinding.bindings[0].prompt_tag_id = 'pos-missing-production-tag'
  equal(errorMessage(() => projectVisualConceptProductionAdvisoryCatalogV1({ bindingContract: danglingBinding, graphContract, promptTagRegistry: registry })), 'binding_prompt_tag_missing', 'dangling production tag must fail closed')
  const inadmissibleGraph = clone(graphContract)
  inadmissibleGraph.concepts.find(concept => concept.concept_id === 'body.state.lying').status = 'deprecated'
  equal(errorMessage(() => projectVisualConceptProductionAdvisoryCatalogV1({ bindingContract, graphContract: inadmissibleGraph, promptTagRegistry: registry })), 'binding_concept_inadmissible', 'inadmissible concept status must fail closed')

  const blocks = [
    { id: 'subject-1', name: 'Subject 1', tags: [selected('pos-lying'), { id: 'custom-tag', label: 'Custom', prompt: 'custom', category: 'pose', weight: 1 }] },
    { id: 'subject-2', name: 'Subject 2', tags: [selected('rin-pose-arm-support'), selected('rin-pose-reclining'), selected('v192-bent-knees')] },
  ]
  const sceneTags = [selected('bac-forest')]
  const promptBefore = promptModule.buildPromptWithStrategy(blocks, sceneTags, 'illustrious').prompt
  const advisory = runtime.projectVisualConceptProductionAdvisoryV1({ catalog: checkedInCatalog, blocks, sceneTags })
  equal(advisory.advisory_status, 'READY', 'valid production input must produce a ready advisory')
  equal(advisory.mapped_count, 4, 'all four selected mapped tags must be reported')
  equal(advisory.selected_tag_count, 6, 'all selected tags must be counted without mutation')
  equal(advisory.uncovered_selected_tag_count, 2, 'custom and unbound Scene tags must remain uncovered')
  deepEqual(advisory.mapped_entries.map(entry => [entry.owner_kind, entry.owner_id, entry.prompt_tag_id]), [
    ['PROMPT_BLOCK', 'subject-1', 'pos-lying'],
    ['PROMPT_BLOCK', 'subject-2', 'rin-pose-arm-support'],
    ['PROMPT_BLOCK', 'subject-2', 'rin-pose-reclining'],
    ['PROMPT_BLOCK', 'subject-2', 'v192-bent-knees'],
  ], 'mapped entry ownership and production input order must be preserved')
  equal(promptModule.buildPromptWithStrategy(blocks, sceneTags, 'illustrious').prompt, promptBefore, 'advisory projection must leave Prompt Compiler output byte-identical')
  equal(runtime.projectVisualConceptProductionAdvisoryV1({ catalog: checkedInCatalog, blocks: [], sceneTags: [] }).mapped_count, 0, 'empty selection must remain safe')
  const noMapped = runtime.projectVisualConceptProductionAdvisoryV1({ catalog: checkedInCatalog, blocks: [{ id: 'subject-1', name: 'Subject 1', tags: [selected('pos-standing')] }], sceneTags: [] })
  equal(noMapped.advisory_status, 'READY', 'unmapped-only selection must remain an available advisory')
  equal(noMapped.uncovered_selected_tag_count, 1, 'unmapped-only selection must increment coverage count only')
  const deprecated = { id: 'rin-pose-on-back', label: 'Deprecated', prompt: 'lying on back', category: 'pose', weight: 1 }
  equal(runtime.projectVisualConceptProductionAdvisoryV1({ catalog: checkedInCatalog, blocks: [{ id: 'subject-1', name: 'Subject 1', tags: [deprecated] }], sceneTags: [] }).mapped_count, 0, 'deprecated IDs must not receive inferred mappings')
  const invalidCatalog = clone(checkedInCatalog)
  invalidCatalog.extra = true
  equal(runtime.projectVisualConceptProductionAdvisoryV1({ catalog: invalidCatalog, blocks, sceneTags }).advisory_status, 'UNAVAILABLE', 'invalid catalog must degrade the advisory only')
  const relationCatalog = clone(checkedInCatalog)
  relationCatalog.relations.push({ relation_id: 'not-admitted' })
  equal(runtime.projectVisualConceptProductionAdvisoryV1({ catalog: relationCatalog, blocks, sceneTags }).advisory_status, 'UNAVAILABLE', 'relations must remain unsupported in production V1')
  const expandedCatalog = clone(checkedInCatalog)
  expandedCatalog.mappings.push({ ...expandedCatalog.mappings.at(-1), prompt_tag_id: 'zzz-unapproved', concept_id: 'body.state.lying' })
  expandedCatalog.coverage.mapped_active_prompt_tag_count += 1
  expandedCatalog.coverage.unmapped_active_prompt_tag_count -= 1
  equal(runtime.projectVisualConceptProductionAdvisoryV1({ catalog: expandedCatalog, blocks, sceneTags }).advisory_status, 'UNAVAILABLE', 'runtime must reject mapping scope expansion outside the promoted V1 slice')
  equal(runtime.projectVisualConceptProductionAdvisoryV1({ catalog: checkedInCatalog, blocks: [{ id: 'duplicate', name: 'One', tags: [] }, { id: 'duplicate', name: 'Two', tags: [] }], sceneTags: [] }).unavailable_reason, 'projection_input_invalid', 'duplicate ownership must fail locally')

  const visualSection = appSource.indexOf('className={`preview-section visual-concept-advisory')
  check(visualSection > appSource.indexOf('className="selected-outline"') && visualSection < appSource.indexOf('className={`preview-section generation-context'), 'Visual Concepts must render after Prompt Context and before Generation Context')
  equal((appSource.match(/id="visual-concept-advisory-title"/g) ?? []).length, 1, 'Visual Concepts must appear only in the current Prompt Inspector')
  check(appSource.includes('Visual Concept advisory unavailable') && appSource.includes('No mapped concepts for this selection.'), 'Inspector must expose unavailable and no-mapped states')
  check(appSource.includes('outside current coverage') && appSource.includes('entry.owner_kind') && appSource.includes('entry.owner_id'), 'Inspector must show coverage and exact ownership')
  check(!appSource.includes('visualConceptAdvisory.relations'), 'production V1 UI must not display relations')
  check(stylesSource.includes('.visual-concept-advisory-entry') && stylesSource.includes('.visual-concept-advisory-coverage'), 'advisory must have deterministic Inspector-native visual treatment')
  check(!runtimeSource.includes('usePromptStore') && !runtimeSource.includes('buildPrompt') && !runtimeSource.includes('research/'), 'runtime owner must be pure and independent of store, compiler, and Research Repository')

  console.log(`Visual Concept production advisory tests passed: ${assertionCount} assertions`)
} finally {
  await server.close()
}
