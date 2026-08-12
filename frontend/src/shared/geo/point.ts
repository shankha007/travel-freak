/**
 * Coordinates, on the way in and on the way out of PostGIS.
 *
 * `trip_places.location` is `geography(Point, 4326)`, and the two directions are
 * not symmetrical:
 *
 *  - **Writing** sends EWKT text, which the column's input function parses.
 *  - **Reading** does not touch `location` at all. PostgREST serialises geography
 *    as hex EWKB — `0101000020E6100000…`, not GeoJSON — so the app reads the
 *    `latitude` and `longitude` columns generated from it (migration
 *    `20260813000500`) and gets plain numbers.
 *
 * That asymmetry is the whole reason this file exists: it is the one place that
 * knows the answer, so no call site has to.
 *
 * A row with no pin is an ordinary row, so a missing or nonsensical coordinate
 * reads as "no coordinates" rather than throwing.
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

/**
 * Reads a pin from the generated columns.
 *
 * Both are null together — they are generated from the same `location` — but this
 * accepts them separately because that is how a row arrives, and returns null
 * unless both are present and plausible.
 */
export function pointFrom(
  latitude: number | null | undefined,
  longitude: number | null | undefined
): LngLat | null {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null
  const point = { lng: longitude, lat: latitude }
  return isValidLngLat(point) ? point : null
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
