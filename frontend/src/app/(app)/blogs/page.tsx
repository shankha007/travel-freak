import type { Metadata } from 'next'
import Link from 'next/link'
import { BookOpen, Clock, ExternalLink, Luggage, NotebookPen, Plus } from 'lucide-react'
import { getMyBlogPosts, type BlogListItem } from '@/server/queries/blogs'
import { Badge } from '@/client/components/ui/badge'
import { Button } from '@/client/components/ui/button'
import { Card, CardContent } from '@/client/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/client/components/ui/tabs'

export const metadata: Metadata = {
  title: 'Blogs',
  description: 'Your posts, drafts and published pieces.',
}

export const dynamic = 'force-dynamic'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function PostRow({ post }: { post: BlogListItem }) {
  const published = post.publishedAt !== null

  return (
    <Card>
      <CardContent className="flex flex-wrap items-start justify-between gap-3 p-4">
        <div className="min-w-0 space-y-1">
          <Link
            href={`/blogs/${post.id}/edit`}
            className="font-medium underline-offset-4 hover:underline"
          >
            {post.title}
          </Link>

          {post.excerpt && (
            <p className="line-clamp-2 max-w-prose text-sm text-muted-foreground">{post.excerpt}</p>
          )}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="size-3" aria-hidden />
              {post.readingMinutes} min read
            </span>
            {post.tripTitle && (
              <span className="flex items-center gap-1">
                <Luggage className="size-3" aria-hidden />
                {post.tripTitle}
              </span>
            )}
            <span>
              {published ? `Published ${formatDate(post.publishedAt!)}` : 'Draft'} · edited{' '}
              {formatDate(post.updatedAt)}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Badge variant={published ? 'default' : 'secondary'}>
            {published ? 'Published' : 'Draft'}
          </Badge>
          <Badge variant="outline" className="capitalize">
            {post.visibility}
          </Badge>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Read ${post.title}`}
            nativeButton={false}
            render={<Link href={`/b/${post.slug}`} target="_blank" rel="noreferrer" />}
          >
            <ExternalLink className="size-4" aria-hidden />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-10 text-center">
      <NotebookPen className="size-6 text-muted-foreground" aria-hidden />
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button size="sm" nativeButton={false} render={<Link href="/blogs/new" />}>
        <Plus className="size-4" aria-hidden />
        Write a post
      </Button>
    </div>
  )
}

export default async function BlogsPage() {
  const posts = await getMyBlogPosts()
  const published = posts.filter((p) => p.publishedAt !== null)
  const drafts = posts.filter((p) => p.publishedAt === null)

  const tabs = [
    { value: 'all', label: 'All', items: posts, empty: 'Nothing written yet.' },
    {
      value: 'published',
      label: 'Published',
      items: published,
      empty: 'Nothing published yet. Drafts stay private until you publish them.',
    },
    { value: 'drafts', label: 'Drafts', items: drafts, empty: 'No drafts in progress.' },
  ]

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your blogs</h1>
          <p className="text-sm text-muted-foreground">
            {posts.length === 0
              ? 'Unlimited on every plan — text costs nothing to keep.'
              : `${posts.length} ${posts.length === 1 ? 'post' : 'posts'}, ${published.length} published.`}
          </p>
        </div>

        <Button nativeButton={false} render={<Link href="/blogs/new" />}>
          <Plus className="size-4" aria-hidden />
          New post
        </Button>
      </header>

      <Tabs defaultValue="all" className="gap-4">
        <TabsList>
          {tabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
              <span className="ml-1.5 text-xs text-muted-foreground tabular-nums">
                {tab.items.length}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        {tabs.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="space-y-3">
            {tab.items.length ? (
              tab.items.map((post) => <PostRow key={post.id} post={post} />)
            ) : (
              <EmptyState message={tab.empty} />
            )}
          </TabsContent>
        ))}
      </Tabs>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <BookOpen className="size-3.5" aria-hidden />
        Published public posts are readable at /b/&lt;slug&gt; and carry your name.
      </p>
    </div>
  )
}
