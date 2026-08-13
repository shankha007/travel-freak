import 'server-only'

import { createClient } from '@/server/supabase/server'
import { requireUser } from '@/server/auth'
import { buildTimeline, yearOf, type TimelineYear } from '@/shared/timeline'

/**
 * Travel Timeline data — screen 31.
 *
 * Three reads, one shape. Trips and posts are the events; `visited_regions`
 * answers the one question neither can — when each country was *first* reached —
 * because it is rebuilt from trips, "been there" marks and the wishlist together.
 * Deriving it from this page's trips instead would tell someone Japan was new in
 * 2025 when they had already marked it visited during onboarding.
 *
 * Scoped on `user_id` explicitly, not on RLS: `trips` also exposes every
 * published public trip to everyone, so a query trusting RLS alone would put
 * strangers' holidays on your timeline.
 */

export async function getTimeline(): Promise<TimelineYear[]> {
  const supabase = await createClient()
  const user = await requireUser()

  const [tripsResult, postsResult, regionsResult] = await Promise.all([
    supabase
      .from('trips')
      .select(
        `id, title, slug, summary, start_date, end_date, status, photo_count,
         trip_places ( country_code )`
      )
      .eq('user_id', user.id)
      .is('deleted_at', null),
    supabase
      .from('blog_posts')
      .select('id, title, slug, published_at, reading_minutes')
      .eq('user_id', user.id)
      .not('published_at', 'is', null)
      .is('deleted_at', null),
    // Only somewhere actually reached. `visited_regions` carries a `first_visit`
    // for planned countries too — it is the date of the trip you have booked —
    // and counting those would put "first time in Bhutan" on a year whose
    // November has not happened yet.
    supabase
      .from('visited_regions')
      .select('country_code, first_visit')
      .eq('user_id', user.id)
      .in('state', ['visited', 'current'])
      .not('first_visit', 'is', null),
  ])

  const trips = (tripsResult.data ?? []).map((t) => ({
    id: t.id,
    title: t.title,
    slug: t.slug,
    summary: t.summary,
    startDate: t.start_date,
    endDate: t.end_date,
    status: t.status,
    countryCodes: [...new Set((t.trip_places ?? []).map((p) => p.country_code))],
    photoCount: t.photo_count,
  }))

  const posts = (postsResult.data ?? []).map((p) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    publishedAt: p.published_at,
    readingMinutes: p.reading_minutes,
  }))

  // The earliest first visit per country, since subdivision rows each carry
  // their own and a country is new on the first of them.
  const firstVisitYearByCountry = new Map<string, number>()
  for (const row of regionsResult.data ?? []) {
    const year = yearOf(row.first_visit)
    if (year === null) continue
    const known = firstVisitYearByCountry.get(row.country_code)
    if (known === undefined || year < known) {
      firstVisitYearByCountry.set(row.country_code, year)
    }
  }

  return buildTimeline(trips, posts, firstVisitYearByCountry)
}
