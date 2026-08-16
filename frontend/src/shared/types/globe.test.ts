import { describe, expect, it } from 'vitest'
import { indexRegions, regionKey, rollUpToCountries, type VisitedRegion } from './globe'
import type { RegionState } from '@/shared/geo/region-state'

function region(
  overrides: Partial<VisitedRegion> & Pick<VisitedRegion, 'countryCode'>
): VisitedRegion {
  const visitTripIds = overrides.visitTripIds ?? ['t1']
  return {
    regionCode: '',
    state: 'visited' as RegionState,
    visitTripIds,
    // Mirrors the aggregate's invariant: the count is the size of the trip set.
    visitCount: visitTripIds.length,
    firstVisit: null,
    lastVisit: null,
    tripIds: [],
    tripTypes: [],
    cityNames: [],
    featuredMediaId: null,
    featuredMediaUrl: null,
    ...overrides,
  }
}

describe('regionKey', () => {
  it('uses the country alone when there is no subdivision', () => {
    expect(regionKey('IND')).toBe('IND')
    expect(regionKey('IND', '')).toBe('IND')
  })

  it('composes country and subdivision', () => {
    expect(regionKey('IND', 'IN-KA')).toBe('IND:IN-KA')
  })
})

describe('indexRegions', () => {
  it('keys country-level and subdivision rows separately', () => {
    const index = indexRegions([
      region({ countryCode: 'IND' }),
      region({ countryCode: 'IND', regionCode: 'IN-KA' }),
    ])

    expect(index.size).toBe(2)
    expect(index.get('IND')).toBeDefined()
    expect(index.get('IND:IN-KA')).toBeDefined()
  })
})

describe('rollUpToCountries', () => {
  it('collapses a trip spanning three places across two countries into two rows', () => {
    // The exact case named in the plan's verification section.
    const rolled = rollUpToCountries([
      region({ countryCode: 'IND', regionCode: 'IN-KA', tripIds: ['t1'] }),
      region({ countryCode: 'IND', regionCode: 'IN-GA', tripIds: ['t1'] }),
      region({ countryCode: 'NPL', regionCode: 'NP-P3', tripIds: ['t1'] }),
    ])

    expect(rolled).toHaveLength(2)
    expect(rolled.map((r) => r.countryCode).sort()).toEqual(['IND', 'NPL'])
    expect(rolled.every((r) => r.regionCode === '')).toBe(true)
  })

  it('lets an ongoing trip outrank completed and planned ones', () => {
    const [rolled] = rollUpToCountries([
      region({ countryCode: 'IND', regionCode: 'IN-KA', state: 'visited' }),
      region({ countryCode: 'IND', regionCode: 'IN-GA', state: 'current' }),
      region({ countryCode: 'IND', regionCode: 'IN-MH', state: 'planned' }),
    ])

    expect(rolled.state).toBe('current')
  })

  it('lets visited outrank planned', () => {
    const [rolled] = rollUpToCountries([
      region({ countryCode: 'IND', regionCode: 'IN-KA', state: 'planned' }),
      region({ countryCode: 'IND', regionCode: 'IN-GA', state: 'visited' }),
    ])

    expect(rolled.state).toBe('visited')
  })

  it('keeps the widest date range and merges trips and cities without duplicates', () => {
    const [rolled] = rollUpToCountries([
      region({
        countryCode: 'IND',
        regionCode: 'IN-KA',
        firstVisit: '2024-03-01',
        lastVisit: '2024-03-10',
        tripIds: ['t1', 't2'],
        cityNames: ['Bengaluru', 'Mysuru'],
      }),
      region({
        countryCode: 'IND',
        regionCode: 'IN-GA',
        firstVisit: '2023-01-05',
        lastVisit: '2026-02-02',
        tripIds: ['t2', 't3'],
        cityNames: ['Panaji', 'Mysuru'],
      }),
    ])

    expect(rolled.firstVisit).toBe('2023-01-05')
    expect(rolled.lastVisit).toBe('2026-02-02')
    expect(rolled.tripIds.sort()).toEqual(['t1', 't2', 't3'])
    expect(rolled.cityNames.sort()).toEqual(['Bengaluru', 'Mysuru', 'Panaji'])
  })

  it('unions the trip types across subdivisions', () => {
    // A country reached on a solo trip to one state and a family trip to another
    // has been reached both ways, and the filter has to keep it under either.
    const [rolled] = rollUpToCountries([
      region({ countryCode: 'IND', regionCode: 'IN-KA', tripTypes: ['solo', 'family'] }),
      region({ countryCode: 'IND', regionCode: 'IN-GA', tripTypes: ['family', 'business'] }),
    ])

    expect([...rolled.tripTypes].sort()).toEqual(['business', 'family', 'solo'])
  })

  it('counts distinct trips across subdivisions, not the largest single count', () => {
    // Four separate trips, each to a different state. The country was visited
    // four times; the old max() roll-up reported one.
    const [rolled] = rollUpToCountries([
      region({ countryCode: 'IND', regionCode: 'IN-KA', visitTripIds: ['t1'] }),
      region({ countryCode: 'IND', regionCode: 'IN-GA', visitTripIds: ['t2'] }),
      region({ countryCode: 'IND', regionCode: 'IN-MH', visitTripIds: ['t3'] }),
      region({ countryCode: 'IND', regionCode: 'IN-KL', visitTripIds: ['t4'] }),
    ])

    expect(rolled.visitCount).toBe(4)
    expect(rolled.visitTripIds.sort()).toEqual(['t1', 't2', 't3', 't4'])
  })

  it('counts one trip once even when it crossed several subdivisions', () => {
    // The failure mode a plain sum would have: one trip, three states.
    const [rolled] = rollUpToCountries([
      region({ countryCode: 'IND', regionCode: 'IN-KA', visitTripIds: ['t1'] }),
      region({ countryCode: 'IND', regionCode: 'IN-GA', visitTripIds: ['t1'] }),
      region({ countryCode: 'IND', regionCode: 'IN-MH', visitTripIds: ['t1'] }),
    ])

    expect(rolled.visitCount).toBe(1)
  })

  it('keeps a country-level row untouched', () => {
    const [rolled] = rollUpToCountries([region({ countryCode: 'JPN', visitTripIds: ['t1', 't2'] })])

    expect(rolled.visitCount).toBe(2)
    expect(rolled.regionCode).toBe('')
  })

  it('takes the first available hero photo', () => {
    const [rolled] = rollUpToCountries([
      region({ countryCode: 'IND', regionCode: 'IN-KA', featuredMediaUrl: null }),
      region({ countryCode: 'IND', regionCode: 'IN-GA', featuredMediaUrl: '/a.jpg' }),
    ])

    expect(rolled.featuredMediaUrl).toBe('/a.jpg')
  })

  it('handles null dates without treating them as the earliest value', () => {
    const [rolled] = rollUpToCountries([
      region({ countryCode: 'IND', regionCode: 'IN-KA', firstVisit: null, lastVisit: null }),
      region({
        countryCode: 'IND',
        regionCode: 'IN-GA',
        firstVisit: '2025-06-01',
        lastVisit: '2025-06-09',
      }),
    ])

    expect(rolled.firstVisit).toBe('2025-06-01')
    expect(rolled.lastVisit).toBe('2025-06-09')
  })

  it('returns an empty array for no input', () => {
    expect(rollUpToCountries([])).toEqual([])
  })
})
