/**
 * Coordinates, on the way in and on the way out of PostGIS.
 *
 * `trip_places.location` is `geography(Point, 4326)`. PostgREST hands it back as
 * GeoJSON, but takes it as text — so a read and a write are not symmetrical, and
 * both directions live here rather than being re-derived at each call site.
 *
 * Anything unrecognised on the way in reads as "no coordinates" instead of
 * throwing: a place without a pin is an ordinary place, and a resume should not
 * fail to render because one row holds something unexpected.
 */

export interface LngLat {
  lng: number
  lat: number
}

/** Latitude and longitude within the ranges the earth actually has. */
export function isValidLngLat(value: { lng: number; lat: number }): boolean {
  return (
    Number.isFinite(value.lng) &&
    Number.isFinite(value.lat) &&
    value.lng >= -180 &&
    value.lng <= 180 &&
    value.lat >= -90 &&
    value.lat <= 90
  )
}

/** Reads a PostGIS point out of whatever PostgREST hands back. */
export function parsePoint(value: unknown): LngLat | null {
  // Selected directly, the column arrives as a GeoJSON object. Some clients
  // stringify it first, so a JSON string is accepted as the same thing.
  const candidate =
    typeof value === 'string'
      ? (() => {
          try {
            return JSON.parse(value) as unknown
          } catch {
            return null
          }
        })()
      : value

  if (!candidate || typeof candidate !== 'object') return null

  const point = candidate as { type?: string; coordinates?: unknown }
  if (point.type !== 'Point' || !Array.isArray(point.coordinates)) return null

  const [lng, lat] = point.coordinates
  if (typeof lng !== 'number' || typeof lat !== 'number') return null
  if (!isValidLngLat({ lng, lat })) return null

  return { lng, lat }
}

/**
 * The value to send when writing a point.
 *
 * EWKT rather than GeoJSON: `geography` parses EWKT natively, so Postgres casts
 * the text on the way in. GeoJSON would need `ST_GeomFromGeoJSON()`, which
 * PostgREST has no way to apply to a column value.
 *
 * The SRID is spelled out. Without it the value still casts — geography assumes
 * 4326 — but a stored geometry whose SRID is implicit is one migration away from
 * being wrong.
 */
export function toPointEwkt(value: LngLat): string {
  return `SRID=4326;POINT(${value.lng} ${value.lat})`
}

/** Coordinates for display, at roughly 10-metre precision. */
export function formatLngLat({ lng, lat }: LngLat): string {
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
}
