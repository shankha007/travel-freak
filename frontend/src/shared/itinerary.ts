/**
 * The vocabulary and the arithmetic of an itinerary — screen 21.
 *
 * Pure on purpose. What a day costs and how a day is labelled are claims the
 * screen makes about somebody's plan, and both are easier to get subtly wrong
 * than they look: a day belonging to no date still needs a name, and a day whose
 * items are priced in two currencies has no single total. Neither answer should
 * be worked out inside a component.
 */

import type { ExpenseCategory } from '@/shared/budget'

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

// ---------------------------------------------------------------------------
// Plan against actual
// ---------------------------------------------------------------------------

/**
 * Which expense category a planned entry becomes when it is recorded as spent.
 *
 * `itinerary_kind` has six values and `expense_category` has six, but they are
 * not the same six — the enums answer different questions, and the planner
 * migration says why `transport` is missing from one: a train ticket is an
 * expense under "getting there", which the category list calls `flights`.
 *
 * `note` maps to `misc` rather than being refused. A note with a price on it is
 * unusual, but somebody who typed one meant it, and the alternative is a button
 * that silently does nothing on one kind of row.
 */
export const EXPENSE_CATEGORY_FOR_KIND: Record<ItineraryKind, ExpenseCategory> = {
  activity: 'activities',
  hotel: 'hotels',
  restaurant: 'food',
  transport: 'flights',
  booking: 'activities',
  note: 'misc',
}

/** Just enough of an entry to decide. The query type carries the rest. */
export interface RecordableEntry {
  cost: number | null
  /** Already settled — the control is a state then, not a repeat action. */
  recorded: { id: string } | null
}

/**
 * Whether "record what this cost" is offered for an entry.
 *
 * Requires a price. Without one there is nothing to prefill and the writer would
 * be sent to a form with an empty amount, which is the form they already have —
 * the point of this button is that it knows the number.
 *
 * A `null` cost and a cost of zero are different: an entry deliberately priced
 * at nothing is a real plan (the free walking tour), and recording it keeps the
 * day's actual spend honest about what was accounted for.
 */
export function canRecordExpense(entry: RecordableEntry): boolean {
  return entry.recorded === null && entry.cost !== null && Number.isFinite(entry.cost)
}

/** How the recorded expense differs from what was planned, in its own currency. */
export interface PlanVariance {
  planned: number
  actual: number
  /** Actual minus planned: positive is an overspend. */
  difference: number
  currency: string
}

/**
 * Plan against actual for one entry, or null when the two cannot be compared.
 *
 * Returns nothing when the currencies differ, for the reason every other total
 * in this codebase gives: there is no exchange rate here, and "₹8,000 planned,
 * $95 spent" is two facts rather than a variance. The screen shows both amounts
 * and no difference in that case.
 */
export function planVariance(
  planned: { cost: number | null; currency: string },
  actual: { amount: number; currency: string }
): PlanVariance | null {
  if (planned.cost === null || !Number.isFinite(planned.cost)) return null
  if (planned.currency.toUpperCase() !== actual.currency.toUpperCase()) return null

  return {
    planned: planned.cost,
    actual: actual.amount,
    difference: actual.amount - planned.cost,
    currency: actual.currency.toUpperCase(),
  }
}

/**
 * Reads the new order a drag produced, off the wire.
 *
 * The client sends the day's entry ids as a JSON array in one field, because
 * the order *is* the message and `FormData.getAll()` ordering is not something
 * to stake a feature on. That makes this the one place a reorder can be
 * malformed, so it is pulled out here and tested rather than left inline in the
 * action: anything that is not an array of well-formed uuids is rejected whole
 * rather than partially applied, and duplicates are refused because a repeated
 * id would silently drop an entry from the day.
 *
 * Returns null when the payload cannot be trusted. An empty array is valid and
 * means "nothing to do" — a day emptied by a drag is a real state.
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function parseOrderedIds(raw: string): string[] | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }

  if (!Array.isArray(parsed)) return null
  if (!parsed.every((id) => typeof id === 'string' && UUID_PATTERN.test(id))) return null

  const ids = parsed as string[]
  if (new Set(ids.map((id) => id.toLowerCase())).size !== ids.length) return null

  return ids
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
