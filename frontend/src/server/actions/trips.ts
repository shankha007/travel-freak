'use server'

import { redirect } from 'next/navigation'
import { after } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/server/supabase/server'
import { requireUser } from '@/server/auth'
import { checkTripQuota } from '@/server/entitlements'
import { buildTripDerivatives } from '@/server/media/derivative-jobs'
import { slugify, updateTripSchema } from '@/shared/validation/trip'
import { toPointEwkt } from '@/shared/geo/point'
import type { CreateTripValues } from '@/shared/validation/trip'

export interface CreateTripState {
  error: string | null
  /** Field-level errors, keyed by path, for inline display. */
  fieldErrors?: Record<string, string>
  /** Set when the failure is a quota wall so the UI can offer an upgrade. */
  quotaExceeded?: boolean
}

/**
 * Finds a free slug.
 *
 * `trips.slug` is globally unique, so two users naming a trip "Goa" collide.
 * Rather than pre-checking with a select — which races under concurrent inserts
 * — this retries on the unique violation and lets the database arbitrate.
 */
function candidateSlugs(title: string): string[] {
  const base = slugify(title)
  return [base, ...Array.from({ length: 4 }, (_, i) => `${base}-${i + 2}`)]
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * The `location` value for one submitted place.
 *
 * Null when the writer set no pin, which is also how a pin is removed: the
 * update writes null and PostGIS forgets it, rather than the old coordinate
 * quietly outliving the place it described.
 */
function locationOf(place: CreateTripValues['places'][number]): string | null {
  return place.lng !== null && place.lat !== null
    ? toPointEwkt({ lng: place.lng, lat: place.lat })
    : null
}

type ParseResult = { ok: true; values: CreateTripValues } | { ok: false; state: CreateTripState }

/**
 * Reads and validates the form's JSON payload.
 *
 * The payload is JSON rather than flat fields because `places` is a repeating
 * group, and FormData has no clean representation of nested arrays.
 */
function parsePayload(formData: FormData): ParseResult {
  const raw = formData.get('payload')
  if (typeof raw !== 'string') {
    return {
      ok: false,
      state: { error: 'Something went wrong submitting the form. Please try again.' },
    }
  }

  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(raw)
  } catch {
    return {
      ok: false,
      state: { error: 'Something went wrong submitting the form. Please try again.' },
    }
  }

  // Create and update share a schema; see updateTripSchema for why.
  const parsed = updateTripSchema.safeParse(parsedJson)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.')
      fieldErrors[key] ??= issue.message
    }
    return { ok: false, state: { error: 'Please fix the highlighted fields.', fieldErrors } }
  }

  return { ok: true, values: parsed.data }
}

export async function createTrip(
  _prev: CreateTripState,
  formData: FormData
): Promise<CreateTripState> {
  const user = await requireUser()

  const parsed = parsePayload(formData)
  if (!parsed.ok) return parsed.state

  // Quota gate runs before any write, per the plan's server-side-only rule.
  const quota = await checkTripQuota()
  if (!quota.allowed) {
    return { error: quota.reason ?? 'You have reached your trip limit.', quotaExceeded: true }
  }

  const values = parsed.values
  const supabase = await createClient()

  let tripId: string | null = null
  let lastError: string | null = null

  for (const slug of candidateSlugs(values.title)) {
    const { data, error } = await supabase
      .from('trips')
      .insert({
        user_id: user.id,
        title: values.title,
        slug,
        summary: values.summary,
        start_date: values.startDate,
        end_date: values.endDate,
        status: values.status,
        visibility: values.visibility,
        trip_type: values.tripType,
        traveler_count: values.travelerCount,
        budget_planned: values.budgetPlanned,
        currency: values.currency,
        // Public trips need a published_at before the RLS read policy will
        // expose them, so set it at creation rather than leaving them invisible.
        published_at: values.visibility === 'public' ? new Date().toISOString() : null,
      })
      .select('id')
      .single()

    if (!error) {
      tripId = data.id
      break
    }

    // 23505 = unique violation. Anything else is a real failure.
    if (error.code !== '23505') {
      lastError = error.message
      break
    }
  }

  if (!tripId) {
    return {
      error: lastError
        ? `Could not create the trip: ${lastError}`
        : 'Could not find a free URL for that title. Try a slightly different one.',
    }
  }

  const { error: placesError } = await supabase.from('trip_places').insert(
    values.places.map((place, index) => ({
      trip_id: tripId,
      user_id: user.id,
      country_code: place.countryCode,
      region_code: place.regionCode || null,
      city_name: place.cityName || null,
      location: locationOf(place),
      arrival_date: values.startDate,
      departure_date: values.endDate,
      order_index: index,
    }))
  )

  if (placesError) {
    // A trip with no places paints nothing on the globe and is confusing to
    // find later. Roll back rather than leaving a half-created record.
    await supabase.from('trips').delete().eq('id', tripId)
    return { error: `Could not save the places: ${placesError.message}` }
  }

  // Inserting places fires refresh_visited_regions, so the globe and dashboard
  // are already stale by the time we get here.
  revalidatePath('/trips')
  revalidatePath('/globe')
  revalidatePath('/dashboard')
  redirect('/trips')
}

/**
 * Edits an existing trip.
 *
 * Two things deliberately do not change:
 *
 *  - **The slug.** It is the public URL. Renaming a trip someone has linked to
 *    should not break their link.
 *  - **`published_at`.** Once set it stays set, so a trip flipped private and
 *    public again keeps its original publication date rather than jumping to
 *    the top of every list.
 *
 * Ownership is enforced by RLS, not by a `user_id` filter here: `trips_update_own`
 * (and `trips_update_editor` for collaborators) decides which row the update can
 * touch, so someone else's id simply matches nothing.
 */
export async function updateTrip(
  _prev: CreateTripState,
  formData: FormData
): Promise<CreateTripState> {
  await requireUser()

  const tripId = formData.get('tripId')
  if (typeof tripId !== 'string' || !UUID_RE.test(tripId)) {
    return { error: 'Something went wrong submitting the form. Please try again.' }
  }

  const parsed = parsePayload(formData)
  if (!parsed.ok) return parsed.state

  const values = parsed.values
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('trips')
    .select('id, published_at')
    .eq('id', tripId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!existing) {
    return { error: 'That trip no longer exists, or is not yours to edit.' }
  }

  const { error: tripError } = await supabase
    .from('trips')
    .update({
      title: values.title,
      summary: values.summary,
      start_date: values.startDate,
      end_date: values.endDate,
      status: values.status,
      visibility: values.visibility,
      trip_type: values.tripType,
      traveler_count: values.travelerCount,
      budget_planned: values.budgetPlanned,
      currency: values.currency,
      published_at:
        values.visibility === 'public'
          ? (existing.published_at ?? new Date().toISOString())
          : existing.published_at,
    })
    .eq('id', tripId)

  if (tripError) {
    return { error: `Could not save the trip: ${tripError.message}` }
  }

  const placesError = await syncPlaces(tripId, values)
  if (placesError) {
    return { error: `Could not save the places: ${placesError}` }
  }

  // Publishing is the moment a photograph becomes public, so it is the moment
  // its stripped derivative should be built — not the first request for the
  // public page, which used to mean a stranger following a link paid for a sharp
  // pipeline over the whole gallery.
  //
  // `after()` runs it once this response has been sent: the owner pressed a
  // button and something happened, and they do not wait for it. Note this fires
  // whenever the trip is public rather than only on the private → public edge.
  // That is deliberate and costs nothing — the job selects on `public_path is
  // null`, so a trip that was already published finds no work. Detecting the
  // edge would mean trusting a `published_at` comparison to decide whether to
  // bother, and being wrong that way is a gallery nobody converts.
  //
  // `redirect()` below does not cancel it; `after` runs even when the response
  // ends in a redirect or a thrown error.
  if (values.visibility === 'public') {
    after(async () => {
      const result = await buildTripDerivatives(tripId)
      if (result.errors.length > 0) {
        // Logged and dropped. The scheduled sweep retries anything still without
        // a derivative, and the public page's own lazy path is behind that.
        console.error(`derivatives: ${tripId} finished with errors`, result)
      }
    })
  }

  revalidatePath('/trips')
  revalidatePath(`/trips/${tripId}`)
  revalidatePath('/globe')
  revalidatePath('/dashboard')
  redirect(`/trips/${tripId}`)
}

/**
 * Reconciles the submitted places against the stored ones.
 *
 * Rows that came back with an id are updated in place. Deleting and reinserting
 * would be shorter, but `memories.trip_place_id` is `on delete set null`, so
 * every memory pinned to a place would quietly come unpinned on a title edit.
 *
 * Returns an error message, or null on success.
 */
async function syncPlaces(tripId: string, values: CreateTripValues): Promise<string | null> {
  const supabase = await createClient()

  const { data: storedRows, error: readError } = await supabase
    .from('trip_places')
    .select('id')
    .eq('trip_id', tripId)

  if (readError) return readError.message

  const stored = new Set((storedRows ?? []).map((r) => r.id))
  const submitted = values.places.map((place, index) => ({ place, index }))

  // An id the caller does not own resolves to nothing here, so it is treated as
  // a new place rather than trusted.
  const updates = submitted.filter(({ place }) => place.id && stored.has(place.id))
  const inserts = submitted.filter(({ place }) => !place.id || !stored.has(place.id))
  const keptIds = new Set(updates.map(({ place }) => place.id as string))
  const removed = [...stored].filter((id) => !keptIds.has(id))

  for (const { place, index } of updates) {
    const { error } = await supabase
      .from('trip_places')
      .update({
        country_code: place.countryCode,
        region_code: place.regionCode || null,
        city_name: place.cityName || null,
        location: locationOf(place),
        order_index: index,
      })
      .eq('id', place.id as string)

    if (error) return error.message
  }

  if (inserts.length) {
    // user_id is taken from the session rather than the form: trip_places has
    // its own owner column and RLS checks it on insert.
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) return 'Your session expired. Sign in and try again.'

    const { error } = await supabase.from('trip_places').insert(
      inserts.map(({ place, index }) => ({
        trip_id: tripId,
        user_id: userId,
        country_code: place.countryCode,
        region_code: place.regionCode || null,
        city_name: place.cityName || null,
        location: locationOf(place),
        // New places inherit the trip's dates, matching what create does.
        arrival_date: values.startDate,
        departure_date: values.endDate,
        order_index: index,
      }))
    )

    if (error) return error.message
  }

  if (removed.length) {
    const { error } = await supabase.from('trip_places').delete().in('id', removed)
    if (error) return error.message
  }

  return null
}

export interface DeleteTripState {
  error: string | null
}

/**
 * Soft-deletes a trip.
 *
 * `deleted_at` is set rather than the row removed: every read path already
 * filters on it, the aggregate trigger repaints the globe, and the trip stops
 * counting against the plan's quota — but nothing the user wrote is destroyed,
 * which is the plan's rule for anything memory-bearing.
 *
 * It goes through `soft_delete_trip()` rather than a plain UPDATE because a
 * direct write is rejected by RLS: on update Postgres requires the new row to
 * still satisfy the SELECT policies, and `trips_select_own` excludes rows with
 * `deleted_at` set. The function does its own ownership check; see migration
 * 20260812000200.
 */
export async function deleteTrip(
  _prev: DeleteTripState,
  formData: FormData
): Promise<DeleteTripState> {
  await requireUser()

  const tripId = formData.get('tripId')
  if (typeof tripId !== 'string' || !UUID_RE.test(tripId)) {
    return { error: 'Something went wrong. Please try again.' }
  }

  const supabase = await createClient()

  const { data: deleted, error } = await supabase.rpc('soft_delete_trip', { p_trip_id: tripId })

  if (error) {
    return { error: `Could not delete the trip: ${error.message}` }
  }

  // The function returns false when it matched nothing, which is the "already
  // gone, or not yours" case rather than a database failure.
  if (!deleted) {
    return { error: 'That trip no longer exists, or is not yours to delete.' }
  }

  revalidatePath('/trips')
  revalidatePath('/globe')
  revalidatePath('/dashboard')
  revalidatePath('/trash')
  redirect('/trips')
}

export interface RestoreTripResult {
  ok: boolean
  error?: string
  /** Set when the refusal is a plan limit, so the UI can offer an upgrade. */
  quotaExceeded?: boolean
}

/**
 * Restores a soft-deleted trip.
 *
 * The quota check is the interesting part. Deleting a trip frees a slot, so
 * someone at their limit can delete one trip and create another — which means a
 * restore can be the write that takes them over. It is refused here rather than
 * silently allowed, because the alternative is an account quietly over its plan
 * with no screen able to explain why.
 *
 * `restore_trip()` enforces the 30-day window; this does not re-check it. One
 * copy of that rule, in the place that does the write.
 */
export async function restoreTrip(tripId: string): Promise<RestoreTripResult> {
  await requireUser()

  if (!UUID_RE.test(tripId)) {
    return { ok: false, error: 'Something went wrong. Please try again.' }
  }

  const quota = await checkTripQuota()
  if (!quota.allowed) {
    return {
      ok: false,
      error: `Restoring this trip would put you over your plan's ${quota.limit} trips. Upgrade, or delete another trip first — this one stays in the trash either way.`,
      quotaExceeded: true,
    }
  }

  const supabase = await createClient()
  const { data: restored, error } = await supabase.rpc('restore_trip', { p_trip_id: tripId })

  if (error) {
    return { ok: false, error: `Could not restore the trip: ${error.message}` }
  }

  // False means the function matched nothing: not yours, not deleted, or past
  // the retention window. The screen only offers trips inside the window, so in
  // practice this is a race with the window closing.
  if (!restored) {
    return { ok: false, error: 'That trip can no longer be restored.' }
  }

  revalidatePath('/trips')
  revalidatePath('/globe')
  revalidatePath('/dashboard')
  revalidatePath('/trash')
  return { ok: true }
}
