import 'server-only'

import { createClient } from '@/server/supabase/server'
import { getMediaUrls } from '@/server/queries/vault'
import { rollUpToCountries, type VisitedRegion } from '@/shared/types/globe'
import {
  PLACE_KINDS,
  countByKind,
  distanceCoverage,
  totalDistanceKm,
  yearsTravelling,
  type DistanceCoverage,
  type PlaceKind,
  type ResumePlace,
} from '@/shared/resume'
import { TOTAL_COUNTRIES } from '@/shared/geo/countries'
import { totalDaysAway } from '@/shared/timeline'
import { pointFrom } from '@/shared/geo/point'
import type { Database } from '@/shared/types/database'

/**
 * Travel Resume data — screen 33.
 *
 * The same query serves the owner's `/resume` and the public `/u/[username]`,
 * because they are the same artifact seen from two sides. What differs is
 * entirely decided by RLS: for the owner every row is visible, and for a visitor
 * only what the policies expose — a public profile's aggregate, its published
 * trips and its published posts. Nothing here filters on "is this public"
 * itself, so there is one place to get that wrong instead of two.
 */

type Visibility = Database['public']['Enums']['visibility']

export interface ResumeProfile {
  id: string
  username: string
  displayName: string
  bio: string
  avatarUrl: string | null
  countryCode: string | null
  city: string | null
  interests: string[]
  isPublic: boolean
  memberSince: string
}

export interface ResumeTrip {
  id: string
  title: string
  slug: string
  summary: string
  startDate: string | null
  endDate: string | null
  visibility: Visibility
  countryCodes: string[]
  coverUrl: string | null
}

export interface ResumePost {
  id: string
  title: string
  slug: string
  excerpt: string
  readingMinutes: number
  publishedAt: string | null
}

export interface ResumeStats {
  countries: number
  regions: number
  trips: number
  /** Distinct places by kind: cities, mountains, beaches, UNESCO sites… */
  places: Record<PlaceKind, number>
  /** Approximate, and null until places carry coordinates. */
  distanceKm: number | null
  /**
   * How much of that figure is measured. Null for a visitor, who is not shown
   * distance at all — the card says so rather than implying nothing is pinned.
   */
  distancePinned: DistanceCoverage | null
  yearsTravelling: number
  travelDays: number
  percentOfWorld: number
  firstTrip: string | null
  latestTrip: string | null
}

export interface ResumeData {
  profile: ResumeProfile
  stats: ResumeStats
  regions: VisitedRegion[]
  trips: ResumeTrip[]
  posts: ResumePost[]
  /** False once the author is on a paid plan. Free public pages carry the badge. */
  showsBadge: boolean
}

/** Looks up a profile by username. Returns null when there is none to show. */
export async function getProfileByUsername(username: string): Promise<ResumeProfile | null> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('profiles')
    .select(
      'id, username, display_name, bio, avatar_url, country_code, city, travel_interests, is_public, created_at'
    )
    .eq('username', username.toLowerCase())
    .maybeSingle()

  return data ? toProfile(data) : null
}

export async function getOwnProfile(userId: string): Promise<ResumeProfile | null> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('profiles')
    .select(
      'id, username, display_name, bio, avatar_url, country_code, city, travel_interests, is_public, created_at'
    )
    .eq('id', userId)
    .maybeSingle()

  return data ? toProfile(data) : null
}

type ProfileRow = {
  id: string
  username: string
  display_name: string
  bio: string
  avatar_url: string | null
  country_code: string | null
  city: string | null
  travel_interests: string[]
  is_public: boolean
  created_at: string
}

function toProfile(row: ProfileRow): ResumeProfile {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name || row.username,
    bio: row.bio,
    avatarUrl: row.avatar_url,
    countryCode: row.country_code,
    city: row.city,
    interests: row.travel_interests ?? [],
    isPublic: row.is_public,
    memberSince: row.created_at,
  }
}

/**
 * Everything the resume renders for one person.
 *
 * `viewerIsOwner` decides where the counters come from, and the distinction is
 * not cosmetic. An owner can read all of their own rows, so the numbers are
 * computed here. A visitor cannot — RLS shows them published trips only — so
 * counting from rows would make a shared resume shrink: countries taken from
 * the public aggregate, cities taken from a fraction of the history.
 *
 * For a visitor the counts come from `public_place_counts()` and
 * `public_resume_stats()`, which aggregate over everything and return no row
 * that identifies a private trip. That is the same stance `visited_regions`
 * already takes for the public globe.
 */
export async function getResumeData(
  profile: ResumeProfile,
  { viewerIsOwner }: { viewerIsOwner: boolean }
): Promise<ResumeData> {
  const supabase = await createClient()

  const [regionRows, placeRows, tripRows, postRows, badge] = await Promise.all([
    supabase
      .from('visited_regions')
      .select('*')
      .eq('user_id', profile.id)
      .order('country_code', { ascending: true }),
    // Only the owner has anything to compute from these: a visitor's place
    // counts come from `public_place_counts()` and their distance is withheld
    // outright, so on a public profile this query's every row would be dropped.
    viewerIsOwner
      ? supabase
          .from('trip_places')
          .select(
            'country_code, region_code, city_name, place_kind, latitude, longitude, trip_id, order_index'
          )
          .eq('user_id', profile.id)
      : Promise.resolve({ data: null }),
    supabase
      .from('trips')
      .select(
        'id, title, slug, summary, start_date, end_date, status, visibility, published_at, cover_media_id, trip_places ( country_code )'
      )
      .eq('user_id', profile.id)
      .is('deleted_at', null)
      .order('start_date', { ascending: false, nullsFirst: false }),
    supabase
      .from('blog_posts')
      .select('id, title, slug, excerpt, reading_minutes, published_at')
      .eq('user_id', profile.id)
      .is('deleted_at', null)
      .not('published_at', 'is', null)
      .order('published_at', { ascending: false })
      .limit(10),
    supabase.rpc('shows_branding_badge', { p_user_id: profile.id }),
  ])

  const regions = (regionRows.data ?? []).map(toVisitedRegion)
  const places: ResumePlace[] = (placeRows.data ?? []).map((p) => {
    const point = pointFrom(p.latitude, p.longitude)
    return {
      countryCode: p.country_code,
      regionCode: p.region_code,
      cityName: p.city_name,
      placeKind: p.place_kind,
      lng: point?.lng ?? null,
      lat: point?.lat ?? null,
      tripId: p.trip_id,
      orderIndex: p.order_index,
    }
  })

  const allTrips = tripRows.data ?? []
  // A visitor sees the trips they could actually open; the owner sees all of
  // theirs. RLS has already removed anyone else's.
  const visibleTrips = viewerIsOwner
    ? allTrips
    : allTrips.filter((t) => t.visibility === 'public' && t.published_at !== null)

  // Signing the covers and counting a visitor's trips are unrelated; neither
  // needs the other's answer.
  const [coverUrls, counters] = await Promise.all([
    getMediaUrls(
      visibleTrips.map((t) => t.cover_media_id).filter((id): id is string => Boolean(id))
    ),
    viewerIsOwner ? ownCounters(allTrips, places) : publicCounters(profile.id),
  ])

  const countryLevel = rollUpToCountries(regions)
  const visitedCountries = countryLevel.filter(
    (r) => r.state === 'visited' || r.state === 'current'
  ).length

  return {
    profile,
    regions,
    stats: {
      countries: visitedCountries,
      // Only subdivision rows count as regions; '' is the country-level marker.
      regions: regions.filter((r) => r.regionCode !== '').length,
      percentOfWorld: Math.round((visitedCountries / TOTAL_COUNTRIES) * 100),
      // Distance needs the coordinates themselves, which are never public, so a
      // visitor is shown neither the figure nor the coverage behind it.
      distanceKm: viewerIsOwner ? totalDistanceKm(places) : null,
      distancePinned: viewerIsOwner ? distanceCoverage(places) : null,
      ...counters,
    },
    trips: visibleTrips.map((t) => ({
      id: t.id,
      title: t.title,
      slug: t.slug,
      summary: t.summary,
      startDate: t.start_date,
      endDate: t.end_date,
      visibility: t.visibility,
      countryCodes: [...new Set((t.trip_places ?? []).map((p) => p.country_code))],
      coverUrl: t.cover_media_id ? (coverUrls.get(t.cover_media_id) ?? null) : null,
    })),
    posts: (postRows.data ?? []).map((p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      excerpt: p.excerpt,
      readingMinutes: p.reading_minutes,
      publishedAt: p.published_at,
    })),
    showsBadge: badge.data !== false,
  }
}

/** The counters that differ between the owner's view and a visitor's. */
type ResumeCounters = Pick<
  ResumeStats,
  'trips' | 'places' | 'yearsTravelling' | 'travelDays' | 'firstTrip' | 'latestTrip'
>

type TripRow = { start_date: string | null; end_date: string | null; status: string }

function ownCounters(trips: TripRow[], places: ResumePlace[]): ResumeCounters {
  const dates = trips.map((t) => t.start_date)
  const sorted = dates.filter((d): d is string => Boolean(d)).sort()

  return {
    trips: trips.length,
    places: countByKind(places),
    yearsTravelling: yearsTravelling(dates),
    // `totalDaysAway` rather than the subtraction that used to live here. That
    // one measured a trip as its end minus its start — a Friday-to-Sunday
    // weekend as two days — and counted trips nobody had taken yet, so the same
    // account read 103 days on the resume and 104 on the analytics screen. The
    // definition is the timeline's now, and all three read it from there.
    travelDays: totalDaysAway(
      trips.map((t) => ({ startDate: t.start_date, endDate: t.end_date, status: t.status }))
    ),
    firstTrip: sorted[0] ?? null,
    latestTrip: sorted.at(-1) ?? null,
  }
}

/**
 * The same counters for someone who cannot read the rows behind them.
 *
 * Falls back to zeroes if the functions return nothing, which happens when the
 * profile is not public — the page would have 404'd before reaching here, so
 * this is belt to the braces rather than a real path.
 */
async function publicCounters(userId: string): Promise<ResumeCounters> {
  const supabase = await createClient()

  const [kinds, stats] = await Promise.all([
    supabase.rpc('public_place_counts', { p_user_id: userId }),
    supabase.rpc('public_resume_stats', { p_user_id: userId }),
  ])

  const places = Object.fromEntries(PLACE_KINDS.map((kind) => [kind, 0])) as Record<
    PlaceKind,
    number
  >
  for (const row of kinds.data ?? []) {
    const kind = (PLACE_KINDS as readonly string[]).includes(row.place_kind)
      ? (row.place_kind as PlaceKind)
      : 'other'
    places[kind] += row.place_count
  }

  const summary = stats.data?.[0]

  return {
    trips: summary?.trips_count ?? 0,
    places,
    yearsTravelling: summary?.years_travelling ?? 0,
    travelDays: summary?.travel_days ?? 0,
    firstTrip: summary?.first_trip ?? null,
    latestTrip: summary?.latest_trip ?? null,
  }
}

type VisitedRegionRow = Database['public']['Tables']['visited_regions']['Row']

function toVisitedRegion(row: VisitedRegionRow): VisitedRegion {
  return {
    countryCode: row.country_code,
    regionCode: row.region_code ?? '',
    state: row.state,
    visitCount: row.visit_count,
    visitTripIds: row.visit_trip_ids ?? [],
    firstVisit: row.first_visit,
    lastVisit: row.last_visit,
    tripIds: row.trip_ids ?? [],
    cityNames: row.city_names ?? [],
    featuredMediaId: row.featured_media_id,
    // The resume shows counts and a globe, not photos; leaving this null keeps
    // it from signing URLs nobody is going to look at.
    featuredMediaUrl: null,
  }
}
