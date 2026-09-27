import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  Download,
  FileUp,
  Search,
  ShieldCheck,
  Trash2,
  WifiOff,
  X,
} from 'lucide-react'
import { useApp, useAtlasState } from './App'
import { EventDetail } from './Details'
import { ReadList } from './Timeline'
import { content } from '../lib/content'
import { DEFAULTS, filterEvents, type SearchState } from '../lib/state'
import { REGIONS, THEMES, regionName } from '../lib/taxonomy'
import { parseYear, yearToken } from '../lib/chronology'
import {
  parseBookmarks,
  readBookmarks,
  readPreference,
  writeBookmarks,
  writePreference,
  type Bookmark,
} from '../lib/persistence'
import {
  downloaded,
  downloadPack,
  removePack,
  verifyPack,
  type DownloadStatus,
} from '../lib/downloads'
import type { Pack, JourneyRecord, EventRecord } from '../lib/schema'
import s from '../styles/App.module.css'
export function SearchPage({ index }: { index: { id: string; text: string }[] }) {
  const { catalog } = useApp(),
    [state] = useAtlasState(),
    navigate = useNavigate(),
    [query, setQuery] = useState(state.q),
    [regions, setRegions] = useState(state.regions),
    [themes, setThemes] = useState(state.themes)
  useEffect(() => {
    setQuery(state.q)
    setRegions(state.regions)
    setThemes(state.themes)
  }, [state.q, state.regions.join(), state.themes.join()])
  const results = filterEvents(catalog.events, state, new Map(index.map((r) => [r.id, r.text])), {
      allTime: true,
    }),
    date = parseYear(state.q)
  const submit = () =>
    navigate({
      to: '/search',
      search: { ...state, q: query, regions, themes, selected: undefined },
    })
  return (
    <main id="main" className={s.page}>
      <div className={s.pageIntro}>
        <p className={s.eyebrow}>FIND YOUR THREAD</p>
        <h1>Search the atlas.</h1>
        <p>People, places, ideas — or a date such as “1200 CE”.</p>
      </div>
      <form
        className={s.bigSearch}
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <Search size={23} />
        <input
          autoComplete="off"
          name="q"
          aria-label="Search all history"
          placeholder="Try printing, water, India or 1200 CE…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          maxLength={200}
        />
        <button className={s.primary}>
          Search <ArrowRight size={17} />
        </button>
      </form>
      <div className={s.searchFilters}>
        <details className={s.searchGroup}>
          <summary>Regions · {state.regions.length || 'All'}</summary>
          <div>
            {REGIONS.map((r) => (
              <label className={s.checkbox} key={r.id}>
                <input
                  type="checkbox"
                  checked={state.regions.includes(r.id)}
                  onChange={() => {
                    const next = state.regions.includes(r.id)
                      ? state.regions.filter((x) => x !== r.id)
                      : [...state.regions, r.id]
                    setRegions(next)
                    navigate({ to: '/search', search: { ...state, regions: next } })
                  }}
                />
                {r.name}
              </label>
            ))}
          </div>
        </details>
        <details className={s.searchGroup}>
          <summary>Themes · {state.themes.length || 'All'}</summary>
          <div>
            {THEMES.map((t) => (
              <label className={s.checkbox} key={t.id}>
                <input
                  type="checkbox"
                  checked={state.themes.includes(t.id)}
                  onChange={() => {
                    const next = state.themes.includes(t.id)
                      ? state.themes.filter((x) => x !== t.id)
                      : [...state.themes, t.id]
                    setThemes(next)
                    navigate({ to: '/search', search: { ...state, themes: next } })
                  }}
                />
                {t.name}
              </label>
            ))}
          </div>
        </details>
        <button
          className={s.textButton}
          onClick={() => {
            setQuery('')
            setRegions([])
            setThemes([])
            navigate({ to: '/search', search: { ...DEFAULTS, q: '' } })
          }}
        >
          Clear filters
        </button>
      </div>
      <div className={s.searchSummary}>
        <p role="status">
          <strong>{results.length}</strong>{' '}
          {state.q ? (
            <>
              matches for <mark>{state.q}</mark>
            </>
          ) : (
            'records across all dates'
          )}
        </p>
        <small>
          Search covers the full preview index. Individual texts require a connection or an
          appropriate download.
        </small>
      </div>
      {date !== null && date < 2026 && (
        <Link
          to="/timeline"
          search={{
            ...state,
            from: yearToken(date),
            to: yearToken(Math.min(2026, date + 1)),
            q: '',
            selected: undefined,
          }}
          className={s.dateSearch}
        >
          Explore {state.q} on the aligned timeline <ArrowRight size={17} />
        </Link>
      )}
      <ReadList events={results} query={state.q} />
    </main>
  )
}
export function BookmarksPage() {
  const { catalog, manifest } = useApp(),
    [bookmarks, setBookmarks] = useState<Bookmark[]>([]),
    [pending, setPending] = useState<Bookmark[]>(),
    [mode, setMode] = useState('merge'),
    [message, setMessage] = useState(''),
    file = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const sync = () => setBookmarks(readBookmarks())
    sync()
    window.addEventListener('parallel-bookmarks', sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('parallel-bookmarks', sync)
      window.removeEventListener('storage', sync)
    }
  }, [])
  const valid = new Set(catalog.events.map((e) => e.id))
  return (
    <main id="main" className={s.page}>
      <div className={s.sectionHeading}>
        <div>
          <p className={s.eyebrow}>YOUR OWN PATH THROUGH HISTORY</p>
          <h1>Saved for another time.</h1>
          <p>Bookmarks stay on this device. Export a copy to take them with you.</p>
        </div>
        <div className={s.actions}>
          <button
            className={s.secondary}
            disabled={!bookmarks.length}
            onClick={() => {
              const url = URL.createObjectURL(
                new Blob([JSON.stringify({ schemaVersion: 1, bookmarks }, null, 2)], {
                  type: 'application/json',
                }),
              )
              const a = document.createElement('a')
              a.href = url
              a.download = 'parallel-bookmarks.json'
              a.click()
              setTimeout(() => URL.revokeObjectURL(url), 1000)
            }}
          >
            <Download size={16} /> Export
          </button>
          <button className={s.secondary} onClick={() => file.current?.click()}>
            <FileUp size={16} /> Import
          </button>
          <input
            ref={file}
            className={s.hidden}
            type="file"
            accept=".json,application/json"
            aria-label="Import bookmark file"
            onChange={async (e) => {
              const f = e.target.files?.[0]
              if (!f) return
              try {
                if (f.size > 500_000) throw new Error('File exceeds 500 KB.')
                setPending(parseBookmarks(await f.text(), valid))
                setMessage('')
              } catch (err) {
                setMessage(String(err))
              }
              e.target.value = ''
            }}
          />
        </div>
      </div>
      {message && (
        <p role="status" className={s.status}>
          {message}
        </p>
      )}
      {pending && (
        <section className={s.importPanel}>
          <h2>{pending.length} validated bookmarks ready to import</h2>
          <label>
            <input
              type="radio"
              name="import-mode"
              checked={mode === 'merge'}
              onChange={() => setMode('merge')}
            />{' '}
            Merge with existing
          </label>
          <label>
            <input
              type="radio"
              name="import-mode"
              checked={mode === 'replace'}
              onChange={() => setMode('replace')}
            />{' '}
            Replace existing bookmarks
          </label>
          <div className={s.actions}>
            <button
              className={s.primary}
              onClick={() => {
                try {
                  writeBookmarks([
                    ...new Map(
                      [...(mode === 'merge' ? bookmarks : []), ...pending].map((b) => [b.id, b]),
                    ).values(),
                  ])
                  setPending(undefined)
                  setMessage('Bookmarks imported.')
                } catch (e) {
                  setMessage(String(e))
                }
              }}
            >
              Import bookmarks
            </button>
            <button className={s.secondary} onClick={() => setPending(undefined)}>
              Cancel
            </button>
          </div>
        </section>
      )}
      {bookmarks.length ? (
        <>
          <p className={s.eyebrow}>{bookmarks.length} SAVED RECORDS</p>
          {bookmarks.map((b) => (
            <article className={s.savedRow} key={b.id}>
              <div>
                <Link to="/events/$eventId" params={{ eventId: b.id }}>
                  {catalog.events.find((e) => e.id === b.id)?.title || b.label}
                </Link>
                <small>
                  {valid.has(b.id)
                    ? catalog.events.find((e) => e.id === b.id)?.timeLabel
                    : manifest.withdrawals[b.id] ||
                      'Record unavailable or withdrawn in this version.'}
                </small>
              </div>
              <div className={s.actions}>
                {b.view && (
                  <Link
                    to="/timeline"
                    search={{ ...b.view, selected: b.id }}
                    className={s.textLink}
                  >
                    Restore view <ArrowUpRight size={16} />
                  </Link>
                )}
                <button
                  aria-label={'Remove ' + b.label}
                  className={s.iconButton}
                  onClick={() => {
                    try {
                      writeBookmarks(bookmarks.filter((x) => x.id !== b.id))
                    } catch (e) {
                      setMessage(String(e))
                    }
                  }}
                >
                  <Trash2 size={17} />
                </button>
              </div>
            </article>
          ))}
        </>
      ) : (
        <div className={s.empty}>
          <BookOpen size={35} />
          <h2>A collection waiting to happen.</h2>
          <p>Use Save on any record to build your own reading list.</p>
          <Link to="/timeline" className={s.primary}>
            Explore the atlas <ArrowRight size={16} />
          </Link>
        </div>
      )}
    </main>
  )
}
const bytes = (n: number) =>
  n < 1_000_000 ? `${Math.ceil(n / 1000)} KB` : `${(n / 1_000_000).toFixed(1)} MB`
export function DownloadsPage() {
  const { manifest } = useApp(),
    [stored, setStored] = useState<DownloadStatus[]>([]),
    [active, setActive] = useState(''),
    [progress, setProgress] = useState(0),
    [message, setMessage] = useState(''),
    [support, setSupport] = useState(true),
    [storage, setStorage] = useState(''),
    abort = useRef<AbortController | null>(null)
  const refresh = async () => {
    setStored(await downloaded())
    const e = await navigator.storage?.estimate()
    if (e?.usage && e.quota)
      setStorage(
        `${bytes(e.usage)} used of approximately ${bytes(e.quota)} available browser storage`,
      )
  }
  useEffect(() => {
    setSupport('caches' in window)
    refresh().catch(() => setSupport(false))
    return () => abort.current?.abort()
  }, [])
  const run = async (p: Pack, verify?: DownloadStatus) => {
    setActive(p.id)
    setProgress(0)
    setMessage('')
    const a = new AbortController()
    abort.current = a
    try {
      if (verify) {
        await verifyPack(manifest, p, verify.name, (d, t) => setProgress(d / t))
        setMessage(p.title + ': every file passed its integrity check.')
      } else {
        await downloadPack(manifest, p, (d, t) => setProgress(d / t), a.signal)
        setMessage(p.title + ' is ready offline.')
      }
      await refresh()
    } catch (e) {
      setMessage(
        e instanceof Error && e.name === 'AbortError'
          ? 'Download cancelled. Previous complete versions are intact.'
          : String(e),
      )
    } finally {
      setActive('')
      abort.current = null
    }
  }
  return (
    <main id="main" className={s.page}>
      <div className={s.downloadIntro}>
        <div>
          <p className={s.eyebrow}>TAKE THE LONG VIEW. ANYWHERE.</p>
          <h1>History, without a connection.</h1>
          <p>
            Download a text collection for your next train ride, quiet afternoon, or unexpected
            detour.
          </p>
        </div>
        <div className={s.downloadEmblem}>
          <Download size={48} strokeWidth={1} />
          <span>
            YOUR DEVICE
            <br />
            YOUR READING
          </span>
        </div>
      </div>
      <div className={s.offlineNotice}>
        <ShieldCheck size={22} />
        <p>
          Each file is checked before a collection is marked ready. Interrupted downloads leave your
          previous complete version intact. Source websites and their images are not included.
        </p>
      </div>
      {!support && (
        <p role="alert" className={s.error}>
          Offline storage is unavailable in this browser context. Use HTTPS or localhost with Cache
          Storage enabled.
        </p>
      )}
      {message && (
        <div role="status" className={s.status}>
          {message}
        </div>
      )}
      <div className={s.downloadGrid}>
        {manifest.packs.map((p) => {
          const copies = stored.filter(
              (x) => x.packId === p.id && x.version === manifest.contentVersion,
            ),
            ready = copies.at(-1)
          return (
            <article
              key={p.id}
              className={`${s.downloadCard} ${p.id === 'all' ? s.downloadFeatured : ''}`}
            >
              <div className={s.downloadCardTop}>
                {ready ? <CheckCircle2 size={23} /> : <Download size={23} />}
                <span>{bytes(p.bytes)} · TEXT ONLY</span>
              </div>
              <h2>{p.title}</h2>
              <p>{p.description}</p>
              <small>
                {p.recordIds.length} selected records · {p.artifacts.length} verified files
              </small>
              {active === p.id ? (
                <div className={s.downloadProgress}>
                  <progress
                    value={progress}
                    max="1"
                    aria-label={'Download progress for ' + p.title}
                  />
                  <span>{Math.round(progress * 100)}%</span>
                  <button className={s.textButton} onClick={() => abort.current?.abort()}>
                    Cancel
                  </button>
                </div>
              ) : (
                <div className={s.downloadActions}>
                  <button
                    className={ready ? s.secondary : s.primary}
                    disabled={!!active || !support}
                    onClick={() => run(p)}
                  >
                    {ready ? 'Repair / redownload' : 'Download collection'}{' '}
                    {!ready && <ArrowRight size={16} />}
                  </button>
                  {ready && (
                    <>
                      <button
                        className={s.textButton}
                        disabled={!!active}
                        onClick={() => run(p, ready)}
                      >
                        Verify
                      </button>
                      <button
                        className={s.iconButton}
                        aria-label={'Remove ' + p.title}
                        disabled={!!active}
                        onClick={async () => {
                          await Promise.all(copies.map((c) => removePack(c.name)))
                          await refresh()
                          setMessage(p.title + ' removed from this device.')
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </>
                  )}
                </div>
              )}
              {ready && (
                <small className={s.readyLabel}>
                  Ready offline ·{' '}
                  {copies.length > 1
                    ? `${copies.length} complete generations retained`
                    : 'Integrity verified on download'}
                </small>
              )}
            </article>
          )
        })}
      </div>
      <section className={s.storagePanel}>
        <h2>Your local library</h2>
        <p>{storage || 'Storage estimates appear when supported by your browser.'}</p>
        <p>
          Content version <code>{manifest.contentVersion}</code> is pinned for this session. Older
          complete versions remain available to open tabs until you explicitly remove them.
        </p>
        <button
          className={s.secondary}
          onClick={async () => {
            const result = await navigator.storage?.persist?.()
            setMessage(
              result
                ? 'Persistent storage granted.'
                : 'The browser did not grant persistent storage. Downloads may be evicted when space is needed.',
            )
          }}
        >
          Request persistent storage
        </button>
        {stored
          .filter((c) => c.version !== manifest.contentVersion)
          .map((c) => (
            <div className={s.savedRow} key={c.name}>
              <span>
                Previous version · {c.packId} · {c.version}
              </span>
              <button
                className={s.textButton}
                onClick={async () => {
                  await removePack(c.name)
                  await refresh()
                }}
              >
                Remove old version
              </button>
            </div>
          ))}
      </section>
    </main>
  )
}
export function JourneyPage({
  journey,
  events,
}: {
  journey: JourneyRecord
  events: EventRecord[]
}) {
  const [step, setStep] = useState(0)
  useEffect(
    () =>
      setStep(Math.min(events.length - 1, Math.max(0, readPreference('journey.' + journey.id, 0)))),
    [journey.id],
  )
  const go = (i: number) => {
    setStep(i)
    writePreference('journey.' + journey.id, i)
    document
      .getElementById('journey-current')
      ?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }
  return (
    <main id="main" className={s.journeyPage}>
      <div className={s.journeyHero}>
        <Link to="/" hash="journeys" className={s.textLink}>
          <ArrowLeft size={15} /> All journeys
        </Link>
        <p className={s.eyebrow}>A GUIDED READING / {events.length} STOPS</p>
        <h1>{journey.title}</h1>
        <p className={s.lead}>{journey.introduction}</p>
        <p>{journey.learningGoal}</p>
        <Link
          to="/timeline"
          search={{ ...DEFAULTS, ...journey.startingViewport, view: 'atlas' }}
          className={s.secondary}
        >
          See this time window in the atlas <ArrowUpRight size={16} />
        </Link>
      </div>
      <div className={s.journeyReader}>
        <aside className={s.journeySteps}>
          <p className={s.eyebrow}>YOUR PATH</p>
          <ol>
            {journey.steps.map((st, i) => (
              <li key={st.eventId}>
                <button onClick={() => go(i)} aria-current={step === i ? 'step' : undefined}>
                  <span>{String(i + 1).padStart(2, '0')}</span>
                  {st.heading}
                </button>
              </li>
            ))}
          </ol>
          <Link to="/downloads" className={s.textLink}>
            <Download size={15} /> Take this journey offline
          </Link>
          <small>{journey.evidenceNote}</small>
        </aside>
        <div id="journey-current">
          <div className={s.journeyProgress}>
            <span>
              STOP {step + 1} OF {events.length}
            </span>
            <progress value={step + 1} max={events.length} aria-label="Journey progress" />
            <div className={s.actions}>
              <button
                className={s.iconButton}
                aria-label="Previous journey step"
                disabled={step === 0}
                onClick={() => go(step - 1)}
              >
                <ArrowLeft size={17} />
              </button>
              <button
                className={s.iconButton}
                aria-label="Next journey step"
                disabled={step === events.length - 1}
                onClick={() => go(step + 1)}
              >
                <ArrowRight size={17} />
              </button>
            </div>
          </div>
          <EventDetail event={events[step]} drawer />
          <div className={s.journeyNext}>
            {step < events.length - 1 ? (
              <button className={s.primary} onClick={() => go(step + 1)}>
                Continue the journey <ArrowRight size={17} />
              </button>
            ) : (
              <>
                <CheckCircle2 size={25} />
                <h2>You’ve reached the end of this thread.</h2>
                <p>There are many more ways to look across the same world.</p>
                <Link to="/" hash="journeys" className={s.primary}>
                  Find another journey <ArrowRight size={17} />
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
export function AboutPage() {
  const { catalog, manifest } = useApp(),
    nonPolitical = catalog.events.filter((e) => e.themeIds[0] !== 'politics').length,
    largestRegion = Math.max(
      1,
      ...REGIONS.map((r) => catalog.events.filter((e) => e.primaryRegion === r.id).length),
    )
  return (
    <main id="main" className={s.page}>
      <div className={s.pageIntro}>
        <p className={s.eyebrow}>A NOTE ON HOW TO READ THIS ATLAS</p>
        <h1>
          Many histories.
          <br />
          <em>Visible evidence.</em>
        </h1>
        <p>
          Parallel is an invitation to look across the world at a shared moment in time — while
          keeping each history’s context intact.
        </p>
      </div>
      <div className={s.aboutColumns}>
        <article>
          <h2>A working research preview</h2>
          <p>
            This release includes {manifest.recordCounts.events} events and processes,{' '}
            {manifest.recordCounts.entities} entities, {manifest.recordCounts.periods} period
            records and {manifest.recordCounts.journeys} journeys. All event records have been
            checked against inspected institutional source passages. They have{' '}
            <strong>not received independent historical review</strong> and none is labeled
            published.
          </p>
          <p>
            Historical coverage is frozen at <strong>31 December 2025</strong>. Later source access
            dates document research activity, not later historical coverage. The application never
            generates history at runtime.
          </p>
          <h2>How dates work</h2>
          <p>
            The atlas uses one linear time scale across every regional lane. Historical years use
            BCE and CE, with no displayed year zero. Internally, astronomical year 0 represents 1
            BCE. Inclusive source dates are compiled into intervals with an exclusive upper bound.
          </p>
          <p>
            A dotted point or hatched edge means an approximate or uncertain date. A broad band
            represents a duration, not uncertainty about a single occurrence. Original expressions,
            date precision and calendar notes remain attached to each record. Uncalibrated
            radiocarbon years cannot be silently turned into calendar dates.
          </p>
          <h2>Connections require evidence</h2>
          <p>
            “Same supported period” means the stated intervals overlap with supported bounds.
            “Possibly overlapping” retains dating uncertainty. “Nearby in time” means proximity
            only. None of these labels establishes contact, transmission or causation. Documented
            relationships cite their own source passages.
          </p>
          <h2>Editorial standards & corrections</h2>
          <p>
            Claims link to sources and locators. Different pages from one institution count as one
            source family. Independent review, regional-language scholarship and additional
            corroboration remain pending. Institutional summaries can contain contested
            interpretations and must not be treated as neutral or complete.
          </p>
          <p>
            To propose a correction, record the stable event ID, the specific claim, a replacement
            passage and a bibliographic locator. The repository’s correction workflow retains
            previous versions, supports withdrawals and redirects, and requires a human review
            before publication.
          </p>
          <h2>Your data stays here</h2>
          <p>
            Small preferences and bookmarks are stored locally in your browser. Downloaded text uses
            Cache Storage. There are no accounts, analytics, hosted search, application databases or
            runtime AI calls. Clearing browser storage removes local bookmarks and downloads; export
            bookmarks first.
          </p>
          <h2>Install & read offline</h2>
          <p>
            Use your browser’s install command when offered. On iOS, open the site in Safari, choose
            Share, then Add to Home Screen. Download a pack before disconnecting. The app shell
            alone does not contain every historical detail.
          </p>
        </article>
        <aside className={s.coveragePanel}>
          <p className={s.eyebrow}>WHAT’S IN THIS EDITION</p>
          <div className={s.coverageNumbers}>
            <strong>
              {catalog.events.length}
              <span>events & processes</span>
            </strong>
            <strong>
              {Math.round((nonPolitical / Math.max(1, catalog.events.length)) * 100)}%
              <span>outside politics & warfare</span>
            </strong>
            <strong>
              {manifest.recordCounts.sources}
              <span>source records</span>
            </strong>
          </div>
          <h2>Coverage by region</h2>
          {REGIONS.map((r) => {
            const n = catalog.events.filter((e) => e.primaryRegion === r.id).length
            return (
              <div className={s.coverageRow} key={r.id}>
                <div>
                  <span>{r.name}</span>
                  <strong>{n}</strong>
                </div>
                <i style={{ width: (n / largestRegion) * 100 + '%', background: r.color }} />
              </div>
            )
          })}
          <div className={s.reviewNote}>
            <strong>Selection is not representation.</strong>
            <p>
              Heritage sites, cities and formal institutions are overrepresented. Women’s histories,
              labour, Indigenous perspectives, environmental change and regional-language
              scholarship need more space. Central Asia and Southeast Asia have particularly small
              samples.
            </p>
          </div>
          <h3>Known editorial limits</h3>
          <ul>
            <li>Many ancient and medieval claims depend on UNESCO site summaries.</li>
            <li>Independent second-source corroboration is incomplete.</li>
            <li>Some “years ago” dates use rounded placement anchors; read their date notes.</li>
            <li>
              The 40 entity/period records describe supported phases rather than comprehensive
              political lifespans.
            </li>
            <li>Short contexts are introductory, not full scholarly essays.</li>
          </ul>
          <p>
            Version <code>{manifest.contentVersion}</code>
            <br />
            Schema 1 · Explicit preview build
          </p>
        </aside>
      </div>
    </main>
  )
}
