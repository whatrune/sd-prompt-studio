import {
  ResearchApiError,
  type ResearchApiErrorKind,
  type ResearchArtifactPayload,
  type ResearchIndex,
} from '../types/research'

const INDEX_ENDPOINT = '/api/research/index'
const ARTIFACT_ENDPOINT = '/api/research/artifacts/'

function mapErrorKind(status: number, code: string): ResearchApiErrorKind {
  if (status === 401 && code === 'SESSION_REQUIRED') return 'session_unavailable'
  if (status === 403 && (code === 'HOST_NOT_ALLOWED' || code === 'ORIGIN_NOT_ALLOWED')) {
    return 'security_configuration_error'
  }
  if (status === 404 && code === 'ARTIFACT_ID_INVALID') return 'artifact_not_found'
  if (status === 404 && code === 'API_ROUTE_NOT_FOUND') return 'api_contract_mismatch'
  if (status === 409 && code === 'INDEX_SNAPSHOT_MISMATCH') return 'snapshot_mismatch'
  if (status === 409 && code === 'ARTIFACT_STALE') return 'artifact_stale'
  if (status === 405 && code === 'READ_ONLY_API') return 'client_contract_error'
  return 'api_error'
}

async function responseError(response: Response): Promise<ResearchApiError> {
  let code = `HTTP_${response.status}`
  let message = response.statusText || 'Research API request failed.'
  try {
    const payload = await response.json() as { error?: { code?: string; message?: string } }
    code = payload.error?.code || code
    message = payload.error?.message || message
  } catch {
    // Preserve the HTTP error when the response is not the documented JSON shape.
  }
  return new ResearchApiError(mapErrorKind(response.status, code), code, message, response.status)
}

function serviceUnavailable(cause: unknown): ResearchApiError {
  const message = cause instanceof Error
    ? cause.message
    : typeof cause === 'string'
      ? cause
      : 'Local Research Mode is unavailable.'
  return new ResearchApiError('service_unavailable', 'RESEARCH_UNAVAILABLE', message)
}

function isResearchIndex(value: unknown): value is ResearchIndex {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<ResearchIndex>
  return typeof candidate.schema_version === 'string'
    && typeof candidate.index_snapshot_id === 'string'
    && typeof candidate.generated_at === 'string'
    && Array.isArray(candidate.artifacts)
    && Array.isArray(candidate.diagnostics)
}

export async function fetchResearchIndex(signal?: AbortSignal): Promise<ResearchIndex> {
  let response: Response
  try {
    response = await fetch(INDEX_ENDPOINT, {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw serviceUnavailable(error)
  }

  if (!response.ok) throw await responseError(response)
  if (!response.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    throw serviceUnavailable('Research Index is not provided by this origin.')
  }

  try {
    const payload: unknown = await response.json()
    if (!isResearchIndex(payload)) {
      throw new ResearchApiError(
        'api_contract_mismatch',
        'INDEX_RESPONSE_INVALID',
        'Research Index response does not match the required envelope.',
      )
    }
    return payload
  } catch (error) {
    if (error instanceof ResearchApiError) throw error
    throw new ResearchApiError(
      'api_contract_mismatch',
      'INDEX_RESPONSE_INVALID',
      error instanceof Error ? error.message : 'Research Index response is invalid.',
    )
  }
}

export async function fetchResearchArtifact(
  artifactId: string,
  snapshotId: string,
  signal?: AbortSignal,
): Promise<ResearchArtifactPayload> {
  let response: Response
  try {
    response = await fetch(`${ARTIFACT_ENDPOINT}${encodeURIComponent(artifactId)}`, {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        Accept: '*/*',
        'X-Research-Index-Snapshot': snapshotId,
      },
      signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw serviceUnavailable(error)
  }

  if (!response.ok) throw await responseError(response)

  const responseArtifactId = response.headers.get('X-Research-Artifact-Id')
  const responseSnapshotId = response.headers.get('X-Research-Index-Snapshot')
  if (responseArtifactId !== artifactId || responseSnapshotId !== snapshotId) {
    throw new ResearchApiError(
      'api_contract_mismatch',
      'ARTIFACT_RESPONSE_MISMATCH',
      'Artifact response identity does not match the active Index snapshot.',
    )
  }

  const buffer = await response.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  const mediaType = response.headers.get('content-type') || 'application/octet-stream'

  return {
    artifactId,
    snapshotId,
    etag: response.headers.get('etag') || undefined,
    mediaType,
    bytes,
    text: new TextDecoder('utf-8', { fatal: false }).decode(bytes),
  }
}
