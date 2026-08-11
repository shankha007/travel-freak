import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getBlogDraft, getTripOptions } from '@/server/queries/blogs'
import { BlogStudio } from '@/client/components/blogs/blog-studio'
import { Button } from '@/client/components/ui/button'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: PageProps<'/blogs/[id]/edit'>): Promise<Metadata> {
  const { id } = await params
  const post = await getBlogDraft(id)
  return { title: post ? `Editing ${post.title}` : 'Post not found' }
}

export default async function EditBlogPage({ params }: PageProps<'/blogs/[id]/edit'>) {
  const { id } = await params
  const [post, trips] = await Promise.all([getBlogDraft(id), getTripOptions()])

  // The studio is author-only, so someone else's post is a 404 here even when
  // it is published and readable at /b/[slug].
  if (!post) notFound()

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      <div>
        <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/blogs" />}>
          <ArrowLeft className="size-4" aria-hidden />
          Blogs
        </Button>
      </div>

      <BlogStudio post={post} trips={trips} />
    </div>
  )
}
