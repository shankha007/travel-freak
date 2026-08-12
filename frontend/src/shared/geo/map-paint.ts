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
