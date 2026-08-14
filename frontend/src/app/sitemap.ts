import type { MetadataRoute } from 'next'
import { createClient } from '@/server/supabase/server'
import { SITE_URL } from '@/shared/brand'
import { LEGAL_DOCS } from '@/shared/content/legal'

/**
 * Sitemap of everything publicly readable.
 *
 * Built through the same client a visitor gets, so it lists exactly what a
 * search engine could actually fetch: public profiles, published public trips
 * and published public posts. RLS is what removes anything private, which is
 * what keeps the sitemap from ever advertising a page that would 404 for the
 * crawler.
 *
 * Unlisted trips are deliberately absent. They are reachable only with a token,
 * and a sitemap is the last place a "secret" URL should appear.
 */
export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient()

  const [profiles, trips, posts] = await Promise.all([
    supabase.from('profiles').select('username, updated_at').eq('is_public', true).limit(1000),
    supabase
      .from('trips')
      .select('slug, updated_at')
      .eq('visibility', 'public')
      .not('published_at', 'is', null)
      .is('deleted_at', null)
      .limit(1000),
    supabase
      .from('blog_posts')
      .select('slug, updated_at')
      .eq('visibility', 'public')
      .not('published_at', 'is', null)
      .is('deleted_at', null)
      .limit(1000),
  ])

  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/pricing`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/b`, changeFrequency: 'daily', priority: 0.7 },
    { url: `${SITE_URL}/about`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/contact`, changeFrequency: 'yearly', priority: 0.4 },
    { url: `${SITE_URL}/changelog`, changeFrequency: 'weekly', priority: 0.4 },
    // Listed rather than hidden: a policy a crawler cannot find is a policy a
    // reader cannot find either. `lastModified` is the date the document itself
    // states, so a rewrite is visible to a crawler on the same day it ships.
    ...LEGAL_DOCS.map((doc) => ({
      url: `${SITE_URL}${doc.path}`,
      lastModified: new Date(`${doc.effective}T00:00:00Z`),
      changeFrequency: 'yearly' as const,
      priority: 0.3,
    })),
    { url: `${SITE_URL}/login`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/register`, changeFrequency: 'yearly', priority: 0.5 },
  ]

  return [
    ...staticPages,
    ...(profiles.data ?? []).map((p) => ({
      url: `${SITE_URL}/u/${p.username}`,
      lastModified: new Date(p.updated_at),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
    ...(trips.data ?? []).map((t) => ({
      url: `${SITE_URL}/t/${t.slug}`,
      lastModified: new Date(t.updated_at),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
    ...(posts.data ?? []).map((p) => ({
      url: `${SITE_URL}/b/${p.slug}`,
      lastModified: new Date(p.updated_at),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
  ]
}
