# Visual Concept Graph Architecture

## Purpose

SD Prompt Studio is evolving toward a Visual Concept Compiler:

```text
Human Intent
  -> Visual Concept Analysis
  -> Concept Graph Construction
  -> Constraint / Relation / Visibility Resolution
  -> Stable Diffusion-oriented Prompt Rendering
```

The graph introduced here is a prototype knowledge-source and generated design artifact. It is not yet a production compiler input. It does not replace the existing application, research runs, Observation Schema v3.0, Image Analyst, aggregate generation, Research Packet generation, import flow, or pose-specific behavior that already exists. It complements the runtime direction described in [Visual_Concept_Compiler.md](architecture/Visual_Concept_Compiler.md) and the future runtime IR in [PromptNode.ts](schemas/PromptNode.ts).

## Three layers

### Human Intent Layer

Natural user concepts such as `bridge`, `wheel pose`, `lying down`, `elf doctor`, and `warrior` enter through an Intent Profile. Human names are not treated as already-resolved model instructions.

### Structural Concept Layer

The compiler core consists of reusable structural concepts and edges: body state and orientation, body-part configuration, contact and contact load, support and spatial relations, visibility, clothing, hair, expression, gaze, species, semantic role, objects, environment, camera, lighting, and effects.

This layer keeps human meaning separate from observed model behavior. Contact, support, visibility, and interpretation are separate facts. A phrase can therefore mean one thing to a human while having a context-dependent observed model behavior.

### Interpretation / Target Pattern Layer

Patterns such as `pattern.pose.full_bridge` and `pattern.pose.reclined_arm_support` describe structural interpretations or evaluation targets. They do not own or duplicate the structural concepts they reference. A matcher may later compare an observed graph to these patterns, but this phase only defines the data and an illustrative example.

Bridge, Wheel, and Lying remain useful as Human Intent entry points, research folder classifications, evaluation patterns, and profiles that expand into structural concepts. They are not the top-level ontology and should not grow into independent large resolver families.

## Sparse modular graph

The graph is sparse: a subject expands only the modules needed for the request. It does not require every person to contain every body, face, hair, clothing, identity, role, object, environment, camera, lighting, and effect field.

The initial editable source split is deliberately coarse:

```text
research/sd-prompt-research/
  concepts/
    physical-concepts.json
    semantic-concepts.json
    relations.json
    target-patterns.json
    unmodeled-effects.json
```

Concept IDs are globally unique and stable. Module names are validated independently from file boundaries, so a large source can later be split into `body.json`, `head-face.json`, or `clothing.json` without changing IDs or graph semantics.

The boundary is:

- Core Concept Graph: stable concept IDs, constraints, relations, scope, evidence regions, confidence, and status.
- Optional Domain Modules: physical detail, face, hair, clothing, identity, semantic roles, objects, environment, camera, lighting, and effects, expanded only when relevant.
- Structured Unmodeled Effects: typed records for observations that do not yet have a formal axis.
- Target Pattern Profiles: thin intent/evaluation profiles that reference the core graph.

Resolver-critical information—body state, orientation, contact, contact load, support, visibility, conflict, scope, and evidence region—must use explicit concepts or relations rather than an `other` string. Optional domain data remains sparse and unobserved fields are omitted rather than filled with guesses.

## Three storage responsibilities

### Run observations

`experiments/.../observation.json` remains primary experimental evidence. The graph stores short references containing a run ID, path, metric, count/total when applicable, and confidence. It never copies a complete observation or panel record into concept knowledge.

### Module source

`research/sd-prompt-research/concepts/*.json` is the human- and Codex-edited knowledge source. JSON has no comments, so explanations belong in `description`, `human_meaning`, `notes`, or other explicit fields. Files use stable formatting for reviewable Git diffs.

### Distribution graph

`research/sd-prompt-research/dist/visual-concept-graph.json` is a generated prototype distribution and must not be hand-edited. It is the canonical output of this prototype builder, but the production Compiler does not consume it yet. The repository root `dist/` is reserved for Vite application output, so the knowledge artifact lives under the research project.

The flow is:

```text
concepts/*.json
  -> JSON Schema validation
  -> duplicate / alias / reference / evidence validation
  -> stable merge
  -> ID-based index generation
  -> dist/visual-concept-graph.json
```

## Schema and versions

`research/sd-prompt-research/schemas/visual-concept-graph.schema.json` is a Draft 2020-12 schema. It validates both module sources through `$defs.sourceModule` and the integrated distribution root.

- `schema_version: 0.2.0` describes the prototype data format, including Hair Effects and Control Context Profiles.
- `graph_version: 0.2.0` describes the current prototype knowledge content.

The root uses arrays for concepts and edges because stable ordered output produces readable diffs and each item carries its own ID. Generated indexes provide constant-time lookup without duplicating full objects. Indexes contain IDs or array offsets only.

Concept fields are conditional and sparse. For example, species requires entity/morphology fields, semantic roles require a role category, and clothing requires its three effect groups. Unrelated concepts do not carry empty species or clothing structures.

Observation Schema v3.0 is independent and unchanged.

## Relations as edges

A cross-domain phrase is registered once. `orientation.head.extended_backward`, for example, is a head/neck concept. Candidate changes to gaze, eyelids, mouth, or expression are represented by `may_trigger` edges and a structured unmodeled-effect candidate. They are not duplicated as alternate copies of “head back” in face modules.

Edges can encode support, contact, relative position, covering, obscuring, visibility, bias, strength, conflict, requirement, implication, possible triggers, observed interpretations, and candidate interpretations. Model profile and evidence references make context dependence explicit.

## Species as entity type

Species is an entity type, not an appearance tag. The initial `species.elf` distinguishes:

- required morphology: pointed ears;
- optional priors: slender proportions, fantasy clothing, forest environment;
- conflicts: conventional rounded human ears;
- visibility requirement: the ears must be visible;
- morphology strength: weak.

`species.mermaid` demonstrates a transformative morphology strength and requires a mermaid lower body. A weak elf prior and a body-transforming mermaid constraint therefore do not carry equal force.

## Semantic Role packages

Roles are semantic packages, not clothing. `role.occupation.doctor`, `clothing.outer.white_coat`, `object.stethoscope`, `environment.medical`, `activity.examining`, and `face.expression.professional` are independent concepts connected by optional bias edges.

Role categories are separate: occupation, rank, narrative role, situational role, and activity role. Doctor, queen, warrior, patient, and dancer can therefore be represented without flattening their semantics into one undifferentiated tag type.

## Clothing effects

Clothing can record three separate aspects:

1. Intrinsic properties: garment type, fit, length, material behavior, and covered regions.
2. Visibility effects: which structural evidence may be hidden or weakened.
3. Generative effects: observed model priors or artifact risks.

`clothing.upper.oversized_white_tshirt` records loose fit, drape, and possible pelvis-boundary occlusion. Its generative-effects list is empty because this phase has no dedicated evidence establishing casual, reclined, athletic, or artifact priors. Generative effects require evidence and a provisional or confirmed status; they are never promoted from intuition alone.

The fixed BRG-007 clothing is represented by `context.baseline_casual_v1`. It records the fixed phrases and linked clothing concepts for the oversized white T-shirt and black shorts. A fixed control is a baseline that reduces variation; it is not evidence that clothing has no effect. The profile records provisional pelvis-boundary risks, while the unevidenced torso-arch risk remains explicitly `unconfirmed`. It asserts no generative pose bias.

## Hair effects

Hair is also an influence source rather than a pure appearance tag. `hair.long` has intrinsic length/drape information and separate visibility-effect candidates for neck boundaries, shoulder contact boundaries, and hand-near-head overlap. These candidates are `draft` and `unconfirmed`; they demonstrate the schema without claiming BRG-007 evidence. Hair generative effects remain empty until observed evidence exists.

## Structured unmodeled effects

There is no free-form `other` bucket. Unmodeled effects use explicit categories: `unknown`, `unmodeled`, `rare_variant`, `model_specific`, `ambiguous_mapping`, and `cross_domain_effect`.

Each record can identify its source phrase/concept, target module/region, observed effect, evidence region, frequency, confidence, candidate axis, model profile, evidence references, and promotion state. Promotion states prepare for later review but do not implement automatic promotion.

Promotion may be nominated only when evidence supports factors such as reproduction across runs, sufficient frequency, resolver relevance, conflict or visibility requirements, or reproducible secondary effects. `unmodeled.head_extension.face_drift_candidate` remains a low-confidence candidate because BRG-007 does not establish the proposed face effects.

## Target patterns and Bridge

Bridge is represented by `intent.pose.bridge` and the provisional `pattern.pose.full_bridge`. The pattern references reusable concepts for face-up orientation, torso arch, pelvis elevation, hand and foot load, back separation, preferred configurations, conflicts, and evidence visibility.

BRG-007 remains untouched evidence. The graph includes path-and-metric references for:

- BRG-007-A: current canonical observation is lying/face-up; hip elevation/contact remains unclear under the visible-evidence policy.
- BRG-007-B: reclined and `reclined_arm_support` occur in 5/6 panels; rearward arm support is provisional and context/model dependent.
- BRG-007-C: lying occurs in 6/6 panels; arm/forearm contact does not establish reliable weight-bearing support.

The static fixture at `research/sd-prompt-research/examples/bridge-intent-profile-example.json` shows Intent Profile expansion, an observed BRG-007-B-like graph, unmet or unverified full-bridge constraints, and `reclined_arm_support` as an alternative candidate. It is not a completed resolver, matcher, prompt-success judgment, or research conclusion.

The BRG-007-B mapping explicitly separates visible floor contact from the interpreted rearward support relation. It records `body_state: reclined`, `body_orientation: face_up`, medium torso arch, unclear hip elevation, a hand/forearm-to-upper-body support candidate, and a mechanical `full_bridge: not_matched` example with missing and conflicting constraints. That target evaluation is a design fixture, not a rewrite of `observation.json`.

## Observation and interpretation responsibilities

The parallel data flow is:

```text
observation.json
  -> Concept Graph Mapping
  -> prototype concept-graph result
  -> Target Pattern Evaluation
  -> Research Interpretation
```

The Image Analyst records visible features: pointed ears, a white coat, a stethoscope, a medical-looking environment, rearward palm contact/support evidence, or partially closed eyes. It does not directly assert `elf`, `doctor`, prompt success, or a research conclusion.

An Interpretation Layer may later form candidates from those observations:

```json
{
  "observed_features": [
    "anatomy.ear.pointed",
    "clothing.outer.white_coat",
    "object.stethoscope",
    "environment.medical"
  ],
  "interpretation_candidates": [
    {
      "concept_id": "species.elf",
      "confidence": "candidate",
      "evidence": ["anatomy.ear.pointed"]
    },
    {
      "concept_id": "role.occupation.doctor",
      "confidence": "candidate",
      "evidence": [
        "clothing.outer.white_coat",
        "object.stethoscope",
        "environment.medical"
      ]
    }
  ]
}
```

Pointed ears therefore remain an observation while `elf` is an interpretation candidate. A white coat and stethoscope remain observations while `doctor` is a separate semantic candidate. The same separation applies to visible rearward palm geometry and the `reclined_arm_support` interpretation pattern.

## Build and validation

From the repository root, using the research virtual environment on Windows:

```powershell
& research/sd-prompt-research/.venv/Scripts/python.exe research/sd-prompt-research/scripts/build_concept_graph.py --check
& research/sd-prompt-research/.venv/Scripts/python.exe research/sd-prompt-research/scripts/build_concept_graph.py
```

Portable environments can invoke the same script with their active Python. `--check` validates and builds in memory without touching the distribution. `--output PATH` selects another output. Failures return a non-zero code and do not replace an existing distribution. Successful writes use a temporary file and atomic replacement.

The builder checks source schema, module family, versions, globally unique concept IDs, unique relation/target IDs, alias collisions, relation and constraint references, statuses, Evidence Ref format, and local Evidence Ref paths. Missing local evidence produces a warning so future external storage can remain representable; malformed references fail. Output arrays and indexes are stably sorted.

## Future resolver shape

Future compiler stages can consume the same structural graph through focused, reusable resolvers:

- Body State Resolver
- Orientation Resolver
- Configuration Resolver
- Support Relation Resolver
- Contact Resolver
- Contact Load Resolver
- Visibility Resolver
- Conflict Resolver
- Target Pattern Matcher
- Model Adapter

These should resolve generic structures and relations. A Bridge or Wheel profile supplies input constraints; it does not justify a new monolithic pose resolver.

## Scope of this phase

Implemented:

- independent graph schema and versions;
- sparse module sources;
- relation edges and ID indexes;
- species, role, clothing, unmodeled-effect, and target-pattern examples;
- evidence-reference validation;
- an atomic deterministic builder;
- BRG-007 conversion fixture and regression tests.

Not implemented:

- replacement of Observation Schema v3.0 or existing research pipelines;
- migration of every run;
- complete body/face/hair/clothing/species/role ontology;
- automatic research conclusions or unmodeled-effect promotion;
- production conflict/support/contact/visibility resolvers;
- production Target Pattern Matcher or Prompt Renderer;
- removal of existing Bridge-specific logic;
- large UI integration or destructive data migration.

## Migration approach

Adopt the graph incrementally:

1. Keep Observation Schema v3.0 and existing research output authoritative; use the Graph only as a prototype mapping target.
2. Add non-destructive per-run mapping fixtures beside existing evidence, without batch-migrating old runs.
3. Add a version-checking read-only loader for the generated Graph; do not route production rendering through it yet.
4. Introduce generic Body State, Orientation, Configuration, Contact, Contact Load, Support Relation, and Visibility resolvers behind existing behavior.
5. Add Conflict Resolution and a non-authoritative Target Pattern Matcher that reports evidence, missing constraints, conflicts, and unknowns separately.
6. Add Model Adapters and Prompt Rendering only after structural resolution has parity tests.
7. Convert Bridge, Wheel, and Lying logic into thin profiles only after each old path has regression coverage; do not delete existing resolvers merely because the prototype exists.

Observed data, mapping decisions, interpretation candidates, target evaluation, and working conclusions must remain distinct throughout that migration.
