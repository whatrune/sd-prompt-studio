import { Check, Copy, FileCode2, RefreshCw } from 'lucide-react'
import { useMemo, useState, type AnchorHTMLAttributes, type ImgHTMLAttributes } from 'react'
import Markdown from 'markdown-to-jsx'
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter'
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash'
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css'
import java from 'react-syntax-highlighter/dist/esm/languages/prism/java'
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json'
import markup from 'react-syntax-highlighter/dist/esm/languages/prism/markup'
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python'
import rust from 'react-syntax-highlighter/dist/esm/languages/prism/rust'
import sql from 'react-syntax-highlighter/dist/esm/languages/prism/sql'
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript'
import yaml from 'react-syntax-highlighter/dist/esm/languages/prism/yaml'
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { parse as parseYaml } from 'yaml'
import type {
  ResearchApiError,
  ResearchArtifactPayload,
  ResearchArtifactSummary,
  ViewerFormat,
} from '../types/research'

SyntaxHighlighter.registerLanguage('bash', bash)
SyntaxHighlighter.registerLanguage('css', css)
SyntaxHighlighter.registerLanguage('java', java)
SyntaxHighlighter.registerLanguage('json', json)
SyntaxHighlighter.registerLanguage('markup', markup)
SyntaxHighlighter.registerLanguage('python', python)
SyntaxHighlighter.registerLanguage('rust', rust)
SyntaxHighlighter.registerLanguage('sql', sql)
SyntaxHighlighter.registerLanguage('typescript', typescript)
SyntaxHighlighter.registerLanguage('yaml', yaml)

type ArtifactState =
  | { status: 'idle' | 'loading'; data?: undefined; error?: undefined }
  | { status: 'success'; data: ResearchArtifactPayload; error?: undefined }
  | { status: 'error'; data?: undefined; error: ResearchApiError }

type Props = {
  artifact: ResearchArtifactSummary | null
  state: ArtifactState
  theme: 'dark' | 'light'
  onRetry: () => void
}

const CODE_EXTENSIONS = new Set([
  'js', 'jsx', 'ts', 'tsx', 'py', 'sh', 'ps1', 'css', 'html', 'xml', 'toml', 'ini', 'sql', 'java', 'go', 'rs',
])

function suffix(path: string) {
  const match = path.toLowerCase().match(/\.([a-z0-9]+)$/)
  return match?.[1] || ''
}

function viewerFormat(artifact: ResearchArtifactSummary, payload: ResearchArtifactPayload): ViewerFormat {
  const mediaType = payload.mediaType.toLowerCase().split(';')[0].trim()
  const extension = suffix(artifact.source_path)
  if (mediaType === 'application/json' || mediaType.endsWith('+json') || extension === 'json') return 'json'
  if (mediaType.includes('yaml') || extension === 'yaml' || extension === 'yml') return 'yaml'
  if (mediaType === 'text/markdown' || extension === 'md' || extension === 'markdown') return 'markdown'
  if (CODE_EXTENSIONS.has(extension)) return 'code'
  if (mediaType.startsWith('text/')) return 'text'
  return 'unsupported'
}

function codeLanguage(format: ViewerFormat, sourcePath: string) {
  if (format === 'json') return 'json'
  if (format === 'yaml') return 'yaml'
  if (format === 'markdown') return 'markdown'
  if (format === 'code') {
    const extension = suffix(sourcePath)
    return ({
      js: 'typescript', jsx: 'typescript', ts: 'typescript', tsx: 'typescript',
      py: 'python', sh: 'bash', ps1: 'bash', html: 'markup', xml: 'markup',
      css: 'css', sql: 'sql', java: 'java', rs: 'rust',
    } as Record<string, string>)[extension] || 'text'
  }
  return 'text'
}

function errorMessage(error: ResearchApiError) {
  if (error.kind === 'artifact_stale') return 'ArtifactはIndex生成後に変更されています。staleな本文は表示しません。'
  if (error.kind === 'snapshot_mismatch') return 'Index snapshotを更新しています。本文は破棄されました。'
  if (error.kind === 'session_unavailable') return 'Local Companion Serviceからページを再読み込みしてください。'
  return error.message
}

export function ArtifactViewer({ artifact, state, theme, onRetry }: Props) {
  const [tab, setTab] = useState<'view' | 'source'>('view')
  const [copied, setCopied] = useState(false)

  const presentation = useMemo(() => {
    if (!artifact || state.status !== 'success') return null
    const format = viewerFormat(artifact, state.data)
    if (format === 'json') {
      try {
        return { format, formatted: JSON.stringify(JSON.parse(state.data.text), null, 2), parseError: null }
      } catch (error) {
        return { format, formatted: state.data.text, parseError: error instanceof Error ? error.message : 'JSON parse failed.' }
      }
    }
    if (format === 'yaml') {
      try {
        return { format, formatted: JSON.stringify(parseYaml(state.data.text, { maxAliasCount: 100 }), null, 2), parseError: null }
      } catch (error) {
        return { format, formatted: state.data.text, parseError: error instanceof Error ? error.message : 'YAML parse failed.' }
      }
    }
    return { format, formatted: state.data.text, parseError: null }
  }, [artifact, state])

  async function copySource() {
    if (state.status !== 'success') return
    try {
      if (!navigator.clipboard?.writeText) return
      await navigator.clipboard.writeText(state.data.text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <main className="research-pane research-viewer" aria-label="Artifact Viewer">
      <header className="research-pane-header research-viewer-header">
        <div>
          <span className="research-eyebrow">READ ONLY</span>
          <h2>{artifact?.display_name || 'Artifact Viewer'}</h2>
          {artifact && <small>{artifact.artifact_type} · {artifact.media_type}</small>}
        </div>
        {state.status === 'success' && (
          <button className="research-secondary-button" onClick={copySource}>
            {copied ? <Check size={15} /> : <Copy size={15} />}{copied ? 'Copied' : 'Copy source'}
          </button>
        )}
      </header>

      {state.status === 'success' && presentation && presentation.format !== 'unsupported' && (
        <div className="research-viewer-tabs" role="tablist" aria-label="Viewer mode">
          <button role="tab" aria-selected={tab === 'view'} className={tab === 'view' ? 'active' : ''} onClick={() => setTab('view')}>
            {presentation.format === 'markdown' ? 'Preview' : presentation.format === 'text' || presentation.format === 'code' ? 'Code' : 'Parsed'}
          </button>
          <button role="tab" aria-selected={tab === 'source'} className={tab === 'source' ? 'active' : ''} onClick={() => setTab('source')}>Source</button>
        </div>
      )}

      <div className="research-viewer-body">
        {!artifact && <EmptyViewer icon={<FileCode2 size={28} />} title="Artifactを選択してください" detail="NavigatorからArtifactを選択すると、exact response bytesをread-only表示します。" />}
        {artifact && state.status === 'loading' && <div className="research-loading" role="status">Artifactを読み込んでいます…</div>}
        {artifact && state.status === 'idle' && <div className="research-loading">Artifactを選択してください。</div>}
        {artifact && state.status === 'error' && (
          <EmptyViewer
            icon={<FileCode2 size={28} />}
            title={state.error.kind === 'artifact_stale' ? 'Artifact Stale' : 'Artifact Unavailable'}
            detail={`${errorMessage(state.error)} (${state.error.code})`}
            action={<button className="research-secondary-button" onClick={onRetry}><RefreshCw size={15} />再試行</button>}
          />
        )}
        {artifact && state.status === 'success' && presentation?.format === 'unsupported' && (
          <EmptyViewer icon={<FileCode2 size={28} />} title="Unsupported media" detail="本文を推測decodeせず、Inspector Metadataのみ表示します。" />
        )}
        {artifact && state.status === 'success' && presentation && presentation.format !== 'unsupported' && (
          <>
            {presentation.parseError && (
              <div className="research-inline-warning" role="status">
                Parse failure: {presentation.parseError} Raw Sourceは引き続き確認できます。
              </div>
            )}
            {tab === 'view' && presentation.format === 'markdown' && !presentation.parseError ? (
              <article className="research-markdown" aria-label="Rendered Markdown preview">
                <div className="research-rendered-label">Rendered preview · Source原文ではありません</div>
                <Markdown options={{
                  disableParsingRawHTML: true,
                  overrides: {
                    a: { component: SafeMarkdownLink },
                    img: { component: SafeMarkdownImage },
                  },
                }}>{state.data.text}</Markdown>
              </article>
            ) : (
              <SyntaxHighlighter
                language={codeLanguage(tab === 'source' ? 'text' : presentation.format, artifact.source_path)}
                style={theme === 'dark' ? oneDark : oneLight}
                customStyle={{ margin: 0, minHeight: '100%', background: 'transparent' }}
                showLineNumbers
                wrapLongLines={false}
              >
                {tab === 'source' || presentation.parseError ? state.data.text : presentation.formatted}
              </SyntaxHighlighter>
            )}
          </>
        )}
      </div>
    </main>
  )
}

function SafeMarkdownLink({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const safeHref = href && /^(?:https?:\/\/|mailto:|#|\/(?!\/)|\.\.?\/)/i.test(href) ? href : undefined
  if (!safeHref) return <span>{children}</span>
  const external = /^https?:\/\//i.test(safeHref)
  return <a {...props} href={safeHref} target={external ? '_blank' : undefined} rel={external ? 'noreferrer noopener' : undefined}>{children}</a>
}

function SafeMarkdownImage({ alt }: ImgHTMLAttributes<HTMLImageElement>) {
  return <span className="research-markdown-image-placeholder">[Image: {alt || 'Unavailable'}]</span>
}

function EmptyViewer({
  icon,
  title,
  detail,
  action,
}: {
  icon: React.ReactNode
  title: string
  detail: string
  action?: React.ReactNode
}) {
  return <div className="research-empty-viewer">{icon}<strong>{title}</strong><p>{detail}</p>{action}</div>
}
