import { describe, expect, it } from 'vitest'
import {
  clipRingToHalfPlane,
  pointInRing,
  ringCrossesAntimeridian,
  splitFeatureCollection,
  splitGeometry,
  splitRing,
  unwrapRing,
} from './antimeridian.mjs'

/** A box straddling the antimeridian, as Natural Earth stores such a thing. */
const CROSSING = [
  [170, 10],
  [-170, 10],
  [-170, -10],
  [170, -10],
  [170, 10],
]

/** An ordinary box in the Atlantic. */
const PLAIN = [
  [-20, 10],
  [-10, 10],
  [-10, -10],
  [-20, -10],
  [-20, 10],
]

const maxSpan = (ring) => {
  const xs = ring.map(([x]) => x)
  return Math.max(...xs) - Math.min(...xs)
}

describe('ringCrossesAntimeridian', () => {
  it('spots the 360° step', () => {
    expect(ringCrossesAntimeridian(CROSSING)).toBe(true)
  })

  it('leaves an ordinary ring alone', () => {
    expect(ringCrossesAntimeridian(PLAIN)).toBe(false)
  })

  it('does not mistake a wide country for a wrap', () => {
    // Brazil is ~40° across; nothing here should trip on width alone.
    expect(
      ringCrossesAntimeridian([
        [-74, 5],
        [-34, 5],
        [-34, -34],
        [-74, -34],
        [-74, 5],
      ])
    ).toBe(false)
  })
})

describe('unwrapRing', () => {
  it('puts a crossing ring in one continuous frame', () => {
    const unwrapped = unwrapRing(CROSSING)

    expect(unwrapped.map(([x]) => x)).toEqual([170, 190, 190, 170, 170])
    // The whole point: no step is longer than half the world any more.
    expect(ringCrossesAntimeridian(unwrapped)).toBe(false)
  })

  it('keeps the first vertex where it was', () => {
    expect(unwrapRing(CROSSING)[0]).toEqual([170, 10])
  })

  it('changes nothing when there is no crossing', () => {
    expect(unwrapRing(PLAIN)).toEqual(PLAIN)
  })
})

describe('clipRingToHalfPlane', () => {
  it('cuts a box at the bound and closes it', () => {
    const left = clipRingToHalfPlane(unwrapRing(CROSSING), 180, 'left')

    expect(left.every(([x]) => x <= 180)).toBe(true)
    expect(left[0]).toEqual(left[left.length - 1])
  })

  it('returns nothing when the ring is entirely on the other side', () => {
    expect(clipRingToHalfPlane(PLAIN, 180, 'right')).toEqual([])
  })

  it('returns the ring unchanged when it is entirely inside', () => {
    const clipped = clipRingToHalfPlane(PLAIN, 180, 'left')
    expect(clipped.map(([x]) => x)).toEqual(PLAIN.map(([x]) => x))
  })
})

describe('splitRing', () => {
  it('produces two pieces, each inside one hemisphere', () => {
    const pieces = splitRing(CROSSING)

    expect(pieces).toHaveLength(2)
    for (const piece of pieces) {
      expect(Math.max(...piece.map(([x]) => x))).toBeLessThanOrEqual(180)
      expect(Math.min(...piece.map(([x]) => x))).toBeGreaterThanOrEqual(-180)
      // Neither piece may still step across the map.
      expect(ringCrossesAntimeridian(piece)).toBe(false)
      expect(maxSpan(piece)).toBeLessThan(180)
    }
  })

  it('puts one piece against each edge of the map', () => {
    const [a, b] = splitRing(CROSSING)
    const spans = [a, b].map((r) => [
      Math.min(...r.map(([x]) => x)),
      Math.max(...r.map(([x]) => x)),
    ])

    expect(spans).toContainEqual([170, 180])
    expect(spans).toContainEqual([-180, -170])
  })

  it('leaves a ring that does not cross as a single piece', () => {
    expect(splitRing(PLAIN)).toEqual([PLAIN])
  })

  it('leaves a pole-enclosing ring whole', () => {
    // Antarctica, in miniature: right round the world and closed along one
    // latitude. Cutting it would halve the continent to remove an edge that is
    // the correct way to draw it.
    const antarctic = [
      [-180, -85],
      [-90, -70],
      [0, -75],
      [90, -70],
      [180, -85],
      [-180, -85],
    ]

    expect(splitRing(antarctic)).toEqual([antarctic])
  })

  it('drops the zero-width sliver a ring that only touches the bound leaves', () => {
    const touching = [
      [170, 10],
      [180, 10],
      [-180, -10],
      [170, -10],
      [170, 10],
    ]

    for (const piece of splitRing(touching)) {
      const xs = piece.map(([x]) => x)
      expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(0)
    }
  })
})

describe('splitGeometry', () => {
  it('turns a crossing Polygon into a MultiPolygon', () => {
    const out = splitGeometry({ type: 'Polygon', coordinates: [CROSSING] })

    expect(out.type).toBe('MultiPolygon')
    expect(out.coordinates).toHaveLength(2)
  })

  it('leaves an ordinary Polygon exactly as it was', () => {
    const geometry = { type: 'Polygon', coordinates: [PLAIN] }
    expect(splitGeometry(geometry)).toEqual({ type: 'Polygon', coordinates: [PLAIN] })
  })

  it('keeps a hole with the piece that contains it', () => {
    const hole = [
      [172, 5],
      [174, 5],
      [174, 3],
      [172, 3],
      [172, 5],
    ]
    const out = splitGeometry({ type: 'Polygon', coordinates: [CROSSING, hole] })

    const withHole = out.coordinates.filter((polygon) => polygon.length > 1)
    expect(withHole).toHaveLength(1)
    // And it stayed on the eastern piece, where its coordinates are.
    expect(Math.min(...withHole[0][0].map(([x]) => x))).toBeGreaterThan(0)
  })

  it('passes non-polygon geometry straight through', () => {
    const point = { type: 'Point', coordinates: [1, 2] }
    expect(splitGeometry(point)).toBe(point)
  })
})

describe('splitFeatureCollection', () => {
  it('repairs only the features that need it, and reports how many', () => {
    const collection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { name: 'Crosses' },
          geometry: { type: 'Polygon', coordinates: [CROSSING] },
        },
        {
          type: 'Feature',
          properties: { name: 'Plain' },
          geometry: { type: 'Polygon', coordinates: [PLAIN] },
        },
      ],
    }

    expect(splitFeatureCollection(collection)).toBe(1)
    expect(collection.features[0].geometry.type).toBe('MultiPolygon')
    expect(collection.features[1].geometry).toEqual({ type: 'Polygon', coordinates: [PLAIN] })
  })
})

describe('pointInRing', () => {
  it('answers inside and outside', () => {
    expect(pointInRing([-15, 0], PLAIN)).toBe(true)
    expect(pointInRing([0, 0], PLAIN)).toBe(false)
  })
})
