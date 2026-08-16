import { describe, expect, it } from 'vitest'
import {
  countByKind,
  distanceCoverage,
  distanceCoverageNote,
  formatDistance,
  haversineKm,
  placeKindLabel,
  totalDistanceKm,
  yearsTravelling,
  type ResumePlace,
} from './resume'

function place(overrides: Partial<ResumePlace> = {}): ResumePlace {
  return {
    countryCode: 'IND',
    regionCode: null,
    cityName: null,
    placeKind: 'city',
    lng: null,
    lat: null,
    tripId: 't1',
    orderIndex: 0,
    ...overrides,
  }
}

describe('countByKind', () => {
  it('counts a place once however many times it was visited', () => {
    // Four trips to Goa is one beach, not four.
    const counts = countByKind([
      place({ placeKind: 'beach', cityName: 'Goa', tripId: 't1' }),
      place({ placeKind: 'beach', cityName: 'Goa', tripId: 't2' }),
      place({ placeKind: 'beach', cityName: 'goa', tripId: 't3' }),
    ])

    expect(counts.beach).toBe(1)
  })

  it('separates places of the same name in different countries', () => {
    const counts = countByKind([
      place({ placeKind: 'city', cityName: 'Santiago', countryCode: 'CHL' }),
      place({ placeKind: 'city', cityName: 'Santiago', countryCode: 'ESP' }),
    ])

    expect(counts.city).toBe(2)
  })

  it('falls back to the subdivision, then the country, when there is no city', () => {
    const counts = countByKind([
      place({ placeKind: 'mountain', regionCode: 'IN-LA' }),
      place({ placeKind: 'mountain', regionCode: 'IN-UT' }),
      place({ placeKind: 'forest', countryCode: 'NPL' }),
    ])

    expect(counts.mountain).toBe(2)
    expect(counts.forest).toBe(1)
  })

  it('files an unknown kind under other rather than dropping it', () => {
    const counts = countByKind([place({ placeKind: 'volcano', cityName: 'Somewhere' })])

    expect(counts.other).toBe(1)
  })

  it('reports zero for every kind with no places', () => {
    const counts = countByKind([])

    expect(counts.city).toBe(0)
    expect(counts.unesco).toBe(0)
    expect(counts.national_park).toBe(0)
  })
})

describe('haversineKm', () => {
  it('measures a known distance', () => {
    // Delhi to Mumbai is about 1150 km.
    const km = haversineKm({ lat: 28.61, lng: 77.21 }, { lat: 19.08, lng: 72.88 })

    expect(km).toBeGreaterThan(1100)
    expect(km).toBeLessThan(1200)
  })

  it('is zero for the same point', () => {
    expect(haversineKm({ lat: 12.97, lng: 77.59 }, { lat: 12.97, lng: 77.59 })).toBe(0)
  })
})

describe('totalDistanceKm', () => {
  it('is null when nothing has coordinates, rather than zero', () => {
    // The state today: places are country and city only, so claiming someone has
    // travelled 0 km would be a lie rather than an absence.
    expect(totalDistanceKm([place(), place({ orderIndex: 1 })])).toBeNull()
  })

  it('sums hops along each trip in order', () => {
    const km = totalDistanceKm([
      place({ tripId: 't1', orderIndex: 1, lat: 19.08, lng: 72.88 }),
      place({ tripId: 't1', orderIndex: 0, lat: 28.61, lng: 77.21 }),
    ])

    expect(km).toBeGreaterThan(1100)
  })

  it('does not join the end of one trip to the start of another', () => {
    const separate = totalDistanceKm([
      place({ tripId: 't1', orderIndex: 0, lat: 28.61, lng: 77.21 }),
      place({ tripId: 't2', orderIndex: 0, lat: 19.08, lng: 72.88 }),
    ])

    // One stop on each trip means no hops at all.
    expect(separate).toBeNull()
  })

  it('ignores places that have no coordinates', () => {
    const km = totalDistanceKm([
      place({ tripId: 't1', orderIndex: 0, lat: 28.61, lng: 77.21 }),
      place({ tripId: 't1', orderIndex: 1 }),
      place({ tripId: 't1', orderIndex: 2, lat: 19.08, lng: 72.88 }),
    ])

    expect(km).toBeGreaterThan(1100)
  })

  it('agrees with PostGIS on a real itinerary', () => {
    // Tokyo → Kyoto → Osaka, the coordinates the map picker writes. PostGIS makes
    // this 403 km:
    //
    //   select sum(st_distance(location, prev)) ... => 403
    //
    // This app answers the same question with haversine on a sphere, so the two
    // will never match to the metre — but they must agree to within a fraction of
    // a percent, or one of them is wrong about the earth.
    const km = totalDistanceKm([
      place({ tripId: 'jp', orderIndex: 0, lat: 35.6762, lng: 139.6503 }),
      place({ tripId: 'jp', orderIndex: 1, lat: 35.0116, lng: 135.7681 }),
      place({ tripId: 'jp', orderIndex: 2, lat: 34.6937, lng: 135.5023 }),
    ])

    expect(km).not.toBeNull()
    expect(Math.abs((km as number) - 403)).toBeLessThan(4)
  })
})

describe('distanceCoverage', () => {
  it('does not count a trip with a single pin as measured', () => {
    // The case gap 10 was about: three stops, one pin, nothing measurable —
    // and the earlier version of this counted the trip as measured anyway.
    const coverage = distanceCoverage([
      place({ tripId: 't1', orderIndex: 0, lat: 28.61, lng: 77.21 }),
      place({ tripId: 't1', orderIndex: 1 }),
      place({ tripId: 't1', orderIndex: 2 }),
    ])

    expect(coverage).toEqual({ measured: 0, measurable: 1, total: 1 })
  })

  it('counts a trip once two of its stops are pinned', () => {
    const coverage = distanceCoverage([
      place({ tripId: 't1', orderIndex: 0, lat: 28.61, lng: 77.21 }),
      place({ tripId: 't1', orderIndex: 1, lat: 19.08, lng: 72.88 }),
      place({ tripId: 't1', orderIndex: 2 }),
    ])

    expect(coverage.measured).toBe(1)
  })

  it('leaves a one-stop trip out of the denominator', () => {
    // A trip with one place has no leg to measure however well it is pinned, so
    // counting it as measurable would make the ratio unreachable.
    const coverage = distanceCoverage([
      place({ tripId: 't1', orderIndex: 0, lat: 28.61, lng: 77.21 }),
      place({ tripId: 't2', orderIndex: 0, lat: 19.08, lng: 72.88 }),
      place({ tripId: 't2', orderIndex: 1, lat: 12.97, lng: 77.59 }),
    ])

    expect(coverage).toEqual({ measured: 1, measurable: 1, total: 2 })
  })

  it('is all zeroes when there are no places', () => {
    expect(distanceCoverage([])).toEqual({ measured: 0, measurable: 0, total: 0 })
  })
})

describe('distanceCoverageNote', () => {
  it('tells a visitor the figure is withheld, not missing', () => {
    expect(distanceCoverageNote(null)).toBe('Not shown publicly')
  })

  it('names the ratio while any measurable trip is unpinned', () => {
    expect(distanceCoverageNote({ measured: 2, measurable: 5, total: 7 })).toBe(
      'Approximate · 2 of 5 trips'
    )
  })

  it('drops the ratio once every measurable trip is in the total', () => {
    expect(distanceCoverageNote({ measured: 5, measurable: 5, total: 9 })).toBe('Approximate')
  })

  it('separates nothing recorded from nothing pinned from nothing to pin', () => {
    expect(distanceCoverageNote({ measured: 0, measurable: 0, total: 0 })).toBe(
      'Needs pinned places'
    )
    // Places exist but every trip is a single stop: pinning more will not help.
    expect(distanceCoverageNote({ measured: 0, measurable: 0, total: 3 })).toBe(
      'Needs a second stop'
    )
    expect(distanceCoverageNote({ measured: 0, measurable: 3, total: 3 })).toBe(
      '0 of 3 trips pinned'
    )
  })
})

describe('yearsTravelling', () => {
  it('counts distinct years, not the span between them', () => {
    // 2019 and 2026 is two years of travel on record, not eight.
    expect(yearsTravelling(['2019-04-02', '2026-01-11'])).toBe(2)
  })

  it('counts a year once however many trips it held', () => {
    expect(yearsTravelling(['2025-01-01', '2025-06-01', '2025-12-31'])).toBe(1)
  })

  it('ignores missing dates', () => {
    expect(yearsTravelling([null, '2024-03-03', null])).toBe(1)
    expect(yearsTravelling([])).toBe(0)
  })
})

describe('formatDistance', () => {
  it('shows a dash when there is nothing to show', () => {
    expect(formatDistance(null)).toBe('—')
  })

  it('switches to thousands past 1000 km', () => {
    expect(formatDistance(940)).toBe('940 km')
    expect(formatDistance(12_400)).toBe('12k km')
  })
})

describe('placeKindLabel', () => {
  it('agrees with the count', () => {
    expect(placeKindLabel('city', 1)).toBe('City')
    expect(placeKindLabel('city', 4)).toBe('Cities')
    expect(placeKindLabel('beach', 2)).toBe('Beaches')
  })
})
