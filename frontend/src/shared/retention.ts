/**
 * The restore window.
 *
 * "Recoverable for 30 days" is a promise made in three delete dialogs, kept by
 * `restore_trip()` in SQL and by the post restore action in TypeScript, and
 * displayed as a countdown on the trash screen. Four copies of the number is
 * three too many, so the two written in application code read from here and the
 * SQL function names it in its own comment.
 */

/** How long a soft-deleted trip or post can be brought back. */
export const RETENTION_DAYS = 30

const MS_PER_DAY = 86_400_000

/**
 * Days remaining in the window, rounded up, floored at zero.
 *
 * Rounded up because it is read as a deadline: something deleted twenty hours
 * ago has "30 days left", not 29. This decides what a screen says; whether a
 * restore is actually still allowed is decided by the write path.
 */
export function daysLeftIn(deletedAt: string, now = Date.now()): number {
  const elapsedDays = (now - new Date(deletedAt).getTime()) / MS_PER_DAY
  if (!Number.isFinite(elapsedDays)) return 0
  return Math.max(0, Math.ceil(RETENTION_DAYS - elapsedDays))
}

/** The oldest `deleted_at` still inside the window, as an ISO timestamp. */
export function retentionCutoff(now = Date.now()): string {
  return new Date(now - RETENTION_DAYS * MS_PER_DAY).toISOString()
}
