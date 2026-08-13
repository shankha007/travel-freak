import 'server-only'

import { createClient } from '@/server/supabase/server'
import { requireUser } from '@/server/auth'
import { countryFlag, countryName } from '@/shared/geo/countries'

/**
 * The wishlist — screen 30.
 *
 * These rows are one of the three sources `visited_regions` is rebuilt from, so
 * a wish is not a private note: it is what paints a country "planned" on the
 * globe and both maps. That is also why the query asks which of them you have
 * since visited — a wish for somewhere you have already been is not wrong, but
 * the globe will be showing it green rather than yellow, and the screen should
 * say so rather than let the two look like a bug.
 */

export interface WishlistEntry {
  id: string
  countryCode: string
  countryName: string
  flag: string
  title: string
  notes: string
  estBudget: number | null
  currency: string
  priority: number
  bestSeason: string
  createdAt: string
  /** True when a completed or ongoing trip already covers this country. */
  alreadyVisited: boolean
}

export async function getWishlist(): Promise<WishlistEntry[]> {
  const supabase = await createClient()
  const user = await requireUser()

  const [itemsResult, visitedResult] = await Promise.all([
    supabase
      .from('wishlist_items')
      .select(
        'id, country_code, title, notes, est_budget, currency, priority, best_season, created_at'
      )
      .eq('user_id', user.id)
      // Priority first — 1 is the top — then newest, so two wishes of equal
      // rank are in the order they were dreamt up.
      .order('priority', { ascending: true })
      .order('created_at', { ascending: false }),
    supabase
      .from('visited_regions')
      .select('country_code, state')
      .eq('user_id', user.id)
      .in('state', ['visited', 'current']),
  ])

  const visited = new Set((visitedResult.data ?? []).map((r) => r.country_code))

  return (itemsResult.data ?? []).map((row) => ({
    id: row.id,
    countryCode: row.country_code,
    countryName: countryName(row.country_code),
    flag: countryFlag(row.country_code),
    title: row.title,
    notes: row.notes,
    // `numeric` comes back as a string from PostgREST when it is large enough to
    // lose precision as a float; both forms are normalised here so the UI never
    // has to guess which it got.
    estBudget: row.est_budget === null ? null : Number(row.est_budget),
    currency: row.currency,
    priority: row.priority,
    bestSeason: row.best_season ?? '',
    createdAt: row.created_at,
    alreadyVisited: visited.has(row.country_code),
  }))
}
