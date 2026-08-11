import 'server-only'

import { createClient } from '@/server/supabase/server'
import { requireUser } from '@/server/auth'
import type { Database } from '@/shared/types/database'

/**
 * The author's own posts, for `/blogs` and the studio.
 *
 * Filtered on `user_id` explicitly: `blog_posts` also has a policy exposing
 * every published public post, so leaning on RLS alone would list strangers'
 * writing under "your posts". The public read path is `queries/blog.ts`.
 */

type Visibility = Database['public']['Enums']['visibility']
type Json = Database['public']['Tables']['blog_posts']['Row']['content_json']

export interface BlogListItem {
  id: string
  title: string
  slug: string
  excerpt: string
  readingMinutes: number
  visibility: Visibility
  publishedAt: string | null
  updatedAt: string
  tripTitle: string | null
}

export interface BlogDraft {
  id: string
  title: string
  slug: string
  contentHtml: string
  contentJson: Json
  excerpt: string
  visibility: Visibility
  tripId: string | null
  seoTitle: string
  seoDescription: string
  readingMinutes: number
  publishedAt: string | null
  updatedAt: string
}

/** One option in the studio's "which trip is this about?" picker. */
export interface TripOption {
  id: string
  title: string
}

export async function getMyBlogPosts(): Promise<BlogListItem[]> {
  const supabase = await createClient()
  const user = await requireUser()

  const { data, error } = await supabase
    .from('blog_posts')
    .select(
      `id, title, slug, excerpt, reading_minutes, visibility, published_at, updated_at,
       trips ( title )`
    )
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })

  if (error) {
    throw new Error(`Could not load your posts: ${error.message}`)
  }

  return (data ?? []).map((p) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    excerpt: p.excerpt,
    readingMinutes: p.reading_minutes,
    visibility: p.visibility,
    publishedAt: p.published_at,
    updatedAt: p.updated_at,
    tripTitle: p.trips?.title ?? null,
  }))
}

/** The post the studio edits. Author only — no public fallback here. */
export async function getBlogDraft(id: string): Promise<BlogDraft | null> {
  const supabase = await createClient()
  const user = await requireUser()

  // Postgres rejects a malformed uuid with a 400 rather than an empty result,
  // which would surface as a server error instead of a clean 404.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return null
  }

  const { data } = await supabase
    .from('blog_posts')
    .select(
      `id, title, slug, content_html, content_json, excerpt, visibility, trip_id,
       seo_title, seo_description, reading_minutes, published_at, updated_at`
    )
    .eq('id', id)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!data) return null

  return {
    id: data.id,
    title: data.title,
    slug: data.slug,
    contentHtml: data.content_html,
    contentJson: data.content_json,
    excerpt: data.excerpt,
    visibility: data.visibility,
    tripId: data.trip_id,
    seoTitle: data.seo_title ?? '',
    seoDescription: data.seo_description ?? '',
    readingMinutes: data.reading_minutes,
    publishedAt: data.published_at,
    updatedAt: data.updated_at,
  }
}

/** Titles for the studio's trip picker, newest first. */
export async function getTripOptions(): Promise<TripOption[]> {
  const supabase = await createClient()
  const user = await requireUser()

  const { data } = await supabase
    .from('trips')
    .select('id, title')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .order('start_date', { ascending: false, nullsFirst: false })

  return (data ?? []).map((t) => ({ id: t.id, title: t.title }))
}
