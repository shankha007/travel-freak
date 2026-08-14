import { describe, expect, it } from 'vitest'
import {
  project,
  ringsOf,
  splitByVisited,
  toPathData,
  type CountryShape,
  type Position,
} from './project'

const BOUNDS = { width: 360, height: 180 }

describe('project', () => {
  it('puts the antimeridian at the edges and Greenwich in the middle', () => {
    expect(project([-180, 0], BOUNDS)).toEqual([0, 90])
    expect(project([180, 0], BOUNDS)).toEqual([360, 90])
    expect(project([0, 0], BOUNDS)).toEqual([180, 90])
  })

  it('puts north at the top, because SVG y grows the other way', () => {
    const [, northY] = project([0, 60], BOUNDS)
    const [, southY] = project([0, -60], BOUNDS)
    expect(northY).toBeLessThan(southY)
    expect(project([0, 90], BOUNDS)).toEqual([180, 0])
  })

  it('scales to whatever size it is given', () => {
    expect(project([0, 0], { width: 1200, height: 600 })).toEqual([600, 300])
  })
})

describe('toPathData', () => {
  const square: CountryShape = {
    code: 'AAA',
    rings: [
      [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
      ] as Position[],
    ],
  }

  it('closes every ring', () => {
    const d = toPathData([square], BOUNDS)
    expect(d.startsWith('M')).toBe(true)
    expect(d.endsWith('Z')).toBe(true)
    expect(d.match(/Z/g)).toHaveLength(1)
  })

  it('emits one path string for many shapes, not one each', () => {
    // Satori lays out every element it is handed; 177 of them is measurably
    // slower than one, and nothing here needs per-country styling.
    const d = toPathData([square, { ...square, code: 'BBB' }], BOUNDS)
    expect(d.match(/M/g)).toHaveLength(2)
    expect(d.match(/Z/g)).toHaveLength(2)
  })

  it('drops a ring that cannot enclose anything', () => {
    // Two points and a Z is a scratch across the map, not a country.
    const sliver: CountryShape = {
      code: 'CCC',
      rings: [
        [
          [0, 0],
          [1, 1],
        ] as Position[],
      ],
    }
    expect(toPathData([sliver], BOUNDS)).toBe('')
  })

  it('rounds, so the card does not carry six decimals per point', () => {
    const d = toPathData(
      [
        {
          code: 'AAA',
          rings: [
            [
              [1.23456789, 2.3456789],
              [3, 4],
              [5, 6],
            ] as Position[],
          ],
        },
      ],
      BOUNDS
    )
    expect(d).not.toMatch(/\d\.\d\d+/)
  })
})

describe('splitByVisited', () => {
  const shapes: CountryShape[] = [
    { code: 'IND', rings: [] },
    { code: 'JPN', rings: [] },
    { code: null, rings: [] },
  ]

  it('separates the visited from the rest', () => {
    const { base, highlighted } = splitByVisited(shapes, ['IND'])
    expect(highlighted.map((s) => s.code)).toEqual(['IND'])
    expect(base.map((s) => s.code)).toEqual(['JPN', null])
  })

  it('does not care about case on either side', () => {
    const { highlighted } = splitByVisited(shapes, ['ind', 'jpn'])
    expect(highlighted).toHaveLength(2)
  })

  it('keeps a shape with no code in the base rather than dropping it', () => {
    // A world with holes in it reads as a rendering bug, not as a territory
    // Natural Earth carries without an ISO entry.
    const { base } = splitByVisited(shapes, [])
    expect(base).toHaveLength(3)
  })

  it('loses nothing, whatever the input', () => {
    const { base, highlighted } = splitByVisited(shapes, ['IND', 'XXX'])
    expect(base.length + highlighted.length).toBe(shapes.length)
  })
})

describe('ringsOf', () => {
  it('takes a Polygon as it is', () => {
    const rings = ringsOf({ type: 'Polygon', coordinates: [[[0, 0]]] })
    expect(rings).toEqual([[[0, 0]]])
  })

  it('flattens a MultiPolygon into its rings', () => {
    const rings = ringsOf({
      type: 'MultiPolygon',
      coordinates: [[[[0, 0]]], [[[1, 1]]]],
    })
    expect(rings).toEqual([[[0, 0]], [[1, 1]]])
  })

  it('skips geometry that is not an area', () => {
    expect(ringsOf({ type: 'Point', coordinates: [0, 0] })).toEqual([])
    expect(ringsOf({ type: 'GeometryCollection', coordinates: [] })).toEqual([])
  })
})
