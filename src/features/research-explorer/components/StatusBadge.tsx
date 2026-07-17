import type { DisplayStatus } from '../types/research'

function tone(value: string) {
  const normalized = value.toLowerCase()
  if (['passed', 'finalized', 'valid', 'success', 'complete'].includes(normalized)) return 'positive'
  if (['failed', 'invalid', 'error', 'rejected'].includes(normalized)) return 'negative'
  if (['pending', 'draft', 'candidate', 'stale', 'warning'].includes(normalized)) return 'warning'
  return 'neutral'
}

export function StatusBadge({ status }: { status: DisplayStatus }) {
  return (
    <span className={`research-status research-status-${tone(status.value)}`} title={`Source: ${status.source}`}>
      {status.value}
    </span>
  )
}
