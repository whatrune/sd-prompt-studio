/**
 * Proposed Visual Concept Compiler intermediate representation.
 *
 * This file is design documentation. It is intentionally stored under docs and
 * is not included by the application tsconfig. Optional fields support gradual
 * migration; missing evidence means "unknown", not "false".
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

export type ConceptComponent = {
  conceptId: string;
  axis?: string;
  required?: boolean;
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
  scope?: "global" | "regional" | "local";

  primaryAxis?: string;
  secondaryAxes?: string[];

  components?: ConceptComponent[];
  requiredComponents?: ConceptComponent[];
  optionalComponents?: ConceptComponent[];

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
  requiresVisibleRegions?: string[];
  prefersVisibleRegions?: string[];
  forbidsVisibleRegions?: string[];

  minimumFraming?: string;
  preferredFraming?: string[];
  maximumFraming?: string;
  requiresSpatialBudget?: boolean;
  providesSpatialBudget?: boolean;
  preferredSubjectScale?: "small" | "medium" | "large";

  affectsAxes?: string[];
  secondaryEffects?: string[];
  weakEffects?: string[];
  fallbackEffects?: string[];

  cooperativeWith?: string[];
  suppresses?: string[];
  conflicts?: string[];

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

export type EntityType = "human" | "object" | "environment" | "region";

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
