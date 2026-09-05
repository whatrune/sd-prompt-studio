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
const storeSource = fs.readFileSync(path.join(repoRoot, 'src', 'store.ts'), 'utf8')
const stylesSource = fs.readFileSync(path.join(repoRoot, 'src', 'styles.css'), 'utf8')
const runtimeSource = fs.readFileSync(path.join(repoRoot, 'src', 'visualConceptProductionAdvisoryV1.ts'), 'utf8')
const intentOwnerSource = fs.readFileSync(path.join(repoRoot, 'src', 'visualConceptCompilerConstraintIntentV1.ts'), 'utf8')
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
  const [{ tags }, { adultTags }, runtime, promptModule, smartTagEngine, intentOwner] = await Promise.all([
    server.ssrLoadModule('/src/data/tags.ts'),
    server.ssrLoadModule('/src/data/adultTags.ts'),
    server.ssrLoadModule('/src/visualConceptProductionAdvisoryV1.ts'),
    server.ssrLoadModule('/src/prompt.ts'),
    server.ssrLoadModule('/src/engine/smartTagEngine.ts'),
    server.ssrLoadModule('/src/visualConceptCompilerConstraintIntentV1.ts'),
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
  deepEqual(catalog.constraint_concepts.map(concept => [concept.concept_id, concept.concept_type, concept.concept_status]), [
    ['visibility.feet', 'visibility', 'provisional'],
    ['visibility.hands', 'visibility', 'provisional'],
    ['visibility.head', 'visibility', 'provisional'],
  ], 'promoter must admit exactly the three Graph-owned visibility constraint identities')
  deepEqual(catalog.advisory_effects, [{
    advisory_id: 'hand_visibility_risk',
    effect_id: 'unmodeled.pose_body_overlap.hand_visibility',
    target_concept_id: 'visibility.hands',
    trigger_prompt_tags: [{
      prompt_tag_id: 'pos-hands-behind-back',
      prompt: 'hands behind back',
      category: 'pose',
      slot: 'hand_action',
    }],
    advisory_status: 'ADVISORY_ONLY',
    confidence: 'high',
    model_profile: 'model.novaanimexl_ilv190',
    explanation: {
      summary: graphContract.unmodeled_effects.find(effect => effect.effect_id === 'unmodeled.pose_body_overlap.hand_visibility').observed_effect,
      source_run_ids: ['CAM-018-A', 'CAM-018-B', 'CAM-018-C', 'CAM-018-D', 'CAM-019-A', 'CAM-019-B', 'CAM-019-C'],
    },
    specific_replacement_suggestions: [{
      prompt_tag_id: 'rin-arms-at-sides',
      prompt: 'arms at sides',
      prompt_tag_label: registry.find(tag => tag.id === 'rin-arms-at-sides').label,
      category: 'pose',
      slot: 'hand_action',
      suggestion_status: 'ADVISORY_ONLY',
      automatic_action: false,
      evidence: {
        classification: 'SPECIFIC_REPLACEMENT_SUGGESTION_SUPPORTED',
        source_run_ids: ['CAM-020-A', 'CAM-020-B'],
        model_profile: 'model.novaanimexl_ilv190',
        metrics: {
          candidate_requested_placement: { count: 6, total: 6 },
          candidate_complete_bilateral_hand_visibility: { count: 6, total: 6 },
          matched_visibility_improvement: { count: 6, total: 6 },
          candidate_ambiguity_or_artifact: { count: 0, total: 6 },
        },
      },
    }],
  }], 'promoter must carry the bounded pose/body-overlap owner as advisory evidence only')
  deepEqual(catalog.coverage, { active_prompt_tag_count: 2522, mapped_active_prompt_tag_count: 10, unmapped_active_prompt_tag_count: 2512 }, 'coverage must bind the exact active registry')
  deepEqual(Object.keys(catalog.source_binding), ['binding_record_type', 'binding_version', 'binding_sha256', 'graph_schema_id', 'graph_schema_version', 'registry_sha256'], 'catalog source binding must use schema identity and production inputs without full-Graph revision or digest coupling')
  equal(serialized, serializeVisualConceptProductionAdvisoryCatalogV1(catalog), 'promoted output must be byte-stable')
  check(isVisualConceptProductionAdvisoryArtifactCurrentV1(`${JSON.stringify(checkedInCatalog, null, 2)}\n`, serialized), 'checked-in artifact must equal fresh promotion bytes')
  check(!isVisualConceptProductionAdvisoryArtifactCurrentV1(`${serialized} `, serialized), 'stale artifact bytes must be rejected')
  check(!/research[\\/]|evidence\.|BRG-/i.test(serialized), 'production catalog must contain no Research path or panel-level evidence identity')

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
  const visibilityConceptChange = clone(graphContract)
  visibilityConceptChange.concepts.find(concept => concept.concept_id === 'visibility.hands').label = 'Changed hand visibility label'
  check(serializeVisualConceptProductionAdvisoryCatalogV1(projectVisualConceptProductionAdvisoryCatalogV1({ bindingContract, graphContract: visibilityConceptChange, promptTagRegistry: registry })) !== serialized, 'promoted visibility constraint change must stale the catalog')
  const invalidVisibilityConcept = clone(graphContract)
  invalidVisibilityConcept.concepts.find(concept => concept.concept_id === 'visibility.feet').concept_type = 'camera'
  equal(errorMessage(() => projectVisualConceptProductionAdvisoryCatalogV1({ bindingContract, graphContract: invalidVisibilityConcept, promptTagRegistry: registry })), 'visual_concept_production_constraint_contract_invalid', 'invalid visibility constraint owner must fail promotion closed')
  const invalidVisibilityModule = clone(graphContract)
  invalidVisibilityModule.concepts.find(concept => concept.concept_id === 'visibility.hands').module = 'camera'
  equal(errorMessage(() => projectVisualConceptProductionAdvisoryCatalogV1({ bindingContract, graphContract: invalidVisibilityModule, promptTagRegistry: registry })), 'visual_concept_production_constraint_contract_invalid', 'non-physical visibility owner must fail promotion closed')
  const runtimeInvalidVisibilityModule = clone(checkedInCatalog)
  runtimeInvalidVisibilityModule.constraint_concepts.find(concept => concept.concept_id === 'visibility.hands').concept_module = 'camera'
  equal(runtime.projectVisualConceptProductionAdvisoryV1({ catalog: runtimeInvalidVisibilityModule, blocks: [], sceneTags: [] }).unavailable_reason, 'catalog_contract_invalid', 'promotion and runtime must reject the same non-physical visibility owner')
  const weakenedEffect = clone(graphContract)
  weakenedEffect.unmodeled_effects.find(effect => effect.effect_id === 'unmodeled.pose_body_overlap.hand_visibility').confidence = 'medium'
  equal(errorMessage(() => projectVisualConceptProductionAdvisoryCatalogV1({ bindingContract, graphContract: weakenedEffect, promptTagRegistry: registry })), 'visual_concept_production_advisory_effect_contract_invalid', 'changed advisory evidence owner must fail promotion closed')
  const broadenedEvidence = clone(graphContract)
  broadenedEvidence.unmodeled_effects.find(effect => effect.effect_id === 'unmodeled.pose_body_overlap.hand_visibility').evidence_refs.push({
    ...broadenedEvidence.unmodeled_effects.find(effect => effect.effect_id === 'unmodeled.pose_body_overlap.hand_visibility').evidence_refs[0],
    evidence_ref_id: 'evidence.cam999a.unsupported',
    run_id: 'CAM-999-A',
  })
  equal(errorMessage(() => projectVisualConceptProductionAdvisoryCatalogV1({ bindingContract, graphContract: broadenedEvidence, promptTagRegistry: registry })), 'visual_concept_production_advisory_effect_contract_invalid', 'explanation provenance must remain bounded to admitted CAM-018 and CAM-019 runs')
  const invalidReplacementCandidateRegistry = registry.map(tag => tag.id === 'rin-arms-at-sides' ? { ...tag, prompt: 'arms somewhere else' } : tag)
  equal(errorMessage(() => projectVisualConceptProductionAdvisoryCatalogV1({ bindingContract, graphContract, promptTagRegistry: invalidReplacementCandidateRegistry })), 'visual_concept_production_replacement_candidate_contract_invalid', 'specific replacement promotion must bind the exact existing PromptTag identity')

  const legacyCatalog = structuredClone(checkedInCatalog)
  delete legacyCatalog.advisory_effects[0].specific_replacement_suggestions
  const legacyProjection = runtime.projectVisualConceptProductionAdvisoryV1({ catalog: legacyCatalog, blocks: [], sceneTags: [selected('pos-hands-behind-back')], constraintIntent: { record_type: 'visual_concept_compiler_constraint_intent_v1', version: 1, required_visible_region_concept_ids: ['visibility.hands'], minimum_framing_concept_id: null } })
  equal(legacyProjection.advisory_status, 'READY', 'a valid pre-suggestion V1 catalog must retain its existing advisory behavior')
  equal(legacyProjection.constraint_metadata.advisory_inspection.entries[0].recommendation.suggestion_type, 'review_current_pose', 'legacy V1 catalogs must preserve generic review guidance')
  deepEqual(legacyProjection.constraint_metadata.advisory_inspection.entries[0].recommendation.specific_replacement_suggestions, [], 'an omitted legacy V1 suggestion field must normalize to an empty candidate list')

  const defaultConstraintProjection = runtime.projectVisualConceptProductionAdvisoryV1({ catalog: checkedInCatalog, blocks: [], sceneTags: [] })
  deepEqual(defaultConstraintProjection.constraint_metadata, {
    record_type: 'visual_concept_compiler_constraint_metadata_v1',
    version: 1,
    requested: {
      record_type: 'visual_concept_compiler_constraint_intent_v1',
      version: 1,
      required_visible_region_concept_ids: [],
      minimum_framing_concept_id: null,
    },
    observed_generated_visibility: null,
    advisory_effects: [],
    advisory_inspection: {
      record_type: 'visual_concept_compiler_advisory_inspection_v1',
      version: 1,
      entries: [],
    },
  }, 'default compiler projection must preserve compatibility with explicit empty requested intent and no generated observation claim')
  const requestedConstraints = {
    record_type: 'visual_concept_compiler_constraint_intent_v1',
    version: 1,
    required_visible_region_concept_ids: ['visibility.feet', 'visibility.hands', 'visibility.head'],
    minimum_framing_concept_id: 'camera.framing.full_body',
  }
  const requestedSnapshot = clone(requestedConstraints)
  const admittedIntent = intentOwner.admitVisualConceptCompilerConstraintIntentV1(requestedConstraints)
  deepEqual(admittedIntent, requestedConstraints, 'the canonical Compiler input owner must admit the exact Graph visibility and framing identities')
  check(admittedIntent !== requestedConstraints && Object.isFrozen(admittedIntent) && Object.isFrozen(admittedIntent.required_visible_region_concept_ids), 'the canonical Compiler input owner must return an immutable snapshot without retaining caller ownership')
  deepEqual(intentOwner.VISUAL_CONCEPT_COMPILER_VISIBLE_REGION_CONCEPT_IDS_V1, ['visibility.feet', 'visibility.hands', 'visibility.head'], 'the canonical owner must expose the exact supported user-selectable visibility identities')
  const headRequired = intentOwner.setVisualConceptCompilerVisibleRegionRequirementV1(undefined, 'visibility.head', true)
  deepEqual(headRequired.required_visible_region_concept_ids, ['visibility.head'], 'the canonical owner must add an explicit visibility identity')
  const feetAndHeadRequired = intentOwner.setVisualConceptCompilerVisibleRegionRequirementV1(headRequired, 'visibility.feet', true)
  deepEqual(feetAndHeadRequired.required_visible_region_concept_ids, ['visibility.feet', 'visibility.head'], 'the canonical owner must retain deterministic Graph identity ordering')
  deepEqual(intentOwner.setVisualConceptCompilerVisibleRegionRequirementV1(feetAndHeadRequired, 'visibility.feet', true), feetAndHeadRequired, 'repeated explicit selection must be idempotent')
  deepEqual(intentOwner.setVisualConceptCompilerVisibleRegionRequirementV1(feetAndHeadRequired, 'visibility.head', false).required_visible_region_concept_ids, ['visibility.feet'], 'the canonical owner must remove only the explicit visibility identity')
  equal(intentOwner.setVisualConceptCompilerVisibleRegionRequirementV1(feetAndHeadRequired, 'visibility.unknown', true), null, 'unknown UI identities must fail canonical admission closed')
  check(Object.isFrozen(feetAndHeadRequired) && Object.isFrozen(feetAndHeadRequired.required_visible_region_concept_ids), 'canonical UI updates must produce immutable admitted snapshots')
  deepEqual(intentOwner.admitVisualConceptCompilerConstraintIntentV1(undefined), {
    record_type: 'visual_concept_compiler_constraint_intent_v1',
    version: 1,
    required_visible_region_concept_ids: [],
    minimum_framing_concept_id: null,
  }, 'omitted visibility intent must resolve to the canonical empty Compiler input')
  const constraintProjection = runtime.projectVisualConceptProductionAdvisoryV1({ catalog: checkedInCatalog, blocks: [], sceneTags: [selected('cam-upper-body'), selected('pos-hands-behind-back')], constraintIntent: requestedConstraints })
  deepEqual(constraintProjection.constraint_metadata.requested, requestedConstraints, 'requested constraint identity must round-trip without becoming selected or observed state')
  equal(constraintProjection.constraint_metadata.observed_generated_visibility, null, 'compiler must not infer generated visibility from requested intent or selected framing')
  deepEqual(constraintProjection.constraint_metadata.advisory_effects, catalog.advisory_effects, 'hand intent plus the admitted behind-body context must expose only the bounded Graph-owned risk advisory')
  deepEqual(constraintProjection.constraint_metadata.advisory_inspection, {
    record_type: 'visual_concept_compiler_advisory_inspection_v1',
    version: 1,
    entries: [{
      advisory_type: 'hand_visibility_risk',
      trigger_context: {
        required_visible_region_concept_ids: ['visibility.hands'],
        trigger_prompt_tags: [{ prompt_tag_id: 'pos-hands-behind-back', prompt: 'hands behind back', category: 'pose', slot: 'hand_action' }],
      },
      supporting_identity: {
        target_concept_id: 'visibility.hands',
        effect_id: 'unmodeled.pose_body_overlap.hand_visibility',
        model_profile: 'model.novaanimexl_ilv190',
      },
      evidence: {
        status: 'ADVISORY_ONLY',
        confidence: 'high',
        source_run_ids: ['CAM-018-A', 'CAM-018-B', 'CAM-018-C', 'CAM-018-D', 'CAM-019-A', 'CAM-019-B', 'CAM-019-C'],
      },
      explanation: {
        summary: graphContract.unmodeled_effects.find(effect => effect.effect_id === 'unmodeled.pose_body_overlap.hand_visibility').observed_effect,
      },
      recommendation: {
        suggestion_type: 'review_current_pose',
        message: 'Review the current pose or arm placement when complete hand visibility is required; no replacement is selected automatically.',
        replacement_prompt_tag_id: null,
        automatic_action: false,
        specific_replacement_suggestions: [{
          prompt_tag_id: 'rin-arms-at-sides',
          prompt: 'arms at sides',
          prompt_tag_label: registry.find(tag => tag.id === 'rin-arms-at-sides').label,
          category: 'pose',
          slot: 'hand_action',
          suggestion_status: 'ADVISORY_ONLY',
          automatic_action: false,
          evidence: {
            classification: 'SPECIFIC_REPLACEMENT_SUGGESTION_SUPPORTED',
            source_run_ids: ['CAM-020-A', 'CAM-020-B'],
            model_profile: 'model.novaanimexl_ilv190',
            metrics: {
              candidate_requested_placement: { count: 6, total: 6 },
              candidate_complete_bilateral_hand_visibility: { count: 6, total: 6 },
              matched_visibility_improvement: { count: 6, total: 6 },
              candidate_ambiguity_or_artifact: { count: 0, total: 6 },
            },
          },
        }],
      },
    }],
  }, 'triggered risk must expose one bounded review-only suggestion from the canonical inspection owner')
  const callerOwnedCatalog = clone(checkedInCatalog)
  const immutableInspection = runtime.projectVisualConceptProductionAdvisoryV1({ catalog: callerOwnedCatalog, blocks: [], sceneTags: [selected('pos-hands-behind-back')], constraintIntent: requestedConstraints }).constraint_metadata.advisory_inspection
  callerOwnedCatalog.advisory_effects[0].trigger_prompt_tags[0].prompt = 'mutated after projection'
  callerOwnedCatalog.advisory_effects[0].explanation.summary = 'mutated after projection'
  callerOwnedCatalog.advisory_effects[0].explanation.source_run_ids[0] = 'CAM-999-A'
  equal(immutableInspection.entries[0].trigger_context.trigger_prompt_tags[0].prompt, 'hands behind back', 'canonical inspection must not retain mutable caller-owned trigger records')
  check(Object.isFrozen(immutableInspection.entries[0].trigger_context.trigger_prompt_tags[0]), 'projected trigger records must be frozen with the rest of the read-only inspection snapshot')
  equal(immutableInspection.entries[0].evidence.source_run_ids[0], 'CAM-018-A', 'canonical inspection must copy bounded evidence provenance without retaining caller ownership')
  check(Object.isFrozen(immutableInspection.entries[0].evidence.source_run_ids) && Object.isFrozen(immutableInspection.entries[0].explanation) && Object.isFrozen(immutableInspection.entries[0].recommendation), 'explanation, provenance, and suggestion metadata must be immutable')
  equal(immutableInspection.entries[0].recommendation.replacement_prompt_tag_id, null, 'generic review_current_pose guidance must remain unchanged')
  equal(immutableInspection.entries[0].recommendation.specific_replacement_suggestions[0].prompt_tag_id, 'rin-arms-at-sides', 'bounded CAM-020 evidence must expose the exact supported PromptTag candidate')
  check(Object.isFrozen(immutableInspection.entries[0].recommendation.specific_replacement_suggestions) && Object.isFrozen(immutableInspection.entries[0].recommendation.specific_replacement_suggestions[0].evidence.metrics), 'specific replacement evidence must be copied into immutable inspection metadata')
  deepEqual(constraintProjection.mapped_entries.map(entry => entry.concept_id), ['camera.framing.upper_body'], 'selected framing identity must remain separate from requested minimum framing identity and an advisory trigger need not become a duplicate concept binding')
  deepEqual(requestedConstraints, requestedSnapshot, 'constraint projection must not mutate caller-owned intent')
  const constraintPrompt = promptModule.buildPromptWithStrategy([], [selected('cam-upper-body'), selected('pos-hands-behind-back')], 'illustrious', 'BREAK', requestedConstraints)
  equal(constraintPrompt.prompt, promptModule.buildPrompt([], [selected('cam-upper-body'), selected('pos-hands-behind-back')]), 'risk advisory metadata must leave exact prompt bytes unchanged')
  deepEqual(constraintPrompt.visualConceptAdvisory, constraintProjection, 'compiler must carry the canonical constraint projection unchanged')
  const headOnly = { ...requestedConstraints, required_visible_region_concept_ids: ['visibility.head'], minimum_framing_concept_id: null }
  deepEqual(runtime.projectVisualConceptProductionAdvisoryV1({ catalog: checkedInCatalog, blocks: [], sceneTags: [selected('pos-hands-behind-back')], constraintIntent: headOnly }).constraint_metadata.advisory_effects, [], 'pose/body-overlap evidence must remain bounded to requested hand visibility')
  deepEqual(runtime.projectVisualConceptProductionAdvisoryV1({ catalog: checkedInCatalog, blocks: [], sceneTags: [selected('pos-hands-behind-back')], constraintIntent: headOnly }).constraint_metadata.advisory_inspection.entries, [], 'non-hand intent must expose no structured risk inspection entry')
  deepEqual(runtime.projectVisualConceptProductionAdvisoryV1({ catalog: checkedInCatalog, blocks: [], sceneTags: [], constraintIntent: requestedConstraints }).constraint_metadata.advisory_effects, [], 'hand intent without an admitted risk context must not expose a risk advisory')
  deepEqual(runtime.projectVisualConceptProductionAdvisoryV1({ catalog: checkedInCatalog, blocks: [], sceneTags: [selected('pos-hands-behind-head')], constraintIntent: requestedConstraints }).constraint_metadata.advisory_effects, [], 'hands-behind-head must not inherit unsupported behind-body risk')
  deepEqual(runtime.projectVisualConceptProductionAdvisoryV1({ catalog: checkedInCatalog, blocks: [], sceneTags: [selected('pos-hands-on-hips')], constraintIntent: requestedConstraints }).constraint_metadata.advisory_effects, [], 'unrelated hand actions must not expose the bounded risk advisory')
  const subjectRiskProjection = runtime.projectVisualConceptProductionAdvisoryV1({ catalog: checkedInCatalog, blocks: [{ id: 'subject-risk', name: 'Subject risk', tags: [selected('pos-hands-behind-back')] }], sceneTags: [], constraintIntent: requestedConstraints })
  deepEqual(subjectRiskProjection.constraint_metadata.advisory_effects, catalog.advisory_effects, 'PromptBlock-selected admitted context must expose the same read-only risk advisory')
  const riskOnlyProjection = runtime.projectVisualConceptProductionAdvisoryV1({ catalog: checkedInCatalog, blocks: [], sceneTags: [selected('pos-hands-behind-back')] })
  deepEqual(riskOnlyProjection.constraint_metadata.advisory_effects, [], 'admitted risk context without requested hand visibility must remain advisory-silent')
  const collidingUserTag = { id: 'pos-hands-behind-back', prompt: 'holding a flower', label: 'Custom collision', category: 'pose', slot: 'hand_action', weight: 1 }
  deepEqual(runtime.projectVisualConceptProductionAdvisoryV1({ catalog: checkedInCatalog, blocks: [], sceneTags: [collidingUserTag], constraintIntent: requestedConstraints }).constraint_metadata.advisory_effects, [], 'a caller-owned tag colliding only by ID must not impersonate the admitted production risk context')
  deepEqual(runtime.projectVisualConceptProductionAdvisoryV1({ catalog: checkedInCatalog, blocks: [], sceneTags: [collidingUserTag], constraintIntent: requestedConstraints }).constraint_metadata.advisory_inspection.entries, [], 'caller-owned ID collisions must remain absent from the canonical inspection surface')
  const malformedTrigger = clone(checkedInCatalog)
  malformedTrigger.advisory_effects[0].trigger_prompt_tags[0].prompt_tag_id = 'pos-hands-behind-head'
  equal(runtime.projectVisualConceptProductionAdvisoryV1({ catalog: malformedTrigger, blocks: [], sceneTags: [], constraintIntent: requestedConstraints }).unavailable_reason, 'catalog_contract_invalid', 'runtime must reject an unapproved risk trigger')
  for (const invalidIntent of [
    { ...requestedConstraints, required_visible_region_concept_ids: ['visibility.hands', 'visibility.hands'] },
    { ...requestedConstraints, required_visible_region_concept_ids: ['visibility.head', 'visibility.feet'] },
    { ...requestedConstraints, required_visible_region_concept_ids: new Array(1) },
    { ...requestedConstraints, required_visible_region_concept_ids: ['visibility.knees'] },
    { ...requestedConstraints, minimum_framing_concept_id: 'camera.framing.portrait' },
    { ...requestedConstraints, observed_generated_visibility: 'VISIBLE' },
  ]) {
    equal(intentOwner.admitVisualConceptCompilerConstraintIntentV1(invalidIntent), null, 'the canonical input owner must reject malformed, duplicate, unordered, unknown, or observation-bearing intent')
    equal(runtime.projectVisualConceptProductionAdvisoryV1({ catalog: checkedInCatalog, blocks: [], sceneTags: [], constraintIntent: invalidIntent }).unavailable_reason, 'projection_input_invalid', 'malformed, duplicate, unordered, unknown, or observation-bearing intent must fail closed')
  }

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
  check(appSource.includes('Visual Concept advisory unavailable') && appSource.includes('No mapped concepts for this selection.'), 'Inspector must expose unavailable and genuinely empty no-mapped states')
  check(appSource.includes('const visualConceptRiskEntries = visualConceptAdvisory.constraint_metadata.advisory_inspection.entries') && appSource.includes('visualConceptRiskEntries.map'), 'App must render only advisory entries already returned by the canonical Compiler inspection projection')
  const riskAnnouncement = appSource.indexOf('className="visual-concept-risk-advisory-announcement" role="status" aria-live="polite"')
  const riskAnnouncementEnd = appSource.indexOf('</div>', riskAnnouncement)
  const informationalAssurance = appSource.indexOf('Informational only — your prompt and selections are unchanged.')
  check(riskAnnouncement > 0 && riskAnnouncementEnd > riskAnnouncement && informationalAssurance > riskAnnouncementEnd && !appSource.includes('className="visual-concept-risk-advisory" role="status"'), 'only the concise warning and recommendation must render as the live non-blocking status')
  check(appSource.includes('Hand visibility may be reduced by the current pose or arm placement.') && appSource.includes('Review current pose or arm placement.') && appSource.includes('Informational only — your prompt and selections are unchanged.'), 'the default risk card must present the approved concise warning, recommendation, and non-mutating assurance')
  const evidenceDetails = appSource.indexOf('<details className="visual-concept-risk-advisory-details">')
  check(evidenceDetails > 0 && appSource.indexOf('Evidence details', evidenceDetails) > evidenceDetails, 'technical advisory content must use one collapsed Evidence details disclosure')
  check(appSource.indexOf('entry.explanation.summary', evidenceDetails) > evidenceDetails && appSource.indexOf('entry.recommendation.message', evidenceDetails) > evidenceDetails && appSource.indexOf('entry.recommendation.suggestion_type', evidenceDetails) > evidenceDetails, 'owner-projected evidence metrics and internal suggestion data must remain available only inside Evidence details')
  check([
    "entry.trigger_context.required_visible_region_concept_ids.join(' · ')",
    "entry.trigger_context.trigger_prompt_tags.map(tag=>tag.prompt_tag_id).join(' · ')",
    "entry.evidence.source_run_ids.join(' · ')",
    'entry.advisory_type',
    'entry.evidence.status',
    'entry.evidence.confidence',
    'entry.supporting_identity.target_concept_id',
    'entry.supporting_identity.effect_id',
    'entry.supporting_identity.model_profile',
  ].every(value => appSource.indexOf(value, evidenceDetails) > evidenceDetails), 'provenance, confidence, identities, runs, and model details must remain behind the Evidence details disclosure')
  check(appSource.includes("entry.trigger_context.required_visible_region_concept_ids.join(' · ')") && appSource.includes("entry.trigger_context.trigger_prompt_tags.map(tag=>tag.prompt_tag_id).join(' · ')") && appSource.includes("entry.evidence.source_run_ids.join(' · ')") && appSource.includes('entry.advisory_type') && appSource.includes('entry.evidence.status') && appSource.includes('entry.evidence.confidence') && appSource.includes('entry.supporting_identity.target_concept_id') && appSource.includes('entry.supporting_identity.effect_id'), 'the warning must expose bounded context and provenance from the canonical inspection entry rather than recreating semantics')
  check(!appSource.includes("advisory_type==='hand_visibility_risk'") && !appSource.includes("required_visible_region_concept_ids.includes('visibility.hands')"), 'App must not duplicate the canonical advisory trigger predicate')
  check(!appSource.includes('review_current_pose') && !appSource.includes('rin-arms-at-sides'), 'App must not own suggestion semantics or invent an unsupported replacement identity')
  check(appSource.includes('entry.recommendation.specific_replacement_suggestions.map') && appSource.includes('suggestion.prompt_tag_id') && appSource.includes('suggestion.evidence.metrics.matched_visibility_improvement'), 'App must render the canonical bounded candidate and evidence without owning either identity')
  check(appSource.includes('suggestion.evidence.model_profile'), 'the visible candidate recommendation must disclose its bounded model evidence instead of implying cross-model support')
  check(appSource.includes("buildPromptWithStrategy(store.blocks, store.sceneTags, store.modelPreset, 'BREAK', store.visualConceptConstraintIntent)"), 'App must supply the canonical store snapshot to the existing Compiler input')
  const labelOwner = appSource.indexOf('const VISUAL_CONCEPT_VISIBILITY_LABEL_V1')
  const headLabel = appSource.indexOf("'visibility.head': 'Head visible'", labelOwner)
  const handsLabel = appSource.indexOf("'visibility.hands': 'Both hands visible'", labelOwner)
  const feetLabel = appSource.indexOf("'visibility.feet': 'Both feet visible'", labelOwner)
  check(appSource.includes("'visibility.head': 0") && appSource.includes("'visibility.hands': 1") && appSource.includes("'visibility.feet': 2") && headLabel > 0 && headLabel < handsLabel && handsLabel < feetLabel && appSource.includes('VISUAL_CONCEPT_VISIBILITY_PRESENTATION_V1.map(({conceptId,label})'), 'App controls must present all canonical visibility identities in the approved natural user-facing order')
  check(appSource.includes('<span>{label}</span>') && appSource.includes('<code>{conceptId}</code>'), 'friendly visibility labels must lead while canonical IDs remain available as secondary technical detail')
  const acknowledgementRender = appSource.indexOf('visibilityIntentAcknowledgement&&<div className="visual-concept-advisory-empty"')
  const mappedEntryBranch = appSource.indexOf('visualConceptAdvisory.mapped_entries.length===0')
  check(appSource.includes('const visibilityIntentAcknowledgement = requiredVisibleRegionConceptIds.length > 0 && visualConceptRiskEntries.length === 0') && appSource.includes('No known visibility risk for the current selection.') && acknowledgementRender > 0 && acknowledgementRender < mappedEntryBranch, 'active visibility intent without a known risk must be acknowledged independently of mapped PromptTags')
  check(appSource.includes('setVisualConceptVisibleRegionRequired(conceptId,event.target.checked)') && !appSource.includes('observed_generated_visibility'), 'App must submit explicit user intent without claiming observed/generated visibility')
  check(appSource.includes('MAPPED') && appSource.includes('UNCOVERED') && appSource.includes('TOTAL'), 'Inspector must distinguish all three coverage counts')
  check(appSource.includes('Uncovered selected tags') && appSource.includes('entry.prompt_tag_id') && appSource.includes('entry.prompt_tag_label'), 'Inspector must expose uncovered tag identities in a secondary list')
  check(appSource.includes('<details className="visual-concept-advisory-uncovered">'), 'uncovered identities must remain collapsed by default using an accessible native disclosure')
  check(appSource.includes('entry.owner_kind') && appSource.includes('entry.owner_id'), 'Inspector must show exact selected-tag ownership')
  check(!appSource.includes('visualConceptAdvisory.relations'), 'production V1 UI must not display relations')
  check(appSource.includes('const visualConceptAdvisory = expansion.visualConceptAdvisory'), 'Prompt Inspector must consume the compiler-carried semantic identity field')
  check(!appSource.includes("from './visualConceptProductionAdvisoryV1'") && !appSource.includes("from './data/visual-concept-production-advisory-v1.json'"), 'App must not create parallel semantic ownership by importing the projector or catalog directly')
  check(storeSource.includes('setVisualConceptCompilerVisibleRegionRequirementV1') && !storeSource.includes("['visibility.head'") && !storeSource.includes("['visibility.hands'") && !storeSource.includes("['visibility.feet'"), 'store must delegate canonical identity admission and ordering without duplicating the supported concept set')
  check(promptSource.includes('const expansion = expandPrompt(') && promptSource.indexOf('const expansion = expandPrompt(') < promptSource.indexOf('visualConceptAdvisory: projectVisualConceptProductionAdvisoryV1('), 'compiler must render through the existing expansion path before adding semantic identity metadata')
  check(stylesSource.includes('.visual-concept-advisory-entry') && stylesSource.includes('.visual-concept-advisory-coverage') && stylesSource.includes('.visual-concept-advisory-uncovered') && stylesSource.includes('.visual-concept-risk-advisory'), 'advisory must have deterministic Inspector-native visual treatment')
  check(!runtimeSource.includes('usePromptStore') && !runtimeSource.includes('buildPrompt') && !runtimeSource.includes('research/'), 'runtime owner must be pure and independent of store, compiler, and Research Repository')
  check(runtimeSource.includes("from './visualConceptCompilerConstraintIntentV1'") && !runtimeSource.includes('function validateConstraintIntent'), 'advisory projection must consume the canonical Compiler input owner rather than duplicate its validation')
  check(intentOwnerSource.includes('admitVisualConceptCompilerConstraintIntentV1') && intentOwnerSource.includes('setVisualConceptCompilerVisibleRegionRequirementV1') && !intentOwnerSource.includes('PromptBlock') && !intentOwnerSource.includes('SelectedTag'), 'canonical visibility intent ownership must remain independent of PromptTag selection and advisory projection')

  console.log(`Visual Concept production advisory tests passed: ${assertionCount} assertions`)
} finally {
  await server.close()
}
