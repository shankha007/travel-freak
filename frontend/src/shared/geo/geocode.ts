/**
 * Place search, for the map picker.
 *
 * MapTiler's geocoder, called from the browser with the same public key the
 * basemap uses. There is nothing to proxy: the key is already in the client
 * bundle by design, and routing search through a Route Handler would add a hop
 * without hiding anything.
 *
 * Search is a convenience, never the only way to set a pin. Without a key —
 * which is the local default — `canSearchPlaces()` is false and the picker says
 * so, leaving click-to-place, which needs no service at all. Same stance as the
 * basemap: a missing key degrades the map, it does not break it.
 */

export interface GeocodeResult {
  /** Stable id from the provider, used as a React key. */
  id: string
  /** Short name — usually the city or feature itself. */
  name: string
  /** Full label including region and country, for disambiguation. */
  context: string
  lng: number
  lat: number
  /** ISO 3166-1 alpha-3, when the provider knows it. */
  countryCode: string | null
}

export function canSearchPlaces(key: string | undefined): boolean {
  return Boolean(key)
}

interface MapTilerFeature {
  id?: unknown
  text?: unknown
  place_name?: unknown
  center?: unknown
  properties?: { country_code?: unknown } | null
  context?: { id?: unknown; text?: unknown }[] | null
}

/**
 * Turns one provider feature into a result, or null if it is unusable.
 *
 * The provider's alpha-2 country code is *not* converted here: the app keys
 * everything on alpha-3, and the conversion table lives in `countries.ts`. This
 * returns whatever code came back and lets the caller resolve it, so a feature
 * with an unknown country is still a usable pin.
 */
function toResult(feature: MapTilerFeature): GeocodeResult | null {
  const center = feature.center
  if (!Array.isArray(center) || typeof center[0] !== 'number' || typeof center[1] !== 'number') {
    return null
  }

  const name = typeof feature.text === 'string' ? feature.text : null
  const placeName = typeof feature.place_name === 'string' ? feature.place_name : null
  if (!name && !placeName) return null

  const rawCountry = feature.properties?.country_code
  const country = typeof rawCountry === 'string' && rawCountry ? rawCountry.toUpperCase() : null

  return {
    id: String(feature.id ?? `${center[0]},${center[1]}`),
    name: name ?? (placeName as string),
    context: placeName ?? (name as string),
    lng: center[0],
    lat: center[1],
    countryCode: country,
  }
}

/**
 * Searches for a place by name.
 *
 * Returns an empty list for anything that goes wrong — no key, a network
 * failure, a rate limit, an unexpected body. The picker treats "no results" and
 * "search is unavailable" the same way on purpose: both leave the user with the
 * map, which is the part that always works.
 */
export async function searchPlaces(
  query: string,
  key: string | undefined,
  options: { signal?: AbortSignal; limit?: number } = {}
): Promise<GeocodeResult[]> {
  const trimmed = query.trim()
  if (!trimmed || !key) return []

  const url =
    `https://api.maptiler.com/geocoding/${encodeURIComponent(trimmed)}.json` +
    `?key=${encodeURIComponent(key)}&limit=${options.limit ?? 5}&types=place,municipality,region,country,poi`

  try {
    const response = await fetch(url, { signal: options.signal })
    if (!response.ok) return []

    const body: unknown = await response.json()
    const features = (body as { features?: unknown }).features
    if (!Array.isArray(features)) return []

    return features
      .map((f) => toResult(f as MapTilerFeature))
      .filter((r): r is GeocodeResult => r !== null)
  } catch {
    return []
  }
}
