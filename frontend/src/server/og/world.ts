import 'server-only'

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { ringsOf, splitByVisited, toPathData, type CountryShape } from '@/shared/geo/project'

/**
 * The country outlines a share card is drawn from — screen 38.
 *
 * Read off disk rather than fetched over HTTP. The file is already in `public/`
 * for the maps, so the bytes ship either way; reading them directly means a
 * card does not depend on the app being able to reach itself, which is a
 * request that fails in exactly the deployments where you least want to debug
 * it.
 *
 * Parsed once per process and kept. 432KB of JSON is not something to do per
 * card, and the outlines of the world do not change between requests.
 */

let cached: Promise<CountryShape[]> | null = null

interface GeoFeature {
  properties?: { iso_a3?: string | null }
  geometry?: { type: string; coordinates: unknown }
}

async function loadShapes(): Promise<CountryShape[]> {
  const file = path.join(process.cwd(), 'public', 'geo', 'countries-110m.geo.json')
  const raw = await readFile(file, 'utf8')
  const collection = JSON.parse(raw) as { features?: GeoFeature[] }

  return (collection.features ?? []).map((feature) => ({
    code: feature.properties?.iso_a3 ?? null,
    rings: feature.geometry ? ringsOf(feature.geometry) : [],
  }))
}

export function countryShapes(): Promise<CountryShape[]> {
  // The promise itself is cached, not its result: two cards rendered at once on
  // a cold start would otherwise both read and parse the file.
  cached ??= loadShapes().catch((error) => {
    // Cleared so a transient failure is retried rather than remembered forever.
    cached = null
    throw error
  })
  return cached
}

export interface WorldPaths {
  /** Every country nobody has been to, as one path. */
  base: string
  /** The visited ones, as one more. Empty when there are none. */
  highlighted: string
}

/**
 * The two path strings a card draws.
 *
 * Returns empty strings rather than throwing when the geometry cannot be read.
 * A share card with no map is a worse card; a share card that 500s is no card
 * at all, and the crawler that asked for it does not come back.
 */
export async function worldPaths(
  visited: Iterable<string>,
  bounds: { width: number; height: number }
): Promise<WorldPaths> {
  let shapes: CountryShape[]
  try {
    shapes = await countryShapes()
  } catch {
    return { base: '', highlighted: '' }
  }

  const split = splitByVisited(shapes, visited)

  return {
    base: toPathData(split.base, bounds),
    highlighted: toPathData(split.highlighted, bounds),
  }
}
