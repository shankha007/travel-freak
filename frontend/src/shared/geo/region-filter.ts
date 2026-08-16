import type { VisitedRegion } from '@/shared/types/globe'
import { continentOf, type Continent } from '@/shared/geo/continents'
import { TRIP_TYPES, type TripType } from '@/shared/analytics'

/**
 * Narrowing what the globe and the world map paint — screens 14 and 16.
 *
 * Pure, and separate from the components, because both screens filter and the
 * region list beside each of them has to be filtered identically. A map showing
 * one set of countries and a list showing another is worse than no filter.
 *
 * **What "in this year" can honestly mean here.** `visited_regions` carries a
 * first visit and a last visit and nothing between them, so a region visited in
 * 2019 and again in 2026 is indistinguishable from one visited every year in
 * between. The test is therefore whether the year falls inside that span, and
 * the screen says as much rather than implying a precision the aggregate does
 * not have. Getting this exact needs a per-visit table, which is a schema
 * change and not this fix.
 *
 * A region with no dates at all — a wishlist entry, a trip nobody has dated —
 * is kept when no year is chosen and dropped when one is. It cannot be claimed
 * for a year, and claiming it for all of them would be worse.
 *
 * **Trip type** works the same way and for the same reason. A region carries the
 * kinds of trip that reached it, so "family" keeps a country if any trip there
 * was a family one — never that every trip was. A region with no typed trip
 * behind it — a wishlist entry, a bare "been there" mark from onboarding, a trip
 * whose type was left blank — is dropped once a type is chosen, because there is
 * no type it can honestly claim.
 */

export interface RegionFilter {
  /** Calendar year, or null for "any". */
  year: number | null
  continent: Continent | null
  tripType: TripType | null
}

export const NO_REGION_FILTER: RegionFilter = { year: null, continent: null, tripType: null }

export function isFiltered(filter: RegionFilter): boolean {
  return filter.year !== null || filter.continent !== null || filter.tripType !== null
}

function yearOf(date: string | null): number | null {
  if (!date) return null
  const year = Number(date.slice(0, 4))
  return Number.isFinite(year) && year > 1900 ? year : null
}

/** Whether one row survives the filter. */
export function matchesFilter(region: VisitedRegion, filter: RegionFilter): boolean {
  if (filter.continent !== null && continentOf(region.countryCode) !== filter.continent) {
    return false
  }

  if (filter.year !== null) {
    const first = yearOf(region.firstVisit)
    const last = yearOf(region.lastVisit) ?? first
    if (first === null || last === null) return false
    if (filter.year < first || filter.year > last) return false
  }

  if (filter.tripType !== null && !region.tripTypes.includes(filter.tripType)) {
    return false
  }

  return true
}

export function filterRegions(regions: VisitedRegion[], filter: RegionFilter): VisitedRegion[] {
  if (!isFiltered(filter)) return regions
  return regions.filter((region) => matchesFilter(region, filter))
}

/**
 * The years worth offering, newest first.
 *
 * Only the years the data can actually answer for — every year spanned by some
 * region — so the control never offers a year that would empty the map. A gap
 * year with nothing in it is still listed when another region's span crosses
 * it, which is the same imprecision the span test has and not a second one.
 */
export function availableYears(regions: VisitedRegion[]): number[] {
  const years = new Set<number>()

  for (const region of regions) {
    const first = yearOf(region.firstVisit)
    if (first === null) continue
    const last = yearOf(region.lastVisit) ?? first
    for (let year = first; year <= last; year++) years.add(year)
  }

  return [...years].sort((a, b) => b - a)
}

/** The continents actually represented, in the table's own order. */
export function availableContinents(regions: VisitedRegion[]): Continent[] {
  const present = new Set<Continent>()
  for (const region of regions) {
    const continent = continentOf(region.countryCode)
    if (continent) present.add(continent)
  }
  return [...present]
}

/**
 * The trip types actually represented, in the enum's own order.
 *
 * Returns nothing at all on a read that does not resolve types — the public
 * globe, whose rows carry an empty array by design — so the control disappears
 * rather than offering five options that would each empty the map.
 */
export function availableTripTypes(regions: VisitedRegion[]): TripType[] {
  const present = new Set<TripType>()
  for (const region of regions) {
    for (const type of region.tripTypes) present.add(type)
  }
  return TRIP_TYPES.filter((type) => present.has(type))
}
