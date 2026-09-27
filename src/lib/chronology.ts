/** Proleptic Gregorian ordinal days, origin 1970-01-01 = 0.
 * Civil conversion follows Howard Hinnant's era/400-year decomposition.
 * Astronomical year 0 is 1 BCE. JS Date is never used for historical dates.
 */
export type HistoricalDate = {
  year: number
  month?: number
  day?: number
  precision: 'day' | 'month' | 'year'
}
export type DateEstimate = {
  label: string
  anchor?: HistoricalDate
  earliest?: HistoricalDate
  latest?: HistoricalDate
  qualifier: 'exact' | 'approximate' | 'uncertain' | 'approximate-uncertain'
  sourceCalendar: string
  originalExpression?: string
  conversionNote?: string
  dateClaimIds: string[]
}
export type TimeSpec = (
  | { type: 'point'; when: DateEstimate }
  | { type: 'span'; start: DateEstimate; end: DateEstimate | { state: 'ongoing' | 'unknown' } }
  | { type: 'undated'; explanation: string }
) & {
  alternatives?: { label: string; start: DateEstimate; end?: DateEstimate }[]
  scientificDating?: {
    convention: 'years-ago' | 'cal-BP' | 'uncalibrated-BP'
    expression: string
    referenceYear: number
    methodNote: string
  }
}
export type CompiledTime = {
  possibleStartDay: number | null
  possibleEndDayExclusive: number | null
  definiteStartDay?: number
  definiteEndDayExclusive?: number
  anchorDay?: number
  isApproximate: boolean
  isOpenEnded: boolean
  isUnknownEnd: boolean
  alternatives?: CompiledTime[]
}
export const CUTOFF = '2025-12-31'
export const MIN_YEAR = -300000
export const MAX_YEAR = 2026
export const bce = (year: number) => 1 - year
export const leapYear = (year: number) => year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
export function daysInMonth(year: number, month: number) {
  return [31, leapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] || 0
}
export function validDate(d: HistoricalDate): boolean {
  return (
    Number.isInteger(d.year) &&
    d.year >= MIN_YEAR &&
    d.year <= MAX_YEAR &&
    (d.month === undefined || (Number.isInteger(d.month) && d.month >= 1 && d.month <= 12)) &&
    (d.day === undefined ||
      (d.month !== undefined &&
        Number.isInteger(d.day) &&
        d.day >= 1 &&
        d.day <= daysInMonth(d.year, d.month))) &&
    (d.precision !== 'day' || d.day !== undefined) &&
    (d.precision !== 'month' || d.month !== undefined) &&
    (d.precision !== 'year' || (d.month === undefined && d.day === undefined)) &&
    (d.precision !== 'month' || d.day === undefined)
  )
}
export function ordinal(year: number, month = 1, day = 1): number {
  const y = year - (month <= 2 ? 1 : 0)
  const era = Math.floor(y / 400),
    yoe = y - era * 400
  const doy = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1
  return era * 146097 + yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy - 719468
}
export function civil(day: number): HistoricalDate {
  const z = Math.floor(day) + 719468,
    era = Math.floor(z / 146097),
    doe = z - era * 146097
  const yoe = Math.floor(
    (doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365,
  )
  let year = yoe + era * 400
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100)),
    mp = Math.floor((5 * doy + 2) / 153)
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1,
    month = mp + (mp < 10 ? 3 : -9)
  year += month <= 2 ? 1 : 0
  return { year, month, day: d, precision: 'day' }
}
export function dateBounds(d: HistoricalDate): [number, number] {
  if (!validDate(d)) throw new Error('Invalid historical date')
  const start = ordinal(d.year, d.month, d.day)
  return [
    start,
    d.precision === 'day'
      ? start + 1
      : d.precision === 'year'
        ? ordinal(d.year + 1)
        : d.month === 12
          ? ordinal(d.year + 1)
          : ordinal(d.year, d.month! + 1),
  ]
}
export function estimateBounds(d: DateEstimate): [number, number] {
  const first = d.earliest || d.anchor,
    last = d.latest || d.anchor
  if (!first || !last) throw new Error('Date requires an anchor or both bounds')
  const lower = dateBounds(first)[0],
    upper = dateBounds(last)[1]
  if (upper <= lower) throw new Error('Reversed date estimate')
  if (d.anchor) {
    const [a, b] = dateBounds(d.anchor)
    if (b <= lower || a >= upper) throw new Error('Anchor outside evidence bounds')
  }
  return [lower, upper]
}
function compileSingle(time: TimeSpec): CompiledTime {
  const empty: CompiledTime = {
    possibleStartDay: null,
    possibleEndDayExclusive: null,
    isApproximate: false,
    isOpenEnded: false,
    isUnknownEnd: false,
  }
  if (time.type === 'undated') return empty
  if (time.scientificDating?.convention === 'uncalibrated-BP')
    throw new Error('Uncalibrated BP cannot be placed without a reviewed conversion')
  const start = time.type === 'point' ? time.when : time.start
  const [lo, hi] = estimateBounds(start)
  const anchor = start.anchor ? dateBounds(start.anchor) : [lo, hi]
  const out = {
    ...empty,
    possibleStartDay: lo,
    anchorDay: (anchor[0] + anchor[1]) / 2,
    isApproximate: start.qualifier !== 'exact',
  }
  if (time.type === 'point')
    return {
      ...out,
      possibleEndDayExclusive: hi,
      ...(start.qualifier === 'exact' && !start.earliest && !start.latest
        ? { definiteStartDay: lo, definiteEndDayExclusive: hi }
        : {}),
    }
  if ('state' in time.end) {
    if (time.end.state === 'unknown') return { ...out, isUnknownEnd: true }
    if (lo >= ordinal(2026)) throw new Error('Ongoing record starts after cutoff')
    return {
      ...out,
      possibleEndDayExclusive: ordinal(2026),
      isOpenEnded: true,
      definiteStartDay: start.qualifier === 'exact' ? lo : hi,
      definiteEndDayExclusive: ordinal(2026),
    }
  }
  const [endLo, endHi] = estimateBounds(time.end)
  if (endHi <= lo) throw new Error('Reversed historical duration')
  return {
    ...out,
    possibleEndDayExclusive: endHi,
    isApproximate: out.isApproximate || time.end.qualifier !== 'exact',
    ...((start.qualifier === 'exact' ? lo : hi) < (time.end.qualifier === 'exact' ? endHi : endLo)
      ? {
          definiteStartDay: start.qualifier === 'exact' ? lo : hi,
          definiteEndDayExclusive: time.end.qualifier === 'exact' ? endHi : endLo,
        }
      : {}),
  }
}
export function compileTime(time: TimeSpec): CompiledTime {
  const primary = compileSingle(time)
  if (!time.alternatives?.length) return primary
  const choices = [
    primary,
    ...time.alternatives.map((a) =>
      compileSingle(
        a.end ? { type: 'span', start: a.start, end: a.end } : { type: 'point', when: a.start },
      ),
    ),
  ]
  const dated = choices.filter((c) => c.possibleStartDay !== null)
  if (dated.length !== choices.length)
    throw new Error('Alternative chronologies require dated choices')
  const definiteStart = Math.max(...choices.map((c) => c.definiteStartDay ?? Infinity))
  const definiteEnd = Math.min(...choices.map((c) => c.definiteEndDayExclusive ?? -Infinity))
  return {
    ...primary,
    possibleStartDay: Math.min(...dated.map((c) => c.possibleStartDay!)),
    possibleEndDayExclusive: choices.some((c) => c.isUnknownEnd)
      ? null
      : Math.max(...dated.map((c) => c.possibleEndDayExclusive!)),
    definiteStartDay: definiteStart < definiteEnd ? definiteStart : undefined,
    definiteEndDayExclusive: definiteStart < definiteEnd ? definiteEnd : undefined,
    isApproximate: true,
    alternatives: choices,
  }
}
export const formatYear = (year: number) =>
  `${(year <= 0 ? 1 - year : year).toLocaleString('en-US')} ${year <= 0 ? 'BCE' : 'CE'}`
export const yearToken = (year: number) =>
  `${year <= 0 ? 1 - year : year}${year <= 0 ? 'BCE' : 'CE'}`
export function parseYear(input: string): number | null {
  const s = input.trim().replace(/,/g, '')
  const match = /^(\d{1,6})\s*(BCE|BC|CE|AD)$/i.exec(s)
  if (!match && !/^(AD|CE)\s*(\d{1,6})$/i.test(s)) return null
  // Also accept leading AD/CE without interpreting a bare signed number.
  let n: number, era: string
  const leading = /^(AD|CE)\s*(\d{1,6})$/i.exec(s)
  if (leading) {
    n = Number(leading[2])
    era = leading[1]
  } else {
    n = Number(match![1])
    era = match![2]
  }
  if (n < 1) return null
  const y = /^B/i.test(era) ? bce(n) : n
  return y >= MIN_YEAR && y <= MAX_YEAR ? y : null
}
export function timeLabel(t: TimeSpec): string {
  if (t.type === 'undated') return 'Undated'
  if (t.type === 'point') return t.when.label
  return `${t.start.label} – ${'state' in t.end ? (t.end.state === 'ongoing' ? 'ongoing (as of 2025)' : 'end unknown') : t.end.label}`
}
export const overlaps = (t: CompiledTime, start: number, end: number): boolean =>
  t.alternatives
    ? t.alternatives.some((c) => overlaps(c, start, end))
    : t.possibleStartDay !== null &&
      (t.isUnknownEnd
        ? t.anchorDay! >= start && t.anchorDay! < end
        : t.possibleEndDayExclusive !== null &&
          t.possibleStartDay < end &&
          t.possibleEndDayExclusive > start)
export function overlapClass(
  t: CompiledTime,
  start: number,
  end: number,
): 'Same supported period' | 'Possibly overlapping' | 'Nearby in time' {
  if (!overlaps(t, start, end)) return 'Nearby in time'
  if (
    !t.isUnknownEnd &&
    t.definiteStartDay !== undefined &&
    t.definiteEndDayExclusive !== undefined &&
    t.definiteStartDay < end &&
    t.definiteEndDayExclusive > start
  )
    return 'Same supported period'
  return 'Possibly overlapping'
}
export function compareTimes(
  a: CompiledTime,
  b: CompiledTime,
): 'Same supported period' | 'Possibly overlapping' | 'Nearby in time' {
  const possible = (a.alternatives || [a]).some((x) =>
    (b.alternatives || [b]).some(
      (y) =>
        y.possibleStartDay !== null &&
        y.possibleEndDayExclusive !== null &&
        overlaps(x, y.possibleStartDay, y.possibleEndDayExclusive),
    ),
  )
  if (!possible) return 'Nearby in time'
  if (
    !a.isUnknownEnd &&
    !b.isUnknownEnd &&
    a.definiteStartDay !== undefined &&
    a.definiteEndDayExclusive !== undefined &&
    b.definiteStartDay !== undefined &&
    b.definiteEndDayExclusive !== undefined &&
    a.definiteStartDay < b.definiteEndDayExclusive &&
    b.definiteStartDay < a.definiteEndDayExclusive
  )
    return 'Same supported period'
  return 'Possibly overlapping'
}
export const project = (day: number, start: number, end: number, width: number) =>
  ((day - start) / (end - start)) * width
export const unproject = (x: number, start: number, end: number, width: number) =>
  start + (x / width) * (end - start)
export function clampWindow(start: number, end: number): [number, number] {
  const min = ordinal(MIN_YEAR),
    max = ordinal(MAX_YEAR),
    span = Math.max(1, Math.min(max - min, end - start))
  const lower = Math.max(min, Math.min(max - span, start))
  return [lower, lower + span]
}
export function ticks(start: number, end: number, width: number) {
  const years = (end - start) / 365.2425,
    ladder = [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 5000, 10000, 25000, 50000, 100000]
  const step = ladder.find((n) => years / n <= width / 95) || 100000
  const first = Math.ceil(civil(start).year / step) * step
  const values: { day: number; label: string }[] = []
  for (let y = first; ordinal(y) < end; y += step)
    if (ordinal(y) >= start) values.push({ day: ordinal(y), label: formatYear(y) })
  if (years < 2) {
    values.length = 0
    let d = civil(start)
    for (let i = 0; i < 26; i++) {
      const at = ordinal(d.year, d.month)
      if (at >= end) break
      if (at >= start)
        values.push({
          day: at,
          label: `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.month! - 1]} ${formatYear(d.year)}`,
        })
      d =
        d.month === 12
          ? { year: d.year + 1, month: 1, precision: 'month' }
          : { ...d, month: d.month! + 1 }
    }
  }
  return values
}
