/**
 * What is left of a plan, as the sidebar meter states it.
 *
 * Pure, and separate from the component, because the null convention here is
 * the whole subtlety and it is easy to get backwards. `plans.limits` uses
 * `null` for **unlimited** — not for zero, and not for unknown — so a paid
 * account with `trips: null` must read "unlimited" rather than "0 left", which
 * is what a naive `limit - used` produces and what would wall somebody off from
 * their own product.
 *
 * The one exception the app already makes is `collaborators_per_trip: 0` on the
 * free plan, which reads as "not available". That is a different question from
 * this one — a meter has nothing to show for a feature you do not have — so
 * anything with a limit of zero is simply not a line here.
 */

/** How full a line is before it starts asking for attention. */
const WARN_AT = 0.8

export type QuotaTone = 'ok' | 'warn' | 'full'

export interface QuotaLine {
  label: string
  used: number
  /** null → unlimited. Never zero-as-unlimited; see the note above. */
  limit: number | null
  /** Renders the numbers. Counts and bytes read very differently. */
  format: (value: number) => string
}

/**
 * How full a line is, 0–1, or null when there is no ceiling to be full of.
 *
 * Clamped at 1: storage can legitimately exceed its limit — the cap is enforced
 * when a file arrives, and a plan downgrade moves the ceiling under what is
 * already stored — and a bar past 100% is a rendering bug rather than a fact.
 */
export function usageFraction(used: number, limit: number | null): number | null {
  if (limit === null || limit <= 0) return null
  return Math.min(1, Math.max(0, used / limit))
}

export function quotaTone(used: number, limit: number | null): QuotaTone {
  const fraction = usageFraction(used, limit)
  if (fraction === null) return 'ok'
  if (used >= (limit ?? 0)) return 'full'
  return fraction >= WARN_AT ? 'warn' : 'ok'
}

/**
 * The line in words, for the meter's own label and its screen-reader text.
 *
 * "3 of 15" rather than "12 left": the plan is sold as an allowance, the
 * pricing table says "15 trips", and a remaining count makes somebody subtract
 * to check it against what they were sold.
 */
export function describeQuota(line: QuotaLine): string {
  if (line.limit === null) {
    return `${line.format(line.used)} used · unlimited`
  }
  return `${line.format(line.used)} of ${line.format(line.limit)}`
}

/** Whether the meter is worth rendering at all. */
export function hasMeterableLines(lines: QuotaLine[]): boolean {
  return lines.some((line) => line.limit !== null)
}
