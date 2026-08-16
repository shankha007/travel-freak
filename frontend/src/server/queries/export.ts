import 'server-only'

import { createClient } from '@/server/supabase/server'
import { requireUser } from '@/server/auth'
import { getEntitlements } from '@/server/entitlements'
import { buildExport, type ExportContents, type ExportDocument } from '@/shared/export'

/**
 * Gathers everything one account owns — screen 44.
 *
 * Read through the *user's* client rather than the service role, deliberately.
 * RLS then decides what belongs to them, which means an export can never
 * contain a row they were not entitled to read; the explicit `user_id` filters
 * are the second lock on the same door. Using the admin client here would make
 * a bug in this file a data breach rather than a wrong number.
 *
 * Soft-deleted rows are included and carry their `deleted_at`, because they are
 * still restorable and still theirs — an export taken the day before a trip's
 * 30 days expire should not quietly drop it.
 */

export async function getAccountExport(): Promise<ExportDocument> {
  const supabase = await createClient()
  const user = await requireUser()
  const entitlements = await getEntitlements()

  const [
    profile,
    trips,
    places,
    media,
    memories,
    albums,
    posts,
    wishlist,
    itineraryDays,
    itineraryItems,
    expenses,
    checklists,
    checklistItems,
    collaborations,
    countries,
    regions,
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    supabase.from('trips').select('*').eq('user_id', user.id),
    supabase.from('trip_places').select('*').eq('user_id', user.id),
    supabase.from('media').select('*').eq('user_id', user.id),
    supabase.from('memories').select('*').eq('user_id', user.id),
    supabase.from('albums').select('*').eq('user_id', user.id),
    supabase.from('blog_posts').select('*').eq('user_id', user.id),
    supabase.from('wishlist_items').select('*').eq('user_id', user.id),
    supabase.from('itinerary_days').select('*').eq('user_id', user.id),
    supabase.from('itinerary_items').select('*').eq('user_id', user.id),
    supabase.from('expenses').select('*').eq('user_id', user.id),
    supabase.from('checklists').select('*').eq('user_id', user.id),
    supabase.from('checklist_items').select('*').eq('user_id', user.id),
    // No user_id filter: RLS returns the rows naming this account *and* the
    // invitations sent to its address, which have no user_id until they are
    // accepted. Filtering here would drop exactly the ones somebody exporting
    // their data would be looking for.
    supabase.from('trip_collaborators').select('*'),
    supabase.from('visited_countries').select('*').eq('user_id', user.id),
    supabase.from('visited_regions').select('*').eq('user_id', user.id),
  ])

  const data: ExportContents = {
    profile: profile.data ?? null,
    trips: trips.data ?? [],
    places: places.data ?? [],
    media: (media.data ?? []).map(forExport),
    memories: memories.data ?? [],
    albums: albums.data ?? [],
    posts: posts.data ?? [],
    wishlist: wishlist.data ?? [],
    itineraryDays: itineraryDays.data ?? [],
    itineraryItems: itineraryItems.data ?? [],
    expenses: expenses.data ?? [],
    checklists: checklists.data ?? [],
    checklistItems: checklistItems.data ?? [],
    collaborations: collaborations.data ?? [],
    visitedCountries: countries.data ?? [],
    visitedRegions: regions.data ?? [],
  }

  return buildExport({
    account: {
      id: user.id,
      email: user.email,
      username: user.username,
      memberSince: (profile.data?.created_at as string | undefined) ?? '',
      plan: entitlements.planName,
    },
    data,
  })
}

/**
 * One media row, with the field name the readme promises.
 *
 * The readme tells a reader to look for `storagePath`, so the row has to carry
 * one — everything else keeps its database name, because renaming columns for
 * presentation is how an export stops matching the thing it was exported from.
 */
function forExport(row: Record<string, unknown>): Record<string, unknown> {
  return { ...row, storagePath: row.storage_path }
}
