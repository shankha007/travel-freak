import type { RegionState } from '@/lib/geo/region-state'

/**
 * One row of the `visited_regions` aggregate — the only shape the globe, the
 * maps and the region list consume. Deliberately decoupled from the trips
 * tables so the globe never needs to know how a visit was recorded.
 */
export interface VisitedRegion {
  countryCode: string
  /** ISO 3166-2 subdivision, or '' for country-level only. */
  regionCode: string
  state: RegionState
  visitCount: number
  firstVisit: string | null
  lastVisit: string | null
  tripIds: string[]
  cityNames: string[]
  featuredMediaId: string | null
  /** Resolved signed/public URL for the hero photo, when one exists. */
  featuredMediaUrl: string | null
}

/** Detail shown in the region modal. Loaded on demand, not with the globe. */
export interface RegionDetail {
  countryCode: string
  regionCode: string
  countryName: string
  state: RegionState
  visitCount: number
  firstVisit: string | null
  lastVisit: string | null
  cityNames: string[]
  featuredMediaUrl: string | null
  trips: RegionTripSummary[]
  memories: RegionMemory[]
}

export interface RegionTripSummary {
  id: string
  title: string
  slug: string
  startDate: string | null
  endDate: string | null
  summary: string
  coverMediaUrl: string | null
  blogSlug: string | null
  photoCount: number
}

export interface RegionMemory {
  id: string
  kind: 'note' | 'photo' | 'audio' | 'video' | 'quote' | 'favorite_location'
  body: string
  happenedAt: string | null
  mediaUrl: string | null
}

/** Fast lookup keyed by the same composite key the database uses. */
export function regionKey(countryCode: string, regionCode = ''): string {
  return regionCode ? `${countryCode}:${regionCode}` : countryCode
}

export function indexRegions(regions: VisitedRegion[]): Map<string, VisitedRegion> {
  return new Map(regions.map((r) => [regionKey(r.countryCode, r.regionCode), r]))
}

/**
 * Collapses subdivision rows up to their country for the country-level globe.
 *
 * A user on the free plan sees only country fills, but their underlying data may
 * carry state-level detail. Rolling up here means the same stored data drives
 * both tiers — the paywall changes what is rendered, never what is recorded.
 */
export function rollUpToCountries(regions: VisitedRegion[]): VisitedRegion[] {
  const byCountry = new Map<string, VisitedRegion>()
  // 'current' outranks 'visited', which outranks 'planned'.
  const rank: Record<RegionState, number> = {
    current: 3,
    visited: 2,
    planned: 1,
    unvisited: 0,
  }

  for (const region of regions) {
    const existing = byCountry.get(region.countryCode)
    if (!existing) {
      byCountry.set(region.countryCode, { ...region, regionCode: '' })
      continue
    }

    byCountry.set(region.countryCode, {
      ...existing,
      state: rank[region.state] > rank[existing.state] ? region.state : existing.state,
      visitCount: Math.max(existing.visitCount, region.visitCount),
      firstVisit: minDate(existing.firstVisit, region.firstVisit),
      lastVisit: maxDate(existing.lastVisit, region.lastVisit),
      tripIds: [...new Set([...existing.tripIds, ...region.tripIds])],
      cityNames: [...new Set([...existing.cityNames, ...region.cityNames])],
      featuredMediaUrl: existing.featuredMediaUrl ?? region.featuredMediaUrl,
    })
  }

  return [...byCountry.values()]
}

function minDate(a: string | null, b: string | null): string | null {
  if (!a) return b
  if (!b) return a
  return a < b ? a : b
}

function maxDate(a: string | null, b: string | null): string | null {
  if (!a) return b
  if (!b) return a
  return a > b ? a : b
}
