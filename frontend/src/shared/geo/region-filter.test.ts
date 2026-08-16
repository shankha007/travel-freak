import { describe, expect, it } from 'vitest'
import type { VisitedRegion } from '@/shared/types/globe'
import {
  NO_REGION_FILTER,
  availableContinents,
  availableTripTypes,
  availableYears,
  filterRegions,
  isFiltered,
  matchesFilter,
  type RegionFilter,
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
    tripTypes: ['solo'],
    cityNames: [],
    featuredMediaId: null,
    featuredMediaUrl: null,
    ...overrides,
  }
}

/** Every unnamed axis left at "any", so a test states only what it is about. */
function filter(overrides: Partial<RegionFilter> = {}): RegionFilter {
  return { ...NO_REGION_FILTER, ...overrides }
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

    expect(matchesFilter(spanning, filter({ year: 2019 }))).toBe(true)
    expect(matchesFilter(spanning, filter({ year: 2022 }))).toBe(true)
    expect(matchesFilter(spanning, filter({ year: 2026 }))).toBe(true)
    expect(matchesFilter(spanning, filter({ year: 2018 }))).toBe(false)
    expect(matchesFilter(spanning, filter({ year: 2027 }))).toBe(false)
  })

  it('treats a single-visit region as a span of one year', () => {
    const once = region({ firstVisit: '2024-03-01', lastVisit: null })

    expect(matchesFilter(once, filter({ year: 2024 }))).toBe(true)
    expect(matchesFilter(once, filter({ year: 2025 }))).toBe(false)
  })

  it('drops an undated region once a year is chosen, but not before', () => {
    // A wishlist entry, or a trip nobody has dated: it cannot be claimed for a
    // year, and claiming it for every year would be worse than dropping it.
    const undated = region({ firstVisit: null, lastVisit: null, state: 'planned' })

    expect(matchesFilter(undated, NO_REGION_FILTER)).toBe(true)
    expect(matchesFilter(undated, filter({ year: 2024 }))).toBe(false)
  })

  it('filters by continent', () => {
    expect(matchesFilter(region({ countryCode: 'IND' }), filter({ continent: 'AS' }))).toBe(true)
    expect(matchesFilter(region({ countryCode: 'IND' }), filter({ continent: 'EU' }))).toBe(false)
  })

  it('requires both when both are chosen', () => {
    const indiaIn2024 = region({ countryCode: 'IND' })

    expect(matchesFilter(indiaIn2024, filter({ year: 2024, continent: 'AS' }))).toBe(true)
    expect(matchesFilter(indiaIn2024, filter({ year: 2024, continent: 'EU' }))).toBe(false)
    expect(matchesFilter(indiaIn2024, filter({ year: 2023, continent: 'AS' }))).toBe(false)
  })

  it('matches a trip type when any one trip there was of that kind', () => {
    // The claim is "you have been here on a family trip", not "every trip here
    // was a family one" — a country reached on four trips would satisfy nothing
    // under the stricter reading.
    const mixed = region({ tripTypes: ['solo', 'family'] })

    expect(matchesFilter(mixed, filter({ tripType: 'family' }))).toBe(true)
    expect(matchesFilter(mixed, filter({ tripType: 'solo' }))).toBe(true)
    expect(matchesFilter(mixed, filter({ tripType: 'business' }))).toBe(false)
  })

  it('drops a region with no typed trip once a type is chosen, but not before', () => {
    // A wishlist entry, a bare "been there" mark from onboarding, or a trip
    // whose type was left blank. Same rule as an undated region and a year.
    const untyped = region({ tripTypes: [] })

    expect(matchesFilter(untyped, NO_REGION_FILTER)).toBe(true)
    expect(matchesFilter(untyped, filter({ tripType: 'solo' }))).toBe(false)
  })

  it('requires all three when all three are chosen', () => {
    const indiaSoloIn2024 = region({ countryCode: 'IND', tripTypes: ['solo'] })

    expect(
      matchesFilter(indiaSoloIn2024, filter({ year: 2024, continent: 'AS', tripType: 'solo' }))
    ).toBe(true)
    expect(
      matchesFilter(indiaSoloIn2024, filter({ year: 2024, continent: 'AS', tripType: 'family' }))
    ).toBe(false)
  })
})

describe('isFiltered', () => {
  it('counts a trip type as a filter on its own', () => {
    expect(isFiltered(filter({ tripType: 'business' }))).toBe(true)
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

    expect(filterRegions(regions, filter({ continent: 'AS' })).map((r) => r.countryCode)).toEqual([
      'IND',
      'JPN',
    ])
  })

  it('drops the rows whose trips were of another kind', () => {
    const regions = [
      region({ countryCode: 'IND', tripTypes: ['family'] }),
      region({ countryCode: 'FRA', tripTypes: ['solo', 'business'] }),
      region({ countryCode: 'JPN', tripTypes: [] }),
    ]

    expect(
      filterRegions(regions, filter({ tripType: 'business' })).map((r) => r.countryCode)
    ).toEqual(['FRA'])
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

describe('availableTripTypes', () => {
  it('lists only what is represented, in the enum order', () => {
    const types = availableTripTypes([
      region({ countryCode: 'IND', tripTypes: ['family', 'solo'] }),
      region({ countryCode: 'FRA', tripTypes: ['solo'] }),
      region({ countryCode: 'JPN', tripTypes: ['business'] }),
    ])

    // Enum order, not the order they were encountered — the control reads the
    // same top to bottom whatever the account looks like.
    expect(types).toEqual(['solo', 'family', 'business'])
  })

  it('comes back empty on rows that carry no types', () => {
    // The public profile's read leaves `tripTypes` empty by design, and the
    // control renders nothing rather than five options that all empty the map.
    expect(availableTripTypes([region({ tripTypes: [] })])).toEqual([])
  })
})
