import { describe, expect, it } from 'vitest'
import {
  UNVISITED_OPACITY,
  fillColorExpression,
  fillOpacityExpression,
  lineWidthExpression,
} from './map-paint'
import type { RegionState } from './region-state'

const COLORS: Record<RegionState, string> = {
  visited: 'rgba(0, 128, 0, 1)',
  current: 'rgba(0, 0, 255, 1)',
  planned: 'rgba(255, 200, 0, 1)',
  unvisited: 'rgba(200, 200, 200, 1)',
}

/**
 * MapLibre evaluates these on the GPU, so the tests check the shape rather than
 * the rendering: an expression that reads `feature-state` without a coalesce is
 * the bug that makes every unvisited country vanish, and it is invisible in
 * TypeScript.
 */
describe('fillColorExpression', () => {
  it('matches on region state with the unvisited colour as the fallback', () => {
    const expression = fillColorExpression(COLORS)

    expect(expression[0]).toBe('match')
    expect(expression.at(-1)).toBe(COLORS.unvisited)
    expect(expression).toContain(COLORS.visited)
    expect(expression).toContain(COLORS.current)
    expect(expression).toContain(COLORS.planned)
  })

  it('defaults a feature with no state rather than reading null', () => {
    // ['coalesce', ['feature-state', 'region'], 'unvisited'] — without this,
    // every country the user has never visited resolves to null and disappears.
    const [, input] = fillColorExpression(COLORS)

    expect(input).toEqual(['coalesce', ['feature-state', 'region'], 'unvisited'])
  })
})

describe('fillOpacityExpression', () => {
  it('gives regions with no data the receding opacity', () => {
    const expression = fillOpacityExpression()

    expect(expression[0]).toBe('case')
    expect(expression[2]).toBe(UNVISITED_OPACITY)
  })

  it('ramps with visit count but caps it', () => {
    const [, , , ramp] = fillOpacityExpression()

    // ['min', 0.95, ['+', base, ['*', perVisit, visits]]]
    expect(Array.isArray(ramp) && ramp[0]).toBe('min')
    expect(Array.isArray(ramp) && ramp[1]).toBeLessThanOrEqual(1)
  })

  it('treats a missing visit count as zero', () => {
    expect(JSON.stringify(fillOpacityExpression())).toContain(
      JSON.stringify(['coalesce', ['feature-state', 'visits'], 0])
    )
  })
})

describe('lineWidthExpression', () => {
  it('widens the border only for the hovered feature', () => {
    expect(lineWidthExpression(1.6, 0.4)).toEqual([
      'case',
      ['boolean', ['feature-state', 'hover'], false],
      1.6,
      0.4,
    ])
  })
})
