import { listPublicPosts } from '@/server/queries/public-blogs'
import { buildRssFeed, type FeedItem } from '@/shared/content/feed'
import { BRAND, SITE_URL } from '@/shared/brand'

/**
 * RSS for `/b`, the site-wide index of published public posts.
 *
 * The per-profile feed is what the plan asks for; this one exists because the
 * index it mirrors already does, and a public index without a feed is a page a
 * reader has to remember to come back to. It reads through `listPublicPosts()`,
 * the same query the page uses, so the two cannot list different things — and an
 * author whose profile is private is unnameable there and carries no byline here
 * for the same reason.
 */

export const revalidate = 3600

export async function GET() {
  const posts = await listPublicPosts(50)

  const items: FeedItem[] = posts.map((post) => ({
    title: post.title,
    url: `${SITE_URL}/b/${post.slug}`,
    description: post.excerpt,
    publishedAt: post.publishedAt,
    // Undefined rather than a placeholder: the card on `/b` shows no byline for a
    // private profile, and the feed says as little.
    author: post.author?.displayName,
  }))

  const xml = buildRssFeed({
    title: `${BRAND.name} — travel writing`,
    siteUrl: `${SITE_URL}/b`,
    feedUrl: `${SITE_URL}/b/feed.xml`,
    description: 'Published trip journals and travel writing from across the site.',
    items,
  })

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
