import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CalendarDays, Clock, EyeOff, Link2, Luggage } from 'lucide-react'
import { getBlogPost, getSharedBlogPost } from '@/server/queries/blog'
import { BRAND, SITE_URL } from '@/shared/brand'
import { formatDateRange } from '@/shared/format'
import { PROSE_CLASS } from '@/shared/content/prose'
import { cn } from '@/shared/utils'
import { ThemeToggle } from '@/client/components/theme-toggle'
import { Badge } from '@/client/components/ui/badge'
import { Button } from '@/client/components/ui/button'

/**
 * Public blog reader.
 *
 * Rendered per request rather than statically: RLS decides what the caller may
 * read, so a cached copy of a post would be a cached copy of one visitor's
 * permissions. `generateStaticParams` + ISR belong here once the public/private
 * split is served from separate cache keys.
 */
export const dynamic = 'force-dynamic'

/**
 * Resolves the post from the URL: the slug, or the token when one is present.
 *
 * The token wins when supplied, because a `?k=` link is what an unlisted post is
 * reachable by at all — falling back to the slug would show the author's own
 * preview to the author and a 404 to everyone they sent it to.
 */
async function resolvePost(
  params: Promise<{ slug: string }>,
  searchParams: Promise<Record<string, string | string[] | undefined>>
) {
  const [{ slug }, query] = await Promise.all([params, searchParams])
  const token = typeof query.k === 'string' ? query.k : null

  if (token) {
    const shared = await getSharedBlogPost(token)
    // A token that no longer resolves falls through to the slug, so the author
    // still sees their own post rather than a 404 on their own link.
    if (shared) return shared
  }

  return getBlogPost(slug)
}

export async function generateMetadata({
  params,
  searchParams,
}: PageProps<'/b/[slug]'>): Promise<Metadata> {
  const post = await resolvePost(params, searchParams)
  if (!post) return { title: 'Post not found' }

  const isPublic = post.visibility === 'public' && post.publishedAt !== null

  return {
    title: post.seoTitle || post.title,
    description: post.seoDescription || post.excerpt,
    alternates: { canonical: `${SITE_URL}/b/${post.slug}` },
    // Drafts, private posts and anything opened with a share token must never
    // end up in an index. Unlisted means unlisted.
    robots: isPublic && !post.viaShareLink ? undefined : { index: false, follow: false },
    openGraph: {
      type: 'article',
      title: post.seoTitle || post.title,
      description: post.seoDescription || post.excerpt,
      publishedTime: post.publishedAt ?? undefined,
      authors: post.author ? [post.author.displayName] : undefined,
    },
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default async function BlogPostPage({ params, searchParams }: PageProps<'/b/[slug]'>) {
  const post = await resolvePost(params, searchParams)

  // Covers "no such post", "still a draft", "someone else's private post" and a
  // revoked token identically — all four return nothing.
  if (!post) notFound()

  const published = post.publishedAt !== null
  const isPublic = post.visibility === 'public' && published

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt,
    datePublished: post.publishedAt ?? post.createdAt,
    author: post.author ? { '@type': 'Person', name: post.author.displayName } : undefined,
    publisher: { '@type': 'Organization', name: BRAND.name },
    mainEntityOfPage: `${SITE_URL}/b/${post.slug}`,
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between border-b px-4 md:px-6">
        <Link href="/" className="font-semibold tracking-tight">
          {BRAND.name}
        </Link>
        <ThemeToggle />
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 md:px-6">
        {/* Rendered for the author, and for a visitor holding a share link — who
            should know they are reading something unlisted rather than assume it
            is a public page they could link to. */}
        {!isPublic && (
          <p className="mb-6 flex items-center gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
            {post.viaShareLink ? (
              <Link2 className="size-4 shrink-0" aria-hidden />
            ) : (
              <EyeOff className="size-4 shrink-0" aria-hidden />
            )}
            {post.viaShareLink
              ? 'Shared with you by its author. This post is unlisted — it is not indexed and has no public URL, so pass on this link rather than the page.'
              : published
                ? `This post is ${post.visibility}. Only you and anyone with the link can read it.`
                : 'This is a draft. Only you can see it.'}
          </p>
        )}

        <article>
          <header className="space-y-3">
            <h1 className="font-heading text-3xl leading-tight font-semibold tracking-tight text-balance">
              {post.title}
            </h1>

            {post.excerpt && <p className="text-lg text-muted-foreground">{post.excerpt}</p>}

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              {post.author && <span>{post.author.displayName}</span>}
              {post.publishedAt && (
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="size-3.5" aria-hidden />
                  <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Clock className="size-3.5" aria-hidden />
                {post.readingMinutes} min read
              </span>
            </div>
          </header>

          {/* Sanitised in getBlogPost against a tag allowlist, so stored markup
              from the editor cannot execute on this origin. */}
          <div
            className={cn('mt-8', PROSE_CLASS)}
            dangerouslySetInnerHTML={{ __html: post.contentHtml }}
          />
        </article>

        {post.trip && (
          <aside className="mt-10 rounded-lg border p-4">
            <p className="flex items-center gap-1.5 text-xs tracking-wide text-muted-foreground uppercase">
              <Luggage className="size-3.5" aria-hidden />
              From the trip
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium">{post.trip.title}</p>
                <p className="text-sm text-muted-foreground">
                  {formatDateRange(post.trip.startDate, post.trip.endDate)}
                </p>
              </div>
              {/* The author goes back to their own trip; a reader goes to the
                  public page, which only exists when the trip is published. */}
              {post.isOwner ? (
                <Button
                  variant="outline"
                  size="sm"
                  nativeButton={false}
                  render={<Link href={`/trips/${post.trip.id}`} />}
                >
                  Open trip
                </Button>
              ) : (
                post.trip.visibility === 'public' && (
                  <Button
                    variant="outline"
                    size="sm"
                    nativeButton={false}
                    render={<Link href={`/t/${post.trip.slug}`} />}
                  >
                    Read the trip
                  </Button>
                )
              )}
            </div>
          </aside>
        )}

        {isPublic && (
          <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t pt-6 text-sm">
            {post.author?.isPublic ? (
              <Link
                href={`/u/${post.author.username}`}
                className="underline-offset-4 hover:underline"
              >
                <Badge variant="secondary">{post.author.displayName}</Badge>
              </Link>
            ) : (
              <span />
            )}
            {/* The no-ads growth loop. Paid plans have this removed, which needs
                the author's plan — and `subscriptions` is readable only by its
                owner, so the answer comes from shows_branding_badge(). */}
            {post.showsBadge && (
              <Link href="/" className="text-muted-foreground underline underline-offset-4">
                {BRAND.freePlanBadge}
              </Link>
            )}
          </footer>
        )}
      </main>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </div>
  )
}
