import { describe, expect, it } from 'vitest'
import { indexRegions, regionKey, rollUpToCountries, type VisitedRegion } from './types'
import type { RegionState } from '@/lib/geo/region-state'

function region(
  overrides: Partial<VisitedRegion> & Pick<VisitedRegion, 'countryCode'>
): VisitedRegion {
  return {
    regionCode: '',
    state: 'visited' as RegionState,
    visitCount: 1,
    firstVisit: null,
    lastVisit: null,
    tripIds: [],
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

  it('takes the highest visit count and the first available hero photo', () => {
    const [rolled] = rollUpToCountries([
      region({ countryCode: 'IND', regionCode: 'IN-KA', visitCount: 2, featuredMediaUrl: null }),
      region({
        countryCode: 'IND',
        regionCode: 'IN-GA',
        visitCount: 5,
        featuredMediaUrl: '/a.jpg',
      }),
    ])

    expect(rolled.visitCount).toBe(5)
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
