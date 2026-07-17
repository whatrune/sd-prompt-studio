import { Check, Copy, X } from 'lucide-react'
import { useMemo, useState, type RefObject } from 'react'
import type {
  ResearchArtifactPayload,
  ResearchArtifactSummary,
  ResearchDiagnostic,
  ResearchIndex,
  ResearchRelationship,
} from '../types/research'
import { StatusBadge } from './StatusBadge'

type IncomingRelationship = ResearchRelationship & { source: ResearchArtifactSummary }

type Props = {
  index: ResearchIndex
  artifact: ResearchArtifactSummary | null
  payload?: ResearchArtifactPayload
  onSelectArtifact: (artifact: ResearchArtifactSummary) => void
  narrow: boolean
  open: boolean
  onClose: () => void
  panelRef: RefObject<HTMLElement | null>
}

function matchingDiagnostics(index: ResearchIndex, artifact: ResearchArtifactSummary): ResearchDiagnostic[] {
  return index.diagnostics.filter(item =>
    item.artifact_id === artifact.artifact_id
    || item.source_path === artifact.source_path
    || item.path === artifact.source_path,
  )
}

function Field({ label, value, copy = false }: { label: string; value?: string | number; copy?: boolean }) {
  const [copied, setCopied] = useState(false)
  const display = value === undefined || value === '' ? 'Not Provided' : String(value)
  return (
    <div className="research-inspector-field">
      <dt>{label}</dt>
      <dd><span>{display}</span>{copy && value !== undefined && <button onClick={async () => {
        try {
          if (!navigator.clipboard?.writeText) return
          await navigator.clipboard.writeText(String(value))
          setCopied(true)
          window.setTimeout(() => setCopied(false), 1200)
        } catch {
          setCopied(false)
        }
      }} aria-label={`${label}をコピー`}>{copied ? <Check size={13} /> : <Copy size={13} />}</button>}</dd>
    </div>
  )
}

export function ArtifactInspector({
  index,
  artifact,
  payload,
  onSelectArtifact,
  narrow,
  open,
  onClose,
  panelRef,
}: Props) {
  const incoming = useMemo<IncomingRelationship[]>(() => {
    if (!artifact) return []
    return index.artifacts.flatMap(source => source.relationships
      .filter(relation => relation.target_artifact_id === artifact.artifact_id || relation.target_entity_id === artifact.entity_id)
      .map(relation => ({ ...relation, source })))
  }, [artifact, index.artifacts])

  if (!artifact) {
    return (
      <aside className="research-pane research-inspector" aria-label="Artifact Inspector" aria-hidden={narrow && !open ? true : undefined} inert={narrow && !open ? true : undefined} ref={panelRef}>
        <header className="research-pane-header"><div><span className="research-eyebrow">DETAILS</span><h2>Inspector</h2></div>{narrow && <button className="research-icon-button" onClick={onClose} aria-label="Inspectorを閉じる"><X size={17} /></button>}</header>
        <div className="research-inspector-empty">Artifactを選択するとMetadataを確認できます。</div>
      </aside>
    )
  }

  const diagnostics = matchingDiagnostics(index, artifact)
  const findTarget = (relationship: ResearchRelationship) => index.artifacts.find(item =>
    item.artifact_id === relationship.target_artifact_id || item.entity_id === relationship.target_entity_id,
  )

  return (
    <aside className="research-pane research-inspector" aria-label="Artifact Inspector" aria-hidden={narrow && !open ? true : undefined} inert={narrow && !open ? true : undefined} ref={panelRef}>
      <header className="research-pane-header">
        <div><span className="research-eyebrow">DETAILS</span><h2>Inspector</h2></div>
        {narrow && <button className="research-icon-button" onClick={onClose} aria-label="Inspectorを閉じる"><X size={17} /></button>}
      </header>
      <div className="research-inspector-scroll">
        <InspectorSection title="Identity">
          <dl>
            <Field label="Artifact Type" value={artifact.artifact_type} />
            <Field label="Artifact ID" value={artifact.artifact_id} copy />
            <Field label="Entity ID" value={artifact.entity_id} copy />
            <Field label="Source Path" value={artifact.source_path} copy />
            <Field label="Media Type" value={artifact.media_type} />
            <Field label="Byte Size" value={artifact.byte_size} />
          </dl>
        </InspectorSection>
        <InspectorSection title="Version">
          <dl>
            <Field label="Index Schema Version" value={index.schema_version} />
            <Field label="Artifact Schema / Contract Version" />
            <Field label="Snapshot ID" value={index.index_snapshot_id} copy />
            <Field label="Generated At" value={index.generated_at} />
            <Field label="Response ETag" value={payload?.etag} copy />
          </dl>
        </InspectorSection>
        <InspectorSection title="Display Status">
          <div className="research-status-detail"><StatusBadge status={artifact.display_status} /><small>Source: {artifact.display_status.source}</small></div>
        </InspectorSection>
        <InspectorSection title="Source Freshness">
          <dl>
            <Field label="Contract" value={artifact.source_freshness_fingerprint.contract} />
            <Field label="Algorithm" value={artifact.source_freshness_fingerprint.algorithm} />
            <Field label="Value" value={artifact.source_freshness_fingerprint.value} copy />
          </dl>
        </InspectorSection>
        <InspectorSection title="Research / Audit Hashes">
          {artifact.research_audit_hashes.length === 0 && <p className="research-muted">Not Provided</p>}
          {artifact.research_audit_hashes.map(hash => (
            <div className="research-hash" key={`${hash.name}-${hash.value}`}>
              <strong>{hash.name}</strong>
              <code>{hash.value}</code>
              <small>Source: {hash.source} · Algorithm: Not Provided</small>
            </div>
          ))}
        </InspectorSection>
        <InspectorSection title="Relationships">
          <RelationshipList title="Outgoing" relationships={artifact.relationships} resolve={findTarget} onSelect={onSelectArtifact} />
          <div className="research-relationship-list">
            <strong>Incoming</strong>
            {incoming.length === 0 && <span className="research-muted">None</span>}
            {incoming.map((item, indexValue) => (
              <button key={`${item.source.artifact_id}-${item.relation}-${indexValue}`} onClick={() => onSelectArtifact(item.source)}>
                <span>{item.relation}</span><small>{item.source.display_name}</small>
              </button>
            ))}
          </div>
        </InspectorSection>
        <InspectorSection title="Diagnostics">
          {diagnostics.length === 0 && <p className="research-muted">None</p>}
          {diagnostics.map((item, indexValue) => <div className="research-diagnostic" key={`${item.code}-${indexValue}`}><strong>{item.code}</strong><small>{item.path}</small></div>)}
        </InspectorSection>
      </div>
    </aside>
  )
}

function InspectorSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="research-inspector-section"><h3>{title}</h3>{children}</section>
}

function RelationshipList({
  title,
  relationships,
  resolve,
  onSelect,
}: {
  title: string
  relationships: ResearchRelationship[]
  resolve: (relationship: ResearchRelationship) => ResearchArtifactSummary | undefined
  onSelect: (artifact: ResearchArtifactSummary) => void
}) {
  return (
    <div className="research-relationship-list">
      <strong>{title}</strong>
      {relationships.length === 0 && <span className="research-muted">None</span>}
      {relationships.map((item, index) => {
        const target = resolve(item)
        return target ? (
          <button key={`${item.relation}-${index}`} onClick={() => onSelect(target)}><span>{item.relation}</span><small>{target.display_name}</small></button>
        ) : (
          <div className="research-unresolved" key={`${item.relation}-${index}`}><span>{item.relation}</span><small>{item.target_entity_id} · unresolved</small></div>
        )
      })}
    </div>
  )
}
