import { readdir, readFile, mkdir, writeFile, lstat, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'
import { parseTree, type Node as JsonNode, type ParseError } from 'jsonc-parser'
import { z } from 'zod'
import {
  eventSchema,
  sourceSchema,
  periodSchema,
  entitySchema,
  journeySchema,
  relationSchema,
  placeSchema,
  coverageSchema,
  type Manifest,
  type Pack,
  type Catalog,
  type EventRecord,
  type EventIndex,
} from '../../src/lib/schema'
import { compileTime, timeLabel, ordinal, overlaps, CUTOFF } from '../../src/lib/chronology'
import { REGIONS, PRESETS } from '../../src/lib/taxonomy'

export function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']'
  if (value !== null && typeof value === 'object')
    return (
      '{' +
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b, 'en'))
        .map(([k, v]) => JSON.stringify(k) + ':' + canonical(v))
        .join(',') +
      '}'
    )
  return JSON.stringify(value)
}
export const hash = (s: string | Buffer) => createHash('sha256').update(s).digest('hex')
export function strictJson(raw: string) {
  const errors: ParseError[] = [],
    tree = parseTree(raw, errors, { allowTrailingComma: false, disallowComments: true })
  if (!tree || errors.length) throw new Error('Invalid JSON')
  function visit(n: JsonNode) {
    if (n.type === 'object') {
      const keys = (n.children || []).map((p) => p.children![0].value)
      if (new Set(keys).size !== keys.length) throw new Error('Duplicate JSON key')
    }
    n.children?.forEach(visit)
  }
  visit(tree)
  return JSON.parse(raw)
}
export function canShip(status: string, mode: string) {
  return (
    status === 'published' ||
    (mode === 'preview' && ['evidence-checked', 'reviewed'].includes(status))
  )
}
const schemas = {
  events: eventSchema,
  sources: sourceSchema,
  entities: entitySchema,
  periods: periodSchema,
  places: placeSchema,
  relations: relationSchema,
  journeys: journeySchema,
  coverage: coverageSchema,
}
async function files(path: string): Promise<string[]> {
  let names: string[]
  try {
    names = await readdir(path)
  } catch {
    return []
  }
  const all: string[] = []
  for (const name of names.sort()) {
    const p = join(path, name),
      stat = await lstat(p)
    if (stat.isSymbolicLink()) throw new Error('Symlinks are not allowed in content: ' + p)
    if (stat.isDirectory()) all.push(...(await files(p)))
    else if (!p.endsWith('.json')) throw new Error('Unexpected authoring file: ' + p)
    else all.push(p)
  }
  return all
}
async function readRecords<T>(kind: string, schema: z.ZodType<T>): Promise<T[]> {
  return Promise.all(
    (await files('content/' + kind)).map(async (path) => {
      const bytes = await readFile(path)
      if (bytes.length > 100_000) throw new Error('Oversized record ' + path)
      const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
      const result = schema.safeParse(strictJson(text))
      if (!result.success) throw new Error(path + ': ' + result.error.message)
      return result.data
    }),
  )
}
export async function buildContent(options: { mode?: string; write?: boolean } = {}) {
  const config = JSON.parse(await readFile('content/config.json', 'utf8'))
  const corrections = z
    .object({
      schemaVersion: z.literal(1),
      redirects: z.record(z.string().regex(/^evt_\d{6}$/), z.string().regex(/^evt_\d{6}$/)),
      withdrawals: z.record(z.string().regex(/^evt_\d{6}$/), z.string().min(10).max(2000)),
    })
    .parse(JSON.parse(await readFile('content/corrections.json', 'utf8')))
  const mode = options.mode || process.env.CONTENT_MODE || config.mode
  if (!['preview', 'production'].includes(mode))
    throw new Error('CONTENT_MODE must be preview or production')
  const [
    allEvents,
    allSources,
    allEntities,
    allPeriods,
    allPlaces,
    allRelations,
    allJourneys,
    coverage,
  ] = (await Promise.all(
    Object.entries(schemas).map(([k, s]) => readRecords(k, s as z.ZodType<any>)),
  )) as [
    EventRecord[],
    z.infer<typeof sourceSchema>[],
    z.infer<typeof entitySchema>[],
    z.infer<typeof periodSchema>[],
    z.infer<typeof placeSchema>[],
    z.infer<typeof relationSchema>[],
    z.infer<typeof journeySchema>[],
    z.infer<typeof coverageSchema>[],
  ]
  const everything = [
    ...allEvents,
    ...allSources,
    ...allEntities,
    ...allPeriods,
    ...allPlaces,
    ...allRelations,
    ...allJourneys,
    ...coverage,
  ]
  const byId = new Map(everything.map((r) => [r.id, r]))
  if (byId.size !== everything.length) throw new Error('Duplicate record ID')
  const requireRef = (id: string) => {
    if (!byId.has(id)) throw new Error('Missing reference ' + id)
  }
  for (const r of everything) {
    if ('citations' in r) {
      const citations = new Set(r.citations.map((c) => c.id))
      if (citations.size !== r.citations.length) throw new Error('Duplicate citation in ' + r.id)
      r.citations.forEach((c) => {
        requireRef(c.sourceId)
        if (!allSources.some((s) => s.id === c.sourceId)) throw new Error('Wrong source reference')
      })
      if ('claims' in r) {
        const claimIds = new Set(r.claims.map((c) => c.id))
        if (claimIds.size !== r.claims.length) throw new Error('Duplicate claim ID')
        r.claims.forEach((c) =>
          c.citationIds.forEach((id) => {
            if (!citations.has(id)) throw new Error('Unsupported claim ' + c.id)
          }),
        )
        const checkDate = (value: unknown) => {
          if (!value || typeof value !== 'object') return
          for (const [key, v] of Object.entries(value)) {
            if (key === 'dateClaimIds')
              (v as string[]).forEach((id) => {
                if (!claimIds.has(id)) throw new Error('Date claim missing ' + id)
              })
            else checkDate(v)
          }
        }
        if ('time' in r) checkDate(r.time)
        if ('existencePhases' in r) checkDate(r.existencePhases)
      }
    }
    if ('review' in r && r.review.status === 'published') {
      if (!r.review.checkedBy || !r.review.reviewedAt || r.review.unresolvedIssues.length)
        throw new Error('Publication provenance incomplete: ' + r.id)
      if ('tier' in r && r.tier === 'anchor') {
        const families = new Set(
          r.citations.map((c) => allSources.find((s) => s.id === c.sourceId)!.sourceFamily),
        )
        if (families.size < 2) throw new Error('Anchor requires independent corroboration: ' + r.id)
      }
    }
    if ('entityIds' in r) r.entityIds.forEach(requireRef)
    if ('placeIds' in r) r.placeIds.forEach(requireRef)
    if ('eventIds' in r) r.eventIds.forEach(requireRef)
    if ('entityId' in r && r.entityId) requireRef(r.entityId)
    if ('sourceRefs' in r) r.sourceRefs.forEach(requireRef)
    if ('steps' in r) r.steps.forEach((s) => requireRef(s.eventId))
    if ('fromId' in r) {
      requireRef(r.fromId)
      requireRef(r.toId)
    }
    if ('primaryRegion' in r && !r.regionIds.includes(r.primaryRegion))
      throw new Error('Primary region missing in ' + r.id)
    if ('time' in r) {
      const t = compileTime(r.time)
      if (
        (t.possibleStartDay !== null && t.possibleStartDay >= ordinal(2026)) ||
        (t.possibleEndDayExclusive !== null && t.possibleEndDayExclusive > ordinal(2026))
      )
        throw new Error('Record exceeds corpus cutoff: ' + r.id)
    }
  }
  const events = allEvents
    .filter((r) => canShip(r.review.status, mode))
    .sort((a, b) => a.id.localeCompare(b.id))
  const eventIds = new Set(events.map((e) => e.id))
  const entities = allEntities.filter((r) => canShip(r.review.status, mode)),
    periods = allPeriods.filter((r) => canShip(r.review.status, mode))
  const journeys = allJourneys.filter(
    (r) => canShip(r.review.status, mode) && r.steps.every((s) => eventIds.has(s.eventId)),
  )
  const visibleIds = new Set([...events, ...entities, ...periods, ...journeys].map((r) => r.id))
  const relations = allRelations.filter(
    (r) => canShip(r.review.status, mode) && visibleIds.has(r.fromId) && visibleIds.has(r.toId),
  )
  for (const event of events)
    event.entityIds.forEach((id) => {
      if (!visibleIds.has(id)) throw new Error('Published record refers to hidden entity ' + id)
    })
  for (const entity of entities)
    entity.eventIds.forEach((id) => {
      if (!eventIds.has(id)) throw new Error('Visible entity refers to hidden event ' + id)
    })
  for (const period of periods)
    if (period.entityId && !visibleIds.has(period.entityId))
      throw new Error('Visible period refers to hidden entity ' + period.entityId)
  const sourceIds = new Set(
    [...events, ...entities, ...periods, ...journeys, ...relations].flatMap((r) =>
      r.citations.map((c) => c.sourceId),
    ),
  )
  const sources = allSources.filter((r) => sourceIds.has(r.id))
  const places = allPlaces.filter((r) => events.some((e) => e.placeIds.includes(r.id)))
  for (const [old, target] of Object.entries(corrections.redirects)) {
    if (eventIds.has(old) || !eventIds.has(target) || old === target)
      throw new Error('Invalid event redirect ' + old)
  }
  for (const old of Object.keys(corrections.withdrawals)) {
    if (eventIds.has(old) || corrections.redirects[old])
      throw new Error('Withdrawal still visible or redirected ' + old)
  }
  const compilerFingerprint = hash(
    (
      await Promise.all(
        [
          'scripts/content/build.ts',
          'src/lib/chronology.ts',
          'src/lib/schema.ts',
          'src/lib/taxonomy.ts',
          'bun.lock',
        ].map((path) => readFile(path, 'utf8')),
      )
    ).join('\n'),
  )
  const buildCommit = process.env.BUILD_COMMIT || 'local-uncommitted'
  const inputs = canonical({
    compilerFingerprint,
    buildCommit,
    mode,
    events,
    entities,
    periods,
    journeys,
    relations,
    sources,
    places,
    coverage,
    corrections,
  })
  const contentVersion = 'v-' + hash(inputs).slice(0, 16)
  const base = '/data/' + contentVersion + '/'
  const payloads: Record<string, string> = {},
    recordToShard: Record<string, string> = {}
  const put = (name: string, value: unknown) => {
    payloads[name] = canonical(value)
  }
  const index: EventIndex[] = []
  for (let i = 0; i < events.length; i += 8) {
    const name = `details-${String(i / 8).padStart(3, '0')}.json`,
      chunk = events.slice(i, i + 8)
    put(name, Object.fromEntries(chunk.map((e) => [e.id, e])))
    chunk.forEach((e) => {
      recordToShard[e.id] = name
      const {
        id,
        title,
        kind,
        regionIds,
        primaryRegion,
        subregion,
        themeIds,
        tier,
        alternativeTitles,
        entityIds,
        summary,
      } = e
      index.push({
        id,
        title,
        kind,
        regionIds,
        primaryRegion,
        subregion,
        themeIds,
        tier,
        alternativeTitles,
        entityIds,
        summary,
        timeLabel: timeLabel(e.time),
        compiled: compileTime(e.time),
        shard: name,
      })
    })
  }
  for (const r of [...entities, ...journeys, ...sources]) {
    const name = r.id + '.json'
    put(name, r)
    recordToShard[r.id] = name
  }
  put('relations.json', relations)
  put('places.json', places)
  const catalog: Catalog = {
    events: index,
    periods: periods.map((p) => ({
      id: p.id,
      title: p.title,
      regionIds: p.regionIds,
      entityId: p.entityId,
      displayOrder: p.displayOrder,
      timeLabel: timeLabel(p.time),
      compiled: compileTime(p.time),
    })),
    entities: entities.map(({ id, title, regionIds, summary, aliases }) => ({
      id,
      title,
      regionIds,
      summary,
      aliases,
    })),
    journeys: journeys.map(({ id, title, summary, regionIds, startingViewport }) => ({
      id,
      title,
      summary,
      regionIds,
      startingViewport,
    })),
    coverage,
  }
  put('catalog.json', catalog)
  // Search contains place locators and entity aliases; prose stays in detail shards.
  put(
    'search.json',
    index.map((e) => ({
      id: e.id,
      text: [
        e.title,
        e.summary,
        ...e.alternativeTitles,
        ...e.regionIds,
        ...e.themeIds,
        ...e.entityIds.flatMap((id) => entities.find((e) => e.id === id)?.aliases || []),
        ...places
          .filter((p) => events.find((x) => x.id === e.id)!.placeIds.includes(p.id))
          .map((p) => p.modernLocator),
      ].join(' '),
    })),
  )
  const artifacts = Object.fromEntries(
    Object.entries(payloads).map(([name, bytes]) => [
      name,
      { url: base + name, bytes: Buffer.byteLength(bytes), sha256: hash(bytes) },
    ]),
  )
  const pack = (
    id: string,
    title: string,
    description: string,
    ids: string[],
    extra: string[] = [],
  ): Pack => {
    const selected = events.filter((e) => ids.includes(e.id)),
      ent = entities.filter((e) => selected.some((r) => r.entityIds.includes(e.id))),
      rel = relations.filter((r) => ids.includes(r.fromId) || ids.includes(r.toId))
    const citations = [
      ...selected,
      ...ent,
      ...rel,
      ...journeys.filter((j) => extra.includes(j.id + '.json')),
    ].flatMap((r) => r.citations.map((c) => c.sourceId + '.json'))
    // A shard can contain neighbours; include their citations too, so every available detail is complete.
    const details = [...new Set(selected.map((e) => recordToShard[e.id]))]
    const neighbours = events.filter((e) => details.includes(recordToShard[e.id]))
    const deps = [
      ...new Set([
        'catalog.json',
        'search.json',
        'relations.json',
        'places.json',
        ...details,
        ...neighbours.flatMap((e) => e.citations.map((c) => c.sourceId + '.json')),
        ...entities.map((e) => e.id + '.json'),
        ...entities.flatMap((e) => e.citations.map((c) => c.sourceId + '.json')),
        ...citations,
        ...extra,
      ]),
    ].filter((n) => artifacts[n])
    return {
      id,
      title,
      description,
      recordIds: ids,
      artifacts: deps,
      bytes: deps.reduce((n, key) => n + artifacts[key].bytes, 0),
    }
  }
  const starterIds = [
    ...new Set(
      [
        ...REGIONS.map((r) => events.find((e) => e.primaryRegion === r.id)?.id),
        ...events.slice(0, 16).map((e) => e.id),
      ].filter((id): id is string => !!id),
    ),
  ].slice(0, 16)
  const packs: Pack[] = [
    pack(
      'starter',
      'Starter atlas',
      'A first collection across all ten regions. Includes the overview, full search, selected details and their sources.',
      starterIds,
    ),
  ]
  for (const [id, title, from, to] of [
    ['early', 'Early worlds', -11999, 500],
    ['connected', 'Connected worlds', 500, 1500],
    ['modern', 'The modern world', 1500, 2026],
  ] as const)
    packs.push(
      pack(
        id,
        title,
        'Text, context and bibliographic sources for this era.',
        index.filter((e) => overlaps(e.compiled, ordinal(from), ordinal(to))).map((e) => e.id),
      ),
    )
  for (const j of journeys)
    packs.push(
      pack(
        j.id,
        j.title,
        'All steps, context and source metadata for this journey.',
        j.steps.map((s) => s.eventId),
        [j.id + '.json'],
      ),
    )
  packs.push({
    id: 'all',
    title: 'The complete text atlas',
    description:
      'Every event, entity, journey and source in this research preview. External source websites require internet.',
    recordIds: events.map((e) => e.id),
    artifacts: Object.keys(artifacts).sort(),
    bytes: Object.values(artifacts).reduce((n, a) => n + a.bytes, 0),
  })
  const manifest: Manifest = {
    schemaVersion: 1,
    minimumAppSchema: 1,
    contentVersion,
    corpusCutoff: CUTOFF,
    mode: mode as 'preview' | 'production',
    buildCommit,
    createdAt: '2026-09-26T00:00:00Z',
    deterministicBuildInputs: hash(inputs),
    recordCounts: {
      events: events.length,
      entities: entities.length,
      periods: periods.length,
      journeys: journeys.length,
      sources: sources.length,
      published: events.filter((e) => e.review.status === 'published').length,
    },
    artifacts,
    recordToShard,
    packs,
    redirects: corrections.redirects,
    withdrawals: corrections.withdrawals,
  }
  const statusCounts = Object.fromEntries(
    [...new Set(allEvents.map((e) => e.review.status))].map((status) => [
      status,
      allEvents.filter((e) => e.review.status === status).length,
    ]),
  )
  const bins = [
    [-300000, -9999, 'Before 10,000 BCE'],
    [-9999, -2999, '10,000–3000 BCE'],
    [-2999, -1199, '3000–1200 BCE'],
    [-1199, -499, '1200–500 BCE'],
    [-499, 500, '500 BCE–500 CE'],
    [500, 1000, '500–1000 CE'],
    [1000, 1450, '1000–1450 CE'],
    [1450, 1750, '1450–1750 CE'],
    [1750, 1914, '1750–1914 CE'],
    [1914, 1945, '1914–1945 CE'],
    [1945, 1991, '1945–1991 CE'],
    [1991, 2026, '1991–2025 CE'],
  ] as const
  const byWindow = Object.fromEntries(
    bins.map(([from, to, label]) => [
      label,
      index.filter(
        (e) =>
          e.compiled.anchorDay !== undefined &&
          e.compiled.anchorDay >= ordinal(from) &&
          e.compiled.anchorDay < ordinal(to),
      ).length,
    ]),
  )
  const report = {
    contentVersion,
    mode,
    counts: manifest.recordCounts,
    statusCounts,
    byWindow,
    byRegion: Object.fromEntries(
      REGIONS.map((r) => [r.name, events.filter((e) => e.primaryRegion === r.id).length]),
    ),
    nonPoliticalPercent: Math.round(
      (events.filter((e) => e.themeIds[0] !== 'politics').length / Math.max(events.length, 1)) *
        100,
    ),
    sourceFamilies: [...new Set(sources.map((s) => s.sourceFamily))],
    catalogGzipBytes: gzipSync(payloads['catalog.json']).length,
    searchGzipBytes: gzipSync(payloads['search.json']).length,
    maxDetailGzipBytes: Math.max(
      0,
      ...Object.entries(payloads)
        .filter(([n]) => n.startsWith('details-'))
        .map(([, v]) => gzipSync(v).length),
    ),
    allTextGzipBytes: Object.values(payloads).reduce((n, v) => n + gzipSync(v).length, 0),
    allTextBytes: packs.at(-1)!.bytes,
    warnings: [
      'Independent historical review is pending.',
      'Heritage institutions dominate ancient and medieval coverage; regional scholarship, women’s histories and everyday life need expansion.',
      'Short preview contexts are not full scholarly essays.',
    ],
    cutoff: CUTOFF,
  }
  if (options.write !== false) {
    await rm('public/data', { recursive: true, force: true })
    const out = 'public/data/' + contentVersion
    await mkdir(out, { recursive: true })
    await mkdir('src/generated', { recursive: true })
    await mkdir('docs/reports', { recursive: true })
    for (const [name, bytes] of Object.entries(payloads)) await writeFile(join(out, name), bytes)
    await writeFile(join(out, 'manifest.json'), canonical(manifest))
    const release = {
      schemaVersion: 1,
      contentVersion,
      manifestUrl: base + 'manifest.json',
      manifestSha256: hash(canonical(manifest)),
    }
    await writeFile('public/data/release.json', canonical(release))
    await writeFile('src/generated/release.json', canonical(release))
    const routes = [
      '/',
      '/timeline',
      '/search',
      '/bookmarks',
      '/downloads',
      '/about',
      ...events.map((e) => '/events/' + e.id),
      ...Object.keys(corrections.redirects).map((id) => '/events/' + id),
      ...Object.keys(corrections.withdrawals).map((id) => '/events/' + id),
      ...entities.map((e) => '/entities/' + e.id),
      ...journeys.map((e) => '/journeys/' + e.id),
      ...sources.map((s) => '/sources/' + s.id),
    ]
    await writeFile('src/generated/routes.json', JSON.stringify(routes))
    await writeFile('docs/reports/coverage.json', JSON.stringify(report, null, 2) + '\n')
    for (const [name, schema] of Object.entries(schemas)) {
      await mkdir('content/schemas', { recursive: true })
      await writeFile(
        `content/schemas/${name}.schema.json`,
        JSON.stringify(z.toJSONSchema(schema, { unrepresentable: 'any' }), null, 2) + '\n',
      )
    }
  }
  return { manifest, catalog, report, payloads }
}
if (import.meta.main) {
  try {
    const { report } = await buildContent({ write: !process.argv.includes('--validate') })
    console.log(JSON.stringify(report, null, 2))
  } catch (e) {
    console.error(String(e))
    process.exit(1)
  }
}
