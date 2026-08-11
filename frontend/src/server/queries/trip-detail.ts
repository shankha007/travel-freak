import 'server-only'

import { differenceInCalendarDays, parseISO } from 'date-fns'
import { createClient } from '@/server/supabase/server'
import type { Database } from '@/shared/types/database'

/**
 * One trip, with everything the detail page renders.
 *
 * Scoped by RLS: a signed-in user gets their own trips, plus public ones and
 * any they collaborate on. An id belonging to someone else simply returns
 * nothing, which the page turns into a 404 — the same response as an id that
 * does not exist, so this cannot be used to probe for which trips are real.
 */

type TripStatus = Database['public']['Enums']['trip_status']
type Visibility = Database['public']['Enums']['visibility']
type MemoryKind = Database['public']['Enums']['memory_kind']

export interface TripPlaceDetail {
  id: string
  countryCode: string
  regionCode: string | null
  cityName: string | null
  placeKind: string
  arrivalDate: string | null
  departureDate: string | null
  notes: string
  orderIndex: number
}

export interface TripMemory {
  id: string
  kind: MemoryKind
  body: string
  happenedAt: string | null
}

export interface TripBlog {
  id: string
  title: string
  slug: string
  excerpt: string
  readingMinutes: number
  visibility: Visibility
  publishedAt: string | null
}

export interface TripDetail {
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
  budgetPlanned: number | null
  currency: string
  photoCount: number
  videoCount: number
  audioCount: number
  mediaBytes: number
  createdAt: string
  places: TripPlaceDetail[]
  memories: TripMemory[]
  blogs: TripBlog[]
  /** Nights between the dates, or null when the trip has no range yet. */
  durationDays: number | null
  countryCodes: string[]
  cityNames: string[]
}

export async function getTripDetail(id: string): Promise<TripDetail | null> {
  const supabase = await createClient()

  // Guard before querying: Postgres rejects a malformed uuid with a 400 rather
  // than an empty result, which would surface as a server error instead of a
  // clean 404 for a typo'd URL.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return null
  }

  const { data: trip } = await supabase
    .from('trips')
    .select(
      `id, title, slug, summary, start_date, end_date, status, visibility,
       trip_type, traveler_count, budget_planned, currency,
       photo_count, video_count, audio_count, media_bytes, created_at`
    )
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!trip) return null

  const [placesResult, memoriesResult, blogsResult] = await Promise.all([
    supabase
      .from('trip_places')
      .select(
        'id, country_code, region_code, city_name, place_kind, arrival_date, departure_date, notes, order_index'
      )
      .eq('trip_id', id)
      .order('order_index', { ascending: true }),
    supabase
      .from('memories')
      .select('id, kind, body, happened_at')
      .eq('trip_id', id)
      .order('happened_at', { ascending: true, nullsFirst: false })
      .order('order_index', { ascending: true }),
    supabase
      .from('blog_posts')
      .select('id, title, slug, excerpt, reading_minutes, visibility, published_at')
      .eq('trip_id', id)
      .is('deleted_at', null)
      .order('published_at', { ascending: false, nullsFirst: false }),
  ])

  const places = (placesResult.data ?? []).map((p) => ({
    id: p.id,
    countryCode: p.country_code,
    regionCode: p.region_code,
    cityName: p.city_name,
    placeKind: p.place_kind,
    arrivalDate: p.arrival_date,
    departureDate: p.departure_date,
    notes: p.notes,
    orderIndex: p.order_index,
  }))

  return {
    id: trip.id,
    title: trip.title,
    slug: trip.slug,
    summary: trip.summary,
    startDate: trip.start_date,
    endDate: trip.end_date,
    status: trip.status,
    visibility: trip.visibility,
    tripType: trip.trip_type,
    travelerCount: trip.traveler_count,
    budgetPlanned: trip.budget_planned,
    currency: trip.currency,
    photoCount: trip.photo_count,
    videoCount: trip.video_count,
    audioCount: trip.audio_count,
    mediaBytes: trip.media_bytes,
    createdAt: trip.created_at,
    places,
    memories: (memoriesResult.data ?? []).map((m) => ({
      id: m.id,
      kind: m.kind,
      body: m.body,
      happenedAt: m.happened_at,
    })),
    blogs: (blogsResult.data ?? []).map((b) => ({
      id: b.id,
      title: b.title,
      slug: b.slug,
      excerpt: b.excerpt,
      readingMinutes: b.reading_minutes,
      visibility: b.visibility,
      publishedAt: b.published_at,
    })),
    durationDays:
      trip.start_date && trip.end_date
        ? Math.max(0, differenceInCalendarDays(parseISO(trip.end_date), parseISO(trip.start_date)))
        : null,
    countryCodes: [...new Set(places.map((p) => p.countryCode))],
    cityNames: [...new Set(places.map((p) => p.cityName).filter((c): c is string => Boolean(c)))],
  }
}
