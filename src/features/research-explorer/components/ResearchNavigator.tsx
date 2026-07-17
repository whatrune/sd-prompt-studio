import { ChevronDown, ChevronRight, Search, X } from 'lucide-react'
import { useMemo, useState, type KeyboardEvent, type RefObject } from 'react'
import { StatusBadge } from './StatusBadge'
import {
  NAVIGATOR_SCOPES,
  type NavigatorScope,
  type ResearchArtifactSummary,
  type ResearchIndex,
} from '../types/research'

type ScopeFilter = NavigatorScope | 'all'

type Props = {
  index: ResearchIndex
  selectedArtifactId: string | null
  onSelect: (artifact: ResearchArtifactSummary) => void
  narrow: boolean
  open: boolean
  onClose: () => void
  panelRef: RefObject<HTMLElement | null>
}

function focusSibling(event: KeyboardEvent<HTMLButtonElement>, direction: 1 | -1) {
  const tree = event.currentTarget.closest('[role="tree"]')
  if (!tree) return
  const items = [...tree.querySelectorAll<HTMLButtonElement>('[data-artifact-tree-item]')]
  const current = items.indexOf(event.currentTarget)
  const next = items[current + direction]
  if (next) {
    event.preventDefault()
    next.focus()
  }
}

export function ResearchNavigator({
  index,
  selectedArtifactId,
  onSelect,
  narrow,
  open,
  onClose,
  panelRef,
}: Props) {
  const [scope, setScope] = useState<ScopeFilter>('all')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [expanded, setExpanded] = useState<Set<NavigatorScope>>(
    () => new Set(NAVIGATOR_SCOPES.map(item => item.value)),
  )

  const supportedArtifacts = useMemo(() => {
    const supported = new Set<string>(NAVIGATOR_SCOPES.map(item => item.value))
    return index.artifacts.filter(artifact => supported.has(artifact.artifact_type))
  }, [index.artifacts])

  const statuses = useMemo(
    () => [...new Set(supportedArtifacts.map(item => item.display_status.value))].sort(),
    [supportedArtifacts],
  )

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return supportedArtifacts.filter(artifact => {
      if (scope !== 'all' && artifact.artifact_type !== scope) return false
      if (status !== 'all' && artifact.display_status.value !== status) return false
      if (!normalizedQuery) return true
      return [
        artifact.artifact_id,
        artifact.entity_id,
        artifact.display_name,
        artifact.artifact_type,
        artifact.display_status.value,
      ].some(value => value?.toLowerCase().includes(normalizedQuery))
    })
  }, [query, scope, status, supportedArtifacts])

  function toggleScope(value: NavigatorScope) {
    setExpanded(current => {
      const next = new Set(current)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })
  }

  return (
    <aside
      className="research-pane research-navigator"
      aria-label="Research Navigator"
      aria-hidden={narrow && !open ? true : undefined}
      inert={narrow && !open ? true : undefined}
      ref={panelRef}
    >
      <header className="research-pane-header">
        <div>
          <span className="research-eyebrow">EXPLORE</span>
          <h2>Navigator</h2>
        </div>
        {narrow && <button className="research-icon-button" onClick={onClose} aria-label="Navigatorを閉じる"><X size={17} /></button>}
      </header>

      <div className="research-navigator-controls">
        <label className="research-field">
          <span>Scope</span>
          <select value={scope} onChange={event => setScope(event.target.value as ScopeFilter)}>
            <option value="all">All supported entities</option>
            {NAVIGATOR_SCOPES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <label className="research-search">
          <Search size={15} />
          <span className="sr-only">Artifactを検索</span>
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Artifactを検索" />
          {query && <button onClick={() => setQuery('')} aria-label="検索をクリア"><X size={14} /></button>}
        </label>
        <label className="research-field">
          <span>Status</span>
          <select value={status} onChange={event => setStatus(event.target.value)}>
            <option value="all">All statuses</option>
            {statuses.map(value => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
      </div>

      <div className="research-tree" role="tree" aria-label="Indexed Research Artifacts">
        {NAVIGATOR_SCOPES.map(scopeItem => {
          const artifacts = filtered.filter(item => item.artifact_type === scopeItem.value)
          if (scope !== 'all' && scope !== scopeItem.value) return null
          const isExpanded = expanded.has(scopeItem.value)
          return (
            <section className="research-tree-group" key={scopeItem.value}>
              <button
                className="research-tree-group-toggle"
                onClick={() => toggleScope(scopeItem.value)}
                aria-expanded={isExpanded}
              >
                {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                <span>{scopeItem.label}</span>
                <small>{artifacts.length}</small>
              </button>
              {isExpanded && (
                <div role="group">
                  {artifacts.map(artifact => (
                    <button
                      key={artifact.artifact_id}
                      type="button"
                      role="treeitem"
                      data-artifact-tree-item
                      aria-selected={artifact.artifact_id === selectedArtifactId}
                      className={`research-tree-item ${artifact.artifact_id === selectedArtifactId ? 'active' : ''}`}
                      onClick={() => onSelect(artifact)}
                      onKeyDown={event => {
                        if (event.key === 'ArrowDown') focusSibling(event, 1)
                        if (event.key === 'ArrowUp') focusSibling(event, -1)
                      }}
                    >
                      <span className="research-tree-item-copy">
                        <strong>{artifact.display_name}</strong>
                        <small>{artifact.entity_id || artifact.artifact_id}</small>
                      </span>
                      <StatusBadge status={artifact.display_status} />
                    </button>
                  ))}
                  {artifacts.length === 0 && <p className="research-tree-empty">該当するArtifactはありません。</p>}
                </div>
              )}
            </section>
          )
        })}
      </div>
    </aside>
  )
}
