import 'server-only'

import { createClient } from '@/server/supabase/server'
import { requireUser } from '@/server/auth'
import { getEntitlements } from '@/server/entitlements'
import { pointFrom } from '@/shared/geo/point'
import { TOTAL_COUNTRIES } from '@/shared/geo/countries'
import { rollUpToCountries, type VisitedRegion } from '@/shared/types/globe'
import {
  countByKind,
  distanceCoverage,
  totalDistanceKm,
  yearsTravelling,
  type DistanceCoverage,
  type ResumePlace,
} from '@/shared/resume'
import {
  budgetByCurrency,
  byTripType,
  favouriteDestinations,
  perYear,
  tripLengths,
  yearsWithTravel,
  type AnalyticsExpense,
  type AnalyticsTrip,
  type BudgetByCurrency,
  type FavouriteDestinations,
  type TripLengthSummary,
  type TripTypeBreakdown,
  type YearStat,
} from '@/shared/analytics'

/**
 * Everything the Analytics screen renders — screen 32.
 *
 * One read of the three tables that hold the answers, then the arithmetic in
 * `shared/analytics.ts`. Nothing here computes anything itself, so every number
 * on the screen has a unit test behind it.
 *
 * Scoped to `user.id` explicitly even though RLS would do it: `trips` carries a
 * policy exposing every published public trip, so an unscoped count would fold
 * strangers' holidays into your own averages.
 */

export interface AnalyticsHeadline {
  countries: number
  percentOfWorld: number
  /** Subdivision rows only — states and provinces, not the country markers. */
  regions: number
  cities: number
  trips: number
  /** Days away on trips that have happened. */
  travelDays: number
  yearsTravelling: number
  /** Approximate: straight lines between recorded stops. Null when nothing is pinned. */
  distanceKm: number | null
  /** How many trips the distance figure could actually measure. */
  pinned: DistanceCoverage
}

export interface AnalyticsData {
  headline: AnalyticsHeadline
  years: YearStat[]
  lengths: TripLengthSummary | null
  budgets: BudgetByCurrency[]
  types: TripTypeBreakdown
  destinations: FavouriteDestinations
  /** Every trip, for the heatmap — which needs the spans, not a summary. */
  trips: AnalyticsTrip[]
  /** Years the heatmap can offer, newest first. */
  heatmapYears: number[]
  /** Trips with no dates, which contribute to no year and are said so. */
  undatedTrips: number
  /** From `plans.limits.analytics_advanced`. Decides the paid half of the screen. */
  showsAdvanced: boolean
}

export async function getAnalytics(): Promise<AnalyticsData> {
  const supabase = await createClient()
  const user = await requireUser()

  const [tripRows, placeRows, regionRows, expenseRows, entitlements] = await Promise.all([
    supabase
      .from('trips')
      .select(
        'id, title, slug, start_date, end_date, status, trip_type, budget_planned, currency, trip_places ( country_code )'
      )
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('start_date', { ascending: false, nullsFirst: false }),
    supabase
      .from('trip_places')
      .select(
        'country_code, region_code, city_name, place_kind, latitude, longitude, trip_id, order_index'
      )
      .eq('user_id', user.id),
    supabase.from('visited_regions').select('*').eq('user_id', user.id),
    // What was actually spent, which until now this screen has never read. The
    // `expenses` policy is `user_id = auth.uid()` and nothing else, so this is
    // the caller's own spend and no collaborator's — the same line the budget
    // screen is drawn on, and the reason a collaborator sees plans only.
    supabase.from('expenses').select('trip_id, amount, currency').eq('user_id', user.id),
    getEntitlements(),
  ])

  const trips: AnalyticsTrip[] = (tripRows.data ?? []).map((t) => ({
    id: t.id,
    title: t.title,
    slug: t.slug,
    startDate: t.start_date,
    endDate: t.end_date,
    status: t.status,
    tripType: t.trip_type,
    // `numeric` arrives as a string from PostgREST when it is large enough, so
    // it is coerced here rather than trusted to already be a number.
    budgetPlanned: t.budget_planned === null ? null : Number(t.budget_planned),
    currency: t.currency,
    countryCodes: [...new Set((t.trip_places ?? []).map((p) => p.country_code))],
  }))

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

  const expenses: AnalyticsExpense[] = (expenseRows.data ?? []).map((e) => ({
    tripId: e.trip_id,
    // `numeric` arrives as a string from PostgREST once it is large enough.
    amount: Number(e.amount),
    currency: e.currency,
  }))

  const regions: VisitedRegion[] = (regionRows.data ?? []).map((r) => ({
    countryCode: r.country_code,
    regionCode: r.region_code ?? '',
    state: r.state,
    visitCount: r.visit_count,
    visitTripIds: r.visit_trip_ids ?? [],
    firstVisit: r.first_visit,
    lastVisit: r.last_visit,
    tripIds: r.trip_ids ?? [],
    cityNames: r.city_names ?? [],
    featuredMediaId: r.featured_media_id,
    featuredMediaUrl: null,
  }))

  const years = perYear(trips)
  const visitedCountries = rollUpToCountries(regions).filter(
    (r) => r.state === 'visited' || r.state === 'current'
  ).length

  return {
    headline: {
      countries: visitedCountries,
      percentOfWorld: Math.round((visitedCountries / TOTAL_COUNTRIES) * 100),
      regions: regions.filter((r) => r.regionCode !== '').length,
      cities: countByKind(places).city,
      trips: trips.length,
      // Summed from the per-year rows rather than counted again, so the headline
      // and the chart under it cannot disagree.
      travelDays: years.reduce((sum, y) => sum + y.days, 0),
      yearsTravelling: yearsTravelling(trips.map((t) => t.startDate)),
      distanceKm: totalDistanceKm(places),
      pinned: distanceCoverage(places),
    },
    years,
    lengths: tripLengths(trips),
    budgets: budgetByCurrency(trips, expenses),
    types: byTripType(trips),
    destinations: favouriteDestinations(regions, 6),
    trips,
    heatmapYears: yearsWithTravel(trips),
    undatedTrips: trips.filter((t) => !t.startDate).length,
    showsAdvanced: entitlements.limits.analytics_advanced === true,
  }
}
