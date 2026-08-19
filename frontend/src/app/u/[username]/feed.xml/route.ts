import { createClient } from '@/server/supabase/server'
import { getProfileByUsername } from '@/server/queries/resume'
import { buildRssFeed, type FeedItem } from '@/shared/content/feed'
import { BRAND, SITE_URL } from '@/shared/brand'

/**
 * RSS for one public profile — the last item on the plan's SEO list.
 *
 * ## What decides the contents
 *
 * The visitor's own client, as everywhere else public: RLS refuses a private
 * profile's rows, so a feed for one cannot be assembled at all and the route
 * answers 404 — the same answer `/u/[username]` gives, arrived at the same way
 * rather than by a second condition written here. The `visibility` and
 * `published_at` filters are still spelled out, because RLS would hand an author
 * their own drafts back and a feed is a shop window rather than a dashboard.
 *
 * Only posts. A trip is not an article and has no publication date a reader would
 * recognise — `published_at` on a trip is when its owner made it visible, which
 * can be years after the trip itself, and a feed ordered by that would deliver
 * somebody's 2019 holiday as today's news.
 *
 * ## Why a Route Handler and not a metadata file
 *
 * There is no `feed.xml` file convention. `sitemap.ts` and `robots.ts` are
 * conventions and are used as such; this is the case where writing the response
 * by hand is the whole mechanism rather than a preference.
 */

/**
 * A feed is cheap to build and read far more often than it changes, so it is
 * cached for an hour rather than rebuilt per subscriber. A reader that polls
 * every fifteen minutes then costs one query an hour instead of four.
 */
export const revalidate = 3600

const MAX_ITEMS = 50

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params

  const profile = await getProfileByUsername(username)
  // Null covers both "no such username" and "private profile", because RLS
  // returns nothing in either case. A feed must not distinguish them: the
  // difference is exactly what a private profile is meant not to disclose.
  if (!profile || !profile.isPublic) {
    return new Response('Not found', { status: 404 })
  }

  const supabase = await createClient()
  const { data: posts } = await supabase
    .from('blog_posts')
    .select('title, slug, excerpt, published_at')
    .eq('user_id', profile.id)
    .eq('visibility', 'public')
    .not('published_at', 'is', null)
    .is('deleted_at', null)
    .order('published_at', { ascending: false })
    .limit(MAX_ITEMS)

  const items: FeedItem[] = (posts ?? []).map((post) => ({
    title: post.title,
    url: `${SITE_URL}/b/${post.slug}`,
    description: post.excerpt,
    publishedAt: post.published_at,
    author: profile.displayName,
  }))

  const xml = buildRssFeed({
    title: `${profile.displayName} · ${BRAND.name}`,
    siteUrl: `${SITE_URL}/u/${profile.username}`,
    feedUrl: `${SITE_URL}/u/${profile.username}/feed.xml`,
    description: profile.bio || `Travel writing by ${profile.displayName}.`,
    items,
  })

  return new Response(xml, {
    headers: {
      // `charset` stated explicitly: the XML declaration says UTF-8, and a reader
      // that trusts the header over the declaration should be told the same thing.
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
