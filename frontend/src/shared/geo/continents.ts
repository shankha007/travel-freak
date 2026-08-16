/**
 * Which continent a country is on.
 *
 * A static table rather than a property on the geometry, because the map's
 * filter has to answer for a country whose polygon has not been fetched — the
 * region list is filtered too, and it is the half of the screen that works
 * without WebGL. Rebuilding `countries-110m.geo.json` to carry the field would
 * also have put the answer behind `npm run build:geo`, which is the one step in
 * this repo that needs the network.
 *
 * Grouped by continent rather than written as 250 single-line entries: the
 * groups are reviewable, a stray code is visible, and `continents.test.ts`
 * proves the coverage is complete and non-overlapping against the same country
 * list every picker in the app uses.
 *
 * Dependencies and overseas territories sit with the continent they are *on*,
 * not the one that governs them — Réunion is in Africa, French Guiana in South
 * America. Somebody filtering their map by continent is asking where they have
 * been, not whose flag flies there.
 */

export const CONTINENTS = ['AF', 'AS', 'EU', 'NA', 'SA', 'OC', 'AN'] as const

export type Continent = (typeof CONTINENTS)[number]

export const CONTINENT_LABEL: Record<Continent, string> = {
  AF: 'Africa',
  AS: 'Asia',
  EU: 'Europe',
  NA: 'North America',
  SA: 'South America',
  OC: 'Oceania',
  AN: 'Antarctica',
}

/** ISO 3166-1 alpha-3 codes, by continent. */
// prettier-ignore
const COUNTRIES_BY_CONTINENT: Record<Continent, string[]> = {
  AF: [
    'AGO', 'BDI', 'BEN', 'BFA', 'BWA', 'CAF', 'CIV', 'CMR', 'COD', 'COG',
    'COM', 'CPV', 'DJI', 'DZA', 'EGY', 'ERI', 'ESH', 'ETH', 'GAB', 'GHA',
    'GIN', 'GMB', 'GNB', 'GNQ', 'KEN', 'LBR', 'LBY', 'LSO', 'MAR', 'MDG',
    'MLI', 'MOZ', 'MRT', 'MUS', 'MWI', 'MYT', 'NAM', 'NER', 'NGA', 'REU',
    'RWA', 'SDN', 'SEN', 'SHN', 'SLE', 'SOM', 'SSD', 'STP', 'SWZ', 'SYC',
    'TCD', 'TGO', 'TUN', 'TZA', 'UGA', 'ZAF', 'ZMB', 'ZWE',
  ],
  AS: [
    'AFG', 'ARE', 'ARM', 'AZE', 'BGD', 'BHR', 'BRN', 'BTN', 'CCK', 'CHN',
    'CXR', 'CYP', 'GEO', 'HKG', 'IDN', 'IND', 'IOT', 'IRN', 'IRQ', 'ISR',
    'JOR', 'JPN', 'KAZ', 'KGZ', 'KHM', 'KOR', 'KWT', 'LAO', 'LBN', 'LKA',
    'MAC', 'MDV', 'MMR', 'MNG', 'MYS', 'NPL', 'OMN', 'PAK', 'PHL', 'PRK',
    'PSE', 'QAT', 'SAU', 'SGP', 'SYR', 'THA', 'TJK', 'TKM', 'TLS', 'TUR',
    'TWN', 'UZB', 'VNM', 'YEM',
  ],
  EU: [
    'ALA', 'ALB', 'AND', 'AUT', 'BEL', 'BGR', 'BIH', 'BLR', 'CHE', 'CZE',
    'DEU', 'DNK', 'ESP', 'EST', 'FIN', 'FRA', 'FRO', 'GBR', 'GGY', 'GIB',
    'GRC', 'HRV', 'HUN', 'IMN', 'IRL', 'ISL', 'ITA', 'JEY', 'LIE', 'LTU',
    'LUX', 'LVA', 'MCO', 'MDA', 'MKD', 'MLT', 'MNE', 'NLD', 'NOR', 'POL',
    'PRT', 'ROU', 'RUS', 'SJM', 'SMR', 'SRB', 'SVK', 'SVN', 'SWE', 'UKR',
    'VAT', 'XKK',
  ],
  NA: [
    'ABW', 'AIA', 'ATG', 'BES', 'BHS', 'BLM', 'BLZ', 'BMU', 'BRB', 'CAN',
    'CRI', 'CUB', 'CUW', 'CYM', 'DMA', 'DOM', 'GLP', 'GRD', 'GRL', 'GTM',
    'HND', 'HTI', 'JAM', 'KNA', 'LCA', 'MAF', 'MEX', 'MSR', 'MTQ', 'NIC',
    'PAN', 'PRI', 'SLV', 'SPM', 'SXM', 'TCA', 'TTO', 'USA', 'VCT', 'VGB',
    'VIR',
  ],
  SA: [
    'ARG', 'BOL', 'BRA', 'CHL', 'COL', 'ECU', 'FLK', 'GUF', 'GUY', 'PER',
    'PRY', 'SGS', 'SUR', 'URY', 'VEN',
  ],
  OC: [
    'ASM', 'AUS', 'COK', 'FJI', 'FSM', 'GUM', 'HMD', 'KIR', 'MHL', 'MNP',
    'NCL', 'NFK', 'NIU', 'NRU', 'NZL', 'PCN', 'PLW', 'PNG', 'PYF', 'SLB',
    'TKL', 'TON', 'TUV', 'UMI', 'VUT', 'WLF', 'WSM',
  ],
  AN: ['ATA', 'ATF', 'BVT'],
}

/** Built once: the lookup is per country per render otherwise. */
const CONTINENT_BY_COUNTRY: Map<string, Continent> = new Map(
  CONTINENTS.flatMap((continent) =>
    COUNTRIES_BY_CONTINENT[continent].map((code) => [code, continent] as const)
  )
)

/**
 * The continent a country is on, or null for a code this table does not know.
 *
 * Null rather than a guess: a filter that silently drops an unrecognised
 * country would make somebody's trip vanish from their own map, which is worse
 * than a filter that admits it has nothing to say.
 */
export function continentOf(alpha3: string): Continent | null {
  return CONTINENT_BY_COUNTRY.get(alpha3) ?? null
}

/** For tests, and for anything that needs to enumerate the table. */
export function allMappedCountries(): string[] {
  return [...CONTINENT_BY_COUNTRY.keys()]
}
