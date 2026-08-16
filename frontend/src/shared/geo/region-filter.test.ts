import { describe, expect, it } from 'vitest'
import type { VisitedRegion } from '@/shared/types/globe'
import {
  NO_REGION_FILTER,
  availableContinents,
  availableYears,
  filterRegions,
  isFiltered,
  matchesFilter,
} from './region-filter'

function region(overrides: Partial<VisitedRegion> = {}): VisitedRegion {
  return {
    countryCode: 'IND',
    regionCode: '',
    state: 'visited',
    visitCount: 1,
    visitTripIds: ['t1'],
    firstVisit: '2024-03-01',
    lastVisit: '2024-03-10',
    tripIds: ['t1'],
    cityNames: [],
    featuredMediaId: null,
    featuredMediaUrl: null,
    ...overrides,
  }
}

describe('matchesFilter', () => {
  it('keeps everything when nothing is chosen', () => {
    expect(matchesFilter(region({ firstVisit: null, lastVisit: null }), NO_REGION_FILTER)).toBe(
      true
    )
    expect(isFiltered(NO_REGION_FILTER)).toBe(false)
  })

  it('matches a year inside the visit span, including its ends', () => {
    const spanning = region({ firstVisit: '2019-01-01', lastVisit: '2026-01-01' })

    expect(matchesFilter(spanning, { year: 2019, continent: null })).toBe(true)
    expect(matchesFilter(spanning, { year: 2022, continent: null })).toBe(true)
    expect(matchesFilter(spanning, { year: 2026, continent: null })).toBe(true)
    expect(matchesFilter(spanning, { year: 2018, continent: null })).toBe(false)
    expect(matchesFilter(spanning, { year: 2027, continent: null })).toBe(false)
  })

  it('treats a single-visit region as a span of one year', () => {
    const once = region({ firstVisit: '2024-03-01', lastVisit: null })

    expect(matchesFilter(once, { year: 2024, continent: null })).toBe(true)
    expect(matchesFilter(once, { year: 2025, continent: null })).toBe(false)
  })

  it('drops an undated region once a year is chosen, but not before', () => {
    // A wishlist entry, or a trip nobody has dated: it cannot be claimed for a
    // year, and claiming it for every year would be worse than dropping it.
    const undated = region({ firstVisit: null, lastVisit: null, state: 'planned' })

    expect(matchesFilter(undated, NO_REGION_FILTER)).toBe(true)
    expect(matchesFilter(undated, { year: 2024, continent: null })).toBe(false)
  })

  it('filters by continent', () => {
    expect(matchesFilter(region({ countryCode: 'IND' }), { year: null, continent: 'AS' })).toBe(
      true
    )
    expect(matchesFilter(region({ countryCode: 'IND' }), { year: null, continent: 'EU' })).toBe(
      false
    )
  })

  it('requires both when both are chosen', () => {
    const indiaIn2024 = region({ countryCode: 'IND' })

    expect(matchesFilter(indiaIn2024, { year: 2024, continent: 'AS' })).toBe(true)
    expect(matchesFilter(indiaIn2024, { year: 2024, continent: 'EU' })).toBe(false)
    expect(matchesFilter(indiaIn2024, { year: 2023, continent: 'AS' })).toBe(false)
  })
})

describe('filterRegions', () => {
  it('returns the same array when there is nothing to do', () => {
    const regions = [region()]

    expect(filterRegions(regions, NO_REGION_FILTER)).toBe(regions)
  })

  it('drops the rows that do not match', () => {
    const regions = [
      region({ countryCode: 'IND' }),
      region({ countryCode: 'FRA' }),
      region({ countryCode: 'JPN' }),
    ]

    expect(
      filterRegions(regions, { year: null, continent: 'AS' }).map((r) => r.countryCode)
    ).toEqual(['IND', 'JPN'])
  })
})

describe('availableYears', () => {
  it('lists every year a span covers, newest first', () => {
    const years = availableYears([region({ firstVisit: '2022-05-01', lastVisit: '2024-02-01' })])

    expect(years).toEqual([2024, 2023, 2022])
  })

  it('counts a year once however many regions are in it', () => {
    const years = availableYears([
      region({ countryCode: 'IND', firstVisit: '2024-01-01', lastVisit: '2024-01-02' }),
      region({ countryCode: 'FRA', firstVisit: '2024-06-01', lastVisit: '2024-06-02' }),
    ])

    expect(years).toEqual([2024])
  })

  it('ignores regions with no dates', () => {
    expect(availableYears([region({ firstVisit: null, lastVisit: null })])).toEqual([])
  })
})

describe('availableContinents', () => {
  it('lists only what is represented', () => {
    const continents = availableContinents([
      region({ countryCode: 'IND' }),
      region({ countryCode: 'JPN' }),
      region({ countryCode: 'FRA' }),
    ])

    expect([...continents].sort()).toEqual(['AS', 'EU'])
  })
})
