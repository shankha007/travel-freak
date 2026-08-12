'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/server/supabase/server'
import { requireUser } from '@/server/auth'
import { sanitizePostHtml } from '@/shared/content/sanitize'
import { excerptFrom, readingMinutes } from '@/shared/content/reading'
import { blogPostSchema, slugifyTitle, type BlogPostInput } from '@/shared/validation/blog'
import { retentionCutoff } from '@/shared/retention'
import type { Database } from '@/shared/types/database'

/**
 * Blog Studio Server Actions.
 *
 * `saveBlogPost` takes a plain object rather than FormData because it is called
 * by autosave, not by a form submission. Everything it receives is re-validated
 * here — the studio's checks are for the writer's benefit, not the server's.
 */

type Json = Database['public']['Tables']['blog_posts']['Insert']['content_json']

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface SaveBlogResult {
  ok: boolean
  id?: string
  slug?: string
  /** ISO timestamp of the write, for the "saved at" indicator. */
  savedAt?: string
  error?: string
  fieldErrors?: Record<string, string>
}

function candidateSlugs(title: string): string[] {
  const base = slugifyTitle(title)
  return [base, ...Array.from({ length: 6 }, (_, i) => `${base}-${i + 2}`)]
}

/**
 * Creates or updates a post.
 *
 * Two rules worth stating:
 *
 *  - **The slug follows the title until the post is published, then freezes.**
 *    A draft renamed three times should not keep the first title's URL; a
 *    published post must never change the URL someone has already shared.
 *  - **Reading time and the fallback excerpt are derived here**, not taken from
 *    the client, so they cannot disagree with the stored content.
 */
export async function saveBlogPost(input: BlogPostInput): Promise<SaveBlogResult> {
  const user = await requireUser()

  const parsed = blogPostSchema.safeParse(input)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.')
      fieldErrors[key] ??= issue.message
    }
    return { ok: false, error: 'Please fix the highlighted fields.', fieldErrors }
  }

  const values = parsed.data
  const supabase = await createClient()

  // Sanitising on write as well as on read: the reader is not the only thing
  // that will ever render this, and a stored script is a problem regardless of
  // who eventually prints it.
  const contentHtml = sanitizePostHtml(values.contentHtml)
  const excerpt = values.excerpt || excerptFrom(contentHtml)

  const common = {
    title: values.title,
    content_html: contentHtml,
    content_json: (values.contentJson ?? {}) as Json,
    excerpt,
    reading_minutes: readingMinutes(contentHtml),
    visibility: values.visibility,
    trip_id: values.tripId,
    seo_title: values.seoTitle || null,
    seo_description: values.seoDescription || null,
  }

  // ------------------------------------------------------------------ create
  if (!values.id) {
    for (const slug of candidateSlugs(values.title)) {
      const { data, error } = await supabase
        .from('blog_posts')
        .insert({ ...common, user_id: user.id, slug })
        .select('id, slug, updated_at')
        .single()

      if (!error) {
        revalidatePath('/blogs')
        revalidatePath('/dashboard')
        return { ok: true, id: data.id, slug: data.slug, savedAt: data.updated_at }
      }

      // 23505 = unique violation on the slug. Anything else is a real failure.
      if (error.code !== '23505') {
        return { ok: false, error: `Could not save the post: ${error.message}` }
      }
    }

    return {
      ok: false,
      error: 'Could not find a free URL for that title. Try a slightly different one.',
    }
  }

  // ------------------------------------------------------------------ update
  const { data: existing } = await supabase
    .from('blog_posts')
    .select('id, slug, published_at')
    .eq('id', values.id)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!existing) {
    return { ok: false, error: 'That post no longer exists, or is not yours to edit.' }
  }

  // Published posts keep their slug; drafts re-derive it from the current
  // title. Re-writing a row's own slug is not a unique violation, so an
  // unchanged title still costs exactly one write.
  const slugs = existing.published_at ? [existing.slug] : candidateSlugs(values.title)

  for (const slug of slugs) {
    const { data, error } = await supabase
      .from('blog_posts')
      .update({ ...common, slug })
      .eq('id', values.id)
      .eq('user_id', user.id)
      .select('id, slug, updated_at')
      .single()

    if (!error) {
      revalidatePath('/blogs')
      revalidatePath('/dashboard')
      revalidatePath(`/b/${data.slug}`)
      if (data.slug !== existing.slug) revalidatePath(`/b/${existing.slug}`)
      return { ok: true, id: data.id, slug: data.slug, savedAt: data.updated_at }
    }

    if (error.code !== '23505') {
      return { ok: false, error: `Could not save the post: ${error.message}` }
    }
  }

  return { ok: false, error: 'Could not find a free URL for that title.' }
}

export interface PublishResult {
  ok: boolean
  publishedAt?: string | null
  error?: string
}

/**
 * Publishes or unpublishes.
 *
 * Publishing never changes visibility. A private post cannot be published,
 * because quietly flipping someone's privacy setting to make a button work is
 * how people end up publishing things they did not mean to. The studio disables
 * the button and says so; this is the matching server-side refusal.
 *
 * Unpublishing clears `published_at`, which is enough on its own — the public
 * read policy requires both `visibility = 'public'` and a publication date.
 */
export async function setBlogPublished(id: string, published: boolean): Promise<PublishResult> {
  const user = await requireUser()

  if (!UUID_RE.test(id)) {
    return { ok: false, error: 'Something went wrong. Please try again.' }
  }

  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('blog_posts')
    .select('id, slug, visibility, published_at')
    .eq('id', id)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!existing) {
    return { ok: false, error: 'That post no longer exists, or is not yours to publish.' }
  }

  if (published && existing.visibility === 'private') {
    return {
      ok: false,
      error: 'Set the post to unlisted or public before publishing it.',
    }
  }

  const publishedAt = published ? (existing.published_at ?? new Date().toISOString()) : null

  const { error } = await supabase
    .from('blog_posts')
    .update({ published_at: publishedAt })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    return { ok: false, error: `Could not update the post: ${error.message}` }
  }

  revalidatePath('/blogs')
  revalidatePath('/dashboard')
  revalidatePath(`/b/${existing.slug}`)
  return { ok: true, publishedAt }
}

export interface DeleteBlogState {
  error: string | null
}

/**
 * Soft-deletes a post.
 *
 * Unlike `trips`, this works as a plain update: `blog_posts_write_own` is a
 * `for all` policy, so it doubles as a SELECT policy with no `deleted_at`
 * clause and the updated row stays visible to the check. See migration
 * 20260812000200 for why trips needed a function instead.
 */
export async function deleteBlogPost(
  _prev: DeleteBlogState,
  formData: FormData
): Promise<DeleteBlogState> {
  const user = await requireUser()

  const id = formData.get('postId')
  if (typeof id !== 'string' || !UUID_RE.test(id)) {
    return { error: 'Something went wrong. Please try again.' }
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('blog_posts')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .select('id')

  if (error) {
    return { error: `Could not delete the post: ${error.message}` }
  }

  if (!data?.length) {
    return { error: 'That post no longer exists, or is not yours to delete.' }
  }

  revalidatePath('/blogs')
  revalidatePath('/dashboard')
  revalidatePath('/trash')
  redirect('/blogs')
}

export interface RestorePostResult {
  ok: boolean
  error?: string
}

/**
 * Restores a soft-deleted post.
 *
 * A plain update, for the same reason the delete is one: the post's write policy
 * has no `deleted_at` clause, so the owner can still see and change the row.
 * That is also why posts need no `list_deleted_*` function the way trips do.
 *
 * `published_at` is left alone, so restoring a post that was live puts it back
 * where it was. The trash screen says as much before the button is pressed —
 * quietly re-publishing something would be the wrong kind of surprise.
 *
 * The 30-day window is applied here rather than in a policy: it is the promise
 * the delete dialog makes, and this is the only path that keeps it.
 */
export async function restoreBlogPost(postId: string): Promise<RestorePostResult> {
  const user = await requireUser()

  if (!UUID_RE.test(postId)) {
    return { ok: false, error: 'Something went wrong. Please try again.' }
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('blog_posts')
    .update({ deleted_at: null })
    .eq('id', postId)
    .eq('user_id', user.id)
    .not('deleted_at', 'is', null)
    .gt('deleted_at', retentionCutoff())
    .select('id')

  if (error) {
    return { ok: false, error: `Could not restore the post: ${error.message}` }
  }

  if (!data?.length) {
    return { ok: false, error: 'That post can no longer be restored.' }
  }

  revalidatePath('/blogs')
  revalidatePath('/dashboard')
  revalidatePath('/trash')
  return { ok: true }
}
