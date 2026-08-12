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

/** Formats a distance for display, or the honest dash when there is none. */
export function formatDistance(km: number | null): string {
  if (km === null) return '—'
  if (km < 1000) return `${km} km`
  return `${Math.round(km / 1000).toLocaleString('en-IN')}k km`
}
