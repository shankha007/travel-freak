import { format, parseISO } from 'date-fns'

/**
 * Renders a date range the way a traveller would say it.
 *
 * Collapses shared month and year rather than repeating them:
 *   'Mar 3 – 11, 2025'   (same month)
 *   'Mar 3 – Apr 2, 2025' (same year)
 *   'Dec 28, 2024 – Jan 4, 2025'
 */
export function formatDateRange(start: string | null, end: string | null): string {
  if (!start && !end) return 'Dates not set'
  if (start && !end) return format(parseISO(start), 'd MMM yyyy')
  if (!start && end) return `until ${format(parseISO(end), 'd MMM yyyy')}`

  const from = parseISO(start as string)
  const to = parseISO(end as string)

  if (from.getFullYear() === to.getFullYear()) {
    if (from.getMonth() === to.getMonth()) {
      return `${format(from, 'd')} – ${format(to, 'd MMM yyyy')}`
    }
    return `${format(from, 'd MMM')} – ${format(to, 'd MMM yyyy')}`
  }

  return `${format(from, 'd MMM yyyy')} – ${format(to, 'd MMM yyyy')}`
}

/** Whole days between two dates, inclusive of both endpoints. */
export function tripDayCount(start: string | null, end: string | null): number | null {
  if (!start || !end) return null
  const ms = parseISO(end).getTime() - parseISO(start).getTime()
  return Math.floor(ms / 86_400_000) + 1
}

/** Human-readable byte size, for quota meters. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`
}
