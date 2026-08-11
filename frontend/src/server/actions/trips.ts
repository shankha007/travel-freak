'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/server/supabase/server'
import { requireUser } from '@/server/auth'
import { checkTripQuota } from '@/server/entitlements'
import { createTripSchema, slugify } from '@/shared/validation/trip'

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

export async function createTrip(
  _prev: CreateTripState,
  formData: FormData
): Promise<CreateTripState> {
  const user = await requireUser()

  // The payload is JSON rather than flat fields because `places` is a repeating
  // group, and FormData has no clean representation of nested arrays.
  const raw = formData.get('payload')
  if (typeof raw !== 'string') {
    return { error: 'Something went wrong submitting the form. Please try again.' }
  }

  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(raw)
  } catch {
    return { error: 'Something went wrong submitting the form. Please try again.' }
  }

  const parsed = createTripSchema.safeParse(parsedJson)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.')
      fieldErrors[key] ??= issue.message
    }
    return {
      error: 'Please fix the highlighted fields.',
      fieldErrors,
    }
  }

  // Quota gate runs before any write, per the plan's server-side-only rule.
  const quota = await checkTripQuota()
  if (!quota.allowed) {
    return { error: quota.reason ?? 'You have reached your trip limit.', quotaExceeded: true }
  }

  const values = parsed.data
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
