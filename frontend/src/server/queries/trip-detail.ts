import 'server-only'

import { differenceInCalendarDays, parseISO } from 'date-fns'
import { createClient } from '@/server/supabase/server'
import { getSessionUser } from '@/server/auth'
import { getMediaUrl } from '@/server/queries/vault'
import { displayKeysFor } from '@/server/media/display'
import { pointFrom } from '@/shared/geo/point'
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
  /** The pin, when one was set. Null for a place recorded by name alone. */
  lng: number | null
  lat: number | null
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

export interface TripPhoto {
  id: string
  url: string
  altText: string
  caption: string
}

export interface TripDetail {
  id: string
  /**
   * Whether the caller owns this trip, as opposed to collaborating on it.
   *
   * The page uses it to decide whether to offer the Budget screen, which is
   * owner-only: `expenses` has no collaborator policy, and the card's own
   * subtitle carried the planned figure, so leaving it up for a collaborator
   * would have shown exactly what the screen behind it hides.
   */
  isOwner: boolean
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
  /** A handful of recent photos for the gallery card, with signed URLs. */
  photos: TripPhoto[]
  coverUrl: string | null
  /** The active unlisted link's token, when one has been created. */
  shareToken: string | null
  /** Nights between the dates, or null when the trip has no range yet. */
  durationDays: number | null
  countryCodes: string[]
  cityNames: string[]
}

export async function getTripDetail(id: string): Promise<TripDetail | null> {
  const supabase = await createClient()
  const sessionUser = await getSessionUser()

  // Guard before querying: Postgres rejects a malformed uuid with a 400 rather
  // than an empty result, which would surface as a server error instead of a
  // clean 404 for a typo'd URL.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return null
  }

  const { data: trip } = await supabase
    .from('trips')
    .select(
      `id, user_id, title, slug, summary, start_date, end_date, status, visibility,
       trip_type, traveler_count, budget_planned, currency, cover_media_id,
       photo_count, video_count, audio_count, media_bytes, created_at`
    )
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!trip) return null

  const [placesResult, memoriesResult, blogsResult, photosResult, shareResult] = await Promise.all([
    supabase
      .from('trip_places')
      .select(
        'id, country_code, region_code, city_name, place_kind, arrival_date, departure_date, notes, order_index, latitude, longitude'
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
    // Enough for the gallery card; the vault is where all of them live.
    supabase
      .from('media')
      .select('id, storage_path, mime, alt_text, caption')
      .eq('trip_id', id)
      .eq('kind', 'image')
      .is('deleted_at', null)
      .order('taken_at', { ascending: false, nullsFirst: false })
      .limit(6),
    // Owner-only by RLS, which is what the share card needs: a collaborator
    // viewing this trip gets no token and no controls.
    supabase
      .from('share_links')
      .select('token')
      .eq('trip_id', id)
      .is('revoked_at', null)
      .limit(1)
      .maybeSingle(),
  ])

  // The bucket is private, so thumbnails need short-lived signed links — of the
  // display copy for a HEIC, which no browser but Safari would have drawn.
  const photoRows = photosResult.data ?? []
  const displayKeys = await displayKeysFor(
    photoRows.map((p) => ({ storagePath: p.storage_path, mime: p.mime }))
  )
  const keyOf = (path: string) => displayKeys.get(path) ?? path

  const signed = photoRows.length
    ? await supabase.storage.from('media').createSignedUrls(
        photoRows.map((p) => keyOf(p.storage_path)),
        60 * 60
      )
    : { data: [] }
  const urlByPath = new Map((signed.data ?? []).map((s) => [s.path, s.signedUrl]))

  // The gallery is the six most recent photos, and the cover need not be one of
  // them — an early photo picked as the cover and then followed by six more
  // would leave the hero blank. Sign it on its own when the batch above missed
  // it, which is one extra call and only on the trips that need it.
  const coverInGallery = photoRows.find((p) => p.id === trip.cover_media_id)
  const coverUrl = trip.cover_media_id
    ? coverInGallery
      ? (urlByPath.get(keyOf(coverInGallery.storage_path)) ?? null)
      : await getMediaUrl(trip.cover_media_id)
    : null

  const places = (placesResult.data ?? []).map((p) => {
    const point = pointFrom(p.latitude, p.longitude)
    return {
      id: p.id,
      countryCode: p.country_code,
      regionCode: p.region_code,
      cityName: p.city_name,
      placeKind: p.place_kind,
      arrivalDate: p.arrival_date,
      departureDate: p.departure_date,
      notes: p.notes,
      orderIndex: p.order_index,
      lng: point?.lng ?? null,
      lat: point?.lat ?? null,
    }
  })

  return {
    id: trip.id,
    // Read through `getSessionUser()` rather than `requireUser()`: this query
    // also serves paths that tolerate a signed-out visitor, and there the
    // answer is simply that they do not own it.
    isOwner: sessionUser !== null && trip.user_id === sessionUser.id,
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
    shareToken: shareResult.data?.token ?? null,
    photos: photoRows
      .map((p) => ({
        id: p.id,
        url: urlByPath.get(keyOf(p.storage_path)) ?? null,
        altText: p.alt_text,
        caption: p.caption,
      }))
      .filter((p): p is TripPhoto => p.url !== null),
    coverUrl,
    durationDays:
      trip.start_date && trip.end_date
        ? Math.max(0, differenceInCalendarDays(parseISO(trip.end_date), parseISO(trip.start_date)))
        : null,
    countryCodes: [...new Set(places.map((p) => p.countryCode))],
    cityNames: [...new Set(places.map((p) => p.cityName).filter((c): c is string => Boolean(c)))],
  }
}
