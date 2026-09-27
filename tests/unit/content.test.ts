import { describe, it, expect } from 'vitest'
import { buildContent, canonical, strictJson, canShip } from '../../scripts/content/build'
import {
  filterEvents,
  clusterEvents,
  DEFAULTS,
  validateSearch,
  serializeState,
} from '../../src/lib/state'
import { ordinal } from '../../src/lib/chronology'
import { parseBookmarks } from '../../src/lib/persistence'
import type { EventIndex } from '../../src/lib/schema'
describe('release content and state', () => {
  it('builds the complete preview deterministically with working references', async () => {
    const a = await buildContent({ write: false }),
      b = await buildContent({ write: false })
    expect(a.manifest.recordCounts).toMatchObject({
      events: 150,
      entities: 25,
      periods: 15,
      journeys: 6,
      sources: 142,
      published: 0,
    })
    expect(a.manifest.contentVersion).toBe(b.manifest.contentVersion)
    expect(canonical(a.payloads)).toBe(canonical(b.payloads))
    expect(a.report.nonPoliticalPercent).toBeGreaterThanOrEqual(35)
    expect(Object.values(a.report.byRegion).every((n) => n > 0)).toBe(true)
    for (const p of a.manifest.packs)
      for (const file of p.artifacts) expect(a.manifest.artifacts[file]).toBeDefined()
    expect(canonical(a.payloads)).not.toMatch(/privateNotes|researchNotes|synthetic_fixture/)
  })
  it('ships only published records in production, with no preview records or their sources', async () => {
    const p = await buildContent({ write: false, mode: 'production' })
    expect(p.catalog.events).toEqual([])
    expect(p.catalog.entities).toEqual([])
    expect(p.manifest.recordCounts.sources).toBe(0)
    expect(canShip('drafted', 'preview')).toBe(false)
    expect(canShip('candidate', 'preview')).toBe(false)
    expect(canShip('evidence-checked', 'production')).toBe(false)
    expect(canShip('published', 'production')).toBe(true)
  })
  it('rejects duplicate keys, comments and dangling commas', () => {
    expect(() => strictJson('{"a":1,"a":2}')).toThrow(/Duplicate/)
    expect(() => strictJson('{"a":1,}')).toThrow()
    expect(() => strictJson('{/*private*/"a":1}')).toThrow()
    expect(canonical({ b: 1, a: undefined })).toBe('{"b":1}')
  })
  it('validates and round trips URL state without executing text', () => {
    const original = {
      ...DEFAULTS,
      regions: ['africa', 'south-asia'],
      themes: ['health', 'rights'],
      selected: 'evt_000005',
      view: 'compare' as const,
      q: '<script>test</script>',
    }
    const round = validateSearch(Object.fromEntries(new URLSearchParams(serializeState(original))))
    expect(round).toEqual(original)
    const bad = validateSearch({ from: '0 CE', to: '500 BCE', regions: ['invented'], v: 99 })
    expect(bad.from).toBe(DEFAULTS.from)
    expect(bad.regions).toEqual([])
    expect(bad.notice).toBeTruthy()
  })
  it('uses OR within groups and AND across groups, including period overlap', async () => {
    const { catalog } = await buildContent({ write: false })
    const events = filterEvents(catalog.events, {
      ...DEFAULTS,
      from: '300000BCE',
      to: '2026CE',
      regions: ['africa', 'oceania'],
      themes: ['society', 'rights'],
    })
    expect(events.length).toBeGreaterThan(0)
    expect(
      events.every(
        (e) =>
          ['africa', 'oceania'].includes(e.primaryRegion) &&
          e.themeIds.some((theme) => ['society', 'rights'].includes(theme)),
      ),
    ).toBe(true)
    expect(filterEvents(catalog.events, DEFAULTS).some((e) => e.id === 'evt_000004')).toBe(true)
    const q = filterEvents(
      catalog.events,
      { ...DEFAULTS, q: '1200 CE' },
      {} as Map<string, string>,
      { allTime: true },
    )
    expect(q.length).toBeGreaterThan(0)
  })
  it('keeps all 5,000 synthetic records accessible and clusters deterministically', async () => {
    const { catalog } = await buildContent({ write: false })
    const synthetic: EventIndex[] = Array.from({ length: 5000 }, (_, i) => ({
      ...catalog.events[i % catalog.events.length],
      id: 'synthetic_' + String(i).padStart(5, '0'),
    }))
    const t = performance.now()
    const all = filterEvents(synthetic, { ...DEFAULTS, from: '300000BCE', to: '2026CE' })
    const clusters = clusterEvents(
      all,
      ordinal(-299999),
      ordinal(2026),
      1000,
      'balanced',
      all[0].id,
    )
    expect(all).toHaveLength(5000)
    expect(clusters.flatMap((c) => c.events)).toHaveLength(5000)
    expect(clusters.find((c) => c.key === all[0].id)?.events).toHaveLength(1)
    expect(clusters).toEqual(
      clusterEvents(
        [...all].reverse(),
        ordinal(-299999),
        ordinal(2026),
        1000,
        'balanced',
        all[0].id,
      ),
    )
    expect(performance.now() - t).toBeLessThan(1000)
  })
  it('validates bookmark payloads, IDs, byte limits and schema', () => {
    const bookmark = {
      schemaVersion: 1,
      id: 'evt_000001',
      label: 'Caral',
      savedAt: '2026-09-26T12:00:00.000Z',
    }
    expect(
      parseBookmarks(
        JSON.stringify({ schemaVersion: 1, bookmarks: [bookmark] }),
        new Set([bookmark.id]),
      ),
    ).toHaveLength(1)
    expect(() =>
      parseBookmarks(JSON.stringify({ schemaVersion: 1, bookmarks: [bookmark] }), new Set()),
    ).toThrow(/Unknown/)
    expect(() => parseBookmarks('a'.repeat(500001), new Set())).toThrow(/500 KB/)
    expect(() => parseBookmarks('{"schemaVersion":2,"bookmarks":[]}', new Set())).toThrow()
  })
})
