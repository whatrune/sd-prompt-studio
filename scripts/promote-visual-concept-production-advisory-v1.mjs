#!/usr/bin/env node

import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createServer } from 'vite'
import { createVisualConceptReadOnlyEntryAdapterV1 } from './visual-concept-read-only-entry-adapter-v1.mjs'

const RECORD_TYPE = 'visual_concept_production_advisory_catalog_v1'
const APPROVED_MAPPINGS = Object.freeze([
  Object.freeze({ prompt_tag_id: 'cam-close-up', concept_id: 'camera.framing.close_up' }),
  Object.freeze({ prompt_tag_id: 'cam-cowboy-shot', concept_id: 'camera.framing.cowboy_shot' }),
  Object.freeze({ prompt_tag_id: 'cam-full-body', concept_id: 'camera.framing.full_body' }),
  Object.freeze({ prompt_tag_id: 'cam-upper-body', concept_id: 'camera.framing.upper_body' }),
  Object.freeze({ prompt_tag_id: 'hai-long-hair', concept_id: 'hair.long' }),
  Object.freeze({ prompt_tag_id: 'pos-lying', concept_id: 'body.state.lying' }),
  Object.freeze({ prompt_tag_id: 'pos-lying-on-back', concept_id: 'body.orientation.face_up' }),
  Object.freeze({ prompt_tag_id: 'rin-pose-arm-support', concept_id: 'support.arm.rearward' }),
  Object.freeze({ prompt_tag_id: 'rin-pose-reclining', concept_id: 'body.state.reclined' }),
  Object.freeze({ prompt_tag_id: 'v192-bent-knees', concept_id: 'configuration.knee.bent' }),
])
const APPROVED_CONSTRAINT_CONCEPT_IDS = Object.freeze([
  'visibility.feet',
  'visibility.hands',
  'visibility.head',
])
const APPROVED_ADVISORY_EFFECT = Object.freeze({
  advisory_id: 'hand_visibility_risk',
  effect_id: 'unmodeled.pose_body_overlap.hand_visibility',
  target_concept_id: 'visibility.hands',
  trigger_prompt_tags: Object.freeze([Object.freeze({
    prompt_tag_id: 'pos-hands-behind-back',
    prompt: 'hands behind back',
    category: 'pose',
    slot: 'hand_action',
  })]),
})
const APPROVED_ADVISORY_EVIDENCE_RUN_IDS = Object.freeze([
  'CAM-018-A',
  'CAM-018-B',
  'CAM-018-C',
  'CAM-018-D',
  'CAM-019-A',
  'CAM-019-B',
  'CAM-019-C',
])
const APPROVED_SPECIFIC_REPLACEMENT_SUGGESTION = Object.freeze({
  prompt_tag_id: 'rin-arms-at-sides',
  prompt: 'arms at sides',
  category: 'pose',
  slot: 'hand_action',
})
const APPROVED_SPECIFIC_REPLACEMENT_EVIDENCE = Object.freeze({
  classification: 'SPECIFIC_REPLACEMENT_SUGGESTION_SUPPORTED',
  source_run_ids: Object.freeze(['CAM-020-A', 'CAM-020-B']),
  model_profile: 'model.novaanimexl_ilv190',
  metrics: Object.freeze({
    candidate_requested_placement: Object.freeze({ count: 6, total: 6 }),
    candidate_complete_bilateral_hand_visibility: Object.freeze({ count: 6, total: 6 }),
    matched_visibility_improvement: Object.freeze({ count: 6, total: 6 }),
    candidate_ambiguity_or_artifact: Object.freeze({ count: 0, total: 6 }),
  }),
})

const sha256 = value => createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex')

function exactApprovedBindings(bindings) {
  return Array.isArray(bindings)
    && bindings.length === APPROVED_MAPPINGS.length
    && bindings.every((binding, index) => binding?.prompt_tag_id === APPROVED_MAPPINGS[index].prompt_tag_id
      && binding?.concept_id === APPROVED_MAPPINGS[index].concept_id)
}

export function projectVisualConceptProductionAdvisoryCatalogV1({ bindingContract, graphContract, promptTagRegistry }) {
  if (!Array.isArray(promptTagRegistry)) throw new Error('binding_identity_conflict')
  const selectedById = new Map(promptTagRegistry.map(tag => [tag.id, tag]))
  const projectionInput = {
    blocks: [{
      id: 'production-advisory-promotion',
      name: 'Production advisory promotion',
      tags: Array.isArray(bindingContract?.bindings)
        ? bindingContract.bindings.map(binding => {
          const tag = selectedById.get(binding?.prompt_tag_id)
          return tag ? { ...tag, weight: 1 } : { id: binding?.prompt_tag_id, prompt: '', label: '', category: '', weight: 1 }
        })
        : [],
    }],
    sceneTags: [],
  }
  const projection = createVisualConceptReadOnlyEntryAdapterV1({ bindingContract, graphContract, promptTagRegistry })(projectionInput)
  if (projection.status !== 'PROJECTED') throw new Error(projection.reason)
  if (!exactApprovedBindings(bindingContract.bindings)) throw new Error('visual_concept_production_binding_scope_invalid')

  const concepts = new Map(graphContract.concepts.map(concept => [concept.concept_id, concept]))
  const mappings = bindingContract.bindings.map(binding => {
    const concept = concepts.get(binding.concept_id)
    if (!concept
      || typeof concept.label !== 'string' || !concept.label
      || typeof concept.module !== 'string' || !concept.module
      || typeof concept.concept_type !== 'string' || !concept.concept_type) {
      throw new Error('visual_concept_production_concept_contract_invalid')
    }
    return Object.freeze({
      prompt_tag_id: binding.prompt_tag_id,
      concept_id: binding.concept_id,
      concept_label: concept.label,
      concept_module: concept.module,
      concept_type: concept.concept_type,
      concept_status: concept.status,
    })
  })
  const constraintConcepts = APPROVED_CONSTRAINT_CONCEPT_IDS.map(conceptId => {
    const concept = concepts.get(conceptId)
    if (!concept
      || concept.concept_type !== 'visibility'
      || typeof concept.label !== 'string' || !concept.label
      || concept.module !== 'physical'
      || (concept.status !== 'provisional' && concept.status !== 'confirmed')) {
      throw new Error('visual_concept_production_constraint_contract_invalid')
    }
    return Object.freeze({
      concept_id: concept.concept_id,
      concept_label: concept.label,
      concept_module: concept.module,
      concept_type: concept.concept_type,
      concept_status: concept.status,
    })
  })
  const sourceEffect = graphContract.unmodeled_effects?.find(effect => effect?.effect_id === APPROVED_ADVISORY_EFFECT.effect_id)
  const evidenceRunIds = Array.isArray(sourceEffect?.evidence_refs)
    ? [...new Set(sourceEffect.evidence_refs.map(reference => reference?.run_id))].sort()
    : []
  if (!sourceEffect
    || sourceEffect.target_region !== 'hands'
    || sourceEffect.category !== 'model_specific'
    || sourceEffect.promotion_status !== 'observed'
    || sourceEffect.confidence !== 'high'
    || sourceEffect.model_profile !== 'model.novaanimexl_ilv190'
    || typeof sourceEffect.observed_effect !== 'string' || sourceEffect.observed_effect.length === 0
    || !Array.isArray(sourceEffect.evidence_refs) || sourceEffect.evidence_refs.length === 0
    || sourceEffect.evidence_refs.some(reference => typeof reference?.evidence_ref_id !== 'string'
      || typeof reference?.run_id !== 'string'
      || typeof reference?.observation_path !== 'string'
      || typeof reference?.metric !== 'string'
      || !Number.isSafeInteger(reference?.count) || reference.count < 0
      || !Number.isSafeInteger(reference?.total) || reference.total < 1 || reference.count > reference.total
      || reference?.confidence !== 'high' || reference?.storage !== 'local')
    || evidenceRunIds.length !== APPROVED_ADVISORY_EVIDENCE_RUN_IDS.length
    || evidenceRunIds.some((runId, index) => runId !== APPROVED_ADVISORY_EVIDENCE_RUN_IDS[index])) {
    throw new Error('visual_concept_production_advisory_effect_contract_invalid')
  }
  const triggerPromptTags = APPROVED_ADVISORY_EFFECT.trigger_prompt_tags.map(trigger => selectedById.get(trigger.prompt_tag_id))
  if (triggerPromptTags.some((tag, index) => !tag
    || tag.prompt !== APPROVED_ADVISORY_EFFECT.trigger_prompt_tags[index].prompt
    || tag.category !== APPROVED_ADVISORY_EFFECT.trigger_prompt_tags[index].category
    || tag.slot !== APPROVED_ADVISORY_EFFECT.trigger_prompt_tags[index].slot)) {
    throw new Error('visual_concept_production_advisory_trigger_contract_invalid')
  }
  const replacementCandidate = selectedById.get(APPROVED_SPECIFIC_REPLACEMENT_SUGGESTION.prompt_tag_id)
  if (!replacementCandidate
    || replacementCandidate.prompt !== APPROVED_SPECIFIC_REPLACEMENT_SUGGESTION.prompt
    || replacementCandidate.category !== APPROVED_SPECIFIC_REPLACEMENT_SUGGESTION.category
    || replacementCandidate.slot !== APPROVED_SPECIFIC_REPLACEMENT_SUGGESTION.slot
    || typeof replacementCandidate.label !== 'string' || replacementCandidate.label.length === 0) {
    throw new Error('visual_concept_production_replacement_candidate_contract_invalid')
  }
  const advisoryEffects = Object.freeze([Object.freeze({
    advisory_id: APPROVED_ADVISORY_EFFECT.advisory_id,
    effect_id: sourceEffect.effect_id,
    target_concept_id: APPROVED_ADVISORY_EFFECT.target_concept_id,
    trigger_prompt_tags: APPROVED_ADVISORY_EFFECT.trigger_prompt_tags,
    advisory_status: 'ADVISORY_ONLY',
    confidence: sourceEffect.confidence,
    model_profile: sourceEffect.model_profile,
    explanation: Object.freeze({
      summary: sourceEffect.observed_effect,
      source_run_ids: Object.freeze(evidenceRunIds),
    }),
    specific_replacement_suggestions: Object.freeze([Object.freeze({
      prompt_tag_id: replacementCandidate.id,
      prompt: replacementCandidate.prompt,
      prompt_tag_label: replacementCandidate.label,
      category: replacementCandidate.category,
      slot: replacementCandidate.slot,
      suggestion_status: 'ADVISORY_ONLY',
      automatic_action: false,
      evidence: APPROVED_SPECIFIC_REPLACEMENT_EVIDENCE,
    })]),
  })])

  return Object.freeze({
    record_type: RECORD_TYPE,
    version: 1,
    source_binding: Object.freeze({
      binding_record_type: bindingContract.record_type,
      binding_version: bindingContract.version,
      binding_sha256: sha256(bindingContract),
      graph_schema_id: bindingContract.graph_schema_id,
      graph_schema_version: graphContract.schema_version,
      registry_sha256: sha256(promptTagRegistry),
    }),
    coverage: Object.freeze({
      active_prompt_tag_count: promptTagRegistry.length,
      mapped_active_prompt_tag_count: mappings.length,
      unmapped_active_prompt_tag_count: promptTagRegistry.length - mappings.length,
    }),
    mappings: Object.freeze(mappings),
    constraint_concepts: Object.freeze(constraintConcepts),
    advisory_effects: advisoryEffects,
    relations: Object.freeze([]),
  })
}

export const serializeVisualConceptProductionAdvisoryCatalogV1 = catalog => `${JSON.stringify(catalog, null, 2)}\n`
export const isVisualConceptProductionAdvisoryArtifactCurrentV1 = (checkedIn, projected) => checkedIn === projected

async function acquireProductionPromptTagRegistryV1(repoRoot) {
  const server = await createServer({ root: repoRoot, configFile: false, logLevel: 'silent', server: { middlewareMode: true }, appType: 'custom' })
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

export async function runVisualConceptProductionAdvisoryPromotionV1(argv, output = process.stdout, errorOutput = process.stderr) {
  if (argv.length > 1 || (argv.length === 1 && argv[0] !== '--check')) throw new Error('visual_concept_production_promotion_arguments_invalid')
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
  const repoRoot = path.resolve(scriptDirectory, '..')
  const bindingContract = JSON.parse(fs.readFileSync(path.join(repoRoot, 'data', 'visual-concept-prompt-tag-bindings-v1.json'), 'utf8'))
  const graphContract = JSON.parse(fs.readFileSync(path.join(repoRoot, 'research', 'sd-prompt-research', 'dist', 'visual-concept-graph.json'), 'utf8'))
  const promptTagRegistry = await acquireProductionPromptTagRegistryV1(repoRoot)
  const serialized = serializeVisualConceptProductionAdvisoryCatalogV1(projectVisualConceptProductionAdvisoryCatalogV1({ bindingContract, graphContract, promptTagRegistry }))
  if (argv[0] === '--check') {
    const artifactPath = path.join(repoRoot, 'src', 'data', 'visual-concept-production-advisory-v1.json')
    const checkedIn = fs.existsSync(artifactPath) ? fs.readFileSync(artifactPath, 'utf8') : ''
    if (!isVisualConceptProductionAdvisoryArtifactCurrentV1(checkedIn, serialized)) {
      errorOutput.write('visual_concept_production_advisory_stale\n')
      return 1
    }
    output.write('Visual Concept production advisory promotion check passed.\n')
    return 0
  }
  output.write(serialized)
  return 0
}

const isDirectInvocation = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
if (isDirectInvocation) {
  try {
    process.exitCode = await runVisualConceptProductionAdvisoryPromotionV1(process.argv.slice(2))
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : 'visual_concept_production_promotion_failed'}\n`)
    process.exitCode = 1
  }
}
