import { describe, expect, it } from 'vitest'
import {
  buildTimeline,
  daysInYear,
  yearOf,
  type TimelinePostInput,
  type TimelineTripInput,
} from './timeline'

function trip(overrides: Partial<TimelineTripInput> & { id: string }): TimelineTripInput {
  return {
    title: 'A trip',
    slug: 'a-trip',
    summary: '',
    startDate: null,
    endDate: null,
    status: 'completed',
    countryCodes: [],
    photoCount: 0,
    ...overrides,
  }
}

function post(overrides: Partial<TimelinePostInput> & { id: string }): TimelinePostInput {
  return {
    title: 'A post',
    slug: 'a-post',
    publishedAt: null,
    readingMinutes: 4,
    ...overrides,
  }
}

describe('yearOf', () => {
  it('reads the year off an ISO date or timestamp', () => {
    expect(yearOf('2025-04-01')).toBe(2025)
    expect(yearOf('2025-04-01T09:30:00Z')).toBe(2025)
  })

  it('has no year for a missing date', () => {
    expect(yearOf(null)).toBeNull()
  })
})

describe('daysInYear', () => {
  it('counts both ends, the way people count holidays', () => {
    expect(daysInYear('2025-04-01', '2025-04-06', 2025)).toBe(6)
  })

  it('counts a single-day trip as one day', () => {
    expect(daysInYear('2025-04-01', '2025-04-01', 2025)).toBe(1)
    expect(daysInYear('2025-04-01', null, 2025)).toBe(1)
  })

  it('splits a New Year crossing across both years', () => {
    // 28 Dec to 4 Jan is eight days: four in each year, not eight in one.
    expect(daysInYear('2024-12-28', '2025-01-04', 2024)).toBe(4)
    expect(daysInYear('2024-12-28', '2025-01-04', 2025)).toBe(4)
  })

  it('gives a year nothing when the trip missed it', () => {
    expect(daysInYear('2025-04-01', '2025-04-06', 2024)).toBe(0)
  })

  it('counts a whole year for a trip that spans one', () => {
    expect(daysInYear('2023-06-01', '2025-06-01', 2024)).toBe(366)
  })

  it('refuses nonsense rather than returning a negative count', () => {
    expect(daysInYear('2025-04-06', '2025-04-01', 2025)).toBe(0)
    expect(daysInYear(null, '2025-04-06', 2025)).toBe(0)
    expect(daysInYear('not-a-date', null, 2025)).toBe(0)
  })
})

describe('buildTimeline', () => {
  const firstVisits = new Map([
    ['JPN', 2025],
    ['NPL', 2022],
  ])

  it('groups by year, newest first', () => {
    const sections = buildTimeline(
      [
        trip({ id: 'a', startDate: '2023-02-11', endDate: '2023-02-18' }),
        trip({ id: 'b', startDate: '2025-04-01', endDate: '2025-04-14' }),
      ],
      [],
      firstVisits
    )
    expect(sections.map((s) => s.year)).toEqual([2025, 2023])
  })

  it('lists a trip in the year it began, even when it ended in the next', () => {
    const sections = buildTimeline(
      [trip({ id: 'a', startDate: '2024-12-28', endDate: '2025-01-04' })],
      [],
      firstVisits
    )
    expect(sections.map((s) => s.year)).toEqual([2025, 2024])
    expect(sections.find((s) => s.year === 2024)?.tripCount).toBe(1)
    // The later year has the days but not the entry — it is one trip, listed once.
    expect(sections.find((s) => s.year === 2025)?.tripCount).toBe(0)
    expect(sections.find((s) => s.year === 2025)?.daysAway).toBe(4)
    expect(sections.find((s) => s.year === 2024)?.daysAway).toBe(4)
  })

  it('sums days away across every completed trip in the year', () => {
    const sections = buildTimeline(
      [
        trip({ id: 'a', startDate: '2025-04-01', endDate: '2025-04-06' }),
        trip({ id: 'b', startDate: '2025-09-10', endDate: '2025-09-12' }),
      ],
      [],
      firstVisits
    )
    expect(sections[0].daysAway).toBe(9)
  })

  it('keeps booked days apart from days actually spent away', () => {
    // A year holding a finished trip and a booked one must not add them up:
    // "34 days away" would be a claim about November that has not happened.
    const sections = buildTimeline(
      [
        trip({ id: 'done', startDate: '2026-05-08', endDate: '2026-05-22', status: 'completed' }),
        trip({ id: 'booked', startDate: '2026-11-02', endDate: '2026-11-12', status: 'planning' }),
      ],
      [],
      firstVisits
    )
    expect(sections[0].daysAway).toBe(15)
    expect(sections[0].scheduledDaysAway).toBe(11)
    // Both are still listed: the timeline shows what is ahead as well as behind.
    expect(sections[0].tripCount).toBe(2)
  })

  it('counts an ongoing trip as time actually away', () => {
    const sections = buildTimeline(
      [trip({ id: 'now', startDate: '2026-08-08', endDate: '2026-08-15', status: 'ongoing' })],
      [],
      firstVisits
    )
    expect(sections[0].daysAway).toBe(8)
    expect(sections[0].scheduledDaysAway).toBe(0)
  })

  it('names only the countries that were new that year', () => {
    const sections = buildTimeline(
      [trip({ id: 'a', startDate: '2025-04-01', countryCodes: ['JPN', 'NPL'] })],
      [],
      firstVisits
    )
    expect(sections[0].countryCodes).toEqual(['JPN', 'NPL'])
    // Nepal was first reached in 2022, so 2025 is a return, not a new country.
    expect(sections[0].newCountryCodes).toEqual(['JPN'])
  })

  it('interleaves posts with trips, newest first', () => {
    const sections = buildTimeline(
      [trip({ id: 'a', startDate: '2025-04-01' })],
      [post({ id: 'p', publishedAt: '2025-05-13T00:00:00Z' })],
      firstVisits
    )
    expect(sections[0].entries.map((e) => e.kind)).toEqual(['post', 'trip'])
  })

  it('leaves out a post that was never published', () => {
    const sections = buildTimeline([], [post({ id: 'p', publishedAt: null })], firstVisits)
    expect(sections).toEqual([])
  })

  it('keeps undated trips in a trailing section rather than dropping them', () => {
    const sections = buildTimeline(
      [trip({ id: 'a', startDate: '2025-04-01' }), trip({ id: 'draft', startDate: null })],
      [],
      firstVisits
    )
    expect(sections.map((s) => s.year)).toEqual([2025, null])
    const undated = sections[1]
    expect(undated.entries).toHaveLength(1)
    // Nothing can be claimed about a trip with no dates, so nothing is.
    expect(undated.daysAway).toBe(0)
    expect(undated.newCountryCodes).toEqual([])
    expect(undated.entries[0].kind === 'trip' && undated.entries[0].days).toBeNull()
  })

  it('has no sections at all for someone with nothing logged', () => {
    expect(buildTimeline([], [], new Map())).toEqual([])
  })
})
