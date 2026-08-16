import 'server-only'

import { createClient } from '@/server/supabase/server'
import { canUseFullItinerary } from '@/server/entitlements'
import { getPlannerTrip } from '@/server/queries/planner'
import { costByCurrency, tripDateRange, type CurrencyTotal } from '@/shared/itinerary'
import { pointFrom, type LngLat } from '@/shared/geo/point'
import type { Database } from '@/shared/types/database'

/**
 * The itinerary — screen 21.
 *
 * Two reads, not one per day: the days and every item on the trip come back
 * together and are stitched here, because a fortnight in Japan is fourteen
 * round trips otherwise.
 *
 * Costs are rolled up per day and for the trip, always grouped by currency —
 * `costByCurrency()` explains why they are never added together.
 */

type ItineraryKind = Database['public']['Enums']['itinerary_kind']
type ItineraryStatus = Database['public']['Enums']['itinerary_status']

export interface ItineraryEntry {
  id: string
  dayId: string
  kind: ItineraryKind
  title: string
  notes: string
  timeStart: string | null
  timeEnd: string | null
  cost: number | null
  currency: string
  bookingRef: string
  url: string
  status: ItineraryStatus
  orderIndex: number
  /** The pin, when one was dropped. Null for an entry recorded by name alone. */
  point: LngLat | null
}

export interface ItineraryDay {
  id: string
  dayDate: string | null
  title: string
  notes: string
  orderIndex: number
  items: ItineraryEntry[]
  /** What this day costs, per currency. Empty when nothing on it is priced. */
  costs: CurrencyTotal[]
}

export interface ItineraryData {
  tripId: string
  tripTitle: string
  startDate: string | null
  endDate: string | null
  currency: string
  days: ItineraryDay[]
  itemCount: number
  /** The whole trip's planned cost, per currency. */
  totals: CurrencyTotal[]
  /**
   * Dates the trip covers that have no day yet, so the screen can offer to
   * create them in one go. Empty for a trip with no dates, or one already
   * fully laid out.
   */
  missingDates: string[]
  /** `itinerary_full`: times, costs, bookings and links. */
  full: boolean
}

export async function getItinerary(tripId: string): Promise<ItineraryData | null> {
  const trip = await getPlannerTrip(tripId)
  if (!trip) return null

  const supabase = await createClient()

  const [daysResult, itemsResult, full] = await Promise.all([
    supabase
      .from('itinerary_days')
      .select('id, day_date, title, notes, order_index')
      .eq('trip_id', tripId)
      // Dated days first and in date order; undated ones fall to their own
      // order_index, which is how an unscheduled plan keeps its shape.
      .order('day_date', { ascending: true, nullsFirst: false })
      .order('order_index', { ascending: true }),
    supabase
      .from('itinerary_items')
      .select(
        `id, day_id, kind, title, notes, time_start, time_end, cost, currency,
         booking_ref, url, status, order_index, latitude, longitude`
      )
      .eq('trip_id', tripId)
      .order('time_start', { ascending: true, nullsFirst: false })
      .order('order_index', { ascending: true }),
    canUseFullItinerary(),
  ])

  const rows = itemsResult.data ?? []
  const itemsByDay = new Map<string, ItineraryEntry[]>()

  for (const row of rows) {
    const entry: ItineraryEntry = {
      id: row.id,
      dayId: row.day_id,
      kind: row.kind,
      title: row.title,
      notes: row.notes,
      timeStart: row.time_start,
      timeEnd: row.time_end,
      cost: row.cost === null ? null : Number(row.cost),
      currency: row.currency,
      bookingRef: row.booking_ref,
      url: row.url,
      status: row.status,
      orderIndex: row.order_index,
      point: pointFrom(row.latitude, row.longitude),
    }
    const existing = itemsByDay.get(row.day_id)
    if (existing) existing.push(entry)
    else itemsByDay.set(row.day_id, [entry])
  }

  const days: ItineraryDay[] = (daysResult.data ?? []).map((day) => {
    const items = itemsByDay.get(day.id) ?? []
    return {
      id: day.id,
      dayDate: day.day_date,
      title: day.title,
      notes: day.notes,
      orderIndex: day.order_index,
      items,
      costs: costByCurrency(items),
    }
  })

  const laidOut = new Set(days.map((d) => d.dayDate).filter((d): d is string => d !== null))

  return {
    tripId: trip.id,
    tripTitle: trip.title,
    startDate: trip.startDate,
    endDate: trip.endDate,
    currency: trip.currency,
    days,
    itemCount: rows.length,
    totals: costByCurrency(days.flatMap((d) => d.items)),
    missingDates: tripDateRange(trip.startDate, trip.endDate).filter((d) => !laidOut.has(d)),
    full,
  }
}
