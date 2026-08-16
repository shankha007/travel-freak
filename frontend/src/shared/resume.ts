/**
 * The numbers on a Travel Resume — screen 33.
 *
 * Pure functions over rows the server has already fetched, so the arithmetic
 * that decides what a person's travel history "adds up to" is testable without
 * a database. The resume is the shareable artifact; getting these wrong is
 * getting the product wrong.
 */

/** Place kinds, in the order the resume lists them. */
export const PLACE_KINDS = [
  'city',
  'mountain',
  'beach',
  'forest',
  'unesco',
  'national_park',
  'other',
] as const

export type PlaceKind = (typeof PLACE_KINDS)[number]

/** Singular and plural labels, because "1 cities" is a bug people notice. */
export const PLACE_KIND_LABELS: Record<PlaceKind, { one: string; many: string }> = {
  city: { one: 'City', many: 'Cities' },
  mountain: { one: 'Mountain', many: 'Mountains' },
  beach: { one: 'Beach', many: 'Beaches' },
  forest: { one: 'Forest', many: 'Forests' },
  unesco: { one: 'UNESCO site', many: 'UNESCO sites' },
  national_park: { one: 'National park', many: 'National parks' },
  other: { one: 'Other place', many: 'Other places' },
}

export function placeKindLabel(kind: PlaceKind, count: number): string {
  const labels = PLACE_KIND_LABELS[kind]
  return count === 1 ? labels.one : labels.many
}

export interface ResumePlace {
  countryCode: string
  regionCode: string | null
  cityName: string | null
  placeKind: string
  /** Longitude/latitude when the place has been pinned. Null until then. */
  lng: number | null
  lat: number | null
  tripId: string
  orderIndex: number
}

/**
 * Distinct places by kind.
 *
 * Counted on the place's identity rather than on rows: someone who went back to
 * Goa four times has been to one beach, not four. Identity is the most specific
 * thing recorded — city if there is one, else the subdivision, else the country.
 */
export function countByKind(places: ResumePlace[]): Record<PlaceKind, number> {
  const seen: Record<string, Set<string>> = {}

  for (const place of places) {
    const kind = (PLACE_KINDS as readonly string[]).includes(place.placeKind)
      ? (place.placeKind as PlaceKind)
      : 'other'
    const identity = place.cityName?.trim() || place.regionCode || place.countryCode
    seen[kind] ??= new Set()
    seen[kind].add(`${place.countryCode}:${identity.toLowerCase()}`)
  }

  return Object.fromEntries(PLACE_KINDS.map((kind) => [kind, seen[kind]?.size ?? 0])) as Record<
    PlaceKind,
    number
  >
}

const EARTH_RADIUS_KM = 6371

/** Great-circle distance between two points, in kilometres. */
export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)

  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h))
}

/**
 * Approximate distance travelled: great-circle hops between consecutive places
 * on each trip.
 *
 * Returns null rather than 0 when nothing can be measured, so the resume can say
 * "not yet" instead of claiming someone has travelled zero kilometres. That is
 * the state today — places are country and city only until the map picker lands,
 * so nothing carries coordinates.
 *
 * Flagged as approximate wherever it is shown: it is a sum of straight lines
 * between recorded stops, not a GPS track.
 */
export function totalDistanceKm(places: ResumePlace[]): number | null {
  const byTrip = new Map<string, ResumePlace[]>()
  for (const place of places) {
    if (place.lat === null || place.lng === null) continue
    byTrip.set(place.tripId, [...(byTrip.get(place.tripId) ?? []), place])
  }

  let total = 0
  let measured = false

  for (const tripPlaces of byTrip.values()) {
    const ordered = [...tripPlaces].sort((a, b) => a.orderIndex - b.orderIndex)
    for (let i = 1; i < ordered.length; i++) {
      const from = ordered[i - 1]
      const to = ordered[i]
      total += haversineKm(
        { lat: from.lat as number, lng: from.lng as number },
        { lat: to.lat as number, lng: to.lng as number }
      )
      measured = true
    }
  }

  return measured ? Math.round(total) : null
}

/**
 * How much of the distance figure is actually measured.
 *
 * `totalDistanceKm` skips the legs it cannot see. That is the honest answer —
 * an unpinned stop is real distance nobody can compute — but on its own it is
 * an unexplained one: a trip with three stops and one pin adds nothing to the
 * total, and the screen showing that total looks like it is claiming the person
 * has not been far. Both the resume and the analytics screen show this ratio
 * beside the number so a small total reads as "not pinned yet".
 *
 * `measured` requires **two** pinned stops, not one. Distance is a property of
 * the leg between two points; a single pin on a trip is not half a measurement,
 * it is none. Counting it as measured was the earlier version of this function
 * and it contradicted its own explanation.
 */
export interface DistanceCoverage {
  /** Trips carrying two or more pinned stops — the ones inside the total. */
  measured: number
  /** Trips with two or more places, so a distance could exist for them at all. */
  measurable: number
  /** Trips with any places recorded, pinned or not. */
  total: number
}

export function distanceCoverage(places: ResumePlace[]): DistanceCoverage {
  const counts = new Map<string, { places: number; pinned: number }>()

  for (const place of places) {
    const trip = counts.get(place.tripId) ?? { places: 0, pinned: 0 }
    trip.places += 1
    if (place.lat !== null && place.lng !== null) trip.pinned += 1
    counts.set(place.tripId, trip)
  }

  const trips = [...counts.values()]
  return {
    measured: trips.filter((t) => t.pinned >= 2).length,
    measurable: trips.filter((t) => t.places >= 2).length,
    total: trips.length,
  }
}

/**
 * Years travelling, counted as distinct calendar years with a trip in them.
 *
 * Not "last year minus first year": someone who travelled in 2019 and again in
 * 2026 has two years of travel on record, not eight.
 */
export function yearsTravelling(dates: (string | null)[]): number {
  const years = new Set<number>()
  for (const date of dates) {
    if (!date) continue
    const year = Number(date.slice(0, 4))
    if (Number.isFinite(year) && year > 1900) years.add(year)
  }
  return years.size
}

/**
 * The line under the resume's distance counter.
 *
 * The card has room for about five words, so this is the short form of the
 * sentence the analytics screen spells out. `null` coverage is the public
 * profile: coordinates are never exposed to a visitor, so the dash there means
 * "withheld" and not "unmeasured", and saying "needs pinned places" to somebody
 * who cannot pin anything would be nonsense.
 */
export function distanceCoverageNote(coverage: DistanceCoverage | null): string {
  if (coverage === null) return 'Not shown publicly'
  if (coverage.total === 0) return 'Needs pinned places'
  if (coverage.measurable === 0) return 'Needs a second stop'
  if (coverage.measured === 0) return `0 of ${coverage.measurable} trips pinned`
  if (coverage.measured < coverage.measurable) {
    return `Approximate · ${coverage.measured} of ${coverage.measurable} trips`
  }
  return 'Approximate'
}

/** Formats a distance for display, or the honest dash when there is none. */
export function formatDistance(km: number | null): string {
  if (km === null) return '—'
  if (km < 1000) return `${km} km`
  return `${Math.round(km / 1000).toLocaleString('en-IN')}k km`
}
