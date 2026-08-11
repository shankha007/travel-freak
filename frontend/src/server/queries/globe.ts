import 'server-only'

import { createClient } from '@/server/supabase/server'
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
 * No `user_id` filter appears in these queries by design: RLS scopes every row
 * to the caller. Adding a redundant filter would hide a policy regression
 * rather than surface it.
 */

type VisitedRegionRow = Database['public']['Tables']['visited_regions']['Row']

function toVisitedRegion(row: VisitedRegionRow): VisitedRegion {
  return {
    countryCode: row.country_code,
    regionCode: row.region_code ?? '',
    state: row.state,
    visitCount: row.visit_count,
    firstVisit: row.first_visit,
    lastVisit: row.last_visit,
    tripIds: row.trip_ids ?? [],
    cityNames: row.city_names ?? [],
    featuredMediaId: row.featured_media_id,
    // Media lives in a private bucket, so a URL means issuing a signed link.
    // Nothing is uploaded yet; the modal falls back to "No photo yet".
    featuredMediaUrl: null,
  }
}

/** Every region row for the signed-in user, for the globe and region list. */
export async function getVisitedRegions(): Promise<VisitedRegion[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('visited_regions')
    .select('*')
    .order('country_code', { ascending: true })

  if (error) {
    throw new Error(`Could not load visited regions: ${error.message}`)
  }

  return (data ?? []).map(toVisitedRegion)
}

/**
 * Everything the region modal shows for one country.
 *
 * Loaded on demand rather than with the globe: most users open at most a
 * handful of countries per session, and the trips and memories behind a region
 * are far larger than the aggregate row itself.
 */
export async function getRegionDetail(countryCode: string): Promise<RegionDetail | null> {
  const supabase = await createClient()

  const { data: regions } = await supabase
    .from('visited_regions')
    .select('*')
    .eq('country_code', countryCode)

  if (!regions?.length) return null

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
  const visitCount = regions.reduce((sum, r) => sum + r.visit_count, 0)

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
        .select('id, title, slug, summary, start_date, end_date, photo_count')
        .in('id', tripIds)
        .is('deleted_at', null)
        .order('start_date', { ascending: false, nullsFirst: false }),
      supabase
        .from('memories')
        .select('id, kind, body, happened_at')
        .in('trip_id', tripIds)
        .order('happened_at', { ascending: false, nullsFirst: false })
        .limit(10),
      supabase.from('blog_posts').select('trip_id, slug').in('trip_id', tripIds),
    ])

    const blogByTrip = new Map(
      (blogRows.data ?? [])
        .filter((b): b is { trip_id: string; slug: string } => b.trip_id !== null)
        .map((b) => [b.trip_id, b.slug])
    )

    trips = (tripRows.data ?? []).map((t) => ({
      id: t.id,
      title: t.title,
      slug: t.slug,
      startDate: t.start_date,
      endDate: t.end_date,
      summary: t.summary,
      coverMediaUrl: null,
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
    featuredMediaUrl: null,
    trips,
    memories,
  }
}
