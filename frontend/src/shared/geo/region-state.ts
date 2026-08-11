/**
 * The four states a country or region can be in on the globe and maps.
 *
 * Accessibility contract: these colours must never be the only way a state is
 * conveyed. Roughly 1 in 12 men has some form of colour vision deficiency, and
 * green/planned-yellow is a common confusion pair. Every surface that paints a
 * region — globe, map, legend, region list — must also render `label`.
 */

export const REGION_STATES = ['visited', 'current', 'planned', 'unvisited'] as const

export type RegionState = (typeof REGION_STATES)[number]

export interface RegionStateMeta {
  /** Human-readable label. Required wherever the colour is used. */
  label: string
  /** Tailwind class for the fill, from the tokens in globals.css. */
  fillClass: string
  /** Tailwind class for text placed on that fill. */
  textClass: string
  /** CSS custom property name, for reading a computed value in WebGL/MapLibre. */
  cssVar: string
  /** Short explanation used in legends and tooltips. */
  description: string
}

export const REGION_STATE_META: Record<RegionState, RegionStateMeta> = {
  visited: {
    label: 'Visited',
    fillClass: 'bg-globe-visited',
    textClass: 'text-globe-visited-foreground',
    cssVar: '--globe-visited',
    description: 'You have completed a trip here.',
  },
  current: {
    label: 'Current trip',
    fillClass: 'bg-globe-current',
    textClass: 'text-globe-current-foreground',
    cssVar: '--globe-current',
    description: 'A trip here is happening right now.',
  },
  planned: {
    label: 'Planned',
    fillClass: 'bg-globe-planned',
    textClass: 'text-globe-planned-foreground',
    cssVar: '--globe-planned',
    description: 'You have an upcoming trip or wishlist entry here.',
  },
  unvisited: {
    label: 'Not visited',
    fillClass: 'bg-globe-unvisited',
    textClass: 'text-globe-unvisited-foreground',
    cssVar: '--globe-unvisited',
    description: 'No trips here yet.',
  },
}

let normalizeContext: CanvasRenderingContext2D | null = null

/**
 * Converts any CSS colour the browser understands into `rgba(r, g, b, a)`.
 *
 * The design tokens are authored in oklch, but three-globe parses colours with
 * d3-color, which supports only the older CSS syntaxes and returns null for
 * `oklch()` and `lab()` — the form browsers compute our variables to. Feeding
 * those to the globe throws on every rendered frame.
 *
 * Reading back `fillStyle` is not enough: browsers echo wide-gamut syntaxes
 * unchanged rather than converting them. Painting a single pixel and sampling it
 * forces a real conversion to sRGB bytes, which works for every colour syntax
 * the browser can parse at all.
 */
export function toRgba(cssColor: string, alpha = 1): string {
  const fallback = `rgba(0, 0, 0, ${alpha})`
  if (typeof document === 'undefined' || !cssColor) return fallback

  normalizeContext ??= document
    .createElement('canvas')
    .getContext('2d', { willReadFrequently: true })
  if (!normalizeContext) return fallback

  try {
    normalizeContext.clearRect(0, 0, 1, 1)
    // Assigning an unparseable colour is a no-op, so seed a known value first
    // and let it be what gets sampled if `cssColor` turns out to be invalid.
    normalizeContext.fillStyle = '#000000'
    normalizeContext.fillStyle = cssColor
    normalizeContext.fillRect(0, 0, 1, 1)

    const [r, g, b] = normalizeContext.getImageData(0, 0, 1, 1).data
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  } catch {
    return fallback
  }
}

/**
 * Resolves a region-state colour to a concrete sRGB value for canvas/WebGL
 * renderers, which cannot consume Tailwind classes or `var()` references.
 *
 * Reads from the live document so it follows the active theme. Callers must
 * re-read after a theme change.
 */
export function resolveRegionStateColor(state: RegionState, alpha = 1): string {
  if (typeof window === 'undefined') return `rgba(0, 0, 0, ${alpha})`
  const { cssVar } = REGION_STATE_META[state]
  const raw = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim()
  return toRgba(raw, alpha)
}
