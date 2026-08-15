import 'server-only'

import { createClient } from '@/server/supabase/server'
import { checklistProgress, type ChecklistProgress } from '@/shared/packing'
import { costByCurrency, type CurrencyTotal } from '@/shared/itinerary'

/**
 * The trip behind a planner screen — the shared first step of screens 21, 22
 * and 23.
 *
 * All three hang off `/trips/[id]/…` and all three need the same four facts
 * before they can render anything: does this trip exist, may this person see it,
 * what is it called, and what currency and dates is it in. Doing that once means
 * the three screens cannot disagree about which trips they will open.
 *
 * Scoped by RLS. A trip belonging to somebody else returns nothing, which each
 * page turns into a 404 — the same answer an id that does not exist gets, so
 * this cannot be used to find out which trips are real.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface PlannerTrip {
  id: string
  title: string
  startDate: string | null
  endDate: string | null
  tripType: string | null
  currency: string
  budgetPlanned: number | null
}

export async function getPlannerTrip(id: string): Promise<PlannerTrip | null> {
  // Postgres answers a malformed uuid with a 400 rather than an empty result,
  // which would surface as a server error instead of a clean 404 for a typo.
  if (!UUID.test(id)) return null

  const supabase = await createClient()

  const { data } = await supabase
    .from('trips')
    .select('id, title, start_date, end_date, trip_type, currency, budget_planned')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!data) return null

  return {
    id: data.id,
    title: data.title,
    startDate: data.start_date,
    endDate: data.end_date,
    tripType: data.trip_type,
    currency: data.currency,
    // `numeric` comes back as a string from PostgREST when it is large enough to
    // lose precision as a float; both forms are normalised here.
    budgetPlanned: data.budget_planned === null ? null : Number(data.budget_planned),
  }
}

/**
 * One line per planner screen, for the card on `/trips/[id]`.
 *
 * Deliberately shallow: the trip page is already six queries deep, and what it
 * needs is whether there is anything on each of the three screens and a number
 * to show if there is. Anything more belongs on the screen that owns it.
 */
export interface PlannerSummary {
  dayCount: number
  itemCount: number
  /** What the trip has actually cost, per currency. */
  spent: CurrencyTotal[]
  listCount: number
  packing: ChecklistProgress
}

export async function getPlannerSummary(tripId: string): Promise<PlannerSummary> {
  const supabase = await createClient()

  const [days, items, expenses, lists, checklistItems] = await Promise.all([
    supabase
      .from('itinerary_days')
      .select('*', { count: 'exact', head: true })
      .eq('trip_id', tripId),
    supabase
      .from('itinerary_items')
      .select('*', { count: 'exact', head: true })
      .eq('trip_id', tripId),
    supabase.from('expenses').select('amount, currency').eq('trip_id', tripId),
    supabase.from('checklists').select('*', { count: 'exact', head: true }).eq('trip_id', tripId),
    supabase.from('checklist_items').select('is_done, quantity').eq('trip_id', tripId),
  ])

  return {
    dayCount: days.count ?? 0,
    itemCount: items.count ?? 0,
    // Reusing the itinerary's roll-up: an expense and a planned cost are the
    // same shape, and both are grouped by currency rather than summed across.
    spent: costByCurrency(
      (expenses.data ?? []).map((row) => ({ cost: Number(row.amount), currency: row.currency }))
    ),
    listCount: lists.count ?? 0,
    packing: checklistProgress(
      (checklistItems.data ?? []).map((row) => ({ isDone: row.is_done, quantity: row.quantity }))
    ),
  }
}
