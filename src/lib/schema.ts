import { z } from 'zod'
import { compileTime, validDate, type TimeSpec, type CompiledTime } from './chronology'
import { REGIONS, THEMES } from './taxonomy'
const id = (prefix: string) => z.string().regex(new RegExp(`^${prefix}_\\d{6}$`))
const safeUrl = z.url().refine((s) => /^https?:\/\//.test(s), 'Only HTTP(S) source URLs')
const historicalDate = z
  .object({
    year: z.number().int(),
    month: z.number().int().optional(),
    day: z.number().int().optional(),
    precision: z.enum(['day', 'month', 'year']),
  })
  .refine(validDate, 'Invalid historical date')
const estimate = z.object({
  label: z.string().min(1),
  anchor: historicalDate.optional(),
  earliest: historicalDate.optional(),
  latest: historicalDate.optional(),
  qualifier: z.enum(['exact', 'approximate', 'uncertain', 'approximate-uncertain']),
  sourceCalendar: z.string(),
  originalExpression: z.string().optional(),
  conversionNote: z.string().optional(),
  dateClaimIds: z.array(z.string()).min(1),
})
export const timeSchema = z
  .intersection(
    z.discriminatedUnion('type', [
      z.object({ type: z.literal('point'), when: estimate }),
      z.object({
        type: z.literal('span'),
        start: estimate,
        end: z.union([estimate, z.object({ state: z.enum(['ongoing', 'unknown']) })]),
      }),
      z.object({ type: z.literal('undated'), explanation: z.string().min(1) }),
    ]),
    z.object({
      alternatives: z
        .array(z.object({ label: z.string(), start: estimate, end: estimate.optional() }))
        .optional(),
      scientificDating: z
        .object({
          convention: z.enum(['years-ago', 'cal-BP', 'uncalibrated-BP']),
          expression: z.string(),
          referenceYear: z.number(),
          methodNote: z.string(),
        })
        .optional(),
    }),
  )
  .superRefine((t, ctx) => {
    try {
      compileTime(t as TimeSpec)
    } catch (e) {
      ctx.addIssue({ code: 'custom', message: String(e) })
    }
  })
export const reviewSchema = z.object({
  status: z.enum([
    'candidate',
    'researching',
    'drafted',
    'evidence-checked',
    'reviewed',
    'published',
    'withdrawn',
  ]),
  authoredBy: z.string(),
  checkedBy: z.string().nullable(),
  reviewedAt: z.string().nullable(),
  revision: z.number().int().positive(),
  unresolvedIssues: z.array(z.string()),
  corroboration: z.string(),
})
export const citationSchema = z.object({
  id: z.string(),
  sourceId: id('src'),
  locator: z.string().min(1),
  supportRole: z.enum(['supports', 'qualifies', 'challenges']),
  note: z.string().min(1),
})
export const claimSchema = z.object({
  id: z.string(),
  text: z.string().min(1),
  claimType: z.enum([
    'occurrence',
    'date',
    'location',
    'significance',
    'terminology',
    'interpretation',
    'relationship',
  ]),
  citationIds: z.array(z.string()).min(1),
})
const base = {
  schemaVersion: z.literal(1),
  id: z.string(),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string(),
  summary: z.string().min(20),
  regionIds: z.array(z.string().refine((s) => REGIONS.some((r) => r.id === s))).min(1),
  claims: z.array(claimSchema).min(1),
  citations: z.array(citationSchema).min(1),
  review: reviewSchema,
}
export const eventSchema = z.object({
  ...base,
  id: id('evt'),
  kind: z.enum(['event', 'process']),
  time: timeSchema,
  primaryRegion: z.string(),
  subregion: z.string(),
  themeIds: z.array(z.string().refine((s) => THEMES.some((t) => t.id === s))).min(1),
  tier: z.enum(['anchor', 'major', 'contextual']),
  context: z.string().min(20),
  dateNote: z.string(),
  entityIds: z.array(id('ent')),
  placeIds: z.array(id('plc')),
  alternativeTitles: z.array(z.string()),
  anchorRationale: z.string().optional(),
})
export const sourceSchema = z.object({
  schemaVersion: z.literal(1),
  id: id('src'),
  title: z.string(),
  creator: z.string(),
  publisher: z.string(),
  sourceType: z.enum(['institutional', 'archive', 'scholarly', 'museum']),
  publicationDate: z.string(),
  url: safeUrl,
  accessedAt: z.string(),
  sourceFamily: z.string(),
  language: z.string(),
  rights: z.string(),
  inspectionNote: z.string(),
})
export const entitySchema = z.object({
  ...base,
  id: id('ent'),
  kind: z.literal('entity'),
  preferredName: z.string(),
  entityType: z.enum(['polity', 'culture', 'institution', 'network', 'community']),
  aliases: z.array(z.string()),
  existencePhases: z.array(z.object({ label: z.string(), time: timeSchema })).min(1),
  eventIds: z.array(id('evt')),
})
export const periodSchema = z.object({
  ...base,
  id: id('per'),
  kind: z.literal('period'),
  time: timeSchema,
  periodType: z.enum(['archaeological', 'political', 'cultural', 'process']),
  entityId: id('ent').optional(),
  displayOrder: z.number(),
})
export const placeSchema = z.object({
  schemaVersion: z.literal(1),
  id: id('plc'),
  preferredName: z.string(),
  placeType: z.literal('historical-place'),
  regionIds: z.array(z.string()),
  sourceRefs: z.array(id('src')).min(1),
  modernLocator: z.string(),
})
export const relationSchema = z.object({
  schemaVersion: z.literal(1),
  id: id('rel'),
  fromId: z.string(),
  toId: z.string(),
  relationType: z.enum([
    'part_of',
    'succeeded_by',
    'exchanged_with',
    'transmitted_to',
    'contributed_to',
    'responded_to',
    'compared_with',
  ]),
  direction: z.enum(['directed', 'symmetric']),
  claim: z.string(),
  citations: z.array(citationSchema).min(1),
  review: reviewSchema,
})
export const journeySchema = z.object({
  ...base,
  id: id('jrn'),
  kind: z.literal('journey'),
  introduction: z.string(),
  learningGoal: z.string(),
  steps: z
    .array(z.object({ eventId: id('evt'), heading: z.string(), note: z.string() }))
    .min(6)
    .max(10),
  evidenceNote: z.string(),
  startingViewport: z.object({ from: z.string(), to: z.string() }),
})
export const coverageSchema = z.object({
  schemaVersion: z.literal(1),
  id: id('cov'),
  scope: z.string(),
  limitation: z.string(),
  status: z.literal('research-preview'),
  reviewedAt: z.string().nullable(),
  missingTopics: z.array(z.string()),
})
export type EventRecord = z.infer<typeof eventSchema>
export type SourceRecord = z.infer<typeof sourceSchema>
export type EntityRecord = z.infer<typeof entitySchema>
export type PeriodRecord = z.infer<typeof periodSchema>
export type JourneyRecord = z.infer<typeof journeySchema>
export type RelationRecord = z.infer<typeof relationSchema>
export type PlaceRecord = z.infer<typeof placeSchema>
export type EventIndex = Pick<
  EventRecord,
  | 'id'
  | 'title'
  | 'kind'
  | 'regionIds'
  | 'primaryRegion'
  | 'subregion'
  | 'themeIds'
  | 'tier'
  | 'alternativeTitles'
  | 'entityIds'
  | 'summary'
> & { timeLabel: string; compiled: CompiledTime; shard: string }
export type PeriodIndex = Pick<
  PeriodRecord,
  'id' | 'title' | 'regionIds' | 'entityId' | 'displayOrder'
> & { timeLabel: string; compiled: CompiledTime }
export type Pack = {
  id: string
  title: string
  description: string
  artifacts: string[]
  recordIds: string[]
  bytes: number
}
export type Manifest = {
  schemaVersion: 1
  minimumAppSchema: 1
  contentVersion: string
  corpusCutoff: string
  mode: 'preview' | 'production'
  buildCommit: string
  createdAt: string
  deterministicBuildInputs: string
  recordCounts: Record<string, number>
  artifacts: Record<string, { url: string; bytes: number; sha256: string }>
  recordToShard: Record<string, string>
  packs: Pack[]
  redirects: Record<string, string>
  withdrawals: Record<string, string>
}
export type Catalog = {
  events: EventIndex[]
  periods: PeriodIndex[]
  entities: Pick<EntityRecord, 'id' | 'title' | 'regionIds' | 'summary' | 'aliases'>[]
  journeys: Pick<JourneyRecord, 'id' | 'title' | 'summary' | 'regionIds' | 'startingViewport'>[]
  coverage: z.infer<typeof coverageSchema>[]
}
