/**
 * A world map flat enough to draw inside a share card — screen 38.
 *
 * Equirectangular, which is to say the crudest projection there is: longitude
 * becomes x and latitude becomes y, linearly. On a globe that would be wrong
 * enough to matter. At 1200 pixels wide, seen in a chat window, behind a
 * headline, it is a recognisable world — and it costs two multiplications per
 * point rather than a projection library.
 *
 * The output is SVG path data, because Satori (what `ImageResponse` renders
 * through) supports inline SVG and nothing else that could draw a map.
 *
 * Pure, and separated from the file that loads the geometry, so the arithmetic
 * can be tested on four made-up countries instead of on 177 real ones.
 */

export interface Bounds {
  width: number
  height: number
}

export type Position = [number, number]

export interface CountryShape {
  /** ISO 3166-1 alpha-3, or null for the entities Natural Earth has without one. */
  code: string | null
  /** Polygon rings, already flattened out of Polygon/MultiPolygon. */
  rings: Position[][]
}

/**
 * Longitude/latitude to x/y inside `bounds`.
 *
 * Latitude is inverted because SVG's y axis grows downward and the northern
 * hemisphere does not.
 */
export function project([lng, lat]: Position, bounds: Bounds): [number, number] {
  const x = ((lng + 180) / 360) * bounds.width
  const y = ((90 - lat) / 180) * bounds.height
  return [x, y]
}

/** How many decimal places the path data keeps. Two is sub-pixel at this size. */
const PRECISION = 1

function round(n: number): string {
  return n.toFixed(PRECISION).replace(/\.0$/, '')
}

/**
 * Every ring of every shape, as one `d` attribute.
 *
 * One path for many countries rather than one path each, deliberately: Satori
 * lays out each element it is given, and a card that hands it 177 of them takes
 * appreciably longer to render than one that hands it two. Nothing here needs
 * per-country styling — the split into "visited" and "the rest" is the only
 * distinction a card makes, and that is two paths.
 *
 * Rings shorter than three points are dropped: they cannot enclose anything,
 * and `Z` on a two-point ring draws a line that reads as a scratch on the map.
 */
export function toPathData(shapes: CountryShape[], bounds: Bounds): string {
  const parts: string[] = []

  for (const shape of shapes) {
    for (const ring of shape.rings) {
      if (ring.length < 3) continue

      const points = ring.map((position) => project(position, bounds))
      const [first, ...rest] = points

      parts.push(
        `M${round(first[0])} ${round(first[1])}` +
          rest.map(([x, y]) => `L${round(x)} ${round(y)}`).join('') +
          'Z'
      )
    }
  }

  return parts.join('')
}

/**
 * Splits the world into the countries someone has been to and everything else.
 *
 * Matching is on the alpha-3 code, upper-cased on both sides. A shape with no
 * code can never be visited — it is a territory Natural Earth carries without
 * an ISO entry — so it always lands in the base layer rather than being
 * dropped, because the world with holes in it looks like a rendering bug.
 */
export function splitByVisited(
  shapes: CountryShape[],
  visited: Iterable<string>
): { base: CountryShape[]; highlighted: CountryShape[] } {
  const codes = new Set([...visited].map((c) => c.toUpperCase()))

  const base: CountryShape[] = []
  const highlighted: CountryShape[] = []

  for (const shape of shapes) {
    const code = shape.code?.toUpperCase()
    if (code && codes.has(code)) highlighted.push(shape)
    else base.push(shape)
  }

  return { base, highlighted }
}

/** Pulls the rings out of a GeoJSON geometry, flattening MultiPolygon. */
export function ringsOf(geometry: { type: string; coordinates: unknown }): Position[][] {
  if (geometry.type === 'Polygon') {
    return geometry.coordinates as Position[][]
  }
  if (geometry.type === 'MultiPolygon') {
    return (geometry.coordinates as Position[][][]).flat()
  }
  // Points and lines are not countries; anything else is data we did not expect
  // and would rather skip than draw wrong.
  return []
}
