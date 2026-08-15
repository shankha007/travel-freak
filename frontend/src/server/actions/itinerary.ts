'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/server/supabase/server'
import { requireUser } from '@/server/auth'
import { canUseFullItinerary } from '@/server/entitlements'
import { MAX_GENERATED_DAYS, tripDateRange } from '@/shared/itinerary'
import {
  itineraryDaySchema,
  itineraryItemSchema,
  itineraryStatusSchema,
} from '@/shared/validation/itinerary'
import { fieldErrorsOf, textFields, type FormState } from '@/shared/validation/form-state'

/**
 * Itinerary writes — screen 21.
 *
 * Two rules hold across every action here.
 *
 * **The parent proves the ownership.** An item names a day, never a trip. The
 * day is read back first — through the user's own client, so RLS answers — and
 * the trip written onto the row is the one the day says it belongs to. A forged
 * `tripId` in a form post therefore has nothing to attach to, and the composite
 * foreign key in the migration would refuse it even if this code stopped
 * checking.
 *
 * **The paid fields are dropped, not rejected.** Times, costs, booking
 * references and links are `itinerary_full`. A free plan's form does not render
 * them, so anything arriving in those fields is a crafted request rather than a
 * mistake, and the useful answer is to save the rest of the entry.
 */

function repaint(tripId: string) {
  revalidatePath(`/trips/${tripId}/itinerary`)
  // The trip page carries the planner summary, and the budget screen shows what
  // the itinerary expects to cost.
  revalidatePath(`/trips/${tripId}`)
  revalidatePath(`/trips/${tripId}/budget`)
}

/**
 * The next `order_index` among a set of siblings.
 *
 * One function per table rather than one parameterised by both: PostgREST's
 * generated types tie the column name to the table, so a shared helper would
 * have to widen the column to a union neither table accepts.
 */
async function nextDayIndex(tripId: string): Promise<number> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('itinerary_days')
    .select('order_index')
    .eq('trip_id', tripId)
    .order('order_index', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (data?.order_index ?? -1) + 1
}

async function nextItemIndex(dayId: string): Promise<number> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('itinerary_items')
    .select('order_index')
    .eq('day_id', dayId)
    .order('order_index', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (data?.order_index ?? -1) + 1
}

// ---------------------------------------------------------------------------
// Days
// ---------------------------------------------------------------------------

export async function saveItineraryDay(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = textFields(formData, 'tripId', 'dayDate', 'title', 'notes')
  const rawId = formData.get('id')

  const parsed = itineraryDaySchema.safeParse({
    id: typeof rawId === 'string' && rawId !== '' ? rawId : null,
    ...values,
  })

  if (!parsed.success) {
    return {
      error: 'Please fix the highlighted fields.',
      fieldErrors: fieldErrorsOf(parsed.error),
      values,
    }
  }

  const { id, tripId, dayDate, title, notes } = parsed.data
  const supabase = await createClient()
  const user = await requireUser()

  const row = { trip_id: tripId, user_id: user.id, day_date: dayDate, title, notes }

  const { error } = id
    ? await supabase.from('itinerary_days').update(row).eq('id', id).eq('user_id', user.id)
    : await supabase
        .from('itinerary_days')
        .insert({ ...row, order_index: await nextDayIndex(tripId) })

  if (error) {
    // `itinerary_days_unique_date` is one row per calendar day per trip. Adding
    // a day twice is a double-click, not a failure.
    if (error.code === '23505') return { error: 'That day is already on the itinerary.', values }
    return { error: 'Could not save that day. Please try again.', values }
  }

  repaint(tripId)
  return { error: null, saved: true }
}

export async function deleteItineraryDay(_prev: FormState, formData: FormData): Promise<FormState> {
  const { id, tripId } = textFields(formData, 'id', 'tripId')
  if (!id || !tripId) return { error: 'Nothing to remove.' }

  const supabase = await createClient()
  const user = await requireUser()

  // Everything on the day goes with it, by `on delete cascade`. The dialog says
  // so before this runs.
  const { error } = await supabase
    .from('itinerary_days')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: 'Could not remove that day. Please try again.' }

  repaint(tripId)
  return { error: null, saved: true }
}

/**
 * Lays out every date the trip covers that has no day yet.
 *
 * The most tedious part of starting an itinerary, and the one part that is
 * entirely derivable. `tripDateRange()` caps the range, so a mistyped year
 * cannot create 370 rows somebody then deletes by hand.
 */
export async function addTripDays(_prev: FormState, formData: FormData): Promise<FormState> {
  const { tripId } = textFields(formData, 'tripId')
  if (!tripId) return { error: 'Nothing to add days to.' }

  const supabase = await createClient()
  const user = await requireUser()

  const { data: trip } = await supabase
    .from('trips')
    .select('start_date, end_date')
    .eq('id', tripId)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!trip) return { error: 'That trip is not here any more.' }

  const dates = tripDateRange(trip.start_date, trip.end_date)
  if (dates.length === 0) {
    return {
      error:
        trip.start_date && trip.end_date
          ? `That range covers more than ${MAX_GENERATED_DAYS} days. Add the days you need one at a time.`
          : 'Set the trip dates first and the days can be laid out for you.',
    }
  }

  const { data: existing } = await supabase
    .from('itinerary_days')
    .select('day_date, order_index')
    .eq('trip_id', tripId)

  const laidOut = new Set((existing ?? []).map((d) => d.day_date))
  const missing = dates.filter((date) => !laidOut.has(date))

  if (missing.length === 0) return { error: null, saved: true }

  let order = Math.max(-1, ...(existing ?? []).map((d) => d.order_index)) + 1

  const { error } = await supabase.from('itinerary_days').insert(
    missing.map((date) => ({
      trip_id: tripId,
      user_id: user.id,
      day_date: date,
      order_index: order++,
    }))
  )

  if (error) return { error: 'Could not lay out the days. Please try again.' }

  repaint(tripId)
  return { error: null, saved: true }
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

export async function saveItineraryItem(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = textFields(
    formData,
    'dayId',
    'kind',
    'title',
    'notes',
    'timeStart',
    'timeEnd',
    'cost',
    'currency',
    'bookingRef',
    'url',
    'status'
  )

  const cost = values.cost.trim() !== '' ? Number(values.cost) : null

  // A cost that is not a number reaches Zod as NaN, which reads as "expected
  // number" — true, but not a sentence anybody can act on.
  if (cost !== null && !Number.isFinite(cost)) {
    return {
      error: 'Please fix the highlighted fields.',
      fieldErrors: { cost: 'Enter a number' },
      values,
    }
  }

  const rawId = formData.get('id')
  const parsed = itineraryItemSchema.safeParse({
    id: typeof rawId === 'string' && rawId !== '' ? rawId : null,
    ...values,
    cost,
    currency: values.currency || 'INR',
    kind: values.kind || 'activity',
    status: values.status || 'planned',
  })

  if (!parsed.success) {
    return {
      error: 'Please fix the highlighted fields.',
      fieldErrors: fieldErrorsOf(parsed.error),
      values,
    }
  }

  const item = parsed.data
  const supabase = await createClient()
  const user = await requireUser()

  // The day is what proves this belongs to the caller: RLS answers with nothing
  // for somebody else's day, and the trip written below is the day's own.
  const { data: day } = await supabase
    .from('itinerary_days')
    .select('id, trip_id')
    .eq('id', item.dayId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!day) return { error: 'That day is not here any more.', values }

  const full = await canUseFullItinerary()

  const row = {
    day_id: day.id,
    trip_id: day.trip_id,
    user_id: user.id,
    kind: item.kind,
    title: item.title,
    notes: item.notes,
    status: item.status,
    currency: item.currency,
    // The paid half. A free plan keeps days, activities and notes — which is
    // what the pricing table sells — and these four are dropped, not refused.
    time_start: full ? item.timeStart : null,
    time_end: full ? item.timeEnd : null,
    cost: full ? item.cost : null,
    booking_ref: full ? item.bookingRef : '',
    url: full ? item.url : '',
  }

  const { error } = item.id
    ? await supabase.from('itinerary_items').update(row).eq('id', item.id).eq('user_id', user.id)
    : await supabase
        .from('itinerary_items')
        .insert({ ...row, order_index: await nextItemIndex(day.id) })

  if (error) return { error: 'Could not save that. Please try again.', values }

  repaint(day.trip_id)
  return { error: null, saved: true }
}

export async function deleteItineraryItem(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const { id, tripId } = textFields(formData, 'id', 'tripId')
  if (!id || !tripId) return { error: 'Nothing to remove.' }

  const supabase = await createClient()
  const user = await requireUser()

  const { error } = await supabase
    .from('itinerary_items')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: 'Could not remove that. Please try again.' }

  repaint(tripId)
  return { error: null, saved: true }
}

/**
 * Marks one entry planned, booked, done or skipped.
 *
 * Its own action rather than a trip through the edit dialog: ticking off the
 * museum you have just left is what this screen does most, and it should cost
 * one click.
 */
export async function setItineraryItemStatus(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const { id, tripId, status } = textFields(formData, 'id', 'tripId', 'status')
  if (!id || !tripId) return { error: 'Nothing to update.' }

  const parsed = itineraryStatusSchema.safeParse(status)
  if (!parsed.success) return { error: 'That is not a status.' }

  const supabase = await createClient()
  const user = await requireUser()

  const { error } = await supabase
    .from('itinerary_items')
    .update({ status: parsed.data })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: 'Could not update that. Please try again.' }

  repaint(tripId)
  return { error: null, saved: true }
}
