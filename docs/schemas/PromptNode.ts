/**
 * Proposed Visual Concept Compiler intermediate representation.
 *
 * This file is design documentation. It is intentionally stored under docs and
 * is not included by the application tsconfig.
 *
 * ConceptNode is an intermediate representation for draft, unresearched, and
 * partially migrated records, so fields that are required by the Production
 * Dictionary may remain optional here. `undefined` always means "unknown / not
 * yet investigated"; it never means false, unsupported, empty, or inapplicable.
 * Promotion into the Production Dictionary requires its mandatory fields to be
 * populated and validated.
 */

export type EvidenceLevel = "low" | "medium" | "high";

export type SupportStatus =
  | "supported"
  | "unverified"
  | "unreliable"
  | "unsupported"
  | "exception";

export type ConceptType =
  | "atomic"
  | "modifier"
  | "native_composite"
  | "expandable_composite"
  | "relation"
  | "effect"
  | "exception";

export type ConceptRole =
  | "core"
  | "attribute"
  | "structure"
  | "modifier"
  | "state"
  | "constraint"
  | "effect"
  | "relation"
  | "interaction"
  | "composite"
  | "body_state"
  | "configuration"
  | "motion";

export type ConceptDomain =
  | "species"
  | "human"
  | "appearance"
  | "hair"
  | "eyes"
  | "face"
  | "outfit"
  | "pose"
  | "interaction"
  | "camera"
  | "object"
  | "relation"
  | "environment"
  | "background"
  | "lighting"
  | "quality"
  | "effect";

export type EntityType = "human" | "object" | "environment" | "region";

export type RelationDirectionality = "directed" | "symmetric";

/**
 * Dictionary-side semantics for a relation phrase.
 *
 * `directed` means source and target order changes the relation meaning.
 * `symmetric` means swapping source and target preserves the relation meaning.
 */
export type RelationDefinition = {
  directionality: RelationDirectionality;
  /** Entity types permitted as the relation source; undefined means unresearched. */
  sourceEntityTypes?: EntityType[];
  /** Entity types permitted as the relation target; undefined means unresearched. */
  targetEntityTypes?: EntityType[];
  /** Concept ID for the inverse direction, such as handing_to ↔ receiving_from. */
  inverseRelationConceptId?: string;
  /** True when resolving the relation requires an Object entity as mediator. */
  requiresObjectMediator?: boolean;
};

/**
 * A component has exactly one compiler role within its parent concept.
 * `evidence` verifies the parent concept in an image and is not necessarily
 * rendered. `render_candidate` is available to the Renderer but is not an
 * instruction to emit the component in every prompt.
 */
export type ComponentRole =
  | "required"
  | "optional"
  | "evidence"
  | "render_candidate";

export type ConceptComponent = {
  conceptId: string;
  role: ComponentRole;
  axis?: string;
  renderPhrase?: string;
  notes?: string[];
};

export type ConceptObservation = {
  summary: string;
  status: "observed" | "hypothesis" | "unverified" | "superseded";
  evidenceSourceIds?: string[];
};

export type ConceptNode = {
  id: string;
  phrase: string;
  displayName: string;
  aliases?: string[];

  humanMeaning?: string;
  observedModelBehavior?: string;

  domain: ConceptDomain;
  role: ConceptRole;
  conceptType: ConceptType;
  /**
   * Dictionary definition for a relation phrase. Required for production
   * concepts whose conceptType is "relation".
   */
  relationDefinition?: RelationDefinition;
  scope?: "global" | "regional" | "local";

  primaryAxis?: string;
  secondaryAxes?: string[];

  /** Components classified exclusively by ConceptComponent.role. */
  components?: ConceptComponent[];
  /** Strategy identifier required when a production concept is expandable. */
  expansionStrategy?: string;

  compatibleStates?: string[];
  preferredStates?: string[];
  incompatibleStates?: string[];
  stateAffinity?: Record<string, EvidenceLevel>;
  stateDependency?: "none" | "optional" | "required";

  supportRequirements?: string[];
  orientationRequirements?: string[];
  objectRequirements?: string[];
  sceneRequirements?: string[];

  targetRegions?: string[];
  evidenceRegions?: string[];
  /** Reliability of inferring this concept when only upper-body regions are visible. */
  upperBodyObservability?: EvidenceLevel;
  requiresVisibleRegions?: string[];
  prefersVisibleRegions?: string[];
  forbidsVisibleRegions?: string[];
  /** Pressure this concept applies toward keeping target or required regions visible. */
  visibilityStrength?: EvidenceLevel;

  minimumFraming?: string;
  preferredFraming?: string[];
  maximumFraming?: string;
  requiresSpatialBudget?: boolean;
  providesSpatialBudget?: boolean;
  preferredSubjectScale?: "small" | "medium" | "large";

  /** True when the intended concept cannot resolve without a viewer-targeted relation. */
  requiresViewerRelation?: boolean;
  /** True when a viewer relation can strengthen the concept but is not mandatory. */
  supportsViewerRelation?: boolean;

  affectsAxes?: string[];
  secondaryEffects?: string[];
  weakEffects?: string[];
  fallbackEffects?: string[];

  cooperativeWith?: string[];
  suppresses?: string[];
  conflicts?: string[];

  /** Resolver tie-break input; not prompt weight, confidence, or evidence strength. */
  priority?: number;

  activationStrength?: EvidenceLevel;
  activationVariance?: EvidenceLevel;
  stability?: EvidenceLevel;
  contextDependent?: boolean;
  modelDependent?: boolean;

  supportStatus: SupportStatus;
  confidence?: EvidenceLevel;
  observations?: ConceptObservation[];
  evidenceSources?: string[];
};

export type EntityNode = {
  id: string;
  entityType: EntityType;
  displayName?: string;
  conceptIds: string[];
};

export type RelationKind =
  | "physical"
  | "spatial"
  | "shared_action"
  | "directed_action"
  | "attention"
  | "support";

/** Resolved Scene Graph relation instance between concrete entity IDs. */
export type RelationNode = {
  id: string;
  kind: RelationKind;
  relationConceptId: string;
  sourceEntityId: string;
  targetEntityId: string;
  objectEntityId?: string;
  strength?: EvidenceLevel;
};

export type ResolutionOrigin = "selected" | "engine" | "model_adapter";

export type ResolvedConceptNode = {
  conceptId: string;
  entityId?: string;
  origin: ResolutionOrigin;
  parentConceptIds?: string[];
  status: "selected" | "expanded" | "suppressed" | "rendered" | "warning";
  reasons?: string[];
  evidenceSourceIds?: string[];
};

export type VisualConceptGraph = {
  entities: EntityNode[];
  relations: RelationNode[];
  concepts: ResolvedConceptNode[];
};
