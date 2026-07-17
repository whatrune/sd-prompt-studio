import { lazy, Suspense } from 'react'
import App from './App'
import { ResearchExplorerErrorBoundary } from './features/research-explorer/ResearchExplorerErrorBoundary'
import { AppLink, usePathname } from './routing'

const ResearchExplorerPage = lazy(() => import('./features/research-explorer/pages/ResearchExplorerPage'))

export function AppRouter() {
  const pathname = usePathname()

  if (pathname === '/') return <App />
  if (pathname === '/research') return <ResearchRoute />

  const artifactMatch = pathname.match(/^\/research\/artifact\/([^/]+)$/)
  if (artifactMatch) {
    let artifactId = artifactMatch[1]
    try { artifactId = decodeURIComponent(artifactId) } catch { /* Keep the opaque route segment for not-found display. */ }
    return <ResearchRoute artifactId={artifactId} />
  }

  return (
    <main className="research-route-not-found">
      <h1>Page Not Found</h1>
      <AppLink to="/">Prompt Builderへ戻る</AppLink>
    </main>
  )
}

function ResearchRoute({ artifactId }: { artifactId?: string }) {
  return (
    <ResearchExplorerErrorBoundary>
      <Suspense fallback={<main className="research-route-loading" role="status">Research Explorerを読み込んでいます…</main>}>
        <ResearchExplorerPage artifactId={artifactId} />
      </Suspense>
    </ResearchExplorerErrorBoundary>
  )
}
