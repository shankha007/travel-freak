import 'server-only'

import { createClient } from '@/server/supabase/server'
import { requireUser } from '@/server/auth'
import { daysLeftIn, retentionCutoff } from '@/shared/retention'
import type { Database } from '@/shared/types/database'

/**
 * The trash — trips and posts deleted within the restore window.
 *
 * Trips are read through `list_deleted_trips()` rather than a select, because a
 * deleted trip is invisible to its own owner under RLS: `trips_select_own` ends
 * in `deleted_at is null`, which is what keeps every other read path honest. The
 * function is the one place that looks past it, and only at the caller's own rows
 * inside the window.
 *
 * Posts need no such function: `blog_posts_write_own` is a `for all` policy with
 * no `deleted_at` clause, so a deleted post stays readable by its author. The
 * window is applied here instead.
 *
 * Photos are counted on a trip but are not listed as restorable anywhere.
 * Deleting a photo releases its bytes from storage immediately — storage is what
 * the plan charges for — so there is no object left to restore. The screen states
 * that rather than offering a button that would produce a broken image.
 */

type Visibility = Database['public']['Enums']['visibility']

export interface DeletedTrip {
  id: string
  title: string
  slug: string
  summary: string
  startDate: string | null
  endDate: string | null
  visibility: Visibility
  deletedAt: string
  placeCount: number
  photoCount: number
  postCount: number
  daysLeft: number
}

export interface DeletedPost {
  id: string
  title: string
  slug: string
  excerpt: string
  visibility: Visibility
  /** Set when the post was live at the moment it was deleted. */
  publishedAt: string | null
  deletedAt: string
  daysLeft: number
}

export interface Trash {
  trips: DeletedTrip[]
  posts: DeletedPost[]
}

export async function getTrash(): Promise<Trash> {
  const supabase = await createClient()
  const user = await requireUser()

  const [tripResult, postResult] = await Promise.all([
    supabase.rpc('list_deleted_trips'),
    supabase
      .from('blog_posts')
      .select('id, title, slug, excerpt, visibility, published_at, deleted_at')
      // Explicit, not left to RLS. A deleted post is only readable through
      // `blog_posts_write_own`, which is owner-scoped — but RLS is a ceiling
      // rather than a scope, and every owner-scoped read in this app says so
      // itself. See the dashboard leak in the 0.6.0 notes.
      .eq('user_id', user.id)
      .not('deleted_at', 'is', null)
      .gt('deleted_at', retentionCutoff())
      .order('deleted_at', { ascending: false }),
  ])

  const trips = (tripResult.data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    startDate: row.start_date,
    endDate: row.end_date,
    visibility: row.visibility,
    deletedAt: row.deleted_at,
    placeCount: row.place_count,
    photoCount: row.photo_count,
    postCount: row.post_count,
    daysLeft: daysLeftIn(row.deleted_at),
  }))

  // `deleted_at` is non-null by the filter above, but the generated type does
  // not know that, so the narrowing is done here rather than asserted.
  const posts = (postResult.data ?? []).flatMap((row) =>
    row.deleted_at === null
      ? []
      : [
          {
            id: row.id,
            title: row.title,
            slug: row.slug,
            excerpt: row.excerpt,
            visibility: row.visibility,
            publishedAt: row.published_at,
            deletedAt: row.deleted_at,
            daysLeft: daysLeftIn(row.deleted_at),
          },
        ]
  )

  return { trips, posts }
}
