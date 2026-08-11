/**
 * Prepares the country polygons the globe and world map render.
 *
 * Source is the `world-atlas` package (Natural Earth, pinned as a dependency
 * rather than fetched at build time). We convert TopoJSON to GeoJSON once, here,
 * and attach the ISO 3166-1 alpha-3 code to every feature — that code is the
 * join key against visited_regions, so doing it now keeps the client from having
 * to resolve it on every render.
 *
 * Output goes to public/geo/ and is served with immutable cache headers.
 *
 * Run with: npm run build:geo
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { feature } from 'topojson-client'
import countries from 'i18n-iso-countries'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = resolve(here, '../public/geo')

/** 110m is the lowest-detail Natural Earth tier — the right trade for a globe. */
const SOURCE = 'world-atlas/countries-110m.json'

const topology = JSON.parse(readFileSync(resolve(here, '../node_modules', SOURCE), 'utf8'))
const geo = feature(topology, topology.objects.countries)

let missing = 0
for (const f of geo.features) {
  // world-atlas ids are numeric ISO 3166-1 codes, as strings.
  const alpha3 = countries.numericToAlpha3(String(f.id))
  if (!alpha3) missing += 1

  f.properties = {
    name: f.properties?.name ?? 'Unknown',
    iso_a3: alpha3 ?? null,
    iso_num: String(f.id),
  }
  // Drop the top-level id; everything downstream keys off properties.iso_a3.
  delete f.id
}

mkdirSync(outDir, { recursive: true })
const outFile = resolve(outDir, 'countries-110m.geo.json')
writeFileSync(outFile, JSON.stringify(geo))

const bytes = readFileSync(outFile).length
console.log(
  `Wrote ${geo.features.length} countries to public/geo/countries-110m.geo.json ` +
    `(${(bytes / 1024).toFixed(0)} KB)`
)
if (missing > 0) {
  // Natural Earth includes a few entities without an ISO code (e.g. N. Cyprus,
  // Somaliland). They render in the unvisited state and are not clickable.
  console.log(`  ${missing} feature(s) have no ISO alpha-3 code and will not be selectable.`)
}
