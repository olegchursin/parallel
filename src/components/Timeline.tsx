import { useEffect, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Columns3,
  Filter,
  Layers3,
  Minus,
  MoveHorizontal,
  Plus,
  RotateCcw,
  Search,
  X,
} from 'lucide-react'
import { useApp, useAtlasState, BookmarkButton } from './App'
import { EventDrawer } from './Details'
import { REGIONS, THEMES, PRESETS, regionName } from '../lib/taxonomy'
import {
  clampWindow,
  civil,
  formatYear,
  ordinal,
  overlaps,
  parseYear,
  project,
  ticks,
  yearToken,
} from '../lib/chronology'
import {
  clusterEvents,
  dayWindow,
  filterEvents,
  windowDays,
  type SearchState,
  type Cluster,
} from '../lib/state'
import { readPreference, writePreference } from '../lib/persistence'
import type { EventIndex } from '../lib/schema'
import s from '../styles/App.module.css'
function Highlight({ text, query }: { text: string; query: string }) {
  const at = query ? text.toLocaleLowerCase().indexOf(query.toLocaleLowerCase()) : -1
  return at < 0 ? (
    <>{text}</>
  ) : (
    <>
      {text.slice(0, at)}
      <mark>{text.slice(at, at + query.length)}</mark>
      {text.slice(at + query.length)}
    </>
  )
}
export function ReadList({
  events,
  onSelect,
  pageSize = 12,
  query = '',
}: {
  events: EventIndex[]
  onSelect?: (id: string) => void
  pageSize?: number
  query?: string
}) {
  const [page, setPage] = useState(0),
    signature = events.map((e) => e.id).join()
  useEffect(() => setPage(0), [signature])
  const max = Math.max(1, Math.ceil(events.length / pageSize)),
    safe = Math.min(page, max - 1)
  return (
    <>
      <div className={s.readList}>
        {events.slice(safe * pageSize, (safe + 1) * pageSize).map((e) => (
          <article className={s.readCard} key={e.id}>
            <div className={s.readDate}>
              {e.timeLabel}
              <span>
                {e.compiled.isApproximate ? 'Approximate chronology' : 'Dated to stated precision'}
              </span>
            </div>
            <div>
              <span className={s.eyebrow}>
                {regionName(e.primaryRegion)} / {THEMES.find((t) => t.id === e.themeIds[0])?.name}
              </span>
              <h3>
                {onSelect ? (
                  <button
                    onClick={(click) => {
                      click.currentTarget.focus()
                      onSelect(e.id)
                    }}
                  >
                    <Highlight text={e.title} query={query} />
                  </button>
                ) : (
                  <Link to="/events/$eventId" params={{ eventId: e.id }}>
                    <Highlight text={e.title} query={query} />
                  </Link>
                )}
              </h3>
              <p>
                <Highlight text={e.summary} query={query} />
              </p>
            </div>
            <BookmarkButton id={e.id} title={e.title} compact />
          </article>
        ))}
      </div>
      {!events.length ? (
        <div className={s.empty}>
          <Search size={28} />
          <h2>No records in this view</h2>
          <p>Widen the dates or clear a filter. Empty space reflects this collection’s limits.</p>
        </div>
      ) : (
        <nav className={s.pagination} aria-label="Reading pages">
          <button disabled={safe === 0} onClick={() => setPage((p) => p - 1)}>
            <ArrowLeft size={16} /> Previous
          </button>
          <span aria-live="polite">
            Page {safe + 1} of {max} · {events.length} records
          </span>
          <button disabled={safe >= max - 1} onClick={() => setPage((p) => p + 1)}>
            Next <ArrowRight size={16} />
          </button>
        </nav>
      )}
    </>
  )
}
export function Timeline() {
  const { catalog } = useApp(),
    [state, setState] = useAtlasState(),
    [filtersOpen, setFiltersOpen] = useState(false),
    [expanded, setExpanded] = useState<string[]>([]),
    [cluster, setCluster] = useState<Cluster>(),
    [dateError, setDateError] = useState(''),
    [includeUncertain, setIncludeUncertain] = useState(true),
    [starts, setStarts] = useState(false),
    [width, setWidth] = useState(920)
  const defaultOrder = REGIONS.map((r) => r.id) as string[],
    [order, setOrder] = useState(defaultOrder),
    plot = useRef<HTMLDivElement>(null),
    drag = useRef<{ x: number; from: number; to: number } | null>(null),
    [range, setRange] = useState({ from: state.from, to: state.to }),
    [query, setQuery] = useState(state.q)
  const [lo, hi] = windowDays(state)
  useEffect(() => {
    setRange({ from: state.from, to: state.to })
    setQuery(state.q)
    setCluster(undefined)
  }, [state.from, state.to, state.q])
  useEffect(() => {
    const saved = readPreference<string[]>('laneOrder', defaultOrder)
    if (
      saved.length === 10 &&
      saved.every((id) => defaultOrder.includes(id)) &&
      new Set(saved).size === 10
    )
      setOrder(saved)
    // First visit only; an explicit URL view always wins and later resizes never reset it.
    if (
      !new URL(location.href).searchParams.has('view') &&
      !readPreference('visited', false) &&
      matchMedia('(max-width: 700px)').matches
    )
      setState({ view: 'read' }, true)
    writePreference('visited', true)
  }, [])
  useEffect(() => {
    if (!plot.current) return
    const ob = new ResizeObserver((entries) =>
      setWidth(
        Math.max(
          180,
          entries[0].contentRect.width - (matchMedia('(max-width: 600px)').matches ? 113 : 174),
        ),
      ),
    )
    ob.observe(plot.current)
    return () => ob.disconnect()
  }, [state.view])
  const events = filterEvents(catalog.events, state, new Map(), {
    uncertain: includeUncertain,
    starts,
  })
  const visibleRegions = order.filter((id) => !state.regions.length || state.regions.includes(id)),
    comparison = (state.regions.length ? state.regions : visibleRegions).slice(0, 3),
    lanes = state.view === 'compare' ? comparison : visibleRegions
  const move = (id: string, delta: number) => {
    const next = [...order],
      idx = next.indexOf(id),
      target = idx + delta
    if (target < 0 || target >= next.length) return
    ;[next[idx], next[target]] = [next[target], next[idx]]
    setOrder(next)
    writePreference('laneOrder', next)
    if (state.view === 'compare' && state.regions.length)
      setState({ regions: next.filter((r) => state.regions.includes(r)) })
  }
  const changeWindow = (a: number, b: number) => {
    const [start, end] = clampWindow(a, b)
    setState(dayWindow(start, end), true)
  }
  const pan = (direction: number) =>
    changeWindow(lo + direction * (hi - lo) * 0.5, hi + direction * (hi - lo) * 0.5)
  const zoom = (factor: number) => {
    const mid = (lo + hi) / 2,
      span = Math.max(366, (hi - lo) * factor)
    changeWindow(mid - span / 2, mid + span / 2)
  }
  const toggleFilter = (key: 'regions' | 'themes', id: string) =>
    setState({
      [key]: state[key].includes(id) ? state[key].filter((x) => x !== id) : [...state[key], id],
    })
  const choose = (id: string) => {
    setCluster(undefined)
    setState({ selected: id })
  }
  const ruler = ticks(lo, hi, width),
    deep = hi - lo > 365.2425 * 10000
  return (
    <main id="main" className={s.atlasPage}>
      <div className={s.atlasHeading}>
        <div>
          <p className={s.eyebrow}>THE WORLD, SIDE BY SIDE</p>
          <h1>
            Explore the atlas<span className={s.headingDot}>.</span>
          </h1>
        </div>
        <div className={s.viewToggle} role="group" aria-label="Timeline view">
          {[
            ['atlas', 'Atlas', Layers3],
            ['read', 'Read', BookOpen],
            ['compare', 'Compare', Columns3],
          ].map(([id, label, Icon]) => {
            const I = Icon as typeof Layers3
            return (
              <button
                key={String(id)}
                aria-pressed={state.view === id}
                onClick={() => setState({ view: id as SearchState['view'] })}
              >
                <I size={16} />
                {String(label)}
              </button>
            )
          })}
        </div>
      </div>
      {state.notice && (
        <div className={s.status} role="status">
          {state.notice}
          <button onClick={() => setState({ notice: undefined })}>Dismiss</button>
        </div>
      )}
      <div className={s.atlasLayout}>
        <aside className={`${s.filters} ${filtersOpen ? s.filtersOpen : ''}`}>
          <div className={s.filterTitle}>
            <strong>Shape your view</strong>
            <button
              className={s.iconButton}
              aria-label="Close filters"
              onClick={() => setFiltersOpen(false)}
            >
              <X size={16} />
            </button>
          </div>
          <label className={s.inputLabel}>
            FIND IN THIS VIEW
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const y = parseYear(query)
                setState({
                  q: query,
                  ...(y !== null && y < 2026
                    ? { from: yearToken(y), to: yearToken(Math.min(2026, y + 1)) }
                    : {}),
                })
              }}
              className={s.searchInput}
            >
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="People, places, ideas…"
                maxLength={200}
                aria-label="Search this timeline"
              />
              <button aria-label="Apply search">
                <Search size={17} />
              </button>
            </form>
          </label>
          <Link to="/search" className={s.mutedLink}>
            Search the entire atlas ↗
          </Link>
          <label className={s.inputLabel}>
            TIME WINDOWS
            <select
              aria-label="Choose a time window"
              value=""
              onChange={(e) => {
                const p = PRESETS.find((p) => p.id === e.target.value)
                if (p) setState({ from: p.from, to: p.to, q: '' })
              }}
            >
              <option value="" disabled>
                Jump to an era…
              </option>
              {PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </label>
          <fieldset>
            <legend>
              REGIONS <span>{state.regions.length || 'All'}</span>
            </legend>
            {REGIONS.map((r) => (
              <label key={r.id} className={s.checkbox}>
                <input
                  type="checkbox"
                  checked={state.regions.includes(r.id)}
                  onChange={() => toggleFilter('regions', r.id)}
                />
                <i style={{ background: r.color }} />
                {r.name}
              </label>
            ))}
          </fieldset>
          <details className={s.themeFilter} open>
            <summary>
              THEMES <span>{state.themes.length || 'All'}</span>
            </summary>
            {THEMES.map((t) => (
              <label key={t.id} className={s.checkbox}>
                <input
                  type="checkbox"
                  checked={state.themes.includes(t.id)}
                  onChange={() => toggleFilter('themes', t.id)}
                />
                {t.name}
              </label>
            ))}
          </details>
          <details className={s.themeFilter}>
            <summary>DATE EVIDENCE</summary>
            <label className={s.checkbox}>
              <input
                type="checkbox"
                checked={includeUncertain}
                onChange={(e) => setIncludeUncertain(e.target.checked)}
              />{' '}
              Include approximate dates
            </label>
            <label className={s.checkbox}>
              <input
                type="checkbox"
                checked={starts}
                onChange={(e) => setStarts(e.target.checked)}
              />{' '}
              Starts in this window only
            </label>
          </details>
          <button
            className={s.resetButton}
            onClick={() => {
              setState({ regions: [], themes: [], q: '' })
              setIncludeUncertain(true)
              setStarts(false)
              setOrder(defaultOrder)
              writePreference('laneOrder', defaultOrder)
            }}
          >
            <RotateCcw size={14} /> Reset filters & lane order
          </button>
          <p className={s.filterFoot}>
            OR within regions and themes.
            <br />
            AND between filter groups.
          </p>
        </aside>
        <section className={s.atlasMain} aria-label="Historical timeline">
          <div className={s.timelineTools}>
            <button
              className={`${s.secondary} ${s.mobileFilters}`}
              onClick={() => setFiltersOpen(!filtersOpen)}
            >
              <Filter size={16} /> Filters{' '}
              {state.regions.length + state.themes.length > 0 &&
                `(${state.regions.length + state.themes.length})`}
            </button>
            <form
              className={s.dateForm}
              onSubmit={(e) => {
                e.preventDefault()
                const a = parseYear(range.from),
                  b = parseYear(range.to)
                if (a === null || b === null || a >= b)
                  setDateError('Use ordered dates such as 500 BCE and 1400 CE.')
                else {
                  setDateError('')
                  setState({ from: yearToken(a), to: yearToken(b) })
                }
              }}
            >
              <label>
                <span>From</span>
                <input
                  aria-label="From date"
                  value={range.from}
                  onChange={(e) => setRange({ ...range, from: e.target.value })}
                />
              </label>
              <span>—</span>
              <label>
                <span>To (exclusive)</span>
                <input
                  aria-label="To date exclusive"
                  value={range.to}
                  onChange={(e) => setRange({ ...range, to: e.target.value })}
                />
              </label>
              <button type="submit" aria-label="Apply date range">
                <ArrowRight size={17} />
              </button>
            </form>
            <div className={s.zoomTools}>
              <button aria-label="Previous time window" onClick={() => pan(-1)}>
                <ArrowLeft size={17} />
              </button>
              <button aria-label="Zoom out" onClick={() => zoom(2)}>
                <Minus size={17} />
              </button>
              <button aria-label="Zoom in" onClick={() => zoom(0.5)}>
                <Plus size={17} />
              </button>
              <button aria-label="Next time window" onClick={() => pan(1)}>
                <ArrowRight size={17} />
              </button>
            </div>
          </div>
          {dateError && (
            <p className={s.error} role="alert">
              {dateError}
            </p>
          )}
          <div className={s.viewSummary}>
            <span>
              <strong>{events.length}</strong> records in view{' '}
              <span className={s.summaryDivider}>/</span>{' '}
              {deep ? 'Deep human history' : formatYear(parseYear(state.from)!)}
              {!deep && ' – ' + formatYear(parseYear(state.to)!)}
            </span>
            <label>
              Detail{' '}
              <select
                aria-label="Timeline density"
                value={state.density}
                onChange={(e) => setState({ density: e.target.value as SearchState['density'] })}
              >
                <option value="sparse">Sparse</option>
                <option value="balanced">Balanced</option>
                <option value="detailed">Detailed</option>
              </select>
            </label>
          </div>
          {(state.regions.length > 0 || state.themes.length > 0 || state.q) && (
            <div className={s.activeFilters}>
              {[...state.regions, ...state.themes].map((id) => (
                <button
                  key={id}
                  onClick={() =>
                    toggleFilter(state.regions.includes(id) ? 'regions' : 'themes', id)
                  }
                >
                  {REGIONS.find((r) => r.id === id)?.name || THEMES.find((t) => t.id === id)?.name}
                  <X size={12} />
                </button>
              ))}
              {state.q && (
                <button onClick={() => setState({ q: '' })}>
                  “{state.q}” <X size={12} />
                </button>
              )}
            </div>
          )}
          {state.view === 'read' ? (
            <ReadList events={events} onSelect={choose} query={state.q} />
          ) : (
            <>
              <div className={s.timelinePlot} ref={plot}>
                {state.view === 'compare' && (
                  <div className={s.compareNote}>
                    <Columns3 size={16} /> Comparing up to three lanes on the same scale. Select
                    regions at left to change them; use arrows to reorder.
                  </div>
                )}
                <div className={s.ruler}>
                  <div className={s.laneLabelHead}>
                    REGION / {deep ? 'DEEP TIME' : 'CHRONOLOGY'}
                  </div>
                  <div className={s.tickTrack}>
                    {ruler.map((t) => (
                      <span style={{ left: project(t.day, lo, hi, 100) + '%' }} key={t.day}>
                        {t.label}
                      </span>
                    ))}
                  </div>
                </div>
                <div
                  className={s.laneArea}
                  aria-label="Pan timeline"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.target !== e.currentTarget) return
                    if (['ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', '+', '-'].includes(e.key))
                      e.preventDefault()
                    if (e.key === 'ArrowLeft' || e.key === 'PageUp') pan(-1)
                    if (e.key === 'ArrowRight' || e.key === 'PageDown') pan(1)
                    if (e.key === '+') zoom(0.5)
                    if (e.key === '-') zoom(2)
                  }}
                  onWheel={(e) => {
                    if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
                      e.preventDefault()
                      const dx = e.deltaX || e.deltaY
                      changeWindow(lo + (dx / width) * (hi - lo), hi + (dx / width) * (hi - lo))
                    }
                  }}
                  onPointerDown={(e) => {
                    if ((e.target as HTMLElement).closest('button,a,input')) return
                    drag.current = { x: e.clientX, from: lo, to: hi }
                    e.currentTarget.setPointerCapture(e.pointerId)
                  }}
                  onPointerUp={(e) => {
                    if (!drag.current) return
                    const d = drag.current
                    drag.current = null
                    const delta = ((d.x - e.clientX) / width) * (d.to - d.from)
                    if (Math.abs(d.x - e.clientX) > 8) changeWindow(d.from + delta, d.to + delta)
                  }}
                >
                  {lanes.map((id) => {
                    const region = REGIONS.find((r) => r.id === id)!,
                      items = events.filter((e) => e.regionIds.includes(id)),
                      open = expanded.includes(id),
                      groups = open ? [...new Set(items.map((e) => e.subregion))] : ['']
                    return (
                      <div
                        className={s.regionGroup}
                        key={id}
                        style={{ '--lane-color': region.color } as React.CSSProperties}
                      >
                        <div
                          className={s.laneLabel}
                          draggable
                          onDragStart={(e) => e.dataTransfer.setData('text/parallel-region', id)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault()
                            const from = e.dataTransfer.getData('text/parallel-region')
                            if (!order.includes(from) || from === id) return
                            const next = order.filter((x) => x !== from)
                            next.splice(next.indexOf(id), 0, from)
                            setOrder(next)
                            writePreference('laneOrder', next)
                            if (state.view === 'compare' && state.regions.length)
                              setState({ regions: next.filter((r) => state.regions.includes(r)) })
                          }}
                        >
                          <div>
                            <button
                              className={s.expandLane}
                              aria-expanded={open}
                              aria-label={(open ? 'Collapse ' : 'Expand ') + region.name}
                              onClick={() =>
                                setExpanded(
                                  open ? expanded.filter((x) => x !== id) : [...expanded, id],
                                )
                              }
                            >
                              {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              <span>{region.name}</span>
                            </button>
                            <small>
                              {items.length} {items.length === 1 ? 'record' : 'records'}
                            </small>
                          </div>
                          <div className={s.laneOrder}>
                            <button
                              aria-label={'Move ' + region.name + ' up'}
                              disabled={order.indexOf(id) === 0}
                              onClick={() => move(id, -1)}
                            >
                              <ArrowUp size={12} />
                            </button>
                            <button
                              aria-label={'Move ' + region.name + ' down'}
                              disabled={order.indexOf(id) === 9}
                              onClick={() => move(id, 1)}
                            >
                              <ArrowDown size={12} />
                            </button>
                          </div>
                        </div>
                        <div className={s.laneTracks}>
                          {(groups.length ? groups : ['']).map((group) => {
                            const records = group
                                ? items.filter((e) => e.subregion === group)
                                : items,
                              clusters = clusterEvents(
                                records,
                                lo,
                                hi,
                                width,
                                state.density,
                                state.selected,
                              ),
                              periods = catalog.periods.filter(
                                (p) => p.regionIds.includes(id) && overlaps(p.compiled, lo, hi),
                              )
                            return (
                              <div key={group} className={s.laneTrack}>
                                <div className={s.gridLines}>
                                  {ruler.map((t) => (
                                    <i
                                      style={{ left: project(t.day, lo, hi, 100) + '%' }}
                                      key={t.day}
                                    />
                                  ))}
                                </div>
                                {group && <span className={s.subregion}>{group}</span>}
                                {!group &&
                                  periods.slice(0, 3).map((p, i) => {
                                    const a = Math.max(lo, p.compiled.possibleStartDay!),
                                      b = Math.min(hi, p.compiled.possibleEndDayExclusive ?? a)
                                    return (
                                      <button
                                        key={p.id}
                                        className={`${s.periodBand} ${p.compiled.isApproximate ? s.approxBand : ''}`}
                                        style={{
                                          left: project(a, lo, hi, 100) + '%',
                                          width: Math.max(0.2, ((b - a) / (hi - lo)) * 100) + '%',
                                          top: 8 + i * 18,
                                        }}
                                        title={p.title + ' · ' + p.timeLabel}
                                        aria-label={'Period: ' + p.title + ', ' + p.timeLabel}
                                        onClick={() => {
                                          if (p.entityId) location.href = '/entities/' + p.entityId
                                          else
                                            setCluster({
                                              key: p.id,
                                              events: records.filter((e) =>
                                                overlaps(e.compiled, a, b),
                                              ),
                                              day: a,
                                            })
                                        }}
                                      >
                                        <span>{p.title}</span>
                                      </button>
                                    )
                                  })}
                                <div className={s.markRow}>
                                  {clusters.map((c, i) => {
                                    const e = c.events[0],
                                      duration = c.events.length === 1 && e.kind === 'process',
                                      start = Math.max(lo, e.compiled.possibleStartDay ?? lo),
                                      end = Math.min(
                                        hi,
                                        e.compiled.possibleEndDayExclusive ?? start,
                                      ),
                                      pct = Math.max(
                                        1,
                                        Math.min(
                                          98,
                                          project(duration ? start : c.day, lo, hi, 100),
                                        ),
                                      )
                                    return (
                                      <button
                                        key={c.key}
                                        className={`${s.timeMark} ${c.events.length > 1 ? s.clusterMark : ''} ${e.id === state.selected ? s.selectedMark : ''} ${duration ? s.durationEvent : ''}`}
                                        style={{
                                          left: pct + '%',
                                          top: 70 + (i % 2) * 34,
                                          ...(duration
                                            ? {
                                                width:
                                                  Math.max(0.2, ((end - start) / (hi - lo)) * 100) +
                                                  '%',
                                              }
                                            : {}),
                                        }}
                                        onClick={(click) => {
                                          click.currentTarget.focus()
                                          c.events.length === 1 ? choose(e.id) : setCluster(c)
                                        }}
                                        aria-label={
                                          c.events.length === 1
                                            ? e.title + ', ' + e.timeLabel
                                            : `Show ${c.events.length} clustered records in ${region.name}`
                                        }
                                      >
                                        <i
                                          className={e.compiled.isApproximate ? s.approxPoint : ''}
                                        >
                                          {c.events.length > 1
                                            ? c.events.length
                                            : duration && e.compiled.possibleStartDay! < lo
                                              ? '‹'
                                              : ''}
                                        </i>
                                        <span className={pct > 72 && !duration ? s.labelLeft : ''}>
                                          {c.events.length > 1
                                            ? `${c.events.length} records`
                                            : e.title}
                                        </span>
                                      </button>
                                    )
                                  })}
                                </div>
                                {!records.length && (
                                  <p className={s.emptyLane}>No records in this preview window</p>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div className={s.timelineLegend}>
                <span>
                  <i /> Event
                </span>
                <span>
                  <i className={s.legendApprox} /> Approximate date
                </span>
                <span>
                  <b /> Documented phase
                </span>
                <span>
                  <MoveHorizontal size={15} /> Drag or Shift + scroll to pan
                </span>
              </div>
              <label className={s.overviewLabel}>
                OVERVIEW NAVIGATOR <span>{deep ? '300,000 BCE' : '12,000 BCE'} — 2025 CE</span>
                <input
                  aria-label="Move timeline window across overview"
                  type="range"
                  min={deep ? -299999 : -11999}
                  max={2025}
                  value={Math.max(
                    deep ? -299999 : -11999,
                    Math.min(2025, (civil(lo).year + civil(hi).year) / 2),
                  )}
                  onChange={(e) => {
                    const center = ordinal(Number(e.target.value))
                    changeWindow(center - (hi - lo) / 2, center + (hi - lo) / 2)
                  }}
                />
              </label>
              {cluster && (
                <section className={s.clusterList} aria-label="Cluster contents">
                  <div className={s.sectionHeading}>
                    <h2>{cluster.events.length} records in this cluster</h2>
                    <button
                      className={s.iconButton}
                      aria-label="Close cluster"
                      onClick={() => setCluster(undefined)}
                    >
                      <X />
                    </button>
                  </div>
                  <ReadList events={cluster.events} onSelect={choose} />
                </section>
              )}
              <div className={s.atlasHint}>
                <BookOpen size={18} />
                <p>
                  Every matching record is available in{' '}
                  <button onClick={() => setState({ view: 'read' })}>Read view</button>, even when
                  the atlas groups nearby marks. Approximate marks indicate evidence limits; broad
                  bands describe durations.
                </p>
              </div>
            </>
          )}
          <div className={s.coverageInline}>
            <span className={s.preview}>
              <i /> Research preview
            </span>
            <p>
              Empty space means a gap in this collection, not a gap in history.{' '}
              <Link to="/about">Coverage & editorial status ↗</Link>
            </p>
          </div>
        </section>
      </div>
      {state.selected && (
        <EventDrawer id={state.selected} onClose={() => setState({ selected: undefined })} />
      )}
    </main>
  )
}
