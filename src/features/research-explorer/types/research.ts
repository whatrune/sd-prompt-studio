export type ResearchArtifactType =
  | 'run'
  | 'observation'
  | 'draft'
  | 'human_resolution'
  | 'candidate'
  | 'receipt'
  | 'canonical_assertion'
  | 'validation_result'
  | 'report'
  | 'run_index'
  | 'research_artifact'

export type DisplayStatus = {
  value: string
  source: string
}

export type SourceFreshnessFingerprint = {
  contract: 'source_freshness_fingerprint_v1'
  algorithm: 'sha256_raw_bytes'
  value: string
}

export type ResearchAuditHash = {
  name: string
  value: string
  source: string
}

export type ResearchRelationship = {
  relation: string
  target_entity_id: string
  target_artifact_id?: string
}

export type ResearchArtifactSummary = {
  artifact_id: string
  artifact_type: ResearchArtifactType
  entity_id?: string
  source_path: string
  display_name: string
  media_type: string
  byte_size: number
  display_status: DisplayStatus
  source_freshness_fingerprint: SourceFreshnessFingerprint
  research_audit_hashes: ResearchAuditHash[]
  relationships: ResearchRelationship[]
}

export type ResearchDiagnostic = {
  code: string
  path: string
  artifact_id?: string
  source_path?: string
}

export type ResearchIndex = {
  schema_version: string
  index_snapshot_id: string
  generated_at: string
  fingerprint_contract: string
  artifacts: ResearchArtifactSummary[]
  diagnostics: ResearchDiagnostic[]
}

export type ResearchArtifactPayload = {
  artifactId: string
  snapshotId: string
  etag?: string
  mediaType: string
  bytes: Uint8Array<ArrayBuffer>
  text: string
}

export type ResearchApiErrorKind =
  | 'service_unavailable'
  | 'session_unavailable'
  | 'security_configuration_error'
  | 'artifact_not_found'
  | 'api_contract_mismatch'
  | 'snapshot_mismatch'
  | 'artifact_stale'
  | 'client_contract_error'
  | 'api_error'

export class ResearchApiError extends Error {
  constructor(
    readonly kind: ResearchApiErrorKind,
    readonly code: string,
    message: string,
    readonly status?: number,
  ) {
    super(message)
    this.name = 'ResearchApiError'
  }
}

export type NavigatorScope =
  | 'run'
  | 'observation'
  | 'draft'
  | 'candidate'
  | 'canonical_assertion'
  | 'receipt'
  | 'validation_result'

export const NAVIGATOR_SCOPES: ReadonlyArray<{
  value: NavigatorScope
  label: string
}> = [
  { value: 'run', label: 'Runs' },
  { value: 'observation', label: 'Observations' },
  { value: 'draft', label: 'Drafts' },
  { value: 'candidate', label: 'Candidates' },
  { value: 'canonical_assertion', label: 'Canonical Assertions' },
  { value: 'receipt', label: 'Receipts' },
  { value: 'validation_result', label: 'Validation Results' },
]

export type ViewerFormat = 'json' | 'yaml' | 'markdown' | 'code' | 'text' | 'unsupported'
