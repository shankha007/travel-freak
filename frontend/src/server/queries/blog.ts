import 'server-only'

import { createAdminClient, createClient } from '@/server/supabase/server'
import { sanitizePostHtml } from '@/shared/content/sanitize'
import type { Database } from '@/shared/types/database'

/**
 * One blog post, for the public reader at `/b/[slug]`.
 *
 * Two ways in, the same split the public trip page makes:
 *
 *  - **By slug.** Scoped by RLS: signed-out visitors see published public posts
 *    only, and the author additionally sees their own drafts and private posts.
 *    A slug that does not resolve is indistinguishable from one the caller may
 *    not read, which is what stops the route being used to test whether a draft
 *    exists.
 *  - **By token.** The post is unlisted, which means RLS deliberately will not
 *    return it to a stranger. `resolve_post_share_link()` trades the token for
 *    one post id, and only then does the service role read that one post.
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
  /** False once the author is on a paid plan. Free public pages carry the badge. */
  showsBadge: boolean
  /** True when reached by an unlisted link rather than a public URL. */
  viaShareLink: boolean
}

const SELECT_POST = `id, user_id, trip_id, title, slug, content_html, excerpt, reading_minutes,
  visibility, published_at, created_at, seo_title, seo_description`

export async function getBlogPost(slug: string): Promise<BlogPostView | null> {
  const supabase = await createClient()

  const { data: post } = await supabase
    .from('blog_posts')
    .select(SELECT_POST)
    .eq('slug', slug)
    .is('deleted_at', null)
    .maybeSingle()

  if (!post) return null

  return loadPost(post, { viaShareLink: false })
}

/**
 * An unlisted post, by share token.
 *
 * The token is the authorisation. Once it resolves, the read is done with the
 * service role because RLS has no way to know about it — scoped, every time, to
 * the single id the token produced.
 */
export async function getSharedBlogPost(token: string): Promise<BlogPostView | null> {
  if (!token || token.length > 128) return null

  const supabase = await createClient()
  const { data: postId } = await supabase.rpc('resolve_post_share_link', { p_token: token })

  if (!postId) return null

  const admin = createAdminClient()
  const { data: post } = await admin
    .from('blog_posts')
    .select(SELECT_POST)
    .eq('id', postId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!post) return null

  return loadPost(post, { viaShareLink: true, elevated: true })
}

type PostRow = {
  id: string
  user_id: string
  trip_id: string | null
  title: string
  slug: string
  content_html: string
  excerpt: string
  reading_minutes: number
  visibility: Visibility
  published_at: string | null
  created_at: string
  seo_title: string | null
  seo_description: string | null
}

/**
 * Everything hanging off a post, for whichever client is entitled to read it.
 *
 * `elevated` means the caller already proved a token, so the service role is in
 * play and RLS is not filtering anything. On that path the one thing RLS would
 * otherwise decide — whether the author's linked trip may be named — is enforced
 * here by hand, because there is nothing else left to enforce it.
 */
async function loadPost(
  post: PostRow,
  { viaShareLink, elevated = false }: { viaShareLink: boolean; elevated?: boolean }
): Promise<BlogPostView> {
  const supabase = elevated ? createAdminClient() : await createClient()

  // The session is read through the ordinary client either way: on the token path
  // the elevated client has no session, and "is this the author" is still worth
  // answering — a writer opening their own link should not see a stranger's view.
  const sessionClient = await createClient()
  const {
    data: { user },
  } = await sessionClient.auth.getUser()

  const [profileResult, tripResult, badgeResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('username, display_name, avatar_url, is_public')
      .eq('id', post.user_id)
      .maybeSingle(),
    post.trip_id
      ? supabase
          .from('trips')
          .select('id, title, slug, start_date, end_date, visibility, published_at')
          .eq('id', post.trip_id)
          .is('deleted_at', null)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    // Asked about the post, not the profile: a post can be published while its
    // author's profile is private, and the profile-shaped question returns the
    // free-plan default in that case — which would badge a paying customer.
    supabase.rpc('post_shows_branding_badge', { p_post_id: post.id }),
  ])

  const isOwner = user?.id === post.user_id

  // On the elevated path the service role returned the profile whatever its
  // visibility, so the rule RLS would have applied is applied here: a private
  // profile is not named to a stranger holding a link. Without this, a token
  // would reveal an author the public page keeps anonymous.
  const profileRow = profileResult.data
  const profile = profileRow && elevated && !isOwner && !profileRow.is_public ? null : profileRow

  // On the elevated path RLS is not deciding what the trip row may say, so this
  // does: a token for a post is not a token for the private trip behind it, and
  // even the trip's title is more than the link was handed out to share.
  const tripRow = tripResult.data
  const tripIsPublic = tripRow?.visibility === 'public' && tripRow.published_at !== null
  const trip = tripRow && (isOwner || !elevated || tripIsPublic) ? tripRow : null

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
    isOwner,
    // `subscriptions` is owner-only, so the author's plan is read through a
    // SECURITY DEFINER function that answers this one question rather than
    // exposing who is paying. It defaults to true when it cannot tell.
    showsBadge: badgeResult.data !== false,
    viaShareLink,
  }
}
