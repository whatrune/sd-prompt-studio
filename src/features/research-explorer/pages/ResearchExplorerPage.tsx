import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { BookOpen, Menu, Moon, PanelRight, RefreshCw, Sun } from 'lucide-react'
import { AppLink, navigate } from '../../../routing'
import { ArtifactInspector } from '../components/ArtifactInspector'
import { ArtifactViewer } from '../components/ArtifactViewer'
import { ResearchNavigator } from '../components/ResearchNavigator'
import { useResearchArtifactQuery, useResearchIndexQuery } from '../hooks/useResearchQueries'
import type { ResearchArtifactSummary } from '../types/research'
import '../research-explorer.css'

type Theme = 'dark' | 'light'
type OpenPane = 'navigator' | 'inspector' | null

function initialTheme(): Theme {
  try {
    return window.localStorage.getItem('sd-prompt-studio-theme') === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

function useNarrowMode() {
  const [narrow, setNarrow] = useState(() => window.matchMedia('(max-width: 1100px)').matches)
  useEffect(() => {
    const media = window.matchMedia('(max-width: 1100px)')
    const update = () => setNarrow(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  return narrow
}

function useFocusTrap(open: boolean, panelRef: RefObject<HTMLElement | null>, onClose: () => void) {
  useEffect(() => {
    if (!open || !panelRef.current) return
    const panel = panelRef.current
    const previous = document.activeElement as HTMLElement | null
    const focusable = () => [...panel.querySelectorAll<HTMLElement>('button, input, select, [href], [tabindex]:not([tabindex="-1"])')]
      .filter(element => !element.hasAttribute('disabled'))
    focusable()[0]?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const elements = focusable()
      if (elements.length === 0) return
      const first = elements[0]
      const last = elements[elements.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    panel.addEventListener('keydown', handleKeyDown)
    return () => {
      panel.removeEventListener('keydown', handleKeyDown)
      previous?.focus()
    }
  }, [onClose, open, panelRef])
}

export default function ResearchExplorerPage({ artifactId }: { artifactId?: string }) {
  const [theme, setTheme] = useState<Theme>(initialTheme)
  const [openPane, setOpenPane] = useState<OpenPane>(null)
  const [artifactRevision, setArtifactRevision] = useState(0)
  const narrow = useNarrowMode()
  const navigatorRef = useRef<HTMLElement>(null)
  const inspectorRef = useRef<HTMLElement>(null)
  const indexQuery = useResearchIndexQuery()
  const closePane = useCallback(() => setOpenPane(null), [])

  const snapshotId = indexQuery.status === 'success' ? indexQuery.data.index_snapshot_id : null
  const artifactQuery = useResearchArtifactQuery(
    artifactId || null,
    snapshotId,
    indexQuery.revision + artifactRevision,
    indexQuery.refresh,
  )

  const selectedArtifact = indexQuery.status === 'success' && artifactId
    ? indexQuery.data.artifacts.find(item => item.artifact_id === artifactId) || null
    : null

  useEffect(() => {
    const previousTitle = document.title
    document.title = 'Research Explorer · SD Prompt Studio'
    document.body.classList.add('research-mode')
    return () => {
      document.title = previousTitle
      document.body.classList.remove('research-mode')
    }
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try { window.localStorage.setItem('sd-prompt-studio-theme', theme) } catch { /* Keep local state. */ }
  }, [theme])

  useEffect(() => {
    if (!narrow) setOpenPane(null)
  }, [narrow])

  useFocusTrap(narrow && openPane === 'navigator', navigatorRef, closePane)
  useFocusTrap(narrow && openPane === 'inspector', inspectorRef, closePane)

  const selectArtifact = useCallback((artifact: ResearchArtifactSummary) => {
    navigate(`/research/artifact/${encodeURIComponent(artifact.artifact_id)}`)
    if (narrow) setOpenPane(null)
  }, [narrow])

  return (
    <div className="research-page">
      <header className="research-topbar">
        <div className="research-brand">
          <BookOpen size={21} />
          <div><strong>SD Prompt Studio</strong><span>Research Explorer</span></div>
        </div>
        <nav aria-label="Application routes">
          <AppLink to="/">Prompt Builder</AppLink>
          <AppLink to="/research" aria-current="page">Research Explorer</AppLink>
        </nav>
        <div className="research-header-actions">
          <span className={`research-service-state ${indexQuery.status}`}>{indexQuery.status === 'success' ? 'Local Research Mode' : indexQuery.status === 'loading' ? 'Connecting' : 'Unavailable'}</span>
          <div className="research-theme-toggle" role="group" aria-label="Display theme">
            <button className={theme === 'dark' ? 'active' : ''} onClick={() => setTheme('dark')} aria-pressed={theme === 'dark'}><Moon size={14} /><span>Dark</span></button>
            <button className={theme === 'light' ? 'active' : ''} onClick={() => setTheme('light')} aria-pressed={theme === 'light'}><Sun size={14} /><span>Light</span></button>
          </div>
        </div>
      </header>

      <div className="research-mobile-toolbar" aria-label="Research panes">
        <button onClick={() => setOpenPane('navigator')}><Menu size={16} />Navigator</button>
        <strong>{selectedArtifact?.display_name || 'Research Explorer'}</strong>
        <button onClick={() => setOpenPane('inspector')}><PanelRight size={16} />Inspector</button>
      </div>

      {indexQuery.status === 'loading' && <div className="research-page-state" role="status"><div className="research-spinner" />Derived Indexを読み込んでいます…</div>}
      {indexQuery.status === 'error' && (
        <div className="research-page-state research-unavailable" role="status">
          <BookOpen size={34} />
          <h1>Research Data Unavailable</h1>
          <p>このOriginではLocal Companion ServiceまたはPublic Fixtureが提供されていません。</p>
          <code>{indexQuery.error.code}</code>
          <button className="research-primary-button" onClick={indexQuery.refresh}><RefreshCw size={15} />再接続</button>
        </div>
      )}

      {indexQuery.status === 'success' && (
        <>
          {artifactId && !selectedArtifact && (
            <div className="research-workspace-warning" role="status">
              指定されたArtifact IDは現在のIndexに存在しません。Navigatorから別のArtifactを選択してください。
            </div>
          )}
          {indexQuery.data.diagnostics.length > 0 && (
            <div className="research-workspace-diagnostics">
              Index Diagnostics: {indexQuery.data.diagnostics.length}
            </div>
          )}
          <section className={`research-workspace ${openPane ? `pane-${openPane}-open` : ''}`}>
            {narrow && openPane && <button className="research-drawer-backdrop" onClick={closePane} aria-label="Paneを閉じる" />}
            <ResearchNavigator
              index={indexQuery.data}
              selectedArtifactId={selectedArtifact?.artifact_id || null}
              onSelect={selectArtifact}
              narrow={narrow}
              open={openPane === 'navigator'}
              onClose={closePane}
              panelRef={navigatorRef}
            />
            <ArtifactViewer
              artifact={selectedArtifact}
              state={artifactQuery}
              theme={theme}
              onRetry={() => setArtifactRevision(value => value + 1)}
            />
            <ArtifactInspector
              index={indexQuery.data}
              artifact={selectedArtifact}
              payload={artifactQuery.status === 'success' ? artifactQuery.data : undefined}
              onSelectArtifact={selectArtifact}
              narrow={narrow}
              open={openPane === 'inspector'}
              onClose={closePane}
              panelRef={inspectorRef}
            />
          </section>
        </>
      )}
    </div>
  )
}
