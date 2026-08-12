import 'server-only'

import { cache } from 'react'
import { createClient } from '@/server/supabase/server'
import { requireUser } from '@/server/auth'
import { getMediaUrls } from '@/server/queries/vault'
import { countryName } from '@/shared/geo/countries'
import type {
  RegionDetail,
  RegionMemory,
  RegionTripSummary,
  VisitedRegion,
} from '@/shared/types/globe'
import type { Database } from '@/shared/types/database'

/**
 * Globe data.
 *
 * Reads `visited_regions` only — never `trips`. That aggregate is maintained by
 * `refresh_visited_regions()` triggers, so the globe gets one small result set
 * instead of joining across every trip a user has ever taken.
 *
 * Every query filters on `user_id`. RLS is the ceiling, not the scope: the
 * aggregate also has a policy exposing the rows of anyone with a public
 * profile, which is what makes a shared globe possible — and what would
 * otherwise paint strangers' countries onto your own globe.
 */

type VisitedRegionRow = Database['public']['Tables']['visited_regions']['Row']

function toVisitedRegion(row: VisitedRegionRow, urls?: Map<string, string>): VisitedRegion {
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
    // The media bucket is private, so a URL means minting a signed link.
    // `refresh_visited_regions()` picks the hero: the region's featured photo,
    // falling back to the most recent trip's cover.
    featuredMediaUrl: row.featured_media_id ? (urls?.get(row.featured_media_id) ?? null) : null,
  }
}

/**
 * Every region row for the signed-in user, for the globe and region list.
 *
 * Cached per render pass: the dashboard wants the same rows twice, once for its
 * counters and once for the globe preview, and each call otherwise re-reads the
 * aggregate and re-signs every hero photo.
 */
export const getVisitedRegions = cache(async function getVisitedRegions(): Promise<
  VisitedRegion[]
> {
  const supabase = await createClient()
  const user = await requireUser()

  const { data, error } = await supabase
    .from('visited_regions')
    .select('*')
    .eq('user_id', user.id)
    .order('country_code', { ascending: true })

  if (error) {
    throw new Error(`Could not load visited regions: ${error.message}`)
  }

  const rows = data ?? []
  // One batched signing call for every hero photo, rather than one per region.
  const urls = await getMediaUrls(
    rows.map((r) => r.featured_media_id).filter((id): id is string => Boolean(id))
  )

  return rows.map((row) => toVisitedRegion(row, urls))
})

/**
 * Everything the region modal shows for one country.
 *
 * Loaded on demand rather than with the globe: most users open at most a
 * handful of countries per session, and the trips and memories behind a region
 * are far larger than the aggregate row itself.
 */
export async function getRegionDetail(countryCode: string): Promise<RegionDetail | null> {
  const supabase = await createClient()
  const user = await requireUser()

  const { data: regions } = await supabase
    .from('visited_regions')
    .select('*')
    .eq('user_id', user.id)
    .eq('country_code', countryCode)

  if (!regions?.length) return null

  // The hero photo for the modal, picked by the aggregate across this country's
  // subdivision rows.
  const heroId = regions.map((r) => r.featured_media_id).find((id): id is string => Boolean(id))
  const featuredMediaUrl = heroId ? ((await getMediaUrls([heroId])).get(heroId) ?? null) : null

  // Collapse the country's subdivision rows into one summary.
  const tripIds = [...new Set(regions.flatMap((r) => r.trip_ids ?? []))]
  const cityNames = [...new Set(regions.flatMap((r) => r.city_names ?? []))]
  const firstVisit =
    regions
      .map((r) => r.first_visit)
      .filter(Boolean)
      .sort()[0] ?? null
  const lastVisit =
    regions
      .map((r) => r.last_visit)
      .filter(Boolean)
      .sort()
      .at(-1) ?? null
  // Distinct completed trips across the country's subdivision rows. Summing
  // visit_count would count a single trip once per subdivision it crossed.
  const visitCount = new Set(regions.flatMap((r) => r.visit_trip_ids ?? [])).size

  // 'current' outranks 'visited' outranks 'planned' — same precedence the
  // aggregate itself uses.
  const rank = { current: 3, visited: 2, planned: 1, unvisited: 0 } as const
  const state = regions.reduce(
    (best, r) => (rank[r.state] > rank[best] ? r.state : best),
    'unvisited' as VisitedRegion['state']
  )

  let trips: RegionTripSummary[] = []
  let memories: RegionMemory[] = []

  if (tripIds.length) {
    const [tripRows, memoryRows, blogRows] = await Promise.all([
      supabase
        .from('trips')
        .select('id, title, slug, summary, start_date, end_date, photo_count, cover_media_id')
        .eq('user_id', user.id)
        .in('id', tripIds)
        .is('deleted_at', null)
        .order('start_date', { ascending: false, nullsFirst: false }),
      supabase
        .from('memories')
        .select('id, kind, body, happened_at')
        .eq('user_id', user.id)
        .in('trip_id', tripIds)
        .order('happened_at', { ascending: false, nullsFirst: false })
        .limit(10),
      supabase
        .from('blog_posts')
        .select('trip_id, slug')
        .eq('user_id', user.id)
        .in('trip_id', tripIds),
    ])

    const blogByTrip = new Map(
      (blogRows.data ?? [])
        .filter((b): b is { trip_id: string; slug: string } => b.trip_id !== null)
        .map((b) => [b.trip_id, b.slug])
    )

    // One signing call covering every trip cover in the modal.
    const coverUrls = await getMediaUrls(
      (tripRows.data ?? []).map((t) => t.cover_media_id).filter((id): id is string => Boolean(id))
    )

    trips = (tripRows.data ?? []).map((t) => ({
      id: t.id,
      title: t.title,
      slug: t.slug,
      startDate: t.start_date,
      endDate: t.end_date,
      summary: t.summary,
      coverMediaUrl: t.cover_media_id ? (coverUrls.get(t.cover_media_id) ?? null) : null,
      blogSlug: blogByTrip.get(t.id) ?? null,
      photoCount: t.photo_count,
    }))

    memories = (memoryRows.data ?? []).map((m) => ({
      id: m.id,
      kind: m.kind,
      body: m.body,
      happenedAt: m.happened_at,
      mediaUrl: null,
    }))
  }

  return {
    countryCode,
    regionCode: '',
    countryName: countryName(countryCode),
    state,
    visitCount,
    firstVisit,
    lastVisit,
    cityNames,
    featuredMediaUrl,
    trips,
    memories,
  }
}
