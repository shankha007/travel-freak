/**
 * The vocabulary and the arithmetic of an itinerary — screen 21.
 *
 * Pure on purpose. What a day costs and how a day is labelled are claims the
 * screen makes about somebody's plan, and both are easier to get subtly wrong
 * than they look: a day belonging to no date still needs a name, and a day whose
 * items are priced in two currencies has no single total. Neither answer should
 * be worked out inside a component.
 */

export const ITINERARY_KINDS = [
  'activity',
  'hotel',
  'restaurant',
  'transport',
  'booking',
  'note',
] as const

export type ItineraryKind = (typeof ITINERARY_KINDS)[number]

export const ITINERARY_KIND_LABEL: Record<ItineraryKind, string> = {
  activity: 'Activity',
  hotel: 'Stay',
  restaurant: 'Food',
  transport: 'Travel',
  booking: 'Booking',
  note: 'Note',
}

/** lucide-react icon names, resolved in the client component. */
export const ITINERARY_KIND_ICON: Record<ItineraryKind, string> = {
  activity: 'Ticket',
  hotel: 'BedDouble',
  restaurant: 'Utensils',
  transport: 'TramFront',
  booking: 'FileText',
  note: 'StickyNote',
}

export const ITINERARY_STATUSES = ['planned', 'booked', 'done', 'skipped'] as const

export type ItineraryStatus = (typeof ITINERARY_STATUSES)[number]

export const ITINERARY_STATUS_LABEL: Record<ItineraryStatus, string> = {
  planned: 'Planned',
  booked: 'Booked',
  done: 'Done',
  skipped: 'Skipped',
}

export function isItineraryKind(value: string): value is ItineraryKind {
  return (ITINERARY_KINDS as readonly string[]).includes(value)
}

export function isItineraryStatus(value: string): value is ItineraryStatus {
  return (ITINERARY_STATUSES as readonly string[]).includes(value)
}

/**
 * Renders a `time` column the way a plan is read.
 *
 * Postgres hands back `14:30:00`; a plan says 14:30. Seconds are dropped rather
 * than formatted, because an itinerary that claims to know the second is lying.
 */
export function formatTime(value: string | null): string {
  if (!value) return ''
  const [hours, minutes] = value.split(':')
  if (hours === undefined || minutes === undefined) return value
  return `${hours}:${minutes}`
}

/** A time range, with either end allowed to be missing. */
export function formatTimeRange(start: string | null, end: string | null): string {
  const from = formatTime(start)
  const to = formatTime(end)
  if (from && to) return `${from} – ${to}`
  if (from) return from
  if (to) return `until ${to}`
  return ''
}

/** Enough of an item for the arithmetic below; the query type carries the rest. */
export interface CostedItem {
  cost: number | null
  currency: string
}

/** One currency and what it adds up to. */
export interface CurrencyTotal {
  currency: string
  total: number
}

/**
 * What a set of items costs, grouped by currency.
 *
 * Never summed across currencies. Adding ₹40,000 to $400 needs an exchange rate
 * this codebase does not have, and `analytics.ts` already refuses the same sum
 * for the same reason — a day costing "40400" would be a number nobody could
 * act on. Items with no cost contribute nothing rather than zero, so a day of
 * unpriced plans reports no total instead of a free one.
 *
 * Ordered by size, so the currency the trip is mostly in leads.
 */
export function costByCurrency(items: readonly CostedItem[]): CurrencyTotal[] {
  const totals = new Map<string, number>()

  for (const item of items) {
    if (item.cost === null || !Number.isFinite(item.cost)) continue
    const currency = item.currency.toUpperCase()
    totals.set(currency, (totals.get(currency) ?? 0) + item.cost)
  }

  return [...totals]
    .map(([currency, total]) => ({ currency, total }))
    .sort((a, b) => b.total - a.total || a.currency.localeCompare(b.currency))
}

/**
 * What a day is called when nobody has named it.
 *
 * A plan is navigated by position — "day three" — long before it is navigated by
 * date, and an undated trip has nothing else to go on. The date, when there is
 * one, is rendered separately by the screen; this is the identity of the day.
 */
export function dayLabel(title: string, index: number): string {
  const named = title.trim()
  return named !== '' ? named : `Day ${index + 1}`
}

/**
 * The dates a trip covers, one per day, inclusive of both ends.
 *
 * Used to offer "add the days you are away" in one click. Returns nothing for a
 * trip missing either end, an inverted range, or a range long enough to suggest
 * a typo rather than a journey — 370 entries created by a mistyped year is not
 * something anyone wants to delete by hand.
 */
export const MAX_GENERATED_DAYS = 60

export function tripDateRange(start: string | null, end: string | null): string[] {
  if (!start || !end) return []

  const from = new Date(`${start}T00:00:00Z`)
  const to = new Date(`${end}T00:00:00Z`)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return []
  if (to < from) return []

  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1
  if (days > MAX_GENERATED_DAYS) return []

  return Array.from({ length: days }, (_, i) => {
    const date = new Date(from.getTime() + i * 86_400_000)
    return date.toISOString().slice(0, 10)
  })
}
