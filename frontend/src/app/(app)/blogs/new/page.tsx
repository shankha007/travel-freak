import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getTripOptions } from '@/server/queries/blogs'
import { BlogStudio } from '@/client/components/blogs/blog-studio'
import { Button } from '@/client/components/ui/button'
import { SITE_URL } from '@/shared/brand'

export const metadata: Metadata = {
  title: 'New post',
  description: 'Write about a trip, or about nothing in particular.',
}

export const dynamic = 'force-dynamic'

/**
 * A new post writes no row until the first autosave — an abandoned page leaves
 * nothing behind. The studio swaps the URL for `/blogs/[id]/edit` once the
 * post exists.
 */
export default async function NewBlogPage() {
  const trips = await getTripOptions()

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      <div>
        <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/blogs" />}>
          <ArrowLeft className="size-4" aria-hidden />
          Blogs
        </Button>
      </div>

      <BlogStudio trips={trips} siteUrl={SITE_URL} />
    </div>
  )
}
