/**
 * Splitting polygons that cross the antimeridian.
 *
 * Natural Earth's TopoJSON stores Russia, Fiji and Antarctica as rings that
 * contain both -180 and +180. Converted straight to GeoJSON, two consecutive
 * vertices in such a ring are 360° apart, and a renderer joins them the only way
 * it can: with a segment straight across the entire map. On a map whose land is
 * a solid colour that is a stripe through the Pacific; on the old translucent
 * one it was faint enough to be mistaken for styling.
 *
 * The repair is per-ring and purely geometric:
 *
 *  1. **Unwrap.** Walk the ring adding or subtracting 360° whenever a step
 *     jumps more than half the world, which puts it in one continuous frame —
 *     Chukotka becomes 170°..190° instead of leaping to -170°.
 *  2. **Clip twice.** Cut that frame against `x <= 180` and against `x >= 180`,
 *     then shift the second piece back by 360°. Sutherland–Hodgman is exact
 *     here because a half-plane is convex.
 *
 * The result is a MultiPolygon of pieces that each stay inside [-180, 180], so
 * nothing has to cross anything. Rings that never cross are returned untouched.
 */

/** Longitude beyond which a step is a wrap rather than a move. */
const HALF_WORLD = 180

/** Does this ring step more than half the world between two vertices? */
export function ringCrossesAntimeridian(ring) {
  for (let i = 1; i < ring.length; i++) {
    if (Math.abs(ring[i][0] - ring[i - 1][0]) > HALF_WORLD) return true
  }
  return false
}

/**
 * Rewrites a ring into one continuous longitude frame.
 *
 * The first vertex stays where it is, so a ring that starts in the eastern
 * hemisphere stays there and its wrapped tail extends past +180 rather than the
 * whole ring shifting.
 */
export function unwrapRing(ring) {
  if (ring.length === 0) return []

  const out = [[...ring[0]]]
  let offset = 0

  for (let i = 1; i < ring.length; i++) {
    const delta = ring[i][0] - ring[i - 1][0]
    if (delta > HALF_WORLD) offset -= 360
    else if (delta < -HALF_WORLD) offset += 360

    out.push([ring[i][0] + offset, ring[i][1]])
  }

  return out
}

/**
 * Sutherland–Hodgman clip of a ring against a vertical half-plane.
 *
 * `keep` is 'left' for `x <= bound` or 'right' for `x >= bound`. Returns an
 * empty array when nothing survives, which is the normal answer for the half a
 * ring does not reach into.
 */
export function clipRingToHalfPlane(ring, bound, keep) {
  if (ring.length === 0) return []

  const inside = (point) => (keep === 'left' ? point[0] <= bound : point[0] >= bound)

  // Where the edge from a to b meets x = bound. Only called when the two ends
  // are on opposite sides, so the denominator cannot be zero.
  const intersect = (a, b) => {
    const t = (bound - a[0]) / (b[0] - a[0])
    return [bound, a[1] + t * (b[1] - a[1])]
  }

  const out = []
  for (let i = 0; i < ring.length; i++) {
    const current = ring[i]
    const previous = ring[(i + ring.length - 1) % ring.length]
    const currentIn = inside(current)
    const previousIn = inside(previous)

    if (currentIn) {
      if (!previousIn) out.push(intersect(previous, current))
      out.push([...current])
    } else if (previousIn) {
      out.push(intersect(previous, current))
    }
  }

  // Fewer than three distinct points is a sliver, not a polygon.
  return out.length >= 3 ? closeRing(out) : []
}

function closeRing(ring) {
  const first = ring[0]
  const last = ring[ring.length - 1]
  if (first[0] !== last[0] || first[1] !== last[1]) return [...ring, [...first]]
  return ring
}

/**
 * Does this ring go all the way round the world?
 *
 * Antarctica does. Its ring runs from -180 to +180 and closes along a constant
 * latitude, and that closing edge — a straight line across the bottom of the
 * map — is not an artifact but exactly how Mercator is supposed to draw a
 * landmass that encircles a pole. Splitting it would cut the continent in half
 * for nothing.
 */
export function ringEnclosesPole(unwrapped) {
  const xs = unwrapped.map(([x]) => x)
  return Math.max(...xs) - Math.min(...xs) >= 359.9
}

/** A piece with no width or no height is a seam, not a shape. */
function hasArea(ring) {
  if (ring.length < 4) return false
  const xs = ring.map(([x]) => x)
  const ys = ring.map(([, y]) => y)
  return Math.max(...xs) - Math.min(...xs) > 1e-9 && Math.max(...ys) - Math.min(...ys) > 1e-9
}

/** Both halves of one ring, each already inside [-180, 180]. */
export function splitRing(ring) {
  if (!ringCrossesAntimeridian(ring)) return [ring]

  const unwrapped = unwrapRing(ring)
  if (ringEnclosesPole(unwrapped)) return [ring]

  const west = clipRingToHalfPlane(unwrapped, HALF_WORLD, 'left')
  const eastRaw = clipRingToHalfPlane(unwrapped, HALF_WORLD, 'right')
  const east = eastRaw.map(([x, y]) => [x - 360, y])

  // A ring can also have been unwrapped the other way, running below -180.
  const farWestRaw = clipRingToHalfPlane(west, -HALF_WORLD, 'left')
  const farWest = farWestRaw.map(([x, y]) => [x + 360, y])
  const middle = clipRingToHalfPlane(west, -HALF_WORLD, 'right')

  // Clipping a ring that only touches the bound leaves a zero-width sliver.
  // Rendered, that is a hairline across the map — the very thing being fixed.
  return [middle, east, farWest].filter(hasArea)
}

/**
 * Splits every ring of a Polygon or MultiPolygon that crosses the antimeridian.
 *
 * Interior rings (holes) are carried through the same treatment and reattached
 * to the piece that contains them, by point-in-polygon on the hole's first
 * vertex. A hole whose parent did not survive is dropped rather than promoted
 * to an island.
 */
export function splitGeometry(geometry) {
  if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') return geometry

  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  const result = []

  for (const polygon of polygons) {
    const [outer, ...holes] = polygon
    const outerPieces = splitRing(outer)
    const holePieces = holes.flatMap((hole) => splitRing(hole))

    for (const piece of outerPieces) {
      const own = holePieces.filter((hole) => pointInRing(hole[0], piece))
      result.push([piece, ...own])
    }
  }

  if (result.length === 0) return geometry
  if (result.length === 1) return { type: 'Polygon', coordinates: result[0] }
  return { type: 'MultiPolygon', coordinates: result }
}

/** Ray casting. Used only to decide which piece a hole belongs to. */
export function pointInRing(point, ring) {
  const [x, y] = point
  let inside = false

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    const straddles = yi > y !== yj > y
    if (straddles && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }

  return inside
}

/** Repairs every feature in a collection, in place, and counts what it touched. */
export function splitFeatureCollection(collection) {
  let repaired = 0

  for (const feature of collection.features) {
    const before = JSON.stringify(feature.geometry.coordinates ?? null)
    feature.geometry = splitGeometry(feature.geometry)
    if (JSON.stringify(feature.geometry.coordinates ?? null) !== before) repaired += 1
  }

  return repaired
}
