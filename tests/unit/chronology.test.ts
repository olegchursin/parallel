import { describe, it, expect } from 'vitest'
import {
  compareTimes,
  bce,
  ordinal,
  civil,
  validDate,
  leapYear,
  formatYear,
  parseYear,
  compileTime,
  overlaps,
  overlapClass,
  project,
  unproject,
  ticks,
  type DateEstimate,
} from '../../src/lib/chronology'
const date = (y: number, extra: Partial<DateEstimate> = {}): DateEstimate => ({
  anchor: { year: y, precision: 'year' },
  label: formatYear(y),
  qualifier: 'exact',
  sourceCalendar: 'proleptic Gregorian',
  dateClaimIds: ['date'],
  ...extra,
})
describe('independent chronology boundary checks', () => {
  it('uses known epoch and leap-year distances without Date conversion', () => {
    expect(ordinal(1970, 1, 1)).toBe(0)
    expect(ordinal(2000, 1, 1)).toBe(10957)
    expect(ordinal(2000, 3, 1) - ordinal(2000, 2, 28)).toBe(2)
    expect(ordinal(1900, 3, 1) - ordinal(1900, 2, 28)).toBe(1)
    expect(ordinal(0, 3, 1) - ordinal(0, 2, 28)).toBe(2)
  })
  it('crosses BCE/CE without a display year zero', () => {
    expect(bce(1)).toBe(0)
    expect(ordinal(1) - ordinal(0)).toBe(366)
    expect(formatYear(0)).toBe('1 BCE')
    expect(parseYear('1 BCE')).toBe(0)
    expect(parseYear('0 CE')).toBeNull()
    expect(parseYear('-400')).toBeNull()
    expect(parseYear('AD 1200')).toBe(1200)
    expect(parseYear('400 BC')).toBe(-399)
    expect(ticks(ordinal(-4), ordinal(4), 1000).map((t) => t.label)).not.toContain('0 CE')
  })
  it('validates leap days, negative century years, precision, and deep time', () => {
    expect(leapYear(-400)).toBe(true)
    expect(leapYear(-100)).toBe(false)
    expect(validDate({ year: 1900, month: 2, day: 29, precision: 'day' })).toBe(false)
    expect(validDate({ year: -400, month: 2, day: 29, precision: 'day' })).toBe(true)
    expect(validDate({ year: 2000, day: 1, precision: 'day' })).toBe(false)
    expect(validDate({ year: -300001, precision: 'year' })).toBe(false)
  })
  it('round trips arbitrary ordinal days including negative eras', () => {
    for (let d = -110000000; d < 21000; d += 7811) {
      const c = civil(d)
      expect(ordinal(c.year, c.month, c.day)).toBe(d)
    }
  })
  it('retains an uncertainty interval as a point, not a duration', () => {
    const t = compileTime({
      type: 'point',
      when: date(1200, {
        qualifier: 'uncertain',
        earliest: { year: 1180, precision: 'year' },
        latest: { year: 1220, precision: 'year' },
      }),
    })
    expect(t.definiteStartDay).toBeUndefined()
    expect(overlapClass(t, ordinal(1200), ordinal(1201))).toBe('Possibly overlapping')
    expect(overlaps(t, ordinal(1221), ordinal(1222))).toBe(false)
  })
  it('includes the exact end day and excludes the next day', () => {
    const a = date(2000, { anchor: { year: 2000, month: 1, day: 1, precision: 'day' } }),
      b = date(2000, { anchor: { year: 2000, month: 1, day: 2, precision: 'day' } })
    const t = compileTime({ type: 'span', start: a, end: b })
    expect(overlapClass(t, ordinal(2000, 1, 1), ordinal(2000, 1, 2))).toBe('Same supported period')
    expect(overlaps(t, ordinal(2000, 1, 2), ordinal(2000, 1, 3))).toBe(true)
    expect(overlaps(t, ordinal(2000, 1, 3), ordinal(2000, 1, 4))).toBe(false)
  })
  it('keeps unknown and ongoing ends distinct', () => {
    const unknown = compileTime({ type: 'span', start: date(1900), end: { state: 'unknown' } }),
      ongoing = compileTime({ type: 'span', start: date(1900), end: { state: 'ongoing' } })
    expect(unknown.possibleEndDayExclusive).toBeNull()
    expect(overlaps(unknown, ordinal(2000), ordinal(2001))).toBe(false)
    expect(overlaps(ongoing, ordinal(2025), ordinal(2026))).toBe(true)
    expect(overlaps(ongoing, ordinal(2026), ordinal(2027))).toBe(false)
  })
  it('does not bridge separate alternative chronologies', () => {
    const t = compileTime({
      type: 'point',
      when: date(1000),
      alternatives: [{ label: 'Later proposal', start: date(1100) }],
    })
    expect(overlaps(t, ordinal(1050), ordinal(1051))).toBe(false)
    expect(overlaps(t, ordinal(1100), ordinal(1101))).toBe(true)
    expect(overlapClass(t, ordinal(1100), ordinal(1101))).toBe('Possibly overlapping')
  })
  it('rejects uncalibrated dates and reversed intervals', () => {
    expect(() =>
      compileTime({
        type: 'point',
        when: date(-10000),
        scientificDating: {
          convention: 'uncalibrated-BP',
          expression: '12000 BP',
          referenceYear: 1950,
          methodNote: 'uncalibrated',
        },
      }),
    ).toThrow(/Uncalibrated/)
    expect(() => compileTime({ type: 'span', start: date(2000), end: date(1900) })).toThrow(
      /Reversed/,
    )
  })
  it('projects all regions through one reversible linear transform', () => {
    const start = ordinal(-299999),
      end = ordinal(2026)
    for (const day of [start, ordinal(-12000), ordinal(0), ordinal(1200), end])
      expect(unproject(project(day, start, end, 877), start, end, 877)).toBeCloseTo(day, 6)
  })
})

it('does not overstate comparison with an uncertain selected point', () => {
  const uncertain = compileTime({
    type: 'point',
    when: date(1200, {
      qualifier: 'uncertain',
      earliest: { year: 1100, precision: 'year' },
      latest: { year: 1300, precision: 'year' },
    }),
  })
  const exact = compileTime({ type: 'point', when: date(1200) })
  expect(compareTimes(uncertain, exact)).toBe('Possibly overlapping')
})
