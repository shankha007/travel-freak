import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CalendarDays, Clock, EyeOff, Luggage } from 'lucide-react'
import { getBlogPost } from '@/server/queries/blog'
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

export async function generateMetadata({ params }: PageProps<'/b/[slug]'>): Promise<Metadata> {
  const { slug } = await params
  const post = await getBlogPost(slug)
  if (!post) return { title: 'Post not found' }

  const isPublic = post.visibility === 'public' && post.publishedAt !== null

  return {
    title: post.seoTitle || post.title,
    description: post.seoDescription || post.excerpt,
    alternates: { canonical: `${SITE_URL}/b/${post.slug}` },
    // Drafts and private posts are reachable by their author; they must never
    // end up in an index.
    robots: isPublic ? undefined : { index: false, follow: false },
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

export default async function BlogPostPage({ params }: PageProps<'/b/[slug]'>) {
  const { slug } = await params
  const post = await getBlogPost(slug)

  // Covers "no such post", "still a draft" and "someone else's private post"
  // identically — RLS returns nothing for all three.
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
        {/* Only ever rendered for the author — everyone else gets a 404 above. */}
        {!isPublic && (
          <p className="mb-6 flex items-center gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
            <EyeOff className="size-4 shrink-0" aria-hidden />
            {published
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
              {/* Public trip pages do not exist yet; the author still gets a way
                  back into their own trip. */}
              {post.isOwner && (
                <Button
                  variant="outline"
                  size="sm"
                  nativeButton={false}
                  render={<Link href={`/trips/${post.trip.id}`} />}
                >
                  Open trip
                </Button>
              )}
            </div>
          </aside>
        )}

        {isPublic && (
          <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t pt-6 text-sm">
            {post.author?.isPublic ? (
              <Badge variant="secondary">{post.author.displayName}</Badge>
            ) : (
              <span />
            )}
            {/* The no-ads growth loop. Voyager and above pay to have this
                removed, which needs the author's plan — and `subscriptions` is
                readable only by its owner, so that lookup has to go through a
                SECURITY DEFINER helper. Until then it shows for everyone. */}
            <Link href="/" className="text-muted-foreground underline underline-offset-4">
              {BRAND.freePlanBadge}
            </Link>
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
