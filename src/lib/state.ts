import { civil, ordinal, parseYear, yearToken, overlaps } from './chronology'
import { REGIONS, THEMES } from './taxonomy'
import type { EventIndex } from './schema'
export type SearchState = {
  v: 1
  from: string
  to: string
  regions: string[]
  themes: string[]
  view: 'atlas' | 'read' | 'compare'
  selected?: string
  q: string
  density: 'sparse' | 'balanced' | 'detailed'
  notice?: string
}
export const DEFAULTS: SearchState = {
  v: 1,
  from: '1000CE',
  to: '1400CE',
  regions: [],
  themes: [],
  view: 'atlas',
  q: '',
  density: 'balanced',
}
function group(value: unknown, ids: readonly string[]): string[] {
  const list = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : []
  return [
    ...new Set(list.filter((v): v is string => typeof v === 'string' && ids.includes(v))),
  ].slice(0, 10)
}
export function validateSearch(raw: Record<string, unknown>): SearchState {
  const from = typeof raw.from === 'string' ? parseYear(raw.from) : parseYear(DEFAULTS.from),
    to = typeof raw.to === 'string' ? parseYear(raw.to) : parseYear(DEFAULTS.to)
  const valid = from !== null && to !== null && from < to
  const regions = group(
      raw.regions,
      REGIONS.map((r) => r.id),
    ),
    themes = group(
      raw.themes,
      THEMES.map((t) => t.id),
    )
  const bad =
    !valid ||
    (raw.v !== undefined && Number(raw.v) !== 1) ||
    (raw.regions !== undefined &&
      group(
        raw.regions,
        REGIONS.map((r) => r.id),
      ).length !==
        (Array.isArray(raw.regions) ? raw.regions : String(raw.regions).split(',')).length) ||
    (raw.themes !== undefined &&
      themes.length !==
        (Array.isArray(raw.themes) ? raw.themes : String(raw.themes).split(',')).length)
  return {
    v: 1,
    from: valid ? yearToken(from!) : DEFAULTS.from,
    to: valid ? yearToken(to!) : DEFAULTS.to,
    regions,
    themes,
    view: ['atlas', 'read', 'compare'].includes(String(raw.view))
      ? (raw.view as SearchState['view'])
      : 'atlas',
    selected:
      typeof raw.selected === 'string' && /^evt_\d{6}$/.test(raw.selected)
        ? raw.selected
        : undefined,
    q: typeof raw.q === 'string' ? raw.q.slice(0, 200) : '',
    density: ['sparse', 'balanced', 'detailed'].includes(String(raw.density))
      ? (raw.density as SearchState['density'])
      : 'balanced',
    ...(bad ? { notice: 'Some URL values were invalid and have been reset.' } : {}),
  }
}
export const windowDays = (s: SearchState): [number, number] => [
  ordinal(parseYear(s.from)!),
  ordinal(parseYear(s.to)!),
]
export function dayWindow(start: number, end: number) {
  let a = civil(start).year,
    b = civil(end).year
  if (b <= a) b = a + 1
  return { from: yearToken(a), to: yearToken(Math.min(2026, b)) }
}
export const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
export function oneEditAway(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false
  let i = 0,
    j = 0,
    edits = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++
      j++
      continue
    }
    if (++edits > 1) return false
    if (a.length >= b.length) i++
    if (b.length >= a.length) j++
  }
  return edits + (i < a.length || j < b.length ? 1 : 0) <= 1
}
function matchesTerms(text: string, terms: string[]) {
  const normalized = normalize(text)
  return terms.every(
    (t) =>
      normalized.includes(t) ||
      (t.length >= 5 && normalized.split(/[^a-z0-9]+/).some((word) => oneEditAway(t, word))),
  )
}
export function filterEvents(
  events: EventIndex[],
  s: SearchState,
  search: Map<string, string> = new Map(),
  options: { allTime?: boolean; starts?: boolean; uncertain?: boolean } = {},
) {
  const [lo, hi] = windowDays(s),
    q = normalize(s.q.trim()),
    date = parseYear(s.q),
    terms = q.split(/\s+/).filter(Boolean)
  return events
    .filter(
      (e) =>
        (!s.regions.length || e.regionIds.some((r) => s.regions.includes(r))) &&
        (!s.themes.length || e.themeIds.some((t) => s.themes.includes(t))) &&
        (options.uncertain !== false || !e.compiled.isApproximate) &&
        (options.allTime ||
          (options.starts
            ? e.compiled.anchorDay !== undefined &&
              e.compiled.anchorDay >= lo &&
              e.compiled.anchorDay < hi
            : overlaps(e.compiled, lo, hi))) &&
        (!q || date !== null
          ? !q || overlaps(e.compiled, ordinal(date!), ordinal(date! + 1))
          : matchesTerms(
              [
                e.title,
                e.summary,
                e.subregion,
                ...e.alternativeTitles,
                ...e.themeIds,
                ...e.regionIds,
                ...e.regionIds.map((id) => REGIONS.find((r) => r.id === id)?.name || ''),
                ...e.themeIds.map((id) => THEMES.find((t) => t.id === id)?.name || ''),
                search.get(e.id) || '',
              ].join(' '),
              terms,
            )),
    )
    .sort((a, b) => {
      const rank = (e: EventIndex) =>
        normalize(e.title) === q ? 0 : normalize(e.title).includes(q) ? 1 : 2
      return (
        (q ? rank(a) - rank(b) : 0) ||
        (a.compiled.anchorDay || 0) - (b.compiled.anchorDay || 0) ||
        a.id.localeCompare(b.id)
      )
    })
}
export function serializeState(s: SearchState) {
  const p = new URLSearchParams()
  p.set('v', '1')
  for (const key of ['from', 'to', 'view', 'q', 'density', 'selected'] as const)
    if (s[key] && s[key] !== DEFAULTS[key as keyof typeof DEFAULTS]) p.set(key, s[key]!)
  for (const key of ['regions', 'themes'] as const) if (s[key].length) p.set(key, s[key].join(','))
  return p.toString()
}
export type Cluster = { key: string; events: EventIndex[]; day: number }
export function clusterEvents(
  events: EventIndex[],
  start: number,
  end: number,
  width: number,
  density: SearchState['density'],
  selected?: string,
): Cluster[] {
  const px = density === 'sparse' ? 210 : density === 'detailed' ? 100 : 155,
    buckets = new Map<number, EventIndex[]>(),
    out: Cluster[] = []
  for (const e of [...events].sort((a, b) => a.id.localeCompare(b.id))) {
    const day = Math.max(start, Math.min(end, e.compiled.anchorDay ?? start)),
      bucket = Math.floor((((day - start) / (end - start)) * width) / px)
    if (e.id === selected) out.push({ key: e.id, events: [e], day })
    else buckets.set(bucket, [...(buckets.get(bucket) || []), e])
  }
  for (const [b, items] of buckets)
    out.push({
      key: 'cluster-' + b,
      events: items,
      day:
        items.length === 1
          ? Math.max(start, Math.min(end, items[0].compiled.anchorDay ?? start))
          : start + ((b * px + px / 2) / width) * (end - start),
    })
  return out.sort((a, b) => a.day - b.day || a.key.localeCompare(b.key))
}
