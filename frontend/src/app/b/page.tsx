import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, BookOpen, Clock, Luggage } from 'lucide-react'
import { listPublicPosts, type PublicPostCard } from '@/server/queries/public-blogs'
import { BRAND, SITE_URL, pageTitle } from '@/shared/brand'
import { MarketingFooter, MarketingHeader } from '@/client/components/marketing/chrome'
import { Badge } from '@/client/components/ui/badge'
import { Button } from '@/client/components/ui/button'
import { Card, CardContent } from '@/client/components/ui/card'

/**
 * Public blogs — screen 4.
 *
 * The plan puts this at `/blogs`, which the authenticated "My Blogs" screen
 * already occupies; one path cannot be two pages, and the signed-in meaning is
 * the one people type. So the public index lives at `/b`, the index of the
 * `/b/[slug]` posts it lists — the URL a reader is already in when they arrive
 * from one.
 *
 * Rendered per request, like the reader it links to: RLS decides what is on it,
 * so a cached copy would be a cached copy of one visitor's permissions.
 */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Travel blogs',
  description: `Trip writing published on ${BRAND.name} — routes, places and what the photographs left out.`,
  alternates: { canonical: `${SITE_URL}/b` },
  openGraph: {
    type: 'website',
    title: pageTitle('Travel blogs'),
    description: 'Published trip writing from people filling in their own maps.',
  },
}

function formatDay(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default async function PublicBlogsPage() {
  const posts = await listPublicPosts()
  // The newest post gets the wide card. Nothing is editorially "featured" yet —
  // there is no field for it, and inventing one on the read side would be a
  // ranking nobody chose.
  const [latest, ...rest] = posts

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: `${BRAND.name} travel blogs`,
    url: `${SITE_URL}/b`,
    blogPost: posts.map((post) => ({
      '@type': 'BlogPosting',
      headline: post.title,
      url: `${SITE_URL}/b/${post.slug}`,
      datePublished: post.publishedAt ?? undefined,
      author: post.author ? { '@type': 'Person', name: post.author.displayName } : undefined,
    })),
  }

  return (
    <div className="flex flex-1 flex-col">
      <MarketingHeader current="/b" />

      <main className="flex-1">
        <section className="border-b bg-gradient-to-b from-sky-50 to-background dark:from-slate-900 dark:to-background">
          <div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-14 md:px-6 lg:py-20">
            <Badge variant="secondary" className="w-fit">
              Blogs
            </Badge>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              What the photographs left out.
            </h1>
            <p className="max-w-2xl text-lg text-pretty text-muted-foreground">
              Trip writing published by people filling in their own maps — the route, the detour,
              and the bit they would do differently. Free to read, and free to write: blogs are
              unlimited on every plan.
            </p>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-12 md:px-6">
          {posts.length === 0 ? (
            <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed p-12 text-center">
              <BookOpen className="size-6 text-muted-foreground" aria-hidden />
              <div className="space-y-1">
                <h2 className="font-medium">Nothing published yet</h2>
                <p className="max-w-md text-sm text-muted-foreground">
                  Nobody has made a post public so far. The first one could be about the trip you
                  have been meaning to write up.
                </p>
              </div>
              <Button nativeButton={false} render={<Link href="/register" />}>
                Write the first one
                <ArrowRight className="size-4" aria-hidden />
              </Button>
            </div>
          ) : (
            <>
              <PostCard post={latest} featured />

              {rest.length > 0 && (
                <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {rest.map((post) => (
                    <li key={post.id}>
                      <PostCard post={post} />
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>

        <section className="border-t bg-muted/30">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-6 px-4 py-14 md:flex-row md:items-center md:justify-between md:px-6">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Your turn</h2>
              <p className="mt-2 max-w-xl text-muted-foreground">
                Every post here is linked to a real trip on a real map. Write yours in an editor
                that knows about both — publish it publicly, hand it to one person on an unlisted
                link, or keep it to yourself.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-3">
              <Button size="lg" nativeButton={false} render={<Link href="/register" />}>
                Start writing
                <ArrowRight className="size-4" aria-hidden />
              </Button>
              <Button
                size="lg"
                variant="outline"
                nativeButton={false}
                render={<Link href="/pricing" />}
              >
                See the plans
              </Button>
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </div>
  )
}

/**
 * One post.
 *
 * The whole card is not a link: the byline and the trip are links of their own,
 * and nesting them inside one would be invalid HTML and unusable with a screen
 * reader. The title carries the link, and the card is what it sits in.
 */
function PostCard({ post, featured = false }: { post: PublicPostCard; featured?: boolean }) {
  return (
    <Card className={featured ? 'bg-card' : 'h-full'}>
      <CardContent className={featured ? 'space-y-3 p-6 md:p-8' : 'flex h-full flex-col gap-2 p-5'}>
        <h2
          className={
            featured
              ? 'text-2xl font-semibold tracking-tight text-balance sm:text-3xl'
              : 'font-medium text-pretty'
          }
        >
          <Link href={`/b/${post.slug}`} className="hover:underline hover:underline-offset-4">
            {post.title}
          </Link>
        </h2>

        {post.excerpt && (
          <p
            className={
              featured
                ? 'max-w-2xl text-pretty text-muted-foreground'
                : 'line-clamp-3 text-sm text-muted-foreground'
            }
          >
            {post.excerpt}
          </p>
        )}

        <p
          className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground ${featured ? '' : 'mt-auto'}`}
        >
          {post.author && (
            <>
              <Link
                href={`/u/${post.author.username}`}
                className="font-medium text-foreground hover:underline hover:underline-offset-4"
              >
                {post.author.displayName}
              </Link>
              <span aria-hidden>·</span>
            </>
          )}
          {post.publishedAt && (
            <>
              <time dateTime={post.publishedAt}>{formatDay(post.publishedAt)}</time>
              <span aria-hidden>·</span>
            </>
          )}
          <span className="flex items-center gap-1">
            <Clock className="size-3" aria-hidden />
            {post.readingMinutes} min read
          </span>
        </p>

        {post.trip && (
          <p className="text-xs">
            <Link
              href={`/t/${post.trip.slug}`}
              className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
            >
              <Luggage className="size-3" aria-hidden />
              {post.trip.title}
            </Link>
          </p>
        )}
      </CardContent>
    </Card>
  )
}
