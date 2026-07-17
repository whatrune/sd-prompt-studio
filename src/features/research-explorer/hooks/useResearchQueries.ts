import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchResearchArtifact, fetchResearchIndex } from '../api/researchApiClient'
import {
  ResearchApiError,
  type ResearchArtifactPayload,
  type ResearchIndex,
} from '../types/research'

type QueryState<T> =
  | { status: 'idle' | 'loading'; data?: undefined; error?: undefined }
  | { status: 'success'; data: T; error?: undefined }
  | { status: 'error'; data?: undefined; error: ResearchApiError }

function normalizeError(error: unknown): ResearchApiError {
  if (error instanceof ResearchApiError) return error
  return new ResearchApiError(
    'api_error',
    'UNEXPECTED_CLIENT_ERROR',
    error instanceof Error ? error.message : 'Unexpected Research Explorer error.',
  )
}

export function useResearchIndexQuery() {
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState<QueryState<ResearchIndex>>({ status: 'loading' })

  const refresh = useCallback(() => setRevision(value => value + 1), [])

  useEffect(() => {
    const controller = new AbortController()
    setState({ status: 'loading' })
    fetchResearchIndex(controller.signal)
      .then(data => setState({ status: 'success', data }))
      .catch(error => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setState({ status: 'error', error: normalizeError(error) })
      })
    return () => controller.abort()
  }, [revision])

  return { ...state, revision, refresh }
}

export function useResearchArtifactQuery(
  artifactId: string | null,
  snapshotId: string | null,
  indexRevision: number,
  onSnapshotMismatch: () => void,
) {
  const [state, setState] = useState<QueryState<ResearchArtifactPayload>>({ status: 'idle' })
  const retriedSnapshots = useRef(new Set<string>())

  useEffect(() => {
    if (!artifactId || !snapshotId) {
      setState({ status: 'idle' })
      return
    }

    const controller = new AbortController()
    setState({ status: 'loading' })
    fetchResearchArtifact(artifactId, snapshotId, controller.signal)
      .then(data => setState({ status: 'success', data }))
      .catch(error => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        const normalized = normalizeError(error)
        setState({ status: 'error', error: normalized })
        if (normalized.kind === 'snapshot_mismatch' && !retriedSnapshots.current.has(snapshotId)) {
          retriedSnapshots.current.add(snapshotId)
          onSnapshotMismatch()
        }
      })
    return () => controller.abort()
  }, [artifactId, snapshotId, indexRevision, onSnapshotMismatch])

  return state
}
