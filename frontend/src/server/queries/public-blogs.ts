import 'server-only'

import { createClient } from '@/server/supabase/server'

/**
 * The public blog index — screen 4.
 *
 * Everything here is read through the client a signed-out visitor gets, so RLS
 * is what decides the page's contents, exactly as it does for `sitemap.xml`.
 * The `visibility` and `published_at` filters are still spelled out: RLS would
 * hand an author their own drafts back, and this page is a shop window rather
 * than anybody's dashboard.
 *
 * The author of a post is not always nameable. A private profile is invisible to
 * RLS, so its rows simply do not come back and the card carries no byline — the
 * same rule the reader at `/b/[slug]` applies, arrived at the same way rather
 * than restated as a condition here.
 */

export interface PublicPostCard {
  id: string
  title: string
  slug: string
  excerpt: string
  readingMinutes: number
  publishedAt: string | null
  author: {
    username: string
    displayName: string
  } | null
  /** The trip the post was written about, when it is public enough to link to. */
  trip: { slug: string; title: string } | null
}

/** Published public posts, newest first. */
export async function listPublicPosts(limit = 24): Promise<PublicPostCard[]> {
  const supabase = await createClient()

  const { data: posts } = await supabase
    .from('blog_posts')
    .select('id, user_id, trip_id, title, slug, excerpt, reading_minutes, published_at')
    .eq('visibility', 'public')
    .not('published_at', 'is', null)
    .is('deleted_at', null)
    .order('published_at', { ascending: false })
    .limit(limit)

  if (!posts?.length) return []

  const authorIds = [...new Set(posts.map((p) => p.user_id))]
  const tripIds = [
    ...new Set(posts.map((p) => p.trip_id).filter((id): id is string => Boolean(id))),
  ]

  const [profiles, trips] = await Promise.all([
    supabase.from('profiles').select('id, username, display_name').in('id', authorIds),
    // A post may name a trip that is not published. RLS returns the row to its
    // owner, so the filter is explicit — a card on a public index must not link
    // a visitor to a page they would 404 on.
    tripIds.length
      ? supabase
          .from('trips')
          .select('id, slug, title')
          .in('id', tripIds)
          .eq('visibility', 'public')
          .not('published_at', 'is', null)
          .is('deleted_at', null)
      : Promise.resolve({ data: [] }),
  ])

  const authorById = new Map((profiles.data ?? []).map((p) => [p.id, p]))
  const tripById = new Map((trips.data ?? []).map((t) => [t.id, t]))

  return posts.map((post) => {
    const author = authorById.get(post.user_id)
    const trip = post.trip_id ? tripById.get(post.trip_id) : undefined

    return {
      id: post.id,
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      readingMinutes: post.reading_minutes,
      publishedAt: post.published_at,
      author: author
        ? { username: author.username, displayName: author.display_name || author.username }
        : null,
      trip: trip ? { slug: trip.slug, title: trip.title } : null,
    }
  })
}
