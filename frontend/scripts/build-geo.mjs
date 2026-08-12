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
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { feature } from 'topojson-client'
import countries from 'i18n-iso-countries'
import mapshaper from 'mapshaper'

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

// ---------------------------------------------------------------------------
// Admin-1: states and provinces, split one file per country
//
// The whole world's subdivisions are far too much to send to a browser that is
// looking at three countries, so this writes one file per country and the map
// fetches only what it needs. India's is the one that ships to everyone — the
// India map is free on every plan; the rest are the paid globe/map detail.
//
// Source is Natural Earth 50m at a pinned tag. Unlike the country outlines
// there is no npm package for it, so the download is cached under
// node_modules/.cache and the *output* is committed, which keeps ordinary
// builds offline.
// ---------------------------------------------------------------------------

const NE_TAG = 'v5.1.2'
const NE_ADMIN1_URL =
  `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/${NE_TAG}` +
  `/geojson/ne_50m_admin_1_states_provinces.geojson`

const cacheDir = resolve(here, '../node_modules/.cache/travel-geo')
const cacheFile = resolve(cacheDir, `ne_50m_admin_1_${NE_TAG}.geojson`)

async function loadAdmin1Source() {
  if (existsSync(cacheFile)) {
    return readFileSync(cacheFile, 'utf8')
  }

  console.log(`Fetching Natural Earth admin-1 (${NE_TAG})…`)
  const response = await fetch(NE_ADMIN1_URL)
  if (!response.ok) {
    throw new Error(`Could not download admin-1 source: ${response.status} ${response.statusText}`)
  }

  const text = await response.text()
  mkdirSync(cacheDir, { recursive: true })
  writeFileSync(cacheFile, text)
  return text
}

const raw = await loadAdmin1Source()

// Simplify before splitting so shared borders between two states stay coincident
// — simplifying each country separately leaves visible gaps along its edges.
// 4% is inside the 2–5% the plan calls for and keeps recognisable coastlines.
const simplified = await mapshaper.applyCommands(
  '-i admin1.geojson -simplify 4% keep-shapes -o out.geojson',
  { 'admin1.geojson': raw }
)

const admin1 = JSON.parse(new TextDecoder().decode(simplified['out.geojson']))

const byCountry = new Map()
let unnamed = 0

for (const f of admin1.features) {
  const props = f.properties ?? {}
  const iso3 = props.adm0_a3
  // `iso_3166_2` is the join key against visited_regions.region_code. Natural
  // Earth leaves it blank for disputed or unassigned areas; those render as
  // part of the country fill instead.
  const regionCode = props.iso_3166_2
  if (!iso3 || !regionCode) {
    unnamed += 1
    continue
  }

  f.properties = {
    region_code: regionCode,
    iso_a3: iso3,
    name: props.name ?? props.name_en ?? regionCode,
  }

  byCountry.set(iso3, [...(byCountry.get(iso3) ?? []), f])
}

const admin1Dir = resolve(outDir, 'admin1')
mkdirSync(admin1Dir, { recursive: true })

const index = []
let admin1Bytes = 0

for (const [iso3, features] of [...byCountry].sort(([a], [b]) => a.localeCompare(b))) {
  const collection = { type: 'FeatureCollection', features }
  const file = resolve(admin1Dir, `${iso3}.geo.json`)
  writeFileSync(file, JSON.stringify(collection))

  const size = readFileSync(file).length
  admin1Bytes += size
  index.push({ iso_a3: iso3, regions: features.length, bytes: size })
}

// An index rather than probing for 404s: the map needs to know which countries
// have subdivision data before it decides whether to fetch anything.
writeFileSync(resolve(admin1Dir, 'index.json'), JSON.stringify(index))

console.log(
  `Wrote admin-1 for ${index.length} countries to public/geo/admin1/ ` +
    `(${(admin1Bytes / 1024).toFixed(0)} KB total, largest ` +
    `${Math.max(...index.map((i) => i.bytes / 1024)).toFixed(0)} KB)`
)
if (unnamed > 0) {
  console.log(`  ${unnamed} subdivision(s) have no ISO 3166-2 code and were skipped.`)
}
