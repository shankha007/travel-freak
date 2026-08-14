/**
 * The vocabulary every animation in the app speaks.
 *
 * Motion is a design system like colour is: three durations and one easing curve
 * used everywhere read as one product, while a dozen hand-picked numbers read as
 * a dozen people. Nothing outside this file should invent a duration.
 *
 * Deliberately free of React and of Framer Motion, so the numbers can be
 * unit-tested and so a server component can import them without pulling a
 * client library into its bundle.
 */

/** Seconds, because that is the unit Framer Motion's `transition` takes. */
export const DURATION = {
  /** A control acknowledging a press or a hover. Below this it reads as a jump. */
  fast: 0.18,
  /** The default: something arriving or leaving. */
  base: 0.35,
  /** A whole section settling in. Anything longer starts to feel like waiting. */
  slow: 0.6,
} as const

/**
 * Ease-out quint. Fast at the start, long tail — the curve that reads as an
 * object with weight coming to rest, rather than a value being interpolated.
 */
export const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1]

/** How far a revealing element travels before it settles, in pixels. */
export const REVEAL_DISTANCE = 12

/** Gap between one item of a staggered group and the next, in seconds. */
export const STAGGER_STEP = 0.06

/**
 * Ceiling on the delay any single item may be given.
 *
 * Without it a twelve-card grid gives its last card a delay of nearly a second,
 * which stops being choreography and becomes a page that loads slowly. Past the
 * cap the remaining items arrive together, which nobody notices — by then the
 * eye has moved on.
 */
export const MAX_STAGGER_DELAY = 0.3

/** The delay item `index` of a staggered group waits, in seconds. */
export function staggerDelay(index: number, step: number = STAGGER_STEP): number {
  if (!Number.isFinite(index) || index <= 0) return 0
  return Math.min(index * step, MAX_STAGGER_DELAY)
}
