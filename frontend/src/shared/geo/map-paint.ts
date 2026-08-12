import type { ExpressionSpecification } from 'maplibre-gl'
import type { RegionState } from '@/shared/geo/region-state'

/**
 * The paint expressions that colour the map's fills.
 *
 * Kept out of the component because they are pure data: MapLibre evaluates them
 * on the GPU against `feature-state`, so the same expression serves both the
 * country layer and the subdivision layer, and both can be unit-tested without
 * a WebGL context.
 *
 * `feature-state` is null for any feature the data has nothing to say about,
 * which is most of the world — that case has to be handled first in every
 * expression here, or unvisited countries render as `null` and disappear.
 */

/** Opacity for regions with no data, so the world stays visible but recedes. */
export const UNVISITED_OPACITY = 0.25

/** Ceiling on the visit-count ramp, so a well-travelled country stays readable. */
const MAX_OPACITY = 0.95
const BASE_OPACITY = 0.55
const PER_VISIT = 0.1

export function fillColorExpression(colors: Record<RegionState, string>): ExpressionSpecification {
  return [
    'match',
    ['coalesce', ['feature-state', 'region'], 'unvisited'],
    'visited',
    colors.visited,
    'current',
    colors.current,
    'planned',
    colors.planned,
    colors.unvisited,
  ]
}

/**
 * Repeat visits read as progressively more solid, the same rule the globe uses:
 * a country you keep returning to should not look like one you passed through.
 */
export function fillOpacityExpression(): ExpressionSpecification {
  return [
    'case',
    ['==', ['coalesce', ['feature-state', 'region'], 'unvisited'], 'unvisited'],
    UNVISITED_OPACITY,
    [
      'min',
      MAX_OPACITY,
      ['+', BASE_OPACITY, ['*', PER_VISIT, ['coalesce', ['feature-state', 'visits'], 0]]],
    ],
  ]
}

/** Border colour, lifted for the region under the cursor. */
export function lineWidthExpression(
  hoverWidth: number,
  baseWidth: number
): ExpressionSpecification {
  return ['case', ['boolean', ['feature-state', 'hover'], false], hoverWidth, baseWidth]
}

/**
 * The soft halo drawn just inside a region's border.
 *
 * Only regions with data get one — a glow on all 195 countries is a blur, not an
 * accent — and the one under the cursor gets more of it, which is what makes the
 * map feel like it is responding rather than repainting.
 */
export function glowOpacityExpression(
  hoverOpacity = 0.55,
  baseOpacity = 0.28
): ExpressionSpecification {
  return [
    'case',
    ['==', ['coalesce', ['feature-state', 'region'], 'unvisited'], 'unvisited'],
    0,
    ['boolean', ['feature-state', 'hover'], false],
    hoverOpacity,
    baseOpacity,
  ]
}

/**
 * Border colour that follows the region's own state.
 *
 * A single grey stroke over every polygon is what made the fills read as flat
 * paper. A visited country outlined in its own colour reads as one object.
 */
export function lineColorExpression(
  colors: Record<RegionState, string>,
  unvisited: string
): ExpressionSpecification {
  return [
    'match',
    ['coalesce', ['feature-state', 'region'], 'unvisited'],
    'visited',
    colors.visited,
    'current',
    colors.current,
    'planned',
    colors.planned,
    unvisited,
  ]
}
