import 'server-only'

import { createClient } from '@/server/supabase/server'
import { sanitizePostHtml } from '@/shared/content/sanitize'
import type { Database } from '@/shared/types/database'

/**
 * One blog post, for the public reader at `/b/[slug]`.
 *
 * Scoped by RLS: signed-out visitors see published public posts only, and the
 * author additionally sees their own drafts and private posts. A slug that does
 * not resolve is indistinguishable from one the caller may not read, which is
 * what stops the route being used to test whether a draft exists.
 */

type Visibility = Database['public']['Enums']['visibility']

export interface BlogPostView {
  id: string
  title: string
  slug: string
  /** Sanitised — safe to pass to dangerouslySetInnerHTML. */
  contentHtml: string
  excerpt: string
  readingMinutes: number
  visibility: Visibility
  publishedAt: string | null
  createdAt: string
  seoTitle: string
  seoDescription: string
  author: {
    username: string
    displayName: string
    avatarUrl: string | null
    isPublic: boolean
  } | null
  trip: {
    id: string
    title: string
    slug: string
    startDate: string | null
    endDate: string | null
    visibility: Visibility
  } | null
  /** True when the caller is the author, so the page can flag an unpublished post. */
  isOwner: boolean
}

export async function getBlogPost(slug: string): Promise<BlogPostView | null> {
  const supabase = await createClient()

  const { data: post } = await supabase
    .from('blog_posts')
    .select(
      `id, user_id, trip_id, title, slug, content_html, excerpt, reading_minutes,
       visibility, published_at, created_at, seo_title, seo_description`
    )
    .eq('slug', slug)
    .is('deleted_at', null)
    .maybeSingle()

  if (!post) return null

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [profileResult, tripResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('username, display_name, avatar_url, is_public')
      .eq('id', post.user_id)
      .maybeSingle(),
    post.trip_id
      ? supabase
          .from('trips')
          .select('id, title, slug, start_date, end_date, visibility')
          .eq('id', post.trip_id)
          .is('deleted_at', null)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const profile = profileResult.data
  const trip = tripResult.data

  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    contentHtml: sanitizePostHtml(post.content_html ?? ''),
    excerpt: post.excerpt,
    readingMinutes: post.reading_minutes,
    visibility: post.visibility,
    publishedAt: post.published_at,
    createdAt: post.created_at,
    seoTitle: post.seo_title ?? '',
    seoDescription: post.seo_description ?? '',
    // A private profile still authors public posts; the byline links out only
    // when there is a public profile to link to.
    author: profile
      ? {
          username: profile.username,
          displayName: profile.display_name || profile.username,
          avatarUrl: profile.avatar_url,
          isPublic: profile.is_public,
        }
      : null,
    trip: trip
      ? {
          id: trip.id,
          title: trip.title,
          slug: trip.slug,
          startDate: trip.start_date,
          endDate: trip.end_date,
          visibility: trip.visibility,
        }
      : null,
    isOwner: user?.id === post.user_id,
  }
}
