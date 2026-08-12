/**
 * Subdivision (admin-1) polygons — states and provinces.
 *
 * Prepared by `scripts/build-geo.mjs` into one file per country, because the
 * whole world's subdivisions are far more than a browser looking at three
 * countries should download. The map fetches only the countries it is about to
 * draw.
 *
 * Coverage today is Natural Earth's 50m admin-1 set, which carries ISO 3166-2
 * codes for nine large countries: Australia, Brazil, Canada, China, India,
 * Indonesia, Russia, South Africa and the United States. Extending that is the
 * plan's v1.1 item "province-level maps for more countries"; the loader below
 * already behaves correctly for a country with no file, so adding data later
 * needs no code change.
 */

export interface Admin1FeatureProperties {
  /** ISO 3166-2, e.g. 'IN-KA'. The join key against `visited_regions`. */
  region_code: string
  /** ISO 3166-1 alpha-3 of the parent country. */
  iso_a3: string
  name: string
}

export type Admin1Feature = GeoJSON.Feature<GeoJSON.Geometry, Admin1FeatureProperties>
export type Admin1Collection = GeoJSON.FeatureCollection<GeoJSON.Geometry, Admin1FeatureProperties>

/** One row of `/geo/admin1/index.json`. */
export interface Admin1IndexEntry {
  iso_a3: string
  regions: number
  bytes: number
}

export const ADMIN1_INDEX_URL = '/geo/admin1/index.json'

export function admin1Url(alpha3: string): string {
  return `/geo/admin1/${alpha3}.geo.json`
}

/**
 * The country whose subdivisions are free on every plan.
 *
 * India's map is a headline free feature; everywhere else, admin-1 is the paid
 * upgrade. Keeping it named here means the entitlement check reads the same way
 * on the map, the globe and the server.
 */
export const FREE_ADMIN1_COUNTRY = 'IND'

/** An empty collection, for the "no data for this country" case. */
export const EMPTY_ADMIN1: Admin1Collection = { type: 'FeatureCollection', features: [] }
