import countries from 'i18n-iso-countries'
import en from 'i18n-iso-countries/langs/en.json'

countries.registerLocale(en)

/** A country polygon as prepared by scripts/build-geo.mjs. */
export interface CountryFeatureProperties {
  name: string
  /** ISO 3166-1 alpha-3. Null for entities Natural Earth includes without one. */
  iso_a3: string | null
  iso_num: string
}

export type CountryFeature = GeoJSON.Feature<GeoJSON.Geometry, CountryFeatureProperties>
export type CountryCollection = GeoJSON.FeatureCollection<
  GeoJSON.Geometry,
  CountryFeatureProperties
>

/** Path to the prepared polygons. Immutable, safe to cache forever. */
export const COUNTRIES_GEOJSON_URL = '/geo/countries-110m.geo.json'

/** Display name for an ISO 3166-1 alpha-3 code, falling back to the code. */
export function countryName(alpha3: string | null | undefined): string {
  if (!alpha3) return 'Unknown'
  return countries.getName(alpha3, 'en') ?? alpha3
}

/**
 * Flag emoji for an alpha-3 code.
 *
 * Built from the alpha-2 code by offsetting each letter into the Unicode
 * regional-indicator block. Returns an empty string when there is no alpha-2
 * equivalent, so callers should treat the flag as decorative and always render
 * the country name alongside it.
 */
export function countryFlag(alpha3: string | null | undefined): string {
  if (!alpha3) return ''
  const alpha2 = countries.alpha3ToAlpha2(alpha3)
  if (!alpha2 || alpha2.length !== 2) return ''
  const REGIONAL_INDICATOR_A = 0x1f1e6
  const LETTER_A = 'A'.charCodeAt(0)
  return String.fromCodePoint(
    ...[...alpha2.toUpperCase()].map((c) => REGIONAL_INDICATOR_A + (c.charCodeAt(0) - LETTER_A))
  )
}

/**
 * Splits an ISO 3166-2 region code into its country and subdivision parts.
 * `'IN-KA'` becomes `{ country: 'IND', subdivision: 'KA' }`.
 */
export function parseRegionCode(
  regionCode: string
): { country: string | null; subdivision: string } | null {
  const [alpha2, subdivision] = regionCode.split('-')
  if (!alpha2 || !subdivision) return null
  return { country: countries.alpha2ToAlpha3(alpha2) ?? null, subdivision }
}

/** Total number of sovereign countries, used for the "% of the world" stat. */
export const TOTAL_COUNTRIES = 195

export interface CountryOption {
  /** ISO 3166-1 alpha-3 — the code every table stores. */
  code: string
  name: string
  flag: string
}

/**
 * Every country, alphabetised, for pickers.
 *
 * Built once at module load rather than per render: the list is ~250 entries
 * and never changes within a session.
 */
export const ALL_COUNTRIES: CountryOption[] = Object.entries(
  countries.getNames('en', { select: 'official' })
)
  .map(([alpha2, name]) => ({
    code: countries.alpha2ToAlpha3(alpha2) ?? '',
    name,
    flag: countryFlag(countries.alpha2ToAlpha3(alpha2)),
  }))
  .filter((c) => c.code !== '')
  .sort((a, b) => a.name.localeCompare(b.name))

/** True when the code is a country we know about. Used to validate input. */
export function isKnownCountry(alpha3: string): boolean {
  return countries.alpha3ToAlpha2(alpha3) !== undefined
}
