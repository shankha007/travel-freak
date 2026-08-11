import 'server-only'

import { differenceInCalendarDays, parseISO } from 'date-fns'
import { createClient } from '@/server/supabase/server'
import { requireUser } from '@/server/auth'
import { rollUpToCountries } from '@/shared/types/globe'
import type { VisitedRegion } from '@/shared/types/globe'
import { getVisitedRegions } from '@/server/queries/globe'

/**
 * Dashboard overview.
 *
 * Counts come from `head: true` count queries rather than fetching rows and
 * measuring the array — the row bodies are never used, and this keeps the
 * dashboard cheap as a user's history grows.
 *
 * Every query filters on `user_id`. RLS also exposes published public trips and
 * posts to everyone, so counting without the filter would greet a new user with
 * a stranger's travel history.
 */

export interface DashboardStats {
  countries: number
  cities: number
  regions: number
  trips: number
  upcomingTrips: number
  blogs: number
  memories: number
  /** Nights across completed trips, summed from their date ranges. */
  travelDays: number
  /** Percentage of the world's countries, rounded. */
  percentOfWorld: number
}

export interface UpcomingTrip {
  id: string
  title: string
  slug: string
  summary: string
  startDate: string | null
  endDate: string | null
  status: string
  /** Negative once the trip has started. */
  daysUntil: number | null
  budgetPlanned: number | null
  currency: string
  places: string[]
}

export interface RecentActivityItem {
  id: string
  kind: 'trip' | 'blog' | 'memory'
  title: string
  at: string
  href: string
}

const TOTAL_COUNTRIES = 195

export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = await createClient()
  const user = await requireUser()
  const regions = await getVisitedRegions()

  const countryLevel = rollUpToCountries(regions)
  const visited = countryLevel.filter((r) => r.state === 'visited' || r.state === 'current')
  const cities = new Set(regions.flatMap((r) => r.cityNames)).size
  // Only subdivision rows count as "regions"; '' is the country-level marker.
  const subdivisions = regions.filter((r) => r.regionCode !== '').length

  const [trips, upcoming, blogs, memories, completedTrips] = await Promise.all([
    supabase
      .from('trips')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('deleted_at', null),
    supabase
      .from('trips')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .in('status', ['planning', 'upcoming']),
    supabase
      .from('blog_posts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('deleted_at', null),
    supabase.from('memories').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase
      .from('trips')
      .select('start_date, end_date')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .is('deleted_at', null),
  ])

  const travelDays = (completedTrips.data ?? []).reduce((sum, t) => {
    if (!t.start_date || !t.end_date) return sum
    return sum + Math.max(0, differenceInCalendarDays(parseISO(t.end_date), parseISO(t.start_date)))
  }, 0)

  return {
    countries: visited.length,
    cities,
    regions: subdivisions,
    trips: trips.count ?? 0,
    upcomingTrips: upcoming.count ?? 0,
    blogs: blogs.count ?? 0,
    memories: memories.count ?? 0,
    travelDays,
    percentOfWorld: Math.round((visited.length / TOTAL_COUNTRIES) * 100),
  }
}

/** The next trip that has not finished, for the countdown widget. */
export async function getUpcomingTrip(): Promise<UpcomingTrip | null> {
  const supabase = await createClient()
  const user = await requireUser()

  const { data } = await supabase
    .from('trips')
    .select('id, title, slug, summary, start_date, end_date, status, budget_planned, currency')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .in('status', ['ongoing', 'upcoming', 'planning'])
    .order('start_date', { ascending: true, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  if (!data) return null

  const { data: places } = await supabase
    .from('trip_places')
    .select('city_name')
    .eq('trip_id', data.id)
    .order('order_index', { ascending: true })

  return {
    id: data.id,
    title: data.title,
    slug: data.slug,
    summary: data.summary,
    startDate: data.start_date,
    endDate: data.end_date,
    status: data.status,
    daysUntil: data.start_date
      ? differenceInCalendarDays(parseISO(data.start_date), new Date())
      : null,
    budgetPlanned: data.budget_planned,
    currency: data.currency,
    places: (places ?? []).map((p) => p.city_name).filter((c): c is string => Boolean(c)),
  }
}

export async function getRecentActivity(limit = 6): Promise<RecentActivityItem[]> {
  const supabase = await createClient()
  const user = await requireUser()

  const [trips, blogs] = await Promise.all([
    supabase
      .from('trips')
      .select('id, title, slug, updated_at')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(limit),
    supabase
      .from('blog_posts')
      .select('id, title, slug, updated_at')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(limit),
  ])

  const items: RecentActivityItem[] = [
    ...(trips.data ?? []).map((t) => ({
      id: t.id,
      kind: 'trip' as const,
      title: t.title,
      at: t.updated_at,
      href: `/trips/${t.id}`,
    })),
    ...(blogs.data ?? []).map((b) => ({
      id: b.id,
      kind: 'blog' as const,
      title: b.title,
      at: b.updated_at,
      href: `/blogs`,
    })),
  ]

  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit)
}

/** Country-level rows for the dashboard's globe preview. */
export async function getGlobePreviewRegions(): Promise<VisitedRegion[]> {
  return rollUpToCountries(await getVisitedRegions())
}
