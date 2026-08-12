import type { MetadataRoute } from 'next'
import { createClient } from '@/server/supabase/server'
import { SITE_URL } from '@/shared/brand'

/**
 * Sitemap of everything publicly readable.
 *
 * Built through the same client a visitor gets, so it lists exactly what a
 * search engine could actually fetch: public profiles and published public
 * posts. RLS is what removes anything private, which is what keeps the sitemap
 * from ever advertising a page that would 404 for the crawler.
 *
 * Public trip pages (screen 37) are not built yet, so no `/t/[slug]` entries.
 */
export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient()

  const [profiles, posts] = await Promise.all([
    supabase.from('profiles').select('username, updated_at').eq('is_public', true).limit(1000),
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
    ...(posts.data ?? []).map((p) => ({
      url: `${SITE_URL}/b/${p.slug}`,
      lastModified: new Date(p.updated_at),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
  ]
}
