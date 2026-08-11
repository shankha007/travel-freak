import 'server-only'

import { createClient } from '@/server/supabase/server'
import { requireUser } from '@/server/auth'
import type { Database } from '@/shared/types/database'

/**
 * Trip list data.
 *
 * Filtered on `user_id` explicitly. RLS is a ceiling, not a scope: `trips` also
 * has a policy exposing every *published public* trip to everyone, so a query
 * that leans on RLS alone shows a brand-new user somebody else's holidays as
 * their own. Ownership scoping belongs in the query; RLS is what stops it being
 * bypassed.
 */

export type TripStatus = Database['public']['Enums']['trip_status']
export type Visibility = Database['public']['Enums']['visibility']

export interface TripListItem {
  id: string
  title: string
  slug: string
  summary: string
  startDate: string | null
  endDate: string | null
  status: TripStatus
  visibility: Visibility
  tripType: string | null
  travelerCount: number
  photoCount: number
  places: string[]
  countryCodes: string[]
}

export async function getTrips(): Promise<TripListItem[]> {
  const supabase = await createClient()
  const user = await requireUser()

  const { data, error } = await supabase
    .from('trips')
    .select(
      `id, title, slug, summary, start_date, end_date, status, visibility,
       trip_type, traveler_count, photo_count,
       trip_places ( city_name, country_code, order_index )`
    )
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .order('start_date', { ascending: false, nullsFirst: false })

  if (error) {
    throw new Error(`Could not load trips: ${error.message}`)
  }

  return (data ?? []).map((t) => {
    const places = [...(t.trip_places ?? [])].sort((a, b) => a.order_index - b.order_index)
    return {
      id: t.id,
      title: t.title,
      slug: t.slug,
      summary: t.summary,
      startDate: t.start_date,
      endDate: t.end_date,
      status: t.status,
      visibility: t.visibility,
      tripType: t.trip_type,
      travelerCount: t.traveler_count,
      photoCount: t.photo_count,
      places: places.map((p) => p.city_name).filter((c): c is string => Boolean(c)),
      countryCodes: [...new Set(places.map((p) => p.country_code))],
    }
  })
}

/** The plan's tab split: Past · Ongoing · Upcoming · Drafts. */
export function groupTrips(trips: TripListItem[]) {
  return {
    all: trips,
    past: trips.filter((t) => t.status === 'completed'),
    ongoing: trips.filter((t) => t.status === 'ongoing'),
    upcoming: trips.filter((t) => t.status === 'upcoming' || t.status === 'planning'),
    drafts: trips.filter((t) => t.visibility === 'private' && t.status !== 'completed'),
  }
}
