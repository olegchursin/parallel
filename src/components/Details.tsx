import { useEffect, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowLeft, ArrowRight, ArrowUpRight, ExternalLink, Link2, X } from 'lucide-react'
import { content } from '../lib/content'
import type {
  EventRecord,
  EntityRecord,
  JourneyRecord,
  SourceRecord,
  RelationRecord,
} from '../lib/schema'
import { compileTime, compareTimes, timeLabel } from '../lib/chronology'
import { REGIONS, THEMES, regionName } from '../lib/taxonomy'
import { useApp, useAtlasState, BookmarkButton } from './App'
import s from '../styles/App.module.css'
export function Markdown({ text }: { text: string }) {
  return (
    <>
      {text.split('\n\n').map((p, i) => (
        <p key={i}>
          {p
            .split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
            .map((part, n) =>
              part.startsWith('**') ? (
                <strong key={n}>{part.slice(2, -2)}</strong>
              ) : part.startsWith('*') ? (
                <em key={n}>{part.slice(1, -1)}</em>
              ) : (
                part
              ),
            )}
        </p>
      ))}
    </>
  )
}
export function Citations({ record }: { record: EventRecord | EntityRecord | JourneyRecord }) {
  return (
    <section className={s.citations}>
      <p className={s.eyebrow}>EVIDENCE & PROVENANCE</p>
      <h2>Follow the sources</h2>
      <ol>
        {record.citations.map((c, i) => (
          <li key={c.id} id={c.id}>
            <Link to="/sources/$sourceId" params={{ sourceId: c.sourceId }}>
              {c.sourceId.replace('src_', 'Source ')} <ArrowUpRight size={14} />
            </Link>
            <p>
              <strong>{c.locator}</strong>
            </p>
            <p>{c.note}</p>
            <small>{c.supportRole === 'supports' ? 'Supports this record' : c.supportRole}</small>
          </li>
        ))}
      </ol>
      <details>
        <summary>Inspect {record.claims.length} cited claims</summary>
        {record.claims.map((c) => (
          <div className={s.claim} key={c.id}>
            <span className={s.eyebrow}>{c.claimType}</span>
            <p>{c.text}</p>
            {c.citationIds.map((id) => (
              <a key={id} href={'#' + id}>
                Citation {record.citations.findIndex((x) => x.id === id) + 1}{' '}
              </a>
            ))}
          </div>
        ))}
      </details>
      <div className={s.reviewNote}>
        <strong>Evidence checked · Independent review pending</strong>
        <p>{record.review.corroboration}</p>
        <small>
          Revision {record.review.revision} · {record.review.authoredBy}
        </small>
      </div>
    </section>
  )
}
export function EventDetail({ event, drawer = false }: { event: EventRecord; drawer?: boolean }) {
  const { catalog } = useApp(),
    [state] = useAtlasState(),
    [relations, setRelations] = useState<RelationRecord[]>([]),
    [copied, setCopied] = useState(false)
  useEffect(() => {
    let cancelled = false
    content
      .relations()
      .then((rs) => {
        if (!cancelled) setRelations(rs.filter((r) => r.fromId === event.id || r.toId === event.id))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [event.id])
  const t = compileTime(event.time),
    start = t.possibleStartDay ?? 0,
    end = t.possibleEndDayExclusive ?? start + 1
  const other = catalog.events
    .filter((e) => e.id !== event.id && e.primaryRegion !== event.primaryRegion)
    .sort((a, b) => {
      const rank = (e: typeof a) => (compareTimes(e.compiled, t) === 'Nearby in time' ? 1 : 0)
      return (
        rank(a) - rank(b) ||
        Math.abs((a.compiled.anchorDay || 0) - (t.anchorDay || 0)) -
          Math.abs((b.compiled.anchorDay || 0) - (t.anchorDay || 0))
      )
    })
    .slice(0, 5)
  return (
    <article className={drawer ? s.drawerArticle : s.detailArticle}>
      <div className={s.breadcrumb}>
        <Link to="/timeline" search={{ ...state, selected: undefined }}>
          Atlas
        </Link>
        <span>/</span>
        {regionName(event.primaryRegion)}
      </div>
      <div className={s.detailMeta}>
        <span className={s.themeTag}>{THEMES.find((t) => t.id === event.themeIds[0])?.name}</span>
        <span>{event.kind === 'process' ? 'Historical process' : 'Event'}</span>
      </div>
      <p className={s.detailDate}>{timeLabel(event.time)}</p>
      <h1>{event.title}</h1>
      <div className={s.detailActions}>
        <BookmarkButton id={event.id} title={event.title} view={state} />
        <button
          className={s.iconText}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(location.origin + '/events/' + event.id)
              setCopied(true)
            } catch {
              setCopied(false)
            }
          }}
        >
          <Link2 size={16} />
          {copied ? 'Link copied' : 'Copy link'}
        </button>
        {drawer && (
          <Link
            className={s.textLink}
            to="/events/$eventId"
            params={{ eventId: event.id }}
            search={{ ...state, selected: undefined }}
          >
            Full record <ArrowUpRight size={16} />
          </Link>
        )}
      </div>
      <div className={s.lead}>
        <Markdown text={event.summary} />
      </div>
      <section>
        <h2>Why it belongs in the atlas</h2>
        <Markdown text={event.context} />
      </section>
      <aside className={s.dateNote}>
        <span className={s.eyebrow}>HOW WE DATE IT</span>
        <p>{event.dateNote}</p>
        {event.time.type !== 'undated' && (
          <small>
            {event.time.type === 'point'
              ? event.time.when.sourceCalendar
              : event.time.start.sourceCalendar}
          </small>
        )}
        {event.time.alternatives?.map((a) => (
          <p key={a.label}>
            Alternative chronology: {a.label} · {a.start.label} {a.end && '– ' + a.end.label}
          </p>
        ))}
      </aside>
      {event.entityIds.length > 0 && (
        <section>
          <h2>People, places & institutions</h2>
          <div className={s.chips}>
            {event.entityIds.map((id) => (
              <Link key={id} to="/entities/$entityId" params={{ entityId: id }}>
                {catalog.entities.find((e) => e.id === id)?.title} <ArrowUpRight size={14} />
              </Link>
            ))}
          </div>
        </section>
      )}
      {relations.length > 0 && (
        <section>
          <h2>Documented connections</h2>
          {relations.map((r) => {
            const id = r.fromId === event.id ? r.toId : r.fromId
            return (
              <div className={s.relationship} key={r.id}>
                <p>{r.claim}</p>
                <Link to="/events/$eventId" params={{ eventId: id }}>
                  {catalog.events.find((e) => e.id === id)?.title} <ArrowRight size={14} />
                </Link>
                <div>
                  {r.citations.map((c) => (
                    <Link
                      key={c.id}
                      to="/sources/$sourceId"
                      params={{ sourceId: c.sourceId }}
                      className={s.mutedLink}
                    >
                      {c.locator}
                    </Link>
                  ))}
                </div>
              </div>
            )
          })}
        </section>
      )}
      <Citations record={event} />
      <section className={s.worldThen}>
        <p className={s.eyebrow}>LOOK SIDEWAYS</p>
        <h2>Elsewhere in the world</h2>
        <p>Temporal comparison only. Overlap does not establish contact or causation.</p>
        {other.map((e) => (
          <Link
            key={e.id}
            to="/events/$eventId"
            params={{ eventId: e.id }}
            className={s.relatedCard}
          >
            <span>
              <small>
                {regionName(e.primaryRegion)} · {compareTimes(e.compiled, t)}
              </small>
              <strong>{e.title}</strong>
              <small>{e.timeLabel}</small>
            </span>
            <ArrowUpRight size={17} />
          </Link>
        ))}
      </section>
    </article>
  )
}
export function EventDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null),
    [event, setEvent] = useState<EventRecord>(),
    [error, setError] = useState('')
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    dialog.current?.showModal()
    return () => {
      dialog.current?.close()
      requestAnimationFrame(() => {
        if (previous?.isConnected) previous.focus()
      })
    }
  }, [])
  useEffect(() => {
    let live = true
    setEvent(undefined)
    setError('')
    content
      .record<EventRecord>(id)
      .then((e) => {
        if (live) setEvent(e)
      })
      .catch((e) => {
        if (live) setError(e.message)
      })
    return () => {
      live = false
    }
  }, [id])
  return (
    <dialog
      ref={dialog}
      className={s.drawer}
      aria-label="Event details"
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === dialog.current) onClose()
      }}
    >
      <div className={s.drawerHeader}>
        <span>PARALLEL / FIELD NOTES</span>
        <button
          onClick={onClose}
          className={s.iconButton}
          autoFocus
          aria-label="Close event details"
        >
          <X />
        </button>
      </div>
      {error ? (
        <div className={s.empty}>
          <h2>Text unavailable</h2>
          <p>{error}</p>
          <Link to="/downloads">Manage downloads</Link>
        </div>
      ) : event ? (
        <EventDetail event={event} drawer />
      ) : (
        <p className={s.loading} role="status">
          Opening the source-backed record…
        </p>
      )}
    </dialog>
  )
}
export function EntityDetail({ entity }: { entity: EntityRecord }) {
  const { catalog } = useApp()
  return (
    <main id="main" className={s.page}>
      <article className={s.detailArticle}>
        <Link to="/timeline" className={s.textLink}>
          <ArrowLeft size={16} /> Back to the atlas
        </Link>
        <p className={s.eyebrow}>{entity.entityType} · RESEARCH PREVIEW</p>
        <h1>{entity.title}</h1>
        <p className={s.lead}>{entity.summary}</p>
        <h2>Documented phases</h2>
        <p>
          These are the phases supported by this preview’s records, not a definitive account of the
          entity’s entire existence.
        </p>
        {entity.existencePhases.map((p, i) => (
          <div className={s.dateNote} key={i}>
            <strong>{timeLabel(p.time)}</strong>
            <p>{p.label}</p>
          </div>
        ))}
        <h2>Related records</h2>
        {entity.eventIds.map((id) => (
          <Link key={id} to="/events/$eventId" params={{ eventId: id }} className={s.relatedCard}>
            {catalog.events.find((e) => e.id === id)?.title}
            <ArrowRight size={16} />
          </Link>
        ))}
        <Citations record={entity} />
      </article>
    </main>
  )
}
export function SourceDetail({ source }: { source: SourceRecord }) {
  return (
    <main id="main" className={s.page}>
      <article className={s.detailArticle}>
        <p className={s.eyebrow}>SOURCE LIBRARY / {source.id}</p>
        <h1>{source.title}</h1>
        <p className={s.lead}>{source.publisher}</p>
        <a href={source.url} target="_blank" rel="noreferrer" className={s.primary}>
          Read the original source <ExternalLink size={16} />
        </a>
        <dl className={s.metadata}>
          <dt>Creator</dt>
          <dd>{source.creator}</dd>
          <dt>Source type</dt>
          <dd>{source.sourceType}</dd>
          <dt>Language</dt>
          <dd>{source.language}</dd>
          <dt>Publication date</dt>
          <dd>{source.publicationDate}</dd>
          <dt>Accessed</dt>
          <dd>{source.accessedAt}</dd>
          <dt>Source family</dt>
          <dd>{source.sourceFamily}</dd>
        </dl>
        <h2>What was checked</h2>
        <p>{source.inspectionNote}</p>
        <h2>Use & attribution</h2>
        <p>{source.rights}</p>
        <div className={s.dateNote}>
          Source metadata is available in downloaded text packs. The original website requires an
          internet connection. Different pages from one institution do not constitute independent
          corroboration.
        </div>
      </article>
    </main>
  )
}
