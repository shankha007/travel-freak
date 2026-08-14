import { describe, expect, it } from 'vitest'
import {
  budgetByCurrency,
  byTripType,
  favouriteDestinations,
  perYear,
  travelDaysOfYear,
  tripLengths,
  yearsWithTravel,
  type AnalyticsTrip,
} from './analytics'

function trip(over: Partial<AnalyticsTrip> = {}): AnalyticsTrip {
  return {
    id: over.id ?? Math.random().toString(36).slice(2),
    title: 'A trip',
    slug: 'a-trip',
    startDate: null,
    endDate: null,
    status: 'completed',
    tripType: null,
    budgetPlanned: null,
    currency: 'INR',
    countryCodes: [],
    ...over,
  }
}

describe('perYear', () => {
  it('has nothing to say about trips with no dates', () => {
    expect(perYear([trip(), trip()])).toEqual([])
  })

  it('fills the empty years between the first trip and the last', () => {
    const rows = perYear([
      trip({ startDate: '2019-05-01', endDate: '2019-05-10' }),
      trip({ startDate: '2022-05-01', endDate: '2022-05-10' }),
    ])

    // Without the gap years the chart puts 2019 next to 2022 and shows someone
    // who travels every year.
    expect(rows.map((r) => r.year)).toEqual([2019, 2020, 2021, 2022])
    expect(rows[1]).toMatchObject({ year: 2020, trips: 0, days: 0 })
  })

  it('splits a New Year crossing across both years', () => {
    const rows = perYear([trip({ startDate: '2024-12-28', endDate: '2025-01-04' })])
    expect(rows.find((r) => r.year === 2024)?.days).toBe(4)
    expect(rows.find((r) => r.year === 2025)?.days).toBe(4)
  })

  it('keeps travel booked apart from travel taken', () => {
    const rows = perYear([
      trip({ startDate: '2026-03-01', endDate: '2026-03-05', status: 'completed' }),
      trip({ startDate: '2026-11-01', endDate: '2026-11-10', status: 'upcoming' }),
    ])

    expect(rows[0].days).toBe(5)
    expect(rows[0].scheduledDays).toBe(10)
    // Both are trips of that year; only one is a fact about a life lived.
    expect(rows[0].trips).toBe(2)
  })

  it('counts a country as new in the year it was first reached, not first planned', () => {
    const rows = perYear([
      trip({ startDate: '2025-06-01', endDate: '2025-06-05', countryCodes: ['JPN'] }),
      trip({ startDate: '2026-06-01', endDate: '2026-06-05', countryCodes: ['JPN'] }),
    ])

    expect(rows.find((r) => r.year === 2025)?.newCountries).toBe(1)
    expect(rows.find((r) => r.year === 2026)?.newCountries).toBe(0)
    expect(rows.find((r) => r.year === 2026)?.countries).toBe(1)
  })

  it('does not let a planned trip claim a country as reached', () => {
    const rows = perYear([
      trip({
        startDate: '2026-01-01',
        endDate: '2026-01-05',
        countryCodes: ['PER'],
        status: 'planning',
      }),
    ])
    expect(rows[0].newCountries).toBe(0)
  })
})

describe('tripLengths', () => {
  it('reports the longest, the shortest and the mean', () => {
    const summary = tripLengths([
      trip({ startDate: '2026-01-01', endDate: '2026-01-10' }), // 10
      trip({ startDate: '2026-02-01', endDate: '2026-02-02' }), // 2
      trip({ startDate: '2026-03-01', endDate: '2026-03-06' }), // 6
    ])

    expect(summary?.longest.days).toBe(10)
    expect(summary?.shortest.days).toBe(2)
    expect(summary?.averageDays).toBe(6)
    expect(summary?.measured).toBe(3)
  })

  it('leaves out trips that have not happened', () => {
    const summary = tripLengths([
      trip({ startDate: '2026-01-01', endDate: '2026-01-10' }),
      trip({ startDate: '2026-12-01', endDate: '2026-12-02', status: 'upcoming' }),
    ])

    // "Your shortest trip was 2 days" should not be a booking nobody has taken.
    expect(summary?.shortest.days).toBe(10)
    expect(summary?.measured).toBe(1)
  })

  it('is null rather than zero when there is nothing to measure', () => {
    expect(tripLengths([trip({ startDate: '2026-01-01' })])).toBeNull()
    expect(tripLengths([])).toBeNull()
  })
})

describe('budgetByCurrency', () => {
  it('never adds two currencies together', () => {
    const rows = budgetByCurrency([
      trip({ budgetPlanned: 40000, currency: 'INR' }),
      trip({ budgetPlanned: 60000, currency: 'INR' }),
      trip({ budgetPlanned: 400, currency: 'USD' }),
    ])

    expect(rows).toEqual([
      { currency: 'INR', trips: 2, total: 100000, average: 50000 },
      { currency: 'USD', trips: 1, total: 400, average: 400 },
    ])
  })

  it('leaves a trip with no budget out rather than averaging in a zero', () => {
    const rows = budgetByCurrency([
      trip({ budgetPlanned: 50000, currency: 'INR' }),
      trip({ budgetPlanned: null, currency: 'INR' }),
    ])

    // Not having thought about the money is not a budget of nothing.
    expect(rows[0]).toEqual({ currency: 'INR', trips: 1, total: 50000, average: 50000 })
  })

  it('folds the currency code, so inr and INR are one row', () => {
    const rows = budgetByCurrency([
      trip({ budgetPlanned: 100, currency: 'inr' }),
      trip({ budgetPlanned: 100, currency: 'INR' }),
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0].trips).toBe(2)
  })
})

describe('byTripType', () => {
  it('takes its percentages over the trips that say, and reports the rest', () => {
    const breakdown = byTripType([
      trip({ tripType: 'solo' }),
      trip({ tripType: 'solo' }),
      trip({ tripType: 'family' }),
      trip({ tripType: null }),
      trip({ tripType: null }),
    ])

    expect(breakdown.favourite).toMatchObject({ type: 'solo', trips: 2, percent: 67 })
    expect(breakdown.unstated).toBe(2)
    // 67 + 33, not 40 + 20 with 40% of the travel unaccounted for.
    expect(breakdown.stats.reduce((n, s) => n + s.percent, 0)).toBe(100)
  })

  it('treats a type the enum does not have as unstated', () => {
    const breakdown = byTripType([trip({ tripType: 'honeymoon' })])
    expect(breakdown.unstated).toBe(1)
    expect(breakdown.favourite).toBeNull()
  })
})

describe('favouriteDestinations', () => {
  const region = (over: Partial<Parameters<typeof favouriteDestinations>[0][number]>) => ({
    countryCode: 'IND',
    regionCode: '',
    state: 'visited',
    visitCount: 1,
    firstVisit: null,
    lastVisit: null,
    ...over,
  })

  it('does not add a country row to its own subdivisions', () => {
    const { ranked } = favouriteDestinations([
      region({ countryCode: 'IND', regionCode: '', visitCount: 3 }),
      region({ countryCode: 'IND', regionCode: 'IN-KA', visitCount: 2 }),
      region({ countryCode: 'IND', regionCode: 'IN-GA', visitCount: 1 }),
    ])

    // Six would say someone who knows India in detail visits it twice as often.
    expect(ranked[0]).toMatchObject({ countryCode: 'IND', visits: 3 })
  })

  it('ignores countries that are only planned', () => {
    const { ranked } = favouriteDestinations([
      region({ countryCode: 'PER', state: 'planned', visitCount: 4 }),
      region({ countryCode: 'JPN', state: 'visited', visitCount: 1 }),
    ])

    expect(ranked.map((r) => r.countryCode)).toEqual(['JPN'])
  })

  it('drops a country with no completed visit', () => {
    const { ranked } = favouriteDestinations([
      // The trip you are on right now: real, and not yet a visit.
      region({ countryCode: 'SGP', state: 'current', visitCount: 0 }),
      region({ countryCode: 'JPN', state: 'visited', visitCount: 2 }),
    ])

    // "Singapore — 0 visits" under "where you keep going back" reads as a bug
    // even though the number is right.
    expect(ranked.map((r) => r.countryCode)).toEqual(['JPN'])
  })

  it('puts the most recent visit first when the counts tie', () => {
    const { ranked } = favouriteDestinations([
      region({ countryCode: 'JPN', visitCount: 1, lastVisit: '2022-04-01' }),
      region({ countryCode: 'ISL', visitCount: 1, lastVisit: '2026-04-01' }),
    ])

    expect(ranked.map((r) => r.countryCode)).toEqual(['ISL', 'JPN'])
  })

  it('names no favourite when nothing has been visited twice', () => {
    const { favourite } = favouriteDestinations([
      region({ countryCode: 'JPN', visitCount: 1 }),
      region({ countryCode: 'ISL', visitCount: 1 }),
    ])

    // Otherwise "favourite" means "sorted first", which is not what it says.
    expect(favourite).toBeNull()
  })

  it('keeps the widest span of dates across a country’s rows', () => {
    const { ranked } = favouriteDestinations([
      region({
        countryCode: 'JPN',
        regionCode: '',
        visitCount: 2,
        firstVisit: '2022-04-01',
        lastVisit: '2024-04-01',
      }),
      region({
        countryCode: 'JPN',
        regionCode: 'JP-13',
        visitCount: 1,
        firstVisit: '2019-01-01',
        lastVisit: '2026-01-01',
      }),
    ])

    expect(ranked[0]).toMatchObject({ firstVisit: '2019-01-01', lastVisit: '2026-01-01' })
  })
})

describe('travelDaysOfYear', () => {
  it('returns the whole year, including the days nobody travelled', () => {
    expect(travelDaysOfYear([], 2025)).toHaveLength(365)
    // The loop walks real dates, so February takes care of itself.
    expect(travelDaysOfYear([], 2024)).toHaveLength(366)
  })

  it('marks only the days a trip actually covers', () => {
    const days = travelDaysOfYear([trip({ startDate: '2025-03-01', endDate: '2025-03-03' })], 2025)
    const travelled = days.filter((d) => d.trips > 0)

    expect(travelled.map((d) => d.date)).toEqual(['2025-03-01', '2025-03-02', '2025-03-03'])
    expect(travelled.every((d) => d.scheduled === false)).toBe(true)
  })

  it('clips a trip that runs over the year boundary', () => {
    const days = travelDaysOfYear([trip({ startDate: '2024-12-28', endDate: '2025-01-04' })], 2025)
    expect(days.filter((d) => d.trips > 0).map((d) => d.date)).toEqual([
      '2025-01-01',
      '2025-01-02',
      '2025-01-03',
      '2025-01-04',
    ])
  })

  it('calls a day scheduled only when every trip on it is still ahead', () => {
    const days = travelDaysOfYear(
      [
        trip({ startDate: '2026-05-01', endDate: '2026-05-03', status: 'upcoming' }),
        trip({ startDate: '2026-05-03', endDate: '2026-05-04', status: 'completed' }),
      ],
      2026
    )

    const at = (date: string) => days.find((d) => d.date === date)
    expect(at('2026-05-01')?.scheduled).toBe(true)
    expect(at('2026-05-03')?.scheduled).toBe(false)
  })
})

describe('yearsWithTravel', () => {
  it('offers every year a trip touched, newest first', () => {
    const years = yearsWithTravel([
      trip({ startDate: '2024-12-28', endDate: '2025-01-04' }),
      trip({ startDate: '2022-06-01', endDate: '2022-06-05' }),
    ])

    expect(years).toEqual([2025, 2024, 2022])
  })

  it('ignores a trip with no dates at all', () => {
    expect(yearsWithTravel([trip()])).toEqual([])
  })
})
