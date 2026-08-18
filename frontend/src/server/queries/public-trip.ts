import 'server-only'

import { differenceInCalendarDays, parseISO } from 'date-fns'
import { createAdminClient, createClient } from '@/server/supabase/server'
import { ensurePublicDerivative, publicMediaUrl } from '@/server/media/derivatives'
import { derivativePath } from '@/shared/media'
import { publicEnv } from '@/shared/env'
import { pointFrom } from '@/shared/geo/point'
import { mapWithConcurrency } from '@/shared/concurrency'
import type { Database } from '@/shared/types/database'

/**
 * The public trip page — screen 37.
 *
 * Two ways in, and they differ in who vouches for the visitor:
 *
 *  - **By slug.** The trip is public and published, so RLS lets anyone read it
 *    and the ordinary client does the work.
 *  - **By token.** The trip is unlisted, which means RLS deliberately will not
 *    return it to a stranger. `resolve_share_link()` trades the token for one
 *    trip id, and only then does the service role read that one trip. Every
 *    query on that path is scoped by the id the token produced — the elevated
 *    client is doing exactly what the token authorised and nothing else.
 *
 * Photos are always derivatives, never originals: see server/media/derivatives.
 */

type Visibility = Database['public']['Enums']['visibility']
type MemoryKind = Database['public']['Enums']['memory_kind']

export interface PublicTripPhoto {
  id: string
  url: string
  caption: string
  altText: string
}

export interface PublicTripPlace {
  id: string
  countryCode: string
  regionCode: string | null
  cityName: string | null
  placeKind: string
  arrivalDate: string | null
  departureDate: string | null
  notes: string
  /**
   * The stop's pin, when the owner set one, so the public page can draw the
   * route its timeline describes.
   *
   * This is a coordinate on a page the owner chose to publish, beside a city
   * name that is already on it — not a photograph's EXIF, which publication
   * strips and will go on stripping. A trip nobody published is not reachable
   * here at all, and an unlisted one is only reachable with its token.
   */
  lat: number | null
  lng: number | null
}

export interface PublicTripMemory {
  id: string
  kind: MemoryKind
  body: string
  happenedAt: string | null
}

export interface PublicTripPost {
  id: string
  title: string
  slug: string
  excerpt: string
  readingMinutes: number
}

export interface PublicTrip {
  id: string
  title: string
  slug: string
  summary: string
  startDate: string | null
  endDate: string | null
  status: string
  visibility: Visibility
  tripType: string | null
  travelerCount: number
  durationDays: number | null
  countryCodes: string[]
  cityNames: string[]
  places: PublicTripPlace[]
  memories: PublicTripMemory[]
  photos: PublicTripPhoto[]
  posts: PublicTripPost[]
  coverUrl: string | null
  /** Null when the author's profile is private — a trip can be public alone. */
  author: { username: string; displayName: string } | null
  showsBadge: boolean
  /** True when reached by an unlisted link rather than a public URL. */
  viaShareLink: boolean
}

const SELECT_TRIP = `id, user_id, title, slug, summary, start_date, end_date, status,
  visibility, trip_type, traveler_count, published_at, cover_media_id`

/** How many photos may be re-encoded at once. See the loop that uses it. */
const DERIVATIVE_CONCURRENCY = 4

/** A published public trip, by slug. Null when there is nothing public to show. */
export async function getPublicTrip(slug: string): Promise<PublicTrip | null> {
  const supabase = await createClient()

  const { data: trip } = await supabase
    .from('trips')
    .select(SELECT_TRIP)
    .eq('slug', slug)
    .is('deleted_at', null)
    .maybeSingle()

  // RLS already refused anything that is not public and published — except for
  // the owner, who may be previewing. Either way the page renders.
  if (!trip) return null

  return loadTrip(trip, { viaShareLink: false })
}

/**
 * An unlisted trip, by share token.
 *
 * The token is the authorisation. Once it resolves, the read is done with the
 * service role because RLS has no way to know about it — scoped, every time, to
 * the single id the token produced.
 */
export async function getSharedTrip(token: string): Promise<PublicTrip | null> {
  if (!token || token.length > 128) return null

  const supabase = await createClient()
  const { data: tripId } = await supabase.rpc('resolve_share_link', { p_token: token })

  if (!tripId) return null

  const admin = createAdminClient()
  const { data: trip } = await admin
    .from('trips')
    .select(SELECT_TRIP)
    .eq('id', tripId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!trip) return null

  return loadTrip(trip, { viaShareLink: true, elevated: true })
}

type TripRow = {
  id: string
  user_id: string
  title: string
  slug: string
  summary: string
  start_date: string | null
  end_date: string | null
  status: string
  visibility: Visibility
  trip_type: string | null
  traveler_count: number
  published_at: string | null
  cover_media_id: string | null
}

/**
 * Everything hanging off a trip, for whichever client is entitled to read it.
 *
 * `elevated` means the caller already proved a token, so the service role is in
 * play and RLS is not filtering anything. On that path every query is scoped by
 * this trip's id or its owner's, and the two places where visibility still
 * matters — the author's profile and which posts to list — are enforced here by
 * hand, because there is nothing else left to enforce them.
 */
async function loadTrip(
  trip: TripRow,
  { viaShareLink, elevated = false }: { viaShareLink: boolean; elevated?: boolean }
): Promise<PublicTrip> {
  const supabase = elevated ? createAdminClient() : await createClient()

  const [placesResult, memoriesResult, mediaResult, postsResult, profileResult, badgeResult] =
    await Promise.all([
      supabase
        .from('trip_places')
        .select(
          'id, country_code, region_code, city_name, place_kind, arrival_date, departure_date, notes, order_index, latitude, longitude'
        )
        .eq('trip_id', trip.id)
        .order('order_index', { ascending: true }),
      supabase
        .from('memories')
        .select('id, kind, body, happened_at')
        .eq('trip_id', trip.id)
        .order('happened_at', { ascending: true, nullsFirst: false })
        .order('order_index', { ascending: true }),
      supabase
        .from('media')
        .select('id, user_id, trip_id, storage_path, public_path, caption, alt_text')
        .eq('trip_id', trip.id)
        .eq('kind', 'image')
        .is('deleted_at', null)
        .order('taken_at', { ascending: true, nullsFirst: false })
        .limit(24),
      supabase
        .from('blog_posts')
        .select('id, title, slug, excerpt, reading_minutes, visibility, published_at')
        .eq('trip_id', trip.id)
        .is('deleted_at', null)
        .order('published_at', { ascending: false, nullsFirst: false }),
      supabase
        .from('profiles')
        .select('username, display_name, is_public')
        .eq('id', trip.user_id)
        .maybeSingle(),
      supabase.rpc('trip_shows_branding_badge', { p_trip_id: trip.id }),
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
    // Through `pointFrom` like everywhere else: PostGREST hands geography back
    // as hex EWKB, and these are the generated columns that undo that.
    lat: pointFrom(p.latitude, p.longitude)?.lat ?? null,
    lng: pointFrom(p.latitude, p.longitude)?.lng ?? null,
  }))

  const env = publicEnv()
  const photoRows = (mediaResult.data ?? []).filter((row) => row.trip_id !== null)

  // Normally a no-op now, and kept for the times it is not.
  //
  // Derivatives are built when the trip is published — `after()` on the publish
  // action, with `/api/cron/build-derivatives` sweeping up whatever that missed —
  // so this call almost always finds `public_path` already set and returns it
  // without touching storage. It stays because *correctness* cannot depend on a
  // job having run: a trip published before any of that existed, or a photo whose
  // conversion has failed twice, still has to render a page rather than a hole.
  //
  // Which is why the concurrency cap remains too. On the rare request that does
  // real work, each photo downloads an original and runs a sharp pipeline, and
  // letting two dozen do that at once trades a slow page for an exhausted server.
  const resolved = await mapWithConcurrency(photoRows, DERIVATIVE_CONCURRENCY, (row) =>
    ensurePublicDerivative({
      id: row.id,
      userId: row.user_id,
      storagePath: row.storage_path,
      publicPath: row.public_path,
      target: derivativePath(row.user_id, row.trip_id as string, row.id),
    })
  )

  const photos: PublicTripPhoto[] = photoRows
    // A photo that cannot be safely converted is left out rather than served
    // from the original.
    .map((row, i) => ({ row, path: resolved[i].path }))
    .filter((entry): entry is { row: (typeof photoRows)[number]; path: string } =>
      Boolean(entry.path)
    )
    .map(({ row, path }) => ({
      id: row.id,
      url: publicMediaUrl(env.NEXT_PUBLIC_SUPABASE_URL, path),
      caption: row.caption,
      altText: row.alt_text,
    }))

  // Published public posts only. On the elevated path RLS is not doing this,
  // so it is spelled out.
  const posts = (postsResult.data ?? [])
    .filter((p) => p.visibility === 'public' && p.published_at !== null)
    .map((p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      excerpt: p.excerpt,
      readingMinutes: p.reading_minutes,
    }))

  const profile = profileResult.data
  const author =
    profile && profile.is_public
      ? { username: profile.username, displayName: profile.display_name || profile.username }
      : null

  const cover = photos.find((p) => p.id === trip.cover_media_id) ?? photos[0] ?? null

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
    durationDays:
      trip.start_date && trip.end_date
        ? Math.max(0, differenceInCalendarDays(parseISO(trip.end_date), parseISO(trip.start_date)))
        : null,
    countryCodes: [...new Set(places.map((p) => p.countryCode))],
    cityNames: [...new Set(places.map((p) => p.cityName).filter((c): c is string => Boolean(c)))],
    places,
    memories: (memoriesResult.data ?? []).map((m) => ({
      id: m.id,
      kind: m.kind,
      body: m.body,
      happenedAt: m.happened_at,
    })),
    photos,
    posts,
    coverUrl: cover?.url ?? null,
    author,
    showsBadge: badgeResult.data !== false,
    viaShareLink,
  }
}
